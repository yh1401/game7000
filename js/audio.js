/* ============================================================
 * audio.js — 程序化音频引擎（基于 Web Audio API）
 * 不依赖任何外部音频文件：背景音乐与所有音效均实时合成，
 * 因此可离线运行，且不会增加仓库体积。
 *
 * 对外暴露全局对象 window.AUDIO：
 *   AUDIO.unlock()        在用户手势后解锁 / 恢复音频上下文
 *   AUDIO.startBgm()      开始循环背景音乐
 *   AUDIO.stopBgm()       停止背景音乐
 *   AUDIO.toggleBgm()     音乐开关，返回开关后状态(true=开)
 *   AUDIO.toggleSfx()     音效开关，返回开关后状态(true=开)
 *   AUDIO.sfx.<name>()    触发一个音效
 *   AUDIO.bgmOn/sfxOn/ready   只读状态
 * ============================================================ */
const AUDIO = (function () {
  'use strict';

  let ctx = null, master = null, sfxBus = null, bgmBus = null;
  let ready = false;
  let bgmRunning = false, bgmTimer = null, bgmStep = 0, bgmNext = 0;
  let sfxOn = true, bgmOn = true;

  const SFX_VOL = 0.5;      // 音效总线音量
  const BGM_VOL = 0.14;     // 音乐总线音量（压低，避免盖过音效）
  const BAR = 2.0;          // 每小节 2 秒
  const LOOKAHEAD = 0.6;    // 预排程时间窗（秒）
  const TICK = 180;         // 调度器轮询间隔（毫秒）

  // 柔和爵士进行 Am - F - C - G（A 小调），略带忧郁，贴合「金钱与人生」主题
  const CHORDS = [
    { bass: 110.00, notes: [220.00, 261.63, 329.63] },  // Am
    { bass: 87.31,  notes: [174.61, 220.00, 261.63] },  // F
    { bass: 130.81, notes: [261.63, 329.63, 392.00] },  // C
    { bass: 98.00,  notes: [196.00, 246.94, 293.66] },  // G
  ];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? SFX_VOL : 0;
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = bgmOn ? BGM_VOL : 0;
    bgmBus.connect(master);
    ready = true;
  }

  // 浏览器要求音频必须由用户手势解锁
  function unlock() {
    init();
    if (!ready) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  // ---------- 基础发声单元 ----------
  // 一个带包络（可扫频 / 可滤波）的振荡器音
  function beep(freq, dur, opts) {
    if (!ready) return;
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol == null ? 0.3 : opts.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type || 'lowpass';
      f.frequency.value = opts.filter.freq || 1200;
      f.Q.value = opts.filter.q || 1;
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(opts.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.06);
  }

  // 白噪声（用于翻页、气声、撞击等质感）
  function noise(dur, opts) {
    if (!ready) return;
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.freq || 1000;
    f.Q.value = opts.q || 0.8;
    const g = ctx.createGain();
    g.gain.value = opts.vol == null ? 0.25 : opts.vol;
    src.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- 音效库 ----------
  const sfx = {
    // 点击选项
    click() {
      beep(680, 0.07, { type: 'triangle', vol: 0.22 });
      beep(1020, 0.06, { type: 'triangle', delay: 0.02, vol: 0.12 });
    },
    // 悬停微反馈
    hover() { beep(900, 0.04, { type: 'sine', vol: 0.05 }); },
    // 事件切换（翻页感）
    turn() {
      noise(0.26, { filter: 'bandpass', freq: 720, q: 0.7, vol: 0.09 });
      beep(300, 0.22, { type: 'sine', to: 520, vol: 0.07 });
    },
    // 普通进账
    cash() {
      [523.25, 659.25, 783.99, 1046.50].forEach(function (f, i) {
        beep(f, 0.22, { type: 'triangle', delay: i * 0.06, vol: 0.19 });
      });
    },
    // 暴富
    bigWin() {
      [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach(function (f, i) {
        beep(f, 0.34, { type: 'triangle', delay: i * 0.07, vol: 0.23 });
      });
      noise(0.5, { freq: 3200, vol: 0.06 });
    },
    // 亏损
    loss() {
      [392.00, 329.63, 261.63].forEach(function (f, i) {
        beep(f, 0.26, { type: 'sawtooth', delay: i * 0.08, vol: 0.15, filter: { type: 'lowpass', freq: 900 } });
      });
    },
    // 危险 / 惊吓（低频轰鸣）
    danger() {
      beep(72, 1.1, { type: 'sawtooth', vol: 0.22, filter: { type: 'lowpass', freq: 260, q: 4 } });
      noise(0.9, { filter: 'lowpass', freq: 380, vol: 0.15 });
    },
    // 心跳（心情骤降）
    heart() {
      beep(140, 0.16, { type: 'sine', vol: 0.28, to: 90 });
      beep(140, 0.16, { type: 'sine', delay: 0.28, vol: 0.24, to: 90 });
    },
    // 坏结局
    bad() {
      [220.00, 207.65, 196.00, 185.00, 174.61].forEach(function (f, i) {
        beep(f, 0.42, { type: 'sawtooth', delay: i * 0.09, vol: 0.13, filter: { type: 'lowpass', freq: 720 } });
      });
      beep(55, 1.6, { type: 'sine', vol: 0.18 });
    },
    // 好结局
    good() {
      [392.00, 493.88, 587.33, 783.99, 987.77].forEach(function (f, i) {
        beep(f, 0.5, { type: 'triangle', delay: i * 0.1, vol: 0.2 });
      });
    },
    // 金币点缀
    coin() {
      beep(1568, 0.06, { type: 'square', vol: 0.09 });
      beep(2093, 0.09, { type: 'square', delay: 0.03, vol: 0.07 });
    },
  };

  // ---------- 背景音乐 ----------
  // 长音垫（缓慢起落，营造氛围）
  function pad(freq, dur, at, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.6);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1500;
    osc.connect(f); f.connect(g); g.connect(bgmBus);
    osc.start(at); osc.stop(at + dur + 0.1);
  }
  // 拨弦（琶音）
  function pluck(freq, at, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    osc.connect(g); g.connect(bgmBus);
    osc.start(at); osc.stop(at + 1.0);
  }

  function scheduleBar(at, idx) {
    const c = CHORDS[idx % CHORDS.length];
    pad(c.bass, BAR * 0.98, at, 0.5);
    c.notes.forEach(function (f, i) { pad(f, BAR * 0.9, at + 0.05 + i * 0.03, 0.16); });
    const seq = [c.notes[0] * 2, c.notes[1] * 2, c.notes[2] * 2, c.notes[1] * 2];
    seq.forEach(function (f, i) { pluck(f, at + i * (BAR / 4), 0.085); });
    if (idx % 4 === 3) pluck(c.notes[2] * 3, at + BAR * 0.75, 0.045);
  }

  function pump() {
    if (!ready || !bgmRunning) return;
    while (bgmNext < ctx.currentTime + LOOKAHEAD) {
      scheduleBar(bgmNext, bgmStep);
      bgmStep++;
      bgmNext += BAR;
    }
  }

  function startBgm() {
    unlock();
    if (!ready || !bgmOn || bgmRunning) return;
    bgmRunning = true;
    bgmNext = ctx.currentTime + 0.15;
    pump();
    bgmTimer = setInterval(pump, TICK);
  }
  function stopBgm() {
    bgmRunning = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  // ---------- 开关 ----------
  function toggleBgm() {
    bgmOn = !bgmOn;
    unlock();
    if (bgmBus) bgmBus.gain.setTargetAtTime(bgmOn ? BGM_VOL : 0, ctx.currentTime, 0.1);
    if (bgmOn) startBgm(); else stopBgm();
    return bgmOn;
  }
  function toggleSfx() {
    sfxOn = !sfxOn;
    unlock();
    if (sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? SFX_VOL : 0, ctx.currentTime, 0.05);
    return sfxOn;
  }

  return {
    unlock: unlock,
    startBgm: startBgm,
    stopBgm: stopBgm,
    toggleBgm: toggleBgm,
    toggleSfx: toggleSfx,
    sfx: sfx,
    get bgmOn() { return bgmOn; },
    get sfxOn() { return sfxOn; },
    get ready() { return ready; },
  };
})();
