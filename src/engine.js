/* FA-RTL Phase 1 — layout engine. One semantic tree, two renderers (FA-RTL and INTL), SVG output.
   Pure module: inject a text measurer. Works in the browser (canvas measureText) and in Node (heuristic). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FARTL = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- symbol tables (the registry, Appendix A, reduced to what the ten formulas need) ---------- */
  const PD = '۰۱۲۳۴۵۶۷۸۹';
  const toPersianDigits = s => s.replace(/[0-9]/g, c => PD[c.charCodeAt(0) - 48]).replace(/\./g, '٫');

  // U+1EE00 Arabic Mathematical Alphabetic Symbols: styled letters by base letter (R3.4 / D6)
  const LOOPED = { 'ا': '\u{1EE80}', 'ب': '\u{1EE81}', 'ج': '\u{1EE82}', 'د': '\u{1EE83}', 'ه': '\u{1EE84}', 'و': '\u{1EE85}', 'ز': '\u{1EE86}', 'ح': '\u{1EE87}', 'ط': '\u{1EE88}', 'ی': '\u{1EE89}', 'ل': '\u{1EE8B}', 'م': '\u{1EE8C}', 'ن': '\u{1EE8D}', 'س': '\u{1EE8E}', 'ع': '\u{1EE8F}', 'ف': '\u{1EE90}', 'ص': '\u{1EE91}', 'ق': '\u{1EE92}', 'ر': '\u{1EE93}', 'ش': '\u{1EE94}', 'ت': '\u{1EE95}' };
  const DSTRUCK = { 'ب': '\u{1EEA1}', 'ج': '\u{1EEA2}', 'د': '\u{1EEA3}', 'و': '\u{1EEA5}', 'ز': '\u{1EEA6}', 'ح': '\u{1EEA7}', 'ط': '\u{1EEA8}', 'ی': '\u{1EEA9}', 'ل': '\u{1EEAB}', 'م': '\u{1EEAC}', 'ن': '\u{1EEAD}', 'س': '\u{1EEAE}', 'ع': '\u{1EEAF}', 'ف': '\u{1EEB0}', 'ص': '\u{1EEB1}', 'ق': '\u{1EEB2}', 'ر': '\u{1EEB3}' };
  const TAILED = { 'ج': '\u{1EE42}', 'ح': '\u{1EE47}', 'ی': '\u{1EE49}', 'ل': '\u{1EE4B}', 'ن': '\u{1EE4D}', 'س': '\u{1EE4E}', 'ع': '\u{1EE4F}', 'ص': '\u{1EE51}', 'ق': '\u{1EE52}', 'ش': '\u{1EE54}' };
  const STYLE_TABLE = { looped: LOOPED, dstruck: DSTRUCK, tailed: TAILED };

  // identifier roles → FA letter / INTL letter (L3 R3.3, D8 constants)
  const ROLES = {
    x: { fa: 'س', intl: 'x' }, y: { fa: 'ص', intl: 'y' }, z: { fa: 'ع', intl: 'z' },
    a: { fa: 'آ', intl: 'a' },                       // D10: bare ا is never an identifier
    b: { fa: 'ب', intl: 'b' }, c: { fa: 'ج', intl: 'c' }, d: { fa: 'د', intl: 'd' },
    n: { fa: 'ن', intl: 'n' }, m: { fa: 'م', intl: 'm' }, k: { fa: 'ک', intl: 'k' },
    i: { fa: 'ی', intl: 'i' }, j: { fa: 'ژ', intl: 'j' }, r: { fa: 'ر', intl: 'r' }, h: { fa: 'ح', intl: 'h' },
    u: { fa: 'و', intl: 'u' }, v: { fa: 'ف', intl: 'v' },
    f: { fa: 'ت', intl: 'f' }, g: { fa: 'ث', intl: 'g' },
    e: { fa: 'ن', intl: 'e', style: 'looped' },
    pi: { fa: 'پ', intl: 'π', style: 'looped' },
    ii: { fa: 'م', intl: 'i', style: 'looped' },
    phi: { fa: 'ز', intl: 'φ', style: 'looped' },
    theta: { fa: 'ع', intl: 'θ', style: 'tailed' }, lam: { fa: 'ل', intl: 'λ', style: 'tailed' },
    R: { fa: 'ح', intl: 'ℝ', style: 'dstruck' }, N: { fa: 'ط', intl: 'ℕ', style: 'dstruck' },
    inf: { fa: '∞', intl: '∞', sym: true }
  };
  const GREEK_IT = { 'π': '𝜋', 'θ': '𝜃', 'λ': '𝜆', 'μ': '𝜇', 'φ': '𝜑', 'σ': '𝜎', 'ω': '𝜔', 'α': '𝛼', 'β': '𝛽', 'γ': '𝛾' };
  function italicize(s) {
    return Array.from(s).map(c => {
      const code = c.charCodeAt(0);
      if (c === 'h') return 'ℎ';
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D44E + code - 97);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D434 + code - 65);
      return GREEK_IT[c] || c;
    }).join('');
  }

  // operators: g = glyph, m = mirrored glyph in RTL (R1.3, R1.9), fa = FA-specific glyph
  const OPS = {
    '+': { g: '+', cls: 'bin' }, '-': { g: '−', cls: 'bin' }, '*': { g: '×', cls: 'bin' }, 'cdot': { g: '⋅', cls: 'bin' }, 'pm': { g: '±', cls: 'bin' },
    '=': { g: '=', cls: 'rel' }, '<': { g: '<', m: '>', cls: 'rel' }, '>': { g: '>', m: '<', cls: 'rel' },
    '<=': { g: '≤', m: '≥', cls: 'rel' }, '>=': { g: '≥', m: '≤', cls: 'rel' }, '->': { g: '→', m: '←', cls: 'rel' },
    ',': { g: ',', fa: '،', cls: 'punct' }
  };
  const NAMES = { sin: { fa: 'جا', intl: 'sin' }, cos: { fa: 'جتا', intl: 'cos' }, tan: { fa: 'ظا', intl: 'tan' }, exp: { fa: 'نما', intl: 'exp' }, log: { fa: 'لگ', intl: 'log' }, det: { fa: 'دتر', intl: 'det' } };
  // differential tokens (D11): the first three letters of تفاضل, plus ج from جزئی
  const DIFFS = { d: { fa: 'تفا', intl: 'd' }, partial: { fa: 'تفاج', intl: '∂' } };
  const LIMIT = { fa: ['ح', 'د'], intl: 'lim' };
  // letter-operators (D5, Machrek precedent): [before tatweel, after tatweel]
  const BIGOPS = { sum: { fa: ['مج', ''], intl: '∑' }, int: { fa: ['ت', 'ک'], intl: '∫' }, prod: { fa: ['ض', ''], intl: '∏' } };
  const WORDS = { for: { fa: 'برای', intl: 'for' }, if: { fa: 'اگر', intl: 'if' }, otherwise: { fa: 'در غیر این صورت', intl: 'otherwise' } };
  // D12: every registered token must show at least one visible join, so it cannot read as a run of isolated variables
  const NON_JOINING = 'اآأإدذرزژوؤ';   // letters that never join to the letter after them
  const isJoinable = c => /[\u0622-\u064A\u066E-\u06D3]/.test(c) || c === 'ـ';
  function hasVisibleJoin(tok) {
    const cs = Array.from(tok);
    for (let i = 0; i < cs.length - 1; i++) if (isJoinable(cs[i]) && isJoinable(cs[i + 1]) && !NON_JOINING.includes(cs[i])) return true;
    return false;
  }
  function registeredTokens() {
    const out = [];
    Object.values(NAMES).forEach(n => out.push(n.fa));
    Object.values(DIFFS).forEach(n => out.push(n.fa));
    Object.values(BIGOPS).forEach(n => out.push(n.fa[0] + 'ـ' + n.fa[1]));   // letter-operators always carry a kashida
    out.push(LIMIT.fa[0] + 'ـ' + LIMIT.fa[1]);
    return out;
  }
  const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '|': '|', '‖': '‖', '⟨': '⟩', '⟩': '⟨' };

  /* ---------- tree constructors ---------- */
  const T = {
    N: v => ({ t: 'num', v: String(v) }),
    V: (role, style) => style ? { t: 'id', role, style } : { t: 'id', role },
    O: s => ({ t: 'op', s }),
    R: (...c) => ({ t: 'row', c }),
    F: (n, d) => ({ t: 'frac', n, d }),
    SUP: (b, e) => ({ t: 'sup', b, e }),
    SUB: (b, s) => ({ t: 'sub', b, s }),
    SS: (b, s, e) => ({ t: 'subsup', b, s, e }),
    SQRT: (r, i) => i ? { t: 'sqrt', r, i } : { t: 'sqrt', r },
    BIG: (op, lo, hi, body) => ({ t: 'big', op, lo, hi, body }),
    LIM: (sub, body) => ({ t: 'lim', sub, body }),
    FN: key => ({ t: 'name', key }),
    APP: (f, arg) => ({ t: 'app', f, arg }),
    FEN: (o, c, body) => ({ t: 'fence', o, c, body }),
    MAT: (rows, o, c) => ({ t: 'mat', rows, o: o || '[', c: c || ']' }),
    PRIME: (b, k) => (k && k > 1 ? { t: 'prime', b, k } : { t: 'prime', b }),
    DIFF: (v, partial) => (partial ? { t: 'diff', v, partial: true } : { t: 'diff', v }),
    TXT: key => ({ t: 'txt', key })
  };

  /* ---------- engine ---------- */
  function createEngine(measure, cfg) {
    cfg = Object.assign({
      size: 30,
      colors: { ink: '#1c1a17', digit: '#0b6b6a', dbg: '#d9a7a7' },
      fonts: {
        naskh: { family: "'FA Naskh'" },                 // Persian letters, shaped tokens, kashida
        digit: { family: "'FA Digit'", weight: 600 },    // the marked digit face (D4)
        math: { family: "'FA Math'" },                   // symbols, INTL letters, U+1EE00 styled letters
        text: { family: "'FA Math'" }
      }
    }, cfg || {});
    const FT = cfg.fonts, ink = cfg.colors.ink;
    const num = v => Math.round(v * 100) / 100;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function dbgRect(out, x, y, b) {
      out.push(`<rect x="${num(x)}" y="${num(y - b.a)}" width="${num(b.w)}" height="${num(b.a + b.d)}" fill="none" stroke="${cfg.colors.dbg}" stroke-width="0.6"/>`);
    }
    function tbox(str, font, size, o) {
      o = o || {};
      const m = measure(str, font, size);
      const b = { w: m.w, a: m.a, d: m.d, cls: o.cls || 'ord' };
      b.draw = (out, x, y, S) => {
        out.push(`<text x="${num(x)}" y="${num(y)}" font-family="${font.family}" font-size="${num(size)}"` +
          (font.weight ? ` font-weight="${font.weight}"` : '') + (o.fill ? ` fill="${o.fill}"` : '') + `>${esc(str)}</text>`);
        if (S.dbg) dbgRect(out, x, y, b);
      };
      return b;
    }
    const withCls = (b, cls) => Object.assign({}, b, { cls });

    // inter-box spacing in em (TeX-like, reduced)
    function gap(l, r, S) {
      const L = l.cls, R = r.cls, bin = S.disp ? 0.22 : 0.17, rel = S.disp ? 0.3 : 0.22;
      if (L === 'digit' && R === 'digit') return 0;
      if (L === 'punct') return 0.22;
      if (R === 'punct') return 0;
      if (L === 'bin' || R === 'bin') return bin;
      if (L === 'rel' || R === 'rel') return rel;
      if (L === 'txt' || R === 'txt') return 0.3;
      if (L === 'open' || R === 'close') return 0.02;
      if (R === 'prime') return 0.02;
      if (R === 'diff') return 0.17;                                   // thin space before a differential
      if (S.dir === 'rtl' && L === 'id' && R === 'id') return 0.16;    // D12: juxtaposed identifiers must not read as a word
      if (L === 'fn' || L === 'op') return 0.14;
      if (L === 'close') return 0.08;
      return 0.07;
    }
    // horizontal list in reading order; RTL places the first item rightmost (R1.1)
    function hlist(items, S, cls) {
      const em = S.size, gaps = []; let w = 0;
      items.forEach((b, i) => { const g = i ? gap(items[i - 1], b, S) * em : 0; gaps.push(g); w += g + b.w; });
      const a = Math.max(0, ...items.map(b => b.a)), d = Math.max(0, ...items.map(b => b.d));
      const box = { w, a, d, cls: cls || 'inner' };
      box.draw = (out, x, y, S2) => {
        let cur = 0;
        items.forEach((b, i) => { cur += gaps[i]; const px = S.dir === 'rtl' ? x + w - cur - b.w : x + cur; b.draw(out, px, y, S2); cur += b.w; });
        if (S2.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    // shift a box so that its vertical centre sits on the math axis (big operators, fences)
    function onAxis(b, S, center) {
      const axis = center === undefined ? S.size * 0.26 : center;
      const shift = (b.a - b.d) / 2 - axis; // move baseline down by shift
      return { w: b.w, a: b.a - shift, d: b.d + shift, cls: b.cls, draw: (out, x, y, S2) => b.draw(out, x, y + shift, S2) };
    }
    const scriptState = S => Object.assign({}, S, { disp: false, size: Math.max(S.size * 0.7, 11) });
    const limitState = S => Object.assign({}, S, { disp: false, size: Math.max(S.size * 0.62, 10) });

    /* ----- leaves ----- */
    function layNum(n, S) {
      if (S.dir === 'ltr') return tbox(n.v, FT.math, S.size, { cls: 'ord' });
      // FA: Persian digits in the marked face, most significant digit rightmost (R2.2, D4)
      const items = Array.from(toPersianDigits(n.v)).map(ch => tbox(ch, FT.digit, S.size, { cls: 'digit', fill: cfg.colors.digit }));
      return hlist(items, S, 'ord');
    }
    function layId(n, S) {
      const r = ROLES[n.role]; if (!r) throw new Error('unknown role ' + n.role);
      if (r.sym) return tbox(r.fa, FT.math, S.size, { cls: 'ord' });
      if (S.dir === 'ltr') return tbox(italicize(r.intl), FT.math, S.size, { cls: 'id' });
      const style = n.style || r.style || 'iso';
      if (style === 'iso') return tbox(r.fa, FT.naskh, S.size, { cls: 'id' });
      const g = STYLE_TABLE[style] && STYLE_TABLE[style][r.fa];
      if (g) return tbox(g, FT.math, S.size, { cls: 'id' });
      // declared fallback (D6, L0.6): plain letter plus a style mark, never a silent substitution
      const b = tbox(r.fa, FT.naskh, S.size, { cls: 'ord' });
      const em = S.size, rr = em * 0.11, sw = em * 0.05;
      const box = { w: b.w + rr * 2, a: b.a, d: Math.max(b.d, rr * 1.2), cls: 'id' };
      box.draw = (out, x, y, S2) => {
        b.draw(out, x + rr * 2, y, S2);
        if (style === 'looped') {
          // a loop on the stroke at the letter's left end, where the looped forms of U+1EE80–1EE9B carry theirs
          out.push(`<circle cx="${num(x + rr)}" cy="${num(y - rr * 0.2)}" r="${num(rr)}" fill="none" stroke="${ink}" stroke-width="${num(sw)}"/>`);
        } else if (style === 'dstruck') {
          out.push(`<line x1="${num(x + rr * 0.6)}" y1="${num(y - em * 0.55)}" x2="${num(x + rr * 0.6)}" y2="${num(y)}" stroke="${ink}" stroke-width="${num(sw)}"/><line x1="${num(x + rr * 1.5)}" y1="${num(y - em * 0.55)}" x2="${num(x + rr * 1.5)}" y2="${num(y)}" stroke="${ink}" stroke-width="${num(sw)}"/>`);
        } else {
          out.push(`<path d="M${num(x + rr * 2)} ${num(y)} q ${num(-rr)} ${num(rr * 1.6)} ${num(-rr * 2)} ${num(rr * 0.4)}" fill="none" stroke="${ink}" stroke-width="${num(sw)}"/>`);
        }
        if (S2.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    function layOp(n, S) {
      const o = OPS[n.s]; if (!o) throw new Error('unknown op ' + n.s);
      let g = o.g, font = FT.math;
      if (S.dir === 'rtl') { if (o.m) g = o.m; if (o.fa) { g = o.fa; font = FT.naskh; } }
      return tbox(g, font, S.size, { cls: o.cls });
    }
    function layName(n, S) {
      const nm = NAMES[n.key]; if (!nm) throw new Error('unknown name ' + n.key);
      return S.dir === 'ltr' ? tbox(nm.intl, FT.text, S.size, { cls: 'fn' }) : tbox(nm.fa, FT.naskh, S.size, { cls: 'fn' });
    }
    function layTxt(n, S) {
      const wd = WORDS[n.key]; if (!wd) throw new Error('unknown word ' + n.key);
      return S.dir === 'ltr' ? tbox(wd.intl, FT.text, S.size * 0.85, { cls: 'txt' }) : tbox(wd.fa, FT.naskh, S.size * 0.95, { cls: 'txt' });
    }

    /* ----- composites ----- */
    function layRow(n, S) {
      const items = [];
      n.c.forEach((ch, i) => {
        let b = lay(ch, S);
        const prev = items[items.length - 1];
        if (b.cls === 'bin' && (i === 0 || ['bin', 'rel', 'open', 'punct', 'op', 'txt'].includes(prev.cls))) b = withCls(b, 'ord'); // unary sign (R2.6)
        items.push(b);
      });
      return hlist(items, S, 'inner');
    }
    function layFrac(n, S) {
      const S2 = Object.assign({}, S, { disp: false, size: S.disp ? S.size : S.size * 0.85 });
      const N_ = lay(n.n, S2), D_ = lay(n.d, S2);
      const em = S.size, th = em * 0.055, axis = em * 0.26, gv = em * 0.14, pad = em * 0.12;
      const w = Math.max(N_.w, D_.w) + 2 * pad;
      const a = axis + th / 2 + gv + N_.d + N_.a, d = -axis + th / 2 + gv + D_.a + D_.d;
      const box = { w, a, d, cls: 'inner' };
      box.draw = (out, x, y, S3) => {
        const yb = y - axis;
        out.push(`<line x1="${num(x + pad * 0.3)}" y1="${num(yb)}" x2="${num(x + w - pad * 0.3)}" y2="${num(yb)}" stroke="${ink}" stroke-width="${num(th)}"/>`);
        N_.draw(out, x + (w - N_.w) / 2, yb - th / 2 - gv - N_.d, S3);
        D_.draw(out, x + (w - D_.w) / 2, yb + th / 2 + gv + D_.a, S3);
        if (S3.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    // super- and subscripts follow the base in reading order: right of it in INTL, left of it in FA-RTL (R1.4)
    function layScripts(n, S) {
      const B = lay(n.b, S), Ss = scriptState(S);
      const E = n.e ? lay(n.e, Ss) : null, U = n.s ? lay(n.s, Ss) : null;
      const em = S.size, k = em * 0.05;
      const up = Math.max(B.a * 0.6 + em * 0.08, em * 0.42), down = Math.max(B.d + em * 0.12, em * 0.22);
      const sw = Math.max(E ? E.w : 0, U ? U.w : 0);
      const w = B.w + k + sw;
      const a = Math.max(B.a, E ? up + E.a : 0), d = Math.max(B.d, U ? down + U.d : 0);
      const box = { w, a, d, cls: B.cls === 'id' ? 'id' : 'ord' };   // a scripted identifier is still an identifier
      box.draw = (out, x, y, S3) => {
        const rtl = S.dir === 'rtl';
        const bx = rtl ? x + sw + k : x, sx = rtl ? x : x + B.w + k;
        B.draw(out, bx, y, S3);
        if (E) E.draw(out, rtl ? sx + sw - E.w : sx, y - up, S3);
        if (U) U.draw(out, rtl ? sx + sw - U.w : sx, y + down, S3);
        if (S3.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    // radical: sign on the left (INTL) or on the right, mirrored, with the vinculum extending leftward (R1.7)
    function laySqrt(n, S) {
      const Rd = lay(n.r, S), em = S.size, th = em * 0.055, gv = em * 0.14;
      const H = Rd.a + Rd.d + gv + th;
      const signW = em * 0.6 + Math.max(0, H - em) * 0.12;
      const idx = n.i ? lay(n.i, Object.assign({}, S, { disp: false, size: Math.max(S.size * 0.55, 10) })) : null;
      const idxW = idx ? Math.max(0, idx.w - signW * 0.4) : 0;
      const sep = em * 0.08;
      const w = idxW + signW + sep + Rd.w + em * 0.04;
      const a = Rd.a + gv + th, d = Rd.d;
      const box = { w, a, d, cls: 'ord' };
      box.draw = (out, x, y, S3) => {
        const rtl = S.dir === 'rtl';
        const yt = y - a + th / 2, yb = y + Rd.d + th / 2;
        const x0 = rtl ? x + em * 0.04 + Rd.w + sep : x + idxW;      // left edge of the sign
        let pts = [[x0 + signW * 0.04, yb - (yb - yt) * 0.52], [x0 + signW * 0.26, yb - (yb - yt) * 0.62], [x0 + signW * 0.5, yb], [x0 + signW * 0.96, yt]];
        if (rtl) { const cx = x0 + signW / 2; pts = pts.map(p => [2 * cx - p[0], p[1]]); }
        const path = 'M' + pts.map(p => num(p[0]) + ' ' + num(p[1])).join(' L ');
        const vin = rtl ? `M${num(pts[3][0])} ${num(yt)} L ${num(x)} ${num(yt)}` : `M${num(pts[3][0])} ${num(yt)} L ${num(x + w)} ${num(yt)}`;
        out.push(`<path d="${path}" fill="none" stroke="${ink}" stroke-width="${num(th)}" stroke-linejoin="miter"/>`);
        out.push(`<path d="${vin}" fill="none" stroke="${ink}" stroke-width="${num(th)}"/>`);
        Rd.draw(out, rtl ? x + em * 0.02 : x0 + signW + sep, y, S3);
        if (idx) idx.draw(out, rtl ? x0 + signW * 0.55 : x + idxW + signW * 0.4 - idx.w, yb - (yb - yt) * 0.62 - em * 0.08, S3);
        if (S3.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    // a joined letter-operator stretched by kashida to a target width (D5, L7)
    function kashida(pre, post, targetW, size) {
      // the first tatweel changes the joining form of the letter before it, so measure the increment between one and two
      const one = measure(pre + 'ـ' + post, FT.naskh, size), two = measure(pre + 'ــ' + post, FT.naskh, size);
      const tw = Math.max(two.w - one.w, size * 0.08);
      const k = 1 + Math.max(0, Math.ceil((targetW - one.w) / tw));
      return tbox(pre + 'ـ'.repeat(k) + post, FT.naskh, size, { cls: 'op' });
    }
    function stackLimits(sym, lo, hi, S) {
      const em = S.size, g = em * 0.12;
      const w = Math.max(sym.w, lo ? lo.w : 0, hi ? hi.w : 0);
      const a = sym.a + (hi ? g + hi.d + hi.a : 0), d = sym.d + (lo ? g + lo.a + lo.d : 0);
      const box = { w, a, d, cls: 'op' };
      box.draw = (out, x, y, S3) => {
        sym.draw(out, x + (w - sym.w) / 2, y, S3);
        if (hi) hi.draw(out, x + (w - hi.w) / 2, y - sym.a - g - hi.d, S3);
        if (lo) lo.draw(out, x + (w - lo.w) / 2, y + sym.d + g + lo.a, S3);
        if (S3.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    function sideLimits(sym, lo, hi, S) { // INTL integral: limits as scripts to the right
      const em = S.size, k = em * 0.04;
      const sw = Math.max(lo ? lo.w : 0, hi ? hi.w : 0);
      const up = sym.a - (hi ? hi.a : 0) - em * 0.1, down = sym.d - (lo ? lo.d : 0) + em * 0.05;
      const w = sym.w + k + sw, a = Math.max(sym.a, hi ? up + hi.a : 0), d = Math.max(sym.d, lo ? down + lo.d : 0);
      const box = { w, a, d, cls: 'op' };
      box.draw = (out, x, y, S3) => {
        sym.draw(out, x, y, S3);
        if (hi) hi.draw(out, x + sym.w + k, y - up, S3);
        if (lo) lo.draw(out, x + sym.w * 0.75 + k, y + down, S3);
        if (S3.dbg) dbgRect(out, x, y, box);
      };
      return box;
    }
    function layBig(n, S) {
      const em = S.size, Ls = limitState(S);
      const lo = n.lo ? lay(n.lo, Ls) : null, hi = n.hi ? lay(n.hi, Ls) : null;
      const body = lay(n.body, S);
      let opBox;
      if (S.dir === 'ltr') {
        const spec = BIGOPS[n.op];
        const sym = onAxis(tbox(spec.intl, FT.math, em * (n.op === 'int' ? 1.9 : 1.5), { cls: 'op' }), S);
        opBox = n.op === 'int' ? sideLimits(sym, lo, hi, S) : stackLimits(sym, lo, hi, S);
      } else {
        const [pre, post] = BIGOPS[n.op].fa;
        const target = Math.max(lo ? lo.w : 0, hi ? hi.w : 0, em * 1.5);
        const sym = onAxis(kashida(pre, post, target, em * 1.1), S);
        opBox = stackLimits(sym, lo, hi, S);                 // the token stretches as a whole and carries its bounds (D5)
      }
      return hlist([opBox, body], S, 'inner');
    }
    function layLim(n, S) {
      const em = S.size, sub = lay(n.sub, limitState(S)), body = lay(n.body, S);
      const sym = S.dir === 'ltr' ? tbox(LIMIT.intl, FT.text, em, { cls: 'op' }) : kashida(LIMIT.fa[0], LIMIT.fa[1], sub.w, em); // حد stretched to its underscript (W3C note, Persian style)
      return hlist([stackLimits(sym, sub, null, S), body], S, 'inner');
    }
    function fenceBox(o, c, body, S) {
      const em = S.size, rtl = S.dir === 'rtl';
      const h = body.a + body.d, scale = Math.max(1, h / em);
      const og = rtl ? MIRROR[o] : o, cg = rtl ? MIRROR[c] : c;          // R1.2: the opening fence faces the body from the right
      const center = (body.a - body.d) / 2;
      const O_ = onAxis(tbox(og, FT.math, em * scale, { cls: 'open' }), S, center);
      const C_ = onAxis(tbox(cg, FT.math, em * scale, { cls: 'close' }), S, center);
      return hlist([withCls(O_, 'open'), body, withCls(C_, 'close')], S, 'ord');
    }
    const layFence = (n, S) => fenceBox(n.o, n.c, lay(n.body, S), S);
    function layApp(n, S) {
      const fn = withCls(lay(n.f, S), 'fn');
      return hlist([fn, fenceBox('(', ')', lay(n.arg, S), S)], S, 'ord');
    }
    // matrices: first column at the right in FA-RTL (R1.10)
    function layMat(n, S) {
      const S2 = Object.assign({}, S, { disp: false });
      const cells = n.rows.map(r => r.map(c => lay(c, S2)));
      const nr = cells.length, nc = Math.max(...cells.map(r => r.length));
      const em = S.size, cg = em * 0.7, rg = em * 0.35;
      const colW = Array.from({ length: nc }, (_, j) => Math.max(...cells.map(r => r[j] ? r[j].w : 0)));
      const rowA = cells.map(r => Math.max(...r.map(c => c.a))), rowD = cells.map(r => Math.max(...r.map(c => c.d)));
      const w = colW.reduce((s, v) => s + v, 0) + cg * (nc - 1);
      const H = rowA.reduce((s, v, i) => s + v + rowD[i], 0) + rg * (nr - 1);
      const axis = em * 0.26, a = H / 2 + axis, d = H / 2 - axis;
      const inner = { w, a, d, cls: 'inner' };
      inner.draw = (out, x, y, S3) => {
        let yy = y - a;
        cells.forEach((r, i) => {
          const base = yy + rowA[i]; let xx = 0;
          r.forEach((c, j) => {
            const cx = S.dir === 'rtl' ? x + w - xx - colW[j] : x + xx;
            c.draw(out, cx + (colW[j] - c.w) / 2, base, S3);
            xx += colW[j] + cg;
          });
          yy += rowA[i] + rowD[i] + rg;
        });
        if (S3.dbg) dbgRect(out, x, y, inner);
      };
      const padded = { w: inner.w + em * 0.2, a: inner.a + em * 0.1, d: inner.d + em * 0.1, cls: 'inner', draw: (out, x, y, S3) => inner.draw(out, x + em * 0.1, y, S3) };
      return fenceBox(n.o, n.c, padded, S);
    }
    // derivative mark (D9): the ordinary prime, unmirrored, following the base in reading order,
    // so it sits at the upper left in FA-RTL and the upper right in INTL; any base, any order
    function layPrime(n, S) {
      const B = lay(n.b, S), P = tbox('′'.repeat(n.k || 1), FT.math, S.size, { cls: 'prime' });
      return hlist([B, P], S, B.cls === 'id' ? 'id' : 'ord');
    }
    function layDiff(n, S) {
      const v = lay(n.v, S), spec = DIFFS[n.partial ? 'partial' : 'd'];
      const tok = S.dir === 'ltr' ? tbox(n.partial ? spec.intl : italicize(spec.intl), FT.math, S.size, { cls: 'ord' }) : tbox(spec.fa, FT.naskh, S.size, { cls: 'fn' });
      return hlist([tok, v], S, 'diff');
    }

    function lay(n, S) {
      switch (n.t) {
        case 'num': return layNum(n, S);
        case 'id': return layId(n, S);
        case 'op': return layOp(n, S);
        case 'row': return layRow(n, S);
        case 'frac': return layFrac(n, S);
        case 'sup': case 'sub': case 'subsup': return layScripts(n, S);
        case 'sqrt': return laySqrt(n, S);
        case 'big': return layBig(n, S);
        case 'lim': return layLim(n, S);
        case 'name': return layName(n, S);
        case 'app': return layApp(n, S);
        case 'fence': return layFence(n, S);
        case 'mat': return layMat(n, S);
        case 'prime': return layPrime(n, S);
        case 'diff': return layDiff(n, S);
        case 'txt': return layTxt(n, S);
        default: throw new Error('unknown node ' + n.t);
      }
    }

    function render(node, dir, opts) {
      opts = opts || {};
      const size = opts.size || cfg.size;
      const S = { size, dir, disp: true, dbg: !!opts.dbg };
      const box = lay(node, S);
      const pad = size * 0.5, W = box.w + 2 * pad, H = box.a + box.d + 2 * pad;
      const out = [];
      box.draw(out, pad, pad + box.a, S);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(W)}" height="${num(H)}" fill="${ink}" role="img">${out.join('')}</svg>`;
      return { svg, w: W, h: H };
    }
    return { render, lay };
  }

  return { createEngine, T, ROLES, OPS, NAMES, BIGOPS, DIFFS, LIMIT, toPersianDigits, italicize, hasVisibleJoin, registeredTokens };
});
