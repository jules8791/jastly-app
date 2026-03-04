import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Tournament, TournamentMatch, TournamentTeam } from '../../types';

const makeStyles = (C: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    banner: {
      backgroundColor: C.surface, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    bannerLeft: { flex: 1 },
    bannerTitle: { color: C.primary, fontWeight: 'bold', fontSize: 15 },
    bannerSub: { color: C.gray2, fontSize: 11, marginTop: 2 },
    formatBadge: {
      backgroundColor: C.purple, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 12, marginLeft: 8,
    },
    formatText: { color: C.white, fontSize: 10, fontWeight: 'bold' },
    section: { color: C.primary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1, padding: 14, paddingBottom: 6 },
    row: {
      backgroundColor: C.surface, marginHorizontal: 10, marginBottom: 6,
      borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border,
    },
    teams: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    teamName: { color: C.white, fontWeight: 'bold', fontSize: 13, flex: 1 },
    vsText: { color: C.gray3, fontSize: 11, marginHorizontal: 6 },
    startBtn: {
      backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 6, marginLeft: 8,
    },
    startBtnText: { color: C.bg, fontWeight: 'bold', fontSize: 12 },
    courtBadge: {
      backgroundColor: C.redDark, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 6, marginLeft: 8,
    },
    courtBadgeText: { color: C.white, fontWeight: 'bold', fontSize: 11 },
    winnerText: { color: C.primary, fontWeight: 'bold', fontSize: 12, marginTop: 2 },
    bottomBar: {
      flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.surface, gap: 8,
    },
    standingsBtn: {
      flex: 1, backgroundColor: C.purple, padding: 12, borderRadius: 8, alignItems: 'center',
    },
    autoPickBtn: {
      flex: 1, backgroundColor: C.green, padding: 12, borderRadius: 8, alignItems: 'center',
    },
    endBtn: {
      flex: 1, backgroundColor: C.gray3, padding: 12, borderRadius: 8, alignItems: 'center',
    },
    btnText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
    champBanner: {
      backgroundColor: C.primary, margin: 10, padding: 16, borderRadius: 10, alignItems: 'center',
    },
    champText: { color: C.bg, fontWeight: 'bold', fontSize: 18 },
    champSub: { color: C.bg, fontSize: 12, marginTop: 4, opacity: 0.8 },
    emptyText: { color: C.gray3, textAlign: 'center', padding: 24, fontSize: 13 },
    // Guest score submission banner
    scoreBanner: {
      margin: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.primary,
      backgroundColor: C.selectedBg,
    },
    scoreBannerTitle: { color: C.primary, fontWeight: 'bold', fontSize: 13, marginBottom: 8 },
    scoreInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scoreInput: {
      flex: 1, backgroundColor: C.bg, color: C.white, padding: 10, borderRadius: 6,
      borderWidth: 1, borderColor: C.border, fontSize: 22, fontWeight: 'bold', textAlign: 'center',
    },
    scoreSubmitBtn: {
      backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6,
    },
    scoreSubmitText: { color: C.bg, fontWeight: 'bold', fontSize: 13 },
    pendingTag: { color: C.gray2, fontSize: 11, marginTop: 6 },
  });

interface TournamentPanelProps {
  tournament: Tournament;
  isHost: boolean;
  courtLabel: string;
  courtOccupants: Record<string, { name: string }[]>;
  myName: string;
  onStartMatch: (match: TournamentMatch) => void;
  onViewStandings: () => void;
  onEndTournament: () => void;
  onTeamPress: (team: TournamentTeam) => void;
  onSubmitScore: (matchId: string, score: number) => void;
}

export function TournamentPanel({
  tournament,
  isHost,
  courtLabel,
  courtOccupants,
  myName,
  onStartMatch,
  onViewStandings,
  onEndTournament,
  onTeamPress,
  onSubmitScore,
}: TournamentPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [myScoreInput, setMyScoreInput] = useState('');

  const teamLookup = useMemo(() => {
    const map: Record<string, TournamentTeam> = {};
    tournament.teams.forEach(t => (map[t.id] = t));
    return map;
  }, [tournament.teams]);

  const champion = tournament.champion ? teamLookup[tournament.champion] : null;
  const superChampionName = tournament.format === 'super' && tournament.champion
    ? tournament.champion : null;

  const formatLabel =
    tournament.format === 'round_robin' ? 'ROUND ROBIN'
    : tournament.format === 'knockout' ? 'KNOCKOUT'
    : 'SUPER';

  // Group matches by round
  const rounds = useMemo(() => {
    const map: Record<number, TournamentMatch[]> = {};
    tournament.matches.forEach(m => {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    });
    return map;
  }, [tournament.matches]);

  const roundNums = useMemo(
    () => Object.keys(rounds).map(Number).sort((a, b) => a - b),
    [rounds],
  );

  // Players currently on any court
  const busyPlayerNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(courtOccupants).forEach(players =>
      players.forEach(p => names.add(p.name)),
    );
    return names;
  }, [courtOccupants]);

  // Teams that have at least one player currently on court
  const busyTeamIds = useMemo(() => {
    const busy = new Set<string>();
    tournament.teams.forEach(team => {
      if (team.players.some(name => busyPlayerNames.has(name))) busy.add(team.id);
    });
    return busy;
  }, [tournament.teams, busyPlayerNames]);

  // For Super: current active round = lowest round with any pending match
  const superCurrentRound = useMemo(() => {
    if (tournament.format !== 'super') return null;
    const pendingRound = roundNums.find(r => rounds[r].some(m => m.winnerId === null));
    return pendingRound ?? roundNums[roundNums.length - 1] ?? 1;
  }, [tournament.format, rounds, roundNums]);

  // For Super guests: the active match they're currently playing
  const myActiveMatch = useMemo(() => {
    if (tournament.format !== 'super' || !myName || isHost) return null;
    return tournament.matches.find(m =>
      m.winnerId === null &&
      m.courtIdx !== undefined &&
      [...(m.game1Complete ? (m.game2Team1 ?? []) : (teamLookup[m.team1Id]?.players ?? [])),
       ...(m.game1Complete ? (m.game2Team2 ?? []) : (teamLookup[m.team2Id]?.players ?? []))
      ].includes(myName),
    ) ?? null;
  }, [tournament, myName, isHost, teamLookup]);

  // Has this guest already submitted their score for the active match?
  const myScoreSubmitted = myActiveMatch
    ? myName in (myActiveMatch.pendingScores ?? {})
    : false;

  // Total players expected for the active match
  const myMatchPlayerCount = myActiveMatch
    ? (myActiveMatch.game1Complete
        ? (myActiveMatch.game2Team1?.length ?? 0) + (myActiveMatch.game2Team2?.length ?? 0)
        : (teamLookup[myActiveMatch.team1Id]?.players.length ?? 0) + (teamLookup[myActiveMatch.team2Id]?.players.length ?? 0))
    : 0;

  const pendingCount = myActiveMatch
    ? Object.keys(myActiveMatch.pendingScores ?? {}).length
    : 0;

  // Matches available to auto-pick
  const availableMatches = useMemo(() => {
    const pool =
      tournament.format === 'super'
        ? (rounds[superCurrentRound!] ?? [])
        : tournament.format === 'knockout'
        ? (rounds[tournament.currentKnockoutRound] ?? [])
        : tournament.matches;

    return pool.filter(
      m =>
        m.winnerId === null &&
        m.courtIdx === undefined &&
        !busyTeamIds.has(m.team1Id) &&
        (m.team2Id === '__bye__' || !busyTeamIds.has(m.team2Id)),
    );
  }, [tournament, rounds, superCurrentRound, busyTeamIds]);

  const handleAutoPick = () => {
    const match = availableMatches[0];
    if (!match) { Alert.alert('No games available', 'All teams are either playing or the round is complete.'); return; }
    const t1 = teamLookup[match.team1Id]?.name ?? '?';
    const t2 = match.team2Id === '__bye__' ? 'BYE' : (teamLookup[match.team2Id]?.name ?? '?');
    Alert.alert(
      '⚡ Auto-picked game',
      `${t1}  vs  ${t2}\n\nStart this match now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => onStartMatch(match) },
      ],
    );
  };

  const handleSubmitScore = () => {
    if (!myActiveMatch || !myScoreInput.trim()) return;
    const score = parseInt(myScoreInput, 10);
    if (isNaN(score)) { Alert.alert('Invalid score', 'Enter a number.'); return; }
    onSubmitScore(myActiveMatch.id, score);
    setMyScoreInput('');
  };

  const isMatchVisible = (m: TournamentMatch) => {
    if (m.winnerId !== null) return false;
    if (m.courtIdx !== undefined) return true;
    return !busyTeamIds.has(m.team1Id) && (m.team2Id === '__bye__' || !busyTeamIds.has(m.team2Id));
  };

  const renderMatch = (match: TournamentMatch) => {
    const team1 = teamLookup[match.team1Id];
    const team2 = match.team2Id === '__bye__' ? null : teamLookup[match.team2Id];
    const isInProgress = match.courtIdx !== undefined && match.winnerId === null;
    const submittedCount = Object.keys(match.pendingScores ?? {}).length;
    const totalPlayers = match.game1Complete
      ? (match.game2Team1?.length ?? 0) + (match.game2Team2?.length ?? 0)
      : (team1?.players.length ?? 0) + (team2?.players.length ?? 0);

    return (
      <View key={match.id} style={styles.row}>
        <View style={styles.teams}>
          <TouchableOpacity onPress={() => team1 && onTeamPress(team1)} style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team1?.name ?? '?'}</Text>
          </TouchableOpacity>
          <Text style={styles.vsText}>vs</Text>
          <TouchableOpacity onPress={() => team2 && onTeamPress(team2)} style={{ flex: 1, alignItems: 'flex-end' }}>
            {team2 ? (
              <Text style={[styles.teamName, { textAlign: 'right' }]}>{team2.name}</Text>
            ) : (
              <Text style={[styles.teamName, { textAlign: 'right', color: colors.gray3 }]}>BYE</Text>
            )}
          </TouchableOpacity>

          {!isInProgress && isHost && team2 && (
            <TouchableOpacity style={styles.startBtn} onPress={() => onStartMatch(match)}>
              <Text style={styles.startBtnText}>START ▶</Text>
            </TouchableOpacity>
          )}
          {isInProgress && (
            <View style={styles.courtBadge}>
              <Text style={styles.courtBadgeText}>{courtLabel} {(match.courtIdx ?? 0) + 1}</Text>
            </View>
          )}
        </View>

        {/* Super: game 1 done, waiting for game 2 */}
        {tournament.format === 'super' && match.game1Complete && isInProgress && (
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 11, marginTop: 6 }}>
            GAME 1 DONE — GAME 2 IN PROGRESS (TEAMS SWAPPED)
          </Text>
        )}

        {/* Super: score submission progress (host view) */}
        {tournament.format === 'super' && isHost && isInProgress && submittedCount > 0 && (
          <Text style={styles.pendingTag}>
            📝 {submittedCount}/{totalPlayers} scores submitted
          </Text>
        )}
      </View>
    );
  };

  const renderFixtures = () => {
    if (tournament.format === 'super') {
      const visible = (rounds[superCurrentRound!] ?? []).filter(isMatchVisible);
      return (
        <>
          <Text style={styles.section}>ROUND {superCurrentRound} — AVAILABLE GAMES</Text>
          {visible.length === 0
            ? <Text style={styles.emptyText}>All teams are currently playing</Text>
            : visible.map(renderMatch)}
        </>
      );
    }

    if (tournament.format === 'knockout') {
      return roundNums.map(r => {
        if (r < tournament.currentKnockoutRound) return null;
        const visible = rounds[r].filter(isMatchVisible);
        return (
          <View key={r}>
            <Text style={styles.section}>
              {`ROUND ${r}${r === tournament.currentKnockoutRound ? ' — CURRENT' : ''}`}
            </Text>
            {visible.length === 0
              ? <Text style={styles.emptyText}>All teams are currently playing</Text>
              : visible.map(renderMatch)}
          </View>
        );
      });
    }

    const visible = tournament.matches.filter(isMatchVisible);
    return (
      <>
        <Text style={styles.section}>FIXTURES</Text>
        {visible.length === 0
          ? <Text style={styles.emptyText}>All teams are currently playing</Text>
          : visible.map(renderMatch)}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>
            🏆 TOURNAMENT {tournament.state === 'completed' ? '— FINISHED' : '— IN PROGRESS'}
          </Text>
          <Text style={styles.bannerSub}>
            {tournament.teams.length} teams ·{' '}
            {tournament.format === 'super'
              ? `Round ${superCurrentRound} of ${roundNums.length} · ${availableMatches.length} available`
              : `${tournament.matches.filter(m => m.winnerId !== null).length}/${tournament.matches.length} done · ${availableMatches.length} available`}
          </Text>
        </View>
        <View style={styles.formatBadge}>
          <Text style={styles.formatText}>{formatLabel}</Text>
        </View>
      </View>

      {/* Champion banner */}
      {tournament.state === 'completed' && (
        <View style={styles.champBanner}>
          <Text style={styles.champText}>
            🥇 {superChampionName ?? champion?.name ?? 'Champion'}
          </Text>
          <Text style={styles.champSub}>
            {superChampionName
              ? `${tournament.superPlayerScores?.[superChampionName] ?? 0} total points`
              : champion ? `${champion.wins}W / ${champion.losses}L` : ''}
          </Text>
        </View>
      )}

      {/* Guest score submission — Super only */}
      {myActiveMatch && tournament.format === 'super' && !isHost && (
        <View style={styles.scoreBanner}>
          <Text style={styles.scoreBannerTitle}>
            {myActiveMatch.game1Complete ? '⚡ GAME 2 — Enter your score' : '🎮 GAME 1 — Enter your score'}
          </Text>
          {myScoreSubmitted ? (
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
              ✓ Score submitted ({myActiveMatch.pendingScores![myName]} pts) — waiting for others ({pendingCount}/{myMatchPlayerCount})
            </Text>
          ) : (
            <View style={styles.scoreInputRow}>
              <TextInput
                style={styles.scoreInput}
                placeholder="0"
                placeholderTextColor={colors.gray3}
                keyboardType="numeric"
                maxLength={3}
                value={myScoreInput}
                onChangeText={setMyScoreInput}
              />
              <TouchableOpacity style={styles.scoreSubmitBtn} onPress={handleSubmitScore}>
                <Text style={styles.scoreSubmitText}>SUBMIT</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Fixtures */}
      <ScrollView style={{ flex: 1 }}>
        {renderFixtures()}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.standingsBtn} onPress={onViewStandings}>
          <Text style={styles.btnText}>📊 STANDINGS</Text>
        </TouchableOpacity>
        {isHost && tournament.state !== 'completed' && (
          <TouchableOpacity style={styles.autoPickBtn} onPress={handleAutoPick}>
            <Text style={styles.btnText}>⚡ AUTO</Text>
          </TouchableOpacity>
        )}
        {isHost && (
          <TouchableOpacity style={styles.endBtn} onPress={onEndTournament}>
            <Text style={styles.btnText}>END</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
