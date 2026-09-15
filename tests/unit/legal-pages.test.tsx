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

  it('renders tables as tables, never as raw pipes', () => {
    const { container } = render(<LegalDocument source={body} />);
    if (body.includes('|---')) expect(container.querySelectorAll('table').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('|---');
  });
});
