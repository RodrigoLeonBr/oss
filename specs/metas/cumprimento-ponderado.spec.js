'use strict';
const { expect } = require('chai');
const {
  fatorLinhaMaiorIgual,
  cumprimentoGlobalPonderado,
} = require('../../src/helper/metaCumprimentoPonderado');

describe('metaCumprimentoPonderado', () => {
  it('fatorLinha: maior_igual, sem meta_minima → f = min(1, r)', () => {
    expect(fatorLinhaMaiorIgual({ valorRealizado: 50, metaVigenteMensal: 100, metaMinima: null, capSubmin: 0.5 }))
      .to.equal(0.5);
    expect(fatorLinhaMaiorIgual({ valorRealizado: 120, metaVigenteMensal: 100, metaMinima: null, capSubmin: 0.5 }))
      .to.equal(1);
  });

  it('fatorLinha: abaixo de meta_minima aplica cap', () => {
    expect(fatorLinhaMaiorIgual({ valorRealizado: 80, metaVigenteMensal: 100, metaMinima: 90, capSubmin: 0.5 }))
      .to.equal(0.5);
  });

  it('F global = média ponderada', () => {
    const F = cumprimentoGlobalPonderado([
      { peso: 1, f: 1 },
      { peso: 3, f: 0.5 },
    ]);
    expect(F).to.be.closeTo((1 * 1 + 3 * 0.5) / 4, 0.0001);
  });
});
