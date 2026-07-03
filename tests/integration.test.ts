// End-to-end card lifecycle test: build both templates in-memory through the
// real build code path, render Anki's fields, run the front, type, flip, and
// grade — the whole journey a card takes inside Anki's webview.
import { readFileSync } from "fs";
import { join } from "path";
import { injectJavaScript, transpileSource } from "../scripts/build-templates";

// Build a template exactly as scripts/build-templates.ts does, but in-memory
function buildTemplate(side: "front" | "back"): string {
  const basePath = join(process.cwd(), "templates", `${side}_template_base.html`);
  const commonPath = join(process.cwd(), "src", "common.ts");
  const templatePath = join(process.cwd(), "src", `${side}_template.ts`);
  return injectJavaScript(
    readFileSync(basePath, "utf8"),
    transpileSource(readFileSync(commonPath, "utf8"), commonPath),
    transpileSource(readFileSync(templatePath, "utf8"), templatePath),
  );
}

const builtFront = buildTemplate("front");
const builtBack = buildTemplate("back");

// Minimal stand-in for Anki's field rendering: {{#Field}}...{{/Field}}
// conditionals first, then plain {{Field}} substitution. Substitution applies
// to the whole template, script included — exactly like Anki, which is what
// makes the displayTags("{{Tags}}") call in the source work.
function renderFields(template: string, fields: Record<string, string>): string {
  return template
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, name, body) =>
      fields[name] ? body : "",
    )
    .replace(/\{\{(\w+)\}\}/g, (_match, name) => fields[name] ?? "");
}

// Load a rendered card the way Anki's webview runs it: DOM first, script
// after. Setting body.innerHTML never executes <script> tags, so the script
// is extracted and eval'd. The built script begins with "use strict", so its
// function declarations stay scoped to the eval instead of becoming globals —
// that is fine, and intentional: each side's script is self-contained, and
// the only state that must survive the flip, window.data, is assigned to
// window explicitly. Don't "fix" this.
function loadCard(renderedHtml: string): void {
  const match = renderedHtml.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("built template has no <script> block");
  document.body.innerHTML = renderedHtml.replace(match[0], "");
  window.eval(match[1]);
}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new window.Event("input"));
}

// Fixture card: two answers, the second with smart quotes in the expected
// answer (the shipped grading bug class), plus hint, tags, and a URL
const FIELDS = {
  Front:
    'How do you print in JS, and in Python?<div class="exerciseprecontainer"><pre>' +
    '<input name="console.log" style="width: 20ch;">\n' +
    '<input name="print(“hi”)" style="width: 20ch;">' +
    "</pre></div>",
  Back: "Remember the quotes.",
  Hint: "Both start with a lowercase letter",
  Tags: "Computing::JavaScript src::MDN",
  URL: '<a href="https://example.com/print">https://example.com/print</a>',
};

const GREEN = "rgb(124, 232, 0)";
const RED = "rgb(240, 128, 128)";

beforeEach(() => {
  delete window.data;
  delete window.pycmd;
});

describe("card lifecycle", () => {
  test("typed answers survive the flip and grade correctly", () => {
    loadCard(renderFields(builtFront, FIELDS));

    // Front rendered: two inputs, hint hidden, cursor placed, mobile
    // typing attributes set (jsdom's readyState is "complete", so the
    // setupDOMContentLoaded() work runs synchronously during load)
    const frontInputs = document.querySelectorAll("input");
    expect(frontInputs).toHaveLength(2);
    expect(document.getElementById("hint")?.className).toBe("hidden");
    expect(document.activeElement).toBe(frontInputs[0]);
    expect(frontInputs[0].getAttribute("spellcheck")).toBe("false");

    // Type: first answer exact, second with straight quotes against a
    // smart-quoted expected answer — pins the quote-normalization fix at
    // the system level
    typeInto(frontInputs[0], "console.log");
    typeInto(frontInputs[1], 'print("hi")');
    expect(window.data).toEqual({
      "console.log": "console.log",
      "print(“hi”)": 'print("hi")',
    });

    // Enter asks Anki to flip the card
    const pycmd = jest.fn();
    window.pycmd = pycmd;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(pycmd).toHaveBeenCalledWith("ans");

    // Flip exactly as Anki does: same window (window.data persists), fresh
    // DOM — the back re-renders {{Front}}, recreating the inputs empty
    loadCard(renderFields(builtBack, FIELDS));
    const backInputs = document.querySelectorAll("input");
    expect(backInputs).toHaveLength(2);

    // Both answers grade green, overwritten with the expected value in bold
    backInputs.forEach((input) => {
      expect(input.style.backgroundColor).toBe(GREEN);
      expect(input.style.fontWeight).toBe("bold");
    });
    expect(backInputs[0].value).toBe("console.log");
    expect(backInputs[1].value).toBe("print(“hi”)");

    // Shared chrome: prettified sorted tags, link text, hint auto-shown
    expect(document.getElementById("content_tag_left")?.textContent).toBe(
      "Computing - JavaScript, src - MDN",
    );
    expect(document.querySelector("a")?.textContent).toBe("Link");
    expect(document.getElementById("hint")?.className).toBe("shown");
    expect(document.getElementById("hint")?.textContent).toContain(FIELDS.Hint);
  });

  test("flipping without typing grades everything red and never throws", () => {
    loadCard(renderFields(builtFront, FIELDS));
    loadCard(renderFields(builtBack, FIELDS));

    const inputs = document.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input.style.backgroundColor).toBe(RED);
      expect(input.style.fontWeight).toBe("bold");
      expect(input.value).toBe(input.name);
    });
  });

  test("loading the back without visiting the front leaves inputs ungraded", () => {
    // window.data was never created, so initializeBackTemplate's guard skips
    // grading instead of throwing
    loadCard(renderFields(builtBack, FIELDS));

    const inputs = document.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input.style.backgroundColor).toBe("");
      expect(input.value).toBe("");
    });
    // The rest of the back still initializes
    expect(document.getElementById("content_tag_left")?.textContent).toBe(
      "Computing - JavaScript, src - MDN",
    );
  });

  test("a card without a Hint field renders no hint box on either side", () => {
    const fields = { ...FIELDS, Hint: "" };

    loadCard(renderFields(builtFront, fields));
    expect(document.getElementById("hint")).toBeNull();

    loadCard(renderFields(builtBack, fields));
    expect(document.getElementById("hint")).toBeNull();
  });
});
