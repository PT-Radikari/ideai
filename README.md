# OpsFlow Intake Board

Static prototype for an internal optimization-request tool with two main surfaces:

1. `Issue Channel` for detailed ticket creation
2. `Kanban Board` for workflow tracking across:
   `Issue Optimization Request -> Review -> Revision -> Production -> Testing -> Deployment`

## Files

- `index.html` - app structure
- `styles.css` - visual design and responsive layout
- `app.js` - ticket creation, board rendering, drag/drop, localStorage persistence

## How to run

Open [index.html](/Users/elisena/Documents/Codex/2026-04-28-i-am-working-for-a-company/index.html) directly in a browser, or from this folder run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Current prototype behavior

- Guided ticket form with required detail fields
- Spreadsheet and image attachment intake
- Image preview for smaller image attachments
- Board filters for search, division, and priority
- Drag and drop between workflow stages
- Detail panel with activity log and manual updates
- Local persistence via browser `localStorage`

## Important limitation

Attachments are not uploaded to a real backend in this prototype. Image previews are stored only when small enough for `localStorage`. For production use, move attachments to object storage and store metadata plus signed URLs in a database.

## Recommended next production steps

1. Add authentication and role-based permissions by division.
2. Move tickets and activity logs to a real database.
3. Store attachments in object storage instead of browser storage.
4. Add comments, assignees, SLA dates, and notifications.
5. Expose the same workflow through a REST or GraphQL API.
