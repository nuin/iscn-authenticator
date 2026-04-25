/**
 * @iscn/core — ISCN 2024 karyotype validation
 *
 * Public API. Consumers should import from here, not from deep paths.
 */

// Validation entry points
export {
  validateKaryotypeNative,
  isValidKaryotypeNative,
} from "./validate.js";

// AST + result types
export type {
  Abnormality,
  Breakpoint,
  CellLine,
  KaryotypeAST,
  Modifiers,
  Rule,
  ValidationResult,
} from "./types.js";

// Parser + engine (advanced / tool consumers)
export { KaryotypeParser, ParseError } from "./parser.js";
export { RuleEngine } from "./engine.js";

// Explain module
export { explain } from "./explain/index.js";

// Ideogram data + helpers
export {
  getChromosomeBands,
  mapBandToRange,
  getAvailableChromosomes,
} from "./ideogram.js";
export type { Band, ChromosomeBands } from "./ideogram.js";

// Rule sets (consumers building custom rule stacks)
export { ALL_CHROMOSOME_RULES } from "./rules/chromosome.js";
export { ALL_ABNORMALITY_RULES } from "./rules/abnormality.js";
