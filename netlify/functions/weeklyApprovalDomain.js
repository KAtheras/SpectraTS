"use strict";

const VALID_PACKAGE_STATUSES = new Set(["submitted", "changes_requested", "approved"]);

function isoDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
  return date.toISOString().slice(0, 10);
}

function weekBounds(value) {
  const date = new Date(`${isoDate(value)}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - offset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { weekStart: isoDate(start), weekEnd: isoDate(end) };
}

function resolveNonProjectReviewer({ member, departmentLeadAssignments, officeLocations }) {
  const memberUserId = String(member?.id ?? member?.userId ?? member?.user_id ?? "").trim();
  const officeId = String(member?.officeId ?? member?.office_id ?? "").trim();
  const departmentId = String(member?.departmentId ?? member?.department_id ?? "").trim();
  const departmentLead = (departmentLeadAssignments || []).find((assignment) =>
    String(assignment?.officeId ?? assignment?.office_id ?? "").trim() === officeId &&
    String(assignment?.departmentId ?? assignment?.department_id ?? "").trim() === departmentId
  );
  const departmentLeadId = String(departmentLead?.userId ?? departmentLead?.user_id ?? "").trim();
  if (departmentLeadId && departmentLeadId !== memberUserId) return departmentLeadId;
  const office = (officeLocations || []).find((item) =>
    String(item?.id ?? "").trim() === officeId
  );
  const officeLeadId = String(office?.officeLeadUserId ?? office?.office_lead_user_id ?? "").trim();
  return officeLeadId !== memberUserId ? officeLeadId : "";
}

function buildApprovalPackages({ records, projects, member, departmentLeadAssignments, officeLocations, autoApproveNonProject = false }) {
  const projectById = new Map((projects || []).map((project) => [String(project?.id ?? ""), project]));
  const packages = new Map();
  for (const record of records || []) {
    const recordType = record?.recordType === "expense" ? "expense" : "time";
    const recordId = String(record?.id ?? "").trim();
    if (!recordId) throw new Error("Every submitted record must have an id.");
    const projectId = String(record?.projectId ?? record?.project_id ?? "").trim();
    if (projectId) {
      const project = projectById.get(projectId);
      if (!project) throw new Error(`Project ${projectId} could not be resolved.`);
      const projectLeadId = String(project?.projectLeadId ?? project?.project_lead_id ?? "").trim();
      const projectExecutiveId = String(project?.projectExecutiveId ?? project?.project_executive_id ?? "").trim();
      const memberUserId = String(member?.id ?? member?.userId ?? member?.user_id ?? "").trim();
      const reviewerUserId = projectLeadId && projectLeadId !== memberUserId ? projectLeadId : projectExecutiveId;
      if (!reviewerUserId) throw new Error(`${project?.name || "A project"} needs a Project Lead or Project Executive who can review this member's time.`);
      const packageKey = `project:${projectId}`;
      if (!packages.has(packageKey)) {
        packages.set(packageKey, { packageKey, packageType: "project", projectId, reviewerUserId, items: [] });
      }
      packages.get(packageKey).items.push({ recordType, recordId });
      continue;
    }
    const memberUserId = String(member?.id ?? member?.userId ?? member?.user_id ?? "").trim();
    if (autoApproveNonProject) {
      const packageKey = `non_project:auto`;
      if (!packages.has(packageKey)) {
        packages.set(packageKey, { packageKey, packageType: "non_project", projectId: null, reviewerUserId: memberUserId, autoApproved: true, items: [] });
      }
      packages.get(packageKey).items.push({ recordType, recordId });
      continue;
    }
    const reviewerUserId = resolveNonProjectReviewer({ member, departmentLeadAssignments, officeLocations });
    if (!reviewerUserId) {
      throw new Error("Assign a Department Lead or Office Lead before submitting non-project records.");
    }
    const packageKey = `non_project:${reviewerUserId}`;
    if (!packages.has(packageKey)) {
      packages.set(packageKey, { packageKey, packageType: "non_project", projectId: null, reviewerUserId, items: [] });
    }
    packages.get(packageKey).items.push({ recordType, recordId });
  }
  return [...packages.values()];
}

function deriveSubmissionStatus(packageStatuses, { locked = false } = {}) {
  if (locked) return "locked";
  const statuses = (packageStatuses || []).map((status) => String(status || "").trim());
  if (!statuses.length) return "open";
  if (statuses.some((status) => !VALID_PACKAGE_STATUSES.has(status))) {
    throw new Error("Unknown approval package status.");
  }
  if (statuses.some((status) => status === "changes_requested")) return "changes_requested";
  if (statuses.every((status) => status === "approved")) return "approved";
  if (statuses.some((status) => status === "approved")) return "partially_approved";
  return "submitted";
}

module.exports = {
  buildApprovalPackages,
  deriveSubmissionStatus,
  resolveNonProjectReviewer,
  weekBounds,
};
