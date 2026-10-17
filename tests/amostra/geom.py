# Geometria da fachada de teste (frações da tela do projetor) e render da "foto" do objeto físico.
import json, sys, numpy as np
FAC=[(.17,.20),(.83,.15),(.83,.88),(.17,.84)]   # fachada vista um pouco de lado (projetor fora do eixo)
EL={ # nome: (u0,v0,u1,v1) em coordenadas da fachada 0..1, w,h do conteúdo
 'telhado':(0,0,1,.15), 'placa':(.10,.19,.90,.31),
 'janela-esq':(.09,.40,.37,.70), 'janela-dir':(.63,.40,.91,.70), 'porta':(.42,.44,.58,1.0)}
def H(dst):
    src=[(0,0),(1,0),(1,1),(0,1)];A=[];b=[]
    for (u,v),(x,y) in zip(src,dst):
        A.append([u,v,1,0,0,0,-u*x,-v*x]);b.append(x)
        A.append([0,0,0,u,v,1,-u*y,-v*y]);b.append(y)
    h=np.linalg.solve(np.array(A,float),np.array(b,float));return np.append(h,1).reshape(3,3)
def mp(h,u,v):
    p=h@np.array([u,v,1.0]);return (p[0]/p[2],p[1]/p[2])
h=H(FAC)
def quad(u0,v0,u1,v1): return [mp(h,u0,v0),mp(h,u1,v0),mp(h,u1,v1),mp(h,u0,v1)]
if sys.argv[1]=='geom':
    json.dump({'fac':FAC,'el':{k:quad(*v) for k,v in EL.items()},'uv':EL},open(sys.argv[2],'w'))
else:
    from PIL import Image, ImageDraw, ImageFilter
    W,Hh=int(sys.argv[3]),int(sys.argv[4]);S=3
    def px(p): return (p[0]*W*S,p[1]*Hh*S)
    im=Image.new('RGB',(W*S,Hh*S),(22,22,24));d=ImageDraw.Draw(im)
    def poly(q,c): d.polygon([px(p) for p in q],fill=c)
    poly(FAC,(176,172,164))                                  # parede de reboco
    poly(quad(*EL['telhado']),(88,70,64))                    # telhado
    poly(quad(*EL['placa']),(205,200,190))                   # placa clara
    for n in ('janela-esq','janela-dir'):
        u0,v0,u1,v1=EL[n];poly(quad(u0-.015,v0-.02,u1+.015,v1+.02),(236,234,228));poly(quad(u0,v0,u1,v1),(28,32,38))
        um=(u0+u1)/2;vm=(v0+v1)/2;poly(quad(um-.006,v0,um+.006,v1),(236,234,228));poly(quad(u0,vm-.008,u1,vm+.008),(236,234,228))
    u0,v0,u1,v1=EL['porta'];poly(quad(u0-.012,v0-.015,u1+.012,v1),(236,234,228));poly(quad(u0,v0,u1,v1),(92,58,36))
    poly(quad(u1-.03,.70,u1-.015,.74),(210,180,90))
    im=im.resize((W,Hh),Image.LANCZOS)
    import random;random.seed(3);n=np.array(im).astype(np.int16);n+=np.random.RandomState(1).randint(-7,8,n.shape[:2])[...,None];im=Image.fromarray(np.clip(n,0,255).astype(np.uint8))
    im.save(sys.argv[2])
