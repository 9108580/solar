import {
  COMMERCIAL_DC_THRESHOLD_KW,
  canonicalSystemType,
  enforceSystemTypeForDc,
  requiresCommercialSystem,
} from './systemTypeRule';

describe('mandatory commercial system classification by DC power', () => {
  test.each([
    [34.99, false],
    [35.0, true],
    [35.01, true],
  ])('%s kW commercial requirement is %s', (dcKw, expected) => {
    expect(requiresCommercialSystem(dcKw)).toBe(expected);
  });

  test('keeps residential/BT below the threshold', () => {
    expect(enforceSystemTypeForDc({ systemType: 'residential' }, 34.99).systemType).toBe('residential');
  });

  test('overrides an agent residential choice at 40 kW', () => {
    expect(enforceSystemTypeForDc({ systemType: 'residential' }, 40).systemType).toBe('commercial');
  });

  test('changes an existing residential system when DC rises from 30 to 36 kW', () => {
    const at30Kw = enforceSystemTypeForDc({ systemType: 'residential' }, 30);
    const at36Kw = enforceSystemTypeForDc(at30Kw, 36);
    expect(at30Kw.systemType).toBe('residential');
    expect(at36Kw.systemType).toBe('commercial');
  });

  test('exports the contractual boundary explicitly', () => {
    expect(COMMERCIAL_DC_THRESHOLD_KW).toBe(35);
  });

  test.each([
    ['commercial', 'commercial'],
    ['מערכת מסחרית', 'commercial'],
    ['מסחרית', 'commercial'],
    ['residential', 'residential'],
    ['BT', 'residential'],
    ['מערכת ביתית', 'residential'],
  ])('canonicalizes legacy type %s to %s', (storedType, expected) => {
    expect(canonicalSystemType(storedType)).toBe(expected);
  });
});
