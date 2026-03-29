(function () {
  const deps = () => window.settingsAdminDeps || {};
  const SETTINGS_TABS = ["levels", "categories", "locations", "rates", "messaging_rules", "departments", "permissions"];
  let activeSettingsTab = "levels";
  let tabsInitialized = false;
  let mobileSettingsMode = "list";

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
    const tabs = [];
    if (state.permissions?.manage_levels) tabs.push("levels");
    if (state.permissions?.manage_expense_categories) tabs.push("categories");
    if (state.permissions?.manage_office_locations) tabs.push("locations");
    if (state.permissions?.view_members_page) {
      tabs.push("rates");
    }
    if (state.permissions?.manage_settings_access) tabs.push("messaging_rules");
    if (state.permissions?.manage_departments) tabs.push("departments");
    if (state.permissions?.manage_settings_access) tabs.push("permissions");
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
        '[data-settings-tab="levels"], [data-settings-tab="categories"], [data-settings-tab="locations"], [data-settings-tab="rates"], [data-settings-tab="messaging_rules"], [data-settings-tab="departments"], [data-settings-tab="permissions"]'
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
      locations: "Office locations",
      rates: "Member information",
      messaging_rules: "Messaging Rules",
      departments: "Practice departments",
      permissions: "Member access levels",
    };
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

      if (!document.getElementById("settings-layout-style")) {
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
            height:clamp(500px, calc(100vh - 170px), 80vh);
            overflow:auto;
          }
          #settings-page .settings-tabs{display:flex;flex-direction:column;gap:12px}
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
          #settings-page .settings-panels{min-width:0}
          #settings-page .settings-panels [data-settings-tab]{width:100%}
          #settings-page .settings-panels .level-labels-inner{max-width:none}
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
            width:96px;
            min-width:96px;
            height:34px;
            padding:0 10px;
            border:1px solid color-mix(in srgb, var(--danger) 45%, var(--group-border));
            border-radius:999px;
            background:color-mix(in srgb, var(--panel) 88%, var(--danger) 12%);
            color:var(--danger);
            font-weight:700;
            font-size:.9rem;
            line-height:1;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
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
            grid-template-columns:minmax(180px,220px) minmax(0,1fr) minmax(96px,max-content);
            gap:12px;
            align-items:center;
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
              max-height:calc(100vh - 180px);
              overflow:auto;
              padding:12px;
            }
            #settings-page.settings-mobile-list .settings-content-shell{display:none}
            #settings-page.settings-mobile-detail .settings-nav-shell{display:none}
            #settings-page .settings-mobile-back{
              display:inline-flex;
              margin:0 0 10px;
            }
            #settings-page .settings-section-content .settings-structured-row{
              grid-template-columns:minmax(120px,.9fr) minmax(0,1fr) minmax(84px,max-content);
            }
            #settings-page .settings-section-content .settings-structured-row-no-label{
              grid-template-columns:minmax(0,1fr) minmax(84px,max-content);
            }
            #settings-page .settings-rates-row{
              display:block;
            }
            #settings-page .settings-row-actions{
              width:auto;
              justify-content:flex-start;
            }
            #settings-page .settings-row-main-split{
              grid-template-columns:minmax(0,1fr) minmax(140px,200px);
            }
          }
          @media (max-width: 720px){
            #settings-page .settings-section-content .settings-structured-row{
              grid-template-columns:1fr;
            }
            #settings-page .settings-section-content .settings-structured-row-no-label{
              grid-template-columns:1fr;
            }
            #settings-page .settings-rates-row{
              display:block;
            }
            #settings-page .settings-row-main-split{
              grid-template-columns:1fr;
            }
          }
        `;
        document.head.appendChild(style);
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
    renderPermissionsMatrix();
  }

  function renderPermissionsMatrix() {
    const { state, escapeHtml } = deps();
    const panel = document.querySelector('[data-settings-tab="permissions"]');
    if (!panel) return;
    const roles = Array.isArray(state.permissionRoles) ? state.permissionRoles : [];
    const rolePerms = Array.isArray(state.rolePermissions) ? state.rolePermissions : [];
    const caps = [
      "view_settings_shell",
      "view_members",
      "view_member_rates",
      "edit_member_rates",
      "edit_member_profile",
      "manage_departments",
      "manage_levels",
      "manage_expense_categories",
      "manage_office_locations",
      "manage_settings_access",
    ];
    const capLabels = {
      view_settings_shell: "Settings access",
      view_members: "View member information",
      view_member_rates: "View member rates",
      edit_member_rates: "Edit member rates",
      edit_member_profile: "Edit member profile",
      manage_departments: "Manage practice departments",
      manage_levels: "Manage member levels",
      manage_expense_categories: "Manage expense categories",
      manage_office_locations: "Manage office locations",
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

    const saveBtn = document.getElementById("permissions-save");
    panel.addEventListener("click", function (event) {
      const input = event.target.closest('[data-perm-locked="true"]');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      input.checked = input.dataset.lockedValue === "true";
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
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        const inputs = Array.from(panel.querySelectorAll("[data-perm-role][data-perm-cap]"));
        const next = [];
        inputs.forEach((input) => {
          const roleKey = input.dataset.permRole;
          if (roleKey === "superuser" || input.dataset.permLocked === "true") {
            return;
          }
          const capKey = input.dataset.permCap;
          const allowed = input.checked;
          next.push({ role: roleKey, capability: capKey, allowed });
        });
        try {
          await deps().mutatePersistentState(
            "update_role_permissions",
            { rolePermissions: next },
            { skipHydrate: true }
          );
          await deps().loadPersistentState();
          renderSettingsTabs();
          renderPermissionsMatrix();
          deps().feedback("Access updated.", false);
        } catch (error) {
          deps().feedback(error.message || "Unable to save access.", true);
        }
      });
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
              <input type="text" value="${escapeHtml(item.name || "")}" data-department-name placeholder="Department name" ${editable ? "" : "disabled"} />
            </div>
            <div class="settings-row-actions expense-actions">
              <button
                type="button"
                class="expense-toggle ${item.isActive === false ? "is-inactive" : "is-active"}"
                data-department-active
                data-active="${item.isActive === false ? "false" : "true"}"
                aria-pressed="${item.isActive === false ? "false" : "true"}"
                ${editable ? "" : "disabled"}
              >
                ${item.isActive === false ? "Inactive" : "Active"}
              </button>
              ${editable ? `<button type="button" class="expense-delete" data-department-delete>Delete</button>` : ""}
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
            <span class="settings-row-label level-num">Level ${item.level}</span>
            <div class="settings-row-main settings-row-main-split">
              <input type="text" value="${escapeHtml(item.label || "")}" data-level-label />
              <select data-level-permission>
                ${["staff", "manager", "executive", "admin", "superuser"]
                  .map(
                    (group) =>
                      `<option value="${group}"${group === item.permissionGroup ? " selected" : ""}>${group}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="settings-row-actions">
              <button type="button" class="level-delete" data-level-delete aria-label="Delete level">Delete</button>
            </div>
          </div>
        `
      )
      .join("");
    refs.levelRows.innerHTML = `
      <div class="level-row settings-structured-row settings-structured-row-header" aria-hidden="true">
        <span class="settings-row-label">LEVEL</span>
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

    const canEditRates = Boolean(state.permissions?.edit_user_rates);
    const canEditProfile = Boolean(state.permissions?.edit_user_profile);
    const canEditAny = canEditRates || canEditProfile;
    const users = (state.users || []).filter((u) => u.isActive !== false);
    const departments = (state.departments || []).filter((d) => d.isActive !== false);
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
    const departmentName = (id) => (id ? deptNameById.get(String(id)) || "No department" : "No department");
    const officeName = (id, fallbackName) =>
      id ? officeNameById.get(String(id)) || fallbackName || "No office" : fallbackName || "No office";

    const rowsHtml = users
      .map(
        (user) => {
          const valueOrDash = (value) => {
            const raw = value == null ? "" : String(value).trim();
            return raw ? escapeHtml(raw) : "—";
          };
          return `
          <article class="member-info-card member-info-card--enhanced" data-user-id="${escapeHtml(user.id)}">
            <div class="member-info-layout">
              <div class="member-info-identity">
                <div class="member-info-name">${escapeHtml(user.displayName)}</div>
                <div class="member-info-item member-info-item-inline">
                  <span class="member-info-field-label">User ID</span>
                  <span class="member-info-field-value">${valueOrDash(user.username)}</span>
                </div>
              </div>
              <div class="member-info-grid">
                <div class="member-info-item">
                  <span class="member-info-field-label">Title</span>
                  <span class="member-info-field-value">${valueOrDash(levelLabel(user.level) || "No title")}</span>
                </div>
                <div class="member-info-item">
                  <span class="member-info-field-label">Department</span>
                  <span class="member-info-field-value">${valueOrDash(departmentName(user.departmentId))}</span>
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
                    ? `<button type="button" class="member-info-remove" data-user-deactivate="${escapeHtml(user.id)}">Remove</button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `;
        }
      )
      .join("");
    refs.ratesRows.innerHTML = `
      <div class="settings-rates-cards">
        ${rowsHtml}
      </div>
    `;

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
        addBtn.className = "button button-ghost";
        addBtn.dataset.memberAdd = "true";
        addBtn.textContent = "Add member";
        sectionRight.insertBefore(addBtn, sectionRight.firstChild);
      }
      addBtn.hidden = !Boolean(state.permissions?.create_user);
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
              <input type="text" value="${escapeHtml(item.name || "")}" data-expense-name placeholder="Category name" />
            </div>
            <div class="settings-row-actions expense-actions">
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
              <input type="text" value="${escapeHtml(item.name)}" data-office-name placeholder="Location name" />
              <select data-office-lead>${leadOptions}</select>
            </div>
            <div class="settings-row-actions office-actions">
              <button type="button" class="expense-delete" data-office-delete>Delete</button>
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
