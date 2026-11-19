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
    const cols = ["#F6C35B", "#FFF2DC", "#E8B44C", "#E0795E", "#7FB8AE", "#FFE3A6"];
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

  /* ---------- host: Margo (M4 rig) ----------
     A bust rig: head, hair, hat, coat and a scarf tail that sways. Faces: n neutral, h happy, w wow, s oops, k wink. */
  U.wardrobe = () => Object.assign({ hat: "beret", hatColor: "#F2B33D", scarf: "#C8323C" }, (WP.Store.data && WP.Store.data.profile.wardrobe) || {});
  function hatSVG(w) {
    const c = w.hatColor;
    if (w.hat === "tophat") return '<ellipse cx="100" cy="46" rx="56" ry="9" fill="' + c + '"/><rect x="66" y="-4" width="68" height="50" rx="5" fill="' + c + '"/><rect x="66" y="32" width="68" height="9" fill="#C65A40"/><rect x="72" y="-2" width="10" height="34" rx="4" fill="#fff" opacity=".12"/>';
    if (w.hat === "crown") return '<path d="M58 50 L62 8 L81 30 L100 0 L119 30 L138 8 L142 50Z" fill="' + c + '" stroke="#B07F2A" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="36" r="5" fill="#C65A40"/><circle cx="76" cy="40" r="3.5" fill="#1F5C66"/><circle cx="124" cy="40" r="3.5" fill="#1F5C66"/>';
    if (w.hat === "cap") return '<path d="M56 54 Q58 16 100 14 Q142 16 144 54Z" fill="' + c + '"/><path d="M100 50 L170 46 Q168 60 140 60 L100 58Z" fill="' + c + '"/><path d="M100 50 L170 46 Q168 60 140 60 L100 58Z" fill="#000" opacity=".18"/><circle cx="100" cy="15" r="4" fill="#000" opacity=".2"/>';
    return '<path d="M44 52 Q52 12 106 12 Q158 14 158 42 Q130 35 100 39 Q70 43 44 52Z" fill="' + c + '"/><path d="M44 52 Q70 43 100 39 Q130 35 158 42 L158 47 Q130 41 100 45 Q70 49 45 57Z" fill="#000" opacity=".22"/><path d="M62 30 Q80 18 104 18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".25"/><rect x="108" y="3" width="7" height="12" rx="3.5" fill="' + c + '"/>';
  }
  const EYES = (cx) => '<path d="M' + (cx - 9) + ' 89 Q' + cx + ' 81 ' + (cx + 9) + ' 89 Q' + cx + ' 95 ' + (cx - 9) + ' 89Z" fill="#fff"/><circle cx="' + cx + '" cy="89" r="4.7" fill="#2A1A2E"/><circle cx="' + (cx + 1.6) + '" cy="87.3" r="1.6" fill="#fff"/>';
  const FACE =
    '<g class="f-n"><path d="M75 76 Q85 70 95 75M105 75 Q115 70 125 76" stroke="#3B1D38" stroke-width="3.6" fill="none" stroke-linecap="round"/><g class="blink">' + EYES(86) + EYES(114) + '</g>' +
      '<path d="M76 88 Q86 79 96 88M104 88 Q114 79 124 88" stroke="#2A1A2E" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M90 113 Q101 120 111 112" stroke="#B8324F" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>' +
    '<g class="f-h"><path d="M75 71 Q85 64 95 70M105 70 Q115 64 125 71" stroke="#3B1D38" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M77 90 Q86 81 95 90M105 90 Q114 81 123 90" stroke="#2A1A2E" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M85 109 Q100 129 115 109 Q100 114 85 109Z" fill="#7E1E36"/><path d="M88 110 Q100 113 112 110 L111 113 Q100 116 89 113Z" fill="#fff"/></g>' +
    '<g class="f-w"><path d="M74 69 Q85 61 95 67M105 67 Q115 61 126 69" stroke="#3B1D38" stroke-width="3.6" fill="none" stroke-linecap="round"/>' + EYES(86) + EYES(114) + '<ellipse cx="100" cy="115" rx="6" ry="7.5" fill="#7E1E36"/></g>' +
    '<g class="f-s"><path d="M76 74 Q84 72 94 77M106 70 Q116 66 125 71" stroke="#3B1D38" stroke-width="3.6" fill="none" stroke-linecap="round"/>' + EYES(85).replace(/r="4.7"/, 'r="4.2"') + EYES(113).replace(/r="4.7"/, 'r="4.2"') +
      '<path d="M91 116 Q96 111 101 116 Q106 121 110 115" stroke="#B8324F" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>' +
    '<g class="f-k"><path d="M75 74 Q85 68 95 73M105 70 Q115 64 125 70" stroke="#3B1D38" stroke-width="3.6" fill="none" stroke-linecap="round"/>' + EYES(86) + '<path d="M105 89 Q114 84 123 89" stroke="#2A1A2E" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M90 112 Q103 122 113 109" stroke="#B8324F" stroke-width="3.6" fill="none" stroke-linecap="round"/></g>';
  function bust(w, cls) {
    return '<svg class="margo m4 ' + (cls || "") + '" data-face="n" viewBox="0 -8 200 268" aria-hidden="true">' +
      '<defs><linearGradient id="mgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A7C82"/><stop offset="1" stop-color="#163F49"/></linearGradient>' +
      '<linearGradient id="mgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6C6A2"/><stop offset="1" stop-color="#E9A882"/></linearGradient>' +
      '<linearGradient id="mgH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E2F57"/><stop offset="1" stop-color="#2B1530"/></linearGradient></defs>' +
      '<g class="bodyg"><path d="M30 262 Q32 176 66 152 L100 160 L134 152 Q168 176 170 262Z" fill="url(#mgC)"/>' +
      '<path d="M66 152 L100 216 L80 160Z" fill="#0F333B"/><path d="M134 152 L100 216 L120 160Z" fill="#0F333B"/><path d="M86 150 L100 202 L114 150Z" fill="#F4E9D8"/>' +
      '<circle cx="100" cy="228" r="3.6" fill="#E8B44C"/><circle cx="100" cy="246" r="3.6" fill="#E8B44C"/>' +
      '<path d="M89 118 L111 118 L114 150 L86 150Z" fill="#DF9C7A"/>' +
      '<path d="M62 140 Q100 164 138 140 L142 158 Q100 184 58 158Z" fill="' + w.scarf + '"/><path d="M62 140 Q100 164 138 140 L139 147 Q100 170 61 147Z" fill="#fff" opacity=".18"/>' +
      '<g class="tail"><path d="M108 164 Q123 206 106 244 L123 246 Q140 206 125 164Z" fill="' + w.scarf + '"/><path d="M112 188 L130 190M110 210 L129 212M108 230 L125 232" stroke="#000" stroke-width="3" opacity=".18"/></g>' +
      '<circle cx="118" cy="164" r="10.5" fill="' + w.scarf + '"/><circle cx="118" cy="164" r="10.5" fill="#000" opacity=".12"/></g>' +
      '<g class="headg"><path d="M54 74 Q50 28 100 24 Q150 28 146 74 L150 126 Q131 139 116 125 L100 119 L84 125 Q69 139 50 126Z" fill="url(#mgH)"/>' +
      '<ellipse cx="100" cy="86" rx="37" ry="42.5" fill="url(#mgS)"/><path d="M64 96 Q62 122 86 128 Q68 126 63 106Z" fill="#D58E6E" opacity=".5"/>' +
      '<circle cx="137.5" cy="105" r="5.6" fill="none" stroke="#E8B44C" stroke-width="2.8"/>' +
      '<path d="M59 81 Q61 40 100 38 Q139 40 141 81 Q130 61 112 63 Q100 52 86 63 Q71 59 59 81Z" fill="url(#mgH)"/>' +
      '<path d="M78 50 Q95 43 114 47" stroke="#93508A" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".75"/>' +
      hatSVG(w) + FACE +
      '<path d="M100 92 Q97 102 101 104" stroke="#C97F5E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="76" cy="104" rx="7.5" ry="5" fill="#F07A6E" opacity=".25"/><ellipse cx="124" cy="104" rx="7.5" ry="5" fill="#F07A6E" opacity=".25"/></g></svg>';
  }
  U.avatar = (cls) => bust(U.wardrobe(), cls);
  U.figure = () => bust(U.wardrobe(), "full");
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


  /* Margo rises from the edge of the stage to react, then leaves. Never blocks taps. */
  let peekT = null;
  U.peek = function (kind) {
    const m = document.querySelector(".lean"); if (!m) return;
    U.face(kind === "oops" ? "s" : kind === "wow" ? "k" : "h");
    m.classList.remove("jump", "droop"); void m.offsetWidth; m.classList.add(kind === "oops" ? "droop" : "jump");
    clearTimeout(peekT); peekT = setTimeout(() => { m.classList.remove("jump", "droop"); U.face("n"); }, 1500);
  };

  /* A small silhouette per world, drawn from the chapter icon. */
  U.skyline = function (icon) {
    let g = "";
    const rnd = (i, k) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
    if (icon === "briefcase" || icon === "handshake" || icon === "phone") {
      for (let i = 0, x = 0; x < 300; i++) { const w = 18 + Math.abs(rnd(i, 1)) * 22, h = 18 + Math.abs(rnd(i, 2)) * 40; g += '<rect x="' + x + '" y="' + (60 - h) + '" width="' + w + '" height="' + h + '" rx="2"/>'; for (let wy = 64 - h; wy < 54; wy += 9) g += '<rect class="win" x="' + (x + 5) + '" y="' + wy + '" width="4" height="4"/><rect class="win" x="' + (x + w - 9) + '" y="' + wy + '" width="4" height="4"/>'; x += w + 4; }
    } else if (icon === "house" || icon === "heart") {
      for (let i = 0, x = 6; x < 290; i++) { const w = 30 + Math.abs(rnd(i, 3)) * 16, h = 20 + Math.abs(rnd(i, 4)) * 14; g += '<path d="M' + x + ' 60V' + (60 - h) + 'L' + (x + w / 2) + ' ' + (44 - h) + 'L' + (x + w) + ' ' + (60 - h) + 'V60z"/><rect class="win" x="' + (x + w / 2 - 4) + '" y="' + (66 - h) + '" width="8" height="8"/>'; x += w + 8; }
    } else if (icon === "clapper") {
      g += '<rect x="0" y="40" width="300" height="20"/>'; for (let x = 6; x < 300; x += 22) g += '<rect class="win" x="' + x + '" y="44" width="12" height="12" rx="2"/>';
      g += '<path class="beam" d="M60 0L20 40h80zM240 0l-40 40h80z"/>';
    } else if (icon === "plane") {
      g += '<path d="M0 60c30-24 60-24 90 0zM80 60c40-30 80-30 120 0zM190 60c35-22 75-22 110 0z"/><path class="win" d="M210 14l40-6-8 6 12 0-4 4-40 2z"/>';
    } else if (icon === "coin") {
      for (let i = 0, x = 14; x < 290; i++, x += 42) { const n = 2 + Math.floor(Math.abs(rnd(i, 5)) * 5); for (let k = 0; k < n; k++) g += '<ellipse cx="' + (x + 14) + '" cy="' + (56 - k * 7) + '" rx="14" ry="4"/>'; }
    } else {
      g += '<path d="M0 60C40 30 70 30 110 50S190 20 230 40 280 46 300 40V60z"/><circle class="win" cx="250" cy="16" r="9"/>';
    }
    return '<svg class="skyline" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">' + g + '</svg>';
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
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h7"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3l-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4c-1 2-2.5 3-4 3S9 5 8 3z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>',
    gem: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor"/><path d="M2 9h20M9 3l3 6 3-6M12 9v12" stroke="rgba(0,0,0,.25)" stroke-width="1.2" fill="none"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4-4 4 2 3-2 3 1 4-1 2 4"/><path d="M6 8l-2 6 5 5 3-2 3 2 4-4"/><path d="M10 15l2 2M12 13l2 2"/></svg>',
    clapper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 9l2-5 16 0-2 5M8 4l-1 5M14 4l-1 5"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 13l20-8-6 16-3-7z"/><path d="M13 14l-4 4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1.5c-2 0-3 1-3 2.2 0 3 6 1.6 6 4.6 0 1.2-1 2.2-3 2.2A3.3 3.3 0 0 1 9 15M12 6v2M12 16v2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2 6.1 20.5l1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M9 20h6M12 14v6"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#E0795E"/><path d="M12 12c1 2 3 3 3 5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3 .2 1 .8 1.5 1.5 1.5 0-1.5-.5-2.5 0-3.5z" fill="#F6C35B"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10h18v9H3zM3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5"/><path d="M10 13h4v3h-4z"/></svg>',
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
