export function normalizeStorageElectricalBoards(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => ({
    ...item,
    id: String(item?.id || `storage-board-${index}`),
    name: String(item?.name || '').trim(),
    description: String(item?.description || '').trim(),
  }));
}

export function resolveStorageElectricalBoardSelections(selections, catalog) {
  if (!Array.isArray(selections)) return [];
  const products = normalizeStorageElectricalBoards(catalog);
  return selections.map((selection) => {
    const product = products.find((item) => item.id === selection?.id);
    if (!product) throw new Error(`Unknown selected storage electrical board: ${selection?.id || ''}`);
    const quantity = Number(selection?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid storage electrical board quantity');
    }
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      quantity,
    };
  });
}
