import { extractDomainName } from './urlHelper';

/**
 * Forces the strictest "safe search" setting on the search engines that expose
 * one as a URL parameter.
 *
 * This closes the largest hole in a URL-based filter: the filter can only
 * judge addresses, and a search results page has a perfectly innocent address.
 * A child searching for adult terms on google.com never trips the keyword list
 * or the domain blocklist — the thumbnails simply appear. Forcing SafeSearch
 * makes the search engine itself do the filtering, on content the browser
 * cannot see.
 */

interface SafeSearchRule {
  /** Tested against the hostname with `www.` already stripped. */
  matches: (host: string) => boolean;
  param: string;
  value: string;
}

const RULES: SafeSearchRule[] = [
  // Covers every regional domain: google.com, google.co.il, google.de, ...
  { matches: h => h === 'google.com' || /^google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h), param: 'safe', value: 'active' },
  { matches: h => h === 'bing.com', param: 'adlt', value: 'strict' },
  { matches: h => h === 'duckduckgo.com', param: 'kp', value: '1' },
  { matches: h => h.endsWith('search.yahoo.com'), param: 'vm', value: 'r' },
  { matches: h => /^yandex\.[a-z]{2,3}$/.test(h), param: 'family', value: 'yes' },
];

/** Splits off a trailing #fragment so parameters are appended before it. */
function splitFragment(url: string): [string, string] {
  const hashAt = url.indexOf('#');
  if (hashAt === -1) return [url, ''];
  return [url.slice(0, hashAt), url.slice(hashAt)];
}

/**
 * Returns `url` with the engine's safe-search parameter forced on, or `url`
 * unchanged when it is not a recognised search engine or is already correct.
 *
 * Any pre-existing value of the parameter is stripped first: a user who
 * navigates to `?safe=off` must not end up with both values present, where the
 * engine is free to honour whichever it likes.
 */
export function enforceSafeSearch(url: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return url;

  const host = extractDomainName(url);
  const rule = RULES.find(r => r.matches(host));
  if (!rule) return url;

  const [base, fragment] = splitFragment(url);

  // Only act on URLs that actually carry parameters — i.e. a search, not the
  // engine's landing page. Rewriting the bare homepage would cost every new
  // tab an extra navigation for no gain, since the search it leads to is
  // itself enforced a moment later.
  if (!base.includes('?')) return url;

  // Already exactly right — leave it alone so we never re-navigate in a loop.
  const alreadySet = new RegExp('[?&]' + rule.param + '=' + rule.value + '(&|$)', 'i');
  if (alreadySet.test(base)) return url;

  // Drop any existing value of this parameter, then tidy the separators the
  // removal may have left behind.
  let cleaned = base.replace(new RegExp('([?&])' + rule.param + '=[^&]*', 'gi'), '$1');
  cleaned = cleaned.replace(/([?&])&+/g, '$1').replace(/[?&]$/, '');

  const separator = cleaned.includes('?') ? '&' : '?';
  return cleaned + separator + rule.param + '=' + rule.value + fragment;
}

/** True when `url` is a search engine we can enforce and it is not yet enforced. */
export function needsSafeSearchRedirect(url: string): boolean {
  return enforceSafeSearch(url) !== url;
}
