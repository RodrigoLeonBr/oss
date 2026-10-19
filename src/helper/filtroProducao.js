// Traduz um filtro do mapa (fonte + tipo_filtro + valor) para a cláusula SQL
// usada na agregação de produção. Fonte única desta regra — não duplicar em services.

const COMPRIMENTO = { grupo: 2, subgrupo: 4, forma: 6, procedimento: 10 };
const COLUNA = { sia: 'prd_pa', sih: 'PROC_DETALHADO' };

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

module.exports = { validarValorFiltro, clausulaFiltro, COMPRIMENTO, COLUNA };

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

  console.log('OK');
}
