import React, { useEffect, useRef, useState } from 'react';
import { readQuoteVisualization, visualizationSrc } from './visualizationImage';

export function QuoteVisualization({ asset }) {
  const src = visualizationSrc(asset);
  if (!src) return null;
  return <section className="px-4 sm:px-8 md:px-20 py-8 border-t border-slate-200 print:break-inside-avoid" dir="rtl">
    <h3 className="text-2xl font-bold text-blue-900 mb-4">הדמיית המערכת</h3>
    <img src={src} alt="הדמיית מיקום הפאנלים על בית הלקוח" className="w-full rounded-xl border border-slate-200 bg-white" style={{ aspectRatio: '8 / 5', objectFit: 'contain', maxHeight: '600px' }} />
  </section>;
}

export function QuoteVisualizationUpload({ asset, onChange, onBusyChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const src = visualizationSrc(asset);
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++generation.current;
    setBusy(true); onBusyChange(true); setError('');
    try {
      const next = await readQuoteVisualization(file);
      if (request === generation.current) onChange(next);
    } catch (err) {
      if (request === generation.current) setError(err.message);
    } finally {
      onBusyChange(false);
      if (request === generation.current) setBusy(false);
    }
  };
  return <div className="md:col-span-2 rounded-2xl border border-white/10 p-5">
    <label className="inline-block cursor-pointer rounded-xl bg-blue-600 px-4 py-3 text-white">
      {busy ? 'מעבד תמונה…' : src ? 'החלפת הדמיה' : 'הוספת הדמיה'}
      <input type="file" aria-label="הוספת הדמיה" accept="image/*,.heic,.heif" disabled={busy} onChange={upload} className="block mt-2 text-sm max-w-full" />
    </label>
    <p className="text-sm text-slate-400 mt-2">עד 20MB · התמונה תותאם למסגרת ללא חיתוך או עיוות.</p>
    {error && <p role="alert" className="text-red-400 mt-2">{error}</p>}
    {src && <div className="mt-4">
      <img src={src} alt="תצוגה מקדימה של ההדמיה" className="w-full max-h-80 object-contain bg-white rounded-xl" />
      <button type="button" disabled={busy} onClick={() => { onChange(null); setError(''); }} className="mt-2 text-red-300">הסרת הדמיה</button>
    </div>}
  </div>;
}
