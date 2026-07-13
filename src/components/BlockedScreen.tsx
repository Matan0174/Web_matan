import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, CARD_SHADOW } from '../styles/globalStyles';

interface BlockedScreenProps {
  handleGoHome: () => void;
}

export default function BlockedScreen({ handleGoHome }: BlockedScreenProps) {
  return (
    <View style={styles.blockedContainer}>
      <View style={styles.blockedCard}>
        <View style={styles.blockedIconContainer}>
          <MaterialCommunityIcons name="shield-alert" size={72} color={COLORS.redWarning} />
        </View>
        <Text style={styles.blockedTitle}>הגישה לאתר זה חסומה</Text>
        <Text style={styles.blockedDesc}>
          דף זה סווג כלא בטוח או חסום לצפייה על פי הגדרות הסינון של הדפדפן.
        </Text>
        <TouchableOpacity style={styles.blockedGoHomeBtn} onPress={handleGoHome}>
          <Text style={styles.blockedGoHomeText}>חזרה למקום מבטחים</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockedContainer: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  blockedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#f5c6cb',
    ...CARD_SHADOW,
  },
  blockedIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.redAlertBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#c5221f',
    marginBottom: 12,
    textAlign: 'center',
  },
  blockedDesc: {
    fontSize: 14,
    color: COLORS.greyDark,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  blockedGoHomeBtn: {
    backgroundColor: COLORS.blueAccent,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  blockedGoHomeText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
