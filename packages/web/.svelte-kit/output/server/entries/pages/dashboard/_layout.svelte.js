import { e as escape_html, a as attr_class } from "../../../chunks/renderer.js";
import { p as page } from "../../../chunks/index2.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, data } = $$props;
    $$renderer2.push(`<header class="dashboard-header svelte-2agd5u"><div><h1 class="svelte-2agd5u">Dashboard</h1> <div class="user-meta svelte-2agd5u"><span>${escape_html(data.user.email)}</span> <span>·</span> <form method="POST" action="/dashboard?/logout" style="display: inline;"><button type="submit" class="logout-btn svelte-2agd5u">Log out</button></form></div></div></header> <nav class="tabs svelte-2agd5u"><a href="/dashboard"${attr_class("svelte-2agd5u", void 0, { "active": page.url.pathname === "/dashboard" })}>Overview</a> <a href="/dashboard/keys"${attr_class("svelte-2agd5u", void 0, { "active": page.url.pathname === "/dashboard/keys" })}>Keys</a> `);
    if (data.user.plan === "pro") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/dashboard/batch"${attr_class("svelte-2agd5u", void 0, { "active": page.url.pathname === "/dashboard/batch" })}>Batch</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <a href="/dashboard/billing"${attr_class("svelte-2agd5u", void 0, { "active": page.url.pathname === "/dashboard/billing" })}>Billing</a></nav> <div class="panel svelte-2agd5u">`);
    children($$renderer2);
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _layout as default
};
