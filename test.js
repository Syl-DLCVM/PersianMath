// Node test: lay out every formula in both directions with a heuristic measurer, then check the rules
// that are easy to break silently (digit order, and the D9–D12 rulings).
const assert = require('assert');
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

// ---- rule checks ----
const { N, V, O, R, FN, APP, FEN, PRIME, DIFF } = FARTL.T;
// every <text> in an SVG as { x, s }, in drawing order
const texts = svg => Array.from(svg.matchAll(/<text x="([\d.-]+)"[^>]*>([^<]*)<\/text>/g)).map(m => ({ x: parseFloat(m[1]), s: m[2] }));
const rtl = t => eng.render(t, 'rtl', { size: 30 }).svg;
const ltr = t => eng.render(t, 'ltr', { size: 30 }).svg;
const xOf = (svg, s) => { const t = texts(svg).find(t => t.s === s); assert(t, 'missing ' + s); return t.x; };

// D1 / R2.2: the most significant digit stands rightmost
{
  const svg = rtl(N(123));
  assert(xOf(svg, '۱') > xOf(svg, '۲') && xOf(svg, '۲') > xOf(svg, '۳'), 'D1: digit order');
}
// D9: the prime is the prime mark, left of its base in FA-RTL, and hamza is gone
{
  const svg = rtl(PRIME(V('f')));
  assert(!svg.includes('\u0654'), 'D9: no hamza modifier');
  assert(xOf(svg, '′') < xOf(svg, 'ت'), 'D9: prime at the left of the base');
  assert(rtl(PRIME(V('f'), 2)).includes('″') || rtl(PRIME(V('f'), 2)).includes('′′'), 'D9: second-order prime');
  assert.doesNotThrow(() => rtl(PRIME(FEN('(', ')', V('x')))), 'D9: prime on a non-identifier base');
  assert(ltr(PRIME(V('f'))).includes('′'), 'D9: INTL prime');
}
// D10: the alef-position identifier is آ, and no identifier role maps to bare ا
{
  assert(rtl(V('a')).includes('>آ<'), 'D10: a renders as آ');
  for (const [role, r] of Object.entries(FARTL.ROLES)) assert(r.fa !== 'ا', 'D10: role ' + role + ' maps to bare alef');
}
// D11: differential tokens
{
  assert(rtl(DIFF(V('x'))).includes('>تفا<'), 'D11: d is تفا');
  assert(rtl(DIFF(V('x'), true)).includes('>تفاج<'), 'D11: partial is تفاج');
  assert(ltr(DIFF(V('x'), true)).includes('∂'), 'D11: INTL partial');
}
// D12: every registered token shows a visible join; juxtaposed identifiers get the thin space
{
  assert(FARTL.hasVisibleJoin('جتا') && !FARTL.hasVisibleJoin('دت') && FARTL.hasVisibleJoin('دتر'), 'D12: join test');
  for (const tok of FARTL.registeredTokens()) assert(FARTL.hasVisibleJoin(tok), 'D12: token without a visible join: ' + tok);
  assert(rtl(APP(FN('det'), V('a'))).includes('>دتر<'), 'D12: det token');
  const w = t => eng.render(t, 'rtl', { size: 30 }).w;
  const pair = w(R(V('b'), V('c'))), single = w(V('b')) + w(V('c')) - 30;   // each render pads by size/2 on both sides
  assert(Math.abs((pair - single) - 0.16 * 30) < 0.01, 'D12: identifier gap is 0.16 em, got ' + (pair - single) / 30);
}
console.log('rule checks passed');
