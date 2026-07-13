import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/globalStyles';

interface SettingsScreenProps {
  autoBlockEnabled: boolean;
  saveAutoBlock: (enabled: boolean) => void;
  blacklist: string[];
  newBlacklistDomain: string;
  setNewBlacklistDomain: (text: string) => void;
  handleAddBlacklist: () => void;
  handleRemoveBlacklist: (domain: string) => void;
  openChangePinModal: () => void;
  handleClose: () => void;
}

export default function SettingsScreen({
  autoBlockEnabled,
  saveAutoBlock,
  blacklist,
  newBlacklistDomain,
  setNewBlacklistDomain,
  handleAddBlacklist,
  handleRemoveBlacklist,
  openChangePinModal,
  handleClose,
}: SettingsScreenProps) {
  return (
    <View style={styles.settingsContainer}>
      <View style={styles.settingsHeader}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.settingsBackBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>הגדרות חסימת תכנים</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.settingsContent}>
        {/* Toggle Automatic Keywords Filter */}
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>חסימת פורנוגרפיה אוטומטית</Text>
              <Text style={styles.settingDesc}>
                מסנן אוטומטית אתרים המכילים ביטויים בעלי אופי מיני בכתובת האתר.
              </Text>
            </View>
            <Switch
              value={autoBlockEnabled}
              onValueChange={saveAutoBlock}
              trackColor={{ false: '#dadce0', true: '#aecbfa' }}
              thumbColor={autoBlockEnabled ? COLORS.blueAccent : COLORS.greyLight}
            />
          </View>
        </View>

        {/* Blacklist Section */}
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>רשימה שחורה ידנית</Text>
          <Text style={styles.settingDesc}>
            הקלד דומיינים ספציפיים לחסימה (למשל: youtube.com).
          </Text>

          <View style={styles.blacklistForm}>
            <TextInput
              style={styles.blacklistInput}
              value={newBlacklistDomain}
              onChangeText={setNewBlacklistDomain}
              placeholder="הכנס כתובת אתר (למשל: instagram.com)"
              placeholderTextColor="#9aa0a6"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.blacklistAddBtn} onPress={handleAddBlacklist}>
              <Text style={styles.blacklistAddBtnText}>חסום</Text>
            </TouchableOpacity>
          </View>

          {/* Blacklisted Domains List */}
          <View style={styles.blacklistContainer}>
            {blacklist.length === 0 ? (
              <Text style={styles.emptyBlacklistText}>אין אתרים חסומים ידנית.</Text>
            ) : (
              blacklist.map((item, idx) => (
                <View key={idx} style={styles.blacklistRow}>
                  <Text style={styles.blacklistDomainText}>{item}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveBlacklist(item)}
                    style={styles.blacklistDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.redWarning} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Option to modify protection PIN */}
        <TouchableOpacity
          style={styles.changePinBtn}
          onPress={openChangePinModal}
        >
          <Ionicons name="key-outline" size={20} color={COLORS.blueAccent} />
          <Text style={styles.changePinBtnText}>שנה קוד גישה</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsContainer: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyMedium,
  },
  settingsBackBtn: {
    padding: 4,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  settingsContent: {
    flex: 1,
    padding: 16,
  },
  settingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.greyMedium,
  },
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
    textAlign: 'right',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    color: COLORS.greyDark,
    textAlign: 'right',
    lineHeight: 18,
  },
  blacklistForm: {
    flexDirection: 'row-reverse',
    marginTop: 16,
    alignItems: 'center',
  },
  blacklistInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.greyMedium,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.textDark,
    textAlign: 'right',
    backgroundColor: COLORS.bgLight,
  },
  blacklistAddBtn: {
    backgroundColor: COLORS.redWarning,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginRight: 8,
  },
  blacklistAddBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  blacklistContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyMedium,
    paddingTop: 8,
  },
  emptyBlacklistText: {
    textAlign: 'center',
    color: '#9aa0a6',
    paddingVertical: 12,
    fontSize: 13,
  },
  blacklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyLight,
  },
  blacklistDomainText: {
    fontSize: 14,
    color: COLORS.textDark,
  },
  blacklistDeleteBtn: {
    padding: 6,
  },
  changePinBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blueLight,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    marginBottom: 30,
  },
  changePinBtnText: {
    color: COLORS.blueAccent,
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
