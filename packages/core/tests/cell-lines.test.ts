import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { validateKaryotypeNative } from "../src/validate.ts";
import { KaryotypeParser } from "../src/parser.ts";
import { RuleEngine } from "../src/engine.ts";

Deno.test("each cell line receives chromosome and abnormality rules with its own context", () => {
  for (const [input, error] of [
    ["47,XX,+21[10]/47,XX,+99[5]", /Cell line 2: Invalid chromosome '99'/],
    ["47,XX,+21[5]/46,Y[10]", /Cell line 2: Sex chromosomes/],
    ["47,XX,+21[5]/46,XX,del(5)(p13q33)[10]", /Cell line 2: Interstitial deletion/],
    ["47,XX,+21[5]/45,X[5]/0,XX[10]", /Cell line 3: Chromosome count 0/],
  ] as const) {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, false, input);
    assertMatch(result.errors.join("\n"), error);
  }
});

Deno.test("cell line evaluation preserves the AST and does not duplicate the first line", () => {
  const ast = new KaryotypeParser().parse("47,XX,+21[5]/46,XX[10]");
  const before = structuredClone(ast);
  const engine = new RuleEngine();
  engine.addRule({
    id: "context", category: "test", description: "Check the current line",
    validate: (line) => [`${line.chromosome_count},${line.sex_chromosomes}`],
  });
  const result = engine.validate(ast);
  assertEquals(result.errors, ["Cell line 1: 47,XX", "Cell line 2: 46,XX"]);
  assertEquals(result.parsed, before);
  assertEquals(ast, before);
});

Deno.test("normal lines follow abnormal lines even when they have more metaphases", () => {
  for (const input of ["47,XX,+21[5]/46,XX[10]", "45,X[5]/46,XX[10]", "47,XXY[5]/46,XY[10]"]) {
    assertEquals(validateKaryotypeNative(input).valid, true, input);
  }
  for (const input of ["46,XX[10]/47,XX,+21[5]", "46,XX[10]/45,X[5]"]) {
    const result = validateKaryotypeNative(input);
    assertEquals(result.valid, false);
    assertMatch(result.errors.join("\n"), /normal cell line.*last/i);
  }
});

Deno.test("normal XX and XY lines use size then XX before XY for equal counts", () => {
  assertEquals(validateKaryotypeNative("chi 46,XY[25]/46,XX[10]").valid, true);
  assertEquals(validateKaryotypeNative("46,XX[10]/46,XY[10]").valid, true);
  for (const input of ["46,XY[10]/46,XX[10]", "46,XX[5]/46,XY[10]"]) {
    assertEquals(validateKaryotypeNative(input).valid, false, input);
  }
});

Deno.test("multiple cell lines require positive safe integer metaphase counts", () => {
  for (const suffix of ["", "[0]", "[-1]", "[1.5]", "[١٠]", "[9007199254740992]", `[${"9".repeat(5000)}]`]) {
    const result = validateKaryotypeNative(`47,XX,+21[5]/46,XX${suffix}`);
    assertEquals(result.valid, false, suffix);
    assertMatch(result.errors.join("\n"), /Cell line 2:.*count/i);
  }
});

Deno.test("mosaic prefixes and ranges retain their types in every cell line", () => {
  const result = validateKaryotypeNative("mos 47,XX,+21[5]/46,XX[10]");
  assertEquals(result.valid, true);
  assertEquals(result.parsed?.modifiers?.mosaic, true);
  const range = new KaryotypeParser().parse("47,XX,+21[5]/45~48,XX[10]");
  assertEquals<number | string | undefined>(range.cell_lines?.[1].chromosome_count, "45~48");
});

Deno.test("transplant separators preserve recipient and donor groups without cross-group sorting", () => {
  for (const input of ["46,XX[5]//47,XY,+21[15]", "//46,XX[20]", "46,XY[20]//"]) {
    assertEquals(validateKaryotypeNative(input).valid, true, input);
  }
  const result = validateKaryotypeNative("46,XX[5]//47,XY,+21[15]/46,XY[2]");
  assertEquals(result.parsed?.cell_lines?.map((line) => line.is_donor), [false, true, true]);
  assertEquals(validateKaryotypeNative("46,XX[5]//47,XY,+99[15]").valid, false);
  for (const input of ["//", "46,XX[5]///46,XY[5]", "46,XX[5]//46,XY[5]//46,XX[5]"]) {
    assertEquals(validateKaryotypeNative(input).valid, false, input);
  }
});
