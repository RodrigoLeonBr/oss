/**
 * Valor de referência da meta para aplicar % de mínimo/parcial:
 * produção → meta_mensal; qualidade → meta_valor_qualit
 */
function baseMetaReferencia(meta) {
  if (!meta) return null;
  const m = meta.toJSON ? meta.toJSON() : meta;
  if (m.meta_mensal != null && m.meta_mensal !== '') return parseFloat(m.meta_mensal);
  if (m.meta_valor_qualit != null && m.meta_valor_qualit !== '') return parseFloat(m.meta_valor_qualit);
  return null;
}

/** Converte percentual 0–100 (armazenado em tb_metas) em limite na mesma unidade do valor de referência */
function absFromPercentualBase(base, pct) {
  if (base == null || pct == null || pct === '') return null;
  const p = parseFloat(pct);
  if (Number.isNaN(p)) return null;
  return (p / 100) * parseFloat(base);
}

module.exports = { baseMetaReferencia, absFromPercentualBase };
