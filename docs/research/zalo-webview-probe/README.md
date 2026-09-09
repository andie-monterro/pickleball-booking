# Zalo webview probe (AND-95)

A throwaway static page that reports what a webview allows. It exists to settle the
seven facts about Zalo's in-app browser that [AND-95] could not settle from documentation.

- `index.html` — the probe. Six numbered sections matching the ticket's checklist.
- `sw.js` — a service worker that does nothing. Whether it *registers* is the finding.
- `manifest.json`, `icon-*.png` — present so that "is there an Add to Home Screen option?"
  is a real answer and not a false negative caused by a missing manifest.

Deployed as its own Vercel project, separate from the app, so no Deployment Protection
login stands between a Zalo tap and the page.

**Live at <https://zalo-webview-probe.vercel.app>** — verified 200 with no redirect to a login.
Use that host, not the team-scoped `*-andies-projects-*.vercel.app` alias, which is behind
Vercel Authentication and would show a login page inside Zalo.

Throw this directory away once AND-95 is closed.
