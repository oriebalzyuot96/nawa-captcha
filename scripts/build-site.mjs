// Builds the static site (site/) for GitHub Pages:
//   1. bundles the playground (real server engine with browser primitives + the widget) into
//      site/assets/playground.js with esbuild;
//   2. regenerates the puzzle table in site/index.html and the type list in site/llms.txt from
//      the server's catalogue (between the <!-- types:start/end --> markers), so docs never drift.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverSrc = join(root, 'packages', 'server', 'src');

/** Swap the Node platform layer for the dependency-free browser one. */
const browserPrimitives = {
  name: 'nawa-captcha-browser-primitives',
  setup(b) {
    b.onResolve({ filter: /\/primitives\.js$/ }, (args) =>
      args.importer.startsWith(serverSrc) ? { path: join(serverSrc, 'primitives.browser.ts') } : undefined,
    );
    b.onResolve({ filter: /^node:/ }, (args) => ({ errors: [{ text: `Node built-in "${args.path}" must not reach the browser bundle (imported by ${args.importer})` }] }));
  },
};

const result = await build({
  entryPoints: [join(root, 'site', 'src', 'playground.ts')],
  outfile: join(root, 'site', 'assets', 'playground.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  metafile: true,
  plugins: [browserPrimitives],
  logLevel: 'warning',
});
const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`site/assets/playground.js  ${(bytes / 1024).toFixed(1)} kB`);

// --------------------------------------------------------------------------- generated docs
// The catalogue is plain TypeScript data; esbuild turns it into an importable module.
const catalog = await build({ entryPoints: [join(serverSrc, 'catalog.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' });
const { TYPE_INFO } = await import(`data:text/javascript;base64,${Buffer.from(catalog.outputFiles[0].text).toString('base64')}`);
const FAMILY = { drag: 'Drag, slide, rotate, hold', select: 'Select in a picture', tap: 'Tap in order', order: 'Put in order', draw: 'Draw a path', type: 'Type the answer', invisible: 'Invisible / accessible alternative' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rows = Object.entries(TYPE_INFO)
  .map(([type, i]) => `            <tr><td><code>${type}</code></td><td>${esc(i.en)}</td><td lang="ar" dir="rtl">${esc(i.ar)}</td><td>${esc(FAMILY[i.family])}</td><td>${esc(i.guess)}</td></tr>`)
  .join('\n');
const count = Object.keys(TYPE_INFO).length;

function replaceBlock(file, block) {
  const text = readFileSync(file, 'utf8');
  const re = /(<!-- types:start -->)[\s\S]*?(<!-- types:end -->)/;
  if (!re.test(text)) throw new Error(`${file}: missing <!-- types:start/end --> markers`);
  const next = text.replace(re, `$1\n${block}\n$2`).replace(/data-type-count>\d+</g, `data-type-count>${count}<`);
  if (next !== text) writeFileSync(file, next);
}
replaceBlock(join(root, 'site', 'index.html'), rows);
replaceBlock(
  join(root, 'site', 'llms.txt'),
  Object.entries(TYPE_INFO)
    .map(([type, i]) => `- ${type}: ${i.en} (${FAMILY[i.family].toLowerCase()})`)
    .join('\n'),
);
console.log(`site/index.html + site/llms.txt  ${count} puzzle types`);
