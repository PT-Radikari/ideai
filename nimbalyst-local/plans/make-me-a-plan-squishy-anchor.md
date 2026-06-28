# Plan: Next.js OpsFlow — frontend UI only (first pass)

## Context

User picked the Next.js migration path (see `migrate-to-nextjs-template.md`) but wants the frontend built first against in-memory mock data, with no API Route Handlers, no `lowdb`, no auth wiring, and no TanStack Query in this pass. The goal is a fully clickable UI: intake form, kanban with drag-drop, issues list, issue detail with markdown body, comments thread, labels, assignees, close/reopen — all functional, all persisted via Zustand `persist` (localStorage) so refreshing keeps state.

A second pass (separate plan) will replace the Zustand-backed mutations with axios services + TanStack Query against Route Handlers. Component files don't change between passes.

## Approach

- Scaffold Next.js 15 app at `/web` parallel to existing Vite `/src` (Vite kept as visual reference until parity verified).
- One Zustand store (`stores/data.ts`) holds tickets / labels / users; persists to localStorage via `zustand/middleware/persist`.
- All page handlers (create ticket, post comment, change stage, add label, close issue, etc.) call store actions directly — no axios, no API.
- Tailwind 4 with theme tokens ported from the Vite `styles.css` palette.
- React Hook Form for the intake form and comment composer (Zod validation).
- `react-markdown` + `remark-gfm` + `rehype-sanitize` for markdown body and comments, styled with `@tailwindcss/typography` `prose`.
- HTML5 drag-and-drop on the kanban (matches current Vite implementation).
- Sonner for toasts; Iconify for icons; Motion for panel-enter transitions.

## Critical files (all under `/web`)

```
web/                                          # template-aligned: route groups, _components/container.tsx, providers per group
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # root <Providers> (QueryClient stub, Sonner)
│   │   ├── globals.css                       # Tailwind @theme tokens (palette ported from styles.css)
│   │   ├── page.tsx                          # redirects to /issues
│   │   ├── (auth)/                           # PLACEHOLDER this pass — login goes here in pass 2
│   │   │   ├── _components/providers.tsx
│   │   │   └── layout.tsx                    # template's redirect-if-authenticated logic (stubbed)
│   │   └── (protected)/                      # main app (auth gate disabled this pass — TODO comment)
│   │       ├── _components/providers.tsx     # group-scoped providers (e.g. detail-panel context later)
│   │       ├── layout.tsx                    # sidebar shell + topbar
│   │       ├── intake/
│   │       │   ├── _components/container.tsx # IntakeForm
│   │       │   └── page.tsx                  # thin: <Container />
│   │       ├── board/
│   │       │   ├── _components/
│   │       │   │   ├── container.tsx         # FilterBar + Kanban + DetailPanel
│   │       │   │   ├── kanban.tsx
│   │       │   │   ├── ticket-card.tsx
│   │       │   │   ├── detail-panel.tsx
│   │       │   │   ├── filter-bar.tsx
│   │       │   │   └── attachment-card.tsx
│   │       │   └── page.tsx
│   │       └── issues/
│   │           ├── _components/
│   │           │   ├── container.tsx         # IssueFilters + IssueList
│   │           │   ├── issue-filters.tsx
│   │           │   ├── issue-list.tsx
│   │           │   └── issue-list-item.tsx
│   │           ├── page.tsx
│   │           └── [code]/
│   │               ├── _components/
│   │               │   ├── container.tsx     # IssueDetail
│   │               │   ├── issue-detail.tsx
│   │               │   ├── issue-sidebar.tsx
│   │               │   ├── comment-item.tsx
│   │               │   ├── comment-composer.tsx
│   │               │   ├── label-picker.tsx
│   │               │   └── assignee-picker.tsx
│   │               └── page.tsx
│   ├── components/                           # shared, cross-page UI only
│   │   ├── providers.tsx                     # global QueryClient stub + theme provider
│   │   ├── shell/{sidebar,topbar}.tsx
│   │   └── ui/{button,badge,avatar,label-chip,state-badge,markdown-view,empty-state}.tsx
│   ├── stores/                               # template uses .tsx (provider-wrapped Zustand)
│   │   ├── data.tsx                          # tickets, labels, users + all mutations + persist
│   │   └── ui.tsx                            # filters, drag state, draft form
│   ├── services/                             # PLACEHOLDER folders this pass — filled in pass 2 with axios
│   │   ├── tickets/{index.ts, types.ts}
│   │   ├── labels/{index.ts, types.ts}
│   │   └── users/{index.ts, types.ts}
│   ├── constants/{stages.ts, priorities.ts, divisions.ts, env.ts, session.ts}
│   ├── types/{request.ts, response.ts, domain.ts}   # template's split (request/response empty this pass)
│   ├── lib/{seed.ts, attachments.ts, contrast.ts, relative-time.ts}
│   └── utils/{api.ts, classname.ts, markdown.tsx, session.ts}   # api/session stubbed this pass
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
├── tsconfig.json
└── package.json
```

**Template-fidelity notes** (the deviations I called out earlier are now fixed):
- Route groups are `(auth)` / `(protected)` matching the template; `(public)` skipped because there's no landing page in scope.
- Every page has its own `_components/container.tsx` per the template's container pattern. `page.tsx` files are thin (`return <Container />`).
- Stores are `.tsx` (provider-wrapped) like the template's `stores/auth.tsx`.
- Types split into `request.ts` / `response.ts` / `domain.ts` like the template's `types/{request,response}.ts`.
- Per-route-group `_components/providers.tsx` like the template's `(auth)/_components/providers.tsx` and `(protected)/_components/providers.tsx`.
- `services/`, `utils/api.ts`, `utils/session.ts`, `constants/env.ts`, `constants/session.ts` exist as scaffolding even though they're empty/stubbed this pass — pass 2 fills them without moving anything.

## Implementation order

### Phase A — Scaffold + theme
1. `pnpm create next-app web --ts --tailwind --app --src-dir --import-alias "@/*"` (no git init, will share repo).
2. Add deps: `pnpm add zustand react-hook-form zod @hookform/resolvers @iconify/react sonner motion @tailwindcss/typography react-markdown remark-gfm rehype-sanitize nanoid clsx tailwind-merge`.
3. Port palette + tokens from `/styles.css` (`--bg`, `--ink`, `--accent`, `--high/medium/low`, plus new `--issue-open #2da44e` and `--issue-closed #8250df`) into `app/globals.css` `@theme` block.
4. Set up `cn` (clsx + tailwind-merge) in `utils/cn.ts`. Add Sonner `<Toaster />` in root `layout.tsx`.

### Phase B — Domain + mock data + store
1. `types/domain.ts`: `Ticket` (with `state`, `closedAt?`, `labels[]`, `assignees[]`, `body`, `comments[]`, plus all current Vite fields), `Comment`, `Label`, `User`, `Stage`, `Priority`.
2. `lib/seed.ts`: 4 seed users, 5 seed labels (bug, enhancement, question, blocker, documentation with hex colors), 3 seed tickets ported from Vite `lib.ts` `buildSeedTickets` plus `body`/`comments`/`labels`/`assignees`.
3. `stores/data.ts`: Zustand with `persist` middleware (key `opsflow-data-v1`). Exposes:
  - state: `tickets`, `labels`, `users`
  - actions: `createTicket`, `patchTicket`, `moveStage`, `closeIssue`, `reopenIssue`, `setTicketLabels`, `setTicketAssignees`, `addComment`, `createLabel`, `getTicketByCode`
  - all actions append an `ActivityItem` (mirrors Vite behavior).
4. `stores/ui.ts`: filters (search, division, priority, label, assignee, sort, state tab), drag state, selected ticket id.

### Phase C — Shell
1. `(protected)/layout.tsx`: `<Sidebar />` + `<Topbar />` + main content slot. Sidebar nav: Intake, Board, Issues — active link via `usePathname`. Comment `// TODO(pass 2): add server-side auth check + redirect`.
2. `(protected)/_components/providers.tsx`: group-scoped Sonner Toaster + MotionConfig wrapper.
3. `Sidebar`: brand block, three nav links (Iconify icons), simple stage counts (read from store).
4. `Topbar`: title + search shortcut + (future) user menu.
5. Root `app/page.tsx` → `redirect("/issues")`.

### Phase D — Intake
1. `(protected)/intake/page.tsx` is thin: `import Container from "./_components/container"; export default function Page() { return <Container />; }`.
2. `intake/_components/container.tsx` ("use client"): RHF form with Zod schema mirroring current Vite intake fields. File attachments via `lib/attachments.ts` (port `normalizeAttachments`, keep 900 KB image cap).
3. On submit → `useDataStore.createTicket(values)` → Sonner toast → `router.push("/issues/" + code)`.

### Phase E — Board
1. `(protected)/board/page.tsx` thin → `<Container />`.
2. `board/_components/container.tsx`: `<FilterBar />` + `<Kanban />` + `<DetailPanel />` (right column when a ticket is selected).
3. `kanban.tsx` ("use client"): 6 columns from `constants/stages.ts`. Columns read filtered tickets from store. HTML5 DnD on `TicketCard` calls `useDataStore.moveStage(id, newStage)`.
4. `detail-panel.tsx` shows ticket meta, stage controls, activity, attachments, manual update form (parity with current Vite detail panel — port the markup).
5. `filter-bar.tsx` reads/writes `stores/ui.tsx`.

### Phase F — Issues list
1. `(protected)/issues/page.tsx` thin → `<Container />`. `issues/_components/container.tsx` renders `<IssueFilters />` + `<IssueList />`.
2. `IssueFilters`: Open/Closed tabs (counts inline), search, label multiselect, assignee multiselect, sort dropdown (newest / oldest / most-commented).
3. `IssueList`: rows are `<Link href={"/issues/" + code}>`. Each row: status icon, title, code, label chips, assignee `AvatarStack`, comment count, "opened by X · time ago" via `lib/relativeTime.ts`.
4. Empty state when no matches.

### Phase G — Issue detail
1. `(protected)/issues/[code]/page.tsx` thin → `<Container code={code} />`. Container is `"use client"`, calls `useDataStore.getTicketByCode(code)`; if missing → `notFound()` from Next.
2. `IssueDetail` layout: header (title + `#code` + `<StateBadge state>` + Close/Reopen button), body via `<MarkdownView source={ticket.body} />`, `<CommentThread>`, `<CommentComposer />` at bottom; right rail `<IssueSidebar>` with `<LabelPicker>`, `<AssigneePicker>`, stage select, priority badge.
3. `CommentItem` bubble: avatar + author + relative time + markdown body.
4. `CommentComposer`: RHF textarea with Write/Preview tabs; submit → `data.addComment(ticketId, body)` + Sonner toast.
5. `LabelPicker`: popover of checkable rows + "Create label" affordance (color picker for hex). Calls `data.createLabel` and `data.setTicketLabels`.
6. `AssigneePicker`: popover of users with `Avatar`s and checkmarks.
7. Close/Reopen buttons → `data.closeIssue(id)` / `data.reopenIssue(id)` + toast.

### Phase H — Polish
1. `prose prose-sm` typography for markdown.
2. Motion `AnimatePresence` on `DetailPanel` and `IssueDetail` mount.
3. Sonner toasts on every mutation.
4. Iconify icons everywhere (replace inline SVGs).
5. Visual parity check vs Vite app — side-by-side screenshots.

## Skipped this pass (deliberate, see `migrate-to-nextjs-template.md` for full plan)

- API Route Handlers
- `lowdb` JSON DB
- Auth: login page, JWT, protected layout, route guards
- Axios services
- TanStack Query (no remote data yet)
- BProgress (Next handles route transitions fine without it for this pass)

## Risks / gotchas

- **Server vs Client components.** Anything with state, drag handlers, RHF, Zustand, Motion, or markdown rendering must be `"use client"`. Each page file can stay a Server Component that renders a client child.
- **Zustand SSR hydration.** With `persist`, the store rehydrates client-side after first paint — wrap any read of persisted data in a client component, or use `skipHydration: true` and call `useStore.persist.rehydrate()` in a `"use client"` boundary to avoid hydration mismatches.
- **Tailwind 4 syntax.** The `@theme` block and CSS-first config differ from v3. Verify against current docs at scaffold time; if v4 is too rough, fall back to v3 with `tailwind.config.ts` (note in commit message).
- **Markdown safety.** `react-markdown` + `rehype-sanitize` only — never set `rehypeRaw` without sanitization downstream.
- **Label color contrast.** `lib/contrast.ts` YIQ helper; normalize 3-digit hex to 6-digit before computing.
- **HTML5 DnD + SSR.** Kanban must be a client component or drag events won't bind.
- **Persist key collision.** Use a fresh key (`opsflow-data-v1`); don't reuse `opsflow-kanban-v1` from the Vite app.
- **No auth means /board and /issues are open in dev.** Acceptable for this pass; auth gate goes in later pass.
- **Component contract for pass 2.** Components read from `useDataStore()` directly. In pass 2, replace those reads with TanStack Query hooks, but keep the component prop shape stable so swap is mechanical.

## Verification

1. `cd web && pnpm install && pnpm dev` → app boots at :3000.
2. `/` redirects to `/issues`. Seed open issues render with status dots, label chips, assignee avatars, comment counts.
3. Switch Open/Closed tabs; type in search; filter by label / assignee; sort by most-commented — list reorders live.
4. Click a row → URL becomes `/issues/OPT-…`. Detail renders markdown body and comments thread.
5. Post a comment with `**bold**`, list, link → Preview tab works → submit → bubble appears → Sonner toast confirms.
6. Inline-create a label "urgent" red → chip appears, persists across refresh, selectable on other issues.
7. Reassign issue → avatar updates in both detail and list views.
8. Close issue → state badge flips purple, leaves Open tab, joins Closed. Reopen restores.
9. Change stage from inside issue detail → reflected on `/board`.
10. Hard refresh `/issues/OPT-…` → detail rehydrates from localStorage.
11. `/board` → 6 columns render. Drag a card across columns → state persists.
12. `/intake` → submit a ticket → toast → redirect to `/issues/OPT-…` → new ticket has `state: "open"`, empty labels/assignees, body defaults to `requestDetail`.
13. DevTools → Local Storage shows `opsflow-data-v1` key.
14. `pnpm lint && pnpm typecheck` clean.
