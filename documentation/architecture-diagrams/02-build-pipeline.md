# 2 · Build Pipeline

How `npm run build` turns TypeScript + base HTML into the two Anki-ready HTML
files. Implemented in [`scripts/build-templates.ts`](../../scripts/build-templates.ts).

## Orchestration

`main()` calls `buildTemplate()` twice — once for each card side. The same
function body runs with `name = "front"` and then `name = "back"`.

```mermaid
flowchart TB
    build_command(["npm run build"])
    main_function["main()"]
    front_build["buildTemplate('front')"]
    back_build["buildTemplate('back')"]
    front_output["code_cards/front_template.html"]
    back_output["code_cards/back_template.html"]

    build_command --> main_function
    main_function --> front_build
    main_function --> back_build
    front_build --> front_output
    back_build --> back_output

    classDef entry fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef process fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef output fill:#d4edda,stroke:#2e7d32,color:#000;

    class build_command entry;
    class main_function,front_build,back_build process;
    class front_output,back_output output;
```

## Inside `buildTemplate(name)` — the transpile + inject step

For each side, three inputs are combined: the base HTML shell plus two blobs of
transpiled JavaScript. The base HTML contains two placeholder tokens that are
validated and replaced with literal JavaScript text. The diagram shows the
`front` side; `back` is identical with `back_*` filenames.

```mermaid
flowchart LR
    %% Inputs for one card side.
    common_source["src/common.ts"]
    front_source["src/front_template.ts"]
    front_base["front base HTML<br/>with placeholders"]

    %% Intermediate JavaScript strings.
    common_js["common JS string"]
    front_js["front JS string"]
    injector["injectJavaScript()<br/>validate + replace"]

    %% Generated output.
    front_output["code_cards/front_template.html"]

    common_source -->|"transpileSource()"| common_js
    front_source -->|"transpileSource()"| front_js
    front_base --> injector
    common_js -->|"fill %COMMON_JS%"| injector
    front_js -->|"fill %TEMPLATE_JS%"| injector
    injector -->|"writeFileSync"| front_output

    classDef input fill:#e1f5ff,stroke:#0288d1,color:#000;
    classDef transform fill:#fff3cd,stroke:#f9a825,color:#000;
    classDef output fill:#d4edda,stroke:#2e7d32,color:#000;

    class common_source,front_source,front_base input;
    class common_js,front_js,injector transform;
    class front_output output;
```

## Why it works this way

- **`module: none`, `target: ES2022`** — `transpileSource()` passes these to
  `ts.transpile()`. `module: none` means there is **no module wrapper**: every
  top-level `function` becomes a plain global. That is what lets the front card
  write `window.data` and the back card read it (see
  [`04-runtime-data-flow`](./04-runtime-data-flow.md)). Anki's webview does not
  support ES modules.
- **`transpileSource()` is exported and shared with the tests** — it is the
  single home of the compiler settings, and it checks the transpile
  diagnostics: a syntax error in `src/` fails the build loudly instead of
  emitting mangled JavaScript. (Type errors are still not checked — that is
  `tsc --noEmit`'s job, run by CI.)
- **Two placeholders, one order.** The base HTML always lays out
  `%COMMON_JS%` before `%TEMPLATE_JS%`, so common functions
  (`displayTags`, `prettifyTag`, `setLinkText`) are defined before the
  template-specific code that calls them. The build now fails clearly if either
  placeholder is missing.
- **Literal JavaScript injection.** `injectJavaScript()` uses replacer callbacks
  so JavaScript strings containing replacement patterns like `$$` or `$&` are
  copied byte-for-byte into the generated template.
- **Purely synchronous & string-based.** The build is `readFileSync` →
  `ts.transpile` → checked placeholder injection → `writeFileSync`. No bundler,
  no DOM, no source maps.
- **`styling.css` is never touched by this pipeline** — it is maintained by hand
  in `code_cards/`.

## Related

- Module/file relationships: [`03-module-structure`](./03-module-structure.md)
- What the transpiled functions do at runtime:
  [`06-card-lifecycles`](./06-card-lifecycles.md)
