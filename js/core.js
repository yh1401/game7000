/* ============================================================
 * core.js — 工具函数、数值格式化、游戏状态与派生指标
 * ============================================================ */
// ---------- 工具 ----------
const W = 10000;
function fmt(n){
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n >= 100000000) s = (n/100000000).toFixed(2) + '亿';
  else if (n >= W) s = Math.round(n/W) + '万';
  else s = Math.round(n) + '元';
  return (neg?'-':'') + s;
}
function fmtd(n){ return (n>=0?'+':'') + fmt(n); }
function rnd(a,b){ return a + Math.random()*(b-a); }
function chance(p){ return Math.random() < p; }

// ---------- 数字滚动动画 ----------
function animNum(el, from, to, dur=600){
  const start = performance.now();
  function tick(now){
    const t = Math.min(1,(now-start)/dur);
    const ease = 1-Math.pow(1-t,3);
    const val = from + (to-from)*ease;
    el.textContent = fmt(val);
    if(t<1) requestAnimationFrame(tick);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(tick);
}

// ---------- 震动反馈 ----------
function shakeScreen(){
  const c = document.querySelector('.card');
  if(c){ c.classList.add('shake'); setTimeout(()=>c.classList.remove('shake'),400); }
  if(navigator.vibrate) navigator.vibrate(80);
}
function flashHUD(field, up){
  const el = document.querySelector('.hud .v.'+field);
  if(!el) return;
  el.classList.add(up?'flash-up':'flash-down');
  setTimeout(()=>{el.classList.remove('flash-up');el.classList.remove('flash-down')},800);
}

// ---------- 游戏状态 ----------
let S, prevSnap;
function newGame(){
  S = {
    month: 0, cash: 5600*W, deposit: 0, fund: 0, gold: 0,
    house: 0, biz: 0, bizIncome: 0,
    carCost: 0, houseCost: 0, staffCost: 0,
    lifestyle: 1, mood: 72, rep: 70,
    macau: 0, scams: 0, scamLoss: 0,
    face: false, public: false,
    married: false, divorced: false, kids: false,
    quit: false, mba: false, gym: false,
    drinking: 0, mistress: false, gambling: 0,
    prenup: false, trust: false,
    blackmail: 0, sued: false, illness: 0,
    friendsLost: 0, police: 0,
    log: [], used: {}, lastEvent: null, over: false,
  };
}
function totalAssets(){ return S.cash + S.deposit + S.fund + S.gold + S.house + S.biz; }
function totalAssetsCond(s){ return (s.cash+s.deposit+s.fund+s.gold) > 1000*W; }
function monthlyPassive(){ return S.deposit*0.022/12 + S.bizIncome; }
function monthlyCost(){
  const base = [0, 1.2*W, 3*W, 8*W][S.lifestyle];
  return base + S.carCost + S.houseCost + S.staffCost;
}
function addMood(d){ S.mood = Math.max(0, Math.min(100, S.mood + d)); }
function addRep(d){ S.rep = Math.max(0, Math.min(100, S.rep + d)); }
function say(t){ S.log.unshift(`第${S.month}月 · ${t}`); if(S.log.length>100) S.log.pop(); }

// ---------- 顶部飘字提示 ----------
function toast(text, type){
  let box = document.getElementById('toast-box');
  if(!box){
    box = document.createElement('div');
    box.id = 'toast-box'; box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = text;
  box.appendChild(el);
  setTimeout(()=>el.classList.add('out'), 1500);
  setTimeout(()=>el.remove(), 2100);
}

// ---------- 金币雨（暴富 / 好结局特效） ----------
function coinRain(n){
  n = n || 22;
  const layer = document.createElement('div');
  layer.className = 'coin-layer';
  for(let i=0;i<n;i++){
    const c = document.createElement('span');
    c.className = 'coin';
    c.textContent = '🪙';
    c.style.left = (Math.random()*100) + '%';
    c.style.animationDelay = (Math.random()*0.9) + 's';
    c.style.animationDuration = (1.6 + Math.random()*1.4) + 's';
    c.style.fontSize = (14 + Math.random()*18) + 'px';
    layer.appendChild(c);
  }
  document.body.appendChild(layer);
  setTimeout(()=>layer.remove(), 3800);
}

// ---------- 键盘操作：数字键选择选项，回车/空格继续 ----------
let _keysBound = false;
function bindKeys(){
  if(_keysBound) return; _keysBound = true;
  document.addEventListener('keydown', function(ev){
    if(ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if(k >= '1' && k <= '9'){
      const btns = document.querySelectorAll('.opt');
      const idx = parseInt(k,10)-1;
      if(btns[idx]){ ev.preventDefault(); btns[idx].click(); }
    } else if(k === 'Enter' || k === ' '){
      const b = document.querySelector('.btn-main');
      if(b){ ev.preventDefault(); b.click(); }
    } else if(k === 's' || k === 'S'){
      const sb = document.getElementById('btnSfx'); if(sb) sb.click();
    } else if(k === 'm' || k === 'M'){
      const mb = document.getElementById('btnBgm'); if(mb) mb.click();
    }
  });
}
