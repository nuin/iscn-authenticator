import { e as escape_html, c as ensure_array_like, b as attr, s as stringify } from "../../../../chunks/renderer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<nav class="breadcrumb svelte-1y7uxcj"><a href="/explain" class="svelte-1y7uxcj">← All Explanations</a></nav> <h2 class="mono svelte-1y7uxcj">${escape_html(data.signature)}</h2> <div class="explain-card svelte-1y7uxcj"><p class="summary svelte-1y7uxcj"><strong>${escape_html(data.entry.summary)}</strong></p> <p class="detail svelte-1y7uxcj">${escape_html(data.entry.detail)}</p> `);
    if (data.entry.citation) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="citation svelte-1y7uxcj"><em>Source: ISCN 2024 § ${escape_html(data.entry.citation.section)}${escape_html(data.entry.citation.page ? `, p. ${data.entry.citation.page}` : "")}</em></p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (data.entry.refs) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="references svelte-1y7uxcj"><h3 class="svelte-1y7uxcj">References</h3> <ul class="svelte-1y7uxcj">`);
      if (data.entry.refs.omim) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(data.entry.refs.omim);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let id = each_array[$$index];
          $$renderer2.push(`<li class="svelte-1y7uxcj">OMIM: <a${attr("href", `https://omim.org/entry/${stringify(id)}`)} target="_blank">${escape_html(id)}</a></li>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.entry.refs.hpo) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(data.entry.refs.hpo);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let id = each_array_1[$$index_1];
          $$renderer2.push(`<li class="svelte-1y7uxcj">HPO: <a${attr("href", `https://hpo.jax.org/app/browse/term/${stringify(id)}`)} target="_blank">${escape_html(id)}</a></li>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="actions svelte-1y7uxcj"><a${attr("href", `/?karyotype=${stringify(encodeURIComponent(data.signature))}`)} class="btn btn-primary svelte-1y7uxcj">Validate this Karyotype</a></div>`);
  });
}
export {
  _page as default
};
