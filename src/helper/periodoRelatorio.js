// Janelas de período para o Relatório CMS.
// Janela MÓVEL: trimestre/quadrimestre são os N meses que terminam no mês de referência.
// Acumulado = Jan..mês ref (year-to-date). Ano = Jan..Dez (não proporcional).

const PERIODOS = ['mes', 'acumulado', 'trimestre', 'quadrimestre', 'ano'];

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m) => `${y}-${pad2(m)}-01`; // m: índice absoluto 1..12 já normalizado

/** Converte (ano, mesAbsoluto) onde mesAbsoluto pode ser <1 ou >12 para {y, m} civil. */
function normaliza(y, m) {
  const idx = (y * 12) + (m - 1); // índice global 0-based
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/**
 * @param {string} mesRefYmd 'YYYY-MM-01' ou 'YYYY-MM'
 * @param {'mes'|'acumulado'|'trimestre'|'quadrimestre'|'ano'} periodo
 * @returns {{ inicio: string, fim: string, meses: number, anual: boolean }}
 */
function janelaDoPeriodo(mesRefYmd, periodo) {
  const s = String(mesRefYmd || '').trim();
  const mt = s.match(/^(\d{4})-(\d{2})/);
  if (!mt) throw new Error(`mês de referência inválido: ${mesRefYmd}`);
  if (!PERIODOS.includes(periodo)) throw new Error(`período inválido: ${periodo}`);

  const y = parseInt(mt[1], 10);
  const m = parseInt(mt[2], 10);
  const fim = ymd(y, m);

  switch (periodo) {
    case 'mes':
      return { inicio: fim, fim, meses: 1, anual: false };
    case 'acumulado':
      return { inicio: ymd(y, 1), fim, meses: m, anual: false };
    case 'trimestre': {
      const i = normaliza(y, m - 2);
      return { inicio: ymd(i.y, i.m), fim, meses: 3, anual: false };
    }
    case 'quadrimestre': {
      const i = normaliza(y, m - 3);
      return { inicio: ymd(i.y, i.m), fim, meses: 4, anual: false };
    }
    case 'ano':
      return { inicio: ymd(y, 1), fim: ymd(y, 12), meses: 12, anual: true };
    default:
      throw new Error(`período inválido: ${periodo}`);
  }
}

/**
 * Janela dos últimos `n` meses terminando em `mesRefYmd` (inclusive).
 * Ex.: ('2026-08-01', 8) → { inicio:'2026-01-01', fim:'2026-08-01', meses:8 }
 */
function janelaUltimosMeses(mesRefYmd, n) {
  const s = String(mesRefYmd || '').trim();
  const mt = s.match(/^(\d{4})-(\d{2})/);
  if (!mt) throw new Error(`mês de referência inválido: ${mesRefYmd}`);
  const qtd = Math.max(1, parseInt(n, 10) || 1);
  const y = parseInt(mt[1], 10);
  const m = parseInt(mt[2], 10);
  const i = normaliza(y, m - (qtd - 1));
  return { inicio: ymd(i.y, i.m), fim: ymd(y, m), meses: qtd };
}

module.exports = { janelaDoPeriodo, janelaUltimosMeses, PERIODOS };

// ── Self-check (node src/helper/periodoRelatorio.js) ────────────────────────────
if (require.main === module) {
  const assert = require('assert');
  const eq = (a, b, msg) => assert.deepStrictEqual(a, b, msg);

  eq(janelaDoPeriodo('2026-08-01', 'mes'), { inicio: '2026-08-01', fim: '2026-08-01', meses: 1, anual: false });
  eq(janelaDoPeriodo('2026-08', 'acumulado'), { inicio: '2026-01-01', fim: '2026-08-01', meses: 8, anual: false });
  eq(janelaDoPeriodo('2026-08-01', 'trimestre'), { inicio: '2026-06-01', fim: '2026-08-01', meses: 3, anual: false });
  eq(janelaDoPeriodo('2026-08-01', 'quadrimestre'), { inicio: '2026-05-01', fim: '2026-08-01', meses: 4, anual: false });
  eq(janelaDoPeriodo('2026-08-01', 'ano'), { inicio: '2026-01-01', fim: '2026-12-01', meses: 12, anual: true });
  // virada de ano: Fev → trimestre = Dez(ano-1), Jan, Fev
  eq(janelaDoPeriodo('2026-02-01', 'trimestre'), { inicio: '2025-12-01', fim: '2026-02-01', meses: 3, anual: false });
  eq(janelaDoPeriodo('2026-01-01', 'quadrimestre'), { inicio: '2025-10-01', fim: '2026-01-01', meses: 4, anual: false });

  assert.throws(() => janelaDoPeriodo('abc', 'mes'));
  assert.throws(() => janelaDoPeriodo('2026-08-01', 'bimestre'));

  eq(janelaUltimosMeses('2026-08-01', 8), { inicio: '2026-01-01', fim: '2026-08-01', meses: 8 });
  eq(janelaUltimosMeses('2026-02-01', 3), { inicio: '2025-12-01', fim: '2026-02-01', meses: 3 });
  eq(janelaUltimosMeses('2026-05-01', 1), { inicio: '2026-05-01', fim: '2026-05-01', meses: 1 });

  console.log('periodoRelatorio: OK');
}
