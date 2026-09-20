import {
  normalizeStorageElectricalBoards,
  resolveStorageElectricalBoardSelections,
} from './storageElectricalBoards';

test('normalizes the admin storage electrical board catalog', () => {
  expect(normalizeStorageElectricalBoards([{ id: 'a', name: '  לוח A  ', description: '  הסבר  ' }]))
    .toEqual([{ id: 'a', name: 'לוח A', description: 'הסבר' }]);
  expect(normalizeStorageElectricalBoards(undefined)).toEqual([]);
});

test('resolves multiple storage electrical boards with quantities and descriptions', () => {
  const catalog = [
    { id: 'a', name: 'לוח A', description: 'הסבר A' },
    { id: 'b', name: 'לוח B', description: 'הסבר B' },
  ];
  expect(resolveStorageElectricalBoardSelections([
    { id: 'a', quantity: 2 },
    { id: 'b', quantity: 1 },
  ], catalog)).toEqual([
    { id: 'a', name: 'לוח A', description: 'הסבר A', quantity: 2 },
    { id: 'b', name: 'לוח B', description: 'הסבר B', quantity: 1 },
  ]);
});

test('rejects stale products and invalid quantities', () => {
  expect(() => resolveStorageElectricalBoardSelections([{ id: 'missing', quantity: 1 }], []))
    .toThrow('Unknown selected storage electrical board');
  expect(() => resolveStorageElectricalBoardSelections([{ id: 'a', quantity: 0 }], [{ id: 'a' }]))
    .toThrow('Invalid storage electrical board quantity');
});
