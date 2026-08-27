(function () {
  function createSettingsAutosaveController(options = {}) {
    const states = new Map();
    const defaultDelay = Number.isFinite(Number(options.defaultDelay))
      ? Number(options.defaultDelay)
      : 700;

    const stateFor = (key) => {
      const normalized = String(key || "").trim();
      if (!normalized) return null;
      if (!states.has(normalized)) {
        states.set(normalized, {
          timer: null,
          inFlight: false,
          queued: false,
          revision: 0,
          savedRevision: 0,
          savingRevision: 0,
          status: "idle",
          task: null,
        });
      }
      return states.get(normalized);
    };

    const emit = (key, entry) => {
      const form = document.getElementById(key);
      if (form) {
        form.dataset.autosaveStatus = entry.status;
        form.setAttribute("aria-busy", entry.status === "saving" ? "true" : "false");
      }
      const statusNode = document.getElementById("settings-autosave-status");
      if (statusNode) {
        const labels = {
          idle: "",
          pending: "Unsaved changes",
          saving: "Saving…",
          saved: "Saved",
          error: "Not saved",
        };
        const allStatuses = Array.from(states.values()).map((item) => item.status);
        const aggregateStatus = allStatuses.includes("saving")
          ? "saving"
          : allStatuses.includes("pending")
            ? "pending"
            : allStatuses.includes("error")
              ? "error"
              : entry.status;
        statusNode.textContent = labels[aggregateStatus] || "";
        statusNode.dataset.status = aggregateStatus;
      }
      if (typeof options.onStatusChange === "function") {
        options.onStatusChange(key, { ...entry, timer: undefined });
      }
    };

    const scheduleForm = (formId, delayMs = defaultDelay) => {
      const key = String(formId || "").trim();
      const entry = stateFor(key);
      if (!entry) return;
      entry.revision += 1;
      entry.status = "pending";
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.inFlight) {
        entry.queued = true;
        emit(key, entry);
        return;
      }
      entry.timer = setTimeout(() => {
        entry.timer = null;
        const form = document.getElementById(key);
        if (!form || typeof form.requestSubmit !== "function") {
          entry.status = "idle";
          emit(key, entry);
          return;
        }
        form.requestSubmit();
      }, Math.max(0, Number(delayMs) || 0));
      emit(key, entry);
    };

    const runTask = async (key, entry) => {
      if (entry.inFlight || typeof entry.task !== "function") return;
      entry.inFlight = true;
      entry.queued = false;
      entry.savingRevision = entry.revision;
      entry.status = "saving";
      const task = entry.task;
      emit(key, entry);
      let ok = false;
      try {
        await task();
        ok = true;
      } catch (error) {
        entry.lastError = error;
      }
      entry.inFlight = false;
      if (ok) entry.savedRevision = Math.max(entry.savedRevision, entry.savingRevision);
      entry.status = ok ? "saved" : "error";
      const shouldRunAgain = entry.queued || (ok && entry.savedRevision < entry.revision);
      entry.queued = false;
      entry.savingRevision = 0;
      emit(key, entry);
      if (shouldRunAgain) {
        entry.timer = setTimeout(() => {
          entry.timer = null;
          runTask(key, entry);
        }, 0);
      }
    };

    const scheduleTask = (keyValue, task, delayMs = defaultDelay) => {
      const key = String(keyValue || "").trim();
      const entry = stateFor(key);
      if (!entry || typeof task !== "function") return;
      entry.task = task;
      entry.revision += 1;
      entry.status = "pending";
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.inFlight) {
        entry.queued = true;
        emit(key, entry);
        return;
      }
      entry.timer = setTimeout(() => {
        entry.timer = null;
        runTask(key, entry);
      }, Math.max(0, Number(delayMs) || 0));
      emit(key, entry);
    };

    const begin = (formId) => {
      const key = String(formId || "").trim();
      const entry = stateFor(key);
      if (!entry) return true;
      if (entry.inFlight) {
        entry.queued = true;
        emit(key, entry);
        return false;
      }
      entry.inFlight = true;
      entry.queued = false;
      entry.savingRevision = entry.revision;
      entry.status = "saving";
      emit(key, entry);
      return true;
    };

    const finish = (formId, { ok = true } = {}) => {
      const key = String(formId || "").trim();
      const entry = stateFor(key);
      if (!entry) return;
      entry.inFlight = false;
      if (ok) entry.savedRevision = Math.max(entry.savedRevision, entry.savingRevision);
      entry.status = ok ? "saved" : "error";
      const shouldRunAgain = entry.queued || (ok && entry.savedRevision < entry.revision);
      entry.queued = false;
      emit(key, entry);
      entry.savingRevision = 0;
      if (shouldRunAgain) {
        // This is a retry of an existing revision, not a new user edit.
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
          entry.timer = null;
          const form = document.getElementById(key);
          if (form && typeof form.requestSubmit === "function") form.requestSubmit();
        }, 0);
      }
    };

    const cancel = (formId) => {
      const key = String(formId || "").trim();
      const entry = stateFor(key);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      states.delete(key);
    };

    const snapshot = (formId) => {
      const entry = stateFor(formId);
      return entry ? { ...entry, timer: undefined } : null;
    };

    return { scheduleForm, scheduleTask, begin, finish, cancel, snapshot };
  }

  window.settingsAutosave = createSettingsAutosaveController();
  window.createSettingsAutosaveController = createSettingsAutosaveController;
})();
