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
import { COLORS } from '../styles/globalStyles';

import { BookmarkItem } from '../types/browser';
import { SafeAreaView } from 'react-native-safe-area-context';

export type { BookmarkItem };

interface BookmarksModalProps {
  visible: boolean;
  bookmarks: BookmarkItem[];
  handleNavigateToUrl: (url: string) => void;
  handleRemoveBookmark: (id: string) => void;
  handleClose: () => void;
}

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

export default function BookmarksModal({
  visible,
  bookmarks,
  handleNavigateToUrl,
  handleRemoveBookmark,
  handleClose,
}: BookmarksModalProps) {
  const confirmRemove = (id: string, title: string) => {
    Alert.alert(
      'מחיקת סימנייה',
      `האם למחוק את הסימנייה "${title}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => handleRemoveBookmark(id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BookmarkItem }) => (
    <TouchableOpacity
      style={styles.bookmarkRow}
      onPress={() => handleNavigateToUrl(item.url)}
      activeOpacity={0.6}
    >
      <View style={styles.bookmarkIconContainer}>
        <Ionicons name="bookmark" size={18} color={COLORS.blueAccent} />
      </View>
      <View style={styles.bookmarkTextContainer}>
        <Text style={styles.bookmarkTitle} numberOfLines={1}>
          {item.title || getDomain(item.url)}
        </Text>
        <Text style={styles.bookmarkUrl} numberOfLines={1}>
          {getDomain(item.url)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => confirmRemove(item.id, item.title || getDomain(item.url))}
        style={styles.deleteBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
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
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>סימניות</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Content */}
        {bookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={COLORS.greyMedium} />
            <Text style={styles.emptyText}>אין סימניות עדיין</Text>
            <Text style={styles.emptySubtext}>הוסף סימניות מתפריט האפשרויות</Text>
          </View>
        ) : (
          <FlatList
            data={bookmarks}
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
    flexDirection: 'row',
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
  listContent: {
    paddingBottom: 20,
  },
  bookmarkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  bookmarkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  bookmarkTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bookmarkTitle: {
    fontSize: 15,
    color: COLORS.textDark,
    fontWeight: '500',
    textAlign: 'right',
    marginBottom: 2,
  },
  bookmarkUrl: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'right',
  },
  deleteBtn: {
    padding: 6,
    marginRight: 8,
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
