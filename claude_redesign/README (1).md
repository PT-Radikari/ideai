# OpsFlow Design System

## Overview

**OpsFlow** (product name from `opsflow-intake-board`) is an internal AI-ops automation ticketing web application built by PT Radikari. It is an optimization-request intake and delivery tracking system used across BPO, MPO, and supporting divisions.

The product has two primary surfaces:
1. **Issue Channel** — A guided ticket intake form. Requesters describe their manual process, desired optimization, business impact, and success metrics before the work enters the board.
2. **Kanban Board** — A shared workflow board with six stages: `Issue Optimization Request → Review → Revision → Production → Testing → Deployment`. Supports drag-and-drop, filtering by division/priority, and a detail panel with activity log.

### Sources
- **Codebase:** `github.com/PT-Radikari/ideai` (branch: `master`)
  - `src/App.tsx` — Full UI and workflow logic
  - `styles.css` — Complete visual design system
  - `src/types.ts` — Workflow types (Stage, Priority, Ticket, etc.)
  - `src/lib.ts` — Seed data, helpers
- No Figma file was provided.

### Stack
React 19 + TypeScript + Vite, `localStorage` for prototype persistence. No external UI library — fully custom CSS.

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Professional but operational.** Copy is direct and task-oriented — it instructs and informs, never markets.
- **Third-person framing for the system** ("Tickets start in Issue Optimization Request"), **second-person for user guidance** ("Describe the current workflow…").
- **No emoji.** The brand is clean and internal-facing.
- **No exclamation marks.** Calm authority.
- **Sentence case** throughout (not Title Case for body copy). Headings use sentence case too: "Optimization request kanban", not "Optimization Request Kanban".
- **Eyebrow labels** are ALL CAPS, widely letter-spaced, small (0.72rem), e.g. `INTERNAL WORKFLOW HUB`, `AUTOMATION PIPELINE TECH`, `NEW TICKET`.
- **Placeholder copy** is detailed and instructive: *"Reduce manual reconciliation for BPO payroll"*, *"Describe the current workflow, handoffs, spreadsheets, approvals, and bottlenecks."*

### Specific Examples
- Heading: *"Optimization Intake and Delivery Board"*
- Subheading: *"One shared control surface for request capture, review gates, delivery movement, and deployment readiness."*
- Chip label: *"Structured intake"*, *"Better scoping"*, *"Cleaner handoff"*
- Nav: *"Issue Channel"*, *"Kanban Board"*
- Stat labels: *"Tickets"*, *"Active"*, *"Critical"*, *"Deployed"*

---

## VISUAL FOUNDATIONS

### Colors
- **Background:** Warm parchment `#f1ead9` with multi-radial gradients (teal top-left, orange top-right, deep green bottom-right). Creates a warm, analog desk feel.
- **Dark surface:** Deep navy `#0f1b24` / `#0b252f` — used for sidebar. Near-black with blue-green undertone.
- **Ink / text:** `#14212c` — very dark blue-black, not pure black.
- **Muted text:** `#5f6d79` — slate-toned grey.
- **Accent (teal):** `#0d8a7c` — the primary action color. Used for buttons, links, active states, borders.
- **Accent strong:** `#0a5c55` — darker teal for gradients and hover states.
- **Signal (orange):** `#df6f2d` — secondary accent, used for urgency/signal elements.
- **Warning:** `#b45309` — amber.
- **High priority:** `#a61b1b` — deep red.
- **Medium priority:** `#b56a0f` — amber-brown.
- **Low priority:** `#1f63d8` — blue.

### Typography
- **Display / headings:** `"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif` — elegant old-style serif for all h1–h4, brand name, panel titles. Letter-spacing: `-0.02em`. This gives the lo-fi, editorial, analog feel.
- **Body / UI:** `"Avenir Next", "Segoe UI", sans-serif` — clean geometric humanist sans for labels, body text, form fields, metadata.
- **Eyebrow labels:** 0.72rem, 700 weight, 0.14em letter-spacing, ALL CAPS, 72% opacity on dark, full color on light.
- **No monospace** is used in the current design.

*Font substitutions used in design system: `"Libre Baskerville"` (Google Fonts) for Iowan Old Style; `"DM Sans"` for Avenir Next.*

### Backgrounds & Texture
- **Page-level:** Radial gradient warm cream + a subtle grid noise overlay (`page-noise` class) — white grid lines at 96px intervals fading toward edges. This is the signature lo-fi texture.
- **Panels:** Frosted glass — `rgba(250, 246, 238, 0.78)` + `backdrop-filter: blur(12px)`. Light inner panels float above the textured background.
- **Dark sidebar:** Deep navy with radial teal glow at top, slight glass overlay `rgba(255,255,255,0.04)`.
- **Cards/panels:** Linear gradient from near-white to warm cream, with 1px border at `rgba(20,33,44,0.12)`.

### Borders & Radius
- **Large (panels, sidebar):** `border-radius: 30px`
- **Medium (cards, columns):** `border-radius: 22px`
- **Small (inputs, detail cards):** `border-radius: 16px`
- **Pill (buttons, badges, chips):** `border-radius: 999px`
- Border color: `rgba(20, 33, 44, 0.12)` light, `rgba(255,255,255,0.08)` on dark.

### Shadows
- **Large:** `0 28px 70px rgba(20, 33, 44, 0.13)` — used on main panels.
- **Soft:** `0 16px 38px rgba(20, 33, 44, 0.08)` — used on stat cards and stamps.
- **Ticket hover:** `0 18px 36px rgba(20, 33, 44, 0.1)`.
- No colored shadows. No inner glow except on brand sigil dots.

### Animations
- **Panel entry:** `opacity: 0 + translateY(14px)` → natural position, 440ms ease. All panels animate in.
- **Hover lifts:** `translateY(-2px)` on ticket cards, `translateY(-1px)` on buttons, `translateX(3px)` on nav items.
- **Transitions:** 160ms ease — snappy, not bouncy.
- No spring or bounce animations. Subtle and professional.

### Hover & Press States
- Buttons: `translateY(-1px)` lift + bg color shift (160ms ease).
- Nav items: `translateX(3px)` nudge right + background brightens.
- Ticket cards: `translateY(-2px)` + border accent + deeper shadow.
- No scale-down press states.

### Iconography
*See ICONOGRAPHY section below.*

### Cards
- Rounded corners (22–30px), 1px semi-transparent border, frosted glass background.
- Ticket cards: white-cream gradient, soft shadow, teal accent border on selected.
- Sidebar panels: dark glass, white border at 8% opacity.
- Stat cards: warm cream gradient, soft shadow.

### Color Vibe of Imagery
No imagery present in codebase. The aesthetic implies warm, analog, editorial — think aged paper meets precision interface. If imagery is added, it should be warm-toned or desaturated with warm overlay.

### Use of Blur & Transparency
- Extensively used: `backdrop-filter: blur(12px)` on all floating panels.
- Panel backgrounds are semi-transparent — content behind bleeds through slightly.
- Sidebar is near-opaque dark.

### Layout Rules
- **App shell:** `display: grid; grid-template-columns: 320px 1fr` — fixed 320px sidebar, fluid content.
- **Board:** horizontal scroll with 6 equal columns, `minmax(220px, 1fr)`.
- **Padding:** 2rem on main areas, consistent spacing grid.
- **No fixed header/footer** in the current design.

---

## ICONOGRAPHY

No icon font, SVG sprite, or icon library is used in the current codebase. Iconography is achieved entirely through:
- **Brand sigil:** A 3×3 dot grid (only 3 dots shown via `repeat(3, 10px)`) with a gold-to-teal linear gradient and teal glow. This is the closest thing to a logo.
- **Text labels and eyebrows** carry semantic weight that icons would otherwise provide.
- **Badge pills** (priority, stage chips) use colored backgrounds to convey status without icons.

**Recommendation:** If icons are needed, use **Lucide Icons** (CDN) — stroke-based, clean, consistent with the geometric-humanist aesthetic. Avoid filled icon styles.

---

## File Index

| Path | Description |
|---|---|
| `README.md` | This file — brand overview, content + visual foundations |
| `colors_and_type.css` | CSS custom properties: colors, type scale, spacing, radius, shadow tokens |
| `SKILL.md` | Agent skill definition for use with Claude Code |
| `preview/colors-palette.html` | Base color swatches |
| `preview/colors-semantic.html` | Status/priority colors + brand sigil gradient |
| `preview/type-serif.html` | Display serif type scale (Libre Baskerville) |
| `preview/type-sans.html` | Body sans type scale (DM Sans) |
| `preview/brand-background.html` | Page background system (parchment + noise) |
| `preview/brand-sidebar.html` | Dark sidebar + brand sigil block |
| `preview/spacing-tokens.html` | Radius + spacing scale |
| `preview/spacing-shadows.html` | Shadow system + backdrop blur panels |
| `preview/components-buttons.html` | Button variants |
| `preview/components-badges.html` | Priority badges + chips |
| `preview/components-ticket-card.html` | Kanban ticket card |
| `preview/components-inputs.html` | Form inputs |
| `preview/components-stat-cards.html` | Dashboard stat cards |
| `preview/components-workflow-runway.html` | Six-stage delivery runway |
| `ui_kits/opsflow/index.html` | **Full interactive UI kit** — OpsFlow web app (board + intake) |
| `ui_kits/opsflow/App.jsx` | Root app: layout, state, topbar, runway |
| `ui_kits/opsflow/Sidebar.jsx` | Sidebar: brand block, nav, workflow list |
| `ui_kits/opsflow/IntakeView.jsx` | Intake form view |
| `ui_kits/opsflow/BoardView.jsx` | Kanban board + detail panel |
| `ui_kits/opsflow/Tokens.jsx` | Shared constants + seed data |

### UI Kits
- **OpsFlow web app** — `ui_kits/opsflow/index.html`
  Two interactive views: Kanban board with drag-and-drop-ready ticket cards, filtering, and a sticky detail panel; and the guided intake form. Click any ticket to open its detail. Create new tickets through the Issue Channel view.
