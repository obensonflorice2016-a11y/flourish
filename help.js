import { esc } from "./views.js";

export const TOUR_KEY = "flourish-tour-done";

export const TOUR = [
  { tab: "today", title: "Today", body: "This is home. One priority, today’s blocks, and the nearest deadline. Missed things roll forward. Nothing here scolds you." },
  { tab: "today", spotlight: "dump", title: "Brain dump", body: "The Brain dump button is on every screen. Type a thought and leave it. Later, sort it into a goal, a task, a day, or someday." },
  { tab: "plan", title: "Plan", body: "Plan holds your why, the week, and the times. Sunday and Monday stay free unless you choose otherwise." },
  { tab: "goals", title: "Goals", body: "Goals is the ladder. A weekly step leads to the month, the year, and Future Me. You can edit any line." },
  { tab: "track", title: "Trackers", body: "Trackers holds the life wheel, ATU Donegal, and the US PhD schools. Change a score or a step whenever you want." },
  { tab: "plan", scroll: "phone-card", title: "Settings, then back up", body: "Settings lives on Plan, in This phone. Back up to file is the copy that can move to a new phone." },
  { tab: "plan", backup: true, title: "Make your first backup now", body: "One file. Keep it in Google Drive and in OneDrive, in a folder called Flourish Backups. That is how two devices stay in step." },
];

const FIXES = [
  ["Lost, stolen, or broken phone", "The phone is gone. The backup file is not, if you saved it.", ["On a new phone, open Flourish.", "Install it, then tap Restore from file.", "Choose the newest file from Google Drive or OneDrive.", "Check that today and your goals look right before you continue."], ["restore"]],
  ["New phone", "A new phone starts empty. That is normal.", ["Install Flourish.", "Tap Restore from file.", "Pick the newest backup from Drive or OneDrive.", "Make a fresh backup on this phone once it looks right."], ["restore", "backup"]],
  ["Blank screen", "The page did not finish opening.", ["Close the app and open it again from the home screen.", "If it is still blank, open the link once in Safari or Chrome while you are online.", "Your data is still on the phone unless you deleted the app."], []],
  ["Data disappeared", "It is usually still in a backup, or the app was opened on a different device.", ["Look in Google Drive and OneDrive for Flourish Backups.", "Tap Restore from file and choose the newest file.", "Do not restore an older file on top of a newer one without saving a copy first."], ["backup", "restore"]],
  ["Storage wiped", "If the phone was erased, only a backup can bring Flourish back.", ["Install the app again.", "Restore from the newest file in Drive or OneDrive.", "If you have no file, the notes on this phone are gone. Start again, and back up today."], ["restore"]],
  ["Devices showing different data", "Each device keeps its own copy. They do not sync by themselves.", ["On the phone that is right, tap Back up now.", "On the other device, tap Restore from file and choose that new file.", "The restored device then matches the one you backed up."], ["backup", "restore"]],
  ["Restore fails", "The file may be the wrong one, or only part of it saved.", ["Pick a file whose name starts with flourish and ends with .json.", "Try the next newest file if the newest one will not open.", "Back up the phone as it is now before you try another file."], ["backup", "restore"]],
  ["Link down, or the subscription ends", "Flourish does not need Grok to keep working. You need the source ZIP and a backup file.", ["Find flourish-source.zip in your Flourish Drive folder.", "Go to app.netlify.com/drop and drop the ZIP, or turn on GitHub Pages for the source.", "Open the new link, install it, then Restore from file."], ["zip", "restore"]],
  ["Forgot where backups are", "Look for a folder named Flourish Backups.", ["Google Drive, folder Flourish Backups.", "OneDrive, the same folder name.", "The file name starts with flourish and ends with .json.", "The source ZIP is the app itself, not your data."], ["backup"]],
  ["Laptop died", "The laptop was only one copy.", ["On your phone, or a borrowed computer, open Flourish.", "Restore from the newest file in Drive or OneDrive.", "Install it on the new computer when you have one, then restore again."], ["restore"]],
  ["Reminders not firing", "A website may remind you only after you allow it, and iPhone is stricter.", ["In Settings, tap Turn on reminders, then allow them.", "On iPhone, add Flourish to the Home Screen first. Then allow notifications.", "Also tap Add reminders to calendar. The phone calendar is the reliable alarm."], ["ics"]],
  ["Broken after an update", "The new copy of the app may be cached, or a file did not load.", ["Close Flourish and open it again.", "If you are online, open the link once so it can refresh.", "Your data stays on the phone. Back up before you delete anything."], ["backup"]],
  ["Accidental delete", "If you deleted one goal or task, it is still in the last backup.", ["Back up is too late for that one item if you already saved after deleting it.", "Restore an older file only if you can accept losing newer edits.", "Before you restore, Back up now, so the current copy is safe."], ["backup", "restore"]],
  ["Google account lost", "Drive is one shelf. OneDrive is the other.", ["Open OneDrive and find Flourish Backups.", "Restore from that file on this phone.", "Save a new copy somewhere you can still open.", "Keep the source ZIP with the backup, not only in the lost account."], ["restore", "backup", "zip"]],
];

function actions(keys) {
  const map = {
    backup: `<button type="button" class="wide-btn" data-act="export">Back up now</button>`,
    restore: `<button type="button" class="wide-btn ghost" data-act="import">Restore from file</button>`,
    ics: `<button type="button" class="wide-btn ghost" data-act="ics">Add reminders to calendar</button>`,
    zip: `<button type="button" class="wide-btn ghost" data-act="source">Download source ZIP</button>`,
  };
  return keys.map((key) => map[key]).join("");
}
function steps(list, query) {
  return `<ol class="help-steps">${list.map((line) => `<li>${hi(line, query)}</li>`).join("")}</ol>`;
}
function hi(text, query) {
  const safe = esc(text);
  const q = String(query || "").trim();
  if (!q) return safe;
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  return safe.replace(pattern, (match) => `<mark>${match}</mark>`);
}
function blob(...parts) {
  return parts.flat().join(" ").toLowerCase();
}

export function helpView(query) {
  return `<p class="kicker help-hide">Help</p><h2 class="help-hide">How to use and recover</h2><label class="help-search help-hide">Search<input id="help-q" type="search" placeholder="Try backup, iPhone, wheel" value="${esc(query)}" autocomplete="off" enterkeyhint="search" /></label><div id="help-list">${helpList(query)}</div><button type="button" class="wide-btn ghost help-hide" data-act="tour-start">Start tour</button>`;
}

export function helpList(query) {
  const q = String(query || "").trim().toLowerCase();
  const show = (text) => !q || text.includes(q);
  const parts = [];
  const start = blob("start here", "data lives on each device", "backup file", "sync", "recover");
  if (show(start)) {
    parts.push(`<section class="card cream help-hide"><p class="kicker">Start here</p><p>${hi("Your notes live on each device by themselves. A backup file is how two devices stay in step, and how you get Flourish back.", query)}</p>${steps(["Open Flourish on the device that is right.", "Tap Back up now and save the file in Google Drive.", "Save the same file in OneDrive.", "On the other device, tap Restore from file."], query)}${actions(["backup", "restore"])}</section>`);
  }
  const rules = blob("golden rules", "sunday", "10 am", "google drive", "onedrive", "source zip", "before restoring");
  if (show(rules)) {
    parts.push(`<section class="card plum help-hide"><p class="kicker">Golden rules</p><ol class="help-steps">${["Back up every week. Sunday at 10:00 is the reminder.", "Keep a copy in Google Drive and a copy in OneDrive.", "Keep the source ZIP and the app link in your Flourish Drive folder.", "Back up before you restore, so a wrong file cannot be your only copy."].map((line) => `<li>${hi(line, query)}</li>`).join("")}</ol>${actions(["backup", "zip"])}</section>`);
  }
  const install = blob("install iphone safari share add to home screen android chrome windows edge");
  if (show(install)) {
    parts.push(`<section class="card white help-hide"><p class="kicker">Install</p><p class="soft">${hi("Same link on every device. Install it, then restore your file.", query)}</p><p><b>iPhone</b></p>${steps(["Open the link in Safari.", "Tap Share.", "Tap Add to Home Screen."], query)}<p><b>Android</b></p>${steps(["Open the link in Chrome.", "Tap the menu.", "Tap Install app."], query)}<p><b>Windows</b></p>${steps(["Open the link in Edge or Chrome.", "Tap the install icon in the address bar.", "Confirm Install."], query)}</section>`);
  }
  const routine = blob("daily weekly saturday 12:55 review sunday backup monthly wheel goals");
  if (show(routine)) {
    parts.push(`<section class="card cream help-hide"><p class="kicker">Routines</p><p><b>Daily</b></p>${steps(["Open Today and do the one priority.", "Tick the blocks you kept.", "At night, set tomorrow’s line if you want.", "Dump a thought instead of holding it."], query)}<p><b>Weekly</b></p>${steps(["Saturday at 12:55, five minutes. What moved, and what next week needs.", "Sunday at 10:00, save a backup into Drive and OneDrive."], query)}<p><b>Monthly</b></p>${steps(["Re-score the life wheel.", "Read the goals and keep only the steps that still matter."], query)}</section>`);
  }
  const features = [
    ["Today", "Today shows the priority, the blocks, the nearest deadline, and one line from Future Me. Tap the priority to change it. At night it can ask for tomorrow."],
    ["Plan", "Plan is the week. Edit a time for one day, or for every week. Your why sits at the top. Settings sits at the bottom."],
    ["Brain dump", "Type anything. It waits in the inbox. One tap files it as a goal, a task, a day, or someday."],
    ["Goals", "Each goal has an area on the wheel, and steps for the year, the quarter, the month, and the week. Add, edit, reorder, or remove."],
    ["Trackers", "The wheel, ATU Donegal, and the PhD list live here. Deadlines count down. You can add or remove a school."],
    ["Settings", "This phone, on the Plan tab, is Settings. Back up, restore, reminders, the calendar file, install, and the source ZIP are there."],
  ];
  const featureHits = features.filter((row) => show(blob("feature", row[0], row[1])));
  if (featureHits.length) {
    parts.push(`<section class="card white help-hide"><p class="kicker">Each place</p>${featureHits.map((row) => `<p class="help-feature"><b>${hi(row[0], query)}</b> ${hi(row[1], query)}</p>`).join("")}${actions(["backup", "restore", "ics", "zip"])}</section>`);
  }
  const fixes = FIXES.filter((row) => show(blob(row[0], row[1], row[2])));
  if (fixes.length) {
    parts.push(`<section class="help-hide"><p class="kicker">Fix a problem</p>${fixes.map((row) => `<details class="help-fold" ${q ? "open" : ""}><summary>${hi(row[0], query)}</summary><p>${hi(row[1], query)}</p>${steps(row[2], query)}${actions(row[3])}</details>`).join("")}</section>`);
  }
  const emergency = blob("emergency card print backup restore netlify github pages drive onedrive");
  if (show(emergency)) {
    parts.push(`<section class="card ink" id="emergency-card"><p class="kicker">Quick emergency card</p><ol class="help-steps">${["Data lives on this device only.", "Backups: Google Drive and OneDrive, folder Flourish Backups.", "Account hint: obensonflorice2016@gmail.com.", "Restore: Plan, This phone, Restore from file.", "Back up before you restore.", "If the link dies: drop flourish-source.zip on Netlify Drop, or use GitHub Pages, then restore the file."].map((line) => `<li>${hi(line, query)}</li>`).join("")}</ol><button type="button" class="wide-btn ghost help-print" data-act="help-print">Print</button></section>`);
  }
  if (!parts.length) return `<p class="soft help-hide">Nothing matches that. Try backup, iPhone, or wheel.</p>`;
  return parts.join("");
}

export function tourHtml(index) {
  const step = TOUR[index];
  const last = index === TOUR.length - 1;
  const next = last
    ? `<button type="button" class="wide-btn" data-act="tour-backup">Make your first backup now</button><button type="button" class="wide-btn ghost" data-act="tour-skip">Not now</button>`
    : `<div class="modes"><button type="button" data-act="tour-skip">Skip</button><button type="button" data-act="tour-next">Next</button></div>`;
  return `<div class="tour" role="dialog" aria-label="Start tour"><section class="card cream tour-card"><p class="kicker">Step ${index + 1} of ${TOUR.length}</p><h2>${esc(step.title)}</h2><p>${esc(step.body)}</p>${next}</section></div>`;
}
