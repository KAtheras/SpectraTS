(function () {
  function openCatalogModal(deps) {
    const { refs, body, postHeight } = deps;
    refs.catalogModal.hidden = false;
    refs.catalogModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    postHeight();
  }

  function closeCatalogModal(deps) {
    const { refs, body, postHeight } = deps;
    refs.catalogModal.hidden = true;
    refs.catalogModal.setAttribute("aria-hidden", "true");
    if (refs.usersModal.hidden && (!refs.membersModal || refs.membersModal.hidden)) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function renderCatalogLists(deps) {
    const {
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
    } = deps;

    const clients = visibleCatalogClientNames();
    const canManageClients = isAdmin(state.currentUser);

    if (!clients.length) {
      refs.clientList.innerHTML = '<p class="empty-state">No clients yet.</p>';
      refs.projectList.innerHTML =
        '<p class="empty-state">Add an entry to start building the client catalog.</p>';
      refs.projectColumnLabel.textContent = "Projects";
      return;
    }

    ensureCatalogSelection();
    const selectedClient = state.selectedCatalogClient;
    const projects = visibleCatalogProjectNames(selectedClient);

    refs.clientList.innerHTML = clients
      .map(
        (client) => {
          return `
          <article
            class="catalog-item${client === selectedClient ? " is-selected" : ""}"
            data-client="${escapeHtml(client)}"
            role="button"
            tabindex="0"
          >
            <span class="catalog-item-copy">
              <span class="catalog-item-title">${escapeHtml(client)}</span>
              <small>${visibleCatalogProjectNames(client).length} ${
                visibleCatalogProjectNames(client).length === 1 ? "project" : "projects"
              }</small>
            </span>
            <span class="catalog-item-actions">
              <button
                type="button"
                class="catalog-edit"
                aria-label="Edit ${escapeHtml(client)}"
                data-edit-client="${escapeHtml(client)}"
                ${disabledButtonAttrs(canManageClients, "Admin only.")}
              >
                Edit
              </button>
              <button
                type="button"
                class="catalog-delete"
                aria-label="Delete ${escapeHtml(client)}"
                data-delete-client="${escapeHtml(client)}"
                ${disabledButtonAttrs(canManageClients, "Admin only.")}
              >
                Remove
              </button>
            </span>
          </article>
        `;
        }
      )
      .join("");

    refs.projectColumnLabel.textContent = selectedClient
      ? `Projects for ${selectedClient}`
      : "Projects";
    const canAddClient = isAdmin(state.currentUser);
    const clientNameField = field(refs.addClientForm, "client_name");
    const addClientButton = refs.addClientForm.querySelector("button");
    if (clientNameField && addClientButton) {
      clientNameField.disabled = !canAddClient;
      addClientButton.disabled = !canAddClient;
      const reason = "Admin only.";
      clientNameField.title = canAddClient ? "" : reason;
      addClientButton.title = canAddClient ? "" : reason;
    }
    const projectNameField = field(refs.addProjectForm, "project_name");
    const canCreateProject =
      Boolean(selectedClient) &&
      (isAdmin(state.currentUser) ||
        (isManager(state.currentUser) &&
          canManagerAccessClient(state.currentUser, selectedClient)));
    const projectButton = refs.addProjectForm.querySelector("button");
    projectButton.disabled = !canCreateProject;
    projectButton.title = canCreateProject
      ? ""
      : selectedClient
        ? "Manager must be assigned to this client."
        : "Choose client first.";
    projectNameField.disabled = !canCreateProject;
    projectNameField.placeholder = selectedClient
      ? canCreateProject
        ? "Add project"
        : "Not assigned to this client"
      : "Choose client first";

    refs.projectList.innerHTML = projects.length
      ? projects
          .map(
            (project) => {
              const canEditProject = isAdmin(state.currentUser);
              const canDeleteProject =
                isAdmin(state.currentUser) ||
                (isManager(state.currentUser) &&
                  projectCreatedBy(selectedClient, project) === state.currentUser?.id);
              const canManageMembers =
                isAdmin(state.currentUser) ||
                (isManager(state.currentUser) &&
                  canManagerAccessProject(state.currentUser, selectedClient, project));
              const hasManagers = managerIdsForProject(selectedClient, project).length > 0;
              const hasStaff = staffIdsForProject(selectedClient, project).length > 0;
              const managerNames = formatNameList(
                userNamesForIds(managerIdsForProject(selectedClient, project))
              );
              const staffNames = formatNameList(
                userNamesForIds(staffIdsForProject(selectedClient, project))
              );

              return `
              <article
                class="catalog-item catalog-item-project"
                data-project="${escapeHtml(project)}"
              >
                <span class="catalog-item-copy">
                  <span class="catalog-item-title">${escapeHtml(project)}</span>
                  <small>${projectHours(selectedClient, project).toFixed(2)}h logged</small>
                  <div class="catalog-analytics-wrap">
                    <button
                      type="button"
                      class="catalog-analytics-button"
                      aria-disabled="true"
                      disabled
                    >
                      <span>Project</span>
                      <span>Analytics</span>
                    </button>
                  </div>
                  <span class="catalog-item-meta">
                    <span>Managers: ${escapeHtml(managerNames)}</span>
                    <span>Staff: ${escapeHtml(staffNames)}</span>
                  </span>
                </span>
                <span class="catalog-item-actions">
                  <button
                    type="button"
                    class="catalog-edit"
                    aria-label="Edit ${escapeHtml(project)}"
                    data-edit-project="${escapeHtml(project)}"
                    ${disabledButtonAttrs(canEditProject, "Admin only.")}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="catalog-delete"
                    aria-label="Delete ${escapeHtml(project)}"
                    data-delete-project="${escapeHtml(project)}"
                    ${disabledButtonAttrs(
                      canDeleteProject,
                      "Managers can only remove projects they created."
                    )}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    class="catalog-edit"
                    aria-label="Edit managers for ${escapeHtml(project)}"
                    data-edit-managers="${escapeHtml(project)}"
                    ${disabledButtonAttrs(canEditProject, "Admin only.")}
                  >
                    Assign/Unassign managers
                  </button>
                  <button
                    type="button"
                    class="catalog-edit"
                    aria-label="Edit members for ${escapeHtml(project)}"
                    data-edit-members="${escapeHtml(project)}"
                    ${disabledButtonAttrs(canManageMembers, "Manager access required.")}
                  >
                    Add/Remove members
                  </button>
                </span>
                <div class="catalog-analytics-footer">
                  <button
                    type="button"
                    class="catalog-analytics-button"
                    aria-disabled="true"
                    disabled
                  >
                    <span>Project</span>
                    <span>Analytics</span>
                  </button>
                </div>
              </article>
            `;
            }
          )
          .join("")
      : '<p class="empty-state">No projects configured for this client yet.</p>';
  }

  window.catalog = {
    openCatalogModal,
    closeCatalogModal,
    renderCatalogLists,
  };
})();
