import { type Assignee, type Ticket } from "./types";

export const SEED_TICKETS: Ticket[] = [
  {
    id: "t1",
    code: "OPT-420381",
    stage: "Issue Request",
    title: "Automate QA evidence collection",
    division: "QA",
    service: "Audit & Compliance",
    priority: "Medium",
    currentProcess:
      "Analysts compare spreadsheets against ERP exports by hand and flag mismatches over email.",
    requestDetail: "Introduce a validation workflow before month-end review.",
    businessImpact: "Cut validation time from 5h to 1h, fewer mismatch escapes.",
    successMetric: "Validation time under 1h, under 5% mismatch escape rate.",
    attachments: ["audit_sample.xlsx"],
    assignee: "Nadia Putri",
    createdAt: "2026-05-11T08:00:00Z",
    activity: [
      {
        title: "Ticket created",
        detail: "Entered through guided intake.",
        createdAt: "2026-05-11T08:00:00Z",
      },
    ],
  },
  {
    id: "t2",
    code: "OPT-420117",
    stage: "Review",
    title: "Attendance cleanup standardization",
    division: "BPO",
    service: "Attendance Management",
    priority: "High",
    currentProcess:
      "Supervisors update three attendance sheets and one payroll summary file before cutoff.",
    requestDetail:
      "Group missing logs, suspicious overtime, and unresolved leave entries into one review queue.",
    businessImpact: "Cut pre-payroll cleanup from 7 touchpoints to 2.",
    successMetric: "Seven touchpoints down to two.",
    attachments: ["attendance_sample.xlsx"],
    assignee: "Rizal Hidayat",
    createdAt: "2026-05-10T18:00:00Z",
    activity: [
      {
        title: "Review started",
        detail: "Business analyst validating scope.",
        createdAt: "2026-05-12T09:20:00Z",
      },
      {
        title: "Ticket created",
        detail: "Entered through guided intake.",
        createdAt: "2026-05-10T18:00:00Z",
      },
    ],
  },
  {
    id: "t3",
    code: "OPT-419998",
    stage: "Production",
    title: "Payroll reconciliation tool",
    division: "MPO",
    service: "Payroll",
    priority: "High",
    currentProcess: "Manual export and matching across four systems.",
    requestDetail: "Auto-match line items and surface only mismatches.",
    businessImpact: "Reduce close cycle by 1.5 days.",
    successMetric: "Close cycle shortened by 1.5 days.",
    attachments: ["payroll_export.csv"],
    assignee: "Melissa Tan",
    createdAt: "2026-05-09T06:00:00Z",
    activity: [
      {
        title: "Build started",
        detail: "Workflow accepted after revision.",
        createdAt: "2026-05-12T08:00:00Z",
      },
    ],
  },
  {
    id: "t4",
    code: "OPT-419800",
    stage: "Revision",
    title: "Invoice validation logic",
    division: "MPO",
    service: "Invoice Reconciliation",
    priority: "Medium",
    currentProcess: "Email-based mismatch flagging between teams.",
    requestDetail: "Refactor flagging into a shared real-time queue.",
    businessImpact: "Fewer mid-month escalations.",
    successMetric: "Escalation rate reduced by 60%.",
    attachments: [],
    assignee: "Nadia Putri",
    createdAt: "2026-05-08T12:00:00Z",
    activity: [
      {
        title: "Sent for revision",
        detail: "Reviewer requested narrower scope.",
        createdAt: "2026-05-12T06:00:00Z",
      },
    ],
  },
  {
    id: "t5",
    code: "OPT-419552",
    stage: "Testing",
    title: "Client onboarding checklist",
    division: "Shared Services",
    service: "Client Onboarding",
    priority: "Low",
    currentProcess: "Each team uses its own checklist and sends screenshots through chat.",
    requestDetail: "Standardize the checklist and approvals into a single flow.",
    businessImpact: "Cut onboarding coordination from two days to same-day.",
    successMetric: "Onboarding coordination completed same-day.",
    attachments: ["checklist_v3.xlsx"],
    assignee: "Melissa Tan",
    createdAt: "2026-05-07T03:00:00Z",
    activity: [
      {
        title: "Testing started",
        detail: "UAT team validating the flow.",
        createdAt: "2026-05-12T09:35:00Z",
      },
    ],
  },
  {
    id: "t6",
    code: "OPT-419310",
    stage: "Deployment",
    title: "Vendor handoff tracker",
    division: "Procurement",
    service: "Vendor Management",
    priority: "Low",
    currentProcess: "Spreadsheet shared by email with unclear owners per handoff.",
    requestDetail: "Create a live tracker with explicit owner per handoff.",
    businessImpact: "Faster vendor escalation cycles.",
    successMetric: "Escalation response time cut in half.",
    attachments: [],
    assignee: "Rizal Hidayat",
    createdAt: "2026-05-05T10:00:00Z",
    activity: [
      {
        title: "Deployed",
        detail: "Tracker rolled out to procurement leads.",
        createdAt: "2026-05-12T04:00:00Z",
      },
    ],
  },
];

export function formatRelativeTime(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(elapsedMs / 60000);

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

export function buildCode(): string {
  return `OPT-${String(Date.now()).slice(-6)}`;
}

export function sanitizeAssignee(value: string): Assignee {
  if (value === "Nadia Putri" || value === "Rizal Hidayat" || value === "Melissa Tan") {
    return value;
  }

  return "Unassigned";
}
