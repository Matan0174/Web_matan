import { Platform } from 'react-native';

export const COLORS = {
  white: '#ffffff',
  greyLight: '#f1f3f4',
  greyMedium: '#dadce0',
  greyDark: '#5f6368',
  textDark: '#202124',
  textMedium: '#3c4043',
  textLight: '#70757a',
  blueAccent: '#1a73e8',
  blueLight: '#e8f0fe',
  blueBorder: '#aecbfa',
  redWarning: '#d93025',
  redLightBg: '#fef7f7',
  redAlertBg: '#fce8e6',
  greenSecure: '#0f9d58',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  bgLight: '#f8f9fa',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  android: {
    elevation: 8,
  },
});
export const TAB_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
});
