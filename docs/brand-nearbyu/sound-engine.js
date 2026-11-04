// More notification sound candidates, each under a second, 44.1 kHz mono 16-bit WAV.
// Voices can glide in pitch (phase is integrated), wobble (vibrato) and carry breath noise.
const fs = require('fs');
const path = require('path');
const RATE = 44100;

function render(seconds, voices, { reverb = 0.25, gain = 0.85, seed = 7 } = {}) {
  const n = Math.round(RATE * seconds);
  const buf = new Float64Array(n);
  let rnd = seed;
  const noise = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 1073741824) - 1;
  for (const v of voices) {
    const start = Math.round(v.t * RATE);
    const phases = v.partials.map(() => 0);
    let lp = 0;
    for (let i = start; i < n; i++) {
      const t = (i - start) / RATE;
      const atk = Math.min(1, t / (v.attack ?? 0.004));
      // Pitch: optional glide from f to fTo over `glide` s, plus vibrato.
      let f = v.f;
      if (v.fTo) f = v.f + (v.fTo - v.f) * Math.min(1, t / v.glide) ** (v.curve ?? 1);
      if (v.vib) f *= 1 + v.vib.depth * Math.min(1, t / 0.12) * Math.sin(2 * Math.PI * v.vib.rate * t);
      let s = 0;
      v.partials.forEach(([mult, amp, decay], k) => {
        phases[k] += (2 * Math.PI * f * mult) / RATE;
        const env = Math.exp(-t / decay);
        if (env > 1e-4) s += amp * env * Math.sin(phases[k] + (v.buzz ? v.buzz * Math.sin(phases[k] * 2) * Math.exp(-t / 0.08) : 0));
      });
      if (v.breath) {
        lp += 0.15 * (noise() - lp);
        s += v.breath * lp * Math.exp(-t / (v.breathDecay ?? 0.3));
      }
      if (v.release && t > v.release) s *= Math.exp(-(t - v.release) / 0.05);
      buf[i] += v.amp * atk * s;
    }
  }
  if (reverb > 0) {
    const wet = new Float64Array(n);
    for (const [ms, fb] of [[29.7, 0.58], [37.1, 0.54], [41.1, 0.5], [43.7, 0.48]]) {
      const d = Math.round((ms / 1000) * RATE);
      const c = new Float64Array(n);
      for (let i = 0; i < n; i++) c[i] = buf[i] + (i >= d ? fb * c[i - d] : 0);
      for (let i = 0; i < n; i++) wet[i] += c[i] / 4;
    }
    for (let i = 0; i < n; i++) buf[i] = buf[i] * (1 - reverb) + wet[i] * reverb;
  }
  const fade = Math.round(0.1 * RATE);
  for (let i = 0; i < fade; i++) buf[n - 1 - i] *= i / fade;
  let peak = 0;
  for (const x of buf) peak = Math.max(peak, Math.abs(x));
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (buf[i] / peak) * gain)) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const N = (name) => {
  const map = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = name.match(/^([A-G])(#?)(\d)$/);
  return 440 * Math.pow(2, (map[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12) / 12);
};
const kal = (d = 0.3) => [[1, 1, d], [5.4, 0.12, 0.05], [2, 0.08, d * 0.4]];
const bell = (d = 0.5) => [[1, 1, d], [2.0, 0.45, d * 0.6], [2.76, 0.25, d * 0.4], [5.4, 0.1, d * 0.2]];

const out = {
  // Near-by-U: "near" and "by" two kalimba notes, then "U" — a sung note that slides up and settles.
  nearbyu: render(0.95, [
    { f: N('E6'), t: 0.0, amp: 0.75, partials: kal(0.25) },
    { f: N('G6'), t: 0.11, amp: 0.8, partials: kal(0.25) },
    { f: N('A6'), fTo: N('C7'), glide: 0.12, curve: 0.6, t: 0.22, amp: 0.85, attack: 0.02, partials: [[1, 1, 0.45], [2, 0.18, 0.25]], vib: { rate: 6, depth: 0.006 } },
  ]),
  // Temple bell: one deep, shimmering ghanta strike with its long beating hum.
  temple: render(0.98, [
    { f: N('A5'), t: 0, amp: 1, partials: [[1, 1, 0.7], [1.003, 0.6, 0.7], [2.32, 0.4, 0.35], [4.25, 0.2, 0.18], [6.63, 0.08, 0.1]], attack: 0.002 },
  ], { reverb: 0.3 }),
  // Bansuri: a short breathy flute phrase (Sa–Ga–Pa) with a gentle shake on the last note.
  bansuri: render(0.95, [
    { f: N('C6'), t: 0.0, amp: 0.6, attack: 0.03, release: 0.13, partials: [[1, 1, 2], [2, 0.12, 2], [3, 0.05, 2]], breath: 0.25, breathDecay: 0.1 },
    { f: N('E6'), t: 0.14, amp: 0.65, attack: 0.025, release: 0.13, partials: [[1, 1, 2], [2, 0.12, 2], [3, 0.05, 2]], breath: 0.2, breathDecay: 0.1 },
    { f: N('F6'), fTo: N('G6'), glide: 0.06, t: 0.28, amp: 0.8, attack: 0.03, release: 0.42, partials: [[1, 1, 2], [2, 0.12, 2], [3, 0.05, 2]], breath: 0.22, breathDecay: 0.15, vib: { rate: 5.5, depth: 0.012 } },
  ], { reverb: 0.3 }),
  // Veena: two bright plucks with the buzzing "jawari" tone and a slide into the second.
  veena: render(0.9, [
    { f: N('D5'), t: 0.0, amp: 0.8, attack: 0.002, buzz: 1.4, partials: [[1, 1, 0.35], [2, 0.6, 0.25], [3, 0.4, 0.18], [4, 0.25, 0.12]] },
    { f: N('G5'), fTo: N('A5'), glide: 0.08, t: 0.16, amp: 0.9, attack: 0.002, buzz: 1.4, partials: [[1, 1, 0.45], [2, 0.6, 0.3], [3, 0.4, 0.2], [4, 0.25, 0.14]] },
  ], { reverb: 0.2 }),
  // Tabla: a quick "ta-dhin" — a sharp tap, then the bass drum's rising "boom" under a ring.
  tabla: render(0.7, [
    { f: N('D6'), t: 0.0, amp: 0.7, attack: 0.001, partials: [[1, 1, 0.09], [1.5, 0.4, 0.05], [2.2, 0.3, 0.04]], breath: 0.5, breathDecay: 0.015 },
    { f: N('D6'), t: 0.12, amp: 0.65, attack: 0.001, partials: [[1, 1, 0.22], [2, 0.3, 0.1]], breath: 0.3, breathDecay: 0.012 },
    { f: 90, fTo: 150, glide: 0.18, curve: 0.5, t: 0.12, amp: 0.9, attack: 0.003, partials: [[1, 1, 0.3]] },
  ], { reverb: 0.15 }),
  // Tri-o-lo music box: the same three notes as the chosen sound, on a tiny tinkling music box.
  musicbox: render(0.9, [
    { f: N('G6'), t: 0.0, amp: 0.7, partials: bell(0.3), attack: 0.002 },
    { f: N('C7'), t: 0.12, amp: 0.75, partials: bell(0.3), attack: 0.002 },
    { f: N('E7'), t: 0.24, amp: 0.85, partials: bell(0.4), attack: 0.002 },
  ], { reverb: 0.25 }),
  // Ding-dong: a doorbell-style two-tone — somebody is here for you.
  dingdong: render(0.95, [
    { f: N('E6'), t: 0.0, amp: 0.9, partials: bell(0.45), attack: 0.002 },
    { f: N('C6'), t: 0.24, amp: 1.0, partials: bell(0.55), attack: 0.002 },
  ], { reverb: 0.2 }),
  // Water drop: two bubbly drops that bounce upward — light and playful.
  droplet: render(0.6, [
    { f: N('C6'), fTo: N('C7'), glide: 0.05, curve: 0.5, t: 0.0, amp: 0.8, attack: 0.001, partials: [[1, 1, 0.08]] },
    { f: N('G6'), fTo: N('G7'), glide: 0.05, curve: 0.5, t: 0.1, amp: 0.9, attack: 0.001, partials: [[1, 1, 0.12]] },
  ], { reverb: 0.25 }),
};

for (const [name, wav] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, `${name}.wav`), wav);
  console.log(name, (((wav.length - 44) / 2) / RATE).toFixed(2) + 's');
}
