"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const includedRoots = [root, path.join(root, "netlify", "functions"), path.join(root, "scripts"), path.join(root, "tests"), path.join(root, "migrations")];
const files = [];

for (const directory of includedRoots) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(directory, entry.name));
    }
  }
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}

if (!process.exitCode) {
  process.stdout.write(`Syntax check passed for ${files.length} JavaScript files.\n`);
}
