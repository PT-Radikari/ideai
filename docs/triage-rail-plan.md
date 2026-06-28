# Triage Rail — Kanban Backlog Triage UI

> **Source:** Council session 2026-06-23 (Kurisu profile, session `20260623_004238_e55ac1`).
> **Status:** Designed, not built. Recovered from session DB 2026-06-28.
> **Origin question:** "swipe left/right Tinder-style UI" to process ~50 pending Hermes Kanban tasks fast.
> **Verdict:** Swipe-cards rejected by all three Council voices. Replaced by **Triage Rail**.

---

## 1. Problem

Hermes Kanban (`~/.hermes/kanban.db`, SQLite) had ~50 pending tasks at the time of the Council:
- 25 todo
- 21 blocked
- 3 ready
- 1 running

Across 8 assignee profiles. Existing dashboard (`127.0.0.1:9119`) ships drag-drop kanban + WebSocket
live updates + multi-select. Insufficient: throughput bottleneck is *triage*, not visual overview.

Real bottleneck is **cognitive**, two factors:
1. **Decision-type context switching.** A flat list forces brain to alternate
   "unblock reasoning" → "prioritize" → "dispatch approval" every row. Hidden tax.
2. **No batch operations.** 21 blocked tasks likely cluster into 3–4 root causes
   (missing env vars, schema mismatches, dependency chains). 5x compression available.

---

## 2. What was killed (unanimous Council)

| Pattern | Why dead |
|---|---|
| Tinder swipe cards | Tasks need 30–60s decisions, not 2s flicks. Punishes thinking. Strips context blocked tasks require. Can't see cluster patterns. |
| Mobile / menubar / notifications | Board is localhost SQLite. Sync layer + push infra + auth = absurd cost for 50 tasks. Notification fatigue at 21 blockers. |
| Chat-style conversational | Adds noise, removes structure. LLM latency × 50 tasks = catastrophic throughput. |
| Voice-first | Can't reference task IDs / paths / code naturally. No visual scanning. |
| Native macOS app | Duplicates existing dashboard. Weeks of work. Code signing burden. |
| Drag-drop kanban (existing) | Already exists. Already insufficient. |

---

## 3. The pattern: Triage Rail

Status-grouped keyboard stream with inline action expansion. Not a board, not cards, not chat.
Think Superhuman's inbox grouped by status column.

```
┌─ BLOCKED (21) ───────────────────────────────────── ▼ ──┐
│ ▶ #47  DB migration failing on pg 16   [shiro]   B: schema mismatch
│   #52  Missing API key for Sentinel    [coding]  B: env var not set
│   #61  Waiting on design spec          [maomao]  B: parent #58
│  ...
├─ READY (3) ────────────────────────────────────────── ─┤
│   #51  Deploy staging build            [sebastian]    →
│   #55  Send weekly report              [shiki]        →
│   #58  Write design spec for #61       [geuse]        →
├─ TODO (25) ────────────────────────────────────────── ─┤
│   #43  Refactor auth middleware        [coding]      ⋮
│  ...
└─────────────────────────────────────────────────────────┘
```

### Interaction model

- `j` / `k` (or arrows) — move vertically. Cursor snaps within status group, wraps to next group.
- `Enter` — expand selected task **in-place** (no drawer, no modal). Shows body, comments,
  parent/child links, action row.
- Action row keys:
  - `u` — unblock (inline text field for reason, auto-suggest from blocker text)
  - `r` — reassign (inline assignee fuzzy-search, cmdk-style)
  - `c` — comment
  - `a` — archive
  - `l` — link (add parent/child dependency)
  - `d` — dispatch (ready → sub-second)
- `space` — multi-select. Bulk action applies to all selected (e.g. 5 same-root-cause blockers → one `u`).
- `cmd+k` — command palette overlay (jump to task, bulk action, filter by assignee).
- `shift+j` / `shift+k` — collapse/expand status group at boundary, move between groups.
- `f` — fuzzy filter by assignee.
- `?` — keyboard help overlay.

### Expanded card example

```
▼ #47  DB migration failing on pg 16   [shiro]
  Body: Migration 0042 assumes pg 14 syntax...
  Comments (2): sebastian: "pg_dump version mismatch"
  Links: parent #40, blocks #52 #61

  [u]nblock  [r]eassign  [c]omment  [a]rchive  [l]ink  [d]ispatch
```

---

## 4. Why this beats the alternatives

| Criterion | Triage Rail |
|---|---|
| APM ceiling | 40–60 (matches Superhuman pattern, grouped for batch logic) |
| Cognitive load | Status grouping = "I'm in unblock mode for 21 tasks now." One mode per batch. |
| Blocked fit | Best. Inline expansion shows context. Batch-select related blockers. |
| Todo fit | Drag-free reordering via `shift+j` / `shift+k` within group. |
| Ready fit | `d` = instant dispatch. Whole column cleared in <10s. |
| Batch ops | Unique to this pattern. Swipe / inbox / chat can't batch. |
| Backend cost | Zero. Reuses existing FastAPI shim + SSE stream + SQLite. |

---

## 5. Build plan (Voice 3 — Builder)

Phased so Phase 1 ships in hours, not days.

### Phase 1 — Keyboard triage core (~250 LOC, 2–4 hrs)
- Plugin on existing dashboard at `127.0.0.1:9119`. New route: `/triage`.
- Read directly from `~/.hermes/kanban.db` via existing FastAPI shim (`~/.hermes/scripts/kanban-api`, port 8645).
- React component: status-grouped list, `j/k/Enter/u/r/c/a/d` handlers.
- Action handlers call existing `kanban_*` endpoints — no new backend.
- `?` help overlay.

### Phase 2 — Batch + filter + undo (~400 LOC additional, ~1 day)
- `space` multi-select with shift-range.
- Bulk action handlers (bulk unblock with shared reason, bulk reassign).
- `f` assignee fuzzy filter.
- Undo stack (last 10 actions). Triage UIs without undo are dangerous.
- `cmd+k` command palette.

### Phase 3 — Smart clustering (~300 LOC, ~1 day)
- Auto-group blocked tasks by inferred root cause (parent task ID, shared blocker text n-grams, missing env var name).
- "Suggested batch": surface clusters of 3+ blockers with one-action resolution.
- Optional: swipe overlay mode (Voice 3's compromise — keep the original Instagram-scroll concept available for the *3 ready tasks* where it actually fits).

### Phase 4 — Maintenance mode (post-backlog clearance)
- Menubar notifications for *new* tasks trickling in (not for clearing backlog).
- Build only after Phase 1–3 prove the workflow.

---

## 6. Where it lands

Two options. Pick by what's faster to iterate:

### Option A — Plugin on existing Hermes dashboard
- Lives at `~/.hermes/plugins/<plugin-name>/`.
- React component, mounted at `/triage` route on dashboard (`127.0.0.1:9119`).
- Pros: zero deploy. Dashboard already wires SQLite + WebSocket. Plugin auto-discovered.
- Cons: dashboard plugin authoring conventions still light. Stuck inside dashboard's framework.

### Option B — Land in `ideai` Next.js rewrite (`web/`)
- ideai already exists as the GitHub-Issues-UI over Kanban. Triage Rail is the next view.
- Lives at `~/Radikari/ideai/web/app/triage/page.tsx`.
- Reads via the same FastAPI shim ideai already uses (port 8645).
- Pros: real Next.js app, full styling control, easy to iterate, no plugin sandbox.
- Cons: ideai is mid-rewrite. Might conflict with whatever stage it's at.

**Recommendation:** Option B if ideai's web/ is in a workable state — Triage Rail and the
existing GitHub-Issues view are complementary modes of the same surface. Same auth, same shim,
same DB. Option A only if ideai isn't ready to absorb new views yet.

---

## 7. Voice disagreement (the one open question)

Voice 1 vs Voice 2: status-grouped columns vs flat inbox + filter.

**Voice 1 won** (status grouping). Reason: flat inbox forces decision-type switching every row,
which is the hidden cognitive tax. Status grouping keeps brain in one mode per batch, then
switches once. This is the whole point of the design.

Reopen only if real-world use shows users want flat-list mode. Add it as a `t` toggle later,
not now.

---

## 8. Open questions before build

- Which option (A or B) does ideai's current state allow?
- Should Phase 1 use the existing FastAPI shim (port 8645) or talk to SQLite directly via
  Next.js server actions?
- Undo stack: in-memory only, or persisted to a separate `triage_actions` table for crash recovery?
- Auto-clustering (Phase 3): pure heuristic (regex on blocker text) or LLM call per cluster?
  Heuristic ships faster; LLM is more accurate.

---

## 9. Status

- Designed: 2026-06-23 (Council session)
- Recovered: 2026-06-28 (from kurisu profile state.db, msg ids 2916–2965)
- Built: not yet
- Next step: pick Option A or B, scaffold Phase 1
