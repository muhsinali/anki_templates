import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildTemplate,
  injectJavaScript,
  transpileSource,
} from "../scripts/build-templates";

describe("transpileSource", () => {
  test("strips types with the build's compiler settings", () => {
    const js = transpileSource("const x: number = 1;\n", "valid.ts");
    expect(js).toContain("const x = 1;");
    expect(js).not.toContain("number");
  });

  test("throws on syntactically invalid source instead of emitting garbage", () => {
    expect(() => transpileSource("function ( { oops", "invalid.ts")).toThrow(
      /invalid\.ts/,
    );
  });
});

describe("base template invariants", () => {
  const baseTemplates = ["front", "back"].map((side) => {
    const path = join(process.cwd(), "templates", `${side}_template_base.html`);
    return [side, readFileSync(path, "utf8")] as const;
  });

  test.each(baseTemplates)(
    "%s base template contains each placeholder exactly once",
    (_side, html) => {
      expect(html.split("%COMMON_JS%").length - 1).toBe(1);
      expect(html.split("%TEMPLATE_JS%").length - 1).toBe(1);
    },
  );

  test.each(baseTemplates)(
    "%s base template contains the mobile viewport tag exactly once",
    (_side, html) => {
      expect(html.split('name="viewport"').length - 1).toBe(1);
      expect(html).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
      );
    },
  );

  test.each(baseTemplates)(
    "%s base template puts %%COMMON_JS%% before %%TEMPLATE_JS%%, inside a <script> block at the end of the body",
    (_side, html) => {
      const scriptStart = html.lastIndexOf("<script>");
      const scriptEnd = html.lastIndexOf("</script>");
      const commonAt = html.indexOf("%COMMON_JS%");
      const templateAt = html.indexOf("%TEMPLATE_JS%");

      // Common functions must be defined before the code that calls them
      expect(commonAt).toBeLessThan(templateAt);

      // Both placeholders live inside the <script> block
      expect(commonAt).toBeGreaterThan(scriptStart);
      expect(templateAt).toBeLessThan(scriptEnd);

      // The <script> block is the last thing in the template, so the
      // {{Front}} inputs above it are already parsed when it runs
      expect(html.slice(scriptEnd + "</script>".length).trim()).toBe("");
    },
  );

  test.each(baseTemplates)(
    "injected common JS precedes template JS in the built %s output",
    (_side, html) => {
      const built = injectJavaScript(html, "/*COMMON_MARKER*/", "/*TEMPLATE_MARKER*/");
      const commonAt = built.indexOf("/*COMMON_MARKER*/");
      const templateAt = built.indexOf("/*TEMPLATE_MARKER*/");
      expect(commonAt).toBeGreaterThan(-1);
      expect(commonAt).toBeLessThan(templateAt);
    },
  );
});

describe("injectJavaScript", () => {
  test("preserves replacement-looking JavaScript literally", () => {
    const commonJs = [
      'const dollars = "$$";',
      'const match = "$&";',
      'const prefix = "$`";',
      `const suffix = "$'";`,
    ].join("\n");
    const templateJs = 'const combined = "$$ $& $` $\'";';
    const baseTemplate = "<script>%COMMON_JS%\n%TEMPLATE_JS%</script>";

    expect(injectJavaScript(baseTemplate, commonJs, templateJs)).toBe(
      `<script>${commonJs}\n${templateJs}</script>`,
    );
  });

  test("throws when the common placeholder is missing", () => {
    expect(() =>
      injectJavaScript("<script>%TEMPLATE_JS%</script>", "common", "template"),
    ).toThrow("Base template is missing required placeholder %COMMON_JS%");
  });

  test("throws when the template placeholder is missing", () => {
    expect(() =>
      injectJavaScript("<script>%COMMON_JS%</script>", "common", "template"),
    ).toThrow("Base template is missing required placeholder %TEMPLATE_JS%");
  });
});

describe("buildTemplate", () => {
  const originalCwd = process.cwd();
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "anki-template-build-"));
    mkdirSync(join(workspace, "templates"));
    mkdirSync(join(workspace, "src"));
    mkdirSync(join(workspace, "code_cards"));

    writeFileSync(
      join(workspace, "templates", "front_template_base.html"),
      "<script>%COMMON_JS%\n%TEMPLATE_JS%</script>",
    );
    writeFileSync(
      join(workspace, "src", "common.ts"),
      "function sharedValue(): string { return 'shared'; }\n",
    );
    writeFileSync(
      join(workspace, "src", "front_template.ts"),
      "function templateValue(): string { return sharedValue(); }\n",
    );

    process.chdir(workspace);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  test("builds one side from base, common, and side-specific sources", () => {
    buildTemplate("front");

    const builtTemplate = readFileSync(
      join(workspace, "code_cards", "front_template.html"),
      "utf8",
    );
    expect(builtTemplate).toContain("function sharedValue()");
    expect(builtTemplate).toContain("function templateValue()");
    expect(builtTemplate).not.toContain("%COMMON_JS%");
    expect(builtTemplate).not.toContain("%TEMPLATE_JS%");
  });
});

describe("styling invariants", () => {
  const styling = readFileSync(join(process.cwd(), "code_cards", "styling.css"), "utf8");

  test("defines class-based answer states and night mode overrides", () => {
    expect(styling).toContain("input.answer-correct");
    expect(styling).toContain("input.answer-wrong");
    expect(styling).toContain(".answer-feedback");
    expect(styling).toContain(".card.nightMode");
  });
});
