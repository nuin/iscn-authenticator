import { mapBandToRange } from '@iscn/core';
import type { Abnormality } from '@iscn/core';

export function breakpointRanges(item: Abnormality, chromosome: string) {
	const names = item.chromosome.split(';');
	const points = names.length === 1
		? names[0] === chromosome ? item.breakpoints : []
		: names.flatMap((name, index) => {
			if (name !== chromosome) return [];
			if (item.type === 'ins' && names.length === 2 && index === 1) {
				return item.breakpoints.slice(1);
			}
			return item.breakpoints.slice(index, index + 1);
		});
	return points.flatMap((point) => {
		const name = `${point.arm}${point.region ?? ''}${point.band ?? ''}${point.subband ? '.' + point.subband : ''}`;
		const range = mapBandToRange(chromosome, name);
		return range ? [range] : [];
	});
}
