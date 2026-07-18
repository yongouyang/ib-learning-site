'use client';

import MathExpression from './MathExpression';

// Splits text on $...$ delimiters and renders those segments with KaTeX.
// Use this anywhere content strings may contain inline LaTeX (stems, choices,
// explanations, flashcards, descriptions) so raw "$" never reaches the page.
export function renderInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$\n]+\$)/);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
      return <MathExpression key={i} latex={part.slice(1, -1)} />;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function InlineMath({ text }: { text: string }) {
  return <>{renderInlineMath(text)}</>;
}
