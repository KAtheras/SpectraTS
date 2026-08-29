# Weekly time and expense approval workflow

## Purpose

Weekly submission is the operational control for time and expense records. A member submits one week once; the system routes the relevant records to the people accountable for the work without making a department lead review every project entry.

## Routing

- Project time and expenses go to the Project Lead.
- If the member is the Project Lead, the package goes to the Project Executive so no one approves their own records.
- Non-project, internal, and PTO records go to the member's Department Lead.
- If the member is that Department Lead, or no Department Lead is assigned, routing falls back to the Office Lead.
- Project Executives can review project packages as an override.
- Superusers can intervene globally, but they are not routine reviewers.

Every submission is split into independent approval packages. An approved package remains locked if a different reviewer requests changes to another package.

## Status model

`Open` → `Submitted` → `Partially approved` / `Changes requested` → `Locked`

- Open: the member can edit the week's records.
- Submitted: all packages are awaiting review.
- Partially approved: at least one package is approved and at least one is pending.
- Changes requested: only the affected package is editable and may be resubmitted.
- Locked: every package is approved; the week's records cannot be edited through ordinary entry workflows.

Moving a change-requested record into a different project package is prohibited because that would bypass the reviewer who already approved the destination package.

## Reviewer experience

The Entries view contains the review queue. Each package shows the member, week, project or non-project scope, record counts, total time, total expenses, and expandable record detail. A reviewer can approve or request changes; a change request requires an explanation and notifies the member.

## Team oversight

Department and Office Leads receive an exception-oriented Team Time Overview for their assigned scope. It summarizes complete, pending, missing, and change-requested weeks and identifies the members requiring attention. It is not a second approval layer.

## Audit and notifications

Submission and review decisions are written to the audit log. Submission notifies each assigned reviewer. Approval and change requests notify the submitting member and include a link back to the relevant app view.

## Future extension

An exceptional reopen operation should require elevated authority, a reason, audit history, and notifications to the member and affected reviewers. Billing/export integration can consume locked packages without changing the routing model.
