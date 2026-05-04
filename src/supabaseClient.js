import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

/** null אם חסרים משתני סביבה — האפליקציה נופלת חזרה ל-localStorage בלבד */
export function getSupabase() {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}
