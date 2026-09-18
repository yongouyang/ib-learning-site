'use client';

import MathExpression from './MathExpression';

// A backslash-escaped dollar (\$, authored as "\\$" in the JSON) is a literal
// "$": KaTeX understands it inside math and it reads as currency in prose. The
// splitter below is character-blind, so the escape is swapped for a sentinel it
// cannot mistake for a delimiter and undone per segment. U+E000 is a private-use
// character, verified absent from the content corpus.
const ESCAPED_DOLLAR = '\uE000';

export interface InlineMathSegment {
  /** Segment text — the LaTeX between the delimiters when `math` is true. */
  value: string;
  math: boolean;
}

/**
 * Splits a content string on inline-math ($...$) delimiters: the ONE grammar for
 * inline math, shared by the renderer and its tests. It used to disagree with
 * the audit script's escape-aware copy, and `escaped_dollar` existed only to
 * flag the difference (removed 2026-09-18).
 *
 * Display math ($$...$$) is handled a level up, in StudyNoteBody — it appears
 * only in note bodies (measured: 0 occurrences in stems, choices, flashcards,
 * explanations or mark schemes), so it is not a case here.
 */
export function splitInlineMath(text: string): InlineMathSegment[] {
  return text
    .replace(/\\\$/g, ESCAPED_DOLLAR)
    .split(/(\$[^$\n]+\$)/)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('$') && part.endsWith('$') && part.length > 1
        ? { value: part.slice(1, -1).replaceAll(ESCAPED_DOLLAR, '\\$'), math: true }
        : { value: part.replaceAll(ESCAPED_DOLLAR, '$'), math: false },
    );
}

// Renders inline math and the **bold** markup around it. Use this anywhere
// content strings may contain LaTeX (stems, choices, explanations, flashcards,
// descriptions) so raw "$" never reaches the page.
export function renderInlineMath(text: string): React.ReactNode[] {
  return splitInlineMath(text).map((segment, i) =>
    segment.math ? (
      <MathExpression key={i} latex={segment.value} />
    ) : (
      <span key={i}>{renderBold(segment.value)}</span>
    ),
  );
}

// Renders **bold** segments inside a plain-text (non-math) part. Unpaired
// markers stay literal so bad content never crashes the renderer.
function renderBold(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*\n]+?\*\*)/);
  return segments.map((segment, i) => {
    if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
      return (
        <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

export default function InlineMath({ text }: { text: string }) {
  return <>{renderInlineMath(text)}</>;
}
