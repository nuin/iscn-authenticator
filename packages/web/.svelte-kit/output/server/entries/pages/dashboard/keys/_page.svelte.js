import { e as escape_html, c as ensure_array_like, a as attr_class, b as attr } from "../../../../chunks/renderer.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, form } = $$props;
    function formatDate(ts) {
      if (!ts) return "Never";
      return new Date(ts * 1e3).toLocaleString();
    }
    $$renderer2.push(`<div class="keys-container"><header class="section-header svelte-swaeme"><h2 class="svelte-swaeme">API Keys</h2> <form method="POST" action="?/create"><button type="submit" class="btn btn-primary svelte-swaeme">Create New Key</button></form></header> `);
    if (form?.success && form.plaintext) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="plaintext-reveal svelte-swaeme"><strong class="svelte-swaeme">Save this key — it will only be shown once.</strong> <code class="svelte-swaeme">${escape_html(form.plaintext)}</code></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="keys-table-container"><table class="svelte-swaeme"><thead><tr><th class="svelte-swaeme">Label</th><th class="svelte-swaeme">ID</th><th class="svelte-swaeme">Created</th><th class="svelte-swaeme">Last Used</th><th class="svelte-swaeme">Action</th></tr></thead><tbody><!--[-->`);
    const each_array = ensure_array_like(data.keys);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let key = each_array[$$index];
      $$renderer2.push(`<tr${attr_class("svelte-swaeme", void 0, { "revoked": key.revoked_at })}><td class="svelte-swaeme">${escape_html(key.label)}</td><td class="mono svelte-swaeme">${escape_html(key.id.substring(0, 8))}...</td><td class="svelte-swaeme">${escape_html(formatDate(key.created_at))}</td><td class="svelte-swaeme">${escape_html(formatDate(key.last_used_at))}</td><td class="svelte-swaeme">`);
      if (key.revoked_at) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="revoked-tag svelte-swaeme">Revoked ${escape_html(formatDate(key.revoked_at))}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<form method="POST" action="?/revoke"><input type="hidden" name="key_id"${attr("value", key.id)}/> <button type="submit" class="btn btn-danger svelte-swaeme">Revoke</button></form>`);
      }
      $$renderer2.push(`<!--]--></td></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></div>`);
  });
}
export {
  _page as default
};
