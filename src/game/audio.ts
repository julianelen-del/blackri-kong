// Procedural Web Audio API sound effects & Buenos Aires arcade synth soundtrack
// Zero external .mp3 dependencies

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;
  private musicPlaying = false;
  private musicTimer: number | null = null;
  private stepIdx = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.24;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startMusic(): void {
    this.ensureContext();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.stepIdx = 0;
    const tempoMs = 155; // ~193 eighth-notes/min energetic arcade pulse

    // Minor-key urban arcade riff (E minor / tango-rock feel)
    const bassNotes = [
      82.41, 0, 82.41, 98.0, 110.0, 0, 123.47, 98.0,
      82.41, 0, 82.41, 98.0, 130.81, 123.47, 110.0, 98.0,
    ];
    const leadNotes = [
      329.63, 0, 392.0, 440.0, 493.88, 0, 440.0, 392.0,
      329.63, 0, 293.66, 329.63, 392.0, 0, 329.63, 246.94,
      329.63, 0, 392.0, 493.88, 523.25, 0, 493.88, 440.0,
      392.0, 440.0, 392.0, 329.63, 293.66, 0, 246.94, 0,
    ];

    const tick = () => {
      if (!this.musicPlaying) return;
      const ctx = this.ctx;
      if (ctx && this.musicGain && ctx.state === 'running' && !this.muted) {
        const now = ctx.currentTime;
        const bFreq = bassNotes[this.stepIdx % bassNotes.length];
        if (bFreq > 0) {
          this.playTone(bFreq, 'triangle', now, 0.12, 0.35, this.musicGain);
        }

        const lFreq = leadNotes[this.stepIdx % leadNotes.length];
        if (lFreq > 0) {
          this.playTone(lFreq, 'square', now, 0.09, 0.14, this.musicGain);
        }

        // Kick on 0, 4, 8, 12; hi-hat on offbeats
        if (this.stepIdx % 4 === 0) {
          this.playKick(now, this.musicGain);
        } else if (this.stepIdx % 2 === 1) {
          this.playHat(now, this.musicGain);
        }
      }
      this.stepIdx++;
      this.musicTimer = window.setTimeout(tick, tempoMs);
    };

    tick();
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    volume: number,
    dest: AudioNode,
    endFreq?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  private playKick(startTime: number, dest: AudioNode): void {
    this.playTone(135, 'sine', startTime, 0.09, 0.42, dest, 42);
  }

  private playHat(startTime: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.value = 0.09;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(startTime);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(230, 'square', now, 0.14, 0.22, this.sfxGain, 560);
  }

  public playThrow(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(420, 'triangle', now, 0.11, 0.28, this.sfxGain, 170);
  }

  public playClimb(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(180, 'triangle', now, 0.045, 0.18, this.sfxGain, 240);
  }

  public playGorillaThrow(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(130, 'sawtooth', now, 0.22, 0.26, this.sfxGain, 70);
    this.playTone(95, 'triangle', now + 0.04, 0.18, 0.24, this.sfxGain, 55);
  }

  public playSplat(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(320, 'sawtooth', now, 0.09, 0.26, this.sfxGain, 110);
    this.playTone(620, 'square', now + 0.04, 0.12, 0.18, this.sfxGain, 880);
  }

  public playBonus(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(523.25, 'square', now, 0.08, 0.16, this.sfxGain);
    this.playTone(659.25, 'square', now + 0.07, 0.11, 0.16, this.sfxGain);
  }

  public playHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(260, 'sawtooth', now, 0.18, 0.34, this.sfxGain, 85);
    this.playTone(190, 'square', now + 0.12, 0.25, 0.28, this.sfxGain, 62);
  }

  public playDeflect(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(280, 'triangle', now, 0.1, 0.25, this.sfxGain, 180);
  }

  public playSiren(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(620, 'triangle', now, 0.16, 0.18, this.sfxGain, 920);
    this.playTone(920, 'triangle', now + 0.16, 0.18, 0.18, this.sfxGain, 580);
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    this.stopMusic();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.11, 0.22, 0.34, 0.52, 0.66];
    const durs = [0.1, 0.1, 0.1, 0.16, 0.12, 0.45];
    notes.forEach((f, i) => {
      this.playTone(f, 'square', now + times[i], durs[i], 0.22, this.sfxGain!);
      this.playTone(f * 0.5, 'triangle', now + times[i], durs[i], 0.24, this.sfxGain!);
    });
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    this.stopMusic();
    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 329.63, 261.63];
    notes.forEach((f, i) => {
      this.playTone(f, 'sawtooth', now + i * 0.2, 0.22, 0.22, this.sfxGain!);
    });
  }

  public dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
