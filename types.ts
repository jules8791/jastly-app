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
}

export interface MatchRecord {
  team1: string[];
  team2: string[];
  winners: string[];
  court?: number;
  timestamp?: string;
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
  master_roster: Player[];
  match_history: MatchRecord[];
  saved_queue: QueuePlayer[];
  join_password: string | null;
  host_uid: string | null;
  club_logo_url?: string | null;
  gender_balanced: boolean;
  avoid_repeats: boolean;
  power_guest_pin: string | null;
  sport?: string | null;
}
