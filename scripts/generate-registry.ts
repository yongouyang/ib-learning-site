import fs from 'fs';
import path from 'path';
import { ORDER_FILE, sortFilesByOrder } from './topic-order';
import { topicSchema, paperSchema } from '../src/content/schema';
import type { Paper, Topic } from '../src/content/types';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TOPICS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'topics');
const PAPERS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'papers');
const SUBJECTS_JSON = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'subjects.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'content', 'registry.ts');
const CONTENT_OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'content', 'registry.content.ts');
const PAPERS_OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'content', 'registry.papers.ts');

interface SubjectMeta {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
}

function toIdentifier(fileName: string, suffix?: string): string {
  // e.g. "math-dp-sequences.json" -> "math_dp_sequences_json"
  const base = fileName.replace(/\.json$/, '');
  const safe = base.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return suffix ? `${safe}_${suffix}` : safe;
}

function generateComment(subjectMeta: SubjectMeta): string {
  return `// ${subjectMeta.name} topics`;
}

/**
 * One `TopicMeta` as a source literal. Metadata only — never a note body, flashcard definition or
 * question stem — so the generated module stays client-safe and small.
 */
function metaLiteral(topic: Topic, subjectId: string): string {
  const parts = [
    `id: ${JSON.stringify(topic.id)}`,
    `subjectId: ${JSON.stringify(subjectId)}`,
    `title: ${JSON.stringify(topic.title)}`,
    `description: ${JSON.stringify(topic.description)}`,
    `stage: ${JSON.stringify(topic.stage)}`,
  ];
  if (topic.year !== undefined) parts.push(`year: ${topic.year}`);
  if (topic.course !== undefined) parts.push(`course: ${JSON.stringify(topic.course)}`);
  if (topic.level !== undefined) parts.push(`level: ${JSON.stringify(topic.level)}`);
  if (topic.strand !== undefined) parts.push(`strand: ${JSON.stringify(topic.strand)}`);
  // Forced by getCardStats/getDueTopics (homepage "due today" card, /progress) and by the quiz's
  // difficulty chips: ids and counts, no card bodies.
  parts.push(`flashcardIds: [${topic.flashcards.map((card) => JSON.stringify(card.id)).join(', ')}]`);
  parts.push(`flashcardCount: ${topic.flashcards.length}`);
  parts.push(`noteCount: ${topic.notes.length}`);
  parts.push(`questionCount: ${topic.questions.length}`);
  return `{ ${parts.join(', ')} }`;
}

/** One `PaperMeta`: what metadata consumers need (titles, counts, marks), no questions. */
function paperMetaLiteral(paper: Paper): string {
  const parts = [
    `id: ${JSON.stringify(paper.id)}`,
    `courseId: ${JSON.stringify(paper.courseId)}`,
    `title: ${JSON.stringify(paper.title)}`,
  ];
  if (paper.durationMinutes !== undefined) parts.push(`durationMinutes: ${paper.durationMinutes}`);
  parts.push(`questionCount: ${paper.questions.length}`);
  parts.push(`totalMarks: ${paper.questions.reduce((sum, question) => sum + question.marks, 0)}`);
  return `  { ${parts.join(', ')} },`;
}

function main(): void {
  const subjectsMeta: SubjectMeta[] = JSON.parse(
    fs.readFileSync(SUBJECTS_JSON, 'utf-8'),
  );

  const subjectDirs = fs
    .readdirSync(TOPICS_DIR)
    .filter((name) => fs.statSync(path.join(TOPICS_DIR, name)).isDirectory())
    .sort((a, b) => {
      // Preserve the order defined in subjects.json
      const indexA = subjectsMeta.findIndex((s) => s.id === a);
      const indexB = subjectsMeta.findIndex((s) => s.id === b);
      return indexA - indexB;
    });

  const importLines: string[] = [];
  const declarationLines: string[] = [];
  const subjectBuildLines: string[] = [];

  for (const subjectId of subjectDirs) {
    const subjectMeta = subjectsMeta.find((s) => s.id === subjectId);
    if (!subjectMeta) {
      throw new Error(`No metadata found for subject "${subjectId}" in subjects.json`);
    }

    const subjectPath = path.join(TOPICS_DIR, subjectId);
    const files = sortFilesByOrder(
      subjectId,
      path.join(subjectPath, ORDER_FILE),
      fs
        .readdirSync(subjectPath)
        .filter((f) => f.endsWith('.json') && f !== ORDER_FILE),
    );

    importLines.push(generateComment(subjectMeta));
    const variableNames: string[] = [];

    for (const file of files) {
      const importName = toIdentifier(file, 'json');
      const variableName = toIdentifier(file);
      const relativePath = `./data/topics/${subjectId}/${file}`;
      importLines.push(`import ${importName} from '${relativePath}';`);
      declarationLines.push(
        `const ${variableName}: Topic = topicSchema.parse(${importName});`,
      );
      variableNames.push(variableName);
    }

    const metaVar = `${subjectId}Meta`;
    subjectBuildLines.push(
      `const ${subjectId}Subject: Subject = {`,
      `  id: ${metaVar}.id as SubjectId,`,
      `  name: ${metaVar}.name,`,
      `  icon: ${metaVar}.icon,`,
      `  accentColor: ${metaVar}.accentColor,`,
      `  topics: [${variableNames.join(', ')}],`,
      `};`,
    );
  }

  const metaDeclarations = subjectDirs
    .map((id) => `const ${id}Meta = validatedSubjectsMeta.find((s) => s.id === '${id}')!;`)
    .join('\n');

  // Phase 4: free-response practice sets (src/content/data/papers/<courseId>/*.json)
  const paperImportLines: string[] = [];
  const paperDeclarationLines: string[] = [];
  const paperVarNames: string[] = [];

  if (fs.existsSync(PAPERS_DIR)) {
    const courseDirs = fs
      .readdirSync(PAPERS_DIR)
      .filter((name) => fs.statSync(path.join(PAPERS_DIR, name)).isDirectory())
      .sort((a, b) => a.localeCompare(b));

    for (const courseId of courseDirs) {
      const files = fs
        .readdirSync(path.join(PAPERS_DIR, courseId))
        .filter((f) => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b));

      paperImportLines.push(`// ${courseId} practice sets`);
      for (const file of files) {
        const importName = toIdentifier(`${courseId}_${file}`, 'json');
        const variableName = toIdentifier(`${courseId}_${file}`);
        paperImportLines.push(`import ${importName} from './data/papers/${courseId}/${file}';`);
        paperDeclarationLines.push(
          `const ${variableName}: Paper = paperSchema.parse(${importName});`,
        );
        paperVarNames.push(variableName);
      }
    }
  }

  const subjectsRecordEntries = subjectDirs
    .map((id) => `  ${id}: ${id}Subject,`)
    .join('\n');

  // ── the CLIENT-SAFE metadata module ───────────────────────────────────────────────────────────
  // Everything is inlined as literals (no JSON import, no runtime zod parse): a client component
  // that imports this module gets metadata only, never the content bank. Validated at generation
  // time by topicSchema/paperSchema; `npm run check:registry` catches a JSON edit that was never
  // regenerated.
  const metaTopicBlocks: string[] = [];
  const metaSubjectEntries: string[] = [];
  const metaSubjectMetaEntries: string[] = [];

  for (const subjectId of subjectDirs) {
    const subjectMeta = subjectsMeta.find((s) => s.id === subjectId)!;
    const subjectPath = path.join(TOPICS_DIR, subjectId);
    const files = sortFilesByOrder(
      subjectId,
      path.join(subjectPath, ORDER_FILE),
      fs.readdirSync(subjectPath).filter((f) => f.endsWith('.json') && f !== ORDER_FILE),
    );
    const lines = files.map((file) => {
      const topic = topicSchema.parse(JSON.parse(fs.readFileSync(path.join(subjectPath, file), 'utf-8')));
      return `  ${metaLiteral(topic, subjectId)},`;
    });
    metaTopicBlocks.push(`const ${subjectId}Meta: TopicMeta[] = [\n${lines.join('\n')}\n];`);
    metaSubjectEntries.push(
      `  ${subjectId}: { id: ${JSON.stringify(subjectId)}, name: ${JSON.stringify(subjectMeta.name)}, icon: ${JSON.stringify(subjectMeta.icon)}, accentColor: ${JSON.stringify(subjectMeta.accentColor)}, topics: ${subjectId}Meta },`,
    );
    metaSubjectMetaEntries.push(
      `  ${subjectId}: { name: ${JSON.stringify(subjectMeta.name)}, icon: ${JSON.stringify(subjectMeta.icon)}, color: ${JSON.stringify(subjectMeta.accentColor)} },`,
    );
  }

  const metaPaperLines: string[] = [];
  if (fs.existsSync(PAPERS_DIR)) {
    for (const courseId of fs
      .readdirSync(PAPERS_DIR)
      .filter((name) => fs.statSync(path.join(PAPERS_DIR, name)).isDirectory())
      .sort((a, b) => a.localeCompare(b))) {
      const dir = path.join(PAPERS_DIR, courseId);
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
        metaPaperLines.push(paperMetaLiteral(paperSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')))));
      }
    }
  }

  const output = `// GENERATED by scripts/generate-registry.ts — do not edit by hand.
//
// CLIENT-SAFE metadata only: subjects, topic metadata and paper metadata, inlined as literals.
// No topic or paper JSON is imported here, so importing this from a 'use client' file cannot ship
// the content bank. The content lives in registry.content.ts and registry.papers.ts, which are
// SERVER-ONLY (docs/premium-content-protection-plan.md §4.1/§4.4).
import type { PaperMeta, SubjectId, SubjectMeta, TopicMeta } from './types';

${metaTopicBlocks.join('\n\n')}

const subjects: Partial<Record<SubjectId, SubjectMeta>> = {
${metaSubjectEntries.join('\n')}
};

export function getSubjects(): SubjectMeta[] {
  return Object.values(subjects);
}

export function getSubject(id: SubjectId): SubjectMeta | undefined {
  return subjects[id];
}

export function getTopic(subjectId: SubjectId, topicId: string): TopicMeta | undefined {
  return subjects[subjectId]?.topics.find((t) => t.id === topicId);
}

export const subjectMeta: Partial<Record<SubjectId, { name: string; icon: string; color: string }>> = {
${metaSubjectMetaEntries.join('\n')}
};

const papers: PaperMeta[] = [
${metaPaperLines.join('\n')}
];

export function getAllPapers(): PaperMeta[] {
  return papers;
}

export function getPapersForCourse(courseId: string): PaperMeta[] {
  return papers.filter((p) => p.courseId === courseId);
}

export function getPaper(courseId: string, paperId: string): PaperMeta | undefined {
  return papers.find((p) => p.id === paperId && p.courseId === courseId);
}
`;

  // Phase 1a (docs/premium-content-protection-plan.md §4.4) — the content-bearing halves, so that a
  // client import can never reach note/flashcard/question bodies or a premium mark scheme.
  const contentOutput = `// GENERATED by scripts/generate-registry.ts — do not edit by hand.
//
// Topic CONTENT (notes, flashcards, questions, templates).
// SERVER-ONLY: importing this from a 'use client' file ships the whole bank to the browser — see
// docs/premium-content-protection-plan.md §4.4 and the gate in §7.
import { Subject, SubjectId } from './types';
import type { Topic } from './types';
import { topicSchema, subjectMetaSchema } from './schema';

import subjectsMeta from './data/subjects.json';

${importLines.join('\n')}

${declarationLines.join('\n')}

const validatedSubjectsMeta = subjectMetaSchema.array().parse(subjectsMeta);

${metaDeclarations}

${subjectBuildLines.join('\n')}

const subjects: Partial<Record<SubjectId, Subject>> = {
${subjectsRecordEntries}
};

export function getContentSubjects(): Subject[] {
  return Object.values(subjects);
}

export function getContentSubject(id: SubjectId): Subject | undefined {
  return subjects[id];
}

export function getContentTopic(subjectId: SubjectId, topicId: string): Topic | undefined {
  return subjects[subjectId]?.topics.find((t) => t.id === topicId);
}

/** Flat list across subjects — what cross-topic composition (question sets, mixed review) needs. */
export function getAllContentTopics(): Topic[] {
  return getContentSubjects().flatMap((s) => s.topics);
}
`;

  const papersOutput = `// GENERATED by scripts/generate-registry.ts — do not edit by hand.
//
// Paper CONTENT (questions + mark schemes). SERVER-ONLY, and premium by definition: sets 2+ are the
// gated surface (docs/premium-content-protection-plan.md §4.4). The only legitimate importer is the
// premium content API; nothing under src/app/** may import it.
import type { Paper } from './types';
import { paperSchema } from './schema';

${paperImportLines.join('\n')}

${paperDeclarationLines.join('\n')}

const papers: Paper[] = [${paperVarNames.join(', ')}];

export function getAllPapersContent(): Paper[] {
  return papers;
}

export function getPapersForCourseContent(courseId: string): Paper[] {
  return papers.filter((p) => p.courseId === courseId);
}

export function getPaperContent(courseId: string, paperId: string): Paper | undefined {
  return papers.find((p) => p.id === paperId && p.courseId === courseId);
}
`;

  const outputs: { file: string; contents: string }[] = [
    { file: OUTPUT_FILE, contents: output },
    { file: CONTENT_OUTPUT_FILE, contents: contentOutput },
    { file: PAPERS_OUTPUT_FILE, contents: papersOutput },
  ];

  // `--check` is the staleness guard this change needs: with metadata inlined as literals, editing a
  // topic JSON without regenerating would otherwise ship a stale registry silently.
  if (process.argv.includes('--check')) {
    const stale = outputs.filter(
      (o) => !fs.existsSync(o.file) || fs.readFileSync(o.file, 'utf-8') !== o.contents,
    );
    if (stale.length > 0) {
      for (const o of stale) console.error(`✗ ${path.relative(PROJECT_ROOT, o.file)} is stale`);
      console.error('→ run `npm run generate:registry` and commit the result.');
      process.exit(1);
    }
    console.log('registry check ok: the generated modules match src/content/data.');
    return;
  }

  for (const o of outputs) fs.writeFileSync(o.file, o.contents, 'utf-8');
  console.log(
    `Generated ${subjectDirs.length} subjects / ${declarationLines.length} topics / ${paperVarNames.length} papers into registry.ts (metadata), registry.content.ts and registry.papers.ts.`,
  );
}

main();
