/**
 * Interactive Audio Engine for Zuma Deluxe
 * Procedural Audio Synthesis via Web Audio API
 * Features:
 * - Dynamic Aztec War Drums (tempo scales with proximity to Golden Skull)
 * - Harmonized pitch progression for Combos (x2, x3, x4...)
 * - Rich marble collision, launch, burst, and powerup SFX
 * - Danger warning whistle & ZUMA! victory fanfare
 */

class ZumaAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.soundVolume = 0.8;
    this.musicVolume = 0.5;
    this.isMuted = false;

    // Drum loop state
    this.drumTimer = null;
    this.drumTempo = 110; // BPM
    this.dangerLevel = 0; // 0 to 1
    this.isDrumsRunning = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this._createNoiseBuffer();
      console.log('[Audio] Procedural Web Audio Engine Initialized.');
    } catch (e) {
      console.warn('[Audio] Web Audio API init warning:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  setVolumes(soundVol, musicVol) {
    this.soundVolume = Math.max(0, Math.min(1, soundVol));
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.isMuted ? 0 : this.soundVolume, this.ctx.currentTime, 0.05);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.isMuted ? 0 : this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // Shoot Sound (Frog spit marble)
  playShoot() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  // Marble Swap Sound (Right click)
  playSwap() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Marble Collision / Clack
  playMarbleClack(force = 1) {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    // High crystalline clack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 1200 + Math.random() * 300;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

    const vol = Math.min(0.4 * force, 0.5);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Marble Match Explode with escalating pitch for combos
  playMatchExplode(comboCount = 1) {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Harmonized pitch scale based on combo count (Pentatonic Inca scale: A, C, D, E, G)
    const basePitches = [330, 440, 523, 659, 784, 880, 1046, 1174];
    const pitchIdx = Math.min(comboCount - 1, basePitches.length - 1);
    const fundamental = basePitches[pitchIdx];

    // Melodic chime
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fundamental, t);
    osc1.frequency.exponentialRampToValueAtTime(fundamental * 1.5, t + 0.25);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(fundamental * 2, t);
    osc2.frequency.exponentialRampToValueAtTime(fundamental * 2.02, t + 0.25);

    chimeGain.gain.setValueAtTime(0.5, t);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc1.connect(chimeGain);
    osc2.connect(chimeGain);
    chimeGain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.36);
    osc2.stop(t + 0.36);

    // Deep sub-bass punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + 0.2);

    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    subOsc.start(t);
    subOsc.stop(t + 0.22);
  }

  // Magnetic Pull Sound (when balls pull backwards together)
  playMagneticPull() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(380, t + 0.18);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.21);
  }

  // Powerup sounds
  playBombExplode() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Low boom + noise blast
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.5);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.55);
    }
  }

  playSlowMotion() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.4);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.42);
  }

  playReverseWarp() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(550, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.37);
  }

  playLaserBeam() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(1200, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Warning Skull Alarm
  playWarningSkull() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(420, t + 0.12);
    osc.frequency.linearRampToValueAtTime(320, t + 0.25);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Zuma Chant / Fanfare
  playZumaFanfare() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const notes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);

      gain.gain.setValueAtTime(0.01, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.5, t + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.55);
    });
  }

  // Level Victory Jingle
  playVictory() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const arpeggio = [523, 659, 783, 1046, 1318];
    arpeggio.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.12);

      gain.gain.setValueAtTime(0.4, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.45);
    });
  }

  // Game Over Defeat
  playGameOver() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const notes = [440, 415, 392, 349, 293];
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t + idx * 0.2);

      gain.gain.setValueAtTime(0.4, t + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.2 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.2);
      osc.stop(t + idx * 0.2 + 0.38);
    });
  }

  // Aztec War Drums Loop (procedural percussion)
  startWarDrums() {
    if (this.isDrumsRunning) return;
    this.isDrumsRunning = true;
    this._scheduleDrums();
  }

  stopWarDrums() {
    this.isDrumsRunning = false;
    if (this.drumTimer) {
      clearTimeout(this.drumTimer);
      this.drumTimer = null;
    }
  }

  setDangerLevel(level) {
    // level: 0.0 to 1.0 (how close balls are to the skull)
    this.dangerLevel = Math.max(0, Math.min(1, level));
    // Accelerate drum tempo from 100 BPM to 180 BPM
    this.drumTempo = 100 + this.dangerLevel * 80;
  }

  _scheduleDrums() {
    if (!this.isDrumsRunning) return;
    this.ensureContext();

    if (!this.isMuted && this.ctx && this.musicVolume > 0.01) {
      this._playDrumBeat();
    }

    const intervalMs = (60 / this.drumTempo) * 1000 * 0.5; // Eighth note beats
    this.drumTimer = setTimeout(() => {
      this._scheduleDrums();
    }, intervalMs);
  }

  _playDrumBeat() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isAccent = Math.random() > 0.6;
    const baseFreq = isAccent ? 90 + this.dangerLevel * 40 : 65 + this.dangerLevel * 30;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.14);

    const vol = (isAccent ? 0.35 : 0.2) * (1 + this.dangerLevel * 0.5);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }
}

window.zumaAudio = new ZumaAudioEngine();
