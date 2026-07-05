/**
 * Anki Template Build Script
 *
 * This script generates HTML template files for Anki flashcards by combining:
 * 1. Base HTML templates (structure and layout)
 * 2. Common TypeScript functions (shared between front and back)
 * 3. Template-specific TypeScript functions (front or back specific)
 *
 * The build process:
 * - Reads TypeScript source files from src/
 * - Transpiles TypeScript to JavaScript using the TypeScript compiler
 * - Injects the JavaScript into HTML template placeholders
 * - Outputs final HTML files to code_cards/ directory
 *
 * Usage: npm run build
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const COMMON_JS_PLACEHOLDER = "%COMMON_JS%";
const TEMPLATE_JS_PLACEHOLDER = "%TEMPLATE_JS%";

/**
 * Transpiles TypeScript source text to JavaScript
 *
 * This is the single home of the build's compiler settings — tests import it
 * so they can never drift from what the build actually produces.
 *
 * @param source - TypeScript source text
 * @param fileName - Name used in error messages (typically the source path)
 * @param overrides - Extra compiler options merged on top of the build
 *                    settings. The build itself never passes any; the test
 *                    harness adds inlineSourceMap so coverage can attribute
 *                    eval'd code back to the .ts source.
 * @returns Transpiled JavaScript code as a string
 * @throws When the source has syntax errors (ts.transpile would otherwise
 *         silently emit mangled output and the build would report success)
 *
 * Configuration:
 * - module: None (no module system, functions attach to global scope)
 * - target: ES2022 (modern JavaScript with async/await, optional chaining, etc.)
 */
export function transpileSource(
  source: string,
  fileName: string,
  overrides: ts.CompilerOptions = {},
): string {
  const diagnostics: ts.Diagnostic[] = [];
  const transpiled = ts.transpile(source, {
    module: ts.ModuleKind.None,     // No module system - functions are global
    target: ts.ScriptTarget.ES2022, // Modern JavaScript features
    ...overrides,
  }, fileName, diagnostics);

  if (diagnostics.length > 0) {
    const details = ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    });
    throw new Error(`Failed to transpile ${fileName}:\n${details}`);
  }

  return transpiled;
}

function replacePlaceholder(
  template: string,
  placeholder: string,
  replacement: string,
): string {
  if (!template.includes(placeholder)) {
    throw new Error(`Base template is missing required placeholder ${placeholder}`);
  }

  return template.replace(placeholder, () => replacement);
}

/**
 * Injects transpiled JavaScript into an Anki base template.
 *
 * The replacer callbacks keep JavaScript replacement patterns such as "$$" and
 * "$&" literal instead of letting String.replace rewrite them.
 */
export function injectJavaScript(
  baseTemplate: string,
  commonJs: string,
  templateJs: string,
): string {
  return replacePlaceholder(
    replacePlaceholder(baseTemplate, COMMON_JS_PLACEHOLDER, commonJs),
    TEMPLATE_JS_PLACEHOLDER,
    templateJs,
  );
}

/**
 * Builds a single Anki template (front or back)
 *
 * Process:
 * 1. Read the base HTML template file
 * 2. Transpile common.ts (shared functions like displayTags, prettifyTag)
 * 3. Transpile template-specific .ts file (front_template.ts or back_template.ts)
 * 4. Replace placeholders in HTML with transpiled JavaScript
 * 5. Write final HTML file to code_cards/ directory
 *
 * @param templateName - Either "front" or "back"
 */
function buildTemplate(templateName: "front" | "back"): void {
  // Read the base HTML template containing structure and placeholders
  const baseTemplatePath = join(process.cwd(), "templates", `${templateName}_template_base.html`);
  const baseTemplate = readFileSync(baseTemplatePath, "utf8");

  // Transpile common TypeScript functions shared between templates
  // These include: displayTags, prettifyTag, setLinkText
  const commonPath = join(process.cwd(), "src", "common.ts");
  const commonJs = transpileSource(readFileSync(commonPath, "utf8"), commonPath);

  // Transpile template-specific TypeScript functions
  // Front: placeCursor, setupEnterKeyEvent, storeInput, etc.
  // Back: parseInput, revealAnswer, etc.
  const templatePath = join(process.cwd(), "src", `${templateName}_template.ts`);
  const templateJs = transpileSource(readFileSync(templatePath, "utf8"), templatePath);

  // Replace placeholders in HTML template with transpiled JavaScript
  // %COMMON_JS% -> common functions (displayTags, prettifyTag, setLinkText)
  // %TEMPLATE_JS% -> template-specific functions and initialization
  const finalTemplate = injectJavaScript(baseTemplate, commonJs, templateJs);

  // Write the final HTML file to the code_cards directory
  // This is where Anki expects to find the template files
  const outputPath = join(process.cwd(), "code_cards", `${templateName}_template.html`);
  writeFileSync(outputPath, finalTemplate);

  console.log(`Generated ${outputPath}`);
}

/**
 * Main build function
 *
 * Builds both front and back templates in sequence.
 * Called when script is executed via npm run build.
 */
function main(): void {
  console.log("Building Anki templates...");

  // Build front template (what users see when studying)
  buildTemplate("front");

  // Build back template (what users see after revealing answer)
  buildTemplate("back");

  console.log("Templates built successfully!");
}

// Execute the build process
if (require.main === module) {
  main();
}
