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
 */
export const getDisplayDomain = (url: string, isInputFocused: boolean, urlInput: string): string => {
  if (isInputFocused) return urlInput;
  try {
    let domain = url;
    if (domain.includes('://')) {
      domain = domain.split('://')[1];
    }
    domain = domain.split('/')[0];
    return domain;
  } catch {
    return url;
  }
};
