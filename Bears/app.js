// ---- Roster (edit here) ----
const ROSTER = [
  "Michael", "Johnny", "Gavin", "Chase",
  "Bradley", "Nick", "Stefano", "Zane",
  "Isaac", "Bobby", "Patrick", "Aiden"
];

// ---- State ----
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const state = {
  players: shuffle(ROSTER).map((name, i) => ({
    id: i,
    name,
    present: true,
    onField: false,
    timesOff: 0,
    playsSinceOff: null, // null = n/a (never been off)
  })),
  numSubs: 2,
  playsPerSub: 2,
  selectedOnField: new Set(),
  selectedInitialOff: new Set(),
};

// ---- DOM helpers ----
const $ = (id) => document.getElementById(id);
const screens = ["splash", "setup", "initial-off", "game"];
function showScreen(id) {
  screens.forEach((s) => $(s).classList.toggle("active", s === id));
  window.scrollTo(0, 0);
}

// ---- Splash ----
function initSplash() {
  const splash = $("splash");
  const go = () => {
    if (splash.classList.contains("active")) {
      showScreen("setup");
      renderSetup();
      $("instructions").classList.add("open");
    }
  };
  setTimeout(go, 1800);
  splash.addEventListener("click", go);
}

// ---- Setup screen ----
function renderRoster() {
  const list = $("roster-list");
  list.innerHTML = "";
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.className = p.present ? "present" : "absent";
    li.innerHTML = `<span class="name">${p.name}</span><span class="badge">${p.present ? "Present" : "Absent"}</span>`;
    li.addEventListener("click", () => {
      p.present = !p.present;
      renderRoster();
    });
    list.appendChild(li);
  });
}
function renderSetup() {
  renderRoster();
  $("num-subs").value = state.numSubs;
  $("plays-per-sub").value = state.playsPerSub;
}

function readConfigInputs() {
  const n = parseInt($("num-subs").value, 10);
  const p = parseInt($("plays-per-sub").value, 10);
  state.numSubs = Math.min(5, Math.max(1, isNaN(n) ? 2 : n));
  state.playsPerSub = Math.max(1, isNaN(p) ? 2 : p);
}

// ---- Initial off-field picker ----
function renderInitialOff() {
  $("initial-off-count").textContent = state.numSubs;
  const list = $("initial-off-list");
  list.innerHTML = "";
  const present = state.players.filter((p) => p.present);
  present.forEach((p) => {
    const li = document.createElement("li");
    li.dataset.id = p.id;
    if (state.selectedInitialOff.has(p.id)) li.classList.add("selected");
    li.innerHTML = `<span class="name">${p.name}</span>`;
    li.addEventListener("click", () => toggleInitial(p.id));
    list.appendChild(li);
  });
  updateInitialButton();
}
function toggleInitial(id) {
  if (state.selectedInitialOff.has(id)) {
    state.selectedInitialOff.delete(id);
  } else {
    if (state.selectedInitialOff.size >= state.numSubs) return;
    state.selectedInitialOff.add(id);
  }
  renderInitialOff();
}
function updateInitialButton() {
  $("confirm-initial-off").disabled = state.selectedInitialOff.size !== state.numSubs;
}

// ---- Game screen ----
function renderGame() {
  $("sub-count").textContent = state.numSubs;

  const onField = state.players
    .filter((p) => p.present && p.onField)
    .sort((a, b) => {
      if (a.playsSinceOff === null && b.playsSinceOff === null) return 0;
      if (a.playsSinceOff === null) return -1;
      if (b.playsSinceOff === null) return 1;
      return b.playsSinceOff - a.playsSinceOff;
    });
  const offField = state.players.filter((p) => p.present && !p.onField);

  $("on-count").textContent = onField.length;
  $("off-count").textContent = offField.length;

  const onList = $("on-field-list");
  onList.innerHTML = "";
  onField.forEach((p) => onList.appendChild(playerRow(p, true)));

  const offList = $("off-field-list");
  offList.innerHTML = "";
  offField.forEach((p) => offList.appendChild(playerRow(p, false)));

  updateSubmitButton();
}

function playerRow(p, selectable) {
  const li = document.createElement("li");
  li.dataset.id = p.id;
  if (selectable && state.selectedOnField.has(p.id)) li.classList.add("selected");

  const plays = p.playsSinceOff === null ? "n/a" : p.playsSinceOff;
  li.innerHTML = `
    <span class="name">${p.name}</span>
    <span class="stats">
      <span class="stat">Off: ${p.timesOff}</span>
      <span class="stat">Plays since last sub: ${plays}</span>
    </span>`;

  if (selectable) {
    li.addEventListener("click", () => toggleOnFieldSelection(p.id));
  }
  return li;
}

function toggleOnFieldSelection(id) {
  if (state.selectedOnField.has(id)) {
    state.selectedOnField.delete(id);
  } else {
    if (state.selectedOnField.size >= state.numSubs) return;
    state.selectedOnField.add(id);
  }
  renderGame();
}
function updateSubmitButton() {
  $("submit-sub").disabled = state.selectedOnField.size !== state.numSubs;
}

function submitSub() {
  if (state.selectedOnField.size !== state.numSubs) return;

  const subbedOutIds = new Set(state.selectedOnField);
  const currentOff = state.players.filter((p) => p.present && !p.onField);

  // Advance play counter for on-field players who have been off before
  state.players.forEach((p) => {
    if (p.present && p.onField && p.playsSinceOff !== null) {
      p.playsSinceOff += state.playsPerSub;
    }
  });

  // Move selected on-field players to the bench
  state.players.forEach((p) => {
    if (subbedOutIds.has(p.id)) {
      p.onField = false;
      p.timesOff += 1;
      p.playsSinceOff = 0;
    }
  });

  // Move the prior off-field players onto the field.
  // First time coming on from the starting bench counts as one time off.
  currentOff.forEach((p) => {
    p.onField = true;
    if (p.playsSinceOff === null) {
      p.playsSinceOff = 0;
      p.timesOff = 1;
    }
  });

  state.selectedOnField.clear();
  renderGame();
}

// ---- Settings sheet (game settings + late arrivals) ----
function openSettingsSheet() {
  $("settings-num-subs").value = state.numSubs;
  $("settings-plays-per-sub").value = state.playsPerSub;
  renderLateList();
  $("settings-sheet").classList.add("open");
}
function closeSettingsSheet() {
  const n = parseInt($("settings-num-subs").value, 10);
  const p = parseInt($("settings-plays-per-sub").value, 10);
  state.numSubs = Math.min(5, Math.max(1, isNaN(n) ? state.numSubs : n));
  state.playsPerSub = Math.max(1, isNaN(p) ? state.playsPerSub : p);
  // Clear any in-progress selection since numSubs may have changed
  state.selectedOnField.clear();
  $("settings-sheet").classList.remove("open");
  renderGame();
}
function renderLateList() {
  const list = $("late-list");
  list.innerHTML = "";
  const absent = state.players.filter((p) => !p.present);
  if (absent.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name" style="color:var(--muted)">No absent players.</span>`;
    list.appendChild(li);
    return;
  }
  absent.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name">${p.name}</span><span class="badge" style="background:#dcfce7;color:var(--good)">Mark Present</span>`;
    li.addEventListener("click", () => {
      p.present = true;
      p.onField = false; // joins the bench
      renderLateList();
      renderGame();
    });
    list.appendChild(li);
  });
}

// ---- End game → return to setup, reset stats ----
function endGame() {
  if (!confirm("End game and return to setup? Stats will reset.")) return;
  state.players.forEach((p) => {
    p.onField = false;
    p.timesOff = 0;
    p.playsSinceOff = null;
  });
  state.selectedOnField.clear();
  state.selectedInitialOff.clear();
  showScreen("setup");
  renderSetup();
}

// ---- Wire up events ----
function init() {
  initSplash();

  $("start-game").addEventListener("click", () => {
    readConfigInputs();
    const presentCount = state.players.filter((p) => p.present).length;
    if (presentCount <= state.numSubs) {
      alert(`Need more than ${state.numSubs} present players to start.`);
      return;
    }
    state.selectedInitialOff.clear();
    showScreen("initial-off");
    renderInitialOff();
  });

  $("back-to-setup").addEventListener("click", () => {
    state.selectedInitialOff.clear();
    showScreen("setup");
    renderSetup();
  });

  $("confirm-initial-off").addEventListener("click", () => {
    if (state.selectedInitialOff.size !== state.numSubs) return;
    state.players.forEach((p) => {
      if (!p.present) { p.onField = false; return; }
      p.onField = !state.selectedInitialOff.has(p.id);
      p.timesOff = 0;
      p.playsSinceOff = null;
    });
    state.selectedOnField.clear();
    showScreen("game");
    renderGame();
  });

  $("submit-sub").addEventListener("click", submitSub);
  $("open-settings").addEventListener("click", openSettingsSheet);
  $("close-settings").addEventListener("click", closeSettingsSheet);
  $("settings-sheet").addEventListener("click", (e) => {
    if (e.target.id === "settings-sheet") closeSettingsSheet();
  });
  $("end-game").addEventListener("click", endGame);
  $("close-instructions").addEventListener("click", () => {
    $("instructions").classList.remove("open");
  });
}

init();
