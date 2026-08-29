"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mutateSource = fs.readFileSync(path.join(root, "netlify/functions/mutate.js"), "utf8");
const plannerSource = fs.readFileSync(path.join(root, "projectPlanning.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const membersModalSource = fs.readFileSync(path.join(root, "membersModal.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const stateSource = fs.readFileSync(path.join(root, "netlify/functions/state.js"), "utf8");

function functionBody(source, name, nextMarker) {
  const start = source.indexOf(`async function ${name}`);
  assert.notStrictEqual(start, -1, `${name} must exist`);
  const end = nextMarker ? source.indexOf(nextMarker, start + 1) : source.length;
  assert.notStrictEqual(end, -1, `${nextMarker} must follow ${name}`);
  return source.slice(start, end);
}

const planTransition = functionBody(mutateSource, "transitionProjectPlan", "const SUPERUSER_MATRIX_EDITABLE_CAPABILITIES");
assert.match(planTransition, /actorId !== leadId/);
assert.match(planTransition, /planning_status = 'submitted'/);
assert.match(planTransition, /recipientUserIds: \[executiveId\]/);
assert.match(planTransition, /actorId !== executiveId/);
assert.match(planTransition, /planning_status = \$\{nextStatus\}/);
assert.match(planTransition, /recipientUserIds: \[leadId\]/);

const planEdit = functionBody(mutateSource, "recordProjectPlanEdit", "async function transitionProjectPlan");
assert.match(planEdit, /statusBefore === "approved" && !isExecutive && !isSuperuser/);
assert.match(planEdit, /const statusAfter = requiresReapproval \? "submitted" : statusBefore/);
assert.match(planEdit, /revised plan is pending your approval/);
assert.match(planEdit, /approved_snapshot/);
assert.match(planEdit, /\[leadId, executiveId\]/);
assert.match(planEdit, /project_plan_edited/);
assert.match(planEdit, /projectPlanChangeSummary/);
assert.match(planEdit, /UPDATE inbox_items/);
assert.match(planEdit, /recipientUserIds = \[\.\.\.new Set\(recipients\.filter/);

const closeout = functionBody(mutateSource, "closeOutProject", "async function submitProjectCloseout");
assert.match(closeout, /lifecycle_status = 'closed_out'/);
assert.match(closeout, /project_closeout_approved/);
assert.match(closeout, /\[leadId, executiveId\]/);

const closeoutSubmission = functionBody(mutateSource, "submitProjectCloseout", "async function reopenClosedProject");
assert.match(closeoutSubmission, /lifecycle_status = 'closeout_pending'/);
assert.match(closeoutSubmission, /project_closeout_submitted/);
assert.match(closeoutSubmission, /recipientUserIds: \[executiveId\]/);

const reopening = functionBody(mutateSource, "reopenClosedProject", "async function deactivateProject");
assert.match(reopening, /lifecycle_status = 'ongoing'/);
assert.match(reopening, /project_reopened/);
assert.match(reopening, /\[leadId, executiveId\]/);

const managerAssignment = functionBody(mutateSource, "assignManagerToProject", "async function unassignManagerFromProject");
assert.doesNotMatch(managerAssignment, /Executive or Admin access required/);
const memberAssignment = functionBody(mutateSource, "addProjectMember", "async function removeProjectMember");
assert.doesNotMatch(memberAssignment, /managerHasProjectAccess/);
const memberRemoval = functionBody(mutateSource, "removeProjectMember", "async function updateProjectMemberRate");
assert.doesNotMatch(memberRemoval, /managerHasProjectAccess/);
assert.match(mutateSource, /case "assign_manager_project":[\s\S]*?canEditProjectPlanningForTarget[\s\S]*?assignManagerToProject/);
assert.match(mutateSource, /case "add_project_member":[\s\S]*?canEditProjectPlanningForTarget[\s\S]*?addProjectMember/);

assert.match(plannerSource, /const canApprove = planningStatus === "submitted" && isProjectExecutive/);
assert.match(plannerSource, /const canRequestChanges = planningStatus !== "changes_requested" && isProjectExecutive/);
assert.match(plannerSource, /project-planning-status\.is-changes-requested/);
assert.match(plannerSource, /data-project-planning-request-details/);
assert.match(plannerSource, /onShowRequestDetails/);
assert.match(plannerSource, /data-project-planning-request/);
assert.doesNotMatch(plannerSource, /window\.prompt\(/);
assert.match(plannerSource, /await onPromptDialog/);
assert.match(plannerSource, /data-project-planning-approve/);
assert.match(appSource, /onRequestChanges: async function/);
assert.match(appSource, /onShowRequestDetails: async function/);
assert.match(appSource, /onApprove: async function/);
assert.match(appSource, /async function refreshInboxItems\(\)/);
assert.match(appSource, /inbox_only=1&refresh=\$\{Date\.now\(\)\}/);
assert.match(appSource, /inbox_only=1&refresh=[\s\S]*?cacheTtlMs: 0/);
assert.doesNotMatch(appSource, /if \(view === "inbox" && previousView !== "inbox"\) \{\s*beginInboxVisit\(\);/);
assert.match(stateSource, /const inboxOnly = .*inbox_only/);
assert.match(stateSource, /await listInboxItems\(sql, context\.currentUser\.accountId, context\.currentUser\.id\)/);
assert.match(appSource, /onPromptDialog: async function/);
assert.match(appSource, /const onConfirm = \(\) => \{\s*const value = showInput \? dialogResolveValue\(\) : undefined;\s*cleanup\(\);/);
assert.match(appSource, /const hasUnsavedChanges = projectDraftSignature\(\) !== savedDraftSignature;\s*if \(hasUnsavedChanges\) \{\s*const payload = buildProjectDialogPayload\(\)/);
assert.match(appSource, /if \(projectDialog\.openProjectPlanning\) \{[\s\S]*?setView\("project_planning"\);[\s\S]*?return;/);
const openPlannerHandler = appSource.match(/const onOpenProjectPlanning = async \(event\) => \{[\s\S]*?openPlanningButton\?\.addEventListener/)?.[0] || "";
assert.doesNotMatch(openPlannerHandler, /setView\("project_planning"\)/);
assert.match(membersModalSource, /user\.projectPlanningBaseRate/);
assert.match(appSource, /class="lead-combobox-menu" data-project-lead-menu/);
assert.doesNotMatch(appSource, /data-project-lead-menu[^>]*background:#fff/);
assert.match(stylesSource, /\.lead-combobox-menu \{[\s\S]*?background: var\(--panel\);[\s\S]*?color: var\(--ink\);/);

console.log("Project workflow regression tests passed.");
