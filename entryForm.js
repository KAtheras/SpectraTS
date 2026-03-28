(function () {
  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function yearOptions(selectedYear, yearsBack) {
    const currentYear = new Date().getFullYear();
    const year = Number(selectedYear) || currentYear;
    const rangeBack = Number.isFinite(Number(yearsBack)) ? Number(yearsBack) : 0;
    const start = currentYear - Math.max(rangeBack, 0);
    const end = currentYear;
    const clampedYear = Math.min(Math.max(year, start), end);

    return {
      options: Array.from({ length: end - start + 1 }, function (_, index) {
        return String(start + index);
      }),
      selected: String(clampedYear),
    };
  }

  function setSelectOptions({ escapeHtml }, select, options, selectedValue) {
    select.innerHTML = options
      .map(function (option) {
        if (typeof option === "string") {
          return `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`;
        }

        return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
      })
      .join("");

    select.value = String(selectedValue);
  }

  function setSelectOptionsWithPlaceholder({ escapeHtml }, select, options, selectedValue, placeholder) {
    select.innerHTML =
      `<option value="">${escapeHtml(placeholder)}</option>` +
      options
        .map(function (option) {
          if (typeof option === "string") {
            return `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`;
          }

          return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
        })
        .join("");

    select.value = selectedValue || "";
  }

  function clampToToday(iso) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayIso = `${y}-${m}-${d}`;
    if (!iso) return todayIso;
    return iso > todayIso ? todayIso : iso;
  }

  function syncEntryDatePicker(deps, value) {
    const {
      isValidDateString,
      today,
      refs,
      field,
      MONTH_NAMES,
    } = deps;

    const safeValue = clampToToday(isValidDateString(value) ? value : today);
    const [yearTextRaw, monthTextRaw, dayTextRaw] = safeValue.split("-");
    const todayParts = today.split("-");
    const currentYear = Number(todayParts[0]);
    const currentMonth = Number(todayParts[1]);
    const currentDay = Number(todayParts[2]);

    const year = Number(yearTextRaw);
    const maxMonth = year === currentYear ? currentMonth : 12;
    const monthIndex = Math.min(Number(monthTextRaw), maxMonth) - 1;
    const monthValue = String(monthIndex + 1).padStart(2, "0");
    const day = Number(dayTextRaw);
    const maxDay =
      year === currentYear && monthIndex + 1 === currentMonth
        ? Math.min(currentDay, daysInMonth(year, monthIndex))
        : daysInMonth(year, monthIndex);
    const clampedDay = Math.min(day, maxDay);
    const nextValue = `${year}-${monthValue}-${String(clampedDay).padStart(2, "0")}`;

    setSelectOptions(
      deps,
      refs.entryDateMonth,
      MONTH_NAMES.slice(0, maxMonth).map(function (label, index) {
        return { value: String(index + 1).padStart(2, "0"), label };
      }),
      monthValue
    );
    const yearConfig = yearOptions(year, 1);
    setSelectOptions(deps, refs.entryDateYear, yearConfig.options, yearConfig.selected);
    setSelectOptions(
      deps,
      refs.entryDateDay,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      String(clampedDay).padStart(2, "0")
    );

    field(refs.form, "date").value = nextValue;
  }

  function filterDateRefs(refs, kind) {
    return kind === "from"
      ? {
          month: refs.filterFromMonth,
          day: refs.filterFromDay,
          year: refs.filterFromYear,
        }
      : {
          month: refs.filterToMonth,
          day: refs.filterToDay,
          year: refs.filterToYear,
        };
  }

  function syncFilterDatePicker(deps, kind, value) {
    const { isValidDateString, refs } = deps;
    const refsForKind = filterDateRefs(refs, kind);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year) {
      return;
    }

    const validValue = isValidDateString(value) ? value : "";
    const [yearText, monthText, dayText] = validValue ? validValue.split("-") : ["", "", ""];
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const maxDay = monthText && yearText ? daysInMonth(year, monthIndex) : 31;

    setSelectOptionsWithPlaceholder(
      deps,
      refsForKind.month,
      Array.from({ length: 12 }, function (_, index) {
        const value = String(index + 1).padStart(2, "0");
        return { value, label: value };
      }),
      monthText,
      "MM"
    );
    const yearConfig = yearOptions(yearText || new Date().getFullYear(), 2);
    setSelectOptionsWithPlaceholder(
      deps,
      refsForKind.year,
      yearConfig.options.map(function (option) {
        return { value: option, label: option.slice(-2) };
      }),
      yearText,
      "YY"
    );
    setSelectOptionsWithPlaceholder(
      deps,
      refsForKind.day,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      dayText,
      "DD"
    );
  }

  function updateEntryDateFromPicker(deps) {
    const { refs, field, isValidDateString, today } = deps;
    const todayParts = today.split("-");
    const currentYear = Number(todayParts[0]);
    const currentMonth = Number(todayParts[1]);
    const currentDay = Number(todayParts[2]);

    const year = Number(refs.entryDateYear.value);
    const rawMonth = Number(refs.entryDateMonth.value);
    const maxMonth = year === currentYear ? currentMonth : 12;
    const monthNum = Math.min(rawMonth, maxMonth);
    const month = String(monthNum).padStart(2, "0");
    const maxDay =
      year === currentYear && monthNum === currentMonth
        ? Math.min(currentDay, daysInMonth(year, monthNum - 1))
        : daysInMonth(year, monthNum - 1);
    const clampedDay = String(Math.min(Number(refs.entryDateDay.value), maxDay)).padStart(2, "0");

    setSelectOptions(
      deps,
      refs.entryDateDay,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      clampedDay
    );

    const nextValue = `${year}-${month}-${clampedDay}`;
    const clampedValue = clampToToday(isValidDateString(nextValue) ? nextValue : "");
    field(refs.form, "date").value = clampedValue;
  }

  function populateSelect(deps, select, options, placeholder, selectedValue) {
    const { uniqueValues, escapeHtml } = deps;
    const finalOptions = uniqueValues([
      ...(Array.isArray(options) ? options : []),
      selectedValue || "",
    ]);

    select.innerHTML =
      `<option value="">${escapeHtml(placeholder)}</option>` +
      finalOptions
        .map(
          (option) =>
            `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
        )
        .join("");

    select.value = selectedValue && finalOptions.includes(selectedValue) ? selectedValue : "";
  }

  function defaultEntryUser(state) {
    return state.currentUser ? state.currentUser.displayName : "";
  }

  function defaultFilterUser(state, isStaff) {
    return "";
  }

  function syncFormCatalogs(deps, selection) {
    const {
      refs,
      state,
      field,
      entryUserOptions,
      escapeHtml,
      assignedProjectTuplesForCurrentUser,
    } = deps;
    const comboField = refs.entryClientProject || document.getElementById("entry-client-project");
    const comboKey = "::";
    const encodeCombo = (client, project) =>
      `${encodeURIComponent(client)}${comboKey}${encodeURIComponent(project)}`;
    const decodeCombo = (value) => {
      const text = String(value || "");
      const splitAt = text.indexOf(comboKey);
      if (splitAt < 0) return ["", ""];
      return [
        decodeURIComponent(text.slice(0, splitAt) || ""),
        decodeURIComponent(text.slice(splitAt + comboKey.length) || ""),
      ];
    };
    const userField = field(refs.form, "user");
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    const authUsers = entryUserOptions();
    const defaultUser = defaultEntryUser(state);
    const userOptions = Array.from(new Set([defaultUser, ...authUsers].filter(Boolean)));
    const nextUser = defaultUser || authUsers[0] || "";
    let requestedClient = selection?.client;
    let requestedProject = selection?.project;
    if ((requestedClient === undefined || requestedProject === undefined) && comboField?.value) {
      const [comboClient, comboProject] = decodeCombo(comboField.value);
      if (requestedClient === undefined) requestedClient = comboClient;
      if (requestedProject === undefined) requestedProject = comboProject;
    }
    if (requestedClient === undefined) requestedClient = clientField?.value || "";
    if (requestedProject === undefined) requestedProject = projectField?.value || "";

    const assignedTuplesRaw =
      typeof assignedProjectTuplesForCurrentUser === "function"
        ? assignedProjectTuplesForCurrentUser()
        : [];
    const assignedTupleKeys = new Set();
    const assignedTuples = assignedTuplesRaw.filter((item) => {
      const clientName = item?.client || "";
      const projectName = item?.project || "";
      if (!clientName || !projectName) return false;
      const key = `${clientName}::${projectName}`;
      if (assignedTupleKeys.has(key)) return false;
      assignedTupleKeys.add(key);
      return true;
    });
    const clients = Array.from(new Set(assignedTuples.map((item) => item.client))).sort((a, b) =>
      a.localeCompare(b)
    );
    const nextClient = clients.includes(requestedClient) ? requestedClient : "";
    const projects = nextClient
      ? assignedTuples
          .filter((item) => item.client === nextClient)
          .map((item) => item.project)
          .sort((a, b) => a.localeCompare(b))
      : [];
    const nextProject = projects.includes(requestedProject) ? requestedProject : "";
    const comboOptions = clients.flatMap((clientName) =>
      assignedTuples
        .filter((item) => item.client === clientName)
        .map((item) => item.project)
        .sort((a, b) => a.localeCompare(b))
        .map((projectName) => ({
        label: `${clientName} / ${projectName}`,
        value: encodeCombo(clientName, projectName),
      }))
    );
    const selectedComboValue =
      nextClient && nextProject ? encodeCombo(nextClient, nextProject) : "";

    populateSelect(deps, userField, userOptions, "Select team member", nextUser);
    populateSelect(deps, clientField, clients, "Select client", nextClient);
    populateSelect(
      deps,
      projectField,
      projects,
      nextClient ? "Select project" : "Choose client first",
      nextProject
    );
    if (comboField) {
      comboField.innerHTML =
        `<option value="">${escapeHtml("Select client / project")}</option>` +
        comboOptions
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
          )
          .join("");
      comboField.value = comboOptions.some((option) => option.value === selectedComboValue)
        ? selectedComboValue
        : "";
      comboField.disabled = comboOptions.length === 0;
      if (!comboField.dataset.boundCombo) {
        comboField.addEventListener("change", function () {
          const [comboClient, comboProject] = decodeCombo(comboField.value);
          syncFormCatalogs(deps, {
            user: state.currentUser?.displayName || "",
            client: comboClient || "",
            project: comboProject || "",
          });
          clientField.dispatchEvent(new Event("change", { bubbles: true }));
          projectField.dispatchEvent(new Event("change", { bubbles: true }));
        });
        comboField.dataset.boundCombo = "true";
      }
    }

    userField.value = nextUser;
    userField.disabled = true;
    projectField.disabled = !nextClient;
  }

  function syncFilterCatalogs(deps, selection) {
    const {
      refs,
      state,
      field,
      uniqueValues,
      isStaff,
      isManager,
      isAdmin,
      defaultFilterUser,
      allowedClientsForUser,
      clientNames,
      allowedProjectsForClient,
      projectNames,
      populateSelect,
      formatDisplayDate,
      syncFilterDatePicker,
    } = deps;
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    const projectField = field(refs.filterForm, "project");
    const fromField = field(refs.filterForm, "from");
    const toField = field(refs.filterForm, "to");
    const searchField = field(refs.filterForm, "search");
    const entryUsers = uniqueValues(
      (state.entries || []).map((entry) => entry.user).filter(Boolean)
    );
    const userOptions = entryUsers;
    const defaultUser = defaultFilterUser(state, isStaff);
    const requestedUser = selection?.user ?? userField?.value ?? defaultUser;
    const nextUser =
      requestedUser === ""
        ? ""
        : userOptions.includes(requestedUser)
          ? requestedUser
          : userOptions[0] || "";
    const requestedClient = selection?.client ?? clientField?.value ?? "";
    const entryClients = uniqueValues(
      (state.entries || []).map((entry) => entry.client).filter(Boolean)
    );
    const targetUser =
      nextUser && state.users.length
        ? state.users.find((u) => u.displayName === nextUser) || state.currentUser
        : state.currentUser;

    const allowedClientsRaw = targetUser
      ? isAdmin(targetUser)
        ? clientNames()
        : allowedClientsForUser(targetUser)
      : clientNames();
    const allowedClientsFiltered = allowedClientsRaw.filter((client) =>
      entryClients.includes(client)
    );
    const allowedClients = allowedClientsFiltered;
    const nextClient = allowedClients.includes(requestedClient) ? requestedClient : "";
    const requestedProject = selection?.project ?? projectField?.value ?? "";
    const entryProjects = uniqueValues(
      (state.entries || [])
        .filter((entry) => !nextClient || entry.client === nextClient)
        .map((entry) => entry.project)
        .filter(Boolean)
    );
    const allowedProjectsRaw = nextClient
      ? targetUser && !isAdmin(targetUser)
        ? allowedProjectsForClient(targetUser, nextClient)
        : projectNames(nextClient)
      : targetUser && !isAdmin(targetUser)
        ? []
        : projectNames(nextClient);
    const allowedProjectsFiltered = allowedProjectsRaw.filter((project) =>
      entryProjects.includes(project)
    );
    const allowedProjects = allowedProjectsFiltered;
    const nextProject = allowedProjects.includes(requestedProject) ? requestedProject : "";

    populateSelect(deps, userField, userOptions, "All users", nextUser);
    populateSelect(deps, clientField, allowedClients, "All clients", nextClient);
    populateSelect(
      deps,
      projectField,
      allowedProjects,
      nextClient ? "All projects" : "Choose client first",
      nextProject
    );

    if (state.currentUser && isStaff(state.currentUser)) {
      userField.value = state.currentUser?.displayName || "";
      userField.disabled = true;
    } else {
      userField.disabled = false;
    }
    projectField.disabled = !nextClient;

    if (selection?.from !== undefined) {
      fromField.value = formatDisplayDate(selection.from);
    }
    if (selection?.to !== undefined) {
      toField.value = formatDisplayDate(selection.to);
    }
    syncFilterDatePicker(deps, "from", selection?.from || "");
    syncFilterDatePicker(deps, "to", selection?.to || "");
    if (selection?.search !== undefined) {
      searchField.value = selection.search;
    }
  }

  function renderHourSelection(deps) {
    const { refs, field } = deps;
    const hoursValue = String(field(refs.form, "hours").value || "");

    refs.hourPresets.querySelectorAll("[data-hours]").forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.hours === hoursValue);
    });
  }

  function handleHourPresetClick(deps, event) {
    const { refs, field } = deps;
    const button = event.target.closest("[data-hours]");
    if (!button) {
      return;
    }

    const hoursField = field(refs.form, "hours");
    hoursField.value = button.dataset.hours;
    refs.otherHours.value = "";
    renderHourSelection(deps);
  }

  function handleOtherHoursInput(deps) {
    const { refs, field } = deps;
    const hoursField = field(refs.form, "hours");
    hoursField.value = refs.otherHours.value;
    renderHourSelection(deps);
  }

  function positionBulkSave() {
    const actions = document.querySelector(".bulk-actions");
    if (!actions) return;
    if (actions.querySelector(".bulk-spacer")) return;
    const spacer = document.createElement("div");
    spacer.className = "bulk-spacer";
    spacer.style.flex = "1";
    spacer.style.minWidth = "8px";
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.insertBefore(spacer, actions.lastElementChild);
  }

  function tightenBulkSpacing() {
    const container = document.getElementById("bulk-entry-container");
    if (!container) return;
    const tableWrap = container.querySelector(".bulk-table-wrap");
    const actions = container.querySelector(".bulk-actions");
    if (!tableWrap || !actions) return;

    // Ensure both live in a single wrapper for controlled spacing.
    let section = container.querySelector(".bulk-section");
    if (!section) {
      section = document.createElement("div");
      section.className = "bulk-section";
      section.style.display = "flex";
      section.style.flexDirection = "column";
      section.style.gap = "6px";
      container.insertBefore(section, tableWrap);
      section.appendChild(tableWrap);
      if (actions.parentElement !== section) {
        section.appendChild(actions);
      }
    } else {
      section.style.display = "flex";
      section.style.flexDirection = "column";
      section.style.gap = "6px";
      if (tableWrap.parentElement !== section) section.insertBefore(tableWrap, section.firstChild);
      if (actions.parentElement !== section) section.appendChild(actions);
    }

    // Remove extra vertical margins so gap controls spacing.
    tableWrap.style.marginBottom = "0";
    actions.style.marginTop = "0";
  }

  function enforceBulkHoursWidth() {
    const table = document.querySelector(".bulk-entry-table");
    if (!table || table.dataset.hoursWidthObserver) return;

    const apply = () => {
      const targetWidth = "3.3rem"; // ~20% wider than previous 2.75rem
      const hoursHeader = table.querySelector("thead tr th:nth-child(4)");
      if (hoursHeader) {
        hoursHeader.style.width = targetWidth;
        hoursHeader.style.minWidth = targetWidth;
        hoursHeader.style.maxWidth = targetWidth;
      }
      table.querySelectorAll(".bulk-col-hours").forEach((cell) => {
        cell.style.width = targetWidth;
        cell.style.minWidth = targetWidth;
        cell.style.maxWidth = targetWidth;
      });
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(table, { childList: true, subtree: true });
    table.dataset.hoursWidthObserver = "true";
  }

  function wireEntryModeToggle(deps) {
    const { refs, toggleEntryMode } = deps;
    const btn = refs?.entryModeToggle;
    if (!btn || typeof toggleEntryMode !== "function") return;

    function setLabel(mode) {
      btn.dataset.mode = mode;
      btn.textContent = mode === "multiple" ? "Single entry" : "Multiple entry";
    }

    btn.addEventListener("click", function () {
      const current = btn.dataset.mode === "multiple" ? "multiple" : "single";
      const next = current === "multiple" ? "single" : "multiple";
      toggleEntryMode(next);
      setLabel(next);
      positionBulkSave();
      tightenBulkSpacing();
      if (next === "multiple") enforceBulkHoursWidth();
    });

    setLabel("single");
    positionBulkSave();
    tightenBulkSpacing();
    enforceBulkHoursWidth();
  }

  // Expense bulk toggle and container (Expenses tab only).
  function buildExpenseBulkContainer() {
    const form = document.getElementById("expense-form");
    if (!form) return null;
    const panel = form.closest(".panel");
    if (!panel) return null;
    const existing = document.getElementById("expense-bulk-container");
    if (existing) return existing;

    const container = document.createElement("div");
    container.id = "expense-bulk-container";
    container.className = "bulk-entry-container";
    container.hidden = true;
    container.innerHTML = `
      <div class="bulk-section" style="display:flex;flex-direction:column;gap:6px;">
        <div class="bulk-table-wrap" style="margin-bottom:0;">
          <table class="bulk-entry-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Project</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Billable</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="expense-bulk-body"></tbody>
          </table>
        </div>
        <div class="bulk-actions" style="margin-top:0;display:flex;align-items:center;gap:0.5rem;justify-content:flex-start;">
          <button type="button" class="button button-ghost" id="expense-bulk-add-row">+ Add row</button>
          <div style="flex:1"></div>
          <button type="button" class="button button-primary" id="expense-bulk-save">Save</button>
        </div>
      </div>
    `;
    panel.appendChild(container);

    const saveBtn = container.querySelector("#expense-bulk-save");
    if (saveBtn && window.saveBulkExpenses) {
      saveBtn.addEventListener("click", window.saveBulkExpenses);
    }

    return container;
  }

  function wireExpenseModeToggle() {
    const form = document.getElementById("expense-form");
    if (!form) return;
    const panel = form.closest(".panel");
    const panelHeadActions = panel?.querySelector(".panel-head-actions");
    if (!panelHeadActions) return;

    let toggleBtn = document.getElementById("expense-mode-toggle");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.id = "expense-mode-toggle";
      toggleBtn.type = "button";
      toggleBtn.className = "button button-ghost entry-mode-button";
      panelHeadActions.insertBefore(toggleBtn, panelHeadActions.firstChild);
    }

    const bulkContainer = buildExpenseBulkContainer();
    if (!bulkContainer) return;
    // Ensure rows/render/listeners are ready even before first toggle.
    if (window.bulkExpenses?.init) {
      window.bulkExpenses.init();
    }

    const setLabel = (mode) => {
      toggleBtn.dataset.mode = mode;
      toggleBtn.textContent = mode === "multiple" ? "Single entry" : "Multiple entry";
    };

    const showMode = (mode) => {
      const isMultiple = mode === "multiple";
      form.hidden = isMultiple;
      bulkContainer.hidden = !isMultiple;
      setLabel(mode);
      if (isMultiple && window.bulkExpenses?.init) {
        window.bulkExpenses.init();
      }
    };

    toggleBtn.addEventListener("click", () => {
      const current = toggleBtn.dataset.mode === "multiple" ? "multiple" : "single";
      const next = current === "multiple" ? "single" : "multiple";
      showMode(next);
    });

    showMode("single");
  }

  wireExpenseModeToggle();

  window.entryForm = {
    daysInMonth,
    yearOptions,
    setSelectOptions,
    setSelectOptionsWithPlaceholder,
    syncEntryDatePicker,
    filterDateRefs,
    syncFilterDatePicker,
    updateEntryDateFromPicker,
    populateSelect,
    syncFormCatalogs,
    syncFilterCatalogs,
    renderHourSelection,
    defaultEntryUser,
    defaultFilterUser,
    handleHourPresetClick,
    handleOtherHoursInput,
    wireEntryModeToggle,
    positionBulkSave,
    wireExpenseModeToggle,
  };
})();
