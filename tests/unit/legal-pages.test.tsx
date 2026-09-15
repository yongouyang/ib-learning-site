import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegalDocument, legalBody } from '@/components/LegalDocument';
import TermsPage from '@/app/terms/page';
import PrivacyPage from '@/app/privacy/page';

// Guards the failure modes that matter for published legal text:
//
// 1. A CLAUSE THAT IS IN THE REVIEWED FILE BUT NOT ON THE PAGE. The pages render
//    docs/*.md through a small purpose-built parser, so a construct it does not
//    understand — or a paragraph it swallows — would drop wording silently. Every
//    `###`/`####` section must therefore appear as a REAL heading element, at the
//    right level.
// 2. HEADINGS THAT ARE ONLY VISUALLY HEADINGS. The renderer's first version emitted
//    every heading as a styled <p>, which left both published pages with no h1/h2 at
//    all — a flat outline for screen readers, and worse than the page it replaced.
//    That is why this asserts elements and levels, not just text.
// 3. AN INTERNAL PLACEHOLDER OR WORKING NOTE REACHING THE PUBLIC. `[[ … ]]` marks an
//    open decision and the preamble/checklist are ours alone.
//
// If one of these fails after a document edit, do NOT delete the assertion: look at
// what the renderer did to the text.

const DOCS = [
  {
    label: 'Terms of Use',
    file: 'docs/terms-of-use-draft.md',
    Page: TermsPage,
    probes: ['premium', 'refund', 'Hong Kong'],
  },
  {
    label: 'Privacy Notice',
    file: 'docs/privacy-notice-draft.md',
    Page: PrivacyPage,
    probes: ['cookies', 'DeepSeek', 'lawful basis'],
  },
] as const;

describe.each(DOCS)('$label', ({ label, file, Page, probes }) => {
  const markdown = readFileSync(join(process.cwd(), file), 'utf8');
  const body = legalBody(markdown, label);

  it('publishes the document body without the internal notes or its own title', () => {
    expect(body).not.toContain('Before publication');
    expect(body).not.toContain('Decisions taken');
    expect(body).not.toContain('Operator details filled in');
    // The page supplies the h1, so the body must not carry the title line too.
    expect(body).not.toContain(`## ${label}`);
  });

  it('renders every section as a real heading element at the right level', () => {
    const sections = body
      .split('\n')
      .filter((l) => /^#{3,4}\s+/.test(l))
      .map((l) => ({
        level: /^#+/.exec(l)![0].length >= 4 ? 3 : 2,
        text: l.replace(/^#+\s+/, '').trim(),
      }));
    expect(sections.length).toBeGreaterThanOrEqual(10);

    render(<LegalDocument source={body} />);
    const missing = sections.filter((s) => !screen.queryByRole('heading', { level: s.level, name: s.text }));
    expect(missing).toEqual([]);
  });

  it('renders the page component with exactly one h1 and no placeholder', () => {
    const { container } = render(<Page />);
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.textContent).toBe(label);

    const text = (container.textContent ?? '').toLowerCase();
    expect(text.length).toBeGreaterThan(2000);
    expect(text).not.toContain('[[');
    for (const probe of probes) expect(text).toContain(probe.toLowerCase());
  });

  it('publishes nothing written for us rather than for a reader', () => {
    // This is the defect class that blocked the first publication attempt: the slice
    // between the document heading and `## Before publication` is user-facing text, and
    // it shipped with two literal `(link)` placeholders, a `checklist item 2` reference,
    // a `DPIA` note addressed to us, and a maintainer runbook telling the reader to
    // re-run a repo script. Copy defects, invisible to every other gate.
    const FORBIDDEN = [
      '(link)',
      'checklist item',
      'DPIA',
      'TODO',
      'see the method note',
      'Re-run it',
      'update the table',
      'Before publication',
      'Decisions taken',
      'not legal advice',
      '[[',
      // A backtick in rendered TEXT means an unrendered code span — the bold branch did
      // not recurse, so a bolded run containing code showed literal ticks. A correctly
      // rendered code span contributes its text without them, so this is exact.
      '`',
      // Internal decision-dating in prose (it was on the published §5.4 heading).
      'decided 2026',
      // A literal bold marker means an unrendered `**…**`. Zero today, and there is no
      // reason for legal prose to contain one.
      '**',
    ];
    const { container } = render(<Page />);
    const text = container.textContent ?? '';
    // Report WHERE as well as what: a bare list of needles sends the next reader
    // hunting through a 130KB page.
    const leaked = FORBIDDEN.map((needle) => {
      const at = text.toLowerCase().indexOf(needle.toLowerCase());
      return at === -1 ? null : `${needle} → …${text.slice(Math.max(0, at - 70), at + 70)}…`;
    }).filter(Boolean);
    expect(leaked).toEqual([]);
  });

  it('ends with content, not an orphan horizontal rule', () => {
    // legalBody() slices up to the checklist, which used to leave the `---` before it
    // as a final <hr> sitting on the footer's own border.
    const { container } = render(<LegalDocument source={body} />);
    const blocks = [...container.firstElementChild!.children];
    expect(blocks.at(-1)?.tagName).not.toBe('HR');
  });

  it('renders tables as tables, never as raw pipes', () => {
    const { container } = render(<LegalDocument source={body} />);
    if (body.includes('|---')) expect(container.querySelectorAll('table').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('|---');
  });
});
