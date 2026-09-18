import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import katex from 'katex';
import { renderInlineMath, splitInlineMath } from '@/components/InlineMath';
import StudyNoteBody from '@/components/StudyNoteBody';
import { getContentSubjects } from '@/content/registry.content';
import { getAllPapersContent } from '@/content/registry.papers';

// The renderer used to be the only parser of inline math with no test at all,
// while scripts/audit-content.ts carried an escape-aware copy of it plus three
// "shadow" rules that existed only to predict what it would do. These tests are
// what let `escaped_dollar` be deleted (2026-09-18): they exercise the shipping
// path, over the whole corpus, instead of re-implementing it.

describe('splitInlineMath', () => {
  it('returns plain text as a single non-math segment', () => {
    expect(splitInlineMath('No math here.')).toEqual([{ value: 'No math here.', math: false }]);
  });

  it('splits out inline math segments', () => {
    expect(splitInlineMath('The area is $\\pi r^2$ exactly.')).toEqual([
      { value: 'The area is ', math: false },
      { value: '\\pi r^2', math: true },
      { value: ' exactly.', math: false },
    ]);
  });

  it('does not pair a $ across a newline', () => {
    // [^$\n] — an unterminated inline $ must not swallow the next line.
    expect(splitInlineMath('cost $5\n$x$ here')).toEqual([
      { value: 'cost $5\n', math: false },
      { value: 'x', math: true },
      { value: ' here', math: false },
    ]);
  });

  describe('escaped dollars', () => {
    it('renders \\$ in prose as a literal $, not a delimiter', () => {
      expect(splitInlineMath('A pen costs \\$2.45 today.')).toEqual([
        { value: 'A pen costs $2.45 today.', math: false },
      ]);
    });

    it('keeps the escape when it sits inside math, where KaTeX needs it', () => {
      expect(splitInlineMath('$x = \\$5$')).toEqual([{ value: 'x = \\$5', math: true }]);
    });

    it('does not let an escaped dollar mis-pair the delimiters around it', () => {
      // The regression: the old naive split paired "$...$" greedily across the
      // escape, so `$5 and $` became one math segment and both formulas garbled.
      const segments = splitInlineMath('$\\frac{1}{2}$ costs \\$5 and $x^2$');
      expect(segments).toEqual([
        { value: '\\frac{1}{2}', math: true },
        { value: ' costs $5 and ', math: false },
        { value: 'x^2', math: true },
      ]);
      expect(segments.filter((s) => !s.math).every((s) => !s.value.includes('\\'))).toBe(true);
    });
  });
});

describe('renderInlineMath', () => {
  it('renders inline math with KaTeX and leaves no raw delimiters', () => {
    const html = renderToStaticMarkup(createElement('div', null, renderInlineMath('Area is $\\pi r^2$.')));
    expect(html).toContain('katex');
    expect(html).not.toContain('$');
  });

  it('renders an escaped dollar as currency text', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, renderInlineMath('A pen costs \\$2.45 and \\$3.85.')),
    );
    expect(html).toContain('$2.45');
    expect(html).toContain('$3.85');
    expect(html).not.toContain('\\');
  });
});

// ---------------------------------------------------------------------------
// Corpus tests — the renderer, over every topic and paper that ships.
// ---------------------------------------------------------------------------

const subjects = getContentSubjects();
const papers = getAllPapersContent();

function inlineMathSegments(): Array<{ where: string; latex: string }> {
  const out: Array<{ where: string; latex: string }> = [];
  for (const subject of subjects) {
    for (const topic of subject.topics) {
      const fields: Array<[string, string | undefined]> = [];
      for (const card of topic.flashcards) fields.push(['flashcards.term', card.term], ['flashcards.definition', card.definition]);
      for (const q of topic.questions) {
        fields.push(['q.stem', q.stem], ['q.explanation', q.explanation]);
        (q.choices ?? []).forEach((c, i) => fields.push([`q.choices[${i}]`, c]));
      }
      for (const [where, value] of fields) {
        if (typeof value !== 'string') continue;
        for (const seg of splitInlineMath(value)) {
          if (seg.math) out.push({ where: `${topic.id} ${where}`, latex: seg.value });
        }
      }
    }
  }
  for (const paper of papers) {
    for (const q of paper.questions) {
      const fields: Array<[string, string | undefined]> = [['stem', q.stem], ['modelAnswer', q.modelAnswer]];
      (q.markscheme ?? []).forEach((m, i) => fields.push([`markscheme[${i}]`, m]));
      for (const [where, value] of fields) {
        if (typeof value !== 'string') continue;
        for (const seg of splitInlineMath(value)) {
          if (seg.math) out.push({ where: `${paper.id} ${where}`, latex: seg.value });
        }
      }
    }
  }
  return out;
}

describe('corpus inline math', () => {
  it('covers the whole corpus (guards against a silent no-op)', () => {
    expect(subjects.length).toBe(10);
    expect(papers.length).toBeGreaterThan(20);
    expect(inlineMathSegments().length).toBeGreaterThan(1000);
  });

  it('parses every inline math segment with throwOnError', () => {
    const failures: string[] = [];
    for (const { where, latex } of inlineMathSegments()) {
      try {
        katex.renderToString(latex, { throwOnError: true, displayMode: false, strict: 'warn' });
      } catch (error) {
        failures.push(`${where}: ${String(error).slice(0, 120)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('renders every note body without a KaTeX error', () => {
    // StudyNoteBody (not renderInlineMath) owns display math, so this is the
    // path that would surface a multi-$$ line or a bad macro as katex-error.
    const failures: string[] = [];
    for (const subject of subjects) {
      for (const topic of subject.topics) {
        for (const note of topic.notes) {
          const html = renderToStaticMarkup(createElement(StudyNoteBody, { body: note.body }));
          if (html.includes('katex-error')) failures.push(`${topic.id}/${note.id}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('has no literal backslash-n typo in a note body', () => {
    // `\n` (authored where JSON wants `\n` for a real newline) is not a newline:
    // StudyNoteBody sees one long line, so the whole note renders as a run-on
    // paragraph. Shipped in maths-yr8-congruence-similarity's 7 notes until
    // 2026-09-18. `\neq`/`\nu` are legitimate LaTeX and a backtick code span
    // (`f.write("Ada,120\\n")`) legitimately contains a literal \n, so both are
    // excluded — the guard catches a note that is wrong in the typo's own shape.
    const offenders: string[] = [];
    for (const subject of subjects) {
      for (const topic of subject.topics) {
        for (const note of topic.notes) {
          const prose = note.body.replace(/`[^`]*`/g, '');
          if (/\\n(?![a-z])/.test(prose)) offenders.push(`${topic.id}/${note.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
