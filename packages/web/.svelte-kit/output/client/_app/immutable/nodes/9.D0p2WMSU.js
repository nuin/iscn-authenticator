import"../chunks/Bzak7iHL.js";import"../chunks/BBRHvwUB.js";import{s as e,f as c,a as d,d as s,c as v,r,a3 as x}from"../chunks/CLrfSE8b.js";var h=v('<h2>REST API Reference</h2> <p>Integrate ISCN validation into your own clinical pipeline. Authentication is handled via Bearer tokens.</p> <div class="endpoint svelte-1xmjmrw"><span class="method svelte-1xmjmrw">GET</span> <code class="svelte-1xmjmrw"></code></div> <p>Validate a single karyotype string via query parameter.</p> <div class="endpoint svelte-1xmjmrw"><span class="method svelte-1xmjmrw">POST</span> <code class="svelte-1xmjmrw">/api/validate</code></div> <pre class="svelte-1xmjmrw"><code class="svelte-1xmjmrw"></code></pre> <h3>Example Response</h3> <pre class="svelte-1xmjmrw"><code class="svelte-1xmjmrw"></code></pre> <h3>Rate Limits</h3> <p>Free tier is limited to 60 requests per minute. Pro tier allows up to 600 requests per minute.</p>',1);function j(i){var n=h(),t=e(c(n),4),m=e(s(t),2);m.textContent="/api/validate?karyotype={string}",r(t);var a=e(t,6),l=s(a);l.textContent=`{
  "karyotype": "47,XY,+21"
}`,r(a);var o=e(a,4),p=s(o);p.textContent=`{
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
}`,r(o),x(4),d(i,n)}export{j as component};
