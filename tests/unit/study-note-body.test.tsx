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

describe('StudyNoteBody display math embedded in a line', () => {
  // Regression guard, measured on the deployed site 2026-09-25: a `$$...$$` that
  // did not start its line fell through to the inline splitter, so the doubled
  // delimiters were split as SINGLE `$` ones and printed literally — 64 note lines
  // across 14 topics showed students "$ … $" around inline math.
  const render = (body: string) => renderToStaticMarkup(createElement(StudyNoteBody, { body }));

  it('renders mid-sentence $$ as display math and leaves no literal $ behind', () => {
    const html = render('The moment of a force is: $$\\text{moment} = F \\times d$$ in newton-metres.');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('$$');
    expect(html).not.toContain('$');
    expect(html).toContain('The moment of a force is:');
    expect(html).toContain('in newton-metres.');
  });

  it('keeps the bullet marker when a list item embeds one', () => {
    const html = render('• Nearest $10$: round up. $$4\\,638 \\to 4\\,640$$');
    expect(html).toContain('<li');
    expect(html).toContain('Nearest');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('4\\,640$');
    expect(html).not.toContain('$');
  });

  it('renders two blocks on one line as two display blocks', () => {
    const html = render('Text $$x = 1$$ and $$y = 2$$ more text.');
    expect((html.match(/katex-display/g) || []).length).toBe(2);
    expect(html).toContain('and');
    expect(html).toContain('more text.');
    expect(html).not.toContain('$');
  });

  it('keeps the indented sub-step and formula-block layouts working', () => {
    expect(render('  Step: $$x = 1$$')).toContain('katex-display');
    expect(render('    $$x = 1$$')).toContain('katex-display');
  });

  it('leaves inline math and currency escapes untouched', () => {
    const html = render('Cost is $\\$5$ and half of $x$.');
    expect((html.match(/katex-display/g) || []).length).toBe(0);
    expect(html).toContain('katex');
    expect(html).not.toContain('$\\$5$');
  });

  it('does not treat an unterminated $$ as display math', () => {
    const html = render('Start $$x + 1 and keep going');
    expect(html).not.toContain('katex-display');
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

describe('StudyNoteBody Markdown pipe tables', () => {
  const count = (html: string, tag: string) => (html.match(new RegExp(tag, 'g')) || []).length;

  it('renders a 3-column vocab table as <table> with <th> headers and one <td> per body cell', () => {
    const body = '| Chinese | Pinyin | English |\n|---|---|---|\n| 你好 | nǐ hǎo | hello |\n| 您好 | nín hǎo | hello (polite) |';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<table');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(count(html, '<th[\\s>]')).toBe(3);
    expect(count(html, '<td[\\s>]')).toBe(6);
    expect(html).not.toContain('|');
    expect(html).not.toContain('---');
  });

  it('renders **bold** and inline $...$ inside table cells', () => {
    const body = '| Term | Meaning |\n|---|---|\n| **coefficient** | number multiplying $x$ |';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<table');
    expect(html).toContain('>coefficient</strong>');
    expect(html).toContain('katex');
    expect(html).not.toContain('**');
  });

  it('keeps content before and after the table as paragraphs', () => {
    const body = 'Intro paragraph\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nOutro paragraph';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<p');
    expect(html).toContain('Intro paragraph');
    expect(html).toContain('Outro paragraph');
    expect(html).toContain('<table');
  });

  it('treats a | line without a separator row as a plain paragraph fallback', () => {
    const body = '| a | b |\nnot a separator';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).not.toContain('<table');
    expect(html).toContain('| a | b |');
  });

  it('handles ragged rows (fewer/more cells than the header) without crashing', () => {
    const body = '| A | B | C |\n|---|---|---|\n| 1 | 2 |\n| 3 | 4 | 5 | 6 |';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<table');
    // Both body rows render 3 cells: the short row is padded, the extra 4th cell is ignored.
    expect(count(html, '<td[\\s>]')).toBe(6);
    expect(html).not.toContain('>6<');
  });
});

describe('StudyNoteBody headerless tables', () => {
  it('omits <thead> when every header cell is empty (headerless grid)', () => {
    const body = '| | | | |\n|---|---|---|---|\n| b | p | m | f |\n| d | t | n | l |';
    const html = renderToStaticMarkup(createElement(StudyNoteBody, { body }));
    expect(html).toContain('<table');
    expect(html).not.toContain('<thead>');
    expect(html).not.toContain('<th');
    expect((html.match(/<td[\s>]/g) || []).length).toBe(8);
    expect(html).not.toContain('|');
  });
});
