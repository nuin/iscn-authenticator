import { mapBandToRange } from '@iscn/core';
import type { Abnormality, Band } from '@iscn/core';

export function chromosomeGeometry(bands: Band[], width: number, height: number) {
	const length = bands.at(-1)?.end;
	if (!length) return null;
	const scale = height / length;
	const p = bands.find((band) => band.stain === 'acen' && band.name.startsWith('p'));
	const q = bands.find((band) => band.stain === 'acen' && band.name.startsWith('q'));
	const junction = p && q && p.end === q.start ? p.end * scale : null;
	const radius = Math.min(width / 3, (junction ?? height) / 2, (height - (junction ?? 0)) / 2);
	const centromere = junction !== null && p && q ? {
		junction,
		start: Math.max(radius, Math.min(p.start * scale, junction - width / 4)),
		end: Math.min(height - radius, Math.max(q.end * scale, junction + width / 4)),
	} : null;
	const inset = width * 0.38;
	const right = centromere ? `V${centromere.start} L${width - inset} ${centromere.junction} L${width} ${centromere.end}` : '';
	const left = centromere ? `V${centromere.end} L${inset} ${centromere.junction} L0 ${centromere.start}` : '';
	const outline = `M${radius} 0 H${width - radius} Q${width} 0 ${width} ${radius} ${right}
		V${height - radius} Q${width} ${height} ${width - radius} ${height}
		H${radius} Q0 ${height} 0 ${height - radius} ${left} V${radius} Q0 0 ${radius} 0 Z`;
	return { scale, centromere, outline };
}

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
