<script lang="ts">
	import type { Band } from '@iscn/core';
	import { chromosomeGeometry } from '#lib/ideogram.ts';
	let { bands, width, height, shades, stroke = '#8da3b3' }: {
		bands: Band[]; width: number; height: number; shades: Record<string, string>; stroke?: string;
	} = $props();
	const id = $props.id();
	const geometry = $derived(chromosomeGeometry(bands, width, height));
</script>

{#if geometry}
	<defs><clipPath id={id}><path d={geometry.outline} /></clipPath></defs>
	<g clip-path={`url(#${id})`}>
		{#each bands as band}
			<rect y={band.start * geometry.scale} {width} height={(band.end - band.start) * geometry.scale} fill={shades[band.stain] ?? '#c2cfd9'} />
		{/each}
		{#if geometry.centromere}
			<rect class="centromere" y={geometry.centromere.start} {width} height={geometry.centromere.end - geometry.centromere.start} fill="#76568f" />
		{/if}
	</g>
	<path class="chromosome-outline" d={geometry.outline} fill="none" {stroke} stroke-width=".7" />
{/if}
