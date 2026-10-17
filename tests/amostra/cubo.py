# "Fotografa" um cubo físico numa mesa, iluminado pela saída real do app. Mesma geometria do palco do app (polegadas).
import sys, json, numpy as np
from PIL import Image, ImageFilter
cfg=json.load(open(sys.argv[1]));out=np.asarray(Image.open(sys.argv[2]).convert('RGB'),float)/255;PW,PH=cfg['pw'],cfg['ph']
out=np.asarray(Image.fromarray((out*255).astype(np.uint8)).resize((PW,PH)),float)/255
PROJ=np.array(cfg['proj']);PT=np.array(cfg['ptgt']);PF=np.radians(cfg['pfov']);CUBE=np.array(cfg['cubePos']);SZ=cfg['size'];ROT=np.radians(cfg['rotY'])
def basis(pos,tgt):
    f=tgt-pos;f=f/np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);return f,r,u
def rotY(v,a): c,s=np.cos(a),np.sin(a);return np.stack([v[...,0]*c+v[...,2]*s,v[...,1],-v[...,0]*s+v[...,2]*c],-1)
pf,pr_,pu=basis(PROJ,PT);pfl=(PH/2)/np.tan(PF/2)
def pix(X):
    d=X-PROJ;z=d@pf;return (PW/2+pfl*(d@pr_)/z),(PH/2-pfl*(d@pu)/z)
def render(cam,tgt,fov,W,H,ambient=0.05,lit=True):
    f,r,u=basis(cam,tgt);fl=(H/2)/np.tan(fov/2)
    ys,xs=np.mgrid[0:H,0:W];d=f+((xs-W/2)/fl)[...,None]*r+(-(ys-H/2)/fl)[...,None]*u
    # cubo: caixa alinhada no referencial local (centro em CUBE, girada ROT em Y)
    o=rotY(cam-CUBE,-ROT);dl=rotY(d,-ROT);h=SZ/2
    with np.errstate(all='ignore'):
        t1=(-h-o)/dl;t2=(h-o)/dl
    tn=np.minimum(t1,t2);tf=np.maximum(t1,t2);tmin=tn.max(-1);tmax=tf.min(-1)
    hitc=(tmax>tmin)&(tmax>0);tc=np.where(hitc,tmin,1e9)
    # mesa (plano y = CUBE_y - h), quadrada de 60 pol
    ty0=CUBE[1]-h
    with np.errstate(all='ignore'): tt=(ty0-cam[1])/d[...,1]
    Xt=cam+d*tt[...,None];hitt=(tt>0)&(np.abs(Xt[...,0]-CUBE[0])<42)&(np.abs(Xt[...,2]-CUBE[2])<34)&(tt<tc)
    img=np.zeros((H,W,3));
    # fundo: sala escura com brilho quente atrás
    yy=np.linspace(0,1,H)[:,None];xx=np.linspace(-1,1,W)[None,:]
    bg=np.stack([0.05+0.10*np.exp(-((xx*1.2)**2+(yy-0.45)**2*4)),0.025+0.045*np.exp(-((xx*1.2)**2+(yy-0.45)**2*4)),0.02+0.02*np.exp(-((xx*1.2)**2+(yy-0.45)**2*4))],-1)
    img[:]=bg
    # mesa
    X=Xt[hitt];base=np.array([0.16,0.12,0.10])
    L=PROJ-X;Ln=L/np.linalg.norm(L,axis=1)[:,None];cosi=np.clip(Ln[:,1],0,1)
    px,py=pix(X);ins=(px>=0)&(px<PW)&(py>=0)&(py<PH);col=np.zeros_like(X);col[ins]=out[py[ins].astype(int),px[ins].astype(int)]
    img[hitt]=base*(ambient*2+0.9*cosi[:,None]*col*(1 if lit else 0))+bg[hitt]*0.4*0
    img[hitt]=img[hitt]+base*0.30
    # cubo
    tc_=np.where(hitc,tmin,0);Xl=o+dl*tc_[...,None];ax=np.argmax(np.abs(Xl)/h,-1)
    nl=np.zeros_like(Xl);idx=np.indices(ax.shape);nl[idx[0],idx[1],ax]=np.sign(Xl[idx[0],idx[1],ax])
    Xw=CUBE+rotY(Xl,ROT);Nw=rotY(nl,ROT);m=hitc&(tc_>0)
    X=Xw[m];N=Nw[m];L=PROJ-X;Ln=L/np.linalg.norm(L,axis=1)[:,None];cosi=np.clip((Ln*N).sum(1),0,1)
    px,py=pix(X);ins=(px>=0)&(px<PW)&(py>=0)&(py<PH);col=np.zeros_like(X);col[ins]=out[py[ins].astype(int),px[ins].astype(int)]
    alb=0.92;img[m]=alb*(ambient*0.9+(1.0*col*1 if lit else 0)*(0.55+0.45*cosi[:,None]))
    # aresta levemente mais clara (reflexo) e leve desfoque de câmera
    im=Image.fromarray((np.clip(img,0,1)**(1/1.15)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    a=np.asarray(im).astype(float);a+=np.random.RandomState(2).normal(0,2.2,a.shape);return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
P=sys.argv[3];V=np.array(cfg['viewer']);T=CUBE+np.array([0,0,0])
render(V,T+np.array([0,1,0]),np.radians(cfg['vfov']),1280,960).save(P+'foto-publico.png')
render(np.array([V[0]+cfg['lado'][0],V[1]+cfg['lado'][1],V[2]-cfg['lado'][2]]),T+np.array([0,1,0]),np.radians(cfg['vfov']),1280,960).save(P+'foto-andando-pro-lado.png')
render(V,T+np.array([0,1,0]),np.radians(cfg['vfov']),1280,960,lit=False).save(P+'foto-cubo-apagado.png')
Image.fromarray((out*255).astype(np.uint8)).save(P+'saida-projetor.png')
