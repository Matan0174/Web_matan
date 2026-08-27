/**
 * Turning an Android `intent:` URL into something that can actually be opened.
 *
 * `Linking.openURL` builds an ACTION_VIEW intent from `Uri.parse(url)`, so for
 * `intent://host/path#Intent;scheme=foo;package=com.bar;end` it asks the system
 * for an app registered on the *literal* scheme "intent". Nothing is, so the
 * call always fails. Android's own parser (`Intent.parseUri` with
 * URI_INTENT_SCHEME) reads the `#Intent;…;end` fragment and rebuilds the real
 * target instead; reproducing that here keeps the hand-off working without
 * having to drop down to a native module.
 *
 * This matters exactly where a browser is expected to step aside: OAuth
 * returning to the app that started the login, bank identification, 3-D Secure.
 */

export interface IntentUrl {
  /** Target rebuilt from the intent's own `scheme=` parameter, ready for Linking. */
  targetUrl: string | null;
  /** `package=` — the app the page wants to hand off to, for the failure message. */
  packageName: string | null;
  /** `S.browser_fallback_url`, kept only when it is a plain http(s) address. */
  fallbackUrl: string | null;
}

const INTENT_FRAGMENT = '#Intent;';

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Reads the scheme of a URL — "https" for "https://x", "" for a relative path.
 */
export const getUrlScheme = (url: string): string => {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  return match ? match[1].toLowerCase() : '';
};

/**
 * Schemes this browser deals with itself. Everything else names another app.
 *
 * `javascript:` and `file:` are listed deliberately: they are not documents the
 * WebView renders, but handing them to the OS is worse than useless — a
 * `javascript:void(0)` href on an ordinary link would pop a "no app can open
 * this" alert on every click.
 */
const OWN_SCHEMES = ['http', 'https', 'about', 'data', 'blob', 'javascript', 'file'];

/**
 * Schemes a sign-in popup is *redirected to* as a way of announcing its result,
 * with no app behind them and nothing to render.
 *
 * `storagerelay:` is the one Google's popup OAuth flow uses: the popup is sent
 * to `storagerelay://https/site.com?id=auth…` carrying the credential, and the
 * page that opened the popup reads it back off the handle's location. Handing
 * one of these to the OS as though it were an app is what kills the sign-in —
 * nothing can open it, and the opener never gets to see the URL it was waiting
 * for.
 */
const SIGN_IN_RELAY_SCHEMES = ['storagerelay'];

/** True when the URL is a sign-in flow announcing its result, not a destination. */
export const isSignInRelayUrl = (url: string): boolean =>
  SIGN_IN_RELAY_SCHEMES.includes(getUrlScheme(url));

/** True when the URL is a hand-off to another app rather than a page to load. */
export const isExternalAppUrl = (url: string): boolean => {
  const scheme = getUrlScheme(url);
  return scheme !== '' && !OWN_SCHEMES.includes(scheme) && !SIGN_IN_RELAY_SCHEMES.includes(scheme);
};

/**
 * Parses an Android `intent:` URL. Returns null for anything else.
 *
 * The body is everything between `intent:` and the `#Intent;` fragment — for
 * `intent://scan/#Intent;scheme=zxing;end` that is `//scan/`, which combined
 * with the scheme parameter gives back `zxing://scan/`. A body-less intent
 * (`intent:#Intent;package=…;end`) carries no address at all, so targetUrl
 * stays null and only the fallback is left to try.
 */
export const parseIntentUrl = (url: string): IntentUrl | null => {
  if (getUrlScheme(url) !== 'intent') return null;

  const trimmed = url.trim();
  const fragmentAt = trimmed.indexOf(INTENT_FRAGMENT);
  const body = fragmentAt === -1
    ? trimmed.slice('intent:'.length)
    : trimmed.slice('intent:'.length, fragmentAt);
  const params = fragmentAt === -1
    ? ''
    : trimmed.slice(fragmentAt + INTENT_FRAGMENT.length);

  let scheme: string | null = null;
  let packageName: string | null = null;
  let fallbackUrl: string | null = null;

  for (const part of params.split(';')) {
    if (!part || part === 'end') continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === 'scheme') {
      scheme = value;
    } else if (key === 'package') {
      packageName = value;
    } else if (key === 'S.browser_fallback_url') {
      // Only an ordinary web address is safe to load in the tab; a fallback
      // pointing at yet another scheme would just restart this whole dance.
      const decoded = safeDecode(value);
      if (/^https?:\/\//i.test(decoded)) fallbackUrl = decoded;
    }
  }

  return {
    targetUrl: scheme && body ? `${scheme}:${body}` : null,
    packageName,
    fallbackUrl,
  };
};
