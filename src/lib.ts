import type {
  ActivityItem,
  AttachmentKind,
  AttachmentRecord,
  Ticket,
} from "./types";

export const STORAGE_KEY = "opsflow-kanban-v1";

export function buildActivity(
  title: string,
  detail: string,
  createdAt = new Date().toISOString(),
): ActivityItem {
  return { title, detail, createdAt };
}

export function buildTicketCode(): string {
  return `OPT-${String(Date.now()).slice(-6)}`;
}

export function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function normalizeAttachments(files: File[]): Promise<AttachmentRecord[]> {
  return Promise.all(files.filter((file) => file.size > 0).map(normalizeAttachment));
}

async function normalizeAttachment(file: File): Promise<AttachmentRecord> {
  const kind: AttachmentKind = file.type.startsWith("image/")
    ? "image"
    : /\.(csv|xlsx|xls|ods)$/i.test(file.name)
      ? "spreadsheet"
      : "file";

  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    kind,
    previewDataUrl:
      kind === "image" && file.size < 900_000 ? await readFileAsDataUrl(file) : "",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function buildSeedTickets(): Ticket[] {
  return [
    {
      id: crypto.randomUUID(),
      code: "OPT-420381",
      stage: "Review",
      title: "Automate invoice validation before MPO month-end close",
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
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      activity: [
        buildActivity(
          "Review started",
          "Business analyst is validating scope and source files.",
          new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        ),
        buildActivity(
          "Ticket created",
          "Request entered through the guided intake channel.",
          new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        ),
      ],
    },
    {
      id: crypto.randomUUID(),
      code: "OPT-420117",
      stage: "Production",
      title: "Consolidate BPO attendance cleanup into one exception queue",
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
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      activity: [
        buildActivity(
          "Build approved",
          "Workflow logic accepted after revision.",
          new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        ),
      ],
    },
    {
      id: crypto.randomUUID(),
      code: "OPT-419552",
      stage: "Testing",
      title: "Standardize client onboarding handoff for shared services",
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
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
      activity: [
        buildActivity(
          "Testing started",
          "UAT team is validating the checklist flow.",
          new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        ),
      ],
    },
  ];
}

export function buildStandaloneSampleTicket(): Ticket {
  return {
    id: crypto.randomUUID(),
    code: buildTicketCode(),
    stage: "Issue Optimization Request",
    title: "Reduce manual QA evidence collection",
    division: "Quality Assurance",
    service: "Audit and Compliance",
    requester: "Sample PIC",
    priority: "Medium",
    currentProcess:
      "Team members capture screenshots manually, rename files by hand, then compile evidence in spreadsheets before review.",
    requestDetail:
      "Create a structured evidence submission flow with required fields and a cleaner approval handoff.",
    businessImpact:
      "Reduce turnaround time for recurring audits and prevent missing evidence.",
    successMetric:
      "Shorten evidence preparation from 3 hours to 45 minutes per audit cycle.",
    notes: "Sample ticket injected from the intake screen.",
    attachments: [],
    createdAt: new Date().toISOString(),
    activity: [
      buildActivity(
        "Ticket created",
        "Sample ticket added from the intake screen.",
      ),
    ],
  };
}
