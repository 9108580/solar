# הצעות מחיר

מחשבון והצעות מחיר למערכות סולאריות (React + Supabase + Vercel).

**תיקייה:** `הצעות מחיר` (לשעבר `solar-final`)  
**אתר:** [mes.bet](https://www.mes.bet/)

## התחלה

```bash
cp .env.example .env.local
# מלאו REACT_APP_SUPABASE_URL ו-REACT_APP_SUPABASE_ANON_KEY

npm install
npm run db:apply:all    # פעם אחת — סכימה, Storage לדאטהשיטים, ניקוי טריגרים
npm start
```

## Supabase

| קובץ | תפקיד |
|------|--------|
| `supabase/schema.sql` | טבלת `admin_settings` |
| `supabase/shared_quotes.sql` | קישורי הצעה `/q/:id` |
| `supabase/admin_assets_storage.sql` | bucket `admin-assets` לקבצים גדולים |
| `supabase/remove_admin_settings_history.sql` | הסרת טריגר היסטוריה (מונע timeout) |

```bash
npm run db:apply:all
```

## פריסה (Vercel)

```bash
npm run build
npx vercel --prod
```

משתני סביבה ב-Vercel: כמו ב-`.env.example`.
