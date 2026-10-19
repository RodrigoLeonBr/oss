const { expect } = require('chai');
const { montarComparacao } = require('../../src/service/PonteProducaoService');

describe('montarComparacao', () => {
  const indicadores = [
    { indicador_id: 'A', nome: 'Consultas', unidade_medida: 'atend' },
    { indicador_id: 'B', nome: 'Exames', unidade_medida: 'exames' },
  ];
  const informadoPorIndicador = { A: 100 }; // B sem acompanhamento
  const produzidoPorIndicador = { A: 90 };
  const temMapa = { A: true };

  it('calcula diferença e divergência quando ambos existem', () => {
    const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
    const a = linhas.find((l) => l.indicadorId === 'A');
    expect(a.informado).to.equal(100);
    expect(a.registrado).to.equal(90);
    expect(a.diferenca).to.equal(10);
    expect(a.divergenciaPerc).to.be.closeTo(11.11, 0.01);
    expect(a.semMapeamento).to.equal(false);
  });

  it('marca semMapeamento e registrado null quando indicador sem mapa', () => {
    const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
    const b = linhas.find((l) => l.indicadorId === 'B');
    expect(b.semMapeamento).to.equal(true);
    expect(b.registrado).to.equal(null);
    expect(b.informado).to.equal(null);
    expect(b.diferenca).to.equal(null);
  });
});
