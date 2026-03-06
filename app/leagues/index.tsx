/**
 * app/leagues/index.tsx — My leagues list + create league
 * Only available to signed-in (non-anonymous) hosts.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../supabase';
import { ColorSet, useTheme } from '../../contexts/theme-context';
import { getSportConfig, SPORTS } from '../../constants/sports';
import { getFormatOptionsForSport } from '../../constants/leagueFormats';
import type { League } from '../../types';

export default function LeaguesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState('badminton');
  const [newDesc, setNewDesc] = useState('');
  const [newFormat, setNewFormat] = useState('NONE');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user;
      if (!u || u.is_anonymous) {
        Alert.alert('Sign in required', 'Please sign in with an email account to manage leagues.');
        router.back();
        return;
      }
      setUid(u.id);
      fetchLeagues(u.id);
    });
  }, []);

  const fetchLeagues = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('leagues')
      .select('*')
      .eq('owner_uid', userId)
      .order('created_at', { ascending: false });
    setLeagues((data as League[]) ?? []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    if (!uid) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('leagues')
      .insert([{ name: newName.trim(), sport: newSport, description: newDesc.trim() || null, owner_uid: uid, format_type: newFormat }])
      .select()
      .single();
    setCreating(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowCreate(false);
    setNewName(''); setNewSport('badminton'); setNewDesc('');
    router.push(`/leagues/${data.id}`);
  };

  const renderLeague = useCallback(({ item }: { item: League }) => {
    const cfg = getSportConfig(item.sport);
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/leagues/${item.id}`)}>
        <Text style={styles.cardEmoji}>{cfg.emoji}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{cfg.label}</Text>
          {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }, [styles]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Leagues</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : leagues.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No leagues yet.</Text>
          <Text style={styles.emptyHint}>Tap "+ New" to create your first league.</Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={l => l.id}
          renderItem={renderLeague}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* Create League Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create League</Text>

            <Text style={styles.label}>League Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Tuesday Badminton League"
              placeholderTextColor={colors.gray2}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.label}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {Object.entries(SPORTS).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.sportChip, newSport === key && styles.sportChipActive]}
                  onPress={() => { setNewSport(key); setNewFormat('NONE'); }}
                >
                  <Text style={[styles.sportChipText, newSport === key && styles.sportChipTextActive]}>
                    {cfg.emoji} {cfg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Any notes about the league"
              placeholderTextColor={colors.gray2}
              multiline
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <Text style={styles.label}>Format (Order of Play)</Text>
            <View style={{ marginBottom: 14 }}>
              {getFormatOptionsForSport(newSport).map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sportChip, newFormat === opt.value && styles.sportChipActive, { marginBottom: 6, borderRadius: 8 }]}
                  onPress={() => setNewFormat(opt.value)}
                >
                  <Text style={[styles.sportChipText, newFormat === opt.value && styles.sportChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: ColorSet) {
  return StyleSheet.create({
    screen:   { flex: 1, backgroundColor: C.bg },
    header:   { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
    back:     { paddingRight: 12 },
    backText: { fontSize: 28, color: C.primary, lineHeight: 32 },
    title:    { flex: 1, fontSize: 20, fontWeight: '700', color: C.white },
    addBtn:   { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
    addBtnText: { color: C.black, fontWeight: '700', fontSize: 14 },

    empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 18, fontWeight: '600', color: C.white, marginBottom: 8 },
    emptyHint: { fontSize: 14, color: C.gray2, textAlign: 'center' },

    card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, marginBottom: 12, padding: 16 },
    cardEmoji: { fontSize: 28, marginRight: 14 },
    cardBody:  { flex: 1 },
    cardName:  { fontSize: 16, fontWeight: '700', color: C.white },
    cardSub:   { fontSize: 13, color: C.gray2, marginTop: 2 },
    cardDesc:  { fontSize: 13, color: C.gray2, marginTop: 4 },
    chevron:   { fontSize: 22, color: C.gray2, marginLeft: 8 },

    // Modal
    overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal:     { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.white, marginBottom: 16 },
    label:     { fontSize: 13, fontWeight: '600', color: C.gray2, marginBottom: 6 },
    input:     { backgroundColor: C.bg, borderRadius: 8, padding: 12, color: C.white, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: C.border },

    sportChip:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
    sportChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    sportChipText:       { color: C.gray2, fontSize: 13, fontWeight: '600' },
    sportChipTextActive: { color: C.black },

    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn:    { flex: 1, borderRadius: 10, padding: 14, backgroundColor: C.bg, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    cancelBtnText: { color: C.white, fontWeight: '600' },
    confirmBtn:    { flex: 1, borderRadius: 10, padding: 14, backgroundColor: C.primary, alignItems: 'center' },
    confirmBtnText: { color: C.black, fontWeight: '700' },
  });
}
