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

// Períodos CIVIS fixos (relatórios da comissão/financeiro): 2º quadrimestre = mai–ago, 3º trimestre = jul–set.
const TIPOS_CIVIS = { trimestral: [3, 'trimestre'], quadrimestral: [4, 'quadrimestre'], anual: [12, 'ano'] };
const ORDINAL = (n) => `${n}º`;

/** Nº de meses entre dois 'YYYY-MM-01' (inclusive). */
function mesesEntre(ini, fim) {
  const [y1, m1] = ini.split('-').map(Number);
  const [y2, m2] = fim.split('-').map(Number);
  return (y2 * 12 + m2) - (y1 * 12 + m1) + 1;
}

/**
 * Janela civil + janela anterior de mesmo tamanho (para "comparativo com período anterior").
 * @param {{tipo:'trimestral'|'quadrimestral'|'anual'|'livre', ano?:number, n?:number, ini?:string, fim?:string}} p
 * @returns {{ inicio, fim, meses, rotulo, anterior:{inicio, fim} }}
 */
function janelaCivil({ tipo, ano, n = 1, ini, fim }) {
  let inicio;
  let fimJ;
  let rotulo;
  if (tipo === 'livre') {
    const a = String(ini || '').match(/^(\d{4})-(\d{2})/);
    const b = String(fim || '').match(/^(\d{4})-(\d{2})/);
    if (!a || !b) throw new Error('período livre exige ini e fim (YYYY-MM)');
    inicio = `${a[1]}-${a[2]}-01`;
    fimJ = `${b[1]}-${b[2]}-01`;
    if (fimJ < inicio) throw new Error('fim antes do início');
    rotulo = `${a[2]}/${a[1]} a ${b[2]}/${b[1]}`;
  } else {
    const def = TIPOS_CIVIS[tipo];
    if (!def) throw new Error(`tipo de período inválido: ${tipo}`);
    const [tam] = def;
    const qtd = 12 / tam;
    const k = tipo === 'anual' ? 1 : Number(n);
    if (!Number.isInteger(k) || k < 1 || k > qtd) throw new Error(`${tipo}: n deve ser 1..${qtd}`);
    const y = Number(ano);
    if (!Number.isInteger(y)) throw new Error('ano inválido');
    inicio = ymd(y, (k - 1) * tam + 1);
    fimJ = ymd(y, k * tam);
    rotulo = tipo === 'anual' ? `Exercício ${y}` : `${ORDINAL(k)} ${def[1]} de ${y}`;
  }
  const meses = mesesEntre(inicio, fimJ);
  const [yi, mi] = inicio.split('-').map(Number);
  const a1 = normaliza(yi, mi - meses);
  const a2 = normaliza(yi, mi - 1);
  return { inicio, fim: fimJ, meses, rotulo, anterior: { inicio: ymd(a1.y, a1.m), fim: ymd(a2.y, a2.m) } };
}

module.exports = { janelaDoPeriodo, janelaUltimosMeses, janelaCivil, mesesEntre, PERIODOS };

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

  eq(janelaCivil({ tipo: 'quadrimestral', ano: 2026, n: 2 }), {
    inicio: '2026-05-01', fim: '2026-08-01', meses: 4, rotulo: '2º quadrimestre de 2026',
    anterior: { inicio: '2026-01-01', fim: '2026-04-01' } });
  eq(janelaCivil({ tipo: 'trimestral', ano: 2026, n: 1 }).anterior, { inicio: '2025-10-01', fim: '2025-12-01' });
  eq(janelaCivil({ tipo: 'anual', ano: 2025 }).fim, '2025-12-01');
  eq(janelaCivil({ tipo: 'anual', ano: 2025 }).anterior, { inicio: '2024-01-01', fim: '2024-12-01' });
  eq(janelaCivil({ tipo: 'livre', ini: '2025-11', fim: '2026-02' }).meses, 4);
  eq(janelaCivil({ tipo: 'livre', ini: '2025-11', fim: '2026-02' }).anterior, { inicio: '2025-07-01', fim: '2025-10-01' });
  assert.throws(() => janelaCivil({ tipo: 'quadrimestral', ano: 2026, n: 4 }));
  assert.throws(() => janelaCivil({ tipo: 'livre', ini: '2026-03', fim: '2026-01' }));
  eq(mesesEntre('2022-01-01', '2026-08-01'), 56);

  console.log('periodoRelatorio: OK');
}
