# Epic Mountain Ops

An interactive operations atlas for mountain retail and rental operations — departments, workflows, systems and terminology, all cross-linked, mobile-first.

> All starter content is **illustrative** and marked as such. Nothing in the seed data is an official procedure, and no proprietary software names or capabilities are asserted. Safety-critical work (binding adjustment, release checks) is deliberately represented as *unknown* steps to be captured from authorized training only.

## What's inside

| Destination | What it does |
|---|---|
| **Command Center** `/` | Departments at a glance, reference tiles, verification meter, open questions, recently viewed / updated. |
| **Departments** `/departments/:id` | Hub per department: sections → workflows, responsibilities, systems, tools & equipment, hand-offs to other departments, glossary, open questions. |
| **Workflow Explorer** `/workflows/:id?node=…` | Interactive flowchart (React Flow). Pinch-zoom, drag/two-finger pan, mouse-wheel zoom, trackpad pan + pinch, fit, center selected, minimap, map ⇄ step-list view. Tap any step for the 11-field detail panel. Hand-off steps navigate to the linked workflow. Edit mode: drag, add (step / decision / warning / parallel / hand-off / unknown / end), connect, label branches, auto-arrange, save. |
| **Systems & programs** `/systems`, `/equipment` | Searchable directory; each entry lists every workflow *and individual step* that references it. |
| **Glossary** `/glossary` | A–Z, searchable; terms are auto-linked wherever they appear in the atlas. |
| **Review** `/review` | Open questions, observations, content by verification status, sources. |
| **Add** `/add` | Capture a workflow, step, system, equipment, glossary entry, screenshot, observation or question. |
| **Search** `/search` | Prefix + fuzzy search across departments, workflows, every step, systems, equipment, glossary and notes, with deep links straight to a step. |

## Knowledge management

- Every item has a status: **Verified**, **Observed**, **Unverified**, **Outdated**. Nothing is promoted automatically; marking something Verified requires a source and stamps the verification date.
- Created / updated / last-verified dates, free-text source, linked Sources, notes.
- Full **version history** for every item, with one-tap restore. Deletes are soft and restorable.
- Optimistic concurrency: if an item changed on another device, saving is refused instead of overwriting.
- Screenshots are resized and re-encoded in the browser (strips EXIF/location) and stored once; any image can be attached to many items.

## Architecture

```
src/            React 19 + Vite SPA (react-router data router)
  explorer/     Workflow engine: React Flow nodes, panels, editing
  lib/          API client, content store + relationship index, search, layout (dagre)
  components/   Shell, schema-driven forms, sheets, images, UI primitives
api/            Vercel serverless functions (plain Node req/res)
server/core.ts  Postgres access, migrations, first-run seeding, auth, validation
shared/         Content model types + illustrative seed
```

**Data model.** One `entities` table holds every content item as JSONB (`department`, `workflow`, `system`, `equipment`, `glossary`, `note`, `source`). Items reference each other by id, never by copying text — a system supports many workflows, a term appears in many steps, an image supports many items. Workflow steps and connections live inside the workflow document. `entity_versions` keeps every revision; `images` stores compressed reference images. Migrations are idempotent and run automatically.

**Auth.** Single owner for now: reading is open; writing needs the edit key (`OPS_EDIT_KEY`). Set `OPS_PRIVATE=1` to require the key for reading too. `createdBy`/`updatedBy` fields are reserved for a later multi-user upgrade.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon). |
| `OPS_EDIT_KEY` | Key required to edit content. |
| `OPS_PRIVATE` | Optional. `1` = reading also requires the key. |

## Local development

```bash
npm install
# .env.local with DATABASE_URL and OPS_EDIT_KEY
npm run dev
# no network access to Neon? use an in-process Postgres (PGlite) instead:
OPS_DEV_DB=pglite npm run dev
```

`npm run build` typechecks and builds. Deploys go through Vercel on push to `main`.
