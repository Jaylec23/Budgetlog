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

  backend: 'supabase',       // 'local' | 'supabase'

  // Fill these in when you switch to Supabase (Project Settings → API).
  // Shared with Plate Log ("Jaylec23's Project"). The publishable key is
  // meant to be public — row-level security protects everyone's data.
  supabaseUrl: 'https://jzlepztfizgczvnyzcfs.supabase.co',
  supabaseAnonKey: 'sb_publishable_WtiS1l4ULsi6Re2yCmtw6g_HeBi9vyV',

  // Prefix for everything stored in the browser.
  storagePrefix: 'budgetlog.'
};
