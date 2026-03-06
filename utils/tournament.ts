import { QueuePlayer, TournamentMatch, TournamentTeam } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interleave(a: QueuePlayer[], b: QueuePlayer[]): QueuePlayer[] {
  const result: QueuePlayer[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) result.push(a[i]);
    if (i < b.length) result.push(b[i]);
  }
  return result;
}

// ── Team Formation ────────────────────────────────────────────────────────────
export function autoFormTeams(
  players: QueuePlayer[],
  teamSize: number,
  genderBalanced: boolean,
): TournamentTeam[] {
  const males = players.filter(p => p.gender !== 'F');
  const females = players.filter(p => p.gender === 'F');
  const half = Math.floor(teamSize / 2);

  let pool: QueuePlayer[];
  if (genderBalanced && males.length >= half && females.length >= half) {
    pool = interleave(males, females);
  } else if (genderBalanced && males.length >= teamSize) {
    pool = males;
  } else if (genderBalanced && females.length >= teamSize) {
    pool = females;
  } else {
    pool = shuffle([...players]);
  }

  const numTeams = Math.floor(pool.length / teamSize);
  return Array.from({ length: numTeams }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i + 1}`,
    players: pool.slice(i * teamSize, (i + 1) * teamSize).map(p => p.name),
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    matchesPlayed: 0,
  }));
}

// ── Round Robin ───────────────────────────────────────────────────────────────
export function generateRoundRobinFixtures(
  teams: TournamentTeam[],
  rounds: number,
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let idx = 0;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `m${idx++}`,
          team1Id: teams[i].id,
          team2Id: teams[j].id,
          winnerId: null,
          round: r + 1,
        });
      }
    }
  }
  return matches;
}

export function recalcStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): TournamentTeam[] {
  return teams.map(team => {
    const played = matches.filter(
      m => m.winnerId !== null && (m.team1Id === team.id || m.team2Id === team.id),
    );
    const wins = played.filter(m => m.winnerId === team.id).length;
    const draws = played.filter(m => m.winnerId === '__draw__').length;
    const losses = played.length - wins - draws;
    return {
      ...team,
      wins,
      losses,
      draws,
      matchesPlayed: played.length,
      points: wins * 3 + draws,
    };
  });
}

// ── Knockout ──────────────────────────────────────────────────────────────────
export function generateKnockoutRound(
  teams: TournamentTeam[],
  round: number,
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  for (let i = 0; i + 1 < teams.length; i += 2) {
    matches.push({
      id: `r${round}m${i / 2}`,
      team1Id: teams[i].id,
      team2Id: teams[i + 1].id,
      winnerId: null,
      round,
    });
  }
  // Odd team out gets a bye
  if (teams.length % 2 === 1) {
    const bye = teams[teams.length - 1];
    matches.push({
      id: `r${round}bye`,
      team1Id: bye.id,
      team2Id: '__bye__',
      winnerId: bye.id,
      round,
    });
  }
  return matches;
}

export function isRoundComplete(matches: TournamentMatch[], round: number): boolean {
  return matches.filter(m => m.round === round).every(m => m.winnerId !== null);
}

export function knockoutAdvancers(
  matches: TournamentMatch[],
  round: number,
  teams: TournamentTeam[],
): TournamentTeam[] {
  return matches
    .filter(m => m.round === round && m.winnerId !== null)
    .map(m => teams.find(t => t.id === m.winnerId))
    .filter((t): t is TournamentTeam => t !== undefined);
}

// ── Super Tournament ──────────────────────────────────────────────────────────
export function computeGame2Teams(
  team1Players: string[],
  team2Players: string[],
  queuePlayers: QueuePlayer[],
  isMixed: boolean,
): { game2Team1: string[]; game2Team2: string[] } {
  if (isMixed) {
    // Females swap across teams
    const getGender = (name: string) =>
      queuePlayers.find(p => p.name === name)?.gender ?? 'M';
    const t1Males = team1Players.filter(n => getGender(n) !== 'F');
    const t1Females = team1Players.filter(n => getGender(n) === 'F');
    const t2Males = team2Players.filter(n => getGender(n) !== 'F');
    const t2Females = team2Players.filter(n => getGender(n) === 'F');
    return {
      game2Team1: [...t1Males, ...t2Females],
      game2Team2: [...t2Males, ...t1Females],
    };
  } else {
    // Same-sex: second player in each team swaps (index 1, predictable for the host)
    const t1Swap = team1Players[1] ?? team1Players[0];
    const t2Swap = team2Players[1] ?? team2Players[0];
    return {
      game2Team1: [...team1Players.filter(n => n !== t1Swap), t2Swap],
      game2Team2: [...team2Players.filter(n => n !== t2Swap), t1Swap],
    };
  }
}

export function isMixedTeam(players: string[], queuePlayers: QueuePlayer[]): boolean {
  const hasMale = players.some(
    n => (queuePlayers.find(p => p.name === n)?.gender ?? 'M') !== 'F',
  );
  const hasFemale = players.some(
    n => queuePlayers.find(p => p.name === n)?.gender === 'F',
  );
  return hasMale && hasFemale;
}

export function recalcSuperScores(matches: TournamentMatch[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of matches) {
    const addScores = (scores?: Record<string, number>) => {
      if (!scores) return;
      for (const [name, pts] of Object.entries(scores)) {
        totals[name] = (totals[name] ?? 0) + pts;
      }
    };
    if (m.combinedScores) {
      addScores(m.combinedScores); // simplified single-entry flow
    } else {
      addScores(m.game1Scores);
      addScores(m.game2Scores);
    }
  }
  return totals;
}

// ── Partnership helpers ───────────────────────────────────────────────────────

/** Canonical sorted key for a pair of players */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** All within-team pair keys for two teams */
export function teamsPartnerships(t1: string[], t2: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < t1.length; i++)
    for (let j = i + 1; j < t1.length; j++) pairs.push(pairKey(t1[i], t1[j]));
  for (let i = 0; i < t2.length; i++)
    for (let j = i + 1; j < t2.length; j++) pairs.push(pairKey(t2[i], t2[j]));
  return pairs;
}

/**
 * Count how many players in a pending match have already been team-mates.
 * Lower = better (fewer repeat partnerships).
 */
export function matchPartnershipScore(
  match: TournamentMatch,
  teams: TournamentTeam[],
  partnerships: string[],
): number {
  const team1 = teams.find(t => t.id === match.team1Id);
  const team2 = match.team2Id === '__bye__' ? null : teams.find(t => t.id === match.team2Id);
  if (!team1 || !team2) return 0;
  const pset = new Set(partnerships);
  return teamsPartnerships(team1.players, team2.players).filter(p => pset.has(p)).length;
}
