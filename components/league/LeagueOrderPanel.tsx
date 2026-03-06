/**
 * components/league/LeagueOrderPanel.tsx
 *
 * Renders the scripted Order of Play for an active league fixture.
 * Shown in the dashboard when a league queue is loaded.
 *
 * Each rubber row has:
 *   - Name (e.g. "H1 v V1") + player names
 *   - [Play] button → calls onPlay(rubber) to assign those players to a court
 *   - Inline score entry → [H __] – [A __] + [✓] to record result
 *   - Once recorded: shows the score + who won
 *
 * When all rubbers are recorded the host sees [Complete Fixture] which writes
 * the aggregated result to Supabase via onComplete().
 */

import React, { useState } from 'react';
import {
  Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import type { StoredLeagueQueue, LeagueRubberResult, LeagueRubber } from '../../utils/leagueLogic';
import { tabulateResults } from '../../utils/leagueLogic';

interface Props {
  queue: StoredLeagueQueue;
  results: LeagueRubberResult[];
  /** True while any court is currently occupied (to warn if needed) */
  courtsBusy: boolean;
  onPlay: (rubber: LeagueRubber) => void;
  onRecordResult: (index: number, homeScore: number, awayScore: number) => void;
  onComplete: () => void;
  isHost: boolean;
}

export function LeagueOrderPanel({
  queue, results, courtsBusy, onPlay, onRecordResult, onComplete, isHost,
}: Props) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  // Per-rubber draft score state (before confirming)
  const [draftH, setDraftH] = useState<Record<number, string>>({});
  const [draftA, setDraftA] = useState<Record<number, string>>({});
  const [scoring, setScoring] = useState<Record<number, boolean>>({});

  const { homeWins, awayWins } = tabulateResults(results);
  const totalRubbers = queue.rubbers.length;
  const doneCount = results.length;
  const allDone = doneCount >= totalRubbers;

  const getResult = (idx: number) => results.find(r => r.index === idx);

  const confirmScore = (idx: number) => {
    const h = parseInt(draftH[idx] ?? '', 10);
    const a = parseInt(draftA[idx] ?? '', 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      Alert.alert('Invalid score', 'Enter non-negative whole numbers for both sides.');
      return;
    }
    if (h === a) {
      Alert.alert('Draw?', 'Badminton rubbers cannot end in a draw. Check the scores.', [
        { text: 'Fix', style: 'cancel' },
        { text: 'Save anyway', onPress: () => onRecordResult(idx, h, a) },
      ]);
      return;
    }
    onRecordResult(idx, h, a);
    setScoring(prev => ({ ...prev, [idx]: false }));
  };

  return (
    <View style={s.container}>
      {/* Header: running score */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Order of Play</Text>
          <Text style={s.headerSub}>{queue.homeTeamName} vs {queue.awayTeamName}</Text>
        </View>
        <View style={s.scoreboard}>
          <Text style={[s.scoreNum, homeWins > awayWins && s.scoreWinning]}>{homeWins}</Text>
          <Text style={s.scoreSep}>–</Text>
          <Text style={[s.scoreNum, awayWins > homeWins && s.scoreWinning]}>{awayWins}</Text>
        </View>
      </View>

      {/* Rubber list */}
      {queue.rubbers.map(rubber => {
        const result = getResult(rubber.index);
        const isDone = !!result;
        const isScoring = !isDone && scoring[rubber.index];
        const homeWon = result && result.homeScore > result.awayScore;
        const awayWon = result && result.awayScore > result.homeScore;

        return (
          <View key={rubber.index} style={[s.row, isDone && s.rowDone]}>
            {/* Rubber number + name */}
            <View style={s.rubberMeta}>
              <Text style={s.rubberNum}>{rubber.index + 1}</Text>
              <Text style={s.rubberName}>{rubber.name}</Text>
            </View>

            {/* Players */}
            <View style={s.players}>
              <Text style={[s.teamPlayers, homeWon && s.winnerText]} numberOfLines={1}>
                {rubber.homePlayers.join(' & ')}
              </Text>
              <Text style={s.vsLabel}>vs</Text>
              <Text style={[s.teamPlayers, awayWon && s.winnerText, { textAlign: 'right' }]} numberOfLines={1}>
                {rubber.awayPlayers.join(' & ')}
              </Text>
            </View>

            {/* Action area */}
            {isDone ? (
              // Show recorded score
              <View style={s.doneRow}>
                <Text style={[s.doneScore, homeWon && s.winnerText]}>{result!.homeScore}</Text>
                <Text style={s.doneSep}>–</Text>
                <Text style={[s.doneScore, awayWon && s.winnerText]}>{result!.awayScore}</Text>
                {isHost && (
                  <TouchableOpacity
                    style={s.editBtn}
                    onPress={() => {
                      setDraftH(p => ({ ...p, [rubber.index]: String(result!.homeScore) }));
                      setDraftA(p => ({ ...p, [rubber.index]: String(result!.awayScore) }));
                      setScoring(p => ({ ...p, [rubber.index]: true }));
                    }}
                  >
                    <Text style={s.editBtnTxt}>✎</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : isScoring ? (
              // Inline score entry
              <View style={s.scoreEntry}>
                <TextInput
                  style={s.scoreInput}
                  keyboardType="number-pad"
                  value={draftH[rubber.index] ?? ''}
                  onChangeText={v => setDraftH(p => ({ ...p, [rubber.index]: v }))}
                  placeholder="H"
                  placeholderTextColor={colors.gray3}
                  maxLength={2}
                />
                <Text style={s.scoreSepSm}>–</Text>
                <TextInput
                  style={s.scoreInput}
                  keyboardType="number-pad"
                  value={draftA[rubber.index] ?? ''}
                  onChangeText={v => setDraftA(p => ({ ...p, [rubber.index]: v }))}
                  placeholder="A"
                  placeholderTextColor={colors.gray3}
                  maxLength={2}
                />
                <TouchableOpacity style={s.confirmBtn} onPress={() => confirmScore(rubber.index)}>
                  <Text style={s.confirmBtnTxt}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelScoringBtn} onPress={() => setScoring(p => ({ ...p, [rubber.index]: false }))}>
                  <Text style={s.cancelScoringTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : isHost ? (
              // Play + score buttons
              <View style={s.actions}>
                <TouchableOpacity
                  style={s.playBtn}
                  onPress={() => onPlay(rubber)}
                >
                  <Text style={s.playBtnTxt}>▶ Play</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.scoreBtn}
                  onPress={() => {
                    setDraftH(p => ({ ...p, [rubber.index]: '' }));
                    setDraftA(p => ({ ...p, [rubber.index]: '' }));
                    setScoring(p => ({ ...p, [rubber.index]: true }));
                  }}
                >
                  <Text style={s.scoreBtnTxt}>Score</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: colors.gray2, fontSize: 12 }}>Pending</Text>
            )}
          </View>
        );
      })}

      {/* Complete fixture button */}
      {isHost && allDone && (
        <TouchableOpacity style={s.completeBtn} onPress={onComplete}>
          <Text style={s.completeBtnTxt}>
            Complete Fixture — {queue.homeTeamName} {homeWins}–{awayWins} {queue.awayTeamName}
          </Text>
        </TouchableOpacity>
      )}
      {isHost && !allDone && (
        <Text style={s.progressNote}>
          {doneCount}/{totalRubbers} rubbers recorded
        </Text>
      )}
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container:    { backgroundColor: colors.surface, borderRadius: 12, margin: 12, padding: 14 },
    header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    headerTitle:  { fontSize: 15, fontWeight: '700', color: colors.white },
    headerSub:    { fontSize: 12, color: colors.gray2, marginTop: 2 },
    scoreboard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    scoreNum:     { fontSize: 22, fontWeight: '700', color: colors.white, minWidth: 28, textAlign: 'center' },
    scoreWinning: { color: colors.primary },
    scoreSep:     { fontSize: 18, color: colors.gray2, marginHorizontal: 6 },

    row:          { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
    rowDone:      { opacity: 0.8 },

    rubberMeta:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    rubberNum:    { width: 22, fontSize: 11, fontWeight: '700', color: colors.gray2 },
    rubberName:   { fontSize: 12, fontWeight: '600', color: colors.gray1 },

    players:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    teamPlayers:  { flex: 1, fontSize: 13, color: colors.white },
    vsLabel:      { fontSize: 11, color: colors.gray2, marginHorizontal: 6 },
    winnerText:   { color: colors.primary, fontWeight: '700' },

    actions:      { flexDirection: 'row', gap: 8 },
    playBtn:      { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
    playBtnTxt:   { color: colors.black, fontWeight: '700', fontSize: 12 },
    scoreBtn:     { backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
    scoreBtnTxt:  { color: colors.white, fontSize: 12 },

    doneRow:      { flexDirection: 'row', alignItems: 'center' },
    doneScore:    { fontSize: 15, fontWeight: '700', color: colors.gray1, minWidth: 24, textAlign: 'center' },
    doneSep:      { fontSize: 13, color: colors.gray2, marginHorizontal: 4 },
    editBtn:      { marginLeft: 8, padding: 4 },
    editBtnTxt:   { color: colors.gray2, fontSize: 14 },

    scoreEntry:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    scoreInput:   { backgroundColor: colors.bg, borderRadius: 6, borderWidth: 1, borderColor: colors.border, width: 40, textAlign: 'center', color: colors.white, fontSize: 14, paddingVertical: 4 },
    scoreSepSm:   { color: colors.gray2 },
    confirmBtn:   { backgroundColor: colors.green, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    confirmBtnTxt:{ color: '#fff', fontWeight: '700' },
    cancelScoringBtn: { padding: 5 },
    cancelScoringTxt: { color: colors.red },

    completeBtn:  { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
    completeBtnTxt: { color: colors.black, fontWeight: '700', fontSize: 14 },
    progressNote: { textAlign: 'center', color: colors.gray2, fontSize: 12, marginTop: 10 },
  });
}
