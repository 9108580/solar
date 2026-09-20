import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App, { migratePanelsCatalog, normalizeAdminSettings } from './App';
import { productsByPrice } from './productSelection';

test('legacy delivery initializes commercial delivery without overriding an explicit value', () => {
  expect(normalizeAdminSettings({ logisticsCost: 3300 }).logisticsCostCommercial).toBe(3300);
  expect(normalizeAdminSettings({ logisticsCost: 3300, logisticsCostCommercial: 7000 }).logisticsCostCommercial).toBe(7000);
  expect(normalizeAdminSettings({ logisticsCost: 3300, logisticsCostCommercial: 0 }).logisticsCostCommercial).toBe(0);
  expect(normalizeAdminSettings({ logisticsCost: 3300, logisticsCostCommercial: '' }).logisticsCostCommercial).toBe('');
});

test('loaded panel settings preserve stock before choosing the cheapest panel', () => {
  const panels = migratePanelsCatalog({ panels: [
    { id: 'risen', name: 'RISEN', pricePerWattUsd: 0.09, inStock: false },
    { id: 'aiko', name: 'AIKO', pricePerWattUsd: 0.15 },
    { id: 'space', name: 'SOLAR SPACE', pricePerWattUsd: 0.1, inStock: true },
  ] });
  expect(panels[0].inStock).toBe(false);
  expect(productsByPrice(panels, 'pricePerWattUsd').map(p => p.id)).toEqual(['space', 'aiko']);
});

test('renders login screen without crashing', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText(/מספר תעודת הזהות/i)).toBeInTheDocument();
});

test('DC input accepts panel-derived decimal power without a step mismatch', () => {
  const { container } = render(<MemoryRouter><App /></MemoryRouter>);
  fireEvent.change(container.querySelector('input'), { target: { value: 'coca' } });
  fireEvent.click(screen.getByRole('button', { name: /היכנס למערכת/ }));
  const dc = screen.getByRole('spinbutton', { name: 'גודל מערכת DC רצוי (kWp)' });
  [22.75, 50.05, 49.875, 35].forEach((value) => {
    fireEvent.change(dc, { target: { value: String(value) } });
    expect(dc.checkValidity()).toBe(true);
  });
  fireEvent.change(dc, { target: { value: '0' } });
  expect(dc.checkValidity()).toBe(false);
  fireEvent.change(dc, { target: { value: '' } });
  expect(dc.checkValidity()).toBe(false);
});
