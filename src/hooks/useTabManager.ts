import { useState, useRef, useEffect, useMemo } from 'react';
import { AppState, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BrowserTab } from '../types/browser';
import { deleteThumbnail, persistThumbnail, pruneThumbnails } from '../utils/tabThumbnails';

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

  // Latest values for timers and listeners that outlive the render they were created in.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  /**
   * Tabs whose currently mounted WebView has finished loading at least once.
   * Capturing before that would replace a good preview with a blank page —
   * e.g. right after a cold start or after a suspended tab remounts.
   */
  const loadedTabs = useRef(new Set<string>());
  /** Per-tab capture counters, so a slow capture can't overwrite a newer one. */
  const captureSeq = useRef<{ [tabId: string]: number }>({});
  const appliedSeq = useRef<{ [tabId: string]: number }>({});
  /** Saved previews not yet visible in `tabs` — protected from pruning. */
  const pendingThumbnails = useRef(new Set<string>());
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledCapture = () => {
    if (captureTimer.current) {
      clearTimeout(captureTimer.current);
      captureTimer.current = null;
    }
  };

  const captureActiveTabScreenshot = async (tabId: string) => {
    const viewRef = viewRefs.current[tabId];
    if (!viewRef || !loadedTabs.current.has(tabId)) return;

    const seq = (captureSeq.current[tabId] || 0) + 1;
    captureSeq.current[tabId] = seq;

    let uri: string;
    try {
      const tempUri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.7,
        result: 'tmpfile',
      });
      uri = await persistThumbnail(tabId, tempUri);
    } catch (e) {
      console.warn('Failed to capture active tab screenshot', e);
      return;
    }

    const isStale = (appliedSeq.current[tabId] || 0) > seq;
    const tabStillOpen = tabsRef.current.some(t => t.id === tabId);
    if (isStale || !tabStillOpen) {
      deleteThumbnail(uri);
      return;
    }
    appliedSeq.current[tabId] = seq;
    pendingThumbnails.current.add(uri);
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, screenshotUri: uri } : t))
    );
  };

  /** Debounced capture of whichever tab is active when the timer fires. */
  const scheduleActiveTabCapture = (delayMs: number) => {
    cancelScheduledCapture();
    captureTimer.current = setTimeout(() => {
      captureTimer.current = null;
      captureActiveTabScreenshot(activeTabIdRef.current);
    }, delayMs);
  };

  /** Called by the WebView container when a tab finishes loading a page. */
  const handleTabLoaded = (tabId: string) => {
    loadedTabs.current.add(tabId);
    if (tabId === activeTabIdRef.current) scheduleActiveTabCapture(800);
  };

  const handleOpenTabSwitcher = async () => {
    cancelScheduledCapture();
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

  const handleAddNewTab = async (
    closeMenu?: () => void,
    urlToOpen?: string,
    /** Present only when the tab is a `window.open` popup rather than one the user asked for. */
    opener?: { tabId: string; popupId: string }
  ) => {
    if (closeMenu) closeMenu();

    // User-initiated: bypass rate-limit but still enforce hard cap
    // If opened via script (urlToOpen provided), it's not strictly user-initiated in the menu sense,
    // but shouldBlockTabCreation takes `isUserInitiated`. We'll pass `!urlToOpen` or `true`.
    if (shouldBlockTabCreation(tabs.length, !urlToOpen)) return;

    cancelScheduledCapture();
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
      openerTabId: opener ? opener.tabId : undefined,
      popupId: opener ? opener.popupId : undefined,
    };
    // Track parent so hardware back closes this tab and returns to parent
    tabParentMap.current[newId] = opener ? opener.tabId : activeTabId;
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

  // A suspended tab's WebView is unmounted, so it must load again before it
  // can be captured.
  useEffect(() => {
    for (const id of Array.from(loadedTabs.current)) {
      if (!warmTabIds.has(id)) loadedTabs.current.delete(id);
    }
  }, [warmTabIds]);

  const activeUrl = tabs.find(t => t.id === activeTabId)?.url;

  // Refresh the preview after switching tabs or navigating (including
  // in-page navigations that never fire onLoadEnd, e.g. SPAs).
  useEffect(() => {
    scheduleActiveTabCapture(1500);
    return cancelScheduledCapture;
  }, [activeTabId, activeUrl]);

  // Capture the moment the app leaves the foreground, so the preview is
  // current even if the app is then killed from the recents screen.
  useEffect(() => {
    const captureNow = () => {
      cancelScheduledCapture();
      captureActiveTabScreenshot(activeTabIdRef.current);
    };
    const changeSub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') captureNow();
    });
    const blurSub = AppState.addEventListener('blur', captureNow);
    return () => {
      changeSub.remove();
      blurSub.remove();
    };
  }, []);

  // Delete previews that were replaced or whose tab was closed.
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    for (const t of tabs) {
      if (t.screenshotUri) pendingThumbnails.current.delete(t.screenshotUri);
    }
    const timer = setTimeout(() => {
      pruneThumbnails(
        uri =>
          pendingThumbnails.current.has(uri) ||
          tabsRef.current.some(t => t.screenshotUri === uri)
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [tabs, hasLoadedFromStorage]);

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
    handleTabLoaded,
    handleOpenTabSwitcher,
    handleAddNewTab,
    handleCloseTab,
    handleCloseAllTabs,
    shouldBlockTabCreation,
    recordTabCreation,
  };
}
