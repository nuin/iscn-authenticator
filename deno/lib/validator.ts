/**
 * Karyotype validation module.
 * Uses the native TypeScript validator from @iscn/core source.
 */

import type { ValidationResult } from "../../packages/core/src/types.ts";
import { validateKaryotypeNative } from "../../packages/core/src/validate.ts";

/**
 * Validate a karyotype string.
 *
 * @param karyotype - The karyotype string to validate (e.g., "46,XX")
 * @returns ValidationResult with valid flag, errors, and parsed AST
 */
export async function validateKaryotype(karyotype: string): Promise<ValidationResult> {
  return validateKaryotypeNative(karyotype);
}

/**
 * Simple boolean validation check.
 *
 * @param karyotype - The karyotype string to validate
 * @returns true if valid, false otherwise
 */
export async function isValidKaryotype(karyotype: string): Promise<boolean> {
  const result = await validateKaryotype(karyotype);
  return result.valid;
}
