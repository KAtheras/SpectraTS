(function () {
  function createAccessControl(deps) {
    const { state, normalizeLevel, projectKey, uniqueValues, catalogProjectNames } = deps;
    const normalizeText = (value) => String(value ?? "").trim();

    const DEFAULT_LEVEL_LABELS = {
      1: "Staff",
      2: "Senior",
      3: "Manager",
      4: "Director",
      5: "Partner",
      6: "Admin",
    };

    const DEFAULT_LEVEL_PERMISSION_GROUP = {
      1: "staff",
      2: "staff",
      3: "manager",
      4: "manager",
      5: "admin",
      6: "admin",
    };

    function roleKey(user) {
      const raw =
        user?.permission_role_key ||
        user?.role ||
        user?.permissionGroup ||
        user?.permission_group ||
        user?.permissionRoleKey ||
        null;
      if (!raw) return null;
      const val = String(raw).toLowerCase();
      if (val === "global_admin") return "superuser";
      return val;
    }

    function permissionGroupForUser(user) {
      return roleKey(user) || "staff";
    }

    function levelLabel(level) {
      const normalized = normalizeLevel(level);
      const value = state.levelLabels?.[normalized];
      if (value && typeof value === "object" && value.label) {
        return String(value.label);
      }
      if (typeof value === "string" && value.trim()) {
        return value;
      }
      if (DEFAULT_LEVEL_LABELS[normalized]) {
        return DEFAULT_LEVEL_LABELS[normalized];
      }
      return `Level ${normalized}`;
    }

    function isAdmin(user) {
      const role = roleKey(user);
      return role === "admin" || role === "superuser";
    }

    function isGlobalAdmin(user) {
      return isAdmin(user);
    }

    function isExecutive(user) {
      const role = roleKey(user);
      return role === "executive" || role === "superuser";
    }

    function isManager(user) {
      const role = roleKey(user);
      return role === "manager" || role === "executive" || role === "admin" || role === "superuser";
    }

    function isStaff(user) {
      const role = roleKey(user);
      return role === "staff";
    }

    function isPartner(user) {
      const role = roleKey(user);
      return role === "partner";
    }

    function isPartnerOrManager(user) {
      return isPartner(user) || isManager(user) || isExecutive(user);
    }

    function officeIdForUser(user) {
      return normalizeText(user?.officeId ?? user?.office_id);
    }

    function isSameOffice(userA, userB) {
      const officeA = officeIdForUser(userA);
      const officeB = officeIdForUser(userB);
      if (!officeA || !officeB) return false;
      return officeA === officeB;
    }

    function getUserById(userId) {
      const normalizedUserId = normalizeText(userId);
      return (
        state.users.find((user) => normalizeText(user?.id) === normalizedUserId) || null
      );
    }

    function getUserByDisplayName(name) {
      const normalized = String(name || "").trim().toLowerCase();
      return state.users.find((user) => user.displayName.toLowerCase() === normalized) || null;
    }

    function managerClientAssignments(userId) {
      const normalizedUserId = normalizeText(userId);
      return (state.assignments?.managerClients || []).filter(
        (item) => normalizeText(item?.managerId || item?.manager_id) === normalizedUserId
      );
    }

    function managerProjectAssignments(userId) {
      const normalizedUserId = normalizeText(userId);
      return (state.assignments?.managerProjects || []).filter(
        (item) => normalizeText(item?.managerId || item?.manager_id) === normalizedUserId
      );
    }

    function projectMembersForUser(userId) {
      const normalizedUserId = normalizeText(userId);
      return (state.assignments?.projectMembers || []).filter(
        (item) => normalizeText(item?.userId || item?.user_id) === normalizedUserId
      );
    }

    function findProjectById(projectId) {
      const normalizedProjectId = normalizeText(projectId);
      if (!normalizedProjectId) return null;
      return (
        (state.projects || []).find(
          (project) => normalizeText(project?.id) === normalizedProjectId
        ) || null
      );
    }

    function resolveAssignmentProjectTuple(item) {
      let client = normalizeText(item?.client || item?.client_name);
      let project = normalizeText(item?.project || item?.project_name);
      const projectId = normalizeText(item?.projectId || item?.project_id);
      if ((!client || !project) && projectId) {
        const matched = findProjectById(projectId);
        if (matched) {
          client = normalizeText(matched?.client);
          project = normalizeText(matched?.name || matched?.project);
        }
      }
      return { client, project, projectId };
    }

    function managerIdsForClient(client) {
      const normalizedClient = normalizeText(client);
      return uniqueValues(
        (state.assignments?.managerClients || [])
          .filter((item) => normalizeText(item?.client || item?.client_name) === normalizedClient)
          .map((item) => normalizeText(item?.managerId || item?.manager_id))
      );
    }

    function managerIdsForClientScope(client) {
      const normalizedClient = normalizeText(client);
      return uniqueValues([
        ...managerIdsForClient(client),
        ...(state.assignments?.managerProjects || [])
          .filter((item) => resolveAssignmentProjectTuple(item).client === normalizedClient)
          .map((item) => normalizeText(item?.managerId || item?.manager_id)),
      ]);
    }

    function directManagerIdsForProject(client, project) {
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      const targetProjectId = normalizeText(
        (state.projects || []).find(
          (item) =>
            normalizeText(item?.client) === normalizedClient &&
            normalizeText(item?.name || item?.project) === normalizedProject
        )?.id
      );
      return uniqueValues(
        (state.assignments?.managerProjects || [])
          .filter((item) => {
            const tuple = resolveAssignmentProjectTuple(item);
            if (tuple.client === normalizedClient && tuple.project === normalizedProject) {
              return true;
            }
            return !!targetProjectId && tuple.projectId === targetProjectId;
          })
          .map((item) => normalizeText(item?.managerId || item?.manager_id))
      );
    }

    function projectMemberIdsForProject(client, project) {
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      const targetProjectId = normalizeText(
        (state.projects || []).find(
          (item) =>
            normalizeText(item?.client) === normalizedClient &&
            normalizeText(item?.name || item?.project) === normalizedProject
        )?.id
      );
      return uniqueValues(
        (state.assignments?.projectMembers || [])
          .filter((item) => {
            const tuple = resolveAssignmentProjectTuple(item);
            if (tuple.client === normalizedClient && tuple.project === normalizedProject) {
              return true;
            }
            return !!targetProjectId && tuple.projectId === targetProjectId;
          })
          .map((item) => normalizeText(item?.userId || item?.user_id))
          .filter(Boolean)
      );
    }

    function managerIdsForProject(client, project) {
      const memberManagerIds = projectMemberIdsForProject(client, project).filter((userId) => {
        const user = getUserById(userId);
        return user ? !isStaff(user) : false;
      });
      return uniqueValues([
        ...managerIdsForClient(client),
        ...directManagerIdsForProject(client, project),
        ...memberManagerIds,
      ]);
    }

    function staffIdsForProject(client, project) {
      return projectMemberIdsForProject(client, project).filter((userId) => {
        const user = getUserById(userId);
        return user ? isStaff(user) : false;
      });
    }

    function staffIdsForClient(client) {
      const normalizedClient = normalizeText(client);
      const managerIds = new Set(managerIdsForClientScope(client));
      return uniqueValues(
        (state.assignments?.projectMembers || [])
          .filter((item) => resolveAssignmentProjectTuple(item).client === normalizedClient)
          .map((item) => normalizeText(item?.userId || item?.user_id))
          .filter((userId) => {
            if (managerIds.has(userId)) {
              return false;
            }
            const user = getUserById(userId);
            return user ? isStaff(user) : false;
          })
      );
    }

    function userNamesForIds(ids) {
      return ids
        .map((id) => getUserById(id)?.displayName)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    function formatNameList(names) {
      if (!names.length) {
        return "None";
      }
      if (names.length <= 3) {
        return names.join(", ");
      }
      return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
    }

    function allowedProjectTuples(user, projectsArg) {
      if (!user) {
        return [];
      }
      const canSeeAll = Boolean(state.permissions?.see_all_clients_projects);
      const canSeeAssigned = Boolean(state.permissions?.see_assigned_clients_projects);
      if (!canSeeAll && !canSeeAssigned) {
        return [];
      }
      const projects = projectsArg || state.projects || [];
      const visibleProjectIds = new Set(
        (state.visibleProjectIds || []).map((id) => normalizeText(id)).filter(Boolean)
      );
      const scopedProjects = projects.filter((project) => {
        if (canSeeAll) return true;
        const projectId = normalizeText(project?.id);
        return projectId && visibleProjectIds.has(projectId);
      });
      return scopedProjects
        .map((project) => ({
          client: normalizeText(project?.client),
          project: normalizeText(project?.name || project?.project),
        }))
        .filter((item) => item.client && item.project);
    }

    function allowedClientsForUser(user) {
      return uniqueValues(allowedProjectTuples(user).map((item) => item.client)).sort((a, b) =>
        a.localeCompare(b)
      );
    }

    function allowedProjectsForClient(user, client, options = {}) {
      const projects = options.projects || state.projects || [];
      return uniqueValues(
        allowedProjectTuples(user, projects)
          .filter((item) => item.client === client)
          .map((item) => item.project)
      ).sort((a, b) => a.localeCompare(b));
    }

    function canManagerAccessClient(user, client) {
      if (!isManager(user)) {
        return false;
      }
      const normalizedClient = normalizeText(client);
      return managerClientAssignments(user.id).some(
        (item) => normalizeText(item?.client || item?.client_name) === normalizedClient
      );
    }

    function canManagerAccessProject(user, client, project) {
      if (!isManager(user)) {
        return false;
      }
      if (canManagerAccessClient(user, client)) {
        return true;
      }
      if (isUserAssignedToProject(user.id, client, project)) {
        return true;
      }
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      return managerProjectAssignments(user.id).some(
        (item) => {
          const tuple = resolveAssignmentProjectTuple(item);
          return tuple.client === normalizedClient && tuple.project === normalizedProject;
        }
      );
    }

    function projectCreatedBy(client, project) {
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      return (
        (state.projects || []).find(
          (item) =>
            normalizeText(item?.client) === normalizedClient &&
            normalizeText(item?.name || item?.project) === normalizedProject
        )?.createdBy || ""
      );
    }

    function isUserAssignedToProject(userId, client, project) {
      const normalizedUserId = normalizeText(userId);
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      const targetProjectId = normalizeText(
        (state.projects || []).find(
          (item) =>
            normalizeText(item?.client) === normalizedClient &&
            normalizeText(item?.name || item?.project) === normalizedProject
        )?.id
      );
      return (state.assignments?.projectMembers || []).some((item) => {
        const itemUserId = normalizeText(item?.userId || item?.user_id);
        if (itemUserId !== normalizedUserId) return false;
        const tuple = resolveAssignmentProjectTuple(item);
        if (tuple.client === normalizedClient && tuple.project === normalizedProject) {
          return true;
        }
        return !!targetProjectId && tuple.projectId === targetProjectId;
      });
    }

    function canViewUserByRole(viewer, target) {
      const viewerRole = roleKey(viewer) || "staff";
      const targetRole = roleKey(target) || "staff";
      const isSelf = target?.id && viewer?.id && target.id === viewer.id;
      if (isSelf) return true;
      if (viewerRole === "superuser") return true;
      if (viewerRole === "admin") return isSameOffice(viewer, target);
      if (viewerRole === "partner" || viewerRole === "executive" || viewerRole === "manager") {
        return targetRole !== "superuser" && targetRole !== "admin";
      }
      return false;
    }

    function assignedProjectTupleKeysForUser(user, projectsArg) {
      const userId = normalizeText(user?.id);
      if (!userId) return new Set();
      const projects = projectsArg || state.projects || [];
      const keys = new Set();

      (state.assignments?.projectMembers || []).forEach((item) => {
        const assignmentUserId = normalizeText(item?.userId || item?.user_id);
        if (assignmentUserId !== userId) return;
        const tuple = resolveAssignmentProjectTuple(item);
        if (tuple.client && tuple.project) {
          keys.add(projectKey(tuple.client, tuple.project));
        }
      });

      (state.assignments?.managerProjects || []).forEach((item) => {
        const assignmentUserId = normalizeText(item?.managerId || item?.manager_id);
        if (assignmentUserId !== userId) return;
        const tuple = resolveAssignmentProjectTuple(item);
        if (tuple.client && tuple.project) {
          keys.add(projectKey(tuple.client, tuple.project));
        }
      });

      const managerClients = (state.assignments?.managerClients || []).filter((item) => {
        const assignmentUserId = normalizeText(item?.managerId || item?.manager_id);
        return assignmentUserId === userId;
      });
      managerClients.forEach((item) => {
        const clientName = normalizeText(item?.client || item?.client_name);
        if (!clientName) return;
        projects
          .filter((project) => normalizeText(project?.client) === clientName)
          .forEach((project) => {
            const projectName = normalizeText(project?.name || project?.project);
            if (projectName) {
              keys.add(projectKey(clientName, projectName));
            }
          });
      });

      return keys;
    }

    function canUserAccessProject(user, client, project) {
      if (!user) {
        return false;
      }
      const role = roleKey(user) || "staff";
      if (role === "superuser" || role === "admin") {
        return true;
      }
      const normalizedClient = normalizeText(client);
      const normalizedProject = normalizeText(project);
      if (!normalizedClient || !normalizedProject) {
        return false;
      }
      if (isPartnerOrManager(user)) {
        return assignedProjectTupleKeysForUser(user).has(projectKey(normalizedClient, normalizedProject));
      }
      if (isStaff(user)) {
        return isUserAssignedToProject(user.id, normalizedClient, normalizedProject);
      }
      return false;
    }

    function entryIsInternal(entry) {
      const clientName = normalizeText(entry?.client).toLowerCase();
      const projectName = normalizeText(entry?.project);
      const chargeCenterId = normalizeText(entry?.chargeCenterId ?? entry?.charge_center_id).toLowerCase();
      const hasChargeCenter =
        chargeCenterId !== "" && chargeCenterId !== "null" && chargeCenterId !== "undefined";
      if (hasChargeCenter) return true;
      if (clientName === "internal") return true;
      return !clientName && !projectName;
    }

    function entryTargetUser(entry, scopeUser) {
      const entryUserId = normalizeText(entry?.userId || entry?.user_id);
      if (entryUserId) {
        const byId = getUserById(entryUserId);
        if (byId) return byId;
      }
      const entryUserName = normalizeText(entry?.user).toLowerCase();
      if (entryUserName) {
        const byName =
          (state.users || []).find(
            (user) => {
              const displayName = normalizeText(user?.displayName).toLowerCase();
              const username = normalizeText(user?.username).toLowerCase();
              const email = normalizeText(user?.email).toLowerCase();
              return (
                displayName === entryUserName ||
                username === entryUserName ||
                email === entryUserName
              );
            }
          ) || null;
        if (byName) return byName;
      }
      if (scopeUser && normalizeText(scopeUser?.displayName).toLowerCase() === entryUserName) {
        return scopeUser;
      }
      return null;
    }

    function findProjectByTuple(client, project) {
      const normalizedClient = normalizeText(client).toLowerCase();
      const normalizedProject = normalizeText(project).toLowerCase();
      if (!normalizedClient || !normalizedProject) return null;
      return (
        (state.projects || []).find((item) => {
          const clientName = normalizeText(item?.client).toLowerCase();
          const projectName = normalizeText(item?.name || item?.project).toLowerCase();
          return clientName === normalizedClient && projectName === normalizedProject;
        }) || null
      );
    }

    function findClientByName(client) {
      const normalizedClient = normalizeText(client).toLowerCase();
      if (!normalizedClient) return null;
      return (
        (state.clients || []).find((item) => normalizeText(item?.name).toLowerCase() === normalizedClient) ||
        null
      );
    }

    function officeIdForEntry(entry, targetUser) {
      const project = findProjectByTuple(entry?.client, entry?.project);
      const projectOffice = normalizeText(project?.officeId ?? project?.office_id);
      if (projectOffice) return projectOffice;
      const client = findClientByName(entry?.client);
      const clientOffice = normalizeText(client?.officeId ?? client?.office_id);
      if (clientOffice) return clientOffice;
      const userOffice = officeIdForUser(targetUser);
      if (userOffice) return userOffice;
      return "";
    }

    function officeIdForEntryRecord(entry, scopeUser) {
      const targetUser = entryTargetUser(entry, scopeUser || null);
      return officeIdForEntry(entry, targetUser);
    }

    function canViewEntryByScope(scopeUser, entry) {
      if (!scopeUser || !entry) return false;
      const scopeRole = roleKey(scopeUser) || "staff";
      const targetUser = entryTargetUser(entry, scopeUser);
      const isSelfEntry =
        Boolean(targetUser?.id) &&
        normalizeText(targetUser.id) === normalizeText(scopeUser.id);
      if (isSelfEntry) {
        return true;
      }

      if (scopeRole === "superuser") {
        return true;
      }
      if (scopeRole === "admin") {
        const scopeOffice = officeIdForUser(scopeUser);
        const entryOffice = officeIdForEntry(entry, targetUser);
        if (!scopeOffice || !entryOffice) return false;
        return scopeOffice === entryOffice;
      }
      if (scopeRole === "partner" || scopeRole === "executive" || scopeRole === "manager") {
        if (entryIsInternal(entry)) return false;
        return canUserAccessProject(scopeUser, entry.client, entry.project);
      }
      if (scopeRole === "staff") {
        return false;
      }
      return false;
    }

    return {
      roleKey,
      levelLabel,
      isGlobalAdmin,
      isManager,
      isStaff,
      isAdmin,
      isExecutive,
      permissionGroupForUser,
      getUserById,
      getUserByDisplayName,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      managerIdsForClient,
      managerIdsForClientScope,
      directManagerIdsForProject,
      managerIdsForProject,
      staffIdsForProject,
      staffIdsForClient,
      userNamesForIds,
      formatNameList,
      allowedProjectTuples,
      allowedClientsForUser,
      allowedProjectsForClient,
      canManagerAccessClient,
      canManagerAccessProject,
      projectCreatedBy,
      isUserAssignedToProject,
      canUserAccessProject,
      canViewUserByRole,
      canViewEntryByScope,
      officeIdForUser,
      isSameOffice,
      officeIdForEntryRecord,
    };
  }

  window.accessControl = {
    createAccessControl,
  };
})();
