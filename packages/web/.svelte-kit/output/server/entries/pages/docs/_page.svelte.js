import "clsx";
function _page($$renderer) {
  $$renderer.push(`<h2>REST API Reference</h2> <p>Integrate ISCN validation into your own clinical pipeline. Authentication is handled via Bearer tokens.</p> <div class="endpoint svelte-1xmjmrw"><span class="method svelte-1xmjmrw">GET</span> <code class="svelte-1xmjmrw">/api/validate?karyotype={string}</code></div> <p>Validate a single karyotype string via query parameter.</p> <div class="endpoint svelte-1xmjmrw"><span class="method svelte-1xmjmrw">POST</span> <code class="svelte-1xmjmrw">/api/validate</code></div> <pre class="svelte-1xmjmrw"><code class="svelte-1xmjmrw">{
  "karyotype": "47,XY,+21"
}</code></pre> <h3>Example Response</h3> <pre class="svelte-1xmjmrw"><code class="svelte-1xmjmrw">{
  "valid": true,
  "errors": [],
  "parsed": {
    "chromosome_count": 47,
    "sex_chromosomes": "XY",
    "abnormalities": [...]
  },
  "explanation": {
    "summary": "Trisomy 21 (Down syndrome), male.",
    "confidence": "curated"
  }
}</code></pre> <h3>Rate Limits</h3> <p>Free tier is limited to 60 requests per minute. Pro tier allows up to 600 requests per minute.</p>`);
}
export {
  _page as default
};
