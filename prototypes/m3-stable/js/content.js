/* WORDPLAY content layer: loads lexical items, course structure and confusion pairs.
   Items are pure data. Exercises are generated from them by exercises.js. */
(function (WP) {
  "use strict";
  const C = WP.Content = { items: [], byId: {}, course: null, stages: [], stageOf: {}, chapterOf: {}, pairs: {}, ready: false };

  function prepItem(it) {
    it.examples.forEach(ex => {
      const m = ex.s.match(/^(.*)\{(.+)\}(.*)$/);
      ex.pre = m[1]; ex.ans = m[2]; ex.post = m[3]; ex.plain = m[1] + m[2] + m[3];
    });
    const ex = it.examples[0];
    Object.assign(it, { pre: ex.pre, ans: ex.ans, post: ex.post, plain: ex.plain });
    return it;
  }

  C.load = async function () {
    const get = async f => { const r = await fetch("content/" + f, { cache: "no-cache" }); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); };
    const [course, conf] = await Promise.all([get("course.json"), get("confusions.json")]);
    const files = await Promise.all((course.itemFiles || ["items.json"]).map(get));
    C.items = files.flatMap(f => f.items).map(prepItem);
    C.byId = Object.fromEntries(C.items.map(i => [i.id, i]));
    C.course = course;
    C.stages = [];
    course.worlds.forEach(w => w.chapters.forEach(ch => ch.stages.forEach((s, i) => {
      const st = Object.assign({}, s, { chapter: ch.id, chapterTitle: ch.title, color: ch.color, icon: ch.icon, index: C.stages.length, inChapter: i });
      C.stages.push(st);
      s.items.forEach(id => { C.stageOf[id] = st.id; C.chapterOf[id] = ch.id; });
    })));
    C.pairs = {};
    conf.pairs.forEach(p => { C.pairs[p.a + "|" + p.b] = p; C.pairs[p.b + "|" + p.a] = { a: p.b, b: p.a, a_note: p.b_note, b_note: p.a_note }; });
    C.ready = true;
  };

  /* Precise explanation for two items people mix up, or null. */
  C.confusion = function (aId, bId) {
    const p = C.pairs[aId + "|" + bId];
    if (!p) return null;
    return [C.byId[p.a].en, p.a_note, C.byId[p.b].en, p.b_note];
  };
  C.chapters = () => C.course.worlds.flatMap(w => w.chapters);
})(window.WP = window.WP || {});
