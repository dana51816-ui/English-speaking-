// Review-queue diagnosis: plays N days with the real scheduler, memory layer and planner of the test build,
// starting from a progress file, under a simple forgetting model, and compares scenarios.
// Forgetting model (assumption, not measured): a review answered at its due time succeeds with probability A;
// a late review with A^(elapsed/interval), so lateness costs recall. A is the scenario's "success".
// Time model: the app's own estimate (0.25 min per review question, 0.7 min per new word), plus one retry question per miss.
// Policies marked "proposed" are prototypes inside this simulation only; the app is unchanged.
// Run: node tools/sim-queue.js <progress.json> [days=180]
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
const SEED = process.argv[2], DAYS = +(process.argv[3] || 180);
const DAY = 86400000;

function run(o) {
  let clock = Date.UTC(2026, 10, 21, 8), rnd = o.seed || 11;
  Math.random = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
  global.window = { WP: {} }; const WP = global.window.WP;
  const load = f => eval(fs.readFileSync(path.join(root, f), "utf8").replace("(window.WP = window.WP || {})", "(WP)"));
  const data = JSON.parse(fs.readFileSync(SEED, "utf8")); data.profile = data.profile || {}; data.profile.focus = null;
  WP.Store = { now: () => clock, dayKey: t => new Date(t).toISOString().slice(0, 10), data };
  load("app/js/content.js");
  const C = WP.Content, get = f => JSON.parse(fs.readFileSync(fs.existsSync(path.join(root, "app-m5/content", f)) ? path.join(root, "app-m5/content", f) : path.join(root, "app/content", f), "utf8"));
  const course = get("course.json"), conf = get("confusions.json");
  C.items = (course.itemFiles || ["items.json"]).flatMap(f => get(f).items);
  // the pool never runs out in the simulation: clone items if needed so new-word supply is not the limit
  const base = C.items.slice(); for (let k = 1; C.items.length < 1200; k++) base.forEach(it => C.items.push(Object.assign({}, it, { id: it.id + "~" + k })));
  C.items.forEach(it => it.examples.forEach(ex => { const m = ex.s.match(/^(.*)\{(.+)\}(.*)$/); ex.pre = m[1]; ex.ans = m[2]; ex.post = m[3]; }));
  C.byId = Object.fromEntries(C.items.map(i => [i.id, i])); C.course = course;
  course.worlds.forEach(w => w.chapters.forEach(ch => ch.stages.forEach((s, i) => { C.stages.push(Object.assign({}, s, { chapter: ch.id, inChapter: i })); s.items.forEach(id => { C.chapterOf[id] = ch.id; }); })));
  // extra stages for cloned items, always open
  for (let k = 1; k < 6; k++) C.stages.push({ id: "x" + k, chapter: "x", inChapter: 0, items: base.map(it => it.id + "~" + k) });
  conf.pairs.forEach(p => { C.pairs[p.a + "|" + p.b] = p; C.pairs[p.b + "|" + p.a] = p; });
  load("app/js/scheduler.js"); load("app/js/exercises.js"); load("app-m5/js/memory.js"); load("app-m5/js/journey.js");
  const S = WP.Sched, M = WP.Mem, items = data.items; M.migrate(items);
  const unlocked0 = S.unlocked; S.unlocked = its => unlocked0(its).concat(["x1", "x2", "x3", "x4", "x5"]);

  // proposed: gentler lapse for words that had been stable (interval >= 3 days)
  if (o.lapse === "gentle") { const g0 = S.grade; S.grade = (st, r, now) => { if (r !== "fail" || !st || (st.ivl || 0) < 3) return g0(st, r, now); st = Object.assign(S.fresh(), st); st.reps++; st.last = now; st.lapses++; st.s = "review"; st.ivl = Math.max(1, Math.round(st.ivl * 0.4)); st.ease = Math.max(1.3, st.ease - 0.15); st.due = now + st.ivl * DAY - 2 * 3600000; return st; }; }
  // proposed: +-8% spread on intervals of 4+ days so words learned together stop arriving together
  if (o.fuzz) { const g1 = S.grade; S.grade = (st, r, now) => { const x = g1(st, r, now); if (x.ivl >= 4) { const f = Math.round(x.ivl * (Math.random() * .16 - .08)); x.ivl += f; x.due += f * DAY; } return x; }; }

  const risk = (st, now) => (now - st.last) / DAY / Math.max(1, st.ivl);
  const pRecall = (st, now) => Math.pow(o.acc, Math.max(1, (now - st.last) / DAY) / Math.max(1, st.ivl));
  const out = { reviews: 0, ok: 0, fresh: 0, minutes: [], backlog: [], late: [], lateDays: 0, lateN: 0, lapses: 0, goalMet: 0, goalDays: 0 };
  let doneHist = [], roundsHist = [], succHist = [];

  for (let d = 0; d < DAYS; d++) {
    const dayStart = clock;
    const dueAll = Object.keys(items).filter(id => S.isDue(items[id], clock));
    out.backlog.push(dueAll.length);
    // which kind of day: weekly rhythm for the proposed pacing (light / normal / challenge)
    const rhythm = o.rhythm ? ["n", "n", "l", "n", "c", "l", "n"][d % 7] : "n";
    let rounds = 1 + (Math.random() < (o.extra || 0) ? 1 : 0);
    let mins = 0, reviewsToday = 0, newToday = 0;
    for (let r = 0; r < rounds; r++) {
      const due = Object.keys(items).filter(id => S.isDue(items[id], clock));
      if (o.order === "risk") due.sort((a, b) => risk(items[b], clock) - risk(items[a], clock)); else due.sort((a, b) => items[a].due - items[b].due);
      let cap = o.cap;
      // new words
      let nNew;
      if (typeof o.newPolicy === "number") nNew = o.newPolicy;
      else if (o.newPolicy === "adaptive") {
        // proposed pacing. A round is a fixed short budget of question slots (~5 min). The daily target follows
        // (1) the coming week's review load against the rounds she actually plays, (2) her recent first-try success,
        // (3) a light / normal / challenge rhythm. Reviews always take their slots first.
        const B = o.budget || 20, roundsAvg = roundsHist.length ? roundsHist.slice(-7).reduce((x, y) => x + y, 0) / Math.min(7, roundsHist.length) : 1;
        const week = Object.values(items).filter(st => st.s !== "new" && st.due <= clock + 7 * DAY).length / 7;
        const sr = succHist.slice(-60), succ = sr.length >= 10 ? sr.filter(Boolean).length / sr.length : .85;
        nNew = Math.floor((B * roundsAvg - week * 1.3) / 4);
        if (succ < .75) nNew = 0; else if (succ < .85) nNew = Math.min(nNew, 2); else if (succ > .9) nNew++;
        if (due.length <= B && succ >= .8) nNew = Math.max(nNew, 1);
        if (rhythm === "l") nNew = Math.min(nNew, 1); if (rhythm === "c" && succ >= .85 && due.length < B) nNew += 2;
        nNew = Math.max(0, Math.min(6, nNew - newToday));
        cap = Math.max(8, (rhythm === "l" ? 14 : B) - 3 * nNew);
      } else nNew = r > 0 ? 0 : Math.max(2, Math.min(6, 6 - Math.floor(due.length / 4)));  // current rule
      const reviews = due.slice(0, cap);
      const pool = C.stages.filter(s => S.unlocked(items).indexOf(s.id) !== -1).flatMap(s => s.items).filter(id => !items[id] || items[id].s === "new").slice(0, nNew);
      M.sessionBuilds = 0; let prev = null;
      for (const id of reviews) {
        const st = items[id], late = (clock - st.due) / DAY;
        if (late >= 1) { out.lateN++; out.lateDays += late; }
        const task = { kind: "review", id }, t = WP.Ex.choose(task, st, prev); prev = t;
        const ok = Math.random() < pRecall(st, clock), L = M.levels(st);
        if (t === "build") M.record(st, "asm", ok); else if (task.think) M.record(st, "rcl", ok); else M.record(st, "rec", ok);
        const ns = S.grade(st, ok ? (task.think || L.rcl || t === "build" ? "good" : "recog") : "fail", clock); ns.ev = st.ev; items[id] = ns;
        out.reviews++; reviewsToday++; succHist.push(ok); if (ok) out.ok++; else out.lapses++;
        mins += 0.25 + (ok ? 0 : 0.25);
      }
      for (const id of pool) { const st = S.grade(S.fresh(), "learned", clock); M.ev(st); M.record(st, "rec", true); items[id] = st; out.fresh++; newToday++; mins += 0.7; }
      if (o.goal && r === 0) { // proposed: a second short round only if the most urgent reviews are not done yet and it is not a light day
        const urgent = Object.keys(items).filter(id => S.isDue(items[id], clock) && risk(items[id], clock) >= 1.5).length;
        out.goalDays++; if (urgent === 0) out.goalMet++;
        if (urgent > 0 && rhythm !== "l" && rounds === 1 && Math.random() < o.goal) rounds = 2;
      }
      clock += 3600000;
    }
    doneHist.push(reviewsToday); roundsHist.push(rounds);
    out.minutes.push(mins);
    clock = dayStart + DAY;
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const last60 = out.backlog.slice(-60), slope = (last60[last60.length - 1] - last60[0]) / 60;
  const active = Object.values(items).filter(st => st.s !== "new").length;
  const strong = Object.values(items).filter(st => st.s !== "new" && st.ivl >= 21).length;
  return {
    name: o.name, backlog: [30, 60, 90, 180].filter(x => x <= DAYS).map(x => out.backlog[x - 1]).join("→"), trend60: (slope >= 0 ? "+" : "") + slope.toFixed(2) + "/day",
    min: avg(out.minutes).toFixed(1), maxMin: Math.max(...out.minutes).toFixed(0), success: Math.round(out.ok / out.reviews * 100) + "%",
    lateShare: Math.round(out.lateN / out.reviews * 100) + "%", avgLate: out.lateN ? (out.lateDays / out.lateN).toFixed(1) : "0",
    newPerDay: (out.fresh / DAYS).toFixed(1), learned: active, strong21: strong, goal: out.goalDays ? Math.round(out.goalMet / out.goalDays * 100) + "%" : "-"
  };
}

const A = +(process.argv[4] || .85);
const sc = [
  { name: "today: cap 12, current new rule", cap: 12, newPolicy: "rule", acc: A },
  { name: "success 75%", cap: 12, newPolicy: "rule", acc: .75 },
  { name: "success 92%", cap: 12, newPolicy: "rule", acc: .92 },
  { name: "cap 20", cap: 20, newPolicy: "rule", acc: A },
  { name: "extra round on half the days", cap: 12, newPolicy: "rule", acc: A, extra: .5 },
  { name: "new fixed 1/day", cap: 12, newPolicy: 1, acc: A },
  { name: "new fixed 4/day", cap: 12, newPolicy: 4, acc: A },
  { name: "P1 risk order", cap: 12, newPolicy: "rule", acc: A, order: "risk" },
  { name: "P2 gentle lapse", cap: 12, newPolicy: "rule", acc: A, lapse: "gentle" },
  { name: "P3 adaptive new", cap: 12, newPolicy: "adaptive", acc: A },
  { name: "P1+P2+P3+fuzz", cap: 12, newPolicy: "adaptive", acc: A, order: "risk", lapse: "gentle", fuzz: true },
  { name: "proposed full (rhythm, 2nd round 60%)", cap: 12, newPolicy: "adaptive", acc: A, order: "risk", lapse: "gentle", fuzz: true, rhythm: true, goal: .6 },
  { name: "proposed full, success 75%", cap: 12, newPolicy: "adaptive", acc: .75, order: "risk", lapse: "gentle", fuzz: true, rhythm: true, goal: .6 },
  { name: "proposed full, she never plays a 2nd round", cap: 12, newPolicy: "adaptive", acc: A, order: "risk", lapse: "gentle", fuzz: true, rhythm: true, goal: 0 }
];
const P = { newPolicy: "adaptive", order: "risk", lapse: "gentle", fuzz: true, rhythm: true, goal: 0, cap: 12 };
if (process.argv[5] === "tradeoff") { sc.length = 0; for (const acc of [.85, .92]) for (const extra of [0, .5, 1]) for (const cap of [12, 16]) sc.push(Object.assign({}, P, { acc, extra, cap, name: "success " + acc * 100 + "%, round " + cap + ", rounds/day " + (1 + extra) })); }
const rows = [];
for (const o of sc) { const res = []; for (const seed of [11, 23, 37]) res.push(run(Object.assign({ seed }, o))); rows.push(res[0]); rows[rows.length - 1].spread = res.map(r => r.backlog.split("→").pop()).join("/"); }
console.table(rows);
