# Upgrade Plan for Code Cards

This is a prioritised to-do list for improving the project, based on a full read-through
of the source, templates, tests, build script, and styling. Each item gets a score from
1 to 10 for how much impact fixing it would have. Bugs come first — there's no point
polishing features while known defects can mark a correct answer wrong.

Every item ends with two things on purpose:

- **Tests to add** — so the fix stays fixed. The test suite should grow with every change.
- **Docs to update** — so `CLAUDE.md`, `BUILD.md`, `README.md`, and the diagrams in
  `documentation/architecture-diagrams/` never drift from reality.

## At a glance

| # | What | Type | Score |
|---|------|------|-------|
| 1 | Smart quotes in the expected answer always grade as wrong | Bug | 9/10 |
| 2 | The build can silently corrupt injected JavaScript | Bug | 8/10 |
| 3 | `setLinkText()` renames the wrong link | Bug | 7/10 |
| 4 | Enter-key listeners pile up as you review | Bug | 6/10 |
| 5 | Answer inputs are still editable on the back of the card | Bug | 6/10 |
| 6 | The back template is missing the mobile viewport tag | Bug | 4/10 |
| 7 | Stale `window.data` can leak between cards | Bug | 3/10 |
| 8 | Add a CI pipeline (GitHub Actions) | Testing | 8/10 |
| 9 | Make the URL field work with plain-text paste | Improvement | 8/10 |
| 10 | Add an end-to-end test of the built templates | Testing | 7/10 |
| 11 | Share one test helper instead of three copies | Testing | 6/10 |
| 12 | Give `window.data` and `pycmd` real types | Testing | 6/10 |
| 13 | Support Anki's night mode | Improvement | 6/10 |
| 14 | Show the learner what they typed, not just the answer | Improvement | 5/10 |
| 15 | Don't rely on colour alone for right/wrong | Improvement | 5/10 |
| 16 | Sort tags alphabetically, not by ASCII | Improvement | 4/10 |
| 17 | Tidy up the dev dependencies | Housekeeping | 3/10 |
| 18 | Sort out the `_editor_button_styles.css` import | Housekeeping | 3/10 |
| 19 | Retire the unused `dist/` output | Housekeeping | 2/10 |

---

## Bugs — fix these first

### 1. Smart quotes in the expected answer always grade as wrong — 9/10

**What's happening.** `revealAnswer()` in `src/back_template.ts` normalises the *learner's*
input with `parseInput()` (curly quotes → straight quotes, whitespace stripped), but the
*expected* answer — the input's `name` attribute — only gets its whitespace stripped:

```ts
const expected = trueAnswer.replace(/\s+/g, "");   // no quote normalisation!
const actual = parseInput(data[inputName] ?? "");  // fully normalised
```

**Why it matters.** If a card author's `name` attribute ever contains curly quotes —
which happens easily when pasting from a website, or when an editor "helpfully" converts
them — the two sides can never match. The learner types the right answer with straight
quotes and gets marked wrong every single time, with no clue why.

**The fix.** One line: run `parseInput()` on both sides.
`const expected = parseInput(trueAnswer);`

**Tests to add.** A `revealAnswer` case where the `name` contains curly quotes and the
typed answer uses straight ones (should be green), plus the reverse. Also extend the
`parseInput` tests with backticks and non-breaking spaces while you're in there.

**Docs to update.** The normalisation table in
`documentation/architecture-diagrams/05-answer-validation.md` currently *documents* this
asymmetry ("the expected value only has whitespace stripped") — rewrite that section.
Also the "Answer Validation System" bullet in `CLAUDE.md`.

### 2. The build can silently corrupt injected JavaScript — 8/10

**What's happening.** `scripts/build-templates.ts` injects transpiled JS with
`baseTemplate.replace("%COMMON_JS%", commonJs)`. When the replacement argument is a
*string*, JavaScript treats `$$`, `$&`, `` $` ``, and `$'` as special substitution
patterns. This is verified, not theoretical: injecting code containing `"$$"` produces
`"$"` in the output, and `"$&"` becomes the literal text `%COMMON_JS%`.

**Why it matters.** Today's source code happens to contain no `$` patterns, so nothing is
broken *yet*. But the first time someone writes `"$$"` in a string, or code that looks
like a replacement pattern, the build will quietly ship corrupted JavaScript into Anki.
There's also no guard for a missing placeholder — if `%COMMON_JS%` gets renamed or
deleted from a base template, `replace()` does nothing and the build "succeeds" with no
script inside.

**The fix.** Use a replacer function, which takes the replacement literally:
`baseTemplate.replace("%COMMON_JS%", () => commonJs)`. And before replacing, throw a
clear error if the placeholder isn't found in the base template.

**Tests to add.** The build script has zero tests right now. Refactor `buildTemplate()`
so its core (transpile + inject) is callable with in-memory strings, then test: JS
containing `$$`/`$&` survives injection byte-for-byte, and a template missing a
placeholder throws. This also creates the home for future build tests.

**Docs to update.** `BUILD.md`'s "What the build does NOT do" and troubleshooting
sections; the pipeline notes in
`documentation/architecture-diagrams/02-build-pipeline.md`.

### 3. `setLinkText()` renames the wrong link — 7/10

**What's happening.** `setLinkText()` in `src/common.ts` does
`document.querySelector("a")` — the first `<a>` *anywhere on the card* — and renames its
text to "Link".

**Why it matters.** The function is meant for the URL field's link in `#url_container`.
But if the card's question text contains a hyperlink (perfectly normal for a flashcard),
*that* link gets its text stomped to "Link" instead, and the actual URL link is left
alone. Confusing for authors and learners alike.

**The fix.** Scope the selector: `document.querySelector("#url_container a")`.

**Tests to add.** One test with an anchor in the card content *and* one in
`#url_container` (only the latter should be renamed), and one with an anchor only in the
content (nothing should change).

**Docs to update.** The `setLinkText` description in `CLAUDE.md` and the "shared chrome"
table in `documentation/architecture-diagrams/06-card-lifecycles.md`.

### 4. Enter-key listeners pile up as you review — 6/10

**What's happening.** `setupEnterKeyEvent()` adds a `keydown` listener to `document`
every time a front card renders — and never removes it. Anki's reviewer keeps the same
page alive across the whole session (that's the very mechanism `window.data` relies on),
so after reviewing 50 cards you have 50 identical listeners, each calling
`preventDefault()` and `pycmd("ans")` on every keypress.

**Why it matters.** It's a slow leak with duplicate side effects. It mostly gets away
with it because the calls are idempotent, but it's fragile — and the same pattern will
bite harder if any future listener *isn't* idempotent.

**The fix.** Guard it: set a flag like `window._enterKeyBound` and only attach the
listener the first time. While there, consider ignoring `event.isComposing` so IME users
(Japanese, Chinese, Korean input) don't fire the answer on composition-confirm.

**Tests to add.** Call `setupEnterKeyEvent()` twice, dispatch one Enter keydown, assert
`pycmd` was called exactly once. Add a test that a composing Enter does nothing.

**Docs to update.** `CLAUDE.md` gotchas (the iPhone note lives there too) and
`documentation/architecture-diagrams/06-card-lifecycles.md`.

### 5. Answer inputs are still editable on the back of the card — 6/10

**What's happening.** `revealAnswer()` recolours each input and overwrites its value
with the correct answer, but the inputs stay fully editable.

**Why it matters.** On the answer side you can tap an input by accident and start
"editing" the revealed answer — on mobile the keyboard pops up over the card. Nothing
breaks, but it feels broken.

**The fix.** Add `input.readOnly = true;` inside `revealAnswer()`.

**Tests to add.** Extend the existing `revealAnswer` tests to assert `readOnly` is set
on named inputs (and *not* on skipped, unnamed ones).

**Docs to update.** `documentation/architecture-diagrams/05-answer-validation.md`
("Consequences of this design" list) and the `revealAnswer` line in `CLAUDE.md`.

### 6. The back template is missing the mobile viewport tag — 4/10

**What's happening.** `templates/front_template_base.html` starts with a `<meta
name="viewport">` tag that stops mobile browsers zooming onto the focused input. The
back template doesn't have it.

**Why it matters.** Flipping the card on a phone can change the zoom behaviour
mid-review. Small, but it's a one-line inconsistency between two files that should
mirror each other.

**The fix.** Copy the same meta tag to the top of `templates/back_template_base.html`
and rebuild.

**Tests to add.** This is exactly the kind of thing the end-to-end test in item 10
should assert: both built files contain the viewport tag.

**Docs to update.** None beyond regenerating `code_cards/` — but mention it in the
commit message so the diff makes sense.

### 7. Stale `window.data` can leak between cards — 3/10

**What's happening.** `window.data` is never cleared. If a back side ever renders
without its own front having run first (previewing a card from the browser, undo,
editing mid-review), `initializeBackTemplate()` happily grades against whatever the
*previous* card stored.

**Why it matters.** In normal review flow the front always runs first and overwrites the
global, so this is rare — that's why the score is low. But when it does happen, the
grading is quietly nonsense.

**The fix.** Needs a little care: clearing `window.data` after grading breaks re-renders
of the same back side (night-mode toggle, window resize). A safer route is tagging the
data with a card identifier, e.g. storing `{ values, cardMark }` where the mark comes
from a hidden element rendering `{{Front}}`'s hash — or simply documenting the edge case
and accepting it. Decide when you get there; don't fix it blind.

**Tests to add.** Simulate the edge: populate `window.data` with keys that don't match
the back's inputs and assert every input grades red (current behaviour), then encode
whatever behaviour you choose.

**Docs to update.** `documentation/architecture-diagrams/04-runtime-data-flow.md`
already explains the flip mechanics — add the edge case there and to `CLAUDE.md`
gotchas.

---

## Testing and tooling

### 8. Add a CI pipeline (GitHub Actions) — 8/10

**What's missing.** There is no CI at all — `.github/` only holds images. Tests run on
whoever remembered to install pre-commit, and nothing stops a PR that breaks the build.

**What to do.** One workflow file, four steps: `npm ci`, `npx tsc -p tsconfig.json
--noEmit` (the build doesn't type-check, so CI must), `npm test`, `npm run build`
followed by `git diff --exit-code code_cards/`. That last step is the quiet hero: it
fails the build if someone edits `src/` but forgets to regenerate the committed HTML,
which is currently an honour-system rule.

**Tests to add.** This item *is* the testing infrastructure. Turn on coverage reporting
in the same workflow (`npm test -- --coverage`) so coverage becomes visible on every PR
before you decide whether to enforce thresholds.

**Docs to update.** Replace the aspirational "CI/CD Considerations" section in
`BUILD.md` with a description of the real workflow. Add a status badge to `README.md`.

### 9. Make the URL field work with plain-text paste — 8/10

**What's happening.** The `{{URL}}` field renders into `#url_container` as-is, and
`setLinkText()` only renames an `<a>` that already exists. So the officially documented
workflow — paste the URL as plain text with `Ctrl+Shift+V` — produces inert text, not a
clickable link. The README's whole "Linking" section is a workaround for this.

**Why it matters.** This is the most confusing part of the project for card authors
(the README needs three paragraphs and a warning to explain it). Fixing it properly
deletes a footgun.

**The fix.** In `common.ts`, read `#url_container`'s text content; if it looks like a
URL, replace the container's content with a real `<a href="...">Link</a>`. If it already
contains an anchor, just rename it (current behaviour). Then both paste styles work and
the README instructions shrink to one line.

**Tests to add.** Three cases: container holds a raw URL (anchor gets created), holds an
anchor (text renamed, href untouched), holds junk/empty (nothing happens). This item
depends on item 3's scoped selector — do them together.

**Docs to update.** Rewrite `README.md`'s "Linking" section (it can lose the
`Ctrl+Shift+V` warning), update `CLAUDE.md`'s function list and gotcha #8, and the
shared-chrome table in `06-card-lifecycles.md`.

### 10. Add an end-to-end test of the built templates — 7/10

**What's missing.** Every existing test transpiles `src/*.ts` directly. Nothing ever
tests the *built* files in `code_cards/` — the placeholder substitution, the script
ordering, the interaction between front and back. A broken base template would sail
through the whole suite.

**What to do.** One integration test that: runs the real build (or reads the committed
output), substitutes the Anki fields (`{{Front}}`, `{{Tags}}`, …) with fixture content
the way Anki would, loads the result into jsdom, types into an input, simulates the
flip by evaluating the back template into the same window, and asserts the green/red
grading end to end. This is the single test that exercises the system the way Anki
actually uses it.

**Tests to add.** That's the item. Put it in `tests/integration.test.ts` so the unit /
integration split is obvious.

**Docs to update.** The testing sections of `BUILD.md` and `CLAUDE.md` (both currently
describe the transpile-and-eval unit pattern as the whole story).

### 11. Share one test helper instead of three copies — 6/10

**What's happening.** All three test files carry a near-identical `setupDom()` that
reads a source file, transpiles it, and `eval()`s it — plus the same
TextEncoder/TextDecoder polyfill boilerplate. Each call re-transpiles from scratch.
There's also a subtle smell: evaluating `front_template.ts` *runs*
`initializeFrontTemplate()` as a side effect in every test, attaching document-level
listeners the tests never asked for.

**What to do.** Extract `tests/helpers.ts` with a single `loadScripts(...files)` that
caches transpilation per file (the sources don't change mid-run), and move the polyfills
into a Jest setup file (`setupFilesAfterEach`/`setupFiles` in `jest.config.js`). While
there, consider guarding the auto-init in the sources (e.g. skip when a test flag is
set) so tests opt *in* to initialization instead of getting it as a side effect.

**Tests to add.** This makes every future test cheaper to write — and add the missing
direct tests for `initializeFrontTemplate()` / `initializeBackTemplate()`, which
currently only run by accident.

**Docs to update.** The "Test Architecture" section in `BUILD.md` and the testing notes
in `CLAUDE.md`.

### 12. Give `window.data` and `pycmd` real types — 6/10

**What's happening.** Every touch of the shared state goes through `(window as any)` —
the one piece of the system that front and back must agree on is the one piece with no
type checking.

**What to do.** Add a `src/global.d.ts`:

```ts
interface Window {
  data?: Record<string, string>;
  pycmd?: (command: string) => void;
}
```

Then delete the `as any` casts. Wire `make typecheck` into pre-commit and CI so it
actually runs (the build itself only strips types — it will never catch a type error).

**Tests to add.** The type-check *is* the test — make it a required CI step. The
existing runtime tests confirm nothing regresses.

**Docs to update.** `CLAUDE.md` (critical settings + commands) and `BUILD.md` ("What the
build does NOT do" gets a happier ending).

---

## User-facing improvements

### 13. Support Anki's night mode — 6/10

**What's happening.** The styling assumes a light card: grey `#CCCCCC` code blocks,
pale blue hints, and grading colours picked against white. Anki's night mode adds a
`.nightMode` class to `.card`, and this template ignores it entirely.

**What to do.** Add `.card.nightMode` overrides in `code_cards/styling.css` for the code
block, hint box, tag/URL text, and input fields; check the green/red grading colours
still read against a dark background (they're set inline in JS, so either choose shades
that work on both, or set a class instead of an inline style and let CSS decide —
the class route is cleaner and more testable).

**Tests to add.** If grading moves from inline styles to classes (`input.correct` /
`input.wrong`), the `revealAnswer` tests get *simpler* — assert a class instead of an
rgb string. That refactor is worth it for testability alone.

**Docs to update.** The Styling Reference in `CLAUDE.md`, the styling notes in
`BUILD.md`, and the colour meanings in `05-answer-validation.md`.

### 14. Show the learner what they typed, not just the answer — 5/10

**What's happening.** `revealAnswer()` overwrites the input's value with the correct
answer. If you got it wrong, your attempt is gone — you can't compare what you typed
against what was expected, which is half the learning.

**What to do.** Keep the correct answer in the input (that behaviour is good), but
preserve the attempt somewhere visible for wrong answers — a `title` tooltip is the
zero-layout-risk option; a small struck-through span after the input is the more
readable one. Worth a quick experiment on a real phone before committing.

**Tests to add.** Wrong answer → attempt is preserved in whatever form you choose;
correct answer → no clutter appears.

**Docs to update.** `README.md` features list, `05-answer-validation.md`, and the
`revealAnswer` description in `CLAUDE.md`.

### 15. Don't rely on colour alone for right/wrong — 5/10

**What's happening.** Green background = correct, red = wrong — and that's the only
signal. For colour-blind learners (roughly 1 in 12 men), those two backgrounds can be
nearly indistinguishable.

**What to do.** Add a second channel: a ✓/✗ mark after the input, or distinct border
styles — plus `aria-label="correct"/"incorrect"` for screen readers. Pairs naturally
with item 13's move from inline colours to classes; do them together.

**Tests to add.** `revealAnswer` tests assert the mark/label as well as the class.

**Docs to update.** `README.md` features, `05-answer-validation.md` colour legend, and
the colour bullets in `CLAUDE.md`.

### 16. Sort tags alphabetically, not by ASCII — 4/10

**What's happening.** `displayTags()` uses plain `.sort()`, which puts every
uppercase letter before every lowercase one: `Computing - AI, a c, b a`. The README
promises "alphabetical order"; ASCII order is what it actually delivers.

**What to do.** `sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))`.

**Tests to add.** The existing `displayTags` test *encodes the bug* (it expects
`Computing - AI` before `a c`) — update it and add a mixed-case case. A test that has to
change is a good sign here, not a bad one.

**Docs to update.** The `displayTags` line in `CLAUDE.md`; the README's tagging section
becomes true as written.

---

## Housekeeping

### 17. Tidy up the dev dependencies — 3/10

**What's happening.** Three oddities in `package.json`: `@types/jest` is on v30 while
`jest` is on v29 (types describing APIs the runtime doesn't have); a direct `jsdom@26`
dependency that nothing uses (Jest bundles its own `jsdom@20` via
`jest-environment-jsdom` — verified with `npm ls jsdom`); and `prettier` is installed
but wired to nothing.

**What to do.** Pin `@types/jest` to `^29`, drop the direct `jsdom`, and either add a
`format` script + pre-commit hook for prettier or remove it. Small diff, less confusion
about what the test environment actually is.

**Tests to add.** The whole suite passing after the cleanup is the test. Run
`make check` before and after.

**Docs to update.** `BUILD.md` prerequisites/test-architecture if anything
user-visible changes.

### 18. Sort out the `_editor_button_styles.css` import — 3/10

**What's happening.** The first line of `code_cards/styling.css` imports
`_editor_button_styles.css`, a file that lives only in the author's personal Anki media
collection. For everyone else the import 404s silently.

**What to do.** Either commit that file to the repo (if its contents matter to the
cards) or delete the import and keep it as a purely personal add-on documented in the
README. Right now it's a mystery dependency.

**Tests to add.** Item 10's integration test can assert the built cards don't depend on
files outside the repo.

**Docs to update.** Gotcha #5 in `CLAUDE.md` and the note in `BUILD.md` either shrink or
disappear — which is the point.

### 19. Retire the unused `dist/` output — 2/10

**What's happening.** `tsconfig.json` declares `outDir: dist`, so a stray `npx tsc`
emits files nothing reads. The real build transpiles in memory.

**What to do.** Add `"noEmit": true` to `tsconfig.json`, delete the `outDir` line, and
remove `dist` from `.gitignore` and the docs. One less thing to explain.

**Tests to add.** None needed — `make check` still passing covers it.

**Docs to update.** The directory tree in `CLAUDE.md` and the `npx tsc` mentions in
`BUILD.md` / `README.md`.

---

## Suggested order of attack

1. **Quick wins pass (items 1, 3, 5, 6):** four small, safe fixes with tests — one PR.
2. **Build hardening (item 2) + CI (item 8):** make the pipeline trustworthy before
   changing anything bigger.
3. **Testing foundations (items 10, 11, 12):** the e2e test and shared helpers make
   every later change cheaper and safer.
4. **The URL fix (item 9) and listener guard (item 4):** behaviour changes, now caught
   by the new tests.
5. **Polish (items 13–16), then housekeeping (17–19)** whenever there's a spare moment.

After each step: run `make check`, regenerate `code_cards/`, and update the docs listed
in the item — the documentation debt stays at zero if it's paid per-change.
