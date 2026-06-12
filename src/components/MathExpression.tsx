'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathExpressionProps {
  latex: string;
  display?: boolean;
}

export default function MathExpression({ latex, display = false }: MathExpressionProps) {
  let html: string;
  try {
    html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      strict: 'warn',
    });
  } catch (error) {
    console.error('KaTeX rendering error:', error);
    html = `<span class="text-red-500">${latex}</span>`;
  }

  return (
    <span
      className={`${display ? 'block my-3 overflow-x-auto' : 'inline'}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
