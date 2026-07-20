export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  screenshotUri?: string;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}
