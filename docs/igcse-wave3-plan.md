# IGCSE Wave 3 — new subjects (0610 Biology, 0620 Chemistry, 0625 Physics, 0500 English)

Status: **DECISIONS LOCKED 2026-09-27 (user-confirmed, §0) — ready to execute, one subject
per wave, starting with 3a Physics.** Follows the shipped pilot (`docs/igcse-pilot-plan.md`)
and wave 2 (`docs/igcse-wave2-plan.md`); every mechanism (hubs, courses, paper gating,
validator hardening, count-churn checklist) is inherited. Part of
`docs/content-gap-roadmap.md` gap 1.

Syllabus mapping was researched 2026-09-27 against the official Cambridge 2026–2028
documents (0625 verified against the PDF itself; 0610/0620 against a structured secondary
transcription, PDF cross-check required at authoring; 0500 keyed to **2027–2029** — there is
no 0500 "2026–2028", the window corrected during research).

---

## 0. Decisions (LOCKED 2026-09-27, user-confirmed)

| # | Decision | Value |
|---|----------|-------|
| 1 | Scope | **All four subjects, sequenced one per wave (3a→3d)** |
| 2 | Order | **3a Physics 0625 → 3b Chemistry 0620 → 3c Biology 0610 → 3d English 0500** |
| 3 | Topics per subject | **14 / 14 / 14 / 10 = 52 topics** |
| 4 | Paper sets | **2 per new course (set 1 free, set 2 premium)** — 8 sets total |
| 5 | Level tagging | **omit `level` on Core topics; `level: "extended"` only on purely-Supplement topics** (math precedent) |
| 6 | KS3 overlap policy | **Re-author with exam framing; never duplicate** |

## 1. Verified facts (research 2026-09-27 — do not re-derive)

- **Course plumbing**: new `COURSES` entries in `src/lib/courses.ts` (matcher pattern:
  `subjectId === '<subject>' && stage === 'igcse' && course === '<code>'`), then topics flow
  into diagnostics/exams/ladder/mocks automatically. No route/schema/sitemap/hub changes —
  `/igcse/[subjectId]` exists (verify it picks up the new subjects at integration).
- **0625 (Physics)**: official 2026–2028 PDF verified; syllabus v1 (Sept 2023) has **no
  content changes for 2026–2028**. Six areas; Core → C–G, Extended → A\*–G. Transformers are
  **Core** since 2023 (legacy sites still say Extended). Momentum + a.c. generator print under
  a merged "Core Supplement" header — read as Supplement, **verify visually before tagging**.
- **0620 (Chemistry)**: 12 syllabus topics / 252 objectives; 2026–2028 reorganised the old
  numbering (don't mix schemes). Core/Supplement badges came from a secondary transcription —
  **cross-check every badge against the official PDF before tagging `level`**.
- **0610 (Biology)**: 21 sections / ~360 objectives (~235 Core / ~125 Supplement) — 14 topics
  is a first wave, not full coverage; deferred areas listed in §4. One cross-stage
  prerequisite flag (topic 14 relies on KS3 `bio-health-1`) — resolved in §3 by swapping in a
  circulation Extended topic; see the topic table.
- **0500 (English)**: windows are **2024–2026 and 2027–2029** (the "2026–2028 PDF" in search
  results is 0472, a different qualification). Author to **2027–2029**: P1 = four questions
  (20/20/20/20 shape with summary ≤120 words and a 200–250-word language analysis), P2 §A
  gains a new 5-mark source-analysis part. MCs carry method/judgement; writing skills live in
  the free-response sets, which are **skill drills with point-based markschemes, never
  advertised as mock replicas** (real 0500 writing is levels-marked). `englishStrandSchema`
  values fit; the "KS3 English only" comment extends to igcse.
- **Count churn**: the full measured list is AGENTS.md's content-count bullet +
  `igcse-wave2-plan.md` §7 — compute at integration time, never trust memory. New: FOUR new
  courses move the diagnostics/exams course counts (15 → 19 across the whole wave; +1 per
  subject wave), and each subject's `EXPECTED_TOPIC_COUNTS` entry.

## 2. What changes per subject wave / what does NOT

**Changes (per wave):** ~14 topic JSONs in the subject dir (or 10 for English);
`order.json` grows a new igcse block; one `courses.ts` entry; `exams.ts` paper titles/targets
if the course needs them (the DP AA precedent did); 2 paper sets in
`src/content/data/papers/<courseId>/`; registry regeneration; the count-churn sites.

**No changes:** routes, schema (except the strand comment for English), sitemap generator,
hubs code, curriculum.ts, entitlements, robots. Illustrations: each topic gets its ≥1 figure
in the same wave (the 2026-09-19 standard), figures authored with the topics.

## 3. Content spec — the four subject topic lists

Standard per topic (unchanged): **7 notes / 12 flashcards / 15 questions**, difficulty tags
rotated `correctIndex`, currency per CONTENT_STYLE.md, no control characters, syllabus-PDF
verification duty on the authoring agent (report Core/Supplement ambiguity to the parent
instead of guessing).

### 3a. Physics 0625 — `phys-igcse` (14 topics; order.json appends after the 14 KS3 ids)

| # | id | level | scope (one-line) |
|---|----|-------|------------------|
| 1 | `phys-igcse-motion` | — | measurement; v = s/t; distance/speed–time graphs incl. area; g ≈ 9.8; Supp: scalars/vectors, a = Δv/Δt, terminal velocity |
| 2 | `phys-igcse-forces` | — | W = mg; ρ = m/V + density practical; floating; resultants; Newton I; friction; load–extension |
| 3 | `phys-igcse-moments-pressure` | — | moments + equilibrium; centre of gravity/stability; p = F/A; Supp: Δp = ρgΔh |
| 4 | `phys-igcse-dynamics-momentum` | **extended** | k = F/x; F = ma; circular motion qualitative; p = mv; impulse; conservation 1D |
| 5 | `phys-igcse-energy-work-power` | — | W = Fd; P = W/t; resources (one recap note); Supp: Ek = ½mv², ΔEp = mgΔh, efficiency equations |
| 6 | `phys-igcse-thermal-particle-model` | — | particle model; Brownian; Kelvin; gas pressure qualitative; Supp: pV = constant + graph |
| 7 | `phys-igcse-thermal-properties` | — | expansion; internal energy; transfer experiments; Supp: SHC c = ΔE/mΔθ, mechanisms, Earth's balance |
| 8 | `phys-igcse-waves-sound` | — | v = fλ; transverse/longitudinal; ripple tank; sound 20 Hz–20 kHz, echoes; Supp: diffraction detail, ultrasound |
| 9 | `phys-igcse-light` | — | reflection/mirrors; refraction experiments; critical angle + TIR; lenses; dispersion; EM uses/hazards; Supp: n = sin i/sin r, fibres, c |
| 10 | `phys-igcse-electrical-quantities` | — | electrostatics; e.m.f. vs p.d.; R = V/I + practical; P = IV; E = IVt; kWh costing; Supp: I = Q/t, I–V characteristics |
| 11 | `phys-igcse-circuits` | — | symbols; series/parallel rules; mains safety incl. fuses/double insulation; Supp: parallel-resistance formula, potential dividers |
| 12 | `phys-igcse-electromagnetism` | — | fields; motor effect; induction; transformers (Core!); high-voltage transmission; Supp: Fleming's rules, split-ring, a.c. generator, IpVp = IsVs, P = I²R |
| 13 | `phys-igcse-nuclear` | — | nuclide notation; isotopes; background + count rate; α/β/γ; half-life; safety; Supp: scattering, decay equations, corrected count rate, fission/fusion equations |
| 14 | `phys-igcse-space` | — | day/night/seasons; Solar System + accretion; planetary g; light-travel time; Supp: v = 2πr/T, light-year, CMBR, redshift, H₀ = v/d |

Papers: set 1 Core-weighted (motion graph, energy, circuits, thermal, light); set 2
Extended-weighted (dynamics/momentum, moments/pressure, electromagnetism, nuclear, space).
Overlap guards: hydraulics/Archimedes/gears/dark matter are NOT in 0625 — do not teach; the
KS3 corpus covers them (`phys-pressure-1`, `phys-simple-machines-1`) and they must not leak
in. KS3-taught-but-IGCSE-Supplement items (momentum, F = ma, transformers' equations,
Boyle's) are re-authored with exam definitions — IGCSE ≠ strictly harder.

### 3b. Chemistry 0620 — `chem-igcse` (14 topics)

| # | id | level | scope (one-line) |
|---|----|-------|------------------|
| 1 | `chem-igcse-atomic-structure` | — | electronic configurations of atoms AND ions 1–20; group/period deduction; isotope notation |
| 2 | `chem-igcse-bonding` | — | ionic + covalent bonding, dot-and-cross exam technique, property-from-structure; diamond/graphite |
| 3 | `chem-igcse-bonding-extended` | **extended** | giant ionic lattice; extended molecule set; intermolecular forces; SiO₂; metallic bonding |
| 4 | `chem-igcse-mole-calculations` | **extended** | Aᵣ/Mᵣ; empirical formulae; ionic equations; the mole; 24 dm³; limiting reactants; titration; % yield/purity |
| 5 | `chem-igcse-electrolysis` | — | molten PbBr₂ / conc NaCl / dilute H₂SO₄ products; prediction; electroplating; fuel-cell basics |
| 6 | `chem-igcse-redox` | **extended** | electron transfer + oxidation numbers; agents; KMnO₄/KI colours; electrode half-equations |
| 7 | `chem-igcse-energetics` | **extended** | ΔH sign; pathway diagrams; activation energy; bond-energy ΔH calculations |
| 8 | `chem-igcse-rates` | — | factors + catalysts; practical methods; rate graphs; reversible ⇌ (CuSO₄/CoCl₂ hydration) |
| 9 | `chem-igcse-equilibrium` | **extended** | closed-system shifts; Haber + Contact conditions justified by rate/equilibrium/economics |
| 10 | `chem-igcse-acids-bases-salts` | — | reactions + indicators; pH; neutralisation ionic equation; soluble-salt prep; solubility rules |
| 11 | `chem-igcse-metals` | — | reactivity series K→Au; rusting + barriers; extraction vs reactivity; blast furnace; Al electrolysis |
| 12 | `chem-igcse-environment` | — | water tests/treatment; NPK fertilisers; air pollutants + mitigation (climate only cross-linked) |
| 13 | `chem-igcse-organic-fuels` | — | displayed/general formulae; homologous series; fractional distillation; alkanes; alkenes + cracking + bromine test |
| 14 | `chem-igcse-organic-reactions-polymers` | **extended** | isomers; naming to C4; substitution/addition; alcohols; carboxylic acids + esterification; polymers incl. condensation |

**Flag:** topic 14 is ~25 objectives — likely splits into `…-organic-reactions` +
`…-polymers` at authoring time (poly(ethene) + disposal are Core, condensation is Supp — the
split reopens the level-tag question; resolve then, not by tagging a mixed topic).
Papers: set 1 Core-leaning (electrolysis, rates practical, salts, metals, environment);
set 2 Extended-leaning (mole/titration, energetics, equilibrium, redox, organic).

### 3c. Biology 0610 — `bio-igcse` (14 topics)

| # | id | level | scope (one-line) |
|---|----|-------|------------------|
| 1 | `bio-igcse-classification` | — | MRS GREN; species concept; binomial; dichotomous key CONSTRUCTION; vertebrate/arthropod classes |
| 2 | `bio-igcse-cells` | — | plant/animal/**bacterial** ultrastructure; specialised cells; hierarchy; magnification calcs (incl. the mm↔µm Supp objective — documented waiver, one calculation skill does not justify a split) |
| 3 | `bio-igcse-diffusion-osmosis` | — | diffusion factors; osmosis + turgor; practicals; active transport intro |
| 4 | `bio-igcse-molecules-enzymes` | — | polymer construction; food tests + DCPIP; active-site model; temperature/pH experiments |
| 5 | `bio-igcse-photosynthesis` | — | practicals-led (controls, destarching, indicators); leaf anatomy + adaptations |
| 6 | `bio-igcse-human-nutrition` | — | alimentary canal; physical vs chemical digestion; amylase/protease/lipase sites/products |
| 7 | `bio-igcse-plant-transport` | — | xylem/phloem in sections; water pathway; transpiration + potometer |
| 8 | `bio-igcse-plant-physiology-extended` | **extended** | water potential; plasmolysis; transpiration pull/cohesion; translocation source→sink; limiting factors explained; auxin/tropisms |
| 9 | `bio-igcse-heart-circulation` | — | heart anatomy; ECG/pulse/valve sounds; CHD; vessels; blood components |
| 10 | `bio-igcse-coordination` | — | CNS/PNS; reflex arc; synapse definition; eye + pupil reflex; hormones overview |
| 11 | `bio-igcse-homeostasis-extended` | **extended** | synapse events; accommodation; negative feedback; blood glucose; Type 1 diabetes; thermoregulation |
| 12 | `bio-igcse-inheritance` | — | practice-led: monohybrid crosses, Punnett, pedigrees; variation; natural selection; selective breeding |
| 13 | `bio-igcse-genetics-extended` | **extended** | DNA structure; protein synthesis; gene expression; mitosis vs meiosis; stem cells |
| 14 | `bio-igcse-circulation-extended` | **extended** | §9 Supplement: double circulation, valve mechanics, vessel-wall structure–function, lymphocyte/phagocyte detail |

**Resolved at planning:** the researcher's original topic 14 (`bio-igcse-immunity-extended`)
had its Core prerequisite (§10 pathogens) living in KS3 `bio-health-1` — a cross-stage
prerequisite an IGCSE-course student would never see. Swapped for
`bio-igcse-circulation-extended`, whose prerequisite (topic 9) is in-wave; immunity moves to
the wave-2 list alongside a §10 Core topic.
Papers: set 1 Core (cells/magnification, enzyme practical, photosynthesis practical,
digestion, monohybrid cross); set 2 Extended (water potential, transpiration/translocation,
blood glucose, mitosis/meiosis, circulation).

### 3d. English 0500 — `eng-igcse` (10 topics; strand field reused: reading first, P1 question order, then writing)

| # | id | strand | scope (one-line) |
|---|----|--------|------------------|
| 1 | `eng-igcse-0500-overview` | reading | paper shapes/timings; R1–R5 / W1–W5; word limits; command words; 2027–2029 vs 2024–2026 + 0500 vs 0990 vs 0510/0511 disambiguation |
| 2 | `eng-igcse-p1-comprehension` | reading | explicit/implicit meaning; evidence selection; per-mark pacing |
| 3 | `eng-igcse-p1-summary` | writing | selective summary ≤120 words; own-words paraphrase; the 2(b) attitude question |
| 4 | `eng-igcse-p1-language-analysis` | reading | R4 method word→connotation→effect→purpose; the 200–250-word response shape |
| 5 | `eng-igcse-p1-extended-response` | writing | bullet-mining; role/voice; text-type conventions; the 10R+10W split |
| 6 | `eng-igcse-directed-writing` | writing | source evaluation (new Q1(a)); develop/challenge without copying; discursive vs persuasive register |
| 7 | `eng-igcse-descriptive-composition` | writing | 350–450-word timed descriptive piece; structure (zoom/pan/shift); avoiding narrative drift |
| 8 | `eng-igcse-narrative-composition` | writing | 40-minute plot shape; late openings; dialogue control; endings |
| 9 | `eng-igcse-audience-register-form` | writing | register control across the full 0500 text-type list (W4) |
| 10 | `eng-igcse-accuracy-style` | writing | W5 error triage; sentence variety (W3); proofreading protocol for timed scripts |

Papers: positioned as **skill drills** (point-based markschemes; copy must not call them
mock papers). Set 1 Paper-1-flavoured (original ~200-word passage; comprehension, summary,
language analysis, attitude); set 2 Paper-2-flavoured (original opinion stimulus; evaluate,
argumentative paragraph, descriptive opening, narrative hook). All passages ORIGINAL —
Cambridge past-paper text is copyrighted. MC ceiling is explicit in the copy: quizzes train
judgement ("which response is stronger, why"); writing improves through the free-response
sets + AI marking.

## 4. Deferred to subject wave 2s (recorded so they are not re-researched)

- **Physics**: sets 3–4 would rebalance toward waves/thermal-gases/measurement (sets 1–2
  cover 12 of 14 topics).
- **Chemistry**: T1 states-of-matter tail (4 Supp objectives — absorb or extend
  `chem-states-1`); `chem-igcse-periodic-table`; `chem-igcse-chemical-analysis`; acids/metals
  Extended tails; possibly `chem-igcse-formulae-equations` (Core).
- **Biology**: §11–13 gas exchange/respiration/excretion; §16 reproduction; §19–20 ecology;
  §10 Core + §15 disease/drugs (+ the deferred immunity Extended topic); §21 biotechnology;
  inheritance Supp (codominance, ABO, sex linkage). Wave-2 rule: per area, verify the IGCSE
  treatment is genuinely deeper than the KS3 topic before authoring.
- **English**: speaking & listening (Component 4) is out of scope permanently; coursework
  route is served but not guided.

## 5. Phases (per subject wave — the wave-2 mechanics, restated once)

**Phase 0 — syllabus badge verification (parent, per wave).** For 3b/3c: cross-check every
Core/Supplement badge against the official PDF before any `level` tag is written. 3a is
already PDF-verified; 3d has no badges. Any new defect class surfaced gets a validator rule
first (the wave-2 Phase-0 precedent).

**Phase A — swarm authoring.** Children own ONLY their topic JSONs (no shared files). Prompt
carries: CONTENT_STYLE, the §3 row set, overlap guards, the pilot defect-guard checklist
(seeded choice shuffle, no all-zero `correctIndex`, JSON-escape discipline, fullwidth ＄
outside math), and the syllabus-PDF verification duty. Use the session model — the pilot's
low-tier children produced structurally-perfect defect-laden files. ~3–4 children per wave,
paired pedagogically.

**Phase B — integration (parent).** Review against §3; hand-recompute every numeric key;
`order.json` block; `courses.ts` entry; the 2 paper sets (original passages/questions);
`generate:registry`; count churn (AGENTS.md list + wave-2 §7: registry counts,
content-handler `topicCount`, validate-content M/A/B tallies, exams/papers/diagnostics e2e
counts, topic-journeys sweep cap).

**Phase C — gates.** `validate:content` → `audit:content` (0) → `validate:illustrations` +
layout (each topic's figure) → `npm test` → `tsc` → eslint → e2e per-project `--workers=1` →
`build:static` (leak gate + `verify:sitemaps` — new indexable leaves = +2 per topic:
study page; quiz/flashcards are noindex) → `audit:overflow`.

**UX pass:** content-JSON-only waves inherit the wave-2 waiver (no chrome changes); record
the waiver + 4 spot screenshots per wave.

**Phase D — ship.** One commit per wave on develop → CI → dev `verify:seo:live --env=dev`
spot-check → promote develop→main → prod `verify:seo:live --all`.

## 6. Risks / known traps (wave-1/2 lessons carried forward)

1. **Badge provenance**: 0610/0620 Core/Supplement splits came from a secondary
   transcription — Phase 0 exists because a wrong `level` tag is the dishonest-tag defect
   class the convention guards against.
2. **0500 window**: authoring to 2024–2026 would ship obsolete paper shapes within a year;
   the overview topic states the covered window explicitly.
3. **Cross-stage prerequisites** (the bio-immunity catch): every IGCSE topic's prerequisites
   must be in-wave or explicitly named as KS3 references in its notes — check per topic at
   review.
4. **Overlap discipline**: the KS3 science layer is deep (it already teaches some IGCSE
   Supplement content) — IGCSE topics re-frame for the exam rather than re-teach; a topic
   that can't name its *new* content doesn't get authored.
5. **Leak gate both directions**: new paper-set markschemes must not reuse free-corpus
   explanation phrasing verbatim (the 2026-09-24 circle-theorems collision).
6. **Swarm quota**: the 2026-09-26 five-agent launch hit the 5-hour quota — plan wave
   launches around it; resuming with the original prompt works after reset.
7. **e2e topology**: per-project `--workers=1` runs only.

## 7. Verification evidence to record in PROGRESS.md (per wave)

Phase-0 badge-verification result; gate outputs verbatim (topic counts, indexable count
delta, unit/e2e counts); UX waiver + spot shots; dev + prod `verify:seo:live` results; swarm
model used and defect count found; per-topic syllabus-verification confirmations.
