# IdeAI ↔ Hermes Kanban End-to-End Implementation Plan

> **For Hermes:** Use `subagent-driven-development` or kanban task dispatch to implement this plan task-by-task. Do not collapse this into one monolithic edit.

**Goal:** Make IdeAI (`/Users/eliserver/ideai`) a GitHub-issue-style frontend for Hermes kanban, with intake → blueprint automation → kanban tasks → issue detail pages → live status updates.

**Architecture:** IdeAI stays a React/Vite browser app. It talks to a local HTTP API shim, not SQLite directly. The shim reads and writes Hermes kanban SQLite tables safely, while the Shiro gateway handles webhook-triggered blueprint runs.

**Tech Stack:** React 19, Vite, TypeScript, FastAPI, SQLite, Server-Sent Events, Hermes gateway webhooks, Hermes kanban DB.

---

## 1. Current State

### IdeAI frontend

Repo:

```text
/Users/eliserver/ideai
```

Important files:

```text
/Users/eliserver/ideai/src/App.tsx
/Users/eliserver/ideai/src/lib.ts
/Users/eliserver/ideai/src/types.ts
/Users/eliserver/ideai/package.json
```

Current behavior:

- `App.tsx` owns board state in React state.
- `loadInitialTickets()` reads from `window.localStorage` using `STORAGE_KEY`.
- `useEffect()` writes every ticket update back to localStorage.
- Intake form creates local `Ticket` objects only.
- Clicking card opens in-page drawer via `selectedId`.
- Shift-click advances stage locally.
- Drawer edits stage, assignee, notes locally.
- No durable backend.
- No Hermes kanban integration.

Current `Ticket` shape lives in `src/types.ts`:

```ts
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
```

Current stages:

```ts
export const STAGES = [
  "Issue Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
] as const;
```

### Hermes kanban backend

DB:

```text
/Users/eliserver/.hermes/kanban.db
```

Core tables:

```text
tasks
task_comments
task_events
task_runs
task_links
```

Kanban already has GitHub-issue primitives:

| GitHub issue concept | Hermes kanban source |
|---|---|
| Issue title | `tasks.title` |
| Issue body | `tasks.body` |
| Issue number | `tasks.id` |
| Status badge | `tasks.status` |
| Priority | `tasks.priority` |
| Assignee | `tasks.assignee` |
| Comment thread | `task_comments` |
| Timeline events | `task_events` |
| Run history | `task_runs` |
| Parent/child links | `task_links` |
| Attachments | v1 metadata/local paths, later real attachment table if available |

### Gateway/webhook state

Target setup:

```text
Shiro gateway: http://localhost:8644
Kanban API shim: http://localhost:8645
IdeAI Vite dev server: http://localhost:5173 or chosen Vite port
```

Webhook platform must be enabled under Shiro profile:

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      host: "0.0.0.0"
      port: 8644
      secret: "<global-webhook-secret>"
```

Webhook route target:

```text
POST http://localhost:8644/webhooks/ideai-intake
```

---

## 2. Target End-to-End Flow

### 2.1 User opens IdeAI board

1. Browser loads IdeAI.
2. IdeAI calls:

```http
GET http://localhost:8645/api/kanban/tasks
```

3. API shim reads `tasks` from `~/.hermes/kanban.db`.
4. API shim returns Hermes tasks as JSON.
5. `src/lib/kanban.ts` maps each Hermes task into an IdeAI `Ticket`.
6. Board renders tickets grouped by IdeAI stage.
7. IdeAI subscribes to SSE:

```http
GET http://localhost:8645/api/kanban/stream
```

8. Incoming events update local React cache.

### 2.2 User opens one ticket as GitHub-style issue page

1. User clicks card.
2. App changes hash route:

```text
#/tasks/t_12345678
```

3. App renders `IssuePage`.
4. Issue page calls:

```http
GET http://localhost:8645/api/kanban/tasks/t_12345678
GET http://localhost:8645/api/kanban/tasks/t_12345678/comments
GET http://localhost:8645/api/kanban/tasks/t_12345678/events
GET http://localhost:8645/api/kanban/tasks/t_12345678/runs
```

5. Page renders:

- title
- body/request detail
- metadata sidebar
- stage dropdown
- assignee
- priority
- comments
- kanban events
- worker run history
- linked parent/child tasks

### 2.3 User submits new intake request

1. User fills intake form in IdeAI.
2. Frontend creates task immediately through API shim:

```http
POST http://localhost:8645/api/kanban/tasks
```

3. New kanban task appears on board as `Issue Request`.
4. Frontend also posts same payload to Shiro webhook:

```http
POST http://localhost:8644/webhooks/ideai-intake
```

5. Shiro webhook triggers Hermes agent run.
6. Prompt asks Shiro/Hermes to blueprint request into executable kanban tasks.
7. Blueprint run creates child kanban tasks linked to intake task.
8. SSE updates IdeAI timeline when child tasks/events appear.

### 2.4 User changes stage

1. User drags card or changes stage dropdown.
2. Frontend does optimistic UI update.
3. Frontend calls:

```http
PATCH http://localhost:8645/api/kanban/tasks/{id}
```

4. API shim updates kanban DB status and writes `task_events` row.
5. SSE event confirms update.
6. On failure, frontend reverts optimistic update and shows toast.

---

## 3. Data Model Contract

### 3.1 Hermes task JSON returned by shim

```ts
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
};

export type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "scheduled"
  | "done"
  | "archived";
```

### 3.2 Structured IdeAI metadata inside `tasks.body`

Use JSON fenced by normal markdown fallback. Store this as task body:

```json
{
  "ideai": {
    "code": "OPT-420381",
    "stage": "Issue Request",
    "division": "QA",
    "service": "Audit & Compliance",
    "priority": "Medium",
    "currentProcess": "Analysts compare spreadsheets...",
    "requestDetail": "Introduce validation workflow...",
    "businessImpact": "Cut validation time...",
    "successMetric": "Validation time under 1h...",
    "attachments": ["audit_sample.xlsx"],
    "requester": "Arya",
    "notes": "optional"
  },
  "markdown": "Human-readable issue body here."
}
```

Rules:

- `body` must stay human-readable enough for Hermes workers.
- `ideai` object is machine-readable source for IdeAI fields.
- If body is not valid JSON, adapter falls back to markdown parsing and defaults.
- Never store secrets in `body`.

### 3.3 Stage/status mapping

IdeAI stages are product workflow states. Hermes statuses are worker/dispatcher states. They do not match perfectly.

Use this v1 mapping:

| IdeAI stage | Hermes status | Notes |
|---|---|---|
| `Issue Request` | `triage` | New unspec'd request |
| `Review` | `todo` | Spec exists, not ready for worker |
| `Revision` | `blocked` | Needs human/spec changes |
| `Production` | `running` | Worker actively executing |
| `Testing` | `ready` | Verification-ready work; not perfect, but dispatcher-compatible |
| `Deployment` | `done` | Completed work |

Important:

- Preserve original IdeAI stage in `body.ideai.stage`.
- Use Hermes `status` for dispatcher compatibility.
- If `status` and `body.ideai.stage` disagree, UI should prefer `body.ideai.stage` for display but show a warning in debug logs.

### 3.4 Priority mapping

```ts
High   -> 10
Medium -> 5
Low    -> 1
```

Reverse:

```ts
priority >= 8 -> "High"
priority >= 3 -> "Medium"
else          -> "Low"
```

### 3.5 Assignee mapping

Current IdeAI assignees:

```ts
"Nadia Putri" | "Rizal Hidayat" | "Melissa Tan" | "Unassigned"
```

Hermes assignees are profile names:

```text
coding
shiro
geuse
sebastian
klerik
kurisu
shiki
tohru
io
```

Use v1 mapping file:

```ts
export const HUMAN_TO_PROFILE: Record<Assignee, string | null> = {
  "Nadia Putri": "coding",
  "Rizal Hidayat": "geuse",
  "Melissa Tan": "sebastian",
  "Unassigned": null,
};

export const PROFILE_TO_HUMAN: Record<string, Assignee> = {
  coding: "Nadia Putri",
  geuse: "Rizal Hidayat",
  sebastian: "Melissa Tan",
};
```

Long-term cleaner path: migrate IdeAI assignees to profile names and render display names separately.

---

## 4. Backend: Kanban API Shim

### 4.1 Location

Create:

```text
/Users/eliserver/.hermes/scripts/kanban-api/
  main.py
  requirements.txt
  run.sh
  README.md
```

### 4.2 Runtime

Environment:

```bash
KANBAN_DB=/Users/eliserver/.hermes/kanban.db
KANBAN_API_HOST=127.0.0.1
KANBAN_API_PORT=8645
```

Run command:

```bash
cd /Users/eliserver/.hermes/scripts/kanban-api
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

`requirements.txt`:

```text
fastapi
uvicorn[standard]
aiosqlite
pydantic
```

### 4.3 API endpoints

#### Health

```http
GET /health
```

Response:

```json
{"status":"ok"}
```

#### List tasks

```http
GET /api/kanban/tasks?status=todo&assignee=coding&tenant=ideai&limit=100
```

Response:

```json
{
  "tasks": [
    {
      "id": "t_12345678",
      "title": "Example",
      "body": "...",
      "assignee": "coding",
      "status": "todo",
      "priority": 5,
      "created_at": 1781670158
    }
  ]
}
```

#### Get task detail

```http
GET /api/kanban/tasks/{id}
```

Response:

```json
{
  "task": {},
  "comments": [],
  "events": [],
  "runs": [],
  "parents": [],
  "children": []
}
```

#### Create task

```http
POST /api/kanban/tasks
Content-Type: application/json

{
  "title": "Automate invoice validation",
  "body": "...",
  "assignee": "coding",
  "status": "triage",
  "priority": 10,
  "tenant": "ideai",
  "parents": []
}
```

Server behavior:

- Generate ID: `t_` + 8 lowercase hex chars.
- Insert into `tasks`.
- Insert `task_events` row: `kind='created'`.
- Insert `task_links` for any parents.
- Return created task.

#### Patch task

```http
PATCH /api/kanban/tasks/{id}
Content-Type: application/json

{
  "title": "New title",
  "body": "new body",
  "assignee": "coding",
  "status": "ready",
  "priority": 10
}
```

Server behavior:

- Validate task exists.
- Validate status belongs to allowed status set.
- Update only provided fields.
- Insert `task_events` row with changed fields.
- Return updated task.

#### Add comment

```http
POST /api/kanban/tasks/{id}/comments
Content-Type: application/json

{
  "author": "arya",
  "body": "Need scope narrowed."
}
```

Server behavior:

- Insert `task_comments`.
- Insert `task_events` row: `kind='comment_added'`.
- Return comment.

#### SSE stream

```http
GET /api/kanban/stream
```

Events:

```text
event: task_created
data: {"task_id":"t_12345678"}

event: task_updated
data: {"task_id":"t_12345678","event_id":42}

event: comment_added
data: {"task_id":"t_12345678","comment_id":7}
```

Implementation:

- Poll every 2 seconds.
- Track max `task_events.id` and max `task_comments.id`.
- Emit deltas.
- Keep connection alive with heartbeat event every 30 seconds.

### 4.4 Safety rules

- Browser never touches SQLite.
- API shim must use parameterized SQL only.
- API shim should not manipulate `claim_lock`, `claim_expires`, or `current_run_id` except read-only.
- API shim should not mark running tasks done. Worker completion remains Kanban kernel job.
- Writes must create `task_events` rows so UI timeline stays accurate.

### 4.5 Backend verification

Run:

```bash
curl -s http://localhost:8645/health
```

Expected:

```json
{"status":"ok"}
```

Run:

```bash
curl -s http://localhost:8645/api/kanban/tasks | jq '.tasks | length'
```

Expected:

```text
<number >= 0>
```

Create test task:

```bash
curl -s -X POST http://localhost:8645/api/kanban/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"IdeAI shim smoke test","assignee":"coding","status":"triage","priority":1,"tenant":"ideai"}' | jq
```

Expected:

- JSON response contains `id` like `t_abcdefgh`.
- `hermes kanban list` or `kanban_list` can see task.

Patch test:

```bash
curl -s -X PATCH http://localhost:8645/api/kanban/tasks/<id> \
  -H 'Content-Type: application/json' \
  -d '{"status":"todo"}' | jq '.task.status'
```

Expected:

```json
"todo"
```

---

## 5. Frontend: Kanban Adapter

### 5.1 Create file

```text
/Users/eliserver/ideai/src/lib/kanban.ts
```

### 5.2 Exports

```ts
import type { ActivityItem, Assignee, Priority, Stage, Ticket } from "../types";

export type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "scheduled"
  | "done"
  | "archived";

export type KanbanTask = {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  created_at: number;
  completed_at?: number | null;
};

export async function fetchTickets(): Promise<Ticket[]>;
export async function fetchTicket(id: string): Promise<Ticket>;
export async function createTicket(input: Partial<Ticket>): Promise<Ticket>;
export async function updateTicket(id: string, patch: Partial<Ticket>): Promise<Ticket>;
export async function moveTicket(id: string, stage: Stage): Promise<Ticket>;
export async function addComment(taskId: string, author: string, body: string): Promise<void>;
export async function getTaskTimeline(taskId: string): Promise<TimelineItem[]>;
export function subscribeToKanbanEvents(onEvent: (event: KanbanEvent) => void): () => void;
```

### 5.3 API base

```ts
const API_BASE = import.meta.env.VITE_KANBAN_API ?? "http://localhost:8645";
```

### 5.4 Mapping functions

Implement:

```ts
export function stageToStatus(stage: Stage): KanbanStatus;
export function statusToStage(status: KanbanStatus, bodyStage?: Stage): Stage;
export function priorityToInt(priority: Priority): number;
export function intToPriority(priority: number): Priority;
export function ticketToTaskInput(ticket: Partial<Ticket>): CreateTaskInput;
export function taskToTicket(task: KanbanTask): Ticket;
```

Parsing rules:

1. Try `JSON.parse(task.body)`.
2. If parsed object has `ideai`, use it.
3. Else use fallback defaults:

```ts
{
  code: task.id,
  stage: statusToStage(task.status),
  division: "Unknown",
  service: "Unknown",
  priority: intToPriority(task.priority),
  currentProcess: "—",
  requestDetail: task.body ?? "—",
  businessImpact: "—",
  successMetric: "—",
  attachments: [],
  assignee: profileToHuman(task.assignee),
  createdAt: new Date(task.created_at * 1000).toISOString(),
  activity: [],
}
```

### 5.5 Error handling

Create typed error:

```ts
export class KanbanApiError extends Error {
  status: number;
  responseText: string;
}
```

Rules:

- API unreachable: show banner: `Kanban API unavailable. Showing cached data if available.`
- HTTP 4xx: show toast with server message.
- HTTP 5xx: show toast and preserve previous state.
- Never silently fall back to localStorage after API mode starts.

---

## 6. Frontend: Replace LocalStorage State

### 6.1 Modify `src/App.tsx`

Remove imports:

```ts
STORAGE_KEY
SEED_TICKETS
```

Add imports:

```ts
import {
  fetchTickets,
  createTicket,
  moveTicket,
  updateTicket,
  subscribeToKanbanEvents,
} from "./lib/kanban";
```

### 6.2 State initialization

Replace:

```ts
const [tickets, setTickets] = useState<Ticket[]>(() => loadInitialTickets());
```

With:

```ts
const [tickets, setTickets] = useState<Ticket[]>([]);
const [loadingTickets, setLoadingTickets] = useState(true);
const [apiError, setApiError] = useState<string | null>(null);
```

Remove `loadInitialTickets()` unless kept only for development seed import.

### 6.3 Initial fetch

Add:

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    setLoadingTickets(true);
    setApiError(null);
    try {
      const next = await fetchTickets();
      if (!cancelled) setTickets(next);
    } catch (error) {
      if (!cancelled) setApiError(error instanceof Error ? error.message : "Failed to load tickets");
    } finally {
      if (!cancelled) setLoadingTickets(false);
    }
  }

  void load();
  return () => {
    cancelled = true;
  };
}, []);
```

### 6.4 Remove localStorage persistence

Delete:

```ts
useEffect(() => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}, [tickets]);
```

### 6.5 SSE subscription

Add:

```ts
useEffect(() => {
  return subscribeToKanbanEvents(async () => {
    try {
      const next = await fetchTickets();
      setTickets(next);
    } catch {
      // Keep current state. Avoid UI flicker.
    }
  });
}, []);
```

Later optimization: fetch only affected task by ID.

---

## 7. Frontend: Issue Page

### 7.1 Create files

```text
/Users/eliserver/ideai/src/pages/IssuePage.tsx
/Users/eliserver/ideai/src/pages/IssuePage.css
```

If project avoids per-page CSS, append styles to existing `styles.css` instead.

### 7.2 Hash router

Add route state in `App.tsx`:

```ts
type Route =
  | { name: "board" }
  | { name: "intake" }
  | { name: "task"; id: string };

function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/tasks\/(.+)$/);
  if (match) return { name: "task", id: decodeURIComponent(match[1]) };
  if (hash === "#/intake") return { name: "intake" };
  return { name: "board" };
}
```

Use `hashchange` listener:

```ts
const [route, setRoute] = useState<Route>(() => parseRoute());

useEffect(() => {
  const onHashChange = () => setRoute(parseRoute());
  window.addEventListener("hashchange", onHashChange);
  return () => window.removeEventListener("hashchange", onHashChange);
}, []);
```

Navigation helpers:

```ts
function goBoard() {
  window.location.hash = "#/";
}

function goIntake() {
  window.location.hash = "#/intake";
}

function goTask(id: string) {
  window.location.hash = `#/tasks/${encodeURIComponent(id)}`;
}
```

### 7.3 Card click behavior

Replace drawer open:

```ts
setSelectedId(ticket.id);
```

With:

```ts
goTask(ticket.id);
```

Keep drawer code temporarily behind feature flag if needed, but final v1 should use IssuePage as primary detail UI.

### 7.4 IssuePage props

```ts
type IssuePageProps = {
  taskId: string;
  onBack: () => void;
};
```

### 7.5 IssuePage behavior

On mount:

```ts
const ticket = await fetchTicket(taskId);
const timeline = await getTaskTimeline(taskId);
```

Render states:

- loading skeleton
- 404 state if task missing
- error state with retry button
- normal issue page

### 7.6 Timeline model

```ts
type TimelineItem = {
  id: string;
  type: "comment" | "event" | "run";
  title: string;
  body: string;
  author?: string;
  createdAt: string;
  status?: string;
};
```

Sort newest last for GitHub-like vertical timeline, or newest first if matching current IdeAI activity style. Pick GitHub-like: oldest at top, comment box at bottom.

### 7.7 Issue page layout

Required sections:

1. Header
   - back button
   - issue code/task id
   - title
   - status badge
2. Main body
   - current process
   - request detail
   - business impact
   - success metric
   - attachments list
3. Sidebar
   - assignee
   - priority
   - stage dropdown
   - division
   - service
   - created time
4. Timeline
   - comments
   - status changes
   - worker runs
   - blueprint child task creation
5. Comment editor
   - textarea
   - submit button

### 7.8 IssuePage acceptance

- URL `#/tasks/{id}` opens issue page.
- Back button returns to board.
- Stage dropdown updates backend.
- Comments persist in `task_comments`.
- Worker runs display from `task_runs`.
- Events display from `task_events`.
- Invalid task id shows 404, not blank page.

---

## 8. Intake → Blueprint Webhook

### 8.1 Create webhook subscription

Run:

```bash
hermes -p shiro webhook subscribe ideai-intake \
  --prompt "New IdeAI intake request:\n\nTitle: {title}\nDivision: {division}\nService: {service}\nPriority: {priority}\nCurrent Process: {currentProcess}\nRequest Detail: {requestDetail}\nBusiness Impact: {businessImpact}\nSuccess Metric: {successMetric}\nAttachments: {attachments}\nParent task id: {taskId}\n\nUse project-blueprinting. Create executable Hermes kanban child tasks linked to the parent task. Include assignee, dependencies, acceptance criteria, risks, and verification steps. Keep parent task as blueprint issue." \
  --skills "project-blueprinting" \
  --description "IdeAI intake form to Hermes blueprint decomposition"
```

Verify:

```bash
hermes -p shiro webhook list
```

Expected:

```text
ideai-intake
```

### 8.2 Frontend webhook env

Create:

```text
/Users/eliserver/ideai/.env.local
```

Content:

```bash
VITE_KANBAN_API=http://localhost:8645
VITE_IDEAI_WEBHOOK_URL=http://localhost:8644/webhooks/ideai-intake
```

Do not commit secrets.

### 8.3 Intake submit flow

Modify `handleSubmit()`:

1. Validate form.
2. Build `Ticket` draft.
3. Call `createTicket(draft)`.
4. Add returned ticket to local state.
5. Fire webhook with returned task ID.
6. Navigate to issue page for created task.
7. Show toast.

Pseudo-flow:

```ts
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  // existing validation

  const draft = buildTicketDraftFromForm(form);

  try {
    const created = await createTicket(draft);
    setTickets((current) => [created, ...current]);
    setForm(createEmptyForm());
    setToast("Request created. Blueprint run started.");
    goTask(created.id);

    void triggerBlueprintWebhook(created).catch(() => {
      setToast("Request created. Blueprint webhook failed.");
    });
  } catch (error) {
    setToast(error instanceof Error ? error.message : "Failed to create request");
  }
}
```

Webhook payload:

```ts
{
  taskId: created.id,
  title: created.title,
  division: created.division,
  service: created.service,
  priority: created.priority,
  currentProcess: created.currentProcess,
  requestDetail: created.requestDetail,
  businessImpact: created.businessImpact,
  successMetric: created.successMetric,
  attachments: created.attachments,
}
```

### 8.4 Webhook failure policy

Webhook is enhancement, not primary persistence path.

- If task creation succeeds but webhook fails: keep task, show warning toast.
- If task creation fails: do not call webhook.
- If webhook duplicates: use task id in prompt so blueprint worker can avoid duplicate child tasks.

---

## 9. Stage Drag / Stage Change

Current app has no true drag/drop shown in inspected lines. It has:

- Shift-click advance in `handleCardClick(ticket, advanceStage = false)`
- Drawer save via `handleSaveDrawer()`

V1 should wire both to backend.

### 9.1 Shift-click advance

Current code updates local state only.

Replace local-only update with optimistic wrapper:

```ts
async function advanceTicketStage(ticket: Ticket) {
  const currentIndex = STAGES.indexOf(ticket.stage);
  if (currentIndex >= STAGES.length - 1) {
    setToast("Already in final stage");
    return;
  }

  const nextStage = STAGES[currentIndex + 1];
  const previous = tickets;

  setTickets((current) =>
    current.map((item) => (item.id === ticket.id ? { ...item, stage: nextStage } : item)),
  );

  try {
    const updated = await moveTicket(ticket.id, nextStage);
    setTickets((current) => current.map((item) => (item.id === ticket.id ? updated : item)));
    setToast(`${ticket.title}: ${ticket.stage} → ${nextStage}`);
  } catch (error) {
    setTickets(previous);
    setToast(error instanceof Error ? error.message : "Failed to move ticket");
  }
}
```

### 9.2 Drawer save

If drawer remains:

- Stage changes call `updateTicket()`.
- Assignee changes call `updateTicket()`.
- Note changes call `addComment()` or update body notes.

Better v1 path: replace drawer with IssuePage and remove drawer after IssuePage ships.

### 9.3 Real drag/drop later

If adding real drag/drop:

- Use native pointer events first; avoid dependency unless needed.
- `onDragStart` records `ticket.id`.
- `onDrop` gets destination stage.
- Same optimistic `moveTicket()` flow.

Rules:

- Same-stage drop: no-op.
- API failure: revert.
- Rapid drags: last write wins only after prior request settles, or disable card while moving.
- SSE update during move: if local optimistic flag exists, ignore SSE for that task until request settles.

---

## 10. Attachments

### 10.1 V1 behavior

Keep current string-list attachments:

```ts
attachments: string[]
```

Store them in `body.ideai.attachments`.

Render as chips on issue page.

### 10.2 V2 upload endpoint

Later add:

```http
POST /api/kanban/tasks/{id}/attachments
Content-Type: multipart/form-data
```

Storage:

```text
/Users/eliserver/.hermes/kanban-attachments/{task_id}/{safe_filename}
```

Return:

```json
{
  "filename": "audit_sample.xlsx",
  "stored_path": "/Users/eliserver/.hermes/kanban-attachments/t_123/audit_sample.xlsx",
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size": 12345
}
```

Security:

- Sanitize filenames.
- Reject path traversal.
- Cap file size.
- Allow only local development unless auth exists.

---

## 11. Auth and Exposure

V1 local-only:

- `kanban-api` binds `127.0.0.1:8645`.
- IdeAI dev server runs local.
- No public exposure.

If exposed via Cloudflare Tunnel later:

- Add bearer token auth to kanban-api.
- Put token in server-side proxy, not browser, if possible.
- Or protect with Cloudflare Access.
- Do not expose `PATCH /api/kanban/tasks/{id}` unauthenticated.

Suggested local token env for v1.5:

```bash
KANBAN_API_TOKEN=<random>
VITE_KANBAN_API_TOKEN=<same random for local dev only>
```

Request header:

```http
Authorization: Bearer <token>
```

---

## 12. Implementation Tasks

### Task 1: Build kanban API shim

**Objective:** Create FastAPI service that exposes Hermes kanban DB safely over HTTP.

**Files:**

- Create: `/Users/eliserver/.hermes/scripts/kanban-api/main.py`
- Create: `/Users/eliserver/.hermes/scripts/kanban-api/requirements.txt`
- Create: `/Users/eliserver/.hermes/scripts/kanban-api/run.sh`
- Create: `/Users/eliserver/.hermes/scripts/kanban-api/README.md`

**Steps:**

1. Create project directory.
2. Add dependencies.
3. Implement DB connection helper.
4. Implement task row serialization.
5. Implement `GET /health`.
6. Implement `GET /api/kanban/tasks`.
7. Implement `GET /api/kanban/tasks/{id}`.
8. Implement `POST /api/kanban/tasks`.
9. Implement `PATCH /api/kanban/tasks/{id}`.
10. Implement comment endpoints.
11. Implement events/runs endpoints.
12. Implement SSE stream.
13. Add CORS middleware.
14. Run curl smoke tests.

**Verification:**

```bash
curl -s http://localhost:8645/health
curl -s http://localhost:8645/api/kanban/tasks | jq
```

Expected: 200 responses with real data.

---

### Task 2: Add frontend kanban adapter

**Objective:** Create TypeScript adapter that maps Hermes tasks to IdeAI tickets.

**Files:**

- Create: `/Users/eliserver/ideai/src/lib/kanban.ts`
- Modify: `/Users/eliserver/ideai/src/types.ts` if extra shared types needed

**Steps:**

1. Define `KanbanTask`, `KanbanStatus`, `TimelineItem`, `KanbanEvent` types.
2. Add `API_BASE` env support.
3. Add `requestJson()` helper.
4. Add stage/status mapping.
5. Add priority mapping.
6. Add assignee mapping.
7. Add `parseTaskBody()`.
8. Add `buildTaskBody()`.
9. Add `taskToTicket()`.
10. Add `ticketToTaskInput()`.
11. Add CRUD functions.
12. Add SSE subscription function.
13. Run TypeScript check.

**Verification:**

```bash
cd /Users/eliserver/ideai
npm run check
```

Expected: no TypeScript errors.

---

### Task 3: Replace localStorage board data

**Objective:** Make board load and save through kanban API.

**Files:**

- Modify: `/Users/eliserver/ideai/src/App.tsx`

**Steps:**

1. Remove `STORAGE_KEY` import.
2. Stop using `loadInitialTickets()` as primary source.
3. Initialize tickets as `[]`.
4. Add loading and API error state.
5. Fetch tickets on mount.
6. Remove localStorage persistence effect.
7. Subscribe to SSE.
8. Update empty/loading/error UI.
9. Run build.

**Verification:**

```bash
cd /Users/eliserver/ideai
npm run check
npm run build
```

Expected: no errors. Board loads real kanban tasks when shim is running.

---

### Task 4: Implement IssuePage

**Objective:** Add GitHub-style task detail page.

**Files:**

- Create: `/Users/eliserver/ideai/src/pages/IssuePage.tsx`
- Modify: `/Users/eliserver/ideai/src/App.tsx`
- Modify: `/Users/eliserver/ideai/styles.css` or create page CSS

**Steps:**

1. Add hash route parser.
2. Add route state and hashchange listener.
3. Add navigation helpers.
4. Change card click to navigate to `#/tasks/{id}`.
5. Create IssuePage component.
6. Fetch ticket detail and timeline.
7. Render metadata sidebar.
8. Render issue body.
9. Render comments/events/runs timeline.
10. Add comment form.
11. Add stage dropdown.
12. Wire comment submit.
13. Wire stage update.
14. Style page to match current dark theme.

**Verification:**

```bash
cd /Users/eliserver/ideai
npm run check
npm run build
npm run dev
```

Manual checks:

- Open board.
- Click ticket.
- URL changes to `#/tasks/{id}`.
- Page renders detail.
- Back returns to board.
- Comment persists.
- Stage change persists.

---

### Task 5: Wire intake form to API and webhook

**Objective:** Intake creates kanban task and triggers blueprint automation.

**Files:**

- Modify: `/Users/eliserver/ideai/src/App.tsx`
- Create/modify: `/Users/eliserver/ideai/.env.local` (local only)

**Steps:**

1. Create webhook subscription `ideai-intake`.
2. Add `VITE_IDEAI_WEBHOOK_URL`.
3. Extract form-to-ticket builder function.
4. Change `handleSubmit()` to async.
5. Call `createTicket()`.
6. Update local state with returned ticket.
7. Fire webhook payload.
8. Navigate to issue page.
9. Add error handling.

**Verification:**

```bash
hermes -p shiro webhook list
```

Expected: `ideai-intake` appears.

Manual:

- Submit intake form.
- New task appears in kanban DB.
- Webhook run starts in Shiro gateway logs.
- Child tasks appear after blueprint run completes.

---

### Task 6: Wire stage movement to PATCH

**Objective:** Stage changes persist to Hermes kanban.

**Files:**

- Modify: `/Users/eliserver/ideai/src/App.tsx`
- Possibly modify: `/Users/eliserver/ideai/src/pages/IssuePage.tsx`

**Steps:**

1. Replace Shift-click local advance with `moveTicket()`.
2. Replace drawer save stage update with `updateTicket()` or remove drawer.
3. Add optimistic update helper.
4. Add revert-on-failure behavior.
5. Prevent duplicate same-stage calls.
6. Test SSE reconciliation.

**Verification:**

- Move ticket from `Issue Request` to `Review`.
- Run:

```bash
sqlite3 /Users/eliserver/.hermes/kanban.db "select id,status from tasks where id='<id>';"
```

Expected: status changed according to mapping.

---

### Task 7: Add launch/persistence for kanban API shim

**Objective:** Make API shim easy to start and optionally persistent.

**Files:**

- Create: `/Users/eliserver/Library/LaunchAgents/ai.hermes.kanban-api.plist` if persistence desired
- Modify: `/Users/eliserver/.hermes/scripts/kanban-api/README.md`

**Steps:**

1. Write `run.sh`.
2. Test foreground run.
3. Add launchd plist if stable.
4. Load service.
5. Verify port 8645.

**Verification:**

```bash
lsof -nP -iTCP:8645 -sTCP:LISTEN
curl -s http://localhost:8645/health
```

Expected: API listening and healthy.

---

### Task 8: End-to-end verification

**Objective:** Prove full flow works.

**Steps:**

1. Start Shiro gateway:

```bash
hermes -p shiro gateway status
```

2. Start kanban API:

```bash
curl -s http://localhost:8645/health
```

3. Start IdeAI:

```bash
cd /Users/eliserver/ideai
npm run dev
```

4. Open app.
5. Submit intake request.
6. Confirm task exists in board.
7. Open task issue page.
8. Add comment.
9. Change stage.
10. Confirm DB status changed.
11. Confirm webhook run started.
12. Confirm child tasks linked to parent.
13. Run build:

```bash
npm run check
npm run build
```

**Acceptance:**

- Board loads from Hermes kanban.
- Intake persists to Hermes kanban.
- Issue page displays comments/events/runs.
- Stage changes persist.
- Blueprint webhook triggers agent run.
- No TypeScript errors.
- No browser console errors.

---

## 13. Risks and Mitigations

### R1. SQLite corruption or dispatcher race

Risk: External API writes dispatcher-owned fields.

Mitigation:

- API shim writes only safe fields.
- Never touch `claim_lock`, `claim_expires`, `current_run_id`, `worker_pid`.
- Use parameterized SQL.
- Write events for every mutation.

### R2. Stage/status mismatch

Risk: IdeAI stage model differs from Hermes dispatcher status model.

Mitigation:

- Preserve IdeAI stage in `body.ideai.stage`.
- Map Hermes status for dispatcher only.
- Render warning when mismatch detected.

### R3. Webhook duplicates child tasks

Risk: User submits same intake twice or webhook retries.

Mitigation:

- Include parent `taskId` in webhook payload.
- Blueprint prompt must check existing children first.
- Later add idempotency key to child task creation.

### R4. Local dev ports collide

Risk: 8644/8645 already used.

Mitigation:

- Gateway uses 8644.
- API shim uses 8645.
- Both configurable via env.
- Verify with `lsof` before start.

### R5. Auth missing if exposed publicly

Risk: Anyone can mutate kanban tasks.

Mitigation:

- V1 binds kanban API to `127.0.0.1`.
- Do not expose 8645 through Cloudflare until auth exists.
- If public exposure needed, add bearer auth or Cloudflare Access first.

### R6. Existing App.tsx is monolithic

Risk: Large edits break UI.

Mitigation:

- Add adapter first.
- Replace data path second.
- Add IssuePage third.
- Remove drawer only after IssuePage works.
- Run `npm run check` after each task.

---

## 14. Final Definition of Done

Implementation is done only when all are true:

1. `curl http://localhost:8645/health` returns OK.
2. `curl http://localhost:8645/api/kanban/tasks` returns real kanban tasks.
3. IdeAI board loads from kanban API, not localStorage.
4. New intake creates `tasks` row in `/Users/eliserver/.hermes/kanban.db`.
5. Intake fires `POST /webhooks/ideai-intake` on Shiro gateway.
6. Blueprint run creates linked child tasks.
7. Clicking card opens `#/tasks/{id}`.
8. Issue page shows body, metadata, comments, events, runs.
9. Comment submit writes to `task_comments`.
10. Stage change writes to `tasks.status` and `task_events`.
11. SSE refresh updates board/detail without full reload.
12. `cd /Users/eliserver/ideai && npm run check && npm run build` passes.
13. Browser console has no runtime errors during core flow.
14. Kanban API does not expose unsafe dispatcher fields for mutation.

---

## 15. Recommended Execution Order

Run in this order:

```text
1. T1 kanban-api shim
2. T2 kanban.ts adapter
3. T3 replace localStorage data path
4. T4 IssuePage route + detail UI
5. T5 intake → create task + webhook
6. T6 stage movement → PATCH
7. T7 persistence/launchd for API shim
8. T8 end-to-end verification
```

Parallelization:

```text
After T1:
  T2 can start.

After T2:
  T3 must happen before T4/T5/T6.

After T3:
  T4, T5, T6 can run in parallel if implementers coordinate around App.tsx.

T8 waits for all.
```

Preferred safer sequencing because `App.tsx` is large:

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

Less parallel. Fewer merge conflicts. Better board position.

---

## 16. Notes for Future Maintainers

- IdeAI is product UI. Hermes kanban is source of truth.
- Browser must never read SQLite directly.
- Webhook is for asynchronous automation. REST API is for synchronous UI actions.
- Run history is not noise. It is the reason this should feel better than GitHub issues.
- Keep Hermes worker lifecycle fields read-only.
- Keep `body.ideai` structured enough for UI, but keep `body.markdown` useful for humans and agents.
- If this becomes public-facing, auth comes before tunnel exposure. Not after.

...Blank does not lose to localStorage.
