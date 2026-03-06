import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club, QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

interface QueuePanelProps {
  onUndo?: () => void;
  club: Club;
  overrideWaitingList?: QueuePlayer[]; // optimistic list from useClubSession
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
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onBatchAdd?: () => void;
  onSetPlayerNote?: (name: string, note: string) => void;
  onSetLeavingAt?: (name: string, leavingAt: number | null) => void;
  onSetSkillLevel?: (name: string, skillLevel: number) => void;
  onSetSkipNext?: (name: string) => void;
  onSetGender?: (name: string, gender: 'M' | 'F') => void;
}

function leavingCountdown(leavingAt: number): string {
  const ms = leavingAt - Date.now();
  if (ms <= 0) return 'leaving now';
  const mins = Math.ceil(ms / 60_000);
  if (mins <= 1) return 'leaving in <1m';
  return `leaving in ${mins}m`;
}

const SKILL_LABELS = ['', 'Beg', 'Nov', 'Int', 'Adv', 'Pro'];

type ConfirmAction = 'pause' | 'resume' | 'remove' | 'grant_power' | 'revoke_power';

function QueuePanelBase({
  club,
  overrideWaitingList,
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
  onMoveUp,
  onMoveDown,
  onUndo,
  onBatchAdd,
  onSetPlayerNote,
  onSetLeavingAt,
  onSetSkillLevel,
  onSetSkipNext,
  onSetGender,
}: QueuePanelProps): React.ReactElement {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ name: string; action: ConfirmAction } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const [showLeavingFor, setShowLeavingFor] = useState<string | null>(null);
  const [showSkillFor, setShowSkillFor] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const collapse = () => {
    setExpandedPlayer(null);
    setPendingConfirm(null);
    setShowNoteFor(null);
    setShowLeavingFor(null);
    setShowSkillFor(null);
  };

  const toggleExpanded = (name: string) => {
    if (expandedPlayer === name) { collapse(); } else {
      setExpandedPlayer(name);
      setPendingConfirm(null);
      setShowNoteFor(null);
      setShowLeavingFor(null);
      setShowSkillFor(null);
    }
  };

  const pill = (bg: string, extra?: object) => ({
    backgroundColor: bg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
    ...extra,
  });

  const waitingList: QueuePlayer[] = overrideWaitingList ?? club.waiting_list ?? [];
  const firstActiveIdx = waitingList.findIndex((w: QueuePlayer) => !w.isResting);

  const confirmLabels: Record<ConfirmAction, { title: string; body: string; btn: string; color: string }> = {
    pause:       { title: 'Pause player?',          body: 'They will be skipped until resumed.',               btn: 'Pause',         color: colors.primary },
    resume:      { title: 'Resume player?',         body: 'They will be included in picks again.',             btn: 'Resume',        color: colors.green },
    remove:      { title: 'Remove from queue?',     body: 'They will be removed from the waiting list.',       btn: 'Remove',        color: colors.red },
    grant_power: { title: 'Grant Power Guest?',     body: 'They will be able to pick players and manage the queue.', btn: 'Grant',  color: colors.primary },
    revoke_power:{ title: 'Revoke Power Guest?',    body: 'They will lose the ability to manage the queue.',  btn: 'Revoke',        color: colors.red },
  };

  const executeConfirmed = (playerName: string, action: ConfirmAction) => {
    collapse();
    if (action === 'pause' || action === 'resume') onTogglePause(playerName);
    else if (action === 'remove') onLeave(playerName);
    else if (action === 'grant_power') onGrantPowerGuest(playerName, true);
    else if (action === 'revoke_power') onGrantPowerGuest(playerName, false);
  };

  const renderItem = useCallback(({ item: p, index: i }: { item: QueuePlayer; index: number }) => {
    const isMe = p.name === myName;
    const isSelected = selectedQueueIdx.includes(i);
    const isMyTurn = !isHost && !isPowerGuest && firstActiveIdx >= 0 && waitingList[firstActiveIdx]?.name === myName;
    const canSelect = isHost || isPowerGuest || isMyTurn;
    const leavingSoon = !!p.leavingAt && (p.leavingAt - Date.now()) < 5 * 60_000;
    const elevated = isHost || isPowerGuest;
    const hasActions = elevated || isMe;
    const isExpanded = expandedPlayer === p.name;
    const isConfirming = pendingConfirm?.name === p.name;

    return (
      <React.Fragment key={i}>
        {/* Row: sibling touchables so ··· never nests inside the row press */}
        <View style={[styles.queueRow,
          p.isResting && { opacity: 0.4 },
          p._pending && !p.isResting && { opacity: 0.65 },
          isMe && { borderWidth: 1, borderColor: colors.green },
          isSelected && { backgroundColor: colors.selectedBg, borderWidth: 1, borderColor: colors.primary },
          { flexDirection: 'row', alignItems: 'center' },
        ]}>
          {/* Selectable area */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              if (!canSelect) return;
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (isSelected) onSelectQueueIdx(selectedQueueIdx.filter(x => x !== i));
              else if (selectedQueueIdx.length < playersPerGame) onSelectQueueIdx([...selectedQueueIdx, i]);
            }}
          >
            <Text style={{ color: isSelected ? colors.primary : colors.gray3, marginRight: 10, fontSize: 14, width: 22, fontWeight: isSelected ? 'bold' : 'normal' }}>{i + 1}</Text>
            <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue }]}>
              <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
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
                {p._pending && (
                  <View style={{ borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                    <Text style={{ color: colors.gray3, fontSize: 9 }}>⏳</Text>
                  </View>
                )}
                {p.skipNext && (
                  <View style={{ backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
                    <Text style={{ color: colors.gray2, fontSize: 9, fontWeight: 'bold' }}>⏭ SKIP</Text>
                  </View>
                )}
                {p.skillLevel ? (
                  <View style={{ backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
                    <Text style={{ color: colors.gray2, fontSize: 9, fontWeight: 'bold' }}>{SKILL_LABELS[p.skillLevel] || p.skillLevel}</Text>
                  </View>
                ) : null}
              </View>
              {p.notes ? (
                <Text style={{ color: colors.gray2, fontSize: 10, marginTop: 1 }} numberOfLines={1}>📝 {p.notes}</Text>
              ) : null}
              {p.leavingAt ? (
                <Text style={{ color: leavingSoon ? colors.red : colors.gray3, fontSize: 10, marginTop: 1 }}>
                  ⏰ {leavingCountdown(p.leavingAt)}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* ··· toggle — sibling, not nested inside row touchable */}
          {hasActions && (
            <TouchableOpacity
              onPress={() => toggleExpanded(p.name)}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
            >
              <Text style={{ color: isExpanded ? colors.primary : colors.gray2, fontSize: 20, fontWeight: 'bold', lineHeight: 22 }}>
                {isExpanded ? '×' : '···'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── ACTION PANEL ─────────────────────────────────── */}
        {isExpanded && (
          <View style={{ backgroundColor: colors.selectedBg, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingBottom: 12, paddingTop: 8, gap: 8 }}>

            {/* Inline confirmation bar */}
            {isConfirming && pendingConfirm && (
              <View style={{ backgroundColor: colors.bg, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
                <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>
                  {confirmLabels[pendingConfirm.action].title}
                </Text>
                <Text style={{ color: colors.gray3, fontSize: 12, marginBottom: 10 }}>
                  {confirmLabels[pendingConfirm.action].body}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={pill(confirmLabels[pendingConfirm.action].color, { flex: 1 })}
                    onPress={() => executeConfirmed(p.name, pendingConfirm.action)}
                  >
                    <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 14 }}>
                      {confirmLabels[pendingConfirm.action].btn}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={pill(colors.border, { flex: 1 })}
                    onPress={() => setPendingConfirm(null)}
                  >
                    <Text style={{ color: colors.gray2, fontWeight: 'bold', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Action buttons (hidden while confirming) */}
            {!isConfirming && (
              <>
                {/* Row 1: primary actions */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={pill(p.isResting ? colors.green : colors.surface)}
                    onPress={() => setPendingConfirm({ name: p.name, action: p.isResting ? 'resume' : 'pause' })}
                  >
                    <Text style={{ color: p.isResting ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                      {p.isResting ? '▶  RESUME' : 'II  PAUSE'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={pill(colors.red, { borderColor: colors.red })}
                    onPress={() => setPendingConfirm({ name: p.name, action: 'remove' })}
                  >
                    <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 13 }}>
                      {elevated && !isMe ? '✕  REMOVE' : '✕  LEAVE QUEUE'}
                    </Text>
                  </TouchableOpacity>

                  {elevated && i > 0 && (
                    <TouchableOpacity style={pill(colors.surface)} onPress={() => { onMoveUp(i); collapse(); }}>
                      <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 13 }}>▲  UP</Text>
                    </TouchableOpacity>
                  )}

                  {elevated && i < waitingList.length - 1 && (
                    <TouchableOpacity style={pill(colors.surface)} onPress={() => { onMoveDown(i); collapse(); }}>
                      <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 13 }}>▼  DOWN</Text>
                    </TouchableOpacity>
                  )}

                  {!elevated && isMe && onSetLeavingAt && (
                    <TouchableOpacity
                      style={pill(showLeavingFor === p.name ? colors.primary : colors.surface, showLeavingFor === p.name ? { borderColor: colors.primary } : {})}
                      onPress={() => setShowLeavingFor(showLeavingFor === p.name ? null : p.name)}
                    >
                      <Text style={{ color: showLeavingFor === p.name ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                        {p.leavingAt ? '⏰  LEAVING ✓' : '⏰  LEAVING'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(elevated || isMe) && onSetSkipNext && (
                    <TouchableOpacity
                      style={pill(p.skipNext ? colors.primary : colors.surface, p.skipNext ? { borderColor: colors.primary } : {})}
                      onPress={() => { onSetSkipNext(p.name); collapse(); }}
                    >
                      <Text style={{ color: p.skipNext ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                        {p.skipNext ? '⏭  UNSKIP' : '⏭  SKIP NEXT GAME'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(elevated || isMe) && onSetGender && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['M', 'F'] as const).map(g => (
                        <TouchableOpacity
                          key={g}
                          style={pill(p.gender === g ? colors.primary : colors.surface, p.gender === g ? { borderColor: colors.primary } : {})}
                          onPress={() => { onSetGender(p.name, g); collapse(); }}
                        >
                          <Text style={{ color: p.gender === g ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                            {g === 'M' ? '♂ M' : '♀ F'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Row 2: elevated-only actions */}
                {elevated && (
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {isHost && !p.isResting && (
                      <TouchableOpacity
                        style={pill(p.isPowerGuest ? colors.primary : colors.surface, p.isPowerGuest ? { borderColor: colors.primary } : {})}
                        onPress={() => setPendingConfirm({ name: p.name, action: p.isPowerGuest ? 'revoke_power' : 'grant_power' })}
                      >
                        <Text style={{ color: p.isPowerGuest ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                          {p.isPowerGuest ? '⚡ REVOKE POWER' : '⚡ GRANT POWER'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {onSetPlayerNote && (
                      <TouchableOpacity
                        style={pill(showNoteFor === p.name ? colors.primary : colors.surface, showNoteFor === p.name ? { borderColor: colors.primary } : {})}
                        onPress={() => { setShowNoteFor(showNoteFor === p.name ? null : p.name); setNoteInput(p.notes ?? ''); setShowLeavingFor(null); setShowSkillFor(null); }}
                      >
                        <Text style={{ color: showNoteFor === p.name ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>📝  NOTE</Text>
                      </TouchableOpacity>
                    )}

                    {onSetLeavingAt && (
                      <TouchableOpacity
                        style={pill(showLeavingFor === p.name ? colors.primary : colors.surface, showLeavingFor === p.name ? { borderColor: colors.primary } : {})}
                        onPress={() => { setShowLeavingFor(showLeavingFor === p.name ? null : p.name); setShowNoteFor(null); setShowSkillFor(null); }}
                      >
                        <Text style={{ color: showLeavingFor === p.name ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                          {p.leavingAt ? '⏰  LEAVING ✓' : '⏰  LEAVING'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {onSetSkillLevel && (
                      <TouchableOpacity
                        style={pill(showSkillFor === p.name ? colors.primary : colors.surface, showSkillFor === p.name ? { borderColor: colors.primary } : {})}
                        onPress={() => { setShowSkillFor(showSkillFor === p.name ? null : p.name); setShowNoteFor(null); setShowLeavingFor(null); }}
                      >
                        <Text style={{ color: showSkillFor === p.name ? colors.bg : colors.white, fontWeight: 'bold', fontSize: 13 }}>
                          {p.skillLevel ? `★  SKILL: ${SKILL_LABELS[p.skillLevel]}` : '★  SKILL'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Note editor */}
                {showNoteFor === p.name && onSetPlayerNote && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.bg, color: colors.white, borderRadius: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 }}
                      value={noteInput}
                      onChangeText={setNoteInput}
                      placeholder="Add note (blank = clear)..."
                      placeholderTextColor={colors.gray3}
                      autoFocus
                      maxLength={100}
                      onSubmitEditing={() => { onSetPlayerNote(p.name, noteInput); collapse(); }}
                    />
                    <TouchableOpacity
                      onPress={() => { onSetPlayerNote(p.name, noteInput); collapse(); }}
                      style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 12 }}>SAVE</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Leaving-at picker */}
                {showLeavingFor === p.name && onSetLeavingAt && (
                  <View style={{ marginTop: 2 }}>
                    <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 6 }}>Leaving in:</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {[15, 30, 45, 60, 90].map(mins => (
                        <TouchableOpacity
                          key={mins}
                          onPress={() => { onSetLeavingAt(p.name, Date.now() + mins * 60_000); collapse(); }}
                          style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: colors.bg, fontWeight: 'bold', fontSize: 12 }}>{mins}m</Text>
                        </TouchableOpacity>
                      ))}
                      {p.leavingAt && (
                        <TouchableOpacity
                          onPress={() => { onSetLeavingAt(p.name, null); collapse(); }}
                          style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: colors.red, fontWeight: 'bold', fontSize: 12 }}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Skill level picker */}
                {showSkillFor === p.name && onSetSkillLevel && (
                  <View style={{ marginTop: 2 }}>
                    <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 6 }}>Skill level:</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map(lvl => (
                        <TouchableOpacity
                          key={lvl}
                          onPress={() => { onSetSkillLevel(p.name, lvl); collapse(); }}
                          style={{ backgroundColor: p.skillLevel === lvl ? colors.primary : colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: p.skillLevel === lvl ? colors.bg : colors.gray2, fontWeight: 'bold', fontSize: 12 }}>{SKILL_LABELS[lvl]}</Text>
                        </TouchableOpacity>
                      ))}
                      {p.skillLevel ? (
                        <TouchableOpacity
                          onPress={() => { onSetSkillLevel(p.name, 0); collapse(); }}
                          style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: colors.gray3, fontSize: 12 }}>Clear</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </React.Fragment>
    );
  }, [myName, selectedQueueIdx, isHost, isPowerGuest, firstActiveIdx, waitingList, expandedPlayer,
    pendingConfirm, showNoteFor, showLeavingFor, showSkillFor, noteInput, colors, styles,
    playersPerGame, onSelectQueueIdx, onMoveUp, onMoveDown, onSetPlayerNote, onSetLeavingAt,
    onSetSkillLevel, onSetSkipNext, onSetGender, pill, confirmLabels, executeConfirmed, collapse,
    toggleExpanded, setPendingConfirm, setNoteInput, setShowNoteFor, setShowLeavingFor, setShowSkillFor]);

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
              {onUndo && (
                <TouchableOpacity onPress={onUndo} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.border, borderRadius: 4 }}>
                  <Text style={{ color: colors.gray2, fontSize: 10, fontWeight: 'bold' }}>↩ UNDO</Text>
                </TouchableOpacity>
              )}
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
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={onOpenPlayers}>
            <Text style={styles.btnText}>{isHost ? 'MANAGE PLAYERS' : isPowerGuest ? 'MANAGE QUEUE' : 'VIEW QUEUE'}</Text>
          </TouchableOpacity>
          {onBatchAdd && (
            <TouchableOpacity onPress={onBatchAdd} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.border, borderRadius: 4 }}>
              <Text style={{ color: colors.gray2, fontSize: 10, fontWeight: 'bold' }}>+ BATCH</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── QUEUE ──────────────────────────────────────────────── */}
      {/* scrollEnabled={false}: parent ScrollView handles scrolling.
          FlatList is used here for proper key-based reconciliation and
          as the foundation for full virtualization if layout is restructured. */}
      <FlatList
        data={waitingList}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        scrollEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 40 }}>Queue is empty</Text>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </>
  );
}

export const QueuePanel = memo(QueuePanelBase);
