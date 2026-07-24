# Man-Day Estimator — Implementation Roadmap

Derived from `manday_estimation_tool_spec_for_claude.md` (revision including
Deployment, Storage Abstraction, and Multiple Local Projects).

Scope of v1: a fully static React + TypeScript SPA, no backend, no cloud
database, deployable to Firebase Hosting's free tier.

---

## Environment Constraint

Installed Node is **v20.13.1**. Vite 7/8 and the current `create-vite` template
require Node `^20.19 || >=22.12`. The roadmap therefore pins:

- Vite 5.x, React 18.x, TypeScript 5.x, Vitest 2.x, Tailwind 3.x

Alternative: upgrade Node to 20.19+/22.12+ and use the current template. **This
is a decision needed before M0 completes** — see Open Questions.

---

## Milestone Overview

| # | Milestone | Delivers | Depends on |
|---|-----------|----------|------------|
| M0 | Project scaffold | Buildable Vite + React + TS + Tailwind app | — |
| M1 | Domain model & calculations | Types + pure calc utilities + unit tests | M0 |
| M2 | Validation & serialization | zod schema, import validation, export, filename rules | M1 |
| M3 | Storage repository | `ProjectRepository` interface + LocalStorage impl + multi-project index | M2 |
| M4 | State layer | Immutable reducer: CRUD/duplicate/reorder for roles, phases, features, tasks | M1–M3 |
| M5 | Core UI | Header, toolbar, role manager, phase cards, feature sections, task table | M4 |
| M6 | Totals & summary UI | Feature/phase/project total rows, project summary table | M5 |
| M7 | Dialogs, toasts & a11y | Confirm dialogs, import dialog, toasts, keyboard/ARIA pass | M5 |
| M8 | Multi-project management | Project list, open/rename/duplicate/delete, active project switching | M3, M5 |
| M9 | Deployment & docs | `firebase.json`, `.firebaserc.example`, `README.md`, production build gate | M0–M8 |

Milestones are sequential except M6/M7/M8, which can proceed in parallel once M5 lands.

---

## M0 — Project Scaffold

**Goal:** `npm install`, `npm run dev`, `npm run build`, `npm test` all succeed.

- Vite React-TS scaffold, pinned to Node-20.13-compatible versions.
- Tailwind CSS 3 + PostCSS + Autoprefixer, configured for `src/**/*.{ts,tsx}`.
- Vitest configured (node environment is enough for M1–M3; jsdom only if
  component tests are added later).
- `tsconfig` strict mode on.
- `dist/` as the build output (spec requirement for Firebase Hosting).
- `.gitignore` covering `node_modules`, `dist`, `.firebaserc`.

**Done when:** an empty app renders, `npm run build` emits `dist/`, `npm test`
runs with zero tests and exits 0.

---

## M1 — Domain Model & Calculation Utilities

**Goal:** the correctness core, fully testable without React.

Files:
- `src/domain/types.ts` — `EstimateValue`, `ProjectData`, `Role`, `Phase`,
  `MainFeature`, `Task`, exactly as specified.
- `src/domain/calculations.ts` — pure functions:
  - `isTaskEffectivelyEnabled(phase, feature, task)`
  - `calculateFeatureRoleTotal(phase, feature, roleId)`
  - `calculateFeatureGrandTotal(phase, feature, roles)`
  - `calculatePhaseRoleTotal(phase, roleId)`
  - `calculatePhaseGrandTotal(phase, roles)`
  - `calculateProjectRoleTotal(project, roleId)`
  - `calculateProjectGrandTotal(project)`
  - plus `calculateRawPhaseGrandTotal` for the summary's optional
    "saved raw estimate total" on disabled phases.
- `src/domain/factories.ts` — `createDefaultProject()`, `createRole`,
  `createPhase`, `createFeature`, `createTask`, and deep-clone-with-new-IDs
  duplicators. IDs via `crypto.randomUUID()`.
- `src/domain/enabledState.ts` — tri-state (`enabled` / `disabled` /
  `partial`) derivation for parent checkboxes.

Rules enforced here:
- Blank (`null`) estimates count as `0`.
- No derived totals are ever stored on the data.
- Nothing mutates its inputs.

**Tests** (`src/domain/calculations.test.ts`) — the spec's six cases verbatim:
1. All enabled → Dev 5, Artist 3, grand 8.
2. Disabled task excluded but value retained (5 survives in data).
3. Disabled feature excluded from phase total.
4. Disabled phase excluded from project total.
5. Re-enabling a phase restores contribution 0 → 5.
6. Blank treated as 0; `1.5` decimals sum correctly.

Plus: float accumulation on `0.25` steps, empty project, project with zero roles.

**Done when:** all six spec cases pass and coverage of `calculations.ts` is complete.

---

## M2 — Validation, Import & Export

Files:
- `src/domain/schema.ts` — zod schema for `ProjectData` at `schemaVersion: 1`.
- `src/domain/validateImportedProject.ts` — `validateImportedProject(value: unknown): ProjectData`.
- `src/domain/exportProject.ts` — `exportProjectAsJson(project)`, `buildExportFilename(project, date)`.

Validation rules (all from the spec):
- `schemaVersion === 1`; anything else → `Unsupported schema version: N.`
- Missing `phases`/`roles` → `Missing required field: phases.`
- Non-JSON input → `The selected file is not valid JSON.`
- Every role has a non-empty name; duplicate trimmed role names reported.
- Every ID unique across its collection.
- `enabled` boolean required on phase/feature/task.
- Estimates are `null` or non-negative finite numbers — reject `NaN`, `Infinity`, negatives.
- Unknown role IDs in `task.estimates` are stripped (and surfaced as a warning).
- Safe defaults applied: `collapsed=false`, `note=""`, `enabled=true`, `estimates={}`.
- **All-or-nothing**: never partially import.

Export rules:
- Serialize source data only, `JSON.stringify(data, null, 2)`.
- Stamp `exportedAt`, keep `schemaVersion`.
- Filename: `manday-estimate-<slug>-<YYYY-MM-DD>.json`, lowercase, spaces → `-`,
  unsafe characters stripped, empty slug falls back to `untitled-project`.
- Download via `Blob` + object URL, revoked after click.

**Tests** (`schema.test.ts`, `exportProject.test.ts`): each error message shape,
default-filling, estimate rejection, unknown-role stripping, duplicate-name
detection, round-trip export → import equality, filename slug edge cases
(unicode, punctuation, very long names).

**Done when:** every spec'd error message is produced by a matching test, and
export → import round-trips losslessly.

---

## M3 — Storage Repository

**Goal:** persistence entirely behind an interface, so a `FirestoreProjectRepository`
can be dropped in later without touching UI or calculations.

Files:
- `src/storage/ProjectRepository.ts` — the interface, verbatim from the spec:
  `listProjects`, `getProject`, `saveProject`, `deleteProject`. Extended with
  `getActiveProjectId` / `setActiveProjectId` to back the multi-project index.
- `src/storage/LocalStorageProjectRepository.ts` — implementation over key
  `manday-estimator-projects-v1`, shape `LocalProjectIndex { activeProjectId, projects }`.
- `src/storage/useAutosave.ts` — 400 ms debounced save on project change.

Robustness (spec: "Handle corrupted Local Storage without crashing"):
- Unparseable or schema-invalid stored data → move the raw string to a backup
  key (`…-corrupt-backup`), surface an error toast, offer reset, fall back to a
  fresh default project. Never loop.
- `localStorage` unavailable (private mode / disabled) → in-memory fallback
  repository plus a persistent warning banner.

**Tests:** repository CRUD against a fake storage, corrupt-payload recovery,
quota-exceeded handling, debounce behavior with fake timers.

**Done when:** no React file imports `localStorage` directly.

---

## M4 — State Layer

- `src/state/projectReducer.ts` — one immutable reducer covering:
  - project: rename, set note, replace (new / import), touch `updatedAt`
  - roles: add, rename (trim + uniqueness), reorder, remove (and purge that
    role's estimates from every task)
  - phases: add, rename, toggle enabled, toggle collapsed, set note, duplicate, remove, reorder
  - features: same set, scoped to a phase
  - tasks: add, rename, toggle enabled, set estimate, duplicate, remove, reorder
- `src/state/ProjectProvider.tsx` — context wiring reducer + repository + autosave.
- Duplication always regenerates IDs and appends `" Copy"` to the name.
- Reorder implemented as index-move first (`moveUp` / `moveDown`); drag-and-drop
  is layered on in M5 without changing these actions.

**Tests:** each action's immutability (original object untouched), role removal
purging estimates, duplication producing fresh IDs at every depth, name-trim and
empty-name rejection, reorder bounds.

---

## M5 — Core UI

Component tree per the spec:

```
App
├── AppHeader              editable project name
├── ProjectToolbar         New / Import / Export + local-storage warning text
├── RoleManager            add / rename / reorder / remove roles
├── PhaseList
│   └── PhaseCard
│       ├── PhaseHeader    checkbox, name, collapse, duplicate, delete
│       ├── FeatureList
│       │   └── FeatureSection
│       │       ├── FeatureHeader
│       │       ├── TaskTable → TaskRow
│       │       └── FeatureTotalRow
│       ├── AddFeatureButton
│       ├── PhaseTotal
│       └── PhaseNote
```

Shared primitives: `EditableText` (Enter confirms, Escape cancels, trim, restore
previous on empty), `EstimateInput` (`type=number min=0 step=0.25`, `-` when
blank/zero and unfocused, select-on-focus, negatives rejected), `TriStateCheckbox`
(indeterminate for partial parents).

Styling per the spec: light neutral background, white phase cards, sticky table
header, sticky item-name column, horizontal scroll for many roles, dimmed
disabled rows with values still readable, highlighted total rows.

Reordering: move-up/move-down buttons ship in M5; `dnd-kit` drag-and-drop is a
follow-on within the same milestone if time allows (spec explicitly permits
buttons as the fallback).

**Done when:** every acceptance-criteria interaction is performable end-to-end.

---

## M6 — Totals & Project Summary

- `FeatureTotalRow`, `PhaseTotal`, and `ProjectSummary`, all reading the M1
  pure functions — no cached totals anywhere.
- Summary table: one row per phase with status, per-role totals, phase grand
  total; final project-total row.
- Disabled phases stay visible showing `0`s, plus muted secondary text with the
  raw saved total.
- Stacked-card layout for the summary on narrow screens.

---

## M7 — Dialogs, Toasts & Accessibility

- `ConfirmDialog` — used for delete phase/feature/task, delete role holding
  estimates, new project replacing existing work, and import replacing the
  current project. Message includes the impact count
  (`This will permanently remove 3 tasks and their estimates.`).
- `ImportDialog` — file picker restricted to `.json`, validation errors rendered
  in the spec's exact wording, replace-confirmation before any state change.
- `Toast` — save errors, import success, corrupt-storage recovery.
- Accessibility pass: labelled checkboxes, `aria-label` on icon buttons, focus
  trap and Escape handling in dialogs, real `<table>` semantics, enabled/disabled
  state conveyed by badge/text and not color alone, visible focus rings.

---

## M8 — Multiple Local Projects

Spec's preferred implementation, built on M3's repository:

- Project switcher listing saved projects with per-project actions: open,
  rename, duplicate, delete, export.
- `activeProjectId` persisted in the index.
- Import lands as a new project rather than overwriting, when the user chooses.
- Empty state for a first-time visitor.

Fallback: if this milestone threatens the schedule, ship a single active project
— the repository interface stays regardless.

---

## M9 — Deployment & Documentation

- `firebase.json` — `public: "dist"`, SPA rewrite to `/index.html`, spec'd ignores.
- `.firebaserc.example` with `YOUR_FIREBASE_PROJECT_ID`; real `.firebaserc` gitignored.
- `README.md` with the spec's required sections: Features, Requirements, Run
  Locally, Build for Production, Deploy to Firebase Hosting, Update an Existing
  Deployment, Local Storage and Backups, Import and Export JSON, Project
  Structure, Troubleshooting.
- README states plainly that end users need only the public URL, and that this
  version is Hosting-only with no cloud database.
- Production build gate: zero TypeScript errors, `dist/` produced, direct refresh
  works via the SPA rewrite, no dev-only dependency in runtime code.

Explicitly out of scope for v1: Cloud Functions, Cloud Run, SSR, Firestore,
scheduled jobs, paid APIs, Firebase Extensions.

---

## Deferred (spec-listed, not in v1)

PWA installability; hours-per-man-day; cost/currency; dates and calendar
duration; team capacity; risk buffer; best/expected/worst estimates; CSV, Excel,
PDF export; undo/redo; cloud sync; auth; shareable links; templates; role
groups; task dependencies; comments; audit history.

The architecture keeps the door open for Firebase Auth + Firestore: domain types,
calculations, and UI stay Firebase-free, and all persistence goes through
`ProjectRepository`.

---

## Test Strategy

- **Unit (required by spec):** calculations (M1) and import validation (M2) — the
  two areas the spec names explicitly.
- **Unit (added):** reducer immutability and role-removal cascade (M4), repository
  corruption recovery (M3).
- **Manual acceptance:** the spec's acceptance-criteria list, walked before M9 closes.

Component tests are optional; they'd require adding jsdom + Testing Library.

---

## Open Questions

1. **Node version.** Stay on Node 20.13 with Vite 5 (safe, slightly older), or
   upgrade Node to 20.19+/22.12+ and use current Vite? Default if unanswered:
   stay on Vite 5.
2. **Drag-and-drop.** Ship `dnd-kit` in v1, or move-up/move-down buttons only?
   Default if unanswered: buttons in M5, `dnd-kit` only if M5 finishes early.
3. **Multi-project.** Full M8, or single active project behind the repository
   interface? Default if unanswered: build M8 — the spec calls it preferred.
4. **Icons.** Add `lucide-react`, or inline SVG to keep the bundle minimal?
   Default if unanswered: `lucide-react`, since the spec suggests it.
