'use client';

import MathExpression from './MathExpression';
import { renderInlineMath } from './InlineMath';

// Splits a pipe-table row (already trimmed; starts and ends with '|') into its
// trimmed cell strings. A trailing empty cell (e.g. "...||") is dropped here and
// recovered by the renderer's `row[ci] ?? ''` padding.
function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

// True when a trimmed line is a valid Markdown table separator row: cells made
// only of '-', ':', spaces and the inner '|' separators (e.g. "|---|---|---|").
function isTableSeparator(line: string | undefined): boolean {
  return !!line && /^\|[\s:|-]+\|$/.test(line.trim());
}

export default function StudyNoteBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (currentList.length === 0) return;
    const baseClass = 'my-2 pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1';
    if (listType === 'ol') {
      elements.push(
        <ol key={`list-${key++}`} className={`${baseClass} list-decimal`}>
          {currentList.map((item, i) => (
            <li key={i} className="leading-relaxed pl-1">{renderInlineMath(item)}</li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`list-${key++}`} className={`${baseClass} list-disc`}>
          {currentList.map((item, i) => (
            <li key={i} className="leading-relaxed pl-1">{renderInlineMath(item)}</li>
          ))}
        </ul>
      );
    }
    currentList = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    // Display math block: line is exactly $$...$$
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flushList();
      elements.push(
        <MathExpression
          key={`math-${key++}`}
          latex={trimmed.slice(2, -2).trim()}
          display
        />
      );
      continue;
    }

    // Multi-line display math block: line starts with $$ but closes on a later
    // line. Join the lines, normalising a single trailing "\" (author typo for
    // the LaTeX line break "\\") so KaTeX renders the block correctly.
    if (trimmed.startsWith('$$') && (trimmed.match(/\$\$/g) || []).length === 1) {
      const blockLines = [trimmed];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().endsWith('$$')) {
        blockLines.push(lines[j].trim());
        j++;
      }
      if (j < lines.length) {
        blockLines.push(lines[j].trim());
        flushList();
        const joined = blockLines
          .map((l) => (l.endsWith('\\') && !l.endsWith('\\\\') ? l + '\\' : l))
          .join(' ');
        const inner = joined.startsWith('$$') ? joined.slice(2) : joined;
        const latex = inner.endsWith('$$') ? inner.slice(0, -2) : inner;
        elements.push(
          <MathExpression key={`math-${key++}`} latex={latex.trim()} display />
        );
        i = j;
        continue;
      }
      // No closing $$ found — fall through and render as normal lines.
    }

    // Bullet list item
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      currentList.push(trimmed.slice(2));
      continue;
    }

    // Numbered list item (e.g. "1. ", "2. ")
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      currentList.push(numberedMatch[2]);
      continue;
    }

    // Markdown pipe table: header line | a | b | immediately followed by a
    // separator row |---|---|, then zero or more body rows | ... |. Consume the
    // whole block here. A | line with no valid separator falls through to the
    // default paragraph branch (never crashes, never drops content).
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && isTableSeparator(lines[i + 1])) {
      flushList();
      const headerCells = splitTableRow(trimmed);
      const bodyRows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const row = lines[j].trim();
        if (!row.startsWith('|') || !row.endsWith('|')) break;
        bodyRows.push(splitTableRow(row));
        j++;
      }
      elements.push(
        <div key={`table-${key++}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {headerCells.map((cell, ci) => (
                  <th
                    key={ci}
                    className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-left font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {renderInlineMath(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {headerCells.map((_, ci) => (
                    <td
                      key={ci}
                      className="border border-gray-200 dark:border-gray-700 px-2 py-1 align-top text-left text-gray-700 dark:text-gray-300"
                    >
                      {renderInlineMath(row[ci] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }

    // Regular line — flush any pending list
    flushList();

    // Heavily indented (4+ spaces or tab) → formula / code block
    if (line.startsWith('    ') || line.startsWith('\t')) {
      elements.push(
        <div
          key={`code-${key++}`}
          className="font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-md my-1 border-l-4 border-blue-300 dark:border-blue-700"
        >
          {renderInlineMath(trimmed)}
        </div>
      );
      continue;
    }

    // Moderately indented (2 spaces) → sub-step / continuation
    if (line.startsWith('  ')) {
      elements.push(
        <div key={`indent-${key++}`} className="text-sm text-gray-700 dark:text-gray-300 pl-4 leading-relaxed">
          {renderInlineMath(trimmed)}
        </div>
      );
      continue;
    }

    // Special marker lines (emojis at start)
    if (/^[📌💡🔑📝📎⚠️✅❌→▶️🎯📊🧮]/.test(trimmed)) {
      elements.push(
        <div
          key={`marker-${key++}`}
          className="font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-1 text-sm flex items-center gap-2"
        >
          <span>{trimmed.split(' ')[0]}</span>
          <span>{renderInlineMath(trimmed.split(' ').slice(1).join(' '))}</span>
        </div>
      );
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${key++}`} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {renderInlineMath(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}
