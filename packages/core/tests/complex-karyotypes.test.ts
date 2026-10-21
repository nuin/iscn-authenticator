import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { getValidationCoverage, validateKaryotypeNative } from "../src/index.ts";

interface ComplexCase {
  id: string;
  input: string;
  status: "Checks passed" | "Review required" | "Issues found";
  purpose: string;
  notes?: string[];
  error?: string;
  cells?: number;
}

const cases: ComplexCase[] = JSON.parse(
  await Deno.readTextFile(new URL("./data/complex-karyotypes.json", import.meta.url)),
);

Deno.test("complex corpus has unique cases and all three outcomes", () => {
  assertEquals(cases.length, 90);
  assertEquals(new Set(cases.map((test) => test.id)).size, cases.length);
  assertEquals(new Set(cases.map((test) => test.status)).size, 3);
});

for (const test of cases) {
  Deno.test(`complex ${test.id}: ${test.purpose}`, () => {
    const result = validateKaryotypeNative(test.input);
    const coverage = getValidationCoverage(result.parsed);
    const status = !result.valid
      ? "Issues found"
      : coverage.level === "supported" ? "Checks passed" : "Review required";
    assertEquals(status, test.status, JSON.stringify(result.errors));
    for (const code of test.notes ?? []) {
      assert(coverage.notes.some((note) => note.code === code), `Missing coverage: ${code}`);
    }
    if (test.error) assertStringIncludes(result.errors.join(" "), test.error);
    if (result.parsed) assertEquals(result.parsed.raw, test.input);
    if (test.cells !== undefined) {
      const total = result.parsed?.cell_lines?.reduce((sum, line) => sum + line.count, 0)
        ?? result.parsed?.count;
      assertEquals(total, test.cells);
    }
  });
}

Deno.test("interphase prefix variants retain the payload without splitting nuclei into clones", () => {
  for (const separator of ["", " ", "\t"]) {
    const payload = "(D21S259)x3[25/100]";
    const result = validateKaryotypeNative(`nuc ish${separator}${payload}`);
    assertEquals(result.valid, true);
    assertEquals(result.parsed?.modifiers?.ish, payload);
    assertEquals(result.parsed?.modifiers?.interphase, true);
    assertEquals(result.parsed?.cell_lines, null);
    assertEquals(result.parsed?.chromosome_count, null);
  }
});

Deno.test("branching clone additions are not accumulated from an unrelated sideline", () => {
  const test = cases.find((item) => item.id === "C09");
  assert(test);
  const lines = validateKaryotypeNative(test.input).parsed?.cell_lines;
  assertEquals(lines?.[1].abnormalities.map((abn) => abn.raw), ["t(2;8)(p21;q24)", "+12"]);
  assertEquals(lines?.[2].abnormalities.map((abn) => abn.raw), ["t(2;8)(p21;q24)", "+9"]);
  assertEquals(lines?.[2].reference, { token: "idem", cell_line: 1 });
});
