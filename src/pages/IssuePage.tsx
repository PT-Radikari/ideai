import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRelativeTime } from "../lib";
import {
  addComment,
  fetchTicket,
  getComments,
  getEvents,
  getRuns,
  moveTicket,
  subscribeToChanges,
  type KanbanComment,
  type KanbanEvent,
  type KanbanRun,
} from "../lib/kanban";
import { ASSIGNEES, STAGES, type Assignee, type Stage, type Ticket } from "../types";

// ---------------------------------------------------------------------------
// Timeline item shape — unified merge of comments, events, runs
// ---------------------------------------------------------------------------

type TimelineItem = {
  id: string;
  kind: "comment" | "event" | "run";
  timestamp: number; // unix seconds
  author?: string;
  body: string;
  icon: string;
};

function mergeTimeline(
  comments: KanbanComment[],
  events: KanbanEvent[],
  runs: KanbanRun[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const c of comments) {
    items.push({
      id: `c-${c.id}`,
      kind: "comment",
      timestamp: c.created_at,
      author: c.author,
      body: c.body,
      icon: "💬",
    });
  }

  for (const e of events) {
    const detail = prettifyEventPayload(e.payload);
    items.push({
      id: `e-${e.id}`,
      kind: "event",
      timestamp: e.created_at,
      body: `${prettifyEventKind(e.kind)}${detail ? `: ${detail}` : ""}`,
      icon: "⚡",
    });
  }

  for (const r of runs) {
    const summary = typeof r.summary === "string" ? r.summary : "";
    const status = typeof r.outcome === "string" ? r.outcome : typeof r.status === "string" ? r.status : "";
    items.push({
      id: `r-${r.id}`,
      kind: "run",
      timestamp: (r.started_at as number) ?? 0,
      author: typeof r.profile === "string" ? r.profile : undefined,
      body: `Run #${r.id}${status ? ` — ${status}` : ""}${summary ? `\n${summary}` : ""}`,
      icon: status === "done" ? "🟢" : status === "failed" ? "🔴" : "🔵",
    });
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}

function prettifyEventKind(kind: string): string {
  const map: Record<string, string> = {
    created: "Ticket created",
    promoted: "Status promoted",
    claimed: "Worker claimed",
    spawned: "Worker spawned",
    commented: "Commented",
    heartbeat: "Heartbeat",
    task_updated: "Task updated",
  };
  return map[kind] ?? kind;
}

function prettifyEventPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  }
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Stage badge colors (matches existing palette)
// ---------------------------------------------------------------------------

const STAGE_COLOR: Record<Stage, string> = {
  "Issue Request": "var(--medium)",
  Review: "var(--signal)",
  Revision: "var(--high)",
  Production: "var(--accent)",
  Testing: "var(--low)",
  Deployment: "var(--accent-s)",
};

// ---------------------------------------------------------------------------
// IssuePage component
// ---------------------------------------------------------------------------

export default function IssuePage({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<KanbanComment[]>([]);
  const [events, setEvents] = useState<KanbanEvent[]>([]);
  const [runs, setRuns] = useState<KanbanRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stageDraft, setStageDraft] = useState<Stage | null>(null);

  // Fetch task detail + timeline data
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketData, commentData, eventData, runData] = await Promise.all([
        fetchTicket(taskId),
        getComments(taskId),
        getEvents(taskId),
        getRuns(taskId),
      ]);
      setTicket(ticketData);
      setComments(commentData);
      setEvents(eventData);
      setRuns(runData);
      setStageDraft(ticketData.stage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load task",
      );
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // SSE subscription — refresh on changes to this task
  useEffect(() => {
    const unsub = subscribeToChanges((event) => {
      if (event.taskId === taskId) {
        void loadAll();
      }
    });
    return unsub;
  }, [taskId, loadAll]);

  // Timeline
  const timeline = useMemo(() => mergeTimeline(comments, events, runs), [comments, events, runs]);

  // Submit comment
  async function handleSubmitComment() {
    const body = commentText.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await addComment(taskId, "user", body);
      setCommentText("");
      // Optimistic: add a fake comment to timeline immediately
      setComments((prev) => [
        ...prev,
        {
          id: Date.now(),
          task_id: taskId,
          author: "user",
          body,
          created_at: Date.now() / 1000,
        },
      ]);
    } catch {
      // Will be refreshed by SSE
    } finally {
      setSubmitting(false);
    }
  }

  // Stage change
  async function handleStageChange(newStage: Stage) {
    if (!ticket || newStage === ticket.stage) return;
    const prev = ticket.stage;
    setStageDraft(newStage);
    // Optimistic update
    setTicket((t) => (t ? { ...t, stage: newStage } : t));
    try {
      const updated = await moveTicket(taskId, newStage);
      setTicket(updated);
    } catch {
      // Revert
      setTicket((t) => (t ? { ...t, stage: prev } : t));
      setStageDraft(prev);
    }
  }

  // 404 state
  if (!loading && (error || !ticket)) {
    return (
      <div className="issue-page">
        <div className="issue-header">
          <button className="btn-ghost" type="button" onClick={onBack}>
            ← Back to board
          </button>
        </div>
        <div className="issue-body">
          <div className="issue-404">
            <h2>Task not found</h2>
            <p>The task <code>{taskId}</code> does not exist or has been removed.</p>
            <button className="btn-primary" type="button" onClick={onBack}>
              Return to board
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !ticket) {
    return (
      <div className="issue-page">
        <div className="issue-header">
          <button className="btn-ghost" type="button" onClick={onBack}>
            ← Back to board
          </button>
        </div>
        <div className="issue-body">
          <div className="issue-loading">Loading task…</div>
        </div>
      </div>
    );
  }

  const displayStage = stageDraft ?? ticket.stage;

  return (
    <div className="issue-page">
      {/* Header */}
      <div className="issue-header">
        <button className="btn-ghost" type="button" onClick={onBack}>
          ← Back to board
        </button>
        <div className="issue-header-main">
          <span className="issue-code">{ticket.code}</span>
          <h1 className="issue-title">{ticket.title}</h1>
          <span
            className="issue-stage-badge"
            style={{ background: STAGE_COLOR[displayStage] ?? "var(--muted)" }}
          >
            {displayStage}
          </span>
        </div>
        <p className="issue-meta">
          Opened by {ticket.requester ?? ticket.assignee}
          {" · "}
          {formatRelativeTime(ticket.createdAt)}
        </p>
      </div>

      <div className="issue-body">
        {/* Sidebar */}
        <aside className="issue-sidebar">
          <div className="issue-sidebar-section">
            <p className="issue-sidebar-label">Assignee</p>
            <p className="issue-sidebar-value">{ticket.assignee}</p>
          </div>
          <div className="issue-sidebar-section">
            <p className="issue-sidebar-label">Priority</p>
            <span className="meta-chip" data-p={ticket.priority}>
              {ticket.priority}
            </span>
          </div>
          <div className="issue-sidebar-section">
            <p className="issue-sidebar-label">Division</p>
            <p className="issue-sidebar-value">{ticket.division}</p>
          </div>
          <div className="issue-sidebar-section">
            <p className="issue-sidebar-label">Service</p>
            <p className="issue-sidebar-value">{ticket.service}</p>
          </div>
          <div className="issue-sidebar-section">
            <p className="issue-sidebar-label">Stage</p>
            <select
              className="issue-stage-select"
              value={displayStage}
              onChange={(e) => handleStageChange(e.target.value as Stage)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </aside>

        {/* Main content */}
        <main className="issue-main">
          {/* Body card */}
          <section className="issue-card">
            <h3 className="issue-card-heading">Body</h3>
            {ticket.currentProcess && (
              <div className="issue-card-field">
                <p className="issue-card-label">Current Process</p>
                <p>{ticket.currentProcess}</p>
              </div>
            )}
            {ticket.requestDetail && (
              <div className="issue-card-field">
                <p className="issue-card-label">Request Detail</p>
                <p>{ticket.requestDetail}</p>
              </div>
            )}
            {ticket.businessImpact && ticket.businessImpact !== "—" && (
              <div className="issue-card-field">
                <p className="issue-card-label">Business Impact</p>
                <p>{ticket.businessImpact}</p>
              </div>
            )}
            {ticket.successMetric && ticket.successMetric !== "—" && (
              <div className="issue-card-field">
                <p className="issue-card-label">Success Metric</p>
                <p>{ticket.successMetric}</p>
              </div>
            )}
            {ticket.attachments.length > 0 && (
              <div className="issue-card-field">
                <p className="issue-card-label">Attachments</p>
                <p className="attachment-list">{ticket.attachments.join(", ")}</p>
              </div>
            )}
          </section>

          {/* Activity timeline */}
          <section className="issue-card">
            <h3 className="issue-card-heading">Activity</h3>
            {timeline.length === 0 ? (
              <p className="issue-empty">No activity yet.</p>
            ) : (
              <div className="issue-timeline">
                {timeline.map((item) => (
                  <div key={item.id} className="issue-timeline-item">
                    <span className="issue-timeline-icon">{item.icon}</span>
                    <div className="issue-timeline-content">
                      <p className="issue-timeline-body">
                        {item.kind === "comment" && item.author ? (
                          <>
                            <strong>{item.author}</strong> commented
                          </>
                        ) : (
                          item.body.split("\n")[0]
                        )}
                      </p>
                      {item.kind === "comment" && (
                        <p className="issue-timeline-detail">{item.body}</p>
                      )}
                      {item.kind === "run" && item.body.includes("\n") && (
                        <p className="issue-timeline-detail">
                          {item.body.split("\n").slice(1).join("\n")}
                        </p>
                      )}
                      <time className="issue-timeline-time">
                        {formatRelativeTime(new Date(item.timestamp * 1000).toISOString())}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Add comment */}
          <section className="issue-card">
            <h3 className="issue-card-heading">Add comment</h3>
            <div className="issue-comment-form">
              <textarea
                className="issue-comment-textarea"
                rows={4}
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSubmitComment();
                  }
                }}
              />
              <div className="issue-comment-actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => void handleSubmitComment()}
                  disabled={!commentText.trim() || submitting}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
