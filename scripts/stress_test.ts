import { validateKaryotypeNative } from "../packages/core/src/index.ts";

const STRESS_TESTS = [
  // Normal
  "46,XX",
  "46,XY",
  // Numerical
  "45,X",
  "47,XX,+21",
  "48,XXY,+18",
  // Structural - Translocations
  "46,XX,t(9;22)(q34;q11.2)",
  "46,XY,t(1;19)(q23;p13.3)",
  // Structural - Deletions/Duplications
  "46,XX,del(5)(p15)",
  "46,XY,dup(1)(q21q32)",
  "46,XX,inv(16)(p13q22)",
  // Multiple Abnormalities
  "47,XX,t(9;22)(q34;q11.2),+21",
  // Mosaicism
  "45,X[10]/46,XX[20]",
  "46,XY[15]/47,XY,+8[5]",
  // Complex/Cancer (Standard)
  "46,XY,t(15;17)(q24.1;q21.2)",
  "46,XX,del(7)(q22q36)",
  // Edge Cases
  "46,XX,mar",
  "46,XY,add(19)(p13.3)"
];

console.log("🚀 Running Karyotype Stress Test Suite...\n");

let passed = 0;
for (const k of STRESS_TESTS) {
  const result = validateKaryotypeNative(k);
  if (result.valid) {
    console.log(`✅ [PASS] ${k.padEnd(30)} | Chrs: ${result.parsed?.chromosome_count} | Abns: ${result.parsed?.abnormalities.length}`);
    passed++;
  } else {
    console.log(`❌ [FAIL] ${k.padEnd(30)} | Errors: ${result.errors.join(", ")}`);
  }
}

console.log(`\n📊 Summary: ${passed}/${STRESS_TESTS.length} tests passed.`);
