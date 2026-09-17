export const COMMERCIAL_DC_THRESHOLD_KW = 35;

export function requiresCommercialSystem(dcKw) {
  const value = Number(dcKw);
  return Number.isFinite(value) && value >= COMMERCIAL_DC_THRESHOLD_KW;
}

/** The single application-level business rule for mandatory classification. */
export function enforceSystemTypeForDc(system, dcKw = system?.systemSizeKw) {
  if (!system || !requiresCommercialSystem(dcKw) || system.systemType === 'commercial') {
    return system;
  }
  return { ...system, systemType: 'commercial' };
}
