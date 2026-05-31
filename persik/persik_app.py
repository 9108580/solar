"""Shared Persik UI + Eel API (desktop and server)."""
import datetime
import importlib
import json
import os
import sys
import threading
import time

import eel

script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)
web_dir = os.path.join(script_dir, "web")

try:
    import gmail_agent

    CORE_LOADED = True
except ImportError:
    CORE_LOADED = False

is_running = False
auto_run_enabled = False
last_auto_run_date = None
data_path = os.path.join("data", "suppliers.json")

eel.init(web_dir)

_real_stdout = sys.__stdout__
_eel_logging_enabled = False


def enable_eel_logging():
    global _eel_logging_enabled
    _eel_logging_enabled = True


class StreamToLogger:
    def write(self, buf):
        _real_stdout.write(buf)
        if not _eel_logging_enabled:
            return
        for line in buf.rstrip().splitlines():
            if not line.strip():
                continue
            safe_msg = line.strip().replace("'", "\\'").replace('"', '\\"').replace("\n", " ")
            try:
                eel.addLog(safe_msg)()
            except Exception:
                pass

    def flush(self):
        _real_stdout.flush()


def install_log_redirect():
    sys.stdout = StreamToLogger()


def schedule_eel_logging(delay_seconds=2):
    def _enable():
        time.sleep(delay_seconds)
        enable_eel_logging()

    threading.Thread(target=_enable, daemon=True).start()


def _run_agent_thread():
    global is_running
    try:
        if CORE_LOADED:
            importlib.reload(gmail_agent)
            agent = gmail_agent.GmailAgent()
            agent.run()
        else:
            print("❌ שגיאה קריטית: הקובץ gmail_agent.py לא נמצא בתיקייה!")
    except Exception as e:
        print(f"❌ שגיאה קריטית: {e}")
    finally:
        is_running = False
        try:
            eel.agentFinished()()
        except Exception:
            pass


@eel.expose
def run_agent():
    global is_running
    if is_running:
        return
    is_running = True
    print("=============================")
    threading.Thread(target=_run_agent_thread, daemon=True).start()


@eel.expose
def toggle_auto_run():
    global auto_run_enabled
    auto_run_enabled = not auto_run_enabled
    if auto_run_enabled:
        print("✅ מצב הפעלה אוטומטית הופעל. המערכת תרוץ בימים א'-ה' בשעה 09:00.")
    else:
        print("🛑 מצב הפעלה אוטומטית כובה.")
    return auto_run_enabled


def auto_run_worker():
    global is_running, last_auto_run_date
    while True:
        if auto_run_enabled and not is_running:
            now = datetime.datetime.now()
            if now.weekday() in [6, 0, 1, 2, 3]:
                if now.hour == 9 and now.minute == 0:
                    current_date = now.strftime("%Y-%m-%d")
                    if last_auto_run_date != current_date:
                        last_auto_run_date = current_date
                        print("⏰ השעה 09:00. מתחיל סריקה אוטומטית...")
                        try:
                            eel.uiSetLoading()()
                        except Exception:
                            pass
                        run_agent()
        time.sleep(30)


def _report_thread(client_name):
    global is_running
    is_running = True
    try:
        sheets = gmail_agent.GoogleSheetsAgent(gmail_agent.SPREADSHEET_ID)
        result = sheets.generate_client_report(client_name)
        print(f"תוצאה: {result}")
    except Exception as e:
        print(f"שגיאה בהפקת הדוח: {e}")
    finally:
        is_running = False
        try:
            eel.agentFinished()()
        except Exception:
            pass


@eel.expose
def generate_report(client_name):
    global is_running
    print("=============================")
    print(f"...מחפש לקוח '{client_name}'")
    threading.Thread(target=_report_thread, args=(client_name,), daemon=True).start()


@eel.expose
def prepare_payment_report():
    if not CORE_LOADED:
        return "❌ שגיאה: הקובץ gmail_agent.py לא נטען."
    try:
        sheets = gmail_agent.GoogleSheetsAgent(gmail_agent.SPREADSHEET_ID)
        return sheets.generate_payment_report()
    except Exception as e:
        return f"שגיאה: {e}"


@eel.expose
def get_suppliers():
    os.makedirs("data", exist_ok=True)
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            try:
                return json.dumps(json.load(f))
            except Exception:
                return "{}"
    return "{}"


@eel.expose
def save_supplier(name, emails_str):
    emails = [e.strip() for e in emails_str.split(",") if e.strip()]
    data = json.loads(get_suppliers())
    data[name] = {"name": name, "emails": emails}
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"✅ עודכן ספק: {name}")
    return get_suppliers()


@eel.expose
def delete_supplier(name):
    data = json.loads(get_suppliers())
    if name in data:
        del data[name]
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"🗑 נמחק ספק: {name}")
    return get_suppliers()


def start_auto_run_worker():
    threading.Thread(target=auto_run_worker, daemon=True).start()
