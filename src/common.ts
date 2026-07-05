// Common functions

// parse a space delimited tag string, and displays tags in sorted order in #content_tag_left
function displayTags(tagsString: string): void {
  const tags = tagsString.split(" ").filter((tag) => tag.trim() !== "");
  const prettifiedTags = tags
    .map(prettifyTag)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .join(", ");
  const content_tag = document.getElementById("content_tag_left");
  if (content_tag) content_tag.textContent = prettifiedTags;
}

// converts "Computing::Machine_Learning" to "Computing - Machine Learning"
function prettifyTag(tag: string): string {
  return tag.split("::").join(" - ").replace(/_/g, " ");
}

// render the optional URL field as a compact source link
function setLinkText(): void {
  const container = document.getElementById("url_container");
  if (!container) return;

  const anchor = container.querySelector<HTMLAnchorElement>("a");
  if (anchor) {
    anchor.textContent = "Link";
    return;
  }

  const rawUrl = container.textContent?.trim() ?? "";
  if (!/^https?:\/\//i.test(rawUrl)) return;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return;

  const link = document.createElement("a");
  link.href = rawUrl;
  link.textContent = "Link";
  container.textContent = "";
  container.append(link);
}
