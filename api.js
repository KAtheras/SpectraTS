(function () {
  const isLocalHost =
    window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

  const AUTH_API_PATH = isLocalHost ? "/api/auth" : "/.netlify/functions/auth";
  const STATE_API_PATH = isLocalHost ? "/api/state" : "/.netlify/functions/state";
  const MUTATE_API_PATH = isLocalHost ? "/api/mutate" : "/.netlify/functions/mutate";
  const RECORDS_API_PATH = isLocalHost ? "/api/records" : "/.netlify/functions/records";
  const ANALYTICS_API_PATH = isLocalHost ? "/api/analytics" : "/.netlify/functions/analytics";
  const responseCache = new Map();

  function clearResponseCache() {
    responseCache.clear();
  }

  function defaultCacheTtl(pathname) {
    if (pathname.endsWith("/state")) return 5 * 60 * 1000;
    if (pathname.endsWith("/records")) return 30 * 1000;
    if (pathname.endsWith("/analytics")) return 60 * 1000;
    return 0;
  }

  function loadSessionToken() {
    const key = "timesheet-studio.session-token.v1";
    try {
      const localValue = window.localStorage.getItem(key) || "";
      if (localValue) return localValue;
    } catch (error) {
      // Ignore storage read failures and fall back.
    }
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function saveSessionToken(token) {
    const key = "timesheet-studio.session-token.v1";
    try {
      if (token) {
        window.localStorage.setItem(key, token);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      // Ignore localStorage write failures and continue.
    }
    try {
      if (token) {
        window.sessionStorage.setItem(key, token);
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      // Session storage can be unavailable in privacy-restricted contexts.
    } finally {
      clearResponseCache();
    }
  }

  async function requestJson(url, options) {
    const settings = options || {};
    const sessionToken = settings.sessionToken || loadSessionToken();
    const targetUrl = new URL(url, window.location.origin);
    const method = settings.method || "GET";
    const cacheTtlMs = settings.cacheTtlMs ?? defaultCacheTtl(targetUrl.pathname);
    const cacheKey = `${sessionToken}::${targetUrl.toString()}`;
    const cached = method === "GET" && cacheTtlMs > 0 ? responseCache.get(cacheKey) : null;
    if (cached && cached.expiresAt > Date.now()) {
      const metrics = {
        path: targetUrl.pathname,
        status: 200,
        responseBytes: cached.responseBytes,
        networkMs: 0,
        parseMs: 0,
        totalMs: 0,
        cacheHit: true,
        measuredAt: new Date().toISOString(),
        budgetExceeded: [],
      };
      window.__timesheetPerformance = window.__timesheetPerformance || [];
      window.__timesheetPerformance.push(metrics);
      if (window.__timesheetPerformance.length > 50) window.__timesheetPerformance.shift();
      settings.onMetrics?.(metrics);
      return typeof structuredClone === "function" ? structuredClone(cached.payload) : JSON.parse(JSON.stringify(cached.payload));
    }
    if (cached) responseCache.delete(cacheKey);

    const startedAt = performance.now();
    const response = await fetch(targetUrl.toString(), {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(sessionToken ? { "X-Spectra-Session": sessionToken } : {}),
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(settings.headers || {}),
      },
      body: settings.body,
      signal: settings.signal,
    });

    const responseAt = performance.now();
    const text = await response.text();
    const parseStartedAt = performance.now();
    const payload = text ? JSON.parse(text) : {};
    const completedAt = performance.now();
    const metrics = {
      path: targetUrl.pathname,
      status: response.status,
      responseBytes: new Blob([text]).size,
      networkMs: Number((responseAt - startedAt).toFixed(1)),
      parseMs: Number((completedAt - parseStartedAt).toFixed(1)),
      totalMs: Number((completedAt - startedAt).toFixed(1)),
      serverTiming: response.headers.get("server-timing") || "",
      measuredAt: new Date().toISOString(),
    };
    const budgetResult = window.performanceBudgets?.evaluate(metrics);
    metrics.budgetExceeded = budgetResult?.exceeded || [];
    window.__timesheetPerformance = window.__timesheetPerformance || [];
    window.__timesheetPerformance.push(metrics);
    if (window.__timesheetPerformance.length > 50) window.__timesheetPerformance.shift();
    settings.onMetrics?.(metrics);
    if (metrics.budgetExceeded.length) {
      window.dispatchEvent(new CustomEvent("timesheet:performance-budget-exceeded", { detail: metrics }));
    }

    if (!response.ok) {
      const error = new Error(payload?.error || "Request failed.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    if (method === "GET" && cacheTtlMs > 0) {
      const cachedPayload = typeof structuredClone === "function" ? structuredClone(payload) : JSON.parse(JSON.stringify(payload));
      responseCache.set(cacheKey, { payload: cachedPayload, responseBytes: metrics.responseBytes, expiresAt: Date.now() + cacheTtlMs });
      if (responseCache.size > 100) responseCache.delete(responseCache.keys().next().value);
    } else if (method !== "GET") {
      clearResponseCache();
    }

    return payload;
  }

  async function requestAuth(action, payload) {
    const sessionToken = loadSessionToken();
    return requestJson(AUTH_API_PATH, {
      method: "POST",
      body: JSON.stringify({
        action,
        payload,
      }),
      sessionToken,
    });
  }

  window.api = {
    AUTH_API_PATH,
    STATE_API_PATH,
    MUTATE_API_PATH,
    RECORDS_API_PATH,
    ANALYTICS_API_PATH,
    loadSessionToken,
    saveSessionToken,
    requestJson,
    requestAuth,
    clearResponseCache,
  };
})();
