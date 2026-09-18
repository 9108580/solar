import { prepareSavedQuoteForViewing } from './savedQuoteView';
import { requiredNumberSetting } from './pricingSettings';

const issuedQuote = (overrides = {}) => ({
  systemType: 'residential', systemSizeKw: '40',
  breakdown: { labor: 26000, marginValue: 21000, finalPrice: 70000 },
  clientOfferPrice: 81000,
  hasUrbanPremium: true, urbanPremiumAgorotPerKwh: 6,
  urbanPremiumValidUntilYear: 2042, calculatedTariff: 0.54,
  loanSettings: { primeRate: 6, loanMargin: 1.5 },
  graphData: [{ year: 0, flow: -81000 }],
  loanSimulation: [{ year: 1, repayment: 14000 }],
  ...overrides,
});

test.each(['residential', 'commercial'])('legacy %s opens without admin settings and preserves every issued field', (systemType) => {
  const quote = issuedQuote({ systemType });
  const original = JSON.stringify(quote);
  const view = prepareSavedQuoteForViewing(quote);
  expect(requiredNumberSetting(view.pricingSnapshot, 'vatRate')).toBe(18);
  const { pricingSnapshot, ...preserved } = view;
  expect(preserved).toEqual(quote);
  expect(JSON.stringify(quote)).toBe(original);
});

test('opening historical residential >=35 preserves its original type and domestic costs', () => {
  const quote = issuedQuote();
  const view = prepareSavedQuoteForViewing(quote);
  expect(view.systemType).toBe('residential');
  expect(view.breakdown).toBe(quote.breakdown);
});

test('saved city eligibility and financing remain unchanged', () => {
  const quote = issuedQuote({ hasUrbanPremium: false, calculatedTariff: 0.48 });
  const view = prepareSavedQuoteForViewing(quote);
  expect(view.hasUrbanPremium).toBe(false);
  expect(view.calculatedTariff).toBe(0.48);
  expect(view.graphData).toBe(quote.graphData);
  expect(view.loanSimulation).toBe(quote.loanSimulation);
});

test.each([0, 17, 20])('explicit historical VAT %s is preserved', (vatRate) => {
  expect(prepareSavedQuoteForViewing(issuedQuote({ vatRate })).pricingSnapshot.vatRate).toBe(vatRate);
});

test('modern and previously restored snapshots are used as saved', () => {
  const quote = issuedQuote({ pricingSnapshot: { vatRate: 20, primeRate: 4 } });
  expect(prepareSavedQuoteForViewing(quote)).toBe(quote);
});

test('invalid modern VAT is reported rather than borrowing current admin settings', () => {
  expect(() => prepareSavedQuoteForViewing(issuedQuote({ pricingSnapshot: { vatRate: null } }))).toThrow('vatRate');
});
