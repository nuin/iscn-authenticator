import { e as escape_html, b as attr, c as ensure_array_like, a as attr_class, s as stringify } from "../../../../chunks/renderer.js";
import "../../../../chunks/validate.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let input = "";
    let results = [];
    let isProcessing = false;
    $$renderer2.push(`<h2>Batch Validation</h2> <p class="muted svelte-5d0z3k">Enter one karyotype per line (up to 500). Processing is done entirely in your browser.</p> <div class="input-area svelte-5d0z3k"><textarea placeholder="46,XX\\n47,XY,+21\\n..." spellcheck="false" autocomplete="off" class="svelte-5d0z3k">`);
    const $$body = escape_html(input);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <div class="actions svelte-5d0z3k"><button class="btn btn-primary svelte-5d0z3k"${attr("disabled", isProcessing, true)}>${escape_html("Run Batch")}</button> <button class="btn btn-outline svelte-5d0z3k">Clear</button> <div class="spacer svelte-5d0z3k"></div> <button class="btn svelte-5d0z3k"${attr("disabled", results.length === 0, true)}>Export CSV</button> <button class="btn svelte-5d0z3k"${attr("disabled", results.length === 0, true)}>Export JSON</button></div> `);
    if (results.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="results-container svelte-5d0z3k"><h3>Results (${escape_html(results.length)})</h3> <div class="table-scroll svelte-5d0z3k"><table class="svelte-5d0z3k"><thead><tr><th class="svelte-5d0z3k">Karyotype</th><th class="svelte-5d0z3k">Status</th><th class="svelte-5d0z3k">Explanation / Errors</th></tr></thead><tbody><!--[-->`);
      const each_array = ensure_array_like(results);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let row = each_array[$$index];
        $$renderer2.push(`<tr><td class="mono svelte-5d0z3k">${escape_html(row.karyotype)}</td><td class="svelte-5d0z3k"><span${attr_class(`tag ${stringify(row.valid ? "valid" : "invalid")}`, "svelte-5d0z3k")}>${escape_html(row.valid ? "VALID" : "INVALID")}</span></td><td class="explanation svelte-5d0z3k">${escape_html(row.explanation)}</td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
