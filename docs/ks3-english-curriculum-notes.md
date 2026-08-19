# KS3 English — curriculum alignment & enrichment plan

Source: an external Year 7–9 English curriculum reference (confidential school
document — never name it in the repo). Reviewed 2026-08-19 against our 25
KS3 English topics. Our KS3 English stays strand-grouped on the subject page
(reading / writing / grammar-vocabulary / spoken-english); the reference is
year-structured, so this doc maps our topics onto its year sequence instead of
re-tagging (a `year` tag moves a topic out of its strand group — see
`src/lib/topic-groups.ts`).

## Reference course shape

- Combined Language + Literature course across prose, poetry, drama,
  non-fiction and media; feeds IGCSE First Language English + Literature in
  Y10–11. Learning objectives follow the Cambridge Lower Secondary framework
  (matches our strand model).
- Wide-reading culture: graded reading-record awards in Y7/Y8, guided reading
  in Y9 — i.e. volume and variety of independent reading is an explicit goal.
- Recurring spine every year: **novel study, short stories, poetry, drama,
  writing in several forms, individual presentations**. Shakespeare every year
  (comedy/early tragedy in Y7–8, later plays in Y9); modern/post-1900 drama in
  Y7–9 alongside it.
- Assessment is formative and criterion-based (language accuracy, technical
  control, relevance/development of content, roughly an A–E ladder); drafting
  and re-drafting is routine homework.

## Gap analysis: reference unit → our coverage

| Reference element | Our coverage | Verdict |
|---|---|---|
| Novel study (every year) | `eng-novel-study-1` | ✓ covered |
| Poetry: forms & study (every year) | `eng-poetry-1`, `eng-poetry-2`, `eng-poetry-writing-1` | ✓ covered |
| Shakespeare (every year) | `eng-drama-shakespeare` | ✓ covered (single topic; could note year-typical plays) |
| Narrative & creative writing | `eng-narrative-1`, `eng-creative-1`, `eng-creative-2` | ✓ covered |
| Analytical writing / response to a text | `eng-essay-1`, `eng-essay-2`, `eng-critical-reading-1` | ✓ covered |
| Non-fiction reading & writing | `eng-nonfiction-1`, `eng-nonfiction-writing-1` | ✓ covered |
| Media texts | `eng-media-visual-literacy` | ✓ covered |
| Speeches & presentations | `eng-speaking-1`, `eng-persuasive-speaking-1` | ✓ covered |
| Grammar / punctuation / spelling | `eng-grammar-1/2`, `eng-punctuation-1`, `eng-spelling-1` | ✓ covered (not a named unit in the reference; framework-implied) |
| **Short story study** (all three years, incl. Y9 "interspersed throughout") | only generic narrative technique | **GAP** |
| **Identity poetry response ("Where I'm From"-style) + autobiographical writing** (Y7) | — | **GAP** |
| **Modern / post-1900 drama** (Y7 modern drama; Y8 post-1900; Y9 war drama) | — (Shakespeare only) | **GAP** |
| **Graphic novel study** (Y7) | partial in `eng-media-visual-literacy` | **GAP** (thin) |
| **Descriptive writing** (Y9 narrative/descriptive task) | partial in creative topics | **GAP** (thin) |
| **Letter writing & interview** (Y9) | — | **GAP** |
| **Close reading / unseen close analysis** (Y9) | partial in `eng-critical-reading-1` | **GAP** (thin) |
| **Thematic poetry anthology** (Y9 war poems) | — | **GAP** |
| Reading-record awards / wide reading | n/a | out of scope for topic JSONs (habit, not content) |

## Enrichment plan — 9 new topics (implemented 2026-08-19)

New files in `src/content/data/topics/english/`, `stage: "ks3"`, strand-tagged
(NOT year-tagged, to preserve strand grouping; year level is calibration
guidance for the author). IDs follow the existing `eng-<slug>` convention with
a year hint. Text choices inside notes stay canonical/public-domain or
text-agnostic (no copying of the reference's reading lists).

1. `eng-yr7-identity-autobiography` (writing) — "Writing the Self: Identity & Autobiography". Y7. Identity-poem response (sensory memories, "I am from…" structures), autobiographical incident (first person, scene vs summary, reflection), memoir voice.
2. `eng-yr7-short-story` (reading) — "Anatomy of the Short Story". Y7. Economy of form, openings, character in few words, twist/surprise endings, tension, reading a whole story closely.
3. `eng-yr7-graphic-novels` (reading) — "Graphic Novels & Visual Storytelling". Y7. Panels/gutters/layout, visual symbolism, colour & lettering, adapting prose to panels, reading images critically.
4. `eng-yr8-short-story-writing` (writing) — "Crafting Short Stories". Y8. From stimulus to draft: premise, compressed structure, dialogue that reveals, endings that land, editing & re-drafting.
5. `eng-yr8-modern-drama` (reading) — "Modern Drama: Post-1900 Plays". Y8. Stage directions & subtext, tension & structure (acts, entrances/exits), character through dialogue, social context & message, comparing stagecraft to Shakespeare.
6. `eng-yr9-descriptive-writing` (writing) — "Descriptive Writing". Y9. Sensory detail, atmosphere & mood, precise verbs/adjectives, showing vs telling, structuring a description, controlled narrative openings.
7. `eng-yr9-close-reading` (reading) — "Close Reading & Textual Analysis". Y9. Word-level analysis, connotation, imagery, syntax & sentence effects, unseen-extract method, building a critical paragraph (PEE+).
8. `eng-yr9-letters-interviews` (writing) — "Letters & Interviews: Real-World Voices". Y9. Formal vs informal letters, register & audience, layout conventions, planning & conducting an interview, turning an interview into an article.
9. `eng-yr9-war-poetry` (reading) — "War Poetry: Thematic Anthology Study". Y9. Anthology approach, themes (duty, horror, pity, protest, remembrance), comparing poems by theme & technique, tone shift patriotic → protest, comparative responses (public-domain quotations only).

Optional later additions: a second Shakespeare topic split by genre (comedy vs
tragedy).

## When implementing

- Follow `docs/CONTENT_STYLE.md` (7 notes / 12 flashcards / 15 questions,
  difficulty rubric). After adding/removing files: `npm run generate:registry`,
  update counts in `tests/unit/content-registry.test.ts` (english 25 → 33)
  and run the full gates.
