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

describe('StudyNoteBody ** bold', () => {
  it('renders **bold** segments as <strong>, including mid-word', () => {
    const body = 'A **variable** is a letter. **ein**steigen means to board.';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<strong');
    expect(html).toContain('>variable</strong>');
    expect(html).toContain('>ein</strong>');
    expect(html).toContain('steigen means to board.');
    expect(html).not.toContain('**');
  });

  it('renders bold alongside inline math on the same line', () => {
    const body = 'The **coefficient** of $x$ is $3$.';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('>coefficient</strong>');
    expect(html).toContain('katex');
    expect(html).not.toContain('**');
  });

  it('renders bold inside list items', () => {
    const body = '• A **term** is a single number.';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<li');
    expect(html).toContain('>term</strong>');
  });

  it('leaves unpaired ** markers literal instead of crashing', () => {
    const body = 'An **unclosed marker stays as-is.';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('**unclosed');
  });
});
