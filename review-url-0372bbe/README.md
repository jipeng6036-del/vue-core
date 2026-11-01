# Unquoted CSS URL review follow-up

Candidate [`0372bbe`](https://github.com/jipeng6036-del/vue-core/commit/0372bbe363f900e154e5143de6b155519f86af0f) fixes the [reviewed URL-token case](https://github.com/vuejs/core/pull/16076#discussion_r4434098173) on top of `b4c0ef3`. Existing source authorship and co-authorship remain in the two earlier commits.

An unquoted URL may contain square/curly brackets and semicolons; its first unescaped closing parenthesis ends the token. The parser now recognizes complete case-insensitive and CSS-escaped URL names. Quoted URLs, other function names, hash tokens and at-keywords keep their ordinary parsing behavior. HTML-comment-open tokens are boundaries too. This remains an inline-style declaration parser rather than a full CSS validator.

- Added 30 unit/compiler/SSR cases. Complete affected regression set: previous head 61/80, fixed 80/80.
- Full local unit suite 3980 passed, 5 skipped; all 120 E2E passed. Quality, builds, types/declarations and treeshaking passed.
- Identically built and independently installed local packages: previous head 100/155, fixed 155/155. Each arm verifies 124 tar payload files against its built files before installation.
- Three browser cases explicitly check native CSS rejection of an undefined dashed custom function and retention of an existing property value after a rejected update. Other fixtures must match their unchanged native CSSOM value. See the documented initial harness correction in `validation.json`.

Run `python build-packed-proof.py /absolute/path/to/the/candidate-checkout` after installing the pinned pnpm dependencies and Playwright Chromium. The script uses the same build command (`pnpm run build --withTypes`) for both arms, restores only the shared parser from `b4c0ef3` for the reference arm, installs all local package tarballs in separate consumers, and restores candidate source/artifacts in `finally`. Node module resolution is asserted to remain inside the installed consumers; browser Vue is loaded from the packed package, without source aliases or NODE_PATH overrides.

AI-assisted implementation and validation; no human review is claimed. [Original fork CI](https://github.com/jipeng6036-del/vue-core/actions/runs/41268271915) passed all four test/quality jobs; its guarded continuous-release job was skipped. See `fork-ci.json`.
