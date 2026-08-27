import {
  FORBIDDEN_KEYWORDS,
  KEYWORD_EXCEPTIONS,
  CIRCUMVENTION_DOMAINS,
} from '../constants/forbidden';

/**
 * Percent-decodes a URL for keyword scanning, falling back to the raw string
 * on malformed input.
 *
 * Without this the non-Latin keywords never fire at all: a search for "סקס"
 * reaches us as ".../search?q=%D7%A1%D7%A7%D7%A1", which contains none of the
 * Hebrew entries in FORBIDDEN_KEYWORDS.
 */
const decodeForScanning = (url: string): string => {
  try {
    return decodeURIComponent(url).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/**
 * True when the keyword occurrence spanning [start, end) sits entirely inside
 * one of the KEYWORD_EXCEPTIONS — the "sex" inside "essex", for instance.
 */
const isExcusedByException = (text: string, start: number, end: number): boolean =>
  KEYWORD_EXCEPTIONS.some(exception => {
    let at = text.indexOf(exception);
    while (at !== -1) {
      if (at <= start && at + exception.length >= end) return true;
      at = text.indexOf(exception, at + 1);
    }
    return false;
  });

/**
 * True when `keyword` appears in `text` at least once outside every exception.
 * Checking each occurrence separately (rather than stripping exceptions from
 * the text first) means an exception can never mask a genuine match that
 * merely overlaps it.
 */
const hasUnexcusedMatch = (text: string, keyword: string): boolean => {
  let at = text.indexOf(keyword);
  while (at !== -1) {
    if (!isExcusedByException(text, at, at + keyword.length)) return true;
    at = text.indexOf(keyword, at + 1);
  }
  return false;
};

/**
 * Checks if a given URL is prohibited by the content filter or manual blacklist.
 */
export const isUrlProhibited = (
  url: string,
  blacklist: string[],
  autoBlockEnabled: boolean
): boolean => {
  if (!url) return false;

  // 1. Predefined Keywords Block
  if (autoBlockEnabled) {
    const haystack = decodeForScanning(url);
    if (FORBIDDEN_KEYWORDS.some(keyword => hasUnexcusedMatch(haystack, keyword))) {
      return true;
    }
  }

  // 2. Circumvention services — blocked whenever the automatic filter is on,
  // since letting one through voids every other rule in this function.
  if (autoBlockEnabled) {
    const proxyHost = extractDomainName(url);
    if (
      proxyHost &&
      CIRCUMVENTION_DOMAINS.some(
        d => proxyHost === d || proxyHost.endsWith('.' + d)
      )
    ) {
      return true;
    }
  }

  // 3. Manual Blacklist Block
  // Both sides go through extractDomainName so the comparison is always
  // hostname-vs-hostname — see the note there about the bypasses a looser
  // parse allows.
  const host = extractDomainName(url);
  if (!host) return false;

  return blacklist.some(domain => {
    if (!domain) return false;
    const cleanDomain = extractDomainName(domain);
    if (!cleanDomain) return false;
    return host === cleanDomain || host.endsWith('.' + cleanDomain);
  });
};

/**
 * Extracts the hostname (e.g. "google.com") from a full URL or a raw domain.
 *
 * The order of the steps matters — it is what keeps the blacklist check in
 * isUrlProhibited from being trivially bypassed:
 *  - the authority is everything before the first `/`, `?` or `#`, so
 *    `blocked.com#x` is not read as the host "blocked.com#x";
 *  - a `user:pass@` prefix is dropped *before* the port, otherwise
 *    `allowed.com@blocked.com` reads as a host matching neither, and
 *    splitting on ":" first would turn `user:pass@blocked.com` into "user";
 *  - only then is the `:port` suffix removed, so `blocked.com:443` still
 *    resolves to "blocked.com".
 */
export const extractDomainName = (input: string): string => {
  let domain = input.trim().toLowerCase();
  if (domain.includes('://')) {
    domain = domain.split('://')[1] || '';
  }
  // Authority only — drop path, query and fragment in a single pass
  domain = domain.split(/[/?#]/)[0];
  // Drop userinfo; must happen before the port is stripped
  if (domain.includes('@')) {
    domain = domain.slice(domain.lastIndexOf('@') + 1);
  }
  domain = domain.split(':')[0];
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }
  return domain;
};

/**
 * The origin of a URL — "https://www.example.com" for any page on that host.
 *
 * Used to stamp `event.origin` on messages relayed between a popup tab and the
 * page that opened it, so it deliberately keeps the `www.` and the port that
 * extractDomainName strips: an origin comparison is exact, and a trimmed one
 * would never match what the page is expecting.
 */
export const getOrigin = (url: string): string => {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/i.exec(url.trim());
  if (!match) return '';
  const authority = match[1];
  // Userinfo is not part of an origin and must not be allowed to pose as one.
  const schemeEnd = authority.indexOf('://') + 3;
  const scheme = authority.slice(0, schemeEnd).toLowerCase();
  let host = authority.slice(schemeEnd);
  if (host.includes('@')) host = host.slice(host.lastIndexOf('@') + 1);
  return scheme + host.toLowerCase();
};

/**
 * Standardizes raw input to a valid URL or translates it to a Google search query.
 */
export const normalizeNavigationUrl = (input: string): string => {
  const target = input.trim();
  if (!target) return 'https://www.google.com';

  // Check if search query or URL
  if (target.includes(' ') || (!target.includes('.') && !target.startsWith('http'))) {
    return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
  } else {
    if (!/^https?:\/\//i.test(target)) {
      return `https://${target}`;
    }
    return target;
  }
};

/**
 * Helper to display only the host domain inside the address bar (unless focused).
 * Decodes percent-encoded Unicode characters (Hebrew, Arabic, etc.) for readability.
 */
export const getDisplayDomain = (url: string, isInputFocused: boolean, urlInput: string): string => {
  if (isInputFocused) {
    // Decode percent-encoded chars so the user sees readable Hebrew in the input
    try {
      return decodeURIComponent(urlInput);
    } catch {
      return urlInput;
    }
  }
  try {
    let domain = url;
    if (domain.includes('://')) {
      domain = domain.split('://')[1];
    }
    domain = domain.split('/')[0];
    // Decode IDN / percent-encoded Unicode domains for display
    try {
      return decodeURIComponent(domain);
    } catch {
      return domain;
    }
  } catch {
    return url;
  }
};

/**
 * Guesses the filename and extension for a download based on URL, Content-Disposition, and MIME type.
 */
/**
 * Identifies a file from the first bytes of its base64, for downloads that
 * arrive without a usable type.
 *
 * A Blob built by a page often carries no `type`, and with neither type nor a
 * URL to read an extension from, guessDownloadFilename falls back to `.apk` —
 * which would have a PDF saved as an app and offered for installation. The
 * leading bytes of these formats are fixed, so they survive base64 as a fixed
 * prefix and can be recognised without decoding anything.
 */
export const sniffMimeFromBase64 = (base64: string): string | undefined => {
  const head = base64.slice(0, 8);
  if (head.startsWith('JVBERi0')) return 'application/pdf';       // %PDF-
  if (head.startsWith('iVBORw0')) return 'image/png';             // \x89PNG
  if (head.startsWith('/9j/')) return 'image/jpeg';               // \xFF\xD8\xFF
  if (head.startsWith('R0lGOD')) return 'image/gif';              // GIF8
  if (head.startsWith('UEsDB')) return 'application/zip';         // PK\x03\x04
  return undefined;
};

export const guessDownloadFilename = (
  url: string,
  contentDisposition?: string,
  mimeType?: string
): string => {
  let filename = '';

  // 1. Try to extract from Content-Disposition header
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\s*=\s*["']?([^"';\n]+)["']?/i);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].trim();
    } else {
      const filenameStarMatch = contentDisposition.match(/filename\*\s*=\s*utf-8''([^"';\n]+)/i);
      if (filenameStarMatch && filenameStarMatch[1]) {
        try {
          filename = decodeURIComponent(filenameStarMatch[1].trim());
        } catch (e) {}
      }
    }
  }

  // 2. Try to extract from the URL path
  if (!filename && url) {
    try {
      const path = url.split('?')[0].split('#')[0];
      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        filename = decodeURIComponent(lastPart);
      }
    } catch (e) {}
  }

  // Fallback if still empty
  if (!filename) {
    filename = 'downloaded_file';
  }

  // Clean the filename of invalid characters
  filename = filename.replace(/[/\\?%*:|"<>\s]/g, '_');

  // 3. Ensure correct extension based on MIME type (especially for APKs or other binary streams that might save as .bin)
  const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  const currentExt = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

  const mimeToExt: { [key: string]: string } = {
    'application/vnd.android.package-archive': '.apk',
    'application/octet-stream': '.apk', // Often APKs are served as octet-stream
    'binary/octet-stream': '.apk',
    'application/force-download': '.apk',
    'application/x-download': '.apk',
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'video/mp4': '.mp4',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
    'text/html': '.html',
    'text/plain': '.txt',
  };

  const expectedExt = mimeToExt[mimeType?.toLowerCase() || ''];

  // If the file is an APK or we have a solid expected extension
  if (
    mimeType?.toLowerCase() === 'application/vnd.android.package-archive' || 
    (url && url.toLowerCase().includes('.apk')) ||
    (url && url.toLowerCase().includes('expo.dev/artifacts/eas'))
  ) {
    if (currentExt !== '.apk') {
      if (['.bin', '.php', '.html', '.do', ''].includes(currentExt)) {
        if (currentExt) {
          filename = filename.slice(0, -currentExt.length);
        }
        filename = filename + '.apk';
      }
    }
  } else if (expectedExt) {
    if (currentExt !== expectedExt) {
      if (['.bin', '.php', '.html', '.do', ''].includes(currentExt)) {
        if (currentExt) {
          filename = filename.slice(0, -currentExt.length);
        }
        filename = filename + expectedExt;
      }
    }
  }

  // Absolute fallback: If NO extension exists at all, assume APK for Android convenience
  if (!filename.includes('.')) {
    filename += '.apk';
  }

  return filename;
};

