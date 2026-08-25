# Timesheet Studio

Full-stack timesheet and expenses app built with Netlify Functions and Postgres.

## Current capabilities

- Authentication backed by Netlify Functions; session token stored client-side.
- Time entries: add, edit, delete, billable toggle, approvals, filters, CSV export.
- Expenses: add, edit, delete, billable toggle, filters, CSV export.
- Catalog: clients/projects come from the database; no hardcoded tenant defaults. Admin-only can create clients; Admin/Exec can create projects.
- Administrative projects default to non-billable **only for new entries/expenses**; edits preserve saved billable state.
- Audit Log (admin-only): read-only table with Actor, Entity, Action, Date filters; inline with header; row expansion shows before/after.
- Mobile: bottom tab bar; opaque in light/dark modes; audit access via user dropdown (admins).
- Access control: permission groups (admin/executive/manager/staff) drive visibility and actions; members tab hidden for level 2 and below.
- Clients page visibility uses backend snapshot IDs (`visibleClientIds`, `visibleProjectIds`) as source of truth for rendered client/project lists.
- Organization settings: practice departments, office locations, and office-by-department target realization matrix are DB-backed.
- Access matrix now includes clients-tab visibility and data-upload-tab visibility controls.
- Project edit flow includes practice department, office location, target realization, and Tech/Admin fee override fields.
- Departments include configurable Tech/Admin fee % defaults.
- Project Planning economics includes Tech/Admin fee revenue; cost-rate column is hidden in Team Budgeting UI while cost math remains active.

## Local preview

Apply pending database migrations before starting the full Netlify-backed app:

```bash
npm run db:migrate
npm run dev:netlify
```

The lightweight static-only preview remains available with:

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deploy to Netlify

1. Push this folder to GitHub.
2. Create a new Netlify site from that repo.
3. Configure the required environment variables.
4. Run `npm run db:migrate` against the target database before deploying application code.
5. Leave the publish directory as the project root and deploy.

This project already includes [netlify.toml](/Users/kaprelozsolak/Timesheet/netlify.toml).

## Tests

```bash
npm test
```

This runs repository-wide JavaScript syntax checks and the database-independent permission suite. Database mutation tests are intentionally separate because they create and remove records in a dedicated test account:

```bash
TEST_ACCOUNT_ID=<dedicated-test-account-uuid> npm run test:integration
```

The integration suite refuses to run against known protected accounts. CI runs `npm test` on every pull request and push to `main`.

## Notes & limitations

- Backend: Netlify Functions in `netlify/functions/` expect a Postgres-compatible `sql` client (see `_db.js`). Schema changes are applied explicitly with `npm run db:migrate`, never from request handlers.
- Audit Log is append-only; no UI to edit/delete entries.
- Filters currently fetch latest audit rows and also filter client-side; keep datasets modest or add pagination if needed.
- Light/dark themes supported; dropdown ordering: Settings, Audit Log (admins), Dark/Light, Change Password, Log out.
- Netlify applies CSP, transport, MIME-sniffing, referrer, and browser-feature headers. The CSP blocks all iframe embedding to reduce clickjacking risk.

## Current team and catalog setup

- Users, clients, and projects are tenant-specific and should come from your database or initial configuration.
- No client/project catalog is hardcoded by default; seed data should be supplied per tenant or left empty.
- New clients/projects added in the UI are stored via the configured backend APIs.

## Session handoff

- Latest handoff notes: [`SESSION_HANDOFF.md`](/Users/kaprelozsolak/Timesheet/SESSION_HANDOFF.md)
