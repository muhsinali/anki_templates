import { loadTemplateDom, requiredElement } from "./helpers";

function setupDom(html: string = "") {
  loadTemplateDom(html, "back_template.ts");
}

function firstInput(): HTMLInputElement {
  return requiredElement<HTMLInputElement>("input");
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
      revealAnswer([" A B ", "c"]);

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
      revealAnswer(['print("hi")']);

      const input = firstInput();
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("print(“hi”)");
    });

    test("grades curly quotes as correct when the expected answer has straight quotes", () => {
      const html = `<input name="print('hi')">`;
      setupDom(html);
      revealAnswer(["print(‘hi’)"]);

      const input = firstInput();
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("print('hi')");
    });

    test("skips inputs without names", () => {
      const html = `<input name="A"><input>`;
      setupDom(html);
      revealAnswer(["A"]);

      const inputs = document.querySelectorAll("input");
      // first input with name should be processed
      expect(inputs[0].classList.contains("answer-correct")).toBe(true);
      // second input without name should be skipped
      expect(inputs[1].className).toBe("");
      expect(inputs[0].readOnly).toBe(true);
      expect(inputs[1].readOnly).toBe(false);
      expect(document.querySelectorAll(".answer-feedback")).toHaveLength(1);
    });

    test("grades prototype-clashing names positionally without crashing", () => {
      setupDom('<input name="__proto__">');

      revealAnswer(["__proto__"]);

      const input = firstInput();
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("__proto__");
    });

    test("grades duplicate expected answers per input, not per name", () => {
      setupDom('<input name="x"><input name="x">');

      revealAnswer(["x", ""]);

      const inputs = document.querySelectorAll("input");
      expect(inputs[0].classList.contains("answer-correct")).toBe(true);
      expect(inputs[1].classList.contains("answer-wrong")).toBe(true);
    });

    test("preserves wrong attempts as text and does not duplicate feedback", () => {
      const html = `<input name="A">`;
      setupDom(html);

      revealAnswer(["<img src=x>"]);
      revealAnswer(["<img src=x>"]);

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
      window.data = { values: ["A"], inputNames: ["A"] };
      initializeBackTemplate();

      const input = firstInput();
      expect(input.classList.contains("answer-correct")).toBe(true);
      expect(input.value).toBe("A");
      expect(document.querySelector("#url_container a")?.textContent).toBe("Link");
    });

    test("skips grading when stored input names do not match the back inputs", () => {
      setupDom('<input name="A"><div id="content_tag_left"></div>');
      window.data = { values: ["B"], inputNames: ["B"] };

      initializeBackTemplate();

      const input = firstInput();
      expect(input.className).toBe("");
      expect(input.value).toBe("");
    });

    test("skips grading when window.data has a stale pre-upgrade shape", () => {
      setupDom('<input name="A"><div id="content_tag_left"></div>');
      // What an older front template (or any other webview script) may have
      // left behind — assigned via eval so no type cast is needed
      window.eval('window.data = { A: "A" };');

      expect(() => initializeBackTemplate()).not.toThrow();
      expect(firstInput().className).toBe("");
      // The rest of the back still initializes
      expect(document.getElementById("content_tag_left")?.textContent).toBe(
        "{{Tags}}",
      );
    });

    test("skips grading when window.data is missing its values array", () => {
      setupDom('<input name="A">');
      window.eval('window.data = { inputNames: ["A"] };');

      expect(() => initializeBackTemplate()).not.toThrow();
      expect(firstInput().className).toBe("");
    });

    test("skips grading when values has the record shape of the previous contract", () => {
      setupDom('<input name="A">');
      // The contract one template version ago stored values keyed by name
      window.eval('window.data = { values: { A: "A" }, inputNames: ["A"] };');

      expect(() => initializeBackTemplate()).not.toThrow();
      const input = firstInput();
      expect(input.className).toBe("");
      expect(input.value).toBe("");
    });

    test("grades non-string stored values as empty attempts instead of crashing", () => {
      setupDom('<input name="A">');
      window.eval('window.data = { values: [42], inputNames: ["A"] };');

      expect(() => initializeBackTemplate()).not.toThrow();
      const input = firstInput();
      expect(input.classList.contains("answer-wrong")).toBe(true);
      expect(input.value).toBe("A");
    });

    test("skips grading when window.data is missing, without throwing", () => {
      setupDom('<input name="A">');
      delete window.data;

      expect(() => initializeBackTemplate()).not.toThrow();
      const input = firstInput();
      expect(input.className).toBe("");
      expect(input.value).toBe("");
    });
  });
});
