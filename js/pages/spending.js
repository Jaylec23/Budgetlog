/* =========================================================
   pages/spending.js — Day-to-day spending and one-off money in
   (things that aren't scheduled bills).
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  const state = { month: null, type: 'expense', q: '', cat: '' };

  /* ---------- Bill allowances: spending vs what's set aside ---------- */
  function allowances() {
    const tracked = S.list('bills').filter((b) => b.trackSpending && !b.paused);
    const variable = S.list('bills').filter((b) => !b.trackSpending && !b.paused && b.amountType === 'variable');
    if (!tracked.length) {
      return `<section class="card card--tint" aria-labelledby="al-title" style="margin-bottom:16px">
        <div class="card__head"><h2 id="al-title">Bill allowances</h2></div>
        <p class="small" style="margin:0">Spend on groceries, fuel or other bills that change? When adding spending, pick the bill under <strong>“Counts towards a bill”</strong> and you’ll see what you’ve spent against what you set aside${variable.length ? ` — for example ${variable.slice(0, 2).map((b) => esc(b.name)).join(' or ')}` : ''}.</p>
      </section>`;
    }
    const envs = tracked.map((b) => C.currentEnvelope(b)).filter(Boolean);
    const byAcc = {};
    envs.forEach((e) => {
      const k = e.bill.accountId || '';
      byAcc[k] = byAcc[k] || { allocated: 0, spent: 0, envs: [] };
      byAcc[k].allocated += e.allocated; byAcc[k].spent += e.spent; byAcc[k].envs.push(e);
    });
    const accKeys = Object.keys(byAcc).sort((a, b) => C.account(a).name.localeCompare(C.account(b).name));
    const totalA = U.sum(envs, (e) => e.allocated), totalS = U.sum(envs, (e) => e.spent);
    return `<section class="card card--flush" aria-labelledby="al-title" style="margin-bottom:16px">
      <div class="card__head"><h2 id="al-title">Bill allowances · right now</h2>
        <span class="small">Spent <strong class="num">${U.money(totalS)}</strong> of <span class="num">${U.money(totalA)}</span></span></div>
      ${accKeys.map((k) => {
        const g = byAcc[k], left = g.allocated - g.spent;
        return `<div class="group-head"><span>${ui.dot(C.account(k).color)} ${esc(C.account(k).name)}</span>
          <span class="num ${left >= 0 ? '' : 'neg'}">${U.money(g.spent)} of ${U.money(g.allocated)} allocated</span></div>
          <ul class="list">${g.envs.map((e) => {
            const cat = C.category(e.bill.categoryId);
            return `<li class="list__item">
              <span class="list__icon" style="--c:${esc(cat.color)}" aria-hidden="true">${esc(cat.icon || '•')}</span>
              <div class="list__main">
                <div class="list__title">${esc(e.bill.name)}</div>
                <div class="list__meta"><span>${U.fmtDate(e.start, 'short')} – ${U.fmtDate(e.end, 'short')} · ${U.daysBetween(U.today(), e.end) + 1} day${U.daysBetween(U.today(), e.end) ? 's' : ''} left</span><span>${e.entries.length} entr${e.entries.length === 1 ? 'y' : 'ies'}</span></div>
                <div class="envelope__nums"><span>Spent ${U.money(e.spent)} of ${U.money(e.allocated)}</span>
                  <span class="envelope__left ${e.remaining >= 0 ? 'pos' : 'neg'}">${e.remaining >= 0 ? U.money(e.remaining) + ' left' : U.money(-e.remaining) + ' over'}</span></div>
                ${ui.progress(e.pct, { color: cat.color, label: `${e.bill.name}: ${e.pct}% spent` })}
              </div>
              <div class="list__actions compact-mobile"><button class="btn btn--ghost btn--sm" data-spend="${e.bill.id}">＋ Spend</button></div>
            </li>`;
          }).join('')}</ul>`;
      }).join('')}
    </section>`;
  }

  B.pages.spending = {
    title: 'Spending', icon: '🛒',
    render(main) {
      if (!state.month) state.month = C.period('month');
      const p = state.month;
      const q = state.q.toLowerCase();
      const all = C.transactionsIn(p.from, p.to);
      const list = all.filter((t) => (state.type === 'all' || (t.type || 'expense') === state.type) &&
        (!state.cat || t.categoryId === state.cat) &&
        (!q || [t.description, t.notes].join(' ').toLowerCase().includes(q)));
      const out = all.filter((t) => (t.type || 'expense') === 'expense');
      const inn = all.filter((t) => t.type === 'income');

      const byCat = {};
      out.forEach((t) => (byCat[t.categoryId || ''] = (byCat[t.categoryId || ''] || 0) + Number(t.amount)));
      const catRows = Object.entries(byCat).map(([id, v]) => { const c = C.category(id); return { label: c.name, icon: c.icon, color: c.color, value: v }; }).sort((a, b) => b.value - a.value);

      const days = {};
      list.forEach((t) => (days[t.date] = days[t.date] || []).push(t));

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Spending</h1><p>Everyday purchases and one-off money in — anything that isn’t a scheduled bill.</p></div>
          <div class="page-head__actions">
            <button class="btn btn--ghost" data-act="in">＋ Money in</button>
            <button class="btn btn--primary" data-act="out">＋ Add spending</button>
          </div>
        </div>
        <div class="period-nav">
          <button class="icon-btn" data-nav="-1" aria-label="Previous month">◀</button>
          <div class="period-nav__label" aria-live="polite">${esc(p.label)}</div>
          <button class="icon-btn" data-nav="1" aria-label="Next month">▶</button>
          <button class="btn btn--ghost btn--sm" data-nav="0">This month</button>
        </div>
        <div class="grid grid--stats" style="margin-bottom:16px">
          ${ui.stat({ label: 'Spent', value: U.money(U.sum(out, (t) => t.amount)), sub: out.some((t) => t.billId) ? `incl. ${U.money(U.sum(out.filter((t) => C.countedInBill(t)), (t) => t.amount))} towards bills` : `${out.length} entries`, tone: 'hero' })}
          ${ui.stat({ label: 'One-off money in', value: U.money(U.sum(inn, (t) => t.amount)), sub: `${inn.length} entries` })}
          ${ui.stat({ label: 'Average per day', value: U.money(U.sum(out, (t) => t.amount) / (U.daysBetween(p.from, U.min(p.to, U.max(p.from, U.today()))) + 1)) })}
        </div>
        ${allowances()}
        <div class="grid grid--2">
          <section class="card card--flush" aria-labelledby="sp-list">
            <div class="card__head"><h2 id="sp-list">Entries</h2></div>
            <div class="toolbar" style="padding:0 18px">
              <label class="sr-only" for="s-q">Search</label>
              <input class="search" id="s-q" type="search" placeholder="Search…" value="${esc(state.q)}">
              <label class="sr-only" for="s-type">Type</label>
              <select id="s-type" style="width:auto">
                <option value="expense" ${state.type === 'expense' ? 'selected' : ''}>Money out</option>
                <option value="income" ${state.type === 'income' ? 'selected' : ''}>Money in</option>
                <option value="all" ${state.type === 'all' ? 'selected' : ''}>Both</option>
              </select>
              <label class="sr-only" for="s-cat">Category</label>
              <select id="s-cat" style="width:auto"><option value="">All categories</option>${ui.categoryOptions().map((o) => `<option value="${o.value}" ${state.cat === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
            </div>
            ${list.length ? Object.keys(days).sort().reverse().map((d) => `
              <div class="group-head"><span>${U.fmtDate(d, 'medium')}</span><span class="num">${U.money(U.sum(days[d], (t) => (t.type === 'income' ? -1 : 1) * t.amount))}</span></div>
              <ul class="list">${days[d].map((t) => {
                const c = C.category(t.categoryId);
                const isIn = t.type === 'income';
                return `<li class="list__item">
                  <span class="list__icon" style="--c:${isIn ? 'var(--chart-in)' : esc(c.color)}" aria-hidden="true">${isIn ? '➕' : esc(c.icon || '•')}</span>
                  <div class="list__main"><div class="list__title">${esc(t.description)}</div>
                    <div class="list__meta">${isIn ? '<span class="badge badge--paid">Money in</span>' : `<span>${esc(c.name)}</span>`}${t.billId && S.get('bills', t.billId) ? `<span class="badge badge--link">→ ${esc(S.get('bills', t.billId).name)}</span>` : ''}${ui.chip(t.accountId, 'account')}</div></div>
                  <div class="list__amount ${isIn ? 'pos' : ''}">${isIn ? '+' : ''}${U.money(t.amount)}</div>
                  <div class="list__actions compact-mobile"><button class="icon-btn" data-edit="${t.id}" aria-label="Edit ${esc(t.description)}">✎</button></div>
                </li>`;
              }).join('')}</ul>`).join('')
              : `<div style="padding:0 18px 18px">${ui.empty({ icon: '🛒', title: 'Nothing here yet', text: 'Add groceries, fuel, takeaway — anything you spend that isn’t a bill.' })}</div>`}
          </section>
          <section class="card" aria-labelledby="sp-cat">
            <div class="card__head"><h2 id="sp-cat">By category</h2></div>
            ${ui.hbars(catRows, { emptyText: 'No spending this month.' })}
          </section>
        </div>`;

      const rerender = () => this.render(main);
      const sq = main.querySelector('#s-q');
      sq.oninput = U.debounce(() => { state.q = sq.value; rerender(); const el = main.querySelector('#s-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 200);
      main.querySelector('#s-type').onchange = (e) => { state.type = e.target.value; rerender(); main.querySelector('#s-type').focus(); };
      main.querySelector('#s-cat').onchange = (e) => { state.cat = e.target.value; rerender(); main.querySelector('#s-cat').focus(); };

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.nav) { state.month = d.nav === '0' ? C.period('month') : C.shiftPeriod(state.month, Number(d.nav)); return rerender(); }
        if (d.act === 'out') B.forms.transaction(null, { date: U.today() >= p.from && U.today() <= p.to ? U.today() : p.from });
        if (d.act === 'in') B.forms.transaction(null, { type: 'income' });
        if (d.edit) B.forms.transaction(d.edit);
        if (d.spend) B.forms.transaction(null, { billId: d.spend });
      };
    }
  };
})(window.Budget);
