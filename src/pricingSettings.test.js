import {
  REQUIRED_PRICING_SETTINGS,
  assertPricingReady,
  buildPricingSnapshot,
  calculateTariffFromSettings,
  getEffectiveTariffForCalendarYear,
  requiredNumberSetting,
  requiredProductNumber,
  validatePricingSettings,
  validateQuoteForSave,
} from './pricingSettings';

const completeSettings = () => ({
  usdExchangeRate: 3.3,
  constructionConcretePerKw: 350,
  constructionOtherPerKw: 200,
  logisticsCost: 3300,
  laborPerKwResidential: 650,
  laborPerKwCommercial: 550,
  hybridBatteryInstallCost: 5700,
  planningCost: 1400,
  constructorEngineer: 500,
  privateCheckResidential: 550,
  privateCheckCommercial: 800,
  electricianResidential: 750,
  electricianCommercial: 2000,
  acCableOnGridResidential: 300,
  acCableHybridResidential: 600,
  acCableCommercial: 3000,
  antennaCost: 180,
  communicationLine: 100,
  electricalBoxResidential: 870,
  electricalBoxCommercialPerKw: 270,
  washingSystemBase: 4500,
  feesCost: 3000,
  profitResidentialFixed: 21000,
  profitCommercialPerKw: 630,
  vatRate: 18,
  productionHours: 1700,
  primeRate: 4,
  loanMargin: 1.5,
  productionMeterSurcharge: 1000,
  urbanPremiumAgorotPerKwh: 6,
  urbanPremiumValidUntilYear: 2042,
  optimizerPrices: { se1to1: 250, se1to2: 350, tigo: 200, sungrow: 220 },
  tariffBands: [
    { upToKw: 15, agorotPerKwh: 48 },
    { upToKw: 100, agorotPerKwh: 37.31 },
    { upToKw: 300, agorotPerKwh: 34.37 },
    { upToKw: null, agorotPerKwh: 28.44 },
  ],
  panels: [{ id: 'panel', powerWatts: 533, pricePerWattUsd: 0.11 }],
  inverters: [{ id: 'inverter', cost: 0 }],
  invertersHybrid: [{ id: 'hybrid', cost: 0 }],
  batteries: [{ id: 'battery', cost: 0 }],
});

describe('required pricing settings', () => {
  test.each(REQUIRED_PRICING_SETTINGS)('%s accepts zero', (key) => {
    const settings = completeSettings();
    settings[key] = 0;
    expect(requiredNumberSetting(settings, key)).toBe(0);
  });

  test.each([undefined, null, '', '   ', 'garbage', Number.NaN])('rejects invalid scalar %p', (value) => {
    expect(() => requiredNumberSetting({ value }, 'value')).toThrow();
  });

  test('every required scalar blocks missing, null, empty and invalid values', () => {
    for (const key of REQUIRED_PRICING_SETTINGS) {
      for (const value of [undefined, null, '', 'garbage', Number.NaN]) {
        const settings = completeSettings();
        if (value === undefined) delete settings[key];
        else settings[key] = value;
        expect(() => validatePricingSettings(settings)).toThrow(key);
      }
    }
  });

  test('all optimizer price settings accept zero and reject missing values', () => {
    for (const key of ['se1to1', 'se1to2', 'tigo', 'sungrow']) {
      const zero = completeSettings();
      zero.optimizerPrices[key] = 0;
      expect(validatePricingSettings(zero)).toBe(true);
      const missing = completeSettings();
      delete missing.optimizerPrices[key];
      expect(() => validatePricingSettings(missing)).toThrow(key);
    }
  });

  test('complete configuration validates and hydration gates calculation', () => {
    expect(validatePricingSettings(completeSettings())).toBe(true);
    expect(() => assertPricingReady('loading', completeSettings())).toThrow('not confirmed');
    expect(() => assertPricingReady('error', completeSettings())).toThrow('not confirmed');
    expect(assertPricingReady('ready', completeSettings())).toBe(true);
  });

  test.each(['usdExchangeRate', 'vatRate', 'logisticsCost'])('%s changes and zero are used verbatim', (key) => {
    const settings = completeSettings();
    for (const value of [settings[key], 4, 0]) {
      settings[key] = value;
      expect(requiredNumberSetting(settings, key)).toBe(value);
    }
    delete settings[key];
    expect(() => validatePricingSettings(settings)).toThrow(key);
  });
});

describe('equipment, tariffs and premium', () => {
  test('product cost zero is valid and a missing cost is blocked', () => {
    expect(requiredProductNumber({ id: 'p', cost: 0 }, 'cost')).toBe(0);
    expect(() => requiredProductNumber({ id: 'p' }, 'cost')).toThrow('cost');
  });

  test('tariff bands are the only tariff source', () => {
    const settings = completeSettings();
    expect(calculateTariffFromSettings(15, settings)).toBeCloseTo(0.48);
    settings.tariffBands = [{ upToKw: null, agorotPerKwh: 0 }];
    expect(calculateTariffFromSettings(53.3, settings)).toBe(0);
  });

  test('urban premium amount and expiration come from settings', () => {
    const settings = completeSettings();
    expect(getEffectiveTariffForCalendarYear(0.4, true, 2042, settings)).toBeCloseTo(0.46);
    settings.urbanPremiumAgorotPerKwh = 0;
    expect(getEffectiveTariffForCalendarYear(0.4, true, 2042, settings)).toBeCloseTo(0.4);
  });

  test('pricing snapshot preserves zero financing rates', () => {
    const settings = completeSettings();
    settings.primeRate = 0;
    settings.loanMargin = 0;
    expect(buildPricingSnapshot(settings)).toMatchObject({ primeRate: 0, loanMargin: 0 });
  });
});

describe('saved quote invariants', () => {
  const quote = () => ({
    systemType: 'commercial',
    systemSizeKw: 35,
    panelDetailsList: [{ id: 'panel', quantity: 70, powerWatts: 500 }],
    hasBatteries: false,
    breakdown: {
      panels: 0, construction: 0, inverter: 0, batteries: 0, optimizers: 0,
      logistics: 0, labor: 19250, engineering: 0, electricianAndChecks: 0,
      electricalBoxes: 0, accessories: 0, washing: 0, fees: 0, productionMeter: 0,
      totalCost: 19250, marginValue: 22050, finalPrice: 41300,
    },
  });

  test('accepts a canonical internally consistent quote', () => {
    expect(validateQuoteForSave(quote(), completeSettings())).toBe(true);
  });

  test('rejects residential type at 35 kW', () => {
    const payload = quote();
    payload.systemType = 'residential';
    expect(() => validateQuoteForSave(payload, completeSettings())).toThrow('system type');
  });

  test('rejects mismatched panel-derived DC, labor, margin and final price', () => {
    for (const mutate of [
      (payload) => { payload.systemSizeKw = 36; },
      (payload) => { payload.breakdown.labor = 1; },
      (payload) => { payload.breakdown.marginValue = 1; },
      (payload) => { payload.breakdown.finalPrice = 1; },
    ]) {
      const payload = quote();
      mutate(payload);
      expect(() => validateQuoteForSave(payload, completeSettings())).toThrow();
    }
  });

  test('rejects a self-consistent payload that differs from the canonical calculation', () => {
    const payload = quote();
    payload.breakdown.construction = 100;
    payload.breakdown.totalCost += 100;
    payload.breakdown.finalPrice += 100;
    expect(() => validateQuoteForSave(payload, completeSettings(), quote().breakdown)).toThrow('canonical calculation');
  });
});
