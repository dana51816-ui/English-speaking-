/* WORDPLAY app shell: home, session, end of session, settings. */
(function (WP) {
  "use strict";
  const U = WP.UI, S = WP.Sched, St = WP.Store;
  const A = WP.App = {};
  const root = () => document.getElementById("app");
  let screen = "home", lastPlan = null, before = null;

  const ACH = {
    first: { t: "הצגת בכורה", d: "סיימת סשן ראשון" },
    ten: { t: "10 בזיכרון", d: "10 מילים ששלפת בהצלחה" },
    thirty: { t: "30 בזיכרון", d: "30 מילים ששלפת בהצלחה" },
    stage: { t: "שלב חדש נפתח", d: "סיימת את השלב הראשון" },
    comeback: { t: "חזרה מנצחת", d: "זכרת מילה אחרי יום ויותר" },
    perfect: { t: "הצגה מושלמת", d: "סשן בלי טעות בניסיון ראשון" },
    days3: { t: "שלושה ימים", d: "למדת בשלושה ימים שונים" }
  };

  /* ---------- boot ---------- */
  A.boot = async function () {
    St.loadLocal();
    try { await WP.Content.load(); }
    catch (e) { root().innerHTML = '<div class="fatal"><b>התוכן לא נטען.</b><p>נסי לרענן את הדף. (' + U.esc(e.message) + ')</p></div>'; return; }
    U.initVoice();
    WP.Session.bind();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", e => { if (screen === "session") WP.Session.key(e); else if (e.key === "Enter" && screen === "home") { const b = document.querySelector('[data-act="go"]'); if (b) { e.preventDefault(); b.click(); } } });
    St.onChange(syncBadge);
    showHome();
    St.connect().then(ok => { if (ok && screen === "home") showHome(); });
  };

  function syncBadge() {
    const b = document.getElementById("sync"); if (!b) return;
    const m = St.status.mode;
    b.className = "sync " + m;
    b.title = m === "synced" ? "שמור בחשבון" : m === "connecting" ? "מתחבר..." : m === "error" ? "שגיאת שמירה, נשמר במכשיר" : "נשמר במכשיר הזה";
    b.querySelector("span").textContent = m === "synced" ? "שמור" : m === "connecting" ? "מתחבר" : m === "error" ? "שגיאה" : "במכשיר";
  }

  /* ---------- home ---------- */
  function greeting(plan, c) {
    const p = St.data.profile;
    if (!p.sessions) return "ברוכה הבאה לבמה. " + plan.fresh.length + " מילים ראשונות מחכות, כ-" + plan.minutes + " דקות.";
    if (plan.reviews.length >= 6) return plan.reviews.length + " מילים מבקשות חזרה לפני שהן נשכחות. אחריהן, חדשות.";
    if (plan.reviews.length) return "יש " + plan.reviews.length + " חזרות קצרות ו-" + plan.fresh.length + " מילים חדשות. זה הסדר הנכון.";
    if (!plan.fresh.length) return "אין מה לחזור כרגע, והשלב הבא עוד נעול. מחר יחכו לך חזרות.";
    return "אין חזרות שמחכות. זמן מצוין למילים חדשות.";
  }
  function showHome() {
    screen = "home"; WP.Session.stop();
    const now = St.now(), items = St.data.items, plan = lastPlan = S.plan(items, now);
    const c = S.counts(items), open = S.unlocked(items);
    const stages = WP.Content.stages;
    const curStage = stages.filter(s => open.indexOf(s.id) !== -1).slice(-1)[0] || stages[0];
    const week = [...Array(7)].map((_, i) => { const k = St.dayKey(now - (6 - i) * 86400000); return St.data.profile.days[k] ? 1 : 0; });
    const chapters = WP.Content.chapters();
    const chapterCard = ch => {
      const sts = stages.filter(s => s.chapter === ch.id);
      if (ch.soon) return '<div class="chap soon" style="--c:' + ch.color + '"><div class="chap-t">' + U.esc(ch.title) + '</div><div class="chap-s">' + U.ICON.lock + ' בקרוב</div></div>';
      const nodes = sts.map(s => {
        const ids = s.items, lv = ids.map(id => S.level(items[id]));
        const pct = Math.round(lv.filter(l => l >= 2).length / ids.length * 100), isOpen = open.indexOf(s.id) !== -1;
        return '<div class="node' + (isOpen ? "" : " locked") + (s.id === curStage.id ? " cur" : "") + '" style="--p:' + pct + '"><div class="ring"><span>' + (isOpen ? pct + "%" : U.ICON.lock) + '</span></div><div class="node-t">' + U.esc(s.title) + '</div></div>';
      }).join('<div class="link"></div>');
      return '<div class="chap" style="--c:' + ch.color + '"><div class="chap-t">' + U.esc(ch.title) + '</div><div class="chap-s">' + U.esc(ch.subtitle) + '</div><div class="nodes">' + nodes + '</div></div>';
    };
    root().innerHTML =
      '<header class="hbar"><div class="logo en">WORD<i>play</i></div><div class="hbar-r"><button id="sync" class="sync local" data-act="settings"><b></b><span>במכשיר</span></button><button class="icon-btn" data-act="settings" aria-label="הגדרות וגיבוי">' + U.ICON.gear + '</button></div></header>' +
      '<section class="hero">' +
        '<div class="curtain l"></div><div class="curtain r"></div><div class="spot"></div>' +
        '<div class="hero-fig host">' + U.figure() + '</div>' +
        '<div class="hero-say"><div class="who">מרגו</div><p>' + U.esc(greeting(plan, c)) + '</p></div>' +
        '<div class="floor"></div>' +
      '</section>' +
      '<section class="today">' +
        '<div class="plan"><div><b>' + plan.reviews.length + '</b><span>חזרות</span></div><div><b>' + plan.fresh.length + '</b><span>חדשות</span></div><div><b>' + plan.minutes + '</b><span>דקות בערך</span></div></div>' +
        '<button class="go" data-act="go"' + (plan.reviews.length + plan.fresh.length ? '' : ' disabled') + '><span>' + (St.data.profile.sessions ? "המשך" : "להתחיל") + '</span><svg width="22" height="22" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        (plan.dueTotal > plan.reviews.length ? '<p class="note">עוד ' + (plan.dueTotal - plan.reviews.length) + ' חזרות יחכו לסשן הבא.</p>' : '') +
      '</section>' +
      '<section class="journey"><div class="sec-t">המסע · עונה 1</div><div class="chaps">' + chapters.map(chapterCard).join("") + '</div></section>' +
      '<section class="stats">' +
        '<div><b>' + c.understood + '</b><span>מילים ששלפת<br><i>נמדד</i></span></div>' +
        '<div><b>' + c.solid + '</b><span>יציבות 3+ ימים<br><i>נמדד</i></span></div>' +
        '<div class="week" aria-label="ימי למידה השבוע">' + week.map(d => '<i class="' + (d ? "on" : "") + '"></i>').join("") + '<span>השבוע</span></div>' +
      '</section>';
    syncBadge();
  }

  /* ---------- session ---------- */
  function startSession(extra) {
    const now = St.now();
    const plan = S.plan(St.data.items, now, { extraNew: extra });
    if (!plan.reviews.length && !plan.fresh.length) { showHome(); return; }
    before = { counts: S.counts(St.data.items), open: S.unlocked(St.data.items).length };
    screen = "session";
    root().innerHTML =
      '<header class="top"><button class="host" data-act="host" aria-label="מרגו">' + U.avatar() + '</button><div id="quip" class="quip" role="status" aria-live="polite"></div>' +
      '<div id="strack" class="track"><div id="sfill" class="fill"></div></div><span id="combo" class="combo" aria-live="polite"></span>' +
      '<button class="icon-btn" data-act="home" aria-label="חזרה לבית">' + U.ICON.home + '</button></header>' +
      '<main class="stage-wrap"><section id="stage" class="stage" aria-live="polite"></section></main><footer id="actions" class="actions"></footer>';
    WP.Session.start(plan, finish);
  }

  function finish(sum) {
    const now = St.now(), items = St.data.items;
    let graded = 0, firstMiss = 0, comeback = false;
    for (const id in sum.res) {
      const r = sum.res[id], prev = items[id];
      let result;
      if (r.kind === "new") result = r.learned ? "learned" : "notyet";
      else { if (r.firstOk === null) continue; result = r.failed ? "fail" : r.partial ? "partial" : "good"; graded++; if (r.firstOk === false) firstMiss++; if (result === "good" && prev && prev.ivl >= 1) comeback = true; }
      if (r.kind === "new" && r.firstOk === false) firstMiss++;
      const st = S.grade(Object.assign(S.fresh(), prev || {}), result, now);
      St.putItem(id, st);
    }
    const after = S.counts(items), open = S.unlocked(items).length;
    const unlockedStage = open > before.open;
    const got = [];
    St.touchProfile(p => {
      p.sessions = (p.sessions || 0) + 1;
      const k = St.dayKey(now); p.days[k] = (p.days[k] || 0) + Object.keys(sum.res).length;
      const award = id => { if (!p.ach[id]) { p.ach[id] = now; got.push(id); } };
      award("first");
      if (after.understood >= 10) award("ten");
      if (after.understood >= 30) award("thirty");
      if (unlockedStage) award("stage");
      if (comeback) award("comeback");
      if (Object.keys(sum.res).length >= 8 && firstMiss === 0) award("perfect");
      if (Object.keys(p.days).length >= 3) award("days3");
    });
    St.flushNow();
    showEnd(sum, after, got, unlockedStage);
  }

  function showEnd(sum, after, got, unlockedStage) {
    screen = "end";
    const res = sum.res, ids = Object.keys(res);
    const nw = ids.filter(id => res[id].kind === "new"), rv = ids.filter(id => res[id].kind === "review");
    const learned = nw.filter(id => res[id].learned), shaky = nw.filter(id => !res[id].learned);
    const kept = rv.filter(id => res[id].firstOk === true), slipped = rv.filter(id => res[id].firstOk !== true);
    const tomorrow = S.forecast(St.data.items, St.now(), 26);
    const nextPlan = S.plan(St.data.items, St.now(), { extraNew: true });
    const chips = (arr, cls) => arr.map(id => '<span class="chip ' + cls + '">' + U.esc(WP.Content.byId[id].en) + '</span>').join("");
    U.tone(unlockedStage ? "unlock" : "end");
    root().innerHTML =
      '<header class="top"><button class="host" data-act="host" aria-label="מרגו">' + U.avatar() + '</button><div id="quip" class="quip"></div><div class="track"><div class="fill" style="width:100%"></div></div><button class="icon-btn" data-act="home" aria-label="חזרה לבית">' + U.ICON.home + '</button></header>' +
      '<main class="stage-wrap"><section class="stage end"><div class="stage-in">' +
        '<div class="end-hero"><h2 class="hero-title">Bravo<i>!</i></h2><p class="sub">' + sum.steps + ' פריטים · ' + Math.max(1, Math.round(sum.ms / 60000)) + ' דק\' · רצף שיא ' + sum.best + '</p></div>' +
        '<div class="legend"><div><b>' + learned.length + '/' + nw.length + '</b><span>חדשות נקלטו</span></div><div><b>' + kept.length + '/' + rv.length + '</b><span>חזרות נשמרו</span></div><div><b>' + after.understood + '</b><span>סה"כ בזיכרון</span></div></div>' +
        (unlockedStage ? '<div class="unlock">' + U.ICON.intro + '<div><b>שלב חדש נפתח במסע</b><span>המילים החלשות ימשיכו להופיע בחזרות.</span></div></div>' : '') +
        (got.length ? '<div class="achs">' + got.map(id => '<div class="ach"><span class="medal">' + U.ICON.intro + '</span><div><b>' + ACH[id].t + '</b><span>' + ACH[id].d + '</span></div></div>').join("") + '</div>' : '') +
        (learned.length ? '<div><p class="sub lbl">נקלטו היום</p><div class="lineup">' + chips(learned, "new") + '</div></div>' : '') +
        ((shaky.length + slipped.length) ? '<div><p class="sub lbl">יחזרו בקרוב לחיזוק</p><div class="lineup">' + chips(shaky, "shaky") + chips(slipped, "lost") + '</div></div>' : '') +
        (kept.length ? '<div><p class="sub lbl">חזרות שעברו</p><div class="lineup">' + chips(kept, "") + '</div></div>' : '') +
        '<p class="honest-s">ב-26 השעות הקרובות יחכו לך ' + tomorrow + ' חזרות. "נקלטה" = שליפה מוצלחת בהמשך הסבב. שליפה שקטה נספרת לפי הדיווח שלך.</p>' +
      '</div></section></main>' +
      '<footer class="actions"><div class="pair2"><button class="ghost" data-act="home">לבית</button><button class="primary" data-act="more"' + (nextPlan.reviews.length + nextPlan.fresh.length ? '' : ' disabled') + '>' + (nextPlan.fresh.length ? 'עוד סבב · ' + nextPlan.fresh.length + ' חדשות' : 'עוד סבב') + '</button></div></footer>';
    U.face("h");
    setTimeout(() => U.quip(got.length ? "קידה. ויש גם מדליה." : "קידה. ההצגה הבאה מחר.", "h", true), 200);
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
      '<div class="grid2"><button class="sbtn" data-act="tsound">צלילים: ' + (p.settings.sound ? "פועלים" : "כבויים") + '</button><button class="sbtn" data-act="tauto">מעבר אחרי תשובה: ' + (p.settings.auto ? "אוטומטי" : "ידני") + '</button></div>' +
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
