/**
 * ONE-TIME migration (Phase 1 — curriculum foundation).
 *
 * Replaces `ibLevel: "MYP" | "DP"` with the new taxonomy on every topic JSON:
 *   stage:  'ks3' | 'igcse' | 'dp'
 *   year?:  7 | 8 | 9                         (ks3 only)
 *   course?: string                           (dp/igcse only)
 *   level?: 'core' | 'extended' | 'sl' | 'hl' (dp/igcse only)
 *
 * Also renames math-dp-* files (and their topic `id`) to math-dp-ai-*.
 * Inner note/flashcard/question IDs are left unchanged (still globally unique).
 *
 * Mapping is an explicit per-pattern table — no guessing from titles.
 * Provisional tags (marked below) are printed for later content review.
 *
 * Run: npx tsx scripts/migrate-stage-tags.ts [--dry-run]
 */
import fs from 'fs';
import path from 'path';

const TOPICS_DIR = path.resolve(__dirname, '../src/content/data/topics');
const DRY_RUN = process.argv.includes('--dry-run');

// DP AI HL-only topic slugs (provisional — flagged for content review).
// Everything else math-dp-* is tagged level 'sl' (SL & HL common content).
//
// REVIEWED 2026-07-22 against the official AI syllabus (first exams 2021):
// - hypothesis-testing moved back to 'sl' — chi-squared tests and t-tests are
//   AI SL 4.11 content; the topic's HL-only extras (critical values, Type I/II
//   errors, Spearman's) follow the same pattern as the SL-tagged probability
//   topic. Complex numbers / matrices / graph theory / Poisson confirmed HL-only.
const DP_AI_HL_ONLY = new Set([
  'complex-numbers',
  'poisson-distribution',
  'graph-theory',
  'matrices',
]);

interface Tags {
  stage: 'ks3' | 'igcse' | 'dp';
  year?: 7 | 8 | 9;
  course?: string;
  level?: 'core' | 'extended' | 'sl' | 'hl';
  renameTo?: string; // new topic id / file base name
  provisional: string[];
}

function tagsFor(subjectId: string, baseName: string): Tags {
  // math-dp-sequences -> slug "sequences"
  if (subjectId === 'math' && baseName.startsWith('math-dp-')) {
    const slug = baseName.slice('math-dp-'.length);
    const provisional: string[] = [];
    const level = DP_AI_HL_ONLY.has(slug) ? 'hl' : 'sl';
    provisional.push(`level=${level} (SL/HL split)`);
    return {
      stage: 'dp',
      course: 'ai',
      level,
      renameTo: `math-dp-ai-${slug}`,
      provisional,
    };
  }

  if (subjectId === 'math' && baseName.startsWith('math-yr7-')) {
    return { stage: 'ks3', year: 7, provisional: [] };
  }
  if (subjectId === 'math' && baseName.startsWith('math-yr8-')) {
    return { stage: 'ks3', year: 8, provisional: [] };
  }
  if (subjectId === 'math' && baseName.endsWith('-myp')) {
    return { stage: 'ks3', year: 9, provisional: ['year=9 (from MYP tag)'] };
  }
  if (
    subjectId === 'math' &&
    ['math-algebra-1', 'math-fractions-1', 'math-geometry-1', 'math-statistics-1'].includes(baseName)
  ) {
    return { stage: 'ks3', year: 7, provisional: ['year=7 (from plain -1 id)'] };
  }

  if (['biology', 'chemistry', 'physics'].includes(subjectId)) {
    return { stage: 'ks3', provisional: [] };
  }
  if (subjectId === 'english') {
    return { stage: 'ks3', provisional: [] };
  }

  throw new Error(`No mapping rule for ${subjectId}/${baseName}`);
}

interface Row {
  file: string;
  newFile: string;
  tags: string;
  provisional: string;
}

function main(): void {
  const rows: Row[] = [];
  let renames = 0;

  const subjectDirs = fs
    .readdirSync(TOPICS_DIR)
    .filter((name) => fs.statSync(path.join(TOPICS_DIR, name)).isDirectory());

  for (const subjectId of subjectDirs) {
    const subjectPath = path.join(TOPICS_DIR, subjectId);
    const files = fs.readdirSync(subjectPath).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const baseName = file.replace(/\.json$/, '');
      const tags = tagsFor(subjectId, baseName);
      const filePath = path.join(subjectPath, file);
      const topic = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (!('ibLevel' in topic)) {
        throw new Error(`${filePath}: no ibLevel field — already migrated?`);
      }

      const newId = tags.renameTo ?? topic.id;
      const newFile = `${newId}.json`;

      // Rebuild the object with stable key order: new fields sit where ibLevel was.
      const migrated: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(topic)) {
        if (key === 'ibLevel') {
          migrated.stage = tags.stage;
          if (tags.year !== undefined) migrated.year = tags.year;
          if (tags.course !== undefined) migrated.course = tags.course;
          if (tags.level !== undefined) migrated.level = tags.level;
          continue;
        }
        migrated[key === 'id' ? 'id' : key] = key === 'id' ? newId : value;
      }

      const tagSummary = [
        `stage=${tags.stage}`,
        tags.year !== undefined ? `year=${tags.year}` : null,
        tags.course ? `course=${tags.course}` : null,
        tags.level ? `level=${tags.level}` : null,
      ]
        .filter(Boolean)
        .join(' ');

      rows.push({
        file: `${subjectId}/${file}`,
        newFile: newFile === file ? '(same)' : `${subjectId}/${newFile}`,
        tags: tagSummary,
        provisional: tags.provisional.join('; '),
      });

      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
        if (newFile !== file) {
          fs.renameSync(filePath, path.join(subjectPath, newFile));
          renames += 1;
        }
      }
    }
  }

  for (const row of rows) {
    const renameNote = row.newFile === '(same)' ? '' : `  ->  ${row.newFile}`;
    const provNote = row.provisional ? `   [review: ${row.provisional}]` : '';
    console.log(`${row.file}${renameNote}   ${row.tags}${provNote}`);
  }
  console.log(
    `\n${rows.length} topics migrated (${renames} files renamed)${DRY_RUN ? ' — DRY RUN, nothing written' : ''}.`,
  );
}

main();
