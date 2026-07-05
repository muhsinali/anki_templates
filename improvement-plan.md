# Upgrade Plan for Code Cards

Audited against `main` at `65c55c1` on 2026-07-05, then executed on the
`improvement-plan` branch.

This file is now the execution record for the original improvement backlog.
Items 1-19 are implemented in the current tree with tests and docs updated.
Item 20 is the only remaining external operation because GitHub branch
protection is repository settings state, not a local code change.

Status key:

- **Done** means implemented in code/docs/tests in this branch.
- **External** means it requires a GitHub repository setting or API permission.

## At a glance

| # | What | Type | Score | Status |
|---|------|------|-------|--------|
| 1 | Smart quotes in the expected answer always grade as wrong | Bug | 9/10 | Done |
| 2 | The build can silently corrupt or mangle injected JavaScript | Bug | 8/10 | Done |
| 3 | `setLinkText()` renames the wrong link | Bug | 7/10 | Done |
| 4 | Enter-key listeners pile up as you review | Bug | 6/10 | Done |
| 5 | Answer inputs are still editable on the back of the card | Bug | 6/10 | Done |
| 6 | The back template is missing the mobile viewport tag | Bug | 4/10 | Done |
| 7 | Stale `window.data` can leak between cards | Bug | 4/10 | Done |
| 8 | Add a CI pipeline | Testing | 8/10 | Done |
| 9 | Make the URL field work with plain-text paste | Improvement | 8/10 | Done |
| 10 | Add an end-to-end test of the built templates | Testing | 7/10 | Done |
| 11 | Share one test helper instead of three copies | Testing | 6/10 | Done |
| 12 | Give `window.data` and `pycmd` real types | Testing | 6/10 | Done |
| 13 | Support Anki's night mode | Improvement | 6/10 | Done |
| 14 | Show the learner what they typed, not just the answer | Improvement | 5/10 | Done |
| 15 | Do not rely on color alone for right/wrong | Improvement | 5/10 | Done |
| 16 | Sort tags alphabetically, not by ASCII | Improvement | 4/10 | Done |
| 17 | Finish dependency, Node, and lockfile hygiene | Housekeeping | 4/10 | Done |
| 18 | Sort out the `_editor_button_styles.css` import | Housekeeping | 3/10 | Done |
| 19 | Retire the unused `dist/` output | Housekeeping | 2/10 | Done |
| 20 | Protect `main` with the CI status check | Operations | 6/10 | External |

---

## What landed

### Completed before this execution pass

- **Items 1, 2, 8, 10, 11, and 12** were already complete on this branch:
  smart-quote grading, build hardening, CI, end-to-end lifecycle tests, the
  shared test harness, real coverage, and typed globals.

### Completed in this execution pass

- **Items 5, 6, and 16:** the back template now has the same mobile viewport
  tag as the front, revealed answer inputs become read-only, and tags are
  locale-sorted case-insensitively instead of ASCII-sorted.
- **Items 3 and 9:** `setLinkText()` is scoped to `#url_container`, preserves
  prompt/content links, renames existing URL-field anchors, and converts raw
  `http://` / `https://` URL text into a compact `Link`.
- **Items 4 and 7:** Enter handling is bound once per long-lived Anki webview,
  composing Enter key events are ignored, and `window.data` now stores
  `{ values, inputNames }` so the back side skips stale data whose input
  signature does not match the rendered card.
- **Items 13, 14, and 15:** grading moved from inline RGB styles to CSS classes,
  answer inputs get visible `Correct` / `Incorrect` feedback and ARIA labels,
  wrong answers preserve the learner's attempt as text, feedback is
  idempotent, and `styling.css` now includes Anki night-mode overrides.
- **Items 17, 18, and 19:** Node policy is aligned to `>=24`, local
  dependencies were refreshed to `@types/node@24.13.2`, the personal
  `_editor_button_styles.css` import was removed, and `tsconfig.json` is
  no-emit with the unused `dist/` references removed.

### Docs updated

- `README.md`: URL handling, feedback behavior, and Node requirement.
- `BUILD.md`: Node policy, style boundary, data-flow/testing details, and
  removal of `dist` / personal CSS import notes.
- `CLAUDE.md`: current architecture, `window.data` shape, URL behavior, grading
  behavior, stale-data guard, Enter guard, styling selectors, and Node policy.
- Architecture diagrams:
  - `01-system-context.md`
  - `02-build-pipeline.md`
  - `03-module-structure.md`
  - `04-runtime-data-flow.md`
  - `05-answer-validation.md`
  - `06-card-lifecycles.md`
  - `07-test-and-ci.md`

---

## Remaining external item

### 20. Protect `main` with the CI status check - 6/10

**Status: External.** The workflow exists in the repo, but merge protection only
works after the GitHub repository settings require it.

**Required setting.** Protect `main` and require the `Node 24` status check from
the `CI` workflow. Also require branches to be up to date before merging so the
green check applies to the PR head.

**Verification.** Use repository settings, the GitHub API, or a test PR to
confirm that `main` requires the `Node 24` CI status before merge.

---

## Notes from execution

- `npm install` needed network access to refresh the local install and clear the
  stale `@types/node@22.15.32` copy. After approval, `npm ls` resolved cleanly
  with `@types/node@24.13.2`.
- `npm install` reported 6 audit findings and pending install-script approvals
  for `fsevents` and `unrs-resolver`. Those were not part of this plan and were
  not auto-fixed because they can change dependency policy; they should be
  reviewed separately with `npm audit` / `npm approve-scripts`.
