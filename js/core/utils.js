/* =========================================================
   utils.js — Small shared helpers: ids, dates, money, HTML.
   Dates are stored as 'YYYY-MM-DD' strings everywhere so they
   never shift with time zones.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = {};

  /* ---------- ids ---------- */
  U.uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  /* ---------- dates ---------- */
  U.pad = (n) => String(n).padStart(2, '0');
  U.toISO = (d) => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  U.parse = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12); // noon avoids DST edge cases
  };
  U.isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  U.today = () => U.toISO(new Date());
  U.addDays = (s, n) => { const d = U.parse(s); d.setDate(d.getDate() + n); return U.toISO(d); };
  U.daysBetween = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 86400000);
  U.daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();

  /** Date in month (y, m0 + offset) using the anchor day, clamped to month end (e.g. 31st → 30th). */
  U.monthDate = (y, m0, day) => {
    const d = new Date(y, m0, 1, 12);
    const max = U.daysInMonth(d.getFullYear(), d.getMonth());
    d.setDate(Math.min(day, max));
    return U.toISO(d);
  };
  U.addMonths = (s, n) => {
    const d = U.parse(s);
    return U.monthDate(d.getFullYear(), d.getMonth() + n, d.getDate());
  };
  U.monthsBetween = (a, b) => {
    const A = U.parse(a), Bd = U.parse(b);
    return (Bd.getFullYear() - A.getFullYear()) * 12 + (Bd.getMonth() - A.getMonth());
  };

  U.startOfWeek = (s, weekStart = 1) => {
    const d = U.parse(s);
    const diff = (d.getDay() - weekStart + 7) % 7;
    d.setDate(d.getDate() - diff);
    return U.toISO(d);
  };
  U.startOfMonth = (s) => s.slice(0, 8) + '01';
  U.endOfMonth = (s) => { const d = U.parse(s); return U.monthDate(d.getFullYear(), d.getMonth(), 31); };
  U.startOfYear = (s) => s.slice(0, 4) + '-01-01';
  U.endOfYear = (s) => s.slice(0, 4) + '-12-31';
  U.min = (a, b) => (a < b ? a : b);
  U.max = (a, b) => (a > b ? a : b);

  /* ---------- formatting ---------- */
  const settings = () => (B.store && B.store.data && B.store.data.settings) || {};
  U.locale = () => settings().locale || 'en-AU';

  U.money = (n, opts = {}) => {
    const s = settings();
    const v = Number(n) || 0;
    try {
      return new Intl.NumberFormat(U.locale(), {
        style: 'currency',
        currency: s.currency || 'AUD',
        minimumFractionDigits: opts.whole ? 0 : 2,
        maximumFractionDigits: opts.whole ? 0 : 2
      }).format(v);
    } catch (e) {
      return '$' + v.toFixed(2);
    }
  };

  U.currencySymbol = () => {
    try {
      const parts = new Intl.NumberFormat(U.locale(), { style: 'currency', currency: settings().currency || 'AUD' }).formatToParts(0);
      return (parts.find((p) => p.type === 'currency') || {}).value || '$';
    } catch (e) { return '$'; }
  };

  U.fmtDate = (s, style = 'medium') => {
    if (!U.isISO(s)) return '';
    const d = U.parse(s);
    const opts = {
      short: { day: 'numeric', month: 'short' },
      medium: { weekday: 'short', day: 'numeric', month: 'short' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      full: { day: 'numeric', month: 'short', year: 'numeric' },
      month: { month: 'long', year: 'numeric' },
      monthShort: { month: 'short' },
      weekday: { weekday: 'short' }
    }[style];
    return d.toLocaleDateString(U.locale(), opts);
  };

  /** "Today", "Tomorrow", "in 5 days", "3 days ago" */
  U.relDay = (s) => {
    const n = U.daysBetween(U.today(), s);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1) return `in ${n} days`;
    return `${-n} days ago`;
  };

  U.ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  U.pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  /* ---------- HTML ---------- */
  U.esc = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.debounce = (fn, ms = 250) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  U.round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  U.sum = (arr, f = (x) => x) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);

  U.download = (filename, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  B.utils = U;
})(window.Budget);
