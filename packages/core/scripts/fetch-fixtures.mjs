#!/usr/bin/env node
// Fetch fixtures/validity.json from the iscn-authenticator-py repo at a pinned tag.
// Pin is read from this package's package.json `iscn` block.

import { writeFileSync, renameSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_JSON = path.join(__dirname, "..", "package.json");
const OUT_DIR = path.join(__dirname, "..", "tests", "fixtures");
const OUT_FILE = path.join(OUT_DIR, "validity.json");
const TMP_FILE = OUT_FILE + ".tmp";

function fail(msg) {
  console.error(`fetch-fixtures: ${msg}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
const cfg = pkg.iscn;
if (!cfg || !cfg.fixturesRepo || !cfg.fixturesPath) {
  fail("package.json is missing the `iscn` config block (fixturesRepo, fixturesTag, fixturesPath).");
}

const tag = process.env.ISCN_FIXTURES_TAG_OVERRIDE || cfg.fixturesTag;
if (!tag) {
  fail("no fixturesTag in package.json `iscn` block and no ISCN_FIXTURES_TAG_OVERRIDE env var.");
}

const url = `https://raw.githubusercontent.com/${cfg.fixturesRepo}/refs/tags/${encodeURIComponent(tag)}/${cfg.fixturesPath}`;

console.log(`fetch-fixtures: GET ${url}`);

let response;
try {
  response = await fetch(url);
} catch (err) {
  fail(`network error: ${err.message}`);
}

if (!response.ok) {
  fail(`HTTP ${response.status} (${response.statusText || "not found"}) for ${url}`);
}

const body = await response.text();
if (!body.trim()) {
  fail("response body was empty");
}

// Validate it's actually JSON before writing
try {
  JSON.parse(body);
} catch (err) {
  fail(`response is not valid JSON: ${err.message}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(TMP_FILE, body);
renameSync(TMP_FILE, OUT_FILE);

console.log(`fetch-fixtures: wrote ${OUT_FILE} (${body.length} bytes, tag ${tag})`);
