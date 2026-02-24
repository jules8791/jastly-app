import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club, QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

interface QueuePanelProps {
  club: Club;
  isHost: boolean;
  isPowerGuest: boolean;
  myName: string;
  selectedQueueIdx: number[];
  playersPerGame: number;
  sportEmoji: string;
  courtLabel: string;
  genderBalanced: boolean;
  avoidRepeats: boolean;
  isProcessingAction: boolean;
  onSelectQueueIdx: (indices: number[]) => void;
  onAutoPick: () => void;
  onOpenPlayers: () => void;
  onTogglePause: (name: string) => void;
  onLeave: (name: string) => void;
  onGrantPowerGuest: (name: string, grant: boolean) => void;
}

export function QueuePanel({
  club,
  isHost,
  isPowerGuest,
  myName,
  selectedQueueIdx,
  playersPerGame,
  courtLabel,
  genderBalanced,
  avoidRepeats,
  onSelectQueueIdx,
  onAutoPick,
  onOpenPlayers,
  onTogglePause,
  onLeave,
  onGrantPowerGuest,
}: QueuePanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const waitingList: QueuePlayer[] = club.waiting_list || [];
  const firstActiveIdx = waitingList.findIndex((w: QueuePlayer) => !w.isResting);

  return (
    <>
      {/* ── BANNER ─────────────────────────────────────────────── */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.nextText}>
            NEXT: {waitingList.find((p: QueuePlayer) => !p.isResting)?.name || 'EMPTY'}
          </Text>
          {(isHost || isPowerGuest) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, alignItems: 'center' }}>
              <TouchableOpacity onPress={onAutoPick}>
                <Text style={styles.btnPrimaryText}>AUTO-PICK{genderBalanced ? ' ⚧' : ''}{avoidRepeats ? ' 🔄' : ''}</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.gray3, fontSize: 10, alignSelf: 'center' }}>or tap {playersPerGame} players</Text>
              {isPowerGuest && !isHost && (
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>⚡</Text>
              )}
            </View>
          )}
          {!isHost && !isPowerGuest && waitingList.find((w: QueuePlayer) => !w.isResting)?.name === myName && (
            <Text style={{ color: colors.green, fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>
              Tap {playersPerGame} players — a popup will appear to assign a {courtLabel.toLowerCase()}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={onOpenPlayers}
        >
          <Text style={styles.btnText}>{isHost ? 'MANAGE PLAYERS' : isPowerGuest ? 'MANAGE QUEUE' : 'VIEW QUEUE'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── QUEUE ──────────────────────────────────────────────── */}
      {waitingList.map((p: QueuePlayer, i: number) => {
        const isMe = p.name === myName;
        const isSelected = selectedQueueIdx.includes(i);
        const isMyTurn = !isHost && !isPowerGuest && firstActiveIdx >= 0 && waitingList[firstActiveIdx]?.name === myName;
        const canSelect = isHost || isPowerGuest || isMyTurn;

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
              if (isSelected) onSelectQueueIdx(selectedQueueIdx.filter(x => x !== i));
              else if (selectedQueueIdx.length < playersPerGame) onSelectQueueIdx([...selectedQueueIdx, i]);
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
              {isHost && !p.isResting && (
                <TouchableOpacity
                  style={{ marginRight: 8, padding: 5 }}
                  onPress={() => onGrantPowerGuest(p.name, !p.isPowerGuest)}
                >
                  <Text style={{ fontSize: 14 }}>{p.isPowerGuest ? '⚡' : '☆'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ marginRight: 15, padding: 5 }}
                onPress={() => onTogglePause(p.name)}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{p.isResting ? '▶' : 'II'}</Text>
              </TouchableOpacity>
              {(isHost || isPowerGuest || isMe) && (
                <TouchableOpacity
                  style={{ padding: 5 }}
                  onPress={() => Alert.alert('Leave Queue?', `Remove ${p.name} from queue?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => onLeave(p.name) },
                  ])}
                >
                  <Text style={{ color: colors.red, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {waitingList.length === 0 && (
        <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 40 }}>Queue is empty</Text>
      )}

      <View style={{ height: 40 }} />
    </>
  );
}
