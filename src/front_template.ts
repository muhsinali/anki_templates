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
  const handleEnterKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (typeof (window as any).pycmd !== "undefined") {
        (window as any).pycmd("ans");
      }
    }
  };
  
  document.addEventListener("keydown", handleEnterKey);
}

// attach touch and mouse event listeners to reveal the hint element when triggered
function setupHint(): void {
  const hint = document.getElementById("hint");
  if (hint) {
    hint.addEventListener("touchstart", () => (hint.className = "shown"));
    hint.addEventListener("mousedown", () => (hint.className = "shown"));
  }
}

// store all input values into an object
function storeInput(): Record<string, string> {
  const data: Record<string, string> = {};
  document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const inputName = input.name;
    // Skip empty inputs
    if (inputName) {
      data[inputName] = input.value;
      input.addEventListener("input", () => {
        data[inputName] = input.value;
      });
    }
  });
  return data;
}

// front template initialization
function initializeFrontTemplate(): void {
  (window as any).data = storeInput();
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
