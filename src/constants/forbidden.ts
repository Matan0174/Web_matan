/**
 * Keywords blocked by the automatic adult-content filter.
 *
 * Matching is by SUBSTRING against the decoded, lower-cased URL, so each entry
 * already covers everything built around it: "porn" catches pornhub, porndub,
 * pornhub4k, hqporner and the rest, which is why none of those need their own
 * entry. Keep this list to the shortest distinct stems.
 */
export const FORBIDDEN_KEYWORDS = [
  'porn', 'xvideos', 'adult', 'sex', 'xxx', 'redtube',
  'xhamster', 'hentai', 'stripchat', 'chaturbate', 'onlyfans',
  'playboy', 'beeg', 'סקס', 'פורנו',
];

/**
 * The Scunthorpe problem: ordinary words that happen to contain a keyword.
 * A keyword match is ignored when it falls entirely inside one of these, so
 * essex.ac.uk and adulteducation.org load normally while sex.com and
 * adultfriendfinder.com stay blocked.
 *
 * Only the matched span itself is exempted, so nothing can hide behind an
 * exception — "essexxx.com" still trips the "xxx" keyword.
 */
/**
 * Services that fetch a page on the user's behalf and hand back its content,
 * so the address the browser sees is theirs rather than the site's.
 *
 * These defeat a URL-based filter completely and with no effort: routing
 * anything through a web proxy, a translation service or a cache means the
 * filter only ever judges the intermediary's own, entirely respectable,
 * domain. Blocking the intermediaries is the only URL-level answer.
 *
 * Matched as domains (including subdomains), not as keywords.
 */
export const CIRCUMVENTION_DOMAINS = [
  // Translation services double as full-page proxies
  'translate.google.com',
  'translate.yandex.com',
  'translate.yandex.ru',
  // Caches and archives
  'webcache.googleusercontent.com',
  'archive.org',
  'web.archive.org',
  'archive.ph',
  'archive.today',
  'archive.is',
  'cachedview.nl',
  // Web proxies
  'croxyproxy.com',
  'croxyproxy.rocks',
  'proxysite.com',
  'hide.me',
  'kproxy.com',
  'hidester.com',
  '4everproxy.com',
  'blockaway.net',
  'plainproxies.com',
  'proxyium.com',
  'unblockit.dev',
  'zalmos.com',
  'whateverorigin.org',
  // Text-extraction readers that strip a page out of its origin
  '12ft.io',
  'textance.com',
];

export const KEYWORD_EXCEPTIONS = [
  // "sex"
  'essex', 'sussex', 'wessex', 'middlesex', 'unisex', 'sexton',
  'expertsexchange',
  // "adult"
  'adulthood', 'adulting', 'adultery', 'adulteducation', 'adult-education',
  'youngadult', 'young-adult',
  // "beeg"
  'beegees',
];
