(function () {
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const body = document.body;
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/set-password") {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
        <section style="width:min(460px,100%);background:#fff;border:1px solid #ddd;border-radius:16px;padding:24px;">
          <h1 style="margin:0 0 16px 0;font-size:1.5rem;">Set your password</h1>
          <form id="set-password-form" style="display:grid;gap:12px;">
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
    form?.addEventListener("submit", async function (event) {
      event.preventDefault();
      const password = document.getElementById("set-password-new")?.value || "";
      const confirm = document.getElementById("set-password-confirm")?.value || "";
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!token) {
        feedback.textContent = "Missing setup token.";
        feedback.style.color = "#b2362e";
        return;
      }
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
    wireEntryModeToggle,
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
  const syncExpenseCatalogs =
    syncExpenseCatalogsImport ||
    (window.expenses && window.expenses.syncExpenseCatalogs) ||
    function () {};
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
    setForm,
    validateEntry,
  } = window.timeEntries || {};
  const { bulkEntry } = window;

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
    form: document.getElementById("entry-form"),
    formHeading: document.getElementById("form-heading"),
    cancelEdit: document.getElementById("cancel-edit"),
    sessionIndicator: document.getElementById("session-indicator"),
    accountName: document.getElementById("account-name"),
    navTimesheet: document.getElementById("nav-timesheet"),
    navExpenses: document.getElementById("nav-expenses"),
    navInputs: document.getElementById("nav-inputs"),
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
    singleEntryContainer: document.getElementById("single-entry-container"),
    bulkEntryContainer: document.getElementById("bulk-entry-container"),
    bulkSaveRows: document.getElementById("bulk-save-rows"),
    entryModeToggle: document.getElementById("entry-mode-toggle"),
    mobileTabbar: document.getElementById("mobile-tabbar"),
    navSettingsMobile: document.getElementById("nav-settings-mobile"),
    navMembersMobile: document.getElementById("nav-members-mobile"),
    navClientsMobile: document.getElementById("nav-clients-mobile"),
    navTimesheetMobile: document.getElementById("nav-timesheet-mobile"),
    navExpensesMobile: document.getElementById("nav-expenses-mobile"),
    navInputsMobile: document.getElementById("nav-inputs-mobile"),
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
    inputsView: document.getElementById("inputs-view"),
    inputsViewTitle: document.getElementById("inputs-view-title"),
    inputsSwitchAction: document.getElementById("inputs-switch-action"),
    inputsPanelTime: document.getElementById("inputs-panel-time"),
    inputsPanelExpenses: document.getElementById("inputs-panel-expenses"),
    inputsTimeForm: document.getElementById("inputs-time-form"),
    inputsTimeClientProject: document.getElementById("inputs-time-client-project"),
    inputsTimeClient: document.getElementById("inputs-time-client"),
    inputsTimeProject: document.getElementById("inputs-time-project"),
    inputsTimeDate: document.getElementById("inputs-time-date"),
    inputsTimeHours: document.getElementById("inputs-time-hours"),
    inputsTimeBillable: document.getElementById("inputs-time-billable"),
    inputsTimeNotes: document.getElementById("inputs-time-notes"),
    expenseRows: document.getElementById("expense-rows"),
    addCategory: document.getElementById("add-category"),
    saveCategories: document.getElementById("save-categories"),
    expenseCategoriesForm: document.getElementById("expense-categories-form"),
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
    settingsMenuSettings: document.getElementById("settings-menu-settings"),
    forcePasswordShell: document.getElementById("force-password-shell"),
    forcePasswordForm: document.getElementById("force-password-form"),
    forcePasswordCurrent: document.getElementById("force-password-current"),
    forcePasswordNew: document.getElementById("force-password-new"),
    forcePasswordConfirm: document.getElementById("force-password-confirm"),
    membersModal: document.getElementById("members-modal"),
    closeUsers: document.getElementById("close-users"),
    singleEntryContainer: document.getElementById("single-entry-container"),
    bulkEntryContainer: document.getElementById("bulk-entry-container"),
    entryModeSingle: document.getElementById("entry-mode-single"),
    entryModeMultiple: document.getElementById("entry-mode-multiple"),
    closeMembers: document.getElementById("close-members"),
    hourPresets: document.getElementById("hour-presets"),
    otherHours: document.getElementById("other-hours"),
    entryDate: document.getElementById("entry-date"),
    entryClientProject: document.getElementById("entry-client-project"),
    submitEntry: document.getElementById("submit-entry"),
    addClientForm: document.getElementById("add-client-form"),
    addProjectForm: document.getElementById("add-project-form"),
    addUserForm: document.getElementById("add-user-form"),
    levelLabelsForm: document.getElementById("level-labels-form"),
    levelRows: document.getElementById("level-rows"),
    ratesForm: document.getElementById("rates-form"),
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
    entryNonBillable: document.getElementById("entry-nonbillable"),
    expenseForm: document.getElementById("expense-form"),
    expenseFormHeading: document.getElementById("expense-form-heading"),
    expenseCancelEdit: document.getElementById("expense-cancel-edit"),
    expenseUser: document.getElementById("expense-user"),
    expenseClientProject: document.getElementById("expense-client-project"),
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
    expenseBulkSave: document.getElementById("expense-bulk-save"),
    officeLocationsForm: document.getElementById("office-locations-form"),
    officeRows: document.getElementById("office-rows"),
    officeAddName: document.getElementById("office-add-name"),
    officeAddLead: document.getElementById("office-add-lead"),
    addOffice: document.getElementById("add-office"),
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

  let addClientHeaderButton = null;
  let memberEditorModal = null;
  let memberEditorForm = null;
  let memberEditorTitle = null;
  let memberEditorSubmit = null;
  let memberEditorReset = null;
  let memberEditorMode = "create";
  let memberEditorUserId = "";

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
              <label><span>Email</span><input type="email" name="email" required /></label>
            </div>
            <div class="member-editor-row">
              <label><span>Title</span><select name="level"></select></label>
              <label><span>Department</span><select name="department_id"><option value="">No department</option></select></label>
              <label><span>Office</span><select name="office_id" required><option value="">Select office</option></select></label>
            </div>
            <div class="member-editor-row">
              <label><span>Base rate</span><input type="number" step="0.01" min="0" name="base_rate" /></label>
              <label><span>Cost rate</span><input type="number" step="0.01" min="0" name="cost_rate" /></label>
              <label data-member-editor-password-row><span></span><input type="password" name="password" autocomplete="new-password" aria-label="Temporary password" placeholder="Temporary password" /></label>
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
      .concat((state.departments || []).filter((d) => d.isActive !== false).map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`))
      .join("");
    officeField.innerHTML = ['<option value="">Select office</option>']
      .concat((state.officeLocations || []).map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`))
      .join("");

    field(memberEditorForm, "display_name").value = user?.displayName || "";
    field(memberEditorForm, "username").value = user?.username || "";
    field(memberEditorForm, "email").value = user?.email || "";
    field(memberEditorForm, "password").value = "";
    field(memberEditorForm, "level").value = String(user?.level || sortedLevelEntries[0]?.[0] || "1");
    field(memberEditorForm, "department_id").value = user?.departmentId || "";
    field(memberEditorForm, "office_id").value = user?.officeId || "";
    field(memberEditorForm, "base_rate").value = user?.baseRate ?? "";
    field(memberEditorForm, "cost_rate").value = user?.costRate ?? "";

    const profileEditable = mode === "create" ? canCreate : canEditProfile;
    ["display_name", "username", "email", "level", "department_id", "office_id"].forEach((name) => {
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
          { displayName, username, email, level, officeId, baseRate, costRate },
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
            { userId, displayName, username, email, level, officeId },
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
  removeMembersAddCard();
  ensureMemberEditorModal();

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
    officeLocations: [],
    expenseCategories: [],
    departments: [],
    departmentsSnapshot: [],
    account: null,
    settingsAccess: {},
    projects: [],
    clientEditor: null,
    assignments: {
      managerClients: [],
      managerProjects: [],
      projectMembers: [],
    },
    currentView: "inputs", // "main" | "inputs" | "expenses" | "clients" | "members" | "analytics" | "settings"
    inputSubtab: "time", // "time" | "expenses"
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
    state.departments = Array.isArray(data?.departments) ? data.departments.slice() : [];
    state.departmentsSnapshot = Array.isArray(data?.departments) ? data.departments.slice() : [];
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
    const remoteOffices = Array.isArray(data?.officeLocations)
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

    state.officeLocations = remoteOffices !== null
      ? remoteOffices
      : cachedOffices !== null
        ? cachedOffices
        : previousOfficeLocations;
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
    state.settingsAccess = data?.settingsAccess || {};
    state.permissions = data?.permissions || {};
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

  async function mutatePersistentState(action, payload, options = {}) {
    const { skipHydrate } = options;
    const sessionToken = loadSessionToken();
    const result = await requestJson(MUTATE_API_PATH, {
      method: "POST",
      body: JSON.stringify({
        action,
        payload,
        ...(sessionToken ? { sessionToken } : {}),
      }),
    });
    if (!skipHydrate && result && result.currentUser) {
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

  function encodeInputsTimeCombo(clientName, projectName) {
    return `${encodeURIComponent(clientName || "")}::${encodeURIComponent(projectName || "")}`;
  }

  function decodeInputsTimeCombo(value) {
    const text = String(value || "");
    const splitAt = text.indexOf("::");
    if (splitAt < 0) return ["", ""];
    return [
      decodeURIComponent(text.slice(0, splitAt) || ""),
      decodeURIComponent(text.slice(splitAt + 2) || ""),
    ];
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
      edit: row.querySelector(".cell-actions [data-inputs-time-edit]"),
      remove: row.querySelector(".cell-actions [data-inputs-time-delete]"),
    };
  }

  function ensureInputsTimeEditButton(row) {
    const fields = inputsTimeRowFields(row);
    if (!fields.actions) return null;
    const editButton = fields.edit || document.createElement("button");
    if (!fields.edit) {
      editButton.type = "button";
      editButton.className = "inputs-time-edit";
      editButton.textContent = "Edit";
      editButton.hidden = true;
      editButton.dataset.inputsTimeEdit = "true";
      fields.actions.appendChild(editButton);
    }
    if (!editButton.__inputsTimeBoundClick) {
      editButton.addEventListener("click", function () {
        if (row.dataset.saving === "true" || row.dataset.deleting === "true") return;
        setInputsTimeRowState(row, "editing-saved");
        row.dataset.saving = "false";
        const current = inputsTimeRowFields(row);
        if (current.save) {
          current.save.hidden = false;
          current.save.classList.remove("is-saved");
          current.save.textContent = "Save";
          current.save.disabled = false;
        }
        syncInputsTimeRowInteractivity(
          Array.from(row.parentElement?.querySelectorAll("form.input-row.input-row-body") || [])
        );
        current.hours?.focus();
      });
      editButton.__inputsTimeBoundClick = true;
    }
    return editButton;
  }

  function ensureInputsTimeDeleteButton(row) {
    const fields = inputsTimeRowFields(row);
    if (!fields.actions) return null;
    const deleteButton = fields.remove || document.createElement("button");
    if (!fields.remove) {
      deleteButton.type = "button";
      deleteButton.className = "inputs-time-delete";
      deleteButton.textContent = "🗑";
      deleteButton.hidden = true;
      deleteButton.dataset.inputsTimeDelete = "true";
      deleteButton.setAttribute("aria-label", "Delete row");
      deleteButton.title = "Delete";
      fields.actions.appendChild(deleteButton);
    }
    if (!deleteButton.__inputsTimeBoundClick) {
      deleteButton.addEventListener("click", async function () {
        if (row.dataset.saving === "true" || row.dataset.deleting === "true") return;
        const id = `${row.dataset.entryId || ""}`.trim();
        if (!id) {
          feedback("Unable to delete entry.", true);
          return;
        }
        row.dataset.deleting = "true";
        const current = inputsTimeRowFields(row);
        if (current.save) current.save.disabled = true;
        if (current.edit) current.edit.disabled = true;
        if (current.remove) current.remove.disabled = true;
        try {
          await mutatePersistentState("delete_entry", { id });
        } catch (error) {
          row.dataset.deleting = "false";
          if (current.save) current.save.disabled = true;
          if (current.edit) current.edit.disabled = false;
          if (current.remove) current.remove.disabled = false;
          feedback(error.message || "Unable to delete entry.", true);
          return;
        }

        const container = row.parentElement;
        const deletingTemplateRow = row === refs.inputsTimeForm;
        row.remove();
        if (deletingTemplateRow && container) {
          const nextTemplate = container.querySelector("form.input-row.input-row-body");
          if (nextTemplate) {
            refs.inputsTimeForm = nextTemplate;
            refs.inputsTimeForm.id = "inputs-time-form";
          }
        }
        if (container) {
          syncInputsTimeRowInteractivity(
            Array.from(container.querySelectorAll("form.input-row.input-row-body"))
          );
        }
        feedback("Entry deleted.", false);
        postHeight();
      });
      deleteButton.__inputsTimeBoundClick = true;
    }
    return deleteButton;
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
    if (!row) return;
    row.dataset.rowState = state;
    row.dataset.saved = state === "saved" ? "true" : "false";
    row.dataset.editing = state === "editing-saved" ? "true" : "false";
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
    if (!container) return false;
    const rows = Array.from(container.querySelectorAll("form.input-row.input-row-body"));
    if (!rows.length) return false;
    const last = rows[rows.length - 1];
    const rowState = last.dataset.rowState || (last.dataset.saved === "true" ? "saved" : "new");
    if (rowState !== "new" || last.dataset.saving === "true") return false;
    return isInputsTimeRowBlank(last);
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
    const list = Array.isArray(rows) ? rows : [];
    list.forEach((row) => {
      if (!row.dataset.rowState) {
        setInputsTimeRowState(row, row.dataset.saved === "true" ? "saved" : "new");
      }
    });
    const unsavedRows = list.filter((row) => row.dataset.rowState !== "saved");
    const editingRow = unsavedRows.find((row) => row.dataset.rowState === "editing-saved") || null;
    const activeRow = editingRow || (unsavedRows.length ? unsavedRows[unsavedRows.length - 1] : null);

    list.forEach((row) => {
      const fields = inputsTimeRowFields(row);
      const isSaved = row.dataset.rowState === "saved";
      const isSaving = row.dataset.saving === "true";
      const isActiveUnsaved = !isSaved && row === activeRow;
      const isEditingSaved = row.dataset.rowState === "editing-saved";

      if (isSaved) {
        setInputsTimeRowSaved(row);
        return;
      }
      setInputsTimeRowState(row, isEditingSaved ? "editing-saved" : "new");
      row.dataset.editing = isActiveUnsaved && isEditingSaved ? "true" : "false";
      row.dataset.deleting = "false";
      setInputsTimeEditButtonVisible(row, false);
      setInputsTimeDeleteButtonVisible(row, false);

      [fields.clientProject, fields.date, fields.hours, fields.billable, fields.notes].forEach((input) => {
        if (input) input.disabled = !isActiveUnsaved || isSaving;
      });

      if (fields.save) {
        fields.save.hidden = false;
        fields.save.classList.remove("is-saved");
        fields.save.textContent = isSaving ? "Saving..." : "Save";
        fields.save.disabled = !isActiveUnsaved || isSaving;
      }
    });
  }

  function inputsTimeComboOptions() {
    return assignedProjectTuplesForCurrentUser().map((item) => ({
      label: `${item.client} / ${item.project}`,
      value: encodeInputsTimeCombo(item.client, item.project),
    }));
  }

  function applyInputsTimeBillableDefaultForRow(row) {
    const fields = inputsTimeRowFields(row);
    if (!fields.clientProject || !fields.billable) return;
    const [, projectName] = decodeInputsTimeCombo(fields.clientProject.value);
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
    const selected = fields.clientProject.value || "";
    setSelectOptionsWithPlaceholder(
      { escapeHtml },
      fields.clientProject,
      options,
      selected,
      "Client / Project"
    );
    if (!fields.clientProject.value && options.length) {
      fields.clientProject.value = options[0].value;
    }
    fields.clientProject.disabled = options.length === 0;

    if (fields.billable && row.dataset.lastCombo !== fields.clientProject.value) {
      applyInputsTimeBillableDefaultForRow(row);
    }
    row.dataset.lastCombo = fields.clientProject.value || "";

    syncInputsTimeDateInput(fields.date);
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
      applyInputsTimeBillableDefaultForRow(row);
      row.dataset.lastCombo = fields.clientProject.value || "";
    });

    fields.date?.addEventListener("change", function () {
      syncInputsTimeDateField(fields.date);
    });

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
        await mutatePersistentState("save_entry", { entry: nextEntry });
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
      const shouldAddNextRow = !wasEditingSavedRow && !hasTrailingBlankInputsTimeRow(container);
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
    syncInputsTimeRowInteractivity(rows);
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
    const user = targetUser || state.currentUser;
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
    const user = targetUser || state.currentUser;
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
    const userId = state.currentUser?.id || "";
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
      });
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
      });
      closeChangePasswordModal();
      feedback("Password updated.", false);
    } catch (error) {
      feedback(error.message || "Unable to change password.", true);
      return;
    }
    render();
  }

  let entryMode = "single";

  function updateEntryModeToggle(mode) {
    if (!refs.entryModeToggle) return;
    refs.entryModeToggle.dataset.mode = mode;
    refs.entryModeToggle.textContent =
      mode === "multiple" ? "Single entry" : "Multiple entry";
  }

  function toggleEntryMode(mode) {
    const isMultiple = mode === "multiple";
    entryMode = mode;
    if (refs.singleEntryContainer) {
      refs.singleEntryContainer.hidden = isMultiple;
    }
    if (refs.bulkEntryContainer) {
      refs.bulkEntryContainer.hidden = !isMultiple;
    }
    updateEntryModeToggle(mode);
    if (isMultiple && bulkEntry?.init) {
      bulkEntry.init();
    }
  }

  function resetEntryMode() {
    toggleEntryMode("single");
  }

  function clearEntryAndExpenseDrafts() {
    resetForm?.();
    resetExpenseForm?.();
    window.bulkEntry?.resetRows?.();
  }

  async function handleLogout() {
    const sessionToken = loadSessionToken();

    persistSessionToken("");
    clearRemoteAppState();
    resetFilters();
    clearEntryAndExpenseDrafts();
    resetEntryMode();
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
          officeId: user.officeId ?? "",
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
        const officeSelect = detailCard.querySelector('[data-user-field="officeId"]');
        const nextDisplayName = displayNameInput?.value.trim() || "";
        const nextUsername = usernameInput?.value.trim() || "";
        const nextLevel = Number(levelSelect?.value || user.level);
        const nextOfficeIdRaw = officeSelect?.value || "";
        const nextOfficeId = nextOfficeIdRaw ? nextOfficeIdRaw : null;
        if (!nextDisplayName) {
          setUserFeedback("Name is required.", true);
          return;
        }
        if (!nextUsername) {
          setUserFeedback("Username is required.", true);
          return;
        }
        if (!Number.isInteger(nextLevel) || !state.levelLabels?.[nextLevel]) {
          setUserFeedback("Invalid level.", true);
          return;
        }
        try {
          await mutatePersistentState("update_user", {
            userId: user.id,
            displayName: nextDisplayName,
            username: nextUsername,
            level: nextLevel,
            officeId: nextOfficeId,
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
    if (refs.settingsMenuSettings) {
      const showSettingsLink = !!state.permissions?.view_settings_tab;
      refs.settingsMenuSettings.hidden = !showSettingsLink;
      refs.settingsMenuSettings.setAttribute("aria-current", view === "settings" ? "page" : "false");
    }
    if (refs.navTimesheet) {
      refs.navTimesheet.hidden = false;
      refs.navTimesheet.classList.toggle("is-active", view === "main");
      refs.navTimesheet.setAttribute("aria-current", view === "main" ? "page" : "false");
    }
    if (refs.navInputs) {
      refs.navInputs.hidden = false;
      refs.navInputs.classList.toggle("is-active", view === "inputs");
      refs.navInputs.setAttribute("aria-current", view === "inputs" ? "page" : "false");
    }
    if (refs.navTimesheetMobile) {
      refs.navTimesheetMobile.hidden = false;
      refs.navTimesheetMobile.classList.toggle("is-active", view === "main");
      refs.navTimesheetMobile.setAttribute("aria-current", view === "main" ? "page" : "false");
    }
    if (refs.navInputsMobile) {
      refs.navInputsMobile.hidden = false;
      refs.navInputsMobile.classList.toggle("is-active", view === "inputs");
      refs.navInputsMobile.setAttribute("aria-current", view === "inputs" ? "page" : "false");
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
    if (refs.inputsView) {
      refs.inputsView.hidden = view !== "inputs";
    }
    if (refs.auditView) {
      refs.auditView.hidden = view !== "audit";
    }

    const inputSubtab = state.inputSubtab === "expenses" ? "expenses" : "time";
    if (refs.inputsViewTitle) {
      refs.inputsViewTitle.textContent = inputSubtab === "expenses" ? "Enter Expenses" : "Enter Time";
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
      syncAddUserOfficeOptions();
      renderUsersList();
      removeMembersPageProfileActions();
      syncUserManagementControls();
      postHeight();
      return;
    }

    if (view === "settings") {
      renderLevelRows();
      renderRatesRows?.();
      renderExpenseCategories();
      renderOfficeLocations();
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

    if (view === "inputs") {
      if (state.inputSubtab === "time") {
        syncInputsTimeRow();
      }
      postHeight();
      return;
    }

    if (view === "expenses") {
      if (refs.timesheetView) refs.timesheetView.hidden = true;
      if (refs.expensesView) refs.expensesView.hidden = false;
      if (refs.expenseUser) refs.expenseUser.value = state.currentUser?.id || "";
      if (refs.expenseUser) refs.expenseUser.closest("label")?.classList.add("entry-hidden-control");
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
    const entryUserField = field(refs.form, "user");
    if (entryUserField) entryUserField.value = state.currentUser?.displayName || "";
    if (entryUserField) entryUserField.closest("label")?.classList.add("entry-hidden-control");

    syncFormCatalogsUI({});
    syncFilterCatalogsUI(state.filters);
    ensureCatalogSelection();

    const filteredEntries = currentEntries();
    renderCatalogAside();
    renderUsersList();
    removeMembersPageProfileActions();
    syncUserManagementControls();
    renderLevelRows();
    renderFilterState(filteredEntries);
    renderTable(filteredEntries);
    postHeight();
  }

  function removeMembersPageProfileActions() {
    if (!refs.usersPage) return;
    refs.usersPage
      .querySelectorAll("[data-user-password], [data-user-deactivate]")
      .forEach((node) => node.remove());
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
    if (userField) {
      userField.value = state.currentUser?.displayName || "";
    }
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
  if (refs.navInputs) {
    refs.navInputs.addEventListener("click", function () {
      setView("inputs");
    });
  }
  if (refs.navTimesheetMobile) {
    refs.navTimesheetMobile.addEventListener("click", function () {
      setView("main");
    });
  }
  if (refs.navInputsMobile) {
    refs.navInputsMobile.addEventListener("click", function () {
      setView("inputs");
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
  if (refs.inputsSwitchAction) {
    refs.inputsSwitchAction.addEventListener("click", function () {
      state.inputSubtab = state.inputSubtab === "expenses" ? "time" : "expenses";
      render();
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

  async function saveBulkRows() {
    if (!window.bulkEntry) return;
    const userValue = state.currentUser?.displayName || "";
    const rows = window.bulkEntry.getRows ? window.bulkEntry.getRows() : [];
    const hasContent = (row) =>
      (row.client && row.client.trim()) ||
      (row.project && row.project.trim()) ||
      (row.notes && row.notes.trim()) ||
      (row.hours !== undefined &&
        row.hours !== null &&
        String(row.hours).trim() !== "");
    const rowsToSave = rows.filter(hasContent);
    const errors = [];
    const entries = [];
    rowsToSave.forEach(function (row, index) {
      const nextEntry = {
        id: crypto.randomUUID(),
        user: userValue,
        date: row.date || "",
        client: row.client || "",
        project: row.project || "",
        task: "",
        hours: Number(row.hours),
        notes: (row.notes || "").trim(),
        billable: row.billable !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
      };
      const error = validateEntry(nextEntry);
      if (error) {
        errors.push(`Row ${index + 1}: ${error}`);
      } else {
        entries.push(nextEntry);
      }
    });

    if (!entries.length && !errors.length) {
      feedback("No rows to save.", true);
      return;
    }

    if (errors.length) {
      feedback(errors.join(" "), true);
      return;
    }

    for (const entry of entries) {
      try {
        await mutatePersistentState("save_entry", { entry });
      } catch (error) {
        feedback(error.message || "Unable to save bulk rows.", true);
        return;
      }
    }

    feedback(`Saved ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`, false);
    window.bulkEntry.resetRows?.();
    render();
  }

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

  if (wireEntryModeToggle && refs.entryModeToggle) {
    wireEntryModeToggle({ refs, toggleEntryMode });
  } else {
    toggleEntryMode("single");
  }

  if (window.bulkEntry && refs.bulkSaveRows) {
    refs.bulkSaveRows.addEventListener("click", saveBulkRows);
  }

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
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    state.selectedCatalogClient = clientField.value || state.selectedCatalogClient;
    syncFormCatalogsUI({
      user: state.currentUser?.displayName || "",
      client: clientField.value,
      project: projectField?.value || "",
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
      if (refs.expenseUser) {
        refs.expenseUser.value = state.currentUser?.id || "";
      }
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

  async function saveExpense(expense) {
    const error = validateExpenseForm(expense);
    if (error) throw new Error(error);
    await mutatePersistentState("create_expense", { expense });
  }

  async function saveBulkExpenses() {
    if (!window.bulkExpenses) return;
    const userId = state.currentUser?.id || "";
    const rows = window.bulkExpenses.getRows ? window.bulkExpenses.getRows() : [];

    const hasContent = (row) =>
      (row.client && row.client.trim()) ||
      (row.project && row.project.trim()) ||
      (row.category && row.category.trim()) ||
      (row.notes && row.notes.trim()) ||
      (row.amount !== undefined &&
        row.amount !== null &&
        String(row.amount).trim() !== "");

    const rowsToSave = rows.filter(hasContent);
    const errors = [];
    const expensesToSave = [];

    rowsToSave.forEach(function (row, index) {
      const expenseDate = row.date || refs.expenseDate?.value || "";
      const expense = {
        id: crypto.randomUUID(),
        userId,
        clientName: row.client || "",
        projectName: row.project || "",
        expenseDate,
        category: row.category || "",
        amount: Number(row.amount),
        isBillable: row.billable !== false,
        notes: (row.notes || "").trim(),
        status: "pending",
      };
      const error = validateExpenseForm(expense);
      if (error) {
        errors.push(`Row ${index + 1}: ${error}`);
      } else {
        expensesToSave.push(expense);
      }
    });

    if (!expensesToSave.length && !errors.length) {
      feedback("No expenses to save.", true);
      return;
    }

    if (errors.length) {
      feedback(errors.join(" "), true);
      return;
    }

    for (const expense of expensesToSave) {
      try {
        await mutatePersistentState("create_expense", { expense });
      } catch (error) {
        feedback(error.message || "Unable to save expenses.", true);
        return;
      }
    }

    feedback(`Saved ${expensesToSave.length} expense${expensesToSave.length === 1 ? "" : "s"}.`, false);
    window.bulkExpenses.resetRows?.();
    render();
  }

  // Expose for late binding in expense bulk container.
  window.saveBulkExpenses = saveBulkExpenses;
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("#expense-bulk-save");
    if (!btn) return;
    if (typeof window.saveBulkExpenses === "function") {
      window.saveBulkExpenses();
    }
  });

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
    refs.expenseUser.value = state.currentUser?.id || "";
    refs.expenseUser.closest("label")?.classList.add("entry-hidden-control");
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
        const expForm = refs.expenseForm;
        const expBulk = document.getElementById("expense-bulk-container");
        const expToggle = document.getElementById("expense-mode-toggle");
        if (expForm) expForm.hidden = false;
        if (expBulk) expBulk.hidden = true;
        if (expToggle) {
          expToggle.dataset.mode = "single";
          expToggle.textContent = "Multiple entry";
        }
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
  if (refs.addUserForm) {
    refs.addUserForm.addEventListener("submit", handleAddUser);
  }
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
      if (!state.permissions.view_settings_tab) {
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
    refs.addLevel.addEventListener("click", handleAddLevel);
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

  if (refs.addDepartment) {
    refs.addDepartment.addEventListener("click", function () {
      if (!state.permissions?.manage_departments) {
        feedback("Access denied.", true);
        return;
      }
      state.departments = [
        ...state.departments,
        {
          id: `temp-dept-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: "",
          isActive: true,
        },
      ];
      window.settingsAdmin?.renderDepartments();
    });
  }

  if (refs.departmentRows) {
    refs.departmentRows.addEventListener("click", async function (event) {
      const deleteBtn = event.target.closest("[data-department-delete]");
      if (deleteBtn) {
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
      const toggleBtn = event.target.closest("[data-department-active]");
      if (!toggleBtn) return;
      const next = toggleBtn.dataset.active !== "true";
      toggleBtn.dataset.active = next ? "true" : "false";
      toggleBtn.classList.toggle("is-active", next);
      toggleBtn.classList.toggle("is-inactive", !next);
      toggleBtn.textContent = next ? "Active" : "Inactive";
      toggleBtn.setAttribute("aria-pressed", next ? "true" : "false");
    });
  }

  if (refs.departmentsForm) {
    refs.departmentsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.permissions?.manage_departments) {
        feedback("Access denied.", true);
        return;
      }
      const rows = Array.from(refs.departmentRows?.querySelectorAll(".department-row") || []);
      if (!rows.length) {
        feedback("Add at least one department.", true);
        return;
      }
      const existingMap = new Map((state.departmentsSnapshot || []).map((d) => [d.id, d]));
      const seen = new Set();
      const createOps = [];
      const renameOps = [];
      const activeOps = [];
      const remainingIds = new Set();

      for (const row of rows) {
        const id = (row.dataset.departmentId || "").trim();
        const nameInput = row.querySelector("[data-department-name]");
        const activeBtn = row.querySelector("[data-department-active]");
        const name = (nameInput?.value || "").trim();
        const isActive = activeBtn ? activeBtn.dataset.active !== "false" : true;

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
          createOps.push({ name, isActive });
          continue;
        }
        remainingIds.add(id);
        const prev = existingMap.get(id) || {};
        if (prev.name !== name) {
          renameOps.push({ id, name });
        }
        const prevActive = prev.isActive === false ? false : true;
        if (prevActive !== isActive) {
          activeOps.push({ id, isActive });
        }
      }

      for (const [id, prev] of existingMap.entries()) {
        if (!id || !remainingIds.has(id)) {
          const prevActive = prev?.isActive === false ? false : true;
          if (prevActive) {
            activeOps.push({ id, isActive: false });
          }
        }
      }

      try {
        for (const op of createOps) {
          await mutatePersistentState("create_department", { name: op.name, isActive: op.isActive });
        }
        for (const op of renameOps) {
          await mutatePersistentState("rename_department", { id: op.id, name: op.name });
        }
        for (const op of activeOps) {
          await mutatePersistentState("set_department_active", { id: op.id, isActive: op.isActive });
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
      const membersWithRole = (state.users || []).filter(function (user) {
        return user?.isActive !== false && normalizeLevel(user?.level) === levelToRemove;
      }).length;
      const confirmDelete = await appDialog({
        title: "Remove role?",
        message: `Are you sure you would like to remove this role? There are currently ${membersWithRole} member${membersWithRole === 1 ? "" : "s"} with this role.`,
        confirmText: "Remove",
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

      state.levelLabels = levels.reduce((acc, item) => {
        acc[item.level] = { label: item.label, permissionGroup: item.permissionGroup };
        return acc;
      }, {});
      renderLevelRows();
      feedback("Level removed. Click Save Levels to persist.", false);
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
          isActive: true,
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
    const viewTimeButton = event.target.closest("[data-view-time-project]");
    if (viewTimeButton) {
      const projectName = viewTimeButton.dataset.viewTimeProject;
      state.filters.client = state.selectedCatalogClient;
      state.filters.project = projectName;
      syncFilterCatalogsUI(state.filters);
      setView("main");
      render();
      return;
    }

    const viewExpensesButton = event.target.closest("[data-view-expenses-project]");
    if (viewExpensesButton) {
      const projectName = viewExpensesButton.dataset.viewExpensesProject;
      state.expenseFilters.client = state.selectedCatalogClient;
      state.expenseFilters.project = projectName;
      syncExpenseFilterCatalogsUI(state.expenseFilters);
      setView("expenses");
      render();
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
      toggleEntryMode("single");
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
    canUserAccessProject,
    isAdmin,
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
    clampDateToBounds,
    today,
    setExpenseNonBillableDefault,
    parseDisplayDate,
    feedback,
    formatDisplayDate,
    formatDisplayDateShort,
    permissionGroupForUser: permissionGroupForUserWithSuper,
    canUserAccessProject,
    isAdmin,
    field,
    assignedProjectTuplesForCurrentUser,
  };

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
    clearEntryAndExpenseDrafts();
    resetEntryMode();

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
