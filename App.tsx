import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Keyboard,
  BackHandler,
  SafeAreaView,
  Alert,
  Modal,
  TouchableOpacity,
  Text,
  Linking,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Local modular files imports
import { COLORS } from './src/styles/globalStyles';
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
      var checkScroll = function(e) {
        var winScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        var isAtTop = winScroll === 0;
        
        // Check if a sub-container event target is scrolled
        if (e && e.target && e.target !== document && e.target !== window) {
          try {
            if (e.target.scrollTop > 0) {
              isAtTop = false;
            }
          } catch(err) {}
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', isAtTop: isAtTop }));
      };
      
      checkScroll();
      
      // Listen in the capturing phase to intercept scroll events from sub-elements
      window.addEventListener('scroll', checkScroll, true);
      
      // Periodic fallback sync (runs 4 times a second)
      var scrollInterval = setInterval(checkScroll, 250);
      
      window.addEventListener('unload', function() {
        clearInterval(scrollInterval);
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

  // Check URL validation prior to loading
  const handleShouldStartLoadWithRequest = (request: any, tabId: string): boolean => {
    if (isUrlProhibited(request.url, blacklist, autoBlockEnabled)) {
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
    <SafeAreaView style={styles.container}>
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
        handleGoHome={handleGoHome}
        handleNavigate={() => navigateTo(urlInput)}
        handleOpenMenu={() => setIsMenuOpen(true)}
        handleOpenTabSwitcher={() => setIsTabSwitcherOpen(true)}
      />

      {/* 2. Three-Dots Dropdown Menu Modal */}
      {isMenuOpen && (
        <Modal
          transparent={true}
          visible={isMenuOpen}
          animationType="none"
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
          >
            <View style={styles.dropdownMenu}>
              <TouchableOpacity style={styles.menuItem} onPress={handleAddNewTab}>
                <Ionicons name="add" size={20} color={COLORS.textMedium} />
                <Text style={styles.menuItemText}>כרטיסייה חדשה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  Alert.alert('היסטוריה', 'מנגנון ההיסטוריה יישמר בגרסה הבאה.');
                }}
              >
                <Ionicons name="time-outline" size={20} color={COLORS.textMedium} />
                <Text style={styles.menuItemText}>היסטוריה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  Alert.alert('סימניות', 'מנגנון הסימניות יישמר בגרסה הבאה.');
                }}
              >
                <Ionicons name="bookmark-outline" size={20} color={COLORS.textMedium} />
                <Text style={styles.menuItemText}>סימניות</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsDownloadsOpen(true);
                }}
              >
                <Ionicons name="download-outline" size={20} color={COLORS.textMedium} />
                <Text style={styles.menuItemText}>הורדות</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemSettings]}
                onPress={() => openPinModal('verify')}
              >
                <MaterialCommunityIcons name="shield-lock-outline" size={20} color={COLORS.redWarning} />
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
                  pullToRefreshEnabled={tabsAtTop[tab.id] !== false}
                  onNavigationStateChange={(navState) => handleNavigationStateChange(navState, tab.id)}
                  onShouldStartLoadWithRequest={(request) => handleShouldStartLoadWithRequest(request, tab.id)}
                  onDownloadStart={(event: any) => {
                    const downloadUrl = event.nativeEvent?.downloadUrl || event.nativeEvent?.url;
                    if (downloadUrl) handleDownloadStart(downloadUrl);
                  }}
                  onLoadStart={() => {
                    if (tab.id === activeTabId) setIsLoading(true);
                    setTabsAtTop(prev => ({ ...prev, [tab.id]: true }));
                  }}
                  onLoadEnd={() => tab.id === activeTabId && setIsLoading(false)}
                  domStorageEnabled={true}
                  javaScriptEnabled={true}
                  style={{ flex: 1 }}
                />
              </View>
            ))}
            {isLoading && (
              <ActivityIndicator
                size="large"
                color={COLORS.blueAccent}
                style={styles.loadingIndicator}
              />
            )}
          </View>
        )}
      </View>

      {/* 4. Bottom Navigation Navigation Controls */}
      {!isSettingsOpen && (
        <BottomBar
          canGoBack={activeCanGoBack}
          canGoForward={activeCanGoForward}
          handleGoBack={() => webViewRefs.current[activeTabId]?.goBack()}
          handleGoForward={() => webViewRefs.current[activeTabId]?.goForward()}
          handleRefresh={handleRefresh}
          handleGoHome={handleGoHome}
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
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    width: 190,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.greyMedium,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: COLORS.textMedium,
    marginRight: 12,
    textAlign: 'right',
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.greyMedium,
    marginVertical: 4,
  },
  menuItemSettings: {
    backgroundColor: COLORS.redLightBg,
  },
  menuItemSettingsText: {
    color: COLORS.redWarning,
    fontWeight: 'bold',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -18,
  },
});
