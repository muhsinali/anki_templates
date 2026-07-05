# 5 · Answer Validation

What `revealAnswer(data)` does on the Back card, for **each** `<input>`. The
comparison is deliberately lenient about whitespace and smart quotes so that
cosmetic differences never mark a correct answer wrong. Implemented in
[`src/back_template.ts`](../../src/back_template.ts).

```mermaid
flowchart TB
    start(["revealAnswer(data)<br/>for each input"])
    has_name{"Input has<br/>a name?"}
    skip_input["Skip input<br/>no class, no change"]
    expected_value["expected = parseInput(name)<br/>name is the answer"]
    learner_value["raw = learner value<br/>missing means empty string"]
    normalized_value["actual = parseInput(raw)<br/>quotes fixed, whitespace stripped"]
    is_correct{"actual === expected?"}
    mark_correct["Add answer-correct<br/>class + aria-label"]
    mark_wrong["Add answer-wrong<br/>class + aria-label"]
    show_answer["Show correct answer<br/>value = name, read-only"]
    show_feedback["Show text feedback<br/>and wrong attempt"]

    %% Skip inert inputs.
    start --> has_name
    has_name -->|no| skip_input

    %% Normalize before comparing.
    has_name -->|yes| expected_value
    expected_value --> learner_value
    learner_value --> normalized_value
    normalized_value --> is_correct

    %% Both outcomes reveal the expected answer.
    is_correct -->|yes| mark_correct
    is_correct -->|no| mark_wrong
    mark_correct --> show_answer
    mark_wrong --> show_answer
    show_answer --> show_feedback

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef good fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef bad fill:#f8d7da,stroke:#c62828,color:#000;
    classDef skip fill:#eceff1,stroke:#607d8b,color:#000;

    class start entry;
    class expected_value,learner_value,normalized_value,show_answer,show_feedback process;
    class mark_correct good;
    class mark_wrong bad;
    class skip_input skip;
```

## Normalization: `parseInput()`

Both sides of the comparison are normalized so formatting never causes a false
negative:

| Transform | Rule | Example |
|-----------|------|---------|
| Smart double quotes | `“` `”` → `"` | `“x”` → `"x"` |
| Smart single quotes | `‘` `’` → `'` | `‘y’` → `'y'` |
| Whitespace | all runs of whitespace removed (`\s+`) | `git  reset` → `gitreset` |

- **Both** the expected value (the `name` attribute) and the actual value (what
  the learner typed) go through the full `parseInput()`. The learner may type
  curly quotes (especially on mobile), and the `name` attribute may contain them
  too — e.g. pasted from a website or auto-converted by an editor — so both
  sides are normalized identically before comparison.

## Consequences of this design

- **Whitespace is never significant.** `console.log` and `console . log` grade
  identically. This is intentional — see the "gotchas" in `CLAUDE.md`.
- **The answer is always revealed.** Regardless of right/wrong, `input.value` is
  overwritten with the correct `name`, marked read-only, and styled by class so
  the learner sees the expected answer in-place.
- **Feedback is not color-only.** Correct and wrong answers get visible text
  feedback plus an `aria-label`. Wrong answers also show what the learner typed.
- **Unnamed inputs are inert.** No `name` → skipped here and never stored on the
  Front (see [`04-runtime-data-flow`](./04-runtime-data-flow.md)).
- **Missing keys are safe.** `data[name] ?? ""` means an input the learner never
  touched grades as an empty string (wrong) rather than throwing.
- **Feedback is idempotent.** A repeated grading pass replaces existing feedback
  instead of duplicating it.
