#!/usr/bin/env python3
"""Generate book QRs (cover-art centred) that VERIFIABLY decode.

For each qra music row (sort 5.5..5.6) writes:
    b/u/<base>.qr.png   +   b/u/book.html

No blind percentages: we read the QR's real module count N, keep the required
quiet zone (a QR cannot be detected without it), paste the logo as a centred
ODD number of modules, then DECODE the finished image with OpenCV and shrink
the logo until it reads the right URL.

Run:  python3 b/u/make_book.py
Requires: Pillow, qrcode, numpy, opencv-python-headless.
"""
import json, os, re, urllib.parse, urllib.request
import numpy as np
import cv2
from PIL import Image
import qrcode
from qrcode.constants import ERROR_CORRECT_H

HERE = os.path.dirname(os.path.abspath(__file__))   # b/u
ROOT = os.path.dirname(os.path.dirname(HERE))        # repo root
COVER_DIR = os.path.join(ROOT, 'i')
BOX = 8            # px per module
QUIET = 4          # quiet-zone modules (required for detection)
MAX_ART = 0.40     # start trying the logo at up to this fraction of N

def conf():
    t = open(os.path.join(ROOT, 'db.js'), encoding='utf8').read()
    return (re.search(r'url\s*:\s*"([^"]+)"', t).group(1),
            re.search(r'publishableKey\s*:\s*"([^"]+)"', t).group(1))

def fetch():
    url, key = conf()
    u = url + '/rest/v1/redir?select=id,%22desc%22,sort&order=sort.asc,id.asc'
    h = {'apikey': key, 'Authorization': 'Bearer ' + key}
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=h)))

def square_cover(cover):
    cov = Image.open(cover).convert('RGBA')
    w0, h0 = cov.size
    side = min(w0, h0)                     # minimal crop to square
    return cov.crop(((w0 - side) // 2, (h0 - side) // 2,
                     (w0 - side) // 2 + side, (h0 - side) // 2 + side))

def compose(content, cover, art_modules):
    """Return (QR image with quiet zone, module count N)."""
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=BOX, border=QUIET)
    q.add_data(content)
    q.make(fit=True)
    N = q.modules_count
    im = q.make_image(fill_color='black', back_color='white').convert('RGB')
    if cover and art_modules > 0:
        cov = square_cover(cover)
        t = art_modules * BOX
        cov = cov.resize((t, t), Image.LANCZOS)
        off = QUIET * BOX                       # quiet-zone offset
        start = ((N - art_modules) // 2) * BOX + off
        im.paste(cov, (start, start), cov)
    return im, N

def decodes(content, im):
    g = np.asarray(im.convert('L'))
    val, _, _ = cv2.QRCodeDetector().detectAndDecode(g)
    return val == content

def build(content, cover):
    # 1) learn N from a clean render
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=BOX, border=QUIET)
    q.add_data(content)
    q.make(fit=True)
    N = q.modules_count
    # 2) largest odd art_modules that fits (and keeps clear of finder/alignment area)
    am = int(N * MAX_ART)
    if am % 2 == 0:
        am -= 1
    am = max(1, min(am, N - 14))
    # 3) shrink until the QR decodes to the right URL
    while am >= 1:
        im, _ = compose(content, cover, am)
        if decodes(content, im):
            return im, N, am
        am -= 2
    im, _ = compose(content, cover, 0)
    return im, N, 0

def main():
    rows = [r for r in fetch()
            if isinstance(r.get('id'), str) and r['id'].endswith('qra')
            and isinstance(r.get('sort'), (int, float)) and 5.5 <= r['sort'] < 5.6]
    if not rows:
        print('No rows in 5.5..5.6'); return
    cards = []
    for x in rows:
        base = x['id'][:-3]
        content = 'https://aigap.no/' + base
        cover = os.path.join(COVER_DIR, base + '.png')
        im, N, am = build(content, cover if os.path.exists(cover) else None)
        im.save(os.path.join(HERE, base + '.qr.png'))
        tag = 'N=%d art=%d OK' % (N, am) if am else 'N=%d no-logo' % N
        print('%-8s %-20s %s' % (base, content, tag))
        cards.append('<div class="card"><img src="%s.qr.png"><div class="d">%s</div></div>'
                     % (base, (x.get('desc') or x['id'])))
    html = ('<!doctype html><html><head><meta charset="utf-8"><title>Book QRs</title><style>'
            'body{font-family:Helvetica,Arial,sans-serif;margin:24px}'
            '.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}'
            '.card{border:1px solid #ddd;border-radius:8px;padding:8px;text-align:center;break-inside:avoid}'
            '.card img{width:100%;height:auto;display:block;background:#fff}'
            '.d{font-size:11px;margin-top:6px;color:#333;line-height:1.2}'
            '@media print{.card{border:none}.cards{gap:10px}}</style></head><body>'
            '<h1>Book QR codes (DB order, 5.5&ndash;5.6)</h1><div class="cards">'
            + ''.join(cards) + '</div></body></html>')
    open(os.path.join(HERE, 'book.html'), 'w', encoding='utf8').write(html)
    print('wrote %d QRs + book.html under %s' % (len(cards), HERE))

if __name__ == '__main__':
    main()

