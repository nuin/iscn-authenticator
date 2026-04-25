import { e as escape_html } from "../../../chunks/renderer.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { form } = $$props;
    $$renderer2.push(`<div class="login-container svelte-1x05zx6"><div class="form-panel svelte-1x05zx6"><h2 class="svelte-1x05zx6">Log in</h2> <p class="muted svelte-1x05zx6">Enter any of your active API keys to access your dashboard.</p> <form method="POST">`);
    if (form?.error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="error svelte-1x05zx6">${escape_html(form.error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="input-group svelte-1x05zx6"><label for="api_key" class="svelte-1x05zx6">API Key</label> <input type="password" id="api_key" name="api_key" placeholder="iscn_live_..." autocomplete="current-password" spellcheck="false" required="" class="svelte-1x05zx6"/></div> <button type="submit" class="btn btn-primary svelte-1x05zx6">Log in</button></form> <p class="signup-prompt svelte-1x05zx6">Don't have an account? <a href="/signup">Sign up</a>.</p></div></div>`);
  });
}
export {
  _page as default
};
