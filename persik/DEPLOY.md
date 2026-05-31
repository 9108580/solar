# Persik deployment on Render

1. Open [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. Connect repo `9108580/solar` and use `render-persik.yaml`
3. Set secret env vars (Render → persik → Environment):

```bash
node persik/scripts/export-render-secrets.mjs
```

Also add:
- `GEMINI_API_KEY`
- `PIPEDRIVE_TOKEN`

4. After deploy, open **Settings → Custom Domains** → add `persik.mes.bet`
5. In DNS for `mes.bet`, add CNAME: `persik` → your Render hostname

## mes.bet/persik

`vercel.json` already proxies `/persik` → `https://persik.onrender.com`

After Render is live, both work:
- https://persik.mes.bet
- https://www.mes.bet/persik
