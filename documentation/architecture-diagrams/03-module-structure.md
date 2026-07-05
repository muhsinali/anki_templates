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
    shared_logic["src/common.ts<br/>shared helpers"]

    subgraph front_side["Front side inputs"]
        direction TB
        front_logic["src/front_template.ts"]
        front_base["templates/front_template_base.html"]
    end

    subgraph back_side["Back side inputs"]
        direction TB
        back_logic["src/back_template.ts"]
        back_base["templates/back_template_base.html"]
    end

    front_build["buildTemplate('front')"]
    back_build["buildTemplate('back')"]
    front_output["code_cards/front_template.html"]
    back_output["code_cards/back_template.html"]

    %% Shared helpers feed both generated cards.
    shared_logic --> front_build
    shared_logic --> back_build

    %% Side-specific inputs.
    front_logic --> front_build
    front_base --> front_build
    back_logic --> back_build
    back_base --> back_build

    %% Generated Anki templates.
    front_build --> front_output
    back_build --> back_output

    classDef source fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef build fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef output fill:#d4edda,stroke:#2e7d32,color:#000;

    class shared_logic,front_logic,front_base,back_logic,back_base source;
    class front_build,back_build build;
    class front_output,back_output output;
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
    subgraph source_files["src/ runtime files - one global scope"]
        direction TB
        front_module["front_template.ts<br/>front lifecycle + input sync"]
        back_module["back_template.ts<br/>answer parsing + grading"]
        common_module["common.ts<br/>tags + link chrome"]
        global_types["global.d.ts<br/>Window types only"]

        front_module -->|calls| common_module
        back_module -->|calls| common_module
    end

    build_script["scripts/build-templates.ts<br/>transpile + inject"]
    test_harness["tests/helpers.ts<br/>transpile, cache, eval"]

    %% Unit and property tests target source modules.
    front_tests["front_template.test.ts"] -.->|tests| front_module
    back_tests["back_template.test.ts"] -.->|tests| back_module
    common_tests["common.test.ts"] -.->|tests| common_module
    property_tests["property.test.ts"] -.->|tests| back_module
    property_tests -.->|tests| common_module

    %% Build and integration tests target the build path.
    build_tests["build_templates.test.ts"] -.->|tests| build_script
    integration_tests["integration.test.ts"] -.->|builds + runs| build_script

    %% Most tests load source through the shared harness.
    front_tests --> test_harness
    back_tests --> test_harness
    common_tests --> test_harness
    property_tests --> test_harness
    test_harness --> build_script

    classDef source fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef build fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef test fill:#fce4ec,stroke:#c2185b,color:#000;
    classDef types fill:#f5f5f5,stroke:#9e9e9e,color:#000;

    class front_module,back_module,common_module source;
    class build_script,test_harness build;
    class common_tests,front_tests,back_tests,property_tests test;
    class build_tests,integration_tests test;
    class global_types types;
```

## How the pieces fit

- **Shared logic** (`src/common.ts`): `displayTags`, `prettifyTag`, and
  `setLinkText`, used by both card sides.
- **Front logic** (`src/front_template.ts`): captures input into `window.data`,
  focuses the field, and wires Enter/hint behavior.
- **Back logic** (`src/back_template.ts`): reads `window.data`, grades answers,
  and recolors inputs.
- **Base HTML** (`templates/*_template_base.html`): layout, Anki fields, and
  `%COMMON_JS%` / `%TEMPLATE_JS%` slots.
- **Build** (`scripts/build-templates.ts`): transpiles and injects JavaScript,
  then writes `code_cards/*.html`.
- **Output** (`code_cards/*.html`, `styling.css`): pasted into Anki; HTML is
  generated, CSS is manual.
- **Types** (`src/global.d.ts`): the `Window` contract (`data`, `pycmd`) at
  compile time only.
- **Test harness** (`tests/helpers.ts`): transpiles through the build's
  `transpileSource()`, caches the result, and evals into jsdom.
- **Tests** (`tests/*.test.ts`): unit, build-script, property-based, and
  end-to-end lifecycle suites.

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
