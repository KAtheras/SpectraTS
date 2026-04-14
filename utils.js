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
    const employeeId =
      typeof user.employeeId === "string"
        ? user.employeeId.trim()
        : typeof user.employee_id === "string"
          ? user.employee_id.trim()
          : "";
    const username =
      typeof user.username === "string" && user.username.trim()
        ? user.username.trim()
        : displayName
          ? displayName.toLowerCase().replace(/\s+/g, ".")
          : "";
    const level = normalizeLevel(user.level);
    const role =
      typeof user.role === "string" && user.role.trim()
        ? user.role.trim().toLowerCase()
        : null;
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
    const officeId =
      user.officeId !== undefined && user.officeId !== null
        ? user.officeId
        : user.office_id !== undefined && user.office_id !== null
          ? user.office_id
          : null;
    const departmentId =
      user.departmentId !== undefined && user.departmentId !== null
        ? user.departmentId
        : user.department_id !== undefined && user.department_id !== null
          ? user.department_id
          : null;
    const departmentName =
      typeof user.departmentName === "string" && user.departmentName
        ? user.departmentName
        : user.department_name || null;
    const mustChangePassword =
      user.mustChangePassword !== undefined
        ? Boolean(user.mustChangePassword)
        : user.must_change_password !== undefined
          ? Boolean(user.must_change_password)
          : false;
    const isExempt =
      user.isExempt !== undefined
        ? Boolean(user.isExempt)
        : user.is_exempt !== undefined
          ? Boolean(user.is_exempt)
          : false;

    if (!displayName || !username) {
      return null;
    }

    return {
      id: typeof user.id === "string" && user.id ? user.id : crypto.randomUUID(),
      displayName,
      employeeId,
      username,
      level,
      role,
      password,
      baseRate: Number.isFinite(baseRate) ? baseRate : null,
      costRate: Number.isFinite(costRate) ? costRate : null,
      mustChangePassword,
      isExempt,
      accountId: user.accountId || "",
      officeId: officeId !== null && officeId !== undefined ? String(officeId) : "",
      departmentId: departmentId !== null && departmentId !== undefined ? String(departmentId) : "",
      departmentName: departmentName || "",
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
        const budgetRaw = project.budget !== undefined ? Number(project.budget) : null;
        const contractAmountRaw =
          project.contractAmount !== undefined && project.contractAmount !== null
            ? Number(project.contractAmount)
            : project.contract_amount !== undefined && project.contract_amount !== null
              ? Number(project.contract_amount)
              : null;
        const pricingModelRaw =
          project.pricingModel !== undefined && project.pricingModel !== null
            ? String(project.pricingModel).trim()
            : project.pricing_model !== undefined && project.pricing_model !== null
              ? String(project.pricing_model).trim()
              : "";
        const overheadPercentRaw =
          project.overheadPercent !== undefined && project.overheadPercent !== null
            ? Number(project.overheadPercent)
            : project.overhead_percent !== undefined && project.overhead_percent !== null
              ? Number(project.overhead_percent)
              : null;
        const officeId =
          project.officeId !== undefined && project.officeId !== null
            ? project.officeId
            : project.office_id !== undefined && project.office_id !== null
              ? project.office_id
              : "";
        const projectDepartmentIdRaw =
          project.projectDepartmentId !== undefined && project.projectDepartmentId !== null
            ? project.projectDepartmentId
            : project.project_department_id !== undefined && project.project_department_id !== null
              ? project.project_department_id
              : "";
        const projectDepartmentId = projectDepartmentIdRaw ? String(projectDepartmentIdRaw).trim() : "";
        const projectDepartmentName =
          typeof project.projectDepartmentName === "string" && project.projectDepartmentName.trim()
            ? project.projectDepartmentName.trim()
            : typeof project.project_department_name === "string" && project.project_department_name.trim()
              ? project.project_department_name.trim()
              : "";
        const targetRealizationRaw =
          project.targetRealizationPct !== undefined && project.targetRealizationPct !== null
            ? Number(project.targetRealizationPct)
            : project.target_realization_pct !== undefined && project.target_realization_pct !== null
              ? Number(project.target_realization_pct)
              : null;
        const projectLeadIdRaw =
          project.projectLeadId !== undefined && project.projectLeadId !== null
            ? project.projectLeadId
            : project.project_lead_id !== undefined && project.project_lead_id !== null
              ? project.project_lead_id
              : "";
        const projectLeadId = projectLeadIdRaw ? String(projectLeadIdRaw).trim() : "";
        const projectLeadName =
          typeof project.projectLeadName === "string" && project.projectLeadName.trim()
            ? project.projectLeadName.trim()
            : typeof project.project_lead_name === "string" && project.project_lead_name.trim()
              ? project.project_lead_name.trim()
              : "";
        const percentCompleteRaw =
          project.percentComplete !== undefined && project.percentComplete !== null
            ? Number(project.percentComplete)
            : project.percent_complete !== undefined && project.percent_complete !== null
              ? Number(project.percent_complete)
              : null;
        const percentCompleteUpdatedAt =
          typeof project.percentCompleteUpdatedAt === "string" && project.percentCompleteUpdatedAt.trim()
            ? project.percentCompleteUpdatedAt.trim()
            : typeof project.percent_complete_updated_at === "string" && project.percent_complete_updated_at.trim()
              ? project.percent_complete_updated_at.trim()
              : null;
        const planningStatusRaw =
          project.planningStatus !== undefined && project.planningStatus !== null
            ? String(project.planningStatus).trim().toLowerCase()
            : project.planning_status !== undefined && project.planning_status !== null
              ? String(project.planning_status).trim().toLowerCase()
              : "draft";
        const planningStatus =
          planningStatusRaw === "submitted" || planningStatusRaw === "approved" || planningStatusRaw === "draft"
            ? planningStatusRaw
            : "draft";
        return {
          id: project.id || "",
          client,
          name,
          createdBy: project.createdBy || "",
          budget: Number.isFinite(budgetRaw) ? budgetRaw : null,
          contractAmount: Number.isFinite(contractAmountRaw) ? contractAmountRaw : null,
          contract_amount: Number.isFinite(contractAmountRaw) ? contractAmountRaw : null,
          pricingModel: pricingModelRaw || null,
          pricing_model: pricingModelRaw || null,
          overheadPercent: Number.isFinite(overheadPercentRaw) ? overheadPercentRaw : null,
          overhead_percent: Number.isFinite(overheadPercentRaw) ? overheadPercentRaw : null,
          isActive: project?.isActive ?? project?.is_active ?? true,
          is_active: project?.isActive ?? project?.is_active ?? true,
          officeId: officeId ? String(officeId) : "",
          office_id: officeId ? String(officeId) : "",
          projectDepartmentId: projectDepartmentId || null,
          project_department_id: projectDepartmentId || null,
          projectDepartmentName: projectDepartmentName || null,
          targetRealizationPct: Number.isFinite(targetRealizationRaw) ? targetRealizationRaw : null,
          target_realization_pct: Number.isFinite(targetRealizationRaw) ? targetRealizationRaw : null,
          projectLeadId: projectLeadId || null,
          project_lead_id: projectLeadId || null,
          projectLeadName,
          percentComplete: Number.isFinite(percentCompleteRaw) ? percentCompleteRaw : null,
          percent_complete: Number.isFinite(percentCompleteRaw) ? percentCompleteRaw : null,
          percentCompleteUpdatedAt,
          percent_complete_updated_at: percentCompleteUpdatedAt,
          planningStatus,
          planning_status: planningStatus,
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
