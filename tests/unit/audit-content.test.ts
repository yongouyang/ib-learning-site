import { describe, it, expect } from "vitest";
import {
  auditContent,
  findBoldIssues,
  findEscapedDollarIssues,
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


describe("auditContent variant-group rules", () => {
  function groupQuestion(
    id: string,
    variantOf: string | undefined,
    difficulty: "easy" | "medium" | "hard",
  ): Question {
    return {
      id,
      stem: `Stem ${id}`,
      choices: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: `This is a sufficiently long explanation for ${id}.`,
      difficulty,
      ...(variantOf ? { variantOf } : {}),
    };
  }

  // 10 groups x 2 variants: 3 easy, 4 medium, 3 hard — valid on a per-group basis.
  function makeGroupedQuestions(): Question[] {
    const bands: Array<["easy" | "medium" | "hard", number]> = [
      ["easy", 3],
      ["medium", 4],
      ["hard", 3],
    ];
    const questions: Question[] = [];
    for (const [band, groupCount] of bands) {
      for (let g = 0; g < groupCount; g++) {
        for (let v = 0; v < 2; v++) {
          questions.push(groupQuestion(`${band}-g${g}-v${v}`, `${band}-skill-${g}`, band));
        }
      }
    }
    return questions;
  }

  it("accepts a grouped topic meeting the per-group distribution", () => {
    const topic = makeTopic({
      id: "grouped-topic",
      subjectId: "math",
      questions: makeGroupedQuestions(),
    });
    const result = auditContent({ topics: [topic] });
    expect(result.issues).toHaveLength(0);
  });

  it("warns when easy/hard GROUP counts fall short even though question counts pass", () => {
    // 1 easy group x 3 variants = 3 easy questions but only 1 easy group.
    const questions = [
      ...[0, 1, 2].map((v) => groupQuestion(`e-v${v}`, "easy-skill-0", "easy")),
      ...[0, 1, 2, 3].flatMap((g) =>
        [0, 1].map((v) => groupQuestion(`m-g${g}-v${v}`, `medium-skill-${g}`, "medium")),
      ),
      ...[0, 1, 2].flatMap((g) =>
        [0, 1].map((v) => groupQuestion(`h-g${g}-v${v}`, `hard-skill-${g}`, "hard")),
      ),
    ];
    const topic = makeTopic({ id: "skewed-topic", subjectId: "math", questions });
    const result = auditContent({ topics: [topic] });
    const issues = result.issues.filter((i) => i.type === "difficulty_distribution");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("per-group basis");
    expect(issues[0].message).toContain("1 easy");
  });

  it("warns on a single-member explicit variant group", () => {
    const questions = [
      ...makeGroupedQuestions(),
      groupQuestion("lonely-q", "lonely-group", "medium"),
    ];
    const topic = makeTopic({ id: "lonely-topic", subjectId: "math", questions });
    const result = auditContent({ topics: [topic] });
    const issues = result.issues.filter((i) => i.type === "variant_group");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("lonely-group");
  });

  it("does not apply group rules to ungrouped topics", () => {
    const topic = makeTopic({
      id: "plain-topic",
      subjectId: "math",
      questions: makeValidQuestions("plain", 6),
    });
    const result = auditContent({ topics: [topic] });
    expect(result.issues.filter((i) => i.type === "variant_group")).toHaveLength(0);
    expect(result.issues.filter((i) => i.type === "difficulty_distribution")).toHaveLength(0);
  });
});

describe("findBoldIssues", () => {
  it("accepts balanced ** bold segments, including mid-word and several per line", () => {
    expect(findBoldIssues("A **variable** is a letter. **ein**steigen")).toHaveLength(0);
    expect(findBoldIssues("**Key Points:** remember **this** and **that**")).toHaveLength(0);
  });

  it("flags an unpaired ** marker", () => {
    expect(findBoldIssues("A **variable is a letter")).toHaveLength(1);
    expect(findBoldIssues("A **variable is a letter")[0]).toContain("unpaired");
  });

  it("flags an odd number of markers even when some pair up", () => {
    expect(findBoldIssues("**ok** trailing **")).toHaveLength(1);
  });

  it("flags empty **** markers", () => {
    const issues = findBoldIssues("empty **** here");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("unpaired");
  });

  it("flags bold spanning math (unsupported by the renderer)", () => {
    const issues = findBoldIssues("The **value $x+1$ here** matters");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("spans math");
  });

  it("does not flag ** inside $...$ math", () => {
    expect(findBoldIssues("Compute $x**2$ carefully")).toHaveLength(0);
  });

  it("does not flag bold across separate lines (pairs must be per-line)", () => {
    expect(findBoldIssues("**start\nend**")).toHaveLength(1);
  });
});

describe("auditContent unbalanced_bold rule", () => {
  it("warns on unpaired ** in a note body", () => {
    const topic = makeTopic({
      id: "bold-topic",
      subjectId: "german",
      notes: [{ id: "bold-topic-n1", heading: "Note 1", body: "Say **gern without closing." }],
    });
    const result = auditContent({ topics: [topic] });
    const issues = result.issues.filter((i) => i.type === "unbalanced_bold");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].location).toContain("bold-topic/notes[0].body");
  });

  it("accepts balanced ** bold in any text field", () => {
    const topic = makeTopic({
      id: "bold-ok",
      subjectId: "chinese",
      notes: [{ id: "bold-ok-n1", heading: "Note 1", body: "**戴** means to wear." }],
      flashcards: [{ id: "f1", term: "**hěn**", definition: "Very (adverb)." }],
    });
    const result = auditContent({ topics: [topic] });
    expect(result.issues.filter((i) => i.type === "unbalanced_bold")).toHaveLength(0);
  });
});

describe("findEscapedDollarIssues", () => {
  it("accepts plain text and fullwidth ＄ currency", () => {
    expect(findEscapedDollarIssues("A pen costs ＄2.45.")).toHaveLength(0);
    expect(findEscapedDollarIssues("No money here, just $x+1$ math.")).toHaveLength(0);
  });

  it("flags a KaTeX-escaped dollar", () => {
    const issues = findEscapedDollarIssues("A pen costs $\\$2.45$.");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("fullwidth ＄");
  });

  it("counts multiple escaped dollars in one message", () => {
    const issues = findEscapedDollarIssues("$\\$2.45$ and $\\$3.85$");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("2 escaped dollar(s)");
  });
});

describe("auditContent escaped_dollar rule", () => {
  it("warns on an escaped dollar in a question stem", () => {
    const topic = makeTopic({
      id: "dollar-topic",
      subjectId: "math",
      questions: [
        {
          id: "dollar-topic-q1",
          stem: "A pen costs $\\$2.45$. What is it?",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "This is a sufficiently long explanation for the dollar question.",
          difficulty: "easy",
        },
      ],
    });
    const result = auditContent({ topics: [topic] });
    const issues = result.issues.filter((i) => i.type === "escaped_dollar");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].location).toContain("dollar-topic/questions[0].stem");
  });

  it("accepts fullwidth ＄ currency in any text field", () => {
    const topic = makeTopic({
      id: "dollar-ok",
      subjectId: "math",
      notes: [{ id: "dollar-ok-n1", heading: "Note 1", body: "It costs ＄12.45 in total." }],
      questions: [
        {
          id: "dollar-ok-q1",
          stem: "A pen costs ＄2.45 and a book ＄3.85. Total?",
          choices: ["＄5.30", "＄6.30", "＄5.40", "＄6.40"],
          correctIndex: 1,
          explanation: "Add the two prices: ＄2.45 + ＄3.85 = ＄6.30.",
          difficulty: "easy",
        },
      ],
    });
    const result = auditContent({ topics: [topic] });
    expect(result.issues.filter((i) => i.type === "escaped_dollar")).toHaveLength(0);
  });
});
