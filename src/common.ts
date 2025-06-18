// Common functions

// parse a space delimited tag string, and displays tags in sorted order in #content_tag_left
function displayTags(tagsString: string): void {
  const tags = tagsString.split(" ").filter((tag) => tag.trim() !== "");
  const prettifiedTags = tags.map(prettifyTag).sort().join(", ");
  const content_tag = document.getElementById("content_tag_left");
  if (content_tag) content_tag.textContent = prettifiedTags;
}

// converts "Computing::Machine_Learning" to "Computing - Machine Learning"
function prettifyTag(tag: string): string {
  return tag.split("::").join(" - ").replace(/_/g, " ");
}

// set link text
function setLinkText(): void {
  const anchor = document.querySelector<HTMLAnchorElement>("a");
  if (anchor) anchor.textContent = "Link";
}
