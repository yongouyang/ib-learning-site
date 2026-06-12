import fs from "fs";
import path from "path";
import katex from "katex";
import { topicSchema, type ValidatedTopic } from "../src/content/schema";

export type IssueSeverity = "warning" | "error";

export type IssueType =
  | "few_questions"
  | "suspicious_explanation"
  | "duplicate_id"
  | "folder_mismatch"
  | "latex_error"
  | "empty_flashcard"
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

export interface AuditInput {
  topics: AuditTopic[];
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

export function auditContent(input: AuditInput): AuditResult {
  const issues: AuditIssue[] = [];
  const { topics } = input;

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

  // Duplicate IDs across all topics (blocking CI error)
  const allItems: Array<IdItem & { topic: AuditTopic }> = [];
  for (const topic of topics) {
    for (const item of collectIds(topic)) {
      allItems.push({ ...item, topic });
    }
  }
  const globalDuplicateIds = findDuplicates(allItems.map((item) => item.id));
  for (const dupId of globalDuplicateIds) {
    const occurrences = allItems.filter((item) => item.id === dupId);
    const locations = occurrences.map((item) =>
      location(item.topic, item.kind, item.label),
    );
    issues.push({
      type: "duplicate_id",
      severity: "error",
      location: locations.join("; "),
      message: `ID "${dupId}" appears ${occurrences.length} times across topics`,
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
        issues.push({
          type: "latex_error",
          severity: "warning",
          location: `${location(topic)}/${field.path}`,
          message: latexIssue.message,
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
      .filter((f) => f.endsWith(".json"));

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
    case "empty_flashcard":
      return "Empty flashcard term/definition";
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
  const { input, unreadable } = loadTopicsFromDisk(topicsDir);
  const result = auditContent(input);

  console.log(formatReport(result, unreadable));

  const hasErrors =
    result.issues.some((i) => i.severity === "error") || unreadable.length > 0;
  process.exit(hasErrors ? 1 : 0);
}

if (require.main === module) {
  main();
}
