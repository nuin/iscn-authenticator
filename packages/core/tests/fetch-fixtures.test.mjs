import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { temporaryDirectory } from "./helpers/temporary-directory.mjs";

const packageRoot = new URL("../", import.meta.url);

function fixtureProject(t) {
  const root = temporaryDirectory(t, "iscn-fixtures-");
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "tests/fixtures"), { recursive: true });
  copyFileSync(new URL("package.json", packageRoot), join(root, "package.json"));
  const script = join(root, "scripts/fetch-fixtures.mjs");
  copyFileSync(new URL("scripts/fetch-fixtures.mjs", packageRoot), script);
  const target = join(root, "tests/fixtures/validity.json");
  const run = (tag = "") => spawnSync(process.execPath, [script], {
    encoding: "utf8",
    cwd: root,
    timeout: 30_000,
    env: { ...process.env, ISCN_FIXTURES_TAG_OVERRIDE: tag },
  });
  return { target, run };
}

test("fetch-fixtures downloads validity.json from the pinned tag", (t) => {
  const { target, run } = fixtureProject(t);
  const result = run();

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(existsSync(target), "validity.json should exist after fetch");

  const parsed = JSON.parse(readFileSync(target, "utf8"));
  assert.ok(Array.isArray(parsed.valid), "expected `valid` array");
  assert.ok(Array.isArray(parsed.invalid), "expected `invalid` array");
  assert.ok(parsed.valid.length > 0, "expected non-empty valid array");
});

test("fetch-fixtures preserves the existing corpus when an overridden tag is missing", (t) => {
  const { target, run } = fixtureProject(t);
  const existing = '{"valid":[],"invalid":[]}\n';
  writeFileSync(target, existing);
  const result = run("v0.0.0-nonexistent");

  assert.notEqual(result.status, 0, "script should exit non-zero on 404");
  assert.match(result.stderr, /404|not found/i, "stderr should mention the failure");
  assert.equal(readFileSync(target, "utf8"), existing);
  assert.equal(existsSync(`${target}.tmp`), false);
});
