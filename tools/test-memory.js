// Unit tests for app-m5/js/memory.js: knowledge levels, migration of existing progress, scheduling and rollback safety.
// Run: node tools/test-memory.js
const path = require("path"), fs = require("fs");
const root = path.join(__dirname, "..");
let clock = Date.UTC(2026, 10, 20, 9);
global.window = {};
const WP = global.window.WP = {};
WP.Store = { now: () => clock, dayKey: t => { const d = new Date(t); return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate(); }, data: { profile: {} } };
const items = [{ id: "a", en: "that said", examples: [{ s: "x {target}" }], distractors: [{ t: "b" }, { t: "c" }] }];
WP.Content = { byId: { a: items[0] }, items };
global.window.WP = WP;
eval(fs.readFileSync(path.join(root, "app/js/scheduler.js"), "utf8").replace("(window.WP = window.WP || {})", "(WP)"));
WP.Ex = { capable: () => ["listen", "recall", "pick", "reverse", "gap"], choose: () => "pick" };
const S = WP.Sched;
const grade0 = S.grade, choose0 = WP.Ex.choose;
eval(fs.readFileSync(path.join(root, "app-m5/js/memory.js"), "utf8").replace("(window.WP = window.WP || {})", "(WP)"));
const M = WP.Mem;
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) pass++; else { fail++; console.log("FAIL:", name); } };
const day = () => { clock += 86400000; };

// 1. migration keeps the old fields and adds evidence
const learned = S.grade(S.fresh(), "learned", clock); learned.tr = { recall: [1, 1], pick: [2, 2] };
const snap = JSON.stringify(learned);
const store = { a: learned, n: S.fresh() };
t("migrate converts one word", M.migrate(store) === 1);
t("old fields untouched", ["ivl", "ease", "due", "reps", "s"].every(k => JSON.parse(snap)[k] === learned[k]));
t("level-2 word becomes recognized", M.levels(learned).rec === true);
t("migration grants no recall", M.levels(learned).rcl === false);
t("old self-report kept as support only", learned.ev.rcl.sr.length === 1 && learned.ev.rcl.d.length === 0);
t("migration is idempotent", M.migrate(store) === 0);
t("new words untouched", !store.n.ev);

// 2. recall needs two separate days
const w = S.grade(S.fresh(), "learned", clock); M.ev(w); M.record(w, "rec", true);
M.record(w, "rcl", true); M.record(w, "rcl", true);
t("two recalls on the same day are not enough", M.levels(w).rcl === false);
day(); M.record(w, "rcl", true);
t("verified recall on two days counts", M.levels(w).rcl === true);
M.record(w, "rcl", false);
t("a wrong claim drops recall until the next success", M.levels(w).rcl === false);
M.record(w, "rcl", true);
t("recovers after the next verified recall", M.levels(w).rcl === true);

// 3. self-report alone never proves recall
const v = S.fresh(); M.ev(v); M.record(v, "rec", true);
for (let i = 0; i < 3; i++) { M.record(v, "rcl", true, { self: true }); day(); }
t("self-report alone is not recall", M.levels(v).rcl === false);
M.record(v, "rcl", true);
t("one verified + self-report on another day counts", M.levels(v).rcl === true);

// 4. context needs two days and two different sentences
const c = S.fresh(); M.ev(c); M.record(c, "rec", true); M.record(c, "rcl", true); M.record(c, "ctx", true, { s: "s1" }); day(); M.record(c, "rcl", true); M.record(c, "ctx", true, { s: "s1" });
t("same sentence twice is not context", M.levels(c).ctx === false);
day(); M.record(c, "ctx", true, { s: "s2" });
t("two sentences on separate days is context", M.levels(c).ctx === true);

// 5. scheduling steps
const r1 = S.grade(Object.assign(S.fresh(), { s: "review", ivl: 4, ease: 2.3 }), "recog", clock);
t("recognition grows the interval gently", r1.ivl === 6 && r1.ease === 2.3);
const r2 = S.grade(Object.assign(S.fresh(), { s: "review", ivl: 4, ease: 2.3 }), "good", clock);
t("recall keeps the normal growth", r2.ivl === Math.max(5, Math.round(4 * 2.3)));
t("other grades untouched", S.grade(Object.assign(S.fresh(), { s: "review", ivl: 4 }), "fail", clock).ivl === 0);

// 6. exercise choice asks for recall once a word is recognized
const task = { kind: "review", id: "a" }, rec = S.grade(S.fresh(), "learned", clock); M.ev(rec); M.record(rec, "rec", true);
const ty = WP.Ex.choose(task, rec, "pick");
t("recognized word gets a think-first recall task", (ty === "reverse" || ty === "gap") && task.think === true);
const task2 = { kind: "review", id: "a" };
t("recalled word follows the normal choice", WP.Ex.choose(task2, w, null) === "pick" && !task2.think);

// 7. rollback: the previous engine still handles words that carry evidence
const back = grade0(Object.assign({}, w), "good", clock);
t("old scheduler accepts the new data", back.ivl >= 1 && back.ev);

// 8. retention log
const prof = {}; M.log(prof, "rec", true); M.log(prof, "rcl", false); M.claim(prof, true);
const rt = M.retention(prof, 7);
t("retention counts", rt.rN === 1 && rt.rOk === 1 && rt.cN === 1 && rt.cOk === 0 && rt.claims === 2 && rt.claimsOk === 1);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
