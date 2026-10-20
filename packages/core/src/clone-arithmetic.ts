import { ParseError } from "./parse-error.js";
import type { Abnormality, CellLine, KaryotypeAST } from "./types.js";
import { parseAbnormalities } from "./abnormality-parser.js";

const NEUTRAL_TYPES = new Set(["del", "dup", "inv", "t", "add", "trp", "qdp", "i", "fra", "ins"]);
const AUTOSOME = /^(?:[1-9]|1\d|2[0-2])$/;

function copies(abn: Abnormality, count: number): Abnormality {
  if (!Number.isSafeInteger(count) || count <= 0) throw new ParseError("Expanded abnormality copy count exceeds the safe integer limit");
  return { ...abn, copy_count: count === 1 ? null : count };
}

function subtractStructure(inherited: Abnormality[], change: Abnormality): Abnormality {
  const token = change.raw.replaceAll("−", "-");
  const match = token.match(/^-(del|dup|inv|add|trp|qdp|i|r|idic)\(([1-9]|1\d|2[0-2])\)(?:\(([^()]*)\))?(?:[x×]\d+)?$/);
  if (!match || change.uncertain) throw new ParseError(`Unsupported structural clone subtraction '${change.raw}'; spell out this cell line`);
  const specified = match[3] === undefined ? null : parseAbnormalities([`${match[1]}(${match[2]})(${match[3]})`])[0];
  const candidates = inherited.filter((abn) => abn.type === match[1] && abn.chromosome === match[2] &&
    (!specified || JSON.stringify(abn.breakpoints) === JSON.stringify(specified.breakpoints)));
  if (candidates.length !== 1) throw new ParseError(`Structural clone subtraction '${change.raw}' is ${candidates.length ? "ambiguous" : "absent from the reference clone"}; spell out this cell line`);
  const selected = candidates[0];
  if (selected.uncertain || selected.breakpoints.some((bp) => bp.uncertain)) throw new ParseError(`Cannot subtract uncertain inherited structure '${change.raw}'; spell out this cell line`);
  const remaining = (selected.copy_count ?? 1) - (change.copy_count ?? 1);
  if (remaining < 0) throw new ParseError(`Structural clone subtraction '${change.raw}' exceeds inherited copies`);
  const index = inherited.indexOf(selected);
  if (remaining) inherited[index] = copies(selected, remaining);
  else inherited.splice(index, 1);
  return { ...change, type: "-", chromosome: match[2], breakpoints: [] };
}

function appendNumerical(findings: Abnormality[], change: Abnormality): boolean {
  let remaining = change.copy_count ?? 1;
  let adjusted = false;
  if (["+", "-"].includes(change.type) && AUTOSOME.test(change.chromosome) && !change.uncertain) {
    const opposite = findings.filter((candidate) => candidate.type === (change.type === "+" ? "-" : "+") &&
      candidate.chromosome === change.chromosome && !candidate.uncertain && candidate.inheritance === change.inheritance);
    for (const candidate of opposite) {
      const removed = Math.min(remaining, candidate.copy_count ?? 1);
      const count = (candidate.copy_count ?? 1) - removed;
      const index = findings.indexOf(candidate);
      if (count) findings[index] = copies(candidate, count);
      else findings.splice(index, 1);
      remaining -= removed;
      adjusted = true;
      if (!remaining) break;
    }
  }
  if (remaining) findings.push(copies(change, remaining));
  return adjusted;
}

function countChange(abn: Abnormality): number | null {
  if (abn.uncertain || abn.breakpoints.some((bp) => bp.uncertain)) return null;
  if (["+", "-"].includes(abn.type) && AUTOSOME.test(abn.chromosome)) return (abn.type === "+" ? 1 : -1) * (abn.copy_count ?? 1);
  return NEUTRAL_TYPES.has(abn.type) && !/[XY]/.test(abn.chromosome) ? 0 : null;
}

export function expandClone(ast: KaryotypeAST, reference: CellLine, multiplier: number): boolean {
  const sex = reference.sex_chromosomes;
  if (sex.length * multiplier > 4096) throw new ParseError("Clone sex complement exceeds the 4096-character expansion limit; spell out this cell line");
  ast.sex_chromosomes = sex === "U" ? "U" : sex.repeat(multiplier).split("").sort().join("");
  const inherited = reference.abnormalities.map((abn) => copies(abn, (abn.copy_count ?? 1) * multiplier));
  const additions: Abnormality[] = [];
  let adjusted = Boolean(reference.reference?.adjusted || reference.reference?.multiplier);
  let delta: number | null = 0;
  for (const original of ast.changes ?? []) {
    const structuralLoss = /^\??[-−][a-z]/.test(original.raw);
    const change = structuralLoss ? subtractStructure(inherited, original) : original;
    adjusted ||= structuralLoss;
    additions.push(change);
    const value = countChange(change);
    delta = delta === null || value === null ? null : delta + value;
  }
  for (const change of additions) {
    const cancelled = appendNumerical(inherited, change);
    adjusted ||= cancelled;
  }
  ast.abnormalities = inherited;
  if (typeof reference.chromosome_count === "number" && (multiplier !== 1 || adjusted)) {
    const base = reference.chromosome_count * multiplier;
    const expected = delta === null ? null : base + delta;
    if (!Number.isSafeInteger(base) || (expected !== null && (!Number.isSafeInteger(expected) || expected <= 0))) {
      throw new ParseError("Expanded clone chromosome count exceeds the positive safe integer limit");
    }
    if (expected !== null && typeof ast.chromosome_count === "number" && expected !== ast.chromosome_count) {
      throw new ParseError(`Chromosome count ${ast.chromosome_count} does not match the expected total ${expected} from the reference clone and written changes`);
    }
  }
  return adjusted;
}
