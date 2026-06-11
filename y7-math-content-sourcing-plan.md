# Year 7 Math Content Sourcing Plan

> Research findings for sourcing Year 7 / MYP-level mathematics content (textbooks, worksheets, questions & answers) for IBLearn.
> Date: 2026-06-11

---

## 1. Project Context

**IBLearn** is an interactive, mobile-first revision platform for IB students (MYP + DP).
- Content is authored as static TypeScript modules (`src/content/*.ts`)
- Each topic needs: **Study Notes**, **Flashcards**, **Multiple-Choice Questions** (stem + choices + correctIndex + explanation)
- Current coverage: 5 subjects, 51 topics. Math already has 31 topics spanning Year 7 basics through DP level.
- Target for this plan: **MYP Year 7 / KS3 Year 7** math content expansion.

---

## 2. Content Requirements

For every topic we add, we need three asset types:

| Asset Type | Format in App | What to Source |
|---|---|---|
| **Study Notes** | Array of `ConceptNote` (heading + body) | Concise explanations, definitions, worked examples |
| **Flashcards** | Array of `Flashcard` (term + definition + optional example) | Key terms, formulas, rules, vocabulary |
| **Quiz Questions** | Array of `Question` (stem + 2–6 choices + correctIndex + explanation) | Multiple-choice questions with distractors and full explanations |

**Quality criteria:**
- Curriculum-aligned (IB MYP Year 1–2 or UK KS3 Year 7)
- Progressive difficulty within topics
- Explanations must teach *why*, not just state the answer
- Clean licensing or purchasable for adaptation

---

## 3. Free Resources

### 3.1 Cazoom Maths (UK KS3)
- **URL:** https://www.cazoommaths.com/maths-worksheets/year-7-maths-worksheets/
- **What they offer:** 360+ individual worksheets, ~1,100 printable PDF pages across Number, Algebra, Geometry, Statistics, Measurement
- **Answers:** Full answer keys included on separate pages
- **Format:** High-quality printable PDFs
- **Cost:** Free samples available; full library may require subscription (check current model)
- **Pros:** Very well organized by topic; clean layout; trusted by 60,000+ users; TES-recommended
- **Cons:** UK National Curriculum (not IB MYP), so topics may need mapping; PDF format means manual extraction
- **Best used for:** Question inspiration, worksheet-style practice problems to adapt into MCQs

### 3.2 Corbett Maths (UK KS3 / GCSE Foundation)
- **URL:** https://corbettmaths.com/
- **What they offer:** Topic-by-topic practice questions, "5-a-day" worksheets, videos, textbook exercises with answers
- **Answers:** Fully worked solutions and answer sheets
- **Format:** PDF worksheets + video tutorials
- **Cost:** Completely free
- **Pros:** Extremely popular with UK teachers; excellent worked examples; consistent quality; good range of difficulty
- **Cons:** GCSE-focused so some topics are above Year 7; not IB-aligned
- **Best used for:** Adaptation of practice questions into quiz format; video explanations as reference for writing study notes

### 3.3 Maths Genie (UK KS3 / GCSE)
- **URL:** https://www.mathsgenie.co.uk/
- **What they offer:** Video tutorials, exam questions by topic, exam booklets with answers, scheme of learning
- **Answers:** Model answers and mark schemes included
- **Format:** PDF booklets + videos
- **Cost:** Completely free
- **Pros:** Well-structured by grade (1–5 Foundation); good for scaffolding; printable booklets
- **Cons:** Exam-style questions may be too formal for Year 7; not IB-specific
- **Best used for:** End-of-topic revision questions; challenge-level content

### 3.4 HomeSchoolMath (Grade 7 / Pre-Algebra)
- **URL:** https://www.homeschoolmath.net/worksheets/grade_7.php
- **What they offer:** Auto-generated worksheets covering expressions, integers, one-step equations, rational numbers, multi-step equations, inequalities, ratios, proportions, percent, geometry
- **Answers:** Answer key on 2nd page of every PDF
- **Format:** Browser-generated PDF (refresh for new questions)
- **Cost:** Completely free
- **Pros:** Infinite variety due to random generation; covers core pre-algebra topics well; no account needed
- **Cons:** No IB alignment; purely procedural worksheets (no word problems / investigations); basic formatting
- **Best used for:** Bulk-generating drill questions for foundational topics (integers, equations, percentages)

### 3.5 BBC Bitesize (UK KS3)
- **URL:** https://www.bbc.co.uk/bitesize
- **What they offer:** Topic guides with clear explanations, videos, interactive quizzes
- **Answers:** Instant feedback on quizzes
- **Format:** Web-based articles + quizzes
- **Cost:** Completely free
- **Pros:** Exceptionally clear explanations for beginners; good for building foundational understanding; trusted brand
- **Cons:** Quiz format is simple fill-in / multi-choice but not deep enough for a full quiz bank; content is web-only
- **Best used for:** Writing study notes and flashcards; understanding how to explain concepts simply

### 3.6 Third Space Learning (UK KS3 / GCSE Foundation)
- **URL:** https://thirdspacelearning.com/blog/revision-mats/
- **What they offer:** 200+ free GCSE maths worksheets; revision mats; skill-based practice + applied questions + exam questions
- **Answers:** All included
- **Format:** PDF downloads
- **Cost:** Free (in exchange for email)
- **Pros:** Three-section structure (skills / applied / exam) maps well to progressive difficulty; clean formatting
- **Cons:** GCSE Foundation so some content is above Year 7; not IB-aligned
- **Best used for:** Adaptation of Section 1 (skill-based) and Section 2 (applied) questions

---

## 4. IB-Specific / MYP-Aligned Resources

### 4.1 SparkEd Maths
- **URL:** https://www.sparkedmaths.com/
- **What they offer:** IB MYP worksheets by class and topic (e.g. Probability, Circle Geometry); 3 difficulty levels (Easy / Medium / Hard); clean printable PDFs; complete answer keys; AI-powered doubt clearing
- **Answers:** Detailed answer keys; step-by-step solutions; AI coach available
- **Format:** Printable PDFs + online practice
- **Cost:** Freemium (some free worksheets; full access likely paid)
- **Pros:** Explicitly IB MYP aligned; handpicked questions (not auto-generated); exam-pattern aligned; daily fresh worksheet generation
- **Cons:** Relatively new / smaller platform; unclear pricing model; may not cover all Year 7 topics yet
- **Best used for:** Primary source for IB-aligned quiz questions; validating topic scope against MYP syllabus

### 4.2 Mathspace
- **URL:** https://mathspace.co/pages/ib-worksheets
- **What they offer:** Comprehensive mathematics worksheets aligned to IB MYP courses (MYP 2–5); fluency, problem-solving, and reasoning questions; lessons and online assignments
- **Answers:** Included in digital platform
- **Format:** Printable worksheets + digital lessons + adaptive question sets
- **Cost:** Free account for basic access; full content behind subscription
- **Pros:** Built for IB MYP; adaptive technology; comprehensive coverage across MYP levels; teacher dashboards
- **Cons:** Subscription required for full access; content is digital-first so extraction may be manual
- **Best used for:** Mapping MYP topic progression; sourcing problem-solving and reasoning questions

### 4.3 Haese Mathematics
- **URL:** https://haesemathematics.com.au/
- **What they offer:** IB PYP 5 / MYP 0 textbook, write-on workbooks (PYP 1–4), digital access via Snowflake platform, interactive features, printable worksheets, teacher resources with answers
- **Answers:** Included in teacher resources and digital platform
- **Format:** Physical textbooks + digital via Snowflake
- **Cost:** Paid textbooks (~$30–60 AUD); digital access included for 12 months
- **Pros:** Purpose-built for IB; seamless transition from PYP to MYP; high-quality mathematical typography; extensive teacher support
- **Cons:** MYP 0 is transition-level (slightly below Year 7); need to check if they have MYP 1–2 specific texts
- **Best used for:** Authoritative source for explanations, worked examples, and end-of-chapter questions

### 4.4 Pearson — International Mathematics for the MYP
- **Sample URL:** https://anyflip.com/nzeux/ifxf/basic (Year 2 sample)
- **What they offer:** Student coursebooks, companion websites with chapter review questions, quick quizzes, foundation & challenge worksheets, technology activities, teacher resource centre with tests and answers
- **Answers:** In teacher resource centre and companion website
- **Format:** Physical textbook + companion website + Teacher Resource CD
- **Cost:** Paid (textbook ~£25–40)
- **Pros:** Explicitly MYP Year 2 aligned; built-in differentiation (Foundation / Challenge); digital interactives; comprehensive assessment resources
- **Cons:** Paid; content is locked behind purchase; extraction requires manual work
- **Best used for:** Curriculum mapping, writing study notes, and sourcing differentiated question sets

### 4.5 Grade1to6.com
- **URL:** https://www.grade1to6.com/math-worksheets-grade-6.html
- **What they offer:** MYP/IB-aligned math workbooks and worksheets for Grades 1–6; topics include integers, exponents, number properties, probability, ratio, proportions, area
- **Answers:** Answer sheets included with all worksheets
- **Format:** PDF downloads
- **Cost:** Individual workbooks ~$2; membership $25/year for 6,000+ worksheets
- **Pros:** Very affordable; explicitly mentions IB MYP alignment; designed by teachers with international experience; highly rated on TpT (4.7/5) and Google (4.8/5)
- **Cons:** Grades 1–6 so upper Year 7 content may be missing; workbooks are worksheet collections, not structured courses
- **Best used for:** Affordable bulk sourcing of practice questions for foundational topics

---

## 5. Commercial Textbooks (Deep Structured Content)

| Title | Publisher | Level | Key Features | Est. Cost |
|---|---|---|---|---|
| **International Mathematics for the MYP Year 2** | Pearson | MYP 2 (~Year 7) | Coursebook + companion site with auto-correcting quizzes, foundation/challenge worksheets, teacher tests & answers | £25–40 |
| **Mathematics for the International Student (MYP 1–3)** | Haese | MYP 1–3 | IB-specific; write-on workbook style; Snowflake digital access; teacher resources | $40–60 AUD |
| **Cambridge Lower Secondary Mathematics** | Cambridge University Press | Stage 7 (~Year 7) | Internationally minded; workbook + teacher resources with answers; not IB but topic overlap is high | £15–25 |
| **Discovering Mathematics / MyMaths for KS3** | Oxford University Press | UK KS3 Year 7 | UK curriculum; strong topic coverage; companion digital resources (Kerbdoodle) | £15–25 |
| **Sciences for the IB MYP by Concept** | Hodder Education | MYP 1–3 | Concept-driven approach; eBooks and Boost teaching resources available | £20–30 |

**Note:** For math specifically, **Pearson MYP Year 2** and **Haese MYP** are the strongest curriculum matches.

---

## 6. Curriculum Alignment Notes

### UK KS3 Year 7 ↔ IB MYP Year 1–2 Mapping

| UK KS3 Topic | IB MYP Equivalent | Relevance |
|---|---|---|
| Number: negatives, factors, multiples, primes | Number — integers, number properties | High |
| Fractions, decimals, percentages | Number — rational numbers, proportional reasoning | High |
| Introduction to algebra | Algebra — expressions, substitution, simple equations | High |
| Angles, triangles, quadrilaterals | Geometry & Trigonometry — shape properties | High |
| Area and perimeter | Geometry & Trigonometry — measurement | High |
| Statistics: mean, median, mode, charts | Statistics & Probability — data handling | High |
| Basic probability | Statistics & Probability — chance | High |
| Ratio and proportion | Number — ratio & proportional reasoning | High |
| Sequences and patterns | Algebra — patterns & sequences | Medium-High |
| Linear graphs | Algebra — linear functions | Medium |

**Key insight:** UK KS3 Year 7 and IB MYP Year 1–2 are highly overlapping. Using UK resources is viable, but an IB MYP textbook should be the "source of truth" for terminology, notation, and the four MYP criteria (Knowing & Understanding, Investigating Patterns, Communicating, Applying Mathematics).

---

## 7. Sourcing Strategy Options

### Option A: Manual Curation from Free Sources (High Effort, High Control)
- Use **Corbett Maths**, **Cazoom**, **BBC Bitesize** as inspiration
- Write all content in IBLearn's TypeScript format manually
- **Pros:** Perfect quality control; exact fit for app format; zero cost
- **Cons:** Very time-consuming; requires strong math pedagogy knowledge
- **Best if:** You want a small, premium set of topics and have time to craft content

### Option B: Buy One MYP Textbook + Adapt (Medium-High Effort, Very High Quality)
- Purchase **Pearson International Mathematics for the MYP Year 2** or **Haese MYP 1**
- Use textbook for: topic scope, explanations, worked examples, end-of-chapter questions
- Supplement with free worksheet questions for variety
- **Pros:** Curriculum-faithful; authoritative explanations; built-in differentiation
- **Cons:** Requires purchase; manual transcription into app format; copyright restrictions on verbatim copying (adaptation required)
- **Best if:** You want to scale confidently with IB-aligned content

### Option C: Subscribe to Worksheet Banks + Rewrite (Medium Effort, Medium Quality)
- Subscribe to **Grade1to6.com** ($25/year) or **SparkEd Maths**
- Use worksheet questions as raw material; rewrite into MCQ format with explanations
- **Pros:** Affordable; bulk question access; some IB alignment
- **Cons:** Still requires significant rewriting; variable explanation depth
- **Best if:** You need volume quickly and are comfortable rewriting content

### Option D: Hybrid Approach (Recommended Balance)
1. **Anchor:** Buy **one** MYP Year 2 textbook (Pearson or Haese) for curriculum fidelity and explanations
2. **Bulk questions:** Use **Corbett Maths** (free) and **Grade1to6.com** ($25/year) for question variety
3. **Explanations:** Use **BBC Bitesize** as a reference for how to explain concepts simply
4. **Validation:** Cross-check topic list against **SparkEd Maths** free MYP worksheets
- **Pros:** Best balance of curriculum alignment, cost, and volume
- **Cons:** Still requires manual adaptation work
- **Best if:** You want to expand systematically across many topics

---

## 8. Recommended Next Steps

1. **Decide on curriculum anchor:** Choose between Pearson MYP Year 2 or Haese MYP as the authoritative source for topic sequencing and explanations.
2. **Audit existing content:** Map IBLearn's current 31 math topics against the MYP Year 1–2 scope to identify gaps.
3. **Prioritize topics:** Select 5–10 highest-impact Year 7 topics that are currently missing or underdeveloped.
4. **Source one topic end-to-end:** Pick one topic (e.g., "Fractions & Decimals" or "Basic Probability") and fully populate it using your chosen strategy to validate the workflow.
5. **Document conversion workflow:** Create a lightweight process for converting sourced questions into IBLearn's `Question`, `Flashcard`, and `ConceptNote` TypeScript structures.
6. **Consider licensing:** If adapting from commercial textbooks, ensure you are rewriting in your own words rather than copying verbatim. Worksheet questions are generally safe to adapt if rewritten.

---

## 9. Resource Quick-Reference Table

| Source | Cost | IB Aligned | Answers | Best For |
|---|---|---|---|---|
| Cazoom Maths | Free / Freemium | No | Yes | Topic-organized worksheets |
| Corbett Maths | Free | No | Yes | Practice questions & videos |
| Maths Genie | Free | No | Yes | Exam-style questions |
| HomeSchoolMath | Free | No | Yes | Infinite drill questions |
| BBC Bitesize | Free | No | Instant | Explanations & basics |
| Third Space Learning | Free | No | Yes | Skill + applied questions |
| SparkEd Maths | Freemium | **Yes** | Yes + AI | IB MYP quiz questions |
| Mathspace | Freemium | **Yes** | Yes | MYP lessons & assignments |
| Haese Mathematics | Paid | **Yes** | Yes (teacher) | Authoritative IB textbooks |
| Pearson MYP | Paid | **Yes** | Yes (teacher) | MYP coursebooks & tests |
| Grade1to6.com | $25/yr | Claims MYP | Yes | Affordable bulk worksheets |

---

*End of plan. No changes were made to the IBLearn codebase.*
