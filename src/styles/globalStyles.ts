import { Platform } from 'react-native';

// Chrome-accurate color palette
export const COLORS = {
  // Base
  white: '#ffffff',
  black: '#000000',

  // Chrome greys
  greyLight: '#f1f3f4',
  greyMedium: '#dadce0',
  greyDark: '#5f6368',
  surfaceGrey: '#f8f9fa',
  divider: '#e8eaed',
  toolbarBg: '#ffffff',

  // Chrome text hierarchy
  textDark: '#202124',
  textMedium: '#3c4043',
  textLight: '#70757a',
  textDisabled: '#9aa0a6',

  // Chrome blues
  blueAccent: '#1a73e8',
  blueLight: '#e8f0fe',
  blueBorder: '#aecbfa',
  blueHover: '#1765cc',
  blueProgressBar: '#4285f4',

  // Chrome reds
  redWarning: '#d93025',
  redLightBg: '#fef7f7',
  redAlertBg: '#fce8e6',

  // Chrome greens
  greenSecure: '#0f9d58',
  greenLight: '#e6f4ea',

  // Overlays
  backdrop: 'rgba(0, 0, 0, 0.5)',
  backdropLight: 'rgba(0, 0, 0, 0.32)',
  ripple: 'rgba(0, 0, 0, 0.08)',
  bgLight: '#f8f9fa',
};

// Chrome typography scale
export const TYPOGRAPHY = {
  h1: { fontSize: 20, fontWeight: '600' as const },
  h2: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
  menu: { fontSize: 15, fontWeight: '400' as const },
  tabCount: { fontSize: 11, fontWeight: '700' as const },
};

export const SHADOWS = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  android: {
    elevation: 3,
  },
});

export const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  android: {
    elevation: 4,
  },
});

export const DROPDOWN_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  android: {
    elevation: 12,
  },
});

export const TAB_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
});
