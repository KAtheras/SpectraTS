(() => {
  const isDesktop = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  if (!isDesktop) return;

  const TARGET_IDS = ['entry-date', 'expense-date', 'audit-filter-date'];
  const inputs = TARGET_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  // Bottom filter targets (hidden inputs) with anchors for positioning.
  const filterTargets = [
    {
      input: document.querySelector('#filter-form input[name="from"]'),
      anchor: document.querySelector('[data-filter-date="from"]'),
      body: '#entries-body',
      month: document.getElementById('filter-from-month'),
      day: document.getElementById('filter-from-day'),
      year: document.getElementById('filter-from-year'),
    },
    {
      input: document.querySelector('#filter-form input[name="to"]'),
      anchor: document.querySelector('[data-filter-date="to"]'),
      body: '#entries-body',
      month: document.getElementById('filter-to-month'),
      day: document.getElementById('filter-to-day'),
      year: document.getElementById('filter-to-year'),
    },
    {
      input: document.querySelector('#expense-filter-form input[name="from"]'),
      anchor: document.querySelector('[data-expense-filter-date="from"]'),
      body: '#expenses-body',
      month: document.getElementById('expense-filter-from-month'),
      day: document.getElementById('expense-filter-from-day'),
      year: document.getElementById('expense-filter-from-year'),
    },
    {
      input: document.querySelector('#expense-filter-form input[name="to"]'),
      anchor: document.querySelector('[data-expense-filter-date="to"]'),
      body: '#expenses-body',
      month: document.getElementById('expense-filter-to-month'),
      day: document.getElementById('expense-filter-to-day'),
      year: document.getElementById('expense-filter-to-year'),
    },
    {
      input: document.getElementById('audit-filter-date'),
      anchor: document.getElementById('audit-filter-date'),
      body: '#audit-table-body',
    },
  ].filter((t) => t.input && t.anchor);

  filterTargets.forEach((t) => {
    t.input.dataset.dpFilter = 'true';
    t.input._dpAnchor = t.anchor;
    t.input.dataset.dpBody = t.body;
    t.input._dpMonth = t.month;
    t.input._dpDay = t.day;
    t.input._dpYear = t.year;
    const handler = (e) => {
      e.preventDefault();
      openFor(t.input);
    };
    t.anchor.addEventListener('click', handler);
    t.anchor.addEventListener('focus', handler);
    [t.month, t.day, t.year]
      .filter(Boolean)
      .forEach((sel) => {
        sel.addEventListener('mousedown', handler);
        sel.addEventListener('click', handler);
        sel.addEventListener('focus', handler);
      });
    inputs.push(t.input);
  });
  if (!inputs.length) return;

  function formatDisplay(date) {
    return date
      ? date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })
      : '';
  }

  function setDisplay(input, date) {
    if (!input) return;
    const display = formatDisplay(date);
    input.dataset.display = display;
    if (input.dataset.dpFilter === 'true') {
      input.value = display;
    }
  }

  // Disable native desktop date picker for these inputs; keep mobile untouched.
  inputs.forEach((input) => {
    input.dataset.originalType = input.type || 'date';
    input.type = 'text';
    input.readOnly = true;
    input.classList.add('dp-desktop-date');
    const parsed = parseInput(input);
    setDisplay(input, parsed);
  });

  const popover = document.createElement('div');
  popover.className = 'dp-popover';
  popover.innerHTML = `
    <div class="dp-inner">
      <div class="dp-header">
        <button type="button" class="dp-nav" data-dir="-1" aria-label="Previous month">‹</button>
        <div class="dp-title"></div>
        <button type="button" class="dp-nav" data-dir="1" aria-label="Next month">›</button>
      </div>
      <div class="dp-week">${['Su','Mo','Tu','We','Th','Fr','Sa'].map((d)=>`<span>${d}</span>`).join('')}</div>
      <div class="dp-grid"></div>
    </div>
  `;
  document.body.appendChild(popover);

  let openInput = null;
  let viewDate = today();

  function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dateFromISO(iso) {
    const parts = iso ? iso.split('-').map(Number) : [];
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? new Date(y, m - 1, d)
      : null;
  }

  function parseDisplayedDate(text) {
    const digits = String(text || '').replace(/\D/g, '');
    if (digits.length === 8) {
      const month = digits.slice(0, 2);
      const day = digits.slice(2, 4);
      const year = digits.slice(4);
      const iso = `${year}-${month}-${day}`;
      return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    }
    if (digits.length === 6) {
      const month = digits.slice(0, 2);
      const day = digits.slice(2, 4);
      const year = `20${digits.slice(4)}`;
      const iso = `${year}-${month}-${day}`;
      return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    }
    return null;
  }

  function visibleRange(bodySelector) {
    const body = document.querySelector(bodySelector);
    if (!body) return null;
    const dates = Array.from(body.querySelectorAll('tr td:first-child'))
      .map((td) => parseDisplayedDate(td.textContent))
      .filter(Boolean);
    if (!dates.length) return null;
    const sorted = dates.sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }

  function parseInput(input) {
    const canonical = input.dataset.dpCanonical || input.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(canonical)) return null;
    const d = dateFromISO(canonical);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fireChange(el) {
    if (!el) return;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSelectsFromDate(input, date) {
    if (!input || !input._dpMonth || !input._dpDay || !input._dpYear || !date) return;
    input._dpMonth.value = String(date.getMonth() + 1).padStart(2, '0');
    input._dpDay.value = String(date.getDate()).padStart(2, '0');
    input._dpYear.value = String(date.getFullYear());
  }

  function setCanonicalFromSelects(input) {
    if (!input || !input._dpMonth || !input._dpDay || !input._dpYear) return;
    const m = input._dpMonth.value;
    const d = input._dpDay.value;
    const y = input._dpYear.value;
    if (m && d && y) {
      const fullYear = y.length === 2 ? `20${y}` : y;
      const iso = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        input.dataset.dpCanonical = iso;
        setDisplay(input, dateFromISO(iso));
      }
    }
  }

  function clampToBounds(d, input) {
    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const min = minAttr && /^\d{4}-\d{2}-\d{2}$/.test(minAttr) ? dateFromISO(minAttr) : null;
    const max = maxAttr && /^\d{4}-\d{2}-\d{2}$/.test(maxAttr) ? dateFromISO(maxAttr) : null;
    let date = d;
    if (min && date < min) date = min;
    if (max && date > max) date = max;
    return date;
  }

  function isDisabled(date, input) {
    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const min = minAttr && /^\d{4}-\d{2}-\d{2}$/.test(minAttr) ? dateFromISO(minAttr) : null;
    const max = maxAttr && /^\d{4}-\d{2}-\d{2}$/.test(maxAttr) ? dateFromISO(maxAttr) : null;
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
  }

  function render() {
    if (!openInput) return;
    const grid = popover.querySelector('.dp-grid');
    const title = popover.querySelector('.dp-title');
    grid.innerHTML = '';

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    title.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const selected = parseInput(openInput);
    const todayDate = today();

    for (let i = 0; i < startDay; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'dp-day dp-day--spacer';
      grid.appendChild(spacer);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dp-day';
      btn.textContent = String(day);
      if (selected && formatDate(date) === formatDate(selected)) {
        btn.classList.add('is-selected');
      }
      if (formatDate(date) === formatDate(todayDate)) {
        btn.classList.add('is-today');
      }
      const disabled = isDisabled(date, openInput);
      if (disabled) {
        btn.classList.add('is-disabled');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          const canonical = formatDate(date);
          openInput.dataset.dpCanonical = canonical;
          if (openInput.dataset.dpFilter === 'true') {
            openInput.value = formatDisplay(date);
            setSelectsFromDate(openInput, date);
            fireChange(openInput._dpMonth);
            fireChange(openInput._dpDay);
            fireChange(openInput._dpYear);
            const form = openInput.closest('form');
            const sibling = (name) => form?.elements?.namedItem(name);
            if (openInput.name === 'from') {
              const toInput = sibling('to');
              if (toInput) toInput.setAttribute('min', canonical);
            }
            if (openInput.name === 'to') {
              const fromInput = sibling('from');
              if (fromInput) fromInput.setAttribute('max', canonical);
            }
          } else {
            openInput.value = canonical;
          }
          setDisplay(openInput, date);
          openInput.dispatchEvent(new Event('input', { bubbles: true }));
          openInput.dispatchEvent(new Event('change', { bubbles: true }));
          closePopover();
        });
      }
      grid.appendChild(btn);
    }
  }

  function positionPopover(input) {
    const anchor = input._dpAnchor || input;
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    const left = rect.left + window.scrollX;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function openFor(input) {
    if (input.dataset.dpFilter === 'true') {
      setCanonicalFromSelects(input);
      const form = input.closest('form');
      const sibling = (name) => form?.elements?.namedItem(name);
      const fromVal = sibling('from')?.dataset?.dpCanonical || sibling('from')?.value || '';
      const toVal = sibling('to')?.dataset?.dpCanonical || sibling('to')?.value || '';
      if (input.name === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(fromVal)) {
        input.setAttribute('min', fromVal);
      }
      if (input.name === 'from' && /^\d{4}-\d{2}-\d{2}$/.test(toVal)) {
        input.setAttribute('max', toVal);
      }
    }
    if (input.dataset.dpBody) {
      // Use full source data range (stored on body as data attributes); fallback to visible range.
      const bodyEl = document.querySelector(input.dataset.dpBody);
      const sourceMin = bodyEl?.dataset?.rangeMin;
      const sourceMax = bodyEl?.dataset?.rangeMax;
      const isExpenseFilterBody = input.dataset.dpBody === '#expenses-body';
      const range = sourceMin && sourceMax
        ? { min: sourceMin, max: sourceMax }
        : isExpenseFilterBody
          ? { min: sourceMin || '', max: sourceMax || '' }
          : visibleRange(input.dataset.dpBody);
      let minVal = range?.min || '';
      let maxVal = range?.max || '';
      if (input.dataset.dpFilter === 'true') {
        const form = input.closest('form');
        const sibling = (name) => form?.elements?.namedItem(name);
        const fromVal = sibling('from')?.dataset?.dpCanonical || sibling('from')?.value || '';
        const toVal = sibling('to')?.dataset?.dpCanonical || sibling('to')?.value || '';
        if (input.name === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(fromVal)) {
          minVal = minVal ? (fromVal > minVal ? fromVal : minVal) : fromVal;
        }
        if (input.name === 'from' && /^\d{4}-\d{2}-\d{2}$/.test(toVal)) {
          maxVal = maxVal ? (toVal < maxVal ? toVal : maxVal) : toVal;
        }
      }
      if (minVal) input.setAttribute('min', minVal); else input.removeAttribute('min');
      if (maxVal) input.setAttribute('max', maxVal); else input.removeAttribute('max');
    }
    openInput = input;
    const parsed = parseInput(input) || today();
    viewDate = clampToBounds(parsed, input);
    positionPopover(input);
    popover.classList.add('is-open');
    render();
  }

  function closePopover() {
    openInput = null;
    popover.classList.remove('is-open');
  }

  popover.addEventListener('click', async (event) => {
    const dirBtn = event.target.closest('[data-dir]');
    if (dirBtn && openInput) {
      const dir = Number(dirBtn.dataset.dir);
      const nextViewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + dir, 1);
      const isExpenseFilterInput =
        openInput?.dataset?.dpFilter === 'true' &&
        openInput?.dataset?.dpBody === '#expenses-body';
      if (dir < 0 && isExpenseFilterInput) {
        const ensureHistory = window.expensesDeps?.ensureExpenseHistoryCoversDate;
        if (typeof ensureHistory === 'function') {
          try {
            await ensureHistory(formatDate(nextViewDate));
            if (typeof window.expensesDeps?.syncExpenseBodyDateRangeFromState === 'function') {
              window.expensesDeps.syncExpenseBodyDateRangeFromState();
            }
            openFor(openInput);
          } catch (error) {
            // Keep picker usable even if expansion fails.
          }
        }
      }
      viewDate = clampToBounds(nextViewDate, openInput);
      render();
    }
  });

  document.addEventListener('click', (event) => {
    if (!openInput) return;
    const target = event.target;
    if (popover.contains(target)) return;
    if (inputs.includes(target)) return;
    if (target.closest('[data-filter-date],[data-expense-filter-date]')) return;
    closePopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openInput) {
      closePopover();
    }
  });

  inputs.forEach((input) => {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', () => openFor(input));
    input.addEventListener('click', () => openFor(input));
  });

  function register(input) {
    if (!input || input.dataset.dpBound === 'true') return;
    input.dataset.dpBound = 'true';
    inputs.push(input);
    input.dataset.originalType = input.type || 'date';
    input.type = 'text';
    input.readOnly = true;
    input.classList.add('dp-desktop-date', 'bulk-date-input');
    const parsed = parseInput(input);
    setDisplay(input, parsed);
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', () => openFor(input));
    input.addEventListener('click', () => openFor(input));
  }

  function registerAll(root) {
    if (!root) return;
    const found = root.querySelectorAll('input[type=\"date\"], .bulk-date-input');
    found.forEach(register);
  }

  window.datePicker = {
    register,
    registerAll,
    close: closePopover,
  };
})();
