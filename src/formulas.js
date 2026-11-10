/* The ten canonical formulas of Phase 1 (L7), as semantic trees. One tree each; both renderers read it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.FARTL_FORMULAS = factory(root.FARTL);
})(typeof self !== 'undefined' ? self : this, function (FARTL) {
  'use strict';
  const { N, V, O, R, F, SUP, SUB, SS, SQRT, BIG, LIM, FN, APP, FEN, MAT, PRIME, DIFF, TXT } = FARTL.T;

  const sumK = (lo, hi, body) => BIG('sum', R(V('k'), O('='), N(lo)), hi, body);

  return [
    {
      id: 'quadratic', name: { en: 'Quadratic formula', fa: 'فرمول حل معادلهٔ درجهٔ دوم' },
      shows: { en: 'fraction, mirrored radical, unary sign, coefficient letters ا ب ج', fa: 'کسر، رادیکال آینه‌شده، علامت یگانی، ضرایب ا ب ج' },
      tree: R(V('x'), O('='), F(R(O('-'), V('b'), O('pm'), SQRT(R(SUP(V('b'), N(2)), O('-'), N(4), V('a'), V('c')))), R(N(2), V('a'))))
    },
    {
      id: 'binomial', name: { en: 'Binomial theorem', fa: 'قضیهٔ دوجمله‌ای' },
      shows: { en: 'مجـ stretched to its bounds, binomial coefficient, superscripts at the upper left', fa: 'مجـ کشیده به پهنای کران‌ها، ضریب دوجمله‌ای، توان‌ها در بالا-چپ' },
      tree: R(SUP(FEN('(', ')', R(V('x'), O('+'), V('y'))), V('n')), O('='), sumK(0, V('n'), R(MAT([[V('n')], [V('k')]], '(', ')'), SUP(V('x'), R(V('n'), O('-'), V('k'))), SUP(V('y'), V('k')))))
    },
    {
      id: 'euler', name: { en: 'Euler’s identity', fa: 'اتحاد اویلر' },
      shows: { en: 'looped constants: ن (e), م (i), پ (π) — پ is unencoded, so it renders through the declared fallback', fa: 'ثابت‌های حلقه‌دار: ن، م، پ — پ رمزگذاری نشده و با جایگزین اعلام‌شده نمایش داده می‌شود' },
      tree: R(SUP(V('e'), R(V('ii'), V('pi'))), O('+'), N(1), O('='), N(0))
    },
    {
      id: 'derivative', name: { en: 'Definition of the derivative', fa: 'تعریف مشتق' },
      shows: { en: 'hamza as prime, حد stretched to its underscript, arrow flipped to reading direction', fa: 'همزه به‌جای پریم، حد کشیده به پهنای زیرنویس، پیکان در جهت خواندن' },
      tree: R(APP(PRIME(V('f')), V('x')), O('='), LIM(R(V('h'), O('->'), N(0)), F(R(APP(V('f'), R(V('x'), O('+'), V('h'))), O('-'), APP(V('f'), V('x'))), V('h'))))
    },
    {
      id: 'ftc', name: { en: 'Fundamental theorem of calculus', fa: 'قضیهٔ اساسی تفاضل و تکامل' },
      shows: { en: 'تک with bounds above and below, تف as the differential token', fa: 'تک با کران‌های بالا و پایین، تف به‌عنوان نشانهٔ دیفرانسیل' },
      tree: R(BIG('int', V('a'), V('b'), R(APP(PRIME(V('f')), V('x')), DIFF(V('x')))), O('='), APP(V('f'), V('b')), O('-'), APP(V('f'), V('a')))
    },
    {
      id: 'gauss', name: { en: 'Gaussian integral', fa: 'انتگرال گاوسی' },
      shows: { en: 'negative bound, nested superscripts, radical over a constant', fa: 'کران منفی، توان تودرتو، رادیکال روی ثابت' },
      tree: R(BIG('int', R(O('-'), V('inf')), V('inf'), R(SUP(V('e'), R(O('-'), SUP(V('x'), N(2)))), DIFF(V('x')))), O('='), SQRT(V('pi')))
    },
    {
      id: 'matrix', name: { en: 'Matrix times vector', fa: 'ضرب ماتریس در بردار' },
      shows: { en: 'first column at the right, mirrored brackets, juxtaposition', fa: 'ستون اول در راست، کروشه‌های آینه‌شده، هم‌جواری' },
      tree: R(MAT([[V('a'), V('b')], [V('c'), V('d')]]), MAT([[V('x')], [V('y')]]), O('='), MAT([[R(V('a'), V('x'), O('+'), V('b'), V('y'))], [R(V('c'), V('x'), O('+'), V('d'), V('y'))]]))
    },
    {
      id: 'pythagoras', name: { en: 'Pythagoras', fa: 'قضیهٔ فیثاغورس' },
      shows: { en: 'the simplest case: letters, marked digits, symmetric operators', fa: 'ساده‌ترین حالت: حروف، رقم‌های نشان‌دار، عملگرهای متقارن' },
      tree: R(SUP(V('a'), N(2)), O('+'), SUP(V('b'), N(2)), O('='), SUP(V('c'), N(2)))
    },
    {
      id: 'geometric', name: { en: 'Geometric series', fa: 'سری هندسی' },
      shows: { en: 'infinite bound, Persian comma, a shaped word, mirrored relation sign', fa: 'کران بی‌نهایت، ویرگول فارسی، واژهٔ شکل‌گرفته، نشانهٔ رابطهٔ آینه‌شده' },
      tree: R(sumK(0, V('inf'), SUP(V('r'), V('k'))), O('='), F(N(1), R(N(1), O('-'), V('r'))), O(','), TXT('for'), FEN('|', '|', V('r')), O('<'), N(1))
    },
    {
      id: 'cauchy', name: { en: 'Cauchy–Schwarz inequality', fa: 'نابرابری کوشی–شوارتس' },
      shows: { en: 'sub- and superscript stacked at the left of the base, scaled fences, ≤ mirrored', fa: 'زیرنویس و بالانویس در چپِ پایه، پرانتزهای مقیاس‌شده، ≤ آینه‌شده' },
      tree: R(SUP(FEN('(', ')', sumK(1, V('n'), R(SUB(V('a'), V('k')), SUB(V('b'), V('k'))))), N(2)), O('<='), FEN('(', ')', sumK(1, V('n'), SS(V('a'), V('k'), N(2)))), FEN('(', ')', sumK(1, V('n'), SS(V('b'), V('k'), N(2)))))
    },
    {
      id: 'numerals', name: { en: 'Numerals (R2.2, R2.4, R2.8)', fa: 'نمایش اعداد' },
      shows: { en: 'most significant digit rightmost, momayyez as decimal separator, scientific notation; the value is stored once, as 1234.56', fa: 'رقم باارزش‌تر در راست، ممیز، نمادگذاری علمی؛ مقدار یک بار و به صورت 1234.56 ذخیره می‌شود' },
      tree: R(N('1234.56'), O('*'), SUP(N(10), N(3)), O('='), N('1234560'), O(','), O('-'), N('273.15'), O('<'), N(0))
    }
  ];
});
