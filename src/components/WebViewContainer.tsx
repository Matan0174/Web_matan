import React from 'react';
import { View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { BrowserTab } from '../types/browser';

interface WebViewContainerProps {
  tabs: BrowserTab[];
  activeTabId: string;
  webViewRefs: React.MutableRefObject<{ [key: string]: WebView | null }>;
  viewRefs: React.MutableRefObject<{ [key: string]: View | null }>;
  injectedJavaScript: string;
  onMessage: (event: any, tabId: string) => void;
  onNavigationStateChange: (navState: WebViewNavigation, tabId: string) => void;
  onShouldStartLoadWithRequest: (request: any, tabId: string) => boolean;
  onDownloadStart: (event: any) => void;
  onLoadStart: (tabId: string) => void;
  onLoadProgress: (tabId: string, progress: number) => void;
  onLoadEnd: (tabId: string) => void;
}

export default function WebViewContainer({
  tabs,
  activeTabId,
  webViewRefs,
  viewRefs,
  injectedJavaScript,
  onMessage,
  onNavigationStateChange,
  onShouldStartLoadWithRequest,
  onDownloadStart,
  onLoadStart,
  onLoadProgress,
  onLoadEnd,
}: WebViewContainerProps) {
  return (
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
            injectedJavaScript={injectedJavaScript}
            onMessage={(e) => onMessage(e, tab.id)}
            pullToRefreshEnabled={false}
            onNavigationStateChange={(navState) => onNavigationStateChange(navState, tab.id)}
            onShouldStartLoadWithRequest={(request) => onShouldStartLoadWithRequest(request, tab.id)}
            onDownloadStart={(event: any) => onDownloadStart(event)}
            onLoadStart={() => onLoadStart(tab.id)}
            onLoadProgress={({ nativeEvent }) => onLoadProgress(tab.id, nativeEvent.progress)}
            onLoadEnd={() => onLoadEnd(tab.id)}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            // ── Live Video & Stream Playback ──
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            allowsFullscreenVideo={true}
            mixedContentMode="compatibility"
            allowsBackForwardNavigationGestures={true}
            javaScriptCanOpenWindowsAutomatically={true}
            allowFileAccess={true}
            mediaCapturePermissionGrantType="grant"
            // ── Fullscreen Video (Android) ──
            androidLayerType="hardware"
            thirdPartyCookiesEnabled={true}
            setSupportMultipleWindows={false}
            userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
            style={{ flex: 1 }}
          />
        </View>
      ))}
    </View>
  );
}
