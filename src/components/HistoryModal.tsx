import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DROPDOWN_SHADOW } from '../styles/globalStyles';

import { HistoryItem } from '../types/browser';
import { SafeAreaView } from 'react-native-safe-area-context';

export type { HistoryItem };

interface HistoryModalProps {
  visible: boolean;
  history: HistoryItem[];
  handleNavigateToUrl: (url: string) => void;
  handleClearHistory: () => void;
  handleClose: () => void;
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דק׳`;
  if (diffHours < 24) return `לפני ${diffHours} שע׳`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
};

const getDomain = (url: string): string => {
  try {
    let domain = url;
    if (domain.includes('://')) {
      domain = domain.split('://')[1];
    }
    domain = domain.split('/')[0];
    return domain;
  } catch {
    return url;
  }
};

export default function HistoryModal({
  visible,
  history,
  handleNavigateToUrl,
  handleClearHistory,
  handleClose,
}: HistoryModalProps) {
  const confirmClear = () => {
    Alert.alert(
      'מחיקת היסטוריה',
      'האם למחוק את כל ההיסטוריה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: handleClearHistory,
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={styles.historyRow}
      onPress={() => handleNavigateToUrl(item.url)}
      activeOpacity={0.6}
    >
      <View style={styles.historyIconContainer}>
        <Ionicons name="time-outline" size={18} color={COLORS.textLight} />
      </View>
      <View style={styles.historyTextContainer}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {item.title || getDomain(item.url)}
        </Text>
        <Text style={styles.historyUrl} numberOfLines={1}>
          {getDomain(item.url)}
        </Text>
      </View>
      <Text style={styles.historyTime}>{formatDate(item.timestamp)}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>היסטוריה</Text>
          {history.length > 0 ? (
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={20} color={COLORS.redWarning} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Content */}
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={COLORS.greyMedium} />
            <Text style={styles.emptyText}>אין היסטוריה עדיין</Text>
            <Text style={styles.emptySubtext}>הדפים שתבקר בהם יופיעו כאן</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  clearBtn: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  historyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  historyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.greyLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  historyTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyTitle: {
    fontSize: 15,
    color: COLORS.textDark,
    fontWeight: '500',
    textAlign: 'right',
    marginBottom: 2,
  },
  historyUrl: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'right',
  },
  historyTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginRight: 12,
    minWidth: 60,
    textAlign: 'left',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 6,
  },
});
