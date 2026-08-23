# Leaderboard Plan (Phase D) — Healthy Competition at Octav Learning

> **Status:** Draft for review (2026-08-23). Supersedes and sharpens the Phase D
> sketch in `architecture-evolution-plan.md` §4. Policy anchor: the leaderboard is
> **free-with-login, never premium** (`entitlement-policy.md` Tier 1).
> Objective: promote healthy competition and increase weekly usage (activation,
> retention, sessions per user) — without demotivating the majority or exposing
> minors.

## 1. Why a leaderboard, and what "winning" looks like

A leaderboard is the cheapest engagement loop we can buy: it converts the
progress data we already store (`octav-progress`) into social comparison, which
is the single most evidence-backed driver of repeat usage in learning apps. But
leaderboards have a well-documented dark side: they motivate the top ~10–20% and
demoralise everyone ranked below them, and they invite score-cheating. The design
below is built around avoiding both failure modes.

**Success metrics (decide before building):**

| Metric | Definition | Target (first 90 days) |
|--------|-----------|------------------------|
| Activation | logged-in profiles that opt in / all logged-in profiles | ≥ 25% |
| Retention lift | weekly return rate, opted-in vs matched non-opted-in cohort | +10 pts |
| Usage lift | quiz/exam completions per active profile per week | +15% |
| Habit | median study-days per week among opted-in users | 1 → 2 |
| Health guardrail | weekly opt-out rate | < 5% |
| Health guardrail | share of weekly XP held by top profile (per scope) | < 40% (signals farming) |

All of these are measurable with the existing analytics stack (Phase A) plus two
new events (§7).

## 2. Lessons from Duolingo (the benchmark)

Duolingo is the canonical success story (113M MAU, and its leaderboard/league
system is consistently cited as a core retention driver — see the
[trophy.so case study](https://trophy.so/blog/duolingo-gamification-case-study)
and Duolingo's own explainer,
[How do Duolingo Leaderboards work?](https://blog.duolingo.com/duolingo-leagues-leaderboards/)).
Distilled mechanics and why they work:

1. **Leagues, not one big list.** Users are placed in a league (Bronze → Silver →
   Gold → Sapphire → Ruby → Emerald → Amethyst → Obsidian → Diamond) and compete
   in a **small cohort (~30 users) on weekly XP**. The top zone promotes, the
   bottom zone demotes (mechanics summarised in
   [Duolingo Leagues Explained](https://linguasteps.com/reviews/duolingo-leagues-explained-how-the-leaderboard-works-and-how-to-win)
   and the [divisions overview](https://www.spliiit.com/en/blog/divisions-duolingo-explication)).
   A small cohort means *everyone* is near the top or bottom of something —
   relative position is always meaningful.
2. **Weekly reset.** Everyone restarts on Monday. New users are never competing
   against a two-year accumulator; there is always a fresh, winnable contest.
3. **XP from real lessons only.** XP is awarded for completing exercises, computed
   server-side. The currency is simple ("do lessons, get XP") but not farmable by
   replaying one trivial lesson.
4. **Competition is one loop among several.** Streaks (daily habit), quests
   (short-term goals), achievements (long-term milestones) and friends
   support the leaderboard. The leaderboard alone would burn users out —
   the surrounding loops keep it healthy.
5. **Social framing is opt-in and pseudonymous.** You see usernames/avatars, never
   real identity, and you can ignore the leagues entirely.

**The research evidence for this shape:**

- **Relative (neighbourhood) leaderboards beat absolute ones.** A controlled study
  of gamified leaderboards in online classes found the *relative* leaderboard
  group showed higher engagement than the absolute-leaderboard group
  ([HKU study](https://hub.hku.hk/bitstream/10722/368255/1/content.pdf)). Seeing
  yourself a few places from the top of a small list is motivating; seeing
  yourself #8,532 of 113M is not.
- **Leaderboards demotivate low performers** when the gap looks unbridgeable —
  the standard educational-psychology finding (also the thrust of the
  [Jönköping thesis on Duolingo's gamification](https://hj.diva-portal.org/smash/get/diva2:1866808/FULLTEXT01.pdf)).
  Mitigations: small cohorts, short seasons, "your neighbourhood" view instead of
  a raw top-100, and a personal-best framing.
- **Streak/competition anxiety is real**, especially for minors — Duolingo itself
  is criticised for guilt-driven retention
  ([Cologne Game Lab analysis](https://colognegamelab.de/wp-content/uploads/2026/05/KLDSP_onlineissue1.pdf),
  [children's right-to-disconnect discussion](https://dl.acm.org/doi/epdf/10.1145/3773077.3806127),
  and UX friction like the
  [XP-boost trap](https://www.androidauthority.com/duolingo-xp-boost-ux-trap-3674572/)).
  For a KS3–DP audience of minors, we deliberately take the *low-pressure* end of
  Duolingo's design space: opt-in, pseudonymous, no streak-shaming, easy exit.

**What we copy, what we skip (for now):**

| Duolingo element | Octav decision |
|------------------|----------------|
| Weekly XP contest | ✅ adopt (core) |
| Small cohort + "your neighbourhood" view | ✅ adopt (core) |
| Promotion/demotion leagues | ⏸ defer — needs cohort density we don't have yet (§4.4) |
| Streaks | ✅ already have (`currentStreakDays`) — display, don't rank on |
| Quests / achievements / badges | ⏸ later phase |
| XP boosts / paid accelerators | ❌ never — conflicts with "never premium" policy and invites farming |

## 3. Design principles (locked)

1. **Healthy over addictive.** Opt-in, pseudonymous, neighbourhood view, personal
   bests, no public bottom-shaming, one-click exit. The leaderboard should make
   the middle of the pack feel *close*, not hopeless.
2. **Server-computed, cheat-resistant.** Scores derive ONLY from server-validated
   progress events (the sync path), never from client-reported totals. Mitigates
   risk R12 in `architecture-evolution-plan.md` §8.
3. **Weekly seasons.** Reset every Monday 00:00 UTC. Fresh contest, new users can
   win, no permanent leaders.
4. **Free with login, never premium** (policy). Anonymous visitors see a teaser
   that motivates sign-up; the actual board needs identity (per-profile opt-in,
   minor-privacy rules).
5. **Minors' privacy by construction.** Auto-generated handles, no real names,
   no emails, no avatars, no messaging, no profile pages. Parent opts in per
   child profile (COPPA/GDPR-K pattern from `architecture-evolution-plan.md` §4.6).
6. **Reuse the stack.** Same static-export + Lambda + DynamoDB + controllable-dummy
   pattern as auth/progress/analytics. No new infra shape.

## 4. The model

### 4.1 Ranking metric: Weekly XP

One number, computed **server-side** from accepted sync events:

```
XP event values (server-side, on accepted sync writes only):
  quiz attempt        10 × correctCount            (+ 20 bonus if 100%)
  exam/paper attempt  20 × correctCount            (+ 40 bonus if 100%)
  ladder level pass   30 × level                   (max-wins already enforced)
  flashcard "known"   2 per newly-known card
  diagnostic complete 50 (once per course)
```

Caps to keep it healthy and cheat-resistant:
- **Daily soft cap: 500 XP per profile per day.** Anything beyond still records
  progress but earns no leaderboard XP — removes the farming incentive without
  punishing genuine cramming (the progress page still shows everything).
- **Diminishing repeats:** re-attempting the *same* topic quiz earns half XP from
  the 3rd attempt and zero from the 6th — mastery, not grinding.
- All inputs are already budgeted/validated by the sync schema
  (`src/lib/progress/types.ts`), and the sync endpoint already has a durable
  per-user rate limit — the XP pipeline inherits both protections.

Streak and total stars stay on the user's own Progress page (per the §4.1
recommendation in the architecture plan) — they are personal metrics, not
competition metrics.

### 4.2 Scope (who you compete against)

Default view: **your stage** (KS3 / IGCSE / DP) — students compete with true
peers, which is the fairest comparison and matches the course structure in
`src/lib/courses.ts`. Toggle to **Global**.

Deferred (need density): per-subject and per-course boards. At today's
family-scale user counts a per-course board would list 2 people; stage + global
is the honest MVP.

### 4.3 Anonymisation

- Each opted-in profile gets an auto-generated handle: `{Adjective} {Animal}`
  ("Brilliant Badger"). Generated deterministically from the profileId (so it is
  stable across devices with zero extra storage) and changeable once.
- The board shows handle + XP only. The current user's own row is highlighted.
- Parent accounts never appear (only child profiles compete).

### 4.4 Cohorts — the density decision

Duolingo's ~30-user cohorts need thousands of weekly-active users per board to
fill. We are pre-launch-scale, so **the MVP is one shared board per scope** (top
100 + your neighbourhood). The data model keeps a `cohortId` field (MVP:
`"open"`) so we can slice into ~30-user cohorts later *without a migration* —
the slice key is just part of the sort. Promotion/demotion leagues unlock once a
stage board has ≥ ~120 weekly-active opted-in profiles (enough for 4 meaningful
cohorts). Until then, "leagues" would be an empty theatre.

### 4.5 Weekly lifecycle

- Week key: ISO week string (`2026-W35`), computed server-side in UTC.
- Monday 00:00 UTC the current week rolls. Last week's board stays readable for
  7 days ("last week" tab) via TTL, then expires.
- No cron needed for correctness: the week key is derived at read/write time.
  (The architecture plan's EventBridge rule becomes optional cleanup; drop it
  from MVP — DynamoDB TTL does the work.)

## 5. Data model

**New DynamoDB table: `octav-leaderboard`** (on-demand, in `terraform/modules/dynamodb`):

```
PK: scopeWeek      string   "<scope>#<weekKey>[#<cohortId>]"
                            scopes: "stage:ks3" | "stage:igcse" | "stage:dp" | "global"
SK: entry          string   "<profileId>"

Attributes:
  userId       string        (owner — for deletion/erasure)
  handle       string
  xp           number        (this week's XP, atomic ADD)
  lastEarnedAt string        (ISO)
  cohortId     string        ("open" in MVP)
  expiresAt    number        (TTL: week end + 14d)

GSI: user-index   PK=userId  — for right-to-erasure deletes by user
```

Why this shape:
- Top-N for a board = one `Query` on `scopeWeek` with a secondary ordering on
  `xp`. DynamoDB can't sort on a non-key attribute, so reads fetch the partition
  (bounded: top-100 cap + neighbourhood window) and sort in the Lambda — at our
  scale a board partition is tens-to-hundreds of items, so this is milliseconds
  and costs one read. If a board ever grows past ~1k entries, add a
  `xpBucket` sort-key redesign or a weekly rank-materialisation job — not before.
- One row per (profile, scope, week): a profile on the KS3 stage board AND the
  global board writes two rows per earning event (atomic `ADD xp`). Two
  UpdateItems per XP-earning sync — negligible cost, and each board stays a
  self-contained partition.
- `attribute_not_exists`-style conditional writes are NOT needed here — XP is
  idempotent because it is derived from *already-idempotent* sync writes: the
  progress handler applies each event at most once (replays are no-ops), and we
  award XP only when the underlying write reports "applied". Duplicate syncs
  therefore cannot double-award.

**Opt-in state** lives on the existing user record: `childProfiles[i]` gains
`leaderboardOptIn: boolean` + `leaderboardHandle: string` (via the existing
`accountUpdateSchema` — no new auth surface).

## 6. API + code layout (the established handler-contract pattern)

Following the auth/progress/analytics precedent: one shared handler contract,
delegated to by BOTH the Next dev/e2e routes and the prod Lambda, with a
controllable dummy sharing the in-memory universe.

```
src/lib/leaderboard/
  ├── types.ts          week key math, XP tables + caps (pure, unit-tested)
  ├── xp.ts             scoreEvents(acceptedResults) → XP deltas (pure)
  ├── handles.ts        deterministic {adjective} {animal} generator
  ├── http-handler.ts   GET /api/leaderboard, GET /api/leaderboard/_health
  ├── dummy.ts          InMemoryLeaderboardStorage (shared universe)
  └── dynamodb-storage.ts

src/app/api/leaderboard/route.ts        (dev/e2e delegation)
lambda/leaderboard/index.ts             (NEW fifth Lambda — or fold into progress, see below)
src/app/leaderboard/page.tsx            (static client page, like /admin/analytics)
```

**Endpoints**

| Endpoint | Auth | Behaviour |
|----------|------|-----------|
| `GET /api/leaderboard?scope=stage:ks3&week=current\|prev&profileId=<p>` | session | Top 100 + caller's neighbourhood (2 above / self / 2 below) + caller's rank & XP + week metadata. `profileId` validated against the session user's childProfiles (same rule as progress). |
| `GET /api/leaderboard/_health` | none | Unauthenticated Limit-1 Query smoke probe (the progress/analytics `_health` pattern). |

No write endpoints — XP accrues inside the **progress sync handler**: after
`applyEvent` reports an accepted write, it calls the leaderboard storage's
`addXp(userId, profileId, scopes, xp)`. That keeps the single-writer invariant
(one Lambda owns score mutation) and reuses the session/profile validation the
sync path already does. The leaderboard Lambda is read-only.

**Hosting choice:** a fifth Lambda (`modules/leaderboard_api`) matches the
existing one-domain-one-function shape and keeps the progress Lambda untouched;
the alternative is folding the two read routes into the progress Lambda. Given
the standing pattern and that CI already deploys N Lambdas uniformly, recommend
the fifth Lambda.

**Terraform deltas:** `dynamodb` module + table + GSI + outputs; new
`leaderboard_api` module (Function URL + least-privilege IAM: leaderboard
Query/Get + users/sessions session-validation grants, NO write grants — writes
come from the *progress* Lambda, which gains `dynamodb:UpdateItem` on
`octav-leaderboard`); `site` module `/api/leaderboard/*` behavior listed before
`/api/*`; both deploy jobs gain the `_health` smoke assertion; account-deletion
path gains leaderboard erasure via the user-index GSI.

## 7. Client UX

- **Nav:** tab on the Progress page (`/progress?board=1` or a dedicated
  `/leaderboard` — decide in D4; a dedicated page is cleaner for sharing/SEO and
  matches the "own surface" rule for UX review). Entry copy: "Leaderboard".
- **Board view:**
  - Header: scope toggle (Your stage ▾ / Global), week label + countdown
    ("resets Monday 00:00 UTC"), and a "Last week" link while the previous board
    is alive.
  - Top-3 podium, then the caller's neighbourhood window (the relative-board
    pattern from the HKU findings). Each row: rank, handle, XP. Caller's row
    highlighted.
  - Caller footer card: "You: #7 · 240 XP this week · personal best 310".
    Personal-best framing keeps it self-referential.
- **Not opted in (logged in):** value-prop card — "See how you compare this
  week. Anonymous handle, opt out any time." with a per-profile opt-in button.
- **Logged out:** teaser — top-3 handles of one stage board (handles are public
  by design; no PII) + "Create a free account to join". This is the
  anonymous→account conversion hook the entitlement policy intends.
- **Opted in:** "Leave leaderboard" in the row's overflow / account page;
  leaving hides the entry immediately (soft: keep XP row, filter at read) and
  deletes it at week end.
- Copy voice per `docs/UX_GUIDELINES.md`: celebrate effort, never shame rank
  ("You're 30 XP away from #5", not "You're losing").

## 8. Privacy & safety (minors)

| Concern | Mitigation |
|---------|-------------|
| COPPA / GDPR-K | Opt-in per child profile by the parent account; pseudonymous handles; no PII on the board; erasure hook wired into account deletion (GSI delete). |
| Bullying / contact | No messaging, no profile pages, no friend graph at launch — handle + number only. |
| Demotivation | Neighbourhood view, personal bests, weekly reset, no public bottom, opt-out always visible. |
| Cheating | Server-derived XP only; daily cap; diminishing repeats; sync rate limit inherited. |
| Anxiety | No push notifications about rank in MVP; countdown yes, guilt-trip never. |

## 9. Instrumentation (extend the Phase A taxonomy)

Add two events to `ANALYTICS_EVENT_NAMES` (17 → 19):
- `leaderboard_viewed` `{ scope, week }`
- `leaderboard_opt_in` / `leaderboard_opt_out` → one event
  `leaderboard_membership_changed` `{ action: "join" | "leave", scope }`

Success-metric queries (§1) run off these + existing `quiz_completed` /
`exam_completed` + `auth_login_completed` on the admin dashboard.

## 10. Build sequence (Phase D checklist)

| Step | Work | Risk | Definition of done |
|------|------|------|--------------------|
| D1 | Pure core: `types.ts` (week keys, XP tables, caps), `xp.ts`, `handles.ts` + unit tests | Low | XP math & week math fully tested (parity-style pure helpers) |
| D2 | Storage: `octav-leaderboard` table design in dummy + `dynamodb-storage.ts`, parity tests | Medium | dummy↔DDB parity on addXp/topN/neighbourhood/erasure |
| D3 | Handler: `GET /api/leaderboard` + `_health`, session/profile validation, Next route + Lambda + deps seam (fail-closed) | Medium | Unit tests cover 200/400/401/501 paths, smoke probe |
| D4 | XP accrual hook in progress `applyEvent` (accepted-writes-only) + daily cap + diminishing repeats | Medium | Replayed syncs award zero; caps enforced; existing progress tests stay green |
| D5 | Opt-in surface: `accountUpdateSchema` + account page UI + deterministic handle | Low | E2E: opt in → handle shown → appears on board |
| D6 | Client page `/leaderboard` (board, neighbourhood, opt-in/out, logged-out teaser) + UX-review pass | Medium | E2E across 3 devices; UX subagent pass (mobile+desktop × light/dark × states) |
| D7 | Terraform: table + GSI, `leaderboard_api` module, progress-Lambda write grant, `/api/leaderboard/*` behavior, `_health` smoke in both deploy jobs, erasure wiring | Medium (infra) | CI deploy-dev green; smoke passes on dev |
| D8 | Analytics events + PROGRESS.md + AGENTS.md bullet | Low | Dashboard shows new events |

Ordering note: D1–D3 are API-complete and testable with zero client work; D4 is
the only change to the hot sync path (smallest, most-reviewed diff); D5–D6 are
client; D7 ships it. Estimated total: 1–2 focused weeks, same as the original
plan's estimate.

## 11. What we explicitly defer

- Promotion/demotion **leagues + cohorts** (needs ~120 weekly opt-ins per stage;
  revisit with real density numbers 60 days post-launch).
- Per-subject / per-course boards (same density argument).
- Friends / class boards, quests, badges, streak showcases (the "surrounding
  loops" — highest-value next step after the base board proves out).
- Real-time updates (fetch-on-view + a 60s client refresh is plenty).
- Email/notification nudges about rank (anxiety risk; revisit with care).

## 12. Open questions

1. **XP weights** in §4.1 — are quizzes (10/correct) vs exams (20/correct) the
   right relative value? Exams are rarer and harder; current weighting favours
   them. Confirm before D1.
2. **Daily cap 500 XP** — roughly 25 perfect quiz questions; sane for KS3?
3. **Stage boards only, or include Global in MVP?** Global at low density is a
   5-person list; harmless but thin. Recommend shipping stage-only first.
4. **Last-week board retention** — 7 days readable is free via TTL; longer needs
   an archive read pattern. Keep 7?
5. Countdown timezone — board resets 00:00 UTC; UI should localise the label.
