"use strict";

const assert = require("assert");
const {
  buildApprovalPackages,
  deriveSubmissionStatus,
  weekBounds,
} = require("../netlify/functions/weeklyApprovalDomain");

assert.deepStrictEqual(weekBounds("2026-08-29"), {
  weekStart: "2026-08-24",
  weekEnd: "2026-08-30",
});

const packages = buildApprovalPackages({
  member: { officeId: "bur", departmentId: "audit" },
  projects: [
    { id: 10, name: "Audit A", projectLeadId: "lead-a" },
    { id: 11, name: "Tax B", projectLeadId: "lead-b" },
  ],
  departmentLeadAssignments: [
    { officeId: "bur", departmentId: "audit", userId: "department-lead" },
  ],
  officeLocations: [{ id: "bur", officeLeadUserId: "office-lead" }],
  records: [
    { id: "t1", recordType: "time", projectId: 10 },
    { id: "e1", recordType: "expense", projectId: 10 },
    { id: "t2", recordType: "time", projectId: 11 },
    { id: "t3", recordType: "time", projectId: null },
  ],
});

assert.strictEqual(packages.length, 3);
assert.deepStrictEqual(packages.find((item) => item.packageKey === "project:10").items, [
  { recordType: "time", recordId: "t1" },
  { recordType: "expense", recordId: "e1" },
]);
assert.strictEqual(packages.find((item) => item.packageType === "non_project").reviewerUserId, "department-lead");

assert.strictEqual(deriveSubmissionStatus([]), "open");
assert.strictEqual(deriveSubmissionStatus(["submitted", "submitted"]), "submitted");
assert.strictEqual(deriveSubmissionStatus(["approved", "submitted"]), "partially_approved");
assert.strictEqual(deriveSubmissionStatus(["approved", "changes_requested"]), "changes_requested");
assert.strictEqual(deriveSubmissionStatus(["approved", "approved"]), "approved");
assert.strictEqual(deriveSubmissionStatus(["approved"], { locked: true }), "locked");

assert.throws(() => buildApprovalPackages({
  member: {}, projects: [], records: [{ id: "internal", recordType: "time" }],
}), /Department Lead or Office Lead/);

const selfReviewPackages = buildApprovalPackages({
  member: { id: "lead-a", officeId: "bur", departmentId: "audit" },
  projects: [{ id: 10, name: "Audit A", projectLeadId: "lead-a", projectExecutiveId: "executive-a" }],
  records: [{ id: "self-time", recordType: "time", projectId: 10 }],
});
assert.strictEqual(selfReviewPackages[0].reviewerUserId, "executive-a");

const departmentLeadSelfReview = buildApprovalPackages({
  member: { id: "department-lead", officeId: "bur", departmentId: "audit" },
  projects: [],
  departmentLeadAssignments: [
    { officeId: "bur", departmentId: "audit", userId: "department-lead" },
  ],
  officeLocations: [{ id: "bur", officeLeadUserId: "office-lead" }],
  records: [{ id: "internal-self", recordType: "time", projectId: null }],
});
assert.strictEqual(departmentLeadSelfReview[0].reviewerUserId, "office-lead");

const officeFallback = buildApprovalPackages({
  member: { id: "member-a", officeId: "bur", departmentId: "audit" },
  projects: [],
  departmentLeadAssignments: [],
  officeLocations: [{ id: "bur", officeLeadUserId: "office-lead" }],
  records: [{ id: "internal-fallback", recordType: "time", projectId: null }],
});
assert.strictEqual(officeFallback[0].reviewerUserId, "office-lead");

process.stdout.write("weekly approval domain tests passed\n");
