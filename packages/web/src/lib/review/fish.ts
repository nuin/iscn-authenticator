import { integerCount } from './references.ts';
import type { FishInput, FishReview, ReviewIssue } from './types.ts';

function fishIssue(code: string, message: string): ReviewIssue {
	return { code, message, severity: 'error', reference: 'ISCN 2024 §7.3.1; laboratory QC input checks' };
}

function checkProbes(probes: FishInput['probes']): ReviewIssue[] {
	const issues: ReviewIssue[] = [];
	if (!probes.length || probes.length > 12) issues.push(fishIssue('FISH_PROBES', 'Enter between one and twelve probes from the same hybridization.'));
	const names = new Set<string>();
	for (const [index, probe] of probes.entries()) {
		const name = probe.name.trim();
		if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(name)) {
			issues.push(fishIssue('FISH_PROBE_NAME', `Probe ${index + 1}: use a single probe identifier. Fusion, split, contiguous-probe and uncertain expressions need manual construction.`));
		}
		if (names.has(name.toUpperCase())) issues.push(fishIssue('FISH_DUPLICATE_PROBE', `Probe ${index + 1}: ${name} appears more than once.`));
		names.add(name.toUpperCase());
		if (integerCount(probe.signals, true) === null) issues.push(fishIssue('FISH_SIGNALS', `Probe ${index + 1}: signal count must be a nonnegative safe integer.`));
	}
	return issues;
}

function checkNuclei(input: FishInput, observed: number | null, total: number | null): ReviewIssue[] {
	const issues: ReviewIssue[] = [];
	if (observed === null || total === null) {
		issues.push(fishIssue('FISH_NUCLEI', 'Observed and total nuclei must be positive safe integers. A zero-observation pattern is not emitted as an observed finding.'));
	} else if (observed > total) {
		issues.push(fishIssue('FISH_NUCLEI', 'Observed nuclei cannot exceed total nuclei.'));
	} else if (input.countMode === 'mixed' && observed === total) {
		issues.push(fishIssue('FISH_COUNT_MODE', 'Mixed nuclei requires observed nuclei below the total. Choose a single-pattern reporting mode when every nucleus has this pattern.'));
	} else if (input.countMode !== 'mixed' && observed !== total) {
		issues.push(fishIssue('FISH_COUNT_MODE', 'The selected reporting mode requires this pattern in every analyzed nucleus.'));
	}
	if (!['mixed', 'all-observed', 'constitutional-nonmosaic'].includes(input.countMode)) {
		issues.push(fishIssue('FISH_COUNT_MODE', 'Choose the nuclei reporting mode.'));
	}
	return issues;
}

function cutoffIssues(input: FishInput): ReviewIssue[] {
	if (!input.cutoffPercent.trim()) return [];
	const cutoff = Number(input.cutoffPercent);
	const issues: ReviewIssue[] = [];
	if (!/^\d{1,3}(?:\.\d{1,6})?$/.test(input.cutoffPercent.trim()) || !Number.isFinite(cutoff) || cutoff > 100) {
		issues.push(fishIssue('FISH_CUTOFF', 'The laboratory cutoff must be a percentage from 0 to 100 with at most six decimal places.'));
	}
	if (!['>', '>='].includes(input.cutoffOperator)) issues.push(fishIssue('FISH_OPERATOR', 'Choose whether the laboratory threshold uses > or >=.'));
	if (!input.protocol.trim()) issues.push(fishIssue('FISH_PROTOCOL', 'Enter the laboratory protocol and version that define this cutoff.'));
	return issues;
}

function fishNotation(input: FishInput, observed: number, total: number): string {
	const probes = input.probes.map((probe) => ({ name: probe.name.trim(), signals: Number(probe.signals) }));
	const sameCount = probes.every((probe) => probe.signals === probes[0].signals);
	const pattern = sameCount
		? `(${probes.map((probe) => probe.name).join(',')})x${probes[0].signals}`
		: `(${probes.map((probe) => `${probe.name}x${probe.signals}`).join(',')})`;
	const cells = input.countMode === 'mixed' ? `[${observed}/${total}]`
		: input.countMode === 'all-observed' ? `[${total}]` : '';
	return `nuc ish ${pattern}${cells}`;
}

export function buildFish(input: FishInput): FishReview {
	const inputSnapshot = { ...input, probes: input.probes.map((probe) => ({ ...probe })) };
	const observed = integerCount(input.observedNuclei);
	const total = integerCount(input.totalNuclei);
	const issues = [...checkProbes(input.probes), ...checkNuclei(input, observed, total), ...cutoffIssues(input)];
	if (issues.length || observed === null || total === null) {
		return { inputSnapshot, notation: null, percentage: null, threshold: 'not-assessed', issues };
	}
	const percentage = observed / total * 100;
	let threshold: FishReview['threshold'] = 'not-assessed';
	if (input.cutoffPercent.trim()) {
		const [integer, decimals = ''] = input.cutoffPercent.trim().split('.');
		const actual = BigInt(observed) * 100n * 10n ** BigInt(decimals.length);
		const cutoff = BigInt(total) * BigInt(integer + decimals);
		const meets = input.cutoffOperator === '>' ? actual > cutoff : actual >= cutoff;
		threshold = meets ? 'meets' : 'does-not-meet';
	}
	return { inputSnapshot, notation: fishNotation(input, observed, total), percentage, threshold, issues };
}
