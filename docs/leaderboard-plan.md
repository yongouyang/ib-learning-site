# Leaderboard Plan (Phase D) — Healthy Competition at Octav Learning

> **Status:** Reviewed 2026-08-23 (draft + review amendments applied — daily-cap /
> repeat-cap storage in §4.1/§5, flashcard ALL_OLD detection, diagnostic XP dropped
> (no sync event exists), week attribution pinned to sync time, public teaser
> endpoint in §6, immediate opt-out delete in §7, §12 open questions resolved).
> Supersedes and sharpens the Phase D
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
2. **Server-computed, cheat-bounded.** Scores derive ONLY from server-validated
   progress events (the sync path), never from client-reported totals. Be honest
   about the limit: the sync schema accepts the client's `correctCount` (capped at
   500/attempt), so a determined user with a session cookie can fabricate
   attempts — server-side award prevents replay-doubling, and the daily cap +
   sync rate limit bound the damage to ≤ 500 XP/day/profile, but answers are not
   server-verified. That is the right trade at this stake level; revisit if
   boards ever carry rewards. Mitigates risk R12 in
   `architecture-evolution-plan.md` §8.
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
```

(No diagnostic line: the sync schema has no diagnostic event today — only
`quizAttempt` / `examResult` / `ladderResult` / `flashcardResult`. Diagnostics
either ride `examResult` or need a fifth event type; both are follow-ups, not
MVP. Revisit the 50-XP diagnostic bonus when that event exists.)

Caps to keep it healthy and bound cheating:
- **Daily soft cap: 500 XP per profile per day.** Anything beyond still records
  progress but earns no leaderboard XP — removes the farming incentive without
  punishing genuine cramming (the progress page still shows everything).
  Storage: fixed-window bucket `xpday:<profileId>:<YYYY-MM-DD>` in
  `octav-rate-limits` (TTL ~2 d), one conditional increment on the award path —
  the `aimark:<userId>:<YYYY-MM>` pattern from Phase E2, no new table.
- **Diminishing repeats:** re-attempting the *same* topic quiz earns half XP from
  the 3rd attempt and zero from the 6th — mastery, not grinding. Storage: a
  per-topic-per-week attempt counter bucket
  `xp-topic:<profileId>:<topicId>:<weekKey>` (TTL ~10 d), one conditional
  increment whose returned ordinal picks the multiplier (1, 1, 0.5, 0.5, 0.5,
  then 0) — no read of the progress table in the hot sync path, keeping the
  one-conditional-command-per-write invariant.
- **Flashcard "newly-known" detection:** the LWW `putFlashcard` UpdateCommand
  returns `ReturnValues: ALL_OLD`, so the prior status is available in the same
  write — award 2 XP only on a not-known → known transition. No extra read.
- **Ladder award:** `updateLadderLevel` is already a conditional per-level max —
  award only when the write reports an improvement (a first clear or a higher
  score that would newly pass), not on every replayed/lower score.
- All inputs are already budgeted/validated by the sync schema
  (`src/lib/progress/types.ts`), and the sync endpoint already has a durable
  per-user rate limit — the XP pipeline inherits both protections.

**Applied-vs-replay plumbing (D4 prerequisite):** `applyEvent` currently returns
`void` and discards the storage layer's "already applied" / "improved" signals
(e.g. `putTopicAttempt` returns false on a replay). D4 must surface a per-event
`applied: boolean` (or delta) so XP is awarded only on writes that actually
changed state — this is the entire idempotency argument of §5.

**Week attribution:** XP always credits the CURRENT week, keyed off the server
clock at sync time — never the client-reported event `date`. Late-synced work
earns in the week it syncs. This is slightly unfair to offline users but makes
finished boards immutable (last week's rows are still within TTL when the sync
arrives; letting a client date write into them would rewrite history).

Streak and total stars stay on the user's own Progress page (per the §4.1
recommendation in the architecture plan) — they are personal metrics, not
competition metrics.

### 4.2 Scope (who you compete against)

Default view: **your stage** (KS3 / IGCSE / DP) — students compete with true
peers, which is the fairest comparison and matches the course structure in
`src/lib/courses.ts`. **Global is deferred with the cohorts** (§12 Q3: at
launch density a global board is a 5-person list — harmless but thin, and
stage-only halves the write amplification to one UpdateItem per earning
event). The data model keeps the `global` scope available so adding it later
is a config change, not a migration.

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
- One row per (profile, scope, week): MVP ships stage-scope only (§12 Q3), so
  one UpdateItem per XP-earning sync. When Global is added, a profile on the
  KS3 stage board AND the global board writes two rows per earning event
  (atomic `ADD xp`) — negligible cost, and each board stays a self-contained
  partition.
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
| `GET /api/leaderboard/teaser?scope=stage:ks3` | none | Public: top-3 handles + XP only (no ranks beyond 3, no neighbourhood) — powers the logged-out conversion card in §7. Handles are pseudonymous by design, so this leaks no PII; keep it read-cheap (Limit 3 Query). |
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
`octav-leaderboard` AND on `octav-rate-limits` for the `xpday:` / `xp-topic:`
cap buckets — it already has UpdateItem there); `site` module
`/api/leaderboard/*` behavior listed before `/api/*`; both deploy jobs gain the
`_health` smoke assertion; the **auth** Lambda gains Query (user-index GSI) +
DeleteItem on `octav-leaderboard` for BOTH account-deletion erasure and
opt-out row removal (one grant, two callers).

## 7. Client UX

- **Nav:** tab on the Progress page (`/progress?board=1` or a dedicated
  `/leaderboard` — decide in D4; a dedicated page is cleaner for sharing/SEO and
  matches the "own surface" rule for UX review). Entry copy: "Leaderboard".
- **Board view:**
  - Header: stage label (your profile's stage — Global toggle arrives with
    cohorts, §4.2), week label + localised countdown ("resets Monday morning"),
    and a "Last week" link while the previous board is alive.
  - Top-3 podium, then the caller's neighbourhood window (the relative-board
    pattern from the HKU findings). Each row: rank, handle, XP. Caller's row
    highlighted.
  - Caller footer card: "You: #7 · 240 XP this week · personal best 310".
    Personal-best framing keeps it self-referential.
- **Not opted in (logged in):** value-prop card — "See how you compare this
  week. Anonymous handle, opt out any time." with a per-profile opt-in button.
- **Logged out:** teaser card powered by the public
  `GET /api/leaderboard/teaser` endpoint — top-3 handles of one stage board
  (handles are public by design; no PII) + "Create a free account to join".
  This is the anonymous→account conversion hook the entitlement policy intends.
- **Opted in:** "Leave leaderboard" in the row's overflow / account page.
  Leaving **deletes the profile's current-week rows immediately** via the same
  erasure plumbing as account deletion (the auth Lambda handles
  `POST /api/auth/account`, so it gains `DeleteItem` on `octav-leaderboard` +
  Query on the user-index GSI — shared with the delete-account path, one grant
  covering both). No soft-filter at read: rows are gone, not hidden. Re-joining
  in the same week restarts from 0 XP — acceptable, and it closes the
  leave-and-rejoin-to-reset-rank exploit.
- Copy voice per `docs/UX_GUIDELINES.md`: celebrate effort, never shame rank
  ("You're 30 XP away from #5", not "You're losing").

## 8. Privacy & safety (minors)

| Concern | Mitigation |
|---------|-------------|
| COPPA / GDPR-K | Opt-in per child profile by the parent account; pseudonymous handles; no PII on the board; erasure hook wired into account deletion (GSI delete). |
| Bullying / contact | No messaging, no profile pages, no friend graph at launch — handle + number only. |
| Demotivation | Neighbourhood view, personal bests, weekly reset, no public bottom, opt-out always visible. |
| Cheating | Server-awarded XP only (replay-safe); daily cap; diminishing repeats; sync rate limit inherited. Bounded, not prevented — client-reported `correctCount` is trusted within schema caps (§3.2); revisit if boards ever carry rewards. |
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
| D4 | XP accrual hook in progress `applyEvent` (accepted-writes-only) + daily cap + diminishing repeats + applied-signal plumbing (§4.1) | Medium | applyEvent surfaces per-event applied/improved; replayed syncs award zero; caps enforced; existing progress tests stay green |
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

## 12. Open questions — resolved in review (2026-08-23)

1. **XP weights** — keep 10/quiz-correct and 20/exam-correct (+ perfection
   bonuses); ladder stays 30 × level. The diagnostic 50-XP line is dropped from
   MVP (no diagnostic sync event exists).
2. **Daily cap 500 XP** — keep. ≈ 50 correct quiz answers a day is a genuine
   hard-working day for KS3; the cap only bites farms.
3. **Stage boards only, or Global in MVP?** — **stage-only.** Global is deferred
   with the cohorts; the data model keeps the scope available (§4.2).
4. **Last-week board retention** — keep 7 days readable via TTL. Longer needs an
   archive read pattern; not worth it now.
5. **Countdown timezone** — board resets Monday 00:00 UTC; the UI localises the
   label ("resets Monday 9am your time").

Resolved during the same review (details inline): week attribution = sync-time
current week only (§4.1); logged-out teaser gets a public
`GET /api/leaderboard/teaser` endpoint (§6/§7); opt-out deletes current-week
rows immediately via the auth Lambda's erasure grant (§7); daily-cap and
repeat-cap state live in `octav-rate-limits` buckets, not the leaderboard table
(§4.1); stage switching mid-week is allowed — the profile simply starts earning
into its new stage's board from zero (no transfer, no cleanup).
