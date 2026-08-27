import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DownloadItem } from '../types/browser';
import { guessDownloadFilename, sniffMimeFromBase64 } from '../utils/urlHelper';
import { STORAGE_KEYS, setJSON, removeItem } from '../utils/storage';
import {
  ensureDownloadDirectory,
  saveToPublicFolder,
  copyToPublicFolder,
} from '../utils/downloadStorage';

export function useDownloadManager(
  setIsLoading: (loading: boolean) => void,
  setLoadProgress: (progress: number) => void
) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  const handleDownloadStart = async (
    downloadUrl: string,
    userAgent?: string,
    contentDisposition?: string,
    mimeType?: string
  ) => {
    // Guess the correct filename and extension
    const filename = guessDownloadFilename(downloadUrl, contentDisposition, mimeType);

    Alert.alert(
      'הורדת קובץ',
      `האם ברצונך להוריד את הקובץ "${filename}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הורד',
          onPress: async () => {
            try {
              // Target URI in the document directory
              const fileUri = `${FileSystem.documentDirectory}${filename}`;
              
              // Set loading indicator
              setIsLoading(true);
              setLoadProgress(0);

              // Download the file using expo-file-system
              const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri, {
                headers: userAgent ? { 'User-Agent': userAgent } : {},
              });

              setIsLoading(false);
              setLoadProgress(1);

              if (downloadRes && downloadRes.status === 200) {
                const publicUri = await exportToChosenFolder(filename, mimeType, {
                  localUri: downloadRes.uri,
                });
                recordDownload(filename, downloadUrl, downloadRes.uri, mimeType, publicUri);
              } else {
                throw new Error('Server returned non-200 status code');
              }
            } catch (e) {
              setIsLoading(false);
              setLoadProgress(1);
              console.error('Download error:', e);
              
              // Fallback to system browser if native download fails
              Alert.alert(
                'ההורדה נכשלה',
                'נכשלה הורדת הקובץ בתוך האפליקציה. האם לנסות להוריד דרך דפדפן המכשיר?',
                [
                  { text: 'ביטול', style: 'cancel' },
                  {
                    text: 'פתח בדפדפן',
                    onPress: async () => {
                      try {
                        const canOpen = await Linking.canOpenURL(downloadUrl);
                        if (canOpen) {
                          await Linking.openURL(downloadUrl);
                        }
                      } catch (err) {
                        Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור.');
                      }
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  /**
   * Puts a copy of the finished file in the folder the user chose, so it shows
   * up in the Files app like any other download.
   *
   * A failure here never fails the download: the file is already saved and
   * openable from inside the app, so the only thing lost is its visibility
   * outside — worth saying out loud, not worth throwing away the file over.
   * Declining the folder prompt is a choice, not an error, and stays silent.
   */
  const exportToChosenFolder = async (
    filename: string,
    mimeType: string | undefined,
    source: { localUri?: string; base64?: string }
  ): Promise<string | undefined> => {
    try {
      const dirUri = await ensureDownloadDirectory();
      if (!dirUri) return undefined;
      const type = mimeType || 'application/octet-stream';
      if (source.base64 !== undefined) {
        return await saveToPublicFolder(dirUri, filename, type, source.base64);
      }
      if (source.localUri) {
        return await copyToPublicFolder(dirUri, filename, type, source.localUri);
      }
      return undefined;
    } catch (e) {
      console.error('Export to chosen folder failed', e);
      Alert.alert(
        'הקובץ נשמר, אך לא בתיקייה שבחרת',
        'לא ניתן היה לכתוב לתיקיית ההורדות. הקובץ זמין ברשימת ההורדות באפליקציה. אפשר לבחור תיקייה אחרת בהגדרות.'
      );
      return undefined;
    }
  };

  /**
   * Records a finished download and offers to open it.
   *
   * The functional update matters for the same reason it does above: two
   * downloads finishing close together would otherwise have the second drop
   * the first.
   */
  const recordDownload = (
    filename: string,
    url: string,
    fileUri: string,
    mimeType?: string,
    publicUri?: string
  ) => {
    const newItem: DownloadItem = {
      id: Math.random().toString(36).substring(7),
      filename,
      url,
      timestamp: Date.now(),
      fileUri,
      mimeType,
      publicUri,
    };
    setDownloads(prev => {
      const updated = [newItem, ...prev];
      setJSON(STORAGE_KEYS.downloads, updated);
      return updated;
    });

    Alert.alert(
      'ההורדה הושלמה',
      publicUri
        ? `הקובץ "${filename}" נשמר בתיקיית ההורדות שלך.`
        : `הקובץ "${filename}" ירד בהצלחה, אך נשמר רק בתוך האפליקציה. אפשר לבחור תיקיית הורדות בהגדרות כדי שקבצים יופיעו גם באפליקציית הקבצים.`,
      [
        { text: 'לא עכשיו', style: 'cancel' },
        { text: 'פתח / התקן', onPress: () => openDownload(newItem) },
      ]
    );
  };

  /**
   * Opens a downloaded file from the device.
   *
   * Goes through Sharing rather than `Linking.openURL`: the file sits in the
   * app's own private directory, and Android refuses a bare `file://` path into
   * another app's sandbox. Sharing hands over a content:// URI the receiving
   * app is actually allowed to read.
   *
   * The downloads list used to open `item.url` — the address the file came
   * from — which re-fetched the source instead of opening what was saved, and
   * did nothing at all for a file the page built, since those have no address.
   */
  const openDownload = async (item: DownloadItem) => {
    // Items saved before fileUri existed still resolve, because the filename
    // and the directory are all the path ever was.
    const fileUri = item.fileUri || `${FileSystem.documentDirectory}${item.filename}`;
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) {
        // The working copy is the disposable one, so it may well be gone while
        // the real download is still sitting in the user's folder.
        Alert.alert(
          'הקובץ לא נמצא',
          item.publicUri
            ? `"${item.filename}" כבר לא שמור בתוך האפליקציה, אבל הוא נמצא בתיקיית ההורדות שלך — אפשר לפתוח אותו משם.`
            : `"${item.filename}" כבר לא קיים במכשיר. ייתכן שנמחק.`
        );
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('שגיאה', 'שיתוף או פתיחת קבצים אינם נתמכים במכשיר זה.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: item.mimeType || 'application/octet-stream',
        dialogTitle: `פתח את ${item.filename}`,
      });
    } catch (err) {
      console.error('Open download error', err);
      Alert.alert('שגיאה', 'לא ניתן היה לפתוח את הקובץ.');
    }
  };

  /**
   * Saves a file the page read for us — see DOWNLOAD_INTERCEPT_JS.
   *
   * There is no confirmation step here, unlike handleDownloadStart: the bytes
   * have already been read by the time this runs, so asking permission to
   * fetch them would be asking after the fact. Tapping the download link is
   * the consent.
   */
  const saveInPageDownload = async (payload: {
    base64?: string;
    filename?: string;
    mime?: string;
  }) => {
    if (!payload.base64) return;
    // A page-built file has no meaningful URL to fall back on, so the download
    // attribute is the only real name; the type supplies the extension, and
    // the bytes themselves stand in when the page set no type on the Blob.
    const mime = payload.mime || sniffMimeFromBase64(payload.base64);
    const filename = guessDownloadFilename(payload.filename || '', undefined, mime);
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, payload.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // The bytes are already in hand, so the public copy is written straight
      // from them rather than reading the file back off disk.
      const publicUri = await exportToChosenFolder(filename, mime, { base64: payload.base64 });
      // No source URL: the file never existed anywhere but in the page.
      recordDownload(filename, '', fileUri, mime, publicUri);
    } catch (e) {
      console.error('In-page download save failed', e);
      Alert.alert('ההורדה נכשלה', 'לא ניתן היה לשמור את הקובץ במכשיר.');
    }
  };

  /**
   * Clears the list and reclaims the space its working copies were using.
   *
   * Only the app's own copies are deleted. The files in the user's chosen
   * folder are theirs — they are the download, indistinguishable by then from
   * anything else they saved — so clearing a list inside this app has no
   * business removing them.
   */
  const handleClearDownloads = async () => {
    const toDelete = downloads;
    setDownloads([]);
    await removeItem(STORAGE_KEYS.downloads);
    await Promise.all(
      toDelete.map(item => {
        const uri = item.fileUri || `${FileSystem.documentDirectory}${item.filename}`;
        return FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      })
    );
    Alert.alert('הצלחה', 'היסטוריית ההורדות נמחקה. הקבצים בתיקיית ההורדות שלך נשארו.');
  };

  return {
    downloads,
    setDownloads,
    isDownloadsOpen,
    setIsDownloadsOpen,
    handleDownloadStart,
    saveInPageDownload,
    openDownload,
    handleClearDownloads,
  };
}
