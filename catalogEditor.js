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
  };
})();
