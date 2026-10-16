#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * ISCN Karyotype Validator CLI
 *
 * Usage:
 *   deno task cli "46,XX"
 *   deno task cli "47,XY,+21" --json
 *   deno task cli --help
 */

import { validateKaryotypeNative } from "./lib/validator.ts";
import type { ValidationResult } from "../packages/core/src/types.ts";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// Check if colors should be used
const useColors = Deno.stdout.isTerminal();

function color(text: string, ...codes: string[]): string {
  if (!useColors) return text;
  return codes.join("") + text + colors.reset;
}

function printHelp(): void {
  console.error(`
${color("ISCN Karyotype Validator", colors.bold, colors.cyan)}

${color("USAGE:", colors.bold)}
  deno task cli <karyotype> [options]
  deno task cli "46,XX"
  deno task cli "47,XY,+21" --json

${color("OPTIONS:", colors.bold)}
  --json      Output result as JSON
  --verbose   Show detailed parsed information
  --help      Show this help message

${color("EXAMPLES:", colors.bold)}
  ${color("Normal female:", colors.dim)}
    deno task cli "46,XX"

  ${color("Trisomy 21 (Down syndrome):", colors.dim)}
    deno task cli "47,XY,+21"

  ${color("Turner syndrome:", colors.dim)}
    deno task cli "45,X"

  ${color("Deletion:", colors.dim)}
    deno task cli "46,XX,del(5)(q13q33)"

  ${color("Philadelphia chromosome:", colors.dim)}
    deno task cli "46,XX,t(9;22)(q34;q11.2)"

${color("EXIT CODES:", colors.bold)}
  0  Valid karyotype
  1  Invalid karyotype
  2  Error
`);
}
function printHumanReadable(karyotype: string, result: ValidationResult, verbose: boolean): void {
  console.log(color(`Karyotype: ${karyotype}`, colors.bold));
  if (result.valid) {
    console.log(color("  VALID", colors.bold, colors.green));
  } else {
    console.error(color("  INVALID", colors.bold, colors.red));
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(color("  - ", colors.red) + error);
    }
  }

  if (verbose && result.parsed) {
    const parsed = result.parsed;
    console.log(`Chromosome count: ${parsed.chromosome_count ?? "not specified"}`);
    console.log(`Sex chromosomes: ${parsed.sex_chromosomes || "not specified"}`);
    if (parsed.abnormalities.length > 0) {
      console.log("Abnormalities:");
      for (const abn of parsed.abnormalities) {
        console.log(`  - ${abn.raw}`);
      }
    } else {
      console.log("Abnormalities: none");
    }
    if (parsed.cell_lines && parsed.cell_lines.length > 0) {
      console.log(`Cell lines: ${parsed.cell_lines.length}`);
      for (const line of parsed.cell_lines) {
        const notation = [
          line.chromosome_count,
          line.sex_chromosomes,
          ...line.abnormalities.map((abnormality) => abnormality.raw),
        ].join(",");
        console.log(`  - ${notation}[${line.count}]${line.is_donor ? " (donor)" : ""}`);
      }
    }
    if (parsed.modifiers && Object.keys(parsed.modifiers).length > 0) {
      console.log(`Modifiers: ${JSON.stringify(parsed.modifiers)}`);
    }
  }
}

async function main(): Promise<void> {
  const args = Deno.args;

  const jsonOutput = args.includes("--json");
  const verbose = args.includes("--verbose") || args.includes("-v");
  const help = args.includes("--help") || args.includes("-h");

  // Get karyotype (first non-flag argument)
  const karyotype = args.find((arg) => !arg.startsWith("-"));

  if (help || !karyotype) {
    printHelp();
    Deno.exit(help ? 0 : 2);
  }

  try {
    const result = validateKaryotypeNative(karyotype);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHumanReadable(karyotype, result, verbose);
    }

    Deno.exit(result.valid ? 0 : 1);
  } catch (error) {
    if (jsonOutput) {
      console.error(
        JSON.stringify({
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
          parsed: null,
        }),
      );
    } else {
      console.error(
        color("Error:", colors.bold, colors.red),
        error instanceof Error ? error.message : String(error),
      );
    }
    Deno.exit(2);
  }
}

main();
