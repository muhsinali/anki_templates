# Critique from Claude

Review of the Codex changes on `claude/codex-code-review-682224`, performed 2026-07-05.

## Executive summary

Codex's changes are **good work overall**: they faithfully execute the repo's written improvement plan (items 1–19), the runtime behavior changes are well designed (class-based grading, read-only inputs, ARIA labels, wrong-attempt preservation, a stale-data signature guard, a once-per-webview Enter binding, scoped and validated URL handling), and every change landed with meaningful tests. The full local gate — both type-checks, 60 tests with enforced coverage, a byte-identical build, and every pre-commit hook — was green at review start.

The most important problems found:

1. **A broken Mermaid diagram shipped in the Codex commits** — a `;` inside a sequence-diagram note in `04-runtime-data-flow.md` is a statement separator in Mermaid, so the whole runtime-data-flow diagram fails to parse and renders as an error box on GitHub. This was the only outright defect Codex *introduced*. **Fixed and all 12 diagram blocks now verified to render.**
2. **The new `window.data` contract is enforced only at compile time.** The back template now reads `window.data.inputNames.length` from a global that lives in Anki's long-lived webview. A stale value written by the *previous* template version (shape `Record<string, string>`, no `inputNames`) — i.e. exactly the state a user can be in while upgrading — throws a `TypeError` that kills the entire back-side script, including tags and the URL link. **Fixed with a runtime shape guard plus tests.**
3. **Prototype-clashing input names crash the back side** (pre-existing, but untouched by a robustness-focused pass). For a JavaScript practice deck, `<input name="__proto__">` is a plausible card; the plain-object store makes the write a silent no-op and the read returns `Object.prototype`, so `parseInput()` throws and the back side dies. **Fixed with a null-prototype store plus unit and end-to-end tests.**
4. **CI does its heaviest work twice** — the new pre-commit CI step re-runs the type-checks and the Jest suite that dedicated workflow steps run anyway. **Flagged; the maintainer chose to keep the duplication for now** (a `SKIP=typecheck,jest-tests` fix was applied during review, then reverted on request), so `ci.yml` ships unchanged.

Six regression tests were added (suite: 60 → 66, all green); five were demonstrated to fail against the pre-fix code before being trusted, matching the repo's own red-before-green discipline.

*(The maintainer subsequently approved acting on every open item — Node policy, positional grading for duplicate names, coverage ratchet, npm audit, action SHA-pinning, and an mmdr-based diagram render gate. The suite now stands at 70 tests. See "Post-review follow-ups" below.)*

## Repository and change context

- **Current branch:** `claude/codex-code-review-682224` (identical to `origin/claude/codex-code-review-682224`; working tree was clean at review start)
- **Base branch:** `main` (= `origin/main`, at `239eefb`)
- **Comparison point used for "the Codex changes":** `23bc0ba..HEAD`. The branch carries 7 commits over `main`. The first two (`f9634ee`, `23bc0ba` / PR #5) carry `Co-Authored-By: Claude` trailers and session links — that is prior Claude work (the test-infrastructure plan and its execution). The five commits after it have terse messages and no attribution, and are taken to be the Codex work under review:
  - `65c55c1` *add pre commit hook* — codespell + local type-check/jest pre-commit hooks, CI pre-commit step, wholesale rewrite of the 7 architecture diagrams
  - `4f4e837` *update improvement plan* — rewrote `improvement-plan.md` as a scored backlog
  - `8225053` *implement remaining steps in improvement plan* — the substantive change: `src/` behavior changes (grading classes/read-only/feedback/ARIA, URL handling, Enter guard, `window.data` signature), `styling.css` rewrite incl. night mode, template/doc updates, tests
  - `0903eb9` *update node version* — Node 24 → 26.4.0 across CI, engines, `.nvmrc`, docs
  - `48ffbe7` *improve readability and test coverage* — comment-stripping/readability refactor of `src/` and the build script, `buildTemplate` export + test, viewport/styling invariant tests
- **Inferred purpose:** execute the remaining items of `improvement-plan.md` (bugs 3–7, improvements 9 and 13–16, housekeeping 17–19), then a readability/coverage pass.
- **Assumptions / limitations:**
  - Commit attribution is inferred from trailers and message style as described above; all commits are authored under the repo owner's identity.
  - This container runs **Node v22.22.2**, below the repo's new `>=26.4.0` engines floor (npm does not enforce engines here). Everything passes on 22 — see the Node finding — but the CI behavior on an actual Node 26.4.0 runner could not be reproduced locally.
  - Per instructions, **nothing was committed or pushed**; all improvements are uncommitted working-tree changes on the current branch.

## Commands run

| Command | Purpose | Result | Notes |
|---|---|---|---|
| `git status` / `git log` / `git diff main...HEAD` / `git diff 23bc0ba..HEAD` | Establish branch, base, and the Codex diff | OK | Clean tree; 7 commits over `main`, 5 attributed to Codex |
| `npm ci` | Install dependencies | OK | Engines warning expected (Node 22 < 26.4.0 floor) but not enforced |
| `npx tsc -p tsconfig.json --noEmit` / `npx tsc -p tsconfig.jest.json --noEmit` | Type-check (build never type-checks) | Pass (before and after changes) | |
| `npm test -- --coverage` | Test suite + coverage thresholds | Pass — 60/60 before; **66/66 after**; thresholds met both times | src coverage after: 99.58% stmts / 97.75% branches |
| `npm run build` + `git diff --exit-code code_cards/` | Build + CI drift gate | Pass | Build reproduced committed output byte-for-byte before my `src/` changes; regenerated and back in sync after |
| `pip install "pre-commit>=4,<5"` then `pre-commit run --all-files` | The full hook suite CI runs | Pass (before and after changes) | A `SKIP=typecheck,jest-tests` variant was also validated, then reverted at the maintainer's request |
| Temporary cross-version Jest suite (old `main`/`239eefb` templates built from git history via the current `transpileSource`) | Verify `code_cards/` backwards compatibility across the upgrade transition | Pass — 4/4 scenarios | See "Backwards compatibility of `code_cards/`" below; test deleted after running (depends on git history) |
| `mmdc` (mermaid-cli, scratchpad install, preinstalled Chromium) over all 12 ` ```mermaid ` blocks in `documentation/architecture-diagrams/` | Validate the Codex-rewritten diagrams actually render | **1 of 12 blocks failed** (04-runtime-data-flow) → fixed → **12/12 render** | The only tooling not already configured in the repo; used for verification only, not added as a dependency |
| `git stash push -- src/` + `npm test` (then pop) | Prove the new tests fail against pre-fix source | 4 of 66 fail without the fixes | Red-before-green check |
| Targeted revert of the `rawAttempt` hardening + `npm test -- tests/back_template.test.ts` | Prove the non-string test is load-bearing | 1 of 15 fails without the fix | Restored afterwards |

## Findings

### [Severity: Medium] Codex shipped a Mermaid diagram that does not parse

- **Location:** `documentation/architecture-diagrams/04-runtime-data-flow.md:38` (sequence diagram, `Note over Back:` line)
- **Category:** docs
- **Status:** fixed
- **Evidence:** `Note over Back: Front field re-renders; inputs are recreated empty` — in Mermaid, `;` is a statement separator, so the note ends at the semicolon and the trailing text is parsed as a new statement (`Expecting … ARROW …, got 'NEWLINE'`). Confirmed by rendering every diagram block with mermaid-cli: 11 of 12 render, this one fails. `git blame` attributes the line to Codex commit `65c55c1`.
- **Impact:** GitHub renders the entire runtime-data-flow diagram — the one documenting the system's central mechanism — as a parse-error box. The commit that introduced it rewrote all seven diagrams claiming improved readability; nothing in the toolchain checks Mermaid syntax, so this would have shipped silently.
- **Recommendation:** Avoid `;` in Mermaid statement text; consider a CI or pre-commit check that renders the diagram blocks (see next steps).
- **Resolution:** Replaced the semicolon with an em dash. Re-rendered all 12 blocks with mermaid-cli: all pass.

### [Severity: Medium] The new `window.data` shape is trusted at runtime, so a stale pre-upgrade value crashes the whole back-side script

- **Location:** `src/back_template.ts` — `inputSignatureMatches()` / `initializeBackTemplate()`
- **Category:** correctness / reliability
- **Status:** fixed
- **Evidence:** Codex changed the `window.data` contract from `Record<string, string>` to `{ values, inputNames }` and made the back call `inputSignatureMatches(window.data)`, which dereferences `data.inputNames.length`. The only guard was truthiness (`window.data && …`). But `window.data` is a global in Anki's **long-lived reviewer webview**: the immediately previous template version stored the *old* shape (no `inputNames`), and any other script sharing the webview can write the conveniently-named `data` global. With such a value, `inputSignatureMatches` throws `TypeError`, and because grading runs *before* `displayTags()`/`setLinkText()` in `initializeBackTemplate()`, the entire back-side chrome dies with it. Notably, the exact upgrade path this change ships through (review with old front → template update → new back in the same webview) is the realistic trigger.
- **Impact:** One-time hard failure of the back side (no grading, no tags, no link) during template migration; permanent fragility against any non-conforming `window.data` writer. The repo's own stated goal for this code ("skips grading instead of throwing", gotcha 8) is violated for shape mismatches.
- **Recommendation:** Validate the runtime shape before trusting the compile-time contract.
- **Resolution:** Added an `isCardInputData(value: unknown): value is CardInputData` type guard and made `initializeBackTemplate()` use it. No type casts needed (uses `in`-operator narrowing). Unit tests assign stale/partial shapes via `window.eval` (so the tests themselves need no casts, preserving the repo's zero-cast test suite) and were seen red before the fix. After the positional follow-up (`2383ae9`) the guard requires `values` and `inputNames` to both be arrays, which also safely rejects the record-shaped contract that briefly existed on `main` (`48ffbe7`). `CLAUDE.md` (data flow, key functions, gotcha 8) and `BUILD.md` updated to match.

### [Severity: Medium] Prototype-clashing input names (`__proto__`) crash the back side

- **Location:** `src/front_template.ts` — `storeInput()`; `src/back_template.ts` — `revealInputAnswer()`
- **Category:** correctness (pre-existing; not introduced by Codex, but also not caught by a pass focused on exactly this class of robustness)
- **Status:** fixed
- **Evidence:** `values` was a plain object literal. For `<input name="__proto__">`: the front's `values["__proto__"] = input.value` is a **silent no-op** (the inherited `__proto__` setter ignores non-object assignments, even under the templates' `"use strict"`), and the back's `data["__proto__"] ?? ""` returns `Object.prototype` — an object — so `parseInput()` calls `.replace` on a non-string and throws, killing the whole back-side script. The input-name *signature* matches (names are stored in an array), so the new guard does not help. For a **JavaScript practice deck**, `__proto__`/`constructor` are plausible expected answers, which is what elevates this above a curiosity.
- **Impact:** Authoring one such card makes its back side completely non-functional (no grading, no tags, no link), with no error surfaced to the user.
- **Recommendation:** Store attempts in a null-prototype object so every name is a plain own property.
- **Resolution:** `storeInput()` initially created `values` with `Object.create(null)` (verified red-before-green). The follow-up positional refactor (`2383ae9`) supersedes that workaround — values are stored in an array by input position, so prototype-clashing names need no special case at all. The regression tests (front storage, back grading, end-to-end `__proto__` card) were kept and updated to the positional contract.

### [Severity: Medium] CI runs the type-checks and the test suite twice

- **Location:** `.github/workflows/ci.yml` — "Run pre-commit hooks" step vs the four dedicated steps below it
- **Category:** performance / developer experience
- **Status:** acknowledged — maintainer decision to keep as-is
- **Evidence:** Codex's `65c55c1` added `pre-commit run --all-files` to CI. The local hook set includes `typecheck` (both tsconfigs) and `jest-tests` (`npm test`). The workflow then *also* runs `npx tsc` twice, and `npm test -- --coverage`. Net: every CI run executes `tsc` four times and the full Jest suite twice.
- **Impact:** Roughly doubles the expensive portion of every CI run on every push and PR — the dedicated Jest step is strictly stronger (it enforces coverage thresholds; the hook does not).
- **Recommendation:** If CI time ever matters, `SKIP: typecheck,jest-tests` on the pre-commit step is pre-commit's standard mechanism and loses no signal.
- **Resolution:** A `SKIP` fix was applied and verified during the review, then **reverted at the maintainer's request** — the preference for now is to run the hooks in full in CI as well as locally, accepting the duplicate work. `ci.yml` is unchanged in the final diff.

### [Severity: Low] Grading assumed stored attempts are strings

- **Location:** `src/back_template.ts:40` (old) — `const rawAttempt = data[expectedAnswer] ?? ""`
- **Category:** correctness / reliability
- **Status:** fixed
- **Evidence:** Even with the new shape guard, a well-shaped store containing a non-string entry (e.g. `{ values: { A: 42 }, inputNames: ["A"] }`) passes validation and reaches `parseInput(42)`, which throws. The guard checks that `values` is an object, not that its entries are strings.
- **Impact:** Residual crash path for corrupt/foreign state; low likelihood (the writer would also have to match the card's input-name signature), but the fix is one line and makes `revealAnswer` total.
- **Resolution:** Missing **and** non-string entries now both grade as an empty attempt (`typeof storedAttempt === "string" ? storedAttempt : ""`), preserving the documented "untouched inputs grade as wrong, never throw" behavior. New unit test seen red before the fix.

### [Severity: Low] `.codespellrc` whitelists a lockfile hash fragment instead of skipping the lockfile

- **Location:** `.codespellrc` (added by Codex in `65c55c1`)
- **Category:** maintainability
- **Status:** fixed
- **Evidence:** `ignore-words-list = COo, ans`. "COo" appears exactly once in the repo — inside a base64 `integrity` hash in `package-lock.json`. The whitelist entry exists solely to appease codespell on machine-generated content. <!-- codespell:ignore -->
- **Impact:** The next dependency bump regenerates hashes and can introduce a *different* dictionary-word-looking fragment, failing CI on an unrelated change; meanwhile "COo" is globally ignored in real prose too. Spell-checking base64 is noise by construction. <!-- codespell:ignore -->
- **Resolution:** Replaced with `skip = package-lock.json` and dropped `COo` (kept `ans`, which appears legitimately as `pycmd("ans")` throughout code and docs). `pre-commit run --all-files` verified green. <!-- codespell:ignore -->

### [Severity: Low] Node 26.4.0 policy: exact-pinned, pre-LTS, and a floor above demonstrated compatibility

- **Location:** `package.json` (`engines: ">=26.4.0"`), `.nvmrc`, `.github/workflows/ci.yml` (`node-version: "26.4.0"`, job name `Node 26.4.0`) — commit `0903eb9`
- **Category:** maintainability / developer experience
- **Status:** ~~needs human decision~~ → **resolved in follow-up** (maintainer chose option (a): CI on the `26` major, job renamed `checks` — commit `fa81948`; the engines floor was subsequently raised from `>=24` to `>=26` at the maintainer's direction, `a17360a`)
- **Evidence:** The previous (Claude) policy targeted maintained LTS lines with a reasoned matrix. Codex moved everything to exactly 26.4.0. As of 2026-07, Node 26 is a *Current* line (LTS promotion due October 2026). This entire review ran on Node v22.22.2 — every check passes — so the `>=26.4.0` floor excludes runtimes that demonstrably work. The exact CI pin means the runner never picks up 26.x security/bug patches, and the job name `Node 26.4.0` is baked into docs and the branch-protection instructions (`improvement-plan.md` item 20), so every future version bump silently invalidates the required-status-check name.
- **Impact:** Contributor friction (engines warnings on LTS setups), stale CI runtime, and a branch-protection check name that churns with every patch bump.
- **Recommendation:** Pick one: (a) CI on `node-version: 26` (or `lts/*` after October) with a version-agnostic job name like `checks`, and a floor of `>=24` unless a ≥26 feature is actually used; or (b) keep the exact pin but rename the job to something stable and document why 26.4.0 specifically. Update `improvement-plan.md` item 20's required-check name to match whatever is chosen.

### [Severity: Low] Duplicate input names collapse to a single stored value

- **Location:** `src/front_template.ts` — `rememberInput()`; `src/back_template.ts` — `revealInputAnswer()`
- **Category:** correctness (pre-existing design limitation, unchanged by Codex)
- **Status:** ~~needs human decision~~ → **fixed in follow-up** (maintainer chose the positional-contract redesign — commit `2383ae9`, see "Post-review follow-ups")
- **Evidence:** `values` is keyed by input name. Two inputs with the same `name` (the same expected answer appearing twice in a snippet) share one entry; typing into either updates the same key, and both grade from it. An untouched duplicate can grade green because its twin was filled. The new `inputNames` array handles duplicates correctly for the signature check — only the value store collapses.
- **Impact:** Incorrect per-field grading on cards that repeat an expected answer. Plausible for real code snippets (`x` twice on one line).
- **Recommendation:** If worth supporting, key the store by input *index* (the signature already gives a stable ordering) and grade positionally. This is a contract change to `CardInputData` and deliberately out of scope for a review pass; alternatively document it as a card-authoring rule in the README.

### [Severity: Low] README drift: `make check` description and missing upgrade guidance

- **Location:** `README.md` (Development section; Quick Setup step 3)
- **Category:** docs
- **Status:** fixed
- **Evidence:** (a) README said `make check` is "(tests + build)"; it actually runs typecheck + tests + build. (b) Codex's grading rework made the templates *functionally dependent* on `styling.css` (correct/incorrect are now conveyed by `answer-correct`/`answer-wrong`/`answer-feedback` classes rather than inline styles). A user who re-pastes only the two HTML templates into an existing note type gets grading with almost no visual state. Nothing warned about this.
- **Resolution:** Corrected the `make check` description and added a callout to Quick Setup: when updating, re-paste all three files together because the grading feedback relies on `styling.css` classes matching the template JavaScript.

### [Severity: Info] Stale `dist` reference survived the `dist/` retirement

- **Location:** `tsconfig.jest.json` — `"exclude": ["dist", "node_modules"]`
- **Category:** maintainability
- **Status:** fixed
- **Evidence:** Improvement-plan item 19 ("Retire the unused `dist/` output") removed `outDir`, `.gitignore`'s `dist`, and the Makefile reference, and the plan claims "unused `dist/` references removed" — but this exclude entry remained.
- **Resolution:** Removed the dead entry (behavior-neutral; verified by type-check and test run).

### [Severity: Info] Pre-existing: `{{Tags}}` is injected into a JavaScript string literal

- **Location:** `src/front_template.ts` / `src/back_template.ts` — `displayTags("{{Tags}}")`
- **Category:** reliability (self-inflicted breakage, not an exploitable XSS — card content is the author's own)
- **Status:** not fixed (architectural; documented behavior in CLAUDE.md)
- **Evidence:** Anki substitutes fields anywhere, including inside `<script>`. A tag containing `"` or `\` (Anki forbids spaces in tags, but not quotes) produces a syntax error that kills the whole template script.
- **Recommendation:** If it ever bites, render the tag string into a `data-` attribute in the base template and read it from the DOM instead of interpolating into JS source. Not changed here — it alters the base-template contract and the documented architecture.

### Areas reviewed with no issues found

- **Security of the new URL handling** (`setLinkText`, `isHttpUrl`, `replaceTextWithSourceLink`): raw text is linkified only after both a `^https?://` check and a `new URL()` parse with an explicit protocol allow-list, so `javascript:`/`data:` schemes cannot become hrefs; the link is built via `textContent`/`href` property assignment, not HTML strings. Scoping to `#url_container` correctly fixes the old "renames the first `<a>` in the document" bug and is well tested, including the content-anchor preservation case.
- **Security of the new feedback rendering**: wrong attempts are echoed via `textContent` (never `innerHTML`); the existing test proves `<img src=x>` stays inert text. Feedback insertion is idempotent (`removeAnswerFeedback` before re-adding).
- **Grading changes**: class-based marking + `readOnly` + `aria-label` + attempt preservation match the plan; `styling.css` selectors (`input.answer-correct`, `.answer-feedback.*`, `.card.nightMode …`) line up exactly with the classes the JS emits, and a build-time test pins that.
- **Enter-key handling**: the `window.enterKeyHandlerBound` guard genuinely fixes listener pile-up in the persistent webview; `isComposing` correctly ignores IME commits; `window.pycmd?.()` is read dynamically so late injection works.
- **Build-script refactor** (`48ffbe7`): behavior-preserving — the CI drift gate proved the committed output byte-identical before my source changes; `buildTemplate` is now exported and covered by a real temp-workspace test (its `process.chdir` use is safe: Jest files run sequentially per worker, module-load file reads happen before any `chdir`, and `afterEach` restores).
- **Improvement-plan honesty**: every "Done" claim for items 1–19 checks out against the code; item 20 is correctly marked external.
- **CI workflow hygiene** (from the earlier Claude work, preserved by Codex): least-privilege token, concurrency cancellation, drift gate all intact.

Minor observations not worth changes: the tag sort is intentionally host-locale-dependent (`localeCompare` with `undefined` locale), so ordering of accented tags can differ between devices; `revealInputAnswer` deliberately clears author-set inline `background-color`/`font-weight` so grading classes win; GitHub Actions are pinned by major tag rather than SHA (a hardening option, but common practice); the `scripts/` coverage ratchet (60/60/55/60) now sits far below actuals (~94/93/83/94) and could be raised; the `buildTemplate` test prints the script's `console.log` into Jest output.

## Backwards compatibility of `code_cards/`

Verified at the maintainer's request: what happens to existing decks and mid-update webview states when users move from the currently-installed templates (`main`, `239eefb`) to these.

**Method:** a temporary Jest suite built the *actual old templates* out of git history (through the current `transpileSource`/`injectJavaScript`, same compiler settings), rendered a README-style card (two inputs including a smart-quoted name, Hint, Tags, URL field carrying an anchor — the old authoring convention), and exercised the mixed states in one jsdom window, exactly as Anki's long-lived webview would. The suite (4/4 passing) was deleted after running because it reads git history, which would break on shallow clones in CI. *(Re-run after the positional-grading follow-up against **both** historical contracts — `239eefb` flat and `48ffbe7` record-shaped — 5/5 scenarios pass; see "Post-review follow-ups".)*

| Scenario | Result |
|---|---|
| Existing card content on the new templates | ✅ Grades as before — the `name`-attribute contract, `exerciseprecontainer`/`pre` structure, hint, tags, and URL-field anchor all behave; smart-quote grading intact |
| **Old front `window.data` → new back** (the real upgrade moment: webview holds pre-update state) | ✅ The new shape guard skips grading instead of crashing; tags and link still render. *This safety is added by this PR — without the guard, this state threw and blanked the back-side chrome* |
| **New front `window.data` → old back** (reverse mismatch, transient) | ✅ Old back can't see values inside the new shape, so it grades everything red with its inline styles for that one view; no crash |
| Old + old baseline through the same harness | ✅ Sanity check — the harness isn't what makes the mixed states survive |

**JS-engine floor is unchanged.** The old built templates already required ES2020 (`??` appears in the shipped JS, plus `const`/arrow functions). The new ones add `?.` (the same ES2020 revision as `??`) and template literals (ES6) — no newer syntax. Every newly-used API (`Object.create`, `Array.isArray`, `classList`, `insertAdjacentElement`, `localeCompare`, `readOnly`, and `new URL` inside a `try/catch`) long predates that floor, and `KeyboardEvent.isComposing` degrades gracefully where absent (`undefined` → Enter still flips). Any Anki webview that ran the old templates runs these.

**Known degradation (documented, by design):** new templates with a **stale `styling.css`** still grade correctly — inputs lock read-only, values are replaced, and the "Correct" / "Incorrect (you typed: …)" text labels render — but without the color/border styling until `styling.css` is re-pasted (grading moved from inline RGB styles to classes, which is what makes night mode possible). The README's Quick Setup now says to re-paste all three files together. The reverse (new `styling.css`, old templates) is harmless: old inline styles win, extra rules sit unused.

## Improvements applied

**`src/front_template.ts`**
- `storeInput()` creates `values` with `Object.create(null)`.
- Why: prototype-clashing input names (`__proto__`, `constructor`) previously either silently failed to store or read back inherited objects, crashing the back side. Risk reduced: back-template hard failure on legitimate JS-deck cards. Tests: added (unit + integration).

**`src/back_template.ts`**
- Added `isCardInputData()` runtime type guard; `initializeBackTemplate()` validates shape before the signature check (via a local, so narrowing is sound).
- `revealInputAnswer()` treats non-string stored entries like missing ones (empty attempt) instead of passing them to `parseInput()`.
- Why: `window.data` is long-lived webview state — the compile-time contract cannot be trusted at runtime, and the previous template version wrote a different shape. Risk reduced: back-side crash (grading *and* tags/link) on stale or foreign `window.data`. Tests: added (three unit tests, all eval-injected so no type casts).

**`code_cards/front_template.html`, `code_cards/back_template.html`**
- Regenerated via `npm run build` from the changed sources (CI drift gate requirement). Not hand-edited.

**`tests/front_template.test.ts`** — +1 test: prototype-clashing names stored as plain values, live-sync included (red before fix).
**`tests/back_template.test.ts`** — +4 tests: grading from a null-prototype store; stale pre-upgrade `window.data` shape skips grading and still renders tags (red before fix); `window.data` missing `values` skips grading (red before fix); non-string stored value grades as empty attempt (red before fix).
**`tests/integration.test.ts`** — +1 test: full journey for an `__proto__`-named input — store, flip, grade correct (red before fix).

**`.github/workflows/ci.yml`** — unchanged in the final diff. A `SKIP: typecheck,jest-tests` de-duplication was applied and validated during the review, then reverted at the maintainer's request (see the CI finding above).

**`.codespellrc`** — `skip = package-lock.json`; ignore list reduced to `ans`. Why: stop spell-checking base64 hashes; decouple CI from lockfile content churn. Verified with a full pre-commit run.

**`tsconfig.jest.json`** — removed stale `"dist"` exclude entry (completes improvement-plan item 19). Behavior-neutral; type-check verified.

**`documentation/architecture-diagrams/04-runtime-data-flow.md`** — replaced the `;` in the sequence-diagram note with an em dash. All 12 Mermaid blocks in the diagram set verified to render with mermaid-cli.

**`README.md`** — corrected `make check` description (typecheck + tests + build); added the "re-paste all three files together" upgrade callout to Quick Setup.

**`CLAUDE.md`** — data-flow step 3, back-template function list, and gotcha 8 updated to describe the runtime shape guard.

**`BUILD.md`** — "Why `module: none`" data-flow sentence mentions shape validation.

## Tests and validation

- **Tests added:** 6 (1 front unit, 4 back unit, 1 integration). **Tests updated:** none of the existing 60 needed changes — all fixes are behavior-preserving for well-formed state.
- **Suite:** 66/66 passing across 6 suites (was 60/60 at review start).
- **Red-before-green:** with the `src/` fixes stashed, exactly the 4 fix-dependent tests fail; with a targeted revert of the non-string hardening, that test fails alone. (The fifth new back test documents the null-prototype contract and passes either way by design; the integration `__proto__` test was in the stash-failure set.)
- **Checks passing (after changes):** `tsc` on both tsconfigs; `npm test -- --coverage` with thresholds (src: 99.58% statements / 97.75% branches — up from 99.54 / 94.87); `npm run build` with `code_cards/` regenerated and in sync; `pre-commit run --all-files`; mermaid-cli render of all 12 diagram blocks; the temporary 4-scenario cross-version compatibility suite (old `main` templates vs new, mixed webview states).
- **Checks failing:** none locally.
- **Not verifiable here:** an actual GitHub Actions run on Node 26.4.0 (container has Node 22.22.2; engines is warn-only). Everything CI runs was executed locally and passes on 22, which itself informs the Node-floor finding.

## Post-review follow-ups (2026-07-05, maintainer-approved)

The maintainer approved acting on every actionable item. One commit each:

| Item | Outcome | Commit |
|---|---|---|
| Node policy (option a) | CI tracks the Node `26` major line under a version-agnostic `checks` job name; `.nvmrc` 26; all docs (incl. improvement-plan item 20's required-check name) aligned. Initially `engines: ">=24"`; the maintainer later set the floor to **`">=26"`** — the whole codebase targets Node 26+ (`a17360a`) | `fa81948`, `a17360a` |
| Duplicate input names | **Fixed properly**: `CardInputData.values` is now `string[]` parallel to `inputNames` — each input grades against what was typed into *it*. This also supersedes the null-prototype workaround (numeric indices have no prototype clash), and `isCardInputData` now rejects both older contracts in the wild (flat record *and* record-shaped values), so mid-upgrade webview states skip grading safely. Suite 66 → 70 (duplicate-name unit + e2e tests, record-shape stale test); cross-version compatibility re-verified against both `239eefb` and `48ffbe7` templates built from git history (5/5 scenarios) | `2383ae9` |
| Coverage ratchet | global (guards `scripts/`) 60/60/55/60 → 90/90/80/90; `src/` branches 90 → 95 — just below current actuals (~94/93/83 and ~99.6/97.8) | `7b1d8a3` |
| npm audit | All 6 advisories (3 high) fixed within existing semver ranges; `npm audit` now reports 0; suite green on the patched tree | `b8720dc` |
| SHA-pin actions | Done (`6a0096a`), then **reverted at the maintainer's request** — commit hashes in `ci.yml` were not to their taste, so the actions are back on their major version tags (`a17360a`). Trade-off acknowledged: tags are readable but movable | `6a0096a`, reverted in `a17360a` |
| Mermaid render gate | `scripts/check-diagrams.ts` renders all 12 diagram blocks with [mmdr](https://github.com/1jehuang/mermaid-rs-renderer) 0.3.0 (maintainer's pick; ~4s total, binary cached in CI); wired as a CI step and `make diagrams` | `9290ede` |
| Branch protection | **External step for the maintainer** — see instructions in "Suggested next steps"; the `checks` job name is now stable so the rule won't churn. (Attempted via API: the session's GitHub App token gets `403 Resource not accessible by integration` for branch-protection endpoints, so it genuinely needs repo-admin access) | — |
| CI verification on the real runner | The first run caught a regression this review itself introduced: the new gate script's 0% coverage row (it matched `scripts/**` in `collectCoverageFrom`) sank the scripts/ aggregate below the freshly raised ratchet — and the local gate had masked the failing exit code by piping jest into grep. Fixed by excluding the mmdr-dependent CLI from collection (same precedent as the `.d.ts` exclusion), re-verified with `pipefail` on **both** Node 26.4.0 (the CI runtime, downloaded locally to reproduce) and Node 22. The `checks` job is now **green on the real runner**, including the cached-cargo mmdr install | `eb0c4d3` |

**Finding discovered while landing the diagram gate:** mmdr 0.3.0's parser is
more lenient than GitHub's mermaid.js. Probed empirically: it rejects garbage
blocks, unknown diagram types, and dangling flowchart edges, but **accepts**
the `;`-in-note bug that actually shipped (plus `->>>' arrows and unclosed
brackets). So the gate catches structural breakage and render regressions but
is not an exact GitHub preview — documented in the script header, BUILD.md,
and diagram 07. If exactness is wanted, the option is a small Jest-side check
that runs the real `mermaid` npm parser under the existing jsdom environment
(no browser needed, fast) — left as a maintainer decision because it adds a
sizeable devDependency.

## Remaining risks

(Updated after the follow-ups — the Node policy, duplicate-name, audit, and
diagram-gate risks listed in the original review are now resolved; see
"Post-review follow-ups".)

- **`{{Tags}}` inside the script string** remains a latent self-breakage vector for tags containing quotes; the fix touches the base-template contract.
- **Foreign `window.data` writers** are now shape-checked, but a writer that fabricates a fully valid `CardInputData` matching the card's input names can still influence grading — inherent to a shared-webview global and not realistically defensible beyond what's done.
- **The diagram gate is a smoke check, not a GitHub preview:** mmdr's parser is more lenient than mermaid.js in places (it accepts the `;`-in-note bug that shipped). An exact-parser layer via the `mermaid` npm package under jsdom is possible if wanted — new devDependency, maintainer's call.
- **Upgrade coupling** is documented (README callout) but not enforceable — users who update templates without the new CSS get functional-but-unstyled grading; only the small text labels ("Correct"/"Incorrect") survive.
- **CI runs tsc/Jest twice** (pre-commit hooks + dedicated steps) — an acknowledged maintainer preference, kept deliberately.
- **Actions ride movable major tags** (`checkout@v4` etc.) — SHA pins were applied and then reverted as a maintainer preference; readable tags accepted over supply-chain pinning.

## Suggested next steps

(Rewritten after the follow-ups — items 1 and 3–5 of the original list, plus
the duplicate-name fix, have been executed; see "Post-review follow-ups".)

1. **Merge PR #8**, which now carries the review fixes plus all approved follow-ups.
2. **Protect `main`** (the one remaining external step — repository settings, not code):
   - GitHub → Settings → Branches → Add branch ruleset/protection rule for `main`
   - Enable "Require status checks to pass before merging" and select **`checks`** (it appears in the picker after the renamed job's first run on this PR; it can also be typed manually)
   - Enable "Require branches to be up to date before merging"
3. **Decide whether the diagram gate should be GitHub-exact**: keep mmdr-only (fast smoke check, current state), or add a small Jest-side `mermaid.parse()` check under the existing jsdom environment (exact parser GitHub uses, no browser — at the cost of a sizeable `mermaid` devDependency). Reporting the mmdr leniency upstream to `1jehuang/mermaid-rs-renderer` would help too.
4. **If it ever bites**: harden the `{{Tags}}`-in-script pattern by moving the tag string into a `data-` attribute read from the DOM.
