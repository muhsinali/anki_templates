# 1 · System Context

The big picture: how a change flows from the TypeScript/HTML sources in this
repo, through the build step, and into a running Anki flashcard that a learner
studies.

There are **three worlds**:

1. **Authoring** — the source of truth that lives in this repository.
2. **Generated artifacts** — the `code_cards/` files a human copies into Anki.
3. **Anki (runtime)** — where the generated HTML actually executes, inside
   Anki's embedded webview.

```mermaid
flowchart TB
    LEARNER(["👤 Learner<br/>types code answers"])

    subgraph authoring["✍️ Authoring — this repo"]
        direction TB
        SRC["TypeScript logic<br/>src/common.ts · src/front_template.ts · src/back_template.ts"]
        TPL["Base HTML templates<br/>templates/*_template_base.html"]
        BUILD["Build script<br/>scripts/build-templates.ts"]
        SRC --> BUILD
        TPL --> BUILD
    end

    subgraph output["📦 Generated artifacts — code_cards/"]
        direction TB
        FHTML["front_template.html<br/>(generated)"]
        BHTML["back_template.html<br/>(generated)"]
        CSS["styling.css<br/>(hand-maintained, NOT generated)"]
    end

    subgraph anki["🎴 Anki — runtime"]
        direction TB
        NOTETYPE["'Code Card' note type<br/>Fields: Front · Back · Hint · URL · Tags"]
        WEBVIEW["Anki webview<br/>renders Front, then Back"]
        NOTETYPE --> WEBVIEW
    end

    BUILD -->|writes| FHTML
    BUILD -->|writes| BHTML

    FHTML -.paste into card template.-> NOTETYPE
    BHTML -.paste into card template.-> NOTETYPE
    CSS  -.paste into styling.-> NOTETYPE

    WEBVIEW --> LEARNER
    LEARNER -->|studies / answers| WEBVIEW

    classDef authoring fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef output fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef anki fill:#ede7f6,stroke:#5e35b1,color:#000;
    classDef person fill:#fff3cd,stroke:#f9a825,color:#000;

    class SRC,TPL,BUILD authoring;
    class FHTML,BHTML,CSS output;
    class NOTETYPE,WEBVIEW anki;
    class LEARNER person;
```

## Key facts

- **The repo produces HTML, not a running app.** The deliverables are three
  text files that a user manually pastes into Anki's card editor.
- **`styling.css` is a manual boundary.** It lives in `code_cards/` alongside
  the generated HTML but is **not** produced by the build — it is edited by hand.
  Its first line `@import url("_editor_button_styles.css")` references a file in
  the user's **Anki media collection**, not in this repo; if absent, the import
  fails silently.
- **Anki is the runtime.** The transpiled JavaScript only ever runs inside
  Anki's webview (or jsdom during tests), never in this repo directly.
- **Five Anki fields drive a card:** `Front`, `Back`, `Hint`, `URL`, and the
  built-in `Tags`. See [`04-runtime-data-flow`](./04-runtime-data-flow.md) for
  how these are consumed at runtime.
