/* =========================================================
   pages/help.js — Plain-English guide and FAQ.
   ========================================================= */
(function (B) {
  const R = B.recur, U = B.utils;
  const esc = U.esc;

  const FAQ = [
    ['What’s the difference between a bill and spending?',
      'A <strong>bill</strong> repeats on a schedule (rent, phone, insurance, even your weekly grocery shop). We work out every due date for you. <strong>Spending</strong> is a one-off — a coffee, fuel, a present. Bills appear in the calendar ahead of time; spending is logged after it happens.'],
    ['How are due dates worked out?',
      'You choose how often a bill repeats and give one date it was (or will be) due. Every other date is counted forward and back from that one. Monthly bills keep the same day each month; if you pick the 31st, shorter months use their last day.'],
    ['My bill is a different amount every time.',
      'When adding it, choose <em>“An estimate”</em>. We’ll use your estimate for planning (shown with ≈) and ask for the real amount when you mark it paid. Paid history then shows how much it changed.'],
    ['My pay is different every time.',
      'When adding your income, choose <em>“An estimate”</em> and enter your usual or average pay. We plan with it (shown with ≈). Once each pay day arrives, Home and the Income page ask what actually came in, and your totals update to the real amount.'],
    ['How do I see what I’ve spent on groceries (or fuel) against what I set aside?',
      'Add groceries as a bill with the amount you allow each week (or fortnight, or month), and tick <em>“Track it with my spending”</em>. Then, whenever you add spending, choose <em>Groceries</em> under <em>“Counts towards a bill”</em>. The Spending page shows how much is left for the current week, grouped by account so you can compare it with what you moved into each account. Linked spending is counted once, inside the bill, not again as extra spending.'],
    ['What does “Paid automatically” do?',
      'For direct debits, tick it and the bill counts as paid on its due date without you doing anything. You can still edit the amount if it was different.'],
    ['What is “Set aside each pay”?',
      'It turns every bill into an amount per week, fortnight or month — so a $900 yearly rego becomes about $34.60 a fortnight. Move that much into each account every pay and the money will be there when bills arrive.'],
    ['Why use accounts?',
      'If you pay rent from one account and subscriptions from another, accounts let you see exactly how much each one needs.'],
    ['Can I stop a bill without deleting it?',
      'Yes — use pause (⏸) on the Bills page. It stays in your list but doesn’t count in totals or the calendar. Resume (▶) any time.'],
    ['Where is my data saved?',
      'Right now, only in this browser on this device. Use <em>Settings → Download backup</em> to keep a copy or move it to another device with <em>Restore backup</em>.'],
    ['I deleted something by mistake.',
      'Most deletions show an <strong>Undo</strong> button for a few seconds. After that, restore from a backup if you have one.'],
    ['Can I make the text bigger or change colours?',
      'Yes — <em>Settings → Look & accessibility</em> has text size, dark mode, high contrast, an easier-to-read font and reduced motion.']
  ];

  B.pages.help = {
    title: 'Help', icon: '❓',
    render(main) {
      const sample = { startDate: U.today(), amount: 100 };
      main.innerHTML = `
        <div class="page-head"><div><h1>Help & how it works</h1><p>Everything in plain English.</p></div></div>
        <div class="grid grid--2">
          <section class="card" aria-labelledby="h-start">
            <div class="card__head"><h2 id="h-start">Getting started in 3 steps</h2></div>
            <ol class="steps">
              <li><span class="grow"><strong>Add your income.</strong> Your pay and how often it comes in.</span></li>
              <li><span class="grow"><strong>Add your bills.</strong> Anything that repeats — pick how often and one due date.</span></li>
              <li><span class="grow"><strong>Tick them off.</strong> Mark bills paid as they go out and log other spending.</span></li>
            </ol>
            <p class="small muted" style="margin-top:14px">Then check <a href="#/insights">Insights</a> to see how each week, month or year is going.</p>
          </section>

          <section class="card" aria-labelledby="h-freq">
            <div class="card__head"><h2 id="h-freq">How often things can repeat</h2></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Option</th><th class="r">Times a year</th></tr></thead>
              <tbody>${R.FREQUENCIES.filter((f) => f.unit).map((f) => `<tr><td>${esc(f.label)}</td><td class="r">${(R.perYear(Object.assign({ frequency: f.id }, sample))).toFixed(f.unit === 'day' ? 1 : 0)}</td></tr>`).join('')}
                <tr><td>Custom</td><td class="r">Any — e.g. every 10 days, every 5 weeks, every 2 years</td></tr></tbody>
            </table></div>
          </section>

          <section class="card span-2" aria-labelledby="h-faq">
            <div class="card__head"><h2 id="h-faq">Questions</h2></div>
            ${FAQ.map(([q, a]) => `<details class="details"><summary>${q}</summary><p>${a}</p></details>`).join('')}
          </section>

          <section class="card span-2" aria-labelledby="h-keys">
            <div class="card__head"><h2 id="h-keys">Using a keyboard or screen reader</h2></div>
            <p>Press <kbd>Tab</kbd> to move between controls and <kbd>Enter</kbd> or <kbd>Space</kbd> to use them. <kbd>Esc</kbd> closes any pop-up. The first <kbd>Tab</kbd> on each page offers “Skip to content”. Every chart also has a text version for screen readers, and statuses like “Overdue” are always written out, not shown by colour alone.</p>
          </section>
        </div>`;
    }
  };
})(window.Budget);
