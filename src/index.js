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

function QuotesNotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '2rem',
        fontFamily: 'system-ui,sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
        textAlign: 'center',
      }}
    >
      <p>הצעת מחיר</p>
      <h1>404</h1>
      <p>הדף לא נמצא.</p>
      <p>
        <a href="/" style={{ color: '#93c5fd' }}>
          חזרה להצעת מחיר
        </a>
      </p>
    </div>
  );
}

const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <RootBoundary>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/q/:quoteId" element={<App />} />
          <Route path="*" element={<QuotesNotFound />} />
        </Routes>
      </BrowserRouter>
    </RootBoundary>
  </React.StrictMode>
);
