export const STAGES = [
  "Issue Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export const ASSIGNEES = [
  "Nadia Putri",
  "Rizal Hidayat",
  "Melissa Tan",
  "Unassigned",
] as const;

export const CLUSTERS = ["all", "request", "build", "release"] as const;

export type Stage = (typeof STAGES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Assignee = (typeof ASSIGNEES)[number];
export type Cluster = (typeof CLUSTERS)[number];
export type View = "board" | "intake";

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
  priority: Priority;
  currentProcess: string;
  requestDetail: string;
  businessImpact: string;
  successMetric: string;
  attachments: string[];
  assignee: Assignee;
  requester?: string;
  notes?: string;
  createdAt: string;
  activity: ActivityItem[];
};

export type StageCounts = Record<Stage, number>;
