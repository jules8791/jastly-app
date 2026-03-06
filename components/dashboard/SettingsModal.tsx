import React, { useMemo, useState } from 'react';
import {
  Modal, ScrollView, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club, SessionTemplate } from '../../types';
import { SPORTS } from '../../constants/sports';
import { getSportConfig } from '../../constants/sports';
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
  rotationMode: 'standard' | 'winner_stays' | 'loser_stays' | 'challenger';
  targetGameDuration: number; // minutes, 0 = disabled
  scoreCap: number;           // e.g. 21, 0 = disabled
  playersPerGame: number;     // 0 = use sport default
  eloEnabled: boolean;        // track ELO ratings
  courtNames: Record<string, string>; // custom label per court index
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
  rotationMode: 'standard',
  targetGameDuration: 0,
  scoreCap: 0,
  playersPerGame: 0,
  eloEnabled: false,
  courtNames: {},
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
  onShowSessionSummary: () => void;
  onShowInviteQR: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onMyClubs: () => void;
  onLeagues: () => void;
  onPinToggle: (val: boolean) => void;
  onPowerGuestToggle: (val: boolean) => Promise<void>;
  onShowSetupGuide: () => void;
  onShowTournament: () => void;
  tournamentActive: boolean;
  isEmailHost: boolean;
  onCreateNewClub: (sport: string) => void;
  hostClubs?: { id: string; club_name: string | null; sport: string | null }[];
  onSwitchToClub?: (clubId: string) => void;
  sessionTemplates: SessionTemplate[];
  onSaveTemplate: (name: string) => void;
  onLoadTemplate: (t: SessionTemplate) => void;
  onDeleteTemplate: (id: string) => void;
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
  onShowSessionSummary,
  onShowInviteQR,
  onToggleTheme,
  onSignOut,
  onMyClubs,
  onLeagues,
  onPinToggle,
  onPowerGuestToggle,
  onShowSetupGuide,
  onShowTournament,
  tournamentActive,
  isEmailHost,
  onCreateNewClub,
  hostClubs,
  onSwitchToClub,
  sessionTemplates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sessionCost, setSessionCost] = useState('');
  const [newClubSportPrompt, setNewClubSportPrompt] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const set = <K extends keyof TempSettings>(key: K, val: TempSettings[K]) =>
    setTempSettings(prev => ({ ...prev, [key]: val }));

  return (
    <Modal visible={visible} animationType="fade" transparent onDismiss={() => setNewClubSportPrompt(null)}>
      <View style={styles.modalOverlay}>
        <ScrollView>
          <View style={[styles.modalContent, { marginVertical: 20 }]}>
            <Text style={styles.modalTitle}>CLUB SETTINGS</Text>

            <TouchableOpacity
              onPress={onShowSetupGuide}
              style={[styles.btnPrimary, { backgroundColor: colors.greenDark, padding: 14, marginBottom: 10 }]}
            >
              <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>🚀  SETUP GUIDE</Text>
              <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginTop: 3 }}>
                Step-by-step walkthrough for new sessions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onShowTournament}
              disabled={tournamentActive}
              style={[styles.btnPrimary, { backgroundColor: tournamentActive ? colors.gray3 : colors.deepBlue, padding: 14, marginBottom: 20 }]}
            >
              <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>
                {tournamentActive ? '🏆  TOURNAMENT IN PROGRESS' : '🏆  START TOURNAMENT'}
              </Text>
              {!tournamentActive && (
                <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginTop: 3 }}>
                  Round-robin, knockout, or super tournament
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>SPORT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    set('sport', key);
                    if (isEmailHost && key !== club.sport) {
                      setNewClubSportPrompt(key);
                    } else {
                      setNewClubSportPrompt(null);
                    }
                  }}
                  style={[styles.sportChip, tempSettings.sport === key && styles.sportChipActive]}
                >
                  <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                  <Text style={{ color: tempSettings.sport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {newClubSportPrompt && (() => {
              const existingClub = hostClubs?.find(c => c.sport === newClubSportPrompt && c.id !== club.id);
              return (
                <View style={{ backgroundColor: colors.selectedBg, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  {existingClub ? (
                    <>
                      <Text style={{ color: colors.white, fontSize: 12, marginBottom: 8 }}>
                        You already have a {newClubSportPrompt} club: <Text style={{ fontWeight: 'bold' }}>{existingClub.club_name || `My ${newClubSportPrompt} Club`}</Text>
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => { setNewClubSportPrompt(null); onSwitchToClub?.(existingClub.id); }}
                          style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
                        >
                          <Text style={{ color: colors.black, fontWeight: 'bold', fontSize: 12 }}>SWITCH TO IT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { setNewClubSportPrompt(null); onCreateNewClub(newClubSportPrompt); }}
                          style={{ flex: 1, backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
                        >
                          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 12 }}>CREATE NEW</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setNewClubSportPrompt(null)}>
                          <Text style={{ color: colors.gray3, fontSize: 18 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, color: colors.white, fontSize: 12 }}>
                        Create a new {newClubSportPrompt} club?
                      </Text>
                      <TouchableOpacity
                        onPress={() => { setNewClubSportPrompt(null); onCreateNewClub(newClubSportPrompt); }}
                        style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: colors.black, fontWeight: 'bold', fontSize: 12 }}>CREATE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setNewClubSportPrompt(null)}>
                        <Text style={{ color: colors.gray3, fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {isHost && (
              <TouchableOpacity style={{ marginBottom: 8, padding: 14, backgroundColor: colors.border, borderRadius: 8, alignItems: 'center' }} onPress={onMyClubs}>
                <Text style={{ color: colors.white, fontWeight: 'bold' }}>🏢  MY CLUBS</Text>
                <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 2 }}>Switch club or create a new one</Text>
              </TouchableOpacity>
            )}
            {isEmailHost && (
              <TouchableOpacity style={{ marginBottom: 20, padding: 14, backgroundColor: colors.border, borderRadius: 8, alignItems: 'center' }} onPress={onLeagues}>
                <Text style={{ color: colors.white, fontWeight: 'bold' }}>🏆  LEAGUES</Text>
                <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 2 }}>Manage leagues, teams and fixtures</Text>
              </TouchableOpacity>
            )}

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

            <Text style={styles.sectionHeader}>SESSION ROTATION</Text>
            <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>How players return to the queue after a match</Text>
            {(
              [
                { key: 'standard',     label: 'Standard',         sub: 'All players go to the back of the queue' },
                { key: 'winner_stays', label: 'Winner Stays',     sub: 'Winners jump to the front — play again next' },
                { key: 'loser_stays',  label: 'Loser Stays',      sub: 'Losers jump to the front — play again next' },
                { key: 'challenger',   label: 'Challenger Queue',  sub: 'Winners stay on court; next players in queue challenge them' },
              ] as const
            ).map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => set('rotationMode', opt.key)}
                style={[styles.settingsRow, { backgroundColor: tempSettings.rotationMode === opt.key ? colors.selectedBg : 'transparent', borderRadius: 8, paddingHorizontal: 10 }]}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.white, fontWeight: tempSettings.rotationMode === opt.key ? 'bold' : 'normal' }}>{opt.label}</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>{opt.sub}</Text>
                </View>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: tempSettings.rotationMode === opt.key ? colors.primary : colors.border, backgroundColor: tempSettings.rotationMode === opt.key ? colors.primary : 'transparent' }} />
              </TouchableOpacity>
            ))}

            {/* Singles / Doubles toggle — shown only for sports that support it */}
            {(() => {
              const sportCfg = getSportConfig(tempSettings.sport);
              if (!sportCfg.supportsDoublesToggle) return null;
              const defaultPpg = sportCfg.playersPerGame;
              // For tennis (default 4): singles = 2, doubles = 4
              // For tableTennis (default 2): singles = 2, doubles = 4
              const singlesCount = 2;
              const doublesCount = defaultPpg === 2 ? 4 : defaultPpg;
              const isDoubles = tempSettings.playersPerGame === 0
                ? defaultPpg === doublesCount
                : tempSettings.playersPerGame === doublesCount;
              return (
                <View style={[styles.settingsRow, { marginTop: 12 }]}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.white }}>Singles / Doubles</Text>
                    <Text style={{ color: colors.gray3, fontSize: 11 }}>
                      {isDoubles ? `Doubles — ${doublesCount} players per court` : `Singles — ${singlesCount} players per court`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => set('playersPerGame', singlesCount)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: !isDoubles ? colors.primary : colors.border }}
                    >
                      <Text style={{ color: !isDoubles ? colors.bg : colors.gray2, fontWeight: 'bold', fontSize: 12 }}>Singles</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => set('playersPerGame', doublesCount)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: isDoubles ? colors.primary : colors.border }}
                    >
                      <Text style={{ color: isDoubles ? colors.bg : colors.gray2, fontWeight: 'bold', fontSize: 12 }}>Doubles</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}

            <Text style={styles.sectionHeader}>WIN CONDITION</Text>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Score Cap</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>
                  {tempSettings.scoreCap === 0 ? 'Disabled — no target score' : `First to ${tempSettings.scoreCap} wins`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => set('scoreCap', Math.max(0, tempSettings.scoreCap - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold', minWidth: 34, textAlign: 'center' }}>
                  {tempSettings.scoreCap === 0 ? 'OFF' : `${tempSettings.scoreCap}`}
                </Text>
                <TouchableOpacity onPress={() => set('scoreCap', tempSettings.scoreCap + 1)} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
              </View>
            </View>
            {/* Quick-set common score caps */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[0, 11, 15, 21, 25].map(cap => (
                <TouchableOpacity
                  key={cap}
                  onPress={() => set('scoreCap', cap)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: tempSettings.scoreCap === cap ? colors.primary : colors.border }}
                >
                  <Text style={{ color: tempSettings.scoreCap === cap ? colors.bg : colors.gray2, fontSize: 11, fontWeight: 'bold' }}>{cap === 0 ? 'Off' : cap}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionHeader}>ELO RATINGS</Text>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Track ELO Ratings</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>
                  {tempSettings.eloEnabled
                    ? 'ELO updates after each match with declared winners'
                    : 'Disabled — enable to rank players by skill over time'}
                </Text>
              </View>
              <Switch value={tempSettings.eloEnabled} onValueChange={v => set('eloEnabled', v)} thumbColor={tempSettings.eloEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
            </View>
            {tempSettings.eloEnabled && (
              <View style={{ backgroundColor: colors.selectedBg, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>Starting ELO: 1000 · K-factor: 32 · Minimum: 100</Text>
                <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 3 }}>ELO is shown in the Leaderboard sorted by rating.</Text>
              </View>
            )}

            <Text style={styles.sectionHeader}>COURT NAMES</Text>
            <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>Custom labels shown on court cards (leave blank for default)</Text>
            {Array.from({ length: tempSettings.courts }, (_, i) => (
              <View key={i} style={[styles.settingsRow, { marginBottom: 6 }]}>
                <Text style={{ color: colors.white, width: 70, fontSize: 13 }}>Court {i + 1}</Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 13 }]}
                  value={tempSettings.courtNames[i.toString()] ?? ''}
                  onChangeText={v => set('courtNames', { ...tempSettings.courtNames, [i.toString()]: v })}
                  placeholder={`Court ${i + 1}`}
                  placeholderTextColor={colors.gray3}
                  maxLength={20}
                />
              </View>
            ))}

            <Text style={styles.sectionHeader}>SESSION TEMPLATES</Text>
            <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>Save and reload full session configurations</Text>
            {sessionTemplates.length > 0 && sessionTemplates.map(t => (
              <View key={t.id} style={[styles.settingsRow, { backgroundColor: colors.selectedBg, borderRadius: 8, paddingHorizontal: 10, marginBottom: 4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 13 }}>{t.name}</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>{t.sport} · {t.courts} courts · {t.rotationMode}{t.scoreCap ? ` · cap ${t.scoreCap}` : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => onLoadTemplate(t)}
                  style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 }}
                >
                  <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 11 }}>LOAD</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteTemplate(t.id)}>
                  <Text style={{ color: colors.red, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {showSaveTemplate ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newTemplateName}
                  onChangeText={setNewTemplateName}
                  placeholder="Template name..."
                  placeholderTextColor={colors.gray3}
                  autoFocus
                  maxLength={30}
                />
                <TouchableOpacity
                  onPress={() => { if (newTemplateName.trim()) { onSaveTemplate(newTemplateName.trim()); setNewTemplateName(''); setShowSaveTemplate(false); } }}
                  style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 12 }}>SAVE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSaveTemplate(false)} style={{ justifyContent: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ color: colors.gray2, fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowSaveTemplate(true)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.border, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 }}
              >
                <Text style={{ color: colors.gray2, fontWeight: 'bold', fontSize: 12 }}>+ SAVE CURRENT AS TEMPLATE</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionHeader}>GAME TIMER</Text>
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.white }}>Target Game Duration</Text>
                <Text style={{ color: colors.gray3, fontSize: 11 }}>
                  {tempSettings.targetGameDuration === 0
                    ? 'Disabled — no alert'
                    : `Alert when a game exceeds ${tempSettings.targetGameDuration} min`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => set('targetGameDuration', Math.max(0, tempSettings.targetGameDuration - 5))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold', minWidth: 34, textAlign: 'center' }}>
                  {tempSettings.targetGameDuration === 0 ? 'OFF' : `${tempSettings.targetGameDuration}m`}
                </Text>
                <TouchableOpacity onPress={() => set('targetGameDuration', Math.min(60, tempSettings.targetGameDuration + 5))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionHeader}>SESSION COST SPLITTER</Text>
            <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>Calculates cost per player — not saved</Text>
            <View style={[styles.settingsRow, { alignItems: 'center' }]}>
              <Text style={{ color: colors.white, marginRight: 10 }}>Total Cost</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, textAlign: 'right' }]}
                value={sessionCost}
                onChangeText={setSessionCost}
                keyboardType="numeric"
                placeholder="e.g. 40"
                placeholderTextColor={colors.gray3}
              />
            </View>
            {(() => {
              const cost = parseFloat(sessionCost);
              const playerCount = (club.waiting_list?.length ?? 0) + Object.values(club.court_occupants ?? {}).reduce((s, arr) => s + arr.length, 0);
              if (!isNaN(cost) && cost > 0 && playerCount > 0) {
                const perPerson = (cost / playerCount).toFixed(2);
                return (
                  <View style={{ backgroundColor: colors.selectedBg, borderRadius: 8, padding: 10, marginBottom: 10, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>£{perPerson} per player</Text>
                    <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 2 }}>{playerCount} players total</Text>
                  </View>
                );
              }
              return null;
            })()}

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

            <Text style={styles.sectionHeader}>DISPLAY</Text>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white }}>Dark Mode</Text>
              <Switch value={mode === 'dark'} onValueChange={onToggleTheme} thumbColor={mode === 'dark' ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
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
            <TouchableOpacity onPress={onShowSessionSummary} style={[styles.btnPrimary, { marginBottom: 10, padding: 12, backgroundColor: colors.greenDark }]}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>🏆  SESSION SUMMARY</Text>
            </TouchableOpacity>
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

            <TouchableOpacity style={[styles.btnDanger, { marginTop: 20, backgroundColor: colors.red }]} onPress={onSignOut}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>SIGN OUT</Text>
            </TouchableOpacity>

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
