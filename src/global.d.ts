// The contract between the front and back templates (and Anki's webview).
//
// window.data is the one piece of state that crosses the card flip: the
// front assigns it in initializeFrontTemplate(), the back reads it in
// initializeBackTemplate(). window.pycmd is injected by Anki's Python
// backend and is absent everywhere else (tests, browsers), hence optional.
//
// This is a global script (no imports/exports), so the interface merges
// into the DOM's Window type for src/, tests/, and scripts/ alike.
interface Window {
  data?: Record<string, string>;
  pycmd?: (command: string) => void;
}
