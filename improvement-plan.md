# Upgrade Plan for Code Cards

Audited against `main` at `65c55c1` on 2026-07-05.

This is the current execution backlog for improving the Anki Code Cards
template system. Older versions of this file predated PR #4 and PR #5; those
changes landed the smart-quote grading fix, build hardening, CI, coverage,
shared test helpers, an end-to-end lifecycle test, property tests, typed
globals, and most dependency cleanup. Completed items are kept here because
they explain the current shape of the code and prevent duplicate work.

Status key:

- **Done** means implemented in the current tree, with tests and docs updated.
- **Partial** means the main cleanup landed, but a concrete follow-up remains.
- **Open** means the current source still has the issue.

Every new implementation step should finish the same way:

- Add or update tests before trusting the change.
- Run `make check` and, when generated templates are involved,
  `git diff --exit-code code_cards/`.
- Update `README.md`, `BUILD.md`, `CLAUDE.md`, and the relevant diagrams when
  behavior, architecture, commands, or gotchas change.

## At a glance

| # | What | Type | Score | Status |
|---|------|------|-------|--------|
| 1 | Smart quotes in the expected answer always grade as wrong | Bug | 9/10 | Done |
| 2 | The build can silently corrupt or mangle injected JavaScript | Bug | 8/10 | Done |
| 3 | `setLinkText()` renames the wrong link | Bug | 7/10 | Open |
| 4 | Enter-key listeners pile up as you review | Bug | 6/10 | Open |
| 5 | Answer inputs are still editable on the back of the card | Bug | 6/10 | Open |
| 6 | The back template is missing the mobile viewport tag | Bug | 4/10 | Open |
| 7 | Stale `window.data` can leak between cards | Bug | 4/10 | Open |
| 8 | Add a CI pipeline | Testing | 8/10 | Done |
| 9 | Make the URL field work with plain-text paste | Improvement | 8/10 | Open |
| 10 | Add an end-to-end test of the built templates | Testing | 7/10 | Done |
| 11 | Share one test helper instead of three copies | Testing | 6/10 | Done |
| 12 | Give `window.data` and `pycmd` real types | Testing | 6/10 | Done |
| 13 | Support Anki's night mode | Improvement | 6/10 | Open |
| 14 | Show the learner what they typed, not just the answer | Improvement | 5/10 | Open |
| 15 | Do not rely on color alone for right/wrong | Improvement | 5/10 | Open |
| 16 | Sort tags alphabetically, not by ASCII | Improvement | 4/10 | Open |
| 17 | Finish dependency, Node, and lockfile hygiene | Housekeeping | 4/10 | Partial |
| 18 | Sort out the `_editor_button_styles.css` import | Housekeeping | 3/10 | Open |
| 19 | Retire the unused `dist/` output | Housekeeping | 2/10 | Open |
| 20 | Protect `main` with the CI status check | Operations | 6/10 | Open |

---

## Completed work

### 1. Smart quotes in the expected answer always grade as wrong - 9/10

**Status: Done.** `revealAnswer()` now runs `parseInput()` on both sides of the
comparison:

```ts
const expected = parseInput(trueAnswer);
const actual = parseInput(data[inputName] ?? "");
```

**Evidence in the current tree.** `tests/back_template.test.ts` covers straight
vs curly quotes in both directions, `tests/property.test.ts` pins quote-style
insensitivity as a property, and `tests/integration.test.ts` covers the same
bug class through the full front -> flip -> back lifecycle. `CLAUDE.md` and
`documentation/architecture-diagrams/05-answer-validation.md` now document the
symmetrical normalization.

### 2. The build can silently corrupt or mangle injected JavaScript - 8/10

**Status: Done.** `scripts/build-templates.ts` now:

- exports `transpileSource()` as the single home of the build compiler settings;
- throws on transpile diagnostics instead of emitting broken JavaScript;
- validates required placeholders before injection;
- uses replacer callbacks so `$$`, `$&`, `` $` ``, and `$'` survive injection
  literally;
- exposes `injectJavaScript()` for direct tests.

**Evidence in the current tree.** `tests/build_templates.test.ts` covers
syntax-diagnostic failures, placeholder validation, placeholder ordering, and
literal replacement-looking JavaScript. The build pipeline docs and `BUILD.md`
describe the new behavior.

### 8. Add a CI pipeline - 8/10

**Status: Done in code; see item 20 for the required GitHub settings follow-up.**
`.github/workflows/ci.yml` runs on push and pull request with Node 24:
`npm ci`, pre-commit, both TypeScript checks, Jest with coverage thresholds,
`npm run build`, and a `git diff --exit-code code_cards/` drift gate.

**Evidence in the current tree.** README has the CI badge, `BUILD.md` documents
the workflow, and `documentation/architecture-diagrams/07-test-and-ci.md`
diagrams the test/CI gate.

### 10. Add an end-to-end test of the built templates - 7/10

**Status: Done.** `tests/integration.test.ts` builds both templates in memory
through the real build functions, substitutes Anki fields, loads the front,
types into inputs, simulates Enter, flips to the back in the same window, and
asserts grading, hints, tags, and URL anchor text.

**Remaining note.** When item 6 is fixed, add viewport assertions to either the
build-template tests or the integration suite so both base/built templates stay
mobile-consistent.

### 11. Share one test helper instead of three copies - 6/10

**Status: Done.** `tests/helpers.ts` provides `loadScripts()`, caches
transpilation, imports the build's `transpileSource()`, and appends source maps
and `sourceURL` for V8 coverage. Direct tests now cover both initializers.

**Accepted tradeoff.** Loading a template script still runs its trailing
`initialize*()` call as a side effect, because that mirrors the shipped Anki
script behavior. The docs call this out so future tests account for it.

### 12. Give `window.data` and `pycmd` real types - 6/10

**Status: Done.** `src/global.d.ts` declares the shared `Window` contract, the
source no longer needs `(window as any)` for `data` or `pycmd`, and both
pre-commit and CI run type-checks.

---

## Open bugs - fix these first

### 3. `setLinkText()` renames the wrong link - 7/10

**What's happening.** `setLinkText()` in `src/common.ts` still does
`document.querySelector("a")`, so it renames the first link anywhere on the
card. If the card prompt contains a link before the URL field, the prompt link
is changed to `"Link"` and the URL field is left alone.

**Fix with item 9.** Replace the current broad helper with URL-container scoped
behavior:

- only look inside `#url_container`;
- if `#url_container a` already exists, set that anchor text to `"Link"` and
  leave its `href` intact;
- if no URL-container anchor exists, do nothing here and let item 9 create one
  from plain text;
- never touch anchors in `{{Front}}`, `{{Back}}`, or hints.

**Tests to add.** In `tests/common.test.ts`: one anchor in card content plus one
inside `#url_container` (only the latter changes), content-only anchor (nothing
changes), empty/missing URL container (no throw). Update the integration fixture
to include a prompt link so the lifecycle test guards the bug at system level.

**Docs to update.** `CLAUDE.md` key function list and gotcha #8,
`BUILD.md` source-function table if renamed, and the shared-chrome section in
`documentation/architecture-diagrams/06-card-lifecycles.md`.

### 4. Enter-key listeners pile up as you review - 6/10

**What's happening.** `setupEnterKeyEvent()` adds a document-level `keydown`
listener every time the front template initializes and never removes or guards
it. Anki keeps the reviewer webview alive across cards, so repeated reviews can
accumulate duplicate handlers.

**Why it matters.** Today the duplicate side effect is mostly idempotent
(`preventDefault()` plus `pycmd("ans")`), but it is still a leak and makes future
keyboard behavior fragile. It can also complicate tests that load the front more
than once in the same jsdom window.

**The fix.** Add a typed guard on `window`, for example
`enterKeyHandlerBound?: boolean`, and attach the listener only once per webview.
While there, ignore `event.isComposing` so IME composition confirmation
(Japanese, Chinese, Korean input, etc.) does not reveal the answer.

**Tests to add.** Calling `setupEnterKeyEvent()` twice then dispatching one
Enter should call `pycmd("ans")` exactly once. A composing Enter should do
nothing. Keep the existing direct handler test, but add a real `document`
dispatch test because the bug is listener accumulation.

**Docs to update.** `CLAUDE.md` gotchas and
`documentation/architecture-diagrams/06-card-lifecycles.md`.

### 5. Answer inputs are still editable on the back of the card - 6/10

**What's happening.** `revealAnswer()` colors and bolds each answer input, then
overwrites its value with the expected answer, but the input remains editable.

**Why it matters.** On mobile, tapping the revealed answer can summon the
keyboard over the answer side. Nothing is being saved, so it feels broken even
though the grade is already decided.

**The fix.** Set `input.readOnly = true` for every named input processed by
`revealAnswer()`. Leave unnamed/skipped inputs untouched.

**Tests to add.** Extend the `revealAnswer` tests to assert named inputs become
read-only and unnamed inputs do not. The end-to-end lifecycle test should assert
back-side inputs are read-only after grading.

**Docs to update.** `CLAUDE.md` `revealAnswer` description and
`documentation/architecture-diagrams/05-answer-validation.md`.

### 6. The back template is missing the mobile viewport tag - 4/10

**What's happening.** `templates/front_template_base.html` and
`code_cards/front_template.html` include the mobile viewport tag. The back base
template and generated back template do not.

**Why it matters.** Mobile zoom behavior can change after the card flips,
especially around focused or recently focused inputs.

**The fix.** Copy the same viewport meta tag to the top of
`templates/back_template_base.html`, then rebuild `code_cards/back_template.html`.

**Tests to add.** Add a base-template invariant in
`tests/build_templates.test.ts` that both base templates include the viewport
meta tag exactly once, or add a lifecycle/integration assertion against both
built outputs.

**Docs to update.** Usually no prose beyond the plan/commit message, unless the
mobile behavior is called out somewhere new.

### 7. Stale `window.data` can leak between cards - 4/10

**What's happening.** The back initializer now safely skips grading when
`window.data` is missing, and the integration suite covers that. The remaining
edge is stale-but-present data: if a back side renders without its matching
front pass after a previous card, `initializeBackTemplate()` will grade using
old values.

**Why it matters.** Normal review flow overwrites `window.data` on the front, so
this is uncommon. It can still happen in preview, undo, editing mid-review, or
other reviewer edge flows. If the stale data has matching input names, the
result could even look falsely correct.

**The fix.** Do not blindly clear `window.data` after grading; that can break a
back-side re-render. Prefer a versioned payload:

```ts
interface CardInputData {
  values: Record<string, string>;
  inputNames: string[];
  cardKey?: string;
}
```

At minimum, store the ordered input-name signature on the front and refuse to
grade on the back if the recreated inputs do not match it. If Anki exposes a
stable card/note identifier that can be rendered into both sides, store and
check that as `cardKey`; otherwise document that same-shape cards can only be
fully solved with an Anki-provided identity.

**Tests to add.** Back without front remains ungraded; stale data with different
input names is refused; same input names across a re-render of the same back
still grade. If a `cardKey` is available, add a mismatch test for it.

**Docs to update.** `src/global.d.ts`, `CLAUDE.md` data-flow section,
`documentation/architecture-diagrams/04-runtime-data-flow.md`, and
`06-card-lifecycles.md`.

---

## User-facing improvements

### 9. Make the URL field work with plain-text paste - 8/10

**What's happening.** `{{URL}}` renders directly into `#url_container`.
`setLinkText()` only renames an anchor that already exists. That means a raw
plain-text URL in the field is inert text, despite the README telling authors
to paste the URL as plain text.

**Why it matters.** The current linking instructions are both confusing and
wrong for the current implementation: formatted/anchor URLs are the ones the
code can rename, while raw URLs are the workflow the docs recommend.

**The fix.** Do this with item 3. Introduce a URL-container helper, for example
`renderUrlField()`:

- find `#url_container`;
- if it contains an anchor, set the anchor text to `"Link"`;
- otherwise read trimmed text content and, when it is an `http://` or
  `https://` URL, replace the container contents with an `<a>` whose `href` is
  that URL and whose text is `"Link"`;
- use DOM APIs and `textContent`, not HTML string concatenation;
- leave junk/empty values untouched.

**Tests to add.** URL container with raw `https://...` creates an anchor; raw
`http://...` also works; existing anchor is renamed without changing `href`;
empty/junk text does nothing; prompt links outside `#url_container` are
untouched. Add an integration scenario where the fixture URL is plain text, not
an anchor.

**Docs to update.** Rewrite README's Linking section. Update `CLAUDE.md`,
`BUILD.md` if the helper is renamed, and
`documentation/architecture-diagrams/06-card-lifecycles.md`.

### 13. Support Anki's night mode - 6/10

**What's happening.** `code_cards/styling.css` assumes a light background:
gray code blocks, pale blue hints, light link color, and inline green/red
grading backgrounds. Anki night mode adds `.nightMode` to `.card`; the stylesheet
does not handle it.

**The fix.** Add `.card.nightMode` styles for the card, code block, hint, tags,
URL link, and inputs. Pair this with item 15 by moving grading from inline
colors to CSS classes such as `.answer-correct` and `.answer-wrong`, allowing
night-mode-specific colors and non-color indicators.

**Tests to add.** `revealAnswer` tests should assert classes instead of exact
RGB strings. Add class-specific assertions for correct/wrong inputs and keep an
integration assertion that the shipped lifecycle applies those classes. CSS
visual contrast still needs a manual Anki/night-mode check.

**Docs to update.** README feature list, `CLAUDE.md` styling reference,
`BUILD.md` styling notes, and
`documentation/architecture-diagrams/05-answer-validation.md`.

### 14. Show the learner what they typed, not just the answer - 5/10

**What's happening.** `revealAnswer()` overwrites each input's value with the
correct answer. For wrong answers, the learner loses the attempt and cannot
compare what they typed against what was expected.

**The fix.** Keep the expected answer in the input, but preserve the learner's
attempt for wrong answers. A small text node or span after the input is more
readable than a title-only tooltip, as long as it is inserted with
`textContent`, is styled compactly, and is not duplicated if grading runs twice.

**Tests to add.** Wrong answer shows the attempt; correct answer does not add
extra clutter; malicious-looking input is displayed as text, not HTML; a second
`revealAnswer()` call does not duplicate the attempt UI.

**Docs to update.** README features, `CLAUDE.md` `revealAnswer` description, and
`documentation/architecture-diagrams/05-answer-validation.md`.

### 15. Do not rely on color alone for right/wrong - 5/10

**What's happening.** Green background means correct and red background means
wrong. That is the only signal.

**The fix.** Add a second channel: visible "Correct"/"Incorrect" markers, an
icon-like mark, distinct border styles, and/or `aria-label`/`aria-describedby`
for screen readers. This pairs naturally with item 13's move from inline styles
to classes and item 14's attempt display.

**Tests to add.** `revealAnswer` tests assert the class plus the non-color
marker/label for correct and wrong answers. Integration should assert at least
one correct and one wrong marker in a mixed-answer fixture.

**Docs to update.** README features, `CLAUDE.md`, and
`documentation/architecture-diagrams/05-answer-validation.md`.

### 16. Sort tags alphabetically, not by ASCII - 4/10

**What's happening.** `displayTags()` still uses plain `.sort()`, which sorts by
code point. Uppercase tags come before lowercase tags, so the README's
"alphabetical order" promise is not quite true.

**The fix.**

```ts
tags
  .map(prettifyTag)
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  .join(", ");
```

**Tests to add.** Update the existing `displayTags` test that currently encodes
the ASCII order, and add a mixed-case test. Keep the integration test stable by
choosing fixture tags whose order is unambiguous.

**Docs to update.** The `displayTags` line in `CLAUDE.md`. README's tagging
section should then be true as written.

---

## Housekeeping and operations

### 17. Finish dependency, Node, and lockfile hygiene - 4/10

**Status: Partial.** The big cleanup landed: Jest and `@types/jest` are on v30,
the direct `jsdom` dependency was removed (it now arrives through
`jest-environment-jsdom`), Prettier was removed, `private: true` exists, `.nvmrc`
is `24`, and `ts-jest@29.4.0` advertises peer support for Jest 30.

**What's still wrong.**

- The local install is stale: `npm ls` currently exits non-zero because
  `node_modules/@types/node` is `22.15.32` while `package.json` requires
  `^24.13.2`.
- `package.json` says `"node": "24.x"` while the root metadata in
  `package-lock.json` says `">=24"`.
- Local execution during this audit used Node `v26.4.0`, which is outside the
  strict `24.x` engine declared by `package.json`, even though tests and
  type-checks passed.

**The fix.** Choose one Node policy and make every file agree. If the project
really supports only Node 24, use `24.x` consistently in `package.json`,
`package-lock.json`, `.nvmrc`, CI, README, BUILD, and CLAUDE. If Node 24+ is the
policy, use `>=24` consistently and update the docs. Then refresh the lockfile
and local install with the chosen Node version so `npm ci`, `npm ls`, and
`make check` are all clean.

**Tests to add.** No new unit tests. Verification is `npm ci`, `npm ls`,
`make check`, and the existing CI job.

**Docs to update.** README development prerequisites, `BUILD.md` prerequisites,
`CLAUDE.md` commands/gotchas, and `improve-test-infrastructure.md` if its
execution record keeps mentioning the opposite Node policy.

### 18. Sort out the `_editor_button_styles.css` import - 3/10

**What's happening.** `code_cards/styling.css` still starts with
`@import url("_editor_button_styles.css")`, a file that is not in this repo and
only exists in the author's personal Anki media collection.

**Why it matters.** Every other user gets a silent missing-file request in Anki.
The docs explain the gotcha, but the better default is no hidden personal
dependency.

**The fix.** Prefer deleting the import unless its contents are required for the
cards. If those styles matter, commit the CSS file and document how users copy
it into Anki media. Either way, make the repo self-explanatory.

**Tests to add.** Add a lightweight assertion that `styling.css` does not import
missing local files, or cover this through an integration/static asset test if a
CSS test home already exists by then.

**Docs to update.** Remove or rewrite the CSS-import gotchas in `CLAUDE.md`,
`BUILD.md`, and `documentation/architecture-diagrams/01-system-context.md`.

### 19. Retire the unused `dist/` output - 2/10

**What's happening.** `tsconfig.json` still declares `"outDir": "dist"`, so a
plain `npx tsc` can emit files that the project never reads. The real build
transpiles in memory and writes only `code_cards/*.html`.

**The fix.** Add `"noEmit": true` to `tsconfig.json`, remove `"outDir": "dist"`,
and delete `dist` references from `.gitignore`, `Makefile clean`, `CLAUDE.md`,
`BUILD.md`, and `documentation/architecture-diagrams/03-module-structure.md`.
Keep using explicit `--noEmit` in commands if desired; the config should make
the safe behavior the default.

**Tests to add.** No runtime tests. Verification is both type-check commands and
`make check`.

**Docs to update.** The directory tree in `CLAUDE.md`, the Make target table in
`BUILD.md`, and the module-structure diagram notes.

### 20. Protect `main` with the CI status check - 6/10

**What's missing.** CI exists, but a workflow only blocks merges if GitHub branch
protection requires it. That setting is outside the repository files and cannot
be verified from the current checkout.

**What to do.** In GitHub repository settings, protect `main` and require the
`Node 24` status check from the `CI` workflow. Also require branches to be up to
date before merging so the green check applies to the PR head.

**Tests to add.** This is operational, not a code test. Verification is a small
test PR or repository settings/API check showing `main` requires the `Node 24`
CI status.

**Docs to update.** `BUILD.md` already mentions this; update it only if the
required check name changes.

---

## Suggested order of attack

1. **Quick behavior fixes:** item 6 (back viewport), item 5 (read-only back
   inputs), and item 16 (locale tag sorting). These are small and have obvious
   tests.
2. **URL/link pass:** items 3 and 9 together. They share the same helper and
   docs; doing them separately would create churn.
3. **Keyboard/state safety:** item 4, then item 7. The listener guard is simple;
   stale `window.data` needs a deliberate payload shape and docs.
4. **Answer UX/accessibility:** items 13, 15, and 14 together if possible,
   because classes, night mode, non-color markers, and attempt display all touch
   `revealAnswer()` and the same CSS.
5. **Housekeeping and operations:** items 17, 18, 19, and 20. Keep these in
   separate commits from learner-visible behavior changes.

The plan is now in a good state to execute: the testing foundation is already
strong enough to support the remaining behavior changes, and the highest-risk
old items are either fixed or clearly separated from the still-open work.
