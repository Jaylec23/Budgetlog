/* =========================================================
   pages/insights.js — Reports by week, fortnight, month, year
   or a custom range. Sections can be shown/hidden with the
   "Customise" button (saved in settings.reportSections).
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  const TABS = [
    { id: 'week', label: 'Week' }, { id: 'fortnight', label: 'Fortnight' },
    { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'custom', label: 'Custom' }
  ];
  const SECTION_LABELS = {
    summary: 'Summary numbers', trend: 'Trend chart', categories: 'Spending by category',
    accounts: 'Spending by account', metrics: 'Key measures', list: 'Everything in this period'
  };

  const state = { type: null, period: null, from: null, to: null };

  const SERIES = [
    { name: 'Money in', color: 'var(--chart-in)' },
    { name: 'Bills', color: 'var(--chart-out)' },
    { name: 'Spending', color: 'var(--chart-spend)' }
  ];

  function trend(p) {
    let periods = [];
    if (p.type === 'year') {
      for (let m = 0; m < 12; m++) periods.push(C.period('month', `${p.from.slice(0, 4)}-${U.pad(m + 1)}-01`));
    } else if (p.type === 'custom') {
      return '';
    } else {
      const n = { week: 8, fortnight: 6, month: 6 }[p.type];
      let cur = p;
      for (let i = 0; i < n; i++) { periods.unshift(cur); cur = C.shiftPeriod(cur, -1); }
    }
    const groups = periods.map((x) => {
      const s = C.summary(x.from, x.to);
      return {
        label: x.type === 'month' ? U.fmtDate(x.from, 'monthShort') : U.fmtDate(x.from, 'short'),
        values: [s.incomeTotal, s.billsTotal, s.spendTotal],
        current: x.from === p.from || (p.type === 'year' && x.from.slice(0, 7) === U.today().slice(0, 7))
      };
    });
    const title = p.type === 'year' ? `Each month of ${p.label}` : `Last ${periods.length} ${p.type === 'month' ? 'months' : p.type + 's'}`;
    return `<section class="card" aria-labelledby="r-trend">
      <div class="card__head"><h2 id="r-trend">${esc(title)}</h2></div>
      ${ui.columns(groups, SERIES, { caption: title })}
    </section>`;
  }

  function metrics(p, sum) {
    const prev = p.type !== 'custom' ? C.shiftPeriod(p, -1) : null;
    const ps = prev ? C.summary(prev.from, prev.to) : null;
    const change = ps && ps.outTotal > 0 ? ((sum.outTotal - ps.outTotal) / ps.outTotal) * 100 : null;
    const biggestBill = sum.bills.slice().sort((a, b) => b.amount - a.amount)[0];
    const cats = Object.entries(sum.byCategory).sort((a, b) => b[1] - a[1]);
    const past = sum.bills.filter((o) => o.date <= U.today());
    return `<section class="card" aria-labelledby="r-met">
      <div class="card__head"><h2 id="r-met">Key measures</h2></div>
      <dl class="kv">
        <dt>Bills paid</dt><dd>${sum.paidCount} of ${sum.bills.length}</dd>
        <dt>Paid on time</dt><dd>${past.length ? `${U.pct(sum.onTimeCount, past.length)}%` : '—'}</dd>
        <dt>Overdue now</dt><dd class="${sum.overdueCount ? 'neg' : ''}">${sum.overdueCount}</dd>
        <dt>Average out per day</dt><dd>${U.money(sum.avgDailyOut)}</dd>
        <dt>Savings rate</dt><dd class="${sum.savingsRate >= 0 ? 'pos' : 'neg'}">${sum.incomeTotal ? Math.round(sum.savingsRate * 100) + '%' : '—'}</dd>
        <dt>Biggest bill</dt><dd>${biggestBill ? `${esc(biggestBill.bill.name)} · ${U.money(biggestBill.amount)}` : '—'}</dd>
        <dt>Biggest category</dt><dd>${cats[0] ? `${esc(C.category(cats[0][0]).name)} · ${U.money(cats[0][1])}` : '—'}</dd>
        ${change != null ? `<dt>Money out vs previous ${p.type}</dt><dd class="${change > 0 ? 'neg' : 'pos'}">${change > 0 ? '▲' : '▼'} ${Math.abs(Math.round(change))}%</dd>` : ''}
      </dl>
    </section>`;
  }

  function itemsTable(sum) {
    const rows = [
      ...sum.income.map((o) => ({ date: o.date, name: o.income.name, cat: 'Income', acc: C.account(o.income.accountId).name, amount: o.amount, sign: 1, status: o.estimated ? 'Estimate' : o.receipt ? 'Received' : '' })),
      ...sum.extraIncome.map((t) => ({ date: t.date, name: t.description, cat: 'Money in', acc: C.account(t.accountId).name, amount: Number(t.amount), sign: 1, status: '' })),
      ...sum.bills.map((o) => ({ date: o.date, name: o.bill.name, cat: C.category(o.bill.categoryId).name, acc: C.account(o.bill.accountId).name, amount: o.amount, sign: -1, status: C.STATUS_LABEL[o.status] })),
      ...sum.spend.map((t) => ({ date: t.date, name: t.description, cat: C.category(t.categoryId).name, acc: C.account(t.accountId).name, amount: Number(t.amount), sign: -1, status: 'Spent' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    state.rows = rows;
    return `<section class="card card--flush" aria-labelledby="r-list">
      <div class="card__head"><h2 id="r-list">Everything in this period</h2><button class="btn btn--ghost btn--sm" data-act="csv">⬇ Download CSV</button></div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Account</th><th>Status</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="nowrap">${U.fmtDate(r.date, 'short')}</td><td>${esc(r.name)}</td><td>${esc(r.cat)}</td><td>${esc(r.acc)}</td><td>${esc(r.status)}</td>
          <td class="r ${r.sign > 0 ? 'pos' : ''}">${r.sign > 0 ? '+' : '−'}${U.money(r.amount)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted" style="padding:0 18px 18px">Nothing in this period.</p>'}
    </section>`;
  }

  B.pages.insights = {
    title: 'Insights', icon: '📊',
    render(main) {
      const s = S.data.settings;
      if (!state.type) state.type = 'month';
      if (!state.period || state.period.type !== state.type) {
        if (state.type === 'custom') {
          state.from = state.from || U.startOfMonth(U.addMonths(U.today(), -2));
          state.to = state.to || U.today();
          state.period = { type: 'custom', from: state.from, to: state.to, label: `${U.fmtDate(state.from, 'full')} – ${U.fmtDate(state.to, 'full')}` };
        } else state.period = C.period(state.type);
      }
      const p = state.period;
      const sum = C.summary(p.from, p.to);
      const sections = s.reportSections.filter((x) => x.visible).map((x) => x.id);

      const catRows = Object.entries(sum.byCategory).map(([id, v]) => { const c = C.category(id); return { label: c.name, icon: c.icon, color: c.color, value: v }; }).sort((a, b) => b.value - a.value);
      const accRows = Object.entries(sum.byAccount).map(([id, v]) => { const a = C.account(id); return { label: a.name, color: a.color, value: v }; }).sort((a, b) => b.value - a.value);

      const parts = {
        summary: `<div class="grid grid--stats">
          ${ui.stat({ label: 'Left over', value: U.money(sum.leftover), sub: sum.incomeTotal ? `${Math.round(sum.savingsRate * 100)}% of income kept` : '', tone: 'hero' })}
          ${ui.stat({ label: 'Money in', value: (sum.income.some((o) => o.estimated) ? '≈ ' : '') + U.money(sum.incomeTotal), sub: sum.income.some((o) => o.estimated) ? 'includes estimates' : '' })}
          ${ui.stat({ label: 'Bills', value: U.money(sum.billsTotal), sub: `${U.money(sum.billsPaid)} paid · ${U.money(sum.billsUnpaid)} to go` })}
          ${ui.stat({ label: 'Spending', value: U.money(sum.spendTotal) })}
        </div>`,
        trend: trend(p),
        categories: `<section class="card" aria-labelledby="r-cat"><div class="card__head"><h2 id="r-cat">Where it went · by category</h2></div>${ui.hbars(catRows)}</section>`,
        accounts: `<section class="card" aria-labelledby="r-acc"><div class="card__head"><h2 id="r-acc">By account</h2></div>${ui.hbars(accRows)}</section>`,
        metrics: metrics(p, sum),
        list: itemsTable(sum)
      };

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Insights</h1><p>How you’re tracking over any stretch of time.</p></div>
          <div class="page-head__actions"><button class="btn btn--ghost" data-act="customise">⚙ Customise</button></div>
        </div>
        ${ui.tabs(TABS, state.type, 'rtype')}
        ${p.type === 'custom' ? `
          <div class="toolbar">
            <label for="r-from">From</label><input id="r-from" type="date" value="${p.from}" style="width:auto">
            <label for="r-to">To</label><input id="r-to" type="date" value="${p.to}" style="width:auto">
            <button class="btn btn--primary btn--sm" data-act="apply">Show</button>
          </div>` : `
          <div class="period-nav">
            <button class="icon-btn" data-nav="-1" aria-label="Previous ${p.type}">◀</button>
            <div class="period-nav__label" aria-live="polite">${esc(p.label)}</div>
            <button class="icon-btn" data-nav="1" aria-label="Next ${p.type}">▶</button>
            <button class="btn btn--ghost btn--sm" data-nav="0">Now</button>
          </div>`}
        <div class="stack">
          ${sections.filter((id) => ['summary', 'trend'].includes(id)).map((id) => parts[id]).join('')}
          <div class="grid grid--2">${sections.filter((id) => ['categories', 'accounts', 'metrics'].includes(id)).map((id) => parts[id]).join('')}</div>
          ${sections.includes('list') ? parts.list : ''}
          ${!sections.length ? ui.empty({ icon: '📊', title: 'All sections are hidden', action: '<button class="btn btn--primary" data-act="customise">Choose sections</button>' }) : ''}
        </div>`;

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.rtype) { state.type = d.rtype; state.period = null; return this.render(main); }
        if (d.nav) { state.period = d.nav === '0' ? C.period(state.type) : C.shiftPeriod(state.period, Number(d.nav)); return this.render(main); }
        if (d.act === 'apply') {
          const f = main.querySelector('#r-from').value, to = main.querySelector('#r-to').value;
          if (!U.isISO(f) || !U.isISO(to) || f > to) return ui.toast('Pick a start date before the end date', { type: 'error' });
          state.from = f; state.to = to; state.period = null; return this.render(main);
        }
        if (d.act === 'csv') {
          const lines = [['Date', 'Item', 'Category', 'Account', 'Status', 'Amount']].concat(
            state.rows.map((r) => [r.date, r.name, r.cat, r.acc, r.status, (r.sign * r.amount).toFixed(2)]));
          U.download(`budget-${p.from}-to-${p.to}.csv`, lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
        }
        if (d.act === 'customise') {
          const cur = S.data.settings.reportSections;
          ui.form({
            title: 'Choose what Insights shows', size: 'sm', submitLabel: 'Save',
            values: Object.fromEntries(cur.map((x) => [x.id, x.visible])),
            fields: cur.map((x) => ({ name: x.id, label: SECTION_LABELS[x.id], type: 'checkbox' })),
            onSubmit: (v) => S.updateSettings({ reportSections: cur.map((x) => ({ id: x.id, visible: !!v[x.id] })) })
          });
        }
      };
    }
  };
  B.pages._reportSectionLabels = SECTION_LABELS;
})(window.Budget);
