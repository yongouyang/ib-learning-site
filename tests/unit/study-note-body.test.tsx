import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import StudyNoteBody from '@/components/StudyNoteBody';

describe('StudyNoteBody multi-line display math ', () => {
  it('renders multi-line $$ blocks with single trailing backslashes as KaTeX display math', () => {
    const body = `Before\n\n    $$\\begin{aligned}\n    (+) \\times (+) &= (+) \\\n    (-) \\times (-) &= (+) \\\n    (+) \\times (-) &= (-) \\\n    \\end{aligned}$$\n\nAfter`;
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('katex-display');
    expect(html).not.toContain('$$');
    expect(html).toContain('Before');
    expect(html).toContain('After');
  });
});
