import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const mainPath = new URL('deno/main.ts', root);
const result = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['packages/core/src/index.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
});
const bundle = result.outputFiles[0].text;
const main = await readFile(mainPath, 'utf8');
const assetsPattern = /const staticAssets = \{[\s\S]*?\n\};/;
if (!assetsPattern.test(main)) {
  throw new Error('Missing staticAssets block in deno/main.ts');
}
const assets = `const staticAssets = {\n  "/static/iscn-core.js": ${JSON.stringify(bundle)}\n};`;
// A replacement function preserves dollar signs in the generated JavaScript.
const updatedMain = main.replace(assetsPattern, () => assets);
if (process.argv.includes('--check')) {
  if (updatedMain !== main) {
    throw new Error('Browser bundle is stale. Run npm run build:browser in packages/core.');
  }
  console.log('Embedded browser bundle is current.');
} else {
  await writeFile(mainPath, updatedMain);
  await writeFile(new URL('deno/static/iscn-core.js', root), bundle);
  console.log('Updated browser bundle for Deno Deploy and local static serving.');
}
