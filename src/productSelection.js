import { availableProducts } from './productAvailability';

// Panels are quoted per watt; inverters are priced per unit in Admin Settings.
export function productsByPrice(products, priceField = 'cost') {
  const price = (product) => {
    const raw = product?.[priceField];
    const value = Number(raw);
    return raw != null && String(raw).trim() !== '' && Number.isFinite(value) && value >= 0
      ? value : Infinity;
  };
  return availableProducts(products).sort((a, b) => price(a) - price(b));
}

export function findDefaultInverterId(products) {
  return productsByPrice(products)[0]?.id || '';
}
