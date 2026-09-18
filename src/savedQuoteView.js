import { requiredNumberSetting } from './pricingSettings';

// Read-only compatibility for quotes issued by the pre-snapshot application.
// That application's VAT display was 18% (see d88942c:src/App.js).
// This is historical document metadata, never a default for new pricing.
const LEGACY_DOCUMENT_VAT_PERCENT = 18;

export function prepareSavedQuoteForViewing(quote) {
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) {
    throw new Error('Invalid saved quote');
  }
  if (quote.pricingSnapshot) {
    requiredNumberSetting(quote.pricingSnapshot, 'vatRate');
    return quote;
  }
  const vatRate = quote.vatRate == null
    ? LEGACY_DOCUMENT_VAT_PERCENT
    : requiredNumberSetting(quote, 'vatRate');
  // Do not canonicalize type or recalculate prices, tariffs, city eligibility,
  // investment metrics or financing when opening an already issued document.
  return { ...quote, pricingSnapshot: { vatRate } };
}
