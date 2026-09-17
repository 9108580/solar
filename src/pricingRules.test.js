import { calculateSystemTypePricing } from './pricingRules';

const settings = (commercialLabor, commercialProfit) => ({
  laborPerKwResidential: 650,
  profitResidentialFixed: 21000,
  laborPerKwCommercial: commercialLabor,
  profitCommercialPerKw: commercialProfit,
});

describe('system type pricing from live admin settings', () => {
  test('case A: commercial 53.3 kWp uses 550 and 630 settings', () => {
    const result = calculateSystemTypePricing(
      { systemType: 'commercial' },
      53.3,
      settings(550, 630)
    );
    expect(result.laborCost).toBeCloseTo(29315, 8);
    expect(result.profitValue).toBeCloseTo(33579, 8);
  });

  test('case B: changed settings immediately change the next calculation', () => {
    const result = calculateSystemTypePricing(
      { systemType: 'commercial' },
      53.3,
      settings(700, 800)
    );
    expect(result.laborCost).toBeCloseTo(37310, 8);
    expect(result.profitValue).toBeCloseTo(42640, 8);
  });

  test('residential below 35 kW uses residential settings', () => {
    const result = calculateSystemTypePricing(
      { systemType: 'residential' },
      34.99,
      { ...settings(700, 800), laborPerKwResidential: 777, profitResidentialFixed: 23456 }
    );
    expect(result.systemType).toBe('residential');
    expect(result.laborCost).toBeCloseTo(34.99 * 777, 8);
    expect(result.profitValue).toBe(23456);
  });

  test('30 to 36 kW transition switches pricing to commercial settings', () => {
    const currentSettings = settings(700, 800);
    const at30 = calculateSystemTypePricing({ systemType: 'residential' }, 30, currentSettings);
    const at36 = calculateSystemTypePricing({ systemType: at30.systemType }, 36, currentSettings);
    expect(at30.systemType).toBe('residential');
    expect(at36).toMatchObject({
      systemType: 'commercial',
      laborCost: 25200,
      profitValue: 28800,
    });
  });

  test('manual residential selection at 40 kW cannot restore residential rates', () => {
    const result = calculateSystemTypePricing(
      { systemType: 'residential' },
      40,
      settings(700, 800)
    );
    expect(result).toMatchObject({
      systemType: 'commercial',
      laborCost: 28000,
      profitValue: 32000,
    });
  });

  test.each(['commercial', 'מערכת מסחרית', 'מסחרית'])(
    'commercial representation %s uses commercial settings',
    (systemType) => {
      const result = calculateSystemTypePricing({ systemType }, 20, settings(700, 800));
      expect(result).toMatchObject({ systemType: 'commercial', laborCost: 14000, profitValue: 16000 });
    }
  );

  test('missing settings fail instead of silently using hardcoded prices', () => {
    expect(() =>
      calculateSystemTypePricing({ systemType: 'commercial' }, 53.3, {})
    ).toThrow('laborPerKwCommercial');
  });

  test('editing the current settings object changes the subsequent calculation', () => {
    const currentSettings = settings(550, 630);
    const before = calculateSystemTypePricing({ systemType: 'commercial' }, 53.3, currentSettings);
    currentSettings.laborPerKwCommercial = 700;
    currentSettings.profitCommercialPerKw = 800;
    const after = calculateSystemTypePricing({ systemType: 'commercial' }, 53.3, currentSettings);
    expect(before).toMatchObject({ laborCost: 29315, profitValue: 33579 });
    expect(after).toMatchObject({ laborCost: 37310, profitValue: 42640 });
  });

  test('unknown legacy values fail instead of silently taking residential prices', () => {
    expect(() =>
      calculateSystemTypePricing({ systemType: 'unexpected-type' }, 20, settings(700, 800))
    ).toThrow('Unknown system type');
  });
});
