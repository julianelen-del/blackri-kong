import type { LadderDef, PlatformDef } from './types';

// Virtual 16:9 arcade canvas coordinate system (Y grows downward)
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const WORLD_MIN_X = 48;
export const WORLD_MAX_X = 1232;

export const GORILLA_POS = { x: 935, y: 124 };
export const PLAYER_SPAWN = { x: 135, y: 656 };

// 5 Classic Donkey Kong staggered zig-zag steel girders:
// Each upper girder ends inside the span of the girder below it,
// guaranteeing thrown policemen drop cleanly from floor to floor without ever getting stuck.
export const PLATFORMS: PlatformDef[] = [
  {
    id: 0,
    points: [
      { x: 24, y: 656 },
      { x: 540, y: 656 },
      { x: 1256, y: 632 },
    ],
    downDir: -1, // Exits off left end
  },
  {
    id: 1,
    points: [
      { x: 64, y: 496 },
      { x: 1150, y: 536 },
    ],
    downDir: 1, // Drops off x=1150 onto Level 0
  },
  {
    id: 2,
    points: [
      { x: 130, y: 404 },
      { x: 1216, y: 364 },
    ],
    downDir: -1, // Drops off x=130 onto Level 1
  },
  {
    id: 3,
    points: [
      { x: 64, y: 234 },
      { x: 1150, y: 274 },
    ],
    downDir: 1, // Drops off x=1150 onto Level 2
  },
  {
    id: 4,
    points: [
      { x: 130, y: 146 },
      { x: 785, y: 124 },
      { x: 1240, y: 124 },
    ],
    downDir: -1, // Drops off x=130 onto Level 3
  },
];

export function getPlatformY(levelId: number, x: number): number | null {
  const plat = PLATFORMS[levelId];
  if (!plat) return null;
  const pts = plat.points;
  if (x < pts[0].x || x > pts[pts.length - 1].x) {
    return null;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return pts[pts.length - 1].y;
}

export function getPlatformSlopeAngle(levelId: number, x: number): number {
  const plat = PLATFORMS[levelId];
  if (!plat) return 0;
  const pts = plat.points;
  const cx = Math.max(pts[0].x, Math.min(pts[pts.length - 1].x, x));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (cx >= a.x && cx <= b.x) {
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return 0;
}

export const LADDERS: LadderDef[] = [
  {
    id: 'L0_R',
    x: 1090,
    topY: getPlatformY(1, 1090)!,
    bottomY: getPlatformY(0, 1090)!,
    lowerLevel: 0,
    upperLevel: 1,
  },
  {
    id: 'L1_M',
    x: 560,
    topY: getPlatformY(2, 560)!,
    bottomY: getPlatformY(1, 560)!,
    lowerLevel: 1,
    upperLevel: 2,
  },
  {
    id: 'L1_L',
    x: 205,
    topY: getPlatformY(2, 205)!,
    bottomY: getPlatformY(1, 205)!,
    lowerLevel: 1,
    upperLevel: 2,
  },
  {
    id: 'L2_R',
    x: 1065,
    topY: getPlatformY(3, 1065)!,
    bottomY: getPlatformY(2, 1065)!,
    lowerLevel: 2,
    upperLevel: 3,
  },
  {
    id: 'L2_M',
    x: 650,
    topY: getPlatformY(3, 650)!,
    bottomY: getPlatformY(2, 650)!,
    lowerLevel: 2,
    upperLevel: 3,
  },
  {
    id: 'L3_L',
    x: 225,
    topY: getPlatformY(4, 225)!,
    bottomY: getPlatformY(3, 225)!,
    lowerLevel: 3,
    upperLevel: 4,
  },
  {
    id: 'L3_R',
    x: 735,
    topY: getPlatformY(4, 735)!,
    bottomY: getPlatformY(3, 735)!,
    lowerLevel: 3,
    upperLevel: 4,
  },
];
