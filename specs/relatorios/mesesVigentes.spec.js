const { expect } = require('chai');
const { mesesVigentes } = require('../../src/service/RelatorioCmsService');

describe('mesesVigentes', () => {
  const quad = { inicio: '2026-05-01', fim: '2026-08-01', meses: 4 }; // mai–ago/26

  it('vigência aberta cobre a janela toda', () => {
    expect(mesesVigentes(quad, {})).to.equal(4);
  });

  it('conjunto que termina no meio (vig. até jul) conta só os meses vigentes', () => {
    expect(mesesVigentes(quad, { vigencia_inicio: '2025-08-01', vigencia_fim: '2026-07-31' })).to.equal(3);
  });

  it('conjunto que começa no meio (aditivo em ago) conta 1 mês', () => {
    expect(mesesVigentes(quad, { vigencia_inicio: '2026-08-01', vigencia_fim: null })).to.equal(1);
  });

  it('fora da janela = 0', () => {
    expect(mesesVigentes({ inicio: '2026-10-01', fim: '2026-10-01', meses: 1 }, { vigencia_fim: '2026-07-31' })).to.equal(0);
  });
});
