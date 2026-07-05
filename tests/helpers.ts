// Shared test harness for the eval-based unit tests.
//
// Transpiles src/ files through the build's own transpileSource() — the
// single home of the compiler settings — and evals them into the jsdom
// window so their functions attach as globals, exactly like the shipped
// templates. Transpiled output is cached per file (sources don't change
// mid-run).
//
// Note: eval'ing a template file also runs its initialize*() call at the
// bottom of the file as a side effect, against whatever DOM is present.
// That mirrors how the shipped <script> behaves in Anki and is accepted
// here; tests that need a clean run call the initialize*() global directly.
import { readFileSync } from "fs";
import { join } from "path";
import { transpileSource } from "../scripts/build-templates";

const transpileCache = new Map<string, string>();

/**
 * Load one or more src/ files into the window, in order. Pass dependencies
 * first (e.g. loadScripts("common.ts", "front_template.ts") mirrors the
 * %COMMON_JS% → %TEMPLATE_JS% order in the built HTML).
 */
export function loadScripts(...sourceFiles: string[]): void {
  for (const sourceFile of sourceFiles) {
    let transpiled = transpileCache.get(sourceFile);
    if (transpiled === undefined) {
      const sourcePath = join(process.cwd(), "src", sourceFile);
      // inlineSourceMap plus the file:// sourceURL let Jest's V8 coverage
      // provider attribute the eval'd code back to the real .ts file —
      // without them the eval'd sources are invisible to coverage
      transpiled =
        transpileSource(readFileSync(sourcePath, "utf8"), sourcePath, {
          inlineSourceMap: true,
        }) + `\n//# sourceURL=file://${sourcePath}`;
      transpileCache.set(sourceFile, transpiled);
    }
    window.eval(transpiled);
  }
}
