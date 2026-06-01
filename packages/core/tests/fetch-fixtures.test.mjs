import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "scripts", "fetch-fixtures.mjs");
const TARGET = path.join(__dirname, "fixtures", "validity.json");
const CWD = path.join(__dirname, "..");

test("fetch-fixtures downloads validity.json from the pinned tag", () => {
  rmSync(TARGET, { force: true });

  const result = spawnSync("node", [SCRIPT], { encoding: "utf8", cwd: CWD });

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(existsSync(TARGET), "validity.json should exist after fetch");

  const parsed = JSON.parse(readFileSync(TARGET, "utf8"));
  assert.ok(Array.isArray(parsed.valid), "expected `valid` array");
  assert.ok(Array.isArray(parsed.invalid), "expected `invalid` array");
  assert.ok(parsed.valid.length > 0, "expected non-empty valid array");
});

test("fetch-fixtures fails loudly when given a bogus tag via env override", () => {
  rmSync(TARGET, { force: true });

  const result = spawnSync("node", [SCRIPT], {
    encoding: "utf8",
    cwd: CWD,
    env: { ...process.env, ISCN_FIXTURES_TAG_OVERRIDE: "v0.0.0-nonexistent" },
  });

  assert.notEqual(result.status, 0, "script should exit non-zero on 404");
  assert.match(result.stderr, /404|not found/i, "stderr should mention the failure");
  assert.ok(!existsSync(TARGET), "validity.json should not be left behind on failure");
});
