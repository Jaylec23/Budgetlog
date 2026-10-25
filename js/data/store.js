/* =========================================================
   store.js — The signed-in person's budget data in memory.
   ---------------------------------------------------------
   Collections: accounts, categories, bills, income, payments,
                transactions, goals.  Plus: settings.
   Every change goes through here so it's saved automatically
   and the screen refreshes (listeners on 'change').
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = B.utils;
  const SCHEMA_VERSION = 1;
  const COLLECTIONS = ['accounts', 'categories', 'bills', 'income', 'payments', 'receipts', 'transactions', 'goals'];

  const DEFAULT_WIDGETS = [
    'summary', 'overdue', 'confirmIncome', 'upcoming', 'setAside', 'accounts', 'categoryBudgets', 'goals'
  ];
  const DEFAULT_REPORT_SECTIONS = ['summary', 'trend', 'categories', 'accounts', 'metrics', 'list'];

  const PALETTE = ['#1f7a5c', '#2f6fd6', '#b4531a', '#8a4fc7', '#c2366b', '#0f8a9c', '#7a6a12', '#4e5d6c', '#d1495b', '#3d8b37', '#a35d00', '#5b5fc7'];

  function defaultSettings() {
    return {
      currency: 'AUD',
      locale: 'en-AU',
      weekStart: 1,              // 0 = Sunday, 1 = Monday
      theme: 'system',           // 'system' | 'light' | 'dark'
      contrast: 'normal',        // 'normal' | 'high'
      textSize: 1,               // 0.9 – 1.4
      reduceMotion: false,
      dyslexiaFont: false,
      dueSoonDays: 3,
      payFrequency: 'fortnight', // used for "set aside each pay"
      dashboardPeriod: 'month',  // 'week' | 'fortnight' | 'month'
      upcomingDays: 14,
      widgets: DEFAULT_WIDGETS.map((id) => ({ id, visible: true })),
      reportSections: DEFAULT_REPORT_SECTIONS.map((id) => ({ id, visible: true })),
      showOnboarding: true
    };
  }

  function defaultData() {
    const cats = [
      ['Housing', '🏠'], ['Utilities', '💡'], ['Phone & internet', '📱'], ['Insurance', '🛡️'],
      ['Transport', '🚗'], ['Groceries', '🛒'], ['Health', '💊'], ['Subscriptions', '📺'],
      ['Debt & loans', '💳'], ['Kids & family', '🧸'], ['Fun & eating out', '🎉'], ['Other', '📦']
    ].map(([name, icon], i) => ({ id: U.uid(), name, icon, color: PALETTE[i % PALETTE.length], budget: 0 }));

    const accts = [
      ['Everyday', 'Transaction', '#2f6fd6'],
      ['Bills', 'Transaction', '#1f7a5c'],
      ['Savings', 'Savings', '#8a4fc7']
    ].map(([name, type, color]) => ({ id: U.uid(), name, type, color, notes: '' }));

    return {
      version: SCHEMA_VERSION,
      settings: defaultSettings(),
      accounts: accts,
      categories: cats,
      bills: [], income: [], payments: [], receipts: [], transactions: [], goals: []
    };
  }

  /** Fill in anything missing (keeps older saved data working after updates). */
  function migrate(d) {
    const base = defaultData();
    d = d || base;
    COLLECTIONS.forEach((c) => { if (!Array.isArray(d[c])) d[c] = base[c]; });
    d.settings = Object.assign(defaultSettings(), d.settings || {});
    // make sure any new widgets/sections appear for existing users
    const mergeList = (list, defaults) => {
      const ids = list.map((w) => w.id);
      defaults.forEach((id) => { if (!ids.includes(id)) list.push({ id, visible: true }); });
      return list.filter((w) => defaults.includes(w.id));
    };
    d.settings.widgets = mergeList(d.settings.widgets, DEFAULT_WIDGETS);
    d.settings.reportSections = mergeList(d.settings.reportSections, DEFAULT_REPORT_SECTIONS);
    d.version = SCHEMA_VERSION;
    return d;
  }

  /* ---------- store ---------- */
  const S = {
    data: null,
    user: null,
    PALETTE,
    COLLECTIONS,
    listeners: {},
    saveState: 'saved',

    on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); },
    emit(evt, payload) { (this.listeners[evt] || []).forEach((fn) => fn(payload)); },

    async init(user) {
      this.user = user;
      const loaded = await B.storage.load(user.id);
      this.data = migrate(loaded);
      if (!loaded) await this.persist();
      return this.data;
    },

    clear() { this.data = null; this.user = null; },

    async persist() {
      if (!this.user || !this.data) return;
      this.saveState = 'saving';
      this.emit('save', 'saving');
      try {
        await B.storage.save(this.user.id, this.data);
        this.saveState = 'saved';
        this.emit('save', 'saved');
      } catch (e) {
        console.error(e);
        this.saveState = 'error';
        this.emit('save', 'error');
      }
    },

    changed() {
      this.emit('change');
      this._debouncedSave();
    },

    /* ----- generic CRUD ----- */
    list(c) { return (this.data && this.data[c]) || []; },
    get(c, id) { return this.list(c).find((x) => x.id === id) || null; },

    upsert(c, obj) {
      const list = this.list(c);
      if (!obj.id) obj.id = U.uid();
      const i = list.findIndex((x) => x.id === obj.id);
      if (i >= 0) list[i] = Object.assign({}, list[i], obj, { updatedAt: new Date().toISOString() });
      else list.push(Object.assign({ createdAt: new Date().toISOString() }, obj));
      this.changed();
      return obj;
    },

    /** Removes an item and returns a function that undoes it. */
    remove(c, id) {
      const list = this.list(c);
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return () => {};
      const [removed] = list.splice(i, 1);
      // keep related records so undo is lossless
      const linked = { bills: ['payments', 'billId'], income: ['receipts', 'incomeId'] }[c];
      const related = linked ? this.data[linked[0]].filter((p) => p[linked[1]] === id) : [];
      if (related.length) this.data[linked[0]] = this.data[linked[0]].filter((p) => p[linked[1]] !== id);
      this.changed();
      return () => {
        list.splice(Math.min(i, list.length), 0, removed);
        if (related.length) this.data[linked[0]].push(...related);
        this.changed();
      };
    },

    /** Remove an account/category and clear it from anything that used it. */
    removeGroup(c, id) {
      const field = c === 'accounts' ? 'accountId' : 'categoryId';
      const touched = [];
      ['bills', 'income', 'transactions', 'goals'].forEach((col) => {
        this.list(col).forEach((x) => { if (x[field] === id) { touched.push([x, x[field]]); x[field] = ''; } });
      });
      const undoRemove = this.remove(c, id);
      return () => { touched.forEach(([x, v]) => (x[field] = v)); undoRemove(); };
    },

    duplicate(c, id) {
      const src = this.get(c, id);
      if (!src) return null;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = U.uid();
      copy.name = (copy.name || '') + ' (copy)';
      delete copy.createdAt;
      return this.upsert(c, copy);
    },

    /* ----- bills: payments ----- */
    paymentFor(billId, dueDate) {
      return this.data.payments.find((p) => p.billId === billId && p.dueDate === dueDate) || null;
    },
    markPaid(billId, dueDate, amount, paidOn = U.today(), note = '') {
      const existing = this.paymentFor(billId, dueDate);
      const p = Object.assign(existing || { id: U.uid(), billId, dueDate }, {
        amount: U.round2(amount), paidOn, note
      });
      if (!existing) this.data.payments.push(p);
      this.changed();
      return p;
    },
    unmarkPaid(billId, dueDate) {
      const p = this.paymentFor(billId, dueDate);
      if (!p) return;
      this.data.payments = this.data.payments.filter((x) => x !== p);
      this.changed();
      return () => { this.data.payments.push(p); this.changed(); };
    },

    /* ----- income: actual amounts received ----- */
    receiptFor(incomeId, date) {
      return this.data.receipts.find((r) => r.incomeId === incomeId && r.date === date) || null;
    },
    markReceived(incomeId, date, amount, note = '') {
      const existing = this.receiptFor(incomeId, date);
      const r = Object.assign(existing || { id: U.uid(), incomeId, date }, { amount: U.round2(amount), note });
      if (!existing) this.data.receipts.push(r);
      this.changed();
      return r;
    },
    unmarkReceived(incomeId, date) {
      const r = this.receiptFor(incomeId, date);
      if (!r) return () => {};
      this.data.receipts = this.data.receipts.filter((x) => x !== r);
      this.changed();
      return () => { this.data.receipts.push(r); this.changed(); };
    },

    /* ----- goals ----- */
    goalSaved(g) { return (Number(g.startAmount) || 0) + U.sum(g.contributions || [], (c) => c.amount); },
    addContribution(goalId, amount, date = U.today(), note = '') {
      const g = this.get('goals', goalId);
      if (!g) return;
      g.contributions = g.contributions || [];
      g.contributions.push({ id: U.uid(), amount: U.round2(amount), date, note });
      this.changed();
    },

    /* ----- settings ----- */
    updateSettings(patch) {
      Object.assign(this.data.settings, patch);
      this.emit('settings');
      this.changed();
    },

    /* ----- import / export ----- */
    exportJSON() {
      return JSON.stringify({ app: B.config.appName, exportedAt: new Date().toISOString(), data: this.data }, null, 2);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      const incoming = parsed && parsed.data ? parsed.data : parsed;
      if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.bills)) {
        throw new Error('That file doesn’t look like a budget backup.');
      }
      this.data = migrate(incoming);
      this.emit('settings');
      this.changed();
    },
    resetAll(keepSettings = true) {
      const settings = this.data.settings;
      this.data = defaultData();
      if (keepSettings) this.data.settings = settings;
      this.emit('settings');
      this.changed();
    },

    /* ----- example data so new people can explore ----- */
    loadSample() {
      const d = this.data;
      const cat = (name) => (d.categories.find((c) => c.name === name) || d.categories[0]).id;
      const acc = (name) => (d.accounts.find((a) => a.name === name) || d.accounts[0]).id;
      const t = U.today();
      const monthDay = (day) => U.monthDate(U.parse(t).getFullYear(), U.parse(t).getMonth() - 1, day);
      const lastWeekday = U.addDays(U.startOfWeek(t, 1), -7 + 3); // last Thursday-ish

      const bills = [
        { name: 'Rent', amount: 520, frequency: 'weekly', startDate: U.addDays(U.startOfWeek(t, 1), -21), categoryId: cat('Housing'), accountId: acc('Bills'), autopay: true },
        { name: 'Electricity', amount: 280, amountType: 'variable', frequency: 'bimonthly', startDate: monthDay(12), categoryId: cat('Utilities'), accountId: acc('Bills') },
        { name: 'Water', amount: 190, amountType: 'variable', frequency: 'quarterly', startDate: monthDay(20), categoryId: cat('Utilities'), accountId: acc('Bills') },
        { name: 'Mobile phone', amount: 45, frequency: 'monthly', startDate: monthDay(3), categoryId: cat('Phone & internet'), accountId: acc('Everyday'), autopay: true },
        { name: 'Internet', amount: 85, frequency: 'monthly', startDate: monthDay(18), categoryId: cat('Phone & internet'), accountId: acc('Bills'), autopay: true },
        { name: 'Car insurance', amount: 96.5, frequency: 'monthly', startDate: monthDay(27), categoryId: cat('Insurance'), accountId: acc('Bills') },
        { name: 'Car registration', amount: 890, frequency: 'yearly', startDate: U.addMonths(t, 2), categoryId: cat('Transport'), accountId: acc('Savings') },
        { name: 'Streaming', amount: 18.99, frequency: 'monthly', startDate: monthDay(9), categoryId: cat('Subscriptions'), accountId: acc('Everyday'), autopay: true },
        { name: 'Gym membership', amount: 32, frequency: 'fortnightly', startDate: lastWeekday, categoryId: cat('Health'), accountId: acc('Everyday'), autopay: true },
        { name: 'Groceries', amount: 180, amountType: 'variable', trackSpending: true, frequency: 'weekly', startDate: U.addDays(U.startOfWeek(t, 1), -14 + 5), categoryId: cat('Groceries'), accountId: acc('Everyday') }
      ];
      bills.forEach((b) => this.upsert('bills', Object.assign({ amountType: 'fixed', notes: '', sample: true }, b)));

      this.upsert('income', {
        name: 'Pay', amount: 2450, frequency: 'fortnightly', startDate: U.addDays(U.startOfWeek(t, 1), -11),
        accountId: acc('Everyday'), notes: '', sample: true
      });

      const side = this.upsert('income', {
        name: 'Weekend cafe shifts', amount: 320, amountType: 'variable', frequency: 'weekly',
        startDate: U.addDays(U.startOfWeek(t, 1), -21 + 6), accountId: acc('Everyday'), notes: 'Hours change week to week', sample: true
      });
      B.recur.occurrences(side, U.addDays(t, -21), U.addDays(t, -8)).forEach((date, i) =>
        d.receipts.push({ id: U.uid(), incomeId: side.id, date, amount: [286.5, 341.25][i % 2], note: '' }));

      // Mark past bills in the last ~5 weeks as paid so the reports have history.
      const from = U.addDays(t, -35);
      d.bills.filter((b) => b.sample).forEach((b) => {
        B.recur.occurrences(b, from, U.addDays(t, -1)).forEach((date, i) => {
          if (b.name === 'Internet' && date > U.addDays(t, -10)) return; // leave one overdue to show the feature
          if (b.trackSpending && date > U.addDays(t, -7)) return; // current week is tracked by spending entries
          const amt = b.amountType === 'variable' ? b.amount * (0.85 + ((i * 7) % 30) / 100) : b.amount;
          d.payments.push({ id: U.uid(), billId: b.id, dueDate: date, amount: U.round2(amt), paidOn: date });
        });
      });

      [
        [-2, 'Coffee & lunch', 23.5, 'Fun & eating out'], [-4, 'Fuel', 72.1, 'Transport'],
        [-6, 'Pharmacy', 18.95, 'Health'], [-9, 'Birthday present', 60, 'Other'],
        [-12, 'Takeaway', 41, 'Fun & eating out'], [-15, 'Fuel', 68.4, 'Transport']
      ].forEach(([off, description, amount, c]) =>
        this.upsert('transactions', { type: 'expense', date: U.addDays(t, off), description, amount, categoryId: cat(c), accountId: acc('Everyday'), notes: '', sample: true }));

      // spending logged against the tracked Groceries bill
      const gro0 = d.bills.find((b) => b.sample && b.trackSpending);
      if (gro0) {
        const cycleStart = B.recur.occurrences(gro0, U.addDays(t, -6), t).pop() || t;
        [[0, 'Supermarket shop', 96.4], [2, 'Fruit & veg market', 31.75]].forEach(([off, description, amount]) => {
          const date = U.min(U.addDays(cycleStart, off), t);
          this.upsert('transactions', { type: 'expense', date, description, amount, billId: gro0.id, categoryId: gro0.categoryId, accountId: gro0.accountId, notes: '', sample: true });
        });
      }
      const fun = d.categories.find((c) => c.name === 'Fun & eating out'); if (fun) fun.budget = 200;
      const gro = d.categories.find((c) => c.name === 'Groceries'); if (gro) gro.budget = 800;

      this.upsert('goals', {
        name: 'Emergency fund', target: 5000, startAmount: 1200, targetDate: U.addMonths(t, 10),
        accountId: acc('Savings'), color: '#8a4fc7', icon: '🛟', contributions: [{ id: U.uid(), date: U.addDays(t, -7), amount: 150 }], sample: true
      });
      this.upsert('goals', {
        name: 'Holiday', target: 2500, startAmount: 300, targetDate: U.addMonths(t, 6),
        accountId: acc('Savings'), color: '#0f8a9c', icon: '✈️', contributions: [], sample: true
      });
      this.changed();
    },

    removeSample() {
      ['bills', 'income', 'transactions', 'goals'].forEach((c) => {
        this.data[c] = this.list(c).filter((x) => !x.sample);
      });
      const ids = new Set(this.data.bills.map((b) => b.id));
      this.data.payments = this.data.payments.filter((p) => ids.has(p.billId));
      const incIds = new Set(this.data.income.map((i) => i.id));
      this.data.receipts = this.data.receipts.filter((r) => incIds.has(r.incomeId));
      this.changed();
    },
    hasSample() { return ['bills', 'income', 'transactions', 'goals'].some((c) => this.list(c).some((x) => x.sample)); }
  };

  S._debouncedSave = U.debounce(() => S.persist(), 300);
  window.addEventListener('beforeunload', () => { if (S.user && S.data) B.storage.save(S.user.id, S.data); });

  S.defaultSettings = defaultSettings;
  B.store = S;
})(window.Budget);
