// Unit tests for front_template.ts functions
import { TextEncoder, TextDecoder } from "util";
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

// Helper to set up DOM and load front_template.ts into the existing jsdom window
function setupDom(html: string = "") {
  document.body.innerHTML = html;
  
  // Load common.ts functions first
  const commonSource = readFileSync(join(process.cwd(), "src", "common.ts"), "utf8");
  const commonTranspiled = ts.transpile(commonSource, {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2022,
  });
  (window as any).eval(commonTranspiled);
  
  // Then load front_template.ts functions
  const frontSource = readFileSync(join(process.cwd(), "src", "front_template.ts"), "utf8");
  const frontTranspiled = ts.transpile(frontSource, {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2022,
  });
  (window as any).eval(frontTranspiled);
}

describe("Front Template Functions", () => {
  describe("placeCursor", () => {
    test("focuses first input if exists", () => {
      setupDom('<input id="a"><input id="b">');
      (window as any).placeCursor();
      expect(document.activeElement?.id).toBe("a");
    });

    test("does nothing when no inputs exist", () => {
      setupDom();
      expect(() => (window as any).placeCursor()).not.toThrow();
    });
  });

  describe("setInputAttributes", () => {
    test("sets attributes on inputs", () => {
      setupDom("<input><input>");
      (window as any).setInputAttributes();
      const input = document.querySelector("input")!;
      expect(input.getAttribute("autocapitalize")).toBe("off");
      expect(input.getAttribute("autocomplete")).toBe("off");
      expect(input.getAttribute("autocorrect")).toBe("off");
      expect(input.getAttribute("spellcheck")).toBe("false");
    });
  });

  describe("setupDOMContentLoaded", () => {
    test("calls callback immediately when DOM is already loaded", () => {
      setupDom();
      const callback = jest.fn();
      (window as any).setupDOMContentLoaded(callback);
      expect(callback).toHaveBeenCalled();
    });

    test("attaches event listener when DOM is loading", () => {
      setupDom();
      const callback = jest.fn();
      // Mock document.readyState to simulate loading state
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      (window as any).setupDOMContentLoaded(callback);
      expect(addEventListenerSpy).toHaveBeenCalledWith("DOMContentLoaded", callback);
      addEventListenerSpy.mockRestore();
    });
  });

  describe("setupEnterKeyEvent", () => {
    let mockPycmd: jest.Mock;
    let addEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
      setupDom();
      mockPycmd = jest.fn();
      (window as any).pycmd = mockPycmd;
      addEventListenerSpy = jest.spyOn(document, "addEventListener");
    });

    afterEach(() => {
      delete (window as any).pycmd;
      addEventListenerSpy.mockRestore();
    });

    test("attaches keydown event listener", () => {
      (window as any).setupEnterKeyEvent();
      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("calls pycmd('ans') when Enter key is pressed", () => {
      (window as any).setupEnterKeyEvent();
      
      const keydownHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === "keydown"
      )?.[1];
      
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      const preventDefaultSpy = jest.spyOn(enterEvent, "preventDefault");
      
      keydownHandler(enterEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockPycmd).toHaveBeenCalledWith("ans");
    });
  });

  describe("setupHint", () => {
    test("a mousedown event should reveal the hint", () => {
      setupDom('<div id="hint"></div>');
      (window as any).setupHint();
      const hint = document.getElementById("hint") as HTMLElement;
      hint.dispatchEvent(new window.Event("mousedown"));
      expect(hint.className).toBe("shown");
    });

    test("a touchstart event should reveal the hint", () => {
      setupDom('<div id="hint"></div>');
      (window as any).setupHint();
      const hint = document.getElementById("hint") as HTMLElement;
      hint.dispatchEvent(new window.Event("touchstart"));
      expect(hint.className).toBe("shown");
    });
  });

  describe("storeInput", () => {
    test("stores values on input events", () => {
      setupDom('<input name="x"><input name="y">');
      const store = (window as any).storeInput();
      const inputs = document.querySelectorAll("input");
      inputs[0].value = "a";
      inputs[0].dispatchEvent(new window.Event("input"));
      inputs[1].value = "b";
      inputs[1].dispatchEvent(new window.Event("input"));
      expect(store).toEqual({ x: "a", y: "b" });
    });

    test("stores initial values and skips inputs without names", () => {
      setupDom('<input name="x" value="initial"><input>');
      const inputs = document.querySelectorAll("input");
      expect(inputs[0].value).toBe("initial");
      expect(inputs[1].value).toBe("");

      const store = (window as any).storeInput();
      expect(store.x).toBe("initial");
      expect(Object.keys(store)).toEqual(["x"]);
    });
  });
});