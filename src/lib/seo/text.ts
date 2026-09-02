// Plain-text helpers for <title>, meta description and JSON-LD string fields.
//
// Content strings carry KaTeX: `$y=mx+c$`, `$R^2$`, `3 \times 3` (1 853 inline-math
// spans across the corpus; 12 of them in note headings, 2 in topic descriptions).
// Rendered in-page by InlineMath, but a meta tag cannot render anything — a literal
// `$R^2$` in a title reads as junk to a crawler and to Google's title rewriter, so
// every string that leaves the app as metadata goes through plainText() first.

/** Small, bounded symbol map — covers the commands actually present in the corpus. */
const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓',
  cap: '∩', cup: '∪', subset: '⊂', subseteq: '⊆', in: '∈', mid: '∣',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', sim: '∼', approx: '≈',
  infty: '∞', to: '→', rightarrow: '→', angle: '∠', circ: '°', deg: '°', degree: '°',
  Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', mu: 'μ',
  rho: 'ρ', sigma: 'σ', theta: 'θ', pi: 'π', chi: 'χ',
  sum: '∑', int: '∫', prod: '∏', partial: '∂', nabla: '∇',
  therefore: '∴', because: '∵', ldots: '…', dots: '…', cdots: '…', quad: ' ',
};

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷',
  '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', n: 'ⁿ', m: 'ᵐ', i: 'ⁱ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇',
  '8': '₈', '9': '₉', '-': '₋', '+': '₊', n: 'ₙ', m: 'ₘ', i: 'ᵢ',
};

const scriptOf = (map: Record<string, string>) => (body: string) =>
  /^[-+0-9nmi]+$/.test(body) ? [...body].map((c) => map[c]).join('') : body;

/**
 * KaTeX/markdown → readable plain text. Deliberately lossy in one direction only:
 * it never invents meaning, it substitutes the glyph a screen would have drawn, and
 * it degrades to the bare tokens for anything it does not know.
 */
export function plainText(input: string | undefined | null): string {
  if (!input) return '';
  let s = String(input);

  // \frac{a}{b} / \dfrac{a}{b} / \tfrac -> a/b ; \sqrt{x} -> √(x)
  s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
  s = s.replace(/\\[dt]?frac\s*(\S)\s*(\S)/g, '$1/$2');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\sqrt\s*(\w)/g, '√$1');
  // wrappers: \text{...}, \mathrm{...}, \mathbb{...}, \operatorname{...}, \hat/bar/vec{...}, \begin/\end{env}
  s = s.replace(/\\(?:text|textrm|mathrm|mathbb|mathbf|mathit|operatorname|textbf|hat|widehat|bar|overline|vec|underline|left|right)\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, ' ');
  // LaTeX row separator (matrix/vector environments) reads as a list in prose
  s = s.replace(/\\\\/g, ', ');
  // known symbols
  s = s.replace(/\\([a-zA-Z]+)\b/g, (m, name: string) => (name in SYMBOLS ? SYMBOLS[name] : m));
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name: string) => (name in SYMBOLS ? SYMBOLS[name] : name));
  // unknown escapes (\%, \$, \{) -> the character itself
  s = s.replace(/\\([^\w])/g, '$1');
  // superscripts / subscripts with braces or a single token
  s = s.replace(/\^\{([^{}]*)\}/g, (_, b: string) => scriptOf(SUPER)(b));
  s = s.replace(/\^(\w)/g, (_, b: string) => scriptOf(SUPER)(b));
  s = s.replace(/_\{([^{}]*)\}/g, (_, b: string) => scriptOf(SUB)(b));
  s = s.replace(/_(\w)/g, (_, b: string) => scriptOf(SUB)(b));
  // math delimiters ($, \( \), \[ \]) and math-mode braces/alignment chars
  s = s.replace(/\\\[|\\\]|\\\(|\\\)/g, ' ');
  s = s.replace(/\$+/g, '');
  // NB: '&' is left alone on purpose — "&" is how the authored titles read
  // ("Sequences & Series"), and a <title> that disagrees with the page H1 invites
  // Google to rewrite it. Next escapes it to &amp; in the tag.
  s = s.replace(/[{}]/g, '');
  // safety sweep: a stray backslash in a meta tag is always a defect, never information
  s = s.replace(/\\/g, '');
  // tidy: no space before punctuation, collapse runs of whitespace, no trailing separator
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/**
 * Google truncates titles by rendered pixel width (~600px), not characters. CJK and
 * fullwidth forms cost roughly double, so budgeting in characters would let a Chinese
 * topic title overflow. Counts fullwidth ranges as 2 cells, everything else as 1.
 */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += WIDE.test(ch) ? 2 : 1;
  return w;
}

/**
 * Clip to a display-width budget at the last whole word (no mid-word breaks, no
 * dangling punctuation). Falls back to a hard character cut for a single long token.
 */
export function clipToWidth(s: string, budget: number): string {
  if (displayWidth(s) <= budget) return s;
  const words = s.split(' ');
  let out = '';
  for (const word of words) {
    const candidate = out ? `${out} ${word}` : word;
    if (displayWidth(candidate) + 1 > budget) break; // +1 leaves room for the ellipsis
    out = candidate;
  }
  if (!out) out = [...s].slice(0, Math.max(1, budget - 1)).join('');
  return `${out.replace(/[,;:.!?\-–—]+$/, '')}…`;
}
