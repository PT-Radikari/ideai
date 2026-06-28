/**
 * Kanban adapter — maps between ideai `Ticket` type and Hermes kanban `Task`.
 *
 * Backend: kanban-api shim at http://localhost:8645 (parent task T1).
 * The shim exposes a Hermes kanban DB via REST + SSE.
 *
 * Design rules:
 * - `body.ideai.stage` is ground truth for the ideai stage. The Hermes
 *   `status` field is a best-effort projection for dispatcher compatibility.
 * - The shim enforces an `ALLOWED_STATUS_TRANSITIONS` graph. When moving a
 *   ticket to a new stage we may need to walk intermediate statuses; the
 *   adapter computes a shortest path through the graph and PATCHes each hop.
 * - If the API is unreachable, all operations throw `KanbanApiError`. Callers
 *   (App.tsx) catch it and surface an error banner; optimistic UI reverts.
 */
import {
  ASSIGNEES,
  PRIORITIES,
  STAGES,
  type ActivityItem,
  type Assignee,
  type Priority,
  type Stage,
  type Ticket,
} from "../types";

const API = import.meta.env.VITE_KANBAN_API || "http://localhost:8645";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "scheduled"
  | "done"
  | "archived";

export type KanbanComment = {
  id: number;
  task_id: string;
  author: string;
  body: string;
  created_at: number;
};

export type KanbanRun = {
  id: number;
  profile: string;
  status: string | null;
  outcome: string | null;
  summary: string | null;
  metadata: unknown;
  started_at: number | null;
  ended_at: number | null;
};

export type KanbanEvent = {
  id: number;
  task_id: string;
  run_id: number | null;
  kind: string;
  payload: unknown;
  created_at: number;
};

/** Raw kanban task shape from the shim. */
export type KanbanTask = {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  created_by: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  tenant: string | null;
  result: string | null;
  current_run_id: number | null;
  skills: string | null;
  model_override: string | null;
  session_id: string | null;
  goal_mode: number;
  goal_max_turns: number | null;
  // detail endpoint adds these:
  comments?: KanbanComment[];
  events?: KanbanEvent[];
  runs?: unknown[];
  parents?: string[];
  children?: string[];
};

export class KanbanApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "KanbanApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Stage ↔ status mapping
// ---------------------------------------------------------------------------

const STAGE_TO_STATUS: Record<Stage, KanbanStatus> = {
  "Issue Request": "triage",
  Review: "todo",
  Revision: "blocked",
  Production: "running",
  Testing: "ready",
  Deployment: "done",
};

const STATUS_TO_STAGE: Partial<Record<KanbanStatus, Stage>> = {
  triage: "Issue Request",
  todo: "Review",
  blocked: "Revision",
  running: "Production",
  ready: "Testing",
  done: "Deployment",
};

// Mirror of the shim's ALLOWED_STATUS_TRANSITIONS. Used to walk the graph when
// the direct jump is rejected. Keep in sync with
// /Users/eliserver/.hermes/scripts/kanban-api/main.py.
const ALLOWED_TRANSITIONS: Record<KanbanStatus, KanbanStatus[]> = {
  triage: ["todo", "archived"],
  todo: ["ready", "blocked", "archived"],
  ready: ["running", "blocked", "archived"],
  running: ["blocked", "done", "todo", "archived"],
  blocked: ["todo", "archived"],
  done: ["archived"],
  scheduled: [],
  archived: [],
};

// ---------------------------------------------------------------------------
// Priority mapping
// ---------------------------------------------------------------------------

const PRIORITY_TO_INT: Record<Priority, number> = {
  High: 10,
  Medium: 5,
  Low: 1,
};

function intToPriority(value: number): Priority {
  if (value >= 8) return "High";
  if (value >= 3) return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------------
// Assignee mapping
// ---------------------------------------------------------------------------

const HUMAN_TO_PROFILE: Record<Assignee, string | null> = {
  "Nadia Putri": "coding",
  "Rizal Hidayat": "geuse",
  "Melissa Tan": "sebastian",
  Unassigned: null,
};

const PROFILE_TO_HUMAN: Record<string, Assignee> = {
  coding: "Nadia Putri",
  geuse: "Rizal Hidayat",
  sebastian: "Melissa Tan",
};

function profileToAssignee(profile: string | null): Assignee {
  if (!profile) return "Unassigned";
  return PROFILE_TO_HUMAN[profile] ?? "Unassigned";
}

function assigneeToProfile(assignee: Assignee): string | null {
  return HUMAN_TO_PROFILE[assignee] ?? null;
}

// ---------------------------------------------------------------------------
// Body (ideai metadata) encoding
// ---------------------------------------------------------------------------

type IdeaiBodyMeta = {
  code: string;
  stage: Stage;
  division: string;
  service: string;
  priority: Priority;
  currentProcess: string;
  requestDetail: string;
  businessImpact: string;
  successMetric: string;
  attachments: string[];
  requester?: string;
  notes?: string;
};

type TaskBody = {
  ideai?: IdeaiBodyMeta;
  markdown?: string;
};

function encodeBody(ticket: Ticket): string {
  const ideai: IdeaiBodyMeta = {
    code: ticket.code,
    stage: ticket.stage,
    division: ticket.division,
    service: ticket.service,
    priority: ticket.priority,
    currentProcess: ticket.currentProcess,
    requestDetail: ticket.requestDetail,
    businessImpact: ticket.businessImpact,
    successMetric: ticket.successMetric,
    attachments: ticket.attachments,
  };
  if (ticket.requester) ideai.requester = ticket.requester;
  if (ticket.notes) ideai.notes = ticket.notes;

  const markdown = [
    `**${ticket.title}**`,
    "",
    `Division: ${ticket.division}`,
    `Service: ${ticket.service}`,
    `Priority: ${ticket.priority}`,
    "",
    "## Current process",
    ticket.currentProcess,
    "",
    "## Request",
    ticket.requestDetail,
    "",
    "## Business impact",
    ticket.businessImpact,
    "",
    "## Success metric",
    ticket.successMetric,
  ].join("\n");

  const body: TaskBody = { ideai, markdown };
  return JSON.stringify(body);
}

function decodeBody(raw: string | null): {
  ideai: Partial<IdeaiBodyMeta>;
  markdown: string;
} {
  if (!raw) return { ideai: {}, markdown: "" };
  try {
    const parsed = JSON.parse(raw) as TaskBody;
    return {
      ideai: parsed.ideai ?? {},
      markdown: parsed.markdown ?? "",
    };
  } catch {
    // Legacy / free-form body — treat the whole thing as markdown.
    return { ideai: {}, markdown: raw };
  }
}

// ---------------------------------------------------------------------------
// Ticket ↔ Task mapping
// ---------------------------------------------------------------------------

export function taskToTicket(task: KanbanTask): Ticket {
  const meta = decodeBody(task.body).ideai;
  const stage = (meta.stage ?? STATUS_TO_STAGE[task.status] ?? "Issue Request") as Stage;
  // Sanity: clamp unknown/invalid stage to the first stage.
  const safeStage: Stage = (STAGES as readonly string[]).includes(stage)
    ? stage
    : "Issue Request";

  const priority = meta.priority ?? intToPriority(task.priority ?? 0);
  const safePriority: Priority = (PRIORITIES as readonly string[]).includes(priority)
    ? priority
    : "Medium";

  const assignee = profileToAssignee(task.assignee);
  const safeAssignee: Assignee = (ASSIGNEES as readonly string[]).includes(assignee)
    ? assignee
    : "Unassigned";

  const activity: ActivityItem[] = (task.events ?? [])
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .map((event) => ({
      title: prettifyEventKind(event.kind),
      detail: prettifyEventDetail(event.payload),
      createdAt: new Date(event.created_at * 1000).toISOString(),
    }));

  return {
    id: task.id,
    code: meta.code ?? task.id,
    stage: safeStage,
    title: task.title ?? "(untitled)",
    division: meta.division ?? "—",
    service: meta.service ?? "—",
    priority: safePriority,
    currentProcess: meta.currentProcess ?? "",
    requestDetail: meta.requestDetail ?? decodeBody(task.body).markdown,
    businessImpact: meta.businessImpact ?? "",
    successMetric: meta.successMetric ?? "",
    attachments: meta.attachments ?? [],
    assignee: safeAssignee,
    requester: meta.requester,
    notes: meta.notes,
    createdAt: new Date((task.created_at ?? 0) * 1000).toISOString(),
    activity,
  };
}

function prettifyEventKind(kind: string): string {
  if (kind === "created") return "Ticket created";
  if (kind === "task_updated") return "Updated";
  if (kind === "comment_added") return "Comment added";
  return kind;
}

function prettifyEventDetail(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    parts.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
  return parts.join(" · ");
}

function ticketToCreatePayload(ticket: Ticket): {
  title: string;
  body: string;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  tenant: string | null;
} {
  return {
    title: ticket.title,
    body: encodeBody(ticket),
    assignee: assigneeToProfile(ticket.assignee),
    status: STAGE_TO_STATUS[ticket.stage],
    priority: PRIORITY_TO_INT[ticket.priority],
    tenant: "ideai",
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  init?: RequestInit & { expect204?: boolean },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new KanbanApiError(
      `network error reaching ${API}${path}: ${(err as Error).message}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new KanbanApiError(
      `${response.status} ${response.statusText} for ${path}${detail ? ` — ${detail}` : ""}`,
      response.status,
    );
  }

  if (init?.expect204 || response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Shortest-path walk through the status transition graph
// ---------------------------------------------------------------------------

function shortestStatusPath(from: KanbanStatus, to: KanbanStatus): KanbanStatus[] | null {
  if (from === to) return [];
  const visited = new Set<KanbanStatus>([from]);
  const queue: Array<{ node: KanbanStatus; path: KanbanStatus[] }> = [
    { node: from, path: [] },
  ];
  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    for (const next of ALLOWED_TRANSITIONS[node] ?? []) {
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === to) return nextPath;
      visited.add(next);
      queue.push({ node: next, path: nextPath });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public adapter API
// ---------------------------------------------------------------------------

export async function fetchTickets(): Promise<Ticket[]> {
  const tasks = await request<KanbanTask[]>("/api/kanban/tasks?limit=500");
  return tasks
    .filter((task) => task.status !== "archived")
    .map(taskToTicket);
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const task = await request<KanbanTask>(`/api/kanban/tasks/${encodeURIComponent(id)}`);
  return taskToTicket(task);
}

export async function createTicket(data: Partial<Ticket>): Promise<Ticket> {
  // Build a complete Ticket from the partial, applying the same defaults the
  // intake form does.
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: data.id ?? "",
    code: data.code ?? "",
    stage: data.stage ?? "Issue Request",
    title: data.title ?? "(untitled)",
    division: data.division ?? "—",
    service: data.service ?? "—",
    priority: data.priority ?? "Medium",
    currentProcess: data.currentProcess ?? "",
    requestDetail: data.requestDetail ?? "",
    businessImpact: data.businessImpact ?? "",
    successMetric: data.successMetric ?? "",
    attachments: data.attachments ?? [],
    assignee: data.assignee ?? "Unassigned",
    requester: data.requester,
    notes: data.notes,
    createdAt: data.createdAt ?? now,
    activity: data.activity ?? [],
  };

  const created = await request<KanbanTask>("/api/kanban/tasks", {
    method: "POST",
    body: JSON.stringify(ticketToCreatePayload(ticket)),
  });
  return taskToTicket(created);
}

export async function updateTicket(
  id: string,
  patch: Partial<Ticket>,
): Promise<Ticket> {
  // Always re-encode the full body so the ideai metadata stays in sync with
  // whatever fields the caller passed. Fetch the current ticket first.
  const current = await fetchTicket(id);
  const merged: Ticket = { ...current, ...patch };
  const body = encodeBody(merged);

  const payload: Record<string, unknown> = { body };
  if (patch.assignee) {
    payload.assignee = assigneeToProfile(patch.assignee);
  }
  if (patch.priority) {
    payload.priority = PRIORITY_TO_INT[patch.priority];
  }
  if (patch.title) {
    payload.title = patch.title;
  }

  const updated = await request<KanbanTask>(
    `/api/kanban/tasks/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return taskToTicket(updated);
}

export async function moveTicket(
  id: string,
  stage: Stage,
): Promise<Ticket> {
  const current = await fetchTicket(id);
  const targetStatus = STAGE_TO_STATUS[stage];

  // Always re-encode body with the new stage so the ground-truth field stays
  // authoritative even if the status walk has to bail partway.
  const merged: Ticket = { ...current, stage };
  await request<KanbanTask>(`/api/kanban/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ body: encodeBody(merged) }),
  });

  // Walk the status graph to the target. If no path exists (shouldn't happen
  // for the 6 ideai stages), leave the status where it is — the body field
  // already records the intended stage.
  const fromStatus = STAGE_TO_STATUS[current.stage];
  const path = shortestStatusPath(fromStatus, targetStatus) ?? [];
  let last: KanbanTask | null = null;
  for (const hop of path) {
    try {
      last = await request<KanbanTask>(
        `/api/kanban/tasks/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ status: hop }) },
      );
    } catch (err) {
      // Best-effort: stop on first hop that refuses; body already updated.
      if (!(err instanceof KanbanApiError)) throw err;
      break;
    }
  }

  // Re-fetch to reflect canonical state.
  return fetchTicket(id);
}

export async function addComment(
  taskId: string,
  author: string,
  body: string,
): Promise<void> {
  await request<KanbanComment>(
    `/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
    { method: "POST", body: JSON.stringify({ author, body }) },
  );
}

export async function getComments(taskId: string): Promise<KanbanComment[]> {
  return request<KanbanComment[]>(
    `/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
  );
}

export async function getEvents(taskId: string): Promise<KanbanEvent[]> {
  return request<KanbanEvent[]>(
    `/api/kanban/tasks/${encodeURIComponent(taskId)}/events`,
  );
}

export async function getRuns(taskId: string): Promise<KanbanRun[]> {
  return request<KanbanRun[]>(
    `/api/kanban/tasks/${encodeURIComponent(taskId)}/runs`,
  );
}

// ---------------------------------------------------------------------------
// SSE subscription
// ---------------------------------------------------------------------------

export type KanbanSseEvent =
  | { type: "task_created"; taskId: string; event: KanbanEvent }
  | { type: "task_updated"; taskId: string; event: KanbanEvent }
  | { type: "comment_added"; taskId: string; comment: KanbanComment };

export function subscribeToChanges(callback: (event: KanbanSseEvent) => void): () => void {
  let closed = false;
  let es: EventSource | null = null;

  function connect() {
    if (closed) return;
    es = new EventSource(`${API}/api/kanban/stream`);
    es.addEventListener("task_created", (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as {
          task_id: string;
          event: KanbanEvent;
        };
        callback({
          type: "task_created",
          taskId: data.task_id,
          event: data.event,
        });
      } catch {}
    });
    es.addEventListener("task_updated", (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as {
          task_id: string;
          event: KanbanEvent;
        };
        callback({
          type: "task_updated",
          taskId: data.task_id,
          event: data.event,
        });
      } catch {}
    });
    es.addEventListener("comment_added", (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as {
          task_id: string;
          comment: KanbanComment;
        };
        callback({
          type: "comment_added",
          taskId: data.task_id,
          comment: data.comment,
        });
      } catch {}
    });
    es.onerror = () => {
      // Browser will auto-reconnect; if not, we re-open after a backoff.
      es?.close();
      if (!closed) window.setTimeout(connect, 3000);
    };
  }

  connect();

  return () => {
    closed = true;
    es?.close();
  };
}

// ---------------------------------------------------------------------------
// Exported mappings (used by callers that want the constants)
// ---------------------------------------------------------------------------

export const STAGE_TO_KANBAN_STATUS = STAGE_TO_STATUS;
export const HUMAN_TO_KANBAN_PROFILE = HUMAN_TO_PROFILE;
export const PROFILE_TO_KANBAN_HUMAN = PROFILE_TO_HUMAN;
