export const STAGES = [
  "Issue Optimization Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
] as const;

export type Stage = (typeof STAGES)[number];
