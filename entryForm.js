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

  function syncEntryDatePicker(deps, value) {
    const {
      isValidDateString,
      today,
      refs,
      field,
      MONTH_NAMES,
    } = deps;

    const safeValue = isValidDateString(value) ? value : today;
    const [yearText, monthText, dayText] = safeValue.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const day = Number(dayText);
    const maxDay = daysInMonth(year, monthIndex);
    const clampedDay = Math.min(day, maxDay);
    const nextValue = `${yearText}-${monthText}-${String(clampedDay).padStart(2, "0")}`;

    setSelectOptions(deps, refs.entryDateMonth, MONTH_NAMES.map(function (label, index) {
      return { value: String(index + 1).padStart(2, "0"), label };
    }), monthText);
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
    const { refs, field } = deps;
    const year = refs.entryDateYear.value;
    const month = refs.entryDateMonth.value;
    const day = refs.entryDateDay.value;
    const maxDay = daysInMonth(Number(year), Number(month) - 1);
    const clampedDay = String(Math.min(Number(day), maxDay)).padStart(2, "0");

    setSelectOptions(
      deps,
      refs.entryDateDay,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      clampedDay
    );

    field(refs.form, "date").value = `${year}-${month}-${clampedDay}`;
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
      visibleCatalogClientNames,
      visibleCatalogProjectNames,
      isStaff,
    } = deps;
    const userField = field(refs.form, "user");
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    const authUsers = entryUserOptions();
    const defaultUser = defaultEntryUser(state);
    const requestedUser = selection?.user ?? userField?.value ?? defaultUser;
    const nextUser =
      requestedUser === ""
        ? ""
        : authUsers.includes(requestedUser)
          ? requestedUser
          : authUsers[0] || "";
    const requestedClient = selection?.client ?? clientField?.value ?? "";
    const clients = visibleCatalogClientNames();
    const nextClient = clients.includes(requestedClient) ? requestedClient : "";
    const requestedProject = selection?.project ?? projectField?.value ?? "";
    const projects = nextClient ? visibleCatalogProjectNames(nextClient) : [];
    const nextProject = projects.includes(requestedProject) ? requestedProject : "";

    populateSelect(deps, userField, authUsers, "Select team member", nextUser);
    populateSelect(deps, clientField, clients, "Select client", nextClient);
    populateSelect(
      deps,
      projectField,
      projects,
      nextClient ? "Select project" : "Choose client first",
      nextProject
    );

    if (state.currentUser && isStaff(state.currentUser)) {
      userField.value = state.currentUser.displayName || "";
      userField.disabled = true;
    } else {
      userField.disabled = false;
    }
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
      availableUsers,
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
    const authUsers = state.currentUser
      ? isStaff(state.currentUser)
        ? [state.currentUser.displayName]
        : isManager(state.currentUser)
          ? state.users
              .filter((user) => isStaff(user) || user.id === state.currentUser.id)
              .map((user) => user.displayName)
              .filter(Boolean)
          : availableUsers()
      : availableUsers();
    const filteredUsers = authUsers.filter((user) => entryUsers.includes(user));
    const userOptions = filteredUsers.length ? filteredUsers : authUsers;
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
    const allowedClientsRaw = state.currentUser
      ? isAdmin(state.currentUser)
        ? clientNames()
        : allowedClientsForUser(state.currentUser)
      : clientNames();
    const allowedClientsFiltered = allowedClientsRaw.filter((client) =>
      entryClients.includes(client)
    );
    const allowedClients = allowedClientsFiltered.length ? allowedClientsFiltered : allowedClientsRaw;
    const nextClient = allowedClients.includes(requestedClient) ? requestedClient : "";
    const requestedProject = selection?.project ?? projectField?.value ?? "";
    const entryProjects = uniqueValues(
      (state.entries || [])
        .filter((entry) => !nextClient || entry.client === nextClient)
        .map((entry) => entry.project)
        .filter(Boolean)
    );
    const allowedProjectsRaw = nextClient
      ? state.currentUser && !isAdmin(state.currentUser)
        ? allowedProjectsForClient(state.currentUser, nextClient)
        : projectNames(nextClient)
      : state.currentUser && !isAdmin(state.currentUser)
        ? []
        : projectNames(nextClient);
    const allowedProjectsFiltered = allowedProjectsRaw.filter((project) =>
      entryProjects.includes(project)
    );
    const allowedProjects = allowedProjectsFiltered.length
      ? allowedProjectsFiltered
      : allowedProjectsRaw;
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
  };
})();
