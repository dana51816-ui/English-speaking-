/* WORDPLAY learner store: local-first, synced to the artifact's private per-user database when available.
   Format is versioned plain JSON so it can be exported and moved to a PWA or native app later. */
(function (WP) {
  "use strict";
  const KEY = "wordplay:v1";
  const St = WP.Store = {
    data: null,
    status: { mode: "local", account: false, last: 0, error: "" },
    listeners: []
  };

  const blank = () => ({ v: 1, items: {}, profile: { created: Date.now(), sessions: 0, days: {}, ach: {}, settings: { sound: true, auto: false }, clock: 0, upd: 0 } });

  St.now = () => Date.now() + ((St.data && St.data.profile.clock) || 0);
  St.dayKey = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  St.onChange = fn => St.listeners.push(fn);
  const emit = () => St.listeners.forEach(fn => { try { fn(St.status); } catch (e) {} });

  St.loadLocal = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    St.data = d && d.v === 1 ? Object.assign(blank(), d) : blank();
    St.data.profile = Object.assign(blank().profile, St.data.profile);
  };
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(St.data)); } catch (e) {} }

  /* ---------- remote (artifact db, private per user) ---------- */
  let db = null, base = null;
  const dirty = new Set(), inflight = {};
  let flushT = null;
  const docKeyFor = itemId => "items_" + ((WP.Content.chapterOf && WP.Content.chapterOf[itemId]) || "misc");

  function mergeItems(local, remote) {
    for (const id in remote) {
      const r = remote[id], l = local[id];
      if (!l || (r && (r.upd || 0) > (l.upd || 0))) local[id] = r;
    }
  }
  function mergeProfile(lp, rp) {
    if (!rp) return lp;
    const out = Object.assign({}, lp);
    out.sessions = Math.max(lp.sessions || 0, rp.sessions || 0);
    out.days = Object.assign({}, rp.days || {}, lp.days || {});
    for (const k in rp.days || {}) out.days[k] = Math.max(out.days[k] || 0, rp.days[k]);
    out.ach = Object.assign({}, rp.ach || {}, lp.ach || {});
    if ((rp.upd || 0) > (lp.upd || 0)) { out.settings = rp.settings || lp.settings; out.clock = rp.clock || 0; }
    out.created = Math.min(lp.created || Date.now(), rp.created || Date.now());
    out.upd = Math.max(lp.upd || 0, rp.upd || 0);
    return out;
  }

  St.connect = async function () {
    if (!window.claude || !window.claude.use) { St.status.mode = "local"; emit(); return false; }
    St.status.mode = "connecting"; emit();
    try {
      const [dbNs, userNs] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      const uid = userNs ? await userNs.id() : null;
      if (!dbNs || !uid) { St.status.mode = "local"; St.status.error = !dbNs ? "no-db" : "no-user"; emit(); return false; }
      db = dbNs; base = db.collection("data/users/" + uid);
      St.status.account = true;
      const snaps = await Promise.all([base.doc("profile").get()].concat(
        WP.Content.chapters().map(ch => base.doc("items_" + ch.id).get())).concat([base.doc("items_misc").get()]));
      const prof = snaps[0].exists ? snaps[0].data() : null;
      let hadRemote = !!prof;
      St.data.profile = mergeProfile(St.data.profile, prof);
      snaps.slice(1).forEach(s => { if (s.exists) { hadRemote = true; mergeItems(St.data.items, (s.data() || {}).items || {}); } });
      saveLocal();
      // push anything the server is missing or older on
      dirty.add("profile"); Object.keys(St.data.items).forEach(id => dirty.add(docKeyFor(id)));
      St.status.mode = "synced"; St.status.last = Date.now(); St.status.hadRemote = hadRemote; emit();
      scheduleFlush(300);
      return true;
    } catch (e) {
      St.status.mode = "error"; St.status.error = (e && (e.code || e.message)) || "error"; emit(); return false;
    }
  };

  function scheduleFlush(ms) { clearTimeout(flushT); flushT = setTimeout(flush, ms == null ? 1200 : ms); }
  async function flush() {
    if (!db || !base) return;
    const keys = [...dirty];
    for (const k of keys) {
      if (inflight[k]) continue;
      dirty.delete(k); inflight[k] = true;
      try {
        if (k === "profile") await base.doc("profile").set(St.data.profile);
        else {
          const items = {};
          for (const id in St.data.items) if (docKeyFor(id) === k) items[id] = St.data.items[id];
          await base.doc(k).set({ items: items, upd: Date.now() });
        }
        St.status.mode = "synced"; St.status.last = Date.now(); St.status.error = "";
      } catch (e) {
        dirty.add(k); St.status.mode = "error"; St.status.error = (e && (e.code || e.message)) || "error";
      } finally { inflight[k] = false; }
    }
    emit();
    if (dirty.size) scheduleFlush(4000);
  }

  /* ---------- writes ---------- */
  St.putItem = function (id, st) { St.data.items[id] = st; saveLocal(); dirty.add(docKeyFor(id)); scheduleFlush(); };
  St.touchProfile = function (fn) { fn(St.data.profile); St.data.profile.upd = Date.now(); saveLocal(); dirty.add("profile"); scheduleFlush(); };
  St.flushNow = () => flush();

  /* ---------- backup ---------- */
  St.exportJSON = () => JSON.stringify({ app: "wordplay", v: 1, exportedAt: new Date().toISOString(), data: St.data }, null, 1);
  St.importJSON = function (text) {
    const obj = JSON.parse(text);
    if (!obj || obj.app !== "wordplay" || obj.v !== 1 || !obj.data || !obj.data.items) throw new Error("זה לא קובץ גיבוי של WORDPLAY");
    mergeItems(St.data.items, obj.data.items);
    St.data.profile = mergeProfile(St.data.profile, obj.data.profile);
    saveLocal(); dirty.add("profile"); Object.keys(St.data.items).forEach(id => dirty.add(docKeyFor(id))); scheduleFlush(200);
    return Object.keys(obj.data.items).length;
  };
  St.reset = function () {
    St.data = blank(); saveLocal();
    dirty.add("profile"); WP.Content.chapters().forEach(ch => dirty.add("items_" + ch.id)); dirty.add("items_misc"); scheduleFlush(100);
  };
})(window.WP = window.WP || {});
