/* =========================================================
   pages/calendar.js — Month calendar of bills, pay days and
   spending. Tap a day to see (and tick off) what's on it.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  const state = { month: null, selected: null, show: { bills: true, income: true, spend: true } };

  function eventsFor(from, to) {
    const map = {};
    const add = (d, ev) => (map[d] = map[d] || []).push(ev);
    if (state.show.bills) C.billOccurrences(from, to).forEach((o) => add(o.date, { kind: 'bill', o }));
    if (state.show.income) C.incomeOccurrences(from, to).forEach((o) => add(o.date, { kind: 'income', o }));
    if (state.show.spend) C.transactionsIn(from, to).forEach((t) => add(t.date, { kind: 'tx', t }));
    return map;
  }

  function dayPanel(date, evs) {
    const bills = evs.filter((e) => e.kind === 'bill');
    const inc = evs.filter((e) => e.kind === 'income');
    const tx = evs.filter((e) => e.kind === 'tx');
    return `<section class="card card--flush" aria-labelledby="day-title" id="day-panel">
      <div class="card__head"><h2 id="day-title">${U.fmtDate(date, 'long')}</h2>
        <div class="row"><button class="btn btn--ghost btn--sm" data-add="bill">＋ Bill</button><button class="btn btn--ghost btn--sm" data-add="spend">＋ Spending</button></div></div>
      ${!evs.length ? '<p class="muted" style="padding:0 18px 18px">Nothing on this day.</p>' : ''}
      ${bills.length ? `<div class="group-head"><span>Bills</span><span class="num">${U.money(U.sum(bills, (e) => e.o.amount))}</span></div>
        <ul class="list">${bills.map((e) => B.pages._occRow(e.o, { showDate: false })).join('')}</ul>` : ''}
      ${inc.length ? `<div class="group-head"><span>Pay day</span><span class="num pos">+${U.money(U.sum(inc, (e) => e.o.amount))}</span></div>
        <ul class="list">${inc.map((e) => B.pages._payDayRow(e.o)).join('')}</ul>` : ''}
      ${tx.length ? `<div class="group-head"><span>Spending & money in</span></div>
        <ul class="list">${tx.map((e) => { const c = C.category(e.t.categoryId); const isIn = e.t.type === 'income'; return `<li class="list__item">
          <span class="list__icon" style="--c:${esc(c.color)}" aria-hidden="true">${isIn ? '➕' : esc(c.icon || '•')}</span>
          <div class="list__main"><div class="list__title">${esc(e.t.description)}</div></div>
          <div class="list__amount ${isIn ? 'pos' : ''}">${isIn ? '+' : ''}${U.money(e.t.amount)}</div>
          <div class="list__actions compact-mobile"><button class="icon-btn" data-edit-tx="${e.t.id}" aria-label="Edit">✎</button></div></li>`; }).join('')}</ul>` : ''}
    </section>`;
  }

  B.pages.calendar = {
    title: 'Calendar', icon: '📅',
    render(main) {
      if (!state.month) state.month = C.period('month');
      if (!state.selected) state.selected = U.today();
      const p = state.month;
      const ws = Number(S.data.settings.weekStart);
      const gridStart = U.startOfWeek(p.from, ws);
      const gridEnd = U.addDays(U.startOfWeek(p.to, ws), 6);
      const evs = eventsFor(gridStart, gridEnd);
      const sum = C.summary(p.from, p.to);

      const dows = [...Array(7)].map((_, i) => U.fmtDate(U.addDays(gridStart, i), 'weekday'));
      const cells = [];
      for (let d = gridStart; d <= gridEnd; d = U.addDays(d, 1)) {
        const list = evs[d] || [];
        const out = U.sum(list.filter((e) => e.kind === 'bill'), (e) => e.o.amount) + U.sum(list.filter((e) => e.kind === 'tx' && e.t.type !== 'income'), (e) => e.t.amount);
        const labelParts = list.map((e) => e.kind === 'bill' ? `${e.o.bill.name} ${U.money(e.o.amount)} ${C.STATUS_LABEL[e.o.status]}` : e.kind === 'income' ? `Pay: ${e.o.income.name}` : e.t.description);
        const shown = list.filter((e) => e.kind !== 'tx').slice(0, 3);
        cells.push(`<button type="button" class="cal__day${d.slice(0, 7) !== p.from.slice(0, 7) ? ' is-other' : ''}${d === U.today() ? ' is-today' : ''}${d === state.selected ? ' is-selected' : ''}"
            data-day="${d}" aria-pressed="${d === state.selected}" aria-label="${esc(U.fmtDate(d, 'long'))}${list.length ? '. ' + esc(labelParts.join(', ')) : '. Nothing due'}">
          <span class="cal__num" aria-hidden="true">${Number(d.slice(8))}</span>
          ${shown.map((e) => e.kind === 'income'
            ? `<span class="cal__ev cal__ev--in" aria-hidden="true">+ ${e.o.estimated ? '≈ ' : ''}${esc(e.o.income.name)}</span>`
            : `<span class="cal__ev${e.o.payment ? ' is-paid' : ''}" style="--c:${esc(C.category(e.o.bill.categoryId).color)}" aria-hidden="true">${esc(e.o.bill.name)}</span>`).join('')}
          ${list.length > shown.length ? `<span class="cal__more" aria-hidden="true">+${list.length - shown.length} more</span>` : ''}
          ${out ? `<span class="cal__total" aria-hidden="true">−${U.money(out, { whole: true })}</span>` : ''}
          <span class="cal__dots" aria-hidden="true">${list.slice(0, 4).map((e) => `<i style="--c:${e.kind === 'income' ? 'var(--chart-in)' : e.kind === 'bill' ? (e.o.status === 'overdue' ? 'var(--danger)' : C.category(e.o.bill.categoryId).color) : 'var(--chart-spend)'}"></i>`).join('')}</span>
        </button>`);
      }

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Calendar</h1><p>Bills, pay days and spending by date.</p></div>
        </div>
        <div class="period-nav">
          <button class="icon-btn" data-nav="-1" aria-label="Previous month">◀</button>
          <div class="period-nav__label" aria-live="polite">${esc(p.label)}</div>
          <button class="icon-btn" data-nav="1" aria-label="Next month">▶</button>
          <button class="btn btn--ghost btn--sm" data-nav="0">Today</button>
        </div>
        <div class="toolbar" role="group" aria-label="Show on calendar">
          ${[['bills', 'Bills'], ['income', 'Pay days'], ['spend', 'Spending']].map(([k, l]) => `<label class="check" style="padding-top:0"><input type="checkbox" data-show="${k}" ${state.show[k] ? 'checked' : ''}> <span>${l}</span></label>`).join('')}
          <span class="grow"></span>
          <span class="small muted">Month: in <strong class="pos num">${U.money(sum.incomeTotal)}</strong> · out <strong class="neg num">${U.money(sum.outTotal)}</strong></span>
        </div>
        <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(280px,1fr);align-items:start" id="cal-wrap">
          <div class="cal" role="group" aria-label="${esc(p.label)}">
            ${dows.map((d) => `<div class="cal__dow" aria-hidden="true">${esc(d)}</div>`).join('')}
            ${cells.join('')}
          </div>
          ${dayPanel(state.selected, evs[state.selected] || eventsFor(state.selected, state.selected)[state.selected] || [])}
        </div>`;

      // stack on small screens
      if (window.matchMedia('(max-width: 900px)').matches) main.querySelector('#cal-wrap').style.gridTemplateColumns = '1fr';

      main.querySelectorAll('[data-show]').forEach((c) => (c.onchange = () => { state.show[c.dataset.show] = c.checked; this.render(main); }));

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.nav) {
          state.month = d.nav === '0' ? C.period('month') : C.shiftPeriod(state.month, Number(d.nav));
          if (d.nav === '0') state.selected = U.today();
          return this.render(main);
        }
        if (d.day) {
          state.selected = d.day;
          this.render(main);
          const btn = main.querySelector(`[data-day="${d.day}"]`); if (btn) btn.focus();
          if (window.matchMedia('(max-width: 900px)').matches) main.querySelector('#day-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (d.add === 'bill') return B.forms.bill(null, { startDate: state.selected });
        if (d.add === 'spend') return B.forms.transaction(null, { date: state.selected });
        if (d.spend) return B.forms.transaction(null, { billId: d.spend, date: state.selected <= U.today() ? state.selected : U.today() });
        if (d.received) { const [id, dt] = d.received.split('|'); return B.forms.markReceived(id, dt); }
        if (d.editTx) return B.forms.transaction(d.editTx);
        if (d.quickpaid) { const [id, dt] = d.quickpaid.split('|'); return B.forms.quickPaid(id, dt); }
        if (d.paid) { const [id, dt] = d.paid.split('|'); return B.forms.markPaid(id, dt); }
      };
    }
  };
})(window.Budget);
