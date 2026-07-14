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
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Local modular files imports
import { COLORS, DROPDOWN_SHADOW } from './src/styles/globalStyles';
import {
  isUrlProhibited,
  extractDomainName,
  normalizeNavigationUrl,
  getDisplayDomain,
} from './src/utils/urlHelper';

import ToolbarHeader from './src/components/ToolbarHeader';
import BottomBar from './src/components/BottomBar';
import BlockedScreen from './src/components/BlockedScreen';
import PinModal from './src/components/PinModal';
import TabSwitcherModal from './src/components/TabSwitcherModal';
import DownloadsModal from './src/components/DownloadsModal';
import SettingsScreen from './src/screens/SettingsScreen';

const DEFAULT_PIN = '1234';
const DEFAULT_URL = 'https://www.google.com';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
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

  // Scroll & Pull-to-refresh states configuration per tab
  const [tabsAtTop, setTabsAtTop] = useState<{ [key: string]: boolean }>({});

  const handleMessage = (event: any, tabId: string) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        setTabsAtTop(prev => ({ ...prev, [tabId]: data.isAtTop }));
      }
    } catch (e) {
      // Ignore other events
    }
  };
  const scrollJS = `
    (function() {
      var lastState = null;

      function send(isAtTop) {
        if (isAtTop !== lastState) {
          lastState = isAtTop;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', isAtTop: isAtTop }));
        }
      }

      function getMainScroll() {
        return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      }

      // Walk up the DOM to find the nearest scrollable ancestor of an element
      function findScrollableParent(el) {
        while (el && el !== document.body && el !== document.documentElement && el !== document) {
          try {
            var style = window.getComputedStyle(el);
            var ov = style.overflowY || style.overflow || '';
            if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight) {
              return el;
            }
          } catch(e) {}
          el = el.parentElement;
        }
        return null;
      }

      // Track the inner scrollable container under the user's finger
      var trackedScrollable = null;

      window.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches.length > 0) {
          trackedScrollable = findScrollableParent(e.touches[0].target);
        }
      }, { passive: true, capture: true });

      window.addEventListener('touchend', function() {
        setTimeout(function() { checkScroll(); }, 100);
      }, { passive: true, capture: true });

      function checkScroll(e) {
        var mainScroll = getMainScroll();
        var isAtTop = mainScroll <= 1;

        // Check the scroll-event target (for scroll events fired on inner containers)
        if (isAtTop && e && e.target && e.target !== document && e.target !== window) {
          try {
            if (e.target.nodeType === 1 && e.target.scrollTop > 1) {
              isAtTop = false;
            }
          } catch(err) {}
        }

        // Also check the scrollable container detected on touchstart
        if (isAtTop && trackedScrollable) {
          try {
            if (trackedScrollable.scrollTop > 1) {
              isAtTop = false;
            }
          } catch(err) {
            trackedScrollable = null;
          }
        }

        send(isAtTop);
      }

      // Send initial state
      send(getMainScroll() <= 1);

      // Capture-phase listener catches scroll events from nested containers too
      window.addEventListener('scroll', checkScroll, true);

      // Periodic fallback for edge cases (SPAs that change layout without scroll events)
      var interval = setInterval(function() { checkScroll(); }, 300);

      window.addEventListener('unload', function() {
        clearInterval(interval);
      });
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
      } catch (e) {
        console.error('Failed to load settings from storage', e);
      }
    };
    loadSettings();
  }, []);

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
      setIsCurrentUrlBlocked(isUrlProhibited(activeTab.url, blacklist, autoBlockEnabled));
    }
  }, [activeTabId, blacklist, autoBlockEnabled, activeTab.url, isInputFocused]);

  // Back button handling on Android
  useEffect(() => {
    const onBackPress = () => {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
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
      if (isCurrentUrlBlocked) {
        handleGoHome();
        return true;
      }
      // Check active tab's canGoBack
      const activeRef = webViewRefs.current[activeTabId];
      if (activeTab.canGoBack && activeRef) {
        activeRef.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTabId, tabs, isSettingsOpen, isDownloadsOpen, isTabSwitcherOpen, isPinModalOpen, isCurrentUrlBlocked]);

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
      return false;
    }
    return true;
  };

  const handleNavigationStateChange = (navState: WebViewNavigation, tabId: string) => {
    setTabs(prevTabs =>
      prevTabs.map(t => {
        if (t.id === tabId) {
          return {
            ...t,
            url: navState.url,
            title: navState.title || getDisplayDomain(navState.url, false, ''),
            canGoBack: navState.canGoBack,
            canGoForward: navState.canGoForward,
          };
        }
        return t;
      })
    );

    if (tabId === activeTabId) {
      if (isUrlProhibited(navState.url, blacklist, autoBlockEnabled)) {
        setIsCurrentUrlBlocked(true);
        const ref = webViewRefs.current[tabId];
        if (ref) {
          ref.stopLoading();
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

  const openPinModal = (mode: 'verify' | 'change_current') => {
    setIsMenuOpen(false);
    setPinMode(mode);
    setPinInput('');
    setIsPinModalOpen(true);
  };

  // MULTI TAB MANAGEMENTS
  const handleAddNewTab = () => {
    const newId = Math.random().toString(36).substring(7);
    const newTab: BrowserTab = {
      id: newId,
      url: DEFAULT_URL,
      title: 'Google',
      canGoBack: false,
      canGoForward: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
    setIsMenuOpen(false);
    setIsCurrentUrlBlocked(false);
  };

  const handleCloseTab = (tabId: string) => {
    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      const newId = Math.random().toString(36).substring(7);
      setTabs([
        { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
      ]);
      setActiveTabId(newId);
    } else {
      if (activeTabId === tabId) {
        const closedIdx = tabs.findIndex(t => t.id === tabId);
        const fallbackIdx = closedIdx > 0 ? closedIdx - 1 : 0;
        setActiveTabId(filtered[fallbackIdx].id);
      }
      setTabs(filtered);
    }
  };

  const handleCloseAllTabs = () => {
    const newId = Math.random().toString(36).substring(7);
    setTabs([
      { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
    ]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
  };

  // DOWNLOADS LOGIC
  const handleDownloadStart = async (downloadUrl: string) => {
    try {
      let filename = 'downloaded_file';
      try {
        const parts = downloadUrl.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          filename = lastPart.split('?')[0].split('#')[0];
        }
      } catch (e) {
        // use default
      }

      // Propose download trigger through platform system browser
      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);

        // Record history
        const newItem: DownloadItem = {
          id: Math.random().toString(36).substring(7),
          filename,
          url: downloadUrl,
          timestamp: Date.now(),
        };

        const updated = [newItem, ...downloads];
        setDownloads(updated);
        await AsyncStorage.setItem('@browser_downloads', JSON.stringify(updated));

        Alert.alert('הורדה התחילה', `הורדת הקובץ "${filename}" התחילה דרך מנהל ההורדות של המכשיר.`);
      } else {
        Alert.alert('שגיאה', 'לא ניתן להוריד את הקובץ במכשיר זה.');
      }
    } catch (e) {
      console.error('Download error', e);
      Alert.alert('שגיאה', 'נכשלה התחלת ההורדה.');
    }
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" backgroundColor={COLORS.white} />

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
        handleOpenTabSwitcher={() => setIsTabSwitcherOpen(true)}
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
                  Alert.alert('היסטוריה', 'מנגנון ההיסטוריה יישמר בגרסה הבאה.');
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
                  Alert.alert('סימניות', 'מנגנון הסימניות יישמר בגרסה הבאה.');
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

              {/* Settings / Block Management */}
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
                style={{
                  display: tab.id === activeTabId ? 'flex' : 'none',
                  flex: 1,
                }}
              >
                <WebView
                  ref={el => { webViewRefs.current[tab.id] = el; }}
                  source={{ uri: tab.url }}
                  injectedJavaScript={scrollJS}
                  onMessage={(e) => handleMessage(e, tab.id)}
                  pullToRefreshEnabled={tabsAtTop[tab.id] === true}
                  onNavigationStateChange={(navState) => handleNavigationStateChange(navState, tab.id)}
                  onShouldStartLoadWithRequest={(request) => handleShouldStartLoadWithRequest(request, tab.id)}
                  onDownloadStart={(event: any) => {
                    const downloadUrl = event.nativeEvent?.downloadUrl || event.nativeEvent?.url;
                    if (downloadUrl) handleDownloadStart(downloadUrl);
                  }}
                  onLoadStart={() => {
                    if (tab.id === activeTabId) {
                      setIsLoading(true);
                      setLoadProgress(0);
                    }
                    setTabsAtTop(prev => ({ ...prev, [tab.id]: true }));
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

      {/* 4. Bottom Navigation Controls — Chrome style */}
      {!isSettingsOpen && (
        <BottomBar
          canGoBack={activeCanGoBack}
          canGoForward={activeCanGoForward}
          handleGoBack={() => webViewRefs.current[activeTabId]?.goBack()}
          handleGoForward={() => webViewRefs.current[activeTabId]?.goForward()}
          handleRefresh={handleRefresh}
          handleGoHome={handleGoHome}
          handleOpenTabSwitcher={() => setIsTabSwitcherOpen(true)}
        />
      )}

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
        />
      )}

      {/* 7. Downloads Management Modal */}
      {isDownloadsOpen && (
        <DownloadsModal
          visible={isDownloadsOpen}
          downloads={downloads}
          handleClearDownloads={handleClearDownloads}
          handleClose={() => setIsDownloadsOpen(false)}
        />
      )}
    </SafeAreaView>
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
