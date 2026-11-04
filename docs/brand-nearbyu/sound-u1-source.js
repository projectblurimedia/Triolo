// Six refined "Near-by-U" notification sounds: the name as a three-step melody (near · by · U),
// with richer layered tones. Each under a second, 44.1 kHz mono 16-bit WAV.
const fs = require('fs');
const path = require('path');
const engine = fs.readFileSync(path.join(__dirname, 'make2.js'), 'utf8').split('const out = {')[0];
// Top-level consts in eval stay inside it, so they become var to be shared here.
eval(engine.replace("const fs = require('fs');\nconst path = require('path');", '').replace(/^const (RATE|N) =/gm, 'var $1 ='));

// Layered timbres: each instrument is a set of [multiple, amount, decay] partials.
const marimba = (d = 0.24) => [[1, 1, d], [1.003, 0.5, d], [4, 0.22, 0.03], [10, 0.04, 0.01]];
const softBell = (d = 0.6) => [[1, 1, d], [2.0, 0.35, d * 0.6], [3.01, 0.12, d * 0.35], [5.4, 0.05, d * 0.18]];
const kalimba = (d = 0.32) => [[1, 1, d], [1.004, 0.4, d], [5.4, 0.1, 0.05], [2, 0.08, d * 0.4]];
const celesta = (d = 0.4) => [[1, 1, d], [2, 0.3, d * 0.5], [4, 0.12, d * 0.25], [8.2, 0.05, 0.05]];
const glass = (d = 0.45) => [[1, 1, d], [2.002, 0.2, d * 0.6], [3, 0.1, d * 0.35], [6.3, 0.05, d * 0.15]];
// A soft "oo": almost a pure tone with a little second harmonic, slow attack and a breath.
const oo = (d = 2) => [[1, 1, d], [2, 0.22, d], [3, 0.04, d]];
// A warm chord that swells in under the last note.
const pad = (notes, t, amp, release) => notes.map((n) => ({ f: N(n), t, amp, attack: 0.09, release, partials: [[1, 1, 3], [2, 0.12, 3]] }));

const SOUNDS = {
  // U1: marimba "near · by", then the U on marimba + bell, with a warm C-major chord blooming under it.
  u1: render(0.98, [
    { f: N('E5'), t: 0.0, amp: 0.75, attack: 0.002, partials: marimba(0.2) },
    { f: N('G5'), t: 0.12, amp: 0.8, attack: 0.002, partials: marimba(0.2) },
    { f: N('C6'), fTo: N('E6'), glide: 0.12, curve: 0.5, t: 0.25, amp: 0.85, attack: 0.004, partials: softBell(0.55) },
    { f: N('C6'), t: 0.25, amp: 0.45, attack: 0.002, partials: marimba(0.3) },
    ...pad(['C5', 'E5', 'G5'], 0.24, 0.09, 0.55),
  ], { reverb: 0.3 }),
  // U2: kalimba "near · by" (like Tri-o-lo), then the U as a shimmering bell that rings on.
  u2: render(0.98, [
    { f: N('G5'), t: 0.0, amp: 0.75, attack: 0.002, partials: kalimba(0.26) },
    { f: N('C6'), t: 0.12, amp: 0.8, attack: 0.002, partials: kalimba(0.26) },
    { f: N('E6'), t: 0.25, amp: 0.9, attack: 0.003, partials: softBell(0.6), vib: { rate: 5, depth: 0.003 } },
    { f: N('G6'), t: 0.27, amp: 0.25, attack: 0.003, partials: softBell(0.5) },
  ], { reverb: 0.32 }),
  // U3: marimba "near · by", then the U sung as a soft voice-like "oo" that rises gently.
  u3: render(0.98, [
    { f: N('E5'), t: 0.0, amp: 0.7, attack: 0.002, partials: marimba(0.2) },
    { f: N('G5'), t: 0.12, amp: 0.75, attack: 0.002, partials: marimba(0.2) },
    { f: N('B5'), fTo: N('E6'), glide: 0.16, curve: 0.55, t: 0.25, amp: 0.9, attack: 0.04, release: 0.55, partials: oo(), breath: 0.05, breathDecay: 0.2, vib: { rate: 5.5, depth: 0.008 } },
    ...pad(['C5', 'E5'], 0.25, 0.07, 0.55),
  ], { reverb: 0.34 }),
  // U4: celesta and glass — light and sparkling, ending on a bright lifted U.
  u4: render(0.95, [
    { f: N('G5'), t: 0.0, amp: 0.65, attack: 0.002, partials: celesta(0.3) },
    { f: N('B5'), t: 0.11, amp: 0.7, attack: 0.002, partials: celesta(0.3) },
    { f: N('D6'), fTo: N('E6'), glide: 0.1, curve: 0.6, t: 0.23, amp: 0.85, attack: 0.002, partials: glass(0.5) },
    { f: N('B6'), t: 0.26, amp: 0.2, attack: 0.002, partials: glass(0.3) },
  ], { reverb: 0.34 }),
  // U5: a calling tune — "near-by-U-hoo", the way you call someone's name (up, then a friendly fall).
  u5: render(0.98, [
    { f: N('G5'), t: 0.0, amp: 0.7, attack: 0.002, partials: marimba(0.2) },
    { f: N('A5'), t: 0.12, amp: 0.75, attack: 0.002, partials: marimba(0.2) },
    { f: N('C6'), t: 0.24, amp: 0.85, attack: 0.004, release: 0.2, partials: softBell(0.5) },
    { f: N('A5'), t: 0.43, amp: 0.8, attack: 0.004, partials: softBell(0.55) },
  ], { reverb: 0.3 }),
  // U6: warm and low "near · by", then a sweet high U that lifts at the end.
  u6: render(0.98, [
    { f: N('C5'), t: 0.0, amp: 0.75, attack: 0.002, partials: marimba(0.26) },
    { f: N('G5'), t: 0.13, amp: 0.8, attack: 0.002, partials: marimba(0.24) },
    { f: N('E6'), fTo: N('G6'), glide: 0.18, curve: 0.45, t: 0.27, amp: 0.85, attack: 0.004, partials: softBell(0.55) },
    ...pad(['C5', 'G5'], 0.27, 0.08, 0.55),
  ], { reverb: 0.3 }),
};

for (const [name, wav] of Object.entries(SOUNDS)) {
  fs.writeFileSync(path.join(__dirname, `${name}.wav`), wav);
  console.log(name, (((wav.length - 44) / 2) / RATE).toFixed(2) + 's');
}
