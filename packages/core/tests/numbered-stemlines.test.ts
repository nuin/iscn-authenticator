import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { validateKaryotypeNative } from "../src/index.ts";

const twoFamilies = "45,XY,-7[5]/46,sl1,+8[6]/46,XY,t(9;22)(q34;q11.2)[3]/92,sl2×2[5]/93,sl2x2,+8[2]";

Deno.test("numbered stemlines select independent sources, not intervening sidelines", () => {
  const result = validateKaryotypeNative(twoFamilies);
  assertEquals(result.valid, true, result.errors.join("; "));
  const lines = result.parsed!.cell_lines!;
  assertEquals(lines.map((line) => line.reference?.cell_line ?? null), [null, 1, null, 3, 3]);
  assertEquals(lines.map((line) => line.sex_chromosomes), ["XY", "XY", "XY", "XXYY", "XXYY"]);
  assertEquals(lines.map((line) => line.abnormalities.map((abn) => [abn.type, abn.chromosome, abn.copy_count])), [
    [["-", "7", null]], [["-", "7", null], ["+", "8", null]], [["t", "9;22", null]],
    [["t", "9;22", 2]], [["t", "9;22", 2], ["+", "8", null]],
  ]);
  assertEquals(lines[4].raw, "93,sl2x2,+8[2]");
  assertEquals(lines[4].reference?.token, "sl2x2");
  assertEquals(lines[4].changes?.map((abn) => abn.raw), ["+8"]);
});

Deno.test("explicit sl1 can return to the first family after a second stemline", () => {
  const result = validateKaryotypeNative("47,XY,+8[5]/47,XX,+9[5]/48,sl2,+10[5]/48,sl1,+11[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  const line = result.parsed!.cell_lines![3];
  assertEquals(line.reference?.cell_line, 1);
  assertEquals(line.sex_chromosomes, "XY");
  assertEquals(line.abnormalities.map((abn) => abn.raw), ["+8", "+11"]);
});

Deno.test("idem still selects the first clone after another fully written clone", () => {
  const result = validateKaryotypeNative("47,XY,+8[5]/47,XX,+9[5]/48,idem,+10[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  const line = result.parsed!.cell_lines![2];
  assertEquals(line.reference?.cell_line, 1);
  assertEquals(line.sex_chromosomes, "XY");
  assertEquals(line.abnormalities.map((abn) => abn.raw), ["+8", "+10"]);
});

Deno.test("stemline numbering restarts in the donor group", () => {
  const result = validateKaryotypeNative("47,XX,+8[5]//47,XY,+9[5]/47,XY,+10[5]/48,sl2,+11[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  const line = result.parsed!.cell_lines![3];
  assertEquals(line.reference?.cell_line, 2);
  assertEquals(line.is_donor, true);
  assertEquals(line.abnormalities.map((abn) => abn.raw), ["+10", "+11"]);
});

const rejected: [string, string][] = [
  ["47,XX,+8[5]/48,sl,+9[5]/47,XX,+10[5]/49,sdl1,+11[5]", "Sideline references with multiple stemlines"],
  ["47,XX,+8[5]/47,XX,+9[5]/48,sl,+10[5]", "ambiguous after an independent clone"],
  ["47,XX,+8[5]/48,sl2,+9[5]/47,XX,+10[5]", "no preceding stemline"],
  ["47,XX,+8[5]/48,sl0,+9[5]", "Unsupported clone reference"],
  ["47,XX,+8[5]/48,sl9007199254740992,+9[5]", "no preceding stemline"],
  ["47,XX,+8[5]/48,sl1x0,+9[5]", "multiplier"],
  ["47,XX,+8[5]//48,sl1,+9[5]", "no preceding reference clone"],
  ["47,XX,+8[cp5]/47,XX,+9[5]/48,sl1,+10[5]", "Composite groups cannot use clone references"],
  ["47,XX,+8[5]/48,sl1,+9[5]/49,idem,+10[5]", "Do not mix"],
  ["47,XX,+8[5]/93,sl1x2[5]", "expected total 94"],
];
for (const [input, error] of rejected) {
  Deno.test(`reject unsafe stemline selection: ${input}`, () => {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, false);
    assertStringIncludes(result.errors.join("; "), error);
  });
}

Deno.test("oversized index text does not cause an integer conversion failure", () => {
  const result = validateKaryotypeNative(`47,XX,+8[5]/48,sl${"9".repeat(5000)},+9[5]`);
  assertEquals(result.valid, false);
  assertStringIncludes(result.errors.join("; "), "no preceding stemline");
});

Deno.test("a composite before a usable second stemline does not renumber that source", () => {
  const result = validateKaryotypeNative("47,XX,+8[cp5]/47,XY,+9[5]/48,sl2,+10[5]");
  assertEquals(result.valid, true, result.errors.join("; "));
  assertEquals(result.parsed!.cell_lines![2].reference?.cell_line, 2);
  assertEquals(result.parsed!.cell_lines![2].abnormalities.map((abn) => abn.raw), ["+9", "+10"]);
});
