# Build Instructions

This project generates Anki card templates from TypeScript source code.

## Structure

- `src/common.ts` - Common functions shared between front and back templates
- `src/front_template.ts` - Front template specific functions 
- `src/back_template.ts` - Back template specific functions
- `templates/` - HTML template base files
- `scripts/build-templates.ts` - Build script that generates final HTML files

## Build Command

To generate the front_template.html and back_template.html files:

```bash
npm run build
```

This will:
1. Transpile TypeScript files to JavaScript
2. Inject the JavaScript into the HTML template bases
3. Output final HTML files to `code_cards/` directory

## Testing

Run all tests:

```bash
npm test
```

Tests cover:
- Common functions (displayTags, prettifyTag, setLinkText)
- Front template functions (placeCursor, setupEnterKeyEvent, etc.)
- Back template functions (parseInput, revealAnswer)