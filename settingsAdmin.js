(function () {
  const deps = () => window.settingsAdminDeps || {};
  const SETTINGS_TABS = [
    "levels",
    "categories",
    "corporate_functions",
    "locations",
    "rates",
    "messaging_rules",
    "departments",
    "delegations",
    "bulk_upload",
    "permissions",
  ];
  const SETTINGS_TAB_STORAGE_KEY = "timesheet-studio.settings-tab.v1";
  function loadPersistedSettingsTab() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      return typeof raw === "string" ? raw.trim() : "";
    } catch (error) {
      return "";
    }
  }
  function persistSettingsTab(tabKey) {
    const normalized = `${tabKey || ""}`.trim();
    if (!normalized) return;
    try {
      window.localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, normalized);
    } catch (error) {
      return;
    }
  }
  let activeSettingsTab = loadPersistedSettingsTab() || "levels";
  let tabsInitialized = false;
  let mobileSettingsMode = "list";
  let collapsedCorporateGroupIds = new Set();
  let memberInfoSearchTerm = "";
  let memberInfoMobileMode = "list";
  let memberInfoMobileSelectedUserId = "";
  let delegationsSelectedDelegateId = "";
  let permissionsSaveInFlight = false;
  const delegationsDraftCapabilitiesByDelegateId = new Map();
  const SETTINGS_DELETE_ICON = `
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" fill="currentColor"/>
    </svg>
  `;

  function isMobileSettingsLayout() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 980px)").matches;
  }

  function applyMobileSettingsLayout() {
    const settingsPage = document.getElementById("settings-page");
    if (!settingsPage) return;
    settingsPage.classList.remove("settings-mobile-list", "settings-mobile-detail");
    if (!isMobileSettingsLayout()) {
      return;
    }
    settingsPage.classList.add(
      mobileSettingsMode === "detail" ? "settings-mobile-detail" : "settings-mobile-list"
    );
  }

  function settingsTabElements() {
    const tabButtons = Array.from(document.querySelectorAll("[data-settings-tab-button]"));
    const panels = Array.from(document.querySelectorAll("[data-settings-tab]"));
    return { tabButtons, panels };
  }

  function allowedTabs() {
    const { state } = deps();
    const isMobileLayout = isMobileSettingsLayout();
    const tabs = [];
    if (state.permissions?.manage_levels) tabs.push("levels");
    if (state.permissions?.manage_expense_categories) tabs.push("categories");
    if (state.permissions?.manage_corporate_functions) tabs.push("corporate_functions");
    if (state.permissions?.manage_office_locations && !isMobileLayout) tabs.push("locations");
    if (state.permissions?.view_members_page) {
      tabs.push("rates");
    }
    if (state.permissions?.manage_settings_access && !isMobileLayout) tabs.push("messaging_rules");
    if (state.permissions?.manage_departments) tabs.push("departments");
    if (state.permissions?.can_delegate) tabs.push("delegations");
    if (state.permissions?.can_upload_data && !isMobileLayout) tabs.push("bulk_upload");
    if (state.permissions?.manage_settings_access && !isMobileLayout) tabs.push("permissions");
    return tabs;
  }

  function setActiveSettingsTab(nextTab, options = {}) {
    const fromUser = options.fromUser === true;
    const allowed = allowedTabs();
    if (!allowed.length) {
      return;
    }
    const allowedSet = new Set(allowed);

    // Remove disallowed tabs entirely so they do not render.
    let { tabButtons, panels } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      const tabKey = btn.dataset.settingsTabButton;
      if (!allowedSet.has(tabKey) && btn.parentNode) {
        btn.parentNode.removeChild(btn);
      }
    });
    panels.forEach(function (panel) {
      const tabKey = panel.dataset.settingsTab;
      if (!allowedSet.has(tabKey) && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });

    if (!allowed.length) {
      activeSettingsTab = null;
      return;
    }

    if (!allowedSet.has(nextTab)) {
      nextTab = allowed[0];
    }
    activeSettingsTab = nextTab;
    persistSettingsTab(nextTab);
    if (isMobileSettingsLayout() && fromUser) {
      mobileSettingsMode = "detail";
    }

    // Re-read elements after removals
    ({ tabButtons, panels } = settingsTabElements());

    tabButtons.forEach(function (btn) {
      const tabKey = btn.dataset.settingsTabButton;
      const permitted = allowedSet.has(tabKey);
      const isActive = permitted && tabKey === nextTab;
      btn.hidden = !permitted;
      btn.classList.toggle("is-active", isActive);
      btn.classList.toggle("is-selected", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    panels.forEach(function (panel) {
      const tabKey = panel.dataset.settingsTab;
      const permitted = allowedSet.has(tabKey);
      const isActive = permitted && tabKey === nextTab;
      panel.hidden = !isActive;
    });
    applyMobileSettingsLayout();
    const mobileMemberAdd = document.querySelector("#settings-page .member-info-mobile-add");
    if (mobileMemberAdd) {
      const addAllowed = mobileMemberAdd.dataset.memberAddAllowed === "true";
      mobileMemberAdd.hidden = !(
        isMobileSettingsLayout() &&
        nextTab === "rates" &&
        mobileSettingsMode === "detail" &&
        addAllowed
      );
    }
  }

  function initSettingsTabs() {
    if (tabsInitialized) {
      setActiveSettingsTab(activeSettingsTab);
      return;
    }
    tabsInitialized = true;
    const { tabButtons } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        const targetTab = btn.dataset.settingsTabButton;
        setActiveSettingsTab(targetTab, { fromUser: true });
      });
    });
    window.addEventListener("resize", applyMobileSettingsLayout);
    setActiveSettingsTab(activeSettingsTab);
  }

  function arrangeSettingsSectionHeaders() {
    const settingsPage = document.getElementById("settings-page");
    if (!settingsPage) return;
    const sectionPanels = Array.from(
      settingsPage.querySelectorAll(
        '[data-settings-tab="levels"], [data-settings-tab="categories"], [data-settings-tab="corporate_functions"], [data-settings-tab="locations"], [data-settings-tab="rates"], [data-settings-tab="messaging_rules"], [data-settings-tab="departments"], [data-settings-tab="delegations"], [data-settings-tab="bulk_upload"], [data-settings-tab="permissions"]'
      )
    );

    sectionPanels.forEach((panel) => {
      const inner =
        panel.querySelector(".level-labels-inner") ||
        panel;
      if (!inner) return;
      const title =
        inner.querySelector(".settings-section-header h3") ||
        inner.querySelector("h3");
      if (!title) return;

      let header = inner.querySelector(".settings-section-header");
      if (!header) {
        header = document.createElement("div");
        header.className = "settings-section-header";
        inner.insertBefore(header, inner.firstChild);
      }

      let left = header.querySelector(".settings-section-left");
      if (!left) {
        left = document.createElement("div");
        left.className = "settings-section-left";
        header.appendChild(left);
      }

      let right = header.querySelector(".settings-section-right");
      if (!right) {
        right = document.createElement("div");
        right.className = "settings-section-right";
        header.appendChild(right);
      }

      if (title.parentElement !== left) {
        left.appendChild(title);
      }

      const actions = inner.querySelector(".level-labels-actions");
      if (actions) {
        const buttons = Array.from(actions.querySelectorAll("button"));
        buttons.forEach((btn) => {
          if (panel.dataset.settingsTab === "rates" && btn.id === "save-rates") {
            btn.remove();
            return;
          }
          const isAdd =
            btn.id.startsWith("add-") ||
            btn.classList.contains("button-ghost");
          if (isAdd) {
            if (btn.parentElement !== left) left.appendChild(btn);
          } else if (btn.type === "submit" || btn.id.startsWith("save-")) {
            if (btn.parentElement !== right) right.appendChild(btn);
          }
        });
        if (!actions.querySelector("button")) {
          actions.remove();
        }
      }

      let content = inner.querySelector(".settings-section-content");
      if (!content) {
        content = document.createElement("div");
        content.className = "settings-section-content";
        if (header.nextSibling) {
          inner.insertBefore(content, header.nextSibling);
        } else {
          inner.appendChild(content);
        }
      }

      Array.from(inner.children).forEach((child) => {
        if (child === header || child === content) return;
        content.appendChild(child);
      });
    });
  }

  function renderSettingsTabs() {
    const { state } = deps();
    if (!state?.permissions) return;
    if (!state.permissions.view_settings_tab) {
      const settingsPage = document.getElementById("settings-page");
      if (settingsPage) settingsPage.hidden = true;
      return;
    }
    const labelByTab = {
      levels: "Member levels",
      categories: "Expense categories",
      corporate_functions: "Corporate Functions",
      locations: "Office locations",
      rates: "Member information",
      messaging_rules: "Messaging Rules",
      departments: "Practice departments",
      delegations: "Delegations",
      bulk_upload: "Bulk Upload",
      permissions: "Member access levels",
    };
    const settingsTabGroups = [
      { key: "people", label: "PEOPLE", tabs: ["rates", "levels", "permissions", "delegations"] },
      { key: "organization", label: "ORGANIZATION", tabs: ["departments", "locations"] },
      { key: "configuration", label: "CONFIGURATION", tabs: ["categories", "corporate_functions", "messaging_rules"] },
      { key: "tools", label: "TOOLS", tabs: ["bulk_upload"] },
    ];
    const { tabButtons } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      const key = btn.dataset.settingsTabButton;
      btn.classList.add("settings-tab");
      btn.classList.add("catalog-item");
      if (labelByTab[key]) {
        btn.textContent = labelByTab[key];
      }
    });
    const settingsPage = document.getElementById("settings-page");
    if (settingsPage) settingsPage.hidden = false;
    const settingsBody = document.querySelector("#settings-page .users-page-body");
    if (settingsBody) {
      let panelsContainer = settingsBody.querySelector(".settings-panels");
      if (!panelsContainer) {
        panelsContainer = document.createElement("div");
        panelsContainer.className = "settings-panels";
        const existingPanels = Array.from(settingsBody.querySelectorAll("[data-settings-tab]"));
        if (existingPanels.length) {
          const anchor = existingPanels[0];
          settingsBody.insertBefore(panelsContainer, anchor);
          existingPanels.forEach((panel) => panelsContainer.appendChild(panel));
        } else {
          settingsBody.appendChild(panelsContainer);
        }
      }

      let layout = settingsBody.querySelector(".settings-layout");
      const tabsContainer = settingsBody.querySelector(".settings-tabs");
      if (tabsContainer && panelsContainer) {
        tabsContainer.classList.add("catalog-list");
        if (!layout) {
          layout = document.createElement("div");
          layout.className = "settings-layout";
          settingsBody.insertBefore(layout, tabsContainer);
        }
        let navShell = layout.querySelector(".settings-nav-shell");
        if (!navShell) {
          navShell = document.createElement("div");
          navShell.className = "settings-nav-shell";
          layout.appendChild(navShell);
        }
        let contentShell = layout.querySelector(".settings-content-shell");
        if (!contentShell) {
          contentShell = document.createElement("div");
          contentShell.className = "settings-content-shell";
          layout.appendChild(contentShell);
        }
        if (tabsContainer.parentElement !== navShell) {
          navShell.appendChild(tabsContainer);
        }
        settingsTabGroups.forEach((group) => {
          let section = tabsContainer.querySelector(`[data-settings-group="${group.key}"]`);
          if (!section) {
            section = document.createElement("div");
            section.className = "settings-tab-group";
            section.dataset.settingsGroup = group.key;
            const label = document.createElement("div");
            label.className = "settings-tab-group-label";
            label.textContent = group.label;
            section.appendChild(label);
            tabsContainer.appendChild(section);
          }

          let hasVisibleButton = false;
          group.tabs.forEach((tabKey) => {
            const btn = tabsContainer.querySelector(`[data-settings-tab-button="${tabKey}"]`);
            if (!btn) return;
            section.appendChild(btn);
            if (!btn.hidden) {
              hasVisibleButton = true;
            }
          });

          section.hidden = !hasVisibleButton;
        });
        if (panelsContainer.parentElement !== contentShell) {
          contentShell.appendChild(panelsContainer);
        }
        let mobileBack = contentShell.querySelector(".settings-mobile-back");
        if (!mobileBack) {
          mobileBack = document.createElement("button");
          mobileBack.type = "button";
          mobileBack.className = "button button-ghost settings-mobile-back";
          mobileBack.textContent = "Back to sections";
          mobileBack.addEventListener("click", function () {
            mobileSettingsMode = "list";
            applyMobileSettingsLayout();
          });
          contentShell.insertBefore(mobileBack, contentShell.firstChild);
        }
      }

      const existing = document.getElementById("settings-layout-style");
      if (existing) existing.remove();

      const style = document.createElement("style");
      style.id = "settings-layout-style";
      style.textContent = `
          #settings-page .settings-layout{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:22px;align-items:stretch}
          #settings-page .settings-nav-shell,
          #settings-page .settings-content-shell{
            border:1px solid var(--panel-border);
            border-radius:var(--card-radius);
            background:var(--panel);
            box-shadow:var(--shadow);
            padding:14px;
            height:clamp(520px, calc(100vh - 150px), 84vh);
            overflow:auto;
          }
          #settings-page .settings-tabs{
            display:grid;
            gap:0;
            padding-bottom:0;
            border-bottom:none;
          }
          #settings-page .settings-tab-group{display:grid;gap:10px}
          #settings-page .settings-tab-group + .settings-tab-group{margin-top:12px}
          #settings-page .settings-tab-group-label{
            font-family:var(--font-head);
            font-size:.68rem;
            line-height:1;
            font-weight:700;
            letter-spacing:.08em;
            text-transform:uppercase;
            color:var(--muted);
            padding:0 2px;
          }
          #settings-page .settings-tab{
            width:100%;
            outline:none;
          }
          #settings-page .settings-tab:focus{outline:none}
          #settings-page .settings-tab:focus-visible{
            outline:none;
            box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--group-border) 55%, transparent);
          }
          #settings-page .settings-mobile-back{display:none}
          #settings-page .member-info-mobile-top-actions{display:none}
          #settings-page .settings-panels{min-width:0}
          #settings-page .settings-panels [data-settings-tab]{width:100%}
          #settings-page .settings-panels .level-labels-inner{max-width:none;padding-top:0}
          #settings-page .settings-section-header{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            padding:0 0 12px;
            margin:0 0 14px;
            border-bottom:1px solid var(--group-border);
          }
          #settings-page .settings-section-left{
            display:flex;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
            min-width:0;
          }
          #settings-page .settings-section-left h3{
            margin:0;
          }
          #settings-page .settings-section-subtitle{
            margin:0;
            color:var(--muted);
            font-size:.86rem;
            font-weight:600;
          }
          #settings-page [data-settings-tab="bulk_upload"] .settings-section-left h3,
          #settings-page [data-settings-tab="delegations"] .settings-section-left h3,
          #settings-page [data-settings-tab="permissions"] .settings-section-left h3{
            margin:0;
            text-transform:uppercase;
            letter-spacing:.04em;
            font-family:var(--font-head);
            font-size:.9rem;
            color:var(--muted);
          }
          #settings-page .settings-section-right{
            display:flex;
            align-items:center;
            gap:10px;
            margin-left:auto;
          }
          #settings-page .settings-section-right .button,
          #settings-page .settings-section-left .button{
            margin:0;
          }
          #settings-page .settings-section-content{
            display:grid;
            gap:14px;
            padding-bottom:2px;
          }
          #settings-page .settings-subsection{
            border:1px solid var(--group-border);
            border-radius:12px;
            padding:12px;
            display:grid;
            gap:10px;
          }
          #settings-page .corporate-toolbar{
            display:flex;
            align-items:center;
            gap:8px;
          }
          #settings-page .corporate-pill{
            min-height:var(--button-height);
            padding:0 var(--button-pad-x);
            border-radius:12px;
            font-size:.92rem;
            line-height:1;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-group-header{
            display:grid;
            grid-template-columns:minmax(0,1fr) 42px;
            gap:10px;
            align-items:center;
          }
          #settings-page [data-settings-tab="corporate_functions"] .settings-subsection{
            border:none;
            border-radius:0;
            padding:0;
            background:transparent;
            gap:8px;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-group-pill{
            min-height:0;
            border:none;
            border-radius:0;
            background:transparent;
            display:grid;
            grid-template-columns:36px minmax(0,1fr);
            align-items:center;
            gap:10px;
            padding:0;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-group-toggle{
            border:1px solid var(--group-border);
            background:transparent;
            color:var(--muted);
            width:32px;
            min-width:32px;
            height:32px;
            border-radius:999px;
            font-weight:700;
            font-size:1rem;
            line-height:1;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-group-pill input[data-corporate-group-name]{
            min-height:40px;
            width:100%;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-category-list{
            margin-left:0;
            padding-left:0;
            border-left:none;
            position:relative;
            display:grid;
            gap:8px;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-category-list::before{
            content:"";
            position:absolute;
            left:56px;
            top:0;
            bottom:0;
            width:1px;
            background:var(--group-border);
          }
          #settings-page [data-settings-tab="corporate_functions"] .settings-section-content .corporate-function-row{
            display:grid;
            grid-template-columns:68px minmax(0,1fr) 42px;
            align-items:center;
            gap:10px;
            border-bottom:none;
          }
          #settings-page [data-settings-tab="corporate_functions"] .settings-section-content .corporate-function-row.level-row{
            border-bottom:none;
          }
          #settings-page [data-settings-tab="corporate_functions"] .settings-section-content .corporate-group-header.level-row{
            border-bottom:none;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-function-row .settings-row-main{
            grid-column:2;
            min-width:0;
            width:100%;
            display:block;
            margin-left:0;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-function-row .settings-row-actions{
            grid-column:3;
            width:42px;
            min-width:42px;
            justify-content:flex-end;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-function-row .settings-field{
            width:100%;
          }
          #settings-page [data-settings-tab="corporate_functions"] .corporate-group-actions{
            margin-left:68px;
          }
          #settings-page .settings-subsection h4{
            margin:0;
            font-family:var(--font-head);
            font-size:.8rem;
            text-transform:uppercase;
            letter-spacing:.04em;
            color:var(--muted);
          }
          #settings-page .settings-section-content .level-rows{
            display:grid;
            gap:10px;
          }
          #settings-page .settings-rates-row{
            display:block;
          }
          #settings-page .settings-rates-actions{
            display:flex;
            flex-direction:row;
            align-items:center;
            justify-content:flex-end;
            gap:8px;
            flex-wrap:nowrap;
            width:100%;
          }
          #settings-page .settings-rates-title-readonly{
            min-height:40px;
            display:flex;
            align-items:center;
            padding:0 10px;
            border:1px solid var(--input-border);
            border-radius:16px;
            background:var(--input-bg);
            color:var(--ink);
          }
          #settings-page .settings-user-action{
            margin:0;
            padding:0;
            border:none;
            background:none;
            font-size:.78rem;
            line-height:1.2;
            font-family:var(--font-body);
            font-weight:600;
            cursor:pointer;
            text-decoration:none;
          }
          #settings-page .settings-user-action.settings-user-action-secondary{
            color:var(--muted);
            max-width:74px;
            text-align:right;
          }
          #settings-page .settings-user-action.settings-user-action-danger{
            color:var(--danger);
          }
          #settings-page .settings-rates-cards{
            display:grid;
            gap:12px;
          }
          #settings-page .member-info-search-row{
            margin:0 0 10px;
          }
          #settings-page .member-info-search-row input{
            width:100%;
          }
          #settings-page .member-info-mobile-back{
            margin:0 0 10px;
          }
          #settings-page .member-info-mobile-list{
            display:grid;
            gap:10px;
          }
          #settings-page .member-info-mobile-item{
            width:100%;
            text-align:left;
            border:1px solid var(--group-border);
            border-radius:14px;
            background:color-mix(in srgb, var(--panel) 92%, var(--input-bg));
            color:var(--ink);
            padding:12px 14px;
            display:grid;
            gap:4px;
            cursor:pointer;
          }
          #settings-page .member-info-mobile-item-name{
            font-family:var(--font-head);
            font-size:1rem;
            font-weight:700;
            line-height:1.2;
          }
          #settings-page .member-info-mobile-item-sub{
            color:var(--muted);
            font-size:.86rem;
            font-weight:600;
          }
          #settings-page .member-info-empty{
            font-family:var(--font-head);
            color:var(--muted);
            font-size:.92rem;
            padding:6px 2px 0;
          }
          #settings-page .member-info-card{
            border:1px solid var(--group-border);
            border-radius:14px;
            background:color-mix(in srgb, var(--panel) 92%, var(--input-bg));
            padding:14px;
          }
          #settings-page .member-info-name{
            font-family:var(--font-head);
            font-size:1.05rem;
            font-weight:700;
            color:var(--ink);
            line-height:1.2;
          }
          #settings-page .member-info-field-label{
            font-family:var(--font-head);
            font-size:.68rem;
            font-weight:700;
            letter-spacing:.06em;
            text-transform:uppercase;
            color:var(--muted);
          }
          #settings-page .member-info-field-value{
            font-size:.95rem;
            color:var(--ink);
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }
          #settings-page .member-info-action{
            display:flex;
            flex-direction:column;
            align-items:flex-end;
            justify-content:flex-end;
            white-space:nowrap;
            gap:6px;
          }
          #settings-page .member-info-remove{
            margin:0;
            width:42px;
            min-width:42px;
            height:42px;
            padding:0;
            border:0;
            border-radius:0;
            background:transparent;
            color:var(--danger);
            line-height:1;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            opacity:.8;
          }
          #settings-page .member-info-remove svg{
            width:29px;
            height:29px;
            stroke:currentColor;
          }
          #settings-page .member-info-remove:hover,
          #settings-page .member-info-remove:focus-visible{
            color:color-mix(in srgb, var(--danger) 92%, #ff9f9f 8%);
            opacity:1;
            outline:none;
          }
          #settings-page .member-info-edit{
            margin:0;
            width:96px;
            min-width:96px;
            height:34px;
            padding:0 10px;
            font-size:.9rem;
            line-height:1;
            display:inline-flex;
            align-items:center;
            justify-content:center;
          }
          #settings-page .settings-section-content .settings-structured-row{
            display:grid;
            grid-template-columns:1fr auto;
            align-items:center;
            padding:10px 0;
            border-bottom:1px solid color-mix(in srgb, var(--group-border) 70%, transparent);
          }
          #settings-page .settings-section-content .settings-structured-row-no-label{
            grid-template-columns:minmax(0,1fr) minmax(96px,max-content);
          }
          #settings-page .settings-row-label{
            min-width:0;
            overflow:visible;
            white-space:normal;
            text-overflow:clip;
            font-family:var(--font-head);
            font-weight:700;
            color:var(--ink);
          }
          #settings-page .settings-row-main{
            min-width:0;
            width:100%;
            display:flex;
            align-items:center;
            gap:12px;
          }
          #settings-page .settings-field{
            width:100%;
            height:44px;
            padding:0 14px;
            border-radius:10px;
            border:1px solid var(--border-subtle, #d6d6d6);
            background:var(--surface-input, #f7f7f7);
            font-size:14px;
            color:inherit;
            transition:border-color 0.15s ease, background 0.15s ease;
          }
          #settings-page .settings-field:focus{
            border-color:var(--accent, #4f7cff);
            background:#ffffff;
            outline:none;
          }
          #settings-page .settings-field:hover{
            border-color:#c2c2c2;
          }
          #settings-page select.settings-field{
            appearance:none;
            -webkit-appearance:none;
            -moz-appearance:none;
            padding-right:34px;
            background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236b7280' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
            background-repeat:no-repeat;
            background-position:right 12px center;
            background-size:10px 6px;
            cursor:pointer;
          }
          #settings-page select.settings-field:disabled,
          #settings-page .settings-field:disabled{
            cursor:not-allowed;
          }
          body[data-theme="dark"] #settings-page input.settings-field,
          body[data-theme="dark"] #settings-page select.settings-field,
          body[data-theme="dark"] #settings-page textarea.settings-field{
            background-color:#1d222c;
            color:#e8eef7;
            border-color:#384150;
          }
          body[data-theme="dark"] #settings-page .settings-field::placeholder{
            color:#a8b3c4;
            opacity:1;
          }
          body[data-theme="dark"] #settings-page .settings-field:hover{
            border-color:#4a5567;
          }
          body[data-theme="dark"] #settings-page .settings-field:focus{
            background-color:#1f2631;
            border-color:#6b8ecf;
            outline:none;
          }
          body[data-theme="dark"] #settings-page select.settings-field{
            background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23cbd5e1' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
          }
          #settings-page .settings-row-main input,
          #settings-page .settings-row-main select{
            width:100%;
          }
          #settings-page .settings-row-main-split{
            display:grid;
            grid-template-columns:minmax(0,1fr) minmax(160px,230px);
            gap:10px;
            align-items:center;
          }
          #settings-page .settings-row-actions{
            display:flex;
            justify-content:flex-end;
            align-items:center;
            gap:8px;
            min-width:40px;
          }
          #settings-page .settings-structured-row-header{
            border-bottom:1px solid var(--group-border);
            padding-bottom:8px;
            margin-bottom:4px;
          }
          #settings-page .settings-structured-row-header .settings-row-label,
          #settings-page .settings-structured-row-header .settings-row-main span{
            font-family:var(--font-head);
            font-size:.74rem;
            font-weight:700;
            letter-spacing:.06em;
            text-transform:uppercase;
            color:var(--muted);
          }
          #settings-page .settings-structured-row-header .settings-row-actions{
            pointer-events:none;
          }
          #settings-page .settings-row-actions .expense-toggle{
            min-width:0;
          }
          #settings-page .settings-row-delete-icon{
            width:42px;
            min-width:42px;
            height:42px;
            padding:0;
            border:0;
            border-radius:0;
            background:transparent;
            color:var(--danger);
            display:inline-flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            opacity:.8;
            transition:opacity 0.15s ease;
          }
          #settings-page [data-settings-tab="levels"] .settings-structured-row{
            display:grid;
            grid-template-columns:120px 1fr 220px 40px;
            align-items:center;
            column-gap:16px;
            padding:10px 0;
            border-bottom:1px solid color-mix(in srgb, var(--group-border) 70%, transparent);
          }
          #settings-page [data-settings-tab="levels"] .settings-row-main{
            display:contents;
          }
          #settings-page [data-settings-tab="levels"] .settings-field{
            width:100%;
            height:40px;
            border-radius:8px;
          }
          #settings-page [data-settings-tab="levels"] .settings-row-delete-icon{
            justify-self:end;
            align-self:center;
          }
          #settings-page [data-settings-tab="levels"] .settings-structured-row-header{
            display:grid;
            grid-template-columns:120px 1fr 220px 40px;
            column-gap:16px;
          }
          #settings-page .settings-row-delete-icon svg{
            width:29px;
            height:29px;
            stroke:currentColor;
          }
          #settings-page .settings-row-delete-icon:hover,
          #settings-page .settings-row-delete-icon:focus-visible{
            color:color-mix(in srgb, var(--danger) 92%, #ff9f9f 8%);
            opacity:1;
            outline:none;
          }
          #settings-page .settings-section-content .table-wrapper{
            margin:0;
          }
          #settings-page .settings-section-content .level-labels-actions{
            margin-top:0;
          }
          #settings-page .perms-matrix{
            width:100%;
            table-layout:fixed;
          }
          #settings-page .perms-matrix th:first-child{
            width:38%;
          }
          #settings-page .perms-matrix th[scope="col"]:not(:first-child),
          #settings-page .perms-matrix td{
            text-align:center;
            vertical-align:middle;
          }
          #settings-page .perms-matrix thead th{
            text-transform:uppercase;
            letter-spacing:.04em;
            padding-bottom:14px;
          }
          #settings-page .perms-matrix tbody tr:first-child th,
          #settings-page .perms-matrix tbody tr:first-child td{
            padding-top:14px;
          }
          #settings-page .perms-matrix th[scope="row"]{
            white-space:normal;
            line-height:1.35;
            text-align:right;
          }
          #settings-page [data-settings-tab="permissions"] .perms-matrix thead th:first-child{
            text-align:left;
            padding-left:14px;
          }
          #settings-page [data-settings-tab="permissions"] .perms-matrix th[scope="row"]{
            text-align:left;
            padding-left:14px;
          }
          #settings-page .perm-switch{
            position:relative;
            display:inline-flex;
            width:42px;
            height:24px;
          }
          #settings-page .perm-switch input{
            position:absolute;
            width:1px;
            height:1px;
            opacity:0;
            pointer-events:none;
          }
          #settings-page .perm-switch-track{
            width:100%;
            height:100%;
            border-radius:999px;
            border:1px solid var(--panel-border);
            background:color-mix(in srgb, var(--danger) 10%, var(--panel));
            position:relative;
            transition:background 140ms ease,border-color 140ms ease,opacity 140ms ease;
          }
          #settings-page .perm-switch-track::after{
            content:"";
            position:absolute;
            top:2px;
            left:2px;
            width:18px;
            height:18px;
            border-radius:50%;
            background:var(--ink);
            opacity:.45;
            transition:transform 140ms ease,opacity 140ms ease,background 140ms ease;
          }
          #settings-page .perm-switch input:checked + .perm-switch-track{
            background:color-mix(in srgb, #39a96b 20%, var(--panel));
            border-color:color-mix(in srgb, #39a96b 55%, var(--panel-border));
          }
          #settings-page .perm-switch input:checked + .perm-switch-track::after{
            transform:translateX(18px);
            opacity:1;
            background:#2f9d57;
          }
          #settings-page .perm-switch.is-locked .perm-switch-track{
            opacity:.65;
          }
          @media (max-width: 980px){
            #settings-page .settings-layout{grid-template-columns:1fr;gap:14px}
            #settings-page .settings-nav-shell,
            #settings-page .settings-content-shell{
              height:auto;
              max-height:calc(100vh - 150px);
              overflow:auto;
              padding:12px;
              border:none;
              border-radius:0;
              background:transparent;
              box-shadow:none;
            }
            #settings-page.settings-mobile-list .settings-content-shell{display:none}
            #settings-page.settings-mobile-detail .settings-nav-shell{display:none}
            #settings-page .settings-mobile-back{
              display:inline-flex;
              margin:0;
            }
            #settings-page .member-info-mobile-top-actions{
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:8px;
              margin:0 0 10px;
            }
            #settings-page .settings-tab-group + .settings-tab-group{margin-top:10px}
            #settings-page .settings-section-header{
              gap:8px;
              margin:0 0 12px;
              padding:0 0 10px;
            }
            #settings-page .settings-section-right{
              gap:8px;
              flex-wrap:wrap;
              justify-content:flex-end;
            }
            #settings-page .settings-section-right .button,
            #settings-page .settings-section-left .button{
              min-height:34px;
              height:34px;
              padding:0 10px;
              font-size:.82rem;
            }
            #settings-page .settings-section-content .settings-structured-row{
              grid-template-columns:minmax(120px,.9fr) minmax(0,1fr) minmax(84px,max-content);
              gap:8px;
            }
            #settings-page .settings-section-content .settings-structured-row-no-label{
              grid-template-columns:minmax(0,1fr) minmax(84px,max-content);
            }
            #settings-page .settings-rates-row{
              display:grid;
              grid-template-columns:minmax(0,1fr) auto;
              gap:8px;
              align-items:center;
            }
            #settings-page .settings-row-actions{
              width:auto;
              justify-content:flex-end;
              flex-wrap:wrap;
            }
            #settings-page .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(140px,200px);
            }
          }
          @media (max-width: 720px){
            #settings-page .level-labels-inner{
              padding-left:8px;
              padding-right:8px;
            }
            #settings-page .settings-section-content{
              gap:10px;
            }
            #settings-page .settings-section-content .settings-structured-row{
              grid-template-columns:minmax(104px,.8fr) minmax(0,1fr) minmax(76px,max-content);
              gap:8px;
            }
            #settings-page .settings-section-content .settings-structured-row-no-label{
              grid-template-columns:minmax(0,1fr) minmax(76px,max-content);
            }
            #settings-page .settings-rates-row{
              grid-template-columns:minmax(0,1fr) auto;
            }
            #settings-page .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(116px,156px);
              gap:8px;
            }
            #settings-page .settings-row-actions .button{
              min-height:32px;
              height:32px;
              padding:0 9px;
              font-size:.8rem;
            }
            #settings-page [data-settings-tab="levels"] .settings-structured-row{
              grid-template-columns:64px minmax(0,1fr) 30px;
              gap:4px;
              padding-left:0;
              padding-right:0;
            }
            #settings-page [data-settings-tab="levels"] .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(82px,112px);
              gap:4px;
            }
            #settings-page [data-settings-tab="levels"] .settings-row-actions{
              justify-content:flex-end;
            }
            #settings-page [data-settings-tab="levels"] .settings-row-delete-icon{
              width:42px;
              min-width:42px;
              height:42px;
            }
            #settings-page [data-settings-tab="levels"] .level-col{
              display:none;
            }
            #settings-page [data-settings-tab="levels"] .settings-structured-row{
              grid-template-columns:minmax(0,1fr) 30px;
            }
            #settings-page [data-settings-tab="levels"] .settings-structured-row .settings-row-main{
              grid-column:1;
            }
            #settings-page [data-settings-tab="levels"] .settings-structured-row .settings-row-actions{
              grid-column:2;
            }
            #settings-page [data-settings-tab="levels"] .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(98px,132px);
            }
            #settings-page [data-settings-tab="locations"] .settings-structured-row-no-label{
              grid-template-columns:minmax(0,1fr) 28px;
              gap:4px;
              padding-left:0;
              padding-right:0;
            }
            #settings-page [data-settings-tab="locations"] .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(94px,126px);
              gap:4px;
            }
            #settings-page [data-settings-tab="locations"] .settings-row-actions{
              justify-content:flex-start;
            }
            #settings-page [data-settings-tab="locations"] .settings-row-delete-icon{
              width:39px;
              min-width:39px;
              height:39px;
            }
          }
        `;
      document.head.appendChild(style);
    }

    const canDelegate = state.permissions?.can_delegate;
    if (canDelegate) {
      const tabsContainer = document.querySelector("#settings-page .settings-tabs");
      const panelsContainer = document.querySelector("#settings-page .settings-panels") || settingsPage;
      if (tabsContainer && panelsContainer) {
        let delegationsBtn = tabsContainer.querySelector('[data-settings-tab-button="delegations"]');
        if (!delegationsBtn) {
          delegationsBtn = document.createElement("button");
          delegationsBtn.className = "settings-tab catalog-item";
          delegationsBtn.type = "button";
          delegationsBtn.dataset.settingsTabButton = "delegations";
          delegationsBtn.textContent = "Delegations";
          tabsContainer.appendChild(delegationsBtn);
          delegationsBtn.addEventListener("click", function (event) {
            event.preventDefault();
            setActiveSettingsTab("delegations", { fromUser: true });
          });
        }
        let delegationsPanel = panelsContainer.querySelector('[data-settings-tab="delegations"]');
        if (!delegationsPanel) {
          delegationsPanel = document.createElement("div");
          delegationsPanel.dataset.settingsTab = "delegations";
          delegationsPanel.className = "settings-panel";
          panelsContainer.appendChild(delegationsPanel);
        }
      }
    }

    const canUploadData = state.permissions?.can_upload_data;
    if (canUploadData) {
      const tabsContainer = document.querySelector("#settings-page .settings-tabs");
      const panelsContainer = document.querySelector("#settings-page .settings-panels") || settingsPage;
      if (tabsContainer && panelsContainer) {
        let bulkBtn = tabsContainer.querySelector('[data-settings-tab-button="bulk_upload"]');
        if (!bulkBtn) {
          bulkBtn = document.createElement("button");
          bulkBtn.className = "settings-tab catalog-item";
          bulkBtn.type = "button";
          bulkBtn.dataset.settingsTabButton = "bulk_upload";
          bulkBtn.textContent = "Bulk Upload";
          tabsContainer.appendChild(bulkBtn);
          bulkBtn.addEventListener("click", function (event) {
            event.preventDefault();
            setActiveSettingsTab("bulk_upload", { fromUser: true });
          });
        }
        let bulkPanel = panelsContainer.querySelector('[data-settings-tab="bulk_upload"]');
        if (!bulkPanel) {
          bulkPanel = document.createElement("div");
          bulkPanel.dataset.settingsTab = "bulk_upload";
          bulkPanel.className = "settings-panel";
          panelsContainer.appendChild(bulkPanel);
        }
      }
    }

    const canManageCorporateFunctions = state.permissions?.manage_corporate_functions;
    if (canManageCorporateFunctions) {
      const tabsContainer = document.querySelector("#settings-page .settings-tabs");
      const panelsContainer = document.querySelector("#settings-page .settings-panels") || settingsPage;
      if (tabsContainer && panelsContainer) {
        let corpBtn = tabsContainer.querySelector('[data-settings-tab-button="corporate_functions"]');
        if (!corpBtn) {
          corpBtn = document.createElement("button");
          corpBtn.className = "settings-tab catalog-item";
          corpBtn.type = "button";
          corpBtn.dataset.settingsTabButton = "corporate_functions";
          corpBtn.textContent = "Corporate Functions";
          tabsContainer.appendChild(corpBtn);
          corpBtn.addEventListener("click", function (event) {
            event.preventDefault();
            setActiveSettingsTab("corporate_functions", { fromUser: true });
          });
        }
        let corpPanel = panelsContainer.querySelector('[data-settings-tab="corporate_functions"]');
        if (!corpPanel) {
          corpPanel = document.createElement("div");
          corpPanel.dataset.settingsTab = "corporate_functions";
          corpPanel.className = "settings-panel";
          panelsContainer.appendChild(corpPanel);
        }
      }
    }

    // Ensure permissions tab exists for superusers
    const canManageSettingsAccess = state.permissions?.manage_settings_access;
    if (canManageSettingsAccess) {
      const tabsContainer = document.querySelector("#settings-page .settings-tabs");
      const panelsContainer = document.querySelector("#settings-page .settings-panels") || settingsPage;
      if (tabsContainer && panelsContainer) {
        let permBtn = tabsContainer.querySelector('[data-settings-tab-button="permissions"]');
        if (!permBtn) {
          permBtn = document.createElement("button");
          permBtn.className = "settings-tab catalog-item";
          permBtn.type = "button";
          permBtn.dataset.settingsTabButton = "permissions";
          permBtn.textContent = "Member access levels";
          tabsContainer.appendChild(permBtn);
          permBtn.addEventListener("click", function (event) {
            event.preventDefault();
            setActiveSettingsTab("permissions", { fromUser: true });
          });
        }
        let permPanel = panelsContainer.querySelector('[data-settings-tab="permissions"]');
        if (!permPanel) {
          permPanel = document.createElement("div");
          permPanel.dataset.settingsTab = "permissions";
          permPanel.className = "settings-panel";
          panelsContainer.appendChild(permPanel);
        }
      }
    }
    arrangeSettingsSectionHeaders();
    if (!isMobileSettingsLayout()) {
      mobileSettingsMode = "list";
    }
    applyMobileSettingsLayout();
    initSettingsTabs();
    renderDelegationsTab();
    renderBulkUploadTab();
    renderCorporateFunctionCategories();
    renderPermissionsMatrix();
  }

  function renderCorporateFunctionCategories() {
    const { state, escapeHtml } = deps();
    const panel = document.querySelector('[data-settings-tab="corporate_functions"]');
    if (!panel || !state.permissions?.manage_corporate_functions) return;
    const groups = Array.isArray(state.corporateFunctionGroups)
      ? state.corporateFunctionGroups.slice().sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0))
      : [];
    const categories = Array.isArray(state.corporateFunctionCategories)
      ? state.corporateFunctionCategories.slice().sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0))
      : [];
    const editable = Boolean(state.permissions?.manage_corporate_functions);
    const groupIdSet = new Set(groups.map((group) => `${group?.id || ""}`.trim()).filter(Boolean));
    collapsedCorporateGroupIds = new Set(
      Array.from(collapsedCorporateGroupIds).filter((id) => groupIdSet.has(id))
    );

    const groupHtml = groups.map((group) => {
      const groupId = `${group?.id || ""}`.trim();
      const groupName = `${group?.name || ""}`.trim();
      const groupSortOrder = Number(group?.sortOrder) || 0;
      const isCollapsed = collapsedCorporateGroupIds.has(groupId);
      const rows = categories
        .filter((item) => `${item?.groupId || ""}`.trim() === groupId)
        .map((item) => {
          const id = `${item?.id || ""}`.trim();
          const sortOrder = Number(item?.sortOrder) || 0;
          return `
            <div
              class="level-row settings-structured-row settings-structured-row-no-label corporate-function-row"
              data-corporate-function-id="${escapeHtml(id)}"
              data-corporate-function-sort-order="${escapeHtml(sortOrder)}"
            >
              <div class="settings-row-main">
                <input
                  class="settings-field"
                  type="text"
                  value="${escapeHtml(item?.name || "")}"
                  data-corporate-function-name
                  placeholder="Category name"
                  ${editable ? "" : "disabled"}
                />
              </div>
              <div class="settings-row-actions expense-actions">
                <button
                  type="button"
                  class="settings-row-delete-icon"
                  data-corporate-delete-category="${escapeHtml(id)}"
                  aria-label="Delete category"
                  ${editable ? "" : "disabled"}
                >
                  ${SETTINGS_DELETE_ICON}
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section
          class="settings-subsection"
          data-corporate-group-row
          data-corporate-group-id="${escapeHtml(groupId)}"
          data-corporate-group-sort-order="${escapeHtml(groupSortOrder)}"
        >
          <div class="corporate-group-header">
            <div class="corporate-group-pill">
              <button
                type="button"
                class="corporate-group-toggle"
                data-corporate-toggle-group="${escapeHtml(groupId)}"
                aria-label="${isCollapsed ? "Expand group" : "Collapse group"}"
                aria-expanded="${isCollapsed ? "false" : "true"}"
              >${isCollapsed ? "+" : "-"}</button>
              <input
                class="settings-field"
                type="text"
                value="${escapeHtml(groupName)}"
                data-corporate-group-name
                placeholder="Group name"
                ${editable ? "" : "disabled"}
              />
            </div>
            <button
              type="button"
              class="settings-row-delete-icon"
              data-corporate-delete-group="${escapeHtml(groupId)}"
              aria-label="Delete group"
              ${editable ? "" : "disabled"}
            >
              ${SETTINGS_DELETE_ICON}
            </button>
          </div>
          <div class="corporate-category-list" ${isCollapsed ? "hidden" : ""}>
            ${rows || ""}
          </div>
          <div class="corporate-group-actions" ${isCollapsed ? "hidden" : ""}>
            <button
              class="button button-ghost"
              type="button"
              data-corporate-add-category="${escapeHtml(groupId)}"
              ${editable ? "" : "disabled"}
            >
              Add category
            </button>
          </div>
        </section>
      `;
    }).join("");

    panel.innerHTML = `
      <form id="corporate-functions-form" class="level-labels-form">
        <div class="level-labels-inner">
          <div class="settings-section-header">
            <div class="settings-section-left">
              <h3>Corporate Functions</h3>
              <p class="settings-section-subtitle">Internal / non-client work</p>
            </div>
            <div class="settings-section-right corporate-toolbar">
              <button class="button button-ghost corporate-pill" type="button" data-corporate-add-group ${editable ? "" : "disabled"}>Add group</button>
              <button class="button corporate-pill" type="submit" id="save-corporate-functions" ${editable ? "" : "disabled"}>Save</button>
            </div>
          </div>
          <div class="settings-section-content">
            ${groupHtml || `<p class="settings-section-subtitle">No groups yet. Add a group to begin.</p>`}
          </div>
        </div>
      </form>
    `;
    panel.onclick = function (event) {
      const toggleBtn = event.target.closest("[data-corporate-toggle-group]");
      if (!toggleBtn) return;
      event.preventDefault();
      const groupId = `${toggleBtn.dataset.corporateToggleGroup || ""}`.trim();
      if (!groupId) return;
      if (collapsedCorporateGroupIds.has(groupId)) {
        collapsedCorporateGroupIds.delete(groupId);
      } else {
        collapsedCorporateGroupIds.add(groupId);
      }
      renderCorporateFunctionCategories();
    };
  }

  function renderBulkUploadTab() {
    const panel = document.querySelector('[data-settings-tab="bulk_upload"]');
    const { state, escapeHtml } = deps();
    if (!panel || !state.permissions?.can_upload_data) return;
    panel.innerHTML = `
      <div class="settings-section-header">
        <div class="settings-section-left">
          <h3>Bulk Upload</h3>
        </div>
        <div class="settings-section-right" id="bulk-upload-header-actions">
          <button type="button" class="button" id="bulk-upload-time-open">Upload Time</button>
          <button type="button" class="button" id="bulk-upload-expenses-open">Upload Expenses</button>
        </div>
      </div>
      <div class="settings-section-content">
        <p id="bulk-upload-description">Upload time or expense data using a template.</p>
        <div class="panel-head-actions" id="bulk-upload-template-actions">
          <button type="button" class="button button-ghost" id="bulk-download-time-template">Download Time Template</button>
          <button type="button" class="button button-ghost" id="bulk-download-expenses-template">Download Expense Template</button>
        </div>
        <input type="file" id="bulk-upload-time-file" accept=".csv,.xlsx" hidden />
        <input type="file" id="bulk-upload-expenses-file" accept=".csv,.xlsx" hidden />
        <p id="bulk-upload-error" class="feedback" hidden></p>
        <div id="bulk-upload-preview" hidden>
          <p id="bulk-upload-selected-file"></p>
          <div id="bulk-upload-preview-table-wrap">Preview coming next</div>
        </div>
        <div id="bulk-upload-rejects" class="panel-head-actions" hidden>
          <p id="bulk-upload-rejects-text" class="feedback" style="margin:0;"></p>
          <button type="button" class="button button-ghost" id="bulk-upload-download-rejects">
            Download Rejected Entries
          </button>
        </div>
      </div>
    `;

    const openTimeBtn = panel.querySelector("#bulk-upload-time-open");
    const openExpensesBtn = panel.querySelector("#bulk-upload-expenses-open");
    const downloadTimeTemplateBtn = panel.querySelector("#bulk-download-time-template");
    const downloadExpensesTemplateBtn = panel.querySelector("#bulk-download-expenses-template");
    const timeInput = panel.querySelector("#bulk-upload-time-file");
    const expensesInput = panel.querySelector("#bulk-upload-expenses-file");
    const preview = panel.querySelector("#bulk-upload-preview");
    const descriptionEl = panel.querySelector("#bulk-upload-description");
    const templateActions = panel.querySelector("#bulk-upload-template-actions");
    const selectedFileLabel = panel.querySelector("#bulk-upload-selected-file");
    const errorEl = panel.querySelector("#bulk-upload-error");
    const previewTableWrap = panel.querySelector("#bulk-upload-preview-table-wrap");
    const rejectsWrap = panel.querySelector("#bulk-upload-rejects");
    const rejectsText = panel.querySelector("#bulk-upload-rejects-text");
    const downloadRejectsBtn = panel.querySelector("#bulk-upload-download-rejects");
    let xlsxLoader = null;
    let previewKind = "";
    let latestPreviewPayload = null;
    let latestRejectedRows = [];
    let latestRejectedKind = "";
    let latestImportSummary = null;

    const formatRowCount = function (count, singular, plural) {
      const qty = Number(count) || 0;
      return `${qty} ${qty === 1 ? singular : plural}`;
    };

    const previewValidRowCount = function () {
      const rows = Array.isArray(latestPreviewPayload?.objects) ? latestPreviewPayload.objects : [];
      return rows.reduce((count, row) => {
        const status = `${row?.status || ""}`.trim().toLowerCase();
        return count + (status === "valid" ? 1 : 0);
      }, 0);
    };

    const updateBulkUploadUiState = function () {
      const hasPreview = !preview?.hidden;
      const rejectedCount = Array.isArray(latestRejectedRows) ? latestRejectedRows.length : 0;
      const hasImportSummary =
        latestImportSummary &&
        Number.isFinite(latestImportSummary.successCount) &&
        Number.isFinite(latestImportSummary.rejectedCount);
      const hasRejects = rejectedCount > 0;
      if (descriptionEl) {
        descriptionEl.hidden = hasPreview || hasRejects || hasImportSummary;
      }
      if (templateActions) {
        templateActions.hidden = hasPreview || hasRejects || hasImportSummary;
      }
      if (openTimeBtn && openExpensesBtn) {
        if (!hasPreview) {
          openTimeBtn.textContent = "Upload Time";
          openTimeBtn.classList.remove("button-ghost");
          openTimeBtn.disabled = false;
          openTimeBtn.dataset.mode = "upload-time";
          openTimeBtn.hidden = false;
          openExpensesBtn.textContent = "Upload Expenses";
          openExpensesBtn.classList.remove("button-ghost");
          openExpensesBtn.disabled = false;
          openExpensesBtn.dataset.mode = "upload-expenses";
          openExpensesBtn.hidden = false;
        } else if (previewKind === "time") {
          const validCount = previewValidRowCount();
          openTimeBtn.textContent = "Import Valid Time Rows";
          openTimeBtn.classList.remove("button-ghost");
          openTimeBtn.disabled = validCount === 0;
          openTimeBtn.dataset.mode = "import-time";
          openTimeBtn.hidden = false;
          openExpensesBtn.textContent = "Upload Another Time File";
          openExpensesBtn.classList.add("button-ghost");
          openExpensesBtn.disabled = false;
          openExpensesBtn.dataset.mode = "upload-another-time";
          openExpensesBtn.hidden = false;
        } else if (previewKind === "expenses") {
          const validCount = previewValidRowCount();
          openTimeBtn.textContent = "Import Valid Expense Rows";
          openTimeBtn.classList.remove("button-ghost");
          openTimeBtn.disabled = validCount === 0;
          openTimeBtn.dataset.mode = "import-expenses";
          openTimeBtn.hidden = false;
          openExpensesBtn.textContent = "Upload Another Expense File";
          openExpensesBtn.classList.add("button-ghost");
          openExpensesBtn.disabled = false;
          openExpensesBtn.dataset.mode = "upload-another-expenses";
          openExpensesBtn.hidden = false;
        } else {
          openExpensesBtn.textContent = "Upload Expenses";
          openExpensesBtn.classList.remove("button-ghost");
          openExpensesBtn.disabled = false;
          openExpensesBtn.dataset.mode = "upload-expenses";
          openTimeBtn.hidden = previewKind !== "time";
          openExpensesBtn.hidden = previewKind !== "expenses";
        }
      }
      if (rejectsWrap) {
        const showRejects = rejectedCount > 0 || hasImportSummary;
        rejectsWrap.hidden = !showRejects;
        if (rejectsText) {
          if (!showRejects) {
            rejectsText.textContent = "";
          } else if (hasImportSummary) {
            rejectsText.textContent = `${formatRowCount(
              latestImportSummary.successCount,
              "row uploaded successfully",
              "rows uploaded successfully"
            )} / ${formatRowCount(
              latestImportSummary.rejectedCount,
              "row was rejected",
              "rows were rejected"
            )}`;
          } else {
            rejectsText.textContent = `${rejectedCount} row${rejectedCount === 1 ? "" : "s"} were rejected.`;
          }
        }
        if (downloadRejectsBtn) {
          downloadRejectsBtn.hidden = rejectedCount <= 0;
        }
      }
    };

    const showError = function (message) {
      if (!errorEl) return;
      errorEl.hidden = !message;
      errorEl.textContent = message || "";
    };

    const parseCsvLine = function (line) {
      const result = [];
      let value = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            value += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (char === "," && !inQuotes) {
          result.push(value);
          value = "";
          continue;
        }
        value += char;
      }
      result.push(value);
      return result;
    };

    const EXPECTED_HEADERS = {
      time: ["member", "client", "project", "date", "hours", "billable", "notes"],
      expenses: ["member", "client", "project", "category", "date", "amount", "billable", "notes"],
    };

    const normalizeHeader = function (value) {
      const key = `${value ?? ""}`.trim().toLowerCase();
      if (key === "user" || key === "employee") return "member";
      return key;
    };

    const excelSerialToIsoDate = function (serial) {
      const num = Number(serial);
      if (!Number.isFinite(num) || num <= 0 || num >= 100000) return "";
      const excelEpochUtc = Date.UTC(1899, 11, 30);
      const millis = excelEpochUtc + Math.round(num * 86400000);
      const date = new Date(millis);
      if (Number.isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 10);
    };

    const normalizeDateValue = function (value) {
      if (value == null || `${value}`.trim() === "") return "";
      if (typeof value === "number") {
        const iso = excelSerialToIsoDate(value);
        return iso || "";
      }
      const text = `${value}`.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      if (/^\d+(\.\d+)?$/.test(text)) {
        const iso = excelSerialToIsoDate(Number(text));
        if (iso) return iso;
      }
      const mdY = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (mdY) {
        const mm = mdY[1].padStart(2, "0");
        const dd = mdY[2].padStart(2, "0");
        return `${mdY[3]}-${mm}-${dd}`;
      }
      const ymd = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (ymd) {
        const mm = ymd[2].padStart(2, "0");
        const dd = ymd[3].padStart(2, "0");
        return `${ymd[1]}-${mm}-${dd}`;
      }
      const parsedMillis = Date.parse(text);
      if (Number.isFinite(parsedMillis)) {
        const parsed = new Date(parsedMillis);
        const year = parsed.getUTCFullYear();
        if (year >= 1900 && year <= 2100) {
          return parsed.toISOString().slice(0, 10);
        }
      }
      return text;
    };

    const normalizeBillableValue = function (value) {
      const text = `${value ?? ""}`.trim().toLowerCase();
      if (["yes", "true", "1"].includes(text)) return true;
      if (["no", "false", "0"].includes(text)) return false;
      return "";
    };

    const normalizeRows = function (rows2d, kind) {
      const users = Array.isArray(state.users) ? state.users : [];
      const clients = Array.isArray(state.clients) ? state.clients : [];
      const projects = Array.isArray(state.projects) ? state.projects : [];
      const rows = Array.isArray(rows2d) ? rows2d : [];
      const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
      const headers = headerRow.map(normalizeHeader).filter(Boolean);
      const expectedHeaders = EXPECTED_HEADERS[kind] || EXPECTED_HEADERS.time;
      const isExactHeaderMatch =
        headers.length === expectedHeaders.length &&
        headers.every((header, index) => header === expectedHeaders[index]);
      if (!isExactHeaderMatch) {
        throw new Error("INVALID_TEMPLATE");
      }
      const dataRows = rows
        .slice(1)
        .filter((row) => Array.isArray(row) && row.some((cell) => `${cell ?? ""}`.trim() !== ""));
      const objects = dataRows.map((row) => {
        const item = {};
        let rowStatus = "Valid";
        const rowErrors = [];
        headers.forEach((header, index) => {
          const raw = row[index] ?? "";
          item._raw = item._raw || {};
          item._raw[header] = `${raw ?? ""}`.trim();
          if (header === "date") {
            item[header] = normalizeDateValue(raw);
            return;
          }
          if (header === "billable") {
            const normalizedBillable = normalizeBillableValue(raw);
            const rawText = `${raw ?? ""}`.trim();
            const isInvalidBillable = (kind === "time" || kind === "expenses") && rawText !== "" && normalizedBillable === "";
            if (isInvalidBillable) {
              rowStatus = "Invalid";
              rowErrors.push(`Invalid billable value: ${rawText}`);
              item[header] = rawText;
              return;
            }
            item[header] = normalizedBillable;
            return;
          }
          if (header === "hours") {
            const amount = Number(raw);
            item[header] = Number.isFinite(amount) ? amount : "";
            return;
          }
          if (header === "amount") {
            const amount = Number(raw);
            item[header] = Number.isFinite(amount) ? amount : "";
            return;
          }
          item[header] = `${raw ?? ""}`.trim();
        });
        if (kind === "time" || kind === "expenses") {
          const memberName = `${item.member || ""}`.trim().toLowerCase();
          const clientName = `${item.client || ""}`.trim().toLowerCase();
          const projectName = `${item.project || ""}`.trim().toLowerCase();
          const clientLabel = `${item.client || ""}`.trim();
          const projectLabel = `${item.project || ""}`.trim();
          const matchedUser =
            users.find((user) => `${user.name || user.displayName || ""}`.trim().toLowerCase() === memberName) ||
            users.find((user) => `${user.username || ""}`.trim().toLowerCase() === memberName) ||
            null;
          const matchedClient =
            clients.find((client) => `${client.name || ""}`.trim().toLowerCase() === clientName) || null;
          const matchedProject =
            matchedClient &&
            projects.find(
              (project) =>
                `${project.client || ""}`.trim().toLowerCase() === `${matchedClient.name || ""}`.trim().toLowerCase() &&
                `${project.name || ""}`.trim().toLowerCase() === projectName
            );
          if (!matchedUser) {
            rowStatus = "Invalid";
            rowErrors.push("Member not found.");
          } else {
            item._resolvedUserId = matchedUser.id;
            item._resolvedUserName =
              `${matchedUser.displayName || matchedUser.name || matchedUser.username || ""}`.trim();
          }
          if (!matchedProject) {
            rowStatus = "Invalid";
            rowErrors.push("Client/project not found.");
          } else {
            item._resolvedProjectId = matchedProject.id;
            item._resolvedClientName = `${matchedClient?.name || item.client || ""}`.trim();
            item._resolvedProjectName = `${matchedProject?.name || item.project || ""}`.trim();
          }
          if (matchedUser && matchedProject) {
            const role = typeof deps().roleKey === "function" ? deps().roleKey(matchedUser) : "";
            const managerClientAccess =
              typeof deps().managerClientAssignments === "function" &&
              deps()
                .managerClientAssignments(matchedUser.id)
                .some((item) => `${item.client || ""}`.trim().toLowerCase() === clientName);
            const managerProjectAccess =
              typeof deps().managerProjectAssignments === "function" &&
              deps()
                .managerProjectAssignments(matchedUser.id)
                .some(
                  (item) =>
                    `${item.client || ""}`.trim().toLowerCase() === clientName &&
                    `${item.project || ""}`.trim().toLowerCase() === projectName
                );
            const isAssigned =
              (typeof deps().isAdmin === "function" && deps().isAdmin(matchedUser)) ||
              role === "executive" ||
              managerClientAccess ||
              managerProjectAccess ||
              (typeof deps().isUserAssignedToProject === "function" &&
                deps().isUserAssignedToProject(matchedUser.id, clientLabel, projectLabel));
            if (!isAssigned) {
              rowStatus = "Invalid";
              rowErrors.push("Member not assigned to client/project.");
            }
          }
          item.status = rowStatus;
          item.error = rowErrors.join(" ");
        }
        return item;
      });
      return { headers, objects };
    };

    const renderPreviewTable = function (headers, objects, kind) {
      if (!preview || !selectedFileLabel || !previewTableWrap) return;
      const rows = (Array.isArray(objects) ? objects : []).slice(0, 25);
      const previewHeaders =
        kind === "time" || kind === "expenses" ? [...headers, "status", "error"] : headers;
      if (!previewHeaders.length) {
        previewTableWrap.innerHTML = `<div class="empty-state-panel">Preview coming next</div>`;
        return;
      }
      const headHtml = previewHeaders
        .map(
          (header) =>
            `<th style="padding:8px 10px;border:1px solid var(--group-border);text-align:left;white-space:nowrap;">${escapeHtml(
              header
            )}</th>`
        )
        .join("");
      const formatPreviewValue = function (header, value) {
        if (header === "date") {
          return `${value || ""}`;
        }
        if (header === "billable") {
          if (value === true) return "Yes";
          if (value === false) return "No";
          return "";
        }
        if (header === "hours") {
          if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
          return "";
        }
        if (header === "amount") {
          if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
          return "";
        }
        if (header === "status") {
          return value === "Invalid" ? "Invalid" : "Valid";
        }
        if (header === "error") {
          return `${value || ""}`;
        }
        return `${value ?? ""}`;
      };
      const bodyHtml = rows.length
        ? rows
            .map(
              (row) =>
                `<tr>${previewHeaders
                  .map(
                    (header) =>
                      `<td style="padding:8px 10px;border:1px solid var(--group-border);vertical-align:top;">${escapeHtml(
                        formatPreviewValue(header, row[header])
                      )}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")
        : `<tr><td colspan="${previewHeaders.length}" style="padding:8px 10px;border:1px solid var(--group-border);">No data rows found.</td></tr>`;
      previewTableWrap.innerHTML = `
        <div class="table-wrapper">
          <table class="table" style="width:100%;border-collapse:collapse;table-layout:auto;">
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
      `;
    };

    const ensureXlsx = async function () {
      if (window.XLSX) return window.XLSX;
      if (!xlsxLoader) {
        xlsxLoader = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
          script.onload = function () {
            resolve(window.XLSX || null);
          };
          script.onerror = function () {
            reject(new Error("XLSX loader failed"));
          };
          document.head.appendChild(script);
        });
      }
      return xlsxLoader;
    };

    const parseFile = async function (file, kind) {
      const name = `${file?.name || ""}`.trim().toLowerCase();
      if (name.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
        return normalizeRows(lines.map(parseCsvLine), kind);
      }
      if (name.endsWith(".xlsx")) {
        const XLSX = await ensureXlsx();
        if (!XLSX) throw new Error("XLSX unavailable");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames?.[0];
        const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        return normalizeRows(rows2d, kind);
      }
      throw new Error("Unsupported file type");
    };

    const toCsvCell = function (value) {
      const text = `${value ?? ""}`;
      if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const downloadRejectsCsv = function (rows, kind) {
      const rejectRows = Array.isArray(rows) ? rows : [];
      if (!rejectRows.length) return;
      const templateColumns = (EXPECTED_HEADERS[kind] || EXPECTED_HEADERS.time).slice();
      const columns = [...templateColumns, "error"];
      const lines = [columns.join(",")];
      rejectRows.forEach((row) => {
        const raw = row?._raw || {};
        const values =
          kind === "expenses"
            ? [
                raw.member ?? row.member ?? "",
                raw.client ?? row.client ?? "",
                raw.project ?? row.project ?? "",
                raw.category ?? row.category ?? "",
                raw.date ?? row.date ?? "",
                raw.amount ?? row.amount ?? "",
                raw.billable ?? row.billable ?? "",
                raw.notes ?? row.notes ?? "",
                row.error ?? "",
              ]
            : [
                raw.member ?? row.member ?? "",
                raw.client ?? row.client ?? "",
                raw.project ?? row.project ?? "",
                raw.date ?? row.date ?? "",
                raw.hours ?? row.hours ?? "",
                raw.billable ?? row.billable ?? "",
                raw.notes ?? row.notes ?? "",
                row.error ?? "",
              ];
        lines.push(values.map(toCsvCell).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = kind === "expenses" ? "expense-upload-rejects.csv" : "time-upload-rejects.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    };

    const setRejectedRows = function (rows, kind = "") {
      latestRejectedRows = Array.isArray(rows) ? rows : [];
      latestRejectedKind = kind || latestRejectedKind || "";
      updateBulkUploadUiState();
    };

    const resetBulkUploadState = function () {
      latestPreviewPayload = null;
      latestImportSummary = null;
      latestRejectedRows = [];
      latestRejectedKind = "";
      previewKind = "";
      if (preview) {
        preview.hidden = true;
      }
      if (previewTableWrap) {
        previewTableWrap.innerHTML = `<div class="empty-state-panel">Preview coming next</div>`;
      }
      if (selectedFileLabel) {
        selectedFileLabel.textContent = "";
      }
      if (timeInput) {
        timeInput.value = "";
      }
      if (expensesInput) {
        expensesInput.value = "";
      }
      showError("");
      updateBulkUploadUiState();
    };

    const importValidTimeRows = async function () {
      const objects = Array.isArray(latestPreviewPayload?.objects) ? latestPreviewPayload.objects : [];
      const validRows = objects.filter((row) => row.status === "Valid");
      if (!validRows.length) return;
      const rejectedRows = objects.filter((row) => row.status !== "Valid");
      let importedCount = 0;
      let failedCount = 0;
      if (openTimeBtn) openTimeBtn.disabled = true;

      for (const row of validRows) {
        try {
          await deps().mutatePersistentState(
            "save_entry",
            {
              source: "bulk_upload",
              entry: {
                id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
                userId: row._resolvedUserId || "",
                user: row._resolvedUserName || `${row.member || ""}`.trim(),
                date: row.date || "",
                client: row._resolvedClientName || `${row.client || ""}`.trim(),
                project: row._resolvedProjectName || `${row.project || ""}`.trim(),
                task: "",
                hours: Number.isFinite(Number(row.hours)) ? Number(row.hours) : 0,
                billable: row.billable === false ? false : true,
                notes: `${row.notes || ""}`.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "pending",
              },
            },
            { skipHydrate: true, skipSettingsMetadataReload: true }
          );
          importedCount += 1;
        } catch (error) {
          failedCount += 1;
          row.status = "Invalid";
          row.error = error?.message || "Unable to import row.";
          rejectedRows.push(row);
        }
      }

      const invalidCount = rejectedRows.length;
      if (preview) {
        preview.hidden = invalidCount <= 0;
      }
      if (invalidCount > 0 && latestPreviewPayload?.headers && previewTableWrap) {
        renderPreviewTable(latestPreviewPayload.headers, rejectedRows, "time");
      } else if (previewTableWrap) {
        previewTableWrap.innerHTML = `<div class="empty-state-panel">Preview coming next</div>`;
      }
      if (selectedFileLabel) {
        selectedFileLabel.textContent = "";
      }
      if (timeInput) {
        timeInput.value = "";
      }
      if (invalidCount > 0) {
        setRejectedRows(rejectedRows, "time");
      } else {
        setRejectedRows([], "time");
      }
      latestImportSummary = {
        successCount: importedCount,
        rejectedCount: invalidCount,
      };
      latestPreviewPayload = null;
      previewKind = "";
      const baseMessage = `Imported ${importedCount} valid rows. ${invalidCount} invalid rows were not imported.`;
      deps().feedback(
        failedCount > 0 ? `${baseMessage} ${failedCount} row(s) failed during import.` : baseMessage,
        failedCount > 0
      );
      if (invalidCount <= 0 && typeof deps().loadPersistentState === "function") {
        await deps().loadPersistentState();
      }
      if (openTimeBtn) openTimeBtn.disabled = false;
      updateBulkUploadUiState();
    };

    const importValidExpenseRows = async function () {
      const objects = Array.isArray(latestPreviewPayload?.objects) ? latestPreviewPayload.objects : [];
      const validRows = objects.filter((row) => row.status === "Valid");
      if (!validRows.length) return;
      const rejectedRows = objects.filter((row) => row.status !== "Valid");
      let importedCount = 0;
      let failedCount = 0;
      if (openExpensesBtn) openExpensesBtn.disabled = true;

      for (const row of validRows) {
        try {
          await deps().mutatePersistentState(
            "create_expense",
            {
              source: "bulk_upload",
              expense: {
                id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
                userId: row._resolvedUserId || "",
                clientName: row._resolvedClientName || `${row.client || ""}`.trim(),
                projectName: row._resolvedProjectName || `${row.project || ""}`.trim(),
                expenseDate: row.date || "",
                category: `${row.category || ""}`.trim(),
                amount: Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0,
                isBillable: row.billable === false ? false : true,
                notes: `${row.notes || ""}`.trim(),
              },
            },
            { skipHydrate: true, skipSettingsMetadataReload: true }
          );
          importedCount += 1;
        } catch (error) {
          failedCount += 1;
          row.status = "Invalid";
          row.error = error?.message || "Unable to import row.";
          rejectedRows.push(row);
        }
      }

      const invalidCount = rejectedRows.length;
      if (preview) {
        preview.hidden = invalidCount <= 0;
      }
      if (invalidCount > 0 && latestPreviewPayload?.headers && previewTableWrap) {
        renderPreviewTable(latestPreviewPayload.headers, rejectedRows, "expenses");
      } else if (previewTableWrap) {
        previewTableWrap.innerHTML = `<div class="empty-state-panel">Preview coming next</div>`;
      }
      if (selectedFileLabel) {
        selectedFileLabel.textContent = "";
      }
      if (expensesInput) {
        expensesInput.value = "";
      }
      if (invalidCount > 0) {
        setRejectedRows(rejectedRows, "expenses");
      } else {
        setRejectedRows([], "expenses");
      }
      latestImportSummary = {
        successCount: importedCount,
        rejectedCount: invalidCount,
      };
      latestPreviewPayload = null;
      previewKind = "";
      const baseMessage = `Imported ${importedCount} valid rows. ${invalidCount} invalid rows were not imported.`;
      deps().feedback(
        failedCount > 0 ? `${baseMessage} ${failedCount} row(s) failed during import.` : baseMessage,
        failedCount > 0
      );
      if (invalidCount <= 0 && typeof deps().loadPersistentState === "function") {
        await deps().loadPersistentState();
      }
      if (openExpensesBtn) openExpensesBtn.disabled = false;
      updateBulkUploadUiState();
    };

    const handleFileSelect = async function (file, kind) {
      if (!file || !preview || !selectedFileLabel) return;
      showError("");
      previewKind = kind;
      latestPreviewPayload = null;
      latestImportSummary = null;
      setRejectedRows([], kind);
      selectedFileLabel.textContent = `Selected file: ${file.name || ""}`;
      preview.hidden = false;
      updateBulkUploadUiState();
      try {
        const parsed = await parseFile(file, kind);
        latestPreviewPayload = parsed;
        if (kind === "time") {
          setRejectedRows(parsed.objects.filter((row) => row.status !== "Valid"), "time");
        } else if (kind === "expenses") {
          setRejectedRows(parsed.objects.filter((row) => row.status !== "Valid"), "expenses");
        } else {
          setRejectedRows([]);
        }
        renderPreviewTable(parsed.headers, parsed.objects, kind);
        updateBulkUploadUiState();
      } catch (error) {
        if (previewTableWrap) {
          previewTableWrap.innerHTML = `<div class="empty-state-panel">Preview coming next</div>`;
        }
        preview.hidden = true;
        previewKind = "";
        latestPreviewPayload = null;
        setRejectedRows([], kind);
        updateBulkUploadUiState();
        showError(
          error?.message === "INVALID_TEMPLATE"
            ? "Invalid template. Please use the provided template."
            : "Unable to read file. Please use template."
        );
      }
    };

    openTimeBtn?.addEventListener("click", function () {
      const mode = openTimeBtn.dataset.mode || "upload-time";
      if (mode === "import-time") {
        const rows = Array.isArray(latestPreviewPayload?.objects) ? latestPreviewPayload.objects : [];
        const validCount = rows.filter((row) => row.status === "Valid").length;
        if (validCount <= 0) {
          updateBulkUploadUiState();
          return;
        }
        importValidTimeRows().catch((error) => {
          deps().feedback(error?.message || "Unable to import time rows.", true);
          if (openTimeBtn) openTimeBtn.disabled = false;
          updateBulkUploadUiState();
        });
        return;
      }
      if (mode === "import-expenses") {
        const rows = Array.isArray(latestPreviewPayload?.objects) ? latestPreviewPayload.objects : [];
        const validCount = rows.filter((row) => row.status === "Valid").length;
        if (validCount <= 0) {
          updateBulkUploadUiState();
          return;
        }
        importValidExpenseRows().catch((error) => {
          deps().feedback(error?.message || "Unable to import expense rows.", true);
          if (openTimeBtn) openTimeBtn.disabled = false;
          updateBulkUploadUiState();
        });
        return;
      }
      timeInput?.click();
    });
    openExpensesBtn?.addEventListener("click", function () {
      const mode = openExpensesBtn.dataset.mode || "upload-expenses";
      if (mode === "upload-another-time") {
        timeInput?.click();
        return;
      }
      if (mode === "upload-another-expenses") {
        expensesInput?.click();
        return;
      }
      expensesInput?.click();
    });
    downloadTimeTemplateBtn?.addEventListener("click", function () {
      window.location.assign("/templates/time-upload.xlsx");
    });
    downloadExpensesTemplateBtn?.addEventListener("click", function () {
      window.location.assign("/templates/expense-upload.xlsx");
    });
    timeInput?.addEventListener("change", function () {
      handleFileSelect(timeInput.files?.[0], "time");
    });
    expensesInput?.addEventListener("change", function () {
      handleFileSelect(expensesInput.files?.[0], "expenses");
    });
    downloadRejectsBtn?.addEventListener("click", function () {
      if (!latestRejectedRows.length) return;
      const hasPostImportState = Boolean(
        latestImportSummary &&
          Number.isFinite(latestImportSummary.successCount) &&
          Number.isFinite(latestImportSummary.rejectedCount)
      );
      const hasOnlyRejectedPreview =
        !hasPostImportState &&
        (previewKind === "time" || previewKind === "expenses") &&
        previewValidRowCount() <= 0;
      downloadRejectsCsv(latestRejectedRows, latestRejectedKind || previewKind || "time");
      if (hasPostImportState || hasOnlyRejectedPreview) {
        resetBulkUploadState();
      }
    });
    updateBulkUploadUiState();
  }

  function renderDelegationsTab() {
    const { state, escapeHtml } = deps();
    const panel = document.querySelector('[data-settings-tab="delegations"]');
    if (!panel || !state.permissions?.can_delegate) return;

    const capabilityOptions = [
      { key: "enter_time_on_behalf", label: "Enter time on my behalf" },
      { key: "enter_expenses_on_behalf", label: "Enter expenses on my behalf" },
      { key: "view_time_on_behalf", label: "View time in my scope" },
      { key: "view_expenses_on_behalf", label: "View expenses in my scope" },
      { key: "view_reports_on_behalf", label: "View reports in my scope" },
      { key: "create_reports_on_behalf", label: "Create reports in my scope" },
      { key: "print_reports_on_behalf", label: "Print reports in my scope" },
    ];
    const delegates = Array.isArray(state.delegationCandidates) ? state.delegationCandidates : [];
    const myDelegations = Array.isArray(state.myDelegations) ? state.myDelegations : [];
    const capabilitiesByDelegateId = new Map();
    const delegateNameById = new Map(
      delegates.map((item) => [`${item.id || ""}`.trim(), `${item.name || ""}`.trim()])
    );
    myDelegations.forEach((item) => {
      const key = `${item.delegateUserId || ""}`.trim();
      if (!key) return;
      if (!delegateNameById.get(key) && item.delegateName) {
        delegateNameById.set(key, `${item.delegateName}`.trim());
      }
      if (!capabilitiesByDelegateId.has(key)) {
        capabilitiesByDelegateId.set(key, new Set());
      }
      capabilitiesByDelegateId.get(key).add(item.capability);
    });
    const delegatedMembers = Array.from(capabilitiesByDelegateId.keys())
      .map((id) => ({ id, name: delegateNameById.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const createCapsHtml = capabilityOptions
      .map(
        (cap) => `
          <div class="delegations-cap-toggle-row">
            <span class="delegations-cap-label">${escapeHtml(cap.label)}</span>
            <label class="perm-switch">
              <input type="checkbox" data-delegation-capability value="${escapeHtml(cap.key)}">
              <span class="perm-switch-track" aria-hidden="true"></span>
            </label>
          </div>
        `
      )
      .join("");
    const pillsHtml = delegatedMembers.length
      ? delegatedMembers
          .map(
            (item) => `
              <button
                type="button"
                class="delegations-member-pill"
                data-delegations-pill-id="${escapeHtml(item.id)}"
              >${escapeHtml(item.name)}</button>
            `
          )
          .join("")
      : `<div class="delegations-empty">No delegates yet.</div>`;

    panel.innerHTML = `
      <div class="settings-section-header">
        <div class="settings-section-left">
          <h3>Delegations</h3>
        </div>
        <div class="settings-section-right">
          <button id="delegations-save" type="submit" form="delegations-form" class="button" ${delegates.length ? "" : "disabled"}>Add delegation</button>
        </div>
      </div>
      <div class="delegations-shell">
        <form id="delegations-form" class="delegations-form">
          <div class="delegations-columns">
            <section class="delegations-col delegations-col-search">
              <label class="settings-row-label" for="delegations-delegate-search">Delegate</label>
              <div class="delegations-picker">
                <input id="delegations-delegate-search" type="search" placeholder="${delegates.length ? "Search member" : "No eligible members"}" ${delegates.length ? "" : "disabled"} autocomplete="off" />
                <input id="delegations-delegate-id" type="hidden" value="" />
                <div id="delegations-delegate-results" class="delegations-picker-results" role="listbox"></div>
              </div>
            </section>
            <section class="delegations-col delegations-col-capabilities">
              <div class="settings-row-label">Capabilities</div>
              <div class="delegations-capabilities">${createCapsHtml}</div>
              <div id="delegations-selection-hint" class="delegations-hint">Select a member to configure delegations.</div>
            </section>
            <section class="delegations-col delegations-col-members">
              <div class="settings-row-label">Delegated members</div>
              <div class="delegations-member-pills">${pillsHtml}</div>
            </section>
          </div>
        </form>
      </div>
    `;

    const searchInput = panel.querySelector("#delegations-delegate-search");
    const selectedDelegateIdInput = panel.querySelector("#delegations-delegate-id");
    const delegateResults = panel.querySelector("#delegations-delegate-results");
    const memberPills = panel.querySelector(".delegations-member-pills");
    const selectionHint = panel.querySelector("#delegations-selection-hint");
    const saveButton = panel.querySelector("#delegations-save");
    const capabilityInputs = Array.from(
      panel.querySelectorAll('input[data-delegation-capability]')
    );
    const selectedCapabilitiesFromInputs = function () {
      return new Set(
        capabilityInputs
          .filter((input) => input.checked)
          .map((input) => `${input.value || ""}`.trim())
          .filter(Boolean)
      );
    };
    const persistDraftForSelectedDelegate = function () {
      const delegateUserId = `${selectedDelegateIdInput?.value || ""}`.trim();
      if (!delegateUserId) return;
      delegationsDraftCapabilitiesByDelegateId.set(delegateUserId, selectedCapabilitiesFromInputs());
    };
    const setCapabilitySelectionForDelegate = function (delegateUserId) {
      const selectedCapabilities = delegationsDraftCapabilitiesByDelegateId.has(delegateUserId)
        ? delegationsDraftCapabilitiesByDelegateId.get(delegateUserId)
        : capabilitiesByDelegateId.get(delegateUserId) || new Set();
      capabilityInputs.forEach((input) => {
        const cap = `${input.value || ""}`.trim();
        input.checked = selectedCapabilities.has(cap);
      });
    };
    const setDelegationControlsEnabled = function (enabled) {
      capabilityInputs.forEach((input) => {
        input.disabled = !enabled;
      });
      if (saveButton) {
        saveButton.disabled = !enabled;
      }
      if (selectionHint) {
        selectionHint.hidden = enabled;
      }
    };
    const syncPillSelection = function (delegateUserId) {
      if (!memberPills) return;
      memberPills.querySelectorAll("[data-delegations-pill-id]").forEach((pill) => {
        pill.classList.toggle("is-active", `${pill.dataset.delegationsPillId || ""}`.trim() === delegateUserId);
      });
    };
    const applyDelegateSelection = function (delegateUserId, options = {}) {
      const normalizedId = `${delegateUserId || ""}`.trim();
      if (!selectedDelegateIdInput) return;
      selectedDelegateIdInput.value = normalizedId;
      if (searchInput && options.keepSearchText !== true) {
        searchInput.value = normalizedId ? delegateNameById.get(normalizedId) || "" : "";
      }
      setCapabilitySelectionForDelegate(normalizedId);
      syncPillSelection(normalizedId);
      setDelegationControlsEnabled(Boolean(normalizedId));
      delegationsSelectedDelegateId = normalizedId;
    };
    const renderDelegateResults = function (queryValue) {
      if (!delegateResults) return;
      const query = `${queryValue || ""}`.trim().toLowerCase();
      const selectedId = `${selectedDelegateIdInput?.value || ""}`.trim();
      const filtered = delegates.filter((item) =>
        !query || `${item.name || ""}`.toLowerCase().includes(query)
      );
      const rows = filtered
        .slice(0, 150)
        .map((item) => {
          const itemId = `${item.id || ""}`.trim();
          const isSelected = itemId === selectedId;
          return `
            <button
              type="button"
              class="delegations-picker-option${isSelected ? " is-selected" : ""}"
              data-delegate-option-id="${escapeHtml(itemId)}"
            >${escapeHtml(item.name)}</button>
          `;
        })
        .join("");
      delegateResults.innerHTML =
        rows || `<div class="delegations-picker-empty">No members found.</div>`;
    };
    if (searchInput && selectedDelegateIdInput && delegateResults) {
      renderDelegateResults("");
      searchInput.oninput = function () {
        const query = `${searchInput.value || ""}`.trim().toLowerCase();
        const exactMatches = delegates.filter(
          (item) => `${item.name || ""}`.trim().toLowerCase() === query
        );
        if (exactMatches.length === 1) {
          const matchId = `${exactMatches[0].id || ""}`.trim();
          applyDelegateSelection(matchId, { keepSearchText: true });
        } else {
          applyDelegateSelection("", { keepSearchText: true });
        }
        renderDelegateResults(searchInput.value);
      };
      delegateResults.onclick = function (event) {
        const option = event.target.closest("[data-delegate-option-id]");
        if (!option) return;
        const id = `${option.dataset.delegateOptionId || ""}`.trim();
        if (!id) return;
        applyDelegateSelection(id);
        renderDelegateResults(searchInput.value);
      };
    }
    if (memberPills) {
      memberPills.onclick = function (event) {
        const pill = event.target.closest("[data-delegations-pill-id]");
        if (!pill) return;
        const id = `${pill.dataset.delegationsPillId || ""}`.trim();
        if (!id) return;
        applyDelegateSelection(id);
        renderDelegateResults(searchInput?.value || "");
      };
    }
    capabilityInputs.forEach((input) => {
      input.onchange = function () {
        persistDraftForSelectedDelegate();
      };
    });

    if (delegationsSelectedDelegateId) {
      const selected = delegates.find(
        (item) => `${item.id || ""}`.trim() === delegationsSelectedDelegateId
      );
      if (selected) {
        applyDelegateSelection(delegationsSelectedDelegateId);
      } else {
        applyDelegateSelection("");
      }
    } else {
      applyDelegateSelection("");
    }
    renderDelegateResults(searchInput?.value || "");

    const form = panel.querySelector("#delegations-form");
    if (form) {
      form.onsubmit = async function (event) {
        event.preventDefault();
        let delegateUserId = `${selectedDelegateIdInput?.value || ""}`.trim();
        if (!delegateUserId && searchInput) {
          const typed = `${searchInput.value || ""}`.trim().toLowerCase();
          const exactMatches = delegates.filter(
            (item) => `${item.name || ""}`.trim().toLowerCase() === typed
          );
          if (exactMatches.length === 1) {
            delegateUserId = `${exactMatches[0].id || ""}`.trim();
          }
        }
        if (!delegateUserId) {
          deps().feedback("Delegate is required.", true);
          return;
        }
        const selectedCaps = Array.from(
          panel.querySelectorAll('input[data-delegation-capability]:checked')
        ).map((input) => `${input.value || ""}`.trim());
        try {
          const result = await deps().mutatePersistentState(
            "save_delegate_capabilities",
            { delegateUserId, capabilities: selectedCaps },
            { skipHydrate: true }
          );
          if (Array.isArray(result?.myDelegations)) {
            state.myDelegations = result.myDelegations
              .map((item) => ({
                delegateUserId: `${item?.delegateUserId || item?.delegate_user_id || ""}`.trim(),
                delegateName: `${item?.delegateName || item?.delegate_name || ""}`.trim(),
                capability: `${item?.capability || ""}`.trim(),
              }))
              .filter((item) => item.delegateUserId && item.delegateName && item.capability);
          }
          delegationsDraftCapabilitiesByDelegateId.delete(delegateUserId);
          renderDelegationsTab();
          setActiveSettingsTab("delegations");
          deps().feedback(selectedCaps.length ? "Delegation saved." : "Delegation removed.", false);
        } catch (error) {
          deps().feedback(error.message || "Unable to save delegation.", true);
        }
      };
    }

    arrangeSettingsSectionHeaders();
  }

  function renderPermissionsMatrix() {
    const { state, escapeHtml } = deps();
    const panel = document.querySelector('[data-settings-tab="permissions"]');
    if (!panel) return;
    const roles = Array.isArray(state.permissionRoles) ? state.permissionRoles : [];
    const rolePerms = Array.isArray(state.rolePermissions) ? state.rolePermissions : [];
    const caps = [
      "view_members",
      "view_member_rates",
      "edit_member_rates",
      "edit_member_profile",
      "manage_departments",
      "manage_levels",
      "manage_expense_categories",
      "manage_office_locations",
      "can_upload_data",
      "can_delegate",
      "manage_settings_access",
    ];
    const capLabels = {
      view_members: "View member information",
      view_member_rates: "View member rates",
      edit_member_rates: "Edit member rates",
      edit_member_profile: "Edit member profile",
      manage_departments: "Manage practice departments",
      manage_levels: "Manage member levels",
      manage_expense_categories: "Manage expense categories",
      manage_office_locations: "Manage office locations",
      can_upload_data: "Can upload data",
      can_delegate: "Can delegate access",
      manage_settings_access: "Manage access settings",
    };

    const allowedSet = new Set(
      rolePerms
        .filter((p) => p.allowed && p.scope_key === "own_office")
        .map((p) => `${p.role_key}|${p.capability_key}`)
    );

    const rowsHtml = caps
      .map((cap) => {
        const cells = roles
          .map((role) => {
            const checked = allowedSet.has(`${role.key}|${cap}`);
            const isSuperuserRole = role.key === "superuser";
            const lockedAttrs = isSuperuserRole
              ? `disabled aria-disabled="true" class="locked-perm" title="Superuser permissions are fixed" data-perm-locked="true" data-locked-value="${checked ? "true" : "false"}"`
              : "";
            return `<td>
              <label class="perm-switch${isSuperuserRole ? " is-locked" : ""}">
                <input type="checkbox" data-perm-role="${escapeHtml(role.key)}" data-perm-cap="${escapeHtml(cap)}" ${checked ? "checked" : ""} ${lockedAttrs}>
                <span class="perm-switch-track" aria-hidden="true"></span>
              </label>
            </td>`;
          })
          .join("");
        return `<tr><th scope="row">${escapeHtml(capLabels[cap] || cap)}</th>${cells}</tr>`;
      })
      .join("");

    panel.innerHTML = `
      <div class="settings-section-header">
        <div class="settings-section-left">
          <h3>Member access levels</h3>
        </div>
        <div class="settings-section-right">
          <button type="button" id="permissions-save" class="button">Save Access</button>
        </div>
      </div>
      <div class="settings-section-content">
        <div class="table-wrapper">
          <table class="table perms-matrix">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                ${roles.map((r) => `<th scope="col">${escapeHtml(String(r.key || r.label || "").toUpperCase())}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const saveBtn = panel.querySelector("#permissions-save");
    if (!panel.dataset.permissionsHandlersBound) {
      panel.dataset.permissionsHandlersBound = "true";
      panel.addEventListener("click", async function (event) {
        const lockedInput = event.target.closest('[data-perm-locked="true"]');
        if (lockedInput) {
          event.preventDefault();
          event.stopPropagation();
          lockedInput.checked = lockedInput.dataset.lockedValue === "true";
          return;
        }
        const clickedSave = event.target.closest("#permissions-save");
        if (!clickedSave) return;
        event.preventDefault();
        if (permissionsSaveInFlight) return;
        const livePanel = document.querySelector('[data-settings-tab="permissions"]');
        if (!livePanel) return;
        const liveSaveBtn = livePanel.querySelector("#permissions-save");
        const liveRolePerms = Array.isArray(deps().state?.rolePermissions)
          ? deps().state.rolePermissions
          : [];
        const currentAllowedSet = new Set(
          liveRolePerms
            .filter((p) => p.allowed && p.scope_key === "own_office")
            .map((p) => `${p.role_key}|${p.capability_key}`)
        );
        const inputs = Array.from(livePanel.querySelectorAll("[data-perm-role][data-perm-cap]"));
        const next = [];
        let changedCount = 0;
        inputs.forEach((input) => {
          const roleKey = input.dataset.permRole;
          if (roleKey === "superuser" || input.dataset.permLocked === "true") {
            return;
          }
          const capKey = input.dataset.permCap;
          const allowed = input.checked;
          if (allowed !== currentAllowedSet.has(`${roleKey}|${capKey}`)) {
            changedCount += 1;
          }
          next.push({ role: roleKey, capability: capKey, allowed });
        });
        if (!changedCount) {
          deps().feedback("No access changes to save.", false);
          return;
        }
        permissionsSaveInFlight = true;
        if (liveSaveBtn) {
          liveSaveBtn.disabled = true;
          liveSaveBtn.dataset.loading = "true";
        }
        try {
          await deps().mutatePersistentState(
            "update_role_permissions",
            { rolePermissions: next },
            { skipHydrate: true }
          );
          await deps().loadPersistentState();
          renderSettingsTabs();
          deps().feedback("Access updated.", false);
        } catch (error) {
          deps().feedback(error.message || "Unable to save access.", true);
        } finally {
          permissionsSaveInFlight = false;
          if (liveSaveBtn && liveSaveBtn.isConnected) {
            liveSaveBtn.disabled = false;
            delete liveSaveBtn.dataset.loading;
          }
        }
      });
      panel.addEventListener("keydown", function (event) {
        const input = event.target.closest('[data-perm-locked="true"]');
        if (!input) return;
        event.preventDefault();
        event.stopPropagation();
      });
      panel.addEventListener("change", function (event) {
        const input = event.target.closest('[data-perm-locked="true"]');
        if (!input) return;
        input.checked = input.dataset.lockedValue === "true";
      });
    }
    if (saveBtn) {
      saveBtn.disabled = permissionsSaveInFlight;
      if (permissionsSaveInFlight) {
        saveBtn.dataset.loading = "true";
      } else {
        delete saveBtn.dataset.loading;
      }
    }
    arrangeSettingsSectionHeaders();
  }

  function renderDepartments() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.departmentRows) return;

    const departments = Array.isArray(state.departments) ? state.departments.slice() : [];
    const editable = Boolean(state.permissions?.manage_departments);

    refs.departmentRows.innerHTML = departments
      .map(
        (item) => `
          <div class="level-row settings-structured-row settings-structured-row-no-label department-row" data-department-id="${escapeHtml(item.id || "")}">
            <div class="settings-row-main">
              <input class="settings-field" type="text" value="${escapeHtml(item.name || "")}" data-department-name placeholder="Department name" ${editable ? "" : "disabled"} />
            </div>
            <div class="settings-row-actions expense-actions">
              ${
                editable
                  ? `<button type="button" class="settings-row-delete-icon" data-department-delete aria-label="Delete department">${SETTINGS_DELETE_ICON}</button>`
                  : ""
              }
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderUsersList() {
    const {
      usersRenderUsersList,
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
      isMobileDrilldown,
      mobileMembersView,
      onMobileMemberSelected,
      onMobileMembersBack,
    } = deps();
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
      isMobileDrilldown,
      mobileView: mobileMembersView,
      onUserSelected: onMobileMemberSelected,
      onBackToList: onMobileMembersBack,
    });
  }

  function renderLevelRows() {
    const { refs, escapeHtml, state } = deps();
    if (!refs.levelRows) return;

    const sorted = getLevelDefinitions().slice().sort((a, b) => a.level - b.level);

    const rowsHtml = sorted
      .map(
        (item) => `
          <div class="level-row settings-structured-row" data-level="${item.level}">
            <span class="settings-row-label level-num level-col">Level ${item.level}</span>
            <div class="settings-row-main settings-row-main-split">
              <input class="settings-field" type="text" value="${escapeHtml(item.label || "")}" data-level-label />
              <select class="settings-field" data-level-permission>
                ${["staff", "manager", "executive", "admin", "superuser"]
                  .map(
                    (group) =>
                      `<option value="${group}"${group === item.permissionGroup ? " selected" : ""}>${group}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="settings-row-actions">
              <button type="button" class="settings-row-delete-icon" data-level-delete aria-label="Delete level">
                ${SETTINGS_DELETE_ICON}
              </button>
            </div>
          </div>
        `
      )
      .join("");
    refs.levelRows.innerHTML = `
      <div class="level-row settings-structured-row settings-structured-row-header" aria-hidden="true">
        <span class="settings-row-label level-col">LEVEL</span>
        <div class="settings-row-main settings-row-main-split">
          <span>TITLE</span>
          <span>ROLE</span>
        </div>
        <div class="settings-row-actions"></div>
      </div>
      ${rowsHtml}
    `;

    const editable = Boolean(state.permissions?.manage_levels);
    refs.levelRows.querySelectorAll("input, select").forEach(function (el) {
      el.disabled = !editable;
    });
    if (refs.addLevel) {
      refs.addLevel.disabled = !editable;
    }
  }

  function renderRatesRows() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.ratesRows) return;
    const isMobileMemberInfo = isMobileSettingsLayout();
    if (!isMobileMemberInfo) {
      memberInfoMobileMode = "list";
    }

    const canEditRates = Boolean(state.permissions?.edit_user_rates);
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditAny = canEditRates || canEditProfile;
    const users = (state.users || []).filter((u) => u.isActive !== false);
    const departments = state.departments || [];
    const titleOptions = Object.entries(state.levelLabels || {})
      .map(([level, value]) => ({
        level: Number(level),
        label: value?.label || `Level ${level}`,
      }))
      .filter((item) => Number.isFinite(item.level))
      .sort((a, b) => a.level - b.level);

    const levelLabel = (selectedLevel) =>
      titleOptions.find((item) => item.level === Number(selectedLevel))?.label || "";
    const officeNameById = new Map((state.officeLocations || []).map((o) => [String(o.id), o.name || ""]));
    const deptNameById = new Map((departments || []).map((d) => [String(d.id), d.name || ""]));
    const departmentName = (id, fallbackName) => {
      const fallback = String(fallbackName || "").trim();
      if (!id) return fallback || "No department";
      return deptNameById.get(String(id)) || fallback || "No department";
    };
    const officeName = (id, fallbackName) =>
      id ? officeNameById.get(String(id)) || fallbackName || "No office" : fallbackName || "No office";

    const valueOrDash = (value) => {
      const raw = value == null ? "" : String(value).trim();
      return raw ? escapeHtml(raw) : "—";
    };
    const buildMemberCard = (user) => `
          <article class="member-info-card member-info-card--enhanced" data-user-id="${escapeHtml(
            user.id
          )}" data-member-info-search-item data-member-info-search="${escapeHtml(
      `${user.displayName || ""} ${user.username || ""}`.toLowerCase()
    )}">
            <div class="member-info-layout">
              <div class="member-info-identity">
                <div class="member-info-name">${escapeHtml(user.displayName)}</div>
                <div class="member-info-item member-info-item-inline">
                  <span class="member-info-field-label">User ID</span>
                  <span class="member-info-field-value">${valueOrDash(user.username)}</span>
                </div>
                <div class="member-info-item member-info-item-inline">
                  <span class="member-info-field-label">Employee ID</span>
                  <span class="member-info-field-value">${valueOrDash(user.employeeId)}</span>
                </div>
              </div>
              <div class="member-info-grid">
                <div class="member-info-item">
                  <span class="member-info-field-label">Title</span>
                  <span class="member-info-field-value">${valueOrDash(levelLabel(user.level) || "No title")}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Department</span>
                  <span class="member-info-field-value">${valueOrDash(departmentName(user.departmentId, user.departmentName))}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Office</span>
                  <span class="member-info-field-value">${valueOrDash(officeName(user.officeId, user.officeName))}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Email</span>
                  <span class="member-info-field-value">${valueOrDash(user.email)}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Base rate</span>
                  <span class="member-info-field-value">${valueOrDash(user.baseRate)}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Cost rate</span>
                  <span class="member-info-field-value">${valueOrDash(user.costRate)}</span>
                </div>
              </div>
              <div class="member-info-action member-info-action-enhanced">
                ${
                  canEditAny
                    ? `<button type="button" class="button button-ghost member-info-edit" data-member-edit="${escapeHtml(user.id)}">Edit</button>`
                    : ""
                }
                ${
                  canEditProfile
                    ? `<button type="button" class="member-info-remove settings-row-delete-icon" data-user-deactivate="${escapeHtml(
                        user.id
                      )}" aria-label="Remove member">${SETTINGS_DELETE_ICON}</button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `;

    const selectedUser = users.find((u) => u.id === memberInfoMobileSelectedUserId) || null;
    if (isMobileMemberInfo && memberInfoMobileMode === "detail" && !selectedUser) {
      memberInfoMobileMode = "list";
    }

    if (isMobileMemberInfo && memberInfoMobileMode === "detail" && selectedUser) {
      refs.ratesRows.innerHTML = `
        <button type="button" class="button button-ghost member-info-mobile-back" data-member-info-mobile-back>
          Back
        </button>
        <div class="settings-rates-cards">
          ${buildMemberCard(selectedUser)}
        </div>
      `;
    } else if (isMobileMemberInfo) {
      const rowsHtml = users
        .map((user) => {
          const searchIndex = `${user.displayName || ""} ${user.username || ""}`.toLowerCase();
          return `
            <button
              type="button"
              class="member-info-mobile-item"
              data-member-info-select="${escapeHtml(user.id)}"
              data-member-info-search-item
              data-member-info-search="${escapeHtml(searchIndex)}"
            >
              <span class="member-info-mobile-item-name">${escapeHtml(user.displayName)}</span>
              <span class="member-info-mobile-item-sub">${valueOrDash(user.username)}</span>
            </button>
          `;
        })
        .join("");
      refs.ratesRows.innerHTML = `
        <div class="member-info-search-row">
          <input
            type="search"
            data-member-info-search-input
            placeholder="Search members..."
            value="${escapeHtml(memberInfoSearchTerm)}"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="member-info-mobile-list">
          ${rowsHtml}
        </div>
        <div class="member-info-empty" data-member-info-empty hidden>No members found</div>
      `;
    } else {
      const rowsHtml = users.map((user) => buildMemberCard(user)).join("");
      refs.ratesRows.innerHTML = `
        <div class="member-info-search-row">
          <input
            type="search"
            data-member-info-search-input
            placeholder="Search members..."
            value="${escapeHtml(memberInfoSearchTerm)}"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="settings-rates-cards">
          ${rowsHtml}
        </div>
        <div class="member-info-empty" data-member-info-empty hidden>No members found</div>
      `;
    }

    const searchInput = refs.ratesRows.querySelector("[data-member-info-search-input]");
    const rows = Array.from(refs.ratesRows.querySelectorAll("[data-member-info-search-item]"));
    const emptyNode = refs.ratesRows.querySelector("[data-member-info-empty]");
    const applySearchFilter = (rawTerm) => {
      const term = `${rawTerm || ""}`.trim().toLowerCase();
      let visibleCount = 0;
      rows.forEach((row) => {
        const haystack = `${row.dataset.memberInfoSearch || ""}`;
        const isVisible = !term || haystack.includes(term);
        row.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });
      if (emptyNode) {
        emptyNode.hidden = visibleCount > 0;
      }
    };
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        memberInfoSearchTerm = searchInput.value || "";
        applySearchFilter(memberInfoSearchTerm);
      });
      applySearchFilter(memberInfoSearchTerm);
    }
    refs.ratesRows.querySelectorAll("[data-member-info-select]").forEach((btn) => {
      btn.addEventListener("click", function () {
        memberInfoMobileSelectedUserId = btn.dataset.memberInfoSelect || "";
        memberInfoMobileMode = "detail";
        renderRatesRows();
      });
    });
    const mobileBackBtn = refs.ratesRows.querySelector("[data-member-info-mobile-back]");
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener("click", function () {
        memberInfoMobileMode = "list";
        renderRatesRows();
      });
    }

    if (!refs.ratesForm?.querySelector(".settings-section-right")) {
      arrangeSettingsSectionHeaders();
    }
    let sectionRight = refs.ratesForm?.querySelector(".settings-section-right");
    if (!sectionRight) {
      const inner = refs.ratesForm?.querySelector(".level-labels-inner");
      const title = inner?.querySelector("h3");
      if (inner && title) {
        const header = document.createElement("div");
        header.className = "settings-section-header";
        const left = document.createElement("div");
        left.className = "settings-section-left";
        const right = document.createElement("div");
        right.className = "settings-section-right";
        left.appendChild(title);
        header.appendChild(left);
        header.appendChild(right);
        inner.insertBefore(header, inner.firstChild);
        sectionRight = right;
      }
    }
    const straySaveButtons = Array.from(refs.ratesForm?.querySelectorAll("#save-rates") || []);
    straySaveButtons.forEach((btn) => btn.remove());
    if (sectionRight) {
      const sectionTitle = refs.ratesForm?.querySelector(".settings-section-left h3, .level-labels-inner > h3");
      if (sectionTitle) {
        sectionTitle.textContent = "Member information";
      }
      let addBtn = sectionRight.querySelector("[data-member-add]");
      if (!addBtn) {
        addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "button";
        addBtn.dataset.memberAdd = "true";
        addBtn.textContent = "Add member";
        sectionRight.insertBefore(addBtn, sectionRight.firstChild);
      }
      const canCreateMember = Boolean(state.permissions?.create_user);
      addBtn.hidden = !canCreateMember || isMobileSettingsLayout();
      const settingsContentShell = document.querySelector("#settings-page .settings-content-shell");
      const mobileBackBtn = settingsContentShell?.querySelector(".settings-mobile-back");
      if (settingsContentShell && mobileBackBtn) {
        let topActions = settingsContentShell.querySelector(".member-info-mobile-top-actions");
        if (!topActions) {
          topActions = document.createElement("div");
          topActions.className = "member-info-mobile-top-actions";
          settingsContentShell.insertBefore(topActions, mobileBackBtn);
        }
        if (mobileBackBtn.parentElement !== topActions) {
          topActions.appendChild(mobileBackBtn);
        }
        let mobileAddBtn = topActions.querySelector(".member-info-mobile-add");
        if (!mobileAddBtn) {
          mobileAddBtn = document.createElement("button");
          mobileAddBtn.type = "button";
          mobileAddBtn.className = "button member-info-mobile-add";
          mobileAddBtn.dataset.memberAdd = "true";
          mobileAddBtn.textContent = "Add member";
          topActions.appendChild(mobileAddBtn);
        }
        mobileAddBtn.dataset.memberAddAllowed = canCreateMember ? "true" : "false";
        mobileAddBtn.hidden = !(
          isMobileSettingsLayout() &&
          activeSettingsTab === "rates" &&
          mobileSettingsMode === "detail" &&
          canCreateMember
        );
      }
    }
  }

  function renderExpenseCategories() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.expenseRows) return;

    const categories = state.expenseCategories.length ? [...state.expenseCategories] : [];

    refs.expenseRows.innerHTML = categories
      .map(
        (item) => `
          <div class="level-row settings-structured-row settings-structured-row-no-label expense-row" data-expense-id="${escapeHtml(item.id || "")}">
            <div class="settings-row-main">
              <input class="settings-field" type="text" value="${escapeHtml(item.name || "")}" data-expense-name placeholder="Category name" />
            </div>
            <div class="settings-row-actions expense-actions">
              <button type="button" class="settings-row-delete-icon" data-expense-delete aria-label="Delete category">
                ${SETTINGS_DELETE_ICON}
              </button>
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderOfficeLocations() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.officeRows) return;

    const usersById = new Map((state.users || []).map((u) => [u.id, u]));

    const rowsHtml = (state.officeLocations || [])
      .map(function (item) {
        const leadUserId = item.officeLeadUserId || "";
        const leadUser =
          usersById.get(leadUserId) ||
          (leadUserId && item.officeLeadUserName
            ? { id: leadUserId, displayName: item.officeLeadUserName }
            : null);
        const leadOptions = [
          `<option value="">No lead</option>`,
          ...state.users.map((u) =>
            `<option value="${escapeHtml(u.id)}"${u.id === leadUserId ? " selected" : ""}>${escapeHtml(u.displayName)}</option>`
          ),
          ...(leadUser && !usersById.has(leadUserId)
            ? [
                `<option value="${escapeHtml(leadUser.id)}" selected>${escapeHtml(
                  leadUser.displayName
                )}</option>`,
              ]
            : []),
        ].join("");

        return `
          <div class="level-row settings-structured-row settings-structured-row-no-label office-row" data-office-id="${escapeHtml(item.id || "")}">
            <div class="settings-row-main settings-row-main-split">
              <input class="settings-field" type="text" value="${escapeHtml(item.name)}" data-office-name placeholder="Location name" />
              <select class="settings-field" data-office-lead>${leadOptions}</select>
            </div>
            <div class="settings-row-actions office-actions">
              <button type="button" class="settings-row-delete-icon" data-office-delete aria-label="Delete location">
                ${SETTINGS_DELETE_ICON}
              </button>
            </div>
          </div>
        `;
      })
      .join("");
    refs.officeRows.innerHTML = `
      <div class="level-row settings-structured-row settings-structured-row-no-label settings-structured-row-header" aria-hidden="true">
        <div class="settings-row-main settings-row-main-split">
          <span>OFFICE</span>
          <span>OFFICE LEAD</span>
        </div>
        <div class="settings-row-actions"></div>
      </div>
      ${rowsHtml}
    `;

    if (refs.officeAddLead) {
      const options = [
        `<option value="">Office Lead (optional)</option>`,
        ...state.users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.displayName)}</option>`),
      ];
      refs.officeAddLead.innerHTML = options.join("");
    }
  }

  function sortedLevels() {
    const { permissionGroupForUser, state, DEFAULT_LEVEL_DEFS } = deps();
    const rank = (level) => {
      const group = permissionGroupForUser({ level }) || "staff";
      if (group === "staff") return 0;
      if (group === "manager") return 1;
      if (group === "executive") return 2;
      return 3; // admin or anything higher
    };
    const fromState = Object.keys(state.levelLabels || {}).map((l) => Number(l));
    const levels = fromState.length ? fromState : Object.keys(DEFAULT_LEVEL_DEFS).map((l) => Number(l));
    return Array.from(new Set(levels))
      .filter((l) => Number.isFinite(l))
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        return rankDiff !== 0 ? rankDiff : a - b;
      });
  }

  function getLevelDefinitions() {
    const { state, DEFAULT_LEVEL_DEFS } = deps();
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
    const {
      usersSyncUserManagementControls,
      refs,
      state,
      isAdmin,
      isGlobalAdmin,
      levelLabel,
      escapeHtml,
      field,
    } = deps();
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
    const { state, feedback } = deps();
    if (!state.permissions?.manage_levels) {
      feedback("Access denied.", true);
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
    const { refs } = deps();
    if (!refs.membersFeedback) {
      return;
    }
    refs.membersFeedback.textContent = message || "";
    refs.membersFeedback.dataset.error = isError ? "true" : "false";
  }

  function renderMembersModal() {
    const {
      membersRenderMembersModal,
      refs,
      state,
      memberModalState,
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      getUserById,
      directManagerIdsForProject,
      isUserAssignedToProject,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      escapeHtml,
      roleKey,
    } = deps();
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
      roleKey,
      escapeHtml,
    });
  }

  function normalizeModalLevel(level) {
    const { permissionGroupForUser } = deps();
    const group = permissionGroupForUser({ level });
    if (group === "superuser") return 6;
    if (group === "admin") return 5;
    if (group === "executive") return 4;
    if (group === "manager") return 3;
    return 1; // staff
  }

  function openChangePasswordModal() {
    const { refs } = deps();
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = false;
    refs.changePasswordCurrent.value = "";
    refs.changePasswordNew.value = "";
    refs.changePasswordConfirm.value = "";
    refs.changePasswordCurrent.focus();
  }

  function closeChangePasswordModal() {
    const { refs } = deps();
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = true;
  }

  window.settingsAdmin = {
    renderUsersList,
    renderLevelRows,
    renderRatesRows,
    renderExpenseCategories,
    renderCorporateFunctionCategories,
    renderOfficeLocations,
    renderDepartments,
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
  };
})();
