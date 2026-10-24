// Procedural cartoon music engine synthesized in real-time via Web Audio API.
// Cheerful, bouncy, and non-intrusive soundtrack tuned for Pintamundo.

const N = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98
};

// 16-bar cheerful cartoon melody score (124 BPM, 16 steps per bar)
// Format: [step, note, durationInSteps, volume]
const MELODY = [
  // Bar 1 (C Major)
  [0, N.E5, 2, .75], [2, N.G5, 2, .8], [4, N.C6, 3, .9], [8, N.G5, 2, .75], [10, N.E5, 2, .7], [12, N.G5, 3, .8],
  // Bar 2 (A Minor)
  [16, N.A5, 2, .85], [18, N.C6, 2, .8], [20, N.E6, 3, .95], [24, N.C6, 2, .8], [26, N.A5, 2, .75], [28, N.G5, 3, .7],
  // Bar 3 (F Major)
  [32, N.F5, 2, .8], [34, N.A5, 2, .8], [36, N.C6, 2, .85], [38, N.D6, 2, .85], [40, N.C6, 2, .8], [42, N.A5, 2, .75], [44, N.F5, 3, .75],
  // Bar 4 (G Major)
  [48, N.G5, 2, .8], [50, N.B5, 2, .85], [52, N.D6, 3, .9], [56, N.B5, 2, .8], [58, N.A5, 2, .75], [60, N.B5, 3, .85],

  // Bar 5 (C Major)
  [64, N.E5, 2, .8], [66, N.G5, 2, .85], [68, N.C6, 3, .95], [72, N.E6, 2, .9], [74, N.D6, 2, .8], [76, N.C6, 3, .85],
  // Bar 6 (A Minor)
  [80, N.A5, 2, .85], [82, N.C6, 2, .85], [84, N.E6, 3, .95], [88, N.D6, 2, .8], [90, N.C6, 2, .8], [92, N.A5, 3, .8],
  // Bar 7 (F - G)
  [96, N.A5, 2, .85], [98, N.C6, 2, .85], [100, N.D6, 2, .9], [102, N.E6, 2, .95], [104, N.D6, 2, .85], [106, N.C6, 2, .8], [108, N.D6, 3, .85],
  // Bar 8 (C resolve)
  [112, N.C6, 6, .95], [120, N.G5, 2, .65], [122, N.A5, 2, .7], [124, N.B5, 3, .75],

  // Bar 9 (E Minor / C variation)
  [128, N.G5, 2, .8], [130, N.E5, 2, .75], [132, N.G5, 2, .8], [134, N.B5, 2, .85], [136, N.C6, 3, .9], [140, N.B5, 2, .8], [142, N.G5, 2, .75],
  // Bar 10 (A Minor)
  [144, N.A5, 2, .85], [146, N.E5, 2, .75], [148, N.A5, 2, .85], [150, N.C6, 2, .9], [152, N.E6, 3, .95], [156, N.D6, 2, .8], [158, N.C6, 2, .8],
  // Bar 11 (D Minor)
  [160, N.F5, 2, .8], [162, N.A5, 2, .85], [164, N.D6, 3, .9], [168, N.C6, 2, .8], [170, N.B5, 2, .75], [172, N.A5, 3, .8],
  // Bar 12 (G Major)
  [176, N.G5, 2, .8], [178, N.B5, 2, .85], [180, N.D6, 2, .9], [182, N.F6, 2, .95], [184, N.E6, 2, .9], [186, N.D6, 2, .85], [188, N.B5, 3, .8],

  // Bar 13 (C Major hook trill)
  [192, N.C6, 2, .9], [194, N.G5, 2, .8], [196, N.C6, 2, .9], [198, N.E6, 2, .95], [200, N.G6, 4, 1.0], [204, N.F6, 2, .85], [206, N.E6, 2, .8],
  // Bar 14 (F Major)
  [208, N.F6, 2, .9], [210, N.E6, 2, .85], [212, N.D6, 2, .85], [214, N.C6, 2, .85], [216, N.A5, 3, .8], [220, N.C6, 2, .85], [222, N.D6, 2, .85],
  // Bar 15 (G Major climax)
  [224, N.E6, 2, .9], [226, N.D6, 2, .85], [228, N.C6, 2, .85], [230, N.D6, 2, .85], [232, N.G5, 2, .8], [234, N.A5, 2, .85], [236, N.B5, 3, .9],
  // Bar 16 (C Final cadence)
  [240, N.C6, 8, .95], [250, N.G5, 2, .6], [252, N.E5, 2, .6], [254, N.D5, 2, .6]
];

// Chords progression per bar (played on off-beats as bouncy ska/cartoon skank):
const CHORDS = [
  [N.E4, N.G4, N.C5], // Bar 1 (C)
  [N.E4, N.A4, N.C5], // Bar 2 (Am)
  [N.F4, N.A4, N.C5], // Bar 3 (F)
  [N.D4, N.G4, N.B4], // Bar 4 (G)
  [N.E4, N.G4, N.C5], // Bar 5 (C)
  [N.E4, N.A4, N.C5], // Bar 6 (Am)
  [N.F4, N.A4, N.C5], // Bar 7 (F)
  [N.D4, N.G4, N.B4], // Bar 8 (G)
  [N.E4, N.G4, N.B4], // Bar 9 (Em)
  [N.E4, N.A4, N.C5], // Bar 10 (Am)
  [N.F4, N.A4, N.D5], // Bar 11 (Dm)
  [N.D4, N.G4, N.B4], // Bar 12 (G)
  [N.E4, N.G4, N.C5], // Bar 13 (C)
  [N.F4, N.A4, N.C5], // Bar 14 (F)
  [N.D4, N.G4, N.B4], // Bar 15 (G)
  [N.E4, N.G4, N.C5]  // Bar 16 (C)
];

// Bouncy ragtime bass notes per beat [beat 0, 1, 2, 3] per bar:
const BASS = [
  [N.C3, N.G2, N.C3, N.E3], // Bar 1 (C)
  [N.A2, N.E2, N.A2, N.C3], // Bar 2 (Am)
  [N.F2, N.C3, N.F2, N.A2], // Bar 3 (F)
  [N.G2, N.D3, N.G2, N.B2], // Bar 4 (G)
  [N.C3, N.G2, N.C3, N.E3], // Bar 5 (C)
  [N.A2, N.E2, N.A2, N.C3], // Bar 6 (Am)
  [N.F2, N.C3, N.G2, N.D3], // Bar 7 (F-G)
  [N.C3, N.E3, N.G3, N.B2], // Bar 8 (C)
  [N.E2, N.B2, N.E2, N.G2], // Bar 9 (Em)
  [N.A2, N.E2, N.A2, N.C3], // Bar 10 (Am)
  [N.D2, N.A2, N.D2, N.F2], // Bar 11 (Dm)
  [N.G2, N.D3, N.G2, N.B2], // Bar 12 (G)
  [N.C3, N.G2, N.C3, N.E3], // Bar 13 (C)
  [N.F2, N.C3, N.F2, N.A2], // Bar 14 (F)
  [N.G2, N.D3, N.G2, N.B2], // Bar 15 (G)
  [N.C3, N.G2, N.C3, N.C2]  // Bar 16 (C)
];

const TOTAL_STEPS = 256; // 16 bars * 16 steps
const BPM = 124;
const STEP_TIME = (60 / BPM) / 4; // ~0.121 sec per 16th note

export class MusicPlayer {
  constructor(audioCtx = null) {
    this.ctx = audioCtx;
    this.masterGain = null;
    this.filter = null;
    this.isPlaying = false;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.volume = 0.16; // Comfortable, pleasant background level
  }

  init(ctx) {
    if (this.ctx && this.masterGain) return;
    this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();

    // Warm master lowpass filter to give friendly cartoon tone
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 3200;

    // Master volume gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  start(ctx) {
    this.init(ctx);
    if (this.isPlaying) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    // Smooth fade in
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.masterGain.gain.exponentialRampToValueAtTime(this.volume, this.ctx.currentTime + 0.4);

    this.scheduleLoop();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearTimeout(this.timerId);
    this.timerId = null;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
    }
  }

  scheduleLoop() {
    if (!this.isPlaying) return;
    // Lookahead scheduling: schedule all notes in the next 140ms
    const lookahead = 0.14;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.playStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += STEP_TIME;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
    this.timerId = setTimeout(() => this.scheduleLoop(), 35);
  }

  playStep(step, time) {
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const beat = Math.floor(stepInBar / 4);
    const sub = stepInBar % 4;

    // 1. Kick on beat 0 and 2 (downbeats)
    if (sub === 0 && (beat === 0 || beat === 2)) {
      this.playKick(time);
    }

    // 2. Snare / Rimclick on beat 1 and 3 (backbeats)
    if (sub === 0 && (beat === 1 || beat === 3)) {
      this.playSnare(time);
    }

    // 3. Soft hi-hat on every 8th note (sub 0 and 2)
    if (sub === 2 || (step % 8 === 4)) {
      this.playHiHat(time);
    }

    // 4. Bass note on each quarter beat (sub === 0)
    if (sub === 0) {
      const bassNote = BASS[bar][beat];
      if (bassNote) this.playBass(bassNote, time, STEP_TIME * 3.5);
    }

    // 5. Chords on off-beats (sub === 2, upbeat ska/cartoon bounce)
    if (sub === 2) {
      const chord = CHORDS[bar];
      if (chord) this.playChord(chord, time, STEP_TIME * 1.8);
    }

    // 6. Lead melody notes
    // Find melody notes that start on this exact step
    for (const [mStep, freq, duration, vel] of MELODY) {
      if (mStep === step) {
        this.playMelody(freq, time, duration * STEP_TIME, vel);
      }
    }
  }

  playMelody(freq, time, duration, vel = 1) {
    if (!this.ctx || !this.filter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Warm rounded triangle with subtle warmth
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const v = vel * 0.12;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(v, time + 0.015);
    gain.gain.setValueAtTime(v * 0.8, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.filter);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  playBass(freq, time, duration) {
    if (!this.ctx || !this.filter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const v = 0.14;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(v, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.filter);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  playChord(notes, time, duration) {
    if (!this.ctx || !this.filter) return;
    for (const freq of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      const v = 0.035;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(v, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.filter);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }
  }

  playKick(time) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  playSnare(time) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.05);

    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  playHiHat(time) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, time);

    gain.gain.setValueAtTime(0.012, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.03);
  }
}

// Shared singleton for the game
export const music = new MusicPlayer();
