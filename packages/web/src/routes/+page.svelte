<script lang="ts">
	import NotationPreview from '#lib/components/NotationPreview.svelte';
</script>

<svelte:head>
	<title>ISCN Authenticator · Karyotype review for laboratory teams</title>
	<meta name="description" content="Review karyotype notation, inspect structured results, and work through batches in your browser. Practical ISCN tools and integration guides for laboratory teams." />
</svelte:head>

<section class="hero page-shell">
	<div class="hero-copy">
		<p class="audience"><span aria-hidden="true"></span> For cytogenetics and laboratory informatics</p>
		<h1>Every karyotype<br />deserves a<br />clearer review.</h1>
		<p class="hero-description">Check the notation. Understand the structure. Bring a consistent first pass to your lab’s karyotype review.</p>
		<div class="hero-actions"><a href="/validate" class="button">Open the validator</a><a href="/review" class="button secondary">Open report review</a></div>
		<p class="hero-note">Runs in your browser. No account needed to start.</p>
	</div>
	<div class="hero-visual"><NotationPreview /><p>Example result from the implemented checks.<br /><a href="/docs/coverage">Understand the scope of a result.</a></p></div>
</section>

<div class="principles"><div class="page-shell principles-inner"><span>Designed around the review</span><p>Browser-based checks</p><p>Readable, structured results</p><p>Explicit coverage limits</p></div></div>

<section class="workflow-section page-shell">
	<div class="section-heading"><div><p class="section-label">From notation to review</p><h2>A useful first pass.<br />A clearer next step.</h2></div><p>Whether you are checking one string or reviewing an export, keep the original notation and the evidence of the check together.</p></div>
	<div class="workflow-grid">
		<article><span class="workflow-number">01</span><h3>Check a karyotype</h3><p>Paste a string or open an example. See syntax and consistency issues alongside parsed chromosome and breakpoint details.</p><a href="/validate">Try a single check</a></article>
		<article><span class="workflow-number">02</span><h3>Reconcile the report</h3><p>Compare notation with metaphase counts and the structured conclusion. Review differences from a previous result and record your decision.</p><a href="/review">Open laboratory review</a></article>
		<article><span class="workflow-number">03</span><h3>Keep the evidence</h3><p>Construct a bounded FISH expression, organize CNV evidence, or export a report review with its inputs, references and coverage limits.</p><a href="/docs/report-review">Explore the review workflow</a></article>
	</div>
</section>

<section class="lab-section">
	<div class="page-shell lab-content">
		<div class="lab-intro"><p class="section-label">Built for the work around the result</p><h2>For the scientist.<br />For the informatics team.</h2><p>A browser workspace for hands-on review, with source libraries and a self-hosted API for teams building their own workflows.</p><a class="button secondary" href="/docs/integration">Explore integration options</a></div>
		<div class="lab-details">
			<div><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-13 4h3m-3 3h7"/></svg><h3>Review without a setup project</h3><p>Open the workspace and start checking. Browser inputs stay in the browser; downloads happen when you choose.</p></div>
			<div><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m8 6-5 6 5 6m8-12 5 6-5 6m-3-15-2 18"/></svg><h3>Build on an inspectable engine</h3><p>Use the TypeScript source or the separately maintained Python library. Integration guides explain the runtime and credential boundaries.</p></div>
			<div><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM15 3v5h4M9 12h6m-6 4h6"/></svg><h3>Evaluate coverage before adoption</h3><p>Read the supported checks and known limitations. Compare representative lab examples before adding the tool to a workflow.</p></div>
		</div>
	</div>
</section>

<section class="page-shell coverage-section">
	<div><p class="section-label">Know what “checked” means</p><h2>Make the limits<br />part of the review.</h2></div>
	<div class="coverage-copy"><p>ISCN Authenticator checks implemented notation rules. Some constructs are parsed without complete validation. A passing check does not certify full ISCN compliance or establish a clinical interpretation.</p><p>Coverage notes identify cases such as unrecognized abnormalities, extended assay notation, and unresolved clone ordering. CNV scoring uses a separate, explicitly bounded evidence worksheet.</p><a href="/docs/coverage">Read coverage and limitations</a></div>
</section>

<section class="page-shell closing-section"><div><h2>Start with a karyotype<br />you already know.</h2><p>Explore the workspace, compare a result, and see where it fits in your lab.</p></div><a class="button" href="/validate">Open the validator</a></section>

<style>
	.hero { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 5rem; padding-block: 5.5rem 4.5rem; }
	.audience { font-size: .73rem; color: var(--color-primary); display: flex; align-items: center; gap: .6rem; margin-bottom: 1.75rem; }
	.audience span { width: 7px; height: 7px; border: 1.5px solid var(--color-primary); border-radius: 50%; flex-shrink: 0; }
	h1 { font-size: clamp(3rem, 5.5vw, 4.8rem); font-weight: 550; line-height: 1.055; letter-spacing: -.055em; margin-bottom: 1.6rem; }
	.hero-description { font-size: 1.05rem; color: var(--color-text-muted); line-height: 1.8; max-width: 42ch; }
	.hero-actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 2rem; }
	.hero-note { font-size: .7rem; color: var(--color-text-muted); margin-top: 1rem; }
	.hero-visual { position: relative; padding-top: .4rem; }
	.hero-visual > p { font-size: .65rem; color: var(--color-text-muted); margin: 1.1rem 0 0 1.5rem; line-height: 1.7; }
	.hero-visual > p a { color: var(--color-text-muted); }
	.principles { border-block: 1px solid var(--color-border); background: #fff; }
	.principles-inner { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding-block: 1.4rem; }
	.principles span { font-size: .7rem; color: var(--color-text-muted); }
	.principles p { margin: 0; font-size: .8rem; font-weight: 500; }
	.workflow-section { padding-block: 5.5rem; }
	.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 3rem; margin-bottom: 3rem; }
	h2 { font-size: clamp(1.8rem, 3.3vw, 2.8rem); letter-spacing: -.045em; line-height: 1.15; margin-bottom: 0; }
	.section-heading > p { max-width: 42ch; color: var(--color-text-muted); font-size: .9rem; line-height: 1.8; margin-bottom: 0; }
	.workflow-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; }
	.workflow-grid article { border-top: 1px solid #a7c1ce; padding-top: 1.5rem; }
	.workflow-number { color: var(--color-primary); font-size: .8rem; font-family: var(--font-mono); }
	.workflow-grid h3 { margin: 1.7rem 0 1rem; font-size: 1.15rem; }
	.workflow-grid p { color: var(--color-text-muted); font-size: .85rem; line-height: 1.8; }
	.workflow-grid a, .coverage-copy a { font-size: .8rem; font-weight: 600; }
	.lab-section { background: #eaf3f7; border-block: 1px solid #d6e6ee; }
	.lab-content { display: grid; grid-template-columns: 1fr 1fr; gap: 6rem; padding-block: 4.5rem; }
	.lab-intro > p:not(.section-label) { font-size: .95rem; line-height: 1.9; color: var(--color-text-muted); max-width: 42ch; margin-top: 1.5rem; }
	.lab-intro .button { margin-top: 1.2rem; }
	.lab-details { display: grid; gap: 1.7rem; }
	.lab-details > div { padding-left: 3rem; position: relative; }
	.lab-details svg { position: absolute; left: 0; top: .15rem; color: var(--color-primary); }
	.lab-details h3 { font-size: .95rem; margin-bottom: .6rem; }
	.lab-details p { font-size: .8rem; line-height: 1.8; color: var(--color-text-muted); margin-bottom: 0; }
	.coverage-section { padding-block: 5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 6rem; }
	.coverage-copy p { color: var(--color-text-muted); font-size: .9rem; line-height: 1.9; }
	.closing-section { display: flex; justify-content: space-between; align-items: center; gap: 3rem; padding: 3rem; margin-bottom: 5rem; border-radius: 14px; background: #d9f1f5; }
	.closing-section h2 { font-size: 2rem; }
	.closing-section p { font-size: .85rem; color: #42677a; margin: 1rem 0 0; }
	.closing-section .button { flex-shrink: 0; }
	@media (max-width: 1050px) { .hero { gap: 2.5rem; } .lab-content, .coverage-section { gap: 3rem; } }
	@media (max-width: 800px) { .hero { grid-template-columns: 1fr; padding-block: 3rem; gap: 2rem; } h1 { font-size: clamp(3rem, 8vw, 4.8rem); } .hero-visual { max-width: 560px; } .hero-copy { max-width: 600px; } .principles-inner { flex-wrap: wrap; justify-content: start; gap: .75rem 2rem; } .principles span { width: 100%; } .section-heading { display: block; } .section-heading > p { margin-top: 1.5rem; } .workflow-grid { gap: 1.5rem; } .lab-content, .coverage-section { grid-template-columns: 1fr; } .closing-section { padding: 2rem; } }
	@media (max-width: 580px) { .hero { padding-top: 2.5rem; } .hero-description { font-size: .95rem; } .audience { font-size: .68rem; } .workflow-grid { grid-template-columns: 1fr; gap: 2rem; } .workflow-grid h3 { margin-top: 1rem; } .workflow-section, .lab-content, .coverage-section { padding-block: 3rem; } .closing-section { flex-direction: column; align-items: start; gap: 1.5rem; margin-bottom: 3rem; } .closing-section h2 { font-size: 1.7rem; } }
</style>
