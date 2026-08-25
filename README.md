# Chrome Browser (web-matan)

A Chrome-style mobile browser built with Expo and `react-native-webview`, with a
PIN-protected content filter as its defining feature. UI is in Hebrew; RTL layout
flipping is deliberately disabled (`I18nManager.allowRTL(false)` in `App.tsx`).

## Requirements

- Node `>= 20.19.4` (see `.nvmrc`)
- npm `>= 10`
- Expo SDK 54 — run `npx expo install --check` after touching dependencies

## Running

```bash
npm install
npm start
```

`npm run android` / `npm run ios` build and launch a native dev client.
Release builds go through EAS (`eas.json` defines `development`, `preview` and
`production` profiles; `preview` produces an APK).

## Configuration

**All Expo config lives in `app.json`.** There used to be a second,
extension-less `app.config` file alongside it — Expo read *both* and let
`app.config` win key-by-key, which made the effective config hard to predict.
The two have been merged into `app.json`.

## Layout

```
App.tsx                      composition root: wires hooks to components
src/
  hooks/                     all stateful logic, one hook per concern
    useTabManager            tabs, warm/suspended WebViews, rate limiting
    useContentFilter         PIN, blacklist, keyword filter toggle
    useDownloadManager       download prompt, expo-file-system, sharing
    useHistoryAndBookmarks   history + bookmarks, persisted
    useSearchSuggestions     debounced Google suggest
    useDeepLinking           cold- and warm-start deep links
  components/                presentational; state comes in via props
  screens/SettingsScreen     blacklist management, behind the PIN
  utils/
    urlHelper                URL parsing, the content filter, download naming
    injectedScripts          JS injected into every page
    webviewNav               navigation/scroll injection (see note below)
    storage                  AsyncStorage keys and typed accessors
  constants/forbidden        filter keywords and their exceptions
```

## Things worth knowing before changing code

- **`BrowserTab.initialUrl` is set once and never updated.** It is the WebView's
  `source`; changing it replaces the navigation stack and destroys back history.
  Navigate with `injectNavigate` instead, and let `onNavigationStateChange`
  update `tab.url`.
- **Only 6 tabs keep a mounted WebView** (`WARM_TAB_LIMIT`). Older tabs render a
  placeholder and remount at their last URL when reselected.
- **Anything interpolated into injected JS must be escaped.** `webviewNav.ts`
  uses `JSON.stringify` for URLs and `Number()` for scroll coordinates,
  because both originate from page-controlled input.
- **The filter runs in three places** — `onShouldStartLoadWithRequest`, the
  `navigationRequest`/`windowOpen` postMessage handler, and
  `onNavigationStateChange` — because on Android release builds the first one
  does not reliably fire for client-side navigations.
- **Keyword matching is by substring** on the percent-decoded URL, so `porn`
  already covers `pornhub`, `hqporner` and so on. `KEYWORD_EXCEPTIONS` in
  `src/constants/forbidden.ts` carves out ordinary words that contain a keyword
  (`essex`, `adulthood`), so add there rather than weakening a keyword.
- **`android/` is checked in.** Regenerate with `npx expo prebuild` after
  changing anything in `app.json` that affects the native project.

## Known gaps

- The default PIN is `1234` and is stored unencrypted in AsyncStorage; the
  filter deters casual access, it is not a security boundary against someone
  with the device and adb.
- Address-bar keystrokes are sent to Google's suggest endpoint, including text
  the filter would block.
- No automated tests. `src/utils/urlHelper.ts` is pure and is the obvious place
  to start.
