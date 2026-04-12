(function () {
  const deps = () => window.expensesDeps || {};

  function isInternalExpense(expense) {
    const clientName = `${expense?.clientName || ""}`.trim().toLowerCase();
    const projectName = `${expense?.projectName || ""}`.trim();
    if (clientName === "internal") return true;
    return clientName === "" && projectName === "";
  }

  function activeExpenseCategories() {
    const { state } = deps();
    return (state.expenseCategories || []).filter((c) => c?.isActive !== false);
  }

  function syncExpenseCatalogs({ userId, client, project }) {
    const {
      setSelectOptionsWithPlaceholder,
      escapeHtml,
      refs,
      entryUserOptions,
      getUserByDisplayName,
      state,
      assignedProjectTuplesForCurrentUser,
      effectiveScopeUser,
    } = deps();
    const comboField = refs.expenseClientProject || document.getElementById("expense-client-project");
    const comboKey = "::";
    const encodeCombo = (clientName, projectName) =>
      `${encodeURIComponent(clientName)}${comboKey}${encodeURIComponent(projectName)}`;
    const decodeCombo = (value) => {
      const text = String(value || "");
      const splitAt = text.indexOf(comboKey);
      if (splitAt < 0) return ["", ""];
      return [
        decodeURIComponent(text.slice(0, splitAt) || ""),
        decodeURIComponent(text.slice(splitAt + comboKey.length) || ""),
      ];
    };
    const scopeUser =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    const effectiveUserId = `${userId || scopeUser?.id || state.currentUser?.id || ""}`.trim();
    let requestedClient = client;
    let requestedProject = project;
    if ((requestedClient === undefined || requestedProject === undefined) && comboField?.value) {
      const [comboClient, comboProject] = decodeCombo(comboField.value);
      if (requestedClient === undefined) requestedClient = comboClient;
      if (requestedProject === undefined) requestedProject = comboProject;
    }
    requestedClient = requestedClient || "";
    requestedProject = requestedProject || "";
    const assignedTuplesRaw =
      typeof assignedProjectTuplesForCurrentUser === "function"
        ? assignedProjectTuplesForCurrentUser()
        : [];
    const assignedTupleKeys = new Set();
    const assignedTuples = assignedTuplesRaw.filter((item) => {
      const clientName = item?.client || "";
      const projectName = item?.project || "";
      if (!clientName || !projectName) return false;
      const key = `${clientName}::${projectName}`;
      if (assignedTupleKeys.has(key)) return false;
      assignedTupleKeys.add(key);
      return true;
    });
    const clients = Array.from(new Set(assignedTuples.map((item) => item.client))).sort((a, b) =>
      a.localeCompare(b)
    );
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseClient, clients, requestedClient, "Select client");
    if (requestedClient && clients.includes(requestedClient)) {
      refs.expenseClient.value = requestedClient;
    }

    const hasClient = Boolean(requestedClient);
    const projects = hasClient
      ? assignedTuples
          .filter((item) => item.client === requestedClient)
          .map((item) => item.project)
          .sort((a, b) => a.localeCompare(b))
      : [];
    const placeholder = hasClient ? "Select project" : "Choose client first";
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseProject, projects, requestedProject, placeholder);
    if (refs.expenseProject) {
      refs.expenseProject.disabled = !hasClient;
    }
    if (hasClient && requestedProject && projects.includes(requestedProject)) {
      refs.expenseProject.value = requestedProject;
    } else if (hasClient && !refs.expenseProject?.value && projects.length) {
      refs.expenseProject.value = projects[0];
    } else if (!hasClient && refs.expenseProject) {
      refs.expenseProject.value = "";
    }
    const comboOptions = clients.flatMap((clientName) =>
      assignedTuples
        .filter((item) => item.client === clientName)
        .map((item) => item.project)
        .sort((a, b) => a.localeCompare(b))
        .map((projectName) => ({
        label: `${clientName} / ${projectName}`,
        value: encodeCombo(clientName, projectName),
      }))
    );
    if (comboField) {
      const selectedCombo = refs.expenseClient?.value && refs.expenseProject?.value
        ? encodeCombo(refs.expenseClient.value, refs.expenseProject.value)
        : "";
      setSelectOptionsWithPlaceholder(
        { escapeHtml },
        comboField,
        comboOptions,
        selectedCombo,
        "Select client / project"
      );
      comboField.disabled = comboOptions.length === 0;
      if (!comboField.dataset.boundCombo) {
        comboField.addEventListener("change", function () {
          const [comboClient, comboProject] = decodeCombo(comboField.value);
          syncExpenseCatalogs({
            userId: effectiveUserId,
            client: comboClient || "",
            project: comboProject || "",
          });
          refs.expenseClient?.dispatchEvent(new Event("change", { bubbles: true }));
          refs.expenseProject?.dispatchEvent(new Event("change", { bubbles: true }));
        });
        comboField.dataset.boundCombo = "true";
      }
    }

    const users = entryUserOptions();
    setSelectOptionsWithPlaceholder(
      { escapeHtml },
      refs.expenseUser,
      users.map((name) => {
        const user = getUserByDisplayName(name);
        return { label: name, value: user?.id || name };
      }),
      userId || "",
      "Select team member"
    );
    if (refs.expenseUser) {
      refs.expenseUser.value = effectiveUserId;
      refs.expenseUser.disabled = true;
    }

    const categories = activeExpenseCategories().map((c) => c.name);
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseCategory, categories, "", "Select category");
  }

  function resetExpenseForm() {
    const { refs, state, clampDateToBounds, today, setExpenseNonBillableDefault, effectiveScopeUser } = deps();
    if (!refs.expenseForm) return;
    refs.expenseForm.reset();
    state.expenseEditingId = null;
    const scopeUser =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    const defaultUserId = `${scopeUser?.id || state.currentUser?.id || ""}`.trim();
    if (refs.expenseUser) {
      refs.expenseUser.value = defaultUserId;
    }
    if (refs.expenseDate) {
      const expenseToday = clampDateToBounds(today);
      refs.expenseDate.value = expenseToday;
      refs.expenseDate.defaultValue = expenseToday;
    }
    syncExpenseCatalogs({
      userId: refs.expenseUser?.value || "",
      client: "",
      project: "",
    });
    setExpenseNonBillableDefault(refs.expenseProject?.value || "");
    if (refs.expenseFormHeading) {
      refs.expenseFormHeading.textContent = "Add expense";
    }
    if (refs.submitExpense) {
      refs.submitExpense.textContent = "Save expense";
    }
    if (refs.expenseCancelEdit) {
      refs.expenseCancelEdit.hidden = true;
    }
  }

  function setExpenseForm(expense) {
    const { refs, clampDateToBounds, setExpenseNonBillableDefault, state } = deps();
    if (!expense || !refs.expenseForm) return;
    syncExpenseCatalogs({
      userId: expense.userId,
      client: expense.clientName,
      project: expense.projectName,
    });
    if (refs.expenseUser) refs.expenseUser.value = expense.userId;
    if (refs.expenseDate) refs.expenseDate.value = clampDateToBounds(expense.expenseDate);
    if (refs.expenseCategory) refs.expenseCategory.value = expense.category;
    if (refs.expenseAmount) refs.expenseAmount.value = expense.amount;
    if (refs.expenseNotes) refs.expenseNotes.value = expense.notes || "";
    if (refs.expenseNonBillable)
      refs.expenseNonBillable.checked = expense.isBillable === false;
    state.expenseEditingId = expense.id;
    if (refs.expenseFormHeading) refs.expenseFormHeading.textContent = "Edit expense";
    if (refs.submitExpense) refs.submitExpense.textContent = "Save expense";
    if (refs.expenseCancelEdit) refs.expenseCancelEdit.hidden = false;
    const formCard = refs.expenseForm.closest(".panel");
    formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
    setExpenseNonBillableDefault(refs.expenseProject?.value || "");
  }

  function currentExpenses(filterOverrides) {
    const { state, effectiveScopeUser } = deps();
    const scopeUser =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    const filters = {
      ...(state.expenseFilters || {}),
      ...(filterOverrides || {}),
    };
    const search = String(filters.search || "").trim().toLowerCase();

    const { canViewEntryByScope } = deps();

    return [...state.expenses]
      .filter((expense) => {
        const canView = typeof canViewEntryByScope === "function"
          ? canViewEntryByScope(scopeUser, {
              userId: expense.userId,
              client: expense.clientName,
              project: expense.projectName,
            })
          : true;
        if (!canView) {
          return false;
        }
        if (filters.user && expense.userId !== filters.user) {
          return false;
        }
        if (filters.client && expense.clientName !== filters.client) {
          return false;
        }
        if (filters.project && expense.projectName !== filters.project) {
          return false;
        }
        if (filters.from && expense.expenseDate < filters.from) {
          return false;
        }
        if (filters.to && expense.expenseDate > filters.to) {
          return false;
        }
        if (!search) {
          return true;
        }
        const haystack = [
          userNameById(expense.userId),
          expense.clientName,
          expense.projectName,
          expense.category,
          expense.notes,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (a.expenseDate === b.expenseDate) {
          return b.createdAt?.localeCompare(a.createdAt || "") || 0;
        }
        return b.expenseDate.localeCompare(a.expenseDate);
      });
  }

  function renderExpenseFilterState(filteredExpenses) {
    const { refs, state, formatDisplayDate, escapeHtml } = deps();
    if (!refs.expenseFilterTotal || !refs.expenseActiveFilters) return;
    const chips = [];
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    if (state.expenseFilters.user) {
      chips.push(`User: ${userNameById(state.expenseFilters.user) || state.expenseFilters.user}`);
    }
    if (state.expenseFilters.client) {
      chips.push(`Client: ${state.expenseFilters.client}`);
    }
    if (state.expenseFilters.project) {
      chips.push(`Project: ${state.expenseFilters.project}`);
    }
    if (state.expenseFilters.from) {
      chips.push(`From ${formatDisplayDate(state.expenseFilters.from)}`);
    }
    if (state.expenseFilters.to) {
      chips.push(`To ${formatDisplayDate(state.expenseFilters.to)}`);
    }
    if (state.expenseFilters.search.trim()) {
      chips.push(`Search: ${state.expenseFilters.search.trim()}`);
    }

    refs.expenseFilterTotal.textContent = `Total amount: $${totalAmount.toFixed(2)}`;
    refs.expenseActiveFilters.hidden = chips.length === 0;
    refs.expenseActiveFilters.innerHTML = chips
      .map((chip) => `<span class="filter-pill">${escapeHtml(chip)}</span>`)
      .join("");
  }

  function applyExpenseFiltersFromForm(options) {
    const { field, refs, parseDisplayDate, feedback, state } = deps();
    const settings = options || {};
    const showErrors = settings.showErrors !== false;
    const userField = field(refs.expenseFilterForm, "user");
    const clientField = field(refs.expenseFilterForm, "client");
    const projectField = field(refs.expenseFilterForm, "project");
    const fromField = field(refs.expenseFilterForm, "from");
    const toField = field(refs.expenseFilterForm, "to");
    const searchField = field(refs.expenseFilterForm, "search");
    const parsedFrom = parseDisplayDate(fromField?.value || "");
    const parsedTo = parseDisplayDate(toField?.value || "");

    if (fromField?.value.trim() && !parsedFrom) {
      if (showErrors) {
        feedback("From date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }
    if (toField?.value.trim() && !parsedTo) {
      if (showErrors) {
        feedback("To date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }
    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      if (showErrors) {
        feedback("From date cannot be after To date.", true);
      }
      return false;
    }

    state.expenseFilters = {
      user: userField?.value || "",
      client: clientField?.value || "",
      project: projectField?.value || "",
      from: parsedFrom || "",
      to: parsedTo || "",
      search: searchField?.value || "",
    };

    const filtered = currentExpenses();
    renderExpenses(filtered);
    renderExpenseFilterState(filtered);
    return true;
  }

  function canManageExpenseApproval(expense) {
    const {
      state,
      permissionGroupForUser,
      getUserById,
      canUserAccessProject,
      canViewEntryByScope,
      isAdmin,
      effectiveScopeUser,
    } = deps();
    const current =
      typeof effectiveScopeUser === "function" ? effectiveScopeUser() : state.currentUser;
    if (!current || !expense) return false;
    const currentGroup = permissionGroupForUser(current);
    const targetUser = getUserById?.(expense.userId);
    const targetGroup = permissionGroupForUser(targetUser);

    if (current.id === expense.userId) return false;
    if (currentGroup === "staff") return false;
    if (currentGroup === "manager") {
      if (targetGroup !== "staff") return false;
      return canUserAccessProject(current, expense.clientName, expense.projectName);
    }
    if (currentGroup === "executive" || currentGroup === "admin") {
      if (
        typeof canViewEntryByScope === "function" &&
        !canViewEntryByScope(current, {
          userId: expense.userId,
          client: expense.clientName,
          project: expense.projectName,
        })
      ) {
        return false;
      }
      if (!isAdmin(current) && !canUserAccessProject(current, expense.clientName, expense.projectName)) {
        return false;
      }
      return true;
    }
    return false;
  }

  function userNameById(id) {
    const { getUserById } = deps();
    const user = getUserById?.(id);
    return user?.displayName || "";
  }

  function renderExpenses(filtered) {
    const { refs, state, escapeHtml, formatDisplayDateShort } = deps();
    if (!refs.expensesBody) return;
    const isSelectionMode = Boolean(state.expensesSelectionMode);
    const selectedExpenseIds =
      state.selectedExpenseIds instanceof Set ? state.selectedExpenseIds : new Set();
    const expenses = filtered || currentExpenses();
    const boundsSource = currentExpenses({
      ...(state.expenseFilters || {}),
      from: "",
      to: "",
    });
    const boundDates = boundsSource
      .map((expense) => expense.expenseDate)
      .filter(Boolean)
      .sort();
    refs.expensesBody.dataset.rangeMin = boundDates[0] || "";
    refs.expensesBody.dataset.rangeMax = boundDates[boundDates.length - 1] || "";
    renderExpenseFilterState(expenses);

    if (!expenses.length) {
      refs.expensesBody.innerHTML = `
        <tr>
          <td colspan="${isSelectionMode ? 11 : 10}" class="empty-row">
            <div class="empty-state-panel">
              <strong>No expenses yet.</strong>
              <span>Add an expense to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    refs.expensesBody.innerHTML = expenses
      .map((expense) => {
        const billable = expense.isBillable !== false;
        const clientName = `${expense.clientName || ""}`.trim();
        const clickableStatus = canManageExpenseApproval(expense);
        const statusMarkup = `<span
              class="entry-status entry-status-${expense.status} ${clickableStatus ? "entry-status-clickable" : ""}"
              ${clickableStatus ? `data-action="expense-toggle-status" data-id="${expense.id}" role="button" tabindex="0"` : ""}
            >
              ${expense.status === "approved" ? "Approved" : "Pending"}
            </span>`;
        const canEditBillable = Boolean(state?.permissions?.update_expense);
        const billableMarkup = `<input
              type="checkbox"
              class="entries-billable-toggle"
              ${canEditBillable ? `data-action="expense-toggle-billable" data-id="${expense.id}"` : "disabled"}
              aria-label="${billable ? "Mark as non-billable" : "Mark as billable"}"
              ${billable ? "checked" : ""}
            />`;
        const rowId = String(expense?.id || "");
        const selectedMarkup = isSelectionMode
          ? `<td>
              <input
                type="checkbox"
                class="entries-billable-toggle"
                data-action="select-expense"
                data-id="${escapeHtml(rowId)}"
                aria-label="Select expense"
                ${selectedExpenseIds.has(rowId) ? "checked" : ""}
              />
            </td>`
          : "";
        const actionsMarkup = isSelectionMode
          ? ""
          : `
              <button class="text-button" type="button" data-action="expense-edit" data-id="${expense.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="expense-delete" data-id="${expense.id}">
                Delete
              </button>
            `;
        return `
          <tr class="${expense.status === "approved" ? "entry-approved" : ""}">
            ${selectedMarkup}
            <td>${escapeHtml(formatDisplayDateShort(expense.expenseDate))}</td>
            <td>${escapeHtml(userNameById(expense.userId))}</td>
            <td>${escapeHtml(expense.clientName)}</td>
            <td>${escapeHtml(expense.projectName)}</td>
            <td>${escapeHtml(expense.category)}</td>
            <td>$${Number(expense.amount || 0).toFixed(2)}</td>
            <td>
              ${billableMarkup}
            </td>
            <td class="notes-cell">
              ${
                expense.notes && expense.notes.trim()
                  ? `<button class="note-button" type="button" data-action="expense-note" data-id="${expense.id}" aria-label="View note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8M8 14h5" />
                      </svg>
                    </button>`
                  : `<button class="note-button note-button--empty" type="button" data-action="expense-note" data-id="${expense.id}" aria-label="Add note">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5zM15 4v3.5a.5.5 0 0 0 .5.5H19" />
                        <path d="M8 11h8" />
                      </svg>
                    </button>`
              }
            </td>
            <td>
              ${statusMarkup}
            </td>
            <td class="actions-cell">
              ${actionsMarkup}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function expenseFromForm() {
    const { refs, state, today } = deps();
    return {
      id: state.expenseEditingId || crypto.randomUUID(),
      userId: refs.expenseUser?.value || "",
      clientName: refs.expenseClient?.value || "",
      projectName: refs.expenseProject?.value || "",
      expenseDate: refs.expenseDate?.value || today,
      category: refs.expenseCategory?.value || "",
      amount: Number(refs.expenseAmount?.value),
      isBillable: refs.expenseNonBillable ? !refs.expenseNonBillable.checked : true,
      notes: refs.expenseNotes?.value?.trim() || "",
    };
  }

  function validateExpenseForm(expense) {
    if (!expense.userId) return "Team member is required.";
    if (!expense.clientName) return "Client is required.";
    if (!expense.projectName) return "Project is required.";
    if (!expense.expenseDate) return "Date is required.";
    if (!expense.category) return "Category is required.";
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) return "Amount must be a positive number.";
    return "";
  }

  window.expenses = {
    activeExpenseCategories,
    syncExpenseCatalogs,
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
  };
})();
