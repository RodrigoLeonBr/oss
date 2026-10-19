// Traduz um filtro do mapa (fonte + tipo_filtro + valor) para a cláusula SQL
// usada na agregação de produção. Fonte única desta regra — não duplicar em services.

const COMPRIMENTO = { grupo: 2, subgrupo: 4, forma: 6, procedimento: 10 };
const COLUNA = { sia: 'prd_pa', sih: 'PROC_DETALHADO' };
const COLUNA_CBO = { sia: 'prd_cbo', sih: 'CBO_PROFISSIONAL' };

/** Valida CBO: só dígitos, 4 (família) ou 6 (ocupação). Lança Error se inválido. */
function validarCbo(cbo) {
  if (typeof cbo !== 'string' || !/^\d+$/.test(cbo) || (cbo.length !== 4 && cbo.length !== 6)) {
    throw new Error('cbo deve ter 4 (família) ou 6 (ocupação) dígitos numéricos');
  }
  return true;
}

/** Cláusula de CBO (prefixo LIKE). @returns {{ coluna:string, valor:string }} */
function clausulaCbo(fonte, cbo) {
  const coluna = COLUNA_CBO[fonte];
  if (!coluna) throw new Error(`fonte inválida: ${fonte}`);
  validarCbo(cbo);
  return { coluna, valor: `${cbo}%` };
}

/** Valida valor por tipo: só dígitos e comprimento exato. Lança Error se inválido. */
function validarValorFiltro(tipoFiltro, valor) {
  const len = COMPRIMENTO[tipoFiltro];
  if (!len) throw new Error(`tipo_filtro inválido: ${tipoFiltro}`);
  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || valor.length !== len) {
    throw new Error(`valor_filtro para "${tipoFiltro}" deve ter ${len} dígitos numéricos`);
  }
  return true;
}

/**
 * Monta a cláusula de código de procedimento para a agregação.
 * @returns {{ coluna:string, operador:'='|'LIKE', valor:string }}
 *   procedimento → igualdade; grupo/subgrupo/forma → prefixo LIKE 'valor%'.
 */
function clausulaFiltro(fonte, tipoFiltro, valor) {
  const coluna = COLUNA[fonte];
  if (!coluna) throw new Error(`fonte inválida: ${fonte}`);
  validarValorFiltro(tipoFiltro, valor);
  if (tipoFiltro === 'procedimento') return { coluna, operador: '=', valor };
  return { coluna, operador: 'LIKE', valor: `${valor}%` };
}

module.exports = { validarValorFiltro, clausulaFiltro, validarCbo, clausulaCbo, COMPRIMENTO, COLUNA, COLUNA_CBO };

// ── Self-check (node src/helper/filtroProducao.js) ───────────────────────────
if (require.main === module) {
  const assert = require('assert');

  assert.deepStrictEqual(
    clausulaFiltro('sia', 'grupo', '03'),
    { coluna: 'prd_pa', operador: 'LIKE', valor: '03%' },
  );
  assert.deepStrictEqual(
    clausulaFiltro('sih', 'forma', '030101'),
    { coluna: 'PROC_DETALHADO', operador: 'LIKE', valor: '030101%' },
  );
  assert.deepStrictEqual(
    clausulaFiltro('sia', 'procedimento', '0301010010'),
    { coluna: 'prd_pa', operador: '=', valor: '0301010010' },
  );
  assert.throws(() => validarValorFiltro('grupo', '0301'), /2 dígitos/);
  assert.throws(() => validarValorFiltro('procedimento', '03AB010010'), /10 dígitos/);
  assert.throws(() => clausulaFiltro('xpto', 'grupo', '03'), /fonte inválida/);

  assert.deepStrictEqual(clausulaCbo('sia', '223505'), { coluna: 'prd_cbo', valor: '223505%' });
  assert.deepStrictEqual(clausulaCbo('sia', '2235'), { coluna: 'prd_cbo', valor: '2235%' });
  assert.deepStrictEqual(clausulaCbo('sih', '322205'), { coluna: 'CBO_PROFISSIONAL', valor: '322205%' });
  assert.throws(() => validarCbo('22350'), /4 \(família\) ou 6/);
  assert.throws(() => validarCbo('22AB05'), /dígitos/);

  console.log('OK');
}
