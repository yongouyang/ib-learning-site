# Landing Page Copy Proposal — Octav Learning

> **Status:** Draft for review (2026-08-11). Not yet implemented.
> **Context:** Rebrand from IB Learn → Octav Learning (2026-08-10). The landing page currently has no value-proposition copy — only a wordmark, a stats line, and a subjects grid. This proposal adds a hero section and a "Why Octav" three-pillar strip, with copy that leans into the Octav/octave brand identity.

---

## Quick links

| What | Path |
|------|------|
| **This analysis** | `docs/landing-page-copy-proposal.md` |
| **Interactive mockup (HTML)** | [`docs/landing-poc/mockup.html`](landing-poc/mockup.html) — open in a browser |
| **Screenshot contact sheet** | [`docs/landing-poc/contact-sheet.html`](landing-poc/contact-sheet.html) — all viewports on one page |
| iPhone full-page | `docs/landing-poc/iphone-full.png` |
| iPhone above-the-fold | `docs/landing-poc/iphone.png` |
| iPad full-page | `docs/landing-poc/ipad-full.png` |
| iPad above-the-fold | `docs/landing-poc/ipad.png` |
| Desktop full-page (light) | `docs/landing-poc/desktop-full.png` |
| Desktop above-the-fold (light) | `docs/landing-poc/desktop.png` |
| Desktop full-page (dark mode) | `docs/landing-poc/desktop-dark-full.png` |

> The `docs/landing-poc/` directory is gitignored (POC artifacts). The mockup is a standalone HTML file using the Tailwind CDN — it replicates the real site's design tokens (`.card` class, subject accent colors, header/bottom-nav structure) but is not wired to the actual app.

---

## 1. Current state analysis

### 1.1 Landing page (`src/app/page.tsx`)

Today the home page is a **functional dashboard**, not a landing page that sells the product. Its structure:

1. **Wordmark** — the Octav Learning logo inside an `<h1>` (no tagline).
2. **One dry stats line** — `"5 subjects · 137 topics · Study notes, flashcards & quizzes"` (grey, small text).
3. **Streak badge** — only if the returning user has a streak.
4. **Conditional "returning-user" cards** — "Needs Practice", "X flashcards due", "Not sure where to start?" → diagnostics. These only appear once there's progress data.
5. **Subjects grid** — 5 tiles (emoji + name + topic count + star rating).

**Problem:** There is zero value-proposition copy. No headline, no subhead, no explanation of what Octav Learning is or why a parent or student should try it. A first-time visitor lands on a bare wordmark and a subjects grid with no framing.

### 1.2 Site navigation

- **Desktop header** (`src/components/HeaderNav.tsx`): logo + 3 links — *Learn* (`/`), *Review* (`/mixed-review`), *Progress* (`/progress`) + theme toggle.
- **Mobile bottom bar** (`src/components/Nav.tsx`): same 3 links + theme toggle.
- **Three major features are NOT in the top nav** and are only discoverable via the landing page's conditional card, the Progress page, or breadcrumbs:
  - `/diagnostics` — short tests that surface weak areas
  - `/exams` — timed mock exams + a 5-level revision ladder
  - `/papers` — free-response practice sets with AI marking

### 1.3 Content scope (the real product surface)

| | |
|---|---|
| **Subjects** | Math (74 topics), English (25), Biology (13), Chemistry (12), Physics (13) = **137 topics** |
| **Stages** | KS3 (Year 7–9) → IGCSE → IB DP |
| **Per topic** | Illustrated study notes (7 concept notes) + 12 spaced-repetition flashcards + 15 quiz questions |
| **Cross-topic** | Diagnostic tests, timed mock exams, free-response papers with AI marking ("Mark with AI"), mixed review (weak/random) |
| **PWA** | Installable, works offline, phone-first design |
| **Progress tracking** | Stars, day streaks, per-topic mastery bars, flashcard seen/known donuts |
| **Practice papers** | 8 free-response sets across courses |

### 1.4 Gaps identified

1. **No pitch.** A brand-new visitor (the rebrand is meant to attract new users!) sees no reason to stay.
2. **Stale metadata.** `src/app/layout.tsx:29` says `"Learn and practise for IB exams"` — but the product now covers KS3 + IGCSE + IB DP, not just IB.
3. **Diagnostics / Exams / Papers are buried.** First-time visitors never see the strongest "try me" hooks (diagnostic test, AI-marked papers).

---

## 2. Brand identity — the octave metaphor

The name **Octav** is a gift for copy. "Octave" means a complete span of notes, and music is the universal metaphor for *practice → mastery → performance*. The copy uses this lightly (not a constant pun-fest) so the brand name feels intentional.

| Music metaphor | Octav Learning meaning |
|---|---|
| An **octave** = a complete range of notes | The complete secondary range: KS3 → IGCSE → IB DP |
| Learn **note by note** | Every topic broken into clear, illustrated steps |
| Daily **practice** builds muscle memory | Spaced-repetition flashcards → long-term retention |
| **Rehearse** before the show | Diagnostics + timed mock exams before the real thing |
| The **performance** = exam day | Sit the paper with confidence, see mastery climb |

---

## 3. Proposed copy

### 3.1 Motto / tagline (hero, accent-colored)

> **Find your range. Practise with purpose. Perform with confidence.**

Selected from four options (see decision log below). This three-beat motto maps directly onto the three pillars of the "Why Octav" section.

### 3.2 Hero section

Shown to first-time visitors (no topic progress yet); returning users see a compact one-line motto + the dashboard as today.

- **Headline (h1):** Master secondary school — from KS3 to IB.
- **Subhead:** Octav Learning brings illustrated study notes, smart flashcards, and real exam practice together in one place — so every student can find their range across Math, English, Biology, Chemistry and Physics. Free to try, on any device.
- **Primary CTA:** `Take a diagnostic` → `/diagnostics`
- **Secondary CTA:** `Browse subjects` → scroll to subjects grid

### 3.3 "Why Octav" — three-pillar card strip

| Pillar | Heading | Paragraph |
|--------|---------|-----------|
| 1 | **Find your range** | A short diagnostic pinpoints exactly what you know and what's still shaky — so practice starts in the right key, not from scratch. Crystal-clear illustrated notes break every topic into notes you can actually follow. |
| 2 | **Practise with purpose** | Spaced-repetition flashcards resurface just the cards you're about to forget, turning a quick daily glance into long-term memory. Targeted quizzes drill your weak spots until they're not. |
| 3 | **Perform with confidence** | Sit a timed mock exam or an AI-marked free-response paper, then watch your mastery climb. Clear progress bars, streaks, and scores show exactly how far you've come — and what to rehearse next. |

### 3.4 "Try it" nudge lines (contextual)

- **For students:** *"Not sure where to start? Take a 5-minute diagnostic and we'll hand you a personalised practice list — free, no sign-up."*
- **For parents:** *"See exactly where your child stands and what to practise next — clear progress bars, streaks, and mastery scores, all in one dashboard."*

### 3.5 Metadata fix

`src/app/layout.tsx:29` — change:

```
description: 'Learn and practise for IB exams',
```

to:

```
description: 'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for KS3, IGCSE and IB DP — across Math, English and the Sciences.',
```

---

## 4. Mockup screenshots

The mockup was rendered with Playwright at three viewport sizes. Below is what each shows.

### 4.1 iPhone (375×812)

- Bottom nav bar visible (Learn / Review / Progress / Theme).
- Hero headline wraps to two lines.
- CTA buttons stack vertically (full-width).
- "Why Octav" pillars stack single-column.
- Subjects grid in 2 columns.
- Full-page screenshot shows the entire scroll: hero → pillars → dashboard → subjects → footer.

### 4.2 iPad (820×1180)

- Desktop header appears (≥768px breakpoint): logo + nav links + theme toggle.
- CTA buttons sit side-by-side.
- "Why Octav" in 3-column layout.
- Subjects grid in 3 columns.

### 4.3 Desktop (1440×900)

- Full header with nav + theme toggle.
- Everything in 3-column layout.
- `max-w-4xl` container centers content with generous whitespace.
- Also captured in **dark mode** — motto in blue accent, card backgrounds go dark (`#111827`), text inverts.

---

## 5. Implementation plan

When the copy is approved, the changes are:

1. **Edit `src/app/page.tsx`** — add a `Hero` block + `WhyOctav` three-card strip above the existing dashboard content, using the copy above. Gate the full hero to first-time visitors (no topic progress yet); returning users see a compact one-line motto + the dashboard as today.
2. **Edit `src/app/layout.tsx`** — update the metadata description (stale "IB exams" → KS3/IGCSE/DP).
3. **Reuse existing design tokens** — `.card` class, Tailwind accent colors per subject, `framer-motion` entrance animations already in use, `lucide-react` icons. No new dependencies.
4. **Verify** — `npm run lint`, `npm test`, `npm run build`, then eyeball light/dark in the dev server.

### Files that would change

| File | Change |
|------|--------|
| `src/app/page.tsx` | Add hero + WhyOctav sections above existing content; conditional display for first-time vs returning users |
| `src/app/layout.tsx` | Update `metadata.description` from "Learn and practise for IB exams" to the KS3/IGCSE/DP description |

### Files NOT changed

- Navigation (`HeaderNav.tsx`, `Nav.tsx`, `nav-items.ts`) — no changes proposed in this round. (Future consideration: add Diagnostics/Exams/Papers to nav.)
- Any content files, registry, or terraform.

---

## 6. Decision log

### Motto selection

Four options were considered:

| # | Motto | Verdict |
|---|-------|---------|
| A | "Learn smarter. Practise with purpose. Track every step." | Non-brand-specific; rejected |
| B | "Find your range. Practise with purpose. Perform with confidence." | **Selected** — three-beat octave metaphor maps to three pillars |
| C | "One octave. The whole secondary journey." | Shortest, most brand-forward; considered as alternative |
| D | "From first lesson to final exam — one calm place to learn, practise, and master." | Parent-facing, reassuring; considered as alternative |

**Decision:** Option B — the three beats (range → practise → perform) map directly onto the three product pillars (diagnostics → flashcards/quizzes → exams), making the motto both a brand statement and a product roadmap in miniature.

---

## 7. Reviewer checklist

If reviewing this proposal in another session, check:

- [ ] Does the motto feel natural, not forced? (Is the octave metaphor too subtle / too heavy?)
- [ ] Is the hero headline clear to someone who has never heard of Octav Learning?
- [ ] Does the subhead accurately describe the product? (KS3 → IGCSE → IB DP, 5 subjects, notes/flashcards/exams, free, any device)
- [ ] Are the three pillars distinct and non-overlapping?
- [ ] Is the CTA hierarchy right? (Diagnostic first, browse subjects second)
- [ ] Should Diagnostics / Exams / Papers be added to the top nav? (Out of scope for this proposal, but related.)
- [ ] Is the metadata description accurate and SEO-appropriate?
- [ ] Review the screenshots: does the layout work at all three breakpoints?
