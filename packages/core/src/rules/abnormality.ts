/**
 * Validation rules for karyotype abnormalities.
 * Port of iscn_authenticator/rules/abnormality.py to TypeScript.
 */

import { structuralReferenceRule, misplacedCloneRule } from "./routine.js";
import { validateDerivativeComponents } from "./derivative.js";
import type { Abnormality, Rule } from "../types.js";
import {
  abnormalityRule,
  breakpointArms,
  breakpointCount,
  chromosomeBreakpointCount,
} from "./abnormality-checks.js";

// Valid autosome numbers (1-22) and sex chromosomes (X, Y)
const VALID_CHROMOSOMES = new Set([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "X",
  "Y",
]);

function validateNumericalChromosome(abn: Abnormality): string[] {
  if (!["+", "-", "+c", "-c"].includes(abn.type)) {
    return [];
  }
  if (!VALID_CHROMOSOMES.has(abn.chromosome)) {
    return [
      `Invalid chromosome '${abn.chromosome}' in ${abn.raw}. Must be 1-22, X, or Y`,
    ];
  }
  return [];
}

function validateBreakpointArm(abn: Abnormality): string[] {
  if (abn.type === "+" || abn.type === "-" || abn.type === "unknown") {
    return [];
  }
  const errors: string[] = [];
  for (const bp of abn.breakpoints) {
    if (bp.arm !== "p" && bp.arm !== "q") {
      errors.push(
        `Invalid breakpoint arm '${bp.arm}' in ${abn.raw}. Must be 'p' or 'q'`,
      );
    }
  }
  return errors;
}

export const numericalChromosomeValidRule: Rule = abnormalityRule(
  "ABN_NUM_CHR_VALID",
  "Numerical abnormality chromosome must be 1-22, X, or Y",
  validateNumericalChromosome,
);

export const breakpointArmValidRule: Rule = abnormalityRule(
  "ABN_BP_ARM_VALID",
  "Breakpoint arm must be 'p' or 'q'",
  validateBreakpointArm,
);

export const inversionTwoBreakpointsRule: Rule = abnormalityRule(
  "ABN_INV_TWO_BP",
  "Inversion must have exactly two breakpoints",
  breakpointCount("inv", [2], "Inversion requires two breakpoints"),
);

export const translocationBreakpointCountRule: Rule = abnormalityRule(
  "ABN_TRANS_BP_COUNT",
  "Translocation breakpoint count must match chromosome count",
  chromosomeBreakpointCount("t", "Translocation"),
);

export const deletionBreakpointRule: Rule = abnormalityRule(
  "ABN_DEL_BP",
  "Deletion must have 1-2 breakpoints, interstitial requires same arm",
  breakpointArms(
    "del",
    [1, 2],
    "Deletion requires one or two breakpoints",
    "Interstitial deletion",
    true,
  ),
);

export const duplicationBreakpointRule: Rule = abnormalityRule(
  "ABN_DUP_BP",
  "Duplication must have 1-2 breakpoints, interstitial requires same arm",
  breakpointArms(
    "dup",
    [1, 2],
    "Duplication requires one or two breakpoints",
    "Duplication",
    true,
  ),
);

export const ringChromosomeBreakpointRule: Rule = abnormalityRule(
  "ABN_RING_BP",
  "Ring chromosome must have 2 breakpoints on different arms",
  breakpointArms(
    "r",
    [2],
    "Ring chromosome requires two breakpoints",
    "Ring chromosome",
    false,
  ),
);

export const isochromosomeBreakpointRule: Rule = abnormalityRule(
  "ABN_ISO_BP",
  "Isochromosome must have exactly 1 breakpoint",
  breakpointCount("i", [1], "Isochromosome requires one breakpoint"),
);

export const triplicationBreakpointRule: Rule = abnormalityRule(
  "ABN_TRP_BP",
  "Triplication must have 2 breakpoints on same arm",
  breakpointArms(
    "trp",
    [2],
    "Triplication requires two breakpoints",
    "Triplication",
    true,
  ),
);

export const quadruplicationBreakpointRule: Rule = abnormalityRule(
  "ABN_QDP_BP",
  "Quadruplication must have 2 breakpoints on same arm",
  breakpointArms(
    "qdp",
    [2],
    "Quadruplication requires two breakpoints",
    "Quadruplication",
    true,
  ),
);

export const dicentricBreakpointRule: Rule = abnormalityRule(
  "ABN_DIC_BP",
  "Dicentric breakpoint count must match chromosome count",
  chromosomeBreakpointCount("dic", "Dicentric"),
);

export const isodicentricBreakpointRule: Rule = abnormalityRule(
  "ABN_IDIC_BP",
  "Isodicentric must have exactly 1 breakpoint",
  breakpointCount("idic", [1], "Isodicentric requires one breakpoint"),
);

export const robertsonianBreakpointRule: Rule = abnormalityRule(
  "ABN_ROB_BP",
  "Robertsonian translocation breakpoint count must match chromosome count",
  chromosomeBreakpointCount("rob", "Robertsonian translocation"),
);

export const addBreakpointRule: Rule = abnormalityRule(
  "ABN_ADD_BP",
  "Add (additional material) must have exactly 1 breakpoint",
  breakpointCount("add", [1], "Add requires one breakpoint"),
);

export const fraBreakpointRule: Rule = abnormalityRule(
  "ABN_FRA_BP",
  "Fragile site must have exactly 1 breakpoint",
  breakpointCount("fra", [1], "Fragile site requires one breakpoint"),
);

export const insBreakpointRule: Rule = abnormalityRule(
  "ABN_INS_BP",
  "Insertion must have exactly 3 breakpoints",
  breakpointCount("ins", [3], "Insertion requires three breakpoints"),
);

export const dminBreakpointRule: Rule = abnormalityRule(
  "ABN_DMIN_BP",
  "Double minutes must have no breakpoints",
  breakpointCount("dmin", [0], "Double minutes should have no breakpoints"),
);

export const hsrBreakpointRule: Rule = abnormalityRule(
  "ABN_HSR_BP",
  "HSR must have 0 or 1 breakpoint",
  breakpointCount("hsr", [0, 1], "HSR should have zero or one breakpoint"),
);

export const marBreakpointRule: Rule = abnormalityRule(
  "ABN_MAR_BP",
  "Marker chromosome must have no breakpoints",
  breakpointCount("mar", [0], "Marker chromosome should have no breakpoints"),
);

export const pseudodicentricBreakpointRule: Rule = abnormalityRule(
  "ABN_PSU_DIC_BP",
  "Pseudodicentric breakpoint count must match chromosome count",
  chromosomeBreakpointCount("psu dic", "Pseudodicentric"),
);

export const acentricBreakpointRule: Rule = abnormalityRule(
  "ABN_ACE_BP",
  "Acentric fragment must have 1-2 breakpoints",
  breakpointCount("ace", [1, 2], "Acentric fragment requires 1-2 breakpoints"),
);

export const telomericAssociationBreakpointRule: Rule = abnormalityRule(
  "ABN_TAS_BP",
  "Telomeric association breakpoint count must match chromosome count",
  chromosomeBreakpointCount("tas", "Telomeric association"),
);

export const fissionBreakpointRule: Rule = abnormalityRule(
  "ABN_FIS_BP",
  "Fission must have exactly 1 breakpoint",
  breakpointCount("fis", [1], "Fission requires one breakpoint"),
);

export const neocentromereBreakpointRule: Rule = abnormalityRule(
  "ABN_NEO_BP",
  "Neocentromere must have exactly 1 breakpoint",
  breakpointCount("neo", [1], "Neocentromere requires one breakpoint"),
);

export const incompleteBreakpointRule: Rule = abnormalityRule(
  "ABN_INC_BP",
  "Incomplete karyotype marker must have no breakpoints",
  breakpointCount(
    "inc",
    [0],
    "Incomplete karyotype marker should have no breakpoints",
  ),
);

export const ALL_ABNORMALITY_RULES: Rule[] = [
  numericalChromosomeValidRule,
  structuralReferenceRule,
  misplacedCloneRule,
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
  {
    id: "ABN_DER_COMPONENTS", category: "abnormality",
    description: "Check recognizable derivative components without reconstructing the chromosome path",
    validate: (ast, target) => validateDerivativeComponents(ast, target as Abnormality, ALL_ABNORMALITY_RULES),
  },
];
