export const PRIORITIES = ["High", "Medium", "Low"] as const;

export type Priority = (typeof PRIORITIES)[number];
