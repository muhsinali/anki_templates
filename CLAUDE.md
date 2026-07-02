# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Anki flashcard template system that generates interactive code practice cards. It transpiles TypeScript into JavaScript and injects it into HTML templates to create Anki-compatible flashcards with interactive input fields and automatic answer validation.

## Documentation Map

- `README.md` — User-facing: what the cards do, Anki setup, authoring cards, tagging/linking conventions
- `BUILD.md` — Developer-facing: build/test workflow, extending the system, troubleshooting
- `documentation/architecture-diagrams/` — Six hand-authored Mermaid diagrams (system context, build pipeline, module structure, runtime data flow, answer validation, card lifecycles). Update these when the architecture changes.

## Development Commands

```bash
npm run build                      # Transpile TS and generate HTML templates in code_cards/
npm test                           # Run Jest tests with jsdom environment
npm test -- --watch                # Watch mode
npm test -- path/to/test           # Run specific test file
npx tsc -p tsconfig.json --noEmit  # Type-check only (build does not type-check)
```

`npm run build:templates` is an alias for `npm run build`.

## Directory Structure

```
├── src/                           # TypeScript source files
│   ├── common.ts                  # Shared: displayTags, prettifyTag, setLinkText
│   ├── front_template.ts          # Front card: placeCursor, storeInput, setupHint, etc.
│   └── back_template.ts           # Back card: parseInput, revealAnswer
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
│   └── architecture-diagrams/     # Mermaid diagrams 01-06 + index README
├── BUILD.md                       # Build/test/troubleshooting guide
└── dist/                          # Output of manual `npx tsc` only (gitignored, unused by build)
```

## Architecture

### Build Process (`scripts/build-templates.ts`)
1. Reads base HTML template from `templates/`
2. Transpiles `src/common.ts` → replaces `%COMMON_JS%` placeholder
3. Transpiles `src/{front,back}_template.ts` → replaces `%TEMPLATE_JS%` placeholder
4. Writes final HTML to `code_cards/`

**Critical TypeScript settings:**
- `module: none` - Functions attach to global scope (no module wrapper). This is what makes `window.data` a true global shared between front and back.
- `target: ES2022` - Modern JS features

`%COMMON_JS%` always precedes `%TEMPLATE_JS%` in the base HTML, so shared functions are defined before the template-specific code that calls them.

### Data Flow Between Templates

Anki renders the front and back in the **same webview/JS context**, so globals survive the card flip — but the DOM does not. The back base template re-renders `{{Front}}`, which recreates every `<input>` fresh and empty. The learner's typed answers survive the flip only inside `window.data`:

1. **Front template** (`initializeFrontTemplate`):
   - `storeInput()` creates `window.data = { inputName: value, ... }`
   - `input` event listeners keep `window.data` synced as the user types
2. **Flip** (Enter → `pycmd("ans")`): same JS context, so `window.data` persists; the back's `{{Front}}` render recreates the inputs empty
3. **Back template** (`initializeBackTemplate`):
   - `revealAnswer(window.data)` grades each recreated input against its `name`, colors it, and overwrites its value with the correct answer (bold)

The `<script>` block sits at the end of each template, so the `{{Front}}` inputs above it already exist when `storeInput()` runs synchronously. Only `setInputAttributes()`/`placeCursor()` are deferred via `setupDOMContentLoaded()`.

### Answer Validation System

**The `name` attribute of `<input>` elements is the expected answer:**

```html
<!-- In Anki card Front field: -->
<input name="console.log">  <!-- Expected answer is "console.log" -->
```

- `revealAnswer()` compares normalized user input against input name
- Normalization: smart quotes → straight quotes, all whitespace stripped
- Colors: `rgb(124,232,0)` = correct (green), `rgb(240,128,128)` = wrong (red)
- Untouched/missing inputs grade as empty string (wrong), never throw (`data[name] ?? ""`)

### Anki Field Syntax

Templates use Anki's mustache-style field placeholders:
- `{{Front}}`, `{{Back}}`, `{{Hint}}`, `{{Tags}}`, `{{URL}}`
- Conditional: `{{#Hint}}...{{/Hint}}` (renders only if Hint field has content)
- Substitution happens **anywhere** in the template, including inside `<script>` — `displayTags("{{Tags}}")` works because Anki injects the tag string directly into the JS source at render time

### Anki Integration

- `window.pycmd("ans")` - Calls Anki Python backend to show answer
- Called on Enter key press (front template); guarded with `typeof pycmd !== "undefined"` so it's a no-op outside Anki (e.g. in tests)

## Key Functions

### common.ts
- `displayTags(tagsString)` - Parses space-delimited tags, prettifies, sorts, displays in `#content_tag_left`
- `prettifyTag(tag)` - `"Computing::Machine_Learning"` → `"Computing - Machine Learning"`
- `setLinkText()` - Sets first `<a>` element's text to "Link"

### front_template.ts
- `placeCursor()` - Focuses first `<input>` element
- `setInputAttributes()` - Disables autocapitalize/autocomplete/autocorrect/spellcheck
- `setupDOMContentLoaded(callback)` - Runs callback now if DOM is ready, else on `DOMContentLoaded`
- `storeInput()` - Creates and returns the object stored as `window.data`, tracking all named inputs
- `setupHint()` - Touch/mouse listeners to reveal hint (sets className to "shown")
- `setupEnterKeyEvent()` - Enter key shows answer via `pycmd("ans")`

### back_template.ts
- `parseInput(str)` - Normalizes quotes (`""`→`"`, `''`→`'`) and strips whitespace
- `revealAnswer(data)` - Colors inputs green/red, overwrites each input's value with the correct answer in bold

## Testing

Tests use Jest (`ts-jest` preset, jsdom environment — see `jest.config.js` and `tsconfig.jest.json`). Each test file:
1. Sets `document.body.innerHTML`
2. Transpiles the real `src/` files with the same compiler settings as the build (`module: none`, `target: ES2022`)
3. `eval()`s the transpiled code to attach functions to `window` — so tests exercise the exact code that ships
4. Tests functions via `(window as any).functionName()`

Test files load `common.ts` before the template-specific file, mirroring the placeholder order in the built HTML.

## Known Limitations & Gotchas

1. **iPhone**: Enter key to show answer does not work on iPhone
2. **Named inputs only**: Inputs without `name` attribute are silently skipped
3. **Whitespace comparison**: All whitespace is stripped during answer comparison (intentional formatting differences won't matter)
4. **CSS not generated**: `code_cards/styling.css` is manually maintained, not regenerated by build
5. **CSS @import**: `styling.css` starts with `@import url("_editor_button_styles.css")` — that file is **not in this repo**; it lives in the user's Anki media collection. A missing file fails silently.
6. **Hint classes differ per side**: front hint starts as `class="hidden"` (click to reveal); back hint is hard-coded `class="shown"`
7. **Synchronous file I/O**: Build script uses `readFileSync`/`writeFileSync`
8. **URL field**: Must paste with `Ctrl+Shift+V` (plain text) in Anki to avoid link formatting issues
9. **Build does not type-check**: `ts.transpile()` skips type errors — run `npx tsc -p tsconfig.json --noEmit` to catch them

## Styling Reference

Key CSS selectors in `code_cards/styling.css`:
- `.card` - Base card styling (Arial 18px)
- `.content_aligned` - Main content container (absolute: top 6%, left 11%, width 76%, height 70%)
- `#hint` - Hint box (`.hidden` hides `.payload`; `.shown` hides `.trigger` and shows `.payload`)
- `.exerciseprecontainer` - Code block container (MesloLGS NF font, grey rounded box)
- `input` - Code input fields (MesloLGS NF 16px; width is NOT set here — cards size inputs inline, e.g. `style="width: 20ch;"`)
- `#content_tag_left` - Tag display area (bottom-left)
- `#url_container` - URL area (bottom-right)

## Pre-Commit Hooks

`.pre-commit-config.yaml` runs:
- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Line ending normalization (→ LF)
- **Jest tests must pass before commit**

Install with `pre-commit install`; run manually with `pre-commit run --all-files`.
