/* =========================================================
   config.js — App-wide settings you might change at launch.
   ---------------------------------------------------------
   BACKEND
   'local'    → everything saves in this browser (localStorage).
   'supabase' → uses Supabase for login + data (see README.md
                and js/data/storage.js / js/data/auth.js).
   ========================================================= */
window.Budget = window.Budget || {};

Budget.config = {
  appName: 'Budgetlog',

  // Which app this is. Every app sharing the same login (Budgetlog,
  // Plate Log, future trackers) saves its data under its own appId,
  // so one person's login keeps separate data for each app.
  appId: 'budgetlog',
  version: '0.1.0',

  backend: 'local',          // 'local' | 'supabase'

  // Fill these in when you switch to Supabase (Project Settings → API).
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Prefix for everything stored in the browser.
  storagePrefix: 'budgetlog.'
};
