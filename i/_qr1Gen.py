import glob,io,os
from PIL import Image,ImageOps
def n_of(im):
    b=(0,21)
    for N in range(21,58,4):
        m=im.width/N
        t=sum(im.getpixel((int((k+.5)*m),0))==0 for k in range(7))
        l=sum(im.getpixel((0,int((k+.5)*m)))==0 for k in range(7))
        if t+l>b[0]:b=(t+l,N)
    return b[1]
for f in sorted(glob.glob('*.qr.png')):
    im=Image.open(f).convert('L').point(lambda p:255 if p>128 else 0)
    bb=ImageOps.invert(im).getbbox()
    if bb:im=im.crop(bb)
    N=n_of(im)
    t=im.resize((N,N),Image.NEAREST).convert('1')
    o=f[:-7]+'.qr1.png'
    q=io.BytesIO();t.save(q,format='PNG',optimize=True);d=q.getvalue()
    if os.path.exists(o) and open(o,'rb').read()==d:print(f'same {o} {N}x{N}px');continue
    open(o,'wb').write(d);print(f'{f} -> {o} {N}x{N}px {len(d)} B')
