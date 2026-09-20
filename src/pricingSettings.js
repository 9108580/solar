import { canonicalSystemType, requiresCommercialSystem } from './systemTypeRule';

export const REQUIRED_PRICING_SETTINGS = [
  'usdExchangeRate',
  'constructionConcretePerKw',
  'constructionOtherPerKw',
  'logisticsCost',
  'logisticsCostCommercial',
  'laborPerKwResidential',
  'laborPerKwCommercial',
  'hybridBatteryInstallCost',
  'planningCost',
  'constructorEngineer',
  'privateCheckResidential',
  'privateCheckCommercial',
  'electricianResidential',
  'electricianCommercial',
  'acCableOnGridResidential',
  'acCableHybridResidential',
  'acCableCommercial',
  'antennaCost',
  'communicationLine',
  'electricalBoxResidential',
  'electricalBoxCommercialPerKw',
  'washingSystemBase',
  'feesCost',
  'profitResidentialFixed',
  'profitCommercialPerKw',
  'vatRate',
  'productionHours',
  'primeRate',
  'loanMargin',
  'productionMeterSurcharge',
  'urbanPremiumAgorotPerKwh',
  'urbanPremiumValidUntilYear',
];

function rawSetting(settings, key) {
  if (!settings || !Object.prototype.hasOwnProperty.call(settings, key)) {
    throw new Error(`Missing numeric admin setting: ${key}`);
  }
  const value = settings[key];
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`Missing numeric admin setting: ${key}`);
  }
  return value;
}

export function requiredNumberSetting(settings, key, { allowNegative = false } = {}) {
  const value = Number(rawSetting(settings, key));
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric admin setting: ${key}`);
  if (!allowNegative && value < 0) throw new Error(`Negative admin setting is not allowed: ${key}`);
  return value;
}

export function requiredNestedNumberSetting(settings, objectKey, key, options) {
  const object = settings?.[objectKey];
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw new Error(`Missing admin settings object: ${objectKey}`);
  }
  return requiredNumberSetting(object, key, options);
}

export function requiredProductNumber(product, key, productLabel = 'product') {
  if (!product || typeof product !== 'object') throw new Error(`Missing selected ${productLabel}`);
  try {
    return requiredNumberSetting(product, key);
  } catch (error) {
    throw new Error(`${productLabel} ${product.id || product.name || '(unknown)'}: ${error.message}`);
  }
}

export function validateTariffBands(tariffBands) {
  if (!Array.isArray(tariffBands) || tariffBands.length === 0) {
    throw new Error('Missing admin setting: tariffBands');
  }
  const normalized = tariffBands.map((band, index) => {
    const upToKw = band?.upToKw === null
      ? null
      : requiredNumberSetting(band, 'upToKw');
    const agorotPerKwh = requiredNumberSetting(band, 'agorotPerKwh');
    return { upToKw, agorotPerKwh, index };
  });
  for (let index = 0; index < normalized.length; index += 1) {
    const band = normalized[index];
    if (band.upToKw === null && index !== normalized.length - 1) {
      throw new Error('Only the final tariff band may be unbounded');
    }
    if (index > 0) {
      const previous = normalized[index - 1].upToKw;
      if (previous === null || (band.upToKw !== null && band.upToKw <= previous)) {
        throw new Error('Tariff band limits must be strictly increasing');
      }
    }
  }
  return normalized.map(({ index, ...band }) => band);
}

export function calculateTariffFromSettings(acKw, settings) {
  const size = Number(acKw);
  if (!Number.isFinite(size) || size <= 0) throw new Error('AC power must be a positive number');
  const bands = validateTariffBands(settings?.tariffBands);
  let lowerBound = 0;
  let totalAgorot = 0;
  let remaining = size;
  for (const band of bands) {
    const width = band.upToKw === null ? remaining : Math.max(0, band.upToKw - lowerBound);
    const applied = Math.min(remaining, width);
    totalAgorot += applied * band.agorotPerKwh;
    remaining -= applied;
    if (remaining <= 0) break;
    if (band.upToKw !== null) lowerBound = band.upToKw;
  }
  if (remaining > 0) throw new Error('Tariff bands do not cover the requested AC power');
  return (totalAgorot / size) / 100;
}

export function validatePricingSettings(settings) {
  REQUIRED_PRICING_SETTINGS.forEach((key) => requiredNumberSetting(settings, key));
  ['se1to1', 'se1to2', 'tigo', 'sungrow'].forEach((key) =>
    requiredNestedNumberSetting(settings, 'optimizerPrices', key)
  );
  validateTariffBands(settings?.tariffBands);
  if (!Array.isArray(settings?.panels) || settings.panels.length === 0) throw new Error('Missing panels catalog');
  if (!Array.isArray(settings?.inverters) || settings.inverters.length === 0) throw new Error('Missing inverters catalog');
  settings.panels.forEach((panel) => {
    if (requiredProductNumber(panel, 'powerWatts', 'panel') <= 0) {
      throw new Error(`panel ${panel.id || panel.name || '(unknown)'}: powerWatts must be positive`);
    }
    requiredProductNumber(panel, 'pricePerWattUsd', 'panel');
  });
  settings.inverters.forEach((product) => requiredProductNumber(product, 'cost', 'inverter'));
  (settings.invertersHybrid || []).forEach((product) => requiredProductNumber(product, 'cost', 'hybrid inverter'));
  (settings.batteries || []).forEach((product) => requiredProductNumber(product, 'cost', 'battery'));
  return true;
}

export function assertPricingReady(phase, settings) {
  if (phase !== 'ready') throw new Error('Pricing settings are not confirmed by the server');
  return validatePricingSettings(settings);
}

export function getEffectiveTariffForCalendarYear(baseTariff, eligible, calendarYear, settings) {
  const premium = requiredNumberSetting(settings, 'urbanPremiumAgorotPerKwh');
  const validUntil = requiredNumberSetting(settings, 'urbanPremiumValidUntilYear');
  return Number(baseTariff) + (eligible && calendarYear <= validUntil ? premium / 100 : 0);
}

export function buildPricingSnapshot(settings) {
  validatePricingSettings(settings);
  const snapshot = {};
  REQUIRED_PRICING_SETTINGS.forEach((key) => { snapshot[key] = requiredNumberSetting(settings, key); });
  snapshot.optimizerPrices = Object.fromEntries(
    ['se1to1', 'se1to2', 'tigo', 'sungrow'].map((key) => [key, requiredNestedNumberSetting(settings, 'optimizerPrices', key)])
  );
  snapshot.tariffBands = validateTariffBands(settings.tariffBands);
  return snapshot;
}

const closeEnough = (left, right) => Math.abs(Number(left) - Number(right)) <= 0.01;

export function validateQuoteForSave(quote, settings, expectedBreakdown = null) {
  if (!quote || typeof quote !== 'object') throw new Error('Missing quote payload');
  const dcKw = Number(quote.systemSizeKw);
  if (!Number.isFinite(dcKw) || dcKw <= 0) throw new Error('Quote has invalid DC power');
  const type = canonicalSystemType(quote.systemType);
  if (!['residential', 'commercial'].includes(type)) throw new Error('Quote has invalid system type');
  if (requiresCommercialSystem(dcKw) && type !== 'commercial') throw new Error('Quote system type conflicts with DC power');

  if (Array.isArray(quote.panelDetailsList) && quote.panelDetailsList.length > 0) {
    const watts = quote.panelDetailsList.reduce((sum, panel) =>
      sum + requiredProductNumber(panel, 'powerWatts', 'quote panel') * requiredProductNumber(panel, 'quantity', 'quote panel'), 0);
    if (!closeEnough(watts / 1000, dcKw)) throw new Error('Quote DC power conflicts with selected panels');
  }

  const breakdown = quote.breakdown;
  if (!breakdown || typeof breakdown !== 'object') throw new Error('Quote has no pricing breakdown');
  const componentKeys = ['panels', 'construction', 'inverter', 'batteries', 'optimizers', 'logistics', 'labor', 'engineering', 'electricianAndChecks', 'electricalBoxes', 'accessories', 'washing', 'fees', 'productionMeter'];
  if (breakdown.storageElectricalBoards !== undefined || expectedBreakdown?.storageElectricalBoards > 0) {
    componentKeys.push('storageElectricalBoards');
  }
  const calculatedTotal = componentKeys.reduce((sum, key) => sum + requiredNumberSetting(breakdown, key), 0);
  if (!closeEnough(calculatedTotal, requiredNumberSetting(breakdown, 'totalCost'))) throw new Error('Quote total cost is inconsistent');
  if (!closeEnough(calculatedTotal + requiredNumberSetting(breakdown, 'marginValue'), requiredNumberSetting(breakdown, 'finalPrice'))) {
    throw new Error('Quote final price is inconsistent');
  }
  const expectedLaborRate = requiredNumberSetting(settings, type === 'commercial' ? 'laborPerKwCommercial' : 'laborPerKwResidential');
  let expectedLabor = dcKw * expectedLaborRate;
  if (quote.hasBatteries) expectedLabor += requiredNumberSetting(settings, 'hybridBatteryInstallCost');
  const expectedMargin = type === 'commercial'
    ? dcKw * requiredNumberSetting(settings, 'profitCommercialPerKw')
    : requiredNumberSetting(settings, 'profitResidentialFixed');
  if (!closeEnough(expectedLabor, breakdown.labor)) throw new Error('Quote labor conflicts with current settings');
  if (!closeEnough(expectedMargin, breakdown.marginValue)) throw new Error('Quote margin conflicts with current settings');
  if (quote.pricingSnapshot) {
    const currentSnapshot = buildPricingSnapshot(settings);
    if (JSON.stringify(quote.pricingSnapshot) !== JSON.stringify(currentSnapshot)) {
      throw new Error('Quote pricing snapshot is stale');
    }
  }
  if (expectedBreakdown) {
    [...componentKeys, 'totalCost', 'marginValue', 'finalPrice'].forEach((key) => {
      if (!closeEnough(requiredNumberSetting(expectedBreakdown, key), requiredNumberSetting(breakdown, key))) {
        throw new Error(`Quote breakdown conflicts with canonical calculation: ${key}`);
      }
    });
  }
  return true;
}
