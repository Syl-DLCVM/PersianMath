// Node smoke test: lay out every formula in both directions with a heuristic measurer.
const FARTL = require('./src/engine.js');
const FORMULAS = require('./src/formulas.js');
const fs = require('fs');

function measure(text, font, size) {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0x640) w += 0.28;
    else if ((cp >= 0x300 && cp <= 0x36F) || cp === 0x654 || cp === 0x653 || cp === 0x200C) w += 0;
    else if (cp >= 0x600 && cp <= 0x6FF) w += 0.55;
    else if (cp >= 0x1EE00) w += 0.6;
    else if (cp >= 0x1D400) w += 0.6;
    else w += 0.55;
  }
  return { w: w * size, a: 0.75 * size, d: 0.22 * size };
}
const eng = FARTL.createEngine(measure, { fonts: { naskh: { family: 'DejaVu Sans' }, digit: { family: 'DejaVu Sans', weight: 700 }, math: { family: 'DejaVu Sans' }, text: { family: 'DejaVu Sans' } } });
fs.mkdirSync('out', { recursive: true });
let ok = 0;
for (const f of FORMULAS) {
  for (const dir of ['rtl', 'ltr']) {
    const r = eng.render(f.tree, dir, { size: 30 });
    if (!/^<svg/.test(r.svg) || !(r.w > 0 && r.h > 0) || /NaN/.test(r.svg)) throw new Error('bad render ' + f.id + ' ' + dir);
    fs.writeFileSync(`out/${f.id}-${dir}.svg`, r.svg);
    ok++;
  }
}
console.log('rendered', ok, 'svgs');
