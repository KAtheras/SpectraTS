(function () {
  const deps = () => window.timeEntriesDeps || {};

  function currentEntries(filterOverrides) {
    const { state, effectiveScopeUser } = deps();
    const scopeUser =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    const filters = {
      ...(state.filters || {}),
      ...(filterOverrides || {}),
    };
    const search = String(filters.search || "").trim().toLowerCase();

    const {
      getUserByDisplayName,
      canViewUserByRole,
      assignedProjectTuplesForCurrentUser,
      isAdmin,
      isExecutive,
      getUserById: injectedGetUserById,
    } = deps();
    const allowedTupleKeys = new Set(
      (typeof assignedProjectTuplesForCurrentUser === "function"
        ? assignedProjectTuplesForCurrentUser()
        : []
      ).map((item) => `${item?.client || ""}::${item?.project || ""}`)
    );

    const getUserById =
      typeof injectedGetUserById === "function"
        ? injectedGetUserById
        : (id) => state.users?.find((u) => u.id === id);

    return [...state.entries]
      .filter((entry) => {
        const targetUser =
          (entry.userId ? getUserById?.(entry.userId) : null) ||
          getUserByDisplayName(entry.user) ||
          (scopeUser && entry.user === scopeUser.displayName
            ? scopeUser
            : null);

        const canView =
          typeof canViewUserByRole === "function"
            ? canViewUserByRole(scopeUser, targetUser)
            : true;

        if (!canView) {
          return false;
        }
        const canBypassProjectScope =
          (typeof isAdmin === "function" && isAdmin(scopeUser)) ||
          (typeof isExecutive === "function" && isExecutive(scopeUser));
        const entryClient = `${entry.client || ""}`.trim();
        const entryProject = `${entry.project || ""}`.trim();
        const isInternalEntry = !entryClient && !entryProject;
        if (
          !canBypassProjectScope &&
          allowedTupleKeys.size &&
          !isInternalEntry &&
          !allowedTupleKeys.has(`${entry.client || ""}::${entry.project || ""}`)
        ) {
          return false;
        }
        if (filters.user && entry.user !== filters.user) {
          return false;
        }
        if (filters.client && entry.client !== filters.client) {
          return false;
        }
        if (filters.project && entry.project !== filters.project) {
          return false;
        }
        if (filters.from && entry.date < filters.from) {
          return false;
        }
        if (filters.to && entry.date > filters.to) {
          return false;
        }
        if (!search) {
          return true;
        }

        const haystack = [
          entry.user,
          entry.client,
          entry.project,
          entry.task,
          entry.notes,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (a.date === b.date) {
          return b.createdAt.localeCompare(a.createdAt);
        }
      return b.date.localeCompare(a.date);
    });
  }

  function renderFilterState(filteredEntries) {
    const { state, formatDisplayDate, refs, escapeHtml } = deps();
    const chips = [];
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
    if (state.filters.user) {
      chips.push(`User: ${state.filters.user}`);
    }
    if (state.filters.client) {
      chips.push(`Client: ${state.filters.client}`);
    }
    if (state.filters.project) {
      chips.push(`Project: ${state.filters.project}`);
    }
    if (state.filters.from) {
      chips.push(`From ${formatDisplayDate(state.filters.from)}`);
    }
    if (state.filters.to) {
      chips.push(`To ${formatDisplayDate(state.filters.to)}`);
    }
    if (state.filters.search.trim()) {
      chips.push(`Search: ${state.filters.search.trim()}`);
    }

    refs.filterTotalHours.textContent = `Total hours: ${totalHours.toFixed(2)}`;

    refs.activeFilters.hidden = chips.length === 0;
    refs.activeFilters.innerHTML = chips
      .map((chip) => `<span class="filter-pill">${escapeHtml(chip)}</span>`)
      .join("");
  }

  function canManageApproval(entry) {
    const {
      state,
      permissionGroupForUser,
      getUserByDisplayName,
      canUserAccessProject,
      isAdmin,
      effectiveScopeUser,
    } = deps();
    const current =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    if (!current) {
      return false;
    }
    if (!entry) {
      return false;
    }

    const currentGroup = permissionGroupForUser(current);
    const targetUser = getUserByDisplayName(entry.user);
    const targetGroup = permissionGroupForUser(targetUser);

    if (current.displayName === entry.user) {
      return false;
    }

    if (currentGroup === "staff") {
      return false;
    }

    if (currentGroup === "manager") {
      if (targetGroup !== "staff") {
        return false;
      }
      return canUserAccessProject(current, entry.client, entry.project);
    }

    if (currentGroup === "executive" || currentGroup === "admin") {
      if (!isAdmin(current) && !canUserAccessProject(current, entry.client, entry.project)) {
        return false;
      }
      return true;
    }

    return false;
  }

  function canApproveEntry(entry) {
    return entry.status !== "approved" && canManageApproval(entry);
  }

  function canUnapproveEntry(entry) {
    return entry.status === "approved" && canManageApproval(entry);
  }

  function showApproveButton(entry) {
    return canApproveEntry(entry);
  }

  function renderTable(filteredEntries) {
    const { refs, state, escapeHtml, formatDisplayDateShort } = deps();
    if (!filteredEntries.length) {
      refs.entriesBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-row">
            <div class="empty-state-panel">
              <strong>No entries match the current filters.</strong>
              <span>Clear the filters or add a new entry to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Store full-range dates (unfiltered) for picker bounds
    if (refs.entriesBody) {
      const dates = state.entries.map((e) => e.date).sort();
      refs.entriesBody.dataset.rangeMin = dates[0] || "";
      refs.entriesBody.dataset.rangeMax = dates[dates.length - 1] || "";
    }

    refs.entriesBody.innerHTML = filteredEntries
      .map((entry) => {
        const projectId = `${entry?.projectId || entry?.project_id || ""}`.trim();
        const chargeCenterId = `${entry?.chargeCenterId || entry?.charge_center_id || ""}`.trim();
        const clientLabel = `${entry.client || ""}`.trim() || "Internal";
        const projectLabel = `${entry.project || ""}`.trim() || `${entry.task || ""}`.trim() || "Internal";
        const isInternalEntry = Boolean(chargeCenterId);
        const statusMarkup = isInternalEntry
          ? ""
          : `<span
                class="entry-status entry-status-${entry.status} ${
                  canManageApproval(entry) ? "entry-status-clickable" : ""
                }"
                ${canManageApproval(entry) ? `data-action="toggle-status" data-id="${entry.id}" role="button" tabindex="0"` : ""}
                aria-label="${entry.status === "approved" ? "Approved" : "Pending"}"
              >
                ${entry.status === "approved" ? "Approved" : "Pending"}
              </span>`;
        return `
          <tr class="entry-row ${entry.status === "approved" ? "entry-approved" : ""}">
            <td>${escapeHtml(formatDisplayDateShort(entry.date))}</td>
            <td>${escapeHtml(entry.user)}</td>
            <td class="${isInternalEntry ? "entry-cell-truncate" : ""}"${
              isInternalEntry ? ` title="${escapeHtml(clientLabel)}"` : ""
            }>${escapeHtml(clientLabel)}</td>
            <td class="${isInternalEntry ? "entry-cell-truncate" : ""}"${
              isInternalEntry ? ` title="${escapeHtml(projectLabel)}"` : ""
            }>${escapeHtml(projectLabel)}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>
              <span
                class="billable-pill ${entry.billable === false ? "is-nonbillable" : "is-billable"} is-clickable"
                data-action="toggle-billable"
                data-id="${entry.id}"
                role="button"
                aria-label="${entry.billable === false ? "Mark as billable" : "Mark as non-billable"}"
                tabindex="0"
              >
                ${entry.billable === false ? "Non-billable" : "Billable"}
              </span>
            </td>
            <td class="notes-cell">
              ${
                entry.notes && entry.notes.trim()
                  ? `<button class="note-button" type="button" data-action="note" data-id="${entry.id}" aria-label="View note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8M8 14h5" />
                      </svg>
                    </button>`
                  : `<button class="note-button note-button--empty" type="button" data-action="note" data-id="${entry.id}" aria-label="Add note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8" />
                      </svg>
                    </button>`
              }
            </td>
            <td class="${isInternalEntry ? "entry-status-empty-cell" : ""}">
              ${statusMarkup}
            </td>
            <td class="actions-cell">
              <button class="text-button" type="button" data-action="edit" data-id="${entry.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="delete" data-id="${entry.id}">
                Delete
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function resetForm() {
    const {
      refs,
      state,
      syncFormCatalogsUI,
      defaultEntryUser,
      clampDateToBounds,
      today,
      field,
      renderHourSelection,
      setNonBillableDefault,
    } = deps();
    if (!refs.form) {
      state.editingId = null;
      return;
    }
    refs.form.reset();
    state.editingId = null;
    syncFormCatalogsUI({
      user: defaultEntryUser(state),
      client: "",
      project: "",
    });
    if (refs.entryDate) {
      refs.entryDate.value = clampDateToBounds(today);
    }
    field(refs.form, "hours").value = "";
    refs.otherHours.value = "";
    renderHourSelection?.({ refs, field });
    setNonBillableDefault(field(refs.form, "project")?.value || "");
    if (refs.formHeading) refs.formHeading.textContent = "Add time";
    if (refs.submitEntry) refs.submitEntry.textContent = "Save";
    if (refs.cancelEdit) refs.cancelEdit.hidden = true;
  }

  function setForm(entry) {
    const {
      refs,
      state,
      syncFormCatalogsUI,
      clampDateToBounds,
      field,
      renderHourSelection,
      setNonBillableDefault,
      QUICK_HOUR_PRESETS,
    } = deps();
    if (!refs.form) {
      return;
    }
    syncFormCatalogsUI({
      user: entry.user,
      client: entry.client,
      project: entry.project,
    });
    if (refs.entryDate) {
      refs.entryDate.value = clampDateToBounds(entry.date);
    }
    field(refs.form, "hours").value = entry.hours;
    field(refs.form, "notes").value = entry.notes;
    if (refs.otherHours) {
      refs.otherHours.value = QUICK_HOUR_PRESETS.has(String(entry.hours)) ? "" : String(entry.hours);
    }
    renderHourSelection?.({ refs, field });
    if (refs.entryNonBillable) {
      refs.entryNonBillable.checked = entry.billable === false;
    }
    state.editingId = entry.id;
    if (refs.formHeading) refs.formHeading.textContent = "Edit time";
    if (refs.submitEntry) refs.submitEntry.textContent = "Save";
    if (refs.cancelEdit) refs.cancelEdit.hidden = false;
    const formCard = refs.form?.closest(".panel") || refs.form;
    formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateEntry(data) {
    if (!data.user) {
      return "Team member is required.";
    }
    if (!data.date) {
      return "Date is required.";
    }
    if (!Number.isFinite(data.hours) || data.hours <= 0 || data.hours > 24) {
      return "Hours must be between 0.25 and 24.";
    }
    return "";
  }

  window.timeEntries = {
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
  };
})();
