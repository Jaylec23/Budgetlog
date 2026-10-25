/* =========================================================
   calc.js — All the money maths used by pages.
   Pages call these instead of doing sums themselves, so a
   change to how something is counted happens in one place.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = B.utils;
  const R = B.recur;
  const S = () => B.store;
  const C = {};

  /* ---------- status of a single bill occurrence ---------- */
  C.status = (date, payment) => {
    if (payment) return 'paid';
    const today = U.today();
    if (date < today) return 'overdue';
    const soon = Number(S().data.settings.dueSoonDays) || 0;
    if (U.daysBetween(today, date) <= soon) return 'due-soon';
    return 'upcoming';
  };
  C.STATUS_LABEL = { paid: 'Paid', overdue: 'Overdue', 'due-soon': 'Due soon', upcoming: 'Upcoming', tracking: 'In progress' };

  /* ---------- bills tracked with spending (e.g. groceries, fuel) ----------
     Each due date starts a "cycle" that runs until the day before the next
     one. Spending linked to the bill inside that cycle is what was spent
     against the bill's amount (the allocation). */
  C.cycleEnd = (bill, date) => {
    const next = R.next(bill, 1, U.addDays(date, 1))[0];
    if (next) return U.addDays(next, -1);
    if (bill.endDate && bill.endDate > date) return bill.endDate;
    return U.addDays(date, Math.max(6, Math.round(365.25 / Math.max(R.perYear(bill), 1)) - 1));
  };
  C.linkedSpending = (billId, from, to) =>
    S().list('transactions').filter((t) => t.billId === billId && (t.type || 'expense') === 'expense' && t.date >= from && t.date <= to);

  /** Allocation vs spending for one cycle of a tracked bill. */
  C.envelope = (bill, date) => {
    const end = C.cycleEnd(bill, date);
    const entries = C.linkedSpending(bill.id, date, end);
    const spent = U.sum(entries, (t) => t.amount);
    const allocated = Number(bill.amount) || 0;
    return { bill, start: date, end, entries, spent, allocated, remaining: allocated - spent, pct: U.pct(spent, allocated), done: end < U.today() };
  };

  /** The cycle of a tracked bill that contains `day` (default today), or null. */
  C.currentEnvelope = (bill, day = U.today()) => {
    const start = R.occurrences(bill, U.addDays(day, -800), day).pop();
    if (!start) return null;
    const env = C.envelope(bill, start);
    return env.end >= day ? env : null;
  };

  /** True when a spending entry is already counted inside a tracked bill. */
  C.countedInBill = (t) => {
    if (!t.billId) return false;
    const b = S().get('bills', t.billId);
    return !!(b && b.trackSpending && !b.paused && t.date >= b.startDate);
  };

  /** Every bill due date in range, with paid info and the amount to count. */
  C.billOccurrences = (from, to, filter = () => true) => {
    const out = [];
    S().list('bills').filter(filter).forEach((bill) => {
      R.occurrences(bill, from, to).forEach((date) => {
        // Saved payment wins; otherwise auto-pay bills count as paid once their date arrives.
        let payment = S().paymentFor(bill.id, date) ||
          (bill.autopay && date <= U.today() ? { auto: true, amount: bill.amount, paidOn: date } : null);
        let env = null;
        if (bill.trackSpending && !payment) {
          env = C.envelope(bill, date);
          // a finished cycle counts as paid with what was actually spent
          if (env.done) payment = { auto: true, tracked: true, amount: env.spent, paidOn: env.end };
        }
        const live = env && !env.done;
        out.push({
          kind: 'bill', bill, date, payment, envelope: env,
          expected: Number(bill.amount) || 0,
          // while a cycle is running, plan with whichever is bigger: allocation or spent so far
          amount: payment ? Number(payment.amount) || 0 : live ? Math.max(env.allocated, env.spent) : Number(bill.amount) || 0,
          estimated: !payment && (bill.amountType === 'variable' || !!live),
          status: live && date <= U.today() ? 'tracking' : C.status(date, payment)
        });
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.bill.name.localeCompare(b.bill.name));
  };

  /** Bills overdue (not paid) — looks back 1 year. */
  C.overdue = () => C.billOccurrences(U.addDays(U.today(), -365), U.addDays(U.today(), -1)).filter((o) => o.status === 'overdue');

  C.incomeOccurrences = (from, to) => {
    const out = [];
    S().list('income').forEach((inc) => {
      R.occurrences(inc, from, to).forEach((date) => {
        const receipt = S().receiptFor(inc.id, date);
        out.push({
          kind: 'income', income: inc, date, receipt,
          expected: Number(inc.amount) || 0,
          amount: receipt ? Number(receipt.amount) || 0 : Number(inc.amount) || 0,
          estimated: !receipt && inc.amountType === 'variable',
          // a variable pay day that has arrived but has no real amount yet
          needsAmount: !receipt && inc.amountType === 'variable' && date <= U.today()
        });
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };

  /** Variable pay days (last 8 weeks) still waiting for the real amount. */
  C.incomeToConfirm = () => C.incomeOccurrences(U.addDays(U.today(), -56), U.today()).filter((o) => o.needsAmount);

  C.transactionsIn = (from, to, type) =>
    S().list('transactions')
      .filter((t) => t.date >= from && t.date <= to && (!type || (t.type || 'expense') === type))
      .sort((a, b) => b.date.localeCompare(a.date));

  /** Everything for a period, ready for dashboards and reports. */
  C.summary = (from, to) => {
    const bills = C.billOccurrences(from, to);
    const income = C.incomeOccurrences(from, to);
    // spending linked to a tracked bill is already inside that bill's amount
    const spend = C.transactionsIn(from, to, 'expense').filter((t) => !C.countedInBill(t));
    const extraIncome = C.transactionsIn(from, to, 'income');

    const incomeTotal = U.sum(income, (i) => i.amount) + U.sum(extraIncome, (t) => t.amount);
    const billsTotal = U.sum(bills, (o) => o.amount);
    const billsPaid = U.sum(bills.filter((o) => o.payment), (o) => o.amount);
    const spendTotal = U.sum(spend, (t) => t.amount);
    const outTotal = billsTotal + spendTotal;

    const byCategory = {};
    const byAccount = {};
    const add = (map, key, v) => { map[key || ''] = (map[key || ''] || 0) + v; };
    bills.forEach((o) => { add(byCategory, o.bill.categoryId, o.amount); add(byAccount, o.bill.accountId, o.amount); });
    spend.forEach((t) => { add(byCategory, t.categoryId, Number(t.amount) || 0); add(byAccount, t.accountId, Number(t.amount) || 0); });

    const days = U.daysBetween(from, to) + 1;
    return {
      from, to, days,
      bills, income, spend, extraIncome,
      incomeTotal, billsTotal, billsPaid, billsUnpaid: billsTotal - billsPaid,
      spendTotal, outTotal,
      leftover: incomeTotal - outTotal,
      savingsRate: incomeTotal > 0 ? (incomeTotal - outTotal) / incomeTotal : 0,
      paidCount: bills.filter((o) => o.payment).length,
      overdueCount: bills.filter((o) => o.status === 'overdue').length,
      onTimeCount: bills.filter((o) => o.payment && o.payment.paidOn <= o.date).length,
      byCategory, byAccount,
      avgDailyOut: outTotal / days
    };
  };

  /* ---------- periods ---------- */
  /** Returns { from, to, label } for 'week'|'fortnight'|'month'|'year' containing `date`. */
  C.period = (type, date = U.today()) => {
    const ws = Number(S().data.settings.weekStart);
    if (type === 'week') {
      const from = U.startOfWeek(date, ws);
      const to = U.addDays(from, 6);
      return { type, from, to, label: `${U.fmtDate(from, 'short')} – ${U.fmtDate(to, 'full')}` };
    }
    if (type === 'fortnight') {
      // fortnights line up with the first income's pay cycle when there is one
      const inc = S().list('income').find((i) => i.frequency === 'fortnightly' && !i.paused);
      let from;
      if (inc) {
        const diff = U.daysBetween(inc.startDate, date);
        from = U.addDays(inc.startDate, Math.floor(diff / 14) * 14);
      } else from = U.startOfWeek(date, ws);
      const to = U.addDays(from, 13);
      return { type, from, to, label: `${U.fmtDate(from, 'short')} – ${U.fmtDate(to, 'full')}` };
    }
    if (type === 'year') {
      return { type, from: U.startOfYear(date), to: U.endOfYear(date), label: date.slice(0, 4) };
    }
    return { type: 'month', from: U.startOfMonth(date), to: U.endOfMonth(date), label: U.fmtDate(date, 'month') };
  };

  C.shiftPeriod = (p, dir) => {
    const step = { week: 7, fortnight: 14 }[p.type];
    if (step) return C.period(p.type, U.addDays(p.from, dir * step));
    if (p.type === 'year') return C.period('year', `${Number(p.from.slice(0, 4)) + dir}-06-01`);
    return C.period('month', U.addMonths(p.from, dir));
  };

  /* ---------- set-aside planner ---------- */
  /** How much each bill costs per chosen period, grouped by account. */
  C.setAside = (periodId) => {
    const rows = S().list('bills')
      .filter((b) => !b.paused && b.frequency !== 'once')
      .map((b) => ({ bill: b, per: R.amountPer(b, periodId) }));
    const byAccount = {};
    rows.forEach((r) => { const k = r.bill.accountId || ''; byAccount[k] = (byAccount[k] || 0) + r.per; });
    const incomePer = U.sum(S().list('income').filter((i) => !i.paused), (i) => R.amountPer(i, periodId));
    return { rows, byAccount, total: U.sum(rows, (r) => r.per), incomePer };
  };

  /* ---------- category budgets ---------- */
  C.categoryProgress = (from, to) => {
    const sum = C.summary(from, to);
    return S().list('categories')
      .filter((c) => Number(c.budget) > 0)
      .map((c) => {
        const spent = sum.byCategory[c.id] || 0;
        return { category: c, spent, budget: Number(c.budget), pct: U.pct(spent, Number(c.budget)) };
      });
  };

  /* ---------- goals ---------- */
  C.goalPlan = (g) => {
    const saved = S().goalSaved(g);
    const target = Number(g.target) || 0;
    const remaining = Math.max(0, target - saved);
    const out = { saved, target, remaining, pct: Math.min(100, U.pct(saved, target)), perWeek: 0, perFortnight: 0, perMonth: 0, daysLeft: null };
    if (g.targetDate && remaining > 0) {
      const days = Math.max(1, U.daysBetween(U.today(), g.targetDate));
      out.daysLeft = days;
      out.perWeek = remaining / (days / 7);
      out.perFortnight = remaining / (days / 14);
      out.perMonth = remaining / (days / 30.44);
    }
    return out;
  };

  /* ---------- lookups ---------- */
  C.category = (id) => S().get('categories', id) || { id: '', name: 'Uncategorised', icon: '•', color: '#8a9690' };
  C.account = (id) => S().get('accounts', id) || { id: '', name: 'No account', color: '#8a9690' };

  B.calc = C;
})(window.Budget);
