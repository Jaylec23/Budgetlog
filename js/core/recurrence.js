/* =========================================================
   recurrence.js — Works out when repeating bills/income fall.
   ---------------------------------------------------------
   Any item with { frequency, startDate, endDate?, customEvery?,
   customUnit?, paused? } can be passed in.

   Monthly-style rules keep the start day (e.g. the 15th). If a
   month is shorter (start on the 31st), it uses the last day.
   To add a new frequency, add one line to FREQUENCIES.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = B.utils;

  // unit: 'day' (n = days between) | 'month' (n = months between)
  const FREQUENCIES = [
    { id: 'weekly',      label: 'Weekly',                         unit: 'day',   n: 7 },
    { id: 'fortnightly', label: 'Fortnightly (every 2 weeks)',     unit: 'day',   n: 14 },
    { id: 'fourweekly',  label: 'Every 4 weeks',                   unit: 'day',   n: 28 },
    { id: 'monthly',     label: 'Monthly',                         unit: 'month', n: 1 },
    { id: 'bimonthly',   label: 'Bi-monthly (every 2 months)',     unit: 'month', n: 2 },
    { id: 'quarterly',   label: 'Quarterly (every 3 months)',      unit: 'month', n: 3 },
    { id: 'halfyearly',  label: 'Half-yearly (every 6 months)',    unit: 'month', n: 6 },
    { id: 'yearly',      label: 'Yearly',                          unit: 'month', n: 12 },
    { id: 'once',        label: 'One-off (does not repeat)',       unit: null,    n: 0 },
    { id: 'custom',      label: 'Custom (choose your own)',        unit: null,    n: 0 }
  ];

  const CUSTOM_UNITS = [
    { id: 'day', label: 'days' },
    { id: 'week', label: 'weeks' },
    { id: 'month', label: 'months' },
    { id: 'year', label: 'years' }
  ];

  // Shared "per period" options used for set-aside amounts & comparisons.
  const PERIODS = [
    { id: 'week',      label: 'per week',      perYear: 365.25 / 7 },
    { id: 'fortnight', label: 'per fortnight', perYear: 365.25 / 14 },
    { id: 'fourweek',  label: 'per 4 weeks',   perYear: 365.25 / 28 },
    { id: 'month',     label: 'per month',     perYear: 12 },
    { id: 'year',      label: 'per year',      perYear: 1 }
  ];

  const R = {};
  R.FREQUENCIES = FREQUENCIES;
  R.CUSTOM_UNITS = CUSTOM_UNITS;
  R.PERIODS = PERIODS;
  R.freq = (id) => FREQUENCIES.find((f) => f.id === id) || FREQUENCIES[3];

  /** Normalise any item to { unit: 'day'|'month'|null, n } */
  R.rule = (item) => {
    if (!item || item.frequency === 'once') return { unit: null, n: 0 };
    if (item.frequency === 'custom') {
      const n = Math.max(1, parseInt(item.customEvery, 10) || 1);
      switch (item.customUnit) {
        case 'day': return { unit: 'day', n };
        case 'week': return { unit: 'day', n: n * 7 };
        case 'year': return { unit: 'month', n: n * 12 };
        default: return { unit: 'month', n };
      }
    }
    const f = R.freq(item.frequency);
    return { unit: f.unit, n: f.n };
  };

  /** All due dates (ISO strings) between from and to, inclusive. */
  R.occurrences = (item, from, to) => {
    const out = [];
    if (!item || item.paused || !U.isISO(item.startDate) || !from || !to) return out;
    const start = item.startDate;
    const end = item.endDate && U.isISO(item.endDate) ? item.endDate : null;
    const last = end ? U.min(end, to) : to;
    if (last < start || last < from) return out;

    const { unit, n } = R.rule(item);

    if (!unit) {
      if (start >= from && start <= last) out.push(start);
      return out;
    }

    if (unit === 'day') {
      let k = Math.max(0, Math.ceil(U.daysBetween(start, from) / n));
      for (let guard = 0; guard < 5000; guard++, k++) {
        const d = U.addDays(start, k * n);
        if (d > last) break;
        if (d >= from) out.push(d);
      }
      return out;
    }

    // month-based
    const s = U.parse(start);
    const anchorDay = s.getDate();
    let k = Math.max(0, Math.floor(U.monthsBetween(start, from) / n) - 1);
    for (let guard = 0; guard < 5000; guard++, k++) {
      const d = U.monthDate(s.getFullYear(), s.getMonth() + k * n, anchorDay);
      if (d > last) break;
      if (d >= from) out.push(d);
    }
    return out;
  };

  /** Next `count` due dates on/after `from` (default today). */
  R.next = (item, count = 1, from = U.today()) => {
    const { unit, n } = R.rule(item);
    const span = unit === 'day' ? n : unit === 'month' ? n * 31 : 0;
    const horizon = U.addDays(from, Math.max(400, span * (count + 1)));
    return R.occurrences(item, from, horizon).slice(0, count);
  };

  /** Most recent due date before `before` (default today). */
  R.previous = (item, before = U.today()) => {
    const { unit, n } = R.rule(item);
    const span = unit === 'day' ? n : unit === 'month' ? n * 31 : 400;
    const list = R.occurrences(item, U.addDays(before, -Math.max(span * 2, 400)), U.addDays(before, -1));
    return list[list.length - 1] || null;
  };

  /** How many times a year this happens (0 for one-off). */
  R.perYear = (item) => {
    const { unit, n } = R.rule(item);
    if (!unit) return 0;
    return unit === 'day' ? 365.25 / n : 12 / n;
  };

  /** Convert an item's amount to an amount per period ('week'|'fortnight'|'month'|'year'). */
  R.amountPer = (item, periodId) => {
    const p = PERIODS.find((x) => x.id === periodId) || PERIODS[2];
    return (Number(item.amount) || 0) * R.perYear(item) / p.perYear;
  };

  /** Plain-English description, e.g. "Every 2 weeks on Monday". */
  R.describe = (item) => {
    if (!item || !U.isISO(item.startDate)) return '';
    const d = U.parse(item.startDate);
    const weekday = d.toLocaleDateString(U.locale(), { weekday: 'long' });
    const day = U.ordinal(d.getDate());
    const monthName = d.toLocaleDateString(U.locale(), { month: 'long' });
    const { unit, n } = R.rule(item);
    let txt;
    if (!unit) txt = `Once on ${U.fmtDate(item.startDate, 'full')}`;
    else if (unit === 'day') {
      if (n % 7 === 0) {
        const w = n / 7;
        txt = w === 1 ? `Every ${weekday}` : `Every ${w} weeks on ${weekday}`;
      } else txt = n === 1 ? 'Every day' : `Every ${n} days`;
    } else if (n === 1) txt = `Monthly on the ${day}`;
    else if (n === 12) txt = `Yearly on ${day} ${monthName}`;
    else if (n % 12 === 0) txt = `Every ${n / 12} years on ${day} ${monthName}`;
    else txt = `Every ${n} months on the ${day}`;
    if (item.endDate) txt += `, until ${U.fmtDate(item.endDate, 'full')}`;
    return txt;
  };

  B.recur = R;
})(window.Budget);
