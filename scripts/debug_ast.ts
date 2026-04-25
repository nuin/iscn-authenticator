import { validateKaryotypeNative } from "../packages/core/src/index.ts";

const k = "46,XX,t(9;22)(q34;q11.2)";
const result = validateKaryotypeNative(k);

console.log("Karyotype:", k);
if (result.parsed) {
  result.parsed.abnormalities.forEach((abn, i) => {
    console.log(`Abnormality ${i}:`);
    console.log(`  Type: "${abn.type}"`);
    console.log(`  Chromosome: "${abn.chromosome}"`);
    console.log(`  Breakpoints:`, JSON.stringify(abn.breakpoints, null, 2));
    console.log(`  Raw: "${abn.raw}"`);
  });
} else {
  console.log("Parse failed:", result.errors);
}
