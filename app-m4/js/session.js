/* WORDPLAY session runner: one continuous stage, tasks in a queue, in-session spacing.
   Each exercise type has its own set piece; all share the same HUD, feedback and rhythm. */
(function (WP) {
  "use strict";
  const U = WP.UI, X = WP.Ex;
  const R = WP.Session = {};
  const TYPE = {
    intro: { label: "מילה חדשה", color: "var(--intro)" }, listen: { label: "שמיעה", color: "var(--listen)" },
    gap: { label: "השלמת משפט", color: "var(--gap)" }, recall: { label: "שליפה שקטה", color: "var(--recall)" },
    match: { label: "התאמה", color: "var(--match)" }, scene: { label: "סצנה", color: "var(--scene)" },
    pick: { label: "טריוויה", color: "var(--pick)" }, reverse: { label: "איך אומרים?", color: "var(--reverse)" }
  };
  const SHAPES = [
    '<svg viewBox="0 0 20 20"><path d="M10 2l8 8-8 8-8-8z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 20 20"><path d="M10 2l8.5 15h-17z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="currentColor"/></svg>'
  ];
  let Q, pos, prev, cur, answered, combo, best, sinceMatch, matches, seen, res, lockUntil, autoT, onEnd, stageEl, actEl, firstNewShown, startedAt, orb, stats, anyOk;
  const $ = s => stageEl.querySelector(s);
  const item = id => WP.Content.byId[id];
  const st = id => WP.Store.data.items[id];
  const E = () => cur.ex;

  R.start = function (plan, done) {
    onEnd = done; stageEl = document.getElementById("stage"); actEl = document.getElementById("actions");
    Q = []; pos = 0; prev = null; combo = 0; best = 0; sinceMatch = 0; matches = 0; seen = []; res = {}; firstNewShown = false; startedAt = Date.now(); anyOk = false;
    stats = { ok: {}, newSeen: 0, reviewGood: 0, matchPerfect: 0, stars: 0, weak: !!plan.weak };
    const rv = plan.reviews.slice(), nw = plan.fresh.slice();
    rv.forEach(id => res[id] = { kind: "review", firstOk: null, partial: false, learned: false, known: false });
    nw.forEach(id => res[id] = { kind: "new", firstOk: null, partial: false, learned: false, known: false });
    while (rv.length || nw.length) {
      if (rv.length) Q.push({ kind: "review", id: rv.shift() });
      if (rv.length && (Q.length % 3 === 1 || !nw.length)) Q.push({ kind: "review", id: rv.shift() });
      if (nw.length) Q.push({ kind: "intro", id: nw.shift() });
    }
    U.quip("start", "h", true, 0);
    render();
  };
  R.stop = function () { clearTimeout(autoT); stopOrb(); U.hush(); };
  R.summary = () => ({ res: res, steps: pos, best: best, ms: Date.now() - startedAt, stats: stats });

  function insert(task, gap) { Q.splice(Math.min(Q.length, pos + 1 + gap), 0, task); }
  function paint(type, html, act, opts) {
    opts = opts || {};
    stopOrb();
    stageEl.style.setProperty("--type", TYPE[type].color);
    stageEl.className = "stage t-" + type + " enter";
    const kind = cur && cur.id && res[cur.id] ? (res[cur.id].kind === "new" ? "חדשה" : "חזרה") : "";
    const ch = cur && cur.id ? WP.Content.chapters().find(c => c.id === WP.Content.chapterOf[cur.id]) : null;
    const app = document.getElementById("app"); if (app && ch) app.style.setProperty("--world", ch.color);
    stageEl.innerHTML = '<div class="stage-head"><span class="badge">' + U.ICON[type === "pick" ? "intro" : type === "reverse" ? "recall" : type] + TYPE[type].label + '</span><span class="head-r">' + (kind ? '<span class="chip-s">' + kind + '</span>' : '') + '</span></div>' +
      '<div class="stage-in swap' + (opts.center === false ? "" : " center") + '">' + html + '</div><div class="stamp-layer" id="stamp"></div>';
    actEl.innerHTML = act || "";
    const bar = document.getElementById("sfill"); if (bar) bar.style.width = Math.min(100, Math.round(pos / Math.max(1, Q.length) * 100)) + "%";
    lockUntil = performance.now() + 260;
  }
  const locked = () => performance.now() < lockUntil;
  const contBtn = l => '<button class="primary" data-act="next" disabled>' + (l || "המשך") + ' <span class="kbd">↵</span></button>';
  function armContinue() { const b = actEl.querySelector('[data-act="next"]'); if (b) setTimeout(() => { b.disabled = false; }, 280); }
  const playBtns = () => '<div class="audio"><button class="play" data-act="sayword" aria-label="השמעת המילה">' + U.ICON.play + '</button><button class="play slow" data-act="sayslow" aria-label="השמעה איטית">0.7×</button></div>';
  const fit = (s, big, mid, small) => s.length > 14 ? small : s.length > 9 ? mid : big;
  const marked = (ex, size) => '<p class="sent"' + (size ? ' style="font-size:' + size + 'px"' : '') + '>' + U.esc(ex.pre) + '<mark>' + U.esc(ex.ans) + '</mark>' + U.esc(ex.post) + '</p>';
  const letters = (w) => '<span class="drop">' + [...w].map((c, i) => '<i style="--i:' + i + '">' + (c === " " ? "&nbsp;" : U.esc(c)) + '</i>').join("") + '</span>';
  function stamp(text, kind) {
    const s = $("#stamp"); if (!s) return;
    s.innerHTML = '<div class="stampmark ' + (kind || "ok") + '">' + text + '</div>';
  }
  function setCombo() {
    const cb = document.getElementById("combo"); if (!cb) return;
    if (combo >= 3) { cb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#FF7A59"/><path d="M12 12c1 2 3 3 3 5a3 3 0 0 1-6 0c0-1 1-2 1-3 1 1 2 1 2-2z" fill="#FFD27A"/></svg>' + combo; cb.classList.remove("up"); void cb.offsetWidth; cb.classList.add("up", "on"); }
    else cb.classList.remove("on");
  }

  function render() {
    clearTimeout(autoT);
    if (pos >= Q.length) return onEnd(R.summary());
    if (sinceMatch >= 8 && matches < 2 && seen.length >= 4 && Q[pos].kind !== "match") Q.splice(pos, 0, { kind: "match" });
    cur = Q[pos]; answered = false;
    if (cur.kind === "match") { cur.type = "match"; return renderMatch(); }
    const it = item(cur.id), s = st(cur.id) || {};
    cur.type = cur.kind === "intro" ? "intro" : X.choose(cur, s, prev);
    cur.ex = cur.kind === "intro" ? it.examples[0] : X.example(it);
    if (seen.indexOf(cur.id) === -1) seen.push(cur.id);
    ({ intro: renderIntro, listen: renderListen, gap: renderGap, recall: renderRecall, scene: renderScene, pick: renderPick, reverse: renderReverse })[cur.type](it);
  }

  function renderIntro(it) {
    paint("intro",
      '<div class="intro-top"><span class="ribbon">NEW</span>' + (it.pic ? '<div class="pic" aria-hidden="true">' + U.PICS[it.pic] + '</div>' : '<div class="pic type-pic" aria-hidden="true"><span class="en">' + U.esc(it.type) + '</span></div>') + '</div>' +
      '<p class="word" style="font-size:' + fit(it.en, 48, 38, 30) + 'px">' + letters(it.en) + '</p>' +
      '<div class="ltr-row"><div class="stress">' + it.stress + ' · ' + U.esc(it.pos) + '</div>' + playBtns() + '</div>' +
      '<p class="mean">' + U.esc(it.he) + '</p>' + marked(E()) +
      '<div class="tagrow">' + it.domains.map(d => '<span class="dtag">' + ({ daily: "יומיום", business: "עסקים", talk: "שיחה", shows: "סדרות" }[d] || d) + '</span>').join("") + '<span class="dtag lv">' + it.level + '</span></div>',
      '<div class="pair2"><button class="ghost" data-act="known">כבר מכירה</button><button class="primary" data-act="introdone">הבנתי <span class="kbd">↵</span></button></div>');
    U.say([it.en, E().plain]);
    if (!firstNewShown) { firstNewShown = true; U.quip("firstNew", "w", true, pos); } else U.face("w");
  }

  function optTiles(opts, english) {
    const short = opts.every(o => (english ? o.item.en : o.item.he).length <= (english ? 16 : 18));
    return '<div class="tiles' + (short ? " grid" : "") + (english ? " en-tiles" : "") + '">' + opts.map((o, i) =>
      '<button class="gtile c' + i + '" data-act="pick" data-i="' + i + '"><span class="shape">' + SHAPES[i] + '</span><span class="tt">' + U.esc(english ? o.item.en : o.item.he) + '</span></button>').join("") + '</div>';
  }

  function renderPick(it) {
    const ex = X.pick(it); cur.opts = ex.opts;
    paint("pick",
      '<p class="prompt">מה פירוש המילה?</p>' +
      '<div class="marquee"><div class="bulbs" aria-hidden="true"></div><p class="word mq" style="font-size:' + fit(it.en, 40, 32, 26) + 'px">' + U.esc(it.en) + '</p><button class="mini-play" data-act="sayword" aria-label="השמעה">' + U.ICON.play + '</button></div>' +
      marked(E(), 16) + '<div id="fb"></div>',
      optTiles(cur.opts, false));
    U.say(it.en, .9);
  }

  function renderReverse(it) {
    const ex = X.reverse(it); cur.opts = ex.opts;
    paint("reverse",
      '<p class="prompt">איך אומרים באנגלית?</p>' +
      '<div class="bubble-q"><span class="who">' + U.avatar() + '</span><p>' + U.esc(it.he) + '</p></div>' +
      '<p class="sent dim" style="font-size:16px">' + U.esc(E().pre) + '<span class="blank-line">&nbsp;</span>' + U.esc(E().post) + '</p><div id="fb"></div>',
      optTiles(cur.opts, true));
  }

  function renderListen(it) {
    const ex = X.listen(it); cur.opts = ex.opts;
    paint("listen",
      '<p class="prompt">הקשיבי. מה פירוש המילה?</p>' +
      '<div class="orb-wrap"><canvas id="orb" width="520" height="300" aria-hidden="true"></canvas>' +
      '<button class="orb-play" data-act="listenplay" aria-label="השמעה שוב"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M6 4v16l14-8z" fill="currentColor"/></svg></button>' +
      '<button class="orb-slow" data-act="listenslow" aria-label="השמעה איטית">0.7×</button></div>' +
      '<div class="reveal-word" id="rw"><span class="q">? ? ?</span></div><div id="fb"></div>',
      optTiles(cur.opts, false));
    startOrb();
    U.say([it.en, E().plain], .9);
  }

  function renderGap(it) {
    const ex = X.gap(it); cur.why = ex.why;
    const e = E();
    cur.opts = X.shuffle([e.ans].concat(it.distractors.slice(0, 2).map(d => d.t)));
    paint("gap",
      '<p class="prompt">איזו מילה משלימה את המשפט?</p>' +
      '<div class="ticket"><p class="gap-sent">' + U.esc(e.pre) + '<span class="slot" id="slot">' + U.esc(e.ans) + '</span>' + U.esc(e.post) + '</p></div><div id="fb"></div>',
      '<p class="tray-hint">גררי אריח אל החסר, או געי בו</p><div class="tray" id="tray">' + cur.opts.map((t, i) => '<button class="tile key" data-i="' + i + '">' + U.esc(t) + '</button>').join("") + '</div>');
    $("#slot").style.minWidth = Math.max(3.6, e.ans.length * .52) + "em";
  }

  function renderRecall(it) {
    const e = E();
    paint("recall",
      '<div class="flip" id="flip"><div class="flip-in">' +
      '<div class="face front"><p class="sub" style="color:#4B3FA8">איך אומרים באנגלית:</p><p class="mean" style="font-size:25px">' + U.esc(it.he) + '</p>' +
      '<p class="sent" style="font-size:17px">' + U.esc(e.pre) + '<span class="blank-line">&nbsp;</span>' + U.esc(e.post) + '</p><div id="hint"></div>' +
      '<p class="sub">אמרי את המילה בראש. בלי להקליד ובלי לדבר.</p><span class="tapme">געי בכרטיס כדי להפוך</span></div>' +
      '<div class="face back holo"><div class="ltr-row"><p class="word" style="font-size:' + fit(it.en, 40, 32, 26) + 'px;min-width:0">' + U.esc(it.en) + '</p>' + playBtns() + '</div><div class="stress">' + it.stress + '</div><p class="mean" style="font-size:18px">' + U.esc(it.he) + '</p>' + marked(e, 17) + '</div>' +
      '</div></div>',
      '<div class="pair2"><button class="ghost" data-act="hint">רמז</button><button class="primary" data-act="reveal">הפכי</button></div>');
  }

  function renderScene(it) {
    const sc = X.SCENES[it.scene]; cur.sc = sc; cur.found = 0; cur.misses = 0; cur.tapped = {};
    paint("scene",
      '<p class="prompt">' + sc.prompt + '</p><p class="sub" style="margin-top:-6px">' + sc.sub + '</p>' +
      '<div class="scene" id="scene" style="aspect-ratio:' + sc.ratio + '"><img src="' + sc.src + '" alt="">' +
      sc.spots.map((s, i) => '<button class="hs" data-act="spot" data-i="' + i + '" aria-label="' + U.esc(s.en) + '" style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%"></button>').join("") +
      '<div id="cap"></div></div>' + (sc.need > 1 ? '<div class="found" id="found">' + Array.from({ length: sc.need }, () => '<i></i>').join("") + '</div>' : '') + '<div id="fb"></div>', '');
    U.quip("scene", "w", false, pos);
  }

  function renderMatch() {
    matches++; sinceMatch = 0;
    const ex = X.match(seen, matches === 2); cur.ex = ex; cur.done = 0; cur.miss = {}; cur.sel = null;
    const audio = ex.audio;
    paint("match",
      '<p class="prompt">' + (audio ? "חברי כל צליל למשמעות שלו" : "חברי כל מילה למשמעות שלה") + '</p>' +
      '<p class="sub" style="margin-top:-6px">' + (audio ? "געי ברמקול כדי לשמוע, ואז במשמעות." : "געי במילה ואז במשמעות, או גררי ביניהן.") + '</p>' +
      '<div class="match" id="match"><svg class="match-svg" id="msvg"></svg>' +
      '<div class="mcol">' + ex.right.map(w => '<button class="mt he-t" data-side="he" data-id="' + w.id + '">' + U.esc(w.he) + '</button>').join("") + '</div>' +
      '<div class="mcol">' + ex.left.map(w => audio
        ? '<button class="mt snd" data-side="en" data-id="' + w.id + '" aria-label="השמעת מילה">' + U.ICON.play + '</button>'
        : '<button class="mt en-t" data-side="en" data-id="' + w.id + '">' + U.esc(w.en) + '</button>').join("") + '</div></div><div id="fb"></div>', '');
    U.quip("match", "h", false, pos);
  }

  /* ---------- listening orb (canvas) ---------- */
  function startOrb() {
    const c = $("#orb"); if (!c) return;
    const ctx = c.getContext("2d"); const t0 = performance.now();
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cols = ["246,195,91", "255,242,220", "127,184,174", "224,121,94"];
    const draw = () => {
      if (!c.isConnected) return;
      const t = (performance.now() - t0) / 1000, wrap = c.parentNode, live = wrap && wrap.classList.contains("playing") ? 1 : 0.22;
      ctx.clearRect(0, 0, c.width, c.height);
      const cx = c.width / 2, cy = c.height / 2;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + .01; a += Math.PI / 90) {
          const amp = live * (14 + k * 6) * Math.sin(a * (3 + k) + t * (2.2 + k * .7)) * Math.sin(t * 1.3 + k);
          const r = 78 + k * 10 + amp;
          const x = cx + Math.cos(a) * r * 1.35, y = cy + Math.sin(a) * r * .82;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(" + cols[k] + "," + (0.85 - k * .15) + ")"; ctx.lineWidth = 4 - k * .6; ctx.stroke();
      }
      if (!reduce) orb = requestAnimationFrame(draw);
    };
    draw();
  }
  function stopOrb() { if (orb) cancelAnimationFrame(orb); orb = null; }

  /* ---------- outcomes ---------- */
  function settle(ok, partial) {
    prev = cur.type; sinceMatch++;
    if (cur.id) {
      const r = res[cur.id], s = Object.assign(WP.Sched.fresh(), st(cur.id) || {});
      WP.Sched.track(s, cur.type, ok); s.upd = WP.Store.now(); WP.Store.putItem(cur.id, s);
      if (r.firstOk === null && cur.kind !== "intro") r.firstOk = !!ok && !partial;
      if (partial) r.partial = true;
      if (!ok) r.failed = true;
      if (cur.kind === "review") { if (ok && !partial) r.learned = true; else insert({ kind: "check", id: cur.id, stage: 2, lastType: cur.type }, 2); }
      else if (cur.kind === "check") {
        r.tries = (r.tries || 0) + 1;
        if (cur.stage === 1) { if (ok) insert({ kind: "check", id: cur.id, stage: 2, lastType: cur.type }, 3); else if (r.tries < 4) insert({ kind: "check", id: cur.id, stage: 1, lastType: cur.type }, 2); }
        else { if (ok && !partial) r.learned = true; else if (r.tries < 5) insert({ kind: "check", id: cur.id, stage: 2, lastType: cur.type }, 3); }
      }
    }
    if (ok && !partial) {
      combo++; best = Math.max(best, combo); U.face("h"); U.hop(); stamp(["בול!", "נכון!", "יש!", "מעולה!"][Math.floor(Math.random() * 4)], "ok");
      stats.ok[cur.type] = (stats.ok[cur.type] || 0) + 1; stats.stars++; addStar();
      if (cur.kind === "review") stats.reviewGood++;
      if (!anyOk || combo % 3 === 0) U.peek(combo >= 6 ? "wow" : "cheer");
      anyOk = true;
    }
    else if (!ok) { if (combo > 0 || prev !== cur.type) U.peek("oops"); combo = 0; U.face("s"); stamp("לא הפעם", "bad"); }
    else stamp("כמעט", "mid");
    setCombo();
    if (combo === 3) { U.tone("combo"); U.quip("combo3", "h", false, pos); } else if (combo === 6) { U.tone("combo"); U.quip("combo6", "h", true, pos); } else if (combo === 9) { U.tone("combo"); U.quip("combo9", "w", true, pos); }
    armContinue();
    if (U.prefs().auto && ok && !partial) autoT = setTimeout(next, 1300);
  }
  const meter = () => document.getElementById("sstars") || document.getElementById("strack");
  function addStar() {
    const p = document.getElementById("sstars"); if (!p) return;
    setTimeout(() => { const b = p.querySelector("b"); if (b) b.textContent = (+p.dataset.base || 0) + stats.stars; p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }, 650);
  }

  function pick(i) {
    if (answered || locked()) return; answered = true;
    const it = item(cur.id), o = cur.opts[i];
    const btns = actEl.querySelectorAll('[data-act="pick"]');
    btns.forEach((b, j) => { b.disabled = true; if (cur.opts[j].ok) b.classList.add("ok"); else if (j === i) b.classList.add("bad"); else b.classList.add("dim"); });
    const btn = btns[i];
    const rw = $("#rw"); if (rw) rw.innerHTML = '<span class="w">' + U.esc(it.en) + '</span>';
    if (o.ok) { U.tone("ok"); U.burst(btn); U.fly(btn, meter(), "+1 ★"); $("#fb").innerHTML = U.fb(true, "נכון", cur.type === "pick" ? null : it, cur.type === "listen" ? marked(E(), 16) : ""); }
    else {
      U.tone("bad"); const c = WP.Content.confusion(o.item.id, it.id);
      $("#fb").innerHTML = U.fb(false, c ? "בלבול קלאסי. ההבדל:" : "התשובה:", c ? null : it, c ? U.diff(c) : '');
      if (c) U.quip("confuse", "w", false, pos);
    }
    actEl.insertAdjacentHTML("beforeend", contBtn());
    U.say(cur.type === "reverse" ? [it.en, E().plain] : E().plain, .95); settle(o.ok);
  }

  function placeTile(i) {
    if (answered || locked()) return; answered = true;
    const it = item(cur.id), e = E(), t = cur.opts[i], ok = t === e.ans, slot = $("#slot");
    actEl.querySelectorAll(".tile").forEach((b, j) => { b.disabled = true; if (j === i) b.classList.add("ghost"); });
    slot.textContent = t; slot.classList.add("filled", ok ? "ok" : "bad", "land");
    const ticket = $(".ticket"); if (ticket) ticket.classList.add(ok ? "won" : "lost");
    U.tone(ok ? "ok" : "bad");
    if (ok) { U.burst(slot); U.fly(slot, meter(), "+1 ★"); $("#fb").innerHTML = U.fb(true, "בול", it); }
    else {
      $("#fb").innerHTML = U.fb(false, "המילה הנכונה:", it, '<div class="diff">' + U.esc(cur.why[t] || "") + '</div>');
      setTimeout(() => { slot.textContent = e.ans; slot.classList.remove("bad"); slot.classList.add("ok"); }, 700);
    }
    const h = actEl.querySelector(".tray-hint"); if (h) h.remove();
    actEl.insertAdjacentHTML("beforeend", contBtn());
    U.say(e.plain, .95); settle(ok);
  }

  function reveal() {
    if (answered || locked()) return;
    const it = item(cur.id); U.tone("flip"); $("#flip").classList.add("done");
    U.say([it.en, E().plain]);
    actEl.innerHTML = '<p class="honest">ידעת לפני שהפכת? (דיווח עצמי)</p><div class="rate"><button class="opt" data-act="self" data-v="no">לא ידעתי</button><button class="opt" data-act="self" data-v="almost">כמעט</button><button class="opt" data-act="self" data-v="yes">ידעתי</button></div>';
    answered = "reveal"; lockUntil = performance.now() + 450;
  }
  function selfRate(v) {
    if (answered !== "reveal" || locked()) return; answered = true;
    const ok = v === "yes", partial = v === "almost" || (ok && cur.hinted);
    U.tone(v === "yes" ? "ok" : v === "almost" ? "flip" : "bad");
    if (ok && !cur.hinted) U.fly($(".face.back .word"), meter(), "+1 ★");
    const msg = v === "yes" ? (cur.hinted ? "יפה. עם רמז זה נספר כחצי, והיא תחזור." : "נרשם כשליפה.") : v === "almost" ? "כמעט זה התחלה טובה. היא תחזור עוד מעט." : "עכשיו ראית אותה. היא תחזור עוד מעט.";
    actEl.innerHTML = U.fb(v === "yes" ? true : null, msg) + contBtn();
    settle(ok || v === "almost", partial || v === "almost");
  }
  function hint() {
    if (answered || locked()) return;
    const it = item(cur.id); cur.hinted = true;
    $("#hint").innerHTML = '<span class="hint">רמז: מתחילה ב-<bdi class="en">' + U.esc(it.hint[0]) + '</bdi> · ' + U.esc(it.hint[1]) + '</span>';
  }
  function spot(i) {
    if (answered === true || locked()) return;
    const sc = cur.sc, s = sc.spots[i], btn = stageEl.querySelectorAll(".hs")[i], it = item(cur.id);
    if (cur.tapped[i]) return; cur.tapped[i] = true;
    btn.classList.add(s.ok ? "ok" : "no");
    $("#cap").innerHTML = '<div class="cap"><span class="en">' + U.esc(s.en) + '</span>' + s.he + '</div>';
    U.say(s.en, .95);
    if (s.ok) { cur.found++; U.tone("pair"); U.burst(btn); const f = stageEl.querySelectorAll("#found i")[cur.found - 1]; if (f) f.classList.add("on"); }
    else { cur.misses++; U.tone("bad"); U.face("s"); }
    if (cur.found >= sc.need) {
      answered = true; const ok = cur.misses === 0;
      $("#fb").innerHTML = U.fb(ok ? true : null, ok ? "ראית בדיוק." : "מצאת. עכשיו את יודעת גם מה זה לא.", it);
      U.fly(btn, meter(), "+1 ★");
      actEl.innerHTML = contBtn(); settle(true, !ok);
    }
  }

  /* match: tap-tap or drag */
  let drag = null, tdrag = null;
  function matchTry(a, b) {
    if (!a || !b || a === b || a.dataset.side === b.dataset.side) return;
    if (a.dataset.id === b.dataset.id) {
      const w = item(a.dataset.id); U.tone("pair"); U.burst(b, 10);
      [a, b].forEach(el => el.classList.add("done"));
      if (cur.ex.audio) [a, b].forEach(el => { if (el.dataset.side === "en") el.innerHTML = '<span class="en">' + U.esc(w.en) + '</span>'; });
      if (cur.ex.audio) U.say(w.en, .9);
      if (++cur.done === cur.ex.items.length) finishMatch();
    } else {
      U.tone("bad"); [a, b].forEach(el => { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); });
      cur.miss[a.dataset.side === "en" ? a.dataset.id : b.dataset.id] = true;
    }
  }
  function finishMatch() {
    answered = true;
    const missed = Object.keys(cur.miss);
    missed.forEach(id => { if (res[id]) res[id].partial = true; insert({ kind: "check", id: id, stage: 2 }, 2 + Math.floor(Math.random() * 3)); });
    cur.ex.items.forEach(w => { const s = Object.assign(WP.Sched.fresh(), st(w.id) || {}); WP.Sched.track(s, "match", !cur.miss[w.id]); s.upd = WP.Store.now(); WP.Store.putItem(w.id, s); });
    const ok = missed.length === 0; if (ok) stats.matchPerfect++;
    $("#fb").innerHTML = U.fb(ok ? true : null, ok ? "4 מתוך 4, בלי טעויות." : "כל הזוגות במקום. " + missed.length + (missed.length === 1 ? " מילה תחזור" : " מילים יחזרו") + " לחיזוק.");
    actEl.innerHTML = contBtn();
    const keep = cur.id; cur.id = null; settle(ok); cur.id = keep;
  }
  function clearSel() { stageEl.querySelectorAll(".mt.sel").forEach(e => e.classList.remove("sel")); if (cur) cur.sel = null; }
  function line(a, x, y) {
    const svg = $("#msvg"); if (!svg) return; const box = $("#match").getBoundingClientRect(), r = a.getBoundingClientRect();
    svg.innerHTML = '<line x1="' + (r.left + r.width / 2 - box.left) + '" y1="' + (r.top + r.height / 2 - box.top) + '" x2="' + (x - box.left) + '" y2="' + (y - box.top) + '" stroke="#E85D9C" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>';
  }

  R.bind = function () {
    document.addEventListener("pointerdown", e => {
      const rb = e.target.closest(".gtile,.tile.key,.opt,.primary,.go,.mt,.ghost");
      if (rb && !rb.disabled) { const r = rb.getBoundingClientRect(), sp = document.createElement("span"); sp.className = "ripple"; sp.style.left = (e.clientX - r.left) + "px"; sp.style.top = (e.clientY - r.top) + "px"; rb.appendChild(sp); setTimeout(() => sp.remove(), 520); }
      if (!cur || !stageEl || !document.body.contains(stageEl)) return;
      const mt = e.target.closest(".mt"); if (mt && cur.type === "match" && !answered && !locked()) { drag = { el: mt, x: e.clientX, y: e.clientY, moved: false }; return; }
      const t = e.target.closest(".tile"); if (t && !answered && !locked()) tdrag = { el: t, x: e.clientX, y: e.clientY, moved: false, ghost: null };
    });
    document.addEventListener("click", e => { if (cur && cur.type === "recall" && !answered && e.target.closest(".face.front") && !e.target.closest("button")) reveal(); });
    window.addEventListener("pointermove", e => {
      if (drag) { if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) { drag.moved = true; clearSel(); drag.el.classList.add("sel"); } if (drag.moved) line(drag.el, e.clientX, e.clientY); }
      if (tdrag) {
        if (!tdrag.moved && Math.hypot(e.clientX - tdrag.x, e.clientY - tdrag.y) > 10) { tdrag.moved = true; const g = tdrag.el.cloneNode(true); g.classList.add("drag"); document.body.appendChild(g); tdrag.ghost = g; tdrag.el.classList.add("ghost"); }
        if (tdrag.moved) { tdrag.ghost.style.left = (e.clientX - tdrag.ghost.offsetWidth / 2) + "px"; tdrag.ghost.style.top = (e.clientY - tdrag.ghost.offsetHeight / 2) + "px"; const slot = $("#slot"); if (slot) { const r = slot.getBoundingClientRect(); slot.classList.toggle("hover", e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top - 24 && e.clientY < r.bottom + 24); } }
      }
    });
    window.addEventListener("pointerup", e => {
      if (drag) {
        const d = drag; drag = null; const svg = $("#msvg"); if (svg) svg.innerHTML = "";
        if (d.moved) { const t = document.elementFromPoint(e.clientX, e.clientY), target = t && t.closest(".mt"); d.el.classList.remove("sel"); if (target) matchTry(d.el, target); }
        else {
          const el = d.el; if (el.dataset.side === "en" && cur.ex.audio) U.say(item(el.dataset.id).en, .9);
          if (cur.sel && cur.sel !== el && cur.sel.dataset.side !== el.dataset.side) { const a = cur.sel; clearSel(); matchTry(a, el); } else { clearSel(); el.classList.add("sel"); cur.sel = el; }
        }
      }
      if (tdrag) {
        const d = tdrag; tdrag = null;
        if (d.moved) { d.ghost.remove(); d.el.classList.remove("ghost"); const slot = $("#slot"); const over = slot && slot.classList.contains("hover"); if (slot) slot.classList.remove("hover"); if (over) placeTile(+d.el.dataset.i); }
        else placeTile(+d.el.dataset.i);
      }
    });
  };

  let leaving = false;
  function next() {
    if (leaving) return; clearTimeout(autoT); U.hush();
    if (document.body.classList.contains("calm") || !stageEl) { pos++; render(); return; }
    leaving = true; stageEl.classList.remove("enter"); stageEl.classList.add("leave"); actEl.classList.add("leave");
    setTimeout(() => { leaving = false; actEl.classList.remove("leave"); pos++; render(); }, 170);
  }
  R.act = function (a, b) {
    const it = cur && cur.id ? item(cur.id) : null;
    if (a === "next") { if (!b.disabled) next(); }
    else if (a === "introdone") { if (!locked()) { stats.newSeen++; prev = "intro"; insert({ kind: "check", id: cur.id, stage: 1, lastType: "intro" }, 1); next(); } }
    else if (a === "known") { if (!locked()) { stats.newSeen++; prev = "intro"; res[cur.id].known = true; insert({ kind: "check", id: cur.id, stage: 2, lastType: "intro" }, 2); next(); } }
    else if (a === "pick") pick(+b.dataset.i);
    else if (a === "reveal") reveal();
    else if (a === "self") selfRate(b.dataset.v);
    else if (a === "hint") hint();
    else if (a === "spot") spot(+b.dataset.i);
    else if (a === "sayword" && it) U.say(it.en, .85);
    else if (a === "sayslow" && it) U.say(it.en, .6);
    else if (a === "listenplay" && it) U.say([it.en, E().plain], .9);
    else if (a === "listenslow" && it) U.say([it.en, E().plain], .65);
  };
  R.key = function (e) {
    const k = e.key;
    if (k === "Enter") { const p = actEl.querySelector('[data-act="next"]:not([disabled]),[data-act="introdone"],[data-act="reveal"]'); if (p) { e.preventDefault(); p.click(); } }
    else if (/^[1-4]$/.test(k)) { const o = actEl.querySelectorAll('[data-act="pick"]'); const t = o[+k - 1]; if (t && !t.disabled) { e.preventDefault(); t.click(); } }
  };
})(window.WP = window.WP || {});
