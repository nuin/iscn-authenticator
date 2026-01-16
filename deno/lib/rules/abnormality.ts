/**
 * Validation rules for karyotype abnormalities.
 * Port of iscn_authenticator/rules/abnormality.py to TypeScript.
 */

import type { KaryotypeAST, Abnormality, Rule } from "../types.ts";

// Valid autosome numbers (1-22) and sex chromosomes (X, Y)
const VALID_CHROMOSOMES = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "X", "Y",
]);

function validateNumericalChromosome(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "+" && abn.type !== "-") {
    return [];
  }
  if (!VALID_CHROMOSOMES.has(abn.chromosome)) {
    return [`Invalid chromosome '${abn.chromosome}' in ${abn.raw}. Must be 1-22, X, or Y`];
  }
  return [];
}

function validateBreakpointArm(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type === "+" || abn.type === "-" || abn.type === "unknown") {
    return [];
  }
  const errors: string[] = [];
  for (const bp of abn.breakpoints) {
    if (bp.arm !== "p" && bp.arm !== "q") {
      errors.push(`Invalid breakpoint arm '${bp.arm}' in ${abn.raw}. Must be 'p' or 'q'`);
    }
  }
  return errors;
}

function validateInversionTwoBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "inv") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 2) {
    return [`Inversion requires two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateTranslocationBreakpointCount(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "t") return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Translocation has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}

function validateDeletionBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "del") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1 && bpCount !== 2) {
    return [`Deletion requires one or two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  if (bpCount === 2) {
    const arm1 = abn.breakpoints[0].arm;
    const arm2 = abn.breakpoints[1].arm;
    if (arm1 !== arm2) {
      return [`Interstitial deletion breakpoints must be on same arm, found ${arm1} and ${arm2} in ${abn.raw}`];
    }
  }
  return [];
}

function validateDuplicationBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "dup") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1 && bpCount !== 2) {
    return [`Duplication requires one or two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  if (bpCount === 2) {
    const arm1 = abn.breakpoints[0].arm;
    const arm2 = abn.breakpoints[1].arm;
    if (arm1 !== arm2) {
      return [`Duplication breakpoints must be on same arm, found ${arm1} and ${arm2} in ${abn.raw}`];
    }
  }
  return [];
}

function validateRingChromosomeBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "r") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 2) {
    return [`Ring chromosome requires two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  const arm1 = abn.breakpoints[0].arm;
  const arm2 = abn.breakpoints[1].arm;
  if (arm1 === arm2) {
    return [`Ring chromosome breakpoints must be on different arms, found ${arm1} and ${arm2} in ${abn.raw}`];
  }
  return [];
}

function validateIsochromosomeBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "i") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Isochromosome requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateTriplicationBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "trp") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 2) {
    return [`Triplication requires two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  const arm1 = abn.breakpoints[0].arm;
  const arm2 = abn.breakpoints[1].arm;
  if (arm1 !== arm2) {
    return [`Triplication breakpoints must be on same arm, found ${arm1} and ${arm2} in ${abn.raw}`];
  }
  return [];
}

function validateQuadruplicationBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "qdp") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 2) {
    return [`Quadruplication requires two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  const arm1 = abn.breakpoints[0].arm;
  const arm2 = abn.breakpoints[1].arm;
  if (arm1 !== arm2) {
    return [`Quadruplication breakpoints must be on same arm, found ${arm1} and ${arm2} in ${abn.raw}`];
  }
  return [];
}

function validateDicentricBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "dic") return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Dicentric has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}

function validateIsodicentricBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "idic") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Isodicentric requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateRobertsonianBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "rob") return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Robertsonian translocation has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}

function validateAddBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "add") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Add requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateFraBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "fra") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Fragile site requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateInsBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "ins") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 3) {
    return [`Insertion requires three breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateDminBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "dmin") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Double minutes should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateHsrBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "hsr") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount > 1) {
    return [`HSR should have zero or one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateMarBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "mar") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Marker chromosome should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validatePseudodicentricBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "psu dic") return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Pseudodicentric has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}

function validateAcentricBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "ace") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1 && bpCount !== 2) {
    return [`Acentric fragment requires 1-2 breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateTelomericAssociationBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "tas") return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Telomeric association has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}

function validateFissionBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "fis") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Fission requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateNeocentromereBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "neo") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Neocentromere requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

function validateIncompleteBreakpoints(_ast: KaryotypeAST, abn: Abnormality): string[] {
  if (abn.type !== "inc") return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Incomplete karyotype marker should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}

// Rule instances
export const numericalChromosomeValidRule: Rule = {
  id: "ABN_NUM_CHR_VALID",
  category: "abnormality",
  description: "Numerical abnormality chromosome must be 1-22, X, or Y",
  validate: (ast, target) => validateNumericalChromosome(ast, target as Abnormality),
};

export const breakpointArmValidRule: Rule = {
  id: "ABN_BP_ARM_VALID",
  category: "abnormality",
  description: "Breakpoint arm must be 'p' or 'q'",
  validate: (ast, target) => validateBreakpointArm(ast, target as Abnormality),
};

export const inversionTwoBreakpointsRule: Rule = {
  id: "ABN_INV_TWO_BP",
  category: "abnormality",
  description: "Inversion must have exactly two breakpoints",
  validate: (ast, target) => validateInversionTwoBreakpoints(ast, target as Abnormality),
};

export const translocationBreakpointCountRule: Rule = {
  id: "ABN_TRANS_BP_COUNT",
  category: "abnormality",
  description: "Translocation breakpoint count must match chromosome count",
  validate: (ast, target) => validateTranslocationBreakpointCount(ast, target as Abnormality),
};

export const deletionBreakpointRule: Rule = {
  id: "ABN_DEL_BP",
  category: "abnormality",
  description: "Deletion must have 1-2 breakpoints, interstitial requires same arm",
  validate: (ast, target) => validateDeletionBreakpoints(ast, target as Abnormality),
};

export const duplicationBreakpointRule: Rule = {
  id: "ABN_DUP_BP",
  category: "abnormality",
  description: "Duplication must have 1-2 breakpoints, interstitial requires same arm",
  validate: (ast, target) => validateDuplicationBreakpoints(ast, target as Abnormality),
};

export const ringChromosomeBreakpointRule: Rule = {
  id: "ABN_RING_BP",
  category: "abnormality",
  description: "Ring chromosome must have 2 breakpoints on different arms",
  validate: (ast, target) => validateRingChromosomeBreakpoints(ast, target as Abnormality),
};

export const isochromosomeBreakpointRule: Rule = {
  id: "ABN_ISO_BP",
  category: "abnormality",
  description: "Isochromosome must have exactly 1 breakpoint",
  validate: (ast, target) => validateIsochromosomeBreakpoints(ast, target as Abnormality),
};

export const triplicationBreakpointRule: Rule = {
  id: "ABN_TRP_BP",
  category: "abnormality",
  description: "Triplication must have 2 breakpoints on same arm",
  validate: (ast, target) => validateTriplicationBreakpoints(ast, target as Abnormality),
};

export const quadruplicationBreakpointRule: Rule = {
  id: "ABN_QDP_BP",
  category: "abnormality",
  description: "Quadruplication must have 2 breakpoints on same arm",
  validate: (ast, target) => validateQuadruplicationBreakpoints(ast, target as Abnormality),
};

export const dicentricBreakpointRule: Rule = {
  id: "ABN_DIC_BP",
  category: "abnormality",
  description: "Dicentric breakpoint count must match chromosome count",
  validate: (ast, target) => validateDicentricBreakpoints(ast, target as Abnormality),
};

export const isodicentricBreakpointRule: Rule = {
  id: "ABN_IDIC_BP",
  category: "abnormality",
  description: "Isodicentric must have exactly 1 breakpoint",
  validate: (ast, target) => validateIsodicentricBreakpoints(ast, target as Abnormality),
};

export const robertsonianBreakpointRule: Rule = {
  id: "ABN_ROB_BP",
  category: "abnormality",
  description: "Robertsonian translocation breakpoint count must match chromosome count",
  validate: (ast, target) => validateRobertsonianBreakpoints(ast, target as Abnormality),
};

export const addBreakpointRule: Rule = {
  id: "ABN_ADD_BP",
  category: "abnormality",
  description: "Add (additional material) must have exactly 1 breakpoint",
  validate: (ast, target) => validateAddBreakpoints(ast, target as Abnormality),
};

export const fraBreakpointRule: Rule = {
  id: "ABN_FRA_BP",
  category: "abnormality",
  description: "Fragile site must have exactly 1 breakpoint",
  validate: (ast, target) => validateFraBreakpoints(ast, target as Abnormality),
};

export const insBreakpointRule: Rule = {
  id: "ABN_INS_BP",
  category: "abnormality",
  description: "Insertion must have exactly 3 breakpoints",
  validate: (ast, target) => validateInsBreakpoints(ast, target as Abnormality),
};

export const dminBreakpointRule: Rule = {
  id: "ABN_DMIN_BP",
  category: "abnormality",
  description: "Double minutes must have no breakpoints",
  validate: (ast, target) => validateDminBreakpoints(ast, target as Abnormality),
};

export const hsrBreakpointRule: Rule = {
  id: "ABN_HSR_BP",
  category: "abnormality",
  description: "HSR must have 0 or 1 breakpoint",
  validate: (ast, target) => validateHsrBreakpoints(ast, target as Abnormality),
};

export const marBreakpointRule: Rule = {
  id: "ABN_MAR_BP",
  category: "abnormality",
  description: "Marker chromosome must have no breakpoints",
  validate: (ast, target) => validateMarBreakpoints(ast, target as Abnormality),
};

export const pseudodicentricBreakpointRule: Rule = {
  id: "ABN_PSU_DIC_BP",
  category: "abnormality",
  description: "Pseudodicentric breakpoint count must match chromosome count",
  validate: (ast, target) => validatePseudodicentricBreakpoints(ast, target as Abnormality),
};

export const acentricBreakpointRule: Rule = {
  id: "ABN_ACE_BP",
  category: "abnormality",
  description: "Acentric fragment must have 1-2 breakpoints",
  validate: (ast, target) => validateAcentricBreakpoints(ast, target as Abnormality),
};

export const telomericAssociationBreakpointRule: Rule = {
  id: "ABN_TAS_BP",
  category: "abnormality",
  description: "Telomeric association breakpoint count must match chromosome count",
  validate: (ast, target) => validateTelomericAssociationBreakpoints(ast, target as Abnormality),
};

export const fissionBreakpointRule: Rule = {
  id: "ABN_FIS_BP",
  category: "abnormality",
  description: "Fission must have exactly 1 breakpoint",
  validate: (ast, target) => validateFissionBreakpoints(ast, target as Abnormality),
};

export const neocentromereBreakpointRule: Rule = {
  id: "ABN_NEO_BP",
  category: "abnormality",
  description: "Neocentromere must have exactly 1 breakpoint",
  validate: (ast, target) => validateNeocentromereBreakpoints(ast, target as Abnormality),
};

export const incompleteBreakpointRule: Rule = {
  id: "ABN_INC_BP",
  category: "abnormality",
  description: "Incomplete karyotype marker must have no breakpoints",
  validate: (ast, target) => validateIncompleteBreakpoints(ast, target as Abnormality),
};

// Export all rules
export const ALL_ABNORMALITY_RULES: Rule[] = [
  numericalChromosomeValidRule,
  breakpointArmValidRule,
  inversionTwoBreakpointsRule,
  translocationBreakpointCountRule,
  deletionBreakpointRule,
  duplicationBreakpointRule,
  ringChromosomeBreakpointRule,
  isochromosomeBreakpointRule,
  triplicationBreakpointRule,
  quadruplicationBreakpointRule,
  dicentricBreakpointRule,
  isodicentricBreakpointRule,
  robertsonianBreakpointRule,
  addBreakpointRule,
  fraBreakpointRule,
  insBreakpointRule,
  dminBreakpointRule,
  hsrBreakpointRule,
  marBreakpointRule,
  pseudodicentricBreakpointRule,
  acentricBreakpointRule,
  telomericAssociationBreakpointRule,
  fissionBreakpointRule,
  neocentromereBreakpointRule,
  incompleteBreakpointRule,
];
