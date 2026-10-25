/* =========================================================
   forms.js — Add/edit forms for every kind of item.
   Any page can call e.g. Budget.forms.bill(id) or
   Budget.forms.markPaid(billId, date). Change a form here and
   it changes everywhere.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = B.utils, R = B.recur, ui = B.ui, S = B.store;
  const esc = U.esc;
  const F = {};

  /* ---------- shared bits ---------- */
  const frequencyFields = (isIncome) => [
    { name: 'frequency', label: isIncome ? 'How often are you paid?' : 'How often is it due?', type: 'select', required: true,
      options: R.FREQUENCIES.map((f) => ({ value: f.id, label: f.label })) },
    { type: 'row', name: 'customRow', when: (v) => v.frequency === 'custom', fields: [
      { name: 'customEvery', label: 'Every', type: 'number', min: 1, default: 1, required: true },
      { name: 'customUnit', label: 'Unit', type: 'select', options: R.CUSTOM_UNITS.map((u) => ({ value: u.id, label: u.label })) }
    ] },
    { name: 'startDate', label: isIncome ? 'First (or next) pay date' : 'First (or next) due date', type: 'date', required: true,
      help: 'Pick any date this happened or will happen — every future date is worked out from it.' },
    { name: 'hasEnd', label: isIncome ? 'This income stops on a set date' : 'This stops on a set date (e.g. a loan or contract)', type: 'checkbox',
      when: (v) => v.frequency !== 'once' },
    { name: 'endDate', label: 'Last date', type: 'date', when: (v) => v.hasEnd && v.frequency !== 'once',
      validate: (val, v) => (val && v.startDate && val < v.startDate ? 'Last date can’t be before the first date.' : '') },
    { name: 'preview', type: 'preview', compute: (v) => schedulePreview(v, isIncome) }
  ];

  function schedulePreview(v, isIncome) {
    if (!U.isISO(v.startDate) || !v.frequency) return '<p class="muted">Choose a frequency and date to see the schedule.</p>';
    const item = Object.assign({}, v, { endDate: v.hasEnd ? v.endDate : '' });
    const next = R.next(item, 4, U.today());
    const last = R.previous(item);
    const amt = Number(v.amount) || 0;
    const pay = S.data.settings.payFrequency;
    const perLabel = (R.PERIODS.find((p) => p.id === pay) || {}).label;
    return `
      <div class="preview__title">${esc(R.describe(item))}</div>
      ${next.length ? `<p class="muted small">Next ${isIncome ? 'pay days' : 'due dates'}:</p>
      <ul class="preview__dates">${next.map((d) => `<li><strong>${U.fmtDate(d, 'medium')}</strong> <span class="muted">${U.relDay(d)}</span></li>`).join('')}</ul>`
        : `<p class="muted">No upcoming dates${last ? ` — the last one was ${U.fmtDate(last, 'full')}` : ''}.</p>`}
      ${amt && v.frequency !== 'once' ? `<p class="preview__per">That’s about <strong>${U.money(R.amountPer(item, pay))}</strong> ${perLabel}, or <strong>${U.money(R.amountPer(item, 'year'))}</strong> a year.</p>` : ''}`;
  }

  const clean = (v) => {
    if (!v.hasEnd || v.frequency === 'once') v.endDate = '';
    if (v.frequency !== 'custom') { delete v.customEvery; delete v.customUnit; }
    delete v.preview;
    return v;
  };

  async function confirmDelete(name, what) {
    return ui.confirm({ title: `Delete ${what}?`, message: `“${name}” will be removed. You can undo straight after.`, confirmLabel: 'Delete', danger: true });
  }

  /* ---------- Bill / expense ---------- */
  F.bill = (id, preset = {}) => {
    const bill = id ? S.get('bills', id) : null;
    const values = bill ? Object.assign({ hasEnd: !!bill.endDate }, bill)
      : Object.assign({ frequency: 'monthly', amountType: 'fixed', startDate: U.today(), categoryId: '', accountId: '' }, preset);
    ui.form({
      title: bill ? 'Edit bill' : 'Add a bill or regular expense',
      intro: bill ? '' : 'Bills are anything that comes out on a schedule — rent, phone, insurance, subscriptions, even groceries.',
      values,
      submitLabel: bill ? 'Save changes' : 'Add bill',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Electricity' },
        { type: 'row', name: 'amtRow', fields: [
          { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0 },
          { name: 'amountType', label: 'Amount is…', type: 'segmented', options: [{ value: 'fixed', label: 'The same each time' }, { value: 'variable', label: 'An estimate' }] }
        ] },
        ...frequencyFields(false),
        { type: 'row', name: 'groupRow', fields: [
          { name: 'categoryId', label: 'Category', type: 'select', placeholder: 'No category', options: ui.categoryOptions },
          { name: 'accountId', label: 'Paid from account', type: 'select', placeholder: 'No account', options: ui.accountOptions }
        ] },
        { name: 'autopay', label: 'Paid automatically (direct debit) — mark it paid for me on the due date', type: 'checkbox' },
        { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Account number, reference, reminders…' }
      ],
      extra: bill ? { label: 'Delete', danger: true, onClick: () => F.deleteBill(bill.id) } : null,
      onSubmit: (v) => {
        clean(v);
        const saved = S.upsert('bills', Object.assign(bill ? { id: bill.id } : {}, v));
        ui.toast(bill ? 'Bill updated' : `${saved.name} added`);
      }
    });
  };

  F.deleteBill = async (id) => {
    const b = S.get('bills', id);
    if (!b || !(await confirmDelete(b.name, 'bill'))) return;
    ui.undoToast(`${b.name} deleted`, S.remove('bills', id));
  };

  /* ---------- Mark a bill occurrence paid ---------- */
  F.markPaid = (billId, dueDate) => {
    const b = S.get('bills', billId);
    if (!b) return;
    const existing = S.paymentFor(billId, dueDate);
    ui.form({
      title: existing ? 'Edit payment' : `Mark ${b.name} as paid`,
      intro: `Due ${U.fmtDate(dueDate, 'long')}.${b.amountType === 'variable' && !existing ? ' This bill changes each time, so enter what you actually paid.' : ''}`,
      size: 'sm',
      values: existing || { amount: b.amount, paidOn: U.today() < dueDate ? U.today() : U.today() },
      submitLabel: existing ? 'Save' : 'Mark paid',
      fields: [
        { name: 'amount', label: 'Amount paid', type: 'money', required: true, min: 0 },
        { name: 'paidOn', label: 'Date paid', type: 'date', required: true },
        { name: 'note', label: 'Note', placeholder: 'Receipt number, anything else…' }
      ],
      extra: existing ? { label: 'Mark as unpaid', onClick: () => { const undo = S.unmarkPaid(billId, dueDate); ui.undoToast('Marked as unpaid', undo); } } : null,
      onSubmit: (v) => { S.markPaid(billId, dueDate, v.amount, v.paidOn, v.note); ui.toast(`${b.name} marked paid`); }
    });
  };

  /** One-tap paid (uses expected amount). Variable bills open the form instead. */
  F.quickPaid = (billId, dueDate) => {
    const b = S.get('bills', billId);
    if (!b) return;
    if (b.amountType === 'variable') return F.markPaid(billId, dueDate);
    S.markPaid(billId, dueDate, b.amount, U.today());
    ui.undoToast(`${b.name} marked paid`, () => S.unmarkPaid(billId, dueDate));
  };

  /* ---------- Income ---------- */
  F.income = (id) => {
    const inc = id ? S.get('income', id) : null;
    const values = inc ? Object.assign({ hasEnd: !!inc.endDate, amountType: 'fixed' }, inc) : { frequency: 'fortnightly', amountType: 'fixed', startDate: U.today() };
    ui.form({
      title: inc ? 'Edit income' : 'Add income',
      intro: inc ? '' : 'Add each regular pay or payment you receive. Use “Spending → Add money in” for one-off amounts.',
      values,
      submitLabel: inc ? 'Save changes' : 'Add income',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Wages, Centrelink, Side job' },
        { type: 'row', name: 'incAmtRow', fields: [
          { name: 'amount', label: 'Amount you receive (after tax)', type: 'money', required: true, min: 0 },
          { name: 'amountType', label: 'Amount is…', type: 'segmented', options: [{ value: 'fixed', label: 'The same each time' }, { value: 'variable', label: 'An estimate' }] }
        ] },
        { name: 'varNote', type: 'note', when: (v) => v.amountType === 'variable',
          html: '<p class="field__help" style="margin-top:-6px">Use your usual or average amount. We’ll plan with it, then ask what actually came in on each pay day.</p>' },
        ...frequencyFields(true),
        { name: 'accountId', label: 'Paid into account', type: 'select', placeholder: 'No account', options: ui.accountOptions },
        { name: 'notes', label: 'Notes', type: 'textarea' }
      ],
      extra: inc ? { label: 'Delete', danger: true, onClick: async () => {
        if (await confirmDelete(inc.name, 'income')) ui.undoToast(`${inc.name} deleted`, S.remove('income', inc.id));
      } } : null,
      onSubmit: (v) => { clean(v); delete v.varNote; S.upsert('income', Object.assign(inc ? { id: inc.id } : {}, v)); ui.toast(inc ? 'Income updated' : 'Income added'); }
    });
  };

  /** Record (or correct) how much actually came in on a pay day. */
  F.markReceived = (incomeId, date) => {
    const inc = S.get('income', incomeId);
    if (!inc) return;
    const existing = S.receiptFor(incomeId, date);
    ui.form({
      title: existing ? 'Edit amount received' : `How much was ${inc.name}?`,
      intro: `Pay day ${U.fmtDate(date, 'long')}. Your estimate was ${U.money(inc.amount)}.`,
      size: 'sm',
      values: existing || { amount: inc.amount },
      submitLabel: 'Save',
      fields: [
        { name: 'amount', label: 'Amount received', type: 'money', required: true, min: 0 },
        { name: 'note', label: 'Note', placeholder: 'e.g. extra shift, overtime' }
      ],
      extra: existing ? { label: 'Go back to estimate', onClick: () => ui.undoToast('Back to the estimate', S.unmarkReceived(incomeId, date)) } : null,
      onSubmit: (v) => { S.markReceived(incomeId, date, v.amount, v.note); ui.toast(`${inc.name}: ${U.money(v.amount)} saved`); }
    });
  };

  /* ---------- Spending / one-off transaction ---------- */
  F.transaction = (id, preset = {}) => {
    const t = id ? S.get('transactions', id) : null;
    const values = t || Object.assign({ type: 'expense', date: U.today() }, preset);
    ui.form({
      title: t ? 'Edit entry' : (values.type === 'income' ? 'Add money in' : 'Add spending'),
      size: 'sm',
      values,
      submitLabel: t ? 'Save' : 'Add',
      fields: [
        { name: 'type', label: 'Type', type: 'segmented', options: [{ value: 'expense', label: 'Money out' }, { value: 'income', label: 'Money in' }] },
        { name: 'description', label: 'What was it?', required: true, placeholder: 'e.g. Groceries at the market' },
        { type: 'row', name: 'r1', fields: [
          { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0 },
          { name: 'date', label: 'Date', type: 'date', required: true }
        ] },
        { name: 'categoryId', label: 'Category', type: 'select', placeholder: 'No category', options: ui.categoryOptions, when: (v) => v.type !== 'income' },
        { name: 'accountId', label: 'Account', type: 'select', placeholder: 'No account', options: ui.accountOptions },
        { name: 'notes', label: 'Notes', type: 'textarea' }
      ],
      extra: t ? { label: 'Delete', danger: true, onClick: () => ui.undoToast('Entry deleted', S.remove('transactions', t.id)) } : null,
      onSubmit: (v) => { if (v.type === 'income') v.categoryId = ''; S.upsert('transactions', Object.assign(t ? { id: t.id } : {}, v)); ui.toast(t ? 'Saved' : 'Added'); }
    });
  };

  /* ---------- Goals ---------- */
  F.goal = (id) => {
    const g = id ? S.get('goals', id) : null;
    ui.form({
      title: g ? 'Edit goal' : 'New savings goal',
      values: g || { icon: '🎯', color: S.PALETTE[3], startAmount: 0 },
      submitLabel: g ? 'Save' : 'Create goal',
      fields: [
        { type: 'row', name: 'r0', fields: [
          { name: 'icon', label: 'Emoji', type: 'icon' },
          { name: 'name', label: 'Goal name', required: true, placeholder: 'e.g. New car, Christmas, Emergency fund' }
        ] },
        { type: 'row', name: 'r1', fields: [
          { name: 'target', label: 'Target amount', type: 'money', required: true, min: 1 },
          { name: 'startAmount', label: 'Already saved', type: 'money', min: 0 }
        ] },
        { name: 'targetDate', label: 'Reach it by', type: 'date', help: 'Optional — we’ll tell you how much to put away each week, fortnight or month.' },
        { name: 'accountId', label: 'Saving into account', type: 'select', placeholder: 'No account', options: ui.accountOptions },
        { name: 'color', label: 'Colour', type: 'color' },
        { name: 'notes', label: 'Notes', type: 'textarea' }
      ],
      extra: g ? { label: 'Delete', danger: true, onClick: async () => {
        if (await confirmDelete(g.name, 'goal')) ui.undoToast(`${g.name} deleted`, S.remove('goals', g.id));
      } } : null,
      onSubmit: (v) => { S.upsert('goals', Object.assign(g ? { id: g.id } : { contributions: [] }, v)); ui.toast(g ? 'Goal updated' : 'Goal created'); }
    });
  };

  F.contribute = (goalId) => {
    const g = S.get('goals', goalId);
    if (!g) return;
    ui.form({
      title: `Update “${g.name}”`, size: 'sm', values: { dir: 'add', date: U.today() }, submitLabel: 'Save',
      fields: [
        { name: 'dir', label: 'I want to…', type: 'segmented', options: [{ value: 'add', label: 'Add money' }, { value: 'take', label: 'Take money out' }] },
        { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0.01 },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'note', label: 'Note' }
      ],
      onSubmit: (v) => {
        S.addContribution(goalId, v.dir === 'take' ? -v.amount : v.amount, v.date, v.note);
        const plan = B.calc.goalPlan(S.get('goals', goalId));
        ui.toast(plan.remaining <= 0 ? `🎉 You reached ${g.name}!` : `${U.money(plan.saved)} saved so far`);
      }
    });
  };

  /* ---------- Categories & accounts ---------- */
  F.category = (id) => {
    const c = id ? S.get('categories', id) : null;
    ui.form({
      title: c ? 'Edit category' : 'New category', size: 'sm',
      values: c || { icon: '🏷️', color: S.PALETTE[S.list('categories').length % S.PALETTE.length], budget: '' },
      fields: [
        { type: 'row', name: 'r0', fields: [
          { name: 'icon', label: 'Emoji', type: 'icon' },
          { name: 'name', label: 'Name', required: true }
        ] },
        { name: 'budget', label: 'Monthly spending limit', type: 'money', min: 0, help: 'Optional. Shows a progress bar so you can see when you’re getting close.' },
        { name: 'color', label: 'Colour', type: 'color' }
      ],
      extra: c ? { label: 'Delete', danger: true, onClick: () => F.deleteGroup('categories', c) } : null,
      onSubmit: (v) => { v.budget = Number(v.budget) || 0; S.upsert('categories', Object.assign(c ? { id: c.id } : {}, v)); ui.toast('Category saved'); }
    });
  };

  F.account = (id) => {
    const a = id ? S.get('accounts', id) : null;
    ui.form({
      title: a ? 'Edit account' : 'New account', size: 'sm',
      intro: 'Accounts are where money comes from or goes to — they help you see how much to move into each one.',
      values: a || { type: 'Transaction', color: S.PALETTE[(S.list('accounts').length + 1) % S.PALETTE.length] },
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. CommBank Everyday' },
        { name: 'type', label: 'Type', type: 'select', options: ['Transaction', 'Savings', 'Credit card', 'Offset', 'Cash', 'Other'].map((x) => ({ value: x, label: x })) },
        { name: 'color', label: 'Colour', type: 'color' },
        { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Don’t store full account numbers here.' }
      ],
      extra: a ? { label: 'Delete', danger: true, onClick: () => F.deleteGroup('accounts', a) } : null,
      onSubmit: (v) => { S.upsert('accounts', Object.assign(a ? { id: a.id } : {}, v)); ui.toast('Account saved'); }
    });
  };

  F.deleteGroup = async (col, item) => {
    const field = col === 'accounts' ? 'accountId' : 'categoryId';
    const used = ['bills', 'income', 'transactions', 'goals'].reduce((n, c) => n + S.list(c).filter((x) => x[field] === item.id).length, 0);
    const ok = await ui.confirm({
      title: `Delete ${item.name}?`,
      message: used ? `${used} item${used === 1 ? ' uses' : 's use'} this. They’ll be kept but left without a ${col === 'accounts' ? 'account' : 'category'}.` : 'Nothing uses this yet.',
      confirmLabel: 'Delete', danger: true
    });
    if (ok) ui.undoToast(`${item.name} deleted`, S.removeGroup(col, item.id));
  };

  B.forms = F;
})(window.Budget);
