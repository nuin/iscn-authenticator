#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Regenerate the embedded OpenAPI YAML constant in `deno/main.ts`.
 *
 * Source of truth: `docs/openapi.yaml`. Run this whenever the YAML
 * changes; the drift test in `deno/tests/openapi_test.ts` enforces that
 * the embedded copy matches the canonical file byte-for-byte.
 *
 * Usage:
 *   deno run --allow-read --allow-write deno/scripts/embed-openapi.ts
 */

const REPO_ROOT = new URL("../../", import.meta.url);
const YAML_PATH = new URL("docs/openapi.yaml", REPO_ROOT);
const MAIN_PATH = new URL("deno/main.ts", REPO_ROOT);

const BEGIN = "// BEGIN_EMBEDDED_OPENAPI_YAML";
const END = "// END_EMBEDDED_OPENAPI_YAML";

const yaml = await Deno.readTextFile(YAML_PATH);
const literal = JSON.stringify(yaml);

const main = await Deno.readTextFile(MAIN_PATH);
const begin = main.indexOf(BEGIN);
const end = main.indexOf(END);
if (begin < 0 || end < 0 || end < begin) {
  console.error(
    `embed-openapi: missing ${BEGIN} / ${END} markers in ${MAIN_PATH.pathname}.`,
  );
  Deno.exit(1);
}

const before = main.slice(0, begin + BEGIN.length);
const after = main.slice(end);
const block = `\nconst OPENAPI_YAML: string = ${literal};\n`;
const next = `${before}${block}${after}`;

if (next === main) {
  console.log("embed-openapi: already up to date.");
} else {
  await Deno.writeTextFile(MAIN_PATH, next);
  console.log(`embed-openapi: updated ${MAIN_PATH.pathname} (${yaml.length} bytes).`);
}
