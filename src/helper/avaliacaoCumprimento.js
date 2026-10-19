// Fonte única da regra de cumprimento (direção + faixas), em espaço de percentual.
// pct = realizado / base * 100, onde base = meta_mensal (quant) ou meta_valor_qualit (qualit).
// Faixas da meta (meta_minima/meta_parcial) são percentuais 0–100 da base; em branco → padrão.
//
// Conjunto de exibição: 'cumprido' | 'parcial' | 'nao_cumprido' | 'aguardando'.

const num = (v) => (v == null || v === '' || Number.isNaN(parseFloat(v)) ? null : parseFloat(v));

// Defaults de faixa (em % da base) por direção — fonte única, reusada no espaço absoluto também.
const DEFAULT_FAIXAS = {
  maior_igual: { cumprido: 100, parcial: 85 },
  menor_igual: { cumprido: 100, parcial: 115 },
};

/**
 * Resolve as faixas efetivas (em %) a partir da meta + padrões por direção.
 * @param {object} meta objeto meta (ou snapshot com meta_tipo_snap)
 * @returns {{ tipo: 'maior_igual'|'menor_igual', cumprido: number, parcial: number }}
 */
function faixasEfetivas(meta) {
  const m = meta && meta.toJSON ? meta.toJSON() : (meta || {});
  const tipo = m.meta_tipo || m.meta_tipo_snap || 'maior_igual';
  const parcialField = num(m.meta_parcial);
  const minimaField = num(m.meta_minima);
  if (tipo === 'menor_igual') {
    // menor é melhor: teto "cumprido" mais apertado (minima), "parcial" mais folgado (parcial)
    return {
      tipo,
      cumprido: minimaField != null ? minimaField : DEFAULT_FAIXAS.menor_igual.cumprido,
      parcial: parcialField != null ? parcialField : DEFAULT_FAIXAS.menor_igual.parcial,
    };
  }
  // maior é melhor: "cumprido" = meta_parcial (teto atingido), "parcial" = meta_minima (piso)
  return {
    tipo,
    cumprido: parcialField != null ? parcialField : DEFAULT_FAIXAS.maior_igual.cumprido,
    parcial: minimaField != null ? minimaField : DEFAULT_FAIXAS.maior_igual.parcial,
  };
}

/**
 * Classifica um percentual segundo as faixas.
 * @param {number|null} pct
 * @param {{tipo:string, cumprido:number, parcial:number}} faixas
 * @returns {'cumprido'|'parcial'|'nao_cumprido'|'aguardando'}
 */
function nivelCumprimento(pct, faixas) {
  if (pct == null || Number.isNaN(pct)) return 'aguardando';
  if (faixas.tipo === 'menor_igual') {
    if (pct <= faixas.cumprido) return 'cumprido';
    if (pct <= faixas.parcial) return 'parcial';
    return 'nao_cumprido';
  }
  if (pct >= faixas.cumprido) return 'cumprido';
  if (pct >= faixas.parcial) return 'parcial';
  return 'nao_cumprido';
}

/** Atalho: avalia direto a partir de meta + percentual. */
function avaliar(pct, meta) {
  return nivelCumprimento(pct, faixasEfetivas(meta));
}

module.exports = {
  faixasEfetivas, nivelCumprimento, avaliar, DEFAULT_FAIXAS,
};

// ── Self-check (node src/helper/avaliacaoCumprimento.js) ────────────────────────
if (require.main === module) {
  const assert = require('assert');
  const eq = (a, b, m) => assert.strictEqual(a, b, m);

  // Padrão maior-melhor
  eq(avaliar(100, { meta_tipo: 'maior_igual' }), 'cumprido');
  eq(avaliar(90, { meta_tipo: 'maior_igual' }), 'parcial');
  eq(avaliar(84.9, { meta_tipo: 'maior_igual' }), 'nao_cumprido');
  eq(avaliar(null, { meta_tipo: 'maior_igual' }), 'aguardando');

  // Padrão menor-melhor (<=100 cumprido, <=115 parcial)
  eq(avaliar(100, { meta_tipo: 'menor_igual' }), 'cumprido');
  eq(avaliar(80, { meta_tipo: 'menor_igual' }), 'cumprido');
  eq(avaliar(110, { meta_tipo: 'menor_igual' }), 'parcial');
  eq(avaliar(120, { meta_tipo: 'menor_igual' }), 'nao_cumprido');

  // Faixa custom do exemplo: >=80 cumprido, 75–80 parcial, <75 nao (maior-melhor)
  const custom = { meta_tipo: 'maior_igual', meta_parcial: 80, meta_minima: 75 };
  eq(avaliar(82, custom), 'cumprido');
  eq(avaliar(78, custom), 'parcial');
  eq(avaliar(74, custom), 'nao_cumprido');

  // Snapshot usa meta_tipo_snap
  eq(avaliar(100, { meta_tipo_snap: 'maior_igual' }), 'cumprido');

  console.log('avaliacaoCumprimento: OK');
}
