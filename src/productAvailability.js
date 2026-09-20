export function isProductInStock(product) {
  return product?.inStock !== false;
}

export function availableProducts(products) {
  return Array.isArray(products) ? products.filter(isProductInStock) : [];
}

export function assertProductInStock(product, label = 'product') {
  if (!isProductInStock(product)) {
    throw new Error(`Selected ${label} is not in stock: ${product?.id || product?.name || '(unknown)'}`);
  }
  return product;
}
