/* WORDPLAY Horizons: the journey as a painted panorama.
   Each chapter is a valley with its own hour of the day. Each stage is one structure in that valley,
   and every structure carries eight lights: one per word, lit only when that word was recalled (measured).
   Pure view layer: receives data, never writes progress. SVG + CSS only, no WebGL. */
(function (WP) {
  "use strict";
  const H = WP.Horizons = {};
  const calm = () => document.body.classList.contains("calm") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const rnd = s => { const x = Math.sin(s * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };

  /* hour of day per chapter icon */
  const PAL = {
    briefcase: { top: "#2E3150", hz: "#F0A55A", far: "#8B6876", mid: "#5E4651", near: "#3F3036", ink: "#4A3843", sun: [250, 42, "#FFD08A"], kind: "office", hour: "שעת זהב" },
    house:     { top: "#5F8EA1", hz: "#F1D8AE", far: "#9DB1A4", mid: "#7E9A86", near: "#56715E", ink: "#4E6A57", sun: [110, 22, "#FFF2D4"], kind: "home", hour: "בוקר" },
    handshake: { top: "#2B2846", hz: "#C9798C", far: "#6B5679", mid: "#4E3F60", near: "#352B45", ink: "#4B3B5C", sun: [236, 30, "#F5C2B8"], kind: "agora", hour: "ערב ורוד" },
    clapper:   { top: "#10142B", hz: "#3E4473", far: "#2A3155", mid: "#1E2442", near: "#151A31", ink: "#262C52", moon: 1, kind: "cinema", hour: "לילה" },
    plane:     { top: "#6C8DAE", hz: "#F3C1A4", far: "#A99EB6", mid: "#8A7F9C", near: "#61597A", ink: "#5B5373", sun: [292, 48, "#FFE0C2"], kind: "coast", hour: "זריחה" },
    heart:     { top: "#4B2E52", hz: "#F08A7E", far: "#9A5C72", mid: "#6F4258", near: "#4A2C3E", ink: "#5E3A4F", sun: [262, 40, "#FFC3A0"], kind: "garden", hour: "שקיעה" },
    coin:      { top: "#4F8DB5", hz: "#F6E3B8", far: "#B9B9A0", mid: "#9AA47E", near: "#6D7D58", ink: "#5C6B48", sun: [92, 26, "#FFF6DC"], kind: "market", hour: "צהריים" },
    phone:     { top: "#16264A", hz: "#6C8FB8", far: "#3E5578", mid: "#2C3F60", near: "#1E2C46", ink: "#2A3D60", moon: 1, kind: "radio", hour: "שעה כחולה" },
    dumbbell:  { top: "#7FB7C0", hz: "#FBE7C0", far: "#A9C7B2", mid: "#86B293", near: "#5E8F6E", ink: "#4F7D5E", sun: [120, 24, "#FFF7E0"], kind: "arena", hour: "בוקר בהיר" }
  };
  H.palette = icon => PAL[icon] || PAL.briefcase;
  H.night = icon => !!(PAL[icon] || {}).moon;

  function ridge(seed, w, y0, amp, step, h) {
    let d = "M0 " + h + " L0 " + y0;
    for (let x = 0; x <= w; x += step) { const y = y0 - amp * (.55 * Math.sin(x / 97 + seed) + .3 * Math.sin(x / 41 + seed * 2.3) + .15 * Math.sin(x / 17 + seed * 5.1)); d += " L" + x + " " + y.toFixed(1); }
    return d + " L" + w + " " + h + "Z";
  }

  /* ---------- structures: three per chapter, eight lights each ---------- */
  // mode: "solid" | "ghost". Returns { g, top, lights: [[x,y]...] }
  function structure(kind, slot, cx, base, mode, ink) {
    const ghost = mode === "ghost";
    const F = c => ghost ? ' fill="none" stroke="#F6EEDF" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="3 3" class="ink"' : ' fill="' + c + '"';
    let g = "", top = base - 60, w = 50, lights = null;
    const rect = (x, y, ww, hh, c, r) => '<rect x="' + x + '" y="' + y + '" width="' + ww + '" height="' + hh + '"' + (r ? ' rx="' + r + '"' : '') + F(c) + '/>';
    const path = (d, c) => '<path d="' + d + '"' + F(c) + '/>';
    const circ = (x, y, r, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"' + F(c) + '/>';
    if (kind === "office") {
      const T = [[44, 118, ink], [38, 92, "#5A4350"], [32, 70, ink]][slot];
      w = T[0]; top = base - T[1];
      if (!ghost) g += '<path d="M' + (cx + w / 2) + ' ' + (top + 2) + ' l9 -6 v' + (T[1] - 2) + ' l-9 6z" fill="#000" opacity=".28"/><path d="M' + (cx - w / 2) + ' ' + top + ' l9 -6 h' + w + ' l-9 6z" fill="#fff" opacity=".12"/>';
      g += rect(cx - w / 2, top, w, T[1], T[2], 2);
      if (!ghost) g += '<rect x="' + (cx - w / 2) + '" y="' + top + '" width="' + (w * .32) + '" height="' + T[1] + '" fill="#fff" opacity=".05"/>';
      if (slot === 2) g += rect(cx - 1, top - 14, 2, 14, "#F6EEDF");
      lights = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) lights.push([cx - w / 4 + c * w / 2, top + 14 + r * (T[1] - 24) / 4]);
      if (!ghost) for (const [x, y] of lights) g += '<rect x="' + (x - 3) + '" y="' + (y - 4) + '" width="6" height="8" fill="#000" opacity=".25"/>';
      return { g, top, w, lights, win: true };
    }
    if (kind === "home") {
      const s = [[40, 30], [48, 36], [38, 28]][slot]; w = s[0]; top = base - s[1] - 22;
      if (!ghost) g += '<path d="M' + (cx + w / 2) + ' ' + (base - s[1]) + ' l8 -5 v' + s[1] + ' l-8 5z" fill="#000" opacity=".22"/>';
      g += rect(cx - w / 2, base - s[1], w, s[1], "#E8D9BF") + path("M" + (cx - w / 2 - 4) + " " + (base - s[1]) + " L" + cx + " " + top + " L" + (cx + w / 2 + 4) + " " + (base - s[1]) + "Z", ["#B4532F", "#4E6A57", "#D99A4B"][slot]);
      if (!ghost) g += rect(cx - 5, base - 14, 10, 14, "#6E4B3A") + rect(cx + w / 4 - 3, base - s[1] + 7, 7, 7, "#F6D79A");
      if (slot === 1) g += rect(cx + 10, top + 6, 6, 12, "#6E4B3A");
    } else if (kind === "agora") {
      if (slot === 0) { w = 56; top = base - 70; for (let i = 0; i < 4; i++) g += rect(cx - 24 + i * 15, base - 48, 5, 48, "#E8D9BF"); g += path("M" + (cx - 30) + " " + (base - 48) + " L" + (cx + 30) + " " + (base - 48) + " L" + cx + " " + top + "Z", "#E8D9BF"); }
      else if (slot === 1) { w = 46; top = base - 62; g += rect(cx - 20, base - 34, 40, 34, "#E8D9BF") + path("M" + (cx - 23) + " " + (base - 34) + " A23 23 0 0 1 " + (cx + 23) + " " + (base - 34) + "Z", "#8C6FA0"); }
      else { w = 34; top = base - 56; g += path("M" + (cx - 17) + " " + base + " L" + (cx - 17) + " " + (base - 36) + " A17 17 0 0 1 " + (cx + 17) + " " + (base - 36) + " L" + (cx + 17) + " " + base + " L" + (cx + 9) + " " + base + " L" + (cx + 9) + " " + (base - 34) + " A9 9 0 0 0 " + (cx - 9) + " " + (base - 34) + " L" + (cx - 9) + " " + base + "Z", "#E8D9BF"); }
    } else if (kind === "cinema") {
      if (slot === 0) { w = 62; top = base - 46; g += rect(cx - 31, top, 62, 46, "#2E3460", 2) + rect(cx - 26, top + 8, 52, 9, "#C9405F"); }
      else if (slot === 1) { w = 36; top = base - 76; g += rect(cx - 15, base - 56, 30, 56, "#E8D9BF") + path("M" + (cx - 18) + " " + (base - 56) + " A18 18 0 0 1 " + (cx + 18) + " " + (base - 56) + "Z", "#C9405F"); }
      else { w = 50; top = base - 62; g += rect(cx - 2, base - 30, 4, 30, "#E8D9BF") + rect(cx - 25, top, 50, 30, "#6C8FB8", 2); }
    } else if (kind === "coast") {
      if (slot === 0) { w = 22; top = base - 92; for (let i = 0; i < 5; i++) g += rect(cx - 9 + i * .8, base - 16 - i * 15, 18 - i * 1.6, 16, i % 2 ? "#B4532F" : "#F3EADB"); g += rect(cx - 7, top, 14, 12, "#FFE0A8") + path("M" + (cx - 9) + " " + top + " L" + cx + " " + (top - 9) + " L" + (cx + 9) + " " + top + "Z", "#2A211D"); }
      else if (slot === 1) { w = 48; top = base - 50; g += path("M" + (cx - 24) + " " + (base - 10) + " L" + (cx + 24) + " " + (base - 10) + " L" + (cx + 16) + " " + base + " L" + (cx - 16) + " " + base + "Z", "#B4532F") + path("M" + cx + " " + (base - 10) + " L" + cx + " " + top + " L" + (cx + 20) + " " + (base - 14) + "Z", "#F3EADB"); }
      else { w = 56; top = base - 34; g += rect(cx - 28, base - 10, 56, 4, "#8A6A4E"); for (let i = 0; i < 4; i++) g += rect(cx - 26 + i * 17, base - 10, 3, 10, "#6E4B3A"); g += rect(cx - 1, top, 2, 24, "#E8D9BF"); }
    } else if (kind === "garden") {
      if (slot === 0) { w = 42; top = base - 44; g += path("M" + (cx - 21) + " " + base + " L" + (cx - 17) + " " + (base - 12) + " L" + (cx + 17) + " " + (base - 12) + " L" + (cx + 21) + " " + base + "Z", "#E8D9BF") + rect(cx - 3, top + 8, 6, 24, "#E8D9BF") + circ(cx, top + 6, 7, "#9FD0D6"); }
      else if (slot === 1) { w = 48; top = base - 62; for (let i = 0; i < 4; i++) g += rect(cx - 20 + i * 13, base - 36, 3, 36, "#E8D9BF"); g += path("M" + (cx - 26) + " " + (base - 36) + " L" + cx + " " + top + " L" + (cx + 26) + " " + (base - 36) + "Z", "#C96F7E"); }
      else { w = 44; top = base - 50; g += path("M" + (cx - 20) + " " + base + " L" + (cx - 20) + " " + (base - 30) + " A20 20 0 0 1 " + (cx + 20) + " " + (base - 30) + " L" + (cx + 20) + " " + base + " L" + (cx + 15) + " " + base + " L" + (cx + 15) + " " + (base - 30) + " A15 15 0 0 0 " + (cx - 15) + " " + (base - 30) + " L" + (cx - 15) + " " + base + "Z", "#7E5A6C"); if (!ghost) for (let i = 0; i < 7; i++) g += '<circle cx="' + (cx - 19 + i * 6.3) + '" cy="' + (base - 30 - Math.sin(i / 6 * Math.PI) * 19) + '" r="3" fill="#E57C8E"/>'; }
    } else if (kind === "market") {
      if (slot === 0) { w = 52; top = base - 50; g += rect(cx - 24, base - 26, 48, 26, "#E8D9BF"); for (let i = 0; i < 6; i++) g += path("M" + (cx - 26 + i * 8.7) + " " + (base - 26) + " L" + (cx - 26 + i * 8.7 + 8.7) + " " + (base - 26) + " L" + (cx - 26 + i * 8.7 + 4.3) + " " + top + "Z", i % 2 ? "#B4532F" : "#F3EADB"); }
      else if (slot === 1) { w = 58; top = base - 66; g += rect(cx - 28, base - 44, 56, 44, "#E8D9BF"); for (let i = 0; i < 4; i++) g += rect(cx - 21 + i * 13, base - 40, 4, 36, "#C9B793"); g += path("M" + (cx - 31) + " " + (base - 44) + " L" + (cx + 31) + " " + (base - 44) + " L" + cx + " " + top + "Z", "#D99A4B"); }
      else { w = 40; top = base - 42; [[-12, 6], [0, 9], [12, 5]].forEach(([dx, n]) => { for (let i = 0; i < n; i++) g += '<ellipse cx="' + (cx + dx) + '" cy="' + (base - 3 - i * 4.4) + '" rx="6" ry="2.4"' + F("#E8B44C") + '/>'; }); }
    } else if (kind === "radio") {
      if (slot === 0) { w = 30; top = base - 100; g += path("M" + (cx - 14) + " " + base + " L" + cx + " " + top + " L" + (cx + 14) + " " + base, "none").replace('fill="none"', ghost ? 'fill="none"' : 'fill="none" stroke="#C9D3E6" stroke-width="2"'); for (let i = 1; i < 6; i++) { const y = base - i * 16, hw = 14 * (1 - i * 16 / 100); g += '<path d="M' + (cx - hw) + ' ' + y + ' L' + (cx + hw) + ' ' + y + '" stroke="#C9D3E6" stroke-opacity="' + (ghost ? .5 : 1) + '" stroke-width="1.4"/>'; } g += '<circle cx="' + cx + '" cy="' + top + '" r="3" fill="#FF7A6A" class="blinkl"/>'; }
      else if (slot === 1) { w = 46; top = base - 52; g += rect(cx - 3, base - 26, 6, 26, "#C9D3E6") + path("M" + (cx - 24) + " " + (base - 40) + " Q" + cx + " " + (base - 12) + " " + (cx + 24) + " " + (base - 40) + "Z", "#E8EEF8"); }
      else { w = 30; top = base - 52; g += rect(cx - 14, base - 40, 28, 40, "#3B5A88", 2) + path("M" + (cx - 17) + " " + (base - 40) + " L" + cx + " " + top + " L" + (cx + 17) + " " + (base - 40) + "Z", "#B4532F"); if (!ghost) g += rect(cx - 8, base - 32, 16, 18, "#BFE0F0"); }
    } else {
      if (slot === 0) { w = 64; top = base - 34; g += '<ellipse cx="' + cx + '" cy="' + (base - 10) + '" rx="32" ry="12"' + F("#E8D9BF") + '/><ellipse cx="' + cx + '" cy="' + (base - 16) + '" rx="26" ry="8"' + F("#C96F5A") + '/>'; }
      else if (slot === 1) { w = 56; top = base - 26; g += '<ellipse cx="' + cx + '" cy="' + (base - 6) + '" rx="28" ry="8"' + F("#C96F5A") + '/><ellipse cx="' + cx + '" cy="' + (base - 6) + '" rx="20" ry="4.5"' + F("#7FB08A") + '/>'; }
      else { w = 30; top = base - 70; g += rect(cx - 14, top + 6, 28, 64, "#E8D9BF", 2) + rect(cx - 16, top, 32, 7, "#4F7D5E"); }
    }
    return { g, top, w, lights: null };
  }
  // a string of eight lanterns draped over the structure
  function strand(cx, top, w) {
    const pts = [], x0 = cx - w / 2 - 6, x1 = cx + w / 2 + 6, y = top - 10;
    for (let i = 0; i < 8; i++) { const t = i / 7; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI) * 9]); }
    return pts;
  }
  function lightsSVG(pts, lit, opts) {
    opts = opts || {};
    let s = opts.wire ? '<path d="M' + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L") + '" fill="none" stroke="#2A211D" stroke-opacity=".5" stroke-width=".8"/>' : "";
    pts.forEach((p, i) => {
      const on = i < lit, cls = opts.anim && on && i >= (opts.from || 0) ? ' class="lt-on" style="animation-delay:' + (opts.delay + (i - (opts.from || 0)) * .32).toFixed(2) + 's"' : "";
      s += '<g' + cls + ' data-l="' + i + '">' + (on ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (opts.win ? 6 : 5.5) + '" fill="#FFD99A" opacity=".28"/>' : '') +
        (opts.win ? '<rect x="' + (p[0] - 3) + '" y="' + (p[1] - 4) + '" width="6" height="8" fill="' + (on ? "#FFD99A" : "#6E5664") + '"/>' : '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.3" fill="' + (on ? "#FFE3A6" : "#5A4A44") + '"/>') + '</g>';
    });
    return s;
  }
 function tree(x, base, s, col, ph, still) {
    return '<g class="' + (still ? "" : "sway") + '" style="transform-origin:' + x + 'px ' + base + 'px;animation-delay:' + (-ph * 3).toFixed(2) + 's"><rect x="' + (x - 1.5 * s) + '" y="' + (base - 12 * s) + '" width="' + 3 * s + '" height="' + 12 * s + '" fill="#2A211D" opacity=".7"/>' +
      '<ellipse cx="' + x + '" cy="' + (base - 20 * s) + '" rx="' + 9 * s + '" ry="' + 13 * s + '" fill="' + col + '"/><ellipse cx="' + (x - 2 * s) + '" cy="' + (base - 24 * s) + '" rx="' + 4 * s + '" ry="' + 6 * s + '" fill="#fff" opacity=".08"/></g>';
  }
  const SLOT_DX = [80, 2, -80];
  const BEAM = '<linearGradient id="beamg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF3D0" stop-opacity=".75"/><stop offset="1" stop-color="#FFF3D0" stop-opacity="0"/></linearGradient>'; // stage 1 on the right: the journey reads right to left

  /* one living signature per world: cheap CSS transforms only */
  function signature(kind, cx, base, stages) {
    const s0 = cx + SLOT_DX[0], s1 = cx + SLOT_DX[1], s2 = cx + SLOT_DX[2], any = stages.some(x => x.open);
    if (!any) return "";
    if (kind === "office") return '<g class="sig-crane" style="transform-origin:' + (cx - 150) + 'px ' + (base - 150) + 'px"><rect x="' + (cx - 151.5) + '" y="' + (base - 150) + '" width="3" height="150" fill="#2A211D" opacity=".55"/><path d="M' + (cx - 190) + ' ' + (base - 150) + ' h70" stroke="#2A211D" stroke-opacity=".55" stroke-width="3"/><path d="M' + (cx - 125) + ' ' + (base - 150) + ' v26" stroke="#2A211D" stroke-opacity=".5" stroke-width="1"/><rect x="' + (cx - 129) + '" y="' + (base - 124) + '" width="8" height="6" fill="#D99A4B"/></g>';
    if (kind === "home") return [0, 1, 2].map(k => '<circle class="sig-smoke" style="animation-delay:' + (k * 1.3) + 's" cx="' + (s1 + 13) + '" cy="' + (base - 66) + '" r="5" fill="#F6EEDF"/>').join("");
    if (kind === "cinema") return '<g opacity=".5">' + [0, 1].map(k => '<path class="sig-beam" style="transform-origin:' + (s0 + (k ? 20 : -20)) + 'px ' + (base - 46) + 'px;animation-delay:' + (k * -3) + 's" d="M' + (s0 + (k ? 20 : -20)) + ' ' + (base - 46) + ' l-26 -230 h22z" fill="url(#beamg)"/>').join("") + '</g>';
    if (kind === "coast") return '<path class="sig-beam lh" style="transform-origin:' + s0 + 'px ' + (base - 86) + 'px" d="M' + s0 + ' ' + (base - 86) + ' l-160 -24 v30z" fill="url(#beamg)" opacity=".7"/><g class="sig-bob"><path d="M' + (cx - 140) + ' ' + (base + 2) + ' l20 0 l-4 5 h-12z" fill="#2A211D" opacity=".7"/><path d="M' + (cx - 131) + ' ' + (base + 2) + ' v-16 l9 13z" fill="#F6EEDF" opacity=".8"/></g>';
    if (kind === "garden") return [0, 1].map(k => '<g class="sig-fly" style="animation-delay:' + (k * -4) + 's"><path d="M' + (s1 - 30 + k * 60) + ' ' + (base - 60) + ' q-4 -6 0 -8 q4 2 0 8 q4 -6 8 -4 q-2 6 -8 4z" fill="' + (k ? "#F6D79A" : "#E57C8E") + '"/></g>').join("");
    if (kind === "market") { let b = '<path d="M' + (s0 + 30) + ' ' + (base - 54) + ' Q' + s1 + ' ' + (base - 36) + ' ' + (s2 - 26) + ' ' + (base - 50) + '" stroke="#2A211D" stroke-opacity=".5" fill="none"/>'; for (let k = 0; k < 9; k++) { const t = k / 8, x = (s0 + 30) + (s2 - 26 - s0 - 30) * t, y = base - 54 + Math.sin(t * Math.PI) * 15 + 4 * t; b += '<path class="sig-flut" style="transform-origin:' + x + 'px ' + y + 'px;animation-delay:' + (-k * .2) + 's" d="M' + (x - 3) + ' ' + y + ' h6 l-3 7z" fill="' + ["#B4532F", "#D99A4B", "#F3EADB"][k % 3] + '"/>'; } return b; }
    if (kind === "radio") return [0, 1, 2].map(k => '<circle class="sig-wave" style="animation-delay:' + (k * .8) + 's;transform-origin:' + s0 + 'px ' + (base - 100) + 'px" cx="' + s0 + '" cy="' + (base - 100) + '" r="10" fill="none" stroke="#9FC3E6" stroke-width="1.4"/>').join("");
    if (kind === "arena") return [-1, 1].map(k => '<rect x="' + (s0 + k * 42 - 1) + '" y="' + (base - 70) + '" width="2" height="70" fill="#2A211D" opacity=".5"/><circle class="sig-pulse" cx="' + (s0 + k * 42) + '" cy="' + (base - 72) + '" r="5" fill="#FFF3D0"/>').join("");
    return '<g class="sig-bob"><circle cx="' + (s1 + 50) + '" cy="' + (base - 120) + '" r="3" fill="#F6EEDF" opacity=".8"/></g>';
  }
  /* road lanterns: a chapter's overall recall, six lamps along the path */
  function roadLamps(cx, base, frac) {
    let s = ""; const on = Math.round(6 * frac);
    for (let k = 0; k < 6; k++) { const x = cx + 120 - k * 48, y = base + 18 + Math.sin(x / 70) * 5; s += '<rect x="' + (x - .7) + '" y="' + (y - 14) + '" width="1.4" height="14" fill="#2A211D" opacity=".6"/>' + (k < on ? '<circle cx="' + x + '" cy="' + (y - 16) + '" r="6" fill="#FFD99A" opacity=".3"/><circle cx="' + x + '" cy="' + (y - 16) + '" r="2.2" fill="#FFE3A6"/>' : '<circle cx="' + x + '" cy="' + (y - 16) + '" r="2" fill="#5A4A44"/>'); }
    return s;
  }

  /* one valley: structures, lights, trees, details unlocked by progress */
  function valley(icon, cx, base, stages, o) {
    const p = H.palette(icon); o = o || {};
    let back = "", front = "", hits = [];
    [-150, -118, 122, 152, 40, -40].forEach((dx, k) => { if (Math.abs(dx) < 50 && k > 3) return; back += tree(cx + dx + (rnd(k + cx) - .5) * 10, base + 4, .8 + rnd(k * 3 + cx) * .5, p.mid, k); });
    stages.forEach((st, i) => {
      const x = cx + SLOT_DX[i], mode = st.open ? "solid" : "ghost";
      const S = structure(p.kind, i, x, base, mode, p.ink);
      const pts = S.lights || strand(x, S.top, S.w);
      let g = '<g class="st' + (st.open ? "" : " ghost") + (o.focus === i ? " focus" : "") + (o.reveal === i ? " reveal" : "") + '" data-stage="' + (st.id || "") + '">' + (o.reveal === i ? structure(p.kind, i, x, base, "ghost", p.ink).g : "") + '<g class="body">' + S.g + '</g>';
      if (st.open) g += lightsSVG(pts, o.focus === i && o.anim ? o.to : st.lit, { win: S.win, wire: !S.win, anim: o.focus === i && o.anim, from: o.from, delay: o.delay || 1.2 });
      if (st.done) g += '<g class="pennant"><rect x="' + (x - .8) + '" y="' + (S.top - 30) + '" width="1.6" height="22" fill="#F6EEDF"/><path class="flag" style="transform-origin:' + x + 'px ' + (S.top - 30) + 'px" d="M' + x + ' ' + (S.top - 30) + ' l13 4 l-13 4z" fill="#E8B44C"/></g>';
      g += '<rect x="' + (x - S.w / 2 - 10) + '" y="' + (S.top - 26) + '" width="' + (S.w + 20) + '" height="' + (base - S.top + 30) + '" fill="transparent"/></g>';
      front += g; hits.push({ x, top: S.top, pts, win: S.win, w: S.w });
    });
    // small discoveries that only appear once a stage has really been learned
    if (stages[0] && stages[0].done) front += '<g class="cat"><path d="M' + (cx + 104) + ' ' + (base - 2) + ' q2 -9 7 -9 l2 -4 l2 4 q5 0 6 9z" fill="#2A211D"/><path class="tail" style="transform-origin:' + (cx + 119) + 'px ' + (base - 3) + 'px" d="M' + (cx + 119) + ' ' + (base - 3) + ' q8 -2 7 -10" stroke="#2A211D" stroke-width="2" fill="none" stroke-linecap="round"/></g>';
    if (stages[1] && stages[1].done) front += '<g class="kite" style="transform-origin:' + (cx - 30) + 'px ' + (base - 140) + 'px"><path d="M' + (cx - 30) + ' ' + (base - 150) + ' l9 10 l-9 12 l-9 -12z" fill="#E8B44C"/><path d="M' + (cx - 30) + ' ' + (base - 128) + ' q10 30 30 60" stroke="#F6EEDF" stroke-opacity=".6" fill="none"/></g>';
    front += signature(p.kind, cx, base, stages);
    const tot = stages.reduce((n, x) => n + (x.lit || 0), 0);
    if (stages.some(x => x.open)) front += roadLamps(cx, base, tot / (stages.length * 8));
    return { back, front, hits };
  }

  function skyHTML(icon, w, h, extra) {
    const p = H.palette(icon);
    let s = '<div class="hz-sky" style="background:linear-gradient(180deg,' + p.top + ' 0%,' + p.top + ' 16%,' + p.hz + ' 80%)' + (extra || "") + '">';
    if (p.sun) s += '<i class="sunglow" style="left:' + (w / 2 - p.sun[1] * 2.4) + 'px;top:' + (p.sun[0] * h / 470 - p.sun[1] * 2.4) + 'px;width:' + p.sun[1] * 4.8 + 'px;height:' + p.sun[1] * 4.8 + 'px;background:' + p.sun[2] + '"></i><i class="sun" style="left:' + (w / 2 - p.sun[1]) + 'px;top:' + (p.sun[0] * h / 470 - p.sun[1]) + 'px;width:' + p.sun[1] * 2 + 'px;height:' + p.sun[1] * 2 + 'px;background:' + p.sun[2] + '"></i>';
    if (p.moon) { s += '<svg class="stars" width="' + w + '" height="' + h * .6 + '">'; for (let k = 0; k < 36; k++) s += '<circle style="animation-delay:' + (-rnd(k) * 4).toFixed(2) + 's" cx="' + (rnd(k) * w).toFixed(1) + '" cy="' + (10 + rnd(k + 40) * h * .5).toFixed(1) + '" r="' + (rnd(k + 7) * 1.2 + .4).toFixed(2) + '" fill="#F6EEDF"/>'; s += '<circle cx="' + (w * .62) + '" cy="' + h * .2 + '" r="17" fill="#F6EEDF"/><circle cx="' + (w * .62 + 7) + '" cy="' + (h * .2 - 5) + '" r="15" fill="' + p.top + '"/></svg>'; }
    return s + '</div>';
  }
  function clouds(w, h, n, seed) {
    let s = ""; for (let k = 0; k < n; k++) { const x = rnd(k + seed) * w, y = 30 + rnd(k * 7 + seed) * h * .32, r = 14 + rnd(k * 3) * 16;
      s += '<g opacity="' + (.35 + rnd(k + 9) * .3) + '"><ellipse cx="' + x + '" cy="' + y + '" rx="' + r * 2.2 + '" ry="' + r * .6 + '" fill="#FFF6EA"/><ellipse cx="' + (x + r * .4) + '" cy="' + (y - r * .35) + '" rx="' + r * 1.1 + '" ry="' + r * .55 + '" fill="#FFF6EA"/></g>'; }
    return s;
  }
  function grass(w, h, col) {
    let s = "";
    for (let x = 0; x < w; x += 6) { const hh = 6 + rnd(x) * 18; s += '<path d="M' + x + ' ' + h + ' Q' + (x + 2) + ' ' + (h - hh) + ' ' + (x + 5 + rnd(x + 1) * 3) + ' ' + (h - hh - 5) + '" stroke="' + col + '" stroke-width="2" fill="none"/>'; }
    for (let k = 0; k < w / 40; k++) { const x = rnd(k * 13) * w, y = h - 8 - rnd(k) * 10; s += '<circle cx="' + x + '" cy="' + y + '" r="2.2" fill="' + ["#E8B44C", "#F3EADB", "#E57C8E"][k % 3] + '"/>'; }
    return '<g class="breeze">' + s + '</g>';
  }
  function motes(host, n, night) {
    const d = document.createElement("div"); d.className = "hz-motes";
    d.innerHTML = Array.from({ length: n }, (_, k) => '<i style="left:' + (rnd(k + 3) * 100).toFixed(1) + '%;top:' + (30 + rnd(k + 9) * 60).toFixed(1) + '%;animation-delay:' + (-rnd(k) * 9).toFixed(2) + 's;animation-duration:' + (7 + rnd(k + 5) * 6).toFixed(1) + 's;' + (night ? "background:#FFE9A8;box-shadow:0 0 6px 2px rgba(255,220,140,.6)" : "") + '"></i>').join("");
    host.appendChild(d); return d;
  }
  function birds(host) {
    const d = document.createElement("div"); d.className = "hz-birds";
    d.innerHTML = '<svg width="60" height="24" viewBox="0 0 60 24"><g fill="none" stroke="#2A211D" stroke-width="1.6" stroke-linecap="round"><path class="wing" d="M4 10 q5 -6 10 0 q5 -6 10 0"/><path class="wing w2" d="M30 16 q4 -5 8 0 q4 -5 8 0"/><path class="wing w3" d="M44 6 q3 -4 6 0 q3 -4 6 0"/></g></svg>';
    host.appendChild(d); return d;
  }

  /* ---------- home: the panorama ---------- */
  const SP = 340;
  H.home = function (host, o) {
    const W = host.clientWidth || 390, Ht = host.clientHeight || 480, base = Ht - 86, n = o.chapters.length, MAX = (n - 1) * SP;
    const cxOf = (lw, i, f) => lw - W / 2 - i * SP * f;
    const hgrad = (id, key, lw, f) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' + o.chapters.map((c, i) => '<stop offset="' + Math.max(0, Math.min(1, cxOf(lw, i, f) / lw)).toFixed(4) + '" stop-color="' + H.palette(c.icon)[key] + '"/>').reverse().join("") + '</linearGradient>';
    host.classList.add("hz");
    let html = '<div class="hz-skies">' + o.chapters.map((c, i) => '<div class="hz-skyw" data-i="' + i + '">' + skyHTML(c.icon, W, Ht) + '</div>').join("") + '</div>';
    const layers = [
      { f: .16, svg: lw => clouds(lw, Ht, Math.round(lw / 120), 3), cls: "drift" },
      { f: .32, svg: lw => '<defs>' + hgrad("hzf", "far", lw, .32) + '</defs><path d="' + ridge(1.3, lw, base - 130, 30, 8, Ht) + '" fill="url(#hzf)"/>' },
      { f: .58, svg: lw => { let s = '<defs>' + hgrad("hzm", "mid", lw, .58) + '</defs><path d="' + ridge(4.1, lw, base - 78, 24, 8, Ht) + '" fill="url(#hzm)"/>';
          o.chapters.forEach((c, i) => { const cx = cxOf(lw, i, .58); for (let k = 0; k < 7; k++) s += tree(cx - 90 + k * 30 + rnd(k + i) * 14, base - 74 + rnd(k * 2 + i) * 8, .45, H.palette(c.icon).near, k + i, true);
            if (H.palette(c.icon).kind === "coast") s += '<path d="M' + (cx - 170) + ' ' + (base - 40) + ' Q' + cx + ' ' + (base - 60) + ' ' + (cx + 170) + ' ' + (base - 40) + ' L' + (cx + 170) + ' ' + (base - 20) + ' L' + (cx - 170) + ' ' + (base - 20) + 'Z" fill="#9FC3D3" opacity=".6"/><g class="shimmer">' + [0, 1, 2, 3].map(k => '<path d="M' + (cx - 90 + k * 50) + ' ' + (base - 40 + k % 2 * 6) + ' h22" stroke="#F6EEDF" stroke-width="1.2" opacity=".7"/>').join("") + '</g>'; });
          return s; } },
      { f: 1, main: true },
      { f: 1.32, svg: lw => grass(lw, Ht, "#1E1716") }
    ];
    html += layers.map((L, li) => { const lw = W + MAX * L.f; return '<div class="hz-lay' + (L.cls ? " " + L.cls : "") + '" data-f="' + L.f + '" style="width:' + lw + 'px;z-index:' + (li + 2) + '">' + (L.main ? mainLayer(lw) : '<svg width="' + lw + '" height="' + Ht + '" viewBox="0 0 ' + lw + ' ' + Ht + '">' + L.svg(lw) + '</svg>') + '</div>'; }).join("");
    function mainLayer(lw) {
      let back = "", front = "", labels = "";
      o.chapters.forEach((c, i) => {
        const cx = cxOf(lw, i, 1), v = valley(c.icon, cx, base, c.stages, {});
        back += '<g class="vg" data-v="' + i + '">' + v.back + '</g>'; front += '<g class="vg" data-v="' + i + '">' + v.front + '</g>';
        labels += '<div class="hz-pin' + (c.open ? "" : " lock") + (c.cur ? " cur" : "") + (c.fresh ? " fresh" : "") + '" style="left:' + cx + 'px;top:' + Math.max(104, base - 300) + 'px"><b>' + c.title + '</b><span>' + (c.open ? H.palette(c.icon).hour + " · " + c.lit + "/" + (c.stages.length * 8) + " אורות" : "שביל מוביל לכאן · " + H.palette(c.icon).hour) + '</span>' + (c.fresh ? '<em>חדש</em>' : '') + '</div>';
        if (!c.open) front += '<g class="fog" data-fog="' + i + '"><ellipse cx="' + cx + '" cy="' + (base - 40) + '" rx="190" ry="120" fill="url(#fogg)"/></g>';
      });
      let road = "M" + lw + " " + (base + 26); for (let x = lw; x >= 0; x -= 24) road += " L" + x + " " + (base + 22 + Math.sin(x / 70) * 6).toFixed(1);
      let s = '<svg width="' + lw + '" height="' + Ht + '" viewBox="0 0 ' + lw + ' ' + Ht + '"><defs>' + hgrad("hzn", "near", lw, 1) + BEAM + '<radialGradient id="fogg"><stop offset="0" stop-color="#F6EEDF" stop-opacity=".62"/><stop offset=".7" stop-color="#F6EEDF" stop-opacity=".3"/><stop offset="1" stop-color="#F6EEDF" stop-opacity="0"/></radialGradient></defs>' + back +
        '<path d="' + ridge(7.7, lw, base + 4, 8, 6, Ht) + '" fill="url(#hzn)"/>' + front +
        '<path d="' + road + '" fill="none" stroke="#F6EEDF" stroke-opacity=".5" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/></svg>';
      const cur = Math.max(0, o.curIndex), cs = o.chapters[cur], sx = cxOf(lw, cur, 1) + SLOT_DX[Math.max(0, cs.curStage || 0)] - 46;
      return s + labels + '<button class="hz-margo" style="left:' + sx + 'px;top:' + (base - 64) + 'px" aria-label="מרגו">' + WP.UI.rig("mg-world", "idle") + '</button>' ;
    }
    host.innerHTML = html + (o.greet ? '<div class="hz-say">' + o.greet + '</div>' : '');
    const night = o.chapters.some(c => H.night(c.icon));
    const mt = motes(host, 16, false), bd = birds(host);
    const lays = [...host.querySelectorAll(".hz-lay")], skies = [...host.querySelectorAll(".hz-skyw")], vgs = [...host.querySelectorAll(".vg")];
    let p = Math.max(0, o.curIndex) * SP, want = p, drag = null, raf = 0, vel = 0;
    const apply = () => {
      lays.forEach(l => l.style.transform = "translate3d(" + (p * +l.dataset.f).toFixed(1) + "px,0,0)");
      const fi = p / SP; skies.forEach((k, i) => { const op = Math.max(0, 1 - Math.abs(fi - i)); k.style.opacity = op.toFixed(3); k.classList.toggle("idle", op === 0); });
      vgs.forEach(g => g.classList.toggle("idle", Math.abs(+g.dataset.v - fi) > 1.2));
      const ni = Math.round(fi), nc = o.chapters[ni]; host.classList.toggle("night", !!(nc && H.night(nc.icon)));
      if (o.onFocus) o.onFocus(ni);
    };
    const tick = () => { p += (want - p) * .12; apply(); raf = Math.abs(want - p) > .3 ? requestAnimationFrame(tick) : 0; if (!raf) { p = want; apply(); } };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const pan = host;
    pan.addEventListener("pointerdown", e => { if (e.target.closest(".hz-margo")) return; drag = { x: e.clientX, y: e.clientY, p: want, t: performance.now(), moved: false, lx: e.clientX }; });
    pan.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true; vel = e.clientX - drag.lx; drag.lx = e.clientX; want = Math.max(-40, Math.min(MAX + 40, drag.p + dx * 1.15)); kick(); });
    const up = e => {
      if (!drag) return; const d = drag; drag = null;
      if (!d.moved) { const fg = e.target.closest("[data-fog]"); if (fg) { fg.classList.remove("part"); void fg.getBoundingClientRect(); fg.classList.add("part"); if (o.onFog) o.onFog(+fg.dataset.fog); return; }
        const st = e.target.closest("[data-stage]"); if (st && st.dataset.stage && o.onStage) { st.classList.remove("poke"); void st.getBoundingClientRect(); st.classList.add("poke"); setTimeout(() => o.onStage(st.dataset.stage), 260); } return; }
      want = Math.max(0, Math.min(MAX, Math.round((want + vel * 6) / SP) * SP)); kick();
    };
    pan.addEventListener("pointerup", up); pan.addEventListener("pointercancel", () => { drag = null; });
    const mg = host.querySelector(".hz-margo");
    if (mg) mg.addEventListener("click", () => { const r = mg.querySelector(".margo"); WP.UI.pose(r, ["wave", "proud", "think"][Math.floor(Math.random() * 3)], ["h", "k", "t"][Math.floor(Math.random() * 3)]); if (o.onMargo) o.onMargo(); setTimeout(() => WP.UI.pose(r, "idle", "n"), 1800); });
    apply();
    // Margo greets once the world is in place
    if (mg && !calm()) setTimeout(() => WP.UI.pose(mg.querySelector(".margo"), "wave", "h"), 700), setTimeout(() => WP.UI.pose(mg.querySelector(".margo"), "idle", "n"), 2600);
    return { focus(i) { want = Math.max(0, Math.min(MAX, i * SP)); kick(); }, dispose() { cancelAnimationFrame(raf); mt.remove(); bd.remove(); } };
  };

  /* ---------- session band: the valley of the stage being played ---------- */
  H.band = function (host, o) {
    const W = host.clientWidth || 390, Ht = host.clientHeight || 132, base = Ht - 22, p = H.palette(o.icon);
    host.classList.add("hz", "hz-band");
    const cx = 66;
    const S = structure(p.kind, Math.min(2, o.slot || 0), cx, base, "solid", p.ink), pts = S.lights || strand(cx, S.top, S.w);
    const LAMPS = 10, lx = i => W - 40 - i * ((W - 140) / (LAMPS - 1));
    let road = "M" + W + " " + (base + 8); for (let x = W; x >= 0; x -= 20) road += " L" + x + " " + (base + 7 + Math.sin(x / 60) * 3).toFixed(1);
    let lamps = ""; for (let i = 0; i < LAMPS; i++) lamps += '<g class="lamp" data-i="' + i + '"><rect x="' + (lx(i) - .8) + '" y="' + (base - 10) + '" width="1.6" height="14" fill="#2A211D" opacity=".6"/><circle class="halo" cx="' + lx(i) + '" cy="' + (base - 12) + '" r="7" fill="#FFD99A" opacity="0"/><circle class="bulb" cx="' + lx(i) + '" cy="' + (base - 12) + '" r="2.4" fill="#5A4A44"/></g>';
    host.innerHTML = skyHTML(o.icon, W, Ht * 2.6, ";background-position:0 0") +
      '<svg class="hz-bandsvg" width="' + W + '" height="' + Ht + '" viewBox="0 0 ' + W + ' ' + Ht + '"><g class="drift">' + clouds(W, Ht, 3, 7) + '</g><path d="' + ridge(1.3, W, base - 34, 9, 6, Ht) + '" fill="' + p.far + '"/><path d="' + ridge(4.1, W, base - 18, 7, 6, Ht) + '" fill="' + p.mid + '"/>' +
      tree(W - 26, base + 2, .7, p.mid, 1) + tree(130, base + 2, .6, p.mid, 2) +
      '<path d="' + ridge(7.7, W, base + 2, 3, 6, Ht) + '" fill="' + p.near + '"/><g class="bandst" transform="translate(' + cx + ' ' + base + ') scale(.62) translate(' + (-cx) + ' ' + (-base) + ')">' + S.g + lightsSVG(pts, o.lit || 0, { win: S.win, wire: !S.win }) + '</g>' +
      '<path d="' + road + '" fill="none" stroke="#F6EEDF" stroke-opacity=".45" stroke-width="1.6" stroke-dasharray="2 6"/>' + lamps + '</svg>' +
      '<div class="hz-walker">' + WP.UI.rig("mg-band", "walk") + '</div><div class="hz-ribbon" id="hzrib"></div>';
    const walker = host.querySelector(".hz-walker"), lampEls = [...host.querySelectorAll(".lamp")];
    let lit = 0;
    const api = {
      progress(f) { const x = (W - 40) - Math.max(0, Math.min(1, f)) * (W - 150); walker.style.transform = "translate3d(" + (x - 24) + "px,0,0)"; },
      lamp() {
        const el = lampEls[lit % LAMPS]; lit++; if (!el) return;
        const src = document.querySelector(".gtile.ok,.slot.ok,.face.back,.mt.done,.hs.ok,#actions"), b = el.querySelector(".bulb").getBoundingClientRect();
        const light = () => { el.classList.remove("on"); void el.getBoundingClientRect(); el.classList.add("on"); };
        if (!src || calm()) return light();
        const r = src.getBoundingClientRect(), o = document.createElement("i"); o.className = "orbfly";
        o.style.left = (r.left + r.width * .15) + "px"; o.style.top = (r.top + r.height / 2) + "px"; document.body.appendChild(o);
        const an = o.animate([{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1, offset: .15 },
          { transform: "translate(calc(-50% + " + (b.left + b.width / 2 - r.left - r.width * .15) + "px), calc(-50% + " + (b.top + b.height / 2 - r.top - r.height / 2) + "px)) scale(.7)", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.5,0,.2,1)" });
        an.onfinish = () => { o.remove(); light(); };
      },
      react(kind) {
        const r = walker.querySelector(".margo");
        if (kind === "oops") { walker.classList.remove("stumble"); void walker.offsetWidth; walker.classList.add("stumble"); }
        if (kind === "streak") { host.classList.remove("shoot"); void host.offsetWidth; host.classList.add("shoot"); }
        if (kind === "half" || (kind && kind.indexOf && kind.indexOf("streak:") === 0)) { const rb = host.querySelector(".hz-ribbon"); rb.textContent = kind === "half" ? "חצי הדרך" : kind.slice(7) + " ברצף"; rb.classList.remove("on"); void rb.offsetWidth; rb.classList.add("on"); if (r) WP.UI.pose(r, kind === "half" ? "point" : "clap", "h"); }
        if (r) { clearTimeout(api.t); api.t = setTimeout(() => WP.UI.pose(r, "walk", "n"), 1400); }
      }
    };
    api.progress(0);
    return api;
  };

  /* ---------- finale: evening falls, the stage's lights come on one by one ---------- */
  H.finale = function (host, o) {
    const W = host.clientWidth || 390, Ht = host.clientHeight || 430, base = Ht - 64, p = H.palette(o.icon);
    host.classList.add("hz", "hz-fin");
    const cx = W / 2 + 20;
    const stages = o.stages.map((s, i) => Object.assign({}, s, i === o.focus ? { lit: o.to } : {}));
    const v = valley(o.icon, cx, base, stages, { focus: o.focus, anim: !calm(), from: o.from, to: o.to, delay: 1.1, reveal: o.reveal });
    const tier = o.tier || 0, fx = ["lanterns", "birds", "stars"][Math.floor(Math.random() * 3)];
    let extra = "";
    if (tier >= 2 && !calm()) {
      const t0 = 1.6 + (o.to - (o.from || 0)) * .32;
      if (fx === "lanterns") for (let k = 0; k < 7; k++) extra += '<g class="skyl" style="animation-delay:' + (t0 + k * .25).toFixed(2) + 's"><rect x="' + (40 + rnd(k + 5) * (W - 80)) + '" y="' + (base - 30 - rnd(k) * 40) + '" width="7" height="9" rx="2" fill="#FFD99A"/></g>';
      else if (fx === "birds") for (let k = 0; k < 5; k++) extra += '<path class="flock" style="animation-delay:' + (t0 + k * .15).toFixed(2) + 's" d="M' + (W * .2 + k * 14) + ' ' + (base - 120 - k * 8) + ' q4 -5 8 0 q4 -5 8 0" stroke="#F6EEDF" stroke-width="1.6" fill="none"/>';
      else for (let k = 0; k < 3; k++) extra += '<path class="shoot" style="animation-delay:' + (t0 + k * .6).toFixed(2) + 's" d="M' + (W - 30 - k * 60) + ' ' + (30 + k * 26) + ' l-60 26" stroke="#FFF6E0" stroke-width="1.6" stroke-linecap="round"/>';
    }
    let fw = "";
    if (tier >= 3 && !calm()) for (let k = 0; k < 3; k++) { const fx = cx + SLOT_DX[o.focus] + (k - 1) * 46, fy = 70 + k % 2 * 34; fw += '<g class="fw" style="animation-delay:' + (2.6 + o.to * .32 + k * .45).toFixed(2) + 's">' + Array.from({ length: 12 }, (_, j) => { const a = j / 12 * Math.PI * 2; return '<line x1="' + fx + '" y1="' + fy + '" x2="' + (fx + Math.cos(a) * 22).toFixed(1) + '" y2="' + (fy + Math.sin(a) * 22).toFixed(1) + '" stroke="' + ["#FFD99A", "#F6EEDF", "#E57C8E"][j % 3] + '" stroke-width="2" stroke-linecap="round"/>'; }).join("") + '</g>'; }
    host.classList.add("tier" + tier);
    host.innerHTML = skyHTML(o.icon, W, Ht) + '<div class="hz-dusk"></div>' +
      '<svg class="hz-finsvg" width="' + W + '" height="' + Ht + '" viewBox="0 0 ' + W + ' ' + Ht + '"><defs>' + BEAM + '</defs><g class="drift">' + clouds(W, Ht, 4, 11) + '</g>' +
      '<path d="' + ridge(1.3, W, base - 120, 26, 6, Ht) + '" fill="' + p.far + '"/><path d="' + ridge(4.1, W, base - 70, 20, 6, Ht) + '" fill="' + p.mid + '"/>' + v.back +
      '<path d="' + ridge(7.7, W, base + 4, 8, 6, Ht) + '" fill="' + p.near + '"/>' + v.front + fw + extra + grass(W, Ht, "#1E1716") + '</svg>' +
      '<div class="hz-finmargo" style="left:' + (W - 110) + 'px;top:' + (base - 118) + 'px">' + WP.UI.rig("mg-fin", "proud") + '</div>';
    motes(host, 12, true);
    const r = host.querySelector(".hz-finmargo .margo");
    const timers = [];
    const peak = ["proud", "clap", "clap", "cheer", "cheer"][tier], peakFace = ["k", "h", "h", "h", "w"][tier], lit = (o.to - (o.from || 0)) * 320;
    if (!calm()) { timers.push(setTimeout(() => WP.UI.pose(r, "point", tier ? "w" : "t"), 900)); timers.push(setTimeout(() => WP.UI.pose(r, peak, peakFace), 1300 + lit)); timers.push(setTimeout(() => WP.UI.pose(r, "proud", "k"), 3900 + lit)); }
    else WP.UI.pose(r, peak, peakFace);
    const skip = () => { host.classList.add("skip"); timers.forEach(clearTimeout); WP.UI.pose(r, "cheer", "h"); };
    host.addEventListener("click", skip, { once: true });
    return { skip, dispose() { timers.forEach(clearTimeout); } };
  };
})(window.WP = window.WP || {});
