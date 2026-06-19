import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSupabase } from './supabaseClient';
import { prepareAdminPricesForCloud, publicAdminAssetUrl } from './adminCloudPayload';
import {
  DEFAULT_URBAN_PREMIUM_CITIES,
  resolveUrbanPremiumFromCity,
} from './urbanPremiumCities';
import { 
  Calculator, Settings, Sun, User, FileText, CheckCircle, Zap, DollarSign, 
  Trash2, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, HardHat, BatteryCharging, ExternalLink, 
  ShieldCheck, Activity, MapPin, Phone, TrendingUp, Award, Clock, Wrench, AlertCircle,
  Home, Gift, Users, LogOut, PenTool, Loader2, CloudUpload, Copy, Globe
} from 'lucide-react';

const COMPANY_WEBSITE_URL = 'https://mes.co.il';
const COMPANY_WEBSITE_DISPLAY = 'mes.co.il';
const COMPANY_FACEBOOK_URL = 'https://www.facebook.com/mumhimenergiyasolarit';

function FacebookIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function CompanySocialLinks({ className = '', variant = 'light' }) {
  const linkClass =
    variant === 'dark'
      ? 'inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white'
      : 'inline-flex items-center gap-2 rounded-lg border border-blue-200/80 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-50 print:border-slate-300 print:text-slate-800';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a href={COMPANY_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <Globe className="h-5 w-5 shrink-0" aria-hidden />
        {COMPANY_WEBSITE_DISPLAY}
      </a>
      <a href={COMPANY_FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <FacebookIcon className="h-5 w-5 shrink-0" />
        פייסבוק
      </a>
    </div>
  );
}

/** אייקון שקל — במקום DollarSign (סמל דולר) בהצעה */
function ShekelIcon({ className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-black leading-none text-current ${className}`}
      aria-hidden
    >
      ₪
    </span>
  );
}

/** כתובת מלאה לשיתוף הצעה: /q/:uuid (מכבד PUBLIC_URL) */
function quoteShareAbsoluteUrl(quoteId) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (typeof window === 'undefined') return `${base}/q/${quoteId}`;
  return `${window.location.origin}${base}/q/${quoteId}`;
}

/** תוקף קישור הצעה ללקוח (לא קשור להטבת 7 ימים בהצעה) */
const SHARE_LINK_VALIDITY_DAYS = 90;
const SHARE_LINK_VALIDITY_LABEL_HE = '90 ימים';

/** העתקה סינכרונית ללוח (fallback: textarea + execCommand) */
async function copyTextSync(text) {
  const value = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '2em';
  textarea.style.height = '2em';
  textarea.style.padding = '0';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.boxShadow = 'none';
  textarea.style.background = 'transparent';
  textarea.style.fontSize = '16px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(0, value.length);
  }
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * העתקה אחרי פעולה אסינכרונית — Safari/iOS דורש ClipboardItem עם Promise
 * כדי לשמור על user gesture בזמן insert ל-Supabase.
 */
async function copyTextRespectingUserGesture(textPromise) {
  const hasClipboardItem =
    Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined';
  // #region agent log
  emitShareLinkDebugLog('H2', 'copy-strategy', {
    hasClipboardItem,
    hasWriteText: Boolean(navigator.clipboard?.writeText),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : '',
  });
  // #endregion
  if (hasClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': textPromise.then((t) => new Blob([String(t)], { type: 'text/plain' })),
      }),
    ]);
    return;
  }
  const text = await textPromise;
  await copyTextSync(text);
}

function canUseNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function buildWhatsappMeLink(rawPhone, message) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  let clean = digits;
  if (clean.startsWith('0')) clean = '972' + clean.slice(1);
  if (!clean) return null;
  const text = typeof message === 'string' && message.length > 0 ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${clean}${text}`;
}

/** פרמיה אורבנית (חח"י) — תוספת לתעריף המשוקלל בתחשיב ההצעה */
const URBAN_PREMIUM_AGOROT_PER_KWH = 6;
const URBAN_PREMIUM_VALID_UNTIL_YEAR = 2042;

/** תעריף לשנה קלנדרית — פרמיה אורבנית רק עד URBAN_PREMIUM_VALID_UNTIL_YEAR כולל */
function getEffectiveTariffForCalendarYear(baseTariffShekels, hasUrbanPremium, calendarYear) {
  const premiumActive =
    hasUrbanPremium && calendarYear <= URBAN_PREMIUM_VALID_UNTIL_YEAR;
  return (
    baseTariffShekels +
    (premiumActive ? URBAN_PREMIUM_AGOROT_PER_KWH / 100 : 0)
  );
}

/** תא צר בשורת רכיבים — ממיר / אופטימייזר / שטיפה / פאנלים בצד */
const QUOTE_EQUIPMENT_STRIP_CELL =
  'flex w-[7.25rem] shrink-0 flex-col items-center gap-1 sm:w-[8rem] md:w-[8.75rem]';

const QUOTE_CARD_SHELL_COMPACT =
  'relative box-border flex h-[8.25rem] w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-2 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md md:h-[8.75rem] print:shadow-sm print:backdrop-blur-none';

const QUOTE_BRAND_CARD_COMPACT_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} border border-white/[0.12] bg-white/[0.06] print:border-slate-200/90 print:bg-white`;

const QUOTE_BRAND_CARD_COMPACT_EMERALD_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} border border-emerald-400/25 bg-emerald-950/30 print:border-emerald-200 print:bg-white`;

const QUOTE_BRAND_CARD_COMPACT_BLUE_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} border border-blue-400/30 bg-blue-950/25 print:border-blue-200 print:bg-white`;

const QUOTE_BRAND_CARD_COMPACT_CYAN_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} border border-cyan-400/28 bg-cyan-950/28 print:border-cyan-200 print:bg-white`;

const QUOTE_PLAIN_EQUIP_CARD_COMPACT_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} border border-slate-500/35 bg-slate-800/35 print:border-slate-200 print:bg-white`;

const QUOTE_BRAND_LOGO_IMG_COMPACT_CLASS =
  'max-h-[3.25rem] w-auto max-w-[88%] object-contain md:max-h-[3.5rem]';

/** משבצת לוגו/תמונה — רקע לבן מלא (אחיד לכל המותגים, כמו SolarSpace) */
const QUOTE_EQUIP_LOGO_TILE_CLASS =
  `${QUOTE_CARD_SHELL_COMPACT} !gap-0 !p-1 md:!p-1.5 overflow-hidden !border-white/20 !bg-white ring-1 ring-black/10 print:border-slate-200 print:bg-white print:shadow-sm`;
const QUOTE_BRAND_LOGO_IMG_FILL_CLASS =
  'h-full w-full min-h-0 flex-1 object-contain object-center p-0.5';
const QUOTE_EQUIP_PHOTO_TILE_IMG_CLASS =
  'h-full w-full min-h-0 flex-1 object-cover object-center';

/** @deprecated — השתמשו ב-QUOTE_EQUIP_LOGO_TILE_CLASS */
const QUOTE_BRAND_CARD_LOGO_ONLY_CLASS = QUOTE_EQUIP_LOGO_TILE_CLASS;
const QUOTE_BRAND_CARD_LOGO_ONLY_EMERALD_CLASS = QUOTE_EQUIP_LOGO_TILE_CLASS;
const QUOTE_BRAND_CARD_LOGO_ONLY_BLUE_CLASS = QUOTE_EQUIP_LOGO_TILE_CLASS;

/** כיתוב מתחת לכרטיס — ללא רקע; הדגשה עם צל כהה לקריאות על גרדיאנט */
const QUOTE_EQUIP_BELOW_CAPTION_CLASS =
  'block text-center text-sm font-bold leading-snug text-slate-50 md:text-base print:text-slate-900 px-1 [text-shadow:0_1px_3px_rgba(0,0,0,0.92),0_2px_10px_rgba(0,0,0,0.65)] print:[text-shadow:none]';

const QUOTE_EQUIP_BELOW_HINT_CLASS =
  'mt-1.5 block text-center text-xs font-bold leading-snug text-orange-100 md:text-sm print:hidden';

/** טקסט גנרי לפאנלים בהצעת לקוח — ללא מותג ספציפי */
const QUOTE_PANELS_GENERIC_TITLE_HE = 'פאנלים סולאריים';
const QUOTE_PANELS_GENERIC_BODY_HE =
  'מרשימת Tier 1 — עשרת המובילים בעולם, בטכנולוגיה המתקדמת ביותר.';

/** תא פאנלים — מעט רחב יותר לטקסט דו-שורתי */
const QUOTE_PANELS_STRIP_CELL =
  'flex w-[8.5rem] shrink-0 flex-col items-center gap-1 sm:w-[9.25rem] md:w-[10rem]';

/** מעטפת זהה לכל קוביות הציוד */
const QUOTE_CARD_SHELL =
  'relative box-border flex h-[12rem] w-full shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.75rem] px-3 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md md:h-[13rem] md:gap-1.5 md:px-4 md:py-4 print:shadow-md print:backdrop-blur-none';

const QUOTE_BRAND_CARD_AMBER_CLASS =
  `${QUOTE_CARD_SHELL} border border-amber-400/30 bg-amber-950/22 print:border-amber-200 print:bg-white`;

/** תמונת מערכת שטיפה בהצעה */
const QUOTE_WASHING_SYSTEM_IMG = `${process.env.PUBLIC_URL}/equipment/panel-washing.png`;

/** דוגמאות פרויקטים מהתקנות (מקור: תמונות של פרויקטים.docx) */
const QUOTE_PROJECT_EXAMPLE_IMAGES = Array.from({ length: 14 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `${process.env.PUBLIC_URL}/project-examples/project-${n}.jpg`;
});

/** מפת פרויקטים (Google My Maps) — viewer לחלון חדש, embed לתצוגה מוטמעת */
const QUOTE_PROJECTS_MAP_ID = '1gmzO7k_SBVucywFFtwSgYE35ltMabc0';
const QUOTE_PROJECTS_MAP_VIEWER_URL = `https://www.google.com/maps/d/u/0/viewer?mid=${QUOTE_PROJECTS_MAP_ID}&hl=iw`;
const QUOTE_PROJECTS_MAP_EMBED_URL = `https://www.google.com/maps/d/embed?mid=${QUOTE_PROJECTS_MAP_ID}&hl=iw&ll=31.93778024868962%2C35.098651000000025&z=8`;

/** PDF print layout — debug session c91eed */
function emitShareLinkDebugLog(hypothesisId, message, data) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  fetch('http://127.0.0.1:7414/ingest/0129d7ab-3eb6-46ad-add7-b5ee7cb6277d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c91eed' },
    body: JSON.stringify({
      sessionId: 'c91eed',
      runId: 'share-link',
      hypothesisId,
      location: 'App.js:share-link',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function emitPdfDebugLog(hypothesisId, message, data) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  fetch('http://127.0.0.1:7414/ingest/0129d7ab-3eb6-46ad-add7-b5ee7cb6277d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c91eed' },
    body: JSON.stringify({
      sessionId: 'c91eed',
      runId: 'pdf-print',
      hypothesisId,
      location: 'App.js:print',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function emitAgentDebugLog(runId, hypothesisId, location, message, data) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  fetch('http://127.0.0.1:7601/ingest/db65f22b-e2f1-4fe5-a2e4-59babefb6850', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '43ab36' },
    body: JSON.stringify({
      sessionId: '43ab36',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function QuoteProjectsMap({ clientCity }) {
  const [mapKey, setMapKey] = useState(0);
  const cityLabel = String(clientCity || '').trim();

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
      <div className="bg-blue-900 px-4 py-3 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" aria-hidden />
            <div>
              <p className="text-lg font-bold leading-snug">פרויקטים של מומחי אנרגיה סולארית</p>
              <p className="mt-1 text-sm text-blue-100/95">
                {cityLabel
                  ? `חפשו נקודות כחולות ליד ${cityLabel} — זום וגררו במפה`
                  : 'זום וגררו כדי לראות פרויקטים באזורכם'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMapKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
              חזרה למפה
            </button>
            <a
              href={QUOTE_PROJECTS_MAP_VIEWER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-orange-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              מפה מלאה (מומלץ)
            </a>
          </div>
        </div>
      </div>
      <div className="relative bg-slate-100" style={{ height: 'min(360px, 55vh)' }}>
        <iframe
          key={mapKey}
          title="מפת פרויקטים בארץ"
          src={QUOTE_PROJECTS_MAP_EMBED_URL}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-600">
        כל נקודה כחולה = פרויקט שביצענו. לחיצה על נקודה מציגה את שם הפרויקט — אם המסך נתקע (דף לבן), לחצו{' '}
        <strong>חזרה למפה</strong> למעלה, או <strong>מפה מלאה</strong> לחיפוש נוח בגוגל מפות.
      </p>
    </div>
  );
}

/** סקשן בהצעה — סגור במסך, נפתח בלחיצה; בהדפסה תמיד פתוח */
function QuoteExpandableSection({ title, subtitle, teaser, children, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mb-6 max-w-3xl mx-auto print:max-w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-right shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 print:hidden"
      >
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-blue-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-blue-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p> : null}
          {teaser ? <p className="mt-1 text-xs font-semibold text-orange-600">{teaser}</p> : null}
          {!open ? <p className="mt-1 text-xs text-slate-500">לחצו לפתיחת הפירוט המלא</p> : null}
        </div>
      </button>
      <div className="mb-4 hidden print:block">
        <h3 className="text-xl font-black text-blue-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      <div className={`${open ? 'block' : 'hidden'} print:block`}>{children}</div>
    </div>
  );
}

/** סליידר תמונות פרויקטים — תמונה אחת, מעבר בחצים */
function QuoteProjectSlider({ images }) {
  const [idx, setIdx] = useState(0);
  const total = images.length;
  if (!total) return null;
  const safeIdx = ((idx % total) + total) % total;
  const go = (delta) => setIdx((i) => (i + delta + total) % total);

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-4xl print:max-w-full">
      <div className="relative flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner sm:p-1.5">
        <img
          src={images[safeIdx]}
          alt={`דוגמת פרויקט ${safeIdx + 1} מתוך ${total}`}
          className="block h-auto w-full max-h-[28rem] rounded-lg object-contain object-center sm:max-h-[32rem] lg:max-h-[36rem] print:max-h-48"
        />
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="תמונה קודמת"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-blue-900 shadow-md hover:bg-white print:hidden"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="תמונה הבאה"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-blue-900 shadow-md hover:bg-white print:hidden"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 print:hidden">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`תמונה ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === safeIdx ? 'w-5 bg-orange-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-slate-500 tabular-nums">
        {safeIdx + 1} / {total}
        <span className="print:hidden"> · לחצו על החצים לעיון</span>
      </p>
      <div className="mt-2 hidden print:grid grid-cols-4 gap-1">
        {images.slice(0, 4).map((src) => (
          <img key={src} src={src} alt="" className="aspect-[4/3] w-full rounded border border-slate-200 object-contain bg-slate-50" />
        ))}
      </div>
    </div>
  );
}

/** גרף תשואה שנתית — סולארי מול נדל״ן ושוק ההון */
function QuoteInvestmentYieldChart({ annualYield }) {
  const solarPct = Math.max(0, Number(annualYield) || 0);
  const scaleMax = Math.max(solarPct, 12, 1);
  const trackPx = 140;
  const bars = [
    {
      label: 'נדל״ן',
      pct: 4,
      range: '3–5%',
      riskLabel: 'סיכון נמוך',
      riskClass: 'text-slate-300 print:text-slate-600',
      barClass: 'bg-gradient-to-t from-slate-500 to-slate-400',
      Icon: Home,
    },
    {
      label: 'שוק ההון',
      pct: 9,
      range: '8–10%',
      riskLabel: 'סיכון בינוני',
      riskClass: 'text-amber-200/90 print:text-amber-800',
      barClass: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
      Icon: TrendingUp,
    },
    {
      label: 'מערכת סולארית',
      pct: solarPct,
      range: `${solarPct.toFixed(1)}%`,
      riskLabel: 'סיכון אפסי',
      riskClass: 'text-emerald-300 print:text-emerald-700',
      barClass: 'bg-gradient-to-t from-orange-500 via-amber-400 to-blue-600',
      highlight: true,
      Icon: Sun,
    },
  ];
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-blue-300/40 bg-gradient-to-br from-[#0c1a33] via-[#122a4d] to-[#0a1628] px-5 py-6 shadow-lg sm:px-8 sm:py-8 print:border-slate-300 print:bg-white print:shadow-none"
      role="img"
      aria-label={`תשואה שנתית: נדלן 3–5 אחוז סיכון נמוך, שוק ההון 8–10 אחוז סיכון בינוני, סולארי ${solarPct.toFixed(1)} אחוז סיכון אפסי`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-52 w-52 rounded-full bg-blue-500/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <div className="relative grid grid-cols-3 gap-3 sm:gap-6">
        {bars.map((bar) => {
          const barPx = Math.round(Math.max(18, (bar.pct / scaleMax) * trackPx));
          const Icon = bar.Icon;
          return (
            <div
              key={bar.label}
              className={`flex flex-col items-center ${bar.highlight ? 'z-10' : ''}`}
            >
              <div
                className={`flex w-full max-w-[7.5rem] flex-col items-center rounded-2xl border px-2 pb-2 pt-3 sm:max-w-[9rem] sm:px-3 ${
                  bar.highlight
                    ? 'border-amber-400/50 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : 'border-white/12 bg-white/5'
                } print:border-slate-200 print:bg-slate-50`}
              >
                <span
                  className={`mb-3 font-black tabular-nums leading-none ${
                    bar.highlight
                      ? 'text-2xl text-amber-300 sm:text-3xl'
                      : 'text-lg text-white/95 sm:text-xl print:text-slate-800'
                  }`}
                >
                  {bar.range}
                </span>
                <div
                  className="relative flex w-full items-end justify-center overflow-hidden rounded-lg bg-black/30"
                  style={{ height: trackPx }}
                >
                  <div
                    className={`w-[72%] min-w-[2.25rem] rounded-t-lg shadow-md ${bar.barClass} ${
                      bar.highlight ? 'ring-2 ring-amber-400/60' : ''
                    }`}
                    style={{ height: barPx }}
                  ></div>
                </div>
              </div>
              <div className="mt-3 flex flex-col items-center gap-1.5">
                <Icon
                  className={`h-6 w-6 shrink-0 sm:h-7 sm:w-7 ${
                    bar.highlight ? 'text-amber-400' : 'text-slate-300 print:text-slate-500'
                  }`}
                  aria-hidden
                />
                <span
                  className={`text-center text-sm font-bold leading-tight sm:text-base ${
                    bar.highlight ? 'text-amber-100 print:text-blue-900' : 'text-slate-200 print:text-slate-600'
                  }`}
                >
                  {bar.label}
                </span>
                <span
                  className={`text-center text-[11px] font-semibold leading-tight sm:text-xs ${bar.riskClass}`}
                >
                  {bar.riskLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** הטבת 7 ימים — רוחב מלא מעל סיכום המחיר */
function QuoteLimitedOfferBanner({ timeLeft, highlightText, whatsappLink }) {
  if (timeLeft.expired) return null;

  const units = [
    { value: timeLeft.days, label: 'ימים' },
    { value: timeLeft.hours, label: 'שע׳' },
    { value: timeLeft.minutes, label: 'דק׳' },
    { value: timeLeft.seconds, label: 'שנ׳' },
  ];

  return (
    <>
      <div
        className="mb-6 print:hidden overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 shadow-md"
        dir="rtl"
      >
        <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-center sm:px-6">
          <p className="text-xs font-bold tracking-wide text-amber-200 sm:text-sm">הטבה דחופה · 7 ימים בלבד</p>
        </div>
        <div className="space-y-4 px-4 py-4 text-center sm:px-6 sm:py-5">
          <p className="mx-auto max-w-2xl text-sm font-semibold leading-relaxed text-white sm:text-base">
            אישור הצעה השבוע ={' '}
            <span className="font-bold text-amber-200">{highlightText}</span> במתנה
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr" aria-label="זמן שנותר להטבה">
            {units.map((u, i) => (
              <React.Fragment key={u.label}>
                {i > 0 ? <span className="px-0.5 text-lg font-bold text-amber-500/60">:</span> : null}
                <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg border border-white/10 bg-slate-900/90 px-2 py-1.5 shadow-inner">
                  <span className="text-lg font-black tabular-nums leading-none text-white sm:text-xl">
                    {String(u.value).padStart(2, '0')}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold text-amber-200/90">{u.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition-colors hover:bg-amber-400 sm:text-base"
          >
            <Gift className="h-5 w-5 shrink-0" aria-hidden />
            לקבלת ההטבה
          </a>
        </div>
      </div>
      <div className="mb-4 hidden rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-slate-800 print:block">
        <span className="font-bold text-amber-800">הטבה ל-7 ימים:</span> אישור הצעה = {highlightText} במתנה
      </div>
    </>
  );
}

/** תווית סוג מערכת בכריכת ההצעה — לפי בחירת הסוכן בלבד */
function formatQuoteHeroSystemTypeLabel(quote) {
  const scaleType = quote?.systemType === 'commercial' ? 'מסחרית' : 'ביתית';
  const inverterType = quote?.inverterSystemType === 'hybrid' ? 'היברידית' : 'On Grid';
  return `מערכת אנרגיה סולארית ${scaleType} — ${inverterType}`;
}

function QuoteSystemSpecSummary({ quote }) {
  if (!quote) return null;
  const inverterSummary = (quote.inverterDetailsList || [])
    .map((inv) => `${inv.name}${inv.quantity > 1 ? ` ×${inv.quantity}` : ''}`)
    .join(' · ');
  const batterySummary = aggregateBatteryStorageSummary(quote.batteryDetailsList);
  const rows = [
    { label: 'הספק DC', value: `${quote.systemSizeKw} kWp`, Icon: Zap, iconClass: 'text-orange-400' },
    { label: 'הספק AC', value: `${quote.systemSizeAcKw} kWp`, Icon: Activity, iconClass: 'text-sky-400' },
    {
      label: 'פאנלים',
      value: `${quote.calculatedNumPanels} × ${quote.panelPowerWatts}W`,
      Icon: Sun,
      iconClass: 'text-amber-300',
    },
    {
      label: 'סוג פרויקט',
      value: quote.systemType === 'commercial' ? 'מסחרית' : 'ביתית',
      Icon: Home,
      iconClass: 'text-blue-300',
    },
    {
      label: 'סוג ממיר',
      value: quote.inverterSystemType === 'hybrid' ? 'היברידי' : 'אונגריד',
      Icon: BatteryCharging,
      iconClass: 'text-emerald-400',
    },
    {
      label: 'חיבור חשמל נדרש',
      value: `3×${quote.requiredConnectionAmps}A`,
      Icon: Zap,
      iconClass: 'text-violet-300',
    },
  ];
  if (batterySummary && batterySummary.totalUnits > 0) {
    rows.push({
      label: 'אגירה כוללת',
      value: batterySummary.totalKwh > 0 ? `${batterySummary.totalKwh} kWh` : `${batterySummary.totalUnits} יח׳`,
      Icon: BatteryCharging,
      iconClass: 'text-emerald-300',
    });
  }
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-blue-400/35 bg-gradient-to-br from-[#0e2240] via-[#153560] to-[#0c1a30] p-5 shadow-lg sm:p-6 print:border-slate-300 print:bg-white print:shadow-none">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute -bottom-10 -left-6 h-40 w-40 rounded-full bg-blue-400/20 blur-3xl" />
        <Sun className="absolute left-5 top-5 h-14 w-14 text-amber-400/10 sm:h-16 sm:w-16" />
      </div>
      <h3 className="relative mb-4 text-xl font-black text-white sm:text-2xl print:text-blue-900">פירוט המערכת</h3>
      <dl className={`relative grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${rows.length > 6 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        {rows.map((row) => {
          const Icon = row.Icon;
          return (
            <div
              key={row.label}
              className="rounded-xl border border-white/12 bg-white/10 px-3 py-3 text-right backdrop-blur-sm transition-colors hover:bg-white/15 sm:px-4 sm:py-4 print:border-slate-200 print:bg-slate-50"
            >
              <Icon className={`mb-2 h-5 w-5 sm:h-6 sm:w-6 ${row.iconClass} print:text-blue-600`} aria-hidden />
              <dt className="text-xs font-semibold text-blue-100/85 sm:text-sm print:text-slate-500">{row.label}</dt>
              <dd className="mt-1 text-base font-black tabular-nums leading-tight text-white sm:text-lg print:text-slate-900">
                {row.value}
              </dd>
            </div>
          );
        })}
      </dl>
      {(inverterSummary || (quote.includesOptimizers && quote.optimizerDetails?.type)) && (
        <div className="relative mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base print:border-slate-200 print:bg-slate-50">
          {inverterSummary ? (
            <p className="leading-relaxed text-blue-50 print:text-slate-700">
              <span className="font-bold text-amber-200 print:text-blue-900">דגמי ממירים:</span>{' '}
              <span className="font-semibold text-white print:text-slate-800">{inverterSummary}</span>
            </p>
          ) : null}
          {quote.includesOptimizers && quote.optimizerDetails?.type ? (
            <p className="leading-relaxed text-blue-50 print:text-slate-700">
              <span className="font-bold text-amber-200 print:text-blue-900">אופטימייזרים:</span>{' '}
              <span className="font-semibold text-white print:text-slate-800">
                {quote.optimizerDetails.type}
                {quote.optimizerDetails.quantity > 0 ? ` · ${quote.optimizerDetails.quantity} יח׳` : ''}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function quoteHasMultipleOrientations(quote) {
  const od = quote?.orientationDetails;
  if (!quote?.specifyOrientation || !od) return false;
  return [od.pSouth, od.pEW, od.pNorth].filter((n) => Number(n) > 0).length >= 2;
}

function QuoteFinancialHighlights({ quote }) {
  if (!quote) return null;
  const showOrientationBreakdown = quoteHasMultipleOrientations(quote);
  const od = quote.orientationDetails;

  return (
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      {!showOrientationBreakdown && (
        <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-center text-white shadow-lg sm:p-5">
          <Zap className="mb-2 h-7 w-7 shrink-0 text-orange-400" />
          <p className="text-xs font-medium text-slate-400">הספק (DC)</p>
          <p className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">{quote.systemSizeKw}</p>
          <p className="text-xs font-bold text-slate-400">kWp · AC {quote.systemSizeAcKw}</p>
        </div>
      )}
      <div
        className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-center text-white shadow-lg sm:p-5 ${
          showOrientationBreakdown ? 'min-[400px]:col-span-2' : 'items-center'
        }`}
      >
        <Activity className={`mb-2 h-7 w-7 shrink-0 text-blue-400 ${showOrientationBreakdown ? 'mx-auto' : ''}`} />
        <p className="text-xs font-medium text-slate-400">ייצור שנתי</p>
        <p className="mt-1 max-w-full break-words text-xl font-black tabular-nums sm:text-2xl">
          {Math.round(quote.estimatedYearlyProductionKwh).toLocaleString('en-US')}
        </p>
        <p className="text-xs font-bold text-slate-400">
          קוט&quot;ש · ממוצע {Math.round(quote.productionHoursValid)} שעות
        </p>
        {showOrientationBreakdown && od ? (
          <div className="mt-3 w-full space-y-1.5 rounded-lg border border-slate-700/50 bg-slate-900/50 p-2.5 text-right text-[11px] text-slate-400">
            <p className="mb-1 border-b border-slate-700/50 pb-1 text-center font-bold text-slate-500">
              פירוט שעות לפי כיוונים
            </p>
            {od.pSouth > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>דרום ({od.pSouth} יח&apos;)</span>
                <span className="shrink-0 font-semibold text-slate-300">{Math.round(od.southHours)} שעות</span>
              </div>
            ) : null}
            {od.pEW > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>מזרח/מערב ({od.pEW} יח&apos;)</span>
                <span className="shrink-0 font-semibold text-slate-300">{Math.round(od.ewHours)} שעות</span>
              </div>
            ) : null}
            {od.pNorth > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>צפון ({od.pNorth} יח&apos;)</span>
                <span className="shrink-0 font-semibold text-slate-300">{Math.round(od.northHours)} שעות</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-center text-white shadow-lg sm:p-5">
        <ShekelIcon className="mb-2 text-3xl text-green-400" />
        <p className="text-xs font-medium text-slate-400">הכנסה שנתית צפויה</p>
        <p className="mt-1 text-xl font-black tabular-nums text-green-400 sm:text-2xl">
          ₪{Math.round(quote.estimatedYearlySavings).toLocaleString('en-US')}
        </p>
        <p className="text-[11px] font-semibold text-slate-400">
          תעריף: {Number((quote.calculatedTariff > 0 ? quote.calculatedTariff * 100 : 0).toFixed(2))} אג&apos;
          {quote.hasUrbanPremium && quote.urbanPremiumValidUntilYear
            ? ` (פרמיה עד ${quote.urbanPremiumValidUntilYear})`
            : ''}
        </p>
      </div>
      <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-center text-white shadow-lg sm:p-5">
        <Clock className="mb-2 h-7 w-7 shrink-0 text-blue-400" />
        <p className="text-xs font-medium text-slate-400">החזר השקעה</p>
        <p className="mt-1 flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0 text-2xl font-black tabular-nums sm:text-3xl">
          <span>{quote.roiYears > 0 && isFinite(quote.roiYears) ? quote.roiYears.toFixed(1) : '—'}</span>
          {quote.roiYears > 0 && isFinite(quote.roiYears) ? (
            <span className="text-base font-bold text-slate-200 sm:text-lg">שנים</span>
          ) : null}
        </p>
        <p className="mt-2 text-sm font-black text-green-400 sm:text-base md:text-lg print:text-green-700">
          תשואה שנתית {quote.annualYield ? quote.annualYield.toFixed(1) : 0}%
        </p>
      </div>
    </div>
  );
}

function getVatRatePercent(adminPrices) {
  return Number(adminPrices?.vatRate) || 18;
}

function isResidentialQuote(quote) {
  return quote?.systemType === 'residential';
}

/** סכום מומלץ ללקוח: ביתי כולל מע״מ, מסחרי לפני מע״מ */
function getCalculatedClientOfferPrice(quote, adminPrices) {
  const beforeVat = Number(quote?.breakdown?.finalPrice) || 0;
  if (!isResidentialQuote(quote)) return Math.round(beforeVat);
  const vat = getVatRatePercent(adminPrices);
  return Math.round(beforeVat * (1 + vat / 100));
}

function getQuoteIncomeGetters(quote) {
  const degradationRate = 0.0033;
  const baseTariff = quote.baseCalculatedTariff;
  const hasUrbanPremium = quote.hasUrbanPremium;
  const projectionStartYear = quote.projectionStartYear;
  const year1Production = quote.estimatedYearlyProductionKwh;

  const getTariffForModelYear = (modelYear) =>
    getEffectiveTariffForCalendarYear(
      baseTariff,
      hasUrbanPremium,
      projectionStartYear + modelYear - 1
    );
  const getYearlyProductionKwh = (modelYear) =>
    year1Production * Math.pow(1 - degradationRate, modelYear - 1);
  const getYearlyEstimatedIncome = (modelYear) =>
    getYearlyProductionKwh(modelYear) * getTariffForModelYear(modelYear);

  return { getYearlyEstimatedIncome };
}

function recomputeInvestmentMetrics(quote, initialInvestment, adminPrices) {
  const { getYearlyEstimatedIncome } = getQuoteIncomeGetters(quote);
  const estimatedYearlySavingsYear1 = getYearlyEstimatedIncome(1);

  let roiYears = 0;
  let annualYield = 0;
  if (estimatedYearlySavingsYear1 > 0 && initialInvestment > 0) {
    annualYield = (estimatedYearlySavingsYear1 / initialInvestment) * 100;
    let cumulativeSavings = 0;
    for (let y = 1; y <= 25; y++) {
      const yearIncome = getYearlyEstimatedIncome(y);
      if (yearIncome <= 0) continue;
      const prevCumulative = cumulativeSavings;
      cumulativeSavings += yearIncome;
      if (cumulativeSavings >= initialInvestment) {
        roiYears = y - 1 + (initialInvestment - prevCumulative) / yearIncome;
        break;
      }
    }
  }

  const primeRate = quote.loanSettings?.primeRate ?? (Number(adminPrices.primeRate) || 6);
  const loanMargin = quote.loanSettings?.loanMargin ?? (Number(adminPrices.loanMargin) || 4);
  const annualInterestRate = (primeRate + loanMargin) / 100;

  let remainingDebt = initialInvestment;
  const loanSimulation = [];
  for (let year = 1; year <= 25; year++) {
    const currentYearIncome = getYearlyEstimatedIncome(year);
    let yearlyRepaymentAccumulator = 0;
    const monthlyIncome = currentYearIncome / 12;
    for (let m = 0; m < 12; m++) {
      if (remainingDebt > 0) {
        const interestAccrued = remainingDebt * (annualInterestRate / 12);
        remainingDebt += interestAccrued;
        if (monthlyIncome >= remainingDebt) {
          yearlyRepaymentAccumulator += remainingDebt;
          remainingDebt = 0;
        } else {
          yearlyRepaymentAccumulator += monthlyIncome;
          remainingDebt -= monthlyIncome;
        }
      }
    }
    loanSimulation.push({
      year,
      income: currentYearIncome,
      repayment: yearlyRepaymentAccumulator,
      netProfit: currentYearIncome - yearlyRepaymentAccumulator,
    });
  }

  const getCumulativeIncomeWithDegradation = (years) => {
    let total = 0;
    for (let i = 1; i <= years; i++) total += getYearlyEstimatedIncome(i);
    return total;
  };

  const graphData = [
    { year: 0, flow: -initialInvestment },
    { year: 5, flow: getCumulativeIncomeWithDegradation(5) - initialInvestment },
    { year: 10, flow: getCumulativeIncomeWithDegradation(10) - initialInvestment },
    { year: 15, flow: getCumulativeIncomeWithDegradation(15) - initialInvestment },
    { year: 20, flow: getCumulativeIncomeWithDegradation(20) - initialInvestment },
    { year: 25, flow: getCumulativeIncomeWithDegradation(25) - initialInvestment },
  ];
  const maxProfit = Math.max(1, ...graphData.map((d) => d.flow || 0));
  const minLoss = Math.min(0, ...graphData.map((d) => d.flow || 0));

  return {
    estimatedYearlySavings: estimatedYearlySavingsYear1,
    roiYears,
    annualYield,
    loanSimulation,
    graphData,
    maxProfit,
    minLoss,
  };
}

/** מעדכן פרמיה אורבנית ומספרים כלכליים לפי יישוב הלקוח (גם בהצעה משותפת שמורה) */
function applyUrbanPremiumToQuote(quote, cityList, adminPrices) {
  if (!quote || quote.baseCalculatedTariff == null) return quote;

  const urbanMatch = resolveUrbanPremiumFromCity(quote.clientCity, cityList);
  const hasUrbanPremium = urbanMatch.eligible;
  const projectionStartYear = quote.projectionStartYear ?? new Date().getFullYear();
  const getTariffForModelYear = (modelYear) =>
    getEffectiveTariffForCalendarYear(
      quote.baseCalculatedTariff,
      hasUrbanPremium,
      projectionStartYear + modelYear - 1
    );
  const calculatedTariff = getTariffForModelYear(1);

  const withPremium = {
    ...quote,
    hasUrbanPremium,
    urbanPremiumMatchedCity: urbanMatch.matchedCity,
    urbanPremiumAgorotPerKwh: hasUrbanPremium ? URBAN_PREMIUM_AGOROT_PER_KWH : 0,
    urbanPremiumValidUntilYear: hasUrbanPremium ? URBAN_PREMIUM_VALID_UNTIL_YEAR : null,
    calculatedTariff,
  };

  const finalPrice = Number(withPremium.breakdown?.finalPrice) || 0;
  const vat = getVatRatePercent(adminPrices);
  const initialInvestment = isResidentialQuote(withPremium)
    ? withPremium.clientOfferPrice != null
      ? Number(withPremium.clientOfferPrice)
      : Math.round(finalPrice * (1 + vat / 100))
    : finalPrice;

  if (initialInvestment <= 0) return withPremium;

  return { ...withPremium, ...recomputeInvestmentMetrics(withPremium, initialInvestment, adminPrices) };
}

function QuotePricingSummary({ quote, adminPrices, companyPaysFees }) {
  if (!quote?.breakdown) return null;
  const vatRate = getVatRatePercent(adminPrices);
  const isResidential = isResidentialQuote(quote);
  const finalPrice = quote.breakdown.finalPrice;
  const totalWithVat = finalPrice * (1 + vatRate / 100);
  const displayPrice =
    quote.clientOfferPrice != null
      ? quote.clientOfferPrice
      : isResidential
        ? totalWithVat
        : finalPrice;

  return (
    <div className="flex h-full flex-col justify-center rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 to-blue-950 p-6 text-center shadow-lg print:border-blue-200 print:bg-blue-50 print:shadow-none">
      <p className="mb-1 text-base font-bold text-orange-400 print:text-blue-800">השקעה כוללת בפרויקט</p>
      <p className="text-5xl font-black tabular-nums text-white print:text-blue-900 sm:text-6xl">
        ₪{displayPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
      <p className="mb-4 text-sm text-slate-400 print:text-slate-500">
        {isResidential ? 'סה״כ לתשלום (כולל מע״מ)' : 'לפני מע״מ'}
      </p>
      <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300 print:border-blue-200 print:bg-white print:text-blue-900">
        {quote.includesWashing && (
          <div className="mb-2 flex justify-between border-b border-slate-600 pb-2 print:border-blue-200">
            <span className="font-semibold text-green-400 print:text-green-700">מערכת שטיפה אוטומטית</span>
            <span className="shrink-0 font-bold text-green-300 print:text-green-700">במתנה</span>
          </div>
        )}
        {companyPaysFees && (
          <div className="mb-2 flex justify-between border-b border-slate-600 pb-2 print:border-blue-200">
            <span className="font-semibold text-green-400 print:text-green-700">אגרות חח״י ורשויות</span>
            <span className="shrink-0 font-bold text-green-300 print:text-green-700">במתנה</span>
          </div>
        )}
        {isResidential ? (
          <>
            <div className="flex justify-between">
              <span>לפני מע״מ</span>
              <span className="tabular-nums">
                ₪
                {(
                  quote.clientOfferPrice != null
                    ? Math.round(quote.clientOfferPrice / (1 + vatRate / 100))
                    : finalPrice
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>מע״מ ({vatRate}%)</span>
              <span className="tabular-nums">
                ₪
                {(
                  quote.clientOfferPrice != null
                    ? quote.clientOfferPrice - Math.round(quote.clientOfferPrice / (1 + vatRate / 100))
                    : finalPrice * (vatRate / 100)
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span>מע״מ ({vatRate}%)</span>
              <span className="tabular-nums">₪{(finalPrice * (vatRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-bold print:border-blue-200">
              <span>סה״כ כולל מע״מ</span>
              <span className="tabular-nums">
                ₪
                {(
                  quote.clientOfferPrice != null
                    ? Math.round(quote.clientOfferPrice * (1 + vatRate / 100))
                    : totalWithVat
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuotePriceConfirmPanel({
  quoteDraft,
  adminPrices,
  offerPriceInput,
  onOfferPriceInputChange,
  onConfirm,
  onBack,
  errorMsg,
  showInternalCosts = false,
}) {
  if (!quoteDraft?.breakdown) return null;
  const vatRate = getVatRatePercent(adminPrices);
  const isResidential = isResidentialQuote(quoteDraft);
  const b = quoteDraft.breakdown;
  const beforeVat = Number(b.finalPrice) || 0;
  const vatAmount = beforeVat * (vatRate / 100);
  const recommended = getCalculatedClientOfferPrice(quoteDraft, adminPrices);
  const priceLabel = isResidential ? 'כולל מע״מ' : 'לפני מע״מ';

  const breakdownRows = showInternalCosts
    ? [
        { label: 'פאנלים', value: b.panels },
        { label: 'קונסטרוקציה', value: b.construction },
        { label: 'ממירים', value: b.inverter },
        { label: 'סוללות', value: b.batteries },
        { label: 'אופטימייזרים', value: b.optimizers },
        { label: 'לוגיסטיקה', value: b.logistics },
        { label: 'עבודה', value: b.labor },
        { label: 'הנדסה', value: b.engineering },
        { label: 'חשמלאי ובדיקות', value: b.electricianAndChecks },
        { label: 'לוחות חשמל', value: b.electricalBoxes },
        { label: 'אביזרים', value: b.accessories },
        { label: 'שטיפה', value: b.washing },
        { label: 'אגרות', value: b.fees },
      ].filter((row) => row.value > 0)
    : [];

  const clientPriceCard = (
    <div
      className={`rounded-2xl border border-orange-500/35 bg-gradient-to-br from-orange-950/30 to-slate-900/50 p-6 ${
        showInternalCosts ? '' : 'mx-auto max-w-xl'
      }`}
    >
          <p className="text-sm font-semibold text-orange-200">סכום מומלץ ללקוח ({priceLabel})</p>
          <p className="mt-2 text-4xl font-black tabular-nums text-white">
            ₪{recommended.toLocaleString('he-IL')}
          </p>
          <label className="mt-6 block text-sm font-bold text-slate-200">
            איזה מחיר להציע ללקוח בהצעה? ({priceLabel})
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-black text-orange-400">₪</span>
            <input
              type="number"
              min="1"
              step="100"
              value={offerPriceInput}
              onChange={(e) => onOfferPriceInputChange(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-xl border border-orange-400/40 bg-black/30 px-4 py-3 text-2xl font-black tabular-nums text-white outline-none focus:border-orange-400"
            />
          </div>
      <p className="mt-3 text-xs text-slate-400">
        ניתן להוריד או להעלות לפי שיקול דעתכם — המחיר שתאשרו יופיע בהצעה הסופית (תשואה, מימון וכו׳ יחושבו מחדש לפי הסכום).
      </p>
    </div>
  );

  return (
    <div className="animation-fade-in space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h2 className="text-2xl font-black text-white">סיכום מחיר לפני הצעה ללקוח</h2>
        <p className="mt-2 text-sm text-slate-400">
          {showInternalCosts
            ? 'המערכת חישבה עלויות, רווח ומע״מ (אם רלוונטי). בדקו את הסכום המומלץ, והזינו את המחיר שתציעו ללקוח בהצעה.'
            : 'המערכת חישבה את הסכום המומלץ ללקוח. בדקו והזינו את המחיר שתציעו בהצעה.'}
        </p>
        <p className="mt-1 text-xs text-blue-300/90">
          {isResidential ? 'מערכת ביתית — הסכום ללקוח כולל מע״מ' : 'מערכת מסחרית — הסכום ללקוח לפני מע״מ'}
        </p>
      </div>

      {showInternalCosts ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
            <h3 className="mb-4 text-lg font-bold text-blue-200">פירוט עלויות ורווח (מנהל בלבד)</h3>
            <ul className="space-y-2 text-sm">
              {breakdownRows.map((row) => (
                <li key={row.label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-semibold tabular-nums text-slate-200">
                    ₪{Math.round(row.value).toLocaleString('he-IL')}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-4 border-b border-white/10 pb-2 pt-1">
                <span className="text-slate-300">סה״כ עלות (לפני רווח)</span>
                <span className="font-bold tabular-nums text-slate-100">
                  ₪{Math.round(b.totalCost).toLocaleString('he-IL')}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <span className="text-emerald-400/90">רווח החברה</span>
                <span className="font-bold tabular-nums text-emerald-300">
                  ₪{Math.round(b.marginValue).toLocaleString('he-IL')}
                </span>
              </li>
              <li className="flex justify-between gap-4 pb-2">
                <span className="text-slate-300">מחיר לפני מע״מ</span>
                <span className="font-bold tabular-nums text-white">
                  ₪{Math.round(beforeVat).toLocaleString('he-IL')}
                </span>
              </li>
              {isResidential ? (
                <li className="flex justify-between gap-4">
                  <span className="text-slate-400">מע״מ ({vatRate}%)</span>
                  <span className="font-semibold tabular-nums text-slate-200">
                    ₪{Math.round(vatAmount).toLocaleString('he-IL')}
                  </span>
                </li>
              ) : (
                <li className="flex justify-between gap-4 text-xs text-slate-500">
                  <span>מע״מ ({vatRate}%) — לא נכלל בסכום ללקוח</span>
                  <span className="tabular-nums">₪{Math.round(vatAmount).toLocaleString('he-IL')}</span>
                </li>
              )}
            </ul>
          </div>
          {clientPriceCard}
        </div>
      ) : (
        clientPriceCard
      )}

      {errorMsg ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5"
        >
          חזרה לעריכת הנתונים
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-2xl px-8 py-4 text-lg font-black text-slate-900 shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 50%, #f97316 100%)',
          }}
        >
          אשר מחיר והפק הצעה ללקוח
        </button>
      </div>
    </div>
  );
}

function parseBatteryKwhFromName(name) {
  const m = String(name || '').match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

function detectBatteryBrandLabel(name) {
  const s = String(name || '').toLowerCase();
  if (/growatt|גרואט|גרוואט/.test(s)) return 'GROWATT';
  if (/solaredge|סולאראדג/.test(s)) return 'SolarEdge';
  if (/byd/.test(s)) return 'BYD';
  if (/deye/.test(s)) return 'Deye';
  return null;
}

function batteryBrandLogoSrc(brandLabel) {
  if (brandLabel === 'GROWATT') return inverterLogoSrc('growatt');
  if (brandLabel === 'SolarEdge') return inverterLogoSrc('solaredge');
  return null;
}

function aggregateBatteryStorageSummary(batteryDetailsList) {
  if (!batteryDetailsList?.length) return null;
  const merged = new Map();
  for (const bat of batteryDetailsList) {
    const qty = Number(bat.quantity) || 0;
    if (qty <= 0) continue;
    const prev = merged.get(bat.id);
    if (prev) prev.quantity += qty;
    else merged.set(bat.id, { ...bat, quantity: qty });
  }
  const rows = Array.from(merged.values());
  if (!rows.length) return null;

  let totalKwh = 0;
  let totalUnits = 0;
  const brands = new Set();
  let logo = null;
  let datasheet = null;
  const primaryName = rows[0].name;

  for (const row of rows) {
    const unitKwh = row.unitKwh ?? parseBatteryKwhFromName(row.name);
    totalUnits += row.quantity;
    if (unitKwh) totalKwh += unitKwh * row.quantity;
    const brand = detectBatteryBrandLabel(row.name);
    if (brand) brands.add(brand);
    if (!logo && row.logo) logo = row.logo;
    if (!datasheet && row.datasheet) datasheet = row.datasheet;
  }

  const brandLabel =
    brands.size === 1 ? [...brands][0] : brands.size > 1 ? 'מערכת אגירה' : detectBatteryBrandLabel(primaryName);

  return {
    brandLabel: brandLabel || 'אגירה',
    totalKwh,
    totalUnits,
    primaryName,
    logo,
    datasheet,
    rowCount: rows.length,
  };
}

function QuoteBatteryStorageSummary({ summary, onOpenDatasheet }) {
  if (!summary) return null;
  const logoSrc = datasheetToSrc(normalizeDatasheet(summary.logo)) || batteryBrandLogoSrc(summary.brandLabel);
  const inner = (
    <>
      {logoSrc ? (
        <img src={logoSrc} alt="" className="h-12 w-12 rounded-xl border border-blue-100 bg-white object-contain p-1 shadow-inner" />
      ) : (
        <BatteryCharging className="h-12 w-12 text-blue-600" aria-hidden />
      )}
      <div className="min-w-0 flex-1 text-right">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">סוללות אגירה</p>
        <p className="text-lg font-black leading-tight text-blue-950 md:text-xl">
          {summary.totalKwh > 0 ? `${summary.totalKwh} kWh` : summary.primaryName}
          {summary.brandLabel ? (
            <span className="text-base font-extrabold text-blue-800"> · {summary.brandLabel}</span>
          ) : null}
        </p>
        {summary.totalUnits > 0 ? (
          <p className="text-xs font-medium text-slate-600">{summary.totalUnits} יחידות אגירה במערכת</p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="mx-auto mt-4 max-w-2xl print:max-w-full">
      {summary.datasheet ? (
        <button
          type="button"
          onClick={() => onOpenDatasheet(`מפרט טכני — ${summary.brandLabel}`, summary.datasheet)}
          className="flex w-full items-center gap-4 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-right shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 print:pointer-events-none print:border-slate-200"
        >
          {inner}
          <span className="shrink-0 text-xs font-bold text-orange-600 print:hidden">מפרט</span>
        </button>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm print:border-slate-200">
          {inner}
        </div>
      )}
    </div>
  );
}

const BrandLogoSvg = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="50" cy="45" r="35" fill="url(#sun-grad)"/>
    <path d="M10 65 L90 65 L80 95 L20 95 Z" fill="#0D47A1"/>
    <path d="M30 65 L25 95 M50 65 L50 95 M70 65 L75 95" stroke="#64B5F6" strokeWidth="2"/>
    <path d="M15 80 L85 80" stroke="#64B5F6" strokeWidth="2"/>
    <path d="M50 95 C 100 95 100 45 90 35 C 80 85 50 95 50 95 Z" fill="#4CAF50"/>
    <defs>
      <linearGradient id="sun-grad" x1="50" y1="10" x2="50" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB300" />
        <stop offset="1" stopColor="#FF5252" />
      </linearGradient>
    </defs>
  </svg>
);

/** לוגו החברה (`public/brand-logo.png`); נופל חזרה ל-SVG פשוט אם הקובץ חסר */
const BrandLogo = ({ className }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) return <BrandLogoSvg className={className} />;
  return (
    <img
      src={`${process.env.PUBLIC_URL}/brand-logo.png`}
      alt="מומחי אנרגיה סולארית"
      className={className}
      onError={() => setImgFailed(true)}
    />
  );
};

/** לוגו בכריכה — גודל תצוגה ≤ מקור (212px) לחדות, בלי blend */
function BrandLogoCover({ className = '' }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) {
    return <BrandLogoSvg className={`h-full w-full ${className}`.trim()} />;
  }
  return (
    <img
      src={`${process.env.PUBLIC_URL}/brand-logo.png`}
      alt="מומחי אנרגיה סולארית"
      width={212}
      height={212}
      decoding="async"
      fetchPriority="high"
      className={`h-auto w-auto max-h-full max-w-full object-contain object-center drop-shadow-[0_6px_28px_rgba(0,0,0,0.75)] ${className}`.trim()}
      onError={() => setImgFailed(true)}
    />
  );
}

/** לוגואי יצרני ממירים ב־`public/inverters` (מקור: לוגואים ממירים.docx) */
const INVERTER_LOGO_KEYS = ['sungrow', 'solaredge', 'growatt', 'solis'];

function inverterLogoSrc(slug) {
  if (!slug || !INVERTER_LOGO_KEYS.includes(slug)) return null;
  return `${process.env.PUBLIC_URL}/inverters/${slug}.png`;
}

function inferInverterLogoSlug(name, isSolarEdge) {
  const raw = String(name || '');
  const lower = raw.toLowerCase();
  if (isSolarEdge || /solaredge|סולאראדג/.test(raw)) return 'solaredge';
  if (/sungrow/.test(lower) || /סנגרואו|סאנגר/.test(raw)) return 'sungrow';
  if (/growatt/.test(lower) || /גרואט|גרוואט/.test(raw)) return 'growatt';
  if (/solis/.test(lower) || /סוליס/.test(raw)) return 'solis';
  return null;
}

function resolveInverterLogoSlug(inv) {
  const manual = inv.inverterLogoKey || 'auto';
  if (manual === 'none') return null;
  if (manual !== 'auto') return INVERTER_LOGO_KEYS.includes(manual) ? manual : null;
  return inferInverterLogoSlug(inv.name, inv.isSolarEdge);
}

/** סטטיסטיקת לוגואים להצגה בהצעת מחיר (ממוזג לפי סוג לוגו + סכום כמויות) */
/** כותרת סקשן ציוד: «פאנלים, ממירים ואופטימייזרים בהצעה» */
function joinHebrewEquipmentTitle(parts) {
  const p = (parts || []).filter(Boolean);
  if (!p.length) return 'רכיבים בהצעה';
  if (p.length === 1) return `${p[0]} בהצעה`;
  if (p.length === 2) return `${p[0]} ו${p[1]} בהצעה`;
  return `${p.slice(0, -1).join(', ')} ו${p[p.length - 1]} בהצעה`;
}

/** דאטהשיט / לוגו — base64 מקומי או storagePath מהענן */
function normalizeDatasheet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { fileName, mimeType, dataBase64, storagePath } = raw;
  if (storagePath && typeof storagePath === 'string') {
    return {
      fileName: typeof fileName === 'string' ? fileName : 'datasheet',
      mimeType: typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      storagePath,
    };
  }
  if (!dataBase64 || typeof dataBase64 !== 'string' || !mimeType || typeof mimeType !== 'string') return null;
  return {
    fileName: typeof fileName === 'string' ? fileName : 'datasheet',
    mimeType,
    dataBase64,
  };
}

function datasheetToSrc(ds) {
  const n = normalizeDatasheet(ds);
  if (!n) return null;
  if (n.storagePath) return publicAdminAssetUrl(n.storagePath);
  return `data:${n.mimeType};base64,${n.dataBase64}`;
}

function isDatasheetViewable(ds) {
  return Boolean(datasheetToSrc(ds));
}

/** כיתוב + «לחץ לצפייה במפרט» — כפתור שלם (גם בנייד, לא רק על הלוגו) */
function QuoteEquipDatasheetCaption({ datasheet, datasheetTitle, onOpen, children }) {
  if (!isDatasheetViewable(datasheet)) {
    return <span className={QUOTE_EQUIP_BELOW_CAPTION_CLASS}>{children}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(datasheetTitle, datasheet)}
      className={`${QUOTE_EQUIP_BELOW_CAPTION_CLASS} w-full max-w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 text-inherit transition-colors hover:text-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 active:text-orange-300 print:pointer-events-none print:cursor-default`}
    >
      {children}
      <span className={QUOTE_EQUIP_BELOW_HINT_CLASS}>לחץ לצפייה במפרט</span>
    </button>
  );
}

function aggregateInverterLogosForQuote(inverterDetailsList) {
  const map = new Map();
  (inverterDetailsList || []).forEach((row) => {
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) return;

    const custom = normalizeDatasheet(row.customLogo);
    const hasCustomImg = Boolean(custom?.mimeType?.startsWith('image/'));
    let aggregateKey;
    let imageSrc;

    if (hasCustomImg) {
      aggregateKey = `custom:${row.id}`;
      imageSrc = datasheetToSrc(custom);
      if (!imageSrc) return;
    } else {
      const slug = row.logoSlug;
      if (!slug || !inverterLogoSrc(slug)) return;
      aggregateKey = slug;
      imageSrc = inverterLogoSrc(slug);
    }

    const prev = map.get(aggregateKey);
    if (prev) {
      prev.quantity += qty;
      if (!prev.datasheet && row.datasheet) prev.datasheet = row.datasheet;
    } else {
      map.set(aggregateKey, {
        aggregateKey,
        imageSrc,
        quantity: qty,
        displayName: row.name,
        datasheet: normalizeDatasheet(row.datasheet),
      });
    }
  });
  return [...map.values()];
}

const DATASHEET_MAX_BYTES = 8 * 1024 * 1024;
const QUOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** ריבוע אחיד ללוגואים בהצעת מחיר (contain בתוך הריבוע) */
const QUOTE_LOGO_CANVAS_PX = 480;
/** תמונת יועץ מכירות — ריבוע לפריסה עקבית */
const QUOTE_AGENT_PHOTO_PX = 320;

/**
 * תמונות / לוגואים — נירמול אוטומטי לריבוע קבוע (JPEG) לצורך הצעת מחיר.
 * @param {'logo'|'avatar'} variant
 */
function readFileAsNormalizedQuoteRaster(file, variant = 'logo') {
  const box = variant === 'avatar' ? QUOTE_AGENT_PHOTO_PX : QUOTE_LOGO_CANVAS_PX;
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      reject(new Error('קובץ לא תקין'));
      return;
    }
    if (file.size > QUOTE_IMAGE_MAX_BYTES) {
      reject(new Error('התמונה גדולה מדי (מקסימום 5MB).'));
      return;
    }
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('יש להעלות קובץ תמונה בלבד (PNG, JPG, WEBP…).'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = box;
        canvas.height = box;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, box, box);
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          URL.revokeObjectURL(url);
          reject(new Error('מימדי התמונה לא זוהו'));
          return;
        }
        const scale = Math.min(box / iw, box / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (box - dw) / 2;
        const dy = (box - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('יצוא התמונה נכשל'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result;
              if (typeof res !== 'string') {
                reject(new Error('קריאת הקובץ נכשלה'));
                return;
              }
              const m = res.match(/^data:([^;]+);base64,(.+)$/);
              if (!m) {
                reject(new Error('פורמט לא צפוי אחרי נירמול'));
                return;
              }
              const stem = String(file.name || 'logo').replace(/\.[^.]+$/, '') || 'logo';
              resolve({
                fileName: `${stem}-quote.jpg`,
                mimeType: 'image/jpeg',
                dataBase64: m[2],
              });
            };
            reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.88
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('לא ניתן לטעון את התמונה'));
    };
    img.src = url;
  });
}

/** דאטהשיט: PDF וכו׳ כמו שהם; תמונה — נירמול כמו לוגו להצעה */
async function readAdminDatasheetFileSmart(file) {
  if (file?.type?.startsWith('image/')) {
    return readFileAsNormalizedQuoteRaster(file, 'logo');
  }
  return readFileAsDatasheet(file);
}

function readFileAsDatasheet(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      reject(new Error('קובץ לא תקין'));
      return;
    }
    if (file.size > DATASHEET_MAX_BYTES) {
      reject(new Error('הקובץ גדול מדי (מקסימום 8MB). נסה PDF דחוס או קובץ קטן יותר.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== 'string') {
        reject(new Error('קריאת הקובץ נכשלה'));
        return;
      }
      const m = res.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        reject(new Error('פורמט קובץ לא נתמך'));
        return;
      }
      resolve({
        fileName: file.name || 'datasheet',
        mimeType: m[1] || file.type || 'application/octet-stream',
        dataBase64: m[2]
      });
    };
    reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
    reader.readAsDataURL(file);
  });
}

/** מסמך PDF סטטי מתיקיית public (הצהרות איכות הסביבה וכו׳) */
const ENV_QUALITY_DECLARATIONS_PDF = `${process.env.PUBLIC_URL}/documents/hatsara-misrad-habriyot.pdf`;
const ENV_QUALITY_DECLARATIONS_FILENAME = 'hatsara-misrad-habriyot.pdf';

/** פתיחה ישירה של PDF (דפדפן / מציג מערכת) — במיוחד במובייל */
function openEnvQualityDeclarationsPdf() {
  const url = ENV_QUALITY_DECLARATIONS_PDF;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = ENV_QUALITY_DECLARATIONS_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** צפייה במפרט טכני בהצעת מחיר (מסך מלא + חזרה) */
function QuoteDatasheetViewer({ open, title, datasheet, onClose }) {
  const src = datasheet ? datasheetToSrc(datasheet) : null;
  const isPdf = datasheet?.mimeType?.includes('pdf');
  if (!open) return null;
  if (!src) {
    return (
      <div className="fixed inset-0 z-[220] flex flex-col bg-slate-950 text-white print:hidden" dir="rtl" role="dialog" aria-modal="true">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold">
            חזרה
          </button>
          <span className="text-sm font-bold text-red-200">לא ניתן לטעון את המפרט</span>
        </div>
        <p className="p-6 text-center text-sm text-slate-300">
          הקובץ חסר או לא נגיש. העלו שוב את המפרט בהגדרות אדמין ושמרו לענן.
        </p>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-slate-950 text-white print:hidden" dir="rtl" role="dialog" aria-modal="true" aria-label="מפרט טכני">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
        >
          חזרה
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-bold text-slate-100">{title}</span>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPdf && (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-blue-400/50 bg-blue-600/25 px-3 py-2 text-xs font-bold text-blue-100 hover:bg-blue-600/40"
            >
              פתיחה בחלון חדש
            </a>
          )}
          <a
            href={src}
            download={datasheet.fileName || 'datasheet'}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-600/30"
          >
            הורדה
          </a>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-slate-900 p-2">
        {isPdf ? (
          <iframe title={title} src={src} className="h-full min-h-[50vh] w-full rounded-lg border-0 bg-white" />
        ) : (
          <div className="flex h-full min-h-[50vh] items-center justify-center overflow-auto rounded-lg bg-black/40 p-4">
            <img src={src} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}

/** שורת העלאת דאטהשיט באדמין */
function AdminDatasheetRow({ label, datasheet, onFile, onClear }) {
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-3">
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="max-w-full cursor-pointer text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-500"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        {datasheet?.fileName && <span className="max-w-[220px] truncate text-xs text-emerald-400">{datasheet.fileName}</span>}
        {datasheet && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-red-400 hover:text-red-300">
            הסר קובץ
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">PDF או תמונה עד 8MB — ללא קובץ, לחיצה על התמונה בהצעה לא תעשה כלום.</p>
    </div>
  );
}

/** העלאת לוגו / תמונה — נשמר כ-JPEG מותאם להצעת מחיר */
function AdminLogoRow({ label, logo, onFile, onClear }) {
  const preview = datasheetToSrc(normalizeDatasheet(logo));
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-3">
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="max-w-full cursor-pointer text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-500"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        {logo?.fileName && <span className="max-w-[220px] truncate text-xs text-violet-300">{logo.fileName}</span>}
        {logo && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-red-400 hover:text-red-300">
            הסר לוגו
          </button>
        )}
      </div>
      {preview && (
        <div className="mt-3 flex items-center gap-3">
          <img src={preview} alt="" className="h-16 w-16 rounded-xl border border-white/15 bg-white object-contain p-1" />
          <p className="text-[10px] leading-snug text-slate-500">מוצג כאן אחרי נירמול לגודל אחיד להצעה.</p>
        </div>
      )}
      <p className="mt-1 text-[10px] text-slate-500">עד 5MB — גודל ויחס גובה־רוחב מותאמים אוטומטית.</p>
    </div>
  );
}

// --- רכיב חתימה דיגיטלית (Canvas) ---
const SignaturePad = ({ onSave }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b'; // צבע כחול-אפור כהה (דיו)
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl overflow-hidden mb-4 shadow-lg relative" style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.1)' }}>
        <span className="absolute top-2 right-4 text-slate-300 text-xs select-none pointer-events-none font-medium">חתום כאן...</span>
        <canvas
          ref={canvasRef}
          width={350}
          height={160}
          className="touch-none bg-transparent cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={clearCanvas} className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-colors text-sm border border-slate-200">נקה</button>
        <button type="button" onClick={saveCanvas} className="px-6 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all hover:scale-[1.02] text-sm flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
          <PenTool className="w-4 h-4"/> שמור חתימה
        </button>
      </div>
    </div>
  );
};

/** מפתחות localStorage — תיקיית הפרויקט: הצעות מחיר (לשעבר solar-final) */
const APP_STORAGE_PREFIX = 'hatzaot-mechir';
/** קוד כניסה למנהל (שדה ההתחברות) */
const ADMIN_LOGIN = 'coca';
const ADMIN_SETTINGS_STORAGE_KEY = `${APP_STORAGE_PREFIX}-admin-settings-v1`;
const LOGIN_INPUT_STORAGE_KEY = `${APP_STORAGE_PREFIX}-last-login-input`;
const REMEMBER_LOGIN_STORAGE_KEY = `${APP_STORAGE_PREFIX}-remember-login`;
const LEGACY_STORAGE = {
  admin: 'solar-final-admin-settings-v1',
  login: 'solar-final-last-login-input',
  remember: 'solar-final-remember-login',
};

function migrateLegacyStorageKey(nextKey, legacyKey) {
  if (typeof window === 'undefined') return;
  try {
    const legacy = window.localStorage.getItem(legacyKey);
    if (!legacy || window.localStorage.getItem(nextKey)) return;
    window.localStorage.setItem(nextKey, legacy);
  } catch {
    /* ignore */
  }
}

const DEFAULT_ADMIN_PRICES = {
  panelPricePerWattUsd: 0.11,
  panelPowerWatts: 640,
  /** דאטהשיט לפאנל (סוג יחיד לפי מחירון) — אופציונלי */
  panelDatasheet: null,
  /** לוגו פאנלים בהצעה — JPEG מנורמל מהעלאה */
  panelLogo: null,
  usdExchangeRate: 3.75,
  constructionConcretePerKw: 350,
  constructionOtherPerKw: 200,
  constructionLogo: null,
  constructionDatasheet: null,

  inverters: [
    { id: 'inv-se100', name: 'סולאראדג\' 100kW', cost: 15000, capacityKw: 100, isSolarEdge: true, inverterLogoKey: 'auto', customLogo: null, datasheet: null },
    { id: 'inv-se12', name: 'סולאראדג\' 12kW', cost: 4500, capacityKw: 12, isSolarEdge: true, inverterLogoKey: 'auto', customLogo: null, datasheet: null },
    { id: 'inv-sma110', name: 'SMA 110kW', cost: 14000, capacityKw: 110, isSolarEdge: false, inverterLogoKey: 'none', customLogo: null, datasheet: null }
  ],

  invertersHybrid: [
    { id: 'hinv-se10', name: 'סולאראדג\' Home Hub 10kW', cost: 8500, capacityKw: 10, isSolarEdge: true, inverterLogoKey: 'auto', customLogo: null, datasheet: null },
    { id: 'hinv-deye12', name: 'Deye 12kW', cost: 7000, capacityKw: 12, isSolarEdge: false, inverterLogoKey: 'none', customLogo: null, datasheet: null }
  ],

  batteries: [
    { id: 'bat-se10', name: 'סוללה SolarEdge 10kWh', cost: 18000, logo: null, datasheet: null },
    { id: 'bat-byd5', name: 'סוללה BYD 5kWh', cost: 9500, logo: null, datasheet: null }
  ],

  optimizerPrices: { se1to1: 250, se1to2: 350, tigo: 200, sungrow: 220 },
  optimizerDatasheets: { se1to1: null, se1to2: null, tigo: null, sungrow: null },
  optimizerLogos: { se1to1: null, se1to2: null, tigo: null, sungrow: null },
  logisticsCost: 3100,
  laborPerKwResidential: 650,
  laborPerKwCommercial: 550,
  constructorEngineer: 500,
  hybridBatteryInstallCost: 5700,
  electricalBoxCommercialPerKw: 270, electricalBoxResidential: 870,
  washingSystemBase: 4500, feesCost: 3000, planningCost: 1400, profitResidentialFixed: 21000, profitCommercialPerKw: 630, vatRate: 18,
  productionHours: 1700,
  privateCheckResidential: 550, privateCheckCommercial: 800, electricianResidential: 750, electricianCommercial: 2000,
  acCableOnGridResidential: 300, acCableHybridResidential: 600, acCableCommercial: 3000, antennaCost: 180, communicationLine: 100,

  primeRate: 6.0,
  loanMargin: 4.0,

  companyPhone: '04-611-61-33',
  agents: [
    { id: 'ag-1', name: 'ישראל ישראלי', phone: '050-1234567', tz: '123456789', photo: null }
  ]
};

function mergeAdminSettingsFromStorage(saved, defaults) {
  if (!saved || typeof saved !== 'object') return defaults;
  return {
    ...defaults,
    ...saved,
    optimizerPrices: {
      ...defaults.optimizerPrices,
      ...(saved.optimizerPrices && typeof saved.optimizerPrices === 'object' ? saved.optimizerPrices : {})
    },
    optimizerDatasheets: {
      ...defaults.optimizerDatasheets,
      ...(saved.optimizerDatasheets && typeof saved.optimizerDatasheets === 'object' ? saved.optimizerDatasheets : {})
    },
    optimizerLogos: {
      ...defaults.optimizerLogos,
      ...(saved.optimizerLogos && typeof saved.optimizerLogos === 'object' ? saved.optimizerLogos : {})
    },
    panelDatasheet: saved.panelDatasheet != null ? saved.panelDatasheet : defaults.panelDatasheet,
    panelLogo: saved.panelLogo != null ? saved.panelLogo : defaults.panelLogo,
    constructionLogo: saved.constructionLogo != null ? saved.constructionLogo : defaults.constructionLogo,
    constructionDatasheet:
      saved.constructionDatasheet != null ? saved.constructionDatasheet : defaults.constructionDatasheet,
    inverters: Array.isArray(saved.inverters) ? saved.inverters : defaults.inverters,
    invertersHybrid: Array.isArray(saved.invertersHybrid) ? saved.invertersHybrid : defaults.invertersHybrid,
    batteries: Array.isArray(saved.batteries) ? saved.batteries : defaults.batteries,
    agents: Array.isArray(saved.agents) ? saved.agents : defaults.agents,
    laborPerKwResidential:
      saved.laborPerKwResidential != null
        ? saved.laborPerKwResidential
        : saved.laborPerKw != null
          ? saved.laborPerKw
          : defaults.laborPerKwResidential,
    laborPerKwCommercial:
      saved.laborPerKwCommercial != null ? saved.laborPerKwCommercial : defaults.laborPerKwCommercial
  };
}

function loadAdminSettingsFromStorage() {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_PRICES;
  migrateLegacyStorageKey(ADMIN_SETTINGS_STORAGE_KEY, LEGACY_STORAGE.admin);
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_PRICES;
    return mergeAdminSettingsFromStorage(JSON.parse(raw), DEFAULT_ADMIN_PRICES);
  } catch {
    return DEFAULT_ADMIN_PRICES;
  }
}

/** סף קוט״ל להפרדת ממירים בין מערכת ביתית / מסחרית (כולל 30 בשני הצדדים לפי ההגדרה) */
const INVERTER_CAPACITY_SPLIT_KW = 30;

function normalizeInvName(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/** קוטל למיון לפי סוג מערכת — קודם מהשדה, אחרת ניסיון מתוך השם (למשל «100kW», «15 קוטל») */
function effectiveInverterKw(inv) {
  const fromField = Number(inv?.capacityKw);
  if (Number.isFinite(fromField)) return fromField;
  const raw = String(inv?.name || '');
  const mKw = raw.match(/(\d+(?:\.\d+)?)\s*kW\b/i);
  if (mKw) return Number(mKw[1]);
  const mHe = raw.match(/(\d+(?:\.\d+)?)\s*קוטל/i);
  if (mHe) return Number(mHe[1]);
  return NaN;
}

function inverterMatchesSystemCapacity(inv, systemType) {
  const kw = effectiveInverterKw(inv);
  if (!Number.isFinite(kw)) return false;
  if (systemType === 'residential') return kw <= INVERTER_CAPACITY_SPLIT_KW;
  return kw >= INVERTER_CAPACITY_SPLIT_KW;
}

function filterInvertersForQuote(adminList, systemType) {
  return (adminList || []).filter((inv) => inverterMatchesSystemCapacity(inv, systemType));
}

function findDefaultInverterId(adminList, systemType) {
  const pool = filterInvertersForQuote(adminList, systemType);
  if (!pool.length) return '';

  if (systemType === 'residential') {
    const exact = pool.find((inv) => normalizeInvName(inv.name) === 'SOLIS 15');
    if (exact) return exact.id;

    const isSolisBrand = (inv) => /\bSOLIS\b/i.test(String(inv.name || ''));
    const solisCandidates = pool.filter(isSolisBrand);
    if (solisCandidates.length) {
      const kw15 = solisCandidates.find((inv) => effectiveInverterKw(inv) === 15);
      if (kw15) return kw15.id;
      const nameHas15 = solisCandidates.find((inv) =>
        /\b15\b/.test(normalizeInvName(inv.name).replace(/KW/g, ' KW'))
      );
      if (nameHas15) return nameHas15.id;
      return solisCandidates[0].id;
    }

    /** אין SOLIS במחירון — דגם 15kW קרוב (לא סתם השורה הראשונה שיכולה להיות SolarEdge) */
    const byNearest15 = [...pool].sort(
      (a, b) =>
        Math.abs(effectiveInverterKw(a) - 15) - Math.abs(effectiveInverterKw(b) - 15)
    );
    return byNearest15[0].id;
  }

  const compact = (inv) => normalizeInvName(inv.name).replace(/[^A-Z0-9]/g, '');

  const exactMid = pool.find((inv) => normalizeInvName(inv.name) === 'MID30 HV GROWATT');
  if (exactMid) return exactMid.id;

  const midGrowatt = pool.find((inv) => {
    const n = normalizeInvName(inv.name);
    const c = compact(inv);
    const hasMid =
      c.includes('MID30') ||
      /\bMID[\s._-]*30\b/i.test(String(inv.name || ''));
    const hasGrowatt =
      n.includes('GROWATT') ||
      n.includes('GROWAT') ||
      /גראו/.test(String(inv.name || ''));
    return hasMid && hasGrowatt;
  });
  if (midGrowatt) return midGrowatt.id;

  const midHv = pool.find((inv) => {
    const n = normalizeInvName(inv.name);
    const c = compact(inv);
    return (c.includes('MID30') || /\bMID[\s._-]*30\b/i.test(String(inv.name || ''))) && n.includes('HV');
  });
  if (midHv) return midHv.id;

  const midOnly = pool.find((inv) => {
    const c = compact(inv);
    return c.includes('MID30') || /\bMID[\s._-]*30\b/i.test(String(inv.name || ''));
  });
  if (midOnly) return midOnly.id;

  /** קרוב לברירת המחדל המסחרית: העדפת הקוטל הנמוך ביותר שעדיין בטווח המסחרי */
  const sorted = [...pool].sort(
    (a, b) => effectiveInverterKw(a) - effectiveInverterKw(b)
  );
  return sorted[0].id;
}

function sanitizeQuoteInverterRows(selections, adminList, systemType) {
  const filtered = filterInvertersForQuote(adminList, systemType);
  if (!filtered.length) return selections || [];
  const allowedIds = new Set(filtered.map((i) => i.id));
  const defaultId = findDefaultInverterId(adminList, systemType) || filtered[0].id;
  return (selections || []).map((row) =>
    allowedIds.has(row.id) ? row : { ...row, id: defaultId }
  );
}

/** ברירת מחדל לשורות הצעה לפי סוג מערכת — SOLIS / MID או אחרת ראשון בטווח */
function resolveSegmentDefaultInverterId(adminList, systemType) {
  return (
    findDefaultInverterId(adminList, systemType) ||
    filterInvertersForQuote(adminList, systemType)[0]?.id ||
    ''
  );
}

export default function App() {
  const routeParams = useParams();
  const navigate = useNavigate();
  const rawQuoteParam = typeof routeParams.quoteId === 'string' ? routeParams.quoteId.trim() : '';
  const shareQuoteId =
    rawQuoteParam && /^[0-9a-fA-F-]{36}$/.test(rawQuoteParam) ? rawQuoteParam : null;
  const shareLinkMalformed = Boolean(rawQuoteParam) && !shareQuoteId;

  // --- מערכת התחברות (Login) ---
  const [currentUser, setCurrentUser] = useState(null); // הופעל מחדש
  const [loginInput, setLoginInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    migrateLegacyStorageKey(LOGIN_INPUT_STORAGE_KEY, LEGACY_STORAGE.login);
    try {
      return window.localStorage.getItem(LOGIN_INPUT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loginError, setLoginError] = useState('');
  const [rememberLogin, setRememberLogin] = useState(() => {
    if (typeof window === 'undefined') return false;
    migrateLegacyStorageKey(REMEMBER_LOGIN_STORAGE_KEY, LEGACY_STORAGE.remember);
    try {
      const raw = window.localStorage.getItem(REMEMBER_LOGIN_STORAGE_KEY);
      if (raw === null) return false;
      return raw === '1';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState('sales'); 
  const [openAdminSection, setOpenAdminSection] = useState('panels'); 
  
  const [adminPrices, setAdminPrices] = useState(loadAdminSettingsFromStorage);
  const [urbanPremiumCities, setUrbanPremiumCities] = useState(DEFAULT_URBAN_PREMIUM_CITIES);

  const supabase = useMemo(() => getSupabase(), []);
  const skipNextSupabasePersist = useRef(false);
  const supabaseHydrated = useRef(false);
  /** למעקב אחרי מעבר ראשון ל-hydrated — אז מיישמים ברירות SOLIS/MID בלי לדרוס אחרי כל עדכון קטלוג */
  const prevAdminHydratedForQuoteRef = useRef(false);
  const cloudPersistTimerRef = useRef(null);

  const [adminCloudSaving, setAdminCloudSaving] = useState(false);
  const [adminCloudSaveFeedback, setAdminCloudSaveFeedback] = useState(null);

  const handleSaveAdminToCloud = useCallback(async () => {
    if (!supabase) {
      setAdminCloudSaveFeedback({ type: 'error', text: 'אין חיבור ל-Supabase. הגדירו REACT_APP_SUPABASE_URL ו-REACT_APP_SUPABASE_ANON_KEY.' });
      return;
    }
    if (!supabaseHydrated.current) {
      setAdminCloudSaveFeedback({ type: 'error', text: 'עדיין טוען מהשרת — נסו שוב בעוד רגע.' });
      return;
    }
    clearTimeout(cloudPersistTimerRef.current);
    cloudPersistTimerRef.current = null;
    setAdminCloudSaveFeedback(null);
    setAdminCloudSaving(true);
    try {
      const payloadForCloud = await prepareAdminPricesForCloud(supabase, adminPrices);
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { id: 1, payload: payloadForCloud, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) throw error;
      skipNextSupabasePersist.current = true;
      setAdminPrices(payloadForCloud);
      try {
        window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(payloadForCloud));
      } catch (_) { /* ignore */ }
      setAdminCloudSaveFeedback({ type: 'success', text: 'נשמר לענן בהצלחה.' });
      window.setTimeout(() => setAdminCloudSaveFeedback(null), 4000);
    } catch (err) {
      let msg = err?.message || String(err);
      if (/statement timeout/i.test(msg)) {
        msg =
          'השמירה לענן נכשלה (קובץ גדול מדי ל-Postgres). הריצו ב-Supabase את supabase/admin_assets_storage.sql, ודאו שאין טריגר admin_settings_history. אחר כך נסו שוב.';
      }
      setAdminCloudSaveFeedback({ type: 'error', text: msg });
    } finally {
      setAdminCloudSaving(false);
    }
  }, [supabase, adminPrices]);

  /** טעינה מ-Supabase פעם אחת; אם אין שורה — זריעה מ-localStorage/ברירת מחדל */
  useEffect(() => {
    if (!supabase) {
      supabaseHydrated.current = true;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('admin_settings').select('payload').eq('id', 1).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('Supabase admin_settings load:', error.message);
        supabaseHydrated.current = true;
        return;
      }
      if (data?.payload && typeof data.payload === 'object') {
        const merged = mergeAdminSettingsFromStorage(data.payload, DEFAULT_ADMIN_PRICES);
        skipNextSupabasePersist.current = true;
        setAdminPrices(merged);
        try {
          window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        } catch (_) { /* ignore */ }
      } else {
        const seed = loadAdminSettingsFromStorage();
        skipNextSupabasePersist.current = true;
        setAdminPrices(seed);
        let seedPayload = seed;
        try {
          seedPayload = await prepareAdminPricesForCloud(supabase, seed);
        } catch (prepErr) {
          console.warn('admin_settings seed prepare:', prepErr?.message || prepErr);
        }
        const { error: upErr } = await supabase.from('admin_settings').upsert(
          { id: 1, payload: seedPayload, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
        if (upErr) console.warn('Supabase admin_settings seed:', upErr.message);
      }
      supabaseHydrated.current = true;
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  /** שמירה לענן (מושהית) — רק אחרי הידרציה; מדלגת אחרי טעינה משרת */
  useEffect(() => {
    if (!supabase || !supabaseHydrated.current) return undefined;
    if (skipNextSupabasePersist.current) {
      skipNextSupabasePersist.current = false;
      return undefined;
    }
    clearTimeout(cloudPersistTimerRef.current);
    cloudPersistTimerRef.current = setTimeout(() => {
      (async () => {
        try {
          const payloadForCloud = await prepareAdminPricesForCloud(supabase, adminPrices);
          const { error } = await supabase
            .from('admin_settings')
            .upsert(
              { id: 1, payload: payloadForCloud, updated_at: new Date().toISOString() },
              { onConflict: 'id' }
            );
          if (error) console.warn('Supabase admin_settings save:', error.message);
          else {
            skipNextSupabasePersist.current = true;
            setAdminPrices(payloadForCloud);
            try {
              window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(payloadForCloud));
            } catch (_) { /* ignore */ }
          }
        } catch (e) {
          console.warn('Supabase admin_settings save:', e?.message || e);
        } finally {
          cloudPersistTimerRef.current = null;
        }
      })();
    }, 700);
    return () => clearTimeout(cloudPersistTimerRef.current);
  }, [supabase, adminPrices]);

  /** רשימת יישובים לפרמיה אורבנית — מ-Supabase (גיבוי מקומי אם אין חיבור) */
  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('urban_premium_cities')
        .select('name_he')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn('urban_premium_cities load:', error.message);
        return;
      }
      const names = (data || []).map((row) => String(row.name_he || '').trim()).filter(Boolean);
      if (names.length > 0) setUrbanPremiumCities(names);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const [quoteForm, setQuoteForm] = useState({
    systemType: 'residential', 
    clientName: '',
    clientCity: '', 
    systemSizeKw: 22.5,
    systemSizeAcKw: 15, 
    roofType: 'concrete', 
    inverterSystemType: 'ongrid',
    selectedInverters: [
      {
        id:
          findDefaultInverterId(DEFAULT_ADMIN_PRICES.inverters, 'residential') ||
          DEFAULT_ADMIN_PRICES.inverters[0]?.id ||
          '',
        quantity: 1,
      },
    ],
    selectedHybridInverters: [
      {
        id:
          findDefaultInverterId(DEFAULT_ADMIN_PRICES.invertersHybrid, 'residential') ||
          DEFAULT_ADMIN_PRICES.invertersHybrid[0]?.id ||
          '',
        quantity: 1,
      },
    ],
    includesBatteries: false,
    selectedBatteries: [{ id: 'bat-se10', quantity: 1 }],
    includesOptimizers: false,
    tigoQuantity: 0,
    sungrowQuantity: 0,
    includesWashing: false,
    showLoanSimulation: true,
    showLimitedOffer: false,
    feesPayer: 'client', 
    
    specifyOrientation: false,
    panelsSouth: 0,
    panelsEastWest: 0,
    panelsNorth: 0,
    optimizerAcknowledge: false,
    additionalNotes: '',
    /** לוגו Tigo בהצעה — רלוונטי כשמסומנים אופטימייזרים מסוג Tigo (לא SolarEdge / Sungrow) */
    showTigoLogoOnQuote: true,
    /** לוגו Sungrow בהצעה — כשממיר Sungrow ואופטימייזרים */
    showSungrowLogoOnQuote: true,
  });

  const [generatedQuote, setGeneratedQuote] = useState(null);
  /** טיוטת הצעה אחרי חישוב — לפני אישור מחיר ללקוח */
  const [quoteDraft, setQuoteDraft] = useState(null);
  const [agentOfferPriceInput, setAgentOfferPriceInput] = useState('');
  const [errorMsg, setErrorMsg] = useState(''); 
  const [currentTime, setCurrentTime] = useState(Date.now()); 
  const [clientSignature, setClientSignature] = useState(null); // סטייט לשמירת החתימה הדיגיטלית
  const [quoteDatasheetViewer, setQuoteDatasheetViewer] = useState(null); // { title, datasheet } — צפייה במפרט טכני בהצעה
  /** טעינת הצעה משותפת מ־/q/:id */
  const [shareQuoteLoad, setShareQuoteLoad] = useState({ phase: 'idle', message: '', waHref: null });
  const [shareLinkFeedback, setShareLinkFeedback] = useState(null);
  const [shareLinkBusy, setShareLinkBusy] = useState(false);
  const shareLinkFeedbackClearTimerRef = useRef(null);

  useEffect(() => {
    if (!shareQuoteId) {
      setShareQuoteLoad({ phase: 'idle', message: '', waHref: null });
      return undefined;
    }
    if (!supabase) {
      setShareQuoteLoad({
        phase: 'error',
        message: 'אין חיבור ל-Supabase. הגדירו REACT_APP_SUPABASE_URL ו-REACT_APP_SUPABASE_ANON_KEY והריצו את supabase/shared_quotes.sql.',
        waHref: null,
      });
      return undefined;
    }
    let cancelled = false;
    setShareQuoteLoad({ phase: 'loading', message: '' });
    (async () => {
      const { data, error } = await supabase.rpc('get_shared_quote', { p_id: shareQuoteId });
      if (cancelled) return;
      if (error) {
        setShareQuoteLoad({ phase: 'error', message: error.message || 'שגיאת טעינה', waHref: null });
        return;
      }
      let row = data;
      if (typeof row === 'string') {
        try {
          row = JSON.parse(row);
        } catch {
          row = null;
        }
      }
      if (!row || typeof row !== 'object') {
        setShareQuoteLoad({
          phase: 'error',
          message: 'תגובה לא צפויה מהשרת.',
          waHref: null,
        });
        return;
      }
      if (row.ok === true && row.payload && typeof row.payload === 'object') {
        const cities =
          urbanPremiumCities.length > 0 ? urbanPremiumCities : DEFAULT_URBAN_PREMIUM_CITIES;
        setGeneratedQuote(applyUrbanPremiumToQuote(row.payload, cities, adminPrices));
        setCurrentUser({ role: 'viewer', data: null });
        setActiveTab('quote');
        setShareQuoteLoad({ phase: 'ready', message: '', waHref: null });
        return;
      }
      if (row.ok === false && row.reason === 'expired') {
        const agentName = String(row.agent_name || '').trim();
        const phone = String(row.agent_phone || row.company_phone || '').trim();
        const greet = agentName ? `שלום ${agentName},` : 'שלום,';
        const waText = `${greet} הקישור להצעת המחיר שקיבלתי כבר לא פעיל (פג תוקף של ${SHARE_LINK_VALIDITY_LABEL_HE}). אשמח לקבל שוב את ההצעה או להמשיך לשלב הבא. תודה!`;
        const waHref = buildWhatsappMeLink(phone, waText);
        setShareQuoteLoad({
          phase: 'expired',
          message:
            `פג תוקף הקישור (${SHARE_LINK_VALIDITY_LABEL_HE}). לקבלת ההצעה מחדש — שלחו הודעה בוואטסאפ לסוכן/ת או למשרד.`,
          waHref,
        });
        return;
      }
      setShareQuoteLoad({
        phase: 'error',
        message: 'הקישור לא נמצא או שאינו תקף.',
        waHref: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [shareQuoteId, supabase, adminPrices, urbanPremiumCities]);

  /** הצעה משותפת — עדכון פרמיה אורבנית אחרי טעינת רשימת יישובים מהענן */
  useEffect(() => {
    if (!shareQuoteId || !generatedQuote?.baseCalculatedTariff) return undefined;
    const cities =
      urbanPremiumCities.length > 0 ? urbanPremiumCities : DEFAULT_URBAN_PREMIUM_CITIES;
    setGeneratedQuote((prev) =>
      prev ? applyUrbanPremiumToQuote(prev, cities, adminPrices) : prev
    );
    return undefined;
  }, [shareQuoteId, urbanPremiumCities]);

  const scheduleShareLinkFeedbackClear = useCallback((ms) => {
    if (shareLinkFeedbackClearTimerRef.current != null) {
      window.clearTimeout(shareLinkFeedbackClearTimerRef.current);
    }
    shareLinkFeedbackClearTimerRef.current = window.setTimeout(() => {
      shareLinkFeedbackClearTimerRef.current = null;
      setShareLinkFeedback(null);
    }, ms);
  }, []);

  const handleCreateShareLink = useCallback(async () => {
    if (!generatedQuote) return;
    if (!supabase) {
      setShareLinkFeedback({ type: 'error', text: 'אין חיבור ל-Supabase.' });
      scheduleShareLinkFeedbackClear(12000);
      return;
    }
    if (typeof crypto === 'undefined' || !crypto.randomUUID) {
      setShareLinkFeedback({ type: 'error', text: 'הדפדפן לא תומך ביצירת מזהה בטוח.' });
      scheduleShareLinkFeedbackClear(12000);
      return;
    }
    setShareLinkBusy(true);
    setShareLinkFeedback(null);
    const id = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SHARE_LINK_VALIDITY_DAYS);
    const agentPhone = String(generatedQuote?.agentDetails?.phone || adminPrices.companyPhone || '').trim();
    const agentName = String(generatedQuote?.agentDetails?.name || '').trim();
    const companyPhone = String(adminPrices.companyPhone || '').trim();

    const urlPromise = (async () => {
      const { error } = await supabase.from('shared_quotes').insert({
        id,
        payload: generatedQuote,
        expires_at: expiresAt.toISOString(),
        agent_phone: agentPhone || null,
        agent_name: agentName || null,
        company_phone: companyPhone || null,
      });
      if (error) throw error;
      return quoteShareAbsoluteUrl(id);
    })();

    // #region agent log
    emitShareLinkDebugLog('H1', 'share-link-start', {
      hasSupabase: Boolean(supabase),
      hasClipboardWrite: Boolean(navigator.clipboard?.write),
      hasClipboardItem: typeof ClipboardItem !== 'undefined',
    });
    // #endregion
    try {
      let copied = false;
      let copyErrorName = null;
      try {
        await copyTextRespectingUserGesture(urlPromise);
        copied = true;
      } catch (copyErr) {
        copied = false;
        copyErrorName = copyErr?.name || copyErr?.message || 'unknown';
      }

      const url = await urlPromise;
      // #region agent log
      emitShareLinkDebugLog('H1-H3', 'share-link-success', {
        copied,
        copyErrorName,
        urlLength: url?.length ?? 0,
      });
      // #endregion
      setShareLinkFeedback({
        type: 'success',
        text: copied
          ? `הקישור הועתק ללוח. תוקף: ${SHARE_LINK_VALIDITY_LABEL_HE}.`
          : `הקישור נוצר (תוקף ${SHARE_LINK_VALIDITY_LABEL_HE}) — לחצו «העתק קישור»:`,
        url,
        copied,
      });
      scheduleShareLinkFeedbackClear(copied ? 12000 : 60000);
    } catch (err) {
      // #region agent log
      emitShareLinkDebugLog('H4', 'share-link-supabase-error', {
        errorName: err?.name,
        errorCode: err?.code,
        message: err?.message ? String(err.message).slice(0, 120) : null,
      });
      // #endregion
      const raw = err?.message != null ? String(err.message) : String(err);
      const code = err?.code != null ? String(err.code) : '';
      const combined = `${raw} ${code}`.toLowerCase();
      const needsSupabaseMigration =
        /shared_quotes|schema cache|does not exist|42p01|undefined column|column .* does not exist|permission denied for table|violates row-level security|row-level security policy/i.test(
          combined
        );
      const payloadTooLarge =
        /too large|413|request entity|maximum|payload|body.*size|exceeds/i.test(combined);
      let text;
      if (needsSupabaseMigration) {
        text =
          'שמירת הקישור ללקוח נכשלה — ב-Supabase חסרה הטבלה או ההרשאות. ב-SQL Editor הריצו את כל הקובץ supabase/shared_quotes.sql מהריפו (טבלה shared_quotes, מדיניות INSERT ל-anon, פונקציית get_shared_quote, ו-NOTIFY pgrst). ודאו ש-REACT_APP_SUPABASE_URL באתר מצביע על אותו פרויקט Supabase.';
      } else if (payloadTooLarge) {
        text =
          'גודל ההצעה גדול מדי לשמירה בענן (למשל תמונות מוטמעות). השתמשו בהדפסה ל-PDF או צמצמו קבצים בהצעה. פירוט: ' +
          raw.slice(0, 160);
      } else {
        text = 'לא ניתן ליצור קישור כרגע. ' + (raw ? raw.slice(0, 220) : code || 'שגיאה לא ידועה');
      }
      setShareLinkFeedback({
        type: 'error',
        text,
      });
      scheduleShareLinkFeedbackClear(12000);
    } finally {
      setShareLinkBusy(false);
    }
  }, [supabase, generatedQuote, adminPrices, scheduleShareLinkFeedbackClear]);

  const handleRetryCopyShareLink = useCallback(async () => {
    const url = shareLinkFeedback?.url;
    if (!url) return;
    // #region agent log
    emitShareLinkDebugLog('H3', 'retry-copy-start', { urlLength: url.length });
    // #endregion
    try {
      await copyTextSync(url);
      // #region agent log
      emitShareLinkDebugLog('H3', 'retry-copy-success', { urlLength: url.length });
      // #endregion
      setShareLinkFeedback((prev) =>
        prev
          ? {
              ...prev,
              type: 'success',
              text: `הקישור הועתק ללוח. תוקף: ${SHARE_LINK_VALIDITY_LABEL_HE}.`,
              copied: true,
            }
          : prev
      );
      scheduleShareLinkFeedbackClear(12000);
    } catch (retryErr) {
      // #region agent log
      emitShareLinkDebugLog('H3', 'retry-copy-failed', {
        errorName: retryErr?.name,
        message: retryErr?.message ? String(retryErr.message).slice(0, 80) : null,
      });
      // #endregion
      setShareLinkFeedback((prev) =>
        prev
          ? {
              ...prev,
              type: 'success',
              text: 'לא ניתן להעתיק אוטומטית — בחרו את הקישור למטה והעתיקו ידנית:',
              copied: false,
            }
          : prev
      );
      scheduleShareLinkFeedbackClear(60000);
    }
  }, [shareLinkFeedback?.url, scheduleShareLinkFeedbackClear]);

  const handleShareQuoteLink = useCallback(async (url) => {
    if (!url || !canUseNativeShare()) return;
    try {
      await navigator.share({ title: 'הצעת מחיר', url });
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    let interval = null;
    if (activeTab === 'quote' && generatedQuote) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, generatedQuote]);

  useEffect(() => {
    if (activeTab !== 'quote') setQuoteDatasheetViewer(null);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(adminPrices));
    } catch (_) {
      /* מקום אחסון מלא או דפדפן פרטי */
    }
  }, [adminPrices]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!rememberLogin) {
        window.localStorage.removeItem(LOGIN_INPUT_STORAGE_KEY);
        window.localStorage.setItem(REMEMBER_LOGIN_STORAGE_KEY, '0');
        return;
      }
      window.localStorage.setItem(REMEMBER_LOGIN_STORAGE_KEY, '1');
      const normalized = String(loginInput || '').trim();
      if (normalized) window.localStorage.setItem(LOGIN_INPUT_STORAGE_KEY, normalized);
    } catch (_) {
      /* ignore storage failures */
    }
  }, [loginInput, rememberLogin]);

  useEffect(() => {
    const hydrated = supabaseHydrated.current;
    const justBecameHydrated = hydrated && !prevAdminHydratedForQuoteRef.current;
    prevAdminHydratedForQuoteRef.current = hydrated;

    setQuoteForm((prev) => {
      const cleanedInverters = sanitizeQuoteInverterRows(
        prev.selectedInverters,
        adminPrices.inverters,
        prev.systemType
      );
      const cleanedHybrid = sanitizeQuoteInverterRows(
        prev.selectedHybridInverters,
        adminPrices.invertersHybrid,
        prev.systemType
      );

      if (!hydrated) {
        return {
          ...prev,
          selectedInverters: cleanedInverters,
          selectedHybridInverters: cleanedHybrid,
        };
      }

      if (justBecameHydrated) {
        const idealInv = resolveSegmentDefaultInverterId(adminPrices.inverters, prev.systemType);
        const idealHyb = resolveSegmentDefaultInverterId(adminPrices.invertersHybrid, prev.systemType);
        return {
          ...prev,
          selectedInverters: idealInv
            ? prev.selectedInverters.map((r) => ({ ...r, id: idealInv }))
            : cleanedInverters,
          selectedHybridInverters: idealHyb
            ? prev.selectedHybridInverters.map((r) => ({ ...r, id: idealHyb }))
            : cleanedHybrid,
        };
      }

      return {
        ...prev,
        selectedInverters: cleanedInverters,
        selectedHybridInverters: cleanedHybrid,
      };
    });
  }, [adminPrices.inverters, adminPrices.invertersHybrid]);

  // --- פונקציית התחברות ---
  const handleLogin = (e) => {
    e.preventDefault();
    const rawLogin = String(loginInput ?? '').trim();
    if (rawLogin === ADMIN_LOGIN) {
      setCurrentUser({ role: 'admin', data: null });
      setActiveTab('sales');
      setLoginInput('');
    } else {
      const agent = adminPrices.agents.find(
        (a) => String(a.tz ?? '').trim() === rawLogin
      );
      if (agent) {
        setCurrentUser({ role: 'agent', data: agent });
        setActiveTab('sales');
        setLoginInput('');
      } else {
        setLoginError('מספר תעודת זהות לא נמצא במערכת. אנא פנה להנהלה.');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setGeneratedQuote(null);
    setQuoteDraft(null);
    setAgentOfferPriceInput('');
    setLoginInput('');
    setShareQuoteLoad({ phase: 'idle', message: '', waHref: null });
    if (shareQuoteId) {
      navigate('/', { replace: true });
    }
  };

  /** אחרי שמירת חתימה: פותח וואטסאפ לסוכן (או טלפון החברה) עם טקסט מוכן — הלקוח רק לוחץ «שלח». ללא שרת אין שליחה אוטומטית אמיתית. */
  const handleClientSignatureSaved = (imgData) => {
    setClientSignature(imgData);
    const gq = generatedQuote;
    if (!gq) return;
    const phoneRaw = gq.agentDetails ? gq.agentDetails.phone : adminPrices.companyPhone;
    let clean = String(phoneRaw || '').replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    if (!clean) return;
    const client = (gq.clientName || '').trim() || 'לקוח';
    const cityPart = (gq.clientCity || '').trim() ? ` מ${(gq.clientCity || '').trim()}` : '';
    const dateStr = new Date().toLocaleString('he-IL');
    const body = `היי, הלקוח ${client}${cityPart} חתם/ה עכשיו על חתימה דיגיטלית (אישור עקרוני) בהצעת המחיר.\nתאריך ושעה: ${dateStr}\nמומלץ ליצור קשר לשלב הבא.`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
  };

  // --- עזרי תצוגה טרום-חישוב (לשימוש בטופס הסוכן) ---
  const panelPowerConst = Number(adminPrices.panelPowerWatts) || 640;
  const currentCalculatedPanels = Math.round(((parseFloat(quoteForm.systemSizeKw) || 0) * 1000) / panelPowerConst) || 0;
  
  const pSouthInput = Number(quoteForm.panelsSouth) || 0;
  const pEWInput = Number(quoteForm.panelsEastWest) || 0;
  const pNorthInput = Number(quoteForm.panelsNorth) || 0;
  const currentDistributedPanels = pSouthInput + pEWInput + pNorthInput;

  const baseProductionHours = Number(adminPrices.productionHours) > 0 ? Number(adminPrices.productionHours) : 1700;
  const liveSouthH = baseProductionHours;
  const liveEWH = baseProductionHours * 0.85;
  const liveNorthH = baseProductionHours * 0.65;
  let liveAvgH = baseProductionHours;
  if (currentDistributedPanels > 0) {
    liveAvgH = ((pSouthInput * liveSouthH) + (pEWInput * liveEWH) + (pNorthInput * liveNorthH)) / currentDistributedPanels;
  }

  let requiredOptimizersForSmallArrays = 0;
  if (pSouthInput > 0 && pSouthInput < 6) requiredOptimizersForSmallArrays += pSouthInput;
  if (pEWInput > 0 && pEWInput < 6) requiredOptimizersForSmallArrays += pEWInput;
  if (pNorthInput > 0 && pNorthInput < 6) requiredOptimizersForSmallArrays += pNorthInput;

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    if (name === 'companyPhone') {
      setAdminPrices(prev => ({ ...prev, [name]: value }));
    } else {
      setAdminPrices(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
  };

  const handleOptimizerPriceChange = (e) => {
    const { name, value } = e.target;
    setAdminPrices(prev => ({ ...prev, optimizerPrices: { ...prev.optimizerPrices, [name]: parseFloat(value) || 0 } }));
  };

  const updateAdminListItem = (listName, id, field, value) => {
    setAdminPrices(prev => ({ ...prev, [listName]: prev[listName].map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };

  const removeAdminListItem = (listName, id) => {
    setAdminPrices(prev => ({ ...prev, [listName]: prev[listName].filter(item => item.id !== id) }));
  };

  const addAdminListItem = (listName, newItemTemplate) => {
    setAdminPrices(prev => ({ ...prev, [listName]: [...prev[listName], { ...newItemTemplate, id: `${listName}-${Date.now()}` }] }));
  };

  const openQuoteDatasheet = (title, ds) => {
    const n = normalizeDatasheet(ds);
    const src = n ? datasheetToSrc(n) : null;
    if (!n || !src) {
      window.alert(
        'לא ניתן לפתוח את המפרט הטכני. ודאו שהקובץ הועלה בהגדרות אדמין, שמרו לענן (כפתור שמירה לענן), והפיקו את ההצעה מחדש.'
      );
      return;
    }

    const isMobileLike =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    const isPdf = String(n.mimeType || '').toLowerCase().includes('pdf');
    if (isMobileLike && isPdf) {
      // #region agent log
      emitAgentDebugLog('run-pre-fix', 'H5', 'App.js:2613', 'Opening datasheet via mobile direct PDF path', {
        title,
        isMobileLike,
        isPdf,
        mimeType: n.mimeType,
        fileName: n.fileName,
      });
      // #endregion
      const opened = window.open(src, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = src;
      return;
    }

    setQuoteDatasheetViewer({ title, datasheet: n });
  };

  const attachDatasheetToListItem = async (listName, id, file) => {
    try {
      const ds = await readAdminDatasheetFileSmart(file);
      setAdminPrices(prev => ({
        ...prev,
        [listName]: prev[listName].map(item => (item.id === id ? { ...item, datasheet: ds } : item))
      }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הקובץ');
    }
  };

  const attachPanelDatasheetFile = async (file) => {
    try {
      const ds = await readAdminDatasheetFileSmart(file);
      setAdminPrices(prev => ({ ...prev, panelDatasheet: ds }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הקובץ');
    }
  };

  const attachOptimizerDatasheetFile = async (key, file) => {
    try {
      const ds = await readAdminDatasheetFileSmart(file);
      setAdminPrices(prev => ({
        ...prev,
        optimizerDatasheets: { ...(prev.optimizerDatasheets || {}), [key]: ds }
      }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הקובץ');
    }
  };

  const attachOptimizerLogoFile = async (key, file) => {
    try {
      const raster = await readFileAsNormalizedQuoteRaster(file, 'logo');
      setAdminPrices((prev) => ({
        ...prev,
        optimizerLogos: { ...(prev.optimizerLogos || {}), [key]: raster },
      }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הלוגו');
    }
  };

  const attachPanelLogoFile = async (file) => {
    try {
      const raster = await readFileAsNormalizedQuoteRaster(file, 'logo');
      setAdminPrices((prev) => ({ ...prev, panelLogo: raster }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הלוגו');
    }
  };

  const attachConstructionLogoFile = async (file) => {
    try {
      const raster = await readFileAsNormalizedQuoteRaster(file, 'logo');
      setAdminPrices((prev) => ({ ...prev, constructionLogo: raster }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הלוגו');
    }
  };

  const attachConstructionDatasheetFile = async (file) => {
    try {
      const ds = await readAdminDatasheetFileSmart(file);
      setAdminPrices((prev) => ({ ...prev, constructionDatasheet: ds }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הקובץ');
    }
  };

  const attachRasterToAdminListItem = async (listName, id, field, file) => {
    try {
      const raster = await readFileAsNormalizedQuoteRaster(file, 'logo');
      setAdminPrices((prev) => ({
        ...prev,
        [listName]: prev[listName].map((item) => (item.id === id ? { ...item, [field]: raster } : item)),
      }));
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת הלוגו');
    }
  };

  const attachAgentPhotoFile = async (agentId, file) => {
    try {
      const raster = await readFileAsNormalizedQuoteRaster(file, 'avatar');
      updateAdminListItem('agents', agentId, 'photo', raster);
    } catch (err) {
      alert(err.message || 'שגיאה בהעלאת התמונה');
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setQuoteForm(prev => {
      const newState = { ...prev, [name]: val };
      if (['panelsSouth', 'panelsEastWest', 'panelsNorth'].includes(name)) {
        newState.optimizerAcknowledge = false;
      }
      if (name === 'systemType') {
        const idealInv = resolveSegmentDefaultInverterId(adminPrices.inverters, val);
        const idealHyb = resolveSegmentDefaultInverterId(adminPrices.invertersHybrid, val);
        newState.selectedInverters = idealInv
          ? prev.selectedInverters.map((r) => ({ ...r, id: idealInv }))
          : sanitizeQuoteInverterRows(prev.selectedInverters, adminPrices.inverters, val);
        newState.selectedHybridInverters = idealHyb
          ? prev.selectedHybridInverters.map((r) => ({ ...r, id: idealHyb }))
          : sanitizeQuoteInverterRows(prev.selectedHybridInverters, adminPrices.invertersHybrid, val);
      }
      return newState;
    });
    
    if (name === 'specifyOrientation' && !checked) {
      setErrorMsg('');
    }
  };

  const handleDcSizeChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    const autoAc = val <= 15 ? 15 : (val / 3) * 2;
    setQuoteForm(prev => ({ 
      ...prev, 
      systemSizeKw: e.target.value,
      systemSizeAcKw: autoAc.toFixed(2)
    }));
  };

  const handleQuoteListChange = (listName, index, field, value) => {
    const updatedList = [...quoteForm[listName]];
    updatedList[index][field] = field === 'quantity' ? (parseInt(value) || 1) : value;
    setQuoteForm(prev => ({ ...prev, [listName]: updatedList }));
  };

  const addQuoteListItem = (formListName, adminListName) => {
    const full = adminPrices[adminListName];
    if (!full || full.length === 0) return;
    let newId = full[0].id;
    if (adminListName === 'inverters' || adminListName === 'invertersHybrid') {
      const filtered = filterInvertersForQuote(full, quoteForm.systemType);
      if (!filtered.length) return;
      newId = resolveSegmentDefaultInverterId(full, quoteForm.systemType) || filtered[0].id;
    }
    setQuoteForm((prev) => ({
      ...prev,
      [formListName]: [...prev[formListName], { id: newId, quantity: 1 }],
    }));
  };

  const removeQuoteListItem = (formListName, index) => {
    setQuoteForm(prev => ({ ...prev, [formListName]: prev[formListName].filter((_, i) => i !== index) }));
  };

  const getSolarEdgeStatus = () => {
    let hasSolarEdge = false;
    const activeInvertersForm = quoteForm.inverterSystemType === 'hybrid' ? quoteForm.selectedHybridInverters : quoteForm.selectedInverters;
    const activeInvertersAdmin = quoteForm.inverterSystemType === 'hybrid' ? adminPrices.invertersHybrid : adminPrices.inverters;

    activeInvertersForm.forEach(sel => {
      const invData = activeInvertersAdmin.find(i => i.id === sel.id);
      if (invData && invData.isSolarEdge && (Number(sel.quantity) || 0) > 0) {
        hasSolarEdge = true;
      }
    });
    return { hasSolarEdge };
  };

  /** SolarEdge אופטימייזרים: לפי גודל AC בהצעה — ≤15 kW → 1:1, מ-16 kW → 1:2 */
  const solarEdgeOptimizerUsesOneToTwo = (acKw) => {
    const ac = parseFloat(acKw);
    if (!Number.isFinite(ac)) return false;
    return ac >= 16;
  };

  const getSungrowStatus = () => {
    let hasSungrow = false;
    const activeInvertersForm =
      quoteForm.inverterSystemType === 'hybrid' ? quoteForm.selectedHybridInverters : quoteForm.selectedInverters;
    const activeInvertersAdmin =
      quoteForm.inverterSystemType === 'hybrid' ? adminPrices.invertersHybrid : adminPrices.inverters;

    activeInvertersForm.forEach((sel) => {
      const invData = activeInvertersAdmin.find((i) => i.id === sel.id);
      if (invData && sel.quantity > 0 && resolveInverterLogoSlug(invData) === 'sungrow') {
        hasSungrow = true;
      }
    });
    return { hasSungrow };
  };

  const calculateTariff = (acSize) => {
    const numSize = parseFloat(acSize);
    if (isNaN(numSize) || numSize <= 0) return 0;
    
    let totalCents = 0;
    let remaining = numSize;

    if (remaining > 300) {
      totalCents += (remaining - 300) * 28.44;
      remaining = 300;
    }
    if (remaining > 100) {
      totalCents += (remaining - 100) * 34.37;
      remaining = 100;
    }
    if (remaining > 15) {
      totalCents += (remaining - 15) * 37.31;
      remaining = 15;
    }
    if (remaining > 0) {
      totalCents += remaining * 48.00;
    }
    return (totalCents / numSize) / 100;
  };

  const calculateQuote = (e) => {
    e.preventDefault();
    
    const sizeKw = parseFloat(quoteForm.systemSizeKw) || 0;
    const acKw = parseFloat(quoteForm.systemSizeAcKw) || 15;
    const systemSizeWatts = sizeKw * 1000; 
    
    const panelPower = Number(adminPrices.panelPowerWatts) || 640;
    const numPanels = Math.round(systemSizeWatts / panelPower);

    const rawAmps = acKw * 1.44 * 1.10;
    const standardAmps = [25, 40, 63, 80, 100, 160, 200, 250, 315, 400, 630, 800, 1000, 1250, 1600];
    let requiredConnectionAmps = standardAmps[standardAmps.length - 1]; 
    for (let i = 0; i < standardAmps.length; i++) {
      if (standardAmps[i] >= rawAmps) {
        requiredConnectionAmps = standardAmps[i];
        break;
      }
    }
    if (rawAmps > requiredConnectionAmps) {
       requiredConnectionAmps = Math.ceil(rawAmps);
    }

    const panelsCost = systemSizeWatts * (Number(adminPrices.panelPricePerWattUsd) || 0.11) * (Number(adminPrices.usdExchangeRate) || 3.75);
    const constructionCost = sizeKw * (quoteForm.roofType === 'concrete' ? (Number(adminPrices.constructionConcretePerKw) || 350) : (Number(adminPrices.constructionOtherPerKw) || 200));
    
    let totalInvertersCost = 0;
    const inverterDetailsList = [];
    const isHybridSystem = quoteForm.inverterSystemType === 'hybrid';
    const activeInvertersForm = isHybridSystem ? quoteForm.selectedHybridInverters : quoteForm.selectedInverters;
    const activeInvertersAdmin = isHybridSystem ? adminPrices.invertersHybrid : adminPrices.inverters;

    activeInvertersForm.forEach(sel => {
      const invData = activeInvertersAdmin.find(i => i.id === sel.id);
      if (invData && sel.quantity > 0) {
        totalInvertersCost += (Number(invData.cost) || 0) * sel.quantity;
        inverterDetailsList.push({
          id: invData.id,
          name: invData.name,
          quantity: sel.quantity,
          isHybrid: isHybridSystem,
          isSolarEdge: invData.isSolarEdge,
          logoSlug: resolveInverterLogoSlug(invData),
          customLogo: normalizeDatasheet(invData.customLogo),
          datasheet: normalizeDatasheet(invData.datasheet),
        });
      }
    });

    let totalBatteriesCost = 0;
    const batteryDetailsList = [];
    const hasBatteries = isHybridSystem && quoteForm.includesBatteries;
    
    if (hasBatteries) {
      const batteryById = new Map();
      quoteForm.selectedBatteries.forEach((sel) => {
        const batData = adminPrices.batteries.find((b) => b.id === sel.id);
        const qty = Number(sel.quantity) || 0;
        if (batData && qty > 0) {
          totalBatteriesCost += (Number(batData.cost) || 0) * qty;
          const prev = batteryById.get(batData.id);
          if (prev) prev.quantity += qty;
          else {
            batteryById.set(batData.id, {
              id: batData.id,
              name: batData.name,
              quantity: qty,
              unitKwh: parseBatteryKwhFromName(batData.name),
              logo: normalizeDatasheet(batData.logo),
              datasheet: normalizeDatasheet(batData.datasheet),
            });
          }
        }
      });
      batteryDetailsList.push(...batteryById.values());
    }
    // #region agent log
    emitAgentDebugLog('run-pre-fix', 'H1', 'App.js:2916', 'Battery selection calculation in quote', {
      inverterSystemType: quoteForm.inverterSystemType,
      includesBatteries: quoteForm.includesBatteries,
      hasBatteries,
      selectedBatteries: quoteForm.selectedBatteries,
      batteryDetailsCount: batteryDetailsList.length,
      batteryUnits: batteryDetailsList.map((b) => ({ id: b.id, quantity: b.quantity, unitKwh: b.unitKwh })),
    });
    // #endregion
    
    let optimizersCost = 0;
    let optimizerDetails = { type: 'ללא', quantity: 0 };
    /** מפתח דאטהשיט באופטימייזרים: se1to1 | se1to2 | tigo | sungrow */
    let optimizerKind = null;
    if (quoteForm.includesOptimizers) {
      const seStatus = getSolarEdgeStatus();
      const sgStatus = getSungrowStatus();
      if (seStatus.hasSolarEdge) {
        if (solarEdgeOptimizerUsesOneToTwo(acKw)) {
          const optQty = Math.ceil(numPanels / 2);
          optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.se1to2) || 350);
          optimizerDetails = { type: 'SolarEdge 1:2', quantity: optQty };
          optimizerKind = 'se1to2';
        } else {
          const optQty = numPanels;
          optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.se1to1) || 250);
          optimizerDetails = { type: 'SolarEdge 1:1', quantity: optQty };
          optimizerKind = 'se1to1';
        }
      } else if (sgStatus.hasSungrow) {
        const optQty = parseInt(quoteForm.sungrowQuantity, 10) || numPanels;
        optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.sungrow) || 220);
        optimizerDetails = { type: 'Sungrow (סנגרואו)', quantity: optQty };
        optimizerKind = 'sungrow';
      } else {
        const optQty = parseInt(quoteForm.tigoQuantity, 10) || 0;
        optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.tigo) || 200);
        optimizerDetails = { type: 'Tigo (טייגו)', quantity: optQty };
        optimizerKind = 'tigo';
      }
    }

    const logisticsCost = Number(adminPrices.logisticsCost) || 3100;
    const laborPerKw =
      quoteForm.systemType === 'commercial'
        ? Number(adminPrices.laborPerKwCommercial) || 550
        : Number(adminPrices.laborPerKwResidential) || Number(adminPrices.laborPerKw) || 650;
    let laborCost = sizeKw * laborPerKw;
    if (hasBatteries) laborCost += (Number(adminPrices.hybridBatteryInstallCost) || 5700); 

    const engineeringCost = (Number(adminPrices.planningCost) || 1400) + (Number(adminPrices.constructorEngineer) || 500);
    const privateCheckCost = quoteForm.systemType === 'residential' ? (Number(adminPrices.privateCheckResidential) || 550) : (Number(adminPrices.privateCheckCommercial) || 800);
    const electricianCost = quoteForm.systemType === 'residential' ? (Number(adminPrices.electricianResidential) || 750) : (Number(adminPrices.electricianCommercial) || 2000);
    
    let acCableCost = 0;
    if (quoteForm.systemType === 'residential') {
        acCableCost = isHybridSystem ? (Number(adminPrices.acCableHybridResidential) || 600) : (Number(adminPrices.acCableOnGridResidential) || 300);
    } else {
        acCableCost = Number(adminPrices.acCableCommercial) || 3000;
    }
    const accessoriesCost = acCableCost + (Number(adminPrices.antennaCost) || 180) + (Number(adminPrices.communicationLine) || 100);
    
    const electricalBoxCost = quoteForm.systemType === 'residential' 
      ? (Number(adminPrices.electricalBoxResidential) || 870) 
      : sizeKw * (Number(adminPrices.electricalBoxCommercialPerKw) || 270);

    const washingCost = quoteForm.includesWashing ? (Number(adminPrices.washingSystemBase) || 4500) : 0;
    const feesCost = quoteForm.feesPayer === 'company' ? (Number(adminPrices.feesCost) || 3000) : 0;
    
    const totalBaseCost = panelsCost + constructionCost + totalInvertersCost + totalBatteriesCost + optimizersCost + 
                          logisticsCost + laborCost + engineeringCost + privateCheckCost + 
                          electricianCost + accessoriesCost + electricalBoxCost + washingCost + feesCost;
    
    let profitValue = quoteForm.systemType === 'residential' ? (Number(adminPrices.profitResidentialFixed) || 21000) : (sizeKw * (Number(adminPrices.profitCommercialPerKw) || 630));
    
    const finalPrice = (totalBaseCost + profitValue) || 0;

    const baseCalculatedTariff = calculateTariff(acKw);
    const urbanPremiumMatch = resolveUrbanPremiumFromCity(
      quoteForm.clientCity,
      urbanPremiumCities
    );
    const hasUrbanPremium = urbanPremiumMatch.eligible;
    const projectionStartYear = new Date().getFullYear();
    const baseProductionHours = Number(adminPrices.productionHours) > 0 ? Number(adminPrices.productionHours) : 1700;
    let productionHoursValid = baseProductionHours;
    let orientationDetails = null;

    if (quoteForm.specifyOrientation) {
      const pSouth = Number(quoteForm.panelsSouth) || 0;
      const pEW = Number(quoteForm.panelsEastWest) || 0;
      const pNorth = Number(quoteForm.panelsNorth) || 0;
      const sumPanels = pSouth + pEW + pNorth;
      
      if (sumPanels !== numPanels) {
         setErrorMsg(`שגיאה: סך הפאנלים שהוזנו לכיווני האוויר (${sumPanels}) אינו תואם לסך הפאנלים במערכת (${numPanels}). אנא תקן את החלוקה כדי להמשיך.`);
         return; 
      }

      if (requiredOptimizersForSmallArrays > 0 && !quoteForm.optimizerAcknowledge) {
         setErrorMsg(`שגיאה: חלוקת הפאנלים דורשת התקנת ${requiredOptimizersForSmallArrays} אופטימייזרים לפחות. אנא סמן "V" בתיבת האישור שמתחת לכיווני האוויר.`);
         return;
      }
      
      productionHoursValid = ((pSouth * liveSouthH) + (pEW * liveEWH) + (pNorth * liveNorthH)) / numPanels;
      orientationDetails = { pSouth, southHours: liveSouthH, pEW, ewHours: liveEWH, pNorth, northHours: liveNorthH };
    }
    
    setErrorMsg('');
    setClientSignature(null); // איפוס חתימה בכל הפקה מחדש של ההצעה

    const estimatedYearlyProductionKwhYear1 = sizeKw * productionHoursValid;
    const degradationRate = 0.0033;

    const getTariffForModelYear = (modelYear) =>
      getEffectiveTariffForCalendarYear(
        baseCalculatedTariff,
        hasUrbanPremium,
        projectionStartYear + modelYear - 1
      );

    const getYearlyProductionKwh = (modelYear) =>
      estimatedYearlyProductionKwhYear1 *
      Math.pow(1 - degradationRate, modelYear - 1);

    const getYearlyEstimatedIncome = (modelYear) =>
      getYearlyProductionKwh(modelYear) * getTariffForModelYear(modelYear);

    const calculatedTariff = getTariffForModelYear(1);
    const estimatedYearlySavingsYear1 = getYearlyEstimatedIncome(1);

    const vatRate = Number(adminPrices.vatRate) || 18;
    const initialInvestment = quoteForm.systemType === 'residential' ? finalPrice * (1 + vatRate / 100) : finalPrice;

    let roiYears = 0;
    let annualYield = 0;
    if (estimatedYearlySavingsYear1 > 0 && initialInvestment > 0) {
      annualYield = (estimatedYearlySavingsYear1 / initialInvestment) * 100;
      let cumulativeSavings = 0;
      for (let y = 1; y <= 25; y++) {
        const yearIncome = getYearlyEstimatedIncome(y);
        if (yearIncome <= 0) continue;
        const prevCumulative = cumulativeSavings;
        cumulativeSavings += yearIncome;
        if (cumulativeSavings >= initialInvestment) {
          roiYears = (y - 1) + (initialInvestment - prevCumulative) / yearIncome;
          break;
        }
      }
    }

    const primeRate = Number(adminPrices.primeRate) || 6.0;
    const loanMargin = Number(adminPrices.loanMargin) || 4.0;
    const annualInterestRate = (primeRate + loanMargin) / 100;

    let remainingDebt = initialInvestment;
    const loanSimulation = [];

    for (let year = 1; year <= 25; year++) {
      const currentYearIncome = getYearlyEstimatedIncome(year);

      let yearlyRepaymentAccumulator = 0;
      let monthlyIncome = currentYearIncome / 12;

      for(let m = 0; m < 12; m++) {
         if (remainingDebt > 0) {
           let interestAccrued = remainingDebt * (annualInterestRate / 12);
           remainingDebt += interestAccrued;
           
           if (monthlyIncome >= remainingDebt) {
              yearlyRepaymentAccumulator += remainingDebt;
              remainingDebt = 0;
           } else {
              yearlyRepaymentAccumulator += monthlyIncome;
              remainingDebt -= monthlyIncome;
           }
         }
      }
      
      let netProfit = currentYearIncome - yearlyRepaymentAccumulator;

      loanSimulation.push({
        year: year,
        income: currentYearIncome,
        repayment: yearlyRepaymentAccumulator,
        netProfit: netProfit
      });
    }

    const getCumulativeIncomeWithDegradation = (years) => {
      let total = 0;
      for (let i = 1; i <= years; i++) {
        total += getYearlyEstimatedIncome(i);
      }
      return total;
    };

    const graphData = [
      { year: 0, flow: -initialInvestment }, 
      { year: 5, flow: getCumulativeIncomeWithDegradation(5) - initialInvestment },
      { year: 10, flow: getCumulativeIncomeWithDegradation(10) - initialInvestment },
      { year: 15, flow: getCumulativeIncomeWithDegradation(15) - initialInvestment },
      { year: 20, flow: getCumulativeIncomeWithDegradation(20) - initialInvestment },
      { year: 25, flow: getCumulativeIncomeWithDegradation(25) - initialInvestment },
    ];
    
    const maxProfit = Math.max(1, ...graphData.map(d => d.flow || 0));
    const minLoss = Math.min(0, ...graphData.map(d => d.flow || 0));

    const showLimitedOffer = Boolean(quoteForm.showLimitedOffer);
    const offerExpiresAt = showLimitedOffer ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null;

    const quotePayload = {
      ...quoteForm,
      calculatedNumPanels: numPanels,
      panelPowerWatts: adminPrices.panelPowerWatts,
      productionHoursValid,
      orientationDetails,
      inverterDetailsList,
      batteryDetailsList,
      optimizerDetails,
      optimizerKind,
      optimizerDatasheet: optimizerKind ? normalizeDatasheet(adminPrices.optimizerDatasheets?.[optimizerKind]) : null,
      optimizerLogoUpload: optimizerKind ? normalizeDatasheet(adminPrices.optimizerLogos?.[optimizerKind]) : null,
      panelDatasheet: normalizeDatasheet(adminPrices.panelDatasheet),
      panelLogo: normalizeDatasheet(adminPrices.panelLogo),
      constructionLogo: normalizeDatasheet(adminPrices.constructionLogo),
      constructionDatasheet: normalizeDatasheet(adminPrices.constructionDatasheet),
      hasBatteries,
      baseCalculatedTariff,
      calculatedTariff,
      hasUrbanPremium,
      urbanPremiumMatchedCity: urbanPremiumMatch.matchedCity,
      urbanPremiumAgorotPerKwh: hasUrbanPremium ? URBAN_PREMIUM_AGOROT_PER_KWH : 0,
      urbanPremiumValidUntilYear: hasUrbanPremium ? URBAN_PREMIUM_VALID_UNTIL_YEAR : null,
      projectionStartYear,
      requiredConnectionAmps,
      estimatedYearlyProductionKwh: estimatedYearlyProductionKwhYear1,
      estimatedYearlySavings: estimatedYearlySavingsYear1,
      roiYears,
      annualYield,
      graphData,
      maxProfit,
      minLoss,
      loanSettings: { primeRate, loanMargin, annualInterestRate: primeRate + loanMargin },
      loanSimulation,
      breakdown: {
        panels: panelsCost, construction: constructionCost, inverter: totalInvertersCost, batteries: totalBatteriesCost,
        optimizers: optimizersCost, logistics: logisticsCost, labor: laborCost, engineering: engineeringCost,
        electricianAndChecks: privateCheckCost + electricianCost, electricalBoxes: electricalBoxCost, accessories: accessoriesCost,
        washing: washingCost, fees: feesCost, totalCost: totalBaseCost, marginValue: profitValue, finalPrice: finalPrice
      },
      hasSolarEdgeQuote: inverterDetailsList.some(inv => inv.isSolarEdge),
      showLimitedOffer,
      offerExpiresAt,
      // שמירת פרטי הסוכן שהפיק את ההצעה (כולל תמונה עדכנית מהמחירון)
      agentDetails:
        currentUser?.role === 'agent' && currentUser.data
          ? (() => {
              const tz = String(currentUser.data.tz || '').trim();
              const fresh = adminPrices.agents.find((a) => String(a.tz || '').trim() === tz);
              const base = fresh || currentUser.data;
              return { ...base, photo: normalizeDatasheet(base.photo) };
            })()
          : null,
    };

    setQuoteDraft(quotePayload);
    setAgentOfferPriceInput(String(getCalculatedClientOfferPrice(quotePayload, adminPrices)));
    setActiveTab('priceConfirm');
    window.scrollTo(0, 0);
  };

  const confirmQuoteWithClientPrice = () => {
    if (!quoteDraft) return;
    const amount = Math.round(parseFloat(String(agentOfferPriceInput).replace(/,/g, '')) || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('יש להזין סכום תקין ללקוח (מספר חיובי).');
      return;
    }
    const metrics = recomputeInvestmentMetrics(quoteDraft, amount, adminPrices);
    const showLimitedOffer = Boolean(quoteDraft.showLimitedOffer);
    const offerExpiresAt = showLimitedOffer ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null;
    // #region agent log
    emitAgentDebugLog('run-pre-fix', 'H2', 'App.js:3200', 'Quote draft promoted to generated quote', {
      hasBatteries: quoteDraft.hasBatteries,
      includesBatteries: quoteDraft.includesBatteries,
      batteryDetailsCount: Array.isArray(quoteDraft.batteryDetailsList) ? quoteDraft.batteryDetailsList.length : -1,
      includesOptimizers: quoteDraft.includesOptimizers,
      inverterSystemType: quoteDraft.inverterSystemType,
    });
    // #endregion
    setGeneratedQuote({
      ...quoteDraft,
      ...metrics,
      clientOfferPrice: amount,
      calculatedClientOfferPrice: getCalculatedClientOfferPrice(quoteDraft, adminPrices),
      showLimitedOffer,
      offerExpiresAt,
    });
    setQuoteDraft(null);
    setAgentOfferPriceInput('');
    setErrorMsg('');
    setClientSignature(null);
    setActiveTab('quote');
    window.scrollTo(0, 0);
  };

  const backFromPriceConfirm = () => {
    setQuoteDraft(null);
    setAgentOfferPriceInput('');
    setErrorMsg('');
    setActiveTab('sales');
  };

  const seStatusDisplay = getSolarEdgeStatus();
  const sgStatusDisplay = getSungrowStatus();

  const aggregatedQuoteInverterLogos = useMemo(
    () => aggregateInverterLogosForQuote(generatedQuote?.inverterDetailsList),
    [generatedQuote?.inverterDetailsList]
  );

  /** ממירים ללא קובץ לוגו ב־public — עדיין מוצגים כרטיס טקסט */
  const quoteInvertersWithoutLogoAsset = useMemo(() => {
    const list = generatedQuote?.inverterDetailsList || [];
    return list.filter((inv) => {
      const custom = normalizeDatasheet(inv.customLogo);
      if (custom?.mimeType?.startsWith('image/')) return false;
      const slug = inv.logoSlug;
      return !slug || !inverterLogoSrc(slug);
    });
  }, [generatedQuote?.inverterDetailsList]);

  /** כרטיס אופטימייזרים בהצעה (טייגו / סולאראדג' / כללי) */
  const quoteOptimizerQuoteCard = useMemo(() => {
    if (!generatedQuote?.includesOptimizers) return null;
    const qty = Number(generatedQuote.optimizerDetails?.quantity) || 0;
    if (qty <= 0) return null;
    const typeLabel = String(generatedQuote.optimizerDetails?.type || '').trim();
    const ds = generatedQuote.optimizerDatasheet;
    const uploadSrc = datasheetToSrc(normalizeDatasheet(generatedQuote.optimizerLogoUpload));
    const lower = typeLabel.toLowerCase();
    if (/tigo|טייגו/.test(lower)) {
      if (!generatedQuote.showTigoLogoOnQuote) return null;
      const fallback = `${process.env.PUBLIC_URL}/optimizers/tigo.png`;
      return {
        variant: 'tigo',
        quantity: qty,
        datasheet: ds,
        captionHe: `אופטימייזרים Tigo (${qty} יח')`,
        logoSrc: uploadSrc || fallback,
      };
    }
    if (/sungrow|סנגרואו|סאנגר/.test(lower)) {
      if (!generatedQuote.showSungrowLogoOnQuote) return null;
      const fallback = `${process.env.PUBLIC_URL}/inverters/sungrow.png`;
      return {
        variant: 'sungrow',
        quantity: qty,
        datasheet: ds,
        captionHe: `אופטימייזרים Sungrow (${qty} יח')`,
        logoSrc: uploadSrc || fallback,
      };
    }
    if (/solaredge|סולאראדג/.test(lower)) {
      const fallback = `${process.env.PUBLIC_URL}/inverters/solaredge.png`;
      return {
        variant: 'solaredge',
        quantity: qty,
        datasheet: ds,
        captionHe: `אופטימייזרים ${typeLabel} (${qty} יח')`,
        logoSrc: uploadSrc || fallback,
      };
    }
    return {
      variant: 'generic',
      quantity: qty,
      datasheet: ds,
      captionHe: `אופטימייזרים (${typeLabel}) (${qty} יח')`,
    };
  }, [
    generatedQuote?.includesOptimizers,
    generatedQuote?.optimizerDetails?.quantity,
    generatedQuote?.optimizerDetails?.type,
    generatedQuote?.optimizerDatasheet,
    generatedQuote?.optimizerLogoUpload,
    generatedQuote?.showTigoLogoOnQuote,
    generatedQuote?.showSungrowLogoOnQuote,
  ]);

  const quoteShowConstructionEquipment =
    !!generatedQuote &&
    (Boolean(datasheetToSrc(normalizeDatasheet(generatedQuote.constructionLogo))) ||
      Boolean(normalizeDatasheet(generatedQuote.constructionDatasheet)));

  const quoteShowEquipmentBrandsSection =
    !!generatedQuote &&
    ((generatedQuote.calculatedNumPanels || 0) > 0 ||
      (generatedQuote.inverterDetailsList || []).length > 0 ||
      quoteOptimizerQuoteCard != null ||
      quoteShowConstructionEquipment ||
      generatedQuote.includesWashing ||
      generatedQuote.feesPayer === 'company');

  const quoteEquipmentBrandsTitle = useMemo(() => {
    if (!generatedQuote) return joinHebrewEquipmentTitle([]);
    const parts = [];
    if ((generatedQuote.calculatedNumPanels || 0) > 0) parts.push('פאנלים');
    if ((generatedQuote.inverterDetailsList || []).length > 0) parts.push('ממירים');
    if (quoteOptimizerQuoteCard) parts.push('אופטימייזרים');
    if (generatedQuote.includesWashing) parts.push('שטיפה');
    if (generatedQuote.feesPayer === 'company') parts.push('אגרות חח״י ורשויות');
    const cl = normalizeDatasheet(generatedQuote.constructionLogo);
    const cd = normalizeDatasheet(generatedQuote.constructionDatasheet);
    if ((cl?.mimeType?.startsWith('image/')) || cd) parts.push('קונסטרוקציה');
    return joinHebrewEquipmentTitle(parts);
  }, [generatedQuote, quoteOptimizerQuoteCard]);

  // חישוב זמן נותר להטבה (לתצוגת הטיימר)
  let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const quoteShowsLimitedOffer =
    generatedQuote &&
    (generatedQuote.showLimitedOffer ?? Boolean(generatedQuote.offerExpiresAt));
  if (quoteShowsLimitedOffer && generatedQuote.offerExpiresAt) {
    const distance = generatedQuote.offerExpiresAt - currentTime;
    if (distance > 0) {
      timeLeft = {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        expired: false
      };
    }
  }

  // הגדרת הטלפון עבור הווטסאפ (סוכן או חברה)
  const activePhoneForQuote = generatedQuote?.agentDetails ? generatedQuote.agentDetails.phone : adminPrices.companyPhone;
  // כשמערכת שטיפה כבר בהצעה — ההטבה בבאנר היא תוספת אופטימייזרים; אחרת מתנת שטיפה
  const limitedOfferHighlightShort = generatedQuote?.includesWashing
    ? 'תוספת אופטימייזרים לפי הצורך לתפוקה מקסימלית במקומות מוצללים'
    : 'מערכת שטיפה אוטומטית';
  const whatsappBenefitPhrase = generatedQuote?.includesWashing
    ? 'תוספת האופטימייזרים לפי הצורך לתפוקה מקסימלית במקומות מוצללים'
    : 'מערכת השטיפה במתנה';
  const whatsappMessage = encodeURIComponent(`שלום, אני ${generatedQuote?.clientName ? generatedQuote.clientName : ''} ${generatedQuote?.clientCity ? `מ${generatedQuote.clientCity}` : ''}. עברתי על הצעת המחיר למערכת סולארית ואני מעוניין/ת להתקדם ולנצל את ההטבה של ${whatsappBenefitPhrase}! אשמח שתיצרו איתי קשר.`);
  
  // עיבוד חכם של מספר הטלפון לוואטסאפ (תמיכה אוטומטית במספרים שמתחילים ב-0 והמרתם ל-972)
  let cleanPhone = (activePhoneForQuote || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '972' + cleanPhone.slice(1);
  }
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${whatsappMessage}`;

  const quoteCompanyPaysFees = generatedQuote?.feesPayer === 'company';
  const quoteBatteryStorageSummary = useMemo(
    () => aggregateBatteryStorageSummary(generatedQuote?.batteryDetailsList),
    [generatedQuote?.batteryDetailsList]
  );
  useEffect(() => {
    if (!generatedQuote) return;
    // #region agent log
    emitAgentDebugLog('run-pre-fix', 'H3-H4', 'App.js:3356', 'Generated quote values used by summary and warranty UI', {
      hasBatteries: generatedQuote.hasBatteries,
      includesBatteries: generatedQuote.includesBatteries,
      batteryDetailsCount: Array.isArray(generatedQuote.batteryDetailsList) ? generatedQuote.batteryDetailsList.length : -1,
      batterySummaryKwh: quoteBatteryStorageSummary?.totalKwh ?? null,
      batterySummaryUnits: quoteBatteryStorageSummary?.totalUnits ?? null,
      includesOptimizers: generatedQuote.includesOptimizers,
    });
    // #endregion
  }, [generatedQuote, quoteBatteryStorageSummary]);

  const measureQuotePrintLayout = useCallback(() => {
    const root = document.getElementById('quote-presentation');
    if (!root) {
      // #region agent log
      emitPdfDebugLog('H0', 'quote-presentation-missing', { activeTab });
      // #endregion
      return;
    }
    const pick = (sel) => {
      const el = root.querySelector(sel);
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return {
        present: true,
        heightPx: Math.round(r.height),
        topPx: Math.round(r.top),
        breakBefore: st.breakBefore || st.pageBreakBefore,
        breakAfter: st.breakAfter || st.pageBreakAfter,
      };
    };
    const highlights = root.querySelector('.quote-print-summary [class*="text-green"]');
    const chart = root.querySelector('.quote-print-cashflow-chart');
    const loanTable = root.querySelector('.quote-print-loan-block table');
  // #region agent log
    emitPdfDebugLog('H1-H4', 'before-print-layout', {
      runPhase: 'post-fix',
      rootScrollHeight: root.scrollHeight,
      viewportH: window.innerHeight,
      estimatedPagesA4: Math.ceil(root.scrollHeight / 1050),
      sections: {
        cover: pick('.quote-print-cover'),
        summary: pick('.quote-print-summary'),
        summaryBlocks: pick('.quote-print-summary-blocks'),
        equipment: pick('[aria-labelledby="quote-equipment-brands-heading"]'),
        cashflowSheet: pick('.quote-print-cashflow-sheet'),
        loanChapter: pick('.quote-print-chapter-loan'),
        about: pick('.quote-print-section.bg-slate-50'),
        signature: pick('.quote-print-chapter-start'),
      },
      annualYield: generatedQuote?.annualYield ?? null,
      highlightsBottomPx: highlights ? Math.round(highlights.getBoundingClientRect().bottom) : null,
      chartHeightPx: chart ? Math.round(chart.getBoundingClientRect().height) : null,
      loanRowCount: loanTable ? loanTable.querySelectorAll('tbody tr').length : 0,
      showLoan: Boolean(generatedQuote?.showLoanSimulation),
      showEquipment: Boolean(quoteShowEquipmentBrandsSection),
    });
  // #endregion
  }, [activeTab, generatedQuote, quoteShowEquipmentBrandsSection]);

  useEffect(() => {
    if (activeTab !== 'quote' || !generatedQuote) return undefined;
    const onBeforePrint = () => measureQuotePrintLayout();
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [activeTab, generatedQuote, measureQuotePrintLayout]);

  // --- מסך התחברות (Login Screen) ---
  if (!currentUser) {
    if (shareLinkMalformed) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center text-white"
          dir="rtl"
          style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}
        >
          <AlertCircle className="h-14 w-14 text-amber-400" aria-hidden />
          <p className="max-w-md text-sm text-slate-300">קישור ההצעה אינו תקין. בדקו שהעתקתם את הקישור המלא.</p>
          <Link
            to="/"
            className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
          >
            כניסה למערכת
          </Link>
        </div>
      );
    }
    if (shareQuoteId) {
      if (shareQuoteLoad.phase === 'loading' || shareQuoteLoad.phase === 'idle') {
        return (
          <div
            className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-white"
            dir="rtl"
            style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}
          >
            <Loader2 className="h-12 w-12 animate-spin text-orange-400" aria-hidden />
            <p className="text-center text-sm font-semibold text-slate-300">טוען הצעת מחיר…</p>
          </div>
        );
      }
      if (shareQuoteLoad.phase === 'expired') {
        return (
          <div
            className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center text-white"
            dir="rtl"
            style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}
          >
            <Clock className="h-14 w-14 text-amber-400" aria-hidden />
            <p className="max-w-md text-sm leading-relaxed text-slate-200">{shareQuoteLoad.message}</p>
            {shareQuoteLoad.waHref ? (
              <a
                href={shareQuoteLoad.waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600/25 px-6 py-3.5 text-sm font-black text-emerald-100 shadow-lg transition-all hover:bg-emerald-600/40 hover:scale-[1.02]"
              >
                <Phone className="h-5 w-5 shrink-0" aria-hidden />
                שליחת וואטסאפ לסוכן/ת
              </a>
            ) : (
              <p className="max-w-sm text-xs text-slate-500">
                לא נמצא מספר וואטסאפ במערכת לקישור זה. פנו לחברה בדרכים אחרות.
              </p>
            )}
            <Link
              to="/"
              className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
            >
              כניסה למערכת
            </Link>
          </div>
        );
      }
      if (shareQuoteLoad.phase === 'error') {
        return (
          <div
            className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center text-white"
            dir="rtl"
            style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}
          >
            <AlertCircle className="h-14 w-14 text-red-400" aria-hidden />
            <p className="max-w-md text-sm text-slate-300">{shareQuoteLoad.message}</p>
            <Link
              to="/"
              className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
            >
              כניסה למערכת
            </Link>
          </div>
        );
      }
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl"
           style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}>
         {/* Background photo */}
         <div className="absolute inset-0 z-0 opacity-[0.12]" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509391366360-120953a17a74?auto=format&fit=crop&q=80&w=1600')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
         {/* Radial glow */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)' }}></div>
         
         <div className="relative z-10 w-full max-w-[420px] text-center animation-fade-in">
            {/* Logo above card */}
            <div className="flex flex-col items-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/15 shadow-2xl mb-5 inline-block">
                <BrandLogo className="h-16 w-16" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide">מומחי אנרגיה סולארית</h1>
              <CompanySocialLinks className="mt-4 justify-center" variant="dark" />
            </div>

            {/* Login card */}
            <div className="overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-white/10"
                 style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(20px)' }}>
               {/* gradient accent line */}
               <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #1d4ed8, #f97316, #fbbf24)' }}></div>
               
               <div className="p-10">
                 <h2 className="text-xl font-bold text-white mb-1 tracking-wide">כניסה למערכת</h2>
                 <p className="text-slate-400 mb-8 text-sm">הזן את מספר תעודת הזהות שלך להתחברות</p>
                 
                 <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <input 
                        type="text" 
                        name="loginInput"
                        autoComplete="username"
                        value={loginInput}
                        onChange={(e) => {setLoginInput(e.target.value); setLoginError('');}}
                        placeholder="מספר ת.ז. / סיסמת מנהל"
                        className="w-full rounded-xl p-4 text-white outline-none text-center text-lg tracking-widest transition-all duration-200 border border-white/10 focus:border-blue-500/70"
                        style={{ background: 'rgba(0,0,0,0.35)' }}
                        onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25), 0 8px 30px rgba(0,0,0,0.4)'}
                        onBlur={e => e.target.style.boxShadow = 'none'}
                      />
                      <label className="mt-3 mx-auto flex w-fit items-center justify-center gap-2 text-xs text-slate-300 cursor-pointer select-none" dir="ltr">
                        <input
                          type="checkbox"
                          checked={rememberLogin}
                          onChange={(e) => setRememberLogin(e.target.checked)}
                          className="h-4 w-4 rounded border-white/25 bg-black/30 accent-blue-500"
                        />
                        <span className="leading-none">Запомнить логин</span>
                      </label>
                      {loginError && (
                        <div className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium bg-red-900/20 border border-red-500/20 p-3 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{loginError}</span>
                        </div>
                      )}
                    </div>
                    <button type="submit"
                      className="w-full text-white font-black py-4 rounded-xl text-lg tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-blue-500/30"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                      היכנס למערכת ←
                    </button>
                 </form>
               </div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-200 font-sans p-4 md:p-8 relative overflow-x-hidden print:!bg-white print:min-h-0 print:h-auto print:p-0 print:overflow-visible" dir="rtl"
         style={{ background: 'linear-gradient(160deg, #060d1c 0%, #091526 50%, #0b1a2e 100%)' }}>
      {/* Ambient glow top-right */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none print:hidden"
           style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.5) 0%, transparent 70%)' }}></div>
      {/* Ambient glow bottom-left */}
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-8 pointer-events-none print:hidden"
           style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)' }}></div>

      <div className="max-w-5xl mx-auto relative z-10 print:max-w-none">
        
        {/* Header (Top Nav) */}
        <header className="flex items-center justify-between mb-10 print:hidden">
          {/* Left: Logo + Company Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl opacity-40 blur-sm" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}></div>
              <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20 shadow-2xl">
                <BrandLogo className="h-11 w-11 object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-wide leading-tight">מומחי אנרגיה סולארית</h1>
              <p className="text-blue-400/80 text-xs flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]"></span>
                מחובר:{' '}
                {currentUser.role === 'admin'
                  ? 'מנהל ראשי'
                  : currentUser.role === 'viewer'
                    ? 'צפייה בלבד (קישור ללקוח)'
                    : currentUser.data?.name}
              </p>
            </div>
          </div>
          
          {/* Right: Navigation */}
          <nav className="flex items-center gap-1 rounded-2xl p-1.5 border border-white/10 shadow-xl max-w-full overflow-x-auto"
               style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
            {currentUser.role === 'viewer' ? (
              <>
                <span className="px-3 py-2 text-xs font-semibold text-slate-400">הצעת מחיר</span>
                <div className="mx-1 h-6 w-px bg-white/10" />
                <Link
                  to="/"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-200 transition-all hover:bg-white/10"
                >
                  <Home className="h-4 w-4" aria-hidden />
                  כניסה למערכת
                </Link>
                <div className="mx-1 h-6 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  סגירה
                </button>
              </>
            ) : (
              <>
            <button
              onClick={() => {
                if (activeTab === 'priceConfirm') {
                  setQuoteDraft(null);
                  setAgentOfferPriceInput('');
                }
                setActiveTab('sales');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'sales' || activeTab === 'quote' || activeTab === 'priceConfirm' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              style={activeTab === 'sales' || activeTab === 'quote' || activeTab === 'priceConfirm' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' } : {}}>
              <Calculator className="w-4 h-4" /> מכירות
            </button>
            {currentUser.role === 'admin' && (
              <button onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'admin' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                style={activeTab === 'admin' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' } : {}}>
                <Settings className="w-4 h-4" /> ניהול עלויות
              </button>
            )}
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 font-medium">
              <LogOut className="w-4 h-4" /> התנתק
            </button>
              </>
            )}
          </nav>
        </header>

        <main className="min-w-0 max-w-full print:overflow-visible">
          {/* ================= ADMIN TAB ================= */}
          {activeTab === 'admin' && currentUser.role === 'admin' && (
            <div className="space-y-4 animation-fade-in">
              <div className="mb-8 pb-6 border-b border-white/8">
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                  <span className="text-orange-400"><Settings className="w-6 h-6"/></span>
                  הגדרות בסיס ומחירון
                </h2>
                <p className="text-slate-500">הזן את מחירי העלות של הרכיבים. כל העלויות המוזנות צריכות להיות לפני מע"מ.</p>
                <p className="text-slate-600 text-sm mt-2 max-w-2xl">
                  {supabase
                    ? 'הגדרות המחירון והיועצים נשמרות בענן (Supabase) ומתעדכנות בכל המכשירים. עדיין נשמר עותק מקומי בדפדפן לגיבוי ולמהירות.'
                    : 'הגדרות נשמרות בדפדפן (localStorage) בלבד. להפעלת סנכרון בין מכשירים: הגדרו REACT_APP_SUPABASE_URL ו-REACT_APP_SUPABASE_ANON_KEY (ראו .env.example ו-supabase/schema.sql).'}
                </p>
                {supabase && (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveAdminToCloud}
                      disabled={adminCloudSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100"
                      style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', boxShadow: '0 4px 15px rgba(20,184,166,0.35)' }}
                    >
                      {adminCloudSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : (
                        <CloudUpload className="w-4 h-4" aria-hidden />
                      )}
                      {adminCloudSaving ? 'מעלה קבצים ושומר…' : 'שמור לענן עכשיו'}
                    </button>
                    {adminCloudSaveFeedback && (
                      <span
                        className={`text-sm font-medium ${adminCloudSaveFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
                        role="status"
                      >
                        {adminCloudSaveFeedback.text}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 1. ניהול סוכנים (חדש) */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'agents' ? null : 'agents')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Users className="w-5 h-5 text-orange-400" /><h3 className="text-lg font-semibold text-white">ניהול יועצי מכירות</h3></div>
                  {openAdminSection === 'agents' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'agents' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <p className="text-sm text-slate-400 mb-4">הוסף את היועצים של החברה. תעודת הזהות תשמש כסיסמת ההתחברות שלהם. בהצעת המחיר מוצגים כ«יועץ אישי» — השם והטלפון יופיעו אוטומטית ובלחצן הווטסאפ.</p>
                    <div className="space-y-3">
                      {adminPrices.agents.map(agent => (
                        <div key={agent.id} className="grid grid-cols-1 gap-3 p-4 bg-black/20 border border-white/8 rounded-xl relative pr-10 md:pr-4">
                          <button onClick={() => removeAdminListItem('agents', agent.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div><label className="text-slate-500 text-xs block mb-1">שם מלא</label><input type="text" value={agent.name} onChange={(e) => updateAdminListItem('agents', agent.id, 'name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" placeholder="שם היועץ" /></div>
                            <div><label className="text-slate-500 text-xs block mb-1">טלפון (לווטסאפ)</label><input type="text" value={agent.phone} onChange={(e) => updateAdminListItem('agents', agent.id, 'phone', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" placeholder="050-0000000" dir="ltr" /></div>
                            <div><label className="text-slate-500 text-xs block mb-1">מספר ת"ז (להתחברות)</label><input type="text" value={agent.tz} onChange={(e) => updateAdminListItem('agents', agent.id, 'tz', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all font-mono tracking-widest text-center" /></div>
                          </div>
                          <AdminLogoRow
                            label="תמונת יועץ להצעת מחיר (עיגול / ריבוע אחיד אוטומטית)"
                            logo={agent.photo}
                            onFile={(f) => attachAgentPhotoFile(agent.id, f)}
                            onClear={() => updateAdminListItem('agents', agent.id, 'photo', null)}
                          />
                        </div>
                      ))}
                      <button onClick={() => addAdminListItem('agents', { name: 'יועץ חדש', phone: '050-', tz: '', photo: null })} className="w-full mt-2 flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 p-3 rounded-xl font-medium transition-all">
                        <Plus className="w-5 h-5" /> הוסף יועץ למערכת
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. פאנלים והמרות */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'panels' ? null : 'panels')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">פאנלים והמרות מטבע</h3></div>
                  {openAdminSection === 'panels' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'panels' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">הספק פאנל בודד (וואט)</label>
                        <input type="number" name="panelPowerWatts" value={adminPrices.panelPowerWatts} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">שעות שמש בשנה (לחישוב הכנסה)</label>
                        <input type="number" name="productionHours" value={adminPrices.productionHours} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">מחיר פאנלים (וואט/$)</label>
                        <input type="number" step="0.001" name="panelPricePerWattUsd" value={adminPrices.panelPricePerWattUsd} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">שער דולר (₪)</label>
                        <input type="number" step="0.01" name="usdExchangeRate" value={adminPrices.usdExchangeRate} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                    </div>
                    <AdminLogoRow
                      label="לוגו פאנלים להצעת מחיר (מותאם אוטומטית למלבן אחיד)"
                      logo={adminPrices.panelLogo}
                      onFile={attachPanelLogoFile}
                      onClear={() => setAdminPrices((prev) => ({ ...prev, panelLogo: null }))}
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט / מפרט טכני לפאנל (PDF או תמונה)"
                      datasheet={adminPrices.panelDatasheet}
                      onFile={attachPanelDatasheetFile}
                      onClear={() => setAdminPrices(prev => ({ ...prev, panelDatasheet: null }))}
                    />
                  </div>
                )}
              </div>

              {/* 3. קונסטרוקציה */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'construction' ? null : 'construction')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Sun className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">עלויות קונסטרוקציה</h3></div>
                  {openAdminSection === 'construction' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'construction' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-3">
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">גג בטון (₪ ל-kWp)</span><input type="number" name="constructionConcretePerKw" value={adminPrices.constructionConcretePerKw} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">גג אחר (₪ ל-kWp)</span><input type="number" name="constructionOtherPerKw" value={adminPrices.constructionOtherPerKw} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <AdminLogoRow
                      label="לוגו קונסטרוקציה להצעת מחיר"
                      logo={adminPrices.constructionLogo}
                      onFile={attachConstructionLogoFile}
                      onClear={() => setAdminPrices((prev) => ({ ...prev, constructionLogo: null }))}
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט / מסמך קונסטרוקציה"
                      datasheet={adminPrices.constructionDatasheet}
                      onFile={attachConstructionDatasheetFile}
                      onClear={() => setAdminPrices((prev) => ({ ...prev, constructionDatasheet: null }))}
                    />
                  </div>
                )}
              </div>

              {/* 4. אופטימייזרים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'optimizers' ? null : 'optimizers')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון אופטימייזרים</h3></div>
                  {openAdminSection === 'optimizers' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'optimizers' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300 w-full shrink-0 sm:w-[42%]">SolarEdge 1:1 (₪)</span><input type="number" name="se1to1" value={adminPrices.optimizerPrices.se1to1} onChange={handleOptimizerPriceChange} className="min-w-[8rem] flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <AdminLogoRow
                      label="לוגו SolarEdge 1:1 להצעה (אופציונלי — דורס את ברירת המחדל)"
                      logo={adminPrices.optimizerLogos?.se1to1}
                      onFile={(f) => attachOptimizerLogoFile('se1to1', f)}
                      onClear={() =>
                        setAdminPrices((prev) => ({
                          ...prev,
                          optimizerLogos: { ...(prev.optimizerLogos || {}), se1to1: null },
                        }))
                      }
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט לאופטימייזר SolarEdge 1:1"
                      datasheet={adminPrices.optimizerDatasheets?.se1to1}
                      onFile={(f) => attachOptimizerDatasheetFile('se1to1', f)}
                      onClear={() => setAdminPrices(prev => ({ ...prev, optimizerDatasheets: { ...prev.optimizerDatasheets, se1to1: null } }))}
                    />
                    <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300 w-full shrink-0 sm:w-[42%]">SolarEdge 1:2 (₪)</span><input type="number" name="se1to2" value={adminPrices.optimizerPrices.se1to2} onChange={handleOptimizerPriceChange} className="min-w-[8rem] flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <AdminLogoRow
                      label="לוגו SolarEdge 1:2 להצעה"
                      logo={adminPrices.optimizerLogos?.se1to2}
                      onFile={(f) => attachOptimizerLogoFile('se1to2', f)}
                      onClear={() =>
                        setAdminPrices((prev) => ({
                          ...prev,
                          optimizerLogos: { ...(prev.optimizerLogos || {}), se1to2: null },
                        }))
                      }
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט לאופטימייזר SolarEdge 1:2"
                      datasheet={adminPrices.optimizerDatasheets?.se1to2}
                      onFile={(f) => attachOptimizerDatasheetFile('se1to2', f)}
                      onClear={() => setAdminPrices(prev => ({ ...prev, optimizerDatasheets: { ...prev.optimizerDatasheets, se1to2: null } }))}
                    />
                    <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300 w-full shrink-0 sm:w-[42%]">טייגו (Tigo) (₪)</span><input type="number" name="tigo" value={adminPrices.optimizerPrices.tigo} onChange={handleOptimizerPriceChange} className="min-w-[8rem] flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <AdminLogoRow
                      label="לוגו Tigo להצעה"
                      logo={adminPrices.optimizerLogos?.tigo}
                      onFile={(f) => attachOptimizerLogoFile('tigo', f)}
                      onClear={() =>
                        setAdminPrices((prev) => ({
                          ...prev,
                          optimizerLogos: { ...(prev.optimizerLogos || {}), tigo: null },
                        }))
                      }
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט לאופטימייזר Tigo"
                      datasheet={adminPrices.optimizerDatasheets?.tigo}
                      onFile={(f) => attachOptimizerDatasheetFile('tigo', f)}
                      onClear={() => setAdminPrices(prev => ({ ...prev, optimizerDatasheets: { ...prev.optimizerDatasheets, tigo: null } }))}
                    />
                    <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300 w-full shrink-0 sm:w-[42%]">Sungrow (₪)</span><input type="number" name="sungrow" value={adminPrices.optimizerPrices.sungrow} onChange={handleOptimizerPriceChange} className="min-w-[8rem] flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <AdminLogoRow
                      label="לוגו Sungrow להצעה"
                      logo={adminPrices.optimizerLogos?.sungrow}
                      onFile={(f) => attachOptimizerLogoFile('sungrow', f)}
                      onClear={() =>
                        setAdminPrices((prev) => ({
                          ...prev,
                          optimizerLogos: { ...(prev.optimizerLogos || {}), sungrow: null },
                        }))
                      }
                    />
                    <AdminDatasheetRow
                      label="דאטהשיט לאופטימייזר Sungrow"
                      datasheet={adminPrices.optimizerDatasheets?.sungrow}
                      onFile={(f) => attachOptimizerDatasheetFile('sungrow', f)}
                      onClear={() => setAdminPrices(prev => ({ ...prev, optimizerDatasheets: { ...prev.optimizerDatasheets, sungrow: null } }))}
                    />
                  </div>
                )}
              </div>

              {/* 5. ניהול ממירים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'inverters' ? null : 'inverters')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון ממירים</h3></div>
                  {openAdminSection === 'inverters' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'inverters' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-6">
                    <div>
                      <h4 className="text-blue-300 font-bold mb-3 border-b border-white/10 pb-2">ממירי אונגריד (On-Grid)</h4>
                      <div className="space-y-3">
                        {adminPrices.inverters.map(inv => (
                          <div key={inv.id} className="p-3 bg-black/20 border border-white/8 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                              <input type="text" value={inv.name} onChange={(e) => updateAdminListItem('inverters', inv.id, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-white/15 p-1 text-white outline-none focus:border-blue-400 transition-all" placeholder="שם הממיר" />
                              <button onClick={() => removeAdminListItem('inverters', inv.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="flex gap-2 text-sm">
                              <div className="flex-1"><label className="text-slate-500 text-xs block">הספק (kW)</label><input type="number" value={inv.capacityKw} onChange={(e) => updateAdminListItem('inverters', inv.id, 'capacityKw', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                              <div className="flex-1"><label className="text-slate-500 text-xs block">עלות (₪)</label><input type="number" value={inv.cost} onChange={(e) => updateAdminListItem('inverters', inv.id, 'cost', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                              <input type="checkbox" checked={inv.isSolarEdge} onChange={(e) => updateAdminListItem('inverters', inv.id, 'isSolarEdge', e.target.checked)} className="w-4 h-4 accent-blue-500" />
                              <span className="text-xs text-blue-300">הגדר כממיר סולאראדג'</span>
                            </label>
                            <div className="w-full mt-2">
                              <label className="text-slate-500 text-xs block mb-1">לוגו בהצעת מחיר</label>
                              <select
                                value={inv.inverterLogoKey || 'auto'}
                                onChange={(e) => updateAdminListItem('inverters', inv.id, 'inverterLogoKey', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm outline-none focus:border-blue-500/60"
                              >
                                <option value="auto">אוטומטי לפי שם</option>
                                <option value="solaredge">SolarEdge</option>
                                <option value="sungrow">Sungrow</option>
                                <option value="growatt">Growatt</option>
                                <option value="solis">Solis</option>
                                <option value="none">ללא לוגו</option>
                              </select>
                            </div>
                            <AdminLogoRow
                              label="לוגו מותאם לממיר (דורס לוגו מהרשימה — מותאם אוטומטית להצעה)"
                              logo={inv.customLogo}
                              onFile={(f) => attachRasterToAdminListItem('inverters', inv.id, 'customLogo', f)}
                              onClear={() => updateAdminListItem('inverters', inv.id, 'customLogo', null)}
                            />
                            <AdminDatasheetRow
                              label="דאטהשיט / מפרט טכני לממיר"
                              datasheet={inv.datasheet}
                              onFile={(f) => attachDatasheetToListItem('inverters', inv.id, f)}
                              onClear={() => updateAdminListItem('inverters', inv.id, 'datasheet', null)}
                            />
                          </div>
                        ))}
                        <button onClick={() => addAdminListItem('inverters', { name: 'ממיר חדש', cost: 0, capacityKw: 10, isSolarEdge: false, inverterLogoKey: 'auto', customLogo: null, datasheet: null })} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 p-2 rounded-xl text-sm transition-all">
                          <Plus className="w-4 h-4" /> הוסף ממיר אונגריד
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-blue-300 font-bold mb-3 border-b border-white/10 pb-2">ממירים היברידיים (Hybrid)</h4>
                      <div className="space-y-3">
                        {adminPrices.invertersHybrid.map(inv => (
                          <div key={inv.id} className="p-3 bg-black/20 border border-white/8 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                              <input type="text" value={inv.name} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-white/15 p-1 text-white outline-none focus:border-blue-400 transition-all" placeholder="שם הממיר" />
                              <button onClick={() => removeAdminListItem('invertersHybrid', inv.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="flex gap-2 text-sm">
                              <div className="flex-1"><label className="text-slate-500 text-xs block">הספק (kW)</label><input type="number" value={inv.capacityKw} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'capacityKw', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                              <div className="flex-1"><label className="text-slate-500 text-xs block">עלות (₪)</label><input type="number" value={inv.cost} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'cost', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                              <input type="checkbox" checked={inv.isSolarEdge} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'isSolarEdge', e.target.checked)} className="w-4 h-4 accent-blue-500" />
                              <span className="text-xs text-blue-300">הגדר כממיר סולאראדג'</span>
                            </label>
                            <div className="w-full mt-2">
                              <label className="text-slate-500 text-xs block mb-1">לוגו בהצעת מחיר</label>
                              <select
                                value={inv.inverterLogoKey || 'auto'}
                                onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'inverterLogoKey', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm outline-none focus:border-blue-500/60"
                              >
                                <option value="auto">אוטומטי לפי שם</option>
                                <option value="solaredge">SolarEdge</option>
                                <option value="sungrow">Sungrow</option>
                                <option value="growatt">Growatt</option>
                                <option value="solis">Solis</option>
                                <option value="none">ללא לוגו</option>
                              </select>
                            </div>
                            <AdminLogoRow
                              label="לוגו מותאם לממיר (דורס לוגו מהרשימה)"
                              logo={inv.customLogo}
                              onFile={(f) => attachRasterToAdminListItem('invertersHybrid', inv.id, 'customLogo', f)}
                              onClear={() => updateAdminListItem('invertersHybrid', inv.id, 'customLogo', null)}
                            />
                            <AdminDatasheetRow
                              label="דאטהשיט / מפרט טכני לממיר"
                              datasheet={inv.datasheet}
                              onFile={(f) => attachDatasheetToListItem('invertersHybrid', inv.id, f)}
                              onClear={() => updateAdminListItem('invertersHybrid', inv.id, 'datasheet', null)}
                            />
                          </div>
                        ))}
                        <button onClick={() => addAdminListItem('invertersHybrid', { name: 'ממיר היברידי חדש', cost: 0, capacityKw: 10, isSolarEdge: false, inverterLogoKey: 'auto', customLogo: null, datasheet: null })} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 p-2 rounded-xl text-sm transition-all">
                          <Plus className="w-4 h-4" /> הוסף ממיר היברידי
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. ניהול סוללות אגירה */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'batteries' ? null : 'batteries')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><BatteryCharging className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון סוללות אגירה</h3></div>
                  {openAdminSection === 'batteries' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'batteries' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-3">
                     {adminPrices.batteries.map(bat => (
                        <div key={bat.id} className="space-y-2 p-3 bg-black/20 border border-white/8 rounded-xl">
                          <div className="flex items-center gap-2">
                            <input type="text" value={bat.name} onChange={(e) => updateAdminListItem('batteries', bat.id, 'name', e.target.value)} className="flex-1 bg-transparent text-white outline-none focus:border-blue-400 transition-all" />
                            <div className="flex items-center gap-1 border-r border-white/10 pr-2">
                               <span className="text-slate-400 text-sm">₪</span>
                               <input type="number" value={bat.cost} onChange={(e) => updateAdminListItem('batteries', bat.id, 'cost', parseFloat(e.target.value)||0)} className="w-24 bg-transparent text-white outline-none focus:border-blue-400 transition-all" />
                            </div>
                            <button onClick={() => removeAdminListItem('batteries', bat.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <AdminLogoRow
                            label="לוגו סוללה להצעת מחיר"
                            logo={bat.logo}
                            onFile={(f) => attachRasterToAdminListItem('batteries', bat.id, 'logo', f)}
                            onClear={() => updateAdminListItem('batteries', bat.id, 'logo', null)}
                          />
                          <AdminDatasheetRow
                            label="דאטהשיט לסוללה"
                            datasheet={bat.datasheet}
                            onFile={(f) => attachDatasheetToListItem('batteries', bat.id, f)}
                            onClear={() => updateAdminListItem('batteries', bat.id, 'datasheet', null)}
                          />
                        </div>
                     ))}
                     <button onClick={() => addAdminListItem('batteries', { name: 'סוללה חדשה', cost: 0, logo: null, datasheet: null })} className="mt-3 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <Plus className="w-4 h-4" /> הוסף סוללה למחירון
                     </button>
                  </div>
                )}
              </div>

              {/* 7. עבודה, הובלות ואביזרים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'labor' ? null : 'labor')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><HardHat className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">עבודה, הובלות ואביזרים</h3></div>
                  {openAdminSection === 'labor' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'labor' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm text-slate-400 mb-1">הובלות ולוגיסטיקה (פיקס) - ₪</label><input type="number" name="logisticsCost" value={adminPrices.logisticsCost} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">מהנדס קונסטרוקטור (פיקס) - ₪</label><input type="number" name="constructorEngineer" value={adminPrices.constructorEngineer} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div className="md:col-span-2"><label className="block text-sm text-blue-300 font-medium mb-1">תוספת התקנה למערכת היברידית</label><input type="number" name="hybridBatteryInstallCost" value={adminPrices.hybridBatteryInstallCost} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">עבודת התקנה (לפי סוג מערכת) — ₪ לכל kWp</h4>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת ביתית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">עבודת התקנה (₪ לכל kWp)</span><input type="number" name="laborPerKwResidential" value={adminPrices.laborPerKwResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת מסחרית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">עבודת התקנה (₪ לכל kWp)</span><input type="number" name="laborPerKwCommercial" value={adminPrices.laborPerKwCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">בדיקות וחשמלאי (לפי סוג מערכת)</h4>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת ביתית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">בדיקה פרטית (₪)</span><input type="number" name="privateCheckResidential" value={adminPrices.privateCheckResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">חשמלאי (₪)</span><input type="number" name="electricianResidential" value={adminPrices.electricianResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת מסחרית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">בדיקה פרטית (₪)</span><input type="number" name="privateCheckCommercial" value={adminPrices.privateCheckCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">חשמלאי (₪)</span><input type="number" name="electricianCommercial" value={adminPrices.electricianCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">אביזרים וכבלים (₪)</h4>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (ביתי On-Grid)</span><input type="number" name="acCableOnGridResidential" value={adminPrices.acCableOnGridResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (ביתי היברידי)</span><input type="number" name="acCableHybridResidential" value={adminPrices.acCableHybridResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (מסחרי)</span><input type="number" name="acCableCommercial" value={adminPrices.acCableCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">אנטנה לממיר</span><input type="number" name="antennaCost" value={adminPrices.antennaCost} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">לחצן חירום / קו תקשורת</span><input type="number" name="communicationLine" value={adminPrices.communicationLine} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">קופסאות ולוחות חשמל (₪)</h4>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">מערכת ביתית (פיקס)</span><input type="number" name="electricalBoxResidential" value={adminPrices.electricalBoxResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">מערכת מסחרית (לכל kWp)</span><input type="number" name="electricalBoxCommercialPerKw" value={adminPrices.electricalBoxCommercialPerKw} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 8. תוספות, מס ורווחים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'profit' ? null : 'profit')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><DollarSign className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">תוספות, רווחים ומס</h3></div>
                  {openAdminSection === 'profit' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'profit' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="block text-sm text-slate-400 mb-1">מערכת שטיפה (פיקס) - ₪</label><input type="number" name="washingSystemBase" value={adminPrices.washingSystemBase} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">אגרות ורישוי (פיקס) - ₪</label><input type="number" name="feesCost" value={adminPrices.feesCost} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div>
                        <label className="block text-sm text-blue-300 font-medium mb-1">מע"מ (%)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" name="vatRate" value={adminPrices.vatRate} onChange={handleAdminChange} className="w-full bg-blue-500/10 border border-blue-500/25 rounded-xl p-3 text-blue-300 font-bold outline-none focus:border-blue-500/60 transition-all" />
                          <span className="text-slate-400 font-bold">%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">כל מחירי העלות המוזנים במערכת הם לפני מע"מ.</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm text-blue-300 font-medium mb-1">רווח למערכת ביתית (₪ - פיקס)</label><input type="number" name="profitResidentialFixed" value={adminPrices.profitResidentialFixed} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-blue-300 font-medium mb-1">רווח למערכת מסחרית (₪ לכל kWp)</label><input type="number" name="profitCommercialPerKw" value={adminPrices.profitCommercialPerKw} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    {/* סימולציית הלוואות וטלפון חברה */}
                    <div className="pt-4 border-t border-white/8 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <h4 className="md:col-span-3 text-sm font-medium text-blue-300 mb-1">מימון וטלפון ראשי של החברה</h4>
                      <div><label className="block text-sm text-slate-400 mb-1">ריבית פריים (%)</label><input type="number" step="0.1" name="primeRate" value={adminPrices.primeRate} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">מרווח בנקאי (%)</label><input type="number" step="0.1" name="loanMargin" value={adminPrices.loanMargin} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">טלפון ראשי לווטסאפ</label><input type="text" name="companyPhone" value={adminPrices.companyPhone} onChange={handleAdminChange} placeholder="04-611-61-33" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" dir="ltr" /></div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ================= SALES TAB ================= */}
          {activeTab === 'sales' && (
            <form onSubmit={calculateQuote} className="space-y-6 animation-fade-in">
              <div className="mb-8 pb-6 border-b border-white/8">
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                  <span className="text-orange-400"><FileText className="w-6 h-6"/></span>
                  יצירת הצעת מחיר חדשה
                </h2>
                <p className="text-slate-500">הזן את פרטי הלקוח ואפיין את המערכת הרצויה.</p>
              </div>

              {/* בחירת סוג מערכת */}
              <div className="flex gap-4 mb-6">
                <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${quoteForm.systemType === 'residential' ? 'border-blue-500/70 text-blue-200 shadow-[0_0_25px_rgba(59,130,246,0.25)]' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                      style={quoteForm.systemType === 'residential' ? { background: 'linear-gradient(135deg, rgba(29,78,216,0.25), rgba(37,99,235,0.12))' } : { background: 'rgba(255,255,255,0.035)' }}>
                  <input type="radio" name="systemType" value="residential" checked={quoteForm.systemType === 'residential'} onChange={handleFormChange} className="hidden" />
                  <span className="text-2xl">🏠</span><span className="font-bold text-lg">מערכת ביתית (פרטית)</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${quoteForm.systemType === 'commercial' ? 'border-blue-500/70 text-blue-200 shadow-[0_0_25px_rgba(59,130,246,0.25)]' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                      style={quoteForm.systemType === 'commercial' ? { background: 'linear-gradient(135deg, rgba(29,78,216,0.25), rgba(37,99,235,0.12))' } : { background: 'rgba(255,255,255,0.035)' }}>
                  <input type="radio" name="systemType" value="commercial" checked={quoteForm.systemType === 'commercial'} onChange={handleFormChange} className="hidden" />
                  <span className="text-2xl">🏢</span><span className="font-bold text-lg">מערכת מסחרית</span>
                </label>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
                {/* פרטי לקוח */}
                <div className="h-fit min-w-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:col-span-1"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
                  <div className="h-0.5 w-full" style={{ background: 'linear-gradient(to right, #f97316, #fbbf24, transparent)' }}></div>
                  <div className="min-w-0 p-7">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 border-b border-white/8 pb-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.2)' }}><User className="w-4 h-4 text-blue-400" /></div>
                      פרטי הלקוח
                    </h3>
                    <div className="min-w-0 space-y-5">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">שם הלקוח / חברה</label>
                        <input required type="text" name="clientName" value={quoteForm.clientName} onChange={handleFormChange}
                          className="w-full min-w-0 max-w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:bg-white/8"
                          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">יישוב / עיר</label>
                        <input type="text" name="clientCity" value={quoteForm.clientCity} onChange={handleFormChange}
                          className="w-full min-w-0 max-w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:bg-white/8"
                          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                        <p className="mt-2 text-xs text-slate-500 leading-snug">
                          פרמיה אורבנית (חח&quot;י) — {URBAN_PREMIUM_AGOROT_PER_KWH} אגורות לתעריף המשוקלל עד {URBAN_PREMIUM_VALID_UNTIL_YEAR} — תתווסף אוטומטית אם היישוב ברשימת הזכאים (התאמה של לפחות 80%).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* אפיון המערכת */}
                <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:col-span-2"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
                  <div className="h-0.5 w-full" style={{ background: 'linear-gradient(to right, #1d4ed8, #3b82f6, transparent)' }}></div>
                  <div className="min-w-0 p-7">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 border-b border-white/8 pb-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.2)' }}><Settings className="w-4 h-4 text-blue-400" /></div>
                      אפיון המערכת
                    </h3>
                  <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">גודל מערכת DC (kWp)</label>
                      <input required type="number" step="0.1" min="1" name="systemSizeKw" value={quoteForm.systemSizeKw} onChange={handleDcSizeChange}
                        className="w-full min-w-0 max-w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-2xl font-black outline-none transition-all duration-200 focus:border-blue-500/60"
                        onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      <p className="text-xs text-slate-500 mt-2">יחושב כ- <strong className="text-blue-400">{currentCalculatedPanels}</strong> פאנלים</p>
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">גודל מערכת AC (kWp)</label>
                      <input required type="number" step="0.1" min="1" name="systemSizeAcKw" value={quoteForm.systemSizeAcKw} onChange={handleFormChange}
                        className="w-full min-w-0 max-w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-2xl font-black outline-none transition-all duration-200 focus:border-blue-500/60"
                        onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      <p className="text-xs text-slate-500 mt-2">מחושב אוטומטית לפי ה-DC אך ניתן לשינוי</p>
                    </div>
                    <div className="mt-2 min-w-0 md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סוג גג</label>
                      <select name="roofType" value={quoteForm.roofType} onChange={handleFormChange}
                        className="w-full min-w-0 max-w-full bg-slate-950 border border-white/15 rounded-xl p-3.5 text-slate-100 outline-none transition-all duration-200 focus:border-blue-500/60 [color-scheme:dark]">
                        <option value="concrete" className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>גג בטון (דורש משקולות)</option>
                        <option value="other" className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>גג רגיל (איסכורית / פאנל / רעפים)</option>
                      </select>
                    </div>
                  
                    {/* סוג ממיר */}
                    <div className="mt-2 min-w-0 md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סוג מערכת ההמרה</label>
                      <div className="flex min-w-0 flex-wrap gap-3">
                        <label className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border p-3.5 text-center transition-all duration-200 ${quoteForm.inverterSystemType === 'ongrid' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                               style={quoteForm.inverterSystemType === 'ongrid' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                          <input type="radio" name="inverterSystemType" value="ongrid" checked={quoteForm.inverterSystemType === 'ongrid'} onChange={handleFormChange} className="hidden" />
                          <span className="min-w-0 break-words">מערכת אונגריד (On-Grid)</span>
                        </label>
                        <label className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border p-3.5 text-center transition-all duration-200 ${quoteForm.inverterSystemType === 'hybrid' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                               style={quoteForm.inverterSystemType === 'hybrid' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                          <input type="radio" name="inverterSystemType" value="hybrid" checked={quoteForm.inverterSystemType === 'hybrid'} onChange={handleFormChange} className="hidden" />
                          <span className="min-w-0 break-words">מערכת היברידית (Hybrid)</span>
                        </label>
                      </div>
                    </div>

                    {/* בחירת ממירים */}
                    <div className="min-w-0 md:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <label className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">בחירת ממירים</label>
                      {(() => {
                        const isHybrid = quoteForm.inverterSystemType === 'hybrid';
                        const adminList = isHybrid ? adminPrices.invertersHybrid : adminPrices.inverters;
                        const formListName = isHybrid ? 'selectedHybridInverters' : 'selectedInverters';
                        const currentSelections = quoteForm[formListName];
                        const inverterOptions = filterInvertersForQuote(adminList, quoteForm.systemType);
                        if (adminList.length === 0) return <p className="text-sm text-red-400">לא קיימים דגמים במערכת.</p>;
                        if (inverterOptions.length === 0) {
                          return (
                            <p className="text-sm text-amber-400">
                              אין ממירים המתאימים לסוג המערכת הנבחר (עד {INVERTER_CAPACITY_SPLIT_KW} קוטל לעומת החל מ-{INVERTER_CAPACITY_SPLIT_KW} קוטל). עדכן את רשימת הממירים בהגדרות אדמין.
                            </p>
                          );
                        }
                        return (
                          <>
                            <div className="space-y-3">
                              {currentSelections.map((item, index) => (
                                <div key={index} className="flex min-w-0 flex-wrap items-center gap-3">
                                  <select value={item.id} onChange={(e) => handleQuoteListChange(formListName, index, 'id', e.target.value)} className="min-w-0 flex-1 basis-[12rem] bg-slate-950 border border-white/15 rounded-xl p-2.5 text-slate-100 outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]">
                                    {inverterOptions.map(inv => (<option key={inv.id} value={inv.id} className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>{inv.name}</option>))}
                                  </select>
                                  <div className="w-28 flex items-center bg-white/5 border border-white/10 rounded-xl">
                                     <span className="pl-2 text-slate-500 text-sm">כמות:</span>
                                     <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuoteListChange(formListName, index, 'quantity', e.target.value)} className="w-full bg-transparent p-2 text-white outline-none" />
                                  </div>
                                  <button type="button" onClick={() => removeQuoteListItem(formListName, index)} className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => addQuoteListItem(formListName, isHybrid ? 'invertersHybrid' : 'inverters')} className="mt-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                              <Plus className="w-4 h-4" /> הוסף ממיר
                            </button>
                          </>
                        );
                      })()}
                    </div>

                    {/* סוללות */}
                    {quoteForm.inverterSystemType === 'hybrid' && (
                      <div className="md:col-span-2 p-5 bg-blue-950/20 border border-blue-500/20 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                          <input type="checkbox" name="includesBatteries" checked={quoteForm.includesBatteries} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <div><span className="block text-white font-semibold text-lg">המערכת כוללת סוללות אגירה</span></div>
                        </label>
                        {quoteForm.includesBatteries && (
                           <div className="mt-4 border-t border-white/10 pt-4">
                             <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-3">בחירת סוללות אגירה</label>
                             {adminPrices.batteries.length === 0 ? <p className="text-sm text-red-400">לא הוגדרו סוללות באדמין.</p> : (
                               <>
                                 <div className="space-y-3">
                                   {quoteForm.selectedBatteries.map((item, index) => (
                                     <div key={index} className="flex min-w-0 flex-wrap items-center gap-3">
                                       <select value={item.id} onChange={(e) => handleQuoteListChange('selectedBatteries', index, 'id', e.target.value)} className="min-w-0 flex-1 basis-[12rem] bg-slate-950 border border-white/15 rounded-xl p-2.5 text-slate-100 outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]">
                                         {adminPrices.batteries.map(bat => (<option key={bat.id} value={bat.id} className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>{bat.name}</option>))}
                                       </select>
                                       <div className="w-28 flex items-center bg-white/5 border border-white/10 rounded-xl"><span className="pl-2 text-slate-500 text-sm">כמות:</span><input type="number" min="1" value={item.quantity} onChange={(e) => handleQuoteListChange('selectedBatteries', index, 'quantity', e.target.value)} className="w-full bg-transparent p-2 text-white outline-none" /></div>
                                       <button type="button" onClick={() => removeQuoteListItem('selectedBatteries', index)} className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                     </div>
                                   ))}
                                 </div>
                                 <button type="button" onClick={() => addQuoteListItem('selectedBatteries', 'batteries')} className="mt-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"><Plus className="w-4 h-4" /> הוסף סוללה</button>
                               </>
                             )}
                           </div>
                        )}
                      </div>
                    )}

                    <div className="md:col-span-2 space-y-3 pt-2 border-t border-white/8 mt-2">
                      <div className="bg-black/15 border border-white/8 rounded-2xl overflow-hidden">
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                          <input type="checkbox" name="includesOptimizers" checked={quoteForm.includesOptimizers} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <span className="block text-white font-semibold">כולל אופטימייזרים (Optimizers)</span>
                        </label>
                        {quoteForm.includesOptimizers && (
                          <div className="px-4 pb-4 pt-2 border-t border-white/8 bg-black/15 ml-12 space-y-3">
                            {seStatusDisplay.hasSolarEdge ? (
                               <p className="text-sm text-blue-300">זוהה ממיר SolarEdge במערכת — לפי הספק AC ({quoteForm.systemSizeAcKw} kWp): {solarEdgeOptimizerUsesOneToTwo(quoteForm.systemSizeAcKw) ? 'אופטימייזרים 1:2' : 'אופטימייזרים 1:1'}.</p>
                            ) : sgStatusDisplay.hasSungrow ? (
                               <>
                                 <p className="text-sm text-orange-300">זוהה ממיר Sungrow — אופטימייזרים לפי מחירון Sungrow (ברירת מחדל: מספר הפאנלים).</p>
                                 <div className="flex flex-wrap items-center gap-3 mt-1"><label className="text-sm text-slate-400">כמות Sungrow:</label><input type="number" min="1" name="sungrowQuantity" value={quoteForm.sungrowQuantity} onChange={handleFormChange} className="w-24 bg-white/5 border border-white/10 rounded-xl p-2 text-white focus:border-orange-500/60 transition-all" placeholder="פאנלים" /></div>
                                 <label className="flex items-center gap-3 cursor-pointer rounded-xl bg-black/20 border border-white/10 p-3 hover:bg-white/5 transition-colors">
                                   <input type="checkbox" name="showSungrowLogoOnQuote" checked={quoteForm.showSungrowLogoOnQuote} onChange={handleFormChange} className="w-5 h-5 accent-orange-500 rounded shrink-0" />
                                   <span className="text-sm text-slate-200 font-medium">הצג לוגו Sungrow בהצעת המחיר (מערכת עם אופטימייזרים)</span>
                                 </label>
                               </>
                            ) : (
                               <>
                                 <div className="flex flex-wrap items-center gap-3 mt-1"><label className="text-sm text-slate-400">כמות Tigo:</label><input type="number" min="1" name="tigoQuantity" value={quoteForm.tigoQuantity} onChange={handleFormChange} className="w-24 bg-white/5 border border-white/10 rounded-xl p-2 text-white focus:border-blue-500/60 transition-all" /></div>
                                 <label className="flex items-center gap-3 cursor-pointer rounded-xl bg-black/20 border border-white/10 p-3 hover:bg-white/5 transition-colors">
                                   <input type="checkbox" name="showTigoLogoOnQuote" checked={quoteForm.showTigoLogoOnQuote} onChange={handleFormChange} className="w-5 h-5 accent-emerald-600 rounded shrink-0" />
                                   <span className="text-sm text-slate-200 font-medium">הצג לוגו Tigo בהצעת המחיר (מערכת עם אופטימייזרים)</span>
                                 </label>
                               </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={`rounded-2xl border transition-all ${quoteForm.includesWashing ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/8 bg-black/15'}`}>
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors rounded-2xl">
                          <input type="checkbox" name="includesWashing" checked={quoteForm.includesWashing} onChange={handleFormChange} className="w-5 h-5 accent-amber-500 rounded shrink-0" />
                          <span className="block text-white font-semibold">התקנת מערכת שטיפה אוטומטית</span>
                        </label>
                        {quoteForm.includesWashing && (
                          <p className="px-4 pb-4 pt-0 text-sm font-medium leading-snug text-amber-100/90">
                            מערכת ניקוי פאנלים אוטומטית — נכללת בהצעה לפי תמחור מערכת השטיפה.
                          </p>
                        )}
                      </div>
                      <label className="flex items-center gap-3 p-4 bg-black/15 border border-white/8 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                        <input type="checkbox" name="showLoanSimulation" checked={quoteForm.showLoanSimulation} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                        <span className="block text-white font-semibold">הצג טבלת סימולציית מימון (100% הלוואה בנקאית)</span>
                      </label>
                      
                      {/* הגדרות כיווני אוויר */}
                      <div className="bg-black/15 border border-white/8 rounded-2xl overflow-hidden transition-all">
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                          <input type="checkbox" name="specifyOrientation" checked={quoteForm.specifyOrientation} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <span className="block text-white font-semibold">הגדרת כיווני אוויר לחלוקת פאנלים (משפיע על תפוקה)</span>
                        </label>
                        
                        {quoteForm.specifyOrientation && (
                          <div className="px-4 pb-4 pt-4 border-t border-white/8 bg-black/15 ml-12 rounded-b-2xl animation-fade-in">
                             <p className="text-sm text-blue-300 mb-3">סך הכל פאנלים נדרשים במערכת: <strong>{currentCalculatedPanels}</strong></p>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">דרום (100% שמש)</label>
                                 <input type="number" min="0" name="panelsSouth" value={quoteForm.panelsSouth} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">מזרח/מערב (-15%)</label>
                                 <input type="number" min="0" name="panelsEastWest" value={quoteForm.panelsEastWest} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">צפון (-35%)</label>
                                 <input type="number" min="0" name="panelsNorth" value={quoteForm.panelsNorth} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                             </div>
                             
                             {/* התראת אופטימייזרים */}
                             {requiredOptimizersForSmallArrays > 0 && (
                               <div className="mt-4 bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl animation-fade-in col-span-1 md:col-span-3">
                                  <p className="text-amber-400 text-sm font-medium mb-3 flex items-start gap-2">
                                     <AlertCircle className="w-5 h-5 shrink-0" />
                                     שימו לב: כיוון שמכיל פחות מ-6 פאנלים דורש התקנת אופטימייזרים. בחלוקה זו יידרשו לפחות {requiredOptimizersForSmallArrays} אופטימייזרים.
                                  </p>
                                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm font-medium hover:text-white transition-colors w-fit">
                                     <input 
                                        type="checkbox" 
                                        name="optimizerAcknowledge" 
                                        checked={quoteForm.optimizerAcknowledge || false} 
                                        onChange={handleFormChange} 
                                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer" 
                                     />
                                     אני מודע/ת ומאשר/ת להמשיך
                                  </label>
                               </div>
                             )}

                             {/* תצוגה חיה של חלוקה ושעות שמש למנהל */}
                             <div className={`text-sm mt-4 p-3 rounded-lg font-medium flex flex-col gap-2 ${currentDistributedPanels === currentCalculatedPanels ? 'bg-green-900/20 text-green-400 border border-green-800/50' : 'bg-red-900/20 text-red-400 border border-red-800/50'}`}>
                               <div className="flex items-center gap-2">
                                 {currentDistributedPanels === currentCalculatedPanels ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                                 סה"כ חולקו: {currentDistributedPanels} מתוך {currentCalculatedPanels}
                               </div>
                               
                               {currentDistributedPanels === currentCalculatedPanels && currentDistributedPanels > 0 && (
                                 <div className="mt-2 pt-3 border-t border-green-800/30 text-xs text-slate-300">
                                    <p className="text-blue-300 font-bold mb-1">ממוצע שעות שמש משוקלל: {Math.round(liveAvgH)} שעות</p>
                                    <div className="flex flex-wrap gap-4 opacity-80 mt-2">
                                      {pSouthInput > 0 && <span>• דרום: {Math.round(liveSouthH)} שעות</span>}
                                      {pEWInput > 0 && <span>• מזרח/מערב: {Math.round(liveEWH)} שעות</span>}
                                      {pNorthInput > 0 && <span>• צפון: {Math.round(liveNorthH)} שעות</span>}
                                    </div>
                                 </div>
                               )}
                             </div>
                          </div>
                        )}
                      </div>
                      <div
                        className={`rounded-2xl border transition-all ${
                          quoteForm.showLimitedOffer
                            ? 'border-amber-400/50 bg-amber-500/10'
                            : 'border-white/8 bg-black/15'
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-white/5">
                          <input
                            type="checkbox"
                            name="showLimitedOffer"
                            checked={quoteForm.showLimitedOffer}
                            onChange={handleFormChange}
                            className="h-5 w-5 shrink-0 rounded accent-amber-500"
                          />
                          <span className="block font-semibold text-white">הטבה דחופה · 7 ימים בלבד</span>
                        </label>
                        {quoteForm.showLimitedOffer && (
                          <p className="px-4 pb-4 pt-0 text-sm font-medium leading-snug text-amber-100/90">
                            יוצג בהצעה באנר עם ספירה לאחור ל-7 ימים וקישור לניצול ההטבה.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 pt-2">
                       <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">מי נושא בעלות אגרות חח"י / רשויות?</label>
                       <div className="flex gap-3">
                          <label className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3.5 transition-all duration-200 ${quoteForm.feesPayer === 'client' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                                 style={quoteForm.feesPayer === 'client' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                            <input type="radio" name="feesPayer" value="client" checked={quoteForm.feesPayer === 'client'} onChange={handleFormChange} className="hidden" />
                            הלקוח משלם
                          </label>
                          <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 ${quoteForm.feesPayer === 'company' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                                 style={quoteForm.feesPayer === 'company' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                            <input type="radio" name="feesPayer" value="company" checked={quoteForm.feesPayer === 'company'} onChange={handleFormChange} className="hidden" />
                            החברה משלמת
                          </label>
                       </div>
                    </div>

                    {/* סיכומים נוספים */}
                    <div className="md:col-span-2 pt-4 border-t border-white/8 mt-2">
                       <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סיכומים נוספים (אופציונלי)</label>
                       <textarea 
                         name="additionalNotes" 
                         value={quoteForm.additionalNotes} 
                         onChange={handleFormChange} 
                         placeholder="הכנס כאן הערות מיוחדות, הבטחות ללקוח, או סיכומים חריגים שיופיעו בהצעת המחיר..." 
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 min-h-[100px] resize-y"
                       />
                    </div>

                  </div>
                  </div>{/* closes p-7 wrapper */}
                </div>
              </div>

              <div className="flex flex-col items-end gap-4 pt-6">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 w-full justify-end animation-fade-in shadow-lg">
                     <p className="font-semibold">{errorMsg}</p>
                     <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
                  </div>
                )}
                <div className="relative group">
                  {/* Glow effect behind button */}
                  <div className="absolute -inset-1 rounded-2xl opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300"
                       style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24, #f97316)' }}></div>
                  <button type="submit"
                    className="relative flex items-center gap-3 text-slate-900 px-10 py-4 rounded-2xl font-black text-xl shadow-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 50%, #f97316 100%)', backgroundSize: '200%' }}>
                    <FileText className="w-6 h-6" />
                    חשב מחיר והמשך
                    <span className="text-orange-900 text-lg">←</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'priceConfirm' && quoteDraft && (
            <QuotePriceConfirmPanel
              quoteDraft={quoteDraft}
              adminPrices={adminPrices}
              offerPriceInput={agentOfferPriceInput}
              onOfferPriceInputChange={setAgentOfferPriceInput}
              onConfirm={confirmQuoteWithClientPrice}
              onBack={backFromPriceConfirm}
              errorMsg={errorMsg}
              showInternalCosts={currentUser?.role === 'admin'}
            />
          )}

          {/* ================= QUOTE PRESENTATION TAB ================= */}
          {activeTab === 'quote' && generatedQuote && (
            <div className="animation-fade-in pb-20 print:pb-0 print:overflow-visible">
              <QuoteDatasheetViewer
                open={Boolean(quoteDatasheetViewer)}
                title={quoteDatasheetViewer?.title || ''}
                datasheet={quoteDatasheetViewer?.datasheet}
                onClose={() => setQuoteDatasheetViewer(null)}
              />
              {/* Toolbar */}
              <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-8 px-4 print:hidden">
                 {currentUser.role !== 'viewer' ? (
                   <button
                     type="button"
                     onClick={() => setActiveTab('sales')}
                     className="text-blue-300 hover:text-blue-200 text-sm flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl transition-all border border-white/10 hover:border-white/20 hover:bg-white/5"
                     style={{ background: 'rgba(255,255,255,0.04)' }}
                   >
                     &rarr; חזרה לעריכה
                   </button>
                 ) : (
                   <span className="text-xs font-semibold text-slate-500">צפייה בלבד — להדפסה או שמירה כ-PDF מהדפדפן</span>
                 )}
                 <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                   {supabase && currentUser.role !== 'viewer' && (
                     <button
                       type="button"
                       onClick={handleCreateShareLink}
                       disabled={shareLinkBusy}
                       className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-600/20 px-4 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                     >
                       {shareLinkBusy ? (
                         <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                       ) : (
                         <Copy className="h-4 w-4" aria-hidden />
                       )}
                       קישור ללקוח
                     </button>
                   )}
                   <button
                     type="button"
                     onClick={() => {
                       measureQuotePrintLayout();
                       window.print();
                     }}
                     className="bg-white text-slate-900 px-6 py-2.5 rounded-xl font-bold shadow-xl flex items-center gap-2 hover:bg-slate-100 transition-all hover:scale-[1.02] hover:shadow-2xl"
                   >
                     <FileText className="w-4 h-4" /> הדפס לקובץ PDF
                   </button>
                 </div>
              </div>
              {shareLinkFeedback && (
                <div
                  className={`max-w-6xl mx-auto mb-4 px-4 print:hidden ${
                    shareLinkFeedback.type === 'success' ? 'text-emerald-300' : 'text-red-300'
                  }`}
                  role="status"
                >
                  <p className="text-sm font-semibold">{shareLinkFeedback.text}</p>
                  {shareLinkFeedback.url && (
                    <div className="mt-2 space-y-2">
                      <p className="break-all text-xs font-mono text-slate-400">{shareLinkFeedback.url}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!shareLinkFeedback.copied && (
                          <button
                            type="button"
                            onClick={handleRetryCopyShareLink}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/25 px-3 py-1.5 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-600/35"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            העתק קישור
                          </button>
                        )}
                        {canUseNativeShare() && (
                          <button
                            type="button"
                            onClick={() => handleShareQuoteLink(shareLinkFeedback.url)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/35 bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-100 transition-colors hover:bg-blue-600/30"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            שתף
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="max-w-6xl mx-auto mb-8 px-4 print:hidden">
                <button
                  type="button"
                  onClick={openEnvQualityDeclarationsPdf}
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-orange-500 via-orange-500 to-orange-600 py-4 px-6 text-base font-black text-white shadow-xl ring-1 ring-orange-400/30 transition-all hover:from-orange-600 hover:to-orange-700 hover:shadow-2xl hover:ring-orange-300/40 active:scale-[0.99]"
                  style={{ boxShadow: '0 18px 40px -12px rgba(249,115,22,0.55)' }}
                >
                  <span className="tracking-tight">הצהרות של איכות הסביבה</span>
                  <FileText className="h-6 w-6 shrink-0 opacity-95" aria-hidden />
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  לחיצה פותחת את קובץ ה-PDF ישירות (מציג הדפדפן או הורדה).
                </p>
              </div>
              
              <div id="quote-presentation" className="bg-white text-slate-900 shadow-2xl max-w-6xl mx-auto font-sans relative">
                
                {/* --- PAGE 1: HERO COVER --- */}
                <section className="quote-print-cover relative h-[80vh] min-h-[640px] flex flex-col justify-center px-8 md:px-16 lg:px-20 print:h-auto print:min-h-0 print:flex-col print:justify-start print:gap-3 print:overflow-hidden print:py-6 overflow-hidden print:overflow-hidden isolate print:isolation-auto">
                   {/* תמונת רקע מלאה — ב-PDF גובה קבוע ואז מעבר עמוד אוטומטי לסיכום */}
                   <div className="absolute inset-0 z-0 print:relative print:inset-auto print:h-[52mm] print:max-h-[52mm] print:w-full print:flex-shrink-0 print:overflow-hidden quote-print-cover-hero-img">
                     <img
                       src={`${process.env.PUBLIC_URL}/hero-solar-rooftop.png`}
                       alt=""
                       className="h-full w-full object-cover object-[50%_65%] md:object-[50%_60%] scale-105 print:scale-100 print:max-h-[56mm] print:object-[50%_55%]"
                     />
                     <div
                       className="absolute inset-0"
                       style={{
                         background: 'linear-gradient(to left, rgba(10,18,40,0.94) 0%, rgba(10,18,40,0.82) 28%, rgba(10,18,40,0.45) 58%, rgba(10,18,40,0.15) 85%, rgba(10,18,40,0.05) 100%)'
                       }}
                     />
                     <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-transparent to-blue-600/20 pointer-events-none" />
                   </div>

                   {/* כרטיס תמונה ממוסגר — דקורציה במסכים רחבים בלבד */}
                   <div className="hidden xl:block absolute z-[2] bottom-[18%] left-8 lg:left-14 w-[min(340px,28vw)] rounded-3xl overflow-hidden border border-white/25 shadow-2xl ring-1 ring-white/10 print:hidden pointer-events-none">
                     <img
                       src={`${process.env.PUBLIC_URL}/hero-solar-rooftop.png`}
                       alt=""
                       className="w-full h-44 object-cover object-[50%_75%]"
                     />
                     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent h-16" />
                     <p className="absolute bottom-3 right-4 left-4 text-white text-xs font-bold drop-shadow-md text-center">פאנלים על הגג — אנרגיה נקייה</p>
                   </div>
                   
                   <div className="absolute top-6 right-4 z-[5] flex w-max max-w-[calc(100vw-2rem)] flex-col items-end gap-2 md:top-8 md:right-10 md:gap-3 print:relative print:top-auto print:right-auto print:w-full print:max-w-none print:items-start print:gap-2">
                      <div className="flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center sm:h-[5.75rem] sm:w-[5.75rem] print:h-24 print:w-24 print:rounded-xl print:bg-white print:p-2 print:shadow-sm">
                        <BrandLogoCover />
                      </div>
                      <p className="text-right font-black text-lg tracking-tight text-white drop-shadow-md sm:text-xl md:text-2xl print:text-slate-900 print:drop-shadow-none">
                        מומחי אנרגיה סולארית
                      </p>
                      <p className="whitespace-nowrap rounded-xl border border-blue-400/35 bg-slate-950/70 px-3 py-2 text-right text-[11px] font-bold leading-none text-blue-50 shadow-lg backdrop-blur-sm sm:px-3.5 sm:py-2.5 sm:text-xs print:border-blue-200 print:bg-blue-50 print:text-blue-900 print:shadow-none print:backdrop-blur-none">
                        {formatQuoteHeroSystemTypeLabel(generatedQuote)}
                      </p>
                   </div>

                   <div className="text-white relative z-[5] w-full max-w-4xl mr-0 md:mr-auto mt-[13.5rem] sm:mt-[14.5rem] md:mt-[15rem] print:mt-0 print:text-slate-900">
                     <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-2 leading-[1.1] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] print:text-slate-900 print:drop-shadow-none">
                       עצמאות אנרגטית.
                       <br />
                       <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-orange-400 to-orange-500 print:bg-none print:bg-clip-border print:text-orange-600">השקעה חכמה.</span>
                     </h1>
                     <div className="h-1 w-24 md:w-32 rounded-full bg-gradient-to-l from-orange-500 to-amber-400 mt-5 mb-8 opacity-90 print:via-orange-500" aria-hidden />
                     
                     <div className="bg-slate-950/55 backdrop-blur-lg border border-white/15 px-4 py-3 md:px-5 md:py-3.5 rounded-2xl w-fit max-w-full mt-4 shadow-xl ring-1 ring-white/10 print:bg-slate-100 print:border-slate-200 print:shadow-sm print:ring-slate-200 print:backdrop-blur-none">
                        <p className="text-slate-200 mb-2 text-xs font-medium tracking-wide print:text-slate-600">הוכנה במיוחד עבור:</p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-x-5 sm:gap-y-1">
                          {generatedQuote.clientName && <div className="flex items-center gap-2 shrink-0"><User className="w-5 h-5 text-blue-400 shrink-0"/><span className="font-bold text-lg leading-tight">{generatedQuote.clientName}</span></div>}
                          {generatedQuote.clientCity && <div className="flex items-center gap-2 shrink-0"><MapPin className="w-5 h-5 text-blue-400 shrink-0"/><span className="font-bold text-lg leading-tight">{generatedQuote.clientCity}</span></div>}
                        </div>
                     </div>
                   </div>
                   
                   <div className="absolute bottom-10 left-10 z-[5] text-slate-300 text-sm font-medium drop-shadow-md print:relative print:bottom-auto print:left-auto print:mt-2 print:text-slate-600">
                      תאריך הפקה: {new Date().toLocaleDateString('he-IL')}
                   </div>
                </section>

                {/* --- סיכום מערכת, מספרים ומחיר (עמוד 2) --- */}
                <section className="quote-print-section quote-print-summary border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-8 md:px-20 print:py-4">
                  <div className="mx-auto max-w-6xl">
                    <div className="quote-print-avoid-split">
                      <h2 className="mb-6 text-center text-2xl font-black text-blue-900 sm:text-3xl print:mb-3 print:text-xl">
                        סיכום המערכת וההשקעה
                      </h2>
                      <QuoteSystemSpecSummary quote={generatedQuote} />
                    </div>
                    {quoteShowsLimitedOffer && (
                      <QuoteLimitedOfferBanner
                        timeLeft={timeLeft}
                        highlightText={limitedOfferHighlightShort}
                        whatsappLink={whatsappLink}
                      />
                    )}
                    {generatedQuote.hasUrbanPremium && (
                      <div className="mx-auto mb-6 max-w-4xl rounded-2xl border border-emerald-300/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-5 text-center shadow-md print:mb-8">
                        <div className="mb-2 flex items-center justify-center gap-2 text-emerald-800">
                          <Award className="h-7 w-7 shrink-0" aria-hidden />
                          <span className="text-xl font-black tracking-tight">ברכות!</span>
                        </div>
                        <p className="break-words px-1 text-base font-medium leading-relaxed text-slate-800 sm:px-2">
                          {(generatedQuote.clientCity || '').trim()
                            ? `על פי הנתונים ובהתאם לעיר ${(generatedQuote.clientCity || '').trim()}, בה עתידה להיות התקנת המערכת — אתם זכאים לפרמיה אורבנית מתעריף חברת החשמל, הכוללת תוספת של ${URBAN_PREMIUM_AGOROT_PER_KWH} אגורות לתעריף המשוקלל עד שנת ${URBAN_PREMIUM_VALID_UNTIL_YEAR}.`
                            : `על פי הנתונים שהוזנו בהצעה זו — הפרויקט זכאי לפרמיה אורבנית מתעריף חברת החשמל, עם תוספת של ${URBAN_PREMIUM_AGOROT_PER_KWH} אגורות לתעריף המשוקלל עד שנת ${URBAN_PREMIUM_VALID_UNTIL_YEAR}.`}
                        </p>
                      </div>
                    )}
                    <div className="quote-print-summary-blocks grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 print:gap-3">
                      <QuoteFinancialHighlights quote={generatedQuote} />
                      <div className="max-md:order-first lg:order-none">
                        <QuotePricingSummary
                          quote={generatedQuote}
                          adminPrices={adminPrices}
                          companyPaysFees={quoteCompanyPaysFees}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {quoteShowEquipmentBrandsSection && (
                <section
                  className="quote-print-section relative overflow-hidden border-y border-white/5 print:border-slate-200"
                  aria-labelledby="quote-equipment-brands-heading"
                >
                  {/* מעבר חזותי משער כהה לעמוד בהיר — הרקע הכהה «מבטל» את מלבן השחור בקבצי PNG ונותן תחושת שקיפות */}
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#121c31] to-slate-50 pointer-events-none print:hidden"
                    aria-hidden
                  />
                  <div
                    className="absolute inset-0 opacity-[0.22] pointer-events-none mix-blend-overlay print:hidden"
                    style={{
                      background:
                        'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(251,146,60,0.5), transparent 55%), radial-gradient(ellipse 70% 45% at 80% 60%, rgba(59,130,246,0.2), transparent)'
                    }}
                    aria-hidden
                  />
                  <div className="relative z-[1] max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-10 md:pt-10 md:pb-12 print:py-6 print:bg-slate-50">
                    <div className="text-center mb-6 md:mb-8 print:mb-6">
                      <h2
                        id="quote-equipment-brands-heading"
                        className="text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm print:text-blue-900"
                      >
                        {quoteEquipmentBrandsTitle}
                      </h2>
                      <p className="mt-2 text-sm md:text-base text-slate-300/95 print:text-slate-600 font-medium">
                        מותגים שנבחרו עבור פרויקט זה
                      </p>
                      <div className="mx-auto mt-5 h-px w-24 rounded-full bg-gradient-to-l from-transparent via-orange-400/80 to-transparent print:via-blue-400/60" aria-hidden />
                    </div>
                    <div className="quote-print-equipment-strip mx-auto flex max-w-5xl flex-wrap items-start justify-center gap-3 md:gap-4 print:gap-2">
                      {aggregatedQuoteInverterLogos.map((row) => {
                        return (
                        <div
                          key={row.aggregateKey}
                          className={QUOTE_EQUIPMENT_STRIP_CELL}
                        >
                          {isDatasheetViewable(row.datasheet) ? (
                            <button
                              type="button"
                              className={`${QUOTE_BRAND_CARD_LOGO_ONLY_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-orange-400/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70`}
                              onClick={() => openQuoteDatasheet(`מפרט טכני — ${row.displayName}`, row.datasheet)}
                            >
                              <img src={row.imageSrc} alt="" className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS} />
                            </button>
                          ) : (
                          <div className={QUOTE_BRAND_CARD_LOGO_ONLY_CLASS}>
                            <img src={row.imageSrc} alt="" className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS} />
                          </div>
                          )}
                          {row.quantity > 1 && (
                            <span className="rounded-full bg-white/10 text-white font-black text-sm md:text-base px-3.5 py-1 border border-white/20 backdrop-blur-sm print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                              ×{row.quantity}
                            </span>
                          )}
                          <QuoteEquipDatasheetCaption
                            datasheet={row.datasheet}
                            datasheetTitle={`מפרט טכני — ${row.displayName}`}
                            onOpen={openQuoteDatasheet}
                          >
                            {row.displayName}
                          </QuoteEquipDatasheetCaption>
                        </div>
                        );
                      })}
                      {quoteInvertersWithoutLogoAsset.map((inv) => {
                        const inner = (
                          <>
                            <HardHat className="h-10 w-10 shrink-0 text-slate-300 print:text-slate-600 md:h-12 md:w-12" aria-hidden />
                            <span className="line-clamp-3 px-1 text-center text-xs font-bold leading-snug text-white print:text-slate-900 md:text-sm">
                              {inv.name}
                            </span>
                          </>
                        );
                        return (
                          <div
                            key={`inv-plain-${inv.id}`}
                            className={QUOTE_EQUIPMENT_STRIP_CELL}
                          >
                            {isDatasheetViewable(inv.datasheet) ? (
                              <button
                                type="button"
                                className={`${QUOTE_PLAIN_EQUIP_CARD_COMPACT_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-orange-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60`}
                                onClick={() => openQuoteDatasheet(`מפרט טכני — ${inv.name}`, inv.datasheet)}
                              >
                                {inner}
                              </button>
                            ) : (
                              <div className={QUOTE_PLAIN_EQUIP_CARD_COMPACT_CLASS}>{inner}</div>
                            )}
                            {inv.quantity > 1 && (
                              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs font-black text-white backdrop-blur-sm print:border-slate-300 print:bg-slate-100 print:text-slate-900 md:text-sm">
                                ×{inv.quantity}
                              </span>
                            )}
                            <QuoteEquipDatasheetCaption
                              datasheet={inv.datasheet}
                              datasheetTitle={`מפרט טכני — ${inv.name}`}
                              onOpen={openQuoteDatasheet}
                            >
                              ממיר • {inv.quantity} יח&apos;
                            </QuoteEquipDatasheetCaption>
                          </div>
                        );
                      })}
                      {quoteOptimizerQuoteCard && (
                        <div className={QUOTE_EQUIPMENT_STRIP_CELL}>
                          {quoteOptimizerQuoteCard.variant === 'tigo' && (
                            <>
                              {isDatasheetViewable(quoteOptimizerQuoteCard.datasheet) ? (
                                <button
                                  type="button"
                                  className={`${QUOTE_BRAND_CARD_LOGO_ONLY_EMERALD_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-emerald-300/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70`}
                                  onClick={() =>
                                    openQuoteDatasheet('מפרט טכני — אופטימייזרים Tigo', quoteOptimizerQuoteCard.datasheet)
                                  }
                                >
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="Tigo"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </button>
                              ) : (
                                <div className={QUOTE_BRAND_CARD_LOGO_ONLY_EMERALD_CLASS}>
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="Tigo"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </div>
                              )}
                              <QuoteEquipDatasheetCaption
                                datasheet={quoteOptimizerQuoteCard.datasheet}
                                datasheetTitle="מפרט טכני — אופטימייזרים Tigo"
                                onOpen={openQuoteDatasheet}
                              >
                                {quoteOptimizerQuoteCard.captionHe}
                              </QuoteEquipDatasheetCaption>
                            </>
                          )}
                          {quoteOptimizerQuoteCard.variant === 'sungrow' && quoteOptimizerQuoteCard.logoSrc && (
                            <>
                              {isDatasheetViewable(quoteOptimizerQuoteCard.datasheet) ? (
                                <button
                                  type="button"
                                  className={`${QUOTE_BRAND_CARD_LOGO_ONLY_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-orange-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70`}
                                  onClick={() =>
                                    openQuoteDatasheet('מפרט טכני — אופטימייזרים Sungrow', quoteOptimizerQuoteCard.datasheet)
                                  }
                                >
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="Sungrow"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </button>
                              ) : (
                                <div className={QUOTE_BRAND_CARD_LOGO_ONLY_CLASS}>
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="Sungrow"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </div>
                              )}
                              <QuoteEquipDatasheetCaption
                                datasheet={quoteOptimizerQuoteCard.datasheet}
                                datasheetTitle="מפרט טכני — אופטימייזרים Sungrow"
                                onOpen={openQuoteDatasheet}
                              >
                                {quoteOptimizerQuoteCard.captionHe}
                              </QuoteEquipDatasheetCaption>
                            </>
                          )}
                          {quoteOptimizerQuoteCard.variant === 'solaredge' && quoteOptimizerQuoteCard.logoSrc && (
                            <>
                              {isDatasheetViewable(quoteOptimizerQuoteCard.datasheet) ? (
                                <button
                                  type="button"
                                  className={`${QUOTE_BRAND_CARD_LOGO_ONLY_BLUE_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-blue-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70`}
                                  onClick={() =>
                                    openQuoteDatasheet(
                                      `מפרט טכני — אופטימייזרים (${generatedQuote.optimizerDetails.type})`,
                                      quoteOptimizerQuoteCard.datasheet
                                    )
                                  }
                                >
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="SolarEdge"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </button>
                              ) : (
                                <div className={QUOTE_BRAND_CARD_LOGO_ONLY_BLUE_CLASS}>
                                  <img
                                    src={quoteOptimizerQuoteCard.logoSrc}
                                    alt="SolarEdge"
                                    className={QUOTE_BRAND_LOGO_IMG_FILL_CLASS}
                                  />
                                </div>
                              )}
                              <QuoteEquipDatasheetCaption
                                datasheet={quoteOptimizerQuoteCard.datasheet}
                                datasheetTitle={`מפרט טכני — אופטימייזרים (${generatedQuote.optimizerDetails.type})`}
                                onOpen={openQuoteDatasheet}
                              >
                                {quoteOptimizerQuoteCard.captionHe}
                              </QuoteEquipDatasheetCaption>
                            </>
                          )}
                          {quoteOptimizerQuoteCard.variant === 'generic' && (
                            <>
                              {isDatasheetViewable(quoteOptimizerQuoteCard.datasheet) ? (
                                <button
                                  type="button"
                                  className={`${QUOTE_PLAIN_EQUIP_CARD_COMPACT_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-orange-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60`}
                                  onClick={() =>
                                    openQuoteDatasheet(
                                      `מפרט טכני — אופטימייזרים (${generatedQuote.optimizerDetails.type})`,
                                      quoteOptimizerQuoteCard.datasheet
                                    )
                                  }
                                >
                                  <Activity className="h-10 w-10 shrink-0 text-blue-400 print:text-blue-600 md:h-11 md:w-11" aria-hidden />
                                  <span className="line-clamp-3 px-1 text-center text-[11px] font-bold leading-snug text-white print:text-slate-900 md:text-xs">
                                    {generatedQuote.optimizerDetails.type}
                                  </span>
                                </button>
                              ) : (
                                <div className={QUOTE_PLAIN_EQUIP_CARD_COMPACT_CLASS}>
                                  <Activity className="h-10 w-10 shrink-0 text-blue-400 print:text-blue-600 md:h-11 md:w-11" aria-hidden />
                                  <span className="line-clamp-3 px-1 text-center text-[11px] font-bold leading-snug text-white print:text-slate-900 md:text-xs">
                                    {generatedQuote.optimizerDetails.type}
                                  </span>
                                </div>
                              )}
                              <QuoteEquipDatasheetCaption
                                datasheet={quoteOptimizerQuoteCard.datasheet}
                                datasheetTitle={`מפרט טכני — אופטימייזרים (${generatedQuote.optimizerDetails.type})`}
                                onOpen={openQuoteDatasheet}
                              >
                                {quoteOptimizerQuoteCard.captionHe}
                              </QuoteEquipDatasheetCaption>
                            </>
                          )}
                        </div>
                      )}
                      {generatedQuote.includesWashing && (
                        <div className={QUOTE_EQUIPMENT_STRIP_CELL}>
                          <div className={QUOTE_EQUIP_LOGO_TILE_CLASS}>
                            <img
                              src={QUOTE_WASHING_SYSTEM_IMG}
                              alt=""
                              className={QUOTE_EQUIP_PHOTO_TILE_IMG_CLASS}
                            />
                          </div>
                          <span className={QUOTE_EQUIP_BELOW_CAPTION_CLASS}>מערכת שטיפה אוטומטית לפאנלים</span>
                        </div>
                      )}
                      {(generatedQuote.calculatedNumPanels || 0) > 0 && (
                        <div className={QUOTE_PANELS_STRIP_CELL}>
                          <div className={`${QUOTE_BRAND_CARD_COMPACT_CLASS} gap-1.5 md:gap-2`}>
                            <Sun
                              className="h-9 w-9 shrink-0 text-amber-400 drop-shadow-md print:text-amber-600 md:h-10 md:w-10"
                              aria-hidden
                            />
                            <span className="px-1 text-center text-sm font-extrabold leading-tight text-white print:text-slate-900 md:text-base">
                              {QUOTE_PANELS_GENERIC_TITLE_HE}
                            </span>
                            <span className="line-clamp-4 px-1 text-center text-[10px] font-semibold leading-snug text-slate-200 print:text-slate-700 md:text-[11px]">
                              {QUOTE_PANELS_GENERIC_BODY_HE}
                            </span>
                          </div>
                        </div>
                      )}
                      {generatedQuote.feesPayer === 'company' && (
                        <div className={QUOTE_EQUIPMENT_STRIP_CELL}>
                          <div className={`${QUOTE_BRAND_CARD_AMBER_CLASS} gap-1.5 md:gap-2`}>
                            <ShieldCheck
                              className="h-12 w-12 shrink-0 text-amber-300 drop-shadow-md print:text-amber-700 md:h-14 md:w-14"
                              aria-hidden
                            />
                            <span className="px-1 text-center text-sm font-extrabold leading-tight text-white print:text-slate-900 md:text-base">
                              אגרות חח״י ורשויות
                            </span>
                            <span className="line-clamp-3 px-1 text-center text-xs font-semibold leading-snug text-amber-50 md:text-sm print:text-amber-950">
                              החברה נושאת בעלות — הכל כלול במחיר ההצעה
                            </span>
                          </div>
                          <span className="block px-1 text-center text-base font-black leading-snug text-emerald-100 md:text-lg [text-shadow:0_1px_4px_rgba(0,0,0,0.95),0_2px_12px_rgba(0,0,0,0.7)] print:text-emerald-900 print:[text-shadow:none]">
                            ללא חיוב נפרד לאגרות רישוי וחח״י
                          </span>
                        </div>
                      )}
                      {quoteShowConstructionEquipment && (
                        <div className={QUOTE_EQUIPMENT_STRIP_CELL}>
                          {(() => {
                            const cLogo = normalizeDatasheet(generatedQuote.constructionLogo);
                            const cDs = normalizeDatasheet(generatedQuote.constructionDatasheet);
                            const logoSrc =
                              cLogo?.mimeType?.startsWith('image/') ? datasheetToSrc(cLogo) : null;
                            const inner = (
                              <>
                                {logoSrc ? (
                                  <div className="rounded-xl bg-white px-2 py-2 shadow-inner ring-1 ring-black/10 print:ring-slate-200 md:px-3 md:py-2.5">
                                    <img src={logoSrc} alt="" className={QUOTE_BRAND_LOGO_IMG_COMPACT_CLASS} />
                                  </div>
                                ) : (
                                  <HardHat
                                    className="h-10 w-10 shrink-0 text-sky-300 print:text-sky-700 md:h-12 md:w-12"
                                    aria-hidden
                                  />
                                )}
                                <span className="text-center text-xs font-bold leading-tight text-white/95 print:text-slate-900 md:text-sm">
                                  קונסטרוקציה
                                </span>
                              </>
                            );
                            return (
                              <>
                                {isDatasheetViewable(generatedQuote.constructionDatasheet) ? (
                                  <button
                                    type="button"
                                    className={`${QUOTE_BRAND_CARD_COMPACT_CLASS} cursor-pointer transition-transform hover:scale-[1.02] hover:border-sky-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/65`}
                                    onClick={() => openQuoteDatasheet('מפרט טכני — קונסטרוקציה', generatedQuote.constructionDatasheet)}
                                  >
                                    {inner}
                                  </button>
                                ) : (
                                  <div className={QUOTE_BRAND_CARD_COMPACT_CLASS}>{inner}</div>
                                )}
                                <QuoteEquipDatasheetCaption
                                  datasheet={generatedQuote.constructionDatasheet}
                                  datasheetTitle="מפרט טכני — קונסטרוקציה"
                                  onOpen={openQuoteDatasheet}
                                >
                                  תשתית וקונסטרוקציה
                                </QuoteEquipDatasheetCaption>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    {quoteBatteryStorageSummary && (
                      <QuoteBatteryStorageSummary
                        summary={quoteBatteryStorageSummary}
                        onOpenDatasheet={openQuoteDatasheet}
                      />
                    )}
                    {quoteCompanyPaysFees && (
                      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-500/45 via-emerald-600/30 to-emerald-900/25 px-6 py-5 text-center shadow-[0_16px_48px_-12px_rgba(16,185,129,0.55)] print:border-emerald-500 print:bg-emerald-50 print:shadow-md">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <Gift className="h-8 w-8 shrink-0 text-emerald-100 drop-shadow-md print:text-emerald-600 md:h-9 md:w-9" aria-hidden />
                          <p className="text-xl font-black leading-snug tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] md:text-2xl print:text-emerald-950 print:[text-shadow:none]">
                            אגרות חברת חשמל - במתנה על חשבון החברה!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                )}

                {/* --- תחזית כלכלית (עמוד נפרד) --- */}
                <section className="quote-print-section py-8 px-4 sm:px-8 md:py-12 md:px-20 print:py-4">
                   <h2 className="mb-6 text-center text-2xl font-black text-blue-900 sm:text-3xl">תחזית כלכלית מפורטת</h2>

                   {/* Custom Financial Chart (CSS Based) */}
                   <div
                     className={`bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-md print:mb-4 print:p-3 quote-print-avoid-split ${
                       generatedQuote.showLoanSimulation ? 'quote-print-cashflow-sheet' : ''
                     }`}
                   >
                      <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2 print:mb-2 print:text-base"><TrendingUp className="text-orange-500 w-5 h-5"/> תחזית תזרים מזומנים (25 שנה)</h3>
                      
                      <div className="quote-print-cashflow-chart h-48 sm:h-52 flex items-end justify-between gap-2 md:gap-6 mt-6 relative border-b-2 border-slate-300 pb-2 print:mt-3 print:h-36">
                        {/* 0 Line marker */}
                        <div className="absolute w-full border-t border-dashed border-slate-400" style={{bottom: `${Math.abs(generatedQuote.minLoss) / ((generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss)) * 100}%`}}></div>
                        <span className="absolute left-0 font-bold text-xs text-slate-400" style={{bottom: `calc(${Math.abs(generatedQuote.minLoss) / ((generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss)) * 100}% + 5px)`}}>איזון 0</span>

                        {generatedQuote.graphData.map((point, i) => {
                          const isNegative = point.flow < 0;
                          const totalRange = (generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss);
                          const heightPercent = (Math.abs(point.flow) / totalRange) * 100;
                          const zeroPosPercent = (Math.abs(generatedQuote.minLoss) / totalRange) * 100;

                          return (
                            <div key={i} className="flex-1 flex flex-col items-center relative h-full">
                               {/* Value label */}
                               <div className="absolute text-[10px] md:text-sm font-bold w-full text-center" 
                                    style={{
                                      bottom: isNegative ? `calc(${zeroPosPercent}% - ${heightPercent}% - 22px)` : `calc(${zeroPosPercent}% + ${heightPercent}% + 5px)`,
                                      color: isNegative ? '#ef4444' : '#1d4ed8' 
                                    }}>
                                  {point.flow > 0 ? '+' : ''}{Math.round(point.flow / 1000)}k
                               </div>
                               
                               {/* Bar */}
                               <div className="absolute w-6 md:w-16 rounded-sm transition-all shadow-sm"
                                    style={{
                                      height: `${heightPercent}%`,
                                      bottom: isNegative ? `calc(${zeroPosPercent}% - ${heightPercent}%)` : `${zeroPosPercent}%`,
                                      backgroundColor: isNegative ? '#fca5a5' : '#3b82f6' 
                                    }}>
                               </div>
                               
                               {/* Year Label */}
                               <div className="absolute -bottom-8 text-xs md:text-sm font-medium text-slate-600">
                                 {point.year === 0 ? 'התקנה' : `שנה ${point.year}`}
                               </div>
                            </div>
                          )
                        })}
                      </div>
                   </div>

                   {/* Investment Comparison — נפתח בלחיצה */}
                   <QuoteExpandableSection
                     title="השוואת תשואה שנתית משוערת"
                     subtitle="מערכת סולארית לעומת אפיקי השקעה נפוצים"
                     teaser={
                       generatedQuote.annualYield
                         ? `תשואה שנתית במערכת סולארית: ${generatedQuote.annualYield.toFixed(1)}%`
                         : null
                     }
                     className="max-w-4xl quote-print-hide-in-print"
                   >
                     <QuoteInvestmentYieldChart annualYield={generatedQuote.annualYield} />
                   </QuoteExpandableSection>

                   {/* Loan Simulation — נפתח בלחיצה */}
                   {generatedQuote.showLoanSimulation && (
                     <div className="quote-print-chapter-loan">
                     <QuoteExpandableSection
                       title="תכנית פיננסית — מימון 100% בנקאי"
                       subtitle={`פריים + ${generatedQuote.loanSettings.loanMargin}% (ריבית משוערת: ${generatedQuote.loanSettings.annualInterestRate}%)`}
                       teaser={`רווח נטו צפוי ל־25 שנה: ₪${Math.round(
                         generatedQuote.loanSimulation.reduce((acc, row) => acc + row.netProfit, 0)
                       ).toLocaleString('he-IL')}`}
                       className="max-w-5xl"
                     >
                     <div className="quote-print-loan-block bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-lg overflow-hidden print:p-3 print:shadow-none print:border-slate-300">
                        <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                             <span className="font-medium bg-blue-50 text-blue-800 px-2 py-1 rounded inline-block border border-blue-100">
                               החזר ההלוואה מבוסס על הפניית 100% מההכנסות לטובת סילוק הקרן והריבית עד לסיומה. לאחר מכן, ההכנסות עוברות לרווח נקי.
                             </span>
                        </p>
                        <div className="overflow-x-auto -mx-2 px-2 max-w-full">
                           <table className="min-w-[720px] print:min-w-0 w-full text-center border-collapse text-[11px] sm:text-sm table-fixed">
                              <colgroup>
                                <col className="w-[8%]" />
                                <col className="w-[30%]" />
                                <col className="w-[31%]" />
                                <col className="w-[31%]" />
                              </colgroup>
                              <thead>
                                 <tr className="bg-slate-100 text-blue-900">
                                    <th className="py-2.5 px-1 sm:px-2 font-bold border-b-2 border-slate-300 rounded-tr-xl whitespace-normal leading-tight align-middle">שנה</th>
                                    <th className="py-2.5 px-1 sm:px-2 font-bold border-b-2 border-slate-300 whitespace-normal leading-tight align-middle">
                                      <span className="block">הכנסה שנתית</span>
                                      <span className="block text-[10px] sm:text-xs font-semibold text-slate-600 mt-0.5">כולל פחת 0.33%</span>
                                    </th>
                                    <th className="py-2.5 px-1 sm:px-2 font-bold border-b-2 border-slate-300 text-red-600 whitespace-normal leading-tight align-middle">
                                      <span className="block">החזר הלוואה</span>
                                      <span className="block text-[10px] sm:text-xs font-semibold text-red-500/90 mt-0.5">עד סילוק החוב</span>
                                    </th>
                                    <th className="py-2.5 px-1 sm:px-2 font-bold border-b-2 border-slate-300 text-green-700 rounded-tl-xl whitespace-normal leading-tight align-middle">
                                      <span className="block">רווח נטו</span>
                                      <span className="block text-[10px] sm:text-xs font-semibold text-green-700/90 mt-0.5">ללקוח</span>
                                    </th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {generatedQuote.loanSimulation.map((row) => (
                                    <tr key={row.year} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                                       <td className="py-2 px-1 sm:px-2 font-semibold text-slate-800 tabular-nums align-middle">{row.year}</td>
                                       <td className="py-2 px-1 sm:px-2 font-medium text-slate-700 tabular-nums align-middle break-normal">₪{Math.round(row.income).toLocaleString()}</td>
                                       <td className="py-2 px-1 sm:px-2 font-medium text-red-600 tabular-nums align-middle break-normal">{row.repayment > 0 ? `- ₪${Math.round(row.repayment).toLocaleString()}` : '—'}</td>
                                       <td className="py-2 px-1 sm:px-2 font-bold text-green-700 tabular-nums align-middle break-normal">{row.netProfit > 0 ? `₪${Math.round(row.netProfit).toLocaleString()}` : '—'}</td>
                                    </tr>
                                 ))}
                                 <tr className="bg-blue-50/80 font-black text-blue-900">
                                    <td className="py-3 px-1 sm:px-2 border-t-2 border-blue-200 rounded-br-xl whitespace-normal leading-tight align-middle">סה״כ<br className="sm:hidden" /> 25 שנה</td>
                                    <td className="py-3 px-1 sm:px-2 border-t-2 border-blue-200 tabular-nums align-middle break-normal">₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.income, 0)).toLocaleString()}</td>
                                    <td className="py-3 px-1 sm:px-2 border-t-2 border-blue-200 text-red-600 tabular-nums align-middle break-normal">- ₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.repayment, 0)).toLocaleString()}</td>
                                    <td className="py-3 px-1 sm:px-2 border-t-2 border-blue-200 text-green-700 rounded-bl-xl tabular-nums align-middle break-normal">₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.netProfit, 0)).toLocaleString()}</td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-4">* הסימולציה מציגה הערכה כללית הכוללת פחת מודולים סולאריים משוער של 0.33% בשנה. התנאים הסופיים כפופים לאישור הבנק המממן ולשינויים בריבית הפריים. </p>
                     </div>
                     </QuoteExpandableSection>
                     </div>
                   )}

                </section>

                {/* --- מי אנחנו --- */}
                <section className="quote-print-section py-10 px-4 sm:px-8 md:px-20 bg-slate-50 print:py-5">
                   <div className="max-w-4xl mx-auto text-center mb-8">
                     <h2 className="text-2xl md:text-3xl font-black text-blue-900 mb-3">מי אנחנו? המומחים שלכם באנרגיה סולארית</h2>
                     <p className="text-base text-slate-600">אנו חברת בוטיק המתמחה בפתרונות אנרגיה מתקדמים — איכות, מקצועיות ושירות אישי.</p>
                   </div>
                   <div className="mx-auto mb-8 max-w-3xl">
                     <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-200/60">
                       <img
                         src={`${process.env.PUBLIC_URL}/team-building-about-us.png`}
                         alt="משפחת מומחי אנרגיה סולארית — צילום צוות ביום גיבוש"
                         className="quote-print-team-photo h-auto w-full object-contain"
                       />
                     </div>
                     <p className="mt-4 text-center text-sm font-medium text-slate-500">הצוות שלנו ביום גיבוש — האנשים שמלווים אתכם בכל שלב בדרך לאנרגיה סולארית.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <Award className="w-10 h-10 text-orange-500 mx-auto mb-3"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">איכות ללא פשרות</h3>
                        <p className="text-slate-600 text-sm">אנו עובדים רק עם המותגים המובילים בעולם (Tier 1) כדי להבטיח אמינות ותפוקה מקסימלית לאורך עשרות שנים.</p>
                     </div>
                     <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto mb-3"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">אחריות וביטחון</h3>
                        <p className="text-slate-600 text-sm">שקט נפשי מלא. אנו מלווים אתכם גם לאחר ההתקנה עם מערכות ניטור מתקדמות ואחריות ארוכת טווח.</p>
                     </div>
                     <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <Wrench className="w-10 h-10 text-green-500 mx-auto mb-3"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">פתרון Turn-Key</h3>
                        <p className="text-slate-600 text-sm">מא' ועד ת'. אנו מטפלים בכל הביורוקרטיה, הרישוי, התכנון וההתקנה - אתם רק נהנים מהחשמל.</p>
                     </div>
                   </div>
                </section>

                {/* --- Turn-Key --- */}
                <section className="quote-print-section py-10 px-4 sm:px-8 md:px-20 bg-white border-t border-slate-200 print:py-5">
                  <h2 className="text-2xl md:text-3xl font-black mb-8 text-center text-blue-900">מה כלול בפרויקט Turn-Key?</h2>
                  
                  <div className="mx-auto max-w-3xl mb-8">
                     <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 print:bg-white print:border-slate-200">
                       <div className="space-y-4">
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-700"><strong>הנדסה ורישוי:</strong> תכנון, קונסטרוקטור וטיפול מול חח"י.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-700"><strong>חשמל:</strong> כבלי AC/DC, לוחות מותאמים לחיבור 3x{generatedQuote.requiredConnectionAmps}A, חשמלאי מוסמך.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-700"><strong>התקנה:</strong> לוגיסטיקה, מנופים וצוות התקנה מקצועי.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-700"><strong>בדיקות:</strong> בודק פרטי מוסמך וחיבור למערכת ניטור.</p></div>
                         {generatedQuote.includesOptimizers && (
                           <div className="flex items-start gap-3">
                             <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500" />
                             {generatedQuote.optimizerDatasheet ? (
                               <button
                                 type="button"
                                 onClick={() => openQuoteDatasheet(`מפרט טכני — אופטימייזרים (${generatedQuote.optimizerDetails.type})`, generatedQuote.optimizerDatasheet)}
                                 className="-mx-1 min-h-[3.25rem] w-full flex-1 rounded-xl border-2 border-green-300/80 bg-white px-4 py-3.5 text-right shadow-sm transition-colors hover:border-green-500 hover:bg-green-50 active:bg-green-100 print:border-slate-300 print:bg-white print:shadow-none"
                               >
                                 <p className="text-base font-bold leading-snug text-slate-900 md:text-lg">
                                   <span className="text-green-700">אופטימייזרים:</span>{' '}
                                   התקנת אופטימייזרים למיקסום תפוקה ({generatedQuote.optimizerDetails.type}).
                                 </p>
                                 <span className="mt-2 block text-sm font-black text-orange-600 underline decoration-2 underline-offset-4 md:text-base print:hidden">
                                   לחץ לצפייה במפרט
                                 </span>
                               </button>
                             ) : (
                               <p className="text-base font-semibold leading-relaxed text-slate-800 md:text-lg">
                                 <strong className="text-green-700">אופטימייזרים:</strong> התקנת אופטימייזרים למיקסום תפוקה ({generatedQuote.optimizerDetails.type}).
                               </p>
                             )}
                           </div>
                         )}
                         {generatedQuote.includesWashing && (
                           <div className="flex items-start gap-3">
                             <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                             <p className="text-slate-700">
                               <strong>שטיפה:</strong> מערכת ניקוי פאנלים אוטומטית.
                             </p>
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                </section>

                {/* --- מפרט טכני — בהדפסה תמיד פתוח --- */}
                <section className="quote-print-section py-6 px-4 sm:px-8 md:px-20 bg-white print:py-4">
                   <QuoteExpandableSection
                     title="פירוט מלא של מפרט טכני"
                     subtitle="אביזרי חשמל, קונסטרוקציה, DC/AC והגנות וניטור"
                     teaser="לחצו לצפייה בכל סעיפי המפרט"
                     className="max-w-5xl"
                   >
                   <div className="quote-print-tech-spec grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 text-sm print:gap-x-5 print:gap-y-4">
                     
                     {/* Column 1 */}
                     <div className="space-y-8">
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">אביזרי חשמל ורכיבי קונסטרוקציה</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>חיבור גישרי הארכה 10 ממ"ר בין הקולטים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>גיד הארכה 16 ממ"ר לאורך תשתית החשמלית.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבל DC בהתאמה 6 או 10 ממ"ר עם הגנת UV. תוצרת KBE גרמניה או ש"ע.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תשתית התקנה על בסיס קונסטרוקציית אלומיניום פרופיל 40/40.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג איסכורית או שטוח משולשי זווית מאלומיניום 50/50/30.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג בטון העמדה על אבני-שפה ואטם בין קונסטרוקציה לגג.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>אביזרי חיבור בין קולטים עשויים אלומיניום.</span></li>
                           </ul>
                        </div>
                        
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">קונסטרוקציית אלומיניום נושאת לפאנל</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כל הרכיבים כדוגמת ברגים, תפסנים, אומגות וכו' יהיו עשויי אלומיניום או נירוסטה.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג אסכורית הקונסטרוקציה תורכב בחיבור ישירות למרישים (פטות) או בעזרת פרופילים מגשרים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>הממירים יותקנו על גבי קיר חיצוני של המבנה או בתוך המבנה עצמו בחדר ייעודי על מנת לא להפריע לתפעול של המבנה על פי אופי האתר ולפי הוראות היצרן.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>חיבור לאבן שפה בגגות בטון ע"י בורג ג'מבו או עוגן חץ עשויים מברזל מגולוון.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בחיבור לגג איסכורית או פנאל מבודד בורג יעודי לאיסכורית.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תופסן בגגות רעפים עשוי מברזל מגולוון.</span></li>
                           </ul>
                        </div>
                     </div>

                     {/* Column 2 */}
                     <div className="space-y-8">
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">בצד ה- DC בין התאים הפוטו-וולטאיים לממירים</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלי DC: שימוש בכבל גמיש בעל בידוד כפול ייעודי לחיבור טורי בין הפאנלים במערכות PV.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>שטח חתך 6,10X1 ממ"ר עם עמידות לקרינת UV.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלים מאחד היצרנים המפורטים Draka, General Cable, Huber+Shhner. הכולל תו תקן.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>קופסאות חיבור DC בדרגת אטימות IP65. יותקנו רק בגג רעפים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מחברי DC - מחברים ייעודיים בעלי דרגת אטימות IP67 העשויים מפוליקרבונט (כיסוי).</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מפסקי DC - מנתק דו-קוטבי תוצרת ABB, ייעודי לזרם ישר (DC) במערכות סולאריות.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תעלת רשת תקנית להולכת כבלים על גבי הגג.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>יוצבו שלטי אזהרה וסימון מוגנים מקרינת UV בהתאם לדרישת חח"י.</span></li>
                           </ul>
                        </div>
                        
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">בצד ה- AC בין הממירים לבין חיבור רשת החשמל</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלי AC שימוש בכבל ייעודי XLP-E בעל בידוד כפול שטח חתך תואם בחיבור בין הממירים לארון חלוקה עד 30 מ'.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מפסקי AC - בצמוד לממיר, שימוש במא"ז ט"מ דו-קוטבי עד 40A של יצרן מוביל, תוצרת ABB.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>התקנת תעלות רשת לפי תקן עם תמיכה ייעודית למבנה בעזרת ברגים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבל ההזנה בין חיבור ארון החלוקה לבין ארון החשמל באתר, מסוג XLP-E תלת-פאזי נחושת, בעל שטח חתך הנדרש לפי המרחק בין נקודות החיבור.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תעלות פח לאורך הגג ובירידה לממירים.</span></li>
                           </ul>
                        </div>

                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">הגנות וניטור</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span><strong>הגנות בפני ברקים ומתחי יתר:</strong> מסופק ע"י יצרן הממירים מובנה בממיר.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span><strong>תקשורת ומערכת ניטור:</strong> מערכת ניטור ייעודית לאיסוף נתונים וגילוי תקלות וכשלים. אספקת אפליקציית ניטור.</span></li>
                           </ul>
                        </div>
                     </div>

                   </div>
                   </QuoteExpandableSection>
                </section>

                {/* --- תנאי תשלום ואחריות --- */}
                <section className="quote-print-section py-10 px-4 sm:px-8 md:px-20 bg-slate-50 print:py-5">
                   <h2 className="text-2xl md:text-3xl font-black text-blue-900 mb-8 text-center">תנאי תשלום ואחריות</h2>
                   
                   <div className="quote-print-payment-warranty mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch lg:gap-8">
                      
                      {/* Payment Terms */}
                      <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
                        <div className="mb-5 flex w-full items-center gap-3 border-b-2 border-orange-500 pb-3">
                          <ShekelIcon className="text-2xl text-blue-600" />
                          <h3 className="text-xl font-bold text-slate-800 sm:text-2xl">תנאי תשלום</h3>
                        </div>
                        <ul className="flex flex-1 flex-col justify-between divide-y divide-slate-100 text-[15px] leading-snug sm:text-base sm:leading-relaxed">
                          {[
                            ['בתחילת הדרך', '5%'],
                            ['עם קבלת אישור PV', '10%'],
                            ['ביום הזמנת קונסטרוקציה לאתר הלקוח', '35%'],
                            ['ביום הזמנת פאנלים לאתר הלקוח', '45%'],
                            ['ביום חיבור המתקן לרשת חברת החשמל', 'יתרה'],
                          ].map(([label, value]) => (
                            <li
                              key={label}
                              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 sm:py-3.5"
                            >
                              <span className="min-w-0 flex-1 text-right font-medium text-slate-700">{label}</span>
                              <span className="shrink-0 text-left text-lg font-black tabular-nums text-blue-600 sm:text-xl">
                                {value}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Warranty */}
                      <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
                        <div className="mb-5 flex w-full items-center gap-3 border-b-2 border-orange-500 pb-3">
                          <ShieldCheck className="h-6 w-6 shrink-0 text-blue-600" />
                          <h3 className="text-xl font-bold text-slate-800 sm:text-2xl">עיקרי האחריות</h3>
                        </div>
                        <ul className="flex flex-1 flex-col justify-evenly gap-5 py-1 text-lg font-medium leading-relaxed text-slate-700 sm:gap-6 sm:py-2 sm:text-xl sm:leading-loose">
                          <li className="flex items-start gap-4">
                            <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500 sm:h-7 sm:w-7" />
                            <span>
                              אחריות להספק ביצוע הפנלים לתקופה של <strong className="font-black text-slate-900">25–30 שנה</strong>, על פי הוראות יצרן.
                            </span>
                          </li>
                          <li className="flex items-start gap-4">
                            <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500 sm:h-7 sm:w-7" />
                            <span>
                              אחריות לממיר מתח{' '}
                              <strong className="font-black text-slate-900">
                                {generatedQuote.hasSolarEdgeQuote ? '12' : '10'} שנה
                              </strong>{' '}
                              על פי הוראות יצרן.
                            </span>
                          </li>
                          {generatedQuote.includesOptimizers && (
                            <li className="flex items-start gap-4">
                              <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500 sm:h-7 sm:w-7" />
                              <span>
                                אחריות לאופטימייזרים <strong className="font-black text-slate-900">25 שנה</strong> על פי הוראות יצרן.
                              </span>
                            </li>
                          )}
                          {generatedQuote.hasBatteries && (
                            <li className="flex items-start gap-4">
                              <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500 sm:h-7 sm:w-7" />
                              <span>
                                אחריות לסוללות אגירה על פי הוראות יצרן.
                              </span>
                            </li>
                          )}
                          <li className="flex items-start gap-4">
                            <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-500 sm:h-7 sm:w-7" />
                            <span>
                              אחריות התקנה <strong className="font-black text-slate-900">36 חודשים</strong>.
                            </span>
                          </li>
                        </ul>
                      </div>
                      
                   </div>
                </section>

                {/* --- PAGE 6.1: ADDITIONAL NOTES (CONDITIONAL) --- */}
                {generatedQuote.additionalNotes && generatedQuote.additionalNotes.trim() !== '' && (
                  <section className="quote-print-section py-10 px-8 md:px-20 bg-white border-t border-slate-200 print:py-5">
                     <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-100 p-8 rounded-3xl shadow-sm">
                        <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                           <FileText className="w-6 h-6 text-blue-600" /> סיכומים נוספים
                        </h3>
                        <p className="text-slate-700 text-lg whitespace-pre-wrap leading-relaxed">
                           {generatedQuote.additionalNotes}
                        </p>
                     </div>
                  </section>
                )}

                {/* --- דוגמאות פרויקטים — לא ב-PDF (חוסך דפים ושוברי עמוד) --- */}
                <section className="px-4 sm:px-8 md:px-20 py-6 border-t border-slate-200 bg-slate-50/50 print:hidden">
                  <QuoteExpandableSection
                    title="דוגמאות מפרויקטים שלנו"
                    subtitle="התקנות אמיתיות ברחבי הארץ"
                    teaser={`${QUOTE_PROJECT_EXAMPLE_IMAGES.length} תמונות · סליידר`}
                    className="!max-w-5xl w-full"
                  >
                    <QuoteProjectSlider images={QUOTE_PROJECT_EXAMPLE_IMAGES} />
                  </QuoteExpandableSection>
                </section>

                {/* --- MAP — נפתח בלחיצה, לא תופס שטח כשסגור --- */}
                <section className="px-4 sm:px-8 md:px-20 py-6 bg-white print:hidden border-t border-slate-100">
                   <QuoteExpandableSection
                     title="מצא לקוח ממליץ מאזורך"
                     subtitle="מפה אינטראקטיבית של התקנות ברחבי הארץ"
                     teaser="לחצו לפתיחת המפה"
                     className="max-w-4xl"
                   >
                   <QuoteProjectsMap clientCity={generatedQuote?.clientCity} />
                   </QuoteExpandableSection>
                </section>

                {/* --- חתימה — עמוד אחרון --- */}
                <section className="quote-print-chapter-start quote-print-section py-16 px-8 md:px-20 bg-white border-t border-slate-200 print:py-8">
                   <div className="max-w-4xl mx-auto">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><PenTool className="w-6 h-6" /></div>
                        <h3 className="text-2xl md:text-3xl font-black text-blue-900">אישור עקרוני להתקדם</h3>
                     </div>
                     <p className="text-slate-700 text-lg mb-8 leading-relaxed">
                        הריני מאשר/ת כי עברתי על הצעת המחיר, המפרט הטכני והתנאים. חתימה זו מהווה הבעת רצון עקרונית לאשר את ההצעה ולהתקדם לשלב הבא. 
                        <br/>
                        <span className="text-sm font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block mt-2">
                          * מובהר בזאת כי מסמך זה הינו הצעת מחיר ואינו מהווה חוזה משפטי. חוזה התקשרות מחייב ומפורט ייחתם בנפרד מול החברה.
                        </span>
                     </p>
                     
                     <div className="bg-slate-50 border border-slate-200 p-6 md:p-10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
                       <div className="text-right flex-1 w-full">
                          <p className="text-sm text-slate-500 mb-1">שם הלקוח / חברה:</p>
                          <p className="font-bold text-2xl text-slate-800 mb-6">{generatedQuote.clientName || '__________________'}</p>
                          <p className="text-sm text-slate-500 mb-1">תאריך אישור:</p>
                          <p className="font-bold text-xl text-slate-800">{new Date().toLocaleDateString('he-IL')}</p>
                       </div>
                       
                       <div className="flex-1 flex justify-center md:justify-end w-full">
                         {!clientSignature ? (
                           <div className="print:hidden">
                             <SignaturePad onSave={handleClientSignatureSaved} />
                           </div>
                         ) : (
                           <div className="text-center relative bg-white p-4 rounded-2xl border border-blue-100 shadow-sm w-[350px]">
                             <button onClick={() => setClientSignature(null)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 print:hidden shadow-md transition-transform hover:scale-110" title="מחק חתימה"><Trash2 className="w-4 h-4" /></button>
                             <img src={clientSignature} alt="חתימת לקוח" className="h-32 mx-auto object-contain mix-blend-multiply border-b-2 border-blue-200 pb-2 mb-2" />
                             <p className="text-sm text-blue-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4"/> נחתם דיגיטלית בהצלחה</p>
                             <p className="text-xs text-slate-500 mt-2 text-center leading-snug print:hidden">אם נפתח וואטסאפ ליועץ — שלחו את ההודעה כדי לעדכן אותו.</p>
                           </div>
                         )}
                         {/* חלופה להדפסה אם המסמך טרם נחתם דיגיטלית */}
                         <div className="hidden print:flex flex-col items-center justify-end w-[350px]">
                           {!clientSignature && (
                              <>
                                <div className="border-b-2 border-slate-400 w-full mt-24 mb-2"></div>
                                <p className="text-center text-slate-500 text-sm font-medium">חתימת הלקוח (אישור עקרוני)</p>
                              </>
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                </section>

                {/* FOOTER */}
                <footer className="py-10 px-8 md:px-20 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-slate-500 print:bg-white">
                  <div className="flex flex-col md:flex-row items-center gap-6 mb-4 md:mb-0 font-medium text-slate-700">
                    {/* הצגת פרטי היועץ בהצעה */}
                    {generatedQuote?.agentDetails ? (
                      <>
                        <span className="flex items-center gap-2 bg-blue-100/50 px-3 py-1.5 rounded-lg border border-blue-200">
                          {datasheetToSrc(normalizeDatasheet(generatedQuote.agentDetails.photo)) ? (
                            <img
                              src={datasheetToSrc(normalizeDatasheet(generatedQuote.agentDetails.photo))}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full border-2 border-blue-200 object-cover shadow-sm"
                            />
                          ) : (
                            <User className="w-5 h-5 shrink-0 text-blue-600" />
                          )}
                          יועץ אישי: {generatedQuote.agentDetails.name}
                        </span>
                        <span className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-600"/> {generatedQuote.agentDetails.phone}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-600"/> {adminPrices.companyPhone}</span>
                    )}
                    <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600"/> עין יעקב</span>
                    <CompanySocialLinks className="w-full md:w-auto" />
                  </div>
                  <div className="flex items-center gap-3 font-bold text-slate-800 text-xl">
                     <BrandLogo className="h-10 w-10 object-contain" />
                     <span className="hidden md:inline-block text-blue-900">מומחי אנרגיה סולארית</span>
                  </div>
                </footer>

                {/* Floating Action Button (WhatsApp) */}
                <div className="fixed bottom-8 left-8 z-50 print:hidden">
                  <a 
                    href={!timeLeft.expired ? whatsappLink : `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`שלום, אני ${generatedQuote?.clientName ? generatedQuote.clientName : ''} ${generatedQuote?.clientCity ? `מ${generatedQuote.clientCity}` : ''}. עברתי על הצעת המחיר למערכת סולארית ואני מעוניין/ת לאשר את ההצעה ולהתקדם. אשמח שתיצרו איתי קשר.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] text-white px-5 py-3 rounded-full shadow-2xl hover:bg-[#20bd5a] transition-all transform hover:scale-105 group relative overflow-hidden border-2 border-white"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {/* WhatsApp SVG Icon */}
                    <svg className="w-7 h-7 fill-current z-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <span className="font-bold tracking-wide z-10 hidden md:block text-lg">לאשר הצעה</span>
                    
                    {/* Ripple Effect Background */}
                    <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-30 -z-10 scale-150"></div>
                  </a>
                </div>

              </div>

              {/* View Internal Costs (Admin Only) */}
              {currentUser.role === 'admin' && (
                <div className="max-w-6xl mx-auto mt-8 p-7 rounded-2xl text-sm font-mono text-slate-400 print:hidden border border-white/10 shadow-2xl"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <p className="font-black text-white mb-5 text-base border-b border-white/10 pb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" />
                    תצוגת מנהל — עלויות פנימיות (Cost)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-y-4 gap-x-6 border-b border-white/8 pb-5 mb-5">
                    <p>פאנלים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.panels)}</span></p>
                    <p>ממירים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.inverter)}</span></p>
                    <p>אגירה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.batteries)}</span></p>
                    <p>קונסטרוקציה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.construction)}</span></p>
                    <p>עבודה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.labor)}</span></p>
                    <p>הובלות: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.logistics)}</span></p>
                    <p>הנדסה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.engineering)}</span></p>
                    <p>חשמל/בדיקות: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.electricianAndChecks)}</span></p>
                    <p>לוחות חשמל: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.electricalBoxes)}</span></p>
                    <p>אביזרים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.accessories)}</span></p>
                    <p>אופטימייזרים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.optimizers)}</span></p>
                    <p>אגרות/שטיפה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.washing + generatedQuote.breakdown.fees)}</span></p>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-5 rounded-2xl border border-white/8">
                    <p className="text-white text-lg">סה"כ Cost פנימי: <span className="font-black text-orange-300">₪{Math.round(generatedQuote.breakdown.totalCost).toLocaleString()}</span></p>
                    <p className="text-green-400 text-lg">רווח נקי: <span className="font-black text-green-300">₪{Math.round(generatedQuote.breakdown.marginValue).toLocaleString()}</span></p>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}