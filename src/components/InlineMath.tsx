'use client';

import MathExpression from './MathExpression';

// Splits text on $...$ delimiters and renders those segments with KaTeX.
// Use this anywhere content strings may contain inline LaTeX (stems, choices,
// explanations, flashcards, descriptions) so raw "$" never reaches the page.
// Non-math segments may contain **bold** markers (plain text inside — never
// spanning math; audit:content's unbalanced_bold check enforces this).
export function renderInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$\n]+\$)/);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
      return <MathExpression key={i} latex={part.slice(1, -1)} />;
    }
    return <span key={i}>{renderBold(part)}</span>;
  });
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
