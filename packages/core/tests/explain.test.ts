import { assert, assertEquals } from "jsr:@std/assert@1";
import { KaryotypeParser } from "../src/parser.js";
import { generateTemplateExplanation } from "../src/explain/template.js";
import { lookupCuratedExplanation } from "../src/explain/curated.js";
import { explain } from "../src/explain/index.js";

const parser = new KaryotypeParser();

Deno.test("template: normal female", () => {
  const ast = parser.parse("46,XX");
  const result = generateTemplateExplanation(ast);
  assertEquals(result.summary, "46,XX karyotype with 0 abnormalities.");
  assert(result.detail.includes("total chromosome count of 46"));
  assertEquals(result.confidence, "template");
});

Deno.test("template: trisomy 21", () => {
  const ast = parser.parse("47,XY,+21");
  const abn = ast.abnormalities[0];
  const result = generateTemplateExplanation(abn);
  assertEquals(result.summary, "Gain of chromosome 21.");
  assertEquals(result.confidence, "template");
});

Deno.test("template: deletion with breakpoints", () => {
  const ast = parser.parse("46,XX,del(5)(q13q33)");
  const abn = ast.abnormalities[0];
  const result = generateTemplateExplanation(abn);
  assertEquals(result.summary, "Deletion on chromosome 5 at q13, q33.");
  assertEquals(result.confidence, "template");
});

Deno.test("curated: trisomy 21 (Down syndrome)", () => {
  const ast = parser.parse("47,XY,+21");
  const result = lookupCuratedExplanation(ast);
  assert(result);
  assertEquals(result.confidence, "curated");
  assert(result.summary.includes("Down syndrome"));
});

Deno.test("curated: Philadelphia chromosome t(9;22)", () => {
  const ast = parser.parse("46,XX,t(9;22)(q34;q11.2)");
  const abn = ast.abnormalities[0];
  const result = lookupCuratedExplanation(abn);
  assert(result);
  assertEquals(result.confidence, "curated");
  assert(result.summary.includes("Philadelphia chromosome"));
});

Deno.test("explain: fallback to template", () => {
  // A specific deletion that is NOT in the curated JSON
  const ast = parser.parse("46,XX,del(7)(q22q36)");
  const abn = ast.abnormalities[0];
  const result = explain(abn);
  assertEquals(result.confidence, "template");
  assertEquals(result.summary, "Deletion on chromosome 7 at q22, q36.");
});
