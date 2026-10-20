import { parseAbnormalities } from "../abnormality-parser.js";
import { ParseError } from "../parse-error.js";
import { parseMultipleBreakpoints } from "../breakpoint-parser.js";
import type { Abnormality, KaryotypeAST, Rule } from "../types.js";
import { structuralReferenceRule } from "./routine.js";

function balancedParentheses(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

function directBreakpoints(ast: KaryotypeAST, abn: Abnormality, tail: string): string[] {
  const match = tail.match(/^\(([pq\d.;?]+)\)/);
  if (!match) return [];
  try {
    const breakpoints = parseMultipleBreakpoints(match[1]);
    if (breakpoints.length !== abn.chromosome.split(";").length) return [`Derivative chromosome and breakpoints counts differ in ${abn.raw}`];
    return structuralReferenceRule.validate(ast, { ...abn, breakpoints });
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    return [error.message];
  }
}

/** Flat named components can be checked without reconstructing a derivative path. */
export function validateDerivativeComponents(ast: KaryotypeAST, abn: Abnormality, rules: Rule[]): string[] {
  if (!["der", "+der", "-der"].includes(abn.type)) return [];
  if (!balancedParentheses(abn.raw)) return [`Unbalanced parentheses in ${abn.raw}`];
  const tail = abn.raw.slice(abn.raw.indexOf(")") + 1);
  const components = tail.matchAll(/\b(del|dup|inv|t|ins|add|trp|qdp|dic|idic|fra|rob|hsr|ace|tas|fis|neo|i|r)\(([^()]*)\)(?:\(([^()]*)\))?/g);
  const errors = directBreakpoints(ast, abn, tail);
  for (const match of components) {
    try {
      if (match[3] === undefined) {
        // Abbreviated components may reference an event described elsewhere.
        const component = { ...abn, type: match[1], chromosome: match[2], raw: match[0] };
        errors.push(...structuralReferenceRule.validate(ast, component));
      } else {
        const [component] = parseAbnormalities([match[0]]);
        errors.push(...rules.flatMap((rule) => rule.validate(ast, component)));
      }
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      errors.push(error.message);
    }
  }
  return errors.map((error) => `Derivative component in ${abn.raw}: ${error}`);
}
