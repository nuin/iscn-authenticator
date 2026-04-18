/**
 * @iscn/core — ISCN 2024 karyotype validation
 *
 * Public API. Consumers should import from here, not from deep paths.
 */

// Validation entry points
export {
  validateKaryotypeNative,
  isValidKaryotypeNative,
} from "./validate.ts";

// AST + result types
export type {
  Abnormality,
  Breakpoint,
  CellLine,
  KaryotypeAST,
  Modifiers,
  Rule,
  ValidationResult,
} from "./types.ts";

// Parser + engine (advanced / tool consumers)
export { KaryotypeParser, ParseError } from "./parser.ts";
export { RuleEngine } from "./engine.ts";

// Rule sets (consumers building custom rule stacks)
export { ALL_CHROMOSOME_RULES } from "./rules/chromosome.ts";
export { ALL_ABNORMALITY_RULES } from "./rules/abnormality.ts";
