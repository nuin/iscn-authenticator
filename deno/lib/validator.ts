/**
 * Karyotype validation module.
 * Supports two modes:
 * - HTTP API: Set ISCN_API_URL environment variable
 * - Subprocess: Calls Python validator directly (default for local dev)
 */

import type { ValidationResult } from "./types.ts";

/** Configuration for the validator */
interface ValidatorConfig {
  apiUrl?: string;
  pythonCmd?: string;
  timeout?: number;
  scriptPath?: string;
}

/** Get the API URL if configured */
function getApiUrl(config?: string): string | undefined {
  if (config) return config;
  return Deno.env.get("ISCN_API_URL");
}

/** Validate via HTTP API */
async function validateViaApi(
  karyotype: string,
  apiUrl: string,
  timeout: number
): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karyotype }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        valid: false,
        errors: [`API error (${response.status}): ${text}`],
        parsed: null,
      };
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        errors: ["API request timed out"],
        parsed: null,
      };
    }
    return {
      valid: false,
      errors: [`API request failed: ${error instanceof Error ? error.message : String(error)}`],
      parsed: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Get the Python command to use */
async function getPythonCommand(preferred?: string): Promise<string> {
  if (preferred) return preferred;

  // Check environment variable
  const envPython = Deno.env.get("PYTHON_CMD");
  if (envPython) return envPython;

  // Try python3 first, then python
  for (const cmd of ["python3", "python"]) {
    try {
      const process = new Deno.Command(cmd, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      });
      const { success } = await process.output();
      if (success) return cmd;
    } catch {
      // Command not found, try next
    }
  }

  throw new Error("Python not found. Install Python 3 or set PYTHON_CMD environment variable.");
}

/** Get the path to the validation script */
function getScriptPath(customPath?: string): string {
  if (customPath) return customPath;

  // Get the directory of this module and navigate to scripts
  const moduleUrl = new URL(import.meta.url);
  const modulePath = moduleUrl.pathname;
  const projectRoot = modulePath.replace(/\/deno\/lib\/validator\.ts$/, "");
  return `${projectRoot}/scripts/validate_json.py`;
}

/** Validate via Python subprocess */
async function validateViaSubprocess(
  karyotype: string,
  config: ValidatorConfig
): Promise<ValidationResult> {
  const { timeout = 10000 } = config;

  try {
    const pythonCmd = await getPythonCommand(config.pythonCmd);
    const scriptPath = getScriptPath(config.scriptPath);

    const command = new Deno.Command(pythonCmd, {
      args: [scriptPath, karyotype],
      stdout: "piped",
      stderr: "piped",
    });

    const timeoutId = setTimeout(() => {}, timeout);

    try {
      const process = command.spawn();
      const { stdout, stderr } = await process.output();

      clearTimeout(timeoutId);

      const output = new TextDecoder().decode(stdout);
      const errorOutput = new TextDecoder().decode(stderr);

      if (errorOutput && !output) {
        return {
          valid: false,
          errors: [`Python error: ${errorOutput}`],
          parsed: null,
        };
      }

      if (!output.trim()) {
        return {
          valid: false,
          errors: ["No output from validator"],
          parsed: null,
        };
      }

      const result: ValidationResult = JSON.parse(output);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        valid: false,
        errors: [`Invalid JSON from validator: ${error.message}`],
        parsed: null,
      };
    }
    return {
      valid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
      parsed: null,
    };
  }
}

/**
 * Validate a karyotype string.
 *
 * Uses HTTP API if ISCN_API_URL is set, otherwise uses Python subprocess.
 *
 * @param karyotype - The karyotype string to validate (e.g., "46,XX")
 * @param config - Optional configuration
 * @returns ValidationResult with valid flag, errors, and parsed AST
 */
export async function validateKaryotype(
  karyotype: string,
  config: ValidatorConfig = {}
): Promise<ValidationResult> {
  const { timeout = 10000 } = config;
  const apiUrl = getApiUrl(config.apiUrl);

  if (apiUrl) {
    return validateViaApi(karyotype, apiUrl, timeout);
  }

  return validateViaSubprocess(karyotype, config);
}

/**
 * Simple boolean validation check.
 *
 * @param karyotype - The karyotype string to validate
 * @returns true if valid, false otherwise
 */
export async function isValidKaryotype(karyotype: string): Promise<boolean> {
  const result = await validateKaryotype(karyotype);
  return result.valid;
}
