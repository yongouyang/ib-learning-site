import fs from 'fs';
import path from 'path';
import { topicSchema, subjectMetaSchema } from '../src/content/schema';

const DATA_DIR = path.resolve(__dirname, '../src/content/data');
const TOPICS_DIR = path.join(DATA_DIR, 'topics');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');

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

main();
