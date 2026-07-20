import { useState, useRef } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BrowserTab } from '../types/browser';

const DEFAULT_URL = 'https://www.google.com';

export function useTabManager() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: '1', url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isTabSwitcherOpen, setIsTabSwitcherOpen] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  const viewRefs = useRef<{ [key: string]: View | null }>({});

  // Track parent tab for each new tab (newTabId → parentTabId)
  const tabParentMap = useRef<{ [key: string]: string }>({});

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

  const handleAddNewTab = async (closeMenu?: () => void) => {
    if (closeMenu) closeMenu();
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
  };

  const handleCloseTab = (tabId: string) => {
    delete tabParentMap.current[tabId];

    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      const newId = Math.random().toString(36).substring(7);
      setTabs([
        { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
      ]);
      setActiveTabId(newId);
    } else {
      if (activeTabId === tabId) {
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
    tabParentMap.current = {};
    const newId = Math.random().toString(36).substring(7);
    setTabs([
      { id: newId, url: DEFAULT_URL, title: 'Google', canGoBack: false, canGoForward: false }
    ]);
    setActiveTabId(newId);
    setIsTabSwitcherOpen(false);
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || {
    id: '1',
    url: DEFAULT_URL,
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
    captureActiveTabScreenshot,
    handleOpenTabSwitcher,
    handleAddNewTab,
    handleCloseTab,
    handleCloseAllTabs,
  };
}
