# Notation coverage

The validator checks a bounded subset of ISCN 2024. A result with `valid: true` means the implemented checks found no errors. It does not establish full ISCN compliance, biological clonality, clinical significance, or completeness of a laboratory report. Use the coverage result alongside validity.

## Coverage API

TypeScript exports `getValidationCoverage(parsed)`; Python exports `get_validation_coverage(parsed)`. Both return `level`, `notes`, `reference`, `rule_version`, and `band_reference`. Levels are `supported`, `partial`, and `unparsed`. `supported` describes coverage of the implemented routine checks and is independent of whether those checks passed. A parsed invalid karyotype can therefore have supported coverage.

The reference is `ISCN 2024`; the core rule version is `2026-10-20.2`; the band reference is `UCSC hg38 cytoBand`. Applications must present partial or unparsed results for review. The existing `valid`, `errors`, and `parsed` validation contract is unchanged.

## Checked and deferred notation

| Notation | Implemented checks | Remaining limits |
|---|---|---|
| Routine single line, e.g. `46,XX[20]` | Numeric chromosome count, sex field, supported abnormalities, optional positive metaphase count | A bracketed count does not make the input a mosaic |
| Multiple cell lines | Each line receives its own rules; each requires a positive metaphase count; normal lines follow abnormal lines | Ordering multiple abnormal clones requires specimen context and further tie-break rules |
| Recipient/donor groups | One `//` boundary; groups and line order preserved | Donor identity and transplant context require review |
| Numerical autosomal changes | Chromosomes 1–22; conservative total check where the diploid assumption is reliable | No inferred total for ranges, composite descriptions, unknown or uncertain changes, multiplicities, or count-changing structural notation |
| Acquired sex chromosome changes | X/Y identifiers, syntax, explicit loss-of-X context including a remaining Y | Total coherence is deferred: acquired changes and the reported sex complement cannot be naively added together |
| Polyploid/hypohaploid counts | Positive safe integers and ascending ranges; counts are not restricted to 23–92 | Ploidy and full numerical balance require review; positive arithmetic alone does not establish biological plausibility |
| Common structural abnormalities | Existing breakpoint-number/arm checks, chromosome identifiers, mapped band checks | This does not check all event-specific biological or nomenclature constraints |
| Insertions | One chromosome with three concatenated breakpoints, or two chromosomes with a site and a two-breakpoint segment separated by `;` | Other insertion layouts are explicitly rejected as unsupported; no unmatched layout bypasses band checks |
| Related clones | `idem`, `sl`, numbered `slN`, `sdlN`, unique unnumbered `sdl`; safe integer `xN`/`×N` multipliers; unique autosomal structural subtraction and opposite numerical cancellation | Ambiguous sideline families, aggregate references and ambiguous/absent subtraction require explicit restatement; expanded operations retain review coverage |
| Composite counts | Group-local `[cpN]` or legacy `.cp[N]`, including mixed composite/ordinary groups; positive safe counts | Aggregate counts do not establish per-abnormality frequencies or co-occurrence; per-abnormality bracket counts remain unsupported |
| `der`, `+der`, `-der` | Outer chromosome identifiers, balanced parentheses, recognizable flat component chromosome/band/breakpoint checks and simple junction band lists | Abbreviated components only receive chromosome checks; complete paths, centromere reconstruction, phase and sequential-event consistency require review |
| `rec`, `cpx`, `cth`, `cpy`, `upd` | Outer form and chromosome identifiers | Complete event structure and interpretation are partial coverage |
| Unknown abnormality tokens | Original text retained | These produce partial coverage even if no implemented rule reports an error |
| FISH | Standalone `nuc ish(...)`, space/tab-separated `nuc ish (...)`, and appended `.ish` payload retained | Full FISH grammar, signal interpretation, probe validity and clinical cutoffs are not validated by core |
| Array and OGM | Appended `.arr` / `.ogm` payload retained | Full assay grammar, coordinates, assemblies and interpretation are not validated; standalone assay descriptions may be unparsed |

The laboratory review FISH builder checks its separate, bounded structured copy-number input. That does not broaden core coverage of arbitrary FISH expressions. CNV evidence assessment is also separate from notation validity.

## Numerical totals

The automatic total uses 44 autosomes plus the written sex complement and explicit autosomal gains/losses. It applies only to numeric counts from 40 through 55, one to four X/Y characters, and a restricted set of count-preserving autosomal structural types (`del`, `dup`, `inv`, `t`, `add`, `trp`, `qdp`, `i`, `fra`, `ins`). Any numerical X/Y change, structural sex-chromosome change, unknown event, multiplicity, uncertainty, composite, or other structural type defers the total. This is a deliberately bounded check, not a general ploidy reconstruction algorithm.

For example, `46,XX,+21` fails the implemented total check; `47,XX,+21[20]` passes it. A polyploid input such as `184,XXXXXXXX[4]` retains its count and receives partial coverage. A reported total outside the diploid-check interval receives no inferred balance verdict. Zero, negative, fractional, or unsafe chromosome and metaphase counts are rejected. Cross-runtime integers are limited to 9,007,199,254,740,991.

## Cytoband reference

The bundled catalogue is the UCSC hg38 `cytoBand` dataset, reused by the ideogram. It is not a complete ISCN atlas and does not prove the existence of every finer ISCN subband. A catalogue match includes an exact band or a parent band supported by catalogue children. A designation finer than a known catalogue band is retained with a coverage note. A region-only breakpoint such as `p1?` retains `band: null` and uncertainty; it is never converted to centromeric `p10`.

Literal `p10` and `q10` are recognized centromeric designations. A band that matches neither a catalogue band nor its hierarchy is reported as absent from this particular catalogue; users should verify reference disagreement against the authoritative ISCN atlas. Malformed band digits such as `p101` are rejected rather than normalized into a different band. The validator checks the correct chromosome for each breakpoint in supported insertions and multi-chromosome events.

Catalogue source: [UCSC hg38 cytoBand download](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBand.txt.gz). Python bundles an identical copy of the TypeScript catalogue, without a runtime download or dependency.

## Related-clone provenance

`idem` refers to the first clone in its recipient/donor group, including after another fully written clone. `slN` selects the Nth preceding fully written non-reference line in that group; intervening sidelines do not increment the stemline index. Unnumbered `sl` requires one preceding stemline. With a single stemline, sidelines are numbered in written order: `sdl1` references the first preceding resolved sideline, `sdl2` the second. Unnumbered `sdl` requires exactly one preceding sideline. With multiple stemlines, `sdl` and `sdlN` require explicit restatement because this implementation does not infer their family. Mixing `idem` with `sl`/`sdl`, future references and references across a donor boundary are rejected. Numbering follows the submitted text; the implementation does not establish biological clone identity from similarity.

The AST keeps the original complete input in `raw`. Single-line metaphase counts use `count` and leave `cell_lines: null`. Each explicit cell line keeps `raw`; a resolved related line also carries `reference: { token, cell_line }`, where `cell_line` is one-based within its recipient/donor group, and `changes`, containing the written additional abnormalities. Its `abnormalities` list contains the resolved inherited plus additional findings. Each abnormality retains its literal `raw` text, including accepted Unicode minus and multiplication signs. This expansion represents the written reference and does not establish that the clones are biologically related.

### Numbered stemline example

```text
45,XY,-7[5]/46,sl1,+8[6]/46,XY,t(9;22)(q34;q11.2)[3]/92,sl2x2[5]/93,sl2x2,+8[2]
```

Here `sl1` selects line 1. `sl2` selects line 3, because line 2 is a
reference-derived sideline. Lines 4 and 5 independently double line 3: each
inherits two copies of its translocation, and only line 5 adds chromosome 8.
Neither inherits the first family's chromosome 7 loss. Their metadata records
`reference.cell_line: 3` and `reference.multiplier: 2`; the literal reference token
and original line remain unchanged. The case retains review coverage for clone
ordering and expanded arithmetic.

Within a donor group, numbering restarts after `//`. Composite groups occupy
their written position among fully written lines but cannot supply a reference;
they are never silently skipped to make an index select a different source.
For multiple stemlines, use explicit `slN` plus the complete additional changes,
or write the whole line. These restrictions describe implementation limits,
not a claim that all other shorthand is invalid under ISCN.

## Expanded clones and composite groups

A multiplier such as `47,XY,+8[10]/94,idemx2[5]` expands the referenced sex
complement to `XXYY` and the inherited gain to `copy_count: 2`. The original
`+8` raw token is retained. Multipliers compose when an explicitly selected
sideline is multiplied again. Expanded sex complements are capped at 4096
characters; this is an allocation limit, not an ISCN ploidy limit. Unsafe integer
arithmetic, including intermediate sums before cancellation, is rejected. `U` remains undisclosed.

Subtraction currently supports a unique, certain inherited single-autosome
`del`, `dup`, `inv`, `add`, `trp`, `qdp`, `i`, `r` or `idic`. An optional complete
breakpoint list disambiguates the target. Removing `-inv(3)` removes the inverted
chromosome: `46,XX,inv(3)(p21q26)[10]/45,idem,-inv(3)[5]` therefore resolves to a
numerical loss of chromosome 3. A written `+3,-inv(3)` cancels that loss and
restores the numerical total. Removing more copies than inherited, an uncertain
finding, an absent target or an ambiguous target fails with a restatement
message. Multi-chromosome and derivative subtraction remain unsupported.

When multiplication or cancellation is applied, the numeric source count times
the multiplier plus inferable written changes is checked against a numeric target
count. Ranges, uncertain changes, X/Y operations and unsupported structural
changes do not receive this total inference. This arithmetic does not establish
ploidy, phase or a complete physical chromosome reconstruction.

`reference.multiplier` records a non-unit multiplier; `reference.adjusted` marks
subtraction, cancellation or inherited transformation. `changes` always contains
the literal written operations. A resolved abnormality's `raw` may describe its
source operation, not a canonical rendering of the resolved finding. Consumers
must use the typed fields and copy counts for resolved data, and `line.raw` for
display. Do not reconstruct a purported ISCN string by joining resolved raw
findings. The report workspace withholds literal previous/current comparison
when either result contains these transformations.

For `45~47,XX,+8[cp12]/46,XX[8]`, the first line has `composite: true` and `count: 12`;
the second has an ordinary count of 8. The report denominator is 20 metaphases,
with 60% in the aggregate group; it does not mean every finding occurred in 60%
of cells. A standalone composite retains `modifiers.composite` and also exposes
`count`. Mixed groups never place a composite modifier on the entire karyotype.
Composite groups cannot supply or consume clone references.

## References and verification

The implementation was checked against local ISCN 2024 sections 4.5.3, 5.3.1.2, 5.4, 6.3.4–6.3.7 and these publisher corrections:

- [March 2025 erratum, DOI 10.1159/000543493](https://karger.com/cgr/article-pdf/165/2/99/4350726/000543493.pdf): includes corrected composite-example bands.
- [July 2025 erratum, DOI 10.1159/000546684](https://karger.com/cgr/article/165/6/369/929293/Erratum): includes a corrected polyploid range and assay examples.
- [December 2025 online / 2026 issue erratum, DOI 10.1159/000549238](https://karger.com/cgr/article/166/1/64/939149/Erratum-ISCN-2024-An-International-System-for): includes corrected chromosome totals and derivative descriptions.

The errata review does not imply complete implementation of every corrected example or assay. Synthetic regression cases cover the audited failures, neighbouring valid inputs, ambiguous clone references, acquired sex losses, polyploid counts, band precision, insertion mapping, uncertainty and oversized numbers. The shared immutable fixture corpus is consumed by both runtimes; Python also runs Hypothesis properties. See the release guide for the exact committed dependency and corpus pins.
