// Background songs (audio/menu.mp3 and audio/partida.mp3), looped with a short crossfade so
// the end of each song blends into its start. Same start/stop interface as music.js, plus
// track() to switch between the menu and match songs.
const TRACKS = { menu: 'audio/menu.mp3', partida: 'audio/partida.mp3' };
const FADE = 2.5, VOLUME = 0.25;

class Soundtrack {
  constructor() {
    this.ctx = null; this.master = null; this.isPlaying = false;
    this.current = 'menu'; this.buffers = {}; this.loading = {};
    this.voice = null; this.timer = 0;
  }
  load(name) {
    return this.loading[name] ??= fetch(TRACKS[name]).then(r => r.arrayBuffer()).then(data => this.ctx.decodeAudioData(data))
      .then(buffer => (this.buffers[name] = buffer), () => { delete this.loading[name]; return null; });
  }
  start(ctx) {
    if (this.isPlaying) return;
    this.ctx = ctx; this.isPlaying = true;
    if (!this.master) { this.master = ctx.createGain(); this.master.gain.value = VOLUME; this.master.connect(ctx.destination); }
    void ctx.resume?.();
    for (const name in TRACKS) void this.load(name);
    this.play(this.current);
  }
  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false; clearTimeout(this.timer);
    this.fadeOut(this.voice, .3); this.voice = null;
  }
  // Switches song with a crossfade; calling it with the song already playing does nothing.
  track(name) {
    if (name === this.current) return;
    this.current = name;
    if (this.isPlaying) this.play(name);
  }
  async play(name) {
    const buffer = this.buffers[name] || await this.load(name);
    if (!buffer || !this.isPlaying || this.current !== name) return;
    clearTimeout(this.timer);
    const old = this.voice, source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), now = this.ctx.currentTime;
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(1, now + (old ? FADE : .6));
    source.start(now);
    this.voice = { source, gain };
    this.fadeOut(old, FADE);
    // Before the song ends, start it again on top so the loop has no gap.
    this.timer = setTimeout(() => { if (this.isPlaying && this.current === name) this.play(name); }, Math.max(1, buffer.duration - FADE) * 1000);
  }
  fadeOut(voice, seconds) {
    if (!voice) return;
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    try { voice.source.stop(now + seconds + .05); } catch { /* Already stopped. */ }
  }
}

export const music = new Soundtrack();
