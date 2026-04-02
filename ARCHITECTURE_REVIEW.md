# ARCHITECTURE Review

## Executive Summary
The repository is broadly aligned with the architectural direction in [`ARCHITECTURE.md`](/Users/kaprelozsolak/Timesheet/ARCHITECTURE.md): vanilla SPA, Netlify Functions, centralized state read/write patterns, strict bulk-upload templates, and explicit permission-based UI gating are all present.

The highest-risk gaps are scaling and boundary issues, not product-model issues:
- `loadState()` returns very large datasets for many workflows, and `mutate` recomputes full state after almost every mutation.
- Bulk upload import still executes one mutation per row.
- A public `send-email` function currently has no auth guard.
- `can_upload_data` is inconsistent in settings-shell visibility derivation.

Overall status: **Mostly compliant with important moderate/critical hotspots that should be fixed now for scale and security.**

## Top 5 Highest-Risk Issues
1. **Critical**: `mutate` always rebuilds full app state after most writes.
   - Files/functions: [`netlify/functions/mutate.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/mutate.js) `exports.handler` (tail section after switch), `loadState(...)` call.
   - Why risky: even small writes trigger heavy DB reads + large response payloads.
   - Fix: add action-level lightweight response mode (or explicit `returnState: false`) and only return full state when needed.
   - Fix timing: **Now**.

2. **Critical**: Unauthenticated email endpoint.
   - Files/functions: [`netlify/functions/send-email.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/send-email.js) `exports.handler`.
   - Why risky: endpoint can be invoked directly without session/permission checks.
   - Fix: require auth + allowlist callers/event types, or make email dispatch internal-only (no public function route).
   - Fix timing: **Now**.

3. **Moderate**: `loadState()` is unbounded for entries/expenses and does heavy delegation scope aggregation.
   - Files/functions: [`netlify/functions/_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js) `loadState`.
   - Why risky: payload/query cost grows with account size and impacts all screens.
   - Fix: paginate/lazy-load entries, expenses, and heavy assignment slices by active view/filter window.
   - Fix timing: **Now**.

4. **Moderate**: Bulk import is row-by-row mutation round-trips.
   - Files/functions: [`settingsAdmin.js`](/Users/kaprelozsolak/Timesheet/settingsAdmin.js) `importValidTimeRows`, `importValidExpenseRows`.
   - Why risky: high function-call volume, slow imports, expensive at scale.
   - Fix: add batch import mutation for time/expense rows with per-row result reporting.
   - Fix timing: **Now**.

5. **Moderate**: Settings shell visibility excludes `can_upload_data`.
   - Files/functions: [`netlify/functions/state.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/state.js) `permissions.view_settings_tab` derivation; same in [`netlify/functions/mutate.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/mutate.js) `buildPermissionsPayload`.
   - Why risky: user may have upload permission but no settings-shell access path.
   - Fix: include `permissions.can_upload_data` in `view_settings_tab` boolean.
   - Fix timing: **Now**.

## Top 5 Acceptable Debts
1. **Low**: `list_audit_logs` is routed through `mutate` instead of `state`.
   - Files/functions: [`netlify/functions/mutate.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/mutate.js) action `list_audit_logs`.
   - Acceptable because it is paginated and isolated.

2. **Low**: Direct `fetch` usage in set-password flow bypasses API helper.
   - Files/functions: [`app.js`](/Users/kaprelozsolak/Timesheet/app.js) set-password branch (`validate_setup_token`, `complete_password_setup`).
   - Acceptable short-term; unify later for consistency.

3. **Low**: Duplicate permission payload derivation in `state.js` and `mutate.js`.
   - Files/functions: `state.js` permissions object; `mutate.js` `buildPermissionsPayload`.
   - Acceptable until performance/security fixes are addressed.

4. **Low**: DB helper lookups still use `SELECT *` in some user finder helpers.
   - Files/functions: [`netlify/functions/_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js) `findUserByUsername`, `findUserById`, `findUserByDisplayName`.
   - Acceptable for now; optimize later.

5. **Low**: Large style-injection block in settings renderer.
   - Files/functions: [`settingsAdmin.js`](/Users/kaprelozsolak/Timesheet/settingsAdmin.js) `renderSettingsTabs` dynamic `<style id="settings-layout-style">`.
   - Acceptable as technical debt; not a runtime correctness risk.

---

## 1. System Overview
### Compliant patterns
- Vanilla JS SPA with centralized boot/render path in [`app.js`](/Users/kaprelozsolak/Timesheet/app.js).
- Netlify Functions backend in CommonJS (`exports.handler`) across `auth/state/mutate`.
- Postgres usage is structured entities (users, projects, entries, expenses, delegations, notifications) in [`netlify/functions/_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js).

### Deviations
- None material for this section.

### Severity
- **Low**

### Recommended fix
- No immediate fix required.

### Fix now or later
- **Later**

## 2. Core Architectural Principles

### 2.1 Thin backend orchestration
#### Compliant patterns
- Shared DB/business helpers centralized in [`_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js), reused by `state.js`, `auth.js`, `mutate.js`.
- Functions remain CommonJS.

#### Deviations
- Permission payload logic is duplicated between [`state.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/state.js) and [`mutate.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/mutate.js) (`buildPermissionsPayload`).

#### Severity
- **Moderate**

#### Recommended fixes
- Extract one shared permission-payload builder to `_db.js` or dedicated helper.

#### Fix now or later
- **Later** (after scaling/security blockers).

### 2.2 Centralized state flow
#### Compliant patterns
- Reads go through `loadPersistentState()` -> `GET /state` in [`app.js`](/Users/kaprelozsolak/Timesheet/app.js).
- Writes go through `mutatePersistentState()` -> `POST /mutate` in [`app.js`](/Users/kaprelozsolak/Timesheet/app.js).

#### Deviations
- Set-password flow performs direct `fetch("/.netlify/functions/mutate")` instead of `requestJson` helper.
  - Files/functions: [`app.js`](/Users/kaprelozsolak/Timesheet/app.js) early set-password branch.

#### Severity
- **Low**

#### Recommended fixes
- Route set-password requests through common request helper.

#### Fix now or later
- **Later**

### 2.3 Surgical evolution
#### Compliant patterns
- Most recent changes were localized to bulk upload/delegation/audit related files.

#### Deviations
- `settingsAdmin.js` has grown into a very large mixed-responsibility module (tabs, layout CSS injection, bulk parsing, delegations UI, permissions matrix).

#### Severity
- **Moderate**

#### Recommended fixes
- Gradual extraction by feature slice (bulk upload renderer/logic, delegations renderer/logic), no behavior change.

#### Fix now or later
- **Later**

## 3. Frontend Architecture

### 3.1 Single SPA, role-aware views
#### Compliant patterns
- Single SPA routing/render branches in [`app.js`](/Users/kaprelozsolak/Timesheet/app.js) with permission checks (`view_settings_tab`, `view_audit_logs`, etc.).
- Role/permission-aware settings tabs in [`settingsAdmin.js`](/Users/kaprelozsolak/Timesheet/settingsAdmin.js) `allowedTabs()`.

#### Deviations
- None material.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

### 3.2 Existing view model is authoritative
#### Compliant patterns
- Inputs/Entries/Settings/Inbox/Audit workflows remain inside established main views.
- Bulk upload is embedded under Settings tab, not a parallel app.

#### Deviations
- None material.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

## 4. Backend / Netlify Functions Architecture

### 4.1 Function responsibilities
#### Compliant patterns
- `auth`, `state`, `mutate` remain primary app endpoints.

#### Deviations
- `list_audit_logs` read operation lives in `mutate` instead of `state`.
- Additional function `send-email` is publicly routable and not using auth/session checks.

#### Severity
- `list_audit_logs` placement: **Low**
- `send-email` auth gap: **Critical**

#### Recommended fixes
- Keep `list_audit_logs` where it is short-term (it is paginated).
- Add auth + authorization to `send-email`, or internalize email dispatch.

#### Fix now or later
- `list_audit_logs`: **Later**
- `send-email`: **Now**

### 4.2 Write semantics
#### Compliant patterns
- Expense bulk import uses create action (`create_expense`) with row member mapping.
- Time bulk import uses new IDs and create semantics through `save_entry` upsert path.

#### Deviations
- `save_entry` is mixed create/update endpoint requiring `entry.id` always; create and update semantics are coupled.

#### Severity
- **Moderate**

#### Recommended fixes
- Split into explicit `create_entry` + `update_entry` at API boundary, keep shared internals.

#### Fix now or later
- **Later**

## 5. State Management Rules

### 5.1 Canonical state ownership
#### Compliant patterns
- Canonical state is server-loaded via `loadState`; client rehydrates via `applyLoadedState`.
- Bulk upload preview/import/rejects are local UI state and not persisted as canonical data.

#### Deviations
- `mutate` returns full state even when caller uses `skipHydrate`, creating unnecessary server-side state rebuild.

#### Severity
- **Critical**

#### Recommended fixes
- Add mutation response mode to skip full `loadState` on backend when caller explicitly does not need it.

#### Fix now or later
- **Now**

### 5.2 Preview/import shared validation
#### Compliant patterns
- One row object (`latestPreviewPayload.objects`) drives preview status/error, valid-row import filter, and rejects CSV.
  - Files/functions: [`settingsAdmin.js`](/Users/kaprelozsolak/Timesheet/settingsAdmin.js) `normalizeRows`, `importValidTimeRows`, `importValidExpenseRows`, `downloadRejectsCsv`.

#### Deviations
- None currently observed.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

## 6. Database Responsibilities

### 6.1 Structured operational data in Postgres
#### Compliant patterns
- Schema stores relational business entities, IDs, and metadata in [`_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js).

#### Deviations
- None observed.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

### 6.2 External IDs as lookup keys
#### Compliant patterns
- `users.employee_id` exists and is optional.
- Bulk upload resolves member to internal user ID (`_resolvedUserId`) before persistence.

#### Deviations
- Current bulk lookup primarily uses name/username matching; no strong external-ID-first path yet.

#### Severity
- **Low**

#### Recommended fixes
- Add optional lookup by `employee_id` before fallback name matching.

#### Fix now or later
- **Later**

## 7. File / Image Storage Responsibilities

### 7.1 Object storage only
#### Compliant patterns
- No blob/bytea file storage patterns found in DB schema.

#### Deviations
- No receipt/file upload pipeline implemented yet (section mostly future-facing).

#### Severity
- **Low**

#### Recommended fixes
- None until file features are implemented.

#### Fix now or later
- **Later**

### 7.2 Metadata model
#### Compliant patterns
- N/A (feature not yet implemented).

#### Deviations
- N/A.

#### Severity
- **Low**

#### Recommended fixes
- Define metadata table when receipt/file upload begins.

#### Fix now or later
- **Later**

## 8. Bulk Upload Architecture Rules

### 8.1 Strict template-based import
#### Compliant patterns
- Strict header order checks via `EXPECTED_HEADERS` + `isExactHeaderMatch`.
- Invalid template throws `INVALID_TEMPLATE`.

#### Deviations
- None observed.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

### 8.2 Valid rows import / invalid actionable
#### Compliant patterns
- Import filters by `row.status === "Valid"`.
- Rejected rows retain original values and `error`; downloadable via button (not auto-download).
- Post-import rejected-only state is retained.

#### Deviations
- None material.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

### 8.3 Shared row validation
#### Compliant patterns
- Member lookup, client/project existence, assignment checks, billable/date normalization all in `normalizeRows` and reused downstream.

#### Deviations
- Time and expense import functions still duplicate some orchestration code; shared validation is correct, orchestration is duplicated.

#### Severity
- **Low**

#### Recommended fixes
- Optional helper extraction for import orchestration.

#### Fix now or later
- **Later**

### 8.4 Operational/admin placement
#### Compliant patterns
- Bulk Upload tab is under Settings and gated by `can_upload_data` in UI.

#### Deviations
- Shell-level settings visibility omits `can_upload_data` in `view_settings_tab` derivation.

#### Severity
- **Moderate**

#### Recommended fixes
- Include `can_upload_data` in `view_settings_tab` derivation in both `state.js` and `mutate.js` permissions payload.

#### Fix now or later
- **Now**

## 9. Reporting Architecture Rules

### 9.1 Reporting should not degrade transactional workflows
#### Compliant patterns
- No heavy server-side reporting endpoints discovered.

#### Deviations
- Transactional flows still load large historical entries/expenses into main app state, which impacts all views including non-reporting screens.
  - File/function: [`_db.js`](/Users/kaprelozsolak/Timesheet/netlify/functions/_db.js) `loadState`.

#### Severity
- **Moderate**

#### Recommended fixes
- Limit state payload by view/date window; lazy-load large historical datasets.

#### Fix now or later
- **Now**

### 9.2 Heavy reports should be isolated
#### Compliant patterns
- No indication of full report-engine overreach yet.

#### Deviations
- No dedicated report precompute paths yet (acceptable at current maturity).

#### Severity
- **Low**

#### Recommended fixes
- Defer until analytics/reporting scale increases.

#### Fix now or later
- **Later**

## 10. Mobile Architecture Rules

### 10.1 One system, two presentations
#### Compliant patterns
- Mobile/desktop share same persistence/mutation functions.
- No separate backend semantics for mobile.

#### Deviations
- None material.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

### 10.2 Mobile scope discipline
#### Compliant patterns
- Mobile work is concentrated around Inputs presentation changes; admin-heavy settings stay desktop-style.

#### Deviations
- None material.

#### Severity
- **Low**

#### Recommended fixes
- None required.

#### Fix now or later
- **Later**

## 11. Permissions and Access Rules

### 11.1 Permissions explicit and aligned UI/backend
#### Compliant patterns
- Permission matrix and capabilities are explicit (`permissions.js`, `role_permissions`, `permission_capabilities`).
- UI tab gating uses permission flags in `settingsAdmin.js`.

#### Deviations
- `send-email` endpoint has no permission/auth enforcement.
- `can_upload_data` does not fully align with shell visibility (`view_settings_tab` omission).

#### Severity
- `send-email`: **Critical**
- `view_settings_tab` omission: **Moderate**

#### Recommended fixes
- Guard `send-email` by session + role/capability or remove public route.
- Include `can_upload_data` in shell permission derivation.

#### Fix now or later
- **Now**

### 11.2 Admin boundaries
#### Compliant patterns
- Bulk Upload tab hidden unless `can_upload_data`.
- Delegations tab hidden unless `can_delegate`.

#### Deviations
- None material beyond shell visibility issue already noted.

#### Severity
- **Low**

#### Recommended fixes
- Fold in the `view_settings_tab` fix above.

#### Fix now or later
- **Now**

## 12. Performance and Scaling Rules

### 12.1 Query discipline
#### Compliant patterns
- Audit logs are paginated (`limit/offset`) in `listAuditLogs`.

#### Deviations
- `loadState` performs broad historical loads for entries/expenses.
- Some helper queries still use `SELECT *` in hot codepaths for user lookups.

#### Severity
- **Moderate**

#### Recommended fixes
- Paginate/lazy-load entries/expenses.
- Replace `SELECT *` with explicit columns in frequently called helpers.

#### Fix now or later
- **Now** for pagination, **Later** for cleanup.

### 12.2 Connection and compute discipline
#### Compliant patterns
- Uses `@netlify/neon` (`neon()`) and short function handlers.

#### Deviations
- Row-by-row bulk imports + full-state response per mutation are expensive compute patterns.

#### Severity
- **Critical**

#### Recommended fixes
- Add batch import endpoint(s).
- Add lightweight mutate response mode without full `loadState`.

#### Fix now or later
- **Now**

### 12.3 Storage economics
#### Compliant patterns
- No evidence of DB file blobs.

#### Deviations
- None currently.

#### Severity
- **Low**

#### Recommended fixes
- None required now.

#### Fix now or later
- **Later**

## 13. Explicit Non-Goals / Anti-Patterns
### Compliant patterns
- No framework rewrite; still vanilla SPA.
- No separate mobile backend logic.
- Bulk upload uses strict templates and shared per-row validation.

### Deviations
- Potential hidden-state drift risk from heavy local UI maps (`delegationsDraftCapabilitiesByDelegateId`, bulk preview/session state) if not reconciled carefully after server changes.

### Severity
- **Low**

### Recommended fixes
- Keep local draft state scoped and reset on source-data changes.

### Fix now or later
- **Later**

## 14. Code Review Checklist (Current Snapshot)
### Compliant patterns
- Most changes remain surgical and feature-local.
- Permission checks exist in both UI and mutation handlers for major admin actions.
- Bulk upload now has strict headers + shared validation + rejects handling.

### Deviations
- Performance checklist items are currently the biggest misses (unbounded state loads, heavy mutate responses).

### Severity
- **Moderate**

### Recommended fixes
- Prioritize payload/query bounding and lightweight mutate responses.

### Fix now or later
- **Now**

## 15. Direction Summary Fit
### Compliant patterns
- The current implementation still matches the intended direction: centralized state/mutation, explicit permissions, strict uploads, shared business logic.

### Deviations
- Scale/security hardening (response shape discipline, endpoint auth hardening) is behind product feature velocity.

### Severity
- **Moderate**

### Recommended fixes
- Treat scaling/security fixes as architecture workstream, not ad hoc follow-ups.

### Fix now or later
- **Now**
