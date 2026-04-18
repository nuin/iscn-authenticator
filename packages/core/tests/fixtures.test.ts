/**
 * Fixture-driven cross-implementation consistency tests.
 *
 * Reads fixtures/validity.json (shared with the Python runner) and asserts
 * that @iscn/core agrees with each case. CI runs both runners; any
 * disagreement fails the build.
 */

import { assert, assertFalse } from "jsr:@std/assert@1";
import { isValidKaryotypeNative } from "../src/validate.ts";

interface ValidCase {
  input: string;
  note?: string;
}

interface InvalidCase {
  input: string;
  reason?: string;
}

interface Fixtures {
  $schema_version: number;
  valid: ValidCase[];
  invalid: InvalidCase[];
}

const fixturesUrl = new URL("../../../fixtures/validity.json", import.meta.url);
const fixtures: Fixtures = JSON.parse(await Deno.readTextFile(fixturesUrl));

Deno.test("all valid fixtures pass validation", () => {
  const failures: string[] = [];
  for (const c of fixtures.valid) {
    if (!isValidKaryotypeNative(c.input)) {
      failures.push(`expected valid: ${JSON.stringify(c.input)} (${c.note ?? ""})`);
    }
  }
  assert(
    failures.length === 0,
    `${failures.length} valid fixtures failed:\n${failures.join("\n")}`,
  );
});

Deno.test("all invalid fixtures fail validation", () => {
  const failures: string[] = [];
  for (const c of fixtures.invalid) {
    if (isValidKaryotypeNative(c.input)) {
      failures.push(`expected invalid: ${JSON.stringify(c.input)} (${c.reason ?? ""})`);
    }
  }
  assertFalse(
    failures.length > 0,
    `${failures.length} invalid fixtures unexpectedly passed:\n${failures.join("\n")}`,
  );
});
