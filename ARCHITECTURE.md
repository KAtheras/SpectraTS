# Timesheet App Architecture

## 1) System Overview

This project is a single-page web app with a Netlify Functions backend and Neon/Postgres database.

- Frontend: static files (`index.html`, `app.js`, module JS files, `styles.css`)
- API layer (frontend): `api.js`
- Backend (Netlify Functions): `netlify/functions/*.js`
- Persistence: Postgres via `@netlify/neon`

Primary domains:
- Time entries
- Expenses
- Clients / Projects
- Member management
- Settings + permissions matrix

---

## 2) Runtime Topology

### Frontend
- `index.html` loads the app shell and section containers.
- `app.js` is the orchestration layer:
  - auth/bootstrap flow
  - state hydration
  - event wiring
  - route/view switching
  - modal wiring (including member modal and set-password route view)

Feature modules used by `app.js`:
- `timeEntries.js` (time table/filter/render behavior)
- `expenses.js` (expense table/filter/render behavior)
- `entryForm.js` (entry form + filter catalogs)
- `catalog.js` / `catalogEditor.js` (clients/projects UI + forms)
- `settingsAdmin.js` (settings tabs rendering and behavior)
- `accessControl.js` (frontend access helpers)
- `usersModal.js`, `membersModal.js`, `auditLog.js`, `bulkEntry.js`, `datePicker.js`, `utils.js`

### Backend
Netlify Functions:
- `auth.js`: login/bootstrap/session auth endpoints
- `state.js`: canonical full-state payload for authenticated app
- `mutate.js`: all state-changing actions (CRUD + settings updates)
- `_db.js`: schema management + data access/business helpers
- `permissions.js`: DB-backed capability evaluation
- `send-email.js`: Resend email function (setup/reset links)

---

## 3) State Model and Data Flow

## Initial load / reload
1. Frontend calls `/.netlify/functions/state`
2. `state.js`:
   - validates session
   - loads full state from `_db.loadState(...)`
   - computes frontend `permissions` keys from DB capabilities
3. Frontend `applyLoadedState(...)` normalizes and stores:
   - `currentUser`, `users`, `clients`, `projects`, `entries`, `expenses`
   - settings-related data (`levelLabels`, `departments`, `officeLocations`, etc.)
   - `permissions`, `settingsAccess`, assignments, account metadata

## Mutation flow
1. Frontend calls `/.netlify/functions/mutate` with `{ action, payload }`
2. `mutate.js` authorizes via DB capability checks
3. On success, frontend either:
   - hydrates from mutation result (`mutatePersistentState`)
   - or does targeted refresh paths (e.g., `refreshSettingsTab(...)`)

---

## 4) Authentication and Authorization

Authentication:
- Session token from login/bootstrap is persisted client-side.
- Backend validates token in `getSessionContext(...)` (`_db.js`).

Authorization:
- Canonical permissions are capability-based and DB-driven.
- Core check is `permissions.can(user, capability, ctx, permissionIndex)`.
- `state.js` maps DB capabilities to frontend booleans (e.g. `view_settings_tab`, `edit_user_rates`, etc.).

Important:
- Frontend visibility/editability should follow `state.permissions`.
- Backend enforces final authorization in `mutate.js`.

---

## 5) Database Layer (`_db.js`)

`_db.js` responsibilities:
- Idempotent schema setup (`ensureSchema`)
- Query helpers for users, clients, projects, assignments, settings entities
- Full-state aggregation (`loadState`)
- Security helpers:
  - password hash/verify
  - session token hash
  - password setup token generation (`password_setup_tokens`)

Key entities (high level):
- `users`, `sessions`
- `clients`, `projects`, assignment tables
- `entries`, `expenses`
- `level_labels`, `office_locations`, `expense_categories`, `departments`
- permission tables:
  - `permission_roles`
  - `permission_capabilities`
  - `permission_scopes`
  - `role_permissions`
- `password_setup_tokens` for setup/reset links

---

## 6) Settings Architecture

Settings UI is rendered by `settingsAdmin.js` and orchestrated from `app.js`.

Main settings sections:
- Member levels
- Expense categories
- Office locations
- Member information
- Practice departments
- Member access levels

Each section is intended to be:
- visible by capability
- editable by capability
- persisted through specific mutate actions

---

## 7) Password Setup / Reset Link Flow

Current flow:
1. Add member (`add_user`) creates user and setup token.
2. Email sent via `send-email.js` (Resend).
3. Link format: `/set-password?token=...`.
4. `app.js` detects `/set-password` route and renders standalone form.
5. Form submits `complete_password_setup` to `mutate.js`.
6. Backend validates token (exists, unused, unexpired), updates password hash, marks token used.

---

## 8) Local Dev / Deployment Notes

- Netlify SPA route fallback is configured via `_redirects`.
- Functions live under `netlify/functions`.
- `send-email.js` uses CommonJS style for Netlify runtime compatibility.
- `resend` is installed as a production dependency.

---

## 9) Testing

Current test files:
- `tests/permissions.test.js`
- `tests/mutations.test.js`

Utility scripts in `scripts/` support seeding, diagnosis, and normalization tasks.

---

## 10) 5-Minute Onboarding

### Prerequisites
- Node.js (current LTS recommended)
- Access to the project database
- Netlify function runtime compatibility (local via `npm run dev`)

### Install and run
1. Install deps:
   - `npm install`
2. Start app:
   - `npm run dev`
3. Open the local URL printed by `server.js` (typically `http://localhost:3000`).

### Required environment variables
Set these before running in environments that need backend/database/email behavior:
- `NETLIFY_DATABASE_URL` (Postgres/Neon connection)
- `RESEND_API_KEY` (email sending)
- `EMAIL_FROM` (verified sender domain/address for Resend)

### First places to look when debugging
- Auth/session/bootstrap:
  - `netlify/functions/auth.js`
  - `netlify/functions/state.js`
  - `app.js` (`loadPersistentState`, `applyLoadedState`)
- Mutations and persistence:
  - `netlify/functions/mutate.js`
  - `netlify/functions/_db.js`
- Settings UI behavior:
  - `settingsAdmin.js`
  - `app.js` settings event wiring
- Capability checks:
  - `netlify/functions/permissions.js`
  - `netlify/functions/state.js` permission key mapping
- Password setup/reset link flow:
  - `netlify/functions/mutate.js` (`add_user`, `send_user_setup_link`, `complete_password_setup`)
  - `netlify/functions/send-email.js`
  - `app.js` `/set-password` route branch

### Common gotchas
- Mutation responses may not include the full state envelope used by `state.js`; avoid overwriting `state.permissions` with partial mutation payloads.
- Settings stability issues often come from hydrating with partial data after mutate instead of refreshing from full state.
- Keep `send-email.js` in CommonJS format for Netlify function runtime compatibility.
- Client-side routes (like `/set-password`) require `_redirects` SPA fallback in deployment.
