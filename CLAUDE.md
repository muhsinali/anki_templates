# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Anki flashcard template system that generates interactive code practice cards. It transpiles TypeScript into JavaScript and injects it into HTML templates to create Anki-compatible flashcards with interactive input fields and automatic answer validation.

## Documentation Map

- `README.md` — User-facing: what the cards do, Anki setup, authoring cards, tagging/linking conventions
- `BUILD.md` — Developer-facing: build/test workflow, extending the system, troubleshooting
- `documentation/architecture-diagrams/` — Seven hand-authored Mermaid diagrams (system context, build pipeline, module structure, runtime data flow, answer validation, card lifecycles, test architecture & CI gate). Update these when the architecture changes.
- `improvement-plan.md` — Prioritized backlog of bugs, testing gaps, improvements, and housekeeping (scored by impact)
- `improve-test-infrastructure.md` — The (fully executed) test-infrastructure plan: CI, build tests, e2e test, coverage fix. Its execution record maps every step to its commit; kept as the reasoning behind the current test architecture

## Development Commands

```bash
npm run build                      # Transpile TS and generate HTML templates in code_cards/
npm test                           # Run Jest tests with jsdom environment
npm test -- --watch                # Watch mode
npm test -- path/to/test           # Run specific test file
npx tsc -p tsconfig.json --noEmit  # Type-check only (build does not type-check)
```

`npm run build:templates` is an alias for `npm run build`.

A `Makefile` wraps these for convenience — run `make` alone to list targets:

```bash
make build      # = npm run build
make test       # = npm test
make typecheck  # tsc --noEmit for both tsconfigs
make check      # typecheck + test + build (run before committing)
```

## Directory Structure

```
├── src/                           # TypeScript source files
│   ├── common.ts                  # Shared: displayTags, prettifyTag, setLinkText
│   ├── front_template.ts          # Front card: placeCursor, storeInput, setupHint, etc.
│   ├── back_template.ts           # Back card: parseInput, revealAnswer
│   └── global.d.ts                # Window contract: window.data, window.pycmd
├── templates/                     # Base HTML with placeholders
│   ├── front_template_base.html   # Contains %COMMON_JS% and %TEMPLATE_JS%
│   └── back_template_base.html    # Re-renders {{Front}} (see Data Flow below)
├── scripts/
│   └── build-templates.ts         # Build orchestrator
├── tests/                         # Jest tests (one test file per src/ file)
├── code_cards/                    # Generated output (Anki-ready)
│   ├── front_template.html        # Generated - do not edit directly
│   ├── back_template.html         # Generated - do not edit directly
│   └── styling.css                # MANUALLY MAINTAINED - not generated
├── documentation/
│   └── architecture-diagrams/     # Mermaid diagrams 01-07 + index README
├── Makefile                       # Dev shortcuts (make help / build / test / check)
├── BUILD.md                       # Build/test/troubleshooting guide
```

## Architecture

### Build Process (`scripts/build-templates.ts`)
1. Reads base HTML template from `templates/`
2. Transpiles `src/common.ts` → replaces `%COMMON_JS%` placeholder
3. Transpiles `src/{front,back}_template.ts` → replaces `%TEMPLATE_JS%` placeholder
4. Writes final HTML to `code_cards/`

**Critical TypeScript settings:**
- `module: none` - Functions attach to global scope (no module wrapper). `window.data` is assigned explicitly and carries state from front to back.
- `target: ES2022` - Modern JS features

`%COMMON_JS%` always precedes `%TEMPLATE_JS%` in the base HTML, so shared functions are defined before the template-specific code that calls them.

### Data Flow Between Templates

Anki renders the front and back in the **same webview/JS context**, so globals survive the card flip — but the DOM does not. The back base template re-renders `{{Front}}`, which recreates every `<input>` fresh and empty. The learner's typed answers survive the flip only inside `window.data`:

1. **Front template** (`initializeFrontTemplate`):
   - `storeInput()` creates `window.data = { values, inputNames }`
   - `values` stores `{ inputName: typedValue }`; `inputNames` stores the ordered input-name signature for stale-data checks
   - `input` event listeners keep `window.data.values` synced as the user types
2. **Flip** (Enter → `pycmd("ans")`): same JS context, so `window.data` persists; the back's `{{Front}}` render recreates the inputs empty
3. **Back template** (`initializeBackTemplate`):
   - `isCardInputData(window.data)` validates the runtime shape (the webview can hold a stale value from an older template version), then `inputSignatureMatches` checks that the recreated input names match the front-side signature
   - `revealAnswer(window.data.values)` grades each recreated input against its `name`, marks it with classes/text labels, preserves wrong attempts, locks it read-only, and overwrites its value with the correct answer

The `<script>` block sits at the end of each template, so the `{{Front}}` inputs above it already exist when `storeInput()` runs synchronously. Only `setInputAttributes()`/`placeCursor()` are deferred via `setupDOMContentLoaded()`.

### Answer Validation System

**The `name` attribute of `<input>` elements is the expected answer:**

```html
<!-- In Anki card Front field: -->
<input name="console.log">  <!-- Expected answer is "console.log" -->
```

- `revealAnswer()` compares the user input against the input name, with **both sides** normalized by `parseInput()`
- Normalization: smart quotes → straight quotes, all whitespace stripped (applied to the expected answer and the typed answer alike)
- Feedback: `answer-correct` / `answer-wrong` classes, visible `Correct` / `Incorrect` text, `aria-label`, read-only inputs, and wrong-answer attempt text
- Untouched/missing inputs grade as empty string (wrong), never throw (`data[name] ?? ""`)

### Anki Field Syntax

Templates use Anki's mustache-style field placeholders:
- `{{Front}}`, `{{Back}}`, `{{Hint}}`, `{{Tags}}`, `{{URL}}`
- Conditional: `{{#Hint}}...{{/Hint}}` (renders only if Hint field has content)
- Substitution happens **anywhere** in the template, including inside `<script>` — `displayTags("{{Tags}}")` works because Anki injects the tag string directly into the JS source at render time

### Anki Integration

- `window.pycmd("ans")` - Calls Anki Python backend to show answer
- Called on Enter key press (front template); guarded with `typeof pycmd !== "undefined"` so it's a no-op outside Anki (e.g. in tests). The document listener is bound once per webview and ignores IME composition Enter events.

## Key Functions

### common.ts
- `displayTags(tagsString)` - Parses space-delimited tags, prettifies, locale-sorts case-insensitively, displays in `#content_tag_left`
- `prettifyTag(tag)` - `"Computing::Machine_Learning"` → `"Computing - Machine Learning"`
- `setLinkText()` - Renders the optional `#url_container` URL as a compact `Link`; handles existing anchors and raw HTTP(S) text without touching content links

### front_template.ts
- `placeCursor()` - Focuses first `<input>` element
- `setInputAttributes()` - Disables autocapitalize/autocomplete/autocorrect/spellcheck
- `setupDOMContentLoaded(callback)` - Runs callback now if DOM is ready, else on `DOMContentLoaded`
- `storeInput()` - Creates and returns the object stored as `window.data`, tracking named input values and ordered input names
- `setupHint()` - Touch/mouse listeners to reveal hint (sets className to "shown")
- `setupEnterKeyEvent()` - Enter key shows answer via `pycmd("ans")`, with a one-time listener guard and IME composition guard

### back_template.ts
- `parseInput(str)` - Normalizes quotes (`""`→`"`, `''`→`'`) and strips whitespace
- `isCardInputData(value)` - Runtime shape guard for `window.data` (stale/foreign values in the long-lived webview never crash the back)
- `inputSignatureMatches(data)` - Checks that stored front-side input names match the back-side inputs before grading
- `revealAnswer(data)` - Marks inputs correct/wrong, sets read-only, overwrites each input's value with the correct answer, and adds visible/accessible feedback

## Testing

Tests use Jest (`ts-jest` preset, jsdom environment, `clearMocks` — see `jest.config.js` and `tsconfig.jest.json`). Each test file:
1. Sets `document.body.innerHTML`
2. Loads the real `src/` files with `loadScripts()` from `tests/helpers.ts`, which transpiles them via the build script's `transpileSource()` (same code path and compiler settings as the build — `module: none`, `target: ES2022`), caches per file, and `eval()`s them to attach functions to `window` — so tests exercise the exact code that ships. Eval'ing a template file also runs its trailing `initialize*()` call as a side effect, as in Anki.
3. Calls the functions as **bare typed globals** (e.g. `storeInput()`, `revealAnswer(data)`): the `src/` files are global scripts in the jest tsconfig's program, so their declarations are ambient and fully typed in tests — renaming or re-signaturing a `src/` function breaks test compilation, not just the runtime. `CardInputData`, `window.data`, `window.pycmd`, and `window.enterKeyHandlerBound` are typed via `src/global.d.ts`.

Test files load `common.ts` before the template-specific file, mirroring the placeholder order in the built HTML.

`tests/property.test.ts` adds property-based tests (fast-check) for the pure functions — `parseInput` idempotence and quote-style-insensitive grading, `prettifyTag` never emitting `::`/`_`.

`tests/integration.test.ts` additionally tests the built templates end-to-end: it builds both sides in-memory via `transpileSource()` + `injectJavaScript()`, renders Anki fields with a small mustache substitute (applied everywhere, script included), loads the front (body set, extracted script eval'd — `innerHTML` never executes scripts), types and presses Enter against a `pycmd` mock, then flips as Anki does (same window, fresh DOM) and asserts the grading. Note: the built script's `"use strict"` keeps eval'd function declarations scoped to the eval rather than making them globals — intentional and fine, since only `window.data` must cross the flip and it is assigned to `window` explicitly. Don't "fix" this.

## Known Limitations & Gotchas

1. **iPhone**: Enter key to show answer does not work on iPhone
2. **Named inputs only**: Inputs without `name` attribute are silently skipped
3. **Whitespace comparison**: All whitespace is stripped during answer comparison (intentional formatting differences won't matter)
4. **CSS not generated**: `code_cards/styling.css` is manually maintained, not regenerated by build
5. **Hint classes differ per side**: front hint starts as `class="hidden"` (click to reveal); back hint is hard-coded `class="shown"`
6. **Synchronous file I/O**: Build script uses `readFileSync`/`writeFileSync`
7. **URL field**: raw `http://` / `https://` text and existing anchors both render as a compact `Link`; invalid text is left alone
8. **Stale data guard**: back grading is skipped when `window.data` is not the expected `{ values, inputNames }` shape or the stored input-name signature does not match the recreated inputs
9. **Build does not type-check**: syntax errors fail the build (transpile diagnostics are checked), but type errors sail through — run `npx tsc -p tsconfig.json --noEmit` to catch them
10. **Coverage requires the V8 provider**: `jest.config.js` sets `coverageProvider: 'v8'` and `tests/helpers.ts` transpiles with an inline source map + `file://` `sourceURL` so eval'd code is attributed to the real `src/` files. Do not switch back to Istanbul — it instruments at the transform stage and reports 0% for everything the eval-based tests exercise. Thresholds are enforced (`coverageThreshold`), and CI runs `npm test -- --coverage`.

## Styling Reference

Key CSS selectors in `code_cards/styling.css`:
- `.card` - Base card styling (Arial 18px)
- `.content_aligned` - Main content container (absolute: top 6%, left 11%, width 76%, height 70%)
- `#hint` - Hint box (`.hidden` hides `.payload`; `.shown` hides `.trigger` and shows `.payload`)
- `.exerciseprecontainer` - Code block container (MesloLGS NF font, gray rounded box)
- `input` - Code input fields (MesloLGS NF 16px; width is NOT set here — cards size inputs inline, e.g. `style="width: 20ch;"`)
- `input.answer-correct` / `input.answer-wrong` - Graded answer states
- `.answer-feedback` - Visible correct/incorrect marker and wrong-answer attempt text
- `.card.nightMode ...` - Anki night-mode overrides for card chrome, code blocks, inputs, and feedback
- `#content_tag_left` - Tag display area (bottom-left)
- `#url_container` - URL area (bottom-right)

## Pre-Commit Hooks

`.pre-commit-config.yaml` runs:
- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Line ending normalization (→ LF)
- American English spelling (codespell with the `en-GB_to_en-US` dictionary — British spellings fail the hook)
- **TypeScript must type-check before commit** (both tsconfigs, `--noEmit`)
- **Jest tests must pass before commit**

Install with `pre-commit install`; run manually with `pre-commit run --all-files`.
CI also runs `pre-commit run --all-files`, so hook failures block the
`Node 26.4.0` GitHub Actions check. `package.json` allows Node `>=26.4.0`;
CI and `.nvmrc` pin 26.4.0 as the tested baseline.
