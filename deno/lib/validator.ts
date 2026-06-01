/**
 * Karyotype validation module.
 *
 * Re-exports the native TypeScript validator from `@iscn/core` as the
 * primary public surface, plus a small `isValidKaryotype` convenience
 * wrapper that returns just the boolean verdict.
 */

import { validateKaryotypeNative } from "../../packages/core/src/validate.ts";

export { validateKaryotypeNative } from "../../packages/core/src/validate.ts";
export type { ValidationResult } from "../../packages/core/src/types.ts";

/**
 * Simple boolean validation check.
 *
 * @param karyotype - The karyotype string to validate
 * @returns true if valid, false otherwise
 */
export function isValidKaryotype(karyotype: string): boolean {
  return validateKaryotypeNative(karyotype).valid;
}
