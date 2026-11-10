#!/usr/bin/env python3
"""Assemble dist/index.html (engine + formulas inlined) and copy the shipped fonts."""
import pathlib, shutil
root = pathlib.Path(__file__).parent
src, dist = root / 'src', root / 'dist'
(dist / 'fonts').mkdir(parents=True, exist_ok=True)
page = (src / 'page.html').read_text(encoding='utf-8')
engine = (src / 'engine.js').read_text(encoding='utf-8')
formulas = (src / 'formulas.js').read_text(encoding='utf-8')
page = page.replace('{{ENGINE}}', engine).replace('{{FORMULAS}}', formulas)
(dist / 'index.html').write_text(page, encoding='utf-8')
fonts = {
    'naskh-400.woff2': 'node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2',
    'naskh-600.woff2': 'node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-600-normal.woff2',
    'vazir-600.woff2': 'node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-600-normal.woff2',
    'math-400.woff2': 'node_modules/@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff2',
}
for name, path in fonts.items():
    shutil.copy(root / path, dist / 'fonts' / name)
print('built', (dist / 'index.html').stat().st_size, 'bytes;', len(fonts), 'fonts')
