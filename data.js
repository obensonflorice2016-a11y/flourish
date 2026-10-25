export const VERSION = 2;
export const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const BASELINE_DATE = "2026-10-13";
export const DEFAULT_VISION =
  "At 31, I live in a great big city with the freedom to go wherever I please, remotely managing multimillion-dollar businesses in and out of Africa, starting my family, fulfilled and happy with what I have achieved.";
export const DEFAULT_WHY =
  "I mismanage time. Work takes over, and I neglect rest, relationships, home, fun, and growth. When I over-schedule, I crash for a long time afterwards. I have many ambitions, and I need those thoughts kept in order, not jumbled. Flourish is for effective, balanced time management: today's small actions should lead to the life I want, without burning me out or eating my rest days.";
export const DEFAULT_MOTTOS = [
  "Health is a daily choice",
  "I deserve to see the world",
  "Make the best use of your time so you use less time to make more money",
];
export const DEFAULT_AREAS = [
  { id: "health", label: "Physical Health" },
  { id: "mind", label: "Mental & Emotional" },
  { id: "relationships", label: "Relationships & Social" },
  { id: "career", label: "Career" },
  { id: "financial", label: "Financial" },
  { id: "learning", label: "Moving abroad & Learning" },
  { id: "purpose", label: "Purpose & Faith" },
  { id: "lifestyle", label: "Time & Lifestyle" },
  { id: "identity", label: "Self & Identity" },
  { id: "contribution", label: "Contribution" },
];
const BASELINE_SCORES = {
  health: 7, mind: 5, relationships: 2, career: 0, financial: 0,
  learning: 2, purpose: 3, lifestyle: 0, identity: 5, contribution: 0,
};
const KIND_GOAL = { atu: "move", home: "home", skill: "streams", people: "people", cook: "weight" };

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseKey(key) {
  const [y, m, d] = String(key || "").split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
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
  return `${WEEK[dt.getDay()]} ${dt.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][dt.getMonth()]}`;
}
export function formatShort(key) {
  const dt = parseKey(key);
  return `${SHORT[dt.getDay()]} ${dt.getDate()}`;
}
export function monthKey(key) {
  return String(key).slice(0, 7);
}
export function weekTuesday(key) {
  return addDays(key, -((weekday(key) + 5) % 7));
}
export function nextOn(key, wd) {
  return addDays(key, (wd - weekday(key) + 7) % 7);
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
export function clock(value) {
  if (!value || !value.includes(":")) return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h)) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}
export function mottoFor(key, mottos) {
  const list = mottos && mottos.length ? mottos : DEFAULT_MOTTOS;
  return list[Math.abs(daysBetween("2026-01-01", key)) % list.length];
}
export function tuesdayKind(key, anchor, modes) {
  const tue = weekTuesday(key);
  if (modes && modes[tue]) return modes[tue];
  const weeks = Math.round(daysBetween(anchor || BASELINE_DATE, tue) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? "atu" : "phd";
}
export function schoolWhen(school, today) {
  if (school.priority && school.priority >= today) return school.priority;
  return school.final || school.priority || "";
}
export function nearestSchool(schools, today) {
  const open = (schools || []).filter((s) => s.status !== "done" && !s.optional && schoolWhen(s, today));
  const pool = open.length ? open : (schools || []).filter((s) => s.status !== "done" && schoolWhen(s, today));
  return [...pool].sort((a, b) => schoolWhen(a, today).localeCompare(schoolWhen(b, today)))[0] || null;
}
export function nearestDeadline(state, today) {
  const items = [];
  if ((state.atuSteps || []).some((step) => step.status !== "done") && state.atuDate) {
    items.push({ date: state.atuDate, label: "ATU Donegal", detail: "January 2027" });
  }
  for (const school of state.schools || []) {
    if (school.status === "done") continue;
    const date = schoolWhen(school, today);
    if (!date) continue;
    items.push({
      date,
      label: school.school,
      detail: school.program,
      optional: !!school.optional,
    });
  }
  const required = items.filter((item) => !item.optional);
  const pool = required.length ? required : items;
  return pool.sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
export function feeTotal(schools) {
  return (schools || []).filter((s) => !s.optional).reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
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
function block(id, label, start, end, track) {
  return { id, label, start, end, track };
}
export function defaultSchedule() {
  const day = (partial) => ({
    free: false,
    workStart: "",
    workEnd: "",
    priorityKind: "custom",
    priority: "",
    goalId: "",
    blocks: [],
    ...partial,
  });
  return [
    day({ free: true, priorityKind: "none" }),
    day({ free: true, priorityKind: "none" }),
    day({
      workStart: "08:00", workEnd: "16:00", priorityKind: "atu", goalId: "move",
      blocks: [
        block("workout", "Morning workout", "06:00", "06:20", "exercise"),
        block("priority", "Today's priority", "18:00", "19:00", "priority"),
        block("care", "Self-care", "21:30", "22:00", "care"),
      ],
    }),
    day({
      workStart: "08:00", workEnd: "16:00", priorityKind: "home", goalId: "home", priority: "Cleaning and laundry",
      blocks: [
        block("priority", "Today's priority", "18:00", "19:00", "priority"),
        block("care", "Self-care", "21:30", "22:00", "care"),
      ],
    }),
    day({
      workStart: "08:00", workEnd: "16:00", priorityKind: "skill", goalId: "streams", priority: "A skill hour, or the business",
      blocks: [
        block("workout", "Morning workout", "06:00", "06:20", "exercise"),
        block("priority", "Today's priority", "18:00", "19:00", "priority"),
        block("care", "Self-care", "21:30", "22:00", "care"),
      ],
    }),
    day({
      workStart: "08:00", workEnd: "16:00", priorityKind: "people", goalId: "people", priority: "A call, a visit, or an outing",
      blocks: [
        block("priority", "Today's priority", "18:00", "19:00", "priority"),
        block("care", "Self-care", "21:30", "22:00", "care"),
      ],
    }),
    day({
      workStart: "08:00", workEnd: "12:00", priorityKind: "cook", goalId: "weight", priority: "Cook for the week, then self-care",
      blocks: [
        block("workout", "Morning workout", "06:00", "06:20", "exercise"),
        block("review", "Weekly review", "12:55", "13:00", "review"),
        block("priority", "Afternoon", "13:00", "15:00", "priority"),
      ],
    }),
  ];
}
function g(id, area, title, five, yearly, quarterly, monthly, weekly, status = "not-started") {
  return { id, area, title, five, yearly, quarterly, monthly, weekly, status, captures: [] };
}
export function seedGoals() {
  return [
    g("job", "career", "A job I love, paid properly", "Work I would choose again. Teaching is not the whole story.", "One better-paying path is real: an offer, or the funded degree has started.", "By January, the applications are moving and the current job is not the only plan.", "One concrete step on the job-I-love path.", "It rides with Tuesday. Not a second job after 4."),
    g("degree", "career", "Use the chemical pathology degree", "The degree is doing work in the world, not sitting in a folder.", "It is aimed at a lab, a doctorate, or both.", "The ATU file and the PhD file both know what the degree is for.", "One paragraph that uses the training on purpose.", "Tuesday, when it is PhD week."),
    g("lab", "career", "A histopathology lab in Buea", "A lab project that exists on paper, with a partner in mind.", "The project is written. Someone else has read it.", "An outline, not a fantasy.", "One page.", "A Thursday note, only if the skill hour has room. It can wait."),
    g("insurance", "career", "Health insurance, understood", "I know how a company in this space would actually work.", "A plain note: who pays, who is served, what I would not do.", "Read one real source. No company yet.", "A page of notes.", "Not this week's priority unless Tuesday is quiet."),
    g("move", "learning", "A funded move", "A developed, English-speaking country. Fully funded.", "ATU in January 2027, or the US PhD file ready for Fall 2027.", "Tuition handled. Visa and travel in order. The nearest PhD date is not a surprise.", "The school with the closest date gets the hour.", "Tuesday alternates. ATU one week, PhD the next.", "in-progress"),
    g("books", "learning", "One book a month", "A mind that is wider than the timetable.", "Twelve books, or fewer if a month was actually full.", "Three months, three books.", "One book, finished or still open. Either is fine.", "A few pages on a work evening, or none on a free day."),
    g("savings", "financial", "4,000,000 FCFA by January 2027", "Money that can move me, not money that only maintains the week.", "The January number is the milestone.", "Know the gap. Move a little toward it.", "One transfer, or one honest look at the number.", "Not a daily quota. A Thursday business hour can feed it."),
    g("streams", "financial", "More than one income", "Craft supplies, stocks, gypsum and candles, fashion, agriculture, education, fitness, import and export.", "Two of them are real. The rest stay notes.", "The gypsum shop is posting. One other stream is named.", "Four Thursdays of practice.", "Thursday. Photo, video, or @buea.gypsum_and_resin. Then stop."),
    g("forbes", "financial", "Forbes Africa 30 Under 30", "A company with people, revenue, and a reason. The list is a marker, not the motive.", "The work is real enough to describe in a page.", "One offer people can pay for.", "Keep the books plain.", "It grows from Thursday, not from a packed Sunday."),
    g("weight", "health", "Under 66 kg", "A body that is chosen daily, not punished.", "Still under 66, without a crash diet.", "Training on the three days. Food that was cooked.", "The Tuesday, Thursday, and Saturday sessions happened more often than not.", "20 minutes, only those three days. Saturday's pot feeds the week."),
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
    g("travel", "lifestyle", "See the world", "Movement is normal. I deserve to see it.", "The ATU trip is the first big one, if the visa says yes.", "Passport, dates, and a bag list.", "One travel step, shared with Tuesday's ATU week.", "Not an extra task."),
    g("rest", "mind", "Rest that is scheduled", "I do not pay for every push with a collapse.", "Sunday and Monday stayed free.", "The crash weeks got rarer.", "Free days were actually free.", "No tasks on Sunday or Monday. Thirty minutes before bed, Tuesday to Friday."),
  ];
}
export function seedSchools() {
  const open = "not-started";
  return [
    { id: "cwru-bstp", school: "Case Western", program: "BSTP → Pathology", priority: "2026-10-15", final: "2027-01-01", feeLabel: "$85", fee: 85, status: open },
    { id: "unm", school: "UNM", program: "Biomedical Sciences", priority: "2026-11-15", final: "2026-12-01", feeLabel: "$70", fee: 70, status: open },
    { id: "unc", school: "UNC", program: "BBSP → Pathology", priority: "", final: "2026-11-17", feeLabel: "$95", fee: 95, status: open },
    { id: "cwru-bhi", school: "Case Western", program: "Biomedical & Health Informatics", priority: "", final: "2026-12-01", feeLabel: "$85", fee: 85, status: open },
    { id: "cwru-cts", school: "Case Western", program: "Clinical & Translational Science", priority: "", final: "2026-12-01", feeLabel: "$85", fee: 85, status: open },
    { id: "nu", school: "Northwestern", program: "HSIP Health & Biomedical Informatics", priority: "", final: "2026-12-01", feeLabel: "$95", fee: 95, status: open },
    { id: "mich", school: "Michigan", program: "HILS", priority: "", final: "2026-12-01", feeLabel: "$90 + $29.99 Scholaro", fee: 119.99, status: open },
    { id: "mayo", school: "Mayo Clinic", program: "CTS", priority: "", final: "2026-12-02", feeLabel: "No fee", fee: 0, status: open },
    { id: "jhu", school: "Johns Hopkins", program: "Health Sciences Informatics", priority: "", final: "2026-12-15", feeLabel: "$125", fee: 125, status: open },
    { id: "bu", school: "Boston University", program: "HSPR", priority: "2026-11-01", final: "2026-12-01", feeLabel: "About $408, including WES", fee: 408, optional: true, status: open },
  ];
}
export function freshState() {
  return {
    version: VERSION,
    why: DEFAULT_WHY,
    vision: DEFAULT_VISION,
    mottos: [...DEFAULT_MOTTOS],
    areas: DEFAULT_AREAS.map((area) => ({ ...area })),
    goals: seedGoals(),
    schools: seedSchools(),
    atuDate: "2027-01-01",
    atuSteps: [
      { id: "tuition", label: "Pay the tuition fees", status: "in-progress" },
      { id: "visa", label: "Visa", status: "not-started" },
      { id: "travel", label: "Travel", status: "not-started" },
    ],
    checklist: [
      { id: "recommenders", label: "Recommenders", detail: "Three per school. I have one or two.", done: false },
      { id: "essays", label: "Tailored essays", detail: "Start with Case Western Biomedical & Health Informatics.", done: false },
      { id: "transcripts", label: "Transcripts and degree scans", detail: "Ready to attach.", done: false },
    ],
    schedule: defaultSchedule(),
    dayEdits: {},
    logs: {},
    priorityText: {},
    modes: {},
    anchor: BASELINE_DATE,
    inbox: [],
    tasks: [],
    someday: [],
    notes: {},
    nextWeek: {},
    books: {},
    posts: {},
    wheel: [{ date: BASELINE_DATE, scores: { ...BASELINE_SCORES } }],
    installedOn: dateKey(),
    lastExport: null,
    lastCloudAt: null,
    cloudError: "",
    cloudEmail: "",
    cloudProvider: "",
    cloudClients: { google: "", microsoft: "" },
    theme: "",
    backupTime: "10:00",
    focus: ["lifestyle", "financial", "relationships"],
    board: {},
  };
}
function normGoal(goal) {
  return {
    id: String(goal.id || uid("goal")),
    area: String(goal.area || "lifestyle"),
    title: String(goal.title || "Untitled"),
    five: String(goal.five || ""),
    yearly: String(goal.yearly || ""),
    quarterly: String(goal.quarterly || ""),
    monthly: String(goal.monthly || ""),
    weekly: String(goal.weekly || ""),
    status: goal.status === "done" || goal.status === "in-progress" ? goal.status : "not-started",
    captures: Array.isArray(goal.captures) ? goal.captures.filter((item) => item && item.text) : [],
  };
}
function normSchool(school) {
  return {
    id: String(school.id || uid("school")),
    school: String(school.school || "School"),
    program: String(school.program || ""),
    priority: school.priority || "",
    final: school.final || "",
    feeLabel: String(school.feeLabel || ""),
    fee: Number(school.fee) || 0,
    optional: !!school.optional,
    status: school.status === "done" || school.status === "in-progress" ? school.status : "not-started",
  };
}
function normBlock(item) {
  const id = String(item.id || uid("block"));
  return {
    id,
    label: String(item.label || "Block"),
    start: item.start || "18:00",
    end: item.end || "18:30",
    track: String(item.track || id),
  };
}
function isWorkout(block) {
  const label = String((block && block.label) || "").toLowerCase();
  const track = String((block && block.track) || "").toLowerCase();
  const id = String((block && block.id) || "").toLowerCase();
  const start = String((block && block.start) || "");
  const end = String((block && block.end) || "");
  if (track === "exercise" || track === "workout") return true;
  if (id === "workout" || id.startsWith("workout")) return true;
  if (label.includes("workout") || label.includes("20-minute") || label.includes("20 minute")) return true;
  return start.startsWith("06:00") && end.startsWith("06:20");
}
function keepWorkout(blocks, dayIndex) {
  const list = blocks || [];
  if (dayIndex === 2 || dayIndex === 4 || dayIndex === 6) return list;
  return list.filter((block) => !isWorkout(block));
}
export function blocksForDay(blocks, dayIndex) {
  return keepWorkout(blocks, dayIndex);
}
function normSchedule(value) {
  if (!Array.isArray(value) || value.length !== 7) return null;
  return value.map((day, index) => {
    const base = defaultSchedule()[index];
    const blocks = Array.isArray(day && day.blocks) ? day.blocks.map(normBlock) : base.blocks.map((item) => ({ ...item }));
    return {
      free: !!(day && day.free),
      workStart: day && day.workStart != null ? day.workStart : base.workStart,
      workEnd: day && day.workEnd != null ? day.workEnd : base.workEnd,
      priorityKind: (day && day.priorityKind) || base.priorityKind,
      priority: day && day.priority != null ? String(day.priority) : base.priority,
      goalId: day && day.goalId != null ? String(day.goalId) : base.goalId,
      blocks: keepWorkout(blocks, index),
    };
  });
}
function normAreas(value) {
  if (!Array.isArray(value) || !value.length) return null;
  return value.map((area) => ({ id: String(area.id), label: String(area.label || area.id) })).filter((area) => area.id);
}
function normSteps(src) {
  if (Array.isArray(src.atuSteps) && src.atuSteps.length) {
    return src.atuSteps.map((step) => ({
      id: String(step.id || uid("step")),
      label: String(step.label || "Step"),
      status: step.status === "done" || step.status === "in-progress" ? step.status : "not-started",
    }));
  }
  if (src.atu && typeof src.atu === "object") {
    return [
      { id: "tuition", label: "Pay the tuition fees", status: src.atu.tuition || "not-started" },
      { id: "visa", label: "Visa", status: src.atu.visa || "not-started" },
      { id: "travel", label: "Travel", status: src.atu.travel || "not-started" },
    ];
  }
  return null;
}
function normChecks(value) {
  if (Array.isArray(value) && value.length) {
    return value.map((item) => ({
      id: String(item.id || uid("check")),
      label: String(item.label || "Step"),
      detail: String(item.detail || ""),
      done: !!item.done,
    }));
  }
  if (value && typeof value === "object") {
    return [
      { id: "recommenders", label: "Recommenders", detail: "Three per school. I have one or two.", done: !!value.recommenders },
      { id: "essays", label: "Tailored essays", detail: "Start with Case Western Biomedical & Health Informatics.", done: !!value.essays },
      { id: "transcripts", label: "Transcripts and degree scans", detail: "Ready to attach.", done: !!value.transcripts },
    ];
  }
  return null;
}
function normWheel(value, areas) {
  if (!Array.isArray(value) || !value.length) return null;
  return value.map((entry) => {
    const scores = { ...BASELINE_SCORES };
    for (const area of areas) scores[area.id] = Number(entry.scores?.[area.id] ?? scores[area.id] ?? 0);
    return { date: entry.date || BASELINE_DATE, scores };
  });
}
function unwrap(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.data && typeof raw.data === "object" && (raw.data.goals || raw.data.vision || raw.data.logs)) return raw.data;
  if (raw.state && typeof raw.state === "object" && (raw.state.goals || raw.state.vision)) return raw.state;
  return raw;
}
export function normalize(raw) {
  const base = freshState();
  const src = unwrap(raw);
  if (!src) return base;
  const areas = normAreas(src.areas) || base.areas;
  return {
    ...base,
    ...src,
    version: VERSION,
    why: typeof src.why === "string" && src.why.trim() ? src.why : base.why,
    vision: typeof src.vision === "string" && src.vision.trim() ? src.vision : base.vision,
    mottos: Array.isArray(src.mottos) && src.mottos.length ? src.mottos.map((item) => String(item)) : base.mottos,
    areas,
    goals: Array.isArray(src.goals) && src.goals.length ? src.goals.map(normGoal) : base.goals,
    schools: Array.isArray(src.schools) && src.schools.length ? src.schools.map(normSchool) : base.schools,
    atuDate: src.atuDate || base.atuDate,
    atuSteps: normSteps(src) || base.atuSteps,
    checklist: normChecks(src.checklist) || base.checklist,
    schedule: normSchedule(src.schedule) || base.schedule,
    dayEdits: normEdits(src.dayEdits),
    logs: src.logs && typeof src.logs === "object" ? src.logs : {},
    priorityText: src.priorityText && typeof src.priorityText === "object" ? src.priorityText : {},
    modes: src.modes && typeof src.modes === "object" ? src.modes : {},
    inbox: Array.isArray(src.inbox) ? src.inbox : [],
    tasks: Array.isArray(src.tasks) ? src.tasks : [],
    someday: Array.isArray(src.someday) ? src.someday : [],
    notes: src.notes && typeof src.notes === "object" ? src.notes : {},
    nextWeek: src.nextWeek && typeof src.nextWeek === "object" ? src.nextWeek : {},
    books: src.books && typeof src.books === "object" ? src.books : {},
    posts: src.posts && typeof src.posts === "object" ? src.posts : {},
    wheel: normWheel(src.wheel, areas) || base.wheel,
    anchor: src.anchor || base.anchor,
    installedOn: src.installedOn || base.installedOn,
    lastExport: src.lastExport || null,
    lastCloudAt: src.lastCloudAt || null,
    cloudError: "",
    cloudEmail: src.cloudEmail || "",
    cloudProvider: src.cloudProvider === "microsoft" || src.cloudProvider === "google" ? src.cloudProvider : "",
    cloudClients: {
      google: (src.cloudClients && src.cloudClients.google) || "",
      microsoft: (src.cloudClients && src.cloudClients.microsoft) || "",
    },
    theme: src.theme || "",
    backupTime: src.backupTime || "10:00",
    focus: Array.isArray(src.focus) && src.focus.length ? src.focus.map(String) : base.focus,
    board: src.board && typeof src.board === "object" ? src.board : {},
  };
}
function normEdits(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, day] of Object.entries(value)) {
    if (!day || typeof day !== "object") continue;
    out[key] = {
      free: !!day.free,
      workStart: day.workStart || "",
      workEnd: day.workEnd || "",
      priorityKind: day.priorityKind || "custom",
      priority: String(day.priority || ""),
      goalId: String(day.goalId || ""),
      blocks: keepWorkout(Array.isArray(day.blocks) ? day.blocks.map(normBlock) : [], weekday(key)),
    };
  }
  return out;
}
export function resolvedDay(key, state) {
  const wd = weekday(key);
  const template = (state.schedule && state.schedule[wd]) || defaultSchedule()[wd];
  const edit = state.dayEdits && state.dayEdits[key];
  const source = edit || template;
  const free = !!source.free;
  const blocks = free ? [] : keepWorkout((source.blocks || []).map((item) => ({ ...item })), wd);
  return {
    wd,
    free,
    blocks,
    workStart: free ? "" : source.workStart || "",
    workEnd: free ? "" : source.workEnd || "",
    priorityKind: source.priorityKind || "custom",
    priority: source.priority || "",
    goalId: source.goalId || "",
    edited: !!edit,
  };
}
export function priorityFor(key, state) {
  const custom = state.priorityText && state.priorityText[key];
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  const day = resolvedDay(key, state);
  if (day.free || day.priorityKind === "none") return "";
  if (day.priorityKind === "atu") {
    if (tuesdayKind(key, state.anchor, state.modes) === "phd") {
      const next = nearestSchool(state.schools, key);
      return next ? `${next.school}, ${next.program}: one small step` : "One PhD step";
    }
    const step = (state.atuSteps || []).find((item) => item.status !== "done");
    return step ? `ATU Donegal: ${step.label}` : "ATU Donegal: one small step";
  }
  return day.priority || "";
}
export function linkedGoal(day, state) {
  const id = day.goalId || KIND_GOAL[day.priorityKind] || "";
  if (!id) return null;
  return (state.goals || []).find((goal) => goal.id === id) || null;
}
export function dayTracks(day) {
  return [...new Set((day.blocks || []).map((item) => item.track).filter(Boolean))];
}
export function weekStats(today, state) {
  const tue = weekTuesday(today);
  let done = 0;
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const date = addDays(tue, i);
    const day = resolvedDay(date, state);
    const tracks = dayTracks(day);
    const log = (state.logs || {})[date] || {};
    if (date > today) continue;
    for (const track of tracks) {
      total += 1;
      if (log[track]) done += 1;
    }
  }
  return { done, total };
}
export function keptStreak(today, state) {
  let streak = 0;
  for (let i = 1; i <= 90; i++) {
    const date = addDays(today, -i);
    const day = resolvedDay(date, state);
    const tracks = dayTracks(day);
    if (day.free || !tracks.length) continue;
    const log = (state.logs || {})[date] || {};
    if (tracks.every((track) => log[track])) streak += 1;
    else break;
  }
  return streak;
}
export function carriedItems(today, state) {
  const start = state.installedOn || "";
  if (!start || start >= today) return [];
  const out = [];
  for (let i = 1; i <= 14 && out.length < 3; i++) {
    const date = addDays(today, -i);
    if (date < start) break;
    const day = resolvedDay(date, state);
    if (day.free || !day.blocks.some((item) => item.track === "priority")) continue;
    const log = (state.logs || {})[date] || {};
    if (log.priority || log.released) continue;
    const text = priorityFor(date, state);
    if (text) out.push({ date, text });
  }
  return out;
}
export function rescoreDue(state, today) {
  const last = state.wheel && state.wheel[state.wheel.length - 1];
  if (!last) return true;
  return today >= addMonths(last.date, 1);
}
export function areaLabel(state, id) {
  return (state.areas || []).find((area) => area.id === id)?.label || id || "";
}
export function blankGoal(title = "New goal") {
  return { id: uid("goal"), area: "lifestyle", title, five: "", yearly: "", quarterly: "", monthly: "", weekly: "", status: "not-started", captures: [] };
}
export function blankSchool() {
  return { id: uid("school"), school: "New school", program: "", priority: "", final: "", feeLabel: "", fee: 0, optional: false, status: "not-started" };
}
export function blankBlock() {
  const id = uid("block");
  return { id, label: "New block", start: "18:00", end: "18:30", track: id };
}
