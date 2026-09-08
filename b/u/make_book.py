#!/usr/bin/env python3
"""Generate book QRs (cover-art centred) with NO white margin baked in.

For each qra music row (sort 5.5..5.6):
    b/u/<base>.qr.png   +   b/u/book.html

Modules fill the image edge-to-edge (no quiet zone). You MUST add a little
white margin around each code in your layout so phones can detect it.

Run:  python3 b/u/make_book.py
Requires: Pillow + qrcode.
"""
import json, os, re, urllib.parse, urllib.request
from PIL import Image
import qrcode
from qrcode.constants import ERROR_CORRECT_M

HERE = os.path.dirname(os.path.abspath(__file__))   # b/u
ROOT = os.path.dirname(os.path.dirname(HERE))        # repo root
COVER_DIR = os.path.join(ROOT, 'i')
BOX = 10          # px per module
ART = 0.28        # art width as a fraction of module count N (modest, so it scans at M)

def conf():
    t = open(os.path.join(ROOT, 'db.js'), encoding='utf8').read()
    return (re.search(r'url\s*:\s*"([^"]+)"', t).group(1),
            re.search(r'publishableKey\s*:\s*"([^"]+)"', t).group(1))

def fetch():
    url, key = conf()
    u = url + '/rest/v1/redir?select=id,%22desc%22,sort&order=sort.asc,id.asc'
    h = {'apikey': key, 'Authorization': 'Bearer ' + key}
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=h)))

def make(content, cover):
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=BOX, border=0)
    q.add_data(content)
    q.make(fit=True)
    N = q.modules_count
    im = q.make_image(fill_color='black', back_color='white').convert('RGB')
    if cover:
        cov = Image.open(cover).convert('RGBA')
        w0, h0 = cov.size
        side = min(w0, h0)
        cov = cov.crop(((w0 - side) // 2, (h0 - side) // 2,
                        (w0 - side) // 2 + side, (h0 - side) // 2 + side))
        am = int(N * ART)
        if am % 2 == 0:
            am -= 1
        am = max(1, min(N - 2, am))
        t = am * BOX
        cov = cov.resize((t, t), Image.LANCZOS)
        start = ((N - am) // 2) * BOX
        im.paste(cov, (start, start), cov)
    return im

def main():
    rows = [r for r in fetch()
            if isinstance(r.get('id'), str) and r['id'].endswith('qra')
            and isinstance(r.get('sort'), (int, float)) and 5.5 <= r['sort'] < 5.6]
    if not rows:
        print('No rows in 5.5..5.6'); return
    cards = []
    for x in rows:
        base = x['id'][:-3]
        cover = os.path.join(COVER_DIR, base + '.png')
        make('https://aigap.no/' + base,
             cover if os.path.exists(cover) else None).save(os.path.join(HERE, base + '.qr.png'))
        cards.append('<div class="card"><img src="%s.qr.png"><div class="d">%s</div></div>'
                     % (base, (x.get('desc') or x['id'])))
    html = ('<!doctype html><html><head><meta charset="utf-8"><title>Book QRs</title><style>'
            'body{font-family:Helvetica,Arial,sans-serif;margin:24px}'
            '.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}'
            '.card{padding:6px;text-align:center;break-inside:avoid}'
            '.card img{width:100%;height:auto;display:block}'
            '.d{font-size:11px;margin-top:6px;color:#333;line-height:1.2}'
            '@media print{.cards{gap:10px}}</style></head><body>'
            '<h1>Book QR codes (DB order, 5.5&ndash;5.6, no white margin)</h1><div class="cards">'
            + ''.join(cards) + '</div></body></html>')
    open(os.path.join(HERE, 'book.html'), 'w', encoding='utf8').write(html)
    print('wrote %d QRs + book.html under %s' % (len(cards), HERE))

if __name__ == '__main__':
    main()

