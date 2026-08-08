# Phase 6 — Progress Analytics & Flashcard Upgrade: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 6.
> Goal: RV-style Seen/Known dual-ring donut for flashcards, flashcard self-sorting ("I know this / Still learning") feeding the Known ring, spaced-repetition re-surfacing of due cards, and per-topic mastery bars from quiz history.
> Sized for: **2 focused sessions** (breakdown in §5).
> Depends on: progress-store v1 (Phase 3), quiz attempt history (exists), flashcards page (stateless today).

---

## 1. Scope

**In:**
- Flashcard state in localStorage (storage **v2**, additive): per-card `{ status: 'known' | 'learning', lastReviewed, knownStreak }`.
- Self-sorting UI on the flashcards page: two buttons per card ("Still learning" / "I know this") that record state and advance; deck-completion stats; "review still learning" re-run.
- `DualRingDonut` component (hand-rolled SVG — no chart lib): outer ring Seen %, inner ring Known %, center label. Used on the flashcards page header and the progress page.
- Spaced repetition: known cards schedule by streak (`[1, 3, 7, 16, 35]` days, SM-2-simplified); learning cards always due. Due surfacing: homepage "Flashcards due" card (top topics by due count, deep links) + due-filtered deck mode on the existing flashcards page.
- Per-topic mastery bars: subject-page topic rows show recent-average mastery (data already exists via `getRecentAverageScore`); progress page per-subject summary gets the same.
- Tests + docs.

**Out (deliberately):**
- **No per-question history** (again) — mastery stays attempt-aggregate. Question-level analytics would need the deferred storage migration.
- **No RV-style course cards redesign** (parent plan §6) — bars/donut bolt onto existing cards.
- **No cross-topic "due deck" page** — due review happens per topic (due filter on the existing flashcards page); a global due deck is a later nicety.
- **No FSRS/full SM-2** — fixed interval ladder is honest and sufficient at this scale.

---

## 2. Current state (verified at planning time)

- Flashcards page (`FlashcardsPageClient.tsx`): flip animation + prev/next + completion screen. **Zero state recorded** — perfect blank canvas, no migration of behavior.
- Storage: `progress-store.ts` v1 (`version` stamped, `examResults`/`ladderProgress` additive pattern proven). localStorage mocking pattern in `progress-store.test.ts`.
- Mastery data: `getRecentAverageScore(attempts)` (last-5 mean) already powers weak areas; subject-page topic rows already render per-topic % text (`SubjectPageClient.tsx`) — adding a bar is presentation-only.
- Donut: no chart lib in the project (per parent plan: hand-rolled SVG for two rings).
- Content: 129 topics × 12 flashcards = 1,548 cards, stable IDs (`<topic-id>-f<n>`) — cardId keys are safe.

---

## 3. Design decisions

### 3.1 Storage v2 (additive, same pattern as v1)

```ts
export interface FlashcardProgress {
  status: 'known' | 'learning';
  lastReviewed: string; // ISO
  knownStreak: number;  // consecutive "I know this" marks (drives interval)
}
// StoredData gains: flashcardProgress?: Record<string /* cardId */, FlashcardProgress>
// STORAGE_VERSION 1 -> 2 (additive optional field; v1 payloads load with defaults)
```

- progress-store: `recordFlashcardResult(cardId, status)` (sets status, bumps/resets streak, stamps lastReviewed; updates streak-day + a small star reward? — **decision: no stars for flashcards**; stars stay quiz/exam-only to avoid double-counting study effort. Streak-day DOES update — reviewing flashcards is study activity), `getFlashcardProgress()`.
- Intervals: `KNOWN_INTERVALS_DAYS = [1, 3, 7, 16, 35]` indexed by min(streak-1, 4); learning cards are always due.

### 3.2 Flashcards page upgrade

- Buttons appear **after flip** (judging a card you haven't seen the back of is meaningless): "Still learning" (amber) / "I know this" (green). Clicking records + advances (flip back to front). Replaces the plain "Next" as the primary path; Previous stays for navigation (no state change).
- Deck modes via searchParam `?filter=learning|due` (default all): deck = filtered subset (learning: status learning or never seen... **decision**: learning = explicitly marked learning; due = learning ∪ overdue known).
- Completion screen: stats (X known / Y learning) + "Review still learning" (re-runs with learning filter) + existing Review Again / Take Quiz.
- `DualRingDonut` in the header next to the counter: Seen = reviewed ≥1× / total; Known = known / total.

### 3.3 Donut component

`src/components/DualRingDonut.tsx` — props `{ seen: number, known: number, total: number, size?: number }`; two SVG circles with strokeDasharray fractions (seen = track color, known = accent green), center "known/total". SSR-safe (pure SVG, no animation lib).

### 3.4 Mastery bars

- `SubjectPageClient` topic rows: thin bar under the row using `getRecentAverageScore` (unattempted = empty track). No layout restructure — bar replaces/augments the existing % text.
- Progress page per-subject cards: same bar treatment (they already compute avgScore — add the bar, plus flashcard Known % via the donut in mini form next to the subject name).

### 3.5 Due surfacing (homepage)

- Homepage card (shown when dueCount > 0, replaces/companions the diagnostics cold-start card which only shows when no weak areas): "N flashcards due for review" with top-3 topics by due count, each linking to `/subjects/<sid>/<tid>/flashcards?filter=due`.

### 3.6 Tests

- Unit: storage v2 round-trip + v1-legacy payload loads with flashcard defaults; interval ladder + due computation (`getDueCards` with fixed "now"); deck filtering (learning/due subsets); donut renders correct dash fractions (component test).
- E2E: mark cards known/learning → completion stats correct; "review still learning" filters deck; due card appears on homepage after seeding an overdue card via addInitScript (established pattern); mastery bar visible after a quiz attempt (seeded attempts).

---

## 4. Task breakdown (ordered)

**Session 1 — storage + self-sorting + donut**
1. types + progress-store v2 (`FlashcardProgress`, `recordFlashcardResult`, `getFlashcardProgress`, version 2).
2. `src/lib/flashcard-scheduler.ts`: interval ladder, `getCardStats(topic, progress)`, `getDueCards(topics, progress, now)`, deck filter helper.
3. `DualRingDonut` component.
4. FlashcardsPageClient: post-flip self-sort buttons, `?filter=` modes, completion stats + review-learning, header donut.
5. Unit tests (storage, scheduler, filters, donut).

**Session 2 — mastery bars + due surfacing + wrap**
6. Subject-page topic-row mastery bars; progress-page subject bars + mini donut.
7. Homepage "Flashcards due" card + deep links.
8. E2E (self-sort flow, filters, due card via seeded storage, mastery bar).
9. Docs (AGENTS.md conventions if changed, PROGRESS.md); full gates.

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Storage v2, scheduler lib, donut, flashcards-page self-sorting | 2–3 h | Self-sorting works end-to-end; unit tests green |
| **2** | Mastery bars, due surfacing, e2e, docs | 2–3 h | Full gate suite green incl. e2e |

## 6. Open questions (resolve in Session 1)

1. **Stars for flashcards?** Default: no (stars stay quiz/exam); streak-day updates. Flag if you disagree.
2. **"Learning" definition for filtering**: explicitly-marked learning only (default) vs including never-seen. Default: explicitly marked (never-seen cards aren't "weak", they're new).
3. **Interval ladder** `[1,3,7,16,35]` — tune after a week of real use; it's one constant.
