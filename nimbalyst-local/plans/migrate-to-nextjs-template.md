# Plan: Port OpsFlow to Next.js 15 template (with GitHub Issues feature)

## Context

Current OpsFlow is a React 19 + Vite single-page app with custom CSS, view-toggle "routing", and `useState` + `useEffect`-to-`localStorage`. The GitHub Issues feature was approved against this stack but is not yet implemented.

This plan does the alternative: **rebuild OpsFlow on the pasted "Frontpage Base Template"** (Next.js 15 App Router + TS + Tailwind 4 + Zustand 5 + TanStack Query 5 + React Hook Form 7 + Axios + Iconify + Sonner + BProgress + Motion), porting the existing intake + kanban features and building the Issues experience natively on top of that structure. Outcome: a production-shaped codebase with real routes, real auth scaffolding, and a service layer ready for a real backend.

## Open decisions (defaulted — adjust if wrong)

1. **Backend.** Is there a real API at `NEXT_PUBLIC_BE_URL`?
  - **Default**: No. Use Next.js Route Handlers (`src/app/api/**/route.ts`) backed by `lowdb` (a tiny JSON-file DB) so TanStack Query actually has something to fetch. When you wire a real backend, swap the axios service implementations and delete the Route Handlers.
2. **Auth.** Multi-user with login in v1?
  - **Default**: Scaffold the template's JWT auth (login page, protected layout, cookie session) but seed one dev user and accept any password while `NODE_ENV !== "production"`. Don't block local dev.
3. **Repo layout.** Replace the current Vite app or live alongside?
  - **Default**: New directory `/web` inside this repo, parallel to the existing `/src`. Keep the Vite app as reference until phase 7 sign-off, then delete.

## Target structure

```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (protected)/
│   │   │   ├── layout.tsx                 # auth guard + sidebar shell
│   │   │   ├── intake/page.tsx            # ports Issue Channel form
│   │   │   ├── board/page.tsx             # ports Kanban Board
│   │   │   ├── issues/page.tsx            # NEW issues list
│   │   │   └── issues/[code]/page.tsx     # NEW issue detail (real route)
│   │   ├── (public)/page.tsx              # landing (optional)
│   │   ├── api/
│   │   │   ├── tickets/route.ts           # GET list, POST create
│   │   │   ├── tickets/[id]/route.ts      # GET, PATCH
│   │   │   ├── tickets/[id]/comments/route.ts
│   │   │   ├── labels/route.ts
│   │   │   ├── users/route.ts
│   │   │   └── logout/route.ts            # from template
│   │   └── layout.tsx                     # global providers
│   ├── components/
│   │   ├── ui/                            # Button, Badge, Avatar, LabelChip, MarkdownView, StateBadge
│   │   ├── intake/IntakeForm.tsx
│   │   ├── board/{Kanban,TicketCard,DetailPanel,FilterBar}.tsx
│   │   └── issues/{IssueList,IssueListItem,IssueDetail,CommentItem,CommentComposer,LabelPicker,AssigneePicker,IssueFilters}.tsx
│   ├── services/                          # axios + zod, one folder per domain
│   │   ├── tickets/{index.ts,types.ts}
│   │   ├── labels/{index.ts,types.ts}
│   │   ├── users/{index.ts,types.ts}
│   │   └── auth/{index.ts,types.ts}
│   ├── stores/                            # Zustand
│   │   ├── auth.tsx                       # from template
│   │   └── ui.tsx                         # filters, drag state, draft form
│   ├── hooks/                             # TanStack Query
│   │   ├── useTickets.ts
│   │   ├── useComments.ts
│   │   ├── useLabels.ts
│   │   └── useUsers.ts
│   ├── constants/{env.ts, stages.ts, session.ts}
│   ├── types/{request.ts, response.ts, domain.ts}
│   └── utils/{api.ts, classname.ts, session.ts, markdown.ts, attachments.ts}
├── data/db.json                           # lowdb store (gitignored, seeded on boot)
├── tailwind.config.ts
└── package.json
```

## Key tech decisions

- **CSS → Tailwind 4.** Rewrite `styles.css` tokens as a Tailwind `@theme` block in `globals.css`: `--bg`, `--accent`, `--high/medium/low`, `--issue-open` (`#2da44e`), `--issue-closed` (`#8250df`). Keep the warm parchment + teal palette so visual identity carries over.
- **Markdown → \****`react-markdown`***\* + \****`remark-gfm`***\* + \****`rehype-sanitize`**\*\*.** JSX-native, plays well with `@tailwindcss/typography`'s `prose` class. `marked` + `DOMPurify` was right for the Vite plan; `react-markdown` is right here.
- **State split.** Zustand for *client* state (active filters, drag state, draft intake form, detail-panel selection); TanStack Query for *server* state (tickets, labels, users, comments). No more localStorage hacking.
- **Forms.** React Hook Form for the intake form and comment composer, with **Zod schemas shared between client services and API Route Handlers** for end-to-end type safety.
- **Routing.** Native App Router. `/issues` and `/issues/[code]` are real routes — the Vite plan's hash router becomes obsolete.
- **Drag-and-drop.** Keep HTML5 DnD (works fine, current code is solid). Skip `dnd-kit` unless you later want fancy animations.
- **Persistence (prototype).** `lowdb` writing to `data/db.json` — feels like a real API without a DB. Swap before deploying.
- **Icons / toasts / progress / animations.** Iconify, Sonner, BProgress, Motion — all from the template defaults.

## Implementation phases

### Phase 0 — Scaffold
1. `pnpm create next-app web --ts --tailwind --app --src-dir --import-alias "@/*"`.
2. Add deps: `pnpm add zustand @tanstack/react-query react-hook-form axios @iconify/react sonner @bprogress/next motion @tailwindcss/typography zod react-markdown remark-gfm rehype-sanitize lowdb nanoid`.
3. Recreate template structure: `(auth)`, `(protected)`, `(public)` route groups; `services/`, `stores/`, `constants/`, `types/`, `utils/`.
4. Drop in template basics: `globals.css` with theme tokens, root `Providers` (QueryClient, Sonner, Progress, Motion), `stores/auth.tsx`, `utils/api.ts` (axios with token interceptor), `constants/env.ts`.

### Phase 1 — Domain layer (the spine)
1. Port `src/types.ts` → `src/types/domain.ts`. Include the Issues fields from day one: `state`, `closedAt?`, `labels[]`, `assignees[]`, `body`, `comments[]`. Add `Comment`, `Label`, `User`.
2. Per-service Zod schemas in `services/*/types.ts`.
3. Route Handlers under `app/api/{tickets, labels, users}/...` backed by `lowdb`. Seed `data/db.json` on first boot via `lib/seed.ts` (port `buildSeedTickets/Labels/Users` from the Vite app).
4. Axios services + TanStack Query hooks: `useTicketsList`, `useTicket(code)`, `useCreateTicket`, `usePatchTicket`, `useAddComment`, `useLabels`, `useCreateLabel`, `useUsers`.

### Phase 2 — Auth shell
1. Port `(auth)/login/page.tsx` and `(protected)/layout.tsx` from the template.
2. Seed one dev user; login accepts any password when `NODE_ENV !== "production"` (clear `TODO: real auth` comment).
3. Server-side token verification in the protected layout. Logout via `app/api/logout/route.ts`.

### Phase 3 — Port Issue Channel (intake)
1. `(protected)/intake/page.tsx` → `IntakeForm` (RHF + shared Zod schema). Map all current fields.
2. Move `normalizeAttachments` logic to `utils/attachments.ts`. Keep the 900 KB image cap.
3. On submit → `useCreateTicket` → Sonner success toast → `router.push("/issues/" + code)`.

### Phase 4 — Port Kanban Board
1. `(protected)/board/page.tsx` → `<Kanban />` (`"use client"`) + `<DetailPanel />`.
2. 6 stages from `constants/stages.ts`. HTML5 DnD on `TicketCard` triggers `usePatchTicket({ stage })` with optimistic update so column moves are instant.
3. Filters (search, division, priority) in `stores/ui.tsx`; list query reads them.

### Phase 5 — Build the Issues experience (the new feature)
1. `(protected)/issues/page.tsx` → `IssueList` with Open/Closed tabs, label filter, assignee filter, sort (newest / oldest / most-commented). Rows are `<Link href={"/issues/" + code}>` — App Router handles URLs natively.
2. `(protected)/issues/[code]/page.tsx` → `IssueDetail`: title + `<StateBadge>` (Open green / Closed purple), markdown body in a `prose prose-sm` container, comment thread, sidebar (LabelPicker, AssigneePicker, stage select, priority, Close/Reopen).
3. `CommentComposer` uses RHF for the textarea + Write/Preview tabs; submit → `useAddComment`.
4. `LabelPicker` supports inline label creation via `useCreateLabel`.

### Phase 6 — Polish
1. `prose` typography for markdown body.
2. Motion transitions for detail-panel enter and list-row hover.
3. Sonner toasts on every mutation (`Comment posted`, `Issue closed`, `Label created`).
4. BProgress on route transitions.
5. Iconify icons replace inline SVGs.

### Phase 7 — Decommission Vite app
1. Verify parity with current OpsFlow + the new Issues feature.
2. Delete `/src`, `/styles.css`, `index.html`, `vite.config.ts`, root `package.json`. Promote `/web` to repo root (or update root README to point at `/web`).

## Risks / gotchas

- **Tailwind 4** — theme syntax differs from v3. Verify against current docs at scaffold time, especially the `@theme` block.
- **`lowdb`**** in serverless route handlers** — fine for local dev, **breaks on Vercel**. If you'll deploy before swapping, move to SQLite-on-Turso, Neon, or Vercel Postgres in phase 7.
- **Server vs Client components** — anything with state, drag handlers, RHF, Zustand, or TanStack Query must be marked `"use client"`. Follow the template's `container.tsx` pattern strictly.
- **Inline base64 attachments** will balloon `data/db.json` fast. The 900 KB image cap helps but migrate to object storage (UploadThing / S3) before deployment.
- **HTML5 DnD + SSR** — `<Kanban />` must be a client component. Drag events don't fire on server-rendered nodes.
- **Dev-mode auth** — gate the "any password" path behind `NODE_ENV` with an explicit TODO. Easy to forget; embarrassing in prod.
- **CSS rewrite is the time sink** — 890 lines of custom CSS → Tailwind. Budget 2–3 sittings for visual parity. Compare with side-by-side screenshots.
- **Iconify default loads icons over the network** — preload critical ones or bundle the offline collection so first paint isn't laggy.
- **Hash router from prior plan is dead code** — don't carry it over. App Router replaces it entirely.
- **Total scope** — realistically 5–10× the original plan: ~1 sitting (phase 0–1), ~1 sitting (phase 2–3), ~1 sitting (phase 4), ~2 sittings (phase 5), ~1 sitting (phase 6–7). Plan accordingly.

## Verification

1. `pnpm install && pnpm dev` in `/web` → boots at :3000.
2. `/` (public) renders. `/dashboard` (protected) redirects to `/login`.
3. Log in (dev creds) → land on `/intake`. Submit a ticket → toast fires → redirects to `/issues/OPT-…`.
4. `/board` → seed tickets in 6 columns. Drag a card → optimistic update, then API confirms. Refresh → state persists in `data/db.json`.
5. `/issues` → list of open issues. Toggle Open/Closed tabs; search; filter by label / assignee; sort by most-commented.
6. Click a row → URL `/issues/OPT-…` (real route, browser back works). Markdown body and comment thread render.
7. Post a comment with `**bold**`, list, link → Preview tab works → submit → bubble appears → Sonner toast confirms.
8. Inline-create a label → chip appears, persists across refresh.
9. Reassign issue → avatar updates in list + detail.
10. Close issue → state badge flips purple, leaves Open tab, joins Closed. Reopen restores.
11. Move stage from inside issue detail → reflected on `/board`.
12. Hard refresh `/issues/OPT-…` → SSR rehydrates without flash.
13. `pnpm lint && pnpm typecheck` clean.
14. Lighthouse a11y pass on `/issues` and `/issues/[code]`.
