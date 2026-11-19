/* WORDPLAY world: floating islands at golden hour, drawn with three.js.
   Pure view layer. It receives island data derived from measured memory levels and never writes progress.
   Each chapter is an island; each of its three stages is one structure on it:
   ghost (blueprint) = stage not open yet, rising = open and partly recalled, solid = stage passed the bar. */
(function (WP) {
  "use strict";
  const W = WP.World = {};
  let ok3d = null;
  W.available = function () {
    if (ok3d !== null) return ok3d;
    try { const c = document.createElement("canvas"); ok3d = !!(window.THREE && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { ok3d = false; }
    return ok3d;
  };
  const calm = () => (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || (WP.Store && WP.Store.data && WP.Store.data.profile.settings.calm);

  /* ---------- palette (sRGB hex, converted to linear for filmic output) ---------- */
  const P = { ivory: 0xF4E9D8, sand: 0xE6CBA2, terra: 0xC65A40, teal: 0x1F5C66, deep: 0x163F49, gold: 0xE8B44C, glass: 0x7FB8AE, coral: 0xE0795E, grass: 0x5E9F6E, grass2: 0x3F8A5C, rock: 0xA86B52, rock2: 0x7E4F42, lockGrass: 0xA9BFB0, lockRock: 0xA08C88, white: 0xFFFFFF, trunk: 0x7A4E36 };
  let T; // THREE
  const col = h => new T.Color(h).convertSRGBToLinear();
  const mats = {};
  const M = (h, o) => { const k = h + JSON.stringify(o || {}); if (!mats[k]) mats[k] = new T.MeshStandardMaterial(Object.assign({ color: col(h), flatShading: true, roughness: .82, metalness: 0 }, o || {})); return mats[k]; };
  const texs = {};
  function winTex(key, base, lit, dark, cols, rows) {
    if (texs[key]) return texs[key];
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = base; x.fillRect(0, 0, 64, 128);
    const cw = 64 / cols, rh = 128 / rows;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const v = Math.abs(Math.sin((r * 7 + k * 13 + key.length) * 12.9898) * 43758.5453 % 1); x.fillStyle = v > .42 ? lit : dark; x.fillRect(k * cw + cw * .26, r * rh + rh * .22, cw * .48, rh * .56); }
    x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(0, 0, 4, 128);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.magFilter = T.NearestFilter; texs[key] = t; return t;
  }
  const WM = (key, base, lit, dark, cols, rows) => { const k = "w" + key; if (!mats[k]) mats[k] = new T.MeshStandardMaterial({ map: winTex(key, base, lit, dark, cols, rows), flatShading: true, roughness: .55, metalness: .05, emissive: col(0x3A2410), emissiveIntensity: .25 }); return mats[k]; };

  /* ---------- primitives ---------- */
  function mesh(geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m; }
  const box = (w, h, d, mat, x, z, y) => mesh(new T.BoxGeometry(w, h, d), mat, x, (y || 0) + h / 2, z);
  const cyl = (rt, rb, h, mat, x, z, y, seg) => mesh(new T.CylinderGeometry(rt, rb, h, seg || 10), mat, x, (y || 0) + h / 2, z);
  function roof(w, h, mat, y) { const r = mesh(new T.ConeGeometry(w * .78, h, 4), mat, 0, y + h / 2, 0); r.rotation.y = Math.PI / 4; return r; }
  function tree(x, z, s) {
    const g = new T.Group();
    g.add(cyl(.045 * s, .07 * s, .32 * s, M(P.trunk), 0, 0, 0, 5));
    const a = mesh(new T.IcosahedronGeometry(.28 * s, 0), M(P.grass2), 0, .52 * s, 0); a.scale.y = 1.25; g.add(a);
    const b = mesh(new T.IcosahedronGeometry(.2 * s, 0), M(P.grass), .06 * s, .78 * s, .03 * s); g.add(b);
    g.position.set(x, 0, z); return g;
  }
  function group(...ch) { const g = new T.Group(); ch.forEach(c => g.add(c)); return g; }

  /* ---------- landmark kits: three structures per chapter ---------- */
  const SLOT = [[-.72, -.3], [.5, .42], [.62, -.78]];
  const KIT = {
    briefcase: [
      () => group(box(.74, 2.5, .74, WM("tl", "#2C6A72", "#FFD58A", "#1B434B", 4, 10)), cyl(.02, .02, .55, M(P.ivory), 0, 0, 2.5, 4)),
      () => box(.62, 1.75, .62, WM("iv", "#EFE2CC", "#E8B44C", "#9DB4B6", 3, 7)),
      () => box(.52, 1.2, .52, WM("tc", "#C65A40", "#FFD58A", "#8E3B2A", 3, 5))],
    house: [
      () => group(box(.66, .5, .62, M(P.ivory)), roof(.66, .42, M(P.terra), .5)),
      () => group(box(.56, .62, .56, M(P.sand)), roof(.56, .38, M(P.teal), .62)),
      () => group(box(.6, .46, .58, M(P.ivory)), roof(.6, .36, M(P.gold), .46), box(.08, .26, .08, M(P.terra), .16, .1, .66))],
    handshake: [
      () => group(cyl(.5, .5, .08, M(P.ivory), 0, 0, .42, 16), cyl(.06, .08, .42, M(P.deep), 0, 0, 0, 6), ...[0, 1, 2, 3].map(i => cyl(.09, .09, .22, M(P.terra), Math.cos(i * 1.57) * .72, Math.sin(i * 1.57) * .72, 0, 6))),
      () => { const g = new T.Group(); for (let i = 0; i < 5; i++) { const a = Math.PI * (.15 + i * .175); g.add(cyl(.06, .06, 1.2, M(P.ivory), Math.cos(a) * .7, -Math.sin(a) * .7, 0, 8)); } const arc = mesh(new T.TorusGeometry(.7, .07, 6, 18, Math.PI), M(P.gold), 0, 1.24, 0); arc.rotation.x = Math.PI / 2; g.add(arc); return g; },
      () => group(cyl(.45, .5, .55, M(P.ivory), 0, 0, 0, 12), mesh(new T.SphereGeometry(.47, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(P.teal), 0, .55, 0))],
    clapper: [
      () => group(box(1.05, .78, .8, M(0x8E3B4F)), mesh(new T.BoxGeometry(1.1, .16, .12), new T.MeshStandardMaterial({ color: col(P.gold), emissive: col(P.gold), emissiveIntensity: .8 }), 0, .62, .44)),
      () => group(cyl(.3, .34, 1.3, M(P.ivory), 0, 0, 0, 10), mesh(new T.SphereGeometry(.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(P.gold), 0, 1.3, 0)),
      () => group(box(.08, .9, .08, M(P.deep), -.32, 0), box(.08, .9, .08, M(P.deep), .32, 0), mesh(new T.BoxGeometry(.9, .5, .06), new T.MeshStandardMaterial({ color: col(0x9BD3E0), emissive: col(0x5FB3C6), emissiveIntensity: .6 }), 0, 1.05, 0))],
    plane: [
      () => { const g = new T.Group(); for (let i = 0; i < 5; i++) g.add(cyl(.27 - i * .03, .3 - i * .03, .38, M(i % 2 ? P.terra : P.ivory), 0, 0, i * .38, 12)); g.add(mesh(new T.CylinderGeometry(.16, .16, .24, 10), new T.MeshStandardMaterial({ color: col(0xFFE3A0), emissive: col(0xFFC870), emissiveIntensity: 1.2 }), 0, 2.02, 0)); g.add(mesh(new T.ConeGeometry(.22, .26, 10), M(P.deep), 0, 2.27, 0)); return g; },
      () => { const g = group(box(1.3, .04, .36, M(0x5A6A70))); const pl = new T.Group(); pl.add(box(.5, .08, .1, M(P.ivory), 0, 0, 0), box(.1, .04, .6, M(P.ivory), .05, 0, .02), box(.06, .14, .14, M(P.terra), -.22, 0, .04)); pl.position.set(.1, .06, 0); pl.rotation.y = .3; g.add(pl); return g; },
      () => { const h = mesh(new T.CylinderGeometry(.42, .42, .9, 12, 1, false, 0, Math.PI), M(P.sand), 0, 0, 0); h.rotation.z = Math.PI / 2; h.rotation.y = Math.PI / 2; return group(h); }],
    heart: [
      () => group(cyl(.45, .5, .2, M(P.ivory), 0, 0, 0, 14), mesh(new T.CylinderGeometry(.4, .4, .05, 14), new T.MeshStandardMaterial({ color: col(0x7FC8D0), roughness: .2, metalness: .1 }), 0, .2, 0), cyl(.05, .07, .5, M(P.ivory), 0, 0, .2, 6)),
      () => { const g = new T.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(cyl(.04, .04, .7, M(P.ivory), Math.cos(a) * .42, Math.sin(a) * .42, 0, 6)); } g.add(mesh(new T.ConeGeometry(.56, .4, 6), M(P.coral), 0, .9, 0)); return g; },
      () => { const g = group(tree(-.35, 0, .9), tree(.35, 0, .9)); const ar = mesh(new T.TorusGeometry(.35, .05, 6, 16, Math.PI), M(P.coral), 0, .55, 0); g.add(ar); return g; }],
    coin: [
      () => { const g = group(box(.7, .42, .5, M(P.ivory))); for (let i = 0; i < 4; i++) { const s = mesh(new T.BoxGeometry(.18, .04, .6), M(i % 2 ? P.coral : P.ivory), -.27 + i * .18, .62, .05); s.rotation.x = .25; g.add(s); } return g; },
      () => { const g = group(box(.9, .7, .6, M(P.ivory)), box(1, .12, .7, M(P.sand), 0, 0, .7)); for (let i = 0; i < 4; i++) g.add(cyl(.05, .05, .58, M(P.white), -.33 + i * .22, .34, .02, 8)); const ped = mesh(new T.ConeGeometry(.6, .25, 4), M(P.gold), 0, .95, 0); ped.rotation.y = Math.PI / 4; ped.scale.z = .6; g.add(ped); return g; },
      () => { const g = new T.Group(); [[0, 0, 6], [.28, .1, 4], [-.2, .22, 3]].forEach(([x, z, n]) => { for (let i = 0; i < n; i++) g.add(cyl(.13, .13, .06, M(P.gold, { roughness: .35, metalness: .5 }), x, z, i * .065, 14)); }); return g; }],
    phone: [
      () => { const g = new T.Group(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = cyl(.025, .05, 2.2, M(P.ivory), Math.cos(a) * .2, Math.sin(a) * .2, 0, 4); l.rotation.z = Math.cos(a) * .08; l.rotation.x = -Math.sin(a) * .08; g.add(l); } g.add(mesh(new T.SphereGeometry(.07, 8, 8), new T.MeshStandardMaterial({ color: col(P.coral), emissive: col(P.coral), emissiveIntensity: 1.5 }), 0, 2.25, 0)); return g; },
      () => { const g = group(cyl(.06, .1, .5, M(P.deep), 0, 0, 0, 6)); const d = mesh(new T.SphereGeometry(.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), M(P.ivory, { side: T.DoubleSide }), 0, .55, 0); d.rotation.x = -1.1; g.add(d); return g; },
      () => group(box(.42, .8, .42, M(P.teal)), mesh(new T.BoxGeometry(.3, .4, .02), new T.MeshStandardMaterial({ color: col(0xBFE6E6), emissive: col(0x7FC8C8), emissiveIntensity: .5 }), 0, .5, .22), roof(.48, .2, M(P.terra), .8))],
    dumbbell: [
      () => { const g = group(cyl(.75, .8, .25, M(P.ivory), 0, 0, 0, 20)); const r = mesh(new T.TorusGeometry(.62, .1, 6, 22), M(P.coral), 0, .3, 0); r.rotation.x = Math.PI / 2; g.add(r); return g; },
      () => { const t = mesh(new T.TorusGeometry(.45, .06, 4, 26), M(P.terra), 0, .04, 0); t.rotation.x = Math.PI / 2; t.scale.y = .6; return group(t, box(.5, .02, .2, M(P.grass2), 0, 0, 0)); },
      () => group(box(.5, 1.3, .5, WM("gy", "#EFE2CC", "#E8B44C", "#7FB8AE", 3, 6)), box(.56, .1, .56, M(P.teal), 0, 0, 1.3))]
  };

  function ghostOf(obj) {
    const out = new T.Group(); obj.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(obj.matrixWorld).invert();
    obj.traverse(o => {
      if (!o.isMesh) return;
      const m4 = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const e = new T.LineSegments(new T.EdgesGeometry(o.geometry, 25), new T.LineBasicMaterial({ color: 0xFFF6E6, transparent: true, opacity: .7 }));
      const f = new T.Mesh(o.geometry, new T.MeshBasicMaterial({ color: 0xFFF6E6, transparent: true, opacity: .09, depthWrite: false }));
      [e, f].forEach(x => { m4.decompose(x.position, x.quaternion, x.scale); out.add(x); });
    });
    return out;
  }

  function cloud(s, op) {
    const g = new T.Group(); const mat = new T.MeshStandardMaterial({ color: col(0xFFF4EA), flatShading: true, roughness: 1, transparent: op < 1, opacity: op, emissive: col(0x6B3A2A), emissiveIntensity: .12 });
    [[0, 0, 0, 1], [.9, -.1, .1, .75], [-.85, -.15, 0, .7], [.35, .38, -.1, .7], [-.3, .3, .15, .6]].forEach(([x, y, z, r]) => { const m = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat); m.position.set(x, y, z); g.add(m); });
    g.scale.setScalar(s); return g;
  }

  /* An island; data: {icon, color, open, parts:[{state, frac}]} */
  function island(d, r) {
    const g = new T.Group(), open = d.open;
    const top = mesh(new T.CylinderGeometry(r, r * .96, .4, 12), M(open ? P.grass : P.lockGrass)); g.add(top);
    const lip = mesh(new T.CylinderGeometry(r * 1.005, r * 1.005, .08, 12), M(open ? P.grass2 : P.lockGrass), 0, -.2, 0); g.add(lip);
    const rim = mesh(new T.CylinderGeometry(r * .97, r * .8, .55, 12), M(open ? P.sand : 0xE5D9CB), 0, -.5, 0); g.add(rim);
    const rock = mesh(new T.ConeGeometry(r * .8, r * 1.15, 12), M(open ? P.rock : P.lockRock), 0, -.78 - r * .575, 0); rock.rotation.x = Math.PI; g.add(rock);
    const rock2 = mesh(new T.ConeGeometry(r * .35, r * .7, 7), M(open ? P.rock2 : P.lockRock), r * .3, -1.2 - r * .5, -r * .2); rock2.rotation.x = Math.PI; g.add(rock2);
    [[.3, 1.1], [2.4, 1.15], [4.3, 1.2]].forEach(([a, k], i) => { const p = mesh(new T.DodecahedronGeometry(r * .12), M(open ? P.rock : P.lockRock), Math.cos(a) * r * k, -.95 - i * .32, Math.sin(a) * r * k); p.userData.bob = i; g.add(p); });
    const kit = KIT[d.icon] || KIT.briefcase, parts = [];
    (d.parts || []).forEach((pt, i) => {
      const s = SLOT[i]; const holder = new T.Group(); holder.position.set(s[0] * r / 2.1, .2, s[1] * r / 2.1);
      const solid = kit[i](); const ghost = ghostOf(solid);
      if (pt.state === "ghost" || !open) { holder.add(ghost); }
      else {
        if (pt.state !== "done") holder.add(ghost);
        const k = pt.state === "done" ? 1 : Math.max(.14, pt.frac);
        solid.scale.y = k; holder.add(solid); holder.userData.solid = solid;
      }
      g.add(holder); parts.push(holder);
    });
    if (open) [[-1.25, .75, 1], [1.2, .9, .85], [-.05, 1.35, .9], [1.45, -.1, .7], [-1.5, -.55, .8]].forEach(([x, z, s]) => g.add(tree(x * r / 2.1, z * r / 2.1, s)));
    // pennant in the chapter colour
    const pole = cyl(.025, .025, .9, M(P.ivory), -r * .82, r * .35, .2, 5); g.add(pole);
    const flag = mesh(new T.BoxGeometry(.34, .2, .02), M(open ? d.color : 0xD8D0CC), -r * .82 + .18, 1.0, r * .35); flag.castShadow = false; g.add(flag); g.userData.flag = flag;
    g.userData.parts = parts;
    return g;
  }

  /* ---------- scene shell ---------- */
  function shell(host, fog) {
    T = window.THREE;
    const canvas = document.createElement("canvas"); canvas.className = "world-c"; host.appendChild(canvas);
    const w = host.clientWidth || 360, h = host.clientHeight || 640;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(); scene.fog = new T.Fog(col(0xE9A07A), fog[0], fog[1]);
    scene.add(new T.HemisphereLight(col(0xFFE2C0), col(0x24525E), .95));
    const sun = new T.DirectionalLight(col(0xFFD0A0), 2.1); sun.position.set(-7, 11, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0008; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    scene.add(sun); scene.add(sun.target);
    const rim = new T.DirectionalLight(col(0xFF9A7A), .9); rim.position.set(6, 3, -8); scene.add(rim);
    // drifting motes of light
    const n = 70, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 16; pos[i * 3 + 1] = Math.random() * 10 - 1; pos[i * 3 + 2] = -Math.random() * 30 + 6; }
    const pg = new T.BufferGeometry(); pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    const motes = new T.Points(pg, new T.PointsMaterial({ color: col(0xFFE3A6), size: .07, transparent: true, opacity: .85, depthWrite: false }));
    scene.add(motes);
    const clouds = [];
    for (let i = 0; i < 12; i++) { const c = cloud(1.3 + Math.random() * 1.5, .95); c.position.set((Math.random() - .5) * 34, -7.5 - Math.random() * 2.5, -Math.random() * 40 - 2); scene.add(c); clouds.push({ o: c, v: .1 + Math.random() * .15 }); }
    for (let i = 0; i < 4; i++) { const c = cloud(.5 + Math.random() * .5, .8); c.position.set((Math.random() > .5 ? 1 : -1) * (6 + Math.random() * 8), 3 + Math.random() * 14, -10 - Math.random() * 30); scene.add(c); clouds.push({ o: c, v: .2 + Math.random() * .2 }); }
    return { canvas, renderer, scene, sun, motes, clouds, w, h };
  }

  /* ---------- home: the archipelago ---------- */
  const spot = i => new (window.THREE.Vector3)(Math.sin(i * 1.15) * 2.5, i * 2.1, -i * 5.4);

  W.home = function (host, o) {
    const S = shell(host, [18, 44]), { scene, renderer, w, h } = S;
    const cam = new T.PerspectiveCamera(50, w / h, .1, 200); cam.setViewOffset(w, h, 0, Math.round(h * .1), w, h);
    const isl = [], labels = [];
    o.islands.forEach((d, i) => {
      const g = island(d, d.cur ? 2.1 : 1.6); const p = spot(i); g.position.copy(p); g.userData.base = p.y; g.userData.id = d.id; g.userData.ph = i * 1.3;
      scene.add(g); isl.push(g);
      const el = document.createElement("div"); el.className = "wlabel" + (d.cur ? " cur" : d.open ? "" : " ghost");
      el.innerHTML = '<b>' + d.title + '</b>' + (d.sub ? '<i>' + d.sub + '</i>' : '');
      host.appendChild(el); labels.push({ el, g, dy: d.cur ? 3.4 : 3.0 });
    });
    // path of light between islands
    for (let i = 0; i < isl.length - 1; i++) {
      const a = spot(i).add(new T.Vector3(0, .4, 0)), b = spot(i + 1).add(new T.Vector3(0, .4, 0)), m = a.clone().lerp(b, .5); m.y += 1.4;
      const pts = new T.QuadraticBezierCurve3(a, m, b).getPoints(18).slice(3, -3);
      const lit = o.islands[i + 1].open;
      pts.forEach(p => { const s = new T.Mesh(new T.SphereGeometry(.055, 6, 6), new T.MeshBasicMaterial({ color: lit ? col(0xFFD58A) : col(0xFFF6E6), transparent: true, opacity: lit ? 1 : .45 })); s.position.copy(p); scene.add(s); });
    }
    let margoEl = null;
    if (o.margoHTML && o.curIndex >= 0) { margoEl = document.createElement("div"); margoEl.className = "wmargo"; margoEl.innerHTML = o.margoHTML; host.appendChild(margoEl); }

    let focus = Math.max(0, o.curIndex), want = focus, yaw = 0, wantYaw = 0, drag = null, raf = 0, alive = true;
    const v = new T.Vector3(), look = new T.Vector3();
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    S.canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, f: want, yaw: wantYaw, moved: false }; try { S.canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    S.canvas.addEventListener("pointermove", e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      want = Math.max(0, Math.min(isl.length - 1, drag.f + dy / 170)); wantYaw = Math.max(-.5, Math.min(.5, drag.yaw + dx / 220));
      kick();
    });
    const up = e => {
      if (!drag) return; const d = drag; drag = null;
      want = Math.round(want); kick();
      if (!d.moved && o.onPick) {
        const r = S.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
        ray.setFromCamera(ndc, cam); const hit = ray.intersectObjects(isl, true)[0];
        if (hit) { let g = hit.object; while (g && !g.userData.id) g = g.parent; if (g) o.onPick(g.userData.id); }
      }
    };
    S.canvas.addEventListener("pointerup", up); S.canvas.addEventListener("pointercancel", () => { drag = null; });

    const still = calm();
    function frame(now) {
      if (!alive) return;
      const t = now / 1000;
      focus += (want - focus) * .09; yaw += (wantYaw - yaw) * .08; if (!drag) wantYaw *= .985;
      const fi = Math.max(0, Math.min(isl.length - 1, focus)), i0 = Math.floor(fi), i1 = Math.min(isl.length - 1, i0 + 1);
      look.copy(spot(i0)).lerp(spot(i1), fi - i0); look.y += .9;
      cam.position.set(look.x + Math.sin(yaw) * 12, look.y + 5.4, look.z + Math.cos(yaw) * 12);
      if (!still) cam.position.x += Math.sin(t * .2) * .25;
      cam.lookAt(look);
      S.sun.position.set(look.x - 7, look.y + 11, look.z + 6); S.sun.target.position.copy(look);
      isl.forEach(g => { g.position.y = g.userData.base + (still ? 0 : Math.sin(t * .7 + g.userData.ph) * .12); if (g.userData.flag && !still) g.userData.flag.rotation.y = Math.sin(t * 3 + g.userData.ph) * .25; });
      if (!still) { S.clouds.forEach(c => { c.o.position.x += c.v * .016; if (c.o.position.x > 20) c.o.position.x = -20; }); S.motes.rotation.y = t * .01; S.motes.position.y = Math.sin(t * .3) * .3; }
      renderer.render(scene, cam);
      labels.forEach(l => { l.g.getWorldPosition(v); v.y += l.dy; v.project(cam); const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h; l.el.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-100%)"; l.el.style.opacity = v.z < 1 && y > 70 && y < h - 150 ? 1 : 0; });
      if (margoEl) { const g = isl[o.curIndex]; g.getWorldPosition(v); v.x -= .5; v.y += .25; v.z += 1.5; v.project(cam); const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h; margoEl.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-100%)"; margoEl.style.opacity = v.z < 1 && y < h - 120 ? 1 : 0; }
      const settled = Math.abs(want - focus) < .002 && Math.abs(wantYaw - yaw) < .002;
      raf = (!still || !settled || drag) && !document.hidden ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }
    document.addEventListener("visibilitychange", kick);
    kick();
    return {
      focusOn(i) { want = Math.max(0, Math.min(isl.length - 1, i)); kick(); },
      dispose() { alive = false; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", kick); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {} S.canvas.remove(); labels.forEach(l => l.el.remove()); if (margoEl) margoEl.remove(); }
    };
  };

  /* ---------- end: close-up of one island, one structure grows ---------- */
  W.finale = function (host, o) {
    const S = shell(host, [14, 32]), { scene, renderer, w, h } = S;
    const cam = new T.PerspectiveCamera(42, w / h, .1, 200); cam.setViewOffset(w, h, 0, Math.round(h * .16), w, h);
    const g = island(o.island, 2.3); scene.add(g);
    const grow = o.grow && g.userData.parts[o.grow.part] && g.userData.parts[o.grow.part].userData.solid;
    const from = o.grow ? Math.max(.14, o.grow.from) : 1, to = o.grow ? Math.max(.14, o.grow.to) : 1;
    if (grow) grow.scale.y = from;
    const dust = new T.Mesh(new T.TorusGeometry(.45, .05, 6, 28), new T.MeshBasicMaterial({ color: 0xFFF2DC, transparent: true, opacity: 0 }));
    dust.rotation.x = Math.PI / 2; if (grow) { const hp = g.userData.parts[o.grow.part].position; dust.position.set(hp.x, .26, hp.z); } g.add(dust);
    const conf = [], cols = [0xE8B44C, 0xFFF2DC, 0xE0795E, 0x7FB8AE];
    if (o.celebrate) for (let i = 0; i < 90; i++) { const m = new T.Mesh(new T.PlaneGeometry(.1, .17), new T.MeshBasicMaterial({ color: col(cols[i % 4]), side: T.DoubleSide })); m.visible = false; scene.add(m); conf.push({ m, v: new T.Vector3(), r: Math.random() * 6 }); }
    const look = new T.Vector3(0, .9, 0);
    let t0 = performance.now(), raf = 0, alive = true; const still = calm();
    function reset() { t0 = performance.now(); conf.forEach(c => { c.m.position.set((Math.random() - .5) * 1.6, 1.4, (Math.random() - .5) * 1.6); c.v.set((Math.random() - .5) * .15, .11 + Math.random() * .13, (Math.random() - .5) * .12); c.m.visible = false; }); if (grow) grow.scale.y = from; }
    reset();
    function frame(now) {
      if (!alive) return;
      const t = (now - t0) / 1000, T2 = now / 1000;
      const ang = still ? .35 : .35 + Math.sin(T2 * .22) * .3;
      cam.position.set(Math.sin(ang) * 11, 5.8, Math.cos(ang) * 11); cam.lookAt(look);
      g.position.y = still ? 0 : Math.sin(T2 * .7) * .1;
      if (grow) { const k = still ? 1 : Math.max(0, Math.min(1, (t - .5) / .9)); const e = k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -9 * k) * Math.sin((k * 9 - .75) * (2 * Math.PI) / 3) + 1; grow.scale.y = from + (to - from) * e; const d = Math.max(0, Math.min(1, (t - .5) / 1)); dust.material.opacity = d > 0 && d < 1 ? (1 - d) * .8 : 0; const ds = 1 + d * 2.6; dust.scale.set(ds, ds, ds); }
      if (!still) { conf.forEach(c => { if (t < 1.2) return; c.m.visible = true; c.v.y -= .0032; c.m.position.add(c.v); c.v.multiplyScalar(.992); c.m.rotation.x += c.r * .016; c.m.rotation.y += c.r * .012; }); S.clouds.forEach(c => { c.o.position.x += c.v * .016; if (c.o.position.x > 20) c.o.position.x = -20; }); }
      renderer.render(scene, cam);
      raf = !still && !document.hidden && t < 30 ? requestAnimationFrame(frame) : 0;
    }
    raf = requestAnimationFrame(frame);
    return { replay() { reset(); if (!raf) raf = requestAnimationFrame(frame); }, dispose() { alive = false; cancelAnimationFrame(raf); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {} S.canvas.remove(); } };
  };
})(window.WP = window.WP || {});
