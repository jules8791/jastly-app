export const SPORTS = {
  badminton:   { label: 'Badminton',    emoji: '🏸', court: 'Court', playersPerGame: 4 },
  pickleball:  { label: 'Pickleball',   emoji: '🥒', court: 'Court', playersPerGame: 4 },
  tennis:      { label: 'Tennis',       emoji: '🎾', court: 'Court', playersPerGame: 4 },
  tableTennis: { label: 'Table Tennis', emoji: '🏓', court: 'Table', playersPerGame: 2 },
  squash:      { label: 'Squash',       emoji: '🎾', court: 'Court', playersPerGame: 2 },
  padel:       { label: 'Padel',        emoji: '🥒', court: 'Court', playersPerGame: 4 },
  pool:        { label: 'Pool',         emoji: '🎱', court: 'Table', playersPerGame: 2 },
  darts:       { label: 'Darts',        emoji: '🎯', court: 'Board', playersPerGame: 2 },
  volleyball:  { label: 'Volleyball',   emoji: '🏐', court: 'Court', playersPerGame: 6 },
  basketball:  { label: 'Basketball',   emoji: '🏀', court: 'Court', playersPerGame: 10 },
} as const;

export type SportKey = keyof typeof SPORTS;
export const DEFAULT_SPORT: SportKey = 'badminton';

export function getSportConfig(sport?: string | null) {
  return SPORTS[(sport as SportKey) ?? DEFAULT_SPORT] ?? SPORTS[DEFAULT_SPORT];
}
