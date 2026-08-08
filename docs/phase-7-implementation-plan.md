# Phase 7 — PWA: Offline Content & Install Prompt: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 7 ("PWA (offline content, install prompt) — backlog item, fits before any native consideration").
> Goal: the site is installable (manifest + icons + install prompt) and works offline (service worker caching), with graceful degradation of the one network-dependent feature (AI feedback).
> Sized for: **2 focused sessions** (breakdown in §5).
> Depends on: nothing new — the whole site is statically generated today.

---

## 1. Scope

**In:**
- Web app manifest (`app/manifest.ts` — Next metadata route) + icon set (maskable-safe, generated from one authored SVG via a Playwright-screenshot script — Playwright is already a dev dep, no new dependency).
- Hand-rolled service worker (`public/sw.js`, runtime caching, no build-tool integration, no new deps):
  - Cache-first for `/_next/static/**` (content-hashed, immutable).
  - Stale-while-revalidate for HTML pages and `public/images/**`.
  - Network-only passthrough for `/api/**` (AI feedback must never be served stale).
  - `/offline` fallback page for uncached navigations while offline.
- SW registration client component (prod-only — disabled in dev so it never fights `next dev` or Playwright's dev server).
- Install prompt: capture `beforeinstallprompt`, custom "Install app" entry point; iOS Safari fallback instructions (no `beforeinstallprompt` on iOS).
- Update flow: on new SW waiting, show a "New version available — refresh" toast (user-initiated reload, never mid-quiz auto-reload).
- Offline indicator: subtle banner when `navigator.onLine` goes false, so users understand AI marking is unavailable but everything else works.
- Tests (unit + e2e) + docs (AGENTS.md convention entry, PROGRESS.md).
- **Content-protection add-on (§8 items 1–2, resolved with user 2026-07-28):**
  - `src/app/robots.ts` (Next metadata route) — allow normal crawling, explicitly `disallow: '/'` for known AI-training crawlers (`GPTBot`, `ChatGPT-User`, `CCBot`, `Google-Extended`, `ClaudeBot`, `Bytespider`, `Amazonbot`, `anthropic-ai`).
  - Footer: add copyright line (© year IBLearn, all rights reserved) + link to a `/terms` page.
  - `src/app/terms/page.tsx` — short static page: content is original, all rights reserved, no republication or use for AI training; keeps the existing IBO/CAIE non-affiliation disclaimer.
  - E2E coverage for all of the above (see §5 Session 2).

**Out (deliberately):**
- **No accounts/sync/cloud** — explicitly deferred (parent plan: future AWS phase). Progress stays in localStorage (storage v2 `version` field already future-proofed).
- **No full-site precache** — 129 topic pages + papers HTML is too heavy to precache blindly; runtime caching means pages work offline after first visit. Content data itself ships inside the shared JS chunks, so a handful of visits effectively warms the bulk of the app.
- **No push notifications / background sync** — nothing on the site needs them; spaced-repetition "due" surfacing stays in-app.
- **No `@serwist/next` / workbox / next-pwa** — hand-rolled SW is ~100 lines, matches the project's existing hand-rolled preference (donut, rate limiter, feedback provider), and avoids webpack config intrusion. Revisit only if runtime caching proves insufficient.
- **No native wrappers** (Capacitor/TWA) — PWA first per parent plan §9.

---

## 2. Current state (verified at planning time)

- **Zero PWA infrastructure**: no manifest, no icons beyond `app/favicon.ico`, no service worker, no `themeColor`/`appleWebApp` metadata (`src/app/layout.tsx:23-31`).
- **Fully static**: every dynamic route uses `generateStaticParams` (subjects, study/flashcards/quiz, diagnostics, exams, ladder, papers). The only server-dependent piece is `/api/feedback` (GET configured-check + POST marking).
- **Content is bundled**: `src/content/registry.ts` statically imports all topic/paper JSON → content ships in shared JS chunks, cacheable like any other static asset. No runtime content fetching exists.
- **Progress is local**: all progress in localStorage (storage v2) — already fully offline-capable.
- **AI feedback already degrades**: the "Mark with AI" button is hidden when the GET configured-check fails — offline this fails naturally, no new code needed there (verify with a test).
- **Fonts are local** (`next/font/local`) — no Google-Fonts-style third-party runtime dependency to break offline.
- **Deploy**: Vercel, auto on push to `develop`. Vercel serves `public/` with revalidation-friendly headers — safe for `sw.js`; verify the `Cache-Control` header on the deployed `sw.js` as a launch check (must not be long-cached).

---

## 3. Design decisions

### 3.1 Manifest & icons

- `src/app/manifest.ts` → `/manifest.webmanifest`: name "IBLearn", `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `theme_color` / `background_color` from the existing palette (light theme values; dark handled by OS/media), `categories: ["education"]`.
- Icons: author **one** `public/icons/icon.svg` (simple monogram, maskable-safe — important content inside the 80% safe zone). Generate PNGs with `scripts/generate-icons.mjs`: spins up Playwright Chromium (dev dep), screenshots the SVG at 192/512 (any) + 512 (maskable) + 180 (apple-touch) → `public/icons/*.png`. Run manually when the SVG changes; output committed. No new dependency.
- `layout.tsx` metadata gains: `appleWebApp: { capable: true, title: 'IBLearn', statusBarStyle: 'default' }`, `manifest` is auto-linked by `app/manifest.ts`; `viewport` gains `themeColor` (light/dark media pair).

### 3.2 Service worker (`public/sw.js`, hand-rolled)

```
install  → precache ['/', '/offline'] only; skipWaiting NOT called (see 3.4)
activate → delete caches whose name ≠ current CACHE_VERSION; clients.claim()
fetch    → GET only
           /api/**                     → network-only (passthrough)
           /_next/static/**, /icons/** → cache-first (hashed/immutable)
           everything else (HTML, /images/**)
                                        → stale-while-revalidate;
                                           navigation failure with no cache
                                           → cached '/offline'
```

- `CACHE_VERSION` is a plain constant in the checked-in file, bumped manually when the caching *strategy* changes. Per-deploy invalidation is unnecessary: hashed assets never collide, and SWR pages self-heal online. (Upgrade path if ever needed: a `prebuild` script that stamps the build ID — noted, not built.)
- No SW in dev: registration component early-returns when `process.env.NODE_ENV !== 'production'` and `navigator.serviceWorker` is missing.

### 3.3 Registration & offline UX

- `src/components/ServiceWorkerRegistration.tsx` (client, rendered once in root layout): `window.addEventListener('load', …)` → `navigator.serviceWorker.register('/sw.js')`.
- `src/hooks/useOnlineStatus.ts`: `online`/`offline` events → boolean. `OfflineBanner` renders a fixed, dismissible "You're offline — studying works, AI marking doesn't" strip; placed in root layout next to the mobile `Nav` (respect the existing bottom-nav safe area).

### 3.4 Install prompt & update toast

- `src/hooks/useInstallPrompt.ts`: captures `beforeinstallprompt` (preventDefault, stash event), exposes `canInstall` + `prompt()`. Listens for `appinstalled` to hide permanently (also stash a `localStorage` dismissal flag — separate from `progress-store`, own key `iblearn-install-dismissed`).
- Entry point: one quiet "Install IBLearn" button — placement on the **progress page** (the re-visit hub) rather than a homepage nag. iOS Safari (no event): the same spot shows static "Share → Add to Home Screen" instructions instead (detect via `navigator.standalone` + UA, keep it simple).
- Update flow: on `registration.waiting` (or `updatefound` → installed-with-controller), show a toast: "New version ready — Refresh / Later". Clicking Refresh posts `SKIP_WAITING` to the waiting SW and reloads on `controllerchange`. Never auto-reload: a student mid-paper must not lose state. (SW listens for the message and calls `skipWaiting()`.)

### 3.5 AI feedback offline behavior

- No code change: GET configured-check rejects offline → button hidden (existing behavior). The offline banner explains why. Add one e2e assertion locking this in.

---

## 4. Files

**New:**
- `src/app/manifest.ts`
- `src/app/offline/page.tsx` — minimal static fallback ("You're offline — this page wasn't cached yet")
- `public/sw.js`
- `public/icons/icon.svg` + generated `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- `scripts/generate-icons.mjs`
- `src/components/ServiceWorkerRegistration.tsx`, `OfflineBanner.tsx`, `InstallAppButton.tsx`, `UpdateToast.tsx`
- `src/hooks/useOnlineStatus.ts`, `useInstallPrompt.ts`
- `tests/unit/pwa-*.test.tsx` (registration gating, online status, install-prompt capture/dismiss, update-toast flow — SW APIs mocked per convention)
- `tests/e2e/pwa.spec.ts`
- `src/app/robots.ts` (content-protection add-on)
- `src/app/terms/page.tsx` (content-protection add-on)

**Touched:**
- `src/app/layout.tsx` — metadata/viewport additions; render registration + banner + toast once; footer gains copyright line + `/terms` link
- `src/app/progress/page.tsx` (or its client) — install entry point
- `tests/e2e/app.spec.ts` — content-protection cases (§5 Session 2 step 5)
- `AGENTS.md` — convention note (SW is hand-rolled; CACHE_VERSION bump rule; icon regen command)
- `PROGRESS.md` — per session, per workflow

**Explicitly untouched:** `/api/feedback/*`, content pipeline, progress-store.

---

## 5. Session breakdown

**Session 1 — installable + offline core**
1. Manifest + icon SVG + `generate-icons.mjs` + generated PNGs (verify by viewing one PNG after generation).
2. Metadata/viewport updates in `layout.tsx`.
3. `public/sw.js` + `/offline` page + `ServiceWorkerRegistration` + `OfflineBanner`/`useOnlineStatus`.
4. Unit tests for the above (mocked `navigator.serviceWorker`, online/offline events).
5. Gates: `npm test`, `tsc`, content validators, full e2e. PROGRESS entry.

**Session 2 — install UX, updates, e2e, docs**
1. `useInstallPrompt` + `InstallAppButton` (progress page) + iOS instructions variant.
2. Update toast flow (`SKIP_WAITING` message + `controllerchange` reload).
3. `tests/e2e/pwa.spec.ts` (Chromium-only for SW cases; use a **production build** — `E2E_PROD=1` pattern already exists in `test:e2e:sweep`):
   - manifest served & linked; icons 200.
   - SW registers and reaches `activated`.
   - offline reload: visit page → `context.setOffline(true)` → reload → content renders; navigate to never-visited route → `/offline` fallback.
   - offline hides "Mark with AI" button on a paper page.
   - install button hidden without prompt event / shows with dispatched `beforeinstallprompt`.
4. Docs: AGENTS.md convention entry; PROGRESS entry with deploy note (verify `sw.js` cache headers on Vercel after deploy; run Lighthouse PWA audit once live).
5. **Content-protection add-on** (§8 items 1–2):
   - `src/app/robots.ts` — AI-training crawler disallow list per §1.
   - Footer copyright line + `/terms` link in `layout.tsx`; static `/terms` page.
   - E2E (append cases to `tests/e2e/app.spec.ts` — plain HTML/HTTP checks, no prod build needed):
     - `GET /robots.txt` → 200, `text/plain`, contains `Disallow: /` under each of the listed AI crawler user-agents, and normal agents are not disallowed site-wide.
     - Every page footer shows the copyright notice and a working `/terms` link.
     - `/terms` renders (title, all-rights-reserved + no-AI-training wording, IBO/CAIE disclaimer) and is linked from the footer.

---

## 6. Verification & launch checks

- Standard gates per AGENTS.md (validate/audit/illustrations/vitest/e2e).
- After deploy to Vercel: confirm `curl -I …/sw.js` shows no long `max-age`; confirm `manifest.webmanifest` 200s; run one manual install on iOS Safari and one Chromium desktop; Lighthouse PWA category ≥ 90 (acceptable misses: anything requiring push/background sync, which are deliberate non-goals).

## 7. Decisions (resolved with user, 2026-07-27)

1. **Install entry placement**: progress page — quiet button, no homepage card.
2. **Icon design**: plain "IB" monogram on brand blue, maskable-safe; restyle deferred to the later design refresh (parent plan §6).
3. **Prompt style**: passive button only — no pop-up nudges at any visit count.

**Deferred (not blocking):** offline cache ceiling — no cap proposed (hashed assets per deploy are a few MB). If real usage shows bloat, add an LRU trim for the pages cache later.

---

## 8. Open consideration — content scraping (raised 2026-07-28, not a Phase 7 blocker)

User request: think about how to avoid our original content being scraped/copied by others.

**Reality check first (verified in §2):** the entire content corpus is statically bundled into public JS chunks and served as static pages — anyone can already fetch everything with `curl`, no scraping sophistication needed. PWA caching does not make this worse; it just makes the same content available offline to legitimate users. **There is no technical way to make content readable-but-uncopyable on the open web** — do not waste effort on obfuscation (base64, canvas rendering, disabling copy); it hurts UX/accessibility and defeats nothing beyond casual users.

**Realistic measures, in rough cost/benefit order:**
1. **Legal framing (near-zero cost)**: copyright notice in footer + a short `/terms` page stating content is original and not licensed for republication or AI training. Enables takedowns if copies appear. → **Folded into Session 2** (user decision 2026-07-28, see §1/§5).
2. **`robots.txt` policy**: disallow known AI-training crawlers (`GPTBot`, `CCBot`, `Google-Extended`, etc.). Courtesy-level only, but free. → **Folded into Session 2** (user decision 2026-07-28, see §1/§5).
3. **Rate limiting / bot filtering at the edge** (Vercel): only worth it if log evidence of bulk harvesting appears — the site is static, so "scraping" costs attackers almost nothing and blocking them is whack-a-mole.
4. **Provenance/watermarking**: visible branding on illustrations (SVGs already carry our style); consider subtle identifiers in original practice-paper questions so copied sets are provably ours.
5. **Hold back the crown jewels later**: if anything becomes genuinely valuable to protect (e.g. markschemes, AI marking logic), move it behind the future accounts/API phase instead of static bundles — that's the only real protection. Static public content, by definition, is copiable.

**Action**: items 1–2 ship with Session 2 (with e2e coverage). Items 3–5 stay deferred — revisit alongside the future cloud/accounts phase (or sooner if actual copying is observed).
