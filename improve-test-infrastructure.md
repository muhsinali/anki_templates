# Improving the Test Infrastructure

> ✅ **This plan is fully executed** (2026-07-02 → 2026-07-05, PR #5). Every
> step landed as its own single commit, worked red → green, with every gate
> demonstrated to trip before being trusted. The [execution
> record](#execution-record) below maps steps to commits, lists what was
> found along the way, and records the few deliberate deviations. The rest of
> the document is preserved as written — it is the reasoning behind the
> result, and diagram
> [07-test-and-ci](documentation/architecture-diagrams/07-test-and-ci.md)
> shows the architecture it produced.

This was a step-by-step plan for upgrading the testing infrastructure of the Anki code
cards project, based on a full read-through of the source, tests, build script,
templates, configs, and docs. Steps are ordered by impact: each one either closes the
biggest remaining risk or makes every later step cheaper.

**Every load-bearing claim in this plan has been machine-verified** (2026-07-02) by
running the tools, reproducing the bugs, and prototyping the risky steps — including a
working end-to-end flip test and a working fix for the blind coverage problem. The
[validation log](#appendix--validation-log) at the bottom records what was checked and
how, and the few things that remain assumptions.

Mid-review, PR #4 merged and landed part of step 2 (the smart-quote grading fix plus
build-script hardening: exported `injectJavaScript()`, the `$$`-corruption and
missing-placeholder fixes with tests, a `require.main` guard, and `scripts/` added to
the type-checked config). The plan and log below were reconciled against the
post-merge tree, and every re-checkable claim was re-verified on it.

It expands the testing items sketched in `improvement-plan.md` (items 8, 10, 11, 12,
and parts of 17) into a single sequenced track. Where the two documents overlap, this
one is the more detailed and current.

---

## Execution record

All work landed on one branch (PR #5), one commit per step plus a review-pass
commit and two follow-ups, each commit passing the full local gate (both
type-checks, the whole suite with coverage thresholds, build + drift check,
and — from step 7 on — the installed pre-commit hooks) before being pushed.

| Step | Commit | Outcome |
|------|--------|---------|
| 1 · CI gate | `d0d189b` | Workflow live on push + PR; all four failure modes (type error, failing test, unregenerated `code_cards/`, broken build) demonstrated to trip. Drift gate enabled with no sync-up commit, as predicted |
| Review pass | `f1d3e8d` | Post-steps-1–3 self-review: least-privilege workflow token, concurrency cancellation, fixed a doc claiming the build reads `tsconfig.json` |
| 2 · Build-script tests | `5e17a09` | `transpileSource()` exported, diagnostics thrown (test seen red first), compiler settings single-sourced, template invariants pinned. Build byte-identical. 27 → 35 tests |
| 3 · E2E lifecycle test | `86fb9e9` | Four scenarios (full journey incl. smart-quote grading, no-typing, back-without-front, no-hint); proven able to fail via four sabotages. 35 → 39 tests |
| 4 · Shared harness | `0a166ad` | `tests/helpers.ts` + `loadScripts()`; polyfills deleted (suite stayed green); direct `initialize*()` tests (seen red under sabotage); `clearMocks`. **Found a real bug:** a test shadowed `document.readyState` non-configurably, silently disabling `placeCursor` for every later test in its file — fixed. 39 → 42 tests |
| 5 · Real coverage | `9e08578` + `57b9d6d` | V8 + sourceURL recipe exactly as validated; `src/` 100% stmts, line-precise; ratchet (src ≥95, scripts floor) enforced in CI; gate tripped deliberately once. Follow-up: exclude `.d.ts` from collection — Node 24's V8 counts declaration files as 0% rows, Node 22's does not; **the CI matrix caught this** (local Node 22 green, CI Node 24 red) |
| 6 · Types as a test layer | `b00d86b` | `src/global.d.ts` Window contract; `src/` cast-free with byte-identical emitted JS (no regeneration needed). **Deviation (upgrade):** tests call functions as bare typed globals instead of the sketched hand-synced accessor — the `src/` files are global scripts in the jest tsconfig program, so a rename or re-signature fails `tsc` (verified red both ways). `make typecheck`, `make check`, and a pre-commit hook, each seen to trip |
| 7 · Dependency hygiene | `2cc8b7c` | Jest 30 + environment 30 (42/42 unmodified, as pre-validated); direct `jsdom` dropped; prettier **uninstalled** (the "decide" call — it formatted nothing); `private: true`; `engines` + `.nvmrc` |
| 8 · Stretch (partial, by design) | `1d884d1` | fast-check property tests landed (6 tests: `parseInput` idempotence / no whitespace or curly quotes / quote-style-insensitive grading / identity on normalized input; `prettifyTag` never emits `::` or `_`, idempotent; both sabotages seen red). Stryker, Playwright, and the golden snapshot deliberately not done, per this plan's own criteria. Side effect: the pre-commit typecheck hook blocked fast-check's declarations until `tsconfig.jest.json` gained `skipLibCheck` (its `.d.ts` uses subpath type imports legacy `moduleResolution: "node"` cannot follow). 42 → 48 tests |
| Docs & diagrams | `bbbce59` | New diagram `07-test-and-ci.md` (test architecture + CI gate, all Mermaid blocks render-validated); `03-module-structure` refreshed; indexes and cross-links updated |
| Node 24 consolidation | `08eb1f0` | Post-plan decision: single supported line. Matrix → one Node 24 job; `engines: ">=24"`; `.nvmrc` 24; `@types/node` ^24; docs aligned. (The 22+24 matrix caught the `.d.ts` divergence before retiring) |

**End state:** 48 tests across 6 suites (unit, build-script, property,
integration) in ~1s; `src/` at 100% statements / 97.3% branches with
thresholds enforced in CI; `scripts/` at 74.5% against a 60 floor; CI green
on Node 24 for type-check ×2, tests + coverage, build, and the `code_cards/`
drift gate; the same checks wired into pre-commit (type-check + tests) and
`make check`.

---

## Why invest here — what better test infrastructure buys us

This project has an unusual property that makes tests disproportionately valuable:
**the deployment target is a black box.** The built templates get hand-pasted into
Anki's note type editor and run inside a webview with no console, no debugger, and no
error reporting. When something breaks, it breaks *silently, mid-review* — an answer
grades wrong, a hint doesn't open, a script dies quietly — and the learner has no way
to know whether they mistyped or the card is broken. Everything we can verify before
pasting into Anki is a failure a learner never experiences.

Concretely, a finished version of this plan gives us:

- **A safety net for the backlog.** `improvement-plan.md` lists 19 changes, many of
  them touching the grading logic — the most damage-prone code in the project. With an
  end-to-end test of the type→flip→grade journey and real coverage numbers, each of
  those changes becomes a small, confident diff instead of a leap of faith.
- **Enforced invariants instead of honour-system rules.** Today, "regenerate
  `code_cards/` after editing `src/`", "run the type-checker", and "run the tests"
  all rely on the committer remembering. CI turns each one into a hard gate.
- **Protection for the artifact generator.** The build script — the thing that
  actually produces the shipped artifact — had zero tests and three verified
  silent-failure modes when this review began. PR #4 fixed two with tests
  (`String.replace` substitution-pattern corruption; missing-placeholder no-op). The
  third is reproduced and still open: `ts.transpile()` discards syntax-error
  diagnostics, so invalid source ships mangled output while the build prints
  "success" (step 2).
- **Honest measurement.** Coverage currently reports **0% on every file** while 24
  tests pass — the tooling literally cannot see what the tests exercise. The fix is
  validated and small (step 5); after it, coverage becomes a real map of what's
  protected, and can be ratcheted.
- **Trustworthy contributions.** With CI in place, a PR from anyone — human or agent —
  arrives pre-validated: types sound, tests green, build reproducible, committed output
  in sync with source.

And because the whole suite runs in under a second, we can afford to run *everything on
every commit* — there is no speed/coverage trade-off to manage at this scale.

---

## Where we were — the 2026-07-02 baseline

*(Historical snapshot. Every gap in the table below is now closed — see the
[execution record](#execution-record) for what closed it.)*

Credit where due — several things were genuinely good and worth preserving:

- **Fidelity-first test pattern.** Tests transpile the real `src/` files with the same
  compiler settings as the build and `eval()` them into jsdom, so they exercise the
  exact code that ships.
- **Fast, green, and wired to pre-commit.** 27 tests across 4 suites in ~0.6s, and the
  pre-commit hook refuses to commit on failure (for anyone who has installed it).
- **The build script gained its first tests mid-review.** PR #4 extracted and exported
  `injectJavaScript()`, fixed the two injection bugs, added `tests/build_templates.test.ts`
  (3 tests), guarded `main()` behind `require.main === module`, and put `scripts/` into
  the type-checked config. Step 2 below is now about finishing that job, not starting it.
- **Sound types.** Both `tsc -p tsconfig.json` and `tsc -p tsconfig.jest.json` pass
  clean today (verified with real exit codes).
- **Deterministic build, in-sync output.** `npm run build` currently reproduces the
  committed `code_cards/` byte-for-byte — so the CI drift gate in step 1 can be
  switched on without any preparatory sync-up commit.

The gaps, in decreasing order of severity:

| Gap | Evidence (all verified) |
|-----|--------------------------|
| No CI at all | `.github/` contains only images; tests run only on machines with pre-commit installed |
| Coverage is blind for eval'd code | `npx jest --coverage` shows **no rows at all** for `src/` files despite the whole suite passing — eval'd code never passes through Jest's Istanbul instrumentation. The repo now demonstrates both halves of the mechanism: the import-based build-script tests (PR #4) report real coverage (41% of `build-templates.ts`) while the eval-based suites report nothing |
| Build script: one silent failure mode left, settings still duplicated | Fixed and tested since PR #4: `$$`/`$&` replacement-pattern corruption and the missing-placeholder no-op. Still open: (a) `ts.transpile()` discards syntax-error diagnostics — invalid source emits mangled JS and the build prints success (reproduced: 5 diagnostics silently dropped); (b) `transpileTypeScript()` is not exported, so the compiler settings remain copy-pasted into every test file |
| No integration test | Nothing tests the built HTML, the placeholder injection, or the front→flip→back journey that is the whole point of the system |
| Committed output can drift | `code_cards/` is committed but nothing verifies it matches `src/` |
| Type-check enforced nowhere | The build strips types without checking; no hook or pipeline runs `tsc`. (`tsconfig.jest.json` does now cover everything — `scripts/` was added in PR #4 — it just never runs automatically) |
| Compiler settings duplicated 4× | `{module: none, target: ES2022}` is hard-coded in the build script *and* in each of the three test files — if the build settings change, the tests silently keep testing the old ones |
| Test boilerplate triplicated — and partly vestigial | Each test file carries its own `setupDom()` plus TextEncoder/TextDecoder polyfills. **The polyfills are dead weight**: the full suite passes with them deleted, on both Jest 29 and Jest 30 (verified). Eval'ing a template file also runs its `initialize*()` as a side effect, attaching document-level listeners no test asked for — and those initializers are never directly tested |
| Dependency drift | `@types/jest@^30` against `jest@29`; a direct `jsdom@26` nothing uses (the test environment runs Jest's bundled `jsdom@20`); `prettier` installed but wired to nothing; no `engines` field (BUILD.md's "Node v18+" claim covers only EOL versions); `coverage/` missing from `.gitignore` |

---

## Working method: red → green → refactor

Every step below is worked test-first:

1. **Red** — write the test (or trip the gate) that fails against the current code.
   For a bug, that's a failing test reproducing it. For infrastructure (CI, hooks,
   thresholds), it's proving the gate actually trips: deliberately break the thing it
   guards on a branch and watch it go red. A gate that has never failed is untested
   infrastructure.
2. **Green** — make the smallest change that passes.
3. **Refactor** — clean up on green only. For anything touching the build, the
   committed `code_cards/` output is the built-in characterisation test: after a
   pure refactor, `npm run build && git diff --exit-code code_cards/` must stay clean.

One caveat for regression-net tests (like step 3's e2e test): they are written against
*working* code, so they start green. Their "red" is demonstrated differently —
temporarily break the code they guard (e.g. sabotage `revealAnswer` or delete a
placeholder) and confirm the test fails, then revert. Never trust a test you haven't
seen fail.

Every step ends the same way: **update the docs listed in that step** — the
documentation debt stays at zero if it's paid per-change.

---

## The plan, in order

| # | Step | Impact | Effort | Validated | Status |
|---|------|--------|--------|-----------|--------|
| 1 | Stand up a CI gate | Very high | Low | Commands verified locally; drift gate passes today | ✅ `d0d189b` |
| 2 | Finish the build-script tests (⅔ landed in PR #4) | High | Low | Remaining bug reproduced; landed fixes re-verified | ✅ `5e17a09` |
| 3 | Add an end-to-end card lifecycle test | High | Medium | Working prototype: 2 scenarios pass in ~0.5s | ✅ `86fb9e9` |
| 4 | Consolidate into one shared test harness | Medium | Low | Polyfill deletion verified against full suite | ✅ `0a166ad` |
| 5 | Make coverage real, then enforce it | Medium–high | **Low** (was medium — the fix is proven) | V8 route verified with precise line attribution | ✅ `9e08578` + `57b9d6d` |
| 6 | Make type-checking a first-class test layer | Medium | Low | `global.d.ts` + cast-free access compiles clean | ✅ `b00d86b` |
| 7 | Dependency and config hygiene | Low–medium | Low | Jest 30 upgrade verified: 27/27 pass | ✅ `2cc8b7c` |
| 8 | Stretch goals: mutation, property-based, real-browser | Optional | Varies | Not validated — genuinely exploratory | ◐ property tests only (`1d884d1`), rest skipped by design |

The ordering logic: **step 1 makes every later step enforceable**. **Steps 2–3 close
the two largest untested surfaces** — artifact generation and the core user journey.
**Step 4 makes writing all future tests cheaper** and removes a settings-drift
correctness risk. **Steps 5–7 turn the tooling honest.** Step 8 is where to go once
the fundamentals hold.

---

### Step 1 — Stand up a CI gate (GitHub Actions) ✅

> **Done — `d0d189b`.** All five workflow steps as specified; each of the four
> failure modes demonstrated to trip (locally, since scratch-branch pushes
> were out of scope for the single-commit-per-step constraint); badge added;
> BUILD.md's aspirational CI section replaced with the real thing. Later
> hardened in `f1d3e8d` (read-only token, concurrency cancellation) and
> consolidated to a single Node 24 job in `08eb1f0`.

**Why first.** Every other improvement only pays off if it runs on every change. Right
now, tests run solely via an *optionally installed* pre-commit hook — a fresh clone, a
GitHub web edit, or a contributor without pre-commit bypasses everything. This is also
the cheapest step: one YAML file.

**What to do.** Add `.github/workflows/ci.yml` triggered on `push` and `pull_request`
(use `actions/setup-node` with `cache: npm`):

1. `npm ci`
2. `npx tsc -p tsconfig.json --noEmit` — the build never type-checks, so CI must
3. `npx tsc -p tsconfig.jest.json --noEmit` — keeps the tests themselves type-sound
4. `npm test`
5. `npm run build` followed by `git diff --exit-code code_cards/`

That last line is the quiet hero: it converts "remember to regenerate `code_cards/`
after editing `src/`" from an honour-system rule into a hard failure, and implicitly
asserts the build is deterministic. **Verified ready:** on the current checkout the
build reproduces the committed output byte-for-byte, so this gate can be enabled
without a preparatory sync-up commit. (It stays deterministic because `npm ci` pins
the TypeScript version via `package-lock.json`.)

Run on maintained LTS lines: **Node 22 and 24**. (BUILD.md's "v18+" is stale — Node 18
and 20 are both past end-of-life as of April 2026. Local dev is currently on v26,
which is fine; CI should track LTS.) Add a status badge to `README.md`.

Do **not** add a coverage step yet — until step 5 lands, coverage output is a
meaningless 0% and institutionalising it in CI would train everyone to ignore it.

**Red.** CI infrastructure gets the break-it treatment: on a scratch branch, push four
deliberately broken commits — a type error, a failing test, a `src/` edit without
rebuilding `code_cards/`, and a broken build — and confirm each one turns the workflow
red for the right reason. Then revert the branch.

**Green.** The workflow passes on `main`.

**Docs.** Replace BUILD.md's aspirational "CI/CD Considerations" section with the real
workflow; fix the stale "Node v18+" prerequisite; add the badge to README.md.

**Done when:** a PR that breaks types, tests, the build, or forgets to regenerate
`code_cards/` cannot merge green — and each failure mode has been seen to fail once.

---

### Step 2 — Finish the build-script tests (two-thirds landed in PR #4) ✅

> **Done — `5e17a09`.** Exactly as specified: the diagnostics test was seen
> red ("received function did not throw") before the fix; `transpileSource()`
> is the single home of the compiler settings (the three eval-based test
> files import it); the ordering/placeholder invariants are pinned; the
> refactor left `npm run build` byte-identical under the committed-output net.

**Why second.** `scripts/build-templates.ts` is the only code that produces the shipped
artifact. When this review began it had zero tests and three verified silent-failure
modes; PR #4 closed two of them properly — `injectJavaScript()` is extracted, exported,
uses replacer functions (verified to preserve `$$`/`$&`/`` $` ``/`$'` byte-for-byte),
throws on a missing placeholder, and has three tests in `tests/build_templates.test.ts`;
`main()` is guarded by `require.main === module`. What remains:

1. **Discarded transpile diagnostics (the third bug — reproduced, still open).**
   `ts.transpile()` accepts a diagnostics array that `transpileTypeScript()` never
   passes. Syntactically invalid source emits mangled JS (5 diagnostics silently
   dropped in the repro) and the build still prints "Templates built successfully!".
   Today the unit tests would *probably* crash on the same garbage — but only for
   files the tests happen to eval, and only if someone runs them.
2. **The transpile function is still not exported**, so the compiler settings
   (`module: none`, `target: ES2022`) remain copy-pasted into all three eval-based
   test files — the settings-drift risk PR #4's injection work didn't touch.
3. **The remaining invariants are unpinned:** nothing asserts that `%COMMON_JS%`
   output precedes `%TEMPLATE_JS%` output, or that both base templates on disk
   contain each placeholder exactly once inside a `<script>` block at the end of the
   body — the documented guarantees nothing currently enforces.

**Refactor first (under a net).** Export the transpile function (e.g.
`transpileSource(source, fileName): string`, taking source text so tests can feed it
strings) alongside `injectJavaScript()`, keeping file I/O in `main()`. The refactor
must leave `npm run build`'s output byte-identical, which the committed `code_cards/`
verifies via `git diff --exit-code code_cards/`.

**Red.** Extend `tests/build_templates.test.ts`:

- syntactically invalid TS source throws instead of emitting garbage *(fails today)*
- `%COMMON_JS%` output precedes `%TEMPLATE_JS%` output *(passes — pins the guarantee)*
- both base templates on disk carry both placeholders exactly once, `<script>` at the
  end of the body *(passes — pins the invariant)*

**Green.** Pass the diagnostics array to `ts.transpile` and throw if it comes back
non-empty. (Verified: the array collects 5 diagnostics for garbage input that
currently sails through.)

**Why this step matters beyond the bug:** the exported `transpileSource()` becomes the
*single* home of the compiler settings. Step 4's shared test helper will import it, so
tests can never again drift from the build's real settings — and step 3's e2e test will
build its templates through the real transpile-and-inject code, not a copy of it.

**Docs.** BUILD.md's "What the build does NOT do" (it will then fail on syntax errors)
and troubleshooting sections; the pipeline notes in
`documentation/architecture-diagrams/02-build-pipeline.md` if the script's shape
changes further.

**Done when:** the diagnostics test was seen red before its fix; the compiler settings
exist in exactly one place; `npm run build` output is unchanged.

---

### Step 3 — Add an end-to-end card lifecycle test ✅

> **Done — `86fb9e9`.** Four scenarios (the plan's two plus
> back-without-front and no-Hint), built through step 2's exports, flipped
> exactly as Anki does. Proven able to fail four ways: sabotaged
> `revealAnswer`, deleted placeholder, broken `storeInput`, removed
> `window.data` assignment. The eval approach hit no fidelity wall, so the
> `runScripts: "dangerously"` variant was never needed — which settled step
> 7's jsdom decision as "drop it".

**Why third.** Every existing test exercises one function against a hand-built DOM
fragment. Nothing tests the system the way Anki uses it: rendered fields, scripts
executing after the card content, `window.data` surviving a card flip, the back
template re-rendering `{{Front}}` and grading the recreated inputs. This mechanism is
the most subtle part of the architecture and the least protected. A broken base
template sails through the current suite untouched.

**Feasibility is proven.** A working prototype of exactly this test was built and run
during the validation pass for this plan (two scenarios, ~0.5s, passing — see the
log). The mechanics that make it work, worth writing down because two of them are
non-obvious:

- **Scripts must be extracted and eval'd.** Setting `document.body.innerHTML` does not
  execute `<script>` tags, so the test splits the built HTML into body and script
  text, sets the body, then runs the script with `window.eval(...)`.
- **Strict-mode eval scoping is fine here — but know why.** The built script begins
  with `"use strict"`, so under `eval()` its function declarations stay scoped to the
  eval instead of becoming globals (unlike a real `<script>` tag, where they become
  globals even in strict mode). This doesn't matter: each side's script is evaluated
  as one self-contained unit, its `initialize*()` runs inside the eval, and the only
  state that must cross the flip — `window.data` — is assigned to `window`
  *explicitly*. Verified end-to-end in the prototype.
- **jsdom's `readyState` is `"complete"` during tests**, so
  `setupDOMContentLoaded()` callbacks (`setInputAttributes`, `placeCursor`) run
  synchronously and are exercised by the test.

**What to do.** Add `tests/integration.test.ts`:

1. Build both templates in-memory via step 2's exported functions.
2. Substitute Anki fields with a small fixture-driven mustache substitute
   (`{{Field}}` plus `{{#Field}}...{{/Field}}` conditionals — a two-regex function
   sufficed in the prototype). The fixture front should contain at least two
   `<input name="...">` fields, one with smart quotes in the name.
3. Load the front: set body, eval script, then type into the inputs (set `.value`,
   dispatch `input` events) and press Enter against a `window.pycmd` mock.
4. Flip exactly as Anki does: same window, fresh DOM — replace `body.innerHTML` with
   the substituted back HTML (whose `{{Front}}` renders the inputs fresh and empty)
   and eval the back's script.
5. Assert end-to-end: correct answers green with the expected value bolded in, the
   smart-quote/straight-quote pair green (pins the recently fixed grading bug at the
   system level), `pycmd` called with `"ans"`, tags prettified into
   `#content_tag_left`, link text set, back hint `shown`.

Second scenario (also prototyped): flip *without* typing — everything grades red,
nothing throws. Add a third for a card with no Hint field (conditional block absent).

**Red.** This is a regression net, so it starts green. Prove it can fail: temporarily
sabotage `revealAnswer`'s comparison, then a placeholder in a base template — the test
must go red for both. Revert.

**Optional higher-fidelity variant.** The currently-unused direct `jsdom@26` dependency
supports `new JSDOM(html, { runScripts: "dangerously" })`, which executes `<script>`
tags as real classic scripts (globals and all) — closer still to Anki's webview. If the
eval approach ever hits a fidelity wall, switch to it; and if you adopt it, step 7's
"drop the direct jsdom dep" flips to "keep it and actually use it". Decide there.

**Docs.** BUILD.md's "Test Architecture" and CLAUDE.md's "Testing" sections currently
describe the transpile-and-eval unit pattern as the whole story — add the integration
layer. Mention the strict-eval scoping nuance so nobody "fixes" it.

**Done when:** breaking any of the base templates, the placeholder injection,
`storeInput`, the flip mechanism, or `revealAnswer` turns the suite red — demonstrated,
not assumed.

---

### Step 4 — Consolidate into one shared test harness ✅

> **Done — `0a166ad`.** `tests/helpers.ts` with cached `loadScripts()`;
> polyfills deleted with the suite staying green (the inverted red/green, as
> written); direct `initialize*()` tests added and seen red under sabotage;
> the auto-init side effect **accepted** and documented rather than guarded;
> `clearMocks: true` set. Bonus find: writing the initializer tests exposed a
> pre-existing pollution bug — a non-configurable `document.readyState`
> shadow that silently disabled `placeCursor`/`setInputAttributes` for every
> later test in its file. Fixed.

**Why fourth.** Steps 2–3 added new test files; before the suite grows further, stop
paying the triplication tax. Mostly maintainability, with one genuine correctness fix:
today the compiler settings are copy-pasted into every test file, so a future change to
the build's settings would leave the tests silently validating something the build no
longer produces.

**What to do.**

1. Create `tests/helpers.ts` with a single `loadScripts(...sourceFiles)` that reads,
   transpiles via **step 2's exported `transpileSource()`** (one source of truth),
   caches the transpiled output per file (sources don't change mid-run), and evals into
   the window.
2. **Delete the TextEncoder/TextDecoder polyfills — verified unnecessary.** The full
   suite (27/27) passes with them removed, on both the current stack (Jest 29) and the
   Jest 30 stack from step 7. No relocation to a setup file needed; they're simply
   dead code. *(Red/green here is inverted: delete them, watch the suite stay green.)*
3. Deal with the auto-init side effect: eval'ing `front_template.ts` runs
   `initializeFrontTemplate()`, attaching document-level listeners in every test that
   loads the file — unrequested, and accumulating across tests within a file. Either
   guard the auto-init in source (skip when a test flag is set, letting tests opt in)
   or accept it — but in both cases **write the missing direct tests** for
   `initializeFrontTemplate()` / `initializeBackTemplate()` first (red: they don't
   exist; the back initializer's `if (window.data)` branch has never been directly
   asserted), then refactor the loading under them.
4. While in `jest.config.js`, set `clearMocks: true` (or `restoreMocks: true`) so mock
   state can't leak between tests as the suite grows.

**Docs.** BUILD.md's "Test Architecture" section and test-file table; CLAUDE.md's
"Testing" section (both describe the per-file transpile pattern and the polyfill step
that will no longer exist). BUILD.md's troubleshooting note "Ensure
TextEncoder/TextDecoder polyfills are imported" comes out entirely.

**Done when:** no test file contains its own transpile logic or polyfills; the compiler
settings live in exactly one place (the build script); both `initialize*` functions
have direct tests.

---

### Step 5 — Make coverage real, then enforce it ✅

> **Done — `9e08578`, follow-up `57b9d6d`.** The recipe worked exactly as
> validated: `src/` went from invisible to 100% statements / 97.3% branches,
> line-precise. Ratchet set (src ≥ 95/90/95/95; a floor for `scripts/`), CI
> runs `npm test -- --coverage`, and the gate was tripped deliberately once
> before being trusted. One addition the validation pass couldn't have seen:
> Node 24's V8 counts `.d.ts` files as 0% rows (Node 22's omits them), which
> failed the ratchet in CI only — declaration files are now excluded from
> collection. The Node matrix caught it; local runs could not have.

**Why fifth — and why this is now a small step.** The eval-based pattern is what gives
the tests their ship-code fidelity, and it is exactly why coverage reads 0%: Istanbul
instruments code at Jest's transform stage, and eval'd strings never pass through it.
The original draft of this plan proposed a timeboxed experiment against a structural
rewrite. **The experiment has since been run, and it works** — so this step is now a
recipe, not a research project.

**The verified recipe (V8 coverage + sourceURL).** Three changes, all small:

1. `jest.config.js`: set `coverageProvider: 'v8'` and
   `collectCoverageFrom: ['src/**/*.ts', 'scripts/**/*.ts']` (the latter makes
   never-loaded files appear as 0% instead of being invisible, and keeps the build
   script — already covered via its import-based tests — in the same report).
2. In the step-4 helper, transpile with `inlineSourceMap: true` **and pass the source
   file's absolute path as `ts.transpile`'s `fileName` argument** (so the source map
   points at the real file), then append `\n//# sourceURL=file://<abs path>` to the
   eval'd string. The `file://` prefix matters — it's how Jest's V8 reporter recognises
   the script as a project file.
3. Add `coverage/` to `.gitignore` (verified missing — a stray `--coverage` run
   currently dirties the working tree).

**Verified result:** with this recipe, a scratch test exercising `displayTags` reported
`common.ts` at 90% statements / 100% branches / 66.7% functions, with uncovered lines
17–18 — which is *exactly* the body of the never-called `setLinkText`. Attribution is
line-precise. Verified identically on Jest 29 and Jest 30. Files never eval'd
(`front_template.ts`, `back_template.ts` in that scratch run) correctly showed 0%
rather than disappearing.

**Red → green → ratchet.** Red: before wiring the helper changes, run
`npm test -- --coverage` and keep the baseline table — `src/` files entirely absent
while `build-templates.ts` reports real numbers — as the failing state; also set a
trial `coverageThreshold` above zero for `src/` and watch it fail. Green: apply the recipe;
thresholds pass with real numbers. Then ratchet: set `coverageThreshold` slightly
*below* the observed values and add `npm test -- --coverage` to the CI workflow (this
is the coverage step deliberately deferred from step 1). For ~140 lines of source
across three files, realistic coverage should be near-total, so the ratchet is cheap
to hold. Trip the gate once deliberately (comment out a test, watch CI fail) before
trusting it.

**The structural alternative, for the record.** Authoring `src/` as ordinary importable
modules (tests import functions natively; the build strips exports or bundles an IIFE
via esbuild) would also fix coverage, and additionally give tests typed, refactor-safe
imports. It remains a valid future direction — note that CLAUDE.md's claim that
`module: none` "is what makes `window.data` a true global" slightly overstates things
(`window.data` is assigned explicitly, so an IIFE build preserves the flip mechanism).
But it rewrites the build, the docs, and the diagrams for a benefit the V8 recipe now
delivers at a fraction of the cost. Revisit only if the eval pattern becomes a
bottleneck for other reasons.

**Fallback dignity clause.** If the V8 recipe ever breaks under a future Jest (it
relies on sourceURL attribution behaviour), the fallback is the same as before: make
`make coverage` stop lying — remove it or print a warning. A misleading 0% is worse
than no number.

**Docs.** BUILD.md's testing section (the coverage command gets its warning removed
once this lands — see "current-state docs" below); CLAUDE.md's testing notes; the
Makefile `coverage` target's comment.

**Done when:** `make coverage` reports true per-file numbers; CI fails when coverage
drops below the ratchet; the gate has been seen to trip.

---

### Step 6 — Make type-checking a first-class test layer ✅

> **Done — `b00d86b`, with one deliberate upgrade.** `src/global.d.ts` landed
> as specified and `src/` is cast-free with byte-identical emitted JS (no
> `code_cards/` regeneration needed). The tests, however, do **not** use the
> hand-synced typed accessor sketched below — a hand-maintained interface
> would not notice a renamed `src/` function. Instead they call the functions
> as bare typed globals: the `src/` files are global scripts inside
> `tsconfig.jest.json`'s program, so their real declarations type the call
> sites, and a rename or re-signature fails `tsc` (verified red both ways).
> `make typecheck` + `make check` + the pre-commit hook all landed and were
> each seen to trip. Only justified cast remaining:
> `delete (document as any).readyState` in one test cleanup.

**Why sixth.** The type-checker is the cheapest test suite we own — it passes clean
today and runs in seconds — yet nothing executes it automatically until step 1's CI.
Meanwhile the one piece of state the front and back templates *must* agree on,
`window.data`, is accessed everywhere through `(window as any)`: the most
contract-critical value in the system is the one value with no contract. (The other
gap this step originally covered — `scripts/` being type-checked by no tsconfig — was
closed mid-review by PR #4, which added it to `tsconfig.jest.json`.)

**What to do.**

1. Add `src/global.d.ts`:

   ```ts
   interface Window {
     data?: Record<string, string>;
     pycmd?: (command: string) => void;
   }
   ```

   **Verified:** this file plus cast-free usage (`window.data = {...}`,
   `window.pycmd?.("ans")`) compiles clean under both tsconfigs as-is — no config
   changes needed (the d.ts is a global script, so the `Window` interface merges).
2. Delete the `(window as any)` casts in `src/` that this makes unnecessary.
3. In tests, replace untyped `(window as any).functionName()` calls with a typed
   accessor in the step-4 helper — so a renamed or re-signatured function breaks tests
   at compile time, not silently at runtime.
4. Add a `typecheck` target to the Makefile, include it in `make check`, and add a
   `tsc --noEmit` hook to `.pre-commit-config.yaml`, so type errors are caught at
   commit time rather than first surfacing in CI.

**Red.** Temporarily give one function a wrong signature at a call site — confirm
`make typecheck` and the pre-commit hook both catch it; revert. (The gate must be seen
to trip.)

**Docs.** CLAUDE.md's Development Commands (new `typecheck` target and what `make
check` now covers) and its `(window as any)` mentions; BUILD.md's pre-commit and
troubleshooting sections; `.pre-commit-config.yaml` is self-documenting but CLAUDE.md
lists its hooks — update that list.

**Done when:** `grep -r "as any" src/ tests/` returns (near) nothing; a type error
cannot reach a commit, let alone a merge.

---

### Step 7 — Dependency and config hygiene ✅

> **Done — `2cc8b7c`.** Jest 30 upgrade clean (42/42 unmodified, thresholds
> pass — `scripts/` coverage even reads higher under Jest 30's V8); direct
> `jsdom` dropped (step 3 settled the decision); prettier **uninstalled**
> (the "decide" call — wiring it can be revisited if contributors multiply);
> `private: true`, `engines`, `.nvmrc` added. Superseded in part by the
> post-plan Node 24 consolidation (`08eb1f0`): `engines` is now `">=24"`,
> `.nvmrc` says 24, and `@types/node` is ^24.

**Why seventh.** None of these block anything, but each is a small lie the toolchain
tells: types that describe a Jest we don't run, a jsdom we don't use, a formatter that
formats nothing.

**What to do.**

1. **Upgrade Jest to 30 — verified safe.** The upgrade was dry-run in an isolated copy
   of this repo: `jest@30` + `jest-environment-jsdom@30` + the existing
   `@types/jest@30` + `ts-jest@29.4.x` (whose peer range explicitly allows Jest
   `^29 || ^30`) — **the full suite passes unmodified** (re-run after PR #4 merged:
   27/27, including the import-based build tests under ts-jest), and the Jest 30
   environment bundles `jsdom@26.1.0`. This resolves the current types/runtime
   major-version split in the forward direction. The suite itself is the red/green
   net: run it before and after.
2. **Drop the direct `jsdom` dependency** — unless step 3 adopted the
   `runScripts: "dangerously"` variant, in which case keep it and note in
   `package.json`-adjacent docs why it exists. (Today nothing imports it; the test
   environment used Jest's bundled copy — after the upgrade, the bundled copy is the
   same major version anyway.)
3. **Decide on prettier.** Either wire it up (a `format` script, a pre-commit hook,
   one reformat commit) or uninstall it. Installed-but-unwired is the worst of both.
4. **Add an `engines` field** (`"node": ">=22"`) and optionally an `.nvmrc`, matching
   what CI actually tests (step 1). Node 18 and 20 — the versions BUILD.md currently
   blesses — are both past end-of-life.
5. **Add `"private": true`** to `package.json` — this is not a publishable package,
   and the field prevents an accidental `npm publish`.

**Docs.** BUILD.md prerequisites (Node version, dependency list); CLAUDE.md if the
jsdom decision lands either way.

**Done when:** every devDependency is either exercised by a script/hook/CI step or
gone; `npm ls jsdom` shows a single story; the suite passes on the upgraded stack.

---

### Step 8 — Stretch goals, once the fundamentals hold ◐

> **Partially done, by design — `1d884d1`.** The property-based tests landed
> (six fast-check tests; both function sabotages seen red; they also forced
> `skipLibCheck` into `tsconfig.jest.json`, since fast-check's declarations
> use subpath type imports that legacy `moduleResolution: "node"` cannot
> follow — a defect the new pre-commit typecheck hook caught in the act).
> The other three items were deliberately **not** implemented, on this
> section's own criteria: Stryker's interaction with the eval pattern is
> unverified, Playwright waits for a jsdom-blind bug to actually bite, and a
> golden snapshot duplicates CI's drift gate.

None of these are required, and none have been validated — they are genuinely
exploratory, in contrast to steps 1–7.

- **Mutation testing (Stryker).** The codebase is ~140 lines of source — a full
  mutation run would take minutes and directly measures whether the tests *assert*
  rather than merely *execute*. Notable because this project already shipped a bug of
  exactly the kind mutation testing exposes: the smart-quote grading asymmetry lived in
  well-trodden code that no test pinned down. Caveat to investigate first: Stryker
  instruments code Jest loads through its transform — the eval-based pattern may hide
  mutants from it, in which case run it against `scripts/` and any import-based tests
  only. Run once manually; automate only if the findings justify it.
- **Property-based tests (fast-check)** for the pure functions: `parseInput` is
  idempotent (`parseInput(parseInput(s)) === parseInput(s)`) and never returns
  whitespace or curly quotes; `prettifyTag` never emits `::` or `_`. Cheap to write,
  and they explore inputs no example-based test will.
- **A real-browser smoke test (Playwright).** jsdom approximates focus, keyboard
  events, and rendering; Anki's webview is real Chromium (QtWebEngine). One Playwright
  test loading the built front template, typing, and flipping would catch the class of
  bug jsdom structurally cannot (focus/IME/viewport behaviour). Worth it only if a
  jsdom-blind bug actually bites; AnkiDroid/AnkiMobile webviews differ again and stay
  out of scope.
- **Golden-file snapshot of the built HTML.** Largely redundant with step 1's drift
  check, but a Jest snapshot of the built output makes *reviewing* build-affecting
  changes easier — the diff shows up in the PR instead of only failing CI.

---

## Documentation to keep in sync

*(All items below landed with their steps. Beyond this list, execution also
produced a new architecture diagram —
[07-test-and-ci](documentation/architecture-diagrams/07-test-and-ci.md) —
refreshed [03-module-structure](documentation/architecture-diagrams/03-module-structure.md),
and updated the diagrams index and CLAUDE.md's documentation map to say
seven diagrams.)*

Each step above lists its own docs; this is the roll-up view:

- **Step 1:** BUILD.md "CI/CD Considerations" → real workflow; Node prerequisite fix;
  README badge.
- **Step 2:** BUILD.md "What the build does NOT do" + troubleshooting;
  `documentation/architecture-diagrams/02-build-pipeline.md`.
- **Steps 3–4:** BUILD.md "Test Architecture" + CLAUDE.md "Testing" gain the
  integration layer and lose the polyfill/per-file-transpile descriptions.
- **Step 5:** remove the coverage warnings (added to BUILD.md/CLAUDE.md during this
  review — see below); document the V8 recipe where the test architecture is described.
- **Steps 6–7:** CLAUDE.md commands and gotchas; BUILD.md prerequisites and pre-commit
  list.

**Current-state docs updated as part of this review** (because the finding is true
*now*, not only after the plan executes): CLAUDE.md's "Known Limitations & Gotchas"
and BUILD.md's testing section now warn that `--coverage` reports a meaningless 0%
until step 5 lands, and CLAUDE.md's Documentation Map now lists the two improvement
plans.

---

## Suggested sequencing

*(As executed: the multi-PR split below was collapsed into a single branch —
PR #5 — with one commit per step, which preserved the same reviewability
per-change while keeping the whole track in one place. CI from step 1's
commit guarded every later commit on the branch, serving the same purpose
the PR split was designed for.)*

- **PR 1:** Step 1 alone — small, self-contained, immediately protective.
- **PR 2:** Step 2 remainder (diagnostics fix, `transpileSource` export, invariant
  tests) — CI from PR 1 guards it.
- **PR 3:** Step 3 (integration test), building on step 2's exports.
- **PR 4:** Steps 4 + 6 together — helper consolidation and typing touch the same files.
- **PR 5:** Step 5 — the verified coverage recipe, then the ratchet and the CI
  coverage step.
- **PR 6:** Step 7 housekeeping; step 8 items individually, as appetite allows.

After each PR: `make check`, regenerate `code_cards/` if source changed, and update
the docs listed in the step.

---

## Appendix — validation log

All checks run 2026-07-02 on this repo (Node v26.4.0, Jest 29.7, TypeScript 5.8),
during the review pass that produced this revision of the plan.

**Mid-review merge:** PR #4 landed while this review was underway (it squash-merged
this branch's earlier work: the smart-quote grading fix plus build-script hardening).
Everything re-checkable was re-verified on the post-merge tree — suite 27/27, both
tsconfigs exit 0, build deterministic with `code_cards/` in sync, polyfill deletion
still green, Jest 30 still green. Rows below note where results changed.

| Claim | How verified | Result |
|-------|-------------|--------|
| Coverage is blind for eval'd code | `npx jest --coverage`, before and after the merge | Pre-merge: 0% with no per-file rows, 24/24 passing. Post-merge: `src/` files still produce **no rows at all**, while the import-based build tests give `build-templates.ts` real numbers (41% stmts) — the mechanism demonstrated in one table |
| Both tsconfigs type-check clean | `tsc --noEmit` per config, real exit codes (no pipes) | Exit 0, no diagnostics, both configs (re-verified post-merge) |
| Build is deterministic and `code_cards/` is in sync | `npm run build` + `git status --porcelain code_cards/` on the post-merge tree | Clean — drift gate enableable today |
| `String.replace` corruption (originally step 2, bug a) | Node one-liner | `"a $$ b $& c"` → `"a $ b %X% c"`; replacer-function form preserves it byte-for-byte. Fix of exactly this form landed in PR #4 with tests |
| PR #4's build hardening is sound | Read post-merge `scripts/build-templates.ts` + `tests/build_templates.test.ts`; ran suite | Replacer injection, missing-placeholder throw, `require.main` guard, 3 tests — all present and passing. Diagnostics bug **not** addressed; transpile function **not** exported (settings still duplicated in 3 test files — confirmed by grep) |
| `ts.transpile` discards syntax diagnostics (step 2, remaining bug) | Node repro with invalid source | Mangled JS emitted, no throw; 5 diagnostics collected when an array is passed. Still present in the post-merge build script |
| E2E flip test is feasible as specified (step 3) | Scratch Jest test: in-memory build → field substitution → front eval → type + Enter → `body.innerHTML` flip → back eval | 2 scenarios pass in ~0.5s: green/red grading, smart-quote case, `pycmd("ans")`, tags, link text, hint state |
| Strict-mode eval scoping doesn't break the flip | Same prototype (built script includes `"use strict"`) | `window.data` crosses the flip; all assertions pass |
| TextEncoder/TextDecoder polyfills are vestigial (step 4) | Deleted from all three eval-based test files, ran suite, restored — repeated post-merge | 27/27 pass without them on Jest 29; 27/27 on Jest 30 |
| V8 coverage recipe works (step 5) | Scratch test: `--coverageProvider=v8`, `inlineSourceMap` + `fileName` in transpile, `//# sourceURL=file://…` appended | `common.ts` 90% stmts / 100% branch / 66.7% funcs; uncovered 17–18 = exactly the uncalled `setLinkText` body; unloaded files correctly 0%; identical result on Jest 29 and 30 |
| `global.d.ts` Window augmentation (step 6) | Created d.ts + cast-free scratch usage, ran both tscs, removed | Exit 0 both configs, no config changes needed |
| `scripts/` type-checked by nothing | Inspection of both tsconfig `include` arrays | Was true pre-merge; **fixed by PR #4** (`scripts/**/*.ts` added to `tsconfig.jest.json`) |
| Jest 30 upgrade is safe (step 7) | Full isolated copy in scratchpad: `jest@30` + `jest-environment-jsdom@30` + `ts-jest@29.4`, `npm install`, run suite — re-run with post-merge files | 27/27 pass unmodified (incl. the import-based build tests); bundled `jsdom@26.1.0`; `ts-jest@29.4.11` peer range is `^29 \|\| ^30` |
| `coverage/` not gitignored | Read `.gitignore`; observed stray dir after a `--coverage` run | Confirmed missing; added to step 5 |
| Node 18/20 EOL (CI matrix correction) | Release calendar (18 EOL Apr 2025, 20 EOL Apr 2026) | Matrix corrected to 22 + 24 |

### Execution-time findings (2026-07-02 → 2026-07-05)

Things execution surfaced that the validation pass could not have:

| Finding | How it surfaced | Resolution |
|---------|-----------------|------------|
| `document.readyState` shadowed non-configurably in one test, silently breaking `placeCursor`/`setInputAttributes` for every later test in the file | Step 4's new `initializeFrontTemplate` test failed on focus | Shadow made configurable and removed after the test (`0a166ad`) |
| Node 24's V8 coverage counts `.d.ts` files as 0% rows; Node 22's omits them — the src/ ratchet failed on the Node 24 CI leg only | The 22+24 CI matrix (local Node 22 was green) | `.d.ts` excluded from `collectCoverageFrom` (`57b9d6d`) |
| fast-check's declarations use subpath type imports that `moduleResolution: "node"` cannot resolve | The new pre-commit typecheck hook blocked the step 8 commit | `skipLibCheck: true` in `tsconfig.jest.json` (`1d884d1`) |
| A hand-synced typed accessor (step 6's sketch) would not catch a renamed `src/` function | Design review while implementing step 6 | Bare typed globals via ambient global-script declarations instead — rename/re-signature fails `tsc` (`b00d86b`) |

### Resolution of the remaining assumptions

**Previously flagged as not machine-verified — now resolved:** the GitHub
Actions workflow was validated by real runs, including one genuine failure it
caught correctly (the `.d.ts` coverage divergence) and a green-on-both-legs
history before consolidation to Node 24. **Still unexplored, by choice:** the
structural Route B for coverage (moot — the V8 recipe works in production),
Stryker's interaction with the eval pattern, and the Playwright variant
(both parked per step 8's own criteria).
