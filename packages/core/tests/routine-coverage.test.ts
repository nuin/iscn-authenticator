import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { validateKaryotypeNative } from "../src/validate.ts";

const valid = [
  "46,XX[20]", "47,XX,+21[20]", "45,XY,-Y[12]", "47,XX,+X[8]",
  "47,XXY[10]", "46,XX,+8,-7[10]", "47,XX,del(5)(q13q33),+8[10]",
  "46,XX,del(5)(p15)", "46,XX,del(5)(p15.3)", "46,XX,del(5)(p15.31)",
  "46,XX,i(7)(q10)", "45,XX,rob(13;14)(q10;q10)",
  "46,XX,t(2;8)(p21;q24)[7]/47,idem,+12[4]",
  "46,XX,t(2;8)(p21;q24)[7]/47,sl,+12[4]/48,sdl1,+9[3]/49,sdl2,+10[2]",
  "46,XX,t(2;8)(p21;q24)[7]/47,sl,+12[4]/48,sdl,+9[3]",
  "69,XXY[10]", "45~48,XX,+7,-8[cp10]",
];
const invalid = [
  "46,XX,+21", "46,XX,del(99)(p15)", "46,XX,del(5)(q99)",
  "46,XX,t(2;99)(p21;q24)", "46,XX,del(5)(p99.1)",
  "46,XX[0]", "46,XX[-1]", "46,XX[1.5]", "46,XX[9007199254740992]", "46,XX[20][3]",
  "46,XX,+8[4]/48,idem,+9[3]", "47,idem,+12[4]",
  "46,XX,t(2;8)(p21;q24)[7]/47,sdl1,+12[4]",
  "46,XX,t(2;8)(p21;q24)[7]/47,sl,+12[4]/48,sl,+9,+10[3]/49,sdl,+11[2]",
  "46,XX,t(2;8)(p21;q24)[7]/47,idem,+12[4]/48,sl,+9,+10[3]",
  "46,XX,idem", "46,XX,t(2;8)(p21;q24)[7]//47,idem,+12[4]", "48~45,XX[cp10]",
];
for (const input of valid) Deno.test(`routine accepted: ${input}`, () => {
  assertEquals(validateKaryotypeNative(input).valid, true, JSON.stringify(validateKaryotypeNative(input).errors));
});
for (const input of invalid) Deno.test(`routine rejected: ${input}`, () => {
  const result = validateKaryotypeNative(input);
  assertEquals(result.valid, false);
  assertMatch(result.errors.join(" "), /count|chromosome|band|reference|clone|shorthand|range|mix/i);
});

Deno.test("count and structural checks reject additional malformed boundaries", () => {
  for (const input of ["46,XX[cp0]", "46,XX[cp9007199254740992]", "46,XX,+21[0]", "47,XX,+99c", "46,XX,ins(1;2)(p31;q21q31;q22)", "46,XX,del(5)(p153)"]) {
    assertEquals(validateKaryotypeNative(input).valid, false, input);
  }
});

Deno.test("unicode numerical signs and multiplicity preserve the source token", () => {
  const result = validateKaryotypeNative("45,XY,−Y[12]");
  assertEquals(result.valid, true);
  assertEquals(result.parsed?.abnormalities[0].type, "-");
  assertEquals(result.parsed?.abnormalities[0].raw, "−Y");
  assertEquals(validateKaryotypeNative("46,XX,del(5)(p15)×2").parsed?.abnormalities[0].copy_count, 2);
});

Deno.test("polyploid and hypohaploid totals are retained without a diploid range rule", () => {
  for (const input of ["92,XXXX[6]", "184,XXXXXXXX[4]", "22,X[3]", "93,XXXX,+8[5]"]) {
    assertEquals(validateKaryotypeNative(input).valid, true, input);
  }
  for (const count of ["0", "-1", "1.5", "9007199254740992", "9".repeat(5000)]) {
    assertEquals(validateKaryotypeNative(`${count},XX`).valid, false);
  }
});

Deno.test("insertion layouts cannot bypass chromosome to breakpoint mapping", () => {
  for (const token of ["ins(1;2;3;4)(p31q21q31)", "ins(1;2;3;4)(p99q99q99)", "ins(1;2)(p31q21q31)", "ins(1)(p31;q21q31)", "del(5)(p101)", "rec(99)del(5)(q13q33)", "upd(99)mat"]) {
    assertEquals(validateKaryotypeNative(`46,XX,${token}`).valid, false, token);
  }
});

Deno.test("oversized references and multiplicities return validation errors", () => {
  for (const input of [
    `46,XX,del(5)(p15)[2]/47,sdl${"9".repeat(4500)},+8[1]`,
    `46,XX,del(5)(p15)×${"9".repeat(4500)}`,
  ]) assertEquals(validateKaryotypeNative(input).valid, false);
  assertEquals(validateKaryotypeNative(`${"0".repeat(4500)}45~46,XX`).valid, true);
});

Deno.test("region-only breakpoints keep uncertainty and do not become centromeres", () => {
  const result = validateKaryotypeNative("46,XX,del(5)(p1?)");
  assertEquals(result.valid, true);
  assertEquals(result.parsed?.abnormalities[0].breakpoints[0].band, null);
  assertEquals(result.parsed?.abnormalities[0].breakpoints[0].uncertain, true);
  assertEquals(validateKaryotypeNative("46,XX,del(5)(p15?)").valid, true);
  assertEquals(validateKaryotypeNative("46,XX,del(5)(p15)mat×2").valid, true);
  assertEquals(validateKaryotypeNative("46,XX,del(5)(p15)×2mat").valid, false);
});

Deno.test("acquired sex chromosome changes require contextual count review", () => {
  for (const input of ["45,X,-Y[9]/46,XY[6]", "45,X,-X[7]", "45,Y,-X[11]"]) {
    assertEquals(validateKaryotypeNative(input).valid, true, input);
  }
});

Deno.test("paired and insertion breakpoints preserve uncertainty consistently", () => {
  for (const token of ["inv(5)(p15?q13)", "ins(1;2)(p31;q21?q31)", "ins(1)(p31?q21q31)", "trp(1)(q21?q31)", "qdp(1)(q21q31?)"]) {
    const result = validateKaryotypeNative(`46,XX,${token}`);
    assertEquals(result.valid, true, token);
    assertEquals(result.parsed?.abnormalities[0].breakpoints.some((bp) => bp.uncertain), true);
  }
});
