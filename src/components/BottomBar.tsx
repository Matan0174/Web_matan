import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BOTTOM_BAR_SHADOW } from '../styles/globalStyles';

interface BottomBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleRefresh: () => void;
  handleGoHome: () => void;
  handleOpenTabSwitcher: () => void;
}

export default function BottomBar({
  canGoBack,
  canGoForward,
  handleGoBack,
  handleGoForward,
  handleRefresh,
  handleGoHome,
  handleOpenTabSwitcher,
}: BottomBarProps) {
  return (
    <View style={styles.bottomBar}>
      {/* Back */}
      <TouchableOpacity
        onPress={handleGoBack}
        disabled={!canGoBack}
        style={styles.bottomBarBtn}
        activeOpacity={0.6}
      >
        <Ionicons
          name="chevron-back"
          size={24}
          color={canGoBack ? COLORS.textDark : COLORS.greyMedium}
        />
      </TouchableOpacity>

      {/* Forward */}
      <TouchableOpacity
        onPress={handleGoForward}
        disabled={!canGoForward}
        style={styles.bottomBarBtn}
        activeOpacity={0.6}
      >
        <Ionicons
          name="chevron-forward"
          size={24}
          color={canGoForward ? COLORS.textDark : COLORS.greyMedium}
        />
      </TouchableOpacity>

      {/* Home — center position, slightly larger */}
      <TouchableOpacity
        onPress={handleGoHome}
        style={[styles.bottomBarBtn, styles.homeBtn]}
        activeOpacity={0.6}
      >
        <Ionicons name="home-outline" size={22} color={COLORS.textDark} />
      </TouchableOpacity>

      {/* Refresh */}
      <TouchableOpacity
        onPress={handleRefresh}
        style={styles.bottomBarBtn}
        activeOpacity={0.6}
      >
        <Ionicons name="reload-outline" size={20} color={COLORS.textDark} />
      </TouchableOpacity>

      {/* Tab Switcher */}
      <TouchableOpacity
        onPress={handleOpenTabSwitcher}
        style={styles.bottomBarBtn}
        activeOpacity={0.6}
      >
        <View style={styles.tabSwitcherIcon}>
          <Ionicons name="copy-outline" size={18} color={COLORS.textDark} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.white,
    ...BOTTOM_BAR_SHADOW,
  },
  bottomBarBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeBtn: {
    // center emphasis
  },
  tabSwitcherIcon: {
    // Wrapper for visual clarity
  },
});
