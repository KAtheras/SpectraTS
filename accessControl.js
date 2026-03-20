(function () {
  function createAccessControl(deps) {
    const { state, normalizeLevel, projectKey, uniqueValues, catalogProjectNames } = deps;

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

    function permissionGroupForUser(user) {
      if (user === null || user === undefined) return "staff";
      // allow a numeric level to be passed directly
      if (typeof user === "number") {
        const normalized = normalizeLevel(user);
        const value = state.levelLabels?.[normalized];
        if (value && typeof value === "object") {
          if (value.permissionGroup) return String(value.permissionGroup).toLowerCase();
          if (value.permission_group) return String(value.permission_group).toLowerCase();
        }
        return "staff";
      }
      if (user.permissionGroup) return String(user.permissionGroup).toLowerCase();
      const normalized = normalizeLevel(user.level);
      const value = state.levelLabels?.[normalized];
      if (value && typeof value === "object") {
        if (value.permissionGroup) return String(value.permissionGroup).toLowerCase();
        if (value.permission_group) return String(value.permission_group).toLowerCase();
      }
      return "staff";
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
      const group = permissionGroupForUser(user);
      return group === "admin" || group === "superuser";
    }

    function isGlobalAdmin(user) {
      return isAdmin(user);
    }

    function isExecutive(user) {
      const group = permissionGroupForUser(user);
      return group === "executive" || group === "superuser";
    }

    function isManager(user) {
      const group = permissionGroupForUser(user);
      return (
        group === "manager" ||
        group === "executive" ||
        group === "admin" ||
        group === "superuser"
      );
    }

    function isStaff(user) {
      return permissionGroupForUser(user) === "staff";
    }

    function getUserById(userId) {
      return state.users.find((user) => user.id === userId) || null;
    }

    function getUserByDisplayName(name) {
      const normalized = String(name || "").trim().toLowerCase();
      return state.users.find((user) => user.displayName.toLowerCase() === normalized) || null;
    }

    function managerClientAssignments(userId) {
      return state.assignments.managerClients.filter((item) => item.managerId === userId);
    }

    function managerProjectAssignments(userId) {
      return state.assignments.managerProjects.filter((item) => item.managerId === userId);
    }

    function projectMembersForUser(userId) {
      return state.assignments.projectMembers.filter((item) => item.userId === userId);
    }

    function managerIdsForClient(client) {
      return uniqueValues(
        state.assignments.managerClients
          .filter((item) => item.client === client)
          .map((item) => item.managerId)
      );
    }

    function managerIdsForClientScope(client) {
      return uniqueValues([
        ...managerIdsForClient(client),
        ...state.assignments.managerProjects
          .filter((item) => item.client === client)
          .map((item) => item.managerId),
      ]);
    }

    function directManagerIdsForProject(client, project) {
      return uniqueValues(
        state.assignments.managerProjects
          .filter((item) => item.client === client && item.project === project)
          .map((item) => item.managerId)
      );
    }

    function managerIdsForProject(client, project) {
      return uniqueValues([
        ...managerIdsForClient(client),
        ...directManagerIdsForProject(client, project),
      ]);
    }

    function staffIdsForProject(client, project) {
      return uniqueValues(
        state.assignments.projectMembers
          .filter((item) => item.client === client && item.project === project)
          .map((item) => item.userId)
          .filter((userId) => {
            const user = getUserById(userId);
            return user ? isStaff(user) : false;
          })
      );
    }

    function staffIdsForClient(client) {
      const managerIds = new Set(managerIdsForClientScope(client));
      return uniqueValues(
        state.assignments.projectMembers
          .filter((item) => item.client === client)
          .map((item) => item.userId)
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

    function allowedProjectTuples(user) {
      if (!user) {
        return [];
      }
      if (isAdmin(user)) {
        return state.projects.map((project) => ({
          client: project.client,
          project: project.name,
        }));
      }

      const group = permissionGroupForUser(user);
      if (group === "executive" && user.officeId) {
        return state.projects
          .filter((project) => (project.officeId || null) === user.officeId)
          .map((project) => ({ client: project.client, project: project.name }));
      }

      if (isManager(user)) {
        const clientAssignments = managerClientAssignments(user.id).map((item) => item.client);
        const projectAssignments = managerProjectAssignments(user.id).map((item) => ({
          client: item.client,
          project: item.project,
        }));
        const clientProjects = [];
        clientAssignments.forEach(function (client) {
          catalogProjectNames(client).forEach(function (project) {
            clientProjects.push({ client, project });
          });
        });
        return uniqueValues(
          [...clientProjects, ...projectAssignments].map((item) => projectKey(item.client, item.project))
        ).map((key) => {
          const [client, project] = key.split("::");
          return { client, project };
        });
      }

      return projectMembersForUser(user.id).map((item) => ({
        client: item.client,
        project: item.project,
      }));
    }

    function allowedClientsForUser(user) {
      const group = permissionGroupForUser(user);
      if (group === "executive" && user?.officeId) {
        return state.clients
          .filter((client) => (client.officeId || null) === user.officeId)
          .map((client) => client.name)
          .sort((a, b) => a.localeCompare(b));
      }
      return uniqueValues(allowedProjectTuples(user).map((item) => item.client)).sort((a, b) =>
        a.localeCompare(b)
      );
    }

    function allowedProjectsForClient(user, client) {
      return uniqueValues(
        allowedProjectTuples(user)
          .filter((item) => item.client === client)
          .map((item) => item.project)
      ).sort((a, b) => a.localeCompare(b));
    }

    function canManagerAccessClient(user, client) {
      if (!isManager(user)) {
        return false;
      }
      return managerClientAssignments(user.id).some((item) => item.client === client);
    }

    function canManagerAccessProject(user, client, project) {
      if (!isManager(user)) {
        return false;
      }
      if (canManagerAccessClient(user, client)) {
        return true;
      }
      return managerProjectAssignments(user.id).some(
        (item) => item.client === client && item.project === project
      );
    }

    function projectCreatedBy(client, project) {
      return (
        state.projects.find((item) => item.client === client && item.name === project)?.createdBy || ""
      );
    }

    function isUserAssignedToProject(userId, client, project) {
      return state.assignments.projectMembers.some(
        (item) => item.userId === userId && item.client === client && item.project === project
      );
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
    };
  }

  window.accessControl = {
    createAccessControl,
  };
})();
