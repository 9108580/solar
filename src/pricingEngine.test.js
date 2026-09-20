import { calculateCanonicalPricing, deriveCanonicalDc, panelQuantityForTargetDc } from './pricingEngine';
import { validateQuoteForSave } from './pricingSettings';

const settings = () => ({
  usdExchangeRate: 3.3,
  constructionConcretePerKw: 0,
  constructionOtherPerKw: 0,
  logisticsCost: 0,
  laborPerKwResidential: 650,
  laborPerKwCommercial: 550,
  hybridBatteryInstallCost: 0,
  planningCost: 0,
  constructorEngineer: 0,
  privateCheckResidential: 0,
  privateCheckCommercial: 0,
  electricianResidential: 0,
  electricianCommercial: 0,
  acCableOnGridResidential: 0,
  acCableHybridResidential: 0,
  acCableCommercial: 0,
  antennaCost: 0,
  communicationLine: 0,
  electricalBoxResidential: 0,
  electricalBoxCommercialPerKw: 0,
  washingSystemBase: 0,
  feesCost: 0,
  profitResidentialFixed: 21000,
  profitCommercialPerKw: 630,
  vatRate: 18,
  productionHours: 1700,
  primeRate: 0,
  loanMargin: 0,
  productionMeterSurcharge: 0,
  urbanPremiumAgorotPerKwh: 0,
  urbanPremiumValidUntilYear: 0,
  optimizerPrices: { se1to1: 0, se1to2: 0, tigo: 0, sungrow: 0 },
  tariffBands: [{ upToKw: null, agorotPerKwh: 0 }],
  panels: [{ id: 'p', powerWatts: 533, pricePerWattUsd: 0 }],
  inverters: [{ id: 'i', name: 'Inverter', cost: 0 }],
  invertersHybrid: [{ id: 'h', name: 'Hybrid', cost: 0 }],
  batteries: [{ id: 'b', name: 'Battery', cost: 0 }],
});

const form = (quantity, systemType = 'residential') => ({
  systemType,
  roofType: 'concrete',
  residentialTrack: 'green',
  inverterSystemType: 'ongrid',
  selectedPanels: [{ id: 'p', quantity }],
  selectedInverters: [{ id: 'i', quantity: 1 }],
  selectedHybridInverters: [{ id: 'h', quantity: 1 }],
  selectedBatteries: [{ id: 'b', quantity: 1 }],
  includesBatteries: false,
  includesOptimizers: false,
  includesWashing: false,
  feesPayer: 'client',
  tigoQuantity: 0,
  sungrowQuantity: 0,
});

describe('canonical pricing engine', () => {
  test('storage board costs use current prices and quantities in totals and save validation', () => {
    const current = settings();
    current.storageElectricalBoards = [{ id: 'a', cost: 1200 }, { id: 'b', cost: 450 }];
    const hybrid = { ...form(65), inverterSystemType: 'hybrid', includesBatteries: true };
    const baseline = calculateCanonicalPricing(hybrid, current, { acKw: 15 });
    hybrid.selectedStorageElectricalBoards = [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 3 }];
    const result = calculateCanonicalPricing(hybrid, current, { acKw: 15 });
    expect(result.breakdown.storageElectricalBoards).toBe(3750);
    expect(result.breakdown.finalPrice - baseline.breakdown.finalPrice).toBe(3750);
    expect(result.storageElectricalBoardDetailsList[0]).toMatchObject({ unitCost: 1200, totalCost: 2400 });
    const quote = { ...result.system, hasBatteries: true, breakdown: result.breakdown };
    expect(validateQuoteForSave(quote, current, result.breakdown)).toBe(true);
    current.storageElectricalBoards[0].cost = 1500;
    const updated = calculateCanonicalPricing(hybrid, current, { acKw: 15 });
    expect(updated.breakdown.storageElectricalBoards).toBe(4350);
    expect(() => validateQuoteForSave(quote, current, updated.breakdown)).toThrow();
    expect(calculateCanonicalPricing({ ...hybrid, includesBatteries: false }, current, { acKw: 15 }).breakdown.storageElectricalBoards).toBe(0);
    current.storageElectricalBoards[0].cost = '';
    expect(() => calculateCanonicalPricing(hybrid, current, { acKw: 15 })).toThrow('cost');
    current.storageElectricalBoards[0].cost = 0;
    expect(calculateCanonicalPricing(hybrid, current, { acKw: 15 }).breakdown.storageElectricalBoards).toBe(1350);
  });
  test.each([
    [50, 650, 77],
    [50, 665, 75],
    [35, 650, 54],
    [34.99, 650, 54],
  ])('target %s kWp with %sW panels resolves to %s whole panels', (target, watts, quantity) => {
    expect(panelQuantityForTargetDc(target, watts)).toBe(quantity);
  });

  test('target DC resolves to an actual panel-derived DC used by commercial rule and pricing', () => {
    const current = settings();
    current.panels[0].powerWatts = 650;
    const quantity = panelQuantityForTargetDc(35, 650);
    const result = calculateCanonicalPricing(form(quantity), current, { acKw: 23.4 });
    expect(quantity).toBe(54);
    expect(result.dcKw).toBe(35.1);
    expect(result.system.systemType).toBe('commercial');
  });

  test.each([[null, 650], [0, 650], [-1, 650], [50, 0], [50, null]])(
    'invalid target/panel pair %p/%p is rejected',
    (target, watts) => expect(() => panelQuantityForTargetDc(target, watts)).toThrow()
  );
  test.each([
    [65, 34.645, 'residential'],
    [66, 35.178, 'commercial'],
    [100, 53.3, 'commercial'],
  ])('panel-derived DC for %s panels is %s and canonical type is %s', (quantity, dc, type) => {
    const result = calculateCanonicalPricing(form(quantity), settings(), { acKw: 15 });
    expect(result.dcKw).toBeCloseTo(dc, 8);
    expect(result.system.systemSizeKw).toBeCloseTo(dc, 8);
    expect(result.system.systemType).toBe(type);
  });

  test('53.3 kWp uses current commercial labor and profit settings', () => {
    const current = settings();
    const before = calculateCanonicalPricing(form(100), current, { acKw: 50 });
    expect(before.breakdown.labor).toBeCloseTo(29315, 8);
    expect(before.breakdown.marginValue).toBeCloseTo(33579, 8);
    current.laborPerKwCommercial = 700;
    current.profitCommercialPerKw = 800;
    const after = calculateCanonicalPricing(form(100), current, { acKw: 50 });
    expect(after.breakdown.labor).toBeCloseTo(37310, 8);
    expect(after.breakdown.marginValue).toBeCloseTo(42640, 8);
  });

  test('manual residential choice at commercial DC cannot restore residential pricing', () => {
    const result = calculateCanonicalPricing(form(100, 'residential'), settings(), { acKw: 50 });
    expect(result.system.systemType).toBe('commercial');
    expect(result.breakdown.labor).toBeCloseTo(29315, 8);
  });

  test('product price zero is accepted; missing product cost is blocked', () => {
    expect(calculateCanonicalPricing(form(65), settings(), { acKw: 15 }).breakdown.inverter).toBe(0);
    const broken = settings();
    delete broken.inverters[0].cost;
    expect(() => calculateCanonicalPricing(form(65), broken, { acKw: 15 })).toThrow('cost');
  });

  test.each([
    ['panels', 'panel'],
    ['inverters', 'inverter'],
  ])('an out-of-stock %s selection is blocked by canonical pricing', (catalogKey, label) => {
    const current = settings();
    current[catalogKey][0].inStock = false;
    expect(() => calculateCanonicalPricing(form(65), current, { acKw: 15 })).toThrow(`Selected ${label} is not in stock`);
  });

  test('an out-of-stock battery is blocked for a hybrid system', () => {
    const current = settings();
    current.batteries[0].inStock = false;
    const hybrid = {
      ...form(65),
      inverterSystemType: 'hybrid',
      includesBatteries: true,
    };
    expect(() => calculateCanonicalPricing(hybrid, current, { acKw: 15 })).toThrow('Selected battery is not in stock');
  });

  test('production meter surcharge comes from settings and accepts zero', () => {
    const productionMeterForm = { ...form(65), residentialTrack: 'production_meter' };
    const current = settings();
    current.productionMeterSurcharge = 1000;
    expect(calculateCanonicalPricing(productionMeterForm, current, { acKw: 15 }).breakdown.productionMeter).toBe(1000);
    current.productionMeterSurcharge = 0;
    expect(calculateCanonicalPricing(productionMeterForm, current, { acKw: 15 }).breakdown.productionMeter).toBe(0);
  });

  test('canonical DC ignores stale form systemSizeKw', () => {
    const stale = { ...form(100), systemSizeKw: 30 };
    expect(deriveCanonicalDc(stale, settings())).toBe(53.3);
    expect(calculateCanonicalPricing(stale, settings(), { acKw: 50 }).system.systemSizeKw).toBe(53.3);
  });
});
