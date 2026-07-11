// Web printing via a hidden <iframe> instead of window.open().
//
// window.open() is blocked by popup blockers (Safari especially) whenever the
// call isn't inside a *direct* user gesture — and react-native-web routes
// button presses through its Touchable responder system, which loses that
// gesture context, plus our auto-print fires only after an async round start.
// An iframe sidesteps both: it's not a popup, and iframe.contentWindow.print()
// needs no gesture, so it works for manual AND automatic prints alike.
export function printHtml(bodyHtml, css = '') {
  if (typeof document === 'undefined') return;

  // Never stack two print frames.
  const prev = document.getElementById('mc-print-frame');
  if (prev) prev.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'mc-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
    '<body>' + bodyHtml + '</body></html>'
  );
  doc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 500);
  };
  win.addEventListener('afterprint', cleanup);

  // A tick for layout (tables, fonts) before invoking the print dialog.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (_) {
      cleanup();
      return;
    }
    // Safety net: some browsers never fire afterprint (e.g. print cancelled).
    setTimeout(cleanup, 60000);
  }, 300);
}
