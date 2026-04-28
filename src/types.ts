export const STAGES = [
  "Issue Optimization Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export type Stage = (typeof STAGES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type View = "intake" | "board";
export type AttachmentKind = "image" | "spreadsheet" | "file";

export type AttachmentRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: AttachmentKind;
  previewDataUrl: string;
};

export type ActivityItem = {
  title: string;
  detail: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  code: string;
  stage: Stage;
  title: string;
  division: string;
  service: string;
  requester: string;
  priority: Priority;
  currentProcess: string;
  requestDetail: string;
  businessImpact: string;
  successMetric: string;
  notes: string;
  attachments: AttachmentRecord[];
  createdAt: string;
  activity: ActivityItem[];
};
