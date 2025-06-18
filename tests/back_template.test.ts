// Unit tests for back_template.ts functions
import { TextEncoder, TextDecoder } from "util";
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

// Helper to set up DOM and load back_template.ts into the existing jsdom window
function setupDom(html: string = "") {
  document.body.innerHTML = html;
  
  // Load common.ts functions first
  const commonSource = readFileSync(join(process.cwd(), "src", "common.ts"), "utf8");
  const commonTranspiled = ts.transpile(commonSource, {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2022,
  });
  (window as any).eval(commonTranspiled);
  
  // Then load back_template.ts functions
  const backSource = readFileSync(join(process.cwd(), "src", "back_template.ts"), "utf8");
  const backTranspiled = ts.transpile(backSource, {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2022,
  });
  (window as any).eval(backTranspiled);
}

describe("Back Template Functions", () => {
  describe("parseInput", () => {
    test("normalizes quotes and removes whitespace", () => {
      setupDom();
      const input = " “hello” \n  ‘world’ ";
      expect((window as any).parseInput(input)).toBe('"hello"\'world\'');
    });
  });

  describe("revealAnswer", () => {
    beforeEach(() => {
      const html = `<input name="A B"><input name="C">`;
      setupDom(html);
    });

    test("colors inputs and sets values correctly", () => {
      const data = { "A B": " A B ", C: "c" };
      (window as any).revealAnswer(data);

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

    test("skips inputs without names", () => {
      const html = `<input name="A"><input>`;
      setupDom(html);
      const data = { A: "A" };
      (window as any).revealAnswer(data);

      const inputs = document.querySelectorAll("input");
      // first input with name should be processed
      expect(inputs[0].style.backgroundColor).toBe("rgb(124, 232, 0)");
      // second input without name should be skipped (no background color set)
      expect(inputs[1].style.backgroundColor).toBe("");
    });
  });
});
