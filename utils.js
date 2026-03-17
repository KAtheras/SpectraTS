(function () {
  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function projectKey(client, project) {
    return `${client}::${project}`;
  }

  function uniqueValues(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && formatDate(parsed) === value;
  }

  function normalizeLevel(value) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
      return value;
    }
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 1) {
      return numeric;
    }
    if (raw === "staff") return 1;
    if (raw === "senior") return 2;
    if (raw === "manager") return 3;
    if (raw === "director") return 4;
    if (raw === "partner") return 5;
    if (raw === "admin" || raw === "global_admin") return 6;
    if (raw === "member") return 1;
    return 1;
  }

  function normalizeUser(user) {
    if (!user || typeof user !== "object") {
      return null;
    }

    const displayName =
      typeof user.displayName === "string" && user.displayName.trim()
        ? user.displayName.trim()
        : "";
    const username =
      typeof user.username === "string" && user.username.trim()
        ? user.username.trim()
        : displayName
          ? displayName.toLowerCase().replace(/\s+/g, ".")
          : "";
    const level = normalizeLevel(user.level ?? user.role);
    const password = typeof user.password === "string" ? user.password : "";
    const baseRate =
      user.baseRate !== undefined && user.baseRate !== null
        ? Number(user.baseRate)
        : user.base_rate !== undefined && user.base_rate !== null
          ? Number(user.base_rate)
          : null;
    const costRate =
      user.costRate !== undefined && user.costRate !== null
        ? Number(user.costRate)
        : user.cost_rate !== undefined && user.cost_rate !== null
          ? Number(user.cost_rate)
          : null;
    const mustChangePassword =
      user.mustChangePassword !== undefined
        ? Boolean(user.mustChangePassword)
        : user.must_change_password !== undefined
          ? Boolean(user.must_change_password)
          : false;

    if (!displayName || !username) {
      return null;
    }

    return {
      id: typeof user.id === "string" && user.id ? user.id : crypto.randomUUID(),
      displayName,
      username,
      level,
      password,
      baseRate: Number.isFinite(baseRate) ? baseRate : null,
      costRate: Number.isFinite(costRate) ? costRate : null,
      mustChangePassword,
      accountId: user.accountId || "",
    };
  }

  function buildProjectMetaMap(projects) {
    return (projects || []).reduce(function (acc, project) {
      if (!project || !project.client || !project.name) {
        return acc;
      }
      acc[projectKey(project.client, project.name)] = project.createdBy || "";
      return acc;
    }, {});
  }

  function normalizeProjects(projects) {
    if (!Array.isArray(projects)) {
      return [];
    }
    return projects
      .map(function (project) {
        const client = typeof project.client === "string" ? project.client.trim() : "";
        const name = typeof project.name === "string" ? project.name.trim() : "";
        if (!client || !name) {
          return null;
        }
        return {
          id: project.id || "",
          client,
          name,
          createdBy: project.createdBy || "",
        };
      })
      .filter(Boolean);
  }

  function buildProjectsFromCatalog(catalog, projectMeta) {
    const meta = projectMeta || {};
    const entries = [];
    Object.entries(catalog || {}).forEach(function ([client, projects]) {
      (projects || []).forEach(function (project) {
        entries.push({
          id: "",
          client,
          name: project,
          createdBy: meta[projectKey(client, project)] || "",
        });
      });
    });
    return entries;
  }

  function normalizeAssignments(assignments) {
    const managerClients = Array.isArray(assignments?.managerClients)
      ? assignments.managerClients
      : [];
    const managerProjects = Array.isArray(assignments?.managerProjects)
      ? assignments.managerProjects
      : [];
    const projectMembers = Array.isArray(assignments?.projectMembers)
      ? assignments.projectMembers
      : [];
    return {
      managerClients,
      managerProjects,
      projectMembers,
    };
  }

  function normalizeDisplayDateInput(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);

    if (digits.length <= 2) {
      return digits;
    }
    if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  window.utils = {
    projectKey,
    uniqueValues,
    isValidDateString,
    normalizeLevel,
    normalizeUser,
    buildProjectMetaMap,
    normalizeProjects,
    buildProjectsFromCatalog,
    normalizeAssignments,
    formatDate,
    normalizeDisplayDateInput,
  };
})();
