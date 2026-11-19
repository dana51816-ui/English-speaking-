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

  /* A stage opens when the previous one is fully introduced and 60% of it was recalled at least once.
     Weak items never block: they keep returning in reviews. */
  S.unlocked = function (items) {
    const stages = WP.Content.stages, open = [];
    for (let i = 0; i < stages.length; i++) {
      if (i === 0) { open.push(stages[i].id); continue; }
      const prev = stages[i - 1].items.map(id => items[id]);
      const allSeen = prev.every(st => st && st.s !== "new");
      const solid = prev.filter(st => S.level(st) >= 2).length / prev.length;
      if (allSeen && solid >= 0.6) open.push(stages[i].id); else break;
    }
    return open;
  };

  S.plan = function (items, now, opts) {
    opts = opts || {};
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
