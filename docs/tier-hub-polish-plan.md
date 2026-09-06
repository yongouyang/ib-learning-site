# Tier-hub polish — 3 waived UX nits + 1 live copy bug

Execution-ready. Source: the 2026-09-06 IGCSE pilot UX-review pass, which flagged three findings
on the two new `/igcse*` pages and waived them **at page level** because they are inherited
verbatim from the `/ks3` pattern. This plan fixes the pattern once, across all three tiers, in
one commit.

**Scope is the six tier-hub route files + `src/lib/seo/hubs.ts` (+1 line in `Breadcrumbs.tsx`).**
Nothing else. Do not refactor the tier pages into a shared component as part of this change —
see "Explicitly out of scope".

---

## 0. Files to touch

| File | Nits |
|---|---|
| `src/app/ks3/page.tsx` | 3 (grid) |
| `src/app/ibdp/page.tsx` | 3 (grid) |
| `src/app/igcse/page.tsx` | 3 (grid) |
| `src/app/ks3/[subjectId]/page.tsx` | 1, 2 |
| `src/app/ibdp/[subjectId]/page.tsx` | 1, 2 |
| `src/app/igcse/[subjectId]/page.tsx` | 1, 2 |
| `src/lib/seo/hubs.ts` | 4 (wrong-tier description copy) |
| `src/components/Breadcrumbs.tsx` | +1 line (`aria-current` on the heading branch) |
| `tests/unit/seo.test.ts` | regression test for nit 4 |
| `docs/PROGRESS.md`, `docs/UX_GUIDELINES.md` | entry + note (see §6) |

The `ks3` and `igcse` pairs are near-identical (only the tier key and comments differ).
`ibdp/[subjectId]` differs: it groups by `COURSES`, not `groupTopicsByStage`. Apply each rule
per-file in its own idiom — do **not** unify them.

---

## 1. Nit 1 — lone group `h2` restates the `h1`

**Symptom:** `/igcse/math` renders `<h1>IGCSE Maths</h1>` then a lone `<h2>IGCSE (10)</h2>`.
A single group heading carries no information — the tier is already in the `h1` and the count is
already in the intro paragraph.

**Fix:** render the group heading only when there is more than one group. Keep the `<section>` and
its `aria-label` (it stays the landmark), drop only the `h2`.

- `ks3/[subjectId]/page.tsx` (~L46-55) and `igcse/[subjectId]/page.tsx` (~L46-55):
  wrap the `<h2>` in `{groups.length > 1 && ( ... )}`.
- `ibdp/[subjectId]/page.tsx` (~L50-59): same, on `sections.length > 1 &&`.

Exact shape (ks3/igcse):

```tsx
{groups.map((group) => (
  <section key={group.key} aria-label={group.label}>
    {groups.length > 1 && (
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {group.label}
        <span className="ml-1.5 font-normal normal-case">({group.topics.length})</span>
      </h2>
    )}
    <div className="space-y-3">
```

Note: with a single group the `mb-2` on the `h2` disappears, so the first card sits `6px` higher —
that is correct, the section wrapper already has `space-y-6`.

---

## 2. Nit 2 — last breadcrumb ≡ `h1`

**Symptom:** `/igcse/math` trail is `Home › IGCSE › IGCSE Maths`, and the `h1` immediately below
it is `IGCSE Maths`. Same on `/ks3/<subject>` and `/ibdp/<subject>`.

**Fix:** use the component's existing `currentAsHeading` prop — the sanctioned pattern, already
used by 10 pages (`/exams`, `/progress`, `/account`, `/leaderboard`, `/mixed-review`, the two admin
consoles, `PaperRunnerClient`). The trail's last item becomes the `h1`; delete the separate `h1`
element.

- In the three `[subjectId]/page.tsx`: add `currentAsHeading` to `<Breadcrumbs ... />` and remove
  the `<h1 ...>{title}</h1>` line (ks3/igcse L41, ibdp L45).

**Do NOT change the three tier hub pages** (`/ks3`, `/ibdp`, `/igcse`): there the last crumb is
`KS3` and the `h1` is `KS3 revision` — they are not identical, and folding them would demote the
`h1` from "KS3 revision" to "KS3" (worse SEO copy for no gain). The reviewer did not flag them.

**One-line follow-on in `src/components/Breadcrumbs.tsx` (L27-31):** the `currentAsHeading` branch
renders an `<h1>` and, unlike the `<span>` branch, does not set `aria-current="page"`. Add it, so
we do not trade a duplicate-string nit for an a11y regression:

```tsx
<h1
  aria-current="page"
  className="text-2xl font-bold text-gray-900 dark:text-gray-50 truncate max-w-[45vw] md:max-w-xs"
>
```

This also improves the 10 existing pages. Zero visual change.

**Truncation check (already done):** the longest in-page title today is `IB DP Maths` (11 chars);
the heading branch caps at `45vw` ≈ 169px at 375px, which fits. `subjectSeoName` shortens
`Mathematics` → `Maths` in-page too (verified against dev).

---

## 3. Nit 3 — mobile grid is 2-col, guideline says 1-col

`docs/UX_GUIDELINES.md` L14: *"grids (subject cards, pillars) are 1-col on mobile, multi-col from
`sm:`/`md:`"*.

**Fix** in all three tier hub pages (ks3 L24, ibdp L25, igcse L25):

```diff
-<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
+<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
```

---

## 4. Nit 4 (NOT in the review — live copy bug, fix in the same commit)

`src/lib/seo/hubs.ts` has only two description branches, `ks3` and "everything else", so the whole
IGCSE leg shipped with **IB Diploma copy**. Verified live on dev:

- `https://dev.octavlearning.com/igcse` → `"10 IB Diploma Programme topics — illustrated notes…"`
- `https://dev.octavlearning.com/igcse/math` → `"10 IB DP Maths topics — …"`

Both are indexable pages, so this is the kind of thing Google shows in the SERP. Fix:

`metaForTierHub` (~L75-79) — add an `igcse` branch:

```ts
const description =
  tier === 'ks3'
    ? `${count} KS3 topics across ${hubs.length} subjects — illustrated notes, flashcards and marked quizzes for Years 7–9. Free to start.`
    : tier === 'igcse'
      ? `${count} IGCSE topics across ${hubs.length} ${hubs.length === 1 ? 'subject' : 'subjects'} — illustrated notes, flashcards and marked quizzes. Free to start.`
      : `${count} IB Diploma Programme topics — illustrated notes, flashcards and practice questions with worked answers. Free to start.`;
```

`metaForTierSubject` (~L88-92) — same:

```ts
: tier === 'igcse'
  ? `${hub.topics.length} IGCSE ${seo} topics — illustrated notes, flashcards and a marked quiz on every topic. Free to start.`
  : `${hub.topics.length} IB DP ${seo} topics — illustrated notes, flashcards and practice questions with worked answers. Free to start.`;
```

Also update the two stale comments in that file: L15 (`"IGCSE has zero topics today"`) and L70
(`/ks3 | /ibdp` → all three tiers).

---

## 5. Tests

- `tests/unit/seo.test.ts` — extend the IGCSE block (~L116) with a regression guard, so the wrong-tier
  copy can never come back:
  ```ts
  expect(igcseMath.description as string).toContain('IGCSE');
  expect(igcseMath.description as string).not.toContain('IB DP');
  ```
  and the same pair for `metaForTierHub('igcse')`.
- No e2e churn expected: `tests/e2e/seo.spec.ts` L79-83 asserts `<title>`s only, and nothing in the
  suite asserts an `h1` on a hub page (grepped — the only `getByRole('heading')` assertions are in
  quiz/paper unit tests). If an e2e fails on a missing `h1`, the `currentAsHeading` migration missed
  a file — fix the file, do not delete the assertion.
- Nits 1 and 3 are visual; they need no unit test (the UX pass in §7 is the gate).

## 6. Docs

- `docs/PROGRESS.md` — prepend one entry (format in `AGENTS.md`), recording: 3 nits fixed across 6
  files, the nit-4 copy bug found and fixed, gates run, and that the page-level waiver is retired.
- `docs/UX_GUIDELINES.md` — NOT required. If you want to prevent recurrence, add one line under L14
  noting the breadcrumb rule ("when the trail's last crumb duplicates the page `h1`, use
  `Breadcrumbs currentAsHeading` instead of rendering both"). Optional; keep it to one line.

## 7. Gates (all must pass)

```bash
npx tsc --noEmit
npm run lint                 # 0 errors (27 warnings = documented baseline)
npm test                     # full Vitest
npm run build:static         # includes verify:sitemaps — expect 328 URLs, unchanged
npx playwright test tests/e2e/seo.spec.ts --project='Desktop Chrome' --workers=1
```

**UX pass (required by `AGENTS.md`):** 6 changed surfaces × 375px + 1280px × light + dark = 24
screenshots, reviewed by a fresh-context subagent against `docs/UX_GUIDELINES.md`; fix or consciously
waive each finding. Precedent script: `scripts/capture-admin-ux.mjs` (starts a throwaway `next dev`
on port 3230, forces the theme via `localStorage.setItem('iblearn-theme', …)`, writes to a
gitignored `ux-screenshots/` dir). Copy it as `scripts/capture-hub-ux.mjs` — it needs **no sign-in**
(hubs are public), so drop the `signIn`/dummy-auth half. Pages:
`/ks3`, `/ks3/math`, `/ks3/english` (multi-group), `/ibdp`, `/ibdp/math`, `/igcse`, `/igcse/math`
(7 — include `/ks3/english` as the multi-group control so the `h2` still renders where it should).

## 8. Commit

One commit, on `develop`:

```
fix(seo): tier-hub polish — lone group heading, crumb/h1 duplication, mobile 1-col, IGCSE copy
```

## 9. Explicitly out of scope

- **Extracting a shared tier-hub component.** The three `[subjectId]` pages are copy-paste siblings
  and the `ibdp` one genuinely differs (course grouping vs stage grouping). Collapsing them is a
  real refactor with a real blast radius; do it as its own change if it ever earns it, not here.
- **`src/components/HomePageClient.tsx` L157** carries the identical `grid-cols-2 md:grid-cols-3`
  class. Not flagged, different surface, home has its own width primacy — leave it.
- **`Breadcrumbs` + separate `h1` on study/quiz/flashcard pages** (last crumb ≡ `h1` there too).
  Same nit, much larger surface; this commit only retires it for the tier hubs.
- Anything in `src/lib/seo/hubs.ts` beyond the two description branches and the stale comments.

## 10. Coordinate before you start

This plan was written while a `deploy-prod` for `main` @ `7b3dad7` was still in flight, with a
background task that rebuilds `out/` locally and runs `verify:seo:live --all` (it compares live prod
HTML against the **local** build). Editing `src/` in the same working tree mid-run would make that
comparison fail spuriously. Wait for the promote to land, or work in a separate git worktree.
