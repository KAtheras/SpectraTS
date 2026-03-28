(function () {
  const deps = () => window.expensesDeps || {};

  function activeExpenseCategories() {
    const { state } = deps();
    return (state.expenseCategories || []).filter((c) => c.isActive);
  }

  function syncExpenseCatalogs({ userId, client, project }) {
    const { visibleCatalogClientNames, setSelectOptionsWithPlaceholder, escapeHtml, refs, visibleCatalogProjectNames, getUserById, entryUserOptions, getUserByDisplayName, state } = deps();
    const clients = visibleCatalogClientNames();
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseClient, clients, client || "", "Select client");
    if (client && clients.includes(client)) {
      refs.expenseClient.value = client;
    }

    const hasClient = Boolean(client);
    const projects = hasClient
      ? visibleCatalogProjectNames(client, getUserById?.(userId))
      : [];
    const placeholder = hasClient ? "Select project" : "Choose client first";
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseProject, projects, project || "", placeholder);
    if (refs.expenseProject) {
      refs.expenseProject.disabled = !hasClient;
    }
    if (hasClient && project && projects.includes(project)) {
      refs.expenseProject.value = project;
    } else if (hasClient && !refs.expenseProject?.value && projects.length) {
      refs.expenseProject.value = projects[0];
    } else if (!hasClient && refs.expenseProject) {
      refs.expenseProject.value = "";
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
      refs.expenseUser.value = state.currentUser?.id || userId || "";
      refs.expenseUser.disabled = true;
    }

    const categories = activeExpenseCategories().map((c) => c.name);
    setSelectOptionsWithPlaceholder({ escapeHtml }, refs.expenseCategory, categories, "", "Select category");
  }

  function resetExpenseForm() {
    const { refs, state, clampDateToBounds, today, setExpenseNonBillableDefault } = deps();
    if (!refs.expenseForm) return;
    refs.expenseForm.reset();
    state.expenseEditingId = null;
    const defaultUserId = state.currentUser?.id || "";
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

  function currentExpenses() {
    const { state } = deps();
    const search = state.expenseFilters.search.trim().toLowerCase();

    const { getUserById, canViewUserByRole } = deps();

    return [...state.expenses]
      .filter((expense) => {
        const targetUser = getUserById(expense.userId);
        const canView = typeof canViewUserByRole === "function"
          ? canViewUserByRole(state.currentUser, targetUser)
          : true;
        if (!canView) {
          return false;
        }
        if (state.expenseFilters.user && expense.userId !== state.expenseFilters.user) {
          return false;
        }
        if (state.expenseFilters.client && expense.clientName !== state.expenseFilters.client) {
          return false;
        }
        if (state.expenseFilters.project && expense.projectName !== state.expenseFilters.project) {
          return false;
        }
        if (state.expenseFilters.from && expense.expenseDate < state.expenseFilters.from) {
          return false;
        }
        if (state.expenseFilters.to && expense.expenseDate > state.expenseFilters.to) {
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
    const { state, permissionGroupForUser, getUserById, canUserAccessProject, isAdmin } = deps();
    const current = state.currentUser;
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
    const expenses = filtered || currentExpenses();
    renderExpenseFilterState(expenses);

    if (!expenses.length) {
      refs.expensesBody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-row">
            <div class="empty-state-panel">
              <strong>No expenses yet.</strong>
              <span>Add an expense to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    if (refs.expensesBody) {
      const dates = state.expenses.map((e) => e.expenseDate).sort();
      refs.expensesBody.dataset.rangeMin = dates[0] || "";
      refs.expensesBody.dataset.rangeMax = dates[dates.length - 1] || "";
    }

    refs.expensesBody.innerHTML = expenses
      .map((expense) => {
        const billable = expense.isBillable !== false;
        const clickableStatus = canManageExpenseApproval(expense);
        return `
          <tr class="${expense.status === "approved" ? "entry-approved" : ""}">
            <td>${escapeHtml(formatDisplayDateShort(expense.expenseDate))}</td>
            <td>${escapeHtml(userNameById(expense.userId))}</td>
            <td>${escapeHtml(expense.clientName)}</td>
            <td>${escapeHtml(expense.projectName)}</td>
            <td>${escapeHtml(expense.category)}</td>
            <td>$${Number(expense.amount || 0).toFixed(2)}</td>
            <td>
              <span
                class="billable-pill ${billable ? "is-billable" : "is-nonbillable"} is-clickable"
                data-action="expense-toggle-billable"
                data-id="${expense.id}"
                role="button"
              >
                ${billable ? "Billable" : "Non-billable"}
              </span>
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
              <span
                class="entry-status entry-status-${expense.status} ${clickableStatus ? "entry-status-clickable" : ""}"
                ${clickableStatus ? `data-action="expense-toggle-status" data-id="${expense.id}" role="button" tabindex="0"` : ""}
              >
                ${expense.status === "approved" ? "Approved" : "Pending"}
              </span>
            </td>
            <td class="actions-cell">
              <button class="text-button" type="button" data-action="expense-edit" data-id="${expense.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="expense-delete" data-id="${expense.id}">
                Delete
              </button>
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
