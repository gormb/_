import glob
import io
import os
from PIL import Image, ImageOps

qr_files = sorted(glob.glob('*.qr.png'))

for filepath in qr_files:
    img = Image.open(filepath).convert('L')
    bw = img.point(lambda p: 255 if p > 128 else 0)

    # Strip outer quiet zone (white margin)
    inv = ImageOps.invert(bw)
    bbox = inv.getbbox()
    cropped = bw.crop(bbox) if bbox else bw
    w, h = cropped.size

    # Read top row to measure top-left finder pattern
    row = [cropped.getpixel((x, 0)) for x in range(w)]
    first_black = row.index(0) if 0 in row else 0

    # Count black pixels strictly across the top-left finder bar
    finder_px = 0
    for px in row[first_black:]:
        if px == 0:
            finder_px += 1
        else:
            break

    # Top-left finder pattern outer bar is always 7 modules wide
    module_px = (finder_px / 7.0) if finder_px > 0 else 1.0

    # Calculate exact matrix grid size
    grid_w = max(21, int(round(w / module_px)))
    grid_h = max(21, int(round(h / module_px)))

    # Downsample cleanly with nearest-neighbor
    tiny = cropped.resize((grid_w, grid_h), Image.NEAREST).convert('1')

    # Save output as <base>.qr1.png (input is <base>.qr.png)
    out_path = f"{filepath[:-7]}.qr1.png"
    buf = io.BytesIO()
    tiny.save(buf, format='PNG', optimize=True)
    data = buf.getvalue()

    if os.path.exists(out_path) and open(out_path, 'rb').read() == data:
        print(f"same   {out_path:19s} ({grid_w}x{grid_h}px) - skipped")
        continue

    open(out_path, 'wb').write(data)
    print(f"{filepath:15s} -> {out_path:19s} | {grid_w}x{grid_h}px ({len(data)} B)")