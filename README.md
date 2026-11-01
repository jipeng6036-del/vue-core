# CSS declaration block verification

Latest review follow-up: [unquoted CSS URL tokens on `0372bbe`](review-url-0372bbe/README.md). The original `b4c0ef3` submission evidence below is preserved.

Candidate: [`b4c0ef3`](https://github.com/jipeng6036-del/vue-core/commit/b4c0ef322ddd3be40ff760c97d44a8ee8bc3037a), based on upstream `24c9d0b`.

Preserves Suliman Abdulrazzaq's [#15641](https://github.com/vuejs/core/pull/15641), source `d19e2d9`, through cherry-pick `e46f444`. The additional change tracks matching square/curly/parenthesis delimiters, including nested blocks. The new tests exercise shared parsing, template compilation and SSR. Original quote/comment tests are retained. AI agents assisted implementation and validation; no human review is claimed.

## Results

- Shared/compiler/SSR regression set: baseline 34/50; original patch 40/50; candidate 50/50.
- Identically built, packed and independently installed packages: baseline 10/45; original patch 20/45; candidate 45/45.
- Each arm verifies 124 tar payload files against the built files before installation. pnpm rewrites the package manifests' workspace dependency versions. Module resolution is asserted to stay within each independent consumer.
- The 45 checks exercise `createSSRApp`/`renderToString`, compiled templates, browser mounting and reactive DOM updates. Real Chromium CSSOM independently preserves the six custom-property block fixtures.
- Local unit/quality/build/type/E2E results and initial failed attempts are distinguished in `validation.json`. [Original fork CI](https://github.com/jipeng6036-del/vue-core/actions/runs/41263505693) passed all four test/quality jobs; the guarded continuous-release job was skipped. See `fork-ci.json`.

## Reproduce on Windows or Linux

Clone the candidate fork branch (full history), install with the pinned pnpm using `PUPPETEER_SKIP_DOWNLOAD=true`, and run `pnpm exec playwright install chromium` from that checkout. Then run:

```text
python build-packed-proof.py /absolute/path/to/candidate-checkout
```

This writes packages and three isolated consumer directories next to this script. It temporarily restores only the parser implementation from the baseline and original-patch commits for their arms, builds every arm with `pnpm run build --withTypes`, and restores the candidate implementation and artifacts in `finally`. All other runtime source stays at the same upstream base. The fixed regression tests are not shipped in the npm packages.

The harness uses the checkout's Playwright only as browser tooling; Vue code is loaded exclusively from each consumer's installed local package tarballs. No source alias or NODE_PATH override is used. Baseline/original proof exit1 is expected because they fail the specified behavior checks.
