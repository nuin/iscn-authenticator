import type { ExplainResult, KaryotypeNode } from "../types.js";
import { lookupCuratedExplanation, generateSignature } from "./curated.js";
import { generateTemplateExplanation } from "./template.js";

/**
 * Options for the explain function.
 */
export interface ExplainOptions {
  /** Callback triggered when a curated explanation is not found. */
  onMiss?: (signature: string) => void;
}

/**
 * Explains a Karyotype AST node in human-readable terms.
 *
 * First attempts to find a curated explanation based on the node's
 * canonical signature. If no curated entry exists, falls back to
 * a deterministic template-based description.
 *
 * @param node - The KaryotypeAST or Abnormality to explain.
 * @param options - Optional configuration for the explanation process.
 * @returns An ExplainResult containing summary, detail, and citations.
 */
export function explain(node: KaryotypeNode, options?: ExplainOptions): ExplainResult {
  // 1. Try curated library first
  const curated = lookupCuratedExplanation(node);
  if (curated) {
    return curated;
  }

  // 2. Report miss if requested
  if (options?.onMiss) {
    options.onMiss(generateSignature(node));
  }

  // 3. Fallback to template generator
  return generateTemplateExplanation(node);
}
