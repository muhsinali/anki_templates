import { injectJavaScript } from "../scripts/build-templates";

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
