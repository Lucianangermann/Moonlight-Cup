// Escapes text before it's interpolated into an HTML string that gets
// opened via window.open()/document.write() (the print builders in
// RundeScreen.js and RanglisteScreen.js). Participant name/verein/league
// are free text an admin can set via the API with no format restriction —
// without this, a value like `<img src=x onerror=...>` would execute
// same-origin the next time anyone prints a round sheet or the standings.
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
