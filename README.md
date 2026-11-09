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

## Junior Trade (employee field notes)

**JRT-04 Junior Trade fitting, ASTM & release** is built from first-hand employee field notes and opens in the field guide: eight numbered stages with a sticky progress bar (tap a segment to jump), from guest arrival to release.

- **Labelled notes** on steps keep provenance visible: *Pro tip · field note*, *Employee-reported · unverified estimate* (prices), *Published policy · confirm before quoting* (with the public Junior Trade link), *Safety-critical*.
- **Ski sizing reference** drawn from the field-note ranges (collarbone→chin, chin→nose, nose→top of head), labelled as a guideline, not an approved selection procedure.
- **Shared out-of-stock playbook** (JRT-05) used by both boots and skis — one source of truth, shown inline in the guide.
- **ASTM is safety-critical** and marked in red throughout. The atlas holds no release values, torque specs, adjustment steps or test requirements; the procedure is an explicit unknown until captured from an authorized source.
- Unknown systems are named *pending identification*, and every open point (pricing, trade-in terms, ASTM procedure, check-in system, iPad app…) is queued in **Review**.

Any workflow can use the same building blocks: a step's **Stage**, **Safety-critical** flag, **Tips & labelled notes**, and a hand-off's **Show inline** option are all in the step editor.

## Knowledge management

- Every item has a status: **Verified**, **Observed**, **Unverified**, **Outdated**. Nothing is promoted automatically; marking something Verified requires a source and stamps the verification date.
- Created / updated / last-verified dates, free-text source, linked Sources, notes.
- Full **version history** for every item, with one-tap restore. Deletes are soft and restorable.
- **Verified requires an authorized source** — a written reference, or a linked Source marked *authorized*. Enforced by the server; placeholder sources can never verify content.
- Status changes happen deliberately through **Review status** (any item, or inline in the Review queue) and are recorded in history with the reason.
- Every save bumps a **revision number** shown in each workflow's document-control block.
- Optimistic concurrency: if an item changed on another device, saving is refused instead of overwriting.
- Deleted items are listed under **Review → Deleted** and restore with their full history. **Review → Integrity** checks every cross-reference.
- Screenshots are resized and re-encoded in the browser (strips EXIF/location) and stored once; any image can be attached to many items.

## Field capture (iPhone)

- **+ (Capture)** anywhere: screenshot, observation, question, step, term — pre-linked to whatever you're looking at (a step, workflow, system…).
- **Screenshot mark-up**: arrows, boxes, highlights, numbered markers, crop and **redact**. Only the marked-up copy is uploaded, so redactions are permanent.
- Observations are saved as **Observed** with a dated first-hand source; questions go straight to the Review queue. Templates mean most captures need one tap plus optional dictation.

## Workflow maps

- Connectors route around nodes: branches fan out from the sides of a decision, loop-backs travel round the outside, labels sit where branches leave.
- **Lenses**: *Status* (colour every step by trust), *Gaps* (unknown steps and missing what/why/who), *Systems* (where each system is used).
- Editing: shape picker, essentials first, quick branch labels, add-next / duplicate / insert-on-connector, **undo/redo**, and drafts **autosaved on the device** so an interrupted shift loses nothing.

## Architecture

```
src/            React 19 + Vite SPA (react-router data router)
  explorer/     Workflow engine: React Flow nodes, panels, editing
  lib/          API client, content store + relationship index, search, layout (dagre)
  components/   Shell, schema-driven forms, sheets, images, UI primitives
api/            Vercel serverless functions (plain Node req/res)
server/core.ts  Postgres access, migrations, first-run seeding, auth, validation
shared/         Content model types, integrity rules (validate.ts) + illustrative seed
tests/unit      Vitest — validation, verification rules, relationships, search, layout
tests/e2e       Playwright + axe-core end-to-end suite (iPhone SE/14 Pro/15 Pro Max + desktop)
```

**Content versions.** `shared/seed.ts` holds the starter content and a list of changes per content version. A new database gets everything; an existing one is updated in one transaction that adds new items and refreshes starter items **only if nobody has edited them** (no revision) **or deleted them** — so the owner's work always wins. Each change is recorded in version history.

**Data model.** One `entities` table holds every content item as JSONB (`department`, `workflow`, `system`, `equipment`, `glossary`, `note`, `source`). Items reference each other by id, never by copying text — a system supports many workflows, a term appears in many steps, an image supports many items. Workflow steps and connections live inside the workflow document. `entity_versions` keeps every revision; `images` stores compressed reference images. Migrations are idempotent and run automatically.

**Auth.** Single owner for now: reading is open; writing needs the edit key (`OPS_EDIT_KEY`, sent as a header — never in URLs). Set `OPS_PRIVATE=1` to require the key for reading too: unlocking then sets an HttpOnly, SameSite=Strict read-session cookie (an HMAC of the key, not the key) so images load; locking clears it and the device's cached copy. Rotating the key invalidates all sessions. `createdBy`/`updatedBy` are reserved for a multi-user upgrade.

**Security headers** (vercel.json): CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon). **Production** uses the `main` branch; **Preview** deployments use the separate `epic-ops-preview` Neon branch so testing never touches production records. |
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

## Testing

```bash
npm run build        # typecheck + production build
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end: boots isolated servers on throwaway databases (incl. private mode)
# against a preview deployment (writes test data — previews only):
BASE_URL=https://<preview>.vercel.app OPS_EDIT_KEY=… VERCEL_SHARE=<token> npm run test:e2e
```

Deploys go through Vercel on push to `main`.
