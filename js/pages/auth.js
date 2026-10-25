/* =========================================================
   pages/auth.js — Sign in / create account / try as guest.
   ========================================================= */
(function (B) {
  const esc = B.utils.esc;
  let mode = 'signin';

  B.pages.auth = {
    title: 'Sign in',
    render(root) {
      const local = B.auth.name === 'local';
      const isUp = mode === 'signup';
      root.innerHTML = `
        <div class="auth">
          <section class="auth__intro" aria-labelledby="intro-title">
            <div class="brand" style="color:inherit;padding:0 0 24px"><span class="brand__mark" style="background:var(--primary-ink);color:var(--primary)" aria-hidden="true">$</span>${esc(B.config.appName)}</div>
            <h1 id="intro-title">Know where every dollar is going.</h1>
            <p>A simple budget you can shape around your life — your bills, your pay cycle, your accounts.</p>
            <ul class="auth__points">
              <li><span aria-hidden="true">📅</span><span>Bills on any schedule, with due dates worked out for you</span></li>
              <li><span aria-hidden="true">🏦</span><span>See how much to move into each account every pay</span></li>
              <li><span aria-hidden="true">📊</span><span>Check how you’re tracking by week, month or year</span></li>
            </ul>
          </section>
          <main class="auth__panel" id="main">
            <div class="auth__card">
              <div class="card">
                ${B.ui.tabs([{ id: 'signin', label: 'Sign in' }, { id: 'signup', label: 'Create account' }], mode, 'mode')}
                <h2>${isUp ? 'Create your account' : 'Welcome back'}</h2>
                <form id="auth-form" novalidate>
                  <div class="form-error" role="alert" hidden></div>
                  ${isUp ? `<div class="field"><label class="field__label" for="a-name">Your name</label><input id="a-name" name="name" type="text" autocomplete="given-name"></div>` : ''}
                  <div class="field"><label class="field__label" for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required></div>
                  <div class="field">
                    <label class="field__label" for="a-pw">Password</label>
                    <div class="input-affix" style="flex-direction:row-reverse">
                      <button type="button" class="btn btn--ghost" data-showpw aria-pressed="false" style="border-radius:0 var(--radius-sm) var(--radius-sm) 0;border-left:0">Show</button>
                      <input id="a-pw" name="password" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}" required minlength="8" style="border-radius:var(--radius-sm) 0 0 var(--radius-sm)" aria-describedby="pw-help">
                    </div>
                    <p class="field__help" id="pw-help">${isUp ? 'At least 8 characters.' : ''}</p>
                  </div>
                  ${!isUp ? `<label class="check"><input type="checkbox" name="remember" checked> <span>Keep me signed in on this device</span></label>` : ''}
                  <button class="btn btn--primary btn--block" type="submit" style="margin-top:12px">${isUp ? 'Create account' : 'Sign in'}</button>
                </form>
                ${local ? `
                  <div class="row" style="margin:16px 0 4px"><hr class="grow" style="border:0;border-top:1px solid var(--border)"><span class="muted small">or</span><hr class="grow" style="border:0;border-top:1px solid var(--border)"></div>
                  <button class="btn btn--ghost btn--block" type="button" data-guest>Try it without an account</button>` : ''}
              </div>
              ${local ? `<div class="callout small" style="margin-top:14px"><span class="callout__icon" aria-hidden="true">🔒</span>
                <div>Your account and budget are saved <strong>on this device only</strong> for now. Use Settings → Export backup to keep a copy.</div></div>` : ''}
            </div>
          </main>
        </div>`;

      root.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; this.render(root); root.querySelector('#a-email').focus(); }));

      const pw = root.querySelector('#a-pw');
      root.querySelector('[data-showpw]').onclick = (e) => {
        const show = pw.type === 'password';
        pw.type = show ? 'text' : 'password';
        e.target.textContent = show ? 'Hide' : 'Show';
        e.target.setAttribute('aria-pressed', String(show));
      };

      const guest = root.querySelector('[data-guest]');
      if (guest) guest.onclick = async () => {
        const user = await B.auth.signInGuest();
        await B.app.enter(user);
      };

      const form = root.querySelector('#auth-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const err = form.querySelector('.form-error');
        const btn = form.querySelector('[type=submit]');
        const fd = Object.fromEntries(new FormData(form));
        btn.disabled = true;
        try {
          const user = isUp
            ? await B.auth.signUp(fd)
            : await B.auth.signIn({ email: fd.email, password: fd.password, remember: !!fd.remember });
          await B.app.enter(user);
        } catch (ex) {
          err.hidden = false;
          err.textContent = ex.message;
          btn.disabled = false;
        }
      };
    }
  };
})(window.Budget);
