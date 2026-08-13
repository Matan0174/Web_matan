import { useState, useRef, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BrowserTab } from '../types/browser';

const DEFAULT_URL = 'https://www.google.com';

/** Hard cap — refuse to create more tabs than this. */
const MAX_TABS = 50;

/**
 * Rate-limit: if more than RATE_LIMIT_COUNT tabs are created within
 * RATE_LIMIT_WINDOW_MS, block further creation until the window resets.
 * This catches runaway loops from window.open / deep-link spam.
 */
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 2000;

/**
 * Only the WARM_TAB_LIMIT most-recently-active tabs keep a mounted WebView.
 * Every WebView is a heavy native view, so with MAX_TABS as high as 50,
 * mounting all of them at once (previously just hidden with display:none)
 * could exhaust memory on weaker devices. Older tabs are "suspended" —
 * their WebView unmounts and the tab shows a lightweight placeholder until
 * reselected, at which point it remounts fresh at its last known URL.
 */
const WARM_TAB_LIMIT = 6;

export function useTabManager() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: '1', url: DEFAULT_URL, initialUrl: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false, lastActiveAt: Date.now() }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isTabSwitcherOpen, setIsTabSwitcherOpen] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  const viewRefs = useRef<{ [key: string]: View | null }>({});

  // Track parent tab for each new tab (newTabId → parentTabId)
  const tabParentMap = useRef<{ [key: string]: string }>({});

  // Rate-limit tracking — timestamps of recent tab creations
  const recentTabCreations = useRef<number[]>([]);

  const captureActiveTabScreenshot = async (tabId: string) => {
    try {
      const viewRef = viewRefs.current[tabId];
      if (viewRef) {
        const uri = await captureRef(viewRef, {
          format: 'jpg',
          quality: 0.8,
          result: 'tmpfile',
        });
        setTabs(prev =>
          prev.map(t => (t.id === tabId ? { ...t, screenshotUri: uri } : t))
        );
      }
    } catch (e) {
      console.warn('Failed to capture active tab screenshot', e);
    }
  };

  const handleOpenTabSwitcher = async () => {
    await captureActiveTabScreenshot(activeTabId);
    setIsTabSwitcherOpen(true);
  };

  /**
   * Returns true if we should block tab creation due to rate-limiting or
   * hitting the hard cap.  `isUserInitiated` bypasses the rate-limit
   * (the user tapped "+" manually) but still enforces the hard cap.
   */
  const shouldBlockTabCreation = (currentTabCount: number, isUserInitiated = false): boolean => {
    if (currentTabCount >= MAX_TABS) return true;
    if (isUserInitiated) return false;

    const now = Date.now();
    // Prune timestamps outside the window
    recentTabCreations.current = recentTabCreations.current.filter(
      ts => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (recentTabCreations.current.length >= RATE_LIMIT_COUNT) {
      console.warn('[TabManager] Tab creation rate-limited — too many tabs opened in a short window');
      return true;
    }
    return false;
  };

  const recordTabCreation = () => {
    recentTabCreations.current.push(Date.now());
  };

  const handleAddNewTab = async (closeMenu?: () => void, urlToOpen?: string) => {
    if (closeMenu) closeMenu();

    // User-initiated: bypass rate-limit but still enforce hard cap
    // If opened via script (urlToOpen provided), it's not strictly user-initiated in the menu sense,
    // but shouldBlockTabCreation takes `isUserInitiated`. We'll pass `!urlToOpen` or `true`.
    if (shouldBlockTabCreation(tabs.length, !urlToOpen)) return;

    await captureActiveTabScreenshot(activeTabId);
    const newId = Math.random().toString(36).substring(7);
    const startUrl = urlToOpen || DEFAULT_URL;
    const newTab: BrowserTab = {
      id: newId,
      url: startUrl,
      initialUrl: startUrl,
      title: urlToOpen ? 'Loading...' : 'Google',
      canGoBack: false,
      canGoForward: false,
      lastActiveAt: Date.now(),
    };
    // Track parent so hardware back closes this tab and returns to parent
    tabParentMap.current[newId] = activeTabId;
    recordTabCreation();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
  };

  const handleCloseTab = (tabId: string) => {
    const parentId = tabParentMap.current[tabId];
    delete tabParentMap.current[tabId];

    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      const newId = Math.random().toString(36).substring(7);
      setTabs([
        { id: newId, url: DEFAULT_URL, initialUrl: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false, lastActiveAt: Date.now() }
      ]);
      setActiveTabId(newId);
    } else {
      if (activeTabId === tabId) {
        const parentExists = parentId && filtered.some(t => t.id === parentId);
        if (parentExists) {
          setActiveTabId(parentId);
        } else {
          const closedIdx = tabs.findIndex(t => t.id === tabId);
          const fallbackIdx = closedIdx > 0 ? closedIdx - 1 : 0;
          setActiveTabId(filtered[fallbackIdx].id);
        }
      }
      setTabs(filtered);
    }
  };

  const handleCloseAllTabs = () => {
    tabParentMap.current = {};
    const newId = Math.random().toString(36).substring(7);
    setTabs([
      { id: newId, url: DEFAULT_URL, initialUrl: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false, lastActiveAt: Date.now() }
    ]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
  };

  /**
   * Stamp the active tab's `lastActiveAt` whenever it changes, and — if the
   * tab being activated had fallen out of the warm set (i.e. its WebView was
   * suspended) — resync `initialUrl` to its last known `url` so the remount
   * resumes at the right page instead of the tab's original URL.
   */
  useEffect(() => {
    setTabs(prev => {
      const sortedByRecency = [...prev].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
      const wasWarm = new Set(sortedByRecency.slice(0, WARM_TAB_LIMIT).map(t => t.id));
      const now = Date.now();
      return prev.map(t => {
        if (t.id !== activeTabId) return t;
        const isResuming = !wasWarm.has(t.id);
        return {
          ...t,
          lastActiveAt: now,
          initialUrl: isResuming ? t.url : t.initialUrl,
        };
      });
    });
  }, [activeTabId]);

  const warmTabIds = useMemo(() => {
    const sorted = [...tabs].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    const ids = new Set(sorted.slice(0, WARM_TAB_LIMIT).map(t => t.id));
    ids.add(activeTabId);
    return ids;
  }, [tabs, activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || {
    id: '1',
    url: DEFAULT_URL,
    initialUrl: DEFAULT_URL,
    title: 'Google',
    canGoBack: false,
    canGoForward: false,
  };

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    isTabSwitcherOpen,
    setIsTabSwitcherOpen,
    hasLoadedFromStorage,
    setHasLoadedFromStorage,
    viewRefs,
    tabParentMap,
    warmTabIds,
    captureActiveTabScreenshot,
    handleOpenTabSwitcher,
    handleAddNewTab,
    handleCloseTab,
    handleCloseAllTabs,
    shouldBlockTabCreation,
    recordTabCreation,
  };
}
