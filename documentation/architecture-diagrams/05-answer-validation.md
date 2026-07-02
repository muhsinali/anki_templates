# 5 · Answer Validation

What `revealAnswer(data)` does on the Back card, for **each** `<input>`. The
comparison is deliberately lenient about whitespace and smart quotes so that
cosmetic differences never mark a correct answer wrong. Implemented in
[`src/back_template.ts`](../../src/back_template.ts).

```mermaid
flowchart TB
    START(["revealAnswer(data)<br/>for each input on the card"]) --> HASNAME{"input has a<br/>name attribute?"}
    HASNAME -->|no| SKIP["skip this input<br/>(no color, no change)"]
    HASNAME -->|yes| EXPECTED["expected = name with all whitespace stripped<br/>(the name IS the correct answer)"]
    EXPECTED --> ACTUAL["raw = what the learner typed for this input<br/>(missing / untouched → empty string)"]
    ACTUAL --> NORM["actual = parseInput(raw):<br/>curly quotes → straight quotes<br/>then strip ALL whitespace"]
    NORM --> CMP{"actual === expected ?"}
    CMP -->|yes| GREEN["backgroundColor = rgb(124,232,0)<br/>✅ correct (green)"]
    CMP -->|no| RED["backgroundColor = rgb(240,128,128)<br/>❌ wrong (red)"]
    GREEN --> SET["input.value = name (show true answer)<br/>fontWeight = bold"]
    RED --> SET

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef proc fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef good fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef bad fill:#f8d7da,stroke:#c62828,color:#000;
    classDef skip fill:#eceff1,stroke:#607d8b,color:#000;

    class START entry;
    class EXPECTED,ACTUAL,NORM,SET proc;
    class GREEN good;
    class RED bad;
    class SKIP skip;
```

## Normalization: `parseInput()`

Both sides of the comparison are normalized so formatting never causes a false
negative:

| Transform | Rule | Example |
|-----------|------|---------|
| Smart double quotes | `“` `”` → `"` | `“x”` → `"x"` |
| Smart single quotes | `‘` `’` → `'` | `‘y’` → `'y'` |
| Whitespace | all runs of whitespace removed (`\s+`) | `git  reset` → `gitreset` |

- The **expected** value only has whitespace stripped (it originates from the
  clean `name` attribute).
- The **actual** value goes through the full `parseInput()` because a learner may
  type curly quotes (especially on mobile) or add stray spaces.

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
