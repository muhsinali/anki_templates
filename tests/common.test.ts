// Unit tests for common.ts functions
import { TextEncoder, TextDecoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

// Helper to set up DOM and load common.ts into the existing jsdom window
function setupDom(html: string = '') {
  document.body.innerHTML = html;
  const source = readFileSync(join(process.cwd(), 'src', 'common.ts'), 'utf8');
  const transpiled = ts.transpile(source, { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 });
  // Execute the transpiled code so functions attach to the current window
  (window as any).eval(transpiled);
}

describe('displayTags', () => {
  // Provide a container element where the formatted tag string will be rendered
  beforeEach(() => setupDom('<div id="content_tag_left"></div>'));

  // Tags should be prettified and sorted alphabetically
  test('formats and sorts tags', () => {
    const tags = 'b_a Computing::AI a_c';
    (window as any).displayTags(tags);
    const elem = document.getElementById('content_tag_left');
    expect(elem?.textContent).toBe('Computing - AI, a c, b a');
  });

  // Edge case: no tags should result in an empty string
  test('handles empty string', () => {
    (window as any).displayTags('');
    expect(document.getElementById('content_tag_left')?.textContent).toBe('');
  });
});

describe('prettifyTag', () => {
  // Basic transformation of "::" and "_" characters
  test('replaces :: and underscores', () => {
    expect((window as any).prettifyTag('Code::Hello_World')).toBe('Code - Hello World');
  });
});

describe('setLinkText', () => {
  // When an anchor element is present its text should change to "Link"
  test('sets text when anchor exists', () => {
    setupDom('<a></a>');
    (window as any).setLinkText();
    expect(document.querySelector('a')?.textContent).toBe('Link');
  });

  // Should not throw if the DOM has no anchor element
  test('does nothing without anchor', () => {
    setupDom();
    expect(() => (window as any).setLinkText()).not.toThrow();
  });
});

describe('parseInput', () => {
  // The function normalizes smart quotes and strips all whitespace
  test('normalizes quotes and removes whitespace', () => {
    const input = ' “hello” \n  ‘world’ ';
    expect((window as any).parseInput(input)).toBe('"hello"\'world\'');
  });
});

describe('revealAnswer', () => {
  beforeEach(() => {
    const html = `<input name="A B"><input name="C">`;
    setupDom(html);
  });

  // Correct answers should get a green background; wrong answers should be red
  test('colors inputs and sets values correctly', () => {
    const data = { 'A B': ' A B ', C: 'c' };
    (window as any).revealAnswer(data);

    const inputs = document.querySelectorAll('input');
    // first input should be marked correct
    expect(inputs[0].style.backgroundColor).toBe('rgb(124, 232, 0)');
    expect(inputs[0].value).toBe('A B');
    expect(inputs[0].style.fontWeight).toBe('bold');

    // second input should be marked wrong
    expect(inputs[1].style.backgroundColor).toBe('rgb(240, 128, 128)');
    expect(inputs[1].value).toBe('C');
    expect(inputs[1].style.fontWeight).toBe('bold');
  });
});

describe('placeCursor', () => {
  // When an input exists the cursor should focus on the first one
  test('focuses first input if exists', () => {
    setupDom('<input id="a"><input id="b">');
    (window as any).placeCursor();
    expect(document.activeElement?.id).toBe('a');
  });
});

describe('setupHint', () => {
  // Triggering the hint event should reveal the hint element
  test('a mousedown event should reveal the hint', () => {
    setupDom('<div id="hint"></div>');
    (window as any).setupHint();
    const hint = document.getElementById('hint') as HTMLElement;
    // JSDOM does not expose listeners; trigger events to ensure class changes
    hint.dispatchEvent(new window.Event('mousedown'));
    expect(hint.className).toBe('shown');
  });

  test('a touchstart event should reveal the hint', () => {
    setupDom('<div id="hint"></div>');
    (window as any).setupHint();
    const hint = document.getElementById('hint') as HTMLElement;
    // JSDOM does not expose listeners; trigger events to ensure class changes
    hint.dispatchEvent(new window.Event('touchstart'));
    expect(hint.className).toBe('shown');
  });

});

describe('setInputAttributes', () => {
  // Each input should have attributes that aid code input on mobile
  test('sets attributes on inputs', () => {
    setupDom('<input><input>');
    (window as any).setInputAttributes();
    const input = document.querySelector('input')!;
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });
});

describe('storeInput', () => {
  // Returned object should update whenever an input event fires
  test('stores values on input events', () => {
    setupDom('<input name="x"><input name="y">');
    const store = (window as any).storeInput();
    const inputs = document.querySelectorAll('input');
    inputs[0].value = 'a';
    inputs[0].dispatchEvent(new window.Event('input'));
    inputs[1].value = 'b';
    inputs[1].dispatchEvent(new window.Event('input'));
    expect(store).toEqual({ x: 'a', y: 'b' });
  });
});
