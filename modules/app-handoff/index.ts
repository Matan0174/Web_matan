import { requireOptionalNativeModule } from 'expo';

interface AppHandoffNative {
  openInApp(url: string): boolean;
}

// Optional so a build without the native side (iOS, an older APK) just stays in the browser.
const native = requireOptionalNativeModule<AppHandoffNative>('AppHandoff');

/**
 * Launches the app installed for an http(s) address, if there is one.
 * Returns true when an app took it; false means load it in the tab.
 */
export const openInApp = (url: string): boolean => {
  if (!native) return false;
  try {
    return native.openInApp(url);
  } catch {
    return false;
  }
};
