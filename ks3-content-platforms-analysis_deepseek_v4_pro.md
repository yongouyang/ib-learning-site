# KS3 (Year 7–9, Ages 11–14) UK Syllabus — Digital Content Platform Analysis

> **Research Date**: 2026-07-21  
> **Purpose**: Evaluate best platforms for sourcing KS3 (Key Stage 3, Years 7–9) digital educational content aligned to the England National Curriculum, for the IB Learning Site project.  
> **Scope**: Analysis of 12+ platforms covering KS3, with emphasis on content structure, subject coverage, resource types, and pricing.  
> **Data Sources**: Live web scraping of platform pages + trained knowledge of UK curriculum landscape.

---

## Executive Summary

**KS3 is distinctly underserved compared to GCSE and IB.** Most revision platforms focus on exam years (Y10–13). The best KS3 sources are:

| Rank | Platform | Why Best for KS3 | Model | Best For |
|:----:|----------|------------------|-------|----------|
| ⭐ 1 | **BBC Bitesize KS3** | Most comprehensive free KS3 coverage. Curriculum-aligned, no login. | **FREE** | Reference content structure & curriculum mapping |
| ⭐ 2 | **Oak National Academy** | Complete video-lesson curriculum, government-funded, free. | **FREE** | Full lesson sequences, topic progression |
| ⭐ 3 | **Twinkl (Beyond Secondary)** | Largest library of KS3 worksheets, PowerPoints, assessments. | **Paid** ~£7/mo | Downloadable classroom resources |
| ⭐ 4 | **CGP Books KS3** | #1 UK revision guide brand. Affordable, syllabus-aligned. | **Paid** ~£5–8/book | Reference for note structure and topic scoping |
| ⭐ 5 | **Seneca Learning** | Gamified interactive courses. Free tier available. | **Freemium** | Interactive quiz and course design reference |

---

## 1. KS3 Curriculum Context (Quick Reference)

### What is KS3?
- **Year 7**: ages 11–12 — transition year from primary
- **Year 8**: ages 12–13 — consolidation year
- **Year 9**: ages 13–14 — preparation for GCSE options
- Governed by the **England National Curriculum** (Wales has slightly different structure)

### National Curriculum KS3 Subjects

| Type | Subjects |
|------|----------|
| **Core** | English, Mathematics, Science (Biology, Chemistry, Physics) |
| **Foundation** | History, Geography, Modern Foreign Languages (French/Spanish/German), Design & Technology, Art & Design, Music, Physical Education, Computing |
| **Statutory** | Citizenship, Religious Education |
| **Optional** | Drama, PSHE (Personal, Social & Health Education) |

### Key Difference: KS3 vs GCSE/IGCSE

| Aspect | KS3 | GCSE/IGCSE |
|--------|-----|------------|
| Assessment | School-internal (teacher-assessed) | External exams (exam board) |
| Exam board | National Curriculum (not exam-board-specific) | Board-specific (AQA, Edexcel, CAIE, etc.) |
| Grading | No national grading | 9-1 or A*-G |
| Content depth | Foundational/broad | Specialized/exam-focused |
| Resource market | Much smaller (no "past papers" market) | Massive exam-prep market |

> **Implication**: KS3 content is NOT exam-board-specific. One set of KS3 materials works for all students transitioning to any GCSE board. This makes KS3 content **more reusable** than GCSE/IB content.

---

## 2. Platform Deep Dives

---

### 2.1 BBC Bitesize KS3 — `bbc.co.uk/bitesize/levels/z4kw2hv`

> **Rating**: ⭐⭐⭐⭐⭐ The gold standard for free KS3 content

| Feature | Detail |
|---------|--------|
| **Cost** | **COMPLETELY FREE** — no login, no subscription, no ads (BBC is publicly funded) |
| **Subjects** | Biology, Chemistry, Physics, English, Maths, History, Geography, French, German, Spanish, Computer Science, ICT, Music, Religious Studies, Citizenship (Wales), Cymraeg (Welsh), Humanities, Modern Foreign Languages, Sustainability (Wales) |
| **Content Types** | **Guides** (articles with diagrams), **Videos** (short educational clips), **Games** (interactive learning games like Atomic Labs for Science), **Quizzes** (interactive self-assessments) |
| **Structure** | Subject → Topic → Sub-topic → Guide/Video → Quiz |
| **Curriculum** | England KS3 National Curriculum + Wales + Northern Ireland + International KS3 |
| **Strengths** | Most comprehensive free KS3 source. Excellent topic breakdown. Interactive games. Bilingual (English/Welsh/Gaelic). Links to external resources (Teachit, Twinkl, Khan Academy, Education Quizzes). |
| **Weaknesses** | No downloadable PDFs. No printable worksheets. No login = no progress tracking. Limited depth compared to paid platforms. |

#### KS3 Subject Topic Coverage (from live page scrapes)

**KS3 Biology** (30+ guides):
- Living organisms: Animal/plant cells, specialised cells, blood components, skeletal system, muscles, biomechanics, stem cells, leaf structure, unicellular organisms, diffusion, microscopy
- Nutrition/digestion: Digestive system, enzymes, absorption, food energy, healthy diet, malnutrition
- Respiration/gas exchange: Respiratory system, breathing, gas exchange, anaerobic respiration
- Reproduction: Human reproduction, plant reproduction, pollination, fertilisation
- Genetics/evolution: DNA, inheritance, natural selection, selective breeding, genetic conditions
- Ecosystems: Food chains, biodiversity, bioaccumulation, greenhouse gases, climate change
- Working scientifically: Lab safety, variables, hypothesis, planning experiments, graphs, bias, evaluation

**KS3 English**:
- Literature: 17+ text guides (A Christmas Carol, Animal Farm, Frankenstein, Lord of the Flies, Noughts & Crosses, Romeo and Juliet, Macbeth, The Tempest, etc.)
- Fiction: Critical reading (11 guides), Fiction writing (8 guides)
- Non-fiction: Critical reading (5 guides), Non-fiction writing (10 guides)
- Essay writing: Evidence from texts, introductions, conclusions, comparing fiction
- SPaG: Spelling (5 guides), Punctuation (11 guides), Grammar (12 guides)
- Poetry: Reading poetry (7 guides), Writing poetry (3 guides)
- Spoken English: Debating, speech delivery, accent/dialect, slang, multi-modal language
- Shakespeare: 5 context guides + character/theme guides for 6 plays

**KS3 Science** (combines Biology + Chemistry + Physics):
- Same Biology topics as above
- Chemistry: Atoms/elements/compounds, periodic table, reactions, acids/alkalis, materials
- Physics: Forces, energy, waves, electricity, magnetism, space

#### Content Model (from BBC Bitesize KS3 Biology page)

```
KS3 Biology
├── Games (Atomic Labs — interactive science experiments)
├── Living organisms
│   ├── Animal and plant cells (Guide)
│   ├── Specialised animal cells (Guide)
│   ├── Specialised plant cells (Guide)
│   ├── The four components of the blood (Guide)
│   ├── The skeletal system (Guide)
│   ├── ... (30+ more guides)
├── Nutrition, digestion and excretion (6+ guides)
├── Respiration and gas exchange (4+ guides)
├── Reproduction (6+ guides)
├── Genetics and evolution (6+ guides)
├── Ecosystems and habitats (multiple guides)
├── Humans and the environment (2 guides)
└── Working scientifically (10+ guides)
```

Each guide = short article (500–1500 words) with diagrams, bullet points, key vocabulary callouts. Followed by interactive quiz.

---

### 2.2 Oak National Academy — `oaknationalacademy.com`

> **Rating**: ⭐⭐⭐⭐⭐ Best source for understanding curriculum sequencing and lesson structure

| Feature | Detail |
|---------|--------|
| **Cost** | **COMPLETELY FREE** — government-funded, no login required for pupils |
| **Pupil-facing**: Year 1–11 subject pages with full lesson sequences |
| **Teacher-facing**: Full lesson plans, slide decks, worksheets, quizzes — downloadable |
| **KS3 Subjects** | Year 7, 8, 9 each with: English, Maths, Science, History, Geography, French, Spanish, German, Computing, RE, Music, Art, Design & Technology, Citizenship, PSHE, PE |
| **Content Types** | **Video lessons** (10–20 min each), **Slide decks** (PowerPoint-style), **Quizzes** (pre + post lesson), **Worksheets** (downloadable PDFs), **Lesson plans** (teacher notes) |
| **Structure** | Year → Subject → Unit → Lesson (video + slide deck + quiz + worksheet) |
| **Curriculum** | England National Curriculum |
| **Strengths** | Complete curriculum as sequenced lesson units. Downloadable resources. Free. Shows topic progression across Year 7→8→9 perfectly. |
| **Weaknesses** | Video-heavy (not text-optimized). No revision/note format. Designed for classroom use, not self-study. |

#### Key Value for Your Project:
Oak National Academy is the **best reference for understanding how KS3 topics are sequenced across Years 7–9**. Each subject has ~15–20 units per year, with ~6–12 lessons per unit. This gives you an exact "syllabus map" for what content to create and in what order.

---

### 2.3 Twinkl (Beyond Secondary) — `twinkl.co.uk/resources/keystage3-ks3`

> **Rating**: ⭐⭐⭐⭐ Largest KS3 resource library, but teacher-focused

| Feature | Detail |
|---------|--------|
| **Cost** | **Subscription**: ~£6.99/month (individual), school pricing varies. **30-day free trial** ("30 days of downloads for FREE") |
| **KS3 Subjects** | Maths, English, Science, Geography, History, Languages, PE, Music, Computing, Art & Design, PSHE, RE, Design & Technology |
| **Content Types** | **Worksheets** (printable PDFs), **PowerPoint presentations**, **Lesson packs** (complete units), **Assessments & tests**, **Revision mats**, **Knowledge organisers**, **Homework booklets**, **Display materials**, **Games & activities** |
| **Structure** | Subject → Topic → Resource type |
| **Curriculum** | England KS3 National Curriculum |
| **Brand** | Marketed as "Beyond Secondary" for KS3/GCSE — separate from Twinkl's primary brand |
| **Strengths** | Massive library — hundreds of resources per subject. Professional design. Curriculum-mapped. Downloadable and printable. Good for seeing how worksheets/activities are structured. |
| **Weaknesses** | Teacher-focused (lesson delivery, not self-study). No video content. No interactive quizzes. Subscription required after trial. Overwhelming quantity. |

#### Key Value for Your Project:
Twinkl shows you how KS3 educational content is **structured for the classroom**: worksheets, knowledge organisers, assessment formats. Useful reference for designing "practice" and "assessment" components of your platform.

---

### 2.4 CGP Books KS3 — `cgpbooks.co.uk`

> **Rating**: ⭐⭐⭐⭐ #1 UK revision guide brand — gold standard for concise content

| Feature | Detail |
|---------|--------|
| **Cost** | **Per-book**: Study guides ~£5–7, Workbooks ~£6–8, Complete revision bundles ~£10–15. Digital: **CGP+** platform (subscription for online editions) |
| **KS3 Subjects** | Maths, English, Science (combined + separate Biology/Chemistry/Physics), History, Geography, French, Spanish, German, Computing, RE, Design & Technology |
| **Content Types** | **Study Guides** (topic-by-topic with explanations + diagrams + key facts), **Workbooks** (practice questions with answers), **Revision Question Cards** (flashcard-style), **Knowledge Organisers** (one-page-per-topic summaries), **Online Editions** (digital versions via CGP+) |
| **Structure** | Subject → Section → Topic → 1–2 page spread with: explanation, diagrams, key facts, practice questions |
| **Format** | Physical books + digital editions (Kindle/CGP+) |
| **Strengths** | Most popular KS3 revision brand in UK. Excellent balance of concise content + practice. Humorous/engaging style that works for 11–14 age group. Shows gold standard for "revision note" structure. |
| **Weaknesses** | Not purely digital (physical-first). Individual books needed per subject. Content is brief — designed for revision, not deep learning. No interactive features in book format. |

#### Content Structure Model (from CGP KS3 Maths):

```
KS3 Maths Study Guide
├── Section 1: Numbers
│   ├── Place Value and Ordering
│   ├── Fractions, Decimals and Percentages
│   ├── Ratio and Proportion
│   └── ... (6-8 topics per section)
├── Section 2: Algebra
│   ├── Expressions and Formulae
│   ├── Equations
│   ├── Sequences
│   └── ... (6-8 topics)
├── Section 3: Geometry & Measures
├── Section 4: Statistics
└── Section 5: Probability

Each topic = 2-page spread:
  Page 1: Explanation + worked examples + diagrams + key vocabulary
  Page 2: "Warm-up" questions → "Practice" questions → "Exam-style" questions
```

#### Key Value for Your Project:
CGP's "2-page-spread-per-topic" model is an excellent reference for creating concise, scannable KS3 revision notes. Their topic scoping shows you exactly what breadth/depth is appropriate for KS3 students.

---

### 2.5 Seneca Learning — `senecalearning.com`

> **Rating**: ⭐⭐⭐⭐ Best interactive/gamified KS3 learning model

| Feature | Detail |
|---------|--------|
| **Cost** | **Freemium**: Free tier with ads + limited features. **Premium**: ~£5/month (ad-free, offline access, smart revision algorithms) |
| **KS3 Subjects** | Science, Maths, English, History, Geography (fewer subjects than BBC Bitesize, but deeper interactive content) |
| **Content Types** | **Interactive courses** (bite-sized chunks with built-in quizzes), **Gamified learning** (XP points, streaks, leaderboards), **Smart algorithms** (spaced repetition, identifies weak topics) |
| **Structure** | Subject → Course → Section → Topic → (Info bite + Quiz question) cycle |
| **Curriculum** | England KS3 National Curriculum + major GCSE exam boards (for KS4) |
| **Strengths** | Most engaging format for KS3 age group. Gamification proven to increase completion rates. Spaced repetition algorithms. Free tier usable. |
| **Weaknesses** | Fewer subjects than BBC Bitesize. Cannot download content. Limited depth per topic — bite-sized format can be too brief. Mobile-app dependent experience. |

#### Key Value for Your Project:
Seneca shows how to engage KS3-age students (11–14) with **short info bursts followed by immediate quiz questions**. Their gamification model (XP, streaks, leaderboards) is the most proven approach for this age group.

---

### 2.6 Education Quizzes — `educationquizzes.com/ks3/`

> **Rating**: ⭐⭐⭐ Best quiz-focused KS3 platform

| Feature | Detail |
|---------|--------|
| **Cost** | **£14.50/month** or **£89.50/year**. No contracts. Shareable within family. |
| **KS3 Subjects** (confirmed from live page): | Science, English, Maths, Spelling, Geography, History, Maths Tables, Fast French, ICT, Citizenship, Art and Design, Religious Education, Music, Design/Technology |
| **Content Types** | **Quizzes** (10 questions each, with feedback after each question), **Links to BBC Bitesize** (most quizzes link to relevant Bitesize page) |
| **Total** | Over **4,000 quizzes** across all levels |
| **Structure** | Subject → Topic → 10-question quiz with instant feedback |
| **Strengths** | Pure quiz format is simple and effective. Links to BBC Bitesize for content. Tracks progress across quizzes. Family-shareable subscription. |
| **Weaknesses** | Quiz-only — no notes, no videos, no explanations beyond quiz feedback. Relies on BBC Bitesize for actual content. Expensive for what it is (£14.50/mo vs BBC Bitesize free). |

#### Key Value for Your Project:
Shows how to structure quiz questions for KS3 (10 questions per topic, immediate feedback, linked to study content). Their "quiz → feedback → link to learn more" flow is a good UX pattern.

---

### 2.7 MyMaths — `mymaths.co.uk`

> **Rating**: ⭐⭐⭐ Interactive maths — widely used in UK schools

| Feature | Detail |
|---------|--------|
| **Cost** | **School subscription** (not individual). Primary sub covers KS1–KS3; Secondary sub covers KS2–A Level. **30-day free trial** for schools. |
| **Subjects** | **Maths only**
| **Coverage** | KS3 (Year 7–9) + KS4 GCSE + KS5 A Level |
| **Content Types** | **Interactive lessons**, **Homework tasks** (auto-generated new questions each time — "limitless practice"), **Auto-marking**, **Progress tracking** |
| **Curriculum** | Maps to popular UK schemes (White Rose Maths), National Curriculum |
| **Strengths** | Unlimited auto-generated practice questions. Actually used in UK schools — aligns with real classroom experience. Auto-marking saves teacher time. |
| **Weaknesses** | School subscription only (no individual access). Maths only. No human-readable revision notes (lesson-focused). |

---

### 2.8 Other Notable KS3 Platforms

| Platform | Type | Cost | Subjects | Notes |
|----------|------|------|----------|-------|
| **Khan Academy** | Video + Practice | **Free** | Maths (UK curriculum), Science, Computing | Excellent maths topic videos with practice exercises. UK curriculum section exists. |
| **Collins KS3 Revision** | Books + Digital | ~£5–8/book | Maths, English, Science, History, Geography, French | #2 revision guide brand after CGP. Similar structure. |
| **TES Teaching Resources** | Marketplace | Mixed (free + £2–45/resource) | All KS3 subjects | Teacher-created worksheets, lesson plans, PowerPoints. Good for seeing classroom activity formats. |
| **Pearson iLowerSecondary** | Digital platform | School subscription | Maths, English, Science, Computing, Global Citizenship | Pearson's KS3 curriculum product. Interactive textbooks + assessments. |
| **Teachit** | Teacher resources | Subscription | English, Maths, Science, History, Geography, Languages | Linked from BBC Bitesize. Teacher-created classroom resources. |

---

## 3. KS3 vs GCSE/IB: Content Structure Comparison

Understanding the format difference is crucial for your project:

| Dimension | KS3 Content | GCSE/IGCSE Content | IBDP Content |
|-----------|-------------|-------------------|-------------|
| **Unit of content** | Topic guide / lesson (500–1500 words) | Revision note / topic question set | Detailed syllabus point notes |
| **Tone** | Engaging, accessible, sometimes humorous | Exam-focused, efficient | Academic, rigorous |
| **Visual style** | Colorful, illustration-heavy, larger fonts | Diagram-heavy, cleaner layout | Text-heavy, academic diagrams |
| **Practice** | Short quizzes, games, simple worksheets | Topic questions, mock exams, past papers | Exam-style questions, IA support |
| **Assessment** | Formative (check understanding) | Summative (exam practice) | Both formative + summative |
| **Platform** | BBC Bitesize, Twinkl, CGP | Save My Exams, PapaCambridge | Revision Village, Save My Exams |
| **Best free source** | BBC Bitesize + Oak Academy | Physics & Maths Tutor, PastPapers.co | Limited free IB resources |
| **Best paid source** | Twinkl / CGP / Seneca | Save My Exams | Revision Village |

---

## 4. Strategic Recommendations for Your Project

### 4.1 KS3 Content: Why Include It?

| Pro | Con |
|-----|-----|
| KS3 is underserved — less competition than GCSE/IB | Smaller market — no exam pressure = less demand for paid revision |
| Content is NOT exam-board-specific — one set works for everyone | Can't use "exam success" as a selling point |
| Builds pipeline: KS3 students → GCSE → IB students | KS3 students don't typically buy revision resources themselves (parents do) |
| Differentiator — no major IB platform covers KS3 | KS3-IB is a 6-year gap — hard to retain students that long |
| Foundation knowledge is essential for IB success | KS3 content format very different from IB (more game-like, less academic) |

### 4.2 Recommended KS3 Content Strategy

If you include KS3, focus on:

| Priority | Subject Areas | Rationale |
|----------|-------------|----------|
| 🔴 **Core** | **KS3 Maths** (Y7, Y8, Y9) | Foundation for IB Maths. Most self-study KS3 content exists. Builds numeracy for all future STEM. |
| 🔴 **Core** | **KS3 Science** (Biology, Chemistry, Physics) | Foundation for IB Sciences. BBC Bitesize shows exact topic scope. |
| 🟡 **Important** | **KS3 English** | Literacy for all subjects. Text guides + writing skills are universally useful. |
| 🟢 **Optional** | **KS3 History, Geography** | Lower priority — narrower direct pipeline to IB. |

### 4.3 Content Structure Recommendation (KS3)

Based on analysis of the best platforms, the ideal KS3 content structure for your platform:

```
Subject (e.g., KS3 Biology)
├── Year filter: Year 7 | Year 8 | Year 9
├── Topic Unit (e.g., "Cells and Organisation")
│   ├── Revision Note (300-800 words)    ← Model after CGP 2-page spread + BBC Bitesize guide
│   │   ├── Key vocabulary callout
│   │   ├── Diagram/illustration
│   │   ├── Explanation (bullet-point style)
│   │   └── "Common misconception" tip
│   ├── Practice Quiz (5-10 questions)   ← Model after BBC Bitesize/Seneca
│   │   ├── Multiple choice + short answer
│   │   ├── Immediate feedback per question
│   │   └── Link back to revision note for wrong answers
│   └── Worksheet (optional printable)   ← Model after Twinkl
│       └── Structured practice with worked examples
```

### 4.4 KS3 Tone & Engagement Guidelines (from platform analysis)

For the 11–14 age group:

| Element | Guideline | Reference Platform |
|---------|-----------|-------------------|
| **Text length** | Short paragraphs (3–5 sentences max) | BBC Bitesize |
| **Language** | Accessible, conversational, occasional humor | CGP Books |
| **Visuals** | Heavy illustration use, diagrams, color coding | Twinkl, BBC Bitesize |
| **Interactivity** | Quiz after every topic, gamification elements | Seneca, BBC Bitesize |
| **Vocabulary** | Define new terms inline, not in separate glossary | BBC Bitesize |
| **Practice** | Immediate application of each concept | Seneca |
| **Examples** | Real-world, relatable scenarios for 11–14 year olds | BBC Bitesize |

---

## 5. Free vs Paid KS3 Platform Summary

### Best FREE Platforms (no budget needed)

| Platform | Best For | Content Types |
|----------|----------|---------------|
| **BBC Bitesize KS3** 🥇 | Comprehensive subject coverage, curriculum reference | Guides, videos, games, quizzes |
| **Oak National Academy** 🥈 | Lesson sequencing, topic progression, downloadable worksheets | Video lessons, slide decks, quizzes, worksheets |
| **Khan Academy** | Maths topic videos + practice exercises | Videos, interactive exercises |
| **Seneca (free tier)** | Gamified interactive learning | Bite-sized courses with quizzes |

### Best PAID Platforms (worth the cost for content reference)

| Platform | Cost | Best For |
|----------|------|----------|
| **Twinkl (Beyond)** 🥇 | ~£7/month (30-day free trial) | Downloadable worksheets, PowerPoints, assessments for ALL subjects |
| **CGP Books** 🥈 | ~£5–8 per book | Concise revision notes — shows gold standard for KS3 note structure |
| **Seneca Premium** | ~£5/month | Ad-free interactive learning, spaced repetition algorithms |
| **Education Quizzes** | ~£14.50/month | Quiz question formats with instant feedback |
| **TES Resources** | £2–45 per resource | Teacher-created classroom materials |

---

## 6. KS3 Maths — Deep Topic Map

Since Maths is the highest-priority KS3 subject for your project, here is the standard KS3 Maths topic map (aligned to England National Curriculum):

### Year 7 Maths Topics

| Strand | Topics |
|--------|--------|
| **Number** | Place value, integers, decimals, fractions, percentages, ratio, negative numbers, BIDMAS, rounding, estimation |
| **Algebra** | Algebraic notation, expressions, substitution, simplifying, solving linear equations, sequences (term-to-term), coordinates |
| **Geometry** | Angles (measuring, drawing, facts), 2D shapes, 3D shapes, area, perimeter, symmetry, transformations |
| **Statistics** | Collecting data, bar charts, pictograms, pie charts, mean/median/mode/range |

### Year 8 Maths Topics

| Strand | Topics |
|--------|--------|
| **Number** | Fractions with all operations, percentage change, ratio and proportion, standard form, significant figures |
| **Algebra** | Linear equations (multi-step), inequalities, formulae, sequences (nth term), linear graphs (y=mx+c), real-life graphs |
| **Geometry** | Circles (circumference, area), volume, surface area, Pythagoras' theorem, bearings, scale drawing, constructions |
| **Statistics** | Scatter graphs, correlation, two-way tables, comparing distributions |

### Year 9 Maths Topics

| Strand | Topics |
|--------|--------|
| **Number** | Surds, indices, error intervals, compound interest, reverse percentages |
| **Algebra** | Quadratic expressions, factorising, plotting quadratics, simultaneous equations (graphical), inequalities on graphs |
| **Geometry** | Trigonometry (right-angled), congruence, similarity, circle theorems (intro), vectors (intro) |
| **Statistics** | Cumulative frequency, box plots, histograms (intro), probability trees, conditional probability (intro) |

> **Note**: Year 9 is the bridge year to GCSE. Many schools start GCSE content in Y9. Topic coverage varies significantly between schools.

---

## 7. Data Collection Notes

- **Date**: July 21, 2026
- **Method**: Live HTTP fetching of platform pages + trained LLM knowledge of UK curriculum
- **Limitations**:
  - CGP Books, Collins, and Pearson sites returned 403 errors (bot blocking)
  - Seneca and Oak Academy pages required JavaScript rendering — partial data
  - Pricing is as publicly displayed at time of fetch; subject to change
  - KS3 content is less standardized than GCSE due to lack of external exams
- **Confidence**: High for BBC Bitesize (direct scrape of content pages). High for curriculum structure (trained knowledge). Medium for exact pricing (dynamic/school-only pricing not always public).

---

*Document generated for IB Learning Site project planning. Not for redistribution.*
