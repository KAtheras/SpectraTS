(function () {
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const THEME_EXPLICIT_STORAGE_KEY = "timesheet-studio.theme.explicit.v1";
  const VIEW_STORAGE_KEY = "timesheet-studio.view.v1";
  const PROJECT_PLANNING_ID_STORAGE_KEY = "timesheet-studio.project-planning-id.v1";
  const LAST_INPUTS_COMBO_STORAGE_KEY = "timesheet-studio.inputs.last-client-project.v1";
  const INPUTS_COMBO_CORPORATE_PREFIX = "__corp__::";
  const INPUTS_COMBO_SECTION_VALUE = "__section__";
  const INPUTS_COMBO_DIVIDER_VALUE = "__divider__";
  const body = document.body;
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/set-password") {
    const INVALID_SETUP_LINK_MESSAGE =
      "This setup link is no longer valid. It may have already been used. Please request a new one.";
    const token = new URLSearchParams(window.location.search).get("token") || "";
    body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
        <section style="width:min(460px,100%);background:#fff;border:1px solid #ddd;border-radius:16px;padding:24px;">
          <h1 style="margin:0 0 16px 0;font-size:1.5rem;">Set your password</h1>
          <form id="set-password-form" style="display:grid;gap:12px;" hidden>
            <input type="password" id="set-password-new" placeholder="Password" required autocomplete="new-password" />
            <input type="password" id="set-password-confirm" placeholder="Confirm password" required autocomplete="new-password" />
            <button type="submit" style="padding:10px 14px;border-radius:10px;border:1px solid #2f5f90;background:#2f5f90;color:#fff;font-weight:700;">Set password</button>
          </form>
          <p id="set-password-feedback" style="margin:12px 0 0 0;color:#6d6258;font-size:.95rem;"></p>
        </section>
      </main>
    `;
    const form = document.getElementById("set-password-form");
    const feedback = document.getElementById("set-password-feedback");
    const hideSetupForm = function () {
      if (form) {
        form.hidden = true;
        Array.from(form.elements || []).forEach((el) => {
          el.disabled = true;
        });
      }
      feedback.textContent = INVALID_SETUP_LINK_MESSAGE;
      feedback.style.color = "#b2362e";
    };

    const showSetupForm = function () {
      if (form) {
        form.hidden = false;
        Array.from(form.elements || []).forEach((el) => {
          el.disabled = false;
        });
      }
      feedback.textContent = "";
      feedback.style.color = "#6d6258";
    };

    const validateSetupToken = async function () {
      if (!token) {
        hideSetupForm();
        return false;
      }
      try {
        const response = await fetch("/.netlify/functions/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "validate_setup_token",
            payload: { token },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.valid) {
          hideSetupForm();
          return false;
        }
        showSetupForm();
        return true;
      } catch (error) {
        hideSetupForm();
        return false;
      }
    };

    validateSetupToken().then(function (valid) {
      if (!valid) {
        return;
      }
      form?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const password = document.getElementById("set-password-new")?.value || "";
        const confirm = document.getElementById("set-password-confirm")?.value || "";
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!password || password.length < 8) {
          feedback.textContent = "Password must be at least 8 characters.";
          feedback.style.color = "#b2362e";
          return;
        }
        if (password !== confirm) {
          feedback.textContent = "Passwords do not match.";
          feedback.style.color = "#b2362e";
          return;
        }
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Setting...";
          const response = await fetch("/.netlify/functions/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "complete_password_setup",
              payload: {
                token,
                password,
              },
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || "Unable to set password.");
          }
          const sessionToken = String(payload?.sessionToken || "");
          if (sessionToken) {
            if (window.api?.saveSessionToken) {
              window.api.saveSessionToken(sessionToken);
            } else {
              window.localStorage.setItem("timesheet-studio.session-token.v1", sessionToken);
            }
          }
          feedback.textContent = "Password set successfully. Redirecting...";
          feedback.style.color = "#2b6b3a";
          form.reset();
          window.setTimeout(function () {
            window.location.assign("/");
          }, 250);
        } catch (error) {
          feedback.textContent = error.message || "Unable to set password.";
          feedback.style.color = "#b2362e";
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Set password";
        }
      });
    });
    return;
  }
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
    resetUsersDirectoryFilters: usersResetDirectoryFilters,
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
  } = window.entryForm || {};

  const permissionGroupForUserWithSuper = (user) => {
    const group = permissionGroupForUser(user);
    return group === "superuser" ? "admin" : group;
  };
  const { createAccessControl } = window.accessControl || {};
  const {
    renderAuditTable,
    filterAuditLogs,
    humanizeEntity,
    humanizeAction,
    auditCategoryForRow,
    humanizeField,
    formatValue,
    formatAuditKV,
    applyAuditFiltersFromForm,
  } = window.auditLog || {};
  const {
    syncExpenseCatalogs: syncExpenseCatalogsImport,
    activeExpenseCategories,
    resetExpenseForm,
    currentExpenses,
    renderExpenseFilterState,
    applyExpenseFiltersFromForm: applyExpenseFiltersFromFormBase,
    canManageExpenseApproval,
    userNameById,
    renderExpenses,
    validateExpenseForm,
  } = window.expenses || {};
  const syncExpenseCatalogs =
    syncExpenseCatalogsImport ||
    (window.expenses && window.expenses.syncExpenseCatalogs) ||
    function () {};

  function applyExpenseFiltersFromForm(options) {
    const applied = applyExpenseFiltersFromFormBase ? applyExpenseFiltersFromFormBase(options) : false;
    if (applied) {
      syncSharedEntriesFiltersFromExpense();
      const filteredExpenses = currentExpenses();
      syncExpenseSelectionControls(filteredExpenses);
    }
    return applied;
  }
  const {
    emptyClientDetails,
    buildClientEditorValues,
    applyClientNameChange,
    openClientEditor,
    closeClientEditor,
    renderStateOptions,
    setFieldError,
    setClientEditorMessage,
    renderClientEditor,
    renderCatalogAside,
    readClientEditorForm,
    clientByName,
    normalizeCatalog,
    normalizeClient,
    normalizeEntry,
    normalizeExpense,
    ensureCatalogSelection,
    syncFormCatalogsUI,
    syncFilterCatalogsUI,
    syncExpenseFilterCatalogsUI,
  } = window.catalogEditor || {};
  const {
    renderUsersList,
    renderLevelRows,
    renderRatesRows,
    renderExpenseCategories,
    renderCorporateFunctionCategories,
    renderOfficeLocations,
    renderSettingsTabs,
    sortedLevels,
    getLevelDefinitions,
    syncUserManagementControls,
    handleAddLevel,
    setMembersFeedback,
    renderMembersModal,
    normalizeModalLevel,
    openChangePasswordModal,
    closeChangePasswordModal,
  } = window.settingsAdmin || {};
  const {
    currentEntries,
    renderFilterState,
    renderTable,
    canManageApproval,
    canApproveEntry,
    canUnapproveEntry,
    showApproveButton,
    resetForm,
    validateEntry,
  } = window.timeEntries || {};

  function deps() {
    return { feedback };
  }

  document.addEventListener("submit", async function (event) {
    if (!event.target || event.target.id !== "level-labels-form") return;

    event.preventDefault();
    if (!beginSettingsAutoSave("level-labels-form")) return;

    try {
      const { feedback } = deps();
      if (!state.permissions?.edit_user_profile) {
        feedback("Access denied.", true);
        return;
      }
      const rows = Array.from(
        document.querySelectorAll("#level-labels-form .level-row[data-level]")
      );

      const levels = rows
        .map((row) => {
          const level = Number(row.dataset.level);
          const labelInput = row.querySelector("[data-level-label]");
          const groupSelect = row.querySelector("[data-level-permission]");
          const label = (labelInput?.value || "").trim();
          const permissionGroup = (groupSelect?.value || "staff").trim();
          return { level, label, permissionGroup };
        })
        .sort((a, b) => a.level - b.level);

      await mutatePersistentState("update_level_labels", { levels }, settingsSaveFastOptions());
      feedback("Levels updated.", false);
    } finally {
      finishSettingsAutoSave("level-labels-form");
    }
  });

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
    sessionIndicator: document.getElementById("session-indicator"),
    accountName: document.getElementById("account-name"),
    navInputs: document.getElementById("nav-inputs"),
    navEntries: document.getElementById("nav-entries"),
    navSettings: document.getElementById("nav-settings"),
    navMembers: document.getElementById("nav-members"),
    settingsToggle: document.getElementById("settings-toggle"),
    settingsOpen: document.getElementById("settings-open"),
    settingsMenu: document.getElementById("settings-menu"),
    settingsMenuHeader: document.getElementById("settings-menu-header"),
    actingAsToggle: document.getElementById("acting-as-toggle"),
    actingAsMenu: document.getElementById("acting-as-menu"),
    actingAsInitials: document.getElementById("acting-as-initials"),
    actingAsName: document.getElementById("acting-as-name"),
    changePasswordOpen: document.getElementById("change-password-open"),
    logoutButton: document.getElementById("logout-button"),
    themeToggle: document.getElementById("theme-toggle"),
    openCatalog: document.getElementById("open-catalog"),
    openAnalytics: document.getElementById("open-analytics"),
    mobileTabbar: document.getElementById("mobile-tabbar"),
    navSettingsMobile: document.getElementById("nav-settings-mobile"),
    navMembersMobile: document.getElementById("nav-members-mobile"),
    navClientsMobile: document.getElementById("nav-clients-mobile"),
    navInputsMobile: document.getElementById("nav-inputs-mobile"),
    navEntriesMobile: document.getElementById("nav-entries-mobile"),
    navAnalyticsMobile: document.getElementById("nav-analytics-mobile"),
    inboxOpen: document.getElementById("inbox-open"),
    inboxUnreadBadge: document.getElementById("inbox-unread-badge"),
    clientsPage: document.getElementById("clients-page"),
    usersPage: document.getElementById("members-page"),
    analyticsPage: document.getElementById("analytics-page"),
    settingsPage: document.getElementById("settings-page"),
    inputsView: document.getElementById("inputs-view"),
    inputsViewTitle: document.getElementById("inputs-view-title"),
    inputsSwitchAction: document.getElementById("inputs-switch-action"),
    inputsPanelTime: document.getElementById("inputs-panel-time"),
    inputsPanelExpenses: document.getElementById("inputs-panel-expenses"),
    inputsTimeSummary: document.getElementById("inputs-time-summary"),
    inputsTimeSummaryTotal: document.getElementById("inputs-time-summary-total"),
    inputsTimeSummaryToday: document.getElementById("inputs-time-summary-today"),
    inputsTimeSummarySignal: document.getElementById("inputs-time-summary-signal"),
    inputsTimeSummaryToggle: document.getElementById("inputs-time-summary-toggle"),
    inputsTimeCalendarView: document.getElementById("inputs-time-calendar-view"),
    inputsTimeCalendarPrev: document.getElementById("inputs-time-calendar-prev"),
    inputsTimeCalendarNext: document.getElementById("inputs-time-calendar-next"),
    inputsTimeCalendarRange: document.getElementById("inputs-time-calendar-range"),
    inputsTimeCalendarGrid: document.getElementById("inputs-time-calendar-grid"),
    inputsExpenseSummary: document.getElementById("inputs-expense-summary"),
    inputsExpenseSummaryTotal: document.getElementById("inputs-expense-summary-total"),
    inputsExpenseSummaryToday: document.getElementById("inputs-expense-summary-today"),
    inputsExpenseSummarySignal: document.getElementById("inputs-expense-summary-signal"),
    inputsExpenseSummaryToggle: document.getElementById("inputs-expense-summary-toggle"),
    inputsExpenseCalendarView: document.getElementById("inputs-expense-calendar-view"),
    inputsExpenseCalendarPrev: document.getElementById("inputs-expense-calendar-prev"),
    inputsExpenseCalendarNext: document.getElementById("inputs-expense-calendar-next"),
    inputsExpenseCalendarRange: document.getElementById("inputs-expense-calendar-range"),
    inputsExpenseCalendarGrid: document.getElementById("inputs-expense-calendar-grid"),
    inputsTimeForm: document.getElementById("inputs-time-form"),
    inputsTimeClientProject: document.getElementById("inputs-time-client-project"),
    inputsTimeClient: document.getElementById("inputs-time-client"),
    inputsTimeProject: document.getElementById("inputs-time-project"),
    inputsTimeDate: document.getElementById("inputs-time-date"),
    inputsTimeHours: document.getElementById("inputs-time-hours"),
    inputsTimeBillable: document.getElementById("inputs-time-billable"),
    inputsTimeNotes: document.getElementById("inputs-time-notes"),
    inputsExpenseForm: document.getElementById("inputs-expense-form"),
    inputsExpenseClientProject: document.getElementById("inputs-expense-client-project"),
    inputsExpenseDate: document.getElementById("inputs-expense-date"),
    inputsExpenseCategory: document.getElementById("inputs-expense-category"),
    inputsExpenseAmount: document.getElementById("inputs-expense-amount"),
    inputsExpenseBillable: document.getElementById("inputs-expense-billable"),
    inputsExpenseNotes: document.getElementById("inputs-expense-notes"),
    entriesView: document.getElementById("entries-view"),
    entriesViewTitle: document.getElementById("entries-view-title"),
    entriesSubtabTime: document.getElementById("entries-subtab-time"),
    entriesSubtabExpenses: document.getElementById("entries-subtab-expenses"),
    entriesSwitchExpenses: document.getElementById("entries-switch-expenses"),
    entriesSwitchTime: document.getElementById("entries-switch-time"),
    entriesSwitchDeletedFromTime: document.getElementById("entries-switch-deleted-from-time"),
    entriesSwitchDeletedFromExpenses: document.getElementById("entries-switch-deleted-from-expenses"),
    entriesSwitchActiveFromDeleted: document.getElementById("entries-switch-active-from-deleted"),
    entriesSwitchTimeFromDeleted: document.getElementById("entries-switch-time-from-deleted"),
    entriesSwitchExpensesFromDeleted: document.getElementById("entries-switch-expenses-from-deleted"),
    entriesPanelTime: document.getElementById("entries-panel-time"),
    entriesPanelExpenses: document.getElementById("entries-panel-expenses"),
    entriesPanelDeleted: document.getElementById("entries-panel-deleted"),
    inboxView: document.getElementById("inbox-page"),
    inboxList: document.getElementById("inbox-list"),
    inboxFilterAll: document.getElementById("inbox-filter-all"),
    inboxFilterUnread: document.getElementById("inbox-filter-unread"),
    inboxMarkSelectedRead: document.getElementById("inbox-mark-selected-read"),
    inboxDeleteSelected: document.getElementById("inbox-delete-selected"),
    inboxDeleteRead: document.getElementById("inbox-delete-read"),
    expenseRows: document.getElementById("expense-rows"),
    addCategory: document.getElementById("add-category"),
    expenseCategoriesForm: document.getElementById("expense-categories-form"),
    corporateFunctionsForm: document.getElementById("corporate-functions-form"),
    corporateFunctionRows: document.getElementById("corporate-function-rows"),
    departmentsForm: document.getElementById("departments-form"),
    departmentRows: document.getElementById("department-rows"),
    addDepartment: document.getElementById("add-department"),
    targetRealizationsForm: document.getElementById("target-realizations-form"),
    targetRealizationsMatrix: document.getElementById("target-realizations-matrix"),
    departmentLeadsForm: document.getElementById("department-leads-form"),
    departmentLeadsMatrix: document.getElementById("department-leads-matrix"),
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
    closeMembers: document.getElementById("close-members"),
    addClientForm: document.getElementById("add-client-form"),
    addProjectForm: document.getElementById("add-project-form"),
    addUserForm: document.getElementById("add-user-form"),
    levelLabelsForm: document.getElementById("level-labels-form"),
    levelRows: document.getElementById("level-rows"),
    ratesForm: document.getElementById("rates-form"),
    messagingRulesForm: document.getElementById("messaging-rules-form"),
    messagingRulesRows: document.getElementById("messaging-rules-rows"),
    ratesRows: document.getElementById("rates-rows"),
    addLevel: document.getElementById("add-level"),
    filterForm: document.getElementById("filter-form"),
    clearFilters: document.getElementById("clear-filters"),
    exportCsv: document.getElementById("export-csv"),
    entriesSelectToggle: document.getElementById("entries-select-toggle"),
    entriesDeleteSelected: document.getElementById("entries-delete-selected"),
    entriesSelectCancel: document.getElementById("entries-select-cancel"),
    entriesSelectHeader: document.getElementById("entries-select-header"),
    entriesSelectAllVisible: document.getElementById("entries-select-all-visible"),
    filterTotalHours: document.getElementById("filter-total-hours"),
    feedback: document.getElementById("feedback"),
    inputsFeedback: document.getElementById("inputs-feedback"),
    activeFilters: document.getElementById("active-filters"),
    entriesUndoBar: document.getElementById("entries-undo-bar"),
    entriesUndoMessage: document.getElementById("entries-undo-message"),
    entriesUndoAction: document.getElementById("entries-undo-action"),
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
    filterFromMonth: document.getElementById("filter-from-month"),
    filterFromDay: document.getElementById("filter-from-day"),
    filterFromYear: document.getElementById("filter-from-year"),
    filterToMonth: document.getElementById("filter-to-month"),
    filterToDay: document.getElementById("filter-to-day"),
    filterToYear: document.getElementById("filter-to-year"),
    filterDateRange: document.getElementById("filter-date-range"),
    expenseFilterForm: document.getElementById("expense-filter-form"),
    expenseClearFilters: document.getElementById("expense-clear-filters"),
    expenseExportCsv: document.getElementById("expense-export-csv"),
    expensesSelectToggle: document.getElementById("expenses-select-toggle"),
    expensesDeleteSelected: document.getElementById("expenses-delete-selected"),
    expensesSelectCancel: document.getElementById("expenses-select-cancel"),
    expensesSelectHeader: document.getElementById("expenses-select-header"),
    expensesSelectAllVisible: document.getElementById("expenses-select-all-visible"),
    expenseFilterTotal: document.getElementById("expense-filter-total"),
    expenseActiveFilters: document.getElementById("expense-active-filters"),
    expensesUndoBar: document.getElementById("expenses-undo-bar"),
    expensesUndoMessage: document.getElementById("expenses-undo-message"),
    expensesUndoAction: document.getElementById("expenses-undo-action"),
    deletedSelectToggle: document.getElementById("deleted-select-toggle"),
    deletedClearFilters: document.getElementById("deleted-clear-filters"),
    deletedFilterForm: document.getElementById("deleted-filter-form"),
    deletedFilterUser: document.getElementById("deleted-filter-user"),
    deletedFilterClient: document.getElementById("deleted-filter-client"),
    deletedFilterProject: document.getElementById("deleted-filter-project"),
    deletedFilterFrom: document.getElementById("deleted-filter-from"),
    deletedFilterTo: document.getElementById("deleted-filter-to"),
    deletedFilterSearch: document.getElementById("deleted-filter-search"),
    deletedActiveFilters: document.getElementById("deleted-active-filters"),
    deletedRestoreSelected: document.getElementById("deleted-restore-selected"),
    deletedSelectCancel: document.getElementById("deleted-select-cancel"),
    deletedSelectHeader: document.getElementById("deleted-select-header"),
    deletedSelectAllVisible: document.getElementById("deleted-select-all-visible"),
    deletedItemsBody: document.getElementById("deleted-items-body"),
    expenseFilterUser: document.getElementById("expense-filter-user"),
    expenseFilterClient: document.getElementById("expense-filter-client"),
    expenseFilterProject: document.getElementById("expense-filter-project"),
    expenseFilterFromMonth: document.getElementById("expense-filter-from-month"),
    expenseFilterFromDay: document.getElementById("expense-filter-from-day"),
    expenseFilterFromYear: document.getElementById("expense-filter-from-year"),
    expenseFilterToMonth: document.getElementById("expense-filter-to-month"),
    expenseFilterToDay: document.getElementById("expense-filter-to-day"),
    expenseFilterToYear: document.getElementById("expense-filter-to-year"),
    expenseFilterDateRange: document.getElementById("expense-filter-date-range"),
    officeLocationsForm: document.getElementById("office-locations-form"),
    officeRows: document.getElementById("office-rows"),
    officeAddName: document.getElementById("office-add-name"),
    officeAddLead: document.getElementById("office-add-lead"),
    addOffice: document.getElementById("add-office"),
    navAudit: document.getElementById("nav-audit"),
    navAuditMobile: document.getElementById("nav-audit-mobile"),
    auditView: document.getElementById("audit-page"),
    auditFilterForm: document.getElementById("audit-filter-form"),
    auditFilterDate: document.getElementById("audit-filter-date"),
    auditFilterBeginDate: document.querySelector('#audit-filter-form input[name="beginDate"]'),
    auditFilterEndDate: document.querySelector('#audit-filter-form input[name="endDate"]'),
    auditFilterEntity: document.getElementById("audit-filter-entity"),
    auditFilterAction: document.getElementById("audit-filter-action"),
    auditFilterActor: document.getElementById("audit-filter-actor"),
    auditFilterCategory: document.getElementById("audit-filter-category"),
    auditLoadMore: document.getElementById("audit-load-more"),
    auditDownloadOpen: document.getElementById("audit-download-open"),
    auditDownloadDialog: document.getElementById("audit-download-dialog"),
    auditDownloadForm: document.getElementById("audit-download-form"),
    auditDownloadBeginDate: document.getElementById("audit-download-begin-date"),
    auditDownloadEndDate: document.getElementById("audit-download-end-date"),
    auditDownloadActor: document.getElementById("audit-download-actor"),
    auditDownloadEntity: document.getElementById("audit-download-entity"),
    auditDownloadAction: document.getElementById("audit-download-action"),
    auditDownloadCancel: document.getElementById("audit-download-cancel"),
    auditDownloadSubmit: document.getElementById("audit-download-submit"),
    auditTableBody: document.getElementById("audit-table-body"),
    appTopbar: document.querySelector(".app-topbar"),
  };

  function createHiddenFilterTarget() {
    return {
      hidden: true,
      innerHTML: "",
    };
  }

  if (refs.activeFilters) {
    refs.activeFilters.remove();
    refs.activeFilters = createHiddenFilterTarget();
  }
  if (refs.expenseActiveFilters) {
    refs.expenseActiveFilters.remove();
    refs.expenseActiveFilters = createHiddenFilterTarget();
  }

  function ensureAuditFilterControls() {
    if (!refs.auditFilterForm) return;
    const form = refs.auditFilterForm;
    const labelFor = (selector) => form.querySelector(selector)?.closest("label") || null;

    let categorySelect = refs.auditFilterCategory;
    let categoryLabel = labelFor("#audit-filter-category");
    if (!categorySelect || !categoryLabel) {
      categoryLabel = document.createElement("label");
      categoryLabel.innerHTML = `
        <span>Category</span>
        <select id="audit-filter-category" name="category">
          <option value="">All</option>
          <option value="activity">Activity</option>
          <option value="client_project">Client/Project</option>
          <option value="settings_edits">Settings edits</option>
        </select>
      `;
      form.appendChild(categoryLabel);
      categorySelect = categoryLabel.querySelector("#audit-filter-category");
    }

    let dateInput = refs.auditFilterDate;
    let dateLabel = labelFor("#audit-filter-date");
    if (!dateInput || !dateLabel) {
      dateLabel = document.createElement("label");
      dateLabel.innerHTML = `
        <span>Date Range</span>
        <input id="audit-filter-date" name="date" type="text" readonly data-audit-date-range placeholder="Select date range" />
      `;
      form.appendChild(dateLabel);
      dateInput = dateLabel.querySelector("#audit-filter-date");
    }

    const dateLabelText = dateLabel.querySelector("span");
    if (dateLabelText) dateLabelText.textContent = "Date Range";
    if (dateInput) {
      dateInput.type = "text";
      dateInput.readOnly = true;
      dateInput.placeholder = "Select date range";
      dateInput.setAttribute("data-audit-date-range", "true");
      dateInput.classList.add("filter-date-range-input");
      dateInput.value = "Select date range";
      dateInput.dataset.dpFilter = "true";
      dateInput.dataset.dpRange = "true";
      dateInput.dataset.dpBody = "#audit-table-body";
    }

    let beginInput = form.querySelector('input[name="beginDate"]');
    if (!beginInput) {
      beginInput = document.createElement("input");
      beginInput.type = "text";
      beginInput.name = "beginDate";
      beginInput.hidden = true;
      dateLabel.appendChild(beginInput);
    }
    let endInput = form.querySelector('input[name="endDate"]');
    if (!endInput) {
      endInput = document.createElement("input");
      endInput.type = "text";
      endInput.name = "endDate";
      endInput.hidden = true;
      dateLabel.appendChild(endInput);
    }

    if (dateInput) {
      dateInput._dpRangeFrom = beginInput;
      dateInput._dpRangeTo = endInput;
      dateInput._dpAnchor = dateInput.closest("[data-audit-date-range]") || dateInput;
    }

    const actorLabel = labelFor("#audit-filter-actor");
    const entityLabel = labelFor("#audit-filter-entity");
    const actionLabel = labelFor("#audit-filter-action");
    [categoryLabel, dateLabel, actorLabel, entityLabel, actionLabel]
      .filter(Boolean)
      .forEach((node) => form.appendChild(node));

    refs.auditFilterDate = dateInput || null;
    refs.auditFilterBeginDate = beginInput || null;
    refs.auditFilterEndDate = endInput || null;
    refs.auditFilterCategory = categorySelect || null;
  }
  ensureAuditFilterControls();

  function syncAuditDateRangeField(fromIso, toIso) {
    const input = refs.auditFilterDate;
    if (!input) return;
    const safeFrom = isValidDateString(fromIso) ? fromIso : "";
    const safeTo = isValidDateString(toIso) ? toIso : "";
    const fromInput = refs.auditFilterBeginDate;
    const toInput = refs.auditFilterEndDate;
    if (fromInput) {
      fromInput.dataset.dpCanonical = safeFrom;
      fromInput.value = safeFrom ? formatDisplayDate(safeFrom) : "";
    }
    if (toInput) {
      toInput.dataset.dpCanonical = safeTo;
      toInput.value = safeTo ? formatDisplayDate(safeTo) : "";
    }
    input.value = formatEntriesDateRangeDisplay(safeFrom, safeTo);
    input.dataset.dpRangeStart = safeFrom;
    input.dataset.dpRangeEnd = safeTo;
  }

  let addClientHeaderButton = null;
  let clientLifecycleToggleWrap = null;
  let clientLifecycleToggleActive = null;
  let clientLifecycleToggleInactive = null;
  let addProjectHeaderButton = null;
  let projectLifecycleToggleWrap = null;
  let projectLifecycleToggleActive = null;
  let projectLifecycleToggleInactive = null;
  let memberEditorModal = null;
  let memberEditorForm = null;
  let memberEditorTitle = null;
  let memberEditorStatus = null;
  let memberEditorSubmit = null;
  let memberEditorReset = null;
  let memberEditorMode = "create";
  let memberEditorUserId = "";
  let memberEditorScope = "full";

  function ensureInboxBulkReadButton() {
    if (refs.inboxMarkSelectedRead) return;
    const headControls =
      refs.inboxDeleteRead?.parentElement || document.querySelector(".inbox-head-controls");
    if (!headControls) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "inbox-mark-selected-read";
    button.className = "button button-ghost";
    button.hidden = true;
    button.textContent = "Mark selected read";
    if (refs.inboxDeleteSelected && refs.inboxDeleteSelected.parentElement === headControls) {
      headControls.insertBefore(button, refs.inboxDeleteSelected);
    } else {
      headControls.appendChild(button);
    }
    refs.inboxMarkSelectedRead = button;
  }

  ensureInboxBulkReadButton();

  function syncClientLifecycleToggleUi() {
    if (!clientLifecycleToggleActive || !clientLifecycleToggleInactive) return;
    const activeSelected = state.catalogClientLifecycleView !== "inactive";
    const visibleClientIdSet = state.visibilitySnapshotReady
      ? new Set((state.visibleClientIds || []).map((id) => String(id || "").trim()))
      : null;
    const sourceClients = (state.clients || []).filter((client) => {
      if (!visibleClientIdSet) return true;
      return visibleClientIdSet.has(String(client?.id || "").trim());
    });
    const inactiveClientCount = sourceClients.filter((client) => !isClientActive(client)).length;
    clientLifecycleToggleActive.className = activeSelected ? "button" : "button button-ghost";
    clientLifecycleToggleInactive.className = activeSelected ? "button button-ghost" : "button";
    clientLifecycleToggleActive.setAttribute("aria-pressed", activeSelected ? "true" : "false");
    clientLifecycleToggleInactive.setAttribute("aria-pressed", activeSelected ? "false" : "true");
    clientLifecycleToggleActive.disabled = false;
    clientLifecycleToggleInactive.disabled = inactiveClientCount === 0;
  }

  function syncProjectLifecycleToggleUi() {
    if (!projectLifecycleToggleActive || !projectLifecycleToggleInactive) return;
    const activeSelected = state.catalogProjectLifecycleView !== "inactive";
    const selectedClient = String(state.selectedCatalogClient || "").trim();
    const visibleProjectIdSet = state.visibilitySnapshotReady
      ? new Set((state.visibleProjectIds || []).map((id) => String(id || "").trim()))
      : null;
    const countVisibleProjectsForLifecycle = (view) => {
      if (!selectedClient) return 0;
      const matchingProjects = (state.projects || []).filter((project) => {
        if (!project || String(project.client || "").trim() !== selectedClient) return false;
        if (visibleProjectIdSet && !visibleProjectIdSet.has(String(project?.id || "").trim())) return false;
        return view === "inactive" ? !isProjectActive(project) : isProjectActive(project);
      });
      return uniqueValues(matchingProjects.map((project) => String(project?.name || "").trim()).filter(Boolean)).length;
    };
    const activeProjectCount = countVisibleProjectsForLifecycle("active");
    const inactiveProjectCount = countVisibleProjectsForLifecycle("inactive");
    projectLifecycleToggleActive.className = activeSelected ? "button" : "button button-ghost";
    projectLifecycleToggleInactive.className = activeSelected ? "button button-ghost" : "button";
    projectLifecycleToggleActive.setAttribute("aria-pressed", activeSelected ? "true" : "false");
    projectLifecycleToggleInactive.setAttribute("aria-pressed", activeSelected ? "false" : "true");
    projectLifecycleToggleActive.disabled = activeProjectCount === 0;
    projectLifecycleToggleInactive.disabled = inactiveProjectCount === 0;
  }

  function setupAddClientHeaderAction() {
    const clientsColumn =
      refs.clientColumnLabel?.closest(".catalog-column") ||
      refs.clientList?.closest(".catalog-column") ||
      refs.addClientForm?.closest(".catalog-column");
    const header = clientsColumn?.querySelector(".catalog-column-head");
    if (!header) return;
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";
    header.style.flexWrap = "nowrap";

    if (!addClientHeaderButton) {
      addClientHeaderButton = document.createElement("button");
      addClientHeaderButton.type = "button";
      addClientHeaderButton.className = "button button-ghost";
      addClientHeaderButton.textContent = "Add client";
      addClientHeaderButton.style.marginLeft = "0";
      addClientHeaderButton.addEventListener("click", async function () {
        if (!canManageClientsLifecycle()) {
          feedback("Access denied.", true);
          return;
        }
        await ensureOfficeLocationsLoadedForClientEditor();
        openClientEditor({ mode: "create", clientName: "" });
      });
    }

    if (!clientLifecycleToggleWrap) {
      clientLifecycleToggleWrap = document.createElement("div");
      clientLifecycleToggleWrap.className = "catalog-lifecycle-toggle";
      clientLifecycleToggleWrap.style.marginLeft = "auto";
      clientLifecycleToggleActive = document.createElement("button");
      clientLifecycleToggleActive.type = "button";
      clientLifecycleToggleActive.textContent = "Active";
      clientLifecycleToggleActive.addEventListener("click", function () {
        state.catalogClientLifecycleView = "active";
        state.catalogProjectLifecycleView = "active";
        ensureCatalogSelection();
        syncClientLifecycleToggleUi();
        syncProjectLifecycleToggleUi();
        renderCatalogAside();
        syncProjectCardsUx();
      });
      clientLifecycleToggleInactive = document.createElement("button");
      clientLifecycleToggleInactive.type = "button";
      clientLifecycleToggleInactive.textContent = "Inactive";
      clientLifecycleToggleInactive.addEventListener("click", function () {
        state.catalogClientLifecycleView = "inactive";
        state.catalogProjectLifecycleView = "inactive";
        ensureCatalogSelection();
        syncClientLifecycleToggleUi();
        syncProjectLifecycleToggleUi();
        renderCatalogAside();
        syncProjectCardsUx();
      });
      clientLifecycleToggleWrap.appendChild(clientLifecycleToggleActive);
      clientLifecycleToggleWrap.appendChild(clientLifecycleToggleInactive);
    }

    if (!addClientHeaderButton.isConnected) {
      header.appendChild(addClientHeaderButton);
    }
    addClientHeaderButton.hidden = !canManageClientsLifecycle();
    if (!clientLifecycleToggleWrap.isConnected) {
      header.appendChild(clientLifecycleToggleWrap);
    }
    syncClientLifecycleToggleUi();
    if (refs.addClientForm && refs.addClientForm.isConnected) {
      refs.addClientForm.remove();
    }
  }

  function syncClientEditorLeadField() {
    if (!refs.clientEditor || refs.clientEditor.hidden) return;
    const form = refs.clientEditor.querySelector("[data-client-editor-form]");
    if (!form) return;
    const topRow = form.querySelector(".client-editor-row-fields-top");
    if (!topRow) return;

    let leadField = topRow.querySelector('[name="client_lead_id"]')?.closest(".client-editor-field");
    if (!leadField) {
      leadField = document.createElement("label");
      leadField.className = "client-editor-field";
      leadField.innerHTML = `
        <span>Client Lead</span>
        <select name="client_lead_id"></select>
      `;
      topRow.appendChild(leadField);
    }

    const leadSelect = leadField.querySelector('select[name="client_lead_id"]');
    if (!leadSelect) return;

    const selectedLeadId =
      String(
        leadSelect.value ||
          state.clientEditor?.values?.clientLeadId ||
          state.clientEditor?.values?.client_lead_id ||
          ""
      ).trim();
    const allActiveUsers = (state.users || [])
      .filter((user) => user && user.isActive !== false && user.displayName)
      .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
    const executiveEligibleUsers = allActiveUsers.filter((user) => {
      const group = String(permissionGroupForUser(user) || "").toLowerCase();
      return group === "executive" || group === "admin" || group === "superuser";
    });
    const eligibleIdSet = new Set(executiveEligibleUsers.map((user) => String(user.id || "").trim()));
    const currentSelectedUser = allActiveUsers.find((user) => String(user.id || "").trim() === selectedLeadId) || null;

    const options = ['<option value="">Unassigned</option>']
      .concat(
        executiveEligibleUsers.map((user) => {
          const id = String(user.id || "").trim();
          const selected = id && id === selectedLeadId ? "selected" : "";
          return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(
            String(user.displayName || "")
          )}</option>`;
        })
      )
      .concat(
        selectedLeadId && !eligibleIdSet.has(selectedLeadId) && currentSelectedUser
          ? [
              `<option value="${escapeHtml(selectedLeadId)}" selected>${escapeHtml(
                `${String(currentSelectedUser.displayName || "").trim()} (Current)`
              )}</option>`,
            ]
          : []
      )
      .join("");
    leadSelect.innerHTML = options;
    if (selectedLeadId) {
      leadSelect.value = selectedLeadId;
    }
  }

  async function ensureOfficeLocationsLoadedForClientEditor() {
    if (Array.isArray(state.officeLocations) && state.officeLocations.length) {
      return;
    }
    try {
      await loadSettingsMetadata(true);
    } catch (error) {
      // Keep existing behavior: editor can still open even if metadata load fails.
    }
  }

  async function ensureProjectEditorMetadataLoaded() {
    const hasDepartments = Array.isArray(state.departments) && state.departments.length;
    const hasOfficeLocations = Array.isArray(state.officeLocations) && state.officeLocations.length;
    if (hasDepartments && hasOfficeLocations) {
      return;
    }
    try {
      await loadSettingsMetadata(true);
    } catch (error) {
      // Keep existing behavior: editor can still open even if metadata load fails.
    }
  }

  function parseProjectBudgetAmount(rawValue) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }
    const normalized = trimmed.replace(/[$,\s]/g, "");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, value: null };
    }
    return { ok: true, value: parsed };
  }

  async function persistProjectTeamAssignments(options) {
    const clientName = String(options?.clientName || "").trim();
    const projectName = String(options?.projectName || "").trim();
    if (!clientName || !projectName) return;
    const normalizeIds = (ids) =>
      [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))];
    const initialManagers = normalizeIds(options?.initialManagerUserIds);
    const initialStaff = normalizeIds(options?.initialStaffUserIds);
    const nextManagers = normalizeIds(options?.nextManagerUserIds);
    const nextStaff = normalizeIds(options?.nextStaffUserIds).filter((id) => !nextManagers.includes(id));

    const toAddManagers = nextManagers.filter((id) => !initialManagers.includes(id));
    const toRemoveManagers = initialManagers.filter((id) => !nextManagers.includes(id));
    const toAddStaff = nextStaff.filter((id) => !initialStaff.includes(id));
    const toRemoveStaff = initialStaff.filter((id) => !nextStaff.includes(id));

    const mutationOptions = { skipHydrate: true, refreshState: false, returnState: false };
    for (const managerId of toAddManagers) {
      await mutatePersistentState(
        "assign_manager_project",
        { managerId, clientName, projectName },
        mutationOptions
      );
    }
    for (const managerId of toRemoveManagers) {
      await mutatePersistentState(
        "unassign_manager_project",
        { managerId, clientName, projectName },
        mutationOptions
      );
    }
    for (const userId of toAddStaff) {
      await mutatePersistentState(
        "add_project_member",
        { userId, clientName, projectName },
        mutationOptions
      );
    }
    for (const userId of toRemoveStaff) {
      await mutatePersistentState(
        "remove_project_member",
        { userId, clientName, projectName },
        mutationOptions
      );
    }
  }

  function projectScopedManagerIdsForProject(clientName, projectName) {
    const normalizedClient = String(clientName || "").trim().toLowerCase();
    const normalizedProject = String(projectName || "").trim().toLowerCase();
    if (!normalizedClient || !normalizedProject) return [];
    const targetProject = (state.projects || []).find(
      (item) =>
        String(item?.client || "").trim().toLowerCase() === normalizedClient &&
        String(item?.name || item?.project || "").trim().toLowerCase() === normalizedProject
    );
    const targetProjectId = String(targetProject?.id || "").trim();
    const matchesProject = (item) => {
      const itemProjectId = String(item?.projectId || item?.project_id || "").trim();
      if (targetProjectId && itemProjectId && itemProjectId === targetProjectId) return true;
      const itemClient = String(item?.clientName || item?.client_name || item?.client || "").trim().toLowerCase();
      const itemProject = String(item?.projectName || item?.project_name || item?.project || "").trim().toLowerCase();
      return itemClient === normalizedClient && itemProject === normalizedProject;
    };
    const managerIdsFromProjectAssignments = (state.assignments?.managerProjects || [])
      .filter(matchesProject)
      .map((item) => String(item?.managerId || item?.manager_id || "").trim())
      .filter(Boolean);
    const managerIdsFromProjectMembers = (state.assignments?.projectMembers || [])
      .filter(matchesProject)
      .map((item) => String(item?.userId || item?.user_id || "").trim())
      .filter((userId) => {
        if (!userId) return false;
        const user = getUserById(userId);
        return Boolean(user && !isStaff(user));
      });
    return uniqueValues([...managerIdsFromProjectAssignments, ...managerIdsFromProjectMembers]);
  }

  function syncBillingContactFromBusiness(form) {
    if (!form) return;
    const sameAsBusiness = field(form, "billing_same_as_business");
    if (!sameAsBusiness || !sameAsBusiness.checked) return;
    const businessName = field(form, "business_contact_name");
    const businessEmail = field(form, "business_contact_email");
    const businessPhone = field(form, "business_contact_phone");
    const billingName = field(form, "billing_contact_name");
    const billingEmail = field(form, "billing_contact_email");
    const billingPhone = field(form, "billing_contact_phone");
    if (billingName && businessName) billingName.value = businessName.value || "";
    if (billingEmail && businessEmail) billingEmail.value = businessEmail.value || "";
    if (billingPhone && businessPhone) billingPhone.value = businessPhone.value || "";
  }

  async function openProjectEditDialogFlow(clientName, projectName) {
    await ensureProjectEditorMetadataLoaded();
    const normalizedClient = String(clientName || "").trim();
    const normalizedProject = String(projectName || "").trim();
    if (!normalizedClient || !normalizedProject) {
      return;
    }
    if (!canEditProjectModal(normalizedClient, normalizedProject)) {
      feedback("Access denied.", true);
      return;
    }
    const projectRow =
      (state.projects || []).find(
        (p) =>
          p.client === normalizedClient &&
          String(p.name || "").toLowerCase() === normalizedProject.toLowerCase()
      ) || null;
    if (!projectRow) {
      feedback("Project not found.", true);
      return;
    }
    const currentContractAmount = Number.isFinite(
      Number(projectRow.contractAmount ?? projectRow.contract_amount)
    )
      ? Number(projectRow.contractAmount ?? projectRow.contract_amount)
      : null;
    const currentOverheadPercent = Number.isFinite(
      Number(projectRow.overheadPercent ?? projectRow.overhead_percent)
    )
      ? Number(projectRow.overheadPercent ?? projectRow.overhead_percent)
      : null;
    const currentPricingModelRaw = String(
      projectRow.pricingModel ?? projectRow.pricing_model ?? ""
    )
      .trim()
      .toLowerCase();
    const currentPricingModel =
      currentPricingModelRaw === "time_and_materials" ? "time_and_materials" : "fixed_fee";
    const projectTargetRaw = projectRow.targetRealizationPct ?? projectRow.target_realization_pct;
    const currentTargetRealizationPct =
      projectTargetRaw === null || projectTargetRaw === undefined || `${projectTargetRaw}`.trim() === ""
        ? null
        : Number.isFinite(Number(projectTargetRaw))
          ? Number(projectTargetRaw)
          : null;
    const projectTechAdminFeeRaw =
      projectRow.techAdminFeePctOverride ?? projectRow.tech_admin_fee_pct_override;
    const currentTechAdminFeePctOverride =
      projectTechAdminFeeRaw === null ||
      projectTechAdminFeeRaw === undefined ||
      `${projectTechAdminFeeRaw}`.trim() === ""
        ? null
        : Number.isFinite(Number(projectTechAdminFeeRaw))
          ? Number(projectTechAdminFeeRaw)
          : null;
    const projectLeadId = String(projectRow?.projectLeadId || projectRow?.project_lead_id || "").trim() || null;
    const projectDepartmentId =
      String(projectRow?.projectDepartmentId || projectRow?.project_department_id || "").trim() || null;
    const clientRow =
      (state.clients || []).find((client) => String(client?.name || "").trim() === normalizedClient) || null;
    const clientOfficeId = String(clientRow?.officeId || clientRow?.office_id || "").trim() || null;
    const projectOfficeId =
      String(projectRow?.officeId || projectRow?.office_id || "").trim() || clientOfficeId || null;
    const defaultTargetRealizationPct = (() => {
      const officeId = String(projectOfficeId || "").trim();
      const departmentId = String(projectDepartmentId || "").trim();
      if (!officeId || !departmentId) return null;
      const match = (state.targetRealizations || []).find(
        (item) =>
          String(item?.officeId || item?.office_id || "").trim() === officeId &&
          String(item?.departmentId || item?.department_id || "").trim() === departmentId
      );
      const raw = match?.targetRealizationPct ?? match?.target_realization_pct;
      if (raw === null || raw === undefined || `${raw}`.trim() === "") return null;
      return Number.isFinite(Number(raw)) ? Number(raw) : null;
    })();
    const managerUserIds = projectScopedManagerIdsForProject(normalizedClient, normalizedProject);
    const staffUserIds = staffIdsForProject(normalizedClient, normalizedProject);
    const projectDialog = await openProjectDialog({
      mode: "edit",
      projectId: String(projectRow?.id || "").trim() || null,
      clientName: normalizedClient,
      projectName: normalizedProject,
      contractAmount: currentContractAmount,
      pricingModel: currentPricingModel,
      overheadPercent: currentOverheadPercent,
      targetRealizationPct: currentTargetRealizationPct,
      techAdminFeePctOverride: currentTechAdminFeePctOverride,
      defaultTargetRealizationPct,
      projectLeadId,
      projectDepartmentId,
      projectOfficeId,
      clientOfficeId,
      managerUserIds,
      staffUserIds,
      allowOpenPlanning: canEditProjectPlanning(normalizedClient, normalizedProject),
    });
    if (!projectDialog) {
      return;
    }
    if (projectDialog.openProjectPlanning) {
      return;
    }
    const nextName = projectDialog.projectName;
    try {
      await mutatePersistentState("update_project", {
        clientName: normalizedClient,
        projectName: normalizedProject,
        nextName,
        contractAmount: projectDialog.contractAmount,
        pricingModel: projectDialog.pricingModel,
        overheadPercent: projectDialog.overheadPercent,
        targetRealizationPct: projectDialog.targetRealizationPct,
        techAdminFeePctOverride: projectDialog.techAdminFeePctOverride,
        project_lead_id: projectDialog.projectLeadId,
        project_department_id: projectDialog.projectDepartmentId,
        office_id: projectDialog.projectOfficeId,
      });
      await persistProjectTeamAssignments({
        clientName: normalizedClient,
        projectName: nextName,
        initialManagerUserIds: managerUserIds,
        initialStaffUserIds: staffUserIds,
        nextManagerUserIds: projectDialog.managerUserIds,
        nextStaffUserIds: projectDialog.staffUserIds,
      });
    } catch (error) {
      feedback(error?.message || "Unable to update project.", true);
      return;
    }
    if (state.filters.client === normalizedClient && state.filters.project === normalizedProject) {
      state.filters.project = nextName.trim();
      syncFilterCatalogsUI(state.filters);
    }
    feedback("Project updated.", false);
    render();
    loadPersistentStateInBackground();
  }

  async function openProjectDialog(options) {
    return new Promise((resolve) => {
      const mode = options?.mode === "edit" ? "edit" : "add";
      const isProjectEditDialog = mode === "edit";
      const canOpenPlanningFromDialog = isProjectEditDialog && options?.allowOpenPlanning !== false;
      const currentProjectId = String(options?.projectId || "").trim() || null;
      const currentName = String(options?.projectName || "");
      const currentBudget = Number.isFinite(options?.budgetAmount) ? Number(options.budgetAmount) : null;
      const currentContractAmount = Number.isFinite(Number(options?.contractAmount))
        ? Number(options.contractAmount)
        : null;
      const currentLeadId = String(options?.projectLeadId || "").trim();
      const currentProjectDepartmentId = String(options?.projectDepartmentId || "").trim();
      const currentProjectOfficeId =
        String(options?.projectOfficeId || "").trim() || String(options?.clientOfficeId || "").trim();
      const currentPricingModelRaw = String(options?.pricingModel || "").trim();
      const currentPricingModel =
        currentPricingModelRaw === "time_and_materials" ? "time_and_materials" : "fixed_fee";
      const currentOverheadPercent = Number.isFinite(Number(options?.overheadPercent))
        ? Number(options.overheadPercent)
        : null;
      const currentTargetRealizationPctRaw = options?.targetRealizationPct;
      const currentTargetRealizationPct =
        currentTargetRealizationPctRaw === null ||
        currentTargetRealizationPctRaw === undefined ||
        `${currentTargetRealizationPctRaw}`.trim() === ""
          ? null
          : Number.isFinite(Number(currentTargetRealizationPctRaw))
            ? Number(currentTargetRealizationPctRaw)
            : null;
      const currentTechAdminFeePctOverrideRaw = options?.techAdminFeePctOverride;
      const currentTechAdminFeePctOverride =
        currentTechAdminFeePctOverrideRaw === null ||
        currentTechAdminFeePctOverrideRaw === undefined ||
        `${currentTechAdminFeePctOverrideRaw}`.trim() === ""
          ? null
          : Number.isFinite(Number(currentTechAdminFeePctOverrideRaw))
            ? Number(currentTechAdminFeePctOverrideRaw)
            : null;
      const defaultTargetRealizationPctRaw = options?.defaultTargetRealizationPct;
      const defaultTargetRealizationPct =
        defaultTargetRealizationPctRaw === null ||
        defaultTargetRealizationPctRaw === undefined ||
        `${defaultTargetRealizationPctRaw}`.trim() === ""
          ? null
          : Number.isFinite(Number(defaultTargetRealizationPctRaw))
            ? Number(defaultTargetRealizationPctRaw)
            : null;
      const initialManagerUserIds = Array.isArray(options?.managerUserIds)
        ? [...new Set(options.managerUserIds.map((id) => String(id || "").trim()).filter(Boolean))]
        : [];
      const initialStaffUserIds = Array.isArray(options?.staffUserIds)
        ? [...new Set(options.staffUserIds.map((id) => String(id || "").trim()).filter(Boolean))]
        : [];
      let pendingManagerUserIds = [...initialManagerUserIds];
      let pendingStaffUserIds = [...initialStaffUserIds];
      const title = mode === "edit" ? "Edit project" : "Add project";
      const finalConfirmText = mode === "edit" ? "Save" : "Add";
      const activeUsers = (state.users || [])
        .filter((user) => user && user.isActive !== false && user.displayName)
        .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
      const leadNameById = new Map(
        activeUsers.map((user) => [String(user.id || "").trim(), String(user.displayName || "").trim()])
      );
      const currentLeadName =
        leadNameById.get(currentLeadId) ||
        String(options?.projectLeadName || "").trim() ||
        "";
      const viewerOfficeId = String(state.currentUser?.officeId || state.currentUser?.office_id || "").trim();
      const viewerDepartmentId = String(
        state.currentUser?.departmentId || state.currentUser?.department_id || ""
      ).trim();
      const sameOfficeDepartmentUsers =
        viewerOfficeId && viewerDepartmentId
          ? activeUsers.filter((user) => {
              const officeId = String(user?.officeId || user?.office_id || "").trim();
              const departmentId = String(user?.departmentId || user?.department_id || "").trim();
              return officeId === viewerOfficeId && departmentId === viewerDepartmentId;
            })
          : [];
      const scopedDefaultLeadMap = new Map();
      const searchableLeadMap = new Map();
      const registerLeadUser = (targetMap, user) => {
        const id = String(user?.id || "").trim();
        const name = String(user?.displayName || "").trim();
        if (!id || !name || targetMap.has(id)) return;
        targetMap.set(id, { id, name, label: name });
      };
      sameOfficeDepartmentUsers.forEach((user) => registerLeadUser(scopedDefaultLeadMap, user));
      activeUsers.forEach((user) => registerLeadUser(searchableLeadMap, user));
      if (currentLeadId && currentLeadName) {
        if (!scopedDefaultLeadMap.has(currentLeadId)) {
          scopedDefaultLeadMap.set(currentLeadId, {
            id: currentLeadId,
            name: currentLeadName,
            label: `${currentLeadName} (Current)`,
          });
        }
        if (!searchableLeadMap.has(currentLeadId)) {
          searchableLeadMap.set(currentLeadId, {
            id: currentLeadId,
            name: currentLeadName,
            label: `${currentLeadName} (Current)`,
          });
        }
      }
      const defaultLeadChoicesBase = [{ id: "", name: "Unassigned", label: "Unassigned" }].concat(
        Array.from(scopedDefaultLeadMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
      const searchableLeadChoicesBase = [{ id: "", name: "Unassigned", label: "Unassigned" }].concat(
        Array.from(searchableLeadMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
      const leadNameCounts = new Map();
      searchableLeadChoicesBase.forEach((item) => {
        const key = String(item?.name || "").trim().toLowerCase();
        if (!key) return;
        leadNameCounts.set(key, (leadNameCounts.get(key) || 0) + 1);
      });
      const normalizeLeadChoices = (choices) =>
        choices.map((item) => {
          const itemId = String(item?.id || "").trim();
          const itemName = String(item?.name || "").trim();
          const explicitLabel = String(item?.label || "").trim();
          const duplicateCount = leadNameCounts.get(itemName.toLowerCase()) || 0;
          const needsDisambiguation =
            itemId && duplicateCount > 1 && !/\(current\)\s*$/i.test(explicitLabel);
          const label = needsDisambiguation
            ? `${itemName} (${itemId})`
            : explicitLabel || itemName || "Unassigned";
          return { id: itemId, name: itemName, label };
        });
      const defaultLeadChoices = normalizeLeadChoices(defaultLeadChoicesBase);
      const searchableLeadChoices = normalizeLeadChoices(searchableLeadChoicesBase);
      const departmentOptions = ['<option value="">No practice department</option>']
        .concat(
          (Array.isArray(state.departments) ? state.departments : [])
            .filter((department) => String(department?.id || "").trim() && String(department?.name || "").trim())
            .slice()
            .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }))
            .map(
              (department) =>
                `<option value="${escapeHtml(String(department?.id || ""))}">${escapeHtml(
                  String(department?.name || "")
                )}</option>`
            )
        )
        .join("");
      const officeOptions = ['<option value="">No office</option>']
        .concat(
          (Array.isArray(state.officeLocations) ? state.officeLocations : [])
            .filter((office) => String(office?.id || "").trim() && String(office?.name || "").trim())
            .slice()
            .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }))
            .map(
              (office) =>
                `<option value="${escapeHtml(String(office?.id || ""))}">${escapeHtml(
                  String(office?.name || "")
                )}</option>`
            )
        )
        .join("");
      const showTeamSection = true;
      const form = document.createElement("form");
      form.className = "project-dialog-form";
      form.innerHTML = `
        <section class="project-dialog-section">
          <div class="project-dialog-core-row" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
            <label class="project-dialog-field">
              <span>Project name</span>
              <input type="text" name="project_name" required />
            </label>
            <label class="project-dialog-field">
              <span>Practice Department</span>
              <select name="project_department_id">${departmentOptions}</select>
            </label>
            <label class="project-dialog-field">
              <span>Office Location</span>
              <select name="project_office_id">${officeOptions}</select>
            </label>
            <label class="project-dialog-field">
              <span>Project Lead</span>
              <div data-project-lead-combobox style="position:relative;display:flex;align-items:center;">
                <input type="text" name="project_lead_search" autocomplete="off" placeholder="Search project lead" aria-autocomplete="list" aria-expanded="false" aria-haspopup="listbox" />
                <button type="button" data-project-lead-toggle aria-label="Show project lead options" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--muted);font-size:12px;cursor:pointer;padding:4px;">▾</button>
                <div data-project-lead-menu role="listbox" hidden style="position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:220px;overflow:auto;z-index:50;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 24px rgba(15,23,42,.12);"></div>
              </div>
              <input type="hidden" name="project_lead_id" value="" />
            </label>
          </div>
          <div class="project-dialog-core-row project-dialog-econ-row" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
            <label class="project-dialog-field">
              <span>Project Type</span>
              <div class="project-planning-contract-type-toggle" role="tablist" aria-label="Contract type">
                <input type="hidden" name="pricing_model" value="fixed_fee" />
                <button
                  type="button"
                  class="project-planning-contract-type-option"
                  data-pricing-model-value="fixed_fee"
                  aria-selected="false"
                >
                  Fixed Fee
                </button>
                <button
                  type="button"
                  class="project-planning-contract-type-option"
                  data-pricing-model-value="time_and_materials"
                  aria-selected="false"
                >
                  Time &amp; Materials
                </button>
              </div>
            </label>
            <label class="project-dialog-field">
              <span>Contract amount/budget</span>
              <input type="text" name="contract_amount" inputmode="decimal" placeholder="25000 or $25,000" />
              <small class="project-dialog-helper" data-contract-amount-helper></small>
            </label>
            <div class="project-dialog-inline-fields">
              <label class="project-dialog-field">
                <span>Target Realization %</span>
                <input type="text" name="target_realization_pct" inputmode="decimal" placeholder="e.g. 72.5" />
              </label>
              <label class="project-dialog-field">
                <span>Overhead %</span>
                <input type="text" name="overhead_percent" inputmode="decimal" placeholder="e.g. 12.5" />
              </label>
              <label class="project-dialog-field">
                <span>Tech/Admin Fee %</span>
                <input type="text" name="tech_admin_fee_pct_override" inputmode="decimal" placeholder="Optional (uses department default when blank)" />
              </label>
            </div>
          </div>
        </section>
        ${
          showTeamSection
            ? `
        <section class="project-dialog-section">
          <div class="project-dialog-team-head">
            <h3 class="panel-subheading">Team</h3>
            <div class="project-dialog-team-add-wrap">
              <button type="button" class="button button-ghost" data-project-team-add-member>+ Add Member</button>
            </div>
          </div>
          <div class="project-dialog-team-grid">
            <div class="project-dialog-team-col">
              <h4>Managers</h4>
              <div data-project-team-list="managers"></div>
            </div>
            <div class="project-dialog-team-col">
              <h4>Staff</h4>
              <div data-project-team-list="staff"></div>
            </div>
          </div>
        </section>
        `
            : ""
        }
        <section class="project-dialog-section">
          <div class="project-dialog-actions" style="justify-content:space-between;align-items:center;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;"></div>
            <div style="display:flex;gap:10px;align-items:center;">
              <button type="button" class="button button-ghost" data-project-cancel>Cancel</button>
              <button type="submit" class="button" data-project-save>${escapeHtml(finalConfirmText)}</button>
              ${
                canOpenPlanningFromDialog
                  ? '<button type="button" class="button button-ghost" data-project-open-planning>Open Project Planner</button>'
                  : ""
              }
            </div>
          </div>
        </section>
        <p class="project-dialog-error" data-project-dialog-error hidden></p>
      `;

      const nameInput = form.querySelector('input[name="project_name"]');
      const contractAmountInput = form.querySelector('input[name="contract_amount"]');
      const contractAmountHelper = form.querySelector("[data-contract-amount-helper]");
      const leadCombobox = form.querySelector("[data-project-lead-combobox]");
      const leadSearchInput = form.querySelector('input[name="project_lead_search"]');
      const leadValueInput = form.querySelector('input[name="project_lead_id"]');
      const leadMenu = form.querySelector("[data-project-lead-menu]");
      const leadToggleButton = form.querySelector("[data-project-lead-toggle]");
      const departmentSelect = form.querySelector('select[name="project_department_id"]');
      const officeSelect = form.querySelector('select[name="project_office_id"]');
      const pricingModelInput = form.querySelector('[name="pricing_model"]');
      const pricingModelToggleButtons = Array.from(
        form.querySelectorAll("[data-pricing-model-value]")
      );
      const overheadPercentInput = form.querySelector('input[name="overhead_percent"]');
      const targetRealizationInput = form.querySelector('input[name="target_realization_pct"]');
      const techAdminFeeOverrideInput = form.querySelector('input[name="tech_admin_fee_pct_override"]');
      const openPlanningButton = form.querySelector("[data-project-open-planning]");
      const projectCancelButton = form.querySelector("[data-project-cancel]");
      const teamManagersList = form.querySelector('[data-project-team-list="managers"]');
      const teamStaffList = form.querySelector('[data-project-team-list="staff"]');
      const addMemberButton = form.querySelector("[data-project-team-add-member]");
      const errorNode = form.querySelector("[data-project-dialog-error]");
      const dialogCard = refs.dialog?.querySelector(".dialog-card");
      const leadChoiceById = new Map(
        searchableLeadChoices
          .concat(defaultLeadChoices)
          .map((item) => [String(item.id || "").trim(), item])
      );
      const leadIdByLabel = new Map();
      const leadIdsByName = new Map();
      searchableLeadChoices.concat(defaultLeadChoices).forEach((item) => {
        const labelKey = String(item?.label || "").trim().toLowerCase();
        const nameKey = String(item?.name || "").trim().toLowerCase();
        const itemId = String(item?.id || "").trim();
        if (labelKey) {
          leadIdByLabel.set(labelKey, itemId);
        }
        if (nameKey) {
          const existing = leadIdsByName.get(nameKey) || [];
          if (itemId || nameKey === "unassigned") {
            leadIdsByName.set(nameKey, existing.concat(itemId));
          }
        }
      });
      const labelForLeadId = (leadId) => {
        const normalizedId = String(leadId || "").trim();
        const direct = leadChoiceById.get(normalizedId);
        if (direct) return direct.label;
        if (!normalizedId) return "Unassigned";
        return String(leadNameById.get(normalizedId) || normalizedId).trim();
      };
      const setLeadSelectionById = (leadId) => {
        const normalizedId = String(leadId || "").trim();
        if (leadValueInput) {
          leadValueInput.value = normalizedId;
        }
        if (leadSearchInput) {
          leadSearchInput.value = labelForLeadId(normalizedId);
        }
      };
      const resolveLeadSelectionFromInput = (strict) => {
        const raw = String(leadSearchInput?.value || "").trim();
        const normalized = raw.toLowerCase();
        if (!raw || normalized === "unassigned") {
          return { valid: true, id: "" };
        }
        if (leadIdByLabel.has(normalized)) {
          return { valid: true, id: String(leadIdByLabel.get(normalized) || "").trim() };
        }
        const byName = leadIdsByName.get(normalized) || [];
        if (byName.length === 1) {
          return { valid: true, id: String(byName[0] || "").trim() };
        }
        if (!strict) {
          return {
            valid: true,
            id: String(leadValueInput?.value || "").trim(),
          };
        }
        return { valid: false, id: "" };
      };
      const onLeadSearchInput = () => {
        const next = resolveLeadSelectionFromInput(false);
        if (next.valid && leadValueInput) {
          leadValueInput.value = next.id;
        }
        openLeadMenu(false);
      };
      const onLeadSearchBlur = () => {
        const next = resolveLeadSelectionFromInput(false);
        if (!next.valid) return;
        setLeadSelectionById(next.id);
      };
      const renderLeadMenu = (showAll) => {
        if (!leadMenu) return;
        const query = showAll ? "" : String(leadSearchInput?.value || "").trim().toLowerCase();
        const source = query ? searchableLeadChoices : defaultLeadChoices;
        const filtered = source.filter((item) => {
          if (!query) return true;
          const label = String(item?.label || "").trim().toLowerCase();
          const name = String(item?.name || "").trim().toLowerCase();
          return label.includes(query) || name.includes(query);
        });
        const selectedId = String(leadValueInput?.value || "").trim();
        if (!filtered.length) {
          leadMenu.innerHTML = '<div style="padding:8px 10px;color:var(--muted);font-size:.86rem;">No matches</div>';
          return;
        }
        const heading = query
          ? '<div style="padding:6px 10px;color:var(--muted);font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">Company matches</div>'
          : '<div style="padding:6px 10px;color:var(--muted);font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">Scoped defaults</div>';
        leadMenu.innerHTML =
          heading +
          filtered
            .map((item) => {
            const itemId = String(item?.id || "").trim();
            const itemLabel = String(item?.label || "").trim();
            const isSelected = itemId === selectedId;
            return `<button type="button" data-project-lead-option-id="${escapeHtml(itemId)}" style="display:block;width:100%;text-align:left;border:0;background:${isSelected ? "rgba(47,111,237,.08)" : "transparent"};padding:8px 10px;cursor:pointer;font:inherit;">${escapeHtml(itemLabel)}</button>`;
            })
            .join("");
      };
      const openLeadMenu = (showAll) => {
        if (!leadMenu) return;
        renderLeadMenu(Boolean(showAll));
        leadMenu.hidden = false;
        if (leadSearchInput) {
          leadSearchInput.setAttribute("aria-expanded", "true");
        }
      };
      const closeLeadMenu = () => {
        if (!leadMenu) return;
        leadMenu.hidden = true;
        if (leadSearchInput) {
          leadSearchInput.setAttribute("aria-expanded", "false");
        }
      };
      const onLeadMenuClick = (event) => {
        const option = event.target.closest("[data-project-lead-option-id]");
        if (!option) return;
        const nextId = String(option.dataset.projectLeadOptionId || "").trim();
        setLeadSelectionById(nextId);
        closeLeadMenu();
        leadSearchInput?.focus();
      };
      const onLeadToggleClick = (event) => {
        event.preventDefault();
        if (!leadMenu) return;
        if (leadMenu.hidden) {
          openLeadMenu(true);
          leadSearchInput?.focus();
        } else {
          closeLeadMenu();
        }
      };
      const onLeadSearchFocus = () => {
        openLeadMenu(true);
      };
      const onLeadComboboxOutsidePointer = (event) => {
        if (!leadCombobox) return;
        if (leadCombobox.contains(event.target)) return;
        closeLeadMenu();
      };
      const projectHasExplicitTechAdminOverride = currentTechAdminFeePctOverride !== null;
      let techAdminFeeTouched = false;
      const onTechAdminFeeInput = () => {
        techAdminFeeTouched = true;
      };
      const setPricingModel = (nextModel) => {
        const normalized =
          String(nextModel || "").trim() === "time_and_materials"
            ? "time_and_materials"
            : "fixed_fee";
        if (pricingModelInput) {
          pricingModelInput.value = normalized;
        }
        if (contractAmountHelper) {
          contractAmountHelper.textContent =
            normalized === "time_and_materials"
              ? "Estimated budget for planning and tracking purposes"
              : "Total contracted amount for the project";
        }
        pricingModelToggleButtons.forEach((button) => {
          const value = String(button?.dataset?.pricingModelValue || "").trim();
          const isActive = value === normalized;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
      };
      const onPricingModelToggleClick = (event) => {
        const button = event.target.closest("[data-pricing-model-value]");
        if (!button) return;
        event.preventDefault();
        const value = String(button.dataset.pricingModelValue || "").trim();
        setPricingModel(value);
      };
      const userDisplayNameById = (userId) =>
        String(getUserById(userId)?.displayName || getUserById(userId)?.username || userId || "").trim();
      const userTitleById = (userId) => {
        const user = getUserById(userId);
        const explicitLevelLabel = String(levelLabel?.(user?.level) || "").trim();
        if (explicitLevelLabel) return explicitLevelLabel;
        const group = String(permissionGroupForUser(user) || "").trim().toLowerCase();
        if (!group) return "";
        return group.charAt(0).toUpperCase() + group.slice(1);
      };
      const renderTeamEditableList = (container, userIds, group) => {
        if (!container) return;
        if (!Array.isArray(userIds) || userIds.length === 0) {
          container.innerHTML = '<p class="project-dialog-team-empty">None</p>';
          return;
        }
        container.innerHTML = `<ul class="project-dialog-team-list">${userIds
          .map((userId) => {
            const label = userDisplayNameById(userId);
            const title = userTitleById(userId);
            return `<li><span class="project-dialog-team-member"><span class="project-dialog-team-member-name">${escapeHtml(
              label
            )}</span>${
              title
                ? `<span class="project-dialog-team-member-title">${escapeHtml(title)}</span>`
                : ""
            }</span><button type="button" class="project-dialog-team-remove" data-project-team-remove="${escapeHtml(
              group
            )}" data-project-team-user-id="${escapeHtml(userId)}" aria-label="Remove ${escapeHtml(
              label
            )}" title="Remove ${escapeHtml(label)}">
              <svg viewBox="0 -960 960 960" aria-hidden="true">
                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" fill="currentColor"/>
              </svg>
            </button></li>`;
          })
          .join("")}</ul>`;
      };
      const renderTeamEditors = () => {
        renderTeamEditableList(teamManagersList, pendingManagerUserIds, "manager");
        renderTeamEditableList(teamStaffList, pendingStaffUserIds, "staff");
      };
      const openTeamPicker = () => {
        const projectNameForTeam = String(nameInput?.value || currentName || options?.projectName || "").trim();
        if (!projectNameForTeam) {
          setError("Enter a project name before editing team assignments.");
          nameInput?.focus();
          return;
        }
        memberModalState.mode = "project-add-member";
        memberModalState.client = String(options?.clientName || state.selectedCatalogClient || "").trim();
        memberModalState.project = projectNameForTeam;
        memberModalState.assigned = [...new Set([...pendingStaffUserIds, ...pendingManagerUserIds])];
        memberModalState.overrides = {};
        memberModalState.searchTerm = "";
        memberModalState.interceptSelection = ({ selectedIds }) => {
          const nextManagers = new Set(pendingManagerUserIds);
          const nextStaff = new Set(pendingStaffUserIds);
          selectedIds.forEach((id) => {
            const normalizedId = String(id || "").trim();
            if (!normalizedId) return;
            const user = getUserById(normalizedId);
            if (isManager(user)) {
              nextManagers.add(normalizedId);
              nextStaff.delete(normalizedId);
              return;
            }
            if (!nextManagers.has(normalizedId)) {
              nextStaff.add(normalizedId);
            }
          });
          pendingManagerUserIds = Array.from(nextManagers).filter(Boolean);
          pendingStaffUserIds = Array.from(nextStaff).filter(
            (id) => id && !nextManagers.has(id)
          );
          renderTeamEditors();
        };
        openMembersModal();
      };
      const onTeamListClick = (event) => {
        const removeButton = event.target.closest("[data-project-team-remove]");
        if (!removeButton) return;
        const userId = String(removeButton.dataset.projectTeamUserId || "").trim();
        if (!userId) return;
        pendingManagerUserIds = pendingManagerUserIds.filter((id) => id !== userId);
        pendingStaffUserIds = pendingStaffUserIds.filter((id) => id !== userId);
        renderTeamEditors();
      };
      const onAddMemberClick = () => openTeamPicker();
      const resolveTargetRealizationForSelection = () => {
        const selectedOfficeId = String(officeSelect?.value || "").trim();
        const selectedDepartmentId = String(departmentSelect?.value || "").trim();
        if (!selectedOfficeId || !selectedDepartmentId) return null;
        const match = (state.targetRealizations || []).find(
          (item) =>
            String(item?.officeId || item?.office_id || "").trim() === selectedOfficeId &&
            String(item?.departmentId || item?.department_id || "").trim() === selectedDepartmentId
        );
        const raw = match?.targetRealizationPct ?? match?.target_realization_pct;
        if (raw === null || raw === undefined || `${raw}`.trim() === "") return null;
        return Number.isFinite(Number(raw)) ? Number(raw) : null;
      };
      const resolveTechAdminFeeDefaultForSelection = () => {
        const selectedDepartmentId = String(departmentSelect?.value || "").trim();
        if (!selectedDepartmentId) return null;
        const match = (state.departments || []).find(
          (item) => String(item?.id || "").trim() === selectedDepartmentId
        );
        const raw = match?.techAdminFeePct ?? match?.tech_admin_fee_pct;
        if (raw === null || raw === undefined || `${raw}`.trim() === "") return null;
        return Number.isFinite(Number(raw)) ? Number(raw) : null;
      };
      const syncTargetRealizationDefault = () => {
        if (!targetRealizationInput) return;
        const resolved = resolveTargetRealizationForSelection();
        targetRealizationInput.value = resolved === null ? "" : String(resolved);
      };
      const syncTechAdminFeeOverrideDefault = () => {
        if (!techAdminFeeOverrideInput) return;
        const resolved = resolveTechAdminFeeDefaultForSelection();
        if (!projectHasExplicitTechAdminOverride && !techAdminFeeTouched) {
          techAdminFeeOverrideInput.value = resolved === null ? "" : String(resolved);
        }
        techAdminFeeOverrideInput.placeholder = "Override % (optional)";
      };
      if (nameInput) {
        nameInput.value = currentName;
      }
      if (contractAmountInput) {
        contractAmountInput.value =
          currentContractAmount !== null ? String(currentContractAmount) : "";
      }
      setPricingModel(currentPricingModel);
      renderTeamEditors();
      addMemberButton?.addEventListener("click", onAddMemberClick);
      teamManagersList?.addEventListener("click", onTeamListClick);
      teamStaffList?.addEventListener("click", onTeamListClick);
      pricingModelToggleButtons.forEach((button) =>
        button.addEventListener("click", onPricingModelToggleClick)
      );
      if (overheadPercentInput) {
        overheadPercentInput.value =
          currentOverheadPercent !== null ? String(currentOverheadPercent) : "";
      }
      if (targetRealizationInput) {
        const seedTarget = currentTargetRealizationPct !== null ? currentTargetRealizationPct : defaultTargetRealizationPct;
        targetRealizationInput.value = seedTarget !== null ? String(seedTarget) : "";
      }
      if (techAdminFeeOverrideInput) {
        techAdminFeeOverrideInput.value =
          currentTechAdminFeePctOverride !== null ? String(currentTechAdminFeePctOverride) : "";
      }
      setLeadSelectionById(currentLeadId);
      if (departmentSelect) {
        departmentSelect.value = currentProjectDepartmentId;
      }
      if (officeSelect) {
        officeSelect.value = currentProjectOfficeId;
      }
      departmentSelect?.addEventListener("change", syncTargetRealizationDefault);
      officeSelect?.addEventListener("change", syncTargetRealizationDefault);
      departmentSelect?.addEventListener("change", syncTechAdminFeeOverrideDefault);
      techAdminFeeOverrideInput?.addEventListener("input", onTechAdminFeeInput);
      leadSearchInput?.addEventListener("input", onLeadSearchInput);
      leadSearchInput?.addEventListener("change", onLeadSearchInput);
      leadSearchInput?.addEventListener("focus", onLeadSearchFocus);
      leadSearchInput?.addEventListener("blur", onLeadSearchBlur);
      leadMenu?.addEventListener("click", onLeadMenuClick);
      leadToggleButton?.addEventListener("click", onLeadToggleClick);
      document.addEventListener("mousedown", onLeadComboboxOutsidePointer);
      syncTechAdminFeeOverrideDefault();

      refs.dialogTitle.textContent = title;
      refs.dialogMessage.textContent = "";
      refs.dialogMessage.hidden = true;
      refs.dialogInputRow.hidden = false;
      refs.dialogInput.hidden = true;
      if (refs.dialogTextarea) {
        refs.dialogTextarea.hidden = true;
      }
      const preservedDialogInputNodes = Array.from(refs.dialogInputRow.childNodes || []);
      refs.dialogInputRow.replaceChildren(form);
      dialogCard?.classList.add("dialog-card--project");
      refs.dialog.hidden = false;
      refs.dialogConfirm.hidden = true;
      refs.dialogCancel.hidden = true;

      const setError = (message) => {
        if (!errorNode) return;
        errorNode.textContent = message || "";
        errorNode.hidden = !message;
      };

      const cleanup = () => {
        refs.dialog.hidden = true;
        form.removeEventListener("submit", onSubmit);
        departmentSelect?.removeEventListener("change", syncTargetRealizationDefault);
        officeSelect?.removeEventListener("change", syncTargetRealizationDefault);
        departmentSelect?.removeEventListener("change", syncTechAdminFeeOverrideDefault);
        techAdminFeeOverrideInput?.removeEventListener("input", onTechAdminFeeInput);
        leadSearchInput?.removeEventListener("input", onLeadSearchInput);
        leadSearchInput?.removeEventListener("change", onLeadSearchInput);
        leadSearchInput?.removeEventListener("focus", onLeadSearchFocus);
        leadSearchInput?.removeEventListener("blur", onLeadSearchBlur);
        leadMenu?.removeEventListener("click", onLeadMenuClick);
        leadToggleButton?.removeEventListener("click", onLeadToggleClick);
        document.removeEventListener("mousedown", onLeadComboboxOutsidePointer);
        pricingModelToggleButtons.forEach((button) =>
          button.removeEventListener("click", onPricingModelToggleClick)
        );
        addMemberButton?.removeEventListener("click", onAddMemberClick);
        teamManagersList?.removeEventListener("click", onTeamListClick);
        teamStaffList?.removeEventListener("click", onTeamListClick);
        if (memberModalState.interceptSelection) {
          memberModalState.interceptSelection = null;
        }
        openPlanningButton?.removeEventListener("click", onOpenProjectPlanning);
        projectCancelButton?.removeEventListener("click", onCancel);
        form.remove();
        dialogCard?.classList.remove("dialog-card--project");
        refs.dialogInputRow.replaceChildren(...preservedDialogInputNodes);
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        refs.dialogInput.hidden = false;
        refs.dialogMessage.textContent = "";
      };

      const buildProjectDialogPayload = () => {
        const nextName = String(nameInput?.value || "").trim();
        if (!nextName) {
          setError("Project name cannot be empty.");
          nameInput?.focus();
          return null;
        }
        const parsedContractAmount = parseProjectBudgetAmount(contractAmountInput?.value || "");
        if (!parsedContractAmount.ok) {
          setError("Contract amount must be a non-negative number.");
          contractAmountInput?.focus();
          return null;
        }
        const parsedOverheadPercent = parseProjectBudgetAmount(overheadPercentInput?.value || "");
        if (!parsedOverheadPercent.ok) {
          setError("Overhead % must be a non-negative number.");
          overheadPercentInput?.focus();
          return null;
        }
        const parsedTargetRealization = parseProjectBudgetAmount(targetRealizationInput?.value || "");
        if (!parsedTargetRealization.ok) {
          setError("Target realization % must be a non-negative number.");
          targetRealizationInput?.focus();
          return null;
        }
        const parsedTechAdminFeeOverride = parseProjectBudgetAmount(techAdminFeeOverrideInput?.value || "");
        if (!parsedTechAdminFeeOverride.ok) {
          setError("Tech/Admin fee override % must be a non-negative number.");
          techAdminFeeOverrideInput?.focus();
          return null;
        }
        const resolvedLead = resolveLeadSelectionFromInput(true);
        if (!resolvedLead.valid) {
          setError("Select a valid project lead from the list.");
          leadSearchInput?.focus();
          leadSearchInput?.select();
          return null;
        }
        if (leadValueInput) {
          leadValueInput.value = resolvedLead.id;
        }
        setLeadSelectionById(resolvedLead.id);
        return {
          projectName: nextName,
          budgetAmount: currentBudget,
          contractAmount: parsedContractAmount.value,
          pricingModel:
            String(pricingModelInput?.value || "fixed_fee").trim() === "time_and_materials"
              ? "time_and_materials"
              : "fixed_fee",
          overheadPercent: parsedOverheadPercent.value,
          targetRealizationPct: parsedTargetRealization.value,
          techAdminFeePctOverride:
            !projectHasExplicitTechAdminOverride && !techAdminFeeTouched
              ? null
              : parsedTechAdminFeeOverride.value,
          managerUserIds: [...pendingManagerUserIds],
          staffUserIds: [...pendingStaffUserIds],
          projectLeadId: String(leadValueInput?.value || "").trim() || null,
          projectDepartmentId: String(departmentSelect?.value || "").trim() || null,
          projectOfficeId: String(officeSelect?.value || "").trim() || null,
        };
      };

      const finalize = () => {
        const payload = buildProjectDialogPayload();
        if (!payload) return;
        const clientNameForValidation = String(
          options?.clientName || state.selectedCatalogClient || ""
        ).trim();
        if (clientNameForValidation) {
          const normalizedNextName = String(payload.projectName || "").trim().toLowerCase();
          const duplicateProject = (state.projects || []).find((item) => {
            if (!item) return false;
            const itemClient = String(item.client || "").trim();
            if (itemClient !== clientNameForValidation) return false;
            const itemName = String(item.name || item.project || "").trim().toLowerCase();
            if (itemName !== normalizedNextName) return false;
            if (isProjectEditDialog) {
              const itemId = String(item.id || "").trim();
              if (currentProjectId && itemId && itemId === currentProjectId) return false;
              if (!currentProjectId && itemName === String(currentName || "").trim().toLowerCase()) return false;
            }
            return true;
          });
          if (duplicateProject) {
            setError("That project already exists for this client.");
            nameInput?.focus();
            nameInput?.select();
            return;
          }
        }
        if (isProjectEditDialog) {
          cleanup();
          resolve(payload);
          return;
        }
        cleanup();
        resolve({
          projectName: payload.projectName,
          budgetAmount: payload.budgetAmount,
          contractAmount: payload.contractAmount,
          pricingModel: payload.pricingModel,
          overheadPercent: payload.overheadPercent,
          targetRealizationPct: payload.targetRealizationPct,
          techAdminFeePctOverride: payload.techAdminFeePctOverride,
          managerUserIds: payload.managerUserIds,
          staffUserIds: payload.staffUserIds,
          projectLeadId: payload.projectLeadId,
          projectDepartmentId: payload.projectDepartmentId,
          projectOfficeId: payload.projectOfficeId,
        });
      };

      const onOpenProjectPlanning = async (event) => {
        if (!canOpenPlanningFromDialog) {
          setError("Access denied.");
          return;
        }
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
        const projectIdForPlanning = currentProjectId;
        if (!projectIdForPlanning) {
          setError("Save project first to open Project Planning.");
          return;
        }
        const payload = buildProjectDialogPayload();
        if (!payload) return;
        setError("");
        const originalButtonText = openPlanningButton?.textContent || "Open Project Planner";
        if (openPlanningButton) {
          openPlanningButton.disabled = true;
          openPlanningButton.textContent = "Saving...";
        }
        try {
          await mutatePersistentState(
            "update_project",
            {
              clientName: String(options?.clientName || "").trim(),
              projectName: String(options?.projectName || "").trim(),
              nextName: payload.projectName,
              contractAmount: payload.contractAmount,
              pricingModel: payload.pricingModel,
              overheadPercent: payload.overheadPercent,
              targetRealizationPct: payload.targetRealizationPct,
              techAdminFeePctOverride: payload.techAdminFeePctOverride,
              project_lead_id: payload.projectLeadId,
              project_department_id: payload.projectDepartmentId,
              office_id: payload.projectOfficeId,
            },
            { skipHydrate: true, refreshState: false, returnState: false }
          );
          await persistProjectTeamAssignments({
            clientName: String(options?.clientName || "").trim(),
            projectName: payload.projectName,
            initialManagerUserIds: initialManagerUserIds,
            initialStaffUserIds: initialStaffUserIds,
            nextManagerUserIds: payload.managerUserIds,
            nextStaffUserIds: payload.staffUserIds,
          });
        } catch (error) {
          setError(error?.message || "Unable to update project.");
          if (openPlanningButton) {
            openPlanningButton.disabled = false;
            openPlanningButton.textContent = originalButtonText;
          }
          return;
        }
        const originalClientName = String(options?.clientName || "").trim();
        const originalProjectName = String(options?.projectName || "").trim();
        const nextProjectName = String(payload.projectName || "").trim();
        if (originalClientName && originalProjectName && nextProjectName) {
          if (state.filters.client === originalClientName && state.filters.project === originalProjectName) {
            state.filters.project = nextProjectName;
          }
          state.projects = (state.projects || []).map((item) => {
            if (!item) return item;
            const itemClient = String(item.client || "").trim();
            const itemName = String(item.name || "").trim().toLowerCase();
            if (itemClient !== originalClientName || itemName !== originalProjectName.toLowerCase()) {
              return item;
            }
            const nextLeadId = payload.projectLeadId || null;
            const nextLeadName = nextLeadId ? leadNameById.get(nextLeadId) || "" : "";
            return {
              ...item,
              name: nextProjectName,
              project: nextProjectName,
              contractAmount: payload.contractAmount,
              contract_amount: payload.contractAmount,
              pricingModel: payload.pricingModel,
              pricing_model: payload.pricingModel,
              overheadPercent: payload.overheadPercent,
              overhead_percent: payload.overheadPercent,
              targetRealizationPct: payload.targetRealizationPct,
              target_realization_pct: payload.targetRealizationPct,
              techAdminFeePctOverride: payload.techAdminFeePctOverride,
              tech_admin_fee_pct_override: payload.techAdminFeePctOverride,
              projectLeadId: nextLeadId,
              project_lead_id: nextLeadId,
              projectLeadName: nextLeadName,
              projectDepartmentId: payload.projectDepartmentId,
              project_department_id: payload.projectDepartmentId,
              officeId: payload.projectOfficeId,
              office_id: payload.projectOfficeId,
            };
          });
          if (state.catalog?.[originalClientName]) {
            state.catalog[originalClientName] = state.catalog[originalClientName].map((name) =>
              String(name || "").trim().toLowerCase() === originalProjectName.toLowerCase()
                ? nextProjectName
                : name
            );
          }
        }
        state.currentProjectPlanningId = projectIdForPlanning;
        persistProjectPlanningId(projectIdForPlanning);
        cleanup();
        resolve({
          openProjectPlanning: true,
          projectId: projectIdForPlanning,
        });
        setView("project_planning");
        feedback("Project updated.", false);
        loadPersistentStateInBackground();
      };
      openPlanningButton?.addEventListener("click", onOpenProjectPlanning);

      const onSubmit = (event) => {
        event.preventDefault();
        finalize();
      };
      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      projectCancelButton?.addEventListener("click", onCancel);
      form.addEventListener("submit", onSubmit);
      nameInput?.focus();
      nameInput?.select();
    });
  }

  async function openAddProjectDialog() {
    await ensureProjectEditorMetadataLoaded();
    const canCreateProject = canManageProjectsLifecycle();
    if (!canCreateProject) {
      feedback("Access denied.", true);
      return;
    }

    const selectedClientRow = (state.clients || []).find(
      (client) => client.name === state.selectedCatalogClient
    );
    if (!isClientActive(selectedClientRow)) {
      feedback("Select an active client before adding a project.", true);
      return;
    }

    const projectDialog = await openProjectDialog({
      mode: "add",
      projectName: "",
      budgetAmount: null,
      contractAmount: null,
      pricingModel: "fixed_fee",
      overheadPercent: null,
      managerUserIds: [],
      staffUserIds: [],
      projectLeadId: null,
      clientOfficeId: String(selectedClientRow?.officeId || selectedClientRow?.office_id || "").trim() || null,
    });
    if (!projectDialog) {
      return;
    }

    const filterUserField = field(refs.filterForm, "user");
    const filterClientField = field(refs.filterForm, "client");
    const filterProjectField = field(refs.filterForm, "project");
    try {
      await mutatePersistentState("add_project", {
        clientName: state.selectedCatalogClient,
        projectName: projectDialog.projectName,
        budgetAmount: projectDialog.budgetAmount,
        contractAmount: projectDialog.contractAmount,
        pricingModel: projectDialog.pricingModel,
        overheadPercent: projectDialog.overheadPercent,
        targetRealizationPct: projectDialog.targetRealizationPct,
        techAdminFeePctOverride: projectDialog.techAdminFeePctOverride,
        project_lead_id: projectDialog.projectLeadId,
        project_department_id: projectDialog.projectDepartmentId,
        office_id: projectDialog.projectOfficeId,
      });
      await persistProjectTeamAssignments({
        clientName: state.selectedCatalogClient,
        projectName: projectDialog.projectName,
        initialManagerUserIds: [],
        initialStaffUserIds: [],
        nextManagerUserIds: projectDialog.managerUserIds,
        nextStaffUserIds: projectDialog.staffUserIds,
      });
    } catch (error) {
      feedback(error.message || "Unable to add project.", true);
      return;
    }

    syncFilterCatalogsUI({
      user: filterUserField?.value || "",
      client: filterClientField?.value || "",
      project: filterProjectField?.value || "",
    });
    feedback("Project added.", false);
    render();
    loadPersistentStateInBackground();
  }

  function setupAddProjectHeaderAction() {
    const projectsColumn =
      refs.projectColumnLabel?.closest(".catalog-column") || refs.projectList?.closest(".catalog-column");
    const header = projectsColumn?.querySelector(".catalog-column-head");
    if (!header) return;
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";
    header.style.flexWrap = "nowrap";

    if (!addProjectHeaderButton) {
      addProjectHeaderButton = document.createElement("button");
      addProjectHeaderButton.type = "button";
      addProjectHeaderButton.id = "add-project-header-button";
      addProjectHeaderButton.className = "button button-ghost";
      addProjectHeaderButton.textContent = "Add Project";
      addProjectHeaderButton.style.marginLeft = "0";
      addProjectHeaderButton.addEventListener("click", function () {
        openAddProjectDialog();
      });
    }

    if (!projectLifecycleToggleWrap) {
      projectLifecycleToggleWrap = document.createElement("div");
      projectLifecycleToggleWrap.className = "catalog-lifecycle-toggle";
      projectLifecycleToggleWrap.style.marginLeft = "auto";
      projectLifecycleToggleActive = document.createElement("button");
      projectLifecycleToggleActive.type = "button";
      projectLifecycleToggleActive.textContent = "Active";
      projectLifecycleToggleActive.addEventListener("click", function () {
        state.catalogProjectLifecycleView = "active";
        syncProjectLifecycleToggleUi();
        renderCatalogAside();
        syncProjectCardsUx();
      });
      projectLifecycleToggleInactive = document.createElement("button");
      projectLifecycleToggleInactive.type = "button";
      projectLifecycleToggleInactive.textContent = "Inactive";
      projectLifecycleToggleInactive.addEventListener("click", function () {
        state.catalogProjectLifecycleView = "inactive";
        syncProjectLifecycleToggleUi();
        renderCatalogAside();
        syncProjectCardsUx();
      });
      projectLifecycleToggleWrap.appendChild(projectLifecycleToggleActive);
      projectLifecycleToggleWrap.appendChild(projectLifecycleToggleInactive);
    }

    if (!addProjectHeaderButton.isConnected) {
      header.appendChild(addProjectHeaderButton);
    }
    if (!projectLifecycleToggleWrap.isConnected) {
      header.appendChild(projectLifecycleToggleWrap);
    }
    syncProjectLifecycleToggleUi();
    if (refs.addProjectForm && refs.addProjectForm.isConnected) {
      refs.addProjectForm.remove();
    }
  }

  function syncProjectCardsUx() {
    function dedupeOfficeLines(copy) {
      if (!copy) return;
      copy
        .querySelectorAll("[data-client-office-line], [data-project-office-line]")
        .forEach((node) => node.remove());
      const officeLines = Array.from(copy.querySelectorAll("small")).filter((node) =>
        /^office\s*:/i.test(String(node.textContent || "").trim())
      );
      officeLines.slice(1).forEach((node) => node.remove());
    }

    function upsertMetaLine(copy, selector, attrName, text, beforeNode) {
      const existing = copy.querySelector(selector);
      if (!text) {
        existing?.remove();
        return;
      }
      if (existing) {
        existing.textContent = text;
        if (beforeNode && existing !== beforeNode.previousElementSibling) {
          copy.insertBefore(existing, beforeNode);
        }
        return;
      }
      const node = document.createElement("small");
      node.setAttribute(attrName, "1");
      node.textContent = text;
      if (beforeNode) {
        copy.insertBefore(node, beforeNode);
      } else {
        copy.appendChild(node);
      }
    }

    if (!refs.projectList) return;
    refs.projectList
      .querySelectorAll("[data-add-member], [data-remove-member]")
      .forEach((button) => button.remove());
    refs.projectList.querySelectorAll(".catalog-item.catalog-item-project").forEach((card) => {
      const projectName = String(card.getAttribute("data-project") || "").trim();
      if (!projectName || !state.selectedCatalogClient) return;
      const copy = card.querySelector(".catalog-item-copy");
      if (!copy) return;
      dedupeOfficeLines(copy);
    });
    if (!refs.clientList) return;
    refs.clientList.querySelectorAll(".catalog-item[data-client]").forEach((card) => {
      const clientName = String(card.getAttribute("data-client") || "").trim();
      if (!clientName) return;
      const client = (state.clients || []).find(
        (item) => item && String(item.name || "").trim() === clientName
      );
      const leadName = String(
        client?.clientLeadName ||
          getUserById(client?.clientLeadId || client?.client_lead_id || "")?.displayName ||
          ""
      ).trim();
      const copy = card.querySelector(".catalog-item-copy");
      if (!copy) return;
      dedupeOfficeLines(copy);
      const existing = copy.querySelector("[data-client-lead-line]");
      if (existing) {
        existing.textContent = `Client Lead: ${leadName || "—"}`;
      } else {
        const node = document.createElement("small");
        node.setAttribute("data-client-lead-line", "1");
        node.textContent = `Client Lead: ${leadName || "—"}`;
        copy.appendChild(node);
      }
    });
  }

  function removeMembersAddCard() {
    if (refs.addUserForm && refs.addUserForm.isConnected) {
      refs.addUserForm.remove();
    }
    refs.addUserForm = null;
  }

  function ensureMemberEditorModal() {
    if (memberEditorModal) return;
    if (!document.getElementById("member-editor-modal-style")) {
      const style = document.createElement("style");
      style.id = "member-editor-modal-style";
      style.textContent = `
        #member-editor-modal .panel-modal{
          width:min(760px, calc(100vw - 32px));
          max-height:min(88vh, 860px);
          display:flex;
          flex-direction:column;
        }
        #member-editor-modal .panel-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:10px;
        }
        #member-editor-modal .member-editor-head-cancel{
          margin-left:12px;
          flex:0 0 auto;
        }
        #member-editor-modal .member-editor-form{
          display:grid;
          gap:10px;
          min-height:0;
        }
        #member-editor-modal .member-editor-status{
          margin:0;
          padding:8px 10px;
          border-radius:8px;
          border:1px solid color-mix(in srgb, var(--line) 75%, transparent);
          background:color-mix(in srgb, var(--panel) 85%, white);
          color:var(--ink);
          font-size:.86rem;
          line-height:1.35;
        }
        #member-editor-modal .member-editor-status[data-error="true"]{
          border-color:color-mix(in srgb, #d34d4d 35%, var(--line));
          background:color-mix(in srgb, #d34d4d 12%, var(--panel));
          color:color-mix(in srgb, #8f2525 82%, var(--ink));
        }
        #member-editor-modal .member-editor-row{
          display:grid;
          grid-template-columns:repeat(3, minmax(0, 1fr));
          gap:10px 12px;
          align-items:end;
        }
        #member-editor-modal .member-editor-row label{
          margin:0;
          display:grid;
          gap:4px;
        }
        #member-editor-modal .member-editor-row label span{
          font-family:var(--font-head);
          font-size:.72rem;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--muted);
        }
        #member-editor-modal [data-member-editor-password-row] span{
          display:none;
        }
        #member-editor-modal .member-editor-footer{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:10px;
          padding-top:6px;
        }
        #member-editor-modal .member-editor-footer-left{
          display:flex;
          align-items:flex-end;
          gap:10px;
          flex:1 1 auto;
          min-width:0;
        }
        #member-editor-modal .member-editor-footer-left label{
          margin:0;
          display:grid;
          gap:4px;
          min-width:220px;
          max-width:360px;
        }
        #member-editor-modal .member-editor-footer-left label span{
          font-family:var(--font-head);
          font-size:.72rem;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--muted);
        }
        #member-editor-modal .member-editor-textarea label{
          margin:0;
          display:grid;
          gap:4px;
        }
        #member-editor-modal .member-editor-textarea label span{
          font-family:var(--font-head);
          font-size:.72rem;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--muted);
        }
        #member-editor-modal .member-editor-textarea textarea{
          min-height:84px;
          resize:vertical;
        }
        @media (max-width: 700px){
          #member-editor-modal .member-editor-row{
            grid-template-columns:1fr;
          }
          #member-editor-modal .member-editor-footer{
            flex-direction:column;
            align-items:stretch;
          }
          #member-editor-modal .member-editor-footer-left{
            flex-direction:column;
            align-items:stretch;
          }
          #member-editor-modal .member-editor-footer-left label{
            min-width:0;
            max-width:none;
          }
        }
      `;
      document.head.appendChild(style);
    }
    memberEditorModal = document.createElement("div");
    memberEditorModal.className = "modal-backdrop";
    memberEditorModal.id = "member-editor-modal";
    memberEditorModal.hidden = true;
    memberEditorModal.setAttribute("aria-hidden", "true");
    memberEditorModal.innerHTML = `
      <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="member-editor-title">
        <section class="panel panel-modal">
          <div class="panel-head">
            <div>
              <h2 id="member-editor-title">Member</h2>
            </div>
            <button class="button button-ghost member-editor-head-cancel" type="button" data-member-editor-cancel>Cancel</button>
          </div>
          <form class="member-editor-form" data-member-editor-form>
            <p class="member-editor-status" data-member-editor-status hidden></p>
            <div class="member-editor-row" data-member-editor-section="identity">
              <label><span>Member name</span><input type="text" name="display_name" required /></label>
              <label><span>User ID</span><input type="text" name="username" required /></label>
              <label><span>Employee ID</span><input type="text" name="employee_id" /></label>
            </div>
            <div class="member-editor-row" data-member-editor-section="org">
              <label><span>Title</span><select name="level"></select></label>
              <label><span>Department</span><select name="department_id"><option value="">No department</option></select></label>
              <label><span>Office</span><select name="office_id" required><option value="">Select office</option></select></label>
              <label><span>Start date</span><input type="date" name="active_from" /></label>
            </div>
            <div class="member-editor-row" data-member-editor-section="rates">
              <label><span>Base rate</span><input type="number" step="0.01" min="0" name="base_rate" /></label>
              <label><span>Cost rate</span><input type="number" step="0.01" min="0" name="cost_rate" /></label>
              <label><span>Email</span><input type="email" name="email" required /></label>
              <label>
                <span>FLSA status</span>
                <select name="is_exempt">
                  <option value="false">Non-exempt</option>
                  <option value="true">Exempt</option>
                </select>
              </label>
            </div>
            <div class="member-editor-textarea" data-member-editor-section="profile">
              <label>
                <span>Member Profile</span>
                <textarea name="member_profile" placeholder="Enter member profile"></textarea>
              </label>
            </div>
            <div class="member-editor-footer">
              <div class="member-editor-footer-left" data-member-editor-section="certifications">
                <label>
                  <span>Certifications</span>
                  <input type="text" name="certifications" placeholder="Enter certifications" />
                </label>
              </div>
              <button class="button button-ghost" type="button" data-member-editor-reset hidden>Reset password</button>
              <button class="button" type="submit" data-member-editor-submit>Add member</button>
            </div>
          </form>
        </section>
      </div>
    `;
    document.body.appendChild(memberEditorModal);
    memberEditorForm = memberEditorModal.querySelector("[data-member-editor-form]");
    memberEditorTitle = memberEditorModal.querySelector("#member-editor-title");
    memberEditorStatus = memberEditorModal.querySelector("[data-member-editor-status]");
    memberEditorSubmit = memberEditorModal.querySelector("[data-member-editor-submit]");
    memberEditorReset = memberEditorModal.querySelector("[data-member-editor-reset]");
    memberEditorModal.addEventListener("click", function (event) {
      if (event.target === memberEditorModal || event.target.closest("[data-member-editor-cancel]")) {
        closeMemberEditorModal();
      }
    });
    memberEditorForm.addEventListener("submit", submitMemberEditorModal);
    if (memberEditorReset) {
      memberEditorReset.addEventListener("click", async function () {
        if (memberEditorMode !== "edit" || !memberEditorUserId) {
          return;
        }
        if (!state.permissions?.reset_user_password) {
          feedback("Access denied.", true);
          return;
        }
        const targetUser = (state.users || []).find((u) => u.id === memberEditorUserId);
        if (!targetUser) {
          feedback("Team member not found.", true);
          return;
        }
        try {
          await mutatePersistentState(
            "send_user_setup_link",
            { userId: targetUser.id },
            { skipHydrate: true, returnState: false, skipSettingsMetadataReload: true }
          );
          feedback(`Password reset link sent to ${targetUser.displayName}.`, false);
        } catch (error) {
          feedback(error.message || "Unable to send reset link.", true);
        }
      });
    }
  }

  function closeMemberEditorModal() {
    if (!memberEditorModal) return;
    setMemberEditorStatus("", false);
    memberEditorModal.hidden = true;
    memberEditorModal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    memberEditorScope = "full";
  }

  function setMemberEditorStatus(message, isError) {
    if (!memberEditorStatus) return;
    const text = String(message || "").trim();
    memberEditorStatus.textContent = text;
    memberEditorStatus.dataset.error = isError ? "true" : "false";
    memberEditorStatus.hidden = text.length === 0;
  }

  function openMemberEditorModal(mode, userId, focusFieldName, options) {
    ensureMemberEditorModal();
    const canCreate = Boolean(state.permissions?.create_user);
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditBaseRates = Boolean(state.permissions?.edit_user_rates);
    const canEditCostRates = Boolean(
      state.permissions?.edit_cost_rates ||
      state.permissions?.view_cost_rates ||
      state.permissions?.view_cost_rate
    );
    const requestedScope = String(options?.scope || "").trim().toLowerCase();
    const isSelfProfileMode = mode === "edit" && requestedScope === "self_profile";
    memberEditorScope = isSelfProfileMode ? "self_profile" : "full";
    if (mode === "create" && !canCreate) {
      feedback("Access denied.", true);
      return;
    }
    if (!isSelfProfileMode && mode === "edit" && !canEditProfile && !canEditBaseRates && !canEditCostRates) {
      feedback("Access denied.", true);
      return;
    }

    memberEditorMode = mode;
    memberEditorUserId = userId || "";
    if (isSelfProfileMode) {
      const currentUserId = `${state.currentUser?.id || ""}`.trim();
      if (!currentUserId || currentUserId !== `${memberEditorUserId || ""}`.trim()) {
        feedback("Access denied.", true);
        return;
      }
    }
    const user = mode === "edit" ? state.users.find((u) => u.id === memberEditorUserId) : null;
    if (mode === "edit" && !user) {
      feedback("Team member not found.", true);
      return;
    }
    setMemberEditorStatus("", false);
    const targetRoleAllowed =
      mode !== "edit" ||
      typeof canViewUserByRole !== "function" ||
      canViewUserByRole(state.currentUser, user);

    const levelField = field(memberEditorForm, "level");
    const deptField = field(memberEditorForm, "department_id");
    const officeField = field(memberEditorForm, "office_id");
    const sortedLevelEntries = Object.entries(state.levelLabels || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
    levelField.innerHTML = sortedLevelEntries
      .map(([lvl, info]) => `<option value="${escapeHtml(String(lvl))}">${escapeHtml(info?.label || `Level ${lvl}`)}</option>`)
      .join("");
    deptField.innerHTML = ['<option value="">No department</option>']
      .concat((state.departments || []).map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`))
      .join("");
    officeField.innerHTML = ['<option value="">Select office</option>']
      .concat((state.officeLocations || []).map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`))
      .join("");

    field(memberEditorForm, "display_name").value = user?.displayName || "";
    field(memberEditorForm, "username").value = user?.username || "";
    field(memberEditorForm, "email").value = user?.email || "";
    field(memberEditorForm, "employee_id").value = user?.employeeId || "";
    const passwordInput = field(memberEditorForm, "password");
    if (passwordInput) {
      passwordInput.value = "";
    }
    field(memberEditorForm, "level").value = String(user?.level || sortedLevelEntries[0]?.[0] || "1");
    field(memberEditorForm, "department_id").value = user?.departmentId || "";
    field(memberEditorForm, "office_id").value = user?.officeId || "";
    const activeFromField = field(memberEditorForm, "active_from");
    const activeFromSeed =
      normalizeIsoDateValue(user?.activeFrom || user?.active_from || "") || new Date().toISOString().slice(0, 10);
    bindCustomDateInput(activeFromField, activeFromSeed);
    field(memberEditorForm, "base_rate").value = user?.baseRate ?? "";
    field(memberEditorForm, "cost_rate").value = user?.costRate ?? "";
    field(memberEditorForm, "is_exempt").value = user?.isExempt === true ? "true" : "false";
    field(memberEditorForm, "certifications").value = user?.certifications || "";
    field(memberEditorForm, "member_profile").value = user?.memberProfile || "";

    const profileEditable = mode === "create" ? canCreate : (isSelfProfileMode ? true : canEditProfile);
    ["display_name", "username", "email", "employee_id", "level", "department_id", "office_id", "active_from", "is_exempt", "certifications", "member_profile"].forEach((name) => {
      const el = field(memberEditorForm, name);
      if (el) el.disabled = !profileEditable;
    });
    const baseRateField = field(memberEditorForm, "base_rate");
    if (baseRateField) {
      baseRateField.disabled = isSelfProfileMode ? true : !canEditBaseRates || !targetRoleAllowed;
    }
    const costRateField = field(memberEditorForm, "cost_rate");
    if (costRateField) {
      costRateField.disabled = isSelfProfileMode ? true : !canEditCostRates || !targetRoleAllowed;
    }

    memberEditorTitle.textContent = mode === "create" ? "Add member" : (isSelfProfileMode ? "Edit profile" : "Edit member");
    memberEditorSubmit.textContent = mode === "create" ? "Add member" : (isSelfProfileMode ? "Save profile" : "Save changes");
    memberEditorSubmit.disabled = false;
    const identitySection = memberEditorForm.querySelector('[data-member-editor-section="identity"]');
    const orgSection = memberEditorForm.querySelector('[data-member-editor-section="org"]');
    const ratesSection = memberEditorForm.querySelector('[data-member-editor-section="rates"]');
    const profileSection = memberEditorForm.querySelector('[data-member-editor-section="profile"]');
    const certificationsSection = memberEditorForm.querySelector('[data-member-editor-section="certifications"]');
    if (identitySection) identitySection.hidden = isSelfProfileMode;
    if (orgSection) orgSection.hidden = isSelfProfileMode;
    if (ratesSection) ratesSection.hidden = isSelfProfileMode;
    if (profileSection) profileSection.hidden = false;
    if (certificationsSection) certificationsSection.hidden = false;
    if (memberEditorReset) {
      memberEditorReset.hidden = isSelfProfileMode || !(mode === "edit" && Boolean(state.permissions?.reset_user_password));
      memberEditorReset.disabled =
        isSelfProfileMode || mode !== "edit" || !Boolean(state.permissions?.reset_user_password);
    }
    const passwordField = field(memberEditorForm, "password");
    const passwordRow = memberEditorForm.querySelector("[data-member-editor-password-row]");
    if (passwordField) {
      passwordField.required = false;
      passwordField.placeholder = "Temporary password";
      passwordField.disabled = true;
      passwordField.value = "";
    }
    if (passwordRow) {
      passwordRow.hidden = true;
    }
    memberEditorModal.hidden = false;
    memberEditorModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    if (focusFieldName) {
      const focusField = field(memberEditorForm, focusFieldName);
      if (focusField && !focusField.disabled) {
        requestAnimationFrame(function () {
          focusField.focus();
          if (typeof focusField.setSelectionRange === "function") {
            const valueLength = String(focusField.value || "").length;
            focusField.setSelectionRange(valueLength, valueLength);
          }
        });
      }
    }
  }

  async function submitMemberEditorModal(event) {
    event.preventDefault();
    setMemberEditorStatus("", false);
    const report = (message, isError) => {
      setMemberEditorStatus(message, isError);
      feedback(message, isError);
    };
    const submitLabel =
      memberEditorMode === "create"
        ? "Add member"
        : memberEditorScope === "self_profile"
          ? "Save profile"
          : "Save changes";
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditBaseRates = Boolean(state.permissions?.edit_user_rates);
    const canEditCostRates = Boolean(
      state.permissions?.edit_cost_rates ||
      state.permissions?.view_cost_rates ||
      state.permissions?.view_cost_rate
    );
    const canCreate = Boolean(state.permissions?.create_user);
    const displayName = field(memberEditorForm, "display_name").value.trim();
    const username = field(memberEditorForm, "username").value.trim();
    const email = field(memberEditorForm, "email").value.trim();
    const employeeId = field(memberEditorForm, "employee_id").value.trim();
    const level = normalizeLevel(field(memberEditorForm, "level").value || "1");
    const departmentId = field(memberEditorForm, "department_id").value || null;
    const officeId = field(memberEditorForm, "office_id").value || null;
    const activeFrom = getDateInputIsoValue(field(memberEditorForm, "active_from"));
    const certifications = field(memberEditorForm, "certifications").value.trim();
    const memberProfile = field(memberEditorForm, "member_profile").value.trim();
    const isExempt = field(memberEditorForm, "is_exempt").value === "true";
    const baseRaw = field(memberEditorForm, "base_rate").value.trim();
    const costRaw = field(memberEditorForm, "cost_rate").value.trim();
    const baseRate = baseRaw === "" ? null : Number(baseRaw);
    const costRate = costRaw === "" ? null : Number(costRaw);
    if ((baseRate !== null && (!Number.isFinite(baseRate) || baseRate < 0)) || (costRate !== null && (!Number.isFinite(costRate) || costRate < 0))) {
      report("Rates must be non-negative numbers.", true);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(activeFrom)) {
      report("Start date is required.", true);
      return;
    }
    const needsProfileValidation = memberEditorMode === "create" || canEditProfile;
    if (needsProfileValidation && (!email || !email.includes("@"))) {
      report("Email must include @.", true);
      return;
    }
    if (needsProfileValidation) {
      const normalizedUserId = memberEditorMode === "edit" ? String(memberEditorUserId || "").trim() : "";
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const normalizedEmployeeId = String(employeeId || "").trim().toLowerCase();
      const users = Array.isArray(state.users) ? state.users : [];
      const conflictUserId = normalizedUsername
        ? users.find((u) =>
            u &&
            String(u.id || "").trim() !== normalizedUserId &&
            String(u.username || "").trim().toLowerCase() === normalizedUsername &&
            u.isActive !== false
          )
        : null;
      if (conflictUserId) {
        report("That user ID already exists.", true);
        return;
      }
      if (normalizedEmployeeId) {
        const conflictEmployeeId = users.find((u) =>
          u &&
          String(u.id || "").trim() !== normalizedUserId &&
          String(u.employeeId || "").trim().toLowerCase() === normalizedEmployeeId &&
          u.isActive !== false
        );
        if (conflictEmployeeId) {
          report("That employee ID already exists.", true);
          return;
        }
      }
    }

    if (memberEditorSubmit) {
      memberEditorSubmit.disabled = true;
      memberEditorSubmit.textContent = "Saving...";
    }

    try {
      if (memberEditorMode === "create") {
        if (!canCreate) {
          report("Access denied.", true);
          return;
        }
        const result = await mutatePersistentState(
          "add_user",
          {
            displayName,
            username,
            email,
            employeeId,
            level,
            officeId,
            baseRate,
            costRate,
            isExempt,
            activeFrom,
            certifications,
            memberProfile,
          },
          { skipHydrate: true, skipSettingsMetadataReload: true }
        );
        const created = (result?.users || []).find((u) => String(u.username || "").toLowerCase() === String(username).toLowerCase());
        if (created && departmentId && canEditProfile) {
          await mutatePersistentState(
            "set_user_department",
            { userId: created.id, departmentId },
            settingsSaveFastOptions()
          );
        }
        closeMemberEditorModal();
        feedback("Member added.", false);
        render();
        refreshSettingsTabInBackground("rates");
      } else {
        const userId = memberEditorUserId;
        const currentUser = (state.users || []).find((u) => u.id === userId);
        if (!currentUser) {
          report("Team member not found.", true);
          return;
        }
        const targetRoleAllowed =
          typeof canViewUserByRole !== "function" ||
          canViewUserByRole(state.currentUser, currentUser);
        const isSelfProfileMode = memberEditorScope === "self_profile";
        if (isSelfProfileMode) {
          const currentUserId = `${state.currentUser?.id || ""}`.trim();
          if (!currentUserId || currentUserId !== `${userId || ""}`.trim()) {
            report("Access denied.", true);
            return;
          }
          const normalizeText = (value) => String(value || "").trim();
          const profileChanged =
            normalizeText(currentUser.certifications) !== certifications ||
            normalizeText(currentUser.memberProfile) !== memberProfile;
          if (!profileChanged) {
            closeMemberEditorModal();
            return;
          }
          const previousUserSnapshot = { ...currentUser };
          state.users = (state.users || []).map((item) =>
            !item || item.id !== userId
              ? item
              : {
                  ...item,
                  certifications,
                  memberProfile,
                }
          );
          if (`${state.currentUser?.id || ""}`.trim() === userId) {
            state.currentUser = {
              ...state.currentUser,
              certifications,
              memberProfile,
            };
          }
          closeMemberEditorModal();
          render();
          try {
            await mutatePersistentState(
              "update_own_profile",
              {
                certifications,
                memberProfile,
              },
              settingsSaveFastOptions()
            );
            feedback("Profile updated.", false);
          } catch (innerError) {
            state.users = (state.users || []).map((item) =>
              !item || item.id !== userId ? item : previousUserSnapshot
            );
            if (`${state.currentUser?.id || ""}`.trim() === userId) {
              state.currentUser = {
                ...state.currentUser,
                certifications: previousUserSnapshot.certifications || "",
                memberProfile: previousUserSnapshot.memberProfile || "",
              };
            }
            render();
            throw innerError;
          }
          return;
        }
        const normalizeText = (value) => String(value || "").trim();
        const normalizeNumber = (value) => {
          if (value === null || value === undefined || `${value}`.trim() === "") {
            return null;
          }
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : null;
        };
        const profileChanged =
          canEditProfile &&
          (
            normalizeText(currentUser.displayName) !== displayName ||
            normalizeText(currentUser.username) !== username ||
            normalizeText(currentUser.email) !== email ||
            normalizeText(currentUser.employeeId) !== employeeId ||
            normalizeLevel(currentUser.level || "1") !== level ||
            normalizeText(currentUser.officeId) !== normalizeText(officeId) ||
            Boolean(currentUser.isExempt) !== isExempt ||
            normalizeText(currentUser.certifications) !== certifications ||
            normalizeText(currentUser.memberProfile) !== memberProfile ||
            normalizeText(currentUser.activeFrom) !== normalizeText(activeFrom)
          );
        const departmentChanged =
          canEditProfile &&
          normalizeText(currentUser.departmentId) !== normalizeText(departmentId);
        const baseRateChanged =
          canEditBaseRates &&
          targetRoleAllowed &&
          normalizeNumber(currentUser.baseRate) !== normalizeNumber(baseRate);
        const costRateChanged =
          canEditCostRates &&
          targetRoleAllowed &&
          normalizeNumber(currentUser.costRate) !== normalizeNumber(costRate);
        const ratesChanged = baseRateChanged || costRateChanged;
        if (!profileChanged && !departmentChanged && !ratesChanged) {
          closeMemberEditorModal();
          return;
        }

        if (canEditProfile) {
          if (profileChanged) {
            await mutatePersistentState(
              "update_user",
              {
                userId,
                displayName,
                username,
                email,
                employeeId,
                level,
                officeId,
                isExempt,
                activeFrom,
                certifications,
                memberProfile,
              },
              settingsSaveFastOptions()
            );
          }
        }
        if (departmentChanged) {
          await mutatePersistentState(
            "set_user_department",
            { userId, departmentId },
            settingsSaveFastOptions()
          );
        }
        if (ratesChanged) {
          await mutatePersistentState(
            "update_user_rates",
            {
              userId,
              baseRate: baseRateChanged ? baseRate : currentUser.baseRate,
              costRate: costRateChanged ? costRate : currentUser.costRate,
            },
            settingsSaveFastOptions()
          );
        }
        closeMemberEditorModal();
        feedback("Member updated.", false);
        refreshSettingsTabInBackground("rates");
      }
    } catch (error) {
      report(error.message || "Unable to save member.", true);
    } finally {
      if (memberEditorSubmit && memberEditorModal && !memberEditorModal.hidden) {
        memberEditorSubmit.disabled = false;
        memberEditorSubmit.textContent = submitLabel;
      }
    }
  }

  function ensureDepartmentSettingsUI() {
    const settingsTabs = document.querySelector("#settings-page .settings-tabs");
    const settingsBody = document.querySelector("#settings-page .users-page-body");
    const settingsPanels = document.querySelector("#settings-page .settings-panels");
    if (!settingsTabs || !settingsBody) return;

    let deptButton = settingsTabs.querySelector('[data-settings-tab-button="departments"]');
    if (!deptButton) {
      deptButton = document.createElement("button");
      deptButton.type = "button";
      deptButton.className = "settings-tab";
      deptButton.dataset.settingsTabButton = "departments";
      deptButton.setAttribute("role", "tab");
      deptButton.setAttribute("aria-selected", "false");
      deptButton.textContent = "Departments";
      settingsTabs.appendChild(deptButton);
    }

    let deptForm = document.querySelector('[data-settings-tab="departments"]');
    if (!deptForm) {
      deptForm = document.createElement("form");
      deptForm.id = "departments-form";
      deptForm.className = "level-labels-form";
      deptForm.dataset.settingsTab = "departments";
      deptForm.hidden = true;
      deptForm.innerHTML = `
        <div class="level-labels-inner">
          <h3>Departments</h3>
          <div class="level-rows" id="department-rows"></div>
          <div class="level-labels-actions">
            <button class="button settings-add-action" type="button" id="add-department">Add department</button>
          </div>
        </div>
      `;
      (settingsPanels || settingsBody).appendChild(deptForm);
    }

    refs.departmentsForm = document.getElementById("departments-form");
    refs.departmentRows = document.getElementById("department-rows");
    refs.addDepartment = document.getElementById("add-department");

    let targetButton = settingsTabs.querySelector('[data-settings-tab-button="target_realizations"]');
    if (!targetButton) {
      targetButton = document.createElement("button");
      targetButton.type = "button";
      targetButton.className = "settings-tab";
      targetButton.dataset.settingsTabButton = "target_realizations";
      targetButton.setAttribute("role", "tab");
      targetButton.setAttribute("aria-selected", "false");
      targetButton.textContent = "Target realizations";
      settingsTabs.appendChild(targetButton);
    }

    let targetForm = document.querySelector('[data-settings-tab="target_realizations"]');
    if (!targetForm) {
      targetForm = document.createElement("form");
      targetForm.id = "target-realizations-form";
      targetForm.className = "level-labels-form";
      targetForm.dataset.settingsTab = "target_realizations";
      targetForm.hidden = true;
      targetForm.innerHTML = `
        <div class="level-labels-inner">
          <h3>Target realizations</h3>
          <div id="target-realizations-matrix"></div>
          <div class="level-labels-actions">
          </div>
        </div>
      `;
      (settingsPanels || settingsBody).appendChild(targetForm);
    }

    refs.targetRealizationsForm = document.getElementById("target-realizations-form");
    refs.targetRealizationsMatrix = document.getElementById("target-realizations-matrix");

    let departmentLeadsButton = settingsTabs.querySelector('[data-settings-tab-button="department_leads"]');
    if (!departmentLeadsButton) {
      departmentLeadsButton = document.createElement("button");
      departmentLeadsButton.type = "button";
      departmentLeadsButton.className = "settings-tab";
      departmentLeadsButton.dataset.settingsTabButton = "department_leads";
      departmentLeadsButton.setAttribute("role", "tab");
      departmentLeadsButton.setAttribute("aria-selected", "false");
      departmentLeadsButton.textContent = "Department leads";
      settingsTabs.appendChild(departmentLeadsButton);
    }

    let departmentLeadsForm = document.querySelector('[data-settings-tab="department_leads"]');
    if (!departmentLeadsForm) {
      departmentLeadsForm = document.createElement("form");
      departmentLeadsForm.id = "department-leads-form";
      departmentLeadsForm.className = "level-labels-form";
      departmentLeadsForm.dataset.settingsTab = "department_leads";
      departmentLeadsForm.hidden = true;
      departmentLeadsForm.innerHTML = `
        <div class="level-labels-inner">
          <h3>Department Leads</h3>
          <div id="department-leads-matrix"></div>
        </div>
      `;
      (settingsPanels || settingsBody).appendChild(departmentLeadsForm);
    }

    refs.departmentLeadsForm = document.getElementById("department-leads-form");
    refs.departmentLeadsMatrix = document.getElementById("department-leads-matrix");
  }

  ensureDepartmentSettingsUI();
  removeMembersAddCard();
  ensureMemberEditorModal();

  initExpenseFilterDatePickers();

  // Enforce settings dropdown item order: Audit Log, Dark/Light, Change Password, Log out.
  if (refs.settingsMenu) {
    [
      refs.navAudit,
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
    catalogClientLifecycleView: "active",
    catalogProjectLifecycleView: "active",
    visibleClientIds: [],
    visibleProjectIds: [],
    visibilitySnapshotReady: false,
    sessionToken: loadSessionToken(),
    currentUser: null,
    users: [],
    inactiveUsers: [],
    bootstrapRequired: false,
    levelLabels: {},
    officeLocations: [],
    expenseCategories: [],
    projectExpenseCategories: [],
    projectPlannedExpenses: [],
    corporateFunctionGroups: [],
    corporateFunctionCategories: [],
    departments: [],
    departmentsSnapshot: [],
    targetRealizations: [],
    departmentLeadAssignments: [],
    utilizationScope: null,
    utilizationUsers: [],
    utilizationEntries: [],
    account: null,
    settingsAccess: {},
    notificationRules: [],
    projects: [],
    clientEditor: null,
    assignments: {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    },
    projectMemberBudgets: [],
    currentView: "inputs", // "inputs" | "entries" | "inbox" | "clients" | "members" | "analytics" | "settings" | "audit" | "project_planning"
    currentProjectPlanningId: "",
    mobileClientsView: "list", // "list" | "detail"
    mobileMembersView: "list", // "list" | "detail"
    inputSubtab: "time", // "time" | "expenses"
    inputsTimeCalendarExpanded: false,
    inputsTimeShowAllDays: false,
    inputsTimeCalendarEndDate: today,
    inputsTimeSelectedDate: today,
    inputsTimeSelectedClientProject: "",
    inputsTimeSelectedCorporateCategoryId: "",
    inputsExpenseCalendarExpanded: false,
    inputsExpenseShowAllDays: false,
    inputsExpenseCalendarEndDate: today,
    inputsExpenseSelectedDate: today,
    inputsExpenseSelectedClientProject: "",
    inputsExpenseSelectedCorporateCategoryId: "",
    pendingInputsTimeEditId: "",
    pendingInputsExpenseEditId: "",
    entriesSubtab: "time", // "time" | "expenses"
    entriesSelectionMode: false,
    selectedEntryIds: new Set(),
    expensesSelectionMode: false,
    selectedExpenseIds: new Set(),
    lastTimeDeleteUndo: null,
    lastExpenseDeleteUndo: null,
    deletedEntries: [],
    deletedExpenses: [],
    deletedItemsView: "time", // "time" | "expense" | "all"
    deletedFilters: {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    },
    deletedSelectionMode: false,
    selectedDeletedKeys: new Set(),
    deletedItemsLoading: false,
    delegators: [],
    myDelegations: [],
    delegationCandidates: [],
    settingsMetadataLoaded: false,
    settingsMetadataLoading: false,
    actingAsUserId: "",
    inboxItems: [],
    inboxFilter: "all",
    inboxSelectedIds: [],
    inboxVisitReadIds: [],
    auditLogs: [],
    auditFilters: {
      entity: "",
      action: "",
      actor: "",
      beginDate: "",
      endDate: "",
      category: "",
    },
    auditOffset: 0,
    auditHasMore: false,
    auditLoadingMore: false,
    auditDateBounds: {
      min: "",
      max: "",
    },
    auditDateBoundsLoading: false,
    auditFilterOptions: {
      entities: [],
      actions: [],
      actors: [],
      categories: [],
    },
    auditFilterOptionsLoaded: false,
    auditFilterOptionsLoading: false,
  };

  setupAddClientHeaderAction();
  setupAddProjectHeaderAction();

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
    loadAuditLogs,
    syncAuditFilterOptions,
  };

  function arrangeSettingsMenu(showAudit) {
    if (!refs.settingsMenu) return;
    const items = [
      showAudit ? refs.navAudit : null,
      refs.themeToggle,
      refs.changePasswordOpen,
      refs.logoutButton,
    ].filter(Boolean);
    if (showAudit && refs.navAudit && refs.themeToggle) {
      refs.navAudit.className = refs.themeToggle.className || "";
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
    interceptSelection: null,
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
      const explicit = window.localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY) === "1";
      if (!explicit) {
        return null;
      }
      return raw === "light" || raw === "dark" ? raw : null;
    } catch (error) {
      return null;
    }
  }


  function saveThemePreference(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, "1");
    } catch (error) {
      return;
    }
  }

  function clearThemePreference() {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      window.localStorage.removeItem(THEME_EXPLICIT_STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function resolveTheme() {
    const savedTheme = loadThemePreference();
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
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

  function persistCurrentView(view) {
    const normalized = `${view || ""}`.trim();
    if (!normalized) return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, normalized);
    } catch (error) {
      return;
    }
  }

  function loadPersistedView() {
    try {
      const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
      return `${raw || ""}`.trim();
    } catch (error) {
      return "";
    }
  }

  function clearPersistedView() {
    try {
      window.localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function persistProjectPlanningId(projectId) {
    const normalized = `${projectId || ""}`.trim();
    try {
      if (normalized) {
        window.localStorage.setItem(PROJECT_PLANNING_ID_STORAGE_KEY, normalized);
      } else {
        window.localStorage.removeItem(PROJECT_PLANNING_ID_STORAGE_KEY);
      }
    } catch (error) {
      return;
    }
  }

  function loadPersistedProjectPlanningId() {
    try {
      const raw = window.localStorage.getItem(PROJECT_PLANNING_ID_STORAGE_KEY);
      return `${raw || ""}`.trim();
    } catch (error) {
      return "";
    }
  }

  function canSeeAllClientsProjects() {
    return Boolean(state.permissions?.see_all_clients_projects);
  }

  function canSeeOfficeClientsProjects() {
    return Boolean(state.permissions?.see_office_clients_projects);
  }

  function canSeeAssignedClientsProjects() {
    return Boolean(state.permissions?.see_assigned_clients_projects);
  }

  function canManageClientsLifecycle() {
    return Boolean(state.permissions?.manage_clients_lifecycle);
  }

  function canManageProjectsLifecycle() {
    return Boolean(state.permissions?.manage_projects_lifecycle);
  }

  function canEditClientsGlobal() {
    return Boolean(state.permissions?.edit_clients);
  }

  function canEditProjectsAllModal() {
    return Boolean(state.permissions?.edit_projects_all_modal);
  }

  function canEditProjectPlanningCapability() {
    return Boolean(state.permissions?.edit_project_planning);
  }

  function hasClientsTabAccess() {
    return Boolean(
      canSeeAllClientsProjects() ||
      canSeeOfficeClientsProjects() ||
      canSeeAssignedClientsProjects()
    );
  }

  function findProjectRow(clientName, projectName) {
    const normalizedClient = String(clientName || "").trim();
    const normalizedProject = String(projectName || "").trim().toLowerCase();
    return (
      (state.projects || []).find(
        (item) =>
          String(item?.client || "").trim() === normalizedClient &&
          String(item?.name || item?.project || "").trim().toLowerCase() === normalizedProject
      ) || null
    );
  }

  function isCurrentUserProjectLead(project) {
    if (!project) return false;
    const projectLeadId = String(project?.projectLeadId || project?.project_lead_id || "").trim();
    const currentUserId = String(state.currentUser?.id || "").trim();
    return Boolean(projectLeadId && currentUserId && projectLeadId === currentUserId);
  }

  function canEditProjectModal(clientName, projectName) {
    const project = findProjectRow(clientName, projectName);
    if (!project) return false;
    if (canEditProjectsAllModal()) return true;
    return isCurrentUserProjectLead(project);
  }

  function canEditProjectPlanning(clientName, projectName) {
    const project = findProjectRow(clientName, projectName);
    if (!project) return false;
    if (canEditProjectPlanningCapability()) return true;
    return isCurrentUserProjectLead(project);
  }

  function isViewAllowed(view) {
    const nextView = `${view || ""}`.trim().toLowerCase();
    if (!state.currentUser) return false;
    if (!nextView) return false;
    if (
      nextView === "inputs" ||
      nextView === "entries" ||
      nextView === "analytics" ||
      nextView === "inbox"
    ) {
      return true;
    }
    if (nextView === "project_planning") {
      return hasClientsTabAccess();
    }
    if (nextView === "clients") {
      return hasClientsTabAccess();
    }
    if (nextView === "members") {
      return true;
    }
    if (nextView === "settings") {
      return !!state.permissions?.view_settings_tab;
    }
    if (nextView === "audit") {
      return isAdmin(state.currentUser);
    }
    return false;
  }

  window.isViewAllowed = isViewAllowed;

  // Build user options from the currently visible expense rows (ignoring the user filter only).
  function visibleExpenseUserOptions() {
    const names = new Set(availableUsers());
    const rows =
      window.expenses && typeof window.expenses.currentExpenses === "function"
        ? window.expenses.currentExpenses()
        : [];
    rows.forEach((row) => {
      const match = state.users?.find((u) => u.id === row.userId);
      if (match?.displayName) {
        names.add(match.displayName);
      }
    });
    return Array.from(names);
  }

  // Build client options from the currently visible expense rows (ignoring the client filter only).
  function visibleExpenseClientOptions() {
    const names = new Set();
    const rows =
      window.expenses && typeof window.expenses.currentExpenses === "function"
        ? window.expenses.currentExpenses()
        : [];
    rows.forEach((row) => {
      if (row?.clientName) {
        names.add(row.clientName);
      }
    });
    return Array.from(names);
  }

  function entryUserOptions() {
    const scopeUser = effectiveScopeUser();
    if (!scopeUser) return availableUsers();
    const scopedRows =
      typeof currentEntries === "function"
        ? currentEntries({
            user: "",
            client: "",
            project: "",
            from: "",
            to: "",
            search: "",
          })
        : [];
    const names = new Set(scopedRows.map((entry) => `${entry?.user || ""}`.trim()).filter(Boolean));
    if (scopeUser?.displayName) {
      names.add(scopeUser.displayName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  function normalizeInboxItem(item) {
    if (!item || typeof item !== "object") return null;
    const id = `${item.id || ""}`.trim();
    if (!id) return null;
    const isReadRaw =
      item.isRead !== undefined && item.isRead !== null ? item.isRead : item.is_read;
    const isRead =
      isReadRaw === true ||
      isReadRaw === 1 ||
      isReadRaw === "1" ||
      (typeof isReadRaw === "string" &&
        (isReadRaw.trim().toLowerCase() === "true" || isReadRaw.trim().toLowerCase() === "t"));
    const deepLink = item.deepLink && typeof item.deepLink === "object" ? item.deepLink : null;
    return {
      id,
      type: `${item.type || ""}`.trim(),
      recipientUserId: `${item.recipientUserId || item.recipient_user_id || ""}`.trim(),
      actorUserId: `${item.actorUserId || item.actor_user_id || ""}`.trim(),
      subjectType: `${item.subjectType || item.subject_type || ""}`.trim(),
      subjectId: `${item.subjectId || item.subject_id || ""}`.trim(),
      message: `${item.message || ""}`.trim(),
      noteSnippet: `${item.noteSnippet || item.note_snippet || ""}`.trim(),
      isRead,
      projectNameSnapshot: `${item.projectNameSnapshot || item.project_name_snapshot || ""}`.trim(),
      deepLink,
      createdAt: item.createdAt || item.created_at || null,
    };
  }

  const NOTIFICATION_RULE_ROWS = [
    {
      eventType: "time_entry_created",
      label: "Time entered",
      recipientText: "Project Lead",
    },
    {
      eventType: "expense_entry_created",
      label: "Expense entered",
      recipientText: "Project Lead",
    },
    {
      eventType: "entry_approved",
      label: "Time approved",
      recipientText: "Entry owner",
    },
    {
      eventType: "expense_approved",
      label: "Expense approved",
      recipientText: "Expense owner",
    },
    {
      eventType: "delegation_updated",
      label: "Delegation updated",
      recipientText: "Delegated member",
      emailSupported: true,
    },
    {
      eventType: "project_assignment_updated",
      label: "Project assignment updated",
      recipientText: "Assigned member",
      emailSupported: true,
    },
    {
      eventType: "entry_billing_status_updated",
      label: "Time billing status updated",
      recipientText: "Entry owner",
    },
    {
      eventType: "expense_billing_status_updated",
      label: "Expense billing status updated",
      recipientText: "Expense owner",
    },
  ];

  function notificationRuleByEventType(eventType) {
    return (state.notificationRules || []).find((rule) => rule.eventType === eventType) || null;
  }

  function renderMessagingRules() {
    if (!refs.messagingRulesRows) return;
    refs.messagingRulesRows.innerHTML = NOTIFICATION_RULE_ROWS.map((row) => {
      const rule = notificationRuleByEventType(row.eventType);
      const inboxChecked = rule ? rule.inboxEnabled !== false : true;
      const emailChecked = rule ? rule.emailEnabled === true : false;
      const emailCell = row.emailSupported
        ? `
            <label class="perm-switch">
              <input type="checkbox" data-rule-email="${escapeHtml(row.eventType)}" ${emailChecked ? "checked" : ""} />
              <span class="perm-switch-track" aria-hidden="true"></span>
            </label>
          `
        : `
            <label class="rules-toggle rules-toggle-disabled">
              <input type="checkbox" ${emailChecked ? "checked" : ""} disabled />
              <span>Coming later</span>
            </label>
          `;
      return `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>
            <label class="perm-switch">
              <input type="checkbox" data-rule-inbox="${escapeHtml(row.eventType)}" ${inboxChecked ? "checked" : ""} />
              <span class="perm-switch-track" aria-hidden="true"></span>
            </label>
          </td>
          <td>${emailCell}</td>
          <td>${escapeHtml(row.recipientText)}</td>
        </tr>
      `;
    }).join("");
  }

  function applyLoadedState(data) {
    const previousCurrentUserId = `${state.currentUser?.id || ""}`.trim();
    const previousActingAsUserId = `${state.actingAsUserId || ""}`.trim();
    const previousOfficeLocations = Array.isArray(state.officeLocations)
      ? state.officeLocations.slice()
      : [];
    const ensureRole = (user) => {
      if (!user) return user;
      if (!user.role && (user.permissionGroup || user.permission_group)) {
        user.role = user.permissionGroup || user.permission_group;
      }
      return user;
    };
    state.currentUser = data?.currentUser ? ensureRole(normalizeUser(data.currentUser)) : null;
    if (state.currentUser) {
      state.currentUser.certifications = String(
        data?.currentUser?.certifications ?? ""
      ).trim();
      state.currentUser.memberProfile = String(
        data?.currentUser?.memberProfile ?? data?.currentUser?.member_profile ?? ""
      ).trim();
      state.currentUser.activeFrom = normalizeIsoDateValue(
        data?.currentUser?.activeFrom ?? data?.currentUser?.active_from ?? ""
      );
      state.currentUser.activeTo = normalizeIsoDateValue(
        data?.currentUser?.activeTo ?? data?.currentUser?.active_to ?? ""
      );
      state.currentUser.status = String(
        data?.currentUser?.status ?? (state.currentUser.activeTo ? "terminated" : "active")
      ).trim();
    }
    const nextCurrentUserId = `${state.currentUser?.id || ""}`.trim();
    if (previousCurrentUserId !== nextCurrentUserId) {
      usersResetDirectoryFilters?.();
    }
    state.users = Array.isArray(data?.users)
      ? data.users
          .map((u) => {
            const normalized = ensureRole(normalizeUser(u));
            if (!normalized) return null;
            normalized.officeName =
              typeof u?.officeName === "string" && u.officeName.trim()
                ? u.officeName.trim()
                : typeof u?.office_name === "string" && u.office_name.trim()
                  ? u.office_name.trim()
                  : "";
            normalized.email =
              typeof u?.email === "string" && u.email.trim()
                ? u.email.trim()
                : "";
            normalized.certifications = String(
              u?.certifications ?? ""
            ).trim();
            normalized.memberProfile = String(
              u?.memberProfile ?? u?.member_profile ?? ""
            ).trim();
            normalized.activeFrom = normalizeIsoDateValue(
              u?.activeFrom ?? u?.active_from ?? ""
            );
            normalized.activeTo = normalizeIsoDateValue(
              u?.activeTo ?? u?.active_to ?? ""
            );
            normalized.status = String(
              u?.status ?? (normalized.activeTo ? "terminated" : "active")
            ).trim();
            normalized.isActive =
              u?.isActive !== undefined
                ? Boolean(u.isActive)
                : u?.is_active !== undefined
                  ? Boolean(u.is_active)
                  : normalized.status.toLowerCase() !== "terminated";
            return normalized;
          })
          .filter(Boolean)
      : [];
    state.inactiveUsers = Array.isArray(data?.inactiveUsers)
      ? data.inactiveUsers
          .map((u) => {
            const normalized = ensureRole(normalizeUser(u));
            if (!normalized) return null;
            normalized.officeName =
              typeof u?.officeName === "string" && u.officeName.trim()
                ? u.officeName.trim()
                : typeof u?.office_name === "string" && u.office_name.trim()
                  ? u.office_name.trim()
                  : "";
            normalized.email =
              typeof u?.email === "string" && u.email.trim()
                ? u.email.trim()
                : "";
            normalized.certifications = String(
              u?.certifications ?? ""
            ).trim();
            normalized.memberProfile = String(
              u?.memberProfile ?? u?.member_profile ?? ""
            ).trim();
            normalized.activeFrom = normalizeIsoDateValue(
              u?.activeFrom ?? u?.active_from ?? ""
            );
            normalized.activeTo = normalizeIsoDateValue(
              u?.activeTo ?? u?.active_to ?? ""
            );
            normalized.status = String(
              u?.status ?? (normalized.activeTo ? "terminated" : "active")
            ).trim();
            normalized.isActive =
              u?.isActive !== undefined
                ? Boolean(u.isActive)
                : u?.is_active !== undefined
                  ? Boolean(u.is_active)
                  : normalized.status.toLowerCase() !== "terminated";
            return normalized;
          })
          .filter(Boolean)
      : [];
    const hasDepartments = Array.isArray(data?.departments);
    if (hasDepartments) {
      state.departments = data.departments.slice();
      state.departmentsSnapshot = data.departments.slice();
    }
    if (Array.isArray(data?.targetRealizations)) {
      state.targetRealizations = data.targetRealizations
        .map((item) => ({
          id: String(item?.id || "").trim(),
          officeId: String(item?.officeId || item?.office_id || "").trim(),
          departmentId: String(item?.departmentId || item?.department_id || "").trim(),
          targetRealizationPct:
            item?.targetRealizationPct === null || item?.targetRealizationPct === undefined || item?.targetRealizationPct === ""
              ? null
              : Number(item.targetRealizationPct),
        }))
        .filter((item) => item.officeId && item.departmentId);
    }
    if (Array.isArray(data?.departmentLeadAssignments)) {
      state.departmentLeadAssignments = data.departmentLeadAssignments
        .map((item) => ({
          id: String(item?.id || "").trim(),
          officeId: String(item?.officeId || item?.office_id || "").trim(),
          departmentId: String(item?.departmentId || item?.department_id || "").trim(),
          userId: String(item?.userId || item?.user_id || "").trim(),
        }))
        .filter((item) => item.officeId && item.departmentId);
    }
    state.bootstrapRequired = Boolean(data?.bootstrapRequired);
    state.catalog = normalizeCatalog(data?.catalog || {}, false);
    state.clients = Array.isArray(data?.clients)
      ? data.clients.map(normalizeClient).filter(Boolean)
      : [];
    state.entries = Array.isArray(data?.entries) ? data.entries.map(normalizeEntry).filter(Boolean) : [];
    state.expenses = Array.isArray(data?.expenses)
      ? data.expenses.map(normalizeExpense).filter(Boolean)
      : [];
    if (Object.prototype.hasOwnProperty.call(data || {}, "utilizationScope")) {
      state.utilizationScope =
        data?.utilizationScope && typeof data.utilizationScope === "object"
          ? { ...data.utilizationScope }
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(data || {}, "utilizationUsers")) {
      state.utilizationUsers = Array.isArray(data?.utilizationUsers)
        ? data.utilizationUsers.map(normalizeUser).filter(Boolean)
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(data || {}, "utilizationEntries")) {
      state.utilizationEntries = Array.isArray(data?.utilizationEntries)
        ? data.utilizationEntries.map(normalizeEntry).filter(Boolean)
        : [];
    }
    state.assignments = normalizeAssignments(data?.assignments);
    const hasVisibilitySnapshot =
      Array.isArray(data?.visibleClientIds) && Array.isArray(data?.visibleProjectIds);
    if (hasVisibilitySnapshot) {
      state.visibleClientIds = data.visibleClientIds.map((id) => `${id || ""}`.trim()).filter(Boolean);
      state.visibleProjectIds = data.visibleProjectIds.map((id) => `${id || ""}`.trim()).filter(Boolean);
      state.visibilitySnapshotReady = true;
    } else if (!Array.isArray(state.visibleClientIds) || !Array.isArray(state.visibleProjectIds)) {
      state.visibleClientIds = [];
      state.visibleProjectIds = [];
      state.visibilitySnapshotReady = false;
    }
    if (Array.isArray(data?.projectMemberBudgets)) {
      state.projectMemberBudgets = data.projectMemberBudgets
        .map((item) => ({
          projectId: String(item?.projectId || "").trim(),
          userId: String(item?.userId || "").trim(),
          budgetHours:
            item?.budgetHours === null || item?.budgetHours === undefined ? null : Number(item.budgetHours),
          budgetAmount:
            item?.budgetAmount === null || item?.budgetAmount === undefined ? null : Number(item.budgetAmount),
          rateOverride:
            item?.rateOverride === null || item?.rateOverride === undefined ? null : Number(item.rateOverride),
        }))
        .filter((item) => item.projectId && item.userId);
    }
    state.levelLabels = data?.levelLabels && typeof data.levelLabels === "object"
      ? data.levelLabels
      : {};
    state.permissionRoles = Array.isArray(data?.permissionRoles) ? data.permissionRoles.slice() : [];
    state.rolePermissions = Array.isArray(data?.rolePermissions) ? data.rolePermissions.slice() : [];
    const hasOfficeLocations = Array.isArray(data?.officeLocations);
    const remoteOffices = hasOfficeLocations
      ? data.officeLocations
          .map(function (item) {
            const id = item.id || item.locationId || null;
            const name = (item.name || "").trim();
            const officeLeadUserId = item.officeLeadUserId || item.office_lead_user_id || "";
            const officeLeadUserName = item.officeLeadUserName || item.office_lead_user_name || "";
            if (!name) return null;
            return { id, name, officeLeadUserId, officeLeadUserName };
          })
          .filter(Boolean)
      : null;

    const cachedOffices = (() => {
      try {
        const raw = window.localStorage.getItem("timesheet.offices");
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })();

    if (hasOfficeLocations) {
      state.officeLocations = remoteOffices !== null
        ? remoteOffices
        : cachedOffices !== null
          ? cachedOffices
          : previousOfficeLocations;
    }
    state.expenseCategories = Array.isArray(data?.expenseCategories)
      ? data.expenseCategories.map((item) => ({
          id: item.id,
          name: item.name,
        }))
      : [];
    state.projectExpenseCategories = Array.isArray(data?.projectExpenseCategories)
      ? data.projectExpenseCategories.map((item) => ({
          id: item.id,
          name: item.name,
        }))
      : [];
    state.projectPlannedExpenses = Array.isArray(data?.projectPlannedExpenses)
      ? data.projectPlannedExpenses.map((item) => ({
          id: item.id,
          projectId: item.projectId,
          categoryId: item.categoryId ?? null,
          description: item.description ?? "",
          units: Number.isFinite(Number(item.units)) ? Number(item.units) : 0,
          unitCost: Number.isFinite(Number(item.unitCost)) ? Number(item.unitCost) : 0,
          markupPct: Number.isFinite(Number(item.markupPct)) ? Number(item.markupPct) : 0,
          billable: item.billable === true,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
        }))
      : [];
    state.corporateFunctionGroups = Array.isArray(data?.corporateFunctionGroups)
      ? data.corporateFunctionGroups.map((item) => ({
          id: item.id,
          name: String(item.name || "").trim(),
          sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0) || 0,
        }))
      : [];
    state.corporateFunctionCategories = Array.isArray(data?.corporateFunctionCategories)
      ? data.corporateFunctionCategories.map((item) => ({
          id: item.id,
          groupId: String(item.groupId || item.group_id || "").trim(),
          groupName: String(item.groupName || item.group_name || "").trim(),
          name: String(item.name || "").trim(),
          sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0) || 0,
        })).filter((item) => item.name)
      : [];
    state.account = data?.account || null;
    state.settingsAccess = data?.settingsAccess || {};
    if (Array.isArray(data?.notificationRules)) {
      state.notificationRules = data.notificationRules.map((rule) => ({
        eventType: `${rule?.eventType || rule?.event_type || ""}`.trim(),
        enabled: rule?.enabled === false || rule?.enabled === 0 ? false : true,
        inboxEnabled:
          rule?.inboxEnabled === false || rule?.inbox_enabled === false || rule?.inbox_enabled === 0
            ? false
            : true,
        emailEnabled:
          rule?.emailEnabled === true || rule?.email_enabled === true || rule?.email_enabled === 1,
        recipientScope: `${rule?.recipientScope || rule?.recipient_scope || ""}`.trim(),
        deliveryMode: `${rule?.deliveryMode || rule?.delivery_mode || ""}`.trim(),
      }));
    }
    state.inboxItems = Array.isArray(data?.inboxItems)
      ? data.inboxItems.map(normalizeInboxItem).filter(Boolean)
      : [];
    state.inboxSelectedIds = [];
    state.inboxVisitReadIds = [];
    state.permissions = data?.permissions || {};
    state.delegators = Array.isArray(data?.delegators)
      ? data.delegators
          .map((item) => {
            const id = `${item?.id || item?.delegatorUserId || ""}`.trim();
            const name = `${item?.name || item?.delegatorName || ""}`.trim();
            if (!id || !name) return null;
            return { id, name };
          })
          .filter(Boolean)
      : [];
    if (Array.isArray(data?.myDelegations)) {
      state.myDelegations = data.myDelegations
        .map((item) => ({
          delegateUserId: `${item?.delegateUserId || item?.delegate_user_id || ""}`.trim(),
          delegateName: `${item?.delegateName || item?.delegate_name || ""}`.trim(),
          capability: `${item?.capability || ""}`.trim(),
        }))
        .filter((item) => item.delegateUserId && item.delegateName && item.capability);
    }
    if (Array.isArray(data?.delegationCandidates)) {
      state.delegationCandidates = data.delegationCandidates
        .map((item) => ({
          id: `${item?.id || ""}`.trim(),
          name: `${item?.name || item?.displayName || ""}`.trim(),
        }))
        .filter((item) => item.id && item.name);
    }
    if (
      hasDepartments ||
      hasOfficeLocations ||
      Array.isArray(data?.notificationRules) ||
      Array.isArray(data?.myDelegations) ||
      Array.isArray(data?.delegationCandidates) ||
      Array.isArray(data?.targetRealizations) ||
      Array.isArray(data?.departmentLeadAssignments)
    ) {
      state.settingsMetadataLoaded = true;
      state.settingsMetadataLoading = false;
    }
    const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const canKeepSelection =
      previousActingAsUserId &&
      (normalizeId(previousActingAsUserId) === normalizeId(currentUserId) ||
        state.delegators.some((item) => normalizeId(item.id) === normalizeId(previousActingAsUserId)));
    state.actingAsUserId = canKeepSelection ? previousActingAsUserId : currentUserId;
    const normalizedProjects = normalizeProjects(data?.projects);
    state.projects = normalizedProjects.length
      ? normalizedProjects
      : buildProjectsFromCatalog(state.catalog, {});
    state.clientEditor = null;
  }

  function clearRemoteAppState() {
    state.currentUser = null;
    state.users = [];
    state.inactiveUsers = [];
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
    state.clients = [];
    state.entries = [];
    state.expenses = [];
    state.projects = [];
    state.clientEditor = null;
    state.entriesSelectionMode = false;
    state.selectedEntryIds = new Set();
    state.expensesSelectionMode = false;
    state.selectedExpenseIds = new Set();
    state.lastTimeDeleteUndo = null;
    state.lastExpenseDeleteUndo = null;
    state.deletedEntries = [];
    state.deletedExpenses = [];
    state.deletedItemsView = "time";
    state.deletedFilters = {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
    state.deletedSelectionMode = false;
    state.selectedDeletedKeys = new Set();
    state.deletedItemsLoading = false;
    state.levelLabels = {};
    state.officeLocations = [];
    state.expenseCategories = [];
    state.projectExpenseCategories = [];
    state.projectPlannedExpenses = [];
    state.targetRealizations = [];
    state.departmentLeadAssignments = [];
    state.utilizationScope = null;
    state.utilizationUsers = [];
    state.utilizationEntries = [];
    state.account = null;
    state.visibleClientIds = [];
    state.visibleProjectIds = [];
    state.visibilitySnapshotReady = false;
    state.notificationRules = [];
    state.assignments = {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    };
    state.projectMemberBudgets = [];
    state.auditLogs = [];
    state.auditOffset = 0;
    state.auditHasMore = false;
    state.auditLoadingMore = false;
    state.inboxItems = [];
    state.inboxFilter = "all";
    state.inboxSelectedIds = [];
    state.inboxVisitReadIds = [];
    state.delegators = [];
    state.myDelegations = [];
    state.delegationCandidates = [];
    state.settingsMetadataLoaded = false;
    state.settingsMetadataLoading = false;
    state.actingAsUserId = "";
    resetAuditFilters();
  }

  function resetFilters() {
    const nextFilters = {
      user: defaultFilterUser(state, isStaff),
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
    state.filters = nextFilters;
    state.expenseFilters = {
      ...nextFilters,
      user: resolveExpenseFilterUser(nextFilters.user),
    };
  }

  function cloneEntriesFilterState(source) {
    const next = source || {};
    return {
      user: String(next.user || ""),
      client: String(next.client || ""),
      project: String(next.project || ""),
      from: String(next.from || ""),
      to: String(next.to || ""),
      search: String(next.search || ""),
    };
  }

  function resolveTimeFilterUser(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const byId = getUserById?.(raw);
    if (byId?.displayName) return byId.displayName;
    const byName = getUserByDisplayName?.(raw);
    if (byName?.displayName) return byName.displayName;
    return raw;
  }

  function resolveExpenseFilterUser(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const byId = getUserById?.(raw);
    if (byId?.id) return byId.id;
    const byName = getUserByDisplayName?.(raw);
    if (byName?.id) return byName.id;
    return "";
  }

  function setExpenseFilterPickerValue(kind, isoDate) {
    const refsForKind = expenseFilterDateRefs(kind);
    if (!refsForKind.month || !refsForKind.day || !refsForKind.year) {
      return;
    }
    if (isValidDateString(isoDate)) {
      const [year, month, day] = String(isoDate).split("-");
      refsForKind.month.value = month;
      refsForKind.day.value = day;
      refsForKind.year.value = year;
      return;
    }
    refsForKind.month.value = "";
    refsForKind.day.value = "";
    refsForKind.year.value = "";
  }

  function syncSharedEntriesFilterForms() {
    const timeFilters = cloneEntriesFilterState(state.filters);
    const expenseFilters = cloneEntriesFilterState(state.expenseFilters);
    if (refs.filterForm) {
      const userField = field(refs.filterForm, "user");
      const clientField = field(refs.filterForm, "client");
      const projectField = field(refs.filterForm, "project");
      const fromField = field(refs.filterForm, "from");
      const toField = field(refs.filterForm, "to");
      const searchField = field(refs.filterForm, "search");
      syncFilterCatalogsUI(timeFilters);
      if (userField) userField.value = timeFilters.user;
      if (clientField) clientField.value = timeFilters.client;
      if (projectField) projectField.value = timeFilters.project;
      if (fromField) fromField.value = formatDisplayDate(timeFilters.from);
      if (toField) toField.value = formatDisplayDate(timeFilters.to);
      if (searchField) searchField.value = timeFilters.search;
      syncEntriesDateRangeField(refs.filterDateRange, timeFilters.from, timeFilters.to);
      syncFilterDatePicker({ refs, isValidDateString, escapeHtml }, "from", timeFilters.from);
      syncFilterDatePicker({ refs, isValidDateString, escapeHtml }, "to", timeFilters.to);
    }
    if (refs.expenseFilterForm) {
      const userField = field(refs.expenseFilterForm, "user");
      const clientField = field(refs.expenseFilterForm, "client");
      const projectField = field(refs.expenseFilterForm, "project");
      const fromField = field(refs.expenseFilterForm, "from");
      const toField = field(refs.expenseFilterForm, "to");
      const searchField = field(refs.expenseFilterForm, "search");
      syncExpenseFilterCatalogsUI(expenseFilters);
      if (userField) userField.value = expenseFilters.user;
      if (clientField) clientField.value = expenseFilters.client;
      if (projectField) projectField.value = expenseFilters.project;
      if (fromField) fromField.value = formatDisplayDate(expenseFilters.from);
      if (toField) toField.value = formatDisplayDate(expenseFilters.to);
      if (searchField) searchField.value = expenseFilters.search;
      syncEntriesDateRangeField(refs.expenseFilterDateRange, expenseFilters.from, expenseFilters.to);
      setExpenseFilterPickerValue("from", expenseFilters.from);
      setExpenseFilterPickerValue("to", expenseFilters.to);
    }
  }

  function syncSharedEntriesFiltersFromTime() {
    const base = cloneEntriesFilterState(state.filters);
    state.filters = {
      ...base,
      user: resolveTimeFilterUser(base.user),
    };
    state.expenseFilters = {
      ...base,
      user: resolveExpenseFilterUser(base.user),
    };
    syncSharedEntriesFilterForms();
  }

  function syncSharedEntriesFiltersFromExpense() {
    const base = cloneEntriesFilterState(state.expenseFilters);
    state.expenseFilters = {
      ...base,
      user: resolveExpenseFilterUser(base.user),
    };
    state.filters = {
      ...base,
      user: resolveTimeFilterUser(base.user),
    };
    syncSharedEntriesFilterForms();
  }

  function resetAuditFilters() {
    state.auditFilters = {
      entity: "",
      action: "",
      actor: "",
      beginDate: "",
      endDate: "",
      category: "",
    };
    syncAuditDateRangeField("", "");
  }

  async function loadPersistentState() {
    try {
      // Use the full state payload (same as bootstrap) so derived state like users,
      // departments, and settingsAccess stays in sync after mutations.
      const payload = await requestJson(STATE_API_PATH, {
        method: "GET",
      });
      applyLoadedState(payload);
      window.state = state;
      return true;
    } catch (error) {
      if (error.status === 401) {
        persistSessionToken("");
        state.bootstrapRequired = Boolean(error.payload?.bootstrapRequired);
        state.currentUser = null;
        state.users = [];
        state.inactiveUsers = [];
        state.clients = [];
        state.entries = [];
        state.deletedEntries = [];
        state.deletedExpenses = [];
        state.deletedFilters = {
          user: "",
          client: "",
          project: "",
          from: "",
          to: "",
          search: "",
        };
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
        state.projects = [];
        state.notificationRules = [];
        state.departmentLeadAssignments = [];
        state.utilizationScope = null;
        state.utilizationUsers = [];
        state.utilizationEntries = [];
        state.inboxItems = [];
        state.inboxFilter = "all";
        state.inboxSelectedIds = [];
        state.inboxVisitReadIds = [];
        state.delegators = [];
        state.myDelegations = [];
        state.delegationCandidates = [];
        state.settingsMetadataLoaded = false;
        state.settingsMetadataLoading = false;
        state.actingAsUserId = "";
        state.clientEditor = null;
        state.assignments = {
          managerClients: [],
          managerProjects: [],
          projectMembers: [],
        };
        state.projectMemberBudgets = [];
        return true;
      }

      throw error;
    }
  }

  async function loadSettingsMetadata(force = false, options = {}) {
    if (!state.currentUser) return;
    if (state.settingsMetadataLoading) return;
    if (!force && state.settingsMetadataLoaded) return;
    const deferRender = Boolean(options?.deferRender);
    state.settingsMetadataLoading = true;
    if (!deferRender) {
      render();
    }
    try {
      const payload = await requestJson(`${STATE_API_PATH}?settings_meta=1`, {
        method: "GET",
      });
      const mergedPayload = {
        ...payload,
        currentUser: payload?.currentUser ?? state.currentUser,
        users: Array.isArray(payload?.users) ? payload.users : state.users,
        bootstrapRequired:
          typeof payload?.bootstrapRequired === "boolean"
            ? payload.bootstrapRequired
            : state.bootstrapRequired,
        catalog: payload?.catalog ?? state.catalog,
        clients: Array.isArray(payload?.clients) ? payload.clients : state.clients,
        entries: Array.isArray(payload?.entries) ? payload.entries : state.entries,
        expenses: Array.isArray(payload?.expenses) ? payload.expenses : state.expenses,
        assignments: payload?.assignments ?? state.assignments,
        projectMemberBudgets: Array.isArray(payload?.projectMemberBudgets)
          ? payload.projectMemberBudgets
          : state.projectMemberBudgets,
        levelLabels: payload?.levelLabels ?? state.levelLabels,
        permissionRoles: Array.isArray(payload?.permissionRoles)
          ? payload.permissionRoles
          : state.permissionRoles,
        rolePermissions: Array.isArray(payload?.rolePermissions)
          ? payload.rolePermissions
          : state.rolePermissions,
        expenseCategories: Array.isArray(payload?.expenseCategories)
          ? payload.expenseCategories
          : state.expenseCategories,
        projectExpenseCategories: Array.isArray(payload?.projectExpenseCategories)
          ? payload.projectExpenseCategories
          : state.projectExpenseCategories,
        projectPlannedExpenses: Array.isArray(payload?.projectPlannedExpenses)
          ? payload.projectPlannedExpenses
          : state.projectPlannedExpenses,
        targetRealizations: Array.isArray(payload?.targetRealizations)
          ? payload.targetRealizations
          : state.targetRealizations,
        departmentLeadAssignments: Array.isArray(payload?.departmentLeadAssignments)
          ? payload.departmentLeadAssignments
          : state.departmentLeadAssignments,
        utilizationScope: Object.prototype.hasOwnProperty.call(payload || {}, "utilizationScope")
          ? payload.utilizationScope
          : state.utilizationScope,
        utilizationUsers: Object.prototype.hasOwnProperty.call(payload || {}, "utilizationUsers")
          ? payload.utilizationUsers
          : state.utilizationUsers,
        utilizationEntries: Object.prototype.hasOwnProperty.call(payload || {}, "utilizationEntries")
          ? payload.utilizationEntries
          : state.utilizationEntries,
        corporateFunctionGroups: Array.isArray(payload?.corporateFunctionGroups)
          ? payload.corporateFunctionGroups
          : state.corporateFunctionGroups,
        corporateFunctionCategories: Array.isArray(payload?.corporateFunctionCategories)
          ? payload.corporateFunctionCategories
          : state.corporateFunctionCategories,
        account: payload?.account ?? state.account,
        settingsAccess: payload?.settingsAccess ?? state.settingsAccess,
        notificationRules: Array.isArray(payload?.notificationRules)
          ? payload.notificationRules
          : state.notificationRules,
        inboxItems: Array.isArray(payload?.inboxItems) ? payload.inboxItems : state.inboxItems,
        permissions: payload?.permissions ?? state.permissions,
        delegators: Array.isArray(payload?.delegators) ? payload.delegators : state.delegators,
        projects: Array.isArray(payload?.projects) ? payload.projects : state.projects,
        visibleClientIds: Array.isArray(payload?.visibleClientIds)
          ? payload.visibleClientIds
          : state.visibleClientIds,
        visibleProjectIds: Array.isArray(payload?.visibleProjectIds)
          ? payload.visibleProjectIds
          : state.visibleProjectIds,
      };
      applyLoadedState(mergedPayload);
      window.state = state;
    } catch (error) {
      feedback(error.message || "Unable to load settings data.", true);
      state.settingsMetadataLoading = false;
      if (!deferRender) {
        render();
      }
      return;
    }
    state.settingsMetadataLoading = false;
    render();
  }

  const SETTINGS_SAVE_FAST_MUTATE_OPTIONS = Object.freeze({
    skipHydrate: true,
    returnState: false,
    skipSettingsMetadataReload: true,
  });

  function settingsSaveFastOptions(overrides = {}) {
    return { ...SETTINGS_SAVE_FAST_MUTATE_OPTIONS, ...(overrides || {}) };
  }

  function isSaveTraceEnabled() {
    try {
      if (window.__TS_SAVE_TRACE__ === true) return true;
      return window.localStorage.getItem("timesheet.saveTrace") === "1";
    } catch (error) {
      return false;
    }
  }

  function logSaveTrace(action, phase, startedAt) {
    if (!isSaveTraceEnabled()) return;
    const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
    console.log(`[save-trace] ${action} :: ${phase} (+${elapsedMs}ms)`);
  }

  async function mutatePersistentState(action, payload, options = {}) {
    const startedAt = performance.now();
    const {
      skipHydrate,
      refreshState,
      returnState,
      skipSettingsMetadataReload,
      awaitSettingsMetadataReload,
    } = options;
    const requestPayload = {
      action,
      payload,
    };
    logSaveTrace(action, "request-started", startedAt);
    if (returnState === false) {
      requestPayload.returnState = false;
    }
    const result = await requestJson(MUTATE_API_PATH, {
      method: "POST",
      body: JSON.stringify(requestPayload),
    });
    logSaveTrace(action, "response-received", startedAt);
    const canHydrateFromResult = !skipHydrate && result && result.currentUser;
    if (canHydrateFromResult) {
      logSaveTrace(action, "hydrate-start", startedAt);
      applyLoadedState(result);
      render();
      logSaveTrace(action, "hydrate-end", startedAt);
    }
    if (refreshState || (!skipHydrate && !canHydrateFromResult)) {
      logSaveTrace(action, "state-refresh-start", startedAt);
      await loadPersistentState();
      render();
      logSaveTrace(action, "state-refresh-end", startedAt);
    }
    if (!skipSettingsMetadataReload && state.currentView === "settings" && state.currentUser) {
      logSaveTrace(action, "settings-metadata-reload-start", startedAt);
      const settingsReload = loadSettingsMetadata(true, { deferRender: true });
      if (awaitSettingsMetadataReload) {
        await settingsReload;
        logSaveTrace(action, "settings-metadata-reload-end", startedAt);
      } else {
        settingsReload
          .then(() => {
            logSaveTrace(action, "settings-metadata-reload-end", startedAt);
          })
          .catch(() => {});
      }
    }
    logSaveTrace(action, "completed", startedAt);
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

  function beginInboxVisit() {
    state.inboxVisitReadIds = (state.inboxItems || [])
      .filter((item) => item && !item.isRead)
      .map((item) => `${item.id || ""}`.trim())
      .filter(Boolean);
  }

  function commitInboxVisitRead() {
    const unreadIds = Array.from(
      new Set((state.inboxVisitReadIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean))
    );
    state.inboxVisitReadIds = [];
    if (!unreadIds.length) return;

    const unreadSet = new Set(unreadIds);
    state.inboxItems = (state.inboxItems || []).map((item) => {
      if (!item || !unreadSet.has(`${item.id || ""}`.trim())) return item;
      return { ...item, isRead: true };
    });

    mutatePersistentState("mark_inbox_items_read", { ids: unreadIds }, { skipHydrate: true, returnState: false }).catch(() => {});
  }

  function clearEntrySelection() {
    state.selectedEntryIds = new Set();
  }

  function setEntriesSelectionMode(enabled) {
    const shouldEnable = Boolean(enabled);
    state.entriesSelectionMode = shouldEnable;
    if (!shouldEnable) {
      clearEntrySelection();
    }
  }

  function visibleEntryIds() {
    return currentEntries()
      .map((entry) => `${entry?.id || ""}`.trim())
      .filter(Boolean);
  }

  function selectedVisibleEntryIds(visibleIds) {
    const selectedSet = state.selectedEntryIds instanceof Set ? state.selectedEntryIds : new Set();
    return (visibleIds || []).filter((id) => selectedSet.has(id));
  }

  function syncEntriesSelectionControls(filteredEntries) {
    const visibleIds = Array.isArray(filteredEntries)
      ? filteredEntries.map((entry) => `${entry?.id || ""}`.trim()).filter(Boolean)
      : visibleEntryIds();
    const visibleSet = new Set(visibleIds);
    const selectedSet = state.selectedEntryIds instanceof Set ? state.selectedEntryIds : new Set();
    const prunedSelected = new Set(Array.from(selectedSet).filter((id) => visibleSet.has(id)));
    state.selectedEntryIds = prunedSelected;

    const selectedCount = prunedSelected.size;
    const isSelectionMode = Boolean(state.entriesSelectionMode);

    if (refs.entriesSelectHeader) {
      refs.entriesSelectHeader.hidden = !isSelectionMode;
    }
    if (refs.entriesSelectAllVisible) {
      refs.entriesSelectAllVisible.hidden = !isSelectionMode;
      refs.entriesSelectAllVisible.checked =
        isSelectionMode && visibleIds.length > 0 && selectedCount === visibleIds.length;
      refs.entriesSelectAllVisible.indeterminate =
        isSelectionMode &&
        selectedCount > 0 &&
        selectedCount < visibleIds.length;
      refs.entriesSelectAllVisible.disabled = !isSelectionMode || visibleIds.length === 0;
    }

    if (refs.entriesSelectToggle) {
      refs.entriesSelectToggle.hidden = isSelectionMode;
    }
    if (refs.entriesDeleteSelected) {
      refs.entriesDeleteSelected.hidden = !isSelectionMode;
      refs.entriesDeleteSelected.disabled = selectedCount === 0;
      refs.entriesDeleteSelected.textContent =
        selectedCount > 0 ? `Delete Selected (${selectedCount})` : "Delete Selected";
    }
    if (refs.entriesSelectCancel) {
      refs.entriesSelectCancel.hidden = !isSelectionMode;
    }
  }

  function syncEntriesUndoUi() {
    const timeUndo = state.lastTimeDeleteUndo;
    const expenseUndo = state.lastExpenseDeleteUndo;

    if (refs.entriesUndoBar && refs.entriesUndoMessage) {
      if (timeUndo && Array.isArray(timeUndo.ids) && timeUndo.ids.length) {
        const count = Number(timeUndo.count || timeUndo.ids.length) || 0;
        refs.entriesUndoMessage.textContent =
          `Deleted ${count} time entr${count === 1 ? "y" : "ies"}.`;
        refs.entriesUndoBar.hidden = false;
      } else {
        refs.entriesUndoMessage.textContent = "";
        refs.entriesUndoBar.hidden = true;
      }
    }

    if (refs.expensesUndoBar && refs.expensesUndoMessage) {
      if (expenseUndo && Array.isArray(expenseUndo.ids) && expenseUndo.ids.length) {
        const count = Number(expenseUndo.count || expenseUndo.ids.length) || 0;
        refs.expensesUndoMessage.textContent =
          `Deleted ${count} expense${count === 1 ? "" : "s"}.`;
        refs.expensesUndoBar.hidden = false;
      } else {
        refs.expensesUndoMessage.textContent = "";
        refs.expensesUndoBar.hidden = true;
      }
    }
  }

  async function undoDeletedEntries() {
    const undo = state.lastTimeDeleteUndo;
    const ids = Array.isArray(undo?.ids) ? undo.ids : [];
    const rows = Array.isArray(undo?.rows) ? undo.rows : [];
    if (!ids.length) return;
    try {
      await mutatePersistentState(
        "restore_entries",
        { entryIds: ids },
        { skipHydrate: true, refreshState: false, returnState: false }
      );
    } catch (error) {
      feedback(error.message || "Unable to undo deleted time entries.", true);
      return;
    }

    const restoredById = new Map(rows.map((row) => [`${row?.id || ""}`.trim(), row]));
    const existing = Array.isArray(state.entries) ? state.entries.slice() : [];
    const existingIds = new Set(existing.map((row) => `${row?.id || ""}`.trim()).filter(Boolean));
    const merged = existing.slice();
    for (const id of ids) {
      if (!id || existingIds.has(id)) continue;
      const row = restoredById.get(id);
      if (row) merged.push({ ...row });
    }
    state.entries = merged;
    removeDeletedRowsFromState("time", ids);
    state.lastTimeDeleteUndo = null;
    feedback("Time entries restored.", false);
    render();
  }

  async function deleteSelectedEntries() {
    const visibleIds = visibleEntryIds();
    const selectedIds = selectedVisibleEntryIds(visibleIds);
    const count = selectedIds.length;
    if (!count) {
      return;
    }
    const selectedEntries = (state.entries || []).filter((entry) =>
      selectedIds.includes(`${entry?.id || ""}`.trim())
    );
    if (selectedEntries.some((entry) => hasDeactivatedOrRemovedClientProject(entry))) {
      await showDeactivatedClientProjectPrompt();
      return;
    }

    const result = await appDialog({
      title: "Delete entries",
      message: `Delete ${count} entr${count === 1 ? "y" : "ies"}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!result?.confirmed) {
      return;
    }

    try {
      await mutatePersistentState(
        "delete_entries_bulk",
        { entryIds: selectedIds },
        { skipHydrate: true, refreshState: false, returnState: false }
      );
    } catch (error) {
      if (isDeactivatedClientProjectErrorMessage(error?.message)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
      feedback(error.message || "Unable to delete selected entries.", true);
      return;
    }

    const deletedSet = new Set(selectedIds);
    const deletedRows = (state.entries || []).filter((entry) =>
      deletedSet.has(`${entry?.id || ""}`.trim())
    );
    state.entries = (state.entries || []).filter(
      (entry) => !deletedSet.has(`${entry?.id || ""}`.trim())
    );
    if (state.editingId && deletedSet.has(`${state.editingId}`.trim())) {
      resetForm();
    }
    setEntriesSelectionMode(false);
    state.lastTimeDeleteUndo = {
      ids: selectedIds.slice(),
      rows: deletedRows.map((row) => ({ ...row })),
      count,
    };
    addDeletedRowsToState("time", deletedRows);
    syncEntriesUndoUi();
    feedback("", false);
    render();
  }

  function clearExpenseSelection() {
    state.selectedExpenseIds = new Set();
  }

  function setExpensesSelectionMode(enabled) {
    const shouldEnable = Boolean(enabled);
    state.expensesSelectionMode = shouldEnable;
    if (!shouldEnable) {
      clearExpenseSelection();
    }
  }

  function visibleExpenseIds() {
    return currentExpenses()
      .map((expense) => `${expense?.id || ""}`.trim())
      .filter(Boolean);
  }

  function selectedVisibleExpenseIds(visibleIds) {
    const selectedSet = state.selectedExpenseIds instanceof Set ? state.selectedExpenseIds : new Set();
    return (visibleIds || []).filter((id) => selectedSet.has(id));
  }

  function syncExpenseSelectionControls(filteredExpenses) {
    const visibleIds = Array.isArray(filteredExpenses)
      ? filteredExpenses.map((expense) => `${expense?.id || ""}`.trim()).filter(Boolean)
      : visibleExpenseIds();
    const visibleSet = new Set(visibleIds);
    const selectedSet = state.selectedExpenseIds instanceof Set ? state.selectedExpenseIds : new Set();
    const prunedSelected = new Set(Array.from(selectedSet).filter((id) => visibleSet.has(id)));
    state.selectedExpenseIds = prunedSelected;

    const selectedCount = prunedSelected.size;
    const isSelectionMode = Boolean(state.expensesSelectionMode);

    if (refs.expensesSelectHeader) {
      refs.expensesSelectHeader.hidden = !isSelectionMode;
    }
    if (refs.expensesSelectAllVisible) {
      refs.expensesSelectAllVisible.hidden = !isSelectionMode;
      refs.expensesSelectAllVisible.checked =
        isSelectionMode && visibleIds.length > 0 && selectedCount === visibleIds.length;
      refs.expensesSelectAllVisible.indeterminate =
        isSelectionMode &&
        selectedCount > 0 &&
        selectedCount < visibleIds.length;
      refs.expensesSelectAllVisible.disabled = !isSelectionMode || visibleIds.length === 0;
    }
    if (refs.expensesSelectToggle) {
      refs.expensesSelectToggle.hidden = isSelectionMode;
    }
    if (refs.expensesDeleteSelected) {
      refs.expensesDeleteSelected.hidden = !isSelectionMode;
      refs.expensesDeleteSelected.disabled = selectedCount === 0;
      refs.expensesDeleteSelected.textContent =
        selectedCount > 0 ? `Delete Selected (${selectedCount})` : "Delete Selected";
    }
    if (refs.expensesSelectCancel) {
      refs.expensesSelectCancel.hidden = !isSelectionMode;
    }
  }

  async function undoDeletedExpenses() {
    const undo = state.lastExpenseDeleteUndo;
    const ids = Array.isArray(undo?.ids) ? undo.ids : [];
    const rows = Array.isArray(undo?.rows) ? undo.rows : [];
    if (!ids.length) return;
    try {
      await mutatePersistentState(
        "restore_expenses",
        { expenseIds: ids },
        { skipHydrate: true, refreshState: false, returnState: false }
      );
    } catch (error) {
      feedback(error.message || "Unable to undo deleted expenses.", true);
      return;
    }

    const restoredById = new Map(rows.map((row) => [`${row?.id || ""}`.trim(), row]));
    const existing = Array.isArray(state.expenses) ? state.expenses.slice() : [];
    const existingIds = new Set(existing.map((row) => `${row?.id || ""}`.trim()).filter(Boolean));
    const merged = existing.slice();
    for (const id of ids) {
      if (!id || existingIds.has(id)) continue;
      const row = restoredById.get(id);
      if (row) merged.push({ ...row });
    }
    state.expenses = merged;
    removeDeletedRowsFromState("expense", ids);
    state.lastExpenseDeleteUndo = null;
    feedback("Expenses restored.", false);
    render();
  }

  async function deleteSelectedExpenses() {
    const visibleIds = visibleExpenseIds();
    const selectedIds = selectedVisibleExpenseIds(visibleIds);
    const count = selectedIds.length;
    if (!count) {
      return;
    }
    const selectedExpenses = (state.expenses || []).filter((expense) =>
      selectedIds.includes(`${expense?.id || ""}`.trim())
    );
    if (selectedExpenses.some((expense) => hasDeactivatedOrRemovedClientProject(expense))) {
      await showDeactivatedClientProjectPrompt();
      return;
    }

    const result = await appDialog({
      title: "Delete expenses",
      message: `Delete ${count} expense${count === 1 ? "" : "s"}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!result?.confirmed) {
      return;
    }

    try {
      await mutatePersistentState(
        "delete_expenses_bulk",
        { expenseIds: selectedIds },
        { skipHydrate: true, refreshState: false, returnState: false }
      );
    } catch (error) {
      if (isDeactivatedClientProjectErrorMessage(error?.message)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
      feedback(error.message || "Unable to delete selected expenses.", true);
      return;
    }

    const deletedSet = new Set(selectedIds);
    const deletedRows = (state.expenses || []).filter((expense) =>
      deletedSet.has(`${expense?.id || ""}`.trim())
    );
    state.expenses = (state.expenses || []).filter(
      (expense) => !deletedSet.has(`${expense?.id || ""}`.trim())
    );
    if (state.expenseEditingId && deletedSet.has(`${state.expenseEditingId}`.trim())) {
      resetExpenseForm();
    }
    setExpensesSelectionMode(false);
    state.lastExpenseDeleteUndo = {
      ids: selectedIds.slice(),
      rows: deletedRows.map((row) => ({ ...row })),
      count,
    };
    addDeletedRowsToState("expense", deletedRows);
    syncEntriesUndoUi();
    feedback("", false);
    render();
  }

  function deletedItemKey(type, id) {
    const normalizedType = `${type || ""}`.trim().toLowerCase();
    const normalizedId = `${id || ""}`.trim();
    return normalizedType && normalizedId ? `${normalizedType}:${normalizedId}` : "";
  }

  function normalizeDeletedFilterState(input) {
    const base = input && typeof input === "object" ? input : {};
    return {
      user: `${base.user || ""}`.trim(),
      client: `${base.client || ""}`.trim(),
      project: `${base.project || ""}`.trim(),
      from: isValidDateString(base.from) ? base.from : "",
      to: isValidDateString(base.to) ? base.to : "",
      search: `${base.search || ""}`.trim(),
    };
  }

  function deletedItemUserName(item) {
    if (!item) return "";
    if (`${item.itemType || ""}`.trim() === "expense") {
      return (
        `${userNameById(item?.userId) || ""}`.trim() ||
        `${item?.user || ""}`.trim() ||
        `${item?.userId || ""}`.trim()
      );
    }
    return `${item?.user || ""}`.trim();
  }

  function deletedItemIsoDate(item) {
    if (!item) return "";
    if (`${item.itemType || ""}`.trim() === "expense") {
      return normalizeIsoDateValue(String(item?.expenseDate || "").trim());
    }
    return normalizeIsoDateValue(String(item?.date || "").trim());
  }

  function syncDeletedFilterOptions() {
    if (!refs.deletedFilterForm) return;
    const draftFilters = normalizeDeletedFilterState({
      ...state.deletedFilters,
      user: `${refs.deletedFilterUser?.value || state.deletedFilters.user || ""}`.trim(),
      client: `${refs.deletedFilterClient?.value || state.deletedFilters.client || ""}`.trim(),
      project: `${refs.deletedFilterProject?.value || state.deletedFilters.project || ""}`.trim(),
    });
    const sourceItems =
      state.deletedItemsView === "expense"
        ? (state.deletedExpenses || []).map((item) => ({ ...item, itemType: "expense" }))
        : (state.deletedEntries || []).map((item) => ({ ...item, itemType: "time" }));
    const users = Array.from(
      new Set(
        sourceItems
          .map((item) => deletedItemUserName(item))
          .map((name) => `${name || ""}`.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    const userFilteredItems = draftFilters.user
      ? sourceItems.filter(
          (item) => deletedItemUserName(item).toLowerCase() === draftFilters.user.toLowerCase()
        )
      : sourceItems;
    const clients = Array.from(
      new Set(
        userFilteredItems
          .map((item) =>
            `${item.itemType === "expense" ? item?.clientName : item?.client || ""}`.trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    const clientFilteredItems = draftFilters.client
      ? userFilteredItems.filter(
          (item) =>
            `${item.itemType === "expense" ? item?.clientName : item?.client || ""}`
              .trim()
              .toLowerCase() === draftFilters.client.toLowerCase()
        )
      : userFilteredItems;
    const projects = Array.from(
      new Set(
        clientFilteredItems
          .map((item) =>
            `${item.itemType === "expense" ? item?.projectName : item?.project || ""}`.trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const writeOptions = (select, values, placeholder) => {
      if (!select) return;
      const current = `${select.value || ""}`.trim();
      select.innerHTML = [
        `<option value="">${escapeHtml(placeholder)}</option>`,
        ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
      ].join("");
      select.value = values.includes(current) ? current : "";
    };

    writeOptions(refs.deletedFilterUser, users, "All users");
    writeOptions(refs.deletedFilterClient, clients, "All clients");
    writeOptions(refs.deletedFilterProject, projects, "All projects");
  }

  function renderDeletedFilterState(items) {
    if (!refs.deletedActiveFilters) return;
    const filters = normalizeDeletedFilterState(state.deletedFilters);
    const chips = [];
    if (filters.user) chips.push(`User: ${filters.user}`);
    if (filters.client) chips.push(`Client: ${filters.client}`);
    if (filters.project) chips.push(`Project: ${filters.project}`);
    if (filters.from || filters.to) {
      chips.push(
        `Date: ${filters.from ? formatDisplayDate(filters.from) : "Any"} - ${
          filters.to ? formatDisplayDate(filters.to) : "Any"
        }`
      );
    }
    if (filters.search) chips.push(`Search: ${filters.search}`);
    if (!chips.length) {
      refs.deletedActiveFilters.hidden = true;
      refs.deletedActiveFilters.innerHTML = "";
      return;
    }
    refs.deletedActiveFilters.hidden = false;
    refs.deletedActiveFilters.innerHTML = chips
      .map((text) => `<span class="chip">${escapeHtml(text)}</span>`)
      .join("");
  }

  function applyDeletedFiltersFromForm(options) {
    if (!refs.deletedFilterForm) return false;
    const showErrors = (options && options.showErrors) !== false;
    const user = `${field(refs.deletedFilterForm, "user")?.value || ""}`.trim();
    const client = `${field(refs.deletedFilterForm, "client")?.value || ""}`.trim();
    const project = `${field(refs.deletedFilterForm, "project")?.value || ""}`.trim();
    const fromRaw = getDateInputIsoValue(field(refs.deletedFilterForm, "from"));
    const toRaw = getDateInputIsoValue(field(refs.deletedFilterForm, "to"));
    const search = `${field(refs.deletedFilterForm, "search")?.value || ""}`.trim();
    if (fromRaw && !isValidDateString(fromRaw)) {
      if (showErrors) feedback("From date is invalid.", true);
      return false;
    }
    if (toRaw && !isValidDateString(toRaw)) {
      if (showErrors) feedback("To date is invalid.", true);
      return false;
    }
    if (fromRaw && toRaw && fromRaw > toRaw) {
      if (showErrors) feedback("From date cannot be after To date.", true);
      return false;
    }
    state.deletedFilters = normalizeDeletedFilterState({
      user,
      client,
      project,
      from: fromRaw,
      to: toRaw,
      search,
    });
    setDateInputIsoValue(refs.deletedFilterFrom, state.deletedFilters.from);
    setDateInputIsoValue(refs.deletedFilterTo, state.deletedFilters.to);
    feedback("", false);
    render();
    return true;
  }

  function combinedDeletedItems() {
    const deletedItemsView =
      state.deletedItemsView === "expense"
        ? "expense"
        : state.deletedItemsView === "all"
        ? "all"
        : "time";
    const filters = normalizeDeletedFilterState(state.deletedFilters);
    const timeItems = (state.deletedEntries || []).map((item) => ({
      ...item,
      itemType: "time",
      itemId: `${item?.id || ""}`.trim(),
    }));
    const expenseItems = (state.deletedExpenses || []).map((item) => ({
      ...item,
      itemType: "expense",
      itemId: `${item?.id || ""}`.trim(),
    }));
    const merged =
      deletedItemsView === "expense"
        ? expenseItems
        : deletedItemsView === "all"
        ? [...timeItems, ...expenseItems]
        : timeItems;
    return merged
      .filter((item) => {
        const name = deletedItemUserName(item).toLowerCase();
        const client = `${item?.itemType === "expense" ? item?.clientName : item?.client || ""}`.trim().toLowerCase();
        const project = `${item?.itemType === "expense" ? item?.projectName : item?.project || ""}`.trim().toLowerCase();
        const isoDate = deletedItemIsoDate(item);
        const searchHaystack = [
          name,
          client,
          project,
          `${item?.category || ""}`.trim().toLowerCase(),
          `${item?.notes || ""}`.trim().toLowerCase(),
        ].join(" ");
        if (filters.user && name !== filters.user.toLowerCase()) return false;
        if (filters.client && client !== filters.client.toLowerCase()) return false;
        if (filters.project && project !== filters.project.toLowerCase()) return false;
        if (filters.from && (!isoDate || isoDate < filters.from)) return false;
        if (filters.to && (!isoDate || isoDate > filters.to)) return false;
        if (filters.search && !searchHaystack.includes(filters.search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
      const left = `${a?.deletedAt || ""}`;
      const right = `${b?.deletedAt || ""}`;
      if (left === right) {
        return `${b?.itemId || ""}`.localeCompare(`${a?.itemId || ""}`);
      }
      return right.localeCompare(left);
    });
  }

  function addDeletedRowsToState(itemType, rows) {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) return;
    const nowIso = new Date().toISOString();
    if (itemType === "time") {
      const existing = Array.isArray(state.deletedEntries) ? state.deletedEntries : [];
      const nextMap = new Map();
      list.forEach((row) => {
        const id = `${row?.id || ""}`.trim();
        if (!id) return;
        nextMap.set(id, {
          ...row,
          deletedAt: row?.deletedAt || row?.deleted_at || nowIso,
        });
      });
      existing.forEach((row) => {
        const id = `${row?.id || ""}`.trim();
        if (!id || nextMap.has(id)) return;
        nextMap.set(id, row);
      });
      state.deletedEntries = Array.from(nextMap.values());
      return;
    }
    if (itemType === "expense") {
      const existing = Array.isArray(state.deletedExpenses) ? state.deletedExpenses : [];
      const nextMap = new Map();
      list.forEach((row) => {
        const id = `${row?.id || ""}`.trim();
        if (!id) return;
        nextMap.set(id, {
          ...row,
          deletedAt: row?.deletedAt || row?.deleted_at || nowIso,
        });
      });
      existing.forEach((row) => {
        const id = `${row?.id || ""}`.trim();
        if (!id || nextMap.has(id)) return;
        nextMap.set(id, row);
      });
      state.deletedExpenses = Array.from(nextMap.values());
    }
  }

  function removeDeletedRowsFromState(itemType, ids) {
    const idSet = new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => `${id || ""}`.trim())
        .filter(Boolean)
    );
    if (!idSet.size) return;
    if (itemType === "time") {
      state.deletedEntries = (state.deletedEntries || []).filter(
        (row) => !idSet.has(`${row?.id || ""}`.trim())
      );
      return;
    }
    if (itemType === "expense") {
      state.deletedExpenses = (state.deletedExpenses || []).filter(
        (row) => !idSet.has(`${row?.id || ""}`.trim())
      );
    }
  }

  async function loadDeletedItems() {
    if (state.deletedItemsLoading) return;
    state.deletedItemsLoading = true;
    try {
      const payload = await mutatePersistentState(
        "list_deleted_items",
        {},
        { skipHydrate: true, refreshState: false, returnState: false }
      );
      state.deletedEntries = Array.isArray(payload?.deletedEntries) ? payload.deletedEntries : [];
      state.deletedExpenses = Array.isArray(payload?.deletedExpenses) ? payload.deletedExpenses : [];
    } catch (error) {
      feedback(error.message || "Unable to load deleted items.", true);
    } finally {
      state.deletedItemsLoading = false;
    }
  }

  function syncDeletedSelectionControls(items) {
    const visibleItems = Array.isArray(items) ? items : combinedDeletedItems();
    const visibleKeys = visibleItems
      .map((item) => deletedItemKey(item?.itemType, item?.itemId))
      .filter(Boolean);
    const visibleKeySet = new Set(visibleKeys);
    const selectedSet = state.selectedDeletedKeys instanceof Set ? state.selectedDeletedKeys : new Set();
    const pruned = new Set(Array.from(selectedSet).filter((key) => visibleKeySet.has(key)));
    state.selectedDeletedKeys = pruned;

    const selectedCount = pruned.size;
    const isSelectionMode = Boolean(state.deletedSelectionMode);

    if (refs.deletedSelectHeader) {
      refs.deletedSelectHeader.hidden = !isSelectionMode;
    }
    if (refs.deletedSelectAllVisible) {
      refs.deletedSelectAllVisible.hidden = !isSelectionMode;
      refs.deletedSelectAllVisible.checked =
        isSelectionMode && visibleKeys.length > 0 && selectedCount === visibleKeys.length;
      refs.deletedSelectAllVisible.indeterminate =
        isSelectionMode && selectedCount > 0 && selectedCount < visibleKeys.length;
      refs.deletedSelectAllVisible.disabled = !isSelectionMode || visibleKeys.length === 0;
    }
    if (refs.deletedSelectToggle) {
      refs.deletedSelectToggle.hidden = isSelectionMode;
    }
    if (refs.deletedRestoreSelected) {
      refs.deletedRestoreSelected.hidden = !isSelectionMode;
      refs.deletedRestoreSelected.disabled = selectedCount === 0;
      refs.deletedRestoreSelected.textContent =
        selectedCount > 0 ? `Restore Selected (${selectedCount})` : "Restore Selected";
    }
    if (refs.deletedSelectCancel) {
      refs.deletedSelectCancel.hidden = !isSelectionMode;
    }
  }

  async function restoreDeletedItems(itemsToRestore) {
    const items = Array.isArray(itemsToRestore) ? itemsToRestore.filter(Boolean) : [];
    if (!items.length) return;

    const timeIds = items
      .filter((item) => item.itemType === "time")
      .map((item) => `${item.itemId || ""}`.trim())
      .filter(Boolean);
    const expenseIds = items
      .filter((item) => item.itemType === "expense")
      .map((item) => `${item.itemId || ""}`.trim())
      .filter(Boolean);

    try {
      if (timeIds.length) {
        await mutatePersistentState(
          "restore_entries",
          { ids: timeIds },
          { skipHydrate: true, refreshState: false, returnState: false }
        );
      }
      if (expenseIds.length) {
        await mutatePersistentState(
          "restore_expenses",
          { ids: expenseIds },
          { skipHydrate: true, refreshState: false, returnState: false }
        );
      }
    } catch (error) {
      feedback(error.message || "Unable to restore selected items.", true);
      return;
    }

    const timeSet = new Set(timeIds);
    const expenseSet = new Set(expenseIds);
    const restoredTime = (state.deletedEntries || []).filter((item) => timeSet.has(`${item?.id || ""}`.trim()));
    const restoredExpense = (state.deletedExpenses || []).filter((item) =>
      expenseSet.has(`${item?.id || ""}`.trim())
    );
    state.deletedEntries = (state.deletedEntries || []).filter((item) => !timeSet.has(`${item?.id || ""}`.trim()));
    state.deletedExpenses = (state.deletedExpenses || []).filter(
      (item) => !expenseSet.has(`${item?.id || ""}`.trim())
    );
    if (restoredTime.length) {
      const existingIds = new Set((state.entries || []).map((item) => `${item?.id || ""}`.trim()));
      restoredTime.forEach((item) => {
        const id = `${item?.id || ""}`.trim();
        if (!id || existingIds.has(id)) return;
        state.entries.push({ ...item, deletedAt: null, deletedByUserId: null });
      });
    }
    if (restoredExpense.length) {
      const existingIds = new Set((state.expenses || []).map((item) => `${item?.id || ""}`.trim()));
      restoredExpense.forEach((item) => {
        const id = `${item?.id || ""}`.trim();
        if (!id || existingIds.has(id)) return;
        state.expenses.push({ ...item, deletedAt: null, deletedByUserId: null });
      });
    }

    state.deletedSelectionMode = false;
    state.selectedDeletedKeys = new Set();
    feedback("Items restored.", false);
    render();
  }

  async function restoreSelectedDeletedItems() {
    const items = combinedDeletedItems();
    const selectedSet = state.selectedDeletedKeys instanceof Set ? state.selectedDeletedKeys : new Set();
    const selectedItems = items.filter((item) => selectedSet.has(deletedItemKey(item.itemType, item.itemId)));
    if (!selectedItems.length) return;
    await restoreDeletedItems(selectedItems);
  }

  function renderDeletedItemsTable() {
    if (!refs.deletedItemsBody) return;
    const items = combinedDeletedItems();
    renderDeletedFilterState(items);
    syncDeletedSelectionControls(items);
    if (!items.length) {
      refs.deletedItemsBody.innerHTML = `
        <tr>
          <td colspan="${state.deletedSelectionMode ? 12 : 11}" class="empty-row">
            <div class="empty-state-panel">
              <strong>No deleted items.</strong>
              <span>Deleted time entries and expenses will appear here.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    refs.deletedItemsBody.innerHTML = items
      .map((item) => {
        const itemId = `${item?.itemId || ""}`.trim();
        const itemType = item?.itemType === "expense" ? "expense" : "time";
        const itemKey = deletedItemKey(itemType, itemId);
        const selectedSet = state.selectedDeletedKeys instanceof Set ? state.selectedDeletedKeys : new Set();
        const selectedMarkup = state.deletedSelectionMode
          ? `<td><input type="checkbox" class="entries-billable-toggle" data-action="deleted-select-item" data-type="${escapeHtml(
              itemType
            )}" data-id="${escapeHtml(itemId)}" ${selectedSet.has(itemKey) ? "checked" : ""} /></td>`
          : "";
        const valueText =
          itemType === "time"
            ? `${Number(item?.hours || 0).toFixed(2)}h`
            : `$${Number(item?.amount || 0).toFixed(2)}`;
        const deletedAtText = formatDateTimeLocal(item?.deletedAt || "");
        const description = itemType === "time"
          ? `${item?.notes || ""}`.trim() || "(No note)"
          : `${item?.category || ""}${item?.notes ? ` - ${item.notes}` : ""}`.trim() || "(No description)";
        const actionsMarkup = state.deletedSelectionMode
          ? ""
          : `<button class="text-button" type="button" data-action="deleted-restore-item" data-type="${escapeHtml(
              itemType
            )}" data-id="${escapeHtml(itemId)}">Restore</button>`;
        return `
          <tr>
            ${selectedMarkup}
            <td>${itemType === "time" ? "Time" : "Expense"}</td>
            <td>${escapeHtml(formatDisplayDateShort(itemType === "time" ? item?.date : item?.expenseDate))}</td>
            <td>${escapeHtml(itemType === "time" ? item?.user : userNameById(item?.userId))}</td>
            <td>${escapeHtml(itemType === "time" ? item?.client : item?.clientName)}</td>
            <td>${escapeHtml(itemType === "time" ? item?.project : item?.projectName)}</td>
            <td>${escapeHtml(description)}</td>
            <td>${escapeHtml(valueText)}</td>
            <td>${escapeHtml(item?.status === "approved" ? "Approved" : "Pending")}</td>
            <td>${escapeHtml(deletedAtText || "")}</td>
            <td class="actions-cell">${actionsMarkup}</td>
          </tr>
        `;
      })
      .join("");
  }

  function setView(view) {
    if (!isViewAllowed(view)) {
      view = "inputs";
    }
    const previousView = state.currentView;
    if (previousView === "entries" && view !== "entries" && state.entriesSelectionMode) {
      setEntriesSelectionMode(false);
    }
    if (previousView === "entries" && view !== "entries" && state.expensesSelectionMode) {
      setExpensesSelectionMode(false);
    }
    if (previousView === "entries" && view !== "entries" && state.deletedSelectionMode) {
      state.deletedSelectionMode = false;
      state.selectedDeletedKeys = new Set();
    }
    if (view === "inbox" && previousView !== "inbox") {
      beginInboxVisit();
    }
    if (previousView === "inbox" && view !== "inbox") {
      commitInboxVisitRead();
    }
    if (previousView !== "clients" && view === "clients") {
      state.mobileClientsView = "list";
    }
    if (previousView !== "members" && view === "members") {
      state.mobileMembersView = "list";
      usersResetDirectoryFilters?.();
    }
    state.currentView = view;
    persistCurrentView(view);
    if ((view === "settings" || view === "members") && previousView !== view && !state.settingsMetadataLoaded) {
      loadSettingsMetadata(true, { deferRender: true });
      return;
    }
    render();
  }

  window.setView = setView;

  function isMobileDrilldownViewport() {
    return window.innerWidth <= 768;
  }

  function syncClientsMobileDrilldownState() {
    if (!refs.clientsPage) return;
    const enabled = isMobileDrilldownViewport();
    if (!enabled) {
      refs.clientsPage.removeAttribute("data-mobile-drilldown");
      refs.clientsPage.removeAttribute("data-mobile-view");
      const staleBack = refs.clientsPage.querySelector("[data-action='clients-mobile-back']");
      staleBack?.closest(".mobile-drilldown-back-wrap")?.remove();
      return;
    }

    const nextView = state.mobileClientsView === "detail" ? "detail" : "list";
    refs.clientsPage.dataset.mobileDrilldown = "true";
    refs.clientsPage.dataset.mobileView = nextView;

    const projectsColumn = refs.projectList?.closest(".catalog-column");
    if (!projectsColumn) return;
    const existingWrap = projectsColumn.querySelector(".mobile-drilldown-back-wrap");
    if (nextView === "detail") {
      if (!existingWrap) {
        const wrap = document.createElement("div");
        wrap.className = "mobile-drilldown-back-wrap";
        wrap.innerHTML = `<button type="button" class="button button-ghost mobile-drilldown-back" data-action="clients-mobile-back">Back</button>`;
        projectsColumn.insertBefore(wrap, projectsColumn.firstChild);
      }
    } else {
      existingWrap?.remove();
    }
  }

  function syncMembersMobileDrilldownState() {
    if (!refs.usersPage) return;
    const enabled = isMobileDrilldownViewport();
    if (!enabled) {
      refs.usersPage.removeAttribute("data-mobile-drilldown");
      refs.usersPage.removeAttribute("data-mobile-view");
      return;
    }
    refs.usersPage.dataset.mobileDrilldown = "true";
    refs.usersPage.dataset.mobileView = state.mobileMembersView === "detail" ? "detail" : "list";
    if (window.settingsAdminDeps) {
      window.settingsAdminDeps.mobileMembersView = state.mobileMembersView;
    }
  }

  function onMobileMemberSelected() {
    if (!isMobileDrilldownViewport()) return;
    state.mobileMembersView = "detail";
    syncMembersMobileDrilldownState();
  }

  function onMobileMembersBack() {
    state.mobileMembersView = "list";
    syncMembersMobileDrilldownState();
    renderUsersList();
    postHeight();
  }

  function openUsersModal() {
    setView("members");
  }

  function closeUsersModal() {
    setView("entries");
  }

  function openCatalogModal() {
    setView("clients");
  }

  function closeCatalogModal() {
    setView("entries");
  }

  function resolveActingAsUserId() {
    const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
    const currentUserIdRaw = `${state.currentUser?.id || ""}`.trim();
    const currentUserId = normalizeId(currentUserIdRaw);
    const selectedUserId = normalizeId(state.actingAsUserId);
    if (!currentUserId) return "";
    if (!selectedUserId || selectedUserId === currentUserId) return currentUserIdRaw;
    const isDelegator = Array.isArray(state.delegators)
      ? state.delegators.some((item) => normalizeId(item?.id) === selectedUserId)
      : false;
    if (!isDelegator) return currentUserIdRaw;
    const selected = (state.delegators || []).find(
      (item) => normalizeId(item?.id) === selectedUserId
    );
    return `${selected?.id || ""}`.trim() || currentUserIdRaw;
  }

  function effectiveScopeUser() {
    const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
    const scopeUserId = resolveActingAsUserId();
    if (!scopeUserId) return state.currentUser || null;
    if (normalizeId(state.currentUser?.id) === normalizeId(scopeUserId)) return state.currentUser;
    const byId = (state.users || []).find(function (user) {
      return user && normalizeId(user.id) === normalizeId(scopeUserId);
    });
    if (byId) return byId;
    const selectedDelegator = (state.delegators || []).find(
      (item) => normalizeId(item?.id) === normalizeId(scopeUserId)
    );
    if (selectedDelegator?.name) {
      const byName = (state.users || []).find(function (user) {
        return `${user?.displayName || ""}`.trim() === selectedDelegator.name;
      });
      if (byName) return byName;
    }
    return state.currentUser || null;
  }

  function actingAsMyselfOption() {
    return {
      id: `${state.currentUser?.id || ""}`.trim(),
      name: "Myself",
      isSelf: true,
    };
  }

  function getActingAsUsers() {
    const selfOption = actingAsMyselfOption();
    const delegators = Array.isArray(state.delegators) ? state.delegators.filter(Boolean) : [];
    if (!selfOption.id) return delegators;
    return [selfOption, ...delegators.map((item) => ({ ...item, isSelf: false }))];
  }

  function getActingAsSelection() {
    const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
    const users = getActingAsUsers();
    if (!users.length) return null;
    const selectedId = resolveActingAsUserId();
    return (
      users.find(function (item) {
        return normalizeId(item.id) === normalizeId(selectedId);
      }) || users[0]
    );
  }

  function actingAsDisplayName(selection) {
    const current = selection || getActingAsSelection();
    if (!current) return "";
    if (current.isSelf) return "Myself";
    return String(current.name || "").trim();
  }

  function actingAsInitials(selection) {
    const current = selection || getActingAsSelection();
    const label = current?.isSelf
      ? `${state.currentUser?.displayName || state.currentUser?.username || ""}`.trim()
      : actingAsDisplayName(current);
    if (!label) return "??";
    const parts = label.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || parts[0]?.[1] || "";
    return `${first}${second}`.toUpperCase();
  }

  function closeActingAsMenu() {
    if (refs.actingAsMenu) {
      refs.actingAsMenu.hidden = true;
    }
    if (refs.actingAsToggle) {
      refs.actingAsToggle.setAttribute("aria-expanded", "false");
    }
  }

  function toggleActingAsMenu() {
    if (!refs.actingAsMenu || !refs.actingAsToggle || refs.actingAsToggle.hidden) {
      return;
    }
    const willOpen = refs.actingAsMenu.hidden;
    refs.actingAsMenu.hidden = !willOpen;
    refs.actingAsToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      closeSettingsMenu();
    }
  }

  function renderActingAsDropdown() {
    if (!refs.actingAsToggle || !refs.actingAsMenu) return;
    const delegators = Array.isArray(state.delegators) ? state.delegators.filter(Boolean) : [];
    const options = getActingAsUsers();
    const selection = getActingAsSelection();
    const show = delegators.length > 0 && !!selection;
    refs.actingAsToggle.hidden = !show;
    if (!show) {
      state.actingAsUserId = `${state.currentUser?.id || ""}`.trim();
      closeActingAsMenu();
      refs.actingAsMenu.innerHTML = "";
      return;
    }

    state.actingAsUserId = resolveActingAsUserId();
    if (refs.actingAsInitials) {
      refs.actingAsInitials.textContent = actingAsInitials(selection);
    }
    if (refs.actingAsName) {
      refs.actingAsName.textContent = actingAsDisplayName(selection);
    }

    const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
    const rows = options
      .map(function (item) {
        const id = escapeHtml(String(item.id || ""));
        const selectedAttr = normalizeId(item.id) === normalizeId(state.actingAsUserId) ? ' aria-current="true"' : "";
        return `<button class="acting-as-item" type="button" data-acting-as-id="${id}" role="menuitem"${selectedAttr}>${escapeHtml(String(item.name || ""))}</button>`;
      })
      .join("");
    refs.actingAsMenu.innerHTML = rows;
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
    memberModalState.interceptSelection = null;
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
      const hideConfirm = Boolean(options?.hideConfirm);
      const showInput = Boolean(options?.input);
      const defaultValue = options?.defaultValue || "";
      const inputType = String(options?.inputType || "text").trim() || "text";
      const isDateInput = inputType === "date";
      let dialogDateInput = null;
      let dialogResolveValue = () => refs.dialogInput.value.trim();

      refs.dialogTitle.textContent = title;
      refs.dialogMessage.textContent = message;
      refs.dialogInputRow.hidden = !showInput;
      refs.dialogInput.hidden = isDateInput;
      refs.dialogInput.type = isDateInput ? "text" : inputType;
      if (refs.dialogTextarea) {
        refs.dialogTextarea.hidden = true;
      }
      refs.dialogInput.value = defaultValue;
      if (showInput && isDateInput) {
        dialogDateInput = document.createElement("input");
        dialogDateInput.type = "date";
        dialogDateInput.className = "bulk-date-input";
        refs.dialogInputRow.appendChild(dialogDateInput);
        bindCustomDateInput(dialogDateInput, String(defaultValue || "").trim());
        dialogResolveValue = () => getDateInputIsoValue(dialogDateInput);
      }
      refs.dialogConfirm.textContent = confirmText;
      refs.dialogCancel.textContent = cancelText;
      refs.dialog.hidden = false;
      refs.dialogConfirm.hidden = hideConfirm;
      refs.dialogCancel.hidden = false;
      refs.dialogConfirm.disabled = false;
      refs.dialogCancel.disabled = false;

      const cleanup = () => {
        refs.dialog.hidden = true;
        if (dialogDateInput && dialogDateInput.parentNode) {
          dialogDateInput.remove();
        }
        refs.dialogInput.hidden = false;
        refs.dialogInput.type = "text";
        refs.dialogConfirm.removeEventListener("click", onConfirm);
        refs.dialogCancel.removeEventListener("click", onCancel);
      };

      const onConfirm = () => {
        cleanup();
        resolve({
          confirmed: true,
          value: showInput ? dialogResolveValue() : undefined,
        });
      };
      const onCancel = () => {
        cleanup();
        resolve({ confirmed: false });
      };

      refs.dialogConfirm.addEventListener("click", onConfirm);
      refs.dialogCancel.addEventListener("click", onCancel);

      if (showInput) {
        if (dialogDateInput) {
          dialogDateInput.focus();
        } else {
          refs.dialogInput.focus();
          refs.dialogInput.select();
        }
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
          refs.dialogCancel.disabled = true;
          refs.dialogCancel.textContent = "Saving...";
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
          refs.dialogCancel.disabled = true;
          refs.dialogCancel.textContent = "Saving...";
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



  function formatDisplayDate(value) {
    if (!isValidDateString(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year.slice(-2)}`;
  }

  function formatDisplayDateShort(value) {
    if (!isValidDateString(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year.slice(-2)}`;
  }

  function formatEntriesDateRangeDisplay(fromIso, toIso) {
    const fromText = formatDisplayDateShort(fromIso);
    const toText = formatDisplayDateShort(toIso);
    if (fromText && toText) return `${fromText} – ${toText}`;
    if (fromText) return `${fromText} –`;
    return "Select date range";
  }

  function syncEntriesDateRangeField(input, fromIso, toIso) {
    if (!input) return;
    const safeFrom = isValidDateString(fromIso) ? fromIso : "";
    const safeTo = isValidDateString(toIso) ? toIso : "";
    input.value = formatEntriesDateRangeDisplay(safeFrom, safeTo);
    input.dataset.dpRangeStart = safeFrom;
    input.dataset.dpRangeEnd = safeTo;
  }

  function parseDisplayDate(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) {
      return "";
    }
    if (digits.length !== 8 && digits.length !== 6) {
      return null;
    }

    const month = digits.slice(0, 2);
    const day = digits.slice(2, 4);
    const year = digits.length === 8 ? digits.slice(4) : `20${digits.slice(4)}`;
    const iso = `${year}-${month}-${day}`;

    return isValidDateString(iso) ? iso : null;
  }

  function normalizeIsoDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (isValidDateString(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      const iso = raw.slice(0, 10);
      if (isValidDateString(iso)) return iso;
    }
    const normalized =
      typeof normalizeDisplayDateInput === "function"
        ? normalizeDisplayDateInput(raw)
        : "";
    return isValidDateString(normalized) ? normalized : "";
  }

  function getDateInputIsoValue(input) {
    if (!input) return "";
    const canonical = normalizeIsoDateValue(input.dataset?.dpCanonical || "");
    if (canonical) return canonical;
    return normalizeIsoDateValue(input.value || "");
  }

  function setDateInputIsoValue(input, isoValue) {
    if (!input) return;
    const safeIso = isValidDateString(isoValue) ? isoValue : "";
    input.dataset.dpCanonical = safeIso;
    if (input.classList.contains("dp-desktop-date")) {
      input.value = safeIso ? formatDisplayDate(safeIso) : "";
      return;
    }
    input.value = safeIso;
  }

  function bindCustomDateInput(input, fallbackIso) {
    if (!input) return;
    const safeFallback = isValidDateString(fallbackIso)
      ? fallbackIso
      : new Date().toISOString().slice(0, 10);
    if (window.datePicker && typeof window.datePicker.register === "function") {
      if (input.dataset.dpBound !== "true") {
        input.type = "date";
        input.value = safeFallback;
        window.datePicker.register(input);
      }
      setDateInputIsoValue(input, safeFallback);
      return;
    }
    if (!input.value) {
      input.value = safeFallback;
    }
  }

  function shiftIsoDate(value, deltaDays) {
    const base = isValidDateString(value) ? value : today;
    const date = new Date(`${base}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    return formatDate(date);
  }

  function getInputsTimeUserDateBounds() {
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();
    const canonicalEntries = currentEntries({
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    });
    let minDate = "";
    let maxDate = "";

    canonicalEntries.forEach((entry) => {
      if (!entry || !isValidDateString(entry.date)) return;
      const entryUserId = `${entry.userId || ""}`.trim();
      const entryUserName = `${entry.user || ""}`.trim();
      const isCurrentUserEntry =
        (currentUserId && entryUserId && entryUserId === currentUserId) ||
        (!entryUserId && currentUserName && entryUserName === currentUserName);
      if (!isCurrentUserEntry) return;
      if (!minDate || entry.date < minDate) minDate = entry.date;
      if (!maxDate || entry.date > maxDate) maxDate = entry.date;
    });

    if (!minDate || !maxDate) return null;
    return { minDate, maxDate };
  }

  function getInputsExpenseUserDateBounds() {
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();
    let minDate = "";
    let maxDate = "";

    (state.expenses || []).forEach((expense) => {
      if (!expense) return;
      const expenseUserId = `${expense.userId || ""}`.trim();
      const expenseUserName = `${expense.userName || expense.user || userNameById(expense.userId) || ""}`.trim();
      const isCurrentUserExpense =
        (currentUserId && expenseUserId && expenseUserId === currentUserId) ||
        (!expenseUserId && currentUserName && expenseUserName === currentUserName);
      if (!isCurrentUserExpense) return;
      const expenseDate = isValidDateString(expense.expenseDate)
        ? expense.expenseDate
        : isValidDateString(expense.date)
        ? expense.date
        : "";
      if (!expenseDate) return;
      if (!minDate || expenseDate < minDate) minDate = expenseDate;
      if (!maxDate || expenseDate > maxDate) maxDate = expenseDate;
    });

    if (!minDate || !maxDate) return null;
    return { minDate, maxDate };
  }

  function getInputsTimeCalendarBounds() {
    const dateBounds = getInputsTimeUserDateBounds();
    if (!dateBounds) {
      return { hasData: false, minEndDate: today, maxEndDate: today };
    }
    return {
      hasData: true,
      minEndDate: dateBounds.minDate,
      maxEndDate: today,
    };
  }

  function getInputsExpenseCalendarBounds() {
    const dateBounds = getInputsExpenseUserDateBounds();
    if (!dateBounds) {
      return { hasData: false, minEndDate: today, maxEndDate: today };
    }
    return {
      hasData: true,
      minEndDate: dateBounds.minDate,
      maxEndDate: today,
    };
  }

  function getInputsTimeCalendarDates() {
    const dateBounds = getInputsTimeUserDateBounds();
    if (!dateBounds) return [];
    const endDate = dateBounds.maxDate || today;
    const startDate = dateBounds.minDate || endDate;
    const dates = [];
    let iso = endDate;
    while (isValidDateString(iso) && iso >= startDate) {
      const date = new Date(`${iso}T00:00:00`);
      const dayLabel = date.toLocaleDateString(undefined, { weekday: "short" });
      const dateLabel = date.toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
      });
      dates.push({ iso, dayLabel, dateLabel });
      if (iso === startDate) break;
      iso = shiftIsoDate(iso, -1);
    }
    return dates;
  }

  function getInputsExpenseCalendarDates() {
    const dateBounds = getInputsExpenseUserDateBounds();
    if (!dateBounds) return [];
    const endDate = dateBounds.maxDate || today;
    const startDate = dateBounds.minDate || endDate;
    const dates = [];
    let iso = endDate;
    while (isValidDateString(iso) && iso >= startDate) {
      const date = new Date(`${iso}T00:00:00`);
      const dayLabel = date.toLocaleDateString(undefined, { weekday: "short" });
      const dateLabel = date.toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
      });
      dates.push({ iso, dayLabel, dateLabel });
      if (iso === startDate) break;
      iso = shiftIsoDate(iso, -1);
    }
    return dates;
  }

  function formatCalendarHours(value) {
    if (!Number.isFinite(value) || value <= 0) return "";
    return value.toFixed(2).replace(/\.00$/, "");
  }

  function formatSummaryHours(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return "0h";
    const rounded = Math.round(numeric * 10) / 10;
    if (Number.isInteger(rounded)) {
      return `${rounded.toFixed(0)}h`;
    }
    return `${rounded.toFixed(1)}h`;
  }

  function formatSummaryCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }

  function formatCalendarCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "";
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }

  function buildInputsTimeCalendarData() {
    const dates = getInputsTimeCalendarDates();
    const dateSet = new Set(dates.map((item) => item.iso));
    const canonicalEntries = currentEntries({
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    });
    const perProject = new Map();
    const totalsByDate = Object.create(null);
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();

    dates.forEach((item) => {
      totalsByDate[item.iso] = 0;
    });

    canonicalEntries.forEach((entry) => {
      if (!entry) return;
      const entryUserId = `${entry.userId || ""}`.trim();
      const entryUserName = `${entry.user || ""}`.trim();
      const isCurrentUserEntry =
        (currentUserId && entryUserId && entryUserId === currentUserId) ||
        (!entryUserId && currentUserName && entryUserName === currentUserName);
      if (!isCurrentUserEntry) return;
      if (!entry || !dateSet.has(entry.date)) return;
      const hours = Number(entry.hours);
      if (!Number.isFinite(hours) || hours <= 0) return;
      const chargeCenterId = `${entry.chargeCenterId || entry.charge_center_id || ""}`.trim();
      const projectId = `${entry.projectId || entry.project_id || ""}`.trim();
      const isCorporateEntry =
        (Boolean(chargeCenterId) && !projectId) ||
        (`${entry.client || ""}`.trim().toLowerCase() === "internal" && !projectId);
      const client = `${entry.client || ""}`.trim() || (isCorporateEntry ? "Internal" : "");
      const project = `${entry.project || ""}`.trim()
        || (isCorporateEntry ? corporateFunctionCategoryDisplayLabelById(chargeCenterId) || "Internal" : "");
      if (!client || !project) return;
      const projectKeyValue = isCorporateEntry
        ? `corporate|||${chargeCenterId || project}`
        : `${client}|||${project}`;
      if (!perProject.has(projectKeyValue)) {
        perProject.set(projectKeyValue, {
          client,
          project,
          byDate: Object.create(null),
          byDateEntries: Object.create(null),
        });
      }
      const row = perProject.get(projectKeyValue);
      row.byDate[entry.date] = (row.byDate[entry.date] || 0) + hours;
      if (!row.byDateEntries[entry.date]) {
        row.byDateEntries[entry.date] = [];
      }
      row.byDateEntries[entry.date].push({
        id: `${entry.id || ""}`.trim(),
        hours,
        notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
        billable: entry.billable !== false,
        status: entry.status === "approved" ? "approved" : "pending",
        isCorporate: isCorporateEntry,
      });
      totalsByDate[entry.date] += hours;
    });

    const projectRows = Array.from(perProject.values()).sort((a, b) => {
      const left = `${a.client} / ${a.project}`.toLowerCase();
      const right = `${b.client} / ${b.project}`.toLowerCase();
      return left.localeCompare(right);
    });

    const weekTotal = dates.reduce((sum, item) => sum + Number(totalsByDate[item.iso] || 0), 0);
    const todayTotal = Number(totalsByDate[today] || 0);
    let peakDay = null;
    dates.forEach((item) => {
      const total = Number(totalsByDate[item.iso] || 0);
      if (!peakDay || total > peakDay.total) {
        peakDay = {
          iso: item.iso,
          dayLabel: item.dayLabel,
          total,
        };
      }
    });
    return {
      dates,
      totalsByDate,
      projectRows,
      weekTotal,
      todayTotal,
      peakDay,
    };
  }

  function renderInputsTimeSummaryAndCalendarMeta() {
    const { dates, weekTotal, todayTotal, peakDay } = buildInputsTimeCalendarData();
    const bounds = getInputsTimeCalendarBounds();
    const currentEndDate = dates[dates.length - 1]?.iso || state.inputsTimeCalendarEndDate || today;
    if (refs.inputsTimeSummaryTotal) {
      refs.inputsTimeSummaryTotal.textContent = formatSummaryHours(weekTotal);
    }
    if (refs.inputsTimeSummaryToday) {
      refs.inputsTimeSummaryToday.textContent = formatSummaryHours(todayTotal);
    }
    if (refs.inputsTimeSummarySignal) {
      if (!peakDay || peakDay.total <= 0) {
        refs.inputsTimeSummarySignal.textContent = "Peak: --";
      } else {
        refs.inputsTimeSummarySignal.textContent = `Peak: ${peakDay.dayLabel} ${formatSummaryHours(
          peakDay.total
        )}`;
      }
    }
    if (refs.inputsTimeSummaryToggle) {
      refs.inputsTimeSummaryToggle.textContent = state.inputsTimeCalendarExpanded
        ? "Hide week ▲"
        : "View week ▼";
      refs.inputsTimeSummaryToggle.setAttribute(
        "aria-expanded",
        state.inputsTimeCalendarExpanded ? "true" : "false"
      );
    }
    if (refs.inputsTimeCalendarView) {
      refs.inputsTimeCalendarView.hidden = !state.inputsTimeCalendarExpanded;
      refs.inputsTimeCalendarView.classList.add("inputs-drilldown-mode");
    }
    if (refs.inputsTimeCalendarRange) {
      const firstDate = dates[0]?.iso || "";
      const lastDate = dates[dates.length - 1]?.iso || "";
      refs.inputsTimeCalendarRange.textContent =
        firstDate && lastDate
          ? `${formatDisplayDateShort(firstDate)} - ${formatDisplayDateShort(lastDate)}`
          : "";
      refs.inputsTimeCalendarRange.hidden = true;
    }
    if (refs.inputsTimeCalendarPrev) {
      refs.inputsTimeCalendarPrev.disabled = !bounds.hasData || currentEndDate <= bounds.minEndDate;
      refs.inputsTimeCalendarPrev.hidden = true;
    }
    if (refs.inputsTimeCalendarNext) {
      refs.inputsTimeCalendarNext.disabled = !bounds.hasData || currentEndDate >= bounds.maxEndDate;
      refs.inputsTimeCalendarNext.hidden = true;
    }
  }

  function renderInputsTimeCalendar() {
    if (!refs.inputsTimeCalendarGrid) return;
    const { dates, totalsByDate, projectRows } = buildInputsTimeCalendarData();
    if (!dates.length) {
      refs.inputsTimeCalendarGrid.innerHTML = "";
      if (refs.inputsTimeCalendarRange) {
        refs.inputsTimeCalendarRange.textContent = "";
      }
      return;
    }
    const selectableDays = dates
      .filter((item) => Number(totalsByDate[item.iso] || 0) > 0)
      .map((item) => item.iso);
    const selectableDaySet = new Set(selectableDays);
    if (!selectableDaySet.has(state.inputsTimeSelectedDate)) {
      state.inputsTimeSelectedDate = selectableDaySet.has(today) ? today : selectableDays[0] || "";
    }
    const selectedDay = state.inputsTimeSelectedDate;

    const projectOptions = projectRows
      .map((row) => {
        const total = Number(row.byDate[selectedDay] || 0);
        if (!Number.isFinite(total) || total <= 0) return null;
        return {
          key: encodeInputsTimeCombo(row.client, row.project),
          label: `${row.client} / ${row.project}`,
          total,
          entries: Array.isArray(row.byDateEntries?.[selectedDay]) ? row.byDateEntries[selectedDay] : [],
        };
      })
      .filter(Boolean);

    const projectOptionKeys = new Set(projectOptions.map((item) => item.key));
    if (!projectOptionKeys.has(state.inputsTimeSelectedClientProject)) {
      state.inputsTimeSelectedClientProject = projectOptions[0]?.key || "";
    }
    const selectedProject = projectOptions.find(
      (item) => item.key === state.inputsTimeSelectedClientProject
    ) || null;
    const selectedEntries = selectedProject ? selectedProject.entries : [];

    const allDays = dates.map((item) => {
      const total = Number(totalsByDate[item.iso] || 0);
      const hasEntries = Number.isFinite(total) && total > 0;
      return {
        ...item,
        total,
        hasEntries,
      };
    });
    const showAllDays = state.inputsTimeShowAllDays === true;
    const daysToRender = showAllDays
      ? allDays
      : allDays.filter((day) => day.hasEntries);

    const dayRowsHtml = daysToRender
      .map((item) => {
        const total = Number(item.total || 0);
        const isActive = item.iso === selectedDay;
        const isZero = !item.hasEntries;
        return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}${isZero ? " is-zero" : ""}" data-action="inputs-time-day" data-day="${escapeHtml(item.iso)}"${
          isZero ? ' disabled aria-disabled="true" tabindex="-1"' : ""
        }>
          <span class="inputs-drilldown-item-label">${escapeHtml(item.dayLabel)} ${escapeHtml(item.dateLabel)}</span>
          <span class="inputs-drilldown-item-value">${escapeHtml(isZero ? "—" : formatSummaryHours(total))}</span>
        </button>`;
      })
      .join("");

    const projectRowsHtml =
      projectOptions
        .map((item) => {
          const isActive = item.key === state.inputsTimeSelectedClientProject;
          return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}" data-action="inputs-time-project" data-project="${escapeHtml(item.key)}">
            <span class="inputs-drilldown-item-label">${escapeHtml(item.label)}</span>
            <span class="inputs-drilldown-item-value">${escapeHtml(formatSummaryHours(item.total))}</span>
          </button>`;
        })
        .join("") || `<div class="inputs-drilldown-empty">No client/project entries for this day.</div>`;

    const detailRowsHtml =
      selectedEntries
        .map((detail) => {
          const noteText = detail.notes ? escapeHtml(detail.notes) : "No note";
          const statusText = detail.status === "approved" ? "Approved" : "Pending";
          const billableText = detail.billable ? "Billable" : "Non-billable";
          const statusMarkup = detail.isCorporate
            ? ""
            : `<span class="inputs-time-calendar-detail-chip inputs-time-calendar-detail-chip-status inputs-time-calendar-detail-chip-status-${
                detail.status === "approved" ? "approved" : "pending"
              }">${escapeHtml(statusText)}</span>`;
          return `<div class="inputs-drilldown-detail-row">
            <div class="inputs-drilldown-detail-main">
              <div class="inputs-drilldown-detail-meta">
                <span class="inputs-drilldown-detail-value">${escapeHtml(formatSummaryHours(detail.hours))}</span>
                ${statusMarkup}
                <span class="billable-pill ${
                  detail.billable ? "is-billable" : "is-nonbillable"
                }">${escapeHtml(billableText)}</span>
              </div>
              <div class="inputs-drilldown-detail-actions">
                <button type="button" class="button button-ghost" data-action="inputs-time-detail-edit" data-id="${escapeHtml(
                  detail.id
                )}">Edit</button>
                <button type="button" class="button button-ghost button-danger" data-action="inputs-time-detail-delete" data-id="${escapeHtml(
                  detail.id
                )}">Delete</button>
              </div>
            </div>
            <div class="inputs-drilldown-detail-notes">${noteText}</div>
          </div>`;
        })
        .join("") || `<div class="inputs-drilldown-empty">Select a client/project to view details.</div>`;

    refs.inputsTimeCalendarGrid.innerHTML = `
      <div class="inputs-drilldown-layout">
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head" style="position:relative;"><span>Days</span><button type="button" data-action="inputs-time-toggle-days" aria-label="${showAllDays ? "Collapse days" : "Expand days"}" title="${showAllDays ? "Show only days with entries" : "Show all days"}" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);margin:0;padding:0;border:0;background:transparent;appearance:none;-webkit-appearance:none;min-height:0;line-height:1;color:var(--muted);font-family:inherit;font-size:.74rem;font-weight:600;letter-spacing:0;text-transform:none;cursor:pointer;">${showAllDays ? "Collapse −" : "Expand +"}</button></header>
          <div class="inputs-drilldown-col-body">${dayRowsHtml}</div>
        </section>
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head">Client / Project</header>
          <div class="inputs-drilldown-col-body">${projectRowsHtml}</div>
        </section>
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head">Details</header>
          <div class="inputs-drilldown-col-body">${detailRowsHtml}</div>
        </section>
      </div>
    `;
  }

  function bindInputsCalendarHoverAlignment(grid, cellSelector, panelSelector) {
    if (!grid) return;
    const alignCalendarHoverDetail = function (cell) {
      if (!cell) return;
      const panel = cell.querySelector(panelSelector);
      if (!panel) return;
      const previousDisplay = panel.style.display;
      const previousVisibility = panel.style.visibility;

      panel.style.display = "flex";
      panel.style.visibility = "hidden";

      const viewportPadding = 8;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const cellRect = cell.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const panelWidth = panelRect.width;
      const centeredLeft = cellRect.left + (cellRect.width / 2) - (panelWidth / 2);
      const centeredRight = centeredLeft + panelWidth;

      cell.dataset.detailAlign = "center";
      if (centeredRight > viewportWidth - viewportPadding) {
        cell.dataset.detailAlign = "right";
      } else if (centeredLeft < viewportPadding) {
        cell.dataset.detailAlign = "left";
      }

      panel.style.display = previousDisplay;
      panel.style.visibility = previousVisibility;
    };

    grid
      .querySelectorAll(cellSelector)
      .forEach((cell) => {
        cell.addEventListener("mouseenter", function () {
          alignCalendarHoverDetail(cell);
        });
        cell.addEventListener("focusin", function () {
          alignCalendarHoverDetail(cell);
        });
      });
  }

  function buildInputsExpenseCalendarData() {
    const dates = getInputsExpenseCalendarDates();
    const dateSet = new Set(dates.map((item) => item.iso));
    const perProject = new Map();
    const totalsByDate = Object.create(null);
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();

    dates.forEach((item) => {
      totalsByDate[item.iso] = 0;
    });

    (state.expenses || []).forEach((expense) => {
      if (!expense) return;
      const expenseUserId = `${expense.userId || ""}`.trim();
      const expenseUserName = `${expense.userName || expense.user || userNameById(expense.userId) || ""}`.trim();
      const isCurrentUserExpense =
        (currentUserId && expenseUserId && expenseUserId === currentUserId) ||
        (!expenseUserId && currentUserName && expenseUserName === currentUserName);
      if (!isCurrentUserExpense) return;

      const expenseDate = isValidDateString(expense.expenseDate)
        ? expense.expenseDate
        : isValidDateString(expense.date)
        ? expense.date
        : "";
      if (!expenseDate || !dateSet.has(expenseDate)) return;

      const amount = Number(expense.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const chargeCenterId = `${expense.chargeCenterId || expense.charge_center_id || ""}`.trim();
      const projectId = `${expense.projectId || expense.project_id || ""}`.trim();
      const isCorporateExpense =
        (Boolean(chargeCenterId) && !projectId) ||
        (`${expense.clientName || expense.client || ""}`.trim().toLowerCase() === "internal" && !projectId);
      const client = `${expense.clientName || expense.client || ""}`.trim() || (isCorporateExpense ? "Internal" : "");
      const project = `${expense.projectName || expense.project || ""}`.trim()
        || (isCorporateExpense ? corporateFunctionCategoryDisplayLabelById(chargeCenterId) || "Internal" : "");
      if (!client || !project) return;
      const projectKeyValue = isCorporateExpense
        ? `corporate|||${chargeCenterId || project}`
        : `${client}|||${project}`;
      if (!perProject.has(projectKeyValue)) {
        perProject.set(projectKeyValue, {
          client,
          project,
          byDate: Object.create(null),
          byDateEntries: Object.create(null),
        });
      }
      const row = perProject.get(projectKeyValue);
      row.byDate[expenseDate] = (row.byDate[expenseDate] || 0) + amount;
      if (!row.byDateEntries[expenseDate]) {
        row.byDateEntries[expenseDate] = [];
      }
      row.byDateEntries[expenseDate].push({
        id: `${expense.id || ""}`.trim(),
        amount,
        notes: typeof expense.notes === "string" ? expense.notes.trim() : "",
        billable: expense.isBillable !== false,
        category: typeof expense.category === "string" ? expense.category.trim() : "",
        status: expense.status === "approved" ? "approved" : "pending",
      });
      totalsByDate[expenseDate] += amount;
    });

    const projectRows = Array.from(perProject.values()).sort((a, b) => {
      const left = `${a.client} / ${a.project}`.toLowerCase();
      const right = `${b.client} / ${b.project}`.toLowerCase();
      return left.localeCompare(right);
    });

    const weekTotal = dates.reduce((sum, item) => sum + Number(totalsByDate[item.iso] || 0), 0);
    const todayTotal = Number(totalsByDate[today] || 0);
    let peakDay = null;
    dates.forEach((item) => {
      const total = Number(totalsByDate[item.iso] || 0);
      if (!peakDay || total > peakDay.total) {
        peakDay = {
          iso: item.iso,
          dayLabel: item.dayLabel,
          total,
        };
      }
    });
    return {
      dates,
      totalsByDate,
      projectRows,
      weekTotal,
      todayTotal,
      peakDay,
    };
  }

  function renderInputsExpenseSummaryAndCalendarMeta() {
    const { dates, weekTotal, todayTotal, peakDay } = buildInputsExpenseCalendarData();
    const bounds = getInputsExpenseCalendarBounds();
    const currentEndDate = dates[dates.length - 1]?.iso || state.inputsExpenseCalendarEndDate || today;
    if (refs.inputsExpenseSummaryTotal) {
      refs.inputsExpenseSummaryTotal.textContent = formatSummaryCurrency(weekTotal);
    }
    if (refs.inputsExpenseSummaryToday) {
      refs.inputsExpenseSummaryToday.textContent = formatSummaryCurrency(todayTotal);
    }
    if (refs.inputsExpenseSummarySignal) {
      if (!peakDay || peakDay.total <= 0) {
        refs.inputsExpenseSummarySignal.textContent = "Peak: --";
      } else {
        refs.inputsExpenseSummarySignal.textContent = `Peak: ${peakDay.dayLabel} ${formatSummaryCurrency(
          peakDay.total
        )}`;
      }
    }
    if (refs.inputsExpenseSummaryToggle) {
      refs.inputsExpenseSummaryToggle.textContent = state.inputsExpenseCalendarExpanded
        ? "Hide week ▲"
        : "View week ▼";
      refs.inputsExpenseSummaryToggle.setAttribute(
        "aria-expanded",
        state.inputsExpenseCalendarExpanded ? "true" : "false"
      );
    }
    if (refs.inputsExpenseCalendarView) {
      refs.inputsExpenseCalendarView.hidden = !state.inputsExpenseCalendarExpanded;
      refs.inputsExpenseCalendarView.classList.add("inputs-drilldown-mode");
    }
    if (refs.inputsExpenseCalendarRange) {
      const firstDate = dates[0]?.iso || "";
      const lastDate = dates[dates.length - 1]?.iso || "";
      refs.inputsExpenseCalendarRange.textContent =
        firstDate && lastDate
          ? `${formatDisplayDateShort(firstDate)} - ${formatDisplayDateShort(lastDate)}`
          : "";
      refs.inputsExpenseCalendarRange.hidden = true;
    }
    if (refs.inputsExpenseCalendarPrev) {
      refs.inputsExpenseCalendarPrev.disabled = !bounds.hasData;
      refs.inputsExpenseCalendarPrev.hidden = true;
    }
    if (refs.inputsExpenseCalendarNext) {
      refs.inputsExpenseCalendarNext.disabled = !bounds.hasData || currentEndDate >= bounds.maxEndDate;
      refs.inputsExpenseCalendarNext.hidden = true;
    }
  }

  function renderInputsExpenseCalendar() {
    if (!refs.inputsExpenseCalendarGrid) return;
    const { dates, totalsByDate, projectRows } = buildInputsExpenseCalendarData();
    if (!dates.length) {
      refs.inputsExpenseCalendarGrid.innerHTML = "";
      if (refs.inputsExpenseCalendarRange) {
        refs.inputsExpenseCalendarRange.textContent = "";
      }
      return;
    }
    const selectableDays = dates
      .filter((item) => Number(totalsByDate[item.iso] || 0) > 0)
      .map((item) => item.iso);
    const selectableDaySet = new Set(selectableDays);
    if (!selectableDaySet.has(state.inputsExpenseSelectedDate)) {
      state.inputsExpenseSelectedDate = selectableDaySet.has(today) ? today : selectableDays[0] || "";
    }
    const selectedDay = state.inputsExpenseSelectedDate;

    const projectOptions = projectRows
      .map((row) => {
        const total = Number(row.byDate[selectedDay] || 0);
        if (!Number.isFinite(total) || total <= 0) return null;
        return {
          key: encodeInputsTimeCombo(row.client, row.project),
          label: `${row.client} / ${row.project}`,
          total,
          entries: Array.isArray(row.byDateEntries?.[selectedDay]) ? row.byDateEntries[selectedDay] : [],
        };
      })
      .filter(Boolean);

    const projectOptionKeys = new Set(projectOptions.map((item) => item.key));
    if (!projectOptionKeys.has(state.inputsExpenseSelectedClientProject)) {
      state.inputsExpenseSelectedClientProject = projectOptions[0]?.key || "";
    }
    const selectedProject = projectOptions.find(
      (item) => item.key === state.inputsExpenseSelectedClientProject
    ) || null;
    const selectedEntries = selectedProject ? selectedProject.entries : [];

    const allDays = dates.map((item) => {
      const total = Number(totalsByDate[item.iso] || 0);
      const hasEntries = Number.isFinite(total) && total > 0;
      return {
        ...item,
        total,
        hasEntries,
      };
    });
    const showAllDays = state.inputsExpenseShowAllDays === true;
    const daysToRender = showAllDays
      ? allDays
      : allDays.filter((day) => day.hasEntries);

    const dayRowsHtml = daysToRender
      .map((item) => {
        const total = Number(item.total || 0);
        const isActive = item.iso === selectedDay;
        const isZero = !item.hasEntries;
        return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}${isZero ? " is-zero" : ""}" data-action="inputs-expense-day" data-day="${escapeHtml(item.iso)}"${
          isZero ? ' disabled aria-disabled="true" tabindex="-1"' : ""
        }>
          <span class="inputs-drilldown-item-label">${escapeHtml(item.dayLabel)} ${escapeHtml(item.dateLabel)}</span>
          <span class="inputs-drilldown-item-value">${escapeHtml(isZero ? "—" : formatSummaryCurrency(total))}</span>
        </button>`;
      })
      .join("");

    const projectRowsHtml =
      projectOptions
        .map((item) => {
          const isActive = item.key === state.inputsExpenseSelectedClientProject;
          return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}" data-action="inputs-expense-project" data-project="${escapeHtml(item.key)}">
            <span class="inputs-drilldown-item-label">${escapeHtml(item.label)}</span>
            <span class="inputs-drilldown-item-value">${escapeHtml(formatSummaryCurrency(item.total))}</span>
          </button>`;
        })
        .join("") || `<div class="inputs-drilldown-empty">No client/project expenses for this day.</div>`;

    const detailRowsHtml =
      selectedEntries
        .map((detail) => {
          const noteText = detail.notes ? escapeHtml(detail.notes) : "No note";
          const statusText = detail.status === "approved" ? "Approved" : "Pending";
          const billableText = detail.billable ? "Billable" : "Non-billable";
          const categoryText = detail.category ? escapeHtml(detail.category) : "Uncategorized";
          return `<div class="inputs-drilldown-detail-row">
            <div class="inputs-drilldown-detail-main">
              <div class="inputs-drilldown-detail-meta">
                <span class="inputs-drilldown-detail-value">${escapeHtml(formatSummaryCurrency(detail.amount))}</span>
                <span class="inputs-time-calendar-detail-chip inputs-time-calendar-detail-chip-status inputs-time-calendar-detail-chip-status-${
                  detail.status === "approved" ? "approved" : "pending"
                }">${escapeHtml(statusText)}</span>
                <span class="billable-pill ${
                  detail.billable ? "is-billable" : "is-nonbillable"
                }">${escapeHtml(billableText)}</span>
                <span class="inputs-time-calendar-detail-category">${categoryText}</span>
              </div>
              <div class="inputs-drilldown-detail-actions">
                <button type="button" class="button button-ghost" data-action="inputs-expense-detail-edit" data-id="${escapeHtml(
                  detail.id
                )}">Edit</button>
                <button type="button" class="button button-ghost button-danger" data-action="inputs-expense-detail-delete" data-id="${escapeHtml(
                  detail.id
                )}">Delete</button>
              </div>
            </div>
            <div class="inputs-drilldown-detail-notes">${noteText}</div>
          </div>`;
        })
        .join("") || `<div class="inputs-drilldown-empty">Select a client/project to view details.</div>`;

    refs.inputsExpenseCalendarGrid.innerHTML = `
      <div class="inputs-drilldown-layout">
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head" style="position:relative;"><span>Days</span><button type="button" data-action="inputs-expense-toggle-days" aria-label="${showAllDays ? "Collapse days" : "Expand days"}" title="${showAllDays ? "Show only days with entries" : "Show all days"}" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);margin:0;padding:0;border:0;background:transparent;appearance:none;-webkit-appearance:none;min-height:0;line-height:1;color:var(--muted);font-family:inherit;font-size:.74rem;font-weight:600;letter-spacing:0;text-transform:none;cursor:pointer;">${showAllDays ? "Collapse −" : "Expand +"}</button></header>
          <div class="inputs-drilldown-col-body">${dayRowsHtml}</div>
        </section>
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head">Client / Project</header>
          <div class="inputs-drilldown-col-body">${projectRowsHtml}</div>
        </section>
        <section class="inputs-drilldown-col">
          <header class="inputs-drilldown-col-head">Details</header>
          <div class="inputs-drilldown-col-body">${detailRowsHtml}</div>
        </section>
      </div>
    `;
  }

  function refreshInputsDrilldownAfterLocalMutation(kind) {
    if (state.currentView !== "inputs") return;
    if (kind === "time") {
      const previousHidden = refs.inputsTimeCalendarView ? refs.inputsTimeCalendarView.hidden : true;
      renderInputsTimeCalendar();
      if (refs.inputsTimeCalendarView) {
        refs.inputsTimeCalendarView.hidden = previousHidden;
      }
      return;
    }
    if (kind === "expenses") {
      const previousHidden = refs.inputsExpenseCalendarView ? refs.inputsExpenseCalendarView.hidden : true;
      renderInputsExpenseCalendar();
      if (refs.inputsExpenseCalendarView) {
        refs.inputsExpenseCalendarView.hidden = previousHidden;
      }
    }
  }

  function encodeInputsTimeCombo(clientName, projectName) {
    return `${encodeURIComponent(clientName || "")}::${encodeURIComponent(projectName || "")}`;
  }

  function encodeInputsCorporateCombo(categoryId) {
    return `${INPUTS_COMBO_CORPORATE_PREFIX}${encodeURIComponent(categoryId || "")}`;
  }

  function decodeInputsCorporateCombo(value) {
    const text = String(value || "").trim();
    if (!text.startsWith(INPUTS_COMBO_CORPORATE_PREFIX)) return "";
    return decodeURIComponent(text.slice(INPUTS_COMBO_CORPORATE_PREFIX.length) || "");
  }

  function decodeInputsTimeCombo(value) {
    const text = String(value || "");
    if (!text || text.startsWith(INPUTS_COMBO_CORPORATE_PREFIX)) return ["", ""];
    const splitAt = text.indexOf("::");
    if (splitAt < 0) return ["", ""];
    return [
      decodeURIComponent(text.slice(0, splitAt) || ""),
      decodeURIComponent(text.slice(splitAt + 2) || ""),
    ];
  }

  function readLastInputsClientProjectCombo() {
    try {
      return `${window.localStorage.getItem(LAST_INPUTS_COMBO_STORAGE_KEY) || ""}`.trim();
    } catch (_) {
      return "";
    }
  }

  function writeLastInputsClientProjectCombo(value) {
    const nextValue = `${value || ""}`.trim();
    if (!nextValue) return;
    try {
      window.localStorage.setItem(LAST_INPUTS_COMBO_STORAGE_KEY, nextValue);
    } catch (_) {}
  }

  function resolveInputsComboDefault(selectedValue, options) {
    const selected = `${selectedValue || ""}`.trim();
    if (selected) return selected;
    const stored = readLastInputsClientProjectCombo();
    if (!stored) return "";
    const list = Array.isArray(options) ? options : [];
    return list.some((item) => `${item?.value || ""}`.trim() === stored && !item?.disabled)
      ? stored
      : "";
  }

  function findProjectIdByClientProject(clientName, projectName) {
    const match = (state.projects || []).find(
      (item) =>
        `${item?.client || ""}`.trim() === `${clientName || ""}`.trim() &&
        `${item?.name || item?.project || ""}`.trim() === `${projectName || ""}`.trim()
    );
    return `${match?.id || ""}`.trim();
  }

  function groupedCorporateFunctionCategoriesForInputs() {
    const groups = Array.isArray(state.corporateFunctionGroups)
      ? state.corporateFunctionGroups.slice().sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0))
      : [];
    const categories = Array.isArray(state.corporateFunctionCategories)
      ? state.corporateFunctionCategories
          .slice()
          .sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0))
      : [];
    const validGroupIds = new Set(
      groups.map((group) => `${group?.id || ""}`.trim()).filter(Boolean)
    );
    const grouped = groups
      .map((group) => ({
        groupId: `${group?.id || ""}`.trim(),
        groupName: `${group?.name || ""}`.trim(),
        categories: categories.filter((item) => `${item?.groupId || ""}`.trim() === `${group?.id || ""}`.trim()),
      }))
      .filter((item) => item.groupId && item.groupName && item.categories.length);
    const uncategorized = categories.filter((item) => {
      const groupId = `${item?.groupId || ""}`.trim();
      return !groupId || !validGroupIds.has(groupId);
    });
    if (uncategorized.length) {
      grouped.push({
        groupId: "__ungrouped_internal__",
        groupName: "Internal",
        categories: uncategorized,
      });
    }
    return grouped;
  }

  function corporateFunctionCategoryDisplayLabelById(categoryId) {
    const normalizedId = `${categoryId || ""}`.trim();
    if (!normalizedId) return "";
    const category = (state.corporateFunctionCategories || []).find(
      (item) => `${item?.id || ""}`.trim() === normalizedId
    );
    if (!category) return "";
    const categoryName = `${category?.name || ""}`.trim();
    const groupId = `${category?.groupId || ""}`.trim();
    const group = (state.corporateFunctionGroups || []).find(
      (item) => `${item?.id || ""}`.trim() === groupId
    );
    const groupName = `${group?.name || ""}`.trim();
    if (groupName && categoryName) return `${groupName} / ${categoryName}`;
    return categoryName || groupName || "";
  }

  function readInputsComboSelectionMeta(selectEl) {
    const option = selectEl?.selectedOptions?.[0] || null;
    const value = `${selectEl?.value || ""}`.trim();
    const type = `${option?.dataset?.itemType || ""}`.trim();
    const id = `${option?.dataset?.itemId || ""}`.trim();
    const groupName = `${option?.dataset?.groupName || ""}`.trim();
    if (type === "corporate" || value.startsWith(INPUTS_COMBO_CORPORATE_PREFIX)) {
      return {
        type: "corporate",
        id: id || decodeInputsCorporateCombo(value),
        group_name: groupName,
        label: `${option?.textContent || ""}`.trim(),
      };
    }
    const [clientName, projectName] = decodeInputsTimeCombo(value);
    if (clientName && projectName) {
      return {
        type: "project",
        id: id || findProjectIdByClientProject(clientName, projectName),
        client: clientName,
        project: projectName,
        label: `${option?.textContent || ""}`.trim(),
      };
    }
    return { type: "", id: "", label: "" };
  }

  function parseInputsTimeDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (isValidDateString(raw)) {
      return clampDateToBounds(raw);
    }
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 6) {
      const month = digits.slice(0, 2);
      const day = digits.slice(2, 4);
      const year = `20${digits.slice(4)}`;
      const iso = `${year}-${month}-${day}`;
      return isValidDateString(iso) ? clampDateToBounds(iso) : "";
    }
    if (digits.length === 8) {
      const month = digits.slice(0, 2);
      const day = digits.slice(2, 4);
      const year = digits.slice(4);
      const iso = `${year}-${month}-${day}`;
      return isValidDateString(iso) ? clampDateToBounds(iso) : "";
    }
    return "";
  }

  function syncInputsTimeDateField(dateField) {
    const input = dateField || refs.inputsTimeDate;
    if (!input) return;
    const isDesktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
    const iso =
      input.dataset.dpCanonical ||
      parseInputsTimeDateValue(input.value) ||
      clampDateToBounds(today);
    input.dataset.dpCanonical = iso;
    input.value = isDesktop ? formatDisplayDateShort(iso) : iso;
  }

  function setInputsRowState(row, state) {
    if (!row) return;
    row.dataset.rowState = state;
    row.dataset.saved = state === "saved" ? "true" : "false";
    row.dataset.editing = state === "editing-saved" ? "true" : "false";
  }

  function hasTrailingBlankInputsRow(container, isBlankRow) {
    if (!container) return false;
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    if (!rows.length) return false;
    const last = rows[rows.length - 1];
    const rowState = last.dataset.rowState || (last.dataset.saved === "true" ? "saved" : "new");
    if (rowState !== "new" || last.dataset.saving === "true") return false;
    return isBlankRow(last);
  }

  function ensureInputsRowActionButton(row, fieldsForRow, config) {
    const fields = fieldsForRow(row);
    if (!fields.actions) return null;
    const button = fields[config.existingKey] || document.createElement("button");
    if (!fields[config.existingKey]) {
      button.type = "button";
      button.className = config.className;
      button.textContent = config.text;
      button.hidden = true;
      if (config.datasetKey) {
        button.dataset[config.datasetKey] = "true";
      }
      if (config.ariaLabel) {
        button.setAttribute("aria-label", config.ariaLabel);
      }
      if (config.title) {
        button.title = config.title;
      }
      fields.actions.appendChild(button);
    }
    if (!button[config.boundFlag]) {
      button.addEventListener("click", function (event) {
        config.onClick(event);
      });
      button[config.boundFlag] = true;
    }
    return button;
  }

  function startInputsRowEdit(row, fieldsForRow, syncRows, focusField) {
    if (row.dataset.saving === "true" || row.dataset.deleting === "true") return;
    setInputsRowState(row, "editing-saved");
    row.dataset.saving = "false";
    const current = fieldsForRow(row);
    if (current.save) {
      current.save.hidden = false;
      current.save.classList.remove("is-saved");
      current.save.textContent = "Save";
      current.save.disabled = false;
    }
    syncRows(Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || []));
    current[focusField]?.focus();
  }

  async function deleteInputsSavedRow(
    row,
    fieldsForRow,
    deleteAction,
    errorMessage,
    templateRefKey,
    templateId,
    syncRows,
    successMessage
  ) {
    if (row.dataset.saving === "true" || row.dataset.deleting === "true") return;
    const id = `${row.dataset.entryId || ""}`.trim();
    if (!id) {
      feedback(errorMessage, true);
      return;
    }
    row.dataset.deleting = "true";
    const current = fieldsForRow(row);
    if (current.save) current.save.disabled = true;
    if (current.edit) current.edit.disabled = true;
    if (current.remove) current.remove.disabled = true;
    try {
      await mutatePersistentState(deleteAction, { id });
    } catch (error) {
      row.dataset.deleting = "false";
      if (current.save) current.save.disabled = true;
      if (current.edit) current.edit.disabled = false;
      if (current.remove) current.remove.disabled = false;
      feedback(error.message || errorMessage, true);
      return;
    }

    const container = row.parentElement;
    const deletingTemplateRow = row === refs[templateRefKey];
    row.remove();
    if (deletingTemplateRow && container) {
      const nextTemplate = container.querySelector("form.input-row.input-row-body");
      if (nextTemplate) {
        refs[templateRefKey] = nextTemplate;
        refs[templateRefKey].id = templateId;
      }
    }
    if (container) {
      syncRows(Array.from(container.querySelectorAll("form.input-row.input-row-body")));
    }
    feedback(successMessage, false);
    postHeight();
  }

  function syncInputsRowInteractivity(
    rows,
    fieldsForRow,
    setRowSaved,
    setEditVisible,
    setDeleteVisible,
    canSaveRow
  ) {
    const list = Array.isArray(rows) ? rows : [];
    list.forEach((row) => {
      if (!row.dataset.rowState) {
        setInputsRowState(row, row.dataset.saved === "true" ? "saved" : "new");
      }
    });
    const unsavedRows = list.filter((row) => row.dataset.rowState !== "saved");
    const editingRow = unsavedRows.find((row) => row.dataset.rowState === "editing-saved") || null;
    const activeRow = editingRow || (unsavedRows.length ? unsavedRows[unsavedRows.length - 1] : null);

    list.forEach((row) => {
      const fields = fieldsForRow(row);
      const isSaved = row.dataset.rowState === "saved";
      const isSaving = row.dataset.saving === "true";
      const isActiveUnsaved = !isSaved && row === activeRow;
      const isEditingSaved = row.dataset.rowState === "editing-saved";

      if (isSaved) {
        setRowSaved(row);
        return;
      }
      setInputsRowState(row, isEditingSaved ? "editing-saved" : "new");
      row.dataset.editing = isActiveUnsaved && isEditingSaved ? "true" : "false";
      row.dataset.deleting = "false";
      setEditVisible(row, false);
      setDeleteVisible(row, false);

      Object.values(fields)
        .filter(
          (value) =>
            value &&
            typeof value.disabled === "boolean" &&
            value !== fields.save &&
            value !== fields.edit &&
            value !== fields.remove
        )
        .forEach((input) => {
          input.disabled = !isActiveUnsaved || isSaving;
        });

      if (fields.save) {
        const canSave = typeof canSaveRow === "function" ? !!canSaveRow(row) : true;
        fields.save.hidden = false;
        fields.save.classList.remove("is-saved");
        fields.save.textContent = isSaving ? "Saving..." : "Save";
        fields.save.disabled = !isActiveUnsaved || isSaving || !canSave;
      }
    });
  }

  function inputsTimeRowFields(row) {
    if (!row) return {};
    return {
      row,
      clientProject: row.querySelector(".cell-project select"),
      date: row.querySelector(".cell-date input"),
      hours: row.querySelector(".cell-hours input"),
      billable: row.querySelector(".cell-billable input[type='checkbox']"),
      notes: row.querySelector(".cell-notes input"),
      actions: row.querySelector(".cell-actions"),
      save: row.querySelector(".cell-actions .button"),
      edit: row.querySelector(".cell-actions [data-inputs-row-edit]"),
      remove: row.querySelector(".cell-actions [data-inputs-row-delete]"),
    };
  }

  function ensureInputsTimeEditButton(row) {
    return ensureInputsRowActionButton(row, inputsTimeRowFields, {
      existingKey: "edit",
      className: "inputs-row-edit",
      text: "Edit",
      datasetKey: "inputsRowEdit",
      boundFlag: "__inputsTimeBoundClick",
      onClick: function () {
        startInputsRowEdit(row, inputsTimeRowFields, syncInputsTimeRowInteractivity, "hours");
      },
    });
  }

  function ensureInputsTimeDeleteButton(row) {
    return ensureInputsRowActionButton(row, inputsTimeRowFields, {
      existingKey: "remove",
      className: "inputs-row-delete",
      text: "🗑",
      datasetKey: "inputsRowDelete",
      ariaLabel: "Delete row",
      title: "Delete",
      boundFlag: "__inputsTimeBoundClick",
      onClick: function () {
        deleteInputsSavedRow(
          row,
          inputsTimeRowFields,
          "delete_entry",
          "Unable to delete entry.",
          "inputsTimeForm",
          "inputs-time-form",
          syncInputsTimeRowInteractivity,
          "Entry deleted."
        );
      },
    });
  }

  function setInputsTimeEditButtonVisible(row, visible) {
    const editButton = ensureInputsTimeEditButton(row);
    if (!editButton) return;
    editButton.hidden = !visible;
    row.classList.toggle("has-edit-action", !!visible);
  }

  function setInputsTimeDeleteButtonVisible(row, visible) {
    const deleteButton = ensureInputsTimeDeleteButton(row);
    if (!deleteButton) return;
    deleteButton.hidden = !visible;
  }

  function setInputsTimeRowState(row, state) {
    setInputsRowState(row, state);
  }

  function isInputsTimeRowBlank(row) {
    if (!row) return false;
    const fields = inputsTimeRowFields(row);
    const hoursRaw = `${fields.hours?.value || ""}`.trim();
    const notesRaw = `${fields.notes?.value || ""}`.trim();
    const hasHours = hoursRaw !== "" && !Number.isNaN(Number(hoursRaw)) && Number(hoursRaw) > 0;
    return !hasHours && notesRaw === "";
  }

  function hasTrailingBlankInputsTimeRow(container) {
    return hasTrailingBlankInputsRow(container, isInputsTimeRowBlank);
  }

  function setInputsTimeRowSaved(row) {
    if (!row) return;
    setInputsTimeRowState(row, "saved");
    row.dataset.saving = "false";
    row.dataset.deleting = "false";
    const fields = inputsTimeRowFields(row);
    [fields.clientProject, fields.date, fields.hours, fields.billable, fields.notes].forEach((input) => {
      if (input) input.disabled = true;
    });
    if (fields.save) {
      fields.save.hidden = true;
      fields.save.disabled = true;
      fields.save.classList.remove("is-saved");
      fields.save.textContent = "Save";
    }
    setInputsTimeEditButtonVisible(row, true);
    setInputsTimeDeleteButtonVisible(row, true);
  }

  function syncInputsTimeRowInteractivity(rows) {
    syncInputsRowInteractivity(
      rows,
      inputsTimeRowFields,
      setInputsTimeRowSaved,
      setInputsTimeEditButtonVisible,
      setInputsTimeDeleteButtonVisible,
      isInputsTimeRowReadyToSave
    );
  }

  function inputsTimeComboOptions() {
    const projectItems = assignedProjectTuplesForCurrentUser().map((item) => ({
      type: "project",
      id: `${item.projectId || ""}`.trim() || findProjectIdByClientProject(item.client, item.project),
      client: item.client,
      project: item.project,
      label: `${item.client} / ${item.project}`,
      value: encodeInputsTimeCombo(item.client, item.project),
    }));
    const activeProjectItems = projectItems.filter((item) => {
      const itemProjectId = `${item?.id || ""}`.trim();
      const byId = itemProjectId
        ? (state.projects || []).find((project) => `${project?.id || ""}`.trim() === itemProjectId)
        : null;
      const byName = (state.projects || []).find(
        (project) =>
          `${project?.client || ""}`.trim() === `${item?.client || ""}`.trim() &&
          `${project?.name || project?.project || ""}`.trim() === `${item?.project || ""}`.trim()
      );
      const matchedProject = byId || byName || null;
      return !matchedProject || isProjectActive(matchedProject);
    });
    const corporateGroups = groupedCorporateFunctionCategoriesForInputs();
    if (!corporateGroups.length) {
      return activeProjectItems;
    }
    const corporateItems = corporateGroups.flatMap((group) => {
      const groupLabel = {
        type: "label",
        value: `${INPUTS_COMBO_SECTION_VALUE}-${group.groupId}`,
        label: group.groupName,
        disabled: true,
      };
      const categoryItems = group.categories.map((category) => ({
        type: "corporate",
        id: `${category?.id || ""}`.trim(),
        group_name: group.groupName,
        label: `${category?.name || ""}`,
        value: encodeInputsCorporateCombo(category?.id || ""),
      }));
      return [groupLabel, ...categoryItems];
    });
    const divider = {
      type: "divider",
      value: INPUTS_COMBO_DIVIDER_VALUE,
      label: "──────────",
      disabled: true,
    };
    return [
      ...activeProjectItems,
      ...(activeProjectItems.length ? [divider] : []),
      ...corporateItems,
    ];
  }

  function applyInputsTimeBillableDefaultForRow(row) {
    const fields = inputsTimeRowFields(row);
    if (!fields.clientProject || !fields.billable) return;
    const selection = readInputsComboSelectionMeta(fields.clientProject);
    if (selection.type === "corporate") {
      fields.billable.checked = false;
      fields.billable.disabled = true;
      return;
    }
    fields.billable.disabled = false;
    if (selection.type !== "project") {
      return;
    }
    const projectName = selection.project || "";
    fields.billable.checked = !isNonBillableDefault(projectName || "");
  }

  function syncInputsTimeDateInput(input) {
    if (!input) return;
    input.min = minEntryDate;
    input.max = today;
    if (window.datePicker && typeof window.datePicker.register === "function" && input.dataset.dpBound !== "true") {
      input.type = "date";
      input.value = clampDateToBounds(today);
      window.datePicker.register(input);
    }
    if (!input.value) {
      input.value = clampDateToBounds(today);
    }
    syncInputsTimeDateField(input);
  }

  function syncInputsTimeFormRow(row, options) {
    const fields = inputsTimeRowFields(row);
    if (!fields.clientProject) return;
    const optionList = Array.isArray(options) ? options : [];
    const optionHasValue = (value) =>
      optionList.some((item) => `${item?.value || ""}`.trim() === `${value || ""}`.trim());

    let selected = resolveInputsComboDefault(fields.clientProject.value || "", optionList);
    if (!selected) {
      const entryId = `${row.dataset.entryId || ""}`.trim();
      if (entryId) {
        const sourceEntry = (state.entries || []).find((item) => `${item?.id || ""}`.trim() === entryId);
        if (sourceEntry) {
          const sourceChargeCenterId = `${sourceEntry.chargeCenterId || sourceEntry.charge_center_id || ""}`.trim();
          const sourceProjectId = `${sourceEntry.projectId || sourceEntry.project_id || ""}`.trim();
          selected =
            sourceChargeCenterId && !sourceProjectId
              ? encodeInputsCorporateCombo(sourceChargeCenterId)
              : encodeInputsTimeCombo(sourceEntry.client || "", sourceEntry.project || "");
        }
      }
    }
    if (!fields.clientProject.value && selected) {
      fields.clientProject.value = selected;
    }

    let hydratedOptions = optionList;
    if (selected && !optionHasValue(selected)) {
      if (selected.startsWith(INPUTS_COMBO_CORPORATE_PREFIX)) {
        const categoryId = decodeInputsCorporateCombo(selected);
        const category = (state.corporateFunctionCategories || []).find(
          (item) => `${item?.id || ""}`.trim() === categoryId
        );
        const categoryName = `${category?.name || ""}`.trim() || "Internal";
        hydratedOptions = [
          {
            type: "corporate",
            id: categoryId,
            label: categoryName,
            value: selected,
          },
          ...optionList,
        ];
      } else {
        const [clientName, projectName] = decodeInputsTimeCombo(selected);
        const comboLabel =
          clientName && projectName ? `${clientName} / ${projectName}` : "Client / Project";
        hydratedOptions = [
          {
            type: "project",
            id: findProjectIdByClientProject(clientName, projectName),
            client: clientName,
            project: projectName,
            label: comboLabel,
            value: selected,
          },
          ...optionList,
        ];
      }
    }

    setSelectOptionsWithPlaceholder(
      { escapeHtml },
      fields.clientProject,
      hydratedOptions,
      selected,
      "Client / Project",
      { disabled: true, hidden: true, type: "placeholder" }
    );
    fields.clientProject.disabled = hydratedOptions.length === 0;

    if (fields.billable && row.dataset.lastCombo !== fields.clientProject.value) {
      applyInputsTimeBillableDefaultForRow(row);
    }
    row.dataset.lastCombo = fields.clientProject.value || "";

    syncInputsTimeDateInput(fields.date);
  }

  function isInputsTimeRowReadyToSave(row) {
    const fields = inputsTimeRowFields(row);
    const hours = Number(fields.hours?.value);
    const normalizedDate = parseInputsTimeDateValue(fields.date?.value || "");
    return Boolean(fields.clientProject?.value) && Boolean(normalizedDate) && Number.isFinite(hours) && hours > 0;
  }

  function addInputsTimeRowFrom(sourceRow, options) {
    const template = refs.inputsTimeForm;
    const container = template?.parentElement;
    if (!template || !container) return null;
    const source = inputsTimeRowFields(sourceRow);
    const next = template.cloneNode(true);
    next.removeAttribute("id");
    next.dataset.boundHandlers = "";
    next.dataset.lastCombo = "";
    delete next.dataset.entryId;
    delete next.dataset.createdAt;
    setInputsTimeRowState(next, "new");
    next.dataset.saving = "false";
    next.dataset.deleting = "false";
    container.appendChild(next);

    const nextFields = inputsTimeRowFields(next);
    if (nextFields.save) {
      nextFields.save.hidden = false;
      nextFields.save.textContent = "Save";
      nextFields.save.disabled = false;
      nextFields.save.classList.remove("is-saved");
    }
    setInputsTimeEditButtonVisible(next, false);
    setInputsTimeDeleteButtonVisible(next, false);
    [nextFields.clientProject, nextFields.date, nextFields.hours, nextFields.billable, nextFields.notes].forEach(
      (input) => {
        if (input) input.disabled = false;
      }
    );
    if (nextFields.hours) nextFields.hours.value = "";
    if (nextFields.notes) nextFields.notes.value = "";
    if (nextFields.date) {
      delete nextFields.date.dataset.dpBound;
      const sourceIso =
        source.date?.dataset.dpCanonical ||
        parseInputsTimeDateValue(source.date?.value || "") ||
        clampDateToBounds(today);
      nextFields.date.dataset.dpCanonical = sourceIso;
      const isDesktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
      nextFields.date.value = isDesktop ? formatDisplayDateShort(sourceIso) : sourceIso;
    }
    if (nextFields.clientProject && source.clientProject) {
      nextFields.clientProject.value = source.clientProject.value || "";
    }
    syncInputsTimeFormRow(next, options);
    bindInputsTimeFormRow(next);
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    syncInputsTimeRowInteractivity(rows);
    nextFields.hours?.focus();
    return next;
  }

  function bindInputsTimeFormRow(row) {
    if (!row || row.dataset.boundHandlers === "true") return;
    const fields = inputsTimeRowFields(row);
    if (!fields.clientProject) return;

    fields.clientProject.addEventListener("change", function () {
      const selection = readInputsComboSelectionMeta(fields.clientProject);
      if (selection.type === "project") {
        row.dataset.inputsSelectionType = "project";
        row.dataset.projectId = `${selection.id || ""}`.trim();
        row.dataset.corporateCategoryId = "";
        state.inputsTimeSelectedCorporateCategoryId = "";
        applyInputsTimeBillableDefaultForRow(row);
      } else if (selection.type === "corporate") {
        row.dataset.inputsSelectionType = "corporate";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = `${selection.id || ""}`.trim();
        state.inputsTimeSelectedCorporateCategoryId = `${selection.id || ""}`.trim();
        applyInputsTimeBillableDefaultForRow(row);
      } else {
        row.dataset.inputsSelectionType = "";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = "";
        state.inputsTimeSelectedCorporateCategoryId = "";
        applyInputsTimeBillableDefaultForRow(row);
      }
      row.dataset.lastCombo = fields.clientProject.value || "";
    });

    fields.date?.addEventListener("change", function () {
      syncInputsTimeDateField(fields.date);
    });
    fields.billable?.addEventListener("change", function () {
      if (`${row.dataset.inputsSelectionType || ""}`.trim() === "corporate") {
        fields.billable.checked = false;
      }
    });
    const submitTimeRowFromSave = function (event) {
      event.preventDefault();
      if (row.dataset.rowState === "saved" || row.dataset.saving === "true" || row.dataset.deleting === "true") {
        return;
      }
      row.requestSubmit();
    };
    fields.save?.addEventListener("pointerdown", submitTimeRowFromSave);
    fields.save?.addEventListener("click", submitTimeRowFromSave);

    const refreshTimeRowInteractivity = function () {
      syncInputsTimeRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
    };
    row.addEventListener("input", refreshTimeRowInteractivity);
    row.addEventListener("change", refreshTimeRowInteractivity);
    applyInputsTimeBillableDefaultForRow(row);

    row.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (row.dataset.rowState === "saved" || row.dataset.saving === "true" || row.dataset.deleting === "true") {
        return;
      }
      const wasEditingSavedRow = row.dataset.rowState === "editing-saved";
      row.dataset.saving = "true";
      row.dataset.editing = "false";
      syncInputsTimeRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
      const current = inputsTimeRowFields(row);
      const existingId = `${row.dataset.entryId || ""}`.trim();
      const existingCreatedAt = `${row.dataset.createdAt || ""}`.trim();
      const existingEntries = Array.isArray(state.entries) ? state.entries : [];
      const previousEntry = existingId
        ? existingEntries.find((item) => String(item?.id || "").trim() === existingId) || null
        : null;
      const preservedUserId = wasEditingSavedRow
        ? `${previousEntry?.userId || previousEntry?.user_id || ""}`.trim()
        : "";
      const preservedUserName = wasEditingSavedRow
        ? `${previousEntry?.user || ""}`.trim()
        : "";
      const selection = readInputsComboSelectionMeta(current.clientProject);
      const isCorporate = selection.type === "corporate";
      const [clientName, projectName] = isCorporate
        ? ["", ""]
        : decodeInputsTimeCombo(current.clientProject?.value || "");
      const projectId = isCorporate
        ? ""
        : `${selection.id || row.dataset.projectId || ""}`.trim();
      const chargeCenterId = isCorporate
        ? `${selection.id || row.dataset.corporateCategoryId || ""}`.trim()
        : "";
      const actingAsUserId = resolveActingAsUserId();
      const nextEntry = {
        id: existingId || crypto.randomUUID(),
        user: preservedUserName || state.currentUser?.displayName || "",
        userId: preservedUserId || state.currentUser?.id || "",
        date: parseInputsTimeDateValue(current.date?.value || ""),
        client: isCorporate ? "Internal" : clientName || "",
        project: isCorporate ? "" : projectName || "",
        projectId: projectId || null,
        chargeCenterId: chargeCenterId || null,
        task: "",
        hours: Number(current.hours?.value),
        notes: (current.notes?.value || "").trim(),
        billable: isCorporate ? false : current.billable ? current.billable.checked : true,
        createdAt: existingCreatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
      };

      const error = validateEntry(nextEntry);
      if (error) {
        row.dataset.saving = "false";
        setInputsTimeRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
        syncInputsTimeRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        feedback(error, true);
        return;
      }

      const nextEntryId = String(nextEntry.id || "").trim();
      if (nextEntryId) {
        const preservedEntries = existingEntries.filter(
          (item) => String(item?.id || "").trim() !== nextEntryId
        );
        state.entries = preservedEntries.concat({ ...nextEntry });
      }
      refreshInputsDrilldownAfterLocalMutation("time");
      row.dataset.entryId = nextEntry.id;
      row.dataset.createdAt = nextEntry.createdAt;
      setInputsTimeRowSaved(row);
      row.dataset.saving = "false";
      const container = row.parentElement;
      const shouldAddNextRow = !hasTrailingBlankInputsTimeRow(container);
      if (shouldAddNextRow) {
        addInputsTimeRowFrom(row, inputsTimeComboOptions());
      } else if (container) {
        syncInputsTimeRowInteractivity(
          Array.from(container.querySelectorAll("form.input-row.input-row-body"))
        );
      }
      mutatePersistentState(
        "save_entry",
        wasEditingSavedRow ? { entry: nextEntry } : { entry: nextEntry, actingAsUserId },
        { skipHydrate: true, refreshState: false, returnState: false }
      )
        .then(() => {
          feedback("Entry saved.", false);
        })
        .catch((error) => {
          if (nextEntryId) {
            const latestEntries = Array.isArray(state.entries) ? state.entries : [];
            const withoutOptimistic = latestEntries.filter(
              (item) => String(item?.id || "").trim() !== nextEntryId
            );
            state.entries = previousEntry ? withoutOptimistic.concat(previousEntry) : withoutOptimistic;
          }
          if (previousEntry?.id) {
            row.dataset.entryId = String(previousEntry.id);
            row.dataset.createdAt = String(previousEntry.createdAt || "");
          } else {
            delete row.dataset.entryId;
            delete row.dataset.createdAt;
          }
          row.dataset.saving = "false";
          setInputsTimeRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
          syncInputsTimeRowInteractivity(
            Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
          );
          refreshInputsDrilldownAfterLocalMutation("time");
          feedback(error.message || "Unable to save entry.", true);
          postHeight();
        });
      postHeight();
    });

    row.dataset.boundHandlers = "true";
  }

  function populateInputsTimeRowForEntryEdit(row, entry, options) {
    if (!row || !entry) return;
    const chargeCenterId = `${entry.chargeCenterId || entry.charge_center_id || ""}`.trim();
    const projectId = `${entry.projectId || entry.project_id || ""}`.trim();
    const isCorporate = Boolean(chargeCenterId) && !projectId;
    const comboValue = isCorporate
      ? encodeInputsCorporateCombo(chargeCenterId)
      : encodeInputsTimeCombo(entry.client || "", entry.project || "");
    const comboLabel = `${entry.client || ""} / ${entry.project || ""}`;
    const optionList = Array.isArray(options) ? options : [];
    const hydratedOptions =
      comboValue && !optionList.some((item) => item?.value === comboValue)
        ? [{ label: comboLabel, value: comboValue }, ...optionList]
        : optionList;
    syncInputsTimeFormRow(row, hydratedOptions);
    bindInputsTimeFormRow(row);
    const fields = inputsTimeRowFields(row);
    const dateIso = parseInputsTimeDateValue(entry.date || "") || clampDateToBounds(today);
    const isDesktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
    const hours = Number(entry.hours);

    setInputsTimeRowState(row, "editing-saved");
    row.dataset.entryId = `${entry.id || ""}`.trim();
    row.dataset.createdAt = `${entry.createdAt || new Date().toISOString()}`.trim();
    row.dataset.saving = "false";
    row.dataset.deleting = "false";
    row.dataset.lastCombo = comboValue;
    row.dataset.inputsSelectionType = isCorporate ? "corporate" : "project";
    row.dataset.projectId = isCorporate ? "" : projectId;
    row.dataset.corporateCategoryId = isCorporate ? chargeCenterId : "";

    [fields.clientProject, fields.date, fields.hours, fields.billable, fields.notes].forEach((input) => {
      if (input) input.disabled = false;
    });
    if (fields.clientProject) {
      fields.clientProject.value = comboValue;
    }
    if (fields.date) {
      fields.date.dataset.dpCanonical = dateIso;
      fields.date.value = isDesktop ? formatDisplayDateShort(dateIso) : dateIso;
    }
    if (fields.hours) {
      fields.hours.value = Number.isFinite(hours) && hours > 0 ? String(hours) : "";
    }
    if (fields.billable) {
      fields.billable.checked = entry.billable !== false;
    }
    if (fields.notes) {
      fields.notes.value = typeof entry.notes === "string" ? entry.notes : "";
    }
    if (fields.save) {
      fields.save.hidden = false;
      fields.save.disabled = false;
      fields.save.classList.remove("is-saved");
      fields.save.textContent = "Save";
    }
    setInputsTimeEditButtonVisible(row, false);
    setInputsTimeDeleteButtonVisible(row, false);
  }

  function consumePendingInputsTimeEdit(options) {
    const pendingId = `${state.pendingInputsTimeEditId || ""}`.trim();
    if (!pendingId) return;
    state.pendingInputsTimeEditId = "";
    const entry = (state.entries || []).find((item) => `${item?.id || ""}`.trim() === pendingId);
    if (!entry || !refs.inputsTimeForm) return;
    const container = refs.inputsTimeForm.parentElement;
    const existingRows = Array.from(container?.querySelectorAll("form.input-row.input-row-body") || []);
    let targetRow =
      [...existingRows].reverse().find((row) => row.dataset.rowState !== "saved" && isInputsTimeRowBlank(row)) ||
      [...existingRows].reverse().find((row) => row.dataset.rowState !== "saved") ||
      null;
    if (!targetRow) {
      targetRow = addInputsTimeRowFrom(refs.inputsTimeForm, options) || refs.inputsTimeForm;
    }
    populateInputsTimeRowForEntryEdit(targetRow, entry, options);
    const rows = Array.from(container?.querySelectorAll("form.input-row.input-row-body") || []);
    syncInputsTimeRowInteractivity(rows);
    const fields = inputsTimeRowFields(targetRow);
    fields.hours?.focus();
  }

  function syncInputsTimeRow() {
    if (!refs.inputsTimeForm) return;
    const container = refs.inputsTimeForm.parentElement;
    if (!container) return;
    const options = inputsTimeComboOptions();
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    rows.forEach((row) => {
      if (!row.dataset.rowState) {
        setInputsTimeRowState(row, row.dataset.saved === "true" ? "saved" : "new");
      }
      syncInputsTimeFormRow(row, options);
      bindInputsTimeFormRow(row);
    });
    consumePendingInputsTimeEdit(options);
    syncInputsTimeRowInteractivity(rows);
  }

  function inputsExpenseRowFields(row) {
    if (!row) return {};
    return {
      row,
      clientProject: row.querySelector(".cell-project select"),
      date: row.querySelector(".cell-date input"),
      category: row.querySelector(".cell-category select"),
      amount: row.querySelector(".cell-amount input"),
      billable: row.querySelector(".cell-billable input[type='checkbox']"),
      notes: row.querySelector(".cell-notes input"),
      actions: row.querySelector(".cell-actions"),
      save: row.querySelector(".cell-actions .button"),
      edit: row.querySelector(".cell-actions [data-inputs-row-edit]"),
      remove: row.querySelector(".cell-actions [data-inputs-row-delete]"),
    };
  }

  function ensureInputsExpenseEditButton(row) {
    return ensureInputsRowActionButton(row, inputsExpenseRowFields, {
      existingKey: "edit",
      className: "inputs-row-edit",
      text: "Edit",
      datasetKey: "inputsRowEdit",
      boundFlag: "__inputsExpenseBoundClick",
      onClick: function () {
        startInputsRowEdit(row, inputsExpenseRowFields, syncInputsExpenseRowInteractivity, "amount");
      },
    });
  }

  function ensureInputsExpenseDeleteButton(row) {
    return ensureInputsRowActionButton(row, inputsExpenseRowFields, {
      existingKey: "remove",
      className: "inputs-row-delete",
      text: "🗑",
      datasetKey: "inputsRowDelete",
      ariaLabel: "Delete row",
      title: "Delete",
      boundFlag: "__inputsExpenseBoundClick",
      onClick: function () {
        deleteInputsSavedRow(
          row,
          inputsExpenseRowFields,
          "delete_expense",
          "Unable to delete expense.",
          "inputsExpenseForm",
          "inputs-expense-form",
          syncInputsExpenseRowInteractivity,
          "Expense deleted."
        );
      },
    });
  }

  function setInputsExpenseEditButtonVisible(row, visible) {
    const editButton = ensureInputsExpenseEditButton(row);
    if (!editButton) return;
    editButton.hidden = !visible;
    row.classList.toggle("has-edit-action", !!visible);
  }

  function setInputsExpenseDeleteButtonVisible(row, visible) {
    const deleteButton = ensureInputsExpenseDeleteButton(row);
    if (!deleteButton) return;
    deleteButton.hidden = !visible;
  }

  function setInputsExpenseRowState(row, state) {
    setInputsRowState(row, state);
  }

  function isInputsExpenseRowBlank(row) {
    if (!row) return false;
    const fields = inputsExpenseRowFields(row);
    const amountRaw = `${fields.amount?.value || ""}`.trim();
    const notesRaw = `${fields.notes?.value || ""}`.trim();
    const categoryRaw = `${fields.category?.value || ""}`.trim();
    const hasAmount = amountRaw !== "" && !Number.isNaN(Number(amountRaw)) && Number(amountRaw) > 0;
    return !hasAmount && notesRaw === "" && categoryRaw === "";
  }

  function hasTrailingBlankInputsExpenseRow(container) {
    return hasTrailingBlankInputsRow(container, isInputsExpenseRowBlank);
  }

  function setInputsExpenseRowSaved(row) {
    if (!row) return;
    setInputsExpenseRowState(row, "saved");
    row.dataset.saving = "false";
    row.dataset.deleting = "false";
    const fields = inputsExpenseRowFields(row);
    [fields.clientProject, fields.date, fields.category, fields.amount, fields.billable, fields.notes].forEach(
      (input) => {
        if (input) input.disabled = true;
      }
    );
    if (fields.save) {
      fields.save.hidden = true;
      fields.save.disabled = true;
      fields.save.classList.remove("is-saved");
      fields.save.textContent = "Save";
    }
    setInputsExpenseEditButtonVisible(row, true);
    setInputsExpenseDeleteButtonVisible(row, true);
  }

  function syncInputsExpenseRowInteractivity(rows) {
    syncInputsRowInteractivity(
      rows,
      inputsExpenseRowFields,
      setInputsExpenseRowSaved,
      setInputsExpenseEditButtonVisible,
      setInputsExpenseDeleteButtonVisible,
      isInputsExpenseRowReadyToSave
    );
  }

  function inputsExpenseComboOptions() {
    return inputsTimeComboOptions();
  }

  function isRealClientProjectSelection(selection) {
    const type = `${selection?.type || ""}`.trim();
    if (type !== "project") return false;
    const clientName = `${selection?.client || ""}`.trim();
    const projectName = `${selection?.project || ""}`.trim();
    if (!clientName || !projectName) return false;
    if (clientName.toLowerCase() === "internal") return false;
    if (isNonBillableDefault(projectName)) return false;
    return true;
  }

  function inputsExpenseCategoryOptions(selection) {
    const useProjectCategories = isRealClientProjectSelection(selection);
    if (useProjectCategories) {
      return (Array.isArray(state.projectExpenseCategories) ? state.projectExpenseCategories : [])
        .map((item) => {
          const name = `${item?.name || ""}`.trim();
          return name ? { label: name, value: name } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const categories = typeof activeExpenseCategories === "function" ? activeExpenseCategories() : [];
    return categories
      .map((item) => ({ label: item.name, value: item.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function applyInputsExpenseBillableDefaultForRow(row) {
    const fields = inputsExpenseRowFields(row);
    if (!fields.clientProject || !fields.billable) return;
    const selection = readInputsComboSelectionMeta(fields.clientProject);
    if (selection.type === "corporate") {
      fields.billable.checked = false;
      fields.billable.disabled = true;
      return;
    }
    fields.billable.disabled = false;
    if (selection.type !== "project") {
      return;
    }
    const projectName = selection.project || "";
    fields.billable.checked = !isNonBillableDefault(projectName || "");
  }

  function syncInputsExpenseFormRow(row, comboOptions, categoryOptions) {
    const fields = inputsExpenseRowFields(row);
    if (!fields.clientProject) return;
    const selectedCombo = fields.clientProject.value || "";
    setSelectOptionsWithPlaceholder(
      { escapeHtml },
      fields.clientProject,
      comboOptions,
      selectedCombo,
      "Client / Project",
      { disabled: true, hidden: true, type: "placeholder" }
    );
    fields.clientProject.disabled = comboOptions.length === 0;

    const selection = readInputsComboSelectionMeta(fields.clientProject);
    const scopedCategoryOptions = inputsExpenseCategoryOptions(selection);
    const selectedCategory = fields.category?.value || "";
    if (fields.category) {
      const hasSelectedCategory = scopedCategoryOptions.some((item) => item?.value === selectedCategory);
      const nextSelectedCategory = hasSelectedCategory ? selectedCategory : "";
      if (!hasSelectedCategory && selectedCategory) {
        fields.category.value = "";
      }
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        fields.category,
        scopedCategoryOptions,
        nextSelectedCategory,
        "Category"
      );
      fields.category.disabled = scopedCategoryOptions.length === 0;
    }

    if (fields.billable && row.dataset.lastCombo !== fields.clientProject.value) {
      applyInputsExpenseBillableDefaultForRow(row);
    }
    row.dataset.lastCombo = fields.clientProject.value || "";

    syncInputsTimeDateInput(fields.date);
  }

  function isInputsExpenseRowReadyToSave(row) {
    const fields = inputsExpenseRowFields(row);
    const amount = Number(fields.amount?.value);
    const normalizedDate = parseInputsTimeDateValue(fields.date?.value || "");
    return (
      Boolean(fields.clientProject?.value) &&
      Boolean(normalizedDate) &&
      Boolean(fields.category?.value) &&
      Number.isFinite(amount) &&
      amount > 0
    );
  }

  function addInputsExpenseRowFrom(sourceRow, comboOptions, categoryOptions) {
    const template = refs.inputsExpenseForm;
    const container = template?.parentElement;
    if (!template || !container) return null;
    const source = inputsExpenseRowFields(sourceRow);
    const next = template.cloneNode(true);
    next.removeAttribute("id");
    next.dataset.boundHandlers = "";
    next.dataset.lastCombo = "";
    delete next.dataset.entryId;
    delete next.dataset.createdAt;
    setInputsExpenseRowState(next, "new");
    next.dataset.saving = "false";
    next.dataset.deleting = "false";
    container.appendChild(next);

    const nextFields = inputsExpenseRowFields(next);
    if (nextFields.save) {
      nextFields.save.hidden = false;
      nextFields.save.textContent = "Save";
      nextFields.save.disabled = false;
      nextFields.save.classList.remove("is-saved");
    }
    setInputsExpenseEditButtonVisible(next, false);
    setInputsExpenseDeleteButtonVisible(next, false);
    [nextFields.clientProject, nextFields.date, nextFields.category, nextFields.amount, nextFields.billable, nextFields.notes].forEach(
      (input) => {
        if (input) input.disabled = false;
      }
    );
    if (nextFields.amount) nextFields.amount.value = "";
    if (nextFields.notes) nextFields.notes.value = "";
    if (nextFields.category) nextFields.category.value = "";
    if (nextFields.date) {
      delete nextFields.date.dataset.dpBound;
      const sourceIso =
        source.date?.dataset.dpCanonical ||
        parseInputsTimeDateValue(source.date?.value || "") ||
        clampDateToBounds(today);
      nextFields.date.dataset.dpCanonical = sourceIso;
      const isDesktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
      nextFields.date.value = isDesktop ? formatDisplayDateShort(sourceIso) : sourceIso;
    }
    if (nextFields.clientProject && source.clientProject) {
      nextFields.clientProject.value = source.clientProject.value || "";
    }
    syncInputsExpenseFormRow(next, comboOptions, categoryOptions);
    bindInputsExpenseFormRow(next);
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    syncInputsExpenseRowInteractivity(rows);
    nextFields.amount?.focus();
    return next;
  }

  function bindInputsExpenseFormRow(row) {
    if (!row || row.dataset.boundHandlers === "true") return;
    const fields = inputsExpenseRowFields(row);
    if (!fields.clientProject) return;

    fields.clientProject.addEventListener("change", function () {
      const selection = readInputsComboSelectionMeta(fields.clientProject);
      if (selection.type === "project") {
        row.dataset.inputsSelectionType = "project";
        row.dataset.projectId = `${selection.id || ""}`.trim();
        row.dataset.corporateCategoryId = "";
        state.inputsExpenseSelectedCorporateCategoryId = "";
        applyInputsExpenseBillableDefaultForRow(row);
      } else if (selection.type === "corporate") {
        row.dataset.inputsSelectionType = "corporate";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = `${selection.id || ""}`.trim();
        state.inputsExpenseSelectedCorporateCategoryId = `${selection.id || ""}`.trim();
        applyInputsExpenseBillableDefaultForRow(row);
      } else {
        row.dataset.inputsSelectionType = "";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = "";
        state.inputsExpenseSelectedCorporateCategoryId = "";
        applyInputsExpenseBillableDefaultForRow(row);
      }
      syncInputsExpenseFormRow(row, inputsExpenseComboOptions(), inputsExpenseCategoryOptions());
      row.dataset.lastCombo = fields.clientProject.value || "";
    });

    fields.date?.addEventListener("change", function () {
      syncInputsTimeDateField(fields.date);
    });
    fields.billable?.addEventListener("change", function () {
      if (`${row.dataset.inputsSelectionType || ""}`.trim() === "corporate") {
        fields.billable.checked = false;
      }
    });
    const submitExpenseRowFromSave = function (event) {
      event.preventDefault();
      if (row.dataset.rowState === "saved" || row.dataset.saving === "true" || row.dataset.deleting === "true") {
        return;
      }
      row.requestSubmit();
    };
    fields.save?.addEventListener("pointerdown", submitExpenseRowFromSave);
    fields.save?.addEventListener("click", submitExpenseRowFromSave);

    const refreshExpenseRowInteractivity = function () {
      syncInputsExpenseRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
    };
    row.addEventListener("input", refreshExpenseRowInteractivity);
    row.addEventListener("change", refreshExpenseRowInteractivity);
    applyInputsExpenseBillableDefaultForRow(row);

    row.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (row.dataset.rowState === "saved" || row.dataset.saving === "true" || row.dataset.deleting === "true") {
        return;
      }
      const wasEditingSavedRow = row.dataset.rowState === "editing-saved";
      row.dataset.saving = "true";
      row.dataset.editing = "false";
      syncInputsExpenseRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
      const current = inputsExpenseRowFields(row);
      const existingId = `${row.dataset.entryId || ""}`.trim();
      const existingCreatedAt = `${row.dataset.createdAt || ""}`.trim();
      const existingExpenses = Array.isArray(state.expenses) ? state.expenses : [];
      const previousExpense = existingId
        ? existingExpenses.find((item) => String(item?.id || "").trim() === existingId) || null
        : null;
      const preservedExpenseUserId = wasEditingSavedRow
        ? `${previousExpense?.userId || previousExpense?.user_id || ""}`.trim()
        : "";
      const selection = readInputsComboSelectionMeta(current.clientProject);
      const isCorporate = selection.type === "corporate";
      const [clientName, projectName] = isCorporate
        ? ["", ""]
        : decodeInputsTimeCombo(current.clientProject?.value || "");
      const actingAsUserId = resolveActingAsUserId();
      const nextExpense = {
        id: existingId || crypto.randomUUID(),
        userId: preservedExpenseUserId || state.currentUser?.id || "",
        clientName: isCorporate ? "Internal" : clientName || "",
        projectName: isCorporate
          ? (() => {
              const categoryName = `${selection.label || ""}`.replace(/\s+/g, " ").trim();
              const groupName = `${selection.group_name || ""}`.trim();
              if (groupName && categoryName) return `${groupName} / ${categoryName}`;
              return categoryName || groupName || "Internal";
            })()
          : projectName || "",
        chargeCenterId: isCorporate ? `${selection.id || ""}`.trim() || null : null,
        expenseDate: parseInputsTimeDateValue(current.date?.value || ""),
        category: current.category?.value || "",
        amount: Number(current.amount?.value),
        isBillable: isCorporate ? false : current.billable ? current.billable.checked : true,
        notes: (current.notes?.value || "").trim(),
        createdAt: existingCreatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
      };

      const error = validateExpenseForm(nextExpense);
      if (error) {
        row.dataset.saving = "false";
        setInputsExpenseRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
        syncInputsExpenseRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        feedback(error, true);
        return;
      }

      const nextExpenseId = String(nextExpense.id || "").trim();
      feedback("Expense saved.", false);
      if (nextExpenseId) {
        const preservedExpenses = existingExpenses.filter(
          (item) => String(item?.id || "").trim() !== nextExpenseId
        );
        state.expenses = preservedExpenses.concat({ ...nextExpense });
      }
      refreshInputsDrilldownAfterLocalMutation("expenses");
      row.dataset.entryId = nextExpense.id;
      row.dataset.createdAt = nextExpense.createdAt;
      setInputsExpenseRowSaved(row);
      row.dataset.saving = "false";
      const container = row.parentElement;
      const shouldAddNextRow = !hasTrailingBlankInputsExpenseRow(container);
      if (shouldAddNextRow) {
        addInputsExpenseRowFrom(row, inputsExpenseComboOptions(), inputsExpenseCategoryOptions());
      } else if (container) {
        syncInputsExpenseRowInteractivity(
          Array.from(container.querySelectorAll("form.input-row.input-row-body"))
        );
      }
      mutatePersistentState(
        wasEditingSavedRow ? "update_expense" : "create_expense",
        wasEditingSavedRow
          ? { expense: nextExpense }
          : { expense: nextExpense, actingAsUserId },
        { skipHydrate: true, refreshState: false, returnState: false }
      ).catch((error) => {
        if (nextExpenseId) {
          const latestExpenses = Array.isArray(state.expenses) ? state.expenses : [];
          const withoutOptimistic = latestExpenses.filter(
            (item) => String(item?.id || "").trim() !== nextExpenseId
          );
          state.expenses = previousExpense ? withoutOptimistic.concat(previousExpense) : withoutOptimistic;
        }
        if (previousExpense?.id) {
          row.dataset.entryId = String(previousExpense.id);
          row.dataset.createdAt = String(previousExpense.createdAt || "");
        } else {
          delete row.dataset.entryId;
          delete row.dataset.createdAt;
        }
        row.dataset.saving = "false";
        setInputsExpenseRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
        syncInputsExpenseRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        refreshInputsDrilldownAfterLocalMutation("expenses");
        feedback(error.message || "Unable to save expense.", true);
        postHeight();
      });
      postHeight();
    });

    row.dataset.boundHandlers = "true";
  }

  function populateInputsExpenseRowForEdit(row, expense, comboOptions, categoryOptions) {
    if (!row || !expense) return;
    const comboValue = encodeInputsTimeCombo(expense.clientName || "", expense.projectName || "");
    const comboLabel = `${expense.clientName || ""} / ${expense.projectName || ""}`;
    const safeComboOptions = Array.isArray(comboOptions) ? comboOptions : [];
    const safeCategoryOptions = Array.isArray(categoryOptions) ? categoryOptions : [];
    const hydratedComboOptions =
      comboValue && !safeComboOptions.some((item) => item?.value === comboValue)
        ? [{ label: comboLabel, value: comboValue }, ...safeComboOptions]
        : safeComboOptions;
    const hydratedCategoryOptions =
      expense.category && !safeCategoryOptions.some((item) => item?.value === expense.category)
        ? [{ label: expense.category, value: expense.category }, ...safeCategoryOptions]
        : safeCategoryOptions;
    syncInputsExpenseFormRow(row, hydratedComboOptions, hydratedCategoryOptions);
    bindInputsExpenseFormRow(row);
    const fields = inputsExpenseRowFields(row);
    const dateIso =
      parseInputsTimeDateValue(expense.expenseDate || expense.date || "") || clampDateToBounds(today);
    const isDesktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
    const amount = Number(expense.amount);

    setInputsExpenseRowState(row, "editing-saved");
    row.dataset.entryId = `${expense.id || ""}`.trim();
    row.dataset.createdAt = `${expense.createdAt || new Date().toISOString()}`.trim();
    row.dataset.saving = "false";
    row.dataset.deleting = "false";
    row.dataset.lastCombo = comboValue;

    [fields.clientProject, fields.date, fields.category, fields.amount, fields.billable, fields.notes].forEach(
      (input) => {
        if (input) input.disabled = false;
      }
    );
    if (fields.clientProject) {
      fields.clientProject.value = comboValue;
    }
    if (fields.date) {
      fields.date.dataset.dpCanonical = dateIso;
      fields.date.value = isDesktop ? formatDisplayDateShort(dateIso) : dateIso;
    }
    if (fields.category) {
      fields.category.value = typeof expense.category === "string" ? expense.category : "";
    }
    if (fields.amount) {
      fields.amount.value = Number.isFinite(amount) && amount > 0 ? String(amount) : "";
    }
    if (fields.billable) {
      fields.billable.checked = expense.isBillable !== false;
    }
    if (fields.notes) {
      fields.notes.value = typeof expense.notes === "string" ? expense.notes : "";
    }
    if (fields.save) {
      fields.save.hidden = false;
      fields.save.disabled = false;
      fields.save.classList.remove("is-saved");
      fields.save.textContent = "Save";
    }
    setInputsExpenseEditButtonVisible(row, false);
    setInputsExpenseDeleteButtonVisible(row, false);
  }

  function consumePendingInputsExpenseEdit(comboOptions, categoryOptions) {
    const pendingId = `${state.pendingInputsExpenseEditId || ""}`.trim();
    if (!pendingId) return;
    state.pendingInputsExpenseEditId = "";
    const expense = (state.expenses || []).find((item) => `${item?.id || ""}`.trim() === pendingId);
    if (!expense || !refs.inputsExpenseForm) return;
    const container = refs.inputsExpenseForm.parentElement;
    const existingRows = Array.from(container?.querySelectorAll("form.input-row.input-row-body") || []);
    let targetRow =
      [...existingRows].reverse().find((row) => row.dataset.rowState !== "saved" && isInputsExpenseRowBlank(row)) ||
      [...existingRows].reverse().find((row) => row.dataset.rowState !== "saved") ||
      null;
    if (!targetRow) {
      targetRow =
        addInputsExpenseRowFrom(refs.inputsExpenseForm, comboOptions, categoryOptions) || refs.inputsExpenseForm;
    }
    populateInputsExpenseRowForEdit(targetRow, expense, comboOptions, categoryOptions);
    const rows = Array.from(container?.querySelectorAll("form.input-row.input-row-body") || []);
    syncInputsExpenseRowInteractivity(rows);
    const fields = inputsExpenseRowFields(targetRow);
    fields.amount?.focus();
  }

  function syncInputsExpenseRow() {
    if (!refs.inputsExpenseForm) return;
    const container = refs.inputsExpenseForm.parentElement;
    if (!container) return;
    const comboOptions = inputsExpenseComboOptions();
    const categoryOptions = inputsExpenseCategoryOptions();
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    rows.forEach((row) => {
      if (!row.dataset.rowState) {
        setInputsExpenseRowState(row, row.dataset.saved === "true" ? "saved" : "new");
      }
      syncInputsExpenseFormRow(row, comboOptions, categoryOptions);
      bindInputsExpenseFormRow(row);
    });
    consumePendingInputsExpenseEdit(comboOptions, categoryOptions);
    syncInputsExpenseRowInteractivity(rows);
  }

  function closeInputsDesktopDatePopover() {
    if (!window.datePicker) return;
    if (typeof window.datePicker.close === "function") {
      window.datePicker.close();
      return;
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  function findInputsExpandableControl(target) {
    if (!(target instanceof Element) || !refs.inputsView) return null;
    const control = target.closest("select, input.dp-desktop-date, input[type='date']");
    if (!control || !refs.inputsView.contains(control)) return null;
    return control;
  }

  function isInputsDateControl(control) {
    return control instanceof HTMLElement && control.matches("input.dp-desktop-date, input[type='date']");
  }

  function feedback(message, isError) {
    const text = message || "";
    if (!text) {
      if (refs.feedback) {
        refs.feedback.textContent = "";
        refs.feedback.dataset.error = "false";
      }
      if (refs.inputsFeedback) {
        refs.inputsFeedback.textContent = "";
        refs.inputsFeedback.dataset.error = "false";
      }
      return;
    }
    const inInputsView = state.currentView === "inputs";
    const target = inInputsView && refs.inputsFeedback ? refs.inputsFeedback : refs.feedback;
    if (!target) return;
    target.textContent = text;
    target.dataset.error = isError ? "true" : "false";
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

  function syncAddUserOfficeOptions() {
    const select = field(refs.addUserForm, "office_id");
    if (!select) return;
    const opts = [
      '<option value=\"\">Office</option>',
      ...state.officeLocations.map(function (loc) {
        const id = loc.id != null ? String(loc.id) : "";
        return `<option value=\"${escapeHtml(id)}\">${escapeHtml(loc.name)}</option>`;
      }),
    ];
    const prevValue = select.value;
    select.innerHTML = opts.join("");
    const hasPrev = state.officeLocations.some(function (loc) {
      const id = loc.id != null ? String(loc.id) : "";
      return id === prevValue;
    });
    if (prevValue && hasPrev) {
      select.value = prevValue;
    } else {
      select.value = "";
    }
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

  function isClientActive(client) {
    return client?.isActive !== false && client?.is_active !== false;
  }

  function isProjectActive(project) {
    return project?.isActive !== false && project?.is_active !== false;
  }

  function isInternalClientProjectRecord(record) {
    const rawChargeCenterId = record?.chargeCenterId ?? record?.charge_center_id ?? "";
    const chargeCenterId = `${rawChargeCenterId}`.trim().toLowerCase();
    if (chargeCenterId && chargeCenterId !== "null" && chargeCenterId !== "undefined") {
      return true;
    }
    const clientName = `${record?.client || record?.clientName || ""}`.trim().toLowerCase();
    return clientName === "internal";
  }

  function hasDeactivatedOrRemovedClientProject(record) {
    if (!record || isInternalClientProjectRecord(record)) return false;
    const projectId = `${record?.projectId || record?.project_id || ""}`.trim();
    const clientName = `${record?.client || record?.clientName || ""}`.trim();
    const projectName = `${record?.project || record?.projectName || ""}`.trim();
    const project = projectId
      ? (state.projects || []).find((item) => `${item?.id || ""}`.trim() === projectId)
      : (state.projects || []).find(
          (item) =>
            `${item?.client || ""}`.trim() === clientName &&
            `${item?.name || item?.project || ""}`.trim() === projectName
        );
    if (!project || !isProjectActive(project)) {
      return true;
    }
    const resolvedClientName = `${project?.client || clientName}`.trim();
    if (!resolvedClientName) return true;
    const client = (state.clients || []).find(
      (item) => `${item?.name || ""}`.trim() === resolvedClientName
    );
    return !client || !isClientActive(client);
  }

  async function showDeactivatedClientProjectPrompt() {
    await appDialog({
      title: "Action not allowed",
      message: "You cannot edit time or expenses on a deactivated (removed) client.",
      cancelText: "Close",
      hideConfirm: true,
    });
  }

  function isDeactivatedClientProjectErrorMessage(message) {
    const text = `${message || ""}`.trim().toLowerCase();
    if (!text) return false;
    return (
      text.includes("deactivated (or deleted) project") ||
      text.includes("deactivated (removed) client")
    );
  }

  function assignedActiveMembersCountForProject(clientName, projectName) {
    const activeUserIds = new Set(
      (state.users || [])
        .filter((user) => user?.isActive !== false)
        .map((user) => `${user?.id || ""}`.trim())
        .filter(Boolean)
    );
    if (!activeUserIds.size) return 0;
    const projectRecord = (state.projects || []).find(
      (project) => project?.client === clientName && project?.name === projectName
    );
    const projectId = `${projectRecord?.id || ""}`.trim();
    const assignedUserIds = new Set();
    (state.assignments?.projectMembers || []).forEach((assignment) => {
      const assignmentUserId = `${assignment?.userId || assignment?.user_id || ""}`.trim();
      if (!assignmentUserId || !activeUserIds.has(assignmentUserId)) return;
      const assignmentProjectId = `${assignment?.projectId || assignment?.project_id || ""}`.trim();
      const assignmentClient = `${assignment?.client || assignment?.client_name || ""}`.trim();
      const assignmentProject = `${assignment?.project || assignment?.project_name || ""}`.trim();
      const matchesProject = projectId
        ? assignmentProjectId === projectId
        : assignmentClient === clientName && assignmentProject === projectName;
      if (matchesProject) {
        assignedUserIds.add(assignmentUserId);
      }
    });
    (state.assignments?.managerProjects || []).forEach((assignment) => {
      const assignmentUserId = `${assignment?.managerId || assignment?.manager_id || ""}`.trim();
      if (!assignmentUserId || !activeUserIds.has(assignmentUserId)) return;
      const assignmentProjectId = `${assignment?.projectId || assignment?.project_id || ""}`.trim();
      const assignmentClient = `${assignment?.client || assignment?.client_name || ""}`.trim();
      const assignmentProject = `${assignment?.project || assignment?.project_name || ""}`.trim();
      const matchesProject = projectId
        ? assignmentProjectId === projectId
        : assignmentClient === clientName && assignmentProject === projectName;
      if (matchesProject) {
        assignedUserIds.add(assignmentUserId);
      }
    });
    return assignedUserIds.size;
  }

  function lifecycleTargetView(entity, options = {}) {
    if (options?.forCatalogView && state.currentView === "clients") {
      if (entity === "client") {
        return state.catalogClientLifecycleView === "inactive" ? "inactive" : "active";
      }
      if (entity === "project") {
        return state.catalogProjectLifecycleView === "inactive" ? "inactive" : "active";
      }
    }
    return "active";
  }

  function catalogClientNames(options = {}) {
    const targetView = lifecycleTargetView("client", options);
    return (state.clients || [])
      .filter((client) => (targetView === "inactive" ? !isClientActive(client) : isClientActive(client)))
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogClientNames(options = {}) {
    const candidateClients = catalogClientNames(options);
    if (!(options?.forCatalogView && state.currentView === "clients")) {
      return candidateClients;
    }
    if (!state.visibilitySnapshotReady) return [];
    const visibleClientIdSet = new Set((state.visibleClientIds || []).map((id) => `${id || ""}`.trim()));
    const visibleClientNames = new Set(
      (state.clients || [])
        .filter((client) => visibleClientIdSet.has(`${client?.id || ""}`.trim()))
        .map((client) => `${client?.name || ""}`.trim())
        .filter(Boolean)
    );
    return candidateClients.filter((name) => visibleClientNames.has(`${name || ""}`.trim()));
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

  function catalogProjectNames(client, options = {}) {
    const targetView = lifecycleTargetView("project", options);
    const filtered = (state.projects || []).filter((p) => {
      if (client && p.client !== client) return false;
      return targetView === "inactive" ? !isProjectActive(p) : isProjectActive(p);
    });
    return uniqueValues(filtered.map((p) => p.name)).sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogProjectNames(client, options = {}) {
    const candidateProjects = catalogProjectNames(client, options);
    if (!(options?.forCatalogView && state.currentView === "clients")) {
      return candidateProjects;
    }
    if (!state.visibilitySnapshotReady) return [];
    const selectedClient = `${client || ""}`.trim();
    const visibleProjectIdSet = new Set((state.visibleProjectIds || []).map((id) => `${id || ""}`.trim()));
    const visibleProjectNames = new Set(
      (state.projects || [])
        .filter((project) => {
          if (`${project?.client || ""}`.trim() !== selectedClient) return false;
          return visibleProjectIdSet.has(`${project?.id || ""}`.trim());
        })
        .map((project) => `${project?.name || project?.project || ""}`.trim())
        .filter(Boolean)
    );
    return candidateProjects.filter((name) => visibleProjectNames.has(`${name || ""}`.trim()));
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

  function assignedProjectTuplesForCurrentUser() {
    const canSeeAll = canSeeAllClientsProjects();
    const canSeeOffice = canSeeOfficeClientsProjects();
    const canSeeAssigned = canSeeAssignedClientsProjects();
    const visibleProjectIds = new Set(
      (state.visibleProjectIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean)
    );
    const scopedProjects = (state.projects || []).filter((project) => {
      if (canSeeAll || canSeeOffice) return true;
      const projectId = `${project?.id || ""}`.trim();
      return Boolean(projectId) && visibleProjectIds.has(projectId);
    });
    if (!canSeeAll && !canSeeOffice && !canSeeAssigned && !scopedProjects.length) {
      return [];
    }
    const tupleMap = new Map();
    scopedProjects.forEach((project) => {
      const client = `${project?.client || ""}`.trim();
      const projectName = `${project?.name || project?.project || ""}`.trim();
      const projectId = `${project?.id || ""}`.trim();
      if (!client || !projectName) return;
      tupleMap.set(projectKey(client, projectName), {
        client,
        project: projectName,
        projectId,
      });
    });
    return Array.from(tupleMap.values()).sort((a, b) => {
      if (a.client === b.client) {
        return a.project.localeCompare(b.project);
      }
      return a.client.localeCompare(b.client);
    });
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
    roleKey,
    allowedProjectTuples,
    allowedClientsForUser,
    allowedProjectsForClient,
    canManagerAccessClient,
    canManagerAccessProject,
    projectCreatedBy,
    isUserAssignedToProject,
    canUserAccessProject,
    canViewUserByRole,
    canViewEntryByScope,
  } = accessControl;

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

  function syncAuditLoadMoreButton() {
    if (!refs.auditLoadMore) return;
    const shouldShow = isAdmin(state.currentUser) && state.currentView === "audit" && state.auditHasMore;
    refs.auditLoadMore.hidden = !shouldShow;
    refs.auditLoadMore.disabled = !!state.auditLoadingMore;
    refs.auditLoadMore.textContent = state.auditLoadingMore ? "Loading..." : "Load next 100";
  }

  function normalizeAuditDateValue(rawDate) {
    const value = `${rawDate || ""}`.trim();
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const isoLikeDatePrefix = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
    if (isoLikeDatePrefix && isValidDateString(isoLikeDatePrefix[1])) {
      return isoLikeDatePrefix[1];
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const utcDate = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(
        parsed.getUTCDate()
      ).padStart(2, "0")}`;
      if (isValidDateString(utcDate)) {
        return utcDate;
      }
    }
    return parseDisplayDate(value) || "";
  }

  function buildAuditServerFilters(inputFilters) {
    const source = inputFilters || {};
    const beginIso = normalizeAuditDateValue(source.beginDate || source.date);
    const endIso = normalizeAuditDateValue(source.endDate || source.date);
    const fromDate = beginIso ? `${beginIso}T00:00:00.000Z` : undefined;
    const toDate = endIso ? `${endIso}T23:59:59.999Z` : undefined;
    return {
      entityType: source.entity || undefined,
      action: source.action || undefined,
      actorId: source.actor || undefined,
      fromDate,
      toDate,
    };
  }

  function buildAuditFilterOptions(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const entityLabel = (value) => (typeof humanizeEntity === "function" ? humanizeEntity(value) : value || "");
    const actionLabel = (value) => (typeof humanizeAction === "function" ? humanizeAction(value) : value || "");
    const entities = [...new Set(sourceRows.map((row) => `${row?.entity_type || ""}`.trim()).filter(Boolean))].sort(
      (a, b) => entityLabel(a).localeCompare(entityLabel(b))
    );
    const actions = [...new Set(sourceRows.map((row) => `${row?.action || ""}`.trim()).filter(Boolean))].sort(
      (a, b) => actionLabel(a).localeCompare(actionLabel(b))
    );
    const actors = [
      ...new Map(
        sourceRows
          .map((row) => ({
            id: `${row?.changed_by_user_id || ""}`.trim(),
            label: `${row?.changed_by_name_snapshot || userNameById(row?.changed_by_user_id) || row?.changed_by_user_id || ""}`.trim(),
          }))
          .filter((row) => row.id)
          .map((row) => [row.id, row.label || row.id])
      ).entries(),
    ]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const categories = [
      ...new Set(
        sourceRows
          .map((row) => (typeof auditCategoryForRow === "function" ? auditCategoryForRow(row) : ""))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    return { entities, actions, actors, categories };
  }

  function syncAuditFilterOptions(rowsFallback) {
    const options = state.auditFilterOptionsLoaded
      ? state.auditFilterOptions
      : buildAuditFilterOptions(rowsFallback || state.auditLogs || []);
    const categoryLabelByValue = {
      activity: "Activity",
      client_project: "Client/Project",
      settings_edits: "Settings edits",
    };
    if (refs.auditFilterEntity) {
      const current = refs.auditFilterEntity.value || "";
      refs.auditFilterEntity.innerHTML = [
        `<option value="">All</option>`,
        ...(options.entities || []).map(
          (value) =>
            `<option value="${escapeHtml(value)}">${escapeHtml(
              typeof humanizeEntity === "function" ? humanizeEntity(value) : value
            )}</option>`
        ),
      ].join("");
      refs.auditFilterEntity.value = (options.entities || []).includes(current) ? current : "";
    }
    if (refs.auditFilterAction) {
      const current = refs.auditFilterAction.value || "";
      refs.auditFilterAction.innerHTML = [
        `<option value="">All</option>`,
        ...(options.actions || []).map(
          (value) =>
            `<option value="${escapeHtml(value)}">${escapeHtml(
              typeof humanizeAction === "function" ? humanizeAction(value) : value
            )}</option>`
        ),
      ].join("");
      refs.auditFilterAction.value = (options.actions || []).includes(current) ? current : "";
    }
    if (refs.auditFilterActor) {
      const current = refs.auditFilterActor.value || "";
      refs.auditFilterActor.innerHTML = [
        `<option value="">All</option>`,
        ...(options.actors || []).map(
          (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label || item.id)}</option>`
        ),
      ].join("");
      refs.auditFilterActor.value = (options.actors || []).some((item) => item.id === current) ? current : "";
    }
    if (refs.auditFilterCategory) {
      const current = refs.auditFilterCategory.value || "";
      const categories = (options.categories || []).length
        ? options.categories
        : ["activity", "client_project", "settings_edits"];
      refs.auditFilterCategory.innerHTML = [
        `<option value="">All</option>`,
        ...categories.map(
          (value) =>
            `<option value="${escapeHtml(value)}">${escapeHtml(
              categoryLabelByValue[value] ||
                (typeof humanizeEntity === "function" ? humanizeEntity(value) : value)
            )}</option>`
        ),
      ].join("");
      refs.auditFilterCategory.value = categories.includes(current) ? current : "";
    }
  }

  function auditDateBounds() {
    const maxWithToday = (value) => {
      const normalized = normalizeAuditDateValue(value || "");
      if (!normalized) return today;
      return normalized > today ? normalized : today;
    };
    if (state.auditDateBounds?.min && state.auditDateBounds?.max) {
      return {
        min: state.auditDateBounds.min,
        max: maxWithToday(state.auditDateBounds.max),
      };
    }
    const dates = (state.auditLogs || [])
      .map((row) => normalizeAuditDateValue(row?.changed_at || row?.changedAt || ""))
      .filter(Boolean)
      .sort();
    if (!dates.length) {
      return { min: "", max: "" };
    }
    return {
      min: dates[0] || "",
      max: maxWithToday(dates[dates.length - 1] || ""),
    };
  }

  async function ensureFullAuditDateBounds(options = {}) {
    if (!isAdmin(state.currentUser)) return;
    const force = options.force === true;
    if (!force && state.auditDateBounds?.min && state.auditDateBounds?.max) return;
    if (state.auditDateBoundsLoading) return;
    state.auditDateBoundsLoading = true;
    try {
      const all = await fetchAllAuditLogs({});
      const dates = all
        .map((row) => normalizeAuditDateValue(row?.changed_at || row?.changedAt || ""))
        .filter(Boolean)
        .sort();
      state.auditDateBounds = {
        min: dates[0] || "",
        max: dates[dates.length - 1] || "",
      };
      renderAuditTable(filterAuditLogs(state.auditLogs));
    } catch (error) {
      // Keep current fallback bounds if full-range fetch fails.
    } finally {
      state.auditDateBoundsLoading = false;
    }
  }

  async function ensureFullAuditFilterOptions(options = {}) {
    if (!isAdmin(state.currentUser)) return;
    const force = options.force === true;
    if (!force && state.auditFilterOptionsLoaded) return;
    if (state.auditFilterOptionsLoading) return;
    state.auditFilterOptionsLoading = true;
    try {
      const all = await fetchAllAuditLogs({});
      state.auditFilterOptions = buildAuditFilterOptions(all);
      state.auditFilterOptionsLoaded = true;
      syncAuditFilterOptions();
    } catch (error) {
      // Keep loaded-row fallback options if full-history option load fails.
    } finally {
      state.auditFilterOptionsLoading = false;
    }
  }

  function applyAuditDownloadDateBounds(beginDate, endDate) {
    const bounds = auditDateBounds();
    const begin = refs.auditDownloadBeginDate;
    const end = refs.auditDownloadEndDate;
    if (!begin || !end) return bounds;

    if (bounds.min) {
      begin.min = bounds.min;
      end.min = bounds.min;
    } else {
      begin.removeAttribute("min");
      end.removeAttribute("min");
    }

    if (bounds.max) {
      begin.max = bounds.max;
      end.max = bounds.max;
    } else {
      begin.removeAttribute("max");
      end.removeAttribute("max");
    }

    const normalizedBegin = normalizeAuditDateValue(beginDate || "");
    const normalizedEnd = normalizeAuditDateValue(endDate || "");
    if (normalizedBegin) {
      end.min = normalizedBegin;
    }
    if (normalizedEnd) {
      begin.max = normalizedEnd;
    }
    return bounds;
  }

  function syncAuditDownloadActorOptions() {
    if (!refs.auditDownloadActor) return;
    const selected = refs.auditDownloadActor.value || "";
    const users = (state.users || [])
      .map((user) => ({
        id: `${user?.id || ""}`.trim(),
        name: `${user?.displayName || user?.display_name || user?.username || ""}`.trim(),
      }))
      .filter((item) => item.id && item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    refs.auditDownloadActor.innerHTML = [
      `<option value="">All</option>`,
      ...users.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`),
    ].join("");
    refs.auditDownloadActor.value = users.some((item) => item.id === selected) ? selected : "";
  }

  function closeAuditDownloadDialog() {
    if (!refs.auditDownloadDialog) return;
    refs.auditDownloadDialog.hidden = true;
    if (refs.auditDownloadSubmit) {
      refs.auditDownloadSubmit.disabled = false;
      refs.auditDownloadSubmit.textContent = "Download CSV";
    }
  }

  function syncAuditDownloadDateInput(input, value) {
    if (!input) return;
    const iso = normalizeAuditDateValue(value);
    input.dataset.dpCanonical = iso;
    input.value = iso;
    if (window.datePicker && typeof window.datePicker.register === "function" && input.dataset.dpBound !== "true") {
      input.type = "date";
      window.datePicker.register(input);
    }
    if (input.classList.contains("dp-desktop-date")) {
      input.value = iso ? formatDisplayDate(iso) : "";
    } else {
      input.value = iso;
    }
  }

  function openAuditDownloadDialog() {
    if (!isAdmin(state.currentUser) || !refs.auditDownloadDialog) return;
    syncAuditDownloadActorOptions();
    const existingBegin = normalizeAuditDateValue(state.auditFilters?.beginDate || "");
    const existingEnd = normalizeAuditDateValue(state.auditFilters?.endDate || "");
    syncAuditDownloadDateInput(refs.auditDownloadBeginDate, existingBegin);
    syncAuditDownloadDateInput(refs.auditDownloadEndDate, existingEnd);
    applyAuditDownloadDateBounds(existingBegin, existingEnd);
    if (refs.auditDownloadActor) {
      refs.auditDownloadActor.value = state.auditFilters?.actor || "";
    }
    if (refs.auditDownloadEntity) {
      refs.auditDownloadEntity.value = state.auditFilters?.entity || "";
    }
    if (refs.auditDownloadAction) {
      refs.auditDownloadAction.value = state.auditFilters?.action || "";
    }
    refs.auditDownloadDialog.hidden = false;
  }

  async function fetchAllAuditLogs(filters) {
    const sessionToken = loadSessionToken();
    const all = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;
    while (hasMore) {
      const payload = await requestJson(MUTATE_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          action: "list_audit_logs",
          payload: {
            filters: {
              ...filters,
              offset,
              limit,
            },
          },
        }),
      });
      const rows = Array.isArray(payload?.auditLogs) ? payload.auditLogs : [];
      all.push(...rows);
      hasMore = Boolean(payload?.hasMore);
      if (!hasMore || !rows.length) {
        break;
      }
      const nextOffset = Number(payload?.nextOffset);
      offset = Number.isFinite(nextOffset) ? nextOffset : offset + rows.length;
      if (all.length > 50000) {
        break;
      }
    }
    return all;
  }

  async function downloadAuditLogsCsv(filters) {
    const logs = await fetchAllAuditLogs(buildAuditServerFilters(filters));
    if (!logs.length) {
      feedback("No audit logs match those filters.", true);
      return;
    }
    const rows = [
      [
        "Changed at",
        "Actor",
        "Target user",
        "Entity",
        "Action",
        "Changed fields",
        "Client",
        "Project",
        "Before",
        "After",
      ],
      ...logs.map((row) => {
        const changedFields = Array.isArray(row?.changed_fields_json)
          ? row.changed_fields_json.join(", ")
          : "";
        return [
          row.changed_at || "",
          row.changed_by_name_snapshot || userNameById(row.changed_by_user_id) || row.changed_by_user_id || "",
          userNameById(row.target_user_id) || row.target_user_id || "",
          humanizeEntity(row.entity_type),
          humanizeAction(row.action),
          changedFields,
          clientNameById(row.context_client_id, row.context_project_id),
          projectNameById(row.context_project_id),
          JSON.stringify(row.before_json || {}),
          JSON.stringify(row.after_json || {}),
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateStamp =
      normalizeAuditDateValue(filters?.beginDate || "") ||
      normalizeAuditDateValue(filters?.endDate || "") ||
      today;
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${dateStamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    feedback(`Downloaded ${logs.length} audit log rows.`, false);
  }

  async function loadAuditLogs(options = {}) {
    if (!isAdmin(state.currentUser)) return;
    const settings = options || {};
    const append = settings.append === true;
    if (append && state.auditLoadingMore) {
      return;
    }
    if (append) {
      state.auditLoadingMore = true;
      syncAuditLoadMoreButton();
    }
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
            filters: {
              ...buildAuditServerFilters(state.auditFilters),
              offset: append ? state.auditOffset : 0,
              limit: 100,
            },
          },
        }),
      });
      const nextRows = Array.isArray(payload?.auditLogs) ? payload.auditLogs : [];
      state.auditLogs = append
        ? [...state.auditLogs, ...nextRows.filter((row) => !state.auditLogs.some((item) => item.id === row.id))]
        : nextRows;
      state.auditOffset = Number.isFinite(Number(payload?.nextOffset))
        ? Number(payload.nextOffset)
        : state.auditLogs.length;
      state.auditHasMore = Boolean(payload?.hasMore);
      const boundsMin = normalizeAuditDateValue(payload?.auditDateBounds?.minChangedAt || "");
      const boundsMax = normalizeAuditDateValue(payload?.auditDateBounds?.maxChangedAt || "");
      if (boundsMin || boundsMax) {
        state.auditDateBounds = {
          min: boundsMin || "",
          max: boundsMax || "",
        };
      }
      syncAuditFilterOptions(nextRows);
      renderAuditTable(filterAuditLogs(state.auditLogs));
      syncAuditLoadMoreButton();
    } catch (error) {
      feedback("Unable to load audit logs.", true);
    } finally {
      if (append) {
        state.auditLoadingMore = false;
      }
      syncAuditLoadMoreButton();
    }
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
      await loadPersistentState();
      resetFilters();
      resetAuditFilters();
      resetForm();
      resetExpenseForm();
      refs.loginForm.reset();
      setAuthFeedback("", false);
      feedback("", false);
      closeUsersModal();
      closeCatalogModal();
      showAppShell();
      render();
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
      await loadPersistentState();
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
      }, { returnState: false });
      await loadPersistentState();
      refs.forcePasswordForm.reset();
      showAppShell();
      render();
    } catch (error) {
      setAuthFeedback(error.message || "Unable to change password.", true);
    }
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
      }, { returnState: false });
      closeChangePasswordModal();
      feedback("Password updated.", false);
    } catch (error) {
      feedback(error.message || "Unable to change password.", true);
      return;
    }
    render();
  }

  function clearEntryAndExpenseDrafts() {
    resetForm?.();
    resetExpenseForm?.();
  }

  async function handleLogout() {
    const sessionToken = loadSessionToken();

    persistSessionToken("");
    clearThemePreference();
    clearPersistedView();
    clearRemoteAppState();
    resetFilters();
    clearEntryAndExpenseDrafts();
    setAuthFeedback("Signed out.", false);
    closeUsersModal();
    closeCatalogModal();
    render();

    try {
      await requestJson(AUTH_API_PATH, {
        method: "POST",
        body: JSON.stringify({
          action: "logout",
        }),
        sessionToken,
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
    const officeIdRaw = formData.get("office_id");
    const officeId = officeIdRaw ? String(officeIdRaw) : null;
    const activeFrom = getDateInputIsoValue(field(refs.addUserForm, "active_from"))
      || new Date().toISOString().slice(0, 10);
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
        officeId,
        activeFrom,
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
    const officeField = field(refs.addUserForm, "office_id");
    if (officeField) {
      officeField.value = "";
    }
    const activeFromField = field(refs.addUserForm, "active_from");
    if (activeFromField) {
      bindCustomDateInput(activeFromField, new Date().toISOString().slice(0, 10));
    }
    setUserFeedback("Team member added.", false);
    render();
  }

  async function handleUserListAction(event) {
    const button = event.target.closest(
      "[data-user-edit], [data-user-profile-edit], [data-user-role], [data-user-password], [data-user-deactivate], [data-user-reactivate]"
    );
    if (!button) {
      return;
    }
    if (button.disabled) {
      return;
    }

    const userId =
      button.dataset.userEdit ||
      button.dataset.userProfileEdit ||
      button.dataset.userRole ||
      button.dataset.userPassword ||
      button.dataset.userDeactivate ||
      button.dataset.userReactivate;
    const allKnownUsers = [...(state.users || []), ...(state.inactiveUsers || [])];
    const user = allKnownUsers.find(function (candidate) {
      return candidate.id === userId;
    });

    if (!user) {
      const message = "Team member not found.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    try {
      if (button.dataset.userProfileEdit) {
        const currentUserId = `${state.currentUser?.id || ""}`.trim();
        if (!currentUserId || currentUserId !== `${user.id || ""}`.trim()) {
          feedback("Access denied.", true);
          return;
        }
        openMemberEditorModal("edit", user.id, "member_profile", { scope: "self_profile" });
        return;
      }
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
        const suggestedDate = new Date().toISOString().slice(0, 10);
        const dialog = await appDialog({
          title: `Terminate ${user.displayName}`,
          message: "Termination date (MM/DD/YY)",
          input: true,
          inputType: "date",
          defaultValue: suggestedDate,
          confirmText: "Terminate",
          cancelText: "Cancel",
        });
        if (!dialog.confirmed) return;
        const terminationDate = String(dialog.value || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(terminationDate)) {
          setUserFeedback("Termination date is required (MM/DD/YY).", true);
          return;
        }
        const activeFrom = String(user.activeFrom || "").trim();
        if (activeFrom && terminationDate < activeFrom) {
          setUserFeedback("Termination date cannot be before start date.", true);
          return;
        }

        await mutatePersistentState(
          "terminate_user",
          {
            userId: user.id,
            terminationDate,
          },
          {
            skipHydrate: true,
            returnState: false,
            skipSettingsMetadataReload: true,
          }
        );
        refreshSettingsTabInBackground("rates");
        setUserFeedback(`${user.displayName} was terminated.`, false);
        return;
      } else if (button.dataset.userReactivate) {
        const dialog = await appDialog({
          title: `Reactivate ${user.displayName}?`,
          confirmText: "Reactivate",
          cancelText: "Cancel",
        });
        if (!dialog.confirmed) return;
        await mutatePersistentState(
          "reactivate_user",
          { userId: user.id },
          {
            skipHydrate: true,
            returnState: false,
            skipSettingsMetadataReload: true,
          }
        );
        refreshSettingsTabInBackground("rates");
        setUserFeedback(`${user.displayName} was reactivated.`, false);
        return;
      }
    } catch (error) {
      const message = error.message || "Unable to update team member.";
      setUserFeedback(message, true);
      window.alert(message);
      return;
    }

    render();
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
      refs.appShell.classList.toggle("page-inputs", view === "inputs");
      refs.appShell.classList.toggle("page-entries", view === "entries");
      refs.appShell.classList.toggle("page-inbox", view === "inbox");
      refs.appShell.classList.toggle("page-project-planning", view === "project_planning");
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
    renderActingAsDropdown();
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
      const showMembers = true;
      refs.navMembers.hidden = !showMembers;
      refs.navMembers.textContent = "Directory";
      refs.navMembers.classList.toggle("is-active", view === "members");
      refs.navMembers.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.navMembersMobile) {
      const showMembers = true;
      refs.navMembersMobile.hidden = !showMembers;
      refs.navMembersMobile.textContent = "Directory";
      refs.navMembersMobile.classList.toggle("is-active", view === "members");
      refs.navMembersMobile.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.openCatalog) {
      refs.openCatalog.hidden = !hasClientsTabAccess();
      refs.openCatalog.classList.toggle("is-active", view === "clients");
      refs.openCatalog.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.navClientsMobile) {
      const showClients = hasClientsTabAccess();
      refs.navClientsMobile.hidden = !showClients;
      refs.navClientsMobile.classList.toggle("is-active", view === "clients");
      refs.navClientsMobile.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.settingsOpen) {
      const showSettingsAction = !!state.permissions?.view_settings_tab;
      refs.settingsOpen.hidden = !showSettingsAction;
      refs.settingsOpen.classList.toggle("is-active", showSettingsAction && view === "settings");
      refs.settingsOpen.setAttribute("aria-current", showSettingsAction && view === "settings" ? "page" : "false");
    }
    if (refs.navInputs) {
      refs.navInputs.hidden = false;
      refs.navInputs.classList.toggle("is-active", view === "inputs");
      refs.navInputs.setAttribute("aria-current", view === "inputs" ? "page" : "false");
    }
    if (refs.navEntries) {
      refs.navEntries.hidden = false;
      refs.navEntries.classList.toggle("is-active", view === "entries");
      refs.navEntries.setAttribute("aria-current", view === "entries" ? "page" : "false");
    }
    if (refs.navInputsMobile) {
      refs.navInputsMobile.hidden = false;
      refs.navInputsMobile.classList.toggle("is-active", view === "inputs");
      refs.navInputsMobile.setAttribute("aria-current", view === "inputs" ? "page" : "false");
    }
    if (refs.navEntriesMobile) {
      refs.navEntriesMobile.hidden = false;
      refs.navEntriesMobile.classList.toggle("is-active", view === "entries");
      refs.navEntriesMobile.setAttribute("aria-current", view === "entries" ? "page" : "false");
    }
    syncInboxHeaderButton(view === "inbox");
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
    if (refs.auditDownloadOpen) {
      refs.auditDownloadOpen.hidden = !showAudit;
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
    closeSettingsMenu();
    if (refs.settingsToggle) {
      refs.settingsToggle.hidden = false;
      refs.settingsToggle.setAttribute("aria-expanded", "false");
    }

    if (refs.appTopbar) {
      refs.appTopbar.style.display = "";
    }
    if (refs.mainFrame) {
      refs.mainFrame.style.display = "none";
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
    if (refs.inputsView) {
      refs.inputsView.hidden = view !== "inputs";
    }
    if (refs.entriesView) {
      refs.entriesView.hidden = view !== "entries";
    }
    if (refs.inboxView) {
      refs.inboxView.hidden = view !== "inbox";
    }
    if (refs.auditView) {
      refs.auditView.hidden = view !== "audit";
    }

    if (view === "analytics" && refs.analyticsPage) {
      const analyticsRenderer = window.analyticsFeature?.renderAnalyticsPage;
      if (typeof analyticsRenderer === "function") {
        analyticsRenderer({
          container: refs.analyticsPage,
          state,
        });
      }
      postHeight();
      return;
    }

    if (view === "project_planning") {
      if (refs.mainFrame) {
        const normalizedPlanningProjectId =
          String(state.currentProjectPlanningId || "").trim() || loadPersistedProjectPlanningId();
        if (normalizedPlanningProjectId && !String(state.currentProjectPlanningId || "").trim()) {
          state.currentProjectPlanningId = normalizedPlanningProjectId;
        }
        const targetProjectId = normalizedPlanningProjectId || "";
        persistProjectPlanningId(targetProjectId);
        refs.mainFrame.style.display = "";
        const planningRenderer = window.projectPlanning?.renderProjectPlanningPage;
        if (typeof planningRenderer === "function") {
          const planningProject =
            (state.projects || []).find(
              (item) => String(item?.id || "").trim() === targetProjectId
            ) || null;
          const canEditPlanning =
            planningProject &&
            canEditProjectPlanning(
              String(planningProject?.client || "").trim(),
              String(planningProject?.name || "").trim()
            );
          planningRenderer({
            projectId: targetProjectId,
            state,
            container: refs.mainFrame,
            canEdit: Boolean(canEditPlanning),
            onBack: function () {
              setView("clients");
            },
            onSave: async function (payload) {
              if (!canEditPlanning) {
                feedback("Access denied.", true);
                return;
              }
              const saveProjectId = String(payload?.projectId || targetProjectId || "").trim();
              if (!saveProjectId) {
                feedback("Project context is unavailable.", true);
                return;
              }
              state.currentProjectPlanningId = saveProjectId;
              persistProjectPlanningId(saveProjectId);
              const planningProject =
                (state.projects || []).find(
                  (item) => String(item?.id || "").trim() === saveProjectId
                ) || null;
              const members = Array.isArray(payload?.members) ? payload.members : [];
              await mutatePersistentState(
                "save_project_advanced_budget",
                {
                  projectId: saveProjectId,
                  members: members.map((member) => ({
                    userId: String(member?.userId || "").trim(),
                    budgetHours:
                      member?.budgetHours === null || member?.budgetHours === undefined || member?.budgetHours === ""
                        ? null
                        : Number(member.budgetHours),
                    budgetAmount:
                      member?.budgetAmount === null || member?.budgetAmount === undefined || member?.budgetAmount === ""
                        ? null
                        : Number(member.budgetAmount),
                    rateOverride:
                      member?.rateOverride === null || member?.rateOverride === undefined || member?.rateOverride === ""
                        ? null
                        : Number(member.rateOverride),
                  })),
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              const preserved = (state.projectMemberBudgets || []).filter(
                (row) => String(row?.projectId || "").trim() !== saveProjectId
              );
              state.projectMemberBudgets = preserved.concat(
                members.map((member) => ({
                  projectId: saveProjectId,
                  userId: member.userId,
                  budgetHours: member.budgetHours,
                  budgetAmount: member.budgetAmount,
                  rateOverride: member.rateOverride,
                }))
              );
              feedback("Project plan saved.", false);
              if (state.currentView === "project_planning") {
                render();
              }
              loadPersistentStateInBackground();
            },
            onPersistField: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const userId = String(payload?.userId || "").trim();
              const field = String(payload?.field || "").trim();
              const value =
                payload?.value === null || payload?.value === undefined || payload?.value === ""
                  ? null
                  : Number(payload.value);
              if (!persistProjectId || !userId || !field) {
                throw new Error("Project context is unavailable.");
              }
              if (value !== null && !Number.isFinite(value)) {
                throw new Error("Invalid value.");
              }

              if (field !== "chargeRate" && field !== "hours") {
                throw new Error("Unsupported field.");
              }

              const existingRows = Array.isArray(state.projectMemberBudgets)
                ? state.projectMemberBudgets.filter(
                    (row) => String(row?.projectId || "").trim() === persistProjectId
                  )
                : [];
              const rowsByUserId = new Map(
                existingRows.map((row) => [String(row?.userId || "").trim(), { ...row }])
              );
              const nextRow = rowsByUserId.get(userId) || {
                projectId: persistProjectId,
                userId,
                budgetHours: null,
                budgetAmount: null,
                rateOverride: null,
              };
              if (field === "chargeRate") {
                nextRow.rateOverride = value;
              } else if (field === "hours") {
                nextRow.budgetHours = value;
              }
              const nextHours =
                nextRow?.budgetHours === null || nextRow?.budgetHours === undefined || nextRow?.budgetHours === ""
                  ? null
                  : Number(nextRow.budgetHours);
              const nextRate =
                nextRow?.rateOverride === null || nextRow?.rateOverride === undefined || nextRow?.rateOverride === ""
                  ? null
                  : Number(nextRow.rateOverride);
              nextRow.budgetAmount =
                Number.isFinite(nextHours) && Number.isFinite(nextRate)
                  ? Number((nextHours * nextRate).toFixed(2))
                  : null;
              rowsByUserId.set(userId, nextRow);
              const members = Array.from(rowsByUserId.values())
                .map((row) => ({
                  userId: String(row?.userId || "").trim(),
                  budgetHours:
                    row?.budgetHours === null || row?.budgetHours === undefined || row?.budgetHours === ""
                      ? null
                      : Number(row.budgetHours),
                  budgetAmount:
                    row?.budgetAmount === null || row?.budgetAmount === undefined || row?.budgetAmount === ""
                      ? null
                      : Number(row.budgetAmount),
                  rateOverride:
                    row?.rateOverride === null || row?.rateOverride === undefined || row?.rateOverride === ""
                      ? null
                      : Number(row.rateOverride),
                }))
                .filter((row) => row.userId);
              await mutatePersistentState(
                "save_project_advanced_budget",
                {
                  projectId: persistProjectId,
                  members,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              const preserved = (state.projectMemberBudgets || []).filter(
                (row) => String(row?.projectId || "").trim() !== persistProjectId
              );
              state.projectMemberBudgets = preserved.concat(
                members.map((member) => ({
                  projectId: persistProjectId,
                  userId: member.userId,
                  budgetHours: member.budgetHours,
                  budgetAmount: member.budgetAmount,
                  rateOverride: member.rateOverride,
                }))
              );
            },
            onCreateExpenseRow: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              if (!persistProjectId) {
                throw new Error("Project context is unavailable.");
              }
              const result = await mutatePersistentState(
                "create_project_planned_expense",
                {
                  projectId: persistProjectId,
                  categoryId: payload?.categoryId || null,
                  description: payload?.description || "",
                  units:
                    payload?.units === null || payload?.units === undefined || payload?.units === ""
                      ? 0
                      : Number(payload.units),
                  unitCost:
                    payload?.unitCost === null || payload?.unitCost === undefined || payload?.unitCost === ""
                      ? 0
                      : Number(payload.unitCost),
                  markupPct:
                    payload?.markupPct === null || payload?.markupPct === undefined || payload?.markupPct === ""
                      ? 0
                      : Number(payload.markupPct),
                  billable: payload?.billable === true,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              const created = result?.expense || null;
              if (!created?.id) {
                throw new Error("Unable to create expense row.");
              }
              const existing = Array.isArray(state.projectPlannedExpenses) ? state.projectPlannedExpenses : [];
              state.projectPlannedExpenses = existing.concat({
                id: String(created.id),
                projectId: String(created.projectId || persistProjectId),
                categoryId: created.categoryId || null,
                description: String(created.description || ""),
                units: Number.isFinite(Number(created.units)) ? Number(created.units) : 0,
                unitCost: Number.isFinite(Number(created.unitCost)) ? Number(created.unitCost) : 0,
                markupPct: Number.isFinite(Number(created.markupPct)) ? Number(created.markupPct) : 0,
                billable: created.billable === true,
                sortOrder: Number.isFinite(Number(created.sortOrder)) ? Number(created.sortOrder) : 0,
              });
              return created;
            },
            onPersistExpenseField: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const expenseId = String(payload?.expenseId || "").trim();
              const field = String(payload?.field || "").trim();
              if (!persistProjectId || !expenseId || !field) {
                throw new Error("Project context is unavailable.");
              }
              const result = await mutatePersistentState(
                "update_project_planned_expense",
                {
                  projectId: persistProjectId,
                  expenseId,
                  field,
                  value: payload?.value,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              const updated = result?.expense || null;
              if (!updated?.id) {
                throw new Error("Unable to save expense row.");
              }
              if (Array.isArray(state.projectPlannedExpenses)) {
                state.projectPlannedExpenses = state.projectPlannedExpenses.map((row) =>
                  String(row?.id || "") === String(updated.id)
                    ? {
                        ...row,
                        projectId: String(updated.projectId || row?.projectId || persistProjectId),
                        categoryId: updated.categoryId || null,
                        description: String(updated.description || ""),
                        units: Number.isFinite(Number(updated.units)) ? Number(updated.units) : 0,
                        unitCost: Number.isFinite(Number(updated.unitCost)) ? Number(updated.unitCost) : 0,
                        markupPct: Number.isFinite(Number(updated.markupPct)) ? Number(updated.markupPct) : 0,
                        billable: updated.billable === true,
                        sortOrder: Number.isFinite(Number(updated.sortOrder)) ? Number(updated.sortOrder) : (Number(row?.sortOrder) || 0),
                      }
                    : row
                );
              }
              return updated;
            },
            onDeleteExpenseRow: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const expenseId = String(payload?.expenseId || "").trim();
              if (!persistProjectId || !expenseId) {
                throw new Error("Project context is unavailable.");
              }
              await mutatePersistentState(
                "delete_project_planned_expense",
                {
                  projectId: persistProjectId,
                  expenseId,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              if (Array.isArray(state.projectPlannedExpenses)) {
                state.projectPlannedExpenses = state.projectPlannedExpenses.filter(
                  (row) => String(row?.id || "").trim() !== expenseId
                );
              }
            },
            onConfirmDialog: async function (payload) {
              const title = String(payload?.title || "Confirm");
              const message = String(payload?.message || "");
              const confirmText = String(payload?.confirmText || "Confirm");
              const cancelText = String(payload?.cancelText || "Cancel");
              const result = await appDialog({
                title,
                message,
                confirmText,
                cancelText,
              });
              return result?.confirmed === true;
            },
            onDeleteMember: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const deleteProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const deleteUserId = String(payload?.userId || "").trim();
              const deleteAction = String(payload?.action || "").trim().toLowerCase();
              if (!deleteProjectId || !deleteUserId) {
                throw new Error("Project context is unavailable.");
              }
              const planningProject =
                (state.projects || []).find(
                  (item) => String(item?.id || "").trim() === deleteProjectId
                ) || null;
              const clientName = String(planningProject?.client || "").trim();
              const projectName = String(planningProject?.name || "").trim();
              if (!clientName || !projectName) {
                throw new Error("Project context is unavailable.");
              }
              if (deleteAction === "manager") {
                await mutatePersistentState(
                  "unassign_manager_project",
                  {
                    managerId: deleteUserId,
                    clientName,
                    projectName,
                  },
                  { skipHydrate: true, refreshState: false, returnState: false }
                );
                if (state.assignments?.managerProjects) {
                  state.assignments.managerProjects = state.assignments.managerProjects.filter(
                    (row) =>
                      !(
                        String(row?.projectId || "").trim() === deleteProjectId &&
                        String(row?.managerId || "").trim() === deleteUserId
                      )
                  );
                }
              } else {
                await mutatePersistentState(
                  "remove_project_member",
                  {
                    userId: deleteUserId,
                    clientName,
                    projectName,
                  },
                  { skipHydrate: true, refreshState: false, returnState: false }
                );
                if (state.assignments?.projectMembers) {
                  state.assignments.projectMembers = state.assignments.projectMembers.filter(
                    (row) =>
                      !(
                        String(row?.projectId || "").trim() === deleteProjectId &&
                        String(row?.userId || "").trim() === deleteUserId
                      )
                  );
                }
              }
              await mutatePersistentState(
                "delete_project_member_budget",
                {
                  projectId: deleteProjectId,
                  userId: deleteUserId,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              if (Array.isArray(state.projectMemberBudgets)) {
                state.projectMemberBudgets = state.projectMemberBudgets.filter(
                  (row) =>
                    !(
                      String(row?.projectId || "").trim() === deleteProjectId &&
                      String(row?.userId || "").trim() === deleteUserId
                    )
                );
              }
            },
            onPersistContractType: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const contractType = String(payload?.contractType || "").trim();
              if (!persistProjectId || (contractType !== "fixed" && contractType !== "tm")) {
                throw new Error("Project context is unavailable.");
              }
              const planningProject =
                (state.projects || []).find(
                  (item) => String(item?.id || "").trim() === persistProjectId
                ) || null;
              const clientName = String(planningProject?.client || "").trim();
              const projectName = String(planningProject?.name || "").trim();
              if (!clientName || !projectName) {
                throw new Error("Project context is unavailable.");
              }
              await mutatePersistentState(
                "update_project",
                {
                  clientName,
                  projectName,
                  pricingModel: contractType === "tm" ? "time_and_materials" : "fixed_fee",
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              if (planningProject) {
                planningProject.pricingModel = contractType === "tm" ? "time_and_materials" : "fixed_fee";
                planningProject.pricing_model = planningProject.pricingModel;
              }
            },
            onPersistContractAmount: async function (payload) {
              if (!canEditPlanning) {
                throw new Error("Access denied.");
              }
              const persistProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const contractAmount =
                payload?.contractAmount === null || payload?.contractAmount === undefined || payload?.contractAmount === ""
                  ? null
                  : Number(payload.contractAmount);
              if (!persistProjectId) {
                throw new Error("Project context is unavailable.");
              }
              if (contractAmount !== null && !Number.isFinite(contractAmount)) {
                throw new Error("Invalid contract amount.");
              }
              const planningProject =
                (state.projects || []).find(
                  (item) => String(item?.id || "").trim() === persistProjectId
                ) || null;
              const clientName = String(planningProject?.client || "").trim();
              const projectName = String(planningProject?.name || "").trim();
              if (!clientName || !projectName) {
                throw new Error("Project context is unavailable.");
              }
              await mutatePersistentState(
                "update_project",
                {
                  clientName,
                  projectName,
                  contractAmount,
                },
                { skipHydrate: true, refreshState: false, returnState: false }
              );
              if (planningProject) {
                planningProject.contractAmount = contractAmount;
                planningProject.contract_amount = contractAmount;
              }
            },
            onAddMember: function (payload) {
              if (!canEditPlanning) {
                feedback("Access denied.", true);
                return;
              }
              const addProjectId = String(payload?.projectId || targetProjectId || "").trim();
              const addProject =
                (state.projects || []).find(
                  (item) => String(item?.id || "").trim() === addProjectId
                ) || null;
              const clientName = String(payload?.clientName || addProject?.client || "").trim();
              const projectName = String(payload?.projectName || addProject?.name || "").trim();
              if (!clientName || !projectName) {
                feedback("Project context is unavailable.", true);
                return;
              }
              memberModalState.mode = "project-add-member";
              memberModalState.client = clientName;
              memberModalState.project = projectName;
              const assignedProjectMemberIds = (state.assignments?.projectMembers || [])
                .filter(
                  (row) =>
                    String(row?.client || "").trim() === clientName &&
                    String(row?.project || "").trim() === projectName
                )
                .map((row) => String(row?.userId || "").trim())
                .filter(Boolean);
              memberModalState.assigned = [
                ...new Set([
                  ...assignedProjectMemberIds,
                  ...(directManagerIdsForProject(clientName, projectName) || []),
                ]),
              ];
              memberModalState.overrides = {};
              memberModalState.searchTerm = "";
              openMembersModal();
            },
          });
        } else {
          refs.mainFrame.innerHTML = `
            <section class="page-view project-planning-page" aria-labelledby="project-planning-title">
              <header class="project-planning-head">
                <div>
                  <h2 id="project-planning-title">Project Planning</h2>
                  <p class="project-planning-subtitle">Unable to load page module</p>
                </div>
                <div class="project-planning-actions">
                  <button type="button" class="button button-ghost" data-planning-fallback-back>Back</button>
                </div>
              </header>
              <section class="project-planning-block">
                <p class="project-planning-placeholder">Project Planning script is unavailable. Refresh once and try again.</p>
              </section>
            </section>
          `;
          refs.mainFrame
            .querySelector("[data-planning-fallback-back]")
            ?.addEventListener("click", function () {
              setView("clients");
            });
        }
      }
      postHeight();
      return;
    }

    const inputSubtab = state.inputSubtab === "expenses" ? "expenses" : "time";
    if (refs.inputsViewTitle) {
      refs.inputsViewTitle.textContent = inputSubtab === "expenses" ? "Enter Expenses" : "Enter Time";
    }
    if (refs.inputsTimeSummary) {
      refs.inputsTimeSummary.hidden = true;
    }
    if (refs.inputsExpenseSummary) {
      refs.inputsExpenseSummary.hidden = true;
    }
    if (refs.inputsSwitchAction) {
      refs.inputsSwitchAction.textContent =
        inputSubtab === "expenses" ? "Enter Time" : "Enter Expenses";
    }
    if (refs.inputsPanelTime) {
      refs.inputsPanelTime.hidden = inputSubtab !== "time";
    }
    if (refs.inputsPanelExpenses) {
      refs.inputsPanelExpenses.hidden = inputSubtab !== "expenses";
    }
    if (refs.inputsTimeCalendarView && inputSubtab !== "time") {
      refs.inputsTimeCalendarView.hidden = true;
    }

    const entriesSubtab =
      state.entriesSubtab === "expenses"
        ? "expenses"
        : state.entriesSubtab === "deleted"
        ? "deleted"
        : "time";
    if (refs.entriesViewTitle) {
      refs.entriesViewTitle.textContent = "Entries";
    }
    if (refs.entriesSubtabTime) {
      refs.entriesSubtabTime.classList.toggle("is-active", entriesSubtab === "time");
      refs.entriesSubtabTime.setAttribute("aria-selected", entriesSubtab === "time" ? "true" : "false");
    }
    if (refs.entriesSubtabExpenses) {
      refs.entriesSubtabExpenses.classList.toggle("is-active", entriesSubtab === "expenses");
      refs.entriesSubtabExpenses.setAttribute("aria-selected", entriesSubtab === "expenses" ? "true" : "false");
    }
    if (refs.entriesPanelTime) {
      refs.entriesPanelTime.hidden = entriesSubtab !== "time";
    }
    if (refs.entriesPanelExpenses) {
      refs.entriesPanelExpenses.hidden = entriesSubtab !== "expenses";
    }
    if (refs.entriesPanelDeleted) {
      refs.entriesPanelDeleted.hidden = entriesSubtab !== "deleted";
    }

    if (view === "clients") {
      setupAddClientHeaderAction();
      setupAddProjectHeaderAction();
      renderClientEditor();
      syncClientEditorLeadField();
      renderCatalogLists({
        refs,
        state,
        visibleCatalogClientNames,
        visibleCatalogProjectNames,
        isClientActive,
        isProjectActive,
        projectHours,
        formatNameList,
        userNamesForIds,
        managerIdsForProject,
        staffIdsForProject,
        disabledButtonAttrs,
        escapeHtml,
        field,
        ensureCatalogSelection,
      });
      syncClientLifecycleToggleUi();
      syncProjectLifecycleToggleUi();
      syncProjectCardsUx();
      syncClientsMobileDrilldownState();
      postHeight();
      return;
    }

    if (view === "members") {
      syncAddUserOfficeOptions();
      renderUsersList();
      syncUserManagementControls();
      syncMembersMobileDrilldownState();
      postHeight();
      return;
    }

    if (view === "settings") {
      renderLevelRows();
      renderRatesRows?.();
      renderExpenseCategories();
      renderCorporateFunctionCategories?.();
      renderOfficeLocations();
      renderMessagingRules();
      if (window.settingsAdmin?.renderDepartments) {
        window.settingsAdmin.renderDepartments();
      }
      if (window.settingsAdmin?.renderTargetRealizations) {
        window.settingsAdmin.renderTargetRealizations();
      }
      if (window.settingsAdmin?.renderDepartmentLeads) {
        window.settingsAdmin.renderDepartmentLeads();
      }
      renderSettingsTabs?.();
      postHeight();
      postHeight();
      return;
    }

    if (view === "audit") {
      if (!isAdmin(state.currentUser)) {
        setView("entries");
        return;
      }
      renderAuditTable(state.auditLogs);
      syncAuditLoadMoreButton();
      ensureFullAuditFilterOptions();
      if (!state.auditLogs.length) {
        loadAuditLogs();
      }
      postHeight();
      return;
    }

    if (view === "inbox") {
      if (refs.inboxFilterAll) {
        const isAll = state.inboxFilter !== "unread";
        refs.inboxFilterAll.classList.toggle("is-active", isAll);
        refs.inboxFilterAll.setAttribute("aria-selected", isAll ? "true" : "false");
      }
      if (refs.inboxFilterUnread) {
        const isUnread = state.inboxFilter === "unread";
        refs.inboxFilterUnread.classList.toggle("is-active", isUnread);
        refs.inboxFilterUnread.setAttribute("aria-selected", isUnread ? "true" : "false");
      }
      renderInboxList();
      postHeight();
      return;
    }

    if (view === "inputs") {
      if (state.inputSubtab === "time") {
        syncInputsTimeRow();
        if (refs.inputsTimeCalendarView) refs.inputsTimeCalendarView.hidden = false;
        renderInputsTimeCalendar();
      } else {
        syncInputsExpenseRow();
        if (refs.inputsExpenseCalendarView) refs.inputsExpenseCalendarView.hidden = false;
        renderInputsExpenseCalendar();
      }
      postHeight();
      return;
    }

    if (view === "entries") {
      if (entriesSubtab === "expenses") {
        if (state.entriesSelectionMode) {
          setEntriesSelectionMode(false);
        }
        if (state.deletedSelectionMode) {
          state.deletedSelectionMode = false;
          state.selectedDeletedKeys = new Set();
        }
        syncEntriesSelectionControls([]);
        syncExpenseFilterCatalogsUI(state.expenseFilters);
        const filteredExpenses = currentExpenses();
        syncExpenseSelectionControls(filteredExpenses);
        renderExpenses(filteredExpenses);
        syncExpenseSelectionControls(filteredExpenses);
        renderExpenseFilterState(filteredExpenses);
        syncEntriesUndoUi();
      } else if (entriesSubtab === "deleted") {
        if (state.entriesSelectionMode) {
          setEntriesSelectionMode(false);
        }
        if (state.expensesSelectionMode) {
          setExpensesSelectionMode(false);
        }
        syncEntriesSelectionControls([]);
        syncExpenseSelectionControls([]);
        if (!state.deletedItemsLoading && !state.deletedEntries.length && !state.deletedExpenses.length) {
          loadDeletedItems().then(function () {
            if (state.currentView === "entries" && state.entriesSubtab === "deleted") {
              render();
            }
          });
        }
        syncDeletedFilterOptions();
        if (refs.deletedFilterUser) refs.deletedFilterUser.value = state.deletedFilters.user || "";
        if (refs.deletedFilterClient) refs.deletedFilterClient.value = state.deletedFilters.client || "";
        if (refs.deletedFilterProject) refs.deletedFilterProject.value = state.deletedFilters.project || "";
        setDateInputIsoValue(refs.deletedFilterFrom, state.deletedFilters.from || "");
        setDateInputIsoValue(refs.deletedFilterTo, state.deletedFilters.to || "");
        if (refs.deletedFilterSearch) refs.deletedFilterSearch.value = state.deletedFilters.search || "";
        renderDeletedItemsTable();
      } else {
        if (state.expensesSelectionMode) {
          setExpensesSelectionMode(false);
        }
        if (state.deletedSelectionMode) {
          state.deletedSelectionMode = false;
          state.selectedDeletedKeys = new Set();
        }
        syncExpenseSelectionControls([]);
        syncFilterCatalogsUI(state.filters);
        const filteredEntries = currentEntries();
        syncEntriesSelectionControls(filteredEntries);
        renderFilterState(filteredEntries);
        renderTable(filteredEntries);
        syncEntriesSelectionControls(filteredEntries);
        syncEntriesUndoUi();
      }
      postHeight();
      return;
    }

    setView("entries");
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
        feedback("From date must be in MM/DD/YY format.", true);
      }
      return false;
    }

    if (toField.value.trim() && !parsedTo) {
      if (showErrors) {
        feedback("To date must be in MM/DD/YY format.", true);
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
    syncSharedEntriesFiltersFromTime();

    fromField.value = formatDisplayDate(state.filters.from);
    toField.value = formatDisplayDate(state.filters.to);
    syncEntriesDateRangeField(refs.filterDateRange, state.filters.from, state.filters.to);
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

  function inboxUnreadCount() {
    return (state.inboxItems || []).reduce((count, item) => count + (item?.isRead ? 0 : 1), 0);
  }

  function inboxReadCount() {
    return (state.inboxItems || []).reduce((count, item) => count + (item?.isRead ? 1 : 0), 0);
  }

  function isTimeDigestInboxItem(item) {
    return `${item?.type || ""}`.trim() === "time_entry_daily_digest";
  }

  async function confirmDigestDeleteWarning(itemCount = 1) {
    const plural = Number(itemCount) === 1 ? "" : "s";
    const result = await appDialog({
      title: "Delete Daily Digest?",
      message:
        `This action will also delete your daily digest notification${plural}.\n\n` +
        "If you delete it, today's digest will restart and only include entries added after deletion.",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    return Boolean(result?.confirmed);
  }

  function visibleInboxItems() {
    const items = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (state.inboxFilter === "unread") {
      return items.filter((item) => !item.isRead);
    }
    return items;
  }

  function syncInboxHeaderButton(isInboxView) {
    if (!refs.inboxOpen) return;
    refs.inboxOpen.classList.toggle("is-active", !!isInboxView);
    refs.inboxOpen.setAttribute("aria-current", isInboxView ? "page" : "false");
    refs.inboxOpen.setAttribute("aria-label", "Inbox");
    const unread = inboxUnreadCount();
    if (refs.inboxUnreadBadge) {
      if (unread > 0) {
        refs.inboxUnreadBadge.hidden = false;
        refs.inboxUnreadBadge.textContent = unread > 99 ? "99+" : String(unread);
      } else {
        refs.inboxUnreadBadge.hidden = true;
        refs.inboxUnreadBadge.textContent = "";
      }
    }
  }

  function selectedInboxIds() {
    return Array.from(
      new Set((state.inboxSelectedIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean))
    );
  }

  function setInboxSelected(id, checked) {
    const normalizedId = `${id || ""}`.trim();
    if (!normalizedId) return;
    const set = new Set(selectedInboxIds());
    if (checked) {
      set.add(normalizedId);
    } else {
      set.delete(normalizedId);
    }
    state.inboxSelectedIds = Array.from(set);
  }

  function clearInboxSelection() {
    state.inboxSelectedIds = [];
  }

  function refreshInboxUi() {
    if (state.currentView === "inbox") {
      renderInboxList();
    } else {
      syncInboxBulkControls();
    }
    syncInboxHeaderButton(state.currentView === "inbox");
    postHeight();
  }

  function syncInboxBulkControls() {
    const selectedCount = selectedInboxIds().length;
    const selectedSet = new Set(selectedInboxIds());
    const selectedUnreadCount = (state.inboxItems || []).reduce((count, item) => {
      if (!item || item.isRead || !selectedSet.has(item.id)) return count;
      return count + 1;
    }, 0);
    if (refs.inboxMarkSelectedRead) {
      refs.inboxMarkSelectedRead.hidden = selectedCount <= 0 || selectedUnreadCount <= 0;
      refs.inboxMarkSelectedRead.disabled = selectedUnreadCount <= 0;
      refs.inboxMarkSelectedRead.textContent =
        selectedCount > 0 ? `Mark selected read (${selectedCount})` : "Mark selected read";
    }
    if (refs.inboxDeleteSelected) {
      refs.inboxDeleteSelected.hidden = selectedCount <= 0;
      refs.inboxDeleteSelected.disabled = selectedCount <= 0;
      refs.inboxDeleteSelected.textContent =
        selectedCount > 0 ? `Delete selected (${selectedCount})` : "Delete selected";
    }
    if (refs.inboxDeleteRead) {
      refs.inboxDeleteRead.disabled = inboxReadCount() <= 0;
    }
  }

  async function deleteInboxItem(itemId) {
    const id = `${itemId || ""}`.trim();
    if (!id) return;
    const targetItem = (state.inboxItems || []).find((item) => `${item?.id || ""}`.trim() === id) || null;
    if (isTimeDigestInboxItem(targetItem)) {
      const confirmed = await confirmDigestDeleteWarning(1);
      if (!confirmed) return;
    }
    const previousItems = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
    state.inboxItems = previousItems.filter((item) => `${item?.id || ""}`.trim() !== id);
    setInboxSelected(id, false);
    refreshInboxUi();
    try {
      await mutatePersistentState("delete_inbox_item", { id }, { refreshState: false, returnState: false });
      feedback("", false);
    } catch (error) {
      state.inboxItems = previousItems;
      refreshInboxUi();
      feedback(error.message || "Unable to delete inbox item.", true);
    }
  }

  async function deleteSelectedInboxItems() {
    const ids = selectedInboxIds();
    if (!ids.length) return;
    const idSetForDigestCheck = new Set(ids);
    const digestCount = (state.inboxItems || []).reduce((count, item) => {
      if (!item) return count;
      const itemId = `${item?.id || ""}`.trim();
      if (!idSetForDigestCheck.has(itemId)) return count;
      return count + (isTimeDigestInboxItem(item) ? 1 : 0);
    }, 0);
    if (digestCount > 0) {
      const confirmed = await confirmDigestDeleteWarning(digestCount);
      if (!confirmed) return;
    }
    const idSet = new Set(ids);
    const previousItems = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
    state.inboxItems = previousItems.filter((item) => !idSet.has(`${item?.id || ""}`.trim()));
    clearInboxSelection();
    refreshInboxUi();
    try {
      await mutatePersistentState("delete_inbox_items", { ids }, { refreshState: false, returnState: false });
      feedback("", false);
    } catch (error) {
      state.inboxItems = previousItems;
      refreshInboxUi();
      feedback(error.message || "Unable to delete selected inbox items.", true);
    }
  }

  async function deleteAllReadInboxItems() {
    const readBefore = inboxReadCount();
    if (readBefore <= 0) {
      feedback("No read notifications to delete.", false);
      return;
    }
    const readItems = (state.inboxItems || []).filter((item) => item?.isRead);
    const readDigestCount = readItems.reduce(
      (count, item) => count + (isTimeDigestInboxItem(item) ? 1 : 0),
      0
    );
    let deleteMode = "all";
    if (readDigestCount > 0) {
      const choice = await appDialog({
        title: "Delete Read Notifications",
        message:
          "Read notifications include your daily digest.\n\nChoose what to delete:",
        confirmText: "Delete all",
        cancelText: "Delete only non-digest",
      });
      deleteMode = choice?.confirmed ? "all" : "non_digest";
    }
    const readIdsToDelete = readItems
      .filter((item) => {
        if (deleteMode === "all") return true;
        return !isTimeDigestInboxItem(item);
      })
      .map((item) => `${item?.id || ""}`.trim())
      .filter(Boolean);
    if (!readIdsToDelete.length) {
      feedback("No non-digest read notifications to delete.", false);
      return;
    }

    const previousItems = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
    const deleteIdSet = new Set(readIdsToDelete);
    state.inboxItems = previousItems.filter((item) => !deleteIdSet.has(`${item?.id || ""}`.trim()));
    clearInboxSelection();
    refreshInboxUi();
    const deletedCount = readIdsToDelete.length;
    try {
      await mutatePersistentState(
        "delete_inbox_items",
        { ids: readIdsToDelete },
        { refreshState: false, returnState: false }
      );
      feedback(
        deletedCount > 0
          ? deleteMode === "non_digest"
            ? `Deleted ${deletedCount} non-digest read notification${deletedCount === 1 ? "" : "s"}.`
            : `Deleted ${deletedCount} read notification${deletedCount === 1 ? "" : "s"}.`
          : "No read notifications were deleted.",
        false
      );
    } catch (error) {
      state.inboxItems = previousItems;
      refreshInboxUi();
      feedback(error.message || "Unable to delete read inbox items.", true);
    }
  }

  async function markSelectedInboxRead() {
    const ids = selectedInboxIds();
    if (!ids.length) return;
    const idSet = new Set(ids);
    const previousItems = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
    state.inboxItems = previousItems.map((item) => {
      const itemId = `${item?.id || ""}`.trim();
      if (!item || !idSet.has(itemId) || item.isRead) return item;
      return { ...item, isRead: true };
    });
    clearInboxSelection();
    refreshInboxUi();
    try {
      await mutatePersistentState("mark_inbox_items_read", { ids }, { refreshState: false, returnState: false });
      feedback("", false);
    } catch (error) {
      state.inboxItems = previousItems;
      refreshInboxUi();
      feedback(error.message || "Unable to mark selected inbox items as read.", true);
    }
  }

  function renderInboxList() {
    if (!refs.inboxList) return;
    const items = visibleInboxItems();
    const selected = new Set(selectedInboxIds());
    const emailHighlightedEventTypes = new Set(
      (state.notificationRules || [])
        .filter((rule) => rule?.emailEnabled === true && rule?.eventType)
        .map((rule) => `${rule.eventType}`.trim())
        .filter(Boolean)
    );
    syncInboxBulkControls();
    if (!items.length) {
      refs.inboxList.innerHTML = `
        <div class="inbox-empty">
          ${state.inboxFilter === "unread" ? "No unread notifications." : "No notifications yet."}
        </div>
      `;
      return;
    }

    refs.inboxList.innerHTML = items
      .map((item) => {
        const unreadClass = item.isRead ? "" : " is-unread";
        const createdAt = formatDateTimeLocal(item.createdAt);
        const isSelected = selected.has(item.id);
        const selectedClass = isSelected ? " is-selected" : "";
        const priorityClass = emailHighlightedEventTypes.has(`${item.type || ""}`.trim())
          ? " message-priority"
          : "";
        const deepLinkActions = Array.isArray(item?.deepLink?.actions)
          ? item.deepLink.actions
              .map((action, index) => ({
                action,
                index,
                label: String(action?.label || "").trim(),
              }))
              .filter((row) => row.action && row.label)
          : [];
        const isTimeDigest = `${item?.type || ""}`.trim() === "time_entry_daily_digest";
        const viewAllAction = deepLinkActions.find((row) => row.label.toLowerCase() === "view all") || null;
        const projectActions = isTimeDigest
          ? deepLinkActions.filter((row) => {
              if (viewAllAction && row.index === viewAllAction.index) return false;
              const filters = row?.action?.filters || {};
              return Boolean(String(filters.client || "").trim() || String(filters.project || "").trim());
            })
          : [];
        const memberActions = isTimeDigest
          ? deepLinkActions.filter((row) => {
              if (viewAllAction && row.index === viewAllAction.index) return false;
              const filters = row?.action?.filters || {};
              return Boolean(String(filters.user || "").trim());
            })
          : [];
        const genericActions = isTimeDigest
          ? []
          : deepLinkActions.slice(0, 8);
        const linksMarkup = isTimeDigest
          ? (viewAllAction || projectActions.length || memberActions.length)
            ? `<div class="inbox-item-links inbox-item-links-digest">
                ${
                  viewAllAction
                    ? `<div class="inbox-item-links-top">
                        <button type="button" class="inbox-item-link" data-inbox-open="${escapeHtml(item.id)}" data-inbox-open-action="${viewAllAction.index}">${escapeHtml(
                        viewAllAction.label
                      )}</button>
                      </div>`
                    : ""
                }
                ${
                  projectActions.length
                    ? `<div class="inbox-item-links-grid">
                        ${projectActions
                          .map((row) => `<button type="button" class="inbox-item-link" data-inbox-open="${escapeHtml(item.id)}" data-inbox-open-action="${row.index}">${escapeHtml(
                            row.label
                          )}</button>`)
                          .join("")}
                      </div>`
                    : ""
                }
                ${
                  memberActions.length
                    ? `<div class="inbox-item-links-grid">
                        ${memberActions
                          .map((row) => `<button type="button" class="inbox-item-link" data-inbox-open="${escapeHtml(item.id)}" data-inbox-open-action="${row.index}">${escapeHtml(
                            row.label
                          )}</button>`)
                          .join("")}
                      </div>`
                    : ""
                }
              </div>`
            : ""
          : genericActions.length
            ? `<div class="inbox-item-links">
                ${genericActions
                  .map((row) => `<button type="button" class="inbox-item-link" data-inbox-open="${escapeHtml(item.id)}" data-inbox-open-action="${row.index}">${escapeHtml(
                    row.label
                  )}</button>`)
                  .join("")}
              </div>`
            : "";
        return `
          <div class="inbox-item${unreadClass}${selectedClass}${priorityClass}" data-inbox-id="${escapeHtml(item.id)}">
            <label class="inbox-item-check">
              <input type="checkbox" data-inbox-select="${escapeHtml(item.id)}" ${isSelected ? "checked" : ""} />
            </label>
            <div class="inbox-item-center">
              <button class="inbox-item-open" type="button" data-inbox-open="${escapeHtml(item.id)}">
                <div class="inbox-item-main">
                  <div class="inbox-item-message"><span class="message-priority-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M4 2.2v11.6M4 3h6.2l-1.4 2.4L10.2 8H4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${escapeHtml(item.message || "Notification")}</div>
                  ${
                    item.noteSnippet
                      ? `<div class="inbox-item-note">${escapeHtml(item.noteSnippet)}</div>`
                      : ""
                  }
                </div>
                ${item.isRead ? "" : '<span class="inbox-item-dot" aria-hidden="true"></span>'}
              </button>
              ${linksMarkup}
            </div>
            <div class="inbox-item-meta-actions">
              <div class="inbox-item-time">${escapeHtml(createdAt)}</div>
              <button class="inbox-item-delete" type="button" data-inbox-action="delete" data-inbox-id="${escapeHtml(item.id)}" aria-label="Delete notification">
                <svg viewBox="0 -960 960 960" aria-hidden="true">
                  <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function applyEntriesFiltersFromDeepLink(filtersPayload) {
    const filters = filtersPayload && typeof filtersPayload === "object" ? filtersPayload : null;
    if (!filters) return;
    const normalized = {
      user: String(filters.user || "").trim(),
      client: String(filters.client || "").trim(),
      project: String(filters.project || "").trim(),
      from: String(filters.from || "").trim(),
      to: String(filters.to || "").trim(),
      search: String(filters.search || "").trim(),
    };
    state.filters = normalized;
  }

  function routeInboxDeepLink(item, actionIndex) {
    if (!item) return;
    const baseDeepLink = item.deepLink && typeof item.deepLink === "object" ? item.deepLink : null;
    const actions = Array.isArray(baseDeepLink?.actions) ? baseDeepLink.actions : [];
    const actionIdx = Number(actionIndex);
    const action =
      Number.isInteger(actionIdx) && actionIdx >= 0 && actionIdx < actions.length
        ? actions[actionIdx]
        : null;
    const deepLink = {
      ...(baseDeepLink || {}),
      ...(action && typeof action === "object" ? action : {}),
    };
    const view = `${deepLink?.view || ""}`.trim();
    const subtab = `${deepLink?.subtab || ""}`.trim();
    const subjectId = `${item.subjectId || deepLink?.subjectId || ""}`.trim();
    const subjectType = `${item.subjectType || deepLink?.subjectType || ""}`.trim();
    const deepLinkFilters =
      deepLink?.filters && typeof deepLink.filters === "object" ? deepLink.filters : null;

    if (view === "entries") {
      state.entriesSubtab = subtab === "expenses" ? "expenses" : "time";
      applyEntriesFiltersFromDeepLink(deepLinkFilters);
      setView("entries");
      return;
    }

    if (view === "inputs") {
      if (subtab === "expenses") {
        state.inputSubtab = "expenses";
        if (subjectId && subjectType === "expense") {
          state.pendingInputsExpenseEditId = subjectId;
        }
      } else {
        state.inputSubtab = "time";
        if (subjectId && subjectType === "time") {
          state.pendingInputsTimeEditId = subjectId;
        }
      }
      setView("inputs");
      return;
    }

    if (subjectType === "expense") {
      state.entriesSubtab = "expenses";
      setView("entries");
      return;
    }
    if (subjectType === "time") {
      state.entriesSubtab = "time";
      setView("entries");
      return;
    }
    setView("inbox");
  }

  async function openInboxItem(itemId, actionIndex) {
    const id = `${itemId || ""}`.trim();
    if (!id) return;
    const itemIndex = (state.inboxItems || []).findIndex((inboxItem) => inboxItem.id === id);
    const item = itemIndex >= 0 ? state.inboxItems[itemIndex] : null;
    if (!item) return;

    if (!item.isRead) {
      const previousItems = Array.isArray(state.inboxItems) ? state.inboxItems.slice() : [];
      state.inboxItems = previousItems.map((inboxItem, index) =>
        index === itemIndex ? { ...inboxItem, isRead: true } : inboxItem
      );
      refreshInboxUi();
      try {
        await mutatePersistentState("mark_inbox_item_read", { id }, { refreshState: false, returnState: false });
      } catch (error) {
        state.inboxItems = previousItems;
        refreshInboxUi();
        feedback(error.message || "Unable to mark inbox item as read.", true);
      }
    }

    const refreshedItem = (state.inboxItems || []).find((inboxItem) => inboxItem.id === id) || item;
    routeInboxDeepLink(refreshedItem, actionIndex);
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

  refs.loginForm.addEventListener("submit", submitLogin);
  refs.bootstrapForm.addEventListener("submit", submitBootstrap);

  document.querySelectorAll('[data-nav-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const view = btn.getAttribute('data-nav-view');
      if (view) {
        setView(view);
      }
    });
  });

  if (refs.inboxOpen) {
    refs.inboxOpen.addEventListener("click", function () {
      setView("inbox");
    });
  }
  if (refs.inputsSwitchAction) {
    refs.inputsSwitchAction.addEventListener("click", function () {
      state.inputSubtab = state.inputSubtab === "expenses" ? "time" : "expenses";
      render();
    });
  }
  if (refs.inputsTimeSummaryToggle) {
    refs.inputsTimeSummaryToggle.addEventListener("click", function () {
      state.inputsTimeCalendarExpanded = !state.inputsTimeCalendarExpanded;
      render();
    });
  }
  if (refs.inputsTimeCalendarPrev) {
    refs.inputsTimeCalendarPrev.addEventListener("click", function () {
      const bounds = getInputsTimeCalendarBounds();
      const currentEnd = isValidDateString(state.inputsTimeCalendarEndDate)
        ? state.inputsTimeCalendarEndDate
        : today;
      if (!bounds.hasData || currentEnd <= bounds.minEndDate) return;
      state.inputsTimeCalendarEndDate = shiftIsoDate(state.inputsTimeCalendarEndDate || today, -7);
      if (state.currentView === "inputs" && state.inputSubtab === "time") {
        renderInputsTimeSummaryAndCalendarMeta();
        renderInputsTimeCalendar();
        postHeight();
      }
    });
  }
  if (refs.inputsTimeCalendarNext) {
    refs.inputsTimeCalendarNext.addEventListener("click", function () {
      const bounds = getInputsTimeCalendarBounds();
      const currentEnd = isValidDateString(state.inputsTimeCalendarEndDate)
        ? state.inputsTimeCalendarEndDate
        : today;
      if (!bounds.hasData || currentEnd >= bounds.maxEndDate) return;
      state.inputsTimeCalendarEndDate = shiftIsoDate(state.inputsTimeCalendarEndDate || today, 7);
      if (state.currentView === "inputs" && state.inputSubtab === "time") {
        renderInputsTimeSummaryAndCalendarMeta();
        renderInputsTimeCalendar();
        postHeight();
      }
    });
  }
  if (refs.inputsTimeCalendarGrid) {
    refs.inputsTimeCalendarGrid.addEventListener("click", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = `${actionEl.dataset.action || ""}`.trim();
      if (action === "inputs-time-toggle-days") {
        state.inputsTimeShowAllDays = !state.inputsTimeShowAllDays;
        renderInputsTimeCalendar();
        postHeight();
        return;
      }
      if (action === "inputs-time-day") {
        if (actionEl.classList.contains("is-zero") || actionEl.getAttribute("aria-disabled") === "true") {
          return;
        }
        const day = `${actionEl.dataset.day || ""}`.trim();
        if (isValidDateString(day)) {
          state.inputsTimeSelectedDate = day;
          state.inputsTimeSelectedClientProject = "";
          renderInputsTimeCalendar();
          postHeight();
        }
        return;
      }
      if (action === "inputs-time-project") {
        state.inputsTimeSelectedClientProject = `${actionEl.dataset.project || ""}`.trim();
        renderInputsTimeCalendar();
        postHeight();
        return;
      }
      if (action === "inputs-time-detail-edit") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
        const entry = (state.entries || []).find((item) => `${item?.id || ""}`.trim() === id);
        if (hasDeactivatedOrRemovedClientProject(entry)) {
          await showDeactivatedClientProjectPrompt();
          return;
        }
        state.pendingInputsTimeEditId = id;
        state.inputSubtab = "time";
        setView("inputs");
        return;
      }
      if (action === "inputs-time-detail-delete") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
        const entry = (state.entries || []).find((item) => `${item?.id || ""}`.trim() === id);
        if (hasDeactivatedOrRemovedClientProject(entry)) {
          await showDeactivatedClientProjectPrompt();
          return;
        }
        const confirmDelete = await appDialog({
          title: "Delete entry",
          message: "Are you sure you want to delete this entry?",
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!confirmDelete?.confirmed) return;
        try {
          await mutatePersistentState("delete_entry", { id });
          feedback("Entry deleted.", false);
        } catch (error) {
          feedback(error.message || "Unable to delete entry.", true);
        }
      }
    });
  }
  if (refs.inputsExpenseSummaryToggle) {
    refs.inputsExpenseSummaryToggle.addEventListener("click", function () {
      state.inputsExpenseCalendarExpanded = !state.inputsExpenseCalendarExpanded;
      render();
    });
  }
  if (refs.inputsExpenseCalendarPrev) {
    refs.inputsExpenseCalendarPrev.addEventListener("click", function () {
      const bounds = getInputsExpenseCalendarBounds();
      const currentEnd = isValidDateString(state.inputsExpenseCalendarEndDate)
        ? state.inputsExpenseCalendarEndDate
        : today;
      if (!bounds.hasData || currentEnd <= bounds.minEndDate) return;
      state.inputsExpenseCalendarEndDate = shiftIsoDate(state.inputsExpenseCalendarEndDate || today, -7);
      if (state.currentView === "inputs" && state.inputSubtab === "expenses") {
        renderInputsExpenseSummaryAndCalendarMeta();
        renderInputsExpenseCalendar();
        postHeight();
      }
    });
  }
  if (refs.inputsExpenseCalendarNext) {
    refs.inputsExpenseCalendarNext.addEventListener("click", function () {
      const bounds = getInputsExpenseCalendarBounds();
      const currentEnd = isValidDateString(state.inputsExpenseCalendarEndDate)
        ? state.inputsExpenseCalendarEndDate
        : today;
      if (!bounds.hasData || currentEnd >= bounds.maxEndDate) return;
      state.inputsExpenseCalendarEndDate = shiftIsoDate(state.inputsExpenseCalendarEndDate || today, 7);
      if (state.currentView === "inputs" && state.inputSubtab === "expenses") {
        renderInputsExpenseSummaryAndCalendarMeta();
        renderInputsExpenseCalendar();
        postHeight();
      }
    });
  }
  if (refs.inputsExpenseCalendarGrid) {
    refs.inputsExpenseCalendarGrid.addEventListener("click", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = `${actionEl.dataset.action || ""}`.trim();
      if (action === "inputs-expense-toggle-days") {
        state.inputsExpenseShowAllDays = !state.inputsExpenseShowAllDays;
        renderInputsExpenseCalendar();
        postHeight();
        return;
      }
      if (action === "inputs-expense-day") {
        if (actionEl.classList.contains("is-zero") || actionEl.getAttribute("aria-disabled") === "true") {
          return;
        }
        const day = `${actionEl.dataset.day || ""}`.trim();
        if (isValidDateString(day)) {
          state.inputsExpenseSelectedDate = day;
          state.inputsExpenseSelectedClientProject = "";
          renderInputsExpenseCalendar();
          postHeight();
        }
        return;
      }
      if (action === "inputs-expense-project") {
        state.inputsExpenseSelectedClientProject = `${actionEl.dataset.project || ""}`.trim();
        renderInputsExpenseCalendar();
        postHeight();
        return;
      }
      if (action === "inputs-expense-detail-edit") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
        const expense = (state.expenses || []).find((item) => `${item?.id || ""}`.trim() === id);
        if (hasDeactivatedOrRemovedClientProject(expense)) {
          await showDeactivatedClientProjectPrompt();
          return;
        }
        state.pendingInputsExpenseEditId = id;
        state.inputSubtab = "expenses";
        setView("inputs");
        return;
      }
      if (action === "inputs-expense-detail-delete") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
        const expense = (state.expenses || []).find((item) => `${item?.id || ""}`.trim() === id);
        if (hasDeactivatedOrRemovedClientProject(expense)) {
          await showDeactivatedClientProjectPrompt();
          return;
        }
        const confirmDelete = await appDialog({
          title: "Delete expense",
          message: "Are you sure you want to delete this expense?",
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!confirmDelete?.confirmed) return;
        try {
          await mutatePersistentState("delete_expense", { id });
          feedback("Expense deleted.", false);
        } catch (error) {
          feedback(error.message || "Unable to delete expense.", true);
        }
      }
    });
  }
  if (refs.entriesSwitchTime) {
    refs.entriesSwitchTime.addEventListener("click", function () {
      syncSharedEntriesFiltersFromExpense();
      if (state.expensesSelectionMode) {
        setExpensesSelectionMode(false);
      }
      state.entriesSubtab = "time";
      render();
    });
  }
  if (refs.entriesSwitchDeletedFromTime) {
    refs.entriesSwitchDeletedFromTime.addEventListener("click", async function () {
      state.entriesSubtab = "deleted";
      state.deletedItemsView = "time";
      state.deletedSelectionMode = false;
      state.selectedDeletedKeys = new Set();
      await loadDeletedItems();
      render();
    });
  }
  if (refs.entriesSwitchDeletedFromExpenses) {
    refs.entriesSwitchDeletedFromExpenses.addEventListener("click", async function () {
      state.entriesSubtab = "deleted";
      state.deletedItemsView = "expense";
      state.deletedSelectionMode = false;
      state.selectedDeletedKeys = new Set();
      await loadDeletedItems();
      render();
    });
  }
  if (refs.entriesSwitchTimeFromDeleted) {
    refs.entriesSwitchTimeFromDeleted.addEventListener("click", function () {
      state.entriesSubtab = "deleted";
      state.deletedItemsView = "time";
      render();
    });
  }
  if (refs.entriesSwitchExpensesFromDeleted) {
    refs.entriesSwitchExpensesFromDeleted.addEventListener("click", function () {
      state.entriesSubtab = "deleted";
      state.deletedItemsView = "expense";
      render();
    });
  }
  if (refs.entriesSwitchActiveFromDeleted) {
    refs.entriesSwitchActiveFromDeleted.addEventListener("click", function () {
      state.entriesSubtab = state.deletedItemsView === "expense" ? "expenses" : "time";
      render();
    });
  }
  if (refs.entriesSwitchExpenses) {
    refs.entriesSwitchExpenses.addEventListener("click", function () {
      syncSharedEntriesFiltersFromTime();
      if (state.entriesSelectionMode) {
        setEntriesSelectionMode(false);
      }
      state.entriesSubtab = "expenses";
      render();
    });
  }
  if (refs.entriesSelectToggle) {
    refs.entriesSelectToggle.addEventListener("click", function () {
      if (state.entriesSubtab !== "time") return;
      setEntriesSelectionMode(true);
      render();
    });
  }
  if (refs.entriesSelectCancel) {
    refs.entriesSelectCancel.addEventListener("click", function () {
      setEntriesSelectionMode(false);
      render();
    });
  }
  if (refs.entriesDeleteSelected) {
    refs.entriesDeleteSelected.addEventListener("click", async function () {
      await deleteSelectedEntries();
    });
  }
  if (refs.entriesUndoAction) {
    refs.entriesUndoAction.addEventListener("click", async function () {
      await undoDeletedEntries();
    });
  }
  if (refs.entriesSelectAllVisible) {
    refs.entriesSelectAllVisible.addEventListener("change", function (event) {
      if (!state.entriesSelectionMode) return;
      const visibleIds = visibleEntryIds();
      state.selectedEntryIds = event.target.checked ? new Set(visibleIds) : new Set();
      render();
    });
  }
  if (refs.expensesSelectToggle) {
    refs.expensesSelectToggle.addEventListener("click", function () {
      if (state.entriesSubtab !== "expenses") return;
      setExpensesSelectionMode(true);
      render();
    });
  }
  if (refs.expensesSelectCancel) {
    refs.expensesSelectCancel.addEventListener("click", function () {
      setExpensesSelectionMode(false);
      render();
    });
  }
  if (refs.expensesDeleteSelected) {
    refs.expensesDeleteSelected.addEventListener("click", async function () {
      await deleteSelectedExpenses();
    });
  }
  if (refs.expensesUndoAction) {
    refs.expensesUndoAction.addEventListener("click", async function () {
      await undoDeletedExpenses();
    });
  }
  if (refs.expensesSelectAllVisible) {
    refs.expensesSelectAllVisible.addEventListener("change", function (event) {
      if (!state.expensesSelectionMode) return;
      const visibleIds = visibleExpenseIds();
      state.selectedExpenseIds = event.target.checked ? new Set(visibleIds) : new Set();
      render();
    });
  }
  if (refs.deletedSelectToggle) {
    refs.deletedSelectToggle.addEventListener("click", function () {
      if (state.entriesSubtab !== "deleted") return;
      state.deletedSelectionMode = true;
      render();
    });
  }
  if (refs.deletedSelectCancel) {
    refs.deletedSelectCancel.addEventListener("click", function () {
      state.deletedSelectionMode = false;
      state.selectedDeletedKeys = new Set();
      render();
    });
  }
  if (refs.deletedRestoreSelected) {
    refs.deletedRestoreSelected.addEventListener("click", async function () {
      await restoreSelectedDeletedItems();
    });
  }
  if (refs.deletedSelectAllVisible) {
    refs.deletedSelectAllVisible.addEventListener("change", function (event) {
      if (!state.deletedSelectionMode) return;
      const items = combinedDeletedItems();
      const keys = items
        .map((item) => deletedItemKey(item.itemType, item.itemId))
        .filter(Boolean);
      state.selectedDeletedKeys = event.target.checked ? new Set(keys) : new Set();
      render();
    });
  }
  if (refs.inboxFilterAll) {
    refs.inboxFilterAll.addEventListener("click", function () {
      state.inboxFilter = "all";
      clearInboxSelection();
      render();
    });
  }
  if (refs.inboxFilterUnread) {
    refs.inboxFilterUnread.addEventListener("click", function () {
      state.inboxFilter = "unread";
      clearInboxSelection();
      render();
    });
  }
  if (refs.inboxDeleteSelected) {
    refs.inboxDeleteSelected.addEventListener("click", async function () {
      await deleteSelectedInboxItems();
    });
  }
  if (refs.inboxMarkSelectedRead) {
    refs.inboxMarkSelectedRead.addEventListener("click", async function () {
      await markSelectedInboxRead();
    });
  }
  if (refs.inboxDeleteRead) {
    refs.inboxDeleteRead.addEventListener("click", async function () {
      await deleteAllReadInboxItems();
    });
  }
  if (refs.inboxList) {
    refs.inboxList.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest("[data-inbox-action='delete']");
      if (deleteButton) {
        await deleteInboxItem(deleteButton.dataset.inboxId);
        return;
      }
      const openButton = event.target.closest("[data-inbox-open]");
      if (!openButton) return;
      const actionIndexRaw = openButton.dataset.inboxOpenAction;
      const actionIndex =
        actionIndexRaw === undefined || actionIndexRaw === null || `${actionIndexRaw}`.trim() === ""
          ? null
          : Number(actionIndexRaw);
      await openInboxItem(openButton.dataset.inboxOpen, actionIndex);
    });
    refs.inboxList.addEventListener("change", function (event) {
      const checkbox = event.target.closest("[data-inbox-select]");
      if (!checkbox) return;
      setInboxSelected(checkbox.dataset.inboxSelect, checkbox.checked);
      syncInboxBulkControls();
    });
  }
  if (refs.messagingRulesRows) {
    refs.messagingRulesRows.addEventListener("change", async function (event) {
      const inboxToggle = event.target.closest("[data-rule-inbox]");
      const emailToggle = event.target.closest("[data-rule-email]");
      const toggle = inboxToggle || emailToggle;
      if (!toggle) return;
      const eventType = toggle.dataset.ruleInbox || toggle.dataset.ruleEmail;
      const inboxEnabled = inboxToggle ? inboxToggle.checked : undefined;
      const emailEnabled = emailToggle ? emailToggle.checked : undefined;
      try {
        await mutatePersistentState("update_notification_rule", {
          eventType,
          inboxEnabled,
          emailEnabled,
        }, { refreshState: true, returnState: false });
        feedback("Messaging rule updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update messaging rule.", true);
        renderMessagingRules();
      }
    });
  }
  if (refs.logoutButton) {
    refs.logoutButton.addEventListener("click", function () {
      handleLogout();
    });
  }

  if (refs.inputsView) {
    refs.inputsView.addEventListener(
      "pointerdown",
      function (event) {
        const control = findInputsExpandableControl(event.target);
        if (!control) return;

        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== control && refs.inputsView.contains(active)) {
          if (isInputsDateControl(active)) {
            closeInputsDesktopDatePopover();
          }
          if (active instanceof HTMLSelectElement) {
            active.blur();
          }
        }

        if (isInputsDateControl(control)) {
          return;
        }

        if (control instanceof HTMLSelectElement) {
          closeInputsDesktopDatePopover();
          if (typeof control.showPicker === "function") {
            try {
              control.focus();
              control.showPicker();
              event.preventDefault();
              return;
            } catch (error) {
              // Fall through to click-based open.
            }
          }
          control.focus();
        }
      },
      true
    );
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

  if (refs.filterDateRange) {
    refs.filterDateRange.addEventListener("change", function () {
      applyFiltersFromForm({ showErrors: false });
    });
  }

  if (refs.expenseFilterDateRange) {
    refs.expenseFilterDateRange.addEventListener("change", function () {
      applyExpenseFiltersFromForm({ showErrors: false });
    });
  }

  if (refs.deletedFilterFrom) {
    bindCustomDateInput(refs.deletedFilterFrom, state.deletedFilters.from || "");
    refs.deletedFilterFrom.addEventListener("change", function () {
      applyDeletedFiltersFromForm({ showErrors: false });
    });
  }
  if (refs.deletedFilterTo) {
    bindCustomDateInput(refs.deletedFilterTo, state.deletedFilters.to || "");
    refs.deletedFilterTo.addEventListener("change", function () {
      applyDeletedFiltersFromForm({ showErrors: false });
    });
  }
  if (refs.deletedFilterUser) {
    refs.deletedFilterUser.addEventListener("change", function () {
      applyDeletedFiltersFromForm();
    });
  }
  if (refs.deletedFilterClient) {
    refs.deletedFilterClient.addEventListener("change", function () {
      syncDeletedFilterOptions();
      applyDeletedFiltersFromForm();
    });
  }
  if (refs.deletedFilterProject) {
    refs.deletedFilterProject.addEventListener("change", function () {
      applyDeletedFiltersFromForm();
    });
  }
  if (refs.deletedFilterSearch) {
    refs.deletedFilterSearch.addEventListener("input", function () {
      applyDeletedFiltersFromForm({ showErrors: false });
    });
  }
  if (refs.deletedFilterForm) {
    refs.deletedFilterForm.addEventListener("submit", function (event) {
      event.preventDefault();
      applyDeletedFiltersFromForm();
    });
  }

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

  refs.deletedClearFilters?.addEventListener("click", function () {
    if (refs.deletedFilterForm) {
      refs.deletedFilterForm.reset();
    }
    state.deletedFilters = {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
    setDateInputIsoValue(refs.deletedFilterFrom, "");
    setDateInputIsoValue(refs.deletedFilterTo, "");
    render();
  });

  refs.auditFilterEntity?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterAction?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterActor?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterDate?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditFilterCategory?.addEventListener("change", applyAuditFiltersFromForm);
  refs.auditDownloadOpen?.addEventListener("click", function () {
    openAuditDownloadDialog();
  });
  refs.auditDownloadCancel?.addEventListener("click", function () {
    closeAuditDownloadDialog();
  });
  refs.auditDownloadDialog?.addEventListener("click", function (event) {
    if (event.target === refs.auditDownloadDialog) {
      closeAuditDownloadDialog();
    }
  });
  refs.auditDownloadForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!refs.auditDownloadSubmit) return;
    const beginDate = normalizeAuditDateValue(
      refs.auditDownloadBeginDate?.dataset?.dpCanonical || refs.auditDownloadBeginDate?.value || ""
    );
    const endDate = normalizeAuditDateValue(
      refs.auditDownloadEndDate?.dataset?.dpCanonical || refs.auditDownloadEndDate?.value || ""
    );
    const bounds = applyAuditDownloadDateBounds(beginDate, endDate);
    if (beginDate && endDate && beginDate > endDate) {
      feedback("Begin date cannot be after End date.", true);
      return;
    }
    if (bounds.min && beginDate && beginDate < bounds.min) {
      feedback(`Begin date cannot be before ${formatDisplayDate(bounds.min)}.`, true);
      return;
    }
    if (bounds.max && endDate && endDate > bounds.max) {
      feedback(`End date cannot be after ${formatDisplayDate(bounds.max)}.`, true);
      return;
    }
    refs.auditDownloadSubmit.disabled = true;
    refs.auditDownloadSubmit.textContent = "Preparing...";
    try {
      await downloadAuditLogsCsv({
        beginDate,
        endDate,
        actor: refs.auditDownloadActor?.value || "",
        entity: refs.auditDownloadEntity?.value || "",
        action: refs.auditDownloadAction?.value || "",
      });
      closeAuditDownloadDialog();
    } catch (error) {
      feedback(error.message || "Unable to download audit logs.", true);
      refs.auditDownloadSubmit.disabled = false;
      refs.auditDownloadSubmit.textContent = "Download CSV";
    }
  });
  refs.auditDownloadBeginDate?.addEventListener("change", function () {
    const beginDate = normalizeAuditDateValue(
      refs.auditDownloadBeginDate?.dataset?.dpCanonical || refs.auditDownloadBeginDate?.value || ""
    );
    const endDate = normalizeAuditDateValue(
      refs.auditDownloadEndDate?.dataset?.dpCanonical || refs.auditDownloadEndDate?.value || ""
    );
    applyAuditDownloadDateBounds(beginDate, endDate);
  });
  refs.auditDownloadEndDate?.addEventListener("change", function () {
    const beginDate = normalizeAuditDateValue(
      refs.auditDownloadBeginDate?.dataset?.dpCanonical || refs.auditDownloadBeginDate?.value || ""
    );
    const endDate = normalizeAuditDateValue(
      refs.auditDownloadEndDate?.dataset?.dpCanonical || refs.auditDownloadEndDate?.value || ""
    );
    applyAuditDownloadDateBounds(beginDate, endDate);
  });
  refs.auditLoadMore?.addEventListener("click", function () {
    loadAuditLogs({ append: true });
  });

  async function handleExpenseTableAction(actionEl) {
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    if (action === "select-expense") {
      if (!state.expensesSelectionMode || !id) return;
      const next = new Set(state.selectedExpenseIds instanceof Set ? state.selectedExpenseIds : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      state.selectedExpenseIds = next;
      render();
      return;
    }

    if (state.expensesSelectionMode) {
      return;
    }

    const expense = (state.expenses || []).find((item) => item.id === id);
    if (!expense) return;

    if (action === "expense-edit") {
      if (hasDeactivatedOrRemovedClientProject(expense)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
      state.pendingInputsExpenseEditId = `${expense.id || ""}`.trim();
      state.inputSubtab = "expenses";
      setView("inputs");
      return;
    }

    if (action === "expense-delete") {
      if (hasDeactivatedOrRemovedClientProject(expense)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
      const confirmed = window.confirm("Delete this expense?");
      if (!confirmed) return;
      try {
        await mutatePersistentState(
          "delete_expense",
          { id },
          { skipHydrate: true, refreshState: false, returnState: false }
        );
      } catch (err) {
        feedback(err.message || "Unable to delete expense.", true);
        return;
      }
      const deletedRows = (state.expenses || []).filter(
        (item) => `${item?.id || ""}`.trim() === `${id || ""}`.trim()
      );
      state.expenses = (state.expenses || []).filter(
        (item) => `${item?.id || ""}`.trim() !== `${id || ""}`.trim()
      );
      state.lastExpenseDeleteUndo = {
        ids: [`${id || ""}`.trim()].filter(Boolean),
        rows: deletedRows.map((row) => ({ ...row })),
        count: 1,
      };
      addDeletedRowsToState("expense", deletedRows);
      syncEntriesUndoUi();
      feedback("", false);
      render();
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
    }
  }

  function bindExpenseReviewTableActions(tableBody) {
    if (!tableBody) return;
    tableBody.addEventListener("click", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      await handleExpenseTableAction(actionEl);
    });
    tableBody.addEventListener("keydown", function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actionEl.click();
    });
  }

  bindExpenseReviewTableActions(refs.expensesBody);

  if (refs.deletedItemsBody) {
    refs.deletedItemsBody.addEventListener("click", async function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = `${actionEl.dataset.action || ""}`.trim();
      const id = `${actionEl.dataset.id || ""}`.trim();
      const type = `${actionEl.dataset.type || ""}`.trim().toLowerCase();
      if (!id || (type !== "time" && type !== "expense")) return;

      if (action === "deleted-select-item") {
        if (!state.deletedSelectionMode) return;
        const key = deletedItemKey(type, id);
        if (!key) return;
        const next = new Set(state.selectedDeletedKeys instanceof Set ? state.selectedDeletedKeys : []);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        state.selectedDeletedKeys = next;
        render();
        return;
      }

      if (state.deletedSelectionMode) return;
      if (action !== "deleted-restore-item") return;
      const collection = type === "time" ? state.deletedEntries : state.deletedExpenses;
      const source = (collection || []).find((item) => `${item?.id || ""}`.trim() === id);
      if (!source) return;
      await restoreDeletedItems([
        {
          itemType: type,
          itemId: id,
        },
      ]);
    });
    refs.deletedItemsBody.addEventListener("keydown", function (event) {
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
  if (refs.addUserForm) {
    refs.addUserForm.addEventListener("submit", handleAddUser);
  }
  if (refs.settingsToggle) {
    refs.settingsToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      closeActingAsMenu();
      toggleSettingsMenu();
    });
  }
  if (refs.settingsOpen) {
    refs.settingsOpen.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!state.permissions?.view_settings_tab) {
        return;
      }
      closeSettingsMenu();
      closeActingAsMenu();
      setView("settings");
    });
  }
  if (refs.actingAsToggle) {
    refs.actingAsToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleActingAsMenu();
    });
  }
  if (refs.actingAsMenu) {
    refs.actingAsMenu.addEventListener("click", function (event) {
      const normalizeId = (value) => `${value || ""}`.trim().toLowerCase();
      const option = event.target.closest("[data-acting-as-id]");
      if (!option) return;
      const rawNextId = String(option.dataset.actingAsId || "");
      if (!rawNextId) {
        closeActingAsMenu();
        return;
      }
      const canonical = getActingAsUsers().find(
        (item) => normalizeId(item?.id) === normalizeId(rawNextId)
      );
      const nextId = `${canonical?.id || rawNextId}`.trim();
      if (!nextId || normalizeId(nextId) === normalizeId(state.actingAsUserId)) {
        closeActingAsMenu();
        return;
      }
      state.actingAsUserId = nextId;
      const scopeUser = effectiveScopeUser();
      const nextTimeFilterUser = scopeUser && isStaff(scopeUser)
        ? `${scopeUser.displayName || ""}`.trim()
        : "";
      state.filters = {
        ...state.filters,
        user: nextTimeFilterUser,
        client: "",
        project: "",
      };
      state.expenseFilters = {
        ...state.expenseFilters,
        user: resolveExpenseFilterUser(nextTimeFilterUser),
        client: "",
        project: "",
      };
      closeActingAsMenu();
      render();
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
    if (
      refs.actingAsMenu &&
      refs.actingAsToggle &&
      !refs.actingAsMenu.hidden &&
      !refs.actingAsMenu.contains(target) &&
      !refs.actingAsToggle.contains(target)
    ) {
      closeActingAsMenu();
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
  if (refs.ratesRows) {
    refs.ratesRows.addEventListener("click", handleUserListAction);
    refs.ratesRows.addEventListener("click", function (event) {
      const editBtn = event.target.closest("[data-member-edit]");
      if (!editBtn) return;
      event.preventDefault();
      openMemberEditorModal("edit", editBtn.dataset.memberEdit);
    });
  }
  if (refs.settingsPage) {
    refs.settingsPage.addEventListener("click", function (event) {
      const addBtn = event.target.closest("[data-member-add]");
      if (!addBtn) return;
      event.preventDefault();
      openMemberEditorModal("create");
    });
  }
  if (refs.addLevel) {
    refs.addLevel.addEventListener("click", async function () {
      handleAddLevel();
      if (!state.permissions?.edit_user_profile) {
        return;
      }
      const levels = getLevelDefinitions()
        .map((item) => ({
          level: Number(item.level),
          label: String(item.label || "").trim(),
          permissionGroup: String(item.permissionGroup || "staff").trim(),
        }))
        .sort((a, b) => a.level - b.level);
      try {
        await mutatePersistentState("update_level_labels", { levels }, settingsSaveFastOptions());
        refreshSettingsTabInBackground("levels");
        feedback("Level added.", false);
      } catch (error) {
        refreshSettingsTabInBackground("levels");
        feedback(error.message || "Unable to add level.", true);
      }
    });
  }

  async function refreshSettingsTab(tabKey) {
    await loadPersistentState();
    render();
    if (state.currentView !== "settings") {
      return;
    }
    const btn = tabKey
      ? document.querySelector(`[data-settings-tab-button="${tabKey}"]`)
      : null;
    if (btn) {
      btn.click();
    }
  }

  function refreshSettingsTabInBackground(tabKey) {
    refreshSettingsTab(tabKey).catch((error) => {
      feedback(error?.message || "Unable to refresh settings.", true);
    });
  }

  function loadPersistentStateInBackground() {
    loadPersistentState()
      .then(() => {
        render();
      })
      .catch((error) => {
        feedback(error?.message || "Unable to refresh data.", true);
      });
  }

  const settingsAutoSubmitTimers = new Map();
  const settingsAutoSaveStateByFormId = new Map();
  function getSettingsAutoSaveState(formId) {
    const key = String(formId || "").trim();
    if (!key) return null;
    if (!settingsAutoSaveStateByFormId.has(key)) {
      settingsAutoSaveStateByFormId.set(key, { inFlight: false, queued: false });
    }
    return settingsAutoSaveStateByFormId.get(key);
  }
  function beginSettingsAutoSave(formId) {
    const entry = getSettingsAutoSaveState(formId);
    if (!entry) return true;
    if (entry.inFlight) {
      entry.queued = true;
      return false;
    }
    entry.inFlight = true;
    entry.queued = false;
    return true;
  }
  function finishSettingsAutoSave(formId) {
    const entry = getSettingsAutoSaveState(formId);
    if (!entry) return;
    entry.inFlight = false;
    if (entry.queued) {
      entry.queued = false;
      scheduleSettingsFormAutoSubmit(formId, 0);
    }
  }
  function scheduleSettingsFormAutoSubmit(formId, delayMs = 700) {
    const key = String(formId || "").trim();
    if (!key) return;
    const saveState = getSettingsAutoSaveState(key);
    if (saveState?.inFlight) {
      saveState.queued = true;
      return;
    }
    const existing = settingsAutoSubmitTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      const form = document.getElementById(key);
      if (!form || typeof form.requestSubmit !== "function") return;
      form.requestSubmit();
    }, delayMs);
    settingsAutoSubmitTimers.set(key, timer);
  }

  function nextCorporateFunctionGroupSortOrder() {
    const existing = (state.corporateFunctionGroups || []).map((item) => Number(item?.sortOrder) || 0);
    const maxSort = existing.length ? Math.max(...existing) : 0;
    return maxSort + 10;
  }

  function nextCorporateFunctionCategorySortOrder(groupId) {
    const existing = (state.corporateFunctionCategories || [])
      .filter((item) => `${item?.groupId || ""}`.trim() === `${groupId || ""}`.trim())
      .map((item) => Number(item?.sortOrder) || 0);
    const maxSort = existing.length ? Math.max(...existing) : 0;
    return maxSort + 10;
  }

  function collectCorporateFunctionGroupsFromForm(form, options = {}) {
    const validate = options.validate !== false;
    const groupRows = Array.from(form?.querySelectorAll("[data-corporate-group-row]") || []);
    const groups = [];
    const groupSeen = new Set();
    for (const groupRow of groupRows) {
      const groupId = `${groupRow.dataset.corporateGroupId || ""}`.trim();
      const groupSortOrder = Number(groupRow.dataset.corporateGroupSortOrder || 0) || 0;
      const groupNameInput = groupRow.querySelector("[data-corporate-group-name]");
      const groupName = `${groupNameInput?.value || ""}`.trim();
      if (validate && !groupName) {
        feedback("Group name cannot be blank.", true);
        return null;
      }
      const groupKey = groupName.toLowerCase();
      if (validate && groupSeen.has(groupKey)) {
        feedback("Group names must be unique.", true);
        return null;
      }
      groupSeen.add(groupKey);

      const categoryRows = Array.from(groupRow.querySelectorAll(".corporate-function-row"));
      const categories = [];
      const categorySeen = new Set();
      for (const categoryRow of categoryRows) {
        const id = `${categoryRow.dataset.corporateFunctionId || ""}`.trim();
        const sortOrder = Number(categoryRow.dataset.corporateFunctionSortOrder || 0) || 0;
        const nameInput = categoryRow.querySelector("[data-corporate-function-name]");
        const name = `${nameInput?.value || ""}`.trim();
        if (validate && !name) {
          feedback(`Category name cannot be blank in ${groupName}.`, true);
          return null;
        }
        const categoryKey = name.toLowerCase();
        if (validate && categorySeen.has(categoryKey)) {
          feedback(`Category names must be unique within ${groupName}.`, true);
          return null;
        }
        categorySeen.add(categoryKey);
        categories.push({
          id: id || null,
          name,
          sortOrder,
        });
      }

      groups.push({
        id: groupId || null,
        name: groupName,
        sortOrder: groupSortOrder,
        categories,
      });
    }
    return groups;
  }

  function syncCorporateFunctionDraftFromForm() {
    const form = document.getElementById("corporate-functions-form");
    if (!form) return;
    const draftGroups = collectCorporateFunctionGroupsFromForm(form, { validate: false });
    if (!Array.isArray(draftGroups)) return;
    state.corporateFunctionGroups = draftGroups.map((group) => ({
      id: group.id || `temp-corp-group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: group.name || "",
      sortOrder: Number(group.sortOrder) || 0,
    }));
    state.corporateFunctionCategories = draftGroups.flatMap((group) =>
      (group.categories || []).map((category) => ({
        id: category.id || `temp-corp-cat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        groupId: group.id || "",
        groupName: group.name || "",
        name: category.name || "",
        sortOrder: Number(category.sortOrder) || 0,
      }))
    );
  }

  if (refs.expenseCategoriesForm) {
    refs.expenseCategoriesForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!beginSettingsAutoSave("expense-categories-form")) return;
      try {
        if (!state.permissions?.manage_expense_categories) {
          feedback("Access denied.", true);
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
          const name = (nameInput?.value || "").trim();
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
          categories.push({ id: id || null, name });
        }
        try {
          await mutatePersistentState("update_expense_categories", { categories }, settingsSaveFastOptions());
          feedback("Expense categories updated.", false);
        } catch (error) {
          feedback(error.message || "Unable to update expense categories.", true);
        }
      } finally {
        finishSettingsAutoSave("expense-categories-form");
      }
    });
  }

  async function saveOfficeLocations(locations) {
    if (!state.permissions?.manage_office_locations) {
      feedback("Access denied.", true);
      return;
    }
    try {
      try {
        window.localStorage.setItem("timesheet.offices", JSON.stringify(locations));
      } catch (e) {}
      await mutatePersistentState("update_office_locations", { locations }, settingsSaveFastOptions());
      feedback("Office locations updated.", false);
    } catch (error) {
      try {
        window.localStorage.setItem("timesheet.offices", JSON.stringify(locations));
      } catch (e) {}
      if ((error?.message || "").includes("Cannot Remove Office")) {
        const blockedBody = String(error.message || "").replace(/^Cannot Remove Office\s*\n?/, "").trim();
        await appDialog({
          title: "Cannot Remove Office",
          message: blockedBody || "This office still has active items assigned to it and cannot be removed.",
          cancelText: "Cancel",
          hideConfirm: true,
        });
        return;
      }
      feedback(error.message || "Unable to update office locations.", true);
    }
  }

  if (refs.officeLocationsForm) {
    refs.officeLocationsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!beginSettingsAutoSave("office-locations-form")) return;
      try {
        const rows = Array.from(refs.officeRows?.querySelectorAll(".office-row") || []);
        const seen = new Set();
        const locations = [];
        for (const row of rows) {
          const id = (row.dataset.officeId || "").trim();
          const nameInput = row.querySelector("[data-office-name]");
          const leadSelect = row.querySelector("[data-office-lead]");
          const name = (nameInput?.value || "").trim();
          const officeLeadUserId = (leadSelect?.value || "").trim();
          if (!name) {
            feedback("Location name is required.", true);
            return;
          }
          const key = name.toLowerCase();
          if (seen.has(key)) {
            feedback("Location names must be unique.", true);
            return;
          }
          seen.add(key);
          locations.push({ id: id || null, name, officeLeadUserId });
        }
        state.officeLocations = locations;
        await saveOfficeLocations(locations);
        renderOfficeLocations();
        window.settingsAdmin?.renderTargetRealizations?.();
      } finally {
        finishSettingsAutoSave("office-locations-form");
      }
    });
  }

  if (refs.addOffice) {
    refs.addOffice.addEventListener("click", async function () {
      if (!state.permissions?.manage_office_locations) {
        feedback("Access denied.", true);
        return;
      }
      const newItem = {
        id: `temp-office-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: "",
        officeLeadUserId: "",
      };
      state.officeLocations = [...state.officeLocations, newItem];
      renderOfficeLocations();
      window.settingsAdmin?.renderTargetRealizations?.();
      if (refs.officeAddName) refs.officeAddName.value = "";
      if (refs.officeAddLead) refs.officeAddLead.value = "";
    });
  }

  if (refs.officeRows) {
    refs.officeRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-office-delete]");
      const row = event.target.closest(".office-row");
      if (!row) return;

      if (deleteBtn) {
        if (!state.permissions?.manage_office_locations) {
          feedback("Access denied.", true);
          return;
        }
        const id = row.dataset.officeId;
        const officeKey = `${id || ""}`.trim();
        const activeMembers = (state.users || []).filter((user) => `${user?.officeId || ""}`.trim() === officeKey).length;
        const activeClients = (state.clients || []).filter((client) => `${client?.officeId || ""}`.trim() === officeKey).length;
        const activeProjects = (state.projects || []).filter((project) => `${project?.officeId || ""}`.trim() === officeKey).length;
        const hasDependencies = activeMembers > 0 || activeClients > 0 || activeProjects > 0;
        if (hasDependencies) {
          await appDialog({
            title: "Cannot Remove Office",
            message:
              "This office still has active items assigned to it and cannot be removed.\n\n" +
              "Please reassign or remove all active:\n" +
              "- members\n" +
              "- clients\n" +
              "- projects\n\n" +
              `${activeMembers} active members\n` +
              `${activeClients} active clients\n` +
              `${activeProjects} active projects`,
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
        const confirmation = await appDialog({
          title: "Remove Office?",
          message: "This office has no active members, clients, or projects assigned to it. Removing it cannot be undone.",
          confirmText: "Remove",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        state.officeLocations = state.officeLocations.filter((item) => item.id !== id);
        renderOfficeLocations();
        window.settingsAdmin?.renderTargetRealizations?.();
        await saveOfficeLocations(state.officeLocations);
      }
    });
  }

  if (refs.expenseRows) {
    refs.expenseRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-expense-delete]");
      if (!deleteBtn) return;
      if (!state.permissions?.manage_expense_categories) {
        feedback("Access denied.", true);
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
        const name = (nameInput?.value || "").trim();
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
        categories.push({ id: id || null, name });
      }

      const previous = [...state.expenseCategories];
      state.expenseCategories = categories;
      renderExpenseCategories();
      try {
        await mutatePersistentState("update_expense_categories", { categories }, settingsSaveFastOptions());
        refreshSettingsTabInBackground("categories");
        feedback("Category deleted.", false);
      } catch (error) {
        state.expenseCategories = previous;
        renderExpenseCategories();
        feedback(error.message || "Unable to delete category.", true);
      }
    });
  }

  if (refs.settingsPage) {
    refs.settingsPage.addEventListener("click", async function (event) {
      const addCorporateGroupBtn = event.target.closest("[data-corporate-add-group]");
      if (addCorporateGroupBtn) {
        if (!state.permissions?.manage_corporate_functions) {
          feedback("Access denied.", true);
          return;
        }
        syncCorporateFunctionDraftFromForm();
        const newGroupId = `temp-corp-group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        state.corporateFunctionGroups = [
          ...(state.corporateFunctionGroups || []),
          {
            id: newGroupId,
            name: "",
            sortOrder: nextCorporateFunctionGroupSortOrder(),
          },
        ];
        renderCorporateFunctionCategories?.();
        return;
      }

      const addCorporateCategoryBtn = event.target.closest("[data-corporate-add-category]");
      if (addCorporateCategoryBtn) {
        if (!state.permissions?.manage_corporate_functions) {
          feedback("Access denied.", true);
          return;
        }
        syncCorporateFunctionDraftFromForm();
        const groupId = `${addCorporateCategoryBtn.dataset.corporateAddCategory || ""}`.trim();
        if (!groupId) {
          return;
        }
        const group = (state.corporateFunctionGroups || []).find(
          (item) => `${item?.id || ""}`.trim() === groupId
        );
        if (!group) {
          return;
        }
        state.corporateFunctionCategories = (state.corporateFunctionCategories || []).map((item) => {
          if (!item || `${item?.groupId || ""}`.trim() !== groupId) return item;
          return { ...item, groupName: group.name || "" };
        });
        state.corporateFunctionCategories = [
          ...(state.corporateFunctionCategories || []),
          {
            id: `temp-corp-cat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            groupId,
            groupName: group.name || "",
            name: "",
            sortOrder: nextCorporateFunctionCategorySortOrder(groupId),
          },
        ];
        renderCorporateFunctionCategories?.();
        return;
      }

      const deleteCorporateCategoryBtn = event.target.closest("[data-corporate-delete-category]");
      if (deleteCorporateCategoryBtn) {
        if (!state.permissions?.manage_corporate_functions) {
          feedback("Access denied.", true);
          return;
        }
        syncCorporateFunctionDraftFromForm();
        const categoryId = `${deleteCorporateCategoryBtn.dataset.corporateDeleteCategory || ""}`.trim();
        if (!categoryId) return;
        state.corporateFunctionCategories = (state.corporateFunctionCategories || []).filter(
          (item) => `${item?.id || ""}`.trim() !== categoryId
        );
        renderCorporateFunctionCategories?.();
        scheduleSettingsFormAutoSubmit("corporate-functions-form");
        return;
      }

      const deleteCorporateGroupBtn = event.target.closest("[data-corporate-delete-group]");
      if (deleteCorporateGroupBtn) {
        if (!state.permissions?.manage_corporate_functions) {
          feedback("Access denied.", true);
          return;
        }
        syncCorporateFunctionDraftFromForm();
        const groupId = `${deleteCorporateGroupBtn.dataset.corporateDeleteGroup || ""}`.trim();
        if (!groupId) return;
        const group = (state.corporateFunctionGroups || []).find(
          (item) => `${item?.id || ""}`.trim() === groupId
        );
        const categoryCount = (state.corporateFunctionCategories || []).filter(
          (item) => `${item?.groupId || ""}`.trim() === groupId
        ).length;
        const confirmation = await appDialog({
          title: "Delete group?",
          message: `Delete "${group?.name || "this group"}" and ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} in it?`,
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        state.corporateFunctionGroups = (state.corporateFunctionGroups || []).filter(
          (item) => `${item?.id || ""}`.trim() !== groupId
        );
        state.corporateFunctionCategories = (state.corporateFunctionCategories || []).filter(
          (item) => `${item?.groupId || ""}`.trim() !== groupId
        );
        renderCorporateFunctionCategories?.();
        scheduleSettingsFormAutoSubmit("corporate-functions-form");
        return;
      }

      const addDepartmentBtn = event.target.closest("#add-department");
      if (addDepartmentBtn) {
        if (!state.permissions?.manage_departments) {
          feedback("Access denied.", true);
          return;
        }
        state.departments = [
          ...state.departments,
          {
            id: `temp-dept-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: "",
            techAdminFeePct: null,
          },
        ];
        window.settingsAdmin?.renderDepartments();
        window.settingsAdmin?.renderTargetRealizations?.();
        return;
      }

      const departmentRows = refs.settingsPage.querySelector("#department-rows");
      if (!departmentRows) {
        return;
      }

      const deleteBtn = event.target.closest("[data-department-delete]");
      if (deleteBtn && departmentRows.contains(deleteBtn)) {
        if (!state.permissions?.manage_departments) {
          feedback("Access denied.", true);
          return;
        }
        const row = deleteBtn.closest(".department-row");
        if (!row) return;
        const id = row.dataset.departmentId || "";
        const assignedMembers = (state.users || []).filter(function (user) {
          return user?.isActive !== false && String(user?.departmentId || "") === String(id || "");
        }).length;
        const confirmation = await appDialog({
          title: "Delete department?",
          message: `Are you sure you would like to delete this department?\nCurrently there are ${assignedMembers} member${assignedMembers === 1 ? "" : "s"} assigned to this department.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        state.departments = (state.departments || []).filter((d) => String(d.id || "") !== String(id));
        window.settingsAdmin?.renderDepartments();
        window.settingsAdmin?.renderTargetRealizations?.();
        scheduleSettingsFormAutoSubmit("departments-form");
        return;
      }

    });

    refs.settingsPage.addEventListener("submit", async function (event) {
      const corporateFunctionsForm = event.target.closest("#corporate-functions-form");
      if (corporateFunctionsForm) {
        event.preventDefault();
        if (!beginSettingsAutoSave("corporate-functions-form")) return;
        try {
          if (!state.permissions?.manage_corporate_functions) {
            feedback("Access denied.", true);
            return;
          }
          const groups = collectCorporateFunctionGroupsFromForm(corporateFunctionsForm);
          if (!groups) {
            return;
          }
          try {
            await mutatePersistentState(
              "update_corporate_function_categories",
              { groups },
              settingsSaveFastOptions()
            );
            feedback("Corporate functions updated.", false);
          } catch (error) {
            feedback(error.message || "Unable to update corporate functions.", true);
          }
        } finally {
          finishSettingsAutoSave("corporate-functions-form");
        }
        return;
      }

      const departmentsForm = event.target.closest("#departments-form");
      if (departmentsForm) {
        event.preventDefault();
        if (!beginSettingsAutoSave("departments-form")) return;
        try {
          if (!state.permissions?.manage_target_realizations) {
            feedback("Access denied.", true);
            return;
          }

          const rows = Array.from(departmentsForm.querySelectorAll(".department-row"));
          if (!rows.length) {
            feedback("Add at least one department.", true);
            return;
          }
          const existingMap = new Map(
            (state.departmentsSnapshot || []).map((d) => [String(d.id || ""), d])
          );
          const seen = new Set();
          const createOps = [];
          const renameOps = [];
          const deleteOps = [];
          const remainingIds = new Set();

          for (const row of rows) {
            const id = String((row.dataset.departmentId || "").trim());
            const nameInput = row.querySelector("[data-department-name]");
            const techAdminFeeInput = row.querySelector("[data-department-tech-admin-fee-pct]");
            const name = (nameInput?.value || "").trim();
            const rawTechAdminFeePct = `${techAdminFeeInput?.value || ""}`.trim();
            const techAdminFeePct =
              rawTechAdminFeePct === ""
                ? null
                : Number(rawTechAdminFeePct);

            if (!name) {
              feedback("Department name is required.", true);
              return;
            }
            if (rawTechAdminFeePct !== "" && (!Number.isFinite(techAdminFeePct) || techAdminFeePct < 0)) {
              feedback("Tech/Admin fee % must be a non-negative number.", true);
              return;
            }
            const key = name.toLowerCase();
            if (seen.has(key)) {
              feedback("Department names must be unique.", true);
              return;
            }
            seen.add(key);

            if (!id || id.startsWith("temp-dept-")) {
              createOps.push({ tempId: id, name, techAdminFeePct });
              continue;
            }
            remainingIds.add(id);
            const prev = existingMap.get(id) || {};
            const prevTechAdminFeePctRaw = prev.techAdminFeePct ?? prev.tech_admin_fee_pct;
            const prevTechAdminFeePct =
              prevTechAdminFeePctRaw === null || prevTechAdminFeePctRaw === undefined || `${prevTechAdminFeePctRaw}`.trim() === ""
                ? null
                : Number(prevTechAdminFeePctRaw);
            if (prev.name !== name || prevTechAdminFeePct !== techAdminFeePct) {
              renameOps.push({ id, name, techAdminFeePct });
            }
          }

          for (const [id] of existingMap.entries()) {
            if (!id || !remainingIds.has(id)) {
              deleteOps.push({ id });
            }
          }

          try {
            const createdByTempId = new Map();
            for (const op of createOps) {
              const created = await mutatePersistentState(
                "create_department",
                { name: op.name, techAdminFeePct: op.techAdminFeePct },
                settingsSaveFastOptions()
              );
              const createdId = `${created?.id || ""}`.trim();
              if (op.tempId && createdId) {
                createdByTempId.set(op.tempId, createdId);
              }
            }
            for (const op of renameOps) {
              await mutatePersistentState(
                "rename_department",
                { id: op.id, name: op.name, techAdminFeePct: op.techAdminFeePct },
                settingsSaveFastOptions()
              );
            }
            for (const op of deleteOps) {
              await mutatePersistentState("delete_department", { id: op.id }, settingsSaveFastOptions());
            }
            const nextDepartments = rows
              .map((row) => {
                const rawId = String((row.dataset.departmentId || "").trim());
                const resolvedId =
                  createdByTempId.get(rawId) ||
                  (rawId && !rawId.startsWith("temp-dept-") ? rawId : "");
                const nameInput = row.querySelector("[data-department-name]");
                const techAdminFeeInput = row.querySelector("[data-department-tech-admin-fee-pct]");
                const name = (nameInput?.value || "").trim();
                const rawTechAdminFeePct = `${techAdminFeeInput?.value || ""}`.trim();
                const techAdminFeePct =
                  rawTechAdminFeePct === ""
                    ? null
                    : Number(rawTechAdminFeePct);
                if (!name) return null;
                return {
                  id: resolvedId || `temp-dept-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  name,
                  techAdminFeePct,
                };
              })
              .filter(Boolean);
            state.departments = nextDepartments;
            state.departmentsSnapshot = nextDepartments.slice();
            window.settingsAdmin?.renderTargetRealizations?.();
            feedback("Departments updated.", false);
          } catch (error) {
            feedback(error.message || "Unable to update departments.", true);
          }
        } finally {
          finishSettingsAutoSave("departments-form");
        }
        return;
      }

      const targetRealizationsForm = event.target.closest("#target-realizations-form");
      if (targetRealizationsForm) {
        event.preventDefault();
        if (!beginSettingsAutoSave("target-realizations-form")) return;
        try {
          if (!state.permissions?.manage_departments) {
            feedback("Access denied.", true);
            return;
          }
          const inputs = Array.from(
            targetRealizationsForm.querySelectorAll("[data-target-realization-input][data-target-office-id][data-target-department-id]")
          );
          const payloadRows = [];
          for (const input of inputs) {
            const officeId = String(input.dataset.targetOfficeId || "").trim();
            const departmentId = String(input.dataset.targetDepartmentId || "").trim();
            if (!officeId || !departmentId) continue;
            const raw = String(input.value || "").trim();
            if (!raw) continue;
            const targetRealizationPct = Number(raw);
            if (!Number.isFinite(targetRealizationPct) || targetRealizationPct < 0) {
              feedback("Target realization % must be a non-negative number.", true);
              return;
            }
            payloadRows.push({ officeId, departmentId, targetRealizationPct });
          }
          try {
            await mutatePersistentState(
              "update_target_realizations",
              { targetRealizations: payloadRows },
              settingsSaveFastOptions()
            );
            state.targetRealizations = payloadRows.map((item) => ({
              id: `${item.officeId}::${item.departmentId}`,
              officeId: item.officeId,
              departmentId: item.departmentId,
              targetRealizationPct: item.targetRealizationPct,
            }));
            feedback("Target realizations updated.", false);
          } catch (error) {
            feedback(error.message || "Unable to update target realizations.", true);
          }
        } finally {
          finishSettingsAutoSave("target-realizations-form");
        }
      }
    });
  }

  if (refs.levelRows) {
    const scheduleLevelsAutoSave = function () {
      scheduleSettingsFormAutoSubmit("level-labels-form");
    };
    refs.levelRows.addEventListener("input", function (event) {
      const input = event.target.closest("[data-level-label]");
      if (!input) return;
      scheduleLevelsAutoSave();
    });
    refs.levelRows.addEventListener("change", function (event) {
      const input = event.target.closest("[data-level-permission]");
      if (!input) return;
      scheduleLevelsAutoSave();
    });
    refs.levelRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-level-delete]");
      if (!deleteBtn) return;
      if (!state.permissions?.edit_user_profile) {
        feedback("Access denied.", true);
        return;
      }
      const row = deleteBtn.closest(".level-row");
      if (!row) return;
      const levelToRemove = Number(row.dataset.level);
      const confirmDelete = await appDialog({
        title: "Delete this level?",
        message: "This level will be deleted immediately.",
        confirmText: "Delete",
        cancelText: "Cancel",
      });
      if (!confirmDelete.confirmed) {
        return;
      }

      const rows = Array.from(refs.levelRows.querySelectorAll(".level-row[data-level]")).filter((r) => r !== row);

      const seen = new Set();
      const validGroups = new Set(["staff", "manager", "executive", "admin", "superuser"]);
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

      const adminCount = levels.filter((l) => l.permissionGroup === "admin" || l.permissionGroup === "superuser").length;
      if (adminCount === 0) {
        feedback("At least one admin permission level is required.", true);
        return;
      }

      try {
        await mutatePersistentState("update_level_labels", { levels }, settingsSaveFastOptions());
        refreshSettingsTabInBackground("levels");
        feedback("Level deleted.", false);
      } catch (error) {
        refreshSettingsTabInBackground("levels");
        feedback(error.message || "Unable to delete level.", true);
      }
    });
  }

  if (refs.addCategory) {
    refs.addCategory.addEventListener("click", function () {
      if (!state.permissions?.manage_expense_categories) {
        feedback("Access denied.", true);
        return;
      }
      state.expenseCategories = [
        ...state.expenseCategories,
        {
          id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: "",
        },
      ];
      renderExpenseCategories();
    });
  }

  if (refs.expenseRows) {
    refs.expenseRows.addEventListener("input", function (event) {
      const input = event.target.closest("[data-expense-name]");
      if (!input) return;
      const trimmed = `${input.value || ""}`.trim();
      if (!trimmed) return;
      scheduleSettingsFormAutoSubmit("expense-categories-form");
    });
  }

  if (refs.officeRows) {
    const scheduleOfficeAutoSave = function () {
      scheduleSettingsFormAutoSubmit("office-locations-form");
    };
    refs.officeRows.addEventListener("input", function (event) {
      const input = event.target.closest("[data-office-name]");
      if (!input) return;
      scheduleOfficeAutoSave();
    });
    refs.officeRows.addEventListener("change", function (event) {
      const input = event.target.closest("[data-office-lead]");
      if (!input) return;
      scheduleOfficeAutoSave();
    });
  }

  if (refs.settingsPage) {
    refs.settingsPage.addEventListener("input", function (event) {
      if (event.target.closest("[data-corporate-group-name], [data-corporate-function-name]")) {
        scheduleSettingsFormAutoSubmit("corporate-functions-form");
        return;
      }
      if (event.target.closest("[data-department-name], [data-department-tech-admin-fee-pct]")) {
        const value = String(event.target.value || "").trim();
        if (!value) return;
        scheduleSettingsFormAutoSubmit("departments-form");
        return;
      }
      if (event.target.closest("[data-target-realization-input]")) {
        scheduleSettingsFormAutoSubmit("target-realizations-form");
      }
    });
  }

  if (refs.addClientForm && refs.addClientForm.isConnected) {
    refs.addClientForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!canManageClientsLifecycle()) {
        feedback("Access denied.", true);
        return;
      }
      const clientNameField = field(refs.addClientForm, "client_name");
      const rawName = clientNameField.value.trim();
      if (!rawName) {
        feedback("Client name is required.", true);
        return;
      }
      await ensureOfficeLocationsLoadedForClientEditor();
      openClientEditor({ mode: "create", clientName: rawName });
      syncClientEditorLeadField();
    });
  }

  if (refs.clientEditor) {
    refs.clientEditor.addEventListener("click", function (event) {
      if (event.target.closest("[data-cancel-client]")) {
        closeClientEditor();
        render();
      }
    });

    refs.clientEditor.addEventListener("change", function (event) {
      const form = event.target.closest("[data-client-editor-form]");
      if (!form) return;
      if (event.target.matches("[data-billing-same-as-business]")) {
        syncBillingContactFromBusiness(form);
      }
    });

    refs.clientEditor.addEventListener("input", function (event) {
      const form = event.target.closest("[data-client-editor-form]");
      if (!form) return;
      if (
        event.target.matches(
          '[name="business_contact_name"], [name="business_contact_email"], [name="business_contact_phone"]'
        )
      ) {
        syncBillingContactFromBusiness(form);
      }
    });

    refs.clientEditor.addEventListener("submit", async function (event) {
      const form = event.target.closest("[data-client-editor-form]");
      if (!form) return;
      event.preventDefault();
      const editor = state.clientEditor;
      const canSaveClient =
        editor?.mode === "edit"
          ? canEditClientsGlobal()
          : canManageClientsLifecycle();
      if (!canSaveClient) {
        feedback("Access denied.", true);
        return;
      }
      if (!editor) return;
      const values = readClientEditorForm(form);
      values.clientLeadId = String(field(form, "client_lead_id")?.value || "").trim() || null;
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
      const normalizedNextClientName = String(values.name || "").trim().toLowerCase();
      const hasDuplicateClientName = (state.clients || []).some((client) => {
        const existingName = String(client?.name || "").trim().toLowerCase();
        if (!existingName || existingName !== normalizedNextClientName) return false;
        if (editor.mode !== "edit") return true;
        const originalName = String(editor.originalName || "").trim().toLowerCase();
        return existingName !== originalName;
      });
      if (hasDuplicateClientName) {
        const msg = "That client already exists.";
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
        officeId: values.officeId || null,
        client_lead_id: values.clientLeadId,
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

      const filterUserField = field(refs.filterForm, "user");

      try {
        await mutatePersistentState(action, payload);
        applyClientNameChange(editor.originalName, values.name);
        state.selectedCatalogClient = values.name;
        refs.addClientForm?.reset();
        feedback(action === "add_client" ? "Client added." : "Client updated.", false);
        closeClientEditor();
        syncFilterCatalogsUI({
          user: filterUserField?.value,
          client: state.filters.client,
          project: state.filters.project,
        });
      } catch (error) {
        const msg = error.message || "Unable to save client.";
        setClientEditorMessage(form, msg);
        feedback(msg, true);
      }
      render();
    });
  }

  refs.clientList.addEventListener("click", async function (event) {
    const editButton = event.target.closest("[data-edit-client]");
    if (editButton) {
      if (!canEditClientsGlobal()) {
        feedback("Access denied.", true);
        return;
      }
      const clientName = editButton.dataset.editClient;
      await ensureOfficeLocationsLoadedForClientEditor();
      openClientEditor({ mode: "edit", clientName });
      syncClientEditorLeadField();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-client]");
    const deactivateButton = event.target.closest("[data-deactivate-client]");
    const reactivateButton = event.target.closest("[data-reactivate-client]");
    if (deactivateButton || reactivateButton) {
      if (!canManageClientsLifecycle()) {
        feedback("Access denied.", true);
        return;
      }
      const clientName = deactivateButton?.dataset.deactivateClient || reactivateButton?.dataset.reactivateClient;
      if (!clientName) return;

      if (deactivateButton) {
        const activeProjectCount = (state.projects || []).filter(
          (project) => project.client === clientName && isProjectActive(project)
        ).length;
        if (activeProjectCount > 0) {
          await appDialog({
            title: "Cannot Deactivate Client",
            message:
              "This client still has active projects.\n\n" +
              "Please deactivate or remove all active projects before deactivating this client.\n\n" +
              `${activeProjectCount} active projects`,
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
        const confirmation = await appDialog({
          title: "Deactivate Client?",
          message:
            "This client will be removed from active use but its historical time and expense records will be preserved.",
          confirmText: "Deactivate",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        try {
          await mutatePersistentState(
            "deactivate_client",
            { clientName },
            { skipHydrate: true, refreshState: false, returnState: false }
          );
        } catch (error) {
          const message = error.message || "Unable to deactivate client.";
          if (message.includes("Cannot Deactivate Client")) {
            const blockedBody = String(message).replace(/^Cannot Deactivate Client\s*\n?/, "").trim();
            await appDialog({
              title: "Cannot Deactivate Client",
              message:
                blockedBody ||
                "This client still has active projects.\n\nPlease deactivate or remove all active projects before deactivating this client.",
              cancelText: "Cancel",
              hideConfirm: true,
            });
            return;
          }
          feedback(message, true);
          return;
        }
        state.clients = (state.clients || []).map((client) =>
          String(client?.name || "").trim() === String(clientName || "").trim()
            ? { ...client, isActive: false, is_active: false }
            : client
        );
        ensureCatalogSelection();
        syncFilterCatalogsUI(state.filters);
        feedback("Client deactivated.", false);
        render();
        loadPersistentStateInBackground();
        return;
      }

      try {
        await mutatePersistentState(
          "reactivate_client",
          { clientName },
          { skipHydrate: true, refreshState: false, returnState: false }
        );
      } catch (error) {
        feedback(error.message || "Unable to reactivate client.", true);
        return;
      }
      state.clients = (state.clients || []).map((client) =>
        String(client?.name || "").trim() === String(clientName || "").trim()
          ? { ...client, isActive: true, is_active: true }
          : client
      );
      ensureCatalogSelection();
      syncFilterCatalogsUI(state.filters);
      feedback("Client reactivated.", false);
      render();
      loadPersistentStateInBackground();
      return;
    }

    if (deleteButton) {
      if (!canManageClientsLifecycle()) {
        feedback("Access denied.", true);
        return;
      }
      const clientName = deleteButton.dataset.deleteClient;
      const activeProjectCount = state.projects.filter((p) => p.client === clientName).length;
      if (activeProjectCount > 0) {
        await appDialog({
          title: "Cannot Remove Client",
          message:
            "This client still has active projects assigned to it and cannot be removed.\n\n" +
            "Please remove or reassign all active projects before deleting this client.\n\n" +
            `${activeProjectCount} active projects`,
          cancelText: "Cancel",
          hideConfirm: true,
        });
        return;
      }
      const dialogResult = await appDialog({
        title: "Remove Client?",
        message: "This client has no active projects assigned to it. Removing it cannot be undone.",
        confirmText: "Remove",
        cancelText: "Cancel",
      });
      if (!dialogResult.confirmed) {
        return;
      }

      let message = "";
      try {
        const result = await mutatePersistentState("remove_client", {
          clientName,
        }, { skipHydrate: true, refreshState: false, returnState: false });
        message = result?.message || "";
        delete state.catalog[clientName];
        state.clients = (state.clients || []).filter(
          (client) => String(client?.name || "").trim() !== String(clientName || "").trim()
        );
        state.projects = (state.projects || []).filter(
          (project) => String(project?.client || "").trim() !== String(clientName || "").trim()
        );
        if (state.selectedCatalogClient === clientName) {
          state.selectedCatalogClient = "";
        }
        if (state.filters.client === clientName) {
          state.filters.client = "";
        }
      } catch (error) {
        const message = error.message || "Unable to remove client.";
        if (message.includes("Cannot Remove Client")) {
          const blockedBody = String(message).replace(/^Cannot Remove Client\s*\n?/, "").trim();
          await appDialog({
            title: "Cannot Remove Client",
            message:
              blockedBody ||
              "This client still has active projects assigned to it and cannot be removed.\n\nPlease remove or reassign all active projects before deleting this client.",
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
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

      syncFilterCatalogsUI(state.filters);
      feedback(message || "Client removed from active catalog.", false);
      render();
      loadPersistentStateInBackground();
      return;
    }

    const button = event.target.closest("[data-client]");
    if (!button) {
      return;
    }

    state.selectedCatalogClient = button.dataset.client;
    if (state.catalogProjectLifecycleView === "inactive") {
      const nextClient = String(state.selectedCatalogClient || "").trim();
      const inactiveProjectsForClient = nextClient
        ? visibleCatalogProjectNames(nextClient, { forCatalogView: true })
        : [];
      if (!inactiveProjectsForClient.length) {
        state.catalogProjectLifecycleView = "active";
      }
    }
    renderCatalogAside();
    syncClientLifecycleToggleUi();
    syncProjectLifecycleToggleUi();
    syncProjectCardsUx();
    if (isMobileDrilldownViewport()) {
      state.mobileClientsView = "detail";
      syncClientsMobileDrilldownState();
    }
    postHeight();
  });

  if (refs.clientsPage) {
    refs.clientsPage.addEventListener("click", function (event) {
      const backButton = event.target.closest("[data-action='clients-mobile-back']");
      if (!backButton) return;
      state.mobileClientsView = "list";
      syncClientsMobileDrilldownState();
      postHeight();
    });
  }

  refs.clientList.addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-client]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    row.click();
  });

  refs.projectList.addEventListener("click", async function (event) {
    const updateProgressButton = event.target.closest("[data-update-project-progress]");
    if (updateProgressButton) {
      const projectName = String(updateProgressButton.dataset.updateProjectProgress || "").trim();
      if (!projectName) return;
      if (!canEditProjectModal(state.selectedCatalogClient, projectName)) {
        feedback("Access denied.", true);
        return;
      }
      const projectRow = (state.projects || []).find(
        (project) =>
          String(project?.client || "").trim() === String(state.selectedCatalogClient || "").trim() &&
          String(project?.name || "").trim() === projectName
      );
      const currentPercentRaw = projectRow?.percentComplete ?? projectRow?.percent_complete;
      const currentPercentText =
        currentPercentRaw === null || currentPercentRaw === undefined || currentPercentRaw === ""
          ? ""
          : String(Number(currentPercentRaw));
      const dialog = await appDialog({
        title: "Update % Complete",
        message: "Enter a value from 0 to 100.",
        confirmText: "Save",
        cancelText: "Cancel",
        input: true,
        defaultValue: currentPercentText,
      });
      if (!dialog?.confirmed) {
        return;
      }
      const trimmedPercent = String(dialog?.value || "").trim();
      if (!trimmedPercent) {
        feedback("% Complete is required.", true);
        return;
      }
      const nextPercent = Number(trimmedPercent);
      if (!Number.isFinite(nextPercent) || nextPercent < 0 || nextPercent > 100) {
        feedback("% Complete must be a number between 0 and 100.", true);
        return;
      }
      try {
        await mutatePersistentState(
          "update_project_progress",
          {
            clientName: state.selectedCatalogClient,
            projectName,
            percentComplete: nextPercent,
          },
          { skipHydrate: false, refreshState: false, returnState: true }
        );
        renderCatalogAside();
        syncProjectCardsUx();
        feedback("Project progress updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update project progress.", true);
      }
      return;
    }

    const viewTimeButton = event.target.closest("[data-view-time-project]");
    if (viewTimeButton) {
      const projectName = viewTimeButton.dataset.viewTimeProject;
      state.filters.client = state.selectedCatalogClient;
      state.filters.project = projectName;
      syncSharedEntriesFiltersFromTime();
      state.entriesSubtab = "time";
      setView("entries");
      return;
    }

    const viewExpensesButton = event.target.closest("[data-view-expenses-project]");
    if (viewExpensesButton) {
      const projectName = viewExpensesButton.dataset.viewExpensesProject;
      state.expenseFilters.client = state.selectedCatalogClient;
      state.expenseFilters.project = projectName;
      syncSharedEntriesFiltersFromExpense();
      state.entriesSubtab = "expenses";
      setView("entries");
      return;
    }

    const assignManagersProject = event.target.closest("[data-assign-managers-project]");
    if (assignManagersProject) {
      if (!state.permissions?.assign_project_managers) {
        feedback("Access denied.", true);
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
      if (!state.permissions?.assign_project_managers) {
        feedback("Access denied.", true);
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
      const projectName = editButton.dataset.editProject;
      if (!canEditProjectModal(state.selectedCatalogClient, projectName)) {
        feedback("Access denied.", true);
        return;
      }
      await openProjectEditDialogFlow(state.selectedCatalogClient, projectName);
      return;
    }

    const deactivateButton = event.target.closest("[data-deactivate-project]");
    const reactivateButton = event.target.closest("[data-reactivate-project]");
    if (deactivateButton || reactivateButton) {
      const projectName = deactivateButton?.dataset.deactivateProject || reactivateButton?.dataset.reactivateProject;
      const canManageProjectLifecycle = canManageProjectsLifecycle();
      if (!canManageProjectLifecycle) {
        feedback("Access denied.", true);
        return;
      }

      if (deactivateButton) {
        const assignedActiveMembers = assignedActiveMembersCountForProject(
          state.selectedCatalogClient,
          projectName
        );
        if (assignedActiveMembers > 0) {
          await appDialog({
            title: "Cannot Deactivate Project",
            message:
              "This project still has assigned active members.\n\n" +
              "Please remove or reassign all assigned active members before deactivating this project.\n\n" +
              `${assignedActiveMembers} assigned active members`,
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
        const confirmation = await appDialog({
          title: "Deactivate Project?",
          message:
            "This project will be removed from active use but its historical time and expense records will be preserved.",
          confirmText: "Deactivate",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        try {
          await mutatePersistentState("deactivate_project", {
            clientName: state.selectedCatalogClient,
            projectName,
          }, { skipHydrate: true, refreshState: false, returnState: false });
        } catch (error) {
          const message = error.message || "Unable to deactivate project.";
          if (message.includes("Cannot Deactivate Project")) {
            const blockedBody = String(message).replace(/^Cannot Deactivate Project\s*\n?/, "").trim();
            await appDialog({
              title: "Cannot Deactivate Project",
              message:
                blockedBody ||
                "This project still has assigned active members.\n\nPlease remove or reassign all assigned active members before deactivating this project.",
              cancelText: "Cancel",
              hideConfirm: true,
            });
            return;
          }
          feedback(message, true);
          return;
        }
        state.projects = (state.projects || []).map((project) => {
          const matchesClient =
            String(project?.client || "").trim() === String(state.selectedCatalogClient || "").trim();
          const matchesProject =
            String(project?.name || "").trim() === String(projectName || "").trim();
          if (!matchesClient || !matchesProject) return project;
          return { ...project, isActive: false, is_active: false };
        });
        syncFilterCatalogsUI(state.filters);
        feedback("Project deactivated.", false);
        render();
        loadPersistentStateInBackground();
        return;
      }

      const selectedClientRow = (state.clients || []).find(
        (client) => client.name === state.selectedCatalogClient
      );
      if (!isClientActive(selectedClientRow)) {
        await appDialog({
          title: "Cannot Reactivate Project",
          message:
            "This project’s client is inactive.\n\n" +
            "Please reactivate the client before reactivating this project.",
          cancelText: "Cancel",
          hideConfirm: true,
        });
        return;
      }

      try {
        await mutatePersistentState("reactivate_project", {
          clientName: state.selectedCatalogClient,
          projectName,
        }, { skipHydrate: true, refreshState: false, returnState: false });
      } catch (error) {
        const message = error.message || "Unable to reactivate project.";
        if (message.includes("Cannot Reactivate Project")) {
          const blockedBody = String(message).replace(/^Cannot Reactivate Project\s*\n?/, "").trim();
          await appDialog({
            title: "Cannot Reactivate Project",
            message:
              blockedBody ||
              "This project’s client is inactive.\n\nPlease reactivate the client before reactivating this project.",
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
        feedback(message, true);
        return;
      }
      state.projects = (state.projects || []).map((project) => {
        const matchesClient =
          String(project?.client || "").trim() === String(state.selectedCatalogClient || "").trim();
        const matchesProject =
          String(project?.name || "").trim() === String(projectName || "").trim();
        if (!matchesClient || !matchesProject) return project;
        return { ...project, isActive: true, is_active: true };
      });
      syncFilterCatalogsUI(state.filters);
      feedback("Project reactivated.", false);
      render();
      loadPersistentStateInBackground();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-project]");
    if (deleteButton) {
      const projectName = deleteButton.dataset.deleteProject;
      const canDeleteProject = canManageProjectsLifecycle();
      if (!canDeleteProject) {
        feedback("Access denied.", true);
        return;
      }
      const assignedActiveMembers = assignedActiveMembersCountForProject(
        state.selectedCatalogClient,
        projectName
      );
      if (assignedActiveMembers > 0) {
        await appDialog({
          title: "Cannot Remove Project",
          message:
            "This project still has assigned active members and cannot be removed.\n\n" +
            "Please remove or reassign all assigned active members before deleting this project.\n\n" +
            `${assignedActiveMembers} assigned active members`,
          cancelText: "Cancel",
          hideConfirm: true,
        });
        return;
      }
      const dialogResult = await appDialog({
        title: "Remove Project?",
        message: "This project has no assigned active members. Removing it cannot be undone.",
        confirmText: "Remove",
        cancelText: "Cancel",
      });
      if (!dialogResult.confirmed) {
        return;
      }

      let message = "";
      try {
        const result = await mutatePersistentState("remove_project", {
          clientName: state.selectedCatalogClient,
          projectName,
        }, { skipHydrate: true, refreshState: false, returnState: false });
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
        if (message.includes("Cannot Remove Project")) {
          const blockedBody = String(message).replace(/^Cannot Remove Project\s*\n?/, "").trim();
          await appDialog({
            title: "Cannot Remove Project",
            message:
              blockedBody ||
              "This project still has assigned active members and cannot be removed.\n\nPlease remove or reassign all assigned active members before deleting this project.",
            cancelText: "Cancel",
            hideConfirm: true,
          });
          return;
        }
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

      syncFilterCatalogsUI(state.filters);
      feedback(message || "Project removed from active catalog.", false);
      render();
      loadPersistentStateInBackground();
      return;
    }

  });

  refs.entriesBody.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;
    if (action === "select-entry") {
      if (!state.entriesSelectionMode || !id) {
        return;
      }
      const next = new Set(state.selectedEntryIds instanceof Set ? state.selectedEntryIds : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      state.selectedEntryIds = next;
      render();
      return;
    }

    if (state.entriesSelectionMode) {
      return;
    }

    const entry = state.entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    if (action === "edit") {
      if (hasDeactivatedOrRemovedClientProject(entry)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
      state.pendingInputsTimeEditId = `${entry.id || ""}`.trim();
      state.inputSubtab = "time";
      setView("inputs");
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
      if (hasDeactivatedOrRemovedClientProject(entry)) {
        await showDeactivatedClientProjectPrompt();
        return;
      }
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
        await mutatePersistentState(
          "delete_entry",
          { id },
          { skipHydrate: true, refreshState: false, returnState: false }
        );
      } catch (error) {
        feedback(error.message || "Unable to delete entry.", true);
        return;
      }

      const deletedRows = (state.entries || []).filter(
        (item) => `${item?.id || ""}`.trim() === `${id || ""}`.trim()
      );
      state.entries = (state.entries || []).filter(
        (item) => `${item?.id || ""}`.trim() !== `${id || ""}`.trim()
      );
      state.lastTimeDeleteUndo = {
        ids: [`${id || ""}`.trim()].filter(Boolean),
        rows: deletedRows.map((row) => ({ ...row })),
        count: 1,
      };
      addDeletedRowsToState("time", deletedRows);
      syncEntriesUndoUi();
      if (state.editingId === id) {
        resetForm();
      }
      feedback("", false);
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
        mode === "project-remove-member" ||
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

      if (
        !selected.length &&
        !roleOnlyMode &&
        mode !== "project-managers-edit" &&
        mode !== "project-members-edit"
      ) {
        setMembersFeedback("Select at least one member.", true);
        return;
      }

      const overrideInputMap = {};
      if (
        mode === "project-members-edit" ||
        mode === "project-managers-edit" ||
        mode === "project-add-member"
      ) {
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

      const interceptSelection =
        typeof memberModalState.interceptSelection === "function"
          ? memberModalState.interceptSelection
          : null;
      if (
        interceptSelection &&
        (mode === "project-assign-manager" || mode === "project-add-member")
      ) {
        try {
          interceptSelection({
            mode,
            client,
            project,
            selectedIds: selected.map((id) => String(id || "").trim()).filter(Boolean),
          });
        } finally {
          memberModalState.interceptSelection = null;
        }
        closeMembersModal();
        return;
      }

  let success = false;
  let mutationsRun = 0;
  let memberMutationsRun = 0;
  let didOptimisticClose = false;
  const memberMutationOptions = {
    skipHydrate: true,
    refreshState: false,
    returnState: false,
    skipSettingsMetadataReload: true,
  };
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
    const shouldOptimisticClose =
      mode === "project-add-member" ||
      mode === "project-remove-member" ||
      mode === "project-remove";

    if (shouldOptimisticClose && client && project) {
      if (!state.assignments || typeof state.assignments !== "object") {
        state.assignments = {};
      }
      if (!Array.isArray(state.assignments.projectMembers)) {
        state.assignments.projectMembers = [];
      }
      const projectId = findProjectIdByClientProject(client, project);
      if (mode === "project-add-member") {
        for (const userId of processIds) {
          const alreadyAssigned = state.assignments.projectMembers.some(
            (row) =>
              String(row?.userId || "").trim() === String(userId || "").trim() &&
              String(row?.client || "").trim() === String(client || "").trim() &&
              String(row?.project || "").trim() === String(project || "").trim()
          );
          if (alreadyAssigned) continue;
          state.assignments.projectMembers.push({
            userId: String(userId || "").trim(),
            client: String(client || "").trim(),
            project: String(project || "").trim(),
            projectId: projectId || undefined,
            project_id: projectId || undefined,
          });
        }
      } else {
        const removeIds = new Set(processIds.map((id) => String(id || "").trim()));
        state.assignments.projectMembers = state.assignments.projectMembers.filter((row) => {
          const rowUserId = String(row?.userId || "").trim();
          const rowClient = String(row?.client || "").trim();
          const rowProject = String(row?.project || "").trim();
          if (rowClient !== String(client || "").trim()) return true;
          if (rowProject !== String(project || "").trim()) return true;
          return !removeIds.has(rowUserId);
        });
      }
      closeMembersModal();
      render();
      didOptimisticClose = true;
    }

    if (
      mode === "project-add-member" ||
      mode === "project-remove-member" ||
      mode === "project-remove"
    ) {
      const tasks = processIds
        .map((userId) => getUserById(userId))
        .filter(Boolean)
        .map((user) => {
          if (mode === "project-add-member") {
            const override = overrideInputMap.hasOwnProperty(user.id)
              ? overrideInputMap[user.id]
              : null;
            return mutatePersistentState("add_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: override,
            }, memberMutationOptions);
          }
          return mutatePersistentState("remove_project_member", {
            userId: user.id,
            clientName: client,
            projectName: project,
          }, memberMutationOptions);
        });
      await Promise.all(tasks);
    } else {
      for (const userId of processIds) {
        const user = getUserById(userId);
        if (!user) {
          continue;
        }
        const nextLevel = normalizeLevel(
          levelSelections[userId] ?? user.level
        );
        const resolveGroupForLevel = (value) => {
          const normalized = normalizeLevel(value);
          const levelDef = state.levelLabels?.[normalized];
          const groupRaw =
            (typeof levelDef === "object"
              ? levelDef?.permissionGroup || levelDef?.permission_group
              : "") || "staff";
          return String(groupRaw).trim().toLowerCase();
        };
        const nextGroup = resolveGroupForLevel(nextLevel);
        const currentGroup = resolveGroupForLevel(user.level);
        if (isGlobalAdmin(state.currentUser) && nextGroup !== currentGroup) {
          if (
            (currentGroup === "admin" || currentGroup === "superuser") &&
            nextGroup !== "admin" &&
            nextGroup !== "superuser" &&
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

            if (mode === "project-assign-manager") {
              if (!isManager(effectiveUser)) {
                continue;
              }
              await mutatePersistentState("assign_manager_project", {
                managerId: user.id,
                clientName: client,
                projectName: project,
              }, memberMutationOptions);
            } else if (mode === "project-unassign-manager") {
              await mutatePersistentState("unassign_manager_project", {
                managerId: user.id,
                clientName: client,
                projectName: project,
              }, memberMutationOptions);
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
            }, memberMutationOptions);
            mutationsRun += 1;
          } else if (wasAssigned && !isChecked) {
            await mutatePersistentState("unassign_manager_project", {
              managerId: user.id,
              clientName: client,
              projectName: project,
            }, memberMutationOptions);
            mutationsRun += 1;
          } else if (wasAssigned && isChecked && hasInput && newOverride !== prevOverride) {
            await mutatePersistentState("update_manager_project_rate", {
              managerId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: newOverride,
            }, memberMutationOptions);
            mutationsRun += 1;
          }
          } else if (mode === "project-members-edit") {
            if (toAdd.includes(user.id)) {
            await mutatePersistentState("add_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
              chargeRateOverride: overrideInputMap[user.id],
            }, memberMutationOptions);
            memberMutationsRun += 1;
          } else if (toRemove.includes(user.id)) {
            await mutatePersistentState("remove_project_member", {
              userId: user.id,
              clientName: client,
              projectName: project,
            }, memberMutationOptions);
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
                }, memberMutationOptions);
                memberMutationsRun += 1;
              }
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
          }, memberMutationOptions);
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
      if (didOptimisticClose) {
        feedback(error.message || "Unable to update members.", true);
        loadPersistentStateInBackground();
        return;
      }
      setMembersFeedback(error.message || "Unable to update members.", true);
      return;
    }

    if (success) {
      if (!didOptimisticClose) {
        closeMembersModal();
        render();
      }
      loadPersistentStateInBackground();
    }
  });
}

  // Expose settings/admin dependencies for settingsAdmin.js (no behavior change).
  window.settingsAdminDeps = {
    refs,
    state,
    settingsAccess: state.settingsAccess || {},
    mutatePersistentState,
    loadPersistentState,
    usersRenderUsersList,
    levelLabel,
    isAdmin,
    isGlobalAdmin,
    isManager,
    isStaff,
    renderRatesRows,
    managerClientAssignments,
    managerProjectAssignments,
    projectMembersForUser,
    escapeHtml,
    disabledButtonAttrs,
    roleKey,
    permissionGroupForUser,
    canViewUserByRole,
    DEFAULT_LEVEL_DEFS,
    usersSyncUserManagementControls,
    isMobileDrilldown: isMobileDrilldownViewport,
    mobileMembersView: state.mobileMembersView,
    onMobileMemberSelected,
    onMobileMembersBack,
    field,
    membersRenderMembersModal,
    memberModalState,
    getUserById,
    directManagerIdsForProject,
    isUserAssignedToProject,
    managerIdsForProject,
    staffIdsForProject,
    managerIdsForClientScope,
    staffIdsForClient,
    feedback,
  };

  // Expose catalog editor dependencies for catalogEditor.js (no behavior change).
  window.catalogEditorDeps = {
    refs,
    state,
    escapeHtml,
    US_STATES,
    renderCatalogLists,
    visibleCatalogClientNames,
    visibleCatalogProjectNames,
    isClientActive,
    isProjectActive,
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
    field,
    postHeight,
    uniqueValues,
    DEFAULT_CLIENT_PROJECTS,
    isValidDateString,
    today,
    syncFormCatalogs,
    entryUserOptions: visibleExpenseUserOptions,
    isStaff,
    populateSelect,
    syncFilterCatalogs,
    isManager,
    availableUsers,
    expenseClientOptions: visibleExpenseClientOptions,
    defaultFilterUser,
    effectiveScopeUser,
    currentEntries,
    currentExpenses,
    allowedClientsForUser,
    clientNames,
    allowedProjectsForClient,
    projectNames,
    formatDisplayDate,
    syncFilterDatePicker,
    setSelectOptionsWithPlaceholder,
    getUserById,
    getUserByDisplayName,
    ensureCatalogSelection,
    assignedProjectTuplesForCurrentUser,
  };

  // Expose time entry dependencies for timeEntries.js (no behavior change).
  window.timeEntriesDeps = {
    refs,
    state,
    formatDisplayDate,
    escapeHtml,
    formatDisplayDateShort,
    permissionGroupForUser: permissionGroupForUserWithSuper,
    canViewUserByRole,
    canViewEntryByScope,
    canUserAccessProject,
    getUserByDisplayName,
    assignedProjectTuplesForCurrentUser,
    isAdmin,
    isExecutive,
    effectiveScopeUser,
    syncFormCatalogsUI,
    defaultEntryUser,
    clampDateToBounds,
    today,
    field,
    renderHourSelection,
    setNonBillableDefault,
    QUICK_HOUR_PRESETS,
  };

  // Expose expenses dependencies for expenses.js (no behavior change).
  window.expensesDeps = {
    refs,
    state,
    escapeHtml,
    setSelectOptionsWithPlaceholder,
    visibleCatalogClientNames,
    visibleCatalogProjectNames,
    getUserById,
    entryUserOptions: visibleExpenseUserOptions,
    getUserByDisplayName,
    canViewUserByRole,
    canViewEntryByScope,
    canUserAccessProject,
    effectiveScopeUser,
    clampDateToBounds,
    today,
    setExpenseNonBillableDefault,
    parseDisplayDate,
    feedback,
    formatDisplayDate,
    formatDisplayDateShort,
    permissionGroupForUser: permissionGroupForUserWithSuper,
    assignedProjectTuplesForCurrentUser,
    isAdmin,
    isExecutive,
    field,
  };

  window.addEventListener("resize", postHeight);
  window.addEventListener("load", postHeight);
  window.addEventListener("beforeunload", function () {
    persistCurrentView(state.currentView);
  });
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/service-worker.js").catch(function (error) {
        console.warn("Service worker registration failed.", error);
      });
    });
  }

  registerServiceWorker();
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
    clearEntryAndExpenseDrafts();

    if (!state.currentUser) {
      if (loadSessionToken() && !state.bootstrapRequired) {
        persistSessionToken("");
        setAuthFeedback("Your saved session could not be restored. Please sign in again.", true);
      }
      render();
      return;
    }

    const restoredView = loadPersistedView();
    if (isViewAllowed(restoredView)) {
      state.currentView = restoredView;
      if (restoredView === "project_planning") {
        state.currentProjectPlanningId = loadPersistedProjectPlanningId();
      }
      if (restoredView === "inbox") {
        beginInboxVisit();
      }
      if (restoredView === "settings" || restoredView === "members") {
        await loadSettingsMetadata(true, { deferRender: true });
      }
    } else {
      state.currentView = "inputs";
    }

    syncFilterCatalogsUI(state.filters);
    resetForm();
    render();
  }

  initApp();
})();
