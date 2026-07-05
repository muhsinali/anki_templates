# 5 · Answer Validation

What `revealAnswer(data)` does on the Back card, for **each** `<input>`. The
comparison is deliberately lenient about whitespace and smart quotes so that
cosmetic differences never mark a correct answer wrong. Implemented in
[`src/back_template.ts`](../../src/back_template.ts).

```mermaid
flowchart TB
    start(["revealAnswer(data)<br/>for each input"])
    has_name{"Input has<br/>a name?"}
    skip_input["Skip input<br/>no color, no change"]
    expected_value["expected = parseInput(name)<br/>name is the answer"]
    learner_value["raw = learner value<br/>missing means empty string"]
    normalized_value["actual = parseInput(raw)<br/>quotes fixed, whitespace stripped"]
    is_correct{"actual === expected?"}
    mark_correct["Mark green<br/>rgb(124,232,0)"]
    mark_wrong["Mark red<br/>rgb(240,128,128)"]
    show_answer["Show correct answer<br/>value = name, bold"]

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

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef good fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef bad fill:#f8d7da,stroke:#c62828,color:#000;
    classDef skip fill:#eceff1,stroke:#607d8b,color:#000;

    class start entry;
    class expected_value,learner_value,normalized_value,show_answer process;
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
  overwritten with the correct `name` and bolded, so the learner sees the
  expected answer in-place.
- **Unnamed inputs are inert.** No `name` → skipped here and never stored on the
  Front (see [`04-runtime-data-flow`](./04-runtime-data-flow.md)).
- **Missing keys are safe.** `data[name] ?? ""` means an input the learner never
  touched grades as an empty string (wrong) rather than throwing.
