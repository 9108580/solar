import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import { RootBoundary } from './RootBoundary';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

const routerBasename =
  process.env.PUBLIC_URL && process.env.PUBLIC_URL !== '/'
    ? process.env.PUBLIC_URL.replace(/\/$/, '')
    : undefined;

const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <RootBoundary>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/q/:quoteId" element={<App />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </RootBoundary>
  </React.StrictMode>
);
