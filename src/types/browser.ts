export interface BrowserTab {
  id: string;
  url: string;
  /** The URL used as the WebView `source`. Set once at tab creation and never
   *  updated afterwards so that re-renders don't reset the navigation stack. */
  initialUrl: string;
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
