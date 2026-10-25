/* =========================================================
   pages/spending.js — Day-to-day spending and one-off money in
   (things that aren't scheduled bills).
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  const state = { month: null, type: 'expense', q: '', cat: '' };

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
          ${ui.stat({ label: 'Spent', value: U.money(U.sum(out, (t) => t.amount)), sub: `${out.length} entries`, tone: 'hero' })}
          ${ui.stat({ label: 'One-off money in', value: U.money(U.sum(inn, (t) => t.amount)), sub: `${inn.length} entries` })}
          ${ui.stat({ label: 'Average per day', value: U.money(U.sum(out, (t) => t.amount) / (U.daysBetween(p.from, U.min(p.to, U.max(p.from, U.today()))) + 1)) })}
        </div>
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
                    <div class="list__meta">${isIn ? '<span class="badge badge--paid">Money in</span>' : `<span>${esc(c.name)}</span>`}${ui.chip(t.accountId, 'account')}</div></div>
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
      };
    }
  };
})(window.Budget);
