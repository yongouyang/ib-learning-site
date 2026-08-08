# Phase 1 — Curriculum Foundation: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` (§3 data model, §5 Phase 1).
> Goal: retag all content with stage/course/level so every later phase (difficulty banks, mocks, diagnostics, AI marking) has the taxonomy it depends on — plus minimal stage-aware browsing.
> Sized for: **2 focused sessions** (breakdown in §5). Not recommended as one session.

---

## 1. Scope

**In:**
- Schema/type changes: replace `ibLevel` with `stage` / `year?` / `course?` / `level?`.
- One-time migration script + run it over all 117 topic JSONs.
- Registry, validators, unit tests, e2e updated for the new fields.
- Subject page: topics grouped by stage (+year), filter redesigned (MYP/DP → KS3/IGCSE/DP), badge restyle.
- Trademark disclaimer footer ("not endorsed by or affiliated with the IBO or Cambridge").
- Docs: CONTENT_STYLE.md, AGENTS.md updated with new fields + ID conventions.

**Out (deliberately):**
- **No new content** (no Y9/IGCSE/DP-AA topics) — Phase 1 is plumbing only.
- **No RV-style course cards / home redesign** — premature: only KS3 + DP-AI content exists today. Course cards land when IGCSE/DP-AA content does (Phase 2+).
- No difficulty tags on questions yet (that's Phase 2).

---

## 2. Current state (verified)

- Schema: `src/content/schema.ts` — `ibLevel: z.enum(['MYP','DP'])` required on every topic; mirrored in `src/content/types.ts`.
- Data: 99 topics `"MYP"`, 20 `"DP"`. ID patterns: `math-yr7-*` ×22, `math-yr8-*` ×15, `math-*-myp` ×7, `math-dp-*` ×20, plain `math-*-1` ×4, `bio/chem/phys-*-1` ×36, `eng-*` ×15.
- `ibLevel` consumers: `src/lib/topic-filter.ts` (level filter), `src/components/TopicFilter.tsx` (MYP/DP options), `src/app/subjects/[subjectId]/SubjectPageClient.tsx:76` (badge), unit tests ×5 files (11 refs), e2e `tests/e2e/app.spec.ts` (MYP ref).
- Registry: `scripts/generate-registry.ts` parses each topic via `topicSchema.parse` — picks up schema changes automatically, no generator logic change needed.

---

## 3. Design decisions

### 3.1 New topic fields (replace `ibLevel` entirely)

```ts
stage:  z.enum(['ks3', 'igcse', 'dp'])
year:   z.union([z.literal(7), z.literal(8), z.literal(9)]).optional()  // ks3 only
course: z.string().optional()  // igcse: '0580'|'0610'|'0620'|'0625'|'0500'; dp: 'aa'|'ai'|'bio'|'chem'|'phys'|'langlit'
level:  z.enum(['core', 'extended', 'sl', 'hl']).optional()  // igcse/dp only
```

- Clean replacement, not addition — `ibLevel` is internal-only, no compat shim.
- Validator rules (extend `scripts/validate-content.ts`): `year` ⇒ stage=ks3; `level` ∈ {core,extended} ⇒ stage=igcse; `level` ∈ {sl,hl} ⇒ stage=dp; dp topics require `course`.
- `types.ts` mirrors: `Stage`, `CourseLevel` types; `Topic` updated.

### 3.2 Migration mapping (provisional tags, content review can adjust later)

| Pattern | Files | New tags |
|---|---|---|
| `math-yr7-*` | 22 | stage ks3, year 7 |
| `math-yr8-*` | 15 | stage ks3, year 8 |
| `math-*-myp` | 7 | stage ks3, year 9 *(provisional — matches Y9-ish content)* |
| `math-algebra/fractions/geometry/statistics-1` | 4 | stage ks3, year 7 *(provisional)* |
| `bio-*-1`, `chem-*-1`, `phys-*-1` | 36 | stage ks3, **no year** (KS3 science isn't year-split; schools sequence it) |
| `eng-*` | 15 | stage ks3, no year (year split comes with the Y8/Y9 re-map in the content roadmap) |
| `math-dp-*` | 20 | **renamed to `math-dp-ai-*`** (file + topic `id`; inner note/card/question IDs unchanged); stage dp, course `ai`, level: `hl` for HL-only (complex-numbers, poisson-distribution, graph-theory, hypothesis-testing, matrices), `sl` otherwise *(provisional list in script, flagged for review)* |

Migration script: `scripts/migrate-stage-tags.ts` (tsx, one-time) — explicit per-pattern table above (no guessing from titles), rewrites each JSON in place, prints a review table. Kept in repo for audit, marked one-time. Renames are safe per user decision (localStorage progress is disposable during active development).

### 3.3 UI changes (minimal)

- `topic-filter.ts`: `LevelFilter` → `StageFilter = 'all' | 'ks3' | 'igcse' | 'dp'`.
- `TopicFilter.tsx`: options KS3 / IGCSE / IB DP.
- `SubjectPageClient.tsx`: group topic list by stage → year (KS3 Y7/Y8/Y9 headings, then IGCSE, then DP); badge shows stage (and level for DP); restyle badge colors toward plan tokens (ks3 = accent blue, igcse = amber, dp = navy/purple — final tokens with the Phase-design refresh).
- Home page (`src/app/page.tsx`): unchanged.
- Footer: small server component in `src/app/layout.tsx` with the trademark disclaimer.

---

## 4. Task breakdown (ordered)

**Part A — data model (Session 1, ~2–3 h)**

1. Schema + types changes (`schema.ts`, `types.ts`).
2. Write `scripts/migrate-stage-tags.ts`; dry-run printout; run migration (117 files).
3. Extend `scripts/validate-content.ts` with stage/course/level consistency rules.
4. `npm run generate:registry`; fix fallout.
5. Update `src/lib/topic-filter.ts` + unit tests (`topic-filter.test.ts`, `content-schema.test.ts`, `content-registry.test.ts`, `audit-content.test.ts` — 11 `ibLevel` refs).
6. Gates: validate:content, audit:content, validate:illustrations, validate:illustration-layout, Vitest.

**Part B — browsing + docs (Session 2, ~2–3 h)**

7. `TopicFilter.tsx` stage options; `SubjectPageClient.tsx` grouping + badges.
8. Disclaimer footer in `layout.tsx`.
9. Update e2e (`app.spec.ts` MYP ref + any badge assertions); add a grouping assertion.
10. CONTENT_STYLE.md (new fields, ID conventions for new topics), AGENTS.md (conventions section).
11. Full gates incl. `npm run test:e2e` (no dev server running — known flake, see PROGRESS.md).

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Part A: schema, migration, validators, unit tests | 2–3 h | All 117 topics retagged, `validate:content` + `audit:content` + Vitest green |
| **2** | Part B: UI grouping/filter/badges, footer, e2e, docs | 2–3 h | Full gate suite green incl. e2e; subject pages show stage groups |

Fits in **2 sessions** (same or separate days). One session is possible but tight — the e2e suite alone is ~15 min and any migration surprise eats the budget.

## 6. Risks & watch-items

- **Audit script** (`scripts/audit-content.ts`) may have MYP/DP-aware rules — check before assuming only 4 unit-test files touch `ibLevel`.
- **Provisional tags** (myp→Y9, dp SL/HL split) are marked in the migration output for later content review; they don't block anything.
- **localStorage progress** keys are topic IDs — `math-dp-*` renames orphan any saved DP progress; accepted per user decision (active development phase).
- Registry diff will be huge (every topic gains fields) — expected, review a sample only.
