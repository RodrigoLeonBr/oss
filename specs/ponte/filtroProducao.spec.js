const { expect } = require('chai');
const { clausulaFiltro, validarValorFiltro } = require('../../src/helper/filtroProducao');

describe('filtroProducao', () => {
  it('grupo vira LIKE prefixo', () => {
    expect(clausulaFiltro('sia', 'grupo', '03'))
      .to.deep.equal({ coluna: 'prd_pa', operador: 'LIKE', valor: '03%' });
  });
  it('procedimento vira igualdade', () => {
    expect(clausulaFiltro('sia', 'procedimento', '0301010010'))
      .to.deep.equal({ coluna: 'prd_pa', operador: '=', valor: '0301010010' });
  });
  it('SIH usa coluna PROC_DETALHADO', () => {
    expect(clausulaFiltro('sih', 'subgrupo', '0301').coluna).to.equal('PROC_DETALHADO');
  });
  it('rejeita comprimento errado', () => {
    expect(() => validarValorFiltro('grupo', '0301')).to.throw(/2 dígitos/);
  });
});
