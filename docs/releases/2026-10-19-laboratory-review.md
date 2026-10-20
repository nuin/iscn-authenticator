# Laboratory review release evidence

Release verified on 2026-10-20 UTC (2026-10-19 in America/Edmonton).

## Delivered build

- Source commit: `fead6724949f6a633759b5ce61bf8def1473d6c7`, pushed on
  `extract-python-library-cutover`.
- Cloudflare Pages project: `iscn-web`; production branch label: `master`.
- Deployment ID: `fee4f1ea-d3e7-4d8f-a0ea-e091d6699466`.
- Immutable deployment: <https://fee4f1ea.iscn-web.pages.dev>.
- Production workspace: <https://iscn-web.pages.dev/review>.
- Prior production deployment: `5f16a682-e02c-4ddd-984c-b57231fefc1e`, source `405e779`.
- Python revision: `47e1c8124364952e0afeff71128d43e526716354` on
  `fix/cell-line-validation`; fixture tag: `fixtures-lab-review-20261019`.

The Pages deployment uses the built SvelteKit output. This release changes no D1
schema, bindings, billing secrets or persisted review data. No npm/PyPI release
or branch merge was performed. This evidence document records the deployed code
commit; a later documentation-only commit does not change that build.

## Verification

| Check | Result |
|---|---|
| Core against published fixture tag | 67 Deno tests and 7 Node tests passed |
| Python reference library | 290 unittest/Hypothesis tests passed |
| Independent adversarial/source parity review | 24 cases matched validity, errors and coverage in both runtimes |
| FastAPI wrapper, Python 3.11 and 3.14 | 16 tests passed on each, including warnings-as-errors runs |
| Deno service | 288 tests passed; entrypoints type-checked |
| Embedded browser/OpenAPI assets | Regenerated; freshness and runtime parity checks passed |
| Web unit and built Pages/D1 integration | 108 tests passed |
| Browser workflows | 16 tests passed; final screenshot-helper change reran its 5 affected tests successfully |
| Svelte check / production build | Passed; zero Svelte errors or warnings |
| Cloudflare binding types | Current |
| Desktop/mobile visual checks | Report, FISH and side-guide captures inspected; tested viewport widths fit |
| Aislop | 99/100; zero errors, four nonfixable false-positive URL warnings |
| Git whitespace check | Passed |

The four Aislop warnings refer to stable ISCN DOI, erratum DOI, UCSC dataset and
PMC framework links in `review/references.ts` and `review/cnv-criteria.ts`.
They are scientific references rather than deployment endpoints. The links and
rules remain intact under the repository's false-positive policy.

## Production smoke checks

The canonical production origin was exercised after deployment using synthetic,
non-identifying data. All checks passed:

- Workspace, new guides, existing public routes and evaluation downloads returned
  expected responses. Invalid account credentials/session checks reached D1.
- Routine count/chromosome/band failures were detected; acquired X/Y losses and
  related clones retained the appropriate review notices.
- Multiple-line validation, abnormal-first examples and 24 reference centromeres
  remained functional.
- Report QC reconciled totals, exported JSON and cleared stale results. Opening
  the side documentation preserved the current input and result.
- FISH construction distinguished `>` from `>=` at exact threshold equality.
- CNV input produced the synthetic 0.99 boundary result and an unauthenticated
  JSON record; incomplete input and edited evidence suppressed the score.
- Review interactions sent no entered payload in requests and left localStorage
  empty. Mobile layout and result focus passed; no browser runtime errors occurred.

These checks verify the exercised software behavior, not complete ISCN coverage,
clinical performance, laboratory acceptance or commercial launch readiness.
See [coverage](../notation-coverage.md), [workflows](../laboratory-review.md) and
[CNV limits](../cnv-evidence.md).

## Separate domain status

Cloudflare reports `iscn.bioinformat.org` as pending with `CNAME record not set`.
It still needs the proxied `iscn` CNAME pointing to `iscn-web.pages.dev` in the
`bioinformat.org` zone. Production verification above used the Pages origin;
this record does not claim the custom domain is active.
