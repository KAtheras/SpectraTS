(function () {
  const THEME_STORAGE_KEY = "timesheet-studio.theme.v1";
  const THEME_EXPLICIT_STORAGE_KEY = "timesheet-studio.theme.explicit.v1";

  function create(options) {
    const body = options.body;
    const toggle = options.toggle || null;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function loadThemePreference() {
      try {
        const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
        const explicit = window.localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY) === "1";
        return explicit && (raw === "light" || raw === "dark") ? raw : null;
      } catch (error) {
        return null;
      }
    }

    function saveThemePreference(theme) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        window.localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, "1");
      } catch (error) {
        return;
      }
    }

    function clearThemePreference() {
      try {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        window.localStorage.removeItem(THEME_EXPLICIT_STORAGE_KEY);
      } catch (error) {
        return;
      }
    }

    function resolveTheme() {
      return loadThemePreference() || (media.matches ? "dark" : "light");
    }

    function applyTheme(theme) {
      body.dataset.theme = theme;
      body.style.colorScheme = theme;
      if (!toggle) return;
      toggle.textContent = "Dark/Light";
      toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      toggle.setAttribute("aria-label", theme === "dark" ? "Light mode" : "Dark mode");
    }

    return {
      media,
      loadThemePreference,
      saveThemePreference,
      clearThemePreference,
      resolveTheme,
      applyTheme,
    };
  }

  window.themePreferences = { create };
})();
