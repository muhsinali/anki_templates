# Build Instructions

This document explains how to build, test, and extend the Anki template system.

**Related docs:**
- [README.md](README.md) — what the cards do and how to set them up in Anki
- [documentation/architecture-diagrams/](documentation/architecture-diagrams/README.md) — visual (Mermaid) versions of the pipeline and runtime flows described here
- [CLAUDE.md](CLAUDE.md) — condensed project reference (used by Claude Code, useful for humans too)

## Prerequisites

- Node.js (v22+ — CI runs on Node 22 and 24, the maintained LTS lines)
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
| `make check` | test + build — run this before committing |
| `make hooks` | Install the pre-commit git hooks |
| `make clean` | Remove `dist/` and `coverage/` |

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
| `src/back_template.ts` | Back card logic | `parseInput`, `revealAnswer` |

## Output Files

Generated files in `code_cards/`:

| File | Size | Purpose |
|------|------|---------|
| `front_template.html` | ~4KB | Card question side - paste into Anki |
| `back_template.html` | ~2.5KB | Card answer side - paste into Anki |
| `styling.css` | ~1.6KB | Shared styles - **manually maintained** |

**Important:** `styling.css` is NOT generated by the build. Edit it directly.
Note that its first line `@import url("_editor_button_styles.css")` references
a file that lives in your Anki media collection, not in this repo — if that
file is absent the import fails silently.

## Testing

### Run Tests

```bash
npm test                      # Run all tests
npm test -- --watch           # Watch mode (re-run on changes)
npm test -- --coverage        # Generate coverage report (see warning below)
npm test -- tests/common.test.ts  # Run specific test file
```

> **Warning:** the coverage report currently shows 0% for all `src/` files even though
> the suite passes — the tests `eval()` transpiled source, which Jest's default
> (Istanbul) instrumentation cannot see. Don't use the numbers. A verified fix (V8
> coverage provider + `sourceURL` attribution) is specified in
> [improve-test-infrastructure.md](improve-test-infrastructure.md), step 5.

### Test Architecture

Tests use Jest with jsdom to simulate a browser DOM:

1. Set up DOM with `document.body.innerHTML = '<html>...'`
2. Transpile the real `src/` files with `transpileSource()`, imported from
   the build script — the same code path and compiler settings
   (`module: none`, `target: ES2022`) the shipped templates are built with,
   so the two can never drift apart
3. Execute transpiled code with `eval()` to attach functions to `window` —
   so tests exercise the exact code that ships
4. Test functions via `(window as any).functionName()`

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
   DOM re-rendered from `{{Front}}`, back script eval'd, grading asserted

One nuance to leave alone: the built script begins with `"use strict"`, so
under `eval()` its function declarations stay scoped to the eval instead of
becoming globals (in a real `<script>` tag they would become globals). That
is fine — each side's script is self-contained, and the only state that must
cross the flip, `window.data`, is assigned to `window` explicitly.

Test configuration:

| File | Role |
|------|------|
| `jest.config.js` | `ts-jest` preset, `jsdom` test environment, points at `tsconfig.jest.json` |
| `tsconfig.jest.json` | Extends `tsconfig.json`; adds `isolatedModules`, `noEmit`, jest/node types |

### Test Files

| Test File | Tests For |
|-----------|-----------|
| `tests/build_templates.test.ts` | Transpile diagnostics, placeholder validation, literal JavaScript injection, base-template invariants |
| `tests/integration.test.ts` | End-to-end card lifecycle: in-memory build → field render → front → type → Enter → flip → grading |
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
       expect((window as any).myNewFunction()).toBe(expected);
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

- Tests transpile through the build's own `transpileSource()`, so the
  compiler settings cannot drift between the two
- Check that `setupDom()` is called before testing functions
- Ensure TextEncoder/TextDecoder polyfills are imported in test file

### Changes not appearing in Anki

1. Run `npm run build` to regenerate templates
2. In Anki: Tools → Manage Note Types → Select type → Cards
3. Re-paste the contents of `code_cards/front_template.html` and `back_template.html`
4. Copy `styling.css` content to the Styling section

### Styling looks wrong in Anki

- `styling.css` imports `_editor_button_styles.css` from the Anki media
  collection. If you don't have that file, the import fails silently — either
  add the file to your media collection or remove the `@import` line when
  pasting the styles.

### TypeScript errors

```bash
npx tsc -p tsconfig.json --noEmit  # Check for type errors without emitting
```

Remember: `npm run build` does not type-check, so a successful build does not
mean the types are sound.

## File Dependencies

```
tsconfig.json          ← TypeScript compiler options
  ↓
scripts/build-templates.ts
  ↓
  ├── templates/*_template_base.html  (structure)
  ├── src/common.ts                   (shared logic)
  └── src/{front,back}_template.ts    (template-specific logic)
  ↓
code_cards/*_template.html  (output)
```

## Pre-Commit Hooks

The project uses pre-commit hooks (`.pre-commit-config.yaml`):

- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Line ending normalization (→ LF)
- **Jest tests must pass**

```bash
pre-commit install        # Install hooks into .git/hooks
pre-commit run --all-files  # Run all hooks manually
```

## Continuous Integration

Every push and pull request runs the CI workflow
(`.github/workflows/ci.yml`) on Node 22 and 24:

```bash
npm ci                             # Clean install from package-lock.json
npx tsc -p tsconfig.json --noEmit  # Type-check src/ (the build never type-checks)
npx tsc -p tsconfig.jest.json --noEmit  # Type-check tests/ and scripts/
npm test                           # Run the Jest suite
npm run build                      # Regenerate the templates
git diff --exit-code code_cards/   # Fail if committed output drifted from src/
```

The last step is the drift gate: generated files in `code_cards/` are
committed to the repo so users can copy them into Anki without building, and
CI fails any change that edits `src/` or `templates/` without committing the
regenerated output. It also implicitly asserts the build is deterministic.

A PR cannot merge green if it breaks the types, the tests, the build, or
forgets to regenerate `code_cards/`.
