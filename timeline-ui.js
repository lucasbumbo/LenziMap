// LenziMap: interface da timeline (dock inferior, inspetor na aba Timeline e alças do Viewer).
// Este arquivo só desenha e edita o modelo (Sequence). Quem toca a sequência é o SequencePlayer.
(function (root) {
  'use strict';
  var H = null, Seq = null, tl = null;
  var mkLayer, dock, bar, mainEl, headsWrap, headsIn, rulerWrap, rulerCv, scrollEl, lanesEl, phLine, phHead, insp, timeBox, vtime, statEl;
  var st = { zoom: 60, rowH: 52, sel: {}, selTrack: null, edit: 'select', anchor: null, selMk: null, dockFocus: false, clip: null, built: false, pend: false, dockH: 330, lastSig: '', tick: 0 };
  var thumbs = {}, thumbQ = [], thumbBusy = false, waves = {}, waveBusy = {};
  var propUI = {}, ioNow = 0;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, title, fn, cls) {
    var b = el('button', 'tl-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); }
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function now() { return tl.clock.now(); }
  function seq() { return tl.seq; }
  function fps() { return tl.seq.fps || 30; }
  function selIds() { return Object.keys(st.sel); }
  function firstSel() {
    var ids = selIds();
    for (var i = 0; i < ids.length; i++) { var f = Seq.findClip(seq(), ids[i]); if (f) return f; }
    return null;
  }
  function surfaceOfKey(key) {
    var all = H.surfaces();
    for (var i = 0; i < all.length; i++) if (all[i].s.key === key) return all[i];
    return null;
  }
  function changed() {
    if (window.CompoundCore) { try { CompoundCore.follow(seq()); CompoundCore.sanitize(seq()); } catch (e) {} }
    H.syncClock();
    H.push();
    refresh();
  }
  function pushTr() { H.pushTransport(); }

  // ---------- CSS ----------
  var CSS = [
    '.app.tl-open{grid-template-rows:minmax(0,1fr) var(--tlh,330px)}',
    '.tl-dock{grid-column:1/-1;display:none;flex-direction:column;min-height:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;position:relative;outline:none}',
    '.app.tl-open .tl-dock{display:flex}',
    '.tl-grip{position:absolute;left:0;right:0;top:0;height:6px;cursor:ns-resize;z-index:30}',
    '.tl-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px 6px;border-bottom:1px solid var(--line)}',
    '.tl-sep{width:1px;height:22px;background:var(--line);margin:0 2px}',
    '.tl-btn{font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:6px;cursor:pointer;white-space:nowrap}',
    '.tl-btn:hover{border-color:var(--muted)}.tl-btn.on{border-color:var(--accent);color:var(--accent)}.tl-btn.primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600}',
    '.tl-btn:disabled{opacity:.4;cursor:not-allowed}',
    '.tl-time{font:600 15px var(--font-mono);min-width:96px;text-align:center;color:var(--fg);background:#000;border:1px solid var(--line);border-radius:6px;padding:3px 8px;cursor:text}',
    '.tl-tc{font:11px var(--font-mono);color:var(--muted)}',
    '.tl-sel{font:inherit;font-size:12px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:3px 4px}',
    '.tl-bar input[type=range]{width:90px}',
    '.tl-stat{margin-left:auto;font:11px var(--font-mono);color:var(--muted)}',
    '.tl-main{display:grid;grid-template-columns:236px minmax(0,1fr);grid-template-rows:26px minmax(0,1fr);flex:1;min-height:0}',
    '.tl-corner{border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--panel-2)}',
    '.tl-rulerwrap{position:relative;overflow:hidden;border-bottom:1px solid var(--line);background:var(--panel-2);cursor:col-resize}',
    '.tl-rulerwrap canvas{position:absolute;left:0;top:0;display:block}',
    '.tl-phr{position:absolute;top:0;width:0;height:26px;pointer-events:none;z-index:5}',
    '.tl-phr:before{content:"";position:absolute;left:-6px;top:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid var(--accent)}',
    '.tl-headswrap{overflow:hidden;border-right:1px solid var(--line);background:var(--panel)}',
    '.tl-head{box-sizing:border-box;display:flex;flex-direction:column;gap:3px;padding:4px 6px 4px 9px;border-bottom:1px solid var(--line);position:relative;cursor:pointer}',
    '.tl-head:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--tc,#888)}',
    '.tl-head.sel{background:rgba(255,79,163,.10)}',
    '.tl-head .r1,.tl-head .r2{display:flex;gap:3px;align-items:center;min-width:0}',
    '.tl-head input.nm{flex:1;min-width:0;font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:transparent;border:1px solid transparent;border-radius:4px;padding:1px 3px}',
    '.tl-head input.nm:focus{border-color:var(--line);background:var(--panel-2)}',
    '.tl-head select{flex:1;min-width:0;font:inherit;font-size:11px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:1px 2px}',
    '.tl-head .warn{color:#ffb020}',
    '.tl-vbar{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:none;gap:4px;padding:4px;background:rgba(14,17,22,.88);border:1px solid var(--line);border-radius:10px;z-index:5;backdrop-filter:blur(6px)}',
    '.tl-vbar.v2{bottom:auto;top:8px}.tl-vb.sm{font-weight:500;padding:4px 8px}',
    '.tl-gline{stroke:#00e5ff;stroke-width:1.2;opacity:.9;pointer-events:none}.tl-ghit{stroke:transparent;stroke-width:14;cursor:col-resize}.tl-grid{stroke:rgba(255,255,255,.28);stroke-width:1;pointer-events:none}.tl-third{stroke:rgba(255,210,61,.5);stroke-width:1;stroke-dasharray:6 5;pointer-events:none}',
    '.tl-safe{fill:none;stroke:rgba(255,120,60,.85);stroke-width:1.4;stroke-dasharray:8 5;pointer-events:none}.tl-rul{stroke:rgba(255,255,255,.85);stroke-width:1;pointer-events:none}.tl-rulbg{fill:rgba(10,12,16,.72);cursor:copy}.tl-rult{fill:#fff;font:10px sans-serif;pointer-events:none}',
    '.tl-mpath{fill:none;stroke:#7bed9f;stroke-width:2;stroke-dasharray:5 4;pointer-events:none}.tl-mpk{fill:#7bed9f;stroke:#06240f;stroke-width:1.5;cursor:move}.tl-anc{fill:rgba(255,80,160,.25);stroke:#ff50a0;stroke-width:2;cursor:move}.tl-ancl{stroke:#ff50a0;stroke-width:2;pointer-events:none}',
    '.tl-efx{border:1px solid var(--line);border-radius:8px;padding:6px;margin:6px 0;background:var(--panel)}.tl-efx-h{display:flex;align-items:center;gap:6px;margin-bottom:4px}.tl-efx-h b{flex:1;font-size:12px}',
    '.tl-vb{font:600 12px var(--font);color:var(--fg);background:transparent;border:1px solid transparent;border-radius:7px;padding:5px 10px;cursor:pointer;white-space:nowrap}',
    '.tl-vb:hover{background:var(--panel-2)}.tl-vb.on{background:#2d7bf6;color:#fff}.tl-vb.lk{margin-left:6px;border-color:var(--line)}.tl-vb.lk.on{background:#ffb020;color:#1a1200}',
    '.tl-surf{fill:none;stroke:var(--accent);stroke-width:1.5;stroke-dasharray:6 4;pointer-events:none}',
    '.tl-box{fill:rgba(45,123,246,.06);stroke:#2d7bf6;stroke-width:2;pointer-events:all;cursor:move}',
    '.tl-dist{fill:none;stroke:rgba(255,255,255,.55);stroke-width:1.5;stroke-dasharray:5 4;pointer-events:none}',
    '.tl-crop{fill:rgba(255,210,61,.07);stroke:#ffd23d;stroke-width:2;pointer-events:none}',
    '.tl-ctr{fill:#fff;stroke:#2d7bf6;stroke-width:2;pointer-events:none}',
    '.tl-rl{stroke:#2d7bf6;stroke-width:2;pointer-events:none}',
    '.tl-hd{fill:#2d7bf6;stroke:#fff;stroke-width:2;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}',
    '.tl-hd.rot{fill:#fff;stroke:#2d7bf6}.tl-hd.dist{fill:#ff4fa3}',
    '.tl-guide{stroke:#ffd23d;stroke-width:1.5;stroke-dasharray:4 3;pointer-events:none}',
    '.tl-hud{font:700 13px var(--font-mono);fill:#fff;paint-order:stroke;stroke:#000;stroke-width:4px;pointer-events:none}',
    '.tl-lay{font:700 9px var(--font-mono);color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:2px 3px;flex:none}',
    '.tl-lay.multi{color:var(--accent-ink);background:var(--accent);border-color:transparent}',
    '.tl-mini{font:700 10px var(--font-mono);width:22px;height:20px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);border-radius:4px;cursor:pointer;padding:0}',
    '.tl-mini.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}',
    '.tl-scroll{position:relative;overflow:auto;background:#0b0e13}',
    '.tl-lanes{position:relative}',
    '.tl-lane{position:absolute;left:0;right:0;border-bottom:1px solid var(--line);box-sizing:border-box}',
    '.tl-lane.alt{background:rgba(255,255,255,.025)}.tl-lane.drop{background:rgba(255,79,163,.12)}',
    '.tl-lane.off{opacity:.45}',
    '.tl-clip{position:absolute;top:4px;bottom:4px;border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,.35);background:#344;box-sizing:border-box;cursor:grab;user-select:none;touch-action:none}',
    '.tl-clip.k-video{background:#26507a}.tl-clip.k-img{background:#5a4a84}.tl-clip.k-fx{background:#7a2f62}.tl-clip.k-text{background:#6b5b1e}.tl-clip.k-cam{background:#2f6b55}.tl-clip.k-audio{background:#1f6a4d}',
    '.tl-clip.sel{outline:2px solid var(--accent);outline-offset:0;border-color:#fff;z-index:3}',
    '.tl-clip.bad{border-color:#ff5c5c;box-shadow:inset 0 0 0 1px #ff5c5c}',
    '.tl-clip.lk{cursor:not-allowed}',
    '.tl-clip.cp{box-shadow:inset 0 3px 0 var(--cp,#4fc3ff)}.tl-clip.cp.cpo{box-shadow:inset 0 3px 0 var(--cp,#4fc3ff);border-style:dashed}.tl-clip.cn{border-left:3px solid #ffd24a}.tl-clip.cnp{border-bottom:3px solid #ffd24a}',
    '.tl-link{position:absolute;pointer-events:none;z-index:4;background:#ffd24a;width:2px;opacity:.9}.tl-linkdot{position:absolute;pointer-events:none;z-index:5;width:7px;height:7px;border-radius:50%;background:#ffd24a;border:1px solid #000;margin:-3px 0 0 -3px}',
    '.tl-clip canvas{position:absolute;left:0;top:0;pointer-events:none;opacity:.9}',
    '.tl-clip .lb{position:absolute;left:5px;top:2px;right:5px;font:600 11px var(--font-body);color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}',
    '.tl-clip .lb2{position:absolute;left:5px;bottom:2px;font:10px var(--font-mono);color:rgba(255,255,255,.85);text-shadow:0 1px 2px #000;pointer-events:none}',
    '.tl-clip .th{position:absolute;top:0;bottom:0;width:8px;z-index:4;cursor:ew-resize;background:rgba(255,255,255,.0)}',
    '.tl-clip .th.l{left:0}.tl-clip .th.r{right:0}.tl-clip:hover .th{background:rgba(255,255,255,.28)}',
    '.tl-clip .kf{position:absolute;bottom:2px;width:7px;height:7px;background:#ffd23d;transform:translateX(-3px) rotate(45deg);pointer-events:none;border:1px solid #000}',
    '.tl-clip .cyc{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed rgba(255,255,255,.7);pointer-events:none}',
    '.tl-clip .fd{position:absolute;top:0;bottom:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.65),rgba(0,0,0,0))}',
    '.tl-clip .fd.o{background:linear-gradient(270deg,rgba(0,0,0,.65),rgba(0,0,0,0))}',
    '.tl-ph{position:absolute;top:0;bottom:0;width:0;border-left:2px solid var(--accent);pointer-events:none;z-index:8}',
    '.tl-mk{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed #ffd23d;pointer-events:none;z-index:2}',
    '.tl-loopband{position:absolute;top:0;bottom:0;background:rgba(255,210,61,.07);pointer-events:none}',
    '.tl-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);text-align:center;padding:16px;pointer-events:none}',
    '.tl-vtime{position:absolute;right:8px;top:8px;font:600 12px var(--font-mono);color:#fff;background:rgba(0,0,0,.6);padding:3px 7px;border-radius:4px;pointer-events:none;z-index:6;display:none}',
    '.app.tl-open .tl-vtime{display:block}',
    '.tl-insp-sec{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid var(--line)}',
    '.tl-insp-sec:first-child{border-top:0;padding-top:0}',
    '.tl-insp-sec h3{font:500 11px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0}',
    '.tl-prop{display:grid;grid-template-columns:78px minmax(0,1fr) 56px auto;gap:5px;align-items:center}',
    '.tl-prop label{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tl-prop input[type=number],.tl-num{font:inherit;font-size:12px;width:100%;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:2px 4px;min-width:0}',
    '.tl-prop .kfs{display:flex;gap:2px}',
    '.tl-kf{font:700 11px var(--font-mono);width:22px;height:22px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);border-radius:4px;cursor:pointer;padding:0}',
    '.tl-kf.has{color:#ffd23d;border-color:#ffd23d}.tl-kf.here{background:#ffd23d;color:#000;border-color:#ffd23d}',
    '.tl-row2{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.tl-row2 label{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}',
    '.tl-insp-sec select,.tl-insp-sec input[type=text],.tl-insp-sec textarea{font:inherit;font-size:13px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:5px}',
    '.tl-insp-sec details>summary{cursor:pointer;color:var(--muted);font-size:12px}',
    '.tl-mkl{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
    '.tl-mkf{position:absolute;top:2px;height:20px;max-width:140px;padding:0 6px 0 9px;font:600 10px/20px var(--font-body);color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:ew-resize;clip-path:polygon(0 0,calc(100% - 5px) 0,100% 50%,calc(100% - 5px) 100%,0 100%,0 0);border-left:2px solid #000;min-width:12px}',
    '.tl-mkf.sel{outline:2px solid #fff;outline-offset:-1px}',
    '.tl-mkf input{font:inherit;width:90px;height:16px;border:0;background:#fff;color:#000;padding:0 3px}',
    '.tl-marq{position:absolute;border:1px dashed #fff;background:rgba(255,255,255,.12);pointer-events:none;z-index:9}',
    '.tl-btn.tool.on{border-color:var(--accent);color:var(--accent)}',
    '.tl-clip.rolling{outline:2px solid #ff9f43}',
    '.tl-help{position:fixed;inset:0;z-index:310;display:grid;place-items:center;background:rgba(0,0,0,.55)}',
    '.tl-help>div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 20px;max-width:760px;max-height:80vh;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:4px 28px;font-size:12px}',
    '.tl-help h3{grid-column:1/-1;margin:0 0 6px;font-size:14px}.tl-help h4{grid-column:1/-1;margin:10px 0 2px;font:500 10px var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}',
    '.tl-help kbd{font:11px var(--font-mono);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:1px 5px;margin-right:6px}',
    '.tl-mkrow{display:grid;grid-template-columns:30px minmax(0,1fr) 64px auto;gap:4px;align-items:center}',
    '.tl-mkrow input[type=color]{width:28px;height:24px;padding:0;border:1px solid var(--line);background:none}',
    '.tl-note{font-size:12px;color:var(--muted);line-height:1.4}',
    '.tl-note b{color:var(--fg)}'
  ].join('\n');

  // ---------- montagem ----------
  function build() {
    var style = el('style'); style.textContent = CSS; document.head.appendChild(style);
    var app = document.querySelector('.app');
    dock = el('section', 'tl-dock'); dock.tabIndex = -1; dock.setAttribute('aria-label', 'Timeline');
    var grip = el('div', 'tl-grip'); dock.appendChild(grip);
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); var y0 = e.clientY, h0 = st.dockH;
      function mv(ev) { st.dockH = clamp(h0 + (y0 - ev.clientY), 190, Math.round(window.innerHeight * 0.72)); app.style.setProperty('--tlh', st.dockH + 'px'); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); refresh(); }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    bar = el('div', 'tl-bar'); dock.appendChild(bar);
    mainEl = el('div', 'tl-main'); dock.appendChild(mainEl);
    mainEl.appendChild(el('div', 'tl-corner'));
    rulerWrap = el('div', 'tl-rulerwrap'); rulerCv = el('canvas'); rulerWrap.appendChild(rulerCv);
    mkLayer = el('div', 'tl-mkl'); rulerWrap.appendChild(mkLayer);
    phHead = el('div', 'tl-phr'); rulerWrap.appendChild(phHead);
    mainEl.appendChild(rulerWrap);
    headsWrap = el('div', 'tl-headswrap'); headsIn = el('div'); headsWrap.appendChild(headsIn); mainEl.appendChild(headsWrap);
    scrollEl = el('div', 'tl-scroll'); lanesEl = el('div', 'tl-lanes'); scrollEl.appendChild(lanesEl); mainEl.appendChild(scrollEl);
    phLine = el('div', 'tl-ph'); lanesEl.appendChild(phLine);
    app.appendChild(dock);
    vtime = el('div', 'tl-vtime', '00:00.000'); H.stage.appendChild(vtime);
    insp = $('tl-insp');
    buildBar();
    wire();
    st.built = true;
  }

  function buildBar() {
    bar.textContent = '';
    var b = {};
    b.toStart = btn('|◀', 'Ir para o início (Home)', function () { seek(0); });
    b.play = btn('▶', 'Tocar ou pausar (Espaço)', togglePlay, 'primary');
    b.stop = btn('■', 'Parar e voltar ao início', function () { tl.clock.stop(); pushTr(); H.push(); });
    b.toEnd = btn('▶|', 'Ir para o fim (End)', function () { seek(seq().duration); });
    timeBox = el('input', 'tl-time'); timeBox.type = 'text'; timeBox.value = '00:00.000'; timeBox.title = 'Tempo atual. Digite 00:03.250 ou 0:0:3:08 e Enter pra pular.';
    timeBox.setAttribute('aria-label', 'Tempo atual');
    timeBox.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { var v = Seq.parseTime(timeBox.value, fps()); if (v != null) seek(v); timeBox.blur(); } if (e.key === 'Escape') timeBox.blur(); });
    timeBox.addEventListener('focus', function () { timeBox.select(); st.typing = true; });
    timeBox.addEventListener('blur', function () { st.typing = false; });
    b.tc = el('span', 'tl-tc', '00:00:00:00');
    var rate = el('select', 'tl-sel'); rate.title = 'Velocidade da reprodução';
    [0.25, 0.5, 1, 1.5, 2].forEach(function (r) { var o = el('option', null, r + 'x'); o.value = r; if (r === 1) o.selected = true; rate.appendChild(o); });
    rate.addEventListener('change', function () { tl.clock.setRate(+rate.value); pushTr(); H.push(); });
    var loop = el('select', 'tl-sel'); loop.title = 'Loop da sequência (diferente do loop de clipe)';
    [['off', 'Sem loop'], ['range', 'Loop do intervalo'], ['all', 'Loop infinito']].forEach(function (x) { var o = el('option', null, x[1]); o.value = x[0]; loop.appendChild(o); });
    loop.addEventListener('change', function () { setLoopMode(loop.value); });
    var snap = btn('Imã', 'Encaixar em bordas, marcadores e playhead', function () { seq().settings.snap = !seq().settings.snap; H.checkpoint(); refresh(); }, null);
    var zo = btn('−', 'Menos zoom (-)', function () { zoom(1 / 1.4); }); var zi = btn('+', 'Mais zoom (=)', function () { zoom(1.4); }); var zf = btn('Ajustar', 'Ajustar a sequência na tela (\\)', zoomFit);
    var addV = btn('+ Faixa', 'Nova faixa de vídeo. Se a face selecionada já tem faixa, vira uma camada nova por cima', function () { newVideoTrack(); });
    var addAll = btn('Faixa p/ cada face', 'Cria uma faixa pra cada superfície que ainda não tem faixa', allFaces);
    var addA = btn('+ Áudio', 'Nova faixa de áudio', function () { H.checkpoint(); var t = Seq.addTrack(seq(), 'audio'); st.selTrack = t.id; changed(); });
    var imp = btn('Importar', 'Importar vídeo, imagem ou áudio pra timeline', importDialog);
    var sp = btn('Cortar (S)', 'Cortar o clipe no playhead (S)', splitSel);
    var dp = btn('Duplicar', 'Duplicar clipe (Cmd+D)', dupSel);
    var dl = btn('Apagar', 'Apagar clipe (Delete)', delSel);
    var mk = btn('Marcador (M)', 'Marcador no playhead (M)', addMarker);
    var tSel = btn('Seleção (A)', 'Ferramenta de seleção: mover clipes e aparar bordas, sem deslocar os vizinhos', function () { setEdit('select'); }, 'tool');
    var tTrim = btn('Trim (T)', 'Ferramenta Trim: borda = Ripple, corte entre dois clipes = Roll, corpo = Slip, Alt + corpo = Slide. Só mexe na faixa do clipe.', function () { setEdit('trim'); }, 'tool');
    var snapOpt = btn('▾', 'Opções do Imã: o que atrai, grade e distância', function (e) { snapMenu(e.clientX, e.clientY + 14); });
    var help = btn('?', 'Atalhos da timeline (?)', function () { showHelp(); });
    var lk = btn('Travar calibração', 'Impede mexer nos cantos, máscaras e malhas das superfícies', function () { tl.lockCal = !tl.lockCal; H.renderOverlay(); refresh(); H.say(tl.lockCal ? 'Calibração travada: os cantos das superfícies não mexem mais.' : 'Calibração liberada.'); });
    var kfb = btn('Keyframes', 'Abrir o editor de keyframes (Dopesheet e Curvas)', function () { if (window.KeyframeUI) { KeyframeUI.toggle(); refresh(); } });
    var ak = btn('Auto keyframe', 'Quando ligado, todo ajuste de Transform e Distort cria keyframe no playhead', function () { tl.autoKey = !tl.autoKey; refresh(); });
    var off = btn('Desligar', 'Volta pro modo normal (a sequência fica salva)', function () { H.setOn(false); });
    statEl = el('span', 'tl-stat', '');
    var ctl = { rate: rate, loop: loop, snap: snap, tSel: tSel, tTrim: tTrim, lk: lk, ak: ak, kfb: kfb, play: b.play, tc: b.tc };
    bar._c = ctl;
    [b.toStart, b.play, b.stop, b.toEnd, timeBox, b.tc, el('span', 'tl-sep'), rate, loop, el('span', 'tl-sep'), snap, snapOpt, zo, zi, zf, el('span', 'tl-sep'), addV, addAll, addA, imp, el('span', 'tl-sep'), tSel, tTrim, sp, dp, dl, mk, el('span', 'tl-sep'), lk, ak, kfb, help, off, statEl].forEach(function (x) { bar.appendChild(x); });
  }

  // ---------- transporte ----------
  function togglePlay() { if (tl.clock.playing) { tl.clock.pause(); } else { tl.clock.play(); } pushTr(); H.push(); }
  function seek(t) { tl.clock.seek(clamp(t, 0, seq().duration)); pushTr(); updatePlayhead(); }
  function setLoopMode(m) {
    H.checkpoint();
    var lp = seq().settings.loop;
    if (m === 'off') lp.on = false;
    else if (m === 'all') { lp.on = true; lp.in = 0; lp.out = null; }
    else { lp.on = true; if (lp.out == null || lp.out <= lp.in) { lp.in = Math.max(0, now()); lp.out = Math.min(seq().duration, lp.in + Math.max(2, seq().duration / 4)); } }
    H.syncClock(); pushTr(); changed();
  }
  function loopMode() { var lp = seq().settings.loop; if (!lp.on) return 'off'; return (lp.in === 0 && (lp.out == null || lp.out >= seq().duration)) ? 'all' : 'range'; }
  function setIO(which) {
    H.checkpoint();
    var lp = seq().settings.loop, t = Seq.quant(now(), fps());
    if (which === 'in') { lp.in = t; if (lp.out == null || lp.out <= t) lp.out = Math.min(seq().duration, t + 2); }
    else { lp.out = t; if (lp.in >= t) lp.in = Math.max(0, t - 2); }
    lp.on = true;
    H.syncClock(); pushTr(); changed();
  }

  // ---------- zoom e coordenadas ----------
  function zoom(f, cx) {
    var old = st.zoom, vis = scrollEl.clientWidth, anchor = cx == null ? now() : cx;
    st.zoom = clamp(old * f, 6, 700);
    renderAll();
    scrollEl.scrollLeft = Math.max(0, anchor * st.zoom - vis / 2);
    drawRuler(); updatePlayhead();
  }
  function zoomFit() { var vis = Math.max(100, scrollEl.clientWidth - 24); st.zoom = clamp(vis / Math.max(1, seq().duration), 6, 700); renderAll(); scrollEl.scrollLeft = 0; drawRuler(); updatePlayhead(); }
  function xOf(t) { return t * st.zoom; }
  function tOfClient(cx) { var r = scrollEl.getBoundingClientRect(); return Math.max(0, (cx - r.left + scrollEl.scrollLeft) / st.zoom); }
  function tOfRuler(cx) { var r = rulerWrap.getBoundingClientRect(); return Math.max(0, (cx - r.left + scrollEl.scrollLeft) / st.zoom); }

  // ---------- render ----------
  function refresh() {
    if (st.pend) return;
    st.pend = true;
    requestAnimationFrame(function () { st.pend = false; renderAll(); });
  }
  function faceColor(key, fallback) {
    var all = H.surfaces();
    for (var k = 0; k < all.length; k++) if (all[k].s.key === key) return trackColor(k);
    return trackColor(fallback);
  }
  function trackColor(i) { return 'hsl(' + ((i * 47 + 200) % 360) + ',65%,58%)'; }

  function renderAll() {
    if (!st.built) return;
    var app = document.querySelector('.app');
    var on = !!tl.on;
    app.classList.toggle('tl-open', on);
    if (on) app.style.setProperty('--tlh', st.dockH + 'px');
    var mc = $('m-clip'); if (mc) { mc.hidden = !on; mc.setAttribute('aria-pressed', H.state.mode === 'clip' ? 'true' : 'false'); mc.classList.toggle('on', H.state.mode === 'clip'); }
    if (!on && H.state.mode === 'clip') { H.state.mode = 'corners'; H.renderOverlay(); H.syncControls(); }
    renderInspector(); updateBar();
    if (on && window.MediaBrowser) { try { window.MediaBrowser.refresh(); } catch (e) {} }
    if (!on) return;
    var s = seq(), c = bar._c;
    c.snap.classList.toggle('on', s.settings.snap); c.lk.classList.toggle('on', tl.lockCal); c.ak.classList.toggle('on', tl.autoKey); c.kfb.classList.toggle('on', !!(window.KeyframeUI && KeyframeUI.isOpen())); c.tSel.classList.toggle('on', st.edit === 'select'); c.tTrim.classList.toggle('on', st.edit === 'trim');
    c.loop.value = loopMode(); c.rate.value = String(tl.clock.rate);
    c.play.textContent = tl.clock.playing ? '❚❚' : '▶';
    var W = Math.max(scrollEl.clientWidth, Math.ceil((s.duration + 4) * st.zoom) + 40);
    var Hh = Math.max(scrollEl.clientHeight, s.tracks.length * st.rowH);
    lanesEl.style.width = W + 'px'; lanesEl.style.height = Hh + 'px';
    // limpa tudo menos o playhead
    while (lanesEl.firstChild) lanesEl.removeChild(lanesEl.firstChild);
    headsIn.textContent = '';
    var lp = s.settings.loop;
    if (lp.on) {
      var lo = lp.in || 0, hi = lp.out == null ? s.duration : lp.out;
      var band = el('div', 'tl-loopband'); band.style.left = xOf(lo) + 'px'; band.style.width = Math.max(2, xOf(hi - lo)) + 'px'; lanesEl.appendChild(band);
    }
    s.markers.forEach(function (m) { var d = el('div', 'tl-mk'); d.style.left = xOf(m.t) + 'px'; d.style.borderLeftColor = m.color || '#ffd23d'; lanesEl.appendChild(d); });
    drawMarkers();
    var curSurf = H.currentSurface();
    s.tracks.forEach(function (t, i) {
      var lane = el('div', 'tl-lane' + (i % 2 ? ' alt' : '') + ((t.type === 'video' && !t.enabled) ? ' off' : ''));
      lane.style.top = (i * st.rowH) + 'px'; lane.style.height = st.rowH + 'px'; lane.dataset.tid = t.id;
      var bad = Seq.conflicts(t);
      t.clips.forEach(function (c) { lane.appendChild(clipEl(t, c, bad[c.id])); });
      lanesEl.appendChild(lane);
      headsIn.appendChild(headEl(t, i, curSurf));
    });
    if (!s.tracks.length) {
      var em = el('div', 'tl-empty'); em.style.width = Math.max(300, scrollEl.clientWidth) + 'px'; em.innerHTML = '<div><b>Timeline vazia.</b><br>Use "Faixa p/ cada face" pra criar uma faixa por superfície, depois clique numa textura da Galeria (ela entra na faixa da face selecionada, no playhead) ou arraste arquivos pra cá.</div>';
      lanesEl.appendChild(em);
    }
    drawLinks();
    lanesEl.appendChild(phLine);
    headsIn.style.transform = 'translateY(' + (-scrollEl.scrollTop) + 'px)';
    drawRuler(); updatePlayhead();
    syncInspector();
    if (window.KeyframeUI) KeyframeUI.render();
  }

  // Relações visuais: uma linha vertical amarela liga cada clipe conectado ao principal, no ponto em que ele se prende
  function drawLinks() {
    var CC = window.CompoundCore; if (!CC) return;
    var L = lanesEl.getBoundingClientRect();
    seq().tracks.forEach(function (t) {
      t.clips.forEach(function (c) {
        if (!c.conn) return;
        var ce = lanesEl.querySelector('.tl-clip[data-cid="' + c.id + '"]'), pe = lanesEl.querySelector('.tl-clip[data-cid="' + c.conn.to + '"]');
        if (!ce || !pe) return;
        var a = ce.getBoundingClientRect(), b = pe.getBoundingClientRect();
        var x = a.left - L.left, ya = a.top - L.top + a.height / 2, yb = b.top - L.top + b.height / 2;
        var xp = Math.max(b.left - L.left, Math.min(b.right - L.left, x));            // ponto do principal onde o filho se prende
        var ln = el('div', 'tl-link'); ln.style.left = xp + 'px'; ln.style.top = Math.min(ya, yb) + 'px'; ln.style.height = Math.abs(ya - yb) + 'px'; ln.dataset.child = c.id; ln.dataset.parent = c.conn.to; lanesEl.appendChild(ln);
        if (Math.abs(x - xp) > 1) { var hl = el('div', 'tl-link'); hl.style.cssText = 'left:' + Math.min(x, xp) + 'px;top:' + ya + 'px;width:' + Math.abs(x - xp) + 'px;height:2px'; lanesEl.appendChild(hl); }
        var d1 = el('div', 'tl-linkdot'); d1.style.left = xp + 'px'; d1.style.top = yb + 'px'; lanesEl.appendChild(d1);
        var d2 = el('div', 'tl-linkdot'); d2.style.left = x + 'px'; d2.style.top = ya + 'px'; lanesEl.appendChild(d2);
      });
    });
  }

  function headEl(t, i, curSurf) {
    var sf = t.type === 'video' && t.surfaceId ? surfaceOfKey(t.surfaceId) : null;
    var isSel = st.selTrack === t.id || (sf && curSurf && sf.s.id === curSurf.id);
    var h = el('div', 'tl-head' + (isSel ? ' sel' : '')); h.style.height = st.rowH + 'px'; h.style.setProperty('--tc', t.type === 'video' && t.surfaceId ? faceColor(t.surfaceId, i) : trackColor(i)); h.dataset.tid = t.id;
    var r1 = el('div', 'r1'), r2 = el('div', 'r2');
    var nm = el('input', 'nm'); nm.type = 'text'; nm.value = t.name; nm.setAttribute('aria-label', 'Nome da faixa');
    nm.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
    nm.addEventListener('change', function () { H.checkpoint(); t.name = nm.value || t.name; changed(); });
    var li = t.type === 'video' && t.surfaceId ? Seq.layerInfo(seq(), t.id) : null;
    if (li) {
      var bd = el('span', 'tl-lay' + (li.total > 1 ? ' multi' : ''), 'C' + li.n);
      bd.title = 'Camada ' + li.n + ' de ' + li.total + ' nesta face. A camada de cima aparece por cima na projeção (como no Final Cut).';
      r1.appendChild(bd);
    }
    r1.appendChild(nm);
    if (li) {
      var ad = el('button', 'tl-mini', '＋'); ad.type = 'button';
      ad.title = 'Adicionar camada acima desta face (sem limite)';
      ad.setAttribute('aria-label', 'Adicionar camada');
      ad.addEventListener('click', function (e) { e.stopPropagation(); addLayerFor(t.surfaceId); });
      r1.appendChild(ad);
      if (li.total > 1) {
        var up = el('button', 'tl-mini', '▲'); up.type = 'button'; up.title = 'Subir a camada (passa a ficar por cima)'; up.setAttribute('aria-label', 'Subir camada');
        up.addEventListener('click', function (e) { e.stopPropagation(); H.checkpoint(); if (Seq.moveLayer(seq(), t.id, -1)) changed(); });
        var dn = el('button', 'tl-mini', '▼'); dn.type = 'button'; dn.title = 'Descer a camada'; dn.setAttribute('aria-label', 'Descer camada');
        dn.addEventListener('click', function (e) { e.stopPropagation(); H.checkpoint(); if (Seq.moveLayer(seq(), t.id, +1)) changed(); });
        r1.appendChild(up); r1.appendChild(dn);
      }
    }
    var del = el('button', 'tl-mini', '✕'); del.type = 'button'; del.title = 'Apagar faixa'; del.setAttribute('aria-label', 'Apagar faixa');
    del.addEventListener('click', function (e) { e.stopPropagation(); H.checkpoint(); Seq.removeTrack(seq(), t.id); st.sel = {}; changed(); });
    r1.appendChild(del);
    function tog(label, title, key, inv) {
      var b = el('button', 'tl-mini' + ((inv ? !t[key] : t[key]) ? ' on' : ''), label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', function (e) { e.stopPropagation(); H.checkpoint(); t[key] = !t[key]; changed(); });
      return b;
    }
    if (t.type === 'video') {
      var sel = el('select'); sel.title = 'Face (superfície) que recebe esta faixa'; sel.setAttribute('aria-label', 'Face da faixa');
      var o0 = el('option', null, '(sem face)'); o0.value = ''; sel.appendChild(o0);
      H.surfaces().forEach(function (x) { var o = el('option', null, x.s.name + (x.scene !== H.state.scene ? ' · ' + x.sceneName : '')); o.value = x.s.key; sel.appendChild(o); });
      sel.value = t.surfaceId || '';
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
      sel.addEventListener('change', function () { H.checkpoint(); t.surfaceId = sel.value || null; if (t.surfaceId) { var f = surfaceOfKey(t.surfaceId); if (f && t.name.indexOf('Faixa ') === 0) t.name = f.s.name; } changed(); });
      r2.appendChild(sel);
      r2.appendChild(tog('◉', 'Mostrar ou esconder a faixa', 'enabled', false));
    } else {
      r2.appendChild(el('span', 'tl-tc', 'Áudio'));
      var sp = el('span'); sp.style.flex = '1'; r2.appendChild(sp);
      r2.appendChild(tog('M', 'Silenciar (mute)', 'muted', false));
    }
    r2.appendChild(tog('S', 'Solo: só esta faixa aparece ou toca', 'solo', false));
    r2.appendChild(tog('🔒', 'Travar a faixa', 'locked', false));
    h.appendChild(r1); h.appendChild(r2);
    if (t.type === 'video' && !t.surfaceId) { var w = el('div', 'tl-tc warn', 'Sem face: escolha uma'); r1.firstChild.title = 'Sem face associada'; h.title = 'Esta faixa não aparece em nenhuma superfície até você escolher a face.'; }
    h.addEventListener('pointerdown', function (e) {
      st.selTrack = t.id;
      if (t.type === 'video' && t.surfaceId) H.selectKey(t.surfaceId);
      // não reconstrói o cabeçalho se o toque foi num campo, senão o menu fecha na hora
      if (e.target.closest && e.target.closest('select,input,button')) return;
      refresh();
    });
    return h;
  }

  function clipEl(t, c, isBad) {
    var a = Seq.asset(seq(), c.assetId), kind = a ? a.kind : 'img';
    var d = el('div', 'tl-clip k-' + kind + (st.sel[c.id] ? ' sel' : '') + (isBad ? ' bad' : '') + (t.locked ? ' lk' : '') + (asOff(c) ? ' off' : ''));
    d.dataset.cid = c.id; d.dataset.tid = t.id;
    var CC = window.CompoundCore, grp = CC && c.cg ? CC.compById(seq(), c.cg) : null;
    if (grp) { d.classList.add('cp'); if (grp.open) d.classList.add('cpo'); d.style.setProperty('--cp', grp.color); d.dataset.cg = grp.id; }
    if (c.conn) { d.classList.add('cn'); d.dataset.parent = c.conn.to; }
    if (CC && CC.childrenOf(seq(), c.id, false).length) d.classList.add('cnp');
    var w = Math.max(6, c.duration * st.zoom);
    d.style.left = xOf(c.start) + 'px'; d.style.width = w + 'px';
    var rh = st.rowH - 8;
    if (a && (a.kind === 'video' || a.kind === 'img') && w > 20) {
      var cv = el('canvas'); cv.width = Math.min(2400, Math.round(w)); cv.height = rh; cv.style.width = Math.min(2400, Math.round(w)) + 'px'; cv.style.height = rh + 'px'; d.appendChild(cv);
      paintThumb(cv, a, c);
    }
    if (a && a.kind === 'audio' && w > 20) {
      var cv2 = el('canvas'); cv2.width = Math.min(3000, Math.round(w)); cv2.height = rh; cv2.style.width = cv2.width + 'px'; cv2.style.height = rh + 'px'; d.appendChild(cv2);
      paintWave(cv2, c, a);
    }
    if (c.fadeIn > 0) { var f1 = el('div', 'fd'); f1.style.left = '0'; f1.style.width = xOf(Math.min(c.fadeIn, c.duration)) + 'px'; d.appendChild(f1); }
    if (c.fadeOut > 0) { var f2 = el('div', 'fd o'); f2.style.right = '0'; f2.style.width = xOf(Math.min(c.fadeOut, c.duration)) + 'px'; d.appendChild(f2); }
    var cyc = Seq.cycleLen(c, a);
    if (c.loopMode === 'loop' && isFinite(cyc) && cyc * st.zoom > 8) {
      for (var k = 1; k * cyc < c.duration - 1e-6 && k < 400; k++) { var m = el('div', 'cyc'); m.style.left = xOf(k * cyc) + 'px'; d.appendChild(m); }
    }
    var lb = el('div', 'lb', (grp ? '▣ ' + grp.name + ' · ' : '') + (c.conn ? '⛓ ' : '') + (c.loopMode === 'loop' ? '↻ ' : '') + (c.name || (a && a.name) || 'Clipe')); d.appendChild(lb);
    if (w > 70) d.appendChild(el('div', 'lb2', Seq.fmt(c.duration) + (c.speed !== 1 ? ' · ' + c.speed + 'x' : '')));
    var seen = {};
    Object.keys(c.keyframes).forEach(function (p) { c.keyframes[p].forEach(function (kf) { var key = kf.t.toFixed(3); if (seen[key]) return; seen[key] = 1; var kx = kf.t * st.zoom; if (kx > w) return; var kd = el('div', 'kf' + (window.KeyframeUI && KeyframeUI.selAt(c.id, kf.t) ? ' sel' : '')); kd.style.left = kx + 'px'; kd.dataset.t = kf.t.toFixed(4); kd.title = 'Keyframe em ' + Seq.fmt(kf.t) + '. Arraste pra mover, Shift soma à seleção.'; d.appendChild(kd); }); });
    var l = el('div', 'th l'), r = el('div', 'th r'); d.appendChild(l); d.appendChild(r);
    return d;
  }

  // ---------- miniaturas e waveform ----------
  // Miniaturas: uma imagem imediata (1/3 do vídeo) e, em seguida, uma tira com vários quadros ao longo da mídia.
  // Cada pedaço do clipe mostra o quadro da mídia que está naquele ponto (respeita corte, velocidade e loop).
  var strips = {}, stripQ = [], stripBusy = false;
  function paintThumb(cv, a, c) {
    var key = a.id, t = thumbs[key];
    function draw() {
      var tc = thumbs[key]; if (!tc || !tc.cv) return;
      var ctx = cv.getContext('2d'), h = cv.height, tw = Math.max(20, Math.round(h * tc.cv.width / tc.cv.height)), sp = strips[key];
      var cyc = c ? Seq.cycleLen(c, a) : Infinity;
      for (var x = 0; x < cv.width; x += tw) {
        var src = tc.cv;
        if (sp && sp.frames && sp.frames.length && c && a.kind === 'video') {
          var tt = (x + tw / 2) / st.zoom;
          if (c.loopMode === 'loop' && isFinite(cyc) && cyc > 0) tt = tt % cyc;
          var st0 = c.inPoint + tt * c.speed, idx = Math.max(0, Math.min(sp.frames.length - 1, Math.round(st0 / sp.dur * sp.frames.length - 0.5)));
          src = sp.frames[idx] || tc.cv;
        }
        ctx.drawImage(src, x, 0, tw, h);
      }
    }
    if (t && t.cv) { draw(); if (a.kind === 'video' && !strips[key] && (a.duration || 0) > 2) { strips[key] = { pending: true }; stripQ.push(a); nextStrip(); } return; }
    if (t) return;
    thumbs[key] = { cv: null, pending: true };
    if (a.kind === 'img') {
      var im = new Image();
      im.onload = function () { var c2 = document.createElement('canvas'); c2.width = 96; c2.height = Math.max(1, Math.round(96 * (im.naturalHeight || 54) / (im.naturalWidth || 96))); c2.getContext('2d').drawImage(im, 0, 0, c2.width, c2.height); thumbs[key] = { cv: c2 }; refresh(); };
      im.onerror = function () { thumbs[key] = { cv: null, fail: true }; };
      im.src = a.src || '';
    } else {
      thumbQ.push(a); nextThumb();
    }
  }
  function nextStrip() {
    if (stripBusy || !stripQ.length) return;
    stripBusy = true;
    var a = stripQ.shift(), v = document.createElement('video'), frames = [], i = 0, done = false, N = Math.max(6, Math.min(30, Math.round((a.duration || 6) / 1.5)));
    function fin(ok) {
      if (done) return; done = true;
      strips[a.id] = ok && frames.length === N ? { frames: frames, dur: a.duration } : { fail: true };
      v.removeAttribute('src'); try { v.load(); } catch (e) {}
      stripBusy = false; if (ok) refresh(); nextStrip();
    }
    function grab() {
      try { var c = document.createElement('canvas'); c.width = 96; c.height = Math.max(1, Math.round(96 * (v.videoHeight || 54) / (v.videoWidth || 96))); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); frames.push(c); } catch (e) { return fin(false); }
      i++; if (i >= N) return fin(true);
      try { v.currentTime = Math.min(a.duration - 0.05, (i + 0.5) * a.duration / N); } catch (e) { fin(false); }
    }
    v.muted = true; v.preload = 'auto';
    v.addEventListener('loadeddata', function () { try { v.currentTime = Math.min(a.duration - 0.05, 0.5 * a.duration / N); } catch (e) { fin(false); } });
    v.addEventListener('seeked', grab);
    v.addEventListener('error', function () { fin(false); });
    setTimeout(function () { fin(false); }, 25000);
    v.src = a.src || '';
  }
  function nextThumb() {
    if (thumbBusy || !thumbQ.length) return;
    thumbBusy = true;
    var a = thumbQ.shift(), v = document.createElement('video'), done = false;
    function fin(ok) {
      if (done) return; done = true;
      if (ok) { try { var c = document.createElement('canvas'); c.width = 96; c.height = Math.max(1, Math.round(96 * (v.videoHeight || 54) / (v.videoWidth || 96))); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); thumbs[a.id] = { cv: c }; } catch (e) { thumbs[a.id] = { cv: null, fail: true }; } }
      else thumbs[a.id] = { cv: null, fail: true };
      v.removeAttribute('src'); try { v.load(); } catch (e) {}
      thumbBusy = false; refresh(); nextThumb();
    }
    v.muted = true; v.preload = 'auto';
    v.addEventListener('loadeddata', function () { try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) { fin(true); } });
    v.addEventListener('seeked', function () { fin(true); });
    v.addEventListener('error', function () { fin(false); });
    setTimeout(function () { fin(false); }, 6000);
    v.src = a.src || '';
  }
  function paintWave(cv, c, a) {
    var w = waves[a.id];
    var ctx = cv.getContext('2d'), h = cv.height, mid = h / 2;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    if (w && w.peaks) {
      var P = w.peaks, n = P.length, dur = w.dur || a.duration || 1;
      var segS = c.inPoint, segE = c.outPoint != null ? c.outPoint : dur, cyc = Seq.cycleLen(c, a);
      for (var x = 0; x < cv.width; x++) {
        var tt = (x / st.zoom), tt1 = ((x + 1) / st.zoom);
        if (c.loopMode === 'loop' && isFinite(cyc) && cyc > 0) { tt = tt % cyc; tt1 = tt + 1 / st.zoom; }
        var s0 = segS + tt * c.speed, s1 = segS + tt1 * c.speed;
        if (s0 > segE) continue;
        var i0 = Math.min(n - 1, Math.floor(s0 / dur * n)), i1 = Math.min(n - 1, Math.max(i0, Math.floor(s1 / dur * n))), mx = 0;
        for (var i = i0; i <= i1; i++) if (P[i] > mx) mx = P[i];
        var v = Math.max(0.5, mx * (mid - 2));
        ctx.fillRect(x, mid - v, 1, v * 2);
      }
      if (c.fadeIn > 0 || c.fadeOut > 0) { /* fades já aparecem como sombras da barra */ }
    } else {
      ctx.fillRect(0, mid, cv.width, 1);
      loadWave(a);
    }
  }
  function loadWave(a) {
    if (waves[a.id] || waveBusy[a.id] || !a.src) return;
    waveBusy[a.id] = 1;
    function fin(peaks, dur) { waves[a.id] = { peaks: peaks, dur: dur }; delete waveBusy[a.id]; refresh(); }
    function fromBuf(buf) {
      var AC = window.AudioContext || window.webkitAudioContext;
      try {
        var ac = new AC();
        var p = ac.decodeAudioData(buf, function (ab) { done(ab); ac.close(); }, function () { fin(null, 0); try { ac.close(); } catch (e) {} });
        if (p && p.then) p.catch(function () {});
      } catch (e) { fin(null, 0); }
      function done(ab) {
        // 100 picos por segundo (mín. 1200, máx. 60000), usando o maior valor entre os canais
        var n = Math.max(1200, Math.min(60000, Math.ceil(ab.duration * 100))), len = ab.length, step = Math.max(1, Math.floor(len / n)), peaks = new Float32Array(n), i, j, k, chs = [];
        for (k = 0; k < ab.numberOfChannels; k++) chs.push(ab.getChannelData(k));
        for (i = 0; i < n; i++) { var mx = 0, s0 = i * step, jstep = Math.max(1, step >> 5); for (j = 0; j < step; j += jstep) for (k = 0; k < chs.length; k++) { var v = Math.abs(chs[k][s0 + j] || 0); if (v > mx) mx = v; } peaks[i] = Math.min(1, mx); }
        fin(peaks, ab.duration);
      }
    }
    if (a.path && H.api.readBytes) {
      H.api.readBytes(a.path).then(function (b) { if (!b) return tryFetch(); var u8 = b instanceof Uint8Array ? b : new Uint8Array(b); fromBuf(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)); }).catch(tryFetch);
    } else tryFetch();
    function tryFetch() {
      try { fetch(a.src).then(function (r) { return r.arrayBuffer(); }).then(fromBuf).catch(function () { fin(null, 0); }); } catch (e) { fin(null, 0); }
    }
  }

  // ---------- régua ----------
  var STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  function drawRuler() {
    if (!st.built || !tl.on) return;
    var w = rulerWrap.clientWidth || 600, h = 26, dpr = window.devicePixelRatio || 1;
    if (rulerCv.width !== Math.round(w * dpr)) { rulerCv.width = Math.round(w * dpr); rulerCv.height = Math.round(h * dpr); rulerCv.style.width = w + 'px'; rulerCv.style.height = h + 'px'; }
    var ctx = rulerCv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    var sx = scrollEl.scrollLeft, z = st.zoom, step = STEPS[STEPS.length - 1], i;
    for (i = 0; i < STEPS.length; i++) if (STEPS[i] * z >= 70) { step = STEPS[i]; break; }
    var minor = step / (step >= 1 && step % 5 === 0 ? 5 : (step >= 1 ? 2 : 5));
    var t0 = Math.floor(sx / z / minor) * minor, t1 = (sx + w) / z;
    ctx.strokeStyle = '#4a5568'; ctx.fillStyle = '#9aa4b2'; ctx.font = '10px ui-monospace,Menlo,monospace'; ctx.textBaseline = 'top';
    var lp = seq().settings.loop;
    if (lp.on) { var lo = (lp.in || 0) * z - sx, hi = (lp.out == null ? seq().duration : lp.out) * z - sx; ctx.fillStyle = 'rgba(255,210,61,.25)'; ctx.fillRect(lo, 0, hi - lo, 4); ctx.fillStyle = '#9aa4b2'; }
    for (var t = t0; t <= t1 + minor; t += minor) {
      var x = Math.round(t * z - sx) + 0.5, major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
      ctx.beginPath(); ctx.moveTo(x, major ? 12 : 19); ctx.lineTo(x, h); ctx.stroke();
      if (major) { var lab = step < 1 ? Seq.fmt(t) : (step >= 60 ? Math.round(t / 60) + ' min' : (Seq.fmt(t).slice(0, 5))); ctx.fillText(lab, x + 3, 2); }
    }
    drawMarkers();
    var dx = seq().duration * z - sx; ctx.strokeStyle = '#ff5c5c'; ctx.beginPath(); ctx.moveTo(dx + .5, 0); ctx.lineTo(dx + .5, h); ctx.stroke();
  }

  function updatePlayhead() {
    if (!st.built || !tl.on) return;
    var t = now(), x = xOf(t);
    phLine.style.left = x + 'px';
    phHead.style.left = (x - scrollEl.scrollLeft) + 'px';
    if (window.KeyframeUI) KeyframeUI.updatePlayhead();
    var txt = Seq.fmt(t);
    if (!st.typing && timeBox.value !== txt) timeBox.value = txt;
    var tc = Seq.timecode(t, fps());
    bar._c.tc.textContent = tc;
    vtime.textContent = txt + '  ' + tc;
    if (tl.clock.playing && !st.drag) {
      var vis = scrollEl.clientWidth, sl = scrollEl.scrollLeft;
      if (x > sl + vis - 30 || x < sl) { scrollEl.scrollLeft = Math.max(0, x - 40); }
    }
  }

  // ---------- eventos ----------
  function wire() {
    scrollEl.addEventListener('scroll', function () { headsIn.style.transform = 'translateY(' + (-scrollEl.scrollTop) + 'px)'; drawRuler(); drawMarkers(); updatePlayhead(); if (window.KeyframeUI) KeyframeUI.syncScroll(); });
    headsWrap.addEventListener('wheel', function (e) { scrollEl.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    scrollEl.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, tOfClient(e.clientX)); }
    }, { passive: false });
    document.addEventListener('pointerdown', function (e) { st.dockFocus = !!(dock && dock.contains(e.target)); }, true);
    // régua: arrastar = scrub
    rulerWrap.addEventListener('pointerdown', function (e) {
      e.preventDefault(); st.drag = { type: 'scrub' };
      seek(tOfRuler(e.clientX));
      function mv(ev) { seek(snapT(tOfRuler(ev.clientX), true)); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); st.drag = null; }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    rulerWrap.addEventListener('dblclick', function (e) { H.checkpoint(); Seq.addMarker(seq(), tOfRuler(e.clientX), ''); changed(); });
    // clipes
    lanesEl.addEventListener('pointerdown', onLaneDown);
    lanesEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var ce = e.target.closest && e.target.closest('.tl-clip'), ln = e.target.closest && e.target.closest('.tl-lane'), tAt = tOfClient(e.clientX);
      if (ce) { if (!st.sel[ce.dataset.cid]) { st.sel = {}; st.sel[ce.dataset.cid] = 1; st.anchor = ce.dataset.cid; refresh(); } clipMenu(e, ce.dataset.cid, tAt); }
      else if (ln) laneMenu(e, ln.dataset.tid, tAt);
    });
    rulerWrap.addEventListener('contextmenu', function (e) { e.preventDefault(); rulerMenu(e, tOfRuler(e.clientX)); });
    lanesEl.addEventListener('dblclick', function (e) {
      var ce = e.target.closest && e.target.closest('.tl-clip');
      if (ce) { H.setTab('timeline', true); }
    });
    // arquivos soltos
    lanesEl.addEventListener('dragover', function (e) { if (e.dataTransfer && ([].indexOf.call(e.dataTransfer.types || [], 'Files') > -1 || [].indexOf.call(e.dataTransfer.types || [], 'application/x-lenzi-asset') > -1)) { e.preventDefault(); var ln = e.target.closest && e.target.closest('.tl-lane'); [].forEach.call(lanesEl.querySelectorAll('.tl-lane.drop'), function (x) { x.classList.remove('drop'); }); if (ln) ln.classList.add('drop'); } });
    lanesEl.addEventListener('dragleave', function () { [].forEach.call(lanesEl.querySelectorAll('.tl-lane.drop'), function (x) { x.classList.remove('drop'); }); });
    lanesEl.addEventListener('drop', function (e) {
      var aid = e.dataTransfer && e.dataTransfer.getData && e.dataTransfer.getData('application/x-lenzi-asset');
      if (aid) {
        e.preventDefault(); e.stopPropagation();
        [].forEach.call(lanesEl.querySelectorAll('.tl-lane.drop'), function (x) { x.classList.remove('drop'); });
        var da = Seq.asset(seq(), aid), dl = e.target.closest && e.target.closest('.tl-lane'), dt = dl ? Seq.track(seq(), dl.dataset.tid) : null;
        if (da && !da._off) placeAsset(da, dt, tOfClient(e.clientX)); else if (da) H.say('A mídia está offline. Reconecte antes de usar.');
        return;
      }
      var files = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (!files.length) return;
      e.preventDefault(); e.stopPropagation();
      [].forEach.call(lanesEl.querySelectorAll('.tl-lane.drop'), function (x) { x.classList.remove('drop'); });
      var ln = e.target.closest && e.target.closest('.tl-lane'), tr = ln ? Seq.track(seq(), ln.dataset.tid) : null, t0 = tOfClient(e.clientX);
      var paths = files.map(function (f) { return H.api.pathFor(f); }).filter(Boolean);
      importPaths(paths, tr, t0);
    });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', refresh);
    var hb = setInterval(function () { if (tl.on && tl.clock.playing && H.isOutOpen()) pushTr(); }, 1000);
    // laço do playhead (só a interface; o tempo vem do relógio)
    (function loop() {
      if (tl.on && st.built) {
        updatePlayhead();
        if (tl.clock.ended && tl.clock.playing) { tl.clock.pause(); pushTr(); H.push(); refresh(); }
        st.tick++;
        var play = tl.clock.playing;
        if (bar._c && bar._c.play.textContent !== (play ? '❚❚' : '▶')) bar._c.play.textContent = play ? '❚❚' : '▶';
        if (st.tick % 8 === 0) { syncInspector(true); updateStat(); }
      }
      requestAnimationFrame(loop);
    })();
  }

  // Encaixe de verdade (null se nada por perto). scrub = true quando é o próprio playhead que está andando.
  function snapPoint(t, scrub) {
    if (!seq().settings.snap) return null;
    var r = Seq.snapTime(seq(), t, snapOpts().px / st.zoom, scrub ? null : now(), st.drag && st.drag.id);
    return r === t ? null : r;
  }
  function snapT(t, scrub) { var r = snapPoint(t, scrub); return r == null ? (snapOpts().frames || !seq().settings.snap ? Seq.quant(t, fps()) : t) : r; }
  function snapOpts() { return Seq.fixSnapOpts(seq().settings.snapOpts); }

  function selectClip(id, additive, range) {
    var CC = window.CompoundCore;
    if (range && st.anchor && Seq.findClip(seq(), st.anchor) && window.TlEdit) {
      st.sel = {}; TlEdit.selectRange(seq(), st.anchor, id).forEach(function (i) { st.sel[i] = 1; });
    } else if (additive) {
      if (st.sel[id]) { delete st.sel[id]; if (CC) CC.selectionClosure(seq(), [id]).forEach(function (i) { delete st.sel[i]; }); } else st.sel[id] = 1;
      st.anchor = id;
    }
    else { if (!st.sel[id]) { st.sel = {}; st.sel[id] = 1; } st.anchor = id; }
    if (CC && st.sel[id]) CC.selectionClosure(seq(), selIds()).forEach(function (i) { st.sel[i] = 1; });   // composto fechado: seleciona o grupo todo
    var f = Seq.findClip(seq(), id);
    if (f) { st.selTrack = f.track.id; if (f.track.type === 'video' && f.track.surfaceId && !additive && !range) { H.selectKey(f.track.surfaceId); if (H.state.mode !== 'clip' && Seq.asset(seq(), f.clip.assetId)) { H.setMode('clip'); } } }
  }

  // ---------- ferramentas de edição (Seleção e Trim) ----------
  function setEdit(m) { st.edit = m; H.say(m === 'trim' ? 'Trim: arraste a borda (Ripple), o corte entre dois clipes (Roll), o corpo (Slip) ou Alt + corpo (Slide). Só a faixa do clipe é afetada.' : 'Ferramenta de seleção.'); refresh(); }
  function snapTrack(tr) { return { dur: seq().duration, list: tr.clips.map(function (c) { return { c: c, start: c.start, duration: c.duration, inPoint: c.inPoint, outPoint: c.outPoint }; }) }; }
  function restoreTrack(sn) { sn.list.forEach(function (x) { x.c.start = x.start; x.c.duration = x.duration; x.c.inPoint = x.inPoint; x.c.outPoint = x.outPoint; }); seq().duration = sn.dur; }
  // vizinho que encosta no clipe numa das bordas (corte entre dois clipes da mesma faixa)
  function touching(tr, c, side) {
    var best = null;
    tr.clips.forEach(function (x) { if (x === c) return; if (side === 'r' && Math.abs(x.start - (c.start + c.duration)) < 0.01) best = x; if (side === 'l' && Math.abs((x.start + x.duration) - c.start) < 0.01) best = x; });
    return best;
  }
  function lanesPoint(e) { var r = lanesEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function marqueeStart(e, additive) {
    var p0 = lanesPoint(e), box = el('div', 'tl-marq'), moved = false, base = additive ? Object.assign({}, st.sel) : {};
    lanesEl.appendChild(box);
    function mv(ev) {
      var p1 = lanesPoint(ev);
      if (!moved && Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y) < 4) return;
      moved = true;
      var l = Math.min(p0.x, p1.x), t = Math.min(p0.y, p1.y), w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
      box.style.left = l + 'px'; box.style.top = t + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
      var ia = Math.max(0, Math.floor(p0.y / st.rowH)), ib = Math.max(0, Math.floor(p1.y / st.rowH));
      var ids = TlEdit.selectRect(seq(), l / st.zoom, (l + w) / st.zoom, ia, ib), sel = Object.assign({}, base);
      ids.forEach(function (i) { sel[i] = 1; }); st.sel = sel;
      [].forEach.call(lanesEl.querySelectorAll('.tl-clip'), function (ce) { ce.classList.toggle('sel', !!st.sel[ce.dataset.cid]); });
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); box.remove(); if (!moved && !additive) st.sel = {}; var f = firstSel(); if (f) st.anchor = f.clip.id; refresh(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  function onLaneDown(e) {
    if (e.button !== 0) return;
    var ce = e.target.closest && e.target.closest('.tl-clip');
    if (!ce) {
      if (e.altKey && window.TlEdit) { e.preventDefault(); marqueeStart(e, e.shiftKey || e.metaKey || e.ctrlKey); return; }
      // clique no vazio: tira a seleção; clicar na faixa seleciona a faixa e a face
      var ln = e.target.closest && e.target.closest('.tl-lane');
      st.sel = {}; st.selMk = null;
      if (ln) { st.selTrack = ln.dataset.tid; var tr0 = Seq.track(seq(), ln.dataset.tid); if (tr0 && tr0.type === 'video' && tr0.surfaceId) H.selectKey(tr0.surfaceId); }
      seek(tOfClient(e.clientX));
      var mv0 = function (ev) { seek(snapT(tOfClient(ev.clientX), true)); };
      var up0 = function () { window.removeEventListener('pointermove', mv0); window.removeEventListener('pointerup', up0); };
      window.addEventListener('pointermove', mv0); window.addEventListener('pointerup', up0);
      refresh();
      return;
    }
    var cid = ce.dataset.cid, tr = Seq.track(seq(), ce.dataset.tid), f = Seq.findClip(seq(), cid);
    if (!f) return;
    e.preventDefault();
    if (e.target.classList && e.target.classList.contains('kf') && window.KeyframeUI && !tr.locked) {
      selectClip(cid, false);
      if (KeyframeUI.barDown(e, cid, parseFloat(e.target.dataset.t))) return;
    }
    selectClip(cid, e.metaKey || e.ctrlKey, e.shiftKey);
    if (e.shiftKey && !e.metaKey && !e.ctrlKey) { refresh(); return; }   // Shift+clique só seleciona o intervalo
    if (tr.locked) { H.say('Faixa travada. Destrave pra editar.'); refresh(); return; }
    var zone = e.target.classList.contains('th') ? (e.target.classList.contains('l') ? 'trimL' : 'trimR') : 'move';
    var rect = ce.getBoundingClientRect();
    if (zone === 'move' && rect.width > 26) { if (e.clientX - rect.left < 5) zone = 'trimL'; else if (rect.right - e.clientX < 5) zone = 'trimR'; }
    var CC0 = window.CompoundCore, g0 = CC0 && f.clip.cg ? CC0.compById(seq(), f.clip.cg) : null;
    if (g0 && !g0.open && (zone === 'trimL' || zone === 'trimR')) { H.say('Composto fechado: abra o composto (menu do clipe > Editar conteúdo) para aparar um clipe dele.'); refresh(); return; }
    var c = f.clip, ids = selIds(), starts = {};
    if (CC0 && zone === 'move') ids = CC0.dragSet(seq(), CC0.selectionClosure(seq(), ids));   // acompanham: membros de composto fechado e clipes conectados
    ids.forEach(function (i) { var ff = Seq.findClip(seq(), i); if (ff) starts[i] = ff.clip.start; });
    var type = zone, extra = {};
    if (st.edit === 'trim' && window.TlEdit) {
      if (zone === 'trimL' || zone === 'trimR') {
        var nb = touching(tr, c, zone === 'trimR' ? 'r' : 'l');
        if (nb) { type = 'roll'; extra = zone === 'trimR' ? { A: c, B: nb } : { A: nb, B: c }; }
        else type = zone === 'trimR' ? 'rtrimR' : 'rtrimL';
      } else type = e.altKey ? 'slide' : 'slip';
      extra.snap = snapTrack(tr); if (extra.B) extra.cut0 = extra.B.start;
    }
    st.drag = { type: type, id: cid, x0: e.clientX, y0: e.clientY, start0: c.start, end0: Seq.endOf(c), starts: starts, moved: false, tid0: tr.id, extra: extra };
    var drag = st.drag, warned = false;
    function warn(r) { if (r && !r.ok && !warned) { warned = true; H.say('Não foi possível: ' + (r.reason || 'limite da mídia') + '.'); } }
    function mv(ev) {
      var dx = (ev.clientX - drag.x0) / st.zoom;
      if (!drag.moved && Math.abs(ev.clientX - drag.x0) + Math.abs(ev.clientY - drag.y0) < 3) return;
      if (!drag.moved) { drag.moved = true; H.checkpoint(); }
      if (drag.type === 'move') {
        var nt = drag.start0 + dx, len = drag.end0 - drag.start0;
        var sa = snapPoint(nt, false), sb = snapPoint(nt + len, false);
        if (sb != null) sb -= len;
        var pick = snapOpts().frames || !seq().settings.snap ? Seq.quant(nt, fps()) : nt;
        if (sa != null && (sb == null || Math.abs(sa - nt) <= Math.abs(sb - nt))) pick = sa; else if (sb != null) pick = sb;
        var delta = Math.max(-Math.min.apply(null, Object.keys(drag.starts).map(function (k) { return drag.starts[k]; })), pick - drag.start0);
        var ln = document.elementFromPoint(ev.clientX, ev.clientY), laneEl = ln && ln.closest && ln.closest('.tl-lane'), toT = null;
        if (laneEl && Object.keys(drag.starts).length === 1 && laneEl.dataset.tid !== drag.tid0) { var tt = Seq.track(seq(), laneEl.dataset.tid), ft = Seq.findClip(seq(), drag.id); if (tt && !tt.locked && ft && tt.type === ft.track.type) toT = tt.id; }
        Object.keys(drag.starts).forEach(function (k) { Seq.moveClip(seq(), k, drag.starts[k] + delta, k === drag.id ? toT : null); });
        if (toT) { drag.tid0 = toT; st.selTrack = toT; }
      } else if (drag.type === 'trimL') {
        Seq.trimClip(seq(), drag.id, 'l', snapT(drag.start0 + dx, false));
      } else if (drag.type === 'trimR') {
        Seq.trimClip(seq(), drag.id, 'r', snapT(drag.end0 + dx, false));
      } else {
        // ferramentas do Trim: sempre recalculam a partir do estado do começo do arrasto (sem erro acumulado)
        restoreTrack(drag.extra.snap);
        if (drag.type === 'rtrimR') warn(TlEdit.rippleTrim(seq(), drag.id, 'r', snapT(drag.end0 + dx, false)));
        else if (drag.type === 'rtrimL') warn(TlEdit.rippleTrim(seq(), drag.id, 'l', snapT(drag.start0 + dx, false)));
        else if (drag.type === 'roll') warn(TlEdit.rollEdit(seq(), drag.extra.A.id, drag.extra.B.id, snapT(drag.extra.cut0 + dx, false)));
        else if (drag.type === 'slip') warn(TlEdit.slipClip(seq(), drag.id, -dx * c.speed));
        else if (drag.type === 'slide') warn(TlEdit.slideClip(seq(), drag.id, snapT(drag.start0 + dx, false)));
      }
      H.syncClock(); H.push(); refresh();
    }
    function up() {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      st.drag = null; changed();
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    refresh();
  }

  function onKey(e) {
    if (!tl.on) return;
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var cmd = e.metaKey || e.ctrlKey;
    function eat() { e.preventDefault(); e.stopImmediatePropagation(); }
    if (e.code === 'Space' && !cmd) { eat(); togglePlay(); return; }
    if (!st.dockFocus) return;
    if (window.KeyframeUI && KeyframeUI.key(e)) return;
    var k = e.key;
    if (cmd && (k === 'c' || k === 'C')) { eat(); copySel(); return; }
    if (cmd && (k === 'v' || k === 'V')) { eat(); pasteSel(); return; }
    if (cmd && (k === 'x' || k === 'X')) { eat(); copySel(); delSel(); return; }
    if (cmd && (k === 'd' || k === 'D')) { eat(); dupSel(); return; }
    if (cmd && (k === 'g' || k === 'G')) { eat(); if (e.shiftKey) breakCompound(compOfSel()); else makeCompoundSel(); return; }
    if (cmd && (k === 'a' || k === 'A')) { eat(); st.sel = {}; seq().tracks.forEach(function (t) { t.clips.forEach(function (c) { st.sel[c.id] = 1; }); }); refresh(); return; }
    if (cmd) return;
    if ((k === 'Delete' || k === 'Backspace') && e.shiftKey && selIds().length) { eat(); rippleDelSel(); return; }
    if (k === 'Delete' || k === 'Backspace') { if (selIds().length) { eat(); delSel(); } else if (st.selMk) { eat(); H.checkpoint(); TlEdit.removeMarker(seq(), st.selMk); st.selMk = null; changed(); } return; }
    if (k === 'a' || k === 'A') { eat(); setEdit('select'); return; }
    if (k === 't' || k === 'T') { eat(); setEdit('trim'); return; }
    if (k === 'n' || k === 'N') { eat(); seq().settings.snap = !seq().settings.snap; H.checkpoint(); H.say(seq().settings.snap ? 'Imã ligado.' : 'Imã desligado.'); refresh(); return; }
    if (k === 'x' || k === 'X') { eat(); if (e.altKey) { setLoopMode('off'); } else markSelRange(); return; }
    if (k === ',' || k === '<') { eat(); nudgeSel(-(e.shiftKey ? 10 : 1) / fps()); return; }
    if (k === '.' || k === '>') { eat(); nudgeSel((e.shiftKey ? 10 : 1) / fps()); return; }
    if (k === 'ArrowUp' && !e.altKey) { eat(); if (e.shiftKey) gotoMarker(-1); else gotoEdit(-1); return; }
    if (k === 'ArrowDown' && !e.altKey) { eat(); if (e.shiftKey) gotoMarker(1); else gotoEdit(1); return; }
    if (k === '?' || (k === '/' && e.shiftKey)) { eat(); showHelp(); return; }
    if (k === 's' || k === 'S') { eat(); splitSel(); return; }
    if (k === 'm' || k === 'M') { eat(); addMarker(); return; }
    if (k === 'i' || k === 'I') { eat(); setIO('in'); return; }
    if (k === 'o' || k === 'O') { eat(); setIO('out'); return; }
    if (k === 'k' || k === 'K') { eat(); keyAll(); return; }
    if (k === 'ArrowLeft') { eat(); seek(now() - (e.shiftKey ? 1 : 1 / fps())); return; }
    if (k === 'ArrowRight') { eat(); seek(now() + (e.shiftKey ? 1 : 1 / fps())); return; }
    if (k === 'Home') { eat(); seek(0); return; }
    if (k === 'End') { eat(); seek(seq().duration); return; }
    if (k === '=' || k === '+') { eat(); zoom(1.4); return; }
    if (k === '-') { eat(); zoom(1 / 1.4); return; }
    if (k === '\\') { eat(); zoomFit(); return; }
    if (k === 'Escape') { eat(); st.sel = {}; st.selMk = null; if (window.TlMenu) TlMenu.close(); refresh(); return; }
  }

  // ---------- operações avançadas ----------
  function rippleDelSel() {
    var ids = selIds(); if (!ids.length) return;
    H.checkpoint(); var r = TlEdit.rippleDelete(seq(), ids);
    st.sel = {}; changed(); H.say(r.removed + ' clipe(s) apagado(s) e o espaço fechado só nas faixas deles.');
  }
  function nudgeSel(dt) { var ids = selIds(); if (!ids.length) return; H.checkpoint('nudgeclip'); var r = TlEdit.nudge(seq(), ids, dt); if (!r.ok) H.say('Faixa travada.'); changed(); }
  function alignSel(edge) { var ids = selIds(); if (!ids.length) return; H.checkpoint(); TlEdit.alignTo(seq(), ids, now(), edge); changed(); }
  function equalSel() { var ids = selIds(); H.checkpoint(); var r = TlEdit.equalLength(seq(), ids); if (!r.ok) H.say(r.reason + '.'); changed(); }
  function joinSel() { var ids = selIds(); if (ids.length < 2) { H.say('Selecione pelo menos 2 clipes da mesma faixa.'); return; } H.checkpoint(); TlEdit.joinSelected(seq(), ids); changed(); }
  function closeGapsOf(tid) { H.checkpoint(); var r = TlEdit.closeGaps(seq(), tid); if (!r.ok) H.say('Não foi possível: ' + r.reason + '.'); else H.say(r.moved.length ? r.moved.length + ' clipe(s) encostado(s). Só esta faixa foi alterada.' : 'Não havia espaços.'); changed(); }
  function selectFwd(trackId) { st.sel = {}; TlEdit.selectForward(seq(), now(), trackId).forEach(function (i) { st.sel[i] = 1; }); refresh(); }
  function selectWholeTrack(tid) { st.sel = {}; TlEdit.selectTrack(seq(), tid).forEach(function (i) { st.sel[i] = 1; }); st.selTrack = tid; refresh(); }
  function markSelRange() {
    var b = TlEdit.rangeOf(seq(), selIds()); if (!b) { H.say('Selecione clipes pra marcar o intervalo.'); return; }
    H.checkpoint(); var lp = seq().settings.loop; lp.on = true; lp.in = b.start; lp.out = b.end; H.syncClock(); pushTr(); changed(); H.say('Loop do intervalo definido pela seleção.');
  }
  function gotoEdit(dir) { var t = TlEdit.nextEdit(seq(), now(), dir, false); if (t == null) { H.say(dir > 0 ? 'Não há mais cortes à frente.' : 'Não há cortes antes.'); return; } seek(t); }
  function gotoMarker(dir) { var m = TlEdit.nextMarker(seq(), now(), dir); if (!m) { H.say('Sem marcador nessa direção.'); return; } st.selMk = m.id; seek(m.t); refresh(); }

  // ---------- menus de contexto ----------

  // ---------- Fase 7: clipes conectados e compostos (ações) ----------
  function ccOk(r, okMsg) { if (!r.ok) { H.say(r.error || 'Não foi possível.'); return false; } if (okMsg) H.say(okMsg); return true; }
  function connectSel(parentId) {
    var CC = window.CompoundCore; if (!CC) return;
    var ids = selIds().filter(function (i) { return i !== parentId; });
    if (!ids.length) { H.say('Selecione os clipes filhos e use o menu no clipe principal.'); return; }
    H.checkpoint(); var r = CC.connect(seq(), ids, parentId);
    if (ccOk(r, r.ok ? (r.connected.length + ' clipe(s) conectado(s). Eles andam junto com o principal.' + (r.skipped.length ? ' Ignorado(s) por ciclo: ' + r.skipped.join(', ') + '.' : '')) : '')) changed();
  }
  function disconnectSel() { var CC = window.CompoundCore; if (!CC) return; H.checkpoint(); var r = CC.disconnect(seq(), selIds()); H.say(r.count ? r.count + ' conexão(ões) desfeita(s).' : 'Nenhum clipe conectado na seleção.'); changed(); }
  function makeCompoundSel() {
    var CC = window.CompoundCore; if (!CC) return;
    H.checkpoint(); var r = CC.makeCompound(seq(), selIds());
    if (!r.ok) { H.say(r.error); return; }
    st.sel = {}; r.members.forEach(function (i) { st.sel[i] = 1; }); H.say('Composto criado: ' + r.compound.name + '. Use "Abrir composto" para editar o conteúdo.'); changed();
  }
  function compOfSel() { var f = firstSel(), CC = window.CompoundCore; return f && f.clip.cg && CC ? CC.compById(seq(), f.clip.cg) : null; }
  function setCompOpen(g, open) { var CC = window.CompoundCore; if (!g) return; H.checkpoint(); CC.setOpen(seq(), g.id, open); H.say(open ? 'Composto aberto: edite os clipes um a um.' : 'Composto fechado: volta a andar como uma unidade.'); changed(); }
  function breakCompound(g) { var CC = window.CompoundCore; if (!g) return; H.checkpoint(); var r = CC.breakApart(seq(), g.id); H.say('Composto separado: ' + r.released + ' clipe(s) livre(s). Os tempos não mudaram.'); changed(); }
  function renameComp(g) { var CC = window.CompoundCore; if (!g) return; var n = root.prompt ? root.prompt('Nome do composto', g.name) : null; if (n == null) return; H.checkpoint(); if (ccOk(CC.renameCompound(seq(), g.id, n))) changed(); }
  function compItems(f) {
    var CC = window.CompoundCore; if (!CC) return [];
    var c = f.clip, n = selIds().length, g = c.cg ? CC.compById(seq(), c.cg) : null, out = ['-'];
    out.push({ label: 'Criar clipe composto', hint: '⌘G', disabled: n < 2 || !!g, fn: makeCompoundSel });
    if (g) {
      out.push({ label: g.open ? 'Fechar composto "' + g.name + '"' : 'Abrir composto "' + g.name + '" (editar conteúdo)', fn: function () { setCompOpen(g, !g.open); } });
      out.push({ label: 'Separar composto', hint: '⇧⌘G', fn: function () { breakCompound(g); } });
      out.push({ label: 'Renomear composto…', fn: function () { renameComp(g); } });
    }
    out.push({ label: 'Conectar selecionados a este clipe', disabled: n < 2, fn: function () { connectSel(c.id); } });
    out.push({ label: 'Desconectar', disabled: !c.conn && !CC.childrenOf(seq(), c.id).length && n < 2, fn: disconnectSel });
    return out;
  }
  function clipMenu(e, cid, tAt) {
    var f = Seq.findClip(seq(), cid); if (!f) return;
    var n = selIds().length, c = f.clip, tr = f.track, ph = now();
    var cuttable = ph > c.start + 0.04 && ph < Seq.endOf(c) - 0.04;
    var items = [
      { header: n > 1 ? n + ' clipes selecionados' : (c.name || 'Clipe') },
      { label: 'Cortar no playhead', hint: 'S', disabled: !cuttable, fn: splitSel },
      { label: 'Copiar', hint: '⌘C', fn: copySel }, { label: 'Colar no playhead', hint: '⌘V', disabled: !(st.clipboard && st.clipboard.length), fn: pasteSel },
      { label: 'Duplicar', hint: '⌘D', fn: dupSel },
      '-',
      { label: 'Apagar', hint: '⌫', fn: delSel },
      { label: 'Ripple Delete (fecha o espaço na faixa)', hint: '⇧⌫', fn: rippleDelSel },
      '-',
      { label: 'Alinhar começo ao playhead', fn: function () { alignSel('start'); } },
      { label: 'Alinhar fim ao playhead', fn: function () { alignSel('end'); } },
      { label: 'Mesma duração do primeiro', disabled: n < 2, fn: equalSel },
      { label: 'Emendar selecionados (mesma faixa)', disabled: n < 2, fn: joinSel },
      '-',
      { label: 'Selecionar toda a faixa', fn: function () { selectWholeTrack(tr.id); } },
      { label: 'Selecionar daqui pra frente (esta faixa)', fn: function () { st.sel = {}; TlEdit.selectForward(seq(), c.start - 0.001, tr.id).forEach(function (i) { st.sel[i] = 1; }); refresh(); } },
      { label: 'Definir loop pela seleção', hint: 'X', fn: markSelRange },
      { label: 'Abrir no Inspetor', fn: function () { H.setTab('timeline', true); } }
    ];
    items = items.concat(compItems(f));
    TlMenu.show(e.clientX, e.clientY, items);
  }
  function laneMenu(e, tid, tAt) {
    var tr = Seq.track(seq(), tid); if (!tr) return;
    var items = [
      { header: tr.name },
      { label: 'Colar aqui', disabled: !(st.clipboard && st.clipboard.length), fn: function () { var keep = now(); tl.clock.seek(tAt); pasteSel(); tl.clock.seek(keep); } },
      { label: 'Novo marcador aqui', hint: 'M', fn: function () { H.checkpoint(); var m = Seq.addMarker(seq(), snapT(tAt, false), ''); st.selMk = m.id; changed(); } },
      '-',
      { label: 'Fechar espaços desta faixa', disabled: tr.locked, fn: function () { closeGapsOf(tid); } },
      { label: 'Selecionar toda a faixa', fn: function () { selectWholeTrack(tid); } },
      { label: 'Selecionar daqui pra frente (todas as faixas)', fn: function () { st.sel = {}; TlEdit.selectForward(seq(), tAt, null).forEach(function (i) { st.sel[i] = 1; }); refresh(); } },
      { label: tr.locked ? 'Destravar faixa' : 'Travar faixa', fn: function () { H.checkpoint(); tr.locked = !tr.locked; changed(); } }
    ];
    TlMenu.show(e.clientX, e.clientY, items);
  }
  function rulerMenu(e, tAt) {
    TlMenu.show(e.clientX, e.clientY, [
      { label: 'Novo marcador aqui', hint: 'M', fn: function () { H.checkpoint(); var m = Seq.addMarker(seq(), snapT(tAt, false), ''); st.selMk = m.id; changed(); } },
      { label: 'Ir para o início', hint: 'Home', fn: function () { seek(0); } },
      { label: 'Ajustar zoom à sequência', hint: '\\', fn: zoomFit },
      { label: 'Limpar loop', hint: '⌥X', fn: function () { setLoopMode('off'); } }
    ]);
  }

  // ---------- opções do Imã ----------
  function snapMenu(x, y) {
    var o = snapOpts(), s = seq().settings;
    function set(k, v) { H.checkpoint(); var cur = snapOpts(); cur[k] = v; s.snapOpts = cur; refresh(); setTimeout(function () { snapMenu(x, y); }, 0); }
    var items = [
      { label: 'Imã ligado', hint: 'N', on: s.snap, fn: function () { H.checkpoint(); s.snap = !s.snap; refresh(); setTimeout(function () { snapMenu(x, y); }, 0); } },
      { header: 'Atrai para' },
      { label: 'Playhead', on: o.playhead, fn: function () { set('playhead', !o.playhead); } },
      { label: 'Marcadores', on: o.markers, fn: function () { set('markers', !o.markers); } },
      { label: 'Bordas de clipes', on: o.clips, fn: function () { set('clips', !o.clips); } },
      { label: 'Quadros', on: o.frames, fn: function () { set('frames', !o.frames); } },
      { header: 'Grade' }
    ];
    [[0, 'Sem grade'], [0.25, 'A cada 0,25 s'], [0.5, 'A cada 0,5 s'], [1, 'A cada 1 s'], [5, 'A cada 5 s']].forEach(function (g) { items.push({ label: g[1], on: Math.abs(o.grid - g[0]) < 1e-9, fn: function () { set('grid', g[0]); } }); });
    items.push({ header: 'Distância de atração' });
    [4, 8, 14, 22].forEach(function (px) { items.push({ label: px + ' px', on: o.px === px, fn: function () { set('px', px); } }); });
    TlMenu.show(x, y, items);
  }

  // ---------- marcadores ----------
  var MK_COLORS = ['#ffd23d', '#ff5c5c', '#4fd1c5', '#6fb1ff', '#c792ea', '#9be564'];
  function drawMarkers() {
    if (!mkLayer || !scrollEl) return;
    var sx = scrollEl.scrollLeft, z = st.zoom;
    var keep = mkLayer.querySelector('input');
    if (keep) { var have = {}; [].forEach.call(mkLayer.querySelectorAll('.tl-mkf'), function (f) { if (f.dataset.mid && f.querySelector('input')) have[f.dataset.mid] = f; }); }
    [].forEach.call(mkLayer.querySelectorAll('.tl-mkf'), function (f) { if (!f.querySelector('input')) f.remove(); });
    seq().markers.forEach(function (m) {
      if (have && have[m.id]) { have[m.id].style.left = (m.t * z - sx) + 'px'; return; }
      var f = el('div', 'tl-mkf' + (st.selMk === m.id ? ' sel' : ''), m.name || ''); f.dataset.mid = m.id; f.style.left = (m.t * z - sx) + 'px'; f.style.background = m.color || '#ffd23d';
      f.title = (m.name || 'Marcador') + ' · ' + Seq.fmt(m.t) + '. Arraste pra mover, duplo clique renomeia, botão direito abre o menu.';
      f.addEventListener('pointerdown', function (e) { markerDown(e, m.id); });
      f.addEventListener('dblclick', function (e) { e.stopPropagation(); });
      f.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); markerMenu(e, m.id); });
      mkLayer.appendChild(f);
    });
  }
  var lastMkClick = null;
  function markerDown(e, id) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var m = TlEdit.markerById(seq(), id); if (!m) return;
    var dbl = lastMkClick && lastMkClick.id === id && Date.now() - lastMkClick.t < 500;
    lastMkClick = dbl ? null : { id: id, t: Date.now() };
    st.selMk = id; st.sel = {};
    if (dbl) { window.addEventListener('pointerup', function () { setTimeout(function () { renameMarker(id); }, 0); }, { once: true }); return; }
    var x0 = e.clientX, t0 = m.t, moved = false;
    seek(m.t);
    function mv(ev) {
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      if (!moved) { moved = true; H.checkpoint(); }
      var nt = t0 + (ev.clientX - x0) / st.zoom, o = snapOpts(), sn = seq().settings.snap ? Seq.snapTime(seq(), nt, o.px / st.zoom, now(), null, id) : nt;
      TlEdit.moveMarker(seq(), id, sn === nt && (o.frames || !seq().settings.snap) ? Seq.quant(nt, fps()) : sn);
      refresh();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) changed(); else refresh(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    refresh();
  }
  function renameMarker(id) {
    var m = TlEdit.markerById(seq(), id); if (!m) return;
    drawMarkers();
    var f = mkLayer.querySelector('.tl-mkf[data-mid="' + id + '"]'); if (!f) return;
    var inp = el('input'); inp.type = 'text'; inp.value = m.name || ''; inp.maxLength = 120; inp.setAttribute('aria-label', 'Nome do marcador');
    f.textContent = ''; f.appendChild(inp); f.style.maxWidth = 'none'; inp.focus(); inp.select();
    function done(save) { if (!inp.parentNode) return; if (save && inp.value !== (m.name || '')) { H.checkpoint(); TlEdit.renameMarker(seq(), id, inp.value); changed(); } else { inp.remove(); refresh(); } }
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', function () { done(true); });
    inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  function markerMenu(e, id) {
    var m = TlEdit.markerById(seq(), id); if (!m) return;
    st.selMk = id; refresh();
    var items = [{ header: m.name || 'Marcador' }, { label: 'Ir para o marcador', fn: function () { seek(m.t); } }, { label: 'Renomear', fn: function () { renameMarker(id); } }, { header: 'Cor' }];
    MK_COLORS.forEach(function (c) { items.push({ label: c, on: m.color === c, fn: function () { H.checkpoint(); TlEdit.colorMarker(seq(), id, c); changed(); } }); });
    items.push('-'); items.push({ label: 'Excluir marcador', fn: function () { H.checkpoint(); TlEdit.removeMarker(seq(), id); st.selMk = null; changed(); } });
    TlMenu.show(e.clientX, e.clientY, items);
  }
  function markersSection() {
    var sct = section('Marcadores');
    var ms = seq().markers;
    if (!ms.length) { sct.appendChild(el('p', 'tl-note', 'Nenhum marcador. Aperte M no playhead ou dê duplo clique na régua. Arraste a bandeira na régua pra mover.')); return sct; }
    ms.forEach(function (m) {
      var row = el('div', 'tl-mkrow'); row.dataset.mid = m.id;
      var col = el('input'); col.type = 'color'; col.value = m.color || '#ffd23d'; col.setAttribute('aria-label', 'Cor do marcador');
      col.addEventListener('change', function () { H.checkpoint(); TlEdit.colorMarker(seq(), m.id, col.value); changed(); });
      var nm = el('input'); nm.type = 'text'; nm.value = m.name || ''; nm.placeholder = 'Nome'; nm.setAttribute('aria-label', 'Nome do marcador');
      nm.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
      nm.addEventListener('change', function () { H.checkpoint(); TlEdit.renameMarker(seq(), m.id, nm.value); changed(); });
      var ti = el('input'); ti.type = 'number'; ti.step = 0.01; ti.min = 0; ti.value = (Math.round(m.t * 1000) / 1000).toString(); ti.setAttribute('aria-label', 'Tempo do marcador');
      ti.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') ti.blur(); });
      ti.addEventListener('change', function () { var v = parseFloat(ti.value); if (!isFinite(v)) return; H.checkpoint(); TlEdit.moveMarker(seq(), m.id, v); changed(); });
      var bt = el('div', 'kfs');
      var go = el('button', 'tl-kf', '▶'); go.type = 'button'; go.title = 'Ir para o marcador'; go.addEventListener('click', function () { seek(m.t); });
      var rm = el('button', 'tl-kf', '×'); rm.type = 'button'; rm.title = 'Excluir marcador'; rm.addEventListener('click', function () { H.checkpoint(); TlEdit.removeMarker(seq(), m.id); changed(); });
      bt.appendChild(go); bt.appendChild(rm);
      row.appendChild(col); row.appendChild(nm); row.appendChild(ti); row.appendChild(bt); sct.appendChild(row);
    });
    return sct;
  }

  // ---------- ajuda de atalhos ----------
  var SHORTCUTS = [
    ['Reprodução', [['Espaço', 'Tocar e pausar'], ['← →', 'Um quadro (Shift: 1 s)'], ['↑ ↓', 'Corte anterior ou próximo'], ['Shift+↑ ↓', 'Marcador anterior ou próximo'], ['Home End', 'Início e fim'], ['I O', 'Entrada e saída do loop'], ['X', 'Loop pela seleção (⌥X limpa)']]],
    ['Edição', [['A', 'Ferramenta de seleção'], ['T', 'Ferramenta Trim (Ripple, Roll, Slip, Slide)'], ['S', 'Cortar no playhead'], ['⌘C ⌘V ⌘D', 'Copiar, colar e duplicar'], ['Delete', 'Apagar'], ['Shift+Delete', 'Ripple Delete'], [', .', 'Mover seleção 1 quadro (Shift: 10)'], ['⌘A', 'Selecionar tudo']]],
    ['Seleção', [['Shift+clique', 'Intervalo de clipes'], ['⌘+clique', 'Soma ou tira da seleção'], ['⌥+arrastar no vazio', 'Caixa de seleção']]],
    ['Marcadores e Imã', [['M', 'Marcador no playhead'], ['Duplo clique na régua', 'Novo marcador'], ['N', 'Ligar ou desligar o Imã'], ['K', 'Keyframes básicos no playhead'], ['⌥ ← →', 'Keyframe anterior ou próximo']]],
    ['Zoom', [['= -', 'Mais ou menos zoom'], ['\\', 'Ajustar à tela'], ['⌘+roda', 'Zoom no ponteiro']]]
  ];
  function showHelp() {
    var old = document.querySelector('.tl-help'); if (old) { old.remove(); return; }
    var ov = el('div', 'tl-help'), box = el('div'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Atalhos da timeline');
    box.appendChild(el('h3', null, 'Atalhos da timeline'));
    SHORTCUTS.forEach(function (g) {
      box.appendChild(el('h4', null, g[0]));
      g[1].forEach(function (r) { var k = el('div'); k.appendChild(el('kbd', null, r[0])); k.appendChild(document.createTextNode(r[1])); box.appendChild(k); });
    });
    ov.appendChild(box);
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) ov.remove(); });
    window.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopImmediatePropagation(); ov.remove(); window.removeEventListener('keydown', esc, true); } }, true);
    document.body.appendChild(ov);
  }

  // ---------- operações ----------
  function addMarker() { H.checkpoint(); Seq.addMarker(seq(), Seq.quant(now(), fps()), ''); changed(); }
  function splitSel() {
    var ids = selIds(), t = now(), did = 0;
    if (!ids.length) {
      // sem seleção: corta todos os clipes que estão sob o playhead nas faixas destravadas
      seq().tracks.forEach(function (tr) { if (tr.locked) return; tr.clips.forEach(function (c) { if (t > c.start + 0.04 && t < Seq.endOf(c) - 0.04) ids.push(c.id); }); });
    }
    if (!ids.length) { H.say('Nada pra cortar neste ponto.'); return; }
    H.checkpoint();
    var ns = {};
    ids.forEach(function (id) { var f = Seq.findClip(seq(), id); if (f && f.track.locked) return; var n = Seq.splitClip(seq(), id, t); if (n) { did++; ns[n.id] = 1; } });
    if (!did) { H.say('O playhead precisa estar dentro do clipe (e não colado na borda).'); return; }
    changed();
  }
  function dupSel() {
    var ids = selIds(); if (!ids.length) return;
    H.checkpoint(); var ns = {}, CC = window.CompoundCore, done = {};
    if (CC) {
      // composto fechado com todos os membros selecionados: duplica o composto inteiro
      (seq().compounds || []).slice().forEach(function (g) {
        if (g.open) return; var mem = CC.membersOf(seq(), g.id);
        if (mem.length && mem.every(function (i) { return st.sel[i]; })) { var r = CC.duplicateCompound(seq(), g.id); if (r.ok) { r.clips.forEach(function (i) { ns[i] = 1; }); mem.forEach(function (i) { done[i] = 1; }); } }
      });
    }
    ids.forEach(function (id) {
      if (done[id]) return;
      var f = Seq.findClip(seq(), id), parentSel = CC && f && f.clip.conn && st.sel[f.clip.conn.to];
      if (parentSel) return;                                           // o filho é duplicado junto com o principal
      var n = Seq.duplicateClip(seq(), id); if (!n) return; delete n.cg; delete n.conn; ns[n.id] = 1;
      if (CC) CC.childrenOf(seq(), id, true).forEach(function (cid) {  // clipes conectados vão junto e se conectam à cópia
        var ff = Seq.findClip(seq(), cid); if (!ff) return;
        var m = Seq.cloneClip(ff.clip); m.start = Math.max(0, ff.clip.start + (n.start - f.clip.start)); delete m.cg; m.conn = { to: ff.clip.conn.to === id ? n.id : (m.conn && m.conn.to), off: ff.clip.conn.off };
        ff.track.clips.push(m); ns[m.id] = 1; (function (map) { map[cid] = m.id; })(dupSel._map = dupSel._map || {}); dupSel._map[cid] = m.id;
      });
      if (CC && dupSel._map) { Object.keys(dupSel._map).forEach(function (old) { var nc = Seq.findClip(seq(), dupSel._map[old]); if (nc && nc.clip.conn && dupSel._map[nc.clip.conn.to]) nc.clip.conn.to = dupSel._map[nc.clip.conn.to]; }); dupSel._map = null; }
    });
    st.sel = ns; changed();
  }
  function delSel() {
    var ids = selIds(); if (!ids.length) return;
    H.checkpoint();
    ids.forEach(function (id) { var f = Seq.findClip(seq(), id); if (f && !f.track.locked) Seq.removeClip(seq(), id); });
    st.sel = {}; changed();
  }
  function copySel() {
    var items = [];
    selIds().forEach(function (id) { var f = Seq.findClip(seq(), id); if (f) items.push({ tid: f.track.id, clip: JSON.parse(JSON.stringify(f.clip)) }); });
    st.clipboard = items; H.say(items.length ? items.length + ' clipe(s) copiado(s). Cmd+V cola no playhead.' : 'Nada selecionado.');
  }
  function pasteSel() {
    if (!st.clipboard || !st.clipboard.length) return;
    H.checkpoint();
    var min = Math.min.apply(null, st.clipboard.map(function (x) { return x.clip.start; })), t = now(), ns = {};
    st.clipboard.forEach(function (x) {
      var tr = Seq.track(seq(), st.selTrack && Seq.track(seq(), st.selTrack) && Seq.track(seq(), st.selTrack).type === (Seq.track(seq(), x.tid) || { type: 'video' }).type ? st.selTrack : x.tid) || Seq.track(seq(), x.tid);
      if (!tr) return;
      var n = Seq.cloneClip(x.clip); n.start = t + (x.clip.start - min); delete n.cg; delete n.conn;
      tr.clips.push(n); ns[n.id] = 1;
      if (Seq.endOf(n) > seq().duration) seq().duration = Math.ceil(Seq.endOf(n));
    });
    st.sel = ns; changed();
  }
  function keyAll() {
    var f = firstSel(); if (!f) return;
    H.checkpoint();
    var cl = curCl(f.clip);
    ['x', 'y', 'scale', 'rot', 'opacity'].forEach(function (p) { Seq.setKey(f.clip, p, cl, Seq.valueAt(f.clip, p, cl), Seq.hasKey(f.clip, p, cl) ? undefined : defI()); });
    changed(); H.say('Keyframes criados no playhead (posição, escala, rotação e opacidade).');
  }
  function newVideoTrack() {
    H.checkpoint();
    var cs = H.currentSurface(), key = null;
    if (cs && seq().tracks.some(function (t) { return t.type === 'video' && t.surfaceId === cs.key; })) { addLayerFor(cs.key); return; }
    if (cs && !seq().tracks.some(function (t) { return t.type === 'video' && t.surfaceId === cs.key; })) key = cs.key;
    var t = Seq.addTrack(seq(), 'video', key, key ? cs.name : null);
    st.selTrack = t.id; changed();
    if (!key) H.say('Faixa criada sem face. Escolha a face no cabeçalho da faixa.');
  }
  function addLayerFor(key) {
    var f = surfaceOfKey(key), n = Seq.layersOf(seq(), key).length;
    H.checkpoint();
    var t = Seq.addLayer(seq(), key, 'Camada ' + (n + 1));
    if (!t) return;
    st.selTrack = t.id; changed();
    H.say(n + 1 > Seq.SOFT_LAYERS
      ? 'Camada ' + (n + 1) + ' criada. Atenção: com muitos vídeos ao mesmo tempo nesta face o computador pode engasgar. Só vídeos que estão tocando juntos pesam.'
      : 'Camada criada acima. O que estiver nela aparece por cima das camadas de baixo.');
  }
  function allFaces() {
    var made = 0; H.checkpoint();
    H.surfaces().forEach(function (x) {
      if (seq().tracks.some(function (t) { return t.type === 'video' && t.surfaceId === x.s.key; })) return;
      Seq.addTrack(seq(), 'video', x.s.key, x.s.name); made++;
    });
    changed();
    H.say(made ? made + ' faixa(s) criada(s), uma por face.' : 'Todas as faces já têm faixa.');
  }

  // ---------- mídia ----------
  function findAsset(kind, path) { for (var i = 0; i < seq().assets.length; i++) { var a = seq().assets[i]; if (a.kind === kind && a.path && a.path === path) return a; } return null; }
  function probe(path, kind, cb) {
    var url = H.toUrl(path), done = false, v = document.createElement(kind === 'img' ? 'img' : (kind === 'audio' ? 'audio' : 'video'));
    function fin(ok, dur, w, h) { if (done) return; done = true; v.removeAttribute('src'); cb(ok, dur, w, h); }
    if (kind === 'img') { v.onload = function () { fin(true, null, v.naturalWidth, v.naturalHeight); }; v.onerror = function () { fin(false); }; }
    else { v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = function () { fin(true, v.duration, v.videoWidth, v.videoHeight); }; v.onerror = function () { fin(false); }; }
    setTimeout(function () { fin(false); }, 8000);
    v.src = url;
  }
  function importPaths(paths, track, t0) {
    var chain = Promise.resolve();
    paths.forEach(function (p) {
      chain = chain.then(function () {
        var k = H.kindOf(p);
        if (!k) { H.say('Formato não suportado: ' + H.baseName(p) + '.'); return; }
        var kind = k.type === 'audio' ? 'audio' : (k.type === 'video' ? 'video' : 'img');
        return new Promise(function (res) {
          var ex = findAsset(kind, p);
          if (ex) { placeAsset(ex, track, t0); return res(); }
          probe(p, kind, function (ok, dur, w, h) {
            if (!ok) { H.say('Não consegui abrir ' + H.baseName(p) + '. Se for MOV em ProRes ou HEVC, exporte em MP4 H.264.'); return res(); }
            H.checkpoint();
            var a = Seq.addAsset(seq(), { kind: kind, name: H.baseName(p), path: p, duration: dur && isFinite(dur) ? dur : null, dims: w ? [w, h] : null });
            a.src = H.toUrl(p);
            placeAsset(a, track, t0, true); res();
          });
        });
      });
    });
  }
  function importDialog() { H.api.openMedia().then(function (paths) { if (paths && paths.length) importPaths(paths, null, null); }); }

  // Escolhe a faixa onde o clipe vai cair
  function targetTrack(a, wanted) {
    var s = seq(), t;
    if (wanted && wanted.type === (a.kind === 'audio' ? 'audio' : 'video')) return wanted;
    if (a.kind === 'audio') {
      t = st.selTrack && Seq.track(s, st.selTrack); if (t && t.type === 'audio') return t;
      for (var i = 0; i < s.tracks.length; i++) if (s.tracks[i].type === 'audio' && !s.tracks[i].locked) return s.tracks[i];
      return Seq.addTrack(s, 'audio');
    }
    t = st.selTrack && Seq.track(s, st.selTrack); if (t && t.type === 'video' && !t.locked) return t;
    var cs = H.currentSurface();
    if (cs) {
      for (var j = 0; j < s.tracks.length; j++) if (s.tracks[j].type === 'video' && s.tracks[j].surfaceId === cs.key) return s.tracks[j];
      return Seq.addTrack(s, 'video', cs.key, cs.name);
    }
    for (var m = 0; m < s.tracks.length; m++) if (s.tracks[m].type === 'video') return s.tracks[m];
    return Seq.addTrack(s, 'video', null);
  }
  function placeAsset(a, track, t0, skipCk) {
    if (!skipCk) H.checkpoint();
    var tr = targetTrack(a, track), start = t0 == null ? Seq.quant(now(), fps()) : Seq.quant(t0, fps());
    var c = Seq.addClip(seq(), tr.id, a, start);
    if (!c) return null;
    st.sel = {}; st.sel[c.id] = 1; st.selTrack = tr.id;
    if (tr.type === 'video' && tr.surfaceId) H.selectKey(tr.surfaceId);
    tl.clock.duration = seq().duration; H.syncClock();
    changed();
    H.say((a.name || 'Clipe') + ' entrou na faixa "' + tr.name + '" em ' + Seq.fmt(start) + '.');
    return c;
  }
  // Chamado pelo painel quando o Modo timeline está ligado e o usuário clica numa textura, efeito, texto ou mídia
  function intercept(it) {
    var kind = it.type === 'fx' ? 'fx' : (it.type === 'text' ? 'text' : (it.kind === 'video' ? 'video' : (it.kind === 'cam' ? 'cam' : 'img')));
    var a = null;
    H.checkpoint();
    if ((kind === 'video' || kind === 'img') && it.path && !it.test) a = findAsset(kind, it.path);
    if (!a) {
      a = Seq.addAsset(seq(), { kind: kind, name: it.name || 'Item', path: it.path || null, test: !!it.test, fx: it.fx || null, text: it.text || null, dims: it.dims || null, duration: it.duration && isFinite(it.duration) ? it.duration : null });
      if (it.src) a.src = it.src;
      if (kind === 'video' && it.path && !a.duration) {
        var aa = a;
        probe(it.path, 'video', function (ok, dur) { if (ok && dur && isFinite(dur)) { aa.duration = dur; seq().tracks.forEach(function (t) { t.clips.forEach(function (c) { if (c.assetId === aa.id && c.outPoint == null) { c.outPoint = dur; c.duration = dur; } }); }); changed(); } });
        a.duration = null;
      }
    }
    var c = placeAsset(a, null, null, true);
    return true;
  }
  function mediaHost() {
    return { seq: seq, toUrl: H.toUrl, probe: probe, placeAsset: function (a) { return placeAsset(a, null, null); }, importDialog: importDialog, checkpoint: H.checkpoint, changed: changed, say: H.say, api: H.api, kindOf: H.kindOf, refreshTimeline: refresh };
  }
  function asOff(c) { var a = Seq.asset(seq(), c.assetId); return !!(a && a._off); }
  function importAudio(path) {
    if (!tl.on) H.setOn(true);
    importPaths([path], null, null);
  }

  // ---------- inspetor ----------
  function curCl(c) {
    var a = Seq.asset(seq(), c.assetId), ev = Seq.evalClip(c, a, now());
    if (ev) return ev.cl;
    var local = now() - c.start;
    return local < 0 ? 0 : Math.min(local, c.duration);
  }
  function defI() { return window.KeyframeUI ? KeyframeUI.defInterp() : 'linear'; }
  function setProp(c, p, v) {
    H.checkpoint('tlp:' + c.id + ':' + p);
    var cl = curCl(c);
    if (c.keyframes[p] || tl.autoKey) Seq.setKey(c, p, cl, v, Seq.hasKey(c, p, cl) ? undefined : defI()); else Seq.setBase(c, p, v);
    H.syncClock(); H.push(); refresh();
  }
  var ANIM = [
    { p: 'x', label: 'Posição X', min: -100, max: 100, step: 0.1, k: 100, unit: '%' },
    { p: 'y', label: 'Posição Y', min: -100, max: 100, step: 0.1, k: 100, unit: '%' },
    { p: 'scale', label: 'Escala', min: 5, max: 400, step: 0.5, k: 100, unit: '%' },
    { p: 'sx', label: 'Largura', min: 5, max: 400, step: 0.5, k: 100, unit: '%' },
    { p: 'sy', label: 'Altura', min: 5, max: 400, step: 0.5, k: 100, unit: '%' },
    { p: 'rot', label: 'Rotação', min: -360, max: 360, step: 0.5, k: 1, unit: '°' },
    { p: 'opacity', label: 'Opacidade', min: 0, max: 100, step: 1, k: 100, unit: '%' }
  ];
  var CROP_ROWS = [
    { p: 'cl', label: 'Corte esquerdo', min: 0, max: 95, step: 0.5, k: 100, unit: '%' }, { p: 'ct', label: 'Corte topo', min: 0, max: 95, step: 0.5, k: 100, unit: '%' },
    { p: 'cr', label: 'Corte direito', min: 0, max: 95, step: 0.5, k: 100, unit: '%' }, { p: 'cb', label: 'Corte base', min: 0, max: 95, step: 0.5, k: 100, unit: '%' }
  ];
  var ANCHOR_ROWS = [
    { p: 'ax', label: 'Âncora X (0 = centro)', min: -200, max: 200, step: 0.5, k: 100, unit: '%' }, { p: 'ay', label: 'Âncora Y (0 = centro)', min: -200, max: 200, step: 0.5, k: 100, unit: '%' }
  ];
  var DIST = [];
  [1, 2, 3, 4].forEach(function (n) { ['x', 'y'].forEach(function (ax) { DIST.push({ p: 'c' + (n - 1) + ax, label: 'Canto ' + n + ' ' + ax.toUpperCase(), min: -100, max: 100, step: 0.1, k: 100, unit: '%' }); }); });

  function propRow(def, getClip) {
    var row = el('div', 'tl-prop'), lab = el('label', null, def.label), rg = el('input'), nu = el('input'), kfs = el('div', 'kfs');
    rg.type = 'range'; rg.min = def.min; rg.max = def.max; rg.step = def.step; rg.setAttribute('aria-label', def.label);
    nu.type = 'number'; nu.min = def.min; nu.max = def.max; nu.step = def.step; nu.setAttribute('aria-label', def.label + ' valor');
    var kb = el('button', 'tl-kf', '◆'), pv = el('button', 'tl-kf', '◀'), nx = el('button', 'tl-kf', '▶');
    [kb, pv, nx].forEach(function (b) { b.type = 'button'; });
    kb.title = 'Criar ou remover keyframe no playhead'; pv.title = 'Keyframe anterior'; nx.title = 'Próximo keyframe';
    kfs.appendChild(pv); kfs.appendChild(kb); kfs.appendChild(nx);
    row.appendChild(lab); row.appendChild(rg); row.appendChild(nu); row.appendChild(kfs);
    function apply(v) { var c = getClip(); if (!c) return; setProp(c, def.p, v / def.k); }
    rg.addEventListener('input', function () { apply(+rg.value); nu.value = (+rg.value).toFixed(1).replace(/\.0$/, ''); });
    nu.addEventListener('change', function () { var v = parseFloat(nu.value); if (isFinite(v)) apply(clamp(v, def.min, def.max)); });
    nu.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nu.blur(); });
    kb.addEventListener('click', function () {
      var c = getClip(); if (!c) return; H.checkpoint(); var cl = curCl(c);
      if (Seq.hasKey(c, def.p, cl)) Seq.removeKey(c, def.p, cl); else Seq.setKey(c, def.p, cl, Seq.valueAt(c, def.p, cl), defI());
      H.push(); refresh();
    });
    function jump(dir) { var c = getClip(); if (!c) return; var t = Seq.stepKey(c, def.p, curCl(c), dir); if (t != null) seek(c.start + t); }
    pv.addEventListener('click', function () { jump(-1); }); nx.addEventListener('click', function () { jump(1); });
    row._u = function (c) {
      if (!c) return;
      var cl = curCl(c), v = Seq.valueAt(c, def.p, cl) * def.k;
      if (document.activeElement !== rg) rg.value = v;
      if (document.activeElement !== nu) nu.value = (Math.round(v * 10) / 10).toString();
      var has = !!(c.keyframes[def.p] && c.keyframes[def.p].length), here = Seq.hasKey(c, def.p, cl);
      kb.className = 'tl-kf' + (here ? ' here' : (has ? ' has' : ''));
    };
    return row;
  }

  function numField(label, get, set, opts) {
    opts = opts || {};
    var w = el('label', null, label), i = el('input', 'tl-num'); i.type = 'number'; i.step = opts.step || 0.01; if (opts.min != null) i.min = opts.min; if (opts.max != null) i.max = opts.max;
    w.appendChild(i);
    i.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
    i.addEventListener('change', function () { var v = parseFloat(i.value); if (!isFinite(v)) return; if (opts.min != null) v = Math.max(opts.min, v); if (opts.max != null) v = Math.min(opts.max, v); H.checkpoint('tlf:' + label); set(v); H.syncClock(); H.push(); refresh(); });
    w._u = function () { if (document.activeElement !== i) i.value = (Math.round(get() * 1000) / 1000).toString(); };
    return w;
  }
  function selField(label, opts, get, set) {
    var w = el('label', null, label), s = el('select');
    opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); });
    w.appendChild(s);
    s.addEventListener('change', function () { H.checkpoint(); set(s.value); H.syncClock(); H.push(); refresh(); });
    w._u = function () { s.value = String(get()); };
    return w;
  }
  function section(title) { var d = el('div', 'tl-insp-sec'); if (title) d.appendChild(el('h3', null, title)); return d; }

  function renderInspector() {
    if (!insp) return;
    var f = firstSel(), sig = (tl.on ? '1' : '0') + '|' + (f ? f.clip.id + ':' + f.clip.assetId + ':' + (f.clip.cg || '') + ':' + (f.clip.conn ? f.clip.conn.to : '') + ':' + ((f.clip.efx || []).map(function (e) { return e.id + e.type + (e.on === false ? '0' : '1'); }).join(',')) + (f.clip.blend || '') + ':' + (f.clip.transform && f.clip.transform.flipH ? 'H' : '') + (f.clip.transform && f.clip.transform.flipV ? 'V' : '') + ':' + ((seq().compounds || []).map(function (g) { return g.id + g.name + (g.open ? 'o' : 'c'); }).join(',')) : '-') + '|' + seq().tracks.length + '|' + (seq().markers || []).map(function (m) { return m.id + m.name + m.color + (Math.round(m.t * 1000)); }).join(',');
    if (sig === st.lastSig && propUI.built) return;
    st.lastSig = sig;
    insp.textContent = ''; propUI = { built: true, rows: [], fields: [] };
    var s0 = section('Modo timeline');
    s0.appendChild(el('p', 'tl-note', 'A timeline é uma camada nova por cima do mapeamento. Cada faixa de vídeo é ligada a uma face (superfície) e a calibração dos cantos continua intacta. Com o modo desligado o projeto projeta como sempre.'));
    var on = btn(tl.on ? 'Desligar Modo timeline' : 'Ligar Modo timeline', 'Liga ou desliga a timeline', function () { H.setOn(!tl.on); }, tl.on ? '' : 'primary');
    s0.appendChild(on);
    insp.appendChild(s0);
    if (!tl.on) return;
    // Sequência
    var s1 = section('Sequência');
    var det = el('details'); det.appendChild(el('summary', null, 'Nome, duração, fps, áudio e loop'));
    var g = el('div', 'tl-row2'); g.style.marginTop = '8px';
    var nm = el('label', null, 'Nome'), ni = el('input'); ni.type = 'text'; ni.value = seq().name; ni.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') ni.blur(); }); ni.addEventListener('change', function () { H.checkpoint(); seq().name = ni.value || seq().name; H.push(); }); nm.appendChild(ni); g.appendChild(nm);
    var fD = numField('Duração (s)', function () { return seq().duration; }, function (v) { seq().duration = Math.max(1, v); tl.clock.duration = seq().duration; }, { step: 1, min: 1, max: 7200 });
    var fF = selField('Quadros por segundo', [['24', '24'], ['25', '25'], ['30', '30'], ['50', '50'], ['60', '60']], function () { return seq().fps; }, function (v) { seq().fps = +v; });
    var fO = numField('Atraso do som (ms)', function () { return seq().settings.audioOffset || 0; }, function (v) { seq().settings.audioOffset = v; }, { step: 5, min: -500, max: 500 });
    var fI = numField('Início do loop (s)', function () { return seq().settings.loop.in || 0; }, function (v) { seq().settings.loop.in = v; }, { step: 0.1, min: 0 });
    var fU = numField('Fim do loop (s)', function () { var o = seq().settings.loop.out; return o == null ? seq().duration : o; }, function (v) { seq().settings.loop.out = v; }, { step: 0.1, min: 0 });
    [fD, fF, fO, fI, fU].forEach(function (x) { g.appendChild(x); propUI.fields.push(x); });
    det.appendChild(g);
    var gi = el('label', null, 'Mostrar a grade neon quando a faixa estiver vazia'); gi.style.cssText = 'display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-top:8px';
    var gc = el('input'); gc.type = 'checkbox'; gc.checked = seq().settings.showGridIdle !== false; gc.addEventListener('change', function () { H.checkpoint(); seq().settings.showGridIdle = gc.checked; H.push(); }); gi.insertBefore(gc, gi.firstChild); det.appendChild(gi);
    // saída de áudio
    var ao = el('label', null, 'Saída de áudio'); ao.style.cssText = 'display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);margin-top:8px';
    var as = el('select'); var d0 = el('option', null, 'Padrão do sistema'); d0.value = ''; as.appendChild(d0); ao.appendChild(as); det.appendChild(ao);
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then(function (ds) { ds.filter(function (d) { return d.kind === 'audiooutput' && d.deviceId !== 'default'; }).forEach(function (d) { var o = el('option', null, d.label || 'Saída ' + d.deviceId.slice(0, 6)); o.value = d.deviceId; as.appendChild(o); }); as.value = st.sink || ''; }).catch(function () {});
    as.addEventListener('change', function () { st.sink = as.value; if (H.rend && H.rend.player) H.rend.player.setSink(st.sink); });
    det.appendChild(el('p', 'tl-note', 'O som toca uma vez só, pela janela do painel. A janela de projeção fica muda, então não duplica.'));
    var tb = btn('Teste de sincronia som e imagem', 'Pisca a tela e toca um bip no mesmo instante, uma vez por segundo, por 8 segundos', syncTest); tb.style.marginTop = '8px'; det.appendChild(tb);
    s1.appendChild(det); insp.appendChild(s1);
    propUI.seqFields = [fD, fF, fO, fI, fU];
    if (window.MediaBrowser) { var sm = section('Mídia do projeto'); sm.classList.add('mb-sec'); insp.appendChild(sm); window.MediaBrowser.mount(sm, mediaHost()); }
    if (!f) {
      var n = section('Clipe'); n.appendChild(el('p', 'tl-note', 'Clique num clipe da timeline pra editar. Dica: com a timeline em foco, K cria keyframes, S corta, M marca, I e O definem o loop, Espaço toca. Aperte ? pra ver todos os atalhos.')); insp.appendChild(n);
      if (window.TlEdit) insp.appendChild(markersSection());
      return;
    }
    var c = f.clip, a = Seq.asset(seq(), c.assetId), media = Seq.isMedia(a), audio = a && a.kind === 'audio';
    var getC = function () { var ff = firstSel(); return ff ? ff.clip : null; };
    var s2 = section('Clipe: ' + (c.name || (a && a.name) || ''));
    var nm2 = el('input'); nm2.type = 'text'; nm2.value = c.name || (a && a.name) || ''; nm2.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nm2.blur(); }); nm2.addEventListener('change', function () { H.checkpoint(); c.name = nm2.value; changed(); }); s2.appendChild(nm2);
    var g2 = el('div', 'tl-row2');
    var fS = numField('Início (s)', function () { return c.start; }, function (v) { Seq.moveClip(seq(), c.id, v, null); }, { step: 0.05, min: 0 });
    var fDu = numField('Duração (s)', function () { return c.duration; }, function (v) { Seq.trimClip(seq(), c.id, 'r', c.start + v); }, { step: 0.05, min: 0.05 });
    g2.appendChild(fS); g2.appendChild(fDu); propUI.fields.push(fS, fDu);
    if (media) {
      var fIn = numField('Ponto de entrada (s)', function () { return c.inPoint; }, function (v) { c.inPoint = Math.max(0, v); }, { step: 0.05, min: 0 });
      var fSp = numField('Velocidade (x)', function () { return c.speed; }, function (v) { c.speed = clamp(v, 0.05, 16); }, { step: 0.05, min: 0.05, max: 16 });
      g2.appendChild(fIn); g2.appendChild(fSp); propUI.fields.push(fIn, fSp);
    }
    var fL = selField('Loop do clipe', [['none', 'Não repete'], ['loop', 'Repete dentro da duração']], function () { return c.loopMode; }, function (v) { c.loopMode = v; });
    g2.appendChild(fL); propUI.fields.push(fL);
    if (!media) { var fLl = numField('Tamanho do ciclo (s)', function () { return c.loopLen || 2; }, function (v) { c.loopLen = Math.max(0.05, v); }, { step: 0.1, min: 0.05 }); g2.appendChild(fLl); propUI.fields.push(fLl); }
    if (!audio) {
      var fFit = selField('Encaixe', [['cover', 'Preencher (corta)'], ['contain', 'Caber (sobra)'], ['fill', 'Esticar']], function () { return c.fit; }, function (v) { c.fit = v; });
      g2.appendChild(fFit); propUI.fields.push(fFit);
    }
    var fFi = numField('Fade in (s)', function () { return c.fadeIn; }, function (v) { c.fadeIn = Math.max(0, v); }, { step: 0.1, min: 0 });
    var fFo = numField('Fade out (s)', function () { return c.fadeOut; }, function (v) { c.fadeOut = Math.max(0, v); }, { step: 0.1, min: 0 });
    g2.appendChild(fFi); g2.appendChild(fFo); propUI.fields.push(fFi, fFo);
    s2.appendChild(g2); insp.appendChild(s2);
    if (audio) {
      var s3 = section('Volume');
      var rv = propRow({ p: 'gain', label: 'Volume', min: 0, max: 100, step: 1, k: 100, unit: '%' }, getC); s3.appendChild(rv); propUI.rows.push(rv); insp.appendChild(s3);
    } else {
      if (a && (a.kind === 'fx' || a.kind === 'text')) insp.appendChild(assetSection(a));
      var s4 = section('Transform');
      ANIM.forEach(function (d) { var r = propRow(d, getC); s4.appendChild(r); propUI.rows.push(r); });
      CROP_ROWS.forEach(function (d) { var r = propRow(d, getC); s4.appendChild(r); propUI.rows.push(r); });
      ANCHOR_ROWS.forEach(function (d) { var r = propRow(d, getC); s4.appendChild(r); propUI.rows.push(r); });
      var gfl = el('div', 'tl-row2');
      [['flipH', 'Espelhar na horizontal'], ['flipV', 'Espelhar na vertical']].forEach(function (fl) {
        var lb2 = el('label', 'tl-chk'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!c.transform[fl[0]]; cb.setAttribute('aria-label', fl[1]);
        cb.addEventListener('change', function () { H.checkpoint(); c.transform[fl[0]] = cb.checked; changed(); H.renderOverlay(); });
        lb2.appendChild(cb); lb2.appendChild(document.createTextNode(' ' + fl[1])); gfl.appendChild(lb2);
      });
      s4.appendChild(gfl);
      var rs = btn('Resetar transformação', 'Volta posição, escala, rotação, âncora, espelho, distorção e corte ao normal, e remove os keyframes dessas propriedades (a calibração da superfície não muda; Desfazer volta)', resetClipTransform);
      s4.appendChild(rs); insp.appendChild(s4);
      var s5 = section('Distort (4 cantos do conteúdo)');
      s5.appendChild(el('p', 'tl-note', 'Isto deforma só o conteúdo deste clipe. Os cantos da superfície (calibração do projetor) não mudam. Dá pra arrastar as bolinhas no Viewer, no modo "Conteúdo".'));
      var dd = el('details'); dd.appendChild(el('summary', null, 'Ver os 8 valores'));
      DIST.forEach(function (d) { var r = propRow(d, getC); dd.appendChild(r); propUI.rows.push(r); });
      s5.appendChild(dd); insp.appendChild(s5);
    }
    if (!audio && window.EffectsCore) {
      var EC = window.EffectsCore, sfx = section('Efeitos e mesclagem');
      sfx.appendChild(el('p', 'tl-note', 'Pilha de efeitos deste clipe (na ordem, de cima para baixo). Cada intensidade aceita keyframe. Valem no Viewer e na saída externa. A calibração da superfície não muda.'));
      var fb = selField('Mesclagem com o que está embaixo', EC.BLENDS.map(function (b) { return [b.id, b.label]; }), function () { return c.blend || 'normal'; }, function (v) { if (v === 'normal') delete c.blend; else c.blend = v; });
      sfx.appendChild(fb); propUI.fields.push(fb);
      (c.efx || []).forEach(function (ef, ei) {
        var T = EC.TYPES[ef.type], box = el('div', 'tl-efx'), hd = el('div', 'tl-efx-h');
        var on = el('input'); on.type = 'checkbox'; on.checked = ef.on !== false; on.setAttribute('aria-label', 'Ligar ou desligar ' + T.name);
        on.addEventListener('change', function () { H.checkpoint(); ef.on = on.checked; changed(); });
        hd.appendChild(on); hd.appendChild(el('b', null, T.name));
        var up = btn('▲', 'Subir na pilha', function () { if (ei < 1) return; H.checkpoint(); var a = c.efx; var t0 = a[ei - 1]; a[ei - 1] = a[ei]; a[ei] = t0; changed(); }), dn = btn('▼', 'Descer na pilha', function () { if (ei >= c.efx.length - 1) return; H.checkpoint(); var a = c.efx; var t1 = a[ei + 1]; a[ei + 1] = a[ei]; a[ei] = t1; changed(); });
        var rm = btn('✕', 'Remover efeito', function () { H.checkpoint(); c.efx.splice(ei, 1); delete c.keyframes['ef.' + ef.id]; if (!c.efx.length) delete c.efx; changed(); });
        hd.appendChild(up); hd.appendChild(dn); hd.appendChild(rm); box.appendChild(hd);
        var r0 = propRow({ p: 'ef.' + ef.id, label: 'Intensidade', min: 0, max: 100, step: 1, k: 100, unit: '%' }, getC); box.appendChild(r0); propUI.rows.push(r0);
        var g3 = el('div', 'tl-row2');
        Object.keys(T.params).forEach(function (k) {
          if (k === 'amount') return; var pd = T.params[k];
          var nf = numField(pd.label + (pd.unit ? ' (' + pd.unit + ')' : ''), function () { return ef[k]; }, function (v) { ef[k] = Math.max(pd.min, Math.min(pd.max, v)); }, { step: pd.step, min: pd.min, max: pd.max });
          g3.appendChild(nf); propUI.fields.push(nf);
        });
        if (g3.childNodes.length) box.appendChild(g3);
        sfx.appendChild(box);
      });
      var gb = el('div', 'tl-row2');
      if ((c.efx || []).length) gb.appendChild(btn('Remover todos', 'Tira todos os efeitos deste clipe', function () { H.checkpoint(); (c.efx || []).forEach(function (e) { delete c.keyframes['ef.' + e.id]; }); delete c.efx; changed(); }));
      sfx.appendChild(gb); insp.appendChild(sfx);
    }
    if (window.CompoundCore) {
      var CC = window.CompoundCore, sg = section('Conexões e compostos'), gI = c.cg ? CC.compById(seq(), c.cg) : null, kids = CC.childrenOf(seq(), c.id);
      var par = c.conn ? Seq.findClip(seq(), c.conn.to) : null;
      sg.appendChild(el('p', 'tl-note', 'Clipe conectado anda junto com o principal. Composto agrupa clipes de várias faces e anda como uma unidade. O tempo de cada clipe continua absoluto na sequência (calibração e keyframes intactos).'));
      sg.appendChild(el('p', 'tl-note', par ? 'Conectado a: ' + (par.clip.name || par.clip.id) + (c.conn.off != null ? ' (deslocamento ' + (+c.conn.off).toFixed(2) + ' s)' : '') : 'Sem principal.'));
      if (kids.length) sg.appendChild(el('p', 'tl-note', 'Filhos conectados: ' + kids.length));
      if (gI) { var ginfo = CC.info(seq(), gI.id); sg.appendChild(el('p', 'tl-note', 'Composto: ' + gI.name + ' (' + (gI.open ? 'aberto' : 'fechado') + ', ' + ginfo.clips + ' clipes em ' + ginfo.surfaces.length + ' face(s), ' + ginfo.start.toFixed(2) + ' a ' + ginfo.end.toFixed(2) + ' s)')); }
      var br = el('div', 'tl-row2');
      br.appendChild(btn('Criar composto', 'Agrupa os clipes selecionados (⌘G)', makeCompoundSel));
      if (gI) { br.appendChild(btn(gI.open ? 'Fechar composto' : 'Abrir composto', 'Editar o conteúdo', function () { setCompOpen(gI, !gI.open); })); br.appendChild(btn('Separar', 'Desfaz o grupo (⇧⌘G)', function () { breakCompound(gI); })); }
      if (c.conn || kids.length) br.appendChild(btn('Desconectar', 'Desfaz a conexão', disconnectSel));
      sg.appendChild(br); insp.appendChild(sg);
    }
    if (c.ill && window.IllusionCore) {
      var si = section('Ilusão 3D');
      si.appendChild(el('p', 'tl-note', 'Parâmetros da ilusão deste clipe. Cada um aceita keyframe (◆). O tipo, as cores e o alvo se editam na aba 3D.'));
      window.IllusionCore.KF_PARAMS.forEach(function (n) { var P = window.IllusionCore.PARAMS[n], r = propRow({ p: 'ill.' + n, label: P.label, min: P.min, max: P.max, step: P.step, k: 1 }, getC); si.appendChild(r); propUI.rows.push(r); });
      insp.appendChild(si);
    }
    var s6 = section('Keyframes');
    var ks = el('div', 'tl-note'); ks.id = 'tl-kflist'; s6.appendChild(ks);
    s6.appendChild(el('p', 'tl-note', 'O botão ◆ de cada linha cria ou remove keyframe no playhead. Com Auto keyframe ligado, qualquer ajuste cria keyframe. Abra o botão Keyframes na barra da timeline pra mover, copiar, mudar a interpolação e editar curvas Bézier. Se o clipe repete (loop), os keyframes repetem junto a cada ciclo.'));
    insp.appendChild(s6);
    if (window.TlEdit) insp.appendChild(markersSection());
    syncInspector();
  }

  function assetSection(a) {
    var s = section(a.kind === 'fx' ? 'Efeito' : 'Texto');
    if (a.kind === 'fx') {
      a.fx = a.fx || { kind: 'grade', color: '#ff4fa3', speed: 1, scale: 1 };
      var ks = el('select');
      (H.FX_KINDS || []).forEach(function (k) { var o = el('option', null, k.name); o.value = k.id; ks.appendChild(o); });
      ks.value = a.fx.kind; ks.addEventListener('change', function () { H.checkpoint(); a.fx.kind = ks.value; var kk = (H.FX_KINDS || []).filter(function (x) { return x.id === ks.value; })[0]; if (kk) a.name = kk.name; changed(); });
      s.appendChild(ks);
      var row = el('div', 'tl-row2');
      var cl = el('label', null, 'Cor'), ci = el('input'); ci.type = 'color'; ci.value = a.fx.color || '#ff4fa3'; ci.addEventListener('input', function () { H.checkpoint('fxc'); a.fx.color = ci.value; H.push(); }); cl.appendChild(ci); row.appendChild(cl);
      var sl = el('label', null, 'Velocidade'), si = el('input'); si.type = 'range'; si.min = 0.1; si.max = 4; si.step = 0.1; si.value = a.fx.speed || 1; si.addEventListener('input', function () { H.checkpoint('fxs'); a.fx.speed = +si.value; H.push(); }); sl.appendChild(si); row.appendChild(sl);
      s.appendChild(row);
    } else {
      a.text = a.text || { value: 'Texto', size: 220, color: '#ffffff', font: root.Renderer ? root.Renderer.DEFAULT_FONT : 'sans-serif', bold: true, align: 'center', anim: 'none', speed: 1 };
      var ta = el('textarea'); ta.value = a.text.value; ta.rows = 2; ta.addEventListener('keydown', function (e) { e.stopPropagation(); }); ta.addEventListener('input', function () { H.checkpoint('txv'); a.text.value = ta.value; H.push(); }); s.appendChild(ta);
      var r2 = el('div', 'tl-row2');
      var cl2 = el('label', null, 'Cor'), ci2 = el('input'); ci2.type = 'color'; ci2.value = a.text.color || '#ffffff'; ci2.addEventListener('input', function () { H.checkpoint('txc'); a.text.color = ci2.value; H.push(); }); cl2.appendChild(ci2); r2.appendChild(cl2);
      var an = selField('Animação', [['none', 'Nenhuma'], ['piscar', 'Piscar'], ['digitar', 'Digitar'], ['rolar', 'Rolar']], function () { return a.text.anim || 'none'; }, function (v) { a.text.anim = v; });
      r2.appendChild(an); propUI.fields.push(an); s.appendChild(r2);
    }
    return s;
  }

  function syncInspector(light) {
    if (!insp || !tl.on) return;
    (propUI.seqFields || []).forEach(function (f) { f._u(); });
    var f = firstSel();
    if (!f) return;
    var c = f.clip;
    (propUI.fields || []).forEach(function (x) { if (x._u) x._u(); });
    (propUI.rows || []).forEach(function (r) { r._u(c); });
    var box = $('tl-kflist');
    if (box && !light) {
      var lines = [];
      Object.keys(c.keyframes).forEach(function (p) { lines.push('<b>' + (Seq.KF_LABEL[p] || p) + '</b>: ' + c.keyframes[p].map(function (k) { return Seq.fmt(k.t); }).join(', ')); });
      box.innerHTML = lines.length ? lines.join('<br>') : 'Nenhum keyframe neste clipe.';
    }
  }

  // Teste de sincronia: pisca e bipa juntos uma vez por segundo
  function syncTest() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), n = 0;
      if (st.sink && ac.setSinkId) ac.setSinkId(st.sink).catch(function () {});
      var off = (seq().settings.audioOffset || 0) / 1000;
      H.say('Teste de sincronia: 8 pisca-piscas com bip. Se o bip vem antes da luz, aumente o atraso do som; se vem depois, diminua (use valor negativo).');
      var iv = setInterval(function () {
        n++;
        var t0 = ac.currentTime + Math.max(0, off), o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 1000; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.08);
        H.state.flash = true; H.push(); if (H.rend) H.rend.sync(H.view());
        setTimeout(function () { H.state.flash = false; H.push(); if (H.rend) H.rend.sync(H.view()); }, 90);
        if (n >= 8) { clearInterval(iv); setTimeout(function () { ac.close(); }, 500); }
      }, 1000);
    } catch (e) { H.say('Não consegui iniciar o teste de som neste aparelho.'); }
  }

  function updateStat() {
    if (!statEl) return;
    var p = H.rend && H.rend.player, s = p ? p.stats : null;
    if (!s || !s.samples) { statEl.textContent = ''; return; }
    statEl.textContent = 'desvio médio ' + (s.sum / s.samples * 1000).toFixed(0) + ' ms · máx ' + (s.max * 1000).toFixed(0) + ' ms · saltos ' + s.seeks;
  }

  // ---------- Viewer: Transformar, Distorcer e Cortar (como no Final Cut) ----------
  // Transformar: cantos azuis escalam mantendo a proporção, laterais esticam só a largura ou a altura,
  //   arrastar por dentro move, o círculo do centro é a âncora e a alça que sai dele gira (quanto mais longe, mais fino o ajuste).
  // Distorcer: os 4 cantos do conteúdo se mexem sozinhos. Cortar: bordas e cantos do corte.
  // Nada disso encosta em surface.q (a calibração física).
  var TOOL_HINT = {
    transform: 'Transformar: cantos azuis mudam o tamanho mantendo a proporção, os quadradinhos do meio esticam só a largura ou a altura, arrastar por dentro move e a bolinha de cima gira (Shift gira de 15 em 15 graus, Alt desliga o ímã). Setas movem 1 px (Shift 10 px). A calibração não muda.',
    anchor: 'Âncora: arraste a mira rosa para mudar o ponto em torno do qual o clipe gira e escala. O conteúdo não pula (a posição é compensada). Ímã no centro, cantos e meio das bordas; Alt desliga.',
    distort: 'Distorcer: arraste cada canto do conteúdo sem mexer nos outros. Os cantos da superfície (calibração) não mudam.',
    crop: 'Cortar: arraste as bordas ou os cantos para cortar o conteúdo. Os cantos da superfície (calibração) não mudam.'
  };
  function toolHint() { return TOOL_HINT[st.tool] || TOOL_HINT.transform; }
  function setTool(t) {
    st.tool = t; st.hud = null; st.guides = [];
    if (H.state.mode !== 'clip') H.setMode('clip'); else { H.renderOverlay(); H.syncControls(); }
    updateBar();
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clipOnSurface() {
    var f = firstSel(); if (!f) return null;
    var tr = f.track; if (tr.type !== 'video' || !tr.surfaceId) return null;
    var sf = H.surfaces().filter(function (x) { return x.s.key === tr.surfaceId; })[0];
    if (!sf || sf.scene !== H.state.scene) return null;
    return { f: f, s: sf.s, a: Seq.asset(seq(), f.clip.assetId) };
  }
  function toStage(s, pt) { var sz = H.stageSize(), h = H.M.homography(s, sz[0], sz[1]); return h ? H.M.proj(h, pt[0], pt[1]) : [0, 0]; }
  function toLocal(s, x, y) {
    var sz = H.stageSize(), h = H.M.homography(s, sz[0], sz[1]); if (!h) return [0, 0];
    var inv = H.M.inv3(h.concat([1])); return inv ? H.M.unproj(inv, x, y) : [0, 0];
  }
  function zero4() { return [[0, 0], [0, 0], [0, 0], [0, 0]]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function cen(q) { return [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4]; }
  function pts(q) { return q.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function baseP(P) { return { x: P.x, y: P.y, scale: P.scale, sx: P.sx, sy: P.sy, rot: P.rot, ax: P.ax || 0, ay: P.ay || 0, flipH: !!P.flipH, flipV: !!P.flipV, corners: zero4() }; }
  function hasDistort(P) { return P.corners.some(function (c) { return Math.abs(c[0]) > 1e-6 || Math.abs(c[1]) > 1e-6; }); }
  // mapa do espaço do clipe (retângulo W x H) para o espaço local da superfície
  function clipMap(s, P) { return H.M.solveH([[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]], Seq.quadOf(s.w, s.h, P)); }


  // ---------- Fase 8: ajudas do Viewer (grade, réguas, áreas seguras, guias, trajetória) ----------
  function VC() { return window.ViewerCore; }
  function view() { var S = seq().settings; if (!S.view || !VC()) S.view = VC() ? VC().sanitizeView(S.view) : { guides: [] }; return S.view; }
  function viewChange(fn, quiet) { H.checkpoint(); fn(view()); H.renderOverlay(); updateBar(); if (!quiet) refresh(); }
  function drawView(s, W, Hh, o, svgEl) {
    var V = VC(); if (!V) return; var v = view(), sz = H.stageSize(), i;
    function L(a, b, cls, extra) { var A = toStage(s, a), B = toStage(s, b), at = { x1: A[0], y1: A[1], x2: B[0], y2: B[1], 'class': cls }; if (extra) for (var k in extra) at[k] = extra[k]; return o.appendChild(svgEl('line', at)); }
    if (v.grid.on) { var gl = V.gridLines(v, W, Hh); gl.v.forEach(function (x) { L([x, 0], [x, Hh], 'tl-grid'); }); gl.h.forEach(function (y) { L([0, y], [W, y], 'tl-grid'); }); }
    if (v.thirds) { var th = V.thirdsLines(W, Hh); th.v.forEach(function (x) { L([x, 0], [x, Hh], 'tl-third'); }); th.h.forEach(function (y) { L([0, y], [W, y], 'tl-third'); }); }
    if (v.safe.on) V.safeRects(v, W, Hh).forEach(function (r) {
      var q = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(function (p) { return toStage(s, p); });
      o.appendChild(svgEl('polygon', { points: pts(q), 'class': 'tl-safe' }));
      var tx = svgEl('text', { x: q[0][0] + 6, y: q[0][1] + 13, 'class': 'tl-rult' }); tx.textContent = r.name; o.appendChild(tx);
    });
    if (v.rulers) {
      var tw = Math.hypot.apply(null, [toStage(s, [W, 0])[0] - toStage(s, [0, 0])[0], toStage(s, [W, 0])[1] - toStage(s, [0, 0])[1]]), th2 = Math.hypot(toStage(s, [0, Hh])[0] - toStage(s, [0, 0])[0], toStage(s, [0, Hh])[1] - toStage(s, [0, 0])[1]);
      var bgT = [[0, 0], [W, 0], [W, -18 * W / Math.max(1, tw)], [0, -18 * W / Math.max(1, tw)]].map(function (p) { return toStage(s, p); });
      var bgL = [[0, 0], [-18 * Hh / Math.max(1, th2), 0], [-18 * Hh / Math.max(1, th2), Hh], [0, Hh]].map(function (p) { return toStage(s, p); });
      o.appendChild(svgEl('polygon', { points: pts(bgT), 'class': 'tl-rulbg', 'data-k': 'tlrul', 'data-axis': 'h' }));
      o.appendChild(svgEl('polygon', { points: pts(bgL), 'class': 'tl-rulbg', 'data-k': 'tlrul', 'data-axis': 'v' }));
      var uT = 5 * W / Math.max(1, tw), uL = 5 * Hh / Math.max(1, th2);
      V.rulerTicks(W, tw, 56).forEach(function (t) { var a = [t.v, 0], b = [t.v, t.major ? -uT * 2 : -uT]; L(a, b, 'tl-rul'); if (t.major) { var p = toStage(s, [t.v, -uT * 2.6]), tx = svgEl('text', { x: p[0] + 2, y: p[1], 'class': 'tl-rult' }); tx.textContent = String(Math.round(t.v)); o.appendChild(tx); } });
      V.rulerTicks(Hh, th2, 56).forEach(function (t) { var a = [0, t.v], b = [t.major ? -uL * 2 : -uL, t.v]; L(a, b, 'tl-rul'); if (t.major) { var p = toStage(s, [-uL * 2.6, t.v]), tx = svgEl('text', { x: p[0] - 2, y: p[1] - 2, 'class': 'tl-rult' }); tx.textContent = String(Math.round(t.v)); o.appendChild(tx); } });
    }
    v.guides.forEach(function (g) {
      var a = g.axis === 'v' ? [g.pos * W, 0] : [0, g.pos * Hh], b = g.axis === 'v' ? [g.pos * W, Hh] : [W, g.pos * Hh];
      L(a, b, 'tl-gline');
    });
  }
  // as áreas de captura das guias e as réguas ficam POR CIMA das ferramentas (senão a caixa do clipe engole o clique)
  function drawViewHits(s, W, Hh, o, svgEl) {
    var V = VC(); if (!V) return; var v = view();
    v.guides.forEach(function (g) {
      var a = toStage(s, g.axis === 'v' ? [g.pos * W, 0] : [0, g.pos * Hh]), b = toStage(s, g.axis === 'v' ? [g.pos * W, Hh] : [W, g.pos * Hh]);
      o.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'tl-ghit', 'data-k': 'tlgd', 'data-id': g.id, 'data-axis': g.axis, style: 'cursor:' + (g.axis === 'v' ? 'col-resize' : 'row-resize') }));
    });
  }
  function drawMotionPath(s, W, Hh, c, o, svgEl) {
    var V = VC(); if (!V || !view().paths) return;
    var mp = V.motionPath(Seq, c, W, Hh, 80); if (!mp.animated) return;
    o.appendChild(svgEl('polyline', { points: pts(mp.pts.map(function (p) { return toStage(s, p); })), 'class': 'tl-mpath' }));
    mp.keys.forEach(function (k, i) { var p = toStage(s, [k.x, k.y]); var d = o.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 6, 'class': 'tl-mpk', 'data-k': 'tlmp', 'data-t': k.t, 'data-i': i })); var tt = svgEl('title', {}); tt.textContent = 'Keyframe em ' + k.t.toFixed(2) + ' s (arraste para mudar a posição)'; d.appendChild(tt); });
  }
  function ancStr(P) { return 'Âncora ' + (((P.ax || 0) + 0.5) * 100).toFixed(1) + '%, ' + (((P.ay || 0) + 0.5) * 100).toFixed(1) + '%'; }
  function flipToggle(axis) {
    var f = firstSel(), V = VC(); if (!f || !V || f.track.type !== 'video') { H.say('Selecione um clipe de vídeo.'); return; }
    H.checkpoint(); var r = V.toggleFlip(f.clip, axis); H.say('Espelho ' + (axis === 'h' ? 'horizontal ' : 'vertical ') + ((axis === 'h' ? r.flipH : r.flipV) ? 'ligado.' : 'desligado.')); changed(); H.renderOverlay();
  }
  function resetClipTransform() {
    var f = firstSel(), V = VC(); if (!f || !V || f.track.type !== 'video') { H.say('Selecione um clipe de vídeo.'); return; }
    H.checkpoint(); var r = V.resetTransform(f.clip); H.say('Transformação zerada' + (r.keysRemoved ? ' (' + r.keysRemoved + ' propriedade(s) com keyframe voltaram ao normal)' : '') + '. A calibração da superfície não mudou. Use Desfazer para voltar.'); changed(); H.renderOverlay();
  }
  function helpsMenu(e) {
    var v = view(), r = e.currentTarget.getBoundingClientRect();
    function T(label, key, sub) { return { label: label, on: sub ? v[key][sub] : v[key], fn: function () { viewChange(function (vv) { if (sub) vv[key][sub] = !vv[key][sub]; else vv[key] = !vv[key]; }, true); } }; }
    var items = [{ header: 'Ajudas do Viewer (só visuais)' }, T('Grade', 'grid', 'on'), T('Régua (arraste dela para criar guia)', 'rulers'), T('Áreas seguras (ação e título)', 'safe', 'on'), T('Terços', 'thirds'), T('Trajetória dos keyframes', 'paths'), T('Ímã nas guias, grade e áreas', 'snapGuides'), { header: 'Divisões da grade' }];
    [4, 8, 10, 16, 32].forEach(function (n) { items.push({ label: n + ' x ' + n, on: v.grid.div === n, fn: function () { viewChange(function (vv) { vv.grid.div = n; vv.grid.on = true; }, true); } }); });
    items.push({ header: 'Guias' });
    items.push({ label: 'Nova guia vertical (centro)', fn: function () { viewChange(function (vv) { VC().addGuide(vv, 'v', 0.5); }, true); } });
    items.push({ label: 'Nova guia horizontal (centro)', fn: function () { viewChange(function (vv) { VC().addGuide(vv, 'h', 0.5); }, true); } });
    items.push({ label: 'Limpar todas as guias (' + v.guides.length + ')', disabled: !v.guides.length, fn: function () { viewChange(function (vv) { VC().clearGuides(vv); }, true); } });
    TlMenu.show(r.left, r.bottom + 6, items);
  }

  function drawClipOverlay() {
    var o = H.overlay, svgEl = H.svgEl, ctx = clipOnSurface();
    function note(t) { var t0 = svgEl('text', { x: 14, y: 22, 'class': 'q-empty' }); t0.style.textAnchor = 'start'; t0.textContent = t; o.appendChild(t0); }
    if (!ctx) { note('Edição de clipe: selecione um clipe de vídeo na timeline (ou clique numa face).'); return; }
    var s = ctx.s, W = s.w, Hh = s.h, c = ctx.f.clip;
    var surf = [[0, 0], [W, 0], [W, Hh], [0, Hh]].map(function (p) { return toStage(s, p); });
    o.appendChild(svgEl('polygon', { points: pts(surf), 'class': 'tl-surf' }));
    drawView(s, W, Hh, o, svgEl);
    var ev = Seq.evalClip(c, ctx.a, now());
    if (!ev) { note('O playhead está fora deste clipe. Mova o playhead para dentro dele para editar.'); return; }
    var P = ev.p, tool = st.tool, qb, qd, i;
    qb = Seq.quadOf(W, Hh, baseP(P)).map(function (p) { return toStage(s, p); });
    qd = Seq.quadOf(W, Hh, P).map(function (p) { return toStage(s, p); });
    function sq(p, k, idx, cur) { return o.appendChild(svgEl('rect', { x: p[0] - 6, y: p[1] - 6, width: 12, height: 12, 'class': 'tl-hd', 'data-k': k, 'data-i': idx, style: 'cursor:' + cur })); }
    // guias de alinhamento (ímã) durante o arraste
    (st.guides || []).forEach(function (g) {
      var a = g.v ? toStage(s, [g.v, 0]) : toStage(s, [0, g.h]), b = g.v ? toStage(s, [g.v, Hh]) : toStage(s, [W, g.h]);
      o.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'tl-guide' }));
    });
    if (tool === 'transform') {
      if (hasDistort(P)) o.appendChild(svgEl('polygon', { points: pts(qd), 'class': 'tl-dist' }));
      o.appendChild(svgEl('polygon', { points: pts(qb), 'class': 'tl-box', 'data-k': 'tlm' }));
      var C = toStage(s, VC() ? VC().anchorPoint(P, W, Hh) : [W / 2 + P.x * W, Hh / 2 + P.y * Hh]), top = mid(qb[0], qb[1]), dx = top[0] - C[0], dy = top[1] - C[1], nl = Math.hypot(dx, dy) || 1, rh = [top[0] + dx / nl * 38, top[1] + dy / nl * 38], ss = H.stageSize();
      rh = [Math.max(14, Math.min(ss[0] - 14, rh[0])), Math.max(14, Math.min(ss[1] - 14, rh[1]))];   // a bolinha de girar nunca sai da área visível
      o.appendChild(svgEl('line', { x1: C[0], y1: C[1], x2: rh[0], y2: rh[1], 'class': 'tl-rl' }));
      o.appendChild(svgEl('circle', { cx: C[0], cy: C[1], r: 7, 'class': 'tl-ctr' }));
      for (i = 0; i < 4; i++) sq(mid(qb[i], qb[(i + 1) % 4]), 'tlss', i, i % 2 ? 'ew-resize' : 'ns-resize');
      for (i = 0; i < 4; i++) { var cr = o.appendChild(svgEl('circle', { cx: qb[i][0], cy: qb[i][1], r: 7, 'class': 'tl-hd', 'data-k': 'tlsc', 'data-i': i, style: 'cursor:nwse-resize' })); }
      o.appendChild(svgEl('circle', { cx: rh[0], cy: rh[1], r: 9, 'class': 'tl-hd rot', 'data-k': 'tlr', style: 'cursor:grab' }));
    } else if (tool === 'anchor') {
      o.appendChild(svgEl('polygon', { points: pts(qb), 'class': 'tl-box', 'data-k': 'tlm' }));
      var AP = toStage(s, VC().anchorPoint(P, W, Hh));
      o.appendChild(svgEl('line', { x1: AP[0] - 22, y1: AP[1], x2: AP[0] + 22, y2: AP[1], 'class': 'tl-ancl' })); o.appendChild(svgEl('line', { x1: AP[0], y1: AP[1] - 22, x2: AP[0], y2: AP[1] + 22, 'class': 'tl-ancl' }));
      o.appendChild(svgEl('circle', { cx: AP[0], cy: AP[1], r: 11, 'class': 'tl-anc', 'data-k': 'tlan' }));
      var alb = svgEl('text', { x: AP[0] + 16, y: AP[1] - 14, 'class': 'h-label' }); alb.textContent = ancStr(P); o.appendChild(alb);
    } else if (tool === 'distort') {
      o.appendChild(svgEl('polygon', { points: pts(qd), 'class': 'tl-box', 'data-k': 'tlm' }));
      for (i = 0; i < 4; i++) o.appendChild(svgEl('circle', { cx: qd[i][0], cy: qd[i][1], r: 8, 'class': 'tl-hd dist', 'data-k': 'tlc', 'data-i': i, style: 'cursor:crosshair' }));
      for (i = 0; i < 4; i++) { var lb0 = svgEl('text', { x: qd[i][0] + 10, y: qd[i][1] - 8, 'class': 'h-label' }); lb0.textContent = String(i + 1); o.appendChild(lb0); }
    } else {
      var h = clipMap(s, P), cp = ev.crop || c.transform.crop;
      var R = [[cp.l * W, cp.t * Hh], [(1 - cp.r) * W, cp.t * Hh], [(1 - cp.r) * W, (1 - cp.b) * Hh], [cp.l * W, (1 - cp.b) * Hh]].map(function (p) { return toStage(s, H.M.proj(h, p[0], p[1])); });
      o.appendChild(svgEl('polygon', { points: pts(qd), 'class': 'tl-dist' }));
      o.appendChild(svgEl('polygon', { points: pts(R), 'class': 'tl-crop' }));
      for (i = 0; i < 4; i++) sq(mid(R[i], R[(i + 1) % 4]), 'tlcr', i, i % 2 ? 'ew-resize' : 'ns-resize');
      for (i = 0; i < 4; i++) o.appendChild(svgEl('circle', { cx: R[i][0], cy: R[i][1], r: 7, 'class': 'tl-hd', 'data-k': 'tlcr', 'data-i': 4 + i, style: 'cursor:nwse-resize' }));
    }
    drawMotionPath(s, W, Hh, c, o, svgEl);
    drawViewHits(s, W, Hh, o, svgEl);
    var lb = svgEl('text', { x: surf[0][0] + 8, y: surf[0][1] - 8, 'class': 'h-label' });
    lb.textContent = (c.name || 'Clipe') + ' · ' + TOOLS[tool] + (tl.autoKey ? ' · auto keyframe' : '') + (isCalLocked(s) ? ' · calibração travada' : '');
    o.appendChild(lb);
    if (st.hud) { var ht = svgEl('text', { x: st.hud.x + 16, y: st.hud.y - 12, 'class': 'tl-hud' }); ht.textContent = st.hud.text; o.appendChild(ht); }
  }
  var TOOLS = { transform: 'Transformar', anchor: 'Âncora', distort: 'Distorcer', crop: 'Cortar' };
  function isCalLocked(s) { return !!(tl.lockCal || (s && s.locked)); }

  function overlayDown(e, kind) {
    var ctx = clipOnSurface(); if (!ctx) return;
    e.preventDefault();
    var c = ctx.f.clip, s = ctx.s, W = s.w, Hh = s.h, ev = Seq.evalClip(c, ctx.a, now());
    if (!ev) { H.say('O playhead está fora deste clipe. Mova o playhead para dentro dele para editar.'); return; }
    var P0 = clone(ev.p), r = H.stage.getBoundingClientRect(), crop0 = clone(c.transform.crop);
    var st0 = toLocal(s, e.clientX - r.left, e.clientY - r.top), idx = +(e.target.getAttribute('data-i') || 0);
    var C0 = VC() ? VC().anchorPoint(P0, W, Hh) : [W / 2 + P0.x * W, Hh / 2 + P0.y * Hh];   // âncora (centro do quadro por padrão)
    var rad = P0.rot * Math.PI / 180, ex = [Math.cos(rad), Math.sin(rad)], ey = [-Math.sin(rad), Math.cos(rad)];
    var d0 = Math.hypot(st0[0] - C0[0], st0[1] - C0[1]) || 1, prev = Math.atan2(st0[1] - C0[1], st0[0] - C0[0]), acc = 0;
    var base = Seq.quadOf(W, Hh, baseP(P0));
    var inv = null;
    if (kind === 'tlrul') {                                                    // arrastar da régua cria uma guia
      var axR = e.target.getAttribute('data-axis') === 'v' ? 'v' : 'h';
      H.checkpoint(); var gr = VC().addGuide(view(), axR === 'v' ? 'v' : 'h', axR === 'v' ? Math.max(0, st0[0]) / W : Math.max(0, st0[1]) / Hh);
      if (!gr.ok) { H.say(gr.error); return; }
      kind = 'tlgd'; e = { target: { getAttribute: function (n) { return n === 'data-id' ? gr.guide.id : axR; } }, clientX: e.clientX, clientY: e.clientY };
    }
    if (kind === 'tlgd') {                                                    // mover ou apagar guia (soltar fora da superfície apaga)
      var gid = e.target.getAttribute('data-id'), gax = e.target.getAttribute('data-axis'), moved0 = false;
      var mvg = function (ev3) {
        var q = toLocal(s, ev3.clientX - r.left, ev3.clientY - r.top), pos = gax === 'v' ? q[0] / W : q[1] / Hh;
        if (!moved0) { moved0 = true; if (!st.guideCp) H.checkpoint(); } st.guideCp = 0;
        if (pos < -0.02 || pos > 1.02) { VC().removeGuide(view(), gid); st.hud = { x: ev3.clientX - r.left, y: ev3.clientY - r.top, text: 'Solte para apagar a guia' }; window.removeEventListener('pointermove', mvg); window.removeEventListener('pointerup', upg); H.renderOverlay(); setTimeout(function () { st.hud = null; H.renderOverlay(); }, 600); return; }
        VC().moveGuide(view(), gid, Math.round(pos * 1000) / 1000); st.hud = { x: ev3.clientX - r.left, y: ev3.clientY - r.top, text: (gax === 'v' ? 'Guia X ' : 'Guia Y ') + (pos * 100).toFixed(1) + '%' }; H.renderOverlay();
      };
      var upg = function () { window.removeEventListener('pointermove', mvg); window.removeEventListener('pointerup', upg); st.hud = null; H.renderOverlay(); H.syncClock(); H.push(); };
      window.addEventListener('pointermove', mvg); window.addEventListener('pointerup', upg); return;
    }
    if (kind === 'tlmp') {                                                    // arrastar um ponto-chave da trajetória muda x e y daquele keyframe
      var tk = parseFloat(e.target.getAttribute('data-t')), mp0 = VC().motionPath(Seq, c, W, Hh, 8), kk = mp0.keys.filter(function (k) { return Math.abs(k.t - tk) < 1e-3; })[0]; if (!kk) return;
      H.checkpoint();
      var mvp = function (ev3) {
        var q = toLocal(s, ev3.clientX - r.left, ev3.clientY - r.top), ap = P0.ax || 0, ay2 = P0.ay || 0;
        var nxp = (q[0] - W / 2) / W - ap, nyp = (q[1] - Hh / 2) / Hh - ay2;
        Seq.setKey(c, 'x', tk, nxp, Seq.hasKey(c, 'x', tk) ? undefined : defI()); Seq.setKey(c, 'y', tk, nyp, Seq.hasKey(c, 'y', tk) ? undefined : defI());
        st.hud = { x: ev3.clientX - r.left, y: ev3.clientY - r.top, text: 'Keyframe ' + tk.toFixed(2) + ' s  X ' + (nxp * 100).toFixed(1) + '%  Y ' + (nyp * 100).toFixed(1) + '%' };
        H.syncClock(); H.push(); H.renderOverlay();
      };
      var upp = function () { window.removeEventListener('pointermove', mvp); window.removeEventListener('pointerup', upp); st.hud = null; changed(); H.renderOverlay(); };
      window.addEventListener('pointermove', mvp); window.addEventListener('pointerup', upp); return;
    }
    if (kind === 'tlan') {                                                    // mover a âncora sem mover o conteúdo
      var hA = clipMap(s, baseP(P0)), invA = hA ? H.M.inv3(hA.concat([1])) : null; if (!invA) return; H.checkpoint();
      var tolA = 9 * W / Math.max(1, H.stageSize()[0]);
      var mva = function (ev3) {
        var q = toLocal(s, ev3.clientX - r.left, ev3.clientY - r.top), cp2 = H.M.unproj(invA, q[0], q[1]), a2 = [(cp2[0] - W / 2) / W, (cp2[1] - Hh / 2) / Hh];
        if (!ev3.altKey && seq().settings.snap) { [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]].forEach(function (t) { if (Math.hypot((a2[0] - t[0]) * W, (a2[1] - t[1]) * Hh) < tolA) a2 = t; }); }
        a2 = [clamp(a2[0], -2, 2), clamp(a2[1], -2, 2)];
        var cmp = VC().compensateAnchor(P0, W, Hh, a2);
        setProp(c, 'ax', cmp.ax); setProp(c, 'ay', cmp.ay); setProp(c, 'x', cmp.x); setProp(c, 'y', cmp.y);
        st.hud = { x: ev3.clientX - r.left, y: ev3.clientY - r.top, text: ancStr({ ax: a2[0], ay: a2[1] }) }; H.renderOverlay();
      };
      var upa = function () { window.removeEventListener('pointermove', mva); window.removeEventListener('pointerup', upa); st.hud = null; changed(); H.renderOverlay(); };
      window.addEventListener('pointermove', mva); window.addEventListener('pointerup', upa); return;
    }
    if (kind === 'tlcr') { var hh = clipMap(s, P0); inv = hh ? H.M.inv3(hh.concat([1])) : null; H.checkpoint(); }
    var tolL = 8 * W / Math.max(1, H.stageSize()[0]);                      // 8 px da tela, em unidades da superfície
    var stagePt = [e.clientX - r.left, e.clientY - r.top];
    function hud(t, ev2) { st.hud = { x: ev2.clientX - r.left, y: ev2.clientY - r.top, text: t }; }
    function mv(ev2) {
      var pl = toLocal(s, ev2.clientX - r.left, ev2.clientY - r.top), nx, ny, f;
      st.guides = [];
      if (kind === 'tlm') {
        nx = P0.x + (pl[0] - st0[0]) / W; ny = P0.y + (pl[1] - st0[1]) / Hh;
        if (!ev2.altKey && seq().settings.snap) {
          var cx = W / 2 + nx * W, cy = Hh / 2 + ny * Hh, hw = W * P0.scale * P0.sx / 2, hh2 = Hh * P0.scale * P0.sy / 2, plain = Math.abs(P0.rot) < 1e-6 && !hasDistort(P0);
          var xs = [[cx, W / 2, 0]], ys = [[cy, Hh / 2, 0]];
          if (plain) { xs.push([cx - hw, 0, -hw], [cx + hw, W, hw], [cx - hw, W, -hw], [cx + hw, 0, hw]); ys.push([cy - hh2, 0, -hh2], [cy + hh2, Hh, hh2], [cy - hh2, Hh, -hh2], [cy + hh2, 0, hh2]); }
          if (VC() && view().snapGuides) { var vt = VC().snapTargets(view(), W, Hh); vt.x.forEach(function (t) { if (t === 0 || t === W / 2 || t === W) return; xs.push([cx, t, 0]); if (plain) { xs.push([cx - hw, t, -hw], [cx + hw, t, hw]); } }); vt.y.forEach(function (t) { if (t === 0 || t === Hh / 2 || t === Hh) return; ys.push([cy, t, 0]); if (plain) { ys.push([cy - hh2, t, -hh2], [cy + hh2, t, hh2]); } }); }
          var bx = null, by = null, db = tolL;
          xs.forEach(function (t) { var d = Math.abs(t[0] - t[1]); if (d < db) { db = d; bx = t; } });
          db = tolL; ys.forEach(function (t) { var d = Math.abs(t[0] - t[1]); if (d < db) { db = d; by = t; } });
          if (bx) { nx = (bx[1] - bx[2] - W / 2) / W; st.guides.push({ v: bx[1] }); }
          if (by) { ny = (by[1] - by[2] - Hh / 2) / Hh; st.guides.push({ h: by[1] }); }
        }
        setProp(c, 'x', nx); setProp(c, 'y', ny);
        hud('X ' + (nx * 100).toFixed(1) + '%   Y ' + (ny * 100).toFixed(1) + '%', ev2);
      } else if (kind === 'tlr') {
        var a1 = Math.atan2(pl[1] - C0[1], pl[0] - C0[0]), dl = a1 - prev;
        while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
        acc += dl; prev = a1;
        var v = P0.rot + acc * 180 / Math.PI;
        if (ev2.shiftKey) v = Math.round(v / 15) * 15;
        setProp(c, 'rot', v); hud('Rotação ' + v.toFixed(1) + '°', ev2);
      } else if (kind === 'tlsc') {
        f = Math.hypot(pl[0] - C0[0], pl[1] - C0[1]) / d0;
        var sc = clamp(P0.scale * f, 0.02, 20); setProp(c, 'scale', sc); hud('Escala ' + (sc * 100).toFixed(0) + '%', ev2);
      } else if (kind === 'tlss') {
        var u = idx % 2 ? ex : ey, ds = Math.abs((st0[0] - C0[0]) * u[0] + (st0[1] - C0[1]) * u[1]) || 1, dn = Math.abs((pl[0] - C0[0]) * u[0] + (pl[1] - C0[1]) * u[1]);
        var pr = idx % 2 ? 'sx' : 'sy', nv = clamp(P0[pr] * dn / ds, 0.02, 20);
        setProp(c, pr, nv); hud((idx % 2 ? 'Largura ' : 'Altura ') + (nv * P0.scale * 100).toFixed(0) + '%', ev2);
      } else if (kind === 'tlc') {
        var o2 = [(pl[0] - base[idx][0]) / W, (pl[1] - base[idx][1]) / Hh];
        setProp(c, 'c' + idx + 'x', o2[0]); setProp(c, 'c' + idx + 'y', o2[1]); hud('Canto ' + (idx + 1) + '  ' + (o2[0] * 100).toFixed(1) + '%, ' + (o2[1] * 100).toFixed(1) + '%', ev2);
      } else if (kind === 'tlcr' && inv) {
        var q = H.M.unproj(inv, pl[0], pl[1]), cr = clone(ev.crop || c.transform.crop), nm = '';
        var L = clamp(q[0] / W, 0, 0.95), T = clamp(q[1] / Hh, 0, 0.95), R = clamp(1 - q[0] / W, 0, 0.95), B = clamp(1 - q[1] / Hh, 0, 0.95);
        if (idx === 0 || idx === 4 || idx === 5) { cr.t = Math.min(T, 0.95 - cr.b); nm = 'topo ' + (cr.t * 100).toFixed(0) + '%'; }
        if (idx === 2 || idx === 6 || idx === 7) { cr.b = Math.min(B, 0.95 - cr.t); nm = 'base ' + (cr.b * 100).toFixed(0) + '%'; }
        if (idx === 3 || idx === 4 || idx === 7) { cr.l = Math.min(L, 0.95 - cr.r); nm = 'esquerda ' + (cr.l * 100).toFixed(0) + '%'; }
        if (idx === 1 || idx === 5 || idx === 6) { cr.r = Math.min(R, 0.95 - cr.l); nm = 'direita ' + (cr.r * 100).toFixed(0) + '%'; }
        [['l', 'cl'], ['t', 'ct'], ['r', 'cr'], ['b', 'cb']].forEach(function (kv) { if (Math.abs(cr[kv[0]] - (ev.crop || c.transform.crop)[kv[0]]) > 1e-9) setProp(c, kv[1], cr[kv[0]]); });
        H.syncClock(); H.push(); refresh(); hud('Corte ' + nm, ev2);
      }
      H.renderOverlay();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); st.hud = null; st.guides = []; changed(); H.renderOverlay(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // Clicar numa face no Viewer (modo clipe): escolhe a face e o clipe de cima que está ativo no playhead.
  function pickAt(x, y) {
    var hit = H.hitSurface ? H.hitSurface(x, y) : null; if (!hit) return;
    if (hit.key) H.selectKey(hit.key);
    var T = now(), layers = Seq.layersOf(seq(), hit.key), found = null;
    for (var i = 0; i < layers.length && !found; i++) {
      for (var j = 0; j < layers[i].clips.length; j++) { var c = layers[i].clips[j]; if (T >= c.start && T < c.start + c.duration) { found = c; break; } }
    }
    if (found) { st.sel = {}; st.sel[found.id] = 1; var f = Seq.findClip(seq(), found.id); if (f) st.selTrack = f.track.id; }
    refresh(); H.renderOverlay();
  }

  // Setas movem o clipe 1 px (Shift 10 px) no modo clipe e NUNCA a calibração. Shift+T, Shift+D, Shift+C trocam de ferramenta.
  function onWinKey(e) {
    if (!tl.on || H.state.mode !== 'clip') return;
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (e.shiftKey && k === 'A') { e.preventDefault(); e.stopImmediatePropagation(); setTool('anchor'); return; }
    if (e.shiftKey && (k === 'T' || k === 'D' || k === 'C')) { e.preventDefault(); e.stopImmediatePropagation(); setTool(k === 'T' ? 'transform' : k === 'D' ? 'distort' : 'crop'); return; }
    if (st.dockFocus && k.indexOf('Arrow') === 0) return; // com o foco na timeline, as setas navegam (pontos de edição, marcadores)
    var dx = 0, dy = 0, stp = e.shiftKey ? 10 : 1;
    if (k === 'ArrowLeft') dx = -stp; else if (k === 'ArrowRight') dx = stp; else if (k === 'ArrowUp') dy = -stp; else if (k === 'ArrowDown') dy = stp; else return;
    e.preventDefault(); e.stopImmediatePropagation();
    var ctx = clipOnSurface(); if (!ctx) return;
    var ev = Seq.evalClip(ctx.f.clip, ctx.a, now()); if (!ev) return;
    setProp(ctx.f.clip, 'x', ev.p.x + dx / ctx.s.w); setProp(ctx.f.clip, 'y', ev.p.y + dy / ctx.s.h);
    H.renderOverlay();
  }

  // Barra do Viewer: Calibração | Transformar | Distorcer | Cortar, e o cadeado da calibração
  var vbar = null, vbar2 = null;
  function buildVBar() {
    var wrap = H.stage.parentElement; if (!wrap) return;
    vbar = el('div', 'tl-vbar'); vbar.setAttribute('role', 'toolbar'); vbar.setAttribute('aria-label', 'Ferramentas do Viewer');
    function b(label, title, fn, key) { var x = el('button', 'tl-vb', label); x.type = 'button'; x.title = title; x.dataset.k = key; x.addEventListener('click', fn); vbar.appendChild(x); return x; }
    b('Calibração', 'Mexer nos cantos da superfície (calibração física)', function () { H.setMode('corners'); updateBar(); }, 'cal');
    b('Transformar', 'Transformar o clipe: mover, escalar e girar (Shift+T)', function () { setTool('transform'); }, 'transform');
    b('Distorcer', 'Distorcer os 4 cantos do conteúdo (Shift+D)', function () { setTool('distort'); }, 'distort');
    b('Cortar', 'Cortar as bordas do conteúdo (Shift+C)', function () { setTool('crop'); }, 'crop');
    var lk = b('', 'Trava ou destrava a calibração de todas as faces', function () { tl.lockCal = !tl.lockCal; H.renderOverlay(); H.syncControls(); renderAll(); }, 'lock');
    lk.classList.add('lk');
    wrap.appendChild(vbar);
    vbar2 = el('div', 'tl-vbar v2'); vbar2.setAttribute('role', 'toolbar'); vbar2.setAttribute('aria-label', 'Ajudas e ajustes do Viewer');
    function b2(label, title, fn, key) { var x = el('button', 'tl-vb sm', label); x.type = 'button'; x.title = title; x.dataset.k = key; x.addEventListener('click', fn); vbar2.appendChild(x); return x; }
    b2('Âncora', 'Mudar o ponto de giro e escala do clipe (Shift+A)', function () { setTool('anchor'); }, 'anchor');
    b2('Espelhar H', 'Espelha o clipe na horizontal (em torno da âncora)', function () { flipToggle('h'); }, 'flipH');
    b2('Espelhar V', 'Espelha o clipe na vertical (em torno da âncora)', function () { flipToggle('v'); }, 'flipV');
    b2('Resetar', 'Zera posição, escala, rotação, âncora, espelho, distorção e corte do clipe (a calibração não muda)', resetClipTransform, 'reset');
    b2('Ajudas ▾', 'Grade, régua, áreas seguras, guias, trajetória', helpsMenu, 'helps');
    wrap.appendChild(vbar2);
  }
  function updateBar() {
    if (vbar2) { vbar2.style.display = tl.on && H.state.mode === 'clip' ? 'flex' : 'none'; var fv = firstSel(), cv = fv && fv.clip.transform ? fv.clip.transform : null; [].forEach.call(vbar2.querySelectorAll('.tl-vb'), function (x) { var k = x.dataset.k; if (k === 'anchor') x.classList.toggle('on', st.tool === 'anchor'); else if (k === 'flipH') x.classList.toggle('on', !!(cv && cv.flipH)); else if (k === 'flipV') x.classList.toggle('on', !!(cv && cv.flipV)); else if (k === 'helps') { var vv = seq().settings.view; x.classList.toggle('on', !!(vv && (vv.grid.on || vv.rulers || vv.safe.on || vv.thirds || vv.guides.length))); } }); }
    if (!vbar) return;
    vbar.style.display = tl.on ? 'flex' : 'none';
    var clipMode = H.state.mode === 'clip';
    [].forEach.call(vbar.querySelectorAll('.tl-vb'), function (x) {
      var k = x.dataset.k;
      if (k === 'cal') x.classList.toggle('on', !clipMode);
      else if (k === 'lock') { x.classList.toggle('on', !!tl.lockCal); x.textContent = tl.lockCal ? '🔒 Calibração travada' : '🔓 Calibração livre'; }
      else x.classList.toggle('on', clipMode && st.tool === k);
    });
  }

  // ---------- init ----------
  function init(host) {
    H = host; Seq = host.Seq; tl = host.tl;
    if (window.CompoundCore && !H._ccWrapped) { var cp0 = H.checkpoint; H.checkpoint = function (k) { try { CompoundCore.mark(tl.seq); } catch (e) {} return cp0.apply(H, arguments); }; H._ccWrapped = 1; }
    build();
    if (window.KeyframeUI && window.KeyframeCore) {
      KeyframeUI.init({
        Seq: Seq, K: window.KeyframeCore, mount: function (pn) { dock.appendChild(pn); },
        seq: seq, now: now, seek: seek, fps: fps, say: H.say, checkpoint: H.checkpoint, refresh: refresh,
        apply: function () { H.syncClock(); H.push(); },
        zoom: function () { return st.zoom; }, zoomAt: function (f, a) { zoom(f, a); },
        scrollLeft: function () { return scrollEl.scrollLeft; }, setScrollLeft: function (v) { scrollEl.scrollLeft = v; },
        lanesWidth: function () { return Math.max(scrollEl.clientWidth, Math.ceil((seq().duration + 4) * st.zoom) + 40); },
        duration: function () { return seq().duration; }, snapOn: function () { return !!seq().settings.snap; },
        selectedClip: function () { return firstSel(); }, findClip: function (id) { return Seq.findClip(seq(), id); },
        clipById: function (id) { var f = Seq.findClip(seq(), id); return f ? f.clip : null; },
        curCl: curCl, curClRaw: function (c) { return now() - c.start; },
        growDock: function (dh) { st.dockH = clamp(st.dockH + dh, 190, Math.round(window.innerHeight * 0.85)); document.querySelector('.app').style.setProperty('--tlh', st.dockH + 'px'); }
      });
    }
    var mc = $('m-clip');
    if (mc) mc.addEventListener('click', function () { H.setMode('clip'); renderAll(); });
    st.tool = 'transform'; st.hud = null; st.guides = [];
    buildVBar(); window.addEventListener('keydown', onWinKey, true);
    H.rend = host.rend;
    root.TimelineUI._h = H;
    renderAll();
  }

  root.TimelineUI = {
    ui: { firstSel: function () { return firstSel(); }, changed: function () { changed(); }, selIds: function () { return selIds(); }, selectClip: function (id) { st.sel = {}; st.sel[id] = 1; st.anchor = id; refresh(); } },
    mediaHost: mediaHost, init: init, refresh: refresh, drawClipOverlay: drawClipOverlay, overlayDown: overlayDown, pickAt: pickAt, updateBar: updateBar, toolHint: toolHint, setTool: setTool, intercept: intercept, importAudio: importAudio,
    _state: st,
    api: {
      play: function () { if (!tl.clock.playing) togglePlay(); }, pause: function () { if (tl.clock.playing) togglePlay(); }, seek: seek,
      select: function (id) { st.sel = {}; st.sel[id] = 1; refresh(); }, split: splitSel, del: delSel, dup: dupSel, zoom: zoom,
      placeAsset: placeAsset, importPaths: importPaths, setLoopMode: setLoopMode, selected: function () { return selIds(); },
      stats: function () { return H.rend && H.rend.player ? H.rend.player.stats : null; },
      audioStats: function () { return H.rend && H.rend.player ? H.rend.player.audioStats : null; },
      render: renderAll, allFaces: allFaces
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
