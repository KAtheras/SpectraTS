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
        user?.permissionRoleKey ||
        user?.role ||
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

    function managerIdsForProject(client, project) {
      return uniqueValues([
        ...managerIdsForClient(client),
        ...directManagerIdsForProject(client, project),
      ]);
    }

    function staffIdsForProject(client, project) {
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
          .filter((userId) => {
            const user = getUserById(userId);
            return user ? isStaff(user) : false;
          })
      );
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
      const projects = projectsArg || state.projects || [];
      const role = roleKey(user) || "staff";

      if (role === "superuser" || role === "admin") {
        return projects.map((project) => ({ client: project.client, project: project.name }));
      }

      if (role === "manager" || role === "executive") {
        const clientAssignments = managerClientAssignments(user.id)
          .map((item) => normalizeText(item?.client || item?.client_name))
          .filter(Boolean);
        const projectAssignments = managerProjectAssignments(user.id)
          .map((item) => resolveAssignmentProjectTuple(item))
          .filter((item) => item.client && item.project);
        const memberAssignments = projectMembersForUser(user.id)
          .map((item) => resolveAssignmentProjectTuple(item))
          .filter((item) => item.client && item.project);
        const clientProjects = projects
          .filter((p) => clientAssignments.includes(normalizeText(p?.client)))
          .map((p) => ({
            client: normalizeText(p?.client),
            project: normalizeText(p?.name || p?.project),
          }))
          .filter((item) => item.client && item.project);
        return uniqueValues(
          [...clientProjects, ...projectAssignments, ...memberAssignments].map((item) =>
            projectKey(item.client, item.project)
          )
        ).map((key) => {
          const [client, project] = key.split("::");
          return { client, project };
        });
      }

      return projectMembersForUser(user.id)
        .map((item) => resolveAssignmentProjectTuple(item))
        .filter((item) => item.client && item.project)
        .map((item) => ({
          client: item.client,
          project: item.project,
        }));
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
      if (viewerRole === "admin") return targetRole !== "superuser";
      if (viewerRole === "executive") return targetRole === "executive" || targetRole === "manager" || targetRole === "staff";
      if (viewerRole === "manager") return targetRole === "manager" || targetRole === "staff";
      return false;
    }

    function canUserAccessProject(user, client, project) {
      if (!user) {
        return false;
      }
      if (isAdmin(user)) {
        return true;
      }
      if (isManager(user)) {
        return canManagerAccessProject(user, client, project);
      }
      return isUserAssignedToProject(user.id, client, project);
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
    };
  }

  window.accessControl = {
    createAccessControl,
  };
})();
