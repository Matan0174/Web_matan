import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, DROPDOWN_SHADOW } from '../styles/globalStyles';

interface DropdownMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onGoHome: () => void;
  onAddNewTab: () => void;
  onSharePage: () => void;
  isCurrentPageBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onQuickBlockSite: () => void;
  onOpenSettings: () => void;
}

export default function DropdownMenuModal({
  visible,
  onClose,
  onGoBack,
  onGoForward,
  onRefresh,
  onGoHome,
  onAddNewTab,
  onSharePage,
  isCurrentPageBookmarked,
  onToggleBookmark,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onQuickBlockSite,
  onOpenSettings,
}: DropdownMenuModalProps) {
  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.menuBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.dropdownMenu}>
          {/* Navigation Row: Back / Forward / Refresh / Home */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoForward();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={COLORS.textDark}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoBack();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={COLORS.textDark}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onRefresh();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="reload-outline" size={20} color={COLORS.textDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoHome();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="home-outline" size={20} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuDivider} />

          {/* New Tab */}
          <TouchableOpacity style={styles.menuItem} onPress={onAddNewTab}>
            <Ionicons name="add-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>כרטיסייה חדשה</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.menuItem} onPress={onSharePage}>
            <Ionicons
              name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
              size={22}
              color={COLORS.greyDark}
            />
            <Text style={styles.menuItemText}>שתף...</Text>
          </TouchableOpacity>

          {/* Bookmark Toggle */}
          <TouchableOpacity style={styles.menuItem} onPress={onToggleBookmark}>
            <Ionicons
              name={isCurrentPageBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isCurrentPageBookmarked ? COLORS.blueAccent : COLORS.greyDark}
            />
            <Text style={[styles.menuItemText, isCurrentPageBookmarked && { color: COLORS.blueAccent }]}>
              {isCurrentPageBookmarked ? 'הסר סימנייה' : 'הוסף סימנייה'}
            </Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Find in page */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              Alert.alert('מצא בדף', 'פיצ\'ר חיפוש בדף יתווסף בגרסה הבאה.');
            }}
          >
            <Ionicons name="search-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>מצא בדף</Text>
          </TouchableOpacity>

          {/* History */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenHistory();
            }}
          >
            <Ionicons name="time-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>היסטוריה</Text>
          </TouchableOpacity>

          {/* Bookmarks */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenBookmarks();
            }}
          >
            <Ionicons name="bookmark-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>סימניות</Text>
          </TouchableOpacity>

          {/* Downloads */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenDownloads();
            }}
          >
            <Ionicons name="download-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>הורדות</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Quick Block Site — no PIN required */}
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBlock]}
            onPress={onQuickBlockSite}
          >
            <Ionicons name="ban-outline" size={22} color={COLORS.redWarning} />
            <Text style={[styles.menuItemText, { color: COLORS.redWarning }]}>חסום אתר זה</Text>
          </TouchableOpacity>

          {/* Settings / Block Management — requires PIN */}
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemSettings]}
            onPress={onOpenSettings}
          >
            <MaterialCommunityIcons name="shield-lock-outline" size={22} color={COLORS.redWarning} />
            <Text style={[styles.menuItemText, styles.menuItemSettingsText]}>הגדרות חסימה</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: COLORS.backdropLight,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: 220,
    paddingVertical: 8,
    ...DROPDOWN_SHADOW,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 13,
    paddingHorizontal: 18,
    gap: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: COLORS.textMedium,
    textAlign: 'right',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
    marginHorizontal: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.greyLight,
  },
  menuItemBlock: {
    marginHorizontal: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  menuItemSettings: {
    backgroundColor: COLORS.redLightBg,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  menuItemSettingsText: {
    color: COLORS.redWarning,
    fontWeight: '600',
  },
});
