class RuleEngine {
  rules = [];
  abnormalityRules = [];
  addRule(rule) {
    this.rules.push(rule);
  }
  addRules(rules) {
    this.rules.push(...rules);
  }
  addAbnormalityRule(rule) {
    this.abnormalityRules.push(rule);
  }
  addAbnormalityRules(rules) {
    this.abnormalityRules.push(...rules);
  }
  validate(ast) {
    const allErrors = [];
    for (const rule of this.rules) {
      const errors = rule.validate(ast, ast);
      allErrors.push(...errors);
    }
    for (const abnormality of ast.abnormalities) {
      for (const rule of this.abnormalityRules) {
        const errors = rule.validate(ast, abnormality);
        allErrors.push(...errors);
      }
    }
    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      parsed: ast
    };
  }
}
function validateChromosomeCountNumeric(ast) {
  if (ast.chromosome_count === null) {
    return [];
  }
  if (typeof ast.chromosome_count === "string") {
    if (ast.chromosome_count.includes("~")) {
      return [];
    }
    return [`Chromosome count '${ast.chromosome_count}' is not numeric`];
  }
  return [];
}
function validateChromosomeCountRange(ast) {
  const count = ast.chromosome_count;
  if (count === null) {
    return [];
  }
  if (typeof count === "string") {
    return [];
  }
  if (count < 23 || count > 92) {
    return [`Chromosome count ${count} is outside valid range (must be between 23 and 92)`];
  }
  return [];
}
function validateSexChromosomesValid(ast) {
  const sex = ast.sex_chromosomes;
  if (ast.chromosome_count === null || sex === "") {
    return [];
  }
  if (sex === "U") {
    return [];
  }
  if (!sex.includes("X")) {
    return [`Sex chromosomes '${sex}' must contain at least one X chromosome`];
  }
  return [];
}
function validateSexChromosomesCoherence(ast) {
  const count = ast.chromosome_count;
  const sex = ast.sex_chromosomes;
  if (count === null || sex === "") {
    return [];
  }
  if (typeof count === "string" || sex === "U") {
    return [];
  }
  const sexCount = sex.length;
  if (!ast.abnormalities || ast.abnormalities.length === 0) {
    if (count === 46 && sexCount !== 2) {
      return [
        `Chromosome count 46 requires 2 sex chromosomes, but found ${sexCount} ('${sex}')`
      ];
    }
    if (count === 45 && sexCount !== 1) {
      return [
        `Chromosome count 45 requires 1 sex chromosome, but found ${sexCount} ('${sex}')`
      ];
    }
  }
  return [];
}
const chromosomeCountNumericRule = {
  id: "CHR_COUNT_NUMERIC",
  category: "chromosome_count",
  description: "Chromosome count must be numeric or valid range notation",
  validate: (ast) => validateChromosomeCountNumeric(ast)
};
const chromosomeCountRangeRule = {
  id: "CHR_COUNT_RANGE",
  category: "chromosome_count",
  description: "Chromosome count must be between 23 and 92",
  validate: (ast) => validateChromosomeCountRange(ast)
};
const sexChromosomesValidRule = {
  id: "SEX_CHR_VALID",
  category: "sex_chromosomes",
  description: "Sex chromosomes must contain at least one X",
  validate: (ast) => validateSexChromosomesValid(ast)
};
const sexChromosomesCoherenceRule = {
  id: "SEX_CHR_COHERENCE",
  category: "coherence",
  description: "Chromosome count must be coherent with sex chromosome count",
  validate: (ast) => validateSexChromosomesCoherence(ast)
};
const ALL_CHROMOSOME_RULES = [
  chromosomeCountNumericRule,
  chromosomeCountRangeRule,
  sexChromosomesValidRule,
  sexChromosomesCoherenceRule
];
const VALID_CHROMOSOMES = /* @__PURE__ */ new Set([
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
  "Y"
]);
function validateNumericalChromosome(_ast, abn) {
  if (abn.type !== "+" && abn.type !== "-") {
    return [];
  }
  if (!VALID_CHROMOSOMES.has(abn.chromosome)) {
    return [`Invalid chromosome '${abn.chromosome}' in ${abn.raw}. Must be 1-22, X, or Y`];
  }
  return [];
}
function validateBreakpointArm(_ast, abn) {
  if (abn.type === "+" || abn.type === "-" || abn.type === "unknown") {
    return [];
  }
  const errors = [];
  for (const bp of abn.breakpoints) {
    if (bp.arm !== "p" && bp.arm !== "q") {
      errors.push(`Invalid breakpoint arm '${bp.arm}' in ${abn.raw}. Must be 'p' or 'q'`);
    }
  }
  return errors;
}
function validateInversionTwoBreakpoints(_ast, abn) {
  if (abn.type !== "inv")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 2) {
    return [`Inversion requires two breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateTranslocationBreakpointCount(_ast, abn) {
  if (abn.type !== "t")
    return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Translocation has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}
function validateDeletionBreakpoints(_ast, abn) {
  if (abn.type !== "del")
    return [];
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
function validateDuplicationBreakpoints(_ast, abn) {
  if (abn.type !== "dup")
    return [];
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
function validateRingChromosomeBreakpoints(_ast, abn) {
  if (abn.type !== "r")
    return [];
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
function validateIsochromosomeBreakpoints(_ast, abn) {
  if (abn.type !== "i")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Isochromosome requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateTriplicationBreakpoints(_ast, abn) {
  if (abn.type !== "trp")
    return [];
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
function validateQuadruplicationBreakpoints(_ast, abn) {
  if (abn.type !== "qdp")
    return [];
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
function validateDicentricBreakpoints(_ast, abn) {
  if (abn.type !== "dic")
    return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Dicentric has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}
function validateIsodicentricBreakpoints(_ast, abn) {
  if (abn.type !== "idic")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Isodicentric requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateRobertsonianBreakpoints(_ast, abn) {
  if (abn.type !== "rob")
    return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Robertsonian translocation has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}
function validateAddBreakpoints(_ast, abn) {
  if (abn.type !== "add")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Add requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateFraBreakpoints(_ast, abn) {
  if (abn.type !== "fra")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Fragile site requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateInsBreakpoints(_ast, abn) {
  if (abn.type !== "ins")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 3) {
    return [`Insertion requires three breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateDminBreakpoints(_ast, abn) {
  if (abn.type !== "dmin")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Double minutes should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateHsrBreakpoints(_ast, abn) {
  if (abn.type !== "hsr")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount > 1) {
    return [`HSR should have zero or one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateMarBreakpoints(_ast, abn) {
  if (abn.type !== "mar")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Marker chromosome should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validatePseudodicentricBreakpoints(_ast, abn) {
  if (abn.type !== "psu dic")
    return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Pseudodicentric has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}
function validateAcentricBreakpoints(_ast, abn) {
  if (abn.type !== "ace")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1 && bpCount !== 2) {
    return [`Acentric fragment requires 1-2 breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateTelomericAssociationBreakpoints(_ast, abn) {
  if (abn.type !== "tas")
    return [];
  const chromosomes = abn.chromosome.split(";");
  const chrCount = chromosomes.length;
  const bpCount = abn.breakpoints.length;
  if (chrCount !== bpCount) {
    return [`Telomeric association has ${chrCount} chromosomes but ${bpCount} breakpoints in ${abn.raw}`];
  }
  return [];
}
function validateFissionBreakpoints(_ast, abn) {
  if (abn.type !== "fis")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Fission requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateNeocentromereBreakpoints(_ast, abn) {
  if (abn.type !== "neo")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 1) {
    return [`Neocentromere requires one breakpoint, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
function validateIncompleteBreakpoints(_ast, abn) {
  if (abn.type !== "inc")
    return [];
  const bpCount = abn.breakpoints.length;
  if (bpCount !== 0) {
    return [`Incomplete karyotype marker should have no breakpoints, found ${bpCount} in ${abn.raw}`];
  }
  return [];
}
const numericalChromosomeValidRule = {
  id: "ABN_NUM_CHR_VALID",
  category: "abnormality",
  description: "Numerical abnormality chromosome must be 1-22, X, or Y",
  validate: (ast, target) => validateNumericalChromosome(ast, target)
};
const breakpointArmValidRule = {
  id: "ABN_BP_ARM_VALID",
  category: "abnormality",
  description: "Breakpoint arm must be 'p' or 'q'",
  validate: (ast, target) => validateBreakpointArm(ast, target)
};
const inversionTwoBreakpointsRule = {
  id: "ABN_INV_TWO_BP",
  category: "abnormality",
  description: "Inversion must have exactly two breakpoints",
  validate: (ast, target) => validateInversionTwoBreakpoints(ast, target)
};
const translocationBreakpointCountRule = {
  id: "ABN_TRANS_BP_COUNT",
  category: "abnormality",
  description: "Translocation breakpoint count must match chromosome count",
  validate: (ast, target) => validateTranslocationBreakpointCount(ast, target)
};
const deletionBreakpointRule = {
  id: "ABN_DEL_BP",
  category: "abnormality",
  description: "Deletion must have 1-2 breakpoints, interstitial requires same arm",
  validate: (ast, target) => validateDeletionBreakpoints(ast, target)
};
const duplicationBreakpointRule = {
  id: "ABN_DUP_BP",
  category: "abnormality",
  description: "Duplication must have 1-2 breakpoints, interstitial requires same arm",
  validate: (ast, target) => validateDuplicationBreakpoints(ast, target)
};
const ringChromosomeBreakpointRule = {
  id: "ABN_RING_BP",
  category: "abnormality",
  description: "Ring chromosome must have 2 breakpoints on different arms",
  validate: (ast, target) => validateRingChromosomeBreakpoints(ast, target)
};
const isochromosomeBreakpointRule = {
  id: "ABN_ISO_BP",
  category: "abnormality",
  description: "Isochromosome must have exactly 1 breakpoint",
  validate: (ast, target) => validateIsochromosomeBreakpoints(ast, target)
};
const triplicationBreakpointRule = {
  id: "ABN_TRP_BP",
  category: "abnormality",
  description: "Triplication must have 2 breakpoints on same arm",
  validate: (ast, target) => validateTriplicationBreakpoints(ast, target)
};
const quadruplicationBreakpointRule = {
  id: "ABN_QDP_BP",
  category: "abnormality",
  description: "Quadruplication must have 2 breakpoints on same arm",
  validate: (ast, target) => validateQuadruplicationBreakpoints(ast, target)
};
const dicentricBreakpointRule = {
  id: "ABN_DIC_BP",
  category: "abnormality",
  description: "Dicentric breakpoint count must match chromosome count",
  validate: (ast, target) => validateDicentricBreakpoints(ast, target)
};
const isodicentricBreakpointRule = {
  id: "ABN_IDIC_BP",
  category: "abnormality",
  description: "Isodicentric must have exactly 1 breakpoint",
  validate: (ast, target) => validateIsodicentricBreakpoints(ast, target)
};
const robertsonianBreakpointRule = {
  id: "ABN_ROB_BP",
  category: "abnormality",
  description: "Robertsonian translocation breakpoint count must match chromosome count",
  validate: (ast, target) => validateRobertsonianBreakpoints(ast, target)
};
const addBreakpointRule = {
  id: "ABN_ADD_BP",
  category: "abnormality",
  description: "Add (additional material) must have exactly 1 breakpoint",
  validate: (ast, target) => validateAddBreakpoints(ast, target)
};
const fraBreakpointRule = {
  id: "ABN_FRA_BP",
  category: "abnormality",
  description: "Fragile site must have exactly 1 breakpoint",
  validate: (ast, target) => validateFraBreakpoints(ast, target)
};
const insBreakpointRule = {
  id: "ABN_INS_BP",
  category: "abnormality",
  description: "Insertion must have exactly 3 breakpoints",
  validate: (ast, target) => validateInsBreakpoints(ast, target)
};
const dminBreakpointRule = {
  id: "ABN_DMIN_BP",
  category: "abnormality",
  description: "Double minutes must have no breakpoints",
  validate: (ast, target) => validateDminBreakpoints(ast, target)
};
const hsrBreakpointRule = {
  id: "ABN_HSR_BP",
  category: "abnormality",
  description: "HSR must have 0 or 1 breakpoint",
  validate: (ast, target) => validateHsrBreakpoints(ast, target)
};
const marBreakpointRule = {
  id: "ABN_MAR_BP",
  category: "abnormality",
  description: "Marker chromosome must have no breakpoints",
  validate: (ast, target) => validateMarBreakpoints(ast, target)
};
const pseudodicentricBreakpointRule = {
  id: "ABN_PSU_DIC_BP",
  category: "abnormality",
  description: "Pseudodicentric breakpoint count must match chromosome count",
  validate: (ast, target) => validatePseudodicentricBreakpoints(ast, target)
};
const acentricBreakpointRule = {
  id: "ABN_ACE_BP",
  category: "abnormality",
  description: "Acentric fragment must have 1-2 breakpoints",
  validate: (ast, target) => validateAcentricBreakpoints(ast, target)
};
const telomericAssociationBreakpointRule = {
  id: "ABN_TAS_BP",
  category: "abnormality",
  description: "Telomeric association breakpoint count must match chromosome count",
  validate: (ast, target) => validateTelomericAssociationBreakpoints(ast, target)
};
const fissionBreakpointRule = {
  id: "ABN_FIS_BP",
  category: "abnormality",
  description: "Fission must have exactly 1 breakpoint",
  validate: (ast, target) => validateFissionBreakpoints(ast, target)
};
const neocentromereBreakpointRule = {
  id: "ABN_NEO_BP",
  category: "abnormality",
  description: "Neocentromere must have exactly 1 breakpoint",
  validate: (ast, target) => validateNeocentromereBreakpoints(ast, target)
};
const incompleteBreakpointRule = {
  id: "ABN_INC_BP",
  category: "abnormality",
  description: "Incomplete karyotype marker must have no breakpoints",
  validate: (ast, target) => validateIncompleteBreakpoints(ast, target)
};
const ALL_ABNORMALITY_RULES = [
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
  incompleteBreakpointRule
];
const engine = new RuleEngine();
engine.addRules(ALL_CHROMOSOME_RULES);
engine.addAbnormalityRules(ALL_ABNORMALITY_RULES);
