import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/globalStyles';

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
  handleAddNewTab: () => void;
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
  handleAddNewTab,
  suggestions = [],
  onSelectSuggestion,
}: ToolbarHeaderProps) {
  // Animated progress bar width
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  /**
   * Edit mode is driven by the user touching the field, not by Android's focus
   * events: after a programmatic blur Android hands focus straight back, and an
   * onFocus-driven flag would put the bar back into edit mode on its own —
   * leaving it showing the typed text instead of the page that loaded.
   */
  useEffect(() => {
    if (isInputFocused) return;
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, [isInputFocused]);

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
        {/* Home Button — far left edge of the toolbar */}
        <TouchableOpacity
          onPress={handleGoHome}
          style={styles.iconButton}
          activeOpacity={0.6}
          accessibilityLabel="דף הבית"
        >
          <Ionicons name="home-outline" size={21} color={COLORS.textDark} />
        </TouchableOpacity>

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
            <MaterialIcons
              name="tune"
              size={16}
              color={COLORS.greyDark}
              style={styles.addressBarIcon}
            />
          ) : (
            <Ionicons
              name="warning-outline"
              size={16}
              color={COLORS.redWarning}
              style={styles.addressBarIcon}
            />
          )}

          {/* While idle the URL is plain Text so a long address truncates at the
              end like Chrome; a TextInput instead scrolls to its tail and hides
              the host, which is the part that matters most. */}
          {isInputFocused ? (
            <TextInput
              ref={inputRef}
              style={styles.addressBarInput}
              value={urlInput}
              onChangeText={setUrlInput}
              onBlur={() => setIsInputFocused(false)}
              onSubmitEditing={handleNavigate}
              autoFocus
              selectTextOnFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              placeholder="חפש בגוגל או הזן כתובת אתר"
              placeholderTextColor={COLORS.textDisabled}
            />
          ) : (
            <Text
              style={styles.addressBarText}
              numberOfLines={1}
              ellipsizeMode="tail"
              onPress={() => setIsInputFocused(true)}
              suppressHighlighting
            >
              {displayUrl}
            </Text>
          )}

          {isInputFocused && urlInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setUrlInput('')}
              style={styles.clearInputBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* New Tab Button */}
        <TouchableOpacity
          onPress={handleAddNewTab}
          style={styles.iconButton}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="כרטיסייה חדשה"
        >
          <Ionicons name="add" size={24} color={COLORS.textDark} />
        </TouchableOpacity>

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

        {/* 3-Dots Menu Button — far right edge of the toolbar */}
        <TouchableOpacity
          onPress={handleOpenMenu}
          style={styles.iconButton}
          activeOpacity={0.6}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textDark} />
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
          {suggestions.map((item, index) => {
            // Chrome renders the part the user already typed in regular weight and
            // the completion in bold, so the new characters stand out.
            const typed = urlInput.trim().toLowerCase();
            const matchesPrefix = typed.length > 0 && item.toLowerCase().startsWith(typed);
            const prefix = matchesPrefix ? item.slice(0, typed.length) : '';
            const completion = matchesPrefix ? item.slice(typed.length) : item;
            return (
              <View
                key={`${item}-${index}`}
                style={[
                  styles.suggestionRow,
                  index === suggestions.length - 1 && styles.suggestionRowLast,
                ]}
              >
                {/* Kept as siblings rather than nested: a TouchableOpacity inside
                    another one never receives the press on Android. */}
                <TouchableOpacity
                  style={styles.suggestionMain}
                  onPress={() => onSelectSuggestion?.(item)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={COLORS.textMedium}
                    style={styles.suggestionIcon}
                  />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {prefix}
                    <Text style={styles.suggestionCompletion}>{completion}</Text>
                  </Text>
                </TouchableOpacity>
                {/* Arrow to fill suggestion into input */}
                <TouchableOpacity
                  onPress={() => setUrlInput(item)}
                  style={styles.suggestionFillBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="arrow-up-outline" size={18} color={COLORS.textMedium} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarWrapper: {
    backgroundColor: COLORS.toolbarBg,
    zIndex: 100,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: COLORS.toolbarBg,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  addressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.omniboxFill,
    borderRadius: 22,
    height: 44,
    marginHorizontal: 4,
    paddingHorizontal: 14,
  },
  addressBarIcon: {
    marginRight: 8,
  },
  addressBarInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
    paddingVertical: 0,
    textAlign: 'left',
  },
  addressBarText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  clearInputBtn: {
    marginLeft: 4,
    padding: 2,
  },
  tabIndicatorButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorBox: {
    width: 23,
    height: 23,
    borderWidth: 2,
    borderColor: COLORS.textDark,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIndicatorText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textDark,
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
    backgroundColor: COLORS.toolbarBg,
    paddingBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.greyMedium,
  },
  suggestionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    marginRight: 16,
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textDark,
  },
  suggestionCompletion: {
    fontWeight: '700',
  },
  suggestionFillBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
