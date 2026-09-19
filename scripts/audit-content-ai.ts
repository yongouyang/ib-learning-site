/**
 * AI-judged content audit (docs/content-backlog-review.md §2.D).
 *
 * Two classes of content defect that no deterministic gate can see, because both are
 * semantic judgements rather than shape checks:
 *
 *   1. `--mode=markscheme` — a markscheme point that credits the SAME work as another
 *      point, so one student action earns two ticks. `docs/CONTENT_STYLE.md` "Practice
 *      papers" requires "points must be independently awardable (no double-counting)".
 *      The only thing enforced today is `marks === markscheme.length`.
 *   2. `--mode=answerkey` — an MC question with a SECOND defensible correct answer.
 *      `correctIndex` is only range-checked 0-3 (src/content/schema.ts:56), so a second
 *      right answer is invisible to every gate — and it is the defect that actually
 *      harms a student.
 *
 * Offline QA only: no Lambda, no student request path, no deploy (AGENTS.md "TypeSafe /
 * Jev"). Credentials come from ~/.config/typesafe/env (TYPESAFE_API_KEY,
 * TYPESAFE_BASE_URL); source that file first — the npm scripts below do not do it for you:
 *
 *   set -a && . ~/.config/typesafe/env && set +a
 *   npm run audit:ai:markschemes                 # whole corpus (233 FR questions)
 *   npm run audit:ai:markschemes -- --limit=6    # calibration slice
 *   npm run audit:ai:answerkeys -- --sample=90   # MC sample (overrides the 30 default)
 *   npx tsx scripts/audit-content-ai.ts --selftest   # harness self-check (live API)
 *
 * The report lands in tools/data/ai-audit/ (gitignored) — it is a working artefact, and
 * the counts that matter are recorded in PROGRESS.md.
 *
 * MEASURED SCOPE (2026-09-19, model jev-1.13.0 — read this before trusting an output):
 *
 *   --mode=markscheme   USABLE. The judgement is semantic (does this point credit the same
 *                       work as another?) and needs no arithmetic. Whole corpus: 231
 *                       questions / 580 points -> 1 candidate, hand-triaged as adjacency
 *                       rather than a defect. Clean cases score 0.07-0.11, a deliberately
 *                       planted duplicate 0.56-0.59, so 0.5 sits in an empty band.
 *   --mode=answerkey    NOT USABLE ON COMPUTATIONAL QUESTIONS. 90-question sample: 13
 *                       findings across 9 questions, and EVERY finding was a maths
 *                       question (9 of 35 sampled maths questions) — while all 55 sampled
 *                       questions in the other nine subjects were clean. All nine were
 *                       hand-checked and every key was CORRECT: the model fails the
 *                       arithmetic and then calls a distractor right (or the key wrong).
 *                       This is AGENTS.md's standing rule — "Jev is not a calculator...
 *                       it does not count reliably". Use this mode for conceptual/verbal
 *                       questions only (where the keys scored 0.94-0.99 and the best
 *                       distractor <= 0.14); correctness of a numeric response needs exact
 *                       recomputation, not a judgement.
 *
 * Corollary, and the reason this is a script and not a gate: a flag is a prompt to read the
 * content, never a verdict. The score is not a severity measure either — the planted
 * duplicate and a merely-adjacent real markscheme both land near 0.57, so the number says
 * "I see overlap", and a human decides whether it matters.
 */
import fs from 'fs';
import path from 'path';
import { paperSchema, topicSchema } from '../src/content/schema';

// --- pinned model -------------------------------------------------------------------
// Pinned on purpose: 'jev-latest' is an alias and will move. The report records the model
// the API actually served, so a run is always attributable to a version.
const MODEL = process.env.TYPESAFE_AUDIT_MODEL ?? 'jev-1.13.0';

const DATA_DIR = path.join(process.cwd(), 'src/content/data');
const PAPERS_DIR = path.join(DATA_DIR, 'papers');
const TOPICS_DIR = path.join(DATA_DIR, 'topics');
const REPORT_DIR = path.join(process.cwd(), 'tools/data/ai-audit');

// Policy thresholds — code owns policy, not the model. Measured drift on the answer-key
// judgement is <= 0.02 with correct options at 0.87-0.99 and the best distractor at
// 0.02-0.15 (docs/typesafe-ai-reviewed.md §8.1), so 0.5 sits in a wide empty band.
const DEFAULT_THRESHOLD = 0.5;

// --- types --------------------------------------------------------------------------
export interface PaperQuestion {
  id: string;
  stem: string;
  marks: number;
  markscheme: string[];
  modelAnswer: string;
  difficulty?: string;
}

export interface McQuestion {
  id: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: string;
}

export interface Answers {
  [questionId: string]: { type: string; noul?: number; choice?: string };
}

/** The injectable seam (AGENTS.md: external dependencies get a controllable dummy). */
export type Judge = (state: unknown, questions: Record<string, unknown>) => Promise<Answers>;

export interface Finding {
  /** Content id this finding belongs to (question id). */
  id: string;
  kind: 'possible-double-count' | 'key-below-threshold' | 'second-correct-answer';
  label: string;
  detail: string;
  score: number;
}

// --- markscheme judgement -----------------------------------------------------------
// Markscheme type prefixes (docs/CONTENT_STYLE.md "Practice papers"): M = method,
// A = accuracy (DELIBERATELY depends on a method mark), B = independent fact/content.
const TYPE_PREFIX_RE = /^\s*(M|A|B)\d*\s*[:.]/;

export function markPrefix(point: string): string {
  const m = point.match(TYPE_PREFIX_RE);
  return m ? m[1] : '?';
}

/**
 * One request per free-response question: a Noul per markscheme point asking whether the
 * point duplicates another point's work.
 *
 * The instruction wording is load-bearing and was fixed by calibration. A first version
 * asked "is this point redundant given the others?" and scored a clean, correct 2-mark
 * markscheme at 0.35 / 0.55 — it read the rubric's intended A-depends-on-M relation as
 * redundancy. The convention is therefore stated in `state` and the criteria exclude it
 * explicitly; `--selftest` pins both behaviours so the wording cannot silently regress.
 *
 * Self-contained on purpose: the point text is quoted in the instruction rather than
 * referenced by JSON index, so there is no 0-based/1-based ambiguity between prose and
 * the array it points at.
 */
export function buildMarkschemeRequest(q: PaperQuestion): {
  state: unknown;
  questions: Record<string, unknown>;
} | null {
  const points = q.markscheme;
  // A single point cannot double-count anything.
  if (points.length < 2) return null;

  const state = {
    question: { stem: q.stem, marks: q.marks, modelAnswer: q.modelAnswer },
    markscheme: points.map((text, i) => ({ point: i + 1, type: markPrefix(text), text })),
    markingConvention:
      'Each markscheme point is exactly one tickable mark, so this question is worth ' +
      `${q.marks} marks in total. M = method, A = accuracy, B = an independent fact or ` +
      'content point. An accuracy (A) mark normally FOLLOWS and DEPENDS ON a method (M) ' +
      'mark — that dependency is intended and is NOT double-counting. Double-counting ' +
      'means two points that credit the same single piece of work, so that one action by ' +
      'the student earns two separate ticks.',
  };

  const questions: Record<string, unknown> = {};
  points.forEach((text, i) => {
    questions[`point_${i + 1}`] = {
      type: 'noul',
      instructions:
        `Markscheme point #${i + 1} of ${points.length} is: "${text}". ` +
        'Does this point credit the SAME single piece of work as another point in this ' +
        'markscheme, so that one action by the student would earn two separate ticks?',
      criteria: {
        true:
          'Another point already credits this same work — awarding both gives two marks ' +
          'for one step.',
        false:
          'No other point credits this work. It may still depend on another point (an ' +
          'accuracy mark following a method mark is expected and is NOT a duplicate).',
      },
    };
  });
  return { state, questions };
}

export function evaluateMarkscheme(
  q: PaperQuestion,
  answers: Answers,
  threshold = DEFAULT_THRESHOLD,
): Finding[] {
  const findings: Finding[] = [];
  q.markscheme.forEach((text, i) => {
    const a = answers[`point_${i + 1}`];
    if (!a || typeof a.noul !== 'number') return;
    if (a.noul >= threshold) {
      findings.push({
        id: q.id,
        kind: 'possible-double-count',
        label: `point #${i + 1} (${markPrefix(text)})`,
        detail: text,
        score: a.noul,
      });
    }
  });
  return findings;
}

// --- answer-key judgement -----------------------------------------------------------
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

/**
 * One Noul per choice: "is this choice a correct answer to the question?"
 *
 * `correctIndex` and `explanation` are DELIBERATELY excluded from state. The explanation
 * normally states which option is right and why, so including it would hand the model the
 * key and anchor every other judgement (AGENTS.md: verify the input before diagnosing the
 * model). tests/unit/audit-content-ai.test.ts pins both exclusions.
 *
 * Instructions stay subject-neutral ("correct answer", never "mathematically correct"):
 * the 2026-09-17 calibration failure was exactly that, on an English dialogue question.
 */
export function buildAnswerKeyRequest(
  q: McQuestion,
  topic: { title: string; subjectId: string; stage: string } | null,
): { state: unknown; questions: Record<string, unknown> } {
  const state = {
    topic: topic ? { title: topic.title, subject: topic.subjectId, stage: topic.stage } : null,
    question: {
      stem: q.stem,
      choices: q.choices.map((c, i) => `${CHOICE_LETTERS[i]}: ${c}`),
    },
  };
  const questions: Record<string, unknown> = {};
  q.choices.forEach((choice, i) => {
    questions[`choice_${i}`] = {
      type: 'noul',
      instructions:
        `Is choice ${CHOICE_LETTERS[i]} ("${choice}") a correct answer to this question?`,
      criteria: {
        true: 'A student choosing this option would be right: it answers the question correctly.',
        false: 'This option does not correctly answer the question.',
      },
    };
  });
  return { state, questions };
}

/**
 * Policy, and it is asymmetric on purpose: a second choice above threshold is a
 * question-quality defect to report; NO choice above threshold means a student cannot
 * answer at all, which outranks it.
 */
export function evaluateAnswerKey(
  q: McQuestion,
  answers: Answers,
  threshold = DEFAULT_THRESHOLD,
): Finding[] {
  const findings: Finding[] = [];
  const scores = q.choices.map((_, i) => answers[`choice_${i}`]?.noul);
  const key = scores[q.correctIndex];
  if (typeof key === 'number' && key < threshold) {
    findings.push({
      id: q.id,
      kind: 'key-below-threshold',
      label: `keyed choice ${CHOICE_LETTERS[q.correctIndex]}`,
      detail: q.stem,
      score: key,
    });
  }
  q.choices.forEach((choice, i) => {
    if (i === q.correctIndex) return;
    const s = scores[i];
    if (typeof s === 'number' && s >= threshold) {
      findings.push({
        id: q.id,
        kind: 'second-correct-answer',
        label: `choice ${CHOICE_LETTERS[i]}`,
        detail: choice,
        score: s,
      });
    }
  });
  return findings;
}

// --- transport ----------------------------------------------------------------------
export function makeJudge(opts: { log?: (msg: string) => void; onModel?: (m: string) => void } = {}): Judge {
  const base = process.env.TYPESAFE_BASE_URL;
  const key = process.env.TYPESAFE_API_KEY;
  if (!base || !key) {
    throw new Error(
      'TYPESAFE_BASE_URL / TYPESAFE_API_KEY are unset — source ~/.config/typesafe/env first',
    );
  }
  return async (state, questions) => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Only transport failures and 429/5xx retry. A malformed response or a bug in the
      // caller must surface immediately instead of being retried — a retry loop that
      // swallows real errors is how a harness bug reads as model noise.
      let res: Response;
      try {
        res = await fetch(`${base}/v1/systemone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, model: MODEL, questions }),
        });
      } catch (err) {
        lastErr = err;
        opts.log?.(`  retry ${attempt}/3 (transport): ${String(err).slice(0, 120)}`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        lastErr = new Error(`${res.status} ${body}`);
        if (res.status < 500 && res.status !== 429) throw lastErr;
        opts.log?.(`  retry ${attempt}/3 (${res.status}): ${body.slice(0, 120)}`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      const body = (await res.json()) as { model: string; answers: Answers };
      opts.onModel?.(body.model);
      return body.answers;
    }
    throw lastErr;
  };
}

// --- content loading ----------------------------------------------------------------
export function loadPaperQuestions(): PaperQuestion[] {
  const out: PaperQuestion[] = [];
  for (const course of fs.readdirSync(PAPERS_DIR)) {
    const dir = path.join(PAPERS_DIR, course);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const paper = paperSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
      out.push(...paper.questions);
    }
  }
  return out;
}

export function loadMcQuestions(): (McQuestion & { topic: { title: string; subjectId: string; stage: string } })[] {
  const out: (McQuestion & { topic: { title: string; subjectId: string; stage: string } })[] = [];
  for (const subject of fs.readdirSync(TOPICS_DIR)) {
    const dir = path.join(TOPICS_DIR, subject);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'order.json')) {
      const topic = topicSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
      for (const q of topic.questions) {
        out.push({
          ...q,
          topic: { title: topic.title, subjectId: topic.subjectId, stage: topic.stage },
        });
      }
    }
  }
  return out;
}

/** Deterministic spread across the corpus (no RNG: a sample must be reproducible). */
export function sampleEvenly<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

// --- harness self-check (live API, known answers) -----------------------------------
// Fixtures with expected verdicts. The first one is the regression case for the harness
// bug found during calibration: a clean method+accuracy pair must NOT be flagged.
interface Fixture {
  name: string;
  question: PaperQuestion;
  expect: 'clean' | 'duplicate';
}

export const FIXTURES: Fixture[] = [
  {
    name: 'clean method + accuracy (real content)',
    expect: 'clean',
    question: {
      id: 'fixture-clean',
      stem: 'Work out $\\dfrac{2}{5} + \\dfrac{1}{4}$. Give your answer as a single fraction in its simplest form.',
      marks: 2,
      markscheme: [
        'M1: common denominator 20 with both fractions converted ($\\dfrac{8}{20}$ and $\\dfrac{5}{20}$ seen)',
        'A1: $\\dfrac{13}{20}$',
      ],
      modelAnswer:
        'The lowest common denominator is 20, so 2/5 = 8/20 and 1/4 = 5/20. Adding: 13/20, already in simplest form.',
    },
  },
  {
    name: 'planted duplicate (one insight, two ticks)',
    expect: 'duplicate',
    question: {
      id: 'fixture-duplicate',
      stem: 'Find the length $BC$ in triangle $ABC$ where $AB = 8$, $AC = 10$ and angle $A = 60\\degree$.',
      marks: 2,
      markscheme: [
        'M1: uses the cosine rule with the two sides and the included angle',
        'M1: applies $a^2 = b^2 + c^2 - 2bc\\cos A$ to this triangle',
      ],
      modelAnswer: 'By the cosine rule, $BC = \\sqrt{8^2 + 10^2 - 2(8)(10)\\cos 60\\degree}$.',
    },
  },
  {
    name: 'clean independent content points (B marks)',
    expect: 'clean',
    question: {
      id: 'fixture-clean-b',
      stem: 'Explain two ways the writer creates a sense of unease in the passage.',
      marks: 2,
      markscheme: [
        'B1: identifies the writer\u2019s use of short, clipped sentences at the moment of the discovery',
        'B1: identifies the shift to the present tense in the final paragraph',
      ],
      modelAnswer:
        'The writer uses short, clipped sentences at the discovery, and shifts to the present tense in the final paragraph.',
    },
  },
];

// --- main ---------------------------------------------------------------------------
interface Args {
  mode: 'markscheme' | 'answerkey';
  limit?: number;
  sample?: number;
  threshold: number;
  selftest: boolean;
  json: string;
}

function parseArgs(argv: string[]): Args {
  // Last match wins, so `npm run … -- --sample=3` overrides the script's own default
  // rather than being shadowed by it.
  const get = (name: string) => {
    const hits = argv.filter((a) => a.startsWith(`--${name}=`));
    return hits.length ? hits[hits.length - 1].slice(name.length + 3) : undefined;
  };
  return {
    mode: (get('mode') as Args['mode']) ?? 'markscheme',
    limit: get('limit') ? Number(get('limit')) : undefined,
    sample: get('sample') ? Number(get('sample')) : undefined,
    threshold: get('threshold') ? Number(get('threshold')) : DEFAULT_THRESHOLD,
    selftest: argv.includes('--selftest'),
    json: get('json') ?? '',
  };
}

function fmt(n: number): string {
  return typeof n === 'number' ? n.toFixed(2) : '  - ';
}

async function runSelftest(judge: Judge): Promise<number> {
  console.log(`\nHarness self-check against the live API (model ${MODEL})\n`);
  let failures = 0;
  for (const fx of FIXTURES) {
    const req = buildMarkschemeRequest(fx.question);
    if (!req) throw new Error(`fixture ${fx.name} has < 2 points`);
    const answers = await judge(req.state, req.questions);
    const scores = fx.question.markscheme.map((_, i) => answers[`point_${i + 1}`]?.noul ?? NaN);
    const flagged = scores.filter((s) => s >= DEFAULT_THRESHOLD).length;
    const ok = fx.expect === 'clean' ? flagged === 0 : flagged > 0;
    if (!ok) failures++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${fx.name}  [expect ${fx.expect}]`);
    scores.forEach((s, i) => console.log(`          point #${i + 1}: ${fmt(s)}`));
  }
  console.log(
    failures
      ? `\n  ${failures} fixture(s) did not behave as expected — fix the instruction wording before running the corpus.\n`
      : '\n  all fixtures behave as expected\n',
  );
  return failures;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let servedModel = '';
  const judge = makeJudge({
    log: (m) => console.log(m),
    onModel: (m) => {
      servedModel = m;
    },
  });

  if (args.selftest) {
    process.exit((await runSelftest(judge)) > 0 ? 1 : 0);
  }

  const findings: Finding[] = [];
  const raw: unknown[] = [];
  let checked = 0;

  if (args.mode === 'markscheme') {
    let qs = loadPaperQuestions();
    if (args.limit) qs = qs.slice(0, args.limit);
    console.log(`\nMarkscheme independence — ${qs.length} free-response questions\n`);
    for (const q of qs) {
      const req = buildMarkschemeRequest(q);
      if (!req) {
        console.log(`  skip ${q.id} (single point)`);
        continue;
      }
      const answers = await judge(req.state, req.questions);
      const f = evaluateMarkscheme(q, answers, args.threshold);
      findings.push(...f);
      raw.push({ id: q.id, answers });
      checked++;
      const tag = f.length ? `\n     ^ ${f.map((x) => `${x.label}=${fmt(x.score)}`).join(' ')}` : '';
      console.log(`  ${String(checked).padStart(3)} ${q.id} (${q.marks} marks)${tag}`);
    }
  } else {
    let qs = loadMcQuestions();
    qs = args.sample ? sampleEvenly(qs, args.sample) : qs;
    console.log(`\nMC answer keys — ${qs.length} questions\n`);
    for (const q of qs) {
      const req = buildAnswerKeyRequest(q, q.topic);
      const answers = await judge(req.state, req.questions);
      const f = evaluateAnswerKey(q, answers, args.threshold);
      findings.push(...f);
      raw.push({ id: q.id, correctIndex: q.correctIndex, answers });
      checked++;
      const key = fmt(answers[`choice_${q.correctIndex}`]?.noul ?? NaN);
      const best = q.choices
        .map((_, i) => answers[`choice_${i}`]?.noul ?? 0)
        .filter((_, i) => i !== q.correctIndex)
        .reduce((a, b) => (b > a ? b : a), 0);
      const flag = f.length ? `  <-- ${f.map((x) => x.kind).join(',')}` : '';
      console.log(`  ${String(checked).padStart(4)} ${q.id} key=${key} bestOther=${fmt(best)}${flag}`);
    }
  }

  const byKind = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = args.json || path.join(REPORT_DIR, `${args.mode}-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        mode: args.mode,
        requestedModel: MODEL,
        servedModel,
        threshold: args.threshold,
        scopeNote:
          args.mode === 'answerkey'
            ? 'Findings on computational questions are dominated by model arithmetic errors (9/35 maths flagged, all hand-verified false positives 2026-09-19; 0/55 in other subjects). Hand-verify every flag.'
            : 'Findings are semantic candidates for human triage; the score is not a severity measure.',
        checked,
        findings,
        raw,
      },
      null,
      2,
    ),
  );

  console.log(`\nchecked ${checked} · findings ${findings.length} ${JSON.stringify(byKind)}`);
  console.log(`report: ${path.relative(process.cwd(), out)}\n`);
}

// Only run when invoked directly (so tests can import the pure parts).
if (process.argv[1] && process.argv[1].includes('audit-content-ai')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
