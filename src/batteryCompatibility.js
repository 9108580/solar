import { availableProducts } from './productAvailability';

// Match a brand token anywhere in the product name, including Hebrew catalog names.
const BRAND_NAMES = [
  ['solis', /\bsolis(?=\b|\d)|סוליס/i],
  ['growatt', /\bgrowa?tt(?=\b|\d)|גרואט|גרוואט|גרווט/i],
  ['solaredge', /\bsolar\s*edge\b|סולאראדג|סולאר\s*אדג/i],
  ['sungrow', /\bsungrow\b|סנגרואו|סאנגרו|סנגרו/i],
  ['deye', /\bdeye\b|דייה|דאיה/i],
  ['saj', /\bsaj\b/i],
  ['huawei', /\bhuawei\b|וואווי/i],
  ['goodwe', /\bgoodwe\b/i],
  ['sofar', /\bsofar\b/i],
  ['foxess', /\bfox\s*ess\b/i],
  ['byd', /\bbyd\b/i],
];

export function productBrandFromName(name) {
  const matches = BRAND_NAMES.filter(([, pattern]) => pattern.test(String(name || '')));
  return matches.length === 1 ? matches[0][0] : null;
}

export function compatibleBatteries(form, settings) {
  if (form?.inverterSystemType !== 'hybrid') return [];
  const catalog = availableProducts(settings?.invertersHybrid);
  const brands = new Set((form.selectedHybridInverters || [])
    .filter((row) => Number(row.quantity) > 0)
    .map((row) => productBrandFromName(catalog.find((item) => item.id === row.id)?.name))
    .filter(Boolean));
  return availableProducts(settings?.batteries)
    .filter((battery) => brands.has(productBrandFromName(battery.name)));
}

export function assertBatteryCompatibility(form, settings) {
  if (form?.inverterSystemType !== 'hybrid' || !form.includesBatteries) return;
  const allowed = new Set(compatibleBatteries(form, settings).map((item) => item.id));
  if ((form.selectedBatteries || []).some((row) => !allowed.has(row.id))) {
    const error = new Error('יש לבחור סוללות במלאי מאותו מותג של הממיר ההיברידי שנבחר.');
    error.code = 'INCOMPATIBLE_BATTERY';
    throw error;
  }
}
