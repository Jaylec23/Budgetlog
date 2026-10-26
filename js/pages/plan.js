/* =========================================================
   pages/plan.js — Pay plan: how much to put into each account
   every pay cycle (week, fortnight, 4 weeks or month).
   The cycle's length and start date are remembered in
   settings.cycle, so every future cycle follows on from it.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  const state = { period: null, key: '' };

  /** Save cycle settings and keep the older "set aside per…" setting in step. */
  function saveCycle(patch) {
    const cur = Object.assign({}, S.data.settings.cycle || {});
    const next = Object.assign(cur, patch);
    const per = C.cycleLength(next.length).period;
    // keep the cycle being viewed unless the length/start changed
    if (patch.length || patch.start) state.period = null;
    S.updateSettings({ cycle: next, payFrequency: per });
  }
  B.pages._saveCycle = saveCycle;

  /** Form to choose the cycle length and start date (used here and in Settings). */
  B.forms.cycle = () => {
    const cs = C.cycleSettings();
    ui.form({
      title: 'Your pay cycle', size: 'sm', submitLabel: 'Save',
      intro: 'Pick how often you budget and any day a cycle started. Every cycle after that is worked out for you.',
      values: { length: cs.length, start: cs.start },
      fields: [
        { name: 'length', label: 'How often?', type: 'select', options: C.CYCLE_LENGTHS.map((x) => ({ value: x.id, label: x.label })) },
        { name: 'start', label: 'A cycle started on', type: 'date', required: true,
          help: 'Usually your pay day. For monthly, the day of the month is used (e.g. the 15th → 15th to 14th).' },
        { name: 'prev', type: 'preview', compute: (v) => previewCycles(v) }
      ],
      onSubmit: (v) => { saveCycle({ length: v.length, start: v.start }); ui.toast('Pay cycle saved'); }
    });
  };

  function previewCycles(v) {
    if (!U.isISO(v.start)) return '';
    const saved = S.data.settings.cycle;
    S.data.settings.cycle = Object.assign({}, saved || {}, { length: v.length, start: v.start });
    const list = C.cycles(4);
    S.data.settings.cycle = saved;
    return `<div class="preview__title">Your next cycles</div>
      <ul class="preview__dates">${list.map((p, i) => `<li>${i === 0 ? '<strong>Now:</strong> ' : ''}${U.fmtDate(p.from, 'medium')} – ${U.fmtDate(p.to, 'medium')}</li>`).join('')}</ul>`;
  }

  function setupCard(cs) {
    const guessFrom = S.list('income').find((i) => !i.paused && i.frequency === { week: 'weekly', fortnight: 'fortnightly', fourweek: 'fourweekly', month: 'monthly' }[cs.length]);
    return `<section class="card card--tint" aria-labelledby="cy-setup" style="margin-bottom:16px">
      <div class="card__head"><h2 id="cy-setup">When does your ${esc(cs.info.name)} start?</h2></div>
      <p class="small">Choose once and it’s remembered. ${guessFrom ? `We’ve guessed from your <strong>${esc(guessFrom.name)}</strong> pay day.` : 'Most people use their pay day.'}</p>
      <form id="cy-form" class="form-row" style="align-items:end">
        <div class="field"><label class="field__label" for="cy-length">How often</label>
          <select id="cy-length">${C.CYCLE_LENGTHS.map((x) => `<option value="${x.id}" ${x.id === cs.length ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label" for="cy-start">A cycle started on</label>
          <input id="cy-start" type="date" value="${cs.start}" required></div>
        <div class="field"><button class="btn btn--primary btn--block" type="submit">Save my cycle</button></div>
      </form>
    </section>`;
  }

  function accountBlock(a, plan, p) {
    const acct = C.account(a.accountId);
    const isPay = plan.payAccountId != null && a.accountId === plan.payAccountId;
    const payName = plan.payAccountId != null ? C.account(plan.payAccountId).name : '';
    const instruction = isPay ? `Keep ${U.money(a.total)} here`
      : plan.payAccountId != null ? `Move ${U.money(a.total)} from ${esc(payName)}` : `Put ${U.money(a.total)} in`;
    const past = p.to < U.today();
    return `<li class="plan-acct${a.moved ? ' is-done' : ''}">
      <div class="plan-acct__head">
        <span class="list__icon" style="--c:${esc(acct.color)}" aria-hidden="true">🏦</span>
        <div class="grow">
          <div class="list__title">${esc(acct.name)}</div>${isPay ? `<span class="badge badge--paid">Pay lands here</span>` : ``}
          <div class="list__meta">${instruction}${a.incomeIn && !isPay ? ` · ${U.money(a.incomeIn)} pay comes in here too` : ''}</div>
        </div>
        <div class="list__amount" style="font-size:1.15rem">${U.money(a.total)}</div>
      </div>
      <ul class="plan-items">${a.items.sort((x, y) => (x.date || '').localeCompare(y.date || '') || y.amount - x.amount).map((it) => `
        <li><span>${it.kind === 'goal' ? '🎯 ' : ''}${esc(it.name)}${it.paid ? ' <span class="badge badge--paid">Paid</span>' : ''}</span>
          <span class="muted small">${it.kind === 'goal' ? 'goal savings' : it.even ? 'even share' : U.fmtDate(it.date, 'short')}</span>
          <span class="num">${it.bill && (it.bill.amountType === 'variable' || it.bill.trackSpending) ? '≈ ' : ''}${U.money(it.amount)}</span></li>`).join('')}
      </ul>
      ${a.total > 0 && !past ? `<button class="btn ${a.moved ? 'btn--primary' : 'btn--ghost'} btn--sm" data-moved="${p.from}|${a.accountId}" aria-pressed="${a.moved}" data-focus-key="mv-${a.accountId}">
        ${a.moved ? '✓ Done' : isPay ? 'Mark as kept aside' : 'Mark as moved'}</button>` : ''}
    </li>`;
  }

  function upcomingTable(from, cs) {
    const cycles = C.cycles(6, from);
    const plans = cycles.map((p) => C.cyclePlan(p));
    const ids = [...new Set(plans.flatMap((pl) => pl.accounts.filter((a) => a.total > 0).map((a) => a.accountId)))]
      .sort((a, b) => C.account(a).name.localeCompare(C.account(b).name));
    return `<section class="card card--flush" aria-labelledby="cy-next">
      <div class="card__head"><h2 id="cy-next">The next ${cycles.length} ${esc(cs.info.name)}s</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>${esc(cs.info.name[0].toUpperCase() + cs.info.name.slice(1))}</th><th class="r">Income</th>
          ${ids.map((id) => `<th class="r">${esc(C.account(id).name)}</th>`).join('')}<th class="r">Left over</th></tr></thead>
        <tbody>${plans.map((pl) => {
          const byId = Object.fromEntries(pl.accounts.map((a) => [a.accountId, a.total]));
          const cur = pl.period.from === state.period.from;
          return `<tr${cur ? ' class="is-current"' : ''}>
            <th><button class="btn--link" data-goto="${pl.period.from}">${U.fmtDate(pl.period.from, 'short')} – ${U.fmtDate(pl.period.to, 'short')}</button></th>
            <td class="r">${pl.estimated ? '≈ ' : ''}${U.money(pl.incomeTotal, { whole: true })}</td>
            ${ids.map((id) => `<td class="r">${byId[id] ? U.money(byId[id], { whole: true }) : '—'}</td>`).join('')}
            <td class="r ${pl.leftover >= 0 ? 'pos' : 'neg'}">${U.money(pl.leftover, { whole: true })}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  B.pages.plan = {
    title: 'Pay plan', short: 'Plan', icon: '🧮',
    render(main) {
      const cs = C.cycleSettings();
      const key = `${cs.length}|${cs.start}`;
      if (!state.period || state.key !== key) { state.period = C.cyclePeriod(); state.key = key; }
      const p = state.period;
      const plan = C.cyclePlan(p);
      const isNow = p.from <= U.today() && p.to >= U.today();
      const name = cs.info.name;
      const accts = plan.accounts.filter((a) => a.total > 0);
      const movedCount = accts.filter((a) => a.moved).length;

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Pay plan</h1><p>How much to put into each account every ${esc(name)}.</p></div>
          <div class="page-head__actions"><button class="btn btn--ghost" data-act="cycle">⚙ ${esc(cs.info.label.split(' (')[0])} from ${U.fmtDate(cs.start, 'short')}</button></div>
        </div>
        ${!cs.set ? setupCard(cs) : ''}
        <div class="period-nav">
          <button class="icon-btn" data-nav="-1" aria-label="Previous ${esc(name)}">◀</button>
          <div class="period-nav__label" aria-live="polite">${esc(p.label)}${isNow ? ' <span class="badge badge--info">Now</span>' : ''}</div>
          <button class="icon-btn" data-nav="1" aria-label="Next ${esc(name)}">▶</button>
          <button class="btn btn--ghost btn--sm" data-nav="0">This ${esc(name)}</button>
        </div>
        <fieldset class="field" style="margin-bottom:16px"><legend class="field__label">Plan using</legend>
          <div class="segmented" role="radiogroup">
            ${[['due', `Bills due this ${name}`, 'Pay exactly what comes out'], ['even', `Even amounts every ${name}`, 'Same each time, builds a buffer']].map(([v, l, s]) => `
              <label class="segmented__opt"><input type="radio" name="method" value="${v}" data-focus-key="method-${v}" ${plan.method === v ? 'checked' : ''}><span>${esc(l)}<br><small class="muted">${s}</small></span></label>`).join('')}
          </div>
        </fieldset>
        <div class="grid grid--stats" style="margin-bottom:16px">
          ${ui.stat({ label: `Income this ${name}`, value: (plan.estimated ? '≈ ' : '') + U.money(plan.incomeTotal), sub: `${plan.income.length} pay${plan.income.length === 1 ? '' : 's'}` })}
          ${ui.stat({ label: 'To set aside', value: U.money(plan.needed), sub: `bills${cs.goals ? ' & goals' : ''} · ${accts.length} account${accts.length === 1 ? '' : 's'}` })}
          ${ui.stat({ label: 'Left to spend', value: U.money(plan.leftover), sub: plan.leftover >= 0 ? `≈ ${U.money(plan.leftover / ((U.daysBetween(p.from, p.to) + 1) / 7))} a week` : 'more going out than coming in', tone: plan.leftover >= 0 ? 'hero' : 'bad' })}
        </div>
        <section class="card" aria-labelledby="cy-accts" style="margin-bottom:16px">
          <div class="card__head"><h2 id="cy-accts">Put into each account</h2>${accts.length ? `<span class="small muted">${movedCount} of ${accts.length} done</span>` : ''}</div>
          ${accts.length ? `<ul class="plan-list">${accts.map((a) => accountBlock(a, plan, p)).join('')}</ul>`
            : `<p class="muted">Nothing due this ${esc(name)}. ${S.list('bills').length ? '' : 'Add your bills and give each one an account to see a plan here.'}</p>`}
          ${accts.some((a) => !a.accountId) ? '<p class="small muted" style="margin-top:12px">Tip: give bills an account (edit the bill) so they’re grouped where the money actually comes out.</p>' : ''}
          <label class="check small" style="margin-top:8px"><input type="checkbox" id="cy-goals" ${cs.goals ? 'checked' : ''}> <span>Include savings goals that have a target date</span></label>
        </section>
        ${upcomingTable(p.from, cs)}`;

      const form = main.querySelector('#cy-form');
      if (form) form.onsubmit = (e) => {
        e.preventDefault();
        const start = main.querySelector('#cy-start').value;
        if (!U.isISO(start)) return ui.toast('Pick the date a cycle started', { type: 'error' });
        saveCycle({ length: main.querySelector('#cy-length').value, start });
        ui.toast('Saved — every cycle now follows on from this one');
      };
      const lengthSel = main.querySelector('#cy-length');
      if (lengthSel) lengthSel.onchange = () => { main.querySelector('#cy-start').value = C.suggestCycleStart(lengthSel.value); };

      main.onchange = (e) => {
        if (e.target.name === 'method') saveCycle({ method: e.target.value });
        if (e.target.id === 'cy-goals') saveCycle({ goals: e.target.checked });
      };
      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.act === 'cycle') return B.forms.cycle();
        if (d.nav) { state.period = d.nav === '0' ? C.cyclePeriod() : C.shiftPeriod(state.period, Number(d.nav)); return this.render(main); }
        if (d.goto) { state.period = C.cyclePeriod(d.goto); this.render(main); return window.scrollTo({ top: 0 }); }
        if (d.moved) {
          const moved = Object.assign({}, S.data.settings.cycleMoved || {});
          if (moved[d.moved]) delete moved[d.moved]; else moved[d.moved] = true;
          // keep only the last year of ticks
          const cutoff = U.addDays(U.today(), -370);
          Object.keys(moved).forEach((k) => { if (k.slice(0, 10) < cutoff) delete moved[k]; });
          S.updateSettings({ cycleMoved: moved });
        }
      };
    }
  };
})(window.Budget);
