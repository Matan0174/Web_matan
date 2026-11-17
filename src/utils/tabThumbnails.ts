/**
 * Durable storage for the tab switcher's page previews.
 *
 * react-native-view-shot writes captures to the cache directory and, on
 * Android, wipes every one of them when the app process shuts down. A preview
 * left there is therefore gone after the app is swiped away, even though its
 * path is still saved with the tab. Each capture is moved into the app's
 * documents directory instead, which survives restarts.
 *
 * Every capture gets a fresh file name: <Image> caches by URI, so overwriting
 * one fixed file per tab would keep showing the stale picture.
 */
import * as FileSystem from 'expo-file-system/legacy';

const THUMBNAIL_DIR = `${FileSystem.documentDirectory}tab-thumbnails/`;

let dirReady: Promise<void> | null = null;

const ensureDir = (): Promise<void> => {
  if (!dirReady) {
    dirReady = FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, { intermediates: true }).catch(e => {
      dirReady = null;
      throw e;
    });
  }
  return dirReady;
};

export const isPersistedThumbnail = (uri?: string): uri is string =>
  !!uri && uri.startsWith(THUMBNAIL_DIR);

/** Moves a freshly captured temp file into permanent storage and returns its new URI. */
export const persistThumbnail = async (tabId: string, tempUri: string): Promise<string> => {
  await ensureDir();
  const target = `${THUMBNAIL_DIR}${tabId}_${Date.now()}.jpg`;
  await FileSystem.moveAsync({ from: tempUri, to: target });
  return target;
};

export const deleteThumbnail = async (uri?: string): Promise<void> => {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort — an orphan is swept up by pruneThumbnails later.
  }
};

/**
 * Returns the URI if it still points at a saved preview, otherwise undefined.
 * Paths from older builds point into the cache directory and are long gone.
 */
export const restoreThumbnail = async (uri?: string): Promise<string | undefined> => {
  if (!isPersistedThumbnail(uri)) return undefined;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Deletes every saved preview that no tab references any more. `isKept` is
 * consulted after the directory is listed, so a capture that lands meanwhile
 * is not swept away.
 */
export const pruneThumbnails = async (isKept: (uri: string) => boolean): Promise<void> => {
  try {
    await ensureDir();
    const names = await FileSystem.readDirectoryAsync(THUMBNAIL_DIR);
    await Promise.all(
      names
        .map(name => `${THUMBNAIL_DIR}${name}`)
        .filter(uri => !isKept(uri))
        .map(uri => deleteThumbnail(uri))
    );
  } catch (e) {
    console.warn('Failed to prune tab thumbnails', e);
  }
};
