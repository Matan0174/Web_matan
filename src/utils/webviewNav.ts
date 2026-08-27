import { WebView } from 'react-native-webview';

/**
 * Navigates a WebView to `url` via injected JS instead of changing the
 * `source` prop (which would reset the navigation stack — see BrowserTab.initialUrl).
 *
 * Uses JSON.stringify instead of manual string interpolation: `url` is
 * user-controlled input, and a raw `window.location.href = '${url}'` lets a
 * value containing a quote break out of the string literal and run
 * arbitrary JS inside the WebView.
 */
export const injectNavigate = (ref: WebView | null | undefined, url: string) => {
  if (!ref) return;
  ref.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
};

/**
 * Calls one of the popup-bridge hooks inside a WebView.
 *
 * `fnName` is always a literal from this codebase, never page input. The
 * arguments are not: they carry whatever a page passed to postMessage, so they
 * go in as JSON rather than as interpolated text — otherwise a popup could
 * close the string and run its own code inside the opener's page.
 *
 * JSON.stringify leaves U+2028/U+2029 raw, and those are line terminators to
 * older JS parsers, which would break the injected statement in two.
 */
export const injectHookCall = (
  ref: WebView | null | undefined,
  fnName: string,
  args: unknown[]
) => {
  if (!ref) return;
  const encoded = args
    .map(arg => {
      const json = JSON.stringify(arg === undefined ? null : arg);
      return (json === undefined ? 'null' : json)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    })
    .join(', ');
  ref.injectJavaScript(
    `if (typeof ${fnName} === 'function') { ${fnName}(${encoded}); } true;`
  );
};

/**
 * Restores a saved scroll position inside a WebView after a blocked
 * navigation is reverted.
 *
 * The scroll coordinates ultimately come from a `postMessage` sent by page
 * JS (see SCROLL_TRACKING_JS) — a page can call
 * `window.ReactNativeWebView.postMessage` directly with any payload, so the
 * values must never be trusted as plain numbers and interpolated as-is.
 * Coercing through `Number()` guarantees the interpolated text can't contain
 * a quote or any other character capable of breaking out of the script.
 */
export const injectScrollRestore = (
  ref: WebView | null | undefined,
  pos: { x: number; y: number } | undefined,
  delayMs: number
) => {
  if (!ref || !pos) return;
  const x = Number(pos.x);
  const y = Number(pos.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  setTimeout(() => {
    ref.injectJavaScript(`window.scrollTo(${x}, ${y}); true;`);
  }, delayMs);
};
