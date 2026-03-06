import React, { memo, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

const SKILL_LABELS = ['', 'Beg', 'Nov', 'Int', 'Adv', 'Pro'];

interface CourtsGridProps {
  activeCourts: number;
  courtOccupants: Record<string, QueuePlayer[]>;
  courtLabel: string;
  sportEmoji: string;
  isHost: boolean;
  isPowerGuest: boolean;
  isProcessingAction: boolean;
  courtStartTimes: React.MutableRefObject<Record<string, number>>;
  targetGameDuration?: number; // minutes, 0 = off
  courtNames?: Record<string, string>; // custom label per court index
  courtServe?: Record<string, string>; // current server per court
  onFinishMatch: (courtIdx: string, players: QueuePlayer[]) => void;
  onSubstitute: (courtIdx: string, outPlayer: string) => void;
  onAdvanceServe?: (courtIdx: string) => void;
}

function formatElapsed(startTime: number): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCountdown(startTime: number, targetMins: number): string {
  const remainMs = Math.max(0, targetMins * 60_000 - (Date.now() - startTime));
  const m = Math.floor(remainMs / 60_000);
  const s = Math.floor((remainMs % 60_000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CourtsGridBase({
  activeCourts,
  courtOccupants,
  courtLabel,
  isHost,
  courtStartTimes,
  targetGameDuration = 0,
  courtNames,
  courtServe,
  onFinishMatch,
  onSubstitute,
  onAdvanceServe,
}: CourtsGridProps): React.ReactElement {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const numCourts = activeCourts || 4;
  const cardMargin = 4;

  return (
    <View
      style={{ paddingHorizontal: cardMargin, paddingTop: cardMargin }}
    >
      {Array.from({ length: numCourts }, (_, i) => {
        const players = courtOccupants?.[i.toString()];
        const isBusy = !!players;
        const startTime = courtStartTimes.current[i.toString()];
        const customName = courtNames?.[i.toString()];
        const server = courtServe?.[i.toString()];
        const elapsed = startTime ? formatElapsed(startTime) : null;
        const overTime = targetGameDuration > 0 && startTime
          ? (Date.now() - startTime) >= targetGameDuration * 60_000
          : false;
        const countdown = targetGameDuration > 0 && startTime
          ? formatCountdown(startTime, targetGameDuration)
          : null;

        const team1 = isBusy ? [players[0], players[1]].filter(Boolean) : [];
        const team2 = isBusy ? [players[2], players[3], players[4], players[5]].filter(Boolean) : [];

        const renderPlayer = (p: QueuePlayer, pi: number) => (
          <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {server === p?.name && (
              <Text style={{ fontSize: 12, color: colors.primary }}>→</Text>
            )}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
              style={[styles.courtPlayer, { fontSize: 20 }]}>
              {p?.name}
            </Text>
            {p?.skillLevel ? (
              <Text style={{ fontSize: 11, color: colors.gray3 }}>
                {SKILL_LABELS[p.skillLevel] || p.skillLevel}
              </Text>
            ) : null}
          </View>
        );

        return (
          <TouchableOpacity
            key={i}
            style={[{
              marginHorizontal: cardMargin,
              marginBottom: 8,
              borderRadius: 10,
              borderWidth: 1,
              padding: 14,
              overflow: 'hidden',
              minHeight: 72,
            }, isBusy ? styles.courtBusy : styles.courtFree]}
            onPress={() => isBusy ? onFinishMatch(i.toString(), players) : undefined}
          >
            {/* Header row: court name centred + timer on right */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                {isBusy && elapsed && (
                  <Text style={{ color: overTime ? colors.red : colors.gray3, fontSize: 13 }}>
                    {countdown !== null ? `${countdown} left` : elapsed}
                    {overTime ? ' !' : ''}
                  </Text>
                )}
              </View>
              <Text style={[styles.courtTitle, { fontSize: 15, textAlign: 'center' }]} numberOfLines={1}>
                {customName || `${courtLabel.toUpperCase()} ${i + 1}`}
              </Text>
              <View style={{ flex: 1 }} />
            </View>

            {isBusy ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Centred match-up: teams + VS take all available space */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Team 1 — right-aligned toward VS */}
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                    {team1.map((p, pi) => renderPlayer(p as QueuePlayer, pi))}
                  </View>

                  <Text style={{ color: colors.gray2, fontSize: 15, fontWeight: 'bold', marginHorizontal: 10 }}>VS</Text>

                  {/* Team 2 — left-aligned toward VS */}
                  <View style={{ flex: 1, alignItems: 'flex-start', gap: 4 }}>
                    {team2.map((p, pi) => renderPlayer(p as QueuePlayer, pi))}
                  </View>
                </View>

                {/* Action buttons — outside the centred block */}
                {isHost && (
                  <View style={{ flexDirection: 'column', gap: 6, marginLeft: 10 }}>
                    <TouchableOpacity
                      onPress={() => onSubstitute(i.toString(), players[0]?.name)}
                      style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 13 }}>SUB</Text>
                    </TouchableOpacity>
                    {onAdvanceServe && (
                      <TouchableOpacity
                        onPress={() => onAdvanceServe(i.toString())}
                        style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 13 }}>→SRV</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.courtFreeText, { fontSize: 16 }]}>FREE</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const CourtsGrid = memo(CourtsGridBase);
