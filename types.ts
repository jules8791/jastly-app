export interface Player {
  name: string;
  gender: 'M' | 'F';
  games: number;
  wins: number;
}

export interface QueuePlayer {
  name: string;
  gender: 'M' | 'F';
  isResting?: boolean;
  isPowerGuest?: boolean;
  notes?: string;
}

export interface MatchRecord {
  team1: string[];
  team2: string[];
  winners: string[];
  court?: number;
  timestamp?: string | number;
  scoreA?: number;
  scoreB?: number;
}

export interface TournamentTeam {
  id: string;
  name: string;
  players: string[];
  wins: number;
  losses: number;
  draws: number;
  points: number;
  matchesPlayed: number;
}

export interface TournamentMatch {
  id: string;
  team1Id: string;
  team2Id: string;
  winnerId: string | null;
  scoreA?: number;
  scoreB?: number;
  timestamp?: string;
  round: number;
  courtIdx?: number;
  // Super tournament fields
  game1Scores?: Record<string, number>;
  game2Scores?: Record<string, number>;
  game2Team1?: string[];
  game2Team2?: string[];
  game1Complete?: boolean;
  // Live player score submissions (super mode)
  pendingScores?: Record<string, number>;
}

export interface Tournament {
  id: string;
  format: 'round_robin' | 'knockout' | 'super';
  teamSize: number;
  rounds: number;
  genderBalancedTeams: boolean;
  state: 'in_progress' | 'completed';
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  currentKnockoutRound: number;
  champion?: string;
  createdAt: string;
  superPlayerScores?: Record<string, number>;
  // Players removed from waiting_list during tournament; restored on end
  originalQueue?: QueuePlayer[];
  // If true, players swap team partners after game 1 in Super mode
  swapTeams?: boolean;
}

export interface CourtResult {
  courtIdx: string;
  players: QueuePlayer[];
}

export interface Club {
  id: string;
  club_name: string;
  active_courts: number;
  pick_limit: number;
  waiting_list: QueuePlayer[];
  court_occupants: Record<string, QueuePlayer[]>;
  master_roster: any; // Player[] (legacy) or Record<string, Player[]> (sport-keyed)
  match_history: MatchRecord[];
  saved_queue: QueuePlayer[];
  join_password: string | null;
  host_uid: string | null;
  club_logo_url?: string | null;
  gender_balanced: boolean;
  avoid_repeats: boolean;
  power_guest_pin: string | null;
  has_power_guest_pin?: boolean; // generated column — use this for display logic instead of power_guest_pin
  sport?: string | null;
  tournament?: Tournament | null;
  rotation_mode?: 'standard' | 'winner_stays' | 'loser_stays';
  target_game_duration?: number | null; // minutes, null/0 = disabled
}
