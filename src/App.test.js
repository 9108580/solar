import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen without crashing', () => {
  render(<App />);
  expect(screen.getByText(/מספר תעודת הזהות/i)).toBeInTheDocument();
});
