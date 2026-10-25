/* =========================================================
   components.js — Reusable pieces of interface:
   modal forms, confirm dialogs, toasts, badges, simple charts.
   ========================================================= */
window.Budget = window.Budget || {};

(function (B) {
  const U = B.utils;
  const esc = U.esc;
  const ui = {};

  /* =========================================================
     Toasts (announced to screen readers)
     ========================================================= */
  ui.toast = (message, opts = {}) => {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (opts.type ? ' toast--' + opts.type : '');
    el.setAttribute('role', opts.type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span>${esc(message)}</span>`;
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--ghost btn--sm';
      b.textContent = opts.action.label;
      b.onclick = () => { opts.action.fn(); remove(); };
      el.appendChild(b);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-btn';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '✕';
    close.onclick = () => remove();
    el.appendChild(close);
    host.appendChild(el);
    const remove = () => { el.classList.add('toast--out'); setTimeout(() => el.remove(), 200); };
    setTimeout(remove, opts.duration || (opts.action ? 7000 : 3500));
  };

  /** Toast with an Undo button. */
  ui.undoToast = (message, undo) => ui.toast(message, { action: { label: 'Undo', fn: () => { undo(); ui.toast('Restored'); } } });

  /* =========================================================
     Dialog base (native <dialog> = built-in focus trap + Esc)
     ========================================================= */
  function openDialog(html, { size = '', onClose, labelId } = {}) {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal' + (size ? ' modal--' + size : '');
    if (labelId) dlg.setAttribute('aria-labelledby', labelId);
    dlg.innerHTML = html;
    document.body.appendChild(dlg);
    const returnFocus = document.activeElement;
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (onClose) onClose(dlg.returnValue);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); }); // click backdrop
    dlg.showModal();
    return dlg;
  }
  ui.openDialog = openDialog;

  ui.confirm = ({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) =>
    new Promise((resolve) => {
      const id = 'dlg-' + U.uid();
      const dlg = openDialog(`
        <form method="dialog" class="modal__inner">
          <header class="modal__head"><h2 id="${id}">${esc(title)}</h2></header>
          <div class="modal__body"><p>${esc(message)}</p></div>
          <footer class="modal__foot">
            <button value="cancel" class="btn btn--ghost">Cancel</button>
            <button value="ok" class="btn ${danger ? 'btn--danger' : 'btn--primary'}">${esc(confirmLabel)}</button>
          </footer>
        </form>`, { size: 'sm', labelId: id, onClose: (v) => resolve(v === 'ok') });
      dlg.querySelector('[value="ok"]').focus();
    });

  /* =========================================================
     Form builder
     field: { name, label, type, options, required, help, placeholder,
              when(values) → bool, min, max, step, compute(values) → html,
              fields (for type 'row'), full (wide) }
     types: text, email, password, money, number, date, select,
            textarea, checkbox, color, icon, segmented, preview, row, note
     ========================================================= */
  function fieldHTML(f, values, formId) {
    if (f.type === 'row') {
      return `<div class="form-row" data-when="${f.when ? f.name || '' : ''}" data-field="${esc(f.name || '')}">${f.fields.map((x) => fieldHTML(x, values, formId)).join('')}</div>`;
    }
    const id = `${formId}-${f.name}`;
    const v = values[f.name] ?? f.default ?? '';
    const help = f.help ? `<p class="field__help" id="${id}-help">${f.help}</p>` : '';
    const described = `aria-describedby="${f.help ? id + '-help ' : ''}${id}-err"`;
    const req = f.required ? 'required aria-required="true"' : '';
    const label = `<label for="${id}" class="field__label">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="optional">(optional)</span>'}</label>`;
    let input = '';

    switch (f.type) {
      case 'note':
        return `<div class="field field--note" data-field="${esc(f.name)}">${f.html}</div>`;
      case 'preview':
        return `<div class="field field--preview" data-field="${esc(f.name)}" aria-live="polite"><div class="preview" data-preview="${esc(f.name)}"></div></div>`;
      case 'checkbox':
        return `<div class="field field--check" data-field="${esc(f.name)}">
          <label class="check"><input type="checkbox" id="${id}" name="${esc(f.name)}" ${v ? 'checked' : ''} ${described}>
          <span>${esc(f.label)}</span></label>${help}<p class="field__err" id="${id}-err"></p></div>`;
      case 'segmented':
        return `<fieldset class="field" data-field="${esc(f.name)}"><legend class="field__label">${esc(f.label)}</legend>
          <div class="segmented">${f.options.map((o, i) => `
            <label class="segmented__opt"><input type="radio" name="${esc(f.name)}" value="${esc(o.value)}" ${String(v || f.options[0].value) === String(o.value) ? 'checked' : ''}>
            <span>${esc(o.label)}</span></label>`).join('')}</div>${help}</fieldset>`;
      case 'select':
        input = `<select id="${id}" name="${esc(f.name)}" ${req} ${described}>
          ${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}
          ${(typeof f.options === 'function' ? f.options() : f.options).map((o) =>
            `<option value="${esc(o.value)}" ${String(v) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>`;
        break;
      case 'textarea':
        input = `<textarea id="${id}" name="${esc(f.name)}" rows="3" ${req} ${described} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
        break;
      case 'money':
        input = `<div class="input-affix"><span aria-hidden="true">${esc(U.currencySymbol())}</span><input id="${id}" name="${esc(f.name)}" type="number" inputmode="decimal" step="0.01" min="${f.min ?? 0}" value="${esc(v)}" ${req} ${described} placeholder="${esc(f.placeholder || '0.00')}"></div>`;
        break;
      case 'color':
        input = `<div class="swatches" role="radiogroup" aria-label="${esc(f.label)}">${B.store.PALETTE.map((c) => `
          <label class="swatch" style="--c:${c}"><input type="radio" name="${esc(f.name)}" value="${c}" ${String(v || B.store.PALETTE[0]) === c ? 'checked' : ''}><span class="sr-only">${c}</span></label>`).join('')}</div>`;
        return `<fieldset class="field" data-field="${esc(f.name)}"><legend class="field__label">${esc(f.label)}</legend>${input}</fieldset>`;
      default:
        input = `<input id="${id}" name="${esc(f.name)}" type="${f.type === 'icon' ? 'text' : f.type || 'text'}"
          ${f.type === 'number' ? `inputmode="numeric" step="${f.step || 1}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}` : ''}
          ${f.type === 'icon' ? 'maxlength="4" class="input-icon"' : ''}
          ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''}
          value="${esc(v)}" ${req} ${described} placeholder="${esc(f.placeholder || '')}">`;
    }
    return `<div class="field${f.full ? ' field--full' : ''}" data-field="${esc(f.name)}">${label}${input}${help}<p class="field__err" id="${id}-err"></p></div>`;
  }

  function flatFields(fields) {
    return fields.flatMap((f) => (f.type === 'row' ? f.fields : [f]));
  }

  function readValues(form, fields) {
    const v = {};
    flatFields(fields).forEach((f) => {
      if (['note', 'preview'].includes(f.type)) return;
      const els = form.elements[f.name];
      if (!els) return;
      if (f.type === 'checkbox') v[f.name] = els.checked;
      else if (f.type === 'segmented' || f.type === 'color') v[f.name] = (form.querySelector(`[name="${f.name}"]:checked`) || {}).value || '';
      else if (f.type === 'money' || f.type === 'number') v[f.name] = els.value === '' ? '' : Number(els.value);
      else v[f.name] = els.value.trim ? els.value.trim() : els.value;
    });
    return v;
  }

  /**
   * ui.form({ title, intro, fields, values, submitLabel, onSubmit, danger: {label, onClick} })
   * onSubmit(values) may throw Error('message') to show an error and keep the form open.
   */
  ui.form = ({ title, intro = '', fields, values = {}, submitLabel = 'Save', onSubmit, extra, size = '' }) => {
    const formId = 'f' + Math.random().toString(36).slice(2, 8);
    const titleId = formId + '-title';
    const dlg = openDialog(`
      <form class="modal__inner" novalidate>
        <header class="modal__head">
          <h2 id="${titleId}">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">✕</button>
        </header>
        <div class="modal__body">
          ${intro ? `<p class="muted">${intro}</p>` : ''}
          <div class="form-error" role="alert" hidden></div>
          ${fields.map((f) => fieldHTML(f, values, formId)).join('')}
        </div>
        <footer class="modal__foot">
          ${extra ? `<button type="button" class="btn ${extra.danger ? 'btn--danger-ghost' : 'btn--ghost'} mr-auto" data-extra>${esc(extra.label)}</button>` : ''}
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">${esc(submitLabel)}</button>
        </footer>
      </form>`, { size, labelId: titleId });

    const form = dlg.querySelector('form');
    const all = flatFields(fields).concat(fields.filter((f) => f.type === 'row'));

    const refresh = () => {
      const v = readValues(form, fields);
      all.forEach((f) => {
        const wrap = form.querySelector(`[data-field="${f.name}"]`);
        if (!wrap) return;
        if (f.when) {
          const show = !!f.when(v);
          wrap.hidden = !show;
          wrap.querySelectorAll('input,select,textarea').forEach((i) => (i.disabled = !show));
        }
        if (f.type === 'preview') wrap.querySelector('.preview').innerHTML = f.compute(v) || '';
      });
    };
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    refresh();

    dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close('cancel')));
    if (extra) dlg.querySelector('[data-extra]').onclick = () => { dlg.close('extra'); extra.onClick(); };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = readValues(form, fields);
      // validate
      let firstBad = null;
      flatFields(fields).forEach((f) => {
        const wrap = form.querySelector(`[data-field="${f.name}"]`);
        const err = wrap && wrap.querySelector('.field__err');
        if (!err) return;
        let msg = '';
        const hidden = !!wrap.closest('[hidden]');
        if (!hidden) {
          if (f.required && (v[f.name] === '' || v[f.name] == null)) msg = `${f.label} is required.`;
          else if ((f.type === 'money' || f.type === 'number') && v[f.name] !== '' && f.min != null && v[f.name] < f.min) msg = `${f.label} must be at least ${f.min}.`;
          else if (f.validate) msg = f.validate(v[f.name], v) || '';
        }
        err.textContent = msg;
        const input = wrap.querySelector('input,select,textarea');
        if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (msg && !firstBad) firstBad = input;
      });
      if (firstBad) { firstBad.focus(); return; }

      const errBox = form.querySelector('.form-error');
      try {
        const res = await onSubmit(v);
        if (res === false) return;
        dlg.close('ok');
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err.message || 'Something went wrong.';
        errBox.focus && errBox.setAttribute('tabindex', '-1');
        errBox.focus();
      }
    });

    const first = form.querySelector('.modal__body input:not([type=hidden]):not([disabled]), .modal__body select, .modal__body textarea');
    if (first) first.focus();
    return dlg;
  };

  /* =========================================================
     Small display helpers
     ========================================================= */
  ui.badge = (status, text) =>
    `<span class="badge badge--${status}">${esc(text || B.calc.STATUS_LABEL[status] || status)}</span>`;

  ui.dot = (color) => `<span class="dot" style="--c:${esc(color)}" aria-hidden="true"></span>`;

  ui.chip = (item, type) => {
    const x = type === 'account' ? B.calc.account(item) : B.calc.category(item);
    return `<span class="chip" style="--c:${esc(x.color)}">${type === 'category' && x.icon ? `<span aria-hidden="true">${esc(x.icon)}</span>` : ui.dot(x.color)}${esc(x.name)}</span>`;
  };

  ui.empty = ({ icon = '🗂️', title, text = '', action = '' }) => `
    <div class="empty">
      <div class="empty__icon" aria-hidden="true">${icon}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p class="muted">${text}</p>` : ''}
      ${action}
    </div>`;

  ui.progress = (pct, { color = 'var(--primary)', label = '' } = {}) => {
    const p = Math.max(0, Math.min(100, pct));
    const over = pct > 100;
    return `<div class="progress${over ? ' progress--over' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(pct, 999))}" ${label ? `aria-label="${esc(label)}"` : ''}>
      <span style="width:${p}%;--c:${over ? 'var(--danger)' : color}"></span></div>`;
  };

  /** Horizontal bars: rows [{ label, value, color, icon, sub }] */
  ui.hbars = (rows, { format = (v) => U.money(v), emptyText = 'Nothing to show yet.' } = {}) => {
    const total = U.sum(rows, (r) => r.value);
    if (!rows.length || total <= 0) return `<p class="muted">${emptyText}</p>`;
    const max = Math.max(...rows.map((r) => r.value));
    return `<ul class="hbars">${rows.map((r) => `
      <li class="hbars__row">
        <div class="hbars__label">${r.icon ? `<span aria-hidden="true">${esc(r.icon)}</span>` : ui.dot(r.color)}<span>${esc(r.label)}</span></div>
        <div class="hbars__track" aria-hidden="true"><span style="width:${(r.value / max) * 100}%;--c:${esc(r.color)}"></span></div>
        <div class="hbars__val"><strong>${format(r.value)}</strong><span class="muted">${U.pct(r.value, total)}%</span></div>
      </li>`).join('')}</ul>`;
  };

  /** Vertical grouped columns: groups [{ label, values: [n, n] }], series [{ name, color }] */
  ui.columns = (groups, series, { format = (v) => U.money(v, { whole: true }), caption = '' } = {}) => {
    const max = Math.max(1, ...groups.flatMap((g) => g.values));
    const legend = `<div class="legend">${series.map((s) => `<span>${ui.dot(s.color)}${esc(s.name)}</span>`).join('')}</div>`;
    const cols = groups.map((g) => `
      <div class="cols__group${g.current ? ' is-current' : ''}">
        <div class="cols__bars" aria-hidden="true">
          ${g.values.map((v, i) => `<span class="cols__bar" style="height:${(v / max) * 100}%;--c:${series[i].color}" title="${esc(series[i].name)}: ${format(v)}"></span>`).join('')}
        </div>
        <div class="cols__label">${esc(g.label)}</div>
      </div>`).join('');
    const table = `<table class="sr-only"><caption>${esc(caption)}</caption>
      <thead><tr><th>Period</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${groups.map((g) => `<tr><th>${esc(g.label)}</th>${g.values.map((v) => `<td>${format(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `${legend}<div class="cols" style="--n:${groups.length}">${cols}</div>${table}`;
  };

  /** Stat tile */
  ui.stat = ({ label, value, sub = '', tone = '' }) => `
    <div class="stat${tone ? ' stat--' + tone : ''}">
      <div class="stat__label">${esc(label)}</div>
      <div class="stat__value">${value}</div>
      ${sub ? `<div class="stat__sub">${sub}</div>` : ''}
    </div>`;

  /** Accessible tabs markup; page handles clicks via data-tab. */
  ui.tabs = (items, active, name = 'tab') => `
    <div class="tabs" role="tablist">${items.map((t) => `
      <button type="button" role="tab" class="tabs__tab" aria-selected="${t.id === active}" data-${name}="${esc(t.id)}">${esc(t.label)}</button>`).join('')}
    </div>`;

  /** Options helpers for selects */
  ui.categoryOptions = () => B.store.list('categories').map((c) => ({ value: c.id, label: `${c.icon || ''} ${c.name}`.trim() }));
  ui.accountOptions = () => B.store.list('accounts').map((a) => ({ value: a.id, label: a.name }));

  B.ui = ui;
})(window.Budget);
