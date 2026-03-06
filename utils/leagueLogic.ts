// utils/leagueLogic.ts
//
// Translates a format + method + two team rosters into an ordered list of
// rubbers that the LeagueOrderPanel can render and the host can play through.

import { LEAGUE_FORMATS } from '../constants/leagueFormats';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeagueRubber {
  index: number;
  name: string;
  /** Player names for the home side of this rubber (2 players for doubles) */
  homePlayers: string[];
  /** Genders matching homePlayers — derived from format slotRoles */
  homeGenders: ('M' | 'F')[];
  /** Player names for the away side */
  awayPlayers: string[];
  awayGenders: ('M' | 'F')[];
}

export interface StoredLeagueQueue {
  formatId: string;
  methodKey: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  rubbers: LeagueRubber[];
}

export interface LeagueRubberResult {
  index: number;
  homeScore: number;
  awayScore: number;
}

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Build the full ordered rubber list for a fixture.
 *
 * Problems fixed vs the original proposal:
 *  - Gender derived from format.slotRoles[i].gender, not hardcoded index check.
 *  - Falls back gracefully when roster is shorter than the format expects.
 */
export function generateLeagueQueue(
  formatId: string,
  methodKey: string,
  homeRoster: string[],
  awayRoster: string[],
  homeTeamId: string,
  awayTeamId: string,
  homeTeamName: string,
  awayTeamName: string,
): StoredLeagueQueue {
  const format = LEAGUE_FORMATS[formatId];
  if (!format) {
    return { formatId, methodKey, homeTeamId, awayTeamId, homeTeamName, awayTeamName, rubbers: [] };
  }

  const methodKeys = Object.keys(format.methods);
  const method = format.methods[methodKey] ?? format.methods[methodKeys[0]];
  const resolvedMethodKey = format.methods[methodKey] ? methodKey : methodKeys[0];
  const slotRoles = format.slotRoles;

  const rubbers: LeagueRubber[] = method.map((matchup, index) => {
    const homePlayers  = matchup.home.map(i => homeRoster[i] ?? `H${i + 1}`);
    const homeGenders  = matchup.home.map(i => slotRoles[i]?.gender ?? 'M');
    const awayPlayers  = matchup.away.map(i => awayRoster[i] ?? `A${i + 1}`);
    const awayGenders  = matchup.away.map(i => slotRoles[i]?.gender ?? 'M');
    return { index, name: matchup.name, homePlayers, homeGenders, awayPlayers, awayGenders };
  });

  return {
    formatId,
    methodKey: resolvedMethodKey,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    rubbers,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Returns a warning string if the roster is too short for the format, or null
 * if everything is fine.  Call before showing the setup modal "Confirm" button.
 */
export function validateRosterForFormat(
  formatId: string,
  homeRoster: string[],
  awayRoster: string[],
): string | null {
  const format = LEAGUE_FORMATS[formatId];
  if (!format) return null;
  if (homeRoster.length < format.teamSize) {
    return `Home team needs ${format.teamSize} players (has ${homeRoster.length}).`;
  }
  if (awayRoster.length < format.teamSize) {
    return `Away team needs ${format.teamSize} players (has ${awayRoster.length}).`;
  }
  return null;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

/** Total rubbers won by each side from an array of results. */
export function tabulateResults(
  results: LeagueRubberResult[],
): { homeWins: number; awayWins: number } {
  let homeWins = 0;
  let awayWins = 0;
  for (const r of results) {
    if (r.homeScore > r.awayScore) homeWins++;
    else if (r.awayScore > r.homeScore) awayWins++;
    // Equal scores count as a draw (rare but possible in timed formats)
  }
  return { homeWins, awayWins };
}
