import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const IMAGES_DIR = path.resolve(__dirname, '../public/images');
const MAX_FILE_SIZE_KB = 50;

interface Failure {
  file: string;
  errors: string[];
}

const failures: Failure[] = [];

function relative(p: string): string {
  return path.relative(process.cwd(), p);
}

function recordFailure(filePath: string, error: string) {
  const existing = failures.find((f) => f.file === relative(filePath));
  if (existing) {
    existing.errors.push(error);
  } else {
    failures.push({ file: relative(filePath), errors: [error] });
  }
}

function collectSvgFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      files.push(fullPath);
    }
  }
  return files;
}

function validateSvg(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const sizeKb = Buffer.byteLength(raw, 'utf8') / 1024;

  if (sizeKb > MAX_FILE_SIZE_KB) {
    recordFailure(filePath, `File size ${sizeKb.toFixed(1)} KB exceeds ${MAX_FILE_SIZE_KB} KB`);
  }

  if (!raw.includes('xmlns="http://www.w3.org/2000/svg"')) {
    recordFailure(filePath, 'Missing SVG namespace');
  }

  if (!/viewBox="\s*\d+\s+\d+\s+\d+\s+\d+\s*"/.test(raw)) {
    recordFailure(filePath, 'Missing or invalid viewBox');
  }

  if (!/role="img"/.test(raw)) {
    recordFailure(filePath, 'Missing role="img"');
  }

  const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/);
  if (!titleMatch || titleMatch[1].trim().length === 0) {
    recordFailure(filePath, 'Missing or empty <title>');
  }

  const descMatch = raw.match(/<desc[^>]*>([^<]+)<\/desc>/);
  if (!descMatch || descMatch[1].trim().length === 0) {
    recordFailure(filePath, 'Missing or empty <desc>');
  }

  console.log(`✓ ${relative(filePath)}`);
}

function validateXml(svgFiles: string[]) {
  try {
    execSync('which xmllint', { stdio: 'ignore' });
  } catch {
    console.log('  (xmllint not available; skipping XML well-formedness check)');
    return;
  }

  for (const filePath of svgFiles) {
    try {
      // Safe: svgFiles comes from globbing public/images/**/*.svg in this
      // repo (dev/CI validation script), not from user input.
      // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
      execSync(`xmllint --noout "${filePath}"`, { stdio: 'ignore' });
    } catch {
      recordFailure(filePath, 'SVG is not well-formed XML');
    }
  }
}

function validateReferences() {
  const topicsDir = path.resolve(__dirname, '../src/content/data/topics');
  if (!fs.existsSync(topicsDir)) return;

  const subjectDirs = fs.readdirSync(topicsDir).filter((name) => {
    const full = path.join(topicsDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const subjectDir of subjectDirs) {
    const subjectPath = path.join(topicsDir, subjectDir);
    const files = fs.readdirSync(subjectPath).filter((f) => f.endsWith('.json') && f !== 'order.json');

    for (const file of files) {
      const filePath = path.join(subjectPath, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed: { notes?: Array<{ illustration?: { src?: string } }> } | undefined;
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        continue;
      }

      for (const note of parsed?.notes ?? []) {
        const src = note.illustration?.src;
        if (!src) continue;

        if (!src.startsWith('/images/')) {
          recordFailure(filePath, `Illustration src must start with /images/: ${src}`);
          continue;
        }

        const diskPath = path.resolve(__dirname, '../public', src.replace(/^\//, ''));
        if (!fs.existsSync(diskPath)) {
          recordFailure(filePath, `Referenced illustration not found: ${src}`);
        }
      }
    }
  }
}

function main() {
  console.log('Validating illustrations...\n');

  const svgFiles = collectSvgFiles(IMAGES_DIR);
  if (svgFiles.length === 0) {
    console.log('No SVG illustrations found.');
  } else {
    for (const file of svgFiles) {
      validateSvg(file);
    }
    validateXml(svgFiles);
  }

  validateReferences();

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

  console.log('\nAll illustrations passed validation.');
}

main();
