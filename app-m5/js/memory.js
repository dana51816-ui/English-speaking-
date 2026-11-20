/* WORDPLAY memory v2: kinds of evidence on top of the existing scheduler.
   M5.3: recall is split. "rcl" is reported recall (committed before seeing options, then verified by a choice or a build).
   "asm" is assembling the phrase from word tiles after the situation alone: stronger than choosing, still not free recall.
   Free recall without any cue (future, by speech) is not measured yet and nothing here claims it.
   recognition  (rec): picked the right answer when shown options, after a delay (later in the session or another day).
   recall       (rcl): said "I've got it" BEFORE seeing options, then picked it. A claim that turns out wrong is a recall miss.
                       A silent-recall self-report ("I knew it") counts as supporting evidence only, never on its own.
   contextual   (ctx): a verified recall inside a sentence, in at least two different sentences.
   Levels need evidence on two separate days (a lucky guess among 4 options repeats on another day ~6% of the time),
   and the most recent attempt at that level must have succeeded.
   One schedule per word, as before. Only the size of the step changes:
   a demonstrated recall grows the interval normally; recognition alone grows it gently and asks for recall next time.
   Additive data only (st.ev, profile.mlog, profile.engine). Removing this file returns the app to the previous engine. */
(function (WP) {
  "use strict";
  const M = WP.Mem = {};
  const today = () => WP.Store.dayKey(WP.Store.now());
  M.blank = () => ({ rec: { d: [], n: 0, ok: 0, last: null }, rcl: { d: [], sr: [], n: 0, ok: 0, last: null }, asm: { d: [], n: 0, ok: 0, last: null }, ctx: { d: [], s: [], n: 0, ok: 0, last: null } });
  M.ev = st => { if (!st.ev) st.ev = M.blank(); if (!st.ev.asm) st.ev.asm = { d: [], n: 0, ok: 0, last: null }; return st.ev; };
  const add = (arr, v, max) => { if (arr.indexOf(v) === -1) { arr.push(v); if (arr.length > max) arr.shift(); } };

  M.record = function (st, kind, ok, extra) {
    const e = M.ev(st)[kind]; extra = extra || {};
    if (kind === "rcl" && extra.self) { if (ok) add(e.sr, today(), 8); else e.last = 0; return; }
    e.n++; e.last = ok ? 1 : 0;
    if (ok) { e.ok++; add(e.d, today(), 8); if (kind === "ctx" && extra.s) add(e.s, extra.s, 6); }
  };

  M.levels = function (st) {
    const e = st && st.ev; if (!e) return { rec: false, rcl: false, asm: false, ctx: false };
    const rec = e.rec.ok >= 1 && e.rec.last !== 0;
    const extraDays = e.rcl.sr.filter(x => e.rcl.d.indexOf(x) === -1).length;
    const rcl = (e.rcl.d.length >= 2 || (e.rcl.d.length >= 1 && extraDays >= 1)) && e.rcl.last !== 0;
    const ctx = e.ctx.d.length >= 2 && e.ctx.s.length >= 2 && e.ctx.last !== 0;
    const asm = !!(e.asm && e.asm.d.length >= 2 && e.asm.last !== 0);
    return { rec: rec || rcl || asm, rcl, asm, ctx: ctx && rcl };
  };
  M.counts = function (items) {
    const c = { seen: 0, rec: 0, rcl: 0, asm: 0, ctx: 0 };
    for (const id in items) { const st = items[id]; if (!st || st.s === "new" || !WP.Content.byId[id]) continue; c.seen++; const L = M.levels(st); if (L.rec) c.rec++; if (L.rcl) c.rcl++; if (L.asm) c.asm++; if (L.ctx) c.ctx++; }
    return c;
  };

  /* recall is asked for once a word is recognized and not yet reliably recalled */
  M.wantsRecall = st => { if (!st || st.s === "new") return false; const L = M.levels(st); return L.rec && !L.rcl; };

  /* one-time, additive conversion of existing progress */
  M.migrate = function (items) {
    let n = 0;
    for (const id in items) {
      const st = items[id]; if (!st || st.ev || st.s === "new") continue;
      const e = M.ev(st), d = WP.Store.dayKey(st.last || st.first || WP.Store.now());
      // words that passed the delayed in-session check (level 2+) were recognized under the old engine
      if (WP.Sched.level(st) >= 2) { e.rec.ok = 1; e.rec.n = 1; e.rec.last = 1; e.rec.d = [d]; e.legacy = 1; }
      // old silent-recall self-reports become supporting recall evidence, never proof on their own
      const sr = st.tr && st.tr.recall; if (sr && sr[0] > 0) e.rcl.sr = [d];
      n++;
    }
    return n;
  };

  /* honest retention log: first attempt at a review of a word last seen at least a day ago */
  M.log = function (profile, kind, ok) {
    profile.mlog = profile.mlog || {};
    const k = today(), L = profile.mlog[k] = profile.mlog[k] || { rN: 0, rOk: 0, cN: 0, cOk: 0, claims: 0, claimsOk: 0 };
    if (kind === "rec") { L.rN++; if (ok) L.rOk++; } else if (kind === "rcl") { L.cN++; if (ok) L.cOk++; L.claims++; if (ok) L.claimsOk++; }
  };
  M.claim = function (profile, ok) { profile.mlog = profile.mlog || {}; const k = today(), L = profile.mlog[k] = profile.mlog[k] || { rN: 0, rOk: 0, cN: 0, cOk: 0, claims: 0, claimsOk: 0 }; L.claims++; if (ok) L.claimsOk++; };
  M.retention = function (profile, days) {
    const out = { rN: 0, rOk: 0, cN: 0, cOk: 0, claims: 0, claimsOk: 0 }, now = WP.Store.now();
    for (let i = 0; i < (days || 7); i++) { const L = (profile.mlog || {})[WP.Store.dayKey(now - i * 86400000)]; if (L) for (const k in out) out[k] += L[k] || 0; }
    return out;
  };

  /* scheduler: a gentler step for recognition-only answers */
  const grade0 = WP.Sched.grade;
  WP.Sched.grade = function (st, result, now) {
    if (result !== "recog") return grade0(st, result, now);
    st = Object.assign(WP.Sched.fresh(), st || {});
    if (!st.first) st.first = now;
    st.reps++; st.last = now; st.upd = now; st.s = "review";
    st.ivl = Math.max(1, Math.round(Math.max(1, st.ivl) * 1.5));
    st.due = now + st.ivl * 86400000 - 2 * 3600000;
    return st;
  };

  /* the phrase builder joins the exercise set for multi-word items that carry build data */
  M.buildable = item => !!(item && item.build && item.en.replace(/[?!.]/g, "").trim().split(/\s+/).length >= 2);
  const capable0 = WP.Ex.capable;
  WP.Ex.capable = item => { const c = capable0(item); return M.buildable(item) ? c.concat(["build"]) : c; };
  M.sessionBuilds = 0; const MAX_BUILDS = 2;

  /* exercise choice: once recognized, multi-word items are rebuilt from the situation; other items ask for recall (think first) */
  const choose0 = WP.Ex.choose;
  WP.Ex.choose = function (task, st, prevType) {
    const delayed = task.kind === "review" || (task.kind === "check" && task.stage === 2 && st && st.s !== "new" && st.ivl >= 1);
    const item = WP.Content.byId[task.id];
    if (delayed && st && st.s !== "new" && M.buildable(item) && prevType !== "build" && M.sessionBuilds < MAX_BUILDS) {
      const L = M.levels(st);
      if (L.rec && (!L.asm || Math.random() < .25)) { M.sessionBuilds++; task.think = true; return "build"; }
    }
    if (delayed && M.wantsRecall(st)) {
      const item = WP.Content.byId[task.id], can = WP.Ex.capable(item);
      const L = M.levels(st), pref = (st.ev.rcl.d.length >= 1 && !L.ctx ? ["gap", "reverse"] : ["reverse", "gap"]).filter(t => can.indexOf(t) !== -1 && t !== prevType);
      if (pref.length) { task.think = true; return pref[0]; }
    }
    let t = choose0(task, st, prevType); if (t === "build") t = "reverse";
    task.think = task.kind === "review" && (t === "reverse" || t === "gap") && M.levels(st).rec;
    return t;
  };
})(window.WP = window.WP || {});
