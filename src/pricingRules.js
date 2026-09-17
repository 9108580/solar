import { enforceSystemTypeForDc } from './systemTypeRule';

function requiredNumericSetting(settings, key) {
  const value = Number(settings?.[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`Missing numeric admin setting: ${key}`);
  }
  return value;
}

export function calculateSystemTypePricing(system, dcKw, settings) {
  const normalizedSystem = enforceSystemTypeForDc(system, dcKw);
  const sizeKw = Number(dcKw);
  if (!Number.isFinite(sizeKw) || sizeKw < 0) {
    throw new Error('DC power must be a non-negative number');
  }

  if (normalizedSystem.systemType === 'commercial') {
    const laborRate = requiredNumericSetting(settings, 'laborPerKwCommercial');
    const profitRate = requiredNumericSetting(settings, 'profitCommercialPerKw');
    return {
      systemType: 'commercial',
      laborRate,
      profitRate,
      laborCost: sizeKw * laborRate,
      profitValue: sizeKw * profitRate,
    };
  }

  if (normalizedSystem.systemType === 'residential') {
    const laborRate = requiredNumericSetting(settings, 'laborPerKwResidential');
    const profitValue = requiredNumericSetting(settings, 'profitResidentialFixed');
    return {
      systemType: 'residential',
      laborRate,
      profitRate: null,
      laborCost: sizeKw * laborRate,
      profitValue,
    };
  }

  throw new Error(`Unknown system type: ${normalizedSystem.systemType || '(empty)'}`);
}
