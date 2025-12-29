/**
 * TypeScript interfaces for ISCN karyotype validation results.
 * These mirror the Python dataclasses in iscn_authenticator/models.py
 */

/** Represents a chromosomal breakpoint like p11.2 or q34. */
export interface Breakpoint {
  arm: string; // "p", "q", "cen", "ter"
  region: number | null;
  band: number | null;
  subband: string | null;
  uncertain: boolean;
}

/** Represents a chromosomal abnormality. */
export interface Abnormality {
  type: string; // "+", "-", "del", "dup", "inv", "t", etc.
  chromosome: string; // "5" or "9;22" for translocations
  breakpoints: Breakpoint[];
  inheritance: string | null; // "mat", "pat", "dn", etc.
  uncertain: boolean;
  copy_count: number | null;
  raw: string; // Original string
}

/** Karyotype-level modifiers. */
export interface Modifiers {
  mosaic?: boolean;
  chimera?: boolean;
  constitutional?: boolean;
  incomplete?: boolean;
  ish?: string; // FISH notation data
  arr?: string; // Microarray notation data
}

/** Represents a cell line in mosaic/chimera notation. */
export interface CellLine {
  chromosome_count: number;
  sex_chromosomes: string;
  abnormalities: Abnormality[];
  count: number;
  is_donor: boolean;
}

/** Abstract syntax tree for a parsed karyotype. */
export interface KaryotypeAST {
  chromosome_count: number | string; // int or range "45~48"
  sex_chromosomes: string;
  abnormalities: Abnormality[];
  cell_lines: CellLine[] | null;
  modifiers: Modifiers | null;
}

/** Result of karyotype validation. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed: KaryotypeAST | null;
}

/** A validation rule for karyotype components. */
export interface Rule {
  id: string;
  category: string;
  description: string;
  validate: (ast: KaryotypeAST, target: KaryotypeAST | Abnormality) => string[];
}
