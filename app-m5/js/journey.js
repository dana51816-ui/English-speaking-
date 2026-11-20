/* WORDPLAY journey (test build): seasons open in parallel.
   The first chapter of every season after the first opens once the very first stage of the journey passes the bar.
   Within a season the existing rule is unchanged. Remove this file to restore strictly sequential seasons. */
(function (WP) {
  "use strict";
  const S = WP.Sched, unlocked0 = S.unlocked;
  S.unlocked = function (items) {
    const open = unlocked0(items), C = WP.Content, first = C.stages[0];
    if (!first || !S.meets(first, items)) return open;
    (C.course.worlds || []).slice(1).forEach(w => {
      const ch = w.chapters[0], st = ch && C.stages.find(s => s.chapter === ch.id && s.inChapter === 0);
      if (!st || open.indexOf(st.id) !== -1) return;
      open.push(st.id);
      // later stages in that chapter follow the usual rule: the previous stage must pass the bar
      C.stages.filter(s => s.chapter === ch.id && s.inChapter > 0).forEach(s => { const prev = C.stages.find(x => x.chapter === ch.id && x.inChapter === s.inChapter - 1); if (open.indexOf(prev.id) !== -1 && S.meets(prev, items) && open.indexOf(s.id) === -1) open.push(s.id); });
    });
    return C.stages.filter(s => open.indexOf(s.id) !== -1).map(s => s.id);
  };

  /* Focus: new words come from the chapter she chose. Reviews are untouched, and nothing is blocked. */
  const plan0 = S.plan;
  S.plan = function (items, now, opts) {
    const p = plan0(items, now, opts), f = WP.Store && WP.Store.data && WP.Store.data.profile.focus;
    if (!f || (opts && opts.weak)) return p;
    const open = S.unlocked(items), C = WP.Content;
    const pool = C.stages.filter(s => s.chapter === f && open.indexOf(s.id) !== -1).flatMap(s => s.items).filter(id => !items[id] || items[id].s === "new");
    if (!pool.length) return p;
    const n = Math.min(pool.length, Math.max(p.fresh.length, p.recNew || 2));
    p.fresh = pool.slice(0, n);
    p.minutes = Math.max(2, Math.round(p.reviews.length * 0.25 + p.fresh.length * 0.7 + 0.5));
    return p;
  };
})(window.WP = window.WP || {});
