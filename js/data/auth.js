/* =========================================================
   auth.js — Sign up / sign in / sign out.
   ---------------------------------------------------------
   Same interface for both backends:
     signUp({ name, email, password })
     signIn({ email, password, remember })
     signInGuest()
     signOut()
     current()               → { id, name, email, guest } | null
     updateProfile({ name })
     changePassword(oldPw, newPw)
     deleteAccount(password)
   Local mode keeps accounts on this device only. Passwords are
   never stored — only a salted PBKDF2 hash.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const prefix = B.config.storagePrefix;
  const S = B.safeStorage;
  const USERS = prefix + 'users';
  const SESSION = prefix + 'session';

  /* ---------- helpers ---------- */
  const enc = new TextEncoder();
  const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const randomSalt = () => {
    const a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256));
    return toHex(a);
  };

  async function hash(password, salt) {
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
      return 'pbkdf2$' + toHex(bits);
    }
    // Fallback for very old browsers / insecure contexts (local testing only).
    let h = 5381;
    const s = salt + password;
    for (let i = 0; i < 20000; i++) h = ((h << 5) + h + s.charCodeAt(i % s.length)) | 0;
    return 'basic$' + (h >>> 0).toString(16);
  }

  const users = () => { try { return JSON.parse(S.get(USERS) || '[]'); } catch (e) { return []; } };
  const saveUsers = (list) => S.set(USERS, JSON.stringify(list));
  const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, guest: !!u.guest, createdAt: u.createdAt });
  const normEmail = (e) => String(e || '').trim().toLowerCase();

  // A "remember me" session lives in localStorage; otherwise only for this tab.
  const tabSession = {
    get() { try { return sessionStorage.getItem(SESSION); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(SESSION, v); } catch (e) {} },
    del() { try { sessionStorage.removeItem(SESSION); } catch (e) {} }
  };

  /* ---------- Local auth ---------- */
  const LocalAuth = {
    name: 'local',

    async init() { return this.current(); },

    current() {
      const id = S.get(SESSION) || tabSession.get();
      if (!id) return null;
      return publicUser(users().find((u) => u.id === id)) || null;
    },

    async signUp({ name, email, password }) {
      email = normEmail(email);
      if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');
      if (!password || password.length < 8) throw new Error('Password needs at least 8 characters.');
      const list = users();
      if (list.some((u) => u.email === email)) throw new Error('An account with that email already exists on this device. Try signing in.');
      const salt = randomSalt();
      const user = {
        id: B.utils.uid(), name: (name || '').trim() || email.split('@')[0], email,
        salt, hash: await hash(password, salt), createdAt: new Date().toISOString()
      };
      list.push(user);
      saveUsers(list);
      S.set(SESSION, user.id);
      return publicUser(user);
    },

    async signIn({ email, password, remember = true }) {
      email = normEmail(email);
      const u = users().find((x) => x.email === email && !x.guest);
      if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error('That email and password don’t match an account on this device.');
      if (remember) S.set(SESSION, u.id); else { S.del(SESSION); tabSession.set(u.id); }
      return publicUser(u);
    },

    async signInGuest() {
      const list = users();
      let g = list.find((u) => u.guest);
      if (!g) {
        g = { id: 'guest', name: 'Guest', email: '', guest: true, createdAt: new Date().toISOString() };
        list.push(g);
        saveUsers(list);
      }
      S.set(SESSION, g.id);
      return publicUser(g);
    },

    async signOut() { S.del(SESSION); tabSession.del(); },

    async updateProfile({ name }) {
      const cur = this.current(); if (!cur) return;
      const list = users();
      const u = list.find((x) => x.id === cur.id);
      if (u && name) { u.name = name.trim(); saveUsers(list); }
      return publicUser(u);
    },

    async changePassword(oldPw, newPw) {
      const cur = this.current(); if (!cur || cur.guest) throw new Error('Guests don’t have a password.');
      if (!newPw || newPw.length < 8) throw new Error('New password needs at least 8 characters.');
      const list = users();
      const u = list.find((x) => x.id === cur.id);
      if ((await hash(oldPw, u.salt)) !== u.hash) throw new Error('Current password is incorrect.');
      u.salt = randomSalt();
      u.hash = await hash(newPw, u.salt);
      saveUsers(list);
    },

    async deleteAccount(password) {
      const cur = this.current(); if (!cur) return;
      const list = users();
      const u = list.find((x) => x.id === cur.id);
      if (!u.guest && (await hash(password, u.salt)) !== u.hash) throw new Error('Password is incorrect.');
      saveUsers(list.filter((x) => x.id !== cur.id));
      await B.storage.remove(cur.id);
      await this.signOut();
    }
  };

  /* ---------- Supabase auth (shared with Plate Log) ----------
     The login lives in the shared Supabase project, so the same email
     and password work in every app that uses it. */
  const friendly = (e) => {
    const m = (e && e.message) || String(e);
    if (/invalid login credentials/i.test(m)) return new Error('That email and password don’t match an account.');
    if (/email not confirmed/i.test(m)) return new Error('Please confirm your email first — check your inbox for the link we sent.');
    if (/already registered|already been registered/i.test(m)) return new Error('An account with that email already exists. Try signing in — it’s the same login as Plate Log.');
    if (/rate limit/i.test(m)) return new Error('Too many attempts. Please wait a minute and try again.');
    return new Error(m);
  };

  const SupabaseAuth = {
    name: 'supabase',
    _user: null,
    recovering: false,
    sb() { return B.supabaseClient; },
    map(u) {
      return u && { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || u.email.split('@')[0], guest: false };
    },
    async init() {
      if (!window.supabase) throw new Error('Couldn’t load the sign-in service. Check your internet connection and refresh.');
      // A password-reset email link returns here with type=recovery in the address.
      this.recovering = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);
      B.supabaseClient = window.supabase.createClient(B.config.supabaseUrl, B.config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data } = await this.sb().auth.getSession();
      this._user = this.map(data.session && data.session.user);
      if (location.hash.includes('access_token') || location.hash.includes('error=')) history.replaceState(null, '', location.pathname);
      return this._user;
    },
    current() { return this._user; },
    async signUp({ name, email, password }) {
      if (!password || password.length < 8) throw new Error('Password needs at least 8 characters.');
      const { data, error } = await this.sb().auth.signUp({
        email: String(email || '').trim(), password,
        options: { data: { name: (name || '').trim() }, emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw friendly(error);
      if (!data.session) {
        const e = new Error('Almost there! We’ve sent you an email — tap the link in it to confirm your account, then sign in here.');
        e.info = true;
        throw e;
      }
      this._user = this.map(data.user);
      return this._user;
    },
    async signIn({ email, password }) {
      const { data, error } = await this.sb().auth.signInWithPassword({ email: String(email || '').trim(), password });
      if (error) throw friendly(error);
      this._user = this.map(data.user);
      return this._user;
    },
    async resetPassword(email) {
      if (!email || !email.includes('@')) throw new Error('Enter your email address first.');
      const { error } = await this.sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
      if (error) throw friendly(error);
    },
    async signInGuest() { throw new Error('Guest mode is only available in local mode.'); },
    async signOut() { await this.sb().auth.signOut(); this._user = null; },
    async updateProfile({ name }) {
      const { data, error } = await this.sb().auth.updateUser({ data: { name } });
      if (error) throw friendly(error);
      this._user = this.map(data.user);
      return this._user;
    },
    async changePassword(oldPw, newPw) {
      if (!newPw || newPw.length < 8) throw new Error('New password needs at least 8 characters.');
      if (oldPw != null) {
        // Check the current password before changing it.
        const { error: e1 } = await this.sb().auth.signInWithPassword({ email: this._user.email, password: oldPw });
        if (e1) throw new Error('Current password is incorrect.');
      }
      const { error } = await this.sb().auth.updateUser({ password: newPw });
      if (error) throw friendly(error);
      this.recovering = false;
    },
    async deleteAccount(password) {
      // The login is shared with Plate Log, so this only removes Budgetlog's
      // data and signs out. The login itself stays for the other apps.
      const { error } = await this.sb().auth.signInWithPassword({ email: this._user.email, password });
      if (error) throw new Error('Password is incorrect.');
      await B.storage.remove(this._user.id);
      await this.signOut();
    }
  };

  B.auth = B.config.backend === 'supabase' ? SupabaseAuth : LocalAuth;
})(window.Budget);
