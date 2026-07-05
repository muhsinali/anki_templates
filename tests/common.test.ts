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
    expect(elem?.textContent).toBe("a c, b a, Computing - AI");
  });

  test("sorts mixed-case tags alphabetically", () => {
    const tags = "zeta Alpha beta";
    displayTags(tags);
    const elem = document.getElementById("content_tag_left");
    expect(elem?.textContent).toBe("Alpha, beta, zeta");
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
  test("renames only the anchor inside the URL container", () => {
    setupDom(
      '<a href="https://example.com/prompt">Prompt link</a>' +
        '<div id="url_container"><a href="https://example.com/source">Source URL</a></div>',
    );

    setLinkText();

    const promptLink = document.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/prompt"]',
    );
    const sourceLink = document.querySelector<HTMLAnchorElement>("#url_container a");
    expect(promptLink?.textContent).toBe("Prompt link");
    expect(sourceLink?.textContent).toBe("Link");
    expect(sourceLink?.getAttribute("href")).toBe("https://example.com/source");
  });

  test("does not rename content anchors when the URL container has no link", () => {
    setupDom(
      '<a href="https://example.com/prompt">Prompt link</a><div id="url_container"></div>',
    );

    setLinkText();

    expect(document.querySelector("a")?.textContent).toBe("Prompt link");
    expect(document.querySelector("#url_container a")).toBeNull();
  });

  test("creates a link from a raw HTTPS URL", () => {
    setupDom('<div id="url_container"> https://example.com/source?q=1 </div>');

    setLinkText();

    const sourceLink = document.querySelector<HTMLAnchorElement>("#url_container a");
    expect(sourceLink?.textContent).toBe("Link");
    expect(sourceLink?.getAttribute("href")).toBe("https://example.com/source?q=1");
  });

  test("creates a link from a raw HTTP URL", () => {
    setupDom('<div id="url_container">http://example.com/source</div>');

    setLinkText();

    const sourceLink = document.querySelector<HTMLAnchorElement>("#url_container a");
    expect(sourceLink?.textContent).toBe("Link");
    expect(sourceLink?.getAttribute("href")).toBe("http://example.com/source");
  });

  test("leaves empty or invalid URL text untouched", () => {
    setupDom('<div id="url_container">not a url</div>');

    setLinkText();

    expect(document.querySelector("#url_container a")).toBeNull();
    expect(document.getElementById("url_container")?.textContent).toBe("not a url");
  });

  // Should not throw if the DOM has no URL container
  test("does nothing without a URL container", () => {
    setupDom();
    expect(() => setLinkText()).not.toThrow();
  });
});
