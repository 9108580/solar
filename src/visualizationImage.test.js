import { containImage, readQuoteVisualization, visualizationSrc, VISUALIZATION_MAX_BYTES } from './visualizationImage';
import { prepareSavedQuoteForViewing } from './savedQuoteView';
jest.mock('heic2any', () => ({ __esModule: true, default: jest.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })) }));

test.each([[3200, 1000], [600, 1200], [100, 100]])('fits %s x %s without cropping or distortion', (w, h) => {
  const box = containImage(w, h);
  expect(box.width / box.height).toBeCloseTo(w / h);
  expect(box.width).toBeLessThanOrEqual(1600);
  expect(box.height).toBeLessThanOrEqual(1000);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
});

test('quote serialization and legacy viewer preserve visualization', () => {
  const asset = { fileName: 'house.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' };
  const saved = JSON.parse(JSON.stringify({ visualization: asset, pricingSnapshot: { vatRate: 18 } }));
  expect(visualizationSrc(prepareSavedQuoteForViewing(saved).visualization)).toBe(asset.dataUrl);
  expect(visualizationSrc(null)).toBeNull();
  expect(visualizationSrc({ dataUrl: 'https://example.com/tracker' })).toBeNull();
});

test('rejects empty, oversized and non-image files', async () => {
  await expect(readQuoteVisualization({ size: 0 })).rejects.toThrow();
  await expect(readQuoteVisualization({ size: VISUALIZATION_MAX_BYTES + 1 })).rejects.toThrow();
  await expect(readQuoteVisualization(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))).rejects.toThrow();
});

test.each(['house.png', 'house.HEIC', 'house.heif'])('normalizes %s to bounded JPEG and releases temporary URL', async (name) => {
  const originalImage = global.Image;
  global.Image = class { naturalWidth = 2000; naturalHeight = 1000; set src(value) { this.onload(); } };
  URL.createObjectURL = jest.fn(() => 'blob:test');
  URL.revokeObjectURL = jest.fn();
  const context = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: jest.fn(), drawImage: jest.fn() });
  const encode = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YQ==');
  try {
    const asset = await readQuoteVisualization(new File(['image'], name, { type: 'image/png' }));
    expect(visualizationSrc(asset)).toBe('data:image/jpeg;base64,YQ==');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  } finally { global.Image = originalImage; context.mockRestore(); encode.mockRestore(); }
});
