/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

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
    const Upload = db.unacon_upload;

    expect(Paciente.associations.procedimentos).to.exist;
    expect(Procedimento.associations.paciente).to.exist;
    expect(Procedimento.associations.conciliacoes).to.exist;
    expect(Conciliacao.associations.procedimento).to.exist;
    expect(Upload.associations.usuario).to.exist;
  });

  it('deve ter os campos necessarios definidos em UnaconPaciente para homonimos e busca', () => {
    const Paciente = db.unacon_paciente;
    expect(Paciente.rawAttributes.nome).to.exist;
    expect(Paciente.rawAttributes.nome_normalizado).to.exist;
    expect(Paciente.rawAttributes.data_nascimento).to.exist;
    expect(Paciente.rawAttributes.cpf).to.exist;
    expect(Paciente.rawAttributes.cns).to.exist;
    expect(Paciente.rawAttributes.prontuario).to.exist;
  });

  it('deve ter colunas-chave e enums corretos em UnaconProcedimento', () => {
    const Procedimento = db.unacon_procedimento;
    expect(Procedimento.rawAttributes.tipo).to.exist;
    expect(Procedimento.rawAttributes.tipo.values).to.deep.equal([
      'quimioterapia',
      'cirurgia',
      'consulta',
      'exame_sadt',
      'outro',
    ]);

    expect(Procedimento.rawAttributes.status_lei_60_dias).to.exist;
    expect(Procedimento.rawAttributes.status_lei_60_dias.values).to.deep.equal([
      'dentro_prazo',
      'fora_prazo',
      'nao_aplicavel',
    ]);

    expect(Procedimento.rawAttributes.comparecimento).to.exist;
    expect(Procedimento.rawAttributes.comparecimento.values).to.deep.equal([
      'atendido',
      'ausente',
      'cancelado',
      'desconhecido',
    ]);

    expect(Procedimento.rawAttributes.fonte_origem).to.exist;
    expect(Procedimento.rawAttributes.fonte_origem.values).to.deep.equal([
      'vault_ra',
      'conecta',
      'manual',
    ]);
  });

  it('deve ter colunas-chave e enums corretos em UnaconConciliacao', () => {
    const Conciliacao = db.unacon_conciliacao;
    expect(Conciliacao.rawAttributes.status_conciliacao).to.exist;
    expect(Conciliacao.rawAttributes.status_conciliacao.values).to.deep.equal([
      'conciliado',
      'apenas_oss',
      'apenas_sus',
      'divergencia',
    ]);

    expect(Conciliacao.rawAttributes.tabela_sus).to.exist;
    expect(Conciliacao.rawAttributes.tabela_sus.values).to.deep.equal([
      's_apa',
      's_aih_pa',
      's_prd',
    ]);
  });

  it('deve ter colunas-chave e enums corretos em UnaconUpload', () => {
    const Upload = db.unacon_upload;
    expect(Upload.rawAttributes.tipo_fonte).to.exist;
    expect(Upload.rawAttributes.tipo_fonte.values).to.deep.equal([
      'conecta_consultas',
      'conecta_cirurgias',
      'planilha_geral',
    ]);
  });
});
