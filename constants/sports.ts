export const SPORTS = {
  badminton:      { label: 'Badminton',      emoji: '🏸', court: 'Court', playersPerGame: 4, supportsDoublesToggle: true  },
  pickleball:     { label: 'Pickleball',     emoji: '🥒', court: 'Court', playersPerGame: 4, supportsDoublesToggle: true  },
  tennis:         { label: 'Tennis',         emoji: '🎾', court: 'Court', playersPerGame: 4, supportsDoublesToggle: true  },
  tableTennis:    { label: 'Table Tennis',   emoji: '🏓', court: 'Table', playersPerGame: 2, supportsDoublesToggle: true  },
  squash:         { label: 'Squash',         emoji: '🎾', court: 'Court', playersPerGame: 2, supportsDoublesToggle: false },
  padel:          { label: 'Padel',          emoji: '🎾', court: 'Court', playersPerGame: 4, supportsDoublesToggle: false },
  pool:           { label: 'Pool',           emoji: '🎱', court: 'Table', playersPerGame: 2, supportsDoublesToggle: false },
  darts:          { label: 'Darts',          emoji: '🎯', court: 'Board', playersPerGame: 2, supportsDoublesToggle: false },
  volleyball:     { label: 'Volleyball',     emoji: '🏐', court: 'Court', playersPerGame: 6, supportsDoublesToggle: false },
  beachVolleyball:{ label: 'Beach Volley',   emoji: '🏖️', court: 'Court', playersPerGame: 4, supportsDoublesToggle: false },
  basketball:     { label: 'Basketball',     emoji: '🏀', court: 'Court', playersPerGame: 10, supportsDoublesToggle: false },
} as const;

export type SportKey = keyof typeof SPORTS;
export const DEFAULT_SPORT: SportKey = 'badminton';

export function getSportConfig(sport?: string | null) {
  return SPORTS[(sport as SportKey) ?? DEFAULT_SPORT] ?? SPORTS[DEFAULT_SPORT];
}
