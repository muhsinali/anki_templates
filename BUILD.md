# Build Instructions

This document explains how to build, test, and extend the Anki template system.

**Related docs:**
- [README.md](README.md) — what the cards do and how to set them up in Anki
- [documentation/architecture-diagrams/](documentation/architecture-diagrams/README.md) — visual (Mermaid) versions of the pipeline and runtime flows described here
- [CLAUDE.md](CLAUDE.md) — condensed project reference (used by Claude Code, useful for humans too)

## Prerequisites

- Node.js (v18+ recommended)
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
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
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
- The `<script>` block sits at the **end** of the template body, so the
  `{{Front}}` inputs above it are already in the DOM when the initialization
  code runs.

### What the build does NOT do

- **No type-checking.** `ts.transpile()` strips types without checking them.
  Run `npx tsc -p tsconfig.json --noEmit` to catch type errors.
- **No CSS generation.** `code_cards/styling.css` is hand-maintained.
- **No bundling/minification.** The build is `readFileSync` → `ts.transpile`
  → `String.replace` → `writeFileSync`, all synchronous.

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
npm test -- --coverage        # Generate coverage report
npm test -- tests/common.test.ts  # Run specific test file
```

### Test Architecture

Tests use Jest with jsdom to simulate a browser DOM:

1. Set up DOM with `document.body.innerHTML = '<html>...'`
2. Transpile the real `src/` files using the same settings as the build
   (`module: none`, `target: ES2022`)
3. Execute transpiled code with `eval()` to attach functions to `window` —
   so tests exercise the exact code that ships
4. Test functions via `(window as any).functionName()`

Template test files load `common.ts` before the template-specific file,
mirroring the `%COMMON_JS%` → `%TEMPLATE_JS%` order in the built HTML.

Test configuration:

| File | Role |
|------|------|
| `jest.config.js` | `ts-jest` preset, `jsdom` test environment, points at `tsconfig.jest.json` |
| `tsconfig.jest.json` | Extends `tsconfig.json`; adds `isolatedModules`, `noEmit`, jest/node types |

### Test Files

| Test File | Tests For |
|-----------|-----------|
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

### Tests fail but build works

- Tests use the same transpilation settings as build
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

## CI/CD Considerations

There is currently no CI pipeline configured (no GitHub Actions workflows).
For automated builds, the canonical sequence is:

```bash
npm ci                 # Clean install (faster, uses package-lock.json)
npm test               # Run tests
npm run build          # Generate templates
```

Generated files in `code_cards/` are committed to the repo so users can copy
them into Anki without building — remember to commit regenerated output
alongside source changes.
