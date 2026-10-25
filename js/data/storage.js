/* =========================================================
   storage.js — Where each person's budget data is saved.
   ---------------------------------------------------------
   Every adapter has the same 3 async methods:
     load(userId)        → data object or null
     save(userId, data)  → void
     remove(userId)      → void
   The rest of the app only talks to Budget.storage, so switching
   to Supabase means changing config.backend — nothing else.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const prefix = B.config.storagePrefix;

  /* ---------- Safe browser storage (falls back to memory) ---------- */
  const memory = {};
  const safe = {
    ok: (() => {
      try { localStorage.setItem(prefix + '__t', '1'); localStorage.removeItem(prefix + '__t'); return true; }
      catch (e) { return false; }
    })(),
    get(k) { try { return this.ok ? localStorage.getItem(k) : (memory[k] ?? null); } catch (e) { return memory[k] ?? null; } },
    set(k, v) { try { if (this.ok) localStorage.setItem(k, v); else memory[k] = v; } catch (e) { memory[k] = v; } },
    del(k) { try { if (this.ok) localStorage.removeItem(k); else delete memory[k]; } catch (e) { delete memory[k]; } }
  };
  B.safeStorage = safe;

  /* ---------- Local adapter (this device only) ---------- */
  const LocalAdapter = {
    name: 'local',
    async load(userId) {
      const raw = safe.get(prefix + 'data.' + userId);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { console.warn('Saved data unreadable', e); return null; }
    },
    async save(userId, data) {
      safe.set(prefix + 'data.' + userId, JSON.stringify(data));
    },
    async remove(userId) {
      safe.del(prefix + 'data.' + userId);
    }
  };

  /* ---------- Supabase adapter (ready to switch on) ----------
     1. Run supabase/schema.sql in your Supabase SQL editor.
     2. Add the Supabase script tag in index.html (it's there, commented).
     3. Set backend: 'supabase' and your URL/key in js/config.js.
     Data is stored as one JSON document per person per app (table app_data,
     keyed by user_id + app). Row-level security means people only ever see
     their own rows. Other apps on the same Supabase project use their own appId. */
  const SupabaseAdapter = {
    name: 'supabase',
    client() { return B.supabaseClient; },
    async load(userId) {
      const { data, error } = await this.client()
        .from('app_data').select('data').eq('user_id', userId).eq('app', B.config.appId).maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    },
    async save(userId, data) {
      const { error } = await this.client()
        .from('app_data')
        .upsert({ user_id: userId, app: B.config.appId, data, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async remove(userId) {
      // Only removes THIS app's data — the shared login and other apps' data stay.
      const { error } = await this.client().from('app_data').delete().eq('user_id', userId).eq('app', B.config.appId);
      if (error) throw error;
    }
  };

  B.storage = B.config.backend === 'supabase' ? SupabaseAdapter : LocalAdapter;
})(window.Budget);
