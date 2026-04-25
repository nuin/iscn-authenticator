<script lang="ts">
	import { validateKaryotypeNative, explain } from '@iscn/core';
	import type { ValidationResult } from '@iscn/core';
	import Ideogram from '$lib/components/Ideogram.svelte';

	let karyotype = $state('');
	let result = $state<ValidationResult | null>(null);
	let isValidating = $state(false);

	const examples = [
		{ label: 'Normal female', value: '46,XX' },
		{ label: 'Normal male', value: '46,XY' },
		{ label: 'Trisomy 21', value: '47,XY,+21' },
		{ label: 'Turner', value: '45,X' },
		{ label: 'Deletion', value: '46,XX,del(5)(q13q33)' },
		{ label: 'Translocation', value: '46,XX,t(9;22)(q34;q11.2)' }
	];

	function setExample(val: string) {
		karyotype = val;
		validate();
	}

	async function validate() {
		if (!karyotype.trim()) return;
		isValidating = true;

		try {
			// CLIENT SIDE VALIDATION
			const res = validateKaryotypeNative(karyotype);
			if (res.parsed) {
				res.explanation = explain(res.parsed, {
					onMiss: (sig) => {
						fetch('/api/explain/miss', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ signature: sig })
						}).catch(() => {});
					}
				});
				res.parsed.abnormalities.forEach((abn) => {
					abn.explanation = explain(abn);
				});
			}
			result = res;
		} catch (err: any) {
			result = {
				valid: false,
				errors: ['Local validation error: ' + err.message],
				parsed: null
			};
		} finally {
			isValidating = false;
		}
	}
</script>

<header>
	<h1>ISCN Karyotype Validator</h1>
	<p class="subtitle">Validate International System for Human Cytogenomic Nomenclature strings</p>
</header>

<section class="validator-card">
	<form onsubmit={(e) => { e.preventDefault(); validate(); }}>
		<div class="input-group">
			<label for="karyotype">Karyotype String</label>
			<div class="input-row">
				<input
					type="text"
					id="karyotype"
					bind:value={karyotype}
					placeholder="e.g., 46,XX or 47,XY,+21"
					autocomplete="off"
					spellcheck="false"
					required
				/>
				<button type="submit" disabled={isValidating}>
					{isValidating ? 'Validating...' : 'Validate'}
				</button>
			</div>
		</div>
	</form>

	<div class="examples">
		<span class="examples-label">Examples:</span>
		{#each examples as ex}
			<button type="button" class="link-btn" onclick={() => setExample(ex.value)}>
				{ex.label}
			</button>
		{/each}
	</div>
</section>

{#if result}
	<section class="result-section">
		<div class="badge {result.valid ? 'valid' : 'invalid'}">
			{result.valid ? 'VALID' : 'INVALID'}
		</div>

		{#if result.errors.length > 0}
			<div class="errors">
				<h3>Errors</h3>
				<ul>
					{#each result.errors as err}
						<li>{err}</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if result.parsed}
			<Ideogram ast={result.parsed} />

			<details open={result.valid} class="parsed-details">
				<summary>Parsed Details</summary>
				<div class="parsed-content">
					<dl>
						{#if result.explanation}
							<dt>Summary</dt>
							<dd><strong>{result.explanation.summary}</strong></dd>
							{#if result.explanation.detail}
								<dt>Details</dt>
								<dd>{result.explanation.detail}</dd>
							{/if}
							{#if result.explanation.citation}
								<dt>Citation</dt>
								<dd>
									ISCN 2024 § {result.explanation.citation.section}
									{#if result.explanation.citation.page}
										, p. {result.explanation.citation.page}
									{/if}
								</dd>
							{/if}
						{/if}

						<dt>Chromosome Count</dt>
						<dd>{result.parsed.chromosome_count}</dd>
						<dt>Sex Chromosomes</dt>
						<dd>{result.parsed.sex_chromosomes}</dd>

						{#if result.parsed.abnormalities.length > 0}
							<dt>Abnormalities</dt>
							<dd>
								<ul>
									{#each result.parsed.abnormalities as abn}
										<li>
											<code>{abn.raw}</code>
											{#if abn.explanation}
												<br />
												<small class="muted">{abn.explanation.summary}</small>
											{/if}
										</li>
									{/each}
								</ul>
							</dd>
						{:else}
							<dt>Abnormalities</dt>
							<dd>None</dd>
						{/if}
					</dl>
				</div>
			</details>
		{/if}
	</section>
{/if}

<style>
	header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 1.1rem;
	}

	.validator-card {
		background: var(--color-bg);
		padding: 2rem;
		border-radius: var(--radius);
		margin-bottom: 2rem;
	}

	.input-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	input[type='text'] {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 1rem;
	}

	button[type='submit'] {
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.examples {
		margin-top: 1rem;
		font-size: 0.85rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.examples-label {
		color: var(--color-text-muted);
		margin-right: 0.5rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: var(--color-primary);
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
	}

	.result-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--color-border);
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-weight: bold;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.valid {
		background: #d1e7dd;
		color: #0f5132;
	}

	.invalid {
		background: #f8d7da;
		color: #842029;
	}

	.errors {
		background: #fff3cd;
		color: #664d03;
		padding: 1rem;
		border-radius: var(--radius);
		margin-bottom: 1.5rem;
	}

	.errors h3 {
		margin-top: 0;
		font-size: 1rem;
	}

	.errors ul {
		margin: 0.5rem 0 0;
		padding-left: 1.5rem;
	}

	.parsed-details {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.parsed-details summary {
		padding: 1rem;
		background: var(--color-bg);
		cursor: pointer;
		font-weight: 500;
	}

	.parsed-content {
		padding: 1rem;
		border-top: 1px solid var(--color-border);
	}

	dl {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 0.5rem 1rem;
	}

	dt {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	dd {
		margin: 0;
	}

	.muted {
		color: var(--color-text-muted);
	}

	code {
		background: var(--color-bg);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-family: var(--font-mono);
	}

	@media (max-width: 600px) {
		dl {
			grid-template-columns: 1fr;
		}
		.input-row {
			flex-direction: column;
		}
	}
</style>
