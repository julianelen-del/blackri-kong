export type GamePhase = 'intro' | 'playing' | 'paused' | 'victory' | 'gameover';

export interface PlatformPoint {
  x: number;
  y: number;
}

export interface PlatformDef {
  id: number;
  points: PlatformPoint[]; // Sorted ascending by x
  downDir: -1 | 1; // Direction gravity pulls rolling objects along this girder
}

export interface LadderDef {
  id: string;
  x: number;
  bottomY: number;
  topY: number;
  lowerLevel: number;
  upperLevel: number;
}

export interface MatchStats {
  won: boolean;
  score: number;
  livesRemaining: number;
  timeSeconds: number;
  paltasThrown: number;
  policeDefeated: number;
  policeJumped: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  lives: number;
  maxLives: number;
  score: number;
  elapsedSeconds: number;
  paltasThrown: number;
  policeDefeated: number;
  policeJumped: number;
  currentLevel: number;
  hintText: string | null;
  lastBonusText: string | null;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  throwPressed: boolean;
}
