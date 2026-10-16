import type { Abnormality, Rule } from "../types.js";

type AbnormalityCheck = (abnormality: Abnormality) => string[];

export function abnormalityRule(
  id: string,
  description: string,
  check: AbnormalityCheck,
): Rule {
  return {
    id,
    category: "abnormality",
    description,
    validate: (_ast, target) => check(target as Abnormality),
  };
}

export function breakpointCount(
  type: string,
  allowed: readonly number[],
  message: string,
): AbnormalityCheck {
  return (abn) => {
    if (abn.type !== type || allowed.includes(abn.breakpoints.length)) {
      return [];
    }
    return [`${message}, found ${abn.breakpoints.length} in ${abn.raw}`];
  };
}

export function chromosomeBreakpointCount(
  type: string,
  label: string,
): AbnormalityCheck {
  return (abn) => {
    if (abn.type !== type) return [];
    const chromosomeCount = abn.chromosome.split(";").length;
    const breakpointCount = abn.breakpoints.length;
    if (chromosomeCount === breakpointCount) return [];
    return [
      `${label} has ${chromosomeCount} chromosomes but ${breakpointCount} breakpoints in ${abn.raw}`,
    ];
  };
}

export function breakpointArms(
  type: string,
  allowedCounts: readonly number[],
  countMessage: string,
  armLabel: string,
  sameArm: boolean,
): AbnormalityCheck {
  const checkCount = breakpointCount(type, allowedCounts, countMessage);
  return (abn) => {
    if (abn.type !== type) return [];
    const errors = checkCount(abn);
    if (errors.length || abn.breakpoints.length !== 2) return errors;
    const [first, second] = abn.breakpoints;
    if ((first.arm === second.arm) === sameArm) return [];
    const relationship = sameArm ? "same arm" : "different arms";
    return [
      `${armLabel} breakpoints must be on ${relationship}, found ${first.arm} and ${second.arm} in ${abn.raw}`,
    ];
  };
}
