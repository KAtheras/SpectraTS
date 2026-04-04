# Hosting Portability Audit (Netlify Lock-in)

## Executive Summary
- **Overall Netlify lock-in rating: Medium**
- The codebase is portable at the product-logic level, but has clear platform coupling in:
  - frontend endpoint paths (`/.netlify/functions/*`)
  - serverless handler shape (`exports.handler(event)`)
  - DB client package (`@netlify/neon`)
  - deploy routing/config (`netlify.toml`)
- Most lock-in is **localized** and can be migrated with adapters and config rewiring, not a full rewrite.

---

## 1) Frontend Endpoint Lock-in

### A. Central API path constants
- **File:** `api.js`
- **Lock-in point:** `AUTH_API_PATH`, `STATE_API_PATH`, `MUTATE_API_PATH` default to `/.netlify/functions/{auth|state|mutate}` outside localhost.
- **Callers:** global `window.api.requestJson/requestAuth` used across app.
- **Swap difficulty:** **Medium**
- **Why:** Centralized constants help portability, but current non-local default is Netlify-specific pathing.

### B. Hard-coded Netlify function path in password setup flow
- **File:** `app.js`
- **Functions/callers:** `validateSetupToken()` and submit handler in `/set-password` branch.
- **Lock-in point:** direct `fetch("/.netlify/functions/mutate", ...)` (bypasses `api.js` helper).
- **Swap difficulty:** **Medium**
- **Why:** Explicit endpoint string requires code change; not abstracted via `AUTH_API_PATH/MUTATE_API_PATH`.

### C. Settings metadata and state loading path assumptions
- **File:** `app.js`
- **Functions/callers:** `loadPersistentState()`, `loadSettingsMetadata()`, `mutatePersistentState()`.
- **Lock-in point:** relies on `STATE_API_PATH`, `MUTATE_API_PATH` semantics (`GET /state`, `POST /mutate` action envelope).
- **Swap difficulty:** **Low-Medium**
- **Why:** Path-level change is easy if API contract is preserved.

### D. Audit fetches through mutate endpoint contract
- **File:** `app.js`
- **Functions/callers:** `fetchAllAuditLogs()`, `loadAuditLogs()`.
- **Lock-in point:** action RPC (`{ action: "list_audit_logs", payload }`) to mutate endpoint.
- **Swap difficulty:** **Low-Medium**
- **Why:** Not Netlify-path hardcoded here, but depends on this action-RPC backend contract.

---

## 2) Backend Runtime Lock-in

### A. Netlify/AWS Lambda handler contract
- **Files:** `netlify/functions/auth.js`, `netlify/functions/state.js`, `netlify/functions/mutate.js`, `netlify/functions/send-email.js`
- **Netlify-specific pattern:**
  - `exports.handler = async function handler(event) { ... }`
  - `event.httpMethod`, `event.headers`, `event.body`, `event.queryStringParameters`
  - return shape `{ statusCode, headers, body, multiValueHeaders }`
- **What future host needs:** adapter layer to/from target runtime request/response (Express/Fastify, Cloudflare Workers, Vercel functions, etc.).
- **Swap difficulty:** **Medium**

### B. Response helper tied to Lambda response format
- **File:** `netlify/functions/_db.js`
- **Function:** `json(statusCode, body, extraHeaders)`
- **Netlify-specific detail:** uses `multiValueHeaders` for `Set-Cookie` support.
- **What future host needs:** equivalent response helper for target platform.
- **Swap difficulty:** **Medium**

### C. DB driver package coupling
- **File:** `netlify/functions/_db.js`
- **Function:** `getSql()` with `const { neon } = require("@netlify/neon");`
- **Netlify-specific detail:** package namespace is Netlify-specific.
- **What future host needs:** swap to `@neondatabase/serverless` or another Postgres client and adjust call sites (tagged-template usage preserved if compatible).
- **Swap difficulty:** **Medium-High** (depends on SQL client compatibility)

### D. Function directory/layout convention
- **Path:** `netlify/functions/*`
- **Lock-in point:** deployment auto-discovers this location on Netlify.
- **What future host needs:** new routing layer or server entrypoints.
- **Swap difficulty:** **Low-Medium**

---

## 3) Auth / Session Lock-in

## Auth/session flow (end-to-end)
- **Token creation:** `createSession()` in `_db.js` (DB-backed sessions table, random token, hashed in DB).
- **Token storage on client:** `api.js` (`timesheet-studio.session-token.v1` in localStorage + sessionStorage).
- **Token transport:** `api.js` adds both:
  - `X-Spectra-Session`
  - `Authorization: Bearer <token>`
- **Token read on backend:** `_db.js`
  - `getCustomSessionToken()`
  - `getBearerToken()`
  - `getSessionToken(event, request)`
- **Session resolution:** `_db.js` `getSessionContext()`.
- **Enforcement:** `_db.js` `requireAuth()`, used in state/mutate/send-email/auth actions.

## Netlify-specific assumptions in auth flow
- **Files:** `_db.js`, `auth.js`, `state.js`, `mutate.js`, `send-email.js`
- **Assumptions:** auth relies on `event.headers` and Lambda event format.
- **Portability risk:** **Medium**
- **Why:** auth model itself is portable (DB token sessions), but request extraction and response contract are runtime-specific.

## Direct function URL call in setup flow
- **File:** `app.js` (`/set-password` branch)
- **Issue:** direct `/.netlify/functions/mutate` call instead of helper abstraction.
- **Portability risk:** **Medium**

---

## 4) Storage / File Lock-in

### Current state
- No server-side object-storage integration found for uploaded files/receipts.
- Bulk upload in `settingsAdmin.js` is client-side file read/preview/import payload creation (CSV/XLSX parsing in browser), not storage-provider upload flow.

### Provider-specific code
- **None found** for S3/R2/GCS/blob storage APIs.

### Portability impact
- **Risk:** **Low (today)**
- If future receipt/file storage is added, a storage adapter should be introduced early to avoid new lock-in.

---

## 5) Env / Deploy Lock-in

### A. Netlify routing and SPA fallback
- **File:** `netlify.toml`
- **Lock-in points:**
  - `/api/*` rewrites to `/.netlify/functions/*`
  - SPA fallback to `/index.html`
  - header rules in Netlify format
- **Portability impact:** **Medium**
- **Migration need:** recreate equivalent rewrites/headers/fallback on target host.

### B. Additional fallback file
- **File:** `_redirects`
- **Lock-in point:** Netlify-style redirect syntax.
- **Portability impact:** **Low**
- **Migration need:** replace with host-native route fallback config.

### C. Environment variables
- **Files:** `send-email.js`, tests, scripts, package ecosystem
- **Vars observed:** `RESEND_API_KEY`, `EMAIL_FROM`, `NETLIFY_DATABASE_URL`, `NETLIFY_BUILD_ID`, `COMMIT_REF`, etc.
- **Portability impact:** **Low-Medium**
- **Migration need:** re-provision same secrets/vars under target host naming policy.

### D. Build assumptions
- **File:** `package.json`, `scripts/update-asset-version.js`
- **Lock-in point:** build script optionally consumes `NETLIFY_BUILD_ID` but has fallback.
- **Portability impact:** **Low**

---

## 6) Lock-in Point Classification (Low / Medium / High)

1. `api.js` default `/.netlify/functions/*` paths — **Medium**
2. `app.js` direct `fetch("/.netlify/functions/mutate")` in set-password flow — **Medium**
3. Lambda handler signatures (`exports.handler(event)`) in all functions — **Medium**
4. Lambda response shape (`statusCode/body/multiValueHeaders`) via `_db.js::json()` — **Medium**
5. `@netlify/neon` DB client dependency — **Medium-High**
6. `netlify.toml` rewrites/headers/fallback — **Medium**
7. `_redirects` Netlify syntax — **Low**
8. Function folder convention `netlify/functions/*` — **Low-Medium**
9. Script usage of `NETLIFY_BUILD_ID` — **Low**
10. Test/runtime expectation of `NETLIFY_DATABASE_URL` naming — **Low**

---

## 7) Top 10 Lock-in Points by Importance

1. **Backend runtime contract** (Lambda event/response) across all function handlers.  
2. **DB adapter package** `@netlify/neon` in `_db.js`.  
3. **Netlify rewrites** in `netlify.toml` (`/api/* -> /.netlify/functions/*`).  
4. **Frontend base API paths** in `api.js` (non-local defaults).  
5. **Hardcoded mutate path** in set-password flow (`app.js`).  
6. **Netlify response helper** with `multiValueHeaders` (`_db.js::json`).  
7. **Function directory convention** (`netlify/functions`).  
8. **Netlify `_redirects` fallback file**.  
9. **Env var naming coupling** (`NETLIFY_DATABASE_URL` in tests/scripts/docs).  
10. **Operational docs/deploy instructions** in `README.md` focused on Netlify flow.

---

## What to Change First If Migrating

1. Add/choose a server runtime adapter for existing function handlers (`auth/state/mutate/send-email`) while preserving action payload contracts.
2. Replace `@netlify/neon` with host-compatible Postgres client (or compatible Neon client) in `_db.js`.
3. Recreate `netlify.toml` rewrite semantics on new host (`/api/auth|state|mutate` + SPA fallback).
4. Remove hardcoded `/.netlify/functions/mutate` in `app.js` set-password flow; route through centralized API helper.
5. Keep API contract stable first; postpone deeper refactors until after parity is verified.

---

## What Is Already Portable / Safe

- Core business logic (permissions, mutations, validation, delegation, bulk upload workflow) is plain JS and mostly host-agnostic.
- Frontend state/mutation abstraction exists (`requestJson`, `requestAuth`, path constants) and can be repointed.
- Session model is DB-token-based, not tied to Netlify Identity/Cookies.
- No object-storage provider lock-in currently present in code.

---

## Rough Migration Difficulty by Area

- **Frontend:** **Low-Medium**  
  (mostly endpoint path + one hardcoded setup-flow call)
- **Backend endpoints:** **Medium**  
  (runtime adapter + response/request shape changes)
- **Auth/session:** **Medium**  
  (token model portable; transport parsing tied to Lambda event shape)
- **Storage:** **Low**  
  (no provider integration to migrate today)
- **Deploy/config:** **Medium**  
  (must recreate rewrites, SPA fallback, headers, env provisioning)

---

## File/Function Reference Index (quick lookup)

- Frontend endpoint constants: `api.js` (`AUTH_API_PATH`, `STATE_API_PATH`, `MUTATE_API_PATH`)  
- Hardcoded Netlify call: `app.js` (`validateSetupToken`, `complete_password_setup` submit path)  
- State/mutation loads: `app.js` (`loadPersistentState`, `loadSettingsMetadata`, `mutatePersistentState`)  
- Auth/session backend: `_db.js` (`createSession`, `getSessionToken`, `getSessionContext`, `requireAuth`)  
- Netlify handlers: `auth.js`, `state.js`, `mutate.js`, `send-email.js` (`exports.handler`)  
- Netlify DB package: `_db.js` (`@netlify/neon`, `getSql`)  
- Deploy config: `netlify.toml`, `_redirects`  
- Env/build scripts: `scripts/update-asset-version.js`, tests (`NETLIFY_DATABASE_URL` checks)

