/**
 * Rule engine for applying validation rules to karyotype AST.
 * Port of iscn_authenticator/engine.py to TypeScript.
 */

import type { KaryotypeAST, ValidationResult, Rule } from "./types.js";
import { cellLineContext } from "./cell-line-context.js";

export class RuleEngine {
  private rules: Rule[] = [];
  private abnormalityRules: Rule[] = [];
  private karyotypeRules: Rule[] = [];

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  addRules(rules: Rule[]): void {
    this.rules.push(...rules);
  }

  addAbnormalityRule(rule: Rule): void {
    this.abnormalityRules.push(rule);
  }

  addAbnormalityRules(rules: Rule[]): void {
    this.abnormalityRules.push(...rules);
  }

  addKaryotypeRules(rules: Rule[]): void {
    this.karyotypeRules.push(...rules);
  }

  validate(ast: KaryotypeAST): ValidationResult {
    const errors = this.karyotypeRules.flatMap((rule) => rule.validate(ast, ast));
    if (ast.cell_lines?.length) {
      ast.cell_lines.forEach((line, index) => {
        const context = cellLineContext(ast, line);
        errors.push(...this.validateLine(context).map((error) => `Cell line ${index + 1}: ${error}`));
      });
    } else {
      errors.push(...this.validateLine(ast));
    }
    return { valid: errors.length === 0, errors, parsed: ast };
  }

  private validateLine(ast: KaryotypeAST): string[] {
    const allErrors: string[] = [];
    for (const rule of this.rules) {
      const errors = rule.validate(ast, ast);
      allErrors.push(...errors);
    }

    for (const abnormality of ast.abnormalities) {
      for (const rule of this.abnormalityRules) {
        const errors = rule.validate(ast, abnormality);
        allErrors.push(...errors);
      }
    }

    return allErrors;
  }
}
