# Timesheet Studio

Standalone timesheet web app for Netlify, designed to be embedded in WordPress with an `iframe`.

## What this version does

- Runs as a plain static site
- Stores entries in `localStorage` so you can test the full UI immediately
- Supports add, edit, delete, filter, search, client breakdown, and CSV export
- Includes two fixed users and a client-project catalog in [app.js](/Users/kaprelozsolak/Timesheet/app.js)
- Detects iframe embedding and posts its height to the parent page
- Lets you add clients and projects locally from the sidebar catalog panel

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

## Important limitation

This first version stores data in the browser, so it is best for a single-user MVP or visual prototype. If you want real multi-user accounts and shared data, the next step is to add a backend such as Supabase, Firebase, or Netlify Functions plus a database.

## Current team and catalog setup

- Users are currently `George Bertzios` and `Kaprel Ozsolak`
- The current client catalog is `ISTO` with projects `Bright Start`, `Bright Directions`, `ABLE`, and `Secure Choice`
- The seed catalog is configured in `DEFAULT_CLIENT_PROJECTS` in [app.js](/Users/kaprelozsolak/Timesheet/app.js)
- New clients and projects added in the UI are stored in browser `localStorage`
