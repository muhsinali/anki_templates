// Property-based tests (fast-check) for the pure functions.
//
// Example-based tests pin known cases; these explore the input space and
// pin the *invariants* the grading pipeline relies on — most importantly
// that answer comparison is insensitive to quote style and whitespace,
// the exact class of bug that once shipped (the smart-quote grading
// asymmetry).
import fc from "fast-check";
import { loadScripts } from "./helpers";

beforeAll(() => {
  loadScripts("common.ts", "back_template.ts");
});

// Strings rich in the characters parseInput cares about: quotes (straight
// and curly), whitespace (incl. NBSP), and code-ish punctuation
const codeChar = fc.constantFrom(
  '"', "'", "“", "”", "‘", "’",
  " ", "\t", "\n", " ",
  "a", "b", "z", "0", "(", ")", "`", "$", "{", "}", ";", ".", ":", "_", "-",
);
const codeString = fc.array(codeChar, { maxLength: 40 }).map((chars) => chars.join(""));

describe("parseInput properties", () => {
  test("is idempotent: normalizing twice equals normalizing once", () => {
    fc.assert(
      fc.property(codeString, (s) => {
        expect(parseInput(parseInput(s))).toBe(parseInput(s));
      }),
    );
  });

  test("output never contains whitespace or curly quotes", () => {
    fc.assert(
      fc.property(codeString, (s) => {
        expect(parseInput(s)).not.toMatch(/[\s“”‘’]/);
      }),
    );
  });

  test("grading is quote-style insensitive: curling any straight quote never changes the result", () => {
    fc.assert(
      fc.property(codeString, (s) => {
        const curled = s
          .replace(/"/g, "“")
          .replace(/'/g, "’");
        expect(parseInput(curled)).toBe(parseInput(s));
      }),
    );
  });

  test("acts as identity on already-normalized strings", () => {
    fc.assert(
      fc.property(codeString, (s) => {
        const normalized = parseInput(s);
        expect(parseInput(normalized)).toBe(normalized);
        // and a string with nothing to normalize passes through untouched
        if (!/[\s“”‘’]/.test(s)) {
          expect(parseInput(s)).toBe(s);
        }
      }),
    );
  });
});

describe("prettifyTag properties", () => {
  // Tag-like strings: hierarchy separators, underscores, and word chars
  const tagChar = fc.constantFrom(":", "_", "a", "B", "3", "-", " ", ".");
  const tagString = fc.array(tagChar, { maxLength: 30 }).map((chars) => chars.join(""));

  test("output never contains '::' or '_'", () => {
    fc.assert(
      fc.property(tagString, (t) => {
        expect(prettifyTag(t)).not.toMatch(/::|_/);
      }),
    );
  });

  test("is idempotent: prettifying twice equals prettifying once", () => {
    fc.assert(
      fc.property(tagString, (t) => {
        expect(prettifyTag(prettifyTag(t))).toBe(prettifyTag(t));
      }),
    );
  });
});
