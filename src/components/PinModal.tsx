import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/globalStyles';

interface PinModalProps {
  visible: boolean;
  pinMode: 'verify' | 'change_current' | 'change_new';
  pinInput: string;
  handleKeyPress: (num: string) => void;
  handleBackspace: () => void;
  handleClose: () => void;
}

export default function PinModal({
  visible,
  pinMode,
  pinInput,
  handleKeyPress,
  handleBackspace,
  handleClose,
}: PinModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.pinModalContainer}>
        <View style={styles.pinModalContent}>
          <MaterialCommunityIcons name="lock-outline" size={48} color={COLORS.blueAccent} />
          <Text style={styles.pinModalTitle}>
            {pinMode === 'verify' && 'הזן קוד גישה'}
            {pinMode === 'change_current' && 'הזן קוד גישה נוכחי'}
            {pinMode === 'change_new' && 'הזן קוד גישה חדש'}
          </Text>
          <Text style={styles.pinModalSubtitle}>
            {pinMode === 'verify' && 'נדרש קוד גישה לניהול הגדרות החסימה'}
            {pinMode === 'change_current' && 'נדרש זיהוי על מנת להחליף קוד'}
            {pinMode === 'change_new' && 'הזן 4 ספרות לקוד הגישה החדש'}
          </Text>

          {/* Pin dots indicator */}
          <View style={styles.pinDotsContainer}>
            {[0, 1, 2, 3].map(idx => (
              <View
                key={idx}
                style={[
                  styles.pinDot,
                  pinInput.length > idx && styles.pinDotFilled,
                ]}
              />
            ))}
          </View>

          {/* Keypad */}
          <View style={styles.keypad}>
            <View style={styles.keypadRow}>
              {['1', '2', '3'].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.keypadKey}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={styles.keypadKeyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {['4', '5', '6'].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.keypadKey}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={styles.keypadKeyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {['7', '8', '9'].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.keypadKey}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={styles.keypadKeyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={handleClose}
              >
                <Text style={[styles.keypadKeyText, { fontSize: 16, color: COLORS.redWarning }]}>
                  ביטול
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('0')}
              >
                <Text style={styles.keypadKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={handleBackspace}>
                <Ionicons name="backspace-outline" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pinModalContainer: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    alignItems: 'center',
  },
  pinModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  pinModalSubtitle: {
    fontSize: 13,
    color: COLORS.greyDark,
    marginBottom: 24,
    textAlign: 'center',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.greyMedium,
    marginHorizontal: 12,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: COLORS.blueAccent,
    borderColor: COLORS.blueAccent,
  },
  keypad: {
    width: '100%',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  keypadKey: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.greyLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadKeyText: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textDark,
  },
});
