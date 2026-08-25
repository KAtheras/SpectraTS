"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const values = new Map();
const media = { matches: true };
const window = {
  localStorage: {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  },
  matchMedia() {
    return media;
  },
};

const source = fs.readFileSync(path.join(__dirname, "..", "themePreferences.js"), "utf8");
vm.runInNewContext(source, { window });

const attributes = new Map();
const body = { dataset: {}, style: {} };
const toggle = {
  textContent: "",
  setAttribute(name, value) {
    attributes.set(name, value);
  },
};
const theme = window.themePreferences.create({ body, toggle });

assert.strictEqual(theme.resolveTheme(), "dark");
theme.saveThemePreference("light");
assert.strictEqual(theme.loadThemePreference(), "light");
assert.strictEqual(theme.resolveTheme(), "light");

theme.applyTheme("light");
assert.strictEqual(body.dataset.theme, "light");
assert.strictEqual(body.style.colorScheme, "light");
assert.strictEqual(attributes.get("aria-pressed"), "false");
assert.strictEqual(attributes.get("aria-label"), "Dark mode");

theme.clearThemePreference();
assert.strictEqual(theme.loadThemePreference(), null);
assert.strictEqual(theme.resolveTheme(), "dark");

console.log("✔ theme preferences persist, clear, resolve, and apply");
