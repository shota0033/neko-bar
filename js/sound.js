// =============================================================
// sound.js … 効果音（ブラウザ上で合成する。音のファイルは使わない）
//
// ゲームの出来事から Sound.play('名前') が呼ばれます。
// 音の ON/OFF は保存して、次に開いたときも同じにします。
//
// ブラウザは「画面に一度さわるまで音を出せない」決まりがあるので、
// 最初にさわったときに音の準備をします（Sound.unlock）。
// =============================================================

const Sound = {
  enabled: true,
  ctx: null,
  master: null,
  KEY: 'nekobar_sound',

  init() {
    try {
      this.enabled = localStorage.getItem(this.KEY) !== 'off';
    } catch (e) {
      // 読めなくても ON のまま
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(this.KEY, this.enabled ? 'on' : 'off');
    } catch (e) {
      // 保存できなくても続ける
    }
    if (this.enabled) this.play('tap');
  },

  // 最初に画面にさわったときに呼ぶ
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  },

  ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  },

  // 単音：周波数を from → to に動かす
  tone({ from, to = from, dur = 0.15, type = 'sine', gain = 0.3, delay = 0, attack = 0.01 }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  // ざーっという音（水・洗い物など）
  noise({ dur = 0.3, gain = 0.15, freq = 1200, q = 0.8, delay = 0 }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  },

  // 「にゃ」：高さを上げて下げる短い声
  nya(pitch = 1) {
    const c = this.ctx;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(820 * pitch, t0 + 0.09);
    osc.frequency.exponentialRampToValueAtTime(480 * pitch, t0 + 0.32);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, t0);
    filter.frequency.exponentialRampToValueAtTime(1800, t0 + 0.1);
    filter.frequency.exponentialRampToValueAtTime(900, t0 + 0.32);
    filter.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  },

  // 効果音を鳴らす
  play(name) {
    if (!this.ready()) return;
    const r = 0.9 + Math.random() * 0.2; // 毎回少しだけ高さを変える
    switch (name) {
      case 'tap':
        this.tone({ from: 900, to: 700, dur: 0.06, gain: 0.12 });
        break;
      case 'take':
      case 'putBack':
        this.tone({ from: 1300 * r, to: 1100 * r, dur: 0.07, type: 'triangle', gain: 0.15 });
        break;
      case 'pour':
        this.noise({ dur: 0.45, gain: 0.12, freq: 1800, q: 1.5 });
        this.tone({ from: 500, to: 900, dur: 0.45, gain: 0.05 });
        break;
      case 'ladle':
        this.tone({ from: 300 * r, to: 500 * r, dur: 0.12, gain: 0.15 });
        this.noise({ dur: 0.25, gain: 0.08, freq: 900, delay: 0.05 });
        break;
      case 'potWater':
        this.noise({ dur: 0.6, gain: 0.12, freq: 1400, q: 1 });
        break;
      case 'simmerStart':
        this.bubble();
        this.bubble(0.12);
        break;
      case 'dashiDone':
        this.tone({ from: 880, dur: 0.3, gain: 0.1, type: 'triangle' });
        this.tone({ from: 1175, dur: 0.4, gain: 0.1, type: 'triangle', delay: 0.15 });
        break;
      case 'nya':
        this.nya(r);
        break;
      case 'nyaHappy':
        this.nya(1.15 * r);
        break;
      case 'coin':
        this.tone({ from: 1568, dur: 0.12, gain: 0.15, type: 'square' });
        this.tone({ from: 2093, dur: 0.35, gain: 0.12, type: 'square', delay: 0.08 });
        break;
      case 'wash':
        this.noise({ dur: 1.2, gain: 0.14, freq: 900, q: 0.7 });
        this.noise({ dur: 1.2, gain: 0.1, freq: 1600, q: 0.7, delay: 1.0 });
        break;
      case 'done':
        this.tone({ from: 660, dur: 0.2, gain: 0.1, type: 'triangle' });
        this.tone({ from: 990, dur: 0.3, gain: 0.1, type: 'triangle', delay: 0.12 });
        break;
      case 'deliver':
        this.tone({ from: 784, dur: 0.25, gain: 0.12 });
        this.tone({ from: 659, dur: 0.4, gain: 0.12, delay: 0.22 });
        break;
      case 'scoop':
        this.noise({ dur: 0.18, gain: 0.15, freq: 3000, q: 0.6 });
        break;
      case 'refill':
        this.noise({ dur: 0.7, gain: 0.12, freq: 2500, q: 0.5 });
        break;
      case 'roll':
        this.noise({ dur: 0.12, gain: 0.06, freq: 600, q: 2 });
        break;
      case 'water':
        this.noise({ dur: 0.5, gain: 0.08, freq: 2400, q: 2 });
        break;
      case 'buy':
        this.tone({ from: 523, dur: 0.15, gain: 0.12, type: 'triangle' });
        this.tone({ from: 659, dur: 0.15, gain: 0.12, type: 'triangle', delay: 0.1 });
        this.tone({ from: 784, dur: 0.3, gain: 0.12, type: 'triangle', delay: 0.2 });
        break;
      case 'door':
        this.tone({ from: 1760, dur: 0.5, gain: 0.06 });
        this.tone({ from: 2217, dur: 0.6, gain: 0.05, delay: 0.1 });
        break;
      case 'soft':
        this.tone({ from: 600, to: 500, dur: 0.12, gain: 0.08, type: 'triangle' });
        break;
    }
  },

  // ぐつぐつ（泡がはじける音）
  bubble(delay = 0) {
    if (!this.ready()) return;
    const f = 140 + Math.random() * 120;
    this.tone({ from: f, to: f * 1.8, dur: 0.07, gain: 0.12, delay });
  },

  // 煮出し中の鍋があるあいだ、ときどき泡の音を鳴らす（main.js から毎フレーム呼ぶ）
  bubbleTimer: 0,
  ambient(dt, simmering) {
    if (!simmering) return;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubble();
      this.bubbleTimer = 0.25 + Math.random() * 0.5;
    }
  },
};
