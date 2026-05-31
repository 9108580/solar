import base64
import json
import logging
import os
import re
import shutil
import sys
import time
import datetime
import subprocess
import glob
from email.utils import parseaddr
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Any, Dict, List, Optional
from collections import Counter
from urllib.parse import urljoin

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Проверка библиотек
try:
    import gspread
except ImportError:
    pass

try:
    from thefuzz import fuzz
except ImportError:
    pass

# --- КОНФИГУРАЦИЯ ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PIPEDRIVE_TOKEN = os.getenv("PIPEDRIVE_TOKEN", "")
PIPEDRIVE_DOMAIN = os.getenv("PIPEDRIVE_DOMAIN", "wwwmescoil")
SPREADSHEET_ID = os.getenv(
    "SPREADSHEET_ID",
    "15l3jW3NrqP8HAIqPZpi6OXrx0hWn_3OpAncgiiVA1QI",
)

# ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ АВТОПЕЧАТИ (на сервере по умолчанию выключено)
AUTO_PRINT_INVOICES = os.getenv("AUTO_PRINT_INVOICES", "true" if not os.getenv("PERSIK_SERVER") else "false").lower() in (
    "1",
    "true",
    "yes",
)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

SUPPLIER_RULES: Dict[str, Dict[str, Any]] = {}

def clean_string_strictly(s: str) -> str:
    if not s: return ""
    return re.sub(r'[^\x21-\x7E]', '', str(s)).strip().lower()

def setup_safe_logging():
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    class SafeStreamHandler(logging.StreamHandler):
        def emit(self, record):
            try:
                if self.stream is not None: super().emit(record)
            except: pass
    handler = SafeStreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
    logging.root.addHandler(handler)
    logging.root.setLevel(logging.INFO)

setup_safe_logging()
logger = logging.getLogger("Persik")

class PipedriveMatcher:
    AUTO_MATCH_THRESHOLD = 75 
    def __init__(self, token: str):
        self.token = token
        self.api_url = "https://api.pipedrive.com/v1"
        self.cache = []
        self.agent_options = {}

    def _safe_request(self, method: str, endpoint: str, **kwargs):
        url = f"{self.api_url}/{endpoint}"
        if 'params' not in kwargs:
            kwargs['params'] = {}
        kwargs['params']['api_token'] = self.token
        kwargs['timeout'] = 45 
        
        for attempt in range(5):
            try:
                if method.upper() == 'GET':
                    res = requests.get(url, **kwargs)
                else:
                    res = requests.post(url, **kwargs)
                
                if res.status_code == 401:
                    print("  [!] שגיאה קריטית: ה-Token של Pipedrive לא חוקי או נמחק!")
                    return res
                    
                if res.status_code in [429, 500, 502, 503, 504]:
                    wait_time = 5 * (attempt + 1)
                    print(f"  [⏳] תקלה זמנית ב-Pipedrive (ניסיון {attempt+1}/5). ממתין {wait_time} שניות...")
                    time.sleep(wait_time)
                    continue
                    
                return res
            except Exception as e:
                if attempt < 4:
                    wait_time = 5 * (attempt + 1)
                    print(f"  [⏳] איבוד תקשורת עם Pipedrive (ניסיון {attempt+1}/5). ממתין...")
                    time.sleep(wait_time)
                    continue
                print(f"  [!] שגיאת רשת מול CRM: {e}")
                return None
        return None

    def normalize_name(self, name: str) -> str:
        if not name: return ""
        cleaned = str(name).lower()
        cleaned = cleaned.replace('בע"מ', "").replace('בע"מ', "").replace("בעמ", "").replace("ltd", "")
        cleaned = cleaned.replace("‏", " ").replace("‎", " ").replace(" ", " ")
        cleaned = re.sub(r"[|/\\\[\]{}()<>:;#*_=+~\"'`!?.,-]", " ", cleaned)
        cleaned = re.sub(r"\d+", " ", cleaned) 
        return cleaned.strip()

    def refresh_cache(self):
        print("  [PIPE] ...מסנכרן נתונים מ-CRM")
        
        try:
            res = self._safe_request('GET', 'dealFields', params={"limit": 500})
            if res and res.status_code == 200:
                for f in res.json().get('data', []):
                    if f.get('key') in ["992ba6fd79bda66fe7da82726d2eef2ac5212521", "36bd74eb55d0269691c5604eaa0480c12b44e4e9"]:
                        for opt in f.get('options', []):
                            self.agent_options[str(opt.get('id'))] = opt.get('label', '')
        except Exception: pass

        deals, start = [], 0
        try:
            while True:
                res = self._safe_request('GET', 'deals', params={
                    "start": start, "limit": 500, "status": "all_not_deleted"
                })
                if not res or res.status_code != 200: break
                
                res_json = res.json()
                data = res_json.get("data", []) or []
                for item in data:
                    deals.append({
                        "id": item.get("id"), 
                        "title": item.get("title", ""), 
                        "normalized": self.normalize_name(item.get("title", ""))
                    })
                if not res_json.get("additional_data", {}).get("pagination", {}).get("more_items_in_collection"): 
                    break
                start += 500
            self.cache = deals
            print(f"  [PIPE] .עסקאות {len(self.cache)} :מוכן CRM מסד הנתונים של")
        except Exception as e: print(f"  [!] {e} :CRM שגיאת")

    def resolve_candidate(self, raw_name: str) -> Dict[str, Any]:
        candidate = self.normalize_name(raw_name)
        best = {"score": 0, "deal_id": 0, "match": "", "decision": "MANUAL"}
        if not candidate or "לא זוהה" in candidate: return best
        
        for deal in self.cache:
            score = fuzz.token_set_ratio(candidate, deal["normalized"])
            if score > best["score"]:
                best.update({"score": score, "deal_id": deal["id"], "match": deal["title"]})
        
        if best["score"] < self.AUTO_MATCH_THRESHOLD and "-" in raw_name:
            prefix = self.normalize_name(raw_name.split("-")[0])
            if len(prefix) > 3:
                for deal in self.cache:
                    score = fuzz.token_set_ratio(prefix, deal["normalized"])
                    if score > best["score"]:
                        best.update({"score": score, "deal_id": deal["id"], "match": deal["title"]})

        if best["score"] >= self.AUTO_MATCH_THRESHOLD: best["decision"] = "AUTO"
        return best

    def upload_file(self, deal_id: int, file_path: str):
        if not deal_id or not os.path.exists(file_path): return
        try:
            with open(file_path, 'rb') as f:
                res = self._safe_request('POST', 'files', data={'deal_id': deal_id}, files={'file': f})
                if res and res.status_code in [200, 201]: 
                    print(f"  [PIPE] ({deal_id}#) CRM-הקובץ הועלה בהצלחה ל")
        except: pass

    def get_agent_for_deal(self, deal_id: int) -> str:
        if not deal_id: return ""
        try:
            res = self._safe_request('GET', f'deals/{deal_id}')
            if not res or res.status_code != 200: return ""
            
            deal_data = res.json().get("data", {})
            if not deal_data: return ""
            
            keys_to_check = [
                "992ba6fd79bda66fe7da82726d2eef2ac5212521", 
                "36bd74eb55d0269691c5604eaa0480c12b44e4e9",
                "1407c73b3131f82eb498d49a7702f9efca6a57a5"
            ]
            
            agent_text = ""
            for k in keys_to_check:
                val = deal_data.get(k)
                if val:
                    if isinstance(val, dict): 
                        agent_text += str(val.get("name", "")) + " "
                    else: 
                        val_str = str(val).strip()
                        if val_str in self.agent_options:
                            agent_text += self.agent_options[val_str] + " "
                        else:
                            agent_text += val_str + " "
                        
            return agent_text.strip()
        except:
            return ""

    def get_deal_custom_data(self, client_name: str) -> Dict[str, Any]:
        match = self.resolve_candidate(client_name)
        deal_id = match.get("deal_id")
        deal_name = match.get("match", "")
        
        if not deal_id and "לא הוגדר" not in client_name and "מלאי" not in client_name:
            try:
                res = self._safe_request('GET', 'deals/search', params={"term": client_name})
                if res and res.status_code == 200:
                    items = res.json().get("data", {}).get("items", [])
                    if items:
                        deal_id = items[0]["item"]["id"]
                        deal_name = items[0]["item"]["title"]
            except Exception: pass
        
        result = {"dc": 0.0, "opt": 0.0, "wash": "", "paid": 0.0, "deal_name": deal_name}
        if not deal_id: return result
            
        try:
            dc_key = "1dff250c34365c64ed148b1ae8553b9fe5c2ece6"    
            opt_key = "8335c2a5d428ce7af7ec5a8034350af0b1bc6cb2"   
            wash_key = "69c208c8c91aca76d9c56d0ec4467ae5479fd580"  
            paid_key = "99bbad4fa4d276bc11b7d0e896b20bf17c937ced"  
            
            res = self._safe_request('GET', f'deals/{deal_id}')
            if not res or res.status_code != 200: return result
            
            deal_data = res.json().get("data", {})
            if not deal_data: return result
            
            def _clean(v):
                if not v: return 0.0
                try: return float(re.sub(r"[^\d,.-]", "", str(v).strip()).replace(",", ""))
                except: return 0.0

            result["dc"] = _clean(deal_data.get(dc_key))
            result["opt"] = _clean(deal_data.get(opt_key))
            wash_raw = deal_data.get(wash_key)
            result["wash"] = 2450 if wash_raw else ""  
            result["paid"] = _clean(deal_data.get(paid_key))
            return result
        except Exception as e:
            return result

class GoogleSheetsAgent:
    def __init__(self, spreadsheet_id: str, matcher: PipedriveMatcher = None):
        self.spreadsheet_id = spreadsheet_id
        self.sh = None
        self.matcher = matcher
        try:
            cred_candidates = [
                "credentials/service_account.json",
                "credentials.json",
            ]
            cred_path = next((p for p in cred_candidates if os.path.exists(p)), None)
            if cred_path:
                gc = gspread.service_account(filename=cred_path)
                self.sh = gc.open_by_key(self.spreadsheet_id).sheet1
        except Exception as e: print(f"  [!] {e} :Google Sheets שגיאת")

    def is_duplicate(self, supplier: str, invoice_number: str, project: str = "") -> bool:
        if not self.sh or not invoice_number: return False
        try:
            def clean_inv(val): return re.sub(r'[^A-Za-z0-9]', '', str(val)).upper()
            def clean_sup(val): return re.sub(r'[^A-Za-zא-ת]', '', str(val)).lower()

            target_inv = clean_inv(invoice_number)
            target_sup = clean_sup(supplier)
            target_proj = clean_sup(project)

            if not target_inv: return False

            all_rows = self.sh.get_all_values()
            for i, row in enumerate(all_rows[1:]):
                if len(row) > 3:
                    existing_sup = clean_sup(row[2])
                    existing_inv = clean_inv(row[3])
                    existing_proj = clean_sup(row[5]) if len(row) > 5 else ""
                    
                    if target_inv == existing_inv and existing_inv != "":
                        is_sup_match = False
                        if target_sup in existing_sup or existing_sup in target_sup or target_sup == existing_sup:
                            is_sup_match = True
                        else:
                            try:
                                if fuzz.ratio(target_sup, existing_sup) > 85: is_sup_match = True
                            except: pass
                            
                        if is_sup_match:
                            # ИСКЛЮЧЕНИЕ ДЛЯ АЛЮМ ЛЭНД: Разрешаем одинаковые номера счетов, если проекты разные
                            if "אלום" in target_sup or "alum" in target_sup:
                                if target_proj and target_proj in existing_proj:
                                    print(f"  [התראת כפילות] !חסימה חשבונית {invoice_number} (פרויקט: {project}) כבר קיימת בטבלה (שורה {i+2}).")
                                    return True
                            else:
                                print(f"  [התראת כפילות] !חסימה חשבונית {invoice_number} כבר קיימת בטבלה (שורה {i+2}).")
                                return True
            return False
        except Exception as e: 
            return False

    def append_invoice(self, data: Dict[str, Any]) -> str:
        if not self.sh or not data: return "ERROR"
        inv_num = str(data.get("invoice_number", "")).strip().upper()
        
        # Передаем имя проекта в функцию дубликатов
        if self.is_duplicate(data["supplier"], inv_num, data.get("project", "")):
            print(f"  [דילוג] חשבונית {inv_num} כבר קיימת בטבלה.")
            return "DUPLICATE"
            
        if data["total"] <= 0 or not inv_num or inv_num in ["N/A", "NONE"]:
            print(f"  [דחייה] שגיאת נתונים (סכום {data.get('total', 0)} או חסר מספר חשבונית '{inv_num}').")
            return "ERROR"
            
        try:
            deal_id = data.get("deal_id")
            pd_url = f"https://{PIPEDRIVE_DOMAIN}.pipedrive.com/deal/{deal_id}" if deal_id else ""
            pd_formula = f'=HYPERLINK("{pd_url}", "открыть ב-CRM 🔗")' if pd_url else "—"
            
            gmail_url = data.get("gmail_link", "")
            # ФИКС БЛОКИРОВКИ: Убираем формулу =HYPERLINK для почты. Вставляем просто прямую ссылку.
            # Боты Google Sheets пытаются предзагружать эти формулы и этим "кладут" защиту Gmail.
            gmail_formula = gmail_url if gmail_url else "—"
            
            row = [
                datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), 
                data.get("invoice_date", ""),                       
                data["supplier"],                                   
                f"'{inv_num}",                                      
                data["items"],                                      
                data["project"],                                    
                data["subtotal"],                                   
                data["vat"],                                        
                data["total"],                                      
                data["decision_label"],                             
                pd_formula,                                         
                gmail_formula                                       
            ]
            self.sh.append_row(row, value_input_option="USER_ENTERED")
            last_row = len(self.sh.get_all_values())
            if "MANUAL" in data["decision_label"]:
                self.sh.format(f"A{last_row}:L{last_row}", {"backgroundColor": {"red": 1.0, "green": 0.94, "blue": 0.94}})
            return "SUCCESS"
        except Exception as e: 
            print(f"  [!] {e} :שגיאה ברישום לטבלה")
            return "ERROR"

    def _clean_float(self, value):
        try:
            val_str = re.sub(r"[^\d,.-]", "", str(value).strip())
            return float(val_str.replace(",", ""))
        except:
            return 0.0

    def generate_client_report(self, client_name: str) -> str:
        if not self.sh: return ".שגיאה: אין חיבור ל-Google Sheets"
        try:
            all_data_formatted = self.sh.get_all_values()
            if len(all_data_formatted) < 2: return ".הטבלה הראשית ריקה"

            try:
                access_token = self.sh.client.auth.token
                url = f"https://sheets.googleapis.com/v4/spreadsheets/{self.spreadsheet_id}/values/{self.sh.title}!A:L?valueRenderOption=FORMULA"
                res = requests.get(url, headers={'Authorization': f'Bearer {access_token}'})
                all_data_formulas = res.json().get('values', [])
            except:
                all_data_formulas = all_data_formatted

            keep_indices = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11]
            headers = [all_data_formatted[0][i] for i in keep_indices if i < len(all_data_formatted[0])]
            rows_formatted = all_data_formatted[1:]

            filtered_rows = []
            search_term = client_name.strip().lower()

            sum_construkcia = sum_panels = sum_inverters = sum_hashmal = sum_bdika = 0.0

            for r_idx, row in enumerate(rows_formatted):
                if len(row) > 5 and search_term in str(row[5]).lower():
                    new_row = []
                    for i in keep_indices:
                        val = row[i] if i < len(row) else ""
                        if i in [10, 11] and (r_idx + 1) < len(all_data_formulas):
                            try:
                                formula_row = all_data_formulas[r_idx + 1]
                                if i < len(formula_row):
                                    f_val = str(formula_row[i])
                                    if f_val.startswith('='): val = f_val
                            except: pass
                        new_row.append(val)
                    
                    filtered_rows.append(new_row)
                    
                    amount = self._clean_float(row[6]) if len(row) > 6 else 0.0
                    item_name = str(row[4]).lower() if len(row) > 4 else ""
                    
                    if 'קונסטרוקציה' in item_name: sum_construkcia += amount
                    elif 'פנלים' in item_name: sum_panels += amount
                    elif 'ממירים' in item_name: sum_inverters += amount
                    elif 'חשמל' in item_name: sum_hashmal += amount
                    elif 'בדיקה' in item_name: sum_bdika += amount

            if not filtered_rows: return f"'{client_name}' הלקוח לא נמצא בטבלה."

            if not self.matcher:
                self.matcher = PipedriveMatcher(PIPEDRIVE_TOKEN)
                self.matcher.refresh_cache()

            pipe_data = self.matcher.get_deal_custom_data(client_name)
            dc_val = pipe_data.get("dc", 0.0)
            opt_val = pipe_data.get("opt", 0)
            wash_val = pipe_data.get("wash", "")
            paid_val = pipe_data.get("paid", 0.0)
            kibalnu_val = round(paid_val / 1.18, 2)

            wb = self.sh.spreadsheet
            try: sheet2 = wb.worksheet("גיליון2")
            except:
                try: sheet2 = wb.get_worksheet(1)
                except: return "שגיאה: הלשונית 'גיליון2' לא נמצאה."

            pnl_start_row = 11
            sheet2_data = []
            try:
                sheet2_data = sheet2.get_all_values()
                for r_idx, row in enumerate(sheet2_data):
                    if len(row) > 0 and str(row[0]).strip() == "שם לקוח":
                        pnl_start_row = r_idx + 1
                        break
            except: pass

            if pnl_start_row > 1:
                clear_range = f"A1:L{pnl_start_row - 1}"
                try: sheet2.batch_clear([clear_range])
                except AttributeError:
                    empty_data = [[""] * 12 for _ in range(pnl_start_row - 1)]
                    try: sheet2.update(values=empty_data, range_name=clear_range)
                    except: sheet2.update(clear_range, empty_data)
                except Exception: pass
                
                try:
                    sheet2.format(clear_range, {
                        "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
                        "textFormat": {"bold": False}
                    })
                except: pass

            output_invoices = [headers] + filtered_rows
            try: sheet2.batch_update([{'range': 'A1', 'values': output_invoices}], value_input_option='USER_ENTERED')
            except Exception:
                try: sheet2.update(values=output_invoices, range_name="A1", value_input_option="USER_ENTERED")
                except: sheet2.update("A1", output_invoices, value_input_option="USER_ENTERED")

            def col_to_letter(col_num):
                string = ""
                while col_num > 0:
                    col_num, remainder = divmod(col_num - 1, 26)
                    string = chr(65 + remainder) + string
                return string

            target_col_idx = 1
            if pnl_start_row - 1 < len(sheet2_data):
                pnl_row_data = sheet2_data[pnl_start_row - 1]
                for i in range(1, len(pnl_row_data)):
                    if str(pnl_row_data[i]).strip().lower() == client_name.strip().lower():
                        target_col_idx = i
                        break
                else:
                    for i in range(1, 100):
                        if i < len(pnl_row_data):
                            if str(pnl_row_data[i]).strip() == "":
                                target_col_idx = i
                                break
                        else:
                            target_col_idx = i
                            break
            
            target_col_num = target_col_idx + 1
            col_letter = col_to_letter(target_col_num)

            pnl_data_values = [
                [client_name], [dc_val], [""], [1400], [""], [sum_construkcia], [sum_panels], [sum_inverters], [opt_val], [sum_hashmal], [""], [""], [3300],
                [f"={col_letter}{pnl_start_row + 1}*650"], [500], [sum_bdika], [750], [""], [1500], [125], [100], [""], [wash_val], [""],
                [f"=SUM({col_letter}{pnl_start_row + 2}:{col_letter}{pnl_start_row + 23})"], [kibalnu_val],
                [f"={col_letter}{pnl_start_row + 25}-{col_letter}{pnl_start_row + 24}"],
                [f"={col_letter}{pnl_start_row + 26}-MAX({col_letter}{pnl_start_row + 26}/2, 10500)"]
            ]

            pnl_range = f"{col_letter}{pnl_start_row}:{col_letter}{pnl_start_row + 27}"
            try: sheet2.update(values=pnl_data_values, range_name=pnl_range, value_input_option="USER_ENTERED")
            except: sheet2.update(pnl_range, pnl_data_values, value_input_option="USER_ENTERED")

            return f"'{col_letter}' הדוח הופק בהצלחה! יובאו {len(filtered_rows)} חשבוניות. P&L נוסף לעמודה"
        except Exception as e: return f"{e} :שגיאה ביצירת הדוח"

    def generate_payment_report(self) -> str:
        if not self.sh: return "שגיאה: אין חיבור ל-Google Sheets"
        try:
            all_rows = self.sh.get_all_values()
            if len(all_rows) < 2: return "הטבלה הראשית ריקה"

            unpaid_by_supplier = {}
            
            # Умная функция проверки: один и тот же это поставщик или нет?
            def is_same_supplier(sup1, sup2):
                s1 = re.sub(r'בע"מ|בעמ|ltd|[-.,\'"\/]', ' ', str(sup1).lower()).strip()
                s2 = re.sub(r'בע"מ|בעמ|ltd|[-.,\'"\/]', ' ', str(sup2).lower()).strip()
                s1 = s1.replace('תדיראן', 'תדירן')
                s2 = s2.replace('תדיראן', 'תדירן')
                s1_clean = re.sub(r'\s+', '', s1)
                s2_clean = re.sub(r'\s+', '', s2)
                
                if s1_clean == s2_clean: return True
                try:
                    if fuzz.token_set_ratio(s1, s2) > 90: return True
                    if fuzz.ratio(s1_clean, s2_clean) > 85: return True
                except: pass
                return False

            for r_idx, row in enumerate(all_rows[1:]):
                # Проверяем колонку M (индекс 12) - дата оплаты. Если пустая - счет не оплачен.
                is_paid = False
                if len(row) > 12 and str(row[12]).strip() != "":
                    is_paid = True

                if not is_paid:
                    supplier = str(row[2]).strip() if len(row) > 2 else ""
                    if not supplier: continue

                    subtotal = self._clean_float(row[6]) if len(row) > 6 else 0.0
                    vat = self._clean_float(row[7]) if len(row) > 7 else 0.0
                    total = self._clean_float(row[8]) if len(row) > 8 else 0.0
                    
                    if subtotal == 0 and total == 0: continue

                    # Ищем, есть ли уже такой поставщик (с учетом опечаток и сокращений)
                    matched_key = None
                    for existing_key in unpaid_by_supplier.keys():
                        if is_same_supplier(supplier, existing_key):
                            matched_key = existing_key
                            break
                    
                    if not matched_key:
                        unpaid_by_supplier[supplier] = {"subtotal": 0.0, "vat": 0.0, "total": 0.0}
                        matched_key = supplier
                    else:
                        # Если новое имя более "официальное" (длиннее и содержит בע"מ), 
                        # меняем ключ, чтобы в отчете было красивое название
                        if len(supplier) > len(matched_key) and 'בע"מ' in supplier and 'בע"מ' not in matched_key:
                            unpaid_by_supplier[supplier] = unpaid_by_supplier.pop(matched_key)
                            matched_key = supplier

                    unpaid_by_supplier[matched_key]["subtotal"] += subtotal
                    unpaid_by_supplier[matched_key]["vat"] += vat
                    unpaid_by_supplier[matched_key]["total"] += total

            wb = self.sh.spreadsheet
            try: 
                sheet3 = wb.worksheet("גיליון3")
            except:
                try: sheet3 = wb.add_worksheet("גיליון3", rows=1000, cols=20)
                except: return "שגיאה: הלשונית 'גיליון3' לא נמצאה ולא ניתן היה ליצור אותה."

            today_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
            
            output_data = [
                ['תאריך ביצוע', 'ספק', 'סכום ללא מע"מ', 'מע"מ', 'סה"כ לתשלום']
            ]

            for sup, sums in unpaid_by_supplier.items():
                if sums["total"] > 0:
                    output_data.append([
                        today_str,
                        sup,
                        round(sums["subtotal"], 2),
                        round(sums["vat"], 2),
                        round(sums["total"], 2)
                    ])

            # --- הוספה למטה (לא למחוק את הישן) ---
            existing_data = sheet3.get_all_values()
            last_row = len(existing_data)
            
            if last_row == 0:
                start_row = 1
            else:
                start_row = last_row + 2  # Пропускаем одну пустую строку
            
            range_name = f"A{start_row}"
            header_range = f"A{start_row}:E{start_row}"
            
            try: sheet3.update(values=output_data, range_name=range_name, value_input_option="USER_ENTERED")
            except Exception:
                try: sheet3.update(range_name, output_data, value_input_option="USER_ENTERED")
                except: pass

            try:
                sheet3.format(header_range, {
                    "backgroundColor": {"red": 0.0, "green": 1.0, "blue": 1.0}, # Бирюзовый цвет шапки
                    "textFormat": {"bold": True}
                })
            except: pass

            return f"✅ דוח תשלומים הוסף בהצלחה ל-גיליון3 (שורה {start_row})! נמצאו {len(output_data)-1} ספקים לתשלום."
        except Exception as e: 
            return f"שגיאה בהפקת דוח תשלומים: {e}"

class NativeGeminiParser:
    def __init__(self, matcher: PipedriveMatcher):
        self.matcher = matcher

    def _to_float(self, value: Any) -> float:
        if value is None: return 0.0
        if isinstance(value, (int, float)): return float(value)
        val_str = str(value).upper()
        if val_str in ["NONE", "NULL", "N/A", ""]: return 0.0
        val_str = re.sub(r"[A-Z₪א-ת\s]", "", val_str)
        val_str = re.sub(r"[^\d,.-]", "", val_str)
        try: return float(val_str.replace(",", ""))
        except: return 0.0

    def extract_data(self, file_path: str, supplier_info: Dict[str, Any], filename: str) -> Dict[str, Any]:
        with open(file_path, "rb") as f: encoded_file = base64.b64encode(f.read()).decode("utf-8")
        mime_type = "text/html" if file_path.lower().endswith(".html") else "application/pdf"
        
        prompt = f"""
        Extract data from this Israeli Tax Invoice. Supplier: '{supplier_info['name']}'.
        Extract EXACT values as they appear.
        1. invoice_number: Main document number. For RCS Solar, the correct invoice number is located in the BIG UNDERLINED TITLE in the center of the page (e.g., 'חשבונית מס מרכזת - העתק MIP260762' or 'חשבונית מס - MIP...'). Extract the number starting with MIP from this central title. DO NOT take the numbers next to 'מספר תעודה:', 'פרטים:', or 'הזמנה' (like PIP numbers).
        2. total: Final amount to pay (סה"כ מחיר).
        3. subtotal: Amount BEFORE VAT. For RCS Solar, look for 'מחיר אחרי הנחה'.
        4. vat: Tax amount (מע"מ).
        5. items: Product description. Extract exactly what is written under 'תאור מוצר' or 'תאור פריט'. Do not guess the product type.
        6. project_name: Client/Project name. For RCS Solar, the client name is the text located EXACTLY ABOVE the sentence starting with 'הסחורה בבעלות' at the bottom right. Example: 'אנס סלימאן' or 'פליקס חודוש' or 'עומר עדין'. You MUST extract this name! Do NOT extract "Aaron Simon" or "Trading".
        7. is_invoice: true ONLY if it is 'חשבונית מס' or 'חשבונית מס מרכזת'. false otherwise.
        IMPORTANT: NEVER use 'י.ו. מומחי אנרגיה סולארית בע"מ' as the project name.
        """
        
        schema = {
            "type": "OBJECT",
            "properties": {
                "supplier_name": {"type": "STRING"},
                "invoice_date": {"type": "STRING"},
                "is_invoice": {"type": "BOOLEAN"},
                "invoice_number": {"type": "STRING"},
                "items": {"type": "STRING"},
                "total": {"type": "STRING"},
                "subtotal": {"type": "STRING"},
                "vat": {"type": "STRING"},
                "project_name": {"type": "STRING"}
            },
            "required": ["invoice_number", "total", "subtotal", "vat", "items", "project_name", "is_invoice"]
        }
        
        api_host = "https://" + "generativelanguage.googleapis.com"
        url = f"{api_host}/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime_type, "data": encoded_file}}]}], 
            "generationConfig": {
                "responseMimeType": "application/json", 
                "responseSchema": schema,
                "temperature": 0.0
            }
        }
        
        result = None
        for attempt in range(5):
            try:
                res = requests.post(url, json=payload, timeout=60).json()
                if "error" in res:
                    err_msg = res['error'].get('message', '')
                    if "high demand" in err_msg.lower() or "quota" in err_msg.lower() or "503" in err_msg.lower() or "temporar" in err_msg.lower():
                        if attempt < 4:
                            wait_time = 5 * (attempt + 1)
                            print(f"  [⏳] שרתי Google עמוסים (ניסיון {attempt+1}/5). ממתין {wait_time} שניות...")
                            time.sleep(wait_time)
                            continue
                    print(f"  [!] API Error: {err_msg}")
                    return None
                    
                text_part = res.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
                result = json.loads(text_part)
                
                print(f"  [AI-DEBUG] -> Inv: {result.get('invoice_number')} | Total: {result.get('total')} | Sub: {result.get('subtotal')} | Items: {result.get('items')} | Proj: {result.get('project_name')}")
                break 
                
            except Exception as e: 
                print(f"  [!] AI Parse Error: {e}")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None
        
        if not result:
            return None
        
        actual_supplier = result.get("supplier_name") or supplier_info["name"]
        
        inv_raw = str(result.get("invoice_number", "")).strip().upper()
        if inv_raw in ["NONE", "NULL", "N/A"]: inv_raw = ""
        inv_num = inv_raw.replace("מספר תעודה:", "").replace("ברקוד:", "").replace("*", "").replace(" ", "").strip()
        
        total_val = self._to_float(result.get("total"))
        is_real_invoice = result.get("is_invoice", True)
        invoice_date = str(result.get("invoice_date") or "").strip()

        if not is_real_invoice or any(x in inv_num for x in ["SH", "PIP", "SO", "PQ", "RLP"]):
            return None

        raw_items = result.get("items") or "לא צוין"
        processed_items = ", ".join([str(i) for i in raw_items]) if isinstance(raw_items, list) else str(raw_items).strip()

        supp_lower = actual_supplier.lower()
        if "ירדן" in supp_lower and ("חזן" in supp_lower or "חשמל" in supp_lower):
            actual_supplier = "ירדן חזן"

        raw_project = str(result.get("project_name") or "").strip()
        
        if actual_supplier == "ירדן חזן":
            if "-" in processed_items:
                raw_project = processed_items.split("-")[0].strip()
            elif not raw_project or raw_project.upper() in ["NONE", "NULL", "N/A", ""]:
                raw_project = processed_items.strip()

        items_lower = processed_items.lower()
        if "קונסטרוקציה" in supp_lower: processed_items = "קונסטרוקציה"
        elif actual_supplier == "ירדן חזן": processed_items = "בדיקה"
        elif "מערכות" in supp_lower: processed_items = "חשמל"
        elif any(k in items_lower for k in ["ממיר", "inverter", "growatt", "solaredge", "optimizer", "se15k", "s500b"]): processed_items = "ממירים"
        elif any(k in items_lower for k in ["פנל", "מודול", "bifacial", "panel", "jinko", "canadian", "longi", "trina"]): processed_items = "פנלים"
        elif any(k in items_lower for k in ["פרופיל", "קושרת", "בורג", "structure"]): processed_items = "קונסטרוקציה"
        elif any(k in items_lower for k in ["לוח", "מפסק", "ארון", "מונה", "חשמל"]): processed_items = "חשמל"

        stop_patterns = [
            'י.ו. מומחי אנרגיה סולארית בע"מ', 'י.ו. מומחי אנרגיה', 'פרטים:', 
            'תאור פרויקט:', 'שם פרויקט:', 'Trading', 'סניף', 'סניף:', 'חזן ירדן', 'ירדן חזן',
            'Aaron Simon', 'Testing', 'סוכן:', 'חיה טננבוים', 'הסחורה בבעלות', 'אר סי אס סולאר'
        ]
        
        clean_project = raw_project
        for p in stop_patterns: 
            clean_project = re.sub(re.escape(p), "", clean_project, flags=re.IGNORECASE).strip()
            
        if "-" in clean_project: clean_project = clean_project.split("-")[0].strip()
        
        clean_project = re.sub(r"^[ \-:,]+|[ \-:,]+$", "", clean_project).strip()
        
        if not clean_project or clean_project.upper() in ["NONE", "NULL", "N/A"]: 
            clean_project = "לא הוגדר (מלאי)"

        if "לא הוגדר" in clean_project or "מלאי" in clean_project:
            match = {"decision": "MANUAL", "deal_id": 0, "match": clean_project}
        else:
            match = self.matcher.resolve_candidate(clean_project)
            
        return {"invoice_date": invoice_date, "supplier": actual_supplier, "invoice_number": inv_num, "items": processed_items, "subtotal": self._to_float(result.get("subtotal")), "vat": self._to_float(result.get("vat")), "total": total_val, "project": match["match"] if match["decision"] == "AUTO" else clean_project, "deal_id": match.get("deal_id", 0), "decision_label": "AUTO ✅" if match["decision"] == "AUTO" else "MANUAL ⚠️", "path": file_path}

    def extract_alum_land_data(self, file_path: str, supplier_info: Dict[str, Any], filename: str) -> List[Dict[str, Any]]:
        with open(file_path, "rb") as f: encoded_file = base64.b64encode(f.read()).decode("utf-8")
        mime_type = "text/html" if file_path.lower().endswith(".html") else "application/pdf"
        
        prompt = f"""
        Extract data from this CONSOLIDATED Tax Invoice (חשבונית מרוכזת) from 'אלום לנד בע"מ'.
        1. invoice_date: Document date (DD/MM/YYYY)
        2. invoice_number: The main document number
        3. rows: Array of items. For EACH row, extract project_name (תיאור) and subtotal (סה"כ) WITHOUT VAT.
        """
        
        schema = {
            "type": "OBJECT",
            "properties": {
                "invoice_date": {"type": "STRING"},
                "invoice_number": {"type": "STRING"},
                "rows": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "project_name": {"type": "STRING"},
                            "subtotal": {"type": "NUMBER"}
                        }
                    }
                }
            },
            "required": ["invoice_number", "rows"]
        }
        
        api_host = "https://" + "generativelanguage.googleapis.com"
        url = f"{api_host}/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime_type, "data": encoded_file}}]}], 
            "generationConfig": {
                "responseMimeType": "application/json", 
                "responseSchema": schema,
                "temperature": 0.0
            }
        }
        
        result = None
        for attempt in range(5):
            try:
                res = requests.post(url, json=payload, timeout=60).json()
                if "error" in res:
                    err_msg = res['error'].get('message', '')
                    if "high demand" in err_msg.lower() or "quota" in err_msg.lower() or "503" in err_msg.lower() or "temporar" in err_msg.lower():
                        if attempt < 4:
                            wait_time = 5 * (attempt + 1)
                            print(f"  [⏳] שרתי Google עמוסים (ניסיון {attempt+1}/5). ממתין {wait_time} שניות...")
                            time.sleep(wait_time)
                            continue
                    return []
                    
                text_part = res.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
                result = json.loads(text_part)
                break
            except Exception as e:
                if attempt < 4:
                    time.sleep(5)
                    continue
                return []
                
        if not result:
            return []
            
        actual_supplier = "אלום לנד בע\"מ"
        inv_raw = str(result.get("invoice_number") or "").strip().upper()
        if inv_raw in ["NONE", "NULL", "N/A"]: return []
        inv_num = inv_raw
        
        invoice_date = str(result.get("invoice_date") or "").strip()
        if not inv_num: return []

        grouped_projects = {}
        for row in result.get("rows", []):
            raw_project = str(row.get("project_name") or "").strip()
            if not raw_project or raw_project in ["NONE", "NULL"]: continue
            subtotal = self._to_float(row.get("subtotal"))
            if subtotal <= 0: continue
            
            match = self.matcher.resolve_candidate(raw_project) if "לא זוהה" not in raw_project else {"decision": "MANUAL", "deal_id": 0, "match": raw_project}
            resolved_name = match["match"] if match["decision"] == "AUTO" else raw_project
            if resolved_name in grouped_projects: grouped_projects[resolved_name]["subtotal"] += subtotal
            else: grouped_projects[resolved_name] = {"subtotal": subtotal, "deal_id": match.get("deal_id", 0), "decision_label": "AUTO ✅" if match["decision"] == "AUTO" else "MANUAL ⚠️"}

        output_list = []
        for proj_name, data in grouped_projects.items():
            subtotal_combined = data["subtotal"]
            vat = round(subtotal_combined * 0.18, 2)
            total = round(subtotal_combined + vat, 2)
            output_list.append({"invoice_date": invoice_date, "supplier": actual_supplier, "invoice_number": inv_num, "items": "קונסטרוקציה", "subtotal": round(subtotal_combined, 2), "vat": vat, "total": total, "project": proj_name, "deal_id": data["deal_id"], "decision_label": data["decision_label"], "path": file_path})
        return output_list

class GmailAgent:
    def __init__(self):
        self.download_dir = "data/downloads"
        self.processed_dir = "data/processed"
        self.manual_dir = "data/manual_review"
        for d in [self.download_dir, self.processed_dir, self.manual_dir]: 
            os.makedirs(d, exist_ok=True)
            
        self.agents_file = "data/agents.json"
        if not os.path.exists(self.agents_file):
            with open(self.agents_file, "w", encoding="utf-8") as f:
                json.dump({
                    "רמי": "ramyburman@gmail.com",
                    "אבי": "aviranarnon@gmail.com",
                    "מוחמד": "Muhammad.411@outlook.co.il",
                    "טל כהן": "Cohentalshlomo@gmail.com",
                    "דניאל": "Fishman.d777@gmail.com",
                    "יונתן": "kashani82@gmail.com",
                    "פיני": "alfasi.pini@gmail.com",
                    "אנדריי": "",
                    "שחר": ""
                }, f, indent=4, ensure_ascii=False)
                
        self.matcher = PipedriveMatcher(PIPEDRIVE_TOKEN)
        self.sheets = GoogleSheetsAgent(SPREADSHEET_ID, matcher=self.matcher)
        self.parser = NativeGeminiParser(self.matcher)
        self.current_user_email = None

    def sanitize_folder_name(self, name: str) -> str: 
        return re.sub(r'[<>:"/\\|?*]', '', name).strip()

    def print_document(self, file_path: str):
        if not AUTO_PRINT_INVOICES or not file_path.lower().endswith('.pdf'): return
        try:
            abs_path = os.path.abspath(file_path)
            base_dir = os.path.dirname(os.path.abspath(__file__))
            sumatra_files = glob.glob(os.path.join(base_dir, "SumatraPDF*.exe"))
            if sumatra_files:
                sumatra_path = sumatra_files[0]
                print(f"  [🖨️] שולח למדפסת (שחור-לבן): {os.path.basename(abs_path)}")
                subprocess.run([sumatra_path, "-print-to-default", "-print-settings", "1x,monochrome", "-silent", abs_path], check=True)
                time.sleep(2)
        except Exception as e: print(f"  [!] שגיאה בהדפסה: {e}")

    def send_email_to_agent(self, service, to_email: str, agent_name: str, project_name: str, invoice_path: str):
        try:
            message = MIMEMultipart()
            message['to'] = to_email
            message['subject'] = f"חשבונית חדשה התקבלה - פרויקט: {project_name}"
            body = f"היי {agent_name},\n\nמצ\"ב חשבונית חדשה שהתקבלה עבור הפרויקט: {project_name}.\n\nבברכה,\nמערכת אוטומטית פרסיק 🐾"
            message.attach(MIMEText(body, 'plain', 'utf-8'))
            with open(invoice_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                filename = os.path.basename(invoice_path)
                part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                message.attach(part)
            raw_msg = base64.urlsafe_b64encode(message.as_bytes()).decode()
            service.users().messages().send(userId='me', body={'raw': raw_msg}).execute()
            print(f"  [✉️] נשלח אימייל לסוכן {agent_name} ({to_email})")
        except Exception as e: print(f"  [!] שגיאה בשליחת אימייל לסוכן: {e}")

    def authenticate(self):
        setup_safe_logging(); creds = None
        token_path = "credentials/token.json"
        client_secret_path = "credentials/client_secret.json"
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    with open(token_path, "w", encoding="utf-8") as token:
                        token.write(creds.to_json())
                except Exception as e:
                    if os.getenv("PERSIK_SERVER"):
                        raise RuntimeError(
                            "Google token expired and cannot refresh on server. "
                            "Update GOOGLE_TOKEN_JSON secret."
                        ) from e
                    flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
                    creds = flow.run_local_server(port=0)
            else:
                if os.getenv("PERSIK_SERVER"):
                    raise RuntimeError(
                        "Missing Google OAuth token on server. Set GOOGLE_TOKEN_JSON and GOOGLE_CLIENT_SECRET_JSON."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(token_path, "w", encoding="utf-8") as token:
                token.write(creds.to_json())
        service = build("gmail", "v1", credentials=creds)
        try: profile = service.users().getProfile(userId='me').execute(); self.current_user_email = profile.get('emailAddress')
        except: self.current_user_email = "0"
        return service

    def find_html_part(self, payload):
        if payload.get("mimeType") == "text/html" and "data" in payload.get("body", {}): return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8")
        if "parts" in payload:
            for part in payload["parts"]:
                res = self.find_html_part(part)
                if res: return res
        return None

    def extract_link_from_body(self, payload):
        try:
            body = self.find_html_part(payload)
            if not body: return None
            links = re.findall(r'href=[\'"]?([^\'" >]+)', body)
            for link in links:
                if any(x in link for x in ["rivhit.co.il", "get_document", "ViewInvoice", "riv.life", "Download", "tamal", "accountbook"]): return link
            return None
        except: return None

    def run(self):
        print("\n" + "="*60 + "\n 🚀 פרסיק מנהל חשבונות - גרסה 423.0 (הגרסה הסופית והמלאה)\n" + "="*60)
        service = self.authenticate(); self.matcher.refresh_cache()
        
        email_map = {}
        if os.path.exists("data/suppliers.json"):
            with open("data/suppliers.json", "r", encoding="utf-8") as f:
                rules = json.load(f)
                for k, v in rules.items():
                    emails = v.get("emails", [])
                    if isinstance(emails, str): emails = [e.strip() for e in emails.split(",")]
                    for em in emails:
                        if em: email_map[clean_string_strictly(em)] = v
                            
        agents_map = {}
        if os.path.exists(self.agents_file):
            with open(self.agents_file, "r", encoding="utf-8") as f:
                try: agents_map = json.load(f)
                except: pass
        
        print(f"  [מידע] ספקים במעקב: {len(email_map)} | סוכנים מוגדרים: {len(agents_map)}")

        added_count, dup_count = 0, 0
        results = service.users().messages().list(userId="me", q="is:unread in:inbox category:primary").execute()
        printed_files = set()

        for m in results.get("messages", []):
            try:
                email_has_errors = False
                
                msg = service.users().messages().get(userId="me", id=m["id"]).execute()
                sender_raw = next(h["value"] for h in msg["payload"]["headers"] if h["name"].lower() == "from")
                sender_email = parseaddr(sender_raw)[1]
                sender = clean_string_strictly(sender_email)
                
                print(f"  [בדיקה] מנתח אימייל חדש מאת: {sender}")
                supplier = email_map.get(sender)
                if not supplier: continue
                
                print(f"  [!] ספק זוהה: {supplier['name']}")
                
                # Используем authuser, чтобы Google сам нашел нужный ящик, даже если их открыто 3 штуки!
                # Так как мы убрали формулу HYPERLINK, эта ссылка больше не вызовет блокировку 404.
                gmail_link = f"https://mail.google.com/mail/?authuser={self.current_user_email}#all/{m['id']}"
                files_to_process = []
                
                def find_pdfs(p):
                    res = []
                    if p.get("filename", "").lower().endswith(".pdf"): res.append(p)
                    if "parts" in p: 
                        for sub in p["parts"]: res.extend(find_pdfs(sub))
                    return res
                
                attachments = find_pdfs(msg["payload"])
                for att_part in attachments:
                    att_data = service.users().messages().attachments().get(userId="me", messageId=m["id"], id=att_part["body"]["attachmentId"]).execute()
                    path = os.path.join(self.download_dir, att_part['filename'])
                    with open(path, "wb") as f: f.write(base64.urlsafe_b64decode(att_data["data"]))
                    files_to_process.append(path)
                
                if not files_to_process:
                    link = self.extract_link_from_body(msg["payload"])
                    if link:
                        print(f"  [*] מעבר לקישור מתוך האימייל...")
                        session = requests.Session()
                        session.headers.update({'User-Agent': 'Mozilla/5.0'})
                        res = session.get(link, timeout=30)
                        
                        if res.status_code == 200:
                            content = res.content
                            if b'<html' in content[:2000].lower() or b'<!doctype' in content[:2000].lower():
                                html_text = content.decode('utf-8', errors='ignore')
                                match = re.search(r"DisplayHand\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)", html_text)
                                if match:
                                    doc_type, doc_num, enc_string = match.groups()
                                    viewer_url = urljoin(link, f"../Docs/DocDisplay{doc_type}.aspx?dn={doc_num}&p1={enc_string}")
                                    res2 = session.get(viewer_url, timeout=30)
                                    if res2.status_code == 200:
                                        content2 = res2.content
                                        ext = ".pdf" if b'%PDF-' in content2[:1024] else ".html"
                                        path = os.path.join(self.download_dir, f"invoice_{int(time.time())}{ext}")
                                        with open(path, "wb") as f: f.write(content2)
                                        files_to_process.append(path)
                                else:
                                    pdf_link = None
                                    match = re.search(r'<iframe[^>]*src=[\'"]([^\'"]+)[\'"]', html_text, re.IGNORECASE)
                                    if match: pdf_link = match.group(1)
                                    if not pdf_link:
                                        for pattern in [r'href=[\'"]([^\'"]*(?:download|export|pdf|getfile)[^\'"]*)[\'"]', r'[\'"]([^\'"]+\.pdf)[\'"]']:
                                            match = re.search(pattern, html_text, re.IGNORECASE)
                                            if match:
                                                pdf_link = match.group(1)
                                                break
                                    if pdf_link:
                                        res2 = session.get(urljoin(link, pdf_link).replace('&amp;', '&'), timeout=30)
                                        if res2.status_code == 200:
                                            content2 = res2.content
                                            ext = ".pdf" if b'%PDF-' in content2[:1024] else ".html"
                                            path = os.path.join(self.download_dir, f"invoice_{int(time.time())}{ext}")
                                            with open(path, "wb") as f: f.write(content2)
                                            files_to_process.append(path)
                            else:
                                path = os.path.join(self.download_dir, f"invoice_{int(time.time())}.pdf")
                                with open(path, "wb") as f: f.write(content)
                                files_to_process.append(path)

                if not files_to_process:
                    print("  [!] לא נמצאו קבצים או קישורים לחשבוניות באימייל.")
                    email_has_errors = True

                for path in files_to_process:
                    print(f"  [+] סורק קובץ: {os.path.basename(path)}")
                    
                    if "אלום" in supplier['name'] or "alum" in supplier['name'].lower():
                        extracted_items = self.parser.extract_alum_land_data(path, supplier, os.path.basename(path))
                    else:
                        single_data = self.parser.extract_data(path, supplier, os.path.basename(path))
                        extracted_items = [single_data] if single_data else []

                    if not extracted_items: 
                        print(f"  [!] לא זוהו נתונים תקינים או הייתה שגיאה בקובץ: {os.path.basename(path)}")
                        email_has_errors = True
                        continue
                        
                    any_manual = False
                    for data in extracted_items:
                        data["gmail_link"] = gmail_link  
                        if data.get("deal_id"): self.matcher.upload_file(data["deal_id"], path)
                        
                        status = self.sheets.append_invoice(data)
                        if status == "SUCCESS": 
                            print(f"  [תקין] נרשם בטבלה: {data['project']} | {data['decision_label']}")
                            added_count += 1
                            
                            if AUTO_PRINT_INVOICES and path not in printed_files:
                                self.print_document(path)
                                printed_files.add(path)
                                
                            if data.get("deal_id"):
                                agent_name_raw = self.matcher.get_agent_for_deal(data["deal_id"])
                                if agent_name_raw:
                                    target_email = None
                                    clean_agent_name = agent_name_raw
                                    
                                    for a_name, a_email in agents_map.items():
                                        if a_name in agent_name_raw: 
                                            target_email = a_email
                                            clean_agent_name = a_name
                                            break
                                    
                                    if target_email and "@" in target_email:
                                        self.send_email_to_agent(service, target_email, clean_agent_name, data["project"], path)
                                    else:
                                        print(f"  [✉️] הסוכן '{agent_name_raw}' נמצא ב-CRM, אך לא מוגדר לו אימייל.")
                        elif status == "DUPLICATE": 
                            dup_count += 1
                        else:
                            email_has_errors = True
                            
                        if "MANUAL" in data.get("decision_label", ""): any_manual = True

                    folder = self.manual_dir if any_manual else self.processed_dir
                    dest = os.path.join(folder, self.sanitize_folder_name(supplier["name"]))
                    os.makedirs(dest, exist_ok=True)
                    shutil.move(path, os.path.join(dest, os.path.basename(path)))
                
                if not email_has_errors:
                    service.users().messages().modify(userId="me", id=m["id"], body={"removeLabelIds": ["UNREAD"]}).execute()
                    print("  [✅] האימייל עובד במלואו וסומן כנקרא.")
                else:
                    print("  [⚠️] התגלו בעיות. האימייל נשאר כ'לא נקרא' (UNREAD) להמשך טיפול ידני.")
                    
            except Exception as e: 
                print(f"  [!] {e} :שגיאה כללית")

        print(f"\n--- סיכום פעולה ---")
        print(f" ✅ נרשמו חשבוניות חדשות: {added_count}")
        print(f" 🔁 דולגו (כפילויות): {dup_count}")
        print(f"-------------------")

if __name__ == "__main__":
    GmailAgent().run()