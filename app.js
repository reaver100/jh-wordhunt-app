/* 가족 미니게임
   - 한 폰으로: 폰을 넘겨가며 차례대로
   - 각자 폰으로: 방 번호로 모여 동시에 (무전기와 같은 PeerJS 연결) */
(() => {
'use strict';

const BUILD = '2026-11-24 17:25';
const $ = id => document.getElementById(id);
const PKEY = 'fg.players.v1';
const GKEY = 'fg.games.v1';
const HKEY = 'fg.hof.v1';
const NKEY = 'fg.myname.v1';
const POINTS = [10, 7, 5, 3, 2, 1];
const NS = 'fgame2';                       // PeerJS 아이디 앞머리

/* ---------- 게임 정의 ---------- */
const GAMES = [
  { id:'react',  emoji:'⚡', tag:'순발력', name:'반응 속도',   desc:'초록으로 바뀌면 바로 탭! 5번 평균',    better:'low',  unit:'ms' },
  { id:'tap',    emoji:'👆', tag:'순발력', name:'10초 연타',   desc:'10초 동안 최대한 많이 두드리기',       better:'high', unit:'회' },
  { id:'mole',   emoji:'🐹', tag:'순발력', name:'두더지 잡기', desc:'튀어나온 두더지만 탭! 폭탄은 감점',    better:'high', unit:'점' },
  { id:'balloon',emoji:'🎈', tag:'순발력', name:'풍선 터뜨리기', desc:'떠오르는 풍선을 30초 동안 최대한 많이', better:'high', unit:'개' },
  { id:'stroop', emoji:'🎨', tag:'순발력', name:'색깔 함정',   desc:'글자 말고 글자의 색을 고르기! 20초',   better:'high', unit:'점' },
  { id:'timer',  emoji:'⏱️', tag:'감각',   name:'정확히 10초', desc:'시계 없이 10초를 세어 멈추기',         better:'low',  unit:'초 차이' },
  { id:'memory', emoji:'🧠', tag:'기억',   name:'불빛 기억',   desc:'불빛이 켜진 순서를 그대로 따라 누르기', better:'high', unit:'단계' },
  { id:'pairs',  emoji:'🃏', tag:'기억',   name:'짝 맞추기',   desc:'카드 16장에서 같은 그림 8쌍 찾기',     better:'low',  unit:'초' },
  { id:'schulte',emoji:'🔢', tag:'집중',   name:'숫자 순서 찾기', desc:'1부터 25까지 순서대로 빠르게 찾기',  better:'low',  unit:'초' },
  { id:'color',  emoji:'👁️', tag:'집중',   name:'다른 색 찾기', desc:'색이 다른 칸 하나 찾기, 점점 어려워짐', better:'high', unit:'단계' },
  { id:'math',   emoji:'➗', tag:'머리',   name:'암산 폭탄',   desc:'30초 동안 문제 풀기, 갈수록 어려워짐', better:'high', unit:'개' },
  { id:'sum',    emoji:'🧮', tag:'퍼즐',   name:'목표 합 만들기', desc:'숫자를 골라 목표 숫자를 만들기, 30초', better:'high', unit:'번' },
  { id:'slide',  emoji:'🧩', tag:'퍼즐',   name:'조각 맞추기', desc:'3x3 조각을 밀어서 1~8 순서대로',       better:'low',  unit:'초' },
  { id:'maze',   emoji:'🌀', tag:'퍼즐',   name:'미로 탈출',   desc:'손가락으로 밀어서 출구까지!',          better:'low',  unit:'초' }
];
const gameById = id => GAMES.find(g => g.id === id);

/* ---------- 저장 ---------- */
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let players = load(PKEY, [
  { name:'아빠', on:true }, { name:'엄마', on:true }, { name:'누나', on:true }, { name:'동생', on:true }
]);
let picked = load(GKEY, GAMES.map(g => g.id));
let hof = load(HKEY, {});

/* ---------- 공통 ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  window.scrollTo(0, 0);
}
const curScreen = () => (document.querySelector('.screen.on') || {}).id;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = () => players.filter(p => p.on);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* 모든 기기가 같은 문제를 풀도록 쓰는 난수 (방장이 씨앗을 나눠준다) */
let RND = Math.random;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let actx = null;
function beep(freq = 660, dur = .12, type = 'sine') {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + .015);
    g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + .02);
  } catch (e) {}
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
    if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) { wake = null; }
}

function confetti() {
  const box = $('confetti'); box.hidden = false; box.innerHTML = '';
  const cols = ['#ffd166','#4ade80','#60a5fa','#fb7185','#f472b6','#fff'];
  for (let i = 0; i < 40; i++) {
    const d = document.createElement('div');
    d.className = 'conf';
    d.style.left = Math.random() * 100 + '%';
    d.style.background = cols[i % cols.length];
    d.style.animationDuration = (1.1 + Math.random()) + 's';
    d.style.animationDelay = (Math.random() * .35) + 's';
    box.appendChild(d);
  }
  setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, 2600);
}

function fmt(gid, v) {
  if (v === undefined || v === null) return '—';
  if (gid === 'react') return Math.round(v) + 'ms';
  if (gid === 'tap') return v + '회';
  if (gid === 'memory') return v + '단계';
  if (gid === 'timer') return Number(v).toFixed(2) + '초 차이';
  if (gid === 'stroop') return v + '점';
  if (gid === 'schulte' || gid === 'pairs' || gid === 'maze') return Number(v).toFixed(2) + '초';
  if (gid === 'slide') return Number(v) >= 90 ? '미완성' : Number(v).toFixed(2) + '초';
  if (gid === 'mole') return v + '점';
  if (gid === 'balloon') return v + '개';
  if (gid === 'sum') return v + '번';
  if (gid === 'math') return v + '개';
  if (gid === 'color') return v + '단계';
  return String(v);
}

/* 점수 -> 순위/점수 배분 (같은 기록이면 공동 순위) */
function rankList(gid, scoreMap) {
  const g = gameById(gid);
  const list = Object.entries(scoreMap).map(([name, v]) => ({ name, v }));
  list.sort((a, b) => g.better === 'high' ? b.v - a.v : a.v - b.v);
  let rank = 0, prev = null;
  list.forEach((x, i) => {
    if (prev === null || x.v !== prev) rank = i;
    prev = x.v; x.rank = rank; x.pt = POINTS[rank] || 1;
  });
  return list;
}
function drawRank(el, gid, list) {
  el.innerHTML = list.map(x =>
    `<div class="row ${x.rank === 0 ? 'win' : ''}">
       <span class="rk">${['🥇','🥈','🥉'][x.rank] || (x.rank + 1)}</span>
       <span><span class="nm">${esc(x.name)}</span></span>
       <span class="sc">${fmt(gid, x.v)}<span class="pt">+${x.pt}점</span></span>
     </div>`).join('');
}

/* ---------- 모드 ---------- */
let MODE = 'solo';
document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
  MODE = b.dataset.mode;
  document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x === b));
  $('soloBox').hidden = MODE !== 'solo';
  $('netBox').hidden = MODE !== 'net';
  $('startBtn').hidden = MODE === 'net';
  $('homeNote').textContent = '';
});

/* ---------- 홈: 사람 / 게임 ---------- */
function drawPlayers() {
  $('players').innerHTML = players.map((p, i) =>
    `<span class="p ${p.on ? '' : 'off'}" data-i="${i}">${esc(p.name)}<button class="x" data-del="${i}">×</button></span>`
  ).join('');
}
$('players').onclick = e => {
  const del = e.target.closest('[data-del]');
  if (del) { players.splice(+del.dataset.del, 1); save(PKEY, players); drawPlayers(); return; }
  const p = e.target.closest('[data-i]');
  if (p) { const i = +p.dataset.i; players[i].on = !players[i].on; save(PKEY, players); drawPlayers(); }
};
$('addBtn').onclick = () => {
  const v = $('newName').value.trim();
  if (!v) return;
  if (players.length >= 8) { $('homeNote').textContent = '8명까지 넣을 수 있어요'; return; }
  players.push({ name: v.slice(0, 6), on: true });
  save(PKEY, players); drawPlayers(); $('newName').value = '';
};
$('newName').addEventListener('keydown', e => { if (e.key === 'Enter') $('addBtn').onclick(); });

function drawGames() {
  $('games').innerHTML = GAMES.map(g =>
    `<button class="g ${picked.includes(g.id) ? 'on' : ''}" data-g="${g.id}">
       <span class="e">${g.emoji}</span>
       <span><span class="n">${g.name}<i class="tag">${g.tag}</i></span><span class="d">${g.desc}</span></span>
       <span class="mark">✓</span>
     </button>`).join('');
}
$('pickAll').onclick = () => { picked = GAMES.map(g => g.id); save(GKEY, picked); drawGames(); };
$('pickNone').onclick = () => { picked = []; save(GKEY, picked); drawGames(); };
$('pickRand').onclick = () => {
  const pool = GAMES.map(g => g.id);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  picked = pool.slice(0, 4);
  save(GKEY, picked); drawGames();
};

$('games').onclick = e => {
  const b = e.target.closest('[data-g]');
  if (!b) return;
  const id = b.dataset.g;
  picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id];
  save(GKEY, picked); drawGames();
};

/* ================================================================
   한 폰으로 (차례대로)
   ================================================================ */
let T = null;

$('startBtn').onclick = () => {
  const ps = active();
  if (!ps.length) { $('homeNote').textContent = '한 명 이상 골라 주세요'; return; }
  if (!picked.length) { $('homeNote').textContent = '게임을 하나 이상 골라 주세요'; return; }
  $('homeNote').textContent = '';
  RND = Math.random;
  T = {
    order: GAMES.filter(g => picked.includes(g.id)).map(g => g.id),
    gi: 0, pi: 0, names: ps.map(p => p.name), results: {}, points: {}
  };
  T.names.forEach(n => T.points[n] = 0);
  keepAwake(true);
  soloTurn();
};

function soloTurn() {
  const g = gameById(T.order[T.gi]);
  $('turnGame').textContent = g.emoji;
  $('turnName').textContent = T.names[T.pi] + ' 차례';
  $('turnDesc').innerHTML = `<b>${g.name}</b><br>${g.desc}`;
  $('turnLeft').textContent = `게임 ${T.gi + 1}/${T.order.length} · ${T.pi + 1}번째 / ${T.names.length}명`;
  show('turn');
}

async function soloPlay() {
  const g = gameById(T.order[T.gi]);
  const name = T.names[T.pi];
  $('playWho').textContent = name;
  $('playInfo').textContent = g.name;
  show('play');
  let score;
  try { score = await runGame(g.id); }
  catch (e) { score = g.better === 'high' ? 0 : 9999; }
  clearBoard();
  (T.results[g.id] = T.results[g.id] || {})[name] = score;

  const best = recordHof(g, name, score);
  $('scoreEmoji').textContent = g.emoji;
  $('scoreName').textContent = name;
  $('scoreVal').textContent = fmt(g.id, score);
  $('scoreMsg').textContent = best ? '🏆 최고 기록이에요!' : '';
  $('nextBtn').textContent = (T.pi + 1 < T.names.length) ? '다음 사람' : '순위 보기';
  if (best) { confetti(); beep(880, .18); }
  show('score');
}

$('nextBtn').onclick = () => {
  T.pi++;
  if (T.pi < T.names.length) { soloTurn(); return; }
  T.pi = 0;
  const gid = T.order[T.gi], g = gameById(gid);
  const list = rankList(gid, T.results[gid]);
  list.forEach(x => T.points[x.name] += x.pt);
  $('roundTitle').textContent = `${g.emoji} ${g.name} 순위`;
  drawRank($('roundList'), gid, list);
  $('roundNote').textContent = '';
  $('roundNext').hidden = false;
  $('roundNext').textContent = (T.gi + 1 >= T.order.length) ? '최종 결과' : '다음 게임';
  show('round');
};

$('roundNext').onclick = () => {
  if (MODE === 'net') { hostNextRound(); return; }
  T.gi++;
  if (T.gi < T.order.length) { soloTurn(); return; }
  soloFinal();
};

function buildFinal(points, results, order) {
  const list = Object.entries(points).map(([name, pt]) => ({ name, pt })).sort((a, b) => b.pt - a.pt);
  let rank = 0, prev = null;
  list.forEach((x, i) => { if (prev === null || x.pt !== prev) rank = i; prev = x.pt; x.rank = rank; });
  list.forEach(x => {
    x.detail = order.map(gid => {
      const v = (results[gid] || {})[x.name];
      return v === undefined ? '' : `${gameById(gid).emoji} ${fmt(gid, v)}`;
    }).filter(Boolean).join('  ');
  });
  return list;
}
function showFinal(list) {
  keepAwake(false);
  $('winner').textContent = list.filter(x => x.rank === 0).map(x => x.name).join(', ') + ' 우승!';
  $('finalList').innerHTML = list.map(x =>
    `<div class="row ${x.rank === 0 ? 'win' : ''}">
       <span class="rk">${['🥇','🥈','🥉'][x.rank] || (x.rank + 1)}</span>
       <span><span class="nm">${esc(x.name)}</span><span class="sub2">${esc(x.detail || '')}</span></span>
       <span class="sc">${x.pt}점</span>
     </div>`).join('');
  confetti(); beep(660, .15); setTimeout(() => beep(880, .2), 160);
  show('final');
}
function soloFinal() { showFinal(buildFinal(T.points, T.results, T.order)); }

$('goBtn').onclick = () => { if (MODE === 'net') netPlay(); else soloPlay(); };
$('againBtn').onclick = () => {
  if (MODE === 'net') { if (NET.role === 'host') resetNetScores(); show('lobby'); return; }
  $('startBtn').onclick();
};
$('homeBtn').onclick = () => { keepAwake(false); if (MODE === 'net') netLeave(); show('home'); };

function recordHof(g, name, score) {
  const b = hof[g.id];
  const better = !b || (g.better === 'high' ? score > b.v : score < b.v);
  if (better && !(g.better === 'high' && score === 0)) {
    hof[g.id] = { v: score, name, at: Date.now() };
    save(HKEY, hof);
    return true;
  }
  return false;
}

/* ---------- 명예의 전당 ---------- */
$('hofBtn').onclick = () => {
  $('hofList').innerHTML = GAMES.map(g => {
    const b = hof[g.id];
    return `<div class="row">
      <span class="rk">${g.emoji}</span>
      <span><span class="nm">${g.name}</span><span class="sub2">${b ? esc(b.name) : '아직 기록 없음'}</span></span>
      <span class="sc">${b ? fmt(g.id, b.v) : '—'}</span>
    </div>`;
  }).join('');
  show('hof');
};
$('hofClose').onclick = () => show('home');

/* ================================================================
   각자 폰으로 (실시간) — 무전기와 같은 연결 설정
   ================================================================ */
const TURN_USER = 'cc19afd0754ac7955e667884';
const TURN_PASS = 'oBjiNfnbIh8lJO3Q';
const ICE = [
  { urls:'stun:stun.l.google.com:19302' },
  { urls:'stun:stun.relay.metered.ca:80' },
  { urls:'turn:global.relay.metered.ca:80',                 username:TURN_USER, credential:TURN_PASS },
  { urls:'turn:global.relay.metered.ca:80?transport=tcp',   username:TURN_USER, credential:TURN_PASS },
  { urls:'turn:global.relay.metered.ca:443',                username:TURN_USER, credential:TURN_PASS },
  { urls:'turns:global.relay.metered.ca:443?transport=tcp', username:TURN_USER, credential:TURN_PASS }
];

const NET = {
  role:null, code:'', peer:null, conns:[], conn:null,
  me:'', names:[], order:[], gi:0, gid:null, waitDone:[],
  scores:{}, points:{}, results:{}, timer:null
};
const hostIdOf = code => `${NS}-${code}-host`;

function netNote(msg, bad) {
  const el = $('netNote');
  el.textContent = msg;
  el.style.color = bad ? 'var(--no)' : 'var(--dim)';
}
function myNameValue() {
  const v = ($('myName').value || '').trim().slice(0, 6);
  if (v) save(NKEY, v);
  return v;
}
function newPeer(id) {
  return new Peer(id, { debug: 0, pingInterval: 3000, config: { iceServers: ICE } });
}

/* ---- 방장 ---- */
$('makeRoom').onclick = () => {
  const name = myNameValue();
  if (!name) { netNote('이름을 먼저 적어 주세요', true); return; }
  if (!picked.length) { picked = GAMES.map(g => g.id); save(GKEY, picked); drawGames(); }
  netNote('방을 만드는 중…');
  $('makeRoom').disabled = true;
  tryHost(name, 0);
};

function tryHost(name, attempt) {
  if (attempt >= 4) {
    netNote('방을 만들지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.', true);
    $('makeRoom').disabled = false; return;
  }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const p = newPeer(hostIdOf(code));
  let settled = false;
  const t = setTimeout(() => {
    if (settled) return; settled = true;
    try { p.destroy(); } catch (e) {}
    tryHost(name, attempt + 1);
  }, 9000);

  p.on('open', () => {
    if (settled) return; settled = true; clearTimeout(t);
    NET.role = 'host'; NET.peer = p; NET.code = code; NET.me = name;
    NET.names = [name]; NET.conns = []; NET.points = {}; NET.points[name] = 0;
    $('makeRoom').disabled = false; netNote('');
    openLobby();
  });
  p.on('connection', conn => hostOnConn(conn));
  p.on('error', () => {
    if (settled) return; settled = true; clearTimeout(t);
    try { p.destroy(); } catch (e) {}
    tryHost(name, attempt + 1);        // 번호가 겹쳤거나 일시 오류 → 다른 번호로
  });
}

function hostOnConn(conn) {
  NET.conns.push(conn);
  conn.on('open', () => {
    conn.on('data', msg => hostOnData(conn, msg));
    conn.send({ t:'hi' });
  });
  conn.on('close', () => hostDrop(conn));
  conn.on('error', () => hostDrop(conn));
}

function hostDrop(conn) {
  NET.conns = NET.conns.filter(c => c !== conn);
  if (conn.__name) {
    NET.names = NET.names.filter(n => n !== conn.__name);
    broadcast({ t:'roster', names: NET.names });
    if (curScreen() === 'lobby') drawLobby();
    if (curScreen() === 'wait') { drawWaitList(); hostCheckRound(); }
  }
}

function hostOnData(conn, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'hello') {
    let nm = String(msg.name || '손님').slice(0, 6);
    while (NET.names.includes(nm)) nm += '*';
    conn.__name = nm;
    NET.names.push(nm);
    NET.points[nm] = NET.points[nm] || 0;
    conn.send({ t:'welcome', name: nm, code: NET.code });
    broadcast({ t:'roster', names: NET.names });
    drawLobby(); beep(880, .1);
    return;
  }
  if (msg.t === 'done' && conn.__name) {
    if (NET.gid && NET.scores[conn.__name] === undefined) {
      NET.scores[conn.__name] = msg.score;
      broadcast({ t:'waitlist', done: Object.keys(NET.scores) });
      drawWaitList();
      hostCheckRound();
    }
  }
}

function broadcast(msg) {
  NET.conns.forEach(c => { try { if (c.open) c.send(msg); } catch (e) {} });
}

$('lobbyStart').onclick = () => {
  if (NET.role !== 'host') return;
  if (NET.names.length < 2) { $('lobbyNote').textContent = '최소 2명이 들어와야 시작할 수 있어요'; return; }
  if (!picked.length) { $('lobbyNote').textContent = '게임을 하나 이상 골라 주세요'; return; }
  NET.order = GAMES.filter(g => picked.includes(g.id)).map(g => g.id);
  NET.gi = 0; NET.results = {};
  NET.names.forEach(n => NET.points[n] = 0);
  keepAwake(true);
  hostStartRound();
};

function hostStartRound() {
  const gid = NET.order[NET.gi];
  const seed = Math.floor(Math.random() * 1e9);
  NET.gid = gid; NET.scores = {}; NET.waitDone = [];
  broadcast({ t:'start', gid, seed, gi: NET.gi, total: NET.order.length, names: NET.names });
  clearTimeout(NET.timer);
  NET.timer = setTimeout(() => { if (NET.gid) hostFinishRound(true); }, 150000);
  netBeginRound(gid, seed, NET.gi, NET.order.length);
}

function hostCheckRound() {
  if (!NET.gid) return;
  if (Object.keys(NET.scores).length >= NET.names.length) hostFinishRound(false);
}

function hostFinishRound(timedOut) {
  if (!NET.gid) return;
  clearTimeout(NET.timer);
  const gid = NET.gid; NET.gid = null;
  NET.results[gid] = Object.assign({}, NET.scores);
  const list = rankList(gid, NET.scores);
  list.forEach(x => NET.points[x.name] = (NET.points[x.name] || 0) + x.pt);
  const last = NET.gi + 1 >= NET.order.length;
  broadcast({ t:'round', gid, list, last, timedOut: !!timedOut });
  netShowRound(gid, list, last, timedOut, true);
}

function hostNextRound() {
  NET.gi++;
  if (NET.gi < NET.order.length) { hostStartRound(); return; }
  const list = buildFinal(NET.points, NET.results, NET.order);
  broadcast({ t:'final', list });
  showFinal(list);
}

function resetNetScores() {
  NET.gi = 0; NET.results = {}; NET.scores = {}; NET.gid = null;
  NET.names.forEach(n => NET.points[n] = 0);
  drawLobby();
}

/* ---- 참가자 ---- */
$('joinRoom').onclick = () => {
  const name = myNameValue();
  const code = ($('roomCode').value || '').trim();
  if (!name) { netNote('이름을 먼저 적어 주세요', true); return; }
  if (!/^\d{4}$/.test(code)) { netNote('방 번호 4자리를 적어 주세요', true); return; }
  netNote('방을 찾는 중…');
  $('joinRoom').disabled = true;

  const p = newPeer(`${NS}-${code}-g${Math.random().toString(36).slice(2, 8)}`);
  let settled = false;
  const fail = why => {
    if (settled) return; settled = true;
    try { p.destroy(); } catch (e) {}
    $('joinRoom').disabled = false;
    netNote(why, true);
  };
  const t = setTimeout(() => fail('방을 찾지 못했어요. 번호를 확인해 주세요.'), 12000);

  p.on('open', () => {
    const conn = p.connect(hostIdOf(code), { reliable: true });
    conn.on('open', () => {
      if (settled) return; settled = true; clearTimeout(t);
      NET.role = 'guest'; NET.peer = p; NET.conn = conn; NET.code = code; NET.me = name;
      $('joinRoom').disabled = false; netNote('');
      conn.send({ t:'hello', name });
      openLobby();
    });
    conn.on('data', msg => guestOnData(msg));
    conn.on('close', () => guestLost());
    conn.on('error', () => fail('방에 들어가지 못했어요. 번호를 확인해 주세요.'));
  });
  p.on('error', () => fail('연결하지 못했어요. 인터넷을 확인해 주세요.'));
};

function guestLost() {
  if (NET.role !== 'guest') return;
  keepAwake(false);
  netCleanup();
  show('home');
  netNote('방장과 연결이 끊어졌어요. 다시 참가해 주세요.', true);
}

function guestOnData(msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'welcome') { NET.me = msg.name; drawLobby(); return; }
  if (msg.t === 'roster')  { NET.names = msg.names || []; drawLobby(); return; }
  if (msg.t === 'start') {
    NET.names = msg.names || NET.names;
    NET.waitDone = [];
    keepAwake(true);
    netBeginRound(msg.gid, msg.seed, msg.gi, msg.total);
    return;
  }
  if (msg.t === 'waitlist') { NET.waitDone = msg.done || []; if (curScreen() === 'wait') drawWaitList(); return; }
  if (msg.t === 'round') { netShowRound(msg.gid, msg.list, msg.last, msg.timedOut, false); return; }
  if (msg.t === 'final') { showFinal(msg.list); return; }
  if (msg.t === 'bye') { guestLost(); return; }
}

/* ---- 공통 진행 ---- */
function openLobby() {
  $('roomNo').textContent = NET.code;
  $('lobbyStart').hidden = NET.role !== 'host';
  $('lobbyHow').innerHTML = NET.role === 'host'
    ? '다른 식구는 <b>각자 폰으로 → 방 번호 입력 → 참가</b>'
    : '방장이 시작하기를 기다리는 중…';
  $('lobbyNote').textContent = '';
  drawLobby();
  show('lobby');
}

function drawLobby() {
  $('lobbyList').innerHTML = (NET.names || []).map((n, i) =>
    `<div class="row"><span class="rk">${n === NET.me ? '🙋' : '🙂'}</span>
     <span><span class="nm">${esc(n)}</span></span>
     <span class="sc">${i === 0 ? '방장' : ''}</span></div>`).join('')
    || '<div class="note">아직 아무도 없어요</div>';
}

$('lobbyLeave').onclick = () => { netLeave(); show('home'); };

function netLeave() {
  keepAwake(false);
  if (NET.role === 'host') broadcast({ t:'bye' });
  netCleanup();
}
function netCleanup() {
  clearTimeout(NET.timer);
  try { NET.conns.forEach(c => c.close()); } catch (e) {}
  try { NET.conn && NET.conn.close(); } catch (e) {}
  try { NET.peer && NET.peer.destroy(); } catch (e) {}
  NET.role = null; NET.peer = null; NET.conn = null; NET.conns = [];
  NET.names = []; NET.gid = null; NET.scores = {}; NET.points = {}; NET.results = {};
}

function netBeginRound(gid, seed, gi, total) {
  RND = mulberry32(seed);
  NET.gid = gid;
  const g = gameById(gid);
  if (!g) return;
  $('turnGame').textContent = g.emoji;
  $('turnName').textContent = g.name;
  $('turnDesc').innerHTML = `${g.desc}<br><b>준비되면 각자 시작!</b>`;
  $('turnLeft').textContent = `게임 ${gi + 1}/${total} · ${NET.names.length}명 대결`;
  show('turn');
}

async function netPlay() {
  const gid = NET.gid, g = gameById(gid);
  if (!g) return;
  $('playWho').textContent = NET.me;
  $('playInfo').textContent = g.name;
  show('play');
  let score;
  try { score = await runGame(gid); }
  catch (e) { score = g.better === 'high' ? 0 : 9999; }
  clearBoard();

  const best = recordHof(g, NET.me, score);
  $('myResult').innerHTML = `${g.emoji} 내 기록 <b>${fmt(gid, score)}</b>${best ? ' · 🏆 최고 기록!' : ''}`;
  $('waitNote').textContent = '';
  show('wait');

  if (NET.role === 'host') {
    NET.scores[NET.me] = score;
    broadcast({ t:'waitlist', done: Object.keys(NET.scores) });
    drawWaitList();
    hostCheckRound();
  } else {
    drawWaitList();
    try { NET.conn.send({ t:'done', score }); }
    catch (e) { $('waitNote').textContent = '방장에게 기록을 보내지 못했어요'; }
  }
}

function drawWaitList() {
  const done = NET.role === 'host' ? Object.keys(NET.scores) : (NET.waitDone || []);
  $('waitList').innerHTML = (NET.names || []).map(n =>
    `<div class="row"><span class="rk">${done.includes(n) ? '✅' : '⏳'}</span>
     <span><span class="nm">${esc(n)}</span></span>
     <span class="sc">${done.includes(n) ? '완료' : '하는 중'}</span></div>`).join('');
  const el = $('waitNote');
  if (!el.textContent || /명 완료$/.test(el.textContent))
    el.textContent = `${done.length} / ${(NET.names || []).length}명 완료`;
}

function netShowRound(gid, list, last, timedOut, isHost) {
  clearTimeout(NET.timer);
  const g = gameById(gid);
  $('roundTitle').textContent = `${g.emoji} ${g.name} 순위`;
  drawRank($('roundList'), gid, list);
  $('roundNext').hidden = !isHost;
  $('roundNext').textContent = last ? '최종 결과' : '다음 게임';
  $('roundNote').textContent = isHost
    ? (timedOut ? '시간이 오래 걸려 먼저 끝낸 사람들로 매겼어요' : '')
    : '방장이 다음 게임을 시작합니다';
  show('round');
}

/* ================================================================
   게임 구현 (두 모드 공용)
   ================================================================ */
let cleanup = [];
function clearBoard() {
  cleanup.forEach(fn => { try { fn(); } catch (e) {} });
  cleanup = [];
  $('board').innerHTML = '';
}
function timer(fn, ms) { const t = setTimeout(fn, ms); cleanup.push(() => clearTimeout(t)); return t; }
function ticker(fn, ms) { const t = setInterval(fn, ms); cleanup.push(() => clearInterval(t)); return t; }

function runGame(id) {
  clearBoard();
  if (id === 'react') return gameReact();
  if (id === 'tap') return gameTap();
  if (id === 'memory') return gameMemory();
  if (id === 'timer') return gameTimer();
  if (id === 'stroop') return gameStroop();
  if (id === 'schulte') return gameSchulte();
  if (id === 'pairs') return gamePairs();
  if (id === 'math') return gameMath();
  if (id === 'color') return gameColor();
  if (id === 'maze') return gameMaze();
  if (id === 'slide') return gameSlide();
  if (id === 'sum') return gameSum();
  if (id === 'mole') return gameMole();
  if (id === 'balloon') return gameBalloon();
  return Promise.resolve(0);
}

/* 1. 반응 속도 — 5번 평균(ms), 낮을수록 좋음 */
function gameReact() {
  return new Promise(resolve => {
    const pad = document.createElement('button');
    pad.className = 'pad wait';
    $('board').appendChild(pad);
    const times = []; let ready = false, startAt = 0, round = 0;
    const ROUNDS = 5;

    const wait = () => {
      ready = false;
      pad.className = 'pad wait';
      pad.innerHTML = `기다려…<small>${round + 1} / ${ROUNDS}</small>`;
      timer(() => {
        ready = true; startAt = performance.now();
        pad.className = 'pad now'; pad.innerHTML = '지금!';
        beep(880, .08); buzz(25);
      }, 1200 + RND() * 2300);
    };
    pad.onclick = () => {
      if (!ready) {
        pad.className = 'pad bad';
        pad.innerHTML = '너무 빨라요!<small>600ms 로 기록</small>';
        buzz(80); beep(200, .18, 'square');
        times.push(600); round++;
        cleanup.forEach(fn => fn()); cleanup = [];
        if (round >= ROUNDS) return done();
        timer(wait, 900); return;
      }
      const ms = performance.now() - startAt;
      times.push(ms); round++; beep(1040, .07);
      if (round >= ROUNDS) return done();
      pad.className = 'pad wait';
      pad.innerHTML = `${Math.round(ms)}ms<small>${round} / ${ROUNDS} 완료</small>`;
      timer(wait, 800);
    };
    function done() { resolve(Math.round(times.reduce((a, b) => a + b, 0) / times.length)); }
    timer(wait, 600);
  });
}

/* 2. 10초 연타 */
function gameTap() {
  return new Promise(resolve => {
    const pad = document.createElement('button');
    pad.className = 'pad tap';
    pad.innerHTML = '<span id="tapN">0</span><small id="tapT">눌러서 시작</small>';
    $('board').appendChild(pad);
    let n = 0, started = false, left = 10;
    pad.onclick = () => {
      if (!started) {
        started = true; $('tapT').textContent = '10.0초'; beep(880, .08);
        const t0 = performance.now();
        ticker(() => {
          left = Math.max(0, 10 - (performance.now() - t0) / 1000);
          $('tapT').textContent = left.toFixed(1) + '초';
          if (left <= 0) { cleanup.forEach(f => f()); cleanup = []; beep(440, .25); resolve(n); }
        }, 80);
        return;
      }
      if (left <= 0) return;
      n++; $('tapN').textContent = n;
      pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 40);
      if (n % 10 === 0) beep(1200, .03);
    };
  });
}

/* 3. 불빛 기억 */
function gameMemory() {
  return new Promise(resolve => {
    const grid = document.createElement('div');
    grid.className = 'grid4';
    grid.innerHTML = [0,1,2,3].map(i => `<button class="cell c${i}" data-c="${i}"></button>`).join('');
    $('board').appendChild(grid);
    const tone = [392, 523, 659, 784];
    const seq = []; let step = 0, level = 0, lock = true;

    const flash = async i => {
      const el = grid.querySelector(`[data-c="${i}"]`);
      el.classList.add('lit'); beep(tone[i], .22);
      await sleep(360); el.classList.remove('lit'); await sleep(160);
    };
    const nextLevel = async () => {
      lock = true;
      seq.push(Math.floor(RND() * 4));
      $('playInfo').textContent = `불빛 기억 · ${seq.length}단계`;
      await sleep(600);
      for (const i of seq) await flash(i);
      step = 0; lock = false;
    };
    grid.onclick = async e => {
      const b = e.target.closest('[data-c]');
      if (!b || lock) return;
      const i = +b.dataset.c;
      b.classList.add('lit'); beep(tone[i], .16); buzz(15);
      setTimeout(() => b.classList.remove('lit'), 160);
      if (i !== seq[step]) {
        lock = true; beep(160, .35, 'square'); buzz([60, 50, 120]);
        grid.querySelectorAll('.cell').forEach(c => c.classList.add('lit'));
        await sleep(500); resolve(level); return;
      }
      step++;
      if (step === seq.length) { level = seq.length; beep(1040, .12); await nextLevel(); }
    };
    nextLevel();
  });
}

/* 4. 정확히 10초 */
function gameTimer() {
  return new Promise(resolve => {
    const pad = document.createElement('button');
    pad.className = 'pad stop';
    pad.innerHTML = '시작<small>누르고 10초를 세어 보세요</small>';
    $('board').appendChild(pad);
    let t0 = 0, running = false;
    pad.onclick = () => {
      if (!running) {
        running = true; t0 = performance.now();
        pad.innerHTML = '멈춰!<small>10초라고 생각될 때 누르기</small>';
        beep(660, .1); return;
      }
      const sec = (performance.now() - t0) / 1000;
      beep(880, .12);
      resolve(Math.round(Math.abs(10 - sec) * 100) / 100);
    };
  });
}

/* 5. 색깔 함정 */
function gameStroop() {
  return new Promise(resolve => {
    const COLORS = [
      { n:'빨강', c:'#f43f5e' }, { n:'파랑', c:'#38bdf8' }, { n:'초록', c:'#4ade80' },
      { n:'노랑', c:'#facc15' }, { n:'보라', c:'#c084fc' }
    ];
    const box = document.createElement('div');
    box.className = 'stroop';
    box.innerHTML = '<div class="word" id="sw">준비</div><div class="opts" id="so"></div>';
    $('board').appendChild(box);
    let score = 0, answer = null, done = false;
    const t0 = performance.now();
    const pickR = arr => arr[Math.floor(RND() * arr.length)];
    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(RND() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    };
    const round = () => {
      const word = pickR(COLORS);
      let ink = pickR(COLORS);
      while (ink.n === word.n) ink = pickR(COLORS);
      answer = ink.n;
      const opts = shuffle([ink, ...shuffle(COLORS.filter(c => c.n !== ink.n)).slice(0, 3)]);
      $('sw').textContent = word.n; $('sw').style.color = ink.c;
      $('so').innerHTML = opts.map(o => `<button class="ob" data-n="${o.n}" style="background:${o.c}">${o.n}</button>`).join('');
    };
    box.onclick = e => {
      const b = e.target.closest('[data-n]');
      if (!b || done) return;
      if (b.dataset.n === answer) { score++; beep(1040, .06); }
      else { score = Math.max(0, score - 1); beep(200, .14, 'square'); buzz(60); }
      $('playInfo').textContent = `색깔 함정 · ${score}점`;
      round();
    };
    ticker(() => {
      const left = Math.max(0, 20 - (performance.now() - t0) / 1000);
      $('playWho').textContent = `${MODE === 'net' ? NET.me : (T ? T.names[T.pi] : '')} · ${left.toFixed(0)}초`;
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(score); }
    }, 100);
    round();
  });
}

/* ---------- 새 게임 공용 ---------- */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(RND() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function clockLabel(sec) {
  $('playWho').textContent = `${MODE === 'net' ? NET.me : (T ? T.names[T.pi] : '')} · ${sec.toFixed(0)}초`;
}

/* 6. 숫자 순서 찾기 — 1부터 25까지, 걸린 시간(초) */
function gameSchulte() {
  return new Promise(resolve => {
    const N = 25;
    const nums = shuffled(Array.from({ length: N }, (_, i) => i + 1));
    const wrap = document.createElement('div');
    wrap.className = 'grid5';
    wrap.innerHTML = nums.map(n => `<button class="sc-cell" data-n="${n}">${n}</button>`).join('');
    $('board').appendChild(wrap);

    let next = 1, penalty = 0;
    const t0 = performance.now();
    $('playInfo').textContent = '다음: 1';

    wrap.onclick = e => {
      const b = e.target.closest('[data-n]');
      if (!b || b.disabled) return;
      if (+b.dataset.n === next) {
        b.disabled = true; b.classList.add('done');
        beep(640 + next * 14, .05);
        next++;
        $('playInfo').textContent = next > N ? '끝!' : '다음: ' + next;
        if (next > N) {
          beep(1200, .22);
          resolve(Math.round(((performance.now() - t0) / 1000 + penalty) * 100) / 100);
        }
      } else {
        penalty += 0.5;                       // 잘못 누르면 0.5초 벌점
        buzz(60); beep(200, .12, 'square');
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 220);
      }
    };
  });
}

/* 7. 짝 맞추기 — 16장에서 8쌍, 걸린 시간(초) */
function gamePairs() {
  return new Promise(resolve => {
    const FACES = ['🍎','🐶','⚽','🚗','🌙','🍕','🐸','🎈','🦄','🍓','🚀','🐱'];
    const faces = shuffled(FACES).slice(0, 8);
    const deck = shuffled([...faces, ...faces]);
    const wrap = document.createElement('div');
    wrap.className = 'grid4c';
    wrap.innerHTML = deck.map((f, i) =>
      `<button class="card" data-i="${i}" data-f="${f}"><span>?</span></button>`).join('');
    $('board').appendChild(wrap);

    const t0 = performance.now();
    let open = [], found = 0, lock = false;
    $('playInfo').textContent = '0 / 8 쌍';

    wrap.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b || lock || b.classList.contains('up') || b.classList.contains('got')) return;
      b.classList.add('up'); b.firstElementChild.textContent = b.dataset.f;
      beep(620, .05);
      open.push(b);
      if (open.length < 2) return;
      const [x, y] = open;
      if (x.dataset.f === y.dataset.f) {
        x.classList.add('got'); y.classList.add('got');
        open = []; found++;
        beep(1040, .1);
        $('playInfo').textContent = `${found} / 8 쌍`;
        if (found === 8) {
          beep(1200, .22);
          resolve(Math.round((performance.now() - t0) / 10) / 100);
        }
      } else {
        lock = true;
        setTimeout(() => {
          [x, y].forEach(c => { c.classList.remove('up'); c.firstElementChild.textContent = '?'; });
          open = []; lock = false;
        }, 650);
      }
    };
  });
}

/* 8. 암산 폭탄 — 30초 동안 맞힌 개수 */
function gameMath() {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'stroop';
    box.innerHTML = '<div class="q" id="mq">준비</div><div class="opts" id="mo"></div>';
    $('board').appendChild(box);

    let score = 0, answer = 0, done = false;
    const t0 = performance.now();
    const ri = (a, b) => a + Math.floor(RND() * (b - a + 1));

    const make = () => {
      const lv = Math.min(4, Math.floor(score / 4));
      let a, b, op, ans;
      if (lv === 0) { a = ri(2, 9);   b = ri(2, 9);  op = '+'; ans = a + b; }
      else if (lv === 1) { a = ri(10, 30); b = ri(2, 19); op = '+'; ans = a + b; }
      else if (lv === 2) { a = ri(12, 40); b = ri(2, 11); op = '−'; ans = a - b; }
      else if (lv === 3) { a = ri(2, 9);   b = ri(2, 9);  op = '×'; ans = a * b; }
      else { a = ri(3, 12); b = ri(3, 9); op = '×'; ans = a * b; }
      answer = ans;
      const opts = new Set([ans]);
      let guard = 0;
      while (opts.size < 4 && guard++ < 50) {
        const d = ri(1, Math.max(3, Math.round(Math.abs(ans) * .25)));
        const v = RND() < .5 ? ans + d : ans - d;
        if (v >= 0) opts.add(v);
      }
      $('mq').textContent = `${a} ${op} ${b} = ?`;
      $('mo').innerHTML = shuffled([...opts]).map(v =>
        `<button class="ob num" data-v="${v}">${v}</button>`).join('');
    };

    box.onclick = e => {
      const b = e.target.closest('[data-v]');
      if (!b || done) return;
      if (+b.dataset.v === answer) { score++; beep(1040, .06); }
      else { score = Math.max(0, score - 1); beep(200, .14, 'square'); buzz(60); }
      $('playInfo').textContent = `암산 폭탄 · ${score}개`;
      make();
    };
    ticker(() => {
      const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
      clockLabel(left);
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(score); }
    }, 100);
    make();
  });
}

/* 9. 다른 색 찾기 — 30초 동안 올라간 단계 */
function gameColor() {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'cgrid';
    $('board').appendChild(wrap);
    let level = 1, done = false;
    const t0 = performance.now();

    const build = () => {
      const n = Math.min(6, 2 + Math.floor(level / 3));      // 2x2 에서 6x6 까지
      const total = n * n;
      const hue = Math.floor(RND() * 360);
      const diff = Math.max(4, 40 - level * 2.2);            // 갈수록 비슷한 색
      const base = `hsl(${hue} 70% 52%)`;
      const odd = `hsl(${hue} 70% ${Math.min(92, 52 + diff)}%)`;
      const pick = Math.floor(RND() * total);
      wrap.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      wrap.innerHTML = Array.from({ length: total }, (_, i) =>
        `<button class="ctile" data-ok="${i === pick ? 1 : 0}" style="background:${i === pick ? odd : base}"></button>`).join('');
      $('playInfo').textContent = `다른 색 찾기 · ${level}단계`;
    };
    wrap.onclick = e => {
      const b = e.target.closest('[data-ok]');
      if (!b || done) return;
      if (b.dataset.ok === '1') { level++; beep(880 + level * 18, .06); build(); }
      else { beep(200, .14, 'square'); buzz(60); }
    };
    ticker(() => {
      const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
      clockLabel(left);
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(level - 1); }
    }, 100);
    build();
  });
}

/* 10. 미로 탈출 — 출구까지 걸린 시간(초) */
function gameMaze() {
  return new Promise(resolve => {
    const N = 9;
    const idx = (x, y) => y * N + x;
    const cells = Array.from({ length: N * N }, () => ({ n:true, e:true, s:true, w:true, v:false }));
    const stack = [[0, 0]];
    cells[0].v = true;
    while (stack.length) {                                   // 벽 뚫기(DFS) — 반드시 길이 있다
      const [x, y] = stack[stack.length - 1];
      const opts = [];
      if (y > 0     && !cells[idx(x, y - 1)].v) opts.push(['n', x, y - 1]);
      if (x < N - 1 && !cells[idx(x + 1, y)].v) opts.push(['e', x + 1, y]);
      if (y < N - 1 && !cells[idx(x, y + 1)].v) opts.push(['s', x, y + 1]);
      if (x > 0     && !cells[idx(x - 1, y)].v) opts.push(['w', x - 1, y]);
      if (!opts.length) { stack.pop(); continue; }
      const [dir, nx, ny] = opts[Math.floor(RND() * opts.length)];
      cells[idx(x, y)][dir] = false;
      cells[idx(nx, ny)][{ n:'s', s:'n', e:'w', w:'e' }[dir]] = false;
      cells[idx(nx, ny)].v = true;
      stack.push([nx, ny]);
    }

    const wrap = document.createElement('div');
    wrap.className = 'maze';
    wrap.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    wrap.innerHTML = cells.map(c => {
      const st = [c.n ? '' : 'border-top-color:transparent',
                  c.e ? '' : 'border-right-color:transparent',
                  c.s ? '' : 'border-bottom-color:transparent',
                  c.w ? '' : 'border-left-color:transparent'].filter(Boolean).join(';');
      return `<div class="mcell" style="${st}"></div>`;
    }).join('');
    $('board').appendChild(wrap);

    wrap.children[N * N - 1].classList.add('goal');
    wrap.children[N * N - 1].textContent = '🚩';
    const me = document.createElement('div');
    me.className = 'mme'; me.textContent = '🙂';
    wrap.children[0].appendChild(me);

    let px = 0, py = 0, done = false;
    const t0 = performance.now();
    $('playInfo').textContent = '손가락으로 밀기';

    const move = dir => {
      if (done) return;
      const c = cells[idx(px, py)];
      if (dir === 'n' && !c.n) py--;
      else if (dir === 's' && !c.s) py++;
      else if (dir === 'e' && !c.e) px++;
      else if (dir === 'w' && !c.w) px--;
      else { buzz(20); return; }
      wrap.children[idx(px, py)].appendChild(me);
      beep(520, .03);
      if (px === N - 1 && py === N - 1) {
        done = true; beep(1200, .25);
        resolve(Math.round((performance.now() - t0) / 10) / 100);
      }
    };

    let sx = 0, sy = 0;
    const down = e => { const p = e.touches ? e.touches[0] : e; sx = p.clientX; sy = p.clientY; };
    const up = e => {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'));
    };
    wrap.addEventListener('touchstart', down, { passive: true });
    wrap.addEventListener('touchend', up, { passive: true });
    wrap.addEventListener('mousedown', down);
    wrap.addEventListener('mouseup', up);
    const key = e => {
      const m = { ArrowUp:'n', ArrowDown:'s', ArrowLeft:'w', ArrowRight:'e' }[e.key];
      if (m) { e.preventDefault(); move(m); }
    };
    window.addEventListener('keydown', key);
    cleanup.push(() => window.removeEventListener('keydown', key));
    window.__mazeMove = move;            // 자동 점검용
    cleanup.push(() => { delete window.__mazeMove; });
  });
}

/* 11. 조각 맞추기 — 3x3 밀기 퍼즐, 걸린 시간(초). 90초 안에 못 맞추면 벌점 */
function gameSlide() {
  return new Promise(resolve => {
    const N = 3, BLANK = 8, LIMIT = 90;
    let tiles = Array.from({ length: 9 }, (_, i) => i);   // 8 = 빈칸
    let blank = 8;
    const idx = (x, y) => y * N + x;
    const neigh = i => {
      const x = i % N, y = (i / N) | 0, out = [];
      if (y > 0) out.push(idx(x, y - 1));
      if (y < N - 1) out.push(idx(x, y + 1));
      if (x > 0) out.push(idx(x - 1, y));
      if (x < N - 1) out.push(idx(x + 1, y));
      return out;
    };
    for (let k = 0; k < 120; k++) {                        // 합법 이동으로 섞어야 풀 수 있다
      const opts = neigh(blank);
      const pick = opts[Math.floor(RND() * opts.length)];
      tiles[blank] = tiles[pick]; tiles[pick] = BLANK; blank = pick;
    }
    const solved = () => tiles.every((v, i) => v === i);
    if (solved()) { const o = neigh(blank)[0]; tiles[blank] = tiles[o]; tiles[o] = BLANK; blank = o; }

    const wrap = document.createElement('div');
    wrap.className = 'slide';
    $('board').appendChild(wrap);
    const draw = () => {
      wrap.innerHTML = tiles.map((v, i) =>
        v === BLANK ? '<div class="stile blank"></div>'
                    : `<button class="stile ${v === i ? 'ok' : ''}" data-i="${i}">${v + 1}</button>`).join('');
    };
    draw();

    let done = false;
    const t0 = performance.now();
    const finish = v => { if (done) return; done = true; resolve(Math.round(v * 100) / 100); };

    wrap.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b || done) return;
      const i = +b.dataset.i;
      if (!neigh(blank).includes(i)) { buzz(20); return; }
      tiles[blank] = tiles[i]; tiles[i] = BLANK; blank = i;
      beep(560, .04); draw();
      if (solved()) {
        beep(1200, .25);
        finish((performance.now() - t0) / 1000);
      }
    };
    ticker(() => {
      const left = Math.max(0, LIMIT - (performance.now() - t0) / 1000);
      clockLabel(left);
      $('playInfo').textContent = `제자리 ${tiles.filter((v, i) => v === i && v !== BLANK).length} / 8`;
      if (left <= 0 && !done) {
        const wrong = tiles.filter((v, i) => v !== i && v !== BLANK).length;
        beep(440, .25);
        finish(LIMIT + wrong * 5);                        // 못 맞추면 틀린 칸만큼 벌점
      }
    }, 200);
  });
}

/* 12. 목표 합 만들기 — 30초 동안 성공 횟수 */
function gameSum() {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'sumbox';
    box.innerHTML = '<div class="sum-t">목표 <b id="goal">0</b></div>' +
                    '<div class="sum-now">지금 <b id="now">0</b></div>' +
                    '<div class="sgrid" id="sg"></div>';
    $('board').appendChild(box);

    let score = 0, goal = 0, sum = 0, done = false;
    const t0 = performance.now();
    const ri = (a, b) => a + Math.floor(RND() * (b - a + 1));

    const build = () => {
      sum = 0;
      const nums = Array.from({ length: 9 }, () => ri(1, 9));
      // 반드시 만들 수 있는 목표로 (아무 숫자 2~3개의 합)
      const picks = shuffled([0,1,2,3,4,5,6,7,8]).slice(0, ri(2, 3));
      goal = picks.reduce((a, i) => a + nums[i], 0);
      $('goal').textContent = goal;
      $('now').textContent = '0';
      $('sg').innerHTML = nums.map((n, i) => `<button class="snum" data-i="${i}" data-v="${n}">${n}</button>`).join('');
    };
    box.onclick = e => {
      const b = e.target.closest('[data-v]');
      if (!b || done || b.classList.contains('used')) return;
      b.classList.add('used');
      sum += +b.dataset.v;
      $('now').textContent = sum;
      if (sum === goal) {
        score++; beep(1040, .12);
        $('playInfo').textContent = `목표 합 · ${score}번 성공`;
        build();
      } else if (sum > goal) {
        beep(200, .16, 'square'); buzz(60);
        sum = 0; $('now').textContent = '0';
        [...$('sg').children].forEach(c => c.classList.remove('used'));
      } else {
        beep(760, .05);
      }
    };
    ticker(() => {
      const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
      clockLabel(left);
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(score); }
    }, 100);
    build();
  });
}

/* 13. 두더지 잡기 — 30초 동안 점수 (폭탄은 감점) */
function gameMole() {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'holes';
    wrap.innerHTML = Array.from({ length: 9 }, (_, i) =>
      `<button class="hole" data-i="${i}"><span></span></button>`).join('');
    $('board').appendChild(wrap);

    let score = 0, done = false;
    const t0 = performance.now();
    const cells = [...wrap.children];
    const live = new Map();                               // 칸 -> 'mole' | 'bomb'

    const popOne = () => {
      if (done) return;
      const free = cells.map((c, i) => i).filter(i => !live.has(i));
      if (!free.length) return;
      const i = free[Math.floor(RND() * free.length)];
      const kind = RND() < .22 ? 'bomb' : 'mole';
      const el = cells[i];
      el.classList.add('up', kind);
      el.firstElementChild.textContent = kind === 'bomb' ? '💣' : '🐹';
      live.set(i, kind);
      const span = 600 + RND() * 700;
      const tm = setTimeout(() => {
        el.classList.remove('up', 'mole', 'bomb');
        el.firstElementChild.textContent = '';
        live.delete(i);
      }, span);
      cleanup.push(() => clearTimeout(tm));
    };

    wrap.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b || done) return;
      const i = +b.dataset.i;
      const kind = live.get(i);
      if (!kind) { buzz(15); return; }
      if (kind === 'mole') { score++; beep(1040, .06); }
      else { score = Math.max(0, score - 2); beep(180, .2, 'square'); buzz(90); }
      b.classList.add('hit');
      setTimeout(() => b.classList.remove('hit'), 120);
      b.classList.remove('up', 'mole', 'bomb');
      b.firstElementChild.textContent = '';
      live.delete(i);
      $('playInfo').textContent = `두더지 · ${score}점`;
    };

    ticker(popOne, 520);
    ticker(() => {
      const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
      clockLabel(left);
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(score); }
    }, 100);
    popOne();
  });
}

/* 14. 풍선 터뜨리기 — 30초 동안 터뜨린 개수 */
function gameBalloon() {
  return new Promise(resolve => {
    const arena = document.createElement('div');
    arena.className = 'arena';
    $('board').appendChild(arena);

    const COLORS = ['#f43f5e','#38bdf8','#4ade80','#facc15','#c084fc','#fb923c'];
    let score = 0, done = false;
    const t0 = performance.now();

    const spawn = () => {
      if (done) return;
      const b = document.createElement('button');
      b.className = 'balloon';
      b.textContent = '🎈';
      b.style.left = (6 + RND() * 76) + '%';
      b.style.color = COLORS[Math.floor(RND() * COLORS.length)];
      const dur = 2.6 + RND() * 1.8;
      b.style.animationDuration = dur + 's';
      b.style.fontSize = (34 + RND() * 18) + 'px';
      arena.appendChild(b);
      b.addEventListener('animationend', () => b.remove());
      b.onclick = () => {
        if (done || b.classList.contains('pop')) return;
        score++; beep(900 + RND() * 300, .05); buzz(12);
        b.classList.add('pop');
        b.textContent = '💥';
        setTimeout(() => b.remove(), 160);
        $('playInfo').textContent = `풍선 · ${score}개`;
      };
    };

    ticker(spawn, 480);
    ticker(() => {
      const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
      clockLabel(left);
      if (left <= 0 && !done) {
        done = true; beep(440, .25);
        arena.innerHTML = '';
        resolve(score);
      }
    }, 100);
    spawn();
  });
}

/* ---------- 시작 ---------- */
drawPlayers(); drawGames();
$('myName').value = load(NKEY, '');
$('ver').textContent = 'v ' + BUILD;
document.addEventListener('visibilitychange', () => { if (document.hidden) keepAwake(false); });
window.addEventListener('beforeunload', () => { try { netLeave(); } catch (e) {} });

if ('serviceWorker' in navigator) {
  let reloaded = false;
  const wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloaded || NET.role) return;   // 대결 중에는 새로고침하지 않는다
    reloaded = true; location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update().catch(() => {});
      setInterval(() => { if (!NET.role) reg.update().catch(() => {}); }, 30 * 60 * 1000);
    }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !NET.role) navigator.serviceWorker.getRegistration()
      .then(r => r && r.update().catch(() => {})).catch(() => {});
  });
}
})();
