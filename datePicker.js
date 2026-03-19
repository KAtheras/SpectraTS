(() => {
  const isDesktop = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  if (!isDesktop) return;

  const TARGET_IDS = ['entry-date', 'expense-date'];
  const inputs = TARGET_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!inputs.length) return;

  function setDisplay(input, date) {
    if (!input) return;
    const display = date
      ? date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })
      : '';
    input.dataset.display = display;
    const sibling = input.nextElementSibling;
    if (sibling && sibling.classList.contains('dp-display-date')) {
      sibling.textContent = display;
    }
  }

  // Disable native desktop date picker for these inputs; keep mobile untouched.
  inputs.forEach((input) => {
    input.dataset.originalType = input.type || 'date';
    input.type = 'text';
    input.readOnly = true;
    input.classList.add('dp-desktop-date');
    const parent = input.parentElement;
    if (parent) {
      parent.classList.add('dp-date-wrapper');
    }
    const displayEl = document.createElement('span');
    displayEl.className = 'dp-display-date';
    input.insertAdjacentElement('afterend', displayEl);
    const parsed = parseInput(input);
    setDisplay(input, parsed);
    displayEl.textContent = input.dataset.display || '';
    displayEl.addEventListener('click', () => {
      input.focus();
      openFor(input);
    });
    input.addEventListener('change', () => {
      setDisplay(input, parseInput(input));
      displayEl.textContent = input.dataset.display || '';
    });
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

  function parseInput(input) {
    const val = input.value;
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(val)) return null;
    const d = new Date(val + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function clampToBounds(d, input) {
    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const min = minAttr && /^\\d{4}-\\d{2}-\\d{2}$/.test(minAttr) ? new Date(minAttr + 'T00:00:00') : null;
    const max = maxAttr && /^\\d{4}-\\d{2}-\\d{2}$/.test(maxAttr) ? new Date(maxAttr + 'T00:00:00') : null;
    let date = d;
    if (min && date < min) date = min;
    if (max && date > max) date = max;
    return date;
  }

  function isDisabled(date, input) {
    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const min = minAttr && /^\\d{4}-\\d{2}-\\d{2}$/.test(minAttr) ? new Date(minAttr + 'T00:00:00') : null;
    const max = maxAttr && /^\\d{4}-\\d{2}-\\d{2}$/.test(maxAttr) ? new Date(maxAttr + 'T00:00:00') : null;
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
        openInput.value = formatDate(date);
        setDisplay(openInput, date);
        const displaySibling = openInput.nextElementSibling;
        if (displaySibling && displaySibling.classList.contains('dp-display-date')) {
          displaySibling.textContent = openInput.dataset.display || '';
        }
        openInput.dispatchEvent(new Event('input', { bubbles: true }));
        openInput.dispatchEvent(new Event('change', { bubbles: true }));
        closePopover();
      });
    }
      grid.appendChild(btn);
    }
  }

  function positionPopover(input) {
    const rect = input.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    const left = rect.left + window.scrollX;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function openFor(input) {
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

  popover.addEventListener('click', (event) => {
    const dirBtn = event.target.closest('[data-dir]');
    if (dirBtn && openInput) {
      const dir = Number(dirBtn.dataset.dir);
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + dir, 1);
      viewDate = clampToBounds(viewDate, openInput);
      render();
    }
  });

  document.addEventListener('click', (event) => {
    if (!openInput) return;
    if (popover.contains(event.target)) return;
    if (inputs.includes(event.target)) return;
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
})();
