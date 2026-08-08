# BBC Bitesize KS3 — Content Scraping Plan

> **Date**: 2026-07-21  
> **Status**: Plan drafted, awaiting decision on approach  
> **Prerequisite**: Change BBC password (credentials were shared in chat)

---

## What We Have Already

| Document | Content |
|----------|---------|
| `bbc-bitesize-ks3-full-topic-maps_deepseek_v4_pro.md` (736 lines) | Complete topic trees for 9 KS3 subjects with every guide title, description, and guide count. Platform structure, guide format, games catalog. |
| `ks3-content-platforms-analysis_deepseek_v4_pro.md` (421 lines) | Analysis of 12+ KS3 platforms beyond BBC Bitesize (Twinkl, CGP, Seneca, Oak Academy, etc.) |

**What's missing**: Actual guide content (text, quiz questions, vocabulary, diagrams). Only topic maps were captured — individual guide pages are JavaScript-rendered and inaccessible to HTTP fetch.

---

## Technical Challenge

BBC Bitesize is a **React SPA** — content is NOT server-rendered HTML:

| What | Why standard HTTP fetch fails |
|------|-------------------------------|
| Authentication | BBC Account uses OAuth/OIDC with JS form submission, CSRF tokens, redirects |
| Guide pages | Content loaded dynamically from API after React renders; initial HTML is an empty shell |
| Individual URLs | `/bitesize/articles/{id}` and `/bitesize/guides/{id}/revision/1` return 404 without the JS app |
| API endpoints | Likely use CORS and require BBC-origin referrer headers |

**Note**: BBC Bitesize content is completely public — no login needed. Login is only for "My Bitesize" (bookmarks/progress). Credentials are not required for scraping.

---

## Option A: Playwright Browser Automation (RECOMMENDED)

### Approach

Use Playwright (headless Chromium) to traverse the BBC Bitesize KS3 section programmatically:

```
Phase 1 — Collect guide URLs
  For each KS3 subject:
    1. Navigate to subject page (e.g., /bitesize/subjects/z4882hv)
    2. Wait for React to render guide list
    3. Extract all guide links from the DOM
    4. Store in a URL map

Phase 2 — Scrape guide content
  For each guide URL:
    1. Navigate to guide page
    2. Wait for content to render (networkidle or selector)
    3. Extract:
       - Title
       - Key points (bullet summary at top)
       - All section headings + text content
       - Key vocabulary terms (bolded words with definitions)
       - Quiz questions (MCQ stem + 4 options + correct answer)
       - Related guide links
    4. Save as structured JSON
    5. Rate-limit: 2-3 seconds between requests

Phase 3 — Structure and validate
    1. Organise JSONs by subject > topic > guide
    2. Validate completeness (check all expected guides were captured)
    3. Generate summary report
```

### Estimated Scope

| Subject | Estimated Guides | Est. Time (2s/guide) |
|---------|:---:|:---:|
| Biology | 50 | ~2 min |
| Chemistry | ~25 | ~1 min |
| Physics | ~25 | ~1 min |
| Maths | 130 | ~5 min |
| English | 138 | ~5 min |
| History | 70 | ~3 min |
| Geography | 60 | ~2 min |
| Computer Science | 30 | ~1 min |
| French | 17 | ~1 min |
| Spanish | 17 | ~1 min |
| RE | 20 | ~1 min |
| **TOTAL** | **~582** | **~25 minutes** |

### Output

```
scraped-content/
├── biology/
│   ├── living-organisms/
│   │   ├── animal-and-plant-cells.json
│   │   ├── specialised-animal-cells.json
│   │   └── ...
│   └── ...
├── maths/
│   ├── number/
│   │   ├── place-value.json
│   │   └── ...
│   └── ...
├── english/
├── history/
├── geography/
├── computer-science/
├── french/
├── spanish/
├── re/
└── summary.json
```

### JSON Schema per Guide

```json
{
  "subject": "Biology",
  "topic": "Living Organisms",
  "title": "Animal and plant cells",
  "url": "https://www.bbc.co.uk/bitesize/articles/xxx",
  "key_points": ["...", "...", "..."],
  "sections": [
    {
      "heading": "What are cells?",
      "content": ["paragraph text...", "..."],
      "key_facts": ["..."],
      "vocabulary": [{"term": "nucleus", "definition": "..."}]
    }
  ],
  "quiz": [
    {
      "question": "What is the function of the nucleus?",
      "options": ["...", "...", "...", "..."],
      "correct_index": 0
    }
  ],
  "related_guides": ["Specialised animal cells", "Specialised plant cells"]
}
```

### Technology Stack

- **Playwright** (Node.js) — `npm install playwright`
- **Chromium** (bundled with Playwright)
- Run locally on macOS via `node scrape-bbc-ks3.mjs`

### Key Considerations

- **Rate limiting**: Space requests 2-3 seconds apart to avoid BBC rate limiting/blocking
- **Resilience**: Add retry logic (3 attempts with exponential backoff) for failed pages
- **Resume capability**: Save progress after each guide, allow restart from last saved
- **Selector stability**: BBC may change DOM structure; use resilient selectors with fallbacks
- **Content copyright**: Scraped content is BBC copyright. Use for internal reference only. Do NOT republish verbatim.

---

## Option B: Reverse-Engineer BBC Bitesize API

### Approach

1. Open BBC Bitesize in Chrome with DevTools Network tab open
2. Navigate to any KS3 guide (e.g., "Animal and plant cells")
3. Identify the XHR/Fetch requests that return guide content
4. Determine the API endpoint pattern
5. Call API directly with curl/Node.js (bypassing browser automation)

### Pros
- Much faster than browser automation
- Returns structured JSON directly (no HTML parsing needed)
- Lower bandwidth and resource usage

### Cons
- API may require BBC-origin Referer headers
- API may change without notice
- Less transparent than browser automation
- Still requires a manual investigation step first

### Investigation Needed
```
Manual step (do in Chrome):
1. Open DevTools > Network tab
2. Filter by XHR/Fetch
3. Navigate to: bbc.co.uk/bitesize/articles/{any-article-id}
4. Find the API call that returns guide text
5. Note: endpoint URL, request method, headers, response structure
```

---

## Option C: Stick With Topic Maps + Original Content

### Approach

Use the topic maps already captured as curriculum blueprint, create original content:

- **Topic maps** → Define what topics to cover (already done)
- **BBC Bitesize guide structure** → Model for your note format (already documented)
- **Original writing** → Write your own revision notes and quizzes from scratch

### Pros
- No scraping complexity
- No copyright concerns
- Content is 100% original and ownable
- Faster to start creating value

### Cons
- Less reference material for content writers
- Harder to ensure curriculum completeness without seeing all guide content
- More effort to create 500+ guides from scratch

---

## Recommendation

**Option A (Playwright scraping) is recommended** as the primary approach:
- Most reliable for JS-rendered content
- Complete extraction (all text, quizzes, vocabulary)
- Structured JSON output ready for reference
- ~25 minutes runtime for all 582 guides

**Fallback**: If Playwright proves difficult, Option C (original content from topic maps) is the pragmatic alternative.

**Option B** (API reverse-engineering) requires a manual investigation first — can be explored in parallel.

---

## Next Steps (Resume Tomorrow)

1. [ ] **Change BBC password** (credentials leaked in chat)
2. [ ] **Decide approach**: Playwright script vs. API investigation vs. topic maps only
3. [ ] **If Playwright**: Write `scrape-bbc-ks3.mjs` script and run locally
4. [ ] **If API**: Open BBC Bitesize in Chrome, inspect Network tab, identify content API
5. [ ] **Either way**: Document findings and feed into content creation pipeline

---

## Files Created This Session

| File | Lines | Content |
|------|:-----:|---------|
| `content-resource-platforms-analysis_deepseek_v4_pro.md` | 428 | Save My Exams, PapaCambridge, Revision Village deep dive |
| `ks3-content-platforms-analysis_deepseek_v4_pro.md` | 421 | KS3 platform landscape (12+ platforms) |
| `bbc-bitesize-ks3-full-topic-maps_deepseek_v4_pro.md` | 736 | BBC Bitesize KS3 complete topic trees (9 subjects) |
| `bbc-bitesize-scraping-plan_deepseek_v4_pro.md` | ⬅️ this file | Scraping plan |
