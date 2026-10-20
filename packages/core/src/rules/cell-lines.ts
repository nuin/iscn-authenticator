import type { CellLine, KaryotypeAST, Rule } from "../types.js";

export function isNormalCellLine(line: CellLine): boolean {
  return !line.composite && line.chromosome_count === 46 &&
    (line.sex_chromosomes === "XX" || line.sex_chromosomes === "XY") &&
    line.abnormalities.length === 0;
}

function cellLineGroups(ast: KaryotypeAST): CellLine[][] {
  const lines = ast.cell_lines ?? [];
  return [lines.filter((line) => !line.is_donor), lines.filter((line) => line.is_donor)];
}

/** Abnormal clone ordering requires specimen context and further tie-break rules. */
export function needsCellLineOrderReview(ast: KaryotypeAST): boolean {
  return cellLineGroups(ast).some((group) => group.filter((line) => !isNormalCellLine(line)).length > 1);
}

function validateCellLineOrder(ast: KaryotypeAST): string[] {
  const errors: string[] = [];
  for (const group of cellLineGroups(ast)) {
    let previousNormal: CellLine | undefined;
    for (const line of group) {
      const position = (ast.cell_lines?.indexOf(line) ?? 0) + 1;
      if (!isNormalCellLine(line)) {
        if (previousNormal) {
          errors.push(`Cell line ${position}: The normal cell line must be listed last within each recipient or donor group (ISCN 2024 section 4.5.3).`);
        }
        continue;
      }
      if (previousNormal && (previousNormal.count < line.count ||
        (previousNormal.count === line.count && previousNormal.sex_chromosomes === "XY" && line.sex_chromosomes === "XX"))) {
        errors.push(`Cell line ${position}: Normal cell lines must be ordered by decreasing cell count, with XX before XY when counts are equal (ISCN 2024 section 4.5.3).`);
      }
      previousNormal = line;
    }
  }
  return errors;
}

export const ALL_CELL_LINE_RULES: Rule[] = [
  {
    id: "COMPOSITE_COUNT", category: "cell_lines", description: "Composite counts must be positive safe integers",
    validate: (ast) => ast.modifiers?.composite !== undefined &&
      (!Number.isSafeInteger(ast.modifiers.composite) || ast.modifiers.composite <= 0)
      ? ["Composite cell count must be a positive safe integer"] : [],
  },
  {
    id: "CELL_LINE_COUNTS", category: "cell_lines",
    description: "Every cell line must have a positive integer metaphase count",
    validate: (ast) => (ast.cell_lines ?? []).flatMap((line, index) =>
      Number.isSafeInteger(line.count) && line.count > 0
        ? []
        : [`Cell line ${index + 1}: Cell count must be a positive safe integer in square brackets`]),
  },
  {
    id: "CELL_LINE_ORDER", category: "cell_lines",
    description: "Normal lines follow abnormal lines; recipient and donor groups remain separate",
    validate: validateCellLineOrder,
  },
];
