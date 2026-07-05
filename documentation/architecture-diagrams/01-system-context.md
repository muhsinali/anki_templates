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
    learner(["Learner<br/>types code answers"])

    subgraph authoring["Authoring - this repo"]
        direction TB
        typescript_sources["TypeScript logic<br/>common + front + back"]
        base_templates["Base HTML templates<br/>front + back shells"]
        build_script["Build script<br/>scripts/build-templates.ts"]

        typescript_sources --> build_script
        base_templates --> build_script
    end

    subgraph output["Generated artifacts - code_cards/"]
        direction TB
        front_html["front_template.html<br/>generated"]
        back_html["back_template.html<br/>generated"]
        styling_css["styling.css<br/>hand-maintained"]
    end

    subgraph anki["Anki runtime"]
        direction TB
        note_type["Code Card note type<br/>Front, Back, Hint, URL, Tags"]
        webview["Anki webview<br/>renders Front, then Back"]

        note_type --> webview
    end

    %% Build output.
    build_script -->|writes| front_html
    build_script -->|writes| back_html

    %% Manual copy into Anki.
    front_html -.->|paste into card template| note_type
    back_html -.->|paste into card template| note_type
    styling_css -.->|paste into styling| note_type

    %% Runtime study loop.
    webview --> learner
    learner -->|studies / answers| webview

    classDef authoring fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef output fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef anki fill:#ede7f6,stroke:#5e35b1,color:#000;
    classDef person fill:#fff3cd,stroke:#f9a825,color:#000;

    class typescript_sources,base_templates,build_script authoring;
    class front_html,back_html,styling_css output;
    class note_type,webview anki;
    class learner person;
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
