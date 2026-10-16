import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { createCustomer } from "../lib/customers.ts";
import { createKey, lookupKeyByPlaintext } from "../lib/keys.ts";

async function runCommand(script: string, args: string[], kvPath = ":memory:") {
  const result = await new Deno.Command("deno", {
    args: [
      "run",
      "--no-prompt",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--unstable-kv",
      "--unstable-sloppy-imports",
      new URL(`../${script}.ts`, import.meta.url).pathname,
      ...args,
    ],
    clearEnv: true,
    env: {
      PATH: Deno.env.get("PATH") ?? "",
      KV_PATH: kvPath,
      SESSION_SECRET: "command-output-test-secret",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  return {
    code: result.code,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  };
}

async function withStore(test: (path: string) => Promise<void>): Promise<void> {
  const directory = await Deno.makeTempDir();
  try {
    await test(`${directory}/admin.sqlite`);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test("CLI reports the input and valid result to stdout", async () => {
  const output = await runCommand("cli", ["46,XX"]);
  assertEquals(output.code, 0);
  assertStringIncludes(output.stdout, "46,XX");
  assertMatch(output.stdout, /\bVALID\b/);
});

Deno.test("CLI reports the invalid input and validation errors", async () => {
  const output = await runCommand("cli", ["46,ZZ"]);
  assertEquals(output.code, 1);
  assertStringIncludes(output.stdout, "46,ZZ");
  assertStringIncludes(output.stderr, "INVALID");
  assertMatch(output.stderr, /- .+/);
});

Deno.test("CLI verbose output describes parsed chromosomes and abnormalities", async () => {
  const output = await runCommand("cli", ["46,XX,del(5)(q13q33)mat", "--verbose"]);
  assertEquals(output.code, 0);
  assertMatch(output.stdout, /Chromosome count:\s+46/);
  assertMatch(output.stdout, /Sex chromosomes:\s+XX/);
  assertStringIncludes(output.stdout, "del(5)(q13q33)mat");
});

Deno.test("CLI verbose output reports normal and mosaic parsed information", async () => {
  const normal = await runCommand("cli", ["46,XX", "--verbose"]);
  assertStringIncludes(normal.stdout, "Abnormalities: none");
  const mosaic = await runCommand("cli", ["45,X[10]/46,XX[20]", "--verbose"]);
  assertEquals(mosaic.code, 0);
  assertMatch(mosaic.stdout, /Cell lines:\s+2/);
  assertStringIncludes(mosaic.stdout, "45,X[10]");
  assertStringIncludes(mosaic.stdout, "46,XX[20]");
});

Deno.test("CLI JSON output remains machine readable", async () => {
  const output = await runCommand("cli", ["47,XY,+21", "--json"]);
  assertEquals(output.code, 0);
  const result = JSON.parse(output.stdout);
  assertEquals(result.valid, true);
  assertEquals(result.parsed.chromosome_count, 47);
});

Deno.test("admin help shows supported commands without opening a store", async () => {
  const output = await runCommand("admin", ["help"], "/missing-directory/admin.sqlite");
  assertEquals(output.code, 0);
  assertStringIncludes(output.stdout, "keys:create");
  assertStringIncludes(output.stdout, "customers:tier");
});

Deno.test("admin empty lists give explicit feedback", async () => {
  const keys = await runCommand("admin", ["keys:list"]);
  assertEquals(keys.code, 0);
  assertMatch(keys.stdout, /No .*keys/i);
  const customers = await runCommand("admin", ["customers:list"]);
  assertEquals(customers.code, 0);
  assertMatch(customers.stdout, /No customers/i);
});

Deno.test("admin key creation reveals a usable plaintext once and lists safe metadata", async () => {
  await withStore(async (path) => {
    const output = await runCommand("admin", ["keys:create", "smoke-test", "--test"], path);
    assertEquals(output.code, 0);
    const plaintexts = output.stdout.match(/iscn_test_[0-9a-f]{32}/g);
    assert(plaintexts !== null);
    assertEquals(plaintexts.length, 1);
    const kv = await Deno.openKv(path);
    let id: string;
    try {
      const record = await lookupKeyByPlaintext(kv, plaintexts[0]);
      assert(record !== null);
      id = record.id;
    } finally {
      kv.close();
    }
    assertStringIncludes(output.stdout, id);
    const list = await runCommand("admin", ["keys:list"], path);
    assertEquals(list.code, 0);
    assertStringIncludes(list.stdout, id);
    assertStringIncludes(list.stdout, "smoke-test");
    assertStringIncludes(list.stdout, "test");
    assert(!list.stdout.includes(plaintexts[0]));
  });
});

Deno.test("admin customer creation and lists expose identity and tier", async () => {
  await withStore(async (path) => {
    const output = await runCommand("admin", ["customers:create", "ALICE@example.com"], path);
    assertEquals(output.code, 0);
    assertMatch(output.stdout, /c_[0-9a-f]{16}/);
    assertStringIncludes(output.stdout, "alice@example.com");
    assertStringIncludes(output.stdout, "free");
    const list = await runCommand("admin", ["customers:list"], path);
    assertEquals(list.code, 0);
    assertStringIncludes(list.stdout, "alice@example.com");
    assertStringIncludes(list.stdout, "free");
    assertStringIncludes(list.stdout, "active");
  });
});

Deno.test("admin confirms key revocation and customer tier changes", async () => {
  await withStore(async (path) => {
    const kv = await Deno.openKv(path);
    let keyId: string;
    let customerId: string;
    try {
      const customer = await createCustomer(kv, "tier@example.com");
      assert(customer !== null);
      customerId = customer.id;
      const { record } = await createKey(kv, "revoke-test");
      keyId = record.id;
    } finally {
      kv.close();
    }
    const revoke = await runCommand("admin", ["keys:revoke", keyId], path);
    assertEquals(revoke.code, 0);
    assertStringIncludes(revoke.stdout, keyId);
    assertMatch(revoke.stdout, /revoked/i);
    const tier = await runCommand("admin", ["customers:tier", customerId, "pro"], path);
    assertEquals(tier.code, 0);
    assertStringIncludes(tier.stdout, customerId);
    assertStringIncludes(tier.stdout, "pro");
  });
});
