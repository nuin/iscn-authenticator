import { b as attr, e as escape_html, c as ensure_array_like } from "../../chunks/renderer.js";
import "../../chunks/validate.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let karyotype = "";
    let isValidating = false;
    const examples = [
      { label: "Normal female", value: "46,XX" },
      { label: "Normal male", value: "46,XY" },
      { label: "Trisomy 21", value: "47,XY,+21" },
      { label: "Turner", value: "45,X" },
      { label: "Deletion", value: "46,XX,del(5)(q13q33)" },
      { label: "Translocation", value: "46,XX,t(9;22)(q34;q11.2)" }
    ];
    $$renderer2.push(`<header class="svelte-1uha8ag"><h1>ISCN Karyotype Validator</h1> <p class="subtitle svelte-1uha8ag">Validate International System for Human Cytogenomic Nomenclature strings</p></header> <section class="validator-card svelte-1uha8ag"><form><div class="input-group svelte-1uha8ag"><label for="karyotype" class="svelte-1uha8ag">Karyotype String</label> <div class="input-row svelte-1uha8ag"><input type="text" id="karyotype"${attr("value", karyotype)} placeholder="e.g., 46,XX or 47,XY,+21" autocomplete="off" spellcheck="false" required="" class="svelte-1uha8ag"/> <button type="submit"${attr("disabled", isValidating, true)} class="svelte-1uha8ag">${escape_html("Validate")}</button></div></div></form> <div class="examples svelte-1uha8ag"><span class="examples-label svelte-1uha8ag">Examples:</span> <!--[-->`);
    const each_array = ensure_array_like(examples);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let ex = each_array[$$index];
      $$renderer2.push(`<button type="button" class="link-btn svelte-1uha8ag">${escape_html(ex.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></section> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
