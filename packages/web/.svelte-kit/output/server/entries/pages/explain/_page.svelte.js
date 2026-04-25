import { c as ensure_array_like, b as attr, e as escape_html, s as stringify } from "../../../chunks/renderer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<h2>Curated ISCN Explanations</h2> <p>A library of human-curated explanations for common ISCN 2024 karyotype strings.</p> <ul class="explain-list svelte-1er7iao"><!--[-->`);
    const each_array = ensure_array_like(data.signatures);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let sig = each_array[$$index];
      $$renderer2.push(`<li class="svelte-1er7iao"><a${attr("href", `/explain/${stringify(encodeURIComponent(sig))}`)} class="svelte-1er7iao">${escape_html(sig)}</a></li>`);
    }
    $$renderer2.push(`<!--]--></ul>`);
  });
}
export {
  _page as default
};
