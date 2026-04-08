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
    const departmentMap = (state.departments || []).reduce((acc, row) => {
      acc[row?.id != null ? String(row.id) : ""] = String(row?.name || "").trim();
      return acc;
    }, {});

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
          const clientLeadName = String(
            clientRow?.clientLeadName ||
              userNamesForIds([clientRow?.clientLeadId || clientRow?.client_lead_id])[0] ||
              ""
          ).trim();
          const clientIsActive = isClientActive(clientRow);
          const canEditClientCard = canManageClients && clientIsActive;
          const visibleProjectCount = visibleCatalogProjectNames(client, state.currentUser, { forCatalogView: true }).length;
          const secondaryBits = [
            `${visibleProjectCount} ${visibleProjectCount === 1 ? "project" : "projects"}`,
            clientOffice ? `Office: ${clientOffice}` : "",
          ].filter(Boolean);
          return `
          <article
            class="catalog-item${client === selectedClient ? " is-selected" : ""}${clientIsActive ? "" : " is-inactive"}"
            data-client="${escapeHtml(client)}"
            role="button"
            tabindex="0"
          >
            <span class="catalog-card-head">
              <span class="catalog-item-title">${escapeHtml(client)}</span>
              <button
                type="button"
                class="catalog-edit catalog-edit-inline"
                aria-label="Edit ${escapeHtml(client)}"
                data-edit-client="${escapeHtml(client)}"
                ${disabledButtonAttrs(
                  canEditClientCard,
                  clientIsActive ? "Admin only." : "Reactivate client to edit."
                )}
              >
                Edit
              </button>
            </span>
            <span class="catalog-item-copy">
              <small class="catalog-item-secondary">${escapeHtml(secondaryBits.join(" · "))}</small>
              <span class="catalog-client-footer-row">
                <small class="catalog-item-secondary" data-client-lead-line="1">Client Lead: ${escapeHtml(clientLeadName || "—")}</small>
                <span class="catalog-item-actions catalog-item-actions-bottom">
                  <span class="catalog-item-secondary-actions">
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
                </span>
              </span>
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
              const projectLeadName = String(
                projectRow?.projectLeadName ||
                  userNamesForIds([projectRow?.projectLeadId || projectRow?.project_lead_id])[0] ||
                  ""
              ).trim();
              const projectDepartmentName = String(
                projectRow?.projectDepartmentName ||
                  departmentMap[String(projectRow?.projectDepartmentId || projectRow?.project_department_id || "").trim()] ||
                  ""
              ).trim();
              const projectIsActive = isProjectActive(projectRow);
              const canEditProjectCard = canEditProject && projectIsActive;
              const canManageMembers =
                projectIsActive &&
                (isAdmin(state.currentUser) ||
                  isExecutive(state.currentUser) ||
                  (isManager(state.currentUser) &&
                    canManagerAccessProject(state.currentUser, selectedClient, project)));
              const hasManagers = managerIdsForProject(selectedClient, project).length > 0;
              const projectId = String(projectRow?.id || "").trim();
              const projectMemberIds = Array.from(
                new Set(
                  (state.assignments?.projectMembers || [])
                    .filter((item) => {
                      const itemProjectId = String(item?.projectId || item?.project_id || "").trim();
                      const itemClient = String(item?.client || "").trim();
                      const itemProject = String(item?.project || "").trim();
                      if (projectId && itemProjectId === projectId) {
                        return true;
                      }
                      return itemClient === selectedClient && itemProject === project;
                    })
                    .map((item) => String(item?.userId || "").trim())
                    .filter(Boolean)
                )
              );
              const hasStaff = projectMemberIds.length > 0;
              const managerNames = formatNameList(
                userNamesForIds(managerIdsForProject(selectedClient, project))
              );
              const staffNames = formatNameList(
                userNamesForIds(projectMemberIds)
              );
              const projectSecondaryBits = [
                projectOffice ? `Office: ${projectOffice}` : "",
                projectDepartmentName ? `Practice Department: ${projectDepartmentName}` : "",
              ].filter(Boolean);
              const teamBits = [
                `Project Lead: ${projectLeadName || "—"}`,
                `Managers: ${hasManagers ? managerNames : "—"}`,
                `Staff: ${hasStaff ? staffNames : "—"}`,
              ].filter(Boolean);

              return `
              <article
                class="catalog-item catalog-item-project${projectIsActive ? "" : " is-inactive"}"
                data-project="${escapeHtml(project)}"
              >
                <span class="catalog-card-head">
                  <span class="catalog-item-title">
                    ${escapeHtml(project)}
                    <small class="catalog-item-title-meta">${escapeHtml(`${projectHours(selectedClient, project).toFixed(2)}h logged`)}</small>
                  </span>
                  <button
                    type="button"
                    class="catalog-edit catalog-edit-inline"
                    aria-label="Edit ${escapeHtml(project)}"
                    data-edit-project="${escapeHtml(project)}"
                    ${disabledButtonAttrs(
                      canEditProjectCard,
                      projectIsActive ? "Admin only." : "Reactivate project to edit."
                    )}
                  >
                    Edit
                  </button>
                </span>
                <span class="catalog-item-copy">
                  ${
                    projectSecondaryBits.length
                      ? `<small class="catalog-item-secondary">${escapeHtml(projectSecondaryBits.join(" · "))}</small>`
                      : ""
                  }
                  <span class="catalog-item-meta catalog-item-people">
                    <span data-project-lead-line="1">${escapeHtml(teamBits[0])}</span>
                    <span>${escapeHtml(teamBits[1])}</span>
                    <span>${escapeHtml(teamBits[2])}</span>
                  </span>
                  <span class="catalog-project-footer-row">
                    <span class="catalog-item-actions catalog-item-actions-bottom">
                      <span class="catalog-item-secondary-actions">
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
                    </span>
                  </span>
                </span>
              </article>
            `;
            }
          )
          .join("")
      : `<p class="empty-state">${
          state.catalogProjectLifecycleView === "inactive"
            ? "No inactive projects for this client"
            : "No projects configured for this client yet."
        }</p>`;
  }

  window.catalog = {
    openCatalogModal,
    closeCatalogModal,
    renderCatalogLists,
  };
})();
