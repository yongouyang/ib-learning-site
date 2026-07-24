import fs from 'fs';
import path from 'path';
import { topicSchema, subjectMetaSchema, type ValidatedTopic } from '../src/content/schema';

const DATA_DIR = path.resolve(__dirname, '../src/content/data');
const TOPICS_DIR = path.join(DATA_DIR, 'topics');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');

// Stage/course/level consistency rules (Phase 1 taxonomy).
export function checkStageConsistency(topic: ValidatedTopic): string[] {
  const errors: string[] = [];
  const { stage, year, course, level } = topic;

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
        const consistencyErrors = checkStageConsistency(result.data);
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

function main() {
  console.log('Validating content...\n');
  validateSubjects();
  validateTopics();

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
