import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { getValidationCoverage, validateKaryotypeNative } from "../src/index.ts";

Deno.test("clone multipliers preserve source findings and provenance", () => {
  for (const token of ["idemx2", "idem×2", "slx2"]) {
    const input = `47,XY,+8[10]/94,${token}[5]`;
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, true, result.errors.join("; "));
    const lines = result.parsed?.cell_lines;
    assertEquals(lines?.[0].sex_chromosomes, "XY");
    assertEquals(lines?.[0].abnormalities[0].copy_count, null);
    assertEquals(lines?.[1].sex_chromosomes, "XXYY");
    assertEquals(lines?.[1].abnormalities[0].copy_count, 2);
    assertEquals(lines?.[1].abnormalities[0].raw, "+8");
    assertEquals(lines?.[1].reference?.token, token);
    assertEquals(lines?.[1].changes, []);
    assertEquals(lines?.[1].raw, `94,${token}[5]`);
    assertEquals(getValidationCoverage(result.parsed).notes.some((note) => note.code === "clone_resolution"), true);
  }
});

Deno.test("multipliers compose through a selected sideline", () => {
  const result = validateKaryotypeNative("47,XX,+8[5]/94,slx2[5]/188,sdl1x2[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  assertEquals(result.parsed?.cell_lines?.map((line) => line.abnormalities[0].copy_count), [null, 2, 4]);
});

Deno.test("structural subtraction retains loss unless a normal homologue is added", () => {
  for (const [changes, count, types] of [["-inv(3)", 45, ["-"]], ["+3,-inv(3)", 46, []]] as const) {
    const result = validateKaryotypeNative(`46,XX,inv(3)(p21q26)[10]/${count},idem,${changes}[5]`);
    assertEquals(result.valid, true, result.errors.join("; "));
    assertEquals(result.parsed?.cell_lines?.[0].abnormalities[0].type, "inv");
    assertEquals(result.parsed?.cell_lines?.[1].abnormalities.map((abn) => abn.type), [...types]);
    assertEquals(result.parsed?.cell_lines?.[1].changes?.map((abn) => abn.raw), changes.split(","));
  }
});

Deno.test("a subtraction consumes only one of the multiplied structural copies", () => {
  const result = validateKaryotypeNative("46,XX,inv(3)(p21q26)[5]/91,idemx2,-inv(3)[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  assertEquals(result.parsed?.cell_lines?.[1].abnormalities.map((abn) => [abn.type, abn.copy_count]), [["inv", null], ["-", null]]);
});

Deno.test("opposite autosomal changes cancel without altering the source", () => {
  const result = validateKaryotypeNative("47,XX,+8[10]/46,idem,-8[5]");
  assertEquals(result.valid, true);
  assertEquals(result.parsed?.cell_lines?.[0].abnormalities.map((abn) => abn.raw), ["+8"]);
  assertEquals(result.parsed?.cell_lines?.[1].abnormalities, []);
});

const rejected: [string, string][] = [
  ["47,XX,+8[5]/93,idemx2[5]", "expected total 94"],
  ["46,XX,inv(3)(p21q26)[5]/46,idem,-inv(3)[5]", "expected total 45"],
  ["46,XX,inv(3)(p21q26),inv(3)(p13q21)[5]/45,idem,-inv(3)[5]", "ambiguous"],
  ["46,XX,inv(3)(p21q26)[5]/45,idem,-inv(5)[5]", "absent"],
  ["46,XX,?inv(3)(p21q26)[5]/45,idem,-inv(3)[5]", "uncertain"],
  ["46,XX,inv(3)(p21q26)[5]/44,idem,-inv(3)x2[5]", "copies"],
  ["46,XX,inv(3)(p21q26)[5]/45,idem,-t(3;5)[5]", "Unsupported structural clone subtraction"],
  ["47,XX,+8[5]/94,idemx0[5]", "multiplier"],
  ["47,XX,+8[5]/94,idemx9007199254740992[5]", "multiplier"],
  ["47,XX,+8[5]/94,idemx1000000000[5]", "expansion limit"],
  ["47,XX,+8[5]/94,idemx2[5]/95,sl,+9[5]", "Do not mix"],
];
for (const [input, error] of rejected) {
  Deno.test(`reject unsafe clone expansion: ${input}`, () => {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, false);
    assertStringIncludes(result.errors.join("; "), error);
  });
}
