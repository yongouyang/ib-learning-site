# IB Books Analysis & Implementation Plan

> Assessment of the user's existing IB math PDF library for enriching IBLearn's math content.
> Date: 2026-06-11

---

## 1. Discovery Summary

The user's `~/projects/tmp/IB Books` folder contains **10+ IB mathematics PDFs**. After reading them systematically, a critical finding emerged:

**⚠️ None of these books are suitable for Year 7 / MYP content.** Every PDF is **DP (Diploma Programme) level** — designed for ages 16–19.

However, they are **highly relevant to IBLearn's existing DP math topics** and can be used to enrich existing content or add new DP topics.

---

## 2. Inventory of PDFs

### Main Directory

| File | Publisher | Level | Pages | Text Extractable? | Notes |
|---|---|---|---|---|---|
| `IB Mathematics SL - Applications and Interpretation - OXFORD 2019.pdf` | Oxford | DP AI SL | ~700 | ✅ Yes | Course companion with clear chapter structure |
| `Mathematics - Core Topics SL 1 - Haese 2019.pdf` | Haese | DP SL | 389 | ❌ No | Image-based; text does not extract |
| `Mathematics - Core Topics HL 1 - Haese 2019.pdf` | Haese | DP HL | 549 | ❌ No | Image-based; text does not extract |
| `Mathematics - Mathematics HL (Core) - Third Edition.pdf` | Haese | DP HL (pre-2019) | 971 | ⚠️ Partial | Extracts but with messy formatting; usable |
| `Mathematics-analysis-and-approaches-hl-2 Haese 2019.pdf` | Haese | DP AA HL | 913 | ❌ No | Image-based; text does not extract |
| `Mathematics HL - Applications and Interpretation - Pearson 2019.pdf` | Pearson | DP AI HL | 1,016 | ❌ No | Image-based; text does not extract |

### `Math/` Subdirectory (Save My Exams Revision Notes)

| File | Topic | Pages | Text Extractable? |
|---|---|---|---|
| `1. Number & Algebra.pdf` | Standard form, exponents, sequences & series, financial math, complex numbers, matrices, eigenvalues | 102 | ✅ Yes |
| `2. Functions.pdf` | Linear functions, further functions, modelling, transformations, logarithmic modelling | ~100 | ✅ Yes |
| `3. Geometry & Trigonometry.pdf` | Geometry toolkit, 3D shapes, trig, further trig, Voronoi diagrams, matrix transformations, vectors | ~120 | ✅ Yes |
| `4. Statistics & Probability.pdf` | Sampling, correlation/regression, probability, distributions, binomial, normal, Poisson, hypothesis testing, Markov chains | 162 | ✅ Yes |
| `5. Calculus.pdf` | Differentiation, further differentiation, integration, further integration, kinematics, differential equations | ~100 | ✅ Yes |
| Sub-topic PDFs (e.g. `1.1 Number Toolkit`, `3.10 Graph Theory`) | Granular sub-topics | 2–50 each | ✅ Yes |

### `微积分2本/` Subdirectory

| File | Level | Pages | Text Extractable? |
|---|---|---|---|
| `Precalculus.pdf` | Pre-university / DP prep | ~500 | ❌ No (encrypted/image) |
| `Calculus.pdf` | University / DP HL | ~86 | ⚠️ Partial |

---

## 3. Critical Finding: Text Extraction Feasibility

Only **~30% of the PDF pages** are text-extractable. This is the single biggest constraint.

| Category | PDFs | % of Content | Work Speed |
|---|---|---|---|
| **Clean text** | Save My Exams, Oxford AI SL | ~30% | Fast — can parse programmatically |
| **Messy text** | Haese HL Core (3rd Ed), Calculus | ~15% | Slow — needs manual cleanup |
| **Image-based** | Haese Core SL/HL, Haese AA HL 2, Pearson HL AI, Precalculus | ~55% | Very slow — manual reading or OCR required |

**Implication:** The realistic implementation plan must rely primarily on the **Save My Exams** and **Oxford AI SL** PDFs. The image-based Haese and Pearson books are better used as visual reference or for specific pages/screenshots, not for bulk content extraction.

---

## 4. Mapping to IBLearn's Existing Math Content

IBLearn currently has **31 math topics** across MYP and DP. Below is how the user's PDF library maps to these.

### 4.1 Topics Already Covered in IBLearn (Can Be Enriched)

| IBLearn Topic | ibLevel | Found In User's PDFs | Enrichment Potential |
|---|---|---|---|
| Written Calculations | MYP | ❌ Not in these books | N/A |
| Decimals | MYP | ❌ Not in these books | N/A |
| Algebra: Substitution | MYP | ❌ Not in these books | N/A |
| Solving Equations | MYP | ❌ Not in these books | N/A |
| Transformations | MYP | ❌ Not in these books | N/A |
| Probability | MYP | ⚠️ Only basic concepts in Oxford AI SL Ch 7 | Low |
| Algebra Basics | MYP | ❌ Not in these books | N/A |
| Fractions & Percentages | MYP | ❌ Not in these books | N/A |
| Geometry | MYP | ❌ Not in these books | N/A |
| Statistics | MYP | ⚠️ Basic descriptive stats in Oxford AI SL Ch 3 | Low |
| Number Patterns | MYP | ❌ Not in these books | N/A |
| Ratio & Proportion | MYP | ❌ Not in these books | N/A |
| Linear Graphs | MYP | ❌ Not in these books | N/A |
| Powers & Indices | MYP | ❌ Not in these books | N/A |
| Simultaneous Equations | MYP | ❌ Not in these books | N/A |
| Inequalities | MYP | ❌ Not in these books | N/A |
| Pythagoras | MYP | ❌ Not in these books | N/A |
| Basic Trigonometry | MYP | ❌ Not in these books | N/A |
| **Sequences & Series** | **DP** | ✅ Save My Exams 1.3; Haese HL Core | **High** |
| **Exponents & Logarithms** | **DP** | ✅ Save My Exams 1.2; Haese HL Core | **High** |
| **Binomial Theorem** | **DP** | ✅ Save My Exams 1.3 (implied); Haese HL Core | **Medium** |
| **Functions** | **DP** | ✅ Save My Exams 2.x; Haese HL Core; Calculus | **High** |
| **Quadratic Functions & Equations** | **DP** | ✅ Haese HL Core (Ch 1) | **High** |
| **Exponential & Logarithmic Functions** | **DP** | ✅ Save My Exams 1.2 / 2.7; Oxford AI SL | **High** |
| **Trigonometry** (radians, identities, sine/cosine rules) | **DP** | ✅ Save My Exams 3.x; Oxford AI SL; Haese HL Core | **High** |
| **Vectors** | **DP** | ✅ Save My Exams 3.7–3.9; Haese HL Core | **Medium** |
| **Differentiation** | **DP** | ✅ Save My Exams 5.x; Haese HL Core; Calculus | **High** |
| **Integration** | **DP** | ✅ Save My Exams 5.x; Haese HL Core; Calculus | **High** |
| **Probability Distributions** | **DP** | ✅ Save My Exams 4.5–4.9; Oxford AI SL Ch 7 | **High** |
| **Kinematics** | **DP** | ✅ Save My Exams 5.5; Haese HL Core | **Medium** |

### 4.2 Topics Missing from IBLearn (Can Be Created)

These are topics covered in the user's PDFs that IBLearn **does not currently have**:

| Missing Topic | Source PDFs | IB Level | Difficulty to Implement |
|---|---|---|---|
| **Complex Numbers** | Save My Exams 1.5–1.6; Haese HL Core | DP HL | Medium |
| **Matrices & Determinants** | Save My Exams 1.7 | DP HL | Medium |
| **Eigenvalues & Eigenvectors** | Save My Exams 1.8 | DP HL | Hard |
| **Graph Theory** | Save My Exams 3.10 | DP HL AI | Medium |
| **Voronoi Diagrams** | Save My Exams 3.5 | DP HL AI | Medium |
| **Correlation & Regression** (linear & non-linear) | Save My Exams 4.2–4.3; Oxford AI SL | DP AI | Medium |
| **Poisson Distribution** | Save My Exams 4.10 | DP HL | Medium |
| **Hypothesis Testing** (χ², t-test, goodness of fit, type I/II errors) | Save My Exams 4.11–4.12; Oxford AI SL Ch 8 | DP AI/HL | Hard |
| **Markov Chains & Transition Matrices** | Save My Exams 4.13 | DP HL AI | Hard |
| **Non-right angled trigonometry & 3D geometry** | Oxford AI SL Ch 2 | DP SL/HL | Medium |
| **Descriptive statistics deep dive** (sampling, outliers, box plots, IQR) | Save My Exams 4.1; Oxford AI SL Ch 3 | DP SL | Easy |
| **Volume of Revolution** | Mentioned in Integration notes, but no dedicated topic | DP HL | Medium |
| **Further Differential Equations** | Save My Exams 5.6–5.7 | DP HL | Hard |
| **Modelling with Vectors** | Save My Exams 3.9 | DP HL | Hard |
| **Modelling with Logarithms** | Save My Exams 2.7 | DP AI | Medium |

---

## 5. Implementation Scenarios & Time Estimates

### Assumptions
- **Fast topics** (clean text, clear structure): Save My Exams PDFs
- **Slow topics** (messy text or need cross-referencing): Haese HL Core, Oxford AI SL
- Each topic requires: 4 study notes, 6–8 flashcards, 6–10 MCQ questions with explanations
- Content must be **adapted and rewritten**, not copied verbatim, due to copyright

### Time per Unit of Work

| Task Type | Time per Topic | Source Quality Needed |
|---|---|---|
| Enrich existing DP topic (add 4–6 questions, 2–3 flashcards, deepen notes) | 15–25 min | Clean text preferred |
| Create new standard DP topic from scratch | 45–60 min | Clean text |
| Create complex HL topic (Hypothesis Testing, Eigenvalues, Markov Chains) | 60–90 min | Clean text + cross-reference |
| Work from image-based PDF (Haese Core, Pearson) | 3–4× slower | Not recommended for bulk |

### Scenario Breakdowns

#### Scenario A: Enrich ALL 12 Existing DP Topics
Add more questions, flashcards, and depth to: Sequences, Exponents, Binomial, Functions, Quadratics, Exp/Log, Trig, Vectors, Differentiation, Integration, Probability, Kinematics.

| Topic | Time | Best Source |
|---|---|---|
| Sequences & Series | 20 min | Save My Exams 1.3 |
| Exponents & Logarithms | 20 min | Save My Exams 1.2 |
| Binomial Theorem | 15 min | Save My Exams 1.3 |
| Functions | 25 min | Save My Exams 2.x |
| Quadratics | 20 min | Haese HL Core |
| Exp & Log Functions | 20 min | Save My Exams 2.7 |
| Trigonometry | 25 min | Save My Exams 3.x |
| Vectors | 20 min | Save My Exams 3.7–3.9 |
| Differentiation | 25 min | Save My Exams 5.x |
| Integration | 25 min | Save My Exams 5.x |
| Probability Distributions | 25 min | Save My Exams 4.5–4.9 |
| Kinematics | 20 min | Save My Exams 5.5 |
| **Total** | **~4.5–5.5 hours** | |

#### Scenario B: Add the 6 Highest-Impact Missing Topics
Create new topics from scratch for gaps that students actively search for.

| Topic | Time | Best Source |
|---|---|---|
| Complex Numbers | 60 min | Save My Exams 1.5–1.6 |
| Matrices | 60 min | Save My Exams 1.7 |
| Hypothesis Testing | 90 min | Save My Exams 4.11–4.12 + Oxford AI SL Ch 8 |
| Correlation & Regression | 60 min | Save My Exams 4.2–4.3 |
| Poisson Distribution | 50 min | Save My Exams 4.10 |
| Graph Theory | 60 min | Save My Exams 3.10 |
| **Total** | **~6.5–7.5 hours** | |

#### Scenario C: A + B Combined (Recommended)
Enrich existing 12 DP topics + add 6 new high-impact topics.

| Phase | Time |
|---|---|
| Enrich existing 12 topics | ~5 hours |
| Add 6 new topics | ~7 hours |
| Review, test, and fix | ~2 hours |
| **Total** | **~14 hours** |

#### Scenario D: Comprehensive Coverage (All Missing Topics ~15)
Add every missing topic identified in Section 4.2.

| Phase | Time |
|---|---|
| 12 easy/medium new topics | ~10 hours |
| 3 hard topics (Eigenvalues, Markov Chains, Further Diff Eq) | ~4 hours |
| Enrich existing topics (light pass) | ~3 hours |
| Review and test | ~2 hours |
| **Total** | **~19–20 hours** |

---

## 6. Recommended Implementation Plan

### Phase 1: Foundation — Add 6 Missing Core Topics (~7 hours)
**Priority: Highest impact for DP students**

Order of work:
1. **Descriptive Statistics Deep Dive** — bridges MYP stats to DP; easiest win
2. **Complex Numbers** — classic HL topic, well-defined scope
3. **Matrices** — foundational for HL, highly requested
4. **Correlation & Regression** — major AI component, real-world relevance
5. **Poisson Distribution** — natural extension of existing Probability topic
6. **Hypothesis Testing** — signature AI topic, significant gap

**Why this order:**
- Starts with an easy topic to validate the workflow
- Builds from single-concept topics (Complex Numbers) to multi-concept topics (Hypothesis Testing)
- Mixes AA and AI strands for balanced coverage

### Phase 2: Enrichment — Bulk Up Existing DP Topics (~5 hours)
**Priority: Improve quality of what already exists**

Focus on adding:
- **More questions** (target 10–12 per topic vs. current 5–6)
- **Harder questions** (application/word problems from Oxford AI SL)
- **More flashcards** for formulas and key facts
- **Worked examples in notes** (inspired by Save My Exams)

Priority order:
1. Differentiation & Integration (most student demand)
2. Trigonometry & Vectors (formula-heavy, benefits from more flashcards)
3. Probability Distributions (can pull many questions from Save My Exams)
4. Functions & Quadratics (foundational — more questions help weaker students)
5. Sequences, Exponents, Binomial, Exp/Log, Kinematics (light enrichment)

### Phase 3: Advanced — Niche HL AI Topics (~4 hours, optional)
**Priority: Differentiate IBLearn from competitors**

- Graph Theory
- Voronoi Diagrams
- Markov Chains
- Volume of Revolution
- Further Differential Equations

These are topics many revision apps skip entirely. Adding them makes IBLearn attractive to HL AI students specifically.

---

## 7. Constraints & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **55% of PDFs are image-based** | Cannot extract text programmatically | Rely only on Save My Exams + Oxford for bulk work; use Haese/Pearson as visual reference |
| **Copyright** | Cannot copy verbatim | All content must be adapted and rewritten in IBLearn's voice |
| **Math formatting** | Equations/symbols may not render well in plain text | Use Unicode math symbols and LaTeX-style notation where needed |
| **App topic limit** | Adding 15+ topics may slow build | No evidence of this; topics are static data |
| **Existing agent changes** | Another agent is working on the codebase | Coordinate to avoid merge conflicts in `math.ts` |

---

## 8. Next Steps (User Decision Required)

Choose one of the following:

1. **Start Phase 1 immediately** — I begin creating the 6 missing core topics one by one, starting with Descriptive Statistics.
2. **Start Phase 2 immediately** — I begin enriching existing DP topics, starting with Differentiation.
3. **Do a pilot first** — I create **one** complete topic (e.g., Complex Numbers) end-to-end in ~60 minutes so you can review the quality and style before committing to the full plan.
4. **Pause and source MYP books first** — Acknowledge these PDFs are DP-only, and shift focus to acquiring MYP Year 7 textbooks for the original goal.

---

*No code changes were made to the IBLearn codebase in producing this analysis.*
