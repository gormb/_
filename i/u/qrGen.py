#!/usr/bin/env python3
"""Batch-generate the new qra QR images.

For every row in the Supabase `redir` table whose id ends in `qra`,
write the printable QR `i/<base>.qr.png` (content `https://aigap.no/<base>`,
error-correction M, white center) and the small `i/<base>.qr1.png` that the
homepage prefers to display.

Run from the repo root:
    python3 qrGen.py
Requires: Pillow (already used by _qr1Gen.py) and `qrcode`.
    pip install qrcode Pillow
"""
import json, os, re, urllib.parse, urllib.request
from PIL import Image, ImageDraw
import qrcode
from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_Q

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'i')
os.makedirs(OUT, exist_ok=True)

dbjs = open(os.path.join(HERE, 'db.js'), encoding='utf8').read()
SUPA = {
    'url': re.search(r'url\s*:\s*"([^"]+)"', dbjs).group(1),
    'key': re.search(r'publishableKey\s*:\s*"([^"]+)"', dbjs).group(1),
}
HDR = {'apikey': SUPA['key'], 'Authorization': 'Bearer ' + SUPA['key']}

SIZE = 300          # printable px
MASK = 0.40         # width cleared white in the middle (quiet zone for the logo)
LOGO = 0.34         # width the cover art is scaled to fill (of SIZE)

def fetch(sel, extra=''):
    u = SUPA['url'] + '/rest/v1/redir?' + urllib.parse.urlencode({'select': sel}) + extra
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=HDR)))

def make_big(content, cover):
    has_art = bool(cover) and os.path.exists(cover)
    # Q error correction when a centre logo is embedded -> tolerates the masked modules
    ec = ERROR_CORRECT_Q if has_art else ERROR_CORRECT_M
    q = qrcode.QRCode(error_correction=ec, box_size=8, border=0)
    q.add_data(content)
    q.make(fit=True)
    im = q.make_image(fill_color='black', back_color='white').convert('L')
    # add a quiet-zone border of 4 modules then upscale to SIZE px
    b = 4
    qw, qh = im.size
    canvas = Image.new('L', (qw + 2 * b, qh + 2 * b), 255)
    canvas.paste(im, (b, b))
    canvas = canvas.resize((SIZE, SIZE), Image.NEAREST).convert('RGB')
    # clear the centre to white (quiet zone)
    mw = int(SIZE * MASK)
    x0 = y0 = (SIZE - mw) // 2
    ImageDraw.Draw(canvas).rectangle([x0, y0, x0 + mw - 1, y0 + mw - 1], fill=(255, 255, 255))
    if has_art:
        lw = int(SIZE * LOGO)
        cov = Image.open(cover).convert('RGBA')
        cov.thumbnail((lw, lw), Image.LANCZOS)
        cw2, ch2 = cov.size
        canvas.paste(cov, (x0 + (mw - cw2) // 2, y0 + (mw - ch2) // 2), cov)
    return canvas

def main():
    only = [a for a in os.sys.argv[1:]]   # optional: ids/bases to (re)generate
    rows = fetch('id,url')
    todo = [r['id'] for r in rows if isinstance(r.get('id'), str) and r['id'].endswith('qra')]
    if only:
        todo = [t for t in todo if t in only or t[:-3] in only]
    if not todo:
        print('No qra rows found in the database.')
        return
    for ident in sorted(todo):
        base = ident[:-3]
        content = 'https://aigap.no/' + base
        cover = os.path.join(OUT, base + '.png')
        big = make_big(content, cover)
        big.save(os.path.join(OUT, base + '.qr.png'))
        art = 'with cover art' if os.path.exists(cover) else 'white centre (no art)'
        print(f'{ident}: https://aigap.no/{base}  ->  i/{base}.qr.png  ({art})')
    print('\nNow downsize the .qr.png files into .qr1.png with:')
    print('    cd i && python3 _qr1Gen.py')

if __name__ == '__main__':
    main()
