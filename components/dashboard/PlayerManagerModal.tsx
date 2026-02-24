import React, { useMemo, useState } from 'react';
import {
  Modal, ScrollView, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { Club, Player, QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

interface PlayerManagerModalProps {
  visible: boolean;
  club: Club;
  isHost: boolean;
  isPowerGuest: boolean;
  myName: string;
  sportLabel: string;
  stagedToAdd: string[];
  searchQuery: string;
  showAvailableOnly: boolean;
  sortOption: 'Name A-Z' | 'Games Played' | 'Wins';
  isSavingPlayer: boolean;
  isProcessingAction: boolean;
  displayRoster: Player[];
  onClose: () => void;
  onSearchChange: (q: string) => void;
  onToggleAvailableOnly: () => void;
  onSortChange: (opt: 'Name A-Z' | 'Games Played' | 'Wins') => void;
  onToggleStaged: (name: string) => void;
  onSelectAll: () => void;
  onAddStagedToQueue: () => void;
  onSavePlayer: (name: string, gender: string, editingName: string | null) => void;
  onDeletePlayer: (name: string) => void;
  onViewProfile: (player: Player | QueuePlayer) => void;
}

export function PlayerManagerModal({
  visible,
  club,
  isHost,
  isPowerGuest,
  myName,
  stagedToAdd,
  searchQuery,
  showAvailableOnly,
  sortOption,
  isSavingPlayer,
  isProcessingAction,
  displayRoster,
  onClose,
  onSearchChange,
  onToggleAvailableOnly,
  onSortChange,
  onToggleStaged,
  onSelectAll,
  onAddStagedToQueue,
  onSavePlayer,
  onDeletePlayer,
  onViewProfile,
}: PlayerManagerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Internal state — only used within this modal
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newGender, setNewGender] = useState('M');

  const waitingList: QueuePlayer[] = club.waiting_list || [];

  const isAvailable = (pName: string) => {
    const inQueue = waitingList.some((w: QueuePlayer) => w.name === pName);
    const onCourt = Object.values(club.court_occupants || {}).flat().some((c: QueuePlayer) => c.name === pName);
    return !inQueue && !onCourt;
  };

  const handleSave = () => {
    onSavePlayer(newPlayerName, newGender, editingPlayerName);
    // Reset local form state after save attempt
    // (parent controls whether to show success by calling this callback)
    setNewPlayerName('');
    setEditingPlayerName(null);
    setShowNewPlayer(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.fullModalOverlay}>
        <View style={styles.fullModalContent}>
          {showNewPlayer ? (
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingPlayerName ? 'EDIT PLAYER' : 'NEW PLAYER'}</Text>
                <TouchableOpacity onPress={() => setShowNewPlayer(false)} style={{ paddingHorizontal: 10 }}>
                  <Text style={{ color: colors.white, fontSize: 32, fontWeight: 'bold', lineHeight: 32 }}>×</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Player name..."
                placeholderTextColor={colors.gray2}
                autoCapitalize="characters"
                maxLength={20}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                {['M', 'F'].map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setNewGender(g)}
                    style={[styles.genderBtn, { backgroundColor: newGender === g ? (g === 'M' ? colors.blue : colors.pink) : colors.borderSoft }]}
                  >
                    <Text style={{ color: colors.white, fontWeight: 'bold' }}>{g === 'M' ? '♂ MALE' : '♀ FEMALE'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btnPrimary, { padding: 15, opacity: isSavingPlayer ? 0.5 : 1 }]}
                onPress={handleSave}
                disabled={isSavingPlayer}
              >
                <Text style={[styles.btnText, { textAlign: 'center' }]}>
                  {isSavingPlayer ? 'SAVING...' : 'SAVE'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isHost ? `MASTER ROSTER (${displayRoster.length})` : `QUEUE (${waitingList.length})`}
                </Text>
                <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 10 }}>
                  <Text style={{ color: colors.white, fontSize: 32, fontWeight: 'bold', lineHeight: 32 }}>×</Text>
                </TouchableOpacity>
              </View>

              {(isHost || isPowerGuest) && (
                <TouchableOpacity
                  onPress={() => { setEditingPlayerName(null); setNewPlayerName(''); setNewGender('M'); setShowNewPlayer(true); }}
                  style={[styles.btnPrimary, { backgroundColor: colors.blue, marginBottom: 15, padding: 15 }]}
                >
                  <Text style={[styles.btnText, { textAlign: 'center', fontSize: 16 }]}>+ REGISTER NEW PLAYER</Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={[styles.input, { marginBottom: 10, padding: 10 }]}
                placeholder="Search players..."
                placeholderTextColor={colors.gray2}
                value={searchQuery}
                onChangeText={onSearchChange}
              />

              {isHost && (
                <View style={[styles.toolbar, { flexWrap: 'wrap', gap: 8 }]}>
                  <TouchableOpacity onPress={onToggleAvailableOnly} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: showAvailableOnly ? colors.primary : colors.gray2, fontSize: 22, marginRight: 5 }}>
                      {showAvailableOnly ? '☑' : '☐'}
                    </Text>
                    <Text style={{ color: colors.white }}>Hide Active/Playing</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    {(['Name A-Z', 'Games Played', 'Wins'] as const).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => onSortChange(opt)}
                        style={{ marginRight: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: sortOption === opt ? colors.purple : colors.border }}
                      >
                        <Text style={{ color: colors.white, fontSize: 10 }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flex: 1, marginVertical: 10 }}>
                <ScrollView>
                  {(isHost ? displayRoster : waitingList).map((p: any, i: number) => {
                    const avail = isHost ? isAvailable(p.name) : true;
                    const staged = stagedToAdd.includes(p.name);
                    const isMe = p.name === myName;
                    return (
                      <View key={i} style={[styles.rosterRow, staged && { backgroundColor: 'rgba(76,175,80,0.2)' }, isMe && { backgroundColor: 'rgba(76,175,80,0.1)' }]}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          disabled={!avail || !isHost}
                          onPress={() => {
                            if (!isHost) return;
                            onToggleStaged(p.name);
                          }}
                        >
                          {isHost && (
                            <View style={[styles.checkbox, staged && { backgroundColor: colors.green, borderColor: colors.green }, !avail && { opacity: 0.2 }]}>
                              {staged && <Text style={{ color: colors.white, fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                            </View>
                          )}
                          <View style={[styles.genderBadge, { backgroundColor: p.gender === 'F' ? colors.pink : colors.blue, width: 14, height: 14, marginRight: 8 }]}>
                            <Text style={{ color: colors.white, fontSize: 8, fontWeight: 'bold' }}>{p.gender || 'M'}</Text>
                          </View>
                          {!isHost && (
                            <Text style={{ color: colors.gray3, width: 22, fontSize: 12 }}>{i + 1}</Text>
                          )}
                          <Text style={{ color: avail ? colors.white : colors.gray3, fontSize: 16, fontWeight: 'bold' }}>
                            {p.name}{isMe ? ' (you)' : ''}{p.isResting ? ' 💤' : ''}
                          </Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity style={{ padding: 10 }} onPress={() => onViewProfile(p)}>
                            <Text style={{ fontSize: 16 }}>📊</Text>
                          </TouchableOpacity>
                          {(isHost || isPowerGuest) && (
                            <>
                              <TouchableOpacity style={{ padding: 10 }} onPress={() => {
                                setEditingPlayerName(p.name);
                                setNewPlayerName(p.name);
                                setNewGender(p.gender || 'M');
                                setShowNewPlayer(true);
                              }}>
                                <Text style={{ fontSize: 16 }}>✏️</Text>
                              </TouchableOpacity>
                              {isHost && (
                                <TouchableOpacity style={{ padding: 10 }} onPress={() => onDeletePlayer(p.name)}>
                                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              {isHost && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <TouchableOpacity onPress={onSelectAll} style={{ padding: 15, justifyContent: 'center' }}>
                    <Text style={{ color: colors.white, fontWeight: 'bold' }}>SELECT ALL</Text>
                  </TouchableOpacity>
                  {stagedToAdd.length > 0 && (
                    <TouchableOpacity
                      onPress={onAddStagedToQueue}
                      disabled={isProcessingAction}
                      style={[styles.btnPrimary, { padding: 15, backgroundColor: colors.green, flex: 1, marginLeft: 10, opacity: isProcessingAction ? 0.5 : 1 }]}
                    >
                      <Text style={[styles.btnText, { textAlign: 'center', fontSize: 14 }]}>
                        {isProcessingAction ? 'ADDING...' : `ADD ${stagedToAdd.length} TO QUEUE`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
