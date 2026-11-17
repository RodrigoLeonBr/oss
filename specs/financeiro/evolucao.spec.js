'use strict';
const { expect } = require('chai');
const { kpis, serieAgregada, avisosGrade } = require('../../src/service/FinanceiroService');
const { janelaCivil } = require('../../src/helper/periodoRelatorio');

// fato mínimo (centavos), como FinanceiroService.fatos devolve
const f = (mes, conta, o = {}) => ({
  unidade_id: 'u1', sigla: 'U', conta, mes, repasse: 0, rendimento: 0, outrasReceitas: 0, despesa: 0,
  grupos: {}, transferencia: 0, proprios: 0, arredondamento: 0, saldo: null, ...o,
});

describe('financeiro: evolução das contas', () => {
  const lista = [
    f('2026-04-01', 'custeio', { saldo: 100000 }),
    f('2026-05-01', 'custeio', { repasse: 500000, despesa: 450000, grupos: { 'plano:01|RH': 450000 }, transferencia: -20000, saldo: 130000 }),
    f('2026-06-01', 'custeio', { repasse: 500000, despesa: 520000, grupos: { 'plano:01|RH': 520000 }, rendimento: 1000, saldo: 111000 }),
    f('2026-04-01', 'provisao', { saldo: 0 }),
    f('2026-05-01', 'provisao', { transferencia: 20000, saldo: 20000 }),
    f('2026-06-01', 'provisao', { saldo: 20000 }),
  ];

  it('fluxo do período fecha: inicial + entradas − despesas ± transferências = final', () => {
    const k = kpis(lista, '2026-05-01', '2026-06-01');
    expect(k.saldoInicial).to.equal(1000);
    expect(k.saldoFinal).to.equal(1310);
    expect(k.transferencias).to.equal(0); // custeio → provisão se anula no total
    expect(k.diferencaFluxo).to.equal(0);
  });

  it('acusa diferença quando falta lançamento', () => {
    const semRend = lista.map((x) => (x.mes === '2026-06-01' && x.conta === 'custeio' ? { ...x, rendimento: 0 } : x));
    expect(kpis(semRend, '2026-05-01', '2026-06-01').diferencaFluxo).to.equal(-10);
  });

  it('série por quadrimestre usa o último saldo do bucket', () => {
    const s = serieAgregada(lista.filter((x) => x.mes >= '2026-05-01'), 'quad');
    expect(s).to.have.length(1);
    expect(s[0].periodo).to.equal('2026-Q2');
    expect(s[0].saldo).to.equal(1310);
  });

  it('período anterior tem a mesma duração', () => {
    expect(janelaCivil({ tipo: 'quadrimestral', ano: 2026, n: 1 }).anterior)
      .to.deep.equal({ inicio: '2025-09-01', fim: '2025-12-01' });
  });

  it('grade avisa saldo que não reconcilia, sem bloquear', () => {
    expect(avisosGrade({ saldoAnterior: 100, receitas: 50, despesas: 30, movimentos: 0, saldo: 120 })).to.deep.equal([]);
    expect(avisosGrade({ saldoAnterior: 100, receitas: 50, despesas: 30, movimentos: 0, saldo: 130 })[0]).to.match(/diferença 10/);
  });
});
