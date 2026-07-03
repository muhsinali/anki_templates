// Unit tests for back_template.ts functions
import { loadScripts } from "./helpers";

// Set up DOM and load back_template.ts (common.ts first, mirroring the
// %COMMON_JS% → %TEMPLATE_JS% order in the built HTML)
function setupDom(html: string = "") {
  document.body.innerHTML = html;
  loadScripts("common.ts", "back_template.ts");
}

describe("Back Template Functions", () => {
  describe("parseInput", () => {
    test("normalizes quotes and removes whitespace", () => {
      setupDom();
      const input = " “hello” \n  ‘world’ ";
      expect(parseInput(input)).toBe('"hello"\'world\'');
    });

    test("leaves backticks untouched", () => {
      setupDom();
      expect(parseInput("`template ${x}`")).toBe("`template${x}`");
    });

    test("strips non-breaking spaces", () => {
      setupDom();
      expect(parseInput("git\u00A0reset\u00A0--hard")).toBe("gitreset--hard");
    });
  });

  describe("revealAnswer", () => {
    beforeEach(() => {
      const html = `<input name="A B"><input name="C">`;
      setupDom(html);
    });

    test("colors inputs and sets values correctly", () => {
      const data = { "A B": " A B ", C: "c" };
      revealAnswer(data);

      const inputs = document.querySelectorAll("input");
      // first input should be marked correct
      expect(inputs[0].style.backgroundColor).toBe("rgb(124, 232, 0)");
      expect(inputs[0].value).toBe("A B");
      expect(inputs[0].style.fontWeight).toBe("bold");

      // second input should be marked wrong
      expect(inputs[1].style.backgroundColor).toBe("rgb(240, 128, 128)");
      expect(inputs[1].value).toBe("C");
      expect(inputs[1].style.fontWeight).toBe("bold");
    });

    test("grades straight quotes as correct when the expected answer has curly quotes", () => {
      const html = `<input name="print(“hi”)">`;
      setupDom(html);
      const data = { "print(“hi”)": 'print("hi")' };
      revealAnswer(data);

      const input = document.querySelector("input")!;
      expect(input.style.backgroundColor).toBe("rgb(124, 232, 0)");
      expect(input.value).toBe("print(“hi”)");
    });

    test("grades curly quotes as correct when the expected answer has straight quotes", () => {
      const html = `<input name="print('hi')">`;
      setupDom(html);
      const data = { "print('hi')": "print(‘hi’)" };
      revealAnswer(data);

      const input = document.querySelector("input")!;
      expect(input.style.backgroundColor).toBe("rgb(124, 232, 0)");
      expect(input.value).toBe("print('hi')");
    });

    test("skips inputs without names", () => {
      const html = `<input name="A"><input>`;
      setupDom(html);
      const data = { A: "A" };
      revealAnswer(data);

      const inputs = document.querySelectorAll("input");
      // first input with name should be processed
      expect(inputs[0].style.backgroundColor).toBe("rgb(124, 232, 0)");
      // second input without name should be skipped (no background color set)
      expect(inputs[1].style.backgroundColor).toBe("");
    });
  });

  describe("initializeBackTemplate", () => {
    afterEach(() => {
      delete window.data;
    });

    test("grades the inputs from window.data when the front stored it", () => {
      setupDom('<input name="A"><div id="content_tag_left"></div><a></a>');
      window.data = { A: "A" };
      initializeBackTemplate();

      const input = document.querySelector("input")!;
      expect(input.style.backgroundColor).toBe("rgb(124, 232, 0)");
      expect(input.value).toBe("A");
      expect(document.querySelector("a")?.textContent).toBe("Link");
    });

    test("skips grading when window.data is missing, without throwing", () => {
      setupDom('<input name="A">');
      delete window.data;

      expect(() => initializeBackTemplate()).not.toThrow();
      const input = document.querySelector("input")!;
      expect(input.style.backgroundColor).toBe("");
      expect(input.value).toBe("");
    });
  });
});
