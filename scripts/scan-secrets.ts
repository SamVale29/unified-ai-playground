import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function main() {
  const root = process.cwd();
  const ignored = new Set([
    'node_modules',
    '.git',
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    '.artifacts',
  ]);
  const files: string[] = [];
  await walk(root, ignored, files);
  const patterns = [
    new RegExp(['sk', '-', '[A-Za-z0-9_-]{20,}'].join(''), 'u'),
    new RegExp(['xai', '-', '[A-Za-z0-9_-]{20,}'].join(''), 'u'),
    new RegExp(['AIza', '[A-Za-z0-9_-]{30,}'].join(''), 'u'),
    /Bearer\s+[A-Za-z0-9._-]{24,}/u,
    /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{20,}["']/iu,
  ];
  const findings: string[] = [];
  for (const file of files) {
    if (file.endsWith('scripts/scan-secrets.ts')) continue;
    const text = await readFile(file, 'utf8');
    if (patterns.some((pattern) => pattern.test(text))) findings.push(relative(root, file));
  }
  if (findings.length) {
    console.error(`Potential secrets found in:\n${findings.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Secret scan passed across ${files.length} files.`);
  }
}

async function walk(directory: string, ignored: Set<string>, files: string[]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, ignored, files);
    else if (entry.isFile()) files.push(path);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
