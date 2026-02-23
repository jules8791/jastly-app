import React, { useMemo } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput,
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
});

// ─── CourtAssignModal ────────────────────────────────────────────────────────
export interface CourtAssignModalProps {
  visible: boolean;
  selectedQueueIdx: number[];
  waitingList: QueuePlayer[];
  activeCourts: number;
  courtOccupants: Record<string, QueuePlayer[]>;
  courtLabel: string;
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
          {selectedQueueIdx.length === 4 && (
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
  onToggleWinner: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MatchResultModal({
  visible,
  courtResult,
  winners,
  onToggleWinner,
  onConfirm,
  onCancel,
}: MatchResultModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>WHO WON?</Text>
          {(courtResult?.players || []).map((p: QueuePlayer, i: number) => (
            <TouchableOpacity key={i} style={styles.modalItem} onPress={() => onToggleWinner(p.name)}>
              <Text style={{ color: colors.white }}>{p.name}</Text>
              <Text style={{ color: winners.includes(p.name) ? colors.primary : colors.gray4, fontWeight: 'bold' }}>WINNER</Text>
            </TouchableOpacity>
          ))}
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
