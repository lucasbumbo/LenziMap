// LenziMap: toca uma sequência dentro de um Renderer. Usado pela prévia (janela de controle) e pela saída.
// O tempo vem sempre do relógio mestre (Sequence.Clock), nunca do requestAnimationFrame de cada janela.
// Vídeo e áudio são escravos desse relógio: a cada quadro o player compara currentTime com o tempo esperado
// e corrige (ajuste fino de velocidade para pequenos desvios, salto para desvios grandes).
(function (root) {
  'use strict';
  var Seq = root.Sequence;
  var HARD = 0.3;   // acima disso (s), pula direto pro tempo certo
  var SOFT = 0.04;  // acima disso (s), ajusta a velocidade de leve

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function SequencePlayer(renderer, opts) {
    this.r = renderer;
    this.opts = opts || {};
    this.seq = null;
    this.ownClock = !renderer.tlClock;
    this.clock = renderer.tlClock || new Seq.Clock();
    this.base = null;
    this.sig = '';
    this.active = false;
    this.audio = {};
    this.pool = {};
    this.sink = '';
    this.stats = { samples: 0, sum: 0, max: 0, seeks: 0, hard: 0, frames: 0, slow: 0 };
    this.audioStats = { samples: 0, sum: 0, max: 0, seeks: 0 };
  }

  SequencePlayer.prototype.update = function (tl) {
    this.active = true;
    this.seq = tl.seq;
    if (this.ownClock && tl.tr) this.clock.apply(tl.tr);
    if (tl.seq && tl.seq.duration && this.ownClock) this.clock.duration = tl.seq.duration;
  };
  SequencePlayer.prototype.transport = function (tr) {
    if (this.ownClock && tr) this.clock.apply(tr);
  };

  SequencePlayer.prototype.release = function () {
    if (!this.active) return;
    this.active = false;
    this.sig = '';
    this.stopAudio();
    for (var k in this.pool) this.drop(k);
    this.pool = {};
  };
  SequencePlayer.prototype.stopAudio = function () {
    for (var id in this.audio) { try { this.audio[id].pause(); this.audio[id].removeAttribute('src'); } catch (e) {} }
    this.audio = {};
  };

  function itemOf(self, e, s) {
    var a = e.asset, c = e.clip, ev = e.ev;
    var it = {
      id: 'c' + c.id, tl: 1, type: a.kind === 'fx' ? 'fx' : (a.kind === 'text' ? 'text' : 'media'),
      kind: a.kind === 'video' ? 'video' : (a.kind === 'cam' ? 'cam' : 'img'),
      src: a.src || null, fx: a.fx || null, text: a.text || null, name: c.name || a.name,
      visible: true, opacity: ev.opacity, fit: c.fit, cover: false, speed: clamp(ev.speed * self.clock.rate, 0.0625, 16)
    };
    var x = Seq.xformOf(s.w, s.h, ev.p, root.MapMath.solveH);
    it.xf = x.xf; it.quad = x.quad; it.crop = Seq.cropOf(ev.crop);
    it.cropR = ev.crop;
    it.blend = ev.blend;
    return it;
  }

  // Devolve uma cópia do estado onde as superfícies ligadas a faixas recebem os clipes ativos como itens.
  SequencePlayer.prototype.compose = function (state) {
    var seq = this.seq, self = this;
    var T = this.clock.now();
    var ev = Seq.evaluate(seq, T);
    var bound = {};
    seq.tracks.forEach(function (t) { if (t.type === 'video' && t.surfaceId) bound[t.surfaceId] = 1; });
    var out = {};
    for (var k in state) out[k] = state[k];
    out.surfaces = state.surfaces.map(function (s) {
      if (!s.key || !bound[s.key]) return s;
      var c = {};
      for (var p in s) c[p] = s[p];
      var list = ev.video[s.key] || [];
      if (list.length) c.extras = list.map(function (e) { return itemOf(self, e, s); });
      else c.extras = seq.settings && seq.settings.showGridIdle ? (s.extras || []).filter(function (x) { return x.placeholder; }) : [];
      return c;
    });
    return out;
  };

  SequencePlayer.prototype.signature = function (ev) {
    var parts = [];
    for (var key in ev.video) parts.push(key + ':' + ev.video[key].map(function (e) { return e.clip.id; }).join('+'));
    return parts.sort().join('|');
  };

  // Mantém um <video> ou <audio> no tempo esperado. Devolve o desvio medido (s).
  function followMedia(el, want, rate, run, st, hooks) {
    el.__want = want;
    if (!el.__tlHook) {
      el.__tlHook = true;
      el.addEventListener('loadedmetadata', function () { try { if (el.__want != null) el.currentTime = el.__want; } catch (e) {} });
    }
    if (el.readyState < 1) return null;
    var dur = isFinite(el.duration) ? el.duration : Infinity;
    if (run && want >= dur - 0.02) { if (!el.paused) el.pause(); return null; } // mídia mais curta que o clipe: não reinicia
    want = clamp(want, 0, Math.max(0, dur - 0.001));
    if (!run) {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - want) > 0.008) { try { el.currentTime = want; st.seeks++; } catch (e) {} }
      return 0;
    }
    if (el.seeking) return null;
    var diff = el.currentTime - want, ad = Math.abs(diff);
    if (ad > HARD) {
      try { el.currentTime = want; st.seeks++; if (hooks) hooks.hard++; } catch (e) {}
      if (el.playbackRate !== rate) el.playbackRate = rate;
    } else if (ad > SOFT) {
      el.playbackRate = clamp(rate * (1 - clamp(diff * 0.8, -0.15, 0.15)), 0.0625, 16);
    } else if (el.playbackRate !== rate) el.playbackRate = rate;
    if (el.paused) { var pp = el.play(); if (pp && pp.catch) pp.catch(function () {}); }
    return ad;
  }

  SequencePlayer.prototype.frame = function () {
    if (!this.active || !this.seq) return;
    var T = this.clock.now(), ev = Seq.evaluate(this.seq, T), self = this;
    var sig = this.signature(ev);
    if (sig !== this.sig) { this.sig = sig; if (this.base) this.r.sync(this.base); }
    var playing = this.clock.playing && !this.clock.ended, st = this.stats, rate = this.clock.rate;
    st.frames++;
    var recs = this.r.recs;
    for (var id in recs) {
      var rec = recs[id], s = rec.s;
      if (!s || !s.key) continue;
      var list = ev.video[s.key];
      if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var e = list[i], ext = rec.ex['c' + e.clip.id];
        if (!ext) continue;
        var x = Seq.xformOf(s.w, s.h, e.ev.p, root.MapMath.solveH);
        var crop = Seq.cropOf(e.ev.crop);
        ext.tms = e.ev.tms;
        if (ext.x && ext.x.type === 'fx' && ext.x.fx) { if (!ext.x._own) { ext.x.fx = Object.assign({}, ext.x.fx); ext.x._own = 1; } ext.x.fx.p1 = e.ev.p1; ext.x.fx.p2 = e.ev.p2; ext.x.fx.ill = e.ev.ill; }
        ext.x.opacity = e.ev.opacity; ext.x.quad = x.quad; ext.x.cropR = e.ev.crop;
        var el = ext.el;
        if (!rec.meshOn || true) {
          el.style.transformOrigin = '0 0';
          if (el.__xf !== x.xf) { el.style.transform = x.xf; el.__xf = x.xf; }
          if (el.__crop !== crop) { el.style.clipPath = crop; el.__crop = crop; }
          var fxr = root.EffectsDom ? root.EffectsDom.apply(el, e.ev, e.clip.id, self.fxOpts) : null;
          el.style.opacity = fxr ? e.ev.opacity * fxr.opacity : e.ev.opacity;
          ext.x.fxFilter = fxr ? fxr.filter : ''; ext.x.fxOpacity = fxr ? fxr.opacity : 1; ext.x.blend = e.ev.blend;
        }
        if (e.asset.kind === 'video' && el.tagName === 'VIDEO') {
          el.loop = false; el.muted = true;
          var d = followMedia(el, e.ev.srcTime, clamp(e.ev.speed * rate, 0.0625, 16), playing && !e.ev.ended, st, st);
          if (d != null && playing) { st.samples++; st.sum += d; if (d > st.max) st.max = d; }
        }
      }
    }
    if (this.opts.audio) this.audioFrame(ev, playing);
    this.preload(T);
  };

  SequencePlayer.prototype.audioFrame = function (ev, playing) {
    var want = {}, self = this, st = this.audioStats, off = ((this.seq.settings && this.seq.settings.audioOffset) || 0) / 1000;
    ev.audio.forEach(function (a) {
      var id = a.clip.id;
      want[id] = 1;
      var el = self.audio[id];
      if (!el) {
        el = new Audio();
        el.preload = 'auto';
        el.src = a.asset.src;
        el.loop = false;
        try { el.preservesPitch = true; } catch (e) {}
        if (self.sink && el.setSinkId) el.setSinkId(self.sink).catch(function () {});
        self.audio[id] = el;
      }
      el.volume = clamp(a.ev.gain * (self.masterGain == null ? 1 : self.masterGain), 0, 1);
      var rate = clamp(a.ev.speed * self.clock.rate, 0.0625, 16);
      var d = followMedia(el, a.ev.srcTime + off * a.ev.speed, rate, playing && !a.ev.ended, st, null);
      if (d != null && playing) { st.samples++; st.sum += d; if (d > st.max) st.max = d; }
    });
    for (var id in this.audio) {
      if (want[id]) continue;
      try { this.audio[id].pause(); this.audio[id].removeAttribute('src'); } catch (e) {}
      delete this.audio[id];
    }
  };
  SequencePlayer.prototype.setSink = function (deviceId) {
    this.sink = deviceId || '';
    for (var id in this.audio) { var el = this.audio[id]; if (el.setSinkId) el.setSinkId(this.sink).catch(function () {}); }
  };

  // Reserva de vídeos prontos: clipes que vão começar logo (pré-carga) e clipes que acabaram de sair da tela.
  // Quando o clipe entra, o Renderer pega o elemento daqui em vez de carregar de novo (evita o engasgo do primeiro quadro).
  SequencePlayer.prototype.take = function (cid) {
    var p = this.pool[cid];
    if (!p) return null;
    delete this.pool[cid];
    return p.el;
  };
  SequencePlayer.prototype.stash = function (cid, el) {
    try { el.pause(); } catch (e) {}
    if (this.pool[cid] && this.pool[cid].el !== el) this.drop(cid);
    this.pool[cid] = { el: el, t: Date.now() };
    this.trim(null);
  };
  SequencePlayer.prototype.drop = function (cid) {
    var p = this.pool[cid];
    if (!p) return;
    try { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } catch (e) {}
    delete this.pool[cid];
  };
  SequencePlayer.prototype.trim = function (keep) {
    var ids = Object.keys(this.pool);
    if (ids.length <= 24) return;
    ids.sort(function (a, b) { return this.pool[a].t - this.pool[b].t; }.bind(this));
    for (var i = 0; i < ids.length - 24; i++) { if (keep && keep[ids[i]]) continue; this.drop(ids[i]); }
  };
  // Pré-carrega vídeos que começam nos próximos 3 s e já deixa no ponto de entrada.
  SequencePlayer.prototype.preload = function (T) {
    var seq = this.seq, self = this, keep = {};
    seq.tracks.forEach(function (t) {
      if (t.type !== 'video' || !t.enabled) return;
      t.clips.forEach(function (c) {
        if (c.start <= T || c.start > T + 3) return;
        var a = Seq.asset(seq, c.assetId);
        if (!a || a.kind !== 'video' || !a.src) return;
        keep[c.id] = 1;
        if (!self.pool[c.id]) {
          var v = document.createElement('video');
          v.preload = 'auto'; v.muted = true; v.src = a.src;
          v.addEventListener('loadedmetadata', function () { try { v.currentTime = c.inPoint; } catch (e) {} });
          self.pool[c.id] = { el: v, t: Date.now() };
        }
      });
    });
    this.trim(keep);
  };

  root.SequencePlayer = SequencePlayer;
})(typeof window !== 'undefined' ? window : globalThis);
