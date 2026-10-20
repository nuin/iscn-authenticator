import { getChromosomeBands } from "../ideogram.js";
import type { Abnormality, Breakpoint, KaryotypeAST, Rule } from "../types.js";
import { abnormalityRule } from "./abnormality-checks.js";

const STABLE_COUNT_TYPES = new Set(["del", "dup", "inv", "t", "add", "trp", "qdp", "i", "fra", "ins"]);
export function expectedDiploidCount(ast: KaryotypeAST): number | null {
  const count = ast.chromosome_count;
  if (typeof count !== "number" || count < 40 || count > 55 ||
    !/^[XY]{1,4}$/.test(ast.sex_chromosomes) || ast.modifiers?.composite !== undefined) return null;
  let expected = 44 + ast.sex_chromosomes.length;
  for (const abn of ast.abnormalities) {
    if (abn.uncertain || abn.copy_count !== null) return null;
    if (["+", "-", "+c", "-c"].includes(abn.type)) {
      if (abn.chromosome === "X" || abn.chromosome === "Y") return null;
      expected += abn.type.startsWith("+") ? 1 : -1;
    } else if (!STABLE_COUNT_TYPES.has(abn.type) || /[XY]/.test(abn.chromosome)) return null;
  }
  return expected;
}

export function breakpointName(bp: Breakpoint): string {
  return `${bp.arm}${bp.region}${bp.band ?? ""}${bp.subband ? `.${bp.subband}` : ""}`;
}

function parentBand(parent: string, child: string): boolean {
  return child === parent || child.startsWith(parent + ".") || (parent.includes(".") && child.startsWith(parent));
}

export function bandStatus(chromosome: string, bp: Breakpoint): "known" | "finer" | "absent" {
  const name = breakpointName(bp);
  if (name === "p10" || name === "q10") return "known";
  const bands = getChromosomeBands(chromosome);
  if (bp.band === null) return bands.some((band) => band.name.startsWith(name)) ? "finer" : "absent";
  if (bands.some((band) => parentBand(name, band.name))) return "known";
  if (bands.some((band) => parentBand(band.name, name))) return "finer";
  return "absent";
}

export function chromosomeBreakpoints(abn: Abnormality): [string, Breakpoint][] {
  const chromosomes = abn.chromosome.split(";");
  if (chromosomes.length === 1) return abn.breakpoints.map((bp) => [chromosomes[0], bp]);
  if (abn.type === "ins" && chromosomes.length === 2 && abn.breakpoints.length === 3) {
    return abn.breakpoints.map((bp, index) => [chromosomes[index === 0 ? 0 : 1], bp]);
  }
  if (chromosomes.length === abn.breakpoints.length) {
    return abn.breakpoints.map((bp, index) => [chromosomes[index], bp]);
  }
  return [];
}

function validateStructuralReference(abn: Abnormality): string[] {
  if (!abn.chromosome || abn.chromosome.startsWith("mar") || ["unknown", "+", "-", "+c", "-c"].includes(abn.type)) return [];
  const chromosomes = abn.chromosome.split(";");
  const invalid = chromosomes.filter((chromosome) => !/^(?:[1-9]|1\d|2[0-2]|X|Y)$/.test(chromosome));
  if (invalid.length) return invalid.map((chromosome) => `Invalid chromosome '${chromosome}' in ${abn.raw}. Must be 1-22, X, or Y`);
  return chromosomeBreakpoints(abn).flatMap(([chromosome, bp]) =>
    bandStatus(chromosome, bp) === "absent"
      ? [`Band '${chromosome}${breakpointName(bp)}' in ${abn.raw} is absent from the bundled UCSC hg38 cytoband catalogue`]
      : []);
}

export const structuralReferenceRule = abnormalityRule(
  "ABN_REFERENCE", "Chromosome identifiers and cytobands must match the bundled reference", validateStructuralReference,
);
export const misplacedCloneRule = abnormalityRule(
  "ABN_CLONE_POSITION", "Related-clone shorthand replaces the sex complement", (abn) =>
    /^(idem|sl\d*|sdl\d*)$/.test(abn.raw)
      ? ["Related-clone shorthand must replace the sex chromosome field and reference a preceding clone"] : [],
);
export const numericalTotalRule: Rule = {
  id: "CHR_NUMERICAL_TOTAL", category: "coherence", description: "Check a reliable diploid numerical total",
  validate: (ast) => {
    const expected = expectedDiploidCount(ast);
    return expected !== null && expected !== ast.chromosome_count
      ? [`Chromosome count ${ast.chromosome_count} does not match the expected total ${expected} from the sex complement and numerical changes`] : [];
  },
};
