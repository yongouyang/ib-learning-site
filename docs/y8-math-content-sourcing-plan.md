# Year 8 Math Content Sourcing Plan

> Research and roadmap for sourcing Year 8 / MYP 3 mathematics content for IBLearn.
> Date: 2026-06-20

---

## 1. Project Context

**IBLearn** is an interactive, mobile-first revision platform for IB students (MYP + DP).
- Content is authored as static JSON files (`src/content/data/topics/<subject>/<topic-id>.json`)
- Each topic needs: **Study Notes**, **Flashcards**, **Multiple-Choice Questions** (stem + choices + correctIndex + explanation)
- Math currently has 59 topics (27 MYP Year 7, 6 MYP Year 8, 26 DP)
- Target for this plan: **MYP Year 8 / KS3 Year 8** math content expansion

---

## 2. Content Requirements

For every topic we add, we need three asset types:

| Asset Type | Format in App | What to Source |
|---|---|---|
| **Study Notes** | Array of `notes` (id + heading + body + optional illustration) | Concise explanations, definitions, worked examples |
| **Flashcards** | Array of `flashcards` (id + term + definition + optional example) | Key terms, formulas, rules, vocabulary |
| **Quiz Questions** | Array of `questions` (id + stem + 2–6 choices + correctIndex + explanation) | Multiple-choice questions with distractors and full explanations |

**Quality criteria:**
- Curriculum-aligned (IB MYP Year 3 or UK KS3 Year 8)
- Progressive difficulty within topics
- Explanations must teach *why*, not just state the answer
- Clean licensing or purchasable for adaptation

---

## 3. Year 8 Implementation Roadmap

Year 8 math is being built in phases of three topics. Phases 1 and 2 are complete.

### Phase 1 — Algebra & Geometry (Done)

| Topic | ID | Focus |
|---|---|---|
| Factorising Algebraic Expressions | `math-yr8-factorising` | Common factors, difference of squares, grouping |
| Circles | `math-yr8-circles` | Area, circumference, arcs, sectors |
| Angles in Parallel Lines & Polygons | `math-yr8-angles-parallel-polygons` | Angle rules, interior/exterior angles |

### Phase 2 — Geometry, Number & Measures (Done)

| Topic | ID | Focus |
|---|---|---|
| Congruence & Similarity | `math-yr8-congruence-similarity` | Congruence tests, similar shapes, scale factors |
| Standard Form | `math-yr8-standard-form` | Scientific notation, operations, conversions |
| Compound Measures | `math-yr8-compound-measures` | Speed, density, pressure, unit conversions |

### Phase 3 — Number, Probability & Statistics (Done)

| Topic | ID | Focus |
|---|---|---|
| Percentages, Ratio & Proportion | `math-yr8-percentages-ratio-proportion` | Compound interest, reverse percentages, repeated change, direct/inverse proportion |
| Probability & Tree Diagrams | `math-yr8-probability-trees` | Independent/dependent events, AND/OR rules, tree diagrams, expected frequency |
| Statistics & Averages | `math-yr8-statistics-averages` | Frequency tables, estimated mean, stem-and-leaf, comparing distributions |

### Phase 4 — Algebra & Graphs (Done)

| Topic | ID | Focus |
|---|---|---|
| Linear Equations & Inequalities | `math-yr8-linear-equations` | Solving multi-step equations, inequalities on a number line |
| Straight-Line Graphs | `math-yr8-straight-line-graphs` | Gradient, intercept, y = mx + c, parallel/perpendicular |
| Sequences & nth Term | `math-yr8-sequences` | Linear sequences, quadratic sequences, position-to-term rules |

### Phase 5 — Geometry & Measures (Done)

| Topic | ID | Focus |
|---|---|---|
| Volume & Surface Area of Prisms | `math-yr8-volume-surface-area` | Cuboids, prisms, cylinders, composite solids |
| Transformations & Symmetry | `math-yr8-transformations` | Reflection, rotation, translation, enlargement, symmetry |
| Pythagoras' Theorem | `math-yr8-pythagoras` | Right-angled triangles, applications, distance on grids |

### Phase 6 — Year 8 Science & English Pilot (Done)

| Topic | ID | Subject | Focus |
|---|---|---|---|
| Novel Study & Analysis | `eng-novel-study-1` | English | Character, setting, plot, theme, narrative perspective, analytical writing |
| Persuasive Speaking & Debate | `eng-persuasive-speaking-1` | English | Rhetorical devices, argument structure, rebuttal, debate etiquette |
| Introduction to Organic Chemistry | `chem-organic-1` | Chemistry | Carbon bonding, alkanes/alkenes, functional groups, simple formulas |

---

## 4. Free Resources

### 4.1 Cazoom Maths (UK KS3 Year 8)
- **URL:** https://www.cazoommaths.com/maths-worksheets/year-8-maths-worksheets/
- **What they offer:** 300+ worksheets covering ratio, proportion, percentages, probability, statistics, algebra, geometry
- **Answers:** Full answer keys included
- **Format:** Printable PDFs
- **Cost:** Free samples; full library may require subscription
- **Pros:** Well organised by topic; clean layout; strong visual worksheets
- **Cons:** UK National Curriculum alignment, not IB MYP; requires manual extraction
- **Best used for:** Question inspiration and worksheet-style practice problems

### 4.2 Corbett Maths (UK KS3 / GCSE Foundation)
- **URL:** https://corbettmaths.com/
- **What they offer:** Practice questions, 5-a-day, videos, textbook exercises with answers
- **Answers:** Fully worked solutions
- **Format:** PDF + video
- **Cost:** Free
- **Pros:** Excellent worked examples; consistent quality; good range of difficulty
- **Cons:** GCSE-focused; some topics above Year 8
- **Best used for:** Adaptation of practice questions; writing study-note explanations

### 4.3 Maths Genie (UK KS3 / GCSE)
- **URL:** https://www.mathsgenie.co.uk/
- **What they offer:** Video tutorials, exam questions, booklets with mark schemes
- **Answers:** Model answers included
- **Format:** PDF booklets + videos
- **Cost:** Free
- **Pros:** Well-structured by grade; good scaffolding
- **Cons:** Exam-style questions may be too formal for Year 8
- **Best used for:** End-of-topic revision and challenge questions

### 4.4 BBC Bitesize (UK KS3)
- **URL:** https://www.bbc.co.uk/bitesize
- **What they offer:** Topic guides, videos, interactive quizzes
- **Answers:** Instant feedback
- **Format:** Web articles + quizzes
- **Cost:** Free
- **Pros:** Clear explanations for beginners; trusted brand
- **Cons:** Quiz depth limited; web-only
- **Best used for:** Writing study notes and flashcards

### 4.5 Third Space Learning (UK KS3 / GCSE Foundation)
- **URL:** https://thirdspacelearning.com/blog/revision-mats/
- **What they offer:** Free worksheets; revision mats with skills/applied/exam sections
- **Answers:** Included
- **Format:** PDF downloads
- **Cost:** Free (in exchange for email)
- **Pros:** Three-section structure maps well to progressive difficulty
- **Cons:** GCSE Foundation; not IB-aligned
- **Best used for:** Skill and applied question adaptation

---

## 5. IB-Specific / MYP-Aligned Resources

### 5.1 SparkEd Maths
- **URL:** https://www.sparkedmaths.com/
- **What they offer:** IB MYP worksheets by class and topic; 3 difficulty levels; answer keys
- **Cost:** Freemium
- **Pros:** Explicitly IB MYP aligned; handpicked questions
- **Cons:** Smaller platform; unclear coverage of Year 8 topics
- **Best used for:** Validating topic scope against MYP syllabus

### 5.2 Mathspace
- **URL:** https://mathspace.co/pages/ib-worksheets
- **What they offer:** MYP 2–5 worksheets; fluency, problem-solving, reasoning questions
- **Cost:** Free account; full content behind subscription
- **Pros:** Built for IB MYP; adaptive technology
- **Cons:** Subscription for full access; digital-first extraction
- **Best used for:** Mapping MYP topic progression

### 5.3 Haese Mathematics
- **URL:** https://haesemathematics.com.au/
- **What they offer:** MYP 1–3 textbooks, workbooks, Snowflake digital access
- **Cost:** Paid textbooks (~$40–60 AUD)
- **Pros:** Purpose-built for IB; high-quality typography; teacher support
- **Cons:** Paid; requires adaptation
- **Best used for:** Authoritative source for explanations and questions

### 5.4 Pearson — International Mathematics for the MYP
- **Sample URL:** https://anyflip.com/nzeux/ifxf/basic (Year 2 sample)
- **What they offer:** Student coursebooks, companion sites, foundation/challenge worksheets
- **Cost:** Paid (~£25–40)
- **Pros:** Explicitly MYP; built-in differentiation
- **Cons:** Paid; content extraction is manual
- **Best used for:** Curriculum mapping and sourcing differentiated question sets

---

## 6. Commercial Textbooks (Deep Structured Content)

| Title | Publisher | Level | Key Features | Est. Cost |
|---|---|---|---|---|
| **International Mathematics for the MYP Year 3** | Pearson | MYP 3 (~Year 8) | Coursebook + companion site, foundation/challenge worksheets, tests | £25–40 |
| **Mathematics for the International Student (MYP 1–3)** | Haese | MYP 1–3 | IB-specific; workbook style; Snowflake digital access | $40–60 AUD |
| **Cambridge Lower Secondary Mathematics** | Cambridge University Press | Stage 8 (~Year 8) | Internationally minded; workbook + teacher resources | £15–25 |
| **Discovering Mathematics / MyMaths for KS3** | Oxford University Press | UK KS3 Year 8 | Strong topic coverage; companion digital resources | £15–25 |

**Note:** For Year 8 math, **Pearson MYP Year 3** and **Haese MYP 2–3** are the strongest curriculum matches.

---

## 7. Curriculum Alignment Notes

### UK KS3 Year 8 ↔ IB MYP Year 3 Mapping

| UK KS3 Topic | IB MYP Equivalent | Relevance |
|---|---|---|
| Number: percentages, ratio, proportion, compound interest | Number — proportional reasoning, financial literacy | High |
| Algebra: linear equations, inequalities, formulae | Algebra — equations & functions | High |
| Algebra: sequences and straight-line graphs | Algebra — patterns & relationships | High |
| Geometry: angles, constructions, transformations | Geometry & Trigonometry — shape & space | High |
| Geometry: Pythagoras, volume and surface area | Geometry & Trigonometry — measurement | High |
| Statistics: frequency tables, grouped data, averages | Statistics & Probability — data handling | High |
| Probability: tree diagrams, independent/dependent events | Statistics & Probability — chance | High |

**Key insight:** UK KS3 Year 8 and IB MYP Year 3 overlap strongly. Use UK resources for question variety, but verify terminology and notation against an MYP textbook.

---

## 8. Sourcing Strategy Options

All new content must pass the project's quality gates before merging:

```bash
npm run validate:content
npm run validate:illustrations
npm run audit:content
```

The CI pipeline treats any validation error or audit warning as a failure. See `CONTENT_STYLE.md` for full content conventions.

### Option A: Manual Curation from Free Sources (High Effort, High Control)
- Use Corbett Maths, Cazoom, BBC Bitesize as inspiration
- Write all content as JSON topic files manually
- **Pros:** Perfect quality control; exact fit for app format; zero cost
- **Cons:** Very time-consuming
- **Best if:** You want a small, premium set of topics

### Option B: Buy One MYP Textbook + Adapt (Medium-High Effort, Very High Quality)
- Purchase Pearson International Mathematics for the MYP Year 3 or Haese MYP 2–3
- Use textbook for scope, explanations, worked examples, end-of-chapter questions
- **Pros:** Curriculum-faithful; authoritative explanations
- **Cons:** Requires purchase; manual transcription; copyright adaptation required
- **Best if:** You want to scale confidently with IB-aligned content

### Option C: Subscribe to Worksheet Banks + Rewrite (Medium Effort, Medium Quality)
- Subscribe to SparkEd Maths or Grade1to6.com
- Use worksheet questions as raw material; rewrite into MCQ format
- **Pros:** Affordable; bulk question access
- **Cons:** Requires significant rewriting; variable explanation depth
- **Best if:** You need volume quickly

### Option D: Hybrid Approach (Recommended Balance)
1. **Anchor:** Buy one MYP Year 3 textbook (Pearson or Haese) for curriculum fidelity
2. **Bulk questions:** Use Corbett Maths (free) and Cazoom (subscription) for variety
3. **Explanations:** Use BBC Bitesize as a reference for clear explanations
4. **Validation:** Cross-check topic list against SparkEd Maths free MYP worksheets
- **Pros:** Best balance of curriculum alignment, cost, and volume
- **Cons:** Still requires manual adaptation
- **Best if:** You want to expand systematically across many Year 8 topics

---

## 9. Recommended Next Steps

1. **Expand Year 8 science coverage** — Add Year 8-appropriate topics in biology and physics (e.g., microorganisms, further forces, energy resources).
2. **Expand Year 8 English coverage** — Add media literacy, non-fiction analysis, or research and citation skills topics.
3. **Source an anchor textbook** — Purchase or trial Pearson MYP Year 3 or Haese MYP 2–3 to improve curriculum fidelity for future phases.
4. **Enrich existing topics** — Add more challenging questions and worked examples to high-traffic DP and MYP topics.

---

## 10. Resource Quick-Reference Table

| Source | Cost | IB Aligned | Answers | Best For |
|---|---|---|---|---|
| Cazoom Maths | Free / Freemium | No | Yes | Topic-organised worksheets |
| Corbett Maths | Free | No | Yes | Practice questions & videos |
| Maths Genie | Free | No | Yes | Exam-style questions |
| BBC Bitesize | Free | No | Instant | Explanations & basics |
| Third Space Learning | Free | No | Yes | Skill + applied questions |
| SparkEd Maths | Freemium | **Yes** | Yes + AI | IB MYP quiz questions |
| Mathspace | Freemium | **Yes** | Yes | MYP lessons & assignments |
| Haese Mathematics | Paid | **Yes** | Yes (teacher) | Authoritative IB textbooks |
| Pearson MYP | Paid | **Yes** | Yes (teacher) | MYP coursebooks & tests |

---

*End of plan. Phase 3 implementation is in progress.*
