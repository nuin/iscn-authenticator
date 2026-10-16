import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { temporaryDirectory } from "./helpers/temporary-directory.mjs";

const packageRoot = new URL("../", import.meta.url);

function browserProject(t) {
  const root = temporaryDirectory(t, "iscn-browser-");
  for (const directory of ["packages/core/scripts", "packages/core/src", "deno/static"]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  const script = join(root, "packages/core/scripts/build-browser.mjs");
  copyFileSync(new URL("scripts/build-browser.mjs", packageRoot), script);
  symlinkSync(fileURLToPath(new URL("node_modules", packageRoot)), join(root, "packages/core/node_modules"), "dir");
  const main = join(root, "deno/main.ts");
  const source = join(root, "packages/core/src/index.ts");
  const bundle = join(root, "deno/static/iscn-core.js");
  writeFileSync(main, 'const staticAssets = {\n  "/static/iscn-core.js": "stale"\n};\n');
  writeFileSync(source, 'export const marker = "$& $` $\'";\n');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: root });
  return { main, source, bundle, run };
}

function snapshot(path) {
  return { content: readFileSync(path, "utf8"), modified: statSync(path, { bigint: true }).mtimeNs };
}

test("browser check rejects a stale embedded bundle without writing either artifact", (t) => {
  const project = browserProject(t);
  writeFileSync(project.bundle, "existing local bundle");
  const mainBefore = snapshot(project.main);
  const bundleBefore = snapshot(project.bundle);

  const result = project.run("--check");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale.*build:browser/i);
  assert.deepEqual(snapshot(project.main), mainBefore);
  assert.deepEqual(snapshot(project.bundle), bundleBefore);
});

test("browser check accepts a current embedded bundle without creating a local artifact", (t) => {
  const project = browserProject(t);
  assert.equal(project.run().status, 0);
  rmSync(project.bundle);
  const before = snapshot(project.main);

  const result = project.run("--check");

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(project.main), before);
  assert.equal(existsSync(project.bundle), false);
});

test("browser check rebuilds source to detect changed exports", (t) => {
  const project = browserProject(t);
  assert.equal(project.run().status, 0);
  writeFileSync(project.source, "export const marker = 42;\n");
  const before = snapshot(project.main);

  const result = project.run("--check");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale/i);
  assert.deepEqual(snapshot(project.main), before);
});

test("browser build preserves replacement tokens and writes matching artifacts", async (t) => {
  const project = browserProject(t);
  const result = project.run();
  assert.equal(result.status, 0, result.stderr);
  const match = readFileSync(project.main, "utf8").match(/const staticAssets = (\{[\s\S]*?\n\});/);
  assert.ok(match);
  const embedded = JSON.parse(match[1])["/static/iscn-core.js"];
  assert.equal(embedded, readFileSync(project.bundle, "utf8"));
  const module = await import(`data:text/javascript;base64,${Buffer.from(embedded).toString("base64")}`);
  assert.equal(module.marker, "$& $` $'");
});

test("browser check rejects a missing assets block without creating output", (t) => {
  const project = browserProject(t);
  writeFileSync(project.main, "export {};\n");
  const result = project.run("--check");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing staticAssets/i);
  assert.equal(readFileSync(project.main, "utf8"), "export {};\n");
  assert.equal(existsSync(project.bundle), false);
});
