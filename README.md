# Timesheet Studio

Full-stack (Netlify Functions + Postgres) timesheet and expenses app, still embeddable in WordPress via `iframe`.

## Current capabilities

- Authentication backed by Netlify Functions; session token stored client-side.
- Time entries: add, edit, delete, billable toggle, approvals, filters, CSV export.
- Expenses: add, edit, delete, billable toggle, filters, CSV export.
- Catalog: clients/projects come from the database; no hardcoded tenant defaults. Admin-only can create clients; Admin/Exec can create projects.
- Administrative projects default to non-billable **only for new entries/expenses**; edits preserve saved billable state.
- Audit Log (admin-only): read-only table with Actor, Entity, Action, Date filters; inline with header; row expansion shows before/after.
- Mobile: bottom tab bar; opaque in light/dark modes; audit access via user dropdown (admins).
- Access control: permission groups (admin/executive/manager/staff) drive visibility and actions; members tab hidden for level 2 and below.

## Local preview

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deploy to Netlify

1. Push this folder to GitHub.
2. Create a new Netlify site from that repo.
3. Leave the publish directory as the project root.
4. Deploy.

This project already includes [netlify.toml](/Users/kaprelozsolak/Timesheet/netlify.toml).

## Embed in WordPress

Use an iframe block or HTML block with your deployed Netlify URL:

```html
<iframe
  id="timesheet-studio-frame"
  src="https://your-site.netlify.app/?embed=1"
  style="width:100%;min-height:900px;border:0;overflow:hidden;"
  loading="lazy"
></iframe>
<script>
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "timesheet-studio:resize") return;
    var frame = document.getElementById("timesheet-studio-frame");
    if (frame) frame.style.height = event.data.height + "px";
  });
</script>
```

## Notes & limitations

- Backend: Netlify Functions in `netlify/functions/` expect a Postgres-compatible `sql` client (see `_db.js`) and run without transactions (`sql.begin` not used). Ensure env vars match your DB.
- Audit Log is append-only; no UI to edit/delete entries.
- Filters currently fetch latest audit rows and also filter client-side; keep datasets modest or add pagination if needed.
- Light/dark themes supported; dropdown ordering: Settings, Audit Log (admins), Dark/Light, Change Password, Log out.

## Current team and catalog setup

- Users, clients, and projects are tenant-specific and should come from your database or initial configuration.
- No client/project catalog is hardcoded by default; seed data should be supplied per tenant or left empty.
- New clients/projects added in the UI are stored via the configured backend APIs.
