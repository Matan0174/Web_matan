import { STORAGE_KEYS, getJSON, setJSON } from './storage';

/**
 * Domain filtering through a family-filtering DNS resolver — the same
 * mechanism mobile carriers use, rather than a keyword list maintained by hand.
 *
 * Provider: CleanBrowsing's Family filter. Measured against the alternatives,
 * it blocks pornography, dating sites, and — importantly — web proxies and VPN
 * services, which are the routes that defeat a URL-based filter entirely.
 * Cloudflare for Families blocks only pornography, and is additionally
 * unreachable on some networks that intercept its hostname.
 *
 * It speaks RFC 8484 (binary DNS over HTTPS) rather than the JSON convenience
 * API that only Cloudflare and Google expose, so the query and response are
 * assembled and parsed here by hand. That is the price of not being locked to
 * one provider.
 *
 * PRIVACY: every hostname the user visits is sent to CleanBrowsing. This is
 * inherent to the mechanism — carrier-level filtering works the same way — but
 * it must be surfaced to the user, not buried here.
 */

const FILTERED_DOH = 'https://doh.cleanbrowsing.org/doh/family-filter/';

/**
 * An unfiltered resolver, consulted only to disambiguate an NXDOMAIN.
 * The filtered resolver answers NXDOMAIN both for a domain it blocks and for
 * one that simply does not exist, so a mistyped address would otherwise be
 * reported to the user as "blocked".
 */
const UNFILTERED_DOH = 'https://cloudflare-dns.com/dns-query';

const LOOKUP_TIMEOUT_MS = 4000;

/** Addresses some resolvers return in place of NXDOMAIN to signal a block. */
const BLOCKED_SENTINELS = new Set(['0.0.0.0']);

const TTL_ALLOWED_MS = 24 * 60 * 60 * 1000;
const TTL_BLOCKED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;

export type DnsVerdict = 'allowed' | 'blocked' | 'unavailable';

interface CacheEntry {
  verdict: 'allowed' | 'blocked';
  expiresAt: number;
}
type CacheShape = { [host: string]: CacheEntry };

let cache: CacheShape = {};
let cacheLoaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const inFlight = new Map<string, Promise<DnsVerdict>>();

// ── Wire format ───────────────────────────────────────────────────────────

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** RFC 8484 requires base64url with the padding stripped. */
function base64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63] + B64URL[n & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63];
  }
  return out;
}

/** Builds a standard recursive query for the host's A record. */
function encodeQuery(host: string): Uint8Array {
  const labels = host.split('.');
  let qnameLength = 1;
  for (const label of labels) qnameLength += 1 + label.length;

  const buf = new Uint8Array(12 + qnameLength + 4);
  buf[2] = 0x01; // flags: recursion desired
  buf[5] = 0x01; // qdcount: 1

  let p = 12;
  for (const label of labels) {
    buf[p++] = label.length;
    for (let i = 0; i < label.length; i++) buf[p++] = label.charCodeAt(i);
  }
  buf[p++] = 0; // root label
  buf[p++] = 0; buf[p++] = 1; // QTYPE  A
  buf[p++] = 0; buf[p++] = 1; // QCLASS IN
  return buf;
}

interface DnsResponse {
  rcode: number;
  addresses: string[];
}

const RCODE_NXDOMAIN = 3;

function parseResponse(b: Uint8Array): DnsResponse | null {
  if (b.length < 12) return null;
  const rcode = b[3] & 0x0f;
  const answerCount = (b[6] << 8) | b[7];

  // Skip the question section: QNAME, then QTYPE and QCLASS.
  let p = 12;
  while (p < b.length && b[p] !== 0) p += b[p] + 1;
  p += 5;

  const addresses: string[] = [];
  for (let i = 0; i < answerCount; i++) {
    // A name is either a pointer (top two bits set) or a label sequence.
    if (p >= b.length) break;
    if ((b[p] & 0xc0) === 0xc0) {
      p += 2;
    } else {
      while (p < b.length && b[p] !== 0) p += b[p] + 1;
      p += 1;
    }
    // type(2) + class(2) + ttl(4) + rdlength(2) must all be present.
    if (p + 10 > b.length) break;
    const type = (b[p] << 8) | b[p + 1];
    p += 8; // type, class, ttl
    const rdLength = (b[p] << 8) | b[p + 1];
    p += 2;
    if (p + rdLength > b.length) break;
    if (type === 1 && rdLength === 4) {
      addresses.push(`${b[p]}.${b[p + 1]}.${b[p + 2]}.${b[p + 3]}`);
    }
    p += rdLength;
  }
  return { rcode, addresses };
}

async function resolve(endpoint: string, host: string): Promise<DnsResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpoint}?dns=${base64url(encodeQuery(host))}`, {
      headers: { accept: 'application/dns-message' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseResponse(new Uint8Array(await response.arrayBuffer()));
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────

export async function loadDnsCache(): Promise<void> {
  if (cacheLoaded) return;
  cache = await getJSON<CacheShape>(STORAGE_KEYS.dnsCache, {});
  cacheLoaded = true;
  pruneExpired();
}

function pruneExpired() {
  const now = Date.now();
  for (const host of Object.keys(cache)) {
    if (cache[host].expiresAt <= now) delete cache[host];
  }
  const hosts = Object.keys(cache);
  if (hosts.length > MAX_CACHE_ENTRIES) {
    hosts
      .sort((a, b) => cache[a].expiresAt - cache[b].expiresAt)
      .slice(0, hosts.length - MAX_CACHE_ENTRIES)
      .forEach(host => delete cache[host]);
  }
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    pruneExpired();
    setJSON(STORAGE_KEYS.dnsCache, cache);
  }, 2000);
}

function remember(host: string, verdict: 'allowed' | 'blocked') {
  cache[host] = {
    verdict,
    expiresAt: Date.now() + (verdict === 'blocked' ? TTL_BLOCKED_MS : TTL_ALLOWED_MS),
  };
  schedulePersist();
}

/**
 * Synchronous cache read, for the places that must decide immediately —
 * `onShouldStartLoadWithRequest` has to return a boolean and cannot await.
 * Returns null when this host has not been resolved yet.
 */
export function getCachedVerdict(host: string): 'allowed' | 'blocked' | null {
  const entry = cache[host];
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    delete cache[host];
    return null;
  }
  return entry.verdict;
}

// ── Lookup ────────────────────────────────────────────────────────────────

/**
 * Hosts with nothing to filter on, or that the wire encoder cannot represent.
 * Non-ASCII names would need punycode conversion; they are left to the other
 * filter layers rather than encoded incorrectly.
 */
function isUncheckable(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true;
  if (!/^[\x00-\x7F]*$/.test(host)) return true;
  return false;
}

export async function checkHost(host: string): Promise<DnsVerdict> {
  if (isUncheckable(host)) return 'allowed';

  const cached = getCachedVerdict(host);
  if (cached) return cached;

  const existing = inFlight.get(host);
  if (existing) return existing;

  const lookup = performLookup(host).finally(() => inFlight.delete(host));
  inFlight.set(host, lookup);
  return lookup;
}

/**
 * Returns 'unavailable' — never a silent 'allowed' — when the lookup fails.
 * The caller decides what that means; this module must not quietly downgrade
 * an unanswered question into permission.
 */
async function performLookup(host: string): Promise<DnsVerdict> {
  const filtered = await resolve(FILTERED_DOH, host);
  if (!filtered) return 'unavailable';

  if (filtered.rcode !== RCODE_NXDOMAIN && filtered.addresses.length > 0) {
    const verdict = filtered.addresses.some(a => BLOCKED_SENTINELS.has(a))
      ? 'blocked'
      : 'allowed';
    remember(host, verdict);
    return verdict;
  }

  // NXDOMAIN from the filtered resolver is ambiguous: it means either "this is
  // blocked" or "this does not exist". Ask an unfiltered resolver which it is,
  // so a typo isn't reported to the user as a blocked site.
  const unfiltered = await resolve(UNFILTERED_DOH, host);
  if (!unfiltered) return 'unavailable';

  if (unfiltered.addresses.length > 0) {
    remember(host, 'blocked');
    return 'blocked';
  }

  // Neither resolver knows it — the name really doesn't exist. Let the WebView
  // surface its own network error instead of a filtering verdict.
  remember(host, 'allowed');
  return 'allowed';
}

/** Clears the cache — used when the filter is toggled, so stale verdicts don't linger. */
export async function clearDnsCache(): Promise<void> {
  cache = {};
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await setJSON(STORAGE_KEYS.dnsCache, cache);
}
