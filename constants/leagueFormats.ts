// constants/leagueFormats.ts
//
// Encodes the "Order of Play" grids used in English badminton league fixtures.
// Each MatchupDefinition uses indices into the team's player_names array.
// The slotRoles array defines the label and optional gender for each slot —
// hosts see these labels when assigning players to the team roster.

export type MatchupDefinition = {
  name: string;        // e.g. "H1 v V1"
  home: number[];      // indices into home team's player_names
  away: number[];      // indices into away team's player_names
};

export type SlotRole = {
  label: string;       // e.g. "Pair 1 Player A", "Man 1"
  gender?: 'M' | 'F'; // set only for mixed formats
};

export type LeagueFormatDef = {
  id: string;
  label: string;
  description: string;
  teamSize: number;
  slotRoles: SlotRole[];
  methods: Record<string, MatchupDefinition[]>;
};

export const LEAGUE_FORMATS: Record<string, LeagueFormatDef> = {

  // ── Sixes (3 Pairs, 9 Rubbers) ────────────────────────────────────────────
  // Roster order: Pair 1 = [0,1], Pair 2 = [2,3], Pair 3 = [4,5]
  // All three methods give every home pair exactly one game against every away
  // pair; the only difference is the order within each round.
  // If captains cannot agree, Method 1 is used by default.
  SIXES: {
    id: 'SIXES',
    label: 'Sixes — 3 Pairs (9 Rubbers)',
    description: 'Each pair plays every opposing pair once. Three methods; default Method 1.',
    teamSize: 6,
    slotRoles: [
      { label: 'Pair 1 — Player A' },
      { label: 'Pair 1 — Player B' },
      { label: 'Pair 2 — Player A' },
      { label: 'Pair 2 — Player B' },
      { label: 'Pair 3 — Player A' },
      { label: 'Pair 3 — Player B' },
    ],
    methods: {
      method1: [
        // Round 1
        { name: 'H1 v V1', home: [0, 1], away: [0, 1] },
        { name: 'H2 v V2', home: [2, 3], away: [2, 3] },
        { name: 'H3 v V3', home: [4, 5], away: [4, 5] },
        // Round 2
        { name: 'H2 v V1', home: [2, 3], away: [0, 1] },
        { name: 'H3 v V2', home: [4, 5], away: [2, 3] },
        { name: 'H1 v V3', home: [0, 1], away: [4, 5] },
        // Round 3
        { name: 'H3 v V1', home: [4, 5], away: [0, 1] },
        { name: 'H1 v V2', home: [0, 1], away: [2, 3] },
        { name: 'H2 v V3', home: [2, 3], away: [4, 5] },
      ],
      method2: [
        // Round 1 (same as Method 1)
        { name: 'H1 v V1', home: [0, 1], away: [0, 1] },
        { name: 'H2 v V2', home: [2, 3], away: [2, 3] },
        { name: 'H3 v V3', home: [4, 5], away: [4, 5] },
        // Round 2 (different from Method 1)
        { name: 'H2 v V1', home: [2, 3], away: [0, 1] },
        { name: 'H1 v V2', home: [0, 1], away: [2, 3] },
        { name: 'H2 v V3', home: [2, 3], away: [4, 5] },
        // Round 3 (different from Method 1)
        { name: 'H3 v V1', home: [4, 5], away: [0, 1] },
        { name: 'H1 v V3', home: [0, 1], away: [4, 5] },
        { name: 'H3 v V2', home: [4, 5], away: [2, 3] },
      ],
      method3: [
        // Round 1 (same as Methods 1 & 2)
        { name: 'H1 v V1', home: [0, 1], away: [0, 1] },
        { name: 'H2 v V2', home: [2, 3], away: [2, 3] },
        { name: 'H3 v V3', home: [4, 5], away: [4, 5] },
        // Round 2 (rotated differently)
        { name: 'H3 v V2', home: [4, 5], away: [2, 3] },
        { name: 'H1 v V3', home: [0, 1], away: [4, 5] },
        { name: 'H2 v V1', home: [2, 3], away: [0, 1] },
        // Round 3
        { name: 'H2 v V3', home: [2, 3], away: [4, 5] },
        { name: 'H3 v V1', home: [4, 5], away: [0, 1] },
        { name: 'H1 v V2', home: [0, 1], away: [2, 3] },
      ],
    },
  },

  // ── Fours — Same Gender (8 Rubbers) ───────────────────────────────────────
  // Four players per team, all same gender (men's or ladies').
  // Roster order: P1=[0], P2=[1], P3=[2], P4=[3]
  FOURS_LEVEL: {
    id: 'FOURS_LEVEL',
    label: 'Fours — Same Gender (8 Rubbers)',
    description: 'Four players per side, same gender. All partnership combinations.',
    teamSize: 4,
    slotRoles: [
      { label: 'Player 1 (strongest)' },
      { label: 'Player 2' },
      { label: 'Player 3' },
      { label: 'Player 4 (weakest)' },
    ],
    methods: {
      standard: [
        { name: '1&2 v 1&2', home: [0, 1], away: [0, 1] },
        { name: '3&4 v 3&4', home: [2, 3], away: [2, 3] },
        { name: '2&3 v 1&4', home: [1, 2], away: [0, 3] },
        { name: '1&4 v 2&3', home: [0, 3], away: [1, 2] },
        { name: '1&3 v 1&3', home: [0, 2], away: [0, 2] },
        { name: '2&4 v 2&4', home: [1, 3], away: [1, 3] },
        { name: '1&4 v 1&4', home: [0, 3], away: [0, 3] },
        { name: '2&3 v 2&3', home: [1, 2], away: [1, 2] },
      ],
    },
  },

  // ── Mixed Fours (8 Rubbers) ────────────────────────────────────────────────
  // Four players per team: 2 men + 2 ladies.
  // Roster order: Man1=[0], Man2=[1], Lady1=[2], Lady2=[3]
  // Gender is encoded in slotRoles so generateLeagueQueue can assign it correctly.
  FOURS_MIXED: {
    id: 'FOURS_MIXED',
    label: 'Mixed Fours (8 Rubbers)',
    description: '2 men + 2 ladies per side. Men first in roster, ladies second.',
    teamSize: 4,
    slotRoles: [
      { label: 'Man 1',   gender: 'M' },
      { label: 'Man 2',   gender: 'M' },
      { label: 'Lady 1',  gender: 'F' },
      { label: 'Lady 2',  gender: 'F' },
    ],
    methods: {
      standard: [
        { name: "Men's Doubles",      home: [0, 1], away: [0, 1] },
        { name: "Ladies' Doubles",    home: [2, 3], away: [2, 3] },
        { name: 'Mixed 1',            home: [0, 2], away: [0, 2] },
        { name: 'Mixed 2',            home: [1, 3], away: [1, 3] },
        { name: 'Mixed Cross 1',      home: [0, 3], away: [0, 3] },
        { name: 'Mixed Cross 2',      home: [1, 2], away: [1, 2] },
        { name: 'Mixed Reverse 1',    home: [0, 2], away: [1, 3] },
        { name: 'Mixed Reverse 2',    home: [1, 3], away: [0, 2] },
      ],
    },
  },
};

export const FORMAT_OPTIONS: { value: string; label: string; sports: string[] | null }[] = [
  // sports: null = available for all sports
  { value: 'NONE',        label: 'None (standard queue)',         sports: null },
  // Badminton-specific scripted formats
  { value: 'SIXES',       label: LEAGUE_FORMATS.SIXES.label,       sports: ['badminton'] },
  { value: 'FOURS_LEVEL', label: LEAGUE_FORMATS.FOURS_LEVEL.label, sports: ['badminton'] },
  { value: 'FOURS_MIXED', label: LEAGUE_FORMATS.FOURS_MIXED.label, sports: ['badminton'] },
];

/**
 * Returns the format options available for a given sport.
 * Always includes 'None'; sport-specific formats only appear for that sport.
 */
export function getFormatOptionsForSport(sport: string) {
  return FORMAT_OPTIONS.filter(opt => opt.sports === null || opt.sports.includes(sport));
}
