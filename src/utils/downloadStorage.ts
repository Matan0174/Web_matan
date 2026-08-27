/**
 * Putting downloads where the phone can actually see them.
 *
 * `FileSystem.documentDirectory` is the app's private sandbox
 * (`/data/user/0/<package>/files/`). Nothing else on the device can read it:
 * downloads saved there never appear in the Files app, are invisible to every
 * other app, and vanish with the app. That is why a downloaded file seemed to
 * disappear even though it had saved perfectly well.
 *
 * Writing to the real Downloads folder is not something an app may simply do
 * any more — since Android 10, scoped storage made `WRITE_EXTERNAL_STORAGE`
 * inert for that. The supported route is the Storage Access Framework: the
 * user picks a folder once, Android hands back a lasting grant for it, and
 * files written through that grant are ordinary visible files.
 *
 * Each download therefore lands twice, and both copies earn their place:
 *  - the SAF copy is the download proper — visible, permanent, the user's;
 *  - the private copy is what the in-app "open" button uses, because Sharing
 *    needs a real path and cannot re-share a `content://` grant made out to us.
 * The private copy is the disposable one, and clearing the list removes it.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { STORAGE_KEYS, getString, setString, removeItem } from './storage';

const { StorageAccessFramework: SAF } = FileSystem;

/** The folder the user granted us, or null if they never have. */
export const getDownloadDirectory = (): Promise<string | null> =>
  getString(STORAGE_KEYS.downloadDir);

export const forgetDownloadDirectory = (): Promise<void> =>
  removeItem(STORAGE_KEYS.downloadDir);

/**
 * Asks the user to choose the folder downloads are saved to.
 *
 * The picker opens on Downloads, which is where this is nearly always headed,
 * but the choice is theirs and it is remembered until they change it.
 */
export const chooseDownloadDirectory = async (): Promise<string | null> => {
  try {
    const initial = SAF.getUriForDirectoryInRoot('Download');
    const permission = await SAF.requestDirectoryPermissionsAsync(initial);
    if (!permission.granted) return null;
    await setString(STORAGE_KEYS.downloadDir, permission.directoryUri);
    return permission.directoryUri;
  } catch (e) {
    console.error('Choosing a download directory failed', e);
    return null;
  }
};

/**
 * The folder to save into, asking for one only if we have never been given it.
 *
 * A stored grant can stop working — the folder is deleted, or the user revokes
 * it — and Android only reveals that when the write is attempted, so callers
 * must still handle failure rather than trusting a non-null answer here.
 */
export const ensureDownloadDirectory = async (): Promise<string | null> => {
  const saved = await getDownloadDirectory();
  if (saved) return saved;
  return chooseDownloadDirectory();
};

/**
 * Writes a file into the granted folder and returns its content:// URI.
 *
 * SAF gives a duplicate name its own "(1)" suffix rather than overwriting,
 * which is what a browser should do and what the private copy does not.
 */
export const saveToPublicFolder = async (
  dirUri: string,
  filename: string,
  mimeType: string,
  base64: string
): Promise<string> => {
  const target = await SAF.createFileAsync(dirUri, filename, mimeType || 'application/octet-stream');
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return target;
};

/**
 * Copies a file already saved privately into the granted folder.
 *
 * Reading the whole file as base64 to write it back out is wasteful, so the
 * framework's own copy is tried first; it is the one that avoids holding the
 * file in memory. It does not work everywhere, hence the fallback.
 */
export const copyToPublicFolder = async (
  dirUri: string,
  filename: string,
  mimeType: string,
  localUri: string
): Promise<string> => {
  try {
    await SAF.copyAsync({ from: localUri, to: dirUri });
    // copyAsync reports nothing back, so the file is located by the name it
    // must have been given.
    const entries = await SAF.readDirectoryAsync(dirUri);
    const match = entries.find(uri => decodeURIComponent(uri).endsWith('/' + filename));
    if (match) return match;
  } catch (e) {
    // Fall through to writing the bytes ourselves.
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return saveToPublicFolder(dirUri, filename, mimeType, base64);
};

/**
 * A folder name worth showing a person, dug out of the SAF URI.
 *
 * These look like `content://com.android.externalstorage.documents/tree/primary%3ADownload`,
 * so the readable part is the last path segment once decoded.
 */
export const describeDownloadDirectory = (dirUri: string | null): string => {
  if (!dirUri) return 'לא נבחרה תיקייה';
  try {
    const decoded = decodeURIComponent(dirUri);
    const afterColon = decoded.slice(decoded.lastIndexOf(':') + 1);
    return afterColon || decoded;
  } catch {
    return dirUri;
  }
};
