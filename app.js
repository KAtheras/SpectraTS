(function () {
  const STORAGE_KEY = "timesheet-studio.entries.v1";
  const CATALOG_STORAGE_KEY = "timesheet-studio.catalog.v1";
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const SESSION_TOKEN_STORAGE_KEY = "timesheet-studio.session-token.v1";
  const body = document.body;
  const embedded = window.self !== window.top || window.location.search.includes("embed=1");
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const isLocalHost =
    window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const AUTH_API_PATH = isLocalHost ? "/api/auth" : "/.netlify/functions/auth";
  const STATE_API_PATH = isLocalHost ? "/api/state" : "/.netlify/functions/state";
  const MUTATE_API_PATH = isLocalHost ? "/api/mutate" : "/.netlify/functions/mutate";

  const DEFAULT_CLIENT_PROJECTS = {
    ISTO: ["Bright Start", "Bright Directions", "ABLE", "Secure Choice"],
  };

  const refs = {
    authShell: document.getElementById("auth-shell"),
    appShell: document.getElementById("app-shell"),
    authSubtext: document.getElementById("auth-subtext"),
    loginForm: document.getElementById("login-form"),
    bootstrapForm: document.getElementById("bootstrap-form"),
    authFeedback: document.getElementById("auth-feedback"),
    form: document.getElementById("entry-form"),
    formHeading: document.getElementById("form-heading"),
    cancelEdit: document.getElementById("cancel-edit"),
    sessionIndicator: document.getElementById("session-indicator"),
    manageUsers: document.getElementById("manage-users"),
    logoutButton: document.getElementById("logout-button"),
    themeToggle: document.getElementById("theme-toggle"),
    openCatalog: document.getElementById("open-catalog"),
    closeCatalog: document.getElementById("close-catalog"),
    catalogModal: document.getElementById("catalog-modal"),
    usersModal: document.getElementById("users-modal"),
    closeUsers: document.getElementById("close-users"),
    hourPresets: document.getElementById("hour-presets"),
    otherHours: document.getElementById("other-hours"),
    entryDateMonth: document.getElementById("entry-date-month"),
    entryDateDay: document.getElementById("entry-date-day"),
    entryDateYear: document.getElementById("entry-date-year"),
    submitEntry: document.getElementById("submit-entry"),
    addClientForm: document.getElementById("add-client-form"),
    addProjectForm: document.getElementById("add-project-form"),
    addUserForm: document.getElementById("add-user-form"),
    filterForm: document.getElementById("filter-form"),
    clearFilters: document.getElementById("clear-filters"),
    exportCsv: document.getElementById("export-csv"),
    filterTotalHours: document.getElementById("filter-total-hours"),
    feedback: document.getElementById("feedback"),
    activeFilters: document.getElementById("active-filters"),
    entriesBody: document.getElementById("entries-body"),
    clientList: document.getElementById("client-list"),
    projectList: document.getElementById("project-list"),
    projectColumnLabel: document.getElementById("project-column-label"),
    userList: document.getElementById("user-list"),
  };

  const today = formatDate(new Date());

  const state = {
    catalog: loadCatalog(),
    entries: loadEntries(),
    filters: {
      user: "",
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    },
    editingId: null,
    selectedCatalogClient: "",
    storageMode: "local",
    currentUser: null,
    users: [],
    bootstrapRequired: false,
  };

  const QUICK_HOUR_PRESETS = new Set(["0.5", "1", "1.5", "2", "2.5", "3"]);
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (embedded) {
    body.classList.add("is-embedded");
  }

  function loadThemePreference() {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      return raw === "light" || raw === "dark" ? raw : "";
    } catch (error) {
      return "";
    }
  }

  function loadSessionToken() {
    try {
      return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveSessionToken(token) {
    try {
      if (token) {
        window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    } catch (error) {
      return;
    }
  }

  function saveThemePreference(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      return;
    }
  }

  function resolveTheme() {
    return loadThemePreference() || (themeMedia.matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    body.dataset.theme = theme;
    body.style.colorScheme = theme;

    if (!refs.themeToggle) {
      return;
    }

    const nextLabel = theme === "dark" ? "Light mode" : "Dark mode";
    refs.themeToggle.textContent = nextLabel;
    refs.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    refs.themeToggle.setAttribute("aria-label", nextLabel);
  }

  function availableUsers() {
    if (Array.isArray(state.users) && state.users.length) {
      return state.users
        .map(function (user) {
          return user.displayName;
        })
        .filter(Boolean);
    }

    return [];
  }

  function applyLoadedState(data) {
    state.currentUser = data?.currentUser || null;
    state.users = Array.isArray(data?.users) ? data.users : [];
    state.bootstrapRequired = Boolean(data?.bootstrapRequired);
    state.catalog = normalizeCatalog(data?.catalog || DEFAULT_CLIENT_PROJECTS);
    state.entries = Array.isArray(data?.entries) ? data.entries.map(normalizeEntry).filter(Boolean) : [];
  }

  function clearRemoteAppState() {
    state.currentUser = null;
    state.users = [];
    state.bootstrapRequired = false;
    state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS);
    state.entries = [];
  }

  function defaultEntryUser() {
    return state.storageMode === "remote" && state.currentUser ? state.currentUser.displayName : "";
  }

  function defaultFilterUser() {
    return state.storageMode === "remote" && state.currentUser?.role !== "admin"
      ? state.currentUser.displayName
      : "";
  }

  function resetFilters() {
    state.filters = {
      user: defaultFilterUser(),
      client: "",
      project: "",
      from: "",
      to: "",
      search: "",
    };
  }

  async function requestJson(url, options) {
    const settings = options || {};
    const sessionToken = loadSessionToken();
    const response = await fetch(url, {
      method: settings.method || "GET",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(settings.headers || {}),
      },
      body: settings.body,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(payload?.error || "Request failed.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function requestAuth(action, payload) {
    return requestJson(AUTH_API_PATH, {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });
  }

  async function loadPersistentState() {
    try {
      const payload = await requestAuth("session");
      applyLoadedState(payload);
      state.storageMode = "remote";
      return true;
    } catch (error) {
      if (error.status === 401) {
        saveSessionToken("");
        state.storageMode = "remote";
        state.bootstrapRequired = Boolean(error.payload?.bootstrapRequired);
        state.currentUser = null;
        state.users = [];
        state.entries = [];
        state.catalog = normalizeCatalog(DEFAULT_CLIENT_PROJECTS);
        return true;
      }

      state.storageMode = "local";
      clearRemoteAppState();
      return false;
    }
  }

  function hydrateAuthenticatedState(payload) {
    applyLoadedState(payload);
    state.storageMode = "remote";
    resetFilters();
    resetForm();
    setAuthFeedback("", false);
    feedback("", false);
    closeUsersModal();
    closeCatalogModal();
    render();
  }

  async function mutatePersistentState(action, payload) {
    if (state.storageMode !== "remote") {
      return null;
    }

    const result = await requestJson(MUTATE_API_PATH, {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });
    applyLoadedState(result);
    return result;
  }

  function setAuthFeedback(message, isError) {
    refs.authFeedback.textContent = message || "";
    refs.authFeedback.dataset.error = isError ? "true" : "false";
  }

  function openUsersModal() {
    refs.usersModal.hidden = false;
    refs.usersModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    postHeight();
  }

  function closeUsersModal() {
    refs.usersModal.hidden = true;
    refs.usersModal.setAttribute("aria-hidden", "true");
    if (refs.catalogModal.hidden) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function openCatalogModal() {
    refs.catalogModal.hidden = false;
    refs.catalogModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    postHeight();
  }

  function closeCatalogModal() {
    refs.catalogModal.hidden = true;
    refs.catalogModal.setAttribute("aria-hidden", "true");
    if (refs.usersModal.hidden) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && formatDate(parsed) === value;
  }

  function loadEntries() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function saveEntries() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  }

  function normalizeCatalog(catalog) {
    const source = catalog && typeof catalog === "object" ? catalog : DEFAULT_CLIENT_PROJECTS;
    const normalized = {};

    Object.entries(source).forEach(function ([client, projects]) {
      const clientName = typeof client === "string" ? client.trim() : "";
      if (!clientName) {
        return;
      }

      const normalizedProjects = uniqueValues(
        Array.isArray(projects)
          ? projects.map((project) => (typeof project === "string" ? project.trim() : ""))
          : []
      );

      normalized[clientName] = normalizedProjects;
    });

    return Object.keys(normalized).length ? normalized : { ...DEFAULT_CLIENT_PROJECTS };
  }

  function loadCatalog() {
    try {
      const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeCatalog(parsed || DEFAULT_CLIENT_PROJECTS);
    } catch (error) {
      return normalizeCatalog(DEFAULT_CLIENT_PROJECTS);
    }
  }

  function saveCatalog() {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state.catalog));
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const normalizedProject = typeof entry.project === "string" ? entry.project.trim() : "";
    const normalizedClient =
      typeof entry.client === "string" && entry.client.trim()
        ? entry.client.trim()
        : normalizedProject
          ? "Unassigned Client"
          : "";

    const hours = Number(entry.hours);
    const createdAt =
      typeof entry.createdAt === "string" && entry.createdAt
        ? entry.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof entry.updatedAt === "string" && entry.updatedAt
        ? entry.updatedAt
        : createdAt;

    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
      user:
        typeof entry.user === "string" && entry.user.trim()
          ? entry.user.trim()
          : state.currentUser?.displayName || "",
      date: isValidDateString(entry.date) ? entry.date : today,
      client: normalizedClient,
      project: normalizedProject,
      task: typeof entry.task === "string" ? entry.task.trim() : "",
      hours: Number.isFinite(hours) ? hours : 0,
      notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
      createdAt,
      updatedAt,
    };
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(value) {
    if (!isValidDateString(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year}`;
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

  function parseDisplayDate(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) {
      return "";
    }
    if (digits.length !== 8) {
      return null;
    }

    const month = digits.slice(0, 2);
    const day = digits.slice(2, 4);
    const year = digits.slice(4);
    const iso = `${year}-${month}-${day}`;

    return isValidDateString(iso) ? iso : null;
  }

  function feedback(message, isError) {
    refs.feedback.textContent = message || "";
    refs.feedback.dataset.error = isError ? "true" : "false";
  }

  function field(form, name) {
    return form?.elements?.namedItem(name);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function yearOptions(selectedYear) {
    const currentYear = new Date().getFullYear();
    const year = Number(selectedYear) || currentYear;
    const start = 2026;
    const end = currentYear;
    const clampedYear = Math.min(Math.max(year, start), end);

    return {
      options: Array.from({ length: end - start + 1 }, function (_, index) {
        return String(start + index);
      }),
      selected: String(clampedYear),
    };
  }

  function setSelectOptions(select, options, selectedValue) {
    select.innerHTML = options
      .map(function (option) {
        if (typeof option === "string") {
          return `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`;
        }

        return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
      })
      .join("");

    select.value = String(selectedValue);
  }

  function syncEntryDatePicker(value) {
    const safeValue = isValidDateString(value) ? value : today;
    const [yearText, monthText, dayText] = safeValue.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const day = Number(dayText);
    const maxDay = daysInMonth(year, monthIndex);
    const clampedDay = Math.min(day, maxDay);
    const nextValue = `${yearText}-${monthText}-${String(clampedDay).padStart(2, "0")}`;

    setSelectOptions(
      refs.entryDateMonth,
      MONTH_NAMES.map(function (label, index) {
        return { value: String(index + 1).padStart(2, "0"), label };
      }),
      monthText
    );
    const yearConfig = yearOptions(year);
    setSelectOptions(refs.entryDateYear, yearConfig.options, yearConfig.selected);
    setSelectOptions(
      refs.entryDateDay,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      String(clampedDay).padStart(2, "0")
    );

    field(refs.form, "date").value = nextValue;
  }

  function updateEntryDateFromPicker() {
    const year = refs.entryDateYear.value;
    const month = refs.entryDateMonth.value;
    const day = refs.entryDateDay.value;
    const maxDay = daysInMonth(Number(year), Number(month) - 1);
    const clampedDay = String(Math.min(Number(day), maxDay)).padStart(2, "0");

    setSelectOptions(
      refs.entryDateDay,
      Array.from({ length: maxDay }, function (_, index) {
        return String(index + 1).padStart(2, "0");
      }),
      clampedDay
    );

    field(refs.form, "date").value = `${year}-${month}-${clampedDay}`;
  }

  function catalogClientNames() {
    return Object.keys(state.catalog).sort((a, b) => a.localeCompare(b));
  }

  function historicalClientNames() {
    return uniqueValues(state.entries.map((entry) => entry.client)).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function clientNames() {
    return uniqueValues([...catalogClientNames(), ...historicalClientNames()]).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function catalogProjectNames(client) {
    const configuredProjects = client
      ? state.catalog[client] || []
      : Object.values(state.catalog).flat();
    return uniqueValues(configuredProjects).sort((a, b) => a.localeCompare(b));
  }

  function projectNames(client) {
    const configuredProjects = catalogProjectNames(client);
    const storedProjects = state.entries
      .filter((entry) => !client || entry.client === client)
      .map((entry) => entry.project);

    return uniqueValues([...configuredProjects, ...storedProjects]).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function projectCount(client) {
    return catalogProjectNames(client).length;
  }

  function populateSelect(select, options, placeholder, selectedValue) {
    const finalOptions = uniqueValues([
      ...(Array.isArray(options) ? options : []),
      selectedValue || "",
    ]);

    select.innerHTML =
      `<option value="">${escapeHtml(placeholder)}</option>` +
      finalOptions
        .map(
          (option) =>
            `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
        )
        .join("");

    select.value = selectedValue && finalOptions.includes(selectedValue) ? selectedValue : "";
  }

  function addClient(clientName) {
    const normalizedName = typeof clientName === "string" ? clientName.trim() : "";
    if (!normalizedName) {
      return "Client name is required.";
    }

    const exists = catalogClientNames().some(
      (client) => client.toLowerCase() === normalizedName.toLowerCase()
    );
    if (exists) {
      return "That client already exists.";
    }

    state.catalog[normalizedName] = [];
    state.selectedCatalogClient = normalizedName;
    saveCatalog();
    return "";
  }

  function addProject(clientName, projectName) {
    const normalizedClient = typeof clientName === "string" ? clientName.trim() : "";
    const normalizedProject = typeof projectName === "string" ? projectName.trim() : "";

    if (!normalizedClient) {
      return "Select a client first.";
    }
    if (!normalizedProject) {
      return "Project name is required.";
    }

    const currentProjects = state.catalog[normalizedClient] || [];
    const exists = currentProjects.some(
      (project) => project.toLowerCase() === normalizedProject.toLowerCase()
    );
    if (exists) {
      return "That project already exists for this client.";
    }

    state.catalog[normalizedClient] = [...currentProjects, normalizedProject].sort((a, b) =>
      a.localeCompare(b)
    );
    saveCatalog();
    return "";
  }

  function renameClient(clientName, nextName) {
    const normalizedClient = typeof clientName === "string" ? clientName.trim() : "";
    const normalizedNext = typeof nextName === "string" ? nextName.trim() : "";

    if (!normalizedClient || !state.catalog[normalizedClient]) {
      return "Client not found.";
    }
    if (!normalizedNext) {
      return "Client name is required.";
    }
    if (normalizedClient === normalizedNext) {
      return "";
    }

    const exists = catalogClientNames().some(
      (client) =>
        client !== normalizedClient && client.toLowerCase() === normalizedNext.toLowerCase()
    );
    if (exists) {
      return "That client already exists.";
    }

    state.catalog[normalizedNext] = [...(state.catalog[normalizedClient] || [])];
    delete state.catalog[normalizedClient];

    state.entries = state.entries.map(function (entry) {
      if (entry.client !== normalizedClient) {
        return entry;
      }

      return {
        ...entry,
        client: normalizedNext,
      };
    });

    if (state.selectedCatalogClient === normalizedClient) {
      state.selectedCatalogClient = normalizedNext;
    }
    if (state.filters.client === normalizedClient) {
      state.filters.client = normalizedNext;
    }
    if (field(refs.form, "client")?.value === normalizedClient) {
      syncFormCatalogs({
        user: field(refs.form, "user").value,
        client: normalizedNext,
        project: field(refs.form, "project")?.value || "",
      });
    }

    saveCatalog();
    saveEntries();
    return "";
  }

  function renameProject(clientName, projectName, nextName) {
    const normalizedClient = typeof clientName === "string" ? clientName.trim() : "";
    const normalizedProject = typeof projectName === "string" ? projectName.trim() : "";
    const normalizedNext = typeof nextName === "string" ? nextName.trim() : "";
    const currentProjects = state.catalog[normalizedClient] || [];

    if (!normalizedClient || !normalizedProject || !currentProjects.includes(normalizedProject)) {
      return "Project not found.";
    }
    if (!normalizedNext) {
      return "Project name is required.";
    }
    if (normalizedProject === normalizedNext) {
      return "";
    }

    const exists = currentProjects.some(
      (project) =>
        project !== normalizedProject && project.toLowerCase() === normalizedNext.toLowerCase()
    );
    if (exists) {
      return "That project already exists for this client.";
    }

    state.catalog[normalizedClient] = currentProjects
      .map((project) => (project === normalizedProject ? normalizedNext : project))
      .sort((a, b) => a.localeCompare(b));

    state.entries = state.entries.map(function (entry) {
      if (entry.client !== normalizedClient || entry.project !== normalizedProject) {
        return entry;
      }

      return {
        ...entry,
        project: normalizedNext,
      };
    });

    if (
      state.filters.client === normalizedClient &&
      state.filters.project === normalizedProject
    ) {
      state.filters.project = normalizedNext;
    }
    if (
      field(refs.form, "client")?.value === normalizedClient &&
      field(refs.form, "project")?.value === normalizedProject
    ) {
      syncFormCatalogs({
        user: field(refs.form, "user").value,
        client: normalizedClient,
        project: normalizedNext,
      });
    }

    saveCatalog();
    saveEntries();
    return "";
  }

  function removeClient(clientName) {
    const normalizedClient = typeof clientName === "string" ? clientName.trim() : "";
    if (!normalizedClient || !state.catalog[normalizedClient]) {
      return "Client not found.";
    }

    const hoursLogged = clientHours(normalizedClient);
    delete state.catalog[normalizedClient];

    if (state.filters.client === normalizedClient) {
      state.filters.client = "";
    }
    if (state.selectedCatalogClient === normalizedClient) {
      state.selectedCatalogClient = "";
    }
    if (field(refs.form, "client")?.value === normalizedClient) {
      syncFormCatalogs({
        user: field(refs.form, "user").value,
        client: "",
        project: "",
      });
    }

    saveCatalog();
    return hoursLogged > 0
      ? `Client removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.`
      : "";
  }

  function removeProject(clientName, projectName) {
    const normalizedClient = typeof clientName === "string" ? clientName.trim() : "";
    const normalizedProject = typeof projectName === "string" ? projectName.trim() : "";
    const currentProjects = state.catalog[normalizedClient] || [];

    if (!normalizedClient || !normalizedProject || !currentProjects.includes(normalizedProject)) {
      return "Project not found.";
    }

    const hoursLogged = projectHours(normalizedClient, normalizedProject);
    state.catalog[normalizedClient] = currentProjects.filter((project) => project !== normalizedProject);

    if (
      state.filters.client === normalizedClient &&
      state.filters.project === normalizedProject
    ) {
      state.filters.project = "";
    }
    if (
      field(refs.form, "client")?.value === normalizedClient &&
      field(refs.form, "project")?.value === normalizedProject
    ) {
      syncFormCatalogs({
        user: field(refs.form, "user").value,
        client: normalizedClient,
        project: "",
      });
    }

    saveCatalog();
    return hoursLogged > 0
      ? `Project removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.`
      : "";
  }

  function ensureCatalogSelection() {
    const clients = catalogClientNames();
    if (!clients.length) {
      state.selectedCatalogClient = "";
      return;
    }

    if (!clients.includes(state.selectedCatalogClient)) {
      state.selectedCatalogClient = clients[0];
    }
  }

  function syncFormCatalogs(selection) {
    const userField = field(refs.form, "user");
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    const authUsers = availableUsers();
    const defaultUser = defaultEntryUser();
    const nextUser = selection?.user ?? userField?.value ?? defaultUser;
    const nextClient = selection?.client ?? clientField?.value ?? "";
    const nextProject = selection?.project ?? projectField?.value ?? "";
    const clients = catalogClientNames();
    const projects = nextClient ? catalogProjectNames(nextClient) : [];

    populateSelect(userField, authUsers, "Select team member", nextUser);
    populateSelect(clientField, clients, "Select client", nextClient);
    populateSelect(
      projectField,
      projects,
      nextClient ? "Select project" : "Choose client first",
      nextProject
    );

    if (state.storageMode === "remote" && state.currentUser?.role !== "admin") {
      userField.value = state.currentUser?.displayName || "";
      userField.disabled = true;
    } else {
      userField.disabled = false;
    }
    projectField.disabled = !nextClient;
  }

  function syncFilterCatalogs(selection) {
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    const projectField = field(refs.filterForm, "project");
    const fromField = field(refs.filterForm, "from");
    const toField = field(refs.filterForm, "to");
    const searchField = field(refs.filterForm, "search");
    const authUsers = availableUsers();
    const defaultUser = defaultFilterUser();
    const nextUser = selection?.user ?? userField?.value ?? defaultUser;
    const nextClient = selection?.client ?? clientField?.value ?? "";
    const nextProject = selection?.project ?? projectField?.value ?? "";

    populateSelect(userField, authUsers, "All users", nextUser);
    populateSelect(clientField, clientNames(), "All clients", nextClient);
    populateSelect(
      projectField,
      projectNames(nextClient),
      "All projects",
      nextProject
    );

    if (state.storageMode === "remote" && state.currentUser?.role !== "admin") {
      userField.value = state.currentUser?.displayName || "";
      userField.disabled = true;
    } else {
      userField.disabled = false;
    }

    if (selection?.from !== undefined) {
      fromField.value = formatDisplayDate(selection.from);
    }
    if (selection?.to !== undefined) {
      toField.value = formatDisplayDate(selection.to);
    }
    if (selection?.search !== undefined) {
      searchField.value = selection.search;
    }
  }

  function resetForm() {
    refs.form.reset();
    state.editingId = null;
    syncFormCatalogs({
      user: defaultEntryUser(),
      client: "",
      project: "",
    });
    syncEntryDatePicker(today);
    field(refs.form, "hours").value = "";
    refs.otherHours.value = "";
    renderHourSelection();
    refs.formHeading.textContent = "Add timesheet entry";
    refs.submitEntry.textContent = "Save";
    refs.cancelEdit.hidden = true;
  }

  function setForm(entry) {
    syncFormCatalogs({
      user: entry.user,
      client: entry.client,
      project: entry.project,
    });
    syncEntryDatePicker(entry.date);
    field(refs.form, "hours").value = entry.hours;
    field(refs.form, "notes").value = entry.notes;
    refs.otherHours.value = QUICK_HOUR_PRESETS.has(String(entry.hours)) ? "" : String(entry.hours);
    renderHourSelection();
    state.editingId = entry.id;
    refs.formHeading.textContent = "Edit timesheet entry";
    refs.submitEntry.textContent = "Save";
    refs.cancelEdit.hidden = false;
    refs.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderHourSelection() {
    const hoursValue = String(field(refs.form, "hours").value || "");

    refs.hourPresets.querySelectorAll("[data-hours]").forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.hours === hoursValue);
    });
  }

  function validateEntry(data) {
    if (!data.user) {
      return "Team member is required.";
    }
    if (!data.date) {
      return "Date is required.";
    }
    if (!data.client) {
      return "Client is required.";
    }
    if (!data.project) {
      return "Project is required.";
    }
    if (!Number.isFinite(data.hours) || data.hours <= 0 || data.hours > 24) {
      return "Hours must be between 0.25 and 24.";
    }
    return "";
  }

  function currentEntries() {
    const search = state.filters.search.trim().toLowerCase();

    return [...state.entries]
      .filter((entry) => {
        if (state.filters.user && entry.user !== state.filters.user) {
          return false;
        }
        if (state.filters.client && entry.client !== state.filters.client) {
          return false;
        }
        if (state.filters.project && entry.project !== state.filters.project) {
          return false;
        }
        if (state.filters.from && entry.date < state.filters.from) {
          return false;
        }
        if (state.filters.to && entry.date > state.filters.to) {
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

  function clientHours(client) {
    return state.entries
      .filter((entry) => entry.client === client)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  function projectHours(client, project) {
    return state.entries
      .filter((entry) => entry.client === client && entry.project === project)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  function renderCatalogAside() {
    const clients = catalogClientNames();

    if (!clients.length) {
      refs.clientList.innerHTML = '<p class="empty-state">No clients yet.</p>';
      refs.projectList.innerHTML =
        '<p class="empty-state">Add an entry to start building the client catalog.</p>';
      refs.projectColumnLabel.textContent = "Projects";
      return;
    }

    ensureCatalogSelection();
    const selectedClient = state.selectedCatalogClient;
    const projects = catalogProjectNames(selectedClient);

    refs.clientList.innerHTML = clients
      .map(
        (client) => `
          <article
            class="catalog-item${client === selectedClient ? " is-selected" : ""}"
            data-client="${escapeHtml(client)}"
            role="button"
            tabindex="0"
          >
            <span class="catalog-item-copy">
              <span class="catalog-item-title">${escapeHtml(client)}</span>
              <small>${projectCount(client)} ${
                projectCount(client) === 1 ? "project" : "projects"
              }</small>
            </span>
            <span class="catalog-item-actions">
              <button
                type="button"
                class="catalog-edit"
                aria-label="Edit ${escapeHtml(client)}"
                data-edit-client="${escapeHtml(client)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="catalog-delete"
                aria-label="Delete ${escapeHtml(client)}"
                data-delete-client="${escapeHtml(client)}"
              >
                Remove
              </button>
            </span>
          </article>
        `
      )
      .join("");

    refs.projectColumnLabel.textContent = selectedClient
      ? `Projects for ${selectedClient}`
      : "Projects";
    const projectNameField = field(refs.addProjectForm, "project_name");
    refs.addProjectForm.querySelector("button").disabled = !selectedClient;
    projectNameField.disabled = !selectedClient;
    projectNameField.placeholder = selectedClient
      ? "Add project"
      : "Choose client first";

    refs.projectList.innerHTML = projects.length
      ? projects
          .map(
            (project) => `
              <article
                class="catalog-item catalog-item-project"
                data-project="${escapeHtml(project)}"
                role="button"
                tabindex="0"
              >
                <span class="catalog-item-copy">
                  <span class="catalog-item-title">${escapeHtml(project)}</span>
                  <small>${projectHours(selectedClient, project).toFixed(2)}h logged</small>
                </span>
                <span class="catalog-item-actions">
                  <button
                    type="button"
                    class="catalog-edit"
                    aria-label="Edit ${escapeHtml(project)}"
                    data-edit-project="${escapeHtml(project)}"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="catalog-delete"
                    aria-label="Delete ${escapeHtml(project)}"
                    data-delete-project="${escapeHtml(project)}"
                  >
                    Remove
                  </button>
                </span>
              </article>
            `
          )
          .join("")
      : '<p class="empty-state">No projects configured for this client yet.</p>';
  }

  function renderUsersList() {
    if (!refs.userList) {
      return;
    }

    if (!state.users.length) {
      refs.userList.innerHTML = '<p class="empty-state">No team members yet.</p>';
      return;
    }

    refs.userList.innerHTML = state.users
      .map(function (user) {
        const roleLabel = user.role === "admin" ? "Admin" : "Member";
        const roleActionLabel = user.role === "admin" ? "Make member" : "Make admin";
        const isCurrentUser = state.currentUser?.id === user.id;

        return `
          <article class="catalog-item user-item">
            <span class="catalog-item-copy">
              <span class="catalog-item-title">${escapeHtml(user.displayName)}</span>
              <span class="user-item-meta">
                <span>${escapeHtml(user.username)}</span>
                <span>${escapeHtml(roleLabel)}</span>
                ${isCurrentUser ? "<span>Current session</span>" : ""}
              </span>
            </span>
            <span class="user-item-actions">
              <button
                type="button"
                class="catalog-edit"
                data-user-edit="${escapeHtml(user.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="catalog-edit"
                data-user-role="${escapeHtml(user.id)}"
              >
                ${escapeHtml(roleActionLabel)}
              </button>
              <button
                type="button"
                class="catalog-edit"
                data-user-password="${escapeHtml(user.id)}"
              >
                Reset password
              </button>
              ${
                isCurrentUser
                  ? ""
                  : `<button
                      type="button"
                      class="catalog-delete"
                      data-user-deactivate="${escapeHtml(user.id)}"
                    >
                      Deactivate
                    </button>`
              }
            </span>
          </article>
        `;
      })
      .join("");
  }

  function renderAuthUi() {
    const isRemoteAuth = state.storageMode === "remote";
    const isAuthenticated = Boolean(state.currentUser);

    refs.authShell.hidden = !isRemoteAuth || isAuthenticated;
    refs.appShell.hidden = isRemoteAuth && !isAuthenticated;

    if (!isRemoteAuth) {
      refs.sessionIndicator.hidden = true;
      refs.manageUsers.hidden = true;
      refs.logoutButton.hidden = true;
      refs.openCatalog.hidden = false;
      return;
    }

    refs.loginForm.hidden = state.bootstrapRequired;
    refs.bootstrapForm.hidden = !state.bootstrapRequired;
    refs.authSubtext.textContent = state.bootstrapRequired
      ? "Create the first admin account to activate team logins."
      : "Sign in with your team member credentials to continue.";

    if (isAuthenticated) {
      refs.sessionIndicator.hidden = false;
      refs.sessionIndicator.textContent = `${state.currentUser.displayName} · ${state.currentUser.role}`;
      refs.manageUsers.hidden = state.currentUser.role !== "admin";
      refs.logoutButton.hidden = false;
      refs.openCatalog.hidden = state.currentUser.role !== "admin";
    } else {
      refs.sessionIndicator.hidden = true;
      refs.manageUsers.hidden = true;
      refs.logoutButton.hidden = true;
      refs.openCatalog.hidden = true;
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    const formData = new FormData(refs.loginForm);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    setAuthFeedback("Signing in...", false);

    try {
      const payload = await requestAuth("login", { username, password });
      if (!payload.sessionToken) {
        throw new Error("Login response was missing a session token.");
      }
      if (!payload.currentUser) {
        throw new Error("Login response was missing the current user.");
      }
      saveSessionToken(payload.sessionToken || "");
      setAuthFeedback("Credentials accepted. Loading workspace...", false);
      refs.loginForm.reset();
      hydrateAuthenticatedState(payload);
    } catch (error) {
      console.error("Login failed:", error);
      const message = error.message || "Unable to sign in.";
      setAuthFeedback(message, true);
      window.alert(message);
    }
  }

  async function submitBootstrap(event) {
    event.preventDefault();
    const formData = new FormData(refs.bootstrapForm);
    const displayName = String(formData.get("display_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    setAuthFeedback("Creating admin account...", false);

    try {
      const payload = await requestAuth("bootstrap", { displayName, username, password });
      if (!payload.sessionToken) {
        throw new Error("Bootstrap response was missing a session token.");
      }
      if (!payload.currentUser) {
        throw new Error("Bootstrap response was missing the current user.");
      }
      saveSessionToken(payload.sessionToken || "");
      setAuthFeedback("Admin account created. Loading workspace...", false);
      refs.bootstrapForm.reset();
      hydrateAuthenticatedState(payload);
    } catch (error) {
      console.error("Bootstrap failed:", error);
      const message = error.message || "Unable to create the admin account.";
      setAuthFeedback(message, true);
      window.alert(message);
    }
  }

  async function handleLogout() {
    try {
      await requestAuth("logout");
    } catch (error) {
      feedback(error.message || "Unable to log out.", true);
      return;
    }

    saveSessionToken("");
    clearRemoteAppState();
    resetFilters();
    resetForm();
    setAuthFeedback("", false);
    closeUsersModal();
    closeCatalogModal();
    await loadPersistentState();
    render();
  }

  async function handleAddUser(event) {
    event.preventDefault();
    const formData = new FormData(refs.addUserForm);
    const displayName = String(formData.get("display_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "member");

    try {
      await mutatePersistentState("add_user", {
        displayName,
        username,
        password,
        role,
      });
    } catch (error) {
      feedback(error.message || "Unable to add team member.", true);
      return;
    }

    refs.addUserForm.reset();
    feedback("Team member added.", false);
    render();
  }

  async function handleUserListAction(event) {
    const button = event.target.closest("[data-user-edit], [data-user-role], [data-user-password], [data-user-deactivate]");
    if (!button) {
      return;
    }

    const userId =
      button.dataset.userEdit ||
      button.dataset.userRole ||
      button.dataset.userPassword ||
      button.dataset.userDeactivate;
    const user = state.users.find(function (candidate) {
      return candidate.id === userId;
    });

    if (!user) {
      feedback("Team member not found.", true);
      return;
    }

    try {
      if (button.dataset.userEdit) {
        const nextDisplayName = window.prompt("Team member name", user.displayName);
        if (nextDisplayName === null) {
          return;
        }
        const nextUsername = window.prompt("Username", user.username);
        if (nextUsername === null) {
          return;
        }

        await mutatePersistentState("update_user", {
          userId: user.id,
          displayName: nextDisplayName,
          username: nextUsername,
          role: user.role,
        });
        feedback("Team member updated.", false);
      } else if (button.dataset.userRole) {
        const nextRole = user.role === "admin" ? "member" : "admin";
        const confirmed = window.confirm(
          `Change ${user.displayName} to ${nextRole === "admin" ? "an admin" : "a member"}?`
        );
        if (!confirmed) {
          return;
        }

        await mutatePersistentState("update_user", {
          userId: user.id,
          displayName: user.displayName,
          username: user.username,
          role: nextRole,
        });
        feedback(`Role updated for ${user.displayName}.`, false);
      } else if (button.dataset.userPassword) {
        const nextPassword = window.prompt(
          `Enter a new password for ${user.displayName} (minimum 8 characters)`
        );
        if (nextPassword === null) {
          return;
        }

        await mutatePersistentState("reset_user_password", {
          userId: user.id,
          password: nextPassword,
        });
        feedback(`Password updated for ${user.displayName}.`, false);
      } else if (button.dataset.userDeactivate) {
        const confirmed = window.confirm(`Deactivate ${user.displayName}?`);
        if (!confirmed) {
          return;
        }

        await mutatePersistentState("deactivate_user", {
          userId: user.id,
        });
        feedback(`${user.displayName} was deactivated.`, false);
      }
    } catch (error) {
      feedback(error.message || "Unable to update team member.", true);
      return;
    }

    render();
  }

  function renderFilterState(filteredEntries) {
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

  function renderTable(filteredEntries) {
    if (!filteredEntries.length) {
      refs.entriesBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            <div class="empty-state-panel">
              <strong>No entries match the current filters.</strong>
              <span>Clear the filters or add a new entry to get started.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    refs.entriesBody.innerHTML = filteredEntries
      .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(entry.date)}</td>
            <td>${escapeHtml(entry.user)}</td>
            <td>${escapeHtml(entry.client)}</td>
            <td>${escapeHtml(entry.project)}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${escapeHtml(entry.notes || "-")}</td>
            <td class="actions-cell">
              <button class="text-button" type="button" data-action="edit" data-id="${entry.id}">
                Edit
              </button>
              <button class="text-button danger" type="button" data-action="delete" data-id="${entry.id}">
                Delete
              </button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function render() {
    renderAuthUi();

    if (state.storageMode === "remote" && !state.currentUser) {
      postHeight();
      return;
    }

    syncFormCatalogs();
    syncFilterCatalogs();
    ensureCatalogSelection();

    const filteredEntries = currentEntries();
    renderCatalogAside();
    renderUsersList();
    renderFilterState(filteredEntries);
    renderTable(filteredEntries);
    postHeight();
  }

  function applyFiltersFromForm(options) {
    const settings = options || {};
    const showErrors = settings.showErrors !== false;
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    const projectField = field(refs.filterForm, "project");
    const fromField = field(refs.filterForm, "from");
    const toField = field(refs.filterForm, "to");
    const searchField = field(refs.filterForm, "search");
    const parsedFrom = parseDisplayDate(fromField.value);
    const parsedTo = parseDisplayDate(toField.value);

    if (fromField.value.trim() && !parsedFrom) {
      if (showErrors) {
        feedback("From date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }

    if (toField.value.trim() && !parsedTo) {
      if (showErrors) {
        feedback("To date must be in MM/DD/YYYY format.", true);
      }
      return false;
    }

    state.filters = {
      user: userField.value,
      client: clientField.value,
      project: projectField.value,
      from: parsedFrom || "",
      to: parsedTo || "",
      search: searchField.value,
    };

    fromField.value = formatDisplayDate(state.filters.from);
    toField.value = formatDisplayDate(state.filters.to);
    feedback("", false);
    render();
    return true;
  }

  async function refreshAuthenticatedApp() {
    const restored = await loadPersistentState();
    if (!restored) {
      throw new Error("The app could not load authenticated state.");
    }
    if (!state.currentUser) {
      throw new Error("Sign-in succeeded, but the session could not be restored.");
    }
    resetFilters();
    resetForm();
    setAuthFeedback("", false);
    feedback("", false);
    closeUsersModal();
    closeCatalogModal();
    render();
  }

  function postHeight() {
    if (!embedded) {
      return;
    }

    const height = document.documentElement.scrollHeight;
    window.parent.postMessage(
      {
        type: "timesheet-studio:resize",
        height,
      },
      "*"
    );
  }

  applyTheme(resolveTheme());

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function exportCsv() {
    const entries = currentEntries();
    if (!entries.length) {
      feedback("There are no entries to export.", true);
      return;
    }

    const rows = [
      ["Date", "User", "Client", "Project", "Hours", "Notes"],
      ...entries.map((entry) => [
        entry.date,
        entry.user,
        entry.client,
        entry.project,
        entry.hours,
        entry.notes,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  refs.form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const existingEntry = state.entries.find((entry) => entry.id === state.editingId);
    const userField = field(refs.form, "user");
    const dateField = field(refs.form, "date");
    const clientField = field(refs.form, "client");
    const projectField = field(refs.form, "project");
    const hoursField = field(refs.form, "hours");
    const notesField = field(refs.form, "notes");
    const nextEntry = {
      id: state.editingId || crypto.randomUUID(),
      user: userField.value,
      date: dateField.value,
      client: clientField.value,
      project: projectField.value,
      task: existingEntry?.task || "",
      hours: Number(hoursField.value),
      notes: notesField.value.trim(),
      createdAt: existingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const error = validateEntry(nextEntry);
    if (error) {
      feedback(error, true);
      return;
    }

    try {
      if (state.storageMode === "remote") {
        await mutatePersistentState("save_entry", { entry: nextEntry });
      } else if (state.editingId) {
        state.entries = state.entries.map((entry) =>
          entry.id === state.editingId ? nextEntry : entry
        );
        saveEntries();
      } else {
        state.entries.unshift(nextEntry);
        saveEntries();
      }
    } catch (error) {
      feedback(error.message || "Unable to save entry.", true);
      return;
    }

    feedback(state.editingId ? "Entry updated." : "Entry saved.", false);
    resetForm();
    render();
  });

  refs.cancelEdit.addEventListener("click", function () {
    resetForm();
    feedback("", false);
  });

  refs.loginForm.addEventListener("submit", submitLogin);
  refs.bootstrapForm.addEventListener("submit", submitBootstrap);

  refs.manageUsers.addEventListener("click", function () {
    openUsersModal();
  });

  refs.logoutButton.addEventListener("click", function () {
    handleLogout();
  });

  refs.openCatalog.addEventListener("click", openCatalogModal);

  if (refs.themeToggle) {
    refs.themeToggle.addEventListener("click", function () {
      const nextTheme = body.dataset.theme === "dark" ? "light" : "dark";
      saveThemePreference(nextTheme);
      applyTheme(nextTheme);
    });
  }

  themeMedia.addEventListener("change", function (event) {
    if (loadThemePreference()) {
      return;
    }

    applyTheme(event.matches ? "dark" : "light");
  });

  if (refs.closeCatalog) {
    refs.closeCatalog.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeCatalogModal();
    });
  }

  refs.catalogModal.addEventListener("click", function (event) {
    if (event.target === refs.catalogModal) {
      closeCatalogModal();
    }
  });

  refs.closeUsers.addEventListener("click", function (event) {
    event.preventDefault();
    closeUsersModal();
  });

  refs.usersModal.addEventListener("click", function (event) {
    if (event.target === refs.usersModal) {
      closeUsersModal();
    }
  });

  document.addEventListener("click", function (event) {
    const closeTrigger = event.target.closest("[data-close-catalog]");
    if (!closeTrigger) {
      return;
    }

    event.preventDefault();
    closeCatalogModal();
  });

  refs.hourPresets.addEventListener("click", function (event) {
    const button = event.target.closest("[data-hours]");
    if (!button) {
      return;
    }

    const hoursField = field(refs.form, "hours");
    hoursField.value = button.dataset.hours;
    refs.otherHours.value = "";
    renderHourSelection();
  });

  refs.otherHours.addEventListener("input", function () {
    const hoursField = field(refs.form, "hours");
    hoursField.value = refs.otherHours.value;
    renderHourSelection();
  });

  ["from", "to"].forEach(function (name) {
    field(refs.filterForm, name).addEventListener("input", function (event) {
      const normalized = normalizeDisplayDateInput(event.target.value);
      if (event.target.value !== normalized) {
        event.target.value = normalized;
      }

      if (!event.target.value.trim() || event.target.value.trim().length === 10) {
        applyFiltersFromForm({ showErrors: false });
      }
    });

    field(refs.filterForm, name).addEventListener("change", function () {
      applyFiltersFromForm();
    });
  });

  refs.entryDateMonth.addEventListener("change", updateEntryDateFromPicker);
  refs.entryDateDay.addEventListener("change", updateEntryDateFromPicker);
  refs.entryDateYear.addEventListener("change", updateEntryDateFromPicker);

  field(refs.form, "client").addEventListener("change", function () {
    const userField = field(refs.form, "user");
    const clientField = field(refs.form, "client");
    state.selectedCatalogClient = clientField.value || state.selectedCatalogClient;
    syncFormCatalogs({
      user: userField.value,
      client: clientField.value,
      project: "",
    });
    renderCatalogAside();
  });

  field(refs.filterForm, "client").addEventListener("change", function () {
    const userField = field(refs.filterForm, "user");
    const clientField = field(refs.filterForm, "client");
    syncFilterCatalogs({
      user: userField.value,
      client: clientField.value,
      project: "",
    });
    applyFiltersFromForm();
  });

  ["user", "project"].forEach(function (name) {
    field(refs.filterForm, name).addEventListener("change", function () {
      applyFiltersFromForm();
    });
  });

  field(refs.filterForm, "search").addEventListener("input", function () {
    applyFiltersFromForm({ showErrors: false });
  });

  refs.filterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    applyFiltersFromForm();
  });

  refs.clearFilters.addEventListener("click", function () {
    refs.filterForm.reset();
    resetFilters();
    syncFilterCatalogs(state.filters);
    render();
  });

  refs.exportCsv.addEventListener("click", exportCsv);
  refs.addUserForm.addEventListener("submit", handleAddUser);
  refs.userList.addEventListener("click", handleUserListAction);

  refs.addClientForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const clientNameField = field(refs.addClientForm, "client_name");
    const formUserField = field(refs.form, "user");
    const filterUserField = field(refs.filterForm, "user");
    const filterClientField = field(refs.filterForm, "client");
    const filterProjectField = field(refs.filterForm, "project");
    try {
      if (state.storageMode === "remote") {
        await mutatePersistentState("add_client", {
          clientName: clientNameField.value,
        });
        state.selectedCatalogClient = clientNameField.value.trim();
      } else {
        const error = addClient(clientNameField.value);
        if (error) {
          feedback(error, true);
          return;
        }
      }
    } catch (error) {
      feedback(error.message || "Unable to add client.", true);
      return;
    }

    refs.addClientForm.reset();
    syncFormCatalogs({
      user: formUserField.value,
      client: state.selectedCatalogClient,
      project: "",
    });
    syncFilterCatalogs({
      user: filterUserField.value,
      client: filterClientField.value,
      project: filterProjectField.value,
    });
    feedback("Client added.", false);
    render();
  });

  refs.addProjectForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const projectNameField = field(refs.addProjectForm, "project_name");
    const formUserField = field(refs.form, "user");
    const filterUserField = field(refs.filterForm, "user");
    const filterClientField = field(refs.filterForm, "client");
    const filterProjectField = field(refs.filterForm, "project");
    try {
      if (state.storageMode === "remote") {
        await mutatePersistentState("add_project", {
          clientName: state.selectedCatalogClient,
          projectName: projectNameField.value,
        });
      } else {
        const error = addProject(
          state.selectedCatalogClient,
          projectNameField.value
        );
        if (error) {
          feedback(error, true);
          return;
        }
      }
    } catch (error) {
      feedback(error.message || "Unable to add project.", true);
      return;
    }

    const newestProject = projectNameField.value.trim();
    refs.addProjectForm.reset();
    syncFormCatalogs({
      user: formUserField.value,
      client: state.selectedCatalogClient,
      project: newestProject,
    });
    syncFilterCatalogs({
      user: filterUserField.value,
      client: filterClientField.value,
      project: filterProjectField.value,
    });
    feedback("Project added.", false);
    render();
  });

  refs.clientList.addEventListener("click", async function (event) {
    const editButton = event.target.closest("[data-edit-client]");
    if (editButton) {
      const clientName = editButton.dataset.editClient;
      const nextName = window.prompt("Edit client name", clientName);
      if (nextName === null) {
        return;
      }

      try {
        if (state.storageMode === "remote") {
          await mutatePersistentState("rename_client", {
            clientName,
            nextName,
          });
          if (state.selectedCatalogClient === clientName) {
            state.selectedCatalogClient = nextName.trim();
          }
          if (state.filters.client === clientName) {
            state.filters.client = nextName.trim();
          }
        } else {
          const message = renameClient(clientName, nextName);
          if (message) {
            feedback(message, message !== "");
            if (message) {
              render();
            }
            return;
          }
        }
      } catch (error) {
        feedback(error.message || "Unable to update client.", true);
        return;
      }

      syncFilterCatalogs(state.filters);
      feedback("Client updated.", false);
      render();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-client]");
    if (deleteButton) {
      const clientName = deleteButton.dataset.deleteClient;
      const hoursLogged = clientHours(clientName);
      const confirmed = window.confirm(
        hoursLogged > 0
          ? `${clientName} already has ${hoursLogged.toFixed(
              2
            )} logged hours. Remove it from the active catalog and keep the history?`
          : `Remove ${clientName} from the active catalog?`
      );
      if (!confirmed) {
        return;
      }

      let message = "";
      try {
        if (state.storageMode === "remote") {
          const result = await mutatePersistentState("remove_client", {
            clientName,
          });
          message = result?.message || "";
          if (state.selectedCatalogClient === clientName) {
            state.selectedCatalogClient = "";
          }
          if (state.filters.client === clientName) {
            state.filters.client = "";
          }
        } else {
          message = removeClient(clientName);
          if (message === "Client not found.") {
            feedback(message, true);
            return;
          }
        }
      } catch (error) {
        feedback(error.message || "Unable to remove client.", true);
        return;
      }

      syncFilterCatalogs(state.filters);
      feedback(message || "Client removed from active catalog.", false);
      render();
      return;
    }

    const button = event.target.closest("[data-client]");
    if (!button) {
      return;
    }

    state.selectedCatalogClient = button.dataset.client;
    renderCatalogAside();
    postHeight();
  });

  refs.clientList.addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-client]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    row.click();
  });

  refs.projectList.addEventListener("click", async function (event) {
    const editButton = event.target.closest("[data-edit-project]");
    if (editButton) {
      const projectName = editButton.dataset.editProject;
      const nextName = window.prompt("Edit project name", projectName);
      if (nextName === null) {
        return;
      }

      try {
        if (state.storageMode === "remote") {
          await mutatePersistentState("rename_project", {
            clientName: state.selectedCatalogClient,
            projectName,
            nextName,
          });
          if (
            state.filters.client === state.selectedCatalogClient &&
            state.filters.project === projectName
          ) {
            state.filters.project = nextName.trim();
          }
        } else {
          const message = renameProject(state.selectedCatalogClient, projectName, nextName);
          if (message) {
            feedback(message, message !== "");
            if (message) {
              render();
            }
            return;
          }
        }
      } catch (error) {
        feedback(error.message || "Unable to update project.", true);
        return;
      }

      syncFilterCatalogs(state.filters);
      feedback("Project updated.", false);
      render();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-project]");
    if (deleteButton) {
      const projectName = deleteButton.dataset.deleteProject;
      const hoursLogged = projectHours(state.selectedCatalogClient, projectName);
      const confirmed = window.confirm(
        hoursLogged > 0
          ? `${projectName} already has ${hoursLogged.toFixed(
              2
            )} logged hours. Remove it from the active catalog and keep the history?`
          : `Remove ${projectName} from the active catalog?`
      );
      if (!confirmed) {
        return;
      }

      let message = "";
      try {
        if (state.storageMode === "remote") {
          const result = await mutatePersistentState("remove_project", {
            clientName: state.selectedCatalogClient,
            projectName,
          });
          message = result?.message || "";
          if (
            state.filters.client === state.selectedCatalogClient &&
            state.filters.project === projectName
          ) {
            state.filters.project = "";
          }
        } else {
          message = removeProject(state.selectedCatalogClient, projectName);
          if (message === "Project not found.") {
            feedback(message, true);
            return;
          }
        }
      } catch (error) {
        feedback(error.message || "Unable to remove project.", true);
        return;
      }

      syncFilterCatalogs(state.filters);
      feedback(message || "Project removed from active catalog.", false);
      render();
      return;
    }

    const button = event.target.closest("[data-project]");
    if (!button || !state.selectedCatalogClient) {
      return;
    }

    syncFormCatalogs({
      user: field(refs.form, "user").value,
      client: state.selectedCatalogClient,
      project: button.dataset.project,
    });
    closeCatalogModal();
    refs.hourPresets.querySelector("[data-hours]")?.focus();
    feedback("Project selected in the form.", false);
    postHeight();
  });

  refs.projectList.addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-project]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    row.click();
  });

  refs.entriesBody.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;
    const entry = state.entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    if (action === "edit") {
      setForm(entry);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Are you sure you want to delete this entry?");
      if (!confirmed) {
        return;
      }

      try {
        if (state.storageMode === "remote") {
          await mutatePersistentState("delete_entry", { id });
        } else {
          state.entries = state.entries.filter((item) => item.id !== id);
          saveEntries();
        }
      } catch (error) {
        feedback(error.message || "Unable to delete entry.", true);
        return;
      }

      if (state.editingId === id) {
        resetForm();
      }
      feedback("Entry deleted.", false);
      render();
    }
  });

  window.addEventListener("resize", postHeight);
  window.addEventListener("load", postHeight);
  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    if (!refs.usersModal.hidden) {
      closeUsersModal();
    }

    if (!refs.catalogModal.hidden) {
      closeCatalogModal();
    }
  });

  async function initApp() {
    await loadPersistentState();
    resetFilters();

    if (state.storageMode === "remote" && !state.currentUser) {
      render();
      return;
    }

    syncFilterCatalogs(state.filters);
    resetForm();
    render();
  }

  initApp();
})();
