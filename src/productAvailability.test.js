import { assertProductInStock, availableProducts, isProductInStock } from './productAvailability';

test('legacy products remain available until explicitly marked out of stock', () => {
  expect(isProductInStock({ id: 'legacy' })).toBe(true);
  expect(isProductInStock({ id: 'yes', inStock: true })).toBe(true);
  expect(isProductInStock({ id: 'no', inStock: false })).toBe(false);
});

test('filters the agent catalog without deleting admin products', () => {
  const catalog = [{ id: 'a' }, { id: 'b', inStock: false }, { id: 'c', inStock: true }];
  expect(availableProducts(catalog).map((item) => item.id)).toEqual(['a', 'c']);
  expect(catalog).toHaveLength(3);
});

test('business validation rejects an explicitly unavailable product', () => {
  expect(() => assertProductInStock({ id: 'no', inStock: false }, 'panel')).toThrow('not in stock');
  expect(assertProductInStock({ id: 'legacy' })).toEqual({ id: 'legacy' });
});
