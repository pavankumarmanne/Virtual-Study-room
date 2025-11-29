/* Virtual Study Room — Pro
   Combines original logic with new features:
   - stats, streaks, theme, sounds, notes, confetti, keyboard shortcuts, chart
*/

// --------- Helpers ----------
const $ = (s) => document.querySelector(s);
const qs = (s) => Array.from(document.querySelectorAll(s));
const LS = {
  settings: "vsr_settings_v1",
  sessions: "vsr_sessions_v1",
  goals: "vsr_goals_v1",
  ambience: "vsr_ambience_v1",
  streak: "vsr_streak_v1",
  chart: "vsr_weekchart_v1",
  notes: "vsr_notes_v1",
  theme: "vsr_theme_v1"
};

// elements
const timeDisplay = $('#timeDisplay');
const startBtn = $('#startBtn');
const pauseBtn = $('#pauseBtn');
const resetBtn = $('#resetBtn');
const sessionCountEl = $('#sessionCount');
const completedCountEl = $('#completedCount');
const studyMinInput = $('#studyMin');
const shortMinInput = $('#shortMin');
const longMinInput = $('#longMin');
const saveSettingsBtn = $('#saveSettings');
const modeButtons = qs('.mode-btn');
const ambientSelect = $('#ambient');
const imageInput = $('#imageInput');
const goalsForm = $('#goalForm');
const goalInput = $('#goalInput');
const goalsList = $('#goalsList');
const goalsDoneCount = $('#goalsDoneCount');
const goalsTotal = $('#goalsTotal');
const clearGoalsBtn = $('#clearGoals');
const soundSelect = $('#sound');
const themeToggle = $('#themeToggle');
const quoteBox = $('#quoteBox');
const streakDisplay = $('#streakDisplay');
const sessionNotes = $('#sessionNotes');

// ring
const progressRing = document.querySelector('.ring');
let ringRadius = 0;
let ringCircumference = 0;
if (progressRing) {
  ringRadius = progressRing.r.baseVal.value || 0;
  ringCircumference = 2 * Math.PI * ringRadius;
  progressRing.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
  progressRing.style.strokeDashoffset = 0;
}

// ---------- State ----------
let modes = {
  study: { minutes: 25, label: "Study" },
  short: { minutes: 5, label: "Short Break" },
  long: { minutes: 15, label: "Long Break" }
};
let activeMode = "study";
let totalSeconds = modes[activeMode].minutes * 60;
let remainingSeconds = totalSeconds;
let timerInterval = null;
let isRunning = false;

// audio
let bgAudio = new Audio();
bgAudio.loop = true;
bgAudio.volume = 0.35;

// quotes
const quotes = [
  "Small progress is still progress.",
  "Focus on the process, not the outcome.",
  "You are capable of amazing things.",
  "Stay consistent, not perfect.",
  "One study session at a time."
];

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ---------- Storage-backed init ----------
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS.settings) || "{}");
    if (saved.study) { studyMinInput.value = saved.study; modes.study.minutes = +saved.study; }
    if (saved.short) { shortMinInput.value = saved.short; modes.short.minutes = +saved.short; }
    if (saved.long) { longMinInput.value = saved.long; modes.long.minutes = +saved.long; }
  } catch (e) { console.warn("loadSettings:", e); }
}
function loadSessions() {
  try {
    const sessions = JSON.parse(localStorage.getItem(LS.sessions) || "{}");
    const today = new Date().toISOString().slice(0,10);
    if (sessions.date !== today) {
      localStorage.setItem(LS.sessions, JSON.stringify({ date: today, sessions: 0, completed: 0 }));
      sessionCountEl.textContent = 0;
      completedCountEl.textContent = 0;
      return;
    }
    sessionCountEl.textContent = sessions.sessions || 0;
    completedCountEl.textContent = sessions.completed || 0;
  } catch (e) { console.warn("loadSessions:", e); }
}
function saveSessionCount(deltaSessions=0, deltaCompleted=0) {
  try {
    const now = new Date().toISOString().slice(0,10);
    let sessions = JSON.parse(localStorage.getItem(LS.sessions) || "{}");
    if (sessions.date !== now) sessions = { date: now, sessions: 0, completed: 0 };
    sessions.sessions = (sessions.sessions || 0) + deltaSessions;
    sessions.completed = (sessions.completed || 0) + deltaCompleted;
    localStorage.setItem(LS.sessions, JSON.stringify(sessions));
    sessionCountEl.textContent = sessions.sessions;
    completedCountEl.textContent = sessions.completed;
    updateStats();
    updateChartData(deltaCompleted);
  } catch (e) { console.warn("saveSessionCount:", e); }
}

// Goals
function getGoals() { 
  try { return JSON.parse(localStorage.getItem(LS.goals) || "[]"); }
  catch(e){ return []; }
}
function saveGoals(list) {
  try { localStorage.setItem(LS.goals, JSON.stringify(list)); }
  catch(e){ console.warn("saveGoals:", e); }
}
function renderGoal(goal, idx) {
  const li = document.createElement("li");
  li.dataset.idx = idx;
  li.className = goal.done ? "done" : "";
  li.innerHTML = `
    <input type="checkbox" class="goal-checkbox" ${goal.done ? "checked" : ""}/>
    <span class="goal-cat">${escapeHtml(goal.category)}</span>
    <span class="goal-text">${escapeHtml(goal.text)}</span>
    <div class="goal-actions">
      <button class="btn small edit">Edit</button>
      <button class="btn small del">Delete</button>
    </div>`;
  goalsList.appendChild(li);
}
function loadGoals() {
  try {
    const saved = getGoals();
    goalsList.innerHTML = "";
    saved.forEach((g, idx) => renderGoal(g, idx));
    updateGoalsSummary();
  } catch (e) { console.warn("loadGoals:", e); goalsList.innerHTML = ""; updateGoalsSummary(); }
}
function updateGoalsSummary() {
  const list = getGoals();
  const done = list.filter(g => g.done).length;
  goalsDoneCount.textContent = done;
  goalsTotal.textContent = list.length;
}

// Ambient
function loadAmbient() {
  const amb = localStorage.getItem(LS.ambience) || "ambience-1";
  if (amb === "image") {
    document.body.className = "custom-image";
    ambientSelect.value = "image";
    const url = localStorage.getItem("vsr_custom_image_url");
    if (url) document.body.style.backgroundImage = `url(${url})`;
  } else {
    document.body.classList.remove("custom-image","ambience-1","ambience-2","ambience-3");
    document.body.classList.add(amb);
    if (ambientSelect) ambientSelect.value = amb;
  }
  // theme
  const isDark = localStorage.getItem(LS.theme) === "true";
  if (isDark) document.body.classList.add("dark");
}

// ---------- Timer UI ----------
function setMode(mode) {
  if (!modes[mode]) return;
  activeMode = mode;
  modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  totalSeconds = Math.max(1, modes[mode].minutes) * 60;
  remainingSeconds = totalSeconds;
  updateDisplay();
  setRingProgress(1);
}
function formatTime(sec) {
  const m = Math.floor(sec/60).toString().padStart(2,"0");
  const s = Math.floor(sec%60).toString().padStart(2,"0");
  return `${m}:${s}`;
}
function updateDisplay() {
  if (typeof remainingSeconds !== "number" || remainingSeconds < 0) remainingSeconds = 0;
  timeDisplay.textContent = formatTime(remainingSeconds);
}
function setRingProgress(fraction) {
  if (!progressRing || !ringCircumference) return;
  fraction = Math.max(0, Math.min(1, typeof fraction === "number" ? fraction : 0));
  const offset = ringCircumference * (1 - fraction);
  progressRing.style.strokeDashoffset = offset;
}

// ---------- Timer controls ----------
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  totalSeconds = Math.max(1, modes[activeMode].minutes) * 60;
  if (typeof remainingSeconds !== "number" || remainingSeconds <= 0) remainingSeconds = totalSeconds;
  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      isRunning = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      if (activeMode === "study") {
        saveSessionCount(1,1);
        setMode("short");
      } else {
        setMode("study");
      }
      playBeep();
      return;
    }
    updateDisplay();
    const frac = totalSeconds ? ((totalSeconds - remainingSeconds) / totalSeconds) : 0;
    setRingProgress(frac);
  }, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timerInterval);
  isRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resetTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  totalSeconds = Math.max(1, modes[activeMode].minutes) * 60;
  remainingSeconds = totalSeconds;
  updateDisplay();
  setRingProgress(1);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

// audio helpers
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.05;
    o.start();
    setTimeout(()=>{ o.stop(); ctx.close(); }, 300);
  } catch (e) { /* ignore */ }
}
function playClick() {
  try {
    const a = new Audio("sounds/click.mp3");
    a.volume = 0.3;
    a.play().catch(()=>{});
  } catch(e) {}
}

// ---------- Events ----------
if (startBtn) startBtn.addEventListener("click", ()=>{ playClick(); startTimer(); });
if (pauseBtn) pauseBtn.addEventListener("click", ()=>{ playClick(); pauseTimer(); });
if (resetBtn) resetBtn.addEventListener("click", ()=>{ playClick(); resetTimer(); });

modeButtons.forEach(b => {
  b.addEventListener("click", () => {
    setMode(b.dataset.mode);
  });
});

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", () => {
    const s = Math.max(1, Math.floor(+studyMinInput.value || 25));
    const sh = Math.max(1, Math.floor(+shortMinInput.value || 5));
    const l = Math.max(1, Math.floor(+longMinInput.value || 15));
    modes.study.minutes = s;
    modes.short.minutes = sh;
    modes.long.minutes = l;
    localStorage.setItem(LS.settings, JSON.stringify({ study: s, short: sh, long: l }));
    resetTimer();
    alert("Settings saved.");
  });
}

// Focus toggle (click ring area)
const timerDisplayEl = document.querySelector(".timer-display");
if (timerDisplayEl) {
  timerDisplayEl.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
  });
}

// Ambient select
if (ambientSelect) {
  ambientSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "image") {
      if (imageInput) imageInput.click();
    } else {
      document.body.classList.remove("custom-image","ambience-1","ambience-2","ambience-3");
      document.body.classList.add(val);
      localStorage.setItem(LS.ambience, val);
    }
  });
}
if (imageInput) {
  imageInput.addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target.result;
      document.body.classList.add("custom-image");
      document.body.style.backgroundImage = `url(${url})`;
      localStorage.setItem(LS.ambience, "image");
      localStorage.setItem("vsr_custom_image_url", url);
    };
    reader.readAsDataURL(file);
  });
}

// sound select
if (soundSelect) {
  soundSelect.addEventListener("change", e => {
    const val = e.target.value;
    if (!val) { bgAudio.pause(); bgAudio.src = ""; return; }
    bgAudio.src = "sounds/" + val;
    bgAudio.play().catch(()=>{});
  });
}

// theme toggle
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem(LS.theme, isDark);
  });
}

// Goals add / actions
if (goalsForm) {
  goalsForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = goalInput.value.trim();
    const categoryEl = $('#goalCategory');
    const category = categoryEl ? categoryEl.value : 'Study';
    if (!text) return;
    const list = getGoals();
    list.push({ text, category, done: false });
    saveGoals(list);
    loadGoals();
    goalInput.value = "";
  });
}

if (goalsList) {
  goalsList.addEventListener("click", (ev) => {
    const li = ev.target.closest("li");
    if (!li) return;
    const idx = Number(li.dataset.idx);
    const list = getGoals();

    if (ev.target.matches(".del")) {
      list.splice(idx,1);
      saveGoals(list);
      loadGoals();
      return;
    }
    if (ev.target.matches(".edit")) {
      const newText = prompt("Edit goal:", list[idx].text);
      if (newText !== null) {
        list[idx].text = newText.trim();
        saveGoals(list);
        loadGoals();
      }
      return;
    }
    if (ev.target.matches(".goal-checkbox")) {
      list[idx].done = ev.target.checked;
      saveGoals(list);
      loadGoals();
      if (ev.target.checked) {
        // confetti if available
        try { confetti({ particleCount: 60, spread: 60 }); } catch (e) {}
      }
      return;
    }
  });
}

if (clearGoalsBtn) {
  clearGoalsBtn.addEventListener("click", () => {
    let list = getGoals();
    list = list.filter(g => !g.done);
    saveGoals(list);
    loadGoals();
  });
}

// session notes
if (sessionNotes) {
  sessionNotes.value = localStorage.getItem(LS.notes) || "";
  sessionNotes.addEventListener("input", (e) => {
    localStorage.setItem(LS.notes, e.target.value);
  });
}

// keyboard shortcuts
document.addEventListener("keydown", (e)=>{
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === "Space") { e.preventDefault(); isRunning ? pauseTimer() : startTimer(); }
  if (e.key === "r" || e.key === "R") resetTimer();
  if (e.key === "1") setMode("study");
  if (e.key === "2") setMode("short");
  if (e.key === "3") setMode("long");
});

// ------------- Stats & Streak -------------
function updateStats() {
  const sessions = JSON.parse(localStorage.getItem(LS.sessions) || "{}");
  const completed = sessions.completed || 0;
  const mins = completed * modes.study.minutes;
  $("#statsToday").textContent = `Today's Focus: ${mins} mins`;
  $("#statsPomodoros").textContent = `Pomodoros Completed: ${completed}`;
}
function updateStreak() {
  const now = new Date().toISOString().slice(0,10);
  let data = JSON.parse(localStorage.getItem(LS.streak) || "{}");
  if (!data.lastDay) {
    data = { streak: 0, lastDay: now };
  }
  if (data.lastDay !== now) {
    // if lastDay is yesterday -> increase else reset
    const diff = Math.round((new Date(now) - new Date(data.lastDay)) / 86400000);
    if (diff === 1) data.streak = (data.streak || 0) + 1;
    else data.streak = 1;
    data.lastDay = now;
    localStorage.setItem(LS.streak, JSON.stringify(data));
  }
  streakDisplay.textContent = data.streak || 0;
}
// initial update
updateStreak();

// ---------- Quotes ----------
function showQuote() {
  if (!quoteBox) return;
  quoteBox.textContent = quotes[Math.floor(Math.random()*quotes.length)];
}
showQuote();
setInterval(showQuote, 60_000);

// ---------- Simple weekly chart ----------
let chart = null;
function initChart() {
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  const saved = JSON.parse(localStorage.getItem(LS.chart) || '[]');
  const labels = saved.map(d => d.day).slice(-7);
  const data = saved.map(d => d.pomos).slice(-7);
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      datasets: [{ label: 'Pomodoros', data: data.length ? data : [0,0,0,0,0,0,0], backgroundColor: 'rgba(108,99,255,0.8)' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero:true, precision:0 } },
      plugins: { legend: { display: false } }
    }
  });
}
function updateChartData(recentAdd = 0) {
  try {
    const today = new Date().toISOString().slice(0,10);
    let arr = JSON.parse(localStorage.getItem(LS.chart) || '[]');
    const existing = arr.find(a => a.day === today);
    if (existing) existing.pomos += recentAdd;
    else arr.push({ day: today, pomos: recentAdd || 0 });
    // keep last 14 days
    arr = arr.slice(-14);
    localStorage.setItem(LS.chart, JSON.stringify(arr));
    if (chart) {
      const labels = arr.map(d => d.day).slice(-7);
      const dat = arr.map(d => d.pomos).slice(-7);
      chart.data.labels = labels;
      chart.data.datasets[0].data = dat;
      chart.update();
    }
  } catch(e){ console.warn("updateChartData:", e); }
}

// ---------- Init sequence ----------
loadSettings();
loadSessions();
loadGoals();
loadAmbient();
setMode("study");
if (pauseBtn) pauseBtn.disabled = true;
updateStats();
initChart();

// restore notes on load (already set), update streak display
updateStreak();
// === Export / Import Stats (client-only) ===
const exportStatsBtn = document.getElementById('exportStatsBtn');
const importStatsInput = document.getElementById('importStatsInput');
const importStatsBtn = document.getElementById('importStatsBtn');

exportStatsBtn && exportStatsBtn.addEventListener('click', () => {
  const exportObject = {
    sessions: JSON.parse(localStorage.getItem(LS.sessions) || '{}'),
    goals: JSON.parse(localStorage.getItem(LS.goals) || '[]'),
    chart: JSON.parse(localStorage.getItem(LS.chart) || '[]'),
    streak: JSON.parse(localStorage.getItem(LS.streak) || '{}'),
    notes: localStorage.getItem(LS.notes) || ''
  };
  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vsr_stats_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importStatsBtn && importStatsBtn.addEventListener('click', () => importStatsInput.click());
importStatsInput && importStatsInput.addEventListener('change', (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.sessions) localStorage.setItem(LS.sessions, JSON.stringify(imported.sessions));
      if (imported.goals) localStorage.setItem(LS.goals, JSON.stringify(imported.goals));
      if (imported.chart) localStorage.setItem(LS.chart, JSON.stringify(imported.chart));
      if (imported.streak) localStorage.setItem(LS.streak, JSON.stringify(imported.streak));
      if (typeof imported.notes === 'string') localStorage.setItem(LS.notes, imported.notes);
      // refresh UI (call existing functions)
      loadSessions();
      loadGoals();
      updateStats();
      if (chart) updateChartData(0);
      alert('Import successful — UI refreshed.');
    } catch (err) {
      alert('Failed to import: invalid JSON.');
      console.error(err);
    }
  };
  reader.readAsText(file);
});
