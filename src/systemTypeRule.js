export const COMMERCIAL_DC_THRESHOLD_KW = 35;

const COMMERCIAL_SYSTEM_TYPES = new Set([
  'commercial',
  'מערכת מסחרית',
  'מסחרית',
]);

const RESIDENTIAL_SYSTEM_TYPES = new Set([
  'residential',
  'home',
  'domestic',
  'bt',
  'ביתית',
  'מערכת ביתית',
]);

export function canonicalSystemType(systemType) {
  const normalized = String(systemType ?? '').trim().toLowerCase();
  if (COMMERCIAL_SYSTEM_TYPES.has(normalized)) return 'commercial';
  if (RESIDENTIAL_SYSTEM_TYPES.has(normalized)) return 'residential';
  return normalized;
}

export function requiresCommercialSystem(dcKw) {
  const value = Number(dcKw);
  return Number.isFinite(value) && value >= COMMERCIAL_DC_THRESHOLD_KW;
}

/** The single application-level business rule for mandatory classification. */
export function enforceSystemTypeForDc(system, dcKw = system?.systemSizeKw) {
  if (!system) return system;
  const canonicalType = canonicalSystemType(system.systemType);
  const requiredType = requiresCommercialSystem(dcKw) ? 'commercial' : canonicalType;
  return system.systemType === requiredType ? system : { ...system, systemType: requiredType };
}
