import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { RootBoundary } from './RootBoundary';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>
);
