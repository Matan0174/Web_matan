import { useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { BrowserTab } from '../types/browser';
import { isUrlProhibited, normalizeNavigationUrl, getDisplayDomain } from '../utils/urlHelper';

interface UseDeepLinkingParams {
  tabs: BrowserTab[];
  activeTabId: string;
  blacklist: string[];
  autoBlockEnabled: boolean;
  /** Must be true once AsyncStorage has been fully loaded so that
   *  cold-start deep links don't race with the storage restore. */
  hasLoadedFromStorage: boolean;
  shouldBlockTabCreation: (currentTabCount: number) => boolean;
  recordTabCreation: () => void;
  tabParentMap: React.MutableRefObject<{ [key: string]: string }>;
  setTabs: React.Dispatch<React.SetStateAction<BrowserTab[]>>;
  setActiveTabId: (id: string) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsDownloadsOpen: (v: boolean) => void;
  setIsTabSwitcherOpen: (v: boolean) => void;
  setIsPinModalOpen: (v: boolean) => void;
  setIsCurrentUrlBlocked: (v: boolean) => void;
  setUrlInput: (url: string) => void;
}

/**
 * Handles opening the app via a deep link (cold-start `getInitialURL` and
 * warm-start `Linking` `url` events) by opening the target URL in a new tab.
 *
 * Uses a ref so the handler always sees the latest state without causing the
 * subscribing effect to re-run — re-running it was the root cause of a past
 * infinite-tab-creation loop (re-subscribing re-triggers getInitialURL).
 */
export function useDeepLinking({
  tabs,
  activeTabId,
  blacklist,
  autoBlockEnabled,
  hasLoadedFromStorage,
  shouldBlockTabCreation,
  recordTabCreation,
  tabParentMap,
  setTabs,
  setActiveTabId,
  setIsSettingsOpen,
  setIsDownloadsOpen,
  setIsTabSwitcherOpen,
  setIsPinModalOpen,
  setIsCurrentUrlBlocked,
  setUrlInput,
}: UseDeepLinkingParams) {
  const initialUrlHandled = useRef(false);

  const handleDeepLink = useCallback((url: string) => {
    if (!url) return;
    let cleanUrl = url;
    const httpsIndex = cleanUrl.toLowerCase().indexOf('https://');
    const httpIndex = cleanUrl.toLowerCase().indexOf('http://');

    if (httpsIndex !== -1) {
      cleanUrl = cleanUrl.substring(httpsIndex);
    } else if (httpIndex !== -1) {
      cleanUrl = cleanUrl.substring(httpIndex);
    } else {
      if (url.startsWith('web-matan://')) {
        cleanUrl = url.replace('web-matan://', '');
      } else {
        return;
      }
    }

    const normalizedUrl = normalizeNavigationUrl(cleanUrl);
    const isBlocked = isUrlProhibited(normalizedUrl, blacklist, autoBlockEnabled);

    // ── Guard: prevent tab-creation loops ──
    if (shouldBlockTabCreation(tabs.length)) return;

    const newId = Math.random().toString(36).substring(7);
    const newTab: BrowserTab = {
      id: newId,
      url: normalizedUrl,
      initialUrl: normalizedUrl,
      title: getDisplayDomain(normalizedUrl, false, ''),
      canGoBack: false,
      canGoForward: false,
      lastActiveAt: Date.now(),
    };

    tabParentMap.current[newId] = activeTabId;
    recordTabCreation();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setIsSettingsOpen(false);
    setIsDownloadsOpen(false);
    setIsTabSwitcherOpen(false);
    setIsPinModalOpen(false);
    setIsCurrentUrlBlocked(isBlocked);

    if (!isBlocked) {
      setUrlInput(normalizedUrl);
    }
  }, [blacklist, autoBlockEnabled, activeTabId, tabs.length, shouldBlockTabCreation, recordTabCreation, setTabs, setActiveTabId, setIsSettingsOpen, setIsDownloadsOpen, setIsTabSwitcherOpen, setIsPinModalOpen, setIsCurrentUrlBlocked, tabParentMap, setUrlInput]);

  // Keep a stable ref to the latest handleDeepLink so the effect below
  // never re-subscribes (and never re-calls getInitialURL).
  const deepLinkRef = useRef(handleDeepLink);
  useEffect(() => { deepLinkRef.current = handleDeepLink; }, [handleDeepLink]);

  // ── Warm-start listener ──
  // Runs ONCE on mount.  The app is already running and receives a new URL.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) deepLinkRef.current(event.url);
    });

    return () => subscription.remove();
  }, []);

  // ── Cold-start handler ──
  // Deferred until storage has been fully restored so that
  // `loadStorage → setTabs(savedTabs)` doesn't overwrite the deep-link tab.
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    if (initialUrlHandled.current) return;

    Linking.getInitialURL().then(url => {
      if (url && !initialUrlHandled.current) {
        initialUrlHandled.current = true;
        deepLinkRef.current(url);
      }
    });
  }, [hasLoadedFromStorage]);
}
