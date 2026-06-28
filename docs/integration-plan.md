# ideai ↔ Hermes Kanban Integration Plan

## Problem statement

ideai currently acts like local mock “OpsFlow” intake board:

- tickets live in React localStorage
- stages are UI-only
- issue drawer is not real GitHub-like issue page
- no durable sync with Hermes Kanban
- no deployed artifact/page link per ticket

Target: ideai becomes frontend for Hermes Kanban tasks, shaped like GitHub Issues:

- board view like Hermes Kanban
- issue detail page like GitHub issue page
- comments, events, runs, attachments visible
- intake creates real Hermes Kanban task
- stage drag/update mutates real Kanban task
- deployed page/artifact link appears on issue page once task produces it

Kanban DB stays source of truth. No fake state.

---

## 1. Load-bearing decisions

### Decision 1 — Source of truth

Options:

A. ideai owns tickets, syncs to Kanban later  
B. Hermes Kanban owns tasks, ideai renders adapter view  
C. Dual-write both

Pick: B.

Reason: Hermes Kanban already owns lifecycle, assignee, status, comments, runs, attachments, task links, workspaces, dispatcher state. ideai should not invent parallel truth.

Change decision if: ideai must support offline-first workflows. Then local queue + replay needed.

### Decision 2 — API layer

Options:

A. Frontend reads SQLite directly  
B. Hermes Gateway exposes Kanban API  
C. Separate FastAPI shim reads Kanban DB  
D. Add direct core Hermes API

Pick: C first, then B later.

Reason: FastAPI shim fastest, low risk, no Hermes core mutation. Later can fold into Hermes Gateway plugin if stable.

Shape:

- `kanban-api` service at `~/.hermes/scripts/kanban-api/`
- reads `/Users/eliserver/.hermes/kanban.db`
- exposes REST + SSE
- ideai talks HTTP only

Change decision if: Hermes already has stable Kanban HTTP endpoints. Then reuse them.

### Decision 3 — Stage model

Hermes Kanban statuses:

- `triage`
- `todo`
- `ready`
- `running`
- `blocked`
- `done`
- `archived`

ideai stages:

- `Issue Request`
- `Review`
- `Revision`
- `Production`
- `Testing`
- `Deployment`

Pick mapping layer, not DB schema change.

Initial mapping:

| ideai Stage | Kanban status | Meaning |
|---|---|---|
| Issue Request | triage | Intake created, not yet accepted |
| Review | todo / ready | Spec reviewed, waiting dependency / dispatch |
| Revision | blocked | Needs human/subagent revision |
| Production | running | Worker executing |
| Testing | done with review-required marker OR child QA task active | Built, under validation |
| Deployment | done | Accepted/deployed/complete |
| Archived | archived | Hidden/closed |

Better exact mapping:

- board should display Hermes native status chips
- ideai can group statuses into human labels

Avoid forcing Kanban into business workflow too hard. It will crack.

### Decision 4 — GitHub issue page shape

Pick GitHub issue metaphor, not clone.

Page sections:

- Header: title, ticket code, status, priority, assignee
- Body: original request / blueprint / acceptance criteria
- Timeline:
  - comments
  - task events
  - run starts/stops
  - blocked reasons
  - completions
  - attachments
  - deployment events
- Sidebar:
  - assignee
  - status/stage
  - parents/children
  - workspace path
  - profile
  - priority
  - created/completed timestamps
  - deployment URL
- Action bar:
  - comment
  - change status
  - upload attachment
  - create child task
  - copy issue URL
  - open deployed page

### Decision 5 — Deployed page association

Options:

A. Detect URL from run summary text  
B. Store deployment URL in task metadata  
C. Create separate deployment table  
D. Attach deployment artifact file

Pick: B plus fallback A.

Canonical metadata shape:

```json
{
  "deployment": {
    "url": "https://example.aryahanif.xyz",
    "environment": "production",
    "provider": "cloudflare-tunnel",
    "deployed_at": 1780000000,
    "commit": "optional",
    "healthcheck_url": "https://example.aryahanif.xyz/health"
  }
}
```

Fallback:

- regex scan task result/run summaries/comments for `https://...`
- show as “Detected link”, not canonical

Later:

- dedicated `task_deployments` table if multiple deployments per task become normal

---

## 2. Architecture overview

```text
                ┌───────────────────────────┐
                │        ideai React UI       │
                │  Board + Issue Page + Form │
                └─────────────┬─────────────┘
                              │ HTTP/SSE
                              ▼
                ┌───────────────────────────┐
                │      kanban-api shim       │
                │ FastAPI / Pydantic / SSE   │
                └─────────────┬─────────────┘
                              │ sqlite
                              ▼
                ┌───────────────────────────┐
                │   Hermes Kanban SQLite     │
                │ tasks/comments/events/runs │
                │ links/attachments          │
                └─────────────┬─────────────┘
                              │ dispatcher
                              ▼
                ┌───────────────────────────┐
                │    Hermes workers/gateway  │
                │ execute tasks, comment,    │
                │ attach artifacts, complete │
                └───────────────────────────┘
```

Frontend data flow:

```text
GET /api/kanban/tasks
  → board columns

GET /api/kanban/tasks/:id
  → issue detail

GET /api/kanban/tasks/:id/timeline
  → comments + events + runs + attachments

POST /api/kanban/tasks
  → intake creates Kanban task

PATCH /api/kanban/tasks/:id
  → status/stage/assignee/priority update

POST /api/kanban/tasks/:id/comments
  → issue comment

POST /api/kanban/tasks/:id/attachments
  → upload artifact/input file

GET /api/kanban/events/stream
  → live board refresh
```

---

## 3. Data contracts

Backend API models:

```ts
type KanbanIssue = {
  id: string;
  number: string;
  title: string;
  body: string;
  status: KanbanStatus;
  stage: IdeaiStage;
  priority: number;
  assignee: string | null;
  createdBy: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  tenant: string | null;
  workspaceKind: string;
  workspacePath: string | null;
  currentRunId: number | null;
  parents: string[];
  children: string[];
  parentCount: number;
  childCount: number;
  skills: string[];
  metadata: Record<string, unknown>;
  deployment: DeploymentLink | null;
};

type TimelineItem =
  | {
      type: "comment";
      id: number;
      author: string;
      body: string;
      createdAt: number;
    }
  | {
      type: "event";
      id: number;
      kind: string;
      payload: unknown;
      createdAt: number;
    }
  | {
      type: "run";
      id: number;
      profile: string | null;
      status: string;
      outcome: string | null;
      summary: string | null;
      metadata: unknown;
      error: string | null;
      startedAt: number;
      endedAt: number | null;
    }
  | {
      type: "attachment";
      id: number;
      filename: string;
      contentType: string | null;
      size: number;
      uploadedBy: string | null;
      createdAt: number;
      url: string;
    };

type DeploymentLink = {
  url: string;
  environment: string | null;
  provider: string | null;
  deployedAt: number | null;
  healthcheckUrl: string | null;
  source: "metadata" | "detected" | "attachment";
};
```

Kanban DB tables used:

- `tasks`
- `task_links`
- `task_comments`
- `task_events`
- `task_runs`
- `task_attachments`
- `kanban_notify_subs` optional, read-only

No schema change required for MVP.

---

## 4. UI plan

Pages:

```text
/                         Board
/issues                   Same as board/list hybrid
/issues/:id               GitHub-like issue detail
/new                      Intake form
/deployments              Optional deployment index later
```

Board view columns:

- Intake
- Ready
- Running
- Blocked
- Testing / Review
- Done
- Archived hidden by default

Card fields:

- title
- issue code
- status chip
- assignee
- priority
- comment count
- run state
- deployment icon if URL exists
- blocked badge if latest run outcome = blocked

Board actions:

- drag between columns
- click opens `/issues/:id`
- quick filter by assignee/status/tenant
- search title/body/comments
- refresh live via SSE

Issue detail page structure:

```text
Title row:
  [status chip] Task title #KB-xxxx

Main left:
  Body card
  Blueprint/acceptance section
  Timeline
    Comment
    Event
    Run summary
    Attachment
    Deployment detected
  Comment composer

Right sidebar:
  Assignee
  Status
  Priority
  Parents
  Children
  Workspace
  Skills
  Current run
  Deployment
  Created/completed
```

Deployment panel behavior:

- If deployment URL exists:
  - show “Open deployed page”
  - show health check status if available
  - embed preview iframe only for trusted domains (`*.aryahanif.xyz`, localhost configured)
- If absent:
  - show “No deployment recorded”
  - show detected candidate links from comments/runs as secondary

Attachment behavior:

- input attachments from intake
- output artifacts from workers
- downloadable through `/api/kanban/attachments/:id`

---

## 5. Backend plan: kanban-api shim

Location:

```text
~/.hermes/scripts/kanban-api/
```

Files:

```text
app.py
models.py
db.py
mapping.py
attachments.py
sse.py
config.py
requirements.txt
README.md
```

Core endpoints:

```http
GET /health
GET /api/kanban/tasks
GET /api/kanban/tasks/{task_id}
GET /api/kanban/tasks/{task_id}/timeline
POST /api/kanban/tasks
PATCH /api/kanban/tasks/{task_id}
POST /api/kanban/tasks/{task_id}/comments
POST /api/kanban/tasks/{task_id}/attachments
GET /api/kanban/attachments/{attachment_id}
GET /api/kanban/events/stream
```

Intake endpoint:

```http
POST /webhooks/ideai-intake
```

Why both `/api` and `/webhooks`:

- `/api` = synchronous UI operations
- `/webhooks` = external intake / automation, may later trigger blueprinting

DB access:

- SQLite read/write with short transactions
- WAL mode recommended
- no raw SQL from user input
- status transitions validated

Config:

```env
KANBAN_DB=/Users/eliserver/.hermes/kanban.db
KANBAN_ATTACHMENTS_DIR=/Users/eliserver/.hermes/kanban/attachments
KANBAN_API_HOST=127.0.0.1
KANBAN_API_PORT=8765
KANBAN_API_TOKEN=***
IDEAI_ALLOWED_ORIGINS=http://localhost:5173,https://ideai.aryahanif.xyz
```

Auth:

- MVP local token header:

```http
Authorization: Bearer ***
```

- Later: Hermes Gateway auth/session token

---

## 6. Status transition rules

Safe transitions:

```text
triage -> todo
todo -> ready
ready -> running
running -> blocked
running -> done
blocked -> ready
done -> archived
archived -> todo
```

UI drag mapping:

- Drag to Intake → `triage`
- Drag to Review → `todo`
- Drag to Build → `ready`
- Drag to Production → only if dispatcher/worker owns it; prefer disable manual running
- Drag to Revision → `blocked` with comment required
- Drag to Deployment → `done` with completion note required

Important: manual `running` is dangerous. It lies about dispatcher state.

UI should not let humans set `running` unless advanced override enabled.

---

## 7. Intake-to-task mapping

ideai form fields map to Kanban `tasks`:

```text
title              -> tasks.title
requestDetail      -> tasks.body
priority           -> tasks.priority
division/service   -> body frontmatter or metadata
attachments        -> task_attachments
assignee           -> tasks.assignee
stage              -> tasks.status = triage
created_by         -> "ideai"
tenant             -> optional division/service normalized
skills             -> optional JSON
```

Body template:

```md
# Intake Request

Division: MPO Finance
Service: Invoice Reconciliation
Priority: High
Requester: ...

## Current process
...

## Request detail
...

## Business impact
...

## Success metric
...

## Acceptance criteria
- ...
```

Metadata note:

Kanban `tasks` table has no metadata column. MVP stores structured fields inside body frontmatter:

```md
---
source: ideai
division: MPO Finance
service: Invoice Reconciliation
priority_label: High
success_metric: ...
---
```

Run metadata already exists in `task_runs.metadata`.

Future schema:

- add `task_metadata(task_id, key, value_json)` or `tasks.extra_json`

Not MVP unless needed.

---

## 8. Deployment URL plan

MVP rules:

1. Read latest `task_runs.metadata.deployment.url`
2. If missing, scan all run metadata for deployment URL
3. If missing, scan comments/events/summaries for URL
4. If missing, scan attachments with `content_type=text/html` or filename `deployment.json`

Worker convention:

Subagents completing deployment tasks should write:

```json
{
  "deployment": {
    "url": "https://name.aryahanif.xyz",
    "environment": "production",
    "provider": "cloudflare-tunnel",
    "healthcheck_url": "https://name.aryahanif.xyz/health"
  }
}
```

Issue page displays:

- canonical deployment
- latest deployment event
- health badge: unknown / healthy / failing
- “Open deployed page”

Optional later:

- preview iframe
- screenshot thumbnail generated by Playwright
- deployment history timeline

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Wrong Kanban DB path | High | High | Use explicit `/Users/eliserver/.hermes/kanban.db`; never profile-home zero-byte DB |
| UI mutates dispatcher-owned state incorrectly | High | High | Validate transitions; block manual `running`; require comments for blocked/done |
| SQLite lock contention | Medium | Medium | WAL mode, short transactions, retry busy timeout |
| ideai localStorage conflicts with API state | High | Medium | Remove localStorage as source; keep seeds only dev fallback |
| Deployment URL missing from worker output | High | Medium | Define metadata convention + fallback URL scanner |
| Attachment path traversal | Medium | High | Store files under controlled dir; sanitize filenames; serve by ID only |
| CORS/token leak | Medium | High | Localhost allowlist + bearer token; no wildcard in production |
| Timeline ordering wrong | Medium | Medium | Normalize every item to `createdAt`; stable sort by timestamp then id |
| GitHub-like UI overcomplicates MVP | Medium | Medium | Build read-only issue page first, actions second |
| Kanban status semantics mismatch business stages | High | Medium | Keep mapping layer; show native status too |

---

## 10. Task breakdown

### TASK F1 — Kanban API shim foundation

Subagent: coding  
Required skills:

- `hermes-agent` — Kanban DB/profile/gateway conventions

Inputs:

- `/Users/eliserver/.hermes/kanban.db`
- current DB schema

Outputs:

- `~/.hermes/scripts/kanban-api/app.py`
- REST endpoints: health, tasks list, task detail
- Pydantic models

Acceptance:

- `GET /health` returns ok
- `GET /api/kanban/tasks` returns real tasks from DB
- no writes yet
- runs locally on 127.0.0.1

Dependencies: none

Risks:

- DB path confusion

### TASK F2 — Timeline API

Subagent: coding  
Required skills:

- `hermes-agent`

Inputs:

- F1 models
- `task_comments`, `task_events`, `task_runs`, `task_attachments`

Outputs:

- `GET /api/kanban/tasks/{id}/timeline`
- normalized timeline item schema

Acceptance:

- timeline merges comments/events/runs/attachments
- stable chronological order
- malformed JSON payloads do not crash API

Dependencies: F1

Risks:

- event payload JSON may be inconsistent

### TASK F3 — Write API: comments, status, intake

Subagent: coding  
Required skills:

- `hermes-agent`

Inputs:

- F1 DB layer

Outputs:

- `POST /api/kanban/tasks`
- `PATCH /api/kanban/tasks/{id}`
- `POST /api/kanban/tasks/{id}/comments`
- `POST /webhooks/ideai-intake`

Acceptance:

- creates real Kanban task
- inserts task event on mutation
- rejects illegal transitions
- requires bearer token

Dependencies: F1

Risks:

- corrupting Kanban status

### TASK F4 — Attachment API

Subagent: coding  
Required skills:

- `hermes-agent`

Inputs:

- `task_attachments` schema

Outputs:

- upload endpoint
- download endpoint
- safe storage directory

Acceptance:

- upload creates DB row
- download serves by attachment ID
- filename traversal impossible

Dependencies: F1

Risks:

- path traversal, large files

### TASK F5 — SSE live events

Subagent: coding  
Required skills:

- `hermes-agent`

Inputs:

- `task_events`

Outputs:

- `GET /api/kanban/events/stream`

Acceptance:

- board updates when comments/status/tasks change
- reconnect works with `Last-Event-ID`

Dependencies: F1/F3

Risks:

- polling load, event gaps

### TASK F6 — ideai Kanban adapter

Subagent: frontend  
Required skills:

- `frontend-design`

Inputs:

- F1 API contract
- `/Users/eliserver/ideai/src/types.ts`
- `/Users/eliserver/ideai/src/lib.ts`

Outputs:

- `src/lib/kanban.ts`
- `src/types/kanban.ts`
- adapter Ticket ↔ KanbanIssue

Acceptance:

- frontend can load real tasks
- seed/localStorage becomes dev fallback only
- stage/status mapping centralized

Dependencies: F1

Risks:

- scattered mapping logic

### TASK F7 — Board connected to API

Subagent: frontend  
Required skills:

- `frontend-design`

Inputs:

- F6 adapter
- current `src/App.tsx`

Outputs:

- board loads from API
- filters/search operate on real tasks
- card click routes to issue detail

Acceptance:

- no localStorage source of truth
- loading/error/empty states exist
- manual refresh works

Dependencies: F6

Risks:

- current `App.tsx` is 1102 lines; split before heavy edits

### TASK F8 — GitHub-like IssuePage

Subagent: frontend  
Required skills:

- `frontend-design`

Inputs:

- F2 timeline API
- F6 types

Outputs:

- `src/pages/IssuePage.tsx`
- route `/issues/:id`
- timeline components
- sidebar metadata

Acceptance:

- displays body, comments, events, runs, attachments
- displays parent/child links
- displays deployment panel
- deep link works on reload

Dependencies: F2/F6

Risks:

- GitHub clone temptation; keep usable, not pixel-perfect

### TASK F9 — Intake form posts real task

Subagent: frontend  
Required skills:

- `frontend-design`

Inputs:

- F3 intake endpoint

Outputs:

- form submits to API
- upload optional attachments
- redirects to issue page

Acceptance:

- successful intake creates real Kanban task
- failed intake preserves form state
- created issue appears on board

Dependencies: F3/F7

Risks:

- partial attachment failure

### TASK F10 — Stage drag/status mutation

Subagent: frontend  
Required skills:

- `frontend-design`

Inputs:

- F3 PATCH endpoint

Outputs:

- board drag/drop or stage selector
- optimistic update with rollback
- required comment for blocked/done transitions

Acceptance:

- illegal transitions blocked in UI and API
- mutation appears in timeline
- no manual fake running unless override

Dependencies: F3/F7/F8

Risks:

- false dispatcher state

### TASK F11 — Deployment URL extraction + display

Subagent: coding + frontend  
Required skills:

- `hermes-agent`
- `frontend-design`

Inputs:

- F2 timeline
- run metadata conventions

Outputs:

- backend deployment extractor
- frontend deployment panel

Acceptance:

- canonical metadata URL displayed
- detected URL displayed with lower confidence
- “Open deployed page” works

Dependencies: F2/F8

Risks:

- URL false positives

### TASK F12 — Deployment/runtime setup

Subagent: ops  
Required skills:

- `cloudflare-tunnel-hosting`
- `deployment-safety`

Inputs:

- kanban-api service
- ideai build

Outputs:

- launchd service or process runner for API
- Vite build/static hosting
- Cloudflare tunnel route if requested

Acceptance:

- ideai opens via stable URL
- API reachable only allowed origin/token
- health check documented

Dependencies: F1-F11

Risks:

- exposing write API publicly

### TASK F13 — End-to-end QA

Subagent: reviewer  
Required skills:

- `dogfood`

Inputs:

- deployed ideai
- API

Outputs:

- QA report
- bug list

Acceptance:

- create intake task
- view on board
- open issue page
- comment
- change stage
- upload attachment
- see timeline update
- see deployment link if metadata present

Dependencies: F12

Risks:

- happy-path only testing misses dispatcher edge cases

---

## 11. Execution order

Batch 0 — Scaffold and contract:

```text
F1
```

Review gate:

- real Kanban tasks return from API
- correct DB path verified
- no write endpoints yet

Batch 1 — Read model complete:

```text
F2 + F4
```

Review gate:

- issue detail can be powered from API
- attachments safe by ID
- no crash on malformed metadata

Batch 2 — Writes:

```text
F3
```

Review gate:

- intake creates real task
- patch inserts event
- illegal transitions rejected

Batch 3 — Frontend read integration:

```text
F6 + F7
```

Review gate:

- board renders real tasks
- localStorage not source of truth
- filters still work

Batch 4 — Issue page:

```text
F8 + F11
```

Review gate:

- GitHub-like issue detail works
- comments/events/runs/attachments visible
- deployment panel exists

Batch 5 — Mutations from UI:

```text
F9 + F10
```

Review gate:

- form creates Kanban task
- drag/status update syncs
- timeline reflects changes

Batch 6 — Deploy:

```text
F12
```

Review gate:

- ideai public/stable URL works
- API not open write surface
- token/CORS checked

Batch 7 — QA:

```text
F13
```

Review gate:

- full workflow passes
- defects filed as follow-up tasks

---

## 12. Review gates

### Gate A — API foundation

Must prove:

- DB path: `/Users/eliserver/.hermes/kanban.db`
- `tasks` count > 0
- `/api/kanban/tasks` returns same IDs as Kanban board
- no profile-home zero-byte DB used

### Gate B — Write safety

Must prove:

- invalid status rejected
- blocked requires reason/comment
- done requires completion note unless system completion
- current run not overwritten manually

### Gate C — UI truth

Must prove:

- reload preserves data because API owns it
- two browser tabs converge via SSE/refresh
- localStorage can be cleared without losing tasks

### Gate D — Issue page completeness

Must prove:

- task body visible
- comments visible
- events visible
- runs visible
- attachments visible
- parent/child links visible

### Gate E — Deployment visibility

Must prove:

- run metadata deployment URL appears
- detected URL fallback appears but marked “detected”
- no arbitrary iframe for untrusted domains

### Gate F — Production safety

Must prove:

- write API requires token
- CORS not wildcard in deployed mode
- attachment download cannot escape directory
- service restart documented

---

## 13. Skill verification before dispatch

Need verify exact assignee names before dispatch. Proposed:

```text
F1-F5: coding
  skills:
    - hermes-agent

F6-F11 frontend portions: coding or frontend profile
  skills:
    - frontend-design

F12: ops
  skills:
    - cloudflare-tunnel-hosting
    - deployment-safety

F13: reviewer or dogfood profile
  skills:
    - dogfood
```

Current known gap:

- skills exist in this profile
- target subagent skill availability must be verified before dispatch

Before dispatch:

- confirm assignee profiles
- bind skills in `kanban_create(skills=[...])`
- include “read SKILL.md before executing” in each task body

No dispatch until then.

---

## 14. Minimal MVP cut

If fastest useful version needed:

MVP = F1 + F2 + F3 + F6 + F7 + F8 + F9.

Skip initially:

- F4 attachments
- F5 SSE
- F10 drag/drop
- F11 fancy deployment detection
- F12 public deployment
- F13 full QA

MVP result:

- ideai board reads Kanban
- intake creates task
- issue page shows comments/events/runs
- deployment URL appears if already present in run metadata/body scan

Then harden.

---

## 15. Unresolved question

Should ideai write directly to Hermes Kanban through separate `kanban-api` shim first, or should this be implemented as Hermes Gateway/plugin endpoint from day one?

Recommendation:

Separate `kanban-api` shim first. Faster. Less core risk. Once stable, fold into Hermes Gateway/plugin.
