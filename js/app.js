/* =========================================================
   app.js — Starts the app, draws the shell (navigation),
   handles page routing (#/bills, #/insights…) and themes.
   Each page lives in js/pages/<name>.js and registers itself:
     Budget.pages.bills = { title, icon, render(main, params) }
   ========================================================= */
window.Budget = window.Budget || {};
Budget.pages = Budget.pages || {};

(function (B) {
  const U = B.utils;
  const esc = U.esc;

  // Order and grouping of the navigation menu.
  const NAV = [
    { section: 'Your money', items: ['dashboard', 'plan', 'bills', 'income', 'spending', 'calendar', 'insights', 'goals'] },
    { section: 'Set up', items: ['organise', 'settings', 'help'] }
  ];
  const BOTTOM = ['dashboard', 'bills', '+', 'insights', 'menu'];

  const App = {
    current: null,
    params: {},

    async start() {
      this.applyTheme();
      try {
        const user = await B.auth.init();
        if (user) await this.enter(user);
        else this.showAuth();
      } catch (e) {
        console.error(e);
        document.getElementById('root').innerHTML = `<div class="auth__panel"><div class="card"><h1>Something went wrong</h1><p>${esc(e.message)}</p></div></div>`;
      }
      window.addEventListener('hashchange', () => this.route(true));
      if (window.matchMedia) {
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());
      }
    },

    async enter(user) {
      await B.store.init(user);
      this.applyTheme();
      this.renderShell();
      B.store.on('change', () => this.refresh());
      B.store.on('settings', () => this.applyTheme());
      B.store.on('save', (state) => {
        const el = document.getElementById('save-state');
        if (el) { el.dataset.state = state; el.textContent = { saving: 'Saving…', saved: B.storage.name === 'local' ? 'Saved on this device' : 'Saved to your account', error: 'Couldn’t save' }[state]; }
        if (state === 'error') B.ui.toast('Your changes couldn’t be saved. Try exporting a backup from Settings.', { type: 'error' });
      });
      if (!location.hash.startsWith('#/') || location.hash === '#/' || location.hash.startsWith('#/auth')) location.hash = '#/dashboard';
      this.route(false);
      if (B.auth.recovering) {
        B.ui.form({
          title: 'Choose a new password', size: 'sm', submitLabel: 'Save password',
          fields: [{ name: 'nw', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', help: 'At least 8 characters. This changes your password for Plate Log too.' }],
          onSubmit: async (v) => { await B.auth.changePassword(null, v.nw); B.ui.toast('Password updated'); }
        });
      }
    },

    showAuth() {
      document.getElementById('root').innerHTML = '';
      B.pages.auth.render(document.getElementById('root'));
    },

    async signOut() {
      await B.store.persist();
      await B.auth.signOut();
      B.store.clear();
      B.store.listeners = {};
      location.hash = '';
      this.applyTheme();
      this.showAuth();
    },

    /* ---------- theme & accessibility settings ---------- */
    applyTheme() {
      const s = (B.store.data && B.store.data.settings) || {};
      const html = document.documentElement;
      if (s.theme === 'light' || s.theme === 'dark') html.dataset.theme = s.theme; else delete html.dataset.theme;
      const dark = s.theme === 'dark' || (s.theme !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
      html.dataset.dark = dark ? 'true' : 'false';
      html.dataset.contrast = s.contrast === 'high' ? 'high' : 'normal';
      html.dataset.motion = s.reduceMotion ? 'reduce' : 'normal';
      html.dataset.font = s.dyslexiaFont ? 'readable' : 'default';
      html.style.setProperty('--text-scale', s.textSize || 1);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = dark ? '#171d1a' : '#ffffff';
    },

    /* ---------- shell ---------- */
    renderShell() {
      const user = B.store.user;
      const navHTML = NAV.map((g) => `
        <div class="nav__section" aria-hidden="true">${esc(g.section)}</div>
        ${g.items.map((id) => {
          const p = B.pages[id];
          return `<a href="#/${id}" data-nav="${id}"><span class="nav__icon" aria-hidden="true">${p.icon}</span><span>${esc(p.title)}</span>${id === 'bills' ? '<span class="nav__count" data-overdue hidden></span>' : ''}</a>`;
        }).join('')}`).join('');

      document.getElementById('root').innerHTML = `
        <div class="app" id="app">
          <header class="topbar">
            <button class="icon-btn" type="button" data-open-nav aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">☰</button>
            <div class="topbar__title" id="topbar-title"></div>
            <button class="icon-btn" type="button" data-quick-add aria-label="Add something">＋</button>
          </header>

          <nav class="sidebar" id="sidebar" aria-label="Main">
            <a class="brand" href="#/dashboard"><span class="brand__mark" aria-hidden="true">$</span>${esc(B.config.appName)}</a>
            <div class="nav">${navHTML}</div>
            <div class="sidebar__foot">
              <div class="user-chip">
                <span class="avatar" aria-hidden="true">${esc((user.name || '?').slice(0, 1).toUpperCase())}</span>
                <div class="grow"><div class="list__title">${esc(user.name)}</div><div class="muted small">${user.guest ? 'Guest on this device' : esc(user.email)}</div></div>
                <button class="icon-btn" type="button" data-signout aria-label="Sign out" title="Sign out">⎋</button>
              </div>
              <div class="save-state" id="save-state" data-state="saved" role="status">${B.storage.name === 'local' ? 'Saved on this device' : 'Saved to your account'}</div>
            </div>
          </nav>
          <div class="scrim" data-close-nav hidden></div>

          <main class="main" id="main" tabindex="-1"></main>

          <nav class="bottombar" aria-label="Quick">
            ${BOTTOM.map((id) => {
              if (id === '+') return `<button type="button" class="fab-slot" data-quick-add><span aria-hidden="true">＋</span>Add</button>`;
              if (id === 'menu') return `<button type="button" data-open-nav aria-controls="sidebar"><span aria-hidden="true">☰</span>More</button>`;
              const p = B.pages[id];
              return `<a href="#/${id}" data-nav="${id}"><span aria-hidden="true">${p.icon}</span>${esc(p.short || p.title)}</a>`;
            }).join('')}
          </nav>
        </div>`;

      const app = document.getElementById('app');
      const scrim = app.querySelector('.scrim');
      const setNav = (open) => {
        app.classList.toggle('nav-open', open);
        scrim.hidden = !open;
        app.querySelectorAll('[data-open-nav]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
        if (open) app.querySelector('#sidebar a').focus();
      };
      app.addEventListener('click', (e) => {
        if (e.target.closest('[data-open-nav]')) setNav(true);
        else if (e.target.closest('[data-close-nav]') || e.target.closest('#sidebar a')) setNav(false);
        if (e.target.closest('[data-quick-add]')) this.quickAdd();
        if (e.target.closest('[data-signout]')) this.signOut();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && app.classList.contains('nav-open')) setNav(false); });
    },

    quickAdd() {
      const dlg = B.ui.openDialog(`
        <div class="modal__inner">
          <header class="modal__head"><h2 id="qa-title">What would you like to add?</h2><button type="button" class="icon-btn" data-x aria-label="Close">✕</button></header>
          <div class="modal__body"><div class="grid grid--2" style="padding-bottom:12px">
            ${[['bill', '🧾', 'A bill', 'Rent, phone, insurance…'], ['spend', '🛒', 'Spending', 'Something you bought'],
               ['income', '💰', 'Income', 'Pay or regular money in'], ['in', '➕', 'Money in (one-off)', 'Gift, refund, sale'],
               ['goal', '🎯', 'Savings goal', 'Something to save for']].map(([k, i, t, s]) => `
              <button type="button" class="card row" style="text-align:left;cursor:pointer;gap:12px" data-k="${k}">
                <span class="list__icon" aria-hidden="true">${i}</span><span class="grow"><strong>${t}</strong><br><span class="muted small">${s}</span></span>
              </button>`).join('')}
          </div></div>
        </div>`, { size: 'sm', labelId: 'qa-title' });
      dlg.addEventListener('click', (e) => {
        if (e.target.closest('[data-x]')) return dlg.close();
        const b = e.target.closest('[data-k]');
        if (!b) return;
        dlg.close();
        ({ bill: () => B.forms.bill(), spend: () => B.forms.transaction(), income: () => B.forms.income(),
           in: () => B.forms.transaction(null, { type: 'income' }), goal: () => B.forms.goal() })[b.dataset.k]();
      });
    },

    /* ---------- routing ---------- */
    parseHash() {
      const h = (location.hash || '').replace(/^#\/?/, '');
      const [path, qs] = h.split('?');
      const params = Object.fromEntries(new URLSearchParams(qs || ''));
      return { id: B.pages[path] && path !== 'auth' ? path : 'dashboard', params };
    },

    route(fromNav) {
      if (!B.store.data) return;
      const { id, params } = this.parseHash();
      this.current = id;
      this.params = params;
      const page = B.pages[id];
      const app = document.getElementById('app');
      if (app && app.classList.contains('nav-open')) { app.classList.remove('nav-open'); app.querySelector('.scrim').hidden = true; }
      document.title = `${page.title} · ${B.config.appName}`;
      document.getElementById('topbar-title').textContent = page.title;
      document.querySelectorAll('[data-nav]').forEach((a) => {
        if (a.dataset.nav === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      this.render();
      this.params = {}; // one-time hints (e.g. ?tab=upcoming) only apply on arrival
      window.scrollTo(0, 0);
      if (fromNav) {
        const h1 = document.querySelector('#main h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
    },

    render() {
      const main = document.getElementById('main');
      if (!main) return;
      try {
        B.pages[this.current].render(main, this.params);
      } catch (e) {
        console.error(e);
        main.innerHTML = `<div class="card card--danger"><h1>This page hit a problem</h1><p>${esc(e.message)}</p></div>`;
      }
      this.updateBadges();
    },

    /** Re-draw the current page after data changes, keeping scroll and focus. */
    refresh() {
      if (!B.store.data || !this.current) return;
      const y = window.scrollY;
      const active = document.activeElement;
      const key = active && (active.id || active.dataset.focusKey);
      this.render();
      window.scrollTo(0, y);
      if (key) {
        const el = document.getElementById(key) || document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
        if (el) el.focus({ preventScroll: true });
      }
    },

    updateBadges() {
      const n = B.calc.overdue().length;
      document.querySelectorAll('[data-overdue]').forEach((el) => {
        el.hidden = !n; el.textContent = n;
        el.setAttribute('aria-label', `${n} overdue`);
      });
    }
  };

  B.app = App;
  document.addEventListener('DOMContentLoaded', () => App.start());
})(window.Budget);
