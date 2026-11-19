/* WORDPLAY exercise templates. Each template turns a lexical item (plus the pool) into one exercise.
   A template only runs when the item has the data it needs, so new content never produces a broken exercise. */
(function (WP) {
  "use strict";
  const X = WP.Ex = {};
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  X.shuffle = shuffle;

  X.SCENES = {
    party: { src: "img/scene-party.jpg", ratio: "720 / 533", need: 1,
      prompt: 'מי כאן <bdi class="en">reluctant</bdi>?', sub: "געי בדמות. כל אחת תגיד משהו.",
      spots: [
        { x: 10.3, y: 14.6, w: 27.2, h: 77.4, ok: false, en: "A party? Let's GO! I love parties!", he: '<bdi class="en">eager</bdi> = להוט. ההפך הגמור.' },
        { x: 38.3, y: 14.6, w: 21.2, h: 77.4, ok: true, en: "Fine... I'll go in. If I must.", he: "לא רוצה, אבל נכנסת בכל זאת." },
        { x: 60.4, y: 16, w: 21.3, h: 76, ok: false, en: "*yawn* ...is it over yet?", he: '<bdi class="en">bored</bdi> = משועמם. הוא לא מתנגד, פשוט משעמם לו.' }
      ] },
    desk: { src: "img/scene-desk.jpg", ratio: "720 / 664", need: 1,
      prompt: 'הוא כל הזמן <bdi class="en">procrastinates</bdi>. על מה?', sub: "געי בדבר שהוא דוחה שוב ושוב.",
      spots: [
        { x: 16.5, y: 6.9, w: 20.4, h: 69, ok: true, en: "The report. Due yesterday.", he: "בדיוק. הערימה מחכה, והוא דוחה." },
        { x: 51.9, y: 41, w: 12, h: 15, ok: false, en: "Just one more video...", he: "זה מה שהוא עושה <b>במקום</b>. הדבר שהוא דוחה נמצא ליד." },
        { x: 76.6, y: 3.9, w: 16, h: 17, ok: false, en: "It's very late.", he: "רמז טוב, אבל השעון הוא לא המשימה." },
        { x: 70, y: 79, w: 22, h: 16, ok: false, en: "Zzz.", he: "החתול לא דוחה כלום. הוא פשוט ישן." }
      ] },
    shop: { src: "img/scene-shop.jpg", ratio: "720 / 611", need: 2,
      prompt: 'געי בשני דברים שהם <bdi class="en">fragile</bdi>', sub: "מר פּוֹטֶר מבקש. החתול כבר בדרך.",
      spots: [
        { x: 14.4, y: 6.2, w: 11.5, h: 20, ok: true, en: "glass vase", he: "זכוכית דקה. שביר." },
        { x: 29, y: 19, w: 12.3, h: 11, ok: true, en: "teacup", he: "פורצלן דק. שביר." },
        { x: 42.4, y: 12.2, w: 10.2, h: 17.5, ok: true, en: "glass ornament", he: "קישוט זכוכית. שביר." },
        { x: 53.2, y: 14, w: 8.1, h: 16, ok: true, en: "wine glass", he: "גביע דק. שביר." },
        { x: 62.8, y: 10, w: 10.6, h: 20, ok: true, en: "glass dome", he: "כיפת זכוכית. שביר." },
        { x: 17.4, y: 48.5, w: 19.5, h: 14, ok: false, en: "anvil", he: 'סדן ברזל. <bdi class="en">sturdy</bdi>: יציב, ההפך מ-fragile.' },
        { x: 51.3, y: 47.3, w: 28, h: 15.5, ok: false, en: "wooden crate", he: 'ארגז עץ. <bdi class="en">sturdy</bdi>.' },
        { x: 20, y: 80.5, w: 15.3, h: 13, ok: false, en: "stone", he: "אבן. אי אפשר לשבור אותה בטעות." },
        { x: 42.2, y: 74.7, w: 17, h: 19, ok: false, en: "iron kettle", he: 'קומקום ברזל. <bdi class="en">sturdy</bdi>.' },
        { x: 63.8, y: 83.5, w: 17, h: 10.5, ok: false, en: "brick", he: 'לבנה. <bdi class="en">sturdy</bdi>.' }
      ] }
  };

  /* Which templates can run for an item. */
  X.capable = function (item) {
    const t = ["listen", "recall"];
    if (item.distractors && item.distractors.length >= 2 && item.examples && item.examples.length) t.push("gap");
    if (item.scene && X.SCENES[item.scene]) t.push("scene");
    return t;
  };

  /* Pick a template: favour the weakest measured track, avoid repeating the previous type. */
  X.choose = function (task, st, prevType) {
    const item = WP.Content.byId[task.id];
    const can = X.capable(item);
    if (can.indexOf("scene") !== -1 && !task.sceneUsed && prevType !== "scene" && !(st && st.tr && st.tr.scene && st.tr.scene[0] > 0)) return "scene";
    let pref = task.kind === "check" && task.stage === 1 ? ["listen", "gap"] : task.kind === "check" ? ["recall", "gap", "listen"] : ["listen", "gap", "recall"];
    pref = pref.filter(t => can.indexOf(t) !== -1);
    if (task.kind === "review" && st && st.tr) {
      const score = t => { const r = st.tr[t]; return r ? r[0] / r[1] : 0.5; };
      pref = shuffle(pref).sort((a, b) => score(a) - score(b));
    } else if (task.kind !== "check" || task.stage === 1) pref = shuffle(pref);
    const ok = pref.filter(t => t !== prevType && t !== task.lastType);
    return (ok[0] || pref[0] || "recall");
  };

  X.listen = function (item) {
    const C = WP.Content, others = shuffle(C.items.filter(x => x.id !== item.id));
    const near = others.filter(x => C.confusion(x.id, item.id));
    const same = others.filter(x => near.indexOf(x) === -1 && x.domains.some(d => item.domains.indexOf(d) !== -1));
    const rest = others.filter(x => near.indexOf(x) === -1 && same.indexOf(x) === -1);
    const picks = near.slice(0, 1).concat(same, rest).slice(0, 3);
    return { opts: shuffle([{ item: item, ok: true }].concat(picks.map(x => ({ item: x, ok: false })))) };
  };

  X.gap = function (item) {
    const why = {}; item.distractors.forEach(d => { why[d.t] = d.why; });
    return { opts: shuffle([item.ans].concat(item.distractors.slice(0, 2).map(d => d.t))), why: why };
  };

  X.match = function (ids, audio) {
    const items = shuffle(ids).slice(0, 4).map(id => WP.Content.byId[id]);
    return { items: items, audio: !!audio, left: shuffle(items), right: shuffle(items) };
  };
})(window.WP = window.WP || {});
