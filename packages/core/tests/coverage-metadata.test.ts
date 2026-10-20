import { assertEquals, assert } from "jsr:@std/assert@1";
import * as core from "../src/index.ts";

Deno.test("coverage distinguishes supported routine notation from partial analyses", () => {
  const coverage = core.getValidationCoverage;
  assertEquals(typeof coverage, "function");
  assertEquals(coverage(core.validateKaryotypeNative("46,XX[20]").parsed).level, "supported");
  for (const input of ["46,XX,der(2)t(2;8)(p21;q24)", "46,XX,foo", "69,XXY", "45~48,XX,+7[cp10]", "46,XX.arr[GRCh38] 1p36(1_200)x1", "nuc ish (ABC)x2[20]"]) {
    assertEquals(coverage(core.validateKaryotypeNative(input).parsed).level, "partial", input);
  }
  assertEquals(coverage(null).level, "unparsed");
});

Deno.test("single-line counts and related clones retain literal descriptions", () => {
  const single = core.validateKaryotypeNative(" 47,XX,+21[20] ").parsed;
  assertEquals(single?.count, 20);
  assertEquals(single?.cell_lines, null);
  assertEquals(single?.modifiers?.mosaic, undefined);
  assertEquals(single?.raw, " 47,XX,+21[20] ");
  const raw = "46,XX,t(2;8)(p21;q24)[7]/47,sl,+12[4]/48,sdl1,+9[3]";
  const ast = core.validateKaryotypeNative(raw).parsed;
  assertEquals(ast?.raw, raw);
  const line = ast?.cell_lines?.[2];
  assert(line);
  assertEquals(line.reference, { token: "sdl1", cell_line: 2 });
  assertEquals(line.raw, "48,sdl1,+9[3]");
  assertEquals(line.changes?.map((abn) => abn.raw), ["+9"]);
  assertEquals(line.abnormalities.map((abn) => abn.raw), ["t(2;8)(p21;q24)", "+12", "+9"]);
});

Deno.test("idem references the first clone instead of the immediately previous clone", () => {
  const ast = core.validateKaryotypeNative("46,XX,t(2;8)(p21;q24)[7]/47,idem,+12[4]/47,idem,+9[3]").parsed;
  assertEquals(ast?.cell_lines?.[2].abnormalities.map((abn) => abn.raw), ["t(2;8)(p21;q24)", "+9"]);
});

Deno.test("catalogue subbands and unvalidated payloads always expose coverage limits", () => {
  for (const input of ["46,XX.arr", "46,XX,del(5)(p15.311)", "46,XX,i(X)(q10)", "46,XX,dmin"]) {
    const coverage = core.getValidationCoverage(core.validateKaryotypeNative(input).parsed);
    assertEquals(coverage.level, "partial", input);
    assert(coverage.notes.length > 0);
  }
});
