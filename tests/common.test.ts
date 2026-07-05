// Unit tests for common.ts functions
import { loadScripts } from "./helpers";

// Set up DOM and load common.ts into the existing jsdom window
function setupDom(html: string = "") {
  document.body.innerHTML = html;
  loadScripts("common.ts");
}

describe("displayTags", () => {
  // Provide a container element where the formatted tag string will be rendered
  beforeEach(() => setupDom('<div id="content_tag_left"></div>'));

  // Tags should be prettified and sorted alphabetically
  test("formats and sorts tags", () => {
    const tags = "b_a Computing::AI a_c";
    displayTags(tags);
    const elem = document.getElementById("content_tag_left");
    expect(elem?.textContent).toBe("Computing - AI, a c, b a");
  });

  // Edge case: no tags should result in an empty string
  test("handles empty string", () => {
    displayTags("");
    expect(document.getElementById("content_tag_left")?.textContent).toBe("");
  });

  // Edge case: filters out empty tags from spaces
  test("filters out empty tags from spaces", () => {
    const tags = "a  b   c";
    displayTags(tags);
    const elem = document.getElementById("content_tag_left");
    expect(elem?.textContent).toBe("a, b, c");
  });
});

describe("prettifyTag", () => {
  // Basic transformation of "::" and "_" characters
  test("replaces :: and underscores", () => {
    setupDom();
    expect(prettifyTag("Code::Hello_World")).toBe(
      "Code - Hello World",
    );
  });
});

describe("setLinkText", () => {
  // When an anchor element is present its text should change to "Link"
  test("sets text when anchor exists", () => {
    setupDom("<a></a>");
    setLinkText();
    expect(document.querySelector("a")?.textContent).toBe("Link");
  });

  // Should not throw if the DOM has no anchor element
  test("does nothing without anchor", () => {
    setupDom();
    expect(() => setLinkText()).not.toThrow();
  });
});
