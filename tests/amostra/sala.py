# Simulação física do canto de uma sala (piso + 2 paredes + rato de papelão) iluminado pelo projetor.
# geom: calcula onde cada peça aparece na tela do projetor. render: "fotografa" a cena de 2 pontos de vista usando a saída real do app.
import sys, json, numpy as np
from PIL import Image
LIB='/home/claude/lenzimap/biblioteca/'
PW,PH=1280,1024
PROJ=np.array([1.55,1.25,3.6]);PT=np.array([0.95,0.55,0.0]);PFOV=np.radians(44)
RZ=0.85;RX0,RX1=0.75,1.65;RH=0.9          # rato: retângulo vertical no plano z=RZ
def basis(pos,tgt):
    f=tgt-pos;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);return f,r,u
def pproj(X):   # ponto 3D -> fração da tela do projetor
    f,r,u=basis(PROJ,PT);d=np.asarray(X)-PROJ;z=d@f;fl=(PH/2)/np.tan(PFOV/2)
    x=PW/2+fl*(d@r)/z;y=PH/2-fl*(d@u)/z;return x/PW,y/PH
POLY={'fundo':[(0,0,0),(2,0,0),(2,1.5,0),(0,1.5,0)],
      'esquerda':[(0,0,2),(0,0,0),(0,1.5,0),(0,1.5,2)],
      'piso':[(0,0,2),(2,0,2),(2,0,0),(0,0,0)],
      'rato':[(RX0,RH,RZ),(RX1,RH,RZ),(RX1,0,RZ),(RX0,0,RZ)]}
# ordem dos cantos = (topo-esq, topo-dir, baixo-dir, baixo-esq) do conteúdo
POLY['esquerda']=[(0,1.5,2),(0,1.5,0),(0,0,0),(0,0,2)]
POLY['piso']=[(0,0,0),(2,0,0),(2,0,2),(0,0,2)]
POLY['fundo']=[(0,1.5,0),(2,1.5,0),(2,0,0),(0,0,0)]
POLY['rato']=[(RX0,RH,RZ),(RX1,RH,RZ),(RX1,0,RZ),(RX0,0,RZ)]
if sys.argv[1]=='geom':
    q={k:[list(pproj(p)) for p in v] for k,v in POLY.items()}
    json.dump(q,open(sys.argv[2],'w'));
    allp=[p for v in q.values() for p in v];print('faixa',min(p[0] for p in allp),max(p[0] for p in allp),min(p[1] for p in allp),max(p[1] for p in allp))
    sys.exit()
# ---------- render ----------
out=np.asarray(Image.open(sys.argv[2]).convert('RGB').resize((PW,PH)),float)/255
rat=Image.open(LIB+'Personagem - Rato em pe.png').convert('RGBA');ratA=np.asarray(rat)[...,3]/255.0
def render(cam,tgt,fov,W,H,seed=1):
    f,r,u=basis(cam,tgt);fl=(H/2)/np.tan(fov/2)
    ys,xs=np.mgrid[0:H,0:W];d=f[None,None,:]+((xs-W/2)/fl)[...,None]*r+(-(ys-H/2)/fl)[...,None]*u
    best=np.full((H,W),1e9);kind=np.zeros((H,W),int);Xp=np.zeros((H,W,3))
    def hit(axis,val,k,lo,hi,extra=None):
        nonlocal best,kind,Xp
        with np.errstate(all='ignore'): t=(val-cam[axis])/d[...,axis]
        X=cam+d*t[...,None];ok=(t>0)&(t<best)
        for ax,(a,b) in lo.items(): ok&=(X[...,ax]>=a)&(X[...,ax]<=b)
        if extra is not None: ok&=extra(X)
        best=np.where(ok,t,best);kind=np.where(ok,k,kind);Xp=np.where(ok[...,None],X,Xp)
    def ratalpha(X):
        u=(X[...,0]-RX0)/(RX1-RX0);v=1-X[...,1]/RH
        iu=np.clip((u*982).astype(int),0,981);iv=np.clip((v*982).astype(int),0,981);return ratA[iv,iu]>0.5
    hit(1,0,1,{0:(0,2),2:(0,2)})                 # piso
    hit(2,0,2,{0:(0,2),1:(0,1.5)})               # parede do fundo
    hit(0,0,3,{2:(0,2),1:(0,1.5)})               # parede da esquerda
    hit(2,RZ,4,{0:(RX0,RX1),1:(0,RH)},ratalpha)  # rato de papelão
    N={1:np.array([0,1,0]),2:np.array([0,0,1]),3:np.array([1,0,0]),4:np.array([0,0,1])}
    alb={1:.80,2:.82,3:.82,4:.86}
    img=np.zeros((H,W,3));rs=np.random.RandomState(seed)
    for k in (1,2,3,4):
        m=kind==k
        if not m.any(): continue
        X=Xp[m];L=PROJ-X;dist=np.linalg.norm(L,axis=1);Ln=L/dist[:,None];cosi=np.clip(Ln@N[k],0,1)
        px,py=pproj(X.T)  # frações
        # pproj espera vetor; refazer vetorizado
        f2,r2,u2=basis(PROJ,PT);dd=X-PROJ;z=dd@f2;fl2=(PH/2)/np.tan(PFOV/2)
        sx=(PW/2+fl2*(dd@r2)/z).astype(int);sy=(PH/2-fl2*(dd@u2)/z).astype(int)
        inside=(sx>=0)&(sx<PW)&(sy>=0)&(sy<PH);col=np.zeros((len(X),3))
        col[inside]=out[sy[inside],sx[inside]]
        if k!=4:   # sombra do rato de papelão
            with np.errstate(all='ignore'): t=(RZ-PROJ[2])/(X[:,2]-PROJ[2])
            Y=PROJ+(X-PROJ)*t[:,None];sh=(t>0)&(t<1)&(Y[:,0]>=RX0)&(Y[:,0]<=RX1)&(Y[:,1]>=0)&(Y[:,1]<=RH)&(X[:,2]<RZ)
            if sh.any(): sh[sh]=ratalpha(Y[sh]);col[sh]=0
        base=alb[k]*(0.06+1.15*cosi[:,None]*col)
        base*= (1+rs.uniform(-0.04,0.04,(len(X),1)))
        img[m]=base
    # fundo: preto da sala com leve gradiente
    bg=~(kind>0);img[bg]=0.015
    return np.clip(img,0,1)**(1/1.1)
def save(a,name): Image.fromarray((a*255).astype(np.uint8)).save(name)
P=sys.argv[3]
views={'frente':(np.array([1.0,1.15,4.6]),np.array([0.9,0.6,0.3]),np.radians(52)),
       'lado':(np.array([3.4,1.35,3.4]),np.array([0.8,0.55,0.4]),np.radians(52))}
for n,(c,t,fv) in views.items(): save(render(c,t,fv,1280,820),P+'vista-'+n+'.png')
# vista do projetor (saída real)
save(out,P+'saida-projetor.png')
# cena sem projeção (luz de ambiente fraca): mesma conta com saída branca bem escura
out[:]=0.0
save(render(*views['lado'],1280,820),P+'cena-apagada.png')
