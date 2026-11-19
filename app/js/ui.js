/* WORDPLAY shared UI: audio, sound effects, host character, feedback helpers. */
(function (WP) {
  "use strict";
  const U = WP.UI = {};
  U.esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  U.prefs = () => WP.Store.data.profile.settings;

  /* ---------- speech: Claude voice where the viewer offers it, browser voice otherwise ---------- */
  let tts = null, voice = null;
  U.initVoice = async function () {
    try { speechSynthesis.onvoiceschanged = pick; pick(); } catch (e) {}
    try { if (window.claude && window.claude.use) tts = await window.claude.use("tts"); } catch (e) { tts = null; }
  };
  function pick() { try { const vs = speechSynthesis.getVoices().filter(v => /^en(-|_)(US|GB)/i.test(v.lang)); const pref = ["Samantha", "Ava", "Allison", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Karen", "Daniel"]; voice = pref.map(p => vs.find(v => v.name.indexOf(p) !== -1)).find(Boolean) || vs[0] || null; } catch (e) {} }
  const playing = on => document.querySelectorAll(".wave-card,.orb-wrap").forEach(c => c.classList.toggle("playing", on));
  U.say = function (parts, rate) {
    const list = Array.isArray(parts) ? parts : [parts];
    rate = rate || 0.92;
    playing(true); clearTimeout(U.say.t); U.say.t = setTimeout(() => playing(false), 8000);
    if (tts) {
      tts.speak(list.map(t => ({ text: t, language: "en" })), { rate: Math.max(0.7, Math.min(1.5, rate + 0.08)) }).then(() => playing(false), () => { playing(false); });
      return;
    }
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      list.forEach((t, i) => { const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; if (voice) u.voice = voice; u.rate = rate; if (i === list.length - 1) { u.onend = () => playing(false); u.onerror = () => playing(false); } speechSynthesis.speak(u); });
    } catch (e) {}
  };
  U.hush = () => { try { if (tts) tts.stop(); else speechSynthesis.cancel(); } catch (e) {} playing(false); };

  /* ---------- sound effects ---------- */
  let ac = null;
  U.tone = function (kind) {
    if (!U.prefs().sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      const seq = { ok: [[784, 0], [1175, .07]], bad: [[233, 0], [196, .1]], flip: [[660, 0], [880, .05]], pair: [[988, 0], [1319, .06]], combo: [[784, 0], [988, .06], [1319, .12]], tap: [[520, 0]], end: [[523, 0], [784, .08], [1047, .16], [1568, .26]], unlock: [[659, 0], [784, .1], [988, .2], [1319, .3], [1568, .42]] }[kind] || [[600, 0]];
      seq.forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = kind === "bad" ? "triangle" : "sine"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(kind === "bad" ? .1 : .15, t + d + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d + .3); o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + .33); });
    } catch (e) {}
  };

  /* ---------- particles ---------- */
  U.burst = function (el, n) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cols = ["#FFD27A", "#1FA978", "#FF7A59", "#8F7CFF", "#3FC1C9", "#E85D9C"];
    for (let i = 0; i < (n || 16); i++) {
      const p = document.createElement("i"); p.className = "burst"; p.style.left = cx + "px"; p.style.top = cy + "px"; p.style.background = cols[i % cols.length];
      if (i % 3 === 0) p.style.borderRadius = "50%";
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
      const an = p.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(calc(-50% + " + Math.cos(a) * d + "px), calc(-50% + " + (Math.sin(a) * d + 20) + "px)) rotate(" + (Math.random() * 540) + "deg) scale(.5)", opacity: 0 }], { duration: 620, easing: "cubic-bezier(.2,.8,.3,1)" });
      an.onfinish = () => p.remove();
    }
  };
  U.fly = function (fromEl, toEl, text, onDone) {
    if (!fromEl || !toEl) return;
    const r = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
    const c = document.createElement("span"); c.className = "flychip"; c.textContent = text;
    c.style.left = (r.left + r.width / 2) + "px"; c.style.top = (r.top + r.height / 2) + "px";
    document.body.appendChild(c);
    const tx = t.left + t.width / 2 - (r.left + r.width / 2), ty = t.top + t.height / 2 - (r.top + r.height / 2);
    const an = c.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(calc(-50% + " + tx * .5 + "px), calc(-50% + " + (ty * .5 - 40) + "px)) scale(.9)", opacity: 1, offset: .5 }, { transform: "translate(calc(-50% + " + tx + "px), calc(-50% + " + ty + "px)) scale(.3)", opacity: .2 }], { duration: 650, easing: "cubic-bezier(.5,0,.3,1)" });
    an.onfinish = () => { c.remove(); if (onDone) onDone(); };
  };

  /* ---------- host: Margo ---------- */
  const FACE = '<g class="f-n"><circle cx="26" cy="31" r="1.9" fill="#22172F"/><circle cx="38" cy="31" r="1.9" fill="#22172F"/><path d="M27 38q5 3 10-1" stroke="#7A2E2E" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>' +
    '<g class="f-h"><path d="M23.5 31.5q2.5-3 5 0M35.5 31.5q2.5-3 5 0" stroke="#22172F" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M26 37q6 6 12 0z" fill="#7A2E2E"/><circle cx="23" cy="36" r="2.2" fill="#E89A8A" opacity=".7"/><circle cx="41" cy="36" r="2.2" fill="#E89A8A" opacity=".7"/></g>' +
    '<g class="f-w"><circle cx="26" cy="31" r="2.3" fill="#22172F"/><circle cx="38" cy="31" r="2.3" fill="#22172F"/><path d="M22.5 25.5l6 1.2M35.5 26.7l6-1.2" stroke="#22172F" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="32" cy="39" rx="2.2" ry="2.8" fill="#7A2E2E"/></g>' +
    '<g class="f-s"><path d="M23.5 31h5M35.5 31h5" stroke="#22172F" stroke-width="1.8" stroke-linecap="round"/><path d="M27 38.5q5-2 10 0" stroke="#7A2E2E" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>';
  const HEAD = '<path d="M16 33c-1-15 6-21 16-21s17 6 16 21h-4v-8c-6-3-18-3-24 0v8z" fill="#22172F"/><circle cx="32" cy="31" r="15" fill="#F2C9A5"/><path d="M17 28c0-11 6-16 15-16s15 5 15 16c-4-5-9-7-15-7s-11 2-15 7z" fill="#22172F"/><ellipse cx="31" cy="13" rx="17" ry="6" fill="#F2B33D" transform="rotate(-8 31 13)"/><circle cx="30" cy="7.5" r="2.4" fill="#F2B33D"/>' + FACE + '<circle cx="38" cy="31" r="5" fill="none" stroke="#F2B33D" stroke-width="1.4"/><path d="M43 33q3 6 1 12" stroke="#F2B33D" stroke-width="1" fill="none"/>';
  U.avatar = () => '<svg class="margo" data-face="n" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#2F6F73"/><path d="M14 64c2-12 9-18 18-18s16 6 18 18z" fill="#C8323C"/>' + HEAD + '</svg>';
  U.figure = () => '<svg class="margo margo-full" data-face="h" viewBox="0 0 140 220" aria-hidden="true">' +
    '<ellipse cx="70" cy="214" rx="44" ry="6" fill="rgba(0,0,0,.35)"/>' +
    '<path d="M58 196l-4 16h12l2-16zM80 196l2 16h12l-4-16z" fill="#22172F"/>' +
    '<path class="arm-l" d="M44 104c-10 14-14 30-10 44l8-2c-2-12 2-26 10-36z" fill="#2F6F73"/>' +
    '<path d="M38 200c-2-40 6-80 32-96 26 16 34 56 32 96z" fill="#2F6F73"/><path d="M70 104v96" stroke="#235457" stroke-width="2"/>' +
    '<path d="M52 108c8 8 28 8 36 0l3 8c-10 10-32 10-42 0z" fill="#C8323C"/><path d="M80 112l14 48-9 3-12-46z" fill="#C8323C"/><path d="M85 160l9-2 1 6-9 2z" fill="#9E2330"/>' +
    '<circle cx="64" cy="150" r="2.4" fill="#F2B33D"/><circle cx="64" cy="166" r="2.4" fill="#F2B33D"/><circle cx="64" cy="182" r="2.4" fill="#F2B33D"/>' +
    '<g class="arm-r"><path d="M94 110c12 4 20 -4 26 -18l-7-4c-5 10-10 15-20 14z" fill="#2F6F73"/><circle cx="118" cy="88" r="6" fill="#F2C9A5"/><path d="M114 78l20-12 4 22-20-2z" fill="#F2B33D"/><path d="M134 66l4 22" stroke="#B98A2B" stroke-width="2"/><ellipse cx="136" cy="77" rx="3" ry="11" fill="#E9A92A"/></g>' +
    '<g transform="translate(38 44)">' + HEAD + '</g></svg>';
  U.face = function (f) { document.querySelectorAll(".margo").forEach(m => m.setAttribute("data-face", f)); };
  U.hop = function () { document.querySelectorAll(".host").forEach(h => { h.classList.remove("hop"); void h.offsetWidth; h.classList.add("hop"); }); };

  const LINES = {
    start: ["מוכנה? אני כבר באיפור.", "יאללה, הבמה שלך."],
    firstNew: ["מילה חדשה עולה לבמה. תני לה רגע להשתחוות.", "מילה חדשה. שימי לב להטעמה, היא הכוכבת פה."],
    combo3: ["שלוש ברצף. מישהו פה עשה שיעורי בית.", "שלוש מתוך שלוש. אני כמעט מתרגשת.", "רצף. אל תסתכלי עליי, תמשיכי."],
    combo6: ["שש ברצף. אני מזמינה לך תפקיד ראשי.", "את גונבת לי את ההצגה. בכיף."],
    combo9: ["תשע. אני מתחילה לחשוש לגבי התפקיד שלי."],
    match: ["הפסקת התאמות. מהר, אבל בלי לנחש.", "זוגות. כל מילה מוצאת את שלה."],
    scene: ["סצנה. תסתכלי טוב, אף אחד פה לא מסתיר כלום.", "תאורה, מצלמה, מילה."],
    confuse: ["את השתיים האלה כולם מבלבלים. אפילו אני. פעם אחת.", "זה בדיוק הבלבול ששווה ללמוד עכשיו."],
    tap: ["אני מגיבה רק כשיש סיבה. זו לא סיבה, אבל שלום.", "טעויות הן חזרות שמגיעות מוקדם.", "מילה קשה חוזרת יותר. מילה קלה פחות. ככה זה עובד."]
  };
  const used = {}; let quipT = null; U.lastQuip = -99;
  U.line = function (kind) { const pool = LINES[kind] || [kind]; used[kind] = used[kind] || []; let o = pool.filter(l => used[kind].indexOf(l) === -1); if (!o.length) { used[kind] = []; o = pool; } const l = o[Math.floor(Math.random() * o.length)]; used[kind].push(l); return l; };
  U.quip = function (kindOrText, face, force, step) {
    if (!force && step != null && step - U.lastQuip < 4) return;
    if (step != null) U.lastQuip = step;
    const el = document.getElementById("quip"); if (!el) return;
    U.face(face || "h"); U.hop();
    el.textContent = LINES[kindOrText] ? U.line(kindOrText) : kindOrText; el.classList.add("on");
    clearTimeout(quipT); quipT = setTimeout(() => { el.classList.remove("on"); U.face("n"); }, 2700);
  };

  /* ---------- small illustrations ---------- */
  U.PICS = {
    lever: '<svg viewBox="0 0 64 64"><path d="M26 50l6-12 6 12z" fill="#F2B33D"/><path d="M6 44l52-18" stroke="#22172F" stroke-width="4" stroke-linecap="round"/><rect x="40" y="10" width="18" height="16" rx="2" fill="#E5485A" transform="rotate(-19 49 18)"/><circle cx="10" cy="38" r="5" fill="#3FC1C9"/></svg>',
    glass: '<svg viewBox="0 0 64 64"><path d="M20 8h24c0 16-4 24-12 24S20 24 20 8z" fill="#D9F0F2" stroke="#22172F" stroke-width="2.5"/><path d="M32 32v16M22 52h20" stroke="#22172F" stroke-width="2.5" stroke-linecap="round"/><path d="M30 10l-3 7 5 3-3 8" fill="none" stroke="#E5485A" stroke-width="2"/></svg>',
    sprout: '<svg viewBox="0 0 64 64"><path d="M32 56V30" stroke="#1FA978" stroke-width="4" stroke-linecap="round"/><path d="M32 34c-14 0-18-10-18-16 10 0 18 6 18 16zM32 30c0-12 8-18 18-18 0 8-6 18-18 18z" fill="#1FA978"/><path d="M12 58h40" stroke="#8C6B4A" stroke-width="4" stroke-linecap="round"/><circle cx="52" cy="10" r="5" fill="#F2B33D"/></svg>',
    clock: '<svg viewBox="0 0 64 64"><circle cx="30" cy="34" r="20" fill="#fff" stroke="#22172F" stroke-width="3"/><path d="M30 22v12l8 5" stroke="#22172F" stroke-width="3" stroke-linecap="round" fill="none"/><text x="46" y="16" font-family="Fraunces,serif" font-weight="800" font-size="13" fill="#8F7CFF">z</text><text x="53" y="9" font-family="Fraunces,serif" font-weight="800" font-size="10" fill="#8F7CFF">z</text></svg>',
    bottle: '<svg viewBox="0 0 64 64"><path d="M26 6h12v12l8 10v28H18V28l8-10z" fill="#D9F0F2" stroke="#22172F" stroke-width="2.5" stroke-linejoin="round"/><g fill="#FF7A59"><circle cx="24" cy="48" r="3"/><circle cx="32" cy="48" r="3"/><circle cx="40" cy="48" r="3"/><circle cx="28" cy="40" r="3"/><circle cx="36" cy="40" r="3"/><circle cx="32" cy="32" r="3"/><circle cx="32" cy="22" r="2.6"/></g></svg>'
  };
  U.ICON = {
    listen: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    gap: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="9" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="12" y="9" width="9" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/></svg>',
    recall: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="5" width="16" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 10a3 3 0 1 1 4 2.8V14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="13" cy="17" r="1" fill="currentColor"/></svg>',
    match: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="6" cy="7" r="3" fill="currentColor"/><circle cx="18" cy="17" r="3" fill="currentColor"/><path d="M8 9l8 6" stroke="currentColor" stroke-width="2"/></svg>',
    scene: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 16l4-5 3 3 2-2 3 4z" fill="currentColor"/></svg>',
    intro: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 6L12 16l-5.2 3.1 1.4-6-4.6-4 6-.5z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4-4 4 2 3-2 3 1 4-1 2 4"/><path d="M6 8l-2 6 5 5 3-2 3 2 4-4"/><path d="M10 15l2 2M12 13l2 2"/></svg>',
    clapper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 9l2-5 16 0-2 5M8 4l-1 5M14 4l-1 5"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 13l20-8-6 16-3-7z"/><path d="M13 14l-4 4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1.5c-2 0-3 1-3 2.2 0 3 6 1.6 6 4.6 0 1.2-1 2.2-3 2.2A3.3 3.3 0 0 1 9 15M12 6v2M12 16v2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2 6.1 20.5l1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M9 20h6M12 14v6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  U.fb = function (ok, head, item, extra) {
    const cls = ok === true ? "ok" : ok === false ? "bad" : "info";
    return '<div class="fb ' + cls + '"><span class="mark">' + (ok === false ? U.ICON.cross : U.ICON.check) + '</span><div class="body"><div class="head">' + head + '</div>' +
      (item ? '<span class="w">' + U.esc(item.en) + '</span><div>' + U.esc(item.he) + '</div>' : '') + (extra || '') + '</div></div>';
  };
  U.diff = c => '<div class="diff"><div class="row"><bdi class="en">' + U.esc(c[0]) + '</bdi><span>' + U.esc(c[1]) + '</span></div><div class="row"><bdi class="en">' + U.esc(c[2]) + '</bdi><span>' + U.esc(c[3]) + '</span></div></div>';
  U.marked = (it, size) => '<p class="sent"' + (size ? ' style="font-size:' + size + 'px"' : '') + '>' + U.esc(it.pre) + '<mark>' + U.esc(it.ans) + '</mark>' + U.esc(it.post) + '</p>';
})(window.WP = window.WP || {});
