<h2>REST API Reference</h2>
<p>Integrate ISCN validation into your own clinical pipeline. Authentication is handled via Bearer tokens.</p>

<div class="endpoint">
	<span class="method">GET</span> <code>/api/validate?karyotype={'{string}'}</code>
</div>
<p>Validate a single karyotype string via query parameter.</p>

<div class="endpoint">
	<span class="method">POST</span> <code>/api/validate</code>
</div>
<pre><code>{'{'}
  "karyotype": "47,XY,+21"
{'}'}</code></pre>

<h3>Example Response</h3>
<pre><code>{'{'}
  "valid": true,
  "errors": [],
  "parsed": {'{'}
    "chromosome_count": 47,
    "sex_chromosomes": "XY",
    "abnormalities": [...]
  {'}'},
  "explanation": {'{'}
    "summary": "Trisomy 21 (Down syndrome), male.",
    "confidence": "curated"
  {'}'}
{'}'}</code></pre>

<h3>Rate Limits</h3>
<p>Free tier is limited to 60 requests per minute. Pro tier allows up to 600 requests per minute.</p>

<style>
	.endpoint {
		background: var(--color-bg);
		padding: 1rem;
		border-radius: var(--radius);
		margin: 2rem 0 1rem;
		font-family: var(--font-mono);
	}

	.method {
		background: var(--color-primary);
		color: white;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.8rem;
		margin-right: 0.5rem;
		vertical-align: middle;
	}

	pre {
		background: #2d2d2d;
		color: #f8f8f2;
		padding: 1.5rem;
		border-radius: var(--radius);
		overflow-x: auto;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	code {
		font-family: var(--font-mono);
	}
</style>
