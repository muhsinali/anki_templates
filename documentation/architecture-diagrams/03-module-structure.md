# 3 · Module & File Structure

The file layout has two independent stories, so this page keeps them as two
small diagrams instead of one crowded graph:

- **3a — Build-time composition:** which source files combine into each
  generated card.
- **3b — Code relationships:** how the `src/` files depend on each other at
  runtime, and how the tests map onto them.

## 3a · Build-time composition

`common.ts` is **shared** — it feeds both sides. Everything else is
side-specific: each card side is `common.ts` + that side's `*_template.ts` +
that side's `*_base.html`, combined by one `buildTemplate()` call. (`styling.css`
is intentionally absent — it is hand-maintained, not produced by the build.)

```mermaid
flowchart TB
    COMMON["src/common.ts — shared<br/>displayTags · prettifyTag · setLinkText"]

    subgraph frontside["Front side inputs"]
        direction TB
        FRONT["src/front_template.ts"]
        FBASE["templates/front_template_base.html"]
    end

    subgraph backside["Back side inputs"]
        direction TB
        BACK["src/back_template.ts"]
        BBASE["templates/back_template_base.html"]
    end

    BF["buildTemplate('front')"]
    BB["buildTemplate('back')"]
    OFRONT["code_cards/front_template.html"]
    OBACK["code_cards/back_template.html"]

    COMMON --> BF
    COMMON --> BB
    FRONT --> BF
    FBASE --> BF
    BACK --> BB
    BBASE --> BB
    BF --> OFRONT
    BB --> OBACK

    classDef srcCls fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef buildCls fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef outCls fill:#d4edda,stroke:#2e7d32,color:#000;
    class COMMON,FRONT,FBASE,BACK,BBASE srcCls;
    class BF,BB buildCls;
    class OFRONT,OBACK outCls;
```

> The mechanics of a single `buildTemplate()` call (transpile + placeholder
> substitution) are in [`02-build-pipeline`](./02-build-pipeline.md).

## 3b · Code relationships (runtime deps + tests)

Solid arrows are **runtime calls**; dotted arrows are **test targets**. Both
card entry points call into the shared `common.ts` functions. The unit and
property tests load sources through the shared harness (`tests/helpers.ts`),
which transpiles via the build's own `transpileSource()`; the integration test
builds the full templates in-memory and exercises them end-to-end.

```mermaid
flowchart TB
    subgraph src["src/ — runtime dependencies (one global scope)"]
        direction TB
        FRONT["front_template.ts<br/>storeInput · placeCursor · setInputAttributes<br/>setupHint · setupEnterKeyEvent · setupDOMContentLoaded<br/>initializeFrontTemplate()"]
        BACK["back_template.ts<br/>parseInput · revealAnswer<br/>initializeBackTemplate()"]
        COMMON["common.ts<br/>displayTags · prettifyTag · setLinkText"]
        DTS["global.d.ts<br/>Window contract: data, pycmd<br/>(types only — nothing ships)"]
        FRONT -->|calls| COMMON
        BACK -->|calls| COMMON
    end

    BUILD["scripts/build-templates.ts<br/>transpileSource() · injectJavaScript()"]
    HELPERS["tests/helpers.ts<br/>loadScripts() — transpile via the build, cache, eval"]

    TFRONT["tests/front_template.test.ts"] -.tests.-> FRONT
    TBACK["tests/back_template.test.ts"] -.tests.-> BACK
    TCOMMON["tests/common.test.ts"] -.tests.-> COMMON
    TPROP["tests/property.test.ts<br/>(fast-check invariants)"] -.tests.-> BACK
    TPROP -.tests.-> COMMON
    TBUILD["tests/build_templates.test.ts"] -.tests.-> BUILD
    TINT["tests/integration.test.ts<br/>(full card lifecycle)"] -.builds & runs.-> BUILD

    TFRONT --> HELPERS
    TBACK --> HELPERS
    TCOMMON --> HELPERS
    TPROP --> HELPERS
    HELPERS --> BUILD

    classDef srcCls fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef buildCls fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef testCls fill:#fce4ec,stroke:#c2185b,color:#000;
    classDef typeCls fill:#f5f5f5,stroke:#9e9e9e,color:#000;
    class FRONT,BACK,COMMON srcCls;
    class BUILD,HELPERS buildCls;
    class TCOMMON,TFRONT,TBACK,TPROP,TBUILD,TINT testCls;
    class DTS typeCls;
```

## How the pieces fit

| Layer | Files | Role |
|-------|-------|------|
| **Shared logic** | `src/common.ts` | `displayTags`, `prettifyTag`, `setLinkText` — used by **both** card sides |
| **Front logic** | `src/front_template.ts` | Captures input into `window.data`, focuses the field, wires Enter/hint |
| **Back logic** | `src/back_template.ts` | Reads `window.data`, grades and recolors inputs |
| **Base HTML** | `templates/*_template_base.html` | Layout + Anki field placeholders + `%COMMON_JS%` / `%TEMPLATE_JS%` slots |
| **Build** | `scripts/build-templates.ts` | Transpiles + injects → writes `code_cards/*.html` |
| **Output** | `code_cards/*.html`, `styling.css` | Pasted into Anki; HTML is generated, CSS is manual |
| **Types** | `src/global.d.ts` | The `Window` contract (`data`, `pycmd`) — compile-time only |
| **Test harness** | `tests/helpers.ts` | `loadScripts()`: transpile via the build's `transpileSource()`, cache, eval into jsdom |
| **Tests** | `tests/*.test.ts` | Unit (one per `src/` file), build-script, property-based, and end-to-end lifecycle suites |

## Notes

- **`common.ts` is the shared dependency.** Because everything is compiled with
  `module: none`, "depends on" simply means *its functions are defined in the
  same global scope first*. The build guarantees this by emitting `%COMMON_JS%`
  before `%TEMPLATE_JS%`.
- **Tests load the exact code that ships.** The harness transpiles the real
  `src/` files through the build's own `transpileSource()` (one home for the
  compiler settings) and `eval`s them into a jsdom `window`. See
  [`07-test-and-ci`](./07-test-and-ci.md) for the full test architecture and
  the CI gate.
- **`dist/` is unused by the build** — it only appears if you run
  `npx tsc` manually. The build never reads it.
