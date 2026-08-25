# Future Technical To-Dos

These items are intentionally deferred while product work continues.

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

## Security

- Evaluate moving session authentication from browser storage to Secure, HttpOnly, SameSite cookies.
- Include CSRF protection and session rotation in that design.
- Review CSP after any new third-party frontend dependency is introduced.
