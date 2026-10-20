import { ParseError } from "./parse-error.js";
import type { CellLine, KaryotypeAST } from "./types.js";

export function resolveCloneReference(ast: KaryotypeAST, preceding: CellLine[]): void {
  const token = ast.sex_chromosomes;
  if (!/^(idem|sl|sdl)/.test(token)) return;
  if (!/^(idem|sl|sdl[1-9]\d*|sdl)$/.test(token)) {
    throw new ParseError(`Unsupported clone reference '${token}'; spell out this cell line`);
  }
  if (!preceding.length) throw new ParseError(`Clone reference '${token}' has no preceding reference clone`);
  const usesIdem = preceding.some((line) => line.reference?.token === "idem");
  const usesSl = preceding.some((line) => line.reference && line.reference.token !== "idem");
  if ((token === "idem" && usesSl) || (token !== "idem" && usesIdem)) {
    throw new ParseError("Do not mix idem and sl/sdl clone references");
  }
  const sidelines = preceding.filter((line) => line.reference && line.reference.token !== "idem");
  let reference = preceding[0];
  if (token.startsWith("sdl")) {
    if (token === "sdl" && sidelines.length !== 1) {
      throw new ParseError("Unnumbered sdl clone reference is absent or ambiguous; use sdlN");
    }
    reference = sidelines[token === "sdl" ? 0 : Number(token.slice(3)) - 1];
    if (!reference) throw new ParseError(`Clone reference '${token}' has no preceding sideline`);
  } else if (preceding.slice(1).some((line) => !line.reference)) {
    throw new ParseError(`Clone reference '${token}' is ambiguous after an independent clone`);
  }
  ast.reference = { token, cell_line: preceding.indexOf(reference) + 1 };
  ast.changes = ast.abnormalities;
  ast.sex_chromosomes = reference.sex_chromosomes;
  ast.abnormalities = [...reference.abnormalities, ...ast.changes];
}
