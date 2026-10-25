/* =========================================================
   pages/organise.js — Manage categories (with monthly limits)
   and accounts (where money is paid from / into).
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store, R = B.recur;
  const esc = U.esc;
  const state = { tab: 'categories' };

  const usage = (field, id) => ['bills', 'income', 'transactions'].reduce((n, c) => n + S.list(c).filter((x) => x[field] === id).length, 0);

  function move(col, id, dir) {
    const list = S.list(col);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    S.changed();
  }

  function categories() {
    const m = C.period('month');
    const sum = C.summary(m.from, m.to);
    const list = S.list('categories');
    return `<div class="row row--between" style="margin-bottom:12px"><p class="muted" style="margin:0">Categories group your bills and spending. Give one a monthly limit to track it.</p>
        <button class="btn btn--primary" data-act="addcat">＋ New category</button></div>
      <div class="card card--flush"><ul class="list">${list.map((c, i) => {
        const spent = sum.byCategory[c.id] || 0;
        return `<li class="list__item">
          <span class="list__icon" style="--c:${esc(c.color)}" aria-hidden="true">${esc(c.icon || '•')}</span>
          <div class="list__main">
            <div class="list__title">${esc(c.name)}</div>
            <div class="list__meta"><span>${usage('categoryId', c.id)} items</span><span>This month: ${U.money(spent)}${c.budget ? ` of ${U.money(c.budget)} limit` : ''}</span></div>
            ${c.budget ? ui.progress(U.pct(spent, c.budget), { color: c.color, label: `${c.name} limit used` }) : ''}
          </div>
          <div class="list__actions compact-mobile">
            <button class="icon-btn" data-up="categories|${c.id}" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-down="categories|${c.id}" aria-label="Move ${esc(c.name)} down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn" data-editcat="${c.id}" aria-label="Edit ${esc(c.name)}">✎</button>
          </div>
        </li>`;
      }).join('')}</ul></div>`;
  }

  function accounts() {
    const pay = S.data.settings.payFrequency;
    const per = R.PERIODS.find((p) => p.id === pay);
    const sa = C.setAside(pay);
    const list = S.list('accounts');
    return `<div class="row row--between" style="margin-bottom:12px"><p class="muted" style="margin:0">Accounts show which bank account each bill comes out of, so you know how much to move where.</p>
        <button class="btn btn--primary" data-act="addacc">＋ New account</button></div>
      <div class="card card--flush"><ul class="list">${list.map((a, i) => {
        const bills = S.list('bills').filter((b) => b.accountId === a.id && !b.paused);
        return `<li class="list__item">
          <span class="list__icon" style="--c:${esc(a.color)}" aria-hidden="true">🏦</span>
          <div class="list__main">
            <div class="list__title">${esc(a.name)} <span class="badge badge--muted">${esc(a.type || 'Account')}</span></div>
            <div class="list__meta"><span>${bills.length} bill${bills.length === 1 ? '' : 's'}</span>${a.notes ? `<span>${esc(a.notes)}</span>` : ''}</div>
          </div>
          <div class="list__amount">${U.money(sa.byAccount[a.id] || 0)}<small>needed ${esc(per.label)}</small></div>
          <div class="list__actions compact-mobile">
            <button class="icon-btn" data-up="accounts|${a.id}" aria-label="Move ${esc(a.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-down="accounts|${a.id}" aria-label="Move ${esc(a.name)} down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn" data-editacc="${a.id}" aria-label="Edit ${esc(a.name)}">✎</button>
          </div>
        </li>`;
      }).join('') || '<li class="list__item muted">No accounts yet.</li>'}</ul></div>`;
  }

  B.pages.organise = {
    title: 'Accounts & categories', short: 'Organise', icon: '🗂️',
    render(main) {
      main.innerHTML = `
        <div class="page-head"><div><h1>Accounts & categories</h1><p>Shape the app around how you actually bank and spend.</p></div></div>
        ${ui.tabs([{ id: 'categories', label: `Categories (${S.list('categories').length})` }, { id: 'accounts', label: `Accounts (${S.list('accounts').length})` }], state.tab)}
        ${state.tab === 'accounts' ? accounts() : categories()}`;

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.tab) { state.tab = d.tab; return this.render(main); }
        if (d.act === 'addcat') B.forms.category();
        if (d.act === 'addacc') B.forms.account();
        if (d.editcat) B.forms.category(d.editcat);
        if (d.editacc) B.forms.account(d.editacc);
        if (d.up || d.down) {
          const [col, id] = (d.up || d.down).split('|');
          move(col, id, d.up ? -1 : 1);
          const btn = main.querySelector(`[data-${d.up ? 'up' : 'down'}="${col}|${id}"]`);
          if (btn && !btn.disabled) btn.focus();
        }
      };
    }
  };
})(window.Budget);
