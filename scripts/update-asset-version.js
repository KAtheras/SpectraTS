const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function sanitize(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24);
}

function gitShortHash() {
  try {
    return sanitize(execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString());
  } catch {
    return "";
  }
}

function buildVersionToken() {
  const deployId = sanitize(process.env.DEPLOY_ID || process.env.NETLIFY_BUILD_ID || "");
  if (deployId) return deployId;

  const commitRef = sanitize(process.env.COMMIT_REF || gitShortHash());
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  if (commitRef) return `${commitRef}-${timestamp}`;

  return `local-${timestamp}`;
}

const indexPath = path.resolve(__dirname, "..", "index.html");
const version = buildVersionToken();
const html = fs.readFileSync(indexPath, "utf8");

const next = html
  .replace(/(href=\"\.\/styles\.css)(\?v=[^\"]*)?(\")/g, `$1?v=${version}$3`)
  .replace(/(src=\"\.\/app\.js)(\?v=[^\"]*)?(\"\s+defer>)/g, `$1?v=${version}$3`);

if (next !== html) {
  fs.writeFileSync(indexPath, next, "utf8");
  console.log(`Updated asset version to ${version}`);
} else {
  console.log("No asset references updated.");
}
