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
import * as FileSystem from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Modal, Platform, ScrollView,
  Share, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ColorSet } from '../../contexts/theme-context';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../supabase';
import { Club, CourtResult, Player, QueuePlayer } from '../../types';
import { getSportConfig, SPORTS } from '../../constants/sports';

// Configure local notifications
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

  // ─── Core identity ────────────────────────────────────────────────────────
  const [isHost, setIsHost] = useState(false);
  const [hostNickname, setHostNickname] = useState('');
  const [club, setClub] = useState<Club | null>(null);
  const [myName, setMyName] = useState('');
  const cidRef = useRef('');
  const clubRef = useRef<Club | null>(null);

  // ─── Courts & Queue ────────────────────────────────────────────────────────
  const [showCourts, setShowCourts] = useState(false);
  const [showResult, setShowResult] = useState<CourtResult | null>(null);
  const [selectedQueueIdx, setSelectedQueueIdx] = useState<number[]>([]);
  const [winners, setWinners] = useState<string[]>([]);

  // ─── Async loading guards ──────────────────────────────────────────────────
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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

  // ─── Settings (live values) ────────────────────────────────────────────────
  const [ttsVoice, setTtsVoice] = useState('en-US');
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(30);
  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [countdownLimit, setCountdownLimit] = useState(60);
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [genderBalanced, setGenderBalanced] = useState(false);
  const [avoidRepeats, setAvoidRepeats] = useState(false);

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

  // ─── Logging ───────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<string[]>([]);
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
  const [showStartup, setShowStartup] = useState(false);
  const [startupCourts, setStartupCourts] = useState(4);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [substituteCourtIdx, setSubstituteCourtIdx] = useState('');
  const [substituteOutPlayer, setSubstituteOutPlayer] = useState('');
  const [isMyTurnBanner, setIsMyTurnBanner] = useState(false);
  const [showPowerGuestPrompt, setShowPowerGuestPrompt] = useState(false);
  const [powerGuestPinInput, setPowerGuestPinInput] = useState('');
  const [tempPowerGuestEnabled, setTempPowerGuestEnabled] = useState(false);
  // Measured via onLayout so it updates correctly on Fold phones switching screens
  const [courtGridWidth, setCourtGridWidth] = useState(0);

  // ─── New feature state ────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tempSoundEnabled, setTempSoundEnabled] = useState(true);
  const [showPlayerProfile, setShowPlayerProfile] = useState<Player | null>(null);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const loggingEnabledRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const ttsVoiceRef = useRef('en-US');
  const repeatEnabledRef = useRef(false);
  const repeatIntervalRef = useRef(30);
  const countdownEnabledRef = useRef(false);
  const countdownLimitRef = useRef(60);
  const secondsCounter = useRef(0);
  const currentTopPlayerRef = useRef('');
  const myNameRef = useRef('');
  const isHostRef = useRef(false);
  const isPowerGuestRef = useRef(false);
  const hasShownStartupRef = useRef(false);
  // Heartbeat tracking: maps player name → timestamp of last heartbeat received
  const guestHeartbeatsRef = useRef<Record<string, number>>({});
  const lastInactiveCheckRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { clubRef.current = club; }, [club]);
  useEffect(() => { loggingEnabledRef.current = loggingEnabled; }, [loggingEnabled]);
  useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);
  useEffect(() => { repeatEnabledRef.current = repeatEnabled; }, [repeatEnabled]);
  useEffect(() => { repeatIntervalRef.current = repeatInterval; }, [repeatInterval]);
  useEffect(() => { countdownEnabledRef.current = countdownEnabled; }, [countdownEnabled]);
  useEffect(() => { countdownLimitRef.current = countdownLimit; }, [countdownLimit]);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  // Sport config — derived from club state, defaults to badminton
  const { emoji: sportEmoji, court: courtLabel, playersPerGame } = useMemo(
    () => getSportConfig(club?.sport), [club?.sport]
  );

  // Auto-open court selection popup when correct number of players are tapped
  useEffect(() => { if (selectedQueueIdx.length === playersPerGame) setShowCourts(true); }, [selectedQueueIdx, playersPerGame]);

  // Two-column layout on wide web screens
  const isWideWeb = Platform.OS === 'web' && screenWidth > 900;

  // Derive power guest status from the waiting_list entry (set by host, can't be spoofed)
  const isPowerGuest = !isHost && !!club?.waiting_list?.find(
    (w: any) => w.name === (myNameRef.current || myName) && w.isPowerGuest
  );
  useEffect(() => { isPowerGuestRef.current = isPowerGuest; }, [isPowerGuest]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const addLog = (msg: string) => {
    if (!loggingEnabledRef.current) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 100));
  };

  const sanitiseName = (n: string) =>
    (n || '').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);

  // ─── Notifications ────────────────────────────────────────────────────────
  const requestNotificationPermission = async () => {
    if (Platform.OS === 'web') return;
    try {
      // Android requires a channel to be registered before any notification appears
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Badminton Hub',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: colors.primary,
        });
      }
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch { return false; }
  };

  const sendLocalNotification = async (title: string, body: string) => {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  };

  // ─── Chime (plays when it's the guest's turn) ─────────────────────────────
  const playChime = async () => {
    if (Platform.OS === 'web' || !soundEnabledRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/chime.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch { /* file not added yet — silently skip */ }
  };

  // ─── Share session stats ───────────────────────────────────────────────────
  const shareSessionStats = async () => {
    if (!club) return;
    const matchCount = (club.match_history || []).length;
    const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const top = [...(club.master_roster || [])]
      .filter((p: Player) => p.games > 0)
      .sort((a, b) => (b.wins / Math.max(1, b.games)) - (a.wins / Math.max(1, a.games)))
      .slice(0, 5);

    const sc = getSportConfig(club.sport);
    let text = `${sc.emoji} ${club.club_name || `${sc.label} Session`} — ${dateStr}\n\n`;
    text += `Matches played: ${matchCount}\n`;
    text += `Players in queue: ${(club.waiting_list || []).filter((p: any) => !p.isResting).length}\n`;
    if (top.length > 0) {
      text += `\n🏆 TOP PLAYERS\n`;
      top.forEach((p, i) => {
        const rate = Math.round((p.wins / p.games) * 100);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        text += `${medal} ${p.name}  ${p.wins}W / ${p.games}G  (${rate}%)\n`;
      });
    }
    text += `\nManaged with Queue Master ${sc.emoji}`;
    try { await Share.share({ message: text }); } catch {}
  };

  // ─── Initialisation ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
      const hStatus = (await AsyncStorage.getItem('isHost')) === 'true';
      const cid = (await AsyncStorage.getItem('currentClubId')) || '';
      const pName = (await AsyncStorage.getItem('guestName')) || '';
      setMyName(pName);
      myNameRef.current = pName;
      cidRef.current = cid;

      const savedVoice = await AsyncStorage.getItem('tts_voice');
      const savedRepeat = await AsyncStorage.getItem('repeat_enabled');
      const savedRepeatInt = await AsyncStorage.getItem('repeat_interval');
      const savedCountdown = await AsyncStorage.getItem('countdown_enabled');
      const savedCountdownLim = await AsyncStorage.getItem('countdown_limit');
      const savedLogging = await AsyncStorage.getItem('logging_enabled');
      const savedPin = await AsyncStorage.getItem('pin_enabled');

      if (savedVoice) setTtsVoice(savedVoice);
      if (savedRepeat) setRepeatEnabled(savedRepeat === 'true');
      if (savedRepeatInt) setRepeatInterval(parseInt(savedRepeatInt));
      if (savedCountdown) setCountdownEnabled(savedCountdown === 'true');
      if (savedCountdownLim) setCountdownLimit(parseInt(savedCountdownLim));
      if (savedLogging) setLoggingEnabled(savedLogging === 'true');
      if (savedPin) setPinEnabled(savedPin === 'true');
      const savedSound = await AsyncStorage.getItem('sound_enabled');
      if (savedSound !== null) { setSoundEnabled(savedSound === 'true'); soundEnabledRef.current = savedSound === 'true'; }

      if (!cid) return router.replace('/');

      // Load cached state immediately for instant UI while fetching
      const cachedRaw = await AsyncStorage.getItem('cached_club');
      if (cachedRaw) {
        try { setClub(JSON.parse(cachedRaw) as Club); } catch {}
      }

      const { data } = await supabase.from('clubs').select('*').eq('id', cid).single();
      if (data) {
        setClub(data as Club);
        if (data.gender_balanced) setGenderBalanced(true);
        if (data.avoid_repeats) setAvoidRepeats(true);
      } else {
        await AsyncStorage.removeItem('currentClubId').catch(() => {});
        return router.replace('/');
      }

      // Robust host detection
      const { data: sessionData } = await supabase.auth.getSession();
      const myUid = sessionData?.session?.user?.id || '';
      const isActuallyHost = hStatus || (!!myUid && data.host_uid === myUid);
      const nickname = sessionData?.session?.user?.user_metadata?.nickname;
      if (nickname) setHostNickname(nickname);
      if (isActuallyHost !== hStatus) {
        await AsyncStorage.setItem('isHost', isActuallyHost ? 'true' : 'false');
      }
      setIsHost(isActuallyHost);
      isHostRef.current = isActuallyHost;

      supabase
        .channel('club-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clubs', filter: `id=eq.${cid}` },
          (p) => {
            setClub(p.new as Club);
            if (!isHostRef.current && myNameRef.current) {
              const queue: any[] = p.new.waiting_list || [];
              const firstActive = queue.find((w: any) => !w.isResting);
              if (firstActive?.name === myNameRef.current) {
                setIsMyTurnBanner(true);
                const sc = getSportConfig((p.new as any).sport);
                sendLocalNotification(`${sc.emoji} Your Turn!`, `It's your turn to pick a ${sc.court.toLowerCase()}.`);
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                playChime();
              } else {
                setIsMyTurnBanner(false);
              }
            }
          })
        .subscribe((status) => {
          const connected = status === 'SUBSCRIBED';
          setIsOnline(connected);
          if (connected) {
            // Re-fetch to catch any updates missed while disconnected
            supabase.from('clubs').select('*').eq('id', cid).single()
              .then(({ data }) => { if (data) setClub(data as Club); });
          }
        });

      if (isActuallyHost) {
        // Give all current queue members a grace period on startup
        const seedNow = Date.now();
        (data.waiting_list || []).forEach((w: any) => {
          guestHeartbeatsRef.current[w.name] = seedNow;
        });

        supabase
          .channel('req-sync')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: `club_id=eq.${cid}` },
            // Strip elevation flags — never trust values stored by a client in the DB
            (p) => processRequest({ ...p.new, _fromHost: false, _isPowerGuest: false }))
          .subscribe();
      }

      // Request notification permission for guests
      if (!isActuallyHost) {
        requestNotificationPermission();
      }
      } catch (e) {
        console.error('Init failed:', e);
        await AsyncStorage.multiRemove(['currentClubId', 'isHost', 'guestName']);
        router.replace('/');
      }
    };
    init();
    return () => { supabase.removeAllChannels(); };
  }, []);

  // Guest heartbeat — lets host detect when a guest has left/closed the app
  useEffect(() => {
    if (isHost || !myName) return;
    sendReq('heartbeat'); // immediate ping on mount
    const interval = setInterval(() => {
      if (myNameRef.current) sendReq('heartbeat');
    }, 45_000);
    return () => clearInterval(interval);
  }, [isHost, myName]);

  // Startup modal — once per mount
  useEffect(() => {
    if (!isHost || !club || hasShownStartupRef.current) return;
    hasShownStartupRef.current = true;
    setStartupCourts(club.active_courts || 4);
    setShowStartup(true);
  }, [isHost, club]);

  // ─── Cache club state for offline support ────────────────────────────────
  useEffect(() => {
    if (club) {
      AsyncStorage.setItem('cached_club', JSON.stringify(club)).catch(() => {});
    }
  }, [club]);

  // ─── Re-sync when app returns to foreground ───────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && cidRef.current) {
        const { data } = await supabase.from('clubs').select('*').eq('id', cidRef.current).single();
        if (data) setClub(data as Club);
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Host Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;
    const timer = setInterval(() => {
      const c = clubRef.current;

      // ── Inactivity check (every 60 s) ──────────────────────────────────
      const now = Date.now();
      if (c && now - lastInactiveCheckRef.current > 60_000) {
        lastInactiveCheckRef.current = now;
        const stale = (c.waiting_list || []).filter((w: any) => {
          const hb = guestHeartbeatsRef.current[w.name];
          if (!hb) return false; // no heartbeat = host-added player, never auto-remove
          const onCourt = Object.values(c.court_occupants || {}).flat().some((p: any) => p.name === w.name);
          return !onCourt && (now - hb) > 120_000; // 2 min stale threshold
        });
        if (stale.length > 0) {
          const staleNames = new Set(stale.map((w: any) => w.name));
          stale.forEach((w: any) => {
            delete guestHeartbeatsRef.current[w.name];
            addLog(`AUTO: ${w.name} removed — no response for 2 min.`);
          });
          const newList = (c.waiting_list || []).filter((w: any) => !staleNames.has(w.name));
          setClub((prev: any) => ({ ...prev, waiting_list: newList }));
          supabase.from('clubs').update({ waiting_list: newList }).eq('id', cidRef.current).then();
          secondsCounter.current = 0; currentTopPlayerRef.current = '';
        }
      }

      if (!c?.waiting_list?.length) { secondsCounter.current = 0; currentTopPlayerRef.current = ''; return; }
      const firstActive = c.waiting_list.find((w: any) => !w.isResting);
      if (!firstActive) { secondsCounter.current = 0; currentTopPlayerRef.current = ''; return; }
      const topPlayer: string = firstActive.name;
      if (topPlayer !== currentTopPlayerRef.current) {
        currentTopPlayerRef.current = topPlayer;
        secondsCounter.current = 0;
      } else {
        secondsCounter.current++;
      }
      const secs = secondsCounter.current;
      const activeCount = c.waiting_list.filter((w: any) => !w.isResting).length;
      if (activeCount < 4) { secondsCounter.current = 0; return; }
      if (countdownEnabledRef.current && secs >= countdownLimitRef.current && c.waiting_list.length > 1) {
        const newQueue = [...c.waiting_list];
        const lateIdx = newQueue.findIndex((w: any) => !w.isResting);
        const [latePlayer] = newQueue.splice(lateIdx, 1);
        newQueue.splice(Math.min(lateIdx + 1, newQueue.length), 0, latePlayer);
        const newFirst = newQueue.find((w: any) => !w.isResting);
        currentTopPlayerRef.current = newFirst?.name || '';
        secondsCounter.current = 0;
        setClub((prev: any) => ({ ...prev, waiting_list: newQueue }));
        supabase.from('clubs').update({ waiting_list: newQueue }).eq('id', cidRef.current).then();
        addLog(`TIMER: ${topPlayer} timed out. Moved down.`);
        const nextName = newFirst?.name || 'the next player';
        Speech.speak(`${topPlayer} took too long. ${nextName}, it is now your turn to pick.`, { language: ttsVoiceRef.current });
      } else if (repeatEnabledRef.current && secs > 0 && secs % repeatIntervalRef.current === 0) {
        Speech.speak(`Still waiting for ${topPlayer} to pick a court.`, { language: ttsVoiceRef.current });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isHost]);

  // ─── Host Core Logic ──────────────────────────────────────────────────────
  // Pure state mutation — no Supabase writes, no side effects
  const applyRequest = (
    prev: Club,
    req: any,
  ): { next: Club; logs: string[]; speech?: string; resetTimers?: boolean; noWrite?: boolean } | null => {
    const next: Club = {
      ...prev,
      waiting_list: [...(prev.waiting_list || [])],
      master_roster: [...(prev.master_roster || [])],
      court_occupants: { ...(prev.court_occupants || {}) },
      match_history: [...(prev.match_history || [])],
    };
    const { action, payload } = req;
    const logs: string[] = [];
    const requesterName = sanitiseName(payload?.name || '');
    const requesterIsPowerGuest = next.waiting_list.some(
      (w: any) => w.name === requesterName && w.isPowerGuest
    );
    const elevated = req._fromHost || requesterIsPowerGuest;

    if (action === 'grant_power_guest') {
      if (!req._fromHost) return null;
      const { targetName, grant } = payload;
      const tName = sanitiseName(targetName);
      const idx = next.waiting_list.findIndex((w: any) => w.name === tName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], isPowerGuest: !!grant };
        logs.push(`POWER: ${tName} ${grant ? 'granted' : 'revoked'} power guest.`);
      }
    } else if (action === 'claim_power_guest') {
      const { pgPinHash } = payload;
      if (!next.power_guest_pin || !pgPinHash) return null;
      // Extract hash portion from "salt:hash" or treat whole string as legacy hash
      const stored = next.power_guest_pin;
      const colonIdx = stored.indexOf(':');
      const storedHash = colonIdx !== -1 ? stored.slice(colonIdx + 1) : stored;
      if (!safeEqual(pgPinHash, storedHash)) {
        return { next: prev, logs: [`SECURITY: ${requesterName} used wrong power guest PIN.`], noWrite: true };
      }
      const idx = next.waiting_list.findIndex((w: any) => w.name === requesterName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], isPowerGuest: true };
        logs.push(`POWER: ${requesterName} claimed power guest status.`);
      }
    } else if (action === 'batch_join') {
      let addedCount = 0;
      const playersToAdd: any[] = Array.isArray(payload.players) ? payload.players : [];
      playersToAdd.forEach((p: any) => {
        const pName = sanitiseName(p.name);
        if (!pName) return;
        if (!elevated && pName !== requesterName) {
          logs.push(`SECURITY: ${requesterName} tried to add ${pName} — blocked.`);
          return;
        }
        const inRoster = next.master_roster.some((m: any) => m.name === pName);
        if (!inRoster) {
          next.master_roster.push({ name: pName, gender: p.gender || 'M', games: 0, wins: 0 });
        }
        if (!next.waiting_list.find((x: any) => x.name === pName)) {
          next.waiting_list.push({ name: pName, gender: p.gender || 'M', isResting: false });
          addedCount++;
        }
      });
      if (addedCount > 0) {
        logs.push(`QUEUE: ${addedCount} player(s) added.`);
        return { next, logs, speech: `${addedCount} player${addedCount > 1 ? 's' : ''} added to the queue.` };
      }
    } else if (action === 'toggle_pause') {
      const targetName = sanitiseName(payload.name);
      if (!elevated && targetName !== requesterName) {
        logs.push(`SECURITY: ${requesterName} tried to pause ${targetName} — blocked.`);
        return null;
      }
      const idx = next.waiting_list.findIndex((x: any) => x.name === targetName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], isResting: !next.waiting_list[idx].isResting };
        logs.push(`STATUS: ${targetName} is now ${next.waiting_list[idx].isResting ? 'Resting' : 'Active'}.`);
      }
      return { next, logs, resetTimers: true };
    } else if (action === 'leave') {
      const targetName = sanitiseName(payload.name);
      if (!elevated && targetName !== requesterName) {
        logs.push(`SECURITY: ${requesterName} tried to remove ${targetName} — blocked.`);
        return null;
      }
      next.waiting_list = next.waiting_list.filter((x: any) => x.name !== targetName);
      logs.push(`QUEUE: ${targetName} left.`);
      return { next, logs, resetTimers: true };
    } else if (action === 'substitute') {
      if (!elevated) return null; // only host / power guest may substitute
      const { courtIdx, outPlayer, inPlayer } = payload;
      const cIdx = courtIdx.toString();
      if (!next.court_occupants[cIdx]) return null;
      const courtPlayers = [...next.court_occupants[cIdx]];
      const outIdx = courtPlayers.findIndex((p: any) => p.name === outPlayer);
      const inPlayerObj = next.waiting_list.find((p: any) => p.name === inPlayer);
      if (outIdx === -1 || !inPlayerObj) return null;
      const outPlayerObj = courtPlayers[outIdx];
      courtPlayers[outIdx] = { ...inPlayerObj, isResting: false };
      next.court_occupants[cIdx] = courtPlayers;
      next.waiting_list = next.waiting_list.filter((p: any) => p.name !== inPlayer);
      next.waiting_list.push({ ...outPlayerObj, isResting: false });
      const subCourt = getSportConfig(next.sport).court;
      logs.push(`SUB: ${outPlayer} ↔ ${inPlayer} on ${subCourt} ${parseInt(cIdx) + 1}.`);
      return { next, logs, speech: `${inPlayer} is substituting ${outPlayer} on ${subCourt.toLowerCase()} ${parseInt(cIdx) + 1}.` };
    } else if (action === 'start_match') {
      const { courtIdx, players } = payload;
      const cIdx = parseInt(courtIdx);
      if (isNaN(cIdx) || cIdx < 0 || cIdx >= (next.active_courts || 10)) return null;
      if (next.court_occupants[cIdx.toString()]) return null;
      const sportPlayers = getSportConfig(next.sport).playersPerGame;
      if (!Array.isArray(players) || players.length !== sportPlayers) return null;
      const pNames: string[] = players.map((p: any) => sanitiseName(p.name));
      if (new Set(pNames).size !== sportPlayers || pNames.some(n => !n)) return null;
      if (!elevated) {
        if (!pNames.includes(requesterName)) return null;
        const firstActive = next.waiting_list.find((w: any) => !w.isResting);
        if (!firstActive || firstActive.name !== requesterName) return null;
        const limit = next.pick_limit || 20;
        for (const pName of pNames) {
          const qIdx = next.waiting_list.findIndex((w: any) => w.name === pName && !w.isResting);
          if (qIdx === -1 || qIdx >= limit) return null;
        }
      }
      const validPlayers = pNames.map(pName =>
        next.waiting_list.find((w: any) => w.name === pName) || players.find((p: any) => sanitiseName(p.name) === pName)
      );
      next.court_occupants[cIdx.toString()] = validPlayers;
      next.waiting_list = next.waiting_list.filter((w: any) => !pNames.includes(w.name));
      validPlayers.forEach((p: any) => {
        const mIdx = next.master_roster.findIndex((m: any) => m.name === p.name);
        if (mIdx !== -1) next.master_roster[mIdx] = { ...next.master_roster[mIdx], games: (next.master_roster[mIdx].games || 0) + 1 };
      });
      const sportCfg = getSportConfig(next.sport);
      logs.push(`MATCH: ${sportCfg.court} ${cIdx + 1} started.`);
      const half = Math.floor(pNames.length / 2);
      const t1Names = pNames.slice(0, half);
      const t2Names = pNames.slice(half);
      const teamStr = (names: string[]) =>
        names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      let msg = `${sportCfg.court} ${cIdx + 1} ready. ${teamStr(t1Names)} versus ${teamStr(t2Names)}.`;
      const nextActive = next.waiting_list.find((w: any) => !w.isResting);
      if (nextActive) msg += ` Next up is ${nextActive.name}.`;
      return { next, logs, speech: msg, resetTimers: true };
    } else if (action === 'finish_match') {
      const { courtIdx, matchWinners } = payload;
      const cIdx = courtIdx.toString();
      const courtPlayers: any[] = next.court_occupants[cIdx] || [];
      if (!courtPlayers.length) return null;
      if (!elevated && !courtPlayers.some((p: any) => p.name === requesterName)) return null;
      const courtPlayerNames = courtPlayers.map((p: any) => p.name);
      const validWinners: string[] = Array.isArray(matchWinners)
        ? matchWinners.filter((w: string) => courtPlayerNames.includes(w)).slice(0, 2) : [];
      validWinners.forEach((wName: string) => {
        const mIdx = next.master_roster.findIndex((m: any) => m.name === wName);
        if (mIdx !== -1) next.master_roster[mIdx] = { ...next.master_roster[mIdx], wins: (next.master_roster[mIdx].wins || 0) + 1 };
      });
      const finishHalf = Math.floor(courtPlayers.length / 2);
      const team1 = courtPlayers.slice(0, finishHalf).map((p: any) => p.name);
      const team2 = courtPlayers.slice(finishHalf).map((p: any) => p.name);
      next.match_history = [
        { date: new Date().toISOString(), court: parseInt(cIdx) + 1, team1, team2, winners: validWinners } as any,
        ...next.match_history,
      ].slice(0, 100);
      next.waiting_list = [...next.waiting_list, ...courtPlayers];
      delete next.court_occupants[cIdx];
      next.saved_queue = [...next.waiting_list];
      logs.push(`MATCH: ${getSportConfig(next.sport).court} ${parseInt(cIdx) + 1} finished. Winners: ${validWinners.join(', ') || 'none'}`);
      return { next, logs, resetTimers: true };
    }

    return { next, logs };
  };

  const processRequest = async (req: any) => {
    const prevClub = clubRef.current;
    if (!prevClub) return;

    // Heartbeat: update in-memory tracking only — no state update, no Supabase write
    if (req.action === 'heartbeat') {
      const name = sanitiseName(req.payload?.name || '');
      if (name) guestHeartbeatsRef.current[name] = Date.now();
      if (req.id) await supabase.from('requests').delete().eq('id', req.id);
      return;
    }

    const result = applyRequest(prevClub, req);
    if (!result) return;

    // Seed heartbeat for self-joining guests so they're tracked for inactivity
    if (req.action === 'batch_join' && !req._fromHost) {
      const name = sanitiseName(req.payload?.name || '');
      if (name) guestHeartbeatsRef.current[name] = Date.now();
    }
    // Re-seed heartbeats for players returning from court (they were paused during match)
    if (req.action === 'finish_match') {
      const returning: any[] = req.payload?.returningPlayers || [];
      const now = Date.now();
      returning.forEach((p: any) => {
        const name = sanitiseName(p.name || '');
        if (name) guestHeartbeatsRef.current[name] = now;
      });
    }

    const { next, logs, speech, resetTimers, noWrite } = result;
    setClub(next);
    logs.forEach(addLog);
    if (speech) Speech.speak(speech, { language: ttsVoiceRef.current });
    if (resetTimers) { secondsCounter.current = 0; currentTopPlayerRef.current = ''; }

    if (noWrite) {
      if (req.id) await supabase.from('requests').delete().eq('id', req.id);
      return;
    }

    const { error } = await supabase.from('clubs').update({
      waiting_list: next.waiting_list,
      master_roster: next.master_roster,
      court_occupants: next.court_occupants,
      match_history: next.match_history,
      saved_queue: next.saved_queue,
      ...(next.power_guest_pin !== undefined ? { power_guest_pin: next.power_guest_pin } : {}),
    }).eq('id', cidRef.current);

    if (error) {
      setClub(prevClub); // rollback optimistic update
      if (req._fromHost) Alert.alert('Sync failed', 'Change could not be saved. Please try again.');
    } else if (req.id) {
      await supabase.from('requests').delete().eq('id', req.id);
    }
  };

  const sendReq = (action: string, payload: any = {}) => {
    const name = myNameRef.current || myName;
    supabase.from('requests').insert({ club_id: cidRef.current, action, payload: { ...payload, name } })
      .then(({ error }) => {
        if (error) Alert.alert('Request failed', 'Could not send action. Please try again.');
      });
  };

  // ─── Player Manager Logic ─────────────────────────────────────────────────
  const isAvailable = (pName: string) => {
    if (!club) return false;
    const inQueue = club.waiting_list?.some((w: any) => w.name === pName);
    const onCourt = Object.values(club.court_occupants || {}).flat().some((c: any) => c.name === pName);
    return !inQueue && !onCourt;
  };

  const roster = club?.master_roster || [];

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
        playersToAdd.forEach(p => sendReq('batch_join', { players: [p], name: myNameRef.current || myName }));
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
    const currentRoster = club?.master_roster || [];
    const currentQueue = club?.waiting_list || [];
    let nextRoster = [...currentRoster];
    let nextQueue = [...currentQueue];
    if (editingPlayerName) {
      if (clean !== editingPlayerName && nextRoster.some((p: Player) => (p.name || '').toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Name already exists!'); return;
      }
      const rIdx = nextRoster.findIndex((p: Player) => p.name === editingPlayerName);
      if (rIdx !== -1) nextRoster[rIdx] = { ...nextRoster[rIdx], name: clean, gender: newGender as 'M' | 'F' };
      const qIdx = nextQueue.findIndex((p: QueuePlayer) => p.name === editingPlayerName);
      if (qIdx !== -1) nextQueue[qIdx] = { ...nextQueue[qIdx], name: clean, gender: newGender as 'M' | 'F' };
    } else {
      if (nextRoster.some((p: Player) => (p.name || '').toUpperCase() === clean)) {
        Alert.alert('Duplicate', 'Player already exists!'); return;
      }
      nextRoster.push({ name: clean, gender: newGender as 'M' | 'F', games: 0, wins: 0 });
      addLog(`SYSTEM: Registered ${clean}.`);
    }
    setIsSavingPlayer(true);
    try {
      setClub((prev: Club | null) => prev ? { ...prev, master_roster: nextRoster, waiting_list: nextQueue } : prev);
      const { data, error } = await supabase.from('clubs').update({ master_roster: nextRoster, waiting_list: nextQueue }).eq('id', cidRef.current).select().single();
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
        const nextRoster = roster.filter((p: any) => p.name !== name);
        const nextQueue = club!.waiting_list?.filter((p: QueuePlayer) => p.name !== name) || [];
        setClub((prev: any) => ({ ...prev, master_roster: nextRoster, waiting_list: nextQueue }));
        await supabase.from('clubs').update({ master_roster: nextRoster, waiting_list: nextQueue }).eq('id', cidRef.current);
        addLog(`SYSTEM: Deleted ${name}.`);
      }},
    ]);
  };

  // ─── Auto-pick with gender balance + avoid repeats ────────────────────────
  const handleAutoPick = () => {
    if (!club) return;
    const limit = club.pick_limit || 20;
    const eligible = (club.waiting_list || [])
      .map((p: any, i: number) => ({ ...p, queueIdx: i }))
      .filter((p: any, i: number) => !p.isResting && i < limit);

    if (eligible.length < playersPerGame) { Alert.alert('Notice', `Not enough active players in range (need ${playersPerGame}).`); return; }

    let selected: any[] = [];
    const half = Math.floor(playersPerGame / 2);

    if (genderBalanced && half >= 1) {
      const males = eligible.filter((p: any) => p.gender !== 'F');
      const females = eligible.filter((p: any) => p.gender === 'F');
      if (males.length >= half && females.length >= half) {
        selected = [...males.slice(0, half), ...females.slice(0, half)];
      } else {
        selected = eligible.slice(0, playersPerGame);
      }
    } else {
      selected = eligible.slice(0, playersPerGame);
    }

    // Avoid repeat opponents: if any 2 selected players played together last game, swap last pick
    if (avoidRepeats && club.match_history?.length > 0) {
      const lastMatch = club.match_history[0];
      const lastPairs = [
        [lastMatch.team1[0], lastMatch.team1[1]],
        [lastMatch.team2[0], lastMatch.team2[1]],
        [lastMatch.team1[0], lastMatch.team2[0]],
        [lastMatch.team1[0], lastMatch.team2[1]],
        [lastMatch.team1[1], lastMatch.team2[0]],
        [lastMatch.team1[1], lastMatch.team2[1]],
      ];
      const selectedNames = selected.map((p: any) => p.name);
      const hasRepeat = lastPairs.some(([a, b]) => selectedNames.includes(a) && selectedNames.includes(b));
      if (hasRepeat) {
        // Try to swap the 4th pick for someone who didn't play last game
        const lastMatchNames = [...lastMatch.team1, ...lastMatch.team2];
        const alternates = eligible.filter((p: any) => !lastMatchNames.includes(p.name) && !selected.slice(0, 3).map((s: any) => s.name).includes(p.name));
        if (alternates.length > 0) {
          selected = [...selected.slice(0, 3), alternates[0]];
        }
      }
    }

    setSelectedQueueIdx(selected.map((p: any) => p.queueIdx));
    setShowCourts(true);
  };

  const assignCourt = async (cIdx: number) => {
    if (!club || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const players = selectedQueueIdx.map((i) => club.waiting_list[i]).filter(Boolean);
      if (players.length !== selectedQueueIdx.length) {
        Alert.alert('Queue Changed', 'The queue has changed since you selected. Please select again.');
        setSelectedQueueIdx([]);
        setShowCourts(false);
        return;
      }
      if (isHost) await processRequest({ action: 'start_match', payload: { courtIdx: cIdx, players }, _fromHost: true });
      else { sendReq('start_match', { courtIdx: cIdx, players }); Alert.alert('Sent', 'Court pick request sent.'); }
      setSelectedQueueIdx([]); setShowCourts(false);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const finishMatch = () => {
    if (!showResult) return;
    const payload = { courtIdx: showResult.courtIdx, matchWinners: winners, returningPlayers: showResult.players };
    if (isHost) processRequest({ action: 'finish_match', payload, _fromHost: true });
    else sendReq('finish_match', payload);
    setWinners([]); setShowResult(null);
  };

  // ─── Substitute player ────────────────────────────────────────────────────
  const openSubstitute = (courtIdx: string, outPlayer: string) => {
    setSubstituteCourtIdx(courtIdx);
    setSubstituteOutPlayer(outPlayer);
    setShowSubstitute(true);
  };

  const doSubstitute = (inPlayer: string) => {
    processRequest({
      action: 'substitute',
      payload: { courtIdx: substituteCourtIdx, outPlayer: substituteOutPlayer, inPlayer },
      _fromHost: true,
    });
    setShowSubstitute(false);
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
    setTempPowerGuestEnabled(!!(club.power_guest_pin));
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
    // Power guest PIN is managed separately via the toggle in settings
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

  // ─── Power Guest Logic ───────────────────────────────────────────────────
  const grantPowerGuest = (targetName: string, grant: boolean) => {
    processRequest({ action: 'grant_power_guest', payload: { targetName, grant }, _fromHost: true });
  };

  const claimPowerGuest = async () => {
    if (!powerGuestPinInput.trim() || !club?.power_guest_pin) return;
    // Compute only the hash portion using the salt from the stored value
    const stored = club.power_guest_pin;
    const colonIdx = stored.indexOf(':');
    let pgPinHash: string;
    if (colonIdx !== -1) {
      const salt = stored.slice(0, colonIdx);
      pgPinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + powerGuestPinInput.trim());
    } else {
      // Legacy stored format — use old hash method
      pgPinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::pin::${powerGuestPinInput.trim()}`);
    }
    sendReq('claim_power_guest', { pgPinHash });
    setPowerGuestPinInput('');
    setShowPowerGuestPrompt(false);
    Alert.alert('Request sent', 'The host will verify your PIN and grant access.');
  };

  const resetSession = () => {
    if (!isHost) return;
    Alert.alert('Reset Session?', 'Clear queue and courts? (Stats remain safe)', [
      { text: 'Cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {} }));
        await supabase.from('clubs').update({ waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
        addLog('SYSTEM: Reset Session.');
        secondsCounter.current = 0; currentTopPlayerRef.current = '';
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
        setClub((prev: any) => ({ ...prev, waiting_list: [], court_occupants: {}, master_roster: [], match_history: [] }));
        await supabase.from('clubs').update({ waiting_list: [], court_occupants: {}, master_roster: [], match_history: [] }).eq('id', cidRef.current);
        setLogs([]); addLog('SYSTEM: Full Wipe.');
        secondsCounter.current = 0; currentTopPlayerRef.current = '';
        setShowSettings(false);
      }},
    ]);
  };

  // ─── Export Stats as CSV ──────────────────────────────────────────────────
  const exportStats = async () => {
    if (!club) return;
    const rows = [['Name', 'Gender', 'Games', 'Wins', 'Win Rate']];
    (club?.master_roster || []).forEach((p: any) => {
      const rate = (p.games || 0) > 0 ? Math.round((p.wins / p.games) * 100) : 0;
      rows.push([p.name, p.gender || 'M', p.games || 0, p.wins || 0, `${rate}%`]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${club.club_name || 'club'}_stats.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      try {
        const fileName = `${club.club_name || 'club'}_stats.csv`;
        const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
        file.write(csv);
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Player Stats' });
      } catch (e) {
        Alert.alert('Export failed', 'Could not export stats.');
      }
    }
  };

  // ─── Club Logo ────────────────────────────────────────────────────────────
  const pickClubLogo = async () => {
    if (!isHost) return;
    if (Platform.OS === 'web') { Alert.alert('Not available', 'Logo upload is not supported on web.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `logos/${cidRef.current}.${ext}`;
    const formData = new FormData();
    formData.append('file', { uri, name: fileName, type: `image/${ext}` } as any);
    const { data: uploadData, error } = await supabase.storage.from('club-logos').upload(fileName, formData, { upsert: true });
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
  // Constant-time string comparison — prevents timing-based attacks
  const safeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };

  // Produce a salted hash stored as "salt:hash" (32-char hex salt + SHA-256)
  const makeHash = async (input: string): Promise<string> => {
    const saltBytes = await Crypto.getRandomBytesAsync(16);
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
    return `${salt}:${hash}`;
  };

  // Verify against new "salt:hash" format or legacy unsalted format
  const verifyHashedPin = async (input: string, stored: string): Promise<boolean> => {
    if (!stored) return false;
    const idx = stored.indexOf(':');
    if (idx !== -1) {
      const salt = stored.slice(0, idx);
      const storedHash = stored.slice(idx + 1);
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
      return safeEqual(hash, storedHash);
    }
    // Legacy format (no salt)
    const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::pin::${input}`);
    return safeEqual(legacy, stored);
  };

  const verifyHashedPassword = async (input: string, stored: string): Promise<boolean> => {
    if (!stored) return false;
    const idx = stored.indexOf(':');
    if (idx !== -1) {
      const salt = stored.slice(0, idx);
      const storedHash = stored.slice(idx + 1);
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + input);
      return safeEqual(hash, storedHash);
    }
    // Legacy format (no salt)
    const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::${input}::club`);
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

  // ─── Derived data ─────────────────────────────────────────────────────────
  const leaderboard = [...(club?.master_roster || [])].sort((a: any, b: any) => {
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
              <TouchableOpacity onPress={claimPowerGuest}>
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
      {!isHost && !isPowerGuest && club?.power_guest_pin && (
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
            <Text style={styles.title} numberOfLines={1}>{club.club_name || 'My Club'}</Text>
            {isHost && hostNickname && hostNickname !== 'Host' ? (
              <Text style={{ color: colors.gray3, fontSize: 11 }}>Host: {hostNickname}</Text>
            ) : null}
            <Text style={styles.idText}>ID: {club.id}  (tap for QR)</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isHost && (
            <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.btnDanger}
            onPress={() => Alert.alert('Leave Session?', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: async () => {
                if (!isHost) sendReq('leave');
                await AsyncStorage.multiRemove(['currentClubId', 'isHost']).catch(() => {});
                router.replace('/');
              }},
            ])}
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
                <TouchableOpacity onPress={handleAutoPick}>
                  <Text style={styles.btnPrimaryText}>AUTO-PICK{genderBalanced ? ' ⚧' : ''}{avoidRepeats ? ' 🔄' : ''}</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.gray3, fontSize: 10, alignSelf: 'center' }}>or tap {playersPerGame} players</Text>
                {isPowerGuest && !isHost && (
                  <Text style={{ color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>⚡</Text>
                )}
              </View>
            )}
            {!isHost && !isPowerGuest && club.waiting_list?.find((w: any) => !w.isResting)?.name === (myNameRef.current || myName) && (
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
          const isMe = p.name === (myNameRef.current || myName);
          const isSelected = selectedQueueIdx.includes(i);
          const firstActiveIdx = club.waiting_list.findIndex((w: any) => !w.isResting);
          const effectiveIsHost = isHostRef.current || isHost;
          const effectiveIsPowerGuest = isPowerGuestRef.current || isPowerGuest;
          const myEffectiveName = myNameRef.current || myName;
          const isMyTurn = !effectiveIsHost && !effectiveIsPowerGuest && firstActiveIdx >= 0 && club.waiting_list[firstActiveIdx]?.name === myEffectiveName;
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
      <Modal visible={!!showPlayerProfile} animationType="fade" transparent onRequestClose={() => setShowPlayerProfile(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minWidth: 260 }]}>
            {showPlayerProfile && (() => {
              const p: Player = showPlayerProfile;
              const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
              const queuePos = (club?.waiting_list || []).findIndex((w: any) => w.name === p.name && !w.isResting);
              const onCourt = Object.entries(club?.court_occupants || {}).find(([, players]) =>
                (players as any[]).some((pl: any) => pl.name === p.name)
              );
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue, width: 28, height: 28, borderRadius: 14, marginRight: 12 }]}>
                      <Text style={{ color: colors.white, fontSize: 14, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
                    </View>
                    <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1 }]}>{p.name}</Text>
                    <TouchableOpacity onPress={() => setShowPlayerProfile(null)} style={{ paddingLeft: 10 }}>
                      <Text style={{ color: colors.white, fontSize: 28, fontWeight: 'bold', lineHeight: 28 }}>×</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ backgroundColor: colors.border, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: colors.primary, fontSize: 28, fontWeight: 'bold' }}>{p.games || 0}</Text>
                        <Text style={{ color: colors.gray2, fontSize: 11 }}>GAMES</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: colors.green, fontSize: 28, fontWeight: 'bold' }}>{p.wins || 0}</Text>
                        <Text style={{ color: colors.gray2, fontSize: 11 }}>WINS</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: colors.primary, fontSize: 28, fontWeight: 'bold' }}>{winRate}%</Text>
                        <Text style={{ color: colors.gray2, fontSize: 11 }}>WIN RATE</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginBottom: 8 }}>
                    {onCourt ? (
                      <Text style={{ color: colors.green, textAlign: 'center', fontWeight: 'bold' }}>
                        {sportEmoji} Playing on {courtLabel} {parseInt(onCourt[0]) + 1}
                      </Text>
                    ) : queuePos >= 0 ? (
                      <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: 'bold' }}>
                        #{queuePos + 1} in queue
                      </Text>
                    ) : (
                      <Text style={{ color: colors.gray2, textAlign: 'center' }}>Not currently in queue</Text>
                    )}
                  </View>

                  <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10, padding: 12 }]} onPress={() => setShowPlayerProfile(null)}>
                    <Text style={[styles.btnText, { textAlign: 'center' }]}>CLOSE</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

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
                      // Reuse the settings PIN if one is set, otherwise prompt to set one
                      const existingPin = await AsyncStorage.getItem('settings_pin');
                      if (existingPin) {
                        // Use existing settings PIN as the power guest PIN too
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
                      // Also revoke all current power guests
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
                    await supabase.auth.signOut().catch(() => {});
                    await AsyncStorage.multiRemove(['currentClubId', 'isHost', 'guestName']).catch(() => {});
                    router.replace('/');
                  }},
                ])}
              >
                <Text style={[styles.btnText, { textAlign: 'center' }]}>SIGN OUT</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }}>
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

      {/* ── COURTS ASSIGNMENT MODAL ──────────────────────────── */}
      <Modal visible={showCourts} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ASSIGN COURT</Text>

            {/* Selected players summary */}
            {selectedQueueIdx.length === 4 && (
              <View style={{ backgroundColor: colors.selectedBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <Text style={{ color: colors.gray2, fontSize: 11, textAlign: 'center', marginBottom: 4 }}>SELECTED PLAYERS</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
                  {selectedQueueIdx.map(i => club.waiting_list[i]?.name).join('  ·  ')}
                </Text>
              </View>
            )}

            {/* Court list */}
            {Array.from({ length: club.active_courts || 4 }).map((_, i) => {
              const isBusy = !!club.court_occupants?.[i.toString()];
              return (
                <TouchableOpacity
                  key={i}
                  disabled={isBusy || isProcessingAction}
                  style={[styles.modalItem, (isBusy || isProcessingAction) && { opacity: 0.3 }]}
                  onPress={() => assignCourt(i)}
                >
                  <Text style={{ color: colors.white, fontWeight: 'bold' }}>{courtLabel} {i + 1}</Text>
                  <Text style={{ color: isBusy ? colors.red : colors.green, fontWeight: 'bold' }}>
                    {isProcessingAction ? 'ASSIGNING...' : isBusy ? 'BUSY' : 'FREE — TAP TO ASSIGN'}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Cancel */}
            <TouchableOpacity
              style={[styles.btnDanger, { marginTop: 16, backgroundColor: colors.gray3 }]}
              onPress={() => { setShowCourts(false); setSelectedQueueIdx([]); }}
            >
              <Text style={[styles.btnText, { textAlign: 'center' }]}>CANCEL — CHANGE SELECTION</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MATCH RESULTS MODAL ──────────────────────────────── */}
      <Modal visible={!!showResult} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>WHO WON?</Text>
            {(showResult?.players || []).map((p, i) => (
              <TouchableOpacity key={i} style={styles.modalItem} onPress={() => {
                if (winners.includes(p.name)) setWinners(winners.filter(w => w !== p.name));
                else if (winners.length < 2) setWinners([...winners, p.name]);
                else Alert.alert('Max 2 winners', 'Deselect one first.');
              }}>
                <Text style={{ color: colors.white }}>{p.name}</Text>
                <Text style={{ color: winners.includes(p.name) ? colors.primary : colors.gray4, fontWeight: 'bold' }}>WINNER</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20, padding: 14 }]} onPress={finishMatch}>
              <Text style={[styles.btnText, { textAlign: 'center' }]}>CONFIRM & END MATCH</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 15 }} onPress={() => { setShowResult(null); setWinners([]); }}>
              <Text style={{ color: colors.gray1, textAlign: 'center' }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          SUBSTITUTE MODAL
      ================================================================== */}
      <Modal visible={showSubstitute} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SUBSTITUTE PLAYER</Text>
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 10 }}>
              Replacing: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{substituteOutPlayer}</Text>
            </Text>
            <Text style={{ color: colors.gray2, marginBottom: 10 }}>Who replaces them? (from queue)</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {(club.court_occupants?.[substituteCourtIdx] || []).length > 0 && (
                <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>Tap a court player to swap out:</Text>
              )}
              {/* First pick who to swap OUT */}
              {!substituteOutPlayer || substituteOutPlayer === '' ? (
                (club.court_occupants?.[substituteCourtIdx] || []).map((p: any, i: number) => (
                  <TouchableOpacity key={i} style={styles.modalItem} onPress={() => setSubstituteOutPlayer(p.name)}>
                    <Text style={{ color: colors.white }}>{p.name}</Text>
                    <Text style={{ color: colors.red }}>SWAP OUT</Text>
                  </TouchableOpacity>
                ))
              ) : (
                // Now pick who to swap IN
                (club.waiting_list || []).filter((p: any) => !p.isResting).map((p: any, i: number) => (
                  <TouchableOpacity key={i} style={styles.modalItem} onPress={() => doSubstitute(p.name)}>
                    <Text style={{ color: colors.white }}>{p.name}</Text>
                    <Text style={{ color: colors.green }}>SWAP IN</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => { setShowSubstitute(false); setSubstituteOutPlayer(''); }}>
              <Text style={{ color: colors.gray1, textAlign: 'center' }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          MATCH HISTORY MODAL
      ================================================================== */}
      <Modal visible={showMatchHistory} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>MATCH HISTORY</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {matchHistory.length === 0 ? (
                <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>No matches played yet.</Text>
              ) : (
                matchHistory.map((m: any, i: number) => {
                  const date = new Date(m.date);
                  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                  return (
                    <View key={i} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: colors.gray2, fontSize: 11 }}>{courtLabel} {m.court}  •  {timeStr}</Text>
                        {m.winners?.length > 0 && (
                          <Text style={{ color: colors.primary, fontSize: 11 }}>🏆 {m.winners.join(' & ')}</Text>
                        )}
                      </View>
                      <Text style={{ color: colors.white, fontSize: 13 }}>
                        <Text style={{ color: m.winners?.includes(m.team1[0]) || m.winners?.includes(m.team1[1]) ? colors.primary : colors.white }}>
                          {m.team1?.join(' & ')}
                        </Text>
                        <Text style={{ color: colors.gray3 }}> vs </Text>
                        <Text style={{ color: m.winners?.includes(m.team2[0]) || m.winners?.includes(m.team2[1]) ? colors.primary : colors.white }}>
                          {m.team2?.join(' & ')}
                        </Text>
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setShowMatchHistory(false)}>
              <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          QR CODE MODAL (header tap)
      ================================================================== */}
      <Modal visible={showQR} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={styles.modalTitle}>SHARE CLUB</Text>
            <Text style={{ color: colors.gray2, marginBottom: 20, textAlign: 'center' }}>Scan to join this session instantly</Text>
            {Platform.OS !== 'web' ? (
              <QRCode value={Linking.createURL('join', { queryParams: { clubId: club?.id } })} size={220} color={colors.primary} backgroundColor={colors.surface} />
            ) : (
              <Text selectable style={{ color: colors.primary, fontSize: 13, textAlign: 'center', marginVertical: 8 }}>
                {`https://app.jastly.com/join?clubId=${club?.id}`}
              </Text>
            )}
            <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              {Platform.OS !== 'web' ? 'Web link (share to browser users):' : 'Share this link — or the Club ID:'}
            </Text>
            {Platform.OS !== 'web' && (
              <Text selectable style={{ color: colors.gray2, fontSize: 11, textAlign: 'center', marginTop: 2, marginBottom: 4 }}>
                {`app.jastly.com/join?clubId=${club?.id}`}
              </Text>
            )}
            <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 6, textAlign: 'center' }}>Club ID:</Text>
            <Text style={{ color: colors.primary, fontSize: 26, fontWeight: 'bold', letterSpacing: 4, marginTop: 6 }}>{club?.id}</Text>
            <TouchableOpacity style={{ marginTop: 25 }} onPress={() => setShowQR(false)}>
              <Text style={{ color: colors.gray1, fontSize: 16 }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          SYSTEM LOGS MODAL
      ================================================================== */}
      <Modal visible={showLogs} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SYSTEM LOGS</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {logs.length === 0 ? (
                <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>No logs yet. (Enable logging in Settings)</Text>
              ) : (
                logs.map((log, i) => (
                  <Text key={i} style={{ color: colors.gray2, fontSize: 12, marginBottom: 4, lineHeight: 18 }}>{log}</Text>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setShowLogs(false)}>
              <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          INVITE QR CODE MODAL (settings)
      ================================================================== */}
      <Modal visible={showJoinQR} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={styles.modalTitle}>INVITE PLAYERS</Text>
            <Text style={{ color: colors.gray2, marginBottom: 20, textAlign: 'center' }}>Scan with phone camera to join instantly</Text>
            {Platform.OS !== 'web' ? (
              <QRCode value={Linking.createURL('join', { queryParams: { clubId: club?.id } })} size={220} color={colors.primary} backgroundColor={colors.surface} />
            ) : (
              <Text selectable style={{ color: colors.primary, fontSize: 13, textAlign: 'center', marginVertical: 8 }}>
                {`https://app.jastly.com/join?clubId=${club?.id}`}
              </Text>
            )}
            <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              {Platform.OS !== 'web' ? 'Web link (share to browser users):' : 'Share this link — or the Club ID:'}
            </Text>
            {Platform.OS !== 'web' && (
              <Text selectable style={{ color: colors.gray2, fontSize: 11, textAlign: 'center', marginTop: 2, marginBottom: 4 }}>
                {`app.jastly.com/join?clubId=${club?.id}`}
              </Text>
            )}
            <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 6, textAlign: 'center' }}>Club ID:</Text>
            <Text style={{ color: colors.primary, fontSize: 26, fontWeight: 'bold', letterSpacing: 4, marginTop: 6 }}>{club?.id}</Text>
            <TouchableOpacity style={{ marginTop: 28 }} onPress={() => setShowJoinQR(false)}>
              <Text style={{ color: colors.gray1, fontSize: 16 }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          LEADERBOARD MODAL
      ================================================================== */}
      <Modal visible={showLeaderboard} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>LEADERBOARD</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {leaderboard.map((p: any, i: number) => {
                const rate = (p.games || 0) > 0 ? Math.round((p.wins / p.games) * 100) : 0;
                return (
                  <View key={i} style={[styles.modalItem, { alignItems: 'center' }]}>
                    <Text style={{ color: i < 3 ? colors.primary : colors.gray2, fontWeight: 'bold', width: 28 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.white, fontWeight: 'bold' }}>{p.name}</Text>
                      <Text style={{ color: colors.gray3, fontSize: 11 }}>{p.wins || 0}W  /  {p.games || 0}G</Text>
                    </View>
                    <Text style={{ color: colors.green, fontWeight: 'bold' }}>{rate}%</Text>
                  </View>
                );
              })}
              {leaderboard.length === 0 && (
                <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>No stats yet.</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setShowLeaderboard(false)}>
              <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          SETUP PIN MODAL
      ================================================================== */}
      <Modal visible={showSetupPin} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SET UP PIN</Text>
            <TextInput style={styles.input} placeholder="Enter 4-digit PIN" placeholderTextColor={colors.gray3} secureTextEntry maxLength={4} keyboardType="numeric" value={setupPin1} onChangeText={(v) => { setSetupPin1(v); setPinError(false); }} />
            <TextInput style={styles.input} placeholder="Confirm PIN" placeholderTextColor={colors.gray3} secureTextEntry maxLength={4} keyboardType="numeric" value={setupPin2} onChangeText={(v) => { setSetupPin2(v); setPinError(false); }} />
            {pinError && <Text style={{ color: colors.red, textAlign: 'center', marginBottom: 10 }}>PINs do not match</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setShowSetupPin(false); setTempPinEnabled(false); }}><Text style={{ color: colors.gray1 }}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveSetupPin}><Text style={{ color: colors.primary, fontWeight: 'bold' }}>SAVE PIN</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          ENTER PIN MODAL
      ================================================================== */}
      <Modal visible={showEnterPin} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ENTER PIN</Text>
            <TextInput style={styles.input} placeholder="****" placeholderTextColor={colors.gray3} secureTextEntry maxLength={4} keyboardType="numeric" autoFocus value={enterPinInput} onChangeText={setEnterPinInput} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setShowEnterPin(false); setEnterPinInput(''); setPendingPinAction(null); }}><Text style={{ color: colors.gray1 }}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity onPress={verifyPin}><Text style={{ color: colors.primary, fontWeight: 'bold' }}>UNLOCK</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================================
          SESSION STARTUP MODAL (host only, every session)
      ================================================================== */}
      <Modal visible={showStartup} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SESSION SETUP</Text>
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 20 }}>How many courts are available today?</Text>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.white, fontWeight: 'bold' }}>Active Courts</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setStartupCourts(Math.max(1, startupCourts - 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>-</Text></TouchableOpacity>
                <Text style={{ color: colors.primary, marginHorizontal: 20, fontWeight: 'bold', fontSize: 22 }}>{startupCourts}</Text>
                <TouchableOpacity onPress={() => setStartupCourts(Math.min(10, startupCourts + 1))} style={styles.mathBtn}><Text style={{ color: colors.white }}>+</Text></TouchableOpacity>
              </View>
            </View>

            {/* Restore previous queue if one was saved */}
            {(club?.saved_queue?.length > 0) && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: colors.blueDark, marginTop: 20, padding: 14 }]}
                onPress={async () => {
                  const savedQ = club.saved_queue || [];
                  setClub((prev: any) => ({ ...prev, active_courts: startupCourts, waiting_list: savedQ, court_occupants: {} }));
                  await supabase.from('clubs').update({ active_courts: startupCourts, waiting_list: savedQ, court_occupants: {} }).eq('id', cidRef.current);
                  addLog('SYSTEM: Restored previous queue.');
                  setShowStartup(false);
                }}
              >
                <Text style={[styles.btnText, { textAlign: 'center' }]}>♻️  RESTORE LAST SESSION'S QUEUE ({club.saved_queue.length} players)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btnDanger, { backgroundColor: colors.gray3, marginTop: 15 }]}
              onPress={async () => {
                setClub((prev: any) => ({ ...prev, active_courts: startupCourts, waiting_list: [], court_occupants: {} }));
                await supabase.from('clubs').update({ active_courts: startupCourts, waiting_list: [], court_occupants: {} }).eq('id', cidRef.current);
                addLog('SYSTEM: Reset Session.');
                secondsCounter.current = 0; currentTopPlayerRef.current = '';
                setShowStartup(false);
              }}
            >
              <Text style={[styles.btnText, { textAlign: 'center' }]}>RESET SESSION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 10, padding: 14 }]}
              onPress={async () => {
                setClub((prev: any) => ({ ...prev, active_courts: startupCourts }));
                await supabase.from('clubs').update({ active_courts: startupCourts }).eq('id', cidRef.current);
                setShowStartup(false);
              }}
            >
              <Text style={[styles.btnText, { textAlign: 'center', fontSize: 15 }]}>CONTINUE SESSION</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ============================================================
// STYLES  (called with live colors so both themes work)
// ============================================================
const makeStyles = (C: ColorSet) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: C.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: 'bold', color: C.black, fontSize: 18 },
  idText: { color: C.black, fontSize: 10, fontWeight: 'bold' },
  settingsBtn: { marginRight: 15, padding: 5 },
  courtBusy: { backgroundColor: C.redDark, borderColor: C.red },
  courtFree: { backgroundColor: C.surface, borderColor: C.border, justifyContent: 'center' },
  courtTitle: { color: C.primary, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  courtPlayer: { color: C.white, fontWeight: 'bold', textAlign: 'center' },
  courtFreeText: { color: C.green, textAlign: 'center', fontWeight: 'bold' },
  banner: { backgroundColor: C.surface, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  nextText: { color: C.primary, fontWeight: 'bold', fontSize: 14 },
  btnPrimary: { backgroundColor: C.purple, padding: 10, borderRadius: 6 },
  btnPrimaryText: { color: C.white, fontSize: 10, fontWeight: 'bold', backgroundColor: C.border, padding: 5, borderRadius: 4, width: 100, textAlign: 'center' },
  btnDanger: { backgroundColor: C.red, padding: 8, borderRadius: 6 },
  btnText: { color: C.white, fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  mathBtn: { backgroundColor: C.border, paddingHorizontal: 15, paddingVertical: 5, borderRadius: 5 },
  sportChip: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginRight: 8, minWidth: 72,
  },
  sportChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  queueRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: C.surface, marginBottom: 5, borderRadius: 8, alignItems: 'center' },
  pName: { color: C.white, fontSize: 16, fontWeight: 'bold' },
  genderBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  label: { color: C.gray2, fontSize: 12, marginBottom: 5 },
  sectionHeader: { color: C.primary, fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontSize: 13, letterSpacing: 1 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: 'center', padding: 20, zIndex: 10 },
  modalContent: { backgroundColor: C.surface, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.primary, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 16 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  input: { backgroundColor: C.bg, color: C.white, padding: 15, borderRadius: 5, marginBottom: 15, borderWidth: 1, borderColor: C.border },
  fullModalOverlay: { flex: 1, backgroundColor: C.overlayLight, justifyContent: 'flex-end' },
  fullModalContent: { backgroundColor: C.surfaceHigh, height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 15 },
  rosterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft, alignItems: 'center' },
  genderBtn: { padding: 15, borderWidth: 1, borderColor: C.gray3, borderRadius: 8, marginHorizontal: 10, width: 120, alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: C.gray2, borderRadius: 4, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
});