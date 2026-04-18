/**
 * Rule engine for applying validation rules to karyotype AST.
 * Port of iscn_authenticator/engine.py to TypeScript.
 */

import type { KaryotypeAST, ValidationResult, Rule } from "./types.ts";

export class RuleEngine {
  private rules: Rule[] = [];
  private abnormalityRules: Rule[] = [];

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

  validate(ast: KaryotypeAST): ValidationResult {
    const allErrors: string[] = [];

    // Apply AST-level rules
    for (const rule of this.rules) {
      const errors = rule.validate(ast, ast);
      allErrors.push(...errors);
    }

    // Apply abnormality rules to each abnormality
    for (const abnormality of ast.abnormalities) {
      for (const rule of this.abnormalityRules) {
        const errors = rule.validate(ast, abnormality);
        allErrors.push(...errors);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      parsed: ast,
    };
  }
}
