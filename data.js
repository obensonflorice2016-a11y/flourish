export const VERSION = 1;
export const VISION =
  "At 31, I live in a great big city with the freedom to go wherever I please, remotely managing multimillion-dollar businesses in and out of Africa, starting my family, fulfilled and happy with what I have achieved.";
export const MOTTOS = [
  "Health is a daily choice",
  "I deserve to see the world",
  "Make the best use of your time so you use less time to make more money",
];
export const ATU_DATE = "2027-01-01";
export const AREAS = {
  health: "Physical Health",
  mind: "Mental & Emotional",
  relationships: "Relationships",
  career: "Career & Work",
  financial: "Financial",
  learning: "Learning & Growth",
  purpose: "Purpose & Values",
  lifestyle: "Time & Lifestyle",
  identity: "Self & Identity",
  contribution: "Social & Environmental Contribution",
};
export const AREA_IDS = Object.keys(AREAS);
export const FOCUS = ["lifestyle", "financial", "relationships"];
const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(key, n) {
  const dt = parseKey(key);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}
export function weekday(key) {
  return parseKey(key).getDay();
}
export function daysBetween(a, b) {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);
}
export function formatDay(key) {
  const dt = parseKey(key);
  return `${WEEK[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}
export function formatShort(key) {
  return SHORT[weekday(key)] || "";
}
export function monthKey(key) {
  return key.slice(0, 7);
}
export function mottoFor(key) {
  return MOTTOS[Math.abs(daysBetween("2026-01-01", key)) % MOTTOS.length];
}
export function weekTuesday(key) {
  return addDays(key, -((weekday(key) + 5) % 7));
}
export function nextTuesday(key) {
  const hop = (2 - weekday(key) + 7) % 7 || 7;
  return addDays(key, hop);
}
export function addMonths(key, n) {
  const dt = parseKey(key);
  dt.setMonth(dt.getMonth() + n);
  return dateKey(dt);
}
export function countdown(from, to) {
  const n = daysBetween(from, to);
  if (n > 1) return `${n} days`;
  if (n === 1) return "Tomorrow";
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return `${Math.abs(n)} days ago`;
}
export function tuesdayKind(key, anchor, modes) {
  const tue = weekTuesday(key);
  if (modes[tue]) return modes[tue];
  const weeks = Math.round(daysBetween(anchor, tue) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? "atu" : "phd";
}
export function schoolWhen(school, today) {
  if (school.priority && school.priority >= today) return school.priority;
  return school.final;
}
export function nearestSchool(schools, today) {
  const open = schools.filter((s) => s.status !== "done" && !s.optional);
  const pool = open.length ? open : schools.filter((s) => s.status !== "done");
  return [...pool].sort((a, b) => schoolWhen(a, today).localeCompare(schoolWhen(b, today)))[0] || null;
}
export function feeTotal(schools) {
  return schools.filter((s) => !s.optional).reduce((sum, s) => sum + s.fee, 0);
}
export function dayShape(key) {
  const day = weekday(key);
  if (day === 0 || day === 1) return { free: true, priority: false, exercise: false, care: false, review: false, exerciseWhen: "", work: "", goalId: "" };
  if (day === 2) return { free: false, priority: true, exercise: true, care: true, review: false, exerciseWhen: "5:00–5:20 PM", work: "Work is 8–4. The priority is for the evening.", goalId: "move" };
  if (day === 3) return { free: false, priority: true, exercise: false, care: true, review: false, exerciseWhen: "", work: "Work is 8–4. Home starts after.", goalId: "home" };
  if (day === 4) return { free: false, priority: true, exercise: true, care: true, review: false, exerciseWhen: "5:00–5:20 PM", work: "Work is 8–4. One skill hour after.", goalId: "streams" };
  if (day === 5) return { free: false, priority: true, exercise: false, care: true, review: false, exerciseWhen: "", work: "Work is 8–4. People get the evening.", goalId: "people" };
  return { free: false, priority: true, exercise: true, care: false, review: true, exerciseWhen: "12:30–12:50 PM", work: "Work is 8–12. The afternoon is for food and care.", goalId: "weight" };
}
export function defaultPriority(key, ctx) {
  const day = weekday(key);
  if (day === 0 || day === 1) return "";
  if (day === 2) {
    if (tuesdayKind(key, ctx.anchor, ctx.modes) === "phd") {
      const next = nearestSchool(ctx.schools, key);
      return next ? `${next.school}, ${next.program}: one small step` : "One PhD step";
    }
    const step = ctx.atu.tuition !== "done" ? "tuition" : ctx.atu.visa !== "done" ? "the visa" : "travel";
    return `ATU Donegal: one step on ${step}`;
  }
  if (day === 3) return "Cleaning and laundry";
  if (day === 4) return "Photo, video, or @buea.gypsum_and_resin";
  if (day === 5) return "A call, a visit, or an outing";
  return "Cook for the week, then self-care";
}
export function priorityText(key, overrides, ctx) {
  const custom = overrides[key];
  if (custom && custom.trim()) return custom;
  return defaultPriority(key, ctx);
}
export function weekSlots(tuesday, logs) {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const date = addDays(tuesday, i);
    const shape = dayShape(date);
    const log = logs[date] || {};
    if (shape.priority) slots.push({ date, kind: "priority", done: Boolean(log.priority) });
    if (shape.exercise) slots.push({ date, kind: "exercise", done: Boolean(log.exercise) });
    if (shape.care) slots.push({ date, kind: "care", done: Boolean(log.care) });
    if (shape.review) slots.push({ date, kind: "review", done: Boolean(log.review) });
  }
  return slots;
}
export function weekSoFar(tuesday, today, logs) {
  const slots = weekSlots(tuesday, logs).filter((slot) => slot.date <= today);
  return { done: slots.filter((slot) => slot.done).length, total: slots.length };
}
export function quotaStreak(today, logs) {
  let tue = weekTuesday(today);
  if (today < addDays(tue, 5)) tue = addDays(tue, -7);
  let streak = 0;
  for (let i = 0; i < 24; i++) {
    const slots = weekSlots(tue, logs);
    if (!slots.length || !slots.every((slot) => slot.done)) break;
    streak += 1;
    tue = addDays(tue, -7);
  }
  return streak;
}
export function carriedPriorities(today, logs, text) {
  const out = [];
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, -i);
    if (!dayShape(date).priority) continue;
    if (logs[date]?.priority) continue;
    out.push({ date, label: text(date) });
  }
  return out.slice(0, 3);
}
export function nextStatus(status) {
  if (status === "not-started") return "in-progress";
  if (status === "in-progress") return "done";
  return "not-started";
}
export function statusLabel(status) {
  if (status === "in-progress") return "In progress";
  if (status === "done") return "Done";
  return "Not started";
}

function g(id, area, title, five, yearly, quarterly, monthly, weekly, status = "not-started") {
  return { id, area, title, five, yearly, quarterly, monthly, weekly, status };
}

export function seedGoals() {
  return [
    g("job", "career", "A job I love, paid properly", "Work I would choose again. Teaching is not the whole story.", "One better-paying path is real: an offer, or the funded degree has started.", "By January, the applications are moving and the current job is not the only plan.", "One concrete step on the job-I-love path.", "It rides with Tuesday. Not a second job after 4."),
    g("degree", "career", "Use the chemical pathology degree", "The degree is doing work in the world, not sitting in a folder.", "It is aimed at a lab, a doctorate, or both.", "The ATU file and the PhD file both know what the degree is for.", "One paragraph that uses the training on purpose.", "Tuesday, when it is PhD week."),
    g("lab", "career", "A histopathology lab in Buea", "A lab project that exists on paper, with a partner in mind.", "The project is written. Someone else has read it.", "An outline, not a fantasy.", "One page.", "A Thursday note, only if the skill hour has room. It can wait."),
    g("insurance", "career", "Health insurance, understood", "I know how a company in this space would actually work.", "A plain note: who pays, who is served, what I would not do.", "Read one real source. No company yet.", "A page of notes.", "Not this week’s priority unless Tuesday is quiet."),
    g("move", "learning", "A funded move", "A developed, English-speaking country. Fully funded.", "ATU in January 2027, or the US PhD file ready for Fall 2027.", "Tuition handled. Visa and travel in order. The nearest PhD date is not a surprise.", "The school with the closest date gets the hour.", "Tuesday alternates. ATU one week, PhD the next.", "in-progress"),
    g("books", "learning", "One book a month", "A mind that is wider than the timetable.", "Twelve books, or fewer if a month was actually full.", "Three months, three books.", "One book, finished or still open. Either is fine.", "A few pages on a work evening, or none on a free day."),
    g("savings", "financial", "4,000,000 FCFA by January 2027", "Money that can move me, not money that only maintains the week.", "The January number is the milestone.", "Know the gap. Move a little toward it.", "One transfer, or one honest look at the number.", "Not a daily quota. A Thursday business hour can feed it."),
    g("streams", "financial", "More than one income", "Craft supplies, stocks, gypsum and candles, fashion, agriculture, education, fitness, import and export.", "Two of them are real. The rest stay notes.", "The gypsum shop is posting. One other stream is named.", "Four Thursdays of practice.", "Thursday. Photo, video, or @buea.gypsum_and_resin. Then stop."),
    g("forbes", "financial", "Forbes Africa 30 Under 30", "A company with people, revenue, and a reason. The list is a marker, not the motive.", "The work is real enough to describe in a page.", "One offer people can pay for.", "Keep the books plain.", "It grows from Thursday, not from a packed Sunday."),
    g("weight", "health", "Under 66 kg", "A body that is chosen daily, not punished.", "Still under 66, without a crash diet.", "Training on the three days. Food that was cooked.", "The Tuesday, Thursday, and Saturday sessions happened more often than not.", "20 minutes, only those three days. Saturday’s pot feeds the week."),
    g("look", "identity", "Be a looker", "I do not look like my problems.", "Getting dressed stays ordinary, not a project.", "Most workdays, one finished detail.", "It lives inside the 30 minutes before bed.", "Tuesday to Friday, before bed. Free days are off the list."),
    g("fashion", "identity", "Sewing again", "A Cameroonian fashion identity, made, not only pinned.", "The machine is back in use. One piece exists.", "Fabric chosen, or a seam started.", "One hour that is sewing, not shopping for sewing.", "It can share Thursday. It does not get a second day."),
    g("nails", "identity", "Nails, explored", "I know whether this is a craft or only a pleasure.", "A small trial, finished.", "One practice set.", "Look at it once, without turning it into a business yet.", "Optional inside self-care. Not a quota."),
    g("shoes", "identity", "The shoe gallery", "The obsession has a shelf and a plan.", "The gallery is named, even if it is still small.", "Ten pairs, or a clear edit of what belongs.", "One addition, or one honest cull.", "Not a workday task."),
    g("people", "relationships", "A life with people in it", "Events, friends, a weekend that is not empty.", "There is someone I see on purpose.", "A few Fridays that were a call, a visit, or an outing.", "Four Fridays.", "Friday evening. One person."),
    g("posts", "relationships", "One post a week", "I show up where people are, without living there.", "A year of light, regular posting.", "Most weeks, one post on each platform I actually use.", "Four weeks, not a content factory.", "One post. It can be the Thursday shop, or something gentler."),
    g("faith", "purpose", "Closer to God", "Faith that is near, not performed.", "Prayer is ordinary again.", "A short practice I can keep on workdays.", "Still there at the end of the month.", "A line, when I want it. Free days are not graded."),
    g("give", "contribution", "Give to someone", "Money and time that leave my hands on purpose.", "Giving is a line in the month, not a leftover.", "One gift that was planned.", "Something small, sent or handed over.", "Not a quota. It counts when it happens."),
    g("home", "lifestyle", "A home that is kept", "The rooms are part of the life, not a debt to the weekend.", "Wednesday is enough to live in the place.", "The house no longer waits for a mythical free afternoon.", "Four Wednesdays of cleaning and laundry.", "Wednesday evening. That is the whole task."),
    g("licence", "lifestyle", "A licence, then a car", "I can take myself where I mean to go.", "The licence is in hand, or the lessons are underway.", "The next official step is booked.", "One appointment, or one lesson.", "It can borrow a Tuesday only if ATU and the PhD are quiet."),
    g("travel", "lifestyle", "See the world", "Movement is normal. I deserve to see it.", "The ATU trip is the first big one, if the visa says yes.", "Passport, dates, and a bag list.", "One travel step, shared with Tuesday’s ATU week.", "Not an extra task."),
    g("rest", "mind", "Rest that is scheduled", "I do not pay for every push with a collapse.", "Sunday and Monday stayed free.", "The crash weeks got rarer.", "Free days were actually free.", "No tasks on Sunday or Monday. Thirty minutes before bed, Tuesday to Friday."),
  ];
}

export function seedSchools() {
  const open = "not-started";
  return [
    { id: "cwru-bstp", school: "Case Western", program: "BSTP → Pathology", priority: "2026-10-15", final: "2027-01-01", feeLabel: "$85", fee: 85, status: open },
    { id: "unm", school: "UNM", program: "Biomedical Sciences", priority: "2026-11-15", final: "2026-12-01", feeLabel: "$70", fee: 70, status: open },
    { id: "unc", school: "UNC", program: "BBSP → Pathology", priority: null, final: "2026-11-17", feeLabel: "$95", fee: 95, status: open },
    { id: "cwru-bhi", school: "Case Western", program: "Biomedical & Health Informatics", priority: null, final: "2026-12-01", feeLabel: "$85", fee: 85, status: open },
    { id: "cwru-cts", school: "Case Western", program: "Clinical & Translational Science", priority: null, final: "2026-12-01", feeLabel: "$85", fee: 85, status: open },
    { id: "nu", school: "Northwestern", program: "HSIP Health & Biomedical Informatics", priority: null, final: "2026-12-01", feeLabel: "$95", fee: 95, status: open },
    { id: "mich", school: "Michigan", program: "HILS", priority: null, final: "2026-12-01", feeLabel: "$90 + $29.99 Scholaro", fee: 119.99, status: open },
    { id: "mayo", school: "Mayo Clinic", program: "CTS", priority: null, final: "2026-12-02", feeLabel: "No fee", fee: 0, status: open },
    { id: "jhu", school: "Johns Hopkins", program: "Health Sciences Informatics", priority: null, final: "2026-12-15", feeLabel: "$125", fee: 125, status: open },
    { id: "bu", school: "Boston University", program: "HSPR", priority: "2026-11-01", final: "2026-12-01", feeLabel: "About $408, including WES", fee: 408, optional: true, status: open },
  ];
}

export function freshState() {
  return {
    version: VERSION,
    goals: seedGoals(),
    schools: seedSchools(),
    atu: { tuition: "in-progress", visa: "not-started", travel: "not-started" },
    checklist: { recommenders: false, essays: false, transcripts: false },
    logs: {},
    priorityText: {},
    modes: {},
    anchor: "2026-10-13",
    notes: {},
    books: {},
    posts: {},
    wheel: [{ date: "2026-10-13", scores: { health: 7, mind: 5, relationships: 2, career: 0, financial: 0, learning: 2, purpose: 3, lifestyle: 0, identity: 5, contribution: 0 } }],
    installedOn: dateKey(),
    lastExport: null,
    openArea: "learning",
    board: {},
    theme: "",
  };
}

export function normalize(raw) {
  const base = freshState();
  if (!raw || typeof raw !== "object") return base;
  const state = raw.state && raw.state.goals ? raw.state : raw;
  return {
    ...base,
    ...state,
    version: VERSION,
    goals: Array.isArray(state.goals) && state.goals.length ? state.goals : base.goals,
    schools: Array.isArray(state.schools) && state.schools.length ? state.schools : base.schools,
    atu: { ...base.atu, ...(state.atu || {}) },
    checklist: { ...base.checklist, ...(state.checklist || {}) },
    logs: state.logs || {},
    priorityText: state.priorityText || {},
    modes: state.modes || {},
    notes: state.notes || {},
    books: state.books || {},
    posts: state.posts || {},
    wheel: Array.isArray(state.wheel) && state.wheel.length ? state.wheel : base.wheel,
    anchor: state.anchor || base.anchor,
    installedOn: state.installedOn || base.installedOn,
    lastExport: state.lastExport || null,
    board: state.board || {},
    theme: state.theme || "",
  };
}
