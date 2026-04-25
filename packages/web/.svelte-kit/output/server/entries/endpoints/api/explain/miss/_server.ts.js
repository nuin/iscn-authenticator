import { json } from "@sveltejs/kit";
const POST = async ({ request, platform }) => {
  const { signature } = await request.json();
  if (!signature) {
    return json({ error: "missing signature" }, { status: 400 });
  }
  const hash = await sha256Hex(signature);
  const log = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level: "info",
    event: "explain_miss",
    signature_hash: hash
  };
  console.log(JSON.stringify(log));
  return json({ ok: true });
};
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export {
  POST
};
