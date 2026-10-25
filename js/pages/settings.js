/* =========================================================
   pages/settings.js — Profile, look & accessibility, money &
   region, budget preferences, dashboard layout, data/backup.
   Most settings save the moment they change.
   ========================================================= */
(function (B) {
  const U = B.utils, ui = B.ui, S = B.store, R = B.recur;
  const esc = U.esc;

  const CURRENCIES = ['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD', 'HKD', 'JPY', 'INR', 'ZAR', 'PHP'];
  const LOCALES = [['en-AU', 'English (Australia)'], ['en-NZ', 'English (New Zealand)'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['en-CA', 'English (Canada)']];

  const WIDGET_LABELS = () => Object.fromEntries(Object.entries(B.pages._dashboardWidgets).map(([k, w]) => [k, w.label]));

  function reorder(listName, labels) {
    const list = S.data.settings[listName];
    return `<ul class="reorder">${list.map((w, i) => `
      <li>
        <label class="check grow" style="padding:0;min-height:auto"><input type="checkbox" data-vis="${listName}|${w.id}" data-focus-key="vis-${listName}-${w.id}" ${w.visible ? 'checked' : ''}> <span>${esc(labels[w.id] || w.id)}</span></label>
        <button class="icon-btn" data-mv="${listName}|${w.id}|-1" aria-label="Move ${esc(labels[w.id])} up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-mv="${listName}|${w.id}|1" aria-label="Move ${esc(labels[w.id])} down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
      </li>`).join('')}</ul>`;
  }

  const sel = (key, options, val) =>
    `<select id="set-${key}" data-set="${key}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

  B.pages.settings = {
    title: 'Settings', icon: '⚙️',
    render(main) {
      const s = S.data.settings;
      const user = S.user;
      main.innerHTML = `
        <div class="page-head"><div><h1>Settings</h1><p>Make it work the way you like. Changes save straight away.</p></div></div>
        <div class="grid grid--2">

          <section class="card" aria-labelledby="st-look">
            <div class="card__head"><h2 id="st-look">Look & accessibility</h2></div>
            <fieldset class="field"><legend class="field__label">Theme</legend>
              <div class="segmented">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `
                <label class="segmented__opt"><input type="radio" name="theme" data-set="theme" value="${v}" data-focus-key="theme-${v}" ${s.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
            </fieldset>
            <div class="field">
              <label class="field__label" for="set-textSize">Text size: <span id="ts-val">${Math.round(s.textSize * 100)}%</span></label>
              <input id="set-textSize" type="range" min="0.9" max="1.4" step="0.05" value="${s.textSize}" data-set="textSize" style="width:100%;accent-color:var(--primary)">
            </div>
            <label class="check"><input type="checkbox" id="set-contrast" data-set="contrast" data-on="high" data-off="normal" ${s.contrast === 'high' ? 'checked' : ''}> <span>High contrast colours</span></label>
            <label class="check"><input type="checkbox" id="set-reduceMotion" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}> <span>Reduce motion & animation</span></label>
            <label class="check"><input type="checkbox" id="set-dyslexiaFont" data-set="dyslexiaFont" ${s.dyslexiaFont ? 'checked' : ''}> <span>Easier-to-read font with wider spacing</span></label>
          </section>

          <section class="card" aria-labelledby="st-money">
            <div class="card__head"><h2 id="st-money">Money & region</h2></div>
            <div class="form-row">
              <div class="field"><label class="field__label" for="set-currency">Currency</label>${sel('currency', CURRENCIES.map((c) => [c, c]), s.currency)}</div>
              <div class="field"><label class="field__label" for="set-locale">Number & date style</label>${sel('locale', LOCALES, s.locale)}</div>
            </div>
            <div class="field"><label class="field__label" for="set-weekStart">Weeks start on</label>${sel('weekStart', [[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']], s.weekStart)}</div>
            <p class="muted small">Example: ${U.money(1234.5)} · ${U.fmtDate(U.today(), 'long')}</p>
          </section>

          <section class="card" aria-labelledby="st-budget" id="budget">
            <div class="card__head"><h2 id="st-budget">Budget preferences</h2></div>
            <div class="field"><label class="field__label" for="set-payFrequency">Show “set aside” amounts</label>
              ${sel('payFrequency', R.PERIODS.map((p) => [p.id, p.label.replace('per ', 'Per ')]), s.payFrequency)}
              <p class="field__help">Usually matches how often you’re paid.</p></div>
            <div class="form-row">
              <div class="field"><label class="field__label" for="set-dueSoonDays">“Due soon” means within</label>${sel('dueSoonDays', [1, 2, 3, 5, 7, 14].map((n) => [n, `${n} day${n > 1 ? 's' : ''}`]), s.dueSoonDays)}</div>
              <div class="field"><label class="field__label" for="set-upcomingDays">Home shows bills for the next</label>${sel('upcomingDays', [7, 14, 21, 30, 60].map((n) => [n, `${n} days`]), s.upcomingDays)}</div>
            </div>
            <label class="check"><input type="checkbox" id="set-showOnboarding" data-set="showOnboarding" ${s.showOnboarding ? 'checked' : ''}> <span>Show the getting-started checklist</span></label>
          </section>

          <section class="card" aria-labelledby="st-dash">
            <div class="card__head"><h2 id="st-dash">Home screen layout</h2></div>
            <p class="muted small">Tick what to show and use the arrows to change the order.</p>
            ${reorder('widgets', WIDGET_LABELS())}
          </section>

          <section class="card" aria-labelledby="st-rep">
            <div class="card__head"><h2 id="st-rep">Insights layout</h2></div>
            ${reorder('reportSections', B.pages._reportSectionLabels)}
          </section>

          <section class="card" aria-labelledby="st-data">
            <div class="card__head"><h2 id="st-data">Your data</h2></div>
            <div class="callout small" style="margin-bottom:14px"><span class="callout__icon" aria-hidden="true">💾</span>
              <div>${B.storage.name === 'local' ? 'Everything is saved <strong>on this device only</strong>. Download a backup now and then, especially before clearing your browser.' : 'Your data is saved to your account in the cloud.'}</div></div>
            <div class="row" style="margin-bottom:10px">
              <button class="btn btn--ghost" data-act="export">⬇ Download backup</button>
              <label class="btn btn--ghost" for="import-file">⬆ Restore backup</label>
              <input id="import-file" type="file" accept="application/json,.json" class="sr-only">
            </div>
            <div class="row" style="margin-bottom:10px">
              ${S.hasSample() ? '<button class="btn btn--ghost" data-act="rm-sample">Remove example data</button>' : '<button class="btn btn--ghost" data-act="sample">Add example data</button>'}
            </div>
            <div class="row"><button class="btn btn--danger-ghost" data-act="reset">Erase all budget data…</button></div>
          </section>

          <section class="card" aria-labelledby="st-acc">
            <div class="card__head"><h2 id="st-acc">Your account</h2></div>
            <form id="profile-form" class="row" style="align-items:flex-end">
              <div class="field grow" style="margin:0"><label class="field__label" for="p-name">Name</label><input id="p-name" type="text" value="${esc(user.name)}" autocomplete="given-name"></div>
              <button class="btn btn--ghost" type="submit">Save name</button>
            </form>
            ${!user.guest ? `<p class="muted small" style="margin-top:10px">Signed in as ${esc(user.email)}</p>` : '<p class="muted small" style="margin-top:10px">You’re using a guest profile on this device. Create an account to keep your data separate from other people using this browser.</p>'}
            <div class="row" style="margin-top:10px">
              ${!user.guest ? '<button class="btn btn--ghost" data-act="pw">Change password</button>' : ''}
              <button class="btn btn--ghost" data-act="signout">Sign out</button>
              <button class="btn btn--danger-ghost" data-act="delete">Delete ${user.guest ? 'guest profile' : B.auth.name === 'supabase' ? 'Budgetlog data' : 'account'}…</button>
            </div>
          </section>
        </div>
        <p class="muted small center" style="margin-top:24px">${esc(B.config.appName)} v${esc(B.config.version)} · storage: ${esc(B.storage.name)}</p>`;

      /* ----- instant settings ----- */
      main.onchange = (e) => {
        const el = e.target;
        if (el.dataset.vis) {
          const [list, id] = el.dataset.vis.split('|');
          const arr = S.data.settings[list].map((w) => (w.id === id ? { ...w, visible: el.checked } : w));
          return S.updateSettings({ [list]: arr });
        }
        const key = el.dataset.set;
        if (!key) return;
        let v;
        if (el.type === 'checkbox') v = el.dataset.on ? (el.checked ? el.dataset.on : el.dataset.off) : el.checked;
        else if (['weekStart', 'dueSoonDays', 'upcomingDays', 'textSize'].includes(key)) v = Number(el.value);
        else v = el.value;
        S.updateSettings({ [key]: v });
        ui.toast('Saved', { duration: 1200 });
      };
      main.querySelector('#set-textSize').oninput = (e) => {
        document.documentElement.style.setProperty('--text-scale', e.target.value);
        main.querySelector('#ts-val').textContent = Math.round(e.target.value * 100) + '%';
      };

      main.querySelector('#profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = main.querySelector('#p-name').value.trim();
        if (!name) return;
        const u = await B.auth.updateProfile({ name });
        S.user = Object.assign(S.user, u || { name });
        B.app.renderShell(); B.app.route(false);
        ui.toast('Name updated');
      };

      main.querySelector('#import-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ok = await ui.confirm({ title: 'Restore this backup?', message: 'This replaces everything currently in your budget with the backup file.', confirmLabel: 'Restore', danger: true });
        if (!ok) return;
        try { S.importJSON(await file.text()); ui.toast('Backup restored'); }
        catch (err) { ui.toast(err.message, { type: 'error' }); }
      };

      main.onclick = async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.mv) {
          const [list, id, dir] = d.mv.split('|');
          const arr = S.data.settings[list].slice();
          const i = arr.findIndex((w) => w.id === id), j = i + Number(dir);
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          S.updateSettings({ [list]: arr });
          const b = main.querySelector(`[data-mv="${d.mv}"]`); if (b && !b.disabled) b.focus();
          return;
        }
        switch (d.act) {
          case 'export': U.download(`budget-backup-${U.today()}.json`, S.exportJSON()); ui.toast('Backup downloaded'); break;
          case 'sample': S.loadSample(); ui.toast('Example data added'); break;
          case 'rm-sample': S.removeSample(); ui.toast('Example data removed'); break;
          case 'reset':
            if (await ui.confirm({ title: 'Erase all budget data?', message: 'All bills, income, spending, goals, accounts and categories will be deleted. Your settings are kept. Download a backup first if you might want it back.', confirmLabel: 'Erase everything', danger: true })) {
              S.resetAll(true); ui.toast('All data erased');
            }
            break;
          case 'signout': B.app.signOut(); break;
          case 'pw':
            ui.form({
              title: 'Change password', size: 'sm', submitLabel: 'Change password',
              fields: [
                { name: 'old', label: 'Current password', type: 'password', required: true, autocomplete: 'current-password' },
                { name: 'nw', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', help: 'At least 8 characters.' }
              ],
              onSubmit: async (v) => { await B.auth.changePassword(v.old, v.nw); ui.toast('Password changed'); }
            });
            break;
          case 'delete':
            ui.form({
              title: user.guest ? 'Delete guest profile' : B.auth.name === 'supabase' ? 'Delete your Budgetlog data' : 'Delete your account', size: 'sm', submitLabel: 'Delete forever',
              intro: B.auth.name === 'supabase'
                ? 'This permanently deletes all your Budgetlog data and signs you out. Your login stays, so you can still use Plate Log.'
                : 'This permanently removes your profile and all its budget data from this device. It can’t be undone.',
              fields: user.guest ? [{ name: 'confirm', label: 'Type DELETE to confirm', required: true, validate: (x) => (x !== 'DELETE' ? 'Type DELETE in capitals.' : '') }]
                : [{ name: 'pw', label: 'Your password', type: 'password', required: true, autocomplete: 'current-password' }],
              onSubmit: async (v) => {
                await B.auth.deleteAccount(v.pw);
                B.store.clear(); B.store.listeners = {};
                location.hash = ''; B.app.showAuth(); ui.toast('Deleted');
              }
            });
            break;
        }
      };
    }
  };
})(window.Budget);
