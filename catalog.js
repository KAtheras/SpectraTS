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
      escapeHtml,
      field,
      ensureCatalogSelection,
    } = deps;
    const officeMap = (state.officeLocations || []).reduce((acc, loc) => {
      acc[loc.id != null ? String(loc.id) : ""] = loc.name;
      return acc;
    }, {});
    const officeName = (id) => officeMap[id != null ? String(id) : ""] || "";

    const clients = visibleCatalogClientNames(state.currentUser, { forCatalogView: true });
    const canManageClients = isAdmin(state.currentUser) || isExecutive(state.currentUser);

    if (!clients.length) {
      refs.clientList.innerHTML = '<p class="empty-state">No clients yet.</p>';
      refs.projectList.innerHTML =
        '<p class="empty-state">Add an entry to start building the client catalog.</p>';
      refs.projectColumnLabel.textContent = "Projects";
      return;
    }

    ensureCatalogSelection();
    const selectedClient = state.selectedCatalogClient;
    const projects = visibleCatalogProjectNames(selectedClient, state.currentUser, { forCatalogView: true });

    const projectBudgetMap = (state.projects || []).reduce((acc, project) => {
      if (project && project.client === selectedClient) {
        acc[project.name] = Number.isFinite(project.budget) ? Number(project.budget) : null;
      }
      return acc;
    }, {});

    refs.clientList.innerHTML = clients
      .map(
        (client) => {
          const clientRow = state.clients.find((c) => c.name === client) || null;
          const clientOffice = officeName(clientRow?.officeId);
          const clientIsActive = isClientActive(clientRow);
          const visibleProjectCount = visibleCatalogProjectNames(client, state.currentUser, { forCatalogView: true }).length;
          return `
          <article
            class="catalog-item${client === selectedClient ? " is-selected" : ""}${clientIsActive ? "" : " is-inactive"}"
            data-client="${escapeHtml(client)}"
            role="button"
            tabindex="0"
          >
              <span class="catalog-item-copy">
                <span class="catalog-item-heading">
                  <span class="catalog-item-title">${escapeHtml(client)}</span>
                </span>
                <small>${visibleProjectCount} ${
                  visibleProjectCount === 1 ? "project" : "projects"
                }</small>
                ${clientOffice ? `<small>Office: ${escapeHtml(clientOffice)}</small>` : ""}
              </span>
            <span class="catalog-item-actions">
              <button
                type="button"
                class="catalog-edit catalog-edit-inline"
                aria-label="Edit ${escapeHtml(client)}"
                data-edit-client="${escapeHtml(client)}"
                ${disabledButtonAttrs(canManageClients, "Admin only.")}
              >
                Edit
              </button>
              <button
                type="button"
                class="catalog-edit"
                aria-label="${clientIsActive ? "Deactivate" : "Reactivate"} ${escapeHtml(client)}"
                data-${clientIsActive ? "deactivate-client" : "reactivate-client"}="${escapeHtml(client)}"
                ${disabledButtonAttrs(canManageClients, "Admin only.")}
              >
                ${clientIsActive ? "Deactivate" : "Reactivate"}
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
    const canAddClient = isAdmin(state.currentUser) || isExecutive(state.currentUser);
    const clientNameField = field(refs.addClientForm, "client_name");
    const addClientButton = refs.addClientForm?.querySelector("button");
    if (clientNameField && addClientButton) {
      clientNameField.disabled = !canAddClient;
      addClientButton.disabled = !canAddClient;
      const reason = "Admin only.";
      clientNameField.title = canAddClient ? "" : reason;
      addClientButton.title = canAddClient ? "" : reason;
    }
    const canCreateProject =
      Boolean(selectedClient) &&
      isClientActive(state.clients.find((c) => c.name === selectedClient)) &&
      (isAdmin(state.currentUser) ||
        isExecutive(state.currentUser) ||
        (isManager(state.currentUser) &&
          canManagerAccessClient(state.currentUser, selectedClient)));
    const projectButton = document.getElementById("add-project-header-button");
    if (projectButton) {
      projectButton.disabled = !canCreateProject;
      projectButton.title = canCreateProject
        ? ""
        : selectedClient
          ? "Manager must be assigned to this client."
          : "Choose client first.";
    }

    refs.projectList.innerHTML = projects.length
      ? projects
          .map(
            (project) => {
              const projectOffice = officeName(
                (state.projects || []).find(
                  (p) => p.client === selectedClient && p.name === project
                )?.officeId ||
                  (state.clients.find((c) => c.name === selectedClient) || {}).officeId
              );
              const canEditProject = isAdmin(state.currentUser) || isExecutive(state.currentUser);
              const canDeleteProject =
                isAdmin(state.currentUser) ||
                isExecutive(state.currentUser) ||
                (isManager(state.currentUser) &&
                  projectCreatedBy(selectedClient, project) === state.currentUser?.id);
              const projectRow = (state.projects || []).find(
                (p) => p.client === selectedClient && p.name === project
              );
              const projectIsActive = isProjectActive(projectRow);
              const canManageMembers =
                projectIsActive &&
                (isAdmin(state.currentUser) ||
                  isExecutive(state.currentUser) ||
                  (isManager(state.currentUser) &&
                    canManagerAccessProject(state.currentUser, selectedClient, project)));
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
                class="catalog-item catalog-item-project${projectIsActive ? "" : " is-inactive"}"
                data-project="${escapeHtml(project)}"
              >
                <div class="catalog-project-top">
                  <span class="catalog-item-copy">
                    <span class="catalog-item-heading">
                      <span class="catalog-item-title">${escapeHtml(project)}</span>
                    </span>
                    <small>${projectHours(selectedClient, project).toFixed(2)}h logged</small>
                    ${projectOffice ? `<small>Office: ${escapeHtml(projectOffice)}</small>` : ""}
                    ${
                      projectBudgetMap[project] !== undefined
                        ? `<small>Budget: ${
                            projectBudgetMap[project] === null
                              ? "—"
                              : `$${projectBudgetMap[project].toFixed(2)}`
                          }</small>`
                        : ""
                    }
                    <span class="catalog-item-meta">
                      <span>Managers: ${escapeHtml(managerNames)}</span>
                      <span>Staff: ${escapeHtml(staffNames)}</span>
                    </span>
                  </span>
                  <span class="catalog-item-actions">
                    <button
                      type="button"
                      class="catalog-edit catalog-edit-inline"
                      aria-label="Edit ${escapeHtml(project)}"
                      data-edit-project="${escapeHtml(project)}"
                      ${disabledButtonAttrs(canEditProject, "Admin only.")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="catalog-edit"
                      aria-label="View time for ${escapeHtml(project)}"
                      data-view-time-project="${escapeHtml(project)}"
                    >
                      View Time
                    </button>
                    <button
                      type="button"
                      class="catalog-edit"
                      aria-label="View expenses for ${escapeHtml(project)}"
                      data-view-expenses-project="${escapeHtml(project)}"
                    >
                      View Expenses
                    </button>
                    <button
                      type="button"
                      class="catalog-edit"
                      aria-label="${projectIsActive ? "Deactivate" : "Reactivate"} ${escapeHtml(project)}"
                      data-${projectIsActive ? "deactivate-project" : "reactivate-project"}="${escapeHtml(project)}"
                      ${disabledButtonAttrs(
                        canDeleteProject,
                        "Managers can only manage projects they created."
                      )}
                    >
                      ${projectIsActive ? "Deactivate" : "Reactivate"}
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
                      aria-label="Add member to ${escapeHtml(project)}"
                      data-add-member="${escapeHtml(project)}"
                      ${disabledButtonAttrs(canManageMembers, "Manager access required.")}
                    >
                      Add Member
                    </button>
                    <button
                      type="button"
                      class="catalog-edit"
                      aria-label="Remove member from ${escapeHtml(project)}"
                      data-remove-member="${escapeHtml(project)}"
                      ${disabledButtonAttrs(canManageMembers, "Manager access required.")}
                    >
                      Remove Member
                    </button>
                  </span>
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
