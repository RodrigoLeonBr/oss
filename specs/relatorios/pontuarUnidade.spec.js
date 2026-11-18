const { expect } = require('chai');
const { pontuarUnidade } = require('../../src/service/RelatorioCmsService');

const tol80 = { meta_tipo: 'maior_igual', meta_minima: 80, meta_parcial: 80 };
const q = (codigo, percentual, peso, meta = { meta_tipo: 'maior_igual' }) => ({
  codigo, indicadorId: codigo, percentual, pesoIndicador: peso, meta,
});

describe('pontuarUnidade (fixa_variavel proporcional — PA Zanaga)', () => {
  const regra = {
    modelo: 'fixa_variavel', pontuacao: 'proporcional', escala: [{ min: 95, perc: 100 }, { min: 90, perc: 90 }], abaixo: 0,
  };
  const quant = [
    { codigo: 'CR', indicadorId: 'CR', blocoId: 'B1', blocoNome: 'Classificação', percentual: 97.6, realizadoAcum: 6589, metaPeriodo: 6750, meta: tol80 },
    { codigo: 'RX', indicadorId: 'RX', blocoId: 'B2', blocoNome: 'SADT', percentual: 50, realizadoAcum: 500, metaPeriodo: 1000, meta: tol80 },
    { codigo: 'LAB', indicadorId: 'LAB', blocoId: 'B2', blocoNome: 'SADT', percentual: 70, realizadoAcum: 2100, metaPeriodo: 3000, meta: tol80 },
  ];
  const qual = [q('SAT', 95.5, 15), q('CCIH', null, 6), q('TRF', 85, 10, { meta_tipo: 'menor_igual' })];
  const r = pontuarUnidade(quant, qual, regra, (id) => ({ B1: 50, B2: 50 }[id]));

  it('quant ≥ limiar (80%) vale 100% considerado', () => {
    expect(quant[0].consideradoPerc).to.equal(100);
    expect(quant[0].limiar).to.deep.equal({ tipo: 'maior_igual', valor: 80 });
  });

  it('bloco SADT soma RX + Lab (2600/4000 = 65% → 65/80 = 81,25% considerado)', () => {
    const sadt = r.blocos.find((b) => b.blocoId === 'B2');
    expect(sadt.alcance).to.equal(65);
    expect(sadt.consideradoPerc).to.equal(81.25);
    expect(sadt.pontos).to.equal(40.63);
    expect(r.quant.pontos).to.equal(90.63);
  });

  it('qualitativo proporcional, sem lançamento conta 0, menor_igual cumprido = 100', () => {
    expect(qual[0].pontos).to.equal(14.33);
    expect(qual[1].pontos).to.equal(0);
    expect(qual[2].consideradoPerc).to.equal(100);
    expect(r.qual.peso).to.equal(31);
    expect(r.qual.pendentes).to.equal(1);
    expect(r.qual.nota).to.equal(78.48);
    expect(r.qual.percEscala).to.equal(0);
  });
});
