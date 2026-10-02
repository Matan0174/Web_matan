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
  onSharePage: () => void;
  isCurrentPageBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onClearCache: () => void;
  onQuickBlockSite: () => void;
  onOpenSettings: () => void;
  onAddNewTab: () => void;
  isDesktopSite: boolean;
  onToggleDesktopSite: () => void;
}

export default function DropdownMenuModal({
  visible,
  onClose,
  onGoBack,
  onGoForward,
  onRefresh,
  onGoHome,
  onSharePage,
  isCurrentPageBookmarked,
  onToggleBookmark,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onClearCache,
  onQuickBlockSite,
  onOpenSettings,
  onAddNewTab,
  isDesktopSite,
  onToggleDesktopSite,
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
          {/* Icon action row — Chrome keeps these flat, with no button chrome */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoBack();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-forward" size={22} color={COLORS.textDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoForward();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onToggleBookmark}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons
                name={isCurrentPageBookmarked ? 'star' : 'star-outline'}
                size={22}
                color={isCurrentPageBookmarked ? COLORS.blueAccent : COLORS.textDark}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoHome();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="home-outline" size={21} color={COLORS.textDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onRefresh();
              }}
              style={styles.navBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="reload" size={21} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuDivider} />

          {/* New tab — Chrome's first menu entry */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onAddNewTab();
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>כרטיסייה חדשה</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

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

          {/* Clear browsing data */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onClearCache();
            }}
          >
            <Ionicons name="trash-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>ניקוי נתוני גלישה</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

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

          {/* Bookmarks */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenBookmarks();
            }}
          >
            <Ionicons name="star-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>סימניות</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Share */}
          <TouchableOpacity style={styles.menuItem} onPress={onSharePage}>
            <Ionicons
              name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
              size={22}
              color={COLORS.greyDark}
            />
            <Text style={styles.menuItemText}>שיתוף...</Text>
          </TouchableOpacity>

          {/* Find in page */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              Alert.alert('חיפוש בדף', 'פיצ\'ר חיפוש בדף יתווסף בגרסה הבאה.');
            }}
          >
            <Ionicons name="search-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>חיפוש בדף</Text>
          </TouchableOpacity>

          {/* Desktop site toggle — Chrome shows a checkbox on the trailing edge */}
          <TouchableOpacity style={styles.menuItem} onPress={onToggleDesktopSite}>
            <Ionicons name="desktop-outline" size={22} color={COLORS.greyDark} />
            <Text style={styles.menuItemText}>לגרסה במחשב</Text>
            <View style={[styles.checkbox, isDesktopSite && styles.checkboxChecked]}>
              {isDesktopSite && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
            </View>
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
    borderRadius: 16,
    width: 268,
    paddingVertical: 8,
    ...DROPDOWN_SHADOW,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'right',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.greyMedium,
    marginVertical: 4,
    marginHorizontal: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  navBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: COLORS.greyDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.blueAccent,
    borderColor: COLORS.blueAccent,
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
