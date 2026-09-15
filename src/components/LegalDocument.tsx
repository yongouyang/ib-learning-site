import type { ReactNode } from 'react';

// Renders the legal documents (docs/terms-of-use-draft.md, docs/privacy-notice-draft.md)
// as the published /terms and /privacy pages.
//
// WHY THE MARKDOWN IS THE SOURCE OF TRUTH: the same file is what a lawyer reads and
// what the page shows, so the two cannot drift. The alternative — hand-writing the
// copy as JSX — means two copies of every clause, and for legal text drift between
// "what was reviewed" and "what is published" is the defect that matters most.
//
// THE COST, AND WHAT PAYS FOR IT: this is a small purpose-built parser (the repo has
// no markdown dependency; content is structured JSON rendered through
// src/components/content/*), so it supports only the constructs these documents use
// — headings, paragraphs, tables, ordered/unordered lists, bold/italic/code, links,
// `<https://…>` autolinks. A construct it does not understand would render as plain
// text, and a paragraph it swallowed would silently remove a clause. That is why
// `tests/unit/legal-pages.test.tsx` asserts the rendered output contains EVERY section
// heading in the source and no unresolved `[[ … ]]` placeholder: keep those assertions
// passing and a clause cannot vanish without the test going red.
//
// If the documents ever need richer formatting, replace this with a real markdown
// dependency rather than extending the parser.

// Installed per call by inline() below — see the note there on recursion.
//
// LIMITATION worth knowing before you nest any markup: `**bold**` cannot wrap a code span
// that itself contains an asterisk, because the bold pattern's content is `[^*]+` and stops
// at the `*`. The one place this bit us is the statement descriptor `LINK.COM*` — a code span
// there must NOT be bolded (it renders as literal `**` plus a stray backtick). The unit test's
// backtick needle catches the symptom.
const INLINE_SOURCE =
  /\[\[([^\]]*)\]\]|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|<((?:https?):\/\/[^>]+)>|\*([^*]+)\*/;

/** Bold, code, links, italics. `[[ … ]]` renders as plain text: it must never appear
 *  in a published document, and the unit test is what enforces that (rendering it
 *  prominently here would decorate a defect instead of hiding it).
 *
 *  A FRESH regex per call, deliberately. This function recurses — bold containing code
 *  or a link is normal legal copy — and a shared module-level `/g` regex would have its
 *  `lastIndex` clobbered by the inner call, which skips or repeats text with no error.
 *  (The first shipped version did not recurse at all, so a bolded run containing code
 *  rendered literal backticks.) */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE_SOURCE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) {
      out.push(m[1]);
    } else if (m[2] !== undefined) {
      // Recurse: bold containing code or a link is normal copy here, and the inner text
      // cannot contain `*` (the pattern forbids it), so it cannot re-match this branch.
      out.push(
        <strong key={k} className="font-semibold text-gray-900 dark:text-gray-100">
          {inline(m[2], k)}
        </strong>
      );
    } else if (m[3] !== undefined) {
      out.push(
        // break-words wraps a long token once its cell is already constrained (a URL,
        // `SameSite=Strict`). What it does NOT do: overflow-wrap:break-word leaves
        // min-content width unchanged, so it cannot make a table narrower — that is why
        // the §12 table was cut to four columns instead. If a table must shrink further,
        // `[overflow-wrap:anywhere]` (or fewer columns) is the mechanism, not this class.
        <code
          key={k}
          className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-[0.85em] break-words"
        >
          {m[3]}
        </code>
      );
    } else if (m[4] !== undefined) {
      out.push(
        <a key={k} href={m[5]} className="underline hover:text-gray-900 dark:hover:text-gray-100">
          {m[4]}
        </a>
      );
    } else if (m[6] !== undefined) {
      out.push(
        <a key={k} href={m[6]} className="underline hover:text-gray-900 dark:hover:text-gray-100">
          {m[6]}
        </a>
      );
    } else {
      out.push(<em key={k}>{m[7]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isHeading = (l: string) => /^#{1,4}\s+/.test(l);
const isTable = (l: string) => l.trim().startsWith('|');
const isRule = (l: string) => /^---+\s*$/.test(l.trim());
const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
const isOl = (l: string) => /^\s*\d+\.\s+/.test(l);
const isItem = (l: string) => isUl(l) || isOl(l);
const startsBlock = (l: string) => isHeading(l) || isTable(l) || isRule(l) || isItem(l);

/** The published document body: from the document's own `##` title up to the internal
 *  working notes. The preamble (status, decisions, fill-ins) and the review checklist
 *  are for us, not for users — and the document TITLE is dropped too, because the page
 *  renders it as the one `<h1>` (see LegalDocument's note on heading levels). */
export function legalBody(markdown: string, title: string): string {
  const start = markdown.indexOf(`## ${title}`);
  const end = markdown.indexOf('## Before publication');
  const body = markdown.slice(start === -1 ? 0 : start, end === -1 ? undefined : end);
  return body
    .replace(/^##\s+.*\n?/, '')
    // The `---` that separates the document from the checklist lands at the end of
    // the slice, and renders as a hairline sitting right on top of the footer's own
    // border — two parallel rules ~40px apart at the foot of every legal page.
    .replace(/\n\s*---\s*\n?\s*$/, '\n');
}

export function LegalDocument({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }

    if (isRule(line)) {
      blocks.push(<hr key={k++} className="my-6 border-gray-200 dark:border-gray-700" />);
      i++;
      continue;
    }

    if (isHeading(line)) {
      const level = /^#+/.exec(line)![0].length;
      const text = line.replace(/^#+\s+/, '');
      // REAL heading elements, not styled paragraphs. The first version of this
      // renderer emitted <p> with heading classes: visually fine, and it left the
      // published legal pages with no h1/h2 at all — a flat outline for screen
      // readers, and worse than the page it replaced. Levels map down one step
      // because the page supplies the h1 (the document title).
      const Tag = level >= 4 ? 'h3' : 'h2';
      // A long document needs a heading bigger than the body it introduces: at
      // text-base a section heading was 2px larger than 14px prose, which across 16
      // sections and ~40 run-in sub-parts reads as one continuous wall.
      //
      // `pt-4`, not `mt-8`: the container's `space-y-4` sets margins on every following
      // sibling at higher specificity, so an mt-* here is dead code (it was, briefly) and
      // every gap collapsed to a uniform 16px. Padding is untouched by space-y, so this is
      // what actually produces the 32px break before a section.
      const cls =
        level >= 4
          ? 'text-sm font-semibold text-gray-900 dark:text-gray-50 pt-2'
          : 'text-lg font-semibold text-gray-900 dark:text-gray-50 pt-4';
      blocks.push(
        <Tag key={k++} className={cls}>
          {inline(text, `h${k}`)}
        </Tag>
      );
      i++;
      continue;
    }

    if (isTable(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTable(lines[i]!)) {
        const cells = lines[i]!
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {head && (
              <thead>
                <tr>
                  {head.map((c, ci) => (
                    <th
                      key={ci}
                      className="align-top border-b border-gray-200 dark:border-gray-700 py-2 pr-3 font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {inline(c, `th${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="align-top border-b border-gray-100 dark:border-gray-800 py-2 pr-3"
                    >
                      {inline(c, `td${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (isItem(line)) {
      const ordered = isOl(line);
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i]!;
        if (isItem(l)) {
          items.push(l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
          i++;
        } else if (l.trim() && /^\s{2,}\S/.test(l)) {
          items[items.length - 1] += ` ${l.trim()}`;
          i++;
        } else {
          break;
        }
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List
          key={k++}
          className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 marker:text-gray-400`}
        >
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `li${ii}`)}</li>
          ))}
        </List>
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!)) {
      para.push(lines[i]!.trim());
      i++;
    }
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
  }

  // space-y-4, not space-y-3: 12px between blocks is indistinguishable from the
  // paragraph leading at 14px/20px, which flattens a 7,700px document into a wall.
  return <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">{blocks}</div>;
}
