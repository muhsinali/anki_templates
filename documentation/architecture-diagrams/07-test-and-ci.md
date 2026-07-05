# 7 · Test Architecture & CI Gate

How the test suite exercises the exact code that ships, why coverage can see
eval'd code, and what CI refuses to merge. Implemented in
[`tests/`](../../tests), [`jest.config.js`](../../jest.config.js), and
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

## 7a · Test architecture — three layers, one code path

Every layer reaches the shipped code through the build script's own
`transpileSource()`, so the compiler settings cannot drift between what is
tested and what ships. The unit/property layers eval individual `src/` files;
the integration layer builds the complete templates in-memory and runs the
whole front → flip → back journey.

```mermaid
flowchart TB
    SRC["src/*.ts"]
    TS["transpileSource()<br/>single home of the compiler settings<br/>throws on syntax errors"]
    INJ["injectJavaScript()"]
    BASE["templates/*_base.html"]

    subgraph unit["Unit + property layer"]
        direction TB
        HELP["tests/helpers.ts — loadScripts()<br/>inline source map + file:// sourceURL, cached"]
        EVAL["window.eval into jsdom<br/>functions attach as globals"]
        UT["common · front · back unit tests<br/>property tests (fast-check)"]
        HELP --> EVAL --> UT
    end

    subgraph integ["Integration layer"]
        direction TB
        MEM["build both templates in-memory"]
        RENDER["render Anki fields<br/>(mustache substitute)"]
        JOURNEY["load front → type → Enter →<br/>flip (same window, fresh DOM) → grade"]
        MEM --> RENDER --> JOURNEY
    end

    SRC --> TS
    TS --> HELP
    TS --> MEM
    BASE --> INJ
    INJ --> MEM

    UT --> COV["V8 coverage<br/>sourceURL attributes eval'd code<br/>back to the real .ts lines"]
    COV --> GATE["coverageThreshold ratchet<br/>src/ ≥ 95 stmts · scripts/ ≥ 60"]

    classDef in fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef mid fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef test fill:#fce4ec,stroke:#c2185b,color:#000;
    classDef out fill:#d4edda,stroke:#2e7d32,color:#000;
    class SRC,BASE in;
    class TS,INJ,HELP,MEM mid;
    class EVAL,UT,RENDER,JOURNEY test;
    class COV,GATE out;
```

Two non-obvious mechanics, documented so nobody "fixes" them:

- **Coverage needs V8 + sourceURL.** Jest's default (Istanbul) provider
  instruments at the transform stage and reports 0% for everything the
  eval-based tests exercise. The harness appends `//# sourceURL=file://…` and
  an inline source map, which the V8 provider maps back to the real `.ts`
  files, line-precise.
- **Strict-eval scoping in the integration test.** The built script starts
  with `"use strict"`, so under `eval()` its function declarations stay scoped
  to the eval. That is fine: only `window.data` must cross the card flip, and
  it is assigned to `window` explicitly.

## 7b · The CI gate

Runs on every push and pull request, on Node 24 — the current LTS and the
project's single supported line (`engines: ">=24"`, `.nvmrc`). A PR cannot
merge green if any step fails.

```mermaid
flowchart TB
    TRIGGER(["push / pull_request"]) --> CI["npm ci"]
    CI --> TC1["tsc -p tsconfig.json --noEmit<br/>(the build never type-checks)"]
    TC1 --> TC2["tsc -p tsconfig.jest.json --noEmit<br/>(tests + scripts stay type-sound)"]
    TC2 --> TESTS["npm test -- --coverage<br/>48 tests + threshold ratchet"]
    TESTS --> BUILD["npm run build"]
    BUILD --> DRIFT["git diff --exit-code code_cards/<br/>committed output must match src/"]
    DRIFT --> PASS(["merge allowed"])

    TC1 -- type error --> FAIL(["red ✗"])
    TC2 -- type error --> FAIL
    TESTS -- failure or coverage drop --> FAIL
    BUILD -- syntax error --> FAIL
    DRIFT -- forgot to regenerate --> FAIL

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef proc fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef bad fill:#f8d7da,stroke:#c62828,color:#000;
    class TRIGGER entry;
    class CI,TC1,TC2,TESTS,BUILD,DRIFT proc;
    class PASS ok;
    class FAIL bad;
```

The drift gate (last step) is the quiet hero: it converts "remember to
regenerate `code_cards/` after editing `src/`" into a hard failure and
implicitly asserts the build is deterministic.

The same checks run locally: `make check` (typecheck + test + build) and the
pre-commit hooks (`pre-commit install`) catch everything before it reaches CI.

## Related

- Build mechanics: [`02-build-pipeline`](./02-build-pipeline.md)
- Which tests target which modules: [`03-module-structure`](./03-module-structure.md)
- The runtime behaviour the integration test replays:
  [`04-runtime-data-flow`](./04-runtime-data-flow.md)
