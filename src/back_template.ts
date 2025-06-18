// Back template specific functions

// normalizes smart quotes and strips all whitespace
function parseInput(str: string): string {
  return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, "");
}

// displays each input as correct (green) or wrong (red) based on whether the normalized answer matches expected
function revealAnswer(data: Record<string, string>): void {
  document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const inputName = input.name;
    // Skip empty inputs
    if (inputName) {
      const trueAnswer = inputName;
      const expected = trueAnswer.replace(/\s+/g, "");
      const actual = parseInput(data[inputName] ?? "");

      input.style.backgroundColor =
        actual === expected ? "rgb(124,232,0)" : "rgb(240,128,128)";
      input.value = trueAnswer;
      input.style.fontWeight = "bold";
    }
  });
}

// back template initialization
function initializeBackTemplate(): void {
  if ((window as any).data) {
    revealAnswer((window as any).data);
  }
  displayTags("{{Tags}}");
  setLinkText();
}

// Initialize when loaded
initializeBackTemplate();
