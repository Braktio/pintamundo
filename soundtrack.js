// Background songs (audio/menu.mp3 and audio/partida.mp3), looped with a short crossfade so
// the end of each song blends into its start. Same start/stop interface as music.js, plus
// track() to switch between the menu and match songs.
// The songs stream through two <audio> elements ("decks") instead of being decoded whole:
// a decoded song takes ~50 MB of memory, which made matches stutter on phones.
const TRACKS = { menu: 'audio/menu.mp3', partida: 'audio/partida.mp3' };
const FADE = 2.5, VOLUME = 0.25;

class Soundtrack {
  constructor() {
    this.ctx = null; this.master = null; this.isPlaying = false;
    this.current = 'menu'; this.decks = []; this.active = 0;
  }
  deck() {
    const el = new Audio(), gain = this.ctx.createGain(), deck = { el, gain, name: null, timer: 0 };
    el.preload = 'auto'; gain.gain.value = 0.0001;
    this.ctx.createMediaElementSource(el).connect(gain); gain.connect(this.master);
    // Before the song ends, start it again on the other deck so the loop has no gap.
    el.addEventListener('timeupdate', () => {
      if (this.isPlaying && deck === this.decks[this.active] && el.duration && el.currentTime > el.duration - FADE) this.play(deck.name);
    });
    return deck;
  }
  start(ctx) {
    if (this.isPlaying) return;
    this.ctx = ctx; this.isPlaying = true;
    if (!this.master) {
      this.master = ctx.createGain(); this.master.gain.value = VOLUME; this.master.connect(ctx.destination);
      this.decks = [this.deck(), this.deck()];
      // Some browsers only let an <audio> play from a tap: touch the idle deck now too.
      const idle = this.decks[this.active];
      idle.el.src = TRACKS[this.current];
      idle.el.play().then(() => { if (idle !== this.decks[this.active]) idle.el.pause(); }, () => {});
    }
    void ctx.resume?.();
    this.play(this.current);
  }
  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.fadeOut(this.decks[this.active], .3);
  }
  // Switches song with a crossfade; calling it with the song already playing does nothing.
  track(name) {
    if (name === this.current) return;
    this.current = name;
    if (this.isPlaying) this.play(name);
  }
  play(name) {
    const old = this.decks[this.active];
    this.active ^= 1;
    const deck = this.decks[this.active], now = this.ctx.currentTime;
    clearTimeout(deck.timer);
    deck.name = name;
    if (!deck.el.src.endsWith(TRACKS[name])) deck.el.src = TRACKS[name];
    deck.el.currentTime = 0;
    deck.el.play().catch(() => {});
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(0.0001, now);
    deck.gain.gain.exponentialRampToValueAtTime(1, now + (old.name ? FADE : .6));
    if (old.name) this.fadeOut(old, FADE);
  }
  fadeOut(deck, seconds) {
    const now = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(Math.max(0.0001, deck.gain.gain.value), now);
    deck.gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    clearTimeout(deck.timer);
    deck.timer = setTimeout(() => { if (!this.isPlaying || deck !== this.decks[this.active]) deck.el.pause(); }, seconds * 1000 + 50);
  }
}

export const music = new Soundtrack();
