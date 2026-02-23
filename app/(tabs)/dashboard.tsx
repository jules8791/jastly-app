/**
 * dashboard_migrated.tsx — Full feature build
 *
 * Features:
 *  1. TTS voice selection
 *  2. Repeat Picker Name / Picker Countdown
 *  3. Logging system
 *  4. Settings PIN
 *  5. Leaderboard
 *  6. Player Manager with sort
 *  7. QR Code / Invite QR
 *  8. Session Startup modal
 *  9. Late arrival → back of queue automatically
 * 10. Carry-over queue (save/restore between sessions)
 * 11. Gender-balanced auto-pick
 * 12. Avoid repeat opponents
 * 13. Local notifications (YOUR TURN banner)
 * 14. Substitute player mid-match
 * 15. Match history log
 * 16. Export stats as CSV
 * 17. Club password (join protection)
 * 18. Guest-only read view
 * 19. Club logo (image pick + Supabase Storage)
 *
 * New SQL to run once (add to supabase_rls.sql or run separately):
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS match_history JSONB DEFAULT '[]';
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS saved_queue JSONB DEFAULT '[]';
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS join_password TEXT;
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS club_logo_url TEXT;
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS gender_balanced BOOLEAN DEFAULT false;
 *   ALTER TABLE clubs ADD COLUMN IF NOT EXISTS avoid_repeats BOOLEAN DEFAULT false;
 *
 * New packages to install:
 *   npx expo install expo-notifications expo-image-picker expo-file-system expo-sharing
 *   npx expo install react-native-svg
 *   npm install react-native-qrcode-svg
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  Switch, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../supabase';
import { Club, CourtResult, Player, QueuePlayer } from '../../types';
import { SPORTS } from '../../constants/sports';
import { makeStyles } from '../../components/dashboard/dashboardStyles';
import {
  ClubQRModal,
  LeaderboardModal,
  MatchHistoryModal,
  SystemLogsModal,
  HelpModal,
  PlayerProfileModal,
} from '../../components/dashboard/InfoModals';
import {
  CourtAssignModal,
  MatchResultModal,
  SubstituteModal,
  SetupPinModal,
  EnterPinModal,
  SportSetupModal,
  SessionStartupModal,
} from '../../components/dashboard/ActionModals';
import { useClubSession } from '../../hooks/useClubSession';

// Configure local notifications
import * as Notifications from 'expo-notifications';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function Dashboard() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, mode, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ─── Hook ─────────────────────────────────────────────────────────────────
  const session = useClubSession();
  const {
    isHost,
    hostNickname,
    club, setClub,
    myName,
    cidRef,
    isOnline,
    isSavingPlayer, setIsSavingPlayer,
    isSavingSettings, setIsSavingSettings,
    isProcessingAction, setIsProcessingAction,
    isMyTurnBanner, setIsMyTurnBanner,
    ttsVoice, setTtsVoice,
    repeatEnabled, setRepeatEnabled,
    repeatInterval, setRepeatInterval,
    countdownEnabled, setCountdownEnabled,
    countdownLimit, setCountdownLimit,
    loggingEnabled, setLoggingEnabled,
    pinEnabled, setPinEnabled,
    genderBalanced, setGenderBalanced,
    avoidRepeats, setAvoidRepeats,
    soundEnabled, setSoundEnabled,
    isPowerGuest,
    sportEmoji, courtLabel, playersPerGame, sportLabel,
    hasShownStartupRef,
    logs, addLog,
    getRoster, updateRoster, safeEqual,
    shareSessionStats, exportStats,
    processRequest, sendReq,
    grantPowerGuest, handleAutoPick,
    assignCourt, finishMatch, doSubstitute, claimPowerGuest,
  } = session;

  // ─── Courts & Queue ────────────────────────────────────────────────────────
  const [showCourts, setShowCourts] = useState(false);
  const [showResult, setShowResult] = useState<CourtResult | null>(null);
  const [selectedQueueIdx, setSelectedQueueIdx] = useState<number[]>([]);
  const [winners, setWinners] = useState<string[]>([]);

  // ─── Player Manager ────────────────────────────────────────────────────────
  const [showPlayers, setShowPlayers] = useState(false);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stagedToAdd, setStagedToAdd] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<'Name A-Z' | 'Games Played' | 'Wins'>('Name A-Z');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newGender, setNewGender] = useState('M');

  // ─── Settings (temp / form copies) ────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [tempClubName, setTempClubName] = useState('');
  const [tempCourts, setTempCourts] = useState(4);
  const [tempSport, setTempSport] = useState('badminton');
  const [tempLimit, setTempLimit] = useState(20);
  const [tempTtsVoice, setTempTtsVoice] = useState('en-US');
  const [tempRepeat, setTempRepeat] = useState(false);
  const [tempRepeatInterval, setTempRepeatInterval] = useState(30);
  const [tempCountdown, setTempCountdown] = useState(false);
  const [tempCountdownLimit, setTempCountdownLimit] = useState(60);
  const [tempLoggingEnabled, setTempLoggingEnabled] = useState(false);
  const [tempPinEnabled, setTempPinEnabled] = useState(false);
  const [tempGenderBalanced, setTempGenderBalanced] = useState(false);
  const [tempAvoidRepeats, setTempAvoidRepeats] = useState(false);
  const [tempClubPassword, setTempClubPassword] = useState('');
  const [tempSoundEnabled, setTempSoundEnabled] = useState(true);

  // ─── Logging ───────────────────────────────────────────────────────────────
  const [showLogs, setShowLogs] = useState(false);

  // ─── PIN ───────────────────────────────────────────────────────────────────
  const [showSetupPin, setShowSetupPin] = useState(false);
  const [setupPin1, setSetupPin1] = useState('');
  const [setupPin2, setSetupPin2] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showEnterPin, setShowEnterPin] = useState(false);
  const [enterPinInput, setEnterPinInput] = useState('');
  const [pendingPinAction, setPendingPinAction] = useState<(() => void) | null>(null);

  // ─── Extra modals ─────────────────────────────────────────────────────────
  const [showQR, setShowQR] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showJoinQR, setShowJoinQR] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showStartup, setShowStartup] = useState(false);
  const [startupCourts, setStartupCourts] = useState(4);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [substituteCourtIdx, setSubstituteCourtIdx] = useState('');
  const [substituteOutPlayer, setSubstituteOutPlayer] = useState('');
  const [showPowerGuestPrompt, setShowPowerGuestPrompt] = useState(false);
  const [powerGuestPinInput, setPowerGuestPinInput] = useState('');
  const [tempPowerGuestEnabled, setTempPowerGuestEnabled] = useState(false);
  // Measured via onLayout so it updates correctly on Fold phones switching screens
  const [courtGridWidth, setCourtGridWidth] = useState(0);

  // ─── New feature state ────────────────────────────────────────────────────
  const [showPlayerProfile, setShowPlayerProfile] = useState<Player | null>(null);
  const [showSportSetup, setShowSportSetup] = useState(false);

  // Auto-open court selection popup when correct number of players are tapped
  useEffect(() => { if (selectedQueueIdx.length === playersPerGame) setShowCourts(true); }, [selectedQueueIdx, playersPerGame]);

  // Startup modal — once per mount; show sport setup first if club has no sport set yet
  useEffect(() => {
    if (!isHost || !club || hasShownStartupRef.current) return;
    hasShownStartupRef.current = true;
    setStartupCourts(club.active_courts || 4);
    if (!club.sport) {
      setTempSport('badminton');
      setShowSportSetup(true);
    } else {
      setTempSport(club.sport);
      // Skip startup modal for brand-new clubs (name set but no session data yet)
      const hasHistory = (club.match_history as any[])?.length > 0;
      const hasQueue = (club.waiting_list as any[])?.length > 0;
      if (!hasHistory && !hasQueue) return; // fresh club — go straight to main UI
      setShowStartup(true);
    }
  }, [isHost, club]);

  // Two-column layout on wide web screens
  const isWideWeb = Platform.OS === 'web' && screenWidth > 900;

  // ─── Player Manager Logic ─────────────────────────────────────────────────
  const isAvailable = (pName: string) => {
    if (!club) return false;
    const inQueue = club.waiting_list?.some((w: any) => w.name === pName);
    const onCourt = Object.values(club.court_occupants || {}).flat().some((c: any) => c.name === pName);
    return !inQueue && !onCourt;
  };

  const roster = getRoster(club);

  const displayRoster = roster
    .filter((p: any) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (showAvailableOnly) return isAvailable(p.name) && matchesSearch;
      return matchesSearch;
    })
    .sort((a: any, b: any) => {
      if (sortOption === 'Name A-Z') return a.name.localeCompare(b.name);
      if (sortOption === 'Games Played') return (b.games || 0) - (a.games || 0);
      if (sortOption === 'Wins') return (b.wins || 0) - (a.wins || 0);
      return 0;
    });

  const handleSelectAll = () => {
    const visibleNames = displayRoster.map((p: any) => p.name);
    if (stagedToAdd.length === visibleNames.length && visibleNames.length > 0) setStagedToAdd([]);
    else setStagedToAdd(visibleNames);
  };

  const addStagedToQueue = async () => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const playersToAdd = stagedToAdd.map((name) => roster.find((r: any) => r.name === name)).filter(Boolean);
      if (isHost) await processRequest({ action: 'batch_join', payload: { players: playersToAdd }, _fromHost: true });
      else if (isPowerGuest) {
        playersToAdd.forEach(p => sendReq('batch_join', { players: [p], name: myName }));
      } else sendReq('batch_join', { players: playersToAdd });
      setStagedToAdd([]);
      setShowPlayers(false);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const saveNewPlayer = async () => {
    if (!isHost || isSavingPlayer) return;
    const rawName = newPlayerName.trim();
    if (!rawName) return;
    const clean = rawName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);
    if (!clean) { Alert.alert('Invalid name', 'Name must contain letters or numbers.'); return; }
    const sportK = club?.sport || 'badminton';
    const currentRoster = getRoster(club);
    const currentQueue = club?.waiting_list || [];
    let nextRosterArr = [...currentRoster];
    let nextQueue = [...currentQueue];
    if (editingPlayerName) {
      if (clean !== editingPlayerName && nextRosterArr.some((p: Player) => (p.name || '').toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Name already exists!'); return;
      }
      const rIdx = nextRosterArr.findIndex((p: Player) => p.name === editingPlayerName);
      if (rIdx !== -1) nextRosterArr[rIdx] = { ...nextRosterArr[rIdx], name: clean, gender: newGender as 'M' | 'F' };
      const qIdx = nextQueue.findIndex((p: QueuePlayer) => p.name === editingPlayerName);
      if (qIdx !== -1) nextQueue[qIdx] = { ...nextQueue[qIdx], name: clean, gender: newGender as 'M' | 'F' };
    } else {
      if (nextRosterArr.some((p: Player) => (p.name || '').toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Player already exists!'); return;
      }
      nextRosterArr.push({ name: clean, gender: newGender as 'M' | 'F', games: 0, wins: 0 });
      addLog(`SYSTEM: Registered ${clean}.`);
    }
    const nextRosterFull = updateRoster(club?.master_roster, sportK, nextRosterArr);
    setIsSavingPlayer(true);
    try {
      setClub((prev: Club | null) => prev ? { ...prev, master_roster: nextRosterFull, waiting_list: nextQueue } : prev);
      const { data, error } = await supabase.from('clubs').update({ master_roster: nextRosterFull, waiting_list: nextQueue }).eq('id', cidRef.current).select().single();
      if (error) { Alert.alert('Save failed', error.message); return; }
      if (data) setClub(data as Club);
      setNewPlayerName(''); setEditingPlayerName(null); setSearchQuery(''); setShowNewPlayer(false);
    } finally {
      setIsSavingPlayer(false);
    }
  };

  const deletePlayer = (name: string) => {
    if (!isHost) return;
    Alert.alert('Confirm Delete', `Permanently delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const sportK = club!.sport || 'badminton';
        const nextRosterArr = roster.filter((p: any) => p.name !== name);
        const nextRosterFull = updateRoster(club!.master_roster, sportK, nextRosterArr);
        const nextQueue = club!.waiting_list?.filter((p: QueuePlayer) => p.name !== name) || [];
        setClub((prev: any) => ({ ...prev, master_roster: nextRosterFull, waiting_list: nextQueue }));
        await supabase.from('clubs').update({ master_roster: nextRosterFull, waiting_list: nextQueue }).eq('id', cidRef.current);
        addLog(`SYSTEM: Deleted ${name}.`);
      }},
    ]);
  };

  // ─── Settings Logic ───────────────────────────────────────────────────────
  const openSettings = () => {
    if (!club) return;
    setTempClubName(club.club_name || '');
    setTempCourts(club.active_courts || 4);
    setTempLimit(club.pick_limit || 20);
    setTempTtsVoice(ttsVoice);
    setTempRepeat(repeatEnabled);
    setTempRepeatInterval(repeatInterval);
    setTempCountdown(countdownEnabled);
    setTempCountdownLimit(countdownLimit);
    setTempLoggingEnabled(loggingEnabled);
    setTempPinEnabled(pinEnabled);
    setTempGenderBalanced(genderBalanced);
    setTempAvoidRepeats(avoidRepeats);
    setTempClubPassword(''); // never pre-fill with stored hash
    setTempPowerGuestEnabled(!!(club.has_power_guest_pin ?? club.power_guest_pin));
    setTempSoundEnabled(soundEnabled);
    setTempSport(club.sport || 'badminton');
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!isHost || isSavingSettings) return;
    setIsSavingSettings(true);
    try {
      const hashedPassword = tempClubPassword.trim() ? await hashPassword(tempClubPassword.trim()) : null;
      setClub((prev: any) => ({
        ...prev,
        club_name: tempClubName,
        active_courts: tempCourts,
        pick_limit: tempLimit,
        gender_balanced: tempGenderBalanced,
        avoid_repeats: tempAvoidRepeats,
        join_password: hashedPassword,
        sport: tempSport,
      }));
      const { data: sessionData } = await supabase.auth.getSession();
      const myUid = sessionData?.session?.user?.id;
      await supabase.from('clubs').update({
        club_name: tempClubName,
        active_courts: tempCourts,
        pick_limit: tempLimit,
        gender_balanced: tempGenderBalanced,
        avoid_repeats: tempAvoidRepeats,
        join_password: hashedPassword,
        sport: tempSport,
        ...(myUid ? { host_uid: myUid } : {}),
      }).eq('id', cidRef.current);
      setTtsVoice(tempTtsVoice);
      setRepeatEnabled(tempRepeat);
      setRepeatInterval(tempRepeatInterval);
      setCountdownEnabled(tempCountdown);
      setCountdownLimit(tempCountdownLimit);
      setLoggingEnabled(tempLoggingEnabled);
      setGenderBalanced(tempGenderBalanced);
      setAvoidRepeats(tempAvoidRepeats);
      setSoundEnabled(tempSoundEnabled);
      await AsyncStorage.multiSet([
        ['tts_voice', tempTtsVoice],
        ['repeat_enabled', tempRepeat.toString()],
        ['repeat_interval', tempRepeatInterval.toString()],
        ['countdown_enabled', tempCountdown.toString()],
        ['countdown_limit', tempCountdownLimit.toString()],
        ['logging_enabled', tempLoggingEnabled.toString()],
        ['sound_enabled', tempSoundEnabled.toString()],
      ]);
      setShowSettings(false);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const resetSession = () => {
    if (!isHost) return;
    Alert.alert('Reset Session?', 'Clear queue and courts? (Stats remain safe)', [
      { text: 'Cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {} }));
        await supabase.from('clubs').update({ waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
        addLog('SYSTEM: Reset Session.');
        setShowSettings(false);
      }},
    ]);
  };

  const fullWipe = async () => {
    if (!isHost) return;
    const storedPin = await AsyncStorage.getItem('settings_pin');
    if (storedPin) { setPendingPinAction(() => executeFullWipe); setEnterPinInput(''); setShowEnterPin(true); }
    else executeFullWipe();
  };

  const executeFullWipe = () => {
    Alert.alert('WIPE ALL?', 'This permanently deletes all players and stats.', [
      { text: 'Cancel' },
      { text: 'DELETE ALL', style: 'destructive', onPress: async () => {
        setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {}, master_roster: {}, match_history: [] }));
        await supabase.from('clubs').update({ waiting_list: [], court_occupants: {}, master_roster: {}, match_history: [] }).eq('id', cidRef.current);
        addLog('SYSTEM: Full Wipe.');
        setShowSettings(false);
      }},
    ]);
  };

  // ─── Club Logo ────────────────────────────────────────────────────────────
  const pickClubLogo = async () => {
    if (!isHost) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType || 'image/jpeg';
    const ext = mimeType.split('/')[1] || uri.split('.').pop() || 'jpg';
    const fileName = `logos/${cidRef.current}.${ext}`;
    let error: any;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      ({ error } = await supabase.storage.from('club-logos').upload(fileName, blob, { contentType: mimeType, upsert: true }));
    } else {
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: mimeType } as any);
      ({ error } = await supabase.storage.from('club-logos').upload(fileName, formData, { upsert: true }));
    }
    if (error) { Alert.alert('Upload failed', error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('club-logos').getPublicUrl(fileName);
    await supabase.from('clubs').update({ club_logo_url: publicUrl }).eq('id', cidRef.current);
    setClub((prev: any) => ({ ...prev, club_logo_url: publicUrl }));
  };

  // ─── PIN Logic ────────────────────────────────────────────────────────────
  const handlePinToggle = (val: boolean) => {
    if (val) { setSetupPin1(''); setSetupPin2(''); setPinError(false); setTempPinEnabled(true); setShowSetupPin(true); }
    else { AsyncStorage.multiRemove(['settings_pin']).catch(() => {}); AsyncStorage.setItem('pin_enabled', 'false').catch(() => {}); setPinEnabled(false); setTempPinEnabled(false); }
  };

  // ─── Crypto helpers ───────────────────────────────────────────────────────
  const makeHash = async (input: string): Promise<string> => {
    const saltBytes = await Crypto.getRandomBytesAsync(16);
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
    return `${salt}:${hash}`;
  };

  const verifyHashedPin = async (input: string, stored: string): Promise<boolean> => {
    if (!stored) return false;
    const idx = stored.indexOf(':');
    if (idx !== -1) {
      const salt = stored.slice(0, idx);
      const storedHash = stored.slice(idx + 1);
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
      return safeEqual(hash, storedHash);
    }
    const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::pin::${input}`);
    return safeEqual(legacy, stored);
  };

  const hashPin = makeHash;
  const hashPassword = makeHash;

  const saveSetupPin = async () => {
    if (setupPin1.length === 4 && setupPin1 === setupPin2) {
      await AsyncStorage.setItem('settings_pin', await hashPin(setupPin1));
      await AsyncStorage.setItem('pin_enabled', 'true');
      setPinEnabled(true); setShowSetupPin(false);
    } else { setPinError(true); }
  };

  const verifyPin = async () => {
    const storedPin = await AsyncStorage.getItem('settings_pin');
    if (storedPin && await verifyHashedPin(enterPinInput, storedPin)) {
      setShowEnterPin(false); setEnterPinInput('');
      const action = pendingPinAction; setPendingPinAction(null);
      if (action) action();
    } else { Alert.alert('Incorrect PIN', 'Please try again.'); }
  };

  // ─── Substitute helper ────────────────────────────────────────────────────
  const openSubstitute = (courtIdx: string, outPlayer: string) => {
    setSubstituteCourtIdx(courtIdx);
    setSubstituteOutPlayer(outPlayer);
    setShowSubstitute(true);
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const leaderboard = [...getRoster(club)].sort((a: any, b: any) => {
    const aRate = (a.games || 0) > 0 ? a.wins / a.games : 0;
    const bRate = (b.games || 0) > 0 ? b.wins / b.games : 0;
    return bRate - aRate;
  });

  const matchHistory: any[] = club?.match_history || [];

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (!club) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FFEB3B" /></View>;
  }

  const myQueuePos = club.waiting_list?.findIndex((p: any) => p.name === myName) ?? -1;
  const activeBeforeMe = myQueuePos >= 0 ? club.waiting_list.slice(0, myQueuePos).filter((p: any) => !p.isResting).length : -1;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={styles.container}>

      {/* ── OFFLINE BANNER ─────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={{ backgroundColor: '#B71C1C', paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
            OFFLINE — reconnecting...
          </Text>
        </View>
      )}

      {/* ==================================================================
          POWER GUEST CLAIM MODAL
      ================================================================== */}
      <Modal visible={showPowerGuestPrompt} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚡ CLAIM POWER MODE</Text>
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 15 }}>
              Enter the session PIN to gain elevated controls
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Session PIN"
              placeholderTextColor={colors.gray3}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              autoFocus
              value={powerGuestPinInput}
              onChangeText={setPowerGuestPinInput}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setShowPowerGuestPrompt(false); setPowerGuestPinInput(''); }}>
                <Text style={{ color: colors.gray1 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                claimPowerGuest(powerGuestPinInput);
                setPowerGuestPinInput('');
                setShowPowerGuestPrompt(false);
              }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>UNLOCK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── YOUR TURN BANNER (guest) ────────────────────────── */}
      {!isHost && isMyTurnBanner && (
        <TouchableOpacity
          style={{ backgroundColor: colors.green, padding: 12, alignItems: 'center' }}
          onPress={() => setIsMyTurnBanner(false)}
        >
          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 16 }}>{sportEmoji} IT'S YOUR TURN TO PICK A {courtLabel.toUpperCase()}! (tap to dismiss)</Text>
        </TouchableOpacity>
      )}

      {/* ── POWER GUEST CLAIM BUTTON (guest only, when club has pg PIN set) ── */}
      {!isHost && !isPowerGuest && (club?.has_power_guest_pin ?? club?.power_guest_pin) && (
        <TouchableOpacity
          style={{ backgroundColor: colors.deepBlue, padding: 10, alignItems: 'center' }}
          onPress={() => { setPowerGuestPinInput(''); setShowPowerGuestPrompt(true); }}
        >
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 13 }}>⚡ CLAIM POWER MODE</Text>
        </TouchableOpacity>
      )}

      {/* ── GUEST POSITION BANNER ───────────────────────────── */}
      {!isHost && myQueuePos >= 0 && !isMyTurnBanner && (
        <View style={{ backgroundColor: colors.surfaceHigh, padding: 8, alignItems: 'center' }}>
          <Text style={{ color: colors.gray2, fontSize: 12 }}>
            Your position: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>#{myQueuePos + 1}</Text>
            {activeBeforeMe > 0 ? `  •  ${activeBeforeMe} ahead of you` : '  •  You\'re next!'}
          </Text>
        </View>
      )}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setShowQR(true)}>
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
          <TouchableOpacity style={[styles.settingsBtn, { marginRight: 4 }]} onPress={() => setShowHelp(true)}>
            <Text style={{ fontSize: 18, color: colors.gray2, fontWeight: 'bold' }}>?</Text>
          </TouchableOpacity>
          {isHost && (
            <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.btnDanger}
            onPress={async () => {
              if (Platform.OS === 'web') {
                if (!window.confirm('Leave this session?')) return;
                if (!isHost) sendReq('leave');
                await AsyncStorage.multiRemove(['currentClubId', 'isHost']).catch(() => {});
                router.replace('/');
              } else {
                Alert.alert('Leave Session?', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: async () => {
                    if (!isHost) sendReq('leave');
                    await AsyncStorage.multiRemove(['currentClubId', 'isHost']).catch(() => {});
                    router.replace('/');
                  }},
                ]);
              }
            }}
          >
            <Text style={styles.btnText}>LEAVE</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── COURTS GRID + BANNER + QUEUE all in one ScrollView ── */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={isWideWeb ? { flexDirection: 'row', alignItems: 'flex-start' } : {}}>

        {/* LEFT COLUMN (or full-width on narrow): Courts grid */}
        <View style={isWideWeb ? { flex: 3 } : {}}>

        {/* Courts grid — onLayout gives the real pixel width so it adapts
            correctly on Fold phones switching between front / inner screen
            and on web where screenWidth can be 1200px+ */}
        {(() => {
          const numCourts = club.active_courts || 4;
          const cardMargin = 4;
          // Use measured width; fall back to screenWidth on first render
          const gridW = courtGridWidth > 0 ? courtGridWidth : screenWidth;
          // More columns on wide screens: 4 on desktop web, 3 on wide tablet/unfolded
          const numCols = gridW > 900 ? 4 : gridW > 600 ? 3 : 2;
          // Total horizontal space consumed by margins: 2*(numCols+1)*cardMargin
          const cardWidth = Math.max(60, Math.floor((gridW - 2 * (numCols + 1) * cardMargin) / numCols));
          const numRows = Math.ceil(numCourts / numCols);
          const cardHeight = Math.max(80, Math.floor(260 / numRows));
          // Font sizes scale with card dimensions; allow larger values on wide cards
          const nameFontSize = Math.max(9, Math.min(Math.floor(cardWidth / 12), Math.floor(cardHeight / 6)));
          const titleFontSize = Math.max(8, Math.min(Math.floor(cardWidth / 16), Math.floor(cardHeight / 8)));
          // Build rows of numCols
          const rows: number[][] = [];
          for (let i = 0; i < numCourts; i += numCols) {
            rows.push(Array.from({ length: numCols }, (_, j) => i + j).filter(n => n < numCourts));
          }
          return (
            <View
              style={{ paddingHorizontal: cardMargin, paddingTop: cardMargin }}
              onLayout={(e) => setCourtGridWidth(e.nativeEvent.layout.width)}
            >
              {rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', marginBottom: cardMargin }}>
                  {row.map(i => {
                    const players = club.court_occupants?.[i.toString()];
                    const isBusy = !!players;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[{
                          width: cardWidth,
                          height: cardHeight,
                          marginHorizontal: cardMargin,
                          borderRadius: 8,
                          borderWidth: 1,
                          padding: 4,
                          overflow: 'hidden',
                        }, isBusy ? styles.courtBusy : styles.courtFree]}
                        onPress={() => isBusy ? setShowResult({ courtIdx: i.toString(), players }) : null}
                      >
                        <Text style={[styles.courtTitle, { fontSize: titleFontSize }]} numberOfLines={1}>
                          {courtLabel.toUpperCase()} {i + 1}
                        </Text>
                        {isBusy ? (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text numberOfLines={1} style={[styles.courtPlayer, { fontSize: nameFontSize }]}>
                              {players[0]?.name} & {players[1]?.name}
                            </Text>
                            <Text style={{ color: colors.gray2, fontSize: Math.max(8, titleFontSize - 1) }}>VS</Text>
                            <Text numberOfLines={1} style={[styles.courtPlayer, { fontSize: nameFontSize }]}>
                              {players[2]?.name} & {players[3]?.name}
                            </Text>
                            {isHost && (
                              <TouchableOpacity
                                onPress={() => openSubstitute(i.toString(), players[0]?.name)}
                                style={{ backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }}
                              >
                                <Text style={{ color: colors.primary, fontSize: Math.max(9, titleFontSize - 1) }}>SUB</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={[styles.courtFreeText, { fontSize: nameFontSize + 2 }]}>FREE</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {/* Phantom cards to keep short rows left-aligned */}
                  {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, idx) => (
                    <View key={`ph-${idx}`} style={{ width: cardWidth, marginHorizontal: cardMargin }} />
                  ))}
                </View>
              ))}
            </View>
          );
        })()}
        </View>{/* end left column */}

        {/* RIGHT COLUMN (or full-width on narrow): Banner + Queue */}
        <View style={isWideWeb ? { flex: 2 } : {}}>

        {/* ── BANNER ─────────────────────────────────────────────── */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.nextText}>
              NEXT: {club.waiting_list?.find((p: any) => !p.isResting)?.name || 'EMPTY'}
            </Text>
            {(isHost || isPowerGuest) && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => {
                  const indices = handleAutoPick();
                  if (indices) { setSelectedQueueIdx(indices); setShowCourts(true); }
                }}>
                  <Text style={styles.btnPrimaryText}>AUTO-PICK{genderBalanced ? ' ⚧' : ''}{avoidRepeats ? ' 🔄' : ''}</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.gray3, fontSize: 10, alignSelf: 'center' }}>or tap {playersPerGame} players</Text>
                {isPowerGuest && !isHost && (
                  <Text style={{ color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>⚡</Text>
                )}
              </View>
            )}
            {!isHost && !isPowerGuest && club.waiting_list?.find((w: any) => !w.isResting)?.name === myName && (
              <Text style={{ color: colors.green, fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>
                Tap {playersPerGame} players — a popup will appear to assign a {courtLabel.toLowerCase()}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => { setShowNewPlayer(false); setShowPlayers(true); }}
          >
            <Text style={styles.btnText}>{isHost ? 'MANAGE PLAYERS' : isPowerGuest ? 'MANAGE QUEUE' : 'VIEW QUEUE'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── QUEUE ──────────────────────────────────────────────── */}
        {(club.waiting_list || []).map((p: any, i: number) => {
          const isMe = p.name === myName;
          const isSelected = selectedQueueIdx.includes(i);
          const firstActiveIdx = club.waiting_list.findIndex((w: any) => !w.isResting);
          const effectiveIsHost = isHost;
          const effectiveIsPowerGuest = isPowerGuest;
          const isMyTurn = !effectiveIsHost && !effectiveIsPowerGuest && firstActiveIdx >= 0 && club.waiting_list[firstActiveIdx]?.name === myName;
          // Hosts and power guests can always tap; regular guests only when it's their turn
          const canSelect = effectiveIsHost || effectiveIsPowerGuest || isMyTurn;

          return (
            <TouchableOpacity
              key={i}
              style={[styles.queueRow,
                p.isResting && { opacity: 0.4 },
                isMe && { borderWidth: 1, borderColor: colors.green },
                isSelected && { backgroundColor: colors.selectedBg, borderWidth: 1, borderColor: colors.primary },
              ]}
              onPress={() => {
                if (!canSelect) return;
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isSelected) setSelectedQueueIdx(selectedQueueIdx.filter(x => x !== i));
                else if (selectedQueueIdx.length < playersPerGame) setSelectedQueueIdx([...selectedQueueIdx, i]);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ color: isSelected ? colors.primary : colors.gray3, marginRight: 10, fontSize: 14, width: 22, fontWeight: isSelected ? 'bold' : 'normal' }}>{i + 1}</Text>
                <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue }]}>
                  <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                  <Text style={[styles.pName,
                    p.isResting && { textDecorationLine: 'line-through', color: colors.gray3 },
                    isMe && { color: colors.green },
                    isSelected && { color: colors.primary },
                  ]}>
                    {p.name}{isMe ? ' (you)' : ''}
                  </Text>
                  {p.isPowerGuest && (
                    <View style={{ backgroundColor: colors.deepBlue, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 }}>
                      <Text style={{ color: colors.primary, fontSize: 9, fontWeight: 'bold' }}>⚡ POWER</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {effectiveIsHost && !p.isResting && (
                  <TouchableOpacity
                    style={{ marginRight: 8, padding: 5 }}
                    onPress={() => grantPowerGuest(p.name, !p.isPowerGuest)}
                  >
                    <Text style={{ fontSize: 14 }}>{p.isPowerGuest ? '⚡' : '☆'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ marginRight: 15, padding: 5 }}
                  onPress={() => {
                    if (effectiveIsHost || isPowerGuest) processRequest({ action: 'toggle_pause', payload: { name: p.name }, _fromHost: effectiveIsHost, _isPowerGuest: isPowerGuest });
                    else if (isMe) sendReq('toggle_pause');
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{p.isResting ? '▶' : 'II'}</Text>
                </TouchableOpacity>
                {(effectiveIsHost || isPowerGuest || isMe) && (
                  <TouchableOpacity
                    style={{ padding: 5 }}
                    onPress={() => Alert.alert('Leave Queue?', `Remove ${p.name} from queue?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave', style: 'destructive', onPress: () => {
                        if (effectiveIsHost) processRequest({ action: 'leave', payload: { name: p.name }, _fromHost: true });
                        else if (isPowerGuest) sendReq('leave', { name: p.name });
                        else sendReq('leave');
                      }},
                    ])}
                  >
                    <Text style={{ color: colors.red, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {(club.waiting_list || []).length === 0 && (
          <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 40 }}>Queue is empty</Text>
        )}

        <View style={{ height: 40 }} />
        </View>{/* end right column */}
        </View>{/* end two-column row */}
      </ScrollView>


      {/* ==================================================================
          PLAYER MANAGER MODAL
      ================================================================== */}
      <Modal visible={showPlayers} animationType="slide" transparent>
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            {showNewPlayer ? (
              <View style={{ flex: 1 }}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>{editingPlayerName ? 'EDIT PLAYER' : 'NEW PLAYER'}</Text>
                  <TouchableOpacity onPress={() => setShowNewPlayer(false)} style={{ paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.white, fontSize: 32, fontWeight: 'bold', lineHeight: 32 }}>×</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Player name..."
                  placeholderTextColor={colors.gray2}
                  autoCapitalize="characters"
                  maxLength={20}
                  value={newPlayerName}
                  onChangeText={setNewPlayerName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                  {['M', 'F'].map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setNewGender(g)}
                      style={[styles.genderBtn, { backgroundColor: newGender === g ? (g === 'M' ? colors.blue : colors.pink) : colors.borderSoft }]}
                    >
                      <Text style={{ color: colors.white, fontWeight: 'bold' }}>{g === 'M' ? '♂ MALE' : '♀ FEMALE'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.btnPrimary, { padding: 15, opacity: isSavingPlayer ? 0.5 : 1 }]}
                  onPress={saveNewPlayer}
                  disabled={isSavingPlayer}
                >
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>
                    {isSavingPlayer ? 'SAVING...' : 'SAVE'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>
                    {isHost ? `MASTER ROSTER (${displayRoster.length})` : `QUEUE (${(club.waiting_list || []).length})`}
                  </Text>
                  <TouchableOpacity onPress={() => setShowPlayers(false)} style={{ paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.white, fontSize: 32, fontWeight: 'bold', lineHeight: 32 }}>×</Text>
                  </TouchableOpacity>
                </View>

                {(isHost || isPowerGuest) && (
                  <TouchableOpacity
                    onPress={() => { setEditingPlayerName(null); setNewPlayerName(''); setShowNewPlayer(true); }}
                    style={[styles.btnPrimary, { backgroundColor: colors.blue, marginBottom: 15, padding: 15 }]}
                  >
                    <Text style={[styles.btnText, { textAlign: 'center', fontSize: 16 }]}>+ REGISTER NEW PLAYER</Text>
                  </TouchableOpacity>
                )}

                <TextInput
                  style={[styles.input, { marginBottom: 10, padding: 10 }]}
                  placeholder="Search players..."
                  placeholderTextColor={colors.gray2}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {isHost && (
                  <View style={[styles.toolbar, { flexWrap: 'wrap', gap: 8 }]}>
                    <TouchableOpacity onPress={() => setShowAvailableOnly(!showAvailableOnly)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: showAvailableOnly ? colors.primary : colors.gray2, fontSize: 22, marginRight: 5 }}>
                        {showAvailableOnly ? '☑' : '☐'}
                      </Text>
                      <Text style={{ color: colors.white }}>Hide Active/Playing</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      {(['Name A-Z', 'Games Played', 'Wins'] as const).map(opt => (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setSortOption(opt)}
                          style={{ marginRight: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: sortOption === opt ? colors.purple : colors.border }}
                        >
                          <Text style={{ color: colors.white, fontSize: 10 }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ flex: 1, marginVertical: 10 }}>
                  <ScrollView>
                    {(isHost ? displayRoster : club.waiting_list || []).map((p: any, i: number) => {
                      const avail = isHost ? isAvailable(p.name) : true;
                      const staged = stagedToAdd.includes(p.name);
                      const isMe = p.name === myName;
                      return (
                        <View key={i} style={[styles.rosterRow, staged && { backgroundColor: 'rgba(76,175,80,0.2)' }, isMe && { backgroundColor: 'rgba(76,175,80,0.1)' }]}>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            disabled={!avail || !isHost}
                            onPress={() => {
                              if (!isHost) return;
                              if (staged) setStagedToAdd(prev => prev.filter(x => x !== p.name));
                              else setStagedToAdd(prev => [...prev, p.name]);
                            }}
                          >
                            {isHost && (
                              <View style={[styles.checkbox, staged && { backgroundColor: colors.green, borderColor: colors.green }, !avail && { opacity: 0.2 }]}>
                                {staged && <Text style={{ color: colors.white, fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                              </View>
                            )}
                            <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue, width: 14, height: 14, marginRight: 8 }]}>
                              <Text style={{ color: colors.white, fontSize: 8, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
                            </View>
                            {!isHost && (
                              <Text style={{ color: colors.gray3, width: 22, fontSize: 12 }}>{i + 1}</Text>
                            )}
                            <Text style={{ color: avail ? colors.white : colors.gray3, fontSize: 16, fontWeight: 'bold' }}>
                              {p.name}{isMe ? ' (you)' : ''}{p.isResting ? ' 💤' : ''}
                            </Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity style={{ padding: 10 }} onPress={() => {
                              const rosterEntry = (club.master_roster || []).find((m: any) => m.name === p.name) || p;
                              setShowPlayerProfile(rosterEntry);
                            }}>
                              <Text style={{ fontSize: 16 }}>📊</Text>
                            </TouchableOpacity>
                            {(isHost || isPowerGuest) && (
                              <>
                                <TouchableOpacity style={{ padding: 10 }} onPress={() => { setEditingPlayerName(p.name); setNewPlayerName(p.name); setNewGender(p.gender || 'M'); setShowNewPlayer(true); }}>
                                  <Text style={{ fontSize: 16 }}>✏️</Text>
                                </TouchableOpacity>
                                {isHost && (
                                  <TouchableOpacity style={{ padding: 10 }} onPress={() => deletePlayer(p.name)}>
                                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                {isHost && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity onPress={handleSelectAll} style={{ padding: 15, justifyContent: 'center' }}>
                      <Text style={{ color: colors.white, fontWeight: 'bold' }}>SELECT ALL</Text>
                    </TouchableOpacity>
                    {stagedToAdd.length > 0 && (
                      <TouchableOpacity
                        onPress={addStagedToQueue}
                        disabled={isProcessingAction}
                        style={[styles.btnPrimary, { padding: 15, backgroundColor: colors.green, flex: 1, marginLeft: 10, opacity: isProcessingAction ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>
                          {isProcessingAction ? 'ADDING...' : `ADD ${stagedToAdd.length} TO QUEUE`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          PLAYER PROFILE MODAL
      ================================================================== */}
      <PlayerProfileModal
        visible={!!showPlayerProfile}
        player={showPlayerProfile}
        courtOccupants={club.court_occupants || {}}
        waitingList={club.waiting_list || []}
        sportEmoji={sportEmoji}
        courtLabel={courtLabel}
        onClose={() => setShowPlayerProfile(null)}
      />

      {/* ==================================================================
          SETTINGS MODAL
      ================================================================== */}
      <Modal visible={showSettings} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalContent, { marginVertical: 20 }]}>
              <Text style={styles.modalTitle}>CLUB SETTINGS</Text>

              <Text style={styles.sectionHeader}>SPORT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setTempSport(key)}
                    style={[styles.sportChip, tempSport === key && styles.sportChipActive]}
                  >
                    <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                    <Text style={{ color: tempSport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionHeader}>CLUB</Text>
              <Text style={styles.label}>Club Name</Text>
              <TextInput style={styles.input} value={tempClubName} onChangeText={setTempClubName} />

              <TouchableOpacity onPress={pickClubLogo} style={[styles.btnPrimary, { backgroundColor: colors.blueDark, padding: 12, marginBottom: 15 }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>
                  {club.club_logo_url ? '🖼️  CHANGE CLUB LOGO' : '🖼️  SET CLUB LOGO'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                Join Password {club.join_password ? '(currently set — enter new to change, leave blank to remove)' : '(leave blank = open)'}
              </Text>
              <TextInput
                style={styles.input}
                value={tempClubPassword}
                onChangeText={setTempClubPassword}
                placeholder="No password"
                placeholderTextColor={colors.gray3}
                secureTextEntry
              />

              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Active {courtLabel}s</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setTempCourts(Math.max(1, tempCourts - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                  <Text style={{ color: colors.primary, marginHorizontal: 15, fontWeight: 'bold' }}>{tempCourts}</Text>
                  <TouchableOpacity onPress={() => setTempCourts(Math.min(10, tempCourts + 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                </View>
              </View>
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Auto-Pick Range</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setTempLimit(Math.max(4, tempLimit - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                  <Text style={{ color: colors.primary, marginHorizontal: 15, fontWeight: 'bold' }}>{tempLimit}</Text>
                  <TouchableOpacity onPress={() => setTempLimit(Math.min(30, tempLimit + 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionHeader}>AUTO-PICK INTELLIGENCE</Text>
              <View style={styles.settingsRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.white }}>Gender Balanced</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>Prefer 2M + 2F when possible</Text>
                </View>
                <Switch value={tempGenderBalanced} onValueChange={setTempGenderBalanced} thumbColor={tempGenderBalanced ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>
              <View style={styles.settingsRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.white }}>Avoid Repeat Opponents</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>Try not to repeat last game's matchups</Text>
                </View>
                <Switch value={tempAvoidRepeats} onValueChange={setTempAvoidRepeats} thumbColor={tempAvoidRepeats ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>

              <Text style={styles.sectionHeader}>POWER GUEST</Text>
              <View style={styles.settingsRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.white }}>Enable Power Guest PIN</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>Guests who enter this PIN get elevated controls</Text>
                </View>
                <Switch
                  value={tempPowerGuestEnabled}
                  onValueChange={async (val) => {
                    if (val) {
                      const existingPin = await AsyncStorage.getItem('settings_pin');
                      if (existingPin) {
                        const updated = { ...club, power_guest_pin: existingPin };
                        setClub(updated);
                        await supabase.from('clubs').update({ power_guest_pin: existingPin }).eq('id', cidRef.current);
                        setTempPowerGuestEnabled(true);
                        Alert.alert('Power Guest Enabled', 'Using your existing settings PIN. Guests enter it to claim power status.');
                      } else {
                        Alert.alert('No PIN Set', 'Set a Settings PIN first (Security & Admin section below), then enable Power Guest.');
                        setTempPowerGuestEnabled(false);
                      }
                    } else {
                      const updated = { ...club, power_guest_pin: null };
                      setClub(updated);
                      await supabase.from('clubs').update({ power_guest_pin: null }).eq('id', cidRef.current);
                      const newQueue = (club.waiting_list || []).map((p: any) => ({ ...p, isPowerGuest: false }));
                      setClub((prev: any) => ({ ...prev, power_guest_pin: null, waiting_list: newQueue }));
                      await supabase.from('clubs').update({ power_guest_pin: null, waiting_list: newQueue }).eq('id', cidRef.current);
                      setTempPowerGuestEnabled(false);
                    }
                  }}
                  thumbColor={tempPowerGuestEnabled ? colors.primary : colors.gray3}
                  trackColor={{ true: colors.purple, false: colors.border }}
                />
              </View>
              {tempPowerGuestEnabled && (
                <View style={{ marginBottom: 10, paddingLeft: 4 }}>
                  <Text style={{ color: colors.gray3, fontSize: 11 }}>
                    Guests tap "Claim Power Mode" and enter your settings PIN.
                  </Text>
                  <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 3 }}>
                    Host can also tap the star next to any player to grant manually.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionHeader}>ANNOUNCEMENTS</Text>
              <Text style={styles.label}>Announcer Voice</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 }}>
                {[{ label: 'American', value: 'en-US' }, { label: 'British', value: 'en-GB' }, { label: 'Australian', value: 'en-AU' }, { label: 'Indian', value: 'en-IN' }, { label: 'S. African', value: 'en-ZA' }].map(v => (
                  <TouchableOpacity key={v.value} onPress={() => setTempTtsVoice(v.value)} style={{ marginRight: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: tempTtsVoice === v.value ? colors.purple : colors.border, borderRadius: 4 }}>
                    <Text style={{ color: tempTtsVoice === v.value ? colors.primary : colors.white, fontSize: 12 }}>{v.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Repeat Picker Name</Text>
                <Switch value={tempRepeat} onValueChange={setTempRepeat} thumbColor={tempRepeat ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>
              {tempRepeat && (
                <View style={[styles.settingsRow, { paddingLeft: 10 }]}>
                  <Text style={{ color: colors.gray1 }}>Every (sec)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setTempRepeatInterval(Math.max(10, tempRepeatInterval - 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                    <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold' }}>{tempRepeatInterval}s</Text>
                    <TouchableOpacity onPress={() => setTempRepeatInterval(Math.min(120, tempRepeatInterval + 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Picker Countdown</Text>
                <Switch value={tempCountdown} onValueChange={setTempCountdown} thumbColor={tempCountdown ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>
              {tempCountdown && (
                <View style={[styles.settingsRow, { paddingLeft: 10 }]}>
                  <Text style={{ color: colors.gray1 }}>Timeout (sec)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setTempCountdownLimit(Math.max(30, tempCountdownLimit - 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                    <Text style={{ color: colors.primary, marginHorizontal: 12, fontWeight: 'bold' }}>{tempCountdownLimit}s</Text>
                    <TouchableOpacity onPress={() => setTempCountdownLimit(Math.min(180, tempCountdownLimit + 10))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Chime Sound (Your Turn)</Text>
                <Switch value={tempSoundEnabled} onValueChange={setTempSoundEnabled} thumbColor={tempSoundEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>

              <Text style={styles.sectionHeader}>SECURITY & ADMIN</Text>
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Enable Logging</Text>
                <Switch value={tempLoggingEnabled} onValueChange={setTempLoggingEnabled} thumbColor={tempLoggingEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Settings PIN (protects Wipe)</Text>
                <Switch value={tempPinEnabled} onValueChange={handlePinToggle} thumbColor={tempPinEnabled ? colors.primary : colors.gray3} trackColor={{ true: colors.purple, false: colors.border }} />
              </View>

              <View style={{ flexDirection: 'row', marginVertical: 10 }}>
                <TouchableOpacity onPress={() => { setShowSettings(false); setShowLogs(true); }} style={[styles.btnPrimary, { flex: 1, marginRight: 5, padding: 10 }]}>
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>VIEW LOGS</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowSettings(false); setShowLeaderboard(true); }} style={[styles.btnPrimary, { flex: 1, marginLeft: 5, padding: 10 }]}>
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>LEADERBOARD</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <TouchableOpacity onPress={() => { setShowSettings(false); setShowMatchHistory(true); }} style={[styles.btnPrimary, { flex: 1, marginRight: 5, padding: 10, backgroundColor: colors.deepBlue }]}>
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>MATCH HISTORY</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={exportStats} style={[styles.btnPrimary, { flex: 1, marginLeft: 5, padding: 10, backgroundColor: colors.greenDark }]}>
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>EXPORT CSV</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { setShowSettings(false); shareSessionStats(); }} style={[styles.btnPrimary, { marginBottom: 10, padding: 12, backgroundColor: colors.purple }]}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>🏸  SHARE SESSION STATS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnPrimary, { marginBottom: 10, padding: 14, backgroundColor: colors.blueDark }]} onPress={() => { setShowSettings(false); setShowJoinQR(true); }}>
                <Text style={[styles.btnText, { textAlign: 'center', fontSize: 13 }]}>📷  SHOW INVITE QR CODE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnDanger, { marginTop: 5, backgroundColor: colors.gray3 }]} onPress={resetSession}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>RESET QUEUE & COURTS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnDanger, { marginTop: 10 }]} onPress={fullWipe}>
                <Text style={[styles.btnText, { textAlign: 'center' }]}>WIPE ALL DATA</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>DISPLAY</Text>
              <View style={styles.settingsRow}>
                <Text style={{ color: colors.white }}>Dark Mode</Text>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={toggleTheme}
                  thumbColor={mode === 'dark' ? colors.primary : colors.gray3}
                  trackColor={{ true: colors.purple, false: colors.border }}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnDanger, { marginTop: 20, backgroundColor: colors.red }]}
                onPress={() => Alert.alert('Sign Out', 'Sign out and return to the home screen?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: async () => {
                    setShowSettings(false);
                    await supabase.auth.signOut().catch(() => {});
                    await AsyncStorage.multiRemove(['currentClubId', 'isHost', 'guestName']).catch(() => {});
                    router.replace('/');
                  }},
                ])}
              >
                <Text style={[styles.btnText, { textAlign: 'center' }]}>SIGN OUT</Text>
              </TouchableOpacity>

              {isHost && (
                <TouchableOpacity
                  style={{ marginTop: 24, padding: 14, backgroundColor: colors.border, borderRadius: 8, alignItems: 'center' }}
                  onPress={async () => {
                    setShowSettings(false);
                    await AsyncStorage.removeItem('currentClubId');
                    router.replace('/');
                  }}
                >
                  <Text style={{ color: colors.white, fontWeight: 'bold' }}>🏢  MY CLUBS</Text>
                  <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 2 }}>Switch club or create a new one</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <Text style={{ color: colors.gray1 }}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveSettings} disabled={isSavingSettings}>
                  <Text style={{ color: isSavingSettings ? colors.gray2 : colors.primary, fontWeight: 'bold' }}>
                    {isSavingSettings ? 'SAVING...' : 'SAVE SETTINGS'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── HELP MODAL ───────────────────────────────────────── */}
      <HelpModal
        visible={showHelp}
        sportEmoji={sportEmoji}
        courtLabel={courtLabel}
        onClose={() => setShowHelp(false)}
      />

      {/* ── COURTS ASSIGNMENT MODAL ──────────────────────────── */}
      <CourtAssignModal
        visible={showCourts}
        selectedQueueIdx={selectedQueueIdx}
        waitingList={club.waiting_list || []}
        activeCourts={club.active_courts || 4}
        courtOccupants={club.court_occupants || {}}
        courtLabel={courtLabel}
        isProcessingAction={isProcessingAction}
        onAssignCourt={(courtIdx) => {
          assignCourt(courtIdx, selectedQueueIdx, () => {
            setSelectedQueueIdx([]);
            setShowCourts(false);
          }).then(() => {
            setSelectedQueueIdx([]);
            setShowCourts(false);
          });
        }}
        onCancel={() => { setShowCourts(false); setSelectedQueueIdx([]); }}
      />

      {/* ── MATCH RESULTS MODAL ──────────────────────────────── */}
      <MatchResultModal
        visible={!!showResult}
        courtResult={showResult}
        winners={winners}
        onToggleWinner={(name) => {
          if (winners.includes(name)) setWinners(winners.filter(w => w !== name));
          else if (winners.length < 2) setWinners([...winners, name]);
          else Alert.alert('Max 2 winners', 'Deselect one first.');
        }}
        onConfirm={() => {
          if (!showResult) return;
          finishMatch(showResult, winners);
          setWinners([]); setShowResult(null);
        }}
        onCancel={() => { setShowResult(null); setWinners([]); }}
      />

      {/* ==================================================================
          SUBSTITUTE MODAL
      ================================================================== */}
      <SubstituteModal
        visible={showSubstitute}
        substituteCourtIdx={substituteCourtIdx}
        substituteOutPlayer={substituteOutPlayer}
        courtOccupants={club.court_occupants || {}}
        waitingList={club.waiting_list || []}
        onSetSubstituteOutPlayer={setSubstituteOutPlayer}
        onDoSubstitute={(inPlayer) => {
          doSubstitute(inPlayer, substituteCourtIdx, substituteOutPlayer);
          setShowSubstitute(false);
        }}
        onCancel={() => { setShowSubstitute(false); setSubstituteOutPlayer(''); }}
      />

      {/* ==================================================================
          MATCH HISTORY MODAL
      ================================================================== */}
      <MatchHistoryModal
        visible={showMatchHistory}
        matchHistory={matchHistory}
        courtLabel={courtLabel}
        onClose={() => setShowMatchHistory(false)}
      />

      {/* ==================================================================
          QR CODE MODAL (header tap)
      ================================================================== */}
      <ClubQRModal
        visible={showQR}
        title="SHARE CLUB"
        deepLink={`https://app.jastly.com/join?clubId=${club?.id}`}
        onClose={() => setShowQR(false)}
      />

      {/* ==================================================================
          SYSTEM LOGS MODAL
      ================================================================== */}
      <SystemLogsModal
        visible={showLogs}
        logs={logs}
        onClose={() => setShowLogs(false)}
      />

      {/* ==================================================================
          INVITE QR CODE MODAL (settings)
      ================================================================== */}
      <ClubQRModal
        visible={showJoinQR}
        title="INVITE PLAYERS"
        deepLink={`https://app.jastly.com/join?clubId=${club?.id}`}
        onClose={() => setShowJoinQR(false)}
      />

      {/* ==================================================================
          LEADERBOARD MODAL
      ================================================================== */}
      <LeaderboardModal
        visible={showLeaderboard}
        leaderboard={leaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      {/* ==================================================================
          SETUP PIN MODAL
      ================================================================== */}
      <SetupPinModal
        visible={showSetupPin}
        setupPin1={setupPin1}
        setupPin2={setupPin2}
        pinError={pinError}
        onChangePin1={(v) => { setSetupPin1(v); setPinError(false); }}
        onChangePin2={(v) => { setSetupPin2(v); setPinError(false); }}
        onSave={saveSetupPin}
        onCancel={() => { setShowSetupPin(false); setTempPinEnabled(false); }}
      />

      {/* ==================================================================
          ENTER PIN MODAL
      ================================================================== */}
      <EnterPinModal
        visible={showEnterPin}
        enterPinInput={enterPinInput}
        onChangePinInput={setEnterPinInput}
        onVerify={verifyPin}
        onCancel={() => { setShowEnterPin(false); setEnterPinInput(''); setPendingPinAction(null); }}
      />

      {/* ==================================================================
          FIRST-TIME SPORT SETUP MODAL (host only, new clubs)
      ================================================================== */}
      <SportSetupModal
        visible={showSportSetup}
        tempSport={tempSport}
        onSelectSport={setTempSport}
        onConfirm={async () => {
          await supabase.from('clubs').update({ sport: tempSport }).eq('id', cidRef.current);
          setClub((prev: any) => ({ ...prev, sport: tempSport }));
          setShowSportSetup(false);
          setShowStartup(true);
        }}
      />

      {/* ==================================================================
          SESSION STARTUP MODAL (host only, every session)
      ================================================================== */}
      <SessionStartupModal
        visible={showStartup}
        tempSport={tempSport}
        startupCourts={startupCourts}
        savedQueueLength={club?.saved_queue?.length || 0}
        onSelectSport={setTempSport}
        onChangeStartupCourts={setStartupCourts}
        onRestore={async () => {
          const savedQ = club.saved_queue || [];
          setClub((prev: any) => ({ ...prev, sport: tempSport, active_courts: startupCourts, waiting_list: savedQ, court_occupants: {} }));
          await supabase.from('clubs').update({ sport: tempSport, active_courts: startupCourts, waiting_list: savedQ, court_occupants: {} }).eq('id', cidRef.current);
          addLog('SYSTEM: Restored previous queue.');
          setShowStartup(false);
        }}
        onReset={async () => {
          setClub((prev: any) => ({ ...prev, sport: tempSport, active_courts: startupCourts, waiting_list: [], court_occupants: {} }));
          await supabase.from('clubs').update({ sport: tempSport, active_courts: startupCourts, waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
          addLog('SYSTEM: Reset Session.');
          setShowStartup(false);
        }}
        onContinue={async () => {
          setClub((prev: any) => ({ ...prev, sport: tempSport, active_courts: startupCourts }));
          await supabase.from('clubs').update({ sport: tempSport, active_courts: startupCourts }).eq('id', cidRef.current);
          setShowStartup(false);
        }}
      />

    </View>
  );
}

// makeStyles has been extracted to components/dashboard/dashboardStyles.ts
