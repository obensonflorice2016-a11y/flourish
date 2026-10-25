import {
  VERSION,
  addDays,
  blankBlock,
  blocksForDay,
  blankGoal,
  blankSchool,
  dateKey,
  daysBetween,
  freshState,
  mottoFor,
  nextOn,
  nextStatus,
  normalize,
  priorityFor,
  resolvedDay,
  uid,
  weekday,
} from "./data.js";
import { dialogHtml, dumpSheet, esc, goalsView, planView, todayView, trackView, wheelPoint, cloudSheet } from "./views.js";
import { helpList, helpView, TOUR, TOUR_KEY, tourHtml } from "./help.js";
import { bindCloud, cloudBoot, cloudSignOut, openCloudRestore, pullCloudFile, scheduleCloud, startSignIn } from "./cloud.js";

const FALLBACK_KEY = "flourish-device-v1";
const LEGACY_KEYS = ["flourish-balance-v1", "flourish-rituals-v3", "flourish-rituals-v2", "flourish-rituals-v1"];
const TABS = ["today", "plan", "goals", "track", "help"];
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const ANCHOR = ["20261011", "20261012", "20261013", "20261014", "20261015", "20261016", "20261017"];
const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let S = freshState();
let tab = "today";
let sheet = "";
let openGoal = "";
let openSchool = "";
let planWd = 2;
let planScope = "template";
let planDate = "";
let pick = null;
let confirm = "";
let banner = "";
let pendingImport = null;
let importWarn = "";
let installEvent = null;
let drag = null;
let saveTimer = 0;
let helpQuery = "";
let tourStep = null;
let lastDate = "";
let baselineEdit = false;
let wheelTip = "";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("flourish", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("kv", "readonly").objectStore("kv").get("app");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, "app");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function readLegacy() {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const state = parsed.state || parsed;
      if (state && (state.goals || state.logs)) return state;
    } catch {
      /* skip */
    }
  }
  const fallback = localStorage.getItem(FALLBACK_KEY);
  if (!fallback) return null;
  try {
    return JSON.parse(fallback);
  } catch {
    return null;
  }
}
async function loadState() {
  try {
    const stored = await idbGet();
    if (stored) return normalize(stored);
  } catch {
    /* IndexedDB unavailable */
  }
  const legacy = readLegacy();
  if (legacy) return normalize(legacy);
  return freshState();
}
function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 180);
}
let cloudList = null;

async function saveNow(skipCloud) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(S));
  } catch {
    /* private mode */
  }
  try {
    await idbSet(S);
  } catch {
    /* fallback already written */
  }
  if (!skipCloud) scheduleCloud();
}
function snapshot() {
  return { tab, sheet, openGoal, openSchool, planWd, planScope, planDate, pick, confirm, baselineEdit, wheelTip };
}
function render() {
  const today = dateKey();
  if (!planDate) planDate = today;
  const root = document.querySelector("#screen");
  const motto = document.querySelector("#motto");
  if (motto) motto.textContent = mottoFor(today, S.mottos);
  applyTheme();
  const ui = snapshot();
  const view = tab === "plan" ? planView(S, today, ui) : tab === "goals" ? goalsView(S, today, ui) : tab === "track" ? trackView(S, today, ui) : tab === "help" ? helpView(helpQuery) : todayView(S, today);
  const bits = [];
  if (banner) bits.push(`<p class="banner">${esc(banner)}</p>`);
  if (tab === "today" && backupDue(today)) {
    bits.push(`<section class="card cream"><p class="kicker">Sunday backup</p><p>Save a copy into Google Drive or OneDrive. Last backup: ${esc(backupAgoLine(today))}.</p><button type="button" class="wide-btn" data-act="export">Back up to file</button></section>`);
  }
  root.innerHTML = `<div class="rise">${bits.join("")}${view}</div>`;
  document.querySelector("#overlay").innerHTML = `${sheet === "dump" ? dumpSheet(S, today, pick) : ""}${sheet === "cloud" ? cloudSheet(cloudList || []) : ""}${dialogHtml(pendingImport, importWarn)}${tourStep == null ? "" : tourHtml(tourStep)}`;
  const step = tourStep == null ? null : TOUR[tourStep];
  document.querySelectorAll("#nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
    button.classList.toggle("tour-spot", !!step && !step.spotlight && button.dataset.tab === step.tab);
  });
  const dump = document.querySelector("#dump");
  const count = (S.inbox || []).length;
  dump.textContent = count ? `Brain dump · ${count}` : "Brain dump";
  dump.classList.toggle("tour-spot", !!step && step.spotlight === "dump");
  document.querySelector("#theme").textContent = document.documentElement.dataset.theme === "dark" ? "Light" : "Dark";
  paintLive();
  paintQr();
  if (step && step.scroll) requestAnimationFrame(() => document.querySelector("#phone-card")?.scrollIntoView({ block: "center" }));
}
function backupDue(today) {
  const sunday = new Date(`${today}T12:00:00`).getDay() === 0;
  if (!S.lastExport) return sunday;
  if (sunday && S.lastExport !== today) return true;
  return daysBetween(S.lastExport, today) >= 7;
}
function backupAgoLine(today) {
  if (!S.lastExport) return "not yet";
  const n = daysBetween(S.lastExport, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}
function paintLive() {
  const today = dateKey();
  document.querySelectorAll("[data-live='count']").forEach((el) => {
    if (!el.dataset.date) return;
    el.textContent = el.dataset.date ? countdownSafe(today, el.dataset.date) : "";
  });
}
function countdownSafe(from, to) {
  if (!to) return "";
  const n = daysBetween(from, to);
  if (n > 1) return `${n} days`;
  if (n === 1) return "Tomorrow";
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return `${Math.abs(n)} days ago`;
}
function applyTheme() {
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = S.theme || system;
}
function dayModel() {
  if (planScope === "once") return ensureDayEdit(planDate || dateKey());
  return S.schedule[planWd];
}
function ensureDayEdit(date) {
  if (!S.dayEdits[date]) {
    const template = S.schedule[weekday(date)];
    S.dayEdits[date] = {
      free: !!template.free,
      workStart: template.workStart || "",
      workEnd: template.workEnd || "",
      priorityKind: template.priorityKind || "custom",
      priority: template.priority || "",
      goalId: template.goalId || "",
      blocks: (template.blocks || []).map((item) => ({ ...item })),
    };
  }
  return S.dayEdits[date];
}
function move(list, index, dir) {
  const next = index + dir;
  if (next < 0 || next >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
}
function setScore(area, value) {
  if (baselineEdit) {
    const base = S.wheel[0];
    base.scores[area] = value;
    return;
  }
  let last = S.wheel[S.wheel.length - 1];
  if (!last || last === S.wheel[0]) {
    S.wheel.push({ date: dateKey(), scores: { ...(S.wheel[0].scores || {}) } });
    last = S.wheel[S.wheel.length - 1];
  }
  last.scores[area] = value;
}
function applyBind(el) {
  const bind = el.dataset.bind;
  if (bind === "why") S.why = el.value;
  else if (bind === "vision") S.vision = el.value;
  else if (bind === "motto") S.mottos[Number(el.dataset.i)] = el.value;
  else if (bind === "priority-day") S.priorityText[el.dataset.date] = el.value;
  else if (bind === "note") S.notes[el.dataset.tue] = el.value;
  else if (bind === "next") S.nextWeek[el.dataset.tue] = el.value;
  else if (bind === "work") dayModel()[el.dataset.field] = el.value;
  else if (bind === "kind") dayModel().priorityKind = el.value;
  else if (bind === "priority-template") dayModel().priority = el.value;
  else if (bind === "goal-link") dayModel().goalId = el.value;
  else if (bind === "block") {
    const item = (dayModel().blocks || []).find((block) => block.id === el.dataset.id);
    if (item) item[el.dataset.field] = el.value;
  } else if (bind === "goal") {
    const goal = S.goals.find((item) => item.id === el.dataset.id);
    if (goal) goal[el.dataset.field] = el.value;
  } else if (bind === "goal-area") {
    const goal = S.goals.find((item) => item.id === el.dataset.id);
    if (goal) goal.area = el.value;
  } else if (bind === "school") {
    const school = S.schools.find((item) => item.id === el.dataset.id);
    if (!school) return;
    school[el.dataset.field] = el.dataset.field === "fee" ? Number(el.value) || 0 : el.value;
  } else if (bind === "step") {
    const step = S.atuSteps.find((item) => item.id === el.dataset.id);
    if (step) step.label = el.value;
  } else if (bind === "atu-date") S.atuDate = el.value;
  else if (bind === "check") {
    const item = S.checklist.find((row) => row.id === el.dataset.id);
    if (item) item[el.dataset.field] = el.value;
  } else if (bind === "area-label") {
    const area = S.areas.find((item) => item.id === el.dataset.id);
    if (area) area.label = el.value;
    const spoke = document.querySelector(`[data-spoke="${el.dataset.id}"]`);
    if (spoke) {
      const shown = baselineEdit ? S.wheel[S.wheel.length - 1] : S.wheel[S.wheel.length - 1];
      spoke.textContent = `${el.value} ${shown.scores[el.dataset.id] ?? 0}`;
    }
  } else if (bind === "score") {
    setScore(el.dataset.id, Number(el.value));
    const out = el.closest("li")?.querySelector("em");
    if (out) out.textContent = String(el.value);
    paintScore(el.dataset.id, Number(el.value));
  } else if (bind === "backup-time") S.backupTime = el.value || "10:00";
  else if (bind === "cloud-google" || bind === "cloud-microsoft") {
    const key = bind === "cloud-google" ? "google" : "microsoft";
    S.cloudClients = { google: (S.cloudClients && S.cloudClients.google) || "", microsoft: (S.cloudClients && S.cloudClients.microsoft) || "", [key]: el.value.trim() };
  }
}
function dayComplete(date) {
  const day = resolvedDay(date, S);
  const tracks = [...new Set(day.blocks.map((item) => item.track).filter(Boolean))];
  if (day.free || !tracks.length) return false;
  const log = S.logs[date] || {};
  return tracks.every((track) => log[track]);
}
function onClick(event) {
  const button = event.target.closest("[data-act]");
  if (!button || button.closest("textarea, input, select")) return;
  const act = button.dataset.act;
  if (act === "stop") return;
  const today = dateKey();
  if (act === "close") {
    sheet = "";
    pick = null;
  } else if (act === "goto") {
    tab = button.dataset.tab || "plan";
    sheet = "";
    banner = "";
  } else if (act === "toggle") {
    const date = button.dataset.date;
    const field = button.dataset.field;
    const next = !S.logs[date]?.[field];
    S.logs[date] = { ...(S.logs[date] || {}), [field]: next };
    if (next && date === today && dayComplete(today)) celebrate("Today is kept. Rest is still allowed.");
    else if (next && date === today && field === "priority") celebrate("That’s the one thing.");
    else if (next && date === today && field === "exercise") celebrate("Twenty minutes, chosen.");
    else if (next && date === today && field === "care") celebrate("Thirty minutes, just for you.");
    else if (next && date === today && field === "review") celebrate("Five quiet minutes. That is enough.");
  } else if (act === "release") {
    S.logs[button.dataset.date] = { ...(S.logs[button.dataset.date] || {}), released: true };
    banner = "Let go. It does not follow you.";
  } else if (act === "add-today") {
    const date = button.dataset.date || today;
    const edit = ensureDayEdit(date);
    edit.free = false;
    edit.blocks = edit.blocks || [];
    edit.blocks.push(blankBlock());
    banner = "Added for that day only. The template is unchanged.";
  } else if (act === "priority-reset") {
    delete S.priorityText[button.dataset.date];
    banner = "Back to the usual line.";
  } else if (act === "priority-usual") {
    const date = button.dataset.date;
    const wd = weekday(date);
    const text = (S.priorityText[date] || "").trim() || priorityFor(date, S);
    S.schedule[wd].priority = text;
    S.schedule[wd].priorityKind = "custom";
    delete S.priorityText[date];
    banner = `That line is now every ${WEEK[wd]}.`;
  } else if (act === "plan-wd") {
    planWd = Number(button.dataset.wd);
    planDate = nextOn(today, planWd);
    planScope = "template";
  } else if (act === "scope") {
    planScope = button.dataset.scope === "once" ? "once" : "template";
    planDate = nextOn(today, planWd);
  } else if (act === "free") {
    const model = dayModel();
    model.free = !model.free;
  } else if (act === "mode") {
    S.modes[button.dataset.tue] = button.dataset.mode;
  } else if (act === "block-add") {
    dayModel().blocks.push(blankBlock());
  } else if (act === "block-del" || act === "block-up" || act === "block-down") {
    const blocks = dayModel().blocks;
    const index = blocks.findIndex((item) => item.id === button.dataset.id);
    if (index < 0) return;
    if (act === "block-del") blocks.splice(index, 1);
    else move(blocks, index, act === "block-up" ? -1 : 1);
  } else if (act === "revert-day") {
    delete S.dayEdits[button.dataset.date];
    planScope = "template";
    banner = "This date follows the template again.";
  } else if (act === "goal-open") {
    openGoal = openGoal === button.dataset.id ? "" : button.dataset.id;
    confirm = "";
  } else if (act === "goal-add") {
    const goal = blankGoal();
    S.goals.unshift(goal);
    openGoal = goal.id;
  } else if (act === "goal-status") {
    const goal = S.goals.find((item) => item.id === button.dataset.id);
    if (goal) goal.status = nextStatus(goal.status);
  } else if (act === "goal-move") {
    const index = S.goals.findIndex((item) => item.id === button.dataset.id);
    move(S.goals, index, Number(button.dataset.dir));
  } else if (act === "goal-del") {
    if (confirm !== button.dataset.id) confirm = button.dataset.id;
    else {
      S.goals = S.goals.filter((item) => item.id !== button.dataset.id);
      confirm = "";
      openGoal = "";
    }
  } else if (act === "cap-del") {
    const goal = S.goals.find((item) => item.id === button.dataset.goal);
    if (goal) goal.captures = (goal.captures || []).filter((item) => item.id !== button.dataset.id);
  } else if (act === "book") S.books[button.dataset.month] = !S.books[button.dataset.month];
  else if (act === "posts") S.posts[button.dataset.tue] = !S.posts[button.dataset.tue];
  else if (act === "motto-add") S.mottos.push("A new line");
  else if (act === "motto-del") S.mottos.splice(Number(button.dataset.i), 1);
  else if (act === "school-open") {
    openSchool = openSchool === button.dataset.id ? "" : button.dataset.id;
    confirm = "";
  } else if (act === "school-add") {
    const school = blankSchool();
    S.schools.unshift(school);
    openSchool = school.id;
  } else if (act === "school") {
    const school = S.schools.find((item) => item.id === button.dataset.id);
    if (school) school.status = nextStatus(school.status);
  } else if (act === "school-optional") {
    const school = S.schools.find((item) => item.id === button.dataset.id);
    if (school) school.optional = !school.optional;
  } else if (act === "school-del") {
    if (confirm !== button.dataset.id) confirm = button.dataset.id;
    else {
      S.schools = S.schools.filter((item) => item.id !== button.dataset.id);
      confirm = "";
      openSchool = "";
    }
  } else if (act === "atu") {
    const step = S.atuSteps.find((item) => item.id === button.dataset.id);
    if (step) step.status = nextStatus(step.status);
  } else if (act === "atu-add") S.atuSteps.push({ id: uid("step"), label: "New step", status: "not-started" });
  else if (act === "atu-del") S.atuSteps = S.atuSteps.filter((item) => item.id !== button.dataset.id);
  else if (act === "check") {
    const item = S.checklist.find((row) => row.id === button.dataset.id);
    if (item) item.done = !item.done;
  } else if (act === "check-add") S.checklist.push({ id: uid("check"), label: "New line", detail: "", done: false });
  else if (act === "check-del") S.checklist = S.checklist.filter((item) => item.id !== button.dataset.id);
  else if (act === "rescore") {
    const last = S.wheel[S.wheel.length - 1];
    if (!last || last.date !== today) S.wheel.push({ date: today, scores: { ...(last?.scores || {}) } });
    banner = "This month has its own scores. The baseline stays.";
  } else if (act === "focus") {
    S.focus = S.focus.includes(button.dataset.id) ? S.focus.filter((id) => id !== button.dataset.id) : [...S.focus, button.dataset.id];
  } else if (act === "sort") {
    const item = S.inbox.find((row) => row.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.bin === "goal" || button.dataset.bin === "day") pick = { id: item.id, mode: button.dataset.bin };
    else fileInbox(item, button.dataset.bin);
  } else if (act === "file-goal") fileGoal(button.dataset.goal);
  else if (act === "file-day") fileDay(button.dataset.date);
  else if (act === "inbox-del") S.inbox = S.inbox.filter((item) => item.id !== button.dataset.id);
  else if (act === "task-toggle") {
    const task = S.tasks.find((item) => item.id === button.dataset.id);
    if (task) task.done = !task.done;
  } else if (act === "task-del" || act === "some-del") {
    const id = button.dataset.id;
    if (act === "task-del") S.tasks = S.tasks.filter((item) => item.id !== id);
    else S.someday = S.someday.filter((item) => item.id !== id);
  } else if (act === "task-date") {
    const task = S.tasks.find((item) => item.id === button.dataset.id);
    if (task) task.date = button.dataset.date;
  } else if (act === "export") return exportBackup();
  else if (act === "cloud-google") return startSignIn("google");
  else if (act === "cloud-microsoft") return startSignIn("microsoft");
  else if (act === "cloud-out") return cloudSignOut();
  else if (act === "cloud-restore") return showCloudRestore();
  else if (act === "cloud-file") return useCloudFile(button.dataset.id);
  else if (act === "import") {
    document.querySelector("#import-file")?.click();
    return;
  } else if (act === "import-no") {
    pendingImport = null;
    importWarn = "";
  } else if (act === "import-yes") {
    if (pendingImport) {
      S = normalize(pendingImport);
      pendingImport = null;
      importWarn = "";
      banner = "Backup restored on this phone.";
    }
  } else if (act === "notify") return enableNotifications();
  else if (act === "ics") return downloadIcs();
  else if (act === "install") return installApp();
  else if (act === "source") {
    saveSourceZip().catch(() => {
      banner = "The source zip could not be saved. Try again.";
      render();
    });
    return;
  } else if (act === "help-print") return printHelp();
  else if (act === "tour-start") return beginTour();
  else if (act === "tour-next") return advanceTour();
  else if (act === "tour-skip") return finishTour();
  else if (act === "tour-backup") {
    finishTour(true);
    return exportBackup();
  } else if (act === "baseline-edit") baselineEdit = !baselineEdit;
  else return;
  queueSave();
  render();
}
function fileInbox(item, bin) {
  if (bin === "task") S.tasks.unshift({ id: uid("task"), text: item.text, date: null, done: false });
  if (bin === "someday") S.someday.unshift({ id: uid("some"), text: item.text });
  S.inbox = S.inbox.filter((row) => row.id !== item.id);
  pick = null;
  banner = bin === "task" ? "Filed as a task, on Plan." : "Parked in Someday.";
}
function fileGoal(goalId) {
  const item = pick && S.inbox.find((row) => row.id === pick.id);
  if (!item) return;
  if (goalId === "new") {
    const goal = blankGoal(item.text.slice(0, 80));
    goal.weekly = item.text;
    S.goals.unshift(goal);
    openGoal = goal.id;
    tab = "goals";
    sheet = "";
    banner = "New goal. Set its area whenever you want.";
  } else {
    const goal = S.goals.find((row) => row.id === goalId);
    if (goal) goal.captures = [...(goal.captures || []), { id: uid("cap"), text: item.text }];
    banner = goal ? `Added to ${goal.title}.` : "Kept.";
  }
  S.inbox = S.inbox.filter((row) => row.id !== item.id);
  pick = null;
}
function fileDay(date) {
  const item = pick && S.inbox.find((row) => row.id === pick.id);
  if (!item) return;
  S.tasks.unshift({ id: uid("task"), text: item.text, date, done: false });
  S.inbox = S.inbox.filter((row) => row.id !== item.id);
  pick = null;
  banner = "It will be waiting on that day.";
}
function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-capture")) return;
  event.preventDefault();
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;
  S.inbox.unshift({ id: uid("note"), text, at: dateKey() });
  input.value = "";
  banner = "Kept in the inbox.";
  queueSave();
  render();
}
function celebrate(message) {
  banner = message;
  const canvas = document.querySelector("#confetti");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#5b2a72", "#f4efe6", "#f8f1e3", "#a67c45", "#efe4d2"];
  const bits = Array.from({ length: 64 }, () => ({
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.28,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * -8 - 2,
    s: 4 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * 6,
  }));
  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    bits.forEach((p) => {
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s * 0.5);
      ctx.restore();
    });
    if (++frame < 70) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) draw();
}
function crc32(data) {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function zipStore(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, data);
    const head = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(head.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    head.set(nameBytes, 46);
    central.push(head);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
async function offerFile(blob, name, shareText) {
  const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text: shareText });
      return "shared";
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
    }
  }
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const zip = name.endsWith(".zip");
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: zip ? "Zip" : "JSON", accept: zip ? { "application/zip": [".zip"] } : { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  return "downloaded";
}
function savedNote(how) {
  if (how === "shared") return "Choose Google Drive or OneDrive in the share sheet.";
  if (how === "saved") return "File saved. If that folder was Drive or OneDrive, it is backed up.";
  return "File saved. Move it into Google Drive or OneDrive when you can.";
}
function exportBackup() {
  const today = dateKey();
  const payload = { app: "Flourish", version: VERSION, exportedAt: new Date().toISOString(), data: { ...S, lastExport: today } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  offerFile(blob, `flourish-backup-${today}.json`, "Flourish backup. Save it in Google Drive or OneDrive.")
    .then((how) => {
      S.lastExport = today;
      queueSave();
      banner = savedNote(how);
      render();
    })
    .catch((error) => {
      if (error && error.name === "AbortError") return;
      banner = "The file could not be saved. Try again.";
      render();
    });
}
async function saveSourceZip() {
  const names = ["index.html", "styles.css", "app.js", "views.js", "data.js", "cloud.js", "help.js", "qrcode.js", "sw.js", "manifest.json", "favicon.svg", "README.md", "apple-touch-icon.png", "icon-180.png", "icon-192.png", "icon-512.png"];
  const files = [{ name: ".nojekyll", data: new Uint8Array() }];
  for (const name of names) {
    const response = await fetch(new URL(name, document.baseURI));
    if (!response.ok) throw new Error(name);
    files.push({ name, data: new Uint8Array(await response.arrayBuffer()) });
  }
  const how = await offerFile(zipStore(files), "flourish-source.zip", "Flourish source. Keep it in Drive or OneDrive.");
  banner = savedNote(how);
  render();
}
function onFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const data = parsed && parsed.app === "Flourish" && parsed.data ? parsed.data : parsed && parsed.state && parsed.state.goals ? parsed.state : parsed && parsed.goals ? parsed : null;
      if (!data) {
        banner = "That file is not a Flourish backup.";
        render();
        return;
      }
      const version = Number(parsed.version || data.version || 0);
      pendingImport = data;
      importWarn = version > VERSION ? "This backup is from a newer Flourish. Restoring may skip things this copy does not know yet." : "This backup overwrites goals, ticks, scores and deadlines on this device. Export first if you are unsure.";
      render();
    } catch {
      banner = "That file could not be read.";
      render();
    }
  };
  reader.readAsText(file);
}
async function enableNotifications() {
  if (!("Notification" in window)) {
    banner = "This browser cannot show alerts. Add to my calendar instead.";
    render();
    return;
  }
  const result = await Notification.requestPermission();
  banner = result === "granted" ? "Reminders can appear while Flourish is open, and on the Home Screen where the phone allows it." : "Reminders stay inside the app. The calendar can still buzz.";
  render();
}
function tickReminders() {
  const today = dateKey();
  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (now.getDay() === 0 && stamp === (S.backupTime || "10:00") && S.lastExport !== today && Notification.permission === "granted") notifyOnce(`backup-${today}`, "Sunday. Save a backup into Drive or OneDrive.");
  const day = resolvedDay(today, S);
  if (day.free || Notification.permission !== "granted") return;
  const log = S.logs[today] || {};
  for (const block of day.blocks) {
    if (block.start !== stamp || log[block.track]) continue;
    const body = block.track === "priority" ? priorityFor(today, S) : block.label;
    notifyOnce(`note-${today}-${block.start}-${block.track}`, `${block.label}. ${body}`);
  }
}
function notifyOnce(mark, body) {
  const key = `flourish-${mark}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  try {
    new Notification("Flourish", { body });
  } catch {
    /* ignore */
  }
}
function icsStamp(day, time) {
  return `${day}T${String(time || "09:00").replace(":", "")}00`;
}
function icsDate(key) {
  return String(key || "").replace(/-/g, "");
}
function icsEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function vevent({ uid: id, start, end, summary, description, rule, allDay }) {
  const lines = ["BEGIN:VEVENT", `UID:${id}@flourish`, `SUMMARY:${icsEscape(summary)}`];
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  if (allDay) lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`);
  else lines.push(`DTSTART:${start}`, `DTEND:${end}`);
  if (rule) lines.push(`RRULE:${rule}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}
function downloadIcs() {
  const events = [];
  S.schedule.forEach((day, index) => {
    if (day.free) return;
    for (const block of day.blocks || []) {
      events.push(vevent({
        uid: `block-${index}-${block.id}`,
        start: icsStamp(ANCHOR[index], block.start),
        end: icsStamp(ANCHOR[index], block.end || block.start),
        summary: `Flourish · ${block.label}`,
        description: block.track === "priority" ? day.priority || "Daily priority" : block.label,
        rule: `FREQ=WEEKLY;BYDAY=${BYDAY[index]}`,
      }));
    }
  });
  events.push(vevent({
    uid: "backup-sun",
    start: icsStamp("20261011", S.backupTime || "10:00"),
    end: icsStamp("20261011", S.backupTime || "10:00"),
    summary: "Flourish · back up to Drive",
    description: "Save a dated file, then put it in Google Drive or OneDrive.",
    rule: "FREQ=WEEKLY;BYDAY=SU",
  }));
  if (S.atuDate) {
    events.push(vevent({ uid: "atu", start: icsDate(S.atuDate), end: icsDate(addDays(S.atuDate, 1)), summary: "ATU Donegal", description: "Tuition, visa, travel.", allDay: true }));
  }
  for (const school of S.schools) {
    for (const date of [...new Set([school.priority, school.final].filter(Boolean))]) {
      events.push(vevent({
        uid: `${school.id}-${date}`,
        start: icsDate(date),
        end: icsDate(addDays(date, 1)),
        summary: `${school.school} · ${school.program}`,
        description: school.feeLabel || "",
        allDay: true,
      }));
    }
  }
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Flourish//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = `flourish-${dateKey()}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  banner = "Calendar file saved. Open it to add the alerts. It follows the template, not one-day changes.";
  render();
}
function installLink() {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname = url.pathname.replace(/[^/]*$/, "");
  return url.href;
}
function installApp() {
  if (installEvent) {
    installEvent.prompt();
    installEvent.userChoice.then((choice) => {
      installEvent = null;
      banner = choice.outcome === "accepted" ? "Installed. Open Flourish from your home screen." : "Install stays here whenever you want it.";
      render();
    });
    return;
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const android = /Android/.test(navigator.userAgent);
  banner = ios
    ? "In Safari, tap Share, then Add to Home Screen."
    : android
      ? "In Chrome, tap the menu, then Install app."
      : "In Chrome or Edge, tap the install icon in the address bar.";
  render();
}
function paintQr() {
  const box = document.querySelector("#install-qr");
  const maker = globalThis.qrcode;
  if (!box || typeof maker !== "function") return;
  try {
    const code = maker(0, "M");
    code.addData(installLink());
    code.make();
    box.innerHTML = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch {
    box.textContent = installLink();
  }
}
function onWheelDown(event) {
  const handle = event.target.closest?.("[data-index]");
  const svg = event.target.closest?.("svg.wheel");
  if (!handle || !svg) return;
  drag = { index: Number(handle.dataset.index), svg, moved: false, x: event.clientX, y: event.clientY };
  svg.setPointerCapture?.(event.pointerId);
}
function onWheelMove(event) {
  if (!drag) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
  drag.moved = true;
  const pt = drag.svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const mapped = pt.matrixTransform(drag.svg.getScreenCTM().inverse());
  const count = S.areas.length;
  const angle = -Math.PI / 2 + (drag.index * 2 * Math.PI) / count;
  const projected = (mapped.x - 120) * Math.cos(angle) + (mapped.y - 120) * Math.sin(angle);
  const score = Math.max(0, Math.min(10, Math.round((projected / 78) * 10)));
  const area = S.areas[drag.index];
  if (!area) return;
  setScore(area.id, score);
  paintScore(area.id, score);
}
function onWheelUp() {
  if (!drag) return false;
  const info = drag;
  drag = null;
  const area = S.areas[info.index];
  if (area) wheelTip = area.id;
  if (info.moved) queueSave();
  render();
  return true;
}
function paintScore(areaId, value) {
  const svg = document.querySelector("svg.wheel");
  if (!svg) return;
  const count = S.areas.length;
  const index = S.areas.findIndex((area) => area.id === areaId);
  if (index < 0) return;
  const source = baselineEdit ? S.wheel[0] : S.wheel[S.wheel.length - 1];
  const poly = svg.querySelector(baselineEdit ? ".ghost" : ".now");
  if (poly) poly.setAttribute("points", S.areas.map((item, itemIndex) => wheelPoint(itemIndex, source.scores[item.id] || 0, count).join(",")).join(" "));
  const [x, y] = wheelPoint(index, value, count);
  svg.querySelectorAll(`[data-index="${index}"] circle`).forEach((circle) => {
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
  });
  const area = S.areas[index];
  const shown = S.wheel[S.wheel.length - 1].scores[areaId] ?? 0;
  const label = document.querySelector(`[data-spoke="${areaId}"]`);
  if (label) label.textContent = `${area.label} ${shown}`;
  if (wheelTip === areaId) {
    const tip = document.querySelector("#wheel-tip");
    const tipValue = baselineEdit ? value : shown;
    if (tip) tip.textContent = `${area.label} ${tipValue}`;
  }
}

async function showCloudRestore() {
  cloudList = await openCloudRestore();
  sheet = "cloud";
  render();
}
async function useCloudFile(id) {
  try {
    const result = await pullCloudFile(id);
    pendingImport = result.data;
    importWarn = result.version > VERSION ? "This backup is from a newer Flourish. Restoring may skip things this copy does not know yet." : "This cloud copy replaces goals, ticks, scores and deadlines on this phone.";
    sheet = "";
    render();
  } catch {
    banner = "That cloud file could not be read. Everything already on this phone is unchanged.";
    render();
  }
}
function scrubWorkouts() {
  let changed = false;
  (S.schedule || []).forEach((day, index) => {
    if (!day || !Array.isArray(day.blocks)) return;
    const next = blocksForDay(day.blocks, index);
    if (next.length !== day.blocks.length) {
      day.blocks = next;
      changed = true;
    }
  });
  for (const [key, day] of Object.entries(S.dayEdits || {})) {
    if (!day || !Array.isArray(day.blocks)) continue;
    const next = blocksForDay(day.blocks, weekday(key));
    if (next.length !== day.blocks.length) {
      day.blocks = next;
      changed = true;
    }
  }
  return changed;
}
async function boot() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  S = await loadState();
  scrubWorkouts();
  if (!Array.isArray(S.focus)) S.focus = ["lifestyle", "financial", "relationships"];
  planWd = weekday(dateKey());
  planDate = dateKey();
  lastDate = dateKey();
  bindCloud({
    state: () => S,
    patch: (partial) => {
      Object.assign(S, partial);
      void saveNow(true);
      render();
    },
    note: (message) => {
      banner = message;
      render();
    },
    reveal: () => {
      document.querySelector("#cloud-card")?.scrollIntoView({ block: "center" });
      document.querySelector("[data-bind=cloud-google]")?.focus();
    },
  });
  await saveNow(true);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  document.querySelector("#nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    tab = button.dataset.tab;
    sheet = "";
    banner = "";
    render();
  });
  document.querySelector("#dump").addEventListener("click", () => {
    sheet = sheet === "dump" ? "" : "dump";
    pick = null;
    render();
  });
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("input", (event) => {
    const el = event.target;
    if (el.id === "help-q") {
      helpQuery = el.value;
      const list = document.querySelector("#help-list");
      if (list) list.innerHTML = helpList(helpQuery);
      return;
    }
    if (!el.dataset || !el.dataset.bind) return;
    if (el.type === "time" || el.type === "date") return;
    applyBind(el);
    queueSave();
  });
  document.body.addEventListener("change", (event) => {
    if (event.target.id === "import-file") return onFile(event);
    if (!event.target.dataset || !event.target.dataset.bind) return;
    applyBind(event.target);
    queueSave();
    if (event.target.dataset.bind === "kind" || event.target.dataset.bind === "goal-area" || event.target.type === "date") render();
  });
  document.querySelector("#theme").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    S.theme = current === "dark" ? "light" : "dark";
    applyTheme();
    queueSave();
    render();
  });
  const phone = document.querySelector("#phone");
  let touchX = 0;
  phone.addEventListener("pointerdown", (event) => {
    touchX = event.clientX;
    onWheelDown(event);
  });
  phone.addEventListener("pointermove", onWheelMove);
  phone.addEventListener("pointerup", (event) => {
    const dx = event.clientX - touchX;
    if (onWheelUp()) return;
    if (Math.abs(dx) < 80) return;
    if (event.target.closest("textarea, input, select, svg")) return;
    const index = TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (index < 0 || index >= TABS.length) return;
    tab = TABS[index];
    sheet = "";
    render();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
  });
  window.setInterval(tickReminders, 20000);
  window.setInterval(() => {
    const today = dateKey();
    if (today !== lastDate) {
      lastDate = today;
      render();
    } else paintLive();
  }, 1000);
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || !event.data || event.data.type !== "flourish-cloud") return;
    void cloudBoot();
  });
  render();
  if (!tourSeen() && !new URL(location.href).searchParams.get("code")) beginTour();
  try {
    await cloudBoot();
  } catch {
    /* the phone copy still works if the cloud step fails */
  }
}

function tourSeen() {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}
function beginTour() {
  tourStep = 0;
  tab = TOUR[0].tab;
  sheet = "";
  banner = "";
  render();
}
function advanceTour() {
  if (tourStep == null) return;
  if (tourStep >= TOUR.length - 1) return finishTour();
  tourStep += 1;
  tab = TOUR[tourStep].tab;
  sheet = "";
  render();
}
function finishTour(quiet) {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* the tour can still close */
  }
  tourStep = null;
  if (!quiet) render();
}
function printHelp() {
  document.body.classList.add("printing-help");
  const done = () => {
    document.body.classList.remove("printing-help");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

boot();
