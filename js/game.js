/* ============================================================
 * game.js — 渲染、事件流程与结局判定
 * ============================================================ */
// ---------- 渲染 ----------
const app = document.getElementById('app');
const tlBar = document.getElementById('tl-bar');

function updateTimeline(){ if(tlBar) tlBar.style.width = Math.min(100, S.month/120*100) + '%'; }

function hudHTML(){
  const total = totalAssets();
  const passive = monthlyPassive();
  const cost = monthlyCost();
  const net = passive - cost;
  const year = Math.floor(S.month/12), mon = S.month%12;
  return `
  <div class="hud">
    <div class="cell"><div class="k">时间</div><div class="v small">${S.month===0?'序章':'第'+year+'年'+(mon||12)+'月'}</div></div>
    <div class="cell"><div class="k">总资产</div><div class="v">${fmt(total)}</div></div>
    <div class="cell"><div class="k">月被动收入</div><div class="v small" style="color:var(--green)">${fmt(passive)}</div></div>
    <div class="cell"><div class="k">月支出</div><div class="v small" style="color:var(--red)">${fmt(cost)}</div></div>
  </div>
  <div class="bars">
    <div class="bar-box"><div class="k"><span>心情</span><span>${Math.round(S.mood)}</span></div><div class="bar mood"><i style="width:${S.mood}%"></i></div></div>
    <div class="bar-box"><div class="k"><span>口碑</span><span>${Math.round(S.rep)}</span></div><div class="bar rep"><i style="width:${S.rep}%"></i></div></div>
  </div>
  <div class="assets">
    <span class="asset-chip">现金 <b>${fmt(S.cash)}</b></span>
    <span class="asset-chip">存单/信托 <b>${fmt(S.deposit)}</b></span>
    <span class="asset-chip">基金 <b>${fmt(S.fund)}</b></span>
    ${S.gold?`<span class="asset-chip">黄金 <b>${fmt(S.gold)}</b></span>`:''}
    ${S.house?`<span class="asset-chip">房产 <b>${fmt(S.house)}</b></span>`:''}
    ${S.biz?`<span class="asset-chip">生意 <b>${fmt(S.biz)}</b></span>`:''}
    <span class="asset-chip">月净流 <b style="color:${net>=0?'var(--green)':'var(--red)'}">${fmtd(net)}</b></span>
  </div>`;
}

function logHTML(){
  const items = S.log.map(l=>`<div>${l}</div>`).join('');
  return `<div class="log-toggle" onclick="document.getElementById('logbox').classList.toggle('show')">📜 收支与事件流水（点击展开）</div>
  <div class="log" id="logbox">${items||'<div>暂无</div>'}</div>`;
}

function showHero(){
  app.innerHTML = `
  <div class="hero">
    <div class="emoji">🎰</div>
    <h1>中了7000万</h1>
    <div class="sub">一款「中奖后人生」模拟游戏 · 10年120个月 · 158个事件 · 14种结局</div>
    <div class="money">¥ 70,000,000</div>
    <div class="sub">偶然所得税 20% · 到手 <b style="color:var(--gold)">5600 万</b></div>
    <br>
    <button class="btn-main" onclick="startGame()">开 奖</button>
    <ul class="tips">
      <li>每月遇到一个事件，做出你的选择</li>
      <li>守住四样指标：总资产 / 被动收入 / 心情 / 口碑</li>
      <li>被动收入 &gt; 支出 = 财富自由</li>
      <li>小心：入狱、破产、离婚分割、被骗、被绑架、酗酒、众叛亲离……</li>
      <li>现实中 70% 的彩票大奖得主在几年内破产——你会是例外吗？</li>
      <li>🎵 带背景音乐与音效 · 右上角可开关（快捷键 M 音乐 / S 音效）</li>
      <li>🗣️ 语音朗读事件与结局旁白 · 快捷键 R 开关</li>
      <li>⌨️ 键盘：数字键选择选项 · 回车 / 空格继续</li>
    </ul>
  </div>`;
}

let pendingEvent = null;

function pickEvent(){
  if (S.month === 0 && !S.used.mask) return EVENTS.find(e=>e.id==='mask');
  if (S.month === 0 && !S.used.secret) return EVENTS.find(e=>e.id==='secret');

  // ---- 事件链：到点的后续剧情优先触发 ----
  while (S.queue && S.queue.length){
    const idx = S.queue.findIndex(q => q.due <= S.month);
    if (idx < 0) break;
    const item = S.queue.splice(idx, 1)[0];
    const e = EVENTS.find(x => x.id === item.id);
    if (!e) continue;                                  // 事件不存在，丢弃
    if (e.once && S.used[e.id]) continue;              // 已出现过，丢弃
    if (e.cond && !e.cond(S)) continue;                // 条件不再满足，丢弃
    return e;
  }

  for (const e of EVENTS){
    if (e.w===0 && e.cond(S) && !(e.once && S.used[e.id])){
      if (e.id==='market-crash' && S.crashFlag){ S.crashFlag=false; return e; }
      if (e.id==='bored' && S.quit && S.mood<50 && chance(0.5)) return e;
      if (e.id==='kidnap' && !S.used.kidnap) return e;
      if (e.id==='fire' && !S.used.fire && chance(0.8)) return e;
      if (e.id==='hacked' && !S.used.hacked && chance(0.8)) return e;
      if (e.id==='robbed' && !S.used.robbed && chance(0.8)) return e;
      if (e.id==='framed' && !S.used.framed && chance(0.8)) return e;
      if (e.id==='identity-theft' && !S.used.identity_theft && chance(0.8)) return e;
      if (e.id==='divorce' && !S.used.divorce && chance(0.8)) return e;
      if (e.id==='child-issue' && !S.used.child_issue && chance(0.8)) return e;
      if (e.id==='cyber-attack' && !S.used.cyber_attack && chance(0.8)) return e;
      if (e.id==='blackmail-mistress' && !S.used.blackmail_mistress && chance(0.8)) return e;
      if (e.id==='health-crisis' && !S.used.health_crisis && chance(0.8)) return e;
      if (e.id==='parents-aging' && !S.used.parents_aging && chance(0.8)) return e;
      if (e.id==='bored' && !S.used.bored) return e;
      if (e.id==='mistress' && !S.used.mistress) return e;
      if (e.id==='drinking' && !S.used.drinking) return e;
      if (e.id==='gaming' && !S.used.gaming) return e;
    }
  }
  const pool = EVENTS.filter(e=>(e.w||0)>0 && e.cond(S) && !(e.once && S.used[e.id]) && e.id!==S.lastEvent);
  let totalW = pool.reduce((a,e)=>a+e.w,0);
  if(pool.length===0) return EVENTS.find(e=>e.id==='mood-boost');
  let r = Math.random()*totalW;
  for (const e of pool){ r-=e.w; if(r<=0) return e; }
  return pool[pool.length-1];
}

function showEvent(e){
  pendingEvent = e;
  S.used[e.id] = true;
  S.lastEvent = e.id;
  updateTimeline();
  AUDIO.sfx.turn();
  const opts = e.options.map((o,i)=>`<button class="opt" onclick="choose(${i})">${o.t}<span class="sub">${o.sub||''}</span></button>`).join('');
  app.innerHTML = hudHTML() + `
  <div class="card">
    <span class="tag">${e.tag||'事件'}</span>
    <h2>${e.title}</h2>
    <p>${e.desc.replace(/\n/g,'<br>')}</p>
  </div>
  <div class="opts">${opts}</div>
  ` + logHTML();
  window.scrollTo({top:0,behavior:'smooth'});
  TTS.narrate(e.title, e.desc);   // 语音朗读事件
}

function choose(i){
  AUDIO.sfx.click();
  const e = pendingEvent;
  const before = {total: totalAssets(), mood: S.mood, rep: S.rep};
  const result = e.options[i].fx(S) || '……';
  const after = {total: totalAssets(), mood: S.mood, rep: S.rep};

  const diffs = [];
  const dT = after.total-before.total;
  if (Math.abs(dT) > 1) diffs.push(`<span class="${dT>=0?'up':'down'}">资产 ${fmtd(dT)}</span>`);
  const dM = after.mood-before.mood;
  if (dM) diffs.push(`<span class="${dM>=0?'up':'down'}">心情 ${dM>=0?'+':''}${Math.round(dM)}</span>`);
  const dR = after.rep-before.rep;
  if (dR) diffs.push(`<span class="${dR>=0?'up':'down'}">口碑 ${dR>=0?'+':''}${Math.round(dR)}</span>`);
  if (!diffs.length) diffs.push('<span class="flat">无变化</span>');

  say(`【${e.title}】${e.options[i].t}`);

  const moodDrop = dM < -10;
  const assetDrop = dT < -500*W;

  // ---- 音效 + 飘字 + 特效反馈 ----
  if (dT >= 1000*W){ AUDIO.sfx.bigWin(); toast('💰 ' + fmtd(dT), 'up'); coinRain(16); }
  else if (dT >= 200*W){ AUDIO.sfx.cash(); toast('💰 ' + fmtd(dT), 'up'); }
  else if (dT <= -1000*W){ AUDIO.sfx.danger(); toast('💥 ' + fmtd(dT), 'down'); }
  else if (dT <= -200*W){ AUDIO.sfx.loss(); toast('📉 ' + fmtd(dT), 'down'); }
  if (moodDrop) AUDIO.sfx.heart();

  app.innerHTML = hudHTML() + `
  <div class="card${moodDrop||assetDrop?' shake':''}">
    <span class="tag">${e.tag||'事件'}</span>
    <h2>${e.title}</h2>
    <p><em>你的选择：${e.options[i].t}</em></p>
  </div>
  <div class="diff">${diffs.join('')}</div>
  <div class="result${moodDrop||assetDrop?' danger':''}">${result.replace(/\n/g,'<br>')}</div>
  <button class="btn-main" onclick="nextMonth()">继续 →</button>
  ` + logHTML();
  window.scrollTo({top:0,behavior:'smooth'});
  TTS.speak(`你选择了${e.options[i].t}。` + result);   // 语音朗读结果
}

function nextMonth(){
  if (S.month===0 && !S.used.secret){ showEvent(EVENTS.find(e=>e.id==='secret')); return; }

  S.month++;
  updateTimeline();

  const passive = monthlyPassive();
  const cost = monthlyCost();
  S.cash += passive - cost;

  if (S.fund > 0){
    const r = rnd(-0.04, 0.045);
    S.fund *= (1+r);
    if (chance(0.06) && S.fund > 100*W){ S.fund *= 0.8; S.crashFlag = true; }
  }
  if (S.gold > 0) S.gold *= (1 + rnd(-0.005, 0.008));
  S.mood += (60 - S.mood)*0.03;
  if (S.lifestyle===3) S.mood -= 0.5;

  // ---- 结局判定 ----
  if (totalAssets() <= 0){ return showEnding('bankrupt'); }
  if (S.mood <= 0){ return showEnding('depress'); }
  if (S.macau >= 4){ return showEnding('gambler'); }
  if (S.police >= 2){ return showEnding('prison'); }
  if (S.blackmail >= 3){ return showEnding('kidnapped'); }
  if (S.drinking >= 4){ return showEnding('alcoholic'); }
  if (S.scamLoss >= 3000*W){ return showEnding('scam-wiped'); }
  if (S.friendsLost >= 5){ return showEnding('betrayed'); }
  if (S.illness > 0 && S.cash < 20*W && S.month >= 35){ return showEnding('illness'); }
  if (S.month >= 120){ return showEnding(); }

  showEvent(pickEvent());
}

function showEnding(force){
  S.over = true;
  updateTimeline();
  const total = Math.max(0, totalAssets());
  const passive = monthlyPassive();
  let rank, emoji, comment, dark=false;

  if (force==='bankrupt'){
    rank='破产结局'; emoji='💸'; dark=true;
    comment='钱花完了。领奖那天你以为这是一生的终点，结果只是几年狂欢的起点。\n\n现实中，约 70% 的大奖得主在几年内破产——你成了统计数据的一部分。\n\n你开始理解：中奖不是天上掉馅饼，是天上掉了一块能砸死人的金砖。';
  } else if (force==='depress'){
    rank='空心人结局'; emoji='🌧'; dark=true;
    comment='钱还在，人垮了。长期的心情归零让你失去了起床的理由。\n\n最后一次看到的风景，是窗外的夕阳。你想不通：明明有 5600 万，为什么活成了这样。\n\n财富买得到服务，买不到意义。';
  } else if (force==='gambler'){
    rank='赌徒结局'; emoji='🎲'; dark=true;
    comment='澳门的霓虹终于把你吞了进去。从「玩 20 万体验下」到押上一切，只用了四次。\n\n赌场的数学从不出错，出错的永远是人。\n\n你输掉的不只是钱——是回到正常生活的能力。';
  } else if (force==='prison'){
    rank='锒铛入狱结局'; emoji='⛓️'; dark=true;
    comment='铁门关上的声音，比你想象中要沉。\n中奖时的喜悦恍如隔世。你的律师说最多减到五年，但五年里的每一天，你都在想：如果当初没有那么贪、没有那么冲动……\n\n5600 万没能让你自由，反而把你送进了一个更小的房间。';
  } else if (force==='kidnapped'){
    rank='绑架撕票结局'; emoji='🕯️'; dark=true;
    comment='你交了赎金，但等来的不是电话，是沉默。\n警方在郊区找到了现场。你中了 7000 万的新闻曾经让你上了头条，如今又上了一次。\n\n露脸领奖那天，你以为只是分享喜悦——你不知道，那张脸正在被一群人仔细研究。\n\n5600 万的代价，最终以最残忍的方式收了回来。';
  } else if (force==='alcoholic'){
    rank='酒精致灭结局'; emoji='🍷'; dark=true;
    comment='肝脏在某个凌晨停止了工作。你倒在家中，身边是空酒瓶和到期的银行通知。\n\n酒精最初是安慰，后来是依赖，最后是凶器。你以为你在喝酒，其实是酒在喝你。\n\n5600 万买到了最好的酒，也买到了最快的毁灭。';
  } else if (force==='scam-wiped'){
    rank='骗局洗劫一空结局'; emoji='🎭'; dark=true;
    comment='你踩了 '+S.scams+' 次骗局，累计被骗 '+fmt(S.scamLoss)+'。\n\n你开始恨所有「理财顾问」「私募总监」「老朋友」——但回头看，每一次都是你自己签的字、转的账。\n\n贪婪和恐惧，是骗子的两把刀。你每次以为自己更聪明，其实只是更贪。';
  } else if (force==='betrayed'){
    rank='众叛亲离结局'; emoji='💔'; dark=true;
    comment='你赢了 '+S.friendsLost+' 个人际关系，输掉了 '+fmt(total)+' 以外的所有东西。\n\n亲戚说你冷血，朋友说你抠门，配偶说你变了——他们说的都对，也都不对。你只是守住了一个本该守住的东西：边界。\n\n但边界守到最后，你发现自己站在一座孤岛上。有钱，但没有人可以分享。';
  } else if (force==='illness'){
    rank='重病无钱结局'; emoji='🏥'; dark=true;
    comment='你的保险没覆盖这种病，或者说你一直没买保险。\n\n5600 万花在各种地方，等到真需要救命的时候，账上只剩 '+fmt(total)+'。ICU 的一天费用，比你以为的贵得多。\n\n你以为有钱就不用怕生病——直到你发现，有些病的花费，连 5600 万都扛不住。';
  } else if (total >= 12000*W && S.mood>=60 && S.rep>=60){
    rank='传奇投资人结局'; emoji='👑';
    comment='十年，你把 5600 万变成了 '+fmt(total)+'，还守住了心情和口碑。\n\n你不是靠运气活着的人——你是让运气持续复利的人。';
  } else if (total >= 8000*W){
    rank='财富自由结局'; emoji='🏝';
    comment='资产 '+fmt(total)+'，被动收入每月 '+fmt(passive)+'，彻底覆盖开销。\n\n钱在替你上班，你在替自己活。';
  } else if (total >= 5600*W){
    rank='守成有道结局'; emoji='🏡';
    comment='十年后资产 '+fmt(total)+'，跑赢了绝大多数中奖者。\n\n不冒险、不逞能、不上当——守财的智慧，也是智慧。';
  } else if (total >= 2000*W){
    rank='缩水但体面结局'; emoji='☕';
    comment='资产 '+fmt(total)+'，比巅峰时少了不少，但生活无忧。\n\n你花掉的钱换来了体验，剩下的钱换来了安全感。也算不亏。';
  } else {
    rank='坐吃山空结局'; emoji='⌛';
    comment='十年过去，只剩 '+fmt(total)+'。\n\n没有大灾大难，只是流水一样花完了。沙漏翻过来的时候，谁都以为沙子很多。';
  }

  const scamNote = S.scams>=3 ? '<br>⚠️ 你一共踩了 '+S.scams+' 次骗局，累计损失 '+fmt(S.scamLoss)+'——「韭菜觉醒」成就达成。' : '';
  const macauNote = S.macau>=2 ? '<br>🎲 去了 '+S.macau+' 次澳门——赌场永远欢迎你回来。' : '';
  const friendNote = S.friendsLost>=3 ? '<br>💔 失去了 '+S.friendsLost+' 段关系——有些钱，是用关系换的。' : '';

  // ---- 结局音效与特效 ----
  if (dark){ AUDIO.sfx.bad(); }
  else { AUDIO.sfx.good(); if (total >= 5600*W) coinRain(46); }

  app.innerHTML = `
  <div class="hero ending">
    <div class="emoji${dark?' shake-end':''}">${emoji}</div>
    <h1${dark?' class="dark"':''}>${rank}</h1>
    <div class="rank">
      历时：${Math.floor(S.month/12)} 年（${S.month} 个月）<br>
      最终资产：<b${total<5600*W?' class="red"':''}>${fmt(total)}</b>（开局 5600万）<br>
      月被动收入：<b>${fmt(passive)}</b><br>
      心情：<b>${Math.round(S.mood)}</b> · 口碑：<b>${Math.round(S.rep)}</b><br>
      去澳门：${S.macau} 次 · 踩骗局：${S.scams} 次（损失 ${fmt(S.scamLoss)}）<br>
      失去关系：${S.friendsLost} 段 · 报警记录：${S.police} 次${scamNote}${macauNote}${friendNote}
    </div>
    <div class="result" style="text-align:left${dark?' danger':''}">${comment.replace(/\n/g,'<br>')}</div>
    <button class="btn-main" onclick="startGame()">再中一次 🎰</button>
  </div>` + logHTML();
  window.scrollTo({top:0,behavior:'smooth'});
  TTS.speak('结局：' + rank + '。' + comment);   // 语音朗读结局
}

function startGame(){
  AUDIO.unlock(); AUDIO.startBgm();
  newGame();
  showEvent(pickEvent());
}

// ---------- 音频控制栏 + 键盘操作 ----------
(function initAudioUI(){
  const btnSfx = document.getElementById('btnSfx');
  const btnBgm = document.getElementById('btnBgm');
  const btnTts = document.getElementById('btnTts');
  if(btnSfx) btnSfx.onclick = function(){
    const on = AUDIO.toggleSfx();
    btnSfx.textContent = on ? '🔊' : '🔇';
    btnSfx.classList.toggle('off', !on);
    if(on) AUDIO.sfx.click();
  };
  if(btnBgm) btnBgm.onclick = function(){
    const on = AUDIO.toggleBgm();
    btnBgm.textContent = on ? '🎵' : '🔕';
    btnBgm.classList.toggle('off', !on);
  };
  if(btnTts){
    if(!TTS.supported){ btnTts.style.display = 'none'; }   // 不支持则隐藏
    else btnTts.onclick = function(){
      const on = TTS.toggle();
      btnTts.textContent = on ? '🗣️' : '🤐';
      btnTts.classList.toggle('off', !on);
    };
  }
  // 朗读时按钮脉冲反馈
  window.addEventListener('tts:start', function(){ if(btnTts) btnTts.classList.add('speaking'); });
  window.addEventListener('tts:end',  function(){ if(btnTts) btnTts.classList.remove('speaking'); });
  bindKeys();
})();

showHero();
