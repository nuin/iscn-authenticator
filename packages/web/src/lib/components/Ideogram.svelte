<script lang="ts">
	import { getChromosomeBands, mapBandToRange } from '@iscn/core';
	import type { KaryotypeAST } from '@iscn/core';

	let { ast }: { ast: KaryotypeAST } = $props();

	const chromosomes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y'];

	const STAIN_COLORS: Record<string, string> = {
		gneg: '#ffffff',
		gpos25: '#d9d9d9',
		gpos50: '#999999',
		gpos75: '#666666',
		gpos100: '#000000',
		acen: '#888888', // centromere (grey, not red)
		gvar: '#cccccc',
		stalk: '#777777'
	};

	// Map chromosome name to its abnormalities and the specific breakpoint index it should highlight
	const abnormalitiesByChr = $derived.by(() => {
		const map: Record<string, { abn: any, bpIndex: number }[]> = {};
		ast.abnormalities.forEach(abn => {
			const chrs = abn.chromosome.split(';');
			chrs.forEach((c, i) => {
				if (!map[c]) map[c] = [];
				map[c].push({ abn, bpIndex: i });
			});
		});
		return map;
	});

	function getStainColor(stain: string) {
		return STAIN_COLORS[stain] || '#cccccc';
	}

	let hoveredBand = $state<string | null>(null);
</script>

<div class="ideogram-container">
	<div class="legend">
		<div class="legend-item"><span class="swatch gain"></span> Gain (+)</div>
		<div class="legend-item"><span class="swatch loss"></span> Loss (-)</div>
		<div class="legend-item"><span class="swatch structural"></span> Structural (breakpoint)</div>
	</div>

	<div class="ideogram-grid">
		{#each chromosomes as chr}
			{@const bands = getChromosomeBands(chr)}
			{@const chrAbns = abnormalitiesByChr[chr] || []}
			{@const maxBp = bands.length > 0 ? bands[bands.length - 1].end : 0}
			
			<div class="chr-container">
				<span class="chr-label">{chr}</span>
				<svg width="40" height="300" viewBox="0 0 40 300">
					{#if bands.length > 0}
						<g transform="translate(10, 10)">
							<!-- Chromosome Background -->
							<rect x="0" y="0" width="20" height="280" rx="10" ry="10" fill="#f8f9fa" stroke="#eee" stroke-width="1" />
							
							<!-- Bands -->
							{#each bands as band}
								{@const y = (band.start / maxBp) * 280}
								{@const h = ((band.end - band.start) / maxBp) * 280}
								{#if band.stain === 'acen'}
									<!-- Pinched Centromere look -->
									<path 
										d="M 0 {y} L 20 {y} L 10 {y + h/2} L 20 {y+h} L 0 {y+h} L 10 {y+h/2} Z" 
										fill={getStainColor(band.stain)}
									/>
								{:else}
									<rect 
										x="0" 
										y={y} 
										width="20" 
										height={h} 
										fill={getStainColor(band.stain)}
										stroke="none"
										role="img"
										aria-label="Band {chr}{band.name}"
										onmouseenter={() => hoveredBand = `${chr}${band.name}`}
										onmouseleave={() => hoveredBand = null}
									>
										<title>{chr}{band.name} ({band.stain})</title>
									</rect>
								{/if}
							{/each}

							<!-- Highlights for Abnormalities -->
							{#each chrAbns as { abn, bpIndex }}
								{#if abn.type === '+'}
									<rect x="-6" y="0" width="3" height="280" fill="#0d6efd" rx="1.5" />
								{:else if abn.type === '-'}
									<g stroke="#dc3545" stroke-width="2" stroke-linecap="round" opacity="0.6">
										<line x1="0" y1="0" x2="20" y2="280" />
										<line x1="20" y1="0" x2="0" y2="280" />
									</g>
								{:else if abn.breakpoints.length > 0}
									{#if abn.breakpoints.length > 1 && abn.chromosome.includes(';')}
										<!-- Translocation/Multi-chr: highlight specific breakpoint for this chr -->
										{@const bp = abn.breakpoints[bpIndex]}
										{#if bp}
											{@const bandName = bp.arm + (bp.region ?? '') + (bp.band ?? '') + (bp.subband ? '.' + bp.subband : '')}
											{@const range = mapBandToRange(chr, bandName)}
											{#if range}
												<rect x="23" y={(range.start / maxBp) * 280} width="4" height={Math.max(3, ((range.end - range.start) / maxBp) * 280)} fill="#0d6efd" rx="2" />
												<rect x="0" y={(range.start / maxBp) * 280} width="20" height={Math.max(3, ((range.end - range.start) / maxBp) * 280)} fill="rgba(13, 110, 253, 0.2)" pointer-events="none" />
											{/if}
										{/if}
									{:else}
										<!-- Single chromosome: highlight all breakpoints (del, dup, inv) -->
										{#each abn.breakpoints as bp}
											{@const bandName = bp.arm + (bp.region ?? '') + (bp.band ?? '') + (bp.subband ? '.' + bp.subband : '')}
											{@const range = mapBandToRange(chr, bandName)}
											{#if range}
												<rect x="23" y={(range.start / maxBp) * 280} width="4" height={Math.max(3, ((range.end - range.start) / maxBp) * 280)} fill="#0d6efd" rx="2" />
												<rect x="0" y={(range.start / maxBp) * 280} width="20" height={Math.max(3, ((range.end - range.start) / maxBp) * 280)} fill="rgba(13, 110, 253, 0.2)" pointer-events="none" />
											{/if}
										{/each}
									{/if}
								{/if}
							{/each}
						</g>
					{/if}
				</svg>
			</div>
		{/each}
	</div>
	
	{#if hoveredBand}
		<div class="tooltip">{hoveredBand}</div>
	{/if}
</div>

<style>
	.ideogram-container {
		position: relative;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		margin-top: 2rem;
		padding: 1.5rem;
	}

	.legend {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
		justify-content: center;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.swatch.gain { background: #0d6efd; width: 3px; height: 12px; }
	.swatch.loss { background: #dc3545; position: relative; }
	.swatch.loss::after { content: '×'; position: absolute; top: -4px; left: 1px; color: #dc3545; font-size: 14px; }
	.swatch.structural { background: rgba(13, 110, 253, 0.4); border: 1px solid #0d6efd; }

	.ideogram-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
		gap: 0.5rem;
	}

	.chr-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.chr-label {
		font-size: 0.7rem;
		font-weight: bold;
		color: var(--color-text-muted);
		margin-bottom: 0.25rem;
	}

	svg {
		overflow: visible;
	}

	.tooltip {
		position: absolute;
		bottom: 1rem;
		right: 1.5rem;
		background: #333;
		color: white;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		pointer-events: none;
	}
</style>
