import React, { useMemo } from 'react';
import {
  Modal, ScrollView, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club } from '../../types';
import { SPORTS } from '../../constants/sports';
import { makeStyles } from './dashboardStyles';

export interface TempSettings {
  clubName: string;
  courts: number;
  sport: string;
  limit: number;
  ttsVoice: string;
  repeat: boolean;
  repeatInterval: number;
  countdown: boolean;
  countdownLimit: number;
  loggingEnabled: boolean;
  pinEnabled: boolean;
  genderBalanced: boolean;
  avoidRepeats: boolean;
  clubPassword: string;
  soundEnabled: boolean;
  powerGuestEnabled: boolean;
}

export const DEFAULT_TEMP_SETTINGS: TempSettings = {
  clubName: '',
  courts: 4,
  sport: 'badminton',
  limit: 20,
  ttsVoice: 'en-US',
  repeat: false,
  repeatInterval: 30,
  countdown: false,
  countdownLimit: 60,
  loggingEnabled: false,
  pinEnabled: false,
  genderBalanced: false,
  avoidRepeats: false,
  clubPassword: '',
  soundEnabled: true,
  powerGuestEnabled: false,
};

interface SettingsModalProps {
  visible: boolean;
  club: Club;
  isHost: boolean;
  isSavingSettings: boolean;
  courtLabel: string;
  mode: 'dark' | 'light';
  tempSettings: TempSettings;
  setTempSettings: React.Dispatch<React.SetStateAction<TempSettings>>;

  // Action callbacks
  onSave: () => void;
  onCancel: () => void;
  onPickLogo: () => void;
  onResetSession: () => void;
  onFullWipe: () => void;
  onExportCsv: () => void;
  onShareStats: () => void;
  onShowLogs: () => void;
  onShowLeaderboard: () => void;
  onShowMatchHistory: () => void;
  onShowInviteQR: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onMyClubs: () => void;
  onPinToggle: (val: boolean) => void;
  onPowerGuestToggle: (val: boolean) => Promise<void>;
}

export function SettingsModal({
  visible,
  club,
  isHost,
  isSavingSettings,
  courtLabel,
  mode,
  tempSettings,
  setTempSettings,
  onSave,
  onCancel,
  onPickLogo,
  onResetSession,
  onFullWipe,
  onExportCsv,
  onShareStats,
  onShowLogs,
  onShowLeaderboard,
  onShowMatchHistory,
  onShowInviteQR,
  onToggleTheme,
  onSignOut,
  onMyClubs,
  onPinToggle,
  onPowerGuestToggle,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const set = <K extends keyof TempSettings>(key: K, val: TempSettings[K]) =>
    setTempSettings(prev => ({ ...prev, [key]: val }));

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView>
          <View style={[styles.modalContent, { marginVertical: 20 }]}>
            <Text style={styles.modalTitle}>CLUB SETTINGS</Text>

            <Text style={styles.sectionHeader}>SPORT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => set('sport', key)}
                  style={[styles.sportChip, tempSettings.sport === key && styles.sportChipActive]}
                >
                  <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                  <Text style={{ color: tempSettings.sport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionHeader}>CLUB</Text>
            <Text style={styles.label}>Club Name</Text>
            <TextInput style={styles.input} value={tempSettings.clubName} onChangeText={v => set('clubName', v)} />

            <TouchableOpacity onPress={onPickLogo} style={[styles.btnPrimary, { backgroundColor: colors.blueDark, padding: 12, marginBottom: 15 }]}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>
                {club.club_logo_url ? '🖼️  CHANGE CLUB LOGO' : '🖼️  SET CLUB LOGO'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>
              Join Password {club.join_password ? '(currently set — enter new to change, leave blank to remove)' : '(leave blank = open)'}
            </Text>
            <TextInput
              style={styles.input}
              value={tempSettings.clubPassword}
              onChangeText={v => set('clubPassword', v)}
              placeholder="No password"
              placeholderTextColor={colors.gray3}
              secureTextEntry
            />

            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Active {courtLabel}s</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => set('courts', Math.max(1, tempSettings.courts - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                <Text style={{ color: colors.primary, marginHorizontal: 15, fontWeight: 'bold' }}>{tempSettings.courts}</Text>
                <TouchableOpacity onPress={() => set('courts', Math.min(10, tempSettings.courts + 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Auto-Pick Range</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => set('limit', Math.max(4, tempSettings.limit - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                <Text style={{ color: colors.primary, marginHorizontal: 15, fontWeight: 'bold' }}>{tempSettings.limit}</Text>
                <TouchableOpacity onPress={() => set('limit', Math.min(30, tempSettings.limit + 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionHeader}>AUTO-PICK INTELLIGENCE</Text>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Gender Balanced</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>Prefer 2M + 2F when possible</Text>
              </View>
              <Switch value={tempSettings.genderBalanced} onValueChange={v => set('genderBalanced', v)} thumbColor={tempSettings.genderBalanced ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Avoid Repeat Opponents</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>Try not to repeat last game's matchups</Text>
              </View>
              <Switch value={tempSettings.avoidRepeats} onValueChange={v => set('avoidRepeats', v)} thumbColor={tempSettings.avoidRepeats ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>

            <Text style={styles.sectionHeader}>POWER GUEST</Text>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Enable Power Guest PIN</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>Guests who enter this PIN get elevated controls</Text>
              </View>
              <Switch
                value={tempSettings.powerGuestEnabled}
                onValueChange={onPowerGuestToggle}
                thumbColor={tempSettings.powerGuestEnabled ? colors.primary : colors.gray3}
                trackColor={{ true: colors.purple, false: colors.border }}
              />
            </View>
            {tempSettings.powerGuestEnabled && (
              <View style={{ marginBottom: 10, paddingLeft: 4 }}>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>Guests tap "Claim Power Mode" and enter your settings PIN.</Text>
                <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 3 }}>Host can also tap the star next to any player to grant manually.</Text>
              </View>
            )}

            <Text style={styles.sectionHeader}>ANNOUNCEMENTS</Text>
            <Text style={styles.label}>Announcer Voice</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 }}>
              {[{ label: 'American', value: 'en-US' }, { label: 'British', value: 'en-GB' }, { label: 'Australian', value: 'en-AU' }, { label: 'Indian', value: 'en-IN' }, { label: 'S. African', value: 'en-ZA' }].map(v => (
                <TouchableOpacity key={v.value} onPress={() => set('ttsVoice', v.value)} style={{ marginRight: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: tempSettings.ttsVoice === v.value ? colors.purple : colors.border, borderRadius: 4 }}>
                  <Text style={{ color: tempSettings.ttsVoice === v.value ? colors.primary : colors.white, fontSize: 12 }}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Repeat Picker Name</Text>
              <Switch value={tempSettings.repeat} onValueChange={v => set('repeat', v)} thumbColor={tempSettings.repeat ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>
            {tempSettings.repeat && (
              <View style={[styles.settingsRow, { paddingLeft: 10 }]}>
                <Text style={{ color: colors.gray1 }}>Every (sec)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => set('repeatInterval', Math.max(10, tempSettings.repeatInterval - 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                  <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold' }}>{tempSettings.repeatInterval}s</Text>
                  <TouchableOpacity onPress={() => set('repeatInterval', Math.min(120, tempSettings.repeatInterval + 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Picker Countdown</Text>
              <Switch value={tempSettings.countdown} onValueChange={v => set('countdown', v)} thumbColor={tempSettings.countdown ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>
            {tempSettings.countdown && (
              <View style={[styles.settingsRow, { paddingLeft: 10 }]}>
                <Text style={{ color: colors.gray1 }}>Timeout (sec)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => set('countdownLimit', Math.max(30, tempSettings.countdownLimit - 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                  <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold' }}>{tempSettings.countdownLimit}s</Text>
                  <TouchableOpacity onPress={() => set('countdownLimit', Math.min(180, tempSettings.countdownLimit + 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Chime Sound (Your Turn)</Text>
              <Switch value={tempSettings.soundEnabled} onValueChange={v => set('soundEnabled', v)} thumbColor={tempSettings.soundEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>

            <Text style={styles.sectionHeader}>SECURITY & ADMIN</Text>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Enable Logging</Text>
              <Switch value={tempSettings.loggingEnabled} onValueChange={v => set('loggingEnabled', v)} thumbColor={tempSettings.loggingEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Settings PIN (protects Wipe)</Text>
              <Switch value={tempSettings.pinEnabled} onValueChange={onPinToggle} thumbColor={tempSettings.pinEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>

            <View style={{ flexDirection: 'row', marginVertical: 10 }}>
              <TouchableOpacity onPress={onShowLogs} style={[styles.btnPrimary, { flex: 1, marginRight: 5, padding: 10 }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>VIEW LOGS</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onShowLeaderboard} style={[styles.btnPrimary, { flex: 1, marginLeft: 5, padding: 10 }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>LEADERBOARD</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              <TouchableOpacity onPress={onShowMatchHistory} style={[styles.btnPrimary, { flex: 1, marginRight: 5, padding: 10, backgroundColor: colors.deepBlue }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>MATCH HISTORY</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onExportCsv} style={[styles.btnPrimary, { flex: 1, marginLeft: 5, padding: 10, backgroundColor: colors.greenDark }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>EXPORT CSV</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onShareStats} style={[styles.btnPrimary, { marginBottom: 10, padding: 12, backgroundColor: colors.purple }]}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>🏸  SHARE SESSION STATS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnPrimary, { marginBottom: 10, padding: 14, backgroundColor: colors.blueDark }]} onPress={onShowInviteQR}>
              <Text style={[styles.btnText, { textAlign: 'center', fontSize: 13 }]}>📷  SHOW INVITE QR CODE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnDanger, { marginTop: 5, backgroundColor: colors.gray3 }]} onPress={onResetSession}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>RESET QUEUE & COURTS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnDanger, { marginTop: 10 }]} onPress={onFullWipe}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>WIPE ALL DATA</Text>
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>DISPLAY</Text>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Dark Mode</Text>
              <Switch value={mode === 'dark'} onValueChange={onToggleTheme} thumbColor={mode === 'dark' ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>

            <TouchableOpacity style={[styles.btnDanger, { marginTop: 20, backgroundColor: colors.red }]} onPress={onSignOut}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>SIGN OUT</Text>
            </TouchableOpacity>

            {isHost && (
              <TouchableOpacity style={{ marginTop: 24, padding: 14, backgroundColor: colors.border, borderRadius: 8, alignItems: 'center' }} onPress={onMyClubs}>
                <Text style={{ color: colors.white, fontWeight: 'bold' }}>🏢  MY CLUBS</Text>
                <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 2 }}>Switch club or create a new one</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity onPress={onCancel}>
                <Text style={{ color: colors.gray1 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSave} disabled={isSavingSettings}>
                <Text style={{ color: isSavingSettings ? colors.gray2 : colors.primary, fontWeight: 'bold' }}>
                  {isSavingSettings ? 'SAVING...' : 'SAVE SETTINGS'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
