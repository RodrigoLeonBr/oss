// specs/acompanhamentos/status-cumprimento.spec.js
'use strict';
const { expect } = require('chai');
const { calcularStatus } = require('../../src/service/AcompanhamentosService');

describe('calcularStatus', () => {
  describe('maior_igual', () => {
    it('atingido quando >= metaParcial', () => {
      expect(calcularStatus('maior_igual', 1200, 1020, 840)).to.equal('atingido');
      expect(calcularStatus('maior_igual', 1020, 1020, 840)).to.equal('atingido');
    });
    it('parcial quando >= metaMinima e < metaParcial', () => {
      expect(calcularStatus('maior_igual', 900, 1020, 840)).to.equal('parcial');
      expect(calcularStatus('maior_igual', 840, 1020, 840)).to.equal('parcial');
    });
    it('nao_atingido quando < metaMinima', () => {
      expect(calcularStatus('maior_igual', 839, 1020, 840)).to.equal('nao_atingido');
    });
  });

  describe('menor_igual', () => {
    it('atingido quando <= metaMinima', () => {
      expect(calcularStatus('menor_igual', 3, 8, 5)).to.equal('atingido');
      expect(calcularStatus('menor_igual', 5, 8, 5)).to.equal('atingido');
    });
    it('parcial quando > metaMinima e <= metaParcial', () => {
      expect(calcularStatus('menor_igual', 7, 8, 5)).to.equal('parcial');
      expect(calcularStatus('menor_igual', 8, 8, 5)).to.equal('parcial');
    });
    it('nao_atingido quando > metaParcial', () => {
      expect(calcularStatus('menor_igual', 9, 8, 5)).to.equal('nao_atingido');
    });
  });

  it('pendente quando valorRealizado é null', () => {
    expect(calcularStatus('maior_igual', null, 100, 70)).to.equal('pendente');
  });

  it('pendente quando thresholds são null', () => {
    expect(calcularStatus('maior_igual', 100, null, null)).to.equal('pendente');
    expect(calcularStatus('menor_igual', 5, null, null)).to.equal('pendente');
  });
});
