import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club } from '../../types';
import { makeStyles } from './dashboardStyles';

interface DashboardHeaderProps {
  club: Club;
  isHost: boolean;
  hostNickname: string;
  sportLabel: string;
  onPressQR: () => void;
  onPressHelp: () => void;
  onPressSettings: () => void;
  onLeave: () => void;
  onEndSession?: () => void;
}

export function DashboardHeader({
  club,
  isHost,
  hostNickname,
  sportLabel,
  onPressQR,
  onPressHelp,
  onPressSettings,
  onLeave,
  onEndSession,
}: DashboardHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const handleLeave = async () => {
    const leave = async () => {
      onLeave();
      await AsyncStorage.multiRemove(['currentClubId', 'isHost']).catch(() => {});
      router.replace('/');
    };
    const title = isHost ? 'Leave Session?' : 'Sign Out?';
    const message = isHost ? 'Are you sure?' : 'Leave this session and return to the home screen?';
    const confirmLabel = isHost ? 'Leave' : 'Sign Out';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) await leave();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: leave },
      ]);
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={onPressQR}>
        {club.club_logo_url ? (
          <Image source={{ uri: club.club_logo_url }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
        ) : null}
        <View>
          <Text style={styles.title} numberOfLines={1}>{club.club_name || `My ${sportLabel} Club`}</Text>
          {isHost && hostNickname && hostNickname !== 'Host' ? (
            <Text style={{ color: colors.gray3, fontSize: 11 }}>Host: {hostNickname}</Text>
          ) : null}
          <Text style={styles.idText}>ID: {club.id}  (tap for QR)</Text>
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity style={[styles.settingsBtn, { marginRight: 4 }]} onPress={onPressHelp}>
          <Text style={{ fontSize: 18, color: colors.gray2, fontWeight: 'bold' }}>?</Text>
        </TouchableOpacity>
        {isHost && (
          <TouchableOpacity style={styles.settingsBtn} onPress={onPressSettings}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        )}
        {isHost && onEndSession && (
          <TouchableOpacity
            style={[styles.btnDanger, { backgroundColor: colors.gray3, marginRight: 4 }]}
            onPress={onEndSession}
          >
            <Text style={styles.btnText}>END</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnDanger} onPress={handleLeave}>
          <Text style={styles.btnText}>{isHost ? 'LEAVE' : 'SIGN OUT'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
