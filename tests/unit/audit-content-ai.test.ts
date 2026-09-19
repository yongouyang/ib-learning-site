/**
 * Unit tests for the AI-judged content audit (scripts/audit-content-ai.ts).
 *
 * The pure builders and evaluators take `Answers` as an argument, so the transport is the
 * only external dependency and every policy decision is testable without a network call —
 * the controllable-dummy pattern (AGENTS.md), in script form.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildAnswerKeyRequest,
  buildMarkschemeRequest,
  DIFFICULTY_LEVELS,
  buildDifficultyRequest,
  difficultyLabel,
  evaluateAnswerKey,
  evaluateMarkscheme,
  markPrefix,
  makeJudge,
  sampleEvenly,
  type Answers,
  type McQuestion,
  type PaperQuestion,
} from '../../scripts/audit-content-ai';
import fs from 'fs';
import path from 'path';

const frq: PaperQuestion = {
  id: 'q1',
  stem: 'Work out 2/5 + 1/4.',
  marks: 2,
  markscheme: ['M1: common denominator 20', 'A1: 13/20'],
  modelAnswer: 'LCD 20, so 13/20.',
};

const mcq: McQuestion = {
  id: 'mc1',
  stem: 'Which gas do plants take in for photosynthesis?',
  choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
  correctIndex: 1,
  explanation: 'Plants take in carbon dioxide and release oxygen.',
};

describe('buildMarkschemeRequest', () => {
  it('asks one Noul per markscheme point, keyed by 1-based position', () => {
    const req = buildMarkschemeRequest(frq)!;
    expect(Object.keys(req.questions)).toEqual(['point_1', 'point_2']);
    expect((req.questions.point_1 as { type: string }).type).toBe('noul');
  });

  it('quotes the point text in the instruction so no index is ambiguous', () => {
    const req = buildMarkschemeRequest(frq)!;
    const instr = (req.questions.point_2 as { instructions: string }).instructions;
    expect(instr).toContain('A1: 13/20');
    expect(instr).toContain('#2 of 2');
  });

  it('states the marking convention, because A-follows-M is not double-counting', () => {
    const req = buildMarkschemeRequest(frq)!;
    const state = req.state as { markingConvention: string };
    expect(state.markingConvention).toMatch(/accuracy \(A\) mark normally FOLLOWS/);
    // The criteria must carve the intended dependency back out, or the model reads it as
    // redundancy — the exact harness bug found during calibration (clean pair scored 0.55).
    const criteria = (req.questions.point_2 as { criteria: Record<string, string> }).criteria;
    expect(criteria.false).toMatch(/NOT a duplicate/);
  });

  it('refuses a single-point markscheme (nothing can double-count)', () => {
    expect(buildMarkschemeRequest({ ...frq, marks: 1, markscheme: ['B1: Paris'] })).toBeNull();
  });

  it('never sends the question id as model input', () => {
    const req = buildMarkschemeRequest(frq)!;
    expect(JSON.stringify(req.questions)).not.toContain('"q1"');
  });
});

describe('markPrefix', () => {
  it('reads the M/A/B type prefix and reports anything else as unknown', () => {
    expect(markPrefix('M1: method')).toBe('M');
    expect(markPrefix('A2: accuracy')).toBe('A');
    expect(markPrefix('B1: independent fact')).toBe('B');
    // documents the malformed shape the validator rule added alongside this script rejects
    expect(markPrefix('uses the cosine rule')).toBe('?');
    expect(markPrefix('M1 - method')).toBe('?');
  });
});

describe('evaluateMarkscheme', () => {
  it('flags only points at or above the threshold', () => {
    const answers: Answers = {
      point_1: { type: 'noul', noul: 0.59 },
      point_2: { type: 'noul', noul: 0.07 },
    };
    const findings = evaluateMarkscheme(frq, answers);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('possible-double-count');
    expect(findings[0].label).toBe('point #1 (M)');
  });

  it('is silent for a clean markscheme and ignores missing answers', () => {
    expect(
      evaluateMarkscheme(frq, {
        point_1: { type: 'noul', noul: 0.08 },
        point_2: { type: 'noul', noul: 0.07 },
      }),
    ).toEqual([]);
    expect(evaluateMarkscheme(frq, { point_1: { type: 'noul' } })).toEqual([]);
  });
});

describe('buildAnswerKeyRequest', () => {
  it('asks one Noul per choice, labelled A-D', () => {
    const req = buildAnswerKeyRequest(mcq, { title: 'Photosynthesis', subjectId: 'biology', stage: 'ks3' });
    expect(Object.keys(req.questions)).toEqual(['choice_0', 'choice_1', 'choice_2', 'choice_3']);
    expect((req.questions.choice_3 as { instructions: string }).instructions).toContain('choice D');
  });

  it('CONTAMINATION GUARD: never sends correctIndex or the explanation', () => {
    // The explanation states which option is right, so including it would hand the model
    // the key and anchor every judgement (AGENTS.md: verify the input before diagnosing
    // the model). This is the check that keeps the answer-key mode meaningful.
    const req = buildAnswerKeyRequest(mcq, null);
    const payload = JSON.stringify(req);
    expect(payload).not.toContain('correctIndex');
    expect(payload).not.toContain(mcq.explanation);
    expect(payload).not.toContain('carbon dioxide and release');
  });

  it('keeps the instruction subject-neutral (never "mathematically correct")', () => {
    const req = buildAnswerKeyRequest(mcq, null);
    for (const q of Object.values(req.questions) as { instructions: string }[]) {
      expect(q.instructions).toContain('correct answer');
      expect(q.instructions).not.toMatch(/mathematical/i);
    }
  });
});

describe('evaluateAnswerKey', () => {
  const answers = (ns: number[]): Answers =>
    Object.fromEntries(ns.map((n, i) => [`choice_${i}`, { type: 'noul', noul: n }]));

  it('flags a non-keyed choice that scores as correct', () => {
    const findings = evaluateAnswerKey(mcq, answers([0.02, 0.98, 0.03, 0.02]));
    expect(findings).toEqual([]);
    const second = evaluateAnswerKey(mcq, answers([0.9, 0.96, 0.03, 0.02]));
    expect(second).toHaveLength(1);
    expect(second[0].kind).toBe('second-correct-answer');
    expect(second[0].label).toBe('choice A');
  });

  it('treats a key below threshold as its own, more serious finding', () => {
    const findings = evaluateAnswerKey(mcq, answers([0.02, 0.09, 0.03, 0.02]));
    expect(findings.map((f) => f.kind)).toEqual(['key-below-threshold']);
  });

  it('reports both shapes when both hold (the policy is not either/or)', () => {
    const findings = evaluateAnswerKey(mcq, answers([0.7, 0.3, 0.02, 0.02]));
    expect(findings.map((f) => f.kind).sort()).toEqual([
      'key-below-threshold',
      'second-correct-answer',
    ]);
  });

  it('honours a custom threshold', () => {
    // 0.95 sits above every distractor but below nothing the key does not clear
    expect(evaluateAnswerKey(mcq, answers([0.2, 0.96, 0.1, 0.1]), 0.95)).toEqual([]);
    // ...and the same inputs at the default threshold are still clean
    expect(evaluateAnswerKey(mcq, answers([0.2, 0.96, 0.1, 0.1]))).toEqual([]);
  });
});

describe('sampleEvenly', () => {
  it('is deterministic, spans the input, and never uses randomness', () => {
    const spy = vi.spyOn(Math, 'random');
    const items = Array.from({ length: 100 }, (_, i) => i);
    const first = sampleEvenly(items, 10);
    expect(first).toEqual(sampleEvenly(items, 10));
    expect(first).toHaveLength(10);
    expect(first[0]).toBe(0);
    expect(first[9]).toBe(90);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns everything when the sample is at least the corpus', () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });
});

describe('makeJudge', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed when credentials are unset', () => {
    vi.stubEnv('TYPESAFE_BASE_URL', '');
    vi.stubEnv('TYPESAFE_API_KEY', '');
    expect(() => makeJudge()).toThrow(/TYPESAFE_BASE_URL/);
  });

  it('does not retry a 4xx (only transport failures and 429/5xx are transient)', async () => {
    vi.stubEnv('TYPESAFE_BASE_URL', 'https://example.invalid');
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('bad request', { status: 400 }));
    await expect(makeJudge()({}, {})).rejects.toThrow(/400/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('returns answers and reports the served model', async () => {
    vi.stubEnv('TYPESAFE_BASE_URL', 'https://example.invalid');
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ model: 'jev-9.9.9', answers: { point_1: { type: 'noul', noul: 0.1 } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    let served = '';
    const answers = await makeJudge({ onModel: (m) => (served = m) })({}, {});
    expect(answers.point_1.noul).toBe(0.1);
    expect(served).toBe('jev-9.9.9');
    fetchSpy.mockRestore();
  });
});

describe('difficulty judgement', () => {
  it('maps the score to a level with thresholds, never as a magnitude', () => {
    expect(difficultyLabel(0.01)).toBe('easy');
    expect(difficultyLabel(0.49)).toBe('easy');
    expect(difficultyLabel(0.5)).toBe('medium');
    expect(difficultyLabel(1.49)).toBe('medium');
    expect(difficultyLabel(1.5)).toBe('hard');
    expect(difficultyLabel(1.99)).toBe('hard');
  });

  it('keeps the criteria VERBATIM in step with the rubric doc (drift fails loudly)', () => {
    // The check must measure OUR rubric, not a model's generic idea of difficulty — so every
    // criterion is compared character-for-character against docs/CONTENT_STYLE.md, with only
    // the markdown emphasis stripped. If either side is reworded, this test goes red.
    const doc = fs.readFileSync(path.join(process.cwd(), 'docs/CONTENT_STYLE.md'), 'utf8');
    const parsed = ['easy', 'medium', 'hard'].map((level) => {
      const line = doc.split('\n').find((l) => l.startsWith(`- **${level}** — `));
      if (!line) throw new Error(`rubric line for "${level}" not found`);
      return `${level} — ${line.slice(`- **${level}** — `.length).replace(/\*/g, '')}`;
    });
    expect(DIFFICULTY_LEVELS).toEqual(parsed);
  });

  it('CONTAMINATION GUARD: state carries no shipped tag and no explanation', () => {
    const req = buildDifficultyRequest({ ...mcq, difficulty: 'hard' }, {
      title: 'Photosynthesis',
      subjectId: 'biology',
      stage: 'ks3',
      year: 8,
    });
    // The tag must not anchor the judgement: assert the question in state is exactly
    // stem + choices, and that the explanation (which reveals how much reasoning is needed)
    // never travels. Note the rubric WORDING in criteria does contain the word "hard" — that
    // is the rubric being measured, not the label being leaked.
    const state = req.state as { question: Record<string, unknown> };
    expect(Object.keys(state.question).sort()).toEqual(['choices', 'stem']);
    expect(JSON.stringify(req.state)).not.toContain(mcq.explanation);
    // ...but the topic's target level must be there: the rubric judges relative to it.
    expect(JSON.stringify(req.state)).toContain('Year 8');
  });

  it('asks one Score question with the three rubric levels and no other', () => {
    const req = buildDifficultyRequest(mcq, null);
    expect(Object.keys(req.questions)).toEqual(['difficulty']);
    const q = req.questions.difficulty as { type: string; criteria: string[] };
    expect(q.type).toBe('score');
    expect(q.criteria).toHaveLength(3);
  });
});
