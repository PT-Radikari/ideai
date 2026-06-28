const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(input: string | Date, now = new Date()): string {
  const then = typeof input === "string" ? new Date(input) : input;
  const diff = now.getTime() - then.getTime();
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  const suffix = future ? "from now" : "ago";

  if (absDiff < MINUTE) return future ? "in a moment" : "just now";
  if (absDiff < HOUR) {
    const value = Math.round(absDiff / MINUTE);
    return `${value} minute${value === 1 ? "" : "s"} ${suffix}`;
  }
  if (absDiff < DAY) {
    const value = Math.round(absDiff / HOUR);
    return `${value} hour${value === 1 ? "" : "s"} ${suffix}`;
  }
  if (absDiff < WEEK) {
    const value = Math.round(absDiff / DAY);
    return `${value} day${value === 1 ? "" : "s"} ${suffix}`;
  }
  if (absDiff < MONTH) {
    const value = Math.round(absDiff / WEEK);
    return `${value} week${value === 1 ? "" : "s"} ${suffix}`;
  }
  if (absDiff < YEAR) {
    const value = Math.round(absDiff / MONTH);
    return `${value} month${value === 1 ? "" : "s"} ${suffix}`;
  }
  const value = Math.round(absDiff / YEAR);
  return `${value} year${value === 1 ? "" : "s"} ${suffix}`;
}

export function formatAbsolute(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
