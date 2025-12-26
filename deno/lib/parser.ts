/**
 * Parser for ISCN karyotype strings.
 * Port of iscn_authenticator/parser.py to TypeScript.
 */

import type { KaryotypeAST, Abnormality, Breakpoint, CellLine } from "./types.ts";

/** Pattern for cell line count: [10], [20], etc. */
const CELL_LINE_COUNT_PATTERN = /^(.+?)\[(\d+)\]$/;

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export class KaryotypeParser {
  // Regex patterns
  private readonly SEX_CHROMOSOMES_PATTERN = /^[XYU]+$/;
  private readonly NUMERICAL_ABNORMALITY_PATTERN = /^([+-])(\d{1,2}|[XY])$/;
  private readonly DELETION_PATTERN = /^del\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly DUPLICATION_PATTERN = /^dup\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly INVERSION_PATTERN = /^inv\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly TRANSLOCATION_PATTERN = /^t\(([^)]+)\)\(([^)]+)\)$/;
  private readonly BREAKPOINT_PATTERN = /^([pq])(\d+)(?:\.(\d+))?$/;
  private readonly ISOCHROMOSOME_SHORT_PATTERN = /^i\((\d{1,2}|[XY])([pq])\)$/;
  private readonly ISOCHROMOSOME_LONG_PATTERN = /^i\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly RING_SIMPLE_PATTERN = /^r\((\d{1,2}|[XY])\)$/;
  private readonly RING_BREAKPOINT_PATTERN = /^r\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly MARKER_PATTERN = /^\+(\d*)mar(\d*)$/;
  private readonly DERIVATIVE_PATTERN = /^der\((\d{1,2}|[XY])\)(.+)$/;
  private readonly DMIN_PATTERN = /^dmin$/;
  private readonly HSR_SIMPLE_PATTERN = /^hsr$/;
  private readonly HSR_LOCATION_PATTERN = /^hsr\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly INSERTION_PATTERN = /^ins\(([^)]+)\)\(([^)]+)\)$/;
  private readonly ADD_PATTERN = /^add\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly TRIPLICATION_PATTERN = /^trp\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly DICENTRIC_PATTERN = /^dic\(([^)]+)\)\(([^)]+)\)$/;
  private readonly ISODICENTRIC_PATTERN = /^idic\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly FRAGILE_SITE_PATTERN = /^fra\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly ROBERTSONIAN_PATTERN = /^rob\(([^)]+)\)\(([^)]+)\)$/;
  private readonly QUADRUPLICATION_PATTERN = /^qdp\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly PSEUDODICENTRIC_PATTERN = /^psu\s*dic\(([^)]+)\)\(([^)]+)\)$/;
  private readonly ACENTRIC_PATTERN = /^ace\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly TELOMERIC_ASSOC_PATTERN = /^tas\(([^)]+)\)\(([^)]+)\)$/;
  private readonly FISSION_PATTERN = /^fis\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly NEOCENTROMERE_PATTERN = /^neo\((\d{1,2}|[XY])\)\(([^)]+)\)$/;
  private readonly INCOMPLETE_PATTERN = /^inc$/;

  parse(karyotype: string): KaryotypeAST {
    if (!karyotype || !karyotype.trim()) {
      throw new ParseError("Karyotype string is empty");
    }

    karyotype = karyotype.trim();

    // Check for mosaicism (cell lines separated by /)
    if (karyotype.includes("/")) {
      return this.parseMosaic(karyotype);
    }

    return this.parseSingleKaryotype(karyotype, false) as KaryotypeAST;
  }

  private parseSingleKaryotype(
    karyotype: string,
    extractCount = false
  ): KaryotypeAST | { ast: KaryotypeAST; count: number } {
    let count = 0;

    // Extract cell count if present (e.g., "46,XX[10]")
    if (extractCount) {
      const countMatch = karyotype.match(CELL_LINE_COUNT_PATTERN);
      if (countMatch) {
        karyotype = countMatch[1];
        count = parseInt(countMatch[2], 10);
      }
    }

    // Split on comma
    if (!karyotype.includes(",")) {
      throw new ParseError("Missing comma separator between chromosome count and sex chromosomes");
    }

    const parts = karyotype.split(",");

    // Parse chromosome count
    const chromosomeCount = this.parseChromosomeCount(parts[0]);

    // Parse sex chromosomes
    const sexChromosomes = this.parseSexChromosomes(parts[1]);

    // Parse abnormalities (if any)
    const abnormalities = parts.length > 2 ? this.parseAbnormalities(parts.slice(2)) : [];

    const ast: KaryotypeAST = {
      chromosome_count: chromosomeCount,
      sex_chromosomes: sexChromosomes,
      abnormalities,
      cell_lines: null,
      modifiers: null,
    };

    if (extractCount) {
      return { ast, count };
    }
    return ast;
  }

  private parseMosaic(karyotype: string): KaryotypeAST {
    const cellLineStrs = karyotype.split("/");
    const cellLines: CellLine[] = [];

    for (const lineStr of cellLineStrs) {
      const result = this.parseSingleKaryotype(lineStr.trim(), true) as {
        ast: KaryotypeAST;
        count: number;
      };
      const cellLine: CellLine = {
        chromosome_count: result.ast.chromosome_count as number,
        sex_chromosomes: result.ast.sex_chromosomes,
        abnormalities: result.ast.abnormalities,
        count: result.count,
        is_donor: false,
      };
      cellLines.push(cellLine);
    }

    // Use the first cell line as the main karyotype info
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

    // Handle numeric count
    if (!/^\d+$/.test(countStr)) {
      throw new ParseError(`Invalid chromosome count: '${countStr}' is not a number`);
    }

    return parseInt(countStr, 10);
  }

  private parseSexChromosomes(sexStr: string): string {
    sexStr = sexStr.trim();

    if (!this.SEX_CHROMOSOMES_PATTERN.test(sexStr)) {
      throw new ParseError(`Invalid sex chromosomes: '${sexStr}' must contain only X, Y, or U`);
    }

    return sexStr;
  }

  private parseBreakpoint(bpStr: string): Breakpoint {
    const match = bpStr.match(this.BREAKPOINT_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid breakpoint format: '${bpStr}'`);
    }

    const arm = match[1];
    const regionBand = match[2];
    const subband = match[3] || null;

    // Split region and band (e.g., "13" -> region=1, band=3)
    let region: number;
    let band: number;
    if (regionBand.length >= 2) {
      region = parseInt(regionBand[0], 10);
      band = parseInt(regionBand.slice(1), 10);
    } else {
      region = parseInt(regionBand, 10);
      band = 0;
    }

    return {
      arm,
      region,
      band,
      subband,
      uncertain: false,
    };
  }

  private parseBreakpoints(bpStr: string): Breakpoint[] {
    const breakpoints: Breakpoint[] = [];
    // Try to match two breakpoints
    const doubleBp = bpStr.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/);
    if (doubleBp) {
      breakpoints.push(this.parseBreakpoint(doubleBp[1]));
      breakpoints.push(this.parseBreakpoint(doubleBp[2]));
    } else {
      breakpoints.push(this.parseBreakpoint(bpStr));
    }
    return breakpoints;
  }

  private parseMultipleBreakpoints(bpStr: string): Breakpoint[] {
    const bpParts = bpStr.split(";");
    return bpParts.map((bp) => this.parseBreakpoint(bp.trim()));
  }

  private parseDeletion(part: string): Abnormality {
    const match = part.match(this.DELETION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid deletion format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];

    const breakpoints = this.parseBreakpoints(breakpointStr);

    return {
      type: "del",
      chromosome,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseDuplication(part: string): Abnormality {
    const match = part.match(this.DUPLICATION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid duplication format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];

    const breakpoints = this.parseBreakpoints(breakpointStr);

    return {
      type: "dup",
      chromosome,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseInversion(part: string): Abnormality {
    const match = part.match(this.INVERSION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid inversion format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];

    const doubleBp = breakpointStr.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/);
    if (!doubleBp) {
      throw new ParseError(`Inversion requires two breakpoints: '${part}'`);
    }

    const breakpoints = [
      this.parseBreakpoint(doubleBp[1]),
      this.parseBreakpoint(doubleBp[2]),
    ];

    return {
      type: "inv",
      chromosome,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseTranslocation(part: string): Abnormality {
    const match = part.match(this.TRANSLOCATION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid translocation format: '${part}'`);
    }

    const chromosomesStr = match[1];
    const breakpointsStr = match[2];

    const bpParts = breakpointsStr.split(";");
    const breakpoints = bpParts.map((bp) => this.parseBreakpoint(bp.trim()));

    return {
      type: "t",
      chromosome: chromosomesStr,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseIsochromosome(part: string): Abnormality {
    // Try short form first: i(17q) or i(Xq)
    const shortMatch = part.match(this.ISOCHROMOSOME_SHORT_PATTERN);
    if (shortMatch) {
      const chromosome = shortMatch[1];
      const arm = shortMatch[2];
      const breakpoint: Breakpoint = {
        arm,
        region: 1,
        band: 0,
        subband: null,
        uncertain: false,
      };
      return {
        type: "i",
        chromosome,
        breakpoints: [breakpoint],
        inheritance: null,
        uncertain: false,
        copy_count: null,
        raw: part,
      };
    }

    // Try long form: i(17)(q10)
    const longMatch = part.match(this.ISOCHROMOSOME_LONG_PATTERN);
    if (longMatch) {
      const chromosome = longMatch[1];
      const breakpointStr = longMatch[2];
      const breakpoint = this.parseBreakpoint(breakpointStr);
      return {
        type: "i",
        chromosome,
        breakpoints: [breakpoint],
        inheritance: null,
        uncertain: false,
        copy_count: null,
        raw: part,
      };
    }

    throw new ParseError(`Invalid isochromosome format: '${part}'`);
  }

  private parseRing(part: string): Abnormality {
    // Try simple form first: r(1)
    const simpleMatch = part.match(this.RING_SIMPLE_PATTERN);
    if (simpleMatch) {
      const chromosome = simpleMatch[1];
      return {
        type: "r",
        chromosome,
        breakpoints: [],
        inheritance: null,
        uncertain: false,
        copy_count: null,
        raw: part,
      };
    }

    // Try breakpoint form: r(1)(p36q42)
    const bpMatch = part.match(this.RING_BREAKPOINT_PATTERN);
    if (bpMatch) {
      const chromosome = bpMatch[1];
      const breakpointStr = bpMatch[2];
      const breakpoints = this.parseBreakpoints(breakpointStr);
      return {
        type: "r",
        chromosome,
        breakpoints,
        inheritance: null,
        uncertain: false,
        copy_count: null,
        raw: part,
      };
    }

    throw new ParseError(`Invalid ring chromosome format: '${part}'`);
  }

  private parseInsertion(part: string): Abnormality {
    const match = part.match(this.INSERTION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid insertion format: '${part}'`);
    }

    const chromosomesStr = match[1];
    const breakpointsStr = match[2];

    const breakpoints: Breakpoint[] = [];
    if (breakpointsStr.includes(";")) {
      // Interchromosomal: breakpoints separated by semicolon
      const bpParts = breakpointsStr.split(";");
      breakpoints.push(this.parseBreakpoint(bpParts[0].trim()));
      const segmentStr = bpParts[1].trim();
      const doubleBp = segmentStr.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/);
      if (doubleBp) {
        breakpoints.push(this.parseBreakpoint(doubleBp[1]));
        breakpoints.push(this.parseBreakpoint(doubleBp[2]));
      } else {
        breakpoints.push(this.parseBreakpoint(segmentStr));
      }
    } else {
      // Intrachromosomal: three consecutive breakpoints
      const tripleBp = breakpointsStr.match(
        /^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/
      );
      if (tripleBp) {
        breakpoints.push(this.parseBreakpoint(tripleBp[1]));
        breakpoints.push(this.parseBreakpoint(tripleBp[2]));
        breakpoints.push(this.parseBreakpoint(tripleBp[3]));
      } else {
        throw new ParseError(`Invalid insertion breakpoints: '${breakpointsStr}'`);
      }
    }

    return {
      type: "ins",
      chromosome: chromosomesStr,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseAdd(part: string): Abnormality {
    const match = part.match(this.ADD_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid additional material format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];
    const breakpoint = this.parseBreakpoint(breakpointStr);

    return {
      type: "add",
      chromosome,
      breakpoints: [breakpoint],
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseTriplication(part: string): Abnormality {
    const match = part.match(this.TRIPLICATION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid triplication format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];

    const doubleBp = breakpointStr.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/);
    if (!doubleBp) {
      throw new ParseError(`Triplication requires two breakpoints: '${part}'`);
    }

    const breakpoints = [
      this.parseBreakpoint(doubleBp[1]),
      this.parseBreakpoint(doubleBp[2]),
    ];

    return {
      type: "trp",
      chromosome,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseDicentric(part: string): Abnormality {
    const match = part.match(this.DICENTRIC_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid dicentric format: '${part}'`);
    }

    const chromosomesStr = match[1];
    const breakpointsStr = match[2];

    const bpParts = breakpointsStr.split(";");
    const breakpoints = bpParts.map((bp) => this.parseBreakpoint(bp.trim()));

    return {
      type: "dic",
      chromosome: chromosomesStr,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseIsodicentric(part: string): Abnormality {
    const match = part.match(this.ISODICENTRIC_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid isodicentric format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];
    const breakpoint = this.parseBreakpoint(breakpointStr);

    return {
      type: "idic",
      chromosome,
      breakpoints: [breakpoint],
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseFragileSite(part: string): Abnormality {
    const match = part.match(this.FRAGILE_SITE_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid fragile site format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];
    const breakpoint = this.parseBreakpoint(breakpointStr);

    return {
      type: "fra",
      chromosome,
      breakpoints: [breakpoint],
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseRobertsonian(part: string): Abnormality {
    const match = part.match(this.ROBERTSONIAN_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid Robertsonian translocation format: '${part}'`);
    }

    const chromosomesStr = match[1];
    const breakpointsStr = match[2];

    const bpParts = breakpointsStr.split(";");
    const breakpoints = bpParts.map((bp) => this.parseBreakpoint(bp.trim()));

    return {
      type: "rob",
      chromosome: chromosomesStr,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseQuadruplication(part: string): Abnormality {
    const match = part.match(this.QUADRUPLICATION_PATTERN);
    if (!match) {
      throw new ParseError(`Invalid quadruplication format: '${part}'`);
    }

    const chromosome = match[1];
    const breakpointStr = match[2];

    const doubleBp = breakpointStr.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$/);
    if (!doubleBp) {
      throw new ParseError(`Quadruplication requires two breakpoints: '${part}'`);
    }

    const breakpoints = [
      this.parseBreakpoint(doubleBp[1]),
      this.parseBreakpoint(doubleBp[2]),
    ];

    return {
      type: "qdp",
      chromosome,
      breakpoints,
      inheritance: null,
      uncertain: false,
      copy_count: null,
      raw: part,
    };
  }

  private parseAbnormalities(parts: string[]): Abnormality[] {
    const abnormalities: Abnormality[] = [];

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      // Check for uncertainty marker (?)
      let uncertain = false;
      let originalPart = part;
      if (part.startsWith("?")) {
        uncertain = true;
        part = part.slice(1);
      }

      // Check for inheritance notation (mat, pat, dn) at end
      let inheritance: string | null = null;
      if (part.endsWith("mat")) {
        inheritance = "mat";
        part = part.slice(0, -3);
      } else if (part.endsWith("pat")) {
        inheritance = "pat";
        part = part.slice(0, -3);
      } else if (part.endsWith("dn")) {
        inheritance = "dn";
        part = part.slice(0, -2);
      }

      // Try numerical abnormality (+21, -7, +X, -Y)
      const numMatch = part.match(this.NUMERICAL_ABNORMALITY_PATTERN);
      if (numMatch) {
        abnormalities.push({
          type: numMatch[1],
          chromosome: numMatch[2],
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try deletion
      if (part.startsWith("del(")) {
        const abn = this.parseDeletion(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try additional material
      if (part.startsWith("add(")) {
        const abn = this.parseAdd(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try duplication
      if (part.startsWith("dup(")) {
        const abn = this.parseDuplication(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try dicentric
      if (part.startsWith("dic(")) {
        const abn = this.parseDicentric(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try isodicentric
      if (part.startsWith("idic(")) {
        const abn = this.parseIsodicentric(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try fragile site
      if (part.startsWith("fra(")) {
        const abn = this.parseFragileSite(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try inversion
      if (part.startsWith("inv(")) {
        const abn = this.parseInversion(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try triplication
      if (part.startsWith("trp(")) {
        const abn = this.parseTriplication(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try quadruplication
      if (part.startsWith("qdp(")) {
        const abn = this.parseQuadruplication(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try translocation
      if (part.startsWith("t(")) {
        const abn = this.parseTranslocation(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try insertion
      if (part.startsWith("ins(")) {
        const abn = this.parseInsertion(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try isochromosome
      if (part.startsWith("i(")) {
        const abn = this.parseIsochromosome(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try Robertsonian translocation
      if (part.startsWith("rob(")) {
        const abn = this.parseRobertsonian(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try ring chromosome
      if (part.startsWith("r(")) {
        const abn = this.parseRing(part);
        abn.uncertain = uncertain;
        abn.inheritance = inheritance;
        abn.raw = originalPart;
        abnormalities.push(abn);
        continue;
      }

      // Try marker chromosome (+mar, +2mar, +mar1)
      const marMatch = part.match(this.MARKER_PATTERN);
      if (marMatch) {
        const countPrefix = marMatch[1];
        const markerSuffix = marMatch[2];
        const copyCount = countPrefix ? parseInt(countPrefix, 10) : null;
        const chromosome = "mar" + (markerSuffix || "");
        abnormalities.push({
          type: "+mar",
          chromosome,
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: copyCount,
          raw: originalPart,
        });
        continue;
      }

      // Try derivative chromosome
      const derMatch = part.match(this.DERIVATIVE_PATTERN);
      if (derMatch) {
        const chromosome = derMatch[1];
        abnormalities.push({
          type: "der",
          chromosome,
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try double minutes
      if (this.DMIN_PATTERN.test(part)) {
        abnormalities.push({
          type: "dmin",
          chromosome: "",
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try HSR with location
      const hsrLocMatch = part.match(this.HSR_LOCATION_PATTERN);
      if (hsrLocMatch) {
        const chromosome = hsrLocMatch[1];
        const breakpointStr = hsrLocMatch[2];
        const breakpoint = this.parseBreakpoint(breakpointStr);
        abnormalities.push({
          type: "hsr",
          chromosome,
          breakpoints: [breakpoint],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try simple HSR
      if (this.HSR_SIMPLE_PATTERN.test(part)) {
        abnormalities.push({
          type: "hsr",
          chromosome: "",
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try pseudodicentric
      const psuMatch = part.match(this.PSEUDODICENTRIC_PATTERN);
      if (psuMatch) {
        const chromosomes = psuMatch[1];
        const breakpointStr = psuMatch[2];
        const breakpoints = this.parseMultipleBreakpoints(breakpointStr);
        abnormalities.push({
          type: "psu dic",
          chromosome: chromosomes,
          breakpoints,
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try acentric fragment
      const aceMatch = part.match(this.ACENTRIC_PATTERN);
      if (aceMatch) {
        const chromosome = aceMatch[1];
        const breakpointStr = aceMatch[2];
        const breakpoints = this.parseBreakpoints(breakpointStr);
        abnormalities.push({
          type: "ace",
          chromosome,
          breakpoints,
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try telomeric association
      const tasMatch = part.match(this.TELOMERIC_ASSOC_PATTERN);
      if (tasMatch) {
        const chromosomes = tasMatch[1];
        const breakpointStr = tasMatch[2];
        const breakpoints = this.parseMultipleBreakpoints(breakpointStr);
        abnormalities.push({
          type: "tas",
          chromosome: chromosomes,
          breakpoints,
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try fission
      const fisMatch = part.match(this.FISSION_PATTERN);
      if (fisMatch) {
        const chromosome = fisMatch[1];
        const breakpointStr = fisMatch[2];
        const breakpoint = this.parseBreakpoint(breakpointStr);
        abnormalities.push({
          type: "fis",
          chromosome,
          breakpoints: [breakpoint],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try neocentromere
      const neoMatch = part.match(this.NEOCENTROMERE_PATTERN);
      if (neoMatch) {
        const chromosome = neoMatch[1];
        const breakpointStr = neoMatch[2];
        const breakpoint = this.parseBreakpoint(breakpointStr);
        abnormalities.push({
          type: "neo",
          chromosome,
          breakpoints: [breakpoint],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Try incomplete karyotype
      if (this.INCOMPLETE_PATTERN.test(part)) {
        abnormalities.push({
          type: "inc",
          chromosome: "",
          breakpoints: [],
          inheritance,
          uncertain,
          copy_count: null,
          raw: originalPart,
        });
        continue;
      }

      // Unknown abnormality type
      abnormalities.push({
        type: "unknown",
        chromosome: "",
        breakpoints: [],
        inheritance,
        uncertain,
        copy_count: null,
        raw: originalPart,
      });
    }

    return abnormalities;
  }
}
