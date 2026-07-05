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

    test("marks inputs and sets values correctly", () => {
      const data = { "A B": " A B ", C: "c" };
      revealAnswer(data);

      const inputs = document.querySelectorAll("input");
      const feedback = document.querySelectorAll(".answer-feedback");
      // first input should be marked correct
      expect(inputs[0].classList.contains("answer-correct")).toBe(true);
      expect(inputs[0].getAttribute("aria-label")).toBe("Correct answer");
      expect(inputs[0].value).toBe("A B");
      expect(inputs[0].readOnly).toBe(true);
      expect(feedback[0].textContent).toBe("Correct");

      // second input should be marked wrong
      expect(inputs[1].classList.contains("answer-wrong")).toBe(true);
      expect(inputs[1].getAttribute("aria-label")).toBe("Incorrect answer");
      expect(inputs[1].value).toBe("C");
      expect(inputs[1].readOnly).toBe(true);
      expect(feedback[1].textContent).toBe("Incorrect (you typed: c)");
    });

    test("grades straight quotes as correct when the expected answer has curly quotes", () => {
      const html = `<input name="print(“hi”)">`;
      setupDom(html);
      const data = { "print(“hi”)": 'print("hi")' };
      revealAnswer(data);

      const input = document.querySelector("input")!;
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("print(“hi”)");
    });

    test("grades curly quotes as correct when the expected answer has straight quotes", () => {
      const html = `<input name="print('hi')">`;
      setupDom(html);
      const data = { "print('hi')": "print(‘hi’)" };
      revealAnswer(data);

      const input = document.querySelector("input")!;
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("print('hi')");
    });

    test("skips inputs without names", () => {
      const html = `<input name="A"><input>`;
      setupDom(html);
      const data = { A: "A" };
      revealAnswer(data);

      const inputs = document.querySelectorAll("input");
      // first input with name should be processed
      expect(inputs[0].classList.contains("answer-correct")).toBe(true);
      // second input without name should be skipped
      expect(inputs[1].className).toBe("");
      expect(inputs[0].readOnly).toBe(true);
      expect(inputs[1].readOnly).toBe(false);
      expect(document.querySelectorAll(".answer-feedback")).toHaveLength(1);
    });

    test("preserves wrong attempts as text and does not duplicate feedback", () => {
      const html = `<input name="A">`;
      setupDom(html);
      const data = { A: "<img src=x>" };

      revealAnswer(data);
      revealAnswer(data);

      expect(document.querySelector("img")).toBeNull();
      const feedback = document.querySelectorAll(".answer-feedback");
      expect(feedback).toHaveLength(1);
      expect(feedback[0].textContent).toBe("Incorrect (you typed: <img src=x>)");
    });
  });

  describe("initializeBackTemplate", () => {
    afterEach(() => {
      delete window.data;
    });

    test("grades the inputs from window.data when the front stored it", () => {
      setupDom(
        '<input name="A"><div id="content_tag_left"></div>' +
          '<div id="url_container"><a href="https://example.com">Source</a></div>',
      );
      window.data = { values: { A: "A" }, inputNames: ["A"] };
      initializeBackTemplate();

      const input = document.querySelector("input")!;
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("A");
      expect(document.querySelector("#url_container a")?.textContent).toBe("Link");
    });

    test("skips grading when stored input names do not match the back inputs", () => {
      setupDom('<input name="A"><div id="content_tag_left"></div>');
      window.data = { values: { B: "B" }, inputNames: ["B"] };

      initializeBackTemplate();

      const input = document.querySelector("input")!;
      expect(input.className).toBe("");
      expect(input.value).toBe("");
    });

    test("skips grading when window.data is missing, without throwing", () => {
      setupDom('<input name="A">');
      delete window.data;

      expect(() => initializeBackTemplate()).not.toThrow();
      const input = document.querySelector("input")!;
      expect(input.className).toBe("");
      expect(input.value).toBe("");
    });
  });
});
