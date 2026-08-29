"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mutateSource = fs.readFileSync(path.join(root, "netlify/functions/mutate.js"), "utf8");
const plannerSource = fs.readFileSync(path.join(root, "projectPlanning.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

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
assert.match(planEdit, /\["submitted", "approved"\]\.includes\(statusBefore\) && !isExecutive && !isSuperuser/);
assert.match(planEdit, /approved_snapshot/);
assert.match(planEdit, /\[leadId, executiveId\]/);
assert.match(planEdit, /project_plan_edited/);

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

assert.match(plannerSource, /planningStatus === "submitted" && isProjectExecutive/);
assert.match(plannerSource, /data-project-planning-request/);
assert.match(plannerSource, /data-project-planning-approve/);
assert.match(appSource, /onRequestChanges: async function/);
assert.match(appSource, /onApprove: async function/);

console.log("Project workflow regression tests passed.");
