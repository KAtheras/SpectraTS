(function () {
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const body = document.body;
  const embedded = window.self !== window.top || window.location.search.includes("embed=1");
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const {
    AUTH_API_PATH,
    STATE_API_PATH,
    MUTATE_API_PATH,
    loadSessionToken,
    saveSessionToken,
    requestJson,
    requestAuth,
  } = window.api || {};
  const {
    projectKey,
    uniqueValues,
    isValidDateString,
    normalizeLevel,
    normalizeUser,
    buildProjectMetaMap,
    normalizeProjects,
    buildProjectsFromCatalog,
    normalizeAssignments,
    formatDate,
    normalizeDisplayDateInput,
  } = window.utils || {};
  const {
    openCatalogModal: catalogOpenCatalogModal,
    closeCatalogModal: catalogCloseCatalogModal,
    renderCatalogLists,
  } = window.catalog || {};
  const {
    openMembersModal: membersOpenMembersModal,
    closeMembersModal: membersCloseMembersModal,
    renderMembersModal: membersRenderMembersModal,
  } = window.membersModal || {};
  const {
    openUsersModal: usersOpenUsersModal,
    closeUsersModal: usersCloseUsersModal,
    setUserFeedback: usersSetUserFeedback,
    renderUsersList: usersRenderUsersList,
    syncUserManagementControls: usersSyncUserManagementControls,
  } = window.usersModal || {};
  const {
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
  } = window.entryForm || {};
  const { createAccessControl } = window.accessControl || {};

  const DEFAULT_CLIENT_PROJECTS = {
    ISTO: ["Bright Start", "Bright Directions", "ABLE", "Secure Choice"],
  };

  const refs = {
    authShell: document.getElementById("auth-shell"),
    appShell: document.getElementById("app-shell"),
    authSubtext: document.getElementById("auth-subtext"),
    loginForm: document.getElementById("login-form"),
    bootstrapForm: document.getElementById("bootstrap-form"),
    authFeedback: document.getElementById("auth-feedback"),
    form: document.getElementById("entry-form"),
    formHeading: document.getElementById("form-heading"),
    cancelEdit: document.getElementById("cancel-edit"),
    sessionIndicator: document.getElementById("session-indicator"),
    accountName: document.getElementById("account-name"),
    manageUsers: document.getElementById("manage-users"),
    logoutButton: document.getElementById("logout-button"),
    themeToggle: document.getElementById("theme-toggle"),
    openCatalog: document.getElementById("open-catalog"),
    closeCatalog: document.getElementById("close-catalog"),
    catalogModal: document.getElementById("catalog-modal"),
    usersModal: document.getElementById("users-modal"),
    membersModal: document.getElementById("members-modal"),
    closeUsers: document.getElementById("close-users"),
    closeMembers: document.getElementById("close-members"),
    hourPresets: document.getElementById("hour-presets"),
    otherHours: document.getElementById("other-hours"),
    entryDateMonth: document.getElementById("entry-date-month"),
    entryDateDay: document.getElementById("entry-date-day"),
    entryDateYear: document.getElementById("entry-date-year"),
    submitEntry: document.getElementById("submit-entry"),
    addClientForm: document.getElementById("add-client-form"),
    addProjectForm: document.getElementById("add-project-form"),
    addUserForm: document.getElementById("add-user-form"),
    levelLabelsForm: document.getElementById("level-labels-form"),
    filterForm: document.getElementById("filter-form"),
    clearFilters: document.getElementById("clear-filters"),
    exportCsv: document.getElementById("export-csv"),
    filterTotalHours: document.getElementById("filter-total-hours"),
    feedback: document.getElementById("feedback"),
    activeFilters: document.getElementById("active-filters"),
    entriesBody: document.getElementById("entries-body"),
    clientList: document.getElementById("client-list"),
    projectList: document.getElementById("project-list"),
    projectColumnLabel: document.getElementById("project-column-label"),
    userList: document.getElementById("user-list"),
    userFeedback: document.getElementById("user-feedback"),
    membersList: document.getElementById("members-list"),
    membersTitle: document.getElementById("members-modal-title"),
    membersSubtext: document.getElementById("members-modal-subtext"),
    membersFeedback: document.getElementById("members-feedback"),
    membersConfirm: document.getElementById("members-confirm"),
    membersCancel: document.getElementById("members-cancel"),
    filterFromMonth: document.getElementById("filter-from-month"),
    filterFromDay: document.getElementById("filter-from-day"),
    filterFromYear: document.getElementById("filter-from-year"),
    filterToMonth: document.getElementById("filter-to-month"),
    filterToDay: document.getElementById("filter-to-day"),
    filterToYear: document.getElementById("filter-to-year"),
  };

  const today = formatDate(new Date());

  const state = {
    catalog: {},
    entries: [],
    filters: {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    },
    editingId: null,
    selectedCatalogClient: "",
    sessionToken: loadSessionToken(),
    currentUser: null,
    users: [],
    bootstrapRequired: false,
    levelLabels: {},
    account: null,
    projects: [],
    assignments: {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    },
  };

  function persistSessionToken(token) {
    state.sessionToken = token || "";
    saveSessionToken(token);
  }

  const QUICK_HOUR_PRESETS = new Set(["0.5", "1", "1.5", "2", "2.5", "3"]);
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const memberModalState = {
    mode: "",
    client: "",
    project: "",
    userId: "",
  };

  if (embedded) {
    body.classList.add("is-embedded");
  }

  function loadThemePreference() {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      return raw === "light" || raw === "dark" ? raw : "";
    } catch (error) {
      return "";
    }
  }


  function saveThemePreference(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      return;
    }
  }

  function resolveTheme() {
    return loadThemePreference() || (themeMedia.matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    body.dataset.theme = theme;
    body.style.colorScheme = theme;

    if (!refs.themeToggle) {
      return;
    }

    const nextLabel = theme === "dark" ? "Light mode" : "Dark mode";
    refs.themeToggle.textContent = "Dark/Light";
    refs.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    refs.themeToggle.setAttribute("aria-label", nextLabel);
  }

  function availableUsers() {
    if (Array.isArray(state.users) && state.users.length) {
      return state.users
        .map(function (user) {
          return user.displayName;
        })
        .filter(Boolean);
    }

    return [];
  }

  function entryUserOptions() {
    if (!state.currentUser) {
      return availableUsers();
    }
    if (isAdmin(state.currentUser)) {
      return availableUsers();
    }
    if (isManager(state.currentUser)) {
      return state.users
        .filter((user) => isStaff(user) || user.id === state.currentUser.id)
        .map((user) => user.displayName)
        .filter(Boolean);
    }
    return [state.currentUser.displayName];
  }

  function applyLoadedState(data) {
    state.currentUser = data?.currentUser ? normalizeUser(data.currentUser) : null;
    state.users = Array.isArray(data?.users)
      ? data.users.map(normalizeUser).filter(Boolean)
      : [];
    state.bootstrapRequired = Boolean(data?.bootstrapRequired);
    state.catalog = normalizeCatalog(data?.catalog || DEFAULT_CLIENT_PROJECTS);
    state.entries = Array.isArray(data?.entries) ? data.entries.map(normalizeEntry).filter(Boolean) : [];
    state.assignments = normalizeAssignments(data?.assignments);
    state.levelLabels = data?.levelLabels && typeof data.levelLabels === "object"
      ? data.levelLabels
      : {};
    state.account = data?.account || null;
    const normalizedProjects = normalizeProjects(data?.projects);
    state.projects = normalizedProjects.length
      ? normalizedProjects
      : buildProjectsFromCatalog(state.catalog, {});
  }

  function clearRemoteAppState() {
    state.currentUser = null;
    state.users = [];
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS);
    state.entries = [];
    state.projects = [];
    state.levelLabels = {};
    state.account = null;
    state.assignments = {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    };
  }

  function resetFilters() {
    state.filters = {
      user: defaultFilterUser(state, isStaff),
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
  }

  async function loadPersistentState() {
    try {
      const payload = await requestAuth("session");
      applyLoadedState(payload);
      return true;
    } catch (error) {
      if (error.status === 401) {
        persistSessionToken("");
        state.bootstrapRequired = Boolean(error.payload?.bootstrapRequired);
        state.currentUser = null;
        state.users = [];
        state.entries = [];
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS);
        state.projects = [];
        state.assignments = {
          managerClients: [],
          managerProjects: [],
          projectMembers: [],
        };
        return true;
      }

      throw error;
    }
  }

  function hydrateAuthenticatedState(payload) {
    if (!payload?.currentUser) {
      throw new Error("Authenticated state is missing the current user.");
    }

    applyLoadedState(payload);
    resetFilters();
    resetForm();
    setAuthFeedback("", false);
    feedback("", false);
    closeUsersModal();
    closeCatalogModal();
    showAppShell();
    render();
  }

  async function mutatePersistentState(action, payload) {
    const sessionToken = loadSessionToken();
    const result = await requestJson(MUTATE_API_PATH, {
      method: "POST",
      body: JSON.stringify({
        action,
        payload,
        ...(sessionToken ? { sessionToken } : {}),
      }),
    });
    applyLoadedState(result);
    return result;
  }

  function setAuthFeedback(message, isError) {
    refs.authFeedback.textContent = message || "";
    refs.authFeedback.dataset.error = isError ? "true" : "false";
  }

  function setUserFeedback(message, isError) {
    usersSetUserFeedback?.({ refs }, message, isError);
  }

  function showAuthShell() {
    refs.authShell.hidden = false;
    refs.appShell.hidden = true;
    refs.authShell.style.display = "grid";
    refs.appShell.style.display = "none";
  }

  function showAppShell() {
    refs.authShell.hidden = true;
    refs.appShell.hidden = false;
    refs.authShell.style.display = "none";
    refs.appShell.style.display = "block";
  }

  function openUsersModal() {
    usersOpenUsersModal?.({ refs, body, postHeight });
  }

  function closeUsersModal() {
    usersCloseUsersModal?.({ refs, body, postHeight });
  }

  function openCatalogModal() {
    catalogOpenCatalogModal?.({ refs, body, postHeight });
  }

  function closeCatalogModal() {
    catalogCloseCatalogModal?.({ refs, body, postHeight });
  }

  function openMembersModal() {
    membersOpenMembersModal?.({
      refs,
      body,
      renderMembersModal,
      memberModalState,
      postHeight,
    });
  }

  function closeMembersModal() {
    membersCloseMembersModal?.({
      refs,
      body,
      memberModalState,
      postHeight,
    });
  }


  function normalizeCatalog(catalog) {
    const source = catalog && typeof catalog === "object" ? catalog : DEFAULT_CLIENT_PROJECTS;
    const normalized = {};

    Object.entries(source).forEach(function ([client, projects]) {
      const clientName = typeof client === "string" ? client.trim() : "";
      if (!clientName) {
        return;
      }

      const normalizedProjects = uniqueValues(
        Array.isArray(projects)
          ? projects.map((project) => (typeof project === "string" ? project.trim() : ""))
          : []
      );

      normalized[clientName] = normalizedProjects;
    });

    return Object.keys(normalized).length ? normalized : { ...DEFAULT_CLIENT_PROJECTS };
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const normalizedProject = typeof entry.project === "string" ? entry.project.trim() : "";
    const normalizedClient =
      typeof entry.client === "string" && entry.client.trim()
        ? entry.client.trim()
        : normalizedProject
          ? "Unassigned Client"
          : "";

    const hours = Number(entry.hours);
    const createdAt =
      typeof entry.createdAt === "string" && entry.createdAt
        ? entry.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof entry.updatedAt === "string" && entry.updatedAt
        ? entry.updatedAt
        : createdAt;

    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
      user:
        typeof entry.user === "string" && entry.user.trim()
          ? entry.user.trim()
          : state.currentUser?.displayName || "",
      date: isValidDateString(entry.date) ? entry.date : today,
      client: normalizedClient,
      project: normalizedProject,
      task: typeof entry.task === "string" ? entry.task.trim() : "",
      hours: Number.isFinite(hours) ? hours : 0,
      notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
      createdAt,
      updatedAt,
    };
  }



  function formatDisplayDate(value) {
    if (!isValidDateString(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year}`;
  }

  function formatDisplayDateShort(value) {
    if (!isValidDateString(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year.slice(-2)}`;
  }

  function parseDisplayDate(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) {
      return "";
    }
    if (digits.length !== 8) {
      return null;
    }

    const month = digits.slice(0, 2);
    const day = digits.slice(2, 4);
    const year = digits.slice(4);
    const iso = `${year}-${month}-${day}`;

    return isValidDateString(iso) ? iso : null;
  }

  function feedback(message, isError) {
    refs.feedback.textContent = message || "";
    refs.feedback.dataset.error = isError ? "true" : "false";
  }

  function field(form, name) {
    return form?.elements?.namedItem(name);
  }

  function updateFilterDateFromPicker(kind) {
    const refsForKind = filterDateRefs(refs, kind);
    const input = field(refs.filterForm, kind);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year || !input) {
      return;
    }

    const month = refsForKind.month.value;
    const day = refsForKind.day.value;
    const year = refsForKind.year.value;
    if (!month || !day || !year) {
      input.value = "";
      if (state.filters[kind]) {
        applyFiltersFromForm({ showErrors: false });
      }
      return;
    }

    const iso = `${year}-${month}-${day}`;
    if (!isValidDateString(iso)) {
      input.value = "";
      applyFiltersFromForm({ showErrors: false });
      return;
    }

    input.value = `${month}/${day}/${year}`;
    applyFiltersFromForm({ showErrors: false });
  }

  function catalogClientNames() {
    return Object.keys(state.catalog).sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogClientNames() {
    if (!state.currentUser) {
      return catalogClientNames();
    }
    return isAdmin(state.currentUser)
      ? catalogClientNames()
      : allowedClientsForUser(state.currentUser);
  }

  function historicalClientNames() {
    return uniqueValues(state.entries.map((entry) => entry.client)).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function clientNames() {
    return uniqueValues([...catalogClientNames(), ...historicalClientNames()]).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function catalogProjectNames(client) {
    const configuredProjects = client
      ? state.catalog[client] || []
      : Object.values(state.catalog).flat();
    return uniqueValues(configuredProjects).sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogProjectNames(client) {
    if (!state.currentUser) {
      return catalogProjectNames(client);
    }
    if (isAdmin(state.currentUser)) {
      return catalogProjectNames(client);
    }
    return allowedProjectsForClient(state.currentUser, client);
  }

  function projectNames(client) {
    const configuredProjects = catalogProjectNames(client);
    const storedProjects = state.entries
      .filter((entry) => !client || entry.client === client)
      .map((entry) => entry.project);

    return uniqueValues([...configuredProjects, ...storedProjects]).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function projectCount(client) {
    return catalogProjectNames(client).length;
  }

  const accessControl = createAccessControl?.({
    state,
    normalizeLevel,
    projectKey,
    uniqueValues,
    catalogProjectNames,
  }) || {};

  const {
    levelLabel,
    isGlobalAdmin,
    isManager,
    isStaff,
    isAdmin,
    getUserById,
    getUserByDisplayName,
    managerClientAssignments,
    managerProjectAssignments,
    projectMembersForUser,
    managerIdsForClient,
    managerIdsForClientScope,
    directManagerIdsForProject,
    managerIdsForProject,
    staffIdsForProject,
    staffIdsForClient,
    userNamesForIds,
    formatNameList,
    allowedProjectTuples,
    allowedClientsForUser,
    allowedProjectsForClient,
    canManagerAccessClient,
    canManagerAccessProject,
    projectCreatedBy,
    isUserAssignedToProject,
    canUserAccessProject,
  } = accessControl;

  function ensureCatalogSelection() {
    const clients = visibleCatalogClientNames();
    if (!clients.length) {
      state.selectedCatalogClient = "";
      return;
    }

    if (!clients.includes(state.selectedCatalogClient)) {
      state.selectedCatalogClient = clients[0];
    }
  }

  function syncFormCatalogsUI(selection) {
    syncFormCatalogs?.(
      {
        refs,
        state,
        field,
        entryUserOptions,
        visibleCatalogClientNames,
        visibleCatalogProjectNames,
        isStaff,
        isValidDateString,
        populateSelect,
        uniqueValues,
        escapeHtml,
      },
      selection
    );
  }

  function syncFilterCatalogsUI(selection) {
    syncFilterCatalogs?.(
      {
        refs,
        state,
        field,
        isStaff,
        isManager,
        availableUsers,
        defaultFilterUser,
        allowedClientsForUser,
        clientNames,
        allowedProjectsForClient,
        projectNames,
        populateSelect,
        uniqueValues,
        escapeHtml,
        formatDisplayDate,
        syncFilterDatePicker,
        isAdmin,
        isValidDateString,
      },
      selection
    );
  }

  function resetForm() {
    refs.form.reset();
    state.editingId = null;
    syncFormCatalogsUI({
      user: defaultEntryUser(state),
      client: "",
      project: "",
    });
    syncEntryDatePicker?.(
      { isValidDateString, today, refs, field, MONTH_NAMES, escapeHtml },
      today
    );
    field(refs.form, "hours").value = "";
    refs.otherHours.value = "";
    renderHourSelection?.({ refs, field });
    refs.formHeading.textContent = "Add timesheet entry";
    refs.submitEntry.textContent = "Save";
    refs.cancelEdit.hidden = true;
  }

  function setForm(entry) {
    syncFormCatalogsUI({
      user: entry.user,
      client: entry.client,
      project: entry.project,
    });
    syncEntryDatePicker?.(
      { isValidDateString, today, refs, field, MONTH_NAMES, escapeHtml },
      entry.date
    );
    field(refs.form, "hours").value = entry.hours;
    field(refs.form, "notes").value = entry.notes;
    refs.otherHours.value = QUICK_HOUR_PRESETS.has(String(entry.hours)) ? "" : String(entry.hours);
    renderHourSelection?.({ refs, field });
    state.editingId = entry.id;
    refs.formHeading.textContent = "Edit timesheet entry";
    refs.submitEntry.textContent = "Save";
    refs.cancelEdit.hidden = false;
    refs.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }


  function validateEntry(data) {
    if (!data.user) {
      return "Team member is required.";
    }
    if (!data.date) {
      return "Date is required.";
    }
    if (!data.client) {
      return "Client is required.";
    }
    if (!data.project) {
      return "Project is required.";
    }
    if (!Number.isFinite(data.hours) || data.hours <= 0 || data.hours > 24) {
      return "Hours must be between 0.25 and 24.";
    }
    return "";
  }

  function currentEntries() {
    const search = state.filters.search.trim().toLowerCase();

    return [...state.entries]
      .filter((entry) => {
        if (state.filters.user && entry.user !== state.filters.user) {
          return false;
        }
        if (state.filters.client && entry.client !== state.filters.client) {
          return false;
        }
        if (state.filters.project && entry.project !== state.filters.project) {
          return false;
        }
        if (state.filters.from && entry.date < state.filters.from) {
          return false;
        }
        if (state.filters.to && entry.date > state.filters.to) {
          return false;
        }
        if (!search) {
          return true;
        }

        const haystack = [
          entry.user,
          entry.client,
          entry.project,
          entry.task,
          entry.notes,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (a.date === b.date) {
          return b.createdAt.localeCompare(a.createdAt);
        }
        return b.date.localeCompare(a.date);
      });
  }

  function clientHours(client) {
    return state.entries
      .filter((entry) => entry.client === client)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  function projectHours(client, project) {
    return state.entries
      .filter((entry) => entry.client === client && entry.project === project)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  function renderCatalogAside() {
    if (!renderCatalogLists) {
      return;
    }
    renderCatalogLists({
      refs,
      state,
      visibleCatalogClientNames,
      visibleCatalogProjectNames,
      isAdmin,
      isManager,
      canManagerAccessClient,
      projectCreatedBy,
      canManagerAccessProject,
      projectHours,
      formatNameList,
      userNamesForIds,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      disabledButtonAttrs,
      escapeHtml,
      field,
      ensureCatalogSelection,
    });
  }

  function disabledButtonAttrs(enabled, title) {
    if (enabled) {
      return "";
    }
    return `disabled aria-disabled="true" title="${escapeHtml(title)}"`;
  }

  function renderUsersList() {
    usersRenderUsersList?.({
      refs,
      state,
      levelLabel,
      isAdmin,
      isGlobalAdmin,
      isManager,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      escapeHtml,
      disabledButtonAttrs,
    });
  }

  function syncUserManagementControls() {
    usersSyncUserManagementControls?.({
      refs,
      state,
      isAdmin,
      isGlobalAdmin,
      levelLabel,
      escapeHtml,
      field,
    });
  }

  function setMembersFeedback(message, isError) {
    if (!refs.membersFeedback) {
      return;
    }
    refs.membersFeedback.textContent = message || "";
    refs.membersFeedback.dataset.error = isError ? "true" : "false";
  }

  function renderMembersModal() {
    membersRenderMembersModal?.({
      refs,
      state,
      memberModalState,
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      normalizeLevel,
      getUserById,
      directManagerIdsForProject,
      isUserAssignedToProject,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      escapeHtml,
    });
  }

  function renderAuthUi() {
    const isAuthenticated = Boolean(state.currentUser);

    if (isAuthenticated) {
      showAppShell();
    } else {
      showAuthShell();
    }

    refs.loginForm.hidden = state.bootstrapRequired;
    refs.bootstrapForm.hidden = !state.bootstrapRequired;
    refs.authSubtext.textContent = state.bootstrapRequired
      ? "Create the first Admin account to activate team logins."
      : "Sign in with your team member credentials to continue.";

    if (isAuthenticated) {
      const accountName = state.account?.name || "";
      if (refs.accountName) {
        refs.accountName.hidden = false;
        refs.accountName.textContent = accountName;
      }
      refs.sessionIndicator.hidden = false;
      const userName = state.currentUser.displayName || "";
      refs.sessionIndicator.innerHTML = `<span class="session-user">${escapeHtml(userName)}</span>`;
      refs.manageUsers.hidden = !isAdmin(state.currentUser);
      refs.logoutButton.hidden = false;
      refs.openCatalog.hidden = !(isAdmin(state.currentUser) || isManager(state.currentUser));
    } else {
      if (refs.accountName) {
        refs.accountName.hidden = true;
        refs.accountName.textContent = "";
      }
      refs.sessionIndicator.hidden = true;
      refs.sessionIndicator.innerHTML = "";
      refs.manageUsers.hidden = true;
      refs.logoutButton.hidden = true;
      refs.openCatalog.hidden = true;
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    const formData = new FormData(refs.loginForm);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    setAuthFeedback("Signing in...", false);

    try {
      const payload = await requestAuth("login", { username, password });
      if (!payload.sessionToken) {
        throw new Error("Login response was missing a session token.");
      }
      persistSessionToken(payload.sessionToken || "");
      setAuthFeedback("Credentials accepted. Loading workspace...", false);
      refs.loginForm.reset();
      hydrateAuthenticatedState(payload);
    } catch (error) {
      console.error("Login failed:", error);
      const message = error.message || "Unable to sign in.";
      setAuthFeedback(message, true);
      window.alert(message);
    }
  }

  async function submitBootstrap(event) {
    event.preventDefault();
    const formData = new FormData(refs.bootstrapForm);
    const displayName = String(formData.get("display_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    setAuthFeedback("Creating Admin account...", false);

    try {
      const payload = await requestAuth("bootstrap", { displayName, username, password });
      if (!payload.sessionToken) {
        throw new Error("Bootstrap response was missing a session token.");
      }
      persistSessionToken(payload.sessionToken || "");
      setAuthFeedback("Admin account created. Loading workspace...", false);
      refs.bootstrapForm.reset();
      hydrateAuthenticatedState(payload);
    } catch (error) {
      console.error("Bootstrap failed:", error);
      const message = error.message || "Unable to create the Admin account.";
      setAuthFeedback(message, true);
      window.alert(message);
    }
  }

  async function handleLogout() {
    const sessionToken = loadSessionToken();

    persistSessionToken("");
    clearRemoteAppState();
    resetFilters();
    resetForm();
    setAuthFeedback("Signed out.", false);
    closeUsersModal();
    closeCatalogModal();
    render();

    try {
      await requestJson(AUTH_API_PATH, {
        method: "POST",
        body: JSON.stringify({
          action: "logout",
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }
  }

  async function handleAddUser(event) {
    event.preventDefault();
    if (!isAdmin(state.currentUser)) {
      const message = "Only Admins can add team members.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }
    const formData = new FormData(refs.addUserForm);
    const displayName = String(formData.get("display_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const selectedLevel = Number(formData.get("level") || 1);
    const level = isGlobalAdmin(state.currentUser) ? selectedLevel : 1;
    const baseRateRaw = formData.get("base_rate");
    const baseRate =
      baseRateRaw !== null && baseRateRaw !== ""
        ? Number(baseRateRaw)
        : null;

    try {
      await mutatePersistentState("add_user", {
        displayName,
        username,
        password,
        level,
        baseRate,
      });
    } catch (error) {
      const message = error.message || "Unable to add team member.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    refs.addUserForm.reset();
    field(refs.addUserForm, "level").value = "1";
    setUserFeedback("Team member added.", false);
    render();
  }

  async function handleUserListAction(event) {
    const button = event.target.closest(
      "[data-user-edit], [data-user-role], [data-user-password], [data-user-deactivate]"
    );
    if (!button) {
      return;
    }
    if (button.disabled) {
      return;
    }

    const userId =
      button.dataset.userEdit ||
      button.dataset.userRole ||
      button.dataset.userPassword ||
      button.dataset.userDeactivate ||
      button.dataset.userAssignClient ||
      button.dataset.userUnassignClient ||
      button.dataset.userAssignProject ||
      button.dataset.userUnassignProject;
    const user = state.users.find(function (candidate) {
      return candidate.id === userId;
    });

    if (!user) {
      const message = "Team member not found.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    try {
      if (button.dataset.userEdit) {
        const nextDisplayName = window.prompt("Team member name", user.displayName);
        if (nextDisplayName === null) {
          return;
        }
        const nextUsername = window.prompt("Username", user.username);
        if (nextUsername === null) {
          return;
        }

        await mutatePersistentState("update_user", {
          userId: user.id,
          displayName: nextDisplayName,
          username: nextUsername,
          level: user.level,
        });
        setUserFeedback("Team member updated.", false);
      } else if (button.dataset.userRole) {
        memberModalState.mode = "user-role";
        memberModalState.client = "";
        memberModalState.project = "";
        memberModalState.userId = user.id;
        openMembersModal();
        return;
      } else if (button.dataset.userPassword) {
        const nextPassword = window.prompt(
          `Enter a new password for ${user.displayName} (minimum 8 characters)`
        );
        if (nextPassword === null) {
          return;
        }

        await mutatePersistentState("reset_user_password", {
          userId: user.id,
          password: nextPassword,
        });
        setUserFeedback(`Password updated for ${user.displayName}.`, false);
      } else if (button.dataset.userDeactivate) {
        const confirmed = window.confirm(`Deactivate ${user.displayName}?`);
        if (!confirmed) {
          return;
        }

        await mutatePersistentState("deactivate_user", {
          userId: user.id,
        });
        setUserFeedback(`${user.displayName} was deactivated.`, false);
      }
    } catch (error) {
      const message = error.message || "Unable to update team member.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    render();
  }

  function renderFilterState(filteredEntries) {
    const chips = [];
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
    if (state.filters.user) {
      chips.push(`User: ${state.filters.user}`);
    }
    if (state.filters.client) {
      chips.push(`Client: ${state.filters.client}`);
    }
    if (state.filters.project) {
      chips.push(`Project: ${state.filters.project}`);
    }
    if (state.filters.from) {
      chips.push(`From ${formatDisplayDate(state.filters.from)}`);
    }
    if (state.filters.to) {
      chips.push(`To ${formatDisplayDate(state.filters.to)}`);
    }
    if (state.filters.search.trim()) {
      chips.push(`Search: ${state.filters.search.trim()}`);
    }

    refs.filterTotalHours.textContent = `Total hours: ${totalHours.toFixed(2)}`;

    refs.activeFilters.hidden = chips.length === 0;
    refs.activeFilters.innerHTML = chips
      .map((chip) => `<span class="filter-pill">${escapeHtml(chip)}</span>`)
      .join("");
  }

  function renderTable(filteredEntries) {
    if (!filteredEntries.length) {
      refs.entriesBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            <div class="empty-state-panel">
              <strong>No entries match the current filters.</strong>
              <span>Clear the filters or add a new entry to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    refs.entriesBody.innerHTML = filteredEntries
      .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(formatDisplayDateShort(entry.date))}</td>
            <td>${escapeHtml(entry.user)}</td>
            <td>${escapeHtml(entry.client)}</td>
            <td>${escapeHtml(entry.project)}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${escapeHtml(entry.notes || "-")}</td>
            <td class="actions-cell">
              <button class="text-button" type="button" data-action="edit" data-id="${entry.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="delete" data-id="${entry.id}">
                Delete
              </button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function render() {
    renderAuthUi();

    if (!state.currentUser) {
      postHeight();
      return;
    }

    syncFormCatalogsUI({});
    syncFilterCatalogsUI(state.filters);
    ensureCatalogSelection();

    const filteredEntries = currentEntries();
    renderCatalogAside();
    renderUsersList();
    syncUserManagementControls();
    if (refs.membersModal && !refs.membersModal.hidden) {
      renderMembersModal();
    }
    renderFilterState(filteredEntries);
    renderTable(filteredEntries);
    postHeight();
  }

  function applyFiltersFromForm(options) {
    const settings = options || {};
    const showErrors = settings.showErrors !== false;
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    const projectField = field(refs.filterForm, "project");
    const fromField = field(refs.filterForm, "from");
    const toField = field(refs.filterForm, "to");
    const searchField = field(refs.filterForm, "search");
    const parsedFrom = parseDisplayDate(fromField.value);
    const parsedTo = parseDisplayDate(toField.value);

    if (fromField.value.trim() && !parsedFrom) {
      if (showErrors) {
        feedback("From date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }

    if (toField.value.trim() && !parsedTo) {
      if (showErrors) {
        feedback("To date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }

    state.filters = {
      user: userField.value,
      client: clientField.value,
      project: projectField.value,
      from: parsedFrom || "",
      to: parsedTo || "",
      search: searchField.value,
    };

    fromField.value = formatDisplayDate(state.filters.from);
    toField.value = formatDisplayDate(state.filters.to);
    feedback("", false);
    render();
    return true;
  }

  function postHeight() {
    if (!embedded) {
      return;
    }

    const height = document.documentElement.scrollHeight;
    window.parent.postMessage(
      {
        type: "timesheet-studio:resize",
        height,
      },
      "*"
    );
  }

  applyTheme(resolveTheme());

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function exportCsv() {
    const entries = currentEntries();
    if (!entries.length) {
      feedback("There are no entries to export.", true);
      return;
    }

    const rows = [
      ["Date", "User", "Client", "Project", "Hours", "Notes"],
      ...entries.map((entry) => [
        entry.date,
        entry.user,
        entry.client,
        entry.project,
        entry.hours,
        entry.notes,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  refs.form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const existingEntry = state.entries.find((entry) => entry.id === state.editingId);
    const userField = field(refs.form, "user");
    const dateField = field(refs.form, "date");
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    const hoursField = field(refs.form, "hours");
    const notesField = field(refs.form, "notes");
    const nextEntry = {
      id: state.editingId || crypto.randomUUID(),
      user: userField.value,
      date: dateField.value,
      client: clientField.value,
      project: projectField.value,
      task: existingEntry?.task || "",
      hours: Number(hoursField.value),
      notes: notesField.value.trim(),
      createdAt: existingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const error = validateEntry(nextEntry);
    if (error) {
      feedback(error, true);
      return;
    }

    try {
      await mutatePersistentState("save_entry", { entry: nextEntry });
    } catch (error) {
      feedback(error.message || "Unable to save entry.", true);
      return;
    }

    feedback(state.editingId ? "Entry updated." : "Entry saved.", false);
    resetForm();
    render();
  });

  refs.cancelEdit.addEventListener("click", function () {
    resetForm();
    feedback("", false);
  });

  refs.loginForm.addEventListener("submit", submitLogin);
  refs.bootstrapForm.addEventListener("submit", submitBootstrap);

  refs.manageUsers.addEventListener("click", function () {
    openUsersModal();
  });

  refs.logoutButton.addEventListener("click", function () {
    handleLogout();
  });

  refs.openCatalog.addEventListener("click", openCatalogModal);

  if (refs.themeToggle) {
    refs.themeToggle.addEventListener("click", function () {
      const nextTheme = body.dataset.theme === "dark" ? "light" : "dark";
      saveThemePreference(nextTheme);
      applyTheme(nextTheme);
    });
  }

  themeMedia.addEventListener("change", function (event) {
    if (loadThemePreference()) {
      return;
    }

    applyTheme(event.matches ? "dark" : "light");
  });

  if (refs.closeCatalog) {
    refs.closeCatalog.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeCatalogModal();
    });
  }

  refs.catalogModal.addEventListener("click", function (event) {
    if (event.target === refs.catalogModal) {
      closeCatalogModal();
    }
  });

  refs.closeUsers.addEventListener("click", function (event) {
    event.preventDefault();
    closeUsersModal();
  });

  if (refs.closeMembers) {
    refs.closeMembers.addEventListener("click", function (event) {
      event.preventDefault();
      closeMembersModal();
    });
  }

  if (refs.membersCancel) {
    refs.membersCancel.addEventListener("click", function () {
      closeMembersModal();
    });
  }

  refs.usersModal.addEventListener("click", function (event) {
    if (event.target === refs.usersModal) {
      closeUsersModal();
    }
  });

  if (refs.membersModal) {
    refs.membersModal.addEventListener("click", function (event) {
      if (event.target === refs.membersModal) {
        closeMembersModal();
      }
    });
  }

  document.addEventListener("click", function (event) {
    const closeTrigger = event.target.closest("[data-close-catalog]");
    if (!closeTrigger) {
      return;
    }

    event.preventDefault();
    closeCatalogModal();
  });

  refs.hourPresets.addEventListener("click", function (event) {
    handleHourPresetClick?.({ refs, field }, event);
  });

  refs.otherHours.addEventListener("input", function () {
    handleOtherHoursInput?.({ refs, field });
  });

  ["from", "to"].forEach(function (name) {
    const refsForKind = filterDateRefs(refs, name);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year) {
      return;
    }

    [refsForKind.month, refsForKind.day, refsForKind.year].forEach(function (select) {
      select.addEventListener("change", function () {
        updateFilterDateFromPicker(name);
      });
    });
  });

  const updateEntryDateFromPickerHandler = function () {
    updateEntryDateFromPicker?.({ refs, field, escapeHtml });
  };
  refs.entryDateMonth.addEventListener("change", updateEntryDateFromPickerHandler);
  refs.entryDateDay.addEventListener("change", updateEntryDateFromPickerHandler);
  refs.entryDateYear.addEventListener("change", updateEntryDateFromPickerHandler);

  field(refs.form, "client").addEventListener("change", function () {
    const userField = field(refs.form, "user");
    const clientField = field(refs.form, "client");
    state.selectedCatalogClient = clientField.value || state.selectedCatalogClient;
    syncFormCatalogsUI({
      user: userField.value,
      client: clientField.value,
      project: "",
    });
    renderCatalogAside();
  });

  field(refs.filterForm, "client").addEventListener("change", function () {
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    syncFilterCatalogsUI({
      user: userField.value,
      client: clientField.value,
      project: "",
    });
    applyFiltersFromForm();
  });

  ["user", "project"].forEach(function (name) {
    field(refs.filterForm, name).addEventListener("change", function () {
      applyFiltersFromForm();
    });
  });

  field(refs.filterForm, "search").addEventListener("input", function () {
    applyFiltersFromForm({ showErrors: false });
  });

  refs.filterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    applyFiltersFromForm();
  });

  refs.clearFilters.addEventListener("click", function () {
    refs.filterForm.reset();
    resetFilters();
    syncFilterCatalogsUI(state.filters);
    render();
  });

  refs.exportCsv.addEventListener("click", exportCsv);
  refs.addUserForm.addEventListener("submit", handleAddUser);
  refs.userList.addEventListener("click", handleUserListAction);
  if (refs.levelLabelsForm) {
    refs.levelLabelsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!isGlobalAdmin(state.currentUser)) {
        feedback("Only Level 6 Admins can update level labels.", true);
        return;
      }
      const formData = new FormData(refs.levelLabelsForm);
      const labels = {};
      for (let level = 1; level <= 6; level += 1) {
        labels[level] = String(formData.get(`level_${level}`) || "").trim();
      }
      try {
        await mutatePersistentState("update_level_labels", { labels });
        feedback("Level labels updated.", false);
        render();
      } catch (error) {
        feedback(error.message || "Unable to update level labels.", true);
      }
    });
  }

  refs.addClientForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isAdmin(state.currentUser)) {
      feedback("Only Admins can add clients.", true);
      return;
    }
    const clientNameField = field(refs.addClientForm, "client_name");
    const formUserField = field(refs.form, "user");
    const filterUserField = field(refs.filterForm, "user");
    const filterClientField = field(refs.filterForm, "client");
    const filterProjectField = field(refs.filterForm, "project");
    try {
      await mutatePersistentState("add_client", {
        clientName: clientNameField.value,
      });
      state.selectedCatalogClient = clientNameField.value.trim();
    } catch (error) {
      feedback(error.message || "Unable to add client.", true);
      return;
    }

    refs.addClientForm.reset();
    syncFormCatalogsUI({
      user: formUserField.value,
      client: state.selectedCatalogClient,
      project: "",
    });
    syncFilterCatalogsUI({
      user: filterUserField.value,
      client: filterClientField.value,
      project: filterProjectField.value,
    });
    feedback("Client added.", false);
    render();
  });

  refs.addProjectForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const canCreateProject =
      isAdmin(state.currentUser) ||
      (isManager(state.currentUser) &&
        canManagerAccessClient(state.currentUser, state.selectedCatalogClient));
    if (!canCreateProject) {
      feedback("You are not assigned to this client.", true);
      return;
    }
    const projectNameField = field(refs.addProjectForm, "project_name");
    const formUserField = field(refs.form, "user");
    const filterUserField = field(refs.filterForm, "user");
    const filterClientField = field(refs.filterForm, "client");
    const filterProjectField = field(refs.filterForm, "project");
    try {
      await mutatePersistentState("add_project", {
        clientName: state.selectedCatalogClient,
        projectName: projectNameField.value,
      });
    } catch (error) {
      feedback(error.message || "Unable to add project.", true);
      return;
    }

    const newestProject = projectNameField.value.trim();
    refs.addProjectForm.reset();
    syncFormCatalogsUI({
      user: formUserField.value,
      client: state.selectedCatalogClient,
      project: newestProject,
    });
    syncFilterCatalogsUI({
      user: filterUserField.value,
      client: filterClientField.value,
      project: filterProjectField.value,
    });
    feedback("Project added.", false);
    render();
  });

  refs.clientList.addEventListener("click", async function (event) {
    const assignManagers = event.target.closest("[data-assign-managers]");
    if (assignManagers) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can assign managers.", true);
        return;
      }
      memberModalState.mode = "client-assign";
      memberModalState.client = assignManagers.dataset.assignManagers;
      memberModalState.project = "";
      openMembersModal();
      return;
    }

    const unassignManagers = event.target.closest("[data-unassign-managers]");
    if (unassignManagers) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can unassign managers.", true);
        return;
      }
      memberModalState.mode = "client-unassign";
      memberModalState.client = unassignManagers.dataset.unassignManagers;
      memberModalState.project = "";
      openMembersModal();
      return;
    }

    const editButton = event.target.closest("[data-edit-client]");
    if (editButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can edit clients.", true);
        return;
      }
      const clientName = editButton.dataset.editClient;
      const nextName = window.prompt("Edit client name", clientName);
      if (nextName === null) {
        return;
      }

      try {
        await mutatePersistentState("rename_client", {
          clientName,
          nextName,
        });
        if (state.selectedCatalogClient === clientName) {
          state.selectedCatalogClient = nextName.trim();
        }
        if (state.filters.client === clientName) {
          state.filters.client = nextName.trim();
        }
      } catch (error) {
        feedback(error.message || "Unable to update client.", true);
        return;
      }

      syncFilterCatalogsUI(state.filters);
      feedback("Client updated.", false);
      render();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-client]");
    if (deleteButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can remove clients.", true);
        return;
      }
      const clientName = deleteButton.dataset.deleteClient;
      const hoursLogged = clientHours(clientName);
      const confirmed = window.confirm(
        hoursLogged > 0
          ? `${clientName} already has ${hoursLogged.toFixed(
              2
            )} logged hours. Remove it from the active catalog and keep the history?`
          : `Remove ${clientName} from the active catalog?`
      );
      if (!confirmed) {
        return;
      }

      let message = "";
      try {
        const result = await mutatePersistentState("remove_client", {
          clientName,
        });
        message = result?.message || "";
        if (state.selectedCatalogClient === clientName) {
          state.selectedCatalogClient = "";
        }
        if (state.filters.client === clientName) {
          state.filters.client = "";
        }
      } catch (error) {
        feedback(error.message || "Unable to remove client.", true);
        return;
      }

      syncFilterCatalogsUI(state.filters);
      feedback(message || "Client removed from active catalog.", false);
      render();
      return;
    }

    const button = event.target.closest("[data-client]");
    if (!button) {
      return;
    }

    state.selectedCatalogClient = button.dataset.client;
    renderCatalogAside();
    postHeight();
  });

  refs.clientList.addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-client]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    row.click();
  });

  refs.projectList.addEventListener("click", async function (event) {
    const assignManagersProject = event.target.closest("[data-assign-managers-project]");
    if (assignManagersProject) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can assign managers.", true);
        return;
      }
      memberModalState.mode = "project-assign-manager";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = assignManagersProject.dataset.assignManagersProject;
      openMembersModal();
      return;
    }

    const unassignManagersProject = event.target.closest("[data-unassign-managers-project]");
    if (unassignManagersProject) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can unassign managers.", true);
        return;
      }
      memberModalState.mode = "project-unassign-manager";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = unassignManagersProject.dataset.unassignManagersProject;
      openMembersModal();
      return;
    }

    const editButton = event.target.closest("[data-edit-project]");
    if (editButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can edit projects.", true);
        return;
      }
      const projectName = editButton.dataset.editProject;
      const nextName = window.prompt("Edit project name", projectName);
      if (nextName === null) {
        return;
      }

      try {
        await mutatePersistentState("rename_project", {
          clientName: state.selectedCatalogClient,
          projectName,
          nextName,
        });
        if (
          state.filters.client === state.selectedCatalogClient &&
          state.filters.project === projectName
        ) {
          state.filters.project = nextName.trim();
        }
      } catch (error) {
        feedback(error.message || "Unable to update project.", true);
        return;
      }

      syncFilterCatalogsUI(state.filters);
      feedback("Project updated.", false);
      render();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-project]");
    if (deleteButton) {
      const projectName = deleteButton.dataset.deleteProject;
      const canDeleteProject =
        isAdmin(state.currentUser) ||
        (isManager(state.currentUser) &&
          projectCreatedBy(state.selectedCatalogClient, projectName) ===
            state.currentUser?.id);
      if (!canDeleteProject) {
        feedback("Managers can only remove projects they created.", true);
        return;
      }
      const hoursLogged = projectHours(state.selectedCatalogClient, projectName);
      const confirmed = window.confirm(
        hoursLogged > 0
          ? `${projectName} already has ${hoursLogged.toFixed(
              2
            )} logged hours. Remove it from the active catalog and keep the history?`
          : `Remove ${projectName} from the active catalog?`
      );
      if (!confirmed) {
        return;
      }

      let message = "";
      try {
        const result = await mutatePersistentState("remove_project", {
          clientName: state.selectedCatalogClient,
          projectName,
        });
        message = result?.message || "";
        if (
          state.filters.client === state.selectedCatalogClient &&
          state.filters.project === projectName
        ) {
          state.filters.project = "";
        }
      } catch (error) {
        feedback(error.message || "Unable to remove project.", true);
        return;
      }

      syncFilterCatalogsUI(state.filters);
      feedback(message || "Project removed from active catalog.", false);
      render();
      return;
    }

    const assignMembersButton = event.target.closest("[data-assign-members]");
    if (assignMembersButton) {
      if (
        !isAdmin(state.currentUser) &&
        !(
          isManager(state.currentUser) &&
          canManagerAccessProject(
            state.currentUser,
            state.selectedCatalogClient,
            assignMembersButton.dataset.assignMembers
          )
        )
      ) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-add";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = assignMembersButton.dataset.assignMembers;
      openMembersModal();
      return;
    }

    const removeMembersButton = event.target.closest("[data-remove-members]");
    if (removeMembersButton) {
      if (
        !isAdmin(state.currentUser) &&
        !(
          isManager(state.currentUser) &&
          canManagerAccessProject(
            state.currentUser,
            state.selectedCatalogClient,
            removeMembersButton.dataset.removeMembers
          )
        )
      ) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-remove";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = removeMembersButton.dataset.removeMembers;
      openMembersModal();
      return;
    }

    const button = event.target.closest("[data-project]");
    if (!button || !state.selectedCatalogClient) {
      return;
    }

    syncFormCatalogsUI({
      user: field(refs.form, "user").value,
      client: state.selectedCatalogClient,
      project: button.dataset.project,
    });
    closeCatalogModal();
    refs.hourPresets.querySelector("[data-hours]")?.focus();
    feedback("Project selected in the form.", false);
    postHeight();
  });

  refs.projectList.addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-project]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    row.click();
  });

  refs.entriesBody.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;
    const entry = state.entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    if (action === "edit") {
      setForm(entry);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Are you sure you want to delete this entry?");
      if (!confirmed) {
        return;
      }

      try {
        await mutatePersistentState("delete_entry", { id });
      } catch (error) {
        feedback(error.message || "Unable to delete entry.", true);
        return;
      }

      if (state.editingId === id) {
        resetForm();
      }
      feedback("Entry deleted.", false);
      render();
    }
  });

  if (refs.membersConfirm) {
    refs.membersConfirm.addEventListener("click", async function () {
      const mode = memberModalState.mode;
      const client = memberModalState.client;
      const project = memberModalState.project;
      const roleOnlyMode = mode === "user-role";
      const isRemovalMode =
        mode === "project-remove" ||
        mode === "client-unassign" ||
        mode === "project-unassign-manager";
      const selected = roleOnlyMode
        ? memberModalState.userId
          ? [memberModalState.userId]
          : []
        : Array.from(
            refs.membersList.querySelectorAll("input[type='checkbox'][data-member-id]")
          )
            .filter((input) =>
              isRemovalMode ? !input.checked && !input.disabled : input.checked && !input.disabled
            )
            .map((input) => input.dataset.memberId);

      const levelSelections = Array.from(
        refs.membersList.querySelectorAll("select[data-level-select]")
      ).reduce(function (acc, select) {
        acc[select.dataset.levelSelect] = Number(select.value);
        return acc;
      }, {});

      if (!selected.length && !roleOnlyMode) {
        setMembersFeedback("Select at least one member.", true);
        return;
      }

      let skippedNonStaff = 0;
      try {
        for (const userId of selected) {
          const user = getUserById(userId);
          if (!user) {
            continue;
          }
          const nextLevel = normalizeLevel(
            levelSelections[userId] ?? user.level
          );
          if (isGlobalAdmin(state.currentUser) && nextLevel !== normalizeLevel(user.level)) {
            if (
              isGlobalAdmin(user) &&
              nextLevel < 6 &&
              state.users.filter((candidate) => isGlobalAdmin(candidate)).length <= 1
            ) {
              throw new Error("At least one Admin account is required.");
            }
            await mutatePersistentState("update_user", {
              userId: user.id,
              displayName: user.displayName,
              username: user.username,
              level: nextLevel,
            });
          }

          const effectiveLevel = normalizeLevel(nextLevel || user.level);

          if (mode === "project-add") {
            if (effectiveLevel > 2) {
              skippedNonStaff += 1;
              continue;
            }
            await mutatePersistentState("add_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
            });
          } else if (mode === "project-remove") {
            await mutatePersistentState("remove_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
            });
          } else if (mode === "client-assign") {
            if (effectiveLevel < 3) {
              continue;
            }
            await mutatePersistentState("assign_manager_client", {
              managerId: user.id,
              clientName: client,
            });
          } else if (mode === "client-unassign") {
            await mutatePersistentState("unassign_manager_client", {
              managerId: user.id,
              clientName: client,
            });
          } else if (mode === "project-assign-manager") {
            if (effectiveLevel < 3) {
              continue;
            }
            await mutatePersistentState("assign_manager_project", {
              managerId: user.id,
              clientName: client,
              projectName: project,
            });
          } else if (mode === "project-unassign-manager") {
            await mutatePersistentState("unassign_manager_project", {
              managerId: user.id,
              clientName: client,
              projectName: project,
            });
          }
        }
      } catch (error) {
        setMembersFeedback(error.message || "Unable to update members.", true);
        return;
      }

      const postMessage = skippedNonStaff
        ? "Only Levels 1-2 can be added to projects; higher levels were skipped."
        : "";
      closeMembersModal();
      render();
      if (postMessage) {
        feedback(postMessage, true);
      }
    });
  }

  window.addEventListener("resize", postHeight);
  window.addEventListener("load", postHeight);
  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    if (!refs.usersModal.hidden) {
      closeUsersModal();
    }

    if (!refs.catalogModal.hidden) {
      closeCatalogModal();
    }

    if (refs.membersModal && !refs.membersModal.hidden) {
      closeMembersModal();
    }
  });

  async function initApp() {
    await loadPersistentState();
    resetFilters();

    if (!state.currentUser) {
      if (loadSessionToken() && !state.bootstrapRequired) {
        persistSessionToken("");
        setAuthFeedback("Your saved session could not be restored. Please sign in again.", true);
      }
      render();
      return;
    }

    syncFilterCatalogsUI(state.filters);
    resetForm();
    render();
  }

  initApp();
})();
