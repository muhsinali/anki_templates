// Front template specific functions

// automatically place cursor onto first input field if it exists
function placeCursor(): void {
  const firstElement = document.getElementsByTagName("input")[0] as
    | HTMLInputElement
    | undefined;
  if (firstElement) firstElement.focus();
}

// ensures it is easier to type code on mobile devices
function setInputAttributes(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("input");
  inputs.forEach((input) => {
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
  });
}

// set up DOMContentLoaded event listener to execute initialization functions
function setupDOMContentLoaded(callback: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
  } else {
    callback();
  }
}

// handle Enter/Return key press to show answer (does not yet work on iPhone)
function setupEnterKeyEvent(): void {
  if (window.enterKeyHandlerBound) return;

  const handleEnterKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      if (typeof window.pycmd !== "undefined") {
        window.pycmd("ans");
      }
    }
  };

  document.addEventListener("keydown", handleEnterKey);
  window.enterKeyHandlerBound = true;
}

// attach touch and mouse event listeners to reveal the hint element when triggered
function setupHint(): void {
  const hint = document.getElementById("hint");
  if (hint) {
    hint.addEventListener("touchstart", () => (hint.className = "shown"));
    hint.addEventListener("mousedown", () => (hint.className = "shown"));
  }
}

// store all input values and their card signature into an object
function storeInput(): CardInputData {
  const data: CardInputData = { values: {}, inputNames: [] };
  document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const inputName = input.name;
    // Skip empty inputs
    if (inputName) {
      data.inputNames.push(inputName);
      data.values[inputName] = input.value;
      input.addEventListener("input", () => {
        data.values[inputName] = input.value;
      });
    }
  });
  return data;
}

// front template initialization
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

// Initialize when loaded
initializeFrontTemplate();
