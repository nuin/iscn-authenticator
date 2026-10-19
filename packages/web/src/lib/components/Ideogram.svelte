<script lang="ts">
	import { getChromosomeBands } from '@iscn/core';
	import type { KaryotypeAST } from '@iscn/core';
	import { breakpointRanges } from '#lib/ideogram.ts';

	let { ast }: { ast: KaryotypeAST } = $props();
	const chromosomes = [...Array.from({ length: 22 }, (_, index) => String(index + 1)), 'X', 'Y'];
	const referenceLength = Math.max(...chromosomes.flatMap((chromosome) => getChromosomeBands(chromosome).map((band) => band.end)));
	const bandScale = 132 / referenceLength;
	const stains: Record<string, string> = {
		gneg: '#ffffff', gpos25: '#d8e1e8', gpos50: '#94a6b5', gpos75: '#526779',
		gpos100: '#142b3f', acen: '#708b9d', gvar: '#c2cfd9', stalk: '#94a6b5'
	};

	function highlights(chromosome: string) {
		const entries = ast.abnormalities.filter((item) => item.chromosome.split(';').includes(chromosome));
		return entries.flatMap((item) => breakpointRanges(item, chromosome));
	}

	function changes(chromosome: string, type: string) {
		return ast.abnormalities.some((item) => item.chromosome === chromosome && item.type === type);
	}

	const listedChanges = $derived(ast.abnormalities.map((item) => item.raw).join('; '));
</script>

<figure class="ideogram">
	<div class="legend" aria-label="Chromosome overview legend">
		<span><i class="gain"></i>Listed gain (+)</span>
		<span><i class="loss"></i>Listed loss (−)</span>
		<span><i class="breakpoint"></i>Mapped breakpoint</span>
	</div>
	<div class="chromosomes" aria-hidden="true">
		{#each chromosomes as chromosome}
			{@const bands = getChromosomeBands(chromosome)}
			{@const length = bands.length ? bands[bands.length - 1].end : 0}
			{@const height = length * bandScale}
			<div class="chromosome" class:marked={ast.abnormalities.some((item) => item.chromosome.split(';').includes(chromosome))}>
				<svg viewBox="0 0 30 144" focusable="false">
					<g transform="translate(8, {140 - height})">
						<rect width="12" height={height} rx="4" fill="white" stroke="#b8c9d5" stroke-width="1" />
						{#each bands as band}
							{@const y = band.start * bandScale}
							{@const bandHeight = (band.end - band.start) * bandScale}
							{#if band.stain === 'acen'}
								<path d="M0 {y} H12 L6 {y + bandHeight / 2} L12 {y + bandHeight} H0 L6 {y + bandHeight / 2} Z" fill={stains[band.stain]} />
							{:else}
								<rect y={y} width="12" height={bandHeight} fill={stains[band.stain] ?? '#c2cfd9'} />
							{/if}
						{/each}
						{#if changes(chromosome, '+')}
							<rect x="-5" width="3" height={height} rx="1.5" fill="#00788c" />
						{/if}
						{#if changes(chromosome, '-')}
							<path d="M-3 0 L15 {height} M15 0 L-3 {height}" stroke="#b84242" stroke-width="2" />
						{/if}
						{#each highlights(chromosome) as range}
							<rect x="14" y={range.start * bandScale} width="4" height={Math.max(3, (range.end - range.start) * bandScale)} fill="#9a6710" rx="1" />
						{/each}
					</g>
				</svg>
				<span>{chromosome}</span>
			</div>
		{/each}
	</div>
	<figcaption>
		Reference chromosomes; highlights show listed changes where a band can be mapped.
		This is not a reconstructed karyotype or a band-validity check.
		{#if ast.cell_lines?.length}The overview uses the first cell line.{/if}
		<span class="change-description">{listedChanges ? `Listed changes: ${listedChanges}.` : 'No abnormalities are listed in the parsed result.'}</span>
	</figcaption>
</figure>

<style>
	.ideogram { margin: 0; min-width: 0; }
	.legend { display: flex; flex-wrap: wrap; gap: .6rem 1.2rem; font-size: .75rem; color: var(--color-text-muted); }
	.legend span { display: inline-flex; align-items: center; gap: .45rem; }
	.legend i { width: .65rem; height: .65rem; display: inline-block; border-radius: 2px; }
	.gain { background: #00788c; }
	.loss { background: #b84242; }
	.breakpoint { background: #9a6710; }
	.chromosomes { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: .75rem .4rem; margin: 1rem 0; }
	.chromosome { display: flex; flex-direction: column; align-items: center; padding-bottom: .3rem; border-radius: 5px; }
	.chromosome.marked { background: #eaf4f6; }
	svg { width: 100%; max-width: 32px; height: 138px; display: block; }
	.chromosome span { font-family: var(--font-mono); font-size: .75rem; }
	figcaption { color: var(--color-text-muted); font-size: .75rem; line-height: 1.6; }
	.change-description { display: block; overflow-wrap: anywhere; }
	@media (max-width: 540px) {
		.chromosomes { grid-template-columns: repeat(8, minmax(0, 1fr)); }
		svg { height: 112px; }
	}
</style>
