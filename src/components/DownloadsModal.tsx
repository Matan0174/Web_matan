import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/globalStyles';

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  timestamp: number;
}

interface DownloadsModalProps {
  visible: boolean;
  downloads: DownloadItem[];
  handleClearDownloads: () => void;
  handleClose: () => void;
}

export default function DownloadsModal({
  visible,
  downloads,
  handleClearDownloads,
  handleClose,
}: DownloadsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.downloadsContainer}>
        <View style={styles.downloadsHeader}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.downloadsBackBtn}
          >
            <Ionicons name="arrow-forward" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.downloadsTitle}>הורדות</Text>
          <TouchableOpacity
            onPress={handleClearDownloads}
            style={styles.downloadsClearBtn}
          >
            <Text style={styles.downloadsClearText}>נקה הכל</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.downloadsList}>
          {downloads.length === 0 ? (
            <View style={styles.emptyDownloads}>
              <Ionicons name="download-outline" size={64} color={COLORS.greyMedium} />
              <Text style={styles.emptyDownloadsText}>אין קבצים שהורדו.</Text>
            </View>
          ) : (
            downloads.map(item => (
              <View key={item.id} style={styles.downloadItemCard}>
                <View style={styles.downloadItemIcon}>
                  <Ionicons name="document-text-outline" size={28} color={COLORS.blueAccent} />
                </View>
                <View style={styles.downloadItemDetails}>
                  <Text numberOfLines={1} style={styles.downloadItemName}>
                    {item.filename}
                  </Text>
                  <Text numberOfLines={1} style={styles.downloadItemUrl}>
                    {item.url}
                  </Text>
                  <Text style={styles.downloadItemTime}>
                    {new Date(item.timestamp).toLocaleString('he-IL')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.url)}
                  style={styles.downloadItemOpenBtn}
                >
                  <Ionicons name="open-outline" size={20} color={COLORS.blueAccent} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  downloadsContainer: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  downloadsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
  },
  downloadsBackBtn: {
    padding: 6,
  },
  downloadsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  downloadsClearBtn: {
    padding: 6,
  },
  downloadsClearText: {
    color: COLORS.redWarning,
    fontSize: 14,
    fontWeight: 'bold',
  },
  downloadsList: {
    padding: 16,
  },
  emptyDownloads: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyDownloadsText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 16,
  },
  downloadItemCard: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.greyMedium,
    alignItems: 'center',
  },
  downloadItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  downloadItemDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  downloadItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: 2,
    textAlign: 'right',
  },
  downloadItemUrl: {
    fontSize: 11,
    color: COLORS.greyDark,
    marginBottom: 4,
    textAlign: 'right',
  },
  downloadItemTime: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  downloadItemOpenBtn: {
    padding: 8,
  },
});
