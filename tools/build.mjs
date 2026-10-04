// Bundles the app into a single self-contained HTML file: dist/gto-trainer.html
//
//   node tools/build.mjs              full HTML document
//   node tools/build.mjs --fragment   page content only (no <html>/<head>/<body>),
//                                     for hosts that supply their own document shell
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fragment = process.argv.includes('--fragment');
const outArg = process.argv.find((a) => a.startsWith('--out='));

const html = read('index.html');
const block = html.match(/<!-- build:scripts -->([\s\S]*?)<!-- \/build:scripts -->/);
if (!block) throw new Error('build markers not found in index.html');
const scripts = [...block[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((src) => `/* ${src} */\n${read(src)}`).join('\n');
if (js.includes('</script')) throw new Error('a script contains "</script"');
const css = read('css/styles.css');

let out = html
  .replace(/<link rel="stylesheet" href="css\/styles.css">/, () => `<style>\n${css}\n</style>`)
  .replace(block[0], () => `<script>\n${js}\n</script>`);

if (fragment) {
  const head = out.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = out.match(/<body>([\s\S]*?)<\/body>/)[1];
  out = head.trim() + '\n' + body.trim() + '\n';
}

const dest = outArg ? outArg.slice('--out='.length) : join(root, 'dist', 'gto-trainer.html');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
console.log(`wrote ${dest} (${(out.length / 1024).toFixed(0)} KB, ${scripts.length} scripts inlined)`);
