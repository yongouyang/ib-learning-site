const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const srcDir = path.resolve(__dirname, '../src/content');
const outDir = path.resolve(__dirname, '../src/content/data/topics/math');

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.startsWith('math-phase4-math-dp-') && f.endsWith('.ts'))
  .map((f) => path.join(srcDir, f))
  .sort();

const failures = [];
let count = 0;

for (const filePath of files) {
  try {
    let source = fs.readFileSync(filePath, 'utf8');

    // Strip ES module import lines so the file can be compiled standalone.
    source = source.replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '');
    source = source.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');

    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    });

    const mod = new module.constructor();
    mod.filename = filePath;
    mod.paths = module.paths;
    mod._compile(result.outputText, filePath);

    const topic = mod.exports.default || mod.exports;
    if (!topic || typeof topic !== 'object') {
      throw new Error('No default export object found');
    }
    if (!topic.id) {
      throw new Error('Topic object is missing an id');
    }

    const outPath = path.join(outDir, `${topic.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(topic, null, 2) + '\n', 'utf8');
    count++;
  } catch (err) {
    failures.push({ file: path.basename(filePath), error: err.message });
  }
}

console.log(JSON.stringify({ count, failures }, null, 2));
