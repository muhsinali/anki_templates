// Back template specific functions

// normalizes smart quotes and strips all whitespace
function parseInput(str: string): string {
  return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, "");
}

// removes the feedback inserted by a previous grading pass
function removeAnswerFeedback(input: HTMLInputElement): void {
  const nextElement = input.nextElementSibling;
  if (nextElement?.classList.contains("answer-feedback")) {
    nextElement.remove();
  }
}

// shows a non-color grading marker and, for wrong answers, the learner's attempt
function showAnswerFeedback(
  input: HTMLInputElement,
  isCorrect: boolean,
  rawAttempt: string,
): void {
  removeAnswerFeedback(input);

  const feedback = document.createElement("span");
  feedback.className = `answer-feedback ${isCorrect ? "answer-correct" : "answer-wrong"}`;
  feedback.textContent = isCorrect
    ? "Correct"
    : rawAttempt
      ? `Incorrect (you typed: ${rawAttempt})`
      : "Incorrect";
  input.insertAdjacentElement("afterend", feedback);
}

// displays each input as correct or wrong based on whether the normalized answer matches expected
function revealAnswer(data: Record<string, string>): void {
  document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const inputName = input.name;
    // Skip empty inputs
    if (inputName) {
      const trueAnswer = inputName;
      const rawAttempt = data[inputName] ?? "";
      const expected = parseInput(trueAnswer);
      const actual = parseInput(rawAttempt);
      const isCorrect = actual === expected;

      input.classList.remove("answer-correct", "answer-wrong");
      input.classList.add(isCorrect ? "answer-correct" : "answer-wrong");
      input.style.backgroundColor = "";
      input.style.fontWeight = "";
      input.value = trueAnswer;
      input.readOnly = true;
      input.setAttribute("aria-label", isCorrect ? "Correct answer" : "Incorrect answer");
      showAnswerFeedback(input, isCorrect, rawAttempt);
    }
  });
}

// checks that stored front-side data belongs to the inputs on this back side
function inputSignatureMatches(data: CardInputData): boolean {
  const currentInputNames = Array.from(
    document.querySelectorAll<HTMLInputElement>("input"),
  )
    .map((input) => input.name)
    .filter((inputName) => inputName !== "");

  return (
    currentInputNames.length === data.inputNames.length &&
    currentInputNames.every((inputName, index) => inputName === data.inputNames[index])
  );
}

// back template initialization
function initializeBackTemplate(): void {
  if (window.data && inputSignatureMatches(window.data)) {
    revealAnswer(window.data.values);
  }
  displayTags("{{Tags}}");
  setLinkText();
}

// Initialize when loaded
initializeBackTemplate();
