import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, Share } from 'react-native';
import { supabase } from '../supabase';
import { Club, CourtResult, Player, QueuePlayer, Tournament, TournamentMatch } from '../types';
import {
  computeGame2Teams, generateKnockoutRound, isRoundComplete, isMixedTeam,
  knockoutAdvancers, recalcStandings, recalcSuperScores,
} from '../utils/tournament';
import { getSportConfig } from '../constants/sports';

export function useClubSession() {
  const router = useRouter();

  // ─── Core identity ────────────────────────────────────────────────────────
  const [isHost, setIsHost] = useState(false);
  const [isEmailHost, setIsEmailHost] = useState(false);
  const [hostNickname, setHostNickname] = useState('');
  const [club, setClub] = useState<Club | null>(null);
  const [myName, setMyName] = useState('');
  const cidRef = useRef('');
  const clubRef = useRef<Club | null>(null);

  // ─── Async loading guards ──────────────────────────────────────────────────
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isMyTurnBanner, setIsMyTurnBanner] = useState(false);

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
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ─── Logging ───────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<string[]>([]);

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
  const guestHeartbeatsRef = useRef<Record<string, number>>({});
  const lastInactiveCheckRef = useRef(0);
  const courtStartTimes = useRef<Record<string, number>>({});
  const courtDurationAlerted = useRef<Record<string, boolean>>({});
  const prevClubRef = useRef<Club | null>(null);

  // ─── Keep refs in sync ───────────────────────────────────────────────────
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

  // ─── Derived: sport config ────────────────────────────────────────────────
  const { emoji: sportEmoji, court: courtLabel, playersPerGame, label: sportLabel } = useMemo(
    () => getSportConfig(club?.sport), [club?.sport]
  );

  // ─── Derived: power guest ─────────────────────────────────────────────────
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
    (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);

  const getRoster = (c: Club | null): Player[] => {
    if (!c) return [];
    const sportK = c.sport || 'badminton';
    const mr = (c as any).master_roster;
    if (!mr) return [];
    if (Array.isArray(mr)) return sportK === 'badminton' ? mr : [];
    return (mr[sportK] || []) as Player[];
  };

  const updateRoster = (mr: any, sport: string, players: Player[]): Record<string, Player[]> => {
    const base: Record<string, Player[]> = Array.isArray(mr) ? { badminton: mr } : { ...(mr || {}) };
    return { ...base, [sport]: players };
  };

  // ─── Notifications ────────────────────────────────────────────────────────
  const requestNotificationPermission = async () => {
    if (Platform.OS === 'web') return;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Badminton Hub',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFEB3B',
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

  // ─── Chime ────────────────────────────────────────────────────────────────
  const playChime = async () => {
    if (Platform.OS === 'web' || !soundEnabledRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/chime.mp3'),
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
    const top = [...getRoster(club)]
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

  // ─── Export Stats as CSV ──────────────────────────────────────────────────
  const exportStats = async () => {
    if (!club) return;
    const rows: (string | number)[][] = [['Name', 'Gender', 'Games', 'Wins', 'Win Rate']];
    getRoster(club).forEach((p: any) => {
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

  // ─── Timing-safe string compare ───────────────────────────────────────────
  const safeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };

  // ─── Host Core Logic ──────────────────────────────────────────────────────
  const applyRequest = (
    prev: Club,
    req: any,
  ): { next: Club; logs: string[]; speech?: string; resetTimers?: boolean; noWrite?: boolean } | null => {
    const next: Club = {
      ...prev,
      waiting_list: [...(prev.waiting_list || [])],
      master_roster: Array.isArray(prev.master_roster)
        ? { badminton: [...prev.master_roster] }
        : { ...((prev.master_roster as any) || {}) },
      court_occupants: { ...(prev.court_occupants || {}) },
      match_history: [...(prev.match_history || [])],
    };
    const { action, payload } = req;
    const sportKey = (next.sport || 'badminton') as string;
    const mr = () => (((next.master_roster as any)[sportKey] || []) as Player[]);
    const updateMR = (fn: (arr: Player[]) => Player[]) => {
      (next.master_roster as any)[sportKey] = fn(mr());
    };
    const logEntries: string[] = [];
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
        logEntries.push(`POWER: ${tName} ${grant ? 'granted' : 'revoked'} power guest.`);
      }
    } else if (action === 'claim_power_guest') {
      const { pgPinHash } = payload;
      if (!next.power_guest_pin || !pgPinHash) return null;
      const stored = next.power_guest_pin;
      const colonIdx = stored.indexOf(':');
      const storedHash = colonIdx !== -1 ? stored.slice(colonIdx + 1) : stored;
      if (!safeEqual(pgPinHash, storedHash)) {
        return { next: prev, logs: [`SECURITY: ${requesterName} used wrong power guest PIN.`], noWrite: true };
      }
      const idx = next.waiting_list.findIndex((w: any) => w.name === requesterName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], isPowerGuest: true };
        logEntries.push(`POWER: ${requesterName} claimed power guest status.`);
      }
    } else if (action === 'batch_join') {
      let addedCount = 0;
      const playersToAdd: any[] = Array.isArray(payload.players) ? payload.players : [];
      playersToAdd.forEach((p: any) => {
        const pName = sanitiseName(p.name);
        if (!pName) return;
        if (!elevated && pName !== requesterName) {
          logEntries.push(`SECURITY: ${requesterName} tried to add ${pName} — blocked.`);
          return;
        }
        const inRoster = mr().some((m: any) => m.name === pName);
        if (!inRoster) {
          updateMR(r => [...r, { name: pName, gender: p.gender || 'M', games: 0, wins: 0 }]);
        }
        if (!next.waiting_list.find((x: any) => x.name === pName)) {
          next.waiting_list.push({ name: pName, gender: p.gender || 'M', isResting: false });
          addedCount++;
        }
      });
      if (addedCount > 0) {
        logEntries.push(`QUEUE: ${addedCount} player(s) added.`);
        const addedNames = playersToAdd
          .map((p: any) => sanitiseName(p.name))
          .filter((n: string) => !!n);
        const namePart = addedNames.length === 1
          ? addedNames[0]
          : addedNames.length === 2
            ? `${addedNames[0]} and ${addedNames[1]}`
            : `${addedNames.slice(0, -1).join(', ')} and ${addedNames[addedNames.length - 1]}`;
        return { next, logs: logEntries, speech: `${namePart} ${addedNames.length === 1 ? 'has' : 'have'} joined the queue.` };
      }
    } else if (action === 'toggle_pause') {
      const targetName = sanitiseName(payload.name);
      if (!elevated && targetName !== requesterName) {
        logEntries.push(`SECURITY: ${requesterName} tried to pause ${targetName} — blocked.`);
        return null;
      }
      const idx = next.waiting_list.findIndex((x: any) => x.name === targetName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], isResting: !next.waiting_list[idx].isResting };
        logEntries.push(`STATUS: ${targetName} is now ${next.waiting_list[idx].isResting ? 'Resting' : 'Active'}.`);
      }
      return { next, logs: logEntries, resetTimers: true };
    } else if (action === 'leave') {
      const targetName = sanitiseName(payload.name);
      if (!elevated && targetName !== requesterName) {
        logEntries.push(`SECURITY: ${requesterName} tried to remove ${targetName} — blocked.`);
        return null;
      }
      next.waiting_list = next.waiting_list.filter((x: any) => x.name !== targetName);
      logEntries.push(`QUEUE: ${targetName} left.`);
      return { next, logs: logEntries, resetTimers: true };
    } else if (action === 'set_player_note') {
      if (!elevated) return null;
      const targetName = sanitiseName(payload.name);
      const note = (payload.note ?? '').toString().substring(0, 100);
      const idx = next.waiting_list.findIndex((x: any) => x.name === targetName);
      if (idx !== -1) {
        next.waiting_list[idx] = { ...next.waiting_list[idx], notes: note || undefined };
        logEntries.push(`NOTE: ${targetName} — "${note}"`);
      }
      return { next, logs: logEntries };
    } else if (action === 'substitute') {
      if (!elevated) return null;
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
      logEntries.push(`SUB: ${outPlayer} ↔ ${inPlayer} on ${subCourt} ${parseInt(cIdx) + 1}.`);
      return { next, logs: logEntries, speech: `${inPlayer} is substituting ${outPlayer} on ${subCourt.toLowerCase()} ${parseInt(cIdx) + 1}.` };
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
        const cur = mr(); const mIdx = cur.findIndex((m: any) => m.name === p.name);
        if (mIdx !== -1) updateMR(r => r.map((m, i) => i === mIdx ? { ...m, games: (m.games || 0) + 1 } : m));
      });
      const sportCfg = getSportConfig(next.sport);
      logEntries.push(`MATCH: ${sportCfg.court} ${cIdx + 1} started.`);
      const half = Math.floor(pNames.length / 2);
      const t1Names = pNames.slice(0, half);
      const t2Names = pNames.slice(half);
      const teamStr = (names: string[]) =>
        names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      let msg = `${sportCfg.court} ${cIdx + 1} ready. ${teamStr(t1Names)} versus ${teamStr(t2Names)}.`;
      const nextActive = next.waiting_list.find((w: any) => !w.isResting);
      if (nextActive) msg += ` Next up is ${nextActive.name}.`;
      return { next, logs: logEntries, speech: msg, resetTimers: true };
    } else if (action === 'reorder_queue') {
      if (!elevated) return null;
      const { fromIdx, toIdx } = payload;
      const len = next.waiting_list.length;
      if (fromIdx < 0 || fromIdx >= len || toIdx < 0 || toIdx >= len) return null;
      const [moved] = next.waiting_list.splice(fromIdx, 1);
      next.waiting_list.splice(toIdx, 0, moved);
      logEntries.push(`QUEUE: ${moved.name} moved to position ${toIdx + 1}.`);
      return { next, logs: logEntries, resetTimers: true };
    } else if (action === 'finish_match') {
      const { courtIdx, matchWinners, scoreA, scoreB } = payload;
      const cIdx = courtIdx.toString();
      const courtPlayers: any[] = next.court_occupants[cIdx] || [];
      if (!courtPlayers.length) return null;
      if (!elevated && !courtPlayers.some((p: any) => p.name === requesterName)) return null;
      const courtPlayerNames = courtPlayers.map((p: any) => p.name);
      const validWinners: string[] = Array.isArray(matchWinners)
        ? matchWinners.filter((w: string) => courtPlayerNames.includes(w)).slice(0, 2) : [];
      validWinners.forEach((wName: string) => {
        const cur = mr(); const mIdx = cur.findIndex((m: any) => m.name === wName);
        if (mIdx !== -1) updateMR(r => r.map((m, i) => i === mIdx ? { ...m, wins: (m.wins || 0) + 1 } : m));
      });
      const finishHalf = Math.floor(courtPlayers.length / 2);
      const team1 = courtPlayers.slice(0, finishHalf).map((p: any) => p.name);
      const team2 = courtPlayers.slice(finishHalf).map((p: any) => p.name);
      const historyEntry: any = {
        date: new Date().toISOString(),
        court: parseInt(cIdx) + 1,
        team1,
        team2,
        winners: validWinners,
        ...(scoreA !== undefined ? { scoreA, scoreB } : {}),
      };
      next.match_history = [historyEntry, ...next.match_history].slice(0, 100);
      const rotationMode = next.rotation_mode ?? 'standard';
      if (rotationMode !== 'standard' && validWinners.length > 0) {
        const winnerSet = new Set(validWinners);
        const winnerPlayers = courtPlayers.filter((p: any) => winnerSet.has(p.name));
        const loserPlayers = courtPlayers.filter((p: any) => !winnerSet.has(p.name));
        if (rotationMode === 'winner_stays') {
          // Winners jump to front of queue; losers appended to back
          next.waiting_list = [...winnerPlayers, ...next.waiting_list, ...loserPlayers];
        } else {
          // loser_stays: losers jump to front; winners appended to back
          next.waiting_list = [...loserPlayers, ...next.waiting_list, ...winnerPlayers];
        }
      } else {
        next.waiting_list = [...next.waiting_list, ...courtPlayers];
      }
      delete next.court_occupants[cIdx];
      next.saved_queue = [...next.waiting_list];
      logEntries.push(`MATCH: ${getSportConfig(next.sport).court} ${parseInt(cIdx) + 1} finished. Winners: ${validWinners.join(', ') || 'none'}`);
      return { next, logs: logEntries, resetTimers: true };
    }

    // ── Tournament actions ───────────────────────────────────────────────────
    if (action === 'tournament_start') {
      if (!req._fromHost) return null;
      const t = payload.tournament as Tournament;
      // Pull tournament players out of the waiting list
      const tournamentNames = new Set(t.teams.flatMap((tm: any) => tm.players as string[]));
      const originalQueue = next.waiting_list.filter((p: any) => tournamentNames.has(p.name));
      next.waiting_list = next.waiting_list.filter((p: any) => !tournamentNames.has(p.name));
      next.tournament = { ...t, originalQueue };
      logEntries.push('TOURNAMENT: Started');
      return { next, logs: logEntries };
    }

    if (action === 'tournament_end') {
      if (!req._fromHost) return null;
      // Restore players to waiting list
      if (next.tournament?.originalQueue?.length) {
        const alreadyIn = new Set(next.waiting_list.map((p: any) => p.name));
        const toRestore = next.tournament.originalQueue.filter((p: any) => !alreadyIn.has(p.name));
        next.waiting_list = [...toRestore, ...next.waiting_list];
      }
      next.tournament = null;
      logEntries.push('TOURNAMENT: Ended');
      return { next, logs: logEntries };
    }

    if (action === 'tournament_super_score') {
      if (!next.tournament || next.tournament.format !== 'super') return null;
      const { matchId, score } = payload;
      // Security: guest can only submit their own name
      const submitter = requesterName || sanitiseName(payload.playerName || '');
      if (!req._fromHost && submitter !== requesterName) return null;
      const playerName = req._fromHost ? sanitiseName(payload.playerName || '') : requesterName;
      if (!playerName) return null;
      const t: Tournament = JSON.parse(JSON.stringify(next.tournament));
      const mIdx = t.matches.findIndex((m: TournamentMatch) => m.id === matchId);
      if (mIdx === -1 || t.matches[mIdx].winnerId !== null) return null;
      t.matches[mIdx] = {
        ...t.matches[mIdx],
        pendingScores: { ...(t.matches[mIdx].pendingScores ?? {}), [playerName]: parseInt(score, 10) || 0 },
      };
      next.tournament = t;
      logEntries.push(`TOURNAMENT: ${playerName} submitted score ${score}`);
      return { next, logs: logEntries };
    }

    if (action === 'start_tournament_match') {
      if (!req._fromHost) return null;
      const { matchId, courtIdx, players } = payload;
      if (!next.tournament) return null;
      const t: Tournament = JSON.parse(JSON.stringify(next.tournament));
      const mIdx = t.matches.findIndex((m: TournamentMatch) => m.id === matchId);
      if (mIdx === -1 || t.matches[mIdx].winnerId !== null) return null;
      t.matches[mIdx] = { ...t.matches[mIdx], courtIdx };
      next.tournament = t;
      // Place players on court
      next.court_occupants = { ...next.court_occupants, [String(courtIdx)]: players };
      logEntries.push(`TOURNAMENT: Match started on court ${courtIdx + 1}`);
      return { next, logs: logEntries };
    }

    if (action === 'tournament_super_game1') {
      if (!req._fromHost) return null;
      const { matchId, game1Scores } = payload;
      if (!next.tournament) return null;
      const t: Tournament = JSON.parse(JSON.stringify(next.tournament));
      const mIdx = t.matches.findIndex((m: TournamentMatch) => m.id === matchId);
      if (mIdx === -1 || t.matches[mIdx].game1Complete) return null;
      const match = t.matches[mIdx];
      const team1Players = t.teams.find(tm => tm.id === match.team1Id)?.players ?? [];
      const team2Players = t.teams.find(tm => tm.id === match.team2Id)?.players ?? [];
      // Use originalQueue for gender lookup (players removed from waiting_list during tournament)
      const rosterLookup = [...(t.originalQueue ?? []), ...next.waiting_list];
      let game2Team1 = team1Players;
      let game2Team2 = team2Players;
      if (t.swapTeams !== false) {
        const mixed = isMixedTeam(team1Players, rosterLookup);
        ({ game2Team1, game2Team2 } = computeGame2Teams(team1Players, team2Players, rosterLookup, mixed));
      }
      t.matches[mIdx] = { ...match, game1Scores, game1Complete: true, game2Team1, game2Team2, pendingScores: undefined };
      next.tournament = t;
      logEntries.push(`TOURNAMENT: Super game 1 recorded for match ${matchId}`);
      return { next, logs: logEntries };
    }

    if (action === 'tournament_match_result') {
      if (!req._fromHost) return null;
      const { matchId, winnerId, scoreA: tScoreA, scoreB: tScoreB, game2Scores } = payload;
      if (!next.tournament) return null;
      const t: Tournament = JSON.parse(JSON.stringify(next.tournament));
      const mIdx = t.matches.findIndex((m: TournamentMatch) => m.id === matchId);
      if (mIdx === -1 || t.matches[mIdx].winnerId !== null) return null;
      const match = t.matches[mIdx];

      if (t.format === 'super') {
        // Super mode: record game 2 scores and close match
        t.matches[mIdx] = {
          ...match,
          game2Scores,
          winnerId: '__super__',
          timestamp: new Date().toISOString(),
          courtIdx: undefined,
          pendingScores: undefined,
        };
        // Update team compositions so future matches use the swapped lineup (only if swapTeams)
        if (t.swapTeams !== false) {
          const team1Obj = t.teams.find((tm: any) => tm.id === match.team1Id);
          const team2Obj = t.teams.find((tm: any) => tm.id === match.team2Id);
          if (team1Obj && match.game2Team1?.length) team1Obj.players = match.game2Team1;
          if (team2Obj && match.game2Team2?.length) team2Obj.players = match.game2Team2;
        }
        t.superPlayerScores = recalcSuperScores(t.matches);
        const allDone = t.matches.every(m => m.winnerId !== null);
        if (allDone) {
          t.state = 'completed';
          const sorted = Object.entries(t.superPlayerScores).sort(([, a], [, b]) => b - a);
          t.champion = sorted[0]?.[0] ?? undefined;
        }
      } else {
        // Standard mode
        t.matches[mIdx] = {
          ...match,
          winnerId,
          scoreA: tScoreA,
          scoreB: tScoreB,
          timestamp: new Date().toISOString(),
          courtIdx: undefined,
        };
        if (t.format === 'round_robin') {
          t.teams = recalcStandings(t.teams, t.matches);
          if (t.matches.every(m => m.winnerId !== null)) {
            t.state = 'completed';
            t.champion = [...t.teams].sort((a, b) => b.points - a.points || b.wins - a.wins)[0]?.id;
          }
        } else {
          // Knockout
          if (isRoundComplete(t.matches, t.currentKnockoutRound)) {
            const advancers = knockoutAdvancers(t.matches, t.currentKnockoutRound, t.teams);
            if (advancers.length === 1) {
              t.state = 'completed';
              t.champion = advancers[0].id;
            } else {
              t.currentKnockoutRound++;
              t.matches.push(...generateKnockoutRound(advancers, t.currentKnockoutRound));
            }
          }
        }
      }

      // Remove players from court
      const courtKey = Object.keys(next.court_occupants).find(
        k => t.matches[mIdx] && String(match.courtIdx) === k,
      );
      if (courtKey !== undefined) delete next.court_occupants[courtKey];

      next.tournament = t;
      logEntries.push(`TOURNAMENT: Match ${matchId} result recorded`);
      return { next, logs: logEntries };
    }

    return { next, logs: logEntries };
  };

  const processRequest = async (req: any) => {
    const prevClub = clubRef.current;
    if (!prevClub) return;

    if (req.action === 'heartbeat') {
      const name = sanitiseName(req.payload?.name || '');
      if (name) guestHeartbeatsRef.current[name] = Date.now();
      if (req.id) await supabase.from('requests').delete().eq('id', req.id);
      return;
    }

    const result = applyRequest(prevClub, req);
    if (!result) return;

    if (req.action === 'batch_join' && !req._fromHost) {
      const name = sanitiseName(req.payload?.name || '');
      if (name) guestHeartbeatsRef.current[name] = Date.now();
    }
    if (req.action === 'finish_match') {
      const returning: any[] = req.payload?.returningPlayers || [];
      const now = Date.now();
      returning.forEach((p: any) => {
        const name = sanitiseName(p.name || '');
        if (name) guestHeartbeatsRef.current[name] = now;
      });
    }

    const { next, logs: resultLogs, speech, resetTimers, noWrite } = result;
    if (!noWrite) prevClubRef.current = prevClub;
    setClub(next);
    resultLogs.forEach(addLog);
    if (speech) Speech.speak(speech, { language: ttsVoiceRef.current });
    if (resetTimers) { secondsCounter.current = 0; currentTopPlayerRef.current = ''; }

    if (req.action === 'start_match' || req.action === 'start_tournament_match') {
      const cIdx = parseInt(req.payload?.courtIdx ?? -1);
      if (!isNaN(cIdx) && cIdx >= 0) {
        courtStartTimes.current[cIdx.toString()] = Date.now();
        delete courtDurationAlerted.current[cIdx.toString()];
      }
    }
    if (req.action === 'finish_match' || req.action === 'tournament_match_result') {
      const cIdx = (req.payload?.courtIdx ?? req.payload?.matchId ?? '').toString();
      if (cIdx) {
        delete courtStartTimes.current[cIdx];
        delete courtDurationAlerted.current[cIdx];
      }
    }

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
      tournament: next.tournament ?? null,
      ...(next.power_guest_pin !== undefined ? { power_guest_pin: next.power_guest_pin } : {}),
    }).eq('id', cidRef.current);

    if (error) {
      setClub(prevClub);
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

  // ─── Power Guest Logic ───────────────────────────────────────────────────
  const grantPowerGuest = (targetName: string, grant: boolean) => {
    processRequest({ action: 'grant_power_guest', payload: { targetName, grant }, _fromHost: true });
  };

  const claimPowerGuest = async (pinInput: string) => {
    if (!pinInput.trim() || !(club?.has_power_guest_pin ?? club?.power_guest_pin)) return;
    const stored = club.power_guest_pin ?? '';
    const colonIdx = stored.indexOf(':');
    let pgPinHash: string;
    if (colonIdx !== -1) {
      const salt = stored.slice(0, colonIdx);
      pgPinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + pinInput.trim());
    } else {
      pgPinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::pin::${pinInput.trim()}`);
    }
    sendReq('claim_power_guest', { pgPinHash });
    Alert.alert('Request sent', 'The host will verify your PIN and grant access.');
  };

  // ─── Auto-pick with gender balance + avoid repeats ────────────────────────
  // Returns the computed queue indices so the shell can update selectedQueueIdx and show court modal
  const handleAutoPick = (): number[] | undefined => {
    if (!club) return undefined;
    const limit = club.pick_limit || 20;
    const eligible = (club.waiting_list || [])
      .map((p: any, i: number) => ({ ...p, queueIdx: i }))
      .filter((p: any, i: number) => !p.isResting && i < limit);

    if (eligible.length < playersPerGame) { Alert.alert('Notice', `Not enough active players in range (need ${playersPerGame}).`); return undefined; }

    let selected: any[] = [];
    const half = Math.floor(playersPerGame / 2);

    if (genderBalanced && half >= 1) {
      const males = eligible.filter((p: any) => p.gender !== 'F');
      const females = eligible.filter((p: any) => p.gender === 'F');
      if (males.length >= half && females.length >= half) {
        // MF vs MF (or half+half for other sports)
        selected = [...males.slice(0, half), ...females.slice(0, half)];
      } else if (males.length >= playersPerGame) {
        // MM vs MM — enough males for a full game
        selected = males.slice(0, playersPerGame);
      } else if (females.length >= playersPerGame) {
        // FF vs FF — enough females for a full game
        selected = females.slice(0, playersPerGame);
      } else {
        // No valid balanced option — last resort, take front of queue
        selected = eligible.slice(0, playersPerGame);
      }
    } else {
      selected = eligible.slice(0, playersPerGame);
    }

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
        const lastMatchNames = [...lastMatch.team1, ...lastMatch.team2];
        const alternates = eligible.filter((p: any) => !lastMatchNames.includes(p.name) && !selected.slice(0, 3).map((s: any) => s.name).includes(p.name));
        if (alternates.length > 0) {
          selected = [...selected.slice(0, 3), alternates[0]];
        }
      }
    }

    return selected.map((p: any) => p.queueIdx);
  };

  // selectedQueueIdx is owned by the shell; caller passes it in and handles clearing after
  const assignCourt = async (courtIdx: number, selectedQueueIdx: number[], onQueueChanged?: () => void) => {
    if (!club || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const players = selectedQueueIdx.map((i) => club.waiting_list[i]).filter(Boolean);
      if (players.length !== selectedQueueIdx.length ||
          players.some((p, i) => p?.name !== club.waiting_list[selectedQueueIdx[i]]?.name)) {
        Alert.alert('Queue Changed', 'The queue has changed since you selected. Please select again.');
        onQueueChanged?.();
        return;
      }
      if (isHost) await processRequest({ action: 'start_match', payload: { courtIdx, players }, _fromHost: true });
      else { sendReq('start_match', { courtIdx, players }); Alert.alert('Sent', 'Court pick request sent.'); }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const finishMatch = (courtResult: CourtResult, winners: string[], scoreA?: number, scoreB?: number) => {
    const payload = {
      courtIdx: courtResult.courtIdx,
      matchWinners: winners,
      returningPlayers: courtResult.players,
      ...(scoreA !== undefined ? { scoreA, scoreB } : {}),
    };
    if (isHost) processRequest({ action: 'finish_match', payload, _fromHost: true });
    else sendReq('finish_match', payload);
  };

  const undoLastAction = async () => {
    const snapshot = prevClubRef.current;
    if (!snapshot) { Alert.alert('Nothing to Undo', 'No previous state to restore.'); return; }
    prevClubRef.current = null;
    setClub(snapshot);
    await supabase.from('clubs').update({
      waiting_list: snapshot.waiting_list,
      master_roster: snapshot.master_roster,
      court_occupants: snapshot.court_occupants,
      match_history: snapshot.match_history,
      saved_queue: snapshot.saved_queue,
      tournament: snapshot.tournament ?? null,
    }).eq('id', cidRef.current);
    addLog('SYSTEM: Undo applied.');
  };

  // substituteCourtIdx and substituteOutPlayer are shell state; caller passes them in
  const doSubstitute = (inPlayer: string, substituteCourtIdx: string, substituteOutPlayer: string) => {
    processRequest({
      action: 'substitute',
      payload: { courtIdx: substituteCourtIdx, outPlayer: substituteOutPlayer, inPlayer },
      _fromHost: true,
    });
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

        const { data: sessionData } = await supabase.auth.getSession();
        const myUid = sessionData?.session?.user?.id || '';
        const isActuallyHost = hStatus || (!!myUid && data.host_uid === myUid);
        const nickname = sessionData?.session?.user?.user_metadata?.nickname;
        if (nickname) setHostNickname(nickname);
        if (isActuallyHost && myUid && !sessionData?.session?.user?.is_anonymous) {
          setIsEmailHost(true);
        }
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
              supabase.from('clubs').select('*').eq('id', cid).single()
                .then(({ data }) => { if (data) setClub(data as Club); });
            }
          });

        if (isActuallyHost) {
          const seedNow = Date.now();
          (data.waiting_list || []).forEach((w: any) => {
            guestHeartbeatsRef.current[w.name] = seedNow;
          });

          supabase
            .channel('req-sync')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: `club_id=eq.${cid}` },
              (p) => processRequest({ ...p.new, _fromHost: false, _isPowerGuest: false }))
            .subscribe();
        }

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

  // ─── Guest heartbeat ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isHost || !myName) return;
    sendReq('heartbeat');
    const interval = setInterval(() => {
      if (myNameRef.current) sendReq('heartbeat');
    }, 45_000);
    return () => clearInterval(interval);
  }, [isHost, myName]);

  // ─── Club cache effect ────────────────────────────────────────────────────
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

  // ─── Host Timer interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;
    const timer = setInterval(() => {
      const c = clubRef.current;

      const now = Date.now();
      if (c && now - lastInactiveCheckRef.current > 60_000) {
        lastInactiveCheckRef.current = now;
        const stale = (c.waiting_list || []).filter((w: any) => {
          const hb = guestHeartbeatsRef.current[w.name];
          if (!hb) return false;
          const onCourt = Object.values(c.court_occupants || {}).flat().some((p: any) => p.name === w.name);
          return !onCourt && (now - hb) > 120_000;
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

      // ── Target game duration alerts ──────────────────────────────────────
      const targetMins = c?.target_game_duration ?? 0;
      if (c && targetMins > 0) {
        const targetMs = targetMins * 60_000;
        const sportCourtLabel = getSportConfig(c.sport).court;
        Object.entries(courtStartTimes.current).forEach(([cKey, startMs]) => {
          if (!courtDurationAlerted.current[cKey] && now - startMs >= targetMs) {
            courtDurationAlerted.current[cKey] = true;
            const courtNum = parseInt(cKey) + 1;
            Speech.speak(
              `${sportCourtLabel} ${courtNum} — game time exceeded. Please wrap up.`,
              { language: ttsVoiceRef.current },
            );
            addLog(`TIMER: ${sportCourtLabel} ${courtNum} exceeded ${targetMins} min target.`);
          }
        });
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

  return {
    // Identity state
    isHost,
    setIsHost,
    isEmailHost,
    setIsEmailHost,
    hostNickname,
    setHostNickname,
    club,
    setClub,
    myName,
    setMyName,
    cidRef,

    // Status flags
    isOnline,
    isSavingPlayer,
    setIsSavingPlayer,
    isSavingSettings,
    setIsSavingSettings,
    isProcessingAction,
    setIsProcessingAction,
    isMyTurnBanner,
    setIsMyTurnBanner,

    // Settings live values
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

    // Derived
    isPowerGuest,
    sportEmoji,
    courtLabel,
    playersPerGame,
    sportLabel,

    // Refs exposed
    hasShownStartupRef,
    courtStartTimes,

    // Logging
    logs,
    addLog,

    // Helper functions
    sanitiseName,
    getRoster,
    updateRoster,
    safeEqual,
    sendLocalNotification,
    playChime,
    shareSessionStats,
    exportStats,

    // Core actions
    processRequest,
    sendReq,
    grantPowerGuest,
    // Returns computed queue indices; shell should update selectedQueueIdx and setShowCourts(true)
    handleAutoPick,
    // Takes selectedQueueIdx from shell; shell clears it after call
    assignCourt,
    finishMatch,
    // Takes substituteCourtIdx and substituteOutPlayer from shell
    doSubstitute,
    claimPowerGuest,
    undoLastAction,
  };
}
