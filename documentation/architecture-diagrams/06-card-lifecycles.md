# 6 · Card Initialization Lifecycles

Each card side runs a single entry-point function immediately when its script
tag executes. These are the "what happens on load" flows.

## Front card — `initializeFrontTemplate()`

Source: [`src/front_template.ts`](../../src/front_template.ts). Steps run in this
exact order; the numbered nodes match the call order in the function body.

```mermaid
flowchart TB
    F0(["Front script loads<br/>initializeFrontTemplate()"]) --> F1["1 · window.data = storeInput()<br/>seed values + attach 'input' listeners"]
    F1 --> F2["2 · setupDOMContentLoaded(callback)"]
    F2 -.->|internally| D{"document.readyState<br/>=== 'loading' ?"}
    D -->|yes| DA["defer: run on DOMContentLoaded"]
    D -->|no| DB["run callback immediately"]
    DA --> CB["callback:<br/>setInputAttributes() + placeCursor()"]
    DB --> CB
    F2 -->|next step| F3["3 · setupHint()<br/>touchstart / mousedown → reveal hint"]
    F3 --> F4["4 · setupEnterKeyEvent()<br/>Enter → pycmd('ans')"]
    F4 --> F5["5 · displayTags(Tags)"]
    F5 --> F6["6 · setLinkText()"]

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef proc fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef branch fill:#eceff1,stroke:#607d8b,color:#000;
    class F0 entry;
    class F1,F2,F3,F4,F5,F6,CB proc;
    class DA,DB branch;
```

- **`storeInput()` runs first** so `window.data` exists before anything else.
- **`setInputAttributes()` + `placeCursor()` are deferred** behind
  `setupDOMContentLoaded` because they touch DOM elements; if the DOM is already
  parsed they run synchronously, otherwise they wait for `DOMContentLoaded`.
- `setInputAttributes()` disables autocapitalize / autocomplete / autocorrect /
  spellcheck so code typing is friction-free on mobile.

## Back card — `initializeBackTemplate()`

Source: [`src/back_template.ts`](../../src/back_template.ts). Much shorter — its
job is to grade, then render the shared chrome (tags + link).

```mermaid
flowchart TB
    B0(["Back script loads<br/>initializeBackTemplate()"]) --> B1{"window.data set?<br/>(carried over from Front)"}
    B1 -->|yes| B2["revealAnswer(window.data)<br/>grade + recolor inputs"]
    B1 -->|no| B3["skip grading<br/>(e.g. previewed without a Front pass)"]
    B2 --> B4["displayTags(Tags)"]
    B3 --> B4
    B4 --> B5["setLinkText()"]

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef proc fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef branch fill:#eceff1,stroke:#607d8b,color:#000;
    class B0 entry;
    class B2,B4,B5 proc;
    class B3 branch;
```

- The **`window.data` guard** means the Back is defensive: if it somehow renders
  without a Front pass having stored data, it simply skips grading instead of
  erroring.
- `displayTags()` and `setLinkText()` run on **both** sides (they come from
  `common.ts`), which is why the tag row and link render identically front and
  back.

## Shared chrome (both sides) — from `common.ts`

| Function | Effect |
|----------|--------|
| `displayTags("{{Tags}}")` | Splits the space-delimited tag string, prettifies each (`A::B_C` → `A - B C`), sorts, and writes into `#content_tag_left` |
| `setLinkText()` | Sets the first `<a>`'s text to `"Link"` (the URL field, once populated, becomes the source link) |

## Related

- Where `window.data` comes from and how the flip works:
  [`04-runtime-data-flow`](./04-runtime-data-flow.md)
- What `revealAnswer` does internally:
  [`05-answer-validation`](./05-answer-validation.md)
