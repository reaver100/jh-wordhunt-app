/* 가족 미니게임 — 한 폰을 넘겨가며 겨루는 가족 대결 */
(() => {
'use strict';

const BUILD = '2026-11-24 11:05';
const $ = id => document.getElementById(id);
const PKEY = 'fg.players.v1';
const GKEY = 'fg.games.v1';
const HKEY = 'fg.hof.v1';
const POINTS = [10, 7, 5, 3, 2, 1];

/* ---------- 게임 정의 ---------- */
const GAMES = [
  { id:'react',  emoji:'⚡', name:'반응 속도',   desc:'초록으로 바뀌면 바로 탭! 5번 평균',        better:'low',  unit:'ms' },
  { id:'tap',    emoji:'👆', name:'10초 연타',   desc:'10초 동안 최대한 많이 두드리기',           better:'high', unit:'회' },
  { id:'memory', emoji:'🧠', name:'불빛 기억',   desc:'불빛이 켜진 순서를 그대로 따라 누르기',     better:'high', unit:'단계' },
  { id:'timer',  emoji:'⏱️', name:'정확히 10초', desc:'시계 없이 10초를 세어 멈추기',             better:'low',  unit:'초 차이' },
  { id:'stroop', emoji:'🎨', name:'색깔 함정',   desc:'글자 말고 글자의 색을 고르기! 20초',       better:'high', unit:'점' }
];
const gameById = id => GAMES.find(g => g.id === id);

/* ---------- 저장 ---------- */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let players = load(PKEY, [
  { name: '아빠', on: true }, { name: '엄마', on: true },
  { name: '누나', on: true }, { name: '동생', on: true }
]);
let picked = load(GKEY, GAMES.map(g => g.id));
let hof = load(HKEY, {});

/* ---------- 공통 ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  window.scrollTo(0, 0);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = () => players.filter(p => p.on);

let actx = null;
function beep(freq = 660, dur = 0.12, type = 'sine') {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
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

/* 점수를 사람이 읽는 형태로 */
function fmt(gid, v) {
  if (gid === 'react') return Math.round(v) + 'ms';
  if (gid === 'tap') return v + '회';
  if (gid === 'memory') return v + '단계';
  if (gid === 'timer') return v.toFixed(2) + '초 차이';
  if (gid === 'stroop') return v + '점';
  return String(v);
}

/* ---------- 홈 화면 ---------- */
function drawPlayers() {
  $('players').innerHTML = players.map((p, i) =>
    `<span class="p ${p.on ? '' : 'off'}" data-i="${i}">${p.name}<button class="x" data-del="${i}">×</button></span>`
  ).join('');
}
$('players').onclick = e => {
  const del = e.target.closest('[data-del]');
  if (del) { players.splice(+del.dataset.del, 1); save(PKEY, players); drawPlayers(); return; }
  const p = e.target.closest('[data-i]');
  if (p) {
    const i = +p.dataset.i;
    players[i].on = !players[i].on;
    save(PKEY, players); drawPlayers();
  }
};
$('addBtn').onclick = () => {
  const v = $('newName').value.trim();
  if (!v) return;
  if (players.length >= 8) { $('homeNote').textContent = '8명까지 넣을 수 있어요'; return; }
  players.push({ name: v.slice(0, 6), on: true });
  save(PKEY, players); drawPlayers();
  $('newName').value = '';
};
$('newName').addEventListener('keydown', e => { if (e.key === 'Enter') $('addBtn').onclick(); });

function drawGames() {
  $('games').innerHTML = GAMES.map(g =>
    `<button class="g ${picked.includes(g.id) ? 'on' : ''}" data-g="${g.id}">
       <span class="e">${g.emoji}</span>
       <span><span class="n">${g.name}</span><span class="d">${g.desc}</span></span>
       <span class="mark">✓</span>
     </button>`
  ).join('');
}
$('games').onclick = e => {
  const b = e.target.closest('[data-g]');
  if (!b) return;
  const id = b.dataset.g;
  picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id];
  save(GKEY, picked); drawGames();
};

/* ---------- 대결 진행 ---------- */
let T = null;   // 현재 대회 상태

$('startBtn').onclick = () => {
  const ps = active();
  if (ps.length < 1) { $('homeNote').textContent = '한 명 이상 골라 주세요'; return; }
  if (!picked.length) { $('homeNote').textContent = '게임을 하나 이상 골라 주세요'; return; }
  $('homeNote').textContent = '';
  const order = GAMES.filter(g => picked.includes(g.id)).map(g => g.id);
  T = { order, gi: 0, pi: 0, names: ps.map(p => p.name), results: {}, points: {} };
  T.names.forEach(n => T.points[n] = 0);
  keepAwake(true);
  nextTurn();
};

function nextTurn() {
  const g = gameById(T.order[T.gi]);
  const name = T.names[T.pi];
  $('turnGame').textContent = g.emoji;
  $('turnName').textContent = name + ' 차례';
  $('turnDesc').innerHTML = `<b>${g.name}</b><br>${g.desc}`;
  $('turnLeft').textContent =
    `게임 ${T.gi + 1}/${T.order.length} · ${T.pi + 1}번째 사람 / ${T.names.length}명`;
  show('turn');
}

$('goBtn').onclick = async () => {
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

  // 명예의 전당
  const best = hof[g.id];
  const isBest = !best || (g.better === 'high' ? score > best.v : score < best.v);
  if (isBest && !(g.better === 'high' && score === 0)) {
    hof[g.id] = { v: score, name, at: Date.now() };
    save(HKEY, hof);
  }

  $('scoreEmoji').textContent = g.emoji;
  $('scoreName').textContent = name;
  $('scoreVal').textContent = fmt(g.id, score);
  $('scoreMsg').textContent = isBest ? '🏆 최고 기록이에요!' : '';
  $('nextBtn').textContent = (T.pi + 1 < T.names.length) ? '다음 사람' : '순위 보기';
  if (isBest) { confetti(); beep(880, .18); }
  show('score');
};

$('nextBtn').onclick = () => {
  T.pi++;
  if (T.pi < T.names.length) { nextTurn(); return; }
  T.pi = 0;
  showRound();
};

function rankOf(gid) {
  const g = gameById(gid), res = T.results[gid] || {};
  const list = Object.entries(res).map(([name, v]) => ({ name, v }));
  list.sort((a, b) => g.better === 'high' ? b.v - a.v : a.v - b.v);
  let rank = 0, prev = null;
  list.forEach((x, i) => {
    if (prev === null || x.v !== prev) rank = i;
    prev = x.v;
    x.rank = rank;
    x.pt = POINTS[rank] || 1;
  });
  return list;
}

function showRound() {
  const gid = T.order[T.gi], g = gameById(gid);
  const list = rankOf(gid);
  list.forEach(x => T.points[x.name] += x.pt);

  $('roundTitle').textContent = `${g.emoji} ${g.name} 순위`;
  $('roundList').innerHTML = list.map(x =>
    `<div class="row ${x.rank === 0 ? 'win' : ''}">
       <span class="rk">${['🥇','🥈','🥉'][x.rank] || (x.rank + 1)}</span>
       <span><span class="nm">${x.name}</span></span>
       <span class="sc">${fmt(gid, x.v)}<span class="pt">+${x.pt}점</span></span>
     </div>`).join('');
  const last = T.gi + 1 >= T.order.length;
  $('roundNext').textContent = last ? '최종 결과' : '다음 게임';
  show('round');
}

$('roundNext').onclick = () => {
  T.gi++;
  if (T.gi < T.order.length) { nextTurn(); return; }
  showFinal();
};

function showFinal() {
  keepAwake(false);
  const list = Object.entries(T.points).map(([name, pt]) => ({ name, pt }))
    .sort((a, b) => b.pt - a.pt);
  let rank = 0, prev = null;
  list.forEach((x, i) => { if (prev === null || x.pt !== prev) rank = i; prev = x.pt; x.rank = rank; });

  $('winner').textContent = list.filter(x => x.rank === 0).map(x => x.name).join(', ') + ' 우승!';
  $('finalList').innerHTML = list.map(x => {
    const detail = T.order.map(gid => {
      const v = (T.results[gid] || {})[x.name];
      return v === undefined ? '' : `${gameById(gid).emoji} ${fmt(gid, v)}`;
    }).filter(Boolean).join('  ');
    return `<div class="row ${x.rank === 0 ? 'win' : ''}">
      <span class="rk">${['🥇','🥈','🥉'][x.rank] || (x.rank + 1)}</span>
      <span><span class="nm">${x.name}</span><span class="sub2">${detail}</span></span>
      <span class="sc">${x.pt}점</span>
    </div>`;
  }).join('');
  confetti(); beep(660, .15); setTimeout(() => beep(880, .2), 160);
  show('final');
}

$('againBtn').onclick = () => { $('startBtn').onclick(); };
$('homeBtn').onclick = () => { keepAwake(false); show('home'); };

/* ---------- 명예의 전당 ---------- */
$('hofBtn').onclick = () => {
  const rows = GAMES.map(g => {
    const b = hof[g.id];
    return `<div class="row">
      <span class="rk">${g.emoji}</span>
      <span><span class="nm">${g.name}</span><span class="sub2">${b ? b.name : '아직 기록 없음'}</span></span>
      <span class="sc">${b ? fmt(g.id, b.v) : '—'}</span>
    </div>`;
  }).join('');
  $('hofList').innerHTML = rows;
  show('hof');
};
$('hofClose').onclick = () => show('home');

/* ---------- 게임 구현 ---------- */
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
  return Promise.resolve(0);
}

/* 1. 반응 속도 — 5번 평균(ms), 낮을수록 좋음 */
function gameReact() {
  return new Promise(resolve => {
    const pad = document.createElement('button');
    pad.className = 'pad wait';
    $('board').appendChild(pad);

    const times = [];
    let ready = false, startAt = 0, round = 0;
    const ROUNDS = 5;

    const wait = () => {
      ready = false;
      pad.className = 'pad wait';
      pad.innerHTML = `기다려…<small>${round + 1} / ${ROUNDS}</small>`;
      timer(() => {
        ready = true; startAt = performance.now();
        pad.className = 'pad now';
        pad.innerHTML = '지금!';
        beep(880, .08); buzz(25);
      }, 1200 + Math.random() * 2300);
    };

    pad.onclick = () => {
      if (!ready) {                       // 미리 누름 → 벌점
        pad.className = 'pad bad';
        pad.innerHTML = `너무 빨라요!<small>600ms 로 기록</small>`;
        buzz(80); beep(200, .18, 'square');
        times.push(600); round++;
        cleanup.forEach(fn => fn()); cleanup = [];
        if (round >= ROUNDS) return done();
        timer(wait, 900);
        return;
      }
      const ms = performance.now() - startAt;
      times.push(ms); round++;
      beep(1040, .07);
      if (round >= ROUNDS) return done();
      pad.className = 'pad wait';
      pad.innerHTML = `${Math.round(ms)}ms<small>${round} / ${ROUNDS} 완료</small>`;
      timer(wait, 800);
    };

    function done() {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      resolve(Math.round(avg));          // 보이는 값 그대로 기록해야 같은 기록이 공동 순위가 된다
    }
    timer(wait, 600);
  });
}

/* 2. 10초 연타 — 횟수, 높을수록 좋음 */
function gameTap() {
  return new Promise(resolve => {
    const pad = document.createElement('button');
    pad.className = 'pad tap';
    pad.innerHTML = '<span id="tapN">0</span><small id="tapT">준비…</small>';
    $('board').appendChild(pad);

    let n = 0, started = false, left = 10;
    const nEl = () => $('tapN'), tEl = () => $('tapT');

    pad.onclick = () => {
      if (!started) {
        started = true;
        tEl().textContent = '10.0초';
        beep(880, .08);
        const t0 = performance.now();
        ticker(() => {
          left = Math.max(0, 10 - (performance.now() - t0) / 1000);
          tEl().textContent = left.toFixed(1) + '초';
          if (left <= 0) { cleanup.forEach(f => f()); cleanup = []; beep(440, .25); resolve(n); }
        }, 80);
        return;
      }
      if (left <= 0) return;
      n++; nEl().textContent = n;
      pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 40);
      if (n % 10 === 0) beep(1200, .03);
    };
  });
}

/* 3. 불빛 기억 — 단계, 높을수록 좋음 */
function gameMemory() {
  return new Promise(resolve => {
    const grid = document.createElement('div');
    grid.className = 'grid4';
    grid.innerHTML = [0,1,2,3].map(i => `<button class="cell c${i}" data-c="${i}"></button>`).join('');
    $('board').appendChild(grid);

    const tone = [392, 523, 659, 784];
    const seq = [];
    let step = 0, level = 0, lock = true;

    const flash = async i => {
      const el = grid.querySelector(`[data-c="${i}"]`);
      el.classList.add('lit'); beep(tone[i], .22);
      await sleep(360);
      el.classList.remove('lit');
      await sleep(160);
    };

    const nextLevel = async () => {
      lock = true;
      seq.push(Math.floor(Math.random() * 4));
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

      if (i !== seq[step]) {                 // 틀림 → 끝
        lock = true;
        beep(160, .35, 'square'); buzz([60, 50, 120]);
        grid.querySelectorAll('.cell').forEach(c => c.classList.add('lit'));
        await sleep(500);
        resolve(level);
        return;
      }
      step++;
      if (step === seq.length) {             // 한 단계 통과
        level = seq.length;
        beep(1040, .12);
        await nextLevel();
      }
    };
    nextLevel();
  });
}

/* 4. 정확히 10초 — 오차(초), 낮을수록 좋음 */
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
        beep(660, .1);
        return;
      }
      const sec = (performance.now() - t0) / 1000;
      beep(880, .12);
      resolve(Math.round(Math.abs(10 - sec) * 100) / 100);
    };
  });
}

/* 5. 색깔 함정 — 20초 동안 점수, 높을수록 좋음 */
function gameStroop() {
  return new Promise(resolve => {
    const COLORS = [
      { n: '빨강', c: '#f43f5e' }, { n: '파랑', c: '#38bdf8' },
      { n: '초록', c: '#4ade80' }, { n: '노랑', c: '#facc15' },
      { n: '보라', c: '#c084fc' }
    ];
    const box = document.createElement('div');
    box.className = 'stroop';
    box.innerHTML = '<div class="word" id="sw">준비</div><div class="opts" id="so"></div>';
    $('board').appendChild(box);

    let score = 0, answer = null, done = false;
    const t0 = performance.now();

    const round = () => {
      const word = COLORS[Math.floor(Math.random() * COLORS.length)];
      let ink = COLORS[Math.floor(Math.random() * COLORS.length)];
      while (ink.n === word.n) ink = COLORS[Math.floor(Math.random() * COLORS.length)];
      answer = ink.n;
      const opts = [ink, ...COLORS.filter(c => c.n !== ink.n).sort(() => Math.random() - .5).slice(0, 3)]
        .sort(() => Math.random() - .5);
      $('sw').textContent = word.n;
      $('sw').style.color = ink.c;
      $('so').innerHTML = opts.map(o =>
        `<button class="ob" data-n="${o.n}" style="background:${o.c}">${o.n}</button>`).join('');
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
      $('playWho').textContent = `${T.names[T.pi]} · ${left.toFixed(0)}초`;
      if (left <= 0 && !done) { done = true; beep(440, .25); resolve(score); }
    }, 100);

    round();
  });
}

/* ---------- 시작 ---------- */
drawPlayers(); drawGames();
$('ver').textContent = 'v ' + BUILD;
document.addEventListener('visibilitychange', () => { if (document.hidden) keepAwake(false); });

/* 자동 업데이트: 새 버전이 올라오면 다음에 열 때 반영 */
if ('serviceWorker' in navigator) {
  let reloaded = false;
  const wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloaded) return;
    reloaded = true; location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) navigator.serviceWorker.getRegistration()
      .then(r => r && r.update().catch(() => {})).catch(() => {});
  });
}
})();
