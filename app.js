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
    setDetailEditState: usersSetDetailEditState,
  } = window.usersModal || {};
  const {
    daysInMonth,
    yearOptions,
    setSelectOptions,
    setSelectOptionsWithPlaceholder,
    filterDateRefs,
    syncFilterDatePicker,
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
  const {
    renderAuditTable,
    filterAuditLogs,
    humanizeEntity,
    humanizeAction,
    humanizeField,
    formatValue,
    formatAuditKV,
    applyAuditFiltersFromForm,
  } = window.auditLog || {};
  const {
    activeExpenseCategories,
    syncExpenseCatalogs,
    resetExpenseForm,
    setExpenseForm,
    currentExpenses,
    renderExpenseFilterState,
    applyExpenseFiltersFromForm,
    canManageExpenseApproval,
    userNameById,
    renderExpenses,
    expenseFromForm,
    validateExpenseForm,
  } = window.expenses || {};

  const DEFAULT_CLIENT_PROJECTS = {};

  const today = formatDate(new Date());
  
  const minEntryDate = (() => {
    const todayParts = today.split("-");
    const minYear = Number(todayParts[0]) - 1;
    return `${minYear}-01-01`;
  })();

  function clampDateToBounds(value) {
    const max = today;
    const min = minEntryDate;
    const safe = isValidDateString(value) ? value : max;
    if (safe > max) return max;
    if (safe < min) return min;
    return safe;
  }

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
    navTimesheet: document.getElementById("nav-timesheet"),
    navExpenses: document.getElementById("nav-expenses"),
    navSettings: document.getElementById("nav-settings"),
    navMembers: document.getElementById("nav-members"),
    timesheetView: document.getElementById("timesheet-view"),
    expensesView: document.getElementById("expenses-view"),
    settingsToggle: document.getElementById("settings-toggle"),
    settingsMenu: document.getElementById("settings-menu"),
    settingsMenuHeader: document.getElementById("settings-menu-header"),
    changePasswordOpen: document.getElementById("change-password-open"),
    logoutButton: document.getElementById("logout-button"),
    themeToggle: document.getElementById("theme-toggle"),
    openCatalog: document.getElementById("open-catalog"),
    openAnalytics: document.getElementById("open-analytics"),
    mobileTabbar: document.getElementById("mobile-tabbar"),
    navSettingsMobile: document.getElementById("nav-settings-mobile"),
    navMembersMobile: document.getElementById("nav-members-mobile"),
    navClientsMobile: document.getElementById("nav-clients-mobile"),
    navTimesheetMobile: document.getElementById("nav-timesheet-mobile"),
    navExpensesMobile: document.getElementById("nav-expenses-mobile"),
    navAnalyticsMobile: document.getElementById("nav-analytics-mobile"),
    closeCatalog: document.getElementById("close-catalog"),
    clientsNavMembers: document.getElementById("clients-nav-members"),
    clientsNavMain: document.getElementById("clients-nav-main"),
    clientsNavTheme: document.getElementById("clients-nav-theme"),
    membersNavClients: document.getElementById("members-nav-clients"),
    membersNavMain: document.getElementById("members-nav-main"),
    membersNavTheme: document.getElementById("members-nav-theme"),
    settingsLevels: document.getElementById("settings-levels"),
    analyticsNavBack: document.getElementById("analytics-nav-back"),
    clientsPage: document.getElementById("clients-page"),
    usersPage: document.getElementById("members-page"),
    analyticsPage: document.getElementById("analytics-page"),
    settingsPage: document.getElementById("settings-page"),
    expenseRows: document.getElementById("expense-rows"),
    addCategory: document.getElementById("add-category"),
    saveCategories: document.getElementById("save-categories"),
    expenseCategoriesForm: document.getElementById("expense-categories-form"),
    dialog: document.getElementById("app-dialog"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogMessage: document.getElementById("dialog-message"),
    dialogInputRow: document.getElementById("dialog-input-row"),
    dialogInput: document.getElementById("dialog-input"),
    dialogTextarea: document.getElementById("dialog-textarea"),
    dialogCancel: document.getElementById("dialog-cancel"),
    dialogConfirm: document.getElementById("dialog-confirm"),
    changePasswordModal: document.getElementById("change-password-modal"),
    changePasswordForm: document.getElementById("change-password-form"),
    changePasswordCurrent: document.getElementById("change-password-current"),
    changePasswordNew: document.getElementById("change-password-new"),
    changePasswordConfirm: document.getElementById("change-password-confirm"),
    changePasswordCancel: document.getElementById("change-password-cancel"),
    settingsMenuSettings: document.getElementById("settings-menu-settings"),
    forcePasswordShell: document.getElementById("force-password-shell"),
    forcePasswordForm: document.getElementById("force-password-form"),
    forcePasswordCurrent: document.getElementById("force-password-current"),
    forcePasswordNew: document.getElementById("force-password-new"),
    forcePasswordConfirm: document.getElementById("force-password-confirm"),
    membersModal: document.getElementById("members-modal"),
    closeUsers: document.getElementById("close-users"),
    closeMembers: document.getElementById("close-members"),
    hourPresets: document.getElementById("hour-presets"),
    otherHours: document.getElementById("other-hours"),
    entryDate: document.getElementById("entry-date"),
    submitEntry: document.getElementById("submit-entry"),
    addClientForm: document.getElementById("add-client-form"),
    addProjectForm: document.getElementById("add-project-form"),
    addUserForm: document.getElementById("add-user-form"),
    levelLabelsForm: document.getElementById("level-labels-form"),
    levelRows: document.getElementById("level-rows"),
    addLevel: document.getElementById("add-level"),
    filterForm: document.getElementById("filter-form"),
    clearFilters: document.getElementById("clear-filters"),
    exportCsv: document.getElementById("export-csv"),
    filterTotalHours: document.getElementById("filter-total-hours"),
    feedback: document.getElementById("feedback"),
    activeFilters: document.getElementById("active-filters"),
    entriesBody: document.getElementById("entries-body"),
    expensesBody: document.getElementById("expenses-body"),
    clientList: document.getElementById("client-list"),
    clientEditor: document.getElementById("client-editor"),
    projectList: document.getElementById("project-list"),
    projectColumnLabel: document.getElementById("project-column-label"),
    userList: document.getElementById("user-list"),
    mainFrame: document.querySelector(".app-frame"),
    userFeedback: document.getElementById("user-feedback"),
    membersList: document.getElementById("members-list"),
    membersTitle: document.getElementById("members-modal-title"),
    membersSubtext: document.getElementById("members-modal-subtext"),
    membersFeedback: document.getElementById("members-feedback"),
    membersConfirm: document.getElementById("members-confirm"),
    membersCancel: document.getElementById("members-cancel"),
    entryNonBillable: document.getElementById("entry-nonbillable"),
    expenseForm: document.getElementById("expense-form"),
    expenseFormHeading: document.getElementById("expense-form-heading"),
    expenseCancelEdit: document.getElementById("expense-cancel-edit"),
    expenseUser: document.getElementById("expense-user"),
    expenseClient: document.getElementById("expense-client"),
    expenseProject: document.getElementById("expense-project"),
    expenseDate: document.getElementById("expense-date"),
    expenseCategory: document.getElementById("expense-category"),
    expenseAmount: document.getElementById("expense-amount"),
    expenseNonBillable: document.getElementById("expense-nonbillable"),
    expenseNotes: document.getElementById("expense-notes"),
    submitExpense: document.getElementById("submit-expense"),
    filterFromMonth: document.getElementById("filter-from-month"),
    filterFromDay: document.getElementById("filter-from-day"),
    filterFromYear: document.getElementById("filter-from-year"),
    filterToMonth: document.getElementById("filter-to-month"),
    filterToDay: document.getElementById("filter-to-day"),
    filterToYear: document.getElementById("filter-to-year"),
    expenseFilterForm: document.getElementById("expense-filter-form"),
    expenseClearFilters: document.getElementById("expense-clear-filters"),
    expenseExportCsv: document.getElementById("expense-export-csv"),
    expenseFilterTotal: document.getElementById("expense-filter-total"),
    expenseActiveFilters: document.getElementById("expense-active-filters"),
    expenseFilterUser: document.getElementById("expense-filter-user"),
    expenseFilterClient: document.getElementById("expense-filter-client"),
    expenseFilterProject: document.getElementById("expense-filter-project"),
    expenseFilterFromMonth: document.getElementById("expense-filter-from-month"),
    expenseFilterFromDay: document.getElementById("expense-filter-from-day"),
    expenseFilterFromYear: document.getElementById("expense-filter-from-year"),
    expenseFilterToMonth: document.getElementById("expense-filter-to-month"),
    expenseFilterToDay: document.getElementById("expense-filter-to-day"),
    expenseFilterToYear: document.getElementById("expense-filter-to-year"),
    navAudit: document.getElementById("nav-audit"),
    navAuditMobile: document.getElementById("nav-audit-mobile"),
    auditView: document.getElementById("audit-page"),
    auditFilterForm: document.getElementById("audit-filter-form"),
    auditFilterEntity: document.getElementById("audit-filter-entity"),
    auditFilterAction: document.getElementById("audit-filter-action"),
    auditFilterActor: document.getElementById("audit-filter-actor"),
    auditTableBody: document.getElementById("audit-table-body"),
    appTopbar: document.querySelector(".app-topbar"),
  };

  if (refs.entryDate) {
    refs.entryDate.min = minEntryDate;
    refs.entryDate.max = today;
    refs.entryDate.addEventListener("change", () => {
      refs.entryDate.value = clampDateToBounds(refs.entryDate.value);
    });
  }

  if (refs.expenseDate) {
    refs.expenseDate.min = minEntryDate;
    refs.expenseDate.max = today;
    refs.expenseDate.addEventListener("change", () => {
      refs.expenseDate.value = clampDateToBounds(refs.expenseDate.value);
    });
    const expenseToday = clampDateToBounds(today);
    refs.expenseDate.value = expenseToday;
    refs.expenseDate.defaultValue = expenseToday;
  }

  initExpenseFilterDatePickers();

  // Enforce settings dropdown item order: Settings, Dark/Light, Change Password, Log out.
  if (refs.settingsMenu) {
    [
      refs.settingsMenuSettings,
      refs.themeToggle,
      refs.changePasswordOpen,
      refs.logoutButton,
    ].forEach(function (el) {
      if (el) refs.settingsMenu.appendChild(el);
    });
  }

  const DEFAULT_LEVEL_DEFS = {
    1: { label: "Staff", permissionGroup: "staff" },
    2: { label: "Senior", permissionGroup: "staff" },
    3: { label: "Manager", permissionGroup: "manager" },
    4: { label: "Director", permissionGroup: "manager" },
    5: { label: "Partner", permissionGroup: "admin" },
    6: { label: "Admin", permissionGroup: "admin" },
  };

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI",
    "MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
    "VT","VA","WA","WV","WI","WY","DC","PR","VI"
  ];

  const state = {
    catalog: {},
    clients: [],
    entries: [],
    expenses: [],
    filters: {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    },
    expenseFilters: {
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
    expenseCategories: [],
    account: null,
    projects: [],
    clientEditor: null,
    assignments: {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    },
    currentView: "main", // "main" | "expenses" | "clients" | "members" | "analytics" | "settings"
    expenseEditingId: null,
    auditLogs: [],
  auditFilters: {
    entity: "",
    action: "",
    actor: "",
    date: "",
  },
};

  // Expose audit dependencies for auditLog.js (no behavior change).
  window.auditLogDeps = {
    refs,
    state,
    escapeHtml,
    userNameById,
    projectNameById,
    clientNameById,
    formatDateTimeLocal,
    formatDisplayDate,
    parseDisplayDate,
  };

  window.expensesDeps = {
    refs,
    state,
    escapeHtml,
    setSelectOptionsWithPlaceholder,
    visibleCatalogClientNames,
    visibleCatalogProjectNames,
    getUserById,
    entryUserOptions,
    getUserByDisplayName,
    clampDateToBounds,
    today,
    setExpenseNonBillableDefault,
    parseDisplayDate,
    feedback,
    formatDisplayDate,
    formatDisplayDateShort,
    permissionGroupForUser,
    canUserAccessProject,
    isAdmin,
    field,
  };

  function arrangeSettingsMenu(showAudit) {
    if (!refs.settingsMenu) return;
    const items = [
      refs.settingsMenuSettings,
      showAudit ? refs.navAudit : null,
      refs.themeToggle,
      refs.changePasswordOpen,
      refs.logoutButton,
    ].filter(Boolean);
    if (showAudit && refs.settingsMenuSettings && refs.navAudit) {
      refs.navAudit.className = refs.settingsMenuSettings.className || "";
      refs.navAudit.style.marginLeft = "";
      refs.navAudit.style.paddingLeft = "";
    }
    items.forEach(function (el) {
      refs.settingsMenu.appendChild(el);
    });
  }

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
    initialAssigned: [],
    initialOverrides: {},
    assigned: [],
    overrides: {},
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
    const allowedKeys = new Set(
      allowedProjectTuples(state.currentUser).map((item) => projectKey(item.client, item.project))
    );
    if (!allowedKeys.size) {
      return [];
    }
    const allowedUserIds = new Set(
      (state.assignments?.projectMembers || [])
        .filter((item) => allowedKeys.has(projectKey(item.client, item.project)))
        .map((item) => item.userId)
    );
    allowedUserIds.add(state.currentUser.id);

    return state.users
      .filter(
        (user) =>
          allowedUserIds.has(user.id) &&
          (isStaff(user) || user.id === state.currentUser.id)
      )
      .map((user) => user.displayName)
      .filter(Boolean);
  }

  function applyLoadedState(data) {
    state.currentUser = data?.currentUser ? normalizeUser(data.currentUser) : null;
    state.users = Array.isArray(data?.users)
      ? data.users.map(normalizeUser).filter(Boolean)
      : [];
    state.bootstrapRequired = Boolean(data?.bootstrapRequired);
    state.catalog = normalizeCatalog(data?.catalog || {}, false);
    state.clients = Array.isArray(data?.clients)
      ? data.clients.map(normalizeClient).filter(Boolean)
      : [];
    state.entries = Array.isArray(data?.entries) ? data.entries.map(normalizeEntry).filter(Boolean) : [];
    state.expenses = Array.isArray(data?.expenses)
      ? data.expenses.map(normalizeExpense).filter(Boolean)
      : [];
    state.assignments = normalizeAssignments(data?.assignments);
    state.levelLabels = data?.levelLabels && typeof data.levelLabels === "object"
      ? data.levelLabels
      : {};
    state.expenseCategories = Array.isArray(data?.expenseCategories)
      ? data.expenseCategories.map((item) => {
          const activeRaw =
            item.isActive !== undefined ? item.isActive : item.is_active;
          const isActive =
            activeRaw === 0 || activeRaw === false ? false : true;
          return {
            id: item.id,
            name: item.name,
            isActive,
          };
        })
      : [];
    state.account = data?.account || null;
    const normalizedProjects = normalizeProjects(data?.projects);
    state.projects = normalizedProjects.length
      ? normalizedProjects
      : buildProjectsFromCatalog(state.catalog, {});
    state.clientEditor = null;
  }

  function clearRemoteAppState() {
    state.currentUser = null;
    state.users = [];
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
    state.clients = [];
    state.entries = [];
    state.expenses = [];
    state.projects = [];
    state.clientEditor = null;
    state.levelLabels = {};
    state.expenseCategories = [];
    state.account = null;
    state.assignments = {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    };
    state.auditLogs = [];
    resetAuditFilters();
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

  function resetAuditFilters() {
    state.auditFilters = {
      entity: "",
      action: "",
      actor: "",
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
        state.clients = [];
        state.entries = [];
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
        state.projects = [];
        state.clientEditor = null;
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
    resetAuditFilters();
    resetForm();
    resetExpenseForm();
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
    if (result && result.currentUser) {
      applyLoadedState(result);
      render();
    }
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
    if (refs.forcePasswordShell) {
      refs.forcePasswordShell.hidden = true;
    }
    refs.authShell.style.display = "grid";
    refs.appShell.style.display = "none";
  }

  function showAppShell() {
    refs.authShell.hidden = true;
    refs.appShell.hidden = false;
    if (refs.forcePasswordShell) {
      refs.forcePasswordShell.hidden = true;
    }
    refs.authShell.style.display = "none";
    refs.appShell.style.display = "block";
  }

  function showForcePasswordShell() {
    if (refs.forcePasswordShell) {
      refs.forcePasswordShell.hidden = false;
      refs.forcePasswordShell.setAttribute("aria-hidden", "false");
    }
    refs.authShell.hidden = true;
    refs.appShell.hidden = true;
    refs.authShell.style.display = "none";
    refs.appShell.style.display = "none";
  }

  function setView(view) {
    state.currentView = view;
    render();
  }

  function openUsersModal() {
    setView("members");
  }

  function closeUsersModal() {
    setView("main");
  }

  function openCatalogModal() {
    setView("clients");
  }

  function closeCatalogModal() {
    setView("main");
  }

  function openExpensesPage() {
    setView("expenses");
  }

  function openAnalyticsPage() {
    setView("analytics");
  }

  function closeAnalyticsPage() {
    setView("main");
  }

  function closeSettingsMenu() {
    if (refs.settingsMenu) {
      refs.settingsMenu.hidden = true;
    }
    if (refs.settingsToggle) {
      refs.settingsToggle.setAttribute("aria-expanded", "false");
    }
  }

  function toggleSettingsMenu() {
    if (!refs.settingsMenu || !refs.settingsToggle) {
      return;
    }
    const willOpen = refs.settingsMenu.hidden;
    refs.settingsMenu.hidden = !willOpen;
    refs.settingsToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function openMembersModal() {
    memberModalState.initialAssigned = Array.isArray(memberModalState.assigned)
      ? [...memberModalState.assigned]
      : [];
    memberModalState.initialOverrides = memberModalState.overrides
      ? { ...memberModalState.overrides }
      : {};
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

  function appDialog(options) {
    return new Promise((resolve) => {
      const title = options?.title || "";
      const message = options?.message || "";
      const confirmText = options?.confirmText || "OK";
      const cancelText = options?.cancelText || "Cancel";
      const showInput = Boolean(options?.input);
      const defaultValue = options?.defaultValue || "";

      refs.dialogTitle.textContent = title;
      refs.dialogMessage.textContent = message;
      refs.dialogInputRow.hidden = !showInput;
      refs.dialogInput.hidden = false;
      if (refs.dialogTextarea) {
        refs.dialogTextarea.hidden = true;
      }
      refs.dialogInput.value = defaultValue;
      refs.dialogConfirm.textContent = confirmText;
      refs.dialogCancel.textContent = cancelText;
      refs.dialog.hidden = false;
      refs.dialogConfirm.hidden = false;
      refs.dialogCancel.disabled = false;

      const cleanup = () => {
        refs.dialog.hidden = true;
        refs.dialogConfirm.removeEventListener("click", onConfirm);
        refs.dialogCancel.removeEventListener("click", onCancel);
      };

      const onConfirm = () => {
        cleanup();
        resolve({
          confirmed: true,
          value: showInput ? refs.dialogInput.value.trim() : undefined,
        });
      };
      const onCancel = () => {
        cleanup();
        resolve({ confirmed: false });
      };

      refs.dialogConfirm.addEventListener("click", onConfirm);
      refs.dialogCancel.addEventListener("click", onCancel);

      if (showInput) {
        refs.dialogInput.focus();
        refs.dialogInput.select();
      }
    });
  }

  function showNoteModal(entry) {
    return new Promise((resolve) => {
      if (!refs.dialog || !refs.dialogCancel || !refs.dialogConfirm || !refs.dialogTextarea) {
        resolve(false);
        return;
      }

      let mode = "view";
      const textarea = refs.dialogTextarea;

      const cleanup = () => {
        refs.dialog.hidden = true;
        refs.dialogConfirm.removeEventListener("click", onConfirm);
        refs.dialogCancel.removeEventListener("click", onCancel);
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        refs.dialogInput.hidden = false;
        textarea.hidden = true;
        refs.dialogConfirm.hidden = false;
        refs.dialogCancel.textContent = "Cancel";
      };

      const setViewMode = () => {
        mode = "view";
        refs.dialogTitle.textContent = "Note";
        refs.dialogMessage.textContent = entry.notes && entry.notes.trim() ? entry.notes : "(No note)";
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        textarea.hidden = true;
        refs.dialogConfirm.hidden = false;
        refs.dialogConfirm.textContent = "Edit";
        refs.dialogCancel.textContent = "Close";
      };

      const setEditMode = () => {
        mode = "edit";
        refs.dialogTitle.textContent = "Edit note";
        refs.dialogMessage.hidden = true;
        refs.dialogInputRow.hidden = false;
        refs.dialogInput.hidden = true;
        textarea.hidden = false;
        textarea.value = entry.notes || "";
        textarea.focus();
        refs.dialogConfirm.hidden = true;
        refs.dialogCancel.textContent = "Save";
      };

      const onConfirm = () => {
        if (mode === "view") {
          setEditMode();
        }
      };

      const onCancel = async () => {
        if (mode === "edit") {
          const nextNotes = textarea.value.trim();
          const payload = {
            entry: {
              ...entry,
              notes: nextNotes,
              updatedAt: new Date().toISOString(),
            },
          };
          try {
            await mutatePersistentState("save_entry", payload);
            feedback("Note saved.", false);
          } catch (error) {
            feedback(error.message || "Unable to save note.", true);
            cleanup();
            resolve(false);
            return;
          }
          cleanup();
          resolve(true);
          return;
        }

        cleanup();
        resolve(false);
      };

      refs.dialogConfirm.addEventListener("click", onConfirm);
      refs.dialogCancel.addEventListener("click", onCancel);
      refs.dialog.hidden = false;
      setViewMode();
    });
  }

  function showExpenseNoteModal(expense) {
    return new Promise((resolve) => {
      if (!refs.dialog || !refs.dialogCancel || !refs.dialogConfirm || !refs.dialogTextarea) {
        resolve(false);
        return;
      }

      let mode = "view";
      const textarea = refs.dialogTextarea;

      const cleanup = () => {
        refs.dialog.hidden = true;
        refs.dialogConfirm.removeEventListener("click", onConfirm);
        refs.dialogCancel.removeEventListener("click", onCancel);
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        refs.dialogInput.hidden = false;
        textarea.hidden = true;
        refs.dialogConfirm.hidden = false;
        refs.dialogCancel.textContent = "Cancel";
      };

      const setViewMode = () => {
        mode = "view";
        refs.dialogTitle.textContent = "Expense note";
        refs.dialogMessage.textContent =
          expense.notes && expense.notes.trim() ? expense.notes : "(No note)";
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        refs.dialogInput.hidden = true;
        textarea.hidden = true;
        refs.dialogConfirm.hidden = false;
        refs.dialogConfirm.textContent = "Edit";
        refs.dialogCancel.textContent = "Close";
      };

      const setEditMode = () => {
        mode = "edit";
        refs.dialogTitle.textContent = "Edit expense note";
        refs.dialogMessage.hidden = true;
        refs.dialogInputRow.hidden = false;
        refs.dialogInput.hidden = true;
        textarea.hidden = false;
        textarea.value = expense.notes || "";
        textarea.focus();
        refs.dialogConfirm.hidden = true;
        refs.dialogCancel.textContent = "Save";
      };

      const onConfirm = () => {
        if (mode === "view") {
          setEditMode();
        }
      };

      const onCancel = async () => {
        if (mode === "edit") {
          const nextNotes = textarea.value.trim();
          const payload = {
            expense: {
              ...expense,
              notes: nextNotes,
            },
          };
          try {
            await mutatePersistentState("update_expense", payload);
            feedback("Note saved.", false);
          } catch (error) {
            feedback(error.message || "Unable to save note.", true);
            cleanup();
            resolve(false);
            return;
          }
          cleanup();
          resolve(true);
          return;
        }

        cleanup();
        resolve(false);
      };

      refs.dialogConfirm.addEventListener("click", onConfirm);
      refs.dialogCancel.addEventListener("click", onCancel);
      setViewMode();
      refs.dialog.hidden = false;
    });
  }

  function normalizeCatalog(catalog, fallbackToDefault = true) {
    const source =
      catalog && typeof catalog === "object"
        ? catalog
        : fallbackToDefault
          ? DEFAULT_CLIENT_PROJECTS
          : {};
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

    return Object.keys(normalized).length
      ? normalized
      : fallbackToDefault
        ? { ...DEFAULT_CLIENT_PROJECTS }
        : {};
  }

  function normalizeClient(client) {
    if (!client || typeof client !== "object") return null;
    const name = typeof client.name === "string" ? client.name.trim() : "";
    if (!name) return null;
    const clean = (value) => (typeof value === "string" ? value.trim() : "");
    const billingName =
      clean(client.billingContactName || client.billing_contact_name) ||
      clean(
        [client.adminContactFirstName, client.admin_contact_first_name, client.adminContactLastName, client.admin_contact_last_name]
          .filter(Boolean)
          .join(" ")
      );
    return {
      id: client.id,
      name,
      businessContactName: clean(
        client.businessContactName ||
          client.business_contact_name ||
          [client.businessContactFirstName, client.business_contact_first_name, client.businessContactLastName, client.business_contact_last_name]
            .filter(Boolean)
            .join(" ")
      ),
      businessContactEmail: clean(client.businessContactEmail || client.business_contact_email),
      businessContactPhone: clean(client.businessContactPhone || client.business_contact_phone),
      billingContactName: billingName,
      billingContactEmail: clean(client.billingContactEmail || client.billing_contact_email || client.adminContactEmail || client.admin_contact_email),
      billingContactPhone: clean(client.billingContactPhone || client.billing_contact_phone || client.adminContactPhone || client.admin_contact_phone),
      addressStreet: clean(client.addressStreet || client.address_street || client.clientAddress || client.client_address),
      addressCity: clean(client.addressCity || client.address_city),
      addressState: clean(client.addressState || client.address_state),
      addressPostal: clean(client.addressPostal || client.address_postal),
    };
  }

  function isNonBillableDefault(projectName) {
    return /administrative|admin|internal/i.test(projectName || "");
  }

  function setNonBillableDefault(projectName) {
    if (!refs.entryNonBillable) return;
    refs.entryNonBillable.checked = isNonBillableDefault(projectName);
  }

  function setExpenseNonBillableDefault(projectName) {
    if (!refs.expenseNonBillable) return;
    refs.expenseNonBillable.checked = isNonBillableDefault(projectName);
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
    const status =
      typeof entry.status === "string" && entry.status.toLowerCase() === "approved"
        ? "approved"
        : "pending";
    const billable =
      typeof entry.billable === "boolean"
        ? entry.billable
        : !(typeof entry.nonBillable === "boolean" ? entry.nonBillable : false);

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
      status,
      billable,
    };
  }

  function normalizeExpense(expense) {
    if (!expense || typeof expense !== "object") return null;
    const createdAt =
      typeof expense.createdAt === "string" && expense.createdAt
        ? expense.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof expense.updatedAt === "string" && expense.updatedAt
        ? expense.updatedAt
        : createdAt;
    const status =
      typeof expense.status === "string" && expense.status.toLowerCase() === "approved"
        ? "approved"
        : "pending";
    const amount = Number(expense.amount);
    const billableRaw =
      expense.isBillable !== undefined
        ? expense.isBillable
        : expense.is_billable !== undefined
          ? expense.is_billable
          : undefined;
    const isBillable =
      billableRaw === false || billableRaw === 0 || billableRaw === "0"
        ? false
        : true;

    return {
      id: typeof expense.id === "string" && expense.id ? expense.id : crypto.randomUUID(),
      userId: expense.userId || expense.user_id || "",
      clientName: expense.clientName || expense.client_name || "",
      projectName: expense.projectName || expense.project_name || "",
      expenseDate: expense.expenseDate || expense.expense_date || today,
      category: expense.category || "",
      amount: Number.isFinite(amount) ? amount : 0,
      isBillable,
      notes: typeof expense.notes === "string" ? expense.notes : "",
      status,
      approvedAt: expense.approvedAt || expense.approved_at || null,
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

  function userInitials(user) {
    const name = (user?.displayName || user?.username || "").trim();
    if (!name) return "??";
    const parts = name.split(/\s+/).filter(Boolean);
    const letters = (parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "");
    return letters.toUpperCase();
  }

  function field(form, name) {
    return form?.elements?.namedItem(name);
  }

  function setOptions(select, values, placeholder) {
    if (!select) return;
    const opts = [
      placeholder ? `<option value=\"\">${escapeHtml(placeholder)}</option>` : "",
      ...values.map((val) => `<option value=\"${escapeHtml(val)}\">${escapeHtml(val)}</option>`),
    ];
    select.innerHTML = opts.join("");
  }

  function initExpenseFilterDatePickers() {
    const monthValues = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    const dayValues = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
    const yearNow = Number(today.split("-")[0]);
    const yearValues = [yearNow, yearNow - 1].map(String);

    setOptions(refs.expenseFilterFromMonth, monthValues, "MM");
    setOptions(refs.expenseFilterFromDay, dayValues, "DD");
    setOptions(refs.expenseFilterFromYear, yearValues, "YY");
    setOptions(refs.expenseFilterToMonth, monthValues, "MM");
    setOptions(refs.expenseFilterToDay, dayValues, "DD");
    setOptions(refs.expenseFilterToYear, yearValues, "YY");
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

  function expenseFilterDateRefs(kind) {
    if (kind === "from") {
      return {
        month: refs.expenseFilterFromMonth,
        day: refs.expenseFilterFromDay,
        year: refs.expenseFilterFromYear,
      };
    }
    return {
      month: refs.expenseFilterToMonth,
      day: refs.expenseFilterToDay,
      year: refs.expenseFilterToYear,
    };
  }

  function updateExpenseFilterDateFromPicker(kind) {
    const refsForKind = expenseFilterDateRefs(kind);
    const input = field(refs.expenseFilterForm, kind);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year || !input) {
      return;
    }

    const month = refsForKind.month.value;
    const day = refsForKind.day.value;
    const year = refsForKind.year.value;
    if (!month || !day || !year) {
      input.value = "";
      if (state.expenseFilters[kind]) {
        applyExpenseFiltersFromForm({ showErrors: false });
      }
      return;
    }

    const iso = `${year}-${month}-${day}`;
    if (!isValidDateString(iso)) {
      input.value = "";
      applyExpenseFiltersFromForm({ showErrors: false });
      return;
    }

    input.value = `${month}/${day}/${year}`;
    applyExpenseFiltersFromForm({ showErrors: false });
  }

  function catalogClientNames() {
    return Object.keys(state.catalog).sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogClientNames(targetUser) {
    const user = targetUser || state.currentUser;
    if (!user) {
      return catalogClientNames();
    }
    return isAdmin(user)
      ? catalogClientNames()
      : allowedClientsForUser(user);
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

  function visibleCatalogProjectNames(client, targetUser) {
    const user = targetUser || state.currentUser;
    if (!user) {
      return catalogProjectNames(client);
    }
    if (isAdmin(user)) {
      return catalogProjectNames(client);
    }
    return allowedProjectsForClient(user, client);
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

  function clientByName(name) {
    const target = typeof name === "string" ? name.trim().toLowerCase() : "";
    if (!target) return null;
    return state.clients.find((client) => client.name.toLowerCase() === target) || null;
  }

  function emptyClientDetails(name) {
    return {
      name: name || "",
      businessContactFirstName: "",
      businessContactLastName: "",
      businessContactEmail: "",
      businessContactPhone: "",
      clientAddress: "",
      adminContactFirstName: "",
      adminContactLastName: "",
      adminContactEmail: "",
      adminContactPhone: "",
    };
  }

  function buildClientEditorValues(name) {
    const existing = clientByName(name) || {};
    return {
      ...emptyClientDetails(existing.name || name),
      ...existing,
    };
  }

  function applyClientNameChange(previousName, nextName) {
    const prev = (previousName || "").trim();
    const next = (nextName || "").trim();
    if (!next) return;
    if (state.selectedCatalogClient === prev) {
      state.selectedCatalogClient = next;
    }
    if (state.filters.client === prev) {
      state.filters.client = next;
    }
    if (state.expenseFilters?.client === prev) {
      state.expenseFilters.client = next;
    }
  }

  function openClientEditor({ mode, clientName }) {
    const editorMode = mode === "edit" ? "edit" : "create";
    const values = buildClientEditorValues(clientName || "");
    state.clientEditor = {
      mode: editorMode,
      originalName: values.name || clientName || "",
      values,
    };
    renderClientEditor();
    postHeight();
  }

  function closeClientEditor() {
    state.clientEditor = null;
    if (refs.clientEditor) {
      refs.clientEditor.innerHTML = "";
    }
  }

  function renderStateOptions(selected) {
    const current = (selected || "").toUpperCase();
    return ['<option value=""></option>', ...US_STATES.map((state) => {
      const isSelected = state === current ? "selected" : "";
      return `<option value="${state}" ${isSelected}>${state}</option>`;
    })].join("");
  }

  function setFieldError(form, name, isError) {
    const input = field(form, name);
    if (!input) return;
    input.classList.toggle("field-error", Boolean(isError));
  }

  function setClientEditorMessage(form, message) {
    const el = form?.querySelector?.("[data-client-editor-message]");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.dataset.error = message ? "true" : "false";
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
    isExecutive,
    isStaff,
    isAdmin,
    permissionGroupForUser,
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
    const selectedUserName = selection?.user || "";
    const targetUser =
      selectedUserName && state.users.length
        ? state.users.find((u) => u.displayName === selectedUserName) || state.currentUser
        : state.currentUser;

    syncFormCatalogs?.(
      {
        refs,
        state,
        field,
        entryUserOptions,
        visibleCatalogClientNames,
        visibleCatalogProjectNames,
        targetUser,
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

  function syncExpenseFilterCatalogsUI(selection) {
    const selectedUserId = selection?.user || "";
    const selectedClient = selection?.client || "";
    const selectedProject = selection?.project || "";

    if (refs.expenseFilterUser) {
      const users = entryUserOptions().map((name) => {
        const user = getUserByDisplayName(name);
        return { label: name, value: user?.id || name };
      });
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        refs.expenseFilterUser,
        users,
        selectedUserId,
        "All users"
      );
    }

    if (refs.expenseFilterClient) {
      const clients = visibleCatalogClientNames();
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        refs.expenseFilterClient,
        clients,
        selectedClient,
        "All clients"
      );
    }

    if (refs.expenseFilterProject) {
      const projects = selectedClient
        ? visibleCatalogProjectNames(selectedClient, getUserById?.(selectedUserId))
        : [];
      const placeholder = selectedClient ? "All projects" : "Choose client first";
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        refs.expenseFilterProject,
        projects,
        selectedProject,
        placeholder
      );
    }
  }

  function resetForm() {
    refs.form.reset();
    state.editingId = null;
    syncFormCatalogsUI({
      user: defaultEntryUser(state),
      client: "",
      project: "",
    });
    if (refs.entryDate) {
      refs.entryDate.value = clampDateToBounds(today);
    }
    field(refs.form, "hours").value = "";
    refs.otherHours.value = "";
    renderHourSelection?.({ refs, field });
    setNonBillableDefault(field(refs.form, "project")?.value || "");
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
    if (refs.entryDate) {
      refs.entryDate.value = clampDateToBounds(entry.date);
    }
    field(refs.form, "hours").value = entry.hours;
    field(refs.form, "notes").value = entry.notes;
    refs.otherHours.value = QUICK_HOUR_PRESETS.has(String(entry.hours)) ? "" : String(entry.hours);
    renderHourSelection?.({ refs, field });
    if (refs.entryNonBillable) {
      refs.entryNonBillable.checked = entry.billable === false;
    }
    state.editingId = entry.id;
    refs.formHeading.textContent = "Edit timesheet entry";
    refs.submitEntry.textContent = "Save";
    refs.cancelEdit.hidden = false;
    const formCard = refs.form?.closest(".panel") || refs.form;
    formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  async function loadAuditLogs() {
    if (!isAdmin(state.currentUser)) return;
    try {
      const sessionToken = loadSessionToken();
      const payload = await requestJson(MUTATE_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          action: "list_audit_logs",
          payload: {
            sessionToken,
            filters: {
              entityType: state.auditFilters.entity || undefined,
              action: state.auditFilters.action || undefined,
              actorId: state.auditFilters.actor || undefined,
            },
          },
        }),
      });
      state.auditLogs = Array.isArray(payload?.auditLogs) ? payload.auditLogs : [];
      renderAuditTable(filterAuditLogs(state.auditLogs));
    } catch (error) {
      feedback("Unable to load audit logs.", true);
    }
  }

  function renderClientEditor() {
    if (!refs.clientEditor) return;
    const editor = state.clientEditor;
    if (!editor) {
      refs.clientEditor.innerHTML = "";
      refs.clientEditor.hidden = true;
      return;
    }

    refs.clientEditor.hidden = false;
    const values = editor.values || {};
    const isEditable = isAdmin(state.currentUser);
    const saveLabel = editor.mode === "edit" ? "Save client" : "Create client";
    const title = editor.mode === "edit" ? "Edit client" : "New client";
    const disabledAttr = isEditable ? "" : "disabled";

    refs.clientEditor.innerHTML = `
      <div class="client-editor-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <form class="client-editor-card" data-client-editor-form="${escapeHtml(editor.mode)}">
          <p class="client-editor-message" data-client-editor-message hidden></p>
          <div class="client-editor-grid">
            <div class="client-editor-row">
              <label class="client-editor-field">
                <span>Client name</span>
                <input type="text" name="client_name" value="${escapeHtml(values.name || "")}" ${disabledAttr} required />
              </label>
            </div>
            <div class="client-editor-row">
              <div class="client-editor-row-label">Business Contact</div>
              <div class="client-editor-row-fields">
                <label class="client-editor-field">
                  <span>Name</span>
                  <input type="text" name="business_contact_name" value="${escapeHtml(values.businessContactName || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>Email</span>
                  <input type="email" name="business_contact_email" value="${escapeHtml(values.businessContactEmail || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>Phone</span>
                  <input type="tel" name="business_contact_phone" value="${escapeHtml(values.businessContactPhone || "")}" ${disabledAttr} />
                </label>
              </div>
            </div>
            <div class="client-editor-row">
              <div class="client-editor-row-label">Billing Contact</div>
              <div class="client-editor-row-fields">
                <label class="client-editor-field">
                  <span>Name</span>
                  <input type="text" name="billing_contact_name" value="${escapeHtml(values.billingContactName || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>Email</span>
                  <input type="email" name="billing_contact_email" value="${escapeHtml(values.billingContactEmail || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>Phone</span>
                  <input type="tel" name="billing_contact_phone" value="${escapeHtml(values.billingContactPhone || "")}" ${disabledAttr} />
                </label>
              </div>
            </div>
            <div class="client-editor-row">
              <div class="client-editor-row-label">Address</div>
              <div class="client-editor-row-fields">
                <label class="client-editor-field">
                  <span>Street</span>
                  <input type="text" name="address_street" value="${escapeHtml(values.addressStreet || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>City</span>
                  <input type="text" name="address_city" value="${escapeHtml(values.addressCity || "")}" ${disabledAttr} />
                </label>
                <label class="client-editor-field">
                  <span>State</span>
                  <select name="address_state" ${disabledAttr}>
                    ${renderStateOptions(values.addressState)}
                  </select>
                </label>
                <label class="client-editor-field">
                  <span>Zip code</span>
                  <input type="text" name="address_postal" value="${escapeHtml(values.addressPostal || "")}" ${disabledAttr} />
                </label>
              </div>
            </div>
          </div>
          <div class="client-editor-actions">
            <button type="button" class="button button-ghost" data-cancel-client>Cancel</button>
            <button type="submit" class="button" ${disabledAttr}>${escapeHtml(saveLabel)}</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderCatalogAside() {
    if (!renderCatalogLists) {
      return;
    }
    renderClientEditor();
    renderCatalogLists({
      refs,
      state,
      visibleCatalogClientNames,
      visibleCatalogProjectNames,
      isAdmin,
      isExecutive,
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

  function projectNameById(id) {
    if (!id) return "";
    const match = state.projects.find((p) => String(p.id) === String(id));
    return match?.name || "";
  }

  function clientNameById(id, projectId) {
    if (projectId) {
      const project = state.projects.find((p) => String(p.id) === String(projectId));
      if (project?.client) return project.client;
    }
    if (!id) return "";
    const project = state.projects.find((p) => String(p.client_id) === String(id));
    if (project?.client) return project.client;
    return "";
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
      levels: sortedLevels(),
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

  function renderLevelRows() {
    if (!refs.levelRows) return;

    const sorted = getLevelDefinitions();

    refs.levelRows.innerHTML = sorted
      .map(
        (item) => `
          <div class="level-row" data-level="${item.level}">
            <span class="level-num">Level ${item.level}</span>
            <input type="text" value="${escapeHtml(item.label || "")}" data-level-label />
            <select data-level-permission>
              ${["staff", "manager", "executive", "admin"]
                .map(
                  (group) =>
                    `<option value="${group}"${group === item.permissionGroup ? " selected" : ""}>${group}</option>`
                )
                .join("")}
            </select>
            <button type="button" class="level-delete" data-level-delete aria-label="Delete level">Delete</button>
          </div>
        `
      )
      .join("");

    const isEditable = isAdmin(state.currentUser);
    refs.levelRows.querySelectorAll("input, select").forEach(function (el) {
      el.disabled = !isEditable;
    });
    if (refs.addLevel) {
      refs.addLevel.disabled = !isEditable;
    }
  }

  function renderExpenseCategories() {
    if (!refs.expenseRows) return;

    const categories = state.expenseCategories.length
      ? [...state.expenseCategories]
      : [];

    refs.expenseRows.innerHTML = categories
      .map(
        (item) => `
          <div class="level-row expense-row" data-expense-id="${escapeHtml(item.id || "")}">
            <span class="level-num sr-only">Category</span>
            <input type="text" value="${escapeHtml(item.name || "")}" data-expense-name placeholder="Category name" />
            <div class="expense-actions">
              <button
                type="button"
                class="expense-toggle ${item.isActive === false ? "is-inactive" : "is-active"}"
                data-expense-active
                data-active="${item.isActive === false ? "false" : "true"}"
                aria-pressed="${item.isActive === false ? "false" : "true"}"
              >
                ${item.isActive === false ? "Inactive" : "Active"}
              </button>
              <button type="button" class="expense-delete" data-expense-delete>Delete</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  function sortedLevels() {
    const rank = (level) => {
      const group = permissionGroupForUser({ level }) || "staff";
      if (group === "staff") return 0;
      if (group === "manager") return 1;
      if (group === "executive") return 2;
      return 3; // admin or anything higher
    };
    const fromState = Object.keys(state.levelLabels || {}).map((l) => Number(l));
    const levels = fromState.length
      ? fromState
      : Object.keys(DEFAULT_LEVEL_DEFS).map((l) => Number(l));
    return Array.from(new Set(levels))
      .filter((l) => Number.isFinite(l))
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        return rankDiff !== 0 ? rankDiff : a - b;
      });
  }

  function getLevelDefinitions() {
    const levels = sortedLevels();
    return levels.map(function (lvl) {
      const value = state.levelLabels?.[lvl];
      const label =
        value && typeof value === "object"
          ? value.label
          : typeof value === "string"
            ? value
            : DEFAULT_LEVEL_DEFS[lvl]?.label || `Level ${lvl}`;
      const permissionGroup =
        value && typeof value === "object"
          ? value.permissionGroup || value.permission_group
          : DEFAULT_LEVEL_DEFS[lvl]?.permissionGroup || "staff";
      return { level: lvl, label, permissionGroup };
    });
  }

  function syncUserManagementControls() {
    usersSyncUserManagementControls?.({
      refs,
      state,
      isAdmin,
      isGlobalAdmin,
      levelLabel,
      levels: sortedLevels(),
      escapeHtml,
      field,
    });
  }

  function handleAddLevel() {
    if (!isAdmin(state.currentUser)) {
      feedback("Only Admins can edit levels.", true);
      return;
    }
    const currentLevels = sortedLevels();
    const maxLevel = currentLevels.length ? Math.max(...currentLevels) : 6;
    const nextLevel = maxLevel + 1;
    state.levelLabels = {
      ...state.levelLabels,
      [nextLevel]: {
        label: `Level ${nextLevel}`,
        permissionGroup: "staff",
      },
    };
    renderLevelRows();
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
      levels: sortedLevels(),
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      normalizeLevel: normalizeModalLevel,
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

  function normalizeModalLevel(level) {
    const group = permissionGroupForUser({ level });
    if (group === "admin") return 5;
    if (group === "executive") return 4;
    if (group === "manager") return 3;
    return 1; // staff
  }

  function renderAuthUi() {
    const isAuthenticated = Boolean(state.currentUser);

    if (isAuthenticated) {
      if (state.currentUser?.mustChangePassword) {
        showForcePasswordShell();
      } else {
        showAppShell();
      }
    } else {
      showAuthShell();
    }

    refs.loginForm.hidden = state.bootstrapRequired;
    refs.bootstrapForm.hidden = !state.bootstrapRequired;
    refs.authSubtext.textContent = state.bootstrapRequired
      ? "Create the first Admin account to activate team logins."
      : "Sign in with your team member credentials to continue.";

    // header visibility handled in render()
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

  async function submitForcePassword(event) {
    event.preventDefault();
    const currentPassword = refs.forcePasswordCurrent.value.trim();
    const newPassword = refs.forcePasswordNew.value.trim();
    const confirmPassword = refs.forcePasswordConfirm.value.trim();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setAuthFeedback("All password fields are required.", true);
      return;
    }
    if (newPassword.length < 8) {
      setAuthFeedback("New password must be at least 8 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthFeedback("Passwords do not match.", true);
      return;
    }
    try {
      await mutatePersistentState("change_own_password", {
        currentPassword,
        newPassword,
      });
      await loadPersistentState();
      refs.forcePasswordForm.reset();
      showAppShell();
      render();
    } catch (error) {
      setAuthFeedback(error.message || "Unable to change password.", true);
    }
  }

  function openChangePasswordModal() {
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = false;
    refs.changePasswordCurrent.value = "";
    refs.changePasswordNew.value = "";
    refs.changePasswordConfirm.value = "";
    refs.changePasswordCurrent.focus();
  }

  function closeChangePasswordModal() {
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = true;
  }

  async function submitChangePassword(event) {
    event.preventDefault();
    const currentPassword = refs.changePasswordCurrent.value.trim();
    const newPassword = refs.changePasswordNew.value.trim();
    const confirmPassword = refs.changePasswordConfirm.value.trim();
    if (!currentPassword || !newPassword || !confirmPassword) {
      feedback("All password fields are required.", true);
      return;
    }
    if (newPassword.length < 8) {
      feedback("New password must be at least 8 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      feedback("Passwords do not match.", true);
      return;
    }
    try {
      await mutatePersistentState("change_own_password", {
        currentPassword,
        newPassword,
      });
      closeChangePasswordModal();
      feedback("Password updated.", false);
    } catch (error) {
      feedback(error.message || "Unable to change password.", true);
      return;
    }
    render();
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
    const costRateRaw = formData.get("cost_rate");
    const costRate =
      costRateRaw !== null && costRateRaw !== ""
        ? Number(costRateRaw)
        : null;
    if (costRate !== null && (!Number.isFinite(costRate) || costRate < 0)) {
      const message = "Cost rate must be a non-negative number.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    try {
      await mutatePersistentState("add_user", {
        displayName,
        username,
        password,
        level,
        baseRate,
        costRate,
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
    const panelEdit = event.target.closest("[data-user-panel-edit]");
    const panelCancel = event.target.closest("[data-user-panel-cancel]");
    const panelSave = event.target.closest("[data-user-panel-save]");
    if (panelEdit || panelCancel || panelSave) {
      if (!isAdmin(state.currentUser)) {
        const message = "Only Admins can edit team members.";
        setUserFeedback(message, true);
        window.alert(message);
        return;
      }
      if (panelCancel) {
        usersSetDetailEditState?.(null, false, {});
        render();
        return;
      }
      if (panelEdit) {
        const user = state.users.find((u) => u.id === panelEdit.dataset.userPanelEdit);
        if (!user) {
          return;
        }
        usersSetDetailEditState?.(user.id, true, {
          displayName: user.displayName,
          username: user.username,
          level: user.level,
          baseRate: user.baseRate ?? "",
          costRate: user.costRate ?? "",
        });
        render();
        return;
      }
      if (panelSave) {
        const userId = panelSave.dataset.userPanelSave;
        const user = state.users.find((u) => u.id === userId);
        if (!user) {
          return;
        }
        const detailCard =
          panelSave.closest(".user-detail-card") || refs.userList.querySelector(".user-detail-card");
        if (!detailCard) {
          return;
        }
        const displayNameInput = detailCard.querySelector('[data-user-field="displayName"]');
        const usernameInput = detailCard.querySelector('[data-user-field="username"]');
        const levelSelect = detailCard.querySelector('[data-user-field="level"]');
        const baseInput = detailCard.querySelector('[data-user-field="baseRate"]');
        const costInput = detailCard.querySelector('[data-user-field="costRate"]');
        const nextDisplayName = displayNameInput?.value.trim() || "";
        const nextUsername = usernameInput?.value.trim() || "";
        const nextLevel = Number(levelSelect?.value || user.level);
        const baseRaw = baseInput?.value.trim();
        const costRaw = costInput?.value.trim();
        const nextBase = baseRaw ? Number(baseRaw) : null;
        const nextCost = costRaw ? Number(costRaw) : null;
        if (!nextDisplayName) {
          setUserFeedback("Name is required.", true);
          return;
        }
        if (!nextUsername) {
          setUserFeedback("Username is required.", true);
          return;
        }
        if (!Number.isInteger(nextLevel) || nextLevel < 1 || nextLevel > 6) {
          setUserFeedback("Invalid level.", true);
          return;
        }
        if (nextBase !== null && (!Number.isFinite(nextBase) || nextBase < 0)) {
          setUserFeedback("Base rate must be a non-negative number.", true);
          return;
        }
        if (nextCost !== null && (!Number.isFinite(nextCost) || nextCost < 0)) {
          setUserFeedback("Cost rate must be a non-negative number.", true);
          return;
        }
        try {
          await mutatePersistentState("update_user", {
            userId: user.id,
            displayName: nextDisplayName,
            username: nextUsername,
            level: nextLevel,
            baseRate: nextBase,
            costRate: nextCost,
          });
          usersSetDetailEditState?.(null, false, {});
          setUserFeedback("Team member updated.", false);
        } catch (error) {
          setUserFeedback(error.message || "Unable to update team member.", true);
          return;
        }
        render();
        return;
      }
    }
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
        const nameDialog = await appDialog({
          title: "Team member name",
          input: true,
          defaultValue: user.displayName,
          confirmText: "Next",
        });
        if (!nameDialog.confirmed) {
          return;
        }
        const nextDisplayName = nameDialog.value || "";

        const usernameDialog = await appDialog({
          title: "Username",
          input: true,
          defaultValue: user.username,
          confirmText: "Next",
        });
        if (!usernameDialog.confirmed) {
          return;
        }
        const nextUsername = usernameDialog.value || "";

        const costDialog = await appDialog({
          title: "Cost rate (optional)",
          message: "Enter a non-negative number or leave blank.",
          input: true,
          defaultValue:
            user.costRate !== null && user.costRate !== undefined ? String(user.costRate) : "",
        });
        if (!costDialog.confirmed) {
          return;
        }
        const nextCostRateRaw = (costDialog.value || "").trim();
        const nextCostRate = nextCostRateRaw === "" ? null : Number(nextCostRateRaw);
        if (nextCostRate !== null && (!Number.isFinite(nextCostRate) || nextCostRate < 0)) {
          const message = "Cost rate must be a non-negative number.";
          setUserFeedback(message, true);
          window.alert(message);
          return;
        }

        await mutatePersistentState("update_user", {
          userId: user.id,
          displayName: nextDisplayName,
          username: nextUsername,
          level: user.level,
          costRate: nextCostRate,
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
        const dialog = await appDialog({
          title: `Enter a new password for ${user.displayName}`,
          message: "Minimum 8 characters",
          input: true,
          confirmText: "Save",
        });
        if (!dialog.confirmed) {
          return;
        }
        const nextPassword = dialog.value || "";
        await mutatePersistentState("reset_user_password", {
          userId: user.id,
          password: nextPassword,
        });
        setUserFeedback(`Password updated for ${user.displayName}.`, false);
      } else if (button.dataset.userDeactivate) {
        const dialog = await appDialog({
          title: `Deactivate ${user.displayName}?`,
          confirmText: "Deactivate",
          cancelText: "Cancel",
        });
        if (!dialog.confirmed) {
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

  function canManageApproval(entry) {
    const current = state.currentUser;
    if (!current) {
      return false;
    }
    if (!entry) {
      return false;
    }

    const currentGroup = permissionGroupForUser(current);
    const targetUser = getUserByDisplayName(entry.user);
    const targetGroup = permissionGroupForUser(targetUser);

    if (current.displayName === entry.user) {
      return false;
    }

    if (currentGroup === "staff") {
      return false;
    }

    if (currentGroup === "manager") {
      if (targetGroup !== "staff") {
        return false;
      }
      return canUserAccessProject(current, entry.client, entry.project);
    }

    if (currentGroup === "executive" || currentGroup === "admin") {
      if (!isAdmin(current) && !canUserAccessProject(current, entry.client, entry.project)) {
        return false;
      }
      return true;
    }

    return false;
  }

  function canApproveEntry(entry) {
    return entry.status !== "approved" && canManageApproval(entry);
  }

  function canUnapproveEntry(entry) {
    return entry.status === "approved" && canManageApproval(entry);
  }

  function showApproveButton(entry) {
    return canApproveEntry(entry);
  }

  function renderTable(filteredEntries) {
    if (!filteredEntries.length) {
      refs.entriesBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-row">
            <div class="empty-state-panel">
              <strong>No entries match the current filters.</strong>
              <span>Clear the filters or add a new entry to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Store full-range dates (unfiltered) for picker bounds
    if (refs.entriesBody) {
      const dates = state.entries.map((e) => e.date).sort();
      refs.entriesBody.dataset.rangeMin = dates[0] || "";
      refs.entriesBody.dataset.rangeMax = dates[dates.length - 1] || "";
    }

    refs.entriesBody.innerHTML = filteredEntries
      .map(
        (entry) => `
          <tr class="entry-row ${entry.status === "approved" ? "entry-approved" : ""}">
            <td>${escapeHtml(formatDisplayDateShort(entry.date))}</td>
            <td>${escapeHtml(entry.user)}</td>
            <td>${escapeHtml(entry.client)}</td>
            <td>${escapeHtml(entry.project)}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>
              <span
                class="billable-pill ${entry.billable === false ? "is-nonbillable" : "is-billable"} is-clickable"
                data-action="toggle-billable"
                data-id="${entry.id}"
                role="button"
                aria-label="${entry.billable === false ? "Mark as billable" : "Mark as non-billable"}"
                tabindex="0"
              >
                ${entry.billable === false ? "Non-billable" : "Billable"}
              </span>
            </td>
            <td class="notes-cell">
              ${
                entry.notes && entry.notes.trim()
                  ? `<button class="note-button" type="button" data-action="note" data-id="${entry.id}" aria-label="View note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8M8 14h5" />
                      </svg>
                    </button>`
                  : `<button class="note-button note-button--empty" type="button" data-action="note" data-id="${entry.id}" aria-label="Add note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8" />
                      </svg>
                    </button>`
              }
            </td>
            <td>
              <span
                class="entry-status entry-status-${entry.status} ${
                  canManageApproval(entry) ? "entry-status-clickable" : ""
                }"
                ${canManageApproval(entry) ? `data-action="toggle-status" data-id="${entry.id}" role="button" tabindex="0"` : ""}
                aria-label="${entry.status === "approved" ? "Approved" : "Pending"}"
              >
                ${entry.status === "approved" ? "Approved" : "Pending"}
              </span>
            </td>
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
    if (state.currentUser.mustChangePassword) {
      postHeight();
      return;
    }

    if (refs.mobileTabbar) {
      refs.mobileTabbar.hidden = false;
    }

    const view = state.currentView;

    if (refs.appShell) {
      refs.appShell.classList.toggle("page-clients", view === "clients");
      refs.appShell.classList.toggle("page-members", view === "members");
      refs.appShell.classList.toggle("page-analytics", view === "analytics");
    }

    const currentLevel = normalizeLevel(state.currentUser?.level);

    if (refs.accountName) {
      refs.accountName.hidden = false;
      refs.accountName.textContent = state.account?.name || "";
    }
    if (refs.sessionIndicator) {
      refs.sessionIndicator.hidden = false;
      refs.sessionIndicator.textContent = userInitials(state.currentUser);
    }
    if (refs.settingsMenuHeader) {
      const fullName = state.currentUser?.displayName || state.currentUser?.username || "";
      if (fullName) {
        refs.settingsMenuHeader.hidden = false;
        refs.settingsMenuHeader.textContent = fullName;
      } else {
        refs.settingsMenuHeader.hidden = true;
        refs.settingsMenuHeader.textContent = "";
      }
    }
    const currentGroup = permissionGroupForUser(state.currentUser);
    if (refs.navSettings) {
      refs.navSettings.hidden = true;
      refs.navSettings.classList.toggle("is-active", false);
      refs.navSettings.setAttribute("aria-current", "false");
    }
    if (refs.navSettingsMobile) {
      refs.navSettingsMobile.hidden = true;
      refs.navSettingsMobile.classList.toggle("is-active", false);
      refs.navSettingsMobile.setAttribute("aria-current", "false");
    }
    if (refs.navMembers) {
      const showMembers = isAdmin(state.currentUser) || isGlobalAdmin(state.currentUser);
      refs.navMembers.hidden = !showMembers;
      refs.navMembers.classList.toggle("is-active", view === "members");
      refs.navMembers.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.navMembersMobile) {
      const showMembers = isAdmin(state.currentUser) || isGlobalAdmin(state.currentUser);
      refs.navMembersMobile.hidden = !showMembers;
      refs.navMembersMobile.classList.toggle("is-active", view === "members");
      refs.navMembersMobile.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.openCatalog) {
      refs.openCatalog.hidden = !(currentGroup === "manager" || currentGroup === "executive" || currentGroup === "admin");
      refs.openCatalog.classList.toggle("is-active", view === "clients");
      refs.openCatalog.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.navClientsMobile) {
      const showClients = currentGroup === "manager" || currentGroup === "executive" || currentGroup === "admin";
      refs.navClientsMobile.hidden = !showClients;
      refs.navClientsMobile.classList.toggle("is-active", view === "clients");
      refs.navClientsMobile.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.settingsMenuSettings) {
      const showSettingsLink = isAdmin(state.currentUser);
      refs.settingsMenuSettings.hidden = !showSettingsLink;
      refs.settingsMenuSettings.setAttribute("aria-current", view === "settings" ? "page" : "false");
    }
    if (refs.navTimesheet) {
      refs.navTimesheet.hidden = false;
      refs.navTimesheet.classList.toggle("is-active", view === "main");
      refs.navTimesheet.setAttribute("aria-current", view === "main" ? "page" : "false");
    }
    if (refs.navTimesheetMobile) {
      refs.navTimesheetMobile.hidden = false;
      refs.navTimesheetMobile.classList.toggle("is-active", view === "main");
      refs.navTimesheetMobile.setAttribute("aria-current", view === "main" ? "page" : "false");
    }
    if (refs.navExpenses) {
      refs.navExpenses.hidden = false;
      refs.navExpenses.classList.toggle("is-active", view === "expenses");
      refs.navExpenses.setAttribute("aria-current", view === "expenses" ? "page" : "false");
    }
    if (refs.navExpensesMobile) {
      refs.navExpensesMobile.hidden = false;
      refs.navExpensesMobile.classList.toggle("is-active", view === "expenses");
      refs.navExpensesMobile.setAttribute("aria-current", view === "expenses" ? "page" : "false");
    }
    const showAudit = isAdmin(state.currentUser);
    arrangeSettingsMenu(showAudit);
    if (refs.navAudit) {
      refs.navAudit.hidden = !showAudit;
      refs.navAudit.classList.toggle("is-active", view === "audit");
      refs.navAudit.setAttribute("aria-current", view === "audit" ? "page" : "false");
    }
    if (refs.navAuditMobile) {
      refs.navAuditMobile.hidden = true;
      refs.navAuditMobile.classList.toggle("is-active", false);
      refs.navAuditMobile.setAttribute("aria-current", "false");
    }
    if (refs.changePasswordOpen) {
      refs.changePasswordOpen.hidden = !state.currentUser || state.currentUser.mustChangePassword;
    }
    if (refs.logoutButton) {
      refs.logoutButton.hidden = false;
    }
    if (refs.openAnalytics) {
      refs.openAnalytics.hidden = false;
      refs.openAnalytics.classList.toggle("is-active", view === "analytics");
      refs.openAnalytics.setAttribute("aria-current", view === "analytics" ? "page" : "false");
    }
    if (refs.navAnalyticsMobile) {
      refs.navAnalyticsMobile.hidden = false;
      refs.navAnalyticsMobile.classList.toggle("is-active", view === "analytics");
      refs.navAnalyticsMobile.setAttribute("aria-current", view === "analytics" ? "page" : "false");
    }
    if (view !== "main") {
      closeSettingsMenu();
    }
    if (refs.settingsToggle) {
      refs.settingsToggle.hidden = false;
      if (view !== "main") {
        refs.settingsToggle.setAttribute("aria-expanded", "false");
      }
    }

    if (refs.appTopbar) {
      refs.appTopbar.style.display = "";
    }
    if (refs.timesheetView) {
      refs.timesheetView.hidden = view !== "main";
    }
    if (refs.expensesView) {
      refs.expensesView.hidden = view !== "expenses";
    }
    if (refs.mainFrame) {
      refs.mainFrame.style.display = view === "main" || view === "expenses" ? "" : "none";
    }
    if (refs.clientsPage) {
      refs.clientsPage.hidden = view !== "clients";
    }
    if (refs.usersPage) {
      refs.usersPage.hidden = view !== "members";
    }
    if (refs.analyticsPage) {
      refs.analyticsPage.hidden = view !== "analytics";
    }
    if (refs.settingsPage) {
      refs.settingsPage.hidden = view !== "settings";
    }
    if (refs.auditView) {
      refs.auditView.hidden = view !== "audit";
    }

    if (view === "clients") {
      renderClientEditor();
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
      postHeight();
      return;
    }

    if (view === "members") {
      renderUsersList();
      syncUserManagementControls();
      postHeight();
      return;
    }

    if (view === "settings") {
      renderLevelRows();
      renderExpenseCategories();
      postHeight();
      postHeight();
      return;
    }

    if (view === "audit") {
      if (!isAdmin(state.currentUser)) {
        setView("main");
        return;
      }
      if (refs.timesheetView) refs.timesheetView.hidden = true;
      if (refs.expensesView) refs.expensesView.hidden = true;
      if (refs.mainFrame) refs.mainFrame.style.display = "none";
      renderAuditTable(state.auditLogs);
      if (!state.auditLogs.length) {
        loadAuditLogs();
      }
      postHeight();
      return;
    }

    if (view === "expenses") {
      if (refs.timesheetView) refs.timesheetView.hidden = true;
      if (refs.expensesView) refs.expensesView.hidden = false;
      syncExpenseFilterCatalogsUI(state.expenseFilters);
      const filteredExpenses = currentExpenses();
      renderExpenses(filteredExpenses);
      renderExpenseFilterState(filteredExpenses);
      syncExpenseCatalogs({
        userId: refs.expenseUser?.value || state.currentUser?.id || "",
        client: refs.expenseClient?.value || "",
        project: refs.expenseProject?.value || "",
      });
      postHeight();
      return;
    }

    // main view
    if (refs.clientsPage) {
      refs.clientsPage.hidden = true;
    }
    if (refs.usersPage) {
      refs.usersPage.hidden = true;
    }
    if (refs.settingsPage) {
      refs.settingsPage.hidden = true;
    }
    if (refs.membersModal) {
      refs.membersModal.hidden = true;
    }

    if (refs.timesheetView) refs.timesheetView.hidden = false;
    if (refs.expensesView) refs.expensesView.hidden = true;

    syncFormCatalogsUI({});
    syncFilterCatalogsUI(state.filters);
    ensureCatalogSelection();

    const filteredEntries = currentEntries();
    renderCatalogAside();
    renderUsersList();
    syncUserManagementControls();
    renderLevelRows();
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

  function formatDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

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

  function exportExpensesCsv() {
    const expenses = currentExpenses();
    if (!expenses.length) {
      feedback("There are no expenses to export.", true);
      return;
    }

    const rows = [
      ["Date", "User", "Client", "Project", "Category", "Amount", "Billable", "Notes", "Status"],
      ...expenses.map((expense) => [
        expense.expenseDate,
        userNameById(expense.userId),
        expense.clientName,
        expense.projectName,
        expense.category,
        Number(expense.amount || 0).toFixed(2),
        expense.isBillable !== false ? "Billable" : "Non-billable",
        expense.notes || "",
        expense.status || "pending",
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
    link.download = `expenses-${today}.csv`;
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
    const nonBillableField = field(refs.form, "nonBillable");
    const isBillable = nonBillableField ? !nonBillableField.checked : true;
    const entryChanged =
      !existingEntry ||
      existingEntry.user !== userField.value ||
      existingEntry.date !== dateField.value ||
      existingEntry.client !== clientField.value ||
      existingEntry.project !== projectField.value ||
      existingEntry.task !== (existingEntry?.task || "") ||
      Number(existingEntry.hours) !== Number(hoursField.value) ||
      (existingEntry.notes || "") !== notesField.value.trim() ||
      existingEntry.billable !== isBillable;
    const nextEntry = {
      id: state.editingId || crypto.randomUUID(),
      user: userField.value,
      date: dateField.value,
      client: clientField.value,
      project: projectField.value,
      task: existingEntry?.task || "",
      hours: Number(hoursField.value),
      notes: notesField.value.trim(),
      billable: isBillable,
      createdAt: existingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: entryChanged ? "pending" : existingEntry?.status || "pending",
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

  if (refs.navTimesheet) {
    refs.navTimesheet.addEventListener("click", function () {
      setView("main");
    });
  }
  if (refs.navTimesheetMobile) {
    refs.navTimesheetMobile.addEventListener("click", function () {
      setView("main");
    });
  }
  if (refs.navExpenses) {
    refs.navExpenses.addEventListener("click", function () {
      setView("expenses");
    });
  }
  if (refs.navExpensesMobile) {
    refs.navExpensesMobile.addEventListener("click", function () {
      setView("expenses");
    });
  }
  if (refs.navAudit) {
    refs.navAudit.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) return;
      setView("audit");
      loadAuditLogs();
    });
  }
  if (refs.navAuditMobile) {
    refs.navAuditMobile.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) return;
      setView("audit");
      loadAuditLogs();
    });
  }
  if (refs.navSettings) {
    refs.navSettings.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) {
        return;
      }
      setView("settings");
    });
  }
  if (refs.navSettingsMobile) {
    refs.navSettingsMobile.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) {
        return;
      }
      setView("settings");
    });
  }

  if (refs.navMembers) {
    refs.navMembers.addEventListener("click", function () {
      setView("members");
    });
  }
  if (refs.navMembersMobile) {
    refs.navMembersMobile.addEventListener("click", function () {
      setView("members");
    });
  }

  if (refs.logoutButton) {
    refs.logoutButton.addEventListener("click", function () {
      handleLogout();
    });
  }

  if (refs.openCatalog) {
    refs.openCatalog.addEventListener("click", function () {
      setView("clients");
    });
  }
  if (refs.navClientsMobile) {
    refs.navClientsMobile.addEventListener("click", function () {
      setView("clients");
    });
  }

  // legacy back button removed; no handler needed

  if (refs.themeToggle) {
    refs.themeToggle.addEventListener("click", function () {
      const nextTheme = body.dataset.theme === "dark" ? "light" : "dark";
      saveThemePreference(nextTheme);
      applyTheme(nextTheme);
      closeSettingsMenu();
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

  ["from", "to"].forEach(function (name) {
    const refsForKind = expenseFilterDateRefs(name);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year) {
      return;
    }

    [refsForKind.month, refsForKind.day, refsForKind.year].forEach(function (select) {
      select.addEventListener("change", function () {
        updateExpenseFilterDateFromPicker(name);
      });
    });
  });

  // Mobile: replace wheel filter date selects with native date inputs for easier picking.
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch) {
    function initMobileFilterDate(kind) {
      const hidden = field(refs.filterForm, kind);
      const wheel = document.querySelector(`[data-filter-date="${kind}"]`);
      if (!hidden || !wheel) return;
      const input = document.createElement("input");
      input.type = "date";
      input.inputMode = "numeric";
      input.className = "mobile-filter-date";
      input.value = state.filters[kind] || "";
      wheel.style.display = "none";
      wheel.insertAdjacentElement("afterend", input);
      input.addEventListener("change", function () {
        const iso = input.value;
        hidden.value = iso ? formatDisplayDate(iso) : "";
        applyFiltersFromForm({ showErrors: false });
      });
    }

    function initMobileExpenseFilterDate(kind) {
      const hidden = field(refs.expenseFilterForm, kind);
      const wheel = document.querySelector(`[data-expense-filter-date="${kind}"]`);
      if (!hidden || !wheel) return;
      const input = document.createElement("input");
      input.type = "date";
      input.inputMode = "numeric";
      input.className = "mobile-filter-date";
      input.value = state.expenseFilters[kind] || "";
      wheel.style.display = "none";
      wheel.insertAdjacentElement("afterend", input);
      input.addEventListener("change", function () {
        const iso = input.value;
        hidden.value = iso ? formatDisplayDate(iso) : "";
        applyExpenseFiltersFromForm({ showErrors: false });
      });
    }

    ["from", "to"].forEach(initMobileFilterDate);
    ["from", "to"].forEach(initMobileExpenseFilterDate);
  }

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
    setNonBillableDefault("");
  });

  field(refs.form, "project").addEventListener("change", function () {
    const projectField = field(refs.form, "project");
    setNonBillableDefault(projectField.value || "");
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

  field(refs.expenseFilterForm, "client")?.addEventListener("change", function () {
    const userField = field(refs.expenseFilterForm, "user");
    const clientField = field(refs.expenseFilterForm, "client");
    syncExpenseFilterCatalogsUI({
      user: userField?.value || "",
      client: clientField?.value || "",
      project: "",
    });
    applyExpenseFiltersFromForm();
  });

  field(refs.expenseFilterForm, "project")?.addEventListener("change", function () {
    applyExpenseFiltersFromForm();
  });

  field(refs.expenseFilterForm, "user")?.addEventListener("change", function () {
    const userField = field(refs.expenseFilterForm, "user");
    const clientField = field(refs.expenseFilterForm, "client");
    syncExpenseFilterCatalogsUI({
      user: userField?.value || "",
      client: clientField?.value || "",
      project: field(refs.expenseFilterForm, "project")?.value || "",
    });
    applyExpenseFiltersFromForm();
  });

  field(refs.expenseFilterForm, "search")?.addEventListener("input", function () {
    applyExpenseFiltersFromForm({ showErrors: false });
  });

  refs.expenseFilterForm?.addEventListener("submit", function (event) {
    event.preventDefault();
    applyExpenseFiltersFromForm();
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

  refs.expenseClearFilters?.addEventListener("click", function () {
    refs.expenseFilterForm?.reset();
    syncExpenseFilterCatalogsUI({
      user: "",
      client: "",
      project: "",
    });
    state.expenseFilters = {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
    ["from", "to"].forEach(function (name) {
      const refsForKind = expenseFilterDateRefs(name);
      if (refsForKind.month) refsForKind.month.value = "";
      if (refsForKind.day) refsForKind.day.value = "";
      if (refsForKind.year) refsForKind.year.value = "";
    });
    applyExpenseFiltersFromForm({ showErrors: false });
  });

  refs.expenseExportCsv?.addEventListener("click", exportExpensesCsv);

  refs.auditFilterEntity?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterAction?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterActor?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterDate?.addEventListener("change", applyAuditFiltersFromForm);

  if (refs.expenseForm) {
    refs.expenseForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const expense = expenseFromForm();
      const error = validateExpenseForm(expense);
      if (error) {
        feedback(error, true);
        return;
      }
      const action = state.expenseEditingId ? "update_expense" : "create_expense";
      try {
        await mutatePersistentState(action, { expense });
        feedback(state.expenseEditingId ? "Expense updated." : "Expense saved.", false);
        resetExpenseForm();
      } catch (err) {
        feedback(err.message || "Unable to save expense.", true);
      }
    });
  }

  if (refs.expenseCancelEdit) {
    refs.expenseCancelEdit.addEventListener("click", function () {
      resetExpenseForm();
      feedback("", false);
    });
  }

  if (refs.expenseClient) {
    refs.expenseClient.addEventListener("change", function () {
      syncExpenseCatalogs({
        userId: refs.expenseUser?.value || "",
        client: refs.expenseClient.value,
        project: "",
      });
      setExpenseNonBillableDefault("");
    });
  }

  if (refs.expenseProject) {
    refs.expenseProject.addEventListener("change", function () {
      setExpenseNonBillableDefault(refs.expenseProject.value || "");
    });
  }

  if (refs.expenseUser) {
    refs.expenseUser.addEventListener("change", function () {
      syncExpenseCatalogs({
        userId: refs.expenseUser.value,
        client: refs.expenseClient?.value || "",
        project: refs.expenseProject?.value || "",
      });
    });
  }

  if (refs.expensesBody) {
    refs.expensesBody.addEventListener("click", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      const expense = (state.expenses || []).find((item) => item.id === id);
      if (!expense) return;

      if (action === "expense-edit") {
        setExpenseForm(expense);
        return;
      }

      if (action === "expense-delete") {
        const confirmed = window.confirm("Delete this expense?");
        if (!confirmed) return;
        try {
          await mutatePersistentState("delete_expense", { id });
          feedback("Expense deleted.", false);
        } catch (err) {
          feedback(err.message || "Unable to delete expense.", true);
        }
        return;
      }

      if (action === "expense-toggle-status") {
        try {
          await mutatePersistentState("toggle_expense_status", { id });
        } catch (err) {
          feedback(err.message || "Unable to update status.", true);
        }
        return;
      }

      if (action === "expense-note") {
        const saved = await showExpenseNoteModal(expense);
        if (saved) {
          feedback("Note saved.", false);
        }
        return;
      }

      if (action === "expense-toggle-billable") {
        const nextExpense = {
          ...expense,
          isBillable: expense.isBillable === false ? true : false,
        };
        try {
          await mutatePersistentState("update_expense", { expense: nextExpense });
        } catch (err) {
          feedback(err.message || "Unable to update billable status.", true);
        }
        return;
      }
    });

    refs.expensesBody.addEventListener("keydown", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actionEl.click();
    });
  }

  if (refs.entriesBody) {
    refs.entriesBody.addEventListener("keydown", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actionEl.click();
    });
  }
  refs.addUserForm.addEventListener("submit", handleAddUser);
  if (refs.openAnalytics) {
    refs.openAnalytics.addEventListener("click", openAnalyticsPage);
  }
  if (refs.navAnalyticsMobile) {
    refs.navAnalyticsMobile.addEventListener("click", openAnalyticsPage);
  }
  if (refs.analyticsNavBack) {
    refs.analyticsNavBack.addEventListener("click", closeAnalyticsPage);
  }
  if (refs.settingsToggle) {
    refs.settingsToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleSettingsMenu();
    });
  }
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (
      refs.settingsMenu &&
      refs.settingsToggle &&
      !refs.settingsMenu.hidden &&
      !refs.settingsMenu.contains(target) &&
      !refs.settingsToggle.contains(target)
    ) {
      closeSettingsMenu();
    }
  });
  if (refs.changePasswordOpen) {
    refs.changePasswordOpen.addEventListener("click", openChangePasswordModal);
  }
  if (refs.changePasswordForm) {
    refs.changePasswordForm.addEventListener("submit", submitChangePassword);
  }
  if (refs.changePasswordCancel) {
    refs.changePasswordCancel.addEventListener("click", closeChangePasswordModal);
  }
  if (refs.settingsMenuSettings) {
    refs.settingsMenuSettings.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) {
        return;
      }
      setView("settings");
      closeSettingsMenu();
    });
  }
  if (refs.forcePasswordForm) {
    refs.forcePasswordForm.addEventListener("submit", submitForcePassword);
  }
  refs.userList.addEventListener("click", handleUserListAction);
  if (refs.levelLabelsForm) {
    refs.levelLabelsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can update levels.", true);
        return;
      }
      const rows = Array.from(refs.levelRows?.querySelectorAll(".level-row") || []);
      if (!rows.length) {
        feedback("No levels to save.", true);
        return;
      }

      const seen = new Set();
      const validGroups = new Set(["staff", "manager", "executive", "admin"]);
      const seenLabels = new Set();

      const levels = rows.map(function (row) {
        const level = Number(row.dataset.level);
        const labelInput = row.querySelector("[data-level-label]");
        const groupSelect = row.querySelector("[data-level-permission]");
        const label = (labelInput?.value || "").trim();
        const permissionGroup = (groupSelect?.value || "staff").trim();
        return { level, label, permissionGroup };
      }).sort((a, b) => a.level - b.level);

      for (const item of levels) {
        if (!item.level || Number.isNaN(item.level)) {
          feedback("Level number is required for each row.", true);
          return;
        }
        if (seen.has(item.level)) {
          feedback("Duplicate level numbers are not allowed.", true);
          return;
        }
        seen.add(item.level);
        if (!item.label) {
          feedback("Each level needs a label.", true);
          return;
        }
        const labelKey = item.label.trim().toLowerCase();
        if (seenLabels.has(labelKey)) {
          feedback("Level labels must be unique.", true);
          return;
        }
        seenLabels.add(labelKey);
        if (!validGroups.has(item.permissionGroup)) {
          feedback("Invalid permission group selected.", true);
          return;
        }
      }
      try {
        state.levelLabels = levels.reduce((acc, item) => {
          acc[item.level] = { label: item.label, permissionGroup: item.permissionGroup };
          return acc;
        }, {});
        renderLevelRows();
        await mutatePersistentState("update_level_labels", { levels });
        await loadPersistentState();
        renderLevelRows();
        feedback("Levels updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update levels.", true);
      }
    });
  }
  if (refs.addLevel) {
    refs.addLevel.addEventListener("click", handleAddLevel);
  }

  if (refs.expenseCategoriesForm) {
    refs.expenseCategoriesForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can update expense categories.", true);
        return;
      }
      const rows = Array.from(refs.expenseRows?.querySelectorAll(".level-row") || []);
      if (!rows.length) {
        feedback("Add at least one category.", true);
        return;
      }
      const seen = new Set();
      const categories = [];
      for (const row of rows) {
        const id = (row.dataset.expenseId || "").trim();
        const nameInput = row.querySelector("[data-expense-name]");
        const activeInput = row.querySelector("[data-expense-active]");
        const name = (nameInput?.value || "").trim();
        const isActive = activeInput ? activeInput.dataset.active !== "false" : true;
        if (!name) {
          feedback("Category name cannot be blank.", true);
          return;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
          feedback("Category names must be unique.", true);
          return;
        }
        seen.add(key);
        categories.push({ id: id || null, name, isActive });
      }
      try {
        await mutatePersistentState("update_expense_categories", { categories });
        feedback("Expense categories updated.", false);
        render();
      } catch (error) {
        feedback(error.message || "Unable to update expense categories.", true);
      }
    });
  }

  if (refs.expenseRows) {
    refs.expenseRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-expense-delete]");
      const toggleBtn = event.target.closest("[data-expense-active]");
      if (toggleBtn) {
        const next = toggleBtn.dataset.active !== "true";
        toggleBtn.dataset.active = next ? "true" : "false";
        toggleBtn.classList.toggle("is-active", next);
        toggleBtn.classList.toggle("is-inactive", !next);
        toggleBtn.textContent = next ? "Active" : "Inactive";
        toggleBtn.setAttribute("aria-pressed", next ? "true" : "false");
        return;
      }
      if (!deleteBtn) return;
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can update expense categories.", true);
        return;
      }
      const row = deleteBtn.closest(".expense-row");
      if (!row) return;

      // Build categories from current rows excluding the one being deleted
      const rows = Array.from(refs.expenseRows.querySelectorAll(".expense-row")).filter((r) => r !== row);
      const categories = [];
      const seen = new Set();
      for (const r of rows) {
        const id = (r.dataset.expenseId || "").trim();
        const nameInput = r.querySelector("[data-expense-name]");
        const activeInput = r.querySelector("[data-expense-active]");
        const name = (nameInput?.value || "").trim();
        const isActive = activeInput ? activeInput.dataset.active !== "false" : true;
        if (!name) {
          feedback("Category name cannot be blank.", true);
          return;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
          feedback("Category names must be unique.", true);
          return;
        }
        seen.add(key);
        categories.push({ id: id || null, name, isActive });
      }

      const previous = [...state.expenseCategories];
      state.expenseCategories = categories;
      renderExpenseCategories();
      try {
        await mutatePersistentState("update_expense_categories", { categories });
        feedback("Category deleted.", false);
      } catch (error) {
        state.expenseCategories = previous;
        renderExpenseCategories();
        feedback(error.message || "Unable to delete category.", true);
      }
    });
  }

  if (refs.levelRows) {
    refs.levelRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-level-delete]");
      if (!deleteBtn) return;
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can update levels.", true);
        return;
      }
      const row = deleteBtn.closest(".level-row");
      if (!row) return;

      const rows = Array.from(refs.levelRows.querySelectorAll(".level-row")).filter((r) => r !== row);

      const seen = new Set();
      const validGroups = new Set(["staff", "manager", "executive", "admin"]);
      const levels = [];
      for (const r of rows) {
        const level = Number(r.dataset.level);
        const labelInput = r.querySelector("[data-level-label]");
        const groupSelect = r.querySelector("[data-level-permission]");
        const label = (labelInput?.value || "").trim();
        const permissionGroup = (groupSelect?.value || "staff").trim();

        if (!level || Number.isNaN(level)) {
          feedback("Level number is required for each row.", true);
          return;
        }
        if (seen.has(level)) {
          feedback("Duplicate level numbers are not allowed.", true);
          return;
        }
        seen.add(level);
        if (!label) {
          feedback("Each level needs a label.", true);
          return;
        }
        if (!validGroups.has(permissionGroup)) {
          feedback("Invalid permission group selected.", true);
          return;
        }
        levels.push({ level, label, permissionGroup });
      }

      const adminCount = levels.filter((l) => l.permissionGroup === "admin").length;
      if (adminCount === 0) {
        feedback("At least one admin permission level is required.", true);
        return;
      }

      const previous = { ...state.levelLabels };
      state.levelLabels = levels.reduce((acc, item) => {
        acc[item.level] = { label: item.label, permissionGroup: item.permissionGroup };
        return acc;
      }, {});
      renderLevelRows();
      try {
        await mutatePersistentState("update_level_labels", { levels: levels.sort((a, b) => a.level - b.level) });
        await loadPersistentState();
        renderLevelRows();
        feedback("Level deleted.", false);
      } catch (error) {
        // Restore UI on failure
        state.levelLabels = { ...previous };
        renderLevelRows();
        feedback(error.message || "Unable to delete level.", true);
      }
    });
  }

  if (refs.addCategory) {
    refs.addCategory.addEventListener("click", function () {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can update expense categories.", true);
        return;
      }
      state.expenseCategories = [
        ...state.expenseCategories,
        {
          id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: "",
          isActive: true,
        },
      ];
      renderExpenseCategories();
    });
  }

  function readClientEditorForm(form) {
    const formData = new FormData(form);
    const value = (name) => {
      const raw = formData.get(name);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const validatePhone = (phone) => {
      const digits = (phone || "").replace(/\\D/g, "");
      return digits.length === 10 ? phone.trim() : "";
    };
    return {
      name: value("client_name"),
      businessContactName: value("business_contact_name"),
      businessContactEmail: value("business_contact_email"),
      businessContactPhone: validatePhone(value("business_contact_phone")),
      billingContactName: value("billing_contact_name"),
      billingContactEmail: value("billing_contact_email"),
      billingContactPhone: validatePhone(value("billing_contact_phone")),
      addressStreet: value("address_street"),
      addressCity: value("address_city"),
      addressState: value("address_state"),
      addressPostal: value("address_postal"),
    };
  }

  refs.addClientForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!isAdmin(state.currentUser)) {
      feedback("Only Admins can add clients.", true);
      return;
    }
    const clientNameField = field(refs.addClientForm, "client_name");
    const rawName = clientNameField.value.trim();
    if (!rawName) {
      feedback("Client name is required.", true);
      return;
    }
    openClientEditor({ mode: "create", clientName: rawName });
  });

  if (refs.clientEditor) {
    refs.clientEditor.addEventListener("click", function (event) {
      if (event.target.closest("[data-cancel-client]")) {
        closeClientEditor();
        render();
      }
    });

    refs.clientEditor.addEventListener("submit", async function (event) {
      const form = event.target.closest("[data-client-editor-form]");
      if (!form) return;
      event.preventDefault();
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can save clients.", true);
        return;
      }
      const editor = state.clientEditor;
      if (!editor) return;
      const values = readClientEditorForm(form);
      ["business_contact_phone", "billing_contact_phone", "business_contact_email", "billing_contact_email", "address_postal", "address_street", "address_city", "address_state"].forEach((name) =>
        setFieldError(form, name, false)
      );
      setClientEditorMessage(form, "");
      if (!values.name) {
        const msg = "Client name is required.";
        setClientEditorMessage(form, msg);
        feedback(msg, true);
        return;
      }
      const errors = [];
      const rawBizPhone = field(form, "business_contact_phone")?.value || "";
      const rawBillPhone = field(form, "billing_contact_phone")?.value || "";
      const rawBizEmail = field(form, "business_contact_email")?.value || "";
      const rawBillEmail = field(form, "billing_contact_email")?.value || "";
      const rawZip = field(form, "address_postal")?.value || "";
      const rawStreet = field(form, "address_street")?.value || "";
      const rawCity = field(form, "address_city")?.value || "";
      const rawState = field(form, "address_state")?.value || "";

      if (rawBizPhone.trim() && !values.businessContactPhone) {
        errors.push("Business contact phone must be 10 digits.");
        setFieldError(form, "business_contact_phone", true);
      }
      if (rawBillPhone.trim() && !values.billingContactPhone) {
        errors.push("Billing contact phone must be 10 digits.");
        setFieldError(form, "billing_contact_phone", true);
      }
      const emailOk = (email) => {
        if (!email.trim()) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };
      if (!emailOk(rawBizEmail)) {
        errors.push("Business contact email is not valid.");
        setFieldError(form, "business_contact_email", true);
      }
      if (!emailOk(rawBillEmail)) {
        errors.push("Billing contact email is not valid.");
        setFieldError(form, "billing_contact_email", true);
      }
      const zipDigits = rawZip.replace(/\\D/g, "");
      const anyAddress = rawStreet.trim() || rawCity.trim() || rawState.trim() || rawZip.trim();
      if (anyAddress) {
        if (!rawStreet.trim()) {
          errors.push("Street is required.");
          setFieldError(form, "address_street", true);
        }
        if (!rawCity.trim()) {
          errors.push("City is required.");
          setFieldError(form, "address_city", true);
        }
        if (!rawState.trim()) {
          errors.push("State is required.");
          setFieldError(form, "address_state", true);
        }
        if (!rawZip.trim() || zipDigits.length < 5) {
          errors.push("Zip code must have at least 5 digits.");
          setFieldError(form, "address_postal", true);
        }
      } else if (rawZip.trim() && zipDigits.length < 5) {
        errors.push("Zip code must have at least 5 digits.");
        setFieldError(form, "address_postal", true);
      }
      if (errors.length) {
        const msg = "Please correct values in the highlighted input fields.";
        setClientEditorMessage(form, msg);
        feedback(msg, true);
        return;
      }

      const action = editor.mode === "edit" ? "update_client" : "add_client";
      const payload = {
        clientName: editor.mode === "edit" ? editor.originalName : values.name,
        nextName: values.name,
        businessContactName: values.businessContactName,
        businessContactEmail: values.businessContactEmail,
        businessContactPhone: values.businessContactPhone,
        billingContactName: values.billingContactName,
        billingContactEmail: values.billingContactEmail,
        billingContactPhone: values.billingContactPhone,
        addressStreet: values.addressStreet,
        addressCity: values.addressCity,
        addressState: values.addressState,
        addressPostal: values.addressPostal,
      };

      const formUserField = field(refs.form, "user");
      const filterUserField = field(refs.filterForm, "user");

      try {
        await mutatePersistentState(action, payload);
        applyClientNameChange(editor.originalName, values.name);
        state.selectedCatalogClient = values.name;
        refs.addClientForm?.reset();
        feedback(action === "add_client" ? "Client added." : "Client updated.", false);
        closeClientEditor();
        syncFormCatalogsUI({
          user: formUserField?.value,
          client: state.selectedCatalogClient,
          project: "",
        });
        syncFilterCatalogsUI({
          user: filterUserField?.value,
          client: state.filters.client,
          project: state.filters.project,
        });
      } catch (error) {
        feedback(error.message || "Unable to save client.", true);
      }
      render();
    });
  }

  refs.addProjectForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const canCreateProject = isAdmin(state.currentUser) || isExecutive(state.currentUser);
    if (!canCreateProject) {
      feedback("Only Executives or Admins can create projects.", true);
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
    const editButton = event.target.closest("[data-edit-client]");
    if (editButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can edit clients.", true);
        return;
      }
      const clientName = editButton.dataset.editClient;
      openClientEditor({ mode: "edit", clientName });
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
      const projectCount = state.projects.filter((p) => p.client === clientName).length;
      const dialogResult = await appDialog({
        title: "Remove client",
        message:
          hoursLogged > 0 || projectCount > 0
            ? `${clientName} already has ${hoursLogged.toFixed(
                2
              )} logged hours and ${projectCount} active projects. Removing it will also remove the active projects. Remove it from the active catalog and keep the history?`
            : `Remove ${clientName} from the active catalog?`,
        confirmText: "Remove",
      });
      if (!dialogResult.confirmed) {
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
        const message = error.message || "Unable to remove client.";
        feedback(message, true);
        window.alert(message);
        if (message.toLowerCase().includes("not found")) {
          // Drop locally if server reports it missing
          delete state.catalog[clientName];
          state.projects = state.projects.filter((p) => p.client !== clientName);
          if (state.selectedCatalogClient === clientName) {
            state.selectedCatalogClient = "";
          }
          if (state.filters.client === clientName) {
            state.filters.client = "";
          }
          render();
        }
        return;
      }

      await loadPersistentState();
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
      const projectRow =
        (state.projects || []).find(
          (p) =>
            p.client === state.selectedCatalogClient &&
            (p.name || "").toLowerCase() === projectName.toLowerCase()
        ) || null;
      const currentBudget = projectRow && Number.isFinite(projectRow.budget) ? projectRow.budget : null;
      const dialogResult = await appDialog({
        title: "Edit project name",
        input: true,
        defaultValue: projectName,
        confirmText: "Save",
      });
      if (!dialogResult.confirmed) {
        return;
      }
      const nextName = dialogResult.value || projectName;
      if (!nextName.trim()) {
        feedback("Project name cannot be empty.", true);
        return;
      }

      const budgetInput = window.prompt(
        "Project budget (optional – leave blank for no budget). Enter a number.",
        currentBudget !== null ? String(currentBudget) : ""
      );
      if (budgetInput === null) {
        return;
      }
      const trimmedBudget = budgetInput.trim();
      let budgetAmount = null;
      if (trimmedBudget) {
        const parsed = Number(trimmedBudget);
        if (Number.isNaN(parsed) || parsed < 0) {
          feedback("Budget must be a non-negative number.", true);
          return;
        }
        budgetAmount = parsed;
      }

      try {
        await mutatePersistentState("update_project", {
          clientName: state.selectedCatalogClient,
          projectName,
          nextName,
          budgetAmount,
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

      await loadPersistentState();
      syncFilterCatalogsUI(state.filters);
      feedback("Project updated.", false);
      render();
      return;
    }

    const editNameButton = event.target.closest("[data-edit-project-name]");
    if (editNameButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can edit projects.", true);
        return;
      }
      const projectName = editNameButton.dataset.editProjectName;
      const dialogResult = await appDialog({
        title: "Edit project name",
        input: true,
        defaultValue: projectName,
        confirmText: "Save",
      });
      if (!dialogResult.confirmed) {
        return;
      }
      const nextName = dialogResult.value || projectName;
      if (!nextName.trim()) {
        feedback("Project name cannot be empty.", true);
        return;
      }
      try {
        await mutatePersistentState("update_project", {
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
      await loadPersistentState();
      syncFilterCatalogsUI(state.filters);
      feedback("Project updated.", false);
      render();
      return;
    }

    const editBudgetButton = event.target.closest("[data-edit-project-budget]");
    if (editBudgetButton) {
      if (!isAdmin(state.currentUser)) {
        feedback("Only Admins can edit budgets.", true);
        return;
      }
      const projectName = editBudgetButton.dataset.editProjectBudget;
      const projectRow =
        (state.projects || []).find(
          (p) =>
            p.client === state.selectedCatalogClient &&
            (p.name || "").toLowerCase() === projectName.toLowerCase()
        ) || null;
      const currentBudget = projectRow && Number.isFinite(projectRow.budget) ? projectRow.budget : null;
      const dialogResult = await appDialog({
        title: "Edit project budget",
        input: true,
        defaultValue: currentBudget !== null ? String(currentBudget) : "",
        confirmText: "Save",
        message: "Enter a non-negative number. Leave blank for no budget.",
      });
      if (!dialogResult.confirmed) {
        return;
      }
      const trimmedBudget = (dialogResult.value || "").trim();
      let budgetAmount = null;
      if (trimmedBudget) {
        const parsed = Number(trimmedBudget);
        if (Number.isNaN(parsed) || parsed < 0) {
          feedback("Budget must be a non-negative number.", true);
          return;
        }
        budgetAmount = parsed;
      }
      try {
        await mutatePersistentState("update_project", {
          clientName: state.selectedCatalogClient,
          projectName,
          nextName: projectName,
          budgetAmount,
        });
      } catch (error) {
        feedback(error.message || "Unable to update budget.", true);
        return;
      }
      await loadPersistentState();
      syncFilterCatalogsUI(state.filters);
      feedback("Project budget updated.", false);
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
      const dialogResult = await appDialog({
        title: "Remove project",
        message:
          hoursLogged > 0
            ? `${projectName} already has ${hoursLogged.toFixed(
                2
              )} logged hours. Remove it from the active catalog and keep the history?`
            : `Remove ${projectName} from the active catalog?`,
        confirmText: "Remove",
      });
      if (!dialogResult.confirmed) {
        return;
      }

      let message = "";
      try {
        const result = await mutatePersistentState("remove_project", {
          clientName: state.selectedCatalogClient,
          projectName,
        });
        message = result?.message || "";
        // Defensive local cleanup in case state remains stale
        state.projects = state.projects.filter(
          (p) =>
            !(p.client === state.selectedCatalogClient && p.project === projectName)
        );
        if (state.catalog?.[state.selectedCatalogClient]) {
          state.catalog[state.selectedCatalogClient] = state.catalog[state.selectedCatalogClient].filter(
            (name) => name !== projectName
          );
        }
        if (
          state.filters.client === state.selectedCatalogClient &&
          state.filters.project === projectName
        ) {
          state.filters.project = "";
        }
      } catch (error) {
        const message = error.message || "Unable to remove project.";
        feedback(message, true);
        window.alert(message);
        if (message.toLowerCase().includes("not found")) {
          // Drop locally if server reports it missing
          state.projects = state.projects.filter(
            (p) =>
              !(p.client === state.selectedCatalogClient && p.project === projectName)
          );
          if (state.catalog?.[state.selectedCatalogClient]) {
            state.catalog[state.selectedCatalogClient] = state.catalog[state.selectedCatalogClient].filter(
              (name) => name !== projectName
            );
          }
          if (
            state.filters.client === state.selectedCatalogClient &&
            state.filters.project === projectName
          ) {
            state.filters.project = "";
          }
          render();
        }
        return;
      }

      await loadPersistentState();
      syncFilterCatalogsUI(state.filters);
      feedback(message || "Project removed from active catalog.", false);
      render();
      return;
    }

    const editManagersButton = event.target.closest("[data-edit-managers]");
    if (editManagersButton) {
      if (!isAdmin(state.currentUser) && !isManager(state.currentUser)) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-managers-edit";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = editManagersButton.dataset.editManagers;
      memberModalState.assigned = managerIdsForProject(
        state.selectedCatalogClient,
        editManagersButton.dataset.editManagers
      );
      memberModalState.overrides = {};
      state.assignments.managerProjects
        .filter(
          (item) =>
            item.client === state.selectedCatalogClient &&
            item.project === editManagersButton.dataset.editManagers
        )
        .forEach((item) => {
          memberModalState.overrides[item.managerId] = item.chargeRateOverride ?? null;
        });
      openMembersModal();
      return;
    }

    const editMembersButton = event.target.closest("[data-edit-members]");
    if (editMembersButton) {
      if (
        !isAdmin(state.currentUser) &&
        !(
          isManager(state.currentUser) &&
          canManagerAccessProject(
            state.currentUser,
            state.selectedCatalogClient,
            editMembersButton.dataset.editMembers
          )
        )
      ) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-members-edit";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = editMembersButton.dataset.editMembers;
      memberModalState.assigned = staffIdsForProject(
        state.selectedCatalogClient,
        editMembersButton.dataset.editMembers
      );
      memberModalState.overrides = {};
      state.assignments.projectMembers
        .filter(
          (item) =>
            item.client === state.selectedCatalogClient &&
            item.project === editMembersButton.dataset.editMembers
        )
        .forEach((item) => {
          memberModalState.overrides[item.userId] = item.chargeRateOverride ?? null;
        });
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

    if (action === "note") {
      await showNoteModal(entry);
      return;
    }

    if (action === "toggle-billable") {
      const nextBillable = entry.billable === false ? true : false;
      const updated = {
        ...entry,
        billable: nextBillable,
        updatedAt: new Date().toISOString(),
      };
      try {
        await mutatePersistentState("save_entry", { entry: updated });
        feedback("Entry updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update entry.", true);
      }
      return;
    }

    if (action === "toggle-status") {
      if (!canManageApproval(entry)) {
        return;
      }
      const isApproved = entry.status === "approved";
      try {
        await mutatePersistentState(isApproved ? "unapprove_entry" : "approve_entry", { id });
      } catch (error) {
        feedback(error.message || "Unable to update entry status.", true);
        return;
      }
      feedback(isApproved ? "Entry marked as pending." : "Entry approved.", false);
      render();
      return;
    }

    if (action === "delete") {
      const result = await appDialog({
        title: "Delete entry",
        message: "Are you sure you want to delete this entry?",
        confirmText: "Delete",
        cancelText: "Cancel",
      });
      if (!result?.confirmed) {
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

      if (!selected.length && !roleOnlyMode && mode !== "project-managers-edit" && mode !== "project-members-edit") {
        setMembersFeedback("Select at least one member.", true);
        return;
      }

      const overrideInputMap = {};
      if (mode === "project-members-edit" || mode === "project-managers-edit") {
        const overrideInputs = Array.from(
          refs.membersList.querySelectorAll("input[data-override-input]")
        );
        for (const input of overrideInputs) {
          const raw = input.value.trim();
          if (!raw) {
            overrideInputMap[input.dataset.overrideInput] = null;
            continue;
          }
          const num = Number(raw);
          if (!Number.isFinite(num) || num < 0) {
            setMembersFeedback("Override must be a non-negative number.", true);
            return;
          }
          overrideInputMap[input.dataset.overrideInput] = num;
        }
      }

  let skippedNonStaff = 0;
  let success = false;
  let mutationsRun = 0;
  let memberMutationsRun = 0;
    try {
    const currentAssigned = new Set(memberModalState.assigned || []);
    const desiredAssigned = new Set(selected);
    const currentOverrides = memberModalState.overrides || {};
    const toAdd = [];
    const toRemove = [];

    if (mode === "project-managers-edit") {
      // Build add/remove sets for informational symmetry; actions handled per-row below.
      currentAssigned.forEach((id) => {
        if (!desiredAssigned.has(id)) {
          toRemove.push(id);
        }
      });
      desiredAssigned.forEach((id) => {
        if (!currentAssigned.has(id)) {
          toAdd.push(id);
        }
      });
    } else if (mode === "project-members-edit") {
      currentAssigned.forEach((id) => {
        if (!desiredAssigned.has(id)) {
          toRemove.push(id);
        }
      });
      desiredAssigned.forEach((id) => {
        if (!currentAssigned.has(id)) {
          toAdd.push(id);
        }
      });
    }

    const processIds = mode === "project-managers-edit" || mode === "project-members-edit"
      ? [...new Set([...currentAssigned, ...desiredAssigned, ...Object.keys(overrideInputMap)])]
      : selected;

    for (const userId of processIds) {
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
          const effectiveUser = { ...user, level: effectiveLevel };

          if (mode === "project-add") {
            if (!isStaff(effectiveUser)) {
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
          } else if (mode === "project-assign-manager") {
            if (!isManager(effectiveUser)) {
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
        } else if (mode === "project-managers-edit") {
          const wasAssigned = currentAssigned.has(user.id);
          const isChecked = desiredAssigned.has(user.id);
          const prevOverride = currentOverrides[user.id] ?? null;
          const hasInput = overrideInputMap.hasOwnProperty(user.id);
          const newOverride = hasInput ? overrideInputMap[user.id] : prevOverride;

          if (!wasAssigned && isChecked) {
            if (!isManager(effectiveUser)) {
              continue;
            }
            await mutatePersistentState("assign_manager_project", {
              managerId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: newOverride,
            });
            mutationsRun += 1;
          } else if (wasAssigned && !isChecked) {
            await mutatePersistentState("unassign_manager_project", {
              managerId: user.id,
              clientName: client,
              projectName: project,
            });
            mutationsRun += 1;
          } else if (wasAssigned && isChecked && hasInput && newOverride !== prevOverride) {
            await mutatePersistentState("update_manager_project_rate", {
              managerId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: newOverride,
            });
            mutationsRun += 1;
          }
        } else if (mode === "project-members-edit") {
            if (toAdd.includes(user.id)) {
            if (!isStaff(effectiveUser)) {
              skippedNonStaff += 1;
              continue;
            }
            await mutatePersistentState("add_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: overrideInputMap[user.id],
            });
            memberMutationsRun += 1;
          } else if (toRemove.includes(user.id)) {
            await mutatePersistentState("remove_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
            });
            memberMutationsRun += 1;
          } else {
            if (overrideInputMap.hasOwnProperty(user.id)) {
              const newOverride = overrideInputMap[user.id];
              const prevOverride = currentOverrides[user.id] ?? null;
              if (newOverride !== prevOverride) {
                await mutatePersistentState("update_project_member_rate", {
                  userId: user.id,
                  clientName: client,
                  projectName: project,
                  chargeRateOverride: newOverride,
                });
                memberMutationsRun += 1;
              }
            }
          }
        }
      }

    if (mode === "project-members-edit") {
      const finalAssigned = new Set(memberModalState.assigned || []);
      toRemove.forEach((id) => finalAssigned.delete(id));
      toAdd.forEach((id) => finalAssigned.add(id));

      for (const userId of finalAssigned) {
        if (!overrideInputMap.hasOwnProperty(userId)) {
          continue;
        }
        const newOverride = overrideInputMap[userId];
        const prevOverride = currentOverrides[userId] ?? null;
        if (newOverride !== prevOverride && !toAdd.includes(userId)) {
          await mutatePersistentState("update_project_member_rate", {
            userId,
            clientName: client,
            projectName: project,
            chargeRateOverride: newOverride,
          });
          memberMutationsRun += 1;
        }
      }
    }

    if (mode === "project-managers-edit") {
      if (mutationsRun === 0) {
        setMembersFeedback("No changes to save.", false);
        return;
      }
      success = true;
    } else if (mode === "project-members-edit") {
      if (memberMutationsRun === 0) {
        setMembersFeedback("No changes to save.", false);
        return;
      }
      success = true;
    } else {
      success = true;
    }
  } catch (error) {
      setMembersFeedback(error.message || "Unable to update members.", true);
      return;
    }

    const postMessage = skippedNonStaff
      ? "Only Levels 1-2 can be added to projects; higher levels were skipped."
      : "";
    if (success) {
      closeMembersModal();
      render();
    }
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
