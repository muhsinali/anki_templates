// The contract between the front and back templates (and Anki's webview).
//
// window.data is the one piece of state that crosses the card flip: the
// front assigns it in initializeFrontTemplate(), and the back reads it in
// initializeBackTemplate() only after the input-name signature matches.
// values[i] is what the learner typed into the i-th *named* input, parallel
// to inputNames — positional, so duplicate expected answers on one card each
// keep their own typed value. window.pycmd is injected by Anki's Python
// backend and is absent everywhere else (tests, browsers), hence optional.
// enterKeyHandlerBound prevents the long-lived Anki reviewer webview from
// accumulating duplicate listeners.
//
// This is a global script (no imports/exports), so the interface merges
// into the DOM's Window type for src/, tests/, and scripts/ alike.
interface CardInputData {
  values: string[];
  inputNames: string[];
}

interface Window {
  data?: CardInputData;
  pycmd?: (command: string) => void;
  enterKeyHandlerBound?: boolean;
}
