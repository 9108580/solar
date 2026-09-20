import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteVisualization, QuoteVisualizationUpload } from './QuoteVisualization';
import { readQuoteVisualization } from './visualizationImage';
jest.mock('./visualizationImage', () => ({ ...jest.requireActual('./visualizationImage'), readQuoteVisualization: jest.fn() }));
const asset = { fileName: 'house.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' };

test('optional quote block displays saved image and disappears without it', () => {
  const { rerender } = render(<QuoteVisualization asset={asset} />);
  expect(screen.getByRole('img')).toHaveAttribute('src', asset.dataUrl);
  rerender(<QuoteVisualization />);
  expect(screen.queryByRole('img')).toBeNull();
});

test('upload supports replacement, failure preserves current image, removal clears it', async () => {
  const onChange = jest.fn(); const onBusyChange = jest.fn();
  readQuoteVisualization.mockResolvedValue(asset);
  render(<QuoteVisualizationUpload asset={asset} onChange={onChange} onBusyChange={onBusyChange} />);
  fireEvent.change(screen.getByLabelText('הוספת הדמיה'), { target: { files: [new File(['x'], 'new.png')] } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(asset));
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  onChange.mockClear(); readQuoteVisualization.mockRejectedValue(new Error('Invalid image'));
  fireEvent.change(screen.getByLabelText('הוספת הדמיה'), { target: { files: [new File(['x'], 'bad.png')] } });
  await screen.findByRole('alert');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('img')).toHaveAttribute('src', asset.dataUrl);
  fireEvent.click(screen.getByText('הסרת הדמיה'));
  expect(onChange).toHaveBeenCalledWith(null);
});
