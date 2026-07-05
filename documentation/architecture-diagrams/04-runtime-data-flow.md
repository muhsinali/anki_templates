# 4 · Runtime Data Flow (Front → Back)

This is the cleverest part of the system: **the front card and back card share
state through a single global, `window.data`.** Anki renders both sides in the
same webview, so a global set while showing the Front survives when the card is
flipped to the Back — which is exactly how the answer gets graded.

The JS context survives the flip, but **the DOM does not**: the Back base
template re-renders `{{Front}}`, which recreates every `<input>` fresh and
empty. The learner's typing survives the flip *only* inside `window.data` —
that is why the global exists at all.

```mermaid
sequenceDiagram
    autonumber

    actor Learner
    participant Anki as Anki backend
    participant Front as Front card
    participant Data as window.data
    participant Back as Back card

    %% Front card setup.
    Note over Front: initializeFrontTemplate() runs on load
    Front->>Data: storeInput() creates values + inputNames
    Front->>Front: prepare inputs, hint, Enter key, tags, link

    %% Learner input is mirrored into window.data.
    Learner->>Front: types code into answer fields
    Front->>Data: input listeners keep data.values in sync

    %% Anki flips to the Back card.
    Learner->>Front: presses Enter
    Front->>Anki: pycmd("ans")
    Anki->>Back: flip to Back in the same webview

    %% Back card grades against the saved global state.
    Note over Back: Front field re-renders; inputs are recreated empty
    Note over Back: initializeBackTemplate() runs on load
    Back->>Data: read window.data
    Back->>Back: verify inputNames signature
    Back->>Back: revealAnswer(data.values) normalizes, compares, marks
    Back-->>Learner: correct/incorrect feedback, expected answer, attempt if wrong
```

## Step by step

1. **Front loads → `initializeFrontTemplate()`.** The very first thing it does is
   `window.data = storeInput()`, building `{ values, inputNames }`. `values`
   is keyed by each input's `name` with its current value; `inputNames` stores
   the ordered front-side input-name signature.
2. **Live sync.** `storeInput()` also attaches an `input` event listener per
   field, so every keystroke updates `window.data.values[name]`.
3. **Submit.** Pressing **Enter** triggers `setupEnterKeyEvent()`'s handler,
   which calls `window.pycmd("ans")` — Anki's bridge to show the answer side.
   *(This does not work on iPhone — a known limitation.)*
4. **Same webview, surviving global — but a rebuilt DOM.** Anki flips to the
   Back **in the same JS context**, so `window.data` is still populated. The
   Back base template re-renders `{{Front}}`, though, so every `<input>` is a
   brand-new element with an empty value.
5. **Back loads → `initializeBackTemplate()`.** If `window.data` exists and the
   stored `inputNames` signature matches the recreated inputs, it calls
   `revealAnswer(window.data.values)` to grade each field against what the
   learner typed, then overwrites its value with the correct answer. A missing
   or mismatched signature skips grading rather than using stale data. See
   [`05-answer-validation`](./05-answer-validation.md) for the comparison logic.

## Why `window.data` and not something else?

- Anki cards have **no shared JavaScript module system** — front and back are two
  separate HTML blobs. A global on `window` is the only channel that spans them.
- The build's **`module: none`** setting keeps the helper functions global;
  `window.data` itself is assigned explicitly on `window` (see
  [`02-build-pipeline`](./02-build-pipeline.md)).

> ⚠️ **The `name` attribute is doing double duty.** It is both the dictionary key
> in `window.data.values` *and* the expected correct answer. It also contributes
> to the input-name signature used to reject stale data. An input with no `name`
> is silently skipped in both `storeInput()` and `revealAnswer()`.
