import { useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractDomainName } from '../utils/urlHelper';

const DEFAULT_PIN = '1234';

export function useContentFilter() {
  // PIN settings state
  const [savedPin, setSavedPin] = useState(DEFAULT_PIN);
  const [pinInput, setPinInput] = useState('');
  const [pinMode, setPinMode] = useState<'verify' | 'change_current' | 'change_new'>('verify');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Blocking mechanism states
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [autoBlockEnabled, setAutoBlockEnabled] = useState(true);
  const [isCurrentUrlBlocked, setIsCurrentUrlBlocked] = useState(false);

  // Manual Blacklist Input state
  const [newBlacklistDomain, setNewBlacklistDomain] = useState('');

  // Storage handlers
  const saveBlacklist = async (newList: string[]) => {
    try {
      setBlacklist(newList);
      await AsyncStorage.setItem('@browser_blacklist', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save blacklist', e);
    }
  };

  const savePin = async (newPin: string) => {
    try {
      setSavedPin(newPin);
      await AsyncStorage.setItem('@browser_pin', newPin);
    } catch (e) {
      console.error('Failed to save PIN', e);
    }
  };

  const saveAutoBlock = async (enabled: boolean) => {
    try {
      setAutoBlockEnabled(enabled);
      await AsyncStorage.setItem('@browser_autoblock', enabled ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save content filter toggle', e);
    }
  };

  // PIN keypad processing
  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 4) return;
    const nextInput = pinInput + num;
    setPinInput(nextInput);

    if (nextInput.length === 4) {
      setTimeout(() => {
        if (pinMode === 'verify') {
          if (nextInput === savedPin) {
            setIsPinModalOpen(false);
            setPinInput('');
            setIsSettingsOpen(true);
          } else {
            Alert.alert('קוד שגוי', 'קוד הגישה שהזנת אינו נכון.');
            setPinInput('');
          }
        } else if (pinMode === 'change_current') {
          if (nextInput === savedPin) {
            setPinMode('change_new');
            setPinInput('');
          } else {
            Alert.alert('קוד שגוי', 'קוד הגישה הנוכחי אינו נכון.');
            setPinInput('');
          }
        } else if (pinMode === 'change_new') {
          savePin(nextInput);
          Alert.alert('הצלחה', 'קוד הגישה עודכן בהצלחה.');
          setPinInput('');
          setPinMode('verify');
          setIsPinModalOpen(false);
        }
      }, 200);
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  // Manual list adjustments
  const handleAddBlacklist = () => {
    let domain = newBlacklistDomain.trim().toLowerCase();
    if (!domain) return;

    domain = extractDomainName(domain);

    // Basic domain checks
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      Alert.alert('שגיאה', 'אנא הכנס דומיין תקין (למשל: facebook.com)');
      return;
    }

    if (blacklist.includes(domain)) {
      Alert.alert('הודעה', 'אתר זה כבר קיים ברשימת החסימה.');
      return;
    }

    const updated = [...blacklist, domain];
    saveBlacklist(updated);
    setNewBlacklistDomain('');
    Keyboard.dismiss();
  };

  const handleRemoveBlacklist = (domain: string) => {
    Alert.alert(
      'הסרת חסימה',
      `האם להסיר את החסימה עבור ${domain}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: () => {
            const updated = blacklist.filter(item => item !== domain);
            saveBlacklist(updated);
          },
        },
      ]
    );
  };

  const handleQuickBlockSite = (currentUrl: string, closeMenu?: () => void) => {
    if (closeMenu) closeMenu();
    const domain = extractDomainName(currentUrl);
    if (!domain) return;

    if (blacklist.includes(domain)) {
      Alert.alert('הודעה', 'אתר זה כבר קיים ברשימת החסימה.');
      return;
    }

    Alert.alert(
      'חסימת אתר',
      `האם לחסום את ${domain}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'חסום',
          style: 'destructive',
          onPress: () => {
            const updated = [...blacklist, domain];
            saveBlacklist(updated);
          },
        },
      ]
    );
  };

  const openPinModal = (mode: 'verify' | 'change_current', closeMenu?: () => void) => {
    if (closeMenu) closeMenu();
    setPinMode(mode);
    setPinInput('');
    setIsPinModalOpen(true);
  };

  return {
    savedPin,
    setSavedPin,
    pinInput,
    setPinInput,
    pinMode,
    setPinMode,
    isPinModalOpen,
    setIsPinModalOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    blacklist,
    setBlacklist,
    autoBlockEnabled,
    setAutoBlockEnabled,
    isCurrentUrlBlocked,
    setIsCurrentUrlBlocked,
    newBlacklistDomain,
    setNewBlacklistDomain,
    saveBlacklist,
    savePin,
    saveAutoBlock,
    handleKeyPress,
    handleBackspace,
    handleAddBlacklist,
    handleRemoveBlacklist,
    handleQuickBlockSite,
    openPinModal,
  };
}
