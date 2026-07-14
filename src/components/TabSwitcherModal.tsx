import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TAB_SHADOW } from '../styles/globalStyles';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  screenshotUri?: string;
}

interface TabSwitcherModalProps {
  visible: boolean;
  tabs: BrowserTab[];
  activeTabId: string;
  handleSelectTab: (tabId: string) => void;
  handleCloseTab: (tabId: string) => void;
  handleAddNewTab: () => void;
  handleCloseAllTabs: () => void;
  handleClose: () => void;
  getDisplayDomain: (url: string) => string;
  isUrlBlocked: (url: string) => boolean;
}

function TabPreview({ url, screenshotUri, isBlocked, isActive }: { url: string; screenshotUri?: string; isBlocked: boolean; isActive: boolean }) {
  // If the url is blocked, show blocked shield icon
  if (isBlocked) {
    return (
      <View style={styles.blockedPreview}>
        <Ionicons
          name="shield-outline"
          size={32}
          color={COLORS.redWarning}
        />
      </View>
    );
  }

  // If we have a local screenshot URI, render it!
  if (screenshotUri) {
    return (
      <View style={styles.imagePreviewWrapper}>
        <Image
          source={{ uri: screenshotUri }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Otherwise, show default globe placeholder
  return (
    <View style={[styles.placeholderPreview, { backgroundColor: isActive ? COLORS.blueLight : COLORS.greyLight }]}>
      <Ionicons
        name="globe-outline"
        size={32}
        color={isActive ? COLORS.blueAccent : COLORS.textLight}
      />
    </View>
  );
}

export default function TabSwitcherModal({
  visible,
  tabs,
  activeTabId,
  handleSelectTab,
  handleCloseTab,
  handleAddNewTab,
  handleCloseAllTabs,
  handleClose,
  getDisplayDomain,
  isUrlBlocked,
}: TabSwitcherModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.switcherContainer}>
        {/* Header */}
        <View style={styles.switcherHeader}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.switcherHeaderBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.switcherTitle}>
            {tabs.length} {tabs.length === 1 ? 'כרטיסייה' : 'כרטיסיות'}
          </Text>
          <TouchableOpacity onPress={handleAddNewTab} style={styles.switcherHeaderBtn}>
            <Ionicons name="add" size={26} color={COLORS.blueAccent} />
          </TouchableOpacity>
        </View>

        {/* Tab Grid */}
        <ScrollView
          contentContainerStyle={styles.switcherGrid}
          showsVerticalScrollIndicator={false}
        >
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const domain = getDisplayDomain(tab.url);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabCard,
                  isActive && styles.tabCardActive,
                ]}
                onPress={() => handleSelectTab(tab.id)}
                activeOpacity={0.85}
              >
                {/* Tab Card Header — with favicon placeholder + title + close */}
                <View style={[
                  styles.tabCardHeader,
                  isActive && styles.tabCardHeaderActive,
                ]}>
                  <View style={styles.tabCardHeaderLeft}>
                    <View style={styles.faviconContainer}>
                      <Ionicons
                        name="globe-outline"
                        size={14}
                        color={isActive ? COLORS.blueAccent : COLORS.textLight}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tabCardTitle,
                        isActive && styles.tabCardTitleActive,
                      ]}
                    >
                      {tab.title || domain}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCloseTab(tab.id)}
                    style={styles.tabCardCloseBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={16} color={COLORS.greyDark} />
                  </TouchableOpacity>
                </View>

                {/* Tab Card Body — page preview */}
                <View style={styles.tabCardBody}>
                  <View style={styles.pagePreview}>
                    <TabPreview
                      url={tab.url}
                      screenshotUri={tab.screenshotUri}
                      isBlocked={isUrlBlocked(tab.url)}
                      isActive={isActive}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.tabCardUrl}>
                    {tab.url.replace(/^https?:\/\/(www\.)?/i, '')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.switcherFooter}>
          <TouchableOpacity
            onPress={handleCloseAllTabs}
            style={styles.switcherCloseAllBtn}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.redWarning} style={{ marginLeft: 6 }} />
            <Text style={styles.switcherCloseAllText}>סגור הכל</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAddNewTab}
            style={styles.switcherNewTabBtn}
          >
            <Ionicons name="add-circle" size={18} color={COLORS.blueAccent} style={{ marginLeft: 6 }} />
            <Text style={styles.switcherNewTabText}>כרטיסייה חדשה</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  switcherContainer: {
    flex: 1,
    backgroundColor: COLORS.surfaceGrey,
  },
  switcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  switcherHeaderBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  switcherTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  switcherGrid: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tabCard: {
    width: '48%',
    height: 195,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    overflow: 'hidden',
    ...TAB_SHADOW,
  },
  tabCardActive: {
    borderColor: COLORS.blueAccent,
    borderWidth: 2,
  },
  tabCardHeader: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.greyLight,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  tabCardHeaderActive: {
    backgroundColor: COLORS.blueLight,
  },
  tabCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  faviconContainer: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tabCardCloseBtn: {
    padding: 4,
  },
  tabCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
    flex: 1,
  },
  tabCardTitleActive: {
    color: COLORS.blueAccent,
  },
  tabCardBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  pagePreview: {
    flex: 1,
  },
  imagePreviewWrapper: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewLoading: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderPreview: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedPreview: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: COLORS.redLightBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabCardUrl: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: 'left',
    marginTop: 4,
  },
  switcherFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  switcherCloseAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  switcherCloseAllText: {
    color: COLORS.redWarning,
    fontSize: 14,
    fontWeight: '600',
  },
  switcherNewTabBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.blueLight,
  },
  switcherNewTabText: {
    color: COLORS.blueAccent,
    fontSize: 14,
    fontWeight: '600',
  },
});
