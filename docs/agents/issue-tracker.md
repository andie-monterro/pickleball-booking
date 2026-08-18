# Issue tracker: Linear

Issues and specs for this repo live in Linear. Use the `linear-monterro` MCP tools for all operations.

- **Project**: "Pickleball Booking" — id `32547f9b-790e-473a-af67-8eab300f62fa`
  https://linear.app/andie-monterro/project/pickleball-booking-3164eaed052c
- **Team**: Andie-monterro — key `AND`, id `528b9322-c651-47c1-8493-bcc812e6a710`
- **PO feature request doc**: https://linear.app/andie-monterro/document/feature-request-court-booking-v1-b854e5935a6b

## Conventions

- **Create an issue**: `save_issue` with the team and project above.
- **Read an issue**: `get_issue` by identifier (e.g. `AND-42`); fetch discussion with `list_comments`.
- **List issues**: `list_issues` scoped to the project, filtered by label/state as needed.
- **Comment**: `save_comment`.
- **Apply / remove labels**: set labels via `save_issue`; create missing labels with `create_issue_label` (team-scoped).
- **Close**: `save_issue` setting state to Done (or Canceled for wontfix).

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if external GitHub PRs should enter the triage queue.)_

## When a skill says "publish to the issue tracker"

Create a Linear issue in the project above.

## When a skill says "fetch the relevant ticket"

`get_issue` by `AND-<n>` identifier, plus `list_comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map (set `parentId` via `save_issue`). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, assign to the driving dev.
- **Blocking**: Linear's native "blocked by" relations. Fall back to a `Blocked by: AND-<n>` line at the top of the body if a relation can't be set. Unblocked when every blocker is Done/Canceled.
- **Frontier query**: open children of the map with no open blocker and no assignee; first in map order wins.
- **Claim**: assign the issue to yourself (`save_issue` assignee "me") — the session's first write.
- **Resolve**: comment the answer, set state Done, append a context pointer to the map's Decisions-so-far.
