import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TOPICS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'topics');
const PAPERS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'papers');
const SUBJECTS_JSON = path.join(PROJECT_ROOT, 'src', 'content', 'data', 'subjects.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'content', 'registry.ts');

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
    const files = fs
      .readdirSync(subjectPath)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

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

  const subjectMetaRecordEntries = subjectDirs
    .map(
      (id) =>
        `  ${id}: { name: ${id}Meta.name, icon: ${id}Meta.icon, color: ${id}Meta.accentColor },`,
    )
    .join('\n');

  const output = `import { Subject, SubjectId } from './types';
import type { Topic, Paper } from './types';
import { topicSchema, subjectMetaSchema, paperSchema } from './schema';

import subjectsMeta from './data/subjects.json';

${importLines.join('\n')}

${paperImportLines.join('\n')}

${declarationLines.join('\n')}

${paperDeclarationLines.join('\n')}

const validatedSubjectsMeta = subjectMetaSchema.array().parse(subjectsMeta);

${metaDeclarations}

${subjectBuildLines.join('\n')}

const subjects: Partial<Record<SubjectId, Subject>> = {
${subjectsRecordEntries}
};

export function getSubjects(): Subject[] {
  return Object.values(subjects);
}

export function getSubject(id: SubjectId): Subject | undefined {
  return subjects[id];
}

export function getTopic(subjectId: SubjectId, topicId: string) {
  return subjects[subjectId]?.topics.find((t) => t.id === topicId);
}

export const subjectMeta: Partial<Record<SubjectId, { name: string; icon: string; color: string }>> = {
${subjectMetaRecordEntries}
};

const papers: Paper[] = [${paperVarNames.join(', ')}];

export function getAllPapers(): Paper[] {
  return papers;
}

export function getPapersForCourse(courseId: string): Paper[] {
  return papers.filter((p) => p.courseId === courseId);
}

export function getPaper(courseId: string, paperId: string): Paper | undefined {
  return papers.find((p) => p.id === paperId && p.courseId === courseId);
}
`;

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(
    `Generated ${OUTPUT_FILE} with ${subjectDirs.length} subjects, ${declarationLines.length} topics and ${paperVarNames.length} papers.`,
  );
}

main();
