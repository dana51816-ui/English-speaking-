/* WORDPLAY scheduler: per-item memory state and session planning.
   Kept independent from content and UI so it can later be swapped for FSRS. */
(function (WP) {
  "use strict";
  const DAY = 86400000, MIN = 60000;
  const S = WP.Sched = {};

  S.fresh = () => ({ s: "new", due: 0, ivl: 0, ease: 2.3, reps: 0, lapses: 0, seen: 0, first: 0, last: 0, upd: 0, tr: {} });

  /* 0 not seen, 1 seen but not yet recalled, 2 recalled once, 3 familiar (3+ days), 4 strong (21+ days) */
  S.level = st => !st || st.s === "new" ? 0 : st.s === "learning" ? 1 : st.ivl >= 21 ? 4 : st.ivl >= 3 ? 3 : 2;
  S.isDue = (st, now) => st && st.s !== "new" && st.due <= now;

  /* result: "learned" | "notyet" (new items), "good" | "partial" | "fail" (reviews) */
  S.grade = function (st, result, now) {
    st = Object.assign(S.fresh(), st || {});
    if (!st.first) st.first = now;
    st.reps++; st.last = now; st.upd = now;
    if (result === "learned") { st.s = "review"; st.ivl = 1; }
    else if (result === "notyet") { st.s = "learning"; st.ivl = 0; }
    else if (result === "good") {
      if (st.s === "learning" || st.ivl < 1) { st.s = "review"; st.ivl = 1; }
      else { st.ivl = Math.max(st.ivl + 1, Math.round(st.ivl * st.ease)); st.ease = Math.min(3, st.ease + 0.05); }
    } else if (result === "partial") {
      st.s = "review"; st.ivl = Math.max(1, Math.round(st.ivl * 1.2)); st.ease = Math.max(1.3, st.ease - 0.05);
    } else if (result === "fail") {
      st.lapses++; st.s = "learning"; st.ivl = 0; st.ease = Math.max(1.3, st.ease - 0.2);
    }
    st.due = st.ivl > 0 ? now + st.ivl * DAY - 2 * 3600000 : now + 10 * MIN;
    return st;
  };

  /* Track-level evidence (listen, gap, recall, scene, match): [correct, attempts]. */
  S.track = function (st, type, ok) {
    st.tr = st.tr || {}; const t = st.tr[type] || [0, 0]; t[1]++; if (ok) t[0]++; st.tr[type] = t; return st;
  };

  /* A stage opens when the stage before it (in its chapter) is fully introduced and 60% recalled.
     A chapter's first stage opens when the previous chapter's first stage passes the same bar,
     so several chapters can run in parallel and weak items never block progress. */
  S.meets = function (stage, items) {
    const st = stage.items.map(id => items[id]);
    return st.every(x => x && x.s !== "new") && st.filter(x => S.level(x) >= 2).length / st.length >= 0.6;
  };
  S.unlocked = function (items) {
    const stages = WP.Content.stages, open = [];
    const firstOf = {}; stages.forEach(s => { if (s.inChapter === 0) firstOf[s.chapter] = s; });
    const chapters = WP.Content.chapters();
    stages.forEach((s, i) => {
      if (i === 0) { open.push(s.id); return; }
      if (s.inChapter > 0) { if (open.indexOf(stages[i - 1].id) !== -1 && S.meets(stages[i - 1], items)) open.push(s.id); return; }
      const ci = chapters.findIndex(c => c.id === s.chapter), prevFirst = ci > 0 ? firstOf[chapters[ci - 1].id] : null;
      if (prevFirst && open.indexOf(prevFirst.id) !== -1 && S.meets(prevFirst, items)) open.push(s.id);
    });
    return open;
  };

  /* Weakest seen items first: lapses, low ease, not yet recalled. */
  S.weak = function (items, n) {
    const score = st => (st.lapses || 0) * 2 + (st.ease < 2.1 ? 1 : 0) + (S.level(st) <= 1 ? 2 : S.level(st) === 2 ? 1 : 0);
    return Object.keys(items).filter(id => WP.Content.byId[id] && items[id].s !== "new" && score(items[id]) > 0)
      .sort((a, b) => score(items[b]) - score(items[a])).slice(0, n || 10);
  };

  S.plan = function (items, now, opts) {
    opts = opts || {};
    if (opts.weak) { const w = S.weak(items, 10); return { reviews: w, fresh: [], dueTotal: w.length, recNew: 0, poolLeft: 0, minutes: Math.max(2, Math.round(w.length * 0.3 + 0.5)), weak: true }; }
    const all = WP.Content.items;
    const due = all.filter(it => S.isDue(items[it.id], now)).sort((a, b) => items[a.id].due - items[b.id].due);
    const maxRev = opts.maxReviews || 12;
    const reviews = due.slice(0, maxRev).map(i => i.id);
    const recNew = Math.max(2, Math.min(6, 6 - Math.floor(due.length / 4)));
    const open = S.unlocked(items);
    const pool = WP.Content.stages.filter(s => open.indexOf(s.id) !== -1).flatMap(s => s.items).filter(id => !items[id] || items[id].s === "new");
    const nNew = Math.min(pool.length, opts.extraNew ? recNew + 4 : recNew);
    const fresh = pool.slice(0, nNew);
    return { reviews, fresh, dueTotal: due.length, recNew, poolLeft: pool.length - fresh.length, minutes: Math.max(2, Math.round((reviews.length * 0.25 + fresh.length * 0.7) + 0.5)) };
  };

  S.forecast = function (items, from, hours) {
    const until = from + hours * 3600000;
    return Object.values(items).filter(st => st && st.s !== "new" && st.due <= until).length;
  };

  S.counts = function (items) {
    const v = Object.values(items);
    return { seen: v.filter(st => S.level(st) >= 1).length, understood: v.filter(st => S.level(st) >= 2).length, solid: v.filter(st => S.level(st) >= 3).length, strong: v.filter(st => S.level(st) >= 4).length };
  };
})(window.WP = window.WP || {});
