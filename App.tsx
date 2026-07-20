import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Keyboard,
  BackHandler,
  Alert,
  Modal,
  TouchableOpacity,
  Text,
  Linking,
  Share,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Local modular files imports
import { COLORS, DROPDOWN_SHADOW } from './src/styles/globalStyles';
import {
  isUrlProhibited,
  extractDomainName,
  normalizeNavigationUrl,
  getDisplayDomain,
  guessDownloadFilename,
} from './src/utils/urlHelper';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import ToolbarHeader from './src/components/ToolbarHeader';
import BlockedScreen from './src/components/BlockedScreen';
import PinModal from './src/components/PinModal';
import TabSwitcherModal from './src/components/TabSwitcherModal';
import DownloadsModal from './src/components/DownloadsModal';
import HistoryModal, { HistoryItem } from './src/components/HistoryModal';
import BookmarksModal, { BookmarkItem } from './src/components/BookmarksModal';
import SettingsScreen from './src/screens/SettingsScreen';

const DEFAULT_PIN = '1234';
const DEFAULT_URL = 'https://www.google.com';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  screenshotUri?: string;
}

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  timestamp: number;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BrowserApp />
    </SafeAreaProvider>
  );
}

function BrowserApp() {
  const webViewRefs = useRef<{ [key: string]: WebView | null }>({});

  // Tabs navigation states
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: '1', url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isTabSwitcherOpen, setIsTabSwitcherOpen] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  const viewRefs = useRef<{ [key: string]: View | null }>({});

  // Back navigation debounce guard — prevents double-back bug
  const backNavGuard = useRef(false);

  // Track parent tab for each new tab (newTabId → parentTabId)
  const tabParentMap = useRef<{ [key: string]: string }>({});

  // Track scroll position per tab for blocked-URL scroll restoration
  const scrollPositions = useRef<{ [tabId: string]: { x: number; y: number } }>({});

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

  // Address Bar inputs and general loadings
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Chrome UI settings and state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Downloads Panel state
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // Search Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((query: string) => {
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Skip fetching suggestions if input looks like a full URL
    if (/^https?:\/\//i.test(query)) {
      setSuggestions([]);
      return;
    }

    suggestionsTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
        );
        const text = await response.text();
        const parsed = JSON.parse(text);
        // Google returns: [query, [suggestions], ...]  
        if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
          setSuggestions(parsed[1].slice(0, 6));
        }
      } catch (e) {
        // Silently fail - suggestions are not critical
      }
    }, 250); // 250ms debounce
  }, []);

  const handleSelectSuggestion = (suggestion: string) => {
    setSuggestions([]);
    setUrlInput(suggestion);
    navigateTo(suggestion);
    Keyboard.dismiss();
  };

  // Fetch suggestions when urlInput changes while focused
  useEffect(() => {
    if (isInputFocused) {
      fetchSuggestions(urlInput);
    } else {
      setSuggestions([]);
    }
  }, [urlInput, isInputFocused, fetchSuggestions]);

  const handleMessage = (event: any, tabId: string) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'refresh') {
        const ref = webViewRefs.current[tabId];
        if (ref) {
          ref.reload();
        }
      } else if (data.type === 'scrollPosition') {
        scrollPositions.current[tabId] = { x: data.x, y: data.y };
      }
    } catch (e) {
      // Ignore other events
    }
  };
  const pullToRefreshJS = `
    (function() {
      if (window.__ptrInjected) return;
      window.__ptrInjected = true;

      // Create pull-to-refresh indicator element
      var indicator = document.createElement('div');
      indicator.style.cssText = 'position:fixed;top:-50px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;z-index:2147483647;transition:top 0.2s ease-out,opacity 0.2s;pointer-events:none;opacity:0;';
      var spinner = document.createElement('div');
      spinner.style.cssText = 'width:18px;height:18px;border:2.5px solid #e0e0e0;border-top-color:#4285f4;border-radius:50%;';
      indicator.appendChild(spinner);
      document.body.appendChild(indicator);

      var styleEl = document.createElement('style');
      styleEl.textContent = '@keyframes __ptrSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(styleEl);

      var startY = 0;
      var pulling = false;
      var refreshing = false;
      var THRESHOLD = 80;

      function findScrolledParent(el) {
        while (el && el !== document.body && el !== document.documentElement && el !== document) {
          try {
            var cs = window.getComputedStyle(el);
            var ov = cs.overflowY || cs.overflow || '';
            if ((ov === 'auto' || ov === 'scroll' || ov === 'overlay') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
              return el;
            }
          } catch(e) {}
          el = el.parentElement;
        }
        return null;
      }

      function isPageAtTop(target) {
        var mainScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (mainScroll > 1) return false;
        if (findScrolledParent(target)) return false;
        return true;
      }

      document.addEventListener('touchstart', function(e) {
        if (refreshing || e.touches.length !== 1) return;
        if (!isPageAtTop(e.touches[0].target)) { pulling = false; return; }
        startY = e.touches[0].pageY;
        pulling = true;
      }, { passive: true });

      document.addEventListener('touchmove', function(e) {
        if (!pulling || refreshing) return;
        var mainScroll = window.scrollY || window.pageYOffset || 0;
        if (mainScroll > 1) { pulling = false; indicator.style.top = '-50px'; indicator.style.opacity = '0'; return; }
        var dy = e.touches[0].pageY - startY;
        if (dy <= 0) { indicator.style.top = '-50px'; indicator.style.opacity = '0'; return; }
        var progress = Math.min(dy / THRESHOLD, 1);
        var pos = Math.min(dy * 0.35, 60);
        indicator.style.top = (pos - 15) + 'px';
        indicator.style.opacity = '' + progress;
        spinner.style.transform = 'rotate(' + (dy * 3) + 'deg)';
        spinner.style.animation = 'none';
      }, { passive: true });

      document.addEventListener('touchend', function(e) {
        if (!pulling || refreshing) return;
        var dy = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].pageY : 0) - startY;
        if (dy >= THRESHOLD) {
          refreshing = true;
          indicator.style.top = '18px';
          indicator.style.opacity = '1';
          spinner.style.transform = '';
          spinner.style.animation = '__ptrSpin 0.6s linear infinite';
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'refresh' }));
          setTimeout(function() {
            indicator.style.top = '-50px';
            indicator.style.opacity = '0';
            spinner.style.animation = 'none';
            refreshing = false;
          }, 1000);
        } else {
          indicator.style.top = '-50px';
          indicator.style.opacity = '0';
        }
        pulling = false;
      }, { passive: true });
    })();

    // Scroll position tracking for blocked-URL scroll restoration
    (function() {
      if (window.__scrollTrackInjected) return;
      window.__scrollTrackInjected = true;
      var __scrollTimer = null;
      window.addEventListener('scroll', function() {
        if (__scrollTimer) clearTimeout(__scrollTimer);
        __scrollTimer = setTimeout(function() {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollPosition',
              x: window.scrollX || window.pageXOffset || 0,
              y: window.scrollY || window.pageYOffset || 0
            }));
          } catch(e) {}
        }, 150);
      }, { passive: true });
    })();
    true;
  `;

  // PIN settings state
  const [savedPin, setSavedPin] = useState(DEFAULT_PIN);
  const [pinInput, setPinInput] = useState('');
  const [pinMode, setPinMode] = useState<'verify' | 'change_current' | 'change_new'>('verify');

  // Blocking mechanism states
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [autoBlockEnabled, setAutoBlockEnabled] = useState(true);
  const [isCurrentUrlBlocked, setIsCurrentUrlBlocked] = useState(false);

  // Manual Blacklist Input state
  const [newBlacklistDomain, setNewBlacklistDomain] = useState('');

  // Active Tab Reference Helper
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || {
    id: '1',
    url: DEFAULT_URL,
    title: 'Google',
    canGoBack: false,
    canGoForward: false,
  };

  // Load configuration from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
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
              const activeTab = parsedTabs.find((t: any) => t.id === savedActiveTabId) || parsedTabs[0];
              setUrlInput(activeTab.url);
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
    loadSettings();
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

  // Handle deep linking for incoming URLs
  const handleDeepLink = useCallback((url: string) => {
    if (!url) return;
    
    console.log('Received deep link:', url);

    // 1. Check if the URL is a direct web link or wrapped in a scheme
    let cleanUrl = url;
    
    // If it's our custom scheme (web-matan://), we might want to handle it differently
    // but for now, we just look for the first occurrence of http/https
    const httpsIndex = cleanUrl.toLowerCase().indexOf('https://');
    const httpIndex = cleanUrl.toLowerCase().indexOf('http://');
    
    if (httpsIndex !== -1) {
      cleanUrl = cleanUrl.substring(httpsIndex);
    } else if (httpIndex !== -1) {
      cleanUrl = cleanUrl.substring(httpIndex);
    } else {
      // If it's just a domain or a search term passed via scheme, normalize it
      // For example: web-matan://google.com or web-matan://search?q=query
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

    // Track parent so hardware back closes this tab and returns to parent
    tabParentMap.current[newId] = activeTabId;
    captureActiveTabScreenshot(activeTabId);
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
  }, [blacklist, autoBlockEnabled]);

  useEffect(() => {
    // Check if the app was opened via a deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep link events while the app is running
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  // Update input text and block status when active tab updates, blacklist changes or autoBlock toggles
  useEffect(() => {
    if (activeTab) {
      if (!isInputFocused) {
        setUrlInput(activeTab.url);
      }
      // Skip block-check while a back navigation is in progress to prevent
      // intermediate/redirect URLs from flipping isCurrentUrlBlocked and causing double-back
      if (!backNavGuard.current) {
        setIsCurrentUrlBlocked(isUrlProhibited(activeTab.url, blacklist, autoBlockEnabled));
      }
    }
  }, [activeTabId, blacklist, autoBlockEnabled, activeTab.url, isInputFocused]);

  // Back button handling on Android
  useEffect(() => {
    const onBackPress = () => {
      // 1. Dismiss open overlays / modals (unchanged priority order)
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isHistoryOpen) {
        setIsHistoryOpen(false);
        return true;
      }
      if (isBookmarksOpen) {
        setIsBookmarksOpen(false);
        return true;
      }
      if (isDownloadsOpen) {
        setIsDownloadsOpen(false);
        return true;
      }
      if (isTabSwitcherOpen) {
        setIsTabSwitcherOpen(false);
        return true;
      }
      if (isPinModalOpen) {
        setIsPinModalOpen(false);
        setPinInput('');
        return true;
      }
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return true;
      }

      // 2. Blocked screen → go home
      if (isCurrentUrlBlocked) {
        handleGoHome();
        return true;
      }

      // 3. WebView has history → go back (with debounce guard to prevent double-back)
      const activeRef = webViewRefs.current[activeTabId];
      if (activeTab.canGoBack && activeRef) {
        if (backNavGuard.current) return true; // Already processing a back nav
        backNavGuard.current = true;
        activeRef.goBack();
        setTimeout(() => { backNavGuard.current = false; }, 600);
        return true;
      }

      // 4. No webview history — if tab has a parent, close this tab and return to parent
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

      // 5. Nothing left to undo — let Android handle (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTabId, tabs, isSettingsOpen, isDownloadsOpen, isHistoryOpen, isBookmarksOpen, isTabSwitcherOpen, isPinModalOpen, isMenuOpen, isCurrentUrlBlocked]);

  // Save blacklisting details to AsyncStorage
  const saveBlacklist = async (newList: string[]) => {
    try {
      setBlacklist(newList);
      await AsyncStorage.setItem('@browser_blacklist', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save blacklist', e);
    }
  };

  const savePin = async (newPin: string) => {
    try {
      setSavedPin(newPin);
      await AsyncStorage.setItem('@browser_pin', newPin);
    } catch (e) {
      console.error('Failed to save PIN', e);
    }
  };

  const saveAutoBlock = async (enabled: boolean) => {
    try {
      setAutoBlockEnabled(enabled);
      await AsyncStorage.setItem('@browser_autoblock', enabled ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save content filter toggle', e);
    }
  };

  // Navigation handlers
  const navigateTo = (url: string) => {
    let target = url.trim();
    if (!target) return;

    // Standardize url search / domains
    target = normalizeNavigationUrl(target);

    // Update active tab URL
    setTabs(prev =>
      prev.map(t => (t.id === activeTabId ? { ...t, url: target } : t))
    );

    if (isUrlProhibited(target, blacklist, autoBlockEnabled)) {
      setIsCurrentUrlBlocked(true);
    } else {
      setIsCurrentUrlBlocked(false);
      setUrlInput(target);
      const activeRef = webViewRefs.current[activeTabId];
      if (activeRef) {
        activeRef.injectJavaScript(`window.location.href = '${target}';`);
      }
    }
  };

  const handleGoHome = () => {
    setIsCurrentUrlBlocked(false);
    // Update active tab to home url
    setTabs(prev =>
      prev.map(t => (t.id === activeTabId ? { ...t, url: DEFAULT_URL, title: 'Google' } : t))
    );
    setUrlInput(DEFAULT_URL);
    const activeRef = webViewRefs.current[activeTabId];
    if (activeRef) {
      activeRef.injectJavaScript(`window.location.href = '${DEFAULT_URL}';`);
    }
  };

  const handleRefresh = () => {
    const activeRef = webViewRefs.current[activeTabId];
    if (activeRef) {
      activeRef.reload();
    }
  };

  // Share current page
  const handleSharePage = async () => {
    setIsMenuOpen(false);
    try {
      await Share.share({
        message: activeTab.url,
        url: activeTab.url,
      });
    } catch (e) {
      // User cancelled or error
    }
  };

  // Check URL validation prior to loading
  const handleShouldStartLoadWithRequest = (request: any, tabId: string): boolean => {
    const { url } = request;

    // 1. Handle non-web schemes (tel:, mailto:, whatsapp:, etc.)
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          console.warn('Cannot open external URL:', url);
        }
      });
      return false; // Prevent WebView from trying to load it
    }

    // 2. Check prohibited URLs
    if (isUrlProhibited(url, blacklist, autoBlockEnabled)) {
      if (tabId === activeTabId) {
        setIsCurrentUrlBlocked(true);
      }
      // Restore scroll position after cancelling navigation — on some Android WebView
      // versions, returning false triggers a page reload that resets scroll to top
      const savedScroll = scrollPositions.current[tabId];
      if (savedScroll) {
        const ref = webViewRefs.current[tabId];
        if (ref) {
          setTimeout(() => {
            ref.injectJavaScript(
              `window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`
            );
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

    // Record history for completed page loads
    if (tabId === activeTabId && navState.url && !navState.loading) {
      // Avoid duplicates for the same URL in quick succession
      setHistory(prev => {
        if (prev.length > 0 && prev[0].url === navState.url) return prev;
        const newItem: HistoryItem = {
          id: Math.random().toString(36).substring(7),
          url: navState.url,
          title: pageTitle,
          timestamp: Date.now(),
        };
        const updated = [newItem, ...prev].slice(0, 500); // Keep last 500 entries
        AsyncStorage.setItem('@browser_history', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    }

    if (tabId === activeTabId) {
      if (isUrlProhibited(navState.url, blacklist, autoBlockEnabled)) {
        setIsCurrentUrlBlocked(true);
        const ref = webViewRefs.current[tabId];
        if (ref) {
          ref.stopLoading();
          // Attempt to go back to previous page and restore scroll position
          const savedScroll = scrollPositions.current[tabId];
          if (navState.canGoBack) {
            ref.goBack();
            if (savedScroll) {
              setTimeout(() => {
                ref.injectJavaScript(
                  `window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`
                );
              }, 400);
            }
          } else if (savedScroll) {
            // Can't go back — just restore scroll on current page
            setTimeout(() => {
              ref.injectJavaScript(
                `window.scrollTo(${savedScroll.x}, ${savedScroll.y}); true;`
              );
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

  // PIN keypad processing
  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 4) return;
    const nextInput = pinInput + num;
    setPinInput(nextInput);

    if (nextInput.length === 4) {
      setTimeout(() => {
        if (pinMode === 'verify') {
          if (nextInput === savedPin) {
            setIsPinModalOpen(false);
            setPinInput('');
            setIsSettingsOpen(true);
          } else {
            Alert.alert('קוד שגוי', 'קוד הגישה שהזנת אינו נכון.');
            setPinInput('');
          }
        } else if (pinMode === 'change_current') {
          if (nextInput === savedPin) {
            setPinMode('change_new');
            setPinInput('');
          } else {
            Alert.alert('קוד שגוי', 'קוד הגישה הנוכחי אינו נכון.');
            setPinInput('');
          }
        } else if (pinMode === 'change_new') {
          savePin(nextInput);
          Alert.alert('הצלחה', 'קוד הגישה עודכן בהצלחה.');
          setPinInput('');
          setPinMode('verify');
          setIsPinModalOpen(false);
        }
      }, 200);
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  // Manual list adjustments
  const handleAddBlacklist = () => {
    let domain = newBlacklistDomain.trim().toLowerCase();
    if (!domain) return;

    domain = extractDomainName(domain);

    // Basic domain checks
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      Alert.alert('שגיאה', 'אנא הכנס דומיין תקין (למשל: facebook.com)');
      return;
    }

    if (blacklist.includes(domain)) {
      Alert.alert('הודעה', 'אתר זה כבר קיים ברשימת החסימה.');
      return;
    }

    const updated = [...blacklist, domain];
    saveBlacklist(updated);
    setNewBlacklistDomain('');
    Keyboard.dismiss();
  };

  const handleRemoveBlacklist = (domain: string) => {
    Alert.alert(
      'הסרת חסימה',
      `האם להסיר את החסימה עבור ${domain}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: () => {
            const updated = blacklist.filter(item => item !== domain);
            saveBlacklist(updated);
          },
        },
      ]
    );
  };

  // History helpers
  const handleClearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('@browser_history');
  };

  const handleHistoryNavigate = (url: string) => {
    setIsHistoryOpen(false);
    navigateTo(url);
  };

  // Bookmarks helpers
  const isCurrentPageBookmarked = bookmarks.some(b => b.url === activeTab.url);

  const handleToggleBookmark = async () => {
    setIsMenuOpen(false);
    if (isCurrentPageBookmarked) {
      const updated = bookmarks.filter(b => b.url !== activeTab.url);
      setBookmarks(updated);
      await AsyncStorage.setItem('@browser_bookmarks', JSON.stringify(updated));
    } else {
      const newBookmark: BookmarkItem = {
        id: Math.random().toString(36).substring(7),
        url: activeTab.url,
        title: activeTab.title,
        timestamp: Date.now(),
      };
      const updated = [newBookmark, ...bookmarks];
      setBookmarks(updated);
      await AsyncStorage.setItem('@browser_bookmarks', JSON.stringify(updated));
    }
  };

  const handleRemoveBookmark = async (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    await AsyncStorage.setItem('@browser_bookmarks', JSON.stringify(updated));
  };

  const handleBookmarkNavigate = (url: string) => {
    setIsBookmarksOpen(false);
    navigateTo(url);
  };

  // Quick-block current site from menu (no PIN required)
  const handleQuickBlockSite = () => {
    setIsMenuOpen(false);
    const domain = extractDomainName(activeTab.url);
    if (!domain) return;

    if (blacklist.includes(domain)) {
      Alert.alert('הודעה', 'אתר זה כבר קיים ברשימת החסימה.');
      return;
    }

    Alert.alert(
      'חסימת אתר',
      `האם לחסום את ${domain}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'חסום',
          style: 'destructive',
          onPress: () => {
            const updated = [...blacklist, domain];
            saveBlacklist(updated);
          },
        },
      ]
    );
  };

  const openPinModal = (mode: 'verify' | 'change_current') => {
    setIsMenuOpen(false);
    setPinMode(mode);
    setPinInput('');
    setIsPinModalOpen(true);
  };

  // MULTI TAB MANAGEMENTS
  const handleAddNewTab = async () => {
    await captureActiveTabScreenshot(activeTabId);
    const newId = Math.random().toString(36).substring(7);
    const newTab: BrowserTab = {
      id: newId,
      url: DEFAULT_URL,
      title: 'Google',
      canGoBack: false,
      canGoForward: false,
    };
    // Track parent so hardware back closes this tab and returns to parent
    tabParentMap.current[newId] = activeTabId;
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
    setIsMenuOpen(false);
    setIsCurrentUrlBlocked(false);
  };

  const handleCloseTab = (tabId: string) => {
    // Clean up parent tracking for the closed tab
    delete tabParentMap.current[tabId];
    // Also clean up scroll position
    delete scrollPositions.current[tabId];

    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      const newId = Math.random().toString(36).substring(7);
      setTabs([
        { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
      ]);
      setActiveTabId(newId);
    } else {
      if (activeTabId === tabId) {
        // Prefer the parent tab if it exists, otherwise fall back to adjacent tab
        const parentId = tabParentMap.current[tabId];
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
    // Reset all tracking maps
    tabParentMap.current = {};
    scrollPositions.current = {};

    const newId = Math.random().toString(36).substring(7);
    setTabs([
      { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
    ]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
  };

  // DOWNLOADS LOGIC
  const handleDownloadStart = async (
    downloadUrl: string,
    userAgent?: string,
    contentDisposition?: string,
    mimeType?: string
  ) => {
    // Guess the correct filename and extension
    const filename = guessDownloadFilename(downloadUrl, contentDisposition, mimeType);

    Alert.alert(
      'הורדת קובץ',
      `האם ברצונך להוריד את הקובץ "${filename}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הורד',
          onPress: async () => {
            try {
              // Target URI in the document directory
              const fileUri = `${FileSystem.documentDirectory}${filename}`;
              
              // Set loading indicator
              setIsLoading(true);
              setLoadProgress(0);

              // Download the file using expo-file-system
              const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri, {
                headers: userAgent ? { 'User-Agent': userAgent } : {},
              });

              setIsLoading(false);
              setLoadProgress(1);

              if (downloadRes && downloadRes.status === 200) {
                // Record to app's downloads list
                const newItem: DownloadItem = {
                  id: Math.random().toString(36).substring(7),
                  filename,
                  url: downloadUrl,
                  timestamp: Date.now(),
                };

                const updated = [newItem, ...downloads];
                setDownloads(updated);
                await AsyncStorage.setItem('@browser_downloads', JSON.stringify(updated));

                Alert.alert(
                  'ההורדה הושלמה',
                  `הקובץ "${filename}" ירד בהצלחה. האם ברצונך לפתוח או להתקין אותו?`,
                  [
                    { text: 'לא עכשיו', style: 'cancel' },
                    {
                      text: 'פתח / התקן',
                      onPress: async () => {
                        try {
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(downloadRes.uri, {
                              mimeType: mimeType || 'application/octet-stream',
                              dialogTitle: `פתח את ${filename}`,
                            });
                          } else {
                            Alert.alert('שגיאה', 'שיתוף או פתיחת קבצים אינם נתמכים במכשיר זה.');
                          }
                        } catch (err) {
                          console.error('Sharing error', err);
                        }
                      }
                    }
                  ]
                );
              } else {
                throw new Error('Server returned non-200 status code');
              }
            } catch (e) {
              setIsLoading(false);
              setLoadProgress(1);
              console.error('Download error:', e);
              
              // Fallback to system browser if native download fails
              Alert.alert(
                'ההורדה נכשלה',
                'נכשלה הורדת הקובץ בתוך האפליקציה. האם לנסות להוריד דרך דפדפן המכשיר?',
                [
                  { text: 'ביטול', style: 'cancel' },
                  {
                    text: 'פתח בדפדפן',
                    onPress: async () => {
                      try {
                        const canOpen = await Linking.canOpenURL(downloadUrl);
                        if (canOpen) {
                          await Linking.openURL(downloadUrl);
                        }
                      } catch (err) {
                        Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור.');
                      }
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  const handleClearDownloads = async () => {
    try {
      setDownloads([]);
      await AsyncStorage.removeItem('@browser_downloads');
      Alert.alert('הצלחה', 'היסטוריית ההורדות נמחקה.');
    } catch (e) {
      console.error('Failed to clear downloads', e);
    }
  };

  // Set canGoBack/canGoForward local refs on tab activation
  const activeCanGoBack = activeTab.canGoBack;
  const activeCanGoForward = activeTab.canGoForward;

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, RNStatusBar.currentHeight || 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar style="dark" translucent={true} backgroundColor="transparent" />

      {/* 1. Chrome Toolbar Header Component */}
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

      {/* 2. Chrome-style Dropdown Menu Modal */}
      {isMenuOpen && (
        <Modal
          transparent={true}
          visible={isMenuOpen}
          animationType="fade"
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
          >
            <View style={styles.dropdownMenu}>
              {/* Navigation Row: Back / Forward / Refresh / Home */}
              {/* Note: disabled removed — WebView handles no-op gracefully, avoids stale canGoBack/canGoForward state */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  onPress={() => { setIsMenuOpen(false); webViewRefs.current[activeTabId]?.goForward(); }}
                  style={styles.navBtn}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={COLORS.textDark}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setIsMenuOpen(false); webViewRefs.current[activeTabId]?.goBack(); }}
                  style={styles.navBtn}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={COLORS.textDark}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setIsMenuOpen(false); handleRefresh(); }}
                  style={styles.navBtn}
                  activeOpacity={0.6}
                >
                  <Ionicons name="reload-outline" size={20} color={COLORS.textDark} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setIsMenuOpen(false); handleGoHome(); }}
                  style={styles.navBtn}
                  activeOpacity={0.6}
                >
                  <Ionicons name="home-outline" size={20} color={COLORS.textDark} />
                </TouchableOpacity>
              </View>

              <View style={styles.menuDivider} />

              {/* New Tab */}
              <TouchableOpacity style={styles.menuItem} onPress={handleAddNewTab}>
                <Ionicons name="add-outline" size={22} color={COLORS.greyDark} />
                <Text style={styles.menuItemText}>כרטיסייה חדשה</Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity style={styles.menuItem} onPress={handleSharePage}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
                  size={22}
                  color={COLORS.greyDark}
                />
                <Text style={styles.menuItemText}>שתף...</Text>
              </TouchableOpacity>

              {/* Bookmark Toggle */}
              <TouchableOpacity style={styles.menuItem} onPress={handleToggleBookmark}>
                <Ionicons
                  name={isCurrentPageBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={isCurrentPageBookmarked ? COLORS.blueAccent : COLORS.greyDark}
                />
                <Text style={[styles.menuItemText, isCurrentPageBookmarked && { color: COLORS.blueAccent }]}>
                  {isCurrentPageBookmarked ? 'הסר סימנייה' : 'הוסף סימנייה'}
                </Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Find in page */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  Alert.alert('מצא בדף', 'פיצ\'ר חיפוש בדף יתווסף בגרסה הבאה.');
                }}
              >
                <Ionicons name="search-outline" size={22} color={COLORS.greyDark} />
                <Text style={styles.menuItemText}>מצא בדף</Text>
              </TouchableOpacity>

              {/* History */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsHistoryOpen(true);
                }}
              >
                <Ionicons name="time-outline" size={22} color={COLORS.greyDark} />
                <Text style={styles.menuItemText}>היסטוריה</Text>
              </TouchableOpacity>

              {/* Bookmarks */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsBookmarksOpen(true);
                }}
              >
                <Ionicons name="bookmark-outline" size={22} color={COLORS.greyDark} />
                <Text style={styles.menuItemText}>סימניות</Text>
              </TouchableOpacity>

              {/* Downloads */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsDownloadsOpen(true);
                }}
              >
                <Ionicons name="download-outline" size={22} color={COLORS.greyDark} />
                <Text style={styles.menuItemText}>הורדות</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Quick Block Site — no PIN required */}
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemBlock]}
                onPress={handleQuickBlockSite}
              >
                <Ionicons name="ban-outline" size={22} color={COLORS.redWarning} />
                <Text style={[styles.menuItemText, { color: COLORS.redWarning }]}>חסום אתר זה</Text>
              </TouchableOpacity>

              {/* Settings / Block Management — requires PIN */}
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemSettings]}
                onPress={() => openPinModal('verify')}
              >
                <MaterialCommunityIcons name="shield-lock-outline" size={22} color={COLORS.redWarning} />
                <Text style={[styles.menuItemText, styles.menuItemSettingsText]}>הגדרות חסימה</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 3. Main Body Container (WebView, Block Screen or Settings Panel) */}
      <View style={styles.webViewWrapper}>
        {isSettingsOpen ? (
          /* BLOCK SETTINGS CONTROL PANEL SCREEN */
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
        ) : isCurrentUrlBlocked ? (
          /* SAFE BLOCKED LANDING PAGE SCREEN */
          <BlockedScreen handleGoHome={handleGoHome} />
        ) : (
          /* MAIN WEBVIEW BROWSER IN PARALLEL TABS */
          <View style={{ flex: 1 }}>
            {tabs.map(tab => (
              <View
                key={tab.id}
                ref={el => { viewRefs.current[tab.id] = el; }}
                collapsable={false}
                style={{
                  display: tab.id === activeTabId ? 'flex' : 'none',
                  flex: 1,
                }}
              >
                <WebView
                  ref={el => { webViewRefs.current[tab.id] = el; }}
                  source={{ uri: tab.url }}
                  injectedJavaScript={pullToRefreshJS}
                  onMessage={(e) => handleMessage(e, tab.id)}
                  pullToRefreshEnabled={false}
                  onNavigationStateChange={(navState) => handleNavigationStateChange(navState, tab.id)}
                  onShouldStartLoadWithRequest={(request) => handleShouldStartLoadWithRequest(request, tab.id)}
                  onDownloadStart={(event: any) => {
                    const { url, userAgent, contentDisposition, mimeType } = event.nativeEvent;
                    if (url) handleDownloadStart(url, userAgent, contentDisposition, mimeType);
                  }}
                  onLoadStart={() => {
                    if (tab.id === activeTabId) {
                      setIsLoading(true);
                      setLoadProgress(0);
                    }
                  }}
                  onLoadProgress={({ nativeEvent }) => {
                    if (tab.id === activeTabId) {
                      setLoadProgress(nativeEvent.progress);
                    }
                  }}
                  onLoadEnd={() => {
                    if (tab.id === activeTabId) {
                      setIsLoading(false);
                      setLoadProgress(1);
                    }
                  }}
                  domStorageEnabled={true}
                  javaScriptEnabled={true}
                  style={{ flex: 1 }}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 4. Bottom Navigation Controls — REMOVED, moved to dropdown menu */}

      {/* 5. Custom Security Pin Modal */}
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

      {/* 6. Tabs Switcher Grid Overlay Modal */}
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
          handleAddNewTab={handleAddNewTab}
          handleCloseAllTabs={handleCloseAllTabs}
          handleClose={() => setIsTabSwitcherOpen(false)}
          getDisplayDomain={(url) => getDisplayDomain(url, false, '')}
          isUrlBlocked={(url) => isUrlProhibited(url, blacklist, autoBlockEnabled)}
        />
      )}

      {/* 7. Downloads Management Modal */}
      {/* 8. History Modal */}
      {isHistoryOpen && (
        <HistoryModal
          visible={isHistoryOpen}
          history={history}
          handleNavigateToUrl={handleHistoryNavigate}
          handleClearHistory={handleClearHistory}
          handleClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* 9. Bookmarks Modal */}
      {isBookmarksOpen && (
        <BookmarksModal
          visible={isBookmarksOpen}
          bookmarks={bookmarks}
          handleNavigateToUrl={handleBookmarkNavigate}
          handleRemoveBookmark={handleRemoveBookmark}
          handleClose={() => setIsBookmarksOpen(false)}
        />
      )}

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
  menuBackdrop: {
    flex: 1,
    backgroundColor: COLORS.backdropLight,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: 220,
    paddingVertical: 8,
    ...DROPDOWN_SHADOW,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 13,
    paddingHorizontal: 18,
    gap: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: COLORS.textMedium,
    textAlign: 'right',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
    marginHorizontal: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.greyLight,
  },
  menuItemBlock: {
    marginHorizontal: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  menuItemSettings: {
    backgroundColor: COLORS.redLightBg,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  menuItemSettingsText: {
    color: COLORS.redWarning,
    fontWeight: '600',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
