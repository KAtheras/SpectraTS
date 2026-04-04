(function () {
  let selectedUserId = null;
  let memberSearchTerm = "";
  let memberLevelFilter = "";
  let memberOfficeFilter = "";
  let collapsedOfficeKeys = new Set();
  let initializedOfficeKeys = new Set();

  function resetUsersDirectoryFilters() {
    memberSearchTerm = "";
    memberLevelFilter = "";
    memberOfficeFilter = "";
    collapsedOfficeKeys = new Set();
    initializedOfficeKeys = new Set();
    selectedUserId = null;
  }

  function setUserFeedback(deps, message, isError) {
    const { refs } = deps;
    if (!refs.userFeedback) {
      return;
    }

    refs.userFeedback.textContent = message || "";
    refs.userFeedback.dataset.error = isError ? "true" : "false";
  }

  function openUsersModal(deps) {
    const { refs, body, postHeight } = deps;
    setUserFeedback(deps, "", false);
    refs.usersModal.hidden = false;
    refs.usersModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    postHeight();
  }

  function closeUsersModal(deps) {
    const { refs, body, postHeight } = deps;
    refs.usersModal.hidden = true;
    refs.usersModal.setAttribute("aria-hidden", "true");
    if (refs.catalogModal.hidden && (!refs.membersModal || refs.membersModal.hidden)) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function renderUsersList(deps) {
    const {
      refs,
      state,
      levelLabel,
      levels,
      isAdmin,
      isGlobalAdmin,
      isManager,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      escapeHtml,
      disabledButtonAttrs,
      isMobileDrilldown,
      mobileView,
      onUserSelected,
      onBackToList,
    } = deps;

    if (!refs.userList) {
      return;
    }

    if (!state.users.length) {
      refs.userList.innerHTML = '<p class="empty-state">No team members yet.</p>';
      return;
    }

    const previousScroll =
      refs.userList.querySelector(".member-card-list")?.scrollTop ??
      refs.userList.querySelector(".user-list-column")?.scrollTop ??
      0;
    const wasSearchFocused =
      document.activeElement &&
      document.activeElement.classList &&
      document.activeElement.classList.contains("member-card-search");

    const searchValue = (memberSearchTerm || "").trim().toLowerCase();
    const officeNames = new Map(
      (state.officeLocations || []).map((loc) => [loc.id != null ? String(loc.id) : "", loc.name || ""])
    );
    const departmentNames = new Map(
      (state.departments || []).map((dept) => [dept.id != null ? String(dept.id) : "", dept.name || ""])
    );
    const officeNameFor = (id, fallbackName) => {
      const fallback = String(fallbackName || "").trim();
      if (id === undefined || id === null || id === "") return fallback;
      const key = String(id);
      return officeNames.get(key) || fallback;
    };
    const departmentNameFor = (id, fallbackName) => {
      const fallback = String(fallbackName || "").trim();
      if (id === undefined || id === null || id === "") return fallback;
      const key = String(id);
      return departmentNames.get(key) || fallback;
    };
    const filteredUsers = state.users.filter(function (user) {
      const officeId = user?.officeId != null ? String(user.officeId) : "";
      const officeLabel = officeNameFor(user?.officeId, user?.officeName).trim() || "No office";
      const officeKey = officeId || `name:${officeLabel}`;
      if (memberOfficeFilter && officeKey !== memberOfficeFilter) {
        return false;
      }
      if (memberLevelFilter && String(user.level) !== memberLevelFilter) {
        return false;
      }
      if (!searchValue) return true;
      const name = (user.displayName || "").toLowerCase();
      const username = (user.username || "").toLowerCase();
      return name.includes(searchValue) || username.includes(searchValue);
    });

    const configuredOrder = Array.isArray(levels)
      ? Array.from(new Set(levels))
          .sort(function (a, b) { return a - b; })
          .map(function (lvl) { return String(lvl); })
      : [];

    const renderUserCard = function (user, options = {}) {
      const roleLabelText = levelLabel(user.level);
      const isCurrentUser = state.currentUser?.id === user.id;
      const isSelected = selectedUserId === user.id;
      const officeName = officeNameFor(user.officeId, user.officeName);
      const departmentName = departmentNameFor(user.departmentId, user.departmentName);
      const showOfficeMeta = options.showOfficeMeta !== false;
      const currentDot = `<span class="user-current-dot${isCurrentUser ? "" : " is-hidden"}" ${isCurrentUser ? 'aria-label="Current session"' : 'aria-hidden="true"'}></span>`;

      return `
        <article class="catalog-item user-item ${isSelected ? "is-selected" : ""}" data-user-id="${escapeHtml(user.id)}">
          <div class="user-item-row">
            <span class="catalog-item-title">
              <span>${escapeHtml(user.displayName)}</span>
            </span>
            <span class="user-item-meta">
              <span>${escapeHtml(roleLabelText)}</span>
              ${showOfficeMeta && officeName ? `<span>${escapeHtml(officeName)}</span>` : ""}
              ${departmentName ? `<span>${escapeHtml(departmentName)}</span>` : ""}
            </span>
            ${currentDot}
          </div>
        </article>
      `;
    };

    const levelGroupsMarkup = function (users, options = {}) {
      const groups = new Map();
      users.forEach(function (user) {
        const key = String(user.level);
        if (!groups.has(key)) {
          groups.set(key, {
            label: levelLabel(user.level),
            users: [],
          });
        }
        groups.get(key).users.push(user);
      });
      const extraLevels = Array.from(groups.keys()).filter(function (lvl) {
        return configuredOrder.indexOf(lvl) === -1;
      });
      const levelOrder = configuredOrder.concat(extraLevels);
      return levelOrder
        .map(function (levelKey) {
          const group = groups.get(levelKey);
          if (!group || !group.users.length) return "";
          const itemsHtml = group.users.map(function (user) {
            return renderUserCard(user, { showOfficeMeta: options.showOfficeMeta !== false });
          }).join("");
          return `
            <div class="member-level-group">
              <div class="member-level-heading">${escapeHtml(group.label)}</div>
              ${itemsHtml}
            </div>
          `;
        })
        .join("");
    };

    const representedOfficeKeys = Array.from(
      new Set(
        (state.users || []).map(function (user) {
          const officeId = user?.officeId != null ? String(user.officeId) : "";
          const officeName = officeNameFor(user?.officeId, user?.officeName).trim();
          return officeId || `name:${officeName || "No office"}`;
        })
      )
    );
    const useOfficeGrouping = representedOfficeKeys.length > 1;
    if (!useOfficeGrouping && memberOfficeFilter) {
      memberOfficeFilter = "";
    }

    const listHtml = useOfficeGrouping
      ? (() => {
          const officeGroups = new Map();
          filteredUsers.forEach(function (user) {
            const officeId = user?.officeId != null ? String(user.officeId) : "";
            const officeLabel = officeNameFor(user?.officeId, user?.officeName).trim() || "No office";
            const officeKey = officeId || `name:${officeLabel}`;
            if (!officeGroups.has(officeKey)) {
              officeGroups.set(officeKey, {
                key: officeKey,
                label: officeLabel,
                users: [],
              });
            }
            officeGroups.get(officeKey).users.push(user);
          });
          const officeOrder = Array.from(officeGroups.values()).sort(function (a, b) {
            return a.label.localeCompare(b.label);
          });
          officeOrder.forEach(function (officeGroup) {
            if (!initializedOfficeKeys.has(officeGroup.key)) {
              // Default new office groups to collapsed on first appearance.
              collapsedOfficeKeys.add(officeGroup.key);
              initializedOfficeKeys.add(officeGroup.key);
            }
          });
          return officeOrder
            .map(function (officeGroup) {
              // Keep search results visible by auto-expanding matching offices while search is active.
              const isCollapsed = searchValue ? false : collapsedOfficeKeys.has(officeGroup.key);
              const contentHtml = levelGroupsMarkup(officeGroup.users, { showOfficeMeta: false });
              return `
                <section class="member-office-group ${isCollapsed ? "is-collapsed" : ""}" data-office-group="${escapeHtml(officeGroup.key)}">
                  <button
                    type="button"
                    class="member-office-toggle"
                    data-office-toggle="${escapeHtml(officeGroup.key)}"
                    aria-expanded="${isCollapsed ? "false" : "true"}"
                  >
                    <span class="member-office-toggle-label">${escapeHtml(officeGroup.label)}</span>
                    <span class="member-office-toggle-count">${officeGroup.users.length}</span>
                  </button>
                  <div class="member-office-content" ${isCollapsed ? "hidden" : ""}>
                    ${contentHtml}
                  </div>
                </section>
              `;
            })
            .join("");
        })()
      : levelGroupsMarkup(filteredUsers, { showOfficeMeta: true });

    const officeFilterOptions = Array.from(
      new Map(
        (state.users || [])
          .map(function (user) {
            const officeId = user?.officeId != null ? String(user.officeId) : "";
            const officeLabel = officeNameFor(user?.officeId, user?.officeName).trim() || "No office";
            const officeKey = officeId || `name:${officeLabel}`;
            return [officeKey, { key: officeKey, label: officeLabel }];
          })
          .filter(Boolean)
      ).values()
    )
      .sort(function (a, b) {
        return a.label.localeCompare(b.label);
      })
      .map(function (item) {
        return `<option value="${escapeHtml(item.key)}" ${memberOfficeFilter === item.key ? "selected" : ""}>${escapeHtml(item.label)}</option>`;
      })
      .join("");

    if (!filteredUsers.length) {
      refs.userList.innerHTML = `
        <div class="user-pane">
          <div class="user-list-column">
            <div class="member-card">
              <div class="member-card-head">
                ${useOfficeGrouping ? `
                  <label class="member-card-filter">
                    <span class="sr-only">Office</span>
                    <select class="member-office-filter" aria-label="Filter by office">
                      <option value="">Select Office</option>
                      ${officeFilterOptions}
                    </select>
                  </label>
                ` : ""}
                <label class="member-card-filter">
                  <span class="sr-only">Level</span>
                  <select class="member-level-filter" aria-label="Filter by level">
                    <option value="">Select by Role</option>
                    ${Array.from(new Set(levels || [])).sort((a, b) => a - b).map((level) => `<option value="${escapeHtml(String(level))}" ${memberLevelFilter === String(level) ? "selected" : ""}>${escapeHtml(levelLabel(level))}</option>`).join("")}
                  </select>
                </label>
                <input
                  type="search"
                  class="member-card-search"
                  placeholder="Search members"
                  aria-label="Search members"
                  value="${escapeHtml(memberSearchTerm)}"
                />
              </div>
              <div class="catalog-list member-card-list"><p class="empty-state">No members match the current filters.</p></div>
            </div>
          </div>
          <div class="user-detail-column"></div>
        </div>
      `;
    }

    if (!selectedUserId || !filteredUsers.some((u) => u.id === selectedUserId)) {
      selectedUserId = filteredUsers[0]?.id || null;
    }
    const selectedUser = filteredUsers.find((u) => u.id === selectedUserId) || filteredUsers[0] || null;
    if (!selectedUser) {
      const searchInputOnly = refs.userList.querySelector(".member-card-search");
      const levelSelectOnly = refs.userList.querySelector(".member-level-filter");
      const officeSelectOnly = refs.userList.querySelector(".member-office-filter");
      if (searchInputOnly) {
        searchInputOnly.addEventListener("input", function (event) {
          memberSearchTerm = event.target.value || "";
          renderUsersList(deps);
        });
      }
      if (levelSelectOnly) {
        levelSelectOnly.addEventListener("change", function (event) {
          memberLevelFilter = event.target.value || "";
          renderUsersList(deps);
        });
      }
      if (officeSelectOnly) {
        officeSelectOnly.value = memberOfficeFilter;
        officeSelectOnly.addEventListener("change", function (event) {
          memberOfficeFilter = event.target.value || "";
          renderUsersList(deps);
        });
      }
      return;
    }

    const levelFilterOptions = Array.isArray(levels)
      ? Array.from(new Set(levels))
          .sort(function (a, b) { return a - b; })
          .map(function (level) {
            return `<option value="${escapeHtml(String(level))}" ${memberLevelFilter === String(level) ? "selected" : ""}>${escapeHtml(levelLabel(level))}</option>`;
          })
          .join("")
      : "";

    function assignmentSummary(user) {
      const clients =
        isManager(user) || isAdmin(user)
          ? managerClientAssignments(user.id).map((item) => item.client)
          : [];
      const managerProjects =
        isManager(user) || isAdmin(user)
          ? managerProjectAssignments(user.id).map((item) => ({ client: item.client, project: item.project }))
          : [];
      const memberProjects = projectMembersForUser(user.id).map((item) => ({
        client: item.client,
        project: item.project,
      }));
      return {
        clients: [...new Set(clients)].sort(),
        projects: [...new Map([...managerProjects, ...memberProjects].map((p) => [p.client + "::" + p.project, p])).values()],
      };
    }

    const assignments = assignmentSummary(selectedUser);
    const departmentName = departmentNameFor(selectedUser.departmentId, selectedUser.departmentName);
    const officeName = officeNameFor(selectedUser.officeId, selectedUser.officeName);
    const profileCertifications = `${selectedUser.certifications || ""}`.trim() || "Not provided";
    const profileSummary = `${selectedUser.memberProfile || ""}`.trim() || "Not provided";
    const mobileDrilldownEnabled = typeof isMobileDrilldown === "function" ? isMobileDrilldown() : false;
    const mobileDetailView = mobileDrilldownEnabled && mobileView === "detail";
    const detailHtml = `
      ${mobileDetailView ? `<div class="mobile-drilldown-back-wrap"><button type="button" class="button button-ghost mobile-drilldown-back" data-action="members-mobile-back">Back</button></div>` : ""}
      <div class="user-detail-card">
        <h4>${escapeHtml(selectedUser.displayName)}</h4>
        <div class="detail-top-divider"></div>
        <dl>
          <div class="member-top-row">
            <div class="member-top-item">
              <dt>Level</dt>
              <dd>${escapeHtml(levelLabel(selectedUser.level))}</dd>
            </div>
            <div class="member-top-item">
              <dt>Department</dt>
              <dd>${departmentName || "—"}</dd>
            </div>
            <div class="member-top-item">
              <dt>Office</dt>
              <dd>${officeName || "—"}</dd>
            </div>
          </div>
          <div class="detail-divider"></div>
          <div><dt>Clients/Projects</dt><dd>${assignments.projects.length ? assignments.projects.map((p) => `${escapeHtml(p.client)} / ${escapeHtml(p.project)}`).join("<br>") : "None assigned"}</dd></div>
          <div>
            <dt>Certifications</dt>
            <dd>${escapeHtml(profileCertifications)}</dd>
          </div>
          <div class="detail-divider"></div>
          <div>
            <dt>Member Profile</dt>
            <dd>${escapeHtml(profileSummary)}</dd>
          </div>
        </dl>
      </div>
    `;

    refs.userList.innerHTML = `
      <div class="user-pane">
        <div class="user-list-column">
            <div class="member-card">
              <div class="member-card-head">
              ${useOfficeGrouping ? `
                <label class="member-card-filter">
                  <span class="sr-only">Office</span>
                  <select class="member-office-filter" aria-label="Filter by office">
                    <option value="">Select Office</option>
                    ${officeFilterOptions}
                  </select>
                </label>
              ` : ""}
              <label class="member-card-filter">
                <span class="sr-only">Level</span>
                <select class="member-level-filter" aria-label="Filter by level">
                  <option value="">Select by Role</option>
                  ${levelFilterOptions}
                </select>
              </label>
              <input
                type="search"
                class="member-card-search"
                placeholder="Search members"
                aria-label="Search members"
                value="${escapeHtml(memberSearchTerm)}"
              />
            </div>
            <div class="catalog-list member-card-list">${listHtml}</div>
          </div>
        </div>
        <div class="user-detail-column">${detailHtml}</div>
      </div>
    `;

    const searchInput = refs.userList.querySelector(".member-card-search");
    const officeSelect = refs.userList.querySelector(".member-office-filter");
    const levelSelect = refs.userList.querySelector(".member-level-filter");

    if (searchInput) {
      searchInput.value = memberSearchTerm;
      searchInput.addEventListener("input", function (event) {
        memberSearchTerm = event.target.value || "";
        renderUsersList(deps);
      });
    }

    if (levelSelect) {
      levelSelect.value = memberLevelFilter;
      levelSelect.addEventListener("change", function (event) {
        memberLevelFilter = event.target.value || "";
        renderUsersList(deps);
      });
    }
    if (officeSelect) {
      officeSelect.value = memberOfficeFilter;
      officeSelect.addEventListener("change", function (event) {
        memberOfficeFilter = event.target.value || "";
        renderUsersList(deps);
      });
    }

    const newListBody = refs.userList.querySelector(".member-card-list");
    if (newListBody) {
      newListBody.scrollTop = previousScroll;
    } else {
      const newListColumn = refs.userList.querySelector(".user-list-column");
      if (newListColumn) {
        newListColumn.scrollTop = previousScroll;
      }
    }

    if (wasSearchFocused && searchInput) {
      searchInput.focus({ preventScroll: true });
      const end = searchInput.value.length;
      try {
        searchInput.setSelectionRange(end, end);
      } catch (e) {
        // ignore selection errors on some browsers
      }
    }

    refs.userList.querySelectorAll(".user-item").forEach(function (item) {
      item.addEventListener("click", function (event) {
        const id = item.dataset.userId;
        if (!id) return;
        if (typeof onUserSelected === "function") {
          onUserSelected(id);
        }
        selectedUserId = id;
        renderUsersList(deps);
      });
    });

    refs.userList.querySelectorAll("[data-office-toggle]").forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        const officeKey = `${toggle.dataset.officeToggle || ""}`.trim();
        if (!officeKey) return;
        if (collapsedOfficeKeys.has(officeKey)) {
          collapsedOfficeKeys.delete(officeKey);
        } else {
          collapsedOfficeKeys.add(officeKey);
        }
        renderUsersList(deps);
      });
    });

    refs.userList
      .querySelector("[data-action='members-mobile-back']")
      ?.addEventListener("click", function () {
        if (typeof onBackToList === "function") {
          onBackToList();
        }
      });
  }

  function syncUserManagementControls(deps) {
    const { refs, state, isAdmin, isGlobalAdmin, levelLabel, escapeHtml, field } = deps;
    if (!refs.addUserForm) {
      return;
    }
    const canManageUsers = true;
    const canAssignLevel = true;
    const reason = "Admin only.";
    const levelField = field(refs.addUserForm, "level");
    if (levelField) {
      const levelsArray = Array.isArray(deps.levels) ? deps.levels.slice() : [];
      const uniqueSortedLevels = Array.from(new Set(levelsArray)).sort((a, b) => a - b);
      levelField.innerHTML = uniqueSortedLevels
        .map(
          (level) =>
            `<option value="${level}">${escapeHtml(levelLabel(level))}</option>`
        )
        .join("");
      levelField.disabled = !canAssignLevel || !canManageUsers;
      levelField.title = canAssignLevel && canManageUsers ? "" : "Admin only.";
      if (!canAssignLevel && uniqueSortedLevels.length) {
        levelField.value = String(uniqueSortedLevels[0]);
      }
    }
    refs.addUserForm.querySelectorAll("input, select, button").forEach(function (el) {
      if (el === levelField) {
        return;
      }
      if (el.tagName === "BUTTON") {
        el.title = canManageUsers ? "" : reason;
      } else if (el.tagName === "INPUT" || el.tagName === "SELECT") {
        el.title = canManageUsers ? "" : reason;
      }
      el.disabled = !canManageUsers;
    });

    if (refs.levelLabelsForm) {
      refs.levelLabelsForm.hidden = !isGlobalAdmin(state.currentUser);
      refs.levelLabelsForm
        .querySelectorAll("input[name^='level_']")
        .forEach(function (input) {
          const level = Number(input.name.split("_")[1]);
          input.value = levelLabel(level);
          input.disabled = !isGlobalAdmin(state.currentUser);
        });
      const submitButton = refs.levelLabelsForm.querySelector("button");
      if (submitButton) {
        submitButton.disabled = !isGlobalAdmin(state.currentUser);
      }
    }
  }

  window.usersModal = {
    openUsersModal,
    closeUsersModal,
    setUserFeedback,
    renderUsersList,
    syncUserManagementControls,
    resetUsersDirectoryFilters,
  };
})();
