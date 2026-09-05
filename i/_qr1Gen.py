import glob,io,os
from PIL import Image,ImageOps
for f in sorted(glob.glob('*.qr.png')):
    im=Image.open(f).convert('L').point(lambda p:255 if p>128 else 0)
    b=ImageOps.invert(im).getbbox()
    if b:im=im.crop(b)
    r=[im.getpixel((x,0)) for x in range(im.width)]
    a=r.index(0) if 0 in r else len(r)
    n=next((j for j in range(a,im.width) if r[j]),im.width)-a
    m=n/7.0 if n else 1.0
    t=im.resize((max(21,round(im.width/m)),max(21,round(im.height/m))),Image.NEAREST).convert('1')
    o=f[:-7]+'.qr1.png'
    q=io.BytesIO();t.save(q,format='PNG',optimize=True);d=q.getvalue()
    if os.path.exists(o) and open(o,'rb').read()==d:print('same',o);continue
    open(o,'wb').write(d);print(f,'->',o,len(d),'B')
