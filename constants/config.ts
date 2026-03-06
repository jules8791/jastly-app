// constants/config.ts
// Central home for magic numbers and strings used across the app.
// Import from here rather than scattering literals through the codebase.

/** Maximum length of a sanitised player name (characters). */
export const MAX_NAME_LENGTH = 20;

/** Default number of active courts when a new club is created. */
export const DEFAULT_COURTS = 4;

/** Default queue pick limit (how far down the queue a guest can pick from). */
export const DEFAULT_PICK_LIMIT = 20;

/** How often the in-session timer ticks, in milliseconds. */
export const TIMER_INTERVAL_MS = 1_000;

/** How often guest heartbeats are sent/checked, in milliseconds. */
export const HEARTBEAT_INTERVAL_MS = 45_000;

/** How long without a heartbeat before a guest is considered inactive, in ms. */
export const GUEST_INACTIVE_THRESHOLD_MS = 90_000;

/** Default ELO rating for new players. */
export const DEFAULT_ELO = 1000;

/** AsyncStorage keys — centralised to avoid typos. */
export const STORAGE_KEYS = {
  currentClubId:          'currentClubId',
  isHost:                 'isHost',
  guestName:              'guestName',
  themeMode:              'theme_mode',
  ttsVoice:               'tts_voice',
  repeatEnabled:          'repeat_enabled',
  repeatInterval:         'repeat_interval',
  countdownEnabled:       'countdown_enabled',
  countdownLimit:         'countdown_limit',
  loggingEnabled:         'logging_enabled',
  pinEnabled:             'pin_enabled',
  soundEnabled:           'sound_enabled',
  fixtureId:              'current_fixture_id',
  fixtureHomeTeamId:      'current_fixture_home_team_id',
  fixtureAwayTeamId:      'current_fixture_away_team_id',
  leagueQueue:            'current_league_queue',
  leagueRubberResults:    'current_league_rubber_results',
} as const;
