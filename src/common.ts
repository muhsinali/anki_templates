function displayTags(tagsString: string): void {
  const tagContainer = document.getElementById("content_tag_left");
  if (!tagContainer) return;

  tagContainer.textContent = formatTags(tagsString);
}

function formatTags(tagsString: string): string {
  const tags = tagsString.split(" ").filter((tag) => tag.trim() !== "");
  return tags
    .map(prettifyTag)
    .sort(compareTags)
    .join(", ");
}

function compareTags(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function prettifyTag(tag: string): string {
  return tag.split("::").join(" - ").replace(/_/g, " ");
}

function setLinkText(): void {
  const container = document.getElementById("url_container");
  if (!container) return;

  const existingLink = container.querySelector<HTMLAnchorElement>("a");
  if (existingLink) {
    existingLink.textContent = "Link";
    return;
  }

  const rawUrl = container.textContent?.trim() ?? "";
  if (!isHttpUrl(rawUrl)) return;

  replaceTextWithSourceLink(container, rawUrl);
}

function isHttpUrl(rawUrl: string): boolean {
  if (!/^https?:\/\//i.test(rawUrl)) return false;

  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function replaceTextWithSourceLink(container: HTMLElement, rawUrl: string): void {
  const link = document.createElement("a");
  link.href = rawUrl;
  link.textContent = "Link";
  container.textContent = "";
  container.append(link);
}
