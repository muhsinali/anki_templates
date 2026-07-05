# 6 · Card Initialization Lifecycles

Each card side runs a single entry-point function immediately when its script
tag executes. These are the "what happens on load" flows.

## Front card — `initializeFrontTemplate()`

Source: [`src/front_template.ts`](../../src/front_template.ts). Steps run in this
exact order; the numbered nodes match the call order in the function body.

```mermaid
flowchart TB
    front_load(["Front script loads"])
    seed_data["1. storeInput()<br/>seed data + listen for input"]
    dom_setup["2. setupDOMContentLoaded(callback)"]
    dom_ready{"document.readyState<br/>is loading?"}
    defer_callback["Defer callback<br/>until DOMContentLoaded"]
    run_callback["Run callback<br/>immediately"]
    prepare_inputs["Callback<br/>set attributes + place cursor"]
    setup_hint["3. setupHint()<br/>reveal hint on touch/mouse"]
    setup_enter["4. setupEnterKeyEvent()<br/>bind once, Enter calls pycmd('ans')"]
    display_tags["5. displayTags(Tags)"]
    set_link["6. setLinkText()"]

    %% First, create the front-to-back state channel.
    front_load --> seed_data
    seed_data --> dom_setup

    %% Then decide when DOM-touching work can run.
    dom_setup -.->|internal check| dom_ready
    dom_ready -->|yes| defer_callback
    dom_ready -->|no| run_callback
    defer_callback --> prepare_inputs
    run_callback --> prepare_inputs

    %% Continue the entry-point call order.
    dom_setup -->|next step| setup_hint
    setup_hint --> setup_enter
    setup_enter --> display_tags
    display_tags --> set_link

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef branch fill:#eceff1,stroke:#607d8b,color:#000;

    class front_load entry;
    class seed_data,dom_setup,prepare_inputs process;
    class setup_hint,setup_enter,display_tags,set_link process;
    class defer_callback,run_callback branch;
```

- **`storeInput()` runs first** so `window.data` exists before anything else.
  It stores both the live `values` map and the ordered `inputNames` signature
  used by the Back side to reject stale data.
  It can safely query the inputs synchronously because the `<script>` block
  sits at the *end* of the template body — the `{{Front}}` content above it is
  already parsed by the time the script executes.
- **`setInputAttributes()` + `placeCursor()` are deferred** behind
  `setupDOMContentLoaded` because they touch DOM elements; if the DOM is already
  parsed they run synchronously, otherwise they wait for `DOMContentLoaded`.
- `setInputAttributes()` disables autocapitalize / autocomplete / autocorrect /
  spellcheck so code typing is friction-free on mobile.
- `setupEnterKeyEvent()` is guarded so the document-level listener is attached
  once per webview, and composing Enter key events are ignored for IME users.

## Back card — `initializeBackTemplate()`

Source: [`src/back_template.ts`](../../src/back_template.ts). Much shorter — its
job is to grade, then render the shared chrome (tags + link).

```mermaid
flowchart TB
    back_load(["Back script loads"])
    has_data{"window.data set?"}
    signature_match{"inputNames<br/>match?"}
    grade_answers["revealAnswer(data.values)<br/>grade + feedback"]
    skip_grading["Skip grading<br/>missing or stale data"]
    display_tags["displayTags(Tags)"]
    set_link["setLinkText()"]

    %% Grade only when the Front card saved learner input.
    back_load --> has_data
    has_data -->|yes| signature_match
    has_data -->|no| skip_grading
    signature_match -->|yes| grade_answers
    signature_match -->|no| skip_grading

    %% Shared chrome renders in both paths.
    grade_answers --> display_tags
    skip_grading --> display_tags
    display_tags --> set_link

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef branch fill:#eceff1,stroke:#607d8b,color:#000;

    class back_load entry;
    class grade_answers,display_tags,set_link process;
    class skip_grading,signature_match branch;
```

- The **`window.data` and signature guards** mean the Back is defensive: if it
  renders without a Front pass, or with stale data from differently shaped
  inputs, it skips grading instead of erroring or misgrading.
- `displayTags()` and `setLinkText()` run on **both** sides (they come from
  `common.ts`), which is why the tag row and link render identically front and
  back.

## Shared chrome (both sides) — from `common.ts`

- `displayTags("{{Tags}}")` splits the space-delimited tag string, prettifies
  each tag (`A::B_C` → `A - B C`), locale-sorts them case-insensitively, and
  writes the result into `#content_tag_left`.
- `setLinkText()` renders the optional `#url_container` value as a compact
  `"Link"`: existing anchors are renamed, raw HTTP(S) text becomes an anchor,
  and content links outside the URL container are left alone.

## Related

- Where `window.data` comes from and how the flip works:
  [`04-runtime-data-flow`](./04-runtime-data-flow.md)
- What `revealAnswer` does internally:
  [`05-answer-validation`](./05-answer-validation.md)
