const { META_FATOR_CAP_SUBMIN } = require('../config/metaConstants');

/**
 * @param {object} p
 * @param {number} p.valorRealizado
 * @param {number|null} p.metaVigenteMensal
 * @param {number|null} p.metaMinima
 * @param {number} [p.capSubmin] default META_FATOR_CAP_SUBMIN
 */
function fatorLinhaMaiorIgual(p) {
  const cap = p.capSubmin ?? META_FATOR_CAP_SUBMIN;
  const meta = p.metaVigenteMensal;
  if (meta == null || Number(meta) <= 0) return 0;
  const r = Number(p.valorRealizado) / Number(meta);
  const raw = Math.min(1, r);
  if (p.metaMinima == null) return raw;
  const m = parseFloat(p.metaMinima);
  if (Number(p.valorRealizado) < m) return Math.min(raw, cap);
  return raw;
}

/**
 * @param {Array<{ peso: number, f: number }>} linhas
 */
function cumprimentoGlobalPonderado(linhas) {
  if (!linhas.length) return null;
  let num = 0;
  let den = 0;
  for (const { peso, f } of linhas) {
    const w = parseFloat(peso);
    if (!(w > 0)) continue;
    num += w * f;
    den += w;
  }
  if (den === 0) return null;
  return num / den;
}

module.exports = { fatorLinhaMaiorIgual, cumprimentoGlobalPonderado };
