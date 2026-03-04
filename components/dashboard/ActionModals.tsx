import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { ColorSet, useTheme } from '../../contexts/theme-context';
import { QueuePlayer } from '../../types';
import { getSportConfig, SPORTS } from '../../constants/sports';

// ─── Shared local styles ─────────────────────────────────────────────────────
const makeStyles = (C: ColorSet) => StyleSheet.create({
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: 'center', padding: 20, zIndex: 10 },
  modalContent: { backgroundColor: C.surface, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.primary, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 16 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  btnPrimary: { backgroundColor: C.purple, padding: 10, borderRadius: 6 },
  btnDanger: { backgroundColor: C.red, padding: 8, borderRadius: 6 },
  btnText: { color: C.white, fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  input: { backgroundColor: C.bg, color: C.white, padding: 15, borderRadius: 5, marginBottom: 15, borderWidth: 1, borderColor: C.border },
  mathBtn: { backgroundColor: C.border, paddingHorizontal: 15, paddingVertical: 5, borderRadius: 5 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  sectionHeader: { color: C.primary, fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontSize: 13, letterSpacing: 1 },
  sportChip: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginRight: 8, minWidth: 72,
  },
  sportChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  scoreInput: {
    backgroundColor: C.bg, color: C.white, padding: 10, borderRadius: 5,
    borderWidth: 1, borderColor: C.border, flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold',
  },
});

// ─── CourtAssignModal ────────────────────────────────────────────────────────
export interface CourtAssignModalProps {
  visible: boolean;
  selectedQueueIdx: number[];
  waitingList: QueuePlayer[];
  activeCourts: number;
  courtOccupants: Record<string, QueuePlayer[]>;
  courtLabel: string;
  playersPerGame: number;
  isProcessingAction: boolean;
  onAssignCourt: (courtIdx: number) => void;
  onCancel: () => void;
}

export function CourtAssignModal({
  visible,
  selectedQueueIdx,
  waitingList,
  activeCourts,
  courtOccupants,
  courtLabel,
  playersPerGame,
  isProcessingAction,
  onAssignCourt,
  onCancel,
}: CourtAssignModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>ASSIGN COURT</Text>

          {/* Selected players summary */}
          {selectedQueueIdx.length === playersPerGame && (
            <View style={{ backgroundColor: colors.selectedBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: colors.gray2, fontSize: 11, textAlign: 'center', marginBottom: 4 }}>SELECTED PLAYERS</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
                {selectedQueueIdx.map(i => waitingList[i]?.name).join('  ·  ')}
              </Text>
            </View>
          )}

          {/* Court list */}
          {Array.from({ length: activeCourts || 4 }).map((_, i) => {
            const isBusy = !!courtOccupants?.[i.toString()];
            return (
              <TouchableOpacity
                key={i}
                disabled={isBusy || isProcessingAction}
                style={[styles.modalItem, (isBusy || isProcessingAction) && { opacity: 0.3 }]}
                onPress={() => onAssignCourt(i)}
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
            onPress={onCancel}
          >
            <Text style={[styles.btnText, { textAlign: 'center' }]}>CANCEL — CHANGE SELECTION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MatchResultModal ────────────────────────────────────────────────────────
export interface CourtResult {
  courtIdx: string;
  players: QueuePlayer[];
}

export interface MatchResultModalProps {
  visible: boolean;
  courtResult: CourtResult | null;
  winners: string[];
  scoreA: string;
  scoreB: string;
  onToggleWinner: (name: string) => void;
  onScoreAChange: (v: string) => void;
  onScoreBChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MatchResultModal({
  visible,
  courtResult,
  winners,
  scoreA,
  scoreB,
  onToggleWinner,
  onScoreAChange,
  onScoreBChange,
  onConfirm,
  onCancel,
}: MatchResultModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const players = courtResult?.players || [];
  const half = Math.floor(players.length / 2);
  const teamALabel = players.slice(0, half).map(p => p.name).join(' & ') || 'Team A';
  const teamBLabel = players.slice(half).map(p => p.name).join(' & ') || 'Team B';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>WHO WON?</Text>
          {players.map((p: QueuePlayer, i: number) => (
            <TouchableOpacity key={i} style={styles.modalItem} onPress={() => onToggleWinner(p.name)}>
              <Text style={{ color: colors.white }}>{p.name}</Text>
              <Text style={{ color: winners.includes(p.name) ? colors.primary : colors.gray4, fontWeight: 'bold' }}>WINNER</Text>
            </TouchableOpacity>
          ))}

          {/* Score inputs */}
          <View style={{ marginTop: 20, marginBottom: 4 }}>
            <Text style={{ color: colors.gray2, fontSize: 12, marginBottom: 10, textAlign: 'center', letterSpacing: 1 }}>
              SCORE (OPTIONAL)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.gray3, fontSize: 10, marginBottom: 4 }} numberOfLines={1}>
                  {teamALabel}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  placeholder="—"
                  placeholderTextColor={colors.gray3}
                  keyboardType="numeric"
                  maxLength={2}
                  value={scoreA}
                  onChangeText={onScoreAChange}
                />
              </View>
              <Text style={{ color: colors.gray2, fontWeight: 'bold', fontSize: 18, paddingBottom: 18 }}>–</Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.gray3, fontSize: 10, marginBottom: 4 }} numberOfLines={1}>
                  {teamBLabel}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  placeholder="—"
                  placeholderTextColor={colors.gray3}
                  keyboardType="numeric"
                  maxLength={2}
                  value={scoreB}
                  onChangeText={onScoreBChange}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20, padding: 14 }]} onPress={onConfirm}>
            <Text style={[styles.btnText, { textAlign: 'center' }]}>CONFIRM & END MATCH</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15 }} onPress={onCancel}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SubstituteModal ─────────────────────────────────────────────────────────
export interface SubstituteModalProps {
  visible: boolean;
  substituteCourtIdx: string;
  substituteOutPlayer: string;
  courtOccupants: Record<string, QueuePlayer[]>;
  waitingList: QueuePlayer[];
  onSetSubstituteOutPlayer: (name: string) => void;
  onDoSubstitute: (inPlayer: string) => void;
  onCancel: () => void;
}

export function SubstituteModal({
  visible,
  substituteCourtIdx,
  substituteOutPlayer,
  courtOccupants,
  waitingList,
  onSetSubstituteOutPlayer,
  onDoSubstitute,
  onCancel,
}: SubstituteModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>SUBSTITUTE PLAYER</Text>
          <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 10 }}>
            Replacing: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{substituteOutPlayer}</Text>
          </Text>
          <Text style={{ color: colors.gray2, marginBottom: 10 }}>Who replaces them? (from queue)</Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {(courtOccupants?.[substituteCourtIdx] || []).length > 0 && (
              <Text style={{ color: colors.gray3, fontSize: 11, marginBottom: 8 }}>Tap a court player to swap out:</Text>
            )}
            {/* First pick who to swap OUT */}
            {!substituteOutPlayer || substituteOutPlayer === '' ? (
              (courtOccupants?.[substituteCourtIdx] || []).map((p: QueuePlayer, i: number) => (
                <TouchableOpacity key={i} style={styles.modalItem} onPress={() => onSetSubstituteOutPlayer(p.name)}>
                  <Text style={{ color: colors.white }}>{p.name}</Text>
                  <Text style={{ color: colors.red }}>SWAP OUT</Text>
                </TouchableOpacity>
              ))
            ) : (
              // Now pick who to swap IN
              (waitingList || []).filter((p: QueuePlayer) => !p.isResting).map((p: QueuePlayer, i: number) => (
                <TouchableOpacity key={i} style={styles.modalItem} onPress={() => onDoSubstitute(p.name)}>
                  <Text style={{ color: colors.white }}>{p.name}</Text>
                  <Text style={{ color: colors.green }}>SWAP IN</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onCancel}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SetupPinModal ───────────────────────────────────────────────────────────
export interface SetupPinModalProps {
  visible: boolean;
  setupPin1: string;
  setupPin2: string;
  pinError: boolean;
  onChangePin1: (v: string) => void;
  onChangePin2: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SetupPinModal({
  visible,
  setupPin1,
  setupPin2,
  pinError,
  onChangePin1,
  onChangePin2,
  onSave,
  onCancel,
}: SetupPinModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>SET UP PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 4-digit PIN"
            placeholderTextColor={colors.gray3}
            secureTextEntry
            maxLength={4}
            keyboardType="numeric"
            value={setupPin1}
            onChangeText={onChangePin1}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.gray3}
            secureTextEntry
            maxLength={4}
            keyboardType="numeric"
            value={setupPin2}
            onChangeText={onChangePin2}
          />
          {pinError && (
            <Text style={{ color: colors.red, textAlign: 'center', marginBottom: 10 }}>PINs do not match</Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: colors.gray1 }}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>SAVE PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── EnterPinModal ───────────────────────────────────────────────────────────
export interface EnterPinModalProps {
  visible: boolean;
  enterPinInput: string;
  onChangePinInput: (v: string) => void;
  onVerify: () => void;
  onCancel: () => void;
}

export function EnterPinModal({
  visible,
  enterPinInput,
  onChangePinInput,
  onVerify,
  onCancel,
}: EnterPinModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>ENTER PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="****"
            placeholderTextColor={colors.gray3}
            secureTextEntry
            maxLength={4}
            keyboardType="numeric"
            autoFocus
            value={enterPinInput}
            onChangeText={onChangePinInput}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: colors.gray1 }}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onVerify}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>UNLOCK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── BatchAddModal ───────────────────────────────────────────────────────────
export interface BatchAddModalProps {
  visible: boolean;
  onAdd: (names: string[]) => void;
  onCancel: () => void;
}

export function BatchAddModal({ visible, onAdd, onCancel }: BatchAddModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');

  const handleAdd = () => {
    const names = text
      .split(/[\n,;|]+/)
      .map(n => n.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20))
      .filter(n => n.length > 0);
    if (names.length === 0) return;
    onAdd(names);
    setText('');
  };

  const handleCancel = () => { setText(''); onCancel(); };

  const preview = text
    .split(/[\n,;|]+/)
    .map(n => n.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20))
    .filter(n => n.length > 0);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>BATCH ADD PLAYERS</Text>
          <Text style={{ color: colors.gray2, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
            Paste or type names — separated by commas, newlines, or semicolons
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 110, textAlignVertical: 'top', fontSize: 14 }]}
            placeholder={'e.g.  Alice, Bob, Carol\nor one per line'}
            placeholderTextColor={colors.gray3}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
          />
          {preview.length > 0 && (
            <View style={{ backgroundColor: colors.border, borderRadius: 6, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: colors.gray3, fontSize: 10, marginBottom: 4 }}>WILL ADD {preview.length} PLAYER{preview.length !== 1 ? 'S' : ''}:</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }} numberOfLines={3}>
                {preview.join('  ·  ')}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.btnPrimary, { padding: 14 }]}
            disabled={preview.length === 0}
            onPress={handleAdd}
          >
            <Text style={[styles.btnText, { textAlign: 'center', opacity: preview.length === 0 ? 0.4 : 1 }]}>
              ADD {preview.length > 0 ? preview.length : ''} TO QUEUE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 14 }} onPress={handleCancel}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SportSetupModal ─────────────────────────────────────────────────────────
export interface SportSetupModalProps {
  visible: boolean;
  tempSport: string;
  onSelectSport: (key: string) => void;
  onConfirm: () => void;
}

export function SportSetupModal({
  visible,
  tempSport,
  onSelectSport,
  onConfirm,
}: SportSetupModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>WELCOME! CHOOSE YOUR SPORT</Text>
          <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 16 }}>
            This customises the app for your session — you can change it any time in Settings.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectSport(key)}
                style={[styles.sportChip, tempSport === key && styles.sportChipActive]}
              >
                <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                <Text style={{ color: tempSport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.btnPrimary, { padding: 14 }]}
            onPress={onConfirm}
          >
            <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>
              {getSportConfig(tempSport).emoji}  START WITH {getSportConfig(tempSport).label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── GuidedSetupWizard ───────────────────────────────────────────────────────
export interface GuidedSetupWizardProps {
  visible: boolean;
  initialSport: string;
  initialCourts: number;
  initialGenderBalanced: boolean;
  initialAvoidRepeats: boolean;
  queueLength: number;
  onManagePlayers: () => void;
  onBatchAdd: () => void;
  onInviteQR: () => void;
  onFinish: (config: { sport: string; courts: number; genderBalanced: boolean; avoidRepeats: boolean }) => void;
  onClose: () => void;
}

export function GuidedSetupWizard({
  visible,
  initialSport,
  initialCourts,
  initialGenderBalanced,
  initialAvoidRepeats,
  queueLength,
  onManagePlayers,
  onBatchAdd,
  onInviteQR,
  onFinish,
  onClose,
}: GuidedSetupWizardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(1);
  const [sport, setSport] = useState(initialSport);
  const [courts, setCourts] = useState(initialCourts);
  const [genderBalanced, setGenderBalanced] = useState(initialGenderBalanced);
  const [avoidRepeats, setAvoidRepeats] = useState(initialAvoidRepeats);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setSport(initialSport);
      setCourts(initialCourts);
      setGenderBalanced(initialGenderBalanced);
      setAvoidRepeats(initialAvoidRepeats);
    }
  }, [visible]);

  const sportConfig = getSportConfig(sport);
  const TOTAL = 4;

  const Dots = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 6 }}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={{
          width: i + 1 === step ? 20 : 8, height: 8, borderRadius: 4,
          backgroundColor: i + 1 <= step ? colors.primary : colors.border,
        }} />
      ))}
    </View>
  );

  const Skip = () => (
    <TouchableOpacity style={{ marginTop: 16 }} onPress={onClose}>
      <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 12 }}>SKIP GUIDE</Text>
    </TouchableOpacity>
  );

  const renderStep1 = () => (
    <>
      <Text style={[styles.modalTitle, { fontSize: 18 }]}>👋  SETUP GUIDE</Text>
      <Dots />
      <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
        Let's get your session ready! First, choose your sport:
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setSport(key)}
            style={[styles.sportChip, sport === key && styles.sportChipActive]}
          >
            <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
            <Text style={{ color: sport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 10, fontSize: 13 }}>
        How many {getSportConfig(sport).court.toLowerCase()}s are you playing on?
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <TouchableOpacity onPress={() => setCourts(Math.max(1, courts - 1))} style={styles.mathBtn}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>-</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.primary, marginHorizontal: 28, fontWeight: 'bold', fontSize: 30 }}>{courts}</Text>
        <TouchableOpacity onPress={() => setCourts(Math.min(10, courts + 1))} style={styles.mathBtn}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.btnPrimary, { padding: 14 }]} onPress={() => setStep(2)}>
        <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>
          {sportConfig.emoji}  NEXT: ADD PLAYERS →
        </Text>
      </TouchableOpacity>
      <Skip />
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={[styles.modalTitle, { fontSize: 18 }]}>👥  ADD PLAYERS</Text>
      <Dots />
      <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
        Get players into the queue. Tap a method below — you can come back and add more anytime.
      </Text>
      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: colors.purple, padding: 14, marginBottom: 10 }]}
        onPress={() => { onClose(); onManagePlayers(); }}
      >
        <Text style={[styles.btnText, { textAlign: 'center' }]}>👤  ADD PLAYERS ONE BY ONE</Text>
        <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          Type each player's name and gender
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: colors.blueDark, padding: 14, marginBottom: 10 }]}
        onPress={() => { onClose(); onBatchAdd(); }}
      >
        <Text style={[styles.btnText, { textAlign: 'center' }]}>📋  BATCH ADD (PASTE NAMES)</Text>
        <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          Paste a list of names separated by commas
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: colors.greenDark, padding: 14, marginBottom: 20 }]}
        onPress={() => { onClose(); onInviteQR(); }}
      >
        <Text style={[styles.btnText, { textAlign: 'center' }]}>📷  INVITE BY QR CODE</Text>
        <Text style={{ color: colors.gray3, textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          Players scan the code to join themselves
        </Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setStep(1)}>
          <Text style={{ color: colors.gray1 }}>← BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStep(3)}>
          <Text style={{ color: colors.primary, fontWeight: 'bold' }}>NEXT: OPTIONS →</Text>
        </TouchableOpacity>
      </View>
      <Skip />
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={[styles.modalTitle, { fontSize: 18 }]}>⚙️  SMART OPTIONS</Text>
      <Dots />
      <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
        Tune how auto-pick works (you can change these in Settings anytime):
      </Text>
      <View style={[styles.settingsRow, { marginBottom: 20 }]}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>Gender Balanced</Text>
          <Text style={{ color: colors.gray3, fontSize: 12, marginTop: 2 }}>
            Prefer 2M + 2F in each game when possible
          </Text>
        </View>
        <Switch
          value={genderBalanced}
          onValueChange={setGenderBalanced}
          thumbColor={genderBalanced ? colors.primary : colors.gray3}
          trackColor={{ true: colors.purple, false: colors.border }}
        />
      </View>
      <View style={[styles.settingsRow, { marginBottom: 30 }]}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: colors.white, fontWeight: 'bold' }}>Avoid Repeat Opponents</Text>
          <Text style={{ color: colors.gray3, fontSize: 12, marginTop: 2 }}>
            Try not to pick the same matchups twice in a row
          </Text>
        </View>
        <Switch
          value={avoidRepeats}
          onValueChange={setAvoidRepeats}
          thumbColor={avoidRepeats ? colors.primary : colors.gray3}
          trackColor={{ true: colors.purple, false: colors.border }}
        />
      </View>
      <TouchableOpacity style={[styles.btnPrimary, { padding: 14, marginBottom: 14 }]} onPress={() => setStep(4)}>
        <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>NEXT: FINISH →</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setStep(2)}>
        <Text style={{ color: colors.gray1, textAlign: 'center' }}>← BACK</Text>
      </TouchableOpacity>
      <Skip />
    </>
  );

  const renderStep4 = () => (
    <>
      <Text style={[styles.modalTitle, { fontSize: 20 }]}>{sportConfig.emoji}  YOU'RE READY!</Text>
      <Dots />
      <View style={{ backgroundColor: colors.selectedBg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <Text style={{ color: colors.gray2, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>SESSION SUMMARY</Text>
        <Text style={{ color: colors.white, fontSize: 14, marginBottom: 6 }}>
          Sport: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{sportConfig.label}</Text>
        </Text>
        <Text style={{ color: colors.white, fontSize: 14, marginBottom: 6 }}>
          {sportConfig.court}s: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{courts}</Text>
        </Text>
        <Text style={{ color: colors.white, fontSize: 14, marginBottom: 6 }}>
          Players in queue: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{queueLength}</Text>
        </Text>
        <Text style={{ color: colors.white, fontSize: 14, marginBottom: 6 }}>
          Gender Balanced: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{genderBalanced ? 'Yes' : 'No'}</Text>
        </Text>
        <Text style={{ color: colors.white, fontSize: 14 }}>
          Avoid Repeats: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{avoidRepeats ? 'Yes' : 'No'}</Text>
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.btnPrimary, { padding: 16, marginBottom: 14 }]}
        onPress={() => onFinish({ sport, courts, genderBalanced, avoidRepeats })}
      >
        <Text style={[styles.btnText, { textAlign: 'center', fontSize: 16 }]}>🎮  LET'S PLAY!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setStep(3)}>
        <Text style={{ color: colors.gray1, textAlign: 'center' }}>← BACK</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView>
          <View style={[styles.modalContent, { marginVertical: 20 }]}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── SessionStartupModal ─────────────────────────────────────────────────────
export interface SessionStartupModalProps {
  visible: boolean;
  tempSport: string;
  startupCourts: number;
  savedQueueLength: number;
  onSelectSport: (key: string) => void;
  onChangeStartupCourts: (n: number) => void;
  onRestore: () => void;
  onReset: () => void;
  onContinue: () => void;
}

export function SessionStartupModal({
  visible,
  tempSport,
  startupCourts,
  savedQueueLength,
  onSelectSport,
  onChangeStartupCourts,
  onRestore,
  onReset,
  onContinue,
}: SessionStartupModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>SESSION SETUP</Text>

          <Text style={styles.sectionHeader}>SPORT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {(Object.entries(SPORTS) as [string, { label: string; emoji: string }][]).map(([key, s]) => (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectSport(key)}
                style={[styles.sportChip, tempSport === key && styles.sportChipActive]}
              >
                <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                <Text style={{ color: tempSport === key ? colors.black : colors.gray2, fontSize: 11, marginTop: 2 }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionHeader, { marginTop: 4 }]}>COURTS</Text>
          <View style={styles.settingsRow}>
            <Text style={{ color: colors.white, fontWeight: 'bold' }}>
              Active {getSportConfig(tempSport).court}s
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => onChangeStartupCourts(Math.max(1, startupCourts - 1))}
                style={styles.mathBtn}
              >
                <Text style={{ color: colors.white }}>-</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.primary, marginHorizontal: 20, fontWeight: 'bold', fontSize: 22 }}>
                {startupCourts}
              </Text>
              <TouchableOpacity
                onPress={() => onChangeStartupCourts(Math.min(10, startupCourts + 1))}
                style={styles.mathBtn}
              >
                <Text style={{ color: colors.white }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Restore previous queue if one was saved */}
          {savedQueueLength > 0 && (
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.blueDark, marginTop: 20, padding: 14 }]}
              onPress={onRestore}
            >
              <Text style={[styles.btnText, { textAlign: 'center' }]}>
                ♻️  RESTORE LAST SESSION'S QUEUE ({savedQueueLength} players)
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnDanger, { backgroundColor: colors.gray3, marginTop: 15 }]}
            onPress={onReset}
          >
            <Text style={[styles.btnText, { textAlign: 'center' }]}>RESET SESSION</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 10, padding: 14 }]}
            onPress={onContinue}
          >
            <Text style={[styles.btnText, { textAlign: 'center', fontSize: 15 }]}>CONTINUE SESSION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
