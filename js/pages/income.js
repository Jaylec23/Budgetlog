/* =========================================================
   pages/income.js — Regular income (pay, benefits, side jobs),
   recent and upcoming pay days. Income marked "an estimate"
   asks for the real amount on each pay day.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store, R = B.recur;
  const esc = U.esc;

  function payDayRow(o) {
    const isPast = o.date <= U.today();
    const variable = o.income.amountType === 'variable';
    let badge = '';
    if (o.receipt) badge = ui.badge('paid', 'Amount entered');
    else if (o.needsAmount) badge = ui.badge('due-soon', 'Enter amount');
    else if (o.estimated) badge = ui.badge('upcoming', 'Estimate');
    const diff = o.receipt ? o.amount - o.expected : 0;
    return `<li class="list__item">
      <div class="list__main">
        <div class="list__title">${U.fmtDate(o.date, 'medium')}</div>
        <div class="list__meta"><span>${esc(o.income.name)} · ${U.relDay(o.date)}</span>${badge}
          ${o.receipt && Math.abs(diff) >= 0.01 ? `<span class="${diff > 0 ? 'pos' : 'neg'}">${diff > 0 ? '+' : '−'}${U.money(Math.abs(diff))} vs estimate</span>` : ''}</div>
      </div>
      <div class="list__amount pos">${o.estimated ? '≈ ' : ''}+${U.money(o.amount)}</div>
      ${isPast && (variable || o.receipt) ? `<div class="list__actions compact-mobile">
        <button class="btn btn--ghost btn--sm" data-received="${o.income.id}|${o.date}">${o.receipt ? 'Edit' : 'Enter amount'}</button></div>` : ''}
    </li>`;
  }

  B.pages.income = {
    title: 'Income', icon: '💰',
    render(main) {
      const list = S.list('income').slice().sort((a, b) => a.name.localeCompare(b.name));
      const active = list.filter((i) => !i.paused);
      const hasVariable = active.some((i) => i.amountType === 'variable');
      const recent = C.incomeOccurrences(U.addDays(U.today(), -42), U.addDays(U.today(), -1)).reverse();
      const upcoming = C.incomeOccurrences(U.today(), U.addDays(U.today(), 42));
      const toConfirm = C.incomeToConfirm().length;

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Income</h1><p>Your regular pay and money coming in.</p></div>
          <div class="page-head__actions">
            <button class="btn btn--ghost" data-act="oneoff">＋ One-off money in</button>
            <button class="btn btn--primary" data-act="add">＋ Add income</button>
          </div>
        </div>
        <div class="grid grid--stats" style="margin-bottom:16px">
          ${R.PERIODS.map((p, i) => ui.stat({ label: `Income ${p.label}`, value: (hasVariable ? '≈ ' : '') + U.money(U.sum(active, (x) => R.amountPer(x, p.id)), { whole: p.id === 'year' }), sub: i === 2 && hasVariable ? 'includes estimates' : '', tone: i === 2 ? 'hero' : '' })).join('')}
        </div>
        ${list.length ? `
        <div class="grid grid--2">
          <section class="card card--flush" aria-labelledby="inc-src">
            <div class="card__head"><h2 id="inc-src">Income sources</h2></div>
            <ul class="list">${list.map((inc) => {
              const next = R.next(inc, 1)[0];
              const variable = inc.amountType === 'variable';
              return `<li class="list__item${inc.paused ? ' is-paused' : ''}">
                <span class="list__icon" style="--c:var(--chart-in)" aria-hidden="true">💰</span>
                <div class="list__main">
                  <div class="list__title">${esc(inc.name)} ${variable ? '<span class="badge badge--info">Varies</span>' : ''} ${inc.paused ? '<span class="badge badge--muted">Paused</span>' : ''}</div>
                  <div class="list__meta"><span>${esc(R.describe(inc))}</span>${ui.chip(inc.accountId, 'account')}</div>
                  <div class="list__meta">${next ? `Next: <strong>${U.fmtDate(next, 'medium')}</strong> (${U.relDay(next)})` : 'No more pay dates'}</div>
                </div>
                <div class="list__amount">${variable ? '≈ ' : ''}${U.money(inc.amount)}<small>${U.money(R.amountPer(inc, 'month'))}/mo</small></div>
                <div class="list__actions compact-mobile">
                  <button class="icon-btn" data-edit="${inc.id}" aria-label="Edit ${esc(inc.name)}">✎</button>
                  <button class="icon-btn" data-pause="${inc.id}" aria-label="${inc.paused ? 'Resume' : 'Pause'} ${esc(inc.name)}">${inc.paused ? '▶' : '⏸'}</button>
                </div>
              </li>`;
            }).join('')}</ul>
          </section>
          <section class="card card--flush" aria-labelledby="inc-up">
            <div class="card__head"><h2 id="inc-up">Pay days</h2>${toConfirm ? `<span class="badge badge--due-soon">${toConfirm} to enter</span>` : ''}</div>
            <div class="group-head"><span>Coming up · next 6 weeks</span><span class="num">${U.money(U.sum(upcoming, (o) => o.amount))}</span></div>
            ${upcoming.length ? `<ul class="list">${upcoming.map(payDayRow).join('')}</ul>` : '<p class="muted" style="padding:12px 18px">No pay days coming up.</p>'}
            <div class="group-head"><span>Last 6 weeks</span><span class="num">${U.money(U.sum(recent, (o) => o.amount))}</span></div>
            ${recent.length ? `<ul class="list">${recent.map(payDayRow).join('')}</ul>` : '<p class="muted" style="padding:12px 18px">No pay days in the last 6 weeks.</p>'}
          </section>
        </div>`
        : ui.empty({ icon: '💰', title: 'No income added yet', text: 'Add your pay so we can show what’s left after bills and how much to set aside each pay. If it changes each time, choose “An estimate”.', action: '<button class="btn btn--primary" data-act="add">＋ Add income</button>' })}`;

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.act === 'add') B.forms.income();
        if (d.act === 'oneoff') B.forms.transaction(null, { type: 'income' });
        if (d.edit) B.forms.income(d.edit);
        if (d.received) { const [id, dt] = d.received.split('|'); B.forms.markReceived(id, dt); }
        if (d.pause) { const i = S.get('income', d.pause); S.upsert('income', { id: i.id, paused: !i.paused }); }
      };
    }
  };
  B.pages._payDayRow = payDayRow;
})(window.Budget);
