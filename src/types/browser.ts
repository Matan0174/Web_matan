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
  /** Timestamp this tab was last the active tab — drives which tabs stay "warm" (mounted). */
  lastActiveAt?: number;
  /**
   * Set only on a tab opened by `window.open`: the tab that opened it, and the
   * id of the popup handle that call returned. Together they are the two ends
   * of the opener bridge — see buildOpenerBridgeJs. Both stay undefined for a
   * tab the user opened, which is what keeps the bridge out of ordinary pages.
   */
  openerTabId?: string;
  popupId?: string;
}

export interface DownloadItem {
  id: string;
  filename: string;
  /** Where the file came from. Empty for one the page built itself. */
  url: string;
  timestamp: number;
  /**
   * Where the file actually landed on the device. Optional only because items
   * saved before this field existed do not have it — see openDownload, which
   * reconstructs the path for those.
   */
  fileUri?: string;
  mimeType?: string;
  /**
   * The copy in the folder the user chose, as a SAF content:// URI — the one
   * that shows up in the Files app. Absent when no folder has been granted.
   */
  publicUri?: string;
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
