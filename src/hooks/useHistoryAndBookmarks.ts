import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryItem, BookmarkItem } from '../types/browser';

export function useHistoryAndBookmarks(activeTabUrl: string, activeTabTitle: string, navigateTo: (url: string) => void) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // History helpers
  const handleClearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('@browser_history');
  };

  const handleHistoryNavigate = (url: string) => {
    setIsHistoryOpen(false);
    navigateTo(url);
  };

  const addHistoryItem = (url: string, pageTitle: string) => {
    setHistory(prev => {
      if (prev.length > 0 && prev[0].url === url) return prev;
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(7),
        url,
        title: pageTitle,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...prev].slice(0, 500);
      AsyncStorage.setItem('@browser_history', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // Bookmarks helpers
  const isCurrentPageBookmarked = bookmarks.some(b => b.url === activeTabUrl);

  const handleToggleBookmark = async (closeMenu?: () => void) => {
    if (closeMenu) closeMenu();
    if (isCurrentPageBookmarked) {
      const updated = bookmarks.filter(b => b.url !== activeTabUrl);
      setBookmarks(updated);
      await AsyncStorage.setItem('@browser_bookmarks', JSON.stringify(updated));
    } else {
      const newBookmark: BookmarkItem = {
        id: Math.random().toString(36).substring(7),
        url: activeTabUrl,
        title: activeTabTitle,
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

  return {
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
  };
}
