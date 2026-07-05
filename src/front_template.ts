function placeCursor(): void {
  document.querySelector<HTMLInputElement>("input")?.focus();
}

function setInputAttributes(): void {
  getInputs().forEach(disableMobileTypingAssists);
}

function getInputs(): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll<HTMLInputElement>("input");
}

function disableMobileTypingAssists(input: HTMLInputElement): void {
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
}

function setupDOMContentLoaded(callback: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

function setupEnterKeyEvent(): void {
  if (window.enterKeyHandlerBound) return;

  const handleEnterKey = (event: KeyboardEvent): void => {
    if (!shouldFlipCard(event)) return;

    event.preventDefault();
    window.pycmd?.("ans");
  };

  document.addEventListener("keydown", handleEnterKey);
  window.enterKeyHandlerBound = true;
}

function shouldFlipCard(event: KeyboardEvent): boolean {
  return event.key === "Enter" && !event.isComposing;
}

function setupHint(): void {
  const hint = document.getElementById("hint");
  if (!hint) return;

  const revealHint = (): void => {
    hint.className = "shown";
  };

  hint.addEventListener("touchstart", revealHint);
  hint.addEventListener("mousedown", revealHint);
}

function storeInput(): CardInputData {
  const data: CardInputData = { values: [], inputNames: [] };
  getInputs().forEach((input) => rememberInput(data, input));
  return data;
}

function rememberInput(data: CardInputData, input: HTMLInputElement): void {
  const inputName = input.name;
  if (!inputName) return;

  // Positional storage: duplicate expected answers on one card each keep
  // their own typed value, and names like "__proto__" need no special case
  const index = data.inputNames.length;
  data.inputNames.push(inputName);
  data.values.push(input.value);
  input.addEventListener("input", () => {
    data.values[index] = input.value;
  });
}

function initializeFrontTemplate(): void {
  window.data = storeInput();
  setupDOMContentLoaded(function() {
    setInputAttributes();
    placeCursor();
  });
  setupHint();
  setupEnterKeyEvent();
  displayTags("{{Tags}}");
  setLinkText();
}

initializeFrontTemplate();
