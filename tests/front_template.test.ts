import { loadTemplateDom, requiredElement } from "./helpers";

function setupDom(html: string = "") {
  loadTemplateDom(html, "front_template.ts");
}

function firstInput(): HTMLInputElement {
  return requiredElement<HTMLInputElement>("input");
}

function hintElement(): HTMLElement {
  return requiredElement<HTMLElement>("#hint");
}

describe("Front Template Functions", () => {
  describe("placeCursor", () => {
    test("focuses first input if exists", () => {
      setupDom('<input id="a"><input id="b">');
      placeCursor();
      expect(document.activeElement?.id).toBe("a");
    });

    test("does nothing when no inputs exist", () => {
      setupDom();
      expect(() => placeCursor()).not.toThrow();
    });
  });

  describe("setInputAttributes", () => {
    test("sets attributes on inputs", () => {
      setupDom("<input><input>");
      setInputAttributes();
      const input = firstInput();
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
      setupDOMContentLoaded(callback);
      expect(callback).toHaveBeenCalled();
    });

    test("attaches event listener when DOM is loading", () => {
      setupDom();
      const callback = jest.fn();
      // Shadow document.readyState to simulate loading state (configurable
      // so it can be removed afterwards — previously this override leaked
      // into every later test in the file)
      Object.defineProperty(document, "readyState", {
        value: "loading",
        configurable: true,
      });
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      setupDOMContentLoaded(callback);
      expect(addEventListenerSpy).toHaveBeenCalledWith("DOMContentLoaded", callback);
      addEventListenerSpy.mockRestore();
      // Drop the own-property shadow so the prototype getter ("complete")
      // shows through again for subsequent tests
      delete (document as any).readyState;
    });
  });

  describe("setupEnterKeyEvent", () => {
    let mockPycmd: jest.Mock;
    let addEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
      setupDom();
      mockPycmd = jest.fn();
      window.pycmd = mockPycmd;
      addEventListenerSpy = jest.spyOn(document, "addEventListener");
    });

    afterEach(() => {
      delete window.pycmd;
      addEventListenerSpy.mockRestore();
    });

    test("attaches the keydown event listener only once", () => {
      delete window.enterKeyHandlerBound;
      addEventListenerSpy.mockImplementation(() => undefined as any);

      setupEnterKeyEvent();
      setupEnterKeyEvent();

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    });

    test("calls pycmd('ans') once when one Enter key is dispatched", () => {
      setupEnterKeyEvent();
      setupEnterKeyEvent();

      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      const preventDefaultSpy = jest.spyOn(enterEvent, "preventDefault");

      document.dispatchEvent(enterEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockPycmd).toHaveBeenCalledTimes(1);
      expect(mockPycmd).toHaveBeenCalledWith("ans");
    });

    test("ignores composing Enter key events", () => {
      delete window.enterKeyHandlerBound;
      addEventListenerSpy.mockImplementation(() => undefined as any);

      setupEnterKeyEvent();

      const keydownHandler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === "keydown",
      )?.[1];

      const enterEvent = new KeyboardEvent("keydown", { key: "Enter", isComposing: true });
      const preventDefaultSpy = jest.spyOn(enterEvent, "preventDefault");

      keydownHandler(enterEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockPycmd).not.toHaveBeenCalled();
    });
  });

  describe("setupHint", () => {
    test("a mousedown event should reveal the hint", () => {
      setupDom('<div id="hint"></div>');
      setupHint();
      const hint = hintElement();
      hint.dispatchEvent(new window.Event("mousedown"));
      expect(hint.className).toBe("shown");
    });

    test("a touchstart event should reveal the hint", () => {
      setupDom('<div id="hint"></div>');
      setupHint();
      const hint = hintElement();
      hint.dispatchEvent(new window.Event("touchstart"));
      expect(hint.className).toBe("shown");
    });
  });

  describe("initializeFrontTemplate", () => {
    test("wires up the whole front card in one call", () => {
      setupDom(
        '<input name="x"><div id="hint" class="hidden"></div>' +
          '<div id="content_tag_left"></div>' +
          '<div id="url_container"><a href="https://example.com">Source</a></div>',
      );
      delete window.data;
      initializeFrontTemplate();

      // window.data created and kept in sync with typing
      expect(window.data).toEqual({ values: [""], inputNames: ["x"] });
      const input = firstInput();
      input.value = "abc";
      input.dispatchEvent(new window.Event("input"));
      expect(window.data).toEqual({ values: ["abc"], inputNames: ["x"] });

      // cursor placed and mobile typing attributes set (readyState is
      // "complete" in jsdom, so the deferred work runs synchronously)
      expect(document.activeElement).toBe(input);
      expect(input.getAttribute("spellcheck")).toBe("false");

      // hint reveal wired
      const hint = hintElement();
      hint.dispatchEvent(new window.Event("mousedown"));
      expect(hint.className).toBe("shown");

      // tags rendered (the raw {{Tags}} placeholder passes through
      // untouched outside Anki) and link text set
      expect(document.getElementById("content_tag_left")?.textContent).toBe(
        "{{Tags}}",
      );
      expect(document.querySelector("#url_container a")?.textContent).toBe("Link");
    });
  });

  describe("storeInput", () => {
    test("stores values on input events", () => {
      setupDom('<input name="x"><input name="y">');
      const store = storeInput();
      const inputs = document.querySelectorAll("input");
      inputs[0].value = "a";
      inputs[0].dispatchEvent(new window.Event("input"));
      inputs[1].value = "b";
      inputs[1].dispatchEvent(new window.Event("input"));
      expect(store).toEqual({ values: ["a", "b"], inputNames: ["x", "y"] });
    });

    test("tracks duplicate input names separately by position", () => {
      setupDom('<input name="x"><input name="x">');
      const store = storeInput();
      const inputs = document.querySelectorAll("input");
      inputs[0].value = "first";
      inputs[0].dispatchEvent(new window.Event("input"));
      inputs[1].value = "second";
      inputs[1].dispatchEvent(new window.Event("input"));
      expect(store).toEqual({ values: ["first", "second"], inputNames: ["x", "x"] });
    });

    test("stores prototype-clashing input names as plain values", () => {
      setupDom('<input name="__proto__"><input name="constructor">');
      const store = storeInput();
      expect(store.inputNames).toEqual(["__proto__", "constructor"]);
      expect(store.values).toEqual(["", ""]);

      const inputs = document.querySelectorAll("input");
      inputs[0].value = "typed";
      inputs[0].dispatchEvent(new window.Event("input"));
      expect(store.values).toEqual(["typed", ""]);
    });

    test("stores initial values and skips inputs without names", () => {
      setupDom('<input name="x" value="initial"><input>');
      const inputs = document.querySelectorAll("input");
      expect(inputs[0].value).toBe("initial");
      expect(inputs[1].value).toBe("");

      const store = storeInput();
      expect(store.values).toEqual(["initial"]);
      expect(store.inputNames).toEqual(["x"]);
    });
  });
});
