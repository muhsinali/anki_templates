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
    source_files["src/*.ts"]
    transpiler["transpileSource()<br/>shared compiler settings"]
    injector["injectJavaScript()"]
    base_templates["templates/*_base.html"]

    subgraph unit_layer["Unit + property layer"]
        direction TB
        helper["tests/helpers.ts<br/>loadScripts()"]
        eval_step["window.eval into jsdom"]
        unit_tests["unit tests<br/>property tests"]

        helper --> eval_step
        eval_step --> unit_tests
    end

    subgraph integration_layer["Integration layer"]
        direction TB
        memory_build["build templates in-memory"]
        field_render["render Anki fields"]
        card_journey["front -> type -> flip -> grade"]

        memory_build --> field_render
        field_render --> card_journey
    end

    %% Both test layers use the build script's compiler settings.
    source_files --> transpiler
    transpiler --> helper
    transpiler --> memory_build
    base_templates --> injector
    injector --> memory_build

    %% Coverage maps eval'd code back to the real TypeScript files.
    unit_tests --> coverage["V8 coverage<br/>sourceURL -> real .ts lines"]
    coverage --> threshold["coverageThreshold ratchet<br/>src >= 95%, scripts >= 60%"]

    classDef input fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef transform fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef test fill:#fce4ec,stroke:#c2185b,color:#000;
    classDef gate fill:#d4edda,stroke:#2e7d32,color:#000;

    class source_files,base_templates input;
    class transpiler,injector,helper,memory_build transform;
    class eval_step,unit_tests,field_render,card_journey test;
    class coverage,threshold gate;
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

Runs on every push and pull request on the Node 26 major line, the tested
baseline (`engines: ">=24"`, `.nvmrc` tracks 26 locally). The CI job is named
`checks` — deliberately version-agnostic — and is designed to be the required
PR status check, so any failed step keeps the PR red.

```mermaid
flowchart TB
    trigger(["push / pull_request"])
    install["npm ci"]
    precommit["pre-commit run --all-files"]
    typecheck_src["tsc -p tsconfig.json --noEmit"]
    typecheck_tests["tsc -p tsconfig.jest.json --noEmit"]
    tests["npm test -- --coverage"]
    build["npm run build"]
    drift["git diff --exit-code code_cards/"]
    required_check["Required status check<br/>checks"]
    merge_allowed(["PR merge allowed"])
    red_status(["PR stays red"])

    %% Main CI path.
    trigger --> install
    install --> precommit
    precommit --> typecheck_src
    typecheck_src --> typecheck_tests
    typecheck_tests --> tests
    tests --> build
    build --> drift
    drift --> required_check
    required_check --> merge_allowed

    %% Any gate failure blocks the required check.
    precommit -->|hook failure| red_status
    typecheck_src -->|type error| red_status
    typecheck_tests -->|type error| red_status
    tests -->|failure or coverage drop| red_status
    build -->|syntax or build error| red_status
    drift -->|generated output drift| red_status

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#000;
    classDef bad fill:#f8d7da,stroke:#c62828,color:#000;

    class trigger entry;
    class install,precommit,typecheck_src,typecheck_tests process;
    class tests,build,drift,required_check process;
    class merge_allowed ok;
    class red_status bad;
```

The pre-commit gate runs the same hooks as a local commit:

- formatting guards from `pre-commit-hooks`;
- `codespell`;
- TypeScript type-checks for both tsconfigs;
- Jest tests.

The drift gate converts "remember to regenerate `code_cards/` after editing
`src/`" into a hard failure and implicitly asserts the build is deterministic.

To block PR merges, protect `main` in GitHub and require the CI job's status
check, `checks` from the `CI` workflow. Enable "Require status checks to pass
before merging" and "Require branches to be up to date before merging" so the
green check must be current for the PR head.

The same checks run locally: `make check` (typecheck + test + build) plus
`pre-commit run --all-files`.

## Related

- Build mechanics: [`02-build-pipeline`](./02-build-pipeline.md)
- Which tests target which modules: [`03-module-structure`](./03-module-structure.md)
- The runtime behavior the integration test replays:
  [`04-runtime-data-flow`](./04-runtime-data-flow.md)
