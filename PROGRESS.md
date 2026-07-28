# IBLearn Progress Log

> Append-only journal of work sessions. **Newest entry at the top.**
> Read the last 2–3 entries before starting work; append one entry when done.
> See `AGENTS.md` for the entry format rules.

---

## 2026-07-28 — Phase 7 Session 2: install UX, update toast, e2e, content-protection add-on

Git HEAD: `b2949e9` (branch `develop`, tree dirty — not committed)
Done:
1. **Install UX**: `useInstallPrompt` (captures `beforeinstallprompt`, iOS + standalone detection) + `InstallAppButton` on progress page (Chromium prompt flow; iOS shows Share → Add to Home Screen; hidden when installed/not installable).
2. **Update toast** `UpdateToast.tsx`: prompts when a SW update sits in `waiting`; Refresh posts `SKIP_WAITING`, reloads on `controllerchange`. **Bug found via e2e**: reload was ungated — first-install `clients.claim()` fires `controllerchange`, which would have force-reloaded first-time visitors (and raced Playwright's `page.reload` → ERR_ABORTED). Now gated on the user clicking Refresh.
3. **Registration bug found via e2e**: `ServiceWorkerRegistration` waited for window `load`, which fires before hydration in prod — the SW silently never registered. Now registers immediately when `document.readyState === 'complete'`; unit tests updated for both paths.
4. **Content-protection add-on** (plan §8 items 1–2, user-approved): `src/app/robots.ts` (allow-all + disallow for 10 AI-training crawlers), footer copyright line + `/terms` link, static `/terms` page (all-rights-reserved, no-AI-training, IBO/CAIE disclaimer).
5. **Tests**: unit +12 (install button ×6, update toast ×7) + `pwa-sw.test.ts` ×9 (mocked SW env: precache, cache-first, SWR, /api passthrough, /offline fallback, SKIP_WAITING, old-cache cleanup); e2e `pwa.spec.ts` ×5 (prod-only: manifest/icons, SW activation, offline reload, offline Mark-with-AI hidden, install button) + app.spec content-protection ×2.
Verified: Vitest 242/242 ✅, tsc ✅, lint 0 warnings ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, `pwa.spec.ts` prod run 13 passed / 2 skipped (mobile install variants) ✅, full e2e **552 passed** / 21 skipped / 0 failed ✅.
Next: deploy + plan §6 launch checks (verify `sw.js` Cache-Control on Vercel, manual install on iOS Safari + Chromium desktop, Lighthouse PWA audit). Phase 7 complete otherwise. Backlog unchanged: English strand re-map (needs user decision), DP AA, IGCSE content, design refresh. Deploy note unchanged: AI feedback env-gated until Moonshot key set.
Notes: (1) Chromium offline emulation does NOT apply to fetches made by the SW — the /offline-fallback-for-unvisited-route scenario can't be e2e-tested via `context.setOffline`; it lives in `pwa-sw.test.ts` instead. (2) "Install button hidden before prompt" is also unit-only — in a prod build with an active SW, Chromium may fire a real `beforeinstallprompt` at any time. (3) Node's Request constructor rejects `mode: 'navigate'` — patch the getter in tests.

---

Git HEAD: `e6c9249` → pushed `c639505` (branch `develop`, tree clean)
Done:
1. **Manifest + icons**: `src/app/manifest.ts` (standalone, education, brand blue #2563eb); `public/icons/icon.svg` (maskable-safe "IB" monogram) + `scripts/generate-icons.mjs` (Playwright-screenshot PNGs: 192/512/maskable-512/apple-180 — committed, no new deps). Icon verified visually.
2. **Service worker** `public/sw.js` (hand-rolled per plan §3.2): precache `['/', '/offline']`, cache-first `/_next/static` + `/icons`, SWR pages/images, network-only `/api/**`, `/offline` navigation fallback, `CACHE_VERSION` constant, `SKIP_WAITING` message listener ready for Session 2 (no skipWaiting on install).
3. **Offline UX**: `src/app/offline/page.tsx` fallback; `ServiceWorkerRegistration` (prod-only, fail-safe); `useOnlineStatus` + dismissible `OfflineBanner` (sits above mobile bottom nav, resets dismissal when back online). Layout gains `appleWebApp` + light/dark `themeColor`.
4. **Unit tests** ×3 new files (`pwa-*.test.tsx`): registration gating, online-status transitions, banner render/dismiss. 220 total.
Verified: Vitest 220/220 ✅, tsc ✅, lint 0 warnings ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **545 passed** / 6 skipped / 1 failed — failure = iPhone SE diagnostics flake, passes standalone re-run (3/3) ✅; unrelated to PWA changes (dev-server run, SW disabled).
Next: Phase 7 Session 2 — install button on progress page (`useInstallPrompt`, iOS Share→Add-to-Home-Screen fallback), update toast (SKIP_WAITING + controllerchange), `tests/e2e/pwa.spec.ts` (prod-build, Chromium SW cases: manifest, activation, offline reload, /offline fallback, Mark-with-AI hidden offline), AGENTS.md convention entry. Post-deploy checks (plan §6): verify sw.js Cache-Control on Vercel, Lighthouse PWA audit. Backlog unchanged: English strand re-map (needs user decision), DP AA, IGCSE content, design refresh. Deploy note unchanged: AI feedback env-gated until Moonshot key set.
Notes: SW inactive in dev/e2e (registration is prod-gated) — e2e SW coverage must use the `E2E_PROD=1` prod-build pattern from `test:e2e:sweep`.

---

## 2026-07-27 — Phase 7 (PWA) implementation plan

Git HEAD: `e6c9249` (branch `develop`, tree dirty: new plan file)
Done: `phase-7-implementation-plan.md` written (2 sessions). Key decisions: hand-rolled `public/sw.js` (no serwist/workbox — runtime caching: cache-first `/_next/static`, SWR pages/images, network-only `/api/**`, `/offline` fallback); manifest via `app/manifest.ts`; icons generated from one maskable-safe SVG via Playwright-screenshot script (no new deps); user-resolved: install button on progress page (passive, no pop-ups), "IB" monogram icon. Site is fully static (all routes `generateStaticParams`), so offline story is strong; AI feedback already degrades (button hides on failed configured-check).
Verified: plan only — facts verified by reading code (no SW/manifest/icons exist today; registry statically bundles all content).
Next: Phase 7 Session 1 — manifest + icons + sw.js + /offline + registration + offline banner + unit tests. Backlog unchanged: English strand re-map (needs user decision), DP AA, IGCSE content, design refresh. Deploy note: AI feedback env-gated until Moonshot key set in Vercel.
Notes: plan §6 launch checks — after deploy verify `sw.js` Cache-Control header on Vercel + Lighthouse PWA audit.

---

## 2026-07-26 — Unit-coverage review + gap-closing batch + coverage gate

Git HEAD: `900d7e3` → pushed `e6c9249` (branch `develop`, tree clean)
Done:
1. **Coverage measured** (`@vitest/coverage-v8`, new dev dep): raw e2e/unit ratio was misleading (546 e2e = ~182 cases × 3 projects vs 190 unit). Real gaps: openai-compatible provider 4%, ProgressContext 0%, runner non-happy paths (fan-out/record-guard/lock), PaperRunnerClient timer expiry.
2. **+17 unit tests (190→207)**: `feedback-openai-compatible.test.ts` ×6 (mocked fetch: request shape, parse, retry-once, double-malformed, non-OK, no-content → provider 100%); `progress-context.test.tsx` ×4 (storage load + loaded flag, 3 record functions → context 85%); `runner-clients.test.tsx` ×5 (diagnostic fan-out aggregation, exam record-once-after-Try-Again, ladder locked/unlocked/fraction); paper-runner ×2 (timer expiry zero-attempt + mid-paper).
3. **Coverage gate**: `npm run test:coverage`; vitest.config per-path thresholds — lib 90/85, components 70/70, context 75/50, api 85/75 (set below measured: 93.6/95/83/77). Page-level components deliberately excluded — e2e owns them (jsdom duplication = maintenance cost, low signal).
Verified: Vitest 207/207 ✅, coverage thresholds pass ✅, tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **546 passed** / 6 skipped / 0 failed ✅.
Next: Phase 7 (PWA) or backlog — English strand re-map (needs user decision), DP AA, IGCSE content, design refresh. Deploy note unchanged: AI feedback env-gated until Moonshot key is set in Vercel.
Notes: test lessons — (1) QuizGame seeds shuffle questions, so runner tests must answer by reading the on-screen stem, not position; (2) `userEvent` hangs under `vi.useFakeTimers` — use `fireEvent` in fake-timer tests; (3) module-level mock fns need `mockClear()` in beforeEach (cross-test leakage).

---

Git HEAD: `77f25ab` → pushed `900d7e3` (branch `develop`, tree clean)
Done:
1. **Mastery bars**: subject-page topic rows show thin bar + % from `getRecentAverageScore` (aria-label "Mastery X%"); progress-page subject cards gained a mini Seen/Known donut aggregating all decks in the subject.
2. **Homepage due card**: "N flashcards due for review" (top-3 topics, per-topic counts) deep-linking into `?filter=due` decks.
3. **Hydration bug fixed (caught by new e2e)**: filtered decks (`learning`/`due`) were built during SSR with empty progress and — because of the deliberate deck-stability memo — never rebuilt; real users would have seen "Nothing here". Fix: `loaded` flag on ProgressContext (true after first localStorage load); filtered decks wait for it ('all' mode unaffected).
Verified: `flashcard-progress.spec.ts` 12/12 ✅ (persistence + donut, seeded due/learning filters, due-card deep link, mastery bar), Vitest 190/190 ✅, tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **546 passed** / 6 skipped / 0 failed ✅ (one mixed-review iPhone SE timeout flake in the first run — passes standalone and in the confirmation run).
Next: Phase 7 — platform (PWA: offline content, install prompt; accounts/sync explicitly deferred to the future cloud phase). Backlog: English strand re-map (needs user decision), DP AA, IGCSE content, design refresh (parent plan §6 tokens).
Notes: all 6 planned phases now shipped. Deploy state: AI feedback still env-gated (no FEEDBACK_* on Vercel — button hidden) per user's pending Moonshot key decision. Interval ladder `[1,3,7,16,35]` is one constant to tune after real usage (plan §6.3).

---

Git HEAD: `af4a4b0` → pushed `77f25ab` (branch `develop`, tree clean)
Done:
1. **`phase-6-implementation-plan.md`** written (2 sessions; open decisions: no stars for flashcards, learning = explicitly marked, interval ladder tunable).
2. **Storage v2**: `flashcardProgress: Record<cardId, {status, lastReviewed, knownStreak}>` — additive, v1 payloads default cleanly, save stamps v2. Known bumps streak, learning resets; day-streak counts card review, stars stay quiz/exam-only.
3. **`flashcard-scheduler.ts`**: `KNOWN_INTERVALS_DAYS = [1,3,7,16,35]` (capped by streak), `isCardDue` (learning always due; never-seen NOT due), `getCardStats`, `filterDeck` (all/learning/due), `getDueTopics` (descending).
4. **`DualRingDonut`**: pure-SVG dual ring (Seen outer blue / Known inner green), center %, aria label, no chart lib.
5. **Flashcards page**: post-flip self-sort buttons (Still learning amber / I know this green — forward path now requires a judgment); `?filter=learning|due` modes + empty states; completion stats with session known/learning counts + "Review still learning"; header donut; Suspense wrapper for useSearchParams. Deck frozen per session (marking known can't shrink a filtered deck mid-run).
Verified: Vitest 190/190 ✅ (+14: scheduler ×9, storage v2 ×2, donut ×3, version-stamp fix ×1), tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, updated flashcards.spec + full-topic-journey.spec for new UX ✅, full e2e **534 passed** / 6 skipped / 0 failed ✅.
Next: Phase 6 Session 2 (final) — mastery bars on subject-page topic rows + progress-page subjects, homepage "Flashcards due" card with deep links (`?filter=due`), e2e (self-sort flow, filters, due card via seeded storage, mastery bar), docs.
Notes: two existing e2e specs used the old Next/Finish flashcard nav — updated to flip + "I know this". `deck` useMemo deliberately excludes flashcardProgress from deps (session stability) with an eslint-disable note.

---

Git HEAD: `84245fe` → pushed `af4a4b0` (branch `develop`, tree clean)
Done:
1. **Runner UI**: "Mark with AI" button in PaperRunnerClient mark stage — hidden unless `GET /api/feedback` reports configured; loading state; on success ticks pre-fill from `perPoint`, per-point comments under each checklist row, overall feedback banner (purple); 429 → "marker is busy", other errors → "unavailable, mark yourself"; students can override ticks (self-marking stays source of truth). AI state resets per question / on retry.
2. **E2E** (`tests/e2e/ai-feedback.spec.ts`, 15/15): webServer env `FEEDBACK_PROVIDER=dummy` + `FEEDBACK_TEST_MODE=1` in playwright.config; per-case injection via `page.route` POST-body rewrite + `route.fetch` (tests hit the REAL route). Cases: default dummy, injected mark pattern + student override, malformed injection → banner, 429 handling, unconfigured degradation.
3. **Docs**: `docs/ai-feedback.md` (providers, env table, zero-token local dev, curl + production-repro workflow, test commands, Vercel rollout incl. Moonshot open-platform key guidance + per-instance rate-limit caveat, contract); AGENTS.md — dummy-provider testing mindset is now a standing convention.
Verified: Vitest 176/176 ✅, tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, ai-feedback spec 15/15 ✅, full e2e **534 passed** / 6 skipped / 0 failed ✅.
Next: Phase 6 — progress analytics & flashcard upgrade (dual-ring donut, per-topic mastery from quiz history, flashcard self-sorting feeding Known ring, spaced repetition). Backlog: English strand re-map (needs user decision), DP AA, PWA, IGCSE content. **Deploy note**: production currently runs with NO FEEDBACK_* env → AI button hidden; add the Vercel env vars per docs/ai-feedback.md to go live.
Notes: injection is dummy+test-mode only, production logs a warning if test mode is ever on. Live contract test still unused (needs a real key): `FEEDBACK_LIVE=1 FEEDBACK_API_KEY=... npx vitest run --config vitest.live.config.ts`.

---

Git HEAD: `c2ea83c` → pushed `84245fe` (branch `develop`, tree clean)
Done:
1. **`phase-5-implementation-plan.md`** (user-guided): provider abstraction with standing testing mindset — unit tests mock, e2e/local use a **Dummy provider with default + per-test injected responses** (injection path doubles as production-issue reproduction); Kimi token guidance: dedicated Moonshot open-platform key (NOT a CLI subscription credential), server-side env only, rate limits + budget alerts, deploy with no key first.
2. **`src/lib/feedback/`**: zod contract (answer ≤2000 chars, ≤10 marks); `DummyFeedbackProvider` (default all-awarded + `FEEDBACK_DUMMY_RESPONSE` override); `OpenAICompatibleProvider` (plain fetch, JSON mode, temp 0, 30s timeout, one retry on malformed output); env-switch factory.
3. **`/api/feedback`**: GET (configured check, no key leak) + POST (zod → per-IP sliding-window rate limit, env-tunable, per-instance caveat documented → provider → same zod schema for real AND injected results → **marks recomputed server-side**). `_testResponse` honored only when `FEEDBACK_PROVIDER=dummy` + `FEEDBACK_TEST_MODE=1` (+ production warning log). 400/429/501/502 semantics.
4. **Tests**: 13 unit (route via real env-wiring, unique IP per test for rate-limit isolation; dummy provider). Live contract test `tests/live/` + `vitest.live.config.ts` (opt-in: `FEEDBACK_LIVE=1 FEEDBACK_API_KEY=... npx vitest run --config vitest.live.config.ts`).
Verified: Vitest 176/176 ✅ (+13), tsc ✅, validate/audit/illustrations ✅, curl smoke on dev server (GET configured, dummy default, injection with marks-recompute) ✅, full e2e **519 passed** / 6 skipped / 0 failed ✅.
Next: Phase 5 Session 2 — PaperRunnerClient "Mark with AI" (configured check via GET, tick pre-fill, per-point comments, loading/error states), e2e (default dummy / injected patterns / malformed / 429 / unconfigured-degradation), `docs/ai-feedback.md` (env, Vercel, Moonshot key, prod-repro workflow), AGENTS.md mindset entry.
Notes: **dev-server lesson**: `kill` on `npx next dev` only kills the wrapper — orphaned `next-server` kept running, fought Playwright's server over `.next`, corrupted a manifest JSON (154 identical JSON.parse failures). Kill by process group / `pkill -f "next dev --port N"`; `rm -rf .next` fixes the corruption. Rate-limit consts are read per-request (not module-level) so tests can stub env.

---

Git HEAD: `5ac6c4e` → pushed `c2ea83c` (branch `develop`, tree clean)
Done:
1. **Cross-links**: every /exams course card now links to its free-response set(s) via `getPapersForCourse` (purple accent matching /papers) alongside the ladder link.
2. **Docs**: CONTENT_STYLE.md "Practice papers" section (papers tree, exactly-20-marks rule, M1/A1/B1 markscheme style with independently-awardable points, original-questions legal constraint, non-calc, English stimulus rules); AGENTS.md conventions (papers tree, `courses.ts` as course-grouping source, registry regen covers papers, difficulty tags required for FR too).
Verified: exams spec 12/12 ✅ (incl. new cross-link test ×3 projects), Vitest 163/163 ✅, tsc ✅, generate:registry (8 papers) ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **519 passed** / 6 skipped / 0 failed ✅.
Next: Phase 5 — AI feedback (user-approved API route): `app/api/feedback/route.ts` serverless, sends student free-response + markscheme points to an LLM, returns marks + feedback; rate-limited, key in env (never client-side), graceful degradation to self-marking. The PaperRunnerClient already keeps the `{questionId, studentAnswer, ticks}` payload shape. Backlog: English strand re-map (needs user decision), DP AA, PWA, per-question history (Phase 6).
Notes: Phase 4 complete per plan (schema/pipeline/pilot, 8 sets authored+verified, integration/docs). "Mark with AI" slots into the runner's mark stage — pre-fills the checklist instead of replacing self-marking.

---

Git HEAD: `c9f9360` → pushed `5ac6c4e` (branch `develop`, tree clean)
Done:
1. **7 sets authored** (swarm, one per remaining course): math-y8 (8q/30min), math-y9 (9q/30min), math-dp-ai (9q/35min), eng-ks3 (8q/25min, 2 original stimulus passages + original stanza), bio-ks3 (8q/25min), chem-ks3 (7q/25min), phys-ks3 (8q/25min). All: 100% original questions, exactly 20 marks, M1/A1/B1 markschemes, easy→hard ramp (~30/40/30), non-calculator, ≥5 distinct topics per set.
2. **Independent verification agent** re-derived every hard + first-medium question per set and skimmed the rest: **all 7 PASS** — no wrong answers, markscheme↔model consistent, no phantom quotations (English quotes verified verbatim), all non-calc. Nit noted: eng q5 "needled" as personification — defensible at KS3, no change.
3. **Registry**: 8 papers. validate:content + audit:content 0/0.
4. **E2e spec fix** (own bug): `Practice Set 1` link locator matched 8 elements once all sets shared the title — scoped by href; added assertion that all 8 sets are listed.
Verified: Vitest 163/163 ✅, tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **516 passed** / 6 skipped / 0 failed ✅ (after spec fix re-run).
Next: Phase 4 Session 3 (final) — cross-links from /exams course cards to paper sets, CONTENT_STYLE.md (markscheme style + papers tree) + AGENTS.md (papers conventions) docs, final gates. Then Phase 5 — AI feedback (API route, mark with LLM, graceful fallback to self-marking).
Notes: e2e lesson — shared titles across sets break role-based locators; scope by href for set links. math-dp-ai set is non-calc practice despite real AI papers allowing GDC (documented caveat, plan §1).

---

Git HEAD: `b885dac` → pushed `c9f9360` (branch `develop`, tree clean)
Done:
1. **Schema/pipeline**: `freeResponseQuestionSchema` (zod `.refine`: markscheme.length === marks) + `paperSchema` (`<courseId>-set-<n>` id regex, ≥5 questions); papers tree at `src/content/data/papers/<courseId>/`; registry gains `getAllPapers`/`getPapersForCourse`/`getPaper`; validate-content (courseId↔folder, known course via COURSES, `calculator:true` rejected per non-calc policy); audit-content (`paper_quality` min: modelAnswer ≥40 chars, point ≥8 chars; LaTeX checks on stems/points/model answers; missing_difficulty; global duplicate IDs now span topics AND papers).
2. **Pilot set** `math-y7-set-1`: 8 original questions, 20 marks, easy→hard ramp, M1/A1/B1 markscheme style (fixed own `\pounds` style violation — currency is plain-text £ outside math).
3. **Self-marking runner** (`PaperRunnerClient`): textarea answer → model answer reveal → tickable markscheme checklist → per-question tally → results (marks/%/stars) recorded into `examResults` (examId = paper.id). Overall countdown + auto-finish (unticked = 0). Outcomes kept as `{questionId, studentAnswer, ticks}` — the Phase 5 AI-marking payload shape. Routes: `/papers` index (reuses exams `PaperScore`) + `/papers/[courseId]/[setId]`; progress-page CTA. `orderQuestionsByDifficulty` generalized to any difficulty-tagged item; difficulty chip classes extracted to `src/components/difficulty-chip.ts`.
Verified: Vitest 163/163 ✅ (+8: paper schema ×7, runner self-mark flow ×1), `papers.spec.ts` 9/9 ✅ (index, full 20/20 self-marked run → Best: 100%, CTA), tsc ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅, full e2e **516 passed** / 6 skipped / 0 failed ✅.
Next: 1) Phase 4 Session 2 — authoring swarm: 7 remaining sets (math-y8, math-y9, math-dp-ai, eng/bio/chem/phys-ks3), 6–10 original questions ~20 marks each, spot-check answers/markschemes. 2) Session 3 — cross-links from /exams, docs (CONTENT_STYLE.md markscheme style, AGENTS.md papers tree), full gates.
Notes: jsdom framer-motion Proxy mock remounts nodes per render — tests must re-query elements after each interaction (bit me twice in paper-runner.test.tsx). Runner unit test mocks `@/context/ProgressContext` for the recordExam spy — pattern reusable.

---

Git HEAD: `0eb737f` (branch `develop`, tree clean after this entry's commit)
Done: **`phase-4-implementation-plan.md`** written and user-approved direction pending. Design: new `src/content/data/papers/<courseId>/<set-id>.json` content tree (freeResponse questions: `{ stem, marks, markscheme[], modelAnswer, difficulty? }`, marks === markscheme.length); M1/A1/B1 markscheme style; self-marking checklist UI (new PaperRunnerClient, NOT QuizGame); results reuse `examResults`; non-calculator policy; Phase-5 AI-mark hook by design (runner keeps `{questionId, studentAnswer, ticks}`). 3 sessions: (1) schema/pipeline/pilot math-y7-set-1/runner, (2) authoring swarm for 7 remaining sets, (3) index/cross-links/docs.
Verified: plan only — no code changes; gates not applicable (last full run: Vitest 155/155, e2e 507 passed at Phase 3 close).
Next: 1) Phase 4 Session 1 (see plan §4): schema (`paperSchema` in schema.ts/types.ts), registry+validate+audit papers passes, hand-author pilot set, `/papers` routes + self-marking runner, tests. Backlog unchanged: English strand re-map (needs user decision), DP AA, PWA, per-question history (Phase 6).
Notes: FR questions must NOT enter the MC `questions` array (QuizGame expects choices/correctIndex). One set per course in v1 (8 sets, 6–10 questions, ~20 marks each). Original questions only — never copied from real papers (legal constraint, parent plan §7).

---

Git HEAD: `1efff9f` → pushed `0eb737f` (branch `develop`, tree clean)
Done:
1. **Ladder overview** `/exams/[courseId]/ladder`: 5 levels with live unlock states from `ladderProgress` (L1 always open; locked levels show Lock icon + "Score ≥60% on Level N−1"); best-score badges with green check at passing levels.
2. **Level runner** `/exams/[courseId]/ladder/[level]`: deterministic non-calc 10q sets, no timer, `recordLadder(courseId, level, score)` (best kept), direct-URL guard for locked levels. Static params for all 40 course×level combos.
3. **Index integration**: every /exams course card links to its ladder.
Verified: `ladder.spec.ts` 15/15 ✅ (fresh-profile locks, full run → best score, addInitScript-seeded unlock flow, locked-level guard, index link), Vitest 155/155 ✅, tsc ✅, validate:content ✅, audit 0/0 ✅, illustrations + layout ✅, full e2e **507 passed** / 6 skipped / 0 failed ✅.
Next: Phase 4 — free-response + worked solutions (`freeResponse` question type with markscheme points + self-marking checklist UI; original past-paper-style sets). Backlog: English strand re-map (needs user decision), DP AA, PWA, per-question history (Phase 6).
Notes: Phase 3 complete per plan (mocks + ladder + storage v1). Predicted/refreshed mocks deliberately out (parent plan nice-to-have). Ladder/exam results stay out of weak areas by design; e2e seeds storage via `page.addInitScript` for unlock tests — pattern reusable for progress-dependent e2e.

---

Git HEAD: `1627076` → pushed `1efff9f` (branch `develop`, tree clean)
Done:
1. **QuizGame `timerMode='overall'`**: single whole-quiz countdown (mm:ss, "Exam time remaining"), never resets per question; on expiry all unanswered questions → `onQuestionResult(id, false)` + auto-complete. Per-question mode default/unchanged; topic quizzes unaffected.
2. **Routes**: `/exams` index — 8 course cards, 12 paper links (math ×2, others ×1), live `Best: X% · N attempts` badges via client `PaperScore` reading context. `/exams/[courseId]/[paperId]` runner — deterministic sets (static params, SSR-safe), overall timer at paper duration, records `ExamResult` incl. `secondsUsed`, retake-guarded (`recorded` ref).
3. **CTA**: Mock Exams button on /progress Practice card.
Verified: Vitest 155/155 ✅ (+2: mm:ss display, fake-timer expiry auto-complete), `exams.spec.ts` 9/9 ✅ (index 12 papers, full 20q timed run → Best badge, progress CTA), tsc ✅, validate:content ✅, audit 0/0 ✅, illustrations + layout ✅, full e2e **492 passed** / 6 skipped / 0 failed ✅.
Next: 1) Phase 3 Session 3 (final) — revision ladder UI: `/exams/[courseId]/ladder` overview (unlock states) + `ladder/[level]` runner, e2e unlock flow, docs; then Phase 3 complete. Backlog: English strand re-map (needs user decision), DP AA, PWA.
Notes: Try-Again resets the overall timer correctly (state reset already covers timeLeft). Exam results intentionally do NOT feed weak areas (aggregate scores aren't topic-level signals) — diagnostics own that role.

---

Git HEAD: `13e6846` (branch `develop`; Phase 3 changes uncommitted at entry time)
Done:
1. **`phase-3-implementation-plan.md`** written; user decision: **all mocks non-calculator** (sampler excludes `calculator: true`; paper variants split by difficulty lean instead; DP-AI caveat recorded — real AI papers allow GDC).
2. **`src/lib/courses.ts`**: 8 course predicates extracted from diagnostics.ts (shared by diagnostics/exams/ladder).
3. **`src/lib/question-sets.ts`**: generalized the seeded topic-spread builder (targets/seed/excludeCalculator params); `diagnostics.ts` delegates with identical seeds — byte-identical output (existing diagnostics tests + e2e confirm).
4. **Storage v1**: progress-store gains `version` (stamped on save), `examResults[]`, `ladderProgress{}` — all additive/optional, legacy payloads load with defaults (tested). `recordExamResult`/`recordLadderResult` share a rewards helper (stars + streak) with quiz attempts; neither touches `topicProgress` (no weak-area pollution).
5. **`src/lib/exams.ts`**: paper defs — KS3 math P1 5E/9M/6H + P2 3E/8M/9H (20q/30min), science+eng P1 5/9/6 (20q/25min), DP-AI P1 6/10/4 (30min) + P2 3/8/9 (35min). **`src/lib/ladder.ts`**: 5 levels ×10q ramping 6E/3M/1H → 1E/3M/6H, unlock at ≥60% best score.
Verified: Vitest 153/153 ✅ (+27: question-sets ×6, exams ×9, ladder ×9, progress-store ×3), tsc clean (fixed one pre-existing delete-on-required error in audit-content.test.ts), validate:content ✅, audit 0/0 ✅, illustrations + layout ✅, diagnostics e2e 9/9 ✅ (refactor regression check). Full e2e deferred to Session 2 (no UI changes this session).
Next: 1) Phase 3 Session 2 — QuizGame overall-timer mode + auto-submit, `/exams` index + `/exams/[courseId]/[paperId]` runner with result recording, progress-page CTA, e2e. 2) Session 3 — ladder UI + unlock, e2e, docs.
Notes: `structuredClone` now used in progress-store load/save (Node ≥17 / all modern browsers — fine). Plan §6.2 retake policy still open (deterministic sets v1; "new set" button is a cheap later add).

---

Git HEAD: `f8c63b7` (branch `develop`; Session 4 changes uncommitted at entry time)
Done:
1. **Stratified mixed review**: `stratifiedSample` in `quiz-utils.ts` (accessor-based, untagged = medium, short bands backfilled from leftovers); `mixed-review.ts` now samples 3 easy / 4 medium / 3 hard in both weak and random modes.
2. **Diagnostics**: `src/lib/diagnostics.ts` — 8 course groupings (math-y7/y8/y9, math-dp-ai, eng/bio/chem/phys-ks3); deterministic seeded builder: 15 questions, band targets 4/7/4, ≤1 question per topic (rotating per-round band priority — first attempt only hit 7 topics, caught by unit test). Routes: `/diagnostics` index (server, 8 cards) + `/diagnostics/[courseId]` runner (static params, reuses QuizGame, no timer).
3. **Result fan-out**: new optional `QuizGame.onQuestionResult(questionId, correct)`; runner records one attempt per touched topic via existing `recordAttempt` → weak areas seeded immediately, **no storage migration**.
4. **CTAs**: homepage cold-start card (shown when no weak areas) + Diagnostics button on /progress Practice card.
5. **Docs**: CONTENT_STYLE.md — difficulty/calculator tag rubric (moved from plan §3.1) + JSON backslash-escaping rule (`\\times` never `\times`); plan §6.3 resolved (cap 15, topic spread, deterministic sets).
Verified: Vitest 126/126 ✅ (+13: stratified ×4, diagnostics ×8, mixed-review bands ×1), `diagnostics.spec.ts` 9/9 ✅ (index, CTA, full run → Needs Practice), full e2e **483 passed** / 6 skipped / 0 failed ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅.
Next: 1) Commit + push Session 4 (user confirmation pending). 2) Phase 3 — practice exams (timed mocks per course, P1-non-calc/P2-calc samplers — the calculator tags are ready). Backlog: English strand re-map (needs user decision), DP AA, PWA, per-question history (Phase 6).
Notes: Diagnostic sets are deterministic per course (retake = same set; reshuffle-on-retake is a later nicety). Per-topic diagnostic attempts are 1-question each — 0/1 or 1/1 scores, which is what seeds weak/strong instantly; stars accrue per attempt (up to 3 per topic) — accepted design, revisit if it inflates. Retake guard: `recorded.current` ref prevents double-recording on Try Again.

---

Git HEAD: `4e74918` (branch `develop`; Session 3 changes uncommitted at entry time)
Done:
1. **`src/lib/quiz-utils.ts`** (new): `seededShuffle`/`hashString` moved out of QuizGame; `orderQuestionsByDifficulty` (band sort easy→medium→hard, deterministic intra-band shuffle, untagged = medium); `filterQuestionsByDifficulty`; `parseDifficultyFilter`.
2. **Badges** (`QuizGame.tsx`): difficulty chip (easy=green/medium=amber/hard=red, stage-chip style) + blue Calculator chip (lucide) in the question-card header. Shows in mixed review too (same component).
3. **Filter + ordering** (`QuizPageClient.tsx`): chip row All/Easy/Medium/Hard with counts, `?difficulty=` param (linkable, `?mode=weak` precedent), questions pre-ordered easy→hard (no shuffleSeed — SSR-safe), `key={difficulty}` remount on switch. Quiz `page.tsx` wrapped in Suspense (useSearchParams requirement).
Verified: Vitest 113/113 ✅ (+13: quiz-utils ×11, badges ×2), new `tests/e2e/quiz-difficulty.spec.ts` 12/12 ✅, full e2e **474 passed** / 6 skipped / 0 failed ✅, validate:content ✅, audit:content 0/0 ✅, illustrations + layout ✅.
Next: 1) Commit + push Session 3 (user confirmation pending). 2) Phase 2 Session 4 — stratified mixed review sampling (3/4/3), diagnostics (`src/lib/diagnostics.ts`, `/diagnostics` routes, 8 course groupings, results fan out to per-topic attempts), homepage/progress CTAs, CONTENT_STYLE.md tag-rubric docs. Backlog unchanged (English strand re-map needs user decision, DP AA, PWA).
Notes: `?difficulty=hard` e2e pins math-yr7-calculations to Hard (3) — update that spec if the topic's distribution ever changes. Filtered quiz attempts record normally against the topic (by design).

---

Git HEAD: `b144186` (branch `develop`; Session 2 changes uncommitted at entry time)
Done:
1. **Swarm tagging complete** (9 batches, 126 topics, 2 resume rounds after a 403 quota pause mid-run): 1,925 `difficulty` + 92 `calculator` keys added. Global 640 easy (32%) / 852 medium (43%) / 478 hard (24%); every topic ≥3 easy / ≥3 hard. Rubric from plan §3.1 used verbatim.
2. **Verification**: mechanical diff check CLEAN (only tag keys; all removed lines restored verbatim + trailing comma); 12-question random spot-check defensible; per-batch distribution tables in swarm reports.
3. **Pre-existing bug fixed**: 467 corrupted LaTeX escapes in 11 math files (`\times`/`\text`/`\theta`/`\tan`/`\to`/`\neq` written single-backslashed → JSON `\t` parsed as literal tab, rendering "imes"/"heta"…). Predates the swarm (proven by tags-only diff). All fixed; control-char scan now clean. Files: 6 math-dp-ai (trig 186, quadratics 56, sequences 58, integration 36, probability 34, differentiation 26), yr7-algebraic-expressions, yr7-nets-3d-shapes, yr8-pythagoras, yr8-standard-form, yr8-transformations.
4. Plan §3.1 calculator note corrected: **AI allows a GDC on all papers** (P1-non-calc is AA, not AI) — swarm prompt already applied this.
Verified: `generate:registry` ✅, `validate:content` ✅, `audit:content` **0/0** ✅ (was 126 warnings pre-tagging), `validate:illustrations` + layout ✅, Vitest 100/100 ✅, e2e 462 passed / 6 skipped / 0 failed ✅.
Next: 1) Commit + push Session 2 (user confirmation pending at entry time). 2) Phase 2 Session 3 — quiz UI: badges, easy→hard ordering, difficulty filter. 3) Session 4 — stratified mixed review + diagnostics. Backlog unchanged (English strand re-map needs user decision, DP AA, PWA).
Notes: Thin-but-honest hard bands flagged by agents (future harder-question candidates, NOT tagging errors): eng-speaking-1, chem-organic-1, math-dp-ai-voronoi-diagrams, math-dp-ai-graph-theory. Several DP files have 20 questions (not 15) — audit's 15-standard is a target, min is 5. Swarm used insertion scripts instead of 1,925 Edit calls — allowed; parent-side diff check is the real gate.

---

Git HEAD: `66256c2` (branch `develop`; Phase 2 changes uncommitted at entry time)
Done:
1. **`phase-2-implementation-plan.md`** written (4 sessions; verified current state: 129 topics / 1,970 questions, no per-question history, mixed review = uniform random).
2. **Schema + types**: optional `difficulty` ('easy'|'medium'|'hard') + `calculator` (bool, math-only) on questions (`schema.ts`, `types.ts` — zod-optional so untagged legacy JSON still parses).
3. **Validators**: `validate-content.ts` — calculator ⇒ math rule (script refactored to `require.main` guard + exported `checkStageConsistency` for testability). `audit-content.ts` — `missing_difficulty` (one aggregated warning per topic) + `difficulty_distribution` (≥3 easy / ≥3 hard, checked only once fully tagged).
4. **Pilot tagged by hand** (rubric nailed): math-yr9-surds 4/8/3, bio-cell-1 9/3/3, eng-spelling-1 11/1/3 — all meet ≥3/≥3 without forcing. Rubric (now in plan §3.1): relative to topic level; scenario prediction = hard band for recall-heavy subjects.
Verified: `generate:registry` ✅, `validate:content` ✅, `audit:content` = **expected red** (126 warnings = exactly the 126 untagged topics, pilot 3 clean) ✅, Vitest 100/100 ✅ (+10 new: schema tags, audit rules, calculator rule).
Next: 1) Phase 2 Session 2 — swarm-tag the remaining 126 topics (rubric in plan §3.1 quoted verbatim; diff-check tags-only; audit must go green). 2) Session 3 — quiz UI badges/ordering/filter. 3) Session 4 — stratified mixed review + diagnostics. Other backlog unchanged (English strand re-map needs user decision, DP AA, PWA).
Notes: open questions 1–2 in the plan resolved by the pilot; diagnostic length cap deferred to Session 4. e2e not run (no UI changes yet).

---

Git HEAD: `05a386a` (branch `develop`; content commit pushed, poetry-writing changes uncommitted at entry time)
Done:
1. **Pushed `05a386a`**: 9 authored topics + registry + test-count fix.
2. **Coverage analysis** (all 69 unmapped BBC dirs × existing 128 topics): BBC KS3 corpus is **exhausted for net-new topics** in the 5-subject scope. Y9 math gap list from the plan is fully covered (6 new + 7 `-myp` = 13 Y9 topics); all bio/chem/phys BBC dirs map onto existing topics (human-impact is inside bio-ecology-1; materials/polymers inside chem-organic-1); remaining maths dirs match Y7/Y8 topics; English play guides (8 Shakespeare dirs) deliberately not mapped (school-text-dependent, outside the strand-based plan). Remaining BBC value = **enrichment reference** for existing topics when they're revisited.
3. **eng-poetry-writing-1** added (map + staging + authored): writer's-craft complement to eng-poetry-1 (analysis) — ideas, choosing form, drafting, imagery/sound as choices, line breaks, redrafting. 7/12/15.
Verified: `generate:registry` (129 topics) ✅, `validate:content` ✅, `audit:content` 0/0 ✅, Vitest 90/90 ✅ (english count 16→17). e2e not re-run (single prose topic; e2e was green on the 9-topic batch).
Next: 1) Phase 2 — difficulty/calculator tags + diagnostic tests (per revised plan). 2) KS3 English strand re-map (needs user decision on Y8/Y9 progression structure). 3) Optional: BBC enrichment pass on existing topics when revisited. 4) Backlog: DP AA, PWA.
Notes: uncommitted now: eng-poetry-writing-1.json, registry.ts, test counts, curation map, this entry. IGCSE tracks are unaffected by BBC KS3 content (different syllabus) — they need syllabus-sourced authoring, not the scraper.

---

## 2026-07-23 — Phase 1.5 authoring pass: 9 BBC-referenced topics authored, all gates green

Git HEAD: `acd08dd` (branch `develop`; pushed acd08dd earlier this session, content changes uncommitted at entry time)
Done:
1. **Committed + pushed** scraper/converter work as `acd08dd` (tools/data stays gitignored — copyrighted reference material).
2. **Authored 9 topics** from staging drafts (pilot + 8 parallel): math-yr9-error-intervals, math-yr9-quadratic-graphs, math-yr9-quadratic-expressions, math-yr9-standard-form, math-yr9-surds, math-yr9-3d-geometry, chem-working-scientifically-1, phys-working-scientifically-1, eng-spelling-1. All 7 notes / 12 flashcards / 15 questions, BBC text used as reference only (rewritten in our voice), no illustrations this pass. KS3 maths now has its first 6 Y9-tagged topics.
3. **Test fix**: `tests/unit/content-registry.test.ts` EXPECTED_TOPIC_COUNTS updated (math 68→74, chemistry 11→12, english 15→16, physics 12→13).
Verified: `generate:registry` (128 topics) ✅, `validate:content` ✅, `audit:content` 0/0 ✅, `validate:illustrations` ✅, `validate:illustration-layout` ✅, Vitest 90/90 ✅, e2e 462 passed / 6 skipped / 0 failed ✅. Random answer spot-check across all 8 swarm-authored topics: all correct.
Next: 1) Grow the curation map (`node tools/scripts/convert-bbc-to-topics.mjs --list-unmapped` — maths 23, english 20, biology 8, chemistry 10, physics 8 unmapped dirs; English re-map needs strand-level decisions first). 2) Remaining Y9 math ~10 topics per plan. 3) Existing backlog (Phase 2 difficulty/calculator tags, DP AA, PWA).
Notes: Chem/phys working-scientifically staging drafts look identical in counts but ARE distinct content (verified). math-yr9-surds/quadratic-* staging was thin — those topics were authored mostly from curriculum knowledge with BBC as a coverage check. `eng-spelling-1` explanations avoid eng-grammar-1's repeat-the-stem habit (audit-clean).

---

## 2026-07-23 — Phase 1.5 step 3: converter + curation map built, 9 staging drafts generated

Git HEAD: `5a9a3fe` (branch `develop`, tree dirty — tools/ scripts + staging)
Done:
1. **`tools/scripts/bbc-curation-map.json`** — seeded with 9 NET-NEW entries (verified against existing 117 topics): 6× Y9 math (quadratic-graphs, quadratic-expressions, standard-form, error-intervals, surds, 3d-geometry), chem/phys-working-scientifically-1, eng-spelling-1. Deliberately skipped: bio working-scientifically (covered by bio-practical-1), simultaneous/inequalities/trig (covered by Y9-confirmed `-myp` topics), eng punctuation/grammar (covered by eng-grammar-1).
2. **`tools/scripts/convert-bbc-to-topics.mjs`** — map-driven converter: validates entries (id prefix, subjectId, stage/year, source dirs, collision with existing app topics → skip unless `--force`); aggregates guides per entry (optional `guides`/`excludeGuides` filters); cleans text (show/hide toggle headings → "Worked example", `∙` decimal bullet → `.`, sentence-boundary spacing fixes); renders blocks → markdown; writes reference drafts to `tools/data/_staging/<subjectId>/<id>.json` with `status: "reference-draft"` + source URLs. Flags: `--only`, `--map`, `--force`, `--list-unmapped`. npm scripts: `convert:bbc`, `convert:bbc:unmapped` (tools/).
3. Ran it: 9/9 entries converted (44 guides consumed). Artifact sweep after cleaning: 1 residual (missing period in BBC source text — unfixable by regex, harmless for reference).
Verified: `node --check` ✅, full run 9/9 ✅, `--only`/`--list-unmapped` flags ✅, staging content spot-checked (maths worked examples clean, chem/phys WS drafts confirmed distinct content despite identical section counts).
Next: Authoring pass — rewrite the 9 staging drafts into real topic JSONs in our own voice (7 notes/12 flashcards/15 questions), then `generate:registry` + all quality gates. Grow the curation map afterwards (`--list-unmapped` shows remaining dirs; English needs strand-level decisions, maths Y9 ~10 more topics per plan).
Notes: staging files are NOT publishable — they contain BBC reference text. `AGENTS.md` conventions updated with the pipeline rule. `--list-unmapped` output is the queue for expanding the map (biology has 8 unmapped dirs, english 20, maths 23, chemistry 10, physics 8).

---

## 2026-07-23 — Phase 1.5 step 1-2: tools/data curated, scraper fixed + chem/phys scraped

Git HEAD: `5a9a3fe` (branch `develop`, tree dirty — scraper fixes + tools/data changes)
Done:
1. **Curation**: 6 out-of-scope subjects moved to `tools/data/_archive/` (history, geography, religious-studies, computer-science, french, spanish). Deleted junk from in-scope subjects: `topics/` collection-page files (maths 28, english 16 — all verified empty), 68 `play-*` game files, 18 empty-section files. Remaining: maths 148, english 145, biology 86.
2. **Scraper fixes** (`tools/scripts/scrape-bbc-ks3.mjs`): (a) paragraph-duplication bug — tree-walker now skips children of expanded container divs + stops at next heading, plus per-section dedupe safety net; (b) 404 guard on topic resolution (regex must tolerate BBC's curly apostrophe "couldn’t"); (c) KNOWN_TOPIC_MAP now beats the DOM-derived topic map; (d) resolveTopicPages returns real counts (mis-accounting fixed); (e) game links dropped at discovery (`/^play\b/` or `game -` in title); (f) `_summary.json`/`_url-map.json` now merge cumulatively across runs; (g) revision sub-page catch logs instead of silence; (h) `archived: true` flag on the 6 out-of-scope subjects — excluded from default runs, still scrapable via `--subject`.
3. **Chem/phys added + scraped**: chemistry `znxtyrd`, physics `zh2xsbk` (IDs verified against live KS3 subjects page). Full run: chemistry 69/69, physics 81/81, 0 errors, **0 duplicated-paragraph files** (dedupe fix confirmed). Post-clean: 147 new files; physics topics incl. forces-and-movement 16, waves 15, electricity 11, working-scientifically 11; chemistry incl. chemical-reactions 12, working-scientifically 11, atoms/elements 8.
Verified: `node --check` ✅, chemistry dry-run (69 guides/14 topics) ✅, full scrape 0 errors ✅, on-disk audit (empty/dup counts) ✅. Correction to earlier review: "title overwritten by link text" was NOT a bug — spread order in the output object favors the scraped h1; verified real files have correct titles.
Next: Build `tools/scripts/convert-bbc-to-topics.mjs` (curation mapping BBC topicSlug → app topic ID; targets: Y9 math ~16, KS3 English +~6, Working Scientifically). Corpus now 526 in-scope guides (maths 148, english 145, biology 86, chemistry 68, physics 79).
Notes: Deleted 3 stragglers post-scrape (2 "Science game - Atomic Labs", 1 stale-404 `zyn3b9q` acids-and-bases). `_summary.json` guideCount = discovery counts (pre-cleanup). KNOWN_TOPIC_MAP has no chem/phys entries — auto-resolution via topic-page visits worked fine, but spot-check topic names before converting.

---

## 2026-07-23 — BBC scraper/data review; Phase 1.5 pipeline added to revised plan

Git HEAD: `5a9a3fe` (branch `develop`, tree clean → plan edited this session)
Done: Reviewed `tools/scripts/scrape-bbc-ks3.mjs` + all 822 scraped guides vs `revised-implementation-plan.md`. Measured: `quiz`/`keyPoints` empty in 822/822 files; 146 zero-section files; paragraph-duplication bug (all 32 CS files, 10–23% of french/spanish/geography); scraped-h1 overwritten by link text (scraper line 750); `_summary`/`_url-map` per-run only. User decisions: (1) BBC text = **reference only**, notes rewritten in our voice; (2) **keep 5-subject scope** — archive history/geography/RS/CS/french/spanish, add chemistry+physics to scraper; (3) plan updated. Added **Phase 1.5 — BBC-sourced KS3 content pipeline** to `revised-implementation-plan.md` §5 (curate → fix/extend scraper → `convert-bbc-to-topics.mjs` with curation mapping, net-new IDs only).
Verified: review only — no code/content changes; quality gates not applicable.
Next: 1) Curate `tools/data/` (delete junk, archive 6 subjects). 2) Fix scraper bugs + add chem/phys, one final run. 3) Build `tools/scripts/convert-bbc-to-topics.mjs` (targets: Y9 math ~16, KS3 English +~6, Working Scientifically).
Notes: Converter must dedupe paragraphs, strip `Show answerHide answer`/`Video Transcript` heading artifacts, and not trust `_url-map.json` topicName (re-derive from URL hash + KNOWN_TOPIC_MAP). Flashcards/questions always authored — nothing salvageable in scraped data.

---

## 2026-07-22 — BBC Bitesize scraper v2: cleanup + CS fix COMPLETE, full quality audit

Git HEAD: `2b6dee6` + uncommitted changes (branch `develop`, tree dirty — scraper v2)
Done:
1. **Cleanup**: 158 residual `https/` folders deleted → 820 clean files across 9 subjects.
2. **CS scraper fixed**: (a) TreeWalker fallback extracts content from nested `<div class="text-block">` containers in `/guides/.../revision/N` pages; (b) multi-page revision scraping discovers pages 2-N from sidebar; (c) H1 concatenation fix ("IntroWhat is..."); (d) 32 CS guide-IDs mapped to 7 parent categories in KNOWN_TOPIC_MAP; (e) regex now matches both `/topics/<id>` and `/guides/<id>` patterns; (f) noiseWords expanded (sign in, in this guide, pages, more guides, game -, etc.).
3. **Final quality audit** — 820 guides across 9 subjects:

| Subject | Guides | Content Rate | Avg Items | Verdict |
|---------|--------|-------------|-----------|--------|
| Spanish | 20 | 100% | ~7 sections | ⭐ |
| Religious Studies | 44 | 100% | ~5 sections | ⭐ |
| French | 29 | 96% | ~6 sections | ⭐ |
| Computer Science | 32 | **100%** | **16 items** | ⭐ |
| English | 196 | 89% | ~3 sections | ✅ |
| History | 140 | 74% | ~2 sections | ✅ |
| Geography | 104 | 74% | ~2 sections | ✅ |
| Maths | 218 | 70% | ~1 section | ⚠️ |
| Biology | 86 | ~49% | ~2 sections | ⚠️ |

CS topic breakdown: Programming 8, Algorithms 7, Computational thinking 6, Hardware & software 4, Safety & responsibility 3, Data representation 2, Internet communication 2 → 510 total items.

Verified: syntax ✅, CS content extraction 100% ✅, topic categorization ✅. Quiz/key points still 0% (BBC React JS state — Phase 2 will auto-generate).
Next: Phase 2 — build `tools/scripts/convert-bbc-to-topics.mjs` to transform 820 scraped guides into project topic JSONs (7 notes, 12 flashcards, 15 questions each with auto-generation for quizzes/keypoints).
Notes: Scraper v2 is feature-complete. KNOWN_TOPIC_MAP covers 60+ IDs across biology, french, spanish, CS, maths, english, history, geography. Multi-page revision scraping skips non-existent pages silently. 4 stale CS URLs (zts8d2p, z3khpv4, zwmbgk7, z2p9kqt) return 404 — guide directories cover these topics.

---
---

## 2026-07-22 — BBC Bitesize scraper v2: fixed topic resolution + content extraction

Git HEAD: `2b6dee6` + uncommitted changes (branch `develop`, tree dirty — scraper fixes + untracked tools/node_modules)
Done: Rewrote `tools/scripts/scrape-bbc-ks3.mjs` with 5 critical fixes:
1. **`determineTopic()` https bug**: URLs like `https://www.bbc.co.uk/bitesize/topics/.../articles/...` were parsing `parts[0]` = `https:` → all guides in `https/` folder. Fixed with `toPath()` that strips protocol+host.
2. **Topic-ID → Topic-Name resolution**: BBC React SPA doesn't expose links in H2-sibling DOM. Solution: (a) `KNOWN_TOPIC_MAP` with 29 pre-seeded mappings (biology/french/spanish/maths/english/history/geo), (b) auto-discovery visits each unknown topic page to scrape H1 heading. Verified: biology 85/85 guides correctly categorized across 10 topics.
3. **Topic-collection page resolution** (`resolveTopicPages`): Phase 1.5 navigates to topic-only URLs (maths 28/31, English 18/46, etc.) and extracts individual `/articles/` links.
4. **Key points/quiz/vocab extraction**: 2-strategy scan — searches for headings containing "key point"/"quiz"/"test your" text, falls back to class/data selectors; vocab scans for `<dt>/<dd>` pairs + bold terms in paragraphs.
5. **Noise filtering**: Added 'more on', 'find out more' to footer/noise filter.

Verified: syntax ✅ (`node --check`), dry-run biology (85/85 correct topics ✅), dry-run french (19/19 correct topics ✅). Full scrape NOT run yet.
Next: 1) Run `node tools/scripts/scrape-bbc-ks3.mjs --resume` to re-scrape all 316 guides with fixed extractors. 2) Check if key points/quiz/vocab are now populated in output. 3) Phase 2: build `tools/scripts/convert-bbc-to-topics.mjs` to transform scraped data into project topic JSONs.
Notes: KNOWN_TOPIC_MAP in scraper needs expansion for remaining subjects (RE, CS, remaining maths/English/history/geo topic-IDs). The scraper auto-discovers unknowns via page visits at ~4s each.

---

## 2026-07-22 — Provisional migration tags reviewed (Phase 1 follow-up)

Git HEAD: `2b6dee6` + uncommitted changes (branch `develop`, tree dirty — this review + untracked tools/node_modules)
Done: Reviewed all 3 provisional tag groups from the Phase 1 migration. (1) DP AI SL/HL split (20 topics): verified against official AI syllabus — complex-numbers, matrices, graph-theory, poisson-distribution confirmed HL-only; voronoi-diagrams confirmed SL (SL 3.6, contrary to some tutoring sites); **hypothesis-testing flipped hl→sl** (chi-squared + t-tests are AI SL 4.11; SL-tagged probability topic sets the "SL core + HL extras" precedent). (2) myp→Y9 (7 topics) confirmed — content depth (simultaneous eqs, SOH CAH TOA, fractional indices) fits Year 9. (3) plain -1→Y7 (4 topics) confirmed (algebra/fractions/geometry/statistics basics). Review outcome recorded in `scripts/migrate-stage-tags.ts` comment; DP_AI_HL_ONLY set updated. Registry untouched (imports JSONs directly; no files added/removed).
Verified: validate:content ✅, audit:content ✅ 0/0, validate:illustrations ✅, validate:illustration-layout ✅, Vitest 90/90 ✅. e2e NOT run (badge-only change; no test asserts "DP HL" text).
Next: 1) BBC Bitesize scraper run (DeepSeek session owns this — `_summary.json` showed 316 guides discovered, 0 scraped). 2) Phase 2: difficulty/calculator tags + diagnostic tests. 3) Existing backlog (DP niche topics, Y8 science, PWA…).
Notes: Finding for later decision — `math-dp-ai-binomial` (binomial theorem/expansion) appears to be AA SL content, not AI syllabus; left tagged course=ai/level=sl pending user decision. `level` is display-badge only (`SubjectPageClient.tsx`), no filtering depends on it.

---

## 2026-07-21 — Phase 1 Session 2: stage grouping, disclaimer footer, e2e green

Git HEAD: `eec1489` + uncommitted changes (branch `develop`, tree dirty — Sessions 1+2 awaiting commit decision)
Done: Subject pages now group topics by stage→year via new `src/lib/topic-groups.ts` (`KS3 · Year 7/8/9` → `KS3` → `IGCSE` → `IB DP`, labelled sections with counts). Trademark disclaimer footer added to `layout.tsx` (IBO + CAIE, visible above mobile bottom nav). e2e updated: stale `math-dp-sequences` → `math-dp-ai-sequences` in app/study/full-topic-journey specs, MYP/DP filter test → KS3/IB DP stage test. New tests: unit `topic-groups.test.ts` (3), e2e stage-grouping sections test + footer disclaimer test. Docs: CONTENT_STYLE.md gains "Stage & course tagging" table + new-topic ID conventions; AGENTS.md conventions updated (taxonomy, retired ibLevel, roadmap docs).
Verified: tsc ✅, next lint ✅, validate:content ✅, audit:content ✅ 0/0, validate:illustrations ✅, validate:illustration-layout ✅, Vitest **90/90** ✅ (was 87), **full Playwright suite 462 passed / 0 failed / 6 skipped** ✅ (was 456 — +6 from new tests).
Next: 1) Commit Sessions 1+2 (user decision). 2) Review provisional migration tags (myp→Y9, plain -1→Y7, DP SL/HL split). 3) Phase 2: difficulty/calculator tags + diagnostic tests. 4) Existing backlog (DP niche topics, Y8 science, PWA…).
Notes: Phase 1 complete per `phase-1-implementation-plan.md` — both sessions done in one day.

---

## 2026-07-21 — Phase 1 Session 1: stage/course/level taxonomy + migration

Git HEAD: `eec1489` + uncommitted changes (branch `develop`, tree dirty)
Done: Replaced `ibLevel` (MYP/DP) with `stage` (ks3/igcse/dp) + optional `year` (7/8/9), `course`, `level` (core/extended/sl/hl) in `src/content/schema.ts` + `types.ts`. One-time `scripts/migrate-stage-tags.ts` (explicit pattern table, kept for audit) migrated all **119** topic JSONs and renamed `math-dp-*` → `math-dp-ai-*` (20 files, topic ids updated, inner item ids untouched); provisional tags flagged in script output (myp→Y9, plain -1→Y7, DP SL/HL split — HL-only: complex-numbers, poisson, graph-theory, hypothesis-testing, matrices). `validate-content.ts` gains stage/course/level consistency rules (year⇒ks3, sl/hl⇒dp, dp/igcse require course). Registry regenerated (119 topics). `topic-filter.ts` LevelFilter→StageFilter; `TopicFilter.tsx` options now All/KS3/IGCSE/IB DP; `SubjectPageClient` badge shows KS3/IGCSE/DP SL/HL (full stage *grouping* deferred to Session 2). Unit tests updated (topic-filter, topic-filter-component, content-schema, content-registry, audit-content).
Verified: tsc ✅, next lint ✅, validate:content ✅, audit:content ✅ 0/0, validate:illustrations ✅, validate:illustration-layout ✅, Vitest 87/87 ✅. e2e NOT run — `tests/e2e/app.spec.ts:83-84` still targets MYP/DP buttons (Session 2).
Next: 1) Phase 1 Session 2 (Part B): stage grouping on subject page, disclaimer footer, e2e updates, CONTENT_STYLE.md/AGENTS.md conventions. 2) Review provisional tags. 3) Existing backlog unchanged.
Notes: Migration is one-way (no ibLevel left in data); script throws if re-run. User accepted orphaned DP localStorage progress from renames (dev phase). `next lint` deprecation still pending (ESLint CLI migration).

---

## 2026-07-21 — Merged DeepSeek platform analysis into revised plan

Git HEAD: `69b4b1a` (branch `develop`, tree dirty — plan doc + new DeepSeek analysis file, uncommitted)
Done: Reviewed `content-resource-platforms-analysis_deepseek_v4_pro.md` (Save My Exams + PapaCambridge + RV, scraped July 2026) and merged into `revised-implementation-plan.md`: new §1.4 (SME — IGCSE breadth, Target Tests diagnostics, Smart Mark AI, all-access ~£40/yr model), §1.5 (PapaCambridge — free unsolved papers, topical solved papers as question-bank validation), §1.6 (cross-platform takeaways + source discrepancies — kept directly-verified RV figures: RV *does* have IGCSE math at igcse.revisionvillage.com; verified one-time $249/$499 pricing), new §7 Legal & compliance (original content only, no exam PDFs, IBO/CAIE trademark footer disclaimer in Phase 1, source file retained as reference). Phase updates: diagnostics added to Phase 2, predicted-mock note to Phase 3, flashcard "know/learning" sort to Phase 6, monetization model reference to Phase 7; Econ/Business/TOK added to non-goals.
User decisions: keep 5-subject scope (Econ/Business/TOK future-only); add SME-style diagnostic tests to plan.
Verified: docs-only session, no gates run.
Next: 1) Commit both docs (user to confirm). 2) Phase 1: schema stage/course/level fields + migration + registry. 3) Existing backlog unchanged.

---

## 2026-07-21 — Revision Village benchmark + revised Y7→IBDP plan

Git HEAD: `a22a3aa` (branch `develop`, tree dirty — new untracked plan doc only)
Done: Researched revisionvillage.com via 6-agent swarm (verified w/ URLs): RV covers IB DP (14 subjects incl. English Lang&Lit/Lit) + IGCSE **math only**; **no Y7–9/KS3/MYP content** — KS3/IGCSE-sciences/English benchmarked against official gov.uk + Cambridge (0580/0610/0620/0625/0500) + ibo.org syllabi instead. Captured RV feature set (Questionbank w/ difficulty tiers, 4 practice-exam types incl. Revision Ladder, past-paper video solutions only — no PDFs, Key Concepts, dual-ring Seen/Known flashcards, Newton AI marking) and design tokens (navy #032254, accent #0081D6, Manrope+Inter, dual-ring donut, subject color-coding). Wrote `revised-implementation-plan.md`: gap analysis (117 current topics vs full Y7–Y13 map), data-model changes (stage/course/level tags, difficulty tiers, freeResponse question type), 7 feature phases (curriculum browsing → difficulty banks → timed mocks → free-response+markschemes → AI feedback API route → analytics/SR → PWA), RV-based design refresh.
User decisions: all stages in parallel; Cambridge CAIE for IGCSE; both DP Math AA and AI; tiered question banks phased; AI feedback via serverless API route; localStorage for now (accounts/subscriptions deferred to future AWS phase); English from official syllabi.
Verified: research-only session, no code changes — no gates run.
Next: 1) Review plan doc with user. 2) Phase 1: schema stage/course/level fields + migration + registry. 3) Existing backlog: DP niche topics (vol. of revolution, further diff eqs), Y8 science expansion, merge review of `chore/next-15-upgrade`.

---

## 2026-07-19 — Unified nav + breadcrumbs, Mixed Review surfaced

Git HEAD: `151e4ad` (branch `develop`, unpushed)
Done:
- **Shared nav**: `nav-items.ts` feeds both `HeaderNav` (desktop) and `Nav` (mobile bottom bar); both gain **Review** (`/mixed-review`, Shuffle icon). Mobile bar is now 4 tabs.
- **Breadcrumbs**: new `Breadcrumbs.tsx` on all leaf pages (Home › Subject › Topic › mode), replacing one-off back links; topic crumb on flashcards/quiz links to the study page; current-page label truncates on phones. `QuizGame` takes an optional `breadcrumbs` prop; completion-screen CTAs unchanged.
- **Mixed review mode toggle**: Weak areas / All topics segmented control on `/mixed-review` — weak-area practice now reachable without going via Home/Progress prompts. Completion back label now "Back to Progress".
- e2e: 2 stale back-link assertions updated; 4 new tests (Review nav link, study breadcrumb navigation, flashcards breadcrumb, mode toggle).
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅, targeted e2e (app/mixed-review/mobile-navigation/flashcards/study) 66/66 ✅, full suite 456 passed / 0 failed / 6 skipped ✅.
Next: 1) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Y8 science expansion. 3) Features: spaced repetition, progress sync, PWA.
Notes: First full-suite attempt aborted (100 fails / 354 did-not-run, element-not-found across unrelated specs — stale-server signature); clean re-run passed fully. Recurring environmental flake: only run e2e with no other dev servers up.

---

## 2026-07-19 — Desktop header navigation

Git HEAD: `9d91940` (branch `develop`, uncommitted push pending)
Done: Desktop header had no navigation — static brand text + theme toggle only, so /progress had no way back home. Added `HeaderNav` client component (Learn/Progress links with active state, mirrors mobile bottom nav) and made the brand a Link to `/`.
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅, e2e app+mobile-navigation 39 passed / 0 failed / 3 skipped ✅.
Next: 1) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Y8 science expansion. 3) Features: spaced repetition, progress sync, PWA.
Notes: Gotcha discovered — Playwright reuses a dev server already on its resolved port (`reuseExistingServer`), so running `npm run dev` on :3000 during e2e made tests hit the stale server (JSON parse errors, /progress 500s). Stop your dev server before running e2e, or use E2E_PROD=1.

---

## 2026-07-19 — Hydration mismatch fix (ProgressContext)

Git HEAD: `9767e68` (branch `develop`, uncommitted push pending)
Done: Home page threw a React hydration error for users with saved progress — `ProgressProvider` initialized state via `useState(getUserProgress)`, reading localStorage synchronously, so client render ≠ SSR. Now initializes with the same defaults the server uses and loads real progress in `useEffect` after mount. Fixes streak badge / subject stars / weak-topics panel mismatches in one place.
Verified: tsc ✅, Vitest 87/87 ✅, headless-Chrome check with seeded localStorage (streak badge renders, zero hydration console errors) ✅, e2e app+study+flashcards 42/42 ✅.
Next: 1) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Y8 science expansion. 3) Features: spaced repetition, progress sync, PWA.
Notes: Bug predates the Next 15 upgrade — React 19/Next 15 just surfaced it as a visible recoverable error. ThemeContext already used the correct mount-then-load pattern.

---

## 2026-07-19 — Next.js 15.5.20 + React 19 upgrade (branch pushed)

Git HEAD: `31aece8` (branch `chore/next-15-upgrade`, pushed to origin; NOT merged to develop)
Done: next/eslint-config-next 14.2.35 → 15.5.20, react/react-dom 18 → 19, @types/react* → 19. Async-`params` codemod applied to the 4 dynamic pages (only breaking change for this static site). Found + fixed one real regression: the Next 15 dev-tools button injected in dev overlaid the mobile bottom nav and matched the e2e `Next` locator — disabled via `devIndicators: false` in next.config.mjs. tsconfig auto-updated by the Next 15 build (formatting + ES2017 target). Also fixed a pre-existing e2e bug found this session: Playwright 1.60 renamed the `iPad Pro` device to `iPad Pro 11`, so the iPad project silently ran as a second desktop; after the rename the bottom-nav test's premise broke (app hides bottom nav ≥768px by design) — that test now skips on tablet-width viewports.
Verified: tsc ✅, next build ✅ (all static paths prerender), ESLint ✅, Vitest 87/87 ✅, validate:content ✅, audit:content ✅ 0/0, full Playwright suite 444 passed / 0 failed / 6 skipped ✅ (was 443/7 — iPad now runs the mobile action-button test for real).
Next: 1) **Review + merge `chore/next-15-upgrade` into develop** (user decision). 2) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 3) Y8 science expansion. 4) Features: spaced repetition, progress sync, PWA. 5) Later: `next lint` is deprecated — migrate to ESLint CLI before any Next 16 jump (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
Notes: `devIndicators: false` only affects the dev server; no production change. SVG backlog branch work from earlier today is already on develop (`b87b37e`).

---

## 2026-07-19 — SVG layout backlog cleared (159 files, all subjects)

Git HEAD: `df8819e` + uncommitted changes (branch `develop`)
Done: Fixed every file flagged by the illustration layout checker — biology 45, chemistry 33, math 37, physics 45 (159 total). Fixes were minimal: widened backing rects, moved/shrunk labels, shortened text where meaning is preserved; yr7 math needed the most structural work (re-laid-out sections, viewBox growth for clipped content in math-yr7-probability, math-yr7-transformations, math-yr7-calculations, math-yr7-angles). `validate:illustration-layout` now exits 0 for the first time. Removed one agent scratch file (`scripts/.measure-tmp.mjs`); no files outside `public/images/` touched.
Verified: validate:illustration-layout ✅ (exit 0), validate:illustrations ✅, validate:content ✅, audit:content ✅ 0/0, Vitest 87/87 ✅, illustrations e2e Desktop Chrome 119/119 ✅.
Next: 1) **User visual review + commit** of this batch (spot-check the rebuilt yr7 SVGs: math-yr7-probability, math-yr7-transformations). 2) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 3) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Work done by a 4-agent swarm (one per subject), resumed after a 30-min timeout and a quota cut-off. The layout gate is now green — keep it that way: run `npm run validate:illustration-layout` before committing any SVG change.

---

## 2026-07-18 — Commit + push of the full fix batch

Git HEAD: `3e29f21` (branch `develop`, pushed to origin, clean tree)
Done: Committed and pushed all work from the four entries below as one commit (73 files). Full verification before commit: Vitest 87/87 ✅, full Playwright suite all devices 443 passed / 0 failed / 7 skipped ✅, all content + illustration gates ✅.
Next: 1) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 2) SVG backlog (161 flagged files — good swarm candidate). 3) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Vercel auto-deploys from develop.

---

## 2026-07-18 — Circle diagram: labels moved outside with leader lines

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`)
Done: Reworked the Circle geometry section of `math-geometry-1.svg` — all 5 labels (centre, radius, diameter, arc, chord) now sit outside the circle with 1.5px colour-matched leader lines, no crossings. Also fixed an accuracy bug: the chord endpoint was outside the circle (was a secant); moved onto the circle. Parent-verified with PNG render + diagnose clean.
Verified: diagnose-illustrations ✅, validate:illustrations ✅.
Next: unchanged (Next.js upgrade, SVG backlog, DP niche topics, Y8 science, features).
Notes: Same uncommitted batch awaiting user review + commit.

---

## 2026-07-18 — Illustration sizing fix + Geometry SVG

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`) — stacks on the two entries below (all uncommitted).
Done:
- **StudyNoteIllustration**: replaced next/image in a fixed 16:10 frame with a plain `<img class="w-full h-auto">` — illustrations now always use full container width at their intrinsic aspect ratio (the new 900x780 fractions SVG was letterboxed before). Local SVGs get no next/image optimisation anyway.
- **math-geometry-1.svg**: viewBox 440→500 tall; polygon formula strip moved from y=400 to y=455 — circle section ("chord" label) no longer collides with the strip (subagent + PNG visual review).
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅, diagnose on geometry ✅, validate:illustrations ✅, illustrations e2e Desktop Chrome 119/119 ✅.
Next: unchanged — 1) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 2) SVG backlog (161 flagged files). 3) DP niche topics. 4) Y8 science. 5) Features.
Notes: Still awaiting user manual review + commit approval for the whole uncommitted batch (InlineMath/$ rendering, overflow check, backslash/£/\dfrac content fixes, fractions + geometry SVGs, illustration sizing).

---

## 2026-07-18 — Manual-review fixes: backslashes, £ fonts, \dfrac, Fractions SVG

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`) — NOTE: also includes the still-uncommitted InlineMath/overflow-check work from the previous entry.
Done:
- **Stray `\` at line ends**: cleaned 53 lines in math-algebra-1, math-dp-graph-theory, math-dp-voronoi-diagrams; added `stray_backslash` audit rule; `StudyNoteBody` now supports multi-line `$$...$$` blocks (math-dp-functions fun-n3, math-yr7-negative-numbers n5/n6 previously rendered as raw code text!) and normalizes single `\` → `\\`. New regression test `tests/unit/study-note-body.test.tsx`.
- **£ font inconsistency** (math-fractions-1): currency now plain text outside math; convention documented in CONTENT_STYLE.md.
- **Fraction sizing**: converted all 2,430 `\frac` → `\dfrac` in 56 topic files — fractions now render full-size inline and display (uniform). Convention documented in CONTENT_STYLE.md.
- **Fractions SVG** (math-fractions-1.svg): redesigned 900x500→900x780, five stacked full-width sections (subagent + PNG visual review); passes diagnose-illustrations cleanly.
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅ (new study-note-body test), validate:content ✅, validate:illustrations ✅, audit:content ✅ 0/0, diagnose on math-fractions-1 ✅, e2e app+study+flashcards 14/14 ✅.
Next: 1) **Next.js upgrade** — assessed: go to Next 15.5+/React 19 on a branch; only real breaking change for this static site is async `params` in dynamic routes (codemod: `npx @next/codemod@canary next-async-request-api .`); Next security patch lands 2026-07-20 — good time to do it. 2) SVG cleanup backlog (161 flagged files — overlaps/oob/overflow in legacy science SVGs). 3) DP niche topics. 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Awaiting user manual review before commit. `\dfrac` convention: KaTeX renders it full-size inline; global conversion is visually uniform.

---

## 2026-07-18 — Fix `$` rendering, SVG overflow check + Algebra Basics fix

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`)
Done:
- Root-caused literal `$` in quiz/flashcards/descriptions: content convention allows `$...$` LaTeX in all fields (audit validates it), but only `StudyNoteBody` rendered it. Created shared `src/components/InlineMath.tsx`; wired into `QuizGame` (stem/choices/explanation), `FlashcardsPageClient` (term/definition/example), `SubjectPageClient` + `StudyPageClient` (description), and note headings in `StudyPageClient`.
- Extended `scripts/diagnose-illustrations.mjs` with a **container-overflow check**: flags text whose centre sits well inside a rect but spills > 4px outside it (edge-hugging labels excluded to avoid false positives). This is the automated "visual acceptance" check.
- Fixed `math-algebra-1.svg` distributive-law label overflowing its green panel (shortened text, widened box 400→415).
- Docs: `CONTENT_STYLE.md` (where LaTeX renders), `ILLUSTRATION_GUIDELINES.md` (overflow rule), `README.md` (layout-check description).
Verified: tsc ✅, ESLint ✅, Vitest 86/86 ✅, validate:content ✅, validate:illustrations ✅, audit:content ✅ (0/0), e2e smoke app+study+flashcards 14/14 ✅ (Desktop Chrome). All 15 English SVGs + fixed math-algebra-1.svg pass the new check.
Next: 1) **SVG cleanup backlog**: full diagnosis flags 161 legacy SVGs — 139 with container overflow (270 spills, mostly labels wider than their backing rects in science SVGs), 31 label overlaps, 17 out-of-bounds. Report at `/tmp/diag-final2.txt` (regenerate with `npm run validate:illustration-layout`). Good swarm candidate. 2) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 3) Year 8 science expansion. 4) Features: spaced repetition, progress sync, PWA.
Notes: `validate:illustration-layout` exits 1 due to the pre-existing backlog (it already did before this change — 40 files). Changes uncommitted; user reviewing manually before commit.

---

## 2026-07-18 — Finish English illustrations (10 topics)

Git HEAD: `586556f` (branch `develop`, pushed to origin)
Done: Created 10 new SVGs in `public/images/english/` and attached each to notes[0] of its topic — eng-creative-1 (idea-generation techniques), eng-essay-1 (essay/PEEL structure), eng-figurative-1 (simile vs metaphor), eng-grammar-1 (parts of speech), eng-narrative-1 (point of view), eng-nonfiction-1 (text types), eng-persuasive-1 (argument structure), eng-poetry-1 (sonnet structure), eng-reading-1 (inference vs explicit), eng-speaking-1 (presentation structure). English now 15/15 illustrated — all subjects fully illustrated. Also created `AGENTS.md` (session workflow + quality gates) and this `PROGRESS.md`; fixed stale README line 24.
Verified: validate:content ✅, validate:illustrations ✅, audit:content ✅ (0/0), diagnose-illustrations (no issues in any English file) ✅, Vitest 86/86 ✅. E2E not run this session (specs auto-discover from registry).
Next: 1) Add 3 DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Year 8 science expansion (biology + physics). 3) Feature candidates: spaced repetition, progress sync/export, PWA/offline. 4) Housekeeping: archive completed plan docs to `docs/`.
Notes: English illustration pattern = one SVG per topic on notes[0]. Work was done by a 10-agent swarm; several agents saw transient eng-essay-1.json validation errors from concurrent writes — final state verified clean by parent.

---

## 2026-07-18 — Full project status review (baseline)

Git HEAD: `650cc17` (branch `develop`, clean tree). All checks green: `validate:content` ✅, `validate:illustrations` ✅, `audit:content` ✅ (0 errors/warnings), Vitest 86/86 ✅.

**Content totals:** 119 topics, 1,820 questions, avg 15.3/topic.
Math 68 · Biology 13 · Chemistry 11 · English 15 · Physics 12.

**Illustrations:** math 68/68 ✅, all sciences ✅, English 5/15 ⚠️.
English topics missing illustrations: `eng-creative-1`, `eng-essay-1`, `eng-figurative-1`, `eng-grammar-1`, `eng-narrative-1`, `eng-nonfiction-1`, `eng-persuasive-1`, `eng-poetry-1`, `eng-reading-1`, `eng-speaking-1`.

**Roadmap status:**
- Books plan: Phase 1 ✅, Phase 2 ✅, Phase 3 partial — Graph Theory + Voronoi done; Markov Chains, Volume of Revolution, Further Differential Equations NOT added (sources: Save My Exams PDFs, `~/projects/tmp/IB Books/Math/`).
- Y8 plan: math Phases 1–5 ✅, science/English pilot ✅ (3 topics); §9 next steps NOT done (more Y8 bio/phys/English).
- Content migration plan ✅ fully done. Y7 gap-fill ✅.
- No Year 9 / MYP 4–5 content; MYP stops at Year 8.

**Recommended next steps (priority order):**
1. Finish English illustrations (10 topics above) — then fix stale README line 24.
2. Add 3 DP niche topics: Markov Chains, Volume of Revolution, Further Differential Equations (7 notes / 12 flashcards / 15 questions, with illustrations).
3. Year 8 science expansion (biology + physics; see `y8-math-content-sourcing-plan.md` §9).
4. Feature candidates: spaced repetition (builds on `src/lib/weak-point-analyzer.ts`); progress sync/export (localStorage-only today); PWA/offline.
5. Housekeeping: README math illustration status; archive completed plan docs to `docs/`.

---
