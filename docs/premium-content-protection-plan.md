# Premium content protection & server-side rendering — intention note

> **Status:** intention only, 2026-09-14. **No implementation, no code change, no
> decision taken.** This file exists so the next session that picks this up starts from
> measured facts instead of a vague worry, and so the trade-offs are visible before
> anyone refactors the build.
>
> The question this note answers: *can premium content be kept out of a scraper's reach,
> and what would it actually cost?*

---

## 1. Why this is being asked

Two separate concerns get bundled together; they have very different answers.

1. **Premium leakage.** Content that customers pay for is currently downloadable by
   anyone. That is a revenue-integrity problem, and there is a real fix.
2. **General scraping of all content.** Free notes/questions being harvested by bots,
   competitors and AI trainers. Partly addressable, and partly **in direct conflict with
   the acquisition strategy** — the free content *is* the SEO funnel
   (`docs/entitlement-policy.md`: notes/flashcards/quizzes are never gated, precisely
   because BBC Bitesize gives them away).

**Decision to make up front: which of the two is the goal.** They lead to opposite
actions. Locking down free content would undo the SEO plan that
`docs/seo-technical-plan.md` and the sitemap work are built on. Protecting *premium*
content is compatible with everything.

---

## 2. Measured current state (2026-09-14)

Facts, not impressions — these were checked against the built output in `out/`, not
inferred from the code.

| Fact | Evidence |
|---|---|
| The site is a **full static export**: 886 prerendered `.html` files plus Next's RSC payload `.txt` twins for every route | `find out -name '*.html' \| wc -l` → 886; `out/papers/…/…-set-2.html` and `.txt` both exist |
| **Every premium paper set is a public static page.** `math-y9-set-2` (a premium set — sets 2+ are locked by `isFreePaperSet`) is a 48 KB HTML file containing the questions **and the markschemes**, fetchable with no session at all | `grep -c markscheme out/papers/math-y9/math-y9-set-2.html` → 8 matches; the `.txt` RSC twin also carries it |
| Question/markscheme data is also **compiled into the client JS chunks**, so even deleting the HTML would not remove it from `_next/static` | `grep -rl markscheme out/_next/static/chunks/*.js` → matches |
| Illustrations ship as **directly fetchable static assets** (`public/images/<subject>/*.svg`) | `docs/ILLUSTRATION_GUIDELINES.md`; served straight from S3 |
| **The "locked" UI is honest about being cosmetic**: `LockedFeature` is a conversion surface, explicitly not a security boundary | `docs/entitlement-policy.md` "Enforcement constraint"; `src/components/LockedFeature.tsx` |
| What **is** already enforced server-side: AI-mark quota, subscription tier, progress identity | `src/lib/entitlements/*`, `src/lib/subscriptions/http-handler.ts` |
| Existing anti-scraping posture: `robots.txt` blocks bulk **AI-training** crawlers but deliberately allows search and answer-engine crawlers; premium surfaces are `noindex, follow`; per-IP rate limits on the public write endpoints | `src/app/robots.ts`, `src/lib/seo/page-meta.ts`, `docs/seo-technical-plan.md` §4.1 |

**Conclusion from the measurements:** today, a premium subscription buys *convenience and
freshness*, not exclusivity. Anyone who knows the URL pattern
(`/papers/<course>/<course>-set-N`) can read every paid paper set. That is the concrete
thing worth fixing, and the fix is architectural, not cosmetic.

---

## 3. The honest ceiling

**No content that a browser renders can be made un-copyable.** Any protection scheme is
a cost multiplier, not a lock:

- Anything sent to a legitimately entitled logged-in user can be copied by that user.
  Anti-scraping defends against *automated bulk* extraction and casual URL-guessing, not
  against a determined subscriber.
- Realistic goals, in order of value: (1) stop the anonymous URL-guessing leak, which is
  the current actual hole; (2) make bulk extraction rate-limited, detectable and
  attributable; (3) make leaks traceable and actionable legally; (4) never let mere
  scraping break the site for real users.

Worth saying plainly in any future session: **chasing (4)-level DRM on an educational
site is a bad trade.** Effort here has a better home in content depth.

---

## 4. The options, against this repo's actual constraints

### Constraints that any option must respect

- **`output: 'export'` is load-bearing.** The whole deploy chain assumes it:
  `build-static.sh` (which also stashes `src/app/api/` aside and writes `out/version.json`),
  the S3 + CloudFront + URL-rewrite-Function topology, `scripts/serve-static.ts`, the
  `test:e2e:static` pre-deploy gate, `verify:sitemaps --verify`, and the hand-rolled
  service worker. Dropping the export is not a page change — it is a hosting-model
  change, and `docs/future-tech-stack-evolution.md` already discusses it as such.
- **The PWA caches HTML aggressively** and serves navigations cache-first
  (stale-while-revalidate). Any gated content that reaches the browser risks being
  **written into a shared cache on a device** and replayed offline. Per-user gated content
  and an offline cache are in genuine tension; the SW's exclusions are the place to
  resolve it.
- **SEO.** Free surfaces must stay prerendered and indexable. Premium surfaces are
  already `noindex, follow`, so removing their static HTML costs nothing in search.
- **The free/premium split lives in code** (`isFreePaperSet`, `isFreeLadderLevel`) and is
  derived, never hardcoded. Any gating must key off those, not off a new list of paths.

### Option A — Stop shipping premium payloads; fetch them from a session-gated API

Keep the static export exactly as it is for every page shell, but **stop the premium
question and markscheme data from being part of the build**, and deliver it at runtime
from a new session-gated endpoint (the pattern already used for progress, subscriptions
and AI marking: handler in `src/lib/<x>/http-handler.ts`, Next route for dev/e2e,
Lambda behind a CloudFront behaviour for prod).

- **Kills the current leak outright**: `/papers/…/…-set-2.html` becomes a shell that
  shows the `LockedFeature` tease until the API says the session is entitled.
- Reuses machinery that already exists and is already reviewed (session resolution,
  entitlement check, IAM, terraform module pattern, dummy-dependency tests).
- Costs: a new Lambda surface; a loading state on premium pages; the offline PWA must
  **not** cache the fetched payload; the e2e-static harness needs the new endpoint.
- **Residual exposure:** an entitled subscriber's browser still receives the content. That
  is the ceiling in §3 and it should be stated as accepted, not chased.

### Option B — Server-render premium routes only (true SSR)

Render premium HTML per-request behind an entitlement check (Lambda@Edge / origin
Lambda / on-demand rendering), so no premium bytes exist in `out/` at all.

- Strongest *structural* protection available, and the option the entitlement policy
  points at when it says "decide at subscription build time".
- Cost is the whole hosting story: the export has to be dropped or split, `build-static`,
  the pre-deploy gates, the static e2e suite and the sitemap `--verify` step all need a
  story for it. This is a multi-session architecture change, not an enhancement.
- **Recommendation for the future session: Option A first.** It closes the measured hole
  for a fraction of the cost. Option B only becomes worth it if Option A's residual
  exposure (entitled users) turns out to matter commercially — which is a data question,
  not a code question.

### Option C — Make leaks traceable (complements A or B)

Per-session personalisation of premium payloads — an invisible per-session marker, or
per-user question ordering — so a leaked copy can be traced to the account that leaked
it. Cheap relative to its deterrent value, and it also makes the Terms' anti-resale
clause enforceable in practice rather than aspirational. Requires a privacy-note note
(the marker is account-linked; see `docs/privacy-notice-draft.md` §6.3 for the
neighbouring AI-mark disclosure).

### Option D — Deterrence and detection (cheap, do regardless)

- **Detection:** per-session request-rate anomaly detection on the premium endpoints
  (the rate-limit table and fixed-window pattern already exist), plus monitoring for
  copies of distinctive content phrases appearing elsewhere.
- **Response readiness:** a documented takedown path, and the anti-scraping and
  no-AI-training clauses already drafted in `docs/terms-of-use-draft.md` §6–§7. Legal
  footing is what makes the technical work worth anything.
- **robots.txt:** already blocks the main training crawlers by user agent. Keep the
  deliberate allowance of search and answer engines — that is the SEO funnel, and blocking
  it would cost more than the scraping it prevents.
- **Illustrations:** if SVG assets are being taken, the cost of that is low and the
  remedy is legal, not technical — do not build asset protection machinery for it.

---

## 5. Open questions for the future session

Not answers — the list of things that must be decided before any implementation starts.

1. **Which problem are we solving** — premium leakage, or scraping in general (§1)?
2. **What is the acceptable residual exposure?** If "an entitled subscriber can copy it"
   is unacceptable, only Option B is on the table, and the hosting migration comes with
   it. If it is acceptable, Option A plus D is a day or two of work against existing
   patterns.
3. **Does the free tier stay wide open** for SEO, as the entitlement policy says? If not,
   the SEO plan needs rewriting first, not the build.
4. **Offline behaviour.** Does premium content need to work offline at all? If not, the SW
   must explicitly exclude premium payloads. If yes, Option A's protection is materially
   weaker (the payload is cached on-device) and that trade needs to be made explicitly.
5. **Does anything need to change for the AI-marked free-text path** — the entitlement
   already checks server-side, so probably not, but the quota and the content gate should
   be reviewed together so they do not diverge.
6. **Commercial signal.** Any actual evidence of paid content being copied (support
   emails, referrer logs, quoted content found elsewhere) — if there is none, the priority
   ordering of this whole document changes.

---

## 6. What this note deliberately does not do

- It does not change any code, page, terraform module, SW, or build script.
- It does not commit to Option A or B.
- It does not propose DRM, obfuscation, canvas rendering, screenshot blocking, or
  per-page watermarks — all of which harm legitimate users more than they harm scrapers.
