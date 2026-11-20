#!/usr/bin/env node
// Content quality gate for WORDPLAY. Run: node tools/validate-content.js
// Exits non-zero when any item would produce a broken or misleading exercise.
const fs = require("fs");
const path = require("path");
// Optional argument: a content folder that overrides app/content file by file (used by test builds such as app-m5/content).
const base = path.join(__dirname, "..", "app", "content"), dir = process.argv[2] ? path.resolve(process.argv[2]) : base;
const read = f => JSON.parse(fs.readFileSync(fs.existsSync(path.join(dir, f)) ? path.join(dir, f) : path.join(base, f), "utf8"));
const course = read("course.json"), conf = read("confusions.json").pairs;
const items = (course.itemFiles || ["items.json"]).flatMap(f => read(f).items);
const TYPES = ["word", "phrasal", "idiom", "collocation", "slang", "phrase"];
const LEVELS = ["A2", "B1", "B2", "C1", "C2"];
const DOMAINS = ["daily", "business", "talk", "shows"];
const ICONS = ["briefcase", "house", "handshake", "clapper", "plane", "heart", "coin", "phone", "dumbbell", "chat"];
const SCENES = ["party", "desk", "shop"];
const PICS = ["lever", "glass", "sprout", "clock", "bottle"];
const errs = [], warns = [];
const ids = new Set(), seenEn = new Map();
const words = s => (s || "").toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(Boolean);
const E = (id, m) => errs.push(id + ": " + m), W = (id, m) => warns.push(id + ": " + m);

for (const it of items) {
  const id = it.id || "(no id)";
  if (!/^[a-z0-9]+$/.test(it.id || "")) E(id, "id must be lowercase letters/digits");
  if (ids.has(it.id)) E(id, "duplicate id"); ids.add(it.id);
  for (const k of ["en", "type", "pos", "level", "stress", "he"]) if (!it[k]) E(id, "missing " + k);
  if (it.type && !TYPES.includes(it.type)) E(id, "unknown type " + it.type);
  if (it.level && !LEVELS.includes(it.level)) E(id, "unknown level " + it.level);
  if (!Array.isArray(it.domains) || !it.domains.length || it.domains.some(d => !DOMAINS.includes(d))) E(id, "bad domains");
  if (!/[֐-׿]/.test(it.he || "")) E(id, "Hebrew meaning missing");
  if ((it.he || "").length > 48) W(id, "Hebrew meaning longer than 48 chars (may wrap in options)");
  if (!Array.isArray(it.hint) || it.hint.length !== 2) E(id, "hint must be [first, wordsLabel]");
  if (it.scene && !SCENES.includes(it.scene)) E(id, "unknown scene " + it.scene);
  if (it.pic && !PICS.includes(it.pic)) E(id, "unknown pic " + it.pic);
  if (!Array.isArray(it.examples) || !it.examples.length) E(id, "needs at least one example");
  for (const ex of it.examples || []) {
    const m = (ex.s || "").match(/\{([^}]+)\}/g) || [];
    if (m.length !== 1) { E(id, "example must contain exactly one {target}: " + ex.s); continue; }
    const target = m[0].slice(1, -1);
    const head = it.en.replace(/^(a|an|the) /i, "").split(" ")[0].toLowerCase().slice(0, 4);
    if (!target.toLowerCase().includes(head.slice(0, 3))) W(id, "target '" + target + "' does not look like a form of '" + it.en + "'");
    if (ex.d && !DOMAINS.includes(ex.d)) E(id, "example domain " + ex.d);
    if ((ex.s || "").length > 110) W(id, "example longer than 110 chars");
  }
  // no two items may teach the same expression
  const key = words(it.en).join(" ");
  if (seenEn.has(key)) E(id, "duplicate expression of " + seenEn.get(key)); seenEn.set(key, id);
  // items written for a situation (season 3 onward) carry three examples and a Hebrew situation
  if (it.sit !== undefined) {
    if (!/[֐-׿]/.test(it.sit)) E(id, "situation must be in Hebrew");
    if ((it.examples || []).length < 3) E(id, "needs three examples");
    if (new Set((it.examples || []).map(e => e.d)).size < 2) W(id, "examples come from a single context");
  }
  // phrase builder: decoys are single words that are not part of the phrase
  if (it.build) {
    const w = words(it.en);
    if (w.length < 2) E(id, "phrase builder needs a multi-word expression");
    const dc = it.build.decoys || [];
    if (dc.length < 3 || dc.length > 4) E(id, "phrase builder needs 3-4 decoys");
    dc.forEach(d => { if (/\s/.test(d)) E(id, "decoy must be one word: " + d); if (w.includes(d.toLowerCase())) E(id, "decoy is part of the phrase: " + d); });
    for (const n in it.build.near || {}) { const nw = words(n); if (nw.length !== w.length) E(id, "near phrase '" + n + "' has a different length"); if (!nw.every(x => w.includes(x) || dc.map(y => y.toLowerCase()).includes(x))) E(id, "near phrase '" + n + "' cannot be built from the tiles"); if (!/[֐-׿]/.test(it.build.near[n])) E(id, "near note must be in Hebrew"); }
  }
  const ds = it.distractors || [];
  if (ds.length < 2) E(id, "needs 2 distractors");
  if (ds.some(d => (it.examples || []).some(ex => (ex.s || "").toLowerCase().includes("{" + (d.t || "").toLowerCase() + "}")))) E(id, "distractor equals an answer");
  const tgt = ((it.examples || [{}])[0].s || "").match(/\{([^}]+)\}/);
  for (const d of ds) {
    if (!d.t || !d.why) E(id, "distractor needs t and why");
    if (d.why && !/[֐-׿]/.test(d.why)) E(id, "distractor explanation must be in Hebrew: " + d.t);
    if (tgt && d.t && d.t.toLowerCase() === tgt[1].toLowerCase()) E(id, "distractor equals the answer: " + d.t);
  }
}

const inStages = new Map();
for (const w of course.worlds) for (const c of w.chapters) for (const s of c.stages) for (const i of s.items) {
  if (!ids.has(i)) E(s.id, "references missing item " + i);
  if (inStages.has(i)) E(s.id, "item " + i + " already in stage " + inStages.get(i));
  inStages.set(i, s.id);
}
for (const i of ids) if (!inStages.has(i)) W(i, "not placed in any stage");
for (const w of course.worlds) for (const c of w.chapters) if (c.icon && !ICONS.includes(c.icon)) E(c.id, "unknown icon " + c.icon);
for (const p of conf) { if (!ids.has(p.a) || !ids.has(p.b)) E("confusions", p.a + "|" + p.b + " references a missing item"); if (!p.a_note || !p.b_note) E("confusions", p.a + "|" + p.b + " needs both notes"); }

console.log("items: " + items.length + ", stages: " + [...new Set(inStages.values())].length + ", confusion pairs: " + conf.length);
warns.forEach(w => console.log("WARN  " + w));
errs.forEach(e => console.log("ERROR " + e));
console.log(errs.length ? "FAILED (" + errs.length + " errors)" : "OK");
process.exit(errs.length ? 1 : 0);
