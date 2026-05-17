import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { createAxiomSink, tee } from "../lib/axiom.ts";

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Build a mock fetch that records every call and returns a configurable
 * response. Defaults to 204.
 */
function mockFetch(
  opts: { status?: number; throws?: boolean; capture: CapturedCall[] },
): typeof fetch {
  const impl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    const headersObj: Record<string, string> = {};
    const hdrs = new Headers(init?.headers);
    hdrs.forEach((v, k) => {
      headersObj[k] = v;
    });
    const body = typeof init?.body === "string" ? init.body : "";
    opts.capture.push({
      url,
      method: init?.method ?? "GET",
      headers: headersObj,
      body,
    });
    if (opts.throws) throw new Error("network down");
    return new Response(null, { status: opts.status ?? 204 });
  };
  return impl as unknown as typeof fetch;
}

Deno.test("createAxiomSink: flush emits NDJSON with bearer token to dataset url", async () => {
  const capture: CapturedCall[] = [];
  const errors: unknown[] = [];
  const sink = createAxiomSink({
    token: "xaat-abc",
    dataset: "iscn-test",
    fetchImpl: mockFetch({ capture }),
    onError: (e) => errors.push(e),
    flushMs: 999_999, // disable timer for this test
  });

  sink.log(JSON.stringify({ a: 1 }));
  sink.log(JSON.stringify({ b: 2 }));
  await sink.flush();
  await sink.stop();

  assertEquals(capture.length, 1);
  assertEquals(errors.length, 0);
  const call = capture[0];
  assertEquals(call.method, "POST");
  assertEquals(call.url, "https://api.axiom.co/v1/datasets/iscn-test/ingest");
  assertEquals(call.headers["authorization"], "Bearer xaat-abc");
  assertEquals(call.headers["content-type"], "application/x-ndjson");
  assertEquals(call.body, `{"a":1}\n{"b":2}`);
});

Deno.test("createAxiomSink: dataset name is URL-encoded", async () => {
  const capture: CapturedCall[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "has spaces/slash",
    fetchImpl: mockFetch({ capture }),
    flushMs: 999_999,
  });
  sink.log("x");
  await sink.flush();
  await sink.stop();
  assertEquals(
    capture[0].url,
    "https://api.axiom.co/v1/datasets/has%20spaces%2Fslash/ingest",
  );
});

Deno.test("createAxiomSink: flushes when buffer reaches maxBuffer", async () => {
  const capture: CapturedCall[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    maxBuffer: 3,
    flushMs: 999_999,
    fetchImpl: mockFetch({ capture }),
  });
  sink.log("1");
  sink.log("2");
  assertEquals(capture.length, 0);
  sink.log("3"); // triggers async flush
  // Allow microtask queue to run the fire-and-forget flush.
  await new Promise((r) => setTimeout(r, 10));
  assertEquals(capture.length, 1);
  assertEquals(capture[0].body, "1\n2\n3");
  await sink.stop();
});

Deno.test("createAxiomSink: empty buffer flush is a no-op", async () => {
  const capture: CapturedCall[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    fetchImpl: mockFetch({ capture }),
    flushMs: 999_999,
  });
  await sink.flush();
  await sink.stop();
  assertEquals(capture.length, 0);
});

Deno.test("createAxiomSink: fetch failure invokes onError without throwing", async () => {
  const capture: CapturedCall[] = [];
  const errors: unknown[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    fetchImpl: mockFetch({ capture, throws: true }),
    onError: (e) => errors.push(e),
    flushMs: 999_999,
  });
  sink.log("x");
  await sink.flush(); // should not throw
  await sink.stop();
  assertEquals(errors.length, 1);
});

Deno.test("createAxiomSink: non-2xx status invokes onError", async () => {
  const capture: CapturedCall[] = [];
  const errors: unknown[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    fetchImpl: mockFetch({ capture, status: 500 }),
    onError: (e) => errors.push(e),
    flushMs: 999_999,
  });
  sink.log("x");
  await sink.flush();
  await sink.stop();
  assertEquals(errors.length, 1);
  assert(String(errors[0]).includes("500"));
});

Deno.test("createAxiomSink: stop() drains remaining buffer", async () => {
  const capture: CapturedCall[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    fetchImpl: mockFetch({ capture }),
    flushMs: 999_999,
  });
  sink.log("a");
  sink.log("b");
  await sink.stop();
  assertEquals(capture.length, 1);
  assertEquals(capture[0].body, "a\nb");
  // Post-stop logs are dropped.
  sink.log("c");
  await sink.flush();
  assertEquals(capture.length, 1);
});

Deno.test("createAxiomSink: throws if token or dataset missing", () => {
  let threw = 0;
  try {
    createAxiomSink({ token: "", dataset: "d" });
  } catch {
    threw++;
  }
  try {
    createAxiomSink({ token: "t", dataset: "" });
  } catch {
    threw++;
  }
  assertEquals(threw, 2);
});

Deno.test("createAxiomSink: timer-driven flush fires after flushMs elapses", async () => {
  const capture: CapturedCall[] = [];
  const sink = createAxiomSink({
    token: "t",
    dataset: "d",
    fetchImpl: mockFetch({ capture }),
    flushMs: 20,
  });
  sink.log("x");
  // Let the timer fire at least once.
  await new Promise((r) => setTimeout(r, 60));
  await sink.stop();
  assert(capture.length >= 1);
  assertEquals(capture[0].body, "x");
});

Deno.test("tee: forwards line to every underlying sink", () => {
  const a: string[] = [];
  const b: string[] = [];
  const sink = tee((l) => a.push(l), (l) => b.push(l));
  sink("one");
  sink("two");
  assertEquals(a, ["one", "two"]);
  assertEquals(b, ["one", "two"]);
});

Deno.test("tee: one sink throwing does not block the others", () => {
  const good: string[] = [];
  const sink = tee(
    () => {
      throw new Error("boom");
    },
    (l) => good.push(l),
  );
  sink("hello");
  assertEquals(good, ["hello"]);
});
