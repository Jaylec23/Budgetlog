/* =========================================================
   pages/bills.js — All bills, what's coming up, and what's
   been paid. Group by category / account / frequency.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store, R = B.recur;
  const esc = U.esc;

  const state = { tab: 'all', q: '', group: 'category', show: 'active', days: 30, histBill: '', histMonths: 3 };

  const GROUPS = {
    category: { label: 'Category', key: (b) => b.categoryId || '', name: (k) => { const c = C.category(k); return `${c.icon || ''} ${c.name}`; } },
    account: { label: 'Account', key: (b) => b.accountId || '', name: (k) => C.account(k).name },
    frequency: { label: 'How often', key: (b) => b.frequency, name: (k) => R.freq(k).label },
    due: { label: 'Next due date', key: () => 'all', name: () => 'All bills' },
    none: { label: 'No grouping', key: () => 'all', name: () => 'All bills' }
  };

  function billRow(b) {
    const cat = C.category(b.categoryId);
    const next = R.next(b, 1)[0];
    const occ = next ? { date: next, payment: S.paymentFor(b.id, next) } : null;
    const status = occ ? C.status(occ.date, occ.payment) : null;
    const pay = S.data.settings.payFrequency;
    const per = R.PERIODS.find((p) => p.id === pay);
    return `<li class="list__item${b.paused ? ' is-paused' : ''}">
      <span class="list__icon" style="--c:${esc(cat.color)}" aria-hidden="true">${esc(cat.icon || '•')}</span>
      <div class="list__main">
        <div class="list__title">${esc(b.name)} ${b.autopay ? '<span class="badge badge--info">Auto</span>' : ''} ${b.paused ? '<span class="badge badge--muted">Paused</span>' : ''}</div>
        <div class="list__meta">
          <span>${esc(R.describe(b))}</span>
          ${ui.chip(b.accountId, 'account')}
        </div>
        <div class="list__meta">${next ? `Next: <strong>${U.fmtDate(next, 'medium')}</strong> (${U.relDay(next)}) ${ui.badge(status)}` : b.paused ? 'Paused' : 'No more due dates'}</div>
      </div>
      <div class="list__amount">${b.amountType === 'variable' ? '≈ ' : ''}${U.money(b.amount)}
        ${b.frequency !== 'once' ? `<small>${U.money(R.amountPer(b, pay))} ${esc(per.label)}</small>` : '<small>one-off</small>'}</div>
      <div class="list__actions">
        ${next && !occ.payment && !b.paused ? `<button class="btn btn--ghost btn--sm" data-quickpaid="${b.id}|${next}" aria-label="Mark next ${esc(b.name)} paid">✓ Paid</button>` : ''}
        <button class="icon-btn" data-edit="${b.id}" aria-label="Edit ${esc(b.name)}" title="Edit">✎</button>
        <button class="icon-btn" data-dup="${b.id}" aria-label="Duplicate ${esc(b.name)}" title="Duplicate">⧉</button>
        <button class="icon-btn" data-pause="${b.id}" aria-label="${b.paused ? 'Resume' : 'Pause'} ${esc(b.name)}" title="${b.paused ? 'Resume' : 'Pause'}">${b.paused ? '▶' : '⏸'}</button>
        <button class="icon-btn" data-del="${b.id}" aria-label="Delete ${esc(b.name)}" title="Delete">🗑</button>
      </div>
    </li>`;
  }

  function allTab() {
    const q = state.q.toLowerCase();
    let bills = S.list('bills').filter((b) =>
      (state.show === 'all' || (state.show === 'active' ? !b.paused : b.paused)) &&
      (!q || [b.name, b.notes, C.category(b.categoryId).name, C.account(b.accountId).name].join(' ').toLowerCase().includes(q)));

    const pay = S.data.settings.payFrequency;
    const per = R.PERIODS.find((p) => p.id === pay);
    const active = S.list('bills').filter((b) => !b.paused && b.frequency !== 'once');
    const totals = `<div class="grid grid--stats" style="margin-bottom:16px">
      ${ui.stat({ label: `Bills ${per.label}`, value: U.money(U.sum(active, (b) => R.amountPer(b, pay))), tone: 'hero' })}
      ${ui.stat({ label: 'Per month', value: U.money(U.sum(active, (b) => R.amountPer(b, 'month'))) })}
      ${ui.stat({ label: 'Per year', value: U.money(U.sum(active, (b) => R.amountPer(b, 'year')), { whole: true }) })}
      ${ui.stat({ label: 'Active bills', value: String(active.length), sub: `${S.list('bills').filter((b) => b.paused).length} paused` })}
    </div>`;

    const toolbar = `<div class="toolbar">
      <label class="sr-only" for="b-q">Search bills</label>
      <input class="search" id="b-q" type="search" placeholder="Search bills…" value="${esc(state.q)}">
      <label class="sr-only" for="b-group">Group by</label>
      <select id="b-group" style="width:auto">${Object.entries(GROUPS).map(([k, g]) => `<option value="${k}" ${state.group === k ? 'selected' : ''}>Group: ${g.label}</option>`).join('')}</select>
      <label class="sr-only" for="b-show">Show</label>
      <select id="b-show" style="width:auto">
        <option value="active" ${state.show === 'active' ? 'selected' : ''}>Active</option>
        <option value="paused" ${state.show === 'paused' ? 'selected' : ''}>Paused</option>
        <option value="all" ${state.show === 'all' ? 'selected' : ''}>All</option>
      </select>
    </div>`;

    if (!S.list('bills').length) {
      return totals + ui.empty({ icon: '🧾', title: 'No bills yet', text: 'Add rent, phone, insurance, subscriptions — anything that comes out regularly. We’ll work out every due date for you.', action: '<button class="btn btn--primary" data-act="add">＋ Add your first bill</button>' });
    }

    const g = GROUPS[state.group];
    const sortFn = state.group === 'due'
      ? (a, b) => (R.next(a, 1)[0] || '9999').localeCompare(R.next(b, 1)[0] || '9999')
      : (a, b) => a.name.localeCompare(b.name);
    const groups = {};
    bills.forEach((b) => { (groups[g.key(b)] = groups[g.key(b)] || []).push(b); });
    const keys = Object.keys(groups).sort((a, b) => g.name(a).localeCompare(g.name(b)));

    return totals + toolbar + `<div class="card card--flush" id="bill-list">
      ${bills.length ? keys.map((k) => {
        const list = groups[k].sort(sortFn);
        const monthTotal = U.sum(list.filter((b) => !b.paused), (b) => R.amountPer(b, 'month'));
        return `${keys.length > 1 || state.group !== 'none' && state.group !== 'due' ? `<div class="group-head"><span>${esc(g.name(k))} <span class="muted">(${list.length})</span></span><span class="num">${U.money(monthTotal)}/mo</span></div>` : ''}
          <ul class="list">${list.map(billRow).join('')}</ul>`;
      }).join('') : `<p class="muted" style="padding:18px">No bills match.</p>`}
    </div>`;
  }

  function upcomingTab() {
    const from = U.addDays(U.today(), -60);
    const to = U.addDays(U.today(), state.days);
    const list = C.billOccurrences(from, to).filter((o) => o.date >= U.today() || !o.payment);
    const total = U.sum(list.filter((o) => !o.payment), (o) => o.amount);
    // group by week
    const ws = Number(S.data.settings.weekStart);
    const weeks = {};
    list.forEach((o) => { const k = o.date < U.today() ? 'overdue' : U.startOfWeek(o.date, ws); (weeks[k] = weeks[k] || []).push(o); });
    const keys = Object.keys(weeks).sort((a, b) => (a === 'overdue' ? -1 : b === 'overdue' ? 1 : a.localeCompare(b)));
    return `<div class="toolbar">
        <label for="u-days" class="muted">Show the next</label>
        <select id="u-days" style="width:auto">${[7, 14, 30, 60, 90, 180].map((d) => `<option value="${d}" ${state.days === d ? 'selected' : ''}>${d} days</option>`).join('')}</select>
        <span class="grow"></span><span>Still to pay: <strong class="num">${U.money(total)}</strong></span>
      </div>
      <div class="card card--flush">
        ${keys.length ? keys.map((k) => `<div class="group-head"><span>${k === 'overdue' ? '⚠️ Overdue' : 'Week of ' + U.fmtDate(k, 'medium')}</span><span class="num">${U.money(U.sum(weeks[k], (o) => o.amount))}</span></div>
          <ul class="list">${weeks[k].map((o) => B.pages._occRow(o)).join('')}</ul>`).join('')
          : `<p class="muted" style="padding:18px">Nothing due.</p>`}
      </div>`;
  }

  function historyTab() {
    const from = U.addMonths(U.today(), -state.histMonths);
    const pays = S.data.payments
      .filter((p) => p.dueDate >= from && (!state.histBill || p.billId === state.histBill))
      .map((p) => ({ p, b: S.get('bills', p.billId) })).filter((x) => x.b)
      .sort((a, b) => b.p.dueDate.localeCompare(a.p.dueDate));
    return `<div class="toolbar">
        <label class="sr-only" for="h-bill">Bill</label>
        <select id="h-bill" style="width:auto"><option value="">All bills</option>${S.list('bills').map((b) => `<option value="${b.id}" ${state.histBill === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
        <label class="sr-only" for="h-m">Period</label>
        <select id="h-m" style="width:auto">${[1, 3, 6, 12, 24].map((m) => `<option value="${m}" ${state.histMonths === m ? 'selected' : ''}>Last ${m} month${m > 1 ? 's' : ''}</option>`).join('')}</select>
        <span class="grow"></span><span>Total paid: <strong class="num">${U.money(U.sum(pays, (x) => x.p.amount))}</strong></span>
      </div>
      <p class="muted small">Auto-pay bills count as paid on their due date and only appear here if you edit the amount.</p>
      ${pays.length ? `<div class="card card--flush table-wrap"><table class="table">
        <thead><tr><th>Bill</th><th>Due</th><th>Paid</th><th class="r">Amount</th><th class="r">vs usual</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${pays.map(({ p, b }) => {
          const diff = p.amount - b.amount;
          return `<tr><td><strong>${esc(b.name)}</strong>${p.note ? `<br><span class="muted small">${esc(p.note)}</span>` : ''}</td>
            <td>${U.fmtDate(p.dueDate, 'full')}</td>
            <td>${U.fmtDate(p.paidOn, 'full')} ${p.paidOn > p.dueDate ? '<span class="badge badge--due-soon">Late</span>' : ''}</td>
            <td class="r">${U.money(p.amount)}</td>
            <td class="r ${diff > 0.009 ? 'neg' : diff < -0.009 ? 'pos' : 'muted'}">${Math.abs(diff) < 0.01 ? '—' : (diff > 0 ? '+' : '−') + U.money(Math.abs(diff))}</td>
            <td><button class="btn btn--ghost btn--sm" data-paid="${b.id}|${p.dueDate}">Edit</button></td></tr>`;
        }).join('')}</tbody></table></div>`
        : ui.empty({ icon: '🧾', title: 'No payments recorded', text: 'When you tick a bill as paid it shows up here, so you can see how much variable bills like power have changed.' })}`;
  }

  B.pages.bills = {
    title: 'Bills', icon: '🧾',
    render(main, params) {
      if (params.tab) state.tab = params.tab;
      main.innerHTML = `
        <div class="page-head">
          <div><h1>Bills & regular expenses</h1><p>Everything that comes out on a schedule.</p></div>
          <div class="page-head__actions"><button class="btn btn--primary" data-act="add">＋ Add bill</button></div>
        </div>
        ${ui.tabs([{ id: 'all', label: 'All bills' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'history', label: 'Paid history' }], state.tab)}
        <div id="bills-body">${state.tab === 'upcoming' ? upcomingTab() : state.tab === 'history' ? historyTab() : allTab()}</div>`;

      const rerender = () => this.render(main, {});
      const q = main.querySelector('#b-q');
      if (q) q.oninput = U.debounce(() => { state.q = q.value; rerender(); main.querySelector('#b-q').focus(); const el = main.querySelector('#b-q'); el.setSelectionRange(el.value.length, el.value.length); }, 200);
      const bind = (id, key, num) => { const el = main.querySelector(id); if (el) el.onchange = () => { state[key] = num ? Number(el.value) : el.value; rerender(); main.querySelector(id).focus(); }; };
      bind('#b-group', 'group'); bind('#b-show', 'show'); bind('#u-days', 'days', true); bind('#h-bill', 'histBill'); bind('#h-m', 'histMonths', true);

      main.onclick = (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        const d = t.dataset;
        if (d.tab) { state.tab = d.tab; return rerender(); }
        if (d.act === 'add') return B.forms.bill();
        if (d.edit) return B.forms.bill(d.edit);
        if (d.dup) { const c = S.duplicate('bills', d.dup); ui.toast('Copy made — edit it to change the details'); return B.forms.bill(c.id); }
        if (d.pause) { const b = S.get('bills', d.pause); S.upsert('bills', { id: b.id, paused: !b.paused }); return ui.toast(b.paused ? `${b.name} resumed` : `${b.name} paused — it won’t count in totals`); }
        if (d.del) return B.forms.deleteBill(d.del);
        if (d.quickpaid) { const [id, dt] = d.quickpaid.split('|'); return B.forms.quickPaid(id, dt); }
        if (d.paid) { const [id, dt] = d.paid.split('|'); return B.forms.markPaid(id, dt); }
      };
    }
  };
})(window.Budget);
