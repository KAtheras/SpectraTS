# Future Technical To-Dos

These items are intentionally deferred while product work continues.

## Priority: data-loading and analytics scalability

The ACME synthetic-data exercise exposed an architectural growth limit: account startup currently hydrates an unbounded set of visible time and expense records. Removing the duplicate utilization payload reduced immediate pressure, but customers with hundreds of employees and several years of history will eventually exceed practical database-query, response-size, browser-memory, and rendering limits.

- Keep account bootstrap limited to identity, permissions, settings, and lightweight reference data.
- Move time and expense history to date-bounded, cursor-paginated endpoints.
- Compute analytics on the server with permission-aware aggregate SQL; return KPI, trend, and grouped chart data instead of raw entries.
- Fetch underlying records only for explicit drilldowns and exports.
- Add composite indexes supporting account/date/user/project filters and verify query plans using production-scale fixtures.
- Add payload-size, query-duration, row-count, and browser-performance budgets to automated tests and monitoring.
- Consider cached daily/monthly fact tables or materialized summaries once direct aggregate queries approach those budgets.
- Validate the design with a repeatable large-tenant dataset representing hundreds of employees and multiple years before onboarding a customer of that scale.

## Before the next high-risk release

- Run a focused production smoke test:
  - login and saved-session restoration
  - create, edit, delete, approve, and unapprove time entries
  - create, edit, delete, approve, and unapprove expenses
  - password setup/reset flow
  - permissions across staff, manager, executive, admin, and superuser roles
  - analytics charts, theme switching, and browser-console CSP errors
- Create a dedicated disposable database account and run:

  ```bash
  TEST_ACCOUNT_ID=<dedicated-test-account-uuid> npm run test:integration
  ```

- Never run the integration suite against a production customer account.

## Reliability and observability

- Add frontend error reporting and Netlify Function exception monitoring.
- Add alerts for elevated `/state`, `/auth`, and `/mutate` error rates.
- Add a lightweight post-deploy health check for authentication and state loading.

## Maintainability

- Continue reducing `app.js` one cohesive feature at a time:
  1. Inbox controller and event bindings.
  2. Audit-log filters and download controls.
  3. Shared time/expense filter orchestration.
- Continue splitting `mutate.js` and `_db.js` by domain after frontend boundaries stabilize.
- Add database integration coverage for atomic entry/expense writes and audit records.

## Advanced features

- Add in-app sharing for Analytics chart tables:
  - place a Share action on each applicable Analytics card
  - let the sender select a member, add an optional message, and preview the table
  - generate the shared table server-side from the active report filters
  - identify the authenticated sender in the inbox message
  - warn when the recipient lacks normal access to the shared Analytics scope, with Cancel and Share Anyway choices
  - record the sender, recipient, report scope, filters, timestamp, and access-warning override in the audit log
  - send a fixed snapshot rather than a live table whose contents could change later

## Security

- Perform an end-to-end access and visibility audit across every configured member level and permission role, covering:
  - member time entries and approval actions
  - member expenses and approval actions
  - project details, planning, rates, budgets, and team assignments
  - client and member profile details, including sensitive rate fields
  - own-record, own-office, assigned-project, and company-wide scopes
  - delegated access and cross-office access
  - archived, inactive, and terminated records
- Verify that UI visibility, selectable options, API responses, mutations, exports, analytics, and direct endpoint access enforce the same rules.
- Build a role-by-resource test matrix and add server-side authorization regression tests for every allowed and denied combination.
- Evaluate moving session authentication from browser storage to Secure, HttpOnly, SameSite cookies.
- Include CSRF protection and session rotation in that design.
- Review CSP after any new third-party frontend dependency is introduced.
