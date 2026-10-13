// Builds the single installable package `nawa-captcha` (packages/nawa-captcha/dist) from the built
// scoped packages, so developers can `npm i nawa-captcha` and import every target from one package:
//   nawa-captcha            server (Node)          nawa-captcha/express   Express adapter
//   nawa-captcha/widget     <nawa-captcha> element  nawa-captcha/react|vue|svelte|angular
// Imports of '@nawa-captcha/widget' inside the wrappers are rewritten to the bundled copy.
// Run after `npm run build`.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'packages/nawa-captcha/dist');

const parts = [
  ['server', 'packages/server/dist'],
  ['widget', 'packages/widget/dist'],
  ['react', 'packages/react/dist'],
  ['vue', 'packages/vue/dist'],
  ['svelte', 'packages/svelte/src'],
  ['angular', 'packages/angular/dist'],
];

rmSync(out, { recursive: true, force: true });
for (const [name, src] of parts) {
  const from = join(root, src);
  if (!existsSync(from)) throw new Error(`Missing ${src}. Run \`npm run build\` first.`);
  cpSync(from, join(out, name), {
    recursive: true,
    // Angular's dist ships its own package.json/README; the umbrella provides those.
    filter: (p) => !(name === 'angular' && /[\\/](package\.json|README\.md)$/.test(p)),
  });
}

/** Rewrite '@nawa-captcha/widget' to a relative path to the bundled widget entry. */
function rewrite(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      rewrite(p);
      continue;
    }
    if (!/\.(m?js|d\.ts|d\.mts|svelte)$/.test(entry)) continue;
    const text = readFileSync(p, 'utf8');
    if (!text.includes('@nawa-captcha/')) continue;
    const toWidget = relative(dirname(p), join(out, 'widget/index.js')).split(sep).join('/');
    const spec = toWidget.startsWith('.') ? toWidget : `./${toWidget}`;
    const next = text
      .replace(/(['"])@nawa-captcha\/widget\1/g, `$1${spec}$1`)
      .replace(/(['"])@nawa-captcha\/server\1/g, `$1${spec.replace(/widget\/index\.js$/, 'server/index.js')}$1`);
    writeFileSync(p, next);
  }
}
rewrite(out);

const leftovers = [];
(function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) scan(p);
    else if (/\.(m?js|svelte)$/.test(entry) && /['"]@nawa-captcha\//.test(readFileSync(p, 'utf8'))) leftovers.push(relative(out, p));
  }
})(out);
if (leftovers.length) throw new Error(`Unrewritten @nawa-captcha imports in: ${leftovers.join(', ')}`);

mkdirSync(out, { recursive: true });
console.log(`Built packages/nawa-captcha/dist (${parts.map(([n]) => n).join(', ')})`);
