#!/usr/bin/env node
// Pre-publish guard: refuse to publish when the git tag does not match
// the version in packages/core/package.json.
//
// Expected tag format: v<semver>-core, e.g. v0.1.0-core.
// GitHub Actions exposes the tag in GITHUB_REF_NAME.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const tag = process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error("verify-tag: GITHUB_REF_NAME is not set; refusing to publish.");
  process.exit(1);
}

const match = /^v(.+)-core$/.exec(tag);
if (!match) {
  console.error(
    `verify-tag: tag ${JSON.stringify(tag)} does not match expected v<semver>-core pattern.`,
  );
  process.exit(1);
}

const tagVersion = match[1];
if (tagVersion !== pkg.version) {
  console.error(
    `verify-tag: tag version (${tagVersion}) does not match package.json (${pkg.version}).`,
  );
  process.exit(1);
}

console.log(`verify-tag: ok (${tag} -> ${pkg.version})`);
