import type { CellLine, KaryotypeAST } from "./types.js";

/** Only a composite group's own count can relax its numerical-total checks. */
export function cellLineContext(ast: KaryotypeAST, line: CellLine): KaryotypeAST {
  const modifiers = { ...ast.modifiers };
  delete modifiers.composite;
  if (line.composite) modifiers.composite = line.count;
  return { ...ast, ...line, cell_lines: null, modifiers: Object.keys(modifiers).length ? modifiers : null };
}
