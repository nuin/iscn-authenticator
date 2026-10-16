import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { KaryotypeParser, ParseError } from "../src/parser.ts";
import {
  deletionBreakpointRule,
  quadruplicationBreakpointRule,
  ringChromosomeBreakpointRule,
} from "../src/rules/abnormality.ts";

const parser = new KaryotypeParser();

Deno.test("abnormality metadata survives every structural parsing mode", () => {
  const cases: [string, string, string, number | null, string[]][] = [
    ["?del(5)(p13p15)umatx2", "del", "umat", 2, ["p", "p"]],
    ["?inv(1)(p10q20)patx3", "inv", "pat", 3, ["p", "q"]],
    ["?t(1;2)(p10;q20)dnx4", "t", "dn", 4, ["p", "q"]],
    ["?ins(1;2)(p10;q20q30)matx2", "ins", "mat", 2, ["p", "q", "q"]],
    ["?i(Xq)upatx2", "i", "upat", 2, ["q"]],
    ["?r(1)(p10q20)matx2", "r", "mat", 2, ["p", "q"]],
    ["?hsr(1)(q10)matx2", "hsr", "mat", 2, ["q"]],
    ["?+2mar1patx3", "+mar", "pat", 2, []],
    ["?+marpatx3", "+mar", "pat", null, []],
    ["?upd(1)umatx3", "upd", "umat", 3, []],
    ["?unknownmatx2", "unknown", "mat", 2, []],
  ];
  for (const [raw, type, inheritance, copies, arms] of cases) {
    const [abnormality] = parser.parse(`46,XX, ${raw} `).abnormalities;
    assertEquals(abnormality.type, type, raw);
    assertEquals(abnormality.raw, raw);
    assertEquals(abnormality.uncertain, true);
    assertEquals(abnormality.inheritance, inheritance);
    assertEquals(abnormality.copy_count, copies);
    assertEquals(abnormality.breakpoints.map((bp) => bp.arm), arms);
  }
});

Deno.test("breakpoints retain subbands and individual uncertainty", () => {
  const [abnormality] = parser.parse("46,XX,del(5)(p13.12?p15?)").abnormalities;
  assertEquals(abnormality.uncertain, false);
  assertEquals(abnormality.breakpoints, [
    { arm: "p", region: 1, band: 3, subband: "12", uncertain: true },
    { arm: "p", region: 1, band: 5, subband: null, uncertain: true },
  ]);
});

Deno.test("malformed committed prefixes preserve exact parse errors", () => {
  const cases = [
    ["del(1)", "Invalid deletion format: 'del(1)'"],
    ["add(1)", "Invalid additional material format: 'add(1)'"],
    ["rob(1)", "Invalid Robertsonian translocation format: 'rob(1)'"],
    ["i(1)", "Invalid isochromosome format: 'i(1)'"],
    ["r(1)(bad)", "Invalid breakpoint format: 'bad'"],
    [
      "inv(1)(p10?p20?)",
      "Inversion requires two breakpoints: 'inv(1)(p10?p20?)'",
    ],
    ["trp(1)(p10)", "Triplication requires two breakpoints: 'trp(1)(p10)'"],
    ["qdp(1)(p10)", "Quadruplication requires two breakpoints: 'qdp(1)(p10)'"],
    ["ins(1)(p10q20)", "Invalid insertion breakpoints: 'p10q20'"],
  ];
  for (const [part, message] of cases) {
    const error = assertThrows(() => parser.parse(`46,XX,${part}`), ParseError);
    assertEquals(error.message, message);
  }
});

Deno.test("optional patterns retain unknown tokens and metadata suffix order", () => {
  const ast = parser.parse("46,XX,ace(1),hsr(1),psu dic(1),+21x2pat");
  assertEquals(ast.abnormalities.map((abn) => abn.type), [
    "unknown",
    "unknown",
    "unknown",
    "unknown",
  ]);
  const last = ast.abnormalities[3];
  assertEquals(last.inheritance, "pat");
  assertEquals(last.copy_count, null);
  assertEquals(last.raw, "+21x2pat");
});

Deno.test("breakpoint rules retain arm errors and count error precedence", () => {
  const cases = [
    [
      deletionBreakpointRule,
      "del(5)(p13q15)",
      "Interstitial deletion breakpoints must be on same arm, found p and q in del(5)(p13q15)",
    ],
    [
      ringChromosomeBreakpointRule,
      "r(1)(p10)",
      "Ring chromosome requires two breakpoints, found 1 in r(1)(p10)",
    ],
    [
      ringChromosomeBreakpointRule,
      "r(1)(p10p20)",
      "Ring chromosome breakpoints must be on different arms, found p and p in r(1)(p10p20)",
    ],
    [
      quadruplicationBreakpointRule,
      "qdp(1)(p10q20)",
      "Quadruplication breakpoints must be on same arm, found p and q in qdp(1)(p10q20)",
    ],
  ] as const;
  for (const [rule, part, message] of cases) {
    const ast = parser.parse(`46,XX,${part}`);
    assertEquals(rule.validate(ast, ast.abnormalities[0]), [message]);
  }
});
