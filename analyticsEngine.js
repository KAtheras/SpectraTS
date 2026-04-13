(function () {
  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function isValidIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function formatMonthKey(isoDate) {
    return isValidIsoDate(isoDate) ? `${isoDate.slice(0, 7)}-01` : "";
  }

  function buildProjectIndex(projects) {
    const byId = new Map();
    const byClientProject = new Map();
    (Array.isArray(projects) ? projects : []).forEach((project) => {
      const id = safeText(project?.id);
      const client = safeText(project?.client);
      const name = safeText(project?.name || project?.project);
      if (id) byId.set(id, project);
      if (client && name) byClientProject.set(`${client.toLowerCase()}::${name.toLowerCase()}`, project);
    });
    return { byId, byClientProject };
  }

  function buildUserIndex(users) {
    const byId = new Map();
    (Array.isArray(users) ? users : []).forEach((user) => {
      const id = safeText(user?.id);
      if (id) byId.set(id, user);
    });
    return byId;
  }

  function buildLookupMap(rows, keyFn) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = keyFn(row);
      if (!key) return;
      map.set(key, row);
    });
    return map;
  }

  function resolveProjectForRecord(record, projectIndex) {
    const projectId = safeText(record?.projectId || record?.project_id);
    if (projectId && projectIndex.byId.has(projectId)) {
      return projectIndex.byId.get(projectId);
    }
    const client = safeText(record?.client || record?.clientName || record?.client_name);
    const projectName = safeText(record?.project || record?.projectName || record?.project_name);
    if (!client || !projectName) return null;
    return projectIndex.byClientProject.get(`${client.toLowerCase()}::${projectName.toLowerCase()}`) || null;
  }

  function resolveScopeMeta(record, project, usersById, clientsById, officesById, departmentsById) {
    const userId = safeText(record?.userId || record?.user_id);
    const user = userId ? usersById.get(userId) : null;

    const projectOfficeId = safeText(project?.officeId || project?.office_id);
    const projectDepartmentId = safeText(project?.projectDepartmentId || project?.project_department_id);

    const clientId = safeText(project?.clientId || project?.client_id);
    const client = clientId ? clientsById.get(clientId) : null;
    const clientOfficeId = safeText(client?.officeId || client?.office_id);

    const officeId = projectOfficeId || clientOfficeId || safeText(user?.officeId || user?.office_id);
    const departmentId = projectDepartmentId || safeText(user?.departmentId || user?.department_id);

    const office = officeId ? officesById.get(officeId) : null;
    const department = departmentId ? departmentsById.get(departmentId) : null;

    return {
      user,
      officeId: officeId || "",
      officeName: safeText(office?.name),
      departmentId: departmentId || "",
      departmentName: safeText(department?.name),
    };
  }

  function entryDate(entry) {
    const date = safeText(entry?.date);
    return isValidIsoDate(date) ? date : "";
  }

  function expenseDate(expense) {
    const primary = safeText(expense?.expenseDate || expense?.expense_date);
    if (isValidIsoDate(primary)) return primary;
    const fallback = safeText(expense?.date);
    return isValidIsoDate(fallback) ? fallback : "";
  }

  function isDeletedRecord(record) {
    return Boolean(record?.deletedAt || record?.deleted_at);
  }

  function createAccumulator() {
    return {
      revenue: 0,
      cost: 0,
      standardRevenue: 0,
      hours: 0,
    };
  }

  function addToAccumulator(target, metric) {
    target.revenue += metric.revenue;
    target.cost += metric.cost;
    target.standardRevenue += metric.standardRevenue;
    target.hours += metric.hours;
  }

  function addMetric(map, key, label, metric) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, label: label || key, ...createAccumulator() });
    }
    addToAccumulator(map.get(key), metric);
  }

  function resolveRateForEntry(entry, project, usersById, projectMemberOverrides, managerOverrides) {
    const userId = safeText(entry?.userId || entry?.user_id);
    const projectId = safeText(project?.id || entry?.projectId || entry?.project_id);
    const user = usersById.get(userId) || null;

    const overrideKey = projectId && userId ? `${projectId}::${userId}` : "";
    const memberOverride = overrideKey ? toNullableNumber(projectMemberOverrides.get(overrideKey)?.chargeRateOverride || projectMemberOverrides.get(overrideKey)?.charge_rate_override) : null;
    const managerOverride = overrideKey ? toNullableNumber(managerOverrides.get(overrideKey)?.chargeRateOverride || managerOverrides.get(overrideKey)?.charge_rate_override) : null;

    const baseRate = toNullableNumber(user?.baseRate ?? user?.base_rate);
    const costRate = toNullableNumber(user?.costRate ?? user?.cost_rate);

    const billRate = memberOverride ?? managerOverride ?? baseRate ?? 0;
    const safeCostRate = costRate ?? baseRate ?? 0;

    return {
      billRate: toNumber(billRate),
      costRate: toNumber(safeCostRate),
      baseRate: toNumber(baseRate ?? 0),
      user,
    };
  }

  function resolveProjectType(project) {
    const pricing = safeText(project?.pricingModel || project?.pricing_model).toLowerCase();
    return pricing === "time_and_materials" ? "tm" : "fixed";
  }

  function applyScopeFilter(row, filters) {
    const scope = safeText(filters?.scope || "company");
    const scopeId = safeText(filters?.scopeId);
    if (scope === "office") {
      if (!scopeId) return true;
      return safeText(row?.officeId) === scopeId;
    }
    if (scope === "department") {
      if (!scopeId) return true;
      return safeText(row?.departmentId) === scopeId;
    }
    return true;
  }

  function applyClientProjectFilter(row, filters) {
    const filterClientId = safeText(filters?.clientId);
    const filterProjectId = safeText(filters?.projectId);
    if (filterClientId && safeText(row?.clientId) !== filterClientId) return false;
    if (filterProjectId && safeText(row?.projectId) !== filterProjectId) return false;
    return true;
  }

  function inDateRange(date, fromDate, toDate) {
    if (!date) return false;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  }

  function realizationPct(revenue, standardRevenue) {
    if (standardRevenue <= 0) return null;
    return (revenue / standardRevenue) * 100;
  }

  function groupKeyForDimension(dimension, row, levelLabels) {
    if (dimension === "client") {
      const name = safeText(row?.clientName) || "Unassigned";
      return { key: `client::${name.toLowerCase()}`, label: name };
    }
    if (dimension === "project") {
      const name = safeText(row?.projectName) || "Unassigned";
      return { key: `project::${name.toLowerCase()}`, label: name };
    }
    if (dimension === "office") {
      const name = safeText(row?.officeName) || "Unassigned";
      return { key: `office::${name.toLowerCase()}`, label: name };
    }
    if (dimension === "department") {
      const name = safeText(row?.departmentName) || "Unassigned";
      return { key: `department::${name.toLowerCase()}`, label: name };
    }
    if (dimension === "member") {
      const name = safeText(row?.memberName) || "Unassigned";
      return { key: `member::${name.toLowerCase()}`, label: name };
    }
    if (dimension === "member_level") {
      const level = Number(row?.memberLevel);
      const label = (levelLabels && levelLabels[level]?.label) || (Number.isFinite(level) ? `Level ${level}` : "Unassigned");
      return { key: `member_level::${String(label).toLowerCase()}`, label };
    }
    return { key: "unknown", label: "Unknown" };
  }

  function computeAnalytics(input) {
    const entries = Array.isArray(input?.entries) ? input.entries : [];
    const expenses = Array.isArray(input?.expenses) ? input.expenses : [];
    const users = Array.isArray(input?.users) ? input.users : [];
    const projects = Array.isArray(input?.projects) ? input.projects : [];
    const clients = Array.isArray(input?.clients) ? input.clients : [];
    const offices = Array.isArray(input?.offices) ? input.offices : [];
    const departments = Array.isArray(input?.departments) ? input.departments : [];
    const assignments = input?.assignments || {};
    const filters = input?.filters || {};
    const groupBy = safeText(filters?.groupBy || "client");

    const fromDate = safeText(filters?.fromDate);
    const toDate = safeText(filters?.toDate);

    const usersById = buildUserIndex(users);
    const projectIndex = buildProjectIndex(projects);
    const clientsById = buildLookupMap(clients, (row) => safeText(row?.id));
    const officesById = buildLookupMap(offices, (row) => safeText(row?.id));
    const departmentsById = buildLookupMap(departments, (row) => safeText(row?.id));

    const projectMemberOverrides = buildLookupMap(assignments?.projectMembers, (row) => {
      const projectId = safeText(row?.projectId || row?.project_id);
      const userId = safeText(row?.userId || row?.user_id);
      return projectId && userId ? `${projectId}::${userId}` : "";
    });
    const managerOverrides = buildLookupMap(assignments?.managerProjects, (row) => {
      const projectId = safeText(row?.projectId || row?.project_id);
      const userId = safeText(row?.managerId || row?.manager_id);
      return projectId && userId ? `${projectId}::${userId}` : "";
    });

    const totals = createAccumulator();
    const trendByMonth = new Map();
    const grouped = new Map();

    const fixedProjectActivity = new Map();
    const fixedProjectHoursByMember = new Map();

    const levelLabels = input?.levelLabels && typeof input.levelLabels === "object" ? input.levelLabels : {};

    const addMetricForRow = (row, metric, monthKey) => {
      addToAccumulator(totals, metric);
      if (monthKey) {
        if (!trendByMonth.has(monthKey)) {
          trendByMonth.set(monthKey, createAccumulator());
        }
        addToAccumulator(trendByMonth.get(monthKey), metric);
      }
      const groupIdentity = groupKeyForDimension(groupBy, row, levelLabels);
      addMetric(grouped, groupIdentity.key, groupIdentity.label, metric);
    };

    entries.forEach((entry) => {
      if (!entry || isDeletedRecord(entry)) return;
      const date = entryDate(entry);
      if (!inDateRange(date, fromDate, toDate)) return;

      const project = resolveProjectForRecord(entry, projectIndex);
      const projectId = safeText(project?.id || entry?.projectId || entry?.project_id);
      const clientId = safeText(project?.clientId || project?.client_id);
      const scopeMeta = resolveScopeMeta(entry, project, usersById, clientsById, officesById, departmentsById);

      const rowContext = {
        projectId,
        clientId,
        clientName: safeText(project?.client || entry?.client),
        projectName: safeText(project?.name || project?.project || entry?.project),
        officeId: scopeMeta.officeId,
        officeName: scopeMeta.officeName,
        departmentId: scopeMeta.departmentId,
        departmentName: scopeMeta.departmentName,
        memberName: safeText(scopeMeta.user?.displayName || scopeMeta.user?.username || entry?.user),
        memberLevel: Number(scopeMeta.user?.level),
      };

      if (!applyScopeFilter(rowContext, filters)) return;
      if (!applyClientProjectFilter(rowContext, filters)) return;

      const rates = resolveRateForEntry(entry, project, usersById, projectMemberOverrides, managerOverrides);
      const hours = toNumber(entry?.hours);
      if (hours <= 0) return;

      const projectType = resolveProjectType(project);
      const isBillable = entry?.billable !== false;
      const revenueFromTime = projectType === "tm" ? (isBillable ? hours * rates.billRate : 0) : 0;
      const costFromTime = hours * rates.costRate;
      const standardRevenue = hours * rates.baseRate;

      const monthKey = formatMonthKey(date);
      addMetricForRow(
        rowContext,
        {
          revenue: revenueFromTime,
          cost: costFromTime,
          standardRevenue,
          hours,
        },
        monthKey
      );

      if (projectType === "fixed" && projectId) {
        const existing = fixedProjectActivity.get(projectId) || {
          project,
          lastDate: "",
          rowContext,
        };
        if (!existing.lastDate || date > existing.lastDate) {
          existing.lastDate = date;
          existing.rowContext = rowContext;
        }
        if (!existing.project && project) {
          existing.project = project;
        }
        fixedProjectActivity.set(projectId, existing);

        const userId = safeText(entry?.userId || entry?.user_id);
        const memberKey = `${projectId}::${userId || rowContext.memberName.toLowerCase()}`;
        fixedProjectHoursByMember.set(memberKey, (fixedProjectHoursByMember.get(memberKey) || 0) + hours);
      }
    });

    expenses.forEach((expense) => {
      if (!expense || isDeletedRecord(expense)) return;
      const date = expenseDate(expense);
      if (!inDateRange(date, fromDate, toDate)) return;

      const project = resolveProjectForRecord(expense, projectIndex);
      const projectType = resolveProjectType(project);
      const projectId = safeText(project?.id || expense?.projectId || expense?.project_id);
      const clientId = safeText(project?.clientId || project?.client_id);
      const scopeMeta = resolveScopeMeta(expense, project, usersById, clientsById, officesById, departmentsById);

      const rowContext = {
        projectId,
        clientId,
        clientName: safeText(project?.client || expense?.clientName || expense?.client),
        projectName: safeText(project?.name || project?.project || expense?.projectName || expense?.project),
        officeId: scopeMeta.officeId,
        officeName: scopeMeta.officeName,
        departmentId: scopeMeta.departmentId,
        departmentName: scopeMeta.departmentName,
        memberName: safeText(scopeMeta.user?.displayName || scopeMeta.user?.username || ""),
        memberLevel: Number(scopeMeta.user?.level),
      };

      if (!applyScopeFilter(rowContext, filters)) return;
      if (!applyClientProjectFilter(rowContext, filters)) return;

      const amount = toNumber(expense?.amount);
      if (amount <= 0) return;

      const isBillable = expense?.isBillable !== false && expense?.is_billable !== false;
      const expenseRevenue = projectType === "tm" ? (isBillable ? amount : 0) : 0;
      const expenseCost = amount;
      const standardRevenue = projectType === "tm" ? (isBillable ? amount : 0) : 0;

      const monthKey = formatMonthKey(date);
      addMetricForRow(
        rowContext,
        {
          revenue: expenseRevenue,
          cost: expenseCost,
          standardRevenue,
          hours: 0,
        },
        monthKey
      );

      if (projectType === "fixed" && projectId) {
        const existing = fixedProjectActivity.get(projectId) || {
          project,
          lastDate: "",
          rowContext,
        };
        if (!existing.lastDate || date > existing.lastDate) {
          existing.lastDate = date;
          existing.rowContext = rowContext;
        }
        if (!existing.project && project) {
          existing.project = project;
        }
        fixedProjectActivity.set(projectId, existing);
      }
    });

    fixedProjectActivity.forEach((activity, projectId) => {
      const project = activity.project || null;
      const contractAmount = toNullableNumber(project?.contractAmount ?? project?.contract_amount);
      if (!Number.isFinite(contractAmount) || contractAmount <= 0) return;

      const activityMonth = formatMonthKey(activity.lastDate || fromDate || toDate || "");
      const baseRow = activity.rowContext || {
        projectId,
        clientId: safeText(project?.clientId || project?.client_id),
        clientName: safeText(project?.client),
        projectName: safeText(project?.name || project?.project),
        officeId: safeText(project?.officeId || project?.office_id),
        officeName: "",
        departmentId: safeText(project?.projectDepartmentId || project?.project_department_id),
        departmentName: "",
        memberName: "",
        memberLevel: null,
      };

      const addContractMetric = (rowContext, amount) => {
        if (!amount || amount <= 0) return;
        addMetricForRow(
          rowContext,
          {
            revenue: amount,
            cost: 0,
            standardRevenue: 0,
            hours: 0,
          },
          activityMonth
        );
      };

      if (groupBy === "member" || groupBy === "member_level") {
        const memberShares = [];
        let totalHours = 0;
        fixedProjectHoursByMember.forEach((hours, key) => {
          if (!key.startsWith(`${projectId}::`)) return;
          if (hours <= 0) return;
          totalHours += hours;
          memberShares.push({ key, hours });
        });

        if (totalHours > 0 && memberShares.length) {
          memberShares.forEach((share) => {
            const memberId = share.key.split("::")[1] || "";
            const user = usersById.get(memberId) || null;
            const rowContext = {
              ...baseRow,
              memberName: safeText(user?.displayName || user?.username) || baseRow.memberName,
              memberLevel: Number(user?.level),
            };
            addContractMetric(rowContext, contractAmount * (share.hours / totalHours));
          });
          return;
        }
      }

      addContractMetric(baseRow, contractAmount);
    });

    const kpis = {
      revenue: totals.revenue,
      cost: totals.cost,
      profit: totals.revenue - totals.cost,
      realizationPct: realizationPct(totals.revenue, totals.standardRevenue),
      totalHours: totals.hours,
      standardRevenue: totals.standardRevenue,
    };

    const trend = Array.from(trendByMonth.entries())
      .map(([month, values]) => ({
        month,
        revenue: values.revenue,
        cost: values.cost,
        profit: values.revenue - values.cost,
        realizationPct: realizationPct(values.revenue, values.standardRevenue),
        totalHours: values.hours,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const groupedRows = Array.from(grouped.values())
      .map((row) => ({
        name: row.label,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.revenue - row.cost,
        realizationPct: realizationPct(row.revenue, row.standardRevenue),
        totalHours: row.hours,
      }))
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));

    return {
      kpis,
      trend,
      groupedRows,
    };
  }

  function listScopeOptions(input) {
    const offices = Array.isArray(input?.offices) ? input.offices : [];
    const departments = Array.isArray(input?.departments) ? input.departments : [];
    return {
      offices: offices
        .map((item) => ({ id: safeText(item?.id), name: safeText(item?.name) }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
      departments: departments
        .map((item) => ({ id: safeText(item?.id), name: safeText(item?.name) }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  function listClientProjectOptions(input) {
    const projects = Array.isArray(input?.projects) ? input.projects : [];
    const clientsById = new Map((Array.isArray(input?.clients) ? input.clients : []).map((c) => [safeText(c?.id), c]));

    const clientsMap = new Map();
    projects.forEach((project) => {
      const clientId = safeText(project?.clientId || project?.client_id);
      const clientName = safeText(project?.client || clientsById.get(clientId)?.name);
      if (clientId && clientName) clientsMap.set(clientId, clientName);
    });

    const clients = Array.from(clientsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const projectsByClient = new Map();
    projects.forEach((project) => {
      const id = safeText(project?.id);
      const name = safeText(project?.name || project?.project);
      const clientId = safeText(project?.clientId || project?.client_id);
      if (!id || !name || !clientId) return;
      if (!projectsByClient.has(clientId)) projectsByClient.set(clientId, []);
      projectsByClient.get(clientId).push({ id, name });
    });
    projectsByClient.forEach((items) => items.sort((a, b) => a.name.localeCompare(b.name)));

    return { clients, projectsByClient };
  }

  window.analyticsEngine = {
    computeAnalytics,
    listScopeOptions,
    listClientProjectOptions,
  };
})();
