import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DownloadItem } from '../types/browser';
import { guessDownloadFilename } from '../utils/urlHelper';
import { STORAGE_KEYS, setJSON, removeItem } from '../utils/storage';

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
                // Record to app's downloads list
                const newItem: DownloadItem = {
                  id: Math.random().toString(36).substring(7),
                  filename,
                  url: downloadUrl,
                  timestamp: Date.now(),
                };

                // Functional update + persist from inside the updater:
                // `downloads` here would be the value captured when the
                // Alert was rendered, so two downloads finishing close
                // together would make the second one drop the first.
                setDownloads(prev => {
                  const updated = [newItem, ...prev];
                  setJSON(STORAGE_KEYS.downloads, updated);
                  return updated;
                });

                Alert.alert(
                  'ההורדה הושלמה',
                  `הקובץ "${filename}" ירד בהצלחה. האם ברצונך לפתוח או להתקין אותו?`,
                  [
                    { text: 'לא עכשיו', style: 'cancel' },
                    {
                      text: 'פתח / התקן',
                      onPress: async () => {
                        try {
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(downloadRes.uri, {
                              mimeType: mimeType || 'application/octet-stream',
                              dialogTitle: `פתח את ${filename}`,
                            });
                          } else {
                            Alert.alert('שגיאה', 'שיתוף או פתיחת קבצים אינם נתמכים במכשיר זה.');
                          }
                        } catch (err) {
                          console.error('Sharing error', err);
                        }
                      }
                    }
                  ]
                );
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

  const handleClearDownloads = async () => {
    setDownloads([]);
    await removeItem(STORAGE_KEYS.downloads);
    Alert.alert('הצלחה', 'היסטוריית ההורדות נמחקה.');
  };

  return {
    downloads,
    setDownloads,
    isDownloadsOpen,
    setIsDownloadsOpen,
    handleDownloadStart,
    handleClearDownloads,
  };
}
