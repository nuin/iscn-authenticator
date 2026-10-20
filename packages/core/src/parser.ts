/**
 * Parser for ISCN karyotype strings.
 * Port of iscn_authenticator/parser.py to TypeScript.
 */

import type { CellLine, KaryotypeAST } from "./types.js";
import { ParseError } from "./parse-error.js";
import { resolveCloneReference } from "./clone-references.js";
import { parseAbnormalities } from "./abnormality-parser.js";

export { ParseError } from "./parse-error.js";

/** Pattern for cell line count: [10], [20], etc. */
const CELL_LINE_COUNT_PATTERN = /^(.+?)\[(\d+)\]$/;

export class KaryotypeParser {
  parse(karyotype: string): KaryotypeAST {
    if (!karyotype || !karyotype.trim()) {
      throw new ParseError("Karyotype string is empty");
    }

    const original = karyotype;
    karyotype = karyotype.trim();

    // Check for standalone interphase FISH notation (nuc ish)
    if (karyotype.startsWith("nuc ish ")) {
      const fishData = karyotype.slice(8); // Remove "nuc ish " prefix
      return {
        raw: original,
        chromosome_count: null,
        sex_chromosomes: "",
        abnormalities: [],
        cell_lines: null,
        modifiers: {
          ish: fishData,
          interphase: true,
        },
      };
    }

    // Check for FISH notation (.ish), array (.arr), or optical genome mapping (.ogm)
    let fishData: string | null = null;
    let arrData: string | null = null;
    let ogmData: string | null = null;
    if (karyotype.includes(".ish ")) {
      const ishIndex = karyotype.indexOf(".ish ");
      fishData = karyotype.slice(ishIndex + 5);
      karyotype = karyotype.slice(0, ishIndex);
    } else if (karyotype.includes(".arr")) {
      const arrIndex = karyotype.indexOf(".arr");
      arrData = karyotype.slice(arrIndex + 4);
      karyotype = karyotype.slice(0, arrIndex);
    } else if (karyotype.includes(".ogm")) {
      const ogmIndex = karyotype.indexOf(".ogm");
      ogmData = karyotype.slice(ogmIndex + 4);
      karyotype = karyotype.slice(0, ogmIndex);
    }

    // Check for composite karyotype notation (cp[n] at end)
    let compositeCount: number | null = null;
    const cpMatch = karyotype.match(/(?:\.cp\[(\d+)\]|\[cp(\d+)\])$/);
    if (cpMatch) {
      compositeCount = Number(cpMatch[1] ?? cpMatch[2]);
      karyotype = karyotype.slice(0, -cpMatch[0].length);
    }

    const isChimera = karyotype.startsWith("chi ");
    const isMosaic = karyotype.startsWith("mos ");
    if (isChimera || isMosaic) {
      karyotype = karyotype.slice(4);
    }

    // Check for mosaicism (cell lines separated by /) or chimera
    let ast: KaryotypeAST;
    if (karyotype.includes("/")) {
      ast = this.parseMosaic(karyotype);
    } else {
      ast = this.parseSingleKaryotype(karyotype, false) as KaryotypeAST;
    }

    // Add modifiers
    if (
      fishData !== null || arrData !== null || ogmData !== null || compositeCount !== null || isChimera || isMosaic
    ) {
      ast.modifiers = ast.modifiers || {};
      if (fishData !== null) {
        ast.modifiers.ish = fishData;
      }
      if (arrData !== null) {
        ast.modifiers.arr = arrData;
      }
      if (ogmData !== null) {
        ast.modifiers.ogm = ogmData;
      }
      if (compositeCount !== null) {
        ast.modifiers.composite = compositeCount;
      }
      if (isChimera) {
        ast.modifiers.chimera = true;
      }
      if (isMosaic) {
        ast.modifiers.mosaic = true;
      }
    }

    ast.raw = original;
    return ast;
  }

  private parseSingleKaryotype(
    karyotype: string,
    extractCount = false,
    preceding: CellLine[] = [],
  ): KaryotypeAST | { ast: KaryotypeAST; count: number } {
    const original = karyotype;
    let count = 0;

    // Extract cell count if present (e.g., "46,XX[10]")
    if (extractCount || karyotype.includes("[") || karyotype.includes("]")) {
      const countMatch = karyotype.match(CELL_LINE_COUNT_PATTERN);
      if (!countMatch && (karyotype.includes("[") || karyotype.includes("]"))) {
        throw new ParseError("Cell count must be a positive safe integer in square brackets");
      }
      if (countMatch) {
        karyotype = countMatch[1];
        count = Number(countMatch[2]);
        if (!Number.isSafeInteger(count) || count <= 0) {
          throw new ParseError("Cell count must be a positive safe integer in square brackets");
        }
      }
    }

    if (karyotype.includes("[") || karyotype.includes("]")) {
      throw new ParseError("Unexpected bracketed count inside the cell line");
    }

    // Split on comma
    if (!karyotype.includes(",")) {
      throw new ParseError(
        "Missing comma separator between chromosome count and sex chromosomes",
      );
    }

    const parts = karyotype.split(",");

    const chromosomeCount = this.parseChromosomeCount(parts[0]);

    const sexToken = parts[1].trim();
    const sexChromosomes = /^(idem|sl|sdl)/.test(sexToken) ? sexToken : this.parseSexChromosomes(sexToken);

    // Parse abnormalities (if any)
    const abnormalities = parts.length > 2
      ? parseAbnormalities(parts.slice(2))
      : [];

    const ast: KaryotypeAST = {
      raw: original,
      ...(count ? { count } : {}),
      chromosome_count: chromosomeCount,
      sex_chromosomes: sexChromosomes,
      abnormalities,
      cell_lines: null,
      modifiers: null,
    };

    resolveCloneReference(ast, preceding);
    if (extractCount) {
      return { ast, count };
    }
    return ast;
  }

  private parseMosaic(karyotype: string): KaryotypeAST {
    const groups = karyotype.split("//");
    if (groups.length > 2 || karyotype.includes("///")) {
      throw new ParseError("Use one double slash to separate recipient and donor cell lines");
    }
    const cellLines: CellLine[] = [];
    for (const [groupIndex, group] of groups.entries()) {
      if (!group.trim() && groups.length === 2) continue;
      for (const lineStr of group.split("/")) {
        try {
          const { ast, count } = this.parseSingleKaryotype(lineStr.trim(), true, cellLines.filter((line) => line.is_donor === (groupIndex === 1))) as {
            ast: KaryotypeAST;
            count: number;
          };
          cellLines.push({
            raw: ast.raw,
            ...(ast.reference ? { reference: ast.reference, changes: ast.changes } : {}),
            chromosome_count: ast.chromosome_count as number | string,
            sex_chromosomes: ast.sex_chromosomes,
            abnormalities: ast.abnormalities,
            count,
            is_donor: groupIndex === 1,
          });
        } catch (error) {
          if (!(error instanceof ParseError)) throw error;
          throw new ParseError(`Cell line ${cellLines.length + 1}: ${error.message}`);
        }
      }
    }
    if (!cellLines.length) throw new ParseError("At least one cell line is required");
    const first = cellLines[0];
    return {
      chromosome_count: first.chromosome_count,
      sex_chromosomes: first.sex_chromosomes,
      abnormalities: first.abnormalities,
      cell_lines: cellLines,
      modifiers: null,
    };
  }

  private parseChromosomeCount(countStr: string): number | string {
    countStr = countStr.trim();

    // Handle range notation (e.g., "45~48")
    if (countStr.includes("~")) {
      return countStr;
    }

    if (!/^\d+$/.test(countStr)) {
      throw new ParseError(
        `Invalid chromosome count: '${countStr}' is not a number`,
      );
    }

    return parseInt(countStr, 10);
  }

  private parseSexChromosomes(sexStr: string): string {
    sexStr = sexStr.trim();

    if (!/^[XYU]+$/.test(sexStr)) {
      throw new ParseError(
        `Invalid sex chromosomes: '${sexStr}' must contain only X, Y, or U`,
      );
    }

    return sexStr;
  }
}
