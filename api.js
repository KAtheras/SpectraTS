(function () {
  const isLocalHost =
    window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

  const AUTH_API_PATH = isLocalHost ? "/api/auth" : "/.netlify/functions/auth";
  const STATE_API_PATH = isLocalHost ? "/api/state" : "/.netlify/functions/state";
  const MUTATE_API_PATH = isLocalHost ? "/api/mutate" : "/.netlify/functions/mutate";

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
      return;
    }
  }

  async function requestJson(url, options) {
    const settings = options || {};
    const sessionToken = settings.sessionToken || loadSessionToken();
    const targetUrl = new URL(url, window.location.origin);

    const response = await fetch(targetUrl.toString(), {
      method: settings.method || "GET",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(sessionToken ? { "X-Spectra-Session": sessionToken } : {}),
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
    loadSessionToken,
    saveSessionToken,
    requestJson,
    requestAuth,
  };
})();
