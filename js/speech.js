/* ============================================================
 * speech.js — 语音朗读引擎（基于 Web Speech API）
 * 用系统自带的 TTS 朗读事件、选择结果与结局旁白，
 * 无需任何外部音频文件或网络请求。
 *
 * 对外暴露全局对象 window.TTS：
 *   TTS.speak(text)            朗读一段文本（会打断上一段）
 *   TTS.narrate(title, desc)   朗读「标题 + 正文」
 *   TTS.stop()                 停止当前朗读
 *   TTS.toggle()              朗读开关，返回开关后状态(true=开)
 *   TTS.supported/on          只读状态
 *   朗读开始 / 结束时在 window 上派发 'tts:start' / 'tts:end' 事件
 * ============================================================ */
const TTS = (function () {
  'use strict';

  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  let on = supported;      // 默认开启
  let voice = null;
  const RATE = 1.02;       // 语速（略快于默认，贴合叙事节奏）
  const PITCH = 1.0;       // 音高

  // 挑选中文语音：优先 zh-CN，其次任意中文
  function pickVoice() {
    if (!supported) return;
    const vs = synth.getVoices();
    if (!vs || !vs.length) return;
    voice =
      vs.find(v => /zh[-_]?CN/i.test(v.lang)) ||
      vs.find(v => /zh[-_]?(TW|HK)/i.test(v.lang)) ||
      vs.find(v => /^zh/i.test(v.lang)) ||
      vs.find(v => /(Chinese|中文|普通话|Tingting|Meijia|Sinji)/i.test(v.name)) ||
      null;
  }
  if (supported) {
    pickVoice();
    // 部分浏览器语音列表异步加载完毕后才可用
    synth.onvoiceschanged = pickVoice;
  }

  // 清洗文本：去掉 HTML/引号/emoji，把换行转成停顿
  function clean(t) {
    return String(t == null ? '' : t)
      .replace(/<br\s*\/?>/gi, '，')
      .replace(/[\r\n]+/g, '，')
      .replace(/[「」『』“”"'’‘`]/g, '')
      .replace(/[\uD800-\uDFFF]/g, '')                          // 代理对（emoji）
      .replace(/[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u2190-\u21FF]/g, '') // 符号
      .replace(/\s+/g, ' ')
      .replace(/，{2,}/g, '，')
      .replace(/^[，。、\s]+|[，。、\s]+$/g, '')
      .trim();
  }

  function fire(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }

  function speak(text, opts) {
    if (!supported || !on) return null;
    const t = clean(text);
    if (!t) return null;
    opts = opts || {};
    try { synth.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(t);
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'zh-CN';
    u.rate = opts.rate || RATE;
    u.pitch = opts.pitch || PITCH;
    u.volume = opts.volume == null ? 1 : opts.volume;
    u.onstart = function () { fire('tts:start'); };
    u.onend = function () { fire('tts:end'); };
    u.onerror = function () { fire('tts:end'); };
    try { synth.speak(u); } catch (e) { fire('tts:end'); return null; }
    return u;
  }

  // 朗读「标题 + 正文」
  function narrate(title, desc) {
    return speak((title ? title + '。' : '') + (desc || ''));
  }

  function stop() {
    if (!supported) return;
    try { synth.cancel(); } catch (e) {}
    fire('tts:end');
  }

  function toggle() {
    on = !on;
    if (!on) stop();
    return on;
  }

  return {
    speak: speak,
    narrate: narrate,
    stop: stop,
    toggle: toggle,
    get supported() { return supported; },
    get on() { return on; },
  };
})();
