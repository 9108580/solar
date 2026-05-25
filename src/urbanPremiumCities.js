/** סף התאמה לפרמיה אורבנית — 80% דמיון (מרחק עריכה מנורמל) */
export const URBAN_PREMIUM_MATCH_THRESHOLD = 0.8;

/** גיבוי מקומי אם Supabase לא זמין */
export const DEFAULT_URBAN_PREMIUM_CITIES = [
  'אום אל־פחם',
  'אופקים',
  'אור יהודה',
  'אילת',
  'אלעד',
  'אשדוד',
  'אשקלון',
  'באקה אל־גרבייה',
  'באר יעקב',
  'באר שבע',
  'בית שמש',
  'בני ברק',
  'בת ים',
  'גבעתיים',
  'דאליית אל־כרמל',
  'דימונה',
  'הוד השרון',
  'הרצליה',
  'חדרה',
  'חולון',
  'חיפה',
  'טבריה',
  'טייבה',
  'טירת כרמל',
  'טמרה',
  'יבנה',
  'יהוד–מונוסון',
  'ירושלים',
  'כפר יונה',
  'כפר סבא',
  'כרמיאל',
  'לוד',
  'מודיעין–מכבים–רעות',
  'נהריה',
  'נוף הגליל',
  'נס ציונה',
  'נצרת',
  'נשר',
  'נתיבות',
  'נתניה',
  'סח׳נין',
  'עכו',
  'עפולה',
  'ערערה — צפון',
  'פרדס־חנה–כרכור',
  'פתח תקווה',
  'צפת',
  'קריית אונו',
  'קריית אתא',
  'קריית ביאליק',
  'קריית גת',
  'קריית ים',
  'קריית מוצקין',
  'קריית מלאכי',
  'קריית שמונה',
  'ראש העין',
  'ראשון לציון',
  'רהט',
  'רחובות',
  'רכסים',
  'רמלה',
  'רמת גן',
  'רמת השרון',
  'רעננה',
  'שגב–שלום',
  'שדרות',
  'שפרעם',
  'תל־אביב–יפו',
];

/** מנרמל שם יישוב להשוואה — מתעלם מרווחים, מקפים וגרש */
export function normalizeCityForMatch(value) {
  return String(value || '')
    .trim()
    .replace(/[''`׳"]/g, '')
    .replace(/[\u05BE\u2010-\u2015\u2212\uFF0D–—\s-]+/g, '');
}

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) row[j] = j;

  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[n];
}

/** דמיון 0–1 בין שני שמות יישוב (1 = זהה) */
export function cityMatchSimilarity(inputCity, referenceCity) {
  const a = normalizeCityForMatch(inputCity);
  const b = normalizeCityForMatch(referenceCity);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

/**
 * בודק אם יישוב הלקוח זכאי לפרמיה אורבנית.
 * @returns {{ eligible: boolean, matchedCity: string|null, score: number }}
 */
export function resolveUrbanPremiumFromCity(inputCity, cityList, threshold = URBAN_PREMIUM_MATCH_THRESHOLD) {
  const input = normalizeCityForMatch(inputCity);
  if (!input) {
    return { eligible: false, matchedCity: null, score: 0 };
  }

  const list = Array.isArray(cityList) && cityList.length > 0 ? cityList : DEFAULT_URBAN_PREMIUM_CITIES;
  let bestScore = 0;
  let bestCity = null;

  for (const city of list) {
    const name = typeof city === 'string' ? city : city?.name_he;
    if (!name) continue;
    const score = cityMatchSimilarity(input, name);
    if (score > bestScore) {
      bestScore = score;
      bestCity = name;
    }
  }

  const eligible = bestScore >= threshold;
  return {
    eligible,
    matchedCity: eligible ? bestCity : null,
    score: bestScore,
  };
}
