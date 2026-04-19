/**
 * Admin CLI for API key management.
 *
 * Usage:
 *   deno task keys:create "acme-labs"                 # live key (default)
 *   deno task keys:create "acme-labs" --test          # test environment
 *   deno task keys:list
 *   deno task keys:revoke k_abc123
 *
 * Direct invocation:
 *   deno run --allow-read --allow-write --allow-env \
 *     --unstable-kv admin.ts <command> [args]
 *
 * KV path is taken from $KV_PATH (same as the server). Without $KV_PATH,
 * Deno.openKv() picks the default for the current environment (local file
 * store on macOS/Linux, managed KV on Deno Deploy).
 */

import { loadConfig } from "./lib/config.ts";
import {
  createKey,
  type KeyEnvironment,
  listKeys,
  revokeKey,
} from "./lib/keys.ts";

type Subcommand = "keys:create" | "keys:list" | "keys:revoke" | "help";

const USAGE = `\
Usage:
  admin.ts keys:create <label> [--test]
  admin.ts keys:list
  admin.ts keys:revoke <id>
  admin.ts help
`;

function die(msg: string, code = 1): never {
  console.error(msg);
  Deno.exit(code);
}

function parseArgs(argv: string[]): { cmd: Subcommand; rest: string[] } {
  const [cmd, ...rest] = argv;
  if (
    cmd === "keys:create" ||
    cmd === "keys:list" ||
    cmd === "keys:revoke" ||
    cmd === "help"
  ) {
    return { cmd, rest };
  }
  die(`Unknown command: ${cmd ?? "<none>"}\n${USAGE}`, 2);
}

async function cmdKeysCreate(kv: Deno.Kv, rest: string[]): Promise<void> {
  const label = rest.find((a) => !a.startsWith("--"));
  if (!label) die("keys:create requires a <label> argument.\n" + USAGE, 2);
  const env: KeyEnvironment = rest.includes("--test") ? "test" : "live";

  const { record, plaintext } = await createKey(kv, label, { env });
  console.log("");
  console.log(`  API key created (${env}):`);
  console.log("");
  console.log(`    ${plaintext}`);
  console.log("");
  console.log(`  id:       ${record.id}`);
  console.log(`  label:    ${record.label}`);
  console.log(`  created:  ${record.created_at}`);
  console.log("");
  console.log("  *** This is the only time the plaintext will be shown. ***");
  console.log("  *** Copy it now and store it in your password manager.  ***");
  console.log("");
}

async function cmdKeysList(kv: Deno.Kv): Promise<void> {
  const keys = await listKeys(kv);
  if (keys.length === 0) {
    console.log("No keys.");
    return;
  }
  const header = ["id", "label", "env", "created", "last_used", "revoked"];
  const rows = keys.map((k) => [
    k.id,
    k.label,
    k.env,
    k.created_at,
    k.last_used_at ?? "-",
    k.revoked_at ?? "-",
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );
  const fmt = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(fmt(header));
  console.log(fmt(widths.map((w) => "-".repeat(w))));
  for (const row of rows) console.log(fmt(row));
}

async function cmdKeysRevoke(kv: Deno.Kv, rest: string[]): Promise<void> {
  const id = rest[0];
  if (!id) die("keys:revoke requires an <id> argument.\n" + USAGE, 2);
  const record = await revokeKey(kv, id);
  if (record === null) die(`No key found with id ${id}`, 1);
  console.log(`Revoked ${record.id} at ${record.revoked_at}`);
}

if (import.meta.main) {
  const { cmd, rest } = parseArgs(Deno.args);
  if (cmd === "help") {
    console.log(USAGE);
    Deno.exit(0);
  }
  const cfg = loadConfig();
  const kv = cfg.kvPath !== null
    ? await Deno.openKv(cfg.kvPath)
    : await Deno.openKv();
  try {
    if (cmd === "keys:create") await cmdKeysCreate(kv, rest);
    else if (cmd === "keys:list") await cmdKeysList(kv);
    else if (cmd === "keys:revoke") await cmdKeysRevoke(kv, rest);
  } finally {
    kv.close();
  }
}
