# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Anki flashcard template system that generates interactive code practice cards. It transpiles TypeScript code into JavaScript and injects it into HTML templates to create Anki-compatible flashcards with interactive input fields, syntax highlighting, and automatic answer validation.

## Development Commands

```bash
npm run build          # Transpile TS and generate HTML templates in code_cards/
npm test               # Run Jest tests with jsdom environment
npx tsc -p tsconfig.json  # Manual TS compilation to dist/ (rarely needed)
```

## Directory Structure

```
├── src/                           # TypeScript source files
│   ├── common.ts                  # Shared: displayTags, prettifyTag, setLinkText
│   ├── front_template.ts          # Front card: placeCursor, storeInput, setupHint, etc.
│   └── back_template.ts           # Back card: parseInput, revealAnswer
├── templates/                     # Base HTML with placeholders
│   ├── front_template_base.html   # Contains %COMMON_JS% and %TEMPLATE_JS%
│   └── back_template_base.html
├── scripts/
│   └── build-templates.ts         # Build orchestrator
├── tests/                         # Jest tests (mirrors src/ structure)
├── code_cards/                    # Generated output (Anki-ready)
│   ├── front_template.html        # Generated - do not edit directly
│   ├── back_template.html         # Generated - do not edit directly
│   └── styling.css                # MANUALLY MAINTAINED - not generated
└── dist/                          # TS compiler output (unused by build)
```

## Architecture

### Build Process (`scripts/build-templates.ts`)
1. Reads base HTML template from `templates/`
2. Transpiles `src/common.ts` → replaces `%COMMON_JS%` placeholder
3. Transpiles `src/{front,back}_template.ts` → replaces `%TEMPLATE_JS%` placeholder
4. Writes final HTML to `code_cards/`

**Critical TypeScript settings:**
- `module: none` - Functions attach to global scope (no module wrapper)
- `target: ES2022` - Modern JS features

### Data Flow Between Templates

The front and back templates share user input via `window.data`:

1. **Front template** (`initializeFrontTemplate`):
   - `storeInput()` creates `window.data = { inputName: value, ... }`
   - Event listeners keep `window.data` synced as user types

2. **Back template** (`initializeBackTemplate`):
   - Reads `window.data` from front template
   - `revealAnswer(window.data)` compares input vs expected

### Answer Validation System

**The `name` attribute of `<input>` elements is the expected answer:**

```html
<!-- In Anki card Front field: -->
<input name="console.log">  <!-- Expected answer is "console.log" -->
```

- `revealAnswer()` compares normalized user input against input name
- Normalization: smart quotes → straight quotes, all whitespace stripped
- Colors: `rgb(124,232,0)` = correct (green), `rgb(240,128,128)` = wrong (red)

### Anki Field Syntax

Templates use Anki's mustache-style field placeholders:
- `{{Front}}`, `{{Back}}`, `{{Hint}}`, `{{Tags}}`, `{{URL}}`
- Conditional: `{{#Hint}}...{{/Hint}}` (renders only if Hint field has content)

### Anki Integration

- `window.pycmd("ans")` - Calls Anki Python backend to show answer
- Called on Enter key press (front template)

## Key Functions

### common.ts
- `displayTags(tagsString)` - Parses space-delimited tags, prettifies, sorts, displays in `#content_tag_left`
- `prettifyTag(tag)` - `"Computing::Machine_Learning"` → `"Computing - Machine Learning"`
- `setLinkText()` - Sets first `<a>` element's text to "Link"

### front_template.ts
- `placeCursor()` - Focuses first `<input>` element
- `setInputAttributes()` - Disables autocapitalize/autocomplete/autocorrect/spellcheck
- `storeInput()` - Creates and returns `window.data` object tracking all named inputs
- `setupHint()` - Touch/mouse listeners to reveal hint (sets className to "shown")
- `setupEnterKeyEvent()` - Enter key shows answer via `pycmd("ans")`

### back_template.ts
- `parseInput(str)` - Normalizes quotes (`""`→`"`, `''`→`'`) and strips whitespace
- `revealAnswer(data)` - Colors inputs green/red, shows correct answer in bold

## Testing

Tests use Jest + jsdom. Each test file:
1. Sets `document.body.innerHTML`
2. Transpiles source files with matching TS settings
3. `eval()` the transpiled code to attach functions to `window`
4. Tests functions via `(window as any).functionName()`

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- path/to/test    # Run specific test
```

## Known Limitations & Gotchas

1. **iPhone**: Enter key to show answer does not work on iPhone
2. **Named inputs only**: Inputs without `name` attribute are silently skipped
3. **Whitespace comparison**: All whitespace is stripped during answer comparison (intentional formatting differences won't matter)
4. **CSS not generated**: `code_cards/styling.css` is manually maintained, not regenerated by build
5. **Synchronous file I/O**: Build script uses `readFileSync`/`writeFileSync`
6. **URL field**: Must paste with `Ctrl+Shift+V` (plain text) in Anki to avoid link formatting issues

## Styling Reference

Key CSS classes in `code_cards/styling.css`:
- `.card` - Base card styling (Arial 18px)
- `.content_aligned` - Main content container (positioned at 70% height, 11% from left)
- `#hint` - Hint styling (`.hidden` vs `.shown` states toggle visibility)
- `.exerciseprecontainer` - Code block container (MesloLGS NF font)
- `input` - Code input fields (MesloLGS NF font, max-width 300px)
- `#content_tag_left` - Tag display area (bottom-left)
- `#url_container` - URL area (bottom-right)

## Pre-Commit Hooks

`.pre-commit-config.yaml` runs:
- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Line ending normalization (→ LF)
- **Jest tests must pass before commit**
