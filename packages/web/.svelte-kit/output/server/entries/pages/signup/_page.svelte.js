import { e as escape_html, b as attr } from "../../../chunks/renderer.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { form } = $$props;
    $$renderer2.push(`<div class="signup-container svelte-kmqcod">`);
    if (form?.success) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="success-panel svelte-kmqcod"><h2 class="svelte-kmqcod">Account created</h2> <dl class="kv svelte-kmqcod"><dt class="svelte-kmqcod">Email</dt> <dd class="svelte-kmqcod">${escape_html(form.email)}</dd> <dt class="svelte-kmqcod">Tier</dt> <dd class="svelte-kmqcod">free</dd> <dt class="svelte-kmqcod">Key id</dt> <dd class="svelte-kmqcod">${escape_html(form.keyId)}</dd></dl> <div class="plaintext-reveal svelte-kmqcod"><strong class="svelte-kmqcod">Save this key — it will only be shown once.</strong> <code class="svelte-kmqcod">${escape_html(form.plaintext)}</code></div> <p class="muted svelte-kmqcod">We never store the plaintext. If you lose it, rotate the key from the dashboard.</p> <div class="actions svelte-kmqcod"><a href="/dashboard" class="btn btn-primary svelte-kmqcod">Continue to dashboard</a></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="form-panel svelte-kmqcod"><h2 class="svelte-kmqcod">Create an account</h2> <p class="muted svelte-kmqcod">Free tier — 1,000 requests per month. No credit card required.</p> <form method="POST">`);
      if (form?.error) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="error svelte-kmqcod">${escape_html(form.error)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="input-group svelte-kmqcod"><label for="email" class="svelte-kmqcod">Email</label> <input type="email" id="email" name="email"${attr("value", form?.email ?? "")} autocomplete="email" spellcheck="false" required="" class="svelte-kmqcod"/></div> <button type="submit" class="btn btn-primary svelte-kmqcod">Sign up</button></form> <p class="login-prompt svelte-kmqcod">Already have a key? <a href="/login">Log in</a>.</p></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
