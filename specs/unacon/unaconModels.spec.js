const { expect } = require('chai');
const db = require('../../src/models');

describe('Modelos Relacionais da UNACON', () => {
  it('deve exportar os modelos da UNACON tanto em snake_case quanto PascalCase', () => {
    expect(db.unacon_paciente).to.exist;
    expect(db.unacon_procedimento).to.exist;
    expect(db.unacon_conciliacao).to.exist;
    expect(db.unacon_upload).to.exist;

    expect(db.UnaconPaciente).to.exist;
    expect(db.UnaconProcedimento).to.exist;
    expect(db.UnaconConciliacao).to.exist;
    expect(db.UnaconUpload).to.exist;
  });

  it('deve ter as associacoes corretas configuradas', () => {
    const Paciente = db.unacon_paciente;
    const Procedimento = db.unacon_procedimento;
    const Conciliacao = db.unacon_conciliacao;

    expect(Paciente.associations.procedimentos).to.exist;
    expect(Procedimento.associations.paciente).to.exist;
    expect(Procedimento.associations.conciliacoes).to.exist;
    expect(Conciliacao.associations.procedimento).to.exist;
  });

  it('deve ter os campos necessarios definidos em UnaconPaciente para homonimos e busca', () => {
    const Paciente = db.unacon_paciente;
    expect(Paciente.rawAttributes.nome).to.exist;
    expect(Paciente.rawAttributes.nome_normalizado).to.exist;
    expect(Paciente.rawAttributes.data_nascimento).to.exist;
    expect(Paciente.rawAttributes.cpf).to.exist;
    expect(Paciente.rawAttributes.prontuario).to.exist;
  });
});
