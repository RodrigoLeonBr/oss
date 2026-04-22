// specs/metas/meta-tipo.spec.js
'use strict';
const { expect } = require('chai');
const { criarMeta, atualizarMeta } = require('../../src/validator/MetaValidator');

describe('MetaValidator — metaTipo', () => {
  it('default maior_igual quando metaTipo ausente em criarMeta', () => {
    const { error, value } = criarMeta.validate({
      indicadorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      vigenciaInicio: '2026-01-01',
      metaMensal: 1000,
    });
    expect(error).to.be.undefined;
    expect(value.metaTipo).to.equal('maior_igual');
  });

  it('aceita menor_igual em criarMeta', () => {
    const { error, value } = criarMeta.validate({
      indicadorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      vigenciaInicio: '2026-01-01',
      metaMensal: 1000,
      metaTipo: 'menor_igual',
    });
    expect(error).to.be.undefined;
    expect(value.metaTipo).to.equal('menor_igual');
  });

  it('rejeita valor inválido em criarMeta', () => {
    const { error } = criarMeta.validate({
      indicadorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      vigenciaInicio: '2026-01-01',
      metaMensal: 1000,
      metaTipo: 'invalido',
    });
    expect(error).to.not.be.undefined;
  });

  it('metaTipo é opcional em atualizarMeta', () => {
    const { error } = atualizarMeta.validate({ metaMensal: 1200 });
    expect(error).to.be.undefined;
  });

  it('aceita metaTipo em atualizarMeta', () => {
    const { error, value } = atualizarMeta.validate({ metaTipo: 'menor_igual' });
    expect(error).to.be.undefined;
    expect(value.metaTipo).to.equal('menor_igual');
  });
});
