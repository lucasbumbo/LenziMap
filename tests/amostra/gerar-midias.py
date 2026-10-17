# Gera as imagens ORIGINAIS da "Sala assombrada" (paredes, piso, fantasma e abóbora). Nada vem de outro trabalho.
import random, math
from PIL import Image, ImageDraw, ImageFilter
R=random.Random(7);N=1024;S=2
def new(c): return Image.new('RGB',(N*S,N*S),c)
def fin(im,name,rgba=False): im.resize((N,N),Image.LANCZOS).save('media/'+name)
# parede do fundo: tijolo roxo + janela em arco com lua e árvore
im=new((52,34,66));d=ImageDraw.Draw(im);bh=N*S//14;bw=N*S//7
for r in range(14):
    off=(bw//2) if r%2 else 0
    for c in range(-1,8):
        x=c*bw+off;t=R.randint(-10,10);col=(70+t,44+t//2,84+t,)
        d.rectangle([x+6,r*bh+6,x+bw-6,r*bh+bh-6],fill=col)
ax0,ax1,ay0,ay1=int(N*S*.30),int(N*S*.70),int(N*S*.14),int(N*S*.86)
def arch(pad,fill):
    d.rectangle([ax0-pad,(ay0+ay1)//2-pad*0,ax1+pad,ay1+pad],fill=fill);d.pieslice([ax0-pad,ay0-pad,ax1+pad,ay0+(ax1-ax0)+pad],180,360,fill=fill)
    d.rectangle([ax0-pad,ay0+(ax1-ax0)//2,ax1+pad,ay1+pad],fill=fill)
arch(34,(20,14,28))
sky=Image.new('RGB',im.size,(0,0,0));sd=ImageDraw.Draw(sky)
for y in range(ay0,ay1):
    t=(y-ay0)/(ay1-ay0);sd.line([(0,y),(N*S,y)],fill=(int(16+30*t),int(20+40*t),int(70+60*t)))
mask=Image.new('L',im.size,0);md=ImageDraw.Draw(mask)
md.pieslice([ax0,ay0,ax1,ay0+(ax1-ax0)],180,360,fill=255);md.rectangle([ax0,ay0+(ax1-ax0)//2,ax1,ay1],fill=255)
im.paste(sky,(0,0),mask);d=ImageDraw.Draw(im)
for i in range(40):
    x=R.randint(ax0+20,ax1-20);y=R.randint(ay0+60,ay0+int((ay1-ay0)*.6));r=R.randint(2,5);d.ellipse([x-r,y-r,x+r,y+r],fill=(240,240,255))
mx,my,mr=int(N*S*.57),int(N*S*.30),int(N*S*.07)
glow=Image.new('RGB',im.size,(0,0,0));gd=ImageDraw.Draw(glow);gd.ellipse([mx-mr*2,my-mr*2,mx+mr*2,my+mr*2],fill=(90,90,60));glow=glow.filter(ImageFilter.GaussianBlur(40))
from PIL import ImageChops
im=Image.composite(ImageChops.add(im,glow),im,mask);d=ImageDraw.Draw(im);d.ellipse([mx-mr,my-mr,mx+mr,my+mr],fill=(255,248,200))
# árvore seca
def branch(x,y,a,l,w,dp):
    if dp==0 or l<12: return
    x2=x+l*math.cos(a);y2=y-l*math.sin(a);d.line([(x,y),(x2,y2)],fill=(8,6,14),width=max(2,int(w)))
    branch(x2,y2,a+R.uniform(.25,.6),l*.74,w*.7,dp-1);branch(x2,y2,a-R.uniform(.25,.6),l*.74,w*.7,dp-1)
branch(int(N*S*.40),ay1,math.pi/2+.1,int(N*S*.16),22,7)
d.rectangle([ax0,(ay0+ay1)//2-6,ax1,(ay0+ay1)//2+6],fill=(20,14,28));d.rectangle([(ax0+ax1)//2-6,ay0+(ax1-ax0)//2,(ax0+ax1)//2+6,ay1],fill=(20,14,28))
fin(im,'parede-fundo-janela-lua.png')
# parede da direita: papel de parede listrado + 2 quadros + arandelas
im=new((24,70,78));d=ImageDraw.Draw(im)
for i in range(0,N*S,N*S//16):
    d.rectangle([i,0,i+N*S//32,N*S],fill=(30,86,94));d.rectangle([i+N*S//32,0,i+N*S//32+6,N*S],fill=(214,170,80))
d.rectangle([0,int(N*S*.82),N*S,N*S],fill=(60,36,30));d.rectangle([0,int(N*S*.82)-10,N*S,int(N*S*.82)],fill=(214,170,80))
for (x0,y0,x1,y1) in [(.14,.22,.42,.56),(.58,.18,.86,.52)]:
    X0,Y0,X1,Y1=[int(v*N*S) for v in (x0,y0,x1,y1)]
    d.rectangle([X0-26,Y0-26,X1+26,Y1+26],fill=(190,140,50));d.rectangle([X0,Y0,X1,Y1],fill=(18,12,30))
    cx,cy=(X0+X1)//2,(Y0+Y1)//2;d.ellipse([cx-70,cy-110,cx+70,cy+30],fill=(235,235,245));d.rectangle([cx-70,cy-40,cx+70,cy+110],fill=(235,235,245))
    d.ellipse([cx-32,cy-60,cx-10,cy-30],fill=(20,20,30));d.ellipse([cx+10,cy-60,cx+32,cy-30],fill=(20,20,30));d.ellipse([cx-12,cy-10,cx+12,cy+24],fill=(20,20,30))
for x in (.5,):
    X=int(x*N*S);Y=int(.62*N*S);d.polygon([(X-24,Y),(X+24,Y),(X+14,Y+60),(X-14,Y+60)],fill=(190,140,50));d.ellipse([X-10,Y-60,X+10,Y-5],fill=(255,190,80))
g=Image.new('RGB',im.size,(0,0,0));gd=ImageDraw.Draw(g);gd.ellipse([X-120,Y-170,X+120,Y+70],fill=(120,80,20));g=g.filter(ImageFilter.GaussianBlur(50));im=ImageChops.add(im,g)
fin(im,'parede-direita-papel-quadros.png')
# piso de madeira
im=new((70,44,30));d=ImageDraw.Draw(im);pw=N*S//10
for c in range(10):
    y=0
    while y<N*S:
        L=R.randint(N*S//4,N*S//2);t=R.randint(-14,14);col=(112+t,72+t,44+t//2)
        d.rectangle([c*pw+4,y+4,c*pw+pw-4,min(N*S,y+L)-4],fill=col)
        for k in range(6): yy=y+R.randint(8,max(9,L-8));d.line([(c*pw+10,yy),(c*pw+pw-10,yy+R.randint(-6,6))],fill=(col[0]-18,col[1]-14,col[2]-10),width=3)
        y+=L
fin(im,'piso-madeira.png')
# fantasma (alpha)
im=Image.new('RGBA',(N*S,N*S),(0,0,0,0));d=ImageDraw.Draw(im)
W0=N*S
body=Image.new('L',im.size,0);bd=ImageDraw.Draw(body)
bd.ellipse([W0*.22,W0*.08,W0*.78,W0*.62],fill=255);bd.rectangle([W0*.22,W0*.35,W0*.78,W0*.86],fill=255)
for i in range(5): bd.ellipse([W0*(.22+i*.112),W0*.78,W0*(.22+(i+1)*.112),W0*.94],fill=255)
bd.ellipse([W0*.22,W0*.78,W0*.78,W0*.8],fill=255)
g=Image.new('RGBA',im.size,(236,240,255,255));sh=Image.new('RGBA',im.size,(170,190,235,255))
gm=Image.linear_gradient('L').resize(im.size);im=Image.composite(g,sh,gm.point(lambda v:255-v)) if False else g
im.putalpha(body);d=ImageDraw.Draw(im)
d.ellipse([W0*.34,W0*.28,W0*.45,W0*.46],fill=(30,30,50,255));d.ellipse([W0*.55,W0*.28,W0*.66,W0*.46],fill=(30,30,50,255));d.ellipse([W0*.45,W0*.50,W0*.55,W0*.62],fill=(30,30,50,255))
d.arc([W0*.18,W0*.45,W0*.30,W0*.60],200,340,fill=(170,190,235,255),width=18)
al=im.getchannel('A').filter(ImageFilter.GaussianBlur(3));im.putalpha(al)
im.resize((N,N),Image.LANCZOS).save('media/fantasma.png')
# abóbora (alpha)
im=Image.new('RGBA',(N*S,N*S),(0,0,0,0));d=ImageDraw.Draw(im)
for dx,col in [(-.22,(214,92,18)),(.22,(214,92,18)),(-.11,(240,120,26)),(.11,(240,120,26)),(0,(250,134,30))]:
    d.ellipse([W0*(.5+dx-.22),W0*.30,W0*(.5+dx+.22),W0*.84],fill=col+(255,))
d.polygon([(W0*.47,W0*.32),(W0*.53,W0*.32),(W0*.55,W0*.20),(W0*.45,W0*.20)],fill=(70,100,30,255))
face=(40,16,6,255);d.polygon([(W0*.33,W0*.50),(W0*.43,W0*.50),(W0*.38,W0*.40)],fill=face);d.polygon([(W0*.57,W0*.50),(W0*.67,W0*.50),(W0*.62,W0*.40)],fill=face)
d.polygon([(W0*.30,W0*.62),(W0*.70,W0*.62),(W0*.64,W0*.76),(W0*.56,W0*.70),(W0*.50,W0*.77),(W0*.44,W0*.70),(W0*.36,W0*.76)],fill=(255,205,70,255))
im.resize((N,N),Image.LANCZOS).save('media/abobora.png')
print('ok')
