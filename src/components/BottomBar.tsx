import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/globalStyles';

interface BottomBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleRefresh: () => void;
  handleGoHome: () => void;
}

export default function BottomBar({
  canGoBack,
  canGoForward,
  handleGoBack,
  handleGoForward,
  handleRefresh,
  handleGoHome,
}: BottomBarProps) {
  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity
        onPress={handleGoBack}
        disabled={!canGoBack}
        style={[styles.bottomBarBtn, !canGoBack && styles.bottomBarBtnDisabled]}
      >
        <Ionicons
          name="chevron-back"
          size={26}
          color={canGoBack ? COLORS.textDark : COLORS.greyMedium}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleGoForward}
        disabled={!canGoForward}
        style={[styles.bottomBarBtn, !canGoForward && styles.bottomBarBtnDisabled]}
      >
        <Ionicons
          name="chevron-forward"
          size={26}
          color={canGoForward ? COLORS.textDark : COLORS.greyMedium}
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRefresh} style={styles.bottomBarBtn}>
        <Ionicons name="reload" size={20} color={COLORS.textDark} />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleGoHome} style={styles.bottomBarBtn}>
        <Ionicons name="home-outline" size={22} color={COLORS.textDark} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 52,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyLight,
    backgroundColor: COLORS.white,
  },
  bottomBarBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBarBtnDisabled: {
    opacity: 0.4,
  },
});
