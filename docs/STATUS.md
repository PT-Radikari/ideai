# ideai — Status & TODO

> Frontend decision: **Vite app at repo root is the real target.** The Next.js
> app in `web/` is a parallel rewrite, not in play. Kanban DB
> (`~/.hermes/kanban.db`) is the single source of truth. ideai is a render+mutate
> adapter over it via the FastAPI shim at `http://127.0.0.1:8645`.

---

## THE PROBLEM (what was wrong)

### 1. Staged secrets — security incident risk (RESOLVED in working tree)
`git status` showed these committed to the index, 60 staged files from a push:

- `.env`, `.env.local`, `.env.example`  — real env files
- `yes`, `yes.pub`                       — keypair
- `hidden/rdkr_ssh`, `hidden/rdkr_ssh.pub` — private SSH key (was never tracked)

Private key + env in git history = rotate-everything incident.

What was done:
- `git rm --cached` removed all five tracked secrets from the index.
- `.gitignore` patched to block re-entry: `.env`, `.env.local`, `.env.example`,
  `yes`, `yes.pub`, `*.pem`, `*.key`.
- `hidden/` was already ignored, never tracked.

### 2. Plan said "build SSE live refresh" — but it was already built
Task 1 of the integration plan (SSE live board/issue refresh) was listed as
remaining work. Investigation showed it already shipped and works:

- `src/lib/kanban.ts:566` — `subscribeToChanges` (EventSource + 3s reconnect).
- `src/App.tsx:194` — board subscribes, reloads on event, guards in-flight
  mutations via `inflightRef`.
- `src/pages/IssuePage.tsx:158` — issue page subscribes, reloads on matching taskId.
- Shim `/api/kanban/stream` emits `task_created`/`task_updated`/`comment_added`.

Verified live: `npm run check` clean; created a task → stream emitted
`event: task_created` within the 2s poll window. No code needed.

---

## WHAT YOU NEED TO DO

### Now — your decisions / actions
1. **Rotate the leaked secrets IF the repo was ever pushed to a remote.**
   `git rm --cached` removes from the index but does NOT rewrite history. If any
   commit containing these reached a remote, the SSH private key and env values
   are compromised — rotate them.
   - Check: `git log --all --oneline -- .env yes hidden/rdkr_ssh`
   - If pushed: rotate SSH key (`yes`/`rdkr_ssh`), rotate anything in `.env`.

2. **Decide on test task `t_a25ea7fb`** (status `triage`, tenant `ideai`).
   Leftover from the SSE smoke test. Archive / keep / delete — your call.
   (My archive attempt was denied; left as-is.)

3. **Commit the secret cleanup** when ready:
   `git status` → confirm no `.env`/`yes`/key files staged → commit `.gitignore`
   change + the `git rm --cached` removals.

### Next — pick the next build task
The two remaining plan items for the Vite frontend:

- **A. Intake → webhook blueprint automation** — intake form POSTs to the shim
  (creates Kanban task) AND to the Shiro webhook (triggers a blueprint run that
  spawns linked child tasks). Needs the Shiro webhook platform enabled
  (`platforms.webhook`, port 8644) per docs/end-to-end-...-plan.md §1.
- **B. Deployment panel** — read `metadata.deployment` from the task, render
  "Open deployed page" + healthcheck link. Fallback: regex-detect URLs in
  comments/run summaries. (Decision 5 in docs/integration-plan.md.)

Tell me A or B and I draw the blueprint.

---

## Environment quick-ref
- Shim: `~/.hermes/scripts/kanban-api/` — `run.sh`, port 8645. `/health` → ok.
- Kanban DB: `~/.hermes/kanban.db` (source of truth).
- Verify frontend: `npm run check` && `npm run build`.
- Dev: `npm run dev` → http://localhost:5173
- Plans: `docs/integration-plan.md`, `docs/end-to-end-hermes-kanban-integration-plan.md`
