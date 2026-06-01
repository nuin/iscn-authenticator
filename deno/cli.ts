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
import type { Abnormality, ValidationResult } from "../packages/core/src/types.ts";

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

function formatAbnormality(abn: Abnormality): string {
  const parts: string[] = [];

  switch (abn.type) {
    case "+":
      parts.push(`Gain of chromosome ${abn.chromosome}`);
      break;
    case "-":
      parts.push(`Loss of chromosome ${abn.chromosome}`);
      break;
    case "del":
      parts.push(`Deletion on chromosome ${abn.chromosome}`);
      break;
    case "dup":
      parts.push(`Duplication on chromosome ${abn.chromosome}`);
      break;
    case "inv":
      parts.push(`Inversion on chromosome ${abn.chromosome}`);
      break;
    case "t":
      parts.push(`Translocation involving chromosomes ${abn.chromosome}`);
      break;
    case "i":
      parts.push(`Isochromosome ${abn.chromosome}`);
      break;
    case "r":
      parts.push(`Ring chromosome ${abn.chromosome}`);
      break;
    default:
      parts.push(`${abn.type} on chromosome ${abn.chromosome}`);
  }

  if (abn.breakpoints.length > 0) {
    const bps = abn.breakpoints
      .map((bp) => {
        let s = bp.arm + (bp.region ?? "") + (bp.band ?? "");
        if (bp.subband) s += "." + bp.subband;
        return s;
      })
      .join(", ");
    parts.push(`at ${bps}`);
  }

  if (abn.inheritance) {
    const inhMap: Record<string, string> = {
      mat: "maternal",
      pat: "paternal",
      dn: "de novo",
    };
    parts.push(`(${inhMap[abn.inheritance] ?? abn.inheritance})`);
  }

  return parts.join(" ");
}

function printHumanReadable(karyotype: string, result: ValidationResult, verbose: boolean): void {

  if (result.valid) {
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

    if (parsed.abnormalities.length > 0) {
      for (const abn of parsed.abnormalities) {
      }
    } else {
    }

    if (parsed.cell_lines && parsed.cell_lines.length > 0) {
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
