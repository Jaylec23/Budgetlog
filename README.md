# Budgetlog

An accessible, customisable budget tracker: bills on any schedule, income, everyday spending, a calendar, insights by week / fortnight / month / year, savings goals, accounts and categories.

No build step, no installs. Plain HTML, CSS and JavaScript.

## Run it

- **Quickest:** double-click `index.html`.
- **Like it will run online:** in this folder run `python3 -m http.server 8000` (or `npx serve`) and open http://localhost:8000.

Data saves in the browser on that device (localStorage). Each account you create on the device has its own separate budget.

## Where things live

| To change… | Edit |
|---|---|
| App name, version, switch to Supabase | `js/config.js` |
| Colours, fonts, dark mode, high contrast | `css/base.css` (variables at the top) |
| Sidebar, phone bottom bar, page layout | `css/layout.css` |
| Buttons, cards, forms, charts, calendar look | `css/components.css` |
| Date & money helpers | `js/core/utils.js` |
| Frequencies (weekly, quarterly…) and due-date maths | `js/core/recurrence.js` |
| Totals, statuses, set-aside, goal plans | `js/core/calc.js` |
| Where data is saved (local / Supabase) | `js/data/storage.js` |
| Sign up / sign in | `js/data/auth.js` |
| Data shape, default categories & accounts, example data | `js/data/store.js` |
| Pop-ups, toasts, form builder, charts | `js/ui/components.js` |
| Add/edit forms (bill, income, spending, goal…) | `js/ui/forms.js` |
| Navigation menu, routing, theme | `js/app.js` |
| Each page | `js/pages/<page>.js` |

### Adding things

- **New frequency:** add one line to `FREQUENCIES` in `js/core/recurrence.js`.
- **New page:** create `js/pages/mypage.js` registering `Budget.pages.mypage = { title, icon, render(main) {…} }`, add a `<script>` tag in `index.html`, and add its id to `NAV` in `js/app.js`.
- **New home-screen widget:** add it to `WIDGETS` in `js/pages/dashboard.js` and its id to `DEFAULT_WIDGETS` in `js/data/store.js`.
- **New default category:** edit the list in `defaultData()` in `js/data/store.js` (affects new accounts only).

## Supabase (live)

Budgetlog now uses the same Supabase project as Plate Log ("Jaylec23's Project"), so one login works for both. Budgetlog's data is in the `app_data` table (`app = 'budgetlog'`); Plate Log's `docs` table is untouched. To run the site offline with local-only saving, set `backend: 'local'` in `js/config.js`.

### Switching a fresh copy to Supabase

The app only talks to storage and login through two small objects, so the switch is mostly configuration:

1. Create a Supabase project. In **SQL Editor**, run `supabase/schema.sql`.
2. In **Authentication → Providers**, make sure Email is enabled.
3. In `index.html`, un-comment the Supabase `<script>` line.
4. In `js/config.js` set `backend: 'supabase'` and paste your Project URL and anon key.

That's it — `js/data/storage.js` and `js/data/auth.js` already contain the Supabase versions. Notes:

- Guest mode is local-only and is hidden automatically in Supabase mode.
- Fully deleting a Supabase login needs a server-side function (service key). For now "Delete account" clears their data and signs them out.
- Data is stored as one JSON document per person **per app** in the shared `app_data` table, the same shape as local mode. If you later want separate tables (e.g. for analytics), only `storage.js` needs to change.

### One login for all your apps

Point every app (Budgetlog, Plate Log, future trackers) at the **same** Supabase project: same URL and anon key in each app's config, `schema.sql` run once. Then:

- People sign up once and use the same email and password everywhere.
- Each app saves under its own `appId` (`'budgetlog'` here), so a person's budget and gym data stay separate even though it's one login.
- "Delete account" inside an app removes only that app's data. Deleting the login in Supabase removes everything.
- In Supabase → Authentication → URL Configuration, add every app's web address so confirmation and reset emails link back correctly.
- People can move their local data across using **Settings → Download backup**, then **Restore backup** after signing in online.

## Data shape

```
{
  version, settings: {...},
  accounts:     [{ id, name, type, color, notes }],
  categories:   [{ id, name, icon, color, budget }],
  bills:        [{ id, name, amount, amountType: 'fixed'|'variable', frequency, customEvery, customUnit,
                   startDate, endDate, categoryId, accountId, autopay, trackSpending, paused, notes }],
  income:       [{ id, name, amount, amountType: 'fixed'|'variable', frequency, customEvery, customUnit, startDate, endDate, accountId, paused, notes }],
  payments:     [{ id, billId, dueDate, amount, paidOn, note }],
  receipts:     [{ id, incomeId, date, amount, note }],   // real amounts for 'variable' income
  transactions: [{ id, type: 'expense'|'income', date, description, amount, categoryId, accountId, billId, notes }],
                   // billId links spending to a bill with trackSpending (counts against its allowance)
  goals:        [{ id, name, icon, color, target, startAmount, targetDate, accountId, contributions: [{ id, date, amount, note }] }]
}
```

Dates are always `YYYY-MM-DD` strings so they never shift with time zones.
