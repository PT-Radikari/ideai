# OpsFlow Intake Board

React + TypeScript rewrite of the internal optimization-request prototype. The
app keeps the same two main surfaces:

1. `Issue Channel` for guided ticket intake
2. `Kanban Board` for workflow tracking across:
   `Issue Optimization Request -> Review -> Revision -> Production -> Testing -> Deployment`

## Stack

- `React` for rendering and UI state
- `TypeScript` / `.tsx` for typed components
- `Vite` for local development and browser bundling
- `localStorage` for prototype persistence

## Project layout

- `src/main.tsx` - app bootstrap
- `src/App.tsx` - UI and workflow logic
- `src/types.ts` - shared workflow types
- `src/lib.ts` - seed data, formatting, and attachment helpers
- `styles.css` - visual system used by the TSX app
- `tools/codex-skills/codex-skill.ts` - TS skill installer CLI

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL, usually `http://localhost:5173`.

## Checks

```bash
npm run check
npm run build
```

## Current behavior

- Guided ticket form with required detail fields
- Spreadsheet and image attachment intake
- Image preview for smaller image attachments
- Board filters for search, division, and priority
- Drag and drop between workflow stages
- Detail panel with activity log and manual updates
- Local persistence via browser `localStorage`

## Limitation

Attachments are still prototype-only. Small image previews can be stored in
`localStorage`, but production use should move files to object storage and keep
metadata plus signed URLs in a database.

## Recommended production next steps

1. Add authentication and role-based permissions by division.
2. Move tickets and activity logs to a real database.
3. Store attachments in object storage instead of browser storage.
4. Add comments, assignees, SLA dates, and notifications.
5. Expose the workflow through a REST or GraphQL API.
