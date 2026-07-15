import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Share,
  Platform,
  FlatList,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, DROPDOWN_SHADOW } from '../styles/globalStyles';

interface ToolbarHeaderProps {
  urlInput: string;
  setUrlInput: (text: string) => void;
  displayUrl: string;
  isHttps: boolean;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  tabsCount: number;
  isLoading: boolean;
  loadProgress: number;
  currentUrl: string;
  handleGoHome: () => void;
  handleNavigate: () => void;
  handleOpenMenu: () => void;
  handleOpenTabSwitcher: () => void;
  suggestions?: string[];
  onSelectSuggestion?: (suggestion: string) => void;
}

export default function ToolbarHeader({
  urlInput,
  setUrlInput,
  displayUrl,
  isHttps,
  isInputFocused,
  setIsInputFocused,
  tabsCount,
  isLoading,
  loadProgress,
  currentUrl,
  handleGoHome,
  handleNavigate,
  handleOpenMenu,
  handleOpenTabSwitcher,
  suggestions = [],
  onSelectSuggestion,
}: ToolbarHeaderProps) {
  // Animated progress bar width
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      progressOpacity.setValue(1);
      Animated.timing(progressAnim, {
        toValue: loadProgress,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      // Complete the bar and then fade out
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(progressOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(() => {
        progressAnim.setValue(0);
      });
    }
  }, [isLoading, loadProgress]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: currentUrl,
        url: currentUrl,
      });
    } catch (e) {
      // User cancelled or error
    }
  };

  const showSuggestions = isInputFocused && suggestions.length > 0;

  return (
    <View style={styles.toolbarWrapper}>
      <View style={styles.toolbarHeader}>
        {/* Address Bar — takes center stage like Chrome */}
        <View style={styles.addressBarContainer}>
          {/* Security indicator or search icon */}
          {isInputFocused ? (
            <Ionicons
              name="search"
              size={16}
              color={COLORS.textLight}
              style={styles.addressBarIcon}
            />
          ) : isHttps ? (
            <Ionicons
              name="lock-closed"
              size={14}
              color={COLORS.greenSecure}
              style={styles.addressBarIcon}
            />
          ) : (
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={COLORS.textLight}
              style={styles.addressBarIcon}
            />
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
            placeholderTextColor={COLORS.textDisabled}
          />

          {isInputFocused && urlInput.length > 0 ? (
            <TouchableOpacity
              onPress={() => setUrlInput('')}
              style={styles.clearInputBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ) : !isInputFocused ? (
            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
                size={18}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab Indicator Button — Chrome square with count */}
        <TouchableOpacity
          style={styles.tabIndicatorButton}
          activeOpacity={0.6}
          onPress={handleOpenTabSwitcher}
        >
          <View style={styles.tabIndicatorBox}>
            <Text style={styles.tabIndicatorText}>
              {tabsCount > 99 ? ':D' : tabsCount}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 3-Dots Menu Button */}
        <TouchableOpacity
          onPress={handleOpenMenu}
          style={styles.iconButton}
          activeOpacity={0.6}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.greyDark} />
        </TouchableOpacity>
      </View>

      {/* Chrome-style progress bar */}
      <Animated.View
        style={[
          styles.progressBarTrack,
          { opacity: progressOpacity },
        ]}
      >
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </Animated.View>

      {/* Search Suggestions Dropdown */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={`${item}-${index}`}
              style={[
                styles.suggestionRow,
                index === suggestions.length - 1 && styles.suggestionRowLast,
              ]}
              onPress={() => onSelectSuggestion?.(item)}
              activeOpacity={0.6}
            >
              <Ionicons
                name="search-outline"
                size={16}
                color={COLORS.textLight}
                style={styles.suggestionIcon}
              />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item}
              </Text>
              {/* Arrow to fill suggestion into input */}
              <TouchableOpacity
                onPress={() => setUrlInput(item)}
                style={styles.suggestionFillBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="arrow-up-outline" size={16} color={COLORS.textLight} style={{ transform: [{ rotate: '-45deg' }] }} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
    zIndex: 100,
    ...SHADOWS,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  addressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greyLight,
    borderRadius: 24,
    height: 40,
    marginHorizontal: 4,
    paddingHorizontal: 14,
  },
  addressBarIcon: {
    marginRight: 8,
  },
  addressBarInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    paddingVertical: 0,
    textAlign: 'left',
  },
  clearInputBtn: {
    marginLeft: 4,
    padding: 2,
  },
  shareBtn: {
    marginLeft: 4,
    padding: 2,
  },
  tabIndicatorButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.greyDark,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.greyDark,
    lineHeight: 13,
  },
  progressBarTrack: {
    height: 2.5,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.blueProgressBar,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  // Search Suggestions styles
  suggestionsContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    marginRight: 14,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
  },
  suggestionFillBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
