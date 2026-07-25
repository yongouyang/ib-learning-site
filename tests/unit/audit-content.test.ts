import { describe, it, expect } from "vitest";
import {
  auditContent,
  findLatexIssues,
  type AuditTopic,
} from "../../scripts/audit-content";
import type { Question } from "@/content/types";

function makeTopic(
  overrides: Partial<AuditTopic> & { id: string; subjectId: string },
): AuditTopic {
  return {
    id: overrides.id,
    subjectId: overrides.subjectId,
    title: overrides.title ?? "Test Topic",
    description: overrides.description ?? "A topic for testing.",
    stage: "ks3" as const,
    notes: overrides.notes ?? [
      { id: "n1", heading: "Note 1", body: "Body of note 1." },
    ],
    flashcards: overrides.flashcards ?? [
      { id: "f1", term: "Term 1", definition: "Definition of term 1." },
    ],
    questions: overrides.questions ?? [
      {
        id: "q1",
        stem: "What is the answer?",
        choices: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "This is the explanation for the correct answer.",
      },
    ],
    filePath: `topics/${overrides.subjectId}/${overrides.id}.json`,
    folderSubjectId: overrides.folderSubjectId ?? overrides.subjectId,
  };
}

function makeValidQuestions(prefix: string, count = 5): Question[] {
  // Difficulty pattern: first 3 easy, last 3 hard (when count >= 6), rest medium —
  // satisfies the audit distribution rule (>=3 easy, >=3 hard) for count >= 6.
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-q${i + 1}`,
    stem: `Stem ${i + 1} for ${prefix}`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `This is a sufficiently long explanation for question ${i + 1} of ${prefix}.`,
    difficulty: (i < 3 ? 'easy' : i >= count - 3 ? 'hard' : 'medium') as
      | 'easy'
      | 'medium'
      | 'hard',
  }));
}

describe("auditContent", () => {
  it("returns an empty result for valid content", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      notes: [{ id: "test-topic-n1", heading: "Note 1", body: "Body of note 1." }],
      flashcards: [
        { id: "test-topic-f1", term: "Term 1", definition: "Definition of term 1." },
      ],
      questions: makeValidQuestions("test-topic", 6),
    });
    const result = auditContent({ topics: [topic] });
    expect(result.issues).toHaveLength(0);
    expect(result.summary.totalTopics).toBe(1);
    expect(result.summary.totalQuestions).toBe(6);
  });

  it("aggregates missing difficulty tags into one warning per topic", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      questions: makeValidQuestions("test-topic").map(
        ({ difficulty: _omitted, ...q }) => q,
      ),
    });
    const result = auditContent({ topics: [topic] });
    const issues = result.issues.filter((i) => i.type === "missing_difficulty");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("5 of 5");
  });

  it("skips the distribution check while a topic is only partially tagged", () => {
    const questions = makeValidQuestions("test-topic", 6);
    delete questions[0].difficulty;
    const topic = makeTopic({ id: "test-topic", subjectId: "math", questions });
    const result = auditContent({ topics: [topic] });
    expect(
      result.issues.find((i) => i.type === "difficulty_distribution"),
    ).toBeUndefined();
    expect(
      result.issues.find((i) => i.type === "missing_difficulty"),
    ).toBeDefined();
  });

  it("warns when a fully tagged topic has too few easy or hard questions", () => {
    // 6 questions, all medium: fully tagged, but 0 easy / 0 hard.
    const questions = makeValidQuestions("test-topic", 6).map((q) => ({
      ...q,
      difficulty: "medium" as const,
    }));
    const topic = makeTopic({ id: "test-topic", subjectId: "math", questions });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find((i) => i.type === "difficulty_distribution");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(issue!.message).toContain("0 easy / 0 hard");
  });

  it("detects folder / subjectId mismatches as errors", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      folderSubjectId: "biology",
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find((i) => i.type === "folder_mismatch");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
    expect(issue!.message).toContain("math");
    expect(issue!.message).toContain("biology");
  });

  it("detects topics with fewer than 5 questions as warnings", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      questions: [
        {
          id: "q1",
          stem: "Stem 1",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Explanation with enough length.",
        },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find((i) => i.type === "few_questions");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(issue!.message).toContain("1 question");
  });

  it("detects explanations identical to the stem", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      questions: [
        {
          id: "q1",
          stem: "This is exactly the same text.",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "This is exactly the same text.",
        },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find(
      (i) =>
        i.type === "suspicious_explanation" && i.message.includes("identical"),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
  });

  it("detects suspiciously short explanations", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      questions: [
        {
          id: "q1",
          stem: "What is 2 + 2?",
          choices: ["2", "3", "4", "5"],
          correctIndex: 2,
          explanation: "It is 4.",
        },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find(
      (i) => i.type === "suspicious_explanation",
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(issue!.message).toContain("8 characters");
  });

  it("detects duplicate IDs within a topic as warnings", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      notes: [
        { id: "same-id", heading: "First", body: "First body." },
        { id: "same-id", heading: "Second", body: "Second body." },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find(
      (i) => i.type === "duplicate_id" && i.severity === "warning",
    );
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("same-id");
  });

  it("detects duplicate IDs across topics as errors", () => {
    const topicA = makeTopic({ id: "topic-a", subjectId: "math" });
    const topicB = makeTopic({ id: "topic-b", subjectId: "math" });
    const result = auditContent({ topics: [topicA, topicB] });
    const issue = result.issues.find(
      (i) => i.type === "duplicate_id" && i.severity === "error",
    );
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("across topics");
  });

  it("detects empty or whitespace-only flashcard term/definition", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      flashcards: [
        { id: "f1", term: "   ", definition: "Valid definition." },
        { id: "f2", term: "Valid term", definition: "\t\n" },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const termIssue = result.issues.find(
      (i) => i.type === "empty_flashcard" && i.message.includes("term"),
    );
    const definitionIssue = result.issues.find(
      (i) => i.type === "empty_flashcard" && i.message.includes("definition"),
    );
    expect(termIssue).toBeDefined();
    expect(definitionIssue).toBeDefined();
  });

  it("reports LaTeX issues in topic text fields", () => {
    const topic = makeTopic({
      id: "test-topic",
      subjectId: "math",
      notes: [
        { id: "n1", heading: "Broken math", body: "This is $ unclosed." },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issue = result.issues.find((i) => i.type === "latex_error");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(issue!.message).toContain("Unmatched");
  });

  it("computes summary counts correctly", () => {
    const topicA = makeTopic({ id: "topic-a", subjectId: "math" });
    const topicB = makeTopic({
      id: "topic-b",
      subjectId: "math",
      questions: [
        {
          id: "q1",
          stem: "Stem 1",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Explanation with enough length one.",
        },
        {
          id: "q2",
          stem: "Stem 2",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Explanation with enough length two.",
        },
      ],
    });
    const result = auditContent({ topics: [topicA, topicB] });
    // The two topics share IDs, so duplicate_id errors exist; summary should still be correct.
    expect(result.summary.totalTopics).toBe(2);
    expect(result.summary.totalQuestions).toBe(3);
    expect(result.summary.averageQuestionsPerTopic).toBe(1.5);
  });
});

describe("findLatexIssues", () => {
  it("returns no issues for plain text", () => {
    expect(findLatexIssues("No math here.")).toHaveLength(0);
  });

  it("returns no issues for valid inline math", () => {
    expect(findLatexIssues("The answer is $x = 2$.")).toHaveLength(0);
  });

  it("flags unmatched inline delimiter", () => {
    const issues = findLatexIssues("This is $ unclosed.");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Unmatched $");
  });

  it("flags unmatched display delimiter", () => {
    const issues = findLatexIssues("$$ a^2 + b^2 = c^2");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Unmatched $$");
  });

  it("flags invalid KaTeX syntax", () => {
    const issues = findLatexIssues("Bad formula: $\\frac{1}$.");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain("parse error");
  });

  it("ignores escaped dollar signs", () => {
    expect(findLatexIssues("It costs \\$5 and \\$10.")).toHaveLength(0);
  });
});
