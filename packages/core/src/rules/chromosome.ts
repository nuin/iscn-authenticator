/**
 * Validation rules for chromosome count and sex chromosomes.
 * Port of iscn_authenticator/rules/chromosome.py to TypeScript.
 */

import type { KaryotypeAST, Rule } from "../types.ts";

function validateChromosomeCountNumeric(ast: KaryotypeAST): string[] {
  // Skip validation for FISH-only results (nuc ish)
  if (ast.chromosome_count === null) {
    return [];
  }
  if (typeof ast.chromosome_count === "string") {
    // Range notation like "45~48" is valid
    if (ast.chromosome_count.includes("~")) {
      return [];
    }
    return [`Chromosome count '${ast.chromosome_count}' is not numeric`];
  }
  return [];
}

function validateChromosomeCountRange(ast: KaryotypeAST): string[] {
  const count = ast.chromosome_count;
  // Skip validation for FISH-only results (nuc ish)
  if (count === null) {
    return [];
  }
  if (typeof count === "string") {
    // Skip range validation for range notation
    return [];
  }
  if (count < 23 || count > 92) {
    return [`Chromosome count ${count} is outside valid range (must be between 23 and 92)`];
  }
  return [];
}

function validateSexChromosomesValid(ast: KaryotypeAST): string[] {
  const sex = ast.sex_chromosomes;
  // Skip validation for FISH-only results (nuc ish)
  if (ast.chromosome_count === null || sex === "") {
    return [];
  }
  if (sex === "U") {
    // Undisclosed
    return [];
  }
  if (!sex.includes("X")) {
    return [`Sex chromosomes '${sex}' must contain at least one X chromosome`];
  }
  return [];
}

function validateSexChromosomesCoherence(ast: KaryotypeAST): string[] {
  const count = ast.chromosome_count;
  const sex = ast.sex_chromosomes;

  // Skip validation for FISH-only results (nuc ish)
  if (count === null || sex === "") {
    return [];
  }

  if (typeof count === "string" || sex === "U") {
    // Skip coherence check for ranges or undisclosed
    return [];
  }

  const sexCount = sex.length;

  // Basic coherence check for common karyotypes without listed abnormalities.
  if (!ast.abnormalities || ast.abnormalities.length === 0) {
    if (count === 46 && sexCount !== 2) {
      return [
        `Chromosome count 46 requires 2 sex chromosomes, but found ${sexCount} ('${sex}')`,
      ];
    }
    if (count === 45 && sexCount !== 1) {
      return [
        `Chromosome count 45 requires 1 sex chromosome, but found ${sexCount} ('${sex}')`,
      ];
    }
  }

  return [];
}

// Rule instances
export const chromosomeCountNumericRule: Rule = {
  id: "CHR_COUNT_NUMERIC",
  category: "chromosome_count",
  description: "Chromosome count must be numeric or valid range notation",
  validate: (ast) => validateChromosomeCountNumeric(ast),
};

export const chromosomeCountRangeRule: Rule = {
  id: "CHR_COUNT_RANGE",
  category: "chromosome_count",
  description: "Chromosome count must be between 23 and 92",
  validate: (ast) => validateChromosomeCountRange(ast),
};

export const sexChromosomesValidRule: Rule = {
  id: "SEX_CHR_VALID",
  category: "sex_chromosomes",
  description: "Sex chromosomes must contain at least one X",
  validate: (ast) => validateSexChromosomesValid(ast),
};

export const sexChromosomesCoherenceRule: Rule = {
  id: "SEX_CHR_COHERENCE",
  category: "coherence",
  description: "Chromosome count must be coherent with sex chromosome count",
  validate: (ast) => validateSexChromosomesCoherence(ast),
};

// Export all rules
export const ALL_CHROMOSOME_RULES: Rule[] = [
  chromosomeCountNumericRule,
  chromosomeCountRangeRule,
  sexChromosomesValidRule,
  sexChromosomesCoherenceRule,
];
