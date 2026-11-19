/* WORDPLAY app shell: home (hero, today, trophies, journey map), session, end of session, settings. */
(function (WP) {
  "use strict";
  const U = WP.UI, S = WP.Sched, St = WP.Store;
  const A = WP.App = {};
  const root = () => document.getElementById("app");
  let screen = "home", before = null;

  const ACH = [
    { id: "first", t: "הצגת בכורה", d: "סשן ראשון" },
    { id: "ten", t: "10 בזיכרון", d: "10 מילים שנשלפו" },
    { id: "thirty", t: "30 בזיכרון", d: "30 מילים שנשלפו" },
    { id: "fifty", t: "50 בזיכרון", d: "50 מילים שנשלפו" },
    { id: "hundred", t: "100 בזיכרון", d: "100 מילים שנשלפו" },
    { id: "stage", t: "שלב חדש", d: "נפתח שלב במסע" },
    { id: "chapter", t: "פרק שלם", d: "כל מילות פרק נשלפו" },
    { id: "comeback", t: "חזרה מנצחת", d: "זכרת מילה אחרי יום ויותר" },
    { id: "veteran", t: "זיכרון ארוך", d: "מילה יציבה 3+ ימים" },
    { id: "perfect", t: "הצגה מושלמת", d: "סשן בלי טעות בניסיון ראשון" },
    { id: "combo10", t: "רצף 10", d: "10 תשובות נכונות ברצף" },
    { id: "days3", t: "שלושה ימים", d: "למדת ב-3 ימים שונים" },
    { id: "days7", t: "שבוע שלם", d: "למדת ב-7 ימים שונים" },
    { id: "allgames", t: "כל המשחקים", d: "שיחקת בכל סוגי התרגילים" }
  ];
  const ACHMAP = Object.fromEntries(ACH.map(a => [a.id, a]));

  /* Daily missions: three per day, chosen by date, each rewards stars. Stars come only from correct answers and missions. */
  const QUESTS = [
    { id: "session", t: "לסיים סבב אחד", n: 1, f: s => 1 },
    { id: "streak5", t: "רצף של 5 תשובות נכונות", n: 5, f: s => s.best },
    { id: "listen4", t: "4 תשובות נכונות בשמיעה", n: 4, f: s => s.stats.ok.listen || 0 },
    { id: "new4", t: "להכיר 4 מילים חדשות", n: 4, f: s => s.stats.newSeen },
    { id: "review6", t: "6 חזרות מוצלחות", n: 6, f: s => s.stats.reviewGood },
    { id: "match", t: "התאמה בלי אף טעות", n: 1, f: s => s.stats.matchPerfect },
    { id: "gap4", t: "4 משפטים מושלמים", n: 4, f: s => s.stats.ok.gap || 0 },
    { id: "recall3", t: "3 שליפות שקטות מוצלחות", n: 3, f: s => s.stats.ok.recall || 0 },
    { id: "trivia4", t: "4 תשובות טריוויה נכונות", n: 4, f: s => (s.stats.ok.pick || 0) + (s.stats.ok.reverse || 0) }
  ];
  const QMAP = Object.fromEntries(QUESTS.map(q => [q.id, q]));
  function todayQuests() {
    const day = St.dayKey(St.now());
    let q = St.data.profile.quests;
    if (!q || q.day !== day) {
      let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = QUESTS.slice(1), pick = [];
      while (pick.length < 2) { h = (h * 1103515245 + 12345) >>> 0; const c = pool[h % pool.length]; if (pick.indexOf(c) === -1) pick.push(c); }
      q = { day: day, list: [QUESTS[0]].concat(pick).map(x => ({ id: x.id, prog: 0, done: false })), bonus: false };
      St.touchProfile(p => p.quests = q);
    }
    return q;
  }
  const WARDROBE = [
    { id: "beret-gold", t: "ברט זהב", hat: "beret", hatColor: "#F2B33D", cost: 0 },
    { id: "beret-red", t: "ברט אדום", hat: "beret", hatColor: "#E5485A", cost: 30 },
    { id: "beret-teal", t: "ברט טורקיז", hat: "beret", hatColor: "#2EC4B6", cost: 30 },
    { id: "cap-violet", t: "כובע מצחייה", hat: "cap", hatColor: "#8F7CFF", cost: 50 },
    { id: "tophat", t: "צילינדר", hat: "tophat", hatColor: "#22172F", cost: 80 },
    { id: "crown", t: "כתר", hat: "crown", hatColor: "#FFD27A", cost: 150 },
    { id: "scarf-red", t: "צעיף אדום", scarf: "#C8323C", cost: 0 },
    { id: "scarf-pink", t: "צעיף ורוד", scarf: "#E85D9C", cost: 25 },
    { id: "scarf-mint", t: "צעיף מנטה", scarf: "#3DDC97", cost: 25 },
    { id: "scarf-blue", t: "צעיף כחול", scarf: "#5B8CFF", cost: 40 }
  ];

  A.boot = async function () {
    St.loadLocal();
    try { await WP.Content.load(); }
    catch (e) { root().innerHTML = '<div class="fatal"><b>התוכן לא נטען.</b><p>נסי לרענן את הדף. (' + U.esc(e.message) + ')</p></div>'; return; }
    U.initVoice();
    WP.Session.bind();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", e => { if (screen === "session") WP.Session.key(e); else if (e.key === "Enter" && screen === "home") { const b = document.querySelector('[data-act="go"]'); if (b) { e.preventDefault(); b.click(); } } });
    St.onChange(syncBadge);
    applyCalm();
    showHome();
    St.connect().then(ok => { if (ok && screen === "home") showHome(); });
  };

  function applyCalm() { document.body.classList.toggle("calm", !!St.data.profile.settings.calm); }
  function syncBadge() {
    const b = document.getElementById("sync"); if (!b) return;
    const m = St.status.mode;
    b.className = "sync " + m;
    b.querySelector("span").textContent = m === "synced" ? "שמור" : m === "connecting" ? "מתחבר" : m === "error" ? "שגיאה" : "במכשיר";
  }

  /* ---------- M4: world lifecycle ---------- */
  let world = null, homeCur = 0;
  function leave() { if (world) { try { world.dispose(); } catch (e) {} world = null; } closeSheet(); }
  function fracOf(s, items) { return s.items.filter(id => S.level(items[id]) >= 2).length / s.items.length; }
  function streak() {
    const d = St.data.profile.days || {}; let n = 0, t = St.now();
    if (!d[St.dayKey(t)]) t -= 86400000;
    while (d[St.dayKey(t)]) { n++; t -= 86400000; }
    return n;
  }
  function islandData(items, open, cur) {
    return WP.Content.chapters().map(ch => {
      const sts = WP.Content.stages.filter(s => s.chapter === ch.id);
      const parts = sts.map(s => ({ state: open.indexOf(s.id) === -1 ? "ghost" : S.meets(s, items) ? "done" : "grow", frac: fracOf(s, items) }));
      const isOpen = parts.some(p => p.state !== "ghost");
      const total = sts.reduce((n, s) => n + s.items.length, 0), got = sts.reduce((n, s) => n + s.items.filter(id => S.level(items[id]) >= 2).length, 0);
      const isCur = cur && cur.chapter === ch.id;
      return { id: ch.id, title: U.esc(ch.title), icon: ch.icon, color: parseInt((ch.color || "#E8B44C").slice(1), 16), open: isOpen, cur: isCur, parts,
        sub: isCur ? "שלב " + (cur.inChapter + 1) + " · " + U.esc(cur.title) : isOpen ? got + "/" + total + " בזיכרון" : "" };
    });
  }

  /* ---------- home ---------- */
  function greeting(plan) {
    const p = St.data.profile;
    if (!p.sessions) return "ברוכה הבאה לבמה. " + plan.fresh.length + " מילים ראשונות מחכות, כ-" + plan.minutes + " דקות.";
    if (plan.reviews.length >= 6) return plan.reviews.length + " מילים מבקשות חזרה לפני שהן נשכחות. אחריהן, חדשות.";
    if (plan.reviews.length) return "יש " + plan.reviews.length + " חזרות קצרות ו-" + plan.fresh.length + " מילים חדשות. זה הסדר הנכון.";
    if (!plan.fresh.length) return "אין מה לחזור כרגע, והשלב הבא עוד נעול. מחר יחכו לך חזרות.";
    return "אין חזרות שמחכות. זמן מצוין למילים חדשות.";
  }
  function stageState(s, items, open) {
    const lv = s.items.map(id => S.level(items[id]));
    const pct = Math.round(lv.filter(l => l >= 2).length / s.items.length * 100);
    const isOpen = open.indexOf(s.id) !== -1;
    return { pct, isOpen, done: pct >= 100, strong: lv.filter(l => l >= 3).length };
  }
  function mapHTML(items, open, cur) {
    return WP.Content.course.worlds.map(w => '<div class="season" style="--sc:' + (w.color || "#FFD27A") + '"><div class="season-h"><b>' + U.esc(w.title) + '</b><span>' + U.esc(w.subtitle || "") + '</span></div>' + worldHTML(w, items, open, cur) + '</div>').join("");
  }
  function worldHTML(w, items, open, cur) {
    const stages = WP.Content.stages, chapters = w.chapters;
    const pos = ["p-r", "p-c", "p-l"];
    return chapters.map(ch => {
      const sts = stages.filter(s => s.chapter === ch.id);
      const chOpen = sts.some(s => open.indexOf(s.id) !== -1);
      const total = sts.reduce((n, s) => n + s.items.length, 0);
      const got = sts.reduce((n, s) => n + s.items.filter(id => S.level(items[id]) >= 2).length, 0);
      const nodes = sts.map((s, i) => {
        const ss = stageState(s, items, open), isCur = cur && s.id === cur.id;
        const cls = ss.done ? "done" : isCur ? "cur" : ss.isOpen ? "open" : "locked";
        return '<button class="mnode ' + cls + ' ' + pos[i % 3] + '" data-act="peek" data-stage="' + s.id + '" style="--p:' + ss.pct + '" aria-label="' + U.esc(s.title) + '">' +
          (isCur ? '<span class="pin">' + U.avatar() + '</span>' : '') +
          '<span class="tok"><span class="tok-in">' + (ss.done ? U.ICON.star : ss.isOpen ? (i + 1) : U.ICON.lock) + '</span></span>' +
          '<span class="mlabel">' + U.esc(s.title) + (ss.isOpen && !ss.done ? '<small>' + ss.pct + '%</small>' : '') + '</span></button>';
      }).join("");
      return '<section class="district' + (chOpen ? "" : " dim") + '" style="--c:' + ch.color + '">' +
        '<div class="banner"><span class="medal-c">' + U.ICON[ch.icon || "star"] + '</span><div><b>' + U.esc(ch.title) + '</b><span>' + U.esc(ch.subtitle) + '</span></div><span class="cnt">' + got + '/' + total + '</span></div>' +
        '<div class="path"><svg class="trail" viewBox="0 0 300 330" preserveAspectRatio="none" aria-hidden="true"><path d="M240 40 C 240 110, 150 80, 150 165 S 60 220, 60 290" /></svg>' + nodes + '</div>' +
        (chOpen ? '' : '<p class="lock-note">' + U.ICON.lock + ' נפתח כשתתקדמי בשלב הראשון של הפרק הקודם</p>') +
        U.skyline(ch.icon) + '</section>';
    }).join("");
  }
  function showHome() {
    leave(); screen = "home"; WP.Session.stop();
    const now = St.now(), items = St.data.items, plan = S.plan(items, now);
    const open = S.unlocked(items), stages = WP.Content.stages;
    const cur = stages.filter(s => open.indexOf(s.id) !== -1 && stageState(s, items, open).pct < 100)[0] || stages.filter(s => open.indexOf(s.id) !== -1).slice(-1)[0];
    const qs = todayQuests(), weak = S.weak(items, 10), qn = qs.list.filter(x => x.done).length;
    const isl = islandData(items, open, cur), curIndex = Math.max(0, isl.findIndex(x => x.cur)); homeCur = curIndex;
    const can = plan.reviews.length + plan.fresh.length > 0;
    const meta = [plan.reviews.length ? plan.reviews.length + " חזרות" : "", plan.fresh.length ? plan.fresh.length + " חדשות" : "", can ? "כ-" + plan.minutes + " דק'" : ""].filter(Boolean).join(" · ");
    root().innerHTML =
      '<div class="h4">' +
      '<div class="world" id="world"></div>' +
      '<header class="hud4"><button class="coin" data-act="wardrobe" aria-label="חדר ההלבשה של מרגו">' + U.avatar("coin-m") + '</button>' +
      '<span class="sp"></span>' +
      '<span class="pill4" title="ימים ברצף">' + U.ICON.flame + '<b>' + streak() + '</b></span>' +
      '<span class="pill4" title="כוכבים">' + U.ICON.star + '<b>' + (St.data.profile.stars || 0) + '</b></span>' +
      '<button id="sync" class="sync local" data-act="settings" aria-label="הגדרות, שמירה וגיבוי"><b></b><span>במכשיר</span></button></header>' +
      '<section class="next4">' +
      '<div class="tt"><small>' + (cur ? 'השלב שלך · ' + U.esc(cur.chapterTitle) + ' · ' + (cur.inChapter + 1) + '/3' : 'המסע') + '</small><b>' + (cur ? U.esc(cur.title) : 'הכול מוכן') + '</b><span class="meta">' + (meta || "אין חזרות כרגע. מחר יחכו חדשות.") + '</span>' +
      (cur ? '<span class="prog"><i><b style="width:' + Math.round(fracOf(cur, items) * 100) + '%"></b></i><span>' + cur.items.filter(id => S.level(items[id]) >= 2).length + '/' + cur.items.length + ' נשלפו · 60% פותח את הבא</span></span>' : '') +
      (weak.length >= 3 ? '<button class="weak4" data-act="weak">' + U.ICON.bolt + ' חיזוק ' + weak.length + ' מילים חלשות</button>' : '') + '</div>' +
      '<button class="en4 play4" data-act="go"' + (can ? '' : ' disabled') + '><svg viewBox="0 0 24 24"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l11.8-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z" fill="currentColor"/></svg><span>' + (St.data.profile.sessions ? "שחקי" : "מתחילים") + (can ? '<small>כ-' + plan.minutes + ' דק\'</small>' : '') + '</span></button></section>' +
      '<nav class="dock4"><button class="on" data-act="focuscur">' + '<span class="ic">' + U.ICON.map + '</span>המסע</button>' +
      '<button data-act="quests"><span class="ic">' + U.ICON.chest + '</span>משימות' + (qn < 3 ? '<em>' + qn + '/3</em>' : '<em class="ok">✓</em>') + '</button>' +
      '<button data-act="bank"><span class="ic">' + U.ICON.book + '</span>בנק</button>' +
      '<button data-act="progress"><span class="ic">' + U.ICON.trophy + '</span>התקדמות</button></nav>' +
      '</div>';
    const host = document.getElementById("world");
    const say = '<div class="wsay">' + U.esc(greeting(plan)) + '</div>';
    if (WP.World && WP.World.available()) {
      try { world = WP.World.home(host, { islands: isl, curIndex, curStage: cur ? cur.inChapter : null, margoHTML: '<div class="wm-in">' + say + U.avatar("standing") + '</div>', onPick: id => showChapter(id) }); }
      catch (e) { world = null; flatWorld(host, isl, say); }
    } else flatWorld(host, isl, say);
    syncBadge();
  }
  function flatWorld(host, isl, say) {
    host.classList.add("flat");
    host.innerHTML = '<div class="flat-in">' + say + isl.map(d => '<button class="flat-i' + (d.open ? "" : " ghost") + (d.cur ? " cur" : "") + '" data-act="chapter" data-ch="' + d.id + '"><b>' + d.title + '</b><span>' + (d.sub || "עוד לא נפתח") + '</span></button>').join("") + '</div>';
  }
  function showChapter(chId) {
    const ch = WP.Content.chapters().find(c => c.id === chId); if (!ch) return;
    const items = St.data.items, open = S.unlocked(items), sts = WP.Content.stages.filter(s => s.chapter === chId);
    closeSheet();
    const sheet = document.createElement("div"); sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="' + U.esc(ch.title) + '"><div class="sheet-h"><div><small style="color:var(--muted)">' + U.esc(ch.subtitle || "") + '</small><br><b>' + U.esc(ch.title) + '</b></div><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      sts.map((s, i) => { const ss = stageState(s, items, open), done = S.meets(s, items); return '<button class="st4' + (ss.isOpen ? "" : " locked") + (done ? " done" : "") + '" data-act="peek" data-stage="' + s.id + '"><span class="n">' + (done ? U.ICON.check : ss.isOpen ? (i + 1) : U.ICON.lock) + '</span><span class="t"><b>' + U.esc(s.title) + '</b><small>' + (ss.isOpen ? ss.pct + "% נשלפו" + (done ? " · הבניין עומד" : " · הבניין בבנייה") : "שרטוט. נפתח כשהשלב הקודם עובר 60%") + '</small></span><span class="bar"><i style="width:' + ss.pct + '%"></i></span></button>'; }).join("") +
      '<p class="honest-s">כל שלב הוא מבנה על האי. הגובה שלו הוא אחוז המילים שנשלפו בהצלחה, לפי מה שנמדד.</p></div>';
    document.body.appendChild(sheet);
  }
  function showQuests() {
    const qs = todayQuests(); closeSheet();
    const sheet = document.createElement("div"); sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="המשימות של היום"><div class="sheet-h"><b>המשימות של היום</b><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      qs.list.map(x => { const d = QMAP[x.id]; return '<div class="q4' + (x.done ? " done" : "") + '"><span class="qi">' + (x.done ? U.ICON.check : U.ICON.bolt) + '</span><div class="qt"><b>' + U.esc(d.t) + '</b><span class="qbar"><i style="width:' + Math.min(100, Math.round(x.prog / d.n * 100)) + '%"></i></span></div><span class="qr">+10 ' + U.ICON.star + '</span></div>'; }).join("") +
      '<p class="honest-s">שלוש משימות ביום, מתחלפות בחצות. כולן יחד: בונוס 15 כוכבים. הכוכבים פותחים בגדים למרגו ולא מודדים זיכרון.</p></div>';
    document.body.appendChild(sheet);
  }
  function showProgress() {
    const items = St.data.items, c = S.counts(items), ach = St.data.profile.ach || {}, now = St.now();
    const week = [...Array(7)].map((_, i) => St.data.profile.days[St.dayKey(now - (6 - i) * 86400000)] ? 1 : 0);
    closeSheet();
    const sheet = document.createElement("div"); sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="התקדמות"><div class="sheet-h"><b>התקדמות</b><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      '<div class="pg4"><div><b>' + c.seen + '</b><span>נפגשו</span></div><div><b>' + c.understood + '</b><span>נשלפו</span></div><div><b>' + c.solid + '</b><span>יציבות 3+ ימים</span></div><div><b>' + c.strong + '</b><span>יציבות 21+ ימים</span></div></div>' +
      '<div class="wk4">' + week.map((d, i) => '<i class="' + (d ? "on" : "") + '"></i>').join("") + '<span>7 הימים האחרונים</span></div>' +
      '<div class="sec4">הישגים · ' + ACH.filter(a => ach[a.id]).length + '/' + ACH.length + '</div>' +
      '<div class="ach4">' + ACH.map(a => '<div class="' + (ach[a.id] ? "got" : "") + '"><span class="m">' + (ach[a.id] ? U.ICON.star : U.ICON.lock) + '</span><b>' + U.esc(a.t) + '</b><small>' + U.esc(a.d) + '</small></div>').join("") + '</div>' +
      '<p class="honest-s">כל המספרים כאן נמדדו באפליקציה. "נשלפה" = עניתי נכון בלי רמז, או דיווחתי בשליפה שקטה.</p></div>';
    document.body.appendChild(sheet);
  }

  function showPeek(stageId) {
    const s = WP.Content.stages.find(x => x.id === stageId); if (!s) return;
    const items = St.data.items, open = S.unlocked(items), ss = stageState(s, items, open);
    const dots = id => { const l = S.level(items[id]); return '<span class="lvl">' + [1, 2, 3, 4].map(k => '<i class="' + (l >= k ? "on" : "") + '"></i>').join("") + '</span>'; };
    const sheet = document.createElement("div");
    sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="' + U.esc(s.title) + '" style="--c:' + s.color + '">' +
      '<div class="sheet-h"><div><small style="color:var(--muted)">' + U.esc(s.chapterTitle) + '</small><br><b>' + U.esc(s.title) + '</b></div><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      (ss.isOpen ? '<p class="peek-sub">' + ss.pct + '% נשלפו · ' + ss.strong + ' יציבות</p>' : '<p class="peek-sub">השלב נפתח כש-60% מהשלב הקודם נשלפו. אפשר כבר להציץ.</p>') +
      '<div class="peek-list">' + s.items.map(id => { const it = WP.Content.byId[id], seen = S.level(items[id]) >= 1; return '<div class="pw' + (seen ? "" : " hid") + '"><span class="en">' + U.esc(it.en) + '</span><span class="he">' + (seen ? U.esc(it.he) : "עוד לא נפגשתן") + '</span>' + dots(id) + '</div>'; }).join("") + '</div>' +
      '<p class="honest-s">הנקודות: נראתה · נשלפה · יציבה 3+ ימים · יציבה 21+ ימים. לפי מה שנמדד באפליקציה.</p>' +
      '</div>';
    document.body.appendChild(sheet);
  }

  /* ---------- session ---------- */
  function startSession(extra, weak) {
    const plan = S.plan(St.data.items, St.now(), { extraNew: extra, weak: weak });
    if (!plan.reviews.length && !plan.fresh.length) { showHome(); return; }
    leave();
    before = { counts: S.counts(St.data.items), open: S.unlocked(St.data.items).length, fr: Object.fromEntries(WP.Content.stages.map(s => [s.id, fracOf(s, St.data.items)])), done: Object.fromEntries(WP.Content.stages.map(s => [s.id, S.meets(s, St.data.items)])) };
    screen = "session";
    root().innerHTML =
      '<header class="top4"><button class="icon-btn x4" data-act="home" aria-label="חזרה למסע">✕</button>' +
      '<div id="strack" class="track4"><div id="sfill" class="fill"></div></div>' +
      '<span id="combo" class="combo" aria-live="polite"></span>' +
      '<span class="pill4" id="sstars" data-base="' + (St.data.profile.stars || 0) + '">' + U.ICON.star + '<b>' + (St.data.profile.stars || 0) + '</b></span></header>' +
      '<main class="stage-wrap"><button class="lean host" data-act="host" aria-label="מרגו">' + U.avatar() + '</button><div id="quip" class="quip" role="status" aria-live="polite"></div>' +
      '<section id="stage" class="stage" aria-live="polite"></section></main><footer id="actions" class="actions"></footer>';
    WP.Session.start(plan, finish);
  }

  function finish(sum) {
    const now = St.now(), items = St.data.items;
    let firstMiss = 0, comeback = false;
    for (const id in sum.res) {
      const r = sum.res[id], prev = items[id];
      let result;
      if (r.kind === "new") { result = r.learned ? "learned" : "notyet"; if (r.firstOk === false) firstMiss++; }
      else { if (r.firstOk === null) continue; result = r.failed ? "fail" : r.partial ? "partial" : "good"; if (r.firstOk === false) firstMiss++; if (result === "good" && prev && prev.ivl >= 1) comeback = true; }
      St.putItem(id, S.grade(Object.assign(S.fresh(), prev || {}), result, now));
    }
    const after = S.counts(items), openNow = S.unlocked(items);
    const unlockedStage = openNow.length > before.open;
    const chapterDone = WP.Content.chapters().some(ch => { const ids = WP.Content.stages.filter(s => s.chapter === ch.id).flatMap(s => s.items); return ids.length && ids.every(id => S.level(items[id]) >= 2); });
    const types = new Set(); Object.values(items).forEach(st => Object.keys(st.tr || {}).forEach(t => types.add(t)));
    const got = [], qs = todayQuests(), qDone = [];
    qs.list.forEach(x => { if (x.done) return; const d = QMAP[x.id]; x.prog = Math.min(d.n, Math.max(x.prog, d.f(sum))); if (x.prog >= d.n) { x.done = true; qDone.push(d); } });
    let starsGain = sum.stats.stars + 5 + qDone.length * 10;
    const bonus = !qs.bonus && qs.list.every(x => x.done); if (bonus) { qs.bonus = true; starsGain += 15; }
    sum.starsGain = starsGain; sum.qDone = qDone; sum.bonus = bonus;
    St.touchProfile(p => {
      p.quests = qs; p.stars = (p.stars || 0) + starsGain;
      p.sessions = (p.sessions || 0) + 1;
      const k = St.dayKey(now); p.days[k] = (p.days[k] || 0) + Object.keys(sum.res).length;
      const award = id => { if (!p.ach[id]) { p.ach[id] = now; got.push(id); } };
      award("first");
      if (after.understood >= 10) award("ten");
      if (after.understood >= 30) award("thirty");
      if (after.understood >= 50) award("fifty");
      if (after.understood >= 100) award("hundred");
      if (unlockedStage) award("stage");
      if (chapterDone) award("chapter");
      if (comeback) award("comeback");
      if (after.solid >= 1) award("veteran");
      if (Object.keys(sum.res).length >= 8 && firstMiss === 0) award("perfect");
      if (sum.best >= 10) award("combo10");
      if (Object.keys(p.days).length >= 3) award("days3");
      if (Object.keys(p.days).length >= 7) award("days7");
      if (["listen", "gap", "recall", "pick", "reverse", "match", "scene"].every(t => types.has(t))) award("allgames");
    });
    St.flushNow();
    showEnd(sum, after, got, unlockedStage, openNow);
  }

  function showEnd(sum, after, got, unlockedStage, openNow) {
    leave(); screen = "end";
    const items = St.data.items, res = sum.res, ids = Object.keys(res);
    const nw = ids.filter(id => res[id].kind === "new"), rv = ids.filter(id => res[id].kind === "review");
    const learned = nw.filter(id => res[id].learned), shaky = nw.filter(id => !res[id].learned);
    const kept = rv.filter(id => res[id].firstOk === true), slipped = rv.filter(id => res[id].firstOk !== true);
    const tomorrow = S.forecast(items, St.now(), 26);
    const nextPlan = S.plan(items, St.now(), { extraNew: true });
    const newStage = unlockedStage ? WP.Content.stages.find(s => s.id === openNow[openNow.length - 1]) : null;
    // which structure grew the most this round
    let best = null;
    WP.Content.stages.forEach(s => { const f = fracOf(s, items), d = f - (before.fr[s.id] || 0); if (d > 0 && (!best || d > best.d)) best = { s, d, from: before.fr[s.id] || 0, to: f }; });
    if (!best) { const touched = ids.map(id => WP.Content.stageOf[id]).filter(Boolean)[0]; const s = WP.Content.stages.find(x => x.id === touched) || WP.Content.stages[0]; best = { s, d: 0, from: fracOf(s, items), to: fracOf(s, items) }; }
    const stg = best.s, nowDone = S.meets(stg, items), wasDone = before.done[stg.id];
    const open = S.unlocked(items);
    const isl = islandData(items, open, stg).find(x => x.id === stg.chapter);
    if (!wasDone && nowDone) isl.parts[stg.inChapter].state = "done";
    const builtLine = !wasDone && nowDone ? 'השלב "' + U.esc(stg.title) + '" עבר את הרף. הבניין עומד.' : best.d > 0 ? 'הבניין של "' + U.esc(stg.title) + '" עלה ל-' + Math.round(best.to * 100) + '%' : 'העולם שומר על מה שזכרת';
    const chips = (arr, cls) => arr.map(id => '<span class="wc ' + cls + '">' + U.esc(WP.Content.byId[id].en) + '</span>').join("");
    const qLine = sum.qDone.length ? sum.qDone.length * 10 + " על משימות" + (sum.bonus ? " · 15 בונוס" : "") : "";
    U.tone(unlockedStage ? "unlock" : "end");
    root().innerHTML =
      '<div class="e4"><div class="world" id="world"></div>' +
      '<header class="hud4"><span class="sp"></span><span class="pill4" id="estars">' + U.ICON.star + '<b>' + ((St.data.profile.stars || 0) - sum.starsGain) + '</b></span></header>' +
      '<div class="ban4"><b>' + (newStage ? "שלב חדש נפתח!" : "סבב הושלם!") + '</b><span>' + U.esc(stg.chapterTitle) + ' · ' + U.esc(stg.title) + '</span></div>' +
      '<div class="built4">' + builtLine + '</div>' +
      '<button class="lean host end" data-act="host" aria-label="מרגו">' + U.avatar() + '</button><div id="quip" class="quip end"></div>' +
      '<section class="panel4">' +
      '<div class="gain4"><span class="gs">' + U.ICON.star + '</span><div><b id="gcount">+0</b><small>' + sum.stats.stars + ' על תשובות · 5 על הסבב' + (qLine ? " · " + qLine : "") + '</small></div></div>' +
      '<div class="st3"><div><b>' + learned.length + '/' + nw.length + '</b><span>חדשות נקלטו</span><small>נמדד</small></div><div><b>' + kept.length + '/' + rv.length + '</b><span>חזרות נשמרו</span><small>נמדד</small></div><div><b>' + after.understood + '</b><span>בזיכרון</span><small>נמדד</small></div></div>' +
      (newStage ? '<div class="unl4">' + U.ICON.star + '<span>נפתח: <b>' + U.esc(newStage.chapterTitle) + ' · ' + U.esc(newStage.title) + '</b></span></div>' : '') +
      (got.length ? '<div class="unl4 ach">' + U.ICON.trophy + '<span>הישג: <b>' + got.map(id => ACHMAP[id].t).join(" · ") + '</b></span></div>' : '') +
      ((learned.length + kept.length + shaky.length + slipped.length) ? '<div class="wrow">' + chips(learned, "new") + chips(kept, "") + chips(shaky, "shaky") + chips(slipped, "shaky") + '</div>' : '') +
      '<p class="honest-s">ב-26 השעות הקרובות יחכו ' + tomorrow + ' חזרות. מילים בכתום יחזרו בקרוב לחיזוק.</p>' +
      '</section>' +
      '<footer class="btn4"><button class="en4 sec" data-act="home">למסע</button><button class="en4 go4" data-act="more"' + (nextPlan.reviews.length + nextPlan.fresh.length ? '' : ' disabled') + '>' + (nextPlan.fresh.length ? 'עוד סבב · ' + nextPlan.fresh.length + ' חדשות' : 'עוד סבב') + '</button></footer></div>';
    const host = document.getElementById("world");
    if (WP.World && WP.World.available() && isl) { try { world = WP.World.finale(host, { island: isl, grow: { part: stg.inChapter, from: best.from, to: best.to }, celebrate: true }); } catch (e) { host.classList.add("flat"); } }
    else host.classList.add("flat");
    U.face("h");
    const gc = document.getElementById("gcount"), es = document.querySelector("#estars b"), base = (St.data.profile.stars || 0) - sum.starsGain;
    let n = 0; const step = Math.max(1, Math.round(sum.starsGain / 20));
    setTimeout(() => { const tick = setInterval(() => { n = Math.min(sum.starsGain, n + step); if (gc) gc.textContent = "+" + n; if (es) es.textContent = base + n; if (n >= sum.starsGain) clearInterval(tick); }, 40); }, 900);
    setTimeout(() => U.quip(got.length ? "הישג חדש. אני מפנה מקום על המדף." : !wasDone && nowDone ? "בניין שלם. אני כבר בוחרת וילונות." : sum.qDone.length ? "משימה הושלמה. מתחילה לחשוב על כובע חדש." : "יפה. העיר זוכרת, וגם את.", "h", true), 1300);
  }

  /* ---------- word bank ---------- */
  let bankFilter = "all";
  function showBank() {
    leave(); screen = "bank";
    const items = St.data.items, all = WP.Content.items;
    const L = id => S.level(items[id]);
    const groups = { all: all.filter(i => L(i.id) >= 1), weak: S.weak(items, 999).map(id => WP.Content.byId[id]), learning: all.filter(i => L(i.id) === 1 || L(i.id) === 2), solid: all.filter(i => L(i.id) >= 3) };
    const list = groups[bankFilter] || groups.all;
    const chip = (k, t) => '<button class="fchip' + (bankFilter === k ? " on" : "") + '" data-act="bankf" data-f="' + k + '">' + t + ' <b>' + groups[k].length + '</b></button>';
    root().innerHTML = '<div class="home">' +
      '<header class="hbar"><button class="icon-btn" data-act="home" aria-label="חזרה">' + U.ICON.home + '</button><div class="logo">בנק המילים</div><span class="stars">' + U.ICON.book + '<b>' + groups.all.length + '/' + all.length + '</b></span></header>' +
      '<div class="fchips">' + chip("all", "הכול") + chip("weak", "חלשות") + chip("learning", "בלמידה") + chip("solid", "יציבות") + '</div>' +
      (list.length ? '<div class="bank">' + list.map(it => '<div class="bw"><button class="play" data-act="bsay" data-id="' + it.id + '" aria-label="השמעה">' + U.ICON.play + '</button><div class="bt"><span class="en">' + U.esc(it.en) + '</span><span class="he">' + U.esc(it.he) + '</span></div><span class="lvl">' + [1, 2, 3, 4].map(k => '<i class="' + (L(it.id) >= k ? "on" : "") + '"></i>').join("") + '</span></div>').join("") + '</div>'
        : '<div class="soon-card">' + U.ICON.book + '<div><b>עוד אין כאן מילים</b><span>מילים נכנסות לבנק ברגע שפוגשים אותן בסבב.</span></div></div>') +
      (groups.weak.length >= 3 ? '<button class="weak-btn" data-act="weak">' + U.ICON.bolt + ' לתרגל את החלשות עכשיו</button>' : '') +
      '<p class="honest-s" style="color:var(--soft)">הנקודות: נראתה · נשלפה · יציבה 3+ ימים · יציבה 21+ ימים. לפי מה שנמדד באפליקציה.</p></div>';
  }

  /* ---------- wardrobe ---------- */
  function showWardrobe(note) {
    const p = St.data.profile, w = U.wardrobe(), owned = (p.wardrobe && p.wardrobe.owned) || [];
    const isOn = x => x.hat ? (w.hat === x.hat && w.hatColor === x.hatColor) : w.scarf === x.scarf;
    const has = x => x.cost === 0 || owned.indexOf(x.id) !== -1;
    closeSheet();
    const sheet = document.createElement("div"); sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="חדר ההלבשה">' +
      '<div class="sheet-h"><b>חדר ההלבשה של מרגו</b><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      '<div class="wr-top"><div class="wr-fig">' + U.figure() + '</div><div><span class="stars dark">' + U.ICON.star + '<b>' + (p.stars || 0) + '</b></span><p class="peek-sub">' + (note || "כוכבים מתשובות נכונות ומשימות יומיות.") + '</p></div></div>' +
      '<div class="wr-grid">' + WARDROBE.map(x => '<button class="wr' + (isOn(x) ? " on" : "") + (has(x) ? "" : " locked") + '" data-act="wear" data-id="' + x.id + '"><span class="sw" style="background:' + (x.hatColor || x.scarf) + '"></span><b>' + x.t + '</b><small>' + (isOn(x) ? "עליה עכשיו" : has(x) ? "ללבוש" : x.cost + " כוכבים") + '</small></button>').join("") + '</div></div>';
    document.body.appendChild(sheet);
  }
  function wear(id) {
    const x = WARDROBE.find(w => w.id === id); if (!x) return;
    const p = St.data.profile, owned = (p.wardrobe && p.wardrobe.owned) || [];
    const buying = x.cost > 0 && owned.indexOf(x.id) === -1;
    if (buying) {
      if ((p.stars || 0) < x.cost) { showWardrobe("חסרים עוד " + (x.cost - (p.stars || 0)) + " כוכבים."); return; }
      St.touchProfile(pp => { pp.stars -= x.cost; pp.wardrobe = Object.assign({ owned: [] }, pp.wardrobe); pp.wardrobe.owned = owned.concat([x.id]); });
      U.tone("unlock");
    } else U.tone("pair");
    St.touchProfile(pp => { pp.wardrobe = Object.assign({ owned: [] }, pp.wardrobe); if (x.hat) { pp.wardrobe.hat = x.hat; pp.wardrobe.hatColor = x.hatColor; } else pp.wardrobe.scarf = x.scarf; });
    if (screen === "home") showHome();
    showWardrobe(buying ? "נפתח: " + x.t + "!" : "");
  }

  /* ---------- settings ---------- */
  function showSettings() {
    const s = St.status, p = St.data.profile;
    const when = s.last ? new Date(s.last).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
    const statusText = s.mode === "synced" ? "שמור בחשבון Claude שלך" + (when ? " · עודכן " + when : "") : s.mode === "connecting" ? "מתחבר לחשבון..." : s.mode === "error" ? "השמירה לחשבון נכשלה (" + U.esc(s.error) + "). ההתקדמות שמורה במכשיר." : "שמור במכשיר הזה בלבד" + (s.error ? " (" + U.esc(s.error) + ")" : "");
    const sheet = document.createElement("div");
    sheet.className = "sheet-wrap"; sheet.id = "sheet";
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-label="הגדרות">' +
      '<div class="sheet-h"><b>הגדרות וגיבוי</b><button class="icon-btn dark" data-act="closesheet" aria-label="סגירה">✕</button></div>' +
      '<div class="row-s"><span class="sync ' + s.mode + '"><b></b></span><div><b>שמירת התקדמות</b><p>' + statusText + '</p></div></div>' +
      '<div class="grid2"><button class="sbtn" data-act="export">ייצוא גיבוי (JSON)</button><label class="sbtn" for="impfile">ייבוא גיבוי</label><input id="impfile" type="file" accept="application/json,.json" hidden></div>' +
      '<div id="sheetmsg" class="sheetmsg" role="status"></div>' +
      '<div class="grid2"><button class="sbtn" data-act="tsound">צלילים: ' + (p.settings.sound ? "פועלים" : "כבויים") + '</button><button class="sbtn" data-act="tauto">מעבר אחרי תשובה: ' + (p.settings.auto ? "אוטומטי" : "ידני") + '</button><button class="sbtn" data-act="tcalm">אנימציות: ' + (p.settings.calm ? "מופחתות" : "מלאות") + '</button></div>' +
      '<div class="test"><b>כלי בדיקה</b><p>שעון האפליקציה: ' + (p.clock ? "+" + Math.round(p.clock / 86400000) + " ימים" : "רגיל") + '</p><div class="grid2"><button class="sbtn" data-act="skipday">לקפוץ יום קדימה</button><button class="sbtn" data-act="clockreset">שעון רגיל</button></div></div>' +
      '<button class="sbtn danger" data-act="reset">איפוס כל ההתקדמות</button>' +
      '</div>';
    document.body.appendChild(sheet);
    document.getElementById("impfile").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = St.importJSON(await f.text()); msg("יובאו " + n + " מילים. ההתקדמות מוזגה."); refresh(); }
      catch (err) { msg(err.message || "הקובץ לא נקרא"); }
    });
  }
  const msg = t => { const m = document.getElementById("sheetmsg"); if (m) m.textContent = t; };
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }
  function refresh() { closeSheet(); if (screen === "home") showHome(); showSettings(); }
  async function doExport() {
    const json = St.exportJSON(), name = "wordplay-backup-" + St.dayKey(Date.now()) + ".json";
    let dl = null; try { if (window.claude && window.claude.use) dl = await window.claude.use("downloads"); } catch (e) {}
    if (dl) { try { await dl.save({ filename: name, data: json }); msg("הגיבוי נשמר."); return; } catch (e) { if (e && e.code === "declined") { msg("השמירה בוטלה."); return; } } }
    const m = document.getElementById("sheetmsg");
    m.innerHTML = '<p>אי אפשר לשמור קובץ בתצוגה הזו. אפשר להעתיק את הגיבוי:</p><textarea id="bk" readonly rows="4"></textarea><button class="sbtn" data-act="copybk">העתקה</button>';
    document.getElementById("bk").value = json;
  }

  /* ---------- input ---------- */
  let resetArmed = 0;
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) { if (e.target.id === "sheet") closeSheet(); return; }
    const a = b.dataset.act;
    if (a === "go") { U.tone("tap"); startSession(false); }
    else if (a === "more") startSession(true);
    else if (a === "home") showHome();
    else if (a === "settings") showSettings();
        else if (a === "peek") showPeek(b.dataset.stage);
    else if (a === "weak") { U.tone("tap"); startSession(false, true); }
    else if (a === "bank") showBank();
    else if (a === "quests") showQuests();
    else if (a === "progress") showProgress();
    else if (a === "chapter") showChapter(b.dataset.ch);
    else if (a === "focuscur") { if (world && world.focusOn) world.focusOn(homeCur); }
    else if (a === "tcalm") { St.touchProfile(p => p.settings.calm = !p.settings.calm); applyCalm(); refresh(); }
    else if (a === "bankf") { bankFilter = b.dataset.f; showBank(); }
    else if (a === "bsay") U.say([WP.Content.byId[b.dataset.id].en, WP.Content.byId[b.dataset.id].plain], .9);
    else if (a === "wardrobe") showWardrobe();
    else if (a === "wear") wear(b.dataset.id);
    else if (a === "closesheet") closeSheet();
    else if (a === "export") doExport();
    else if (a === "copybk") { const t = document.getElementById("bk"); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => msg("הועתק."), () => {}); }
    else if (a === "tsound") { St.touchProfile(p => p.settings.sound = !p.settings.sound); refresh(); }
    else if (a === "tauto") { St.touchProfile(p => p.settings.auto = !p.settings.auto); refresh(); }
    else if (a === "skipday") { St.touchProfile(p => p.clock = (p.clock || 0) + 86400000); refresh(); }
    else if (a === "clockreset") { St.touchProfile(p => p.clock = 0); refresh(); }
    else if (a === "reset") {
      if (Date.now() - resetArmed < 4000) { St.reset(); resetArmed = 0; closeSheet(); showHome(); }
      else { resetArmed = Date.now(); b.textContent = "בטוחה? לחיצה נוספת תמחק הכול"; }
    }
    else if (a === "host") U.quip("tap", "h", true);
    else if (screen === "session") WP.Session.act(a, b);
  }
})(window.WP = window.WP || {});
