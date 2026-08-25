import AsyncStorage from '@react-native-async-storage/async-storage';

/** Central list of AsyncStorage keys — avoids typo'd duplicate string literals across hooks. */
export const STORAGE_KEYS = {
  pin: '@browser_pin',
  blacklist: '@browser_blacklist',
  autoBlock: '@browser_autoblock',
  downloads: '@browser_downloads',
  history: '@browser_history',
  bookmarks: '@browser_bookmarks',
  tabs: '@browser_tabs',
  activeTabId: '@browser_active_tab_id',
  dnsFilter: '@browser_dns_filter_enabled',
  dnsCache: '@browser_dns_cache',
} as const;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    console.error(`Failed to read "${key}" from storage`, e);
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write "${key}" to storage`, e);
  }
}

/** Plain-string read/write — for values that were never JSON-encoded (pin, autoBlock flag, active tab id). */
export async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.error(`Failed to read "${key}" from storage`, e);
    return null;
  }
}

export async function setString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to write "${key}" to storage`, e);
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove "${key}" from storage`, e);
  }
}
