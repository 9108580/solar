import { productsByPrice, findDefaultInverterId } from './productSelection';

test('panels use current per-watt prices, exclude unavailable products and preserve catalog order', () => {
  const panels = [
    { id: 'a', pricePerWattUsd: 0.15 },
    { id: 'b', pricePerWattUsd: 0.1 },
    { id: 'c', pricePerWattUsd: 0.05, inStock: false },
  ];
  expect(productsByPrice(panels, 'pricePerWattUsd').map(p => p.id)).toEqual(['b', 'a']);
  expect(panels.map(p => p.id)).toEqual(['a', 'b', 'c']);
  panels[0].pricePerWattUsd = 0.08;
  expect(productsByPrice(panels, 'pricePerWattUsd')[0].id).toBe('a');
});

test('inverter default follows cost rather than brand, including hybrid catalogs', () => {
  const catalog = [{ id: 's', name: 'Solis', cost: 5000 }, { id: 'g', name: 'Growatt', cost: 4000 }];
  expect(findDefaultInverterId(catalog)).toBe('g');
  catalog[0].cost = 3000;
  expect(findDefaultInverterId(catalog)).toBe('s');
  catalog[0].inStock = false;
  expect(findDefaultInverterId(catalog)).toBe('g');
  expect(findDefaultInverterId([])).toBe('');
});

test('missing prices sort last; zero and numeric strings are valid; ties remain stable', () => {
  expect(productsByPrice([{ id: 'missing', cost: '' }, { id: 'a', cost: '10' }, { id: 'b', cost: 10 }, { id: 'zero', cost: 0 }]).map(p => p.id))
    .toEqual(['zero', 'a', 'b', 'missing']);
});
