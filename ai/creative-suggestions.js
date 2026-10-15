// Sugestões criativas prontas por tipo de objeto. Usadas no MODO LOCAL (sem IA) e como complemento: com IA, as sugestões
// vêm do modelo (validadas por ai-schema); aqui ficam os modelos de referência que usam só efeitos da biblioteca nativa.
(function (root) {
  'use strict';
  var S = {
    statue: [
      { title: 'Awakening', description: 'A estátua começa imóvel, os olhos brilham, pequenas rachaduras surgem e partículas de luz escapam.', durationSec: 16, effects: ['ai-glow', 'ai-cracks', 'ai-particles'], sequence: ['Brilho nos olhos', 'Rachaduras luminosas crescem', 'Partículas de luz saem'], complexity: 'média', resources: ['Máscara da estátua (opcional)'] },
      { title: 'Golden Transformation', description: 'Uma luz percorre a escultura e transforma visualmente a superfície em ouro.', durationSec: 14, effects: ['ai-glow', 'ai-gold'], sequence: ['Brilho inicial', 'Faixa de luz varre e deixa ouro'], complexity: 'baixa', resources: ['Máscara da estátua (opcional)'] },
      { title: 'Stone Explosion', description: 'Rachaduras aparecem, uma explosão de luz dispersa fragmentos e a escultura se recompõe.', durationSec: 18, effects: ['ai-cracks', 'ai-burst', 'ai-particles', 'ai-glow'], sequence: ['Rachaduras', 'Explosão de luz', 'Partículas', 'Brilho final'], complexity: 'alta', resources: [] }
    ],
    cubes: [
      { title: 'Neon Circuit', description: 'Linhas neon percorrem as faces e atravessam os cubos.', durationSec: 20, effects: ['ai-neon-lines'], sequence: ['Linhas atravessam cada cubo em cascata'], complexity: 'baixa', resources: [], target: 'each' },
      { title: 'Digital Ocean', description: 'Ondas simuladas passam de uma superfície para outra.', durationSec: 24, effects: ['ai-ocean', 'ai-particles'], sequence: ['Ondas em cascata', 'Partículas de espuma'], complexity: 'média', resources: [], target: 'each' },
      { title: 'Energy Core', description: 'O cubo principal parece conter uma fonte de energia que ilumina os demais.', durationSec: 22, effects: ['ai-energy-core', 'ai-glow', 'ai-pulse'], sequence: ['Núcleo acende', 'Anéis de energia irradiam', 'Pulsos'], complexity: 'média', resources: ['Música (opcional, para pulsos no ritmo)'], target: 'all' }
    ],
    wall: [
      { title: 'Cracking Wall', description: 'Rachaduras luminosas se espalham pela parede e partículas escapam das fendas.', durationSec: 16, effects: ['ai-cracks', 'ai-particles'], sequence: ['Rachaduras crescem', 'Partículas saem'], complexity: 'média', resources: [] },
      { title: 'Digital Rain', description: 'Ondas e linhas neon escorrem pela parede.', durationSec: 20, effects: ['ai-ocean', 'ai-neon-lines'], sequence: ['Ondas descem', 'Linhas neon cruzam'], complexity: 'baixa', resources: [] },
      { title: 'Glitch Pulse', description: 'A parede falha como um sinal digital e pulsa em cores vivas.', durationSec: 12, effects: ['ai-glitch', 'ai-pulse'], sequence: ['Glitch', 'Pulsos'], complexity: 'baixa', resources: [] }
    ],
    building: [
      { title: 'Neon Facade', description: 'Linhas neon desenham a fachada e acendem em sequência.', durationSec: 20, effects: ['ai-neon-lines', 'ai-glow'], sequence: ['Linhas percorrem a fachada', 'Brilho final'], complexity: 'média', resources: [] },
      { title: 'Golden Hour', description: 'Uma onda de luz dourada sobe pelo prédio.', durationSec: 16, effects: ['ai-gold', 'ai-particles'], sequence: ['Ouro varre a fachada', 'Partículas'], complexity: 'baixa', resources: [] },
      { title: 'Energy Awakening', description: 'Um núcleo de energia desperta e irradia pelas janelas.', durationSec: 22, effects: ['ai-energy-core', 'ai-burst'], sequence: ['Núcleo', 'Explosão de luz'], complexity: 'média', resources: [] }
    ],
    object: [
      { title: 'Soft Glow', description: 'Um brilho suave pulsa no objeto e solta partículas de luz.', durationSec: 12, effects: ['ai-glow', 'ai-particles'], sequence: ['Brilho', 'Partículas'], complexity: 'baixa', resources: [] },
      { title: 'Golden Touch', description: 'O objeto vira ouro com uma varredura de luz.', durationSec: 12, effects: ['ai-gold'], sequence: ['Ouro'], complexity: 'baixa', resources: [] },
      { title: 'Burst of Light', description: 'Energia se acumula e explode em luz.', durationSec: 14, effects: ['ai-energy-core', 'ai-burst'], sequence: ['Núcleo', 'Explosão'], complexity: 'média', resources: [] }
    ]
  };
  S.other = S.object;
  function forSubject(subject) { return (S[subject] || S.object).map(function (s, i) { var o = JSON.parse(JSON.stringify(s)); o.id = 'sg' + (i + 1); o.surfaces = []; o.source = 'local'; return o; }); }
  var api = { forSubject: forSubject };
  root.CreativeSuggestions = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
