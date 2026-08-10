import fs from 'fs';
import path from 'path';
import { topicSchema, subjectMetaSchema, paperSchema, type ValidatedTopic } from '../src/content/schema';
import { COURSES } from '../src/lib/courses';

const DATA_DIR = path.resolve(__dirname, '../src/content/data');
const TOPICS_DIR = path.join(DATA_DIR, 'topics');
const PAPERS_DIR = path.join(DATA_DIR, 'papers');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');

// Stage/course/level consistency rules (Phase 1 taxonomy).
export function checkStageConsistency(topic: ValidatedTopic): string[] {
  const errors: string[] = [];
  const { stage, year, course, level, strand } = topic;

  if (strand !== undefined && (stage !== 'ks3' || topic.subjectId !== 'english')) {
    errors.push(
      `strand is set ("${strand}") but strand is KS3-english-only (stage "${stage}", subjectId "${topic.subjectId}")`
    );
  }

  if (year !== undefined && stage !== 'ks3') {
    errors.push(`year is set (${year}) but stage is "${stage}" (year is ks3-only)`);
  }
  if (stage === 'ks3' && level !== undefined) {
    errors.push(`level is set ("${level}") but stage is "ks3" (level is igcse/dp-only)`);
  }
  if (level === 'core' || level === 'extended') {
    if (stage !== 'igcse') {
      errors.push(`level "${level}" requires stage "igcse", got "${stage}"`);
    }
  }
  if (level === 'sl' || level === 'hl') {
    if (stage !== 'dp') {
      errors.push(`level "${level}" requires stage "dp", got "${stage}"`);
    }
  }
  if (stage === 'dp' && !course) {
    errors.push('stage "dp" requires a course (e.g. "aa", "ai", "bio", "chem", "phys", "langlit")');
  }
  if (stage === 'igcse' && !course) {
    errors.push('stage "igcse" requires a course (e.g. "0580", "0610", "0620", "0625", "0500")');
  }

  // Phase 2: calculator tags are only meaningful for math questions.
  if (topic.subjectId !== 'math') {
    const tagged = topic.questions.filter((q) => q.calculator !== undefined);
    if (tagged.length > 0) {
      errors.push(
        `calculator tag on ${tagged.length} question(s) but subjectId is "${topic.subjectId}" (calculator is math-only)`
      );
    }
  }

  return errors;
}

// Variant-group invariants (docs/question-variations-plan.md): a quiz session
// samples ONE question per variantOf group for the difficulty ramp, so every
// member of a multi-question group must carry the SAME difficulty tag.
export function checkVariantGroups(topic: ValidatedTopic): string[] {
  const errors: string[] = [];
  const groups = new Map<string, typeof topic.questions>();
  for (const q of topic.questions) {
    if (q.variantOf === undefined) continue;
    const members = groups.get(q.variantOf);
    if (members) members.push(q);
    else groups.set(q.variantOf, [q]);
  }
  for (const [key, members] of groups) {
    if (members.length < 2) continue; // single-member explicit groups are an audit warning, not an error
    const untagged = members.filter((q) => q.difficulty === undefined);
    if (untagged.length > 0) {
      errors.push(
        `variant group "${key}" has ${untagged.length} untagged member(s); all members of a multi-question group must share one difficulty tag`
      );
      continue;
    }
    const bands = new Set(members.map((q) => q.difficulty));
    if (bands.size > 1) {
      errors.push(
        `variant group "${key}" mixes difficulties (${members.map((q) => `${q.id}:${q.difficulty}`).join(', ')}); all members must share one difficulty`
      );
    }
  }
  return errors;
}

interface Failure {
  file: string;
  errors: string[];
}

const failures: Failure[] = [];

function relative(p: string): string {
  return path.relative(process.cwd(), p);
}

function recordFailure(filePath: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push({ file: relative(filePath), errors: [message] });
}

function validateSubjects() {
  const raw = fs.readFileSync(SUBJECTS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  try {
    subjectMetaSchema.array().parse(parsed);
    console.log(`✓ ${relative(SUBJECTS_FILE)}`);
  } catch (err) {
    recordFailure(SUBJECTS_FILE, err);
  }
}

function validateTopics() {
  const subjectDirs = fs.readdirSync(TOPICS_DIR).filter((name) => {
    const full = path.join(TOPICS_DIR, name);
    return fs.statSync(full).isDirectory();
  });

  for (const subjectDir of subjectDirs) {
    const subjectPath = path.join(TOPICS_DIR, subjectDir);
    const files = fs.readdirSync(subjectPath).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(subjectPath, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        recordFailure(filePath, err);
        continue;
      }

      const result = topicSchema.safeParse(parsed);
      if (result.success) {
        // Extra sanity check: subjectId should match the folder name
        if (result.data.subjectId !== subjectDir) {
          recordFailure(
            filePath,
            `subjectId "${result.data.subjectId}" does not match folder "${subjectDir}"`
          );
          continue;
        }
        const consistencyErrors = [
          ...checkStageConsistency(result.data),
          ...checkVariantGroups(result.data),
        ];
        if (consistencyErrors.length > 0) {
          failures.push({ file: relative(filePath), errors: consistencyErrors });
          continue;
        }
        console.log(`✓ ${relative(filePath)}`);
      } else {
        const errors = result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
        );
        failures.push({ file: relative(filePath), errors });
      }
    }
  }
}

// Phase 4: free-response practice sets in data/papers/<courseId>/<set-id>.json.
function validatePapers() {
  if (!fs.existsSync(PAPERS_DIR)) return;

  const courseDirs = fs.readdirSync(PAPERS_DIR).filter((name) => {
    const full = path.join(PAPERS_DIR, name);
    return fs.statSync(full).isDirectory();
  });

  for (const courseDir of courseDirs) {
    const dirPath = path.join(PAPERS_DIR, courseDir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        recordFailure(filePath, err);
        continue;
      }

      const result = paperSchema.safeParse(parsed);
      if (!result.success) {
        const errors = result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
        );
        failures.push({ file: relative(filePath), errors });
        continue;
      }

      const paper = result.data;
      const errors: string[] = [];
      if (paper.courseId !== courseDir) {
        errors.push(`courseId "${paper.courseId}" does not match folder "${courseDir}"`);
      }
      if (!COURSES.some((c) => c.id === paper.courseId)) {
        errors.push(`courseId "${paper.courseId}" is not a known course (see src/lib/courses.ts)`);
      }
      if (!paper.id.startsWith(`${paper.courseId}-`)) {
        errors.push(`paper id "${paper.id}" should start with its courseId "${paper.courseId}-"`);
      }
      // Non-calculator policy (Phase 3 user decision): no calc-tagged FR questions.
      const calcTagged = paper.questions.filter((q) => q.calculator);
      if (calcTagged.length > 0) {
        errors.push(`${calcTagged.length} question(s) tagged calculator:true — papers are non-calculator for now`);
      }

      if (errors.length > 0) {
        failures.push({ file: relative(filePath), errors });
      } else {
        console.log(`✓ ${relative(filePath)}`);
      }
    }
  }
}

function main() {
  console.log('Validating content...\n');
  validateSubjects();
  validateTopics();
  validatePapers();

  if (failures.length > 0) {
    console.error(`\n${failures.length} file(s) failed validation:\n`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure.file}`);
      for (const error of failure.errors) {
        console.error(`      - ${error}`);
      }
    }
    process.exit(1);
  }

  console.log('\nAll content files passed validation.');
}

if (require.main === module) {
  main();
}
