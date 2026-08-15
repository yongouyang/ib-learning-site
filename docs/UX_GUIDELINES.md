# UX Guidelines

This document defines the UX standards for Octav Learning's UI. It exists so a standing **UX-review agent pass** (see the last section, and the `AGENTS.md` bullet that mandates it) can check UI-surface changes against written rules instead of taste. Originated from the 2026-08 landing review (`docs/landing-page-ux-review.md`); keep it current as UI decisions are made.

## Scope

- Applies to anything user-visible in `src/app/**` and `src/components/**` — pages, navigation, cards, buttons, forms, toasts.
- Content-level writing (notes, flashcards, questions) follows `docs/CONTENT_STYLE.md`; illustrations follow `docs/ILLUSTRATION_GUIDELINES.md`. This file covers the chrome around them.

## Layout & containers

- Standard page wrapper: `max-w-2xl mx-auto px-4 py-6` (progress, exams, diagnostics, papers, study, quiz).
- Wider only where content justifies it: subject pages `max-w-3xl`, home `max-w-4xl` (widest — home has primacy).
- Pages stack full-width `.card` blocks vertically; grids (subject cards, pillars) are 1-col on mobile, multi-col from `sm:`/`md:`.
- Don't introduce new container widths or page-level background colours.

## Design tokens

Reuse existing tokens; don't invent new ones without adding them here first.

| Token | Value | Use |
|---|---|---|
| Body bg / text | `gray-50` / `gray-900`; dark: `gray-950` / `gray-50` | app shell (set on `body`) |
| `.card` | `bg-white rounded-2xl shadow-sm border border-gray-100`; dark: `bg-gray-900 border-gray-800` | every content block (globals.css) |
| Primary action | `bg-blue-600 text-white`; dark hover/active per surrounding code | primary CTA, active nav (`blue-600`/`blue-400`) |
| Semantic: weak / needs practice | orange tones | dashboard "Needs Practice" |
| Semantic: due / flashcards | green tones | dashboard "flashcards due" |
| Semantic: onboarding / info | blue tones | "Not sure where to start?" |
| Subject accents | hex in `src/content/data/subjects.json` `accentColor` (math `#3B82F6`, english `#7B5EA7`, biology `#22C55E`, chemistry `#F97316`, physics `#EF4444`) | borders, progress bars, dots — via inline `style`, never hardcode per-page |
| Radius | cards `rounded-2xl`; buttons/inputs/chips `rounded-xl` | |
| Type | Geist Sans (`--font-geist-sans`, local font) body; Geist Mono code | headings `font-bold`, eyebrows `text-sm font-semibold` |
| Hero scale (home) | h1 `text-3xl md:text-4xl`; subhead `text-base text-gray-600 dark:text-gray-400`, `max-w-2xl` | approved in the landing review |

- **Dark mode is not optional.** Every colour utility needs its `dark:` pair; both themes must be checked in review (see the UX-review pass below).
- Interactive feedback convention: `hover:shadow-md transition-shadow` + `active:scale-[0.98]` on tappable cards; `transition-colors` on links/buttons.

## Mobile vs desktop chrome

The app deliberately has **asymmetric chrome** — this is a design decision, not a bug:

- **Desktop (`md:` and up):** persistent top header (`layout.tsx`, `hidden md:flex`) with logo (`h-6`, light/dark SVG swap), `HeaderNav` links, and `ThemeToggle`.
- **Mobile (`< md`):** no top header. The only persistent chrome is the fixed bottom nav (`Nav.tsx`, `h-16` + `safe-area-bottom`). `<main>` carries `pb-24 md:pb-0` so content clears it. Since 2026-08 (accounts feature), a small fixed top-right pill (account button + theme toggle, 44px targets, `bg-white dark:bg-gray-900 rounded-xl shadow-sm border`) is the second piece of persistent mobile chrome — pages whose content reaches the top-right corner on mobile must clear it (the login page uses `pt-20`).

Consequences:

- On mobile the page body must carry branding — there is no header wordmark. Don't rely on chrome being visible.
- Nav items are shared by both bars via `src/components/nav-items.ts` — edit that one file, never the two nav components separately.
- Bottom-nav slots are precious. **Navigation slots are for destinations, not settings/actions** — don't add non-destination toggles to the nav. (Current theme-toggle slot is a known violation, slated for removal in the landing ship list.)
- Touch targets: full-height nav slots (64px) and `py-3` CTAs (~44px) are the floor; don't ship smaller.

## Accessibility checklist

Run through this for any UI-surface change:

- [ ] **Exactly one `<h1>` per page**, and it is real text (never a logo image — the logo is branding, not a heading).
- [ ] Heading order is sequential (`h1` → `h2` → `h3`, no skips); every visually distinct section has a heading.
- [ ] Colour contrast meets WCAG AA in **both** themes (body text, muted `gray-500/400` text, accent-coloured text).
- [ ] Touch targets ≥ 44px on interactive elements.
- [ ] Navigation uses `<a>`/`Link`; actions use `<button>`. Don't fake one with the other.
- [ ] Decorative icons/emoji are `aria-hidden` (lucide icons already are; emoji in link text are the known exception).
- [ ] Form inputs have visible focus styles and associated labels/placeholders that survive dark mode.
- [ ] Animations respect reduced motion. We use framer-motion entrances that are **currently not gated** on `useReducedMotion()` — known debt; don't add new ungated animation, and prefer gating when touching animated components.
- [ ] **Progress-gated UI:** `ProgressContext` loads in a `useEffect`, so first paint is always the no-progress state and gated content swaps in after hydration. Any first-time/returning split must handle this without a jarring full-block swap (known constraint from the landing review — decide the handling before building gated heroes/cards).

## Copy voice

- **Audience:** the student (KS3 / IGCSE / IB DP). Parents are secondary — don't dilute student-facing surfaces with parent copy; give parents their own surface (e.g. a footer link) if needed.
- **British spelling** for the UI ("practise" as a verb, "practised", "colour"), matching the curricula.
- **Stage tags are vocabulary:** "KS3 · IGCSE · IB DP" is instantly meaningful to this audience — prefer it over generic phrases like "secondary school subjects" in eyebrows/metadata.
- **Eyebrows/kickers:** one short phrase, 3–5 words max. Never a second headline, never the full three-beat motto.
- **Subheads:** ~20 words, two sentences max. Their job is to get the user to the CTA; feature enumeration belongs in cards/pillars below.
- **CTA labels name the benefit, not the feature:** "Start with a free diagnostic", not "Take a diagnostic". Add a friction-killing sub-label where relevant ("5 min · no sign-up").
- **Say it once.** If the hero pitches the diagnostic, no card below may pitch it again. Redundancy was the landing review's main critique — check for repeated pitches across one viewport.
- **Brand statement:** the motto "Find your range. Practise with purpose. Perform with confidence." lives in section headings or the footer — not as a pre-headline eyebrow.

## The UX-review pass (standing rule)

Mandated by `AGENTS.md` for UI-surface changes. The pattern mirrors `render:illustrations`:

1. Build/run the app and take **Playwright screenshots** of every changed surface in 4 combinations: **mobile (375px) + desktop, light + dark**. Include any state variants (first-time vs returning, empty vs populated).
2. Spawn a **UX-review subagent** (fresh context) that reads the screenshots plus this file and the diff, and reports: violations of these guidelines, a11y-checklist failures, mobile/desktop chrome issues, copy-voice issues.
3. Fix or consciously waive each finding before considering the change done; record waivers in the PROGRESS.md entry.

The screenshots are the artefact — an agent reviews images, like the illustration contact-sheet sweep. Store them under a gitignored path (e.g. `docs/landing-poc/` pattern or a temp dir), not in the repo.

## Anti-patterns

| Bad | Why |
|---|---|
| Logo wrapped in `<h1>` | Screen readers/SEO get "Octav Learning" as the page's only heading — meaningless. |
| Same pitch repeated in hero + card + nav | Reads as clutter; each surface gets one job. |
| Settings/actions in nav slots | Nav is for destinations; a toggle is not a destination. |
| New ad-hoc colours/radii | Breaks the token set and dark-mode pairing. |
| Desktop-only review | Mobile has no header and a bottom nav — a desktop-only pass misses the primary chrome. |
| Light-mode-only review | Every token has a `dark:` pair; unpaired utilities look broken in dark. |
| Progress-gated UI without a hydration plan | First paint is always the no-data state; the swap flickers for returning users. |
| Subheads that enumerate features | That's the cards' job; long subheads push CTAs below the fold on mobile. |
