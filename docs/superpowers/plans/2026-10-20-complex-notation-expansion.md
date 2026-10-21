# Complex notation expansion

Continue the laboratory review work by closing bounded gaps exposed by the complex
karyotype corpus. Authority: the local ISCN 2024 reference, sections 5.5.3,
6.3.4 and 6.3.5, with the registered Karger erratum. Synthetic examples are
engineering regression tests, not clinical validation.

## Constraints and interfaces

- Keep TypeScript and the separate Python reference implementation aligned.
- Preserve `raw`, literal clone `changes`, and the original reference token.
- Add optional `multiplier` and `adjusted` to clone references and `composite`
  to cell lines. Existing fields keep their meanings.
- A composite count belongs to its group. Do not inherit it into other groups
  or use aggregate composite findings as a reference clone.
- Expand safe integer multipliers using copy counts, not duplicated object lists.
  Cap expanded sex complements at 4096 characters to bound allocation. This is
  an implementation limit, not an ISCN restriction.
- Resolve subtraction only for a unique, certain inherited single-autosome
  structural finding. Removing that chromosome retains the numerical loss;
  a written gain may cancel it. Reject ambiguous operations with a request to
  spell out the clone. Leave sex chromosome operations for manual review.
- Check recognizable flat derivative components using existing chromosome,
  band and breakpoint rules. Abbreviated components remain partial. Do not
  claim centromere reconstruction or complete derivative path validation.
- Transformed clone arithmetic remains visibly partial; literal longitudinal
  comparison must not report misleading persistence from its preserved raw text.
- Advance immutable fixture/API pins, document limits, run tests and aislop,
  review, commit, push and deploy under the user's existing authorization.

## Tasks

### Task 1: Derivative component checks

- [x] Add failing cases for nested invalid chromosomes/bands, malformed grouping,
  and controls for abbreviated and sequential rearrangements.
- [x] Add a bounded component checker in both implementations. Keep complex
  coverage notes and preserve source text.
- [x] Run targeted tests and both complete core suites.

### Task 2: Group-local composite counts

- [x] Add failing mixed composite/noncomposite tests, including a bad total in
  a later ordinary clone and references to an aggregate group.
- [x] Parse counts per group, construct validation/coverage contexts centrally,
  expose group metadata and label aggregate counts in the workspace.
- [x] Run core and report tests.

### Task 3: Bounded clone arithmetic

- [x] Add failing multiplier, subtraction, cancellation, ambiguity, overflow,
  source immutability and dependent sideline tests.
- [x] Expand clones in both implementations, preserve provenance, check
  inferable totals and prevent misleading literal comparisons.
- [x] Run core, Python, API, report and browser regressions.

### Task 4: Documentation, parity and release

- [x] Update complex corpus expectations and add adversarial cases; verify
  Python/TypeScript outcomes and expanded structures agree.
- [x] Update coverage, API schema, laboratory guides and release evidence.
- [x] Pin the Python commit/fixture tag, regenerate artifacts, run full checks
  and aislop, and obtain one fresh whole-change review.
- [ ] Commit/push, deploy Pages and run the live complex corpus.

## Review focus

Check ambiguous structural subtraction, implicit numerical losses, independent
clone branches, inherited copy counts, overflow, donor boundaries, composite
modifier leakage, partial derivative syntax and original-text fidelity. Verify
that review statuses and report comparisons cannot imply complete reconstruction.
