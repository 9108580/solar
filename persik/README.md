# Persik — מנהל חשבונות (פרסיק)

מערכת Python לעיבוד חשבוניות מ-Gmail, Google Sheets ו-Pipedrive.

## הרצה מקומית (מחשב)

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# מלאו מפתחות ב-.env
python victoria_gui.py
```

## הרצה כשרת (בדיקה מקומית)

```bash
python persik_server.py
# http://localhost:8080
```

## פריסה לענן (Render)

1. דחיפה ל-GitHub: `9108580/persik`
2. Render → New → Blueprint → חברו את ה-repo
3. הוסיפו Secrets:
   - `GEMINI_API_KEY`
   - `PIPEDRIVE_TOKEN`
   - `GOOGLE_TOKEN_JSON` — תוכן `credentials/token.json`
   - `GOOGLE_CLIENT_SECRET_JSON` — תוכן `credentials/client_secret.json`
   - `PERSIK_AUTH_USER` / `PERSIK_AUTH_PASSWORD`
4. Custom domain: `persik.mes.bet` (CNAME → Render)

## mes.bet

בפרויקט solar (`vercel.json`) יש rewrite ל-`/persik` → שירות Persik בענן.
