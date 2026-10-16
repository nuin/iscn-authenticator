import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { validateKaryotypeNative } from "../../packages/core/src/index.ts";

function moduleUrl(source: string): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
}

Deno.test("embedded browser bundle loads and preserves validation results", async () => {
  const main = await Deno.readTextFile(new URL("../main.ts", import.meta.url));
  const match = main.match(/const staticAssets = (\{[\s\S]*?\n\});/);
  assert(match, "main.ts must contain the embedded browser assets");
  const { default: assets }: { default: Record<string, string> } = await import(
    moduleUrl(`export default ${match[1]}`)
  );
  const browser: { validateKaryotypeNative: typeof validateKaryotypeNative } = await import(
    moduleUrl(assets["/static/iscn-core.js"])
  );
  for (
    const karyotype of [
      "46,XX",
      "47,XY,+21",
      "46,XX,t(9;22)(q34;q11.2)",
      "46,XX,?del(5)(q13q33)matx2",
      "47,XY,+21[8]/46,XY[12]",
      "46,XX,inv(9)(p11)",
    ]
  ) {
    assertEquals(browser.validateKaryotypeNative(karyotype), validateKaryotypeNative(karyotype));
  }
});
