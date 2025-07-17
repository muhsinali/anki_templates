# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Anki flashcard template system that generates interactive code practice cards. It transpiles TypeScript code into JavaScript and injects it into HTML templates to create Anki-compatible flashcards with interactive input fields, syntax highlighting, and automatic answer validation.

## Development Commands

### Build
```bash
npm run build
```
Transpiles TypeScript source files and generates final HTML templates in `code_cards/` directory.

### Test
```bash
npm test
```
Runs Jest tests for all components using jsdom environment.

### Manual TypeScript Compilation
```bash
npx tsc -p tsconfig.json
```
Compiles TypeScript files to `dist/` directory (used internally by build process).

## Architecture

### Core Build Process (`scripts/build-templates.ts`)
1. Reads base HTML templates from `templates/`
2. Transpiles TypeScript files from `src/` to ES2022 JavaScript (module: none)
3. Injects JavaScript into HTML template placeholders (`%COMMON_JS%`, `%TEMPLATE_JS%`)
4. Outputs final HTML files to `code_cards/`

### Source Structure
- `src/common.ts` - Shared functions (displayTags, prettifyTag, setLinkText)
- `src/front_template.ts` - Front card logic (placeCursor, setupEnterKeyEvent, input handling)
- `src/back_template.ts` - Back card logic (parseInput, revealAnswer, validation)
- `templates/` - HTML base templates with placeholders for JavaScript injection

### Template System
- Front template: Interactive input fields with autofocus, mobile-optimized typing
- Back template: Answer validation with visual feedback (green/red highlighting)
- Both templates support: tag display, URL linking, hint system

### Key Functions
- `parseInput()` - Normalizes quotes and whitespace for answer comparison
- `revealAnswer()` - Compares user input to expected answers, applies color coding
- `displayTags()` - Parses and displays hierarchical tags in sorted order
- `placeCursor()` - Automatically focuses first input field on card load

## Testing

Tests use Jest with jsdom environment to simulate DOM interactions. Test files mirror source structure:
- `tests/common.test.ts`
- `tests/front_template.test.ts`
- `tests/back_template.test.ts`

## Output Files

Generated templates are placed in `code_cards/`:
- `front_template.html` - What users see when studying
- `back_template.html` - What users see after revealing answer
- `styling.css` - Shared styles (manually maintained)
