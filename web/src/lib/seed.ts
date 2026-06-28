import { nanoid } from "nanoid";

import type {
  ActivityItem,
  Comment,
  Label,
  Ticket,
  User,
} from "@/types/domain";

function id(): string {
  return nanoid(10);
}

function activity(title: string, detail: string, createdAt?: string): ActivityItem {
  return {
    id: id(),
    title,
    detail,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

function comment(authorId: string, body: string, ageMs: number): Comment {
  return {
    id: id(),
    authorId,
    body,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

export function buildSeedUsers(): User[] {
  return [
    { id: "user-nadia", name: "Nadia Putri", initials: "NP", color: "#0d8a7c" },
    { id: "user-rizal", name: "Rizal Hidayat", initials: "RH", color: "#df6f2d" },
    { id: "user-melissa", name: "Melissa Tan", initials: "MT", color: "#8250df" },
    { id: "user-andre", name: "Andre Saputra", initials: "AS", color: "#1f63d8" },
  ];
}

export function buildSeedLabels(): Label[] {
  return [
    {
      id: "label-bug",
      name: "bug",
      color: "#d73a49",
      description: "Something isn't working",
    },
    {
      id: "label-enhancement",
      name: "enhancement",
      color: "#0d8a7c",
      description: "New feature or request",
    },
    {
      id: "label-question",
      name: "question",
      color: "#cc8a14",
      description: "Further information requested",
    },
    {
      id: "label-blocker",
      name: "blocker",
      color: "#a61b1b",
      description: "Stops downstream work",
    },
    {
      id: "label-documentation",
      name: "documentation",
      color: "#1f63d8",
      description: "Improvements to docs",
    },
  ];
}

export function buildTicketCode(): string {
  return `OPT-${String(Date.now()).slice(-6)}`;
}

export function buildSeedTickets(): Ticket[] {
  return [
    {
      id: id(),
      code: "OPT-420381",
      state: "open",
      stage: "Review",
      title: "Automate invoice validation before MPO month-end close",
      body:
        "## Context\n\nFinance analysts spend hours each cycle reconciling vendor spreadsheets against ERP exports.\n\n### What we want\n\n- Detect duplicate invoice numbers automatically\n- Flag missing PO references\n- Surface amount mismatches for the analyst to confirm\n\nSee attached samples for the most recent batch.",
      division: "MPO Finance",
      service: "Invoice Reconciliation",
      requester: "Nadia Putri",
      priority: "High",
      currentProcess:
        "Analysts compare vendor spreadsheets against ERP exports by hand and flag mismatches over email.",
      requestDetail:
        "Introduce a validation workflow that checks duplicate invoice numbers, missing PO references, and amount mismatches before month-end review.",
      businessImpact:
        "Reduce late close risk and prevent repeat rework across the finance operations team.",
      successMetric:
        "Shrink validation time from 5 hours per batch to under 1 hour while reducing mismatch escapes by 80%.",
      notes: "ERP export format is stable. Vendor submission formats vary.",
      attachments: [],
      labels: ["label-bug", "label-blocker"],
      assignees: ["user-nadia", "user-andre"],
      comments: [
        comment(
          "user-rizal",
          "Looped in finance ops — they confirmed the **mismatch escape rate** is the biggest pain. Let's prioritize that detection first.",
          1000 * 60 * 60 * 6,
        ),
        comment(
          "user-andre",
          "I can mock the ERP export parser by Friday if Nadia shares a sanitized batch.",
          1000 * 60 * 60 * 2,
        ),
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      activity: [
        activity(
          "Review started",
          "Business analyst is validating scope and source files.",
          new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        ),
        activity(
          "Ticket created",
          "Request entered through the guided intake channel.",
          new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        ),
      ],
    },
    {
      id: id(),
      code: "OPT-420117",
      state: "open",
      stage: "Production",
      title: "Consolidate BPO attendance cleanup into one exception queue",
      body:
        "Supervisors juggle three sheets and a final summary before payroll.\n\n- Missing logs\n- Suspicious overtime\n- Unresolved leave\n\nWe want a single queue that triages all three.",
      division: "BPO Operations",
      service: "Attendance Management",
      requester: "Rizal Hidayat",
      priority: "Medium",
      currentProcess:
        "Supervisors update three different attendance sheets and a final summary file before payroll cutoff.",
      requestDetail:
        "Create a single intake and exception handling flow that groups missing logs, suspicious overtime, and unresolved leave entries.",
      businessImpact:
        "Reduce duplicate checks across team leads and payroll administrators.",
      successMetric:
        "Cut pre-payroll attendance cleanup from 7 touchpoints to 2 and reduce missed exception follow-ups.",
      notes: "Attendance logs come from biometric export plus HRIS leave records.",
      attachments: [],
      labels: ["label-enhancement"],
      assignees: ["user-rizal"],
      comments: [
        comment(
          "user-melissa",
          "Approved scope. Build can proceed once revision feedback is resolved.",
          1000 * 60 * 60 * 24,
        ),
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      activity: [
        activity(
          "Build approved",
          "Workflow logic accepted after revision.",
          new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        ),
      ],
    },
    {
      id: id(),
      code: "OPT-419552",
      state: "closed",
      closedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      stage: "Deployment",
      title: "Standardize client onboarding handoff for shared services",
      body:
        "Each team uses its own checklist today. We need a shared checklist with required document tracking.",
      division: "Shared Services",
      service: "Client Onboarding",
      requester: "Melissa Tan",
      priority: "Low",
      currentProcess:
        "Each team uses its own checklist and sends screenshots through chat during onboarding approval.",
      requestDetail:
        "Standardize the checklist, collect approvals in one place, and make missing documents visible before production handoff.",
      businessImpact:
        "Reduce onboarding delays and improve audit readiness.",
      successMetric:
        "Cut average onboarding coordination delay from 2 business days to same-day completion.",
      notes: "Need to align legal, finance, and delivery onboarding checkpoints.",
      attachments: [],
      labels: ["label-documentation", "label-question"],
      assignees: ["user-melissa", "user-nadia"],
      comments: [
        comment(
          "user-melissa",
          "Closed — checklist is live and adopted by all three teams. 🎉",
          1000 * 60 * 30,
        ),
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
      activity: [
        activity(
          "Issue closed",
          "Marked complete after deployment.",
          new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        ),
        activity(
          "Testing started",
          "UAT team is validating the checklist flow.",
          new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        ),
      ],
    },
  ];
}
