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

/**
 * Transpiles a TypeScript file to JavaScript
 * 
 * @param filePath - Absolute path to the TypeScript file
 * @returns Transpiled JavaScript code as a string
 * 
 * Configuration:
 * - module: None (no module system, functions attach to global scope)
 * - target: ES2022 (modern JavaScript with async/await, optional chaining, etc.)
 */
function transpileTypeScript(filePath: string): string {
  const source = readFileSync(filePath, "utf8");
  return ts.transpile(source, {
    module: ts.ModuleKind.None,     // No module system - functions are global
    target: ts.ScriptTarget.ES2022, // Modern JavaScript features
  });
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
  const commonJs = transpileTypeScript(commonPath);

  // Transpile template-specific TypeScript functions
  // Front: placeCursor, setupEnterKeyEvent, storeInput, etc.
  // Back: parseInput, revealAnswer, etc.
  const templatePath = join(process.cwd(), "src", `${templateName}_template.ts`);
  const templateJs = transpileTypeScript(templatePath);

  // Replace placeholders in HTML template with transpiled JavaScript
  // %COMMON_JS% -> common functions (displayTags, prettifyTag, setLinkText)
  // %TEMPLATE_JS% -> template-specific functions and initialization
  const finalTemplate = baseTemplate
    .replace("%COMMON_JS%", commonJs)
    .replace("%TEMPLATE_JS%", templateJs);

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
main();
