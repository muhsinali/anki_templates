import { loadTemplateDom, requiredElement } from "./helpers";

function setupDom(html: string = "") {
  loadTemplateDom(html);
}

function renderedTags(): string | null {
  return document.getElementById("content_tag_left")?.textContent ?? null;
}

function sourceLink(): HTMLAnchorElement {
  return requiredElement<HTMLAnchorElement>("#url_container a");
}

describe("displayTags", () => {
  beforeEach(() => setupDom('<div id="content_tag_left"></div>'));

  test("formats and sorts tags", () => {
    displayTags("b_a Computing::AI a_c");

    expect(renderedTags()).toBe("a c, b a, Computing - AI");
  });

  test("sorts mixed-case tags alphabetically", () => {
    displayTags("zeta Alpha beta");

    expect(renderedTags()).toBe("Alpha, beta, zeta");
  });

  test("handles empty string", () => {
    displayTags("");

    expect(renderedTags()).toBe("");
  });

  test("filters out empty tags from spaces", () => {
    displayTags("a  b   c");

    expect(renderedTags()).toBe("a, b, c");
  });
});

describe("prettifyTag", () => {
  test("replaces :: and underscores", () => {
    setupDom();

    expect(prettifyTag("Code::Hello_World")).toBe("Code - Hello World");
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
    const link = sourceLink();
    expect(promptLink?.textContent).toBe("Prompt link");
    expect(link.textContent).toBe("Link");
    expect(link.getAttribute("href")).toBe("https://example.com/source");
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

    const link = sourceLink();
    expect(link.textContent).toBe("Link");
    expect(link.getAttribute("href")).toBe("https://example.com/source?q=1");
  });

  test("creates a link from a raw HTTP URL", () => {
    setupDom('<div id="url_container">http://example.com/source</div>');

    setLinkText();

    const link = sourceLink();
    expect(link.textContent).toBe("Link");
    expect(link.getAttribute("href")).toBe("http://example.com/source");
  });

  test("leaves empty or invalid URL text untouched", () => {
    setupDom('<div id="url_container">not a url</div>');

    setLinkText();

    expect(document.querySelector("#url_container a")).toBeNull();
    expect(document.getElementById("url_container")?.textContent).toBe("not a url");
  });

  test("does nothing without a URL container", () => {
    setupDom();

    expect(() => setLinkText()).not.toThrow();
  });
});
