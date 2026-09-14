import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  BackHandler,
  Linking,
  Share,
  StatusBar as RNStatusBar,
  I18nManager,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Disable RTL to prevent layout from flipping backwards on Hebrew devices
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Types & Utils
import { BrowserTab } from './src/types/browser';
import {
  INJECTED_JAVASCRIPT,
  INJECTED_JS_BEFORE_CONTENT_LOADED,
  buildOpenerBridgeJs,
} from './src/utils/injectedScripts';
import { COLORS } from './src/styles/globalStyles';
import {
  isUrlProhibited,
  normalizeNavigationUrl,
  getDisplayDomain,
  extractDomainName,
  getOrigin,
} from './src/utils/urlHelper';
import { injectNavigate, injectScrollRestore, injectHookCall } from './src/utils/webviewNav';
import { isExternalAppUrl, isSignInRelayUrl, parseIntentUrl } from './src/utils/externalScheme';
import { loadDnsCache, checkHost, getCachedVerdict } from './src/utils/dnsFilter';
import { enforceSafeSearch, needsSafeSearchRedirect } from './src/utils/safeSearch';
import { STORAGE_KEYS, getJSON, getString, setJSON, setString } from './src/utils/storage';
import * as Updates from 'expo-updates';
import {
  getDownloadDirectory,
  chooseDownloadDirectory,
  describeDownloadDirectory,
} from './src/utils/downloadStorage';

// Hooks
import { useTabManager } from './src/hooks/useTabManager';
import { useContentFilter } from './src/hooks/useContentFilter';
import { useDownloadManager } from './src/hooks/useDownloadManager';
import { useHistoryAndBookmarks } from './src/hooks/useHistoryAndBookmarks';
import { useSearchSuggestions } from './src/hooks/useSearchSuggestions';
import { useDeepLinking } from './src/hooks/useDeepLinking';

// Components
import ToolbarHeader from './src/components/ToolbarHeader';
import BlockedScreen from './src/components/BlockedScreen';
import PinModal from './src/components/PinModal';
import TabSwitcherModal from './src/components/TabSwitcherModal';
import DownloadsModal from './src/components/DownloadsModal';
import HistoryModal from './src/components/HistoryModal';
import BookmarksModal from './src/components/BookmarksModal';
import DropdownMenuModal from './src/components/DropdownMenuModal';
import WebViewContainer from './src/components/WebViewContainer';
import SettingsScreen from './src/screens/SettingsScreen';

const DEFAULT_URL = 'https://www.google.com';

export default function App() {
  return (
    <SafeAreaProvider>
      <BrowserApp />
    </SafeAreaProvider>
  );
}

function BrowserApp() {
  const webViewRefs = useRef<{ [key: string]: WebView | null }>({});

  // Navigation / UI loading states
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /**
   * A non-'allowed' verdict from the DNS filter, tagged with the URL it was
   * decided for. Kept as state rather than folded straight into
   * isCurrentUrlBlocked because the effect that recomputes that flag would
   * otherwise clear the DNS decision on its next run.
   */
  const [dnsBlock, setDnsBlock] = useState<{ url: string; reason: 'filter' | 'unverified' } | null>(null);

  /**
   * The two tabs each transferred MessagePort connects — see portBridgeJs.
   * Learned from the postMessage that carried the port, and needed because the
   * traffic afterwards names only the port, not who is on either end.
   */
  const portPairs = useRef<{ [portId: string]: { openerTabId: string; popupTabId: string } }>({});

  /** The folder downloads are exported to, shown in settings so it can be changed. */
  const [downloadDir, setDownloadDir] = useState<string | null>(null);

  // Back navigation & scroll position refs
  const backNavGuard = useRef(false);
  const scrollPositions = useRef<{ [tabId: string]: { x: number; y: number } }>({});

  // 1. Custom Hooks
  const {
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
    handleOpenTabSwitcher,
    handleAddNewTab,
    handleCloseTab,
    handleCloseAllTabs,
    shouldBlockTabCreation,
    recordTabCreation,
  } = useTabManager();

  const {
    savedPin,
    setSavedPin,
    pinInput,
    setPinInput,
    pinMode,
    isPinModalOpen,
    setIsPinModalOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    blacklist,
    setBlacklist,
    autoBlockEnabled,
    setAutoBlockEnabled,
    dnsFilterEnabled,
    setDnsFilterEnabled,
    isCurrentUrlBlocked,
    setIsCurrentUrlBlocked,
    newBlacklistDomain,
    setNewBlacklistDomain,
    saveBlacklist,
    saveAutoBlock,
    saveDnsFilter,
    handleKeyPress,
    handleBackspace,
    handleAddBlacklist,
    handleRemoveBlacklist,
    handleQuickBlockSite,
    openPinModal,
  } = useContentFilter();

  const {
    downloads,
    setDownloads,
    isDownloadsOpen,
    setIsDownloadsOpen,
    handleDownloadStart,
    saveInPageDownload,
    openDownload,
    handleClearDownloads,
  } = useDownloadManager(setIsLoading, setLoadProgress);

  /**
   * Loads `target` in the active tab, keeping the back stack intact.
   *
   * The navigation is driven through the WebView's `source` prop rather than
   * an injected `window.location.href`: a script navigation in a document that
   * has not received a user gesture *replaces* the current history entry
   * instead of pushing one, so typing an address used to wipe the back stack
   * (canGoBack stayed false and Back left the app). `source` goes through the
   * native loadUrl, which pushes normally.
   */
  const loadInActiveTab = (target: string) => {
    setIsCurrentUrlBlocked(false);
    setUrlInput(target);
    setIsInputFocused(false);

    const current = tabs.find(t => t.id === activeTabId);
    if (current && current.initialUrl === target) {
      // The prop would not change, so nothing would load — nudge it in-page.
      injectNavigate(webViewRefs.current[activeTabId], target);
      return;
    }

    // `url` is set optimistically so the address bar shows the destination at
    // once; handleNavigationStateChange corrects it once the page settles.
    setTabs(prev =>
      prev.map(t => (t.id === activeTabId ? { ...t, url: target, initialUrl: target } : t))
    );
  };

  const navigateTo = (url: string) => {
    let target = url.trim();
    if (!target) return;

    setIsInputFocused(false);
    target = normalizeNavigationUrl(target);
    if (autoBlockEnabled) target = enforceSafeSearch(target);

    if (isUrlProhibited(target, blacklist, autoBlockEnabled)) {
      // Only update tab URL via setTabs for blocked URLs (to show blocked screen)
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? { ...t, url: target } : t))
      );
      setIsCurrentUrlBlocked(true);
    } else {
      loadInActiveTab(target);
    }
  };

  const {
    history,
    setHistory,
    isHistoryOpen,
    setIsHistoryOpen,
    handleClearHistory,
    handleHistoryNavigate,
    addHistoryItem,
    bookmarks,
    setBookmarks,
    isBookmarksOpen,
    setIsBookmarksOpen,
    isCurrentPageBookmarked,
    handleToggleBookmark,
    handleRemoveBookmark,
    handleBookmarkNavigate,
  } = useHistoryAndBookmarks(activeTab.url, activeTab.title, navigateTo);

  const { suggestions, handleSelectSuggestion } = useSearchSuggestions(
    urlInput,
    isInputFocused,
    navigateTo,
    setUrlInput
  );

  // 2. Storage loading on mount
  useEffect(() => {
    const loadStorage = async () => {
      try {
        const pin = await getString(STORAGE_KEYS.pin);
        if (pin) setSavedPin(pin);

        setBlacklist(await getJSON<string[]>(STORAGE_KEYS.blacklist, []));

        const autoBlock = await getString(STORAGE_KEYS.autoBlock);
        if (autoBlock !== null) setAutoBlockEnabled(autoBlock === 'true');

        setDownloadDir(await getDownloadDirectory());

        const dnsFilter = await getString(STORAGE_KEYS.dnsFilter);
        if (dnsFilter !== null) setDnsFilterEnabled(dnsFilter === 'true');
        await loadDnsCache();

        setDownloads(await getJSON(STORAGE_KEYS.downloads, [] as typeof downloads));
        setHistory(await getJSON(STORAGE_KEYS.history, [] as typeof history));
        setBookmarks(await getJSON(STORAGE_KEYS.bookmarks, [] as typeof bookmarks));

        const parsedTabs = await getJSON<any[] | null>(STORAGE_KEYS.tabs, null);
        const savedActiveTabId = await getString(STORAGE_KEYS.activeTabId);
        if (parsedTabs && parsedTabs.length > 0) {
          // Every tab remounts on a cold start, so it has to resume at the page
          // it was left on rather than the address it was originally opened at.
          const migratedTabs: BrowserTab[] = parsedTabs.map((t: any) => ({
            ...t,
            initialUrl: t.url || t.initialUrl,
            lastActiveAt: t.lastActiveAt || Date.now(),
          }));
          setTabs(migratedTabs);
          // A saved id that no longer names a tab would leave every tab hidden
          // and the screen blank, so it is only honoured when it still exists.
          const active =
            (savedActiveTabId && parsedTabs.find((t: any) => t.id === savedActiveTabId)) ||
            parsedTabs[0];
          setActiveTabId(active.id);
          setUrlInput(active.url);
        }
      } catch (e) {
        console.error('Failed to load settings from storage', e);
      } finally {
        setHasLoadedFromStorage(true);
      }
    };
    loadStorage();
  }, []);

  // Save tabs and active tab ID whenever they change
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    setJSON(STORAGE_KEYS.tabs, tabs);
    setString(STORAGE_KEYS.activeTabId, activeTabId);
  }, [tabs, activeTabId, hasLoadedFromStorage]);

  // Drop the per-tab state of tabs that have been closed — otherwise refs,
  // scroll positions and port pairings accumulate for the life of the app.
  useEffect(() => {
    const live = new Set(tabs.map(t => t.id));
    for (const id of Object.keys(webViewRefs.current)) {
      if (!live.has(id)) delete webViewRefs.current[id];
    }
    for (const id of Object.keys(viewRefs.current)) {
      if (!live.has(id)) delete viewRefs.current[id];
    }
    for (const id of Object.keys(scrollPositions.current)) {
      if (!live.has(id)) delete scrollPositions.current[id];
    }
    for (const portId of Object.keys(portPairs.current)) {
      const pair = portPairs.current[portId];
      if (!live.has(pair.openerTabId) || !live.has(pair.popupTabId)) {
        delete portPairs.current[portId];
      }
    }
  }, [tabs]);

  useDeepLinking({
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
  });

  // Sync address bar input and block status
  useEffect(() => {
    if (activeTab) {
      if (!isInputFocused) {
        setUrlInput(activeTab.url);
      }
      // Skip re-evaluating block status while the settings screen is open —
      // changing blacklist / autoBlockEnabled from settings would trigger
      // cascading state updates that freeze the UI.
      if (!backNavGuard.current && !isSettingsOpen) {
        // The DNS verdict only counts while the filter is on, so switching it
        // off releases a page it had already blocked instead of stranding the
        // user on the blocked screen.
        const blocked =
          isUrlProhibited(activeTab.url, blacklist, autoBlockEnabled) ||
          (dnsFilterEnabled && dnsBlock !== null && dnsBlock.url === activeTab.url);
        setIsCurrentUrlBlocked(blocked);
      }
    }
  }, [activeTabId, blacklist, autoBlockEnabled, activeTab.url, isInputFocused, isSettingsOpen, dnsBlock, dnsFilterEnabled]);

  // allowRTL only takes hold on the next launch, so on a Hebrew device the
  // very first run after install comes up mirrored. One restart settles it;
  // the stored flag is what keeps that from becoming a restart loop.
  useEffect(() => {
    if (!I18nManager.isRTL) return;
    (async () => {
      if (await getString(STORAGE_KEYS.rtlFixed)) return;
      await setString(STORAGE_KEYS.rtlFixed, 'true');
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
      try {
        await Updates.reloadAsync();
      } catch (e) {}
    })();
  }, []);

  const handleGoHome = () => {
    setDnsBlock(null);
    setIsInputFocused(false);
    if (isCurrentUrlBlocked) {
      setIsCurrentUrlBlocked(false);
      const activeRef = webViewRefs.current[activeTabId];
      if (activeRef) {
        // WebView is still on the safe page since the bad navigation was aborted.
        // Reloading it forces onNavigationStateChange to fire with the safe URL,
        // which fixes the tabs state and the address bar automatically.
        activeRef.reload();
      } else {
        setUrlInput(DEFAULT_URL);
        setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, url: DEFAULT_URL } : t)));
      }
    } else {
      // Normal Home button clicked from Toolbar
      loadInActiveTab(DEFAULT_URL);
    }
  };

  const handleRefresh = () => {
    const activeRef = webViewRefs.current[activeTabId];
    if (activeRef) {
      activeRef.reload();
    }
  };

  const handleSharePage = async () => {
    setIsMenuOpen(false);
    try {
      await Share.share({
        message: activeTab.url,
        url: activeTab.url,
      });
    } catch (e) {}
  };

  const handleClearCache = () => {
    setIsMenuOpen(false);
    const activeRef = webViewRefs.current[activeTabId];
    if (activeRef) {
      (activeRef as any).clearCache?.(true);
      activeRef.reload();
      Alert.alert('מטמון נוקה', 'המטמון של הדף נוקה בהצלחה.');
    }
  };

  // Back button handling on Android
  useEffect(() => {
    const onBackPress = () => {
      if (isSettingsOpen) { setIsSettingsOpen(false); return true; }
      if (isHistoryOpen) { setIsHistoryOpen(false); return true; }
      if (isBookmarksOpen) { setIsBookmarksOpen(false); return true; }
      if (isDownloadsOpen) { setIsDownloadsOpen(false); return true; }
      if (isTabSwitcherOpen) { setIsTabSwitcherOpen(false); return true; }
      if (isPinModalOpen) { setIsPinModalOpen(false); setPinInput(''); return true; }
      if (isMenuOpen) { setIsMenuOpen(false); return true; }

      if (isCurrentUrlBlocked) {
        handleGoHome();
        return true;
      }

      const activeRef = webViewRefs.current[activeTabId];
      if (activeTab.canGoBack && activeRef) {
        if (backNavGuard.current) return true;
        backNavGuard.current = true;
        activeRef.goBack();
        // 800ms guard — release APK builds have slower navigation
        // state updates than Expo Go, so 600ms was too short.
        setTimeout(() => { backNavGuard.current = false; }, 800);
        return true;
      }

      const parentTabId = tabParentMap.current[activeTabId];
      if (parentTabId) {
        const parentExists = tabs.some(t => t.id === parentTabId);
        if (parentExists) {
          delete tabParentMap.current[activeTabId];
          const filtered = tabs.filter(t => t.id !== activeTabId);
          setTabs(filtered);
          setActiveTabId(parentTabId);
          return true;
        }
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTabId, tabs, isSettingsOpen, isDownloadsOpen, isHistoryOpen, isBookmarksOpen, isTabSwitcherOpen, isPinModalOpen, isMenuOpen, isCurrentUrlBlocked, activeTab.canGoBack, tabParentMap, setTabs, setActiveTabId, setIsSettingsOpen, setIsHistoryOpen, setIsBookmarksOpen, setIsDownloadsOpen, setIsTabSwitcherOpen, setIsPinModalOpen, setPinInput, setIsMenuOpen]);

  // WebView Event Handlers
  const handleMessage = (event: any, tabId: string) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'refresh') {
        const ref = webViewRefs.current[tabId];
        if (ref) ref.reload();
      } else if (data.type === 'scrollPosition') {
        scrollPositions.current[tabId] = { x: data.x, y: data.y };
      } else if (data.type === 'forceNavigate') {
        setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, url: data.url } : t)));
        if (tabId === activeTabId) setUrlInput(data.url);
      } else if (data.type === 'navigationRequest' || data.type === 'windowOpen') {
        // Backup URL interception from injected JS.
        // In standalone APK release builds, onShouldStartLoadWithRequest
        // may not fire for client-side navigations. This catches them
        // at the JS level and blocks prohibited URLs.
        if (data.url && isUrlProhibited(data.url, blacklist, autoBlockEnabled)) {
          if (tabId === activeTabId) {
            setIsCurrentUrlBlocked(true);
          }
          const ref = webViewRefs.current[tabId];
          if (ref) {
            ref.stopLoading();
            if (data.type === 'windowOpen') {
              // window.open was already intercepted client-side, nothing more to do
            } else {
              // For link clicks, go back to prevent the navigation
              injectScrollRestore(ref, scrollPositions.current[tabId], 100);
            }
          }
        } else if (data.url && isExternalAppUrl(data.url)) {
          // Both a popup and a plain link can target another app — a bank
          // handing off from checkout, or the redirect that ends an OAuth
          // login. No tab could ever load that, so it goes to the OS.
          //
          // Ordinary link clicks are covered here as well as popups because
          // letting the WebView start the navigation is not dependable: an
          // unknown scheme that slips past onShouldStartLoadWithRequest is
          // dropped by Android without an error, which looks to the user like
          // the button simply does nothing. The injected interceptor cancels
          // the click for these URLs, so this cannot open the app twice.
          openExternalUrl(data.url, tabId);
        } else if (data.url && /^(blob|data):/i.test(data.url)) {
          // A file the page built and tried to open in a new window. No tab
          // could load it — only the page that made it can read it back, so
          // it is sent there to be turned into a download.
          injectHookCall(webViewRefs.current[tabId], 'window.__wmDeliverDownload', [data.url, '']);
        } else if (data.url && data.type === 'windowOpen' && /^https?:/i.test(data.url)) {
          handleAddNewTab(
            undefined,
            data.url,
            data.popupId ? { tabId, popupId: String(data.popupId) } : undefined
          );
        }
      } else if (data.type === 'inPageDownload') {
        saveInPageDownload(data);
      } else if (data.type === 'inPageDownloadError') {
        Alert.alert('ההורדה נכשלה', String(data.error || 'לא ניתן היה לקרוא את הקובץ מהדף.'));
      } else if (
        data.type === 'openerPostMessage' ||
        data.type === 'popupLocation' ||
        data.type === 'closePopupTab' ||
        data.type === 'popupPostMessage' ||
        data.type === 'portMessage'
      ) {
        handlePopupBridgeMessage(data, tabId);
      }
    } catch (e) {}
  };

  /**
   * Carries a popup tab and the page that opened it the news a real browser
   * would have given them for free.
   *
   * A popup is an ordinary tab here, with no window relationship to its opener,
   * so a sign-in that ends by posting its result to `window.opener` — or by
   * having the opener read the popup's final URL — had no way to finish. The
   * halves are wired up in buildOpenerBridgeJs and INJECTED_JS_BEFORE_CONTENT_LOADED.
   */
  /** Records which two tabs a transferred port joins, for routing its traffic. */
  const rememberPorts = (portIds: unknown, openerTabId: string, popupTabId: string) => {
    if (!Array.isArray(portIds)) return;
    for (const portId of portIds) {
      portPairs.current[String(portId)] = { openerTabId, popupTabId };
    }
  };

  const handlePopupBridgeMessage = (data: any, tabId: string) => {
    const senderTab = tabs.find(t => t.id === tabId);
    if (!senderTab) return;

    // Every message but these travels child → opener. Here the opener is the
    // sender and the popup is whichever tab carries the handle's id.
    if (data.type === 'popupPostMessage') {
      const child = tabs.find(t => t.popupId === String(data.popupId));
      if (!child || child.openerTabId !== tabId) return;
      rememberPorts(data.portIds, tabId, child.id);
      injectHookCall(webViewRefs.current[child.id], 'window.__wmDeliverToPopup', [
        data.message,
        getOrigin(senderTab.url),
        data.portIds || [],
      ]);
      return;
    }

    // Traffic over a MessageChannel whose two ends live in different tabs — see
    // portBridgeJs. The pairing was recorded when the port was transferred, so
    // all this has to do is send the message to whichever end did not send it.
    if (data.type === 'portMessage') {
      const pair = portPairs.current[String(data.portId)];
      if (!pair) return;
      const otherTabId = tabId === pair.openerTabId ? pair.popupTabId : pair.openerTabId;
      injectHookCall(webViewRefs.current[otherTabId], 'window.__wmPortMessage', [
        String(data.portId),
        data.message,
      ]);
      return;
    }

    // Closing runs in both directions — the popup calling window.close() on
    // itself, and the opener calling close() on the handle it is holding — so
    // the tab to close is the one owning the id, provided the sender is either
    // that tab or its opener.
    if (data.type === 'closePopupTab') {
      const target = tabs.find(
        t =>
          t.popupId === String(data.popupId) &&
          (t.id === tabId || t.openerTabId === tabId)
      );
      if (target) closeTabNotifyingOpener(target.id);
      return;
    }

    // The rest only mean anything coming from a popup that still has an opener.
    if (!senderTab.openerTabId || !senderTab.popupId) return;
    const openerRef = webViewRefs.current[senderTab.openerTabId];
    if (!openerRef) return;

    if (data.type === 'openerPostMessage') {
      // The origin is taken from the URL the sending tab is actually on, never
      // from anything the page supplied. Checking `event.origin` before
      // trusting a message is the entire point of the check, so the sender
      // must not be the one who gets to answer it.
      rememberPorts(data.portIds, senderTab.openerTabId, senderTab.id);
      injectHookCall(openerRef, 'window.__wmPopupEvent', [
        senderTab.popupId,
        data.message,
        getOrigin(senderTab.url),
        data.portIds || [],
      ]);
    } else if (data.type === 'popupLocation') {
      injectHookCall(openerRef, 'window.__wmPopupLocation', [
        senderTab.popupId,
        String(data.href || ''),
      ]);
    }
  };

  /**
   * The opener bridge is added only for a tab that really was opened by
   * `window.open`. Giving every tab a fake `window.opener` would change how
   * ordinary pages behave — plenty of them branch on whether one exists.
   */
  const buildBeforeContentJs = (tab: BrowserTab): string =>
    tab.popupId
      ? INJECTED_JS_BEFORE_CONTENT_LOADED + buildOpenerBridgeJs(tab.popupId)
      : INJECTED_JS_BEFORE_CONTENT_LOADED;

  /** Closes a tab and tells its opener the popup handle is now closed. */
  const closeTabNotifyingOpener = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.openerTabId && tab.popupId) {
      injectHookCall(webViewRefs.current[tab.openerTabId], 'window.__wmPopupClosed', [tab.popupId]);
    }
    handleCloseTab(tabId);
  };

  /**
   * Hands a non-web URL to the OS.
   *
   * Deliberately does NOT gate on `Linking.canOpenURL`: since Android 11 the
   * package-visibility rules make canOpenURL return false for every scheme not
   * listed in the manifest's <queries>, while `openURL` — which goes through
   * startActivity — still launches the target app. Gating on canOpenURL meant
   * every custom scheme (bank apps, tel:, whatsapp:) silently did nothing.
   *
   * An `intent:` URL is rebuilt into its real target first (see parseIntentUrl):
   * passing it to Linking as-is can never work, because Linking asks the system
   * for an app registered on the literal scheme "intent". That is the hand-off
   * Android pages use to return to a native app after a login, so it failing
   * silently is what stranded OAuth flows on the consent page.
   */
  const openExternalUrl = async (url: string, tabId: string) => {
    const intent = parseIntentUrl(url);
    const target = intent ? intent.targetUrl : url;

    if (target) {
      try {
        await Linking.openURL(target);
        return;
      } catch (e) {}
    }

    // Nothing on the device handles it. An intent: URL can carry its own web
    // fallback for exactly this case — honour it before giving up.
    if (intent && intent.fallbackUrl) {
      injectNavigate(webViewRefs.current[tabId], intent.fallbackUrl);
      return;
    }

    // The URL is included so a hand-off that fails on someone else's device is
    // reportable instead of just being "nothing happened".
    const shown = url.length > 120 ? url.slice(0, 120) + '…' : url;
    const appLine = intent && intent.packageName
      ? '\n\nאפליקציה מבוקשת: ' + intent.packageName
      : '';
    Alert.alert(
      'לא ניתן לפתוח',
      'לא נמצאה במכשיר אפליקציה שיכולה לפתוח את הקישור הזה.' + appLine + '\n\n' + shown
    );
  };

  const handleShouldStartLoadWithRequest = (request: any, tabId: string): boolean => {
    const { url } = request;

    // A popup's opener reads the URL the sign-in finally landed on straight off
    // the handle window.open gave it, so every navigation this tab attempts has
    // to be reported — including one that is refused just below. That refused
    // URL is routinely the very answer the opener is waiting for, and a
    // navigation that never loads would otherwise never report itself.
    const requestingTab = tabs.find(t => t.id === tabId);
    if (requestingTab && requestingTab.openerTabId && requestingTab.popupId && request.isTopFrame !== false) {
      injectHookCall(webViewRefs.current[requestingTab.openerTabId], 'window.__wmPopupLocation', [
        requestingTab.popupId,
        url,
      ]);
    }

    // Nothing can render or open one of these, and treating it as an app
    // hand-off is what stalls the sign-in — see isSignInRelayUrl. Reporting it
    // above is the whole of the work; the navigation itself goes nowhere.
    if (isSignInRelayUrl(url)) {
      return false;
    }

    // Top-frame data: navigations are refused outright — same as Chrome does.
    // isUrlProhibited only inspects the URL text, so a page could navigate to
    // `data:text/html,<iframe src="https://blocked.com">` and render blocked
    // content that never passes through the filter. Sub-frame data: URLs
    // (images, inline documents) are untouched.
    if (url.startsWith('data:') && request.isTopFrame !== false) {
      return false;
    }

    // Anything that isn't a web document goes to the OS. `intent:` belongs
    // here above all: it is Android's standard hand-off to another app (bank
    // identification, 3-D Secure, OAuth into a native app) and a WebView
    // cannot render it. It used to be excluded, so those flows silently died.
    if (isExternalAppUrl(url)) {
      openExternalUrl(url, tabId);
      return false;
    }

    if (isUrlProhibited(url, blacklist, autoBlockEnabled)) {
      if (tabId === activeTabId) {
        setIsCurrentUrlBlocked(true);
      }
      injectScrollRestore(webViewRefs.current[tabId], scrollPositions.current[tabId], 100);
      return false;
    }

    // A search page reached without SafeSearch is refused and immediately
    // re-requested with it forced on. The rewritten URL already carries the
    // parameter, so the second request passes straight through and this cannot
    // loop.
    if (autoBlockEnabled && needsSafeSearchRedirect(url)) {
      injectNavigate(webViewRefs.current[tabId], enforceSafeSearch(url));
      return false;
    }

    // The DNS verdict for an already-resolved host is available synchronously,
    // so a known-bad host can be refused outright rather than being allowed to
    // start and torn down afterwards. Unresolved hosts fall through and are
    // judged in handleNavigationStateChange.
    if (dnsFilterEnabled && getCachedVerdict(extractDomainName(url)) === 'blocked') {
      if (tabId === activeTabId) {
        setDnsBlock({ url, reason: 'filter' });
        setIsCurrentUrlBlocked(true);
      }
      injectScrollRestore(webViewRefs.current[tabId], scrollPositions.current[tabId], 100);
      return false;
    }

    return true;
  };

  const handleNavigationStateChange = (navState: WebViewNavigation, tabId: string) => {
    const pageTitle = navState.title || getDisplayDomain(navState.url, false, '');

    setTabs(prevTabs =>
      prevTabs.map(t => {
        if (t.id === tabId) {
          return {
            ...t,
            url: navState.url,
            title: pageTitle,
            canGoBack: navState.canGoBack,
            canGoForward: navState.canGoForward,
          };
        }
        return t;
      })
    );

    if (tabId === activeTabId && navState.url && !navState.loading) {
      addHistoryItem(navState.url, pageTitle);
    }

    if (tabId === activeTabId) {
      if (isUrlProhibited(navState.url, blacklist, autoBlockEnabled)) {
        setIsCurrentUrlBlocked(true);
        const ref = webViewRefs.current[tabId];
        if (ref) {
          ref.stopLoading();
          const savedScroll = scrollPositions.current[tabId];
          if (navState.canGoBack) {
            ref.goBack();
            injectScrollRestore(ref, savedScroll, 400);
          } else {
            injectScrollRestore(ref, savedScroll, 200);
          }
        }
      } else {
        setIsCurrentUrlBlocked(false);
        if (!isInputFocused) {
          setUrlInput(navState.url);
        }
      }

      // A DNS lookup is asynchronous and onShouldStartLoadWithRequest has to
      // answer synchronously, so the load is allowed to begin and torn down
      // here if the resolver disagrees — the same shape as the keyword abort
      // above. FAIL-CLOSED: 'unavailable' (offline, timeout, or a network
      // hijacking the resolver) blocks just as 'blocked' does, because in a
      // filtering product an unanswered question must never mean permission.
      if (dnsFilterEnabled && navState.url.startsWith('http')) {
        const host = extractDomainName(navState.url);
        const navigatedUrl = navState.url;
        if (getCachedVerdict(host) !== 'allowed') {
          checkHost(host).then(verdict => {
            if (verdict === 'allowed') return;
            const ref = webViewRefs.current[tabId];
            if (ref) ref.stopLoading();
            setDnsBlock({
              url: navigatedUrl,
              reason: verdict === 'blocked' ? 'filter' : 'unverified',
            });
            setIsCurrentUrlBlocked(true);
          });
        }
      }
    }
  };

  const isHttps = activeTab.url.toLowerCase().startsWith('https://');
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, RNStatusBar.currentHeight || 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar style="dark" translucent={true} backgroundColor="transparent" />

      {/* 1. Toolbar */}
      <ToolbarHeader
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        displayUrl={getDisplayDomain(activeTab.url, isInputFocused, urlInput)}
        isHttps={isHttps}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        tabsCount={tabs.length}
        isLoading={isLoading}
        loadProgress={loadProgress}
        currentUrl={activeTab.url}
        handleGoHome={handleGoHome}
        handleNavigate={() => navigateTo(urlInput)}
        handleOpenMenu={() => setIsMenuOpen(true)}
        handleOpenTabSwitcher={handleOpenTabSwitcher}
        handleAddNewTab={() => {
          setIsInputFocused(false);
          handleAddNewTab();
        }}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
      />

      {/* 2. Menu */}
      <DropdownMenuModal
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onGoBack={() => webViewRefs.current[activeTabId]?.goBack()}
        onGoForward={() => webViewRefs.current[activeTabId]?.goForward()}
        onRefresh={handleRefresh}
        onGoHome={handleGoHome}
        onSharePage={handleSharePage}
        isCurrentPageBookmarked={isCurrentPageBookmarked}
        onToggleBookmark={() => handleToggleBookmark(() => setIsMenuOpen(false))}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onClearCache={handleClearCache}
        onQuickBlockSite={() => handleQuickBlockSite(activeTab.url, () => setIsMenuOpen(false))}
        onOpenSettings={() => openPinModal('verify', () => setIsMenuOpen(false))}
      />

      {/* 3. Main View */}
      <View style={styles.webViewWrapper}>
        <View style={{ flex: 1, display: (isSettingsOpen || isCurrentUrlBlocked) ? 'none' : 'flex' }}>
          <WebViewContainer
            tabs={tabs}
            activeTabId={activeTabId}
            warmTabIds={warmTabIds}
            webViewRefs={webViewRefs}
            viewRefs={viewRefs}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            buildInjectedJavaScriptBeforeContentLoaded={buildBeforeContentJs}
            onMessage={handleMessage}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onDownloadStart={(event: any) => {
              const { url, userAgent, contentDisposition, mimeType } = event.nativeEvent;
              if (url) handleDownloadStart(url, userAgent, contentDisposition, mimeType);
            }}
            onLoadStart={(tabId) => {
              if (tabId === activeTabId) {
                setIsLoading(true);
                setLoadProgress(0);
              }
            }}
            onLoadProgress={(tabId, progress) => {
              if (tabId === activeTabId) {
                setLoadProgress(progress);
              }
            }}
            onLoadEnd={(tabId) => {
              if (tabId === activeTabId) {
                setIsLoading(false);
                setLoadProgress(1);
              }
            }}
          />
        </View>

        {isSettingsOpen && (
          <SettingsScreen
            autoBlockEnabled={autoBlockEnabled}
            saveAutoBlock={saveAutoBlock}
            dnsFilterEnabled={dnsFilterEnabled}
            saveDnsFilter={saveDnsFilter}
            blacklist={blacklist}
            newBlacklistDomain={newBlacklistDomain}
            setNewBlacklistDomain={setNewBlacklistDomain}
            handleAddBlacklist={handleAddBlacklist}
            handleRemoveBlacklist={handleRemoveBlacklist}
            openChangePinModal={() => openPinModal('change_current')}
            downloadDirLabel={describeDownloadDirectory(downloadDir)}
            onChooseDownloadDir={async () => {
              const chosen = await chooseDownloadDirectory();
              if (chosen) setDownloadDir(chosen);
            }}
            handleClose={() => setIsSettingsOpen(false)}
          />
        )}
        
        {isCurrentUrlBlocked && !isSettingsOpen && (
          <BlockedScreen
            handleGoHome={handleGoHome}
            reason={
              dnsFilterEnabled && dnsBlock && dnsBlock.url === activeTab.url
                ? dnsBlock.reason
                : 'filter'
            }
          />
        )}
      </View>

      {/* 4. PIN Modal */}
      {isPinModalOpen && (
        <PinModal
          visible={isPinModalOpen}
          pinMode={pinMode}
          pinInput={pinInput}
          handleKeyPress={handleKeyPress}
          handleBackspace={handleBackspace}
          handleClose={() => {
            setIsPinModalOpen(false);
            setPinInput('');
          }}
        />
      )}

      {/* 5. Tabs Switcher */}
      {isTabSwitcherOpen && (
        <TabSwitcherModal
          visible={isTabSwitcherOpen}
          tabs={tabs}
          activeTabId={activeTabId}
          handleSelectTab={(tabId) => {
            setActiveTabId(tabId);
            setIsTabSwitcherOpen(false);
          }}
          handleCloseTab={closeTabNotifyingOpener}
          handleAddNewTab={() => handleAddNewTab()}
          handleCloseAllTabs={handleCloseAllTabs}
          handleClose={() => setIsTabSwitcherOpen(false)}
          getDisplayDomain={(url) => getDisplayDomain(url, false, '')}
          isUrlBlocked={(url) => isUrlProhibited(url, blacklist, autoBlockEnabled)}
        />
      )}

      {/* 6. History Modal */}
      {isHistoryOpen && (
        <HistoryModal
          visible={isHistoryOpen}
          history={history}
          handleNavigateToUrl={handleHistoryNavigate}
          handleClearHistory={handleClearHistory}
          handleClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* 7. Bookmarks Modal */}
      {isBookmarksOpen && (
        <BookmarksModal
          visible={isBookmarksOpen}
          bookmarks={bookmarks}
          handleNavigateToUrl={handleBookmarkNavigate}
          handleRemoveBookmark={handleRemoveBookmark}
          handleClose={() => setIsBookmarksOpen(false)}
        />
      )}

      {/* 8. Downloads Modal */}
      {isDownloadsOpen && (
        <DownloadsModal
          visible={isDownloadsOpen}
          downloads={downloads}
          onOpenDownload={openDownload}
          handleClearDownloads={handleClearDownloads}
          handleClose={() => setIsDownloadsOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
