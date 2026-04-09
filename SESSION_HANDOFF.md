# Session Handoff (2026-04-06)

## Completed this session

- Inputs Time row save switched to optimistic UI save (no long `Saving...` hold while waiting for DB).
- Inputs Expense row save switched to optimistic UI save with rollback on failure.
- Inputs drilldown now includes Internal/Corporate rows (time + expenses) by deriving a project label from corporate function category when needed.
- Inputs drilldown refresh after local save/rollback no longer waits for delayed background reload.
- Departments settings save fixed for new departments:
  - temp rows are reconciled to DB IDs after `create_department`
  - `state.departments` and `state.departmentsSnapshot` are rebuilt from saved form rows
  - new department creation now persists reliably.

## Commits pushed

- `acaf7ad` - `fix: speed inputs saves and include corporate drilldown rows`
- `ab3575f` - `fix: persist newly created departments in settings save`

## Known follow-up items

- Some non-Inputs mutation paths are still synchronous (`await`-blocking) and may feel slower than Inputs row saves:
  - Entries tab row actions (toggle billable/status/delete)
  - some legacy member/settings actions.
- If UX latency work continues, optimize action-by-action (not global) and verify rollback behavior per action.

## Suggested first checks next session

1. Verify Inputs Time and Expense save latency in both local and Netlify environments.
2. Verify Internal/Corporate entries/expenses appear immediately in drilldown after save.
3. Verify Departments tab:
   - create new department -> save -> reload -> still present
   - rename existing department -> save -> reload -> persists
   - delete department -> save -> reload -> persists.

---

# Session Handoff (2026-04-07)

## Completed this session

- Added/extended org planning metadata across stack:
  - practice departments and office locations wired through project edit flow
  - project-level fields wired: `project_department_id`, `office_id`, `target_realization_pct`
  - target realizations matrix support (office x department) with save path.
- Project Edit modal updates:
  - added Practice Department and Office Location selectors
  - added Target Realization % input
  - defaulting behavior from target realization matrix by office+department, with manual overwrite allowed.
- Project Planning updates:
  - Realization KPI card now includes target + variance display.
  - Expenses table/input interaction and alignment refinements.
- Settings reliability fixes:
  - `loadState` now includes departments + office locations + target realizations so organization tabs do not intermittently render blank on first load.
- Schema/bootstrap hotfix:
  - fixed a Postgres startup 500 caused by a unique-constraint/index-name collision in `department_office_target_realizations`.

## Commits pushed

- `84844b4` - `fix: always include settings org metadata in state payload`
- `51e2183` - `fix: avoid target realization unique index name collision`
- `2f2ea3c` - `feat: checkpoint latest settings, project modal, and planning UI updates`

## Known follow-up items

- Validate Netlify deploy is building from `origin/main` commit `2f2ea3c` and that functions cold-started on the latest schema path.
- Re-verify these flows in deployed environment:
  - Settings tabs: Practice departments / Target realizations / Office locations populate immediately.
  - Project Edit modal: department/office dropdowns populate correctly; target default recalculates when office/department changes.
  - Project and client cards display office only once (no duplicate office line regression).
- Continue latency pass on remaining legacy save paths where synchronous waits are still noticeable.

## Suggested first checks next session

1. Open Settings -> Organization tabs and confirm all three render populated content without manual refresh.
2. Edit a project and confirm:
   - department and office save
   - target default resolves from matrix
   - manual target override persists.
3. Open Project Planning and verify target/variance KPI values and styling remain consistent.
4. Run a quick production smoke test for `/state` and `/mutate` after deploy to confirm no schema-time 500s.

---

# Session Handoff (2026-04-07 - Visibility Snapshot Rollout)

## Completed this session

- Clients-page visibility now uses backend snapshot IDs as canonical source:
  - `visibleClientIds`
  - `visibleProjectIds`
- Backend visibility snapshot path implemented and wired through state payload:
  - policy-based visibility resolver in `_db.js`
  - `state.js` passthrough for snapshot arrays.
- Frontend Clients-page filtering updated to consume snapshot IDs for rendered clients/projects.
- Removed temporary visibility debug instrumentation previously added to backend/frontend.
- Removed stale Clients-page visibility artifacts:
  - old call signatures passing `state.currentUser` into catalog visibility helpers
  - unused catalog artifacts (including unused project budget map in `catalog.js`).

## Commits pushed

- `9e41c7a` - `fix: improve clients access rules and member flow UX`
- `e32ca76` - `refactor: use backend visibility snapshot for clients page`

## Known follow-up items

- Manual role smoke-test still required in live UI sessions:
  - assigned manager (Jean) should see only assigned client/project
  - admin/executive should see all
  - unassigned user should see none.
- Confirm refresh stability (no first-load/refresh visibility drift).
- If any mismatch remains, inspect assignment rows returned by backend for that user before touching frontend again.

## Suggested first checks next session

1. Log in as Jean and verify only assigned client/project appear on Clients page.
2. Refresh while on Clients page and verify same result (no disappear-all behavior).
3. Log in as admin/executive and confirm full catalog visibility.
4. Log in as unassigned staff and confirm no visible clients/projects.
5. If any case fails, capture `/state` payload `visibleClientIds` and `visibleProjectIds` for that user/session and compare to DB assignment rows.
