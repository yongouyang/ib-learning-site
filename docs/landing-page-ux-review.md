# UX Expert Review — Octav Learning Landing Page

> **Review date:** 2026-08-11
> **Reviewer:** UX-expert agent (spawned via team_spawn_teammate)
> **Inputs reviewed:** `docs/landing-page-copy-proposal.md`, `src/app/page.tsx`, `src/app/layout.tsx`, nav components, subject/progress/diagnostics/exams pages, and all mockup screenshots in `docs/landing-poc/`
> **Status:** Expert review of the copy proposal — not yet implemented.

---

## A. Current layout critique

### What works

- **The conditional dashboard cards are genuinely good product design.** "Needs Practice" (`page.tsx:39`), "X flashcards due" (`:66`), and "Not sure where to start?" (`:87`) are the right *returning-user* surface — they turn the home page into a personalized to-do list, which is exactly what a study app's home should be. The color-coding (orange = weak, green = due, blue = onboarding) is clear and consistent.
- **The subject grid is honest and inviting.** Emoji + name + topic count + star rating + accent top-border (`:118`) is scannable and reuses the same `.card` token as everything else, so the visual language is coherent.
- **`max-w-4xl` container** is the widest in the app (subjects use `max-w-3xl`, progress `max-w-2xl`), giving the home page appropriate primacy.

### What fails for first-time visitors

1. **Zero value proposition.** Confirmed: a brand-new visitor lands on a logo-in-an-`<h1>` (`page.tsx:22`) and a grey stats line ("5 subjects · 137 topics · Study notes, flashcards & quizzes", `:26`). No headline, no subhead, no "what is this / why try it." The proposal's gap analysis (§1.4) is accurate — this is the single biggest problem.
2. **The `<h1>` is the logo.** `page.tsx:22-25` wraps the logo `<img>` in `<h1>`. So the only `<h1>` on the page communicates *nothing* to a screen reader or SEO crawler except the alt text "Octav Learning." There is no semantic page heading. This must change regardless of the hero.
3. **Double branding on desktop.** The layout header (`layout.tsx:60-65`) already shows the logo at `h-6`, then `page.tsx:23` shows it again at `h-10`. Redundant on desktop; necessary on mobile (no top header). This asymmetry should drive the fix (see C).
4. **Stats line is dead weight for first-timers.** "Study notes, flashcards & quizzes" undersells the product — it omits diagnostics, mock exams, and AI-marked papers entirely, which are the differentiators. The line is accurate but strategically misleading.

### Navigation — yes, this is a real problem

The 3-item nav (`nav-items.ts`: Learn / Review / Progress) hides **three of the product's strongest features**:

| Feature | Route | How a user finds it today |
|---|---|---|
| Diagnostics | `/diagnostics` | Only the first-time "Not sure where to start?" card (`:87`) → **disappears once the user has any weak topics** |
| Mock exams + ladder | `/exams` | Only the Progress page (`progress/page.tsx:58`) |
| AI-marked papers | `/papers` | Only nested inside the Exams page (`exams/page.tsx:55-63`) |

**The killer issue:** a *returning* user with progress data has **no path to Diagnostics from the home page at all** — the onboarding card vanishes the moment they have weak topics, which is precisely when diagnostics are most useful (re-baseline after learning). They must intuit "go to Progress → Diagnostics." That's a dead-end IA.

Exams and Papers are even worse: Papers is two clicks deep *under* Exams, and Exams itself is only linked from Progress. A user who never opens Progress will never discover timed mock exams or AI marking — the two most "wow" features for converting parents.

**Verdict:** the nav is inadequate. This is more urgent than the hero copy, because the hero only helps first-timers; the nav gap hurts *everyone*. See D for a concrete proposal.

### Mobile vs desktop

- **Mobile has no top header** (`layout.tsx:60` is `hidden md:flex`); the only persistent chrome is the 64px bottom nav (`Nav.tsx:13`, `h-16`). So on mobile the hero must carry the full branding load (logo + headline + CTA) since there's no header wordmark. This is the key driver of the hero design.
- **Desktop has a persistent header** with the logo, so the hero's job is purely value-prop + CTA, not branding. The body-level logo (`page.tsx:23-24`) is redundant on desktop.

---

## B. Proposed copy & hero review

### Motto: "Find your range. Practise with purpose. Perform with confidence."

**Strong concept, risky execution.** The three-beat octave metaphor is clever and brand-appropriate, but there are concerns:

1. **It's a lot of text for an eyebrow/kicker.** Three clauses × 3-4 words each = 12 words above a headline. On a 375px screen, this wraps to 2-3 lines and competes with the headline for attention. An eyebrow should be 1 short phrase (3-5 words max) that sets context, not a second headline.
2. **The three beats duplicate the three pillar headings** directly below it. The motto says "find your range / practise / perform" and then the pillars say "Find your range / Practise with purpose / Perform with confidence." The user reads the same thing twice within one viewport. This is the redundancy risk.
3. **"Find your range" as the first beat is the weakest link.** "Range" is the most abstract/musical of the three; a student who doesn't know the octave metaphor may not parse it. "Practise with purpose" and "Perform with confidence" are self-explanatory.

**Recommendation:** Keep the motto as a brand statement but **don't use all three beats as the eyebrow.** Instead:
- **Eyebrow:** Use a *single* short phrase that frames the product, e.g. `"Free secondary-school study companion"` or `"KS3 · IGCSE · IB DP"` (the stage tags are instantly meaningful to the target audience).
- **Motto placement:** Move the full three-beat motto to the *footer* or as a subtle brand line *below the CTAs* — not as a pre-headline eyebrow. OR use it as the pillar section heading: `"Why Octav — find your range, practise with purpose, perform with confidence"` as an `<h2>`.

This eliminates the double-read problem and gives the motto a home where its length is appropriate (a section heading, not a kicker).

### Hero headline: "Master secondary school — from KS3 to IB."

**Good, with one tweak.** "Master" is strong and action-oriented. "From KS3 to IB" communicates the breadth in 4 words. Two concerns:

1. **"Secondary school" is UK-specific.** The product targets KS3/IGCSE/IB — all UK/international curricula — so this is probably fine for the audience. But if there's any ambition beyond the UK/international-school market, "secondary school" may not land. For now: **keep it** — the audience is UK/international-school.
2. **The em-dash creates a natural pause** that works well for rhythm. Consider testing without it ("Master secondary school from KS3 to IB") — the dash adds emphasis but also length. Minor; either works.

**Verdict: approve the headline as-is.**

### Subhead: too long

The proposed subhead ("Octav Learning brings illustrated study notes, smart flashcards, and real exam practice together in one place — so every student can find their range across Math, English, Biology, Chemistry and Physics. Free to try, on any device.") is **46 words.** That's a paragraph, not a subhead.

- On desktop it wraps to 3 lines at `max-w-2xl`.
- On mobile (375px) it wraps to **6-7 lines**, pushing the CTAs below the fold.
- It also repeats "illustrated study notes, smart flashcards, real exam practice" — which is the *same content* as the three pillars below.

**Recommendation: cut to ~20 words, two sentences max.** The subhead's job is to get the user to the CTA, not to enumerate features (the pillars do that). Suggested:

> Free illustrated notes, smart flashcards, and real exam practice — for every secondary subject, on any device.

(20 words, one sentence. The pillars expand on each part.)

### "Why Octav" three-pillar strip

**Structure: right approach, content distribution: needs work.**

The three-pillar mapping to the motto beats is clean. But:

1. **Pillar 1 ("Find your range") mixes diagnostics and notes.** The paragraph covers diagnostics ("pinspoints what you know") AND illustrated notes ("break every topic into steps"). These are two different features. Diagnostics = assessment; notes = learning. The pillar is trying to cover both the "diagnose" and "learn" stages.
2. **Pillar 2 ("Practise with purpose") is overloaded.** It covers flashcards AND quizzes. Again two features.
3. **Pillar 3 ("Perform with confidence") is the cleanest** — exams + papers + progress tracking all sit together as "the performance stage."

**Recommendation:** Keep three pillars but redistribute:

| Pillar | Heading | Focus |
|--------|---------|-------|
| 1 | **Find your range** | Diagnostics ONLY — "A short test finds your exact weak spots so practice starts in the right place." |
| 2 | **Practise with purpose** | Notes + flashcards + quizzes together — "Illustrated notes explain the concept, flashcards lock it in, quizzes confirm you've got it." |
| 3 | **Perform with confidence** | Exams + papers + progress — "Sit timed mock exams and AI-marked papers, then watch your mastery climb." |

This gives each pillar one clear job: assess → learn+drill → prove. The illustrated notes move from pillar 1 to pillar 2 where they belong (notes are a learning tool, not a diagnostic).

### CTA hierarchy

**Approve the hierarchy, refine the labels.**

- **Primary: "Take a diagnostic"** → `/diagnostics`. Correct priority — diagnostics are the best "try it" hook (low commitment, high value, personalized result). **But** the label could be more benefit-oriented. "Take a diagnostic" is feature-naming. Consider: **"Start with a free diagnostic"** or **"Find my starting point"** — both frame the benefit, not the feature.
- **Secondary: "Browse subjects"** → in-page scroll. Correct as a secondary action. Keep.
- **Add a sub-label under the primary CTA:** `"5 min · no sign-up"` — this directly addresses the two biggest friction points (time + account creation). This is the single highest-leverage copy addition for conversion.

---

## C. Layout & visual hierarchy recommendations

### Where the hero sits

**Hero goes above everything, unconditionally.** The proposal gates the full hero to first-time visitors (no progress) and shows a compact motto for returning users. **I disagree with the gating approach** — here's why:

1. **Gating adds complexity for marginal benefit.** A returning user doesn't need the full hero, true — but they also don't need a *bare motto line*. The right returning-user state is a **compact personalized hero**: motto + a single personalized line ("Welcome back — 3 topics need practice" → link to weak areas). This is better than either the full hero (too much for a returnee) or a bare motto (too little).
2. **The hero should always be visible** because the home page is the natural "reset" point. Even a returning user benefits from seeing the value prop briefly — it reinforces why they're here.

**Concrete structure for `page.tsx`:**

```
[Hero — always shown, content adapts]
  Eyebrow: "KS3 · IGCSE · IB DP" (or "Free secondary-school study companion")
  H1: "Master secondary school — from KS3 to IB." (first-time)
      OR "Welcome back. {personalized line}" (returning)
  Subhead: 20-word version (first-time only)
  CTAs: primary + secondary (first-time)
        single "Continue practising" → scroll to dashboard (returning)

[Why Octav — always shown, 3 pillars]
  H2: "Why Octav"
  3 cards

[Dashboard — existing, unchanged]
  Streak / Needs Practice / Flashcards due

[Subjects grid — existing, unchanged]
```

### First-time vs returning: the right split

| State | Hero shows | Pillars show | Dashboard shows |
|-------|-----------|-------------|-----------------|
| First-time (no progress) | Full hero (eyebrow + h1 + subhead + 2 CTAs) | Yes | "Not sure where to start?" card only |
| Returning (has progress) | Compact hero (eyebrow + "Welcome back, N topics need practice" + single CTA) | Yes — but collapsible or shorter | Streak + Needs Practice + Flashcards due |

### Remove the redundant "Not sure where to start?" card for first-timers

If the hero's primary CTA is "Take a diagnostic" and the hero is always shown, then the "Not sure where to start?" card (`page.tsx:87-100`) is **redundant for first-timers** — it pitches the same diagnostic. Remove it for first-time visitors (the hero handles it). Keep it only as a fallback for returning users who somehow have no weak topics and no due cards (edge case).

### Remove the standalone wordmark block

`page.tsx:21-27` (the `<div className="mb-8">` with the logo `<h1>` and stats line) should be **removed entirely** for first-time visitors. The hero replaces it. For returning visitors, replace it with the compact personalized hero. The stats line ("5 subjects · 137 topics…") can move into the hero subhead or be dropped (it's not a value prop).

### Spacing, font sizes, CTA prominence

- **Hero eyebrow:** `text-sm font-semibold` + accent color. Keep.
- **Hero H1:** `text-3xl md:text-4xl font-bold` — approve. On mobile, `text-3xl` (30px) is the right size for a 375px screen; `text-4xl` (36px) on desktop gives appropriate weight. Consider `text-4xl md:text-5xl` if you want more impact on desktop — but `4xl` is safer for a study app (not a SaaS landing page).
- **Hero subhead:** `text-base text-gray-600` — approve. `max-w-2xl` is right.
- **CTAs:** primary `bg-blue-600 text-white px-5 py-3 rounded-xl` — approve the size (`py-3` = ~44px touch target ✓). **Add `shadow-sm`** (already proposed) and consider `text-sm font-semibold` → `text-base font-semibold` for slightly more prominence on the primary CTA.
- **Pillar cards:** approve the `.card p-4` structure. **Add an `<h2>` "Why Octav" heading above the pillar strip** — the mockup has no section heading, so the pillars appear without context. An `<h2>` gives the section semantic structure and a visual anchor.
- **Pillar icon size:** `w-10 h-10` (40px) — approve. The `rounded-xl bg-{color}-50` treatment is consistent with the subject page cards.

### Mobile-specific concerns

1. **Hero height on mobile.** With the shortened subhead (20 words → ~3 lines on 375px), the hero + CTAs should fit in ~350-400px — leaving the pillar strip partially visible below the fold, which is a good teaser. The current 46-word subhead pushes everything too far down. **Shortening the subhead is the key mobile fix.**
2. **CTA stacking:** `flex-col sm:flex-row` is correct — full-width stacked on mobile, side-by-side from `sm` (640px). Approve.
3. **Bottom nav overlap:** the `pb-24` on `<main>` (`layout.tsx:72`) accounts for the 64px bottom nav. The hero doesn't change this. Good.
4. **Thumb zone for CTAs:** primary CTA at ~y=300-350px on mobile is in the comfortable thumb zone. Good.

### What to REMOVE or REORDER from the current dashboard

| Element | Action | Reason |
|---------|--------|--------|
| Logo `<h1>` block (`page.tsx:21-27`) | **Remove** | Replaced by hero; redundant with desktop header logo |
| Stats line ("5 subjects · 137 topics…") | **Remove or move to footer** | Not a value prop; undersells the product |
| "Not sure where to start?" card (`:87-100`) | **Remove for first-timers** | Redundant with hero CTA; keep as returning-user fallback |
| Streak badge (`:29-37`) | **Keep, move above pillars** | Good for returning users; shows progress immediately |
| Needs Practice card (`:39-64`) | **Keep, unchanged** | Core returning-user value |
| Flashcards due card (`:66-85`) | **Keep, unchanged** | Core returning-user value |
| Subjects grid (`:102-139`) | **Keep, unchanged** | The "Browse subjects" CTA scrolls here |

---

## D. Additional recommendations

### 1. Navigation restructure (highest priority)

This is more urgent than the hero. **Concrete proposal: restructure `nav-items.ts` from 3 items to 5.**

The current 3-item nav (Learn / Review / Progress) was fine when the app was notes+flashcards+quizzes. It's now inadequate with diagnostics, exams, and papers. Two options:

**Option A — Expand to 5 items (recommended for desktop, maybe too many for mobile bottom nav):**

```
Learn (/)  |  Review (/mixed-review)  |  Diagnostics (/diagnostics)  |  Exams (/exams)  |  Progress (/progress)
```

At 5 items, the desktop header is fine (5 short links). The mobile bottom nav at 5 items gets tight (each slot = 75px on 375px screen), but it's doable if labels are short. The theme toggle would move to... somewhere else (see below).

**Option B — Keep 3 primary + add a "More" menu:**

```
Learn (/)  |  Review (/mixed-review)  |  Progress (/progress)  |  More ▾
                                                        └─ Diagnostics
                                                        └─ Mock Exams
                                                        └─ Practice Papers
```

This keeps the bottom nav clean but hides features behind a tap. Worse for discoverability.

**Recommendation: Option A for desktop, Option B for mobile.** Desktop header has room for 5 links. Mobile bottom nav stays at 3 primary + a "More" overflow that surfaces Diagnostics/Exams/Papers. This is the best balance of discoverability (desktop) and thumb-comfort (mobile).

**Theme toggle relocation:** On mobile, the theme toggle currently takes a full bottom-nav slot (25% of the nav). If nav goes to 3+More, the theme toggle should move to: (a) the Progress page (where settings-like things live), or (b) a small icon in the top-right of the first card on the home page. The theme toggle is a settings action, not a navigation destination — it shouldn't take nav real estate.

### 2. Sticky mobile CTA bar (deferred)

After the hero, consider a sticky bottom CTA bar on mobile that replaces the bottom nav when the user scrolls past the hero: "Start with a free diagnostic →" full-width, sticky above the bottom nav. This keeps the primary action always available. **This is a Phase 2 enhancement** — not needed for the initial hero ship, but worth designing the hero so this can be added later without rework.

### 3. Parent-facing copy (deferred)

The proposal mentions parent-facing nudge lines ("See exactly where your child stands…"). This is valuable but **shouldn't live in the hero** — the hero should speak to the student (the primary user). Parents are the secondary audience (they pay/subscribe, students use). With no "For parents" link anywhere, the parent copy is dead text. **Recommendation:** don't try to serve parents in the hero (that dilutes the student pitch). Instead, add a small "For parents" link in the footer → a short page or anchor explaining progress visibility, mastery scores, and "no sign-up." This is genuinely out of scope for the hero round but should be on the roadmap; for now, **remove the unused parent nudge from §3.4** so it isn't half-implemented.

### 4. Accessibility — concrete checks for the proposed design

- **Single `<h1>`:** enforce (see #2). Today the logo is the h1; fix it.
- **Heading order:** `h1` (hero) → `h2` (Why Octav, *missing — add it*) → `h2` (Subjects, `page.tsx:102`) → `h3` (pillar headings, subject names). Add the missing `h2`.
- **Motto as eyebrow:** it's a `<p>` before the `<h1>` (`mockup.html:56`). That's fine semantically (it's not a heading), but give it `aria-hidden` consideration only if it's purely decorative — it's not, it carries meaning, so leave it readable. Fine as-is.
- **Contrast:** motto `text-blue-600` on white (and `blue-400` in dark, `:56`) — both pass AA. Subhead `text-gray-600`/`gray-400` — passes. Good.
- **CTA as link, not button:** the CTAs are `<a>` (`:71`). Since "Take a diagnostic" navigates (to `/diagnostics`), `<a>` is correct. "Browse subjects" is an in-page anchor — also fine as `<a href="#subjects">`. Good.
- **Touch targets:** CTAs at `py-3` ≈ 44px ✓. Bottom-nav links are full-height (`h-full` of `h-16` = 64px) ✓. Pillar cards aren't interactive (no issue).
- **`prefers-reduced-motion`:** the mockup uses a CSS `fadeUp` animation (`:18`); the real site uses `framer-motion` (`page.tsx:4`). Ensure framer-motion entrances respect `useReducedMotion()` — worth verifying since you're adding 3 more animated sections (hero + 3 pillars). Not currently gated in `page.tsx` (`:31`, `:113` use raw `animate`). Flag for a follow-up accessibility pass.
- **Emoji subject icons** (`:150` etc.): decorative-only, but they're in the link text. Screen readers will read "📐 Math." Acceptable, but if you want cleanliness, add `aria-hidden` to the emoji spans.

### 5. Metadata — endorse the fix, extend it

The `description` change (`§3.5`: "Learn and practise for IB exams" → the KS3/IGCSE/DP string) is correct and overdue — `layout.tsx:29` still says "IB exams" post-rebrand. **Also add:** an `openGraph`/`twitter` description and a proper `title` template (`title: { default: 'Octav Learning', template: '%s · Octav Learning' }`) so subject/topic pages get branded titles. The hero copy and metadata should share the same value-proposition language for SEO/preview consistency.

---

## Summary — ship list (ordered by impact)

1. **Fix the nav first** (surface Diagnostics/Exams; reclaim the mobile theme slot). Highest leverage; affects all users.
2. **Add the hero** with a *shortened* subhead and the primary CTA relabeled **"Start with a free diagnostic"** + sub-label "5 min · no sign-up."
3. **Remove the redundant "Not sure where to start?" card** and the **standalone body wordmark block** for first-timers; make the hero headline the sole `<h1>`.
4. **Redistribute pillar content** (move illustrated notes from pillar 1 → pillar 2) and **add an `<h2>` "Why Octav"** heading.
5. **Fix returning-user state:** compact personalized hero (motto + "welcome back, N topics need practice"), not a bare motto line.
6. **Metadata fix** + title template (endorse + extend).
7. **Deferred:** sticky mobile CTA bar, "For parents" footer link, `prefers-reduced-motion` audit — Phase 2.

The proposal is directionally correct and the copy is good. Its main risks are **redundancy** (diagnostic pitched 3×) and **under-specifying the nav and returning-user state** — both fixable without new dependencies, consistent with the proposal's own "reuse existing tokens" constraint.
