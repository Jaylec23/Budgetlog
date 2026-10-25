/* =========================================================
   pages/goals.js — Savings goals with progress and a plan
   for how much to put away each week/fortnight/month.
   ========================================================= */
(function (B) {
  const U = B.utils, C = B.calc, ui = B.ui, S = B.store;
  const esc = U.esc;

  B.pages.goals = {
    title: 'Goals', icon: '🎯',
    render(main) {
      const goals = S.list('goals');
      const totalSaved = U.sum(goals, (g) => S.goalSaved(g));
      const totalTarget = U.sum(goals, (g) => g.target);

      main.innerHTML = `
        <div class="page-head">
          <div><h1>Savings goals</h1><p>Save towards the things that matter, a bit at a time.</p></div>
          <div class="page-head__actions"><button class="btn btn--primary" data-act="add">＋ New goal</button></div>
        </div>
        ${goals.length ? `
          <div class="grid grid--stats" style="margin-bottom:16px">
            ${ui.stat({ label: 'Saved across goals', value: U.money(totalSaved), tone: 'hero' })}
            ${ui.stat({ label: 'Total of targets', value: U.money(totalTarget) })}
            ${ui.stat({ label: 'Still to go', value: U.money(Math.max(0, totalTarget - totalSaved)) })}
          </div>
          <div class="grid grid--2">${goals.map((g) => {
            const plan = C.goalPlan(g);
            const done = plan.remaining <= 0;
            const hist = (g.contributions || []).slice().sort((a, b) => b.date.localeCompare(a.date));
            return `<article class="card" aria-labelledby="g-${g.id}">
              <div class="card__head">
                <h2 id="g-${g.id}"><span aria-hidden="true">${esc(g.icon || '🎯')}</span> ${esc(g.name)}</h2>
                <button class="icon-btn" data-edit="${g.id}" aria-label="Edit ${esc(g.name)}">✎</button>
              </div>
              <div class="row row--between" style="margin-bottom:6px">
                <span class="num" style="font-size:1.4rem;font-weight:800">${U.money(plan.saved)}</span>
                <span class="muted">of ${U.money(plan.target)} · ${plan.pct}%</span>
              </div>
              ${ui.progress(plan.pct, { color: g.color, label: `${g.name} ${plan.pct}% saved` })}
              <p class="small" style="margin:12px 0">
                ${done ? '🎉 <strong>Goal reached!</strong>'
                  : g.targetDate ? `To reach it by <strong>${U.fmtDate(g.targetDate, 'full')}</strong> (${plan.daysLeft} days), put away about
                    <strong>${U.money(plan.perWeek)}</strong>/week, <strong>${U.money(plan.perFortnight)}</strong>/fortnight or <strong>${U.money(plan.perMonth)}</strong>/month.`
                  : `${U.money(plan.remaining)} to go. Add a target date to get a saving plan.`}
              </p>
              ${g.accountId ? `<p class="small muted">Saving in ${ui.chip(g.accountId, 'account')}</p>` : ''}
              <div class="row"><button class="btn btn--primary btn--sm" data-add="${g.id}">＋ Add / take out money</button></div>
              ${hist.length ? `<details class="details" style="margin-top:12px"><summary>History (${hist.length})</summary>
                <ul class="list">${hist.map((c) => `<li class="list__item" style="min-height:44px">
                  <div class="list__main"><div>${U.fmtDate(c.date, 'full')}</div>${c.note ? `<div class="list__meta">${esc(c.note)}</div>` : ''}</div>
                  <div class="list__amount ${c.amount >= 0 ? 'pos' : 'neg'}">${c.amount >= 0 ? '+' : '−'}${U.money(Math.abs(c.amount))}</div>
                  <button class="icon-btn" data-rmc="${g.id}|${c.id}" aria-label="Remove this entry">✕</button></li>`).join('')}</ul></details>` : ''}
            </article>`;
          }).join('')}</div>`
          : ui.empty({ icon: '🎯', title: 'No goals yet', text: 'Holiday, car, emergency fund, Christmas — set a target and we’ll show you how much to save each pay.', action: '<button class="btn btn--primary" data-act="add">＋ Create your first goal</button>' })}`;

      main.onclick = (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.act === 'add') B.forms.goal();
        if (d.edit) B.forms.goal(d.edit);
        if (d.add) B.forms.contribute(d.add);
        if (d.rmc) {
          const [gid, cid] = d.rmc.split('|');
          const g = S.get('goals', gid);
          const idx = g.contributions.findIndex((c) => c.id === cid);
          const [removed] = g.contributions.splice(idx, 1);
          S.changed();
          ui.undoToast('Entry removed', () => { g.contributions.splice(idx, 0, removed); S.changed(); });
        }
      };
    }
  };
})(window.Budget);
