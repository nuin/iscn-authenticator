/**
 * Admin CLI for API key and customer management.
 *
 * Usage:
 *   deno task keys:create "acme-labs"                      # live key, no customer
 *   deno task keys:create "acme-labs" --test               # test environment
 *   deno task keys:create "acme-labs" --customer c_abc...  # owned by a customer
 *   deno task keys:list
 *   deno task keys:revoke k_abc123
 *
 *   deno task customers:create alice@example.com
 *   deno task customers:list
 *   deno task customers:tier c_abc... pro
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
import {
  createCustomer,
  type CustomerTier,
  listCustomers,
  lookupCustomerById,
  updateCustomerTier,
} from "./lib/customers.ts";

type Subcommand =
  | "keys:create"
  | "keys:list"
  | "keys:revoke"
  | "customers:create"
  | "customers:list"
  | "customers:tier"
  | "help";

const VALID_CMDS: Subcommand[] = [
  "keys:create",
  "keys:list",
  "keys:revoke",
  "customers:create",
  "customers:list",
  "customers:tier",
  "help",
];

const USAGE = `\
Usage:
  admin.ts keys:create <label> [--test] [--customer <id>]
  admin.ts keys:list
  admin.ts keys:revoke <id>
  admin.ts customers:create <email>
  admin.ts customers:list
  admin.ts customers:tier <id> <free|pro>
  admin.ts help
`;

function die(msg: string, code = 1): never {
  console.error(msg);
  Deno.exit(code);
}

function parseArgs(argv: string[]): { cmd: Subcommand; rest: string[] } {
  const [cmd, ...rest] = argv;
  if ((VALID_CMDS as string[]).includes(cmd)) {
    return { cmd: cmd as Subcommand, rest };
  }
  die(`Unknown command: ${cmd ?? "<none>"}\n${USAGE}`, 2);
}

/** Extract `--flag <value>` from argv, returning [value, argvWithoutFlag]. */
function takeOption(argv: string[], flag: string): [string | null, string[]] {
  const idx = argv.indexOf(flag);
  if (idx === -1) return [null, argv];
  const value = argv[idx + 1];
  if (value === undefined || value.startsWith("--")) {
    die(`Flag ${flag} requires a value.\n${USAGE}`, 2);
  }
  return [value, [...argv.slice(0, idx), ...argv.slice(idx + 2)]];
}

async function cmdKeysCreate(kv: Deno.Kv, rest: string[]): Promise<void> {
  const [customerId, without] = takeOption(rest, "--customer");
  const label = without.find((a) => !a.startsWith("--"));
  if (!label) die("keys:create requires a <label> argument.\n" + USAGE, 2);
  const env: KeyEnvironment = without.includes("--test") ? "test" : "live";

  // If a customer id was passed, confirm it exists — it's a much better
  // UX than silently minting an orphan key whose denorm entry dangles.
  if (customerId !== null) {
    const existing = await lookupCustomerById(kv, customerId);
    if (existing === null) {
      die(`No customer with id ${customerId}. Create one with customers:create.`, 1);
    }
  }

  const { record, plaintext } = await createKey(kv, label, { env, customerId });
  console.log("");
  console.log(`  API key created (${env}):`);
  console.log("");
  console.log(`    ${plaintext}`);
  console.log("");
  console.log(`  id:         ${record.id}`);
  console.log(`  label:      ${record.label}`);
  console.log(`  created:    ${record.created_at}`);
  console.log(`  customer:   ${record.customer_id ?? "- (internal)"}`);
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
  const header = ["id", "label", "env", "customer", "created", "last_used", "revoked"];
  const rows = keys.map((k) => [
    k.id,
    k.label,
    k.env,
    k.customer_id ?? "-",
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

async function cmdCustomersCreate(kv: Deno.Kv, rest: string[]): Promise<void> {
  const email = rest.find((a) => !a.startsWith("--"));
  if (!email) die("customers:create requires an <email> argument.\n" + USAGE, 2);
  let record;
  try {
    record = await createCustomer(kv, email);
  } catch (err) {
    die(`customers:create failed: ${(err as Error).message}`, 1);
  }
  if (record === null) {
    die(`Email already taken: ${email}`, 1);
  }
  console.log("");
  console.log(`  Customer created:`);
  console.log("");
  console.log(`  id:         ${record.id}`);
  console.log(`  email:      ${record.email}`);
  console.log(`  tier:       ${record.tier}`);
  console.log(`  status:     ${record.status}`);
  console.log(`  created:    ${record.created_at}`);
  console.log("");
  console.log(
    `  Next step:  deno task keys:create "<label>" --customer ${record.id}`,
  );
  console.log("");
}

async function cmdCustomersList(kv: Deno.Kv): Promise<void> {
  const customers = await listCustomers(kv);
  if (customers.length === 0) {
    console.log("No customers.");
    return;
  }
  const header = ["id", "email", "tier", "status", "stripe", "created"];
  const rows = customers.map((c) => [
    c.id,
    c.email,
    c.tier,
    c.status,
    c.stripe_customer_id ?? "-",
    c.created_at,
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

async function cmdCustomersTier(kv: Deno.Kv, rest: string[]): Promise<void> {
  const [id, tier] = rest;
  if (!id || !tier) {
    die("customers:tier requires <id> <free|pro>.\n" + USAGE, 2);
  }
  if (tier !== "free" && tier !== "pro") {
    die(`Invalid tier: ${tier}. Expected free or pro.`, 2);
  }
  const updated = await updateCustomerTier(kv, id, tier as CustomerTier);
  if (updated === null) die(`No customer with id ${id}`, 1);
  console.log(`Set ${updated.id} tier=${updated.tier}`);
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
    else if (cmd === "customers:create") await cmdCustomersCreate(kv, rest);
    else if (cmd === "customers:list") await cmdCustomersList(kv);
    else if (cmd === "customers:tier") await cmdCustomersTier(kv, rest);
  } finally {
    kv.close();
  }
}
