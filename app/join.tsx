/**
 * join.tsx — Deep link handler
 * Opened when a user taps a QR-code URL from outside the app:
 *   jastlyapp://join?clubId=CLUB-XXXXX
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../supabase';
import { ColorSet, useTheme } from '../contexts/theme-context';

export default function JoinScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { clubId: paramClubId } = useLocalSearchParams<{ clubId: string }>();

  const [clubId] = useState((paramClubId || '').toUpperCase());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clubId) { router.replace('/'); return; }
    AsyncStorage.getItem('guestName').then(saved => { if (saved) setName(saved); });
    // Check if club exists and requires password — server-side only, hash never sent to client
    Promise.all([
      supabase.from('clubs').select('id, club_name').eq('id', clubId).maybeSingle(),
      supabase.rpc('validate_join_password', { p_club_id: clubId, p_password_hash: '' }),
    ]).then(([{ data }, { data: rpc }]) => {
      if (!data) { Alert.alert('Club Not Found', 'No club found with that ID.'); router.replace('/'); return; }
      setClubName(data.club_name || clubId);
      setNeedsPassword(!!(rpc as any)?.requires_password);
      setIsLoading(false);
    });
  }, [clubId]);

  const hashPassword = (pw: string): Promise<string> =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::${pw}::club`);

  const handleJoin = async () => {
    const cleanName = name.trim()
      .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);
    if (!cleanName) { Alert.alert('Name Required', 'Enter your name to join.'); return; }

    setIsLoading(true);
    try {
      // Validate password server-side — hash never exposed to client
      if (needsPassword) {
        if (!password.trim()) { Alert.alert('Password Required', 'This club requires a password.'); setIsLoading(false); return; }
        const hash = await hashPassword(password.trim());
        const { data: rpc } = await supabase.rpc('validate_join_password', { p_club_id: clubId, p_password_hash: hash });
        if (!(rpc as any)?.valid) { Alert.alert('Wrong Password', 'Incorrect password.'); setIsLoading(false); return; }
      }

      const { data: club, error } = await supabase
        .from('clubs')
        .select('id, club_name, waiting_list, court_occupants')
        .eq('id', clubId)
        .maybeSingle();

      if (error || !club) { Alert.alert('Not Found', 'Club no longer exists.'); router.replace('/'); return; }

      const inQueue = (club.waiting_list || []).some((p: any) => p.name === cleanName);
      const onCourt = Object.values(club.court_occupants || {}).flat().some((p: any) => (p as any).name === cleanName);

      if (!inQueue && !onCourt) {
        await supabase.from('requests').insert({
          club_id: clubId,
          action: 'batch_join',
          payload: { name: cleanName, players: [{ name: cleanName, gender: 'M' }] },
        });
      }

      await AsyncStorage.multiSet([
        ['guestName', cleanName],
        ['currentClubId', clubId],
        ['isHost', 'false'],
      ]);

      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.header}>🏸 JOINING...</Text>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏸 JOIN SESSION</Text>
      <Text style={styles.clubName}>{clubName}</Text>
      <Text style={styles.clubId}>{clubId}</Text>

      <TextInput
        style={styles.input}
        placeholder="Your Name"
        placeholderTextColor={colors.gray3}
        value={name}
        onChangeText={setName}
        autoCapitalize="characters"
        autoFocus
        maxLength={20}
      />

      {needsPassword && (
        <TextInput
          style={styles.input}
          placeholder="Session Password"
          placeholderTextColor={colors.gray3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      )}

      <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
        <Text style={styles.btnText}>JOIN AS PLAYER</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.replace('/')}>
        <Text style={{ color: colors.gray3, textAlign: 'center' }}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: ColorSet) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 80 },
  header: { color: C.primary, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  clubName: { color: C.white, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  clubId: { color: C.gray3, fontSize: 12, textAlign: 'center', marginBottom: 40, letterSpacing: 2 },
  input: { backgroundColor: C.surface, color: C.white, padding: 15, borderRadius: 5, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  joinBtn: { backgroundColor: C.deepBlue, padding: 20, borderRadius: 8, marginTop: 8 },
  btnText: { color: C.white, fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
});
