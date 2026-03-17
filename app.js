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
    entryDateMonth: document.getElementById("entry-date-month"),
    entryDateDay: document.getElementById("entry-date-day"),
    entryDateYear: document.getElementById("entry-date-year"),
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
    appTopbar: document.querySelector(".app-topbar"),
  };

  const today = formatDate(new Date());

  const DEFAULT_LEVEL_DEFS = {
    1: { label: "Staff", permissionGroup: "staff" },
    2: { label: "Senior", permissionGroup: "staff" },
    3: { label: "Manager", permissionGroup: "manager" },
    4: { label: "Director", permissionGroup: "manager" },
    5: { label: "Partner", permissionGroup: "admin" },
    6: { label: "Admin", permissionGroup: "admin" },
  };

  const state = {
    catalog: {},
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
    assignments: {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    },
    currentView: "main", // "main" | "expenses" | "clients" | "members" | "analytics" | "settings"
    expenseEditingId: null,
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
  }

  function clearRemoteAppState() {
    state.currentUser = null;
    state.users = [];
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
    state.entries = [];
    state.expenses = [];
    state.projects = [];
    state.levelLabels = {};
    state.expenseCategories = [];
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
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
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
    applyLoadedState(result);
    render();
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

      const textarea = refs.dialogTextarea;
      refs.dialogTitle.textContent = "Expense note";
      refs.dialogMessage.hidden = true;
      refs.dialogInputRow.hidden = true;
      refs.dialogInput.hidden = true;
      textarea.hidden = false;
      textarea.value = expense.notes || "";
      refs.dialogConfirm.hidden = true;
      refs.dialogCancel.textContent = "Save";
      refs.dialog.hidden = false;
      textarea.focus();

      const cleanup = () => {
        refs.dialog.hidden = true;
        refs.dialogCancel.removeEventListener("click", onSave);
      };

      const onSave = async () => {
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
          cleanup();
          resolve(true);
        } catch (error) {
          feedback(error.message || "Unable to save note.", true);
          cleanup();
          resolve(false);
        }
      };

      refs.dialogCancel.addEventListener("click", onSave);
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

    return {
      id: typeof expense.id === "string" && expense.id ? expense.id : crypto.randomUUID(),
      userId: expense.userId || expense.user_id || "",
      clientName: expense.clientName || expense.client_name || "",
      projectName: expense.projectName || expense.project_name || "",
      expenseDate: expense.expenseDate || expense.expense_date || today,
      category: expense.category || "",
      amount: Number.isFinite(amount) ? amount : 0,
      isBillable:
        expense.isBillable === false || expense.is_billable === 0
          ? false
          : true,
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

  function activeExpenseCategories() {
    return (state.expenseCategories || []).filter((c) => c.isActive);
  }

  function syncExpenseCatalogs({ userId, client, project }) {
    const clients = visibleCatalogClientNames();
    setSelectOptionsWithPlaceholder(refs.expenseClient, clients, "Select client");
    if (client && clients.includes(client)) {
      refs.expenseClient.value = client;
    }

    const projects = visibleCatalogProjectNames(client || "", getUserById?.(userId));
    setSelectOptionsWithPlaceholder(refs.expenseProject, projects, "Select project");
    if (project && projects.includes(project)) {
      refs.expenseProject.value = project;
    }

    const users = entryUserOptions();
    setSelectOptionsWithPlaceholder(
      refs.expenseUser,
      users.map((name) => {
        const user = getUserByDisplayName(name);
        return { label: name, value: user?.id || name };
      }),
      "Select team member"
    );
    if (userId && refs.expenseUser) {
      refs.expenseUser.value = userId;
    }

    const categories = activeExpenseCategories().map((c) => c.name);
    setSelectOptionsWithPlaceholder(refs.expenseCategory, categories, "Select category");
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
    permissionGroupForLevel,
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
    syncEntryDatePicker?.(
      { isValidDateString, today, refs, field, MONTH_NAMES, escapeHtml },
      entry.date
    );
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

  function resetExpenseForm() {
    if (!refs.expenseForm) return;
    refs.expenseForm.reset();
    state.expenseEditingId = null;
    const defaultUserId = state.currentUser?.id || "";
    if (refs.expenseUser) {
      refs.expenseUser.value = defaultUserId;
    }
    if (refs.expenseDate) {
      refs.expenseDate.value = today;
    }
    syncExpenseCatalogs({
      userId: refs.expenseUser?.value || "",
      client: "",
      project: "",
    });
    setExpenseNonBillableDefault(refs.expenseProject?.value || "");
    if (refs.expenseFormHeading) {
      refs.expenseFormHeading.textContent = "Add expense";
    }
    if (refs.submitExpense) {
      refs.submitExpense.textContent = "Save expense";
    }
    if (refs.expenseCancelEdit) {
      refs.expenseCancelEdit.hidden = true;
    }
  }

  function setExpenseForm(expense) {
    if (!expense || !refs.expenseForm) return;
    syncExpenseCatalogs({
      userId: expense.userId,
      client: expense.clientName,
      project: expense.projectName,
    });
    if (refs.expenseUser) refs.expenseUser.value = expense.userId;
    if (refs.expenseDate) refs.expenseDate.value = expense.expenseDate;
    if (refs.expenseCategory) refs.expenseCategory.value = expense.category;
    if (refs.expenseAmount) refs.expenseAmount.value = expense.amount;
    if (refs.expenseNotes) refs.expenseNotes.value = expense.notes || "";
    if (refs.expenseNonBillable)
      refs.expenseNonBillable.checked = expense.isBillable === false;
    setExpenseNonBillableDefault(expense.projectName || "");
    state.expenseEditingId = expense.id;
    if (refs.expenseFormHeading) refs.expenseFormHeading.textContent = "Edit expense";
    if (refs.submitExpense) refs.submitExpense.textContent = "Save expense";
    if (refs.expenseCancelEdit) refs.expenseCancelEdit.hidden = false;
    const formCard = refs.expenseForm.closest(".panel");
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
            <label class="expense-active">
              <input type="checkbox" data-expense-active ${item.isActive === false ? "" : "checked"} />
              <span>Active</span>
            </label>
          </div>
        `
      )
      .join("");
  }

  function sortedLevels() {
    const levels = Object.keys(state.levelLabels || {}).map((l) => Number(l));
    if (levels.length) {
      return levels.sort((a, b) => a - b);
    }
    return Object.keys(DEFAULT_LEVEL_DEFS)
      .map((l) => Number(l))
      .sort((a, b) => a - b);
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
    const group = permissionGroupForLevel(level);
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
        const usernameInput = detailCard.querySelector('[data-user-field="username"]');
        const levelSelect = detailCard.querySelector('[data-user-field="level"]');
        const baseInput = detailCard.querySelector('[data-user-field="baseRate"]');
        const costInput = detailCard.querySelector('[data-user-field="costRate"]');
        const nextUsername = usernameInput?.value.trim() || "";
        const nextLevel = Number(levelSelect?.value || user.level);
        const baseRaw = baseInput?.value.trim();
        const costRaw = costInput?.value.trim();
        const nextBase = baseRaw ? Number(baseRaw) : null;
        const nextCost = costRaw ? Number(costRaw) : null;
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
            displayName: user.displayName,
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

    const currentGroup = permissionGroupForLevel(current.level);
    const targetUser = getUserByDisplayName(entry.user);
    const targetGroup = permissionGroupForLevel(targetUser?.level || 1);

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
    const currentGroup = permissionGroupForLevel(state.currentUser?.level);
    if (refs.navSettings) {
      refs.navSettings.hidden = !isAdmin(state.currentUser);
      refs.navSettings.classList.toggle("is-active", view === "settings");
      refs.navSettings.setAttribute("aria-current", view === "settings" ? "page" : "false");
    }
    if (refs.navMembers) {
      const showMembers = isAdmin(state.currentUser) || isExecutive(state.currentUser) || isGlobalAdmin(state.currentUser);
      refs.navMembers.hidden = !showMembers;
      refs.navMembers.classList.toggle("is-active", view === "members");
      refs.navMembers.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.openCatalog) {
      refs.openCatalog.hidden = !(currentGroup === "manager" || currentGroup === "executive" || currentGroup === "admin");
      refs.openCatalog.classList.toggle("is-active", view === "clients");
      refs.openCatalog.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.navTimesheet) {
      refs.navTimesheet.hidden = false;
      refs.navTimesheet.classList.toggle("is-active", view === "main");
      refs.navTimesheet.setAttribute("aria-current", view === "main" ? "page" : "false");
    }
    if (refs.navExpenses) {
      refs.navExpenses.hidden = false;
      refs.navExpenses.classList.toggle("is-active", view === "expenses");
      refs.navExpenses.setAttribute("aria-current", view === "expenses" ? "page" : "false");
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

    if (view === "clients") {
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

    if (view === "expenses") {
      if (refs.timesheetView) refs.timesheetView.hidden = true;
      if (refs.expensesView) refs.expensesView.hidden = false;
      renderExpenses();
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

  function canManageExpenseApproval(expense) {
    const current = state.currentUser;
    if (!current || !expense) return false;
    const currentGroup = permissionGroupForLevel(current.level);
    const targetUser = getUserById?.(expense.userId);
    const targetGroup = permissionGroupForLevel(targetUser?.level || 1);

    if (current.id === expense.userId) return false;
    if (currentGroup === "staff") return false;
    if (currentGroup === "manager") {
      if (targetGroup !== "staff") return false;
      return canUserAccessProject(current, expense.clientName, expense.projectName);
    }
    if (currentGroup === "executive" || currentGroup === "admin") {
      if (!isAdmin(current) && !canUserAccessProject(current, expense.clientName, expense.projectName)) {
        return false;
      }
      return true;
    }
    return false;
  }

  function userNameById(id) {
    const user = getUserById?.(id);
    return user?.displayName || "";
  }

  function renderExpenses() {
    if (!refs.expensesBody) return;
    const expenses = state.expenses || [];
    if (!expenses.length) {
      refs.expensesBody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-row">
            <div class="empty-state-panel">
              <strong>No expenses yet.</strong>
              <span>Add an expense to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    refs.expensesBody.innerHTML = expenses
      .map((expense) => {
        const billable = expense.isBillable !== false;
        const clickableStatus = canManageExpenseApproval(expense);
        return `
          <tr class="${expense.status === "approved" ? "entry-approved" : ""}">
            <td>${escapeHtml(formatDisplayDateShort(expense.expenseDate))}</td>
            <td>${escapeHtml(userNameById(expense.userId))}</td>
            <td>${escapeHtml(expense.clientName)}</td>
            <td>${escapeHtml(expense.projectName)}</td>
            <td>${escapeHtml(expense.category)}</td>
            <td>$${Number(expense.amount || 0).toFixed(2)}</td>
            <td>
              <span
                class="billable-pill ${billable ? "is-billable" : "is-nonbillable"} is-clickable"
                data-action="expense-toggle-billable"
                data-id="${expense.id}"
                role="button"
              >
                ${billable ? "Billable" : "Non-billable"}
              </span>
            </td>
            <td class="notes-cell">
              ${
                expense.notes && expense.notes.trim()
                  ? `<button class="note-button" type="button" data-action="expense-note" data-id="${expense.id}" aria-label="View note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8M8 14h5" />
                      </svg>
                    </button>`
                  : `<button class="note-button note-button--empty" type="button" data-action="expense-note" data-id="${expense.id}" aria-label="Add note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8" />
                      </svg>
                    </button>`
              }
            </td>
            <td>
              <span
                class="entry-status entry-status-${expense.status} ${clickableStatus ? "entry-status-clickable" : ""}"
                ${clickableStatus ? `data-action="expense-toggle-status" data-id="${expense.id}" role="button" tabindex="0"` : ""}
              >
                ${expense.status === "approved" ? "Approved" : "Pending"}
              </span>
            </td>
            <td class="actions-cell">
              <button class="text-button" type="button" data-action="expense-edit" data-id="${expense.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="expense-delete" data-id="${expense.id}">
                Delete
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
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
  if (refs.navExpenses) {
    refs.navExpenses.addEventListener("click", function () {
      setView("expenses");
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

  if (refs.navMembers) {
    refs.navMembers.addEventListener("click", function () {
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

  // legacy back button removed; no handler needed

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

  function expenseFromForm() {
    return {
      id: state.expenseEditingId || crypto.randomUUID(),
      userId: refs.expenseUser?.value || "",
      clientName: refs.expenseClient?.value || "",
      projectName: refs.expenseProject?.value || "",
      expenseDate: refs.expenseDate?.value || today,
      category: refs.expenseCategory?.value || "",
      amount: Number(refs.expenseAmount?.value),
      isBillable: refs.expenseNonBillable ? !refs.expenseNonBillable.checked : true,
      notes: refs.expenseNotes?.value?.trim() || "",
    };
  }

  function validateExpenseForm(expense) {
    if (!expense.userId) return "Team member is required.";
    if (!expense.clientName) return "Client is required.";
    if (!expense.projectName) return "Project is required.";
    if (!expense.expenseDate) return "Date is required.";
    if (!expense.category) return "Category is required.";
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) return "Amount must be a positive number.";
    return "";
  }

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
  }
  refs.addUserForm.addEventListener("submit", handleAddUser);
  if (refs.openAnalytics) {
    refs.openAnalytics.addEventListener("click", openAnalyticsPage);
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
        await mutatePersistentState("update_level_labels", { levels });
        feedback("Levels updated.", false);
        render();
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
        const isActive = activeInput ? activeInput.checked : true;
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

  refs.addClientForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isAdmin(state.currentUser) && !isExecutive(state.currentUser)) {
      feedback("Only Executives or Admins can add clients.", true);
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
      const dialogResult = await appDialog({
        title: "Edit client name",
        input: true,
        defaultValue: clientName,
        confirmText: "Save",
      });
      if (!dialogResult.confirmed) {
        return;
      }
      const nextName = dialogResult.value || "";
      if (!nextName.trim()) {
        feedback("Client name cannot be empty.", true);
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
      const dialogResult = await appDialog({
        title: "Remove client",
        message:
          hoursLogged > 0
            ? `${clientName} already has ${hoursLogged.toFixed(
                2
              )} logged hours. Remove it from the active catalog and keep the history?`
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
      const dialogResult = await appDialog({
        title: "Edit project name",
        input: true,
        defaultValue: projectName,
        confirmText: "Save",
      });
      if (!dialogResult.confirmed) {
        return;
      }
      const nextName = dialogResult.value || "";
      if (!nextName.trim()) {
        feedback("Project name cannot be empty.", true);
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
