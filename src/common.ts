// COMMON FUNCTIONS
// parse a space delimited tag string, and displays tags in sorted order in #content_tag_left
function displayTags(tagsString: string): void {
  const tags = tagsString.split(" ");
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




// BACK TEMPLATE SPECIFIC FUNCTIONS
// normalizes smart quotes and strips all whitespace
function parseInput(str: string): string {
  return str
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, "");
}

// displays each input as correct (green) or wrong (red) based on whether the normalized answer matches expected
function revealAnswer(data: Record<string, string>): void {
  document.querySelectorAll<HTMLInputElement>("input").forEach(input => {
    const trueAnswer = input.name ?? "";
    const expected = trueAnswer.replace(/\s+/g, "");
    const actual = parseInput(data[input.name] ?? "");

    input.style.backgroundColor = actual === expected ? "rgb(124,232,0)" : "rgb(240,128,128)";
    input.value = trueAnswer;
    input.style.fontWeight = "bold";
  });
}




// FRONT TEMPLATE SPECIFIC FUNCTIONS
// automatically place cursor onto first input field if it exists
function placeCursor(): void {
  const firstElement = document.getElementsByTagName("input")[0] as HTMLInputElement | undefined;
  if (firstElement) firstElement.focus();
}

// attach touch and mouse event listeners to reveal the hint element when triggered
function setupHint(): void {
  const hint = document.getElementById("hint");
  if (hint) {
    hint.addEventListener("touchstart", () => (hint.className = "shown"));
    hint.addEventListener("mousedown", () => (hint.className = "shown"));
  }
}

// ensures it is easier to type code on mobile devices
function setInputAttributes(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("input");
  inputs.forEach(input => {
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
  });
}

// store all input values into an object
function storeInput(): Record<string, string> {
  const data: Record<string, string> = {};
  document.querySelectorAll<HTMLInputElement>("input").forEach(elem => {
    elem.addEventListener("input", () => {
      data[elem.name] = elem.value;
    });
  });
  return data;
}
