<h2>Authoritative Validation</h2>
<p>
	The ISCN Authenticator is built against the <strong>International System for Human Cytogenomic Nomenclature (2024)</strong> specification.
</p>
<p>
	Our engine implements the formal grammar and rules defined in the latest consensus document,
	ensuring that your karyotypes adhere to international reporting standards.
</p>

<h3>How it works</h3>
<ol>
	<li>
		<strong>Parser:</strong> A recursive-descent parser converts ISCN strings into a structured Abstract
		Syntax Tree (AST).
	</li>
	<li>
		<strong>Rule Engine:</strong> Over 50 validation rules check for numerical consistency, sex chromosome
		coherence, and structural abnormality syntax.
	</li>
	<li>
		<strong>Explain Module:</strong> A curated clinical library provides spec-cited interpretations for
		common abnormalities.
	</li>
</ol>

<div class="note">
	<p>
		This tool is intended for research and educational use. Always consult with a certified
		clinical cytogeneticist for diagnostic reporting.
	</p>
</div>

<style>
	h3 {
		margin-top: 2rem;
	}

	ol {
		padding-left: 1.5rem;
	}

	li {
		margin-bottom: 1rem;
	}

	.note {
		margin-top: 3rem;
		padding: 1.5rem;
		background: #eef6ff;
		border-left: 4px solid var(--color-primary);
		border-radius: 4px;
	}
</style>
