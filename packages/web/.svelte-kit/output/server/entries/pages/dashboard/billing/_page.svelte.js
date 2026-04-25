import { e as escape_html, a as attr_class, s as stringify } from "../../../../chunks/renderer.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, form } = $$props;
    $$renderer2.push(`<div class="billing-container"><div class="current-plan-panel svelte-ay4x9r"><div class="plan-header svelte-ay4x9r"><div><span class="muted svelte-ay4x9r">CURRENT PLAN</span> <h2 class="svelte-ay4x9r">${escape_html(data.user.plan.toUpperCase())}</h2></div> <div${attr_class(`plan-badge ${stringify(data.user.plan)}`, "svelte-ay4x9r")}>${escape_html(data.user.plan === "pro" ? "Paid" : "Free")}</div></div> <div class="plan-details svelte-ay4x9r">`);
    if (data.user.plan === "pro") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p>Your Pro subscription is active. Thank you for supporting ISCN Authenticator!</p> <form method="POST" action="?/manage"><button type="submit" class="btn svelte-ay4x9r">Manage Subscription</button></form>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p>Unlock batch validation, history, and curated library access.</p> <form method="POST" action="?/upgrade"><button type="submit" class="btn btn-primary svelte-ay4x9r">Upgrade to Pro — $29/mo</button></form>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="form-message svelte-ay4x9r">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="invoices-section svelte-ay4x9r"><h3 class="svelte-ay4x9r">Recent Invoices</h3> <p class="muted svelte-ay4x9r">No recent invoices found.</p></div></div>`);
  });
}
export {
  _page as default
};
