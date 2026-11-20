// Variety simulation: plays one session a day for N days with the real planner and exercise choice (test build engine),
// starting from a progress file, and reports how varied the sessions are. No UI. Run:
// node tools/sim-variety.js <seed.json> [days=60] [accuracy=0.85] [contentDir=app-m5/content]
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
const SEED = process.argv[2], DAYS = +(process.argv[3] || 60), ACC = +(process.argv[4] || .85), CDIR = process.argv[5] || "app-m5/content";
let clock = Date.UTC(2026, 10, 21, 8);
let rnd = 7; Math.random = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
global.window = { WP: {} }; const WP = global.window.WP;
const load = f => eval(fs.readFileSync(path.join(root, f), "utf8").replace("(window.WP = window.WP || {})", "(WP)"));
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
WP.Store = { now: () => clock, dayKey: t => new Date(t).toISOString().slice(0, 10), data: seed };
seed.profile = seed.profile || {}; seed.profile.focus = null;
load("app/js/content.js");
const C = WP.Content, get = f => JSON.parse(fs.readFileSync(fs.existsSync(path.join(root, CDIR, f)) ? path.join(root, CDIR, f) : path.join(root, "app/content", f), "utf8"));
(function () { // same as C.load without fetch
  const course = get("course.json"), conf = get("confusions.json");
  C.items = (course.itemFiles || ["items.json"]).flatMap(f => get(f).items);
  C.items.forEach(it => it.examples.forEach(ex => { const m = ex.s.match(/^(.*)\{(.+)\}(.*)$/); ex.pre = m[1]; ex.ans = m[2]; ex.post = m[3]; }));
  C.items.forEach(it => Object.assign(it, { ans: it.examples[0].ans }));
  C.byId = Object.fromEntries(C.items.map(i => [i.id, i])); C.course = course;
  course.worlds.forEach(w => w.chapters.forEach(ch => ch.stages.forEach((s, i) => { C.stages.push(Object.assign({}, s, { chapter: ch.id, inChapter: i })); s.items.forEach(id => { C.chapterOf[id] = ch.id; }); })));
  conf.pairs.forEach(p => { C.pairs[p.a + "|" + p.b] = p; C.pairs[p.b + "|" + p.a] = p; });
})();
load("app/js/scheduler.js"); load("app/js/exercises.js"); load("app-m5/js/memory.js"); load("app-m5/js/journey.js");
const S = WP.Sched, M = WP.Mem, items = seed.items;
M.migrate(items);

const out = { sessions: 0, reviews: 0, fresh: 0, poolEmptyDay: null, maxReviews: 0, types: {}, sameTypeRun: 0, dominantType: 0, sentenceRepeat: [0, 0], chaptersPerSession: [], pairStick: [0, 0], longGapDays: 0, buildsPerSession: [], firstConv: null };
const lastSent = {}, lastSet = {}, trace = [];
for (let d = 0; d < DAYS; d++) {
  const p = S.plan(items, clock, {});
  if (!p.reviews.length && !p.fresh.length) { clock += 86400000; continue; }
  if (d % 10 === 0) trace.push(p.dueTotal);
  if (!p.fresh.length && out.poolEmptyDay === null && p.poolLeft === 0) out.poolEmptyDay = d;
  out.sessions++; out.reviews += p.reviews.length; out.fresh += p.fresh.length; out.maxReviews = Math.max(out.maxReviews, p.dueTotal);
  M.sessionBuilds = 0;
  let prev = null, run = 1, tc = {}, n = 0, builds = 0;
  const chs = new Set(p.reviews.map(id => C.chapterOf[id]));
  out.chaptersPerSession.push(chs.size);
  // do review pairs that came together last time come together again?
  const set = new Set(p.reviews);
  p.reviews.forEach(id => { const ls = lastSet[id]; if (ls) { ls.forEach(o => { if (o !== id) { out.pairStick[1]++; if (set.has(o)) out.pairStick[0]++; } }); } });
  p.reviews.forEach(id => { lastSet[id] = [...set]; });
  for (const id of p.reviews) {
    const task = { kind: "review", id }, st = items[id];
    const t = WP.Ex.choose(task, st, prev); n++; tc[t] = (tc[t] || 0) + 1; out.types[t] = (out.types[t] || 0) + 1;
    if (t === "build") builds++;
    if (t === prev) { run++; out.sameTypeRun = Math.max(out.sameTypeRun, run); } else run = 1; prev = t;
    if (t === "gap") { const ex = WP.Ex.example(C.byId[id]); out.sentenceRepeat[1]++; if (lastSent[id] === ex.s) out.sentenceRepeat[0]++; lastSent[id] = ex.s; }
    const ok = Math.random() < ACC;
    const L = M.levels(st);
    if (t === "build") M.record(st, "asm", ok); else if (task.think) M.record(st, "rcl", ok); else M.record(st, "rec", ok);
    items[id] = S.grade(st, ok ? (task.think || L.rcl ? "good" : "recog") : "fail", clock);
    items[id].ev = st.ev; items[id].tr = st.tr;
  }
  out.buildsPerSession.push(builds);
  if (n && Math.max(...Object.values(tc)) / n > .5 && n >= 6) out.dominantType++;
  if (out.firstConv == null && p.fresh.some(id => C.chapterOf[id] === "c10")) out.firstConv = d;
  for (const id of p.fresh) { const st = S.grade(S.fresh(), "learned", clock); M.ev(st); M.record(st, "rec", true); items[id] = st; }
  clock += 86400000;
}
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "-";
console.log(JSON.stringify({
  days: DAYS, sessions: out.sessions, avgReviews: +(out.reviews / out.sessions).toFixed(1), avgNew: +(out.fresh / out.sessions).toFixed(1), peakDue: out.maxReviews,
  newWordsRunOutOnDay: out.poolEmptyDay, types: out.types, longestSameTypeRun: out.sameTypeRun, sessionsDominatedByOneType: pct(out.dominantType, out.sessions),
  gapSentenceSameAsLastTime: pct(out.sentenceRepeat[0], out.sentenceRepeat[1]), avgChaptersPerSession: +(out.chaptersPerSession.reduce((a, b) => a + b, 0) / out.sessions).toFixed(1),
  reviewMatesReturnTogether: pct(out.pairStick[0], out.pairStick[1]), dueEvery10Days: trace.join(" "), firstConversationDay: out.firstConv, learnedTotal: Object.values(items).filter(s => s && s.s !== "new").length, contentTotal: C.items.length
}, null, 1));
