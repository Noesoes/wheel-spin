// abbreviation, name, conference, division, primary color, secondary color
const TEAMS = [
  ["BUF", "Buffalo Bills", "AFC", "East", "#00338D", "#C60C30"],
  ["MIA", "Miami Dolphins", "AFC", "East", "#008E97", "#FC4C02"],
  ["NE", "New England Patriots", "AFC", "East", "#002244", "#C60C30"],
  ["NYJ", "New York Jets", "AFC", "East", "#125740", "#FFFFFF"],
  ["BAL", "Baltimore Ravens", "AFC", "North", "#241773", "#9E7C0C"],
  ["CIN", "Cincinnati Bengals", "AFC", "North", "#FB4F14", "#000000"],
  ["CLE", "Cleveland Browns", "AFC", "North", "#311D00", "#FF3C00"],
  ["PIT", "Pittsburgh Steelers", "AFC", "North", "#101820", "#FFB612"],
  ["HOU", "Houston Texans", "AFC", "South", "#03202F", "#A71930"],
  ["IND", "Indianapolis Colts", "AFC", "South", "#002C5F", "#A2AAAD"],
  ["JAX", "Jacksonville Jaguars", "AFC", "South", "#006778", "#D7A22A"],
  ["TEN", "Tennessee Titans", "AFC", "South", "#0C2340", "#4B92DB"],
  ["DEN", "Denver Broncos", "AFC", "West", "#FB4F14", "#002244"],
  ["KC", "Kansas City Chiefs", "AFC", "West", "#E31837", "#FFB81C"],
  ["LV", "Las Vegas Raiders", "AFC", "West", "#000000", "#A5ACAF"],
  ["LAC", "Los Angeles Chargers", "AFC", "West", "#0080C6", "#FFC20E"],
  ["DAL", "Dallas Cowboys", "NFC", "East", "#003594", "#869397"],
  ["NYG", "New York Giants", "NFC", "East", "#0B2265", "#A71930"],
  ["PHI", "Philadelphia Eagles", "NFC", "East", "#004C54", "#A5ACAF"],
  ["WAS", "Washington Commanders", "NFC", "East", "#5A1414", "#FFB612"],
  ["CHI", "Chicago Bears", "NFC", "North", "#0B162A", "#C83803"],
  ["DET", "Detroit Lions", "NFC", "North", "#0076B6", "#B0B7BC"],
  ["GB", "Green Bay Packers", "NFC", "North", "#203731", "#FFB612"],
  ["MIN", "Minnesota Vikings", "NFC", "North", "#4F2683", "#FFC62F"],
  ["ATL", "Atlanta Falcons", "NFC", "South", "#A71930", "#000000"],
  ["CAR", "Carolina Panthers", "NFC", "South", "#0085CA", "#101820"],
  ["NO", "New Orleans Saints", "NFC", "South", "#D3BC8D", "#101820"],
  ["TB", "Tampa Bay Buccaneers", "NFC", "South", "#D50A0A", "#34302B"],
  ["ARI", "Arizona Cardinals", "NFC", "West", "#97233F", "#FFB612"],
  ["LAR", "Los Angeles Rams", "NFC", "West", "#003594", "#FFA300"],
  ["SF", "San Francisco 49ers", "NFC", "West", "#AA0000", "#B3995D"],
  ["SEA", "Seattle Seahawks", "NFC", "West", "#002244", "#69BE28"],
].map(([abbr, name, conf, div, color, accent]) => ({ abbr, name, conf, div, color, accent }));

const TEAM_BY_NAME = new Map(TEAMS.map((t) => [t.name, t]));
const TAU = Math.PI * 2;
const LOGICAL = 800; // wheel drawing coordinates; scaled to the real canvas size
const STORAGE_KEY = "nflWheel.v1";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const canvas = $("wheel");
const ctx = canvas.getContext("2d");
const pointerEl = $("pointer");
const spinBtn = $("spin");
const resultEl = $("result");
const removeWinnerEl = $("removeWinner");
const soundBtn = $("sound");
const teamListEl = $("teamList");
const countEl = $("count");
const historyEl = $("historyList");
const historyEmptyEl = $("historyEmpty");
const modal = $("modal");

const active = new Set(TEAMS.map((t) => t.name));
let history = []; // [{ name, time }], newest first
let soundOn = true;
let rotation = 0; // radians
let spinning = false;
let winner = null; // team highlighted on the wheel after a spin
let pendingRemoval = null; // winner to drop once the result is dismissed

const activeTeams = () => TEAMS.filter((t) => active.has(t.name));

// ---------- persistence ----------

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    if (Array.isArray(saved.active)) {
      active.clear();
      saved.active.filter((n) => TEAM_BY_NAME.has(n)).forEach((n) => active.add(n));
    }
    if (Array.isArray(saved.history)) history = saved.history.filter((h) => TEAM_BY_NAME.has(h.name));
    removeWinnerEl.checked = !!saved.removeWinner;
    soundOn = saved.soundOn !== false;
  } catch {}
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      active: [...active],
      history,
      removeWinner: removeWinnerEl.checked,
      soundOn,
    }));
  } catch {}
}

// ---------- sound ----------

let audioCtx = null;
let lastTick = 0;

function audio() {
  if (!soundOn) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx ??= new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, start, length, volume, type = "triangle") {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const t = a.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length);
}

function tick() {
  const now = performance.now();
  if (now - lastTick < 35) return;
  lastTick = now;
  tone(1200, 0, 0.04, 0.12, "square");
}

function fanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, i === 3 ? 0.5 : 0.18, 0.15));
}

function renderSoundBtn() {
  soundBtn.textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
}

// ---------- drawing ----------

function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = Math.round(canvas.clientWidth * dpr) || LOGICAL;
  if (canvas.width !== size) {
    canvas.width = canvas.height = size;
  }
  drawWheel();
}

function drawWheel() {
  const teams = activeTeams();
  const c = LOGICAL / 2;
  const radius = c - 6;
  const scale = canvas.width / LOGICAL;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, LOGICAL, LOGICAL);

  if (teams.length === 0) {
    ctx.fillStyle = "#1c2740";
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8d9ab0";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Select some teams", c, c - 110);
    return;
  }

  const slice = TAU / teams.length;
  const fontSize = Math.max(14, Math.min(30, 560 / teams.length + 10));
  const highlight = winner && !spinning && active.has(winner.name);

  teams.forEach((team, i) => {
    const start = rotation + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = team.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.stroke();

    // Accent stripe along the outer edge
    ctx.beginPath();
    ctx.arc(c, c, radius - 8, start, end);
    ctx.lineWidth = 12;
    ctx.strokeStyle = team.accent;
    ctx.stroke();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColorFor(team.color);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillText(team.name, radius - 26, 0, radius * 0.68);
    ctx.restore();

    if (highlight && team.name !== winner.name) {
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fill();
    }
  });

  ctx.beginPath();
  ctx.arc(c, c, radius, 0, TAU);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

// The pointer sits on the right side of the wheel (angle 0).
function indexAtPointer(count) {
  const slice = TAU / count;
  const angle = ((-rotation % TAU) + TAU) % TAU;
  return Math.floor(angle / slice) % count;
}

function flickPointer() {
  pointerEl.classList.add("flick");
  clearTimeout(flickPointer.timer);
  flickPointer.timer = setTimeout(() => pointerEl.classList.remove("flick"), 50);
}

// ---------- spinning ----------

function spin(direction = 1, power = 1) {
  closeModal();
  const teams = activeTeams();
  if (spinning || teams.length === 0) return;
  spinning = true;
  winner = null;
  spinBtn.disabled = true;
  setListDisabled(true);
  resultEl.innerHTML = "&nbsp;";
  audio(); // unlock audio during the user gesture

  const turns = 5 + Math.random() * 4 + power * 2;
  const startRot = rotation;
  const extra = direction * (turns * TAU + Math.random() * TAU);
  const duration = 4500 + Math.random() * 1500 + power * 500;
  const t0 = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  let lastIndex = indexAtPointer(teams.length);

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    rotation = startRot + extra * easeOut(t);
    const index = indexAtPointer(teams.length);
    if (index !== lastIndex) {
      lastIndex = index;
      tick();
      flickPointer();
    }
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation = ((rotation % TAU) + TAU) % TAU;
      finish(teams[indexAtPointer(teams.length)]);
    }
  }
  requestAnimationFrame(frame);
}

function finish(team) {
  spinning = false;
  winner = team;
  spinBtn.disabled = false;
  setListDisabled(false);
  drawWheel();

  resultEl.textContent = `🏈 ${team.name}`;
  history.unshift({ name: team.name, time: Date.now() });
  history = history.slice(0, 50);
  renderHistory();
  if (removeWinnerEl.checked) pendingRemoval = team.name;
  save();

  fanfare();
  confetti([team.color, team.accent, "#ffffff"]);
  openModal(team);
}

// ---------- result modal ----------

function openModal(team) {
  $("modalAbbr").textContent = team.abbr;
  $("modalTeam").textContent = team.name;
  $("modalDiv").textContent = `${team.conf} ${team.div}`;
  const badge = $("modalBadge");
  badge.style.background = team.color;
  badge.style.borderColor = team.accent;
  badge.style.color = textColorFor(team.color);
  modal.hidden = false;
  $("spinAgain").focus();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  if (pendingRemoval) {
    active.delete(pendingRemoval);
    pendingRemoval = null;
    winner = null;
    save();
    renderList();
  }
  spinBtn.focus({ preventScroll: true });
}

// ---------- confetti ----------

const fx = $("confetti");
const fxCtx = fx.getContext("2d");

function confetti(colors) {
  if (reducedMotion) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  fx.width = w * dpr;
  fx.height = h * dpr;
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pieces = Array.from({ length: Math.min(220, Math.round(w / 5)) }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.5,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * TAU,
    vr: (Math.random() - 0.5) * 0.3,
    size: 6 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const t0 = performance.now();
  function frame(now) {
    fxCtx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of pieces) {
      p.vy += 0.06;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y < h + 20) alive = true;
      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      fxCtx.strokeStyle = "rgba(0,0,0,.25)";
      fxCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      fxCtx.strokeRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      fxCtx.restore();
    }
    if (alive && now - t0 < 6000) requestAnimationFrame(frame);
    else fxCtx.clearRect(0, 0, w, h);
  }
  requestAnimationFrame(frame);
}

// ---------- drag / flick to spin ----------

let drag = null;

function angleOf(e) {
  const r = canvas.getBoundingClientRect();
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
}

canvas.addEventListener("pointerdown", (e) => {
  if (spinning || active.size === 0) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { last: angleOf(e), time: performance.now(), velocity: 0, count: active.size };
  drag.index = indexAtPointer(drag.count);
  winner = null;
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const a = angleOf(e);
  let d = a - drag.last;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  const now = performance.now();
  const dt = Math.max(1, now - drag.time);
  drag.velocity = 0.6 * drag.velocity + 0.4 * (d / dt);
  drag.last = a;
  drag.time = now;
  rotation += d;
  const index = indexAtPointer(drag.count);
  if (index !== drag.index) {
    drag.index = index;
    tick();
    flickPointer();
  }
  drawWheel();
});

function endDrag() {
  if (!drag) return;
  const { velocity, time } = drag;
  drag = null;
  const speed = Math.abs(velocity); // radians per ms
  if (performance.now() - time < 100 && speed > 0.004) {
    spin(Math.sign(velocity), Math.min(1.5, speed / 0.01));
  } else {
    drawWheel();
  }
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// ---------- team list ----------

function setListDisabled(disabled) {
  teamListEl.querySelectorAll("input").forEach((box) => (box.disabled = disabled));
}

function renderList() {
  teamListEl.innerHTML = "";
  for (const conf of ["AFC", "NFC"]) {
    for (const div of ["East", "North", "South", "West"]) {
      const group = document.createElement("div");
      group.className = "division";
      group.innerHTML = `<h3>${conf} ${div}</h3>`;
      TEAMS.filter((t) => t.conf === conf && t.div === div).forEach((team) => {
        const label = document.createElement("label");
        label.className = "team" + (active.has(team.name) ? "" : " off");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = active.has(team.name);
        box.disabled = spinning;
        box.addEventListener("change", () => {
          box.checked ? active.add(team.name) : active.delete(team.name);
          label.classList.toggle("off", !box.checked);
          winner = null;
          save();
          update();
        });
        const sw = document.createElement("span");
        sw.className = "swatch";
        sw.style.background = team.color;
        sw.style.borderColor = team.accent;
        label.append(box, sw, document.createTextNode(team.name));
        group.appendChild(label);
      });
      teamListEl.appendChild(group);
    }
  }
  update();
}

function update() {
  countEl.textContent = `(${active.size}/${TEAMS.length})`;
  spinBtn.disabled = spinning || active.size === 0;
  drawWheel();
}

// ---------- history ----------

function renderHistory() {
  historyEl.innerHTML = "";
  history.forEach((h, i) => {
    const team = TEAM_BY_NAME.get(h.name);
    const li = document.createElement("li");
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = `#${history.length - i}`;
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = team.color;
    sw.style.borderColor = team.accent;
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = new Date(h.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    li.append(num, sw, document.createTextNode(team.name), time);
    historyEl.appendChild(li);
  });
  historyEmptyEl.hidden = history.length > 0;
}

// ---------- wiring ----------

document.querySelectorAll("[data-filter]").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (spinning) return;
    const f = btn.dataset.filter;
    active.clear();
    TEAMS.forEach((t) => {
      if (f === "all" || t.conf === f) active.add(t.name);
    });
    winner = null;
    save();
    renderList();
  })
);

$("reset").addEventListener("click", () => {
  if (spinning) return;
  TEAMS.forEach((t) => active.add(t.name));
  winner = null;
  resultEl.innerHTML = "&nbsp;";
  save();
  renderList();
});

$("clearHistory").addEventListener("click", () => {
  history = [];
  save();
  renderHistory();
});

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  renderSoundBtn();
  save();
});

removeWinnerEl.addEventListener("change", save);
spinBtn.addEventListener("click", () => spin());
$("spinAgain").addEventListener("click", () => spin());
$("closeModal").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeModal();
  if (e.key !== " " || e.repeat) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "BUTTON") return; // let the focused control handle it
  e.preventDefault();
  spin();
});

window.addEventListener("resize", resizeCanvas);

load();
renderSoundBtn();
renderHistory();
renderList();
resizeCanvas();
