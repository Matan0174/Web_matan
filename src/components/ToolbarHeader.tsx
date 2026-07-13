import React from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../styles/globalStyles';

interface ToolbarHeaderProps {
  urlInput: string;
  setUrlInput: (text: string) => void;
  displayUrl: string;
  isHttps: boolean;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  tabsCount: number;
  handleGoHome: () => void;
  handleNavigate: () => void;
  handleOpenMenu: () => void;
  handleOpenTabSwitcher: () => void;
}

export default function ToolbarHeader({
  urlInput,
  setUrlInput,
  displayUrl,
  isHttps,
  isInputFocused,
  setIsInputFocused,
  tabsCount,
  handleGoHome,
  handleNavigate,
  handleOpenMenu,
  handleOpenTabSwitcher,
}: ToolbarHeaderProps) {
  return (
    <View style={styles.toolbarHeader}>
      <TouchableOpacity onPress={handleGoHome} style={styles.iconButton} activeOpacity={0.6}>
        <Ionicons name="home-outline" size={24} color={COLORS.greyDark} />
      </TouchableOpacity>

      <View style={styles.addressBarContainer}>
        {isHttps && !isInputFocused && (
          <Ionicons name="lock-closed" size={14} color={COLORS.greenSecure} style={styles.lockIcon} />
        )}
        <TextInput
          style={styles.addressBarInput}
          value={isInputFocused ? urlInput : displayUrl}
          onChangeText={setUrlInput}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          onSubmitEditing={handleNavigate}
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          placeholder="חפש בגוגל או הזן כתובת אתר"
          placeholderTextColor="#9aa0a6"
        />
        {isInputFocused && urlInput.length > 0 && (
          <TouchableOpacity onPress={() => setUrlInput('')} style={styles.clearInputBtn}>
            <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Indicator Button */}
      <TouchableOpacity
        style={styles.tabIndicatorButton}
        activeOpacity={0.6}
        onPress={handleOpenTabSwitcher}
      >
        <View style={styles.tabIndicatorBox}>
          <Text style={styles.tabIndicatorText}>{tabsCount}</Text>
        </View>
      </TouchableOpacity>

      {/* 3-Dots Menu Button */}
      <TouchableOpacity
        onPress={handleOpenMenu}
        style={styles.iconButton}
        activeOpacity={0.6}
      >
        <Ionicons name="ellipsis-vertical" size={22} color={COLORS.greyDark} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    ...SHADOWS,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  addressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greyLight,
    borderRadius: 24,
    height: 40,
    marginHorizontal: 8,
    paddingHorizontal: 12,
  },
  lockIcon: {
    marginRight: 6,
  },
  addressBarInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    paddingVertical: 0,
    textAlign: 'left',
  },
  clearInputBtn: {
    marginLeft: 6,
  },
  tabIndicatorButton: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.greyDark,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.greyDark,
    lineHeight: 13,
  },
});
