function parseInput(str: string): string {
  return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, "");
}

function removeAnswerFeedback(input: HTMLInputElement): void {
  const nextElement = input.nextElementSibling;
  if (nextElement?.classList.contains("answer-feedback")) {
    nextElement.remove();
  }
}

function showAnswerFeedback(
  input: HTMLInputElement,
  isCorrect: boolean,
  rawAttempt: string,
): void {
  removeAnswerFeedback(input);

  const feedback = document.createElement("span");
  feedback.className = `answer-feedback ${isCorrect ? "answer-correct" : "answer-wrong"}`;
  feedback.textContent = answerFeedbackText(isCorrect, rawAttempt);
  input.insertAdjacentElement("afterend", feedback);
}

function answerFeedbackText(isCorrect: boolean, rawAttempt: string): string {
  if (isCorrect) return "Correct";
  return rawAttempt ? `Incorrect (you typed: ${rawAttempt})` : "Incorrect";
}

function revealAnswer(data: Record<string, string>): void {
  namedInputs().forEach((input) => revealInputAnswer(input, data));
}

function revealInputAnswer(
  input: HTMLInputElement,
  data: Record<string, string>,
): void {
  const expectedAnswer = input.name;
  // Missing and non-string entries both grade as an empty attempt — the
  // store crosses the webview as runtime state, so don't trust its entries
  const storedAttempt: unknown = data[expectedAnswer];
  const rawAttempt = typeof storedAttempt === "string" ? storedAttempt : "";
  const isCorrect = parseInput(rawAttempt) === parseInput(expectedAnswer);

  input.classList.remove("answer-correct", "answer-wrong");
  input.classList.add(isCorrect ? "answer-correct" : "answer-wrong");
  input.style.backgroundColor = "";
  input.style.fontWeight = "";
  input.value = expectedAnswer;
  input.readOnly = true;
  input.setAttribute("aria-label", isCorrect ? "Correct answer" : "Incorrect answer");
  showAnswerFeedback(input, isCorrect, rawAttempt);
}

function namedInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input")).filter(
    (input) => input.name !== "",
  );
}

// window.data lives in Anki's long-lived webview, so the back can see a value
// written by an older template version (or any other script); validate the
// shape at runtime before trusting the compile-time contract.
function isCardInputData(value: unknown): value is CardInputData {
  if (typeof value !== "object" || value === null) return false;
  return (
    "values" in value &&
    "inputNames" in value &&
    typeof value.values === "object" &&
    value.values !== null &&
    Array.isArray(value.inputNames)
  );
}

function inputSignatureMatches(data: CardInputData): boolean {
  const currentInputNames = namedInputs().map((input) => input.name);

  return (
    currentInputNames.length === data.inputNames.length &&
    currentInputNames.every((inputName, index) => inputName === data.inputNames[index])
  );
}

function initializeBackTemplate(): void {
  const data = window.data;
  if (isCardInputData(data) && inputSignatureMatches(data)) {
    revealAnswer(data.values);
  }
  displayTags("{{Tags}}");
  setLinkText();
}

initializeBackTemplate();
