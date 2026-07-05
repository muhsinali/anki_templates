# Build Instructions

This document explains how to build, test, and extend the Anki template system.

**Related docs:**
- [README.md](README.md) — what the cards do and how to set them up in Anki
- [documentation/architecture-diagrams/](documentation/architecture-diagrams/README.md) — visual (Mermaid) versions of the pipeline and runtime flows described here
- [CLAUDE.md](CLAUDE.md) — condensed project reference (used by Claude Code, useful for humans too)

## Prerequisites

- Node.js 24 or newer. CI runs Node 24 as the minimum supported runtime,
  `.nvmrc` pins 24 for local convenience, and `package.json` requires `>=24`.
- npm
- [pre-commit](https://pre-commit.com/) (optional — only needed for the git hooks)

```bash
npm install  # Install dependencies
```

## Quick Start

```bash
npm run build   # Generate HTML templates in code_cards/
npm test        # Run all tests
```

`npm run build:templates` is an alias for `npm run build`.

### Make targets

A `Makefile` wraps the common commands. Run `make` on its own to see this list:

| Target | What it does |
|--------|--------------|
| `make install` | `npm install` |
| `make build` | Regenerate the templates in `code_cards/` |
| `make test` | Run the Jest test suite |
| `make coverage` | Tests with a coverage report |
| `make typecheck` | `tsc --noEmit` for both tsconfigs |
| `make check` | typecheck + test + build — run this before committing |
| `make hooks` | Install the pre-commit git hooks |
| `make clean` | Remove `coverage/` |

## Build Process Deep Dive

### What Happens During Build

The build script (`scripts/build-templates.ts`, run via `ts-node`) performs these steps:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Read base HTML template                                     │
│     templates/front_template_base.html                          │
│     templates/back_template_base.html                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Transpile TypeScript → JavaScript                           │
│     src/common.ts          →  (in-memory JS)                    │
│     src/front_template.ts  →  (in-memory JS)                    │
│     src/back_template.ts   →  (in-memory JS)                    │
│                                                                 │
│     Settings: module=none, target=ES2022                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Inject JavaScript into HTML placeholders                    │
│     %COMMON_JS%   →  transpiled common.ts                       │
│     %TEMPLATE_JS% →  transpiled front_template.ts               │
│                      or back_template.ts                        │
│     Missing placeholders fail the build                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  4. Write final HTML files                                      │
│     code_cards/front_template.html                              │
│     code_cards/back_template.html                               │
└─────────────────────────────────────────────────────────────────┘
```

A Mermaid version of this pipeline lives in
[02-build-pipeline](documentation/architecture-diagrams/02-build-pipeline.md).

### Why `module: none`?

The TypeScript compiler is configured with `module: none` because:
- Anki's webview doesn't support ES modules
- Functions must attach to the global `window` scope
- The front template stores data on `window.data`, which the back template reads
  after checking the input-name signature

### Template Placeholders

Base HTML templates contain two placeholders:

```html
<script>
    "use strict";
    %COMMON_JS%      <!-- Replaced with transpiled common.ts -->
    %TEMPLATE_JS%    <!-- Replaced with transpiled front/back_template.ts -->
</script>
```

Two ordering guarantees matter here:

- `%COMMON_JS%` comes **before** `%TEMPLATE_JS%`, so shared functions
  (`displayTags`, `prettifyTag`, `setLinkText`) are defined before the
  template-specific initialization code that calls them.
- Placeholder injection uses a replacer callback, so JavaScript strings that
  contain replacement-looking text such as `$$` or `$&` are copied literally
  into the generated HTML.
- The build checks that both placeholders are present and throws a clear error
  if either one is missing.
- The `<script>` block sits at the **end** of the template body, so the
  `{{Front}}` inputs above it are already in the DOM when the initialization
  code runs.

### What the build does NOT do

- **No type-checking.** `transpileSource()` strips types without checking
  them. Syntax errors *do* fail the build (transpile diagnostics are
  checked and thrown), but type errors sail through — run
  `npx tsc -p tsconfig.json --noEmit` to catch those (CI does).
- **No CSS generation.** `code_cards/styling.css` is hand-maintained.
- **No bundling/minification.** The build is `readFileSync` → `ts.transpile`
  → checked literal placeholder injection → `writeFileSync`, all synchronous.

## Source Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/common.ts` | Shared functions (both card sides) | `displayTags`, `prettifyTag`, `setLinkText` |
| `src/front_template.ts` | Front card logic | `placeCursor`, `storeInput`, `setupHint`, `setupEnterKeyEvent` |
| `src/back_template.ts` | Back card logic | `parseInput`, `inputSignatureMatches`, `revealAnswer` |
| `src/global.d.ts` | The `CardInputData` / `Window` contract: `window.data` (values plus input-name signature), `window.pycmd`, and the Enter-listener guard | — |

## Output Files

Generated files in `code_cards/`:

| File | Size | Purpose |
|------|------|---------|
| `front_template.html` | ~4KB | Card question side - paste into Anki |
| `back_template.html` | ~2.5KB | Card answer side - paste into Anki |
| `styling.css` | ~3KB | Shared styles - **manually maintained** |

**Important:** `styling.css` is NOT generated by the build. Edit it directly.
It contains the base card styles, answer-state classes, feedback labels, and
Anki night-mode overrides.

## Testing

### Run Tests

```bash
npm test                      # Run all tests
npm test -- --watch           # Watch mode (re-run on changes)
npm test -- --coverage        # Coverage report + enforced thresholds
npm test -- tests/common.test.ts  # Run specific test file
```

Coverage is real and enforced: `jest.config.js` uses the **V8 coverage
provider** with `coverageThreshold` ratchets (near-total for `src/`, a floor
for `scripts/`), and CI runs the suite with `--coverage`. The eval-based
tests are visible to coverage because `tests/helpers.ts` transpiles with an
inline source map and appends a `file://` `sourceURL` to each eval'd script —
V8 attributes the executed code back to the real `.ts` files, line-precise.
Jest's default (Istanbul) provider instruments at the transform stage and
cannot see eval'd code, so don't switch `coverageProvider` back.

### Test Architecture

A Mermaid overview of the whole test/CI architecture lives in
[07-test-and-ci](documentation/architecture-diagrams/07-test-and-ci.md).

Tests use Jest with jsdom to simulate a browser DOM:

1. Set up DOM with `document.body.innerHTML = '<html>...'`
2. Load the real `src/` files with `loadScripts()` from the shared harness
   (`tests/helpers.ts`), which transpiles them through the build script's
   own `transpileSource()` — the same code path and compiler settings
   (`module: none`, `target: ES2022`) the shipped templates are built with,
   so the two can never drift apart — caches the transpiled output per
   file, and `eval()`s it so functions attach to `window`: tests exercise
   the exact code that ships
3. Call the functions as **bare typed globals** (`storeInput()`,
   `revealAnswer(data)`, …): the `src/` files are global scripts inside
   `tsconfig.jest.json`'s program, so their declarations are ambient and
   fully typed in tests — renaming or re-signaturing a `src/` function
   fails `tsc`, not just the test run. `CardInputData`, `window.data`,
   `window.pycmd`, and `window.enterKeyHandlerBound` are typed by
   `src/global.d.ts`

Note: eval'ing a template file also runs its trailing `initialize*()` call
as a side effect, against whatever DOM is present — mirroring how the
shipped `<script>` behaves in Anki. Tests that exercise the initializers
call the `initialize*()` global directly on a prepared DOM.

Template test files load `common.ts` before the template-specific file,
mirroring the `%COMMON_JS%` → `%TEMPLATE_JS%` order in the built HTML.

On top of that unit layer, `tests/integration.test.ts` exercises the whole
card lifecycle end-to-end, the way Anki runs it:

1. Builds both templates **in-memory** through the build script's own
   `transpileSource()` + `injectJavaScript()` — a broken base template or
   broken injection fails this test
2. Renders the Anki fields (`{{Front}}`, `{{#Hint}}…{{/Hint}}`, …) with a
   small mustache substitute, applied to the whole template including the
   `<script>` — exactly like Anki
3. Loads the front: sets `document.body.innerHTML`, then evals the extracted
   script (setting `innerHTML` never executes `<script>` tags), types into
   the inputs, and presses Enter against a `pycmd` mock
4. Flips exactly as Anki does: same window (`window.data` persists), fresh
   DOM re-rendered from `{{Front}}`, back script eval'd, signature check and
   grading asserted

One nuance to leave alone: the built script begins with `"use strict"`, so
under `eval()` its function declarations stay scoped to the eval instead of
becoming globals (in a real `<script>` tag they would become globals). That
is fine — each side's script is self-contained, and the only state that must
cross the flip, `window.data`, is assigned to `window` explicitly.

Test configuration:

| File | Role |
|------|------|
| `jest.config.js` | `ts-jest` preset, `jsdom` test environment, `clearMocks`, points at `tsconfig.jest.json` |
| `tsconfig.jest.json` | Extends `tsconfig.json`; adds `isolatedModules`, `noEmit`, jest/node types |
| `tests/helpers.ts` | Shared harness: `loadScripts()` transpiles `src/` files via the build's `transpileSource()` (cached) and evals them into the window |

### Test Files

| Test File | Tests For |
|-----------|-----------|
| `tests/build_templates.test.ts` | Transpile diagnostics, placeholder validation, literal JavaScript injection, base-template and styling invariants |
| `tests/integration.test.ts` | End-to-end card lifecycle: in-memory build → field render → front → type → Enter → flip → grading |
| `tests/property.test.ts` | Property-based (fast-check): `parseInput` idempotence, no whitespace/curly quotes in output, quote-style-insensitive grading; `prettifyTag` never emits `::`/`_`, idempotent |
| `tests/common.test.ts` | `displayTags`, `prettifyTag`, `setLinkText` |
| `tests/front_template.test.ts` | `placeCursor`, `storeInput`, `setupHint`, etc. |
| `tests/back_template.test.ts` | `parseInput`, `revealAnswer` |

## Development Workflow

### Adding a New Function

1. **Add to source file** (`src/common.ts`, `src/front_template.ts`, or `src/back_template.ts`)

2. **Write tests first** (recommended):
   ```typescript
   // tests/common.test.ts
   describe("myNewFunction", () => {
     test("does something", () => {
       setupDom();
       expect(myNewFunction()).toBe(expected);
     });
   });
   ```

3. **Implement the function**:
   ```typescript
   // src/common.ts
   function myNewFunction(): string {
     return "result";
   }
   ```

4. **Run tests**: `npm test`

5. **Build**: `npm run build`

6. **Verify** generated HTML in `code_cards/`

7. **Update docs** if the architecture changed — especially the diagrams in
   `documentation/architecture-diagrams/` and the function lists in `CLAUDE.md`

### Modifying HTML Structure

1. Edit base template in `templates/front_template_base.html` or `templates/back_template_base.html`

2. Keep the `%COMMON_JS%` and `%TEMPLATE_JS%` placeholders in the `<script>` tag, and keep the `<script>` at the end of the body (initialization code assumes the card content above it is already parsed)

3. Anki field placeholders use mustache syntax:
   - `{{FieldName}}` - Render field value
   - `{{#FieldName}}...{{/FieldName}}` - Conditional (only if field has content)
   - Substitution happens anywhere in the template, including inside `<script>` (e.g. `displayTags("{{Tags}}")`)

4. Note the back base template intentionally re-renders `{{Front}}` — that is how the inputs reappear on the answer side for grading (see [04-runtime-data-flow](documentation/architecture-diagrams/04-runtime-data-flow.md))

5. Run `npm run build` to regenerate

### Modifying Styles

Edit `code_cards/styling.css` directly. This file is not generated.

Key selectors:
- `.card` - Base card styling
- `.content_aligned` - Main content container
- `#hint` - Hint box (`.hidden` / `.shown` states)
- `.exerciseprecontainer` - Code block container
- `input` - Answer input fields (width is set inline per-card, e.g. `style="width: 20ch;"`)
- `input.answer-correct` / `input.answer-wrong` - Graded input states
- `.answer-feedback` - Visible correct/incorrect marker and wrong-answer attempt text
- `.card.nightMode ...` - Anki night-mode overrides

## Troubleshooting

### "Functions not found" in Anki

- Ensure `module: none` in tsconfig.json
- Check that functions are defined at top level (not inside a module/namespace)
- Rebuild with `npm run build`

### Build fails with "Failed to transpile"

- A `src/` file has a TypeScript **syntax** error — the message lists the
  file, line, and TS diagnostic. Fix the syntax and rebuild.
- Only syntax errors are caught here; type errors still build fine (see
  "TypeScript errors" below).

### Build fails with "missing required placeholder"

- Ensure the base template still contains both `%COMMON_JS%` and
  `%TEMPLATE_JS%` inside the `<script>` block
- Keep `%COMMON_JS%` before `%TEMPLATE_JS%` so shared functions are available
  before template-specific initialization runs

### Tests fail but build works

- Tests transpile through the build's own `transpileSource()` (via
  `tests/helpers.ts`), so the compiler settings cannot drift between the two
- Check that `setupDom()` is called before testing functions

### Changes not appearing in Anki

1. Run `npm run build` to regenerate templates
2. In Anki: Tools → Manage Note Types → Select type → Cards
3. Re-paste the contents of `code_cards/front_template.html` and `back_template.html`
4. Copy `styling.css` content to the Styling section

### TypeScript errors

```bash
make typecheck  # tsc --noEmit for both tsconfigs
```

Remember: `npm run build` does not type-check (it only fails on syntax
errors), so a successful build does not mean the types are sound. The
pre-commit hook and CI both run the type-check, so type errors cannot
reach a commit or a merge unnoticed.

## File Dependencies

```
scripts/build-templates.ts   ← compiler settings live in transpileSource()
  ↓
  ├── templates/*_template_base.html  (structure)
  ├── src/common.ts                   (shared logic)
  └── src/{front,back}_template.ts    (template-specific logic)
  ↓
code_cards/*_template.html  (output)
```

Note: the build does **not** read `tsconfig.json` — that file (and
`tsconfig.jest.json`, which extends it) is used only by `tsc --noEmit`
type-checking and by the test runner. The build's compiler settings are
hard-coded in `transpileSource()`, which the tests import so the two cannot
drift.

## Pre-Commit Hooks

The project uses pre-commit hooks (`.pre-commit-config.yaml`):

- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Line ending normalization (→ LF)
- **TypeScript must type-check** (both tsconfigs, `--noEmit`)
- **Jest tests must pass**

```bash
pre-commit install        # Install hooks into .git/hooks
pre-commit run --all-files  # Run all hooks manually
```

## Continuous Integration

Every push and pull request runs the CI workflow
(`.github/workflows/ci.yml`) on Node 24:

```bash
npm ci                             # Clean install from package-lock.json
python -m pip install "pre-commit>=4,<5"
pre-commit run --all-files --show-diff-on-failure --color=always
npx tsc -p tsconfig.json --noEmit  # Type-check src/ (the build never type-checks)
npx tsc -p tsconfig.jest.json --noEmit  # Type-check tests/ and scripts/
npm test -- --coverage             # Run the Jest suite + coverage thresholds
npm run build                      # Regenerate the templates
git diff --exit-code code_cards/   # Fail if committed output drifted from src/
```

The last step is the drift gate: generated files in `code_cards/` are
committed to the repo so users can copy them into Anki without building, and
CI fails any change that edits `src/` or `templates/` without committing the
regenerated output. It also implicitly asserts the build is deterministic.

A PR cannot merge green if it breaks pre-commit, the types, the tests, the
build, or forgets to regenerate `code_cards/`. To make GitHub block the merge,
protect `main` and require the `Node 24` status check from the `CI` workflow.
