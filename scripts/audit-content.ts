import fs from "fs";
import path from "path";
import katex from "katex";
import { ORDER_FILE } from "./topic-order";
import {
  topicSchema,
  paperSchema,
  type ValidatedTopic,
  type ValidatedPaper,
} from "../src/content/schema";

export type IssueSeverity = "warning" | "error";

export type IssueType =
  | "few_questions"
  | "suspicious_explanation"
  | "duplicate_id"
  | "folder_mismatch"
  | "latex_error"
  | "latex_unicode"
  | "empty_flashcard"
  | "stray_backslash"
  | "unbalanced_bold"
  | "escaped_dollar"
  | "missing_difficulty"
  | "difficulty_distribution"
  | "variant_group"
  | "paper_quality"
  | "unreadable_topic";

export interface AuditIssue {
  type: IssueType;
  severity: IssueSeverity;
  location: string;
  message: string;
}

export interface AuditTopic extends ValidatedTopic {
  filePath: string;
  folderSubjectId: string;
}

export interface AuditPaper extends ValidatedPaper {
  filePath: string;
  folderCourseId: string;
}

export interface AuditInput {
  topics: AuditTopic[];
  papers?: AuditPaper[];
}

export interface AuditSummary {
  totalTopics: number;
  totalQuestions: number;
  averageQuestionsPerTopic: number;
}

export interface AuditResult {
  issues: AuditIssue[];
  summary: AuditSummary;
}

interface TextField {
  path: string;
  value: string;
}

interface IdItem {
  id: string;
  kind: "note" | "flashcard" | "question";
  label: string;
}

const MIN_QUESTION_COUNT = 5;
const MIN_EXPLANATION_LENGTH = 20;
// Phase 2: per-topic difficulty distribution targets (tuned to the 15-question standard).
const MIN_EASY_QUESTIONS = 3;
const MIN_HARD_QUESTIONS = 3;
// Variant-group topics (docs/question-variations-plan.md): the distribution
// minimums apply per GROUP (ungrouped questions count as singleton groups),
// since a session samples one question per group.
const MIN_EASY_GROUPS = 3;
const MIN_HARD_GROUPS = 3;
// Phase 4: free-response papers.
const MIN_MODEL_ANSWER_LENGTH = 40;
const MIN_MARKSCHEME_POINT_LENGTH = 8;

function location(topic: AuditTopic, kind?: string, id?: string): string {
  const base = `${topic.subjectId}/${topic.id}`;
  if (kind && id) return `${base}/${kind}/${id}`;
  return base;
}

function collectIds(topic: AuditTopic): IdItem[] {
  const items: IdItem[] = [];
  for (const note of topic.notes) {
    items.push({ id: note.id, kind: "note", label: note.id });
  }
  for (const fc of topic.flashcards) {
    items.push({ id: fc.id, kind: "flashcard", label: fc.id });
  }
  for (const q of topic.questions) {
    items.push({ id: q.id, kind: "question", label: q.id });
  }
  return items;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

function extractTextFields(topic: AuditTopic): TextField[] {
  const fields: TextField[] = [
    { path: "title", value: topic.title },
    { path: "description", value: topic.description },
  ];

  topic.notes.forEach((note, idx) => {
    fields.push({ path: `notes[${idx}].heading`, value: note.heading });
    fields.push({ path: `notes[${idx}].body`, value: note.body });
  });

  topic.flashcards.forEach((fc, idx) => {
    fields.push({ path: `flashcards[${idx}].term`, value: fc.term });
    fields.push({
      path: `flashcards[${idx}].definition`,
      value: fc.definition,
    });
    if (fc.example) {
      fields.push({ path: `flashcards[${idx}].example`, value: fc.example });
    }
  });

  topic.questions.forEach((q, idx) => {
    fields.push({ path: `questions[${idx}].stem`, value: q.stem });
    fields.push({
      path: `questions[${idx}].explanation`,
      value: q.explanation,
    });
    q.choices.forEach((choice, cidx) => {
      fields.push({
        path: `questions[${idx}].choices[${cidx}]`,
        value: choice,
      });
    });
  });

  return fields;
}

// Flags lines ending in a single "\" outside $$...$$ display-math blocks.
// Authors sometimes write a Markdown-style hard break, but the renderer does
// not interpret it — the backslash renders literally. Inside display math a
// line break must be "\\".
export function findStrayBackslashes(text: string): string[] {
  const flagged: string[] = [];
  let inDisplay = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const delimiterCount = (trimmed.match(/\$\$/g) || []).length;
    if (delimiterCount % 2 === 1) {
      inDisplay = !inDisplay;
      continue;
    }
    if (inDisplay) continue;
    if (trimmed.endsWith("\\") && !trimmed.endsWith("\\\\")) {
      flagged.push(trimmed.slice(0, 60));
    }
  }
  return flagged;
}

// Flags escaped dollars (\$) anywhere in content. The client renderer
// (renderInlineMath in src/components/InlineMath.tsx) splits text on $...$
// pairs with a naive regex that does NOT understand KaTeX's \$ escape, so a
// single \$ mis-pairs the surrounding delimiters and garbles the text (the
// math-yr7-money-finance "＄2.45" ladder bug, fixed 2026-08-22). Currency
// amounts are written with the fullwidth ＄ (U+FF04) as plain text instead —
// the splitter never treats it as a delimiter.
export function findEscapedDollarIssues(text: string): string[] {
  const matches = text.match(/\\\$/g);
  if (!matches) return [];
  return [
    `${matches.length} escaped dollar(s) "\\$" — renderInlineMath garbles these; write currency with the fullwidth ＄ instead`,
  ];
}

// Flags invalid ** bold markup (rendered by renderInlineMath in
// src/components/InlineMath.tsx). A valid segment is **...** on one line with
// plain text inside — no nested "*", no "$" (bold must not span math). Empty
// (****) and unpaired markers render literally, so they are flagged here.
export function findBoldIssues(text: string): string[] {
  const issues: string[] = [];
  // A pair whose content contains "$" spans math — the renderer can't bold it.
  for (const match of text.matchAll(/\*\*([^*\n]+?)\*\*/g)) {
    if (match[1].includes("$")) {
      issues.push(
        `Bold segment spans math (unsupported): "${match[0].slice(0, 60)}"`,
      );
    }
  }
  // Strip inline math first so ** inside $...$ (e.g. $x**2$) is not flagged,
  // then remove valid pairs; any ** left over is unpaired or empty (****).
  const withoutMath = text.replace(/\$[^$\n]+\$/g, "");
  const unpaired = withoutMath.replace(/\*\*[^*\n]+?\*\*/g, "").match(/\*\*/g);
  if (unpaired) {
    issues.push(`${unpaired.length} unpaired "**" marker(s)`);
  }
  return issues;
}

interface LatexIssue {
  message: string;
  math?: string;
}

export function findLatexIssues(text: string): LatexIssue[] {
  const issues: LatexIssue[] = [];
  let i = 0;
  let state: "text" | "inline" | "display" = "text";
  let mathStart = -1;

  while (i < text.length) {
    // Skip escaped characters (e.g. \$)
    if (text[i] === "\\" && i + 1 < text.length) {
      i += 2;
      continue;
    }

    if (text[i] !== "$") {
      i += 1;
      continue;
    }

    // Display delimiter $$
    if (i + 1 < text.length && text[i + 1] === "$") {
      if (state === "text") {
        state = "display";
        mathStart = i + 2;
      } else if (state === "display") {
        const math = text.slice(mathStart, i);
        if (containsNonAscii(math)) {
          issues.push({ message: "Display math contains non-ASCII characters", math });
        }
        const error = checkKatex(math, true);
        if (error) {
          issues.push({ message: `Display math parse error: ${error}`, math });
        }
        state = "text";
        mathStart = -1;
      } else {
        issues.push({ message: "Unexpected $$ delimiter inside inline math" });
      }
      i += 2;
      continue;
    }

    // Inline delimiter $
    if (state === "text") {
      state = "inline";
      mathStart = i + 1;
    } else if (state === "inline") {
      const math = text.slice(mathStart, i);
      if (containsNonAscii(math)) {
        issues.push({ message: "Inline math contains non-ASCII characters", math });
      }
      const error = checkKatex(math, false);
      if (error) {
        issues.push({ message: `Inline math parse error: ${error}`, math });
      }
      state = "text";
      mathStart = -1;
    }
    // $ inside display math is part of the formula; ignore.
    i += 1;
  }

  if (state !== "text") {
    const delimiter = state === "inline" ? "$" : "$$";
    issues.push({ message: `Unmatched ${delimiter} delimiter` });
  }

  return issues;
}

function checkKatex(math: string, displayMode: boolean): string | null {
  try {
    katex.renderToString(math, { throwOnError: true, displayMode });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function containsNonAscii(math: string): boolean {
  for (const ch of math) {
    if (ch.codePointAt(0)! > 127) return true;
  }
  return false;
}

export function auditContent(input: AuditInput): AuditResult {
  const issues: AuditIssue[] = [];
  const { topics } = input;
  const papers = input.papers ?? [];

  // Folder mismatch (blocking CI error)
  for (const topic of topics) {
    if (topic.subjectId !== topic.folderSubjectId) {
      issues.push({
        type: "folder_mismatch",
        severity: "error",
        location: location(topic),
        message: `subjectId "${topic.subjectId}" does not match parent folder "${topic.folderSubjectId}"`,
      });
    }
  }

  // Paper folder mismatch (blocking CI error)
  for (const paper of papers) {
    if (paper.courseId !== paper.folderCourseId) {
      issues.push({
        type: "folder_mismatch",
        severity: "error",
        location: `papers/${paper.id}`,
        message: `courseId "${paper.courseId}" does not match parent folder "${paper.folderCourseId}"`,
      });
    }
  }

  // Paper question quality: missing difficulty (aggregated), thin model
  // answers and markscheme points.
  for (const paper of papers) {
    const untagged = paper.questions.filter((q) => q.difficulty === undefined);
    if (untagged.length > 0) {
      issues.push({
        type: "missing_difficulty",
        severity: "warning",
        location: `papers/${paper.id}`,
        message: `Paper has ${untagged.length} of ${paper.questions.length} question(s) without a difficulty tag`,
      });
    }
    for (const q of paper.questions) {
      if (q.modelAnswer.length < MIN_MODEL_ANSWER_LENGTH) {
        issues.push({
          type: "paper_quality",
          severity: "warning",
          location: `papers/${paper.id}/question/${q.id}`,
          message: `Model answer is ${q.modelAnswer.length} characters long (minimum recommended is ${MIN_MODEL_ANSWER_LENGTH})`,
        });
      }
      for (const point of q.markscheme) {
        if (point.length < MIN_MARKSCHEME_POINT_LENGTH) {
          issues.push({
            type: "paper_quality",
            severity: "warning",
            location: `papers/${paper.id}/question/${q.id}`,
            message: `Markscheme point is ${point.length} characters long (minimum recommended is ${MIN_MARKSCHEME_POINT_LENGTH}): "${point}"`,
          });
        }
      }
    }
  }

  // Few questions
  for (const topic of topics) {
    if (topic.questions.length < MIN_QUESTION_COUNT) {
      issues.push({
        type: "few_questions",
        severity: "warning",
        location: location(topic),
        message: `Topic has ${topic.questions.length} question(s); minimum recommended is ${MIN_QUESTION_COUNT}`,
      });
    }
  }

  // Missing difficulty tags (one aggregated warning per topic)
  for (const topic of topics) {
    const untagged = topic.questions.filter((q) => q.difficulty === undefined);
    if (untagged.length > 0) {
      issues.push({
        type: "missing_difficulty",
        severity: "warning",
        location: location(topic),
        message: `Topic has ${untagged.length} of ${topic.questions.length} question(s) without a difficulty tag`,
      });
    }
  }

  // Difficulty distribution (only meaningful once a topic is fully tagged).
  // Topics with variant groups are counted per GROUP (a session samples one
  // question per group); ungrouped questions count as singleton groups, so
  // fully-ungrouped topics get the original per-question counts.
  for (const topic of topics) {
    if (topic.questions.some((q) => q.difficulty === undefined)) continue;
    const hasGroups = topic.questions.some((q) => q.variantOf !== undefined);
    if (hasGroups) {
      const groupBands = new Map<string, string>();
      for (const q of topic.questions) {
        const key = q.variantOf ?? `solo:${q.id}`;
        if (!groupBands.has(key)) groupBands.set(key, q.difficulty!);
      }
      const bands = Array.from(groupBands.values());
      const easyGroups = bands.filter((b) => b === "easy").length;
      const hardGroups = bands.filter((b) => b === "hard").length;
      if (easyGroups < MIN_EASY_GROUPS || hardGroups < MIN_HARD_GROUPS) {
        issues.push({
          type: "difficulty_distribution",
          severity: "warning",
          location: location(topic),
          message: `Topic has ${easyGroups} easy / ${hardGroups} hard variant group(s); minimum is ${MIN_EASY_GROUPS} easy and ${MIN_HARD_GROUPS} hard (per-group basis)`,
        });
      }
      continue;
    }
    const easyCount = topic.questions.filter(
      (q) => q.difficulty === "easy",
    ).length;
    const hardCount = topic.questions.filter(
      (q) => q.difficulty === "hard",
    ).length;
    if (easyCount < MIN_EASY_QUESTIONS || hardCount < MIN_HARD_QUESTIONS) {
      issues.push({
        type: "difficulty_distribution",
        severity: "warning",
        location: location(topic),
        message: `Topic has ${easyCount} easy / ${hardCount} hard question(s); minimum is ${MIN_EASY_QUESTIONS} easy and ${MIN_HARD_QUESTIONS} hard`,
      });
    }
  }

  // Variant-group hygiene: an explicit variantOf with a single member is
  // almost always a mistyped group key (a question that should have joined an
  // existing group). Mixed-difficulty groups are a validate-content error.
  for (const topic of topics) {
    const groupSizes = new Map<string, number>();
    for (const q of topic.questions) {
      if (q.variantOf === undefined) continue;
      groupSizes.set(q.variantOf, (groupSizes.get(q.variantOf) ?? 0) + 1);
    }
    for (const [key, size] of groupSizes) {
      if (size === 1) {
        issues.push({
          type: "variant_group",
          severity: "warning",
          location: location(topic),
          message: `Variant group "${key}" has a single member; remove the tag or add a second variant`,
        });
      }
    }
  }

  // Suspicious explanations
  for (const topic of topics) {
    for (const q of topic.questions) {
      if (q.explanation === q.stem) {
        issues.push({
          type: "suspicious_explanation",
          severity: "warning",
          location: location(topic, "question", q.id),
          message: "Explanation is identical to the stem",
        });
      }
      if (q.explanation.length < MIN_EXPLANATION_LENGTH) {
        issues.push({
          type: "suspicious_explanation",
          severity: "warning",
          location: location(topic, "question", q.id),
          message: `Explanation is ${q.explanation.length} characters long (minimum recommended is ${MIN_EXPLANATION_LENGTH})`,
        });
      }
    }
  }

  // Duplicate IDs within a topic (warning)
  for (const topic of topics) {
    const items = collectIds(topic);
    const duplicateIds = findDuplicates(items.map((item) => item.id));
    for (const dupId of duplicateIds) {
      const occurrences = items.filter((item) => item.id === dupId);
      const details = occurrences
        .map((item) => `${item.kind} ${item.label}`)
        .join(", ");
      issues.push({
        type: "duplicate_id",
        severity: "warning",
        location: location(topic),
        message: `Duplicate ID "${dupId}" within topic: ${details}`,
      });
    }
  }

  // Duplicate IDs across all topics and papers (blocking CI error)
  const allItems: Array<IdItem & { loc: string }> = [];
  for (const topic of topics) {
    for (const item of collectIds(topic)) {
      allItems.push({ ...item, loc: location(topic, item.kind, item.label) });
    }
  }
  for (const paper of papers) {
    for (const q of paper.questions) {
      allItems.push({ id: q.id, kind: "question", label: q.id, loc: `papers/${paper.id}/question/${q.id}` });
    }
  }
  const globalDuplicateIds = findDuplicates(allItems.map((item) => item.id));
  for (const dupId of globalDuplicateIds) {
    const occurrences = allItems.filter((item) => item.id === dupId);
    const locations = occurrences.map((item) => item.loc);
    issues.push({
      type: "duplicate_id",
      severity: "error",
      location: locations.join("; "),
      message: `ID "${dupId}" appears ${occurrences.length} times across topics and papers`,
    });
  }

  // Empty flashcard term/definition (beyond schema length check)
  for (const topic of topics) {
    for (const fc of topic.flashcards) {
      if (fc.term.trim() === "") {
        issues.push({
          type: "empty_flashcard",
          severity: "warning",
          location: location(topic, "flashcard", fc.id),
          message: "Flashcard term is empty or whitespace-only",
        });
      }
      if (fc.definition.trim() === "") {
        issues.push({
          type: "empty_flashcard",
          severity: "warning",
          location: location(topic, "flashcard", fc.id),
          message: "Flashcard definition is empty or whitespace-only",
        });
      }
    }
  }

  // LaTeX red flags
  for (const topic of topics) {
    for (const field of extractTextFields(topic)) {
      const latexIssues = findLatexIssues(field.value);
      for (const latexIssue of latexIssues) {
        const isUnicode = latexIssue.message.includes("non-ASCII");
        issues.push({
          type: isUnicode ? "latex_unicode" : "latex_error",
          severity: isUnicode ? "error" : "warning",
          location: `${location(topic)}/${field.path}`,
          message: latexIssue.message,
        });
      }
    }
  }

  // LaTeX red flags in papers (stems, markscheme points, model answers)
  for (const paper of papers) {
    const fields: TextField[] = [];
    paper.questions.forEach((q, idx) => {
      fields.push({ path: `questions[${idx}].stem`, value: q.stem });
      fields.push({ path: `questions[${idx}].modelAnswer`, value: q.modelAnswer });
      q.markscheme.forEach((point, pidx) => {
        fields.push({ path: `questions[${idx}].markscheme[${pidx}]`, value: point });
      });
    });
    for (const field of fields) {
      const latexIssues = findLatexIssues(field.value);
      for (const latexIssue of latexIssues) {
        const isUnicode = latexIssue.message.includes("non-ASCII");
        issues.push({
          type: isUnicode ? "latex_unicode" : "latex_error",
          severity: isUnicode ? "error" : "warning",
          location: `papers/${paper.id}/${field.path}`,
          message: latexIssue.message,
        });
      }
    }
  }

  // Stray trailing backslashes outside display math (renders literally)
  for (const topic of topics) {
    topic.notes.forEach((note, idx) => {
      for (const line of findStrayBackslashes(note.body)) {
        issues.push({
          type: "stray_backslash",
          severity: "warning",
          location: `${location(topic)}/notes[${idx}].body`,
          message: `Line ends with a stray "\\" outside math: "${line}"`,
        });
      }
    });
  }

  // Invalid ** bold markup (unpaired, empty, or spanning math renders literally)
  for (const topic of topics) {
    for (const field of extractTextFields(topic)) {
      for (const message of findBoldIssues(field.value)) {
        issues.push({
          type: "unbalanced_bold",
          severity: "warning",
          location: `${location(topic)}/${field.path}`,
          message,
        });
      }
    }
  }
  for (const paper of papers) {
    const fields: TextField[] = [];
    paper.questions.forEach((q, idx) => {
      fields.push({ path: `questions[${idx}].stem`, value: q.stem });
      fields.push({ path: `questions[${idx}].modelAnswer`, value: q.modelAnswer });
      q.markscheme.forEach((point, pidx) => {
        fields.push({ path: `questions[${idx}].markscheme[${pidx}]`, value: point });
      });
    });
    for (const field of fields) {
      for (const message of findBoldIssues(field.value)) {
        issues.push({
          type: "unbalanced_bold",
          severity: "warning",
          location: `papers/${paper.id}/${field.path}`,
          message,
        });
      }
    }
  }

  // Escaped dollars (\$) — garbled by renderInlineMath (see findEscapedDollarIssues)
  for (const topic of topics) {
    for (const field of extractTextFields(topic)) {
      for (const message of findEscapedDollarIssues(field.value)) {
        issues.push({
          type: "escaped_dollar",
          severity: "warning",
          location: `${location(topic)}/${field.path}`,
          message,
        });
      }
    }
  }
  for (const paper of papers) {
    const fields: TextField[] = [];
    paper.questions.forEach((q, idx) => {
      fields.push({ path: `questions[${idx}].stem`, value: q.stem });
      fields.push({ path: `questions[${idx}].modelAnswer`, value: q.modelAnswer });
      q.markscheme.forEach((point, pidx) => {
        fields.push({ path: `questions[${idx}].markscheme[${pidx}]`, value: point });
      });
    });
    for (const field of fields) {
      for (const message of findEscapedDollarIssues(field.value)) {
        issues.push({
          type: "escaped_dollar",
          severity: "warning",
          location: `papers/${paper.id}/${field.path}`,
          message,
        });
      }
    }
  }

  const totalQuestions = topics.reduce(
    (sum, topic) => sum + topic.questions.length,
    0,
  );
  const averageQuestionsPerTopic =
    topics.length === 0
      ? 0
      : Math.round((totalQuestions / topics.length) * 100) / 100;

  return {
    issues,
    summary: {
      totalTopics: topics.length,
      totalQuestions,
      averageQuestionsPerTopic,
    },
  };
}

export interface LoadResult {
  input: AuditInput;
  unreadable: Array<{ filePath: string; error: string }>;
}

export function loadTopicsFromDisk(topicsDir: string): LoadResult {
  const topics: AuditTopic[] = [];
  const unreadable: Array<{ filePath: string; error: string }> = [];

  const subjectDirs = fs.readdirSync(topicsDir).filter((name) => {
    const full = path.join(topicsDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const subjectDir of subjectDirs) {
    const subjectPath = path.join(topicsDir, subjectDir);
    const files = fs
      .readdirSync(subjectPath)
      .filter((f) => f.endsWith(".json") && f !== ORDER_FILE);

    for (const file of files) {
      const filePath = path.join(subjectPath, file);
      const relativePath = path.relative(process.cwd(), filePath);
      const raw = fs.readFileSync(filePath, "utf8");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        unreadable.push({
          filePath: relativePath,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const result = topicSchema.safeParse(parsed);
      if (!result.success) {
        unreadable.push({
          filePath: relativePath,
          error: result.error.message,
        });
        continue;
      }

      topics.push({
        ...result.data,
        filePath: relativePath,
        folderSubjectId: subjectDir,
      });
    }
  }

  return { input: { topics }, unreadable };
}

export function loadPapersFromDisk(papersDir: string): {
  papers: AuditPaper[];
  unreadable: Array<{ filePath: string; error: string }>;
} {
  const papers: AuditPaper[] = [];
  const unreadable: Array<{ filePath: string; error: string }> = [];
  if (!fs.existsSync(papersDir)) return { papers, unreadable };

  const courseDirs = fs.readdirSync(papersDir).filter((name) => {
    const full = path.join(papersDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const courseDir of courseDirs) {
    const dirPath = path.join(papersDir, courseDir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const relativePath = path.relative(process.cwd(), filePath);
      const raw = fs.readFileSync(filePath, "utf8");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        unreadable.push({
          filePath: relativePath,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const result = paperSchema.safeParse(parsed);
      if (!result.success) {
        unreadable.push({ filePath: relativePath, error: result.error.message });
        continue;
      }

      papers.push({ ...result.data, filePath: relativePath, folderCourseId: courseDir });
    }
  }

  return { papers, unreadable };
}

function groupByType(issues: AuditIssue[]): Record<IssueType, AuditIssue[]> {
  const grouped = {} as Record<IssueType, AuditIssue[]>;
  for (const issue of issues) {
    if (!grouped[issue.type]) grouped[issue.type] = [];
    grouped[issue.type].push(issue);
  }
  return grouped;
}

function issueTypeLabel(type: IssueType): string {
  switch (type) {
    case "few_questions":
      return "Topics with fewer than 5 questions";
    case "suspicious_explanation":
      return "Suspicious explanations";
    case "duplicate_id":
      return "Duplicate IDs";
    case "folder_mismatch":
      return "Folder / subjectId mismatches";
    case "latex_error":
      return "LaTeX red flags";
    case "latex_unicode":
      return "LaTeX contains non-ASCII characters";
    case "empty_flashcard":
      return "Empty flashcard term/definition";
    case "stray_backslash":
      return "Lines ending with a stray backslash";
    case "unbalanced_bold":
      return "Unpaired or invalid ** bold markers";
    case "escaped_dollar":
      return "Escaped dollars (\\$) garbled by the renderer";
    case "missing_difficulty":
      return "Questions without a difficulty tag";
    case "difficulty_distribution":
      return "Difficulty distribution below minimum";
    case "variant_group":
      return "Variant group issues";
    case "paper_quality":
      return "Paper model answers / markscheme quality";
    case "unreadable_topic":
      return "Unreadable topic files";
    default:
      return type;
  }
}

export function formatReport(
  result: AuditResult,
  unreadable: Array<{ filePath: string; error: string }> = [],
): string {
  const lines: string[] = [];
  lines.push("Content Audit Report");
  lines.push("====================\n");

  const allIssues = [
    ...result.issues,
    ...unreadable.map((u) => ({
      type: "unreadable_topic" as IssueType,
      severity: "warning" as IssueSeverity,
      location: u.filePath,
      message: `Could not read or validate file: ${u.error}`,
    })),
  ];

  if (allIssues.length === 0) {
    lines.push("No issues found.\n");
  } else {
    const grouped = groupByType(allIssues);
    for (const type of Object.keys(grouped) as IssueType[]) {
      const issues = grouped[type];
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warningCount = issues.filter(
        (i) => i.severity === "warning",
      ).length;
      const suffix =
        errorCount > 0 || warningCount > 0
          ? ` (${errorCount > 0 ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : ""}${errorCount > 0 && warningCount > 0 ? ", " : ""}${warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""})`
          : "";
      lines.push(`\n${issueTypeLabel(type)}${suffix}`);
      lines.push(
        "-".repeat(issueTypeLabel(type).length) +
          (suffix ? "-".repeat(suffix.length) : ""),
      );

      for (const issue of issues) {
        const marker = issue.severity === "error" ? "✗" : "⚠";
        lines.push(`  ${marker} [${issue.location}] ${issue.message}`);
      }
    }
  }

  lines.push("\nSummary");
  lines.push("-------");
  lines.push(`  Total topics: ${result.summary.totalTopics}`);
  lines.push(`  Total questions: ${result.summary.totalQuestions}`);
  lines.push(
    `  Average questions per topic: ${result.summary.averageQuestionsPerTopic.toFixed(2)}`,
  );

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  lines.push(`\n${errorCount} error(s), ${warningCount} warning(s).`);

  return lines.join("\n");
}

export function main(): void {
  const topicsDir = path.resolve(__dirname, "../src/content/data/topics");
  const papersDir = path.resolve(__dirname, "../src/content/data/papers");
  const { input, unreadable } = loadTopicsFromDisk(topicsDir);
  const papersResult = loadPapersFromDisk(papersDir);
  input.papers = papersResult.papers;
  const allUnreadable = [...unreadable, ...papersResult.unreadable];
  const result = auditContent(input);

  console.log(formatReport(result, allUnreadable));

  const errorCount = result.issues.filter((i) => i.severity === "error").length;
  const warningCount = result.issues.filter(
    (i) => i.severity === "warning",
  ).length;
  if (errorCount > 0 || warningCount > 0 || allUnreadable.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}
