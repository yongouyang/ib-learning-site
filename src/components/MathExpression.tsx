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

  const className = display ? 'block my-3 overflow-x-auto' : 'inline';
  return (
    // Safe: html is katex.renderToString() output; latex comes from authored
    // content JSON (validated by validate:content), never user input.
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
