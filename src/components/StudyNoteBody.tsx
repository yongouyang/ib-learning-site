'use client';

import MathExpression from './MathExpression';

function renderInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$\n]+\$)/);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
      return <MathExpression key={i} latex={part.slice(1, -1)} />;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function StudyNoteBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (currentList.length === 0) return;
    const baseClass = 'my-2 pl-5 text-sm text-gray-700 space-y-1';
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

    // Regular line — flush any pending list
    flushList();

    // Heavily indented (4+ spaces or tab) → formula / code block
    if (line.startsWith('    ') || line.startsWith('\t')) {
      elements.push(
        <div
          key={`code-${key++}`}
          className="font-mono text-sm text-gray-800 bg-gray-50 px-3 py-1.5 rounded-md my-1 border-l-4 border-blue-300"
        >
          {renderInlineMath(trimmed)}
        </div>
      );
      continue;
    }

    // Moderately indented (2 spaces) → sub-step / continuation
    if (line.startsWith('  ')) {
      elements.push(
        <div key={`indent-${key++}`} className="text-sm text-gray-700 pl-4 leading-relaxed">
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
          className="font-semibold text-gray-900 mt-4 mb-1 text-sm flex items-center gap-2"
        >
          <span>{trimmed.split(' ')[0]}</span>
          <span>{renderInlineMath(trimmed.split(' ').slice(1).join(' '))}</span>
        </div>
      );
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${key++}`} className="text-sm text-gray-700 leading-relaxed">
        {renderInlineMath(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}
