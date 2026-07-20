import { FORBIDDEN_KEYWORDS } from '../constants/forbidden';

/**
 * Checks if a given URL is prohibited by the content filter or manual blacklist.
 */
export const isUrlProhibited = (
  url: string,
  blacklist: string[],
  autoBlockEnabled: boolean
): boolean => {
  if (!url) return false;
  const normalizedUrl = url.toLowerCase();

  // 1. Predefined Keywords Block
  if (autoBlockEnabled) {
    if (FORBIDDEN_KEYWORDS.some(keyword => normalizedUrl.includes(keyword))) {
      return true;
    }
  }

  // 2. Manual Blacklist Block
  return blacklist.some(domain => {
    if (!domain) return false;
    const cleanDomain = domain.trim().toLowerCase();
    try {
      let host = normalizedUrl;
      if (host.includes('://')) {
        host = host.split('://')[1];
      }
      host = host.split('/')[0];
      host = host.split('?')[0];
      return host === cleanDomain || host.endsWith('.' + cleanDomain);
    } catch (e) {
      return normalizedUrl.includes(cleanDomain);
    }
  });
};

/**
 * Extracts domain name (e.g. "google.com") from a full URL input.
 */
export const extractDomainName = (input: string): string => {
  let domain = input.trim().toLowerCase();
  if (domain.includes('://')) {
    domain = domain.split('://')[1];
  }
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  domain = domain.split('?')[0];
  domain = domain.split('#')[0];
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }
  return domain;
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
    (url && url.toLowerCase().includes('.apk'))
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

  return filename;
};

