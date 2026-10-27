// name, conference, division, primary color, secondary color
const TEAMS = [
  ["Buffalo Bills", "AFC", "East", "#00338D", "#C60C30"],
  ["Miami Dolphins", "AFC", "East", "#008E97", "#FC4C02"],
  ["New England Patriots", "AFC", "East", "#002244", "#C60C30"],
  ["New York Jets", "AFC", "East", "#125740", "#FFFFFF"],
  ["Baltimore Ravens", "AFC", "North", "#241773", "#9E7C0C"],
  ["Cincinnati Bengals", "AFC", "North", "#FB4F14", "#000000"],
  ["Cleveland Browns", "AFC", "North", "#311D00", "#FF3C00"],
  ["Pittsburgh Steelers", "AFC", "North", "#101820", "#FFB612"],
  ["Houston Texans", "AFC", "South", "#03202F", "#A71930"],
  ["Indianapolis Colts", "AFC", "South", "#002C5F", "#A2AAAD"],
  ["Jacksonville Jaguars", "AFC", "South", "#006778", "#D7A22A"],
  ["Tennessee Titans", "AFC", "South", "#0C2340", "#4B92DB"],
  ["Denver Broncos", "AFC", "West", "#FB4F14", "#002244"],
  ["Kansas City Chiefs", "AFC", "West", "#E31837", "#FFB81C"],
  ["Las Vegas Raiders", "AFC", "West", "#000000", "#A5ACAF"],
  ["Los Angeles Chargers", "AFC", "West", "#0080C6", "#FFC20E"],
  ["Dallas Cowboys", "NFC", "East", "#003594", "#869397"],
  ["New York Giants", "NFC", "East", "#0B2265", "#A71930"],
  ["Philadelphia Eagles", "NFC", "East", "#004C54", "#A5ACAF"],
  ["Washington Commanders", "NFC", "East", "#5A1414", "#FFB612"],
  ["Chicago Bears", "NFC", "North", "#0B162A", "#C83803"],
  ["Detroit Lions", "NFC", "North", "#0076B6", "#B0B7BC"],
  ["Green Bay Packers", "NFC", "North", "#203731", "#FFB612"],
  ["Minnesota Vikings", "NFC", "North", "#4F2683", "#FFC62F"],
  ["Atlanta Falcons", "NFC", "South", "#A71930", "#000000"],
  ["Carolina Panthers", "NFC", "South", "#0085CA", "#101820"],
  ["New Orleans Saints", "NFC", "South", "#D3BC8D", "#101820"],
  ["Tampa Bay Buccaneers", "NFC", "South", "#D50A0A", "#34302B"],
  ["Arizona Cardinals", "NFC", "West", "#97233F", "#FFB612"],
  ["Los Angeles Rams", "NFC", "West", "#003594", "#FFA300"],
  ["San Francisco 49ers", "NFC", "West", "#AA0000", "#B3995D"],
  ["Seattle Seahawks", "NFC", "West", "#002244", "#69BE28"],
].map(([name, conf, div, color, accent]) => ({ name, conf, div, color, accent }));

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spin");
const resultEl = document.getElementById("result");
const removeWinnerEl = document.getElementById("removeWinner");
const teamListEl = document.getElementById("teamList");
const countEl = document.getElementById("count");
const modal = document.getElementById("modal");
const modalTeam = document.getElementById("modalTeam");

const active = new Set(TEAMS.map((t) => t.name));
let rotation = 0; // radians
let spinning = false;

const activeTeams = () => TEAMS.filter((t) => active.has(t.name));

function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}

function drawWheel() {
  const teams = activeTeams();
  const size = canvas.width;
  const c = size / 2;
  const radius = c - 6;
  ctx.clearRect(0, 0, size, size);

  if (teams.length === 0) {
    ctx.fillStyle = "#1c2740";
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d9ab0";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Select some teams", c, c - 110);
    return;
  }

  const slice = (Math.PI * 2) / teams.length;
  const fontSize = Math.max(14, Math.min(30, 560 / teams.length + 10));

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
  });

  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

// The pointer sits on the right side of the wheel (angle 0).
function teamAtPointer() {
  const teams = activeTeams();
  const slice = (Math.PI * 2) / teams.length;
  const angle = ((-rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return teams[Math.floor(angle / slice) % teams.length];
}

function spin() {
  const teams = activeTeams();
  if (spinning || teams.length === 0) return;
  spinning = true;
  spinBtn.disabled = true;
  resultEl.innerHTML = "&nbsp;";

  const startRot = rotation;
  const extra = Math.PI * 2 * (6 + Math.random() * 4) + Math.random() * Math.PI * 2;
  const duration = 5000 + Math.random() * 1500;
  const t0 = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    rotation = startRot + extra * easeOut(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation %= Math.PI * 2;
      finish(teamAtPointer());
    }
  }
  requestAnimationFrame(frame);
}

function finish(team) {
  spinning = false;
  spinBtn.disabled = false;
  resultEl.textContent = `🏈 ${team.name}`;
  modalTeam.textContent = team.name;
  modalTeam.style.background = team.color;
  modalTeam.style.borderColor = team.accent;
  modalTeam.style.color = textColorFor(team.color);
  modal.hidden = false;

  if (removeWinnerEl.checked) {
    active.delete(team.name);
    renderList();
  }
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
        label.className = "team";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = active.has(team.name);
        box.disabled = spinning;
        box.addEventListener("change", () => {
          box.checked ? active.add(team.name) : active.delete(team.name);
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

document.querySelectorAll("[data-filter]").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (spinning) return;
    const f = btn.dataset.filter;
    active.clear();
    TEAMS.forEach((t) => {
      if (f === "all" || t.conf === f) active.add(t.name);
    });
    renderList();
  })
);

document.getElementById("reset").addEventListener("click", () => {
  if (spinning) return;
  TEAMS.forEach((t) => active.add(t.name));
  resultEl.innerHTML = "&nbsp;";
  renderList();
});

document.getElementById("closeModal").addEventListener("click", () => (modal.hidden = true));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") modal.hidden = true;
});
spinBtn.addEventListener("click", spin);

renderList();
