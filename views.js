import {
  SHORT,
  WEEK,
  addDays,
  addMonths,
  areaLabel,
  blocksForDay,
  carriedItems,
  clock,
  countdown,
  dayTracks,
  feeTotal,
  formatDay,
  formatShort,
  keptStreak,
  linkedGoal,
  monthKey,
  nearestDeadline,
  nextOn,
  priorityFor,
  rescoreDue,
  resolvedDay,
  statusLabel,
  tuesdayKind,
  weekStats,
  weekTuesday,
  weekday,
} from "./data.js";

const KINDS = [
  ["atu", "ATU or PhD, alternating"],
  ["home", "Home"],
  ["skill", "Skill or business"],
  ["people", "Relationships"],
  ["cook", "Cooking and self-care"],
  ["custom", "My own line"],
  ["none", "No priority"],
];

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function box(done) {
  return `<span class="box ${done ? "on" : ""}" aria-hidden="true">${done ? "✓" : ""}</span>`;
}
function capture() {
  return `<form class="capture" data-capture><input name="thought" placeholder="Drop a thought, before it jumbles" aria-label="Brain dump" autocomplete="off" /><button type="submit">Keep</button></form>`;
}
function ring(done, total) {
  const c = 2 * Math.PI * 16;
  const pct = total ? done / total : 0;
  const dash = `${(pct * c).toFixed(1)} ${c.toFixed(1)}`;
  return `<svg viewBox="0 0 40 40" class="mini-ring" aria-hidden="true"><circle class="track" cx="20" cy="20" r="16"></circle><circle class="prog" cx="20" cy="20" r="16" stroke-dasharray="${dash}"></circle></svg>`;
}
function spokeLayout(areas, scores) {
  const W = 280;
  const wheelR = 54;
  const cx = 140;
  const cy = 190;
  const count = Math.max(1, areas.length);
  const boxes = [];
  const hitsWheel = (box) => {
    const x = Math.max(box.left, Math.min(cx, box.right));
    const y = Math.max(box.top, Math.min(cy, box.bottom));
    return Math.hypot(x - cx, y - cy) < wheelR + 6;
  };
  areas.forEach((area, index) => {
    const score = Number(scores[area.id] ?? 0);
    const text = `${area.label} ${score}`;
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side = Math.abs(cos) > 0.35;
    const width = side ? 78 : Math.min(150, Math.max(90, Math.ceil(text.length * 6.5)));
    const lines = Math.max(1, Math.ceil((text.length * 6.5) / width));
    const height = lines * 15;
    let radius = wheelR + 8;
    let box = null;
    for (let n = 0; n < 36; n += 1) {
      const x = cx + (radius + (side ? 0 : 10)) * cos;
      const y = cy + (radius + (side ? 18 : 0)) * sin;
      let left = cos > 0.35 ? x + 8 : cos < -0.35 ? x - width - 8 : x - width / 2;
      let top = sin > 0.5 ? y + 6 : sin < -0.5 ? y - height - 6 : y - height / 2;
      if (left < 2) left = 2;
      if (left + width > W - 2) left = W - width - 2;
      box = { id: area.id, text, left, top, right: left + width, bottom: top + height, width, height };
      const crowded = boxes.some((other) => box.left < other.right + 3 && box.right > other.left - 3 && box.top < other.bottom + 3 && box.bottom > other.top - 3);
      if (!crowded && !hitsWheel(box) && box.top > 0) break;
      radius += 8;
    }
    boxes.push(box);
  });
  const minY = Math.min(...boxes.map((box) => box.top), cy - wheelR);
  const maxY = Math.max(...boxes.map((box) => box.bottom), cy + wheelR);
  const shift = 8 - minY;
  return {
    W,
    H: maxY + shift + 8,
    cx,
    cy: cy + shift,
    wheelR,
    labels: boxes.map((box) => ({ ...box, top: box.top + shift, bottom: box.bottom + shift })),
  };
}
export function wheelPoint(index, value, count) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, count);
  const radius = (Math.max(0, Math.min(10, Number(value) || 0)) / 10) * 78;
  return [120 + radius * Math.cos(angle), 120 + radius * Math.sin(angle)];
}
function tone(date, today) {
  const n = date ? Math.round((new Date(date + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000) : 99;
  if (n < 0) return "hot";
  if (n <= 7) return "warm";
  return "cool";
}
function deadlineCard(item, today) {
  if (!item) return "";
  return `<section class="card cream tight ${tone(item.date, today)}"><p class="kicker">Nearest deadline</p><div class="split"><span><b>${esc(item.label)}</b><small>${esc(item.detail || "")}</small></span><b class="count" data-live="count" data-date="${esc(item.date)}">${esc(countdown(today, item.date))}</b></div></section>`;
}
function goalOptions(state, current) {
  const extra = current && !state.goals.some((goal) => goal.id === current) ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : "";
  return `<option value="">No goal yet</option>${extra}${state.goals.map((goal) => `<option value="${esc(goal.id)}"${goal.id === current ? " selected" : ""}>${esc(goal.title)}</option>`).join("")}`;
}
function areaOptions(state, current) {
  const known = state.areas.some((area) => area.id === current);
  const extra = current && !known ? `<option value="${esc(current)}" selected>${esc(areaLabel(state, current))}</option>` : "";
  return `${extra}${state.areas.map((area) => `<option value="${esc(area.id)}"${area.id === current ? " selected" : ""}>${esc(area.label)}</option>`).join("")}`;
}

export function todayView(state, today) {
  const day = resolvedDay(today, state);
  const text = priorityFor(today, state);
  const goal = linkedGoal(day, state);
  const log = state.logs[today] || {};
  const tracks = dayTracks(day);
  const done = tracks.filter((track) => log[track]).length;
  const stats = weekStats(today, state);
  const streak = keptStreak(today, state);
  const tasks = (state.tasks || []).filter((task) => task.date === today && !task.done);
  const carried = day.free ? [] : carriedItems(today, state);
  const tomorrow = addDays(today, 1);
  const next = resolvedDay(tomorrow, state);
  const override = !!(state.priorityText[today] && String(state.priorityText[today]).trim());
  const passed = dueLine(state, today);
  return `
    <p class="kicker">${esc(formatDay(today))}</p>
    <h1>${day.free ? "A free day" : "Today"}</h1>
    <p class="backup-line">Last backup: ${esc(backupAgo(state, today))}</p>
    <p class="backup-line">Last cloud backup: ${esc(cloudWhen(state.lastCloudAt))}</p>
    ${state.cloudProvider === "google" || state.cloudProvider === "microsoft" ? "" : `<button type="button" class="wide-btn" data-act="cloud-google">Sign in with Google</button>`}
    ${state.cloudError ? `<p class="banner">${esc(state.cloudError)}</p>` : ""}
    ${capture()}
    <p class="vision-line">${esc(state.vision)}</p>
    ${deadlineCard(nearestDeadline(state, today), today)}
    <div class="pulse">
      ${ring(done, tracks.length)}
      <div>
        <b>${day.free ? "Rest is the plan" : `${done} of ${tracks.length || 0} today`}</b>
        <small>${esc(stats.total ? `${stats.done} of ${stats.total} kept so far this week` : "The week is still opening")}${streak ? ` · ${streak} workday${streak === 1 ? "" : "s"} kept before today` : ""}</small>
      </div>
    </div>
    ${passed ? `<p class="banner">${esc(passed)}</p>` : ""}
    ${day.free ? freeDay(today) : workingDay(today, day, text, goal, log, override, state)}
    ${tasks.length ? `<section class="card white"><p class="kicker">From the inbox</p><ul class="list">${tasks.map((task) => taskRow(task)).join("")}</ul></section>` : ""}
    ${carried.length ? carriedBlock(carried) : ""}
    ${tomorrowBlock(tomorrow, next, state)}
  `;
}
function dueLine(state, today) {
  const now = new Date();
  if (dateKeyLocal(now) !== today) return "";
  const minutes = now.getHours() * 60 + now.getMinutes();
  const day = resolvedDay(today, state);
  const log = state.logs[today] || {};
  if (day.free) return "";
  const open = day.blocks.find((item) => {
    const [h, m] = String(item.start || "0:0").split(":").map(Number);
    return minutes >= h * 60 + m && !log[item.track];
  });
  if (!open) return "";
  return `${open.label} is still open, if you want it.`;
}
function dateKeyLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function freeDay(today) {
  return `<section class="card cream"><p>Nothing is scheduled. Sunday and Monday stay empty unless you choose otherwise.</p><button type="button" class="wide-btn ghost" data-act="add-today" data-date="${esc(today)}">Add something, just for today</button></section>`;
}
function workingDay(today, day, text, goal, log, override, state) {
  const work = day.workStart ? `Work is ${clock(day.workStart)} to ${clock(day.workEnd) || "later"}. It is not a task.` : "";
  return `
    <section class="card plum">
      <p class="kicker">The one priority</p>
      <textarea data-bind="priority-day" data-date="${esc(today)}" aria-label="Today's priority">${esc(text)}</textarea>
      <p class="soft">${goal ? `Moves ${esc(goal.title)}. This week: ${esc(goal.weekly || "add a weekly step on Goals.")}` : "Not tied to a goal yet. Plan can link it."}</p>
      <p class="hint">${override ? "This wording is just for today." : "Typing changes today only."}</p>
      <div class="tiny">
        <button type="button" data-act="priority-reset" data-date="${esc(today)}">Usual line</button>
        <button type="button" data-act="priority-usual" data-date="${esc(today)}">Every ${esc(WEEK[day.wd])}</button>
      </div>
    </section>
    <ul class="list">${day.blocks.map((item) => `<li><button type="button" class="item" data-act="toggle" data-date="${esc(today)}" data-field="${esc(item.track)}">${box(!!log[item.track])}<span><b>${esc(item.label)}</b><small>${esc(clock(item.start))} – ${esc(clock(item.end))}</small></span></button></li>`).join("")}</ul>
    ${work ? `<p class="soft gap">${esc(work)}</p>` : ""}
    ${day.edited ? `<p class="hint">This day has its own times.</p>` : ""}
    <button type="button" class="link" data-act="goto" data-tab="plan">Change the times</button>
    ${state ? "" : ""}
  `;
}
function taskRow(task) {
  return `<li><button type="button" class="item" data-act="task-toggle" data-id="${esc(task.id)}">${box(!!task.done)}<span><b>${esc(task.text)}</b><small>${task.date ? esc(formatShort(task.date)) : "No day yet"}</small></span></button></li>`;
}
function carriedBlock(items) {
  return `<section class="card white"><p class="kicker">Still open</p><p class="soft">From earlier days. Take one, or let it go. Nothing is late.</p><ul class="list">${items.map((item) => `<li class="split"><button type="button" class="item" data-act="toggle" data-date="${esc(item.date)}" data-field="priority">${box(false)}<span><b>${esc(item.text)}</b><small>${esc(formatShort(item.date))}</small></span></button><button type="button" class="pill" data-act="release" data-date="${esc(item.date)}">Let it go</button></li>`).join("")}</ul></section>`;
}
function tomorrowBlock(tomorrow, day, state) {
  const usual = priorityFor(tomorrow, state);
  return `<section class="card lilac"><p class="kicker">Tomorrow</p><h2>${esc(formatDay(tomorrow))}</h2>${day.free ? `<p>Nothing scheduled. It can stay that way.</p><button type="button" class="wide-btn ghost" data-act="add-today" data-date="${esc(tomorrow)}">Add something, just for tomorrow</button>` : `<textarea data-bind="priority-day" data-date="${esc(tomorrow)}" aria-label="Tomorrow's priority" placeholder="Leave blank to keep the usual line">${esc((state.priorityText[tomorrow] || "").trim())}</textarea><p class="hint">Usual line: ${esc(usual || "none")}</p>`}</section>`;
}

export function planView(state, today, ui) {
  const wd = ui.planWd;
  const date = ui.planDate || nextOn(today, wd);
  const template = state.schedule[wd];
  const edited = state.dayEdits[date];
  const model = ui.planScope === "once" && edited ? edited : template;
  const tue = weekTuesday(date);
  const kind = tuesdayKind(date, state.anchor, state.modes);
  const review = (state.schedule[6].blocks || []).find((item) => item.track === "review");
  const blocks = blocksForDay(model.blocks, weekday(date));
  const loose = (state.tasks || []).filter((task) => !task.done);
  return `
    <p class="kicker">Plan</p>
    <h1>The week, editable</h1>
    ${capture()}
    <section class="card cream"><p class="kicker">My why</p><textarea data-bind="why" aria-label="My why">${esc(state.why)}</textarea></section>
    <div class="week week-pick">${SHORT.map((name, index) => {
      const sample = resolvedDay(nextOn(today, index), state);
      return `<button type="button" data-act="plan-wd" data-wd="${index}" class="${index === wd ? "on" : ""}"><b>${name}</b><small>${sample.free ? "Free" : "Work"}</small></button>`;
    }).join("")}</div>
    <section class="card white">
      <p class="kicker">${ui.planScope === "once" ? `Only ${esc(formatDay(date))}` : `Every ${esc(WEEK[wd])}`}</p>
      <div class="modes">
        <button type="button" data-act="scope" data-scope="template" class="${ui.planScope === "template" ? "on" : ""}">Whole template</button>
        <button type="button" data-act="scope" data-scope="once" class="${ui.planScope === "once" ? "on" : ""}">Only ${esc(formatShort(date))}</button>
      </div>
      <button type="button" class="wide-btn ghost" data-act="free">${model.free ? "This day is free. Make it a work day" : "Make this a free day"}</button>
      ${model.free ? `<p class="soft gap">No tasks, unless you add a block below.</p>` : ""}
      <div class="editor">
        <label>Work starts <input type="time" data-bind="work" data-field="workStart" value="${esc(model.workStart || "")}" /></label>
        <label>Work ends <input type="time" data-bind="work" data-field="workEnd" value="${esc(model.workEnd || "")}" /></label>
        <label>Default priority
          <select data-bind="kind">${KINDS.map(([id, label]) => `<option value="${id}"${model.priorityKind === id ? " selected" : ""}>${label}</option>`).join("")}</select>
        </label>
        ${model.priorityKind === "atu" ? `<div class="modes"><button type="button" data-act="mode" data-mode="atu" data-tue="${esc(tue)}" class="${kind === "atu" ? "on" : ""}">ATU week</button><button type="button" data-act="mode" data-mode="phd" data-tue="${esc(tue)}" class="${kind === "phd" ? "on" : ""}">PhD week</button></div><p class="hint">This week's line: ${esc(priorityFor(date, state))}</p>` : `<label>The line <textarea data-bind="priority-template">${esc(model.priority || "")}</textarea></label>`}
        <label>Moves this goal <select data-bind="goal-link">${goalOptions(state, model.goalId)}</select></label>
      </div>
      <p class="kicker gold">Blocks</p>
      <ul class="list">${blocks.map((item, index) => blockEditor(item, index, blocks.length)).join("")}</ul>
      <button type="button" class="wide-btn ghost" data-act="block-add">Add a block</button>
      ${edited ? `<button type="button" class="link" data-act="revert-day" data-date="${esc(date)}">Use the template again for this date</button>` : ""}
    </section>
    ${reviewCard(state, today, review)}
    <section class="card white">
      <p class="kicker">Tasks</p>
      <p class="soft">Things you sorted out of the inbox. Give one a day, or leave it here.</p>
      ${loose.length ? `<ul class="list">${loose.map((task) => `<li><div class="item"><span><b>${esc(task.text)}</b><small>${task.date ? esc(formatDay(task.date)) : "Waiting"}</small></span></div><div class="tiny">${SHORT.map((name, index) => `<button type="button" data-act="task-date" data-id="${esc(task.id)}" data-date="${esc(nextOn(today, index))}">${name}</button>`).join("")}<button type="button" data-act="task-del" data-id="${esc(task.id)}">Remove</button></div></li>`).join("")}</ul>` : `<p class="hint">No loose tasks.</p>`}
    </section>
    <section class="card lilac">
      <p class="kicker">Someday</p>
      ${(state.someday || []).length ? `<ul class="list">${state.someday.map((item) => `<li class="split"><span>${esc(item.text)}</span><button type="button" class="pill" data-act="some-del" data-id="${esc(item.id)}">Remove</button></li>`).join("")}</ul>` : `<p class="hint">Nothing parked.</p>`}
    </section>
    ${phoneCard(state, today)}
  `;
}
function blockEditor(item) {
  return `<li class="block-edit"><input data-bind="block" data-id="${esc(item.id)}" data-field="label" value="${esc(item.label)}" aria-label="Block name" /><div class="times"><input type="time" data-bind="block" data-id="${esc(item.id)}" data-field="start" value="${esc(item.start)}" aria-label="Starts" /><input type="time" data-bind="block" data-id="${esc(item.id)}" data-field="end" value="${esc(item.end)}" aria-label="Ends" /></div><div class="tiny"><button type="button" data-act="block-up" data-id="${esc(item.id)}">Up</button><button type="button" data-act="block-down" data-id="${esc(item.id)}">Down</button><button type="button" data-act="block-del" data-id="${esc(item.id)}">Remove</button></div></li>`;
}
function plannedTuesday(today) {
  const wd = weekday(today);
  if (wd <= 1) return nextOn(today, 2);
  if (wd === 2) return addDays(today, 7);
  return addDays(weekTuesday(today), 7);
}
function reviewCard(state, today, review) {
  const tue = weekTuesday(today);
  const stats = weekStats(today, state);
  const nextTue = plannedTuesday(today);
  const kind = tuesdayKind(nextTue, state.anchor, state.modes);
  const when = review ? `${clock(review.start)} – ${clock(review.end)}` : "Add a review block on Saturday";
  return `<section class="card cream ${weekday(today) === 6 ? "today-review" : ""}"><p class="kicker">Weekly review · Saturday</p><h2>Five minutes, ${esc(when)}</h2><p class="soft">What moved. What next week needs. Whether the next Tuesday is ATU or PhD. So far: ${stats.done} of ${stats.total}.</p><label>What moved<textarea data-bind="note" data-tue="${esc(tue)}">${esc(state.notes[tue] || "")}</textarea></label><label>Next week<textarea data-bind="next" data-tue="${esc(tue)}">${esc(state.nextWeek[tue] || "")}</textarea></label><div class="modes"><button type="button" data-act="mode" data-mode="atu" data-tue="${esc(nextTue)}" class="${kind === "atu" ? "on" : ""}">Next Tuesday: ATU</button><button type="button" data-act="mode" data-mode="phd" data-tue="${esc(nextTue)}" class="${kind === "phd" ? "on" : ""}">Next Tuesday: PhD</button></div></section>`;
}
function backupAgo(state, today) {
  if (!state.lastExport) return "not yet";
  const phrase = countdown(today, state.lastExport);
  return phrase === "Today" ? "today" : phrase.toLowerCase();
}
function cloudWhen(iso) {
  if (!iso) return "not yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not yet";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return key === today ? `today, ${time}` : `${key}, ${time}`;
}
function cloudCard(state) {
  const clients = state.cloudClients || {};
  const signed = state.cloudProvider === "google" || state.cloudProvider === "microsoft";
  const where = state.cloudProvider === "microsoft" ? "OneDrive" : "Google Drive";
  let redirect = "";
  try {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    redirect = url.href;
  } catch {
    redirect = "";
  }
  return `<section class="card cream" id="cloud-card"><p class="kicker">Cloud</p><p class="soft">${signed ? `Signed in${state.cloudEmail ? ` as ${esc(state.cloudEmail)}` : ""}. A copy goes to Flourish Backups in ${esc(where)} when something changes, and at least once a day. The last 30 stay. Nothing is stored with Grok.` : "Sign in with your own Google or Microsoft account. Copies go only to your Drive, in a folder called Flourish Backups. Nothing is stored with Grok."}</p><p class="backup-line">Last cloud backup: ${esc(cloudWhen(state.lastCloudAt))}</p>${state.cloudError ? `<p class="banner">${esc(state.cloudError)}</p>` : ""}${signed ? `<button type="button" class="wide-btn" data-act="cloud-restore">Restore from cloud</button><button type="button" class="wide-btn ghost" data-act="cloud-out">Sign out of cloud</button>` : `<button type="button" class="wide-btn" data-act="cloud-google">Sign in with Google</button><p class="hint">Suggested account: obensonflorice2016@gmail.com</p><button type="button" class="wide-btn ghost" data-act="cloud-microsoft">Sign in with Microsoft</button><details ${state.cloudSetup || state.cloudError ? "open" : ""}><summary>Sign-in key, once</summary><p class="hint">Google and Microsoft ask for a key before a website may save into your Drive. Paste it here. It stays on this phone. Allow this redirect: ${esc(redirect)}</p><label>Google key<input data-bind="cloud-google" value="${esc(clients.google || "")}" autocomplete="off" /></label><label>Microsoft key<input data-bind="cloud-microsoft" value="${esc(clients.microsoft || "")}" autocomplete="off" /></label></details>`}</section>`;
}
function phoneCard(state, today) {
  return `<section class="card white" id="phone-card"><div class="split"><p class="kicker">This phone</p><button type="button" class="link" data-act="goto" data-tab="help">? Help</button></div>${cloudCard(state)}<p class="soft">The file is an extra copy. Save it straight into Google Drive or OneDrive from the share sheet, or from the save window on a computer.</p><p class="backup-line">Last backup: ${esc(backupAgo(state, today))}</p><button type="button" class="wide-btn" data-act="export">Back up to file</button><button type="button" class="wide-btn ghost" data-act="import">Restore from file</button><label>Weekly backup reminder <input type="time" data-bind="backup-time" value="${esc(state.backupTime || "10:00")}" /></label><p class="hint">Sunday, at that time. It is a reminder, not a task.</p><section class="card cream tight"><p class="kicker">New device</p><ol class="help-steps"><li>Open this link, or scan the code.</li><li>Install it. iPhone: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app. Windows: the install icon in Chrome or Edge.</li><li>Tap Restore from file, and choose the backup from Google Drive or OneDrive.</li></ol><div class="qr" id="install-qr" role="img" aria-label="QR code for this Flourish link"></div></section><button type="button" class="wide-btn ghost" data-act="notify">Turn on reminders</button><button type="button" class="wide-btn ghost" data-act="ics">Add to my calendar</button><button type="button" class="wide-btn ghost" data-act="install">Install on this device</button><p class="hint">Same link on iPhone, Android, and Windows.</p><button type="button" class="link" data-act="source">Save a source zip too</button></section>`;
}

export function goalsView(state, today, ui) {
  const open = state.goals.filter((goal) => goal.status === "in-progress").length;
  const done = state.goals.filter((goal) => goal.status === "done").length;
  return `
    <p class="kicker">Goals</p>
    <h1>Future me, then the ladder</h1>
    ${capture()}
    <section class="card plum"><p class="kicker">Future me</p><textarea data-bind="vision" aria-label="Future me">${esc(state.vision)}</textarea></section>
    <section class="card cream"><p class="kicker">Lines I keep</p>${state.mottos.map((motto, index) => `<div class="split"><input data-bind="motto" data-i="${index}" value="${esc(motto)}" aria-label="Motto ${index + 1}" /><button type="button" class="pill" data-act="motto-del" data-i="${index}">Remove</button></div>`).join("")}<button type="button" class="wide-btn ghost" data-act="motto-add">Add a line</button></section>
    <p class="soft gap">${done} done · ${open} in progress · the rest can wait</p>
    <button type="button" class="wide-btn" data-act="goal-add">Add a goal</button>
    <div class="stack-list">${state.goals.map((goal, index) => goalCard(state, goal, index, ui.openGoal === goal.id, today, ui)).join("")}</div>
  `;
}
function goalCard(state, goal, index, open, today, ui) {
  const last = state.goals.length - 1;
  return `<article class="card white">
    <button type="button" class="plain wide" data-act="goal-open" data-id="${esc(goal.id)}"><span><b>${esc(goal.title)}</b><small>${esc(areaLabel(state, goal.area))} · ${esc(statusLabel(goal.status))}</small></span></button>
    ${open ? `<div class="editor">
      <label>Name <input data-bind="goal" data-id="${esc(goal.id)}" data-field="title" value="${esc(goal.title)}" /></label>
      <label>Life area <select data-bind="goal-area" data-id="${esc(goal.id)}">${areaOptions(state, goal.area)}</select></label>
      <button type="button" class="pill ${esc(goal.status)}" data-act="goal-status" data-id="${esc(goal.id)}">${esc(statusLabel(goal.status))}</button>
      ${rung("Five years", goal, "five")}
      ${rung("This year", goal, "yearly")}
      ${rung("This quarter", goal, "quarterly")}
      ${rung("This month", goal, "monthly")}
      ${rung("This week", goal, "weekly")}
      ${goal.id === "books" ? `<button type="button" class="item" data-act="book" data-month="${esc(monthKey(today))}">${box(!!state.books[monthKey(today)])}<span><b>This month's book</b><small>Optional. Either finished or still open.</small></span></button>` : ""}
      ${goal.id === "posts" ? `<button type="button" class="item" data-act="posts" data-tue="${esc(weekTuesday(today))}">${box(!!state.posts[weekTuesday(today)])}<span><b>This week's post</b><small>One is enough.</small></span></button>` : ""}
      ${(goal.captures || []).map((item) => `<div class="split"><span>${esc(item.text)}</span><button type="button" class="pill" data-act="cap-del" data-goal="${esc(goal.id)}" data-id="${esc(item.id)}">Remove</button></div>`).join("")}
      <div class="tiny">
        <button type="button" data-act="goal-move" data-id="${esc(goal.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>Up</button>
        <button type="button" data-act="goal-move" data-id="${esc(goal.id)}" data-dir="1" ${index === last ? "disabled" : ""}>Down</button>
        <button type="button" data-act="goal-del" data-id="${esc(goal.id)}">${ui.confirm === goal.id ? "Yes, delete" : "Delete"}</button>
      </div>
    </div>` : `<p class="hint">${esc(goal.weekly || "Add a weekly step.")}</p>`}
  </article>`;
}
function rung(label, goal, field) {
  return `<label>${label}<textarea data-bind="goal" data-id="${esc(goal.id)}" data-field="${field}">${esc(goal[field] || "")}</textarea></label>`;
}

export function trackView(state, today, ui) {
  const current = state.wheel[state.wheel.length - 1];
  const baseline = state.wheel[0];
  const due = rescoreDue(state, today);
  const next = addMonths(current.date, 1);
  const near = nearestDeadline(state, today);
  const areas = state.areas;
  const points = areas.map((area, index) => wheelPoint(index, current.scores[area.id], areas.length).join(",")).join(" ");
  const ghost = areas.map((area, index) => wheelPoint(index, baseline.scores[area.id], areas.length).join(",")).join(" ");
  const handles = areas.map((area, index) => {
    const score = ui.baselineEdit ? baseline.scores[area.id] : current.scores[area.id];
    const [x, y] = wheelPoint(index, score, areas.length);
    return `<g data-index="${index}"><circle class="hit" cx="${x}" cy="${y}" r="14"></circle><circle class="dot" cx="${x}" cy="${y}" r="6"></circle></g>`;
  }).join("");
  const rings = areas.map((area, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / areas.length;
    const x2 = 120 + 78 * Math.cos(angle);
    const y2 = 120 + 78 * Math.sin(angle);
    return `<line x1="120" y1="120" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.2"></line>`;
  }).join("");
  const layout = spokeLayout(areas, current.scores);
  const wheelW = (layout.wheelR * 2 / layout.W) * 100;
  const wheelH = (layout.wheelR * 2 / layout.H) * 100;
  const wheelLeft = ((layout.cx - layout.wheelR) / layout.W) * 100;
  const wheelTop = ((layout.cy - layout.wheelR) / layout.H) * 100;
  const spokeLabels = layout.labels.map((box) => `<span class="spoke-label" data-spoke="${esc(box.id)}" style="left:${(box.left / layout.W) * 100}%;top:${(box.top / layout.H) * 100}%;width:${(box.width / layout.W) * 100}%">${esc(box.text)}</span>`).join("");
  const tipped = areas.find((area) => area.id === ui.wheelTip);
  const tipScore = tipped ? Number((ui.baselineEdit ? baseline.scores : current.scores)[tipped.id] ?? 0) : "";
  const schools = [...state.schools].sort((a, b) => String(a.final || a.priority).localeCompare(String(b.final || b.priority)));
  const openSteps = state.atuSteps.filter((step) => step.status !== "done").length;
  return `
    <p class="kicker">Trackers</p>
    <h1>The wheel, the move, the file</h1>
    ${capture()}
    ${deadlineCard(near, today)}
    <section class="card white">
      <p class="kicker">Life balance</p>
      <p class="soft">Baseline ${esc(formatDay(baseline.date))}. Drag a point, or use the sliders. This month's attention: ${esc(state.focus.map((id) => areaLabel(state, id)).join(", ") || "choose any")}.</p>
      <div class="wheel-plate">
        <div class="wheel-stage" style="aspect-ratio:${layout.W} / ${layout.H}">
          <svg class="wheel" viewBox="0 0 240 240" role="img" aria-label="Life balance wheel" style="left:${wheelLeft}%;top:${wheelTop}%;width:${wheelW}%;height:${wheelH}%">${rings}<polygon class="now" points="${points}"></polygon><polygon class="ghost" points="${ghost}"></polygon>${handles}</svg>
          ${spokeLabels}
        </div>
        <p class="wheel-legend"><span><i class="base-swatch"></i>Baseline</span><span><i class="today-swatch"></i>Today</span></p>
        <p class="wheel-tip" id="wheel-tip">${tipped ? `${esc(tipped.label)} ${tipScore}` : ""}</p>
      </div>
      <button type="button" class="wide-btn ghost" data-act="baseline-edit">${ui.baselineEdit ? "Done editing baseline" : "Edit baseline"}</button>
      ${ui.baselineEdit ? `<p class="hint">Editing the baseline. Today’s scores stay as they are.</p>` : ""}
      ${due ? `<button type="button" class="wide-btn" data-act="rescore">Start this month's scores</button>` : `<p class="hint">Next rescore ${esc(formatDay(next))}.</p>`}
      <ul class="scores">${areas.map((area) => scoreRow(state, area, current, baseline, ui.baselineEdit)).join("")}</ul>
    </section>
    <section class="card plum">
      <p class="kicker">ATU Donegal</p>
      <h2 data-live="count" data-date="${esc(state.atuDate)}">${esc(countdown(today, state.atuDate))}</h2>
      <p class="soft">${openSteps ? `${openSteps} step${openSteps === 1 ? "" : "s"} still open.` : "The steps are done."}</p>
    </section>
    <section class="card white">
      <label>Arrival <input type="date" data-bind="atu-date" value="${esc(state.atuDate)}" /></label>
      <ul class="list">${state.atuSteps.map((step) => `<li class="block-edit"><button type="button" class="item step-name" data-act="atu" data-id="${esc(step.id)}">${box(step.status === "done")}<span><b>${esc(statusLabel(step.status))}</b></span></button><input class="step-name" data-bind="step" data-id="${esc(step.id)}" value="${esc(step.label)}" aria-label="Step name" /><button type="button" class="pill step-name" data-act="atu-del" data-id="${esc(step.id)}">Remove</button></li>`).join("")}</ul>
      <button type="button" class="wide-btn ghost" data-act="atu-add">Add a step</button>
    </section>
    <section class="card white">
      <p class="kicker">US PhD, Fall 2027</p>
      <p class="soft">Required fees about $${Math.round(feeTotal(state.schools))}. Optional schools stay out of that sum.</p>
      <button type="button" class="wide-btn ghost" data-act="school-add">Add a school</button>
      <div class="stack-list">${schools.map((school) => schoolCard(school, today, ui.openSchool === school.id, ui)).join("")}</div>
      <p class="kicker">File checklist</p>
      <ul class="list">${state.checklist.map((item) => `<li><button type="button" class="item" data-act="check" data-id="${esc(item.id)}">${box(item.done)}<span><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></span></button><div class="editor"><input data-bind="check" data-id="${esc(item.id)}" data-field="label" value="${esc(item.label)}" aria-label="Checklist name" /><input data-bind="check" data-id="${esc(item.id)}" data-field="detail" value="${esc(item.detail)}" aria-label="Checklist note" /><button type="button" class="pill" data-act="check-del" data-id="${esc(item.id)}">Remove</button></div></li>`).join("")}</ul>
      <button type="button" class="wide-btn ghost" data-act="check-add">Add a checklist line</button>
    </section>
    ${insight(state, today)}
  `;
}
function scoreRow(state, area, current, baseline, editing) {
  const todayValue = Number(current.scores[area.id] ?? 0);
  const was = Number(baseline.scores[area.id] ?? 0);
  const value = editing ? was : todayValue;
  const on = state.focus.includes(area.id);
  const note = editing ? `Baseline ${value}. Today stays ${todayValue}.` : `Baseline ${was}. Today ${todayValue}.`;
  return `<li><div class="split"><input data-bind="area-label" data-id="${esc(area.id)}" value="${esc(area.label)}" aria-label="Area name" /><button type="button" class="pill ${on ? "in-progress" : ""}" data-act="focus" data-id="${esc(area.id)}">${on ? "This month" : "Anytime"}</button></div><div class="split"><input type="range" min="0" max="10" step="1" data-bind="score" data-id="${esc(area.id)}" value="${value}" aria-label="${esc(area.label)} score" /><em>${value}</em></div><small>${note}</small></li>`;
}
function schoolCard(school, today, open, ui) {
  const when = school.priority && school.priority >= today ? school.priority : school.final;
  return `<article class="card cream tight">
    <button type="button" class="plain wide" data-act="school-open" data-id="${esc(school.id)}"><span><b>${esc(school.school)}</b><small>${esc(school.program)} · ${esc(statusLabel(school.status))}${school.optional ? " · optional" : ""}</small></span><b data-live="count" data-date="${esc(when || "")}">${when ? esc(countdown(today, when)) : ""}</b></button>
    ${open ? `<div class="editor">
      <input data-bind="school" data-id="${esc(school.id)}" data-field="school" value="${esc(school.school)}" aria-label="School" />
      <input data-bind="school" data-id="${esc(school.id)}" data-field="program" value="${esc(school.program)}" aria-label="Program" />
      <label>Priority date <input type="date" data-bind="school" data-id="${esc(school.id)}" data-field="priority" value="${esc(school.priority || "")}" /></label>
      <label>Final date <input type="date" data-bind="school" data-id="${esc(school.id)}" data-field="final" value="${esc(school.final || "")}" /></label>
      <label>Fee note <input data-bind="school" data-id="${esc(school.id)}" data-field="feeLabel" value="${esc(school.feeLabel)}" /></label>
      <label>Fee number <input type="number" min="0" step="0.01" data-bind="school" data-id="${esc(school.id)}" data-field="fee" value="${esc(school.fee)}" /></label>
      <div class="tiny">
        <button type="button" class="pill ${esc(school.status)}" data-act="school" data-id="${esc(school.id)}">${esc(statusLabel(school.status))}</button>
        <button type="button" class="pill" data-act="school-optional" data-id="${esc(school.id)}">${school.optional ? "Optional" : "Required"}</button>
        <button type="button" data-act="school-del" data-id="${esc(school.id)}">${ui.confirm === school.id ? "Yes, remove" : "Remove"}</button>
      </div>
    </div>` : ""}
  </article>`;
}
function insight(state, today) {
  const counts = {};
  for (const area of state.areas) counts[area.id] = 0;
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    if (!state.logs[date]?.priority) continue;
    const goal = linkedGoal(resolvedDay(date, state), state);
    if (goal && counts[goal.area] != null) counts[goal.area] += 1;
  }
  const max = Math.max(1, ...Object.values(counts));
  const quiet = state.areas.find((area) => counts[area.id] === 0);
  return `<section class="card white"><p class="kicker">Last 14 days</p><p class="soft">${quiet ? `${esc(quiet.label)} has not had a finished priority. One small hour would be enough, whenever you want.` : "Every area got a little of you."}</p>${state.areas.map((area) => `<div class="ibar"><span>${esc(area.label.split(" ")[0])}</span><div class="bar slim"><i style="width:${Math.round((counts[area.id] / max) * 100)}%"></i></div><em>${counts[area.id]}</em></div>`).join("")}</section>`;
}

export function dumpSheet(state, today, pick) {
  const item = pick ? state.inbox.find((row) => row.id === pick.id) : null;
  return `<div class="sheet"><button type="button" class="sheet-back" data-act="close" aria-label="Close inbox"></button><div class="panel"><p class="kicker">Inbox</p><h2>Sort it when you can</h2>${capture()}${item ? pickPanel(state, today, item, pick.mode) : ""}${(state.inbox || []).length ? `<ul class="list">${state.inbox.map((row) => inboxRow(row, pick)).join("")}</ul>` : `<p class="soft">Nothing waiting. Thoughts can land here.</p>`}<p class="kicker">Someday</p>${(state.someday || []).length ? `<ul class="list">${state.someday.map((row) => `<li class="split"><span>${esc(row.text)}</span></li>`).join("")}</ul>` : `<p class="hint">Someday is empty.</p>`}</div></div>`;
}
function inboxRow(row, pick) {
  const open = pick && pick.id === row.id;
  return `<li class="card cream tight"><b>${esc(row.text)}</b>${open ? "" : `<div class="tiny"><button type="button" data-act="sort" data-id="${esc(row.id)}" data-bin="goal">Goal</button><button type="button" data-act="sort" data-id="${esc(row.id)}" data-bin="task">Task</button><button type="button" data-act="sort" data-id="${esc(row.id)}" data-bin="day">Day</button><button type="button" data-act="sort" data-id="${esc(row.id)}" data-bin="someday">Someday</button><button type="button" data-act="inbox-del" data-id="${esc(row.id)}">Remove</button></div>`}</li>`;
}
function pickPanel(state, today, item, mode) {
  if (mode === "goal") {
    return `<section class="card lilac"><p class="kicker">File “${esc(item.text)}” under</p><button type="button" class="wide-btn" data-act="file-goal" data-goal="new">New goal</button><ul class="list">${state.goals.map((goal) => `<li><button type="button" class="item" data-act="file-goal" data-goal="${esc(goal.id)}"><span><b>${esc(goal.title)}</b><small>${esc(areaLabel(state, goal.area))}</small></span></button></li>`).join("")}</ul></section>`;
  }
  return `<section class="card lilac"><p class="kicker">Put “${esc(item.text)}” on</p><div class="tiny">${[0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const date = addDays(today, offset);
    return `<button type="button" data-act="file-day" data-date="${esc(date)}">${esc(formatShort(date))}</button>`;
  }).join("")}</div></section>`;
}
export function dialogHtml(pending, warn) {
  if (!pending) return "";
  return `<div class="modal"><div class="card paper"><h2>Replace what’s on this phone?</h2><p class="soft">${esc(warn || "This backup overwrites goals, ticks, scores and deadlines on this device. You can export first if you are unsure.")}</p><div class="modes"><button type="button" data-act="import-no">Keep mine</button><button type="button" class="on" data-act="import-yes">Replace</button></div></div></div>`;
}
export function cloudSheet(files) {
  const rows = (files || []).length
    ? files.map((file) => `<li><button type="button" class="item" data-act="cloud-file" data-id="${esc(file.id)}"><span><b>${esc(file.name)}</b><small>${esc(file.when ? String(file.when).slice(0, 16).replace("T", " ") : "")}</small></span></button></li>`).join("")
    : `<p class="hint">No dated copies in that folder yet.</p>`;
  return `<div class="sheet"><button type="button" class="sheet-back" data-act="close" aria-label="Close"></button><div class="panel"><p class="kicker">Your Drive</p><h2>Restore from cloud</h2><p class="soft">The newest 30 copies. This replaces what is on this phone.</p><ul class="list">${rows}</ul></div></div>`;
}
