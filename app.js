/* 영어 단어 사냥 — 카메라로 사물을 찍어 영어 단어를 모으는 앱 */
(() => {
'use strict';

const $ = id => document.getElementById(id);
const KEY = 'wordhunt.v1';
const MKEY = 'wordhunt.mission.v1';
const MIN_PROB = 0.12;

/* ---------- 저장 ---------- */
let words = [];
try { words = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { words = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(words)); } catch (e) { toast('저장 공간이 꽉 찼어요. 도감에서 조금 지워 주세요.'); } };
const has = en => words.some(w => w.en === en);

/* ---------- 오늘의 목표 ---------- */
const TARGETS = [
  ['cup','컵'],['mug','머그컵'],['clock','시계'],['lamp','전등'],['chair','의자'],
  ['table','탁자'],['sofa','소파'],['pillow','베개'],['towel','수건'],['backpack','책가방'],
  ['sneakers','운동화'],['sock','양말'],['water bottle','물병'],['bowl','그릇'],['plate','접시'],
  ['refrigerator','냉장고'],['television','텔레비전'],['remote control','리모컨'],
  ['laptop','노트북 컴퓨터'],['keyboard','키보드'],['mouse','마우스'],['cell phone','휴대폰'],
  ['pen','볼펜'],['eraser','지우개'],['basket','바구니'],['broom','빗자루'],['umbrella','우산'],
  ['teddy bear','곰인형'],['ball','공'],['banana','바나나'],['apple','사과'],['orange','오렌지'],
  ['candle','양초'],['fan','선풍기'],['microwave','전자레인지'],['toaster','토스터'],
  ['bed','침대'],['desk','책상'],['bookcase','책장'],['dog','개'],['cat','고양이'],
  ['flower pot','화분'],['wooden spoon','나무 숟가락'],['soccer ball','축구공'],
  ['watch','손목시계'],['tablet','태블릿'],['guitar','기타'],['piano','피아노'],
  ['puzzle','퍼즐'],['shoes','신발'],['pizza','피자'],['vacuum','청소기']
];
const today = () => new Date().toISOString().slice(0, 10);
let mission = { date: '', list: [] };
try { mission = JSON.parse(localStorage.getItem(MKEY) || 'null') || mission; } catch (e) {}
if (mission.date !== today()) {
  let seed = 0; for (const c of today()) seed = (seed * 31 + c.charCodeAt(0)) % 99991;
  const pool = TARGETS.slice();
  const list = [];
  for (let i = 0; i < 5 && pool.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483647;
    const [en, ko] = pool.splice(seed % pool.length, 1)[0];
    list.push({ en, ko, done: false });
  }
  mission = { date: today(), list };
  localStorage.setItem(MKEY, JSON.stringify(mission));
}
const saveMission = () => localStorage.setItem(MKEY, JSON.stringify(mission));

function drawMission() {
  $('missionList').innerHTML = mission.list.map(m =>
    `<span class="chip ${m.done ? 'done' : ''}"><b>${m.en}</b><i>${m.ko}</i></span>`).join('');
}

/* ---------- 점수 / 배지 ---------- */
const LEVELS = [[100,'👑'],[60,'🥇'],[30,'🥈'],[10,'🥉'],[0,'🌱']];
function drawScore() {
  $('count').textContent = words.length;
  $('badge').textContent = (LEVELS.find(l => words.length >= l[0]) || LEVELS[4])[1];
  const next = [10, 30, 60, 100, 200].find(n => n > words.length) || 200;
  $('progFill').style.width = Math.min(100, words.length / next * 100) + '%';
  $('progTxt').textContent = words.length >= 200
    ? `${words.length}개 — 단어 사냥 왕! 👑`
    : `${words.length}개 모았어요 · 다음 배지까지 ${next - words.length}개`;
}

/* ---------- 소리 ---------- */
let soundOn = localStorage.getItem('wordhunt.sound') !== 'off';
function drawSound() { $('soundBtn').classList.toggle('off', !soundOn); }
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices() || [];
  voice = vs.find(v => /en[-_]US/i.test(v.lang) && /female|samantha|google/i.test(v.name))
       || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.82; u.pitch = 1.05;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch (e) {}
}
let actx = null;
function ding(ok = true) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880, 1320] : [330, 262];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, actx.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.22, actx.currentTime + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.09 + 0.26);
      o.connect(g); g.connect(actx.destination);
      o.start(actx.currentTime + i * 0.09); o.stop(actx.currentTime + i * 0.09 + 0.3);
    });
  } catch (e) {}
}

/* ---------- 토스트 / 축하 ---------- */
let tT = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(tT); tT = setTimeout(() => { t.hidden = true; }, 2200);
}
function confetti() {
  const box = $('confetti'); box.hidden = false; box.innerHTML = '';
  const cols = ['#ffd166','#4ade80','#60a5fa','#fb7185','#f472b6','#fff'];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement('div');
    d.className = 'conf';
    d.style.left = Math.random() * 100 + '%';
    d.style.background = cols[i % cols.length];
    d.style.animationDuration = (1.1 + Math.random() * 0.9) + 's';
    d.style.animationDelay = (Math.random() * 0.3) + 's';
    box.appendChild(d);
  }
  setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, 2400);
}

/* ---------- 탭 ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === b.dataset.view));
  if (b.dataset.view === 'book') drawGrid();
  if (b.dataset.view === 'quiz') newQuiz();
});

/* ---------- 카메라 ---------- */
const cam = $('cam');
let stream = null, facing = 'environment', model = null, busy = false;
let coco = null, cocoOff = false;

async function openCam() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
    audio: false
  });
  cam.srcObject = stream;
  await cam.play().catch(() => {});
}

async function loadModel() {
  if (model && (coco || cocoOff)) return model;
  $('loading').hidden = false;
  const warm = document.createElement('canvas'); warm.width = warm.height = 224;
  try {
    // 1) 물체를 찾아내는 모델 (컵·병·마우스 등 80가지 위치 인식)
    if (!coco && !cocoOff) {
      $('loadingText').textContent = 'AI 준비 중… (1/2) 물체 찾기';
      try {
        coco = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        await coco.detect(warm);
      } catch (e) { cocoOff = true; }
    }
    // 2) 그 물체가 무엇인지 자세히 보는 모델
    if (!model) {
      $('loadingText').textContent = 'AI 준비 중… (2/2) 이름 알아보기';
      model = await mobilenet.load({ version: 2, alpha: 1.0 });
      await model.classify(warm);
    }
  } finally { $('loading').hidden = true; }
  return model;
}

function note(msg, bad) {
  const n = $('coverNote');
  n.textContent = msg || '';
  n.style.color = bad ? 'var(--no)' : 'var(--dim)';
}
const timeout = (p, ms, msg) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))
]);

// 어떤 오류도 조용히 묻히지 않게
window.addEventListener('error', e => note('오류: ' + (e.message || e.type), true));
window.addEventListener('unhandledrejection', e =>
  note('오류: ' + ((e.reason && (e.reason.message || e.reason.name)) || e.reason), true));

$('startBtn').onclick = async () => {
  try {
    $('startBtn').disabled = true;
    note('카메라 여는 중…');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      note('이 브라우저에서는 카메라를 쓸 수 없어요. 크롬이나 사파리에서 열어 주세요.', true);
      return;
    }
    await timeout(openCam(), 20000, '카메라가 응답하지 않아요. 앱을 껐다 다시 켜 보세요.');
    $('cover').hidden = true;
    note('');
    toast('AI 준비 중… 처음 한 번은 10~20초 걸려요');
    try {
      await timeout(loadModel(), 90000, 'AI 내려받기가 너무 오래 걸려요');
      toast('준비 끝! 물건을 찍어 보세요 📸');
    } catch (me) {
      $('loading').hidden = true;
      toast('AI를 못 받았어요. 인터넷을 확인하고 셔터를 다시 눌러 주세요.');
    }
  } catch (e) {
    const msg = String((e && (e.name || e.message)) || e);
    $('loading').hidden = true;
    $('cover').hidden = false;
    note(/NotAllowed|Permission/i.test(msg)
      ? '카메라 권한이 막혀 있어요. 주소창 왼쪽 자물쇠(또는 ⓘ) → 권한 → 카메라 허용 후 다시 눌러 주세요.'
      : /NotFound|Overconstrained/i.test(msg) ? '카메라를 찾을 수 없어요.'
      : /NotReadable|TrackStart/i.test(msg) ? '다른 앱이 카메라를 쓰고 있어요. 그 앱을 끄고 다시 눌러 주세요.'
      : '카메라를 열지 못했어요: ' + msg, true);
  } finally { $('startBtn').disabled = false; }
};

$('flipBtn').onclick = async () => {
  facing = facing === 'environment' ? 'user' : 'environment';
  try { await openCam(); } catch (e) { toast('카메라를 바꿀 수 없어요'); }
};
$('soundBtn').onclick = () => {
  soundOn = !soundOn;
  localStorage.setItem('wordhunt.sound', soundOn ? 'on' : 'off');
  drawSound(); if (soundOn) ding(true);
};

/* ---------- 찍기 ---------- */
let pending = null;

/* 화면의 점선 네모가 영상의 어느 부분인지 계산해서 딱 그만큼만 잘라낸다.
   (object-fit:cover 로 보여주므로 확대 비율을 되돌려야 한다) */
function frameSideInVideo() {
  const vw = cam.videoWidth, vh = cam.videoHeight;
  const st = $('stage').getBoundingClientRect();
  const fr = $('frame').getBoundingClientRect();
  const scale = Math.max(st.width / vw, st.height / vh) || 1;
  return Math.min(Math.min(vw, vh), fr.width / scale);
}

// zoom: 1 = 점선 네모 그대로, 0.7 = 더 바싹, 1.6 = 더 넓게
function grab(size, zoom = 1, canvas) {
  const vw = cam.videoWidth, vh = cam.videoHeight;
  if (!vw || !vh) return null;
  const s = Math.max(48, Math.min(Math.min(vw, vh), frameSideInVideo() * zoom));
  const sx = (vw - s) / 2, sy = (vh - s) / 2;
  const c = canvas || $('shot');
  c.width = c.height = size;
  const x = c.getContext('2d');
  if (facing === 'user') { x.translate(size, 0); x.scale(-1, 1); }
  x.drawImage(cam, sx, sy, s, s, 0, 0, size, size);
  return c;
}

/* 책상·방처럼 '장면'에 가까운 답은 물건이 같이 잡혔을 때 뒤로 미룬다 */
const SCENE = new Set([
  'desk','dining table','home theater','library','bookcase','entertainment center',
  'wardrobe','studio couch','restaurant','cinema','prison','monitor','screen',
  'desktop computer','window screen','window shade','sliding door','screen door',
  'patio','barbershop','toyshop','grocery store','bookshop','shoe shop','butcher shop',
  'confectionery','tobacco shop','dock','boathouse','barn','greenhouse','church',
  'castle','palace','monastery','mosque','water tower','planetarium','obelisk',
  'triumphal arch','dam','apiary','altar','stage','maze','web site','shoji',
  'medicine chest','chiffonier','file','crate','bannister','pedestal','table lamp'
]);

/* 물체 탐지로 '화면 속 주인공'을 먼저 찾는다.
   coco-ssd 는 컵·병·마우스·책 같은 80가지 물건의 위치를 찾아주므로,
   책상이나 배경 대신 손에 든 물건을 집어낼 수 있다. */
async function detectMain() {
  if (!coco) return null;
  const src = document.createElement('canvas');
  if (!grab(416, 1.5, src)) return null;          // 네모보다 조금 넓게 보고 찾는다
  let dets = [];
  try { dets = await coco.detect(src, 8, 0.3); } catch (e) { return null; }
  if (!dets.length) return null;

  const C = 208;                                   // 화면 한가운데
  let best = null;
  for (const d of dets) {
    const [x, y, w, h] = d.bbox;
    const cx = x + w / 2, cy = y + h / 2;
    const dist = Math.hypot(cx - C, cy - C) / C;                 // 가운데서 멀수록 감점
    const area = Math.min(1, (w * h) / (416 * 416) * 4);         // 클수록 가점
    const sc = d.score * (1 - 0.55 * Math.min(1, dist)) * (0.45 + 0.55 * area);
    if (!best || sc > best.sc) best = { sc, det: d, src };
  }
  return best && best.sc > 0.25 ? best : null;
}

// 찾아낸 상자만 잘라내기 (조금 여유를 둔 정사각형)
function cropBox(src, bbox, size) {
  const [x, y, w, h] = bbox;
  const s = Math.min(src.width, Math.max(w, h) * 1.25);
  let sx = x + w / 2 - s / 2, sy = y + h / 2 - s / 2;
  sx = Math.max(0, Math.min(src.width - s, sx));
  sy = Math.max(0, Math.min(src.height - s, sy));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(src, sx, sy, s, s, 0, 0, size, size);
  return c;
}

/* 여러 배율로 찍어 보고 결과를 합산한다 — 가까이 본 쪽에 가중치를 더 준다 */
async function classifyBest() {
  const plans = [[0.7, 1.25], [1.0, 1.0], [1.6, 0.6]];
  const score = new Map();
  const tmp = document.createElement('canvas');
  for (const [zoom, w] of plans) {
    const c = grab(224, zoom, tmp);
    if (!c) continue;
    let res = [];
    try { res = await model.classify(c, 5); } catch (e) { continue; }
    for (const r of res) {
      const first = r.className.split(',')[0].trim().toLowerCase();
      const mul = SCENE.has(first) ? 0.35 : 1;
      score.set(r.className, (score.get(r.className) || 0) + r.probability * w * mul);
    }
  }
  const total = [...score.values()].reduce((a, b) => a + b, 0) || 1;
  const ranked = [...score.entries()]
    .map(([className, s]) => ({ className, probability: s / total }))
    .sort((a, b) => b.probability - a.probability);

  // 같은 단어로 겹치는 후보는 하나로
  const out = [], seen = new Set();
  for (const r of ranked) {
    const w = lookupWord(r.className);
    if (seen.has(w.en)) continue;
    seen.add(w.en);
    out.push({ ...r, word: w });
    if (out.length === 4) break;
  }
  return out;
}

/* 최종 인식: 물체 탐지 → 그 상자만 자세히 보기 → 부족하면 화면 전체 분류 */
async function recognize() {
  const cand = new Map();                       // 단어 -> 후보
  const add = (className, weight) => {
    const w = lookupWord(className);
    if (!w.en) return;
    const prev = cand.get(w.en);
    if (!prev || weight > prev.probability) {
      cand.set(w.en, { className, probability: weight, word: w });
    }
  };

  const best = await detectMain();
  if (best) {
    // 탐지는 '화면 속 주인공'을 집어낸 것이라 조금 더 믿는다
    add(best.det.class, Math.min(0.99, best.det.score * 1.25));
    if (model) {
      try {
        const res = await model.classify(cropBox(best.src, best.det.bbox, 224), 5);
        for (const r of res) {
          if (SCENE.has(r.className.split(',')[0].trim().toLowerCase())) continue;
          add(r.className, r.probability * 0.95);
        }
      } catch (e) {}
    }
  }
  // 탐지가 약하거나 후보가 적으면 화면 전체 분류로 보완
  if (!best || best.det.score < 0.5 || cand.size < 3) {
    for (const c of await classifyBest()) add(c.className, c.probability * 0.8);
  }
  return [...cand.values()].sort((a, b) => b.probability - a.probability).slice(0, 4);
}

$('shutter').onclick = async () => {
  if (busy) return;
  if (!stream) { toast('먼저 시작하기를 눌러 주세요'); return; }
  busy = true;
  try {
    await loadModel();
    const big = grab(448);
    if (!big) { toast('카메라가 아직 준비되지 않았어요'); return; }
    const thumb = big.toDataURL('image/jpeg', 0.55);
    $('loading').hidden = false;
    $('loadingText').textContent = '무엇인지 보고 있어요…';
    const cands = await recognize();
    $('loading').hidden = true;
    if (!cands.length) { toast('잘 안 보여요. 다시 찍어 볼까요?'); return; }
    showResult(cands, thumb);
  } catch (e) {
    $('loading').hidden = true;
    toast('인식에 실패했어요. 다시 찍어 볼까요?');
  } finally { busy = false; }
};

let lastCands = [], lastImg = '';

function pickCand(i, speakIt = true) {
  const c = lastCands[i];
  if (!c) return;
  const w = c.word;
  pending = { en: w.en, ko: w.ko, prob: c.probability, img: lastImg, raw: c.className };

  $('sheetEn').textContent = w.en || '???';
  $('sheetKo').textContent = w.ko || '(한국어 이름은 아직 몰라요)';
  $('sheetSub').textContent = has(w.en)
    ? '이미 도감에 있는 단어예요! 한 번 더 읽어 볼까요?'
    : (c.probability < MIN_PROB
        ? '아닌 것 같으면 아래에서 골라 보세요'
        : '맞으면 도감에 담아요 · 확신 ' + Math.round(c.probability * 100) + '%');
  $('keepBtn').textContent = has(w.en) ? '다시 듣기' : '도감에 담기';

  $('alts').innerHTML = lastCands.map((x, k) =>
    `<button class="alt ${k === i ? 'on' : ''}" data-i="${k}">${x.word.en}${x.word.ko ? ' · ' + x.word.ko : ''}</button>`
  ).join('');
  if (speakIt) speak(w.en);
}

function showResult(cands, img) {
  lastCands = cands;
  lastImg = img;
  $('sheetImg').src = img;
  $('sheet').hidden = false;
  pickCand(0);
}

$('alts').onclick = e => {
  const b = e.target.closest('[data-i]');
  if (b) pickCand(+b.dataset.i);
};

$('retryBtn').onclick = () => { $('sheet').hidden = true; pending = null; };
$('sheet').onclick = e => { if (e.target.id === 'sheet') $('retryBtn').onclick(); };

$('keepBtn').onclick = () => {
  if (!pending) return;
  if (has(pending.en)) { speak(pending.en); return; }
  words.unshift({ en: pending.en, ko: pending.ko, img: pending.img, at: Date.now() });
  if (words.length > 300) words.length = 300;
  save(); drawScore();

  const m = mission.list.find(x => x.en === pending.en && !x.done);
  if (m) {
    m.done = true; saveMission(); drawMission();
    const left = mission.list.filter(x => !x.done).length;
    toast(left ? `목표 달성! ${m.en} ✅ (${left}개 남음)` : '오늘의 목표를 모두 찾았어요! 🎉');
    confetti();
  } else {
    toast(`${pending.en} 담았어요! (${words.length}개)`);
    if ([10, 30, 60, 100].includes(words.length)) confetti();
  }
  ding(true);
  $('sheet').hidden = true; pending = null;
};

/* ---------- 도감 ---------- */
let editing = false;
$('editBtn').onclick = () => {
  editing = !editing;
  document.body.classList.toggle('editing', editing);
  $('editBtn').textContent = editing ? '완료' : '편집';
};

function drawGrid() {
  drawScore();
  $('empty').style.display = words.length ? 'none' : 'block';
  $('grid').innerHTML = words.map((w, i) => `
    <div class="cell" data-i="${i}">
      <img src="${w.img}" alt="${w.en}">
      <div class="en">${w.en}</div>
      <div class="ko">${w.ko || '—'}</div>
      <button class="del" data-del="${i}">×</button>
    </div>`).join('');
}

$('grid').onclick = e => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const i = +del.dataset.del;
    words.splice(i, 1); save(); drawGrid();
    return;
  }
  const cell = e.target.closest('.cell');
  if (cell) speak(words[+cell.dataset.i].en);
};

/* ---------- 복습 퀴즈 ---------- */
let qAns = '', qDone = 0, qOk = 0;
function newQuiz() {
  if (words.length < 4) { $('quizNeed').hidden = false; $('quizPlay').hidden = true; return; }
  $('quizNeed').hidden = true; $('quizPlay').hidden = false;
  const pick = words[Math.floor(Math.random() * words.length)];
  qAns = pick.en;
  const others = words.filter(w => w.en !== pick.en).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [pick, ...others].sort(() => Math.random() - 0.5);
  $('quizImg').src = pick.img;
  $('quizQ').textContent = pick.ko ? `“${pick.ko}”의 영어 이름은?` : '이 물건의 영어 이름은?';
  $('quizOpts').innerHTML = opts.map(o => `<button class="opt" data-en="${o.en}">${o.en}</button>`).join('');
  $('quizMsg').textContent = '';
  $('quizScore').textContent = qDone ? `${qDone}문제 중 ${qOk}개 정답` : '';
}
$('quizOpts').onclick = e => {
  const b = e.target.closest('.opt'); if (!b || $('quizMsg').textContent) return;
  const ok = b.dataset.en === qAns;
  qDone++; if (ok) qOk++;
  document.querySelectorAll('.opt').forEach(o => {
    if (o.dataset.en === qAns) o.classList.add('ok');
    else if (o === b) o.classList.add('ng');
  });
  $('quizMsg').textContent = ok ? '정답이에요! 🎉' : `아쉬워요, 정답은 ${qAns}`;
  speak(qAns); ding(ok);
  setTimeout(newQuiz, 1600);
};

/* ---------- 시작 ---------- */
drawScore(); drawMission(); drawSound();
if (words.length) $('empty').style.display = 'none';
document.addEventListener('visibilitychange', () => {
  if (document.hidden && 'speechSynthesis' in window) speechSynthesis.cancel();
});
/* ---------- 자동 업데이트 ----------
   고친 내용이 폰에 바로 반영되도록: 켤 때마다 새 버전을 확인하고,
   새 버전이 준비되면 한 번만 새로고침한다. */
const BUILD = '2026-11-16 13:45';
const verEl = document.getElementById('ver');
if (verEl) verEl.textContent = 'v ' + BUILD;

if ('serviceWorker' in navigator) {
  let reloaded = false;
  const wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 첫 설치 때는 새로고침하지 않고, 새 버전으로 바뀔 때만 한 번 새로고침
    if (!wasControlled || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  });
  // 앱을 다시 열 때도 새 버전 확인
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      navigator.serviceWorker.getRegistration()
        .then(reg => reg && reg.update().catch(() => {})).catch(() => {});
    }
  });
}
})();
