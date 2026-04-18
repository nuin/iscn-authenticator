/**
 * Main ISCN karyotype validation module (TypeScript native).
 *
 * This module provides pure TypeScript validation without needing Python.
 * Use this for Deno Deploy or when you don't have Python available.
 */

import type { ValidationResult } from "./types.ts";
import { KaryotypeParser, ParseError } from "./parser.ts";
import { RuleEngine } from "./engine.ts";
import { ALL_CHROMOSOME_RULES } from "./rules/chromosome.ts";
import { ALL_ABNORMALITY_RULES } from "./rules/abnormality.ts";

// Initialize parser and engine
const parser = new KaryotypeParser();
const engine = new RuleEngine();
engine.addRules(ALL_CHROMOSOME_RULES);
engine.addAbnormalityRules(ALL_ABNORMALITY_RULES);

/**
 * Validate an ISCN karyotype string using pure TypeScript.
 *
 * @param karyotype - The karyotype string to validate (e.g., "46,XX")
 * @returns ValidationResult with valid flag, errors, and parsed AST
 */
export function validateKaryotypeNative(karyotype: string): ValidationResult {
  try {
    const ast = parser.parse(karyotype);
    return engine.validate(ast);
  } catch (e) {
    if (e instanceof ParseError) {
      return {
        valid: false,
        errors: [e.message],
        parsed: null,
      };
    }
    return {
      valid: false,
      errors: [e instanceof Error ? e.message : String(e)],
      parsed: null,
    };
  }
}

/**
 * Simple boolean validation check.
 *
 * @param karyotype - The karyotype string to validate
 * @returns true if valid, false otherwise
 */
export function isValidKaryotypeNative(karyotype: string): boolean {
  return validateKaryotypeNative(karyotype).valid;
}

// Re-export for convenience
export { ParseError } from "./parser.ts";
export { KaryotypeParser } from "./parser.ts";
export { RuleEngine } from "./engine.ts";
export { ALL_CHROMOSOME_RULES } from "./rules/chromosome.ts";
export { ALL_ABNORMALITY_RULES } from "./rules/abnormality.ts";
