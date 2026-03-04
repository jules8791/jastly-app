/**
 * dashboard.tsx — Refactored shell
 *
 * Large JSX sections extracted to:
 *   components/dashboard/CourtsGrid.tsx
 *   components/dashboard/QueuePanel.tsx
 *   components/dashboard/SettingsModal.tsx
 *   components/dashboard/PlayerManagerModal.tsx
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  Text, useWindowDimensions, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../supabase';
import { Club, CourtResult, Player, QueuePlayer } from '../../types';
import { makeStyles } from '../../components/dashboard/dashboardStyles';
import {
  ClubQRModal, LeaderboardModal, MatchHistoryModal,
  SystemLogsModal, HelpModal, PlayerProfileModal, SessionSummaryModal,
} from '../../components/dashboard/InfoModals';
import {
  CourtAssignModal, MatchResultModal, SubstituteModal,
  SetupPinModal, EnterPinModal, SportSetupModal, SessionStartupModal, BatchAddModal,
  GuidedSetupWizard,
} from '../../components/dashboard/ActionModals';
import { TournamentPanel } from '../../components/dashboard/TournamentPanel';
import {
  TournamentSetupModal, TournamentResultModal,
  TournamentStandingsModal, TeamDetailModal,
} from '../../components/dashboard/TournamentModals';
import { TournamentMatch, TournamentTeam } from '../../types';
import { useClubSession } from '../../hooks/useClubSession';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { GuestStatusBanner } from '../../components/dashboard/GuestStatusBanner';
import { CourtsGrid } from '../../components/dashboard/CourtsGrid';
import { QueuePanel } from '../../components/dashboard/QueuePanel';
import { SettingsModal, TempSettings, DEFAULT_TEMP_SETTINGS } from '../../components/dashboard/SettingsModal';
import { PlayerManagerModal } from '../../components/dashboard/PlayerManagerModal';

import * as Notifications from 'expo-notifications';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

export default function Dashboard() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, mode, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const session = useClubSession();
  const {
    isHost, hostNickname, club, setClub, myName, cidRef, isOnline,
    isSavingPlayer, setIsSavingPlayer, isSavingSettings, setIsSavingSettings,
    isProcessingAction, setIsProcessingAction, isMyTurnBanner, setIsMyTurnBanner,
    ttsVoice, setTtsVoice, repeatEnabled, setRepeatEnabled,
    repeatInterval, setRepeatInterval, countdownEnabled, setCountdownEnabled,
    countdownLimit, setCountdownLimit, loggingEnabled, setLoggingEnabled,
    pinEnabled, setPinEnabled, genderBalanced, setGenderBalanced,
    avoidRepeats, setAvoidRepeats, soundEnabled, setSoundEnabled,
    isPowerGuest, sportEmoji, courtLabel, playersPerGame, sportLabel,
    hasShownStartupRef, logs, addLog, getRoster, updateRoster, safeEqual,
    shareSessionStats, exportStats, processRequest, sendReq,
    grantPowerGuest, handleAutoPick, assignCourt, finishMatch, doSubstitute, claimPowerGuest,
    undoLastAction, courtStartTimes,
  } = session;

  // ─── Courts & Queue ────────────────────────────────────────────────────────
  const [showCourts, setShowCourts] = useState(false);
  const [showResult, setShowResult] = useState<CourtResult | null>(null);
  const [selectedQueueIdx, setSelectedQueueIdx] = useState<number[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  // ─── Player Manager ────────────────────────────────────────────────────────
  const [showPlayers, setShowPlayers] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stagedToAdd, setStagedToAdd] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<'Name A-Z' | 'Games Played' | 'Wins'>('Name A-Z');

  // ─── Settings ─────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<TempSettings>(DEFAULT_TEMP_SETTINGS);

  // ─── PIN ───────────────────────────────────────────────────────────────────
  const [showSetupPin, setShowSetupPin] = useState(false);
  const [setupPin1, setSetupPin1] = useState('');
  const [setupPin2, setSetupPin2] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showEnterPin, setShowEnterPin] = useState(false);
  const [enterPinInput, setEnterPinInput] = useState('');
  const [pendingPinAction, setPendingPinAction] = useState<(() => void) | null>(null);

  // ─── Modals ────────────────────────────────────────────────────────────────
  const [showQR, setShowQR] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showJoinQR, setShowJoinQR] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showStartup, setShowStartup] = useState(false);
  const [startupCourts, setStartupCourts] = useState(4);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showTournamentSetup, setShowTournamentSetup] = useState(false);
  const [showTournamentResult, setShowTournamentResult] = useState(false);
  const [showTournamentStandings, setShowTournamentStandings] = useState(false);
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<TournamentMatch | null>(null);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<TournamentTeam | null>(null);
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [substituteCourtIdx, setSubstituteCourtIdx] = useState('');
  const [substituteOutPlayer, setSubstituteOutPlayer] = useState('');
  const [showPlayerProfile, setShowPlayerProfile] = useState<Player | null>(null);
  const [showSportSetup, setShowSportSetup] = useState(false);

  useEffect(() => {
    if (selectedQueueIdx.length === playersPerGame) setShowCourts(true);
  }, [selectedQueueIdx, playersPerGame]);

  useEffect(() => {
    if (!isHost || !club || hasShownStartupRef.current) return;
    hasShownStartupRef.current = true;
    setStartupCourts(club.active_courts || 4);
    if (!club.sport) {
      setTempSettings(prev => ({ ...prev, sport: 'badminton' }));
      setShowSportSetup(true);
    } else {
      setTempSettings(prev => ({ ...prev, sport: club.sport! }));
      const hasHistory = (club.match_history as any[])?.length > 0;
      const hasQueue = (club.waiting_list as any[])?.length > 0;
      if (!hasHistory && !hasQueue) return;
      setShowStartup(true);
    }
  }, [isHost, club]);

  const isWideWeb = Platform.OS === 'web' && screenWidth > 900;

  // ─── Player Manager Logic ─────────────────────────────────────────────────
  const roster = getRoster(club);

  const displayRoster: Player[] = roster
    .filter((p: Player) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (showAvailableOnly) {
        const inQueue = club?.waiting_list?.some((w: QueuePlayer) => w.name === p.name);
        const onCourt = Object.values(club?.court_occupants || {}).flat().some((c: QueuePlayer) => c.name === p.name);
        return !inQueue && !onCourt && matchesSearch;
      }
      return matchesSearch;
    })
    .sort((a: Player, b: Player) => {
      if (sortOption === 'Name A-Z') return a.name.localeCompare(b.name);
      if (sortOption === 'Games Played') return (b.games || 0) - (a.games || 0);
      if (sortOption === 'Wins') return (b.wins || 0) - (a.wins || 0);
      return 0;
    });

  const handleSelectAll = () => {
    const names = displayRoster.map((p: Player) => p.name);
    if (stagedToAdd.length === names.length && names.length > 0) setStagedToAdd([]);
    else setStagedToAdd(names);
  };

  const addStagedToQueue = async () => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const players = stagedToAdd.map(name => roster.find((r: Player) => r.name === name)).filter(Boolean);
      if (isHost) await processRequest({ action: 'batch_join', payload: { players }, _fromHost: true });
      else if (isPowerGuest) players.forEach(p => sendReq('batch_join', { players: [p], name: myName }));
      else sendReq('batch_join', { players });
      setStagedToAdd([]); setShowPlayers(false);
    } finally { setIsProcessingAction(false); }
  };

  const saveNewPlayer = async (rawNameInput: string, gender: string, editingName: string | null) => {
    if (!isHost || isSavingPlayer) return;
    const raw = rawNameInput.trim();
    if (!raw) return;
    const clean = raw.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);
    if (!clean) { Alert.alert('Invalid name', 'Name must contain letters or numbers.'); return; }
    const sportK = club?.sport || 'badminton';
    let nextRoster = [...getRoster(club)];
    let nextQueue = [...(club?.waiting_list || [])];
    if (editingName) {
      if (clean !== editingName && nextRoster.some((p: Player) => p.name.toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Name already exists!'); return;
      }
      const ri = nextRoster.findIndex((p: Player) => p.name === editingName);
      if (ri !== -1) nextRoster[ri] = { ...nextRoster[ri], name: clean, gender: gender as 'M' | 'F' };
      const qi = nextQueue.findIndex((p: QueuePlayer) => p.name === editingName);
      if (qi !== -1) nextQueue[qi] = { ...nextQueue[qi], name: clean, gender: gender as 'M' | 'F' };
    } else {
      if (nextRoster.some((p: Player) => p.name.toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Player already exists!'); return;
      }
      nextRoster.push({ name: clean, gender: gender as 'M' | 'F', games: 0, wins: 0 });
      addLog(`SYSTEM: Registered ${clean}.`);
    }
    const nextRosterFull = updateRoster(club?.master_roster, sportK, nextRoster);
    setIsSavingPlayer(true);
    try {
      setClub((prev: Club | null) => prev ? { ...prev, master_roster: nextRosterFull, waiting_list: nextQueue } : prev);
      const { data, error } = await supabase.from('clubs').update({ master_roster: nextRosterFull, waiting_list: nextQueue }).eq('id', cidRef.current).select().single();
      if (error) { Alert.alert('Save failed', error.message); return; }
      if (data) setClub(data as Club);
      setSearchQuery('');
    } finally { setIsSavingPlayer(false); }
  };

  const deletePlayer = (name: string) => {
    if (!isHost) return;
    Alert.alert('Confirm Delete', `Permanently delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const sportK = club!.sport || 'badminton';
        const nextRoster = roster.filter((p: Player) => p.name !== name);
        const nextRosterFull = updateRoster(club!.master_roster, sportK, nextRoster);
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
    setTempSettings({
      clubName: club.club_name || '',
      courts: club.active_courts || 4,
      sport: club.sport || 'badminton',
      limit: club.pick_limit || 20,
      ttsVoice, repeat: repeatEnabled, repeatInterval, countdown: countdownEnabled,
      countdownLimit, loggingEnabled, pinEnabled, genderBalanced, avoidRepeats,
      clubPassword: '',
      soundEnabled,
      powerGuestEnabled: !!(club.has_power_guest_pin ?? club.power_guest_pin),
    });
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!isHost || isSavingSettings) return;
    setIsSavingSettings(true);
    try {
      const hashedPw = tempSettings.clubPassword.trim() ? await makeHash(tempSettings.clubPassword.trim()) : null;
      setClub((prev: any) => ({ ...prev, club_name: tempSettings.clubName, active_courts: tempSettings.courts,
        pick_limit: tempSettings.limit, gender_balanced: tempSettings.genderBalanced,
        avoid_repeats: tempSettings.avoidRepeats, join_password: hashedPw, sport: tempSettings.sport }));
      const { data: sd } = await supabase.auth.getSession();
      const uid = sd?.session?.user?.id;
      await supabase.from('clubs').update({
        club_name: tempSettings.clubName, active_courts: tempSettings.courts, pick_limit: tempSettings.limit,
        gender_balanced: tempSettings.genderBalanced, avoid_repeats: tempSettings.avoidRepeats,
        join_password: hashedPw, sport: tempSettings.sport, ...(uid ? { host_uid: uid } : {}),
      }).eq('id', cidRef.current);
      setTtsVoice(tempSettings.ttsVoice); setRepeatEnabled(tempSettings.repeat);
      setRepeatInterval(tempSettings.repeatInterval); setCountdownEnabled(tempSettings.countdown);
      setCountdownLimit(tempSettings.countdownLimit); setLoggingEnabled(tempSettings.loggingEnabled);
      setGenderBalanced(tempSettings.genderBalanced); setAvoidRepeats(tempSettings.avoidRepeats);
      setSoundEnabled(tempSettings.soundEnabled);
      await AsyncStorage.multiSet([
        ['tts_voice', tempSettings.ttsVoice], ['repeat_enabled', tempSettings.repeat.toString()],
        ['repeat_interval', tempSettings.repeatInterval.toString()], ['countdown_enabled', tempSettings.countdown.toString()],
        ['countdown_limit', tempSettings.countdownLimit.toString()], ['logging_enabled', tempSettings.loggingEnabled.toString()],
        ['sound_enabled', tempSettings.soundEnabled.toString()],
      ]);
      setShowSettings(false);
    } finally { setIsSavingSettings(false); }
  };

  const resetSession = () => {
    if (!isHost) return;
    setShowSettings(false);
    setTimeout(() => {
      Alert.alert('Reset Session?', 'Clear queue and courts? (Stats remain safe)', [
        { text: 'Cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {} }));
          await supabase.from('clubs').update({ waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
          addLog('SYSTEM: Reset Session.');
        }},
      ]);
    }, 350);
  };

  const executeFullWipe = () => {
    setShowSettings(false);
    setTimeout(() => {
      Alert.alert('WIPE ALL?', 'This permanently deletes all players and stats.', [
        { text: 'Cancel' },
        { text: 'DELETE ALL', style: 'destructive', onPress: async () => {
          setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {}, master_roster: {}, match_history: [] }));
          await supabase.from('clubs').update({ waiting_list: [], court_occupants: {}, master_roster: {}, match_history: [] }).eq('id', cidRef.current);
          addLog('SYSTEM: Full Wipe.');
        }},
      ]);
    }, 350);
  };

  const fullWipe = async () => {
    if (!isHost) return;
    const pin = await AsyncStorage.getItem('settings_pin');
    if (pin) { setPendingPinAction(() => executeFullWipe); setEnterPinInput(''); setShowEnterPin(true); }
    else executeFullWipe();
  };

  // ─── Club Logo ────────────────────────────────────────────────────────────
  const pickClubLogo = async () => {
    if (!isHost) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const ext = mimeType.split('/')[1] || asset.uri.split('.').pop() || 'jpg';
    const fileName = `logos/${cidRef.current}.${ext}`;
    let error: any;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      ({ error } = await supabase.storage.from('club-logos').upload(fileName, blob, { contentType: mimeType, upsert: true }));
    } else {
      const fd = new FormData();
      fd.append('file', { uri: asset.uri, name: fileName, type: mimeType } as any);
      ({ error } = await supabase.storage.from('club-logos').upload(fileName, fd, { upsert: true }));
    }
    if (error) { Alert.alert('Upload failed', error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('club-logos').getPublicUrl(fileName);
    await supabase.from('clubs').update({ club_logo_url: publicUrl }).eq('id', cidRef.current);
    setClub((prev: any) => ({ ...prev, club_logo_url: publicUrl }));
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
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
      return safeEqual(hash, stored.slice(idx + 1));
    }
    const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::pin::${input}`);
    return safeEqual(legacy, stored);
  };

  const handlePinToggle = (val: boolean) => {
    if (val) {
      setSetupPin1(''); setSetupPin2(''); setPinError(false);
      setTempSettings(prev => ({ ...prev, pinEnabled: true }));
      setShowSetupPin(true);
    } else {
      AsyncStorage.multiRemove(['settings_pin']).catch(() => {});
      AsyncStorage.setItem('pin_enabled', 'false').catch(() => {});
      setPinEnabled(false);
      setTempSettings(prev => ({ ...prev, pinEnabled: false }));
    }
  };

  const saveSetupPin = async () => {
    if (setupPin1.length === 4 && setupPin1 === setupPin2) {
      await AsyncStorage.setItem('settings_pin', await makeHash(setupPin1));
      await AsyncStorage.setItem('pin_enabled', 'true');
      setPinEnabled(true); setShowSetupPin(false);
    } else { setPinError(true); }
  };

  const verifyPin = async () => {
    const stored = await AsyncStorage.getItem('settings_pin');
    if (stored && await verifyHashedPin(enterPinInput, stored)) {
      setShowEnterPin(false); setEnterPinInput('');
      const action = pendingPinAction; setPendingPinAction(null);
      if (action) action();
    } else { Alert.alert('Incorrect PIN', 'Please try again.'); }
  };

  const handlePowerGuestToggle = async (val: boolean) => {
    if (val) {
      const pin = await AsyncStorage.getItem('settings_pin');
      if (pin) {
        setClub({ ...club!, power_guest_pin: pin });
        await supabase.from('clubs').update({ power_guest_pin: pin }).eq('id', cidRef.current);
        setTempSettings(prev => ({ ...prev, powerGuestEnabled: true }));
        Alert.alert('Power Guest Enabled', 'Using your existing settings PIN.');
      } else {
        Alert.alert('No PIN Set', 'Set a Settings PIN first, then enable Power Guest.');
        setTempSettings(prev => ({ ...prev, powerGuestEnabled: false }));
      }
    } else {
      const newQueue = (club?.waiting_list || []).map((p: QueuePlayer) => ({ ...p, isPowerGuest: false }));
      setClub((prev: any) => ({ ...prev, power_guest_pin: null, waiting_list: newQueue }));
      await supabase.from('clubs').update({ power_guest_pin: null, waiting_list: newQueue }).eq('id', cidRef.current);
      setTempSettings(prev => ({ ...prev, powerGuestEnabled: false }));
    }
  };

  const openSubstitute = (courtIdx: string, outPlayer: string) => {
    setSubstituteCourtIdx(courtIdx); setSubstituteOutPlayer(outPlayer); setShowSubstitute(true);
  };

  const signOut = async () => {
    setShowSettings(false);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await AsyncStorage.multiRemove(['currentClubId', 'isHost', 'guestName', 'theme_mode']).catch(() => {});
    router.replace('/');
  };

  const goMyClubs = async () => {
    setShowSettings(false);
    await AsyncStorage.removeItem('currentClubId');
    router.replace({ pathname: '/', params: { showPicker: '1' } });
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const leaderboard = [...getRoster(club)].sort((a: any, b: any) => {
    const ar = a.games > 0 ? a.wins / a.games : 0;
    const br = b.games > 0 ? b.wins / b.games : 0;
    return br - ar;
  });
  const matchHistory: any[] = club?.match_history || [];

  if (!club) return <View style={styles.center}><ActivityIndicator size="large" color="#FFEB3B" /></View>;

  const myQueuePos = club.waiting_list?.findIndex((p: any) => p.name === myName) ?? -1;
  const activeBeforeMe = myQueuePos >= 0 ? club.waiting_list.slice(0, myQueuePos).filter((p: any) => !p.isResting).length : -1;

  return (
    <View style={styles.container}>

      {!isOnline && (
        <View style={{ backgroundColor: '#B71C1C', paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>OFFLINE — reconnecting...</Text>
        </View>
      )}

      <GuestStatusBanner
        isHost={isHost}
        isPowerGuest={isPowerGuest}
        isOnline={isOnline}
        isMyTurnBanner={isMyTurnBanner}
        sportEmoji={sportEmoji}
        courtLabel={courtLabel}
        hasPowerGuestPin={!!(club?.has_power_guest_pin ?? club?.power_guest_pin)}
        myQueuePos={myQueuePos}
        activeBeforeMe={activeBeforeMe}
        myName={myName}
        courtOccupants={club.court_occupants || {}}
        playersPerGame={playersPerGame}
        onDismissTurnBanner={() => setIsMyTurnBanner(false)}
        onClaimPowerGuest={claimPowerGuest}
      />

      {/* ── HEADER ── */}
      <DashboardHeader
        club={club}
        isHost={isHost}
        hostNickname={hostNickname}
        sportLabel={sportLabel}
        onPressQR={() => setShowQR(true)}
        onPressHelp={() => setShowHelp(true)}
        onPressSettings={openSettings}
        onLeave={() => { if (!isHost) sendReq('leave'); }}
      />

      {/* ── MAIN CONTENT ── */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={isWideWeb ? { flexDirection: 'row', alignItems: 'flex-start' } : {}}>
          <View style={isWideWeb ? { flex: 3 } : {}}>
            <CourtsGrid
              activeCourts={club.active_courts || 4}
              courtOccupants={club.court_occupants || {}}
              courtLabel={courtLabel} sportEmoji={sportEmoji}
              isHost={isHost} isPowerGuest={isPowerGuest} isProcessingAction={isProcessingAction}
              courtStartTimes={courtStartTimes}
              onFinishMatch={(courtIdx, players) => {
                // Check if this court has an active tournament match
                const tMatch = club.tournament?.matches.find(
                  m => String(m.courtIdx) === String(courtIdx) && m.winnerId === null,
                );
                if (tMatch && club.tournament) {
                  setActiveTournamentMatch(tMatch);
                  setShowTournamentResult(true);
                } else {
                  setShowResult({ courtIdx, players });
                }
              }}
              onSubstitute={openSubstitute}
            />
          </View>
          <View style={isWideWeb ? { flex: 2 } : {}}>
            {club.tournament ? (
              <TournamentPanel
                tournament={club.tournament}
                isHost={isHost}
                courtLabel={courtLabel}
                onStartMatch={(match) => {
                  // Find a free court
                  const busyCourts = new Set(Object.keys(club.court_occupants || {}).map(Number));
                  let courtIdx = 0;
                  while (busyCourts.has(courtIdx) && courtIdx < (club.active_courts || 4)) courtIdx++;
                  const team1 = club.tournament!.teams.find(t => t.id === match.team1Id);
                  const team2 = club.tournament!.teams.find(t => t.id === match.team2Id);
                  const allPlayers = [
                    ...(team1?.players.map(name => ({ name, gender: (club.waiting_list?.find((p: any) => p.name === name)?.gender ?? 'M') as 'M' | 'F' })) ?? []),
                    ...(team2?.players.map(name => ({ name, gender: (club.waiting_list?.find((p: any) => p.name === name)?.gender ?? 'M') as 'M' | 'F' })) ?? []),
                  ];
                  processRequest({ action: 'start_tournament_match', payload: { matchId: match.id, courtIdx, players: allPlayers }, _fromHost: true });
                }}
                onViewStandings={() => setShowTournamentStandings(true)}
                onEndTournament={() => {
                  Alert.alert('End Tournament', 'Are you sure you want to end the tournament?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End', style: 'destructive', onPress: () => processRequest({ action: 'tournament_end', payload: {}, _fromHost: true }) },
                  ]);
                }}
                onTeamPress={(team) => setSelectedTeamDetail(team)}
              />
            ) : (
              <QueuePanel
                club={club} isHost={isHost} isPowerGuest={isPowerGuest} myName={myName}
                selectedQueueIdx={selectedQueueIdx} playersPerGame={playersPerGame}
                sportEmoji={sportEmoji} courtLabel={courtLabel}
                genderBalanced={genderBalanced} avoidRepeats={avoidRepeats}
                isProcessingAction={isProcessingAction}
                onSelectQueueIdx={setSelectedQueueIdx}
                onAutoPick={() => { const i = handleAutoPick(); if (i) { setSelectedQueueIdx(i); setShowCourts(true); } }}
                onOpenPlayers={() => setShowPlayers(true)}
                onTogglePause={(name) => {
                  if (isHost || isPowerGuest) processRequest({ action: 'toggle_pause', payload: { name }, _fromHost: isHost, _isPowerGuest: isPowerGuest });
                  else if (name === myName) sendReq('toggle_pause');
                }}
                onLeave={(name) => {
                  if (isHost) processRequest({ action: 'leave', payload: { name }, _fromHost: true });
                  else if (isPowerGuest) sendReq('leave', { name });
                  else sendReq('leave');
                }}
                onGrantPowerGuest={grantPowerGuest}
                onUndo={isHost ? undoLastAction : undefined}
                onMoveUp={(i) => {
                  if (isHost) processRequest({ action: 'reorder_queue', payload: { fromIdx: i, toIdx: i - 1 }, _fromHost: true });
                  else sendReq('reorder_queue', { fromIdx: i, toIdx: i - 1 });
                }}
                onMoveDown={(i) => {
                  if (isHost) processRequest({ action: 'reorder_queue', payload: { fromIdx: i, toIdx: i + 1 }, _fromHost: true });
                  else sendReq('reorder_queue', { fromIdx: i, toIdx: i + 1 });
                }}
                onBatchAdd={isHost || isPowerGuest ? () => setShowBatchAdd(true) : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── PLAYER MANAGER MODAL ── */}
      <PlayerManagerModal
        visible={showPlayers} club={club} isHost={isHost} isPowerGuest={isPowerGuest}
        myName={myName} sportLabel={sportLabel} stagedToAdd={stagedToAdd}
        searchQuery={searchQuery} showAvailableOnly={showAvailableOnly} sortOption={sortOption}
        isSavingPlayer={isSavingPlayer} isProcessingAction={isProcessingAction}
        displayRoster={displayRoster}
        onClose={() => setShowPlayers(false)}
        onSearchChange={setSearchQuery}
        onToggleAvailableOnly={() => setShowAvailableOnly(v => !v)}
        onSortChange={setSortOption}
        onToggleStaged={(name) => setStagedToAdd(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])}
        onSelectAll={handleSelectAll}
        onAddStagedToQueue={addStagedToQueue}
        onSavePlayer={saveNewPlayer}
        onDeletePlayer={deletePlayer}
        onViewProfile={(p) => setShowPlayerProfile((getRoster(club).find((m: Player) => m.name === p.name) || p) as Player)}
      />

      <PlayerProfileModal visible={!!showPlayerProfile} player={showPlayerProfile}
        courtOccupants={club.court_occupants || {}} waitingList={club.waiting_list || []}
        sportEmoji={sportEmoji} courtLabel={courtLabel} onClose={() => setShowPlayerProfile(null)} />

      {/* ── SETTINGS MODAL ── */}
      <SettingsModal
        visible={showSettings} club={club} isHost={isHost} isSavingSettings={isSavingSettings}
        courtLabel={courtLabel} mode={mode} tempSettings={tempSettings} setTempSettings={setTempSettings}
        onSave={saveSettings} onCancel={() => setShowSettings(false)} onPickLogo={pickClubLogo}
        onResetSession={resetSession} onFullWipe={fullWipe} onExportCsv={exportStats}
        onShareStats={() => { setShowSettings(false); shareSessionStats(); }}
        onShowLogs={() => { setShowSettings(false); setShowLogs(true); }}
        onShowLeaderboard={() => { setShowSettings(false); setShowLeaderboard(true); }}
        onShowMatchHistory={() => { setShowSettings(false); setShowMatchHistory(true); }}
        onShowSessionSummary={() => { setShowSettings(false); setShowSessionSummary(true); }}
        onShowInviteQR={() => { setShowSettings(false); setShowJoinQR(true); }}
        onToggleTheme={toggleTheme} onSignOut={signOut} onMyClubs={goMyClubs}
        onPinToggle={handlePinToggle} onPowerGuestToggle={handlePowerGuestToggle}
        onShowSetupGuide={() => { setShowSettings(false); setShowSetupGuide(true); }}
        onShowTournament={() => { setShowSettings(false); setShowTournamentSetup(true); }}
        tournamentActive={!!club?.tournament}
      />

      <HelpModal visible={showHelp} sportEmoji={sportEmoji} courtLabel={courtLabel} onClose={() => setShowHelp(false)} />

      <CourtAssignModal visible={showCourts} selectedQueueIdx={selectedQueueIdx}
        waitingList={club.waiting_list || []} activeCourts={club.active_courts || 4}
        courtOccupants={club.court_occupants || {}} courtLabel={courtLabel}
        playersPerGame={playersPerGame} isProcessingAction={isProcessingAction}
        onAssignCourt={(courtIdx) => {
          assignCourt(courtIdx, selectedQueueIdx, () => { setSelectedQueueIdx([]); setShowCourts(false); })
            .then(() => { setSelectedQueueIdx([]); setShowCourts(false); });
        }}
        onCancel={() => { setShowCourts(false); setSelectedQueueIdx([]); }} />

      <MatchResultModal visible={!!showResult} courtResult={showResult} winners={winners}
        scoreA={scoreA} scoreB={scoreB}
        onScoreAChange={setScoreA} onScoreBChange={setScoreB}
        onToggleWinner={(name) => {
          if (winners.includes(name)) setWinners(winners.filter(w => w !== name));
          else if (winners.length < 2) setWinners([...winners, name]);
          else Alert.alert('Max 2 winners', 'Deselect one first.');
        }}
        onConfirm={() => {
          if (!showResult) return;
          const parsedA = scoreA !== '' ? parseInt(scoreA, 10) : undefined;
          const parsedB = scoreB !== '' ? parseInt(scoreB, 10) : undefined;
          finishMatch(showResult, winners, parsedA, parsedB);
          setWinners([]); setScoreA(''); setScoreB(''); setShowResult(null);
        }}
        onCancel={() => { setShowResult(null); setWinners([]); setScoreA(''); setScoreB(''); }} />

      <SubstituteModal visible={showSubstitute} substituteCourtIdx={substituteCourtIdx}
        substituteOutPlayer={substituteOutPlayer} courtOccupants={club.court_occupants || {}}
        waitingList={club.waiting_list || []} onSetSubstituteOutPlayer={setSubstituteOutPlayer}
        onDoSubstitute={(inPlayer) => { doSubstitute(inPlayer, substituteCourtIdx, substituteOutPlayer); setShowSubstitute(false); }}
        onCancel={() => { setShowSubstitute(false); setSubstituteOutPlayer(''); }} />

      <MatchHistoryModal visible={showMatchHistory} matchHistory={matchHistory} courtLabel={courtLabel} onClose={() => setShowMatchHistory(false)} />
      <ClubQRModal visible={showQR} title="SHARE CLUB" deepLink={`https://app.jastly.com/join?clubId=${club?.id}`} onClose={() => setShowQR(false)} />
      <SystemLogsModal visible={showLogs} logs={logs} onClose={() => setShowLogs(false)} />
      <ClubQRModal visible={showJoinQR} title="INVITE PLAYERS" deepLink={`https://app.jastly.com/join?clubId=${club?.id}`} onClose={() => setShowJoinQR(false)} />
      <LeaderboardModal visible={showLeaderboard} leaderboard={leaderboard} onClose={() => setShowLeaderboard(false)} />
      <SessionSummaryModal visible={showSessionSummary} matchHistory={matchHistory} roster={roster}
        sportEmoji={sportEmoji} clubName={club?.club_name || ''} onClose={() => setShowSessionSummary(false)}
        onShare={() => { setShowSessionSummary(false); shareSessionStats(); }} />
      <BatchAddModal visible={showBatchAdd} onCancel={() => setShowBatchAdd(false)}
        onAdd={async (names) => {
          setShowBatchAdd(false);
          const players = names.map(name => ({ name, gender: 'M' }));
          if (isHost) await processRequest({ action: 'batch_join', payload: { players }, _fromHost: true });
          else sendReq('batch_join', { players });
        }} />

      <GuidedSetupWizard
        visible={showSetupGuide}
        initialSport={tempSettings.sport}
        initialCourts={tempSettings.courts}
        initialGenderBalanced={tempSettings.genderBalanced}
        initialAvoidRepeats={tempSettings.avoidRepeats}
        queueLength={club?.waiting_list?.length || 0}
        onManagePlayers={() => { setShowSetupGuide(false); setShowPlayers(true); }}
        onBatchAdd={() => { setShowSetupGuide(false); setShowBatchAdd(true); }}
        onInviteQR={() => { setShowSetupGuide(false); setShowJoinQR(true); }}
        onClose={() => setShowSetupGuide(false)}
        onFinish={async ({ sport, courts, genderBalanced, avoidRepeats }) => {
          setShowSetupGuide(false);
          setTempSettings(prev => ({ ...prev, sport, courts, genderBalanced, avoidRepeats }));
          setClub((prev: any) => ({ ...prev, sport, active_courts: courts, gender_balanced: genderBalanced, avoid_repeats: avoidRepeats }));
          await supabase.from('clubs').update({ sport, active_courts: courts, gender_balanced: genderBalanced, avoid_repeats: avoidRepeats }).eq('id', cidRef.current);
        }}
      />

      {/* ── TOURNAMENT MODALS ── */}
      <TournamentSetupModal
        visible={showTournamentSetup}
        waitingList={club?.waiting_list || []}
        defaultTeamSize={Math.max(2, Math.floor(playersPerGame / 2))}
        onClose={() => setShowTournamentSetup(false)}
        onStart={(tournament) => {
          setShowTournamentSetup(false);
          processRequest({ action: 'tournament_start', payload: { tournament }, _fromHost: true });
        }}
      />

      <TournamentResultModal
        visible={showTournamentResult}
        match={activeTournamentMatch}
        teams={club?.tournament?.teams || []}
        format={club?.tournament?.format ?? 'round_robin'}
        waitingList={club?.waiting_list || []}
        onConfirmStandard={(winnerId, scoreA, scoreB) => {
          if (!activeTournamentMatch) return;
          processRequest({ action: 'tournament_match_result', payload: { matchId: activeTournamentMatch.id, winnerId, scoreA, scoreB }, _fromHost: true });
          setShowTournamentResult(false);
          setActiveTournamentMatch(null);
        }}
        onConfirmSuperGame1={(scores) => {
          if (!activeTournamentMatch) return;
          processRequest({ action: 'tournament_super_game1', payload: { matchId: activeTournamentMatch.id, game1Scores: scores }, _fromHost: true });
          setShowTournamentResult(false);
          setActiveTournamentMatch(null);
        }}
        onConfirmSuperGame2={(scores) => {
          if (!activeTournamentMatch) return;
          processRequest({ action: 'tournament_match_result', payload: { matchId: activeTournamentMatch.id, game2Scores: scores }, _fromHost: true });
          setShowTournamentResult(false);
          setActiveTournamentMatch(null);
        }}
        onCancel={() => { setShowTournamentResult(false); setActiveTournamentMatch(null); }}
      />

      {club?.tournament && (
        <TournamentStandingsModal
          visible={showTournamentStandings}
          tournament={club.tournament}
          onClose={() => setShowTournamentStandings(false)}
        />
      )}

      {club?.tournament && (
        <TeamDetailModal
          visible={!!selectedTeamDetail}
          team={selectedTeamDetail}
          tournament={club.tournament}
          onClose={() => setSelectedTeamDetail(null)}
        />
      )}

      <SetupPinModal visible={showSetupPin} setupPin1={setupPin1} setupPin2={setupPin2} pinError={pinError}
        onChangePin1={(v) => { setSetupPin1(v); setPinError(false); }}
        onChangePin2={(v) => { setSetupPin2(v); setPinError(false); }}
        onSave={saveSetupPin}
        onCancel={() => { setShowSetupPin(false); setTempSettings(prev => ({ ...prev, pinEnabled: false })); }} />

      <EnterPinModal visible={showEnterPin} enterPinInput={enterPinInput} onChangePinInput={setEnterPinInput}
        onVerify={verifyPin} onCancel={() => { setShowEnterPin(false); setEnterPinInput(''); setPendingPinAction(null); }} />

      <SportSetupModal visible={showSportSetup} tempSport={tempSettings.sport} onSelectSport={(s) => setTempSettings(prev => ({ ...prev, sport: s }))}
        onConfirm={async () => {
          await supabase.from('clubs').update({ sport: tempSettings.sport }).eq('id', cidRef.current);
          setClub((prev: any) => ({ ...prev, sport: tempSettings.sport }));
          setShowSportSetup(false); setShowStartup(true);
        }} />

      <SessionStartupModal visible={showStartup} tempSport={tempSettings.sport} startupCourts={startupCourts}
        savedQueueLength={club?.saved_queue?.length || 0}
        onSelectSport={(s) => setTempSettings(prev => ({ ...prev, sport: s }))}
        onChangeStartupCourts={setStartupCourts}
        onRestore={async () => {
          const sq = club.saved_queue || [];
          setClub((prev: any) => ({ ...prev, sport: tempSettings.sport, active_courts: startupCourts, waiting_list: sq, court_occupants: {} }));
          await supabase.from('clubs').update({ sport: tempSettings.sport, active_courts: startupCourts, waiting_list: sq, court_occupants: {} }).eq('id', cidRef.current);
          addLog('SYSTEM: Restored previous queue.'); setShowStartup(false);
        }}
        onReset={async () => {
          setClub((prev: any) => ({ ...prev, sport: tempSettings.sport, active_courts: startupCourts, waiting_list: [], court_occupants: {} }));
          await supabase.from('clubs').update({ sport: tempSettings.sport, active_courts: startupCourts, waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
          addLog('SYSTEM: Reset Session.'); setShowStartup(false);
        }}
        onContinue={async () => {
          setClub((prev: any) => ({ ...prev, sport: tempSettings.sport, active_courts: startupCourts }));
          await supabase.from('clubs').update({ sport: tempSettings.sport, active_courts: startupCourts }).eq('id', cidRef.current);
          setShowStartup(false);
        }} />

    </View>
  );
}
