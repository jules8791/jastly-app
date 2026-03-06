/**
 * app/leagues/[id].tsx — League detail
 * Tabs: Fixtures | Standings | Teams
 * Host actions: generate schedule, launch fixture, edit teams
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../supabase';
import { ColorSet, useTheme } from '../../contexts/theme-context';
import { getSportConfig } from '../../constants/sports';
import { LeagueMatchSetupModal } from '../../components/league/LeagueMatchSetupModal';
import type { League, LeagueFixture, LeagueStanding, LeagueTeam, QueuePlayer } from '../../types';

type Tab = 'fixtures' | 'standings' | 'teams';

interface HostClub {
  id: string;
  club_name: string | null;
  sport: string | null;
}

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [league, setLeague]       = useState<League | null>(null);
  const [teams, setTeams]         = useState<LeagueTeam[]>([]);
  const [fixtures, setFixtures]   = useState<LeagueFixture[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uid, setUid]             = useState<string | null>(null);
  const [isOwner, setIsOwner]     = useState(false);
  const [tab, setTab]             = useState<Tab>('fixtures');

  // Add/Edit Team modal state
  const [showAddTeam, setShowAddTeam]   = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [manualEntry, setManualEntry]   = useState('');
  const [editingTeam, setEditingTeam]   = useState<LeagueTeam | null>(null);
  const [savingTeam, setSavingTeam]     = useState(false);

  // Club roster for player picker
  const [rosterNames, setRosterNames] = useState<string[]>([]);

  // Fixture launch modal state (simple / non-scripted)
  const [launchFixture, setLaunchFixture] = useState<LeagueFixture | null>(null);
  const [hostClubs, setHostClubs]         = useState<HostClub[]>([]);
  const [launching, setLaunching]         = useState(false);

  // Scripted-format setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupFixture, setSetupFixture]     = useState<LeagueFixture | null>(null);

  // ─── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUid(u?.id ?? null);
      fetchAll(u?.id ?? null);
    });
  }, [id]);

  const fetchAll = async (userId: string | null) => {
    setLoading(true);
    const [leagueRes, teamsRes, fixturesRes, standingsRes] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id).single(),
      supabase.from('league_teams').select('*').eq('league_id', id).order('created_at'),
      supabase.from('league_fixtures').select('*').eq('league_id', id).order('round').order('created_at'),
      supabase.from('league_standings').select('*').eq('league_id', id).order('points', { ascending: false }),
    ]);
    if (leagueRes.data) {
      const l = leagueRes.data as League;
      setLeague(l);
      setIsOwner(userId === l.owner_uid);
    }
    setTeams((teamsRes.data as LeagueTeam[]) ?? []);
    setFixtures((fixturesRes.data as LeagueFixture[]) ?? []);
    setStandings((standingsRes.data as LeagueStanding[]) ?? []);
    setLoading(false);

    // Fetch roster names from all clubs this user owns
    if (userId) {
      const { data: clubs } = await supabase
        .from('clubs')
        .select('master_roster')
        .eq('host_uid', userId);
      const names = new Set<string>();
      for (const club of clubs ?? []) {
        const roster = club.master_roster;
        if (Array.isArray(roster)) {
          roster.forEach((p: any) => p?.name && names.add(p.name));
        } else if (roster && typeof roster === 'object') {
          Object.values(roster).forEach((players: any) => {
            if (Array.isArray(players)) players.forEach((p: any) => p?.name && names.add(p.name));
          });
        }
      }
      setRosterNames(Array.from(names).sort());
    }
  };

  // ─── Generate round-robin schedule ────────────────────────────────────────

  const generateSchedule = useCallback(async () => {
    if (teams.length < 2) {
      Alert.alert('Need at least 2 teams', 'Add more teams before generating the schedule.');
      return;
    }
    Alert.alert(
      'Generate Schedule',
      `This will create a round-robin schedule for ${teams.length} teams. Existing fixtures will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate', onPress: async () => {
            const rows: Omit<LeagueFixture, 'id' | 'created_at'>[] = [];
            let round = 1;
            for (let i = 0; i < teams.length; i++) {
              for (let j = i + 1; j < teams.length; j++) {
                rows.push({
                  league_id: id!,
                  home_team_id: teams[i].id,
                  away_team_id: teams[j].id,
                  round,
                  status: 'scheduled',
                });
                round++;
              }
            }
            const { error } = await supabase.from('league_fixtures').insert(rows);
            if (error) { Alert.alert('Error', error.message); return; }
            fetchAll(uid);
          },
        },
      ],
    );
  }, [teams, id, uid]);

  // ─── Teams CRUD ───────────────────────────────────────────────────────────

  const openAddTeam = (team?: LeagueTeam) => {
    setEditingTeam(team ?? null);
    setEditTeamName(team?.name ?? '');
    setSelectedPlayers(team?.player_names ?? []);
    setManualEntry('');
    setShowAddTeam(true);
  };

  const togglePlayer = (name: string) => {
    setSelectedPlayers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name],
    );
  };

  const addManual = () => {
    const name = manualEntry.trim();
    if (!name) return;
    if (!selectedPlayers.includes(name)) setSelectedPlayers(prev => [...prev, name]);
    setManualEntry('');
  };

  const saveTeam = async () => {
    if (!editTeamName.trim()) { Alert.alert('Name required'); return; }
    const playerNames = selectedPlayers;
    setSavingTeam(true);
    if (editingTeam) {
      await supabase.from('league_teams')
        .update({ name: editTeamName.trim(), player_names: playerNames })
        .eq('id', editingTeam.id);
    } else {
      await supabase.from('league_teams')
        .insert([{ league_id: id, name: editTeamName.trim(), player_names: playerNames }]);
    }
    setSavingTeam(false);
    setShowAddTeam(false);
    fetchAll(uid);
  };

  const deleteTeam = (team: LeagueTeam) => {
    Alert.alert('Delete Team', `Delete "${team.name}"? Any fixtures involving this team will also be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('league_teams').delete().eq('id', team.id);
          fetchAll(uid);
        },
      },
    ]);
  };

  // ─── Fixture launch ───────────────────────────────────────────────────────

  const openLaunch = async (fixture: LeagueFixture) => {
    if (!isOwner) { Alert.alert('Only the league owner can launch fixtures.'); return; }
    const isScripted = league?.format_type && league.format_type !== 'NONE';
    if (isScripted) {
      setSetupFixture(fixture);
      setShowSetupModal(true);
    } else {
      setLaunchFixture(fixture);
      const { data } = await supabase
        .from('clubs')
        .select('id, club_name, sport')
        .eq('host_uid', uid)
        .order('club_name');
      setHostClubs((data as HostClub[]) ?? []);
    }
  };

  const launchNewSession = async () => {
    if (!launchFixture || !uid) return;
    setLaunching(true);
    try {
      const home = teams.find(t => t.id === launchFixture.home_team_id);
      const away = teams.find(t => t.id === launchFixture.away_team_id);
      const clubName = `${home?.name ?? '?'} vs ${away?.name ?? '?'} — ${league?.name ?? 'League'}`;
      const newClubId = 'CLUB-' +
        Math.random().toString(36).substring(2, 7).toUpperCase() +
        Math.random().toString(36).substring(2, 7).toUpperCase();

      // Pre-populate the waiting list with all players from both teams
      const allPlayers: QueuePlayer[] = [
        ...(home?.player_names ?? []).map(name => ({ name, gender: 'M' as const })),
        ...(away?.player_names ?? []).map(name => ({ name, gender: 'M' as const })),
      ];

      const { error } = await supabase.from('clubs').insert([{
        id: newClubId,
        host_uid: uid,
        club_name: clubName,
        sport: league?.sport ?? 'badminton',
        waiting_list: allPlayers,
        active_courts: 1,
      }]);
      if (error) { Alert.alert('Error', error.message); setLaunching(false); return; }

      // Link the club session to this fixture
      await supabase.from('league_fixtures')
        .update({ status: 'in_progress', club_id: newClubId })
        .eq('id', launchFixture.id);

      await AsyncStorage.multiSet([
        ['currentClubId', newClubId],
        ['isHost', 'true'],
        ['current_fixture_id', launchFixture.id],
        ['current_fixture_home_team_id', launchFixture.home_team_id],
        ['current_fixture_away_team_id', launchFixture.away_team_id],
      ]);
      setLaunchFixture(null);
      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setLaunching(false);
    }
  };

  const launchExistingSession = async (club: HostClub) => {
    if (!launchFixture) return;
    setLaunching(true);
    try {
      await supabase.from('league_fixtures')
        .update({ status: 'in_progress', club_id: club.id })
        .eq('id', launchFixture.id);

      await AsyncStorage.multiSet([
        ['currentClubId', club.id],
        ['isHost', 'true'],
        ['current_fixture_id', launchFixture.id],
        ['current_fixture_home_team_id', launchFixture.home_team_id],
        ['current_fixture_away_team_id', launchFixture.away_team_id],
      ]);
      setLaunchFixture(null);
      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setLaunching(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const getTeamName = useCallback((teamId: string) =>
    teams.find(t => t.id === teamId)?.name ?? '?', [teams]);

  const statusColor = (status: LeagueFixture['status']) => {
    if (status === 'completed') return '#4CAF50';
    if (status === 'in_progress') return colors.primary;
    return colors.gray2;
  };

  const statusLabel = (f: LeagueFixture) => {
    if (f.status === 'completed') return `${f.result_home ?? 0} – ${f.result_away ?? 0}`;
    if (f.status === 'in_progress') return 'Live';
    return 'Scheduled';
  };

  const roundGroups = useMemo(() => {
    const map = new Map<number, LeagueFixture[]>();
    for (const f of fixtures) {
      if (!map.has(f.round)) map.set(f.round, []);
      map.get(f.round)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [fixtures]);

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.white }}>League not found.</Text>
      </View>
    );
  }

  const cfg = getSportConfig(league.sport);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{cfg.emoji} {league.name}</Text>
          <Text style={styles.headerSub}>{cfg.label}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['fixtures', 'standings', 'teams'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>

        {/* ── FIXTURES TAB ── */}
        {tab === 'fixtures' && (
          <>
            {isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={generateSchedule}>
                <Text style={styles.actionBtnText}>Generate Round-Robin Schedule</Text>
              </TouchableOpacity>
            )}
            {roundGroups.length === 0 ? (
              <Text style={styles.emptyHint}>
                No fixtures yet.{isOwner ? ' Tap "Generate" above.' : ''}
              </Text>
            ) : (
              roundGroups.map(([round, rFixtures]) => (
                <View key={round}>
                  <Text style={styles.sectionHeader}>Round {round}</Text>
                  {rFixtures.map(f => (
                    <View key={f.id} style={styles.fixtureCard}>
                      <View style={styles.fixtureTeams}>
                        <Text style={styles.fixtureTeamName} numberOfLines={1}>
                          {getTeamName(f.home_team_id)}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor(f.status) + '22' }]}>
                          <Text style={[styles.statusText, { color: statusColor(f.status) }]}>
                            {statusLabel(f)}
                          </Text>
                        </View>
                        <Text style={[styles.fixtureTeamName, { textAlign: 'right' }]} numberOfLines={1}>
                          {getTeamName(f.away_team_id)}
                        </Text>
                      </View>
                      {isOwner && f.status !== 'completed' && (
                        <TouchableOpacity style={styles.launchBtn} onPress={() => openLaunch(f)}>
                          <Text style={styles.launchBtnText}>Play Now</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {/* ── STANDINGS TAB ── */}
        {tab === 'standings' && (
          <>
            {standings.length === 0 ? (
              <Text style={styles.emptyHint}>No results yet.</Text>
            ) : (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.tableTeamCell, styles.tableHeaderText]}>#  Team</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>P</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>W</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>D</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>L</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>Pts</Text>
                </View>
                {standings.map((s, i) => (
                  <View key={s.team_id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, styles.tableTeamCell, { color: colors.white }]}>
                      {i + 1}  {s.team_name}
                    </Text>
                    <Text style={styles.tableCell}>{s.played}</Text>
                    <Text style={styles.tableCell}>{s.wins}</Text>
                    <Text style={styles.tableCell}>{s.draws}</Text>
                    <Text style={styles.tableCell}>{s.losses}</Text>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: colors.primary }]}>{s.points}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── TEAMS TAB ── */}
        {tab === 'teams' && (
          <>
            {isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => openAddTeam()}>
                <Text style={styles.actionBtnText}>+ Add Team</Text>
              </TouchableOpacity>
            )}
            {teams.length === 0 ? (
              <Text style={styles.emptyHint}>
                No teams yet.{isOwner ? ' Tap "+ Add Team" above.' : ''}
              </Text>
            ) : (
              teams.map(t => (
                <View key={t.id} style={styles.teamCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamCardName}>{t.name}</Text>
                    <Text style={styles.teamPlayers} numberOfLines={2}>
                      {t.player_names.length > 0 ? t.player_names.join(', ') : 'No players listed'}
                    </Text>
                  </View>
                  {isOwner && (
                    <View style={styles.teamActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openAddTeam(t)}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTeam(t)}>
                        <Text style={styles.deleteBtnText}>Del</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Add/Edit Team Modal ── */}
      <Modal visible={showAddTeam} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingTeam ? 'Edit Team' : 'Add Team'}</Text>

            <Text style={styles.fieldLabel}>Team Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Red Dragons"
              placeholderTextColor={colors.gray2}
              value={editTeamName}
              onChangeText={setEditTeamName}
            />

            <Text style={styles.fieldLabel}>
              Players {selectedPlayers.length > 0 ? `(${selectedPlayers.length} selected)` : ''}
            </Text>

            {/* Selected players */}
            {selectedPlayers.length > 0 && (
              <View style={styles.chipRow}>
                {selectedPlayers.map(name => (
                  <TouchableOpacity key={name} style={styles.chipSelected} onPress={() => togglePlayer(name)}>
                    <Text style={styles.chipSelectedText}>{name}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Roster picker */}
            {rosterNames.length > 0 && (
              <>
                <Text style={styles.rosterLabel}>Pick from club roster:</Text>
                <View style={styles.chipRow}>
                  {rosterNames
                    .filter(n => !selectedPlayers.includes(n))
                    .map(name => (
                      <TouchableOpacity key={name} style={styles.chipRoster} onPress={() => togglePlayer(name)}>
                        <Text style={styles.chipRosterText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}

            {/* Manual entry */}
            <Text style={styles.rosterLabel}>Add by name:</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Player name"
                placeholderTextColor={colors.gray2}
                value={manualEntry}
                onChangeText={setManualEntry}
                onSubmitEditing={addManual}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.manualAddBtn} onPress={addManual}>
                <Text style={styles.manualAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddTeam(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveTeam} disabled={savingTeam}>
                {savingTeam ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Scripted-format Setup Modal ── */}
      {setupFixture && league && uid && (
        <LeagueMatchSetupModal
          visible={showSetupModal}
          league={league}
          fixture={setupFixture}
          homeTeam={teams.find(t => t.id === setupFixture.home_team_id) ?? { id: '', league_id: '', name: '?', player_names: [], created_at: '' }}
          awayTeam={teams.find(t => t.id === setupFixture.away_team_id) ?? { id: '', league_id: '', name: '?', player_names: [], created_at: '' }}
          uid={uid}
          onDone={() => { setShowSetupModal(false); setSetupFixture(null); }}
          onCancel={() => { setShowSetupModal(false); setSetupFixture(null); }}
        />
      )}

      {/* ── Launch Fixture Modal ── */}
      <Modal visible={!!launchFixture} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView>
            <View style={styles.modal}>
              {launchFixture && (
                <>
                  <Text style={styles.modalTitle}>Launch Fixture</Text>
                  <Text style={styles.modalSubtitle}>
                    {getTeamName(launchFixture.home_team_id)} vs {getTeamName(launchFixture.away_team_id)}
                  </Text>

                  {/* New Session option */}
                  <TouchableOpacity
                    style={[styles.launchOption, { marginBottom: 12 }]}
                    onPress={launchNewSession}
                    disabled={launching}
                  >
                    <Text style={styles.launchOptionEmoji}>🆕</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.launchOptionTitle}>New Session</Text>
                      <Text style={styles.launchOptionDesc}>
                        Creates a fresh club session with fixture players pre-loaded in the queue.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Existing sessions */}
                  {hostClubs.length > 0 && (
                    <>
                      <Text style={styles.orDivider}>— or use existing session —</Text>
                      {hostClubs.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.launchOption, { marginBottom: 8 }]}
                          onPress={() => launchExistingSession(c)}
                          disabled={launching}
                        >
                          <Text style={styles.launchOptionEmoji}>
                            {getSportConfig(c.sport).emoji}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.launchOptionTitle}>{c.club_name ?? c.id}</Text>
                            <Text style={styles.launchOptionDesc}>{c.id}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {launching && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}

                  <TouchableOpacity
                    style={[styles.cancelBtn, { marginTop: 16 }]}
                    onPress={() => setLaunchFixture(null)}
                    disabled={launching}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: ColorSet) {
  return StyleSheet.create({
    screen:       { flex: 1, backgroundColor: C.bg },
    header:       { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
    back:         { paddingRight: 12 },
    backText:     { fontSize: 28, color: C.primary, lineHeight: 32 },
    headerTitle:  { fontSize: 18, fontWeight: '700', color: C.white },
    headerSub:    { fontSize: 13, color: C.gray2, marginTop: 2 },

    tabs:          { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
    tab:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive:     { borderBottomWidth: 2, borderBottomColor: C.primary },
    tabText:       { fontSize: 14, color: C.gray2, fontWeight: '600' },
    tabTextActive: { color: C.primary },

    sectionHeader: { fontSize: 13, fontWeight: '700', color: C.gray2, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
    emptyHint:     { color: C.gray2, textAlign: 'center', marginTop: 32, fontSize: 15 },

    actionBtn:     { backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16 },
    actionBtnText: { color: C.black, fontWeight: '700', fontSize: 15 },

    fixtureCard:     { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
    fixtureTeams:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fixtureTeamName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.white },
    statusBadge:     { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 8 },
    statusText:      { fontSize: 12, fontWeight: '700' },
    launchBtn:       { marginTop: 12, backgroundColor: C.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
    launchBtnText:   { color: C.black, fontWeight: '700', fontSize: 13 },

    // Standings table
    table:          { borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface },
    tableRow:       { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12 },
    tableRowAlt:    { backgroundColor: C.bg },
    tableHeader:    { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
    tableHeaderText: { color: C.gray2, fontWeight: '700', fontSize: 12 },
    tableCell:      { width: 36, textAlign: 'center', color: C.gray2, fontSize: 13 },
    tableTeamCell:  { flex: 1, width: undefined, textAlign: 'left' },

    // Teams tab
    teamCard:     { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start' },
    teamCardName: { fontSize: 15, fontWeight: '700', color: C.white },
    teamPlayers:  { fontSize: 13, color: C.gray2, marginTop: 4 },
    teamActions:  { flexDirection: 'row', gap: 8, marginLeft: 12 },
    editBtn:      { backgroundColor: C.primary + '33', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    editBtnText:  { color: C.primary, fontWeight: '700', fontSize: 13 },
    deleteBtn:    { backgroundColor: '#FF525222', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    deleteBtnText: { color: '#FF5252', fontWeight: '700', fontSize: 13 },

    // Shared modal
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal:         { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle:    { fontSize: 18, fontWeight: '700', color: C.white, marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: C.gray2, marginBottom: 16 },
    fieldLabel:    { fontSize: 13, fontWeight: '600', color: C.gray2, marginBottom: 6 },
    fieldInput:    { backgroundColor: C.bg, borderRadius: 8, padding: 12, color: C.white, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: C.border },
    modalButtons:  { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn:     { flex: 1, borderRadius: 10, padding: 14, backgroundColor: C.bg, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    cancelBtnText: { color: C.white, fontWeight: '600' },
    confirmBtn:    { flex: 1, borderRadius: 10, padding: 14, backgroundColor: C.primary, alignItems: 'center' },
    confirmBtnText: { color: C.black, fontWeight: '700' },

    // Launch options
    launchOption:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
    launchOptionEmoji:  { fontSize: 26, marginRight: 12 },
    launchOptionTitle:  { fontSize: 15, fontWeight: '700', color: C.white },
    launchOptionDesc:   { fontSize: 12, color: C.gray2, marginTop: 2 },
    orDivider:          { textAlign: 'center', color: C.gray2, fontSize: 12, marginVertical: 12 },

    // Roster / player chips
    chipRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chipSelected:       { backgroundColor: C.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    chipSelectedText:   { color: C.black, fontWeight: '700', fontSize: 13 },
    chipRoster:         { backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
    chipRosterText:     { color: C.white, fontSize: 13 },
    rosterLabel:        { fontSize: 12, color: C.gray2, marginBottom: 6 },
    manualRow:          { flexDirection: 'row', gap: 8, marginBottom: 14 },
    manualAddBtn:       { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
    manualAddBtnText:   { color: C.black, fontWeight: '700', fontSize: 18 },
  });
}
