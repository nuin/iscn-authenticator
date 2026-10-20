import type { KaryotypeAST } from "./types.js";
import { bandStatus, chromosomeBreakpoints, expectedDiploidCount } from "./rules/routine.js";
import { needsCellLineOrderReview } from "./rules/cell-lines.js";
import { cellLineContext } from "./cell-line-context.js";

export interface CoverageNote { code: string; message: string }
export interface ValidationCoverage {
  level: "supported" | "partial" | "unparsed";
  notes: CoverageNote[];
  reference: "ISCN 2024";
  rule_version: "2026-10-20.1";
  band_reference: "UCSC hg38 cytoBand";
}

/** Describes checks available for an AST; it does not determine whether those checks passed. */
export function getValidationCoverage(ast: KaryotypeAST | null): ValidationCoverage {
  const notes: CoverageNote[] = [];
  const add = (code: string, message: string) => {
    if (!notes.some((note) => note.code === code)) notes.push({ code, message });
  };
  if (!ast) add("unparsed", "The notation could not be parsed; no complete structure was checked.");
  if (ast) {
    const modifiers = ast.modifiers;
    if (modifiers?.ish !== undefined || modifiers?.arr !== undefined || modifiers?.ogm !== undefined) {
      add("assay", "FISH, array and OGM payloads are preserved but their complete assay grammar is not validated.");
    }
    if (modifiers?.composite !== undefined || ast.cell_lines?.some((line) => line.composite)) add("composite", "Composite counts are checked; per-abnormality frequencies and chromosome totals require review.");
    const lines = ast.cell_lines?.map((line) => cellLineContext(ast, line)) ?? [ast];
    for (const line of lines) {
      if (line.reference?.multiplier || line.reference?.adjusted) add("clone_resolution", "Clone multiplication or subtraction was expanded within bounded rules; review the original notation and resolved findings together.");
      if (line.chromosome_count !== null && expectedDiploidCount(line) === null) {
        add("count_scope", "A reliable diploid numerical total cannot be inferred for this notation; review ploidy, structural changes and chromosome balance.");
      }
      for (const abn of line.abnormalities) {
        if (abn.type === "unknown") add("unknown", "Unrecognized abnormality text is preserved and requires manual review.");
        if (["der", "+der", "-der", "rec", "cpx", "cth", "cpy", "upd"].includes(abn.type)) {
          add("complex", "Recognizable derivative components receive chromosome, band and breakpoint checks; complete derivative paths, recombinant and complex structures require review.");
        }
        if (abn.uncertain || abn.breakpoints.some((bp) => bp.uncertain)) add("uncertain", "Uncertain abnormalities or breakpoints require review.");
        if (chromosomeBreakpoints(abn).some(([chromosome, bp]) => bandStatus(chromosome, bp) === "finer")) {
          add("band_resolution", "A region-only or finer subband designation requires review beyond the bundled catalogue resolution.");
        }
      }
    }
    if (needsCellLineOrderReview(ast)) add("clone_order", "Ordering of multiple abnormal clones requires specimen context and further ISCN tie-break rules.");
    if (ast.cell_lines?.some((line) => line.is_donor)) add("donor", "Recipient and donor groups are preserved; donor identity and transplant context require review.");
  }
  return {
    level: !ast ? "unparsed" : notes.length ? "partial" : "supported",
    notes, reference: "ISCN 2024", rule_version: "2026-10-20.1", band_reference: "UCSC hg38 cytoBand",
  };
}
