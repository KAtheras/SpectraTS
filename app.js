(function () {
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const VIEW_STORAGE_KEY = "timesheet-studio.view.v1";
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

    const { feedback } = deps();
    if (!state.permissions?.manage_levels) {
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

    await mutatePersistentState("update_level_labels", { levels });
    await refreshSettingsTab("levels");
    feedback("Levels updated.", false);
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
    entriesPanelTime: document.getElementById("entries-panel-time"),
    entriesPanelExpenses: document.getElementById("entries-panel-expenses"),
    inboxView: document.getElementById("inbox-page"),
    inboxList: document.getElementById("inbox-list"),
    inboxFilterAll: document.getElementById("inbox-filter-all"),
    inboxFilterUnread: document.getElementById("inbox-filter-unread"),
    inboxMarkSelectedRead: document.getElementById("inbox-mark-selected-read"),
    inboxDeleteSelected: document.getElementById("inbox-delete-selected"),
    inboxDeleteRead: document.getElementById("inbox-delete-read"),
    expenseRows: document.getElementById("expense-rows"),
    addCategory: document.getElementById("add-category"),
    saveCategories: document.getElementById("save-categories"),
    expenseCategoriesForm: document.getElementById("expense-categories-form"),
    corporateFunctionsForm: document.getElementById("corporate-functions-form"),
    corporateFunctionRows: document.getElementById("corporate-function-rows"),
    departmentsForm: document.getElementById("departments-form"),
    departmentRows: document.getElementById("department-rows"),
    addDepartment: document.getElementById("add-department"),
    saveDepartments: document.getElementById("save-departments"),
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
    auditFilterEntity: document.getElementById("audit-filter-entity"),
    auditFilterAction: document.getElementById("audit-filter-action"),
    auditFilterActor: document.getElementById("audit-filter-actor"),
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

  let addClientHeaderButton = null;
  let addProjectHeaderButton = null;
  let memberEditorModal = null;
  let memberEditorForm = null;
  let memberEditorTitle = null;
  let memberEditorSubmit = null;
  let memberEditorReset = null;
  let memberEditorMode = "create";
  let memberEditorUserId = "";

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

  function setupAddClientHeaderAction() {
    const addForm = refs.addClientForm;
    if (!addForm) return;
    const clientsColumn = addForm.closest(".catalog-column");
    const header = clientsColumn?.querySelector(".catalog-column-head");
    if (!header) return;
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";

    if (!addClientHeaderButton) {
      addClientHeaderButton = document.createElement("button");
      addClientHeaderButton.type = "button";
      addClientHeaderButton.className = "button button-ghost";
      addClientHeaderButton.textContent = "Add client";
      addClientHeaderButton.style.marginLeft = "auto";
      addClientHeaderButton.addEventListener("click", function () {
        if (!isAdmin(state.currentUser)) {
          feedback("Only Admins can add clients.", true);
          return;
        }
        openClientEditor({ mode: "create", clientName: "" });
      });
    }

    if (!addClientHeaderButton.isConnected) {
      header.appendChild(addClientHeaderButton);
    }
    if (addForm.isConnected) {
      addForm.remove();
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

  async function openProjectDialog(options) {
    return new Promise((resolve) => {
      const mode = options?.mode === "edit" ? "edit" : "add";
      const currentName = String(options?.projectName || "");
      const currentBudget = Number.isFinite(options?.budgetAmount) ? Number(options.budgetAmount) : null;
      const title = mode === "edit" ? "Edit project" : "Add project";
      const finalConfirmText = mode === "edit" ? "Save" : "Add";

      const form = document.createElement("form");
      form.className = "project-dialog-form";
      form.innerHTML = `
        <label class="project-dialog-field">
          <span>Project name</span>
          <input type="text" name="project_name" required />
        </label>
        <label class="project-dialog-field">
          <span>Budget (optional)</span>
          <input type="text" name="budget_amount" inputmode="decimal" placeholder="15000 or $15,000" />
        </label>
        <p class="project-dialog-error" data-project-dialog-error hidden></p>
      `;

      const nameInput = form.querySelector('input[name="project_name"]');
      const budgetInput = form.querySelector('input[name="budget_amount"]');
      const errorNode = form.querySelector("[data-project-dialog-error]");
      if (nameInput) {
        nameInput.value = currentName;
      }
      if (budgetInput) {
        budgetInput.value = currentBudget !== null ? String(currentBudget) : "";
      }

      refs.dialogTitle.textContent = title;
      refs.dialogMessage.textContent = "";
      refs.dialogMessage.hidden = true;
      refs.dialogInputRow.hidden = false;
      refs.dialogInput.hidden = true;
      if (refs.dialogTextarea) {
        refs.dialogTextarea.hidden = true;
      }
      refs.dialogInputRow.appendChild(form);
      refs.dialogConfirm.textContent = finalConfirmText;
      refs.dialogCancel.textContent = "Cancel";
      refs.dialog.hidden = false;
      refs.dialogConfirm.hidden = false;
      refs.dialogCancel.disabled = false;

      const setError = (message) => {
        if (!errorNode) return;
        errorNode.textContent = message || "";
        errorNode.hidden = !message;
      };

      const cleanup = () => {
        refs.dialog.hidden = true;
        refs.dialogConfirm.removeEventListener("click", onConfirm);
        refs.dialogCancel.removeEventListener("click", onCancel);
        form.removeEventListener("submit", onSubmit);
        form.remove();
        refs.dialogMessage.hidden = false;
        refs.dialogInputRow.hidden = true;
        refs.dialogInput.hidden = false;
        refs.dialogMessage.textContent = "";
      };

      const finalize = () => {
        const nextName = String(nameInput?.value || "").trim();
        if (!nextName) {
          setError("Project name cannot be empty.");
          nameInput?.focus();
          return;
        }
        const parsedBudget = parseProjectBudgetAmount(budgetInput?.value || "");
        if (!parsedBudget.ok) {
          setError("Budget must be a non-negative number.");
          budgetInput?.focus();
          return;
        }
        cleanup();
        resolve({
          projectName: nextName,
          budgetAmount: parsedBudget.value,
        });
      };

      const onConfirm = () => {
        finalize();
      };
      const onSubmit = (event) => {
        event.preventDefault();
        finalize();
      };
      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      refs.dialogConfirm.addEventListener("click", onConfirm);
      refs.dialogCancel.addEventListener("click", onCancel);
      form.addEventListener("submit", onSubmit);
      nameInput?.focus();
      nameInput?.select();
    });
  }

  async function openAddProjectDialog() {
    const canCreateProject = isAdmin(state.currentUser) || isExecutive(state.currentUser);
    if (!canCreateProject) {
      feedback("Only Executives or Admins can create projects.", true);
      return;
    }

    const projectDialog = await openProjectDialog({
      mode: "add",
      projectName: "",
      budgetAmount: null,
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
  }

  function setupAddProjectHeaderAction() {
    const projectsColumn =
      refs.projectColumnLabel?.closest(".catalog-column") || refs.projectList?.closest(".catalog-column");
    const header = projectsColumn?.querySelector(".catalog-column-head");
    if (!header) return;
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";

    if (!addProjectHeaderButton) {
      addProjectHeaderButton = document.createElement("button");
      addProjectHeaderButton.type = "button";
      addProjectHeaderButton.id = "add-project-header-button";
      addProjectHeaderButton.className = "button button-ghost";
      addProjectHeaderButton.textContent = "Add Project";
      addProjectHeaderButton.style.marginLeft = "auto";
      addProjectHeaderButton.addEventListener("click", function () {
        openAddProjectDialog();
      });
    }

    if (!addProjectHeaderButton.isConnected) {
      header.appendChild(addProjectHeaderButton);
    }
    if (refs.addProjectForm && refs.addProjectForm.isConnected) {
      refs.addProjectForm.remove();
    }
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
          align-items:center;
          margin-bottom:10px;
        }
        #member-editor-modal .member-editor-form{
          display:grid;
          gap:10px;
          min-height:0;
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
          gap:10px;
          padding-top:6px;
        }
        @media (max-width: 700px){
          #member-editor-modal .member-editor-row{
            grid-template-columns:1fr;
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
          </div>
          <form class="member-editor-form" data-member-editor-form>
            <div class="member-editor-row">
              <label><span>Member name</span><input type="text" name="display_name" required /></label>
              <label><span>User ID</span><input type="text" name="username" required /></label>
              <label><span>Employee ID</span><input type="text" name="employee_id" /></label>
            </div>
            <div class="member-editor-row">
              <label><span>Title</span><select name="level"></select></label>
              <label><span>Department</span><select name="department_id"><option value="">No department</option></select></label>
              <label><span>Office</span><select name="office_id" required><option value="">Select office</option></select></label>
            </div>
            <div class="member-editor-row">
              <label><span>Base rate</span><input type="number" step="0.01" min="0" name="base_rate" /></label>
              <label><span>Cost rate</span><input type="number" step="0.01" min="0" name="cost_rate" /></label>
              <label><span>Email</span><input type="email" name="email" required /></label>
            </div>
            <div class="member-editor-footer">
              <button class="button button-ghost" type="button" data-member-editor-cancel>Cancel</button>
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
            { skipHydrate: true }
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
    memberEditorModal.hidden = true;
    memberEditorModal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
  }

  function openMemberEditorModal(mode, userId) {
    ensureMemberEditorModal();
    const canCreate = Boolean(state.permissions?.create_user);
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditRates = Boolean(state.permissions?.edit_user_rates);
    if (mode === "create" && !canCreate) {
      feedback("Access denied.", true);
      return;
    }
    if (mode === "edit" && !canEditProfile && !canEditRates) {
      feedback("Access denied.", true);
      return;
    }

    memberEditorMode = mode;
    memberEditorUserId = userId || "";
    const user = mode === "edit" ? state.users.find((u) => u.id === memberEditorUserId) : null;
    if (mode === "edit" && !user) {
      feedback("Team member not found.", true);
      return;
    }

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
    field(memberEditorForm, "base_rate").value = user?.baseRate ?? "";
    field(memberEditorForm, "cost_rate").value = user?.costRate ?? "";

    const profileEditable = mode === "create" ? canCreate : canEditProfile;
    ["display_name", "username", "email", "employee_id", "level", "department_id", "office_id"].forEach((name) => {
      const el = field(memberEditorForm, name);
      if (el) el.disabled = !profileEditable;
    });
    ["base_rate", "cost_rate"].forEach((name) => {
      const el = field(memberEditorForm, name);
      if (el) el.disabled = !canEditRates;
    });

    memberEditorTitle.textContent = mode === "create" ? "Add member" : "Edit member";
    memberEditorSubmit.textContent = mode === "create" ? "Add member" : "Save changes";
    if (memberEditorReset) {
      memberEditorReset.hidden = !(mode === "edit" && Boolean(state.permissions?.reset_user_password));
      memberEditorReset.disabled = mode !== "edit" || !Boolean(state.permissions?.reset_user_password);
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
  }

  async function submitMemberEditorModal(event) {
    event.preventDefault();
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditRates = Boolean(state.permissions?.edit_user_rates);
    const canCreate = Boolean(state.permissions?.create_user);
    const displayName = field(memberEditorForm, "display_name").value.trim();
    const username = field(memberEditorForm, "username").value.trim();
    const email = field(memberEditorForm, "email").value.trim();
    const employeeId = field(memberEditorForm, "employee_id").value.trim();
    const level = normalizeLevel(field(memberEditorForm, "level").value || "1");
    const departmentId = field(memberEditorForm, "department_id").value || null;
    const officeId = field(memberEditorForm, "office_id").value || null;
    const baseRaw = field(memberEditorForm, "base_rate").value.trim();
    const costRaw = field(memberEditorForm, "cost_rate").value.trim();
    const baseRate = baseRaw === "" ? null : Number(baseRaw);
    const costRate = costRaw === "" ? null : Number(costRaw);
    if ((baseRate !== null && (!Number.isFinite(baseRate) || baseRate < 0)) || (costRate !== null && (!Number.isFinite(costRate) || costRate < 0))) {
      feedback("Rates must be non-negative numbers.", true);
      return;
    }
    if (!email || !email.includes("@")) {
      feedback("Email must include @.", true);
      return;
    }

    try {
      if (memberEditorMode === "create") {
        if (!canCreate) {
          feedback("Access denied.", true);
          return;
        }
        const result = await mutatePersistentState(
          "add_user",
          { displayName, username, email, employeeId, level, officeId, baseRate, costRate },
          { skipHydrate: true }
        );
        const created = (result?.users || []).find((u) => String(u.username || "").toLowerCase() === String(username).toLowerCase());
        if (created && departmentId && canEditProfile) {
          await mutatePersistentState("set_user_department", { userId: created.id, departmentId }, { skipHydrate: true });
        }
      } else {
        const userId = memberEditorUserId;
        const currentUser = (state.users || []).find((u) => u.id === userId);
        if (!currentUser) {
          feedback("Team member not found.", true);
          return;
        }
        if (canEditProfile) {
          await mutatePersistentState(
            "update_user",
            { userId, displayName, username, email, employeeId, level, officeId },
            { skipHydrate: true }
          );
          await mutatePersistentState(
            "set_user_department",
            { userId, departmentId },
            { skipHydrate: true }
          );
        }
        if (canEditRates) {
          await mutatePersistentState(
            "update_user_rates",
            { userId, baseRate, costRate },
            { skipHydrate: true }
          );
        }
      }
      closeMemberEditorModal();
      await refreshSettingsTab("rates");
      feedback(memberEditorMode === "create" ? "Member added." : "Member updated.", false);
    } catch (error) {
      feedback(error.message || "Unable to save member.", true);
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
            <button class="button button-ghost" type="button" id="add-department">Add department</button>
            <button class="button" type="submit" id="save-departments">Save departments</button>
          </div>
        </div>
      `;
      (settingsPanels || settingsBody).appendChild(deptForm);
    }

    refs.departmentsForm = document.getElementById("departments-form");
    refs.departmentRows = document.getElementById("department-rows");
    refs.addDepartment = document.getElementById("add-department");
    refs.saveDepartments = document.getElementById("save-departments");
  }

  ensureDepartmentSettingsUI();
  setupAddClientHeaderAction();
  setupAddProjectHeaderAction();
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
    sessionToken: loadSessionToken(),
    currentUser: null,
    users: [],
    bootstrapRequired: false,
    levelLabels: {},
    officeLocations: [],
    expenseCategories: [],
    corporateFunctionGroups: [],
    corporateFunctionCategories: [],
    departments: [],
    departmentsSnapshot: [],
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
    currentView: "inputs", // "inputs" | "entries" | "inbox" | "clients" | "members" | "analytics" | "settings" | "audit"
    mobileClientsView: "list", // "list" | "detail"
    mobileMembersView: "list", // "list" | "detail"
    inputSubtab: "time", // "time" | "expenses"
    inputsTimeCalendarExpanded: false,
    inputsTimeCalendarEndDate: today,
    inputsTimeSelectedDate: today,
    inputsTimeSelectedClientProject: "",
    inputsTimeSelectedCorporateCategoryId: "",
    inputsExpenseCalendarExpanded: false,
    inputsExpenseCalendarEndDate: today,
    inputsExpenseSelectedDate: today,
    inputsExpenseSelectedClientProject: "",
    inputsExpenseSelectedCorporateCategoryId: "",
    pendingInputsTimeEditId: "",
    pendingInputsExpenseEditId: "",
    entriesSubtab: "time", // "time" | "expenses"
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
      date: "",
    },
    auditOffset: 0,
    auditHasMore: false,
    auditLoadingMore: false,
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

  function isViewAllowed(view) {
    const nextView = `${view || ""}`.trim().toLowerCase();
    if (!state.currentUser) return false;
    if (!nextView) return false;
    if (nextView === "inputs" || nextView === "entries" || nextView === "analytics" || nextView === "inbox") {
      return true;
    }
    if (nextView === "clients") {
      const group = permissionGroupForUser(state.currentUser);
      return (
        group === "manager" ||
        group === "executive" ||
        group === "admin" ||
        group === "superuser"
      );
    }
    if (nextView === "members") {
      return isAdmin(state.currentUser) || isGlobalAdmin(state.currentUser) || isExecutive(state.currentUser);
    }
    if (nextView === "settings") {
      return !!state.permissions?.view_settings_tab;
    }
    if (nextView === "audit") {
      return isAdmin(state.currentUser);
    }
    return false;
  }

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
    if (!scopeUser) {
      return availableUsers();
    }
    if (isAdmin(scopeUser)) {
      return availableUsers();
    }
    const allowedKeys = new Set(
      allowedProjectTuples(scopeUser).map((item) => projectKey(item.client, item.project))
    );
    if (!allowedKeys.size) {
      return [];
    }
    const allowedUserIds = new Set(
      (state.assignments?.projectMembers || [])
        .filter((item) => allowedKeys.has(projectKey(item.client, item.project)))
        .map((item) => item.userId)
    );
    allowedUserIds.add(scopeUser.id);

    return state.users
      .filter(
        (user) =>
          allowedUserIds.has(user.id) &&
          (isStaff(user) || user.id === scopeUser.id)
      )
      .map((user) => user.displayName)
      .filter(Boolean);
  }

  function normalizeInboxItem(item) {
    if (!item || typeof item !== "object") return null;
    const id = `${item.id || ""}`.trim();
    if (!id) return null;
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
      isRead: item.isRead === true || item.is_read === true || item.is_read === 1,
      projectNameSnapshot: `${item.projectNameSnapshot || item.project_name_snapshot || ""}`.trim(),
      deepLink,
      createdAt: item.createdAt || item.created_at || null,
    };
  }

  const NOTIFICATION_RULE_ROWS = [
    {
      eventType: "time_entry_created",
      label: "Time entered",
      recipientText: "Project manager (closest assigned)",
    },
    {
      eventType: "expense_entry_created",
      label: "Expense entered",
      recipientText: "Project manager (closest assigned)",
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
            return normalized;
          })
          .filter(Boolean)
      : [];
    const hasDepartments = Array.isArray(data?.departments);
    if (hasDepartments) {
      state.departments = data.departments.slice();
      state.departmentsSnapshot = data.departments.slice();
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
    state.assignments = normalizeAssignments(data?.assignments);
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
        })).filter((item) => item.groupId && item.name)
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
      Array.isArray(data?.delegationCandidates)
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
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
    state.clients = [];
    state.entries = [];
    state.expenses = [];
    state.projects = [];
    state.clientEditor = null;
    state.levelLabels = {};
    state.officeLocations = [];
    state.expenseCategories = [];
    state.account = null;
    state.notificationRules = [];
    state.assignments = {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    };
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
      date: "",
    };
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
        state.clients = [];
        state.entries = [];
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS, true);
        state.projects = [];
        state.notificationRules = [];
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
        return true;
      }

      throw error;
    }
  }

  async function loadSettingsMetadata(force = false) {
    if (!state.currentUser) return;
    if (state.settingsMetadataLoading) return;
    if (!force && state.settingsMetadataLoaded) return;
    state.settingsMetadataLoading = true;
    render();
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
      };
      applyLoadedState(mergedPayload);
      window.state = state;
    } catch (error) {
      feedback(error.message || "Unable to load settings data.", true);
      state.settingsMetadataLoading = false;
      render();
      return;
    }
    state.settingsMetadataLoading = false;
    render();
  }

  async function mutatePersistentState(action, payload, options = {}) {
    const { skipHydrate, refreshState, returnState, skipSettingsMetadataReload } = options;
    const requestPayload = {
      action,
      payload,
    };
    if (returnState === false) {
      requestPayload.returnState = false;
    }
    const result = await requestJson(MUTATE_API_PATH, {
      method: "POST",
      body: JSON.stringify(requestPayload),
    });
    const canHydrateFromResult = !skipHydrate && result && result.currentUser;
    if (canHydrateFromResult) {
      applyLoadedState(result);
      render();
    }
    if (refreshState || (!skipHydrate && !canHydrateFromResult)) {
      await loadPersistentState();
      render();
    }
    if (!skipSettingsMetadataReload && state.currentView === "settings" && state.currentUser) {
      await loadSettingsMetadata(true);
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

  function setView(view) {
    if (!isViewAllowed(view)) {
      view = "inputs";
    }
    const previousView = state.currentView;
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
    }
    state.currentView = view;
    persistCurrentView(view);
    if (view === "settings" && previousView !== "settings") {
      loadSettingsMetadata();
    }
    render();
  }

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

  function openAnalyticsPage() {
    setView("analytics");
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

  function shiftIsoDate(value, deltaDays) {
    const base = isValidDateString(value) ? value : today;
    const date = new Date(`${base}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    return formatDate(date);
  }

  function getInputsTimeUserDateBounds() {
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();
    let minDate = "";
    let maxDate = "";

    (state.entries || []).forEach((entry) => {
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
    const perProject = new Map();
    const totalsByDate = Object.create(null);
    const currentUserId = `${state.currentUser?.id || ""}`.trim();
    const currentUserName = `${state.currentUser?.displayName || ""}`.trim();

    dates.forEach((item) => {
      totalsByDate[item.iso] = 0;
    });

    (state.entries || []).forEach((entry) => {
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
      const client = `${entry.client || ""}`.trim();
      const project = `${entry.project || ""}`.trim();
      if (!client || !project) return;
      const projectKeyValue = `${client}|||${project}`;
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
    const daySet = new Set(dates.map((item) => item.iso));
    if (!daySet.has(state.inputsTimeSelectedDate)) {
      state.inputsTimeSelectedDate = daySet.has(today) ? today : dates[dates.length - 1].iso;
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

    const dayRowsHtml = dates
      .map((item) => {
        const total = Number(totalsByDate[item.iso] || 0);
        const isActive = item.iso === selectedDay;
        const isZero = !Number.isFinite(total) || total <= 0;
        return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}${isZero ? " is-zero" : ""}" data-action="inputs-time-day" data-day="${escapeHtml(item.iso)}">
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
          return `<div class="inputs-drilldown-detail-row">
            <div class="inputs-drilldown-detail-main">
              <div class="inputs-drilldown-detail-meta">
                <span class="inputs-drilldown-detail-value">${escapeHtml(formatSummaryHours(detail.hours))}</span>
                <span class="inputs-time-calendar-detail-chip inputs-time-calendar-detail-chip-status inputs-time-calendar-detail-chip-status-${
                  detail.status === "approved" ? "approved" : "pending"
                }">${escapeHtml(statusText)}</span>
                <span class="inputs-time-calendar-detail-chip inputs-time-calendar-detail-chip-billable">${escapeHtml(
                  billableText
                )}</span>
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
          <header class="inputs-drilldown-col-head">Days</header>
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
      const client = `${expense.clientName || expense.client || ""}`.trim();
      const project = `${expense.projectName || expense.project || ""}`.trim();
      if (!client || !project) return;
      const projectKeyValue = `${client}|||${project}`;
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
    const daySet = new Set(dates.map((item) => item.iso));
    if (!daySet.has(state.inputsExpenseSelectedDate)) {
      state.inputsExpenseSelectedDate = daySet.has(today) ? today : dates[dates.length - 1].iso;
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

    const dayRowsHtml = dates
      .map((item) => {
        const total = Number(totalsByDate[item.iso] || 0);
        const isActive = item.iso === selectedDay;
        const isZero = !Number.isFinite(total) || total <= 0;
        return `<button type="button" class="inputs-drilldown-item${isActive ? " is-active" : ""}${isZero ? " is-zero" : ""}" data-action="inputs-expense-day" data-day="${escapeHtml(item.iso)}">
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
                <span class="inputs-time-calendar-detail-chip inputs-time-calendar-detail-chip-billable">${escapeHtml(
                  billableText
                )}</span>
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
          <header class="inputs-drilldown-col-head">Days</header>
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
    return groups
      .map((group) => ({
        groupId: `${group?.id || ""}`.trim(),
        groupName: `${group?.name || ""}`.trim(),
        categories: categories.filter((item) => `${item?.groupId || ""}`.trim() === `${group?.id || ""}`.trim()),
      }))
      .filter((item) => item.groupId && item.groupName && item.categories.length);
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
      id: findProjectIdByClientProject(item.client, item.project),
      client: item.client,
      project: item.project,
      label: `${item.client} / ${item.project}`,
      value: encodeInputsTimeCombo(item.client, item.project),
    }));
    const corporateGroups = groupedCorporateFunctionCategoriesForInputs();
    if (!corporateGroups.length) {
      return projectItems;
    }
    const corporateItems = corporateGroups.flatMap((group) => {
      const groupLabel = {
        type: "label",
        value: `${INPUTS_COMBO_SECTION_VALUE}::${group.groupId}`,
        label: group.groupName,
        disabled: true,
      };
      const categoryItems = group.categories.map((category) => ({
        type: "corporate",
        id: `${category?.id || ""}`.trim(),
        group_name: group.groupName,
        label: `   ${category?.name || ""}`,
        value: encodeInputsCorporateCombo(category?.id || ""),
      }));
      return [groupLabel, ...categoryItems];
    });
    const sectionHeader = {
      type: "label",
      value: `${INPUTS_COMBO_SECTION_VALUE}::corporate-functions`,
      label: "Corporate Functions",
      disabled: true,
    };
    const divider = {
      type: "divider",
      value: INPUTS_COMBO_DIVIDER_VALUE,
      label: "──────────",
      disabled: true,
    };
    return [
      ...projectItems,
      ...(projectItems.length ? [divider] : []),
      sectionHeader,
      ...corporateItems,
    ];
  }

  function applyInputsTimeBillableDefaultForRow(row) {
    const fields = inputsTimeRowFields(row);
    if (!fields.clientProject || !fields.billable) return;
    const selection = readInputsComboSelectionMeta(fields.clientProject);
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
    const selected = resolveInputsComboDefault(fields.clientProject.value || "", options);
    if (!fields.clientProject.value && selected) {
      fields.clientProject.value = selected;
    }
    setSelectOptionsWithPlaceholder(
      { escapeHtml },
      fields.clientProject,
      options,
      selected,
      "Client / Project"
    );
    fields.clientProject.disabled = options.length === 0;

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
      } else {
        row.dataset.inputsSelectionType = "";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = "";
        state.inputsTimeSelectedCorporateCategoryId = "";
      }
      row.dataset.lastCombo = fields.clientProject.value || "";
    });

    fields.date?.addEventListener("change", function () {
      syncInputsTimeDateField(fields.date);
    });

    const refreshTimeRowInteractivity = function () {
      syncInputsTimeRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
    };
    row.addEventListener("input", refreshTimeRowInteractivity);
    row.addEventListener("change", refreshTimeRowInteractivity);

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
      const [clientName, projectName] = decodeInputsTimeCombo(current.clientProject?.value || "");
      const actingAsUserId = resolveActingAsUserId();
      const nextEntry = {
        id: existingId || crypto.randomUUID(),
        user: state.currentUser?.displayName || "",
        date: parseInputsTimeDateValue(current.date?.value || ""),
        client: clientName || "",
        project: projectName || "",
        task: "",
        hours: Number(current.hours?.value),
        notes: (current.notes?.value || "").trim(),
        billable: current.billable ? current.billable.checked : true,
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

      try {
        await mutatePersistentState(
          "save_entry",
          wasEditingSavedRow ? { entry: nextEntry } : { entry: nextEntry, actingAsUserId }
        );
      } catch (error) {
        row.dataset.saving = "false";
        setInputsTimeRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
        syncInputsTimeRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        feedback(error.message || "Unable to save entry.", true);
        return;
      }

      feedback("Entry saved.", false);
      row.dataset.entryId = nextEntry.id;
      row.dataset.createdAt = nextEntry.createdAt;
      setInputsTimeRowSaved(row);
      const container = row.parentElement;
      const shouldAddNextRow = !hasTrailingBlankInputsTimeRow(container);
      if (shouldAddNextRow) {
        addInputsTimeRowFrom(row, inputsTimeComboOptions());
      } else if (container) {
        syncInputsTimeRowInteractivity(
          Array.from(container.querySelectorAll("form.input-row.input-row-body"))
        );
      }
      postHeight();
    });

    row.dataset.boundHandlers = "true";
  }

  function populateInputsTimeRowForEntryEdit(row, entry, options) {
    if (!row || !entry) return;
    const comboValue = encodeInputsTimeCombo(entry.client || "", entry.project || "");
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

  function inputsExpenseCategoryOptions() {
    const categories = typeof activeExpenseCategories === "function" ? activeExpenseCategories() : [];
    return categories
      .map((item) => ({ label: item.name, value: item.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function applyInputsExpenseBillableDefaultForRow(row) {
    const fields = inputsExpenseRowFields(row);
    if (!fields.clientProject || !fields.billable) return;
    const selection = readInputsComboSelectionMeta(fields.clientProject);
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
      "Client / Project"
    );
    fields.clientProject.disabled = comboOptions.length === 0;

    const selectedCategory = fields.category?.value || "";
    if (fields.category) {
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        fields.category,
        categoryOptions,
        selectedCategory,
        "Category"
      );
      fields.category.disabled = categoryOptions.length === 0;
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
      } else {
        row.dataset.inputsSelectionType = "";
        row.dataset.projectId = "";
        row.dataset.corporateCategoryId = "";
        state.inputsExpenseSelectedCorporateCategoryId = "";
      }
      row.dataset.lastCombo = fields.clientProject.value || "";
    });

    fields.date?.addEventListener("change", function () {
      syncInputsTimeDateField(fields.date);
    });

    const refreshExpenseRowInteractivity = function () {
      syncInputsExpenseRowInteractivity(
        Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
      );
    };
    row.addEventListener("input", refreshExpenseRowInteractivity);
    row.addEventListener("change", refreshExpenseRowInteractivity);

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
      const [clientName, projectName] = decodeInputsTimeCombo(current.clientProject?.value || "");
      const actingAsUserId = resolveActingAsUserId();
      const nextExpense = {
        id: existingId || crypto.randomUUID(),
        userId: state.currentUser?.id || "",
        clientName: clientName || "",
        projectName: projectName || "",
        expenseDate: parseInputsTimeDateValue(current.date?.value || ""),
        category: current.category?.value || "",
        amount: Number(current.amount?.value),
        isBillable: current.billable ? current.billable.checked : true,
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

      try {
        await mutatePersistentState(
          wasEditingSavedRow ? "update_expense" : "create_expense",
          wasEditingSavedRow
            ? { expense: nextExpense }
            : { expense: nextExpense, actingAsUserId }
        );
      } catch (error) {
        row.dataset.saving = "false";
        setInputsExpenseRowState(row, wasEditingSavedRow ? "editing-saved" : "new");
        syncInputsExpenseRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        feedback(error.message || "Unable to save expense.", true);
        return;
      }

      feedback("Expense saved.", false);
      row.dataset.entryId = nextExpense.id;
      row.dataset.createdAt = nextExpense.createdAt;
      setInputsExpenseRowSaved(row);
      const container = row.parentElement;
      const shouldAddNextRow = !hasTrailingBlankInputsExpenseRow(container);
      if (shouldAddNextRow) {
        addInputsExpenseRowFrom(row, inputsExpenseComboOptions(), inputsExpenseCategoryOptions());
      } else if (container) {
        syncInputsExpenseRowInteractivity(
          Array.from(container.querySelectorAll("form.input-row.input-row-body"))
        );
      }
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

  function catalogClientNames() {
    return (state.clients || [])
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogClientNames(targetUser) {
    const user = targetUser || effectiveScopeUser();
    if (!user) {
      return catalogClientNames();
    }
    return isAdmin(user) || isExecutive(user)
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
    const filtered = (state.projects || []).filter((p) => (client ? p.client === client : true));
    return uniqueValues(filtered.map((p) => p.name)).sort((a, b) => a.localeCompare(b));
  }

  function visibleCatalogProjectNames(client, targetUser) {
    const user = targetUser || effectiveScopeUser();
    if (!user) {
      return catalogProjectNames(client);
    }
    if (isAdmin(user) || isExecutive(user)) {
      return catalogProjectNames(client);
    }
    return allowedProjectsForClient(user, client, { projects: state.projects });
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
    const scopeUser = effectiveScopeUser();
    const userId = scopeUser?.id || "";
    if (!userId) {
      return [];
    }
    const assignments = state.assignments || {};
    const projects = state.projects || [];
    const memberTuples = (assignments.projectMembers || [])
      .filter((item) => item.userId === userId)
      .map((item) => ({ client: item.client || "", project: item.project || "" }));
    const managerProjectTuples = (assignments.managerProjects || [])
      .filter((item) => item.managerId === userId)
      .map((item) => ({ client: item.client || "", project: item.project || "" }));
    const managerClients = new Set(
      (assignments.managerClients || [])
        .filter((item) => item.managerId === userId)
        .map((item) => item.client || "")
        .filter(Boolean)
    );
    const managerClientTuples = projects
      .filter((project) => managerClients.has(project.client))
      .map((project) => ({ client: project.client || "", project: project.name || "" }));
    const tupleMap = new Map();
    [...memberTuples, ...managerProjectTuples, ...managerClientTuples].forEach((item) => {
      if (!item.client || !item.project) return;
      tupleMap.set(projectKey(item.client, item.project), item);
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

  function auditDateBounds() {
    const dates = (state.auditLogs || [])
      .map((row) => normalizeAuditDateValue(row?.changed_at || row?.changedAt || ""))
      .filter(Boolean)
      .sort();
    if (!dates.length) {
      return { min: "", max: "" };
    }
    return {
      min: dates[0] || "",
      max: dates[dates.length - 1] || "",
    };
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
    const existingDate = normalizeAuditDateValue(state.auditFilters?.date || "");
    syncAuditDownloadDateInput(refs.auditDownloadBeginDate, existingDate);
    syncAuditDownloadDateInput(refs.auditDownloadEndDate, existingDate);
    applyAuditDownloadDateBounds(existingDate, existingDate);
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
              entityType: state.auditFilters.entity || undefined,
              action: state.auditFilters.action || undefined,
              actorId: state.auditFilters.actor || undefined,
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
      button.dataset.userDeactivate;
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
        }, {
          skipHydrate: true,
        });
        if (state.currentView === "settings") {
          await refreshSettingsTab("rates");
          setUserFeedback(`${user.displayName} was deactivated.`, false);
          return;
        }
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
      const showMembers =
        isAdmin(state.currentUser) || isGlobalAdmin(state.currentUser) || isExecutive(state.currentUser);
      refs.navMembers.hidden = !showMembers;
      refs.navMembers.classList.toggle("is-active", view === "members");
      refs.navMembers.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.navMembersMobile) {
      const showMembers =
        isAdmin(state.currentUser) || isGlobalAdmin(state.currentUser) || isExecutive(state.currentUser);
      refs.navMembersMobile.hidden = !showMembers;
      refs.navMembersMobile.classList.toggle("is-active", view === "members");
      refs.navMembersMobile.setAttribute("aria-current", view === "members" ? "page" : "false");
    }
    if (refs.openCatalog) {
      refs.openCatalog.hidden = !(
        currentGroup === "manager" ||
        currentGroup === "executive" ||
        currentGroup === "admin" ||
        currentGroup === "superuser"
      );
      refs.openCatalog.classList.toggle("is-active", view === "clients");
      refs.openCatalog.setAttribute("aria-current", view === "clients" ? "page" : "false");
    }
    if (refs.navClientsMobile) {
      const showClients =
        currentGroup === "manager" ||
        currentGroup === "executive" ||
        currentGroup === "admin" ||
        currentGroup === "superuser";
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

    const entriesSubtab = state.entriesSubtab === "expenses" ? "expenses" : "time";
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
        syncExpenseFilterCatalogsUI(state.expenseFilters);
        const filteredExpenses = currentExpenses();
        renderExpenses(filteredExpenses);
        renderExpenseFilterState(filteredExpenses);
      } else {
        syncFilterCatalogsUI(state.filters);
        const filteredEntries = currentEntries();
        renderFilterState(filteredEntries);
        renderTable(filteredEntries);
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
    syncSharedEntriesFiltersFromTime();

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

  function inboxUnreadCount() {
    return (state.inboxItems || []).reduce((count, item) => count + (item?.isRead ? 0 : 1), 0);
  }

  function inboxReadCount() {
    return (state.inboxItems || []).reduce((count, item) => count + (item?.isRead ? 1 : 0), 0);
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
    try {
      await mutatePersistentState("delete_inbox_item", { id }, { refreshState: true, returnState: false });
      setInboxSelected(id, false);
      feedback("", false);
    } catch (error) {
      feedback(error.message || "Unable to delete inbox item.", true);
    }
  }

  async function deleteSelectedInboxItems() {
    const ids = selectedInboxIds();
    if (!ids.length) return;
    try {
      await mutatePersistentState("delete_inbox_items", { ids }, { refreshState: true, returnState: false });
      clearInboxSelection();
      feedback("", false);
    } catch (error) {
      feedback(error.message || "Unable to delete selected inbox items.", true);
    }
  }

  async function deleteAllReadInboxItems() {
    try {
      await mutatePersistentState("delete_all_read_inbox_items", {}, { refreshState: true, returnState: false });
      clearInboxSelection();
      feedback("", false);
    } catch (error) {
      feedback(error.message || "Unable to delete read inbox items.", true);
    }
  }

  async function markSelectedInboxRead() {
    const ids = selectedInboxIds();
    if (!ids.length) return;
    try {
      await mutatePersistentState("mark_inbox_items_read", { ids }, { refreshState: true, returnState: false });
      clearInboxSelection();
      feedback("", false);
    } catch (error) {
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
        return `
          <div class="inbox-item${unreadClass}${selectedClass}${priorityClass}" data-inbox-id="${escapeHtml(item.id)}">
            <label class="inbox-item-check">
              <input type="checkbox" data-inbox-select="${escapeHtml(item.id)}" ${isSelected ? "checked" : ""} />
            </label>
            <button class="inbox-item-open" type="button" data-inbox-open="${escapeHtml(item.id)}">
              <div class="inbox-item-main">
                <div class="inbox-item-message"><span class="message-priority-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M4 2.2v11.6M4 3h6.2l-1.4 2.4L10.2 8H4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${escapeHtml(item.message || "Notification")}</div>
                ${
                  item.noteSnippet
                    ? `<div class="inbox-item-note">${escapeHtml(item.noteSnippet)}</div>`
                    : ""
                }
                <div class="inbox-item-time">${escapeHtml(createdAt)}</div>
              </div>
              ${item.isRead ? "" : '<span class="inbox-item-dot" aria-hidden="true"></span>'}
            </button>
            <button class="inbox-item-delete" type="button" data-inbox-action="delete" data-inbox-id="${escapeHtml(item.id)}" aria-label="Delete notification">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M9.5 4h5M8 7l.7 12.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8L16 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10.2 10.2v6.6M13.8 10.2v6.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        `;
      })
      .join("");
  }

  function routeInboxDeepLink(item) {
    if (!item) return;
    const deepLink = item.deepLink && typeof item.deepLink === "object" ? item.deepLink : null;
    const view = `${deepLink?.view || ""}`.trim();
    const subtab = `${deepLink?.subtab || ""}`.trim();
    const subjectId = `${item.subjectId || deepLink?.subjectId || ""}`.trim();
    const subjectType = `${item.subjectType || deepLink?.subjectType || ""}`.trim();

    if (view === "entries") {
      state.entriesSubtab = subtab === "expenses" ? "expenses" : "time";
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

  async function openInboxItem(itemId) {
    const id = `${itemId || ""}`.trim();
    if (!id) return;
    const item = (state.inboxItems || []).find((inboxItem) => inboxItem.id === id);
    if (!item) return;

    if (!item.isRead) {
      try {
        await mutatePersistentState("mark_inbox_item_read", { id }, { refreshState: true, returnState: false });
      } catch (error) {
        feedback(error.message || "Unable to mark inbox item as read.", true);
      }
    }

    const refreshedItem = (state.inboxItems || []).find((inboxItem) => inboxItem.id === id) || item;
    routeInboxDeepLink(refreshedItem);
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

  if (refs.navInputs) {
    refs.navInputs.addEventListener("click", function () {
      setView("inputs");
    });
  }
  if (refs.navEntries) {
    refs.navEntries.addEventListener("click", function () {
      setView("entries");
    });
  }
  if (refs.navInputsMobile) {
    refs.navInputsMobile.addEventListener("click", function () {
      setView("inputs");
    });
  }
  if (refs.navEntriesMobile) {
    refs.navEntriesMobile.addEventListener("click", function () {
      setView("entries");
    });
  }
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
      if (action === "inputs-time-day") {
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
        state.pendingInputsTimeEditId = id;
        state.inputSubtab = "time";
        setView("inputs");
        return;
      }
      if (action === "inputs-time-detail-delete") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
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
      if (action === "inputs-expense-day") {
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
        state.pendingInputsExpenseEditId = id;
        state.inputSubtab = "expenses";
        setView("inputs");
        return;
      }
      if (action === "inputs-expense-detail-delete") {
        const id = `${actionEl.dataset.id || ""}`.trim();
        if (!id) return;
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
      state.entriesSubtab = "time";
      render();
    });
  }
  if (refs.entriesSwitchExpenses) {
    refs.entriesSwitchExpenses.addEventListener("click", function () {
      syncSharedEntriesFiltersFromTime();
      state.entriesSubtab = "expenses";
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
      await openInboxItem(openButton.dataset.inboxOpen);
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
    const expense = (state.expenses || []).find((item) => item.id === id);
    if (!expense) return;

    if (action === "expense-edit") {
      state.pendingInputsExpenseEditId = `${expense.id || ""}`.trim();
      state.inputSubtab = "expenses";
      setView("inputs");
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
  if (refs.openAnalytics) {
    refs.openAnalytics.addEventListener("click", openAnalyticsPage);
  }
  if (refs.navAnalyticsMobile) {
    refs.navAnalyticsMobile.addEventListener("click", openAnalyticsPage);
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
      if (!state.permissions?.manage_levels) {
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
        await mutatePersistentState("update_level_labels", { levels });
        await refreshSettingsTab("levels");
        feedback("Level added.", false);
      } catch (error) {
        await refreshSettingsTab("levels");
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
        await mutatePersistentState("update_expense_categories", { categories });
        await refreshSettingsTab("categories");
        feedback("Expense categories updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update expense categories.", true);
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
      await mutatePersistentState("update_office_locations", { locations });
      feedback("Office locations updated.", false);
      await refreshSettingsTab("locations");
    } catch (error) {
      try {
        window.localStorage.setItem("timesheet.offices", JSON.stringify(locations));
      } catch (e) {}
      feedback(error.message || "Unable to update office locations.", true);
    }
  }

  if (refs.officeLocationsForm) {
    refs.officeLocationsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
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
        const activeClients = (state.clients || []).filter((client) => (client.officeId || "") === (id || "")).length;
        const activeProjects = (state.projects || []).filter((project) => (project.officeId || "") === (id || "")).length;
        const confirmation = await appDialog({
          title: "Delete office location?",
          message: `Are you sure you would like to delete this office location?\nCurrently there are ${activeClients} clients and ${activeProjects} projects active in this office location.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!confirmation.confirmed) {
          return;
        }
        state.officeLocations = state.officeLocations.filter((item) => item.id !== id);
        renderOfficeLocations();
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
        await mutatePersistentState("update_expense_categories", { categories }, { skipHydrate: true });
        await refreshSettingsTab("categories");
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
          },
        ];
        window.settingsAdmin?.renderDepartments();
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
        return;
      }

    });

    refs.settingsPage.addEventListener("submit", async function (event) {
      const corporateFunctionsForm = event.target.closest("#corporate-functions-form");
      if (corporateFunctionsForm) {
        event.preventDefault();
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
            { skipSettingsMetadataReload: true }
          );
          await loadPersistentState();
          if (state.currentView === "settings") {
            renderCorporateFunctionCategories?.();
          }
          feedback("Corporate functions updated.", false);
        } catch (error) {
          feedback(error.message || "Unable to update corporate functions.", true);
        }
        return;
      }

      const departmentsForm = event.target.closest("#departments-form");
      if (!departmentsForm) {
        return;
      }
      event.preventDefault();
      if (!state.permissions?.manage_departments) {
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
        const name = (nameInput?.value || "").trim();

        if (!name) {
          feedback("Department name is required.", true);
          return;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
          feedback("Department names must be unique.", true);
          return;
        }
        seen.add(key);

        if (!id || id.startsWith("temp-dept-")) {
          createOps.push({ name });
          continue;
        }
        remainingIds.add(id);
        const prev = existingMap.get(id) || {};
        if (prev.name !== name) {
          renameOps.push({ id, name });
        }
      }

      for (const [id] of existingMap.entries()) {
        if (!id || !remainingIds.has(id)) {
          deleteOps.push({ id });
        }
      }

      try {
        for (const op of createOps) {
          await mutatePersistentState("create_department", { name: op.name });
        }
        for (const op of renameOps) {
          await mutatePersistentState("rename_department", { id: op.id, name: op.name });
        }
        for (const op of deleteOps) {
          await mutatePersistentState("delete_department", { id: op.id });
        }
        await refreshSettingsTab("departments");
        feedback("Departments updated.", false);
      } catch (error) {
        feedback(error.message || "Unable to update departments.", true);
      }
    });
  }

  if (refs.levelRows) {
    refs.levelRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-level-delete]");
      if (!deleteBtn) return;
      if (!state.permissions?.manage_levels) {
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
        await mutatePersistentState("update_level_labels", { levels });
        await refreshSettingsTab("levels");
        feedback("Level deleted.", false);
      } catch (error) {
        await refreshSettingsTab("levels");
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

  if (refs.addClientForm && refs.addClientForm.isConnected) {
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
  }

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
        officeId: values.officeId || null,
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
        feedback(error.message || "Unable to save client.", true);
      }
      render();
    });
  }

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
      if (!isAdmin(state.currentUser) && !isExecutive(state.currentUser)) {
        feedback("Only Executives or Admins can edit projects.", true);
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
      const projectDialog = await openProjectDialog({
        mode: "edit",
        projectName,
        budgetAmount: currentBudget,
      });
      if (!projectDialog) {
        return;
      }
      const nextName = projectDialog.projectName;

      try {
        await mutatePersistentState("update_project", {
          clientName: state.selectedCatalogClient,
          projectName,
          nextName,
          budgetAmount: projectDialog.budgetAmount,
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

    const addMemberButton = event.target.closest("[data-add-member]");
    if (addMemberButton) {
      if (
        !isAdmin(state.currentUser) &&
        !(
          isManager(state.currentUser) &&
          canManagerAccessProject(
            state.currentUser,
            state.selectedCatalogClient,
            addMemberButton.dataset.addMember
          )
        )
      ) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-add-member";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = addMemberButton.dataset.addMember;
      const assignedStaff = staffIdsForProject(
        state.selectedCatalogClient,
        addMemberButton.dataset.addMember
      );
      const assignedManagers = directManagerIdsForProject(
        state.selectedCatalogClient,
        addMemberButton.dataset.addMember
      );
      memberModalState.assigned = [...new Set([...(assignedStaff || []), ...(assignedManagers || [])])];
      memberModalState.overrides = {};
      memberModalState.searchTerm = "";
      openMembersModal();
      return;
    }

    const removeMemberButton = event.target.closest("[data-remove-member]");
    if (removeMemberButton) {
      if (
        !isAdmin(state.currentUser) &&
        !(
          isManager(state.currentUser) &&
          canManagerAccessProject(
            state.currentUser,
            state.selectedCatalogClient,
            removeMemberButton.dataset.removeMember
          )
        )
      ) {
        feedback("Manager access required.", true);
        return;
      }
      memberModalState.mode = "project-remove-member";
      memberModalState.client = state.selectedCatalogClient;
      memberModalState.project = removeMemberButton.dataset.removeMember;
      const assignedStaff = staffIdsForProject(
        state.selectedCatalogClient,
        removeMemberButton.dataset.removeMember
      );
      const assignedManagers = directManagerIdsForProject(
        state.selectedCatalogClient,
        removeMemberButton.dataset.removeMember
      );
      memberModalState.assigned = [...new Set([...(assignedStaff || []), ...(assignedManagers || [])])];
      memberModalState.overrides = {};
      memberModalState.searchTerm = "";
      openMembersModal();
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
    const entry = state.entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    if (action === "edit") {
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
          } else if (mode === "project-add-member") {
            if (isStaff(effectiveUser)) {
              await mutatePersistentState("add_project_member", {
                userId: user.id,
                clientName: client,
                projectName: project,
              });
            } else if (isManager(effectiveUser)) {
              await mutatePersistentState("assign_manager_project", {
                managerId: user.id,
                clientName: client,
                projectName: project,
              });
            } else {
              continue;
            }
          } else if (mode === "project-remove-member") {
            if (isStaff(effectiveUser)) {
              await mutatePersistentState("remove_project_member", {
                userId: user.id,
                clientName: client,
                projectName: project,
              });
            } else if (isManager(effectiveUser)) {
              await mutatePersistentState("unassign_manager_project", {
                managerId: user.id,
                clientName: client,
                projectName: project,
              });
            } else {
              continue;
            }
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
      if (restoredView === "inbox") {
        beginInboxVisit();
      }
      if (restoredView === "settings") {
        loadSettingsMetadata();
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
