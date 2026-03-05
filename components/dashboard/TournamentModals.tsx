import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { ColorSet, useTheme } from '../../contexts/theme-context';
import { QueuePlayer, Tournament, TournamentMatch, TournamentTeam } from '../../types';
import { autoFormTeams, computeGame2Teams, generateKnockoutRound, generateRoundRobinFixtures, isMixedTeam } from '../../utils/tournament';

const makeStyles = (C: ColorSet) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: 'center', padding: 20, zIndex: 10 },
    card: { backgroundColor: C.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    title: { color: C.primary, fontWeight: 'bold', textAlign: 'center', fontSize: 16, marginBottom: 14 },
    sub: { color: C.gray2, textAlign: 'center', fontSize: 13, marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
    label: { color: C.white, fontWeight: 'bold' },
    sublabel: { color: C.gray3, fontSize: 11, marginTop: 2 },
    mathBtn: { backgroundColor: C.border, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
    mathVal: { color: C.primary, fontWeight: 'bold', fontSize: 22, marginHorizontal: 20 },
    fmtBtn: {
      flex: 1, marginHorizontal: 4, paddingVertical: 12, borderRadius: 8,
      borderWidth: 1, borderColor: C.border, alignItems: 'center',
    },
    fmtBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    fmtBtnText: { color: C.gray2, fontWeight: 'bold', fontSize: 12 },
    fmtBtnTextActive: { color: C.bg },
    btnPrimary: { backgroundColor: C.purple, padding: 14, borderRadius: 8 },
    btnText: { color: C.white, fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
    btnSecondary: { marginTop: 12 },
    btnSecondaryText: { color: C.gray1, textAlign: 'center' },
    sectionHeader: { color: C.primary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
    teamCard: {
      backgroundColor: C.bg, borderRadius: 8, padding: 12, marginBottom: 8,
      borderWidth: 1, borderColor: C.border,
    },
    teamCardTitle: { color: C.primary, fontWeight: 'bold', fontSize: 14, marginBottom: 6 },
    playerChip: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 4,
      borderWidth: 1, borderColor: C.border,
    },
    playerName: { color: C.white, fontSize: 12 },
    swapBtn: { color: C.primary, fontSize: 11, marginLeft: 6 },
    dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 6 },
    dot: { height: 8, borderRadius: 4, backgroundColor: C.border },
    dotActive: { width: 20, backgroundColor: C.primary },
    dotDone: { width: 8, backgroundColor: C.primary },
    scoreInput: {
      backgroundColor: C.bg, color: C.white, padding: 10, borderRadius: 6,
      borderWidth: 1, borderColor: C.border, textAlign: 'center', fontSize: 20, fontWeight: 'bold', flex: 1,
    },
    teamBlock: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border },
    teamBlockTitle: { color: C.primary, fontWeight: 'bold', fontSize: 13, marginBottom: 4, textAlign: 'center' },
    playerScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    playerScoreName: { flex: 1, color: C.white, fontSize: 13 },
    tblRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
    tblHeader: { color: C.gray2, fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
    tblCell: { color: C.white, textAlign: 'center', fontSize: 13 },
    tblName: { color: C.white, fontWeight: 'bold', fontSize: 13, flex: 3 },
    winnerHighlight: { color: C.primary },
    detailFixture: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
    infoBanner: {
      backgroundColor: C.selectedBg, borderRadius: 8, padding: 10, marginBottom: 14,
    },
    infoText: { color: C.gray2, fontSize: 12, textAlign: 'center' },
  });

// ─── Step Dots ────────────────────────────────────────────────────────────────
function StepDots({ step, total, colors, styles }: { step: number; total: number; colors: any; styles: any }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 === step ? styles.dotActive : i + 1 < step ? styles.dotDone : {},
          ]}
        />
      ))}
    </View>
  );
}

// ─── TournamentSetupModal ─────────────────────────────────────────────────────
export interface TournamentSetupModalProps {
  visible: boolean;
  waitingList: QueuePlayer[];
  defaultTeamSize: number;
  onStart: (tournament: Tournament) => void;
  onClose: () => void;
}

export function TournamentSetupModal({
  visible,
  waitingList,
  defaultTeamSize,
  onStart,
  onClose,
}: TournamentSetupModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<'round_robin' | 'knockout' | 'super'>('round_robin');
  const [teamSize, setTeamSize] = useState(defaultTeamSize);
  const [rounds, setRounds] = useState(1);
  const [genderBalanced, setGenderBalanced] = useState(false);
  const [swapTeams, setSwapTeams] = useState(true);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [latePlayerName, setLatePlayerName] = useState('');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setFormat('round_robin');
      setTeamSize(defaultTeamSize);
      setRounds(1);
      setGenderBalanced(false);
      setSwapTeams(true);
      setTeams([]);
      setUnassigned([]);
      setSelectedPlayer(null);
      setShowAddPlayer(false);
      setLatePlayerName('');
    }
  }, [visible]);

  const handleGoToStep2 = () => {
    const numTeams = Math.max(2, Math.floor(waitingList.length / teamSize));
    const emptyTeams: TournamentTeam[] = Array.from({ length: numTeams }, (_, i) => ({
      id: `t${i}`, name: `Team ${i + 1}`,
      players: [], wins: 0, losses: 0, draws: 0, points: 0, matchesPlayed: 0,
    }));
    setTeams(emptyTeams);
    setUnassigned(waitingList.map(p => p.name));
    setSelectedPlayer(null);
    setStep(2);
  };

  const handleAutoPick = () => {
    const allNames = [...unassigned, ...teams.flatMap(t => t.players)];
    const allPlayers = allNames.map(
      name => waitingList.find(p => p.name === name) ?? { name, gender: 'M' as const },
    );
    const formed = autoFormTeams(allPlayers, teamSize, genderBalanced);
    setTeams(formed);
    const placed = new Set(formed.flatMap(t => t.players));
    setUnassigned(allNames.filter(n => !placed.has(n)));
    setSelectedPlayer(null);
  };

  const assignToTeam = (teamIdx: number) => {
    if (!selectedPlayer) return;
    const name = selectedPlayer;
    setTeams(prev => prev.map((t, i) =>
      i === teamIdx ? { ...t, players: [...t.players, name] } : t,
    ));
    setUnassigned(prev => prev.filter(n => n !== name));
    setSelectedPlayer(null);
  };

  const removeFromTeam = (teamIdx: number, name: string) => {
    setTeams(prev => prev.map((t, i) =>
      i === teamIdx ? { ...t, players: t.players.filter(n => n !== name) } : t,
    ));
    setUnassigned(prev => [...prev, name]);
  };

  const addTeam = () => {
    const idx = teams.length;
    setTeams(prev => [...prev, {
      id: `t${idx}`, name: `Team ${idx + 1}`,
      players: [], wins: 0, losses: 0, draws: 0, points: 0, matchesPlayed: 0,
    }]);
  };

  const addLatePlayer = () => {
    const clean = latePlayerName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);
    if (clean && !unassigned.includes(clean) && !teams.some(t => t.players.includes(clean))) {
      setUnassigned(prev => [...prev, clean]);
    }
    setLatePlayerName('');
    setShowAddPlayer(false);
  };

  const handleStart = () => {
    const validTeams = teams.filter(t => t.players.length > 0);
    const id = Date.now().toString(36);
    let matches: TournamentMatch[];
    if (format === 'round_robin' || format === 'super') {
      matches = generateRoundRobinFixtures(validTeams, rounds);
    } else {
      matches = generateKnockoutRound(validTeams, 1);
    }
    const tournament: Tournament = {
      id, format, teamSize, rounds,
      genderBalancedTeams: genderBalanced,
      swapTeams: format === 'super' ? swapTeams : undefined,
      state: 'in_progress',
      teams: validTeams,
      matches,
      currentKnockoutRound: 1,
      createdAt: new Date().toISOString(),
    };
    onStart(tournament);
  };

  const notEnoughPlayers = waitingList.length < teamSize * 2;
  const canStart = teams.filter(t => t.players.length > 0).length >= 2;

  const renderStep1 = () => (
    <>
      <Text style={styles.title}>🏆 START TOURNAMENT</Text>
      <StepDots step={1} total={2} colors={colors} styles={styles} />

      <Text style={styles.sectionHeader}>FORMAT</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        {(['round_robin', 'knockout', 'super'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.fmtBtn, format === f && styles.fmtBtnActive]}
            onPress={() => setFormat(f)}
          >
            <Text style={[styles.fmtBtnText, format === f && styles.fmtBtnTextActive]}>
              {f === 'round_robin' ? 'ROUND\nROBIN' : f === 'knockout' ? 'KNOCK\nOUT' : 'SUPER\nTOURN.'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {format === 'super' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            2 mini-games per fixture. Individual points build the league table.
          </Text>
        </View>
      )}

      <Text style={styles.sectionHeader}>TEAM SIZE</Text>
      <View style={[styles.row, { justifyContent: 'center' }]}>
        <TouchableOpacity style={styles.mathBtn} onPress={() => setTeamSize(Math.max(2, teamSize - 1))}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>-</Text>
        </TouchableOpacity>
        <Text style={styles.mathVal}>{teamSize}</Text>
        <TouchableOpacity style={styles.mathBtn} onPress={() => setTeamSize(Math.min(6, teamSize + 1))}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginBottom: 6 }}>
        {Math.floor(waitingList.length / teamSize)} teams from {waitingList.length} players
        {waitingList.length % teamSize > 0 ? ` (${waitingList.length % teamSize} left over)` : ''}
      </Text>

      {format !== 'knockout' && (
        <>
          <Text style={styles.sectionHeader}>ROUNDS</Text>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            <TouchableOpacity style={styles.mathBtn} onPress={() => setRounds(Math.max(1, rounds - 1))}>
              <Text style={{ color: colors.white, fontWeight: 'bold' }}>-</Text>
            </TouchableOpacity>
            <Text style={styles.mathVal}>{rounds}</Text>
            <TouchableOpacity style={styles.mathBtn} onPress={() => setRounds(Math.min(3, rounds + 1))}>
              <Text style={{ color: colors.white, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginBottom: 6 }}>
            {format === 'super'
              ? `Each pair plays ${rounds} fixture${rounds > 1 ? 's' : ''} (${rounds * 2} mini-games)`
              : `Each pair plays ${rounds} time${rounds > 1 ? 's' : ''}`}
          </Text>
        </>
      )}

      <Text style={styles.sectionHeader}>OPTIONS</Text>
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.label}>Gender Balanced Teams</Text>
          <Text style={styles.sublabel}>Prefer equal M/F in each team (falls back to same-sex if needed)</Text>
        </View>
        <Switch
          value={genderBalanced}
          onValueChange={setGenderBalanced}
          thumbColor={genderBalanced ? colors.primary : colors.gray3}
          trackColor={{ true: colors.purple, false: colors.border }}
        />
      </View>
      {format === 'super' && (
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>Swap Partners at Half Time</Text>
            <Text style={styles.sublabel}>Players switch team-mates after game 1. Off = same pairs both games.</Text>
          </View>
          <Switch
            value={swapTeams}
            onValueChange={setSwapTeams}
            thumbColor={swapTeams ? colors.primary : colors.gray3}
            trackColor={{ true: colors.purple, false: colors.border }}
          />
        </View>
      )}


      {notEnoughPlayers && (
        <Text style={{ color: colors.red, textAlign: 'center', fontSize: 12, marginTop: 10 }}>
          Need at least {teamSize * 2} players in queue for 2 teams. ({waitingList.length} available)
        </Text>
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 20, opacity: notEnoughPlayers ? 0.4 : 1 }]}
        disabled={notEnoughPlayers}
        onPress={handleGoToStep2}
      >
        <Text style={styles.btnText}>NEXT: BUILD TEAMS →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
        <Text style={styles.btnSecondaryText}>CANCEL</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.title}>👥 BUILD TEAMS</Text>
      <StepDots step={2} total={2} colors={colors} styles={styles} />

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[styles.btnPrimary, { flex: 1, padding: 10 }]} onPress={handleAutoPick}>
          <Text style={[styles.btnText, { fontSize: 12 }]}>⚡ AUTOPICK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, { flex: 1, padding: 10, backgroundColor: colors.green }]}
          onPress={() => setShowAddPlayer(v => !v)}
        >
          <Text style={[styles.btnText, { fontSize: 12 }]}>+ ADD PLAYER</Text>
        </TouchableOpacity>
      </View>

      {/* Late player input */}
      {showAddPlayer && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput
            style={[styles.scoreInput, { flex: 1, fontSize: 14, textAlign: 'left', padding: 10 }]}
            placeholder="Player name..."
            placeholderTextColor={colors.gray3}
            value={latePlayerName}
            onChangeText={setLatePlayerName}
            autoCapitalize="characters"
            maxLength={20}
            onSubmitEditing={addLatePlayer}
          />
          <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 14 }]} onPress={addLatePlayer}>
            <Text style={styles.btnText}>ADD</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>
            UNASSIGNED ({unassigned.length}){selectedPlayer ? ` — tap a team to place ${selectedPlayer}` : ' — tap to select'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
            {unassigned.map(name => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.playerChip,
                  selectedPlayer === name && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedPlayer(selectedPlayer === name ? null : name)}
              >
                <Text style={[styles.playerName, selectedPlayer === name && { color: colors.bg }]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Teams */}
      <Text style={styles.sectionHeader}>TEAMS</Text>
      <ScrollView style={{ maxHeight: 300 }}>
        {teams.map((team, ti) => (
          <View key={team.id} style={styles.teamCard}>
            <Text style={styles.teamCardTitle}>{team.name} ({team.players.length})</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {team.players.map(name => (
                <TouchableOpacity
                  key={name}
                  style={styles.playerChip}
                  onPress={() => removeFromTeam(ti, name)}
                >
                  <Text style={styles.playerName}>{name}</Text>
                  <Text style={styles.swapBtn}>✕</Text>
                </TouchableOpacity>
              ))}
              {selectedPlayer && (
                <TouchableOpacity
                  style={[styles.playerChip, { backgroundColor: colors.green, borderColor: colors.green }]}
                  onPress={() => assignToTeam(ti)}
                >
                  <Text style={[styles.playerName, { color: colors.bg }]}>+ {selectedPlayer}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.border, marginBottom: 4 }]}
          onPress={addTeam}
        >
          <Text style={styles.btnText}>+ ADD TEAM</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 14, opacity: canStart ? 1 : 0.4 }]}
        disabled={!canStart}
        onPress={handleStart}
      >
        <Text style={styles.btnText}>🏆 START TOURNAMENT</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
        <Text style={styles.btnSecondaryText}>← BACK</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <ScrollView>
          <View style={[styles.card, { marginVertical: 20 }]}>
            {step === 1 ? renderStep1() : renderStep2()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── TournamentResultModal ────────────────────────────────────────────────────
export interface TournamentResultModalProps {
  visible: boolean;
  match: TournamentMatch | null;
  teams: TournamentTeam[];
  format: 'round_robin' | 'knockout' | 'super';
  /** Combined roster for gender lookup (originalQueue + waiting_list) */
  roster: QueuePlayer[];
  swapTeams?: boolean;
  onConfirmStandard: (winnerId: string, scoreA?: number, scoreB?: number) => void;
  /** Super mode: combined per-player scores across both games */
  onConfirmSuper: (scores: Record<string, number>) => void;
  onCancel: () => void;
}

export function TournamentResultModal({
  visible,
  match,
  teams,
  format,
  roster,
  swapTeams = true,
  onConfirmStandard,
  onConfirmSuper,
  onCancel,
}: TournamentResultModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [playerScores, setPlayerScores] = useState<Record<string, string>>({});

  const teamLookup = useMemo(() => {
    const m: Record<string, TournamentTeam> = {};
    teams.forEach(t => (m[t.id] = t));
    return m;
  }, [teams]);

  const team1 = match ? teamLookup[match.team1Id] : null;
  const team2 = match && match.team2Id !== '__bye__' ? teamLookup[match.team2Id] : null;

  // Compute game 2 team compositions (swap) for display
  const { game2Team1, game2Team2 } = useMemo(() => {
    if (format !== 'super' || !swapTeams || !team1 || !team2) {
      return { game2Team1: team1?.players ?? [], game2Team2: team2?.players ?? [] };
    }
    const mixed = isMixedTeam(team1.players, roster);
    return computeGame2Teams(team1.players, team2.players, roster, mixed);
  }, [format, swapTeams, team1, team2, roster]);

  useEffect(() => {
    if (visible) {
      setSelectedWinner(null);
      setScoreA('');
      setScoreB('');
      setPlayerScores({});
    }
  }, [visible, match?.id]);

  // All 4 players for combined score entry
  const allPlayers: string[] = useMemo(() => {
    if (format !== 'super' || !team1 || !team2) return [];
    return [...team1.players, ...team2.players];
  }, [format, team1, team2]);

  const canConfirmSuper = allPlayers.every(
    name => playerScores[name] !== undefined && playerScores[name].trim() !== '',
  );

  if (!match || (!team1 && format !== 'super')) return null;

  // ── Super mode ──
  if (format === 'super') {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <ScrollView>
            <View style={[styles.card, { marginVertical: 20 }]}>
              <Text style={styles.title}>🏆 SUPER MATCH RESULT</Text>
              <Text style={styles.sub}>Enter each player's combined points across both games</Text>

              {/* Game compositions info */}
              <View style={styles.infoBanner}>
                <Text style={[styles.infoText, { fontWeight: 'bold', marginBottom: 4 }]}>
                  GAME 1 — {team1?.name} vs {team2?.name}
                </Text>
                <Text style={styles.infoText}>
                  {team1?.players.join(', ')}  ·  {team2?.players.join(', ')}
                </Text>
                {swapTeams && (
                  <>
                    <Text style={[styles.infoText, { fontWeight: 'bold', marginTop: 8, marginBottom: 4 }]}>
                      GAME 2 — TEAMS SWAPPED
                    </Text>
                    <Text style={styles.infoText}>
                      {game2Team1.join(', ')}  ·  {game2Team2.join(', ')}
                    </Text>
                  </>
                )}
              </View>

              {/* Combined score entry — each player */}
              <Text style={styles.sectionHeader}>{team1?.name} PLAYERS</Text>
              {team1?.players.map(name => (
                <View key={name} style={[styles.playerScoreRow, { marginBottom: 10 }]}>
                  <Text style={[styles.playerScoreName, { fontSize: 14 }]}>{name}</Text>
                  <TextInput
                    style={[styles.scoreInput, { width: 72, flex: undefined }]}
                    placeholder="pts"
                    placeholderTextColor={colors.gray3}
                    keyboardType="numeric"
                    maxLength={3}
                    value={playerScores[name] ?? ''}
                    onChangeText={v => setPlayerScores(prev => ({ ...prev, [name]: v }))}
                  />
                </View>
              ))}

              <Text style={styles.sectionHeader}>{team2?.name} PLAYERS</Text>
              {team2?.players.map(name => (
                <View key={name} style={[styles.playerScoreRow, { marginBottom: 10 }]}>
                  <Text style={[styles.playerScoreName, { fontSize: 14 }]}>{name}</Text>
                  <TextInput
                    style={[styles.scoreInput, { width: 72, flex: undefined }]}
                    placeholder="pts"
                    placeholderTextColor={colors.gray3}
                    keyboardType="numeric"
                    maxLength={3}
                    value={playerScores[name] ?? ''}
                    onChangeText={v => setPlayerScores(prev => ({ ...prev, [name]: v }))}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 8, opacity: canConfirmSuper ? 1 : 0.4 }]}
                disabled={!canConfirmSuper}
                onPress={() => {
                  const scores: Record<string, number> = {};
                  allPlayers.forEach(name => {
                    scores[name] = parseInt(playerScores[name] ?? '0', 10) || 0;
                  });
                  onConfirmSuper(scores);
                }}
              >
                <Text style={styles.btnText}>✓ CONFIRM — FINISH MATCH</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={onCancel}>
                <Text style={styles.btnSecondaryText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ── Standard mode ──
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>WHO WON?</Text>

          {/* Team context rows */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.gray3, fontSize: 10, textAlign: 'center' }}>
                {team1?.players.join(', ')}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.gray3, fontSize: 10, textAlign: 'center' }}>
                {team2?.players.join(', ')}
              </Text>
            </View>
          </View>

          {/* Winner selection — team names only */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[
              { id: team1?.id ?? '', label: team1?.name ?? '' },
              ...(format === 'round_robin'
                ? [{ id: '__draw__', label: 'DRAW' }]
                : []),
              { id: team2?.id ?? '', label: team2?.name ?? '' },
            ].map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.fmtBtn,
                  selectedWinner === option.id && styles.fmtBtnActive,
                  { paddingVertical: 20 },
                ]}
                onPress={() => setSelectedWinner(option.id)}
              >
                <Text style={[styles.fmtBtnText, selectedWinner === option.id && styles.fmtBtnTextActive, { textAlign: 'center', fontSize: 14 }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional score */}
          <Text style={{ color: colors.gray2, fontSize: 12, textAlign: 'center', marginBottom: 8, letterSpacing: 1 }}>
            SCORE (OPTIONAL)
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.gray3, fontSize: 10, marginBottom: 4 }}>{team1?.name}</Text>
              <TextInput
                style={styles.scoreInput}
                placeholder="—"
                placeholderTextColor={colors.gray3}
                keyboardType="numeric"
                maxLength={3}
                value={scoreA}
                onChangeText={setScoreA}
              />
            </View>
            <Text style={{ color: colors.gray2, fontWeight: 'bold', fontSize: 18, paddingBottom: 18 }}>–</Text>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.gray3, fontSize: 10, marginBottom: 4 }}>{team2?.name}</Text>
              <TextInput
                style={styles.scoreInput}
                placeholder="—"
                placeholderTextColor={colors.gray3}
                keyboardType="numeric"
                maxLength={3}
                value={scoreB}
                onChangeText={setScoreB}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, { opacity: selectedWinner ? 1 : 0.4 }]}
            disabled={!selectedWinner}
            onPress={() =>
              onConfirmStandard(
                selectedWinner!,
                scoreA ? parseInt(scoreA, 10) : undefined,
                scoreB ? parseInt(scoreB, 10) : undefined,
              )
            }
          >
            <Text style={styles.btnText}>✓ CONFIRM RESULT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onCancel}>
            <Text style={styles.btnSecondaryText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── TournamentStandingsModal ─────────────────────────────────────────────────
export interface TournamentStandingsModalProps {
  visible: boolean;
  tournament: Tournament;
  onClose: () => void;
}

export function TournamentStandingsModal({
  visible,
  tournament,
  onClose,
}: TournamentStandingsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const teamLookup = useMemo(() => {
    const m: Record<string, TournamentTeam> = {};
    tournament.teams.forEach(t => (m[t.id] = t));
    return m;
  }, [tournament.teams]);

  const sortedTeams = useMemo(
    () => [...tournament.teams].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)),
    [tournament.teams],
  );

  const superSorted = useMemo(() => {
    if (tournament.format !== 'super' || !tournament.superPlayerScores) return [];
    return Object.entries(tournament.superPlayerScores)
      .sort(([, a], [, b]) => b - a)
      .map(([name, pts]) => ({
        name,
        pts,
        team: tournament.teams.find(t => t.players.includes(name))?.name ?? '',
      }));
  }, [tournament]);

  const renderKnockout = () => {
    const rounds = Array.from(new Set(tournament.matches.map(m => m.round))).sort((a, b) => a - b);
    return rounds.map(r => {
      const rMatches = tournament.matches.filter(m => m.round === r);
      return (
        <View key={r}>
          <Text style={styles.sectionHeader}>ROUND {r}</Text>
          {rMatches.map(m => {
            const t1 = teamLookup[m.team1Id];
            const t2 = m.team2Id === '__bye__' ? null : teamLookup[m.team2Id];
            const winner = m.winnerId && m.winnerId !== '__bye__' ? teamLookup[m.winnerId] : null;
            return (
              <View key={m.id} style={styles.detailFixture}>
                <Text style={{ color: colors.white, fontSize: 13 }}>
                  <Text style={winner?.id === t1?.id ? styles.winnerHighlight : {}}>{t1?.name}</Text>
                  {' vs '}
                  <Text style={winner?.id === t2?.id ? styles.winnerHighlight : {}}>{t2?.name ?? 'BYE'}</Text>
                </Text>
                {winner && <Text style={{ color: colors.gray3, fontSize: 11 }}>✓ {winner.name} won</Text>}
                {!m.winnerId && <Text style={{ color: colors.gray3, fontSize: 11 }}>Pending</Text>}
              </View>
            );
          })}
        </View>
      );
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.card, { maxHeight: '85%' }]}>
          <Text style={styles.title}>
            {tournament.format === 'super' ? '🏆 SUPER LEADERBOARD' : '📊 STANDINGS'}
          </Text>

          {tournament.state === 'completed' && (
            <View style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 12, marginBottom: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 16 }}>
                🥇 {tournament.format === 'super'
                  ? `${tournament.champion} — ${tournament.superPlayerScores?.[tournament.champion!] ?? 0} pts`
                  : `${teamLookup[tournament.champion!]?.name} wins!`}
              </Text>
            </View>
          )}

          <ScrollView>
            {tournament.format === 'round_robin' && (
              <>
                <View style={[styles.tblRow, { borderBottomWidth: 2, borderBottomColor: colors.border }]}>
                  <Text style={[styles.tblName, styles.tblHeader]}>TEAM</Text>
                  {['P', 'W', 'D', 'L', 'PTS'].map(h => (
                    <Text key={h} style={[styles.tblCell, styles.tblHeader, { flex: 1 }]}>{h}</Text>
                  ))}
                </View>
                {sortedTeams.map((team, i) => (
                  <View key={team.id} style={styles.tblRow}>
                    <Text style={[styles.tblName, i === 0 && tournament.state === 'completed' ? styles.winnerHighlight : {}]}>
                      {i === 0 && tournament.state === 'completed' ? '🥇 ' : `${i + 1}. `}{team.name}
                    </Text>
                    {[team.matchesPlayed, team.wins, team.draws, team.losses, team.points].map((v, j) => (
                      <Text key={j} style={[styles.tblCell, { flex: 1 }, j === 4 ? { color: colors.primary, fontWeight: 'bold' } : {}]}>
                        {v}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            )}

            {tournament.format === 'knockout' && renderKnockout()}

            {tournament.format === 'super' && (
              <>
                <View style={[styles.tblRow, { borderBottomWidth: 2, borderBottomColor: colors.border }]}>
                  <Text style={[styles.tblName, styles.tblHeader]}>PLAYER</Text>
                  <Text style={[styles.tblHeader, { flex: 1.5, textAlign: 'center' }]}>TEAM</Text>
                  <Text style={[styles.tblHeader, { flex: 1, textAlign: 'center' }]}>PTS</Text>
                </View>
                {superSorted.map(({ name, pts, team }, i) => (
                  <View key={name} style={styles.tblRow}>
                    <Text style={[styles.tblName, i === 0 && tournament.state === 'completed' ? styles.winnerHighlight : {}]}>
                      {i === 0 && tournament.state === 'completed' ? '🥇 ' : `${i + 1}. `}{name}
                    </Text>
                    <Text style={[styles.tblCell, { flex: 1.5, color: colors.gray3 }]}>{team}</Text>
                    <Text style={[styles.tblCell, { flex: 1, color: colors.primary, fontWeight: 'bold' }]}>{pts}</Text>
                  </View>
                ))}
                {superSorted.length === 0 && (
                  <Text style={{ color: colors.gray3, textAlign: 'center', padding: 20 }}>
                    No scores recorded yet.
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 16, backgroundColor: colors.gray3 }]}
            onPress={onClose}
          >
            <Text style={styles.btnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── TeamDetailModal ──────────────────────────────────────────────────────────
export interface TeamDetailModalProps {
  visible: boolean;
  team: TournamentTeam | null;
  tournament: Tournament;
  onClose: () => void;
}

export function TeamDetailModal({
  visible,
  team,
  tournament,
  onClose,
}: TeamDetailModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const teamLookup = useMemo(() => {
    const m: Record<string, TournamentTeam> = {};
    tournament.teams.forEach(t => (m[t.id] = t));
    return m;
  }, [tournament.teams]);

  const myMatches = useMemo(() => {
    if (!team) return { pending: [], done: [] };
    const all = tournament.matches.filter(
      m => m.team1Id === team.id || m.team2Id === team.id,
    );
    return {
      pending: all.filter(m => m.winnerId === null),
      done: all.filter(m => m.winnerId !== null),
    };
  }, [team, tournament.matches]);

  if (!team) return null;

  const getOpponent = (m: TournamentMatch) => {
    const oppId = m.team1Id === team.id ? m.team2Id : m.team1Id;
    return oppId === '__bye__' ? null : teamLookup[oppId];
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.card, { maxHeight: '80%' }]}>
          <Text style={styles.title}>{team.name}</Text>
          <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 12 }}>
            {team.players.join(' · ')}
          </Text>

          {tournament.format !== 'super' && (
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 12 }}>
              {team.wins}W  {team.draws}D  {team.losses}L  —  {team.points} pts
            </Text>
          )}

          <ScrollView style={{ maxHeight: 320 }}>
            {myMatches.pending.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>UPCOMING FIXTURES</Text>
                {myMatches.pending.map(m => {
                  const opp = getOpponent(m);
                  return (
                    <View key={m.id} style={styles.detailFixture}>
                      <Text style={{ color: colors.white }}>
                        vs <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{opp?.name ?? 'BYE'}</Text>
                      </Text>
                      {opp && (
                        <Text style={{ color: colors.gray3, fontSize: 11 }}>
                          {opp.players.join(', ')}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {myMatches.done.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>PAST RESULTS</Text>
                {myMatches.done.map(m => {
                  const opp = getOpponent(m);
                  const won = m.winnerId === team.id;
                  const draw = m.winnerId === '__draw__';
                  const bye = m.winnerId === '__bye__';
                  return (
                    <View key={m.id} style={styles.detailFixture}>
                      <Text style={{ color: colors.white }}>
                        vs {opp?.name ?? 'BYE'}
                        {'  '}
                        <Text style={{ color: bye || draw ? colors.gray2 : won ? colors.green : colors.red, fontWeight: 'bold' }}>
                          {bye ? 'BYE' : draw ? 'DRAW' : won ? 'WON' : 'LOST'}
                        </Text>
                      </Text>
                      {(m.scoreA !== undefined || m.scoreB !== undefined) && (
                        <Text style={{ color: colors.gray3, fontSize: 11 }}>
                          {m.team1Id === team.id ? m.scoreA : m.scoreB} – {m.team1Id === team.id ? m.scoreB : m.scoreA}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 16, backgroundColor: colors.gray3 }]}
            onPress={onClose}
          >
            <Text style={styles.btnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
