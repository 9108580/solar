import {
  cityMatchSimilarity,
  normalizeCityForMatch,
  resolveUrbanPremiumFromCity,
  URBAN_PREMIUM_MATCH_THRESHOLD,
  DEFAULT_URBAN_PREMIUM_CITIES,
} from './urbanPremiumCities';

describe('normalizeCityForMatch', () => {
  it('מאחד מקפים ורווחים', () => {
    expect(normalizeCityForMatch('תל אביב – יפו')).toBe('תלאביביפו');
    expect(normalizeCityForMatch('תל־אביב–יפו')).toBe('תלאביביפו');
  });
});

describe('resolveUrbanPremiumFromCity', () => {
  const list = DEFAULT_URBAN_PREMIUM_CITIES;

  it('התאמה מדויקת', () => {
    const r = resolveUrbanPremiumFromCity('חיפה', list);
    expect(r.eligible).toBe(true);
    expect(r.matchedCity).toBe('חיפה');
    expect(r.score).toBeGreaterThanOrEqual(URBAN_PREMIUM_MATCH_THRESHOLD);
  });

  it('התאמה עם טעות כתיב קלה (≥80%)', () => {
    const r = resolveUrbanPremiumFromCity('ירושלם', list);
    expect(r.eligible).toBe(true);
    expect(r.matchedCity).toBe('ירושלים');
  });

  it('התאמה עם איות חלופי (קרית/קריית)', () => {
    const r = resolveUrbanPremiumFromCity('קרית גת', list);
    expect(r.eligible).toBe(true);
    expect(r.matchedCity).toBe('קריית גת');
  });

  it('ללא התאמה מתחת לסף', () => {
    const r = resolveUrbanPremiumFromCity('קיבוץ גלויות', list);
    expect(r.eligible).toBe(false);
    expect(r.matchedCity).toBeNull();
  });

  it('ריק — ללא זכאות', () => {
    expect(resolveUrbanPremiumFromCity('', list).eligible).toBe(false);
  });
});

describe('cityMatchSimilarity', () => {
  it('שמות זהים אחרי נרמול', () => {
    expect(cityMatchSimilarity('פתח תקווה', 'פתח תקווה')).toBe(1);
  });
});
