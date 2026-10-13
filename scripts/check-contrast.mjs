// Checks every widget theme preset (light + dark) and the high-contrast palette against WCAG 2.2 AA
// for every foreground/background pair the widget renders. Exits 1 on any failing pair (CI gate).
//   npm run check:contrast
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({ entryPoints: [join(root, 'packages', 'widget', 'src', 'themes.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' });
const { checkContrast, PALETTES, CONTRAST_PAIRS, contrastRatio } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const { checked, failures } = checkContrast();
const rows = [];
for (const [name, schemes] of Object.entries(PALETTES)) {
  for (const [scheme, p] of Object.entries(schemes)) {
    const worst = CONTRAST_PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, r: contrastRatio(p[fg], p[bg]) })).sort((a, b) => a.r / a.min - b.r / b.min)[0];
    rows.push(`  ${`${name}/${scheme}`.padEnd(22)} tightest: ${worst.fg} on ${worst.bg} ${worst.r.toFixed(2)}:1 (needs ${worst.min}:1)`);
  }
}
console.log(rows.join('\n'));
if (failures.length) {
  console.error(`\n${failures.length} of ${checked} pairs fail WCAG 2.2 AA:`);
  for (const f of failures) console.error(`  ✗ ${f.palette}: ${f.fg} on ${f.bg} = ${f.ratio}:1 < ${f.min}:1 (${f.use})`);
  process.exit(1);
}
console.log(`\nAll ${checked} colour pairs pass WCAG 2.2 AA.`);
