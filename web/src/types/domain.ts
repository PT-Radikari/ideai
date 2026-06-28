import type { Priority } from "@/constants/priorities";
import type { Stage } from "@/constants/stages";

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
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type IssueState = "open" | "closed";

export type User = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  description?: string;
};

export type Comment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  code: string;
  state: IssueState;
  closedAt?: string;
  stage: Stage;
  title: string;
  body: string;
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
  labels: string[];
  assignees: string[];
  comments: Comment[];
  createdAt: string;
  activity: ActivityItem[];
};
