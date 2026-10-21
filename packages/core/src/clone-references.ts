import { ParseError } from "./parse-error.js";
import { expandClone } from "./clone-arithmetic.js";
import type { CellLine, KaryotypeAST } from "./types.js";

export function resolveCloneReference(ast: KaryotypeAST, preceding: CellLine[]): void {
  const token = ast.sex_chromosomes;
  if (!/^(idem|sl|sdl)/.test(token)) return;
  const match = token.match(/^(idem|sl[1-9]\d*|sl|sdl[1-9]\d*|sdl)(?:[x×](\d+))?$/);
  if (!match) {
    throw new ParseError(`Unsupported clone reference '${token}'; spell out this cell line`);
  }
  const base = match[1];
  const multiplier = match[2] === undefined ? 1 : Number(match[2]);
  if (!Number.isSafeInteger(multiplier) || multiplier <= 0) throw new ParseError("Clone multiplier must be a positive safe integer");
  if (!preceding.length) throw new ParseError(`Clone reference '${token}' has no preceding reference clone`);
  const usesIdem = preceding.some((line) => line.reference?.token.startsWith("idem"));
  const usesSl = preceding.some((line) => line.reference && !line.reference.token.startsWith("idem"));
  if ((base === "idem" && usesSl) || (base !== "idem" && usesIdem)) {
    throw new ParseError("Do not mix idem and sl/sdl clone references");
  }
  const sidelines = preceding.filter((line) => line.reference && !line.reference.token.startsWith("idem"));
  const stemlines = preceding.filter((line) => !line.reference);
  let reference = preceding[0];
  if (base.startsWith("sdl")) {
    if (stemlines.length > 1) {
      throw new ParseError("Sideline references with multiple stemlines require explicit restatement; spell out this cell line");
    }
    if (base === "sdl" && sidelines.length !== 1) {
      throw new ParseError("Unnumbered sdl clone reference is absent or ambiguous; use sdlN");
    }
    reference = sidelines[base === "sdl" ? 0 : Number(base.slice(3)) - 1];
    if (!reference) throw new ParseError(`Clone reference '${token}' has no preceding sideline`);
  } else if (base.startsWith("sl") && base !== "sl") {
    reference = stemlines[Number(base.slice(2)) - 1];
    if (!reference) throw new ParseError(`Clone reference '${token}' has no preceding stemline`);
  } else if (base === "sl" && stemlines.length > 1) {
    throw new ParseError(`Clone reference '${token}' is ambiguous after an independent clone`);
  }
  if (reference.composite || ast.modifiers?.composite !== undefined) {
    throw new ParseError("Composite groups cannot use clone references; spell out each group");
  }
  ast.reference = { token, cell_line: preceding.indexOf(reference) + 1 };
  ast.changes = ast.abnormalities;
  const adjusted = expandClone(ast, reference, multiplier);
  if (multiplier !== 1) ast.reference.multiplier = multiplier;
  if (adjusted) ast.reference.adjusted = true;
}
