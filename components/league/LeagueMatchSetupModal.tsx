/**
 * components/league/LeagueMatchSetupModal.tsx
 *
 * Two-step modal for starting a league fixture:
 *   Step 1 — Pick the Order of Play method (if the format has >1 method)
 *   Step 2 — Verify slot assignments + choose new or existing club session
 *
 * On confirm it writes to AsyncStorage and navigates to /dashboard.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../supabase';
import { useTheme } from '../../contexts/theme-context';
import { LEAGUE_FORMATS, LeagueFormatDef } from '../../constants/leagueFormats';
import {
  generateLeagueQueue, validateRosterForFormat,
} from '../../utils/leagueLogic';
import type { League, LeagueFixture, LeagueTeam } from '../../types';

interface HostClub {
  id: string;
  club_name: string | null;
  sport: string | null;
}

interface Props {
  visible: boolean;
  league: League;
  fixture: LeagueFixture;
  homeTeam: LeagueTeam;
  awayTeam: LeagueTeam;
  uid: string;
  onDone: () => void;
  onCancel: () => void;
}

type Step = 'method' | 'session';

export function LeagueMatchSetupModal({
  visible, league, fixture, homeTeam, awayTeam, uid, onDone, onCancel,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const format: LeagueFormatDef | null = LEAGUE_FORMATS[league.format_type ?? ''] ?? null;
  const methodKeys = format ? Object.keys(format.methods) : [];

  const [step, setStep]               = useState<Step>('method');
  const [selectedMethod, setMethod]   = useState(methodKeys[0] ?? 'method1');
  const [hostClubs, setHostClubs]     = useState<HostClub[]>([]);
  const [launching, setLaunching]     = useState(false);

  // Validation warning
  const warning = format
    ? validateRosterForFormat(league.format_type!, homeTeam.player_names, awayTeam.player_names)
    : null;

  useEffect(() => {
    if (visible && format) {
      setStep(methodKeys.length > 1 ? 'method' : 'session');
      setMethod(methodKeys[0] ?? 'method1');
      // Pre-fetch host clubs for the session picker
      supabase
        .from('clubs').select('id, club_name, sport').eq('host_uid', uid).order('club_name')
        .then(({ data }) => setHostClubs((data as HostClub[]) ?? []));
    }
  }, [visible]);

  // ── Launch helpers ──────────────────────────────────────────────────────────

  const storeAndNavigate = async (clubId: string) => {
    const queue = generateLeagueQueue(
      league.format_type!,
      selectedMethod,
      homeTeam.player_names,
      awayTeam.player_names,
      fixture.home_team_id,
      fixture.away_team_id,
      homeTeam.name,
      awayTeam.name,
    );
    await supabase.from('league_fixtures')
      .update({ status: 'in_progress', club_id: clubId })
      .eq('id', fixture.id);

    await AsyncStorage.multiSet([
      ['currentClubId',                   clubId],
      ['isHost',                          'true'],
      ['current_fixture_id',              fixture.id],
      ['current_fixture_home_team_id',    fixture.home_team_id],
      ['current_fixture_away_team_id',    fixture.away_team_id],
      ['current_league_queue',            JSON.stringify(queue)],
      // No pre-existing results
      ['current_league_rubber_results',   JSON.stringify([])],
    ]);
    onDone();
    router.replace('/dashboard');
  };

  const launchNew = async () => {
    if (!uid) return;
    setLaunching(true);
    try {
      const format = LEAGUE_FORMATS[league.format_type!];
      const allPlayers = [
        ...homeTeam.player_names.map((name, i) => ({
          name,
          gender: (format?.slotRoles[i]?.gender ?? 'M') as 'M' | 'F',
        })),
        ...awayTeam.player_names.map((name, i) => ({
          name,
          gender: (format?.slotRoles[i]?.gender ?? 'M') as 'M' | 'F',
        })),
      ];
      const clubName = `${homeTeam.name} vs ${awayTeam.name} — ${league.name}`;
      const newClubId = 'CLUB-' +
        Math.random().toString(36).substring(2, 7).toUpperCase() +
        Math.random().toString(36).substring(2, 7).toUpperCase();

      const { error } = await supabase.from('clubs').insert([{
        id: newClubId, host_uid: uid, club_name: clubName,
        sport: league.sport ?? 'badminton',
        waiting_list: allPlayers, active_courts: 1,
      }]);
      if (error) { Alert.alert('Error', error.message); return; }
      await storeAndNavigate(newClubId);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLaunching(false);
    }
  };

  const launchExisting = async (club: HostClub) => {
    setLaunching(true);
    try {
      await storeAndNavigate(club.id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLaunching(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet:      { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '90%' },
    title:      { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: 4 },
    subtitle:   { fontSize: 13, color: colors.gray2, marginBottom: 20 },
    warning:    { backgroundColor: colors.red + '22', borderRadius: 8, padding: 12, marginBottom: 16 },
    warningTxt: { color: colors.red, fontSize: 13 },
    sectionHdr: { fontSize: 12, fontWeight: '700', color: colors.gray2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
    methodBtn:  { borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    methodTxt:  { fontWeight: '700', fontSize: 15 },
    slotRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    slotLabel:  { width: 120, fontSize: 12, color: colors.gray2 },
    slotName:   { flex: 1, fontSize: 13, color: colors.white, fontWeight: '600' },
    launchOpt:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    launchEmoji:{ fontSize: 22, marginRight: 12 },
    launchTitle:{ fontSize: 14, fontWeight: '700', color: colors.white },
    launchSub:  { fontSize: 11, color: colors.gray2, marginTop: 2 },
    nextBtn:    { backgroundColor: colors.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
    nextTxt:    { color: colors.black, fontWeight: '700', fontSize: 16 },
    cancelTxt:  { color: colors.gray1, textAlign: 'center', marginTop: 16 },
    backBtn:    { marginBottom: 8 },
    backTxt:    { color: colors.primary, fontSize: 14 },
  });

  if (!format) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <ScrollView>
          <View style={s.sheet}>
            <Text style={s.title}>Order of Play</Text>
            <Text style={s.subtitle}>{homeTeam.name} vs {awayTeam.name} · {format.label}</Text>

            {warning && (
              <View style={s.warning}>
                <Text style={s.warningTxt}>⚠️  {warning}</Text>
              </View>
            )}

            {/* ── STEP 1: Method picker ── */}
            {step === 'method' && (
              <>
                <Text style={s.sectionHdr}>Captains' Agreement — Pick Method</Text>
                <Text style={{ color: colors.gray2, fontSize: 13, marginBottom: 16 }}>
                  {format.description}{'\n'}If no agreement, Method 1 is used by default.
                </Text>
                {methodKeys.map((key, i) => {
                  const active = selectedMethod === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.methodBtn, { backgroundColor: active ? colors.primary : colors.bg }]}
                      onPress={() => setMethod(key)}
                    >
                      <Text style={[s.methodTxt, { color: active ? colors.black : colors.white }]}>
                        {key === 'method1' ? 'Method 1 (Default)' :
                         key === 'method2' ? 'Method 2' :
                         key === 'method3' ? 'Method 3' :
                         key === 'standard' ? 'Standard Order' : key}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={s.nextBtn} onPress={() => setStep('session')}>
                  <Text style={s.nextTxt}>Confirm Method →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: Slot preview + session choice ── */}
            {step === 'session' && (
              <>
                {methodKeys.length > 1 && (
                  <TouchableOpacity style={s.backBtn} onPress={() => setStep('method')}>
                    <Text style={s.backTxt}>‹ Change method</Text>
                  </TouchableOpacity>
                )}

                <Text style={s.sectionHdr}>
                  Slot Assignment — {selectedMethod === 'standard' ? 'Standard Order' : selectedMethod.replace('method', 'Method ')}
                </Text>
                <Text style={{ color: colors.gray2, fontSize: 12, marginBottom: 8 }}>
                  Verify roster order matches the slot labels. Edit in the Teams tab if needed.
                </Text>

                {/* Home team slots */}
                <Text style={[s.sectionHdr, { color: colors.primary }]}>{homeTeam.name} (Home)</Text>
                {format.slotRoles.map((role, i) => (
                  <View key={i} style={s.slotRow}>
                    <Text style={s.slotLabel}>{role.label}{role.gender ? ` (${role.gender})` : ''}</Text>
                    <Text style={s.slotName}>{homeTeam.player_names[i] ?? '—'}</Text>
                  </View>
                ))}

                {/* Away team slots */}
                <Text style={[s.sectionHdr, { color: colors.blue }]}>{awayTeam.name} (Away)</Text>
                {format.slotRoles.map((role, i) => (
                  <View key={i} style={s.slotRow}>
                    <Text style={s.slotLabel}>{role.label}{role.gender ? ` (${role.gender})` : ''}</Text>
                    <Text style={s.slotName}>{awayTeam.player_names[i] ?? '—'}</Text>
                  </View>
                ))}

                <Text style={s.sectionHdr}>Launch Session</Text>

                <TouchableOpacity style={s.launchOpt} onPress={launchNew} disabled={launching || !!warning}>
                  <Text style={s.launchEmoji}>🆕</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.launchTitle, warning ? { color: colors.gray2 } : null]}>New Session</Text>
                    <Text style={s.launchSub}>Creates a fresh club with all players pre-loaded in the queue.</Text>
                  </View>
                </TouchableOpacity>

                {hostClubs.length > 0 && (
                  <>
                    <Text style={[s.sectionHdr, { marginTop: 4 }]}>— or use existing —</Text>
                    {hostClubs.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={s.launchOpt}
                        onPress={() => launchExisting(c)}
                        disabled={launching}
                      >
                        <Text style={s.launchEmoji}>📋</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.launchTitle}>{c.club_name ?? c.id}</Text>
                          <Text style={s.launchSub}>{c.id}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {launching && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}
              </>
            )}

            <TouchableOpacity onPress={onCancel} disabled={launching}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
