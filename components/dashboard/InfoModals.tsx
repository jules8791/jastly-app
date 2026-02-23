import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ColorSet, useTheme } from '../../contexts/theme-context';
import { Player, QueuePlayer } from '../../types';

// ─── Shared local styles ─────────────────────────────────────────────────────
const makeStyles = (C: ColorSet) => StyleSheet.create({
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: 'center', padding: 20, zIndex: 10 },
  modalContent: { backgroundColor: C.surface, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.primary, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 16 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  btnPrimary: { backgroundColor: C.purple, padding: 10, borderRadius: 6 },
  btnText: { color: C.white, fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  genderBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
});

// ─── ClubQRModal ─────────────────────────────────────────────────────────────
export interface ClubQRModalProps {
  visible: boolean;
  title: string;
  deepLink: string;
  onClose: () => void;
}

export function ClubQRModal({ visible, title, deepLink, onClose }: ClubQRModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Extract the clubId display string from the deepLink URL
  const clubId = deepLink.split('clubId=')[1] ?? '';
  const displayLink = deepLink.replace('https://', '');

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { alignItems: 'center' }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={{ color: colors.gray2, marginBottom: 20, textAlign: 'center' }}>
            Scan to join this session instantly
          </Text>
          <QRCode
            value={deepLink}
            size={220}
            color={colors.primary}
            backgroundColor={colors.surface}
          />
          <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 14, textAlign: 'center' }}>
            Or share the link:
          </Text>
          <Text selectable style={{ color: colors.gray2, fontSize: 11, textAlign: 'center', marginTop: 3, marginBottom: 4 }}>
            {displayLink}
          </Text>
          <Text style={{ color: colors.gray3, fontSize: 11, marginTop: 6, textAlign: 'center' }}>Club ID:</Text>
          <Text style={{ color: colors.primary, fontSize: 26, fontWeight: 'bold', letterSpacing: 4, marginTop: 6 }}>
            {clubId}
          </Text>
          <TouchableOpacity style={{ marginTop: 25 }} onPress={onClose}>
            <Text style={{ color: colors.gray1, fontSize: 16 }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── LeaderboardModal ────────────────────────────────────────────────────────
export interface LeaderboardModalProps {
  visible: boolean;
  leaderboard: Player[];
  onClose: () => void;
}

export function LeaderboardModal({ visible, leaderboard, onClose }: LeaderboardModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>LEADERBOARD</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {leaderboard.map((p: Player, i: number) => {
              const rate = (p.games || 0) > 0 ? Math.round((p.wins / p.games) * 100) : 0;
              return (
                <View key={i} style={[styles.modalItem, { alignItems: 'center' }]}>
                  <Text style={{ color: i < 3 ? colors.primary : colors.gray2, fontWeight: 'bold', width: 28 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.white, fontWeight: 'bold' }}>{p.name}</Text>
                    <Text style={{ color: colors.gray3, fontSize: 11 }}>{p.wins || 0}W  /  {p.games || 0}G</Text>
                  </View>
                  <Text style={{ color: colors.green, fontWeight: 'bold' }}>{rate}%</Text>
                </View>
              );
            })}
            {leaderboard.length === 0 && (
              <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>No stats yet.</Text>
            )}
          </ScrollView>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onClose}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MatchHistoryModal ───────────────────────────────────────────────────────
export interface MatchHistoryEntry {
  date: string;
  court: number;
  team1: string[];
  team2: string[];
  winners: string[];
}

export interface MatchHistoryModalProps {
  visible: boolean;
  matchHistory: MatchHistoryEntry[];
  courtLabel: string;
  onClose: () => void;
}

export function MatchHistoryModal({ visible, matchHistory, courtLabel, onClose }: MatchHistoryModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>MATCH HISTORY</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {matchHistory.length === 0 ? (
              <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>No matches played yet.</Text>
            ) : (
              matchHistory.map((m: MatchHistoryEntry, i: number) => {
                const date = new Date(m.date);
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <View key={i} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: colors.gray2, fontSize: 11 }}>{courtLabel} {m.court}  •  {timeStr}</Text>
                      {m.winners?.length > 0 && (
                        <Text style={{ color: colors.primary, fontSize: 11 }}>🏆 {m.winners.join(' & ')}</Text>
                      )}
                    </View>
                    <Text style={{ color: colors.white, fontSize: 13 }}>
                      <Text style={{ color: m.winners?.includes(m.team1[0]) || m.winners?.includes(m.team1[1]) ? colors.primary : colors.white }}>
                        {m.team1?.join(' & ')}
                      </Text>
                      <Text style={{ color: colors.gray3 }}> vs </Text>
                      <Text style={{ color: m.winners?.includes(m.team2[0]) || m.winners?.includes(m.team2[1]) ? colors.primary : colors.white }}>
                        {m.team2?.join(' & ')}
                      </Text>
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onClose}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SystemLogsModal ─────────────────────────────────────────────────────────
export interface SystemLogsModalProps {
  visible: boolean;
  logs: string[];
  onClose: () => void;
}

export function SystemLogsModal({ visible, logs, onClose }: SystemLogsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>SYSTEM LOGS</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {logs.length === 0 ? (
              <Text style={{ color: colors.gray3, textAlign: 'center', marginTop: 20 }}>
                No logs yet. (Enable logging in Settings)
              </Text>
            ) : (
              logs.map((log, i) => (
                <Text key={i} style={{ color: colors.gray2, fontSize: 12, marginBottom: 4, lineHeight: 18 }}>{log}</Text>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onClose}>
            <Text style={{ color: colors.gray1, textAlign: 'center' }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── HelpModal ───────────────────────────────────────────────────────────────
export interface HelpModalProps {
  visible: boolean;
  sportEmoji: string;
  courtLabel: string;
  onClose: () => void;
}

export function HelpModal({ visible, sportEmoji, courtLabel, onClose }: HelpModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sections: { emoji: string; title: string; items: string[] }[] = [
    {
      emoji: '🏁', title: 'Starting a Session',
      items: [
        'When you open the app as a host, you\'ll be asked to choose your sport and number of active courts.',
        'Tap RESTORE to reload your last session\'s queue, or RESET for a fresh start.',
        'You can change sport, courts and other settings any time via the ⚙️ Settings button.',
      ],
    },
    {
      emoji: '👥', title: 'The Queue',
      items: [
        'Add players to the queue using the text input at the top — type a name and tap ADD.',
        'Tap a player\'s row to expand options: move up/down, mark as resting, or remove them.',
        'Players marked as resting are skipped by auto-pick and shown with a 💤 indicator.',
        'Drag the ☰ handle on a player\'s row to reorder the queue manually.',
        'The queue order determines who plays next — first players in line get priority.',
      ],
    },
    {
      emoji: '🎯', title: 'Selecting Players for a Court',
      items: [
        `Tap individual players in the queue to select them (highlighted in ${sportEmoji} colour).`,
        `Once you have the right number selected (depends on sport), tap ASSIGN COURT.`,
        'Or use AUTO-PICK to let the app choose players automatically from the top of the queue.',
        'Auto-pick respects gender balance when enabled in Settings.',
      ],
    },
    {
      emoji: '🏟️', title: `${courtLabel}s`,
      items: [
        `Active ${courtLabel.toLowerCase()}s are shown below the queue.`,
        `Each ${courtLabel.toLowerCase()} shows who is currently playing and when they started.`,
        `Tap a ${courtLabel.toLowerCase()} card to finish the match — players are sent back to the queue.`,
        'The winner team can be selected when finishing a match, updating the leaderboard.',
        `You can add or remove ${courtLabel.toLowerCase()}s in Settings.`,
      ],
    },
    {
      emoji: '📋', title: 'Player Roster',
      items: [
        'The roster stores your regular players so you can add them quickly each session.',
        'Tap ROSTER to open it — add new players or tap a name to instantly add them to the queue.',
        'Player stats (games played, wins) are tracked per sport.',
        'You can delete players from the roster by tapping their entry.',
      ],
    },
    {
      emoji: '🏆', title: 'Leaderboard',
      items: [
        'Tap LEADERBOARD to see win rates for all players in your roster.',
        'Stats are based on match history from your current club.',
        'Use EXPORT STATS to share a summary of the session.',
      ],
    },
    {
      emoji: '📱', title: 'Guest Joining',
      items: [
        'Guests don\'t need an account — they just need your Club ID.',
        'Tap your club name / ID at the top to show the QR code.',
        'Guests scan the QR code or enter the Club ID manually on the join screen.',
        'Once joined, guests see a live read-only view of the queue and their position.',
        'Set a join password in Settings to prevent unauthorised access.',
      ],
    },
    {
      emoji: '🔊', title: 'Announcements (TTS)',
      items: [
        'When a match starts the app reads out the players and court number.',
        'Toggle sound on/off with the 🔊 button. Enable/disable TTS in Settings.',
        'Repeat announcements: automatically re-read the announcement at set intervals.',
        'Countdown: counts down seconds before reading the announcement.',
      ],
    },
    {
      emoji: '⚙️', title: 'Settings',
      items: [
        'Sport — change the sport for your club (affects player count, terminology).',
        'Active courts — increase or decrease how many courts are in play.',
        'Club name & password — rename your club or require a password to join.',
        'Gender balance — auto-pick tries to split teams evenly by gender.',
        'Avoid repeats — auto-pick avoids pairing players who just played together.',
        'PIN lock — require a PIN to access host controls.',
        'Dark / light mode — toggle the app theme.',
      ],
    },
    {
      emoji: '🗑️', title: 'Full Wipe',
      items: [
        'Full Wipe (in Settings) clears the queue, courts, and match history.',
        'Player roster and club settings are kept.',
        'Use this at the start of a new session to reset everything.',
      ],
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <Text style={styles.modalTitle}>HOW TO USE QUEUE MASTER</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.title} style={{ marginBottom: 22 }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
                  {section.emoji}  {section.title}
                </Text>
                {section.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
                    <Text style={{ color: colors.gray2, marginRight: 6, marginTop: 1 }}>•</Text>
                    <Text style={{ color: colors.gray1, fontSize: 13, flex: 1, lineHeight: 19 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 8 }]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, { textAlign: 'center' }]}>GOT IT</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── PlayerProfileModal ──────────────────────────────────────────────────────
export interface PlayerProfileModalProps {
  visible: boolean;
  player: Player | null;
  courtOccupants: Record<string, QueuePlayer[]>;
  waitingList: QueuePlayer[];
  sportEmoji: string;
  courtLabel: string;
  onClose: () => void;
}

export function PlayerProfileModal({
  visible,
  player,
  courtOccupants,
  waitingList,
  sportEmoji,
  courtLabel,
  onClose,
}: PlayerProfileModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { minWidth: 260 }]}>
          {player && (() => {
            const p: Player = player;
            const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
            const queuePos = (waitingList || []).findIndex((w: QueuePlayer) => w.name === p.name && !w.isResting);
            const onCourt = Object.entries(courtOccupants || {}).find(([, players]) =>
              (players as QueuePlayer[]).some((pl: QueuePlayer) => pl.name === p.name)
            );
            return (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue, width: 28, height: 28, borderRadius: 14, marginRight: 12 }]}>
                    <Text style={{ color: colors.white, fontSize: 14, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
                  </View>
                  <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1 }]}>{p.name}</Text>
                  <TouchableOpacity onPress={onClose} style={{ paddingLeft: 10 }}>
                    <Text style={{ color: colors.white, fontSize: 28, fontWeight: 'bold', lineHeight: 28 }}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: colors.border, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 28, fontWeight: 'bold' }}>{p.games || 0}</Text>
                      <Text style={{ color: colors.gray2, fontSize: 11 }}>GAMES</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.green, fontSize: 28, fontWeight: 'bold' }}>{p.wins || 0}</Text>
                      <Text style={{ color: colors.gray2, fontSize: 11 }}>WINS</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 28, fontWeight: 'bold' }}>{winRate}%</Text>
                      <Text style={{ color: colors.gray2, fontSize: 11 }}>WIN RATE</Text>
                    </View>
                  </View>
                </View>

                <View style={{ marginBottom: 8 }}>
                  {onCourt ? (
                    <Text style={{ color: colors.green, textAlign: 'center', fontWeight: 'bold' }}>
                      {sportEmoji} Playing on {courtLabel} {parseInt(onCourt[0]) + 1}
                    </Text>
                  ) : queuePos >= 0 ? (
                    <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: 'bold' }}>
                      #{queuePos + 1} in queue
                    </Text>
                  ) : (
                    <Text style={{ color: colors.gray2, textAlign: 'center' }}>Not currently in queue</Text>
                  )}
                </View>

                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10, padding: 12 }]} onPress={onClose}>
                  <Text style={[styles.btnText, { textAlign: 'center' }]}>CLOSE</Text>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      </View>
    </Modal>
  );
}
