import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TAB_SHADOW } from '../styles/globalStyles';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
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
}: TabSwitcherModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.switcherContainer}>
        <View style={styles.switcherHeader}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.switcherHeaderBtn}
          >
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.switcherTitle}>כרטיסיות פתוחות</Text>
          <TouchableOpacity onPress={handleAddNewTab} style={styles.switcherHeaderBtn}>
            <Ionicons name="add" size={24} color={COLORS.blueAccent} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.switcherGrid}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabCard,
                  isActive && styles.tabCardActive,
                ]}
                onPress={() => handleSelectTab(tab.id)}
                activeOpacity={0.8}
              >
                <View style={styles.tabCardHeader}>
                  <TouchableOpacity
                    onPress={() => handleCloseTab(tab.id)}
                    style={styles.tabCardCloseBtn}
                  >
                    <Ionicons name="close" size={16} color={COLORS.greyDark} />
                  </TouchableOpacity>
                  <Text numberOfLines={1} style={styles.tabCardTitle}>
                    {tab.title}
                  </Text>
                </View>
                <View style={styles.tabCardBody}>
                  <Ionicons name="globe-outline" size={30} color="#b0b3b8" />
                  <Text numberOfLines={2} style={styles.tabCardUrl}>
                    {getDisplayDomain(tab.url)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.switcherFooter}>
          <TouchableOpacity
            onPress={handleCloseAllTabs}
            style={styles.switcherCloseAllBtn}
          >
            <Text style={styles.switcherCloseAllText}>סגור את כל הכרטיסיות</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  switcherContainer: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  switcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
  },
  switcherHeaderBtn: {
    padding: 6,
  },
  switcherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  switcherGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tabCard: {
    width: '48%',
    height: 160,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.greyMedium,
    overflow: 'hidden',
    ...TAB_SHADOW,
  },
  tabCardActive: {
    borderColor: COLORS.blueAccent,
    borderWidth: 2,
  },
  tabCardHeader: {
    height: 36,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.greyLight,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
  },
  tabCardCloseBtn: {
    padding: 4,
  },
  tabCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textMedium,
    flex: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  tabCardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  tabCardUrl: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  switcherFooter: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyMedium,
    alignItems: 'center',
  },
  switcherCloseAllBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  switcherCloseAllText: {
    color: COLORS.redWarning,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
