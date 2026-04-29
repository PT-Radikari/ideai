// OpsFlow — shared tokens & seed data

const STAGES = [
  "Issue Optimization Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
];

const PRIORITIES = ["High", "Medium", "Low"];

const SEED_TICKETS = [
  {
    id: "t1", code: "OPS-0023", stage: "Issue Optimization Request",
    title: "Automate payroll reconciliation for BPO",
    division: "BPO Operations", service: "Payroll", requester: "Sari Dewi",
    priority: "High",
    currentProcess: "6-hour manual merge of spreadsheets every fortnight across three teams.",
    requestDetail: "Build an automated reconciliation script that pulls from HR and Finance APIs.",
    businessImpact: "Save ~72 staff-hours per month, reduce errors by 90%.",
    successMetric: "Cut processing time from 6 hours to under 30 minutes.",
    notes: "Depends on HR API access approval.",
    attachments: 2, createdAt: "2025-04-10T08:00:00Z",
    activity: [{ title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: "2025-04-10T08:00:00Z" }],
  },
  {
    id: "t2", code: "OPS-0019", stage: "Review",
    title: "MPO invoice matching — reduce manual touchpoints",
    division: "MPO Finance", service: "Accounts Payable", requester: "Budi Santoso",
    priority: "Medium",
    currentProcess: "Team manually matches ~400 invoices per week against PO records.",
    requestDetail: "Automate matching with tolerance rules; flag exceptions for human review only.",
    businessImpact: "Reduce AP headcount requirement by 1 FTE.",
    successMetric: "95% straight-through processing rate within 90 days.",
    notes: "",
    attachments: 1, createdAt: "2025-04-08T09:30:00Z",
    activity: [
      { title: "Stage updated", detail: "Moved to Review.", createdAt: "2025-04-09T10:00:00Z" },
      { title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: "2025-04-08T09:30:00Z" },
    ],
  },
  {
    id: "t3", code: "OPS-0017", stage: "Production",
    title: "Automated daily operations report distribution",
    division: "Central Ops", service: "Reporting", requester: "Rina Kusuma",
    priority: "Low",
    currentProcess: "Report compiled manually in Excel and emailed to 12 stakeholders each morning.",
    requestDetail: "Schedule automated report generation from the data warehouse and send via email.",
    businessImpact: "Save 45 minutes daily; eliminate formatting errors.",
    successMetric: "Reports delivered by 07:00 WIB with zero manual steps.",
    notes: "",
    attachments: 0, createdAt: "2025-04-05T11:00:00Z",
    activity: [
      { title: "Stage updated", detail: "Moved to Production.", createdAt: "2025-04-11T14:00:00Z" },
      { title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: "2025-04-05T11:00:00Z" },
    ],
  },
  {
    id: "t4", code: "OPS-0015", stage: "Testing",
    title: "SLA tracking dashboard for support tickets",
    division: "IT Support", service: "Helpdesk", requester: "Andi Wijaya",
    priority: "High",
    currentProcess: "SLA status checked manually in ticketing system; no aggregated view.",
    requestDetail: "Build a real-time dashboard showing SLA health across all open tickets.",
    businessImpact: "Prevent SLA breaches; improve CSAT score.",
    successMetric: "Zero missed SLAs within 30 days of launch.",
    notes: "Integration with existing ITSM platform required.",
    attachments: 3, createdAt: "2025-04-01T07:00:00Z",
    activity: [
      { title: "Stage updated", detail: "Moved to Testing.", createdAt: "2025-04-12T09:00:00Z" },
      { title: "Manual update added", detail: "Test cases drafted and assigned.", createdAt: "2025-04-12T09:30:00Z" },
      { title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: "2025-04-01T07:00:00Z" },
    ],
  },
  {
    id: "t5", code: "OPS-0011", stage: "Deployment",
    title: "Employee onboarding checklist automation",
    division: "HR", service: "Talent Acquisition", requester: "Maya Putri",
    priority: "Medium",
    currentProcess: "HR manually sends onboarding tasks via email and tracks completion in Excel.",
    requestDetail: "Automate onboarding workflow with task assignments, reminders, and completion tracking.",
    businessImpact: "Reduce time-to-productivity by 2 weeks for new hires.",
    successMetric: "100% checklist completion tracked digitally within first onboarding cycle.",
    notes: "",
    attachments: 1, createdAt: "2025-03-20T10:00:00Z",
    activity: [
      { title: "Stage updated", detail: "Deployed to production.", createdAt: "2025-04-13T16:00:00Z" },
      { title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: "2025-03-20T10:00:00Z" },
    ],
  },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildCode() {
  return "OPS-" + String(Math.floor(Math.random() * 900) + 100).padStart(4, "0");
}

Object.assign(window, { STAGES, PRIORITIES, SEED_TICKETS, formatDate, buildCode });
