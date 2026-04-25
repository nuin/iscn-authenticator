import "clsx";
function _layout($$renderer, $$props) {
  let { children } = $$props;
  $$renderer.push(`<nav class="nav-bar svelte-12qhfyh"><div class="nav-content svelte-12qhfyh"><a href="/" class="brand svelte-12qhfyh">ISCN Authenticator</a> <div class="nav-links svelte-12qhfyh"><a href="/explain" class="svelte-12qhfyh">Library</a> <a href="/pricing" class="svelte-12qhfyh">Pricing</a> <a href="/docs" class="svelte-12qhfyh">API</a> <a href="/dashboard" class="svelte-12qhfyh">Dashboard</a></div></div></nav> <div class="container svelte-12qhfyh"><main class="svelte-12qhfyh">`);
  children($$renderer);
  $$renderer.push(`<!----></main></div> <footer class="svelte-12qhfyh">© 2026 ISCN Authenticator. Built for the clinical genetics community.</footer>`);
}
export {
  _layout as default
};
