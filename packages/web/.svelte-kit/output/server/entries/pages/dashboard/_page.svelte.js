import { d as attr_style, s as stringify, e as escape_html, a as attr_class } from "../../../chunks/renderer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<div class="overview-grid svelte-x1i5gj"><div class="stat-card svelte-x1i5gj"><h3 class="svelte-x1i5gj">Monthly Usage</h3> <div class="usage-meter svelte-x1i5gj"><div class="meter-bar svelte-x1i5gj"><div class="fill svelte-x1i5gj"${attr_style(`width: ${stringify(data.usage.used / data.usage.limit * 100)}%`)}></div></div> <div class="meter-labels svelte-x1i5gj"><span>${escape_html(data.usage.used.toLocaleString())} / ${escape_html(data.usage.limit.toLocaleString())}</span> <span>${escape_html(Math.round(data.usage.used / data.usage.limit * 100))}%</span></div></div></div> <div class="stat-card svelte-x1i5gj"><h3 class="svelte-x1i5gj">Current Plan</h3> <div class="plan-info svelte-x1i5gj"><span${attr_class(`plan-tag ${stringify(data.user.plan)}`, "svelte-x1i5gj")}>${escape_html(data.user.plan.toUpperCase())}</span> `);
    if (data.user.plan === "free") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/dashboard/billing" class="upgrade-link svelte-x1i5gj">Upgrade to Pro →</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
export {
  _page as default
};
