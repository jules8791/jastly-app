import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Tournament, TournamentMatch, TournamentTeam } from '../../types';
import { matchPartnershipScore } from '../../utils/tournament';

const makeStyles = (C: any) =>
  StyleSheet.create({
    container: { backgroundColor: C.bg },
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
    confirmBar: {
      flexDirection: 'row', padding: 12, backgroundColor: C.surface,
      borderTopWidth: 1, borderTopColor: C.border, gap: 8, alignItems: 'center',
    },
    confirmText: { flex: 1, color: C.white, fontWeight: 'bold', fontSize: 13 },
    confirmYesBtn: {
      backgroundColor: C.redDark, paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 8, alignItems: 'center',
    },
    confirmNoBtn: {
      backgroundColor: C.border, paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 8, alignItems: 'center',
    },
    confirmBtnText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
    autoConfirmBar: {
      margin: 10, padding: 12, backgroundColor: C.surface, borderRadius: 8,
      borderWidth: 1, borderColor: C.primary, gap: 8,
    },
    autoConfirmTitle: { color: C.primary, fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
    autoConfirmMatch: { color: C.white, fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    autoConfirmRow: { flexDirection: 'row', gap: 8 },
    autoConfirmYes: {
      flex: 1, backgroundColor: C.green, padding: 10, borderRadius: 8, alignItems: 'center',
    },
    autoConfirmNo: {
      flex: 1, backgroundColor: C.border, padding: 10, borderRadius: 8, alignItems: 'center',
    },
    btnText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
    champBanner: {
      backgroundColor: C.primary, margin: 10, padding: 16, borderRadius: 10, alignItems: 'center',
    },
    champText: { color: C.bg, fontWeight: 'bold', fontSize: 18 },
    champSub: { color: C.bg, fontSize: 12, marginTop: 4, opacity: 0.8 },
    emptyText: { color: C.gray3, textAlign: 'center', padding: 24, fontSize: 13 },
  });

interface TournamentPanelProps {
  tournament: Tournament;
  isHost: boolean;
  courtLabel: string;
  courtOccupants: Record<string, { name: string }[]>;
  onStartMatch: (match: TournamentMatch) => void;
  onViewStandings: () => void;
  onEndTournament: () => void;
  onTeamPress: (team: TournamentTeam) => void;
}

export function TournamentPanel({
  tournament,
  isHost,
  courtLabel,
  courtOccupants,
  onStartMatch,
  onViewStandings,
  onEndTournament,
  onTeamPress,
}: TournamentPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<TournamentMatch | null>(null);

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

  // Matches available to auto-pick, sorted by partnership score (fewest repeat partners first)
  const availableMatches = useMemo(() => {
    const pool =
      tournament.format === 'super'
        ? (rounds[superCurrentRound!] ?? [])
        : tournament.format === 'knockout'
        ? (rounds[tournament.currentKnockoutRound] ?? [])
        : tournament.matches;

    const pending = pool.filter(
      m =>
        m.winnerId === null &&
        m.courtIdx == null &&
        !busyTeamIds.has(m.team1Id) &&
        (m.team2Id === '__bye__' || !busyTeamIds.has(m.team2Id)),
    );

    if (tournament.format === 'super' && tournament.partnerships?.length) {
      return [...pending].sort(
        (a, b) =>
          matchPartnershipScore(a, tournament.teams, tournament.partnerships!) -
          matchPartnershipScore(b, tournament.teams, tournament.partnerships!),
      );
    }
    return pending;
  }, [tournament, rounds, superCurrentRound, busyTeamIds]);

  const handleAutoPick = () => {
    const match = availableMatches[0];
    if (!match) {
      setPendingMatch(null);
      // Show "no available" inline — just don't set a pending match, nothing to confirm
      return;
    }
    setPendingMatch(match);
    setConfirmEnd(false);
  };

  const isMatchVisible = (m: TournamentMatch) => {
    if (m.winnerId !== null) return false;
    if (m.courtIdx != null) return true;
    return !busyTeamIds.has(m.team1Id) && (m.team2Id === '__bye__' || !busyTeamIds.has(m.team2Id));
  };

  const renderMatch = (match: TournamentMatch) => {
    const team1 = teamLookup[match.team1Id];
    const team2 = match.team2Id === '__bye__' ? null : teamLookup[match.team2Id];
    const isInProgress = match.courtIdx != null && match.winnerId === null;

    return (
      <View key={match.id} style={styles.row}>
        <View style={styles.teams}>
          <Pressable onPress={() => team1 && onTeamPress(team1)} style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team1?.name ?? '?'}</Text>
          </Pressable>
          <Text style={styles.vsText}>vs</Text>
          <Pressable onPress={() => team2 && onTeamPress(team2)} style={{ flex: 1, alignItems: 'flex-end' }}>
            {team2 ? (
              <Text style={[styles.teamName, { textAlign: 'right' }]}>{team2.name}</Text>
            ) : (
              <Text style={[styles.teamName, { textAlign: 'right', color: colors.gray3 }]}>BYE</Text>
            )}
          </Pressable>

          {!isInProgress && isHost && team2 && (
            <Pressable style={styles.startBtn} onPress={() => onStartMatch(match)}>
              <Text style={styles.startBtnText}>START</Text>
            </Pressable>
          )}
          {isInProgress && (
            <View style={styles.courtBadge}>
              <Text style={styles.courtBadgeText}>{courtLabel} {(match.courtIdx ?? 0) + 1}</Text>
            </View>
          )}
        </View>
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

  const t1Name = pendingMatch ? (teamLookup[pendingMatch.team1Id]?.name ?? '?') : '';
  const t2Name = pendingMatch
    ? (pendingMatch.team2Id === '__bye__' ? 'BYE' : (teamLookup[pendingMatch.team2Id]?.name ?? '?'))
    : '';

  return (
    <View style={styles.container}>
      {/* Header banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>
            TOURNAMENT {tournament.state === 'completed' ? '— FINISHED' : '— IN PROGRESS'}
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
            {superChampionName ?? champion?.name ?? 'Champion'}
          </Text>
          <Text style={styles.champSub}>
            {superChampionName
              ? `${tournament.superPlayerScores?.[superChampionName] ?? 0} total points`
              : champion ? `${champion.wins}W / ${champion.losses}L` : ''}
          </Text>
        </View>
      )}

      {/* Action bar */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.standingsBtn} onPress={onViewStandings}>
          <Text style={styles.btnText}>STANDINGS</Text>
        </Pressable>
        {isHost && tournament.state !== 'completed' && (
          <Pressable
            style={styles.autoPickBtn}
            onPress={() => {
              setConfirmEnd(false);
              handleAutoPick();
            }}
          >
            <Text style={styles.btnText}>AUTO</Text>
          </Pressable>
        )}
        {isHost && (
          <Pressable
            style={styles.endBtn}
            onPress={() => {
              setPendingMatch(null);
              setConfirmEnd(c => !c);
            }}
          >
            <Text style={styles.btnText}>{confirmEnd ? 'CANCEL' : 'END'}</Text>
          </Pressable>
        )}
      </View>

      {/* Inline: End confirmation */}
      {confirmEnd && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText}>End the tournament?</Text>
          <Pressable style={styles.confirmNoBtn} onPress={() => setConfirmEnd(false)}>
            <Text style={styles.confirmBtnText}>No</Text>
          </Pressable>
          <Pressable
            style={styles.confirmYesBtn}
            onPress={() => { setConfirmEnd(false); onEndTournament(); }}
          >
            <Text style={styles.confirmBtnText}>Yes, End</Text>
          </Pressable>
        </View>
      )}

      {/* Inline: Auto-pick confirmation */}
      {pendingMatch && (
        <View style={styles.autoConfirmBar}>
          <Text style={styles.autoConfirmTitle}>Auto-picked game</Text>
          <Text style={styles.autoConfirmMatch}>{t1Name}  vs  {t2Name}</Text>
          <View style={styles.autoConfirmRow}>
            <Pressable style={styles.autoConfirmNo} onPress={() => setPendingMatch(null)}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.autoConfirmYes}
              onPress={() => { const m = pendingMatch; setPendingMatch(null); onStartMatch(m); }}
            >
              <Text style={styles.btnText}>Start</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* No games available message */}
      {isHost && !pendingMatch && availableMatches.length === 0 && tournament.state !== 'completed' && (
        <Text style={{ color: colors.gray3, textAlign: 'center', padding: 8, fontSize: 12 }}>
          No games available to auto-pick
        </Text>
      )}

      {/* Fixtures */}
      {renderFixtures()}
    </View>
  );
}
