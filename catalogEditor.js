(function () {
  const deps = () => window.catalogEditorDeps || {};

  function clientByName(name) {
    const { state } = deps();
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
      officeId: "",
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
    const { state } = deps();
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
    const { state, postHeight } = deps();
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
    const { state, refs } = deps();
    state.clientEditor = null;
    if (refs.clientEditor) {
      refs.clientEditor.innerHTML = "";
    }
  }

  function renderStateOptions(selected) {
    const { US_STATES } = deps();
    const current = (selected || "").toUpperCase();
    return ['<option value=""></option>', ...US_STATES.map((state) => {
      const isSelected = state === current ? "selected" : "";
      return `<option value="${state}" ${isSelected}>${state}</option>`;
    })].join("");
  }

  function setFieldError(form, name, isError) {
    const { field } = deps();
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

  function renderClientEditor() {
    const { refs, state, escapeHtml, isAdmin } = deps();
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
    const officeOptions = [
      '<option value="">No office</option>',
      ...(state.officeLocations || []).map(function (loc) {
        const id = loc.id != null ? String(loc.id) : "";
        const selected = id === String(values.officeId || "") ? "selected" : "";
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(loc.name)}</option>`;
      }),
    ].join("");

    refs.clientEditor.innerHTML = `
      <div class="client-editor-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <form class="client-editor-card" data-client-editor-form="${escapeHtml(editor.mode)}">
          <p class="client-editor-message" data-client-editor-message hidden></p>
          <div class="client-editor-grid">
            <div class="client-editor-row client-editor-top-row">
              <div class="client-editor-row-fields client-editor-row-fields-top">
                <label class="client-editor-field">
                  <span>Client name</span>
                  <input type="text" name="client_name" value="${escapeHtml(values.name || "")}" ${disabledAttr} required />
                </label>
                <label class="client-editor-field">
                  <span>Office</span>
                  <select name="office_id" ${disabledAttr}>${officeOptions}</select>
                </label>
              </div>
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
    const {
      renderCatalogLists,
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
    } = deps();
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
      officeId: value("office_id"),
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

  function normalizeCatalog(catalog, fallbackToDefault = true) {
    const { uniqueValues, DEFAULT_CLIENT_PROJECTS } = deps();
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
      officeId: clean(client.officeId || client.office_id),
    };
  }

  function normalizeEntry(entry) {
    const { state, isValidDateString, today } = deps();
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
      userId: entry.userId || entry.user_id || "",
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
    const { today } = deps();
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

  function ensureCatalogSelection() {
    const { state, visibleCatalogClientNames } = deps();
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
    const {
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
      syncFormCatalogs,
      assignedProjectTuplesForCurrentUser,
    } = deps();
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
        assignedProjectTuplesForCurrentUser,
      },
      selection
    );
  }

  function syncFilterCatalogsUI(selection) {
    const {
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
      effectiveScopeUser,
      isValidDateString,
      syncFilterCatalogs,
    } = deps();
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
        effectiveScopeUser,
        isValidDateString,
      },
      selection
    );
  }

  function syncExpenseFilterCatalogsUI(selection) {
    const {
      refs,
      visibleCatalogClientNames,
      setSelectOptionsWithPlaceholder,
      visibleCatalogProjectNames,
      getUserById,
      escapeHtml,
      entryUserOptions,
      getUserByDisplayName,
      expenseClientOptions,
    } = deps();
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
      const clients = expenseClientOptions ? expenseClientOptions() : visibleCatalogClientNames();
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

  window.catalogEditor = {
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
  };
})();
