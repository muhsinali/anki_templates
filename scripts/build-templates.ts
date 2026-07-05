import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const COMMON_JS_PLACEHOLDER = "%COMMON_JS%";
const TEMPLATE_JS_PLACEHOLDER = "%TEMPLATE_JS%";
const TEMPLATE_SIDES = ["front", "back"] as const;

type TemplateSide = typeof TEMPLATE_SIDES[number];

interface TemplatePaths {
  base: string;
  commonSource: string;
  sideSource: string;
  output: string;
}

/**
 * Transpile one global-script TypeScript file exactly as Anki will receive it.
 *
 * Tests import this function so coverage and unit harnesses use the same
 * compiler settings as the real build.
 */
export function transpileSource(
  source: string,
  fileName: string,
  overrides: ts.CompilerOptions = {},
): string {
  const diagnostics: ts.Diagnostic[] = [];
  const transpiled = ts.transpile(
    source,
    {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
      ...overrides,
    },
    fileName,
    diagnostics,
  );

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
 * Inject transpiled JavaScript into an Anki base template.
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

function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

function transpileFile(path: string): string {
  return transpileSource(readTextFile(path), path);
}

function pathsFor(side: TemplateSide): TemplatePaths {
  return {
    base: projectPath("templates", `${side}_template_base.html`),
    commonSource: projectPath("src", "common.ts"),
    sideSource: projectPath("src", `${side}_template.ts`),
    output: projectPath("code_cards", `${side}_template.html`),
  };
}

export function buildTemplate(side: TemplateSide): void {
  const paths = pathsFor(side);
  const finalTemplate = injectJavaScript(
    readTextFile(paths.base),
    transpileFile(paths.commonSource),
    transpileFile(paths.sideSource),
  );

  writeFileSync(paths.output, finalTemplate);
  console.log(`Generated ${paths.output}`);
}

function main(): void {
  console.log("Building Anki templates...");
  TEMPLATE_SIDES.forEach(buildTemplate);
  console.log("Templates built successfully!");
}

if (require.main === module) {
  main();
}
