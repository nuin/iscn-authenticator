import { validateKaryotypeNative, explain, mapBandToRange } from "../packages/core/src/index.ts";

const testCases = [
  "46,XX",
  "47,XY,+21",
  "46,XX,t(9;22)(q34;q11.2)",
  "46,XX,del(5)(q13q33)",
  "invalid-karyotype"
];

console.log("--- Karyotype Logic Tests ---");

for (const k of testCases) {
  try {
    const result = validateKaryotypeNative(k);
    const explanation = result.parsed ? explain(result.parsed) : null;
    
    console.log(`\nInput: ${k}`);
    console.log(`Valid: ${result.valid}`);
    if (explanation) {
      console.log(`Summary: ${explanation.summary}`);
      console.log(`Confidence: ${explanation.confidence}`);
    }
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join("; ")}`);
    }
    
    // Test Ideogram mapping for a structural case
    if (k === "46,XX,del(5)(q13q33)") {
      const range1 = mapBandToRange("5", "q13");
      const range2 = mapBandToRange("5", "q33");
      console.log(`Ideogram Mapping (Chr 5): q13 -> ${range1?.start}-${range1?.end}, q33 -> ${range2?.start}-${range2?.end}`);
    }
  } catch (err) {
    console.log(`System Error for ${k}: ${err.message}`);
  }
}
