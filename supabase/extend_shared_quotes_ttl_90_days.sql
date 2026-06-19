-- =============================================================================
-- הרחבת תוקף קישורי הצעה קיימים ל-90 יום מ-created_at (רטרואקטיבי)
-- =============================================================================
-- הריצו אחרי shared_quotes.sql (או דרך npm run db:apply:all).
-- Idempotent — בטוח להריץ שוב; מעדכן רק שורות שתוקפן קצר מ-90 יום מיצירה.
-- =============================================================================

UPDATE public.shared_quotes
SET expires_at = created_at + interval '90 days'
WHERE expires_at IS NOT NULL
  AND expires_at < created_at + interval '90 days';

-- בדיקה (אופציונלי): כמה קישורים פעילים וכמה עדיין בתוקף
SELECT
  count(*) AS active_links,
  count(*) FILTER (WHERE expires_at > now()) AS still_valid,
  count(*) FILTER (WHERE expires_at <= now()) AS expired_but_kept
FROM public.shared_quotes;
