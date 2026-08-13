import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { BrowserTab } from '../types/browser';

/** Placeholder shown for a tab whose WebView has been suspended to save memory. */
function SuspendedTabPlaceholder({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 24 }}>
      <Ionicons name="pause-circle-outline" size={40} color="#9aa0a6" />
      <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 15, fontWeight: '600', color: '#3c4043' }}>
        {title}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 12, color: '#9aa0a6', textAlign: 'center' }}>
        הכרטיסייה הושהתה לחיסכון בזיכרון — היא תיטען מחדש עם המעבר אליה
      </Text>
    </View>
  );
}

interface WebViewContainerProps {
  tabs: BrowserTab[];
  activeTabId: string;
  /** Ids of tabs allowed to keep a mounted WebView; the rest render a lightweight placeholder. */
  warmTabIds: Set<string>;
  webViewRefs: React.MutableRefObject<{ [key: string]: WebView | null }>;
  viewRefs: React.MutableRefObject<{ [key: string]: View | null }>;
  injectedJavaScript: string;
  injectedJavaScriptBeforeContentLoaded: string;
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
  warmTabIds,
  webViewRefs,
  viewRefs,
  injectedJavaScript,
  injectedJavaScriptBeforeContentLoaded,
  onMessage,
  onNavigationStateChange,
  onShouldStartLoadWithRequest,
  onDownloadStart,
  onLoadStart,
  onLoadProgress,
  onLoadEnd,
}: WebViewContainerProps) {
  // Track last valid URL to escape the Android renderError bug
  const lastValidUrls = React.useRef<{ [key: string]: string }>({});

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
          {!warmTabIds.has(tab.id) ? (
            <SuspendedTabPlaceholder title={tab.title} />
          ) : (
          <WebView
            ref={el => { webViewRefs.current[tab.id] = el; }}
            source={{ uri: tab.initialUrl }}
            injectedJavaScript={injectedJavaScript}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            onMessage={(e) => onMessage(e, tab.id)}
            pullToRefreshEnabled={false}
            onNavigationStateChange={(navState) => {
              if (!navState.loading && navState.url && !navState.url.startsWith('data:') && !navState.url.startsWith('about:')) {
                lastValidUrls.current[tab.id] = navState.url;
              }
              onNavigationStateChange(navState, tab.id);
            }}
            onShouldStartLoadWithRequest={(request) => onShouldStartLoadWithRequest(request, tab.id)}
            onDownloadStart={(event: any) => onDownloadStart(event)}
            onLoadStart={() => onLoadStart(tab.id)}
            onLoadProgress={({ nativeEvent }) => onLoadProgress(tab.id, nativeEvent.progress)}
            onLoadEnd={() => onLoadEnd(tab.id)}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            // ── Live Video & Stream Playback ──
            originWhitelist={['*']}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            allowsFullscreenVideo={true}
            mixedContentMode="always"
            allowsBackForwardNavigationGestures={true}
            javaScriptCanOpenWindowsAutomatically={false}
            allowFileAccess={true}
            mediaCapturePermissionGrantType="grant"
            cacheEnabled={true}
            // ── Android Standalone Fixes ──
            // Using "none" instead of "hardware" — hardware layer type causes
            // rendering glitches and blank screens in Android release builds.
            androidLayerType="none"
            thirdPartyCookiesEnabled={true}
            setSupportMultipleWindows={false}
            userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
            // ── WebView Process Recovery (Android) ──
            // In standalone APK builds the WebView process can crash silently.
            // This handler reloads the last valid URL so the user isn't stuck
            // on a blank white screen.
            onRenderProcessGone={(event) => {
              const ref = webViewRefs.current[tab.id];
              if (ref) {
                const lastUrl = lastValidUrls.current[tab.id] || tab.url;
                try {
                  ref.injectJavaScript(`window.location.href = ${JSON.stringify(lastUrl)}; true;`);
                } catch (e) {
                  // injectJavaScript may fail if the process is gone; fallback to reload
                  ref.reload();
                }
              }
            }}
            // ── Error Handling ──
            startInLoadingState={true}
            renderError={(errorDomain, errorCode, errorDesc) => (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#dc3545', marginBottom: 10 }}>
                  שגיאה בטעינת הדף
                </Text>
                <Text style={{ fontSize: 14, color: '#6c757d', textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
                  לא ניתן היה לטעון את הכתובת. ייתכן שיש בעיית רשת, או שהאתר אינו זמין כעת.
                  {'\n\n'}{errorDesc}
                </Text>
                
                <TouchableOpacity 
                  onPress={() => {
                    const ref = webViewRefs.current[tab.id];
                    if (ref) {
                       if (tab.canGoBack) {
                         // Native goBack works even when JS is disabled on error pages
                         ref.goBack();
                       } else {
                         // If no history exists, force load Google
                         onMessage({ nativeEvent: { data: JSON.stringify({ type: 'forceNavigate', url: 'https://www.google.com' }) } }, tab.id);
                       }
                    }
                  }}
                  style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#007AFF', borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16 }}>חזור לדף הקודם</Text>
                </TouchableOpacity>
              </View>
            )}
            style={{ flex: 1 }}
          />
          )}
        </View>
      ))}
    </View>
  );
}
