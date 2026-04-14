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
      projectHours,
      formatNameList,
      userNamesForIds,
      managerIdsForProject,
      staffIdsForProject,
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

    const clients = visibleCatalogClientNames({ forCatalogView: true });
    const canManageClientsLifecycle = Boolean(state.permissions?.manage_clients_lifecycle);
    const canEditClient = Boolean(state.permissions?.edit_clients);
    const canManageProjectsLifecycle = Boolean(state.permissions?.manage_projects_lifecycle);
    const canEditProjectsAllModal = Boolean(state.permissions?.edit_projects_all_modal);

    if (!clients.length) {
      refs.clientList.innerHTML = '<p class="empty-state">No clients yet.</p>';
      refs.projectList.innerHTML =
        '<p class="empty-state">Add an entry to start building the client catalog.</p>';
      refs.projectColumnLabel.textContent = "Projects";
      return;
    }

    ensureCatalogSelection();
    const selectedClient = state.selectedCatalogClient;
    const projects = visibleCatalogProjectNames(selectedClient, { forCatalogView: true });

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
          const canEditClientCard = canEditClient && clientIsActive;
          const showClientLifecycleAction = canManageClientsLifecycle;
          const showClientRemoveAction = canManageClientsLifecycle;
          const visibleProjectCount = visibleCatalogProjectNames(client, { forCatalogView: true }).length;
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
	              ${
                  canEditClientCard
                    ? `<button
	                type="button"
	                class="catalog-edit catalog-edit-inline"
	                aria-label="Edit ${escapeHtml(client)}"
	                data-edit-client="${escapeHtml(client)}"
	              >
	                Edit
	              </button>`
                    : ""
                }
            </span>
            <span class="catalog-item-copy">
              <small class="catalog-item-secondary">${escapeHtml(secondaryBits.join(" · "))}</small>
              <span class="catalog-client-footer-row">
                <small class="catalog-item-secondary" data-client-lead-line="1">Client Lead: ${escapeHtml(clientLeadName || "—")}</small>
                <span class="catalog-item-actions catalog-item-actions-bottom">
                  <span class="catalog-item-secondary-actions">
	                    ${
                        showClientLifecycleAction
                          ? `<button
	                      type="button"
	                      class="catalog-edit"
	                      aria-label="${clientIsActive ? "Deactivate" : "Reactivate"} ${escapeHtml(client)}"
	                      data-${clientIsActive ? "deactivate-client" : "reactivate-client"}="${escapeHtml(client)}"
	                    >
	                      ${clientIsActive ? "Deactivate" : "Reactivate"}
	                    </button>`
                          : ""
                      }
	                    ${
                        showClientRemoveAction
                          ? `<button
	                      type="button"
	                      class="catalog-delete"
	                      aria-label="Delete ${escapeHtml(client)}"
	                      data-delete-client="${escapeHtml(client)}"
	                    >
	                      Remove
	                    </button>`
                          : ""
                      }
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
	    const canAddClient = canManageClientsLifecycle;
    const clientNameField = field(refs.addClientForm, "client_name");
    const addClientButton = refs.addClientForm?.querySelector("button");
    if (clientNameField && addClientButton) {
      clientNameField.disabled = !canAddClient;
      addClientButton.disabled = !canAddClient;
	      const reason = "Access denied.";
	      clientNameField.title = canAddClient ? "" : reason;
	      addClientButton.title = canAddClient ? "" : reason;
	    }
	    const canCreateProject =
	      Boolean(selectedClient) &&
	      isClientActive(state.clients.find((c) => c.name === selectedClient)) &&
	      canManageProjectsLifecycle;
	    const projectButton = document.getElementById("add-project-header-button");
	    if (projectButton) {
	      projectButton.hidden = !canCreateProject;
	      projectButton.disabled = false;
	      projectButton.title = "";
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
              const projectRow = (state.projects || []).find(
                (p) => p.client === selectedClient && p.name === project
              );
	              const isLeadForProject = (() => {
                  const leadId = String(projectRow?.projectLeadId || projectRow?.project_lead_id || "").trim();
                  const currentUserId = String(state.currentUser?.id || "").trim();
                  return Boolean(leadId && currentUserId && leadId === currentUserId);
                })();
	              const canEditProject = Boolean(
                  canEditProjectsAllModal || isLeadForProject
                );
	              const canDeleteProject = canManageProjectsLifecycle;
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
	                (Boolean(state.permissions?.assign_project_members) ||
	                  Boolean(state.permissions?.assign_project_managers));
              const showEditProjectAction = canEditProjectCard;
              const showProjectLifecycleActions = canDeleteProject;
              const showAddMemberAction = canManageMembers && Boolean(state.permissions?.assign_project_members);
              const showRemoveMemberAction = canManageMembers && Boolean(state.permissions?.assign_project_members);
              const managerIds = managerIdsForProject(selectedClient, project);
              const projectStaffIds = staffIdsForProject(selectedClient, project);
              const hasManagers = managerIds.length > 0;
              const hasStaff = projectStaffIds.length > 0;
              const managerNames = formatNameList(
                userNamesForIds(managerIds)
              );
              const staffNames = formatNameList(
                userNamesForIds(projectStaffIds)
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
              const rawPercentComplete = projectRow?.percentComplete ?? projectRow?.percent_complete;
              const hasPercentComplete =
                rawPercentComplete !== null &&
                rawPercentComplete !== undefined &&
                String(rawPercentComplete).trim() !== "" &&
                Number.isFinite(Number(rawPercentComplete));
              const percentCompleteDisplay = hasPercentComplete
                ? `${Number(rawPercentComplete).toFixed(2).replace(/\.?0+$/, "")}%`
                : "—";

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
	                  ${
                      showEditProjectAction
                        ? `<button
	                    type="button"
	                    class="catalog-edit catalog-edit-inline"
	                    aria-label="Edit ${escapeHtml(project)}"
	                    data-edit-project="${escapeHtml(project)}"
	                  >
	                    Edit
	                  </button>`
                        : ""
                    }
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
                    <span>
                      ${escapeHtml(`% Complete: ${percentCompleteDisplay}`)}
                      ${
                        canEditProjectCard
                          ? `<button
                          type="button"
                          class="catalog-edit catalog-edit-inline"
                          aria-label="Update progress for ${escapeHtml(project)}"
                          data-update-project-progress="${escapeHtml(project)}"
                        >
                          Update
                        </button>`
                          : ""
                      }
                    </span>
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
	                        ${
                            showProjectLifecycleActions
                              ? `<button
	                          type="button"
	                          class="catalog-edit"
	                          aria-label="${projectIsActive ? "Deactivate" : "Reactivate"} ${escapeHtml(project)}"
	                          data-${projectIsActive ? "deactivate-project" : "reactivate-project"}="${escapeHtml(project)}"
	                        >
	                          ${projectIsActive ? "Deactivate" : "Reactivate"}
	                        </button>
	                        <button
	                          type="button"
	                          class="catalog-delete"
	                          aria-label="Delete ${escapeHtml(project)}"
	                          data-delete-project="${escapeHtml(project)}"
	                        >
	                          Remove
	                        </button>`
                              : ""
                          }
	                        ${
                            showAddMemberAction
                              ? `<button
	                          type="button"
	                          class="catalog-edit"
	                          aria-label="Add member to ${escapeHtml(project)}"
	                          data-add-member="${escapeHtml(project)}"
	                        >
	                          Add Member
	                        </button>`
                              : ""
                          }
	                        ${
                            showRemoveMemberAction
                              ? `<button
	                          type="button"
	                          class="catalog-edit"
	                          aria-label="Remove member from ${escapeHtml(project)}"
	                          data-remove-member="${escapeHtml(project)}"
	                        >
	                          Remove Member
	                        </button>`
                              : ""
                          }
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
