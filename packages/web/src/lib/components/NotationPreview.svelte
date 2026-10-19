<script lang="ts">
	import { getChromosomeBands, mapBandToRange } from '@iscn/core';
	import { chromosomeGeometry } from '#lib/ideogram.ts';
	import ChromosomeGlyph from './ChromosomeGlyph.svelte';
	const bands = getChromosomeBands('5');
	const length = bands.at(-1)?.end ?? 1;
	const start = mapBandToRange('5', 'q13');
	const end = mapBandToRange('5', 'q33');
	const centromere = chromosomeGeometry(bands, 34, 264)?.centromere;
	const highlightY = start ? 28 + start.start / length * 264 : 160;
	const highlightHeight = start && end ? (end.end - start.start) / length * 264 : 65;
	const shades: Record<string, string> = { gneg: '#e3f0f3', gpos25: '#9ebcc6', gpos50: '#648e9c', gpos75: '#366a7b', gpos100: '#124b60', acen: '#97c3cc', gvar: '#9ebcc6', stalk: '#9ebcc6' };
</script>

<div class="notation-preview">
	<div class="preview-top"><span>Inside the workspace</span><span class="example-label">Example</span></div>
	<div class="preview-body">
		<div class="chromosome-view">
			<svg viewBox="0 0 180 330" role="img" aria-label="Reference chromosome 5 with a centromere between the p and q arms and q13 to q33 highlighted">
				<g transform="translate(70, 28)"><ChromosomeGlyph {bands} width={34} height={264} shades={shades} stroke="#668f9d" /></g>
				<rect x="65" y={highlightY} width="44" height={highlightHeight} fill="#47c5ca" fill-opacity=".18" stroke="#41a6b7" />
				<path d={`M115 ${highlightY}h12v${highlightHeight}h-12`} fill="none" stroke="#41a6b7" stroke-width="1.5" />
				<text x="86" y="15" text-anchor="middle">5</text><text x="48" y="75">p</text><text x="48" y="240">q</text>
				<text x="137" y={highlightY + 4}>q13</text><text x="137" y={highlightY + highlightHeight}>q33</text>
				{#if centromere}
					<path d={`M${70 + 34 * .38} ${28 + centromere.junction} H20`} fill="none" stroke="#76568f" />
					<text class="centromere-label" x="18" y={21 + centromere.junction}>cen</text>
				{/if}
			</svg>
			<span class="centromere-key"><i></i>Centromere</span>
			<span>Reference bands · constriction enlarged</span>
		</div>
		<div class="preview-detail">
			<div class="check-status"><span aria-hidden="true">✓</span> Checks passed</div>
			<h2>A deletion,<br />made readable.</h2>
			<p>Chromosome, breakpoints and notation, together in one result.</p>
			<dl><div><dt>Chromosome</dt><dd>5</dd></div><div><dt>Breakpoints</dt><dd>q13, q33</dd></div><div><dt>Abnormality</dt><dd>Deletion</dd></div></dl>
		</div>
	</div>
	<div class="notation"><span>ISCN notation</span><code>46,XX,del(5)(q13q33)</code><a href="/validate?karyotype=46%2CXX%2Cdel(5)(q13q33)" aria-label="Open deletion example in the validator"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></a></div>
</div>

<style>
	.notation-preview { border: 1px solid #c2d8e3; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 20px 60px #16435a0a; }
	.preview-top { padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #d8e3ec; font-size: .75rem; color: #526779; }
	.example-label { border: 1px solid #d8e3ec; border-radius: 4px; font-size: .65rem; padding: .2rem .5rem; }
	.preview-body { display: grid; grid-template-columns: 40% 60%; min-height: 345px; }
	.chromosome-view { background: #eaf3f7; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 1.25rem .5rem .8rem; border-right: 1px solid #d8e3ec; }
	.chromosome-view svg { height: 285px; width: 100%; }
	.chromosome-view text { font-family: var(--font-mono); font-size: 11px; fill: #42677a; }
	.chromosome-view .centromere-label { font-size: 9px; fill: #64417f; }
	.chromosome-view span { font-size: .58rem; color: #526779; }
	.chromosome-view .centromere-key { display: inline-flex; align-items: center; gap: .4rem; font-size: .7rem; color: #64417f; margin-bottom: .4rem; }
	.centromere-key i { width: .6rem; height: .6rem; background: #76568f; clip-path: polygon(0 0, 100% 0, 65% 50%, 100% 100%, 0 100%, 35% 50%); }
	.preview-detail { padding: 1.8rem 1.5rem; }
	.check-status { display: inline-flex; align-items: center; gap: .4rem; color: #206751; font-size: .68rem; background: #eaf6ef; border-radius: 4px; padding: .3rem .5rem; }
	h2 { font-size: 1.7rem; margin: 1.1rem 0 .8rem; letter-spacing: -.035em; }
	p { font-size: .75rem; color: #526779; line-height: 1.7; }
	dl { margin: 1.5rem 0 0; font-size: .68rem; }
	dl div { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; padding: .5rem 0; border-top: 1px solid #e0e9ef; }
	dt { color: #526779; }
	dd { margin: 0; font-family: var(--font-mono); font-size: .65rem; }
	.notation { display: grid; grid-template-columns: 1fr auto; background: #f8fbfd; padding: 1.15rem 1.5rem; border-top: 1px solid #d8e3ec; gap: .25rem 1rem; }
	.notation > span { font-size: .65rem; color: #526779; }
	.notation code { font-size: .9rem; grid-column: 1; }
	.notation a { grid-column: 2; grid-row: 1/3; align-self: center; width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #bdd1dd; border-radius: 50%; background: #fff; }
	@media (max-width: 440px) { .preview-detail { padding: 1.3rem 1rem; } h2 { font-size: 1.4rem; } .preview-body { grid-template-columns: 36% 64%; } .notation { padding: 1rem; } .notation code { font-size: .75rem; } }
</style>
