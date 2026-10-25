/* =========================================================
   pages/dashboard.js — Home screen. Made of "widgets" that
   people can show/hide and reorder in Settings → Dashboard.
   To add a widget: add a function to WIDGETS below and its
   id to DEFAULT_WIDGETS in js/data/store.js.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store, R = B.recur;
  const esc = U.esc;

  const PERIOD_TABS = [{ id: 'week', label: 'This week' }, { id: 'fortnight', label: 'This fortnight' }, { id: 'month', label: 'This month' }];

  /* ---------- reusable row for a bill occurrence ---------- */
  function occRow(o, { showDate = true } = {}) {
    const cat = C.category(o.bill.categoryId);
    const auto = o.payment && o.payment.auto;
    return `<li class="list__item">
      <span class="list__icon" style="--c:${esc(cat.color)}" aria-hidden="true">${esc(cat.icon || '•')}</span>
      <div class="list__main">
        <div class="list__title">${esc(o.bill.name)}</div>
        <div class="list__meta">${showDate ? `<span>${U.fmtDate(o.date, 'medium')} · ${U.relDay(o.date)}</span>` : ''}${ui.badge(o.status, o.payment && o.payment.tracked ? 'Done' : auto ? 'Auto-paid' : null)}${ui.chip(o.bill.accountId, 'account')}</div>
        ${o.envelope && o.status === 'tracking' ? `<div class="list__meta"><span>Spent <strong>${U.money(o.envelope.spent)}</strong> of ${U.money(o.envelope.allocated)} · <span class="${o.envelope.remaining >= 0 ? 'pos' : 'neg'}">${o.envelope.remaining >= 0 ? U.money(o.envelope.remaining) + ' left' : U.money(-o.envelope.remaining) + ' over'}</span></span></div>` : ''}
      </div>
      <div class="list__amount">${o.estimated ? '≈ ' : ''}${U.money(o.amount)}</div>
      <div class="list__actions compact-mobile">
        ${o.bill.trackSpending && !(o.payment && !o.payment.tracked && !auto) ? (o.date <= U.today() && o.envelope && !o.envelope.done ? `<button class="btn btn--ghost btn--sm" data-spend="${o.bill.id}" aria-label="Add spending to ${esc(o.bill.name)}">＋ Spend</button>` : '')
        : o.payment && !auto ? `<button class="btn btn--ghost btn--sm" data-paid="${o.bill.id}|${o.date}">Edit</button>`
          : o.payment ? '' : `<button class="btn btn--ghost btn--sm" data-quickpaid="${o.bill.id}|${o.date}" aria-label="Mark ${esc(o.bill.name)} paid">✓ Paid</button>`}
      </div>
    </li>`;
  }
  B.pages._occRow = occRow; // shared with other pages

  /* ---------- widgets ---------- */
  const WIDGETS = {
    summary: { label: 'Money summary', render: (p, sum) => `
      <section aria-labelledby="w-sum" class="stack">
        <h2 id="w-sum" class="sr-only">Summary for ${esc(p.label)}</h2>
        <div class="grid grid--stats">
          ${ui.stat({ label: 'Left over', value: `<span class="num">${U.money(sum.leftover)}</span>`, sub: sum.leftover >= 0 ? 'after bills & spending' : 'more going out than coming in', tone: 'hero' })}
          ${ui.stat({ label: 'Money in', value: (sum.income.some((o) => o.estimated) ? '≈ ' : '') + U.money(sum.incomeTotal), sub: sum.income.some((o) => o.estimated) ? 'includes estimates' : `${sum.income.length + sum.extraIncome.length} payment${sum.income.length + sum.extraIncome.length === 1 ? '' : 's'}` })}
          ${ui.stat({ label: 'Bills', value: U.money(sum.billsTotal), sub: `${sum.paidCount} of ${sum.bills.length} paid` })}
          ${ui.stat({ label: 'Other spending', value: U.money(sum.spendTotal), sub: `${sum.spend.length} entr${sum.spend.length === 1 ? 'y' : 'ies'}` })}
        </div>
      </section>` },

    overdue: { label: 'Overdue bills', render: () => {
      const list = C.overdue();
      if (!list.length) return '';
      return `<section class="card card--danger" aria-labelledby="w-od">
        <div class="card__head"><h2 id="w-od">⚠️ ${list.length} overdue bill${list.length === 1 ? '' : 's'}</h2><span class="num"><strong>${U.money(U.sum(list, (o) => o.amount))}</strong></span></div>
        <ul class="list">${list.slice(0, 6).map((o) => occRow(o)).join('')}</ul>
        ${list.length > 6 ? `<a class="btn btn--ghost btn--sm" href="#/bills?tab=upcoming">See all</a>` : ''}
      </section>`;
    } },

    confirmIncome: { label: 'Pay amounts to enter', render: () => {
      const list = C.incomeToConfirm();
      if (!list.length) return '';
      return `<section class="card card--warn" aria-labelledby="w-ci">
        <div class="card__head"><h2 id="w-ci">💰 How much came in?</h2></div>
        <p class="small" style="margin-top:-4px">${list.length === 1 ? 'This pay is' : 'These pays are'} still using your estimate. Enter the real amount to keep your numbers accurate.</p>
        <ul class="list">${list.slice(0, 5).map((o) => `<li class="list__item">
          <span class="list__icon" style="--c:var(--chart-in)" aria-hidden="true">💰</span>
          <div class="list__main"><div class="list__title">${esc(o.income.name)}</div><div class="list__meta">${U.fmtDate(o.date, 'medium')} · ${U.relDay(o.date)}</div></div>
          <div class="list__amount">≈ ${U.money(o.amount)}</div>
          <div class="list__actions compact-mobile"><button class="btn btn--ghost btn--sm" data-received="${o.income.id}|${o.date}">Enter amount</button></div>
        </li>`).join('')}</ul>
      </section>`;
    } },

    upcoming: { label: 'Coming up', render: () => {
      const days = Number(S.data.settings.upcomingDays) || 14;
      const list = C.billOccurrences(U.today(), U.addDays(U.today(), days)).filter((o) => !o.payment);
      return `<section class="card" aria-labelledby="w-up">
        <div class="card__head"><h2 id="w-up">Coming up · next ${days} days</h2><a href="#/bills?tab=upcoming" class="small">All upcoming</a></div>
        ${list.length ? `<ul class="list">${list.slice(0, 8).map((o) => occRow(o)).join('')}</ul>
          <p class="muted small" style="margin:10px 0 0">Total due: <strong class="num">${U.money(U.sum(list, (o) => o.amount))}</strong></p>`
          : `<p class="muted">Nothing due in the next ${days} days. 🎉</p>`}
      </section>`;
    } },

    setAside: { label: 'Set aside each pay', render: () => {
      const pay = S.data.settings.payFrequency;
      const per = R.PERIODS.find((x) => x.id === pay);
      const sa = C.setAside(pay);
      if (!sa.rows.length) return '';
      const accounts = Object.entries(sa.byAccount).sort((a, b) => b[1] - a[1]);
      return `<section class="card" aria-labelledby="w-sa">
        <div class="card__head"><h2 id="w-sa">Set aside ${esc(per.label)}</h2><a href="#/settings" class="small">Change</a></div>
        <p class="muted small">To cover every bill without surprises, move this much ${esc(per.label)}:</p>
        <dl class="kv">
          ${accounts.map(([id, v]) => `<dt>${ui.dot(C.account(id).color)} Into ${esc(C.account(id).name)}</dt><dd>${U.money(v)}</dd>`).join('')}
          <dt class="total"><strong>Total for bills</strong></dt><dd class="total">${U.money(sa.total)}</dd>
          ${sa.incomePer ? `<dt>Your income ${esc(per.label)}</dt><dd>${U.money(sa.incomePer)}</dd>
            <dt>Free after bills</dt><dd class="${sa.incomePer - sa.total >= 0 ? 'pos' : 'neg'}">${U.money(sa.incomePer - sa.total)}</dd>` : ''}
        </dl>
      </section>`;
    } },

    accounts: { label: 'Bills by account', render: (p, sum) => {
      const rows = Object.entries(sum.byAccount).map(([id, v]) => ({ label: C.account(id).name, value: v, color: C.account(id).color })).sort((a, b) => b.value - a.value);
      return `<section class="card" aria-labelledby="w-acc">
        <div class="card__head"><h2 id="w-acc">Going out by account</h2><span class="muted small">${esc(p.label)}</span></div>
        ${ui.hbars(rows, { emptyText: 'Nothing going out in this period.' })}
      </section>`;
    } },

    categoryBudgets: { label: 'Category limits', render: () => {
      const m = C.period('month');
      const rows = C.categoryProgress(m.from, m.to);
      return `<section class="card" aria-labelledby="w-cb">
        <div class="card__head"><h2 id="w-cb">Category limits · ${esc(m.label)}</h2><a href="#/organise" class="small">Set limits</a></div>
        ${rows.length ? `<ul class="list">${rows.map((r) => `
          <li class="list__item" style="display:block">
            <div class="row row--between"><span><span aria-hidden="true">${esc(r.category.icon || '')}</span> <strong>${esc(r.category.name)}</strong></span>
            <span class="small num">${U.money(r.spent)} of ${U.money(r.budget)}${r.pct > 100 ? ' <span class="badge badge--overdue">Over</span>' : ''}</span></div>
            ${ui.progress(r.pct, { color: r.category.color, label: `${r.category.name}: ${r.pct}% used` })}
          </li>`).join('')}</ul>`
          : `<p class="muted">Give a category a monthly limit to track it here.</p>`}
      </section>`;
    } },

    goals: { label: 'Savings goals', render: () => {
      const goals = S.list('goals');
      return `<section class="card" aria-labelledby="w-g">
        <div class="card__head"><h2 id="w-g">Savings goals</h2><a href="#/goals" class="small">All goals</a></div>
        ${goals.length ? `<ul class="list">${goals.slice(0, 4).map((g) => {
          const plan = C.goalPlan(g);
          return `<li class="list__item" style="display:block">
            <div class="row row--between"><span><span aria-hidden="true">${esc(g.icon || '🎯')}</span> <strong>${esc(g.name)}</strong></span><span class="small num">${U.money(plan.saved, { whole: true })} / ${U.money(plan.target, { whole: true })}</span></div>
            ${ui.progress(plan.pct, { color: g.color, label: `${g.name}: ${plan.pct}%` })}
          </li>`; }).join('')}</ul>`
          : `<p class="muted">No goals yet.</p><button class="btn btn--ghost btn--sm" data-act="goal">＋ Create a goal</button>`}
      </section>`;
    } }
  };
  B.pages._dashboardWidgets = WIDGETS;

  function onboarding() {
    const s = S.data.settings;
    if (!s.showOnboarding) return '';
    const hasInc = S.list('income').length > 0;
    const hasBill = S.list('bills').length > 0;
    const hasAcct = S.list('accounts').length > 0;
    if (hasInc && hasBill) return '';
    return `<section class="card card--tint" aria-labelledby="ob">
      <div class="card__head"><h2 id="ob">Let’s get you set up</h2><button class="btn btn--link small" data-act="hide-ob">Hide</button></div>
      <ol class="steps">
        <li class="${hasAcct ? 'done' : ''}"><span class="grow">Check your accounts & categories</span><a class="btn btn--ghost btn--sm" href="#/organise">Open</a></li>
        <li class="${hasInc ? 'done' : ''}"><span class="grow">Add your pay or income</span><button class="btn btn--ghost btn--sm" data-act="income">Add income</button></li>
        <li class="${hasBill ? 'done' : ''}"><span class="grow">Add your bills</span><button class="btn btn--primary btn--sm" data-act="bill">Add a bill</button></li>
      </ol>
      ${!S.hasSample() ? `<p class="small" style="margin:14px 0 0">Just looking around? <button class="btn btn--link" data-act="sample">Fill it with example data</button> — you can remove it later in Settings.</p>` : ''}
    </section>`;
  }

  B.pages.dashboard = {
    title: 'Home', short: 'Home', icon: '🏠',
    render(main) {
      const s = S.data.settings;
      const p = C.period(s.dashboardPeriod || 'month');
      const sum = C.summary(p.from, p.to);
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

      const visible = s.widgets.filter((w) => w.visible && WIDGETS[w.id]);
      // first widget (usually summary) full width, then a two-column grid
      const html = visible.map((w) => WIDGETS[w.id].render(p, sum)).filter(Boolean);
      const [first, ...rest] = visible[0] && visible[0].id === 'summary' ? html : [null, ...html];

      main.innerHTML = `
        <div class="page-head">
          <div><h1>${greet}, ${esc((S.user.name || '').split(' ')[0])}</h1><p>${U.fmtDate(U.today(), 'long')}</p></div>
          <div class="page-head__actions">
            <button class="btn btn--ghost" data-act="spend">＋ Spending</button>
            <button class="btn btn--primary" data-act="bill">＋ Bill</button>
          </div>
        </div>
        <div class="stack">
          ${onboarding()}
          ${ui.tabs(PERIOD_TABS, p.type, 'period')}
          <p class="muted small" style="margin-top:-8px">${esc(p.label)}</p>
          ${first || ''}
          <div class="grid grid--2">${rest.join('')}</div>
          ${!visible.length ? ui.empty({ icon: '🧩', title: 'Your dashboard is empty', text: 'Turn widgets back on in Settings.', action: '<a class="btn btn--primary" href="#/settings">Open settings</a>' }) : ''}
        </div>`;

      main.onclick = (e) => {
        const t = e.target.closest('[data-period],[data-act],[data-quickpaid],[data-paid],[data-received],[data-spend]');
        if (!t) return;
        if (t.dataset.period) return S.updateSettings({ dashboardPeriod: t.dataset.period });
        if (t.dataset.quickpaid) { const [id, d] = t.dataset.quickpaid.split('|'); return B.forms.quickPaid(id, d); }
        if (t.dataset.spend) return B.forms.transaction(null, { billId: t.dataset.spend });
        if (t.dataset.received) { const [id, d] = t.dataset.received.split('|'); return B.forms.markReceived(id, d); }
        if (t.dataset.paid) { const [id, d] = t.dataset.paid.split('|'); return B.forms.markPaid(id, d); }
        ({
          bill: () => B.forms.bill(), spend: () => B.forms.transaction(), income: () => B.forms.income(), goal: () => B.forms.goal(),
          'hide-ob': () => S.updateSettings({ showOnboarding: false }),
          sample: () => { S.loadSample(); ui.toast('Example data added'); }
        })[t.dataset.act]?.();
      };
    }
  };
})(window.Budget);
