import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { getValidationCoverage, validateKaryotypeNative } from "../src/index.ts";

const derivativeCases: [string, boolean, string?][] = [
  ["46,XX,der(5)t(5;99)(q13;p13)", false, "Invalid chromosome '99'"],
  ["46,XX,der(5)t(5;12)(q13;p99)", false, "12p99"],
  ["46,XX,der(5)t(5;12)(q13)", false, "breakpoints"],
  ["46,XX,der(5)t(5;12)(q13;p13", false, "parentheses"],
  ["46,XX,der(5)t(5;12)(q13;p13)", true],
  ["47,XX,+der(5)t(5;12)(q13;p13)", true],
  ["46,XX,der(5)t(5;99)", false, "Invalid chromosome '99'"],
  ["46,XX,der(5)t(5;12)", true],
  ["46,XX,der(11)t(5;11)(q13;q12)t(5;8)(q23;q24.1)", true],
  ["45,XX,der(21;21)(q10;q10)", true],
  ["45,XX,der(21;21)(q10;q99)", false, "21q99"],
  ["45,XX,der(21;21)(q10)", false, "breakpoints"],
];

for (const [input, valid, error] of derivativeCases) {
  Deno.test(`derivative components: ${input}`, () => {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, valid, result.errors.join("; "));
    if (error) assertStringIncludes(result.errors.join("; "), error);
    assertEquals(result.parsed?.raw, input);
    assertEquals(getValidationCoverage(result.parsed).level, "partial");
  });
}

Deno.test("composite counts belong to their own group", () => {
  const input = "45~47,XX,del(5)(q13q33),+8[cp12]/46,XX[8]";
  const result = validateKaryotypeNative(input);
  assertEquals(result.valid, true, result.errors.join("; "));
  assertEquals(result.parsed?.cell_lines?.map((line) => [line.count, line.raw]), [
    [12, input.split("/")[0]], [8, "46,XX[8]"],
  ]);
  assertEquals(result.parsed?.modifiers?.composite, undefined);
  assertEquals(getValidationCoverage(result.parsed).notes.some((note) => note.code === "composite"), true);
});

Deno.test("a composite group does not suppress totals in ordinary groups", () => {
  const result = validateKaryotypeNative("45~47,XX,+8[cp12]/47,XX,+8,+9[8]");
  assertEquals(result.valid, false);
  assertStringIncludes(result.errors.join("; "), "Cell line 2: Chromosome count 47 does not match the expected total 48");
});

Deno.test("composite metaphases are counted for a single group", () => {
  for (const suffix of ["[cp12]", ".cp[12]"]) {
    const result = validateKaryotypeNative(`45~47,XX,+8${suffix}`);
    assertEquals(result.valid, true);
    assertEquals(result.parsed?.count, 12);
    assertEquals(result.parsed?.modifiers?.composite, 12);
  }
});

Deno.test("aggregate groups cannot supply or use a clone reference", () => {
  for (const input of ["47,XX,+8[cp12]/48,idem,+9[8]", "47,XX,+8[12]/48,idem,+9[cp8]"]) {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, false);
    assertStringIncludes(result.errors.join("; "), "Composite groups cannot use clone references");
  }
});
