import { SoundEngine } from './audio';
import {
  CANVAS_H,
  CANVAS_W,
  GORILLA_POS,
  LADDERS,
  PLATFORMS,
  PLAYER_SPAWN,
  WORLD_MAX_X,
  WORLD_MIN_X,
  getPlatformSlopeAngle,
  getPlatformY,
} from './levelData';
import { type SpriteAssets, loadSpriteAssets } from './sprites';
import type { GamePhase, HudSnapshot, InputState, LadderDef, MatchStats } from './types';

const GRAVITY = 1480; // px/s^2
const JUMP_VY = -575; // px/s (clears policemen ~111px peak, cannot skip floors without ladders)
const PLAYER_SPEED = 280; // px/s
const CLIMB_SPEED = 215; // px/s
const MAX_LIVES = 3;

const GORILLA_PHRASES = [
  '¡LEY Y ORDEN!',
  'La ciudad sin piquetes',
  'La ciudad sin manteros',
  'La ciudad sin okupas',
];

interface AvocadoEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  life: number;
}

interface PoliceEntity {
  active: boolean;
  kind: 'officer' | 'car';
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  state: 'air' | 'chase' | 'climb' | 'knockout';
  ladder: LadderDef | null;
  checkedLadders: Set<string>;
  jumpedScored: boolean;
  walkPhase: number;
  tumbleAngle: number;
  facing: -1 | 1;
  aggressive: boolean;
  jumpCooldown: number;
  ignoreLevel: number;
}

interface ParticleEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export class GameEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound = new SoundEngine();
  private assets: SpriteAssets | null = null;

  private avocados: AvocadoEntity[] = [];
  private policePool: PoliceEntity[] = [];
  private particles: ParticleEntity[] = [];

  private phase: GamePhase = 'intro';
  private lives = MAX_LIVES;
  private score = 0;
  private elapsedSeconds = 0;
  private paltasThrown = 0;
  private policeDefeated = 0;
  private policeJumped = 0;
  private hintText: string | null = null;
  private hintTimer = 0;
  private lastBonusText: string | null = null;
  private bonusTimer = 0;

  // Player state
  private px = PLAYER_SPAWN.x;
  private py = PLAYER_SPAWN.y;
  private pvx = 0;
  private pvy = 0;
  private pFacing: -1 | 1 = 1;
  private pLevel = 0;
  private pGrounded = true;
  private pOnLadder: LadderDef | null = null;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private throwCooldown = 0;
  private throwAnimTimer = 0;
  private invulnTimer = 0;
  private walkPhase = 0;
  private climbPhase = 0;
  private climbSoundAccum = 0;
  private idleTimer = 0;
  private squashX = 1;
  private squashY = 1;

  // Gorilla state
  private gorillaThrowClock = 1.1;
  private gorillaWindup = 0;
  private gorillaThrowCount = 0;
  private gorillaSpeechTimer = 0;
  private gorillaSpeechCooldown = 2.0;
  private gorillaSpeechText = GORILLA_PHRASES[0];
  private gorillaPhraseIdx = 0;
  private gorillaDefeated = false;
  private gorillaFallX = GORILLA_POS.x;
  private gorillaFallY = GORILLA_POS.y;
  private gorillaFallVx = 0;
  private gorillaFallVy = 0;
  private gorillaFallRot = 0;
  private victoryCelebrateTimer = 0;

  // Screen shake
  private shakeTimer = 0;
  private shakeIntensity = 0;

  // Loop
  private rafId = 0;
  private lastTime = 0;
  private globalTime = 0;
  private disposed = false;
  private lastHudPush = 0;

  private input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpPressed: false,
    throwPressed: false,
  };

  private onHudUpdate: (hud: HudSnapshot) => void;
  private onMatchEnd: (stats: MatchStats) => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (hud: HudSnapshot) => void,
    onMatchEnd: (stats: MatchStats) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onMatchEnd = onMatchEnd;

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

    this.initPools();
    this.resetWorldState();
    this.handleResize();

    loadSpriteAssets().then((loaded) => {
      if (!this.disposed) {
        this.assets = loaded;
      }
    });

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    this.pushHud(true);
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private initPools(): void {
    for (let i = 0; i < 12; i++) {
      this.avocados.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, life: 0 });
    }
    for (let i = 0; i < 8; i++) {
      this.policePool.push({
        active: false,
        kind: 'officer',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        level: 4,
        state: 'air',
        ladder: null,
        checkedLadders: new Set(),
        jumpedScored: false,
        walkPhase: 0,
        tumbleAngle: 0,
        facing: -1,
        aggressive: false,
        jumpCooldown: 0,
        ignoreLevel: -1,
      });
    }
    for (let i = 0; i < 55; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 6,
        color: '#84CC16',
        life: 0,
        maxLife: 0.6,
      });
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
  }

  public setInput(patch: Partial<InputState>): void {
    Object.assign(this.input, patch);
    if (patch.jumpPressed) {
      this.jumpBufferTimer = 0.12;
    }
  }

  public startGame(): void {
    this.sound.unlock();
    this.resetWorldState();
    this.phase = 'playing';
    this.sound.startMusic();
    this.pushHud(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.sound.stopMusic();
      this.pushHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.sound.startMusic();
      this.pushHud(true);
    }
  }

  public toggleMute(): boolean {
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    return next;
  }

  public isMuted(): boolean {
    return this.sound.isMuted();
  }

  private resetWorldState(): void {
    this.lives = MAX_LIVES;
    this.score = 0;
    this.elapsedSeconds = 0;
    this.paltasThrown = 0;
    this.policeDefeated = 0;
    this.policeJumped = 0;
    this.hintText = null;
    this.hintTimer = 0;
    this.lastBonusText = null;
    this.bonusTimer = 0;

    this.px = PLAYER_SPAWN.x;
    this.py = PLAYER_SPAWN.y;
    this.pvx = 0;
    this.pvy = 0;
    this.pFacing = 1;
    this.pLevel = 0;
    this.pGrounded = true;
    this.pOnLadder = null;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.throwCooldown = 0;
    this.throwAnimTimer = 0;
    this.invulnTimer = 0;
    this.walkPhase = 0;
    this.climbPhase = 0;
    this.idleTimer = 0;
    this.squashX = 1;
    this.squashY = 1;

    this.gorillaThrowClock = 1.0;
    this.gorillaWindup = 0;
    this.gorillaThrowCount = 0;
    this.gorillaSpeechTimer = 0;
    this.gorillaSpeechCooldown = 1.6;
    this.gorillaPhraseIdx = 0;
    this.gorillaSpeechText = GORILLA_PHRASES[0];
    this.gorillaDefeated = false;
    this.gorillaFallX = GORILLA_POS.x;
    this.gorillaFallY = GORILLA_POS.y;
    this.gorillaFallVx = 0;
    this.gorillaFallVy = 0;
    this.gorillaFallRot = 0;
    this.victoryCelebrateTimer = 0;

    for (const a of this.avocados) a.active = false;
    for (const p of this.policePool) p.active = false;
    for (const pt of this.particles) pt.active = false;
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed = 260): void {
    let spawned = 0;
    for (const pt of this.particles) {
      if (pt.active) continue;
      pt.active = true;
      pt.life = 0.4 + Math.random() * 0.35;
      pt.maxLife = pt.life;
      pt.x = x;
      pt.y = y;
      pt.size = 4 + Math.random() * 5;
      pt.color = color;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.8) * speed;
      pt.vx = Math.cos(ang) * spd;
      pt.vy = -Math.abs(Math.sin(ang)) * spd - 60;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private throwAvocado(silent = false): void {
    if (this.throwCooldown > 0 || this.pOnLadder) return;
    const slot = this.avocados.find((a) => !a.active);
    if (!slot) return;

    slot.active = true;
    slot.x = this.px + this.pFacing * 28;
    slot.y = this.py - 46;
    slot.vx = this.pFacing * 640 + this.pvx * 0.2;
    slot.vy = -215;
    slot.angle = 0;
    slot.life = 2.2;

    this.throwCooldown = 0.38;
    this.throwAnimTimer = 0.22;
    this.squashX = 1.15;
    this.squashY = 0.88;
    if (!silent) {
      this.paltasThrown++;
      this.sound.playThrow();
    }
  }

  private spawnPoliceFromGorilla(silent = false): void {
    const activeCount = this.policePool.filter((p) => p.active && p.state !== 'knockout').length;
    if (activeCount >= 6) return;
    const slot = this.policePool.find((p) => !p.active);
    if (!slot) return;

    this.gorillaThrowCount++;
    const isCar = this.gorillaThrowCount % 3 === 0;

    slot.active = true;
    slot.kind = isCar ? 'car' : 'officer';
    slot.x = GORILLA_POS.x - 48;
    slot.y = GORILLA_POS.y - (isCar ? 24 : 54);
    const highThrow = !isCar && Math.random() < 0.35;
    slot.vx = isCar
      ? -(275 + Math.random() * 55)
      : highThrow
        ? -(310 + Math.random() * 80)
        : -(220 + Math.random() * 65);
    slot.vy = isCar ? -140 : highThrow ? -320 : -180;
    slot.level = 4;
    slot.state = 'air';
    slot.ladder = null;
    slot.checkedLadders.clear();
    slot.jumpedScored = false;
    slot.walkPhase = Math.random() * Math.PI * 2;
    slot.tumbleAngle = 0;
    slot.facing = -1;
    slot.aggressive = false;
    slot.jumpCooldown = 0.8;
    slot.ignoreLevel = -1;

    if (!silent) {
      if (isCar) {
        this.sound.playSiren();
      } else {
        this.sound.playGorillaThrow();
      }
    }
  }

  private updatePlayer(dt: number): void {
    if (this.throwCooldown > 0) this.throwCooldown -= dt;
    if (this.throwAnimTimer > 0) this.throwAnimTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    this.squashX += (1 - this.squashX) * Math.min(1, dt * 14);
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 14);

    if (this.input.throwPressed) {
      this.throwAvocado();
      this.input.throwPressed = false;
    }

    // Ladder Grab Check
    if (!this.pOnLadder) {
      if (this.input.up) {
        const lad = LADDERS.find(
          (l) =>
            Math.abs(this.px - l.x) < 36 &&
            this.py <= l.bottomY + 24 &&
            this.py > l.topY + 10,
        );
        if (lad && (this.pGrounded || Math.abs(this.pvy) < 180)) {
          this.pOnLadder = lad;
          this.pvx = 0;
          this.pvy = 0;
          this.pGrounded = false;
        }
      } else if (this.input.down && this.pGrounded) {
        const lad = LADDERS.find(
          (l) =>
            Math.abs(this.px - l.x) < 36 &&
            Math.abs(this.py - l.topY) < 26,
        );
        if (lad) {
          this.pOnLadder = lad;
          this.pvx = 0;
          this.pvy = 0;
          this.pGrounded = false;
          this.py = lad.topY + 6;
        }
      }
    }

    if (this.pOnLadder) {
      const lad = this.pOnLadder;
      this.px += (lad.x - this.px) * Math.min(1, dt * 18);

      let climbDir = 0;
      if (this.input.up) climbDir = -1;
      else if (this.input.down) climbDir = 1;

      this.py += climbDir * CLIMB_SPEED * dt;
      if (climbDir !== 0) {
        this.climbPhase += dt * 12;
        this.climbSoundAccum += dt;
        if (this.climbSoundAccum >= 0.19) {
          this.climbSoundAccum = 0;
          this.sound.playClimb();
        }
      }

      if (this.py <= lad.topY) {
        this.py = lad.topY;
        this.pLevel = lad.upperLevel;
        this.pOnLadder = null;
        this.pGrounded = true;
        this.pvy = 0;
      } else if (this.py >= lad.bottomY) {
        this.py = lad.bottomY;
        this.pLevel = lad.lowerLevel;
        this.pOnLadder = null;
        this.pGrounded = true;
        this.pvy = 0;
      } else if (this.jumpBufferTimer > 0) {
        this.pOnLadder = null;
        this.pvy = JUMP_VY * 0.85;
        this.jumpBufferTimer = 0;
        this.sound.playJump();
      }
    } else {
      const moveDir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      if (moveDir !== 0) {
        this.pFacing = moveDir > 0 ? 1 : -1;
        this.pvx += (moveDir * PLAYER_SPEED - this.pvx) * Math.min(1, dt * 18);
        this.idleTimer = 0;
      } else {
        this.pvx += (0 - this.pvx) * Math.min(1, dt * 22);
        this.idleTimer += dt;
      }

      if (this.pGrounded) {
        this.coyoteTimer = 0.1;
      } else if (this.coyoteTimer > 0) {
        this.coyoteTimer -= dt;
      }

      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        this.pvy = JUMP_VY;
        this.pGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.squashX = 0.84;
        this.squashY = 1.18;
        this.sound.playJump();
        this.spawnParticles(this.px, this.py, '#CBD5E1', 5, 130);
      }

      const prevY = this.py;
      this.px += this.pvx * dt;
      this.px = Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, this.px));

      if (this.pGrounded) {
        const surfY = getPlatformY(this.pLevel, this.px);
        if (surfY !== null) {
          this.py = surfY;
          this.pvy = 0;
        } else {
          this.pGrounded = false;
        }
      } else {
        this.pvy += GRAVITY * dt;
        this.py += this.pvy * dt;

        // Land on girder when falling downward (Y increases downward)
        if (this.pvy >= 0) {
          for (let lvl = PLATFORMS.length - 1; lvl >= 0; lvl--) {
            const surfY = getPlatformY(lvl, this.px);
            if (surfY !== null && prevY <= surfY + 14 && this.py >= surfY - 4) {
              this.py = surfY;
              this.pvy = 0;
              this.pGrounded = true;
              this.pLevel = lvl;
              this.squashX = 1.18;
              this.squashY = 0.84;
              this.spawnParticles(this.px, this.py, '#CBD5E1', 4, 110);
              break;
            }
          }
        }
      }

      if (this.py > 664) {
        this.py = getPlatformY(0, this.px) ?? 656;
        this.pvy = 0;
        this.pGrounded = true;
        this.pLevel = 0;
      }

      if (Math.abs(this.pvx) > 15 && this.pGrounded) {
        this.walkPhase += dt * 15;
      }
    }

    this.input.jumpPressed = false;
  }

  private updateGorilla(dt: number): void {
    if (this.gorillaDefeated) {
      this.gorillaFallVy += GRAVITY * 0.72 * dt;
      this.gorillaFallX += this.gorillaFallVx * dt;
      this.gorillaFallY += this.gorillaFallVy * dt;
      this.gorillaFallRot += dt * 3.4;
      if (this.gorillaFallY > GORILLA_POS.y) {
        this.gorillaFallY = GORILLA_POS.y;
        this.gorillaFallVy = -Math.abs(this.gorillaFallVy) * 0.35;
        this.gorillaFallVx *= 0.7;
      }
      this.gorillaFallX = Math.min(1195, this.gorillaFallX);
      return;
    }

    const interval = Math.max(1.75, 2.55 - this.pLevel * 0.16);
    this.gorillaThrowClock -= dt;

    if (this.gorillaThrowClock <= 0.45 && this.gorillaWindup <= 0) {
      this.gorillaWindup = 0.45;
    }

    if (this.gorillaThrowClock <= 0) {
      this.spawnPoliceFromGorilla(this.phase === 'intro');
      this.gorillaThrowClock = interval;
    }

    if (this.gorillaWindup > 0) {
      this.gorillaWindup -= dt;
    }

    if (this.gorillaSpeechTimer > 0) {
      this.gorillaSpeechTimer -= dt;
    }

    this.gorillaSpeechCooldown -= dt;
    if (this.gorillaSpeechCooldown <= 0) {
      this.gorillaSpeechText = GORILLA_PHRASES[this.gorillaPhraseIdx % GORILLA_PHRASES.length];
      this.gorillaPhraseIdx++;
      this.gorillaSpeechTimer = 2.5;
      this.gorillaSpeechCooldown = 4.8 + Math.random() * 2.2;
    }
  }

  private updatePolice(dt: number): void {
    for (const p of this.policePool) {
      if (!p.active) continue;

      if (p.state === 'knockout') {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.tumbleAngle += dt * 12;
        if (p.y > CANVAS_H + 100) {
          p.active = false;
        }
        continue;
      }

      if (p.jumpCooldown > 0) p.jumpCooldown -= dt;

      if (p.state === 'climb' && p.ladder) {
        p.x += (p.ladder.x - p.x) * Math.min(1, dt * 16);
        p.y += 205 * dt;
        p.walkPhase += dt * 13;
        p.tumbleAngle = 0;

        if (p.y >= p.ladder.bottomY) {
          p.y = p.ladder.bottomY;
          p.level = p.ladder.lowerLevel;
          p.state = 'chase';
          p.ladder = null;
          // Choose attack direction: if on same floor as player, chase player; else follow down-slope!
          if (p.level === this.pLevel && this.phase === 'playing') {
            p.facing = this.px >= p.x ? 1 : -1;
            p.aggressive = true;
          } else {
            p.facing = PLATFORMS[p.level].downDir;
            p.aggressive = false;
          }
          p.vx = p.facing * 245;
        }
      } else if (p.state === 'air') {
        const prevY = p.y;
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.tumbleAngle += (p.vx >= 0 ? 1 : -1) * dt * 8.5;

        // Soft screen bounds only on top platform throw so initial throw stays inside arena
        if (p.ignoreLevel === -1 && p.level === 4) {
          if (p.x < 140 && p.vx < 0) {
            p.x = 140;
            p.vx = 0;
          } else if (p.x > 1190 && p.vx > 0) {
            p.x = 1190;
            p.vx = -60;
          }
        }

        if (p.vy >= 0) {
          for (let lvl = PLATFORMS.length - 1; lvl >= 0; lvl--) {
            if (lvl === p.ignoreLevel) continue;
            const surfY = getPlatformY(lvl, p.x);
            if (surfY !== null && prevY <= surfY + 20 && p.y >= surfY - 6) {
              p.y = surfY;
              p.level = lvl;
              p.ignoreLevel = -1;
              if (p.vy > 300) {
                p.vy = -p.vy * 0.32;
                this.spawnParticles(p.x, p.y, '#CBD5E1', 4, 120);
              } else {
                p.vy = 0;
                p.state = 'chase';
                p.tumbleAngle = 0;
                p.facing = PLATFORMS[lvl].downDir;
                p.vx = p.facing * (235 + (4 - lvl) * 10);
              }
              break;
            }
          }
        }

        if (p.y > CANVAS_H + 80) {
          p.active = false;
          continue;
        }
      } else if (p.state === 'chase') {
        p.walkPhase += dt * (p.kind === 'car' ? 22 : 15);

        // Attack behavior: if on same floor as Vendor during gameplay, turn and charge toward Vendor!
        if (this.phase === 'playing' && p.level === this.pLevel) {
          p.aggressive = true;
          const wantDir: -1 | 1 = this.px >= p.x ? 1 : -1;
          p.facing = wantDir;
          const chaseSpeed = p.kind === 'car' ? 340 : 275;
          const targetSpd = wantDir * chaseSpeed;
          p.vx += (targetSpd - p.vx) * Math.min(1, dt * (p.kind === 'car' ? 10 : 8));

          if (
            p.kind === 'officer' &&
            p.jumpCooldown <= 0 &&
            Math.abs(this.px - p.x) < 165 &&
            Math.abs(this.px - p.x) > 55
          ) {
            p.vy = -340;
            p.state = 'air';
            p.ignoreLevel = -1;
            p.jumpCooldown = 2.0;
          }
        } else {
          p.aggressive = false;
          const dir = PLATFORMS[p.level].downDir;
          p.facing = dir;
          const baseSpeed = p.kind === 'car' ? 285 : 230;
          const targetSpd = dir * (baseSpeed + (4 - p.level) * 14);
          p.vx += (targetSpd - p.vx) * Math.min(1, dt * 7);
        }

        p.x += p.vx * dt;

        // Only officers climb down ladders; patrol cars keep speeding down the ramps!
        if (p.kind === 'officer') {
          for (const lad of LADDERS) {
            if (
              lad.upperLevel === p.level &&
              !p.checkedLadders.has(lad.id) &&
              Math.abs(p.x - lad.x) < 18
            ) {
              p.checkedLadders.add(lad.id);
              const playerBelow = this.pLevel < p.level;
              const takeChance = playerBelow ? 0.55 : 0.25;
              if (Math.random() < takeChance) {
                p.state = 'climb';
                p.ladder = lad;
                p.vx = 0;
                break;
              }
            }
          }
          if (p.state === 'climb') continue;
        }

        const surfY = getPlatformY(p.level, p.x);
        if (surfY !== null) {
          p.y = surfY;
          p.tumbleAngle = getPlatformSlopeAngle(p.level, p.x) * (p.kind === 'car' ? 0.95 : 0.4);
        } else {
          // Reached girder end -> cleanly drop off to the girder below!
          if (p.level === 0) {
            if (p.x < -55 || p.x > CANVAS_W + 55) {
              p.active = false;
              continue;
            }
            p.facing = -1;
            p.vx = p.kind === 'car' ? -310 : -250;
          } else {
            p.ignoreLevel = p.level;
            p.state = 'air';
            p.vy = 40;
            p.vx = PLATFORMS[p.level - 1].downDir * (p.kind === 'car' ? 135 : 95);
          }
        }
      }

      // Jump Bonus & Player Hit Check (during gameplay)
      if (this.phase === 'playing') {
        const jumpWidth = p.kind === 'car' ? 50 : 38;
        if (
          !p.jumpedScored &&
          !this.pGrounded &&
          !this.pOnLadder &&
          Math.abs(this.px - p.x) < jumpWidth &&
          this.py < p.y - 30 &&
          this.py > p.y - 145
        ) {
          p.jumpedScored = true;
          this.policeJumped++;
          const pts = p.kind === 'car' ? 150 : 100;
          this.score += pts;
          this.sound.playBonus();
          this.showBonus(`¡SALTO +${pts}!`);
        }

        if (this.invulnTimer <= 0) {
          const hitRx = p.kind === 'car' ? 40 : 28;
          const hitRy = p.kind === 'car' ? 24 : 32;
          const dx = Math.abs(this.px - p.x);
          const dy = Math.abs(this.py - 36 - (p.y - (p.kind === 'car' ? 20 : 34)));
          if (dx < hitRx && dy < hitRy) {
            this.handlePlayerHit(p);
            return;
          }
        }
      }
    }
  }

  private handlePlayerHit(culprit: PoliceEntity): void {
    this.lives--;
    this.sound.playHit();
    this.shakeTimer = 0.32;
    this.shakeIntensity = 12;
    this.spawnParticles(this.px, this.py - 38, '#EF4444', 14, 280);

    culprit.state = 'knockout';
    culprit.vy = -340;
    culprit.vx = culprit.x < this.px ? -220 : 220;

    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'gameover';
      this.sound.playGameOver();
      this.pushHud(true);
      this.onMatchEnd({
        won: false,
        score: this.score,
        livesRemaining: 0,
        timeSeconds: Math.round(this.elapsedSeconds),
        paltasThrown: this.paltasThrown,
        policeDefeated: this.policeDefeated,
        policeJumped: this.policeJumped,
      });
    } else {
      this.invulnTimer = 2.2;
      this.pvy = -260;
      this.pGrounded = false;
      this.pOnLadder = null;
      this.showHint(`¡Cuidado! Te quedan ${this.lives} ${this.lives === 1 ? 'vida' : 'vidas'}.`, 2.2);
      this.pushHud(true);
    }
  }

  private updateAvocados(dt: number): void {
    for (const a of this.avocados) {
      if (!a.active) continue;
      a.life -= dt;
      a.vy += 940 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.angle += (a.vx >= 0 ? 1 : -1) * dt * 13;

      if (a.life <= 0 || a.y > CANVAS_H + 40 || a.x < -40 || a.x > CANVAS_W + 40) {
        a.active = false;
        continue;
      }

      // Hit Police Officers & Patrol Cars
      let consumed = false;
      for (const p of this.policePool) {
        if (!p.active || p.state === 'knockout') continue;
        const hitR = p.kind === 'car' ? 46 : 38;
        const cy = p.kind === 'car' ? p.y - 22 : p.y - 36;
        const dx = a.x - p.x;
        const dy = a.y - cy;
        if (dx * dx + dy * dy < hitR * hitR) {
          p.state = 'knockout';
          p.vy = -380;
          p.vx = a.vx * 0.45;
          if (this.phase === 'playing') {
            this.policeDefeated++;
            const pts = p.kind === 'car' ? 350 : 250;
            this.score += pts;
            this.sound.playSplat();
            this.showBonus(p.kind === 'car' ? `¡PATRULLERO +${pts}!` : `¡PALTAZO +${pts}!`);
          }
          this.spawnParticles(p.x, cy, '#84CC16', 12, 260);
          this.spawnParticles(p.x, cy - 8, p.kind === 'car' ? '#38BDF8' : '#FACC15', 8, 220);
          a.active = false;
          consumed = true;
          break;
        }
      }
      if (consumed) continue;

      // Hit Blackri Kong!
      if (this.phase === 'playing' && !this.gorillaDefeated) {
        const gdx = a.x - GORILLA_POS.x;
        const gdy = a.y - (GORILLA_POS.y - 62);
        if (gdx * gdx + gdy * gdy < 62 * 62) {
          a.active = false;
          if (this.pLevel === 4) {
            this.triggerVictory();
          } else {
            this.sound.playDeflect();
            this.spawnParticles(a.x, a.y, '#84CC16', 7, 180);
            this.showHint('¡Subí a la plataforma de arriba para acertarle a Blackri Kong!', 3.0);
          }
        }
      }
    }
  }

  private triggerVictory(): void {
    this.gorillaDefeated = true;
    this.gorillaFallVx = 240;
    this.gorillaFallVy = -340;
    this.victoryCelebrateTimer = 1.75;
    this.score += 1500 + this.lives * 500;
    this.sound.playVictory();
    this.shakeTimer = 0.45;
    this.shakeIntensity = 14;

    for (const p of this.policePool) {
      if (p.active && p.state !== 'knockout') {
        p.state = 'knockout';
        p.vy = -320 - Math.random() * 140;
        p.vx = (Math.random() - 0.5) * 320;
      }
    }

    this.spawnParticles(GORILLA_POS.x, GORILLA_POS.y - 60, '#84CC16', 16, 360);
    this.spawnParticles(GORILLA_POS.x, GORILLA_POS.y - 70, '#38BDF8', 14, 380);
    this.spawnParticles(GORILLA_POS.x, GORILLA_POS.y - 70, '#FACC15', 14, 380);
    this.showBonus('¡BLACKRI KONG DERROTADO!');
    this.pushHud(true);
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.vy += 880 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  // ---- 2D RENDERING ----

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, radiusX, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGorilla(ctx: CanvasRenderingContext2D): void {
    const gx = this.gorillaDefeated ? this.gorillaFallX : GORILLA_POS.x;
    const gy = this.gorillaDefeated ? this.gorillaFallY : GORILLA_POS.y;
    const sprite = this.assets?.gorillaSprite;

    this.drawShadow(ctx, gx, GORILLA_POS.y, 48);

    ctx.save();
    ctx.translate(gx, gy);

    if (this.gorillaDefeated) {
      ctx.translate(0, -64);
      ctx.rotate(this.gorillaFallRot);
      ctx.translate(0, 64);
    } else if (this.gorillaWindup > 0) {
      const p = 1 - this.gorillaWindup / 0.45;
      const tilt = Math.sin(p * Math.PI) * -0.18;
      ctx.rotate(tilt);
      const sx = 1 + Math.sin(p * Math.PI) * 0.08;
      const sy = 1 - Math.sin(p * Math.PI) * 0.08;
      ctx.scale(sx, sy);

      // Subtle orange attack telegraph halo behind Blackri Kong
      ctx.fillStyle = `rgba(245, 158, 11, ${0.22 * Math.sin(p * Math.PI)})`;
      ctx.beginPath();
      ctx.arc(0, -65, 74, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bob = Math.sin(this.globalTime * 4.2);
      const breatheX = 1 + bob * 0.03;
      const breatheY = 1 - bob * 0.03;
      ctx.scale(breatheX, breatheY);
      ctx.rotate(Math.sin(this.globalTime * 2.1) * 0.035);
    }

    if (sprite) {
      const targetH = 132;
      const targetW = (sprite.width / sprite.height) * targetH;
      // Keep unflipped so "JM" on Blackri Kong's tie always reads cleanly!
      ctx.drawImage(sprite, -targetW / 2, -targetH, targetW, targetH);
    } else {
      ctx.fillStyle = '#4B2E1B';
      ctx.fillRect(-45, -120, 90, 120);
    }
    ctx.restore();

    // Comic Speech Bubble (silent, text-only)
    if (!this.gorillaDefeated && this.gorillaSpeechTimer > 0) {
      this.drawGorillaSpeechBubble(ctx, gx - 78, gy - 110, this.gorillaSpeechText);
    }
  }

  private drawGorillaSpeechBubble(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    phrase: string,
  ): void {
    const fade = Math.min(1, this.gorillaSpeechTimer * 3, (2.5 - this.gorillaSpeechTimer) * 5 + 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.translate(bx, by);

    ctx.font = 'bold 21px "Barlow Condensed", Impact, sans-serif';
    const textW = ctx.measureText(phrase).width;
    const boxW = Math.max(150, textW + 34);
    const boxH = 42;
    const boxLeft = -boxW;
    const boxTop = -boxH / 2;

    // Bubble shape extending to the left of Blackri Kong
    ctx.fillStyle = '#FEF3C7';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxLeft, boxTop, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // Pointer tail toward Blackri Kong
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(18, 6);
    ctx.lineTo(-2, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#991B1B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phrase, boxLeft + boxW / 2, 1);
    ctx.restore();
  }

  private drawVendor(ctx: CanvasRenderingContext2D): void {
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 16) % 2 === 0) {
      return;
    }

    const groundY = getPlatformY(this.pLevel, this.px) ?? this.py;
    if (!this.pOnLadder) {
      const airDist = Math.max(0, groundY - this.py);
      const shadowScale = Math.max(0.4, 1 - airDist / 160);
      this.drawShadow(ctx, this.px, groundY, 24 * shadowScale);
    }

    const useFront = Boolean(this.pOnLadder) || (this.pGrounded && Math.abs(this.pvx) < 12 && this.idleTimer > 1.0);
    const sprite = useFront ? this.assets?.vendorFront : this.assets?.vendorSide;

    ctx.save();
    ctx.translate(this.px, this.py);

    let bobY = 0;
    let tilt = 0;
    if (this.pOnLadder) {
      tilt = Math.sin(this.climbPhase) * 0.07;
      bobY = Math.abs(Math.sin(this.climbPhase)) * -3;
    } else if (!this.pGrounded) {
      tilt = this.pFacing * 0.06;
    } else if (Math.abs(this.pvx) > 15) {
      bobY = -Math.abs(Math.sin(this.walkPhase)) * 6;
      tilt = this.pFacing * (0.05 + Math.sin(this.walkPhase) * 0.03);
    } else {
      // Idle breathing
      bobY = Math.sin(this.globalTime * 3.5) * -2;
    }

    if (this.throwAnimTimer > 0) {
      tilt += this.pFacing * 0.12;
    }

    ctx.translate(0, bobY);
    ctx.rotate(tilt);
    // Keep front-facing sprite unflipped so "PALTAS" never mirrors backwards!
    ctx.scale((useFront ? 1 : this.pFacing) * this.squashX, this.squashY);

    if (sprite) {
      const targetH = 88;
      const targetW = (sprite.width / sprite.height) * targetH;
      ctx.drawImage(sprite, -targetW / 2, -targetH, targetW, targetH);
    } else {
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-20, -82, 40, 82);
    }
    ctx.restore();
  }

  private drawPatrullero(ctx: CanvasRenderingContext2D, p: PoliceEntity): void {
    if (p.state !== 'knockout') {
      const gY = getPlatformY(p.level, p.x);
      if (gY !== null) {
        const dist = Math.max(0, gY - p.y);
        const s = Math.max(0.35, 1 - dist / 140);
        this.drawShadow(ctx, p.x, gY, 42 * s);
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.state === 'air' || p.state === 'knockout') {
      ctx.translate(0, -22);
      ctx.rotate(p.tumbleAngle * 0.45);
      ctx.translate(0, 22);
    } else {
      ctx.rotate(p.tumbleAngle);
    }

    ctx.scale(p.facing, 1);

    // Headlight beam forward
    const beam = ctx.createLinearGradient(36, -16, 108, -10);
    beam.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(40, -18);
    ctx.lineTo(106, -32);
    ctx.lineTo(106, 0);
    ctx.lineTo(40, -10);
    ctx.closePath();
    ctx.fill();

    // Car body (Blue & White Buenos Aires Police Sedan)
    const bodyGrad = ctx.createLinearGradient(0, -34, 0, -6);
    bodyGrad.addColorStop(0, '#1D4ED8');
    bodyGrad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-42, -26, 84, 19, [6, 8, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // White police door panel + stripe
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-18, -24, 38, 14);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-40, -14, 80, 3);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', 1, -15);

    // Cabin / Roof
    ctx.fillStyle = '#1E40AF';
    ctx.beginPath();
    ctx.moveTo(-24, -26);
    ctx.lineTo(-14, -40);
    ctx.lineTo(14, -40);
    ctx.lineTo(26, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tinted windows
    ctx.fillStyle = '#93C5FD';
    ctx.beginPath();
    ctx.moveTo(-18, -27);
    ctx.lineTo(-12, -37);
    ctx.lineTo(11, -37);
    ctx.lineTo(21, -27);
    ctx.closePath();
    ctx.fill();

    // Flashing Red / Blue Siren Lightbar ("Balizas")
    const sirenFlash = Math.floor(this.globalTime * 14) % 2 === 0;
    ctx.fillStyle = sirenFlash ? '#EF4444' : '#3B82F6';
    ctx.fillRect(-7, -46, 7, 6);
    ctx.fillStyle = sirenFlash ? '#3B82F6' : '#EF4444';
    ctx.fillRect(0, -46, 7, 6);

    ctx.fillStyle = sirenFlash ? 'rgba(239, 68, 68, 0.36)' : 'rgba(59, 130, 246, 0.36)';
    ctx.beginPath();
    ctx.arc(0, -43, 18, 0, Math.PI * 2);
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(38, -21, 5, 6);

    // Spinning Wheels
    const wheelSpin = p.walkPhase;
    [-24, 24].forEach((wx) => {
      ctx.save();
      ctx.translate(wx, -7);
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(wheelSpin);
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillRect(-4, -1, 8, 2);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawPoliceman(ctx: CanvasRenderingContext2D, p: PoliceEntity): void {
    if (p.kind === 'car') {
      this.drawPatrullero(ctx, p);
      return;
    }

    if (p.state !== 'knockout' && p.state !== 'climb') {
      const gY = getPlatformY(p.level, p.x);
      if (gY !== null) {
        const dist = Math.max(0, gY - p.y);
        const s = Math.max(0.35, 1 - dist / 140);
        this.drawShadow(ctx, p.x, gY, 20 * s);
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // Aggressive pursuit siren glow & "!" alert
    if (p.aggressive && p.state === 'chase') {
      const sirenColor = Math.floor(this.globalTime * 10) % 2 === 0
        ? 'rgba(239, 68, 68, 0.32)'
        : 'rgba(59, 130, 246, 0.32)';
      ctx.fillStyle = sirenColor;
      ctx.beginPath();
      ctx.arc(0, -38, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 20px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -84);
    }

    if (p.state === 'air' || p.state === 'knockout') {
      ctx.translate(0, -36);
      ctx.rotate(p.tumbleAngle);
      ctx.translate(0, 36);
    } else {
      ctx.rotate(p.tumbleAngle);
    }

    ctx.scale(p.facing, 1);

    const stride = p.state === 'climb' ? Math.sin(p.walkPhase) * 0.55 : Math.sin(p.walkPhase) * 0.72;
    const armSwing = Math.sin(p.walkPhase) * 0.65;

    // Back leg (Blue police trousers)
    ctx.save();
    ctx.translate(-4, -28);
    ctx.rotate(-stride);
    ctx.fillStyle = '#172554';
    ctx.fillRect(-5, 0, 10, 22);
    ctx.fillStyle = '#020617';
    ctx.fillRect(-5, 19, 14, 8);
    ctx.restore();

    // Front leg (Blue police trousers)
    ctx.save();
    ctx.translate(4, -28);
    ctx.rotate(stride);
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(-5, 0, 10, 22);
    ctx.fillStyle = '#020617';
    ctx.fillRect(-5, 19, 14, 8);
    ctx.restore();

    // Torso (Classic Blue Police Uniform + Silver/Sky Stripes & Badge)
    const jacketGrad = ctx.createLinearGradient(-14, -56, 14, -26);
    jacketGrad.addColorStop(0, '#2563EB');
    jacketGrad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = jacketGrad;
    ctx.beginPath();
    ctx.roundRect(-14, -55, 28, 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Light blue/silver uniform chest stripe & silver shield badge
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(-13, -44, 26, 4);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(6, -48, 4, 0, Math.PI * 2);
    ctx.fill();

    // Belt
    ctx.fillStyle = '#090D16';
    ctx.fillRect(-14, -29, 28, 5);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(4, -29, 6, 5);

    // Head
    const headGrad = ctx.createRadialGradient(-2, -67, 2, 0, -65, 14);
    headGrad.addColorStop(0, '#F5CBA7');
    headGrad.addColorStop(1, '#C98A63');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -66, 12, 0, Math.PI * 2);
    ctx.fill();

    // Sunglasses / stern brow
    ctx.fillStyle = '#090D16';
    ctx.fillRect(1, -69, 11, 5);

    // Blue Peaked Police Cap
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.roundRect(-13, -81, 26, 12, [6, 6, 2, 2]);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-13, -73, 26, 3);
    ctx.fillStyle = '#090D16';
    ctx.fillRect(2, -72, 15, 4); // Visor brim
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(6, -77, 3, 0, Math.PI * 2); // Silver cap badge
    ctx.fill();

    // Front Arm (Blue uniform sleeve) + Baton!
    ctx.save();
    ctx.translate(2, -50);
    ctx.rotate(p.state === 'climb' ? -2.2 + stride * 0.4 : -0.45 + armSwing);
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(-4, 0, 8, 19);
    ctx.fillStyle = '#E2AD89';
    ctx.beginPath();
    ctx.arc(0, 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-2, 18, 22, 4.5);
    ctx.restore();

    ctx.restore();
  }

  private drawAvocado(ctx: CanvasRenderingContext2D, a: AvocadoEntity): void {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);

    // Bright green rim glow for arcade visibility
    ctx.fillStyle = 'rgba(163, 230, 53, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();

    // Hass avocado body
    const avoGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 15);
    avoGrad.addColorStop(0, '#4D7C0F');
    avoGrad.addColorStop(0.65, '#1E3F1C');
    avoGrad.addColorStop(1, '#0D210B');
    ctx.fillStyle = avoGrad;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.bezierCurveTo(9, -12, 13, -1, 11, 8);
    ctx.bezierCurveTo(9, 15, -9, 15, -11, 8);
    ctx.bezierCurveTo(-13, -1, -9, -12, 0, -15);
    ctx.fill();

    // Stem nub
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-2, -17, 4, 4);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderScene(): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, cw, ch);

    // Uniformly scale 1280x720 virtual stage to fit viewport cleanly
    const scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
    const offsetX = (cw - CANVAS_W * scale) * 0.5;
    const offsetY = (ch - CANVAS_H * scale) * 0.5;

    ctx.save();
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      const m = this.shakeIntensity * (this.shakeTimer / 0.4);
      shakeX = (Math.random() - 0.5) * m;
      shakeY = (Math.random() - 0.5) * m;
    }

    ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
    ctx.scale(scale, scale);

    // 1. Cached Buenos Aires Night Stage & Girders
    if (this.assets?.stageBackdrop) {
      ctx.drawImage(this.assets.stageBackdrop, 0, 0);
    }

    // 2. Characters & Projectiles
    this.drawGorilla(ctx);
    for (const p of this.policePool) {
      if (p.active) this.drawPoliceman(ctx, p);
    }
    this.drawVendor(ctx);
    for (const a of this.avocados) {
      if (a.active) this.drawAvocado(ctx, a);
    }
    this.drawParticles(ctx);

    ctx.restore();
  }

  private showHint(msg: string, duration = 2.5): void {
    this.hintText = msg;
    this.hintTimer = duration;
  }

  private showBonus(msg: string): void {
    this.lastBonusText = msg;
    this.bonusTimer = 1.4;
  }

  private pushHud(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 80) return;
    this.lastHudPush = now;
    this.onHudUpdate({
      phase: this.phase,
      lives: this.lives,
      maxLives: MAX_LIVES,
      score: this.score,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      paltasThrown: this.paltasThrown,
      policeDefeated: this.policeDefeated,
      policeJumped: this.policeJumped,
      currentLevel: this.pLevel,
      hintText: this.hintTimer > 0 ? this.hintText : null,
      lastBonusText: this.bonusTimer > 0 ? this.lastBonusText : null,
    });
  }

  private tick = (now: number): void => {
    if (this.disposed) return;

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.globalTime += dt;

    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    if (this.phase === 'playing') {
      if (this.hintTimer > 0) this.hintTimer -= dt;
      if (this.bonusTimer > 0) this.bonusTimer -= dt;

      if (this.gorillaDefeated) {
        this.victoryCelebrateTimer -= dt;
        this.updateGorilla(dt);
        this.updatePolice(dt);
        this.updateParticles(dt);
        if (this.victoryCelebrateTimer <= 0) {
          this.phase = 'victory';
          this.pushHud(true);
          this.onMatchEnd({
            won: true,
            score: this.score,
            livesRemaining: this.lives,
            timeSeconds: Math.round(this.elapsedSeconds),
            paltasThrown: this.paltasThrown,
            policeDefeated: this.policeDefeated,
            policeJumped: this.policeJumped,
          });
        }
      } else {
        this.elapsedSeconds += dt;
        this.updatePlayer(dt);
        this.updateGorilla(dt);
        this.updatePolice(dt);
        this.updateAvocados(dt);
        this.updateParticles(dt);
      }
      this.pushHud(false);
    } else if (this.phase === 'intro') {
      // Live attract-mode animation on title screen using the exact sprites!
      this.updateGorilla(dt);

      const patrol = Math.sin(this.globalTime * 1.15);
      const patrolVel = Math.cos(this.globalTime * 1.15);
      this.px = 230 + patrol * 110;
      this.pFacing = patrolVel >= 0 ? 1 : -1;
      const hopPhase = (this.globalTime * 0.9) % 2.4;
      const hopY = hopPhase < 0.45 ? Math.sin((hopPhase / 0.45) * Math.PI) * 72 : 0;
      this.py = (getPlatformY(0, this.px) ?? 656) - hopY;
      this.pGrounded = hopY < 2;
      this.pvx = patrolVel * 130;
      this.walkPhase += dt * 13;

      this.updatePolice(dt);
      this.updateParticles(dt);
    }

    this.renderScene();
    this.rafId = requestAnimationFrame(this.tick);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.sound.dispose();
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
  }
}
