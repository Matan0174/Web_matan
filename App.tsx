import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  BackHandler,
  Linking,
  Share,
  StatusBar as RNStatusBar,
  I18nManager,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Disable RTL to prevent layout from flipping backwards on Hebrew devices
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Types & Utils
import { BrowserTab } from './src/types/browser';
import { INJECTED_JAVASCRIPT, INJECTED_JS_BEFORE_CONTENT_LOADED } from './src/utils/injectedScripts';
import { COLORS } from './src/styles/globalStyles';
import {
  isUrlProhibited,
  normalizeNavigationUrl,
  getDisplayDomain,
} from './src/utils/urlHelper';

// Hooks
import { useTabManager } from './src/hooks/useTabManager';
import { useContentFilter } from './src/hooks/useContentFilter';
import { useDownloadManager } from './src/hooks/useDownloadManager';
import { useHistoryAndBookmarks } from './src/hooks/useHistoryAndBookmarks';
import { useSearchSuggestions } from './src/hooks/useSearchSuggestions';

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
    handleOpenTabSwitcher,
    handleAddNewTab,
    handleCloseTab,
    handleCloseAllTabs,
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
    isCurrentUrlBlocked,
    setIsCurrentUrlBlocked,
    newBlacklistDomain,
    setNewBlacklistDomain,
    saveBlacklist,
    saveAutoBlock,
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
    handleClearDownloads,
  } = useDownloadManager(setIsLoading, setLoadProgress);

  const navigateTo = (url: string) => {
    let target = url.trim();
    if (!target) return;

    target = normalizeNavigationUrl(target);

    if (isUrlProhibited(target, blacklist, autoBlockEnabled)) {
      // Only update tab URL via setTabs for blocked URLs (to show blocked screen)
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? { ...t, url: target } : t))
      );
      setIsCurrentUrlBlocked(true);
    } else {
      // Do NOT update tab.url via setTabs here — changing the source prop
      // replaces the WebView's navigation stack and kills back history.
      // Instead, navigate via injectJavaScript (preserves back history)
      // and let handleNavigationStateChange update tab.url after page loads.
      setIsCurrentUrlBlocked(false);
      setUrlInput(target);
      const activeRef = webViewRefs.current[activeTabId];
      if (activeRef) {
        activeRef.injectJavaScript(`window.location.href = '${target}';`);
      }
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
        const pin = await AsyncStorage.getItem('@browser_pin');
        if (pin) setSavedPin(pin);

        const list = await AsyncStorage.getItem('@browser_blacklist');
        if (list) setBlacklist(JSON.parse(list));

        const autoBlock = await AsyncStorage.getItem('@browser_autoblock');
        if (autoBlock !== null) setAutoBlockEnabled(autoBlock === 'true');

        const savedDls = await AsyncStorage.getItem('@browser_downloads');
        if (savedDls) setDownloads(JSON.parse(savedDls));

        const savedHistory = await AsyncStorage.getItem('@browser_history');
        if (savedHistory) setHistory(JSON.parse(savedHistory));

        const savedBookmarks = await AsyncStorage.getItem('@browser_bookmarks');
        if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));

        const savedTabs = await AsyncStorage.getItem('@browser_tabs');
        const savedActiveTabId = await AsyncStorage.getItem('@browser_active_tab_id');
        if (savedTabs) {
          const parsedTabs = JSON.parse(savedTabs);
          if (parsedTabs && parsedTabs.length > 0) {
            setTabs(parsedTabs);
            if (savedActiveTabId) {
              setActiveTabId(savedActiveTabId);
              const active = parsedTabs.find((t: any) => t.id === savedActiveTabId) || parsedTabs[0];
              setUrlInput(active.url);
            } else {
              setActiveTabId(parsedTabs[0].id);
              setUrlInput(parsedTabs[0].url);
            }
          }
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

    const saveTabsState = async () => {
      try {
        await AsyncStorage.setItem('@browser_tabs', JSON.stringify(tabs));
        await AsyncStorage.setItem('@browser_active_tab_id', activeTabId);
      } catch (e) {
        console.error('Failed to save tabs state to storage', e);
      }
    };

    saveTabsState();
  }, [tabs, activeTabId, hasLoadedFromStorage]);

  // Deep linking
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
    
    const newId = Math.random().toString(36).substring(7);
    const newTab: BrowserTab = {
      id: newId,
      url: normalizedUrl,
      title: getDisplayDomain(normalizedUrl, false, ''),
      canGoBack: false,
      canGoForward: false,
    };

    tabParentMap.current[newId] = activeTabId;
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
  }, [blacklist, autoBlockEnabled, activeTabId, setTabs, setActiveTabId, setIsSettingsOpen, setIsDownloadsOpen, setIsTabSwitcherOpen, setIsPinModalOpen, setIsCurrentUrlBlocked, tabParentMap]);

  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  // Sync address bar input and block status
  useEffect(() => {
    if (activeTab) {
      if (!isInputFocused) {
        setUrlInput(activeTab.url);
      }
      if (!backNavGuard.current) {
        setIsCurrentUrlBlocked(isUrlProhibited(activeTab.url, blacklist, autoBlockEnabled));
      }
    }
  }, [activeTabId, blacklist, autoBlockEnabled, activeTab.url, isInputFocused]);

  const handleGoHome = () => {
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
      setIsCurrentUrlBlocked(false);
      setUrlInput(DEFAULT_URL);
      const activeRef = webViewRefs.current[activeTabId];
      if (activeRef) {
        activeRef.injectJavaScript(`window.location.href = '${DEFAULT_URL}';`);
      }
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
              const savedScroll = scrollPositions.current[tabId];
              if (savedScroll) {
                setTimeout(() => {
                  ref.injectJavaScript(`window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`);
                }, 100);
              }
            }
          }
        }
      }
    } catch (e) {}
  };

  const handleShouldStartLoadWithRequest = (request: any, tabId: string): boolean => {
    const { url } = request;

    if (
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('about:') &&
      !url.startsWith('data:') &&
      !url.startsWith('blob:') &&
      !url.startsWith('intent:')
    ) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) Linking.openURL(url);
      });
      return false;
    }

    if (isUrlProhibited(url, blacklist, autoBlockEnabled)) {
      if (tabId === activeTabId) {
        setIsCurrentUrlBlocked(true);
      }
      const savedScroll = scrollPositions.current[tabId];
      if (savedScroll) {
        const ref = webViewRefs.current[tabId];
        if (ref) {
          setTimeout(() => {
            ref.injectJavaScript(`window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`);
          }, 100);
        }
      }
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
            if (savedScroll) {
              setTimeout(() => {
                ref.injectJavaScript(`window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`);
              }, 400);
            }
          } else if (savedScroll) {
            setTimeout(() => {
              ref.injectJavaScript(`window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`);
            }, 200);
          }
        }
      } else {
        setIsCurrentUrlBlocked(false);
        if (!isInputFocused) {
          setUrlInput(navState.url);
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
        onAddNewTab={() => handleAddNewTab(() => setIsMenuOpen(false))}
        onSharePage={handleSharePage}
        isCurrentPageBookmarked={isCurrentPageBookmarked}
        onToggleBookmark={() => handleToggleBookmark(() => setIsMenuOpen(false))}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onQuickBlockSite={() => handleQuickBlockSite(activeTab.url, () => setIsMenuOpen(false))}
        onOpenSettings={() => openPinModal('verify', () => setIsMenuOpen(false))}
      />

      {/* 3. Main View */}
      <View style={styles.webViewWrapper}>
        <View style={{ flex: 1, display: (isSettingsOpen || isCurrentUrlBlocked) ? 'none' : 'flex' }}>
          <WebViewContainer
            tabs={tabs}
            activeTabId={activeTabId}
            webViewRefs={webViewRefs}
            viewRefs={viewRefs}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE_CONTENT_LOADED}
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
            blacklist={blacklist}
            newBlacklistDomain={newBlacklistDomain}
            setNewBlacklistDomain={setNewBlacklistDomain}
            handleAddBlacklist={handleAddBlacklist}
            handleRemoveBlacklist={handleRemoveBlacklist}
            openChangePinModal={() => openPinModal('change_current')}
            handleClose={() => setIsSettingsOpen(false)}
          />
        )}
        
        {isCurrentUrlBlocked && !isSettingsOpen && (
          <BlockedScreen handleGoHome={handleGoHome} />
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
          handleCloseTab={handleCloseTab}
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
