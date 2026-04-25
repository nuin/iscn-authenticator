import "clsx";
function _page($$renderer) {
  $$renderer.push(`<h2>Authoritative Validation</h2> <p>The ISCN Authenticator is built against the <strong>International System for Human Cytogenomic Nomenclature (2024)</strong> specification.</p> <p>Our engine implements the formal grammar and rules defined in the latest consensus document,
	ensuring that your karyotypes adhere to international reporting standards.</p> <h3 class="svelte-cwls5q">How it works</h3> <ol class="svelte-cwls5q"><li class="svelte-cwls5q"><strong>Parser:</strong> A recursive-descent parser converts ISCN strings into a structured Abstract
		Syntax Tree (AST).</li> <li class="svelte-cwls5q"><strong>Rule Engine:</strong> Over 50 validation rules check for numerical consistency, sex chromosome
		coherence, and structural abnormality syntax.</li> <li class="svelte-cwls5q"><strong>Explain Module:</strong> A curated clinical library provides spec-cited interpretations for
		common abnormalities.</li></ol> <div class="note svelte-cwls5q"><p>This tool is intended for research and educational use. Always consult with a certified
		clinical cytogeneticist for diagnostic reporting.</p></div>`);
}
export {
  _page as default
};
