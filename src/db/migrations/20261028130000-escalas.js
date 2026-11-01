'use strict';

// Escalas de profissionais extraídas das prestações de contas (PDF -> .md -> .escala.json).
// Carga: src/scripts/carregaEscalas.js. Consultas: docs/escalas-consultas.sql.
// tb_escala_plantoes = 1 profissional x 1 turno; profissional_id NULL = posto vazio.

const CONSELHOS = ['CRM', 'COREN', 'CRO', 'CRTR', 'CRF', 'CRESS', 'CREFITO', 'CRN', 'CRP', 'MATRICULA', 'SEM_REGISTRO'];
const MODALIDADES = ['plantao', 'sobreaviso', 'diarista', 'visita', 'porta', 'fixo', 'rotina'];
// riscado = nome tachado no PDF (retirado da escala; não conta como realizado)
const MARCACOES = ['normal', 'riscado', 'cobertura', 'furo', 'falta_justificada', 'falta_nao_justificada', 'ferias', 'folga',
  'atestado', 'licenca', 'troca', 'extra'];

// Plantão efetivamente prestado: tem profissional e não foi riscado/faltado/afastado.
const VIEW_REALIZADOS = `
CREATE OR REPLACE VIEW vw_escala_realizados AS
SELECT p.*, u.sigla AS unidade, s.nome AS setor, pr.nome AS profissional, pr.conselho, pr.registro_numero, pr.categoria
FROM tb_escala_plantoes p
JOIN tb_unidades u ON u.unidade_id = p.unidade_id
LEFT JOIN tb_escala_setores s ON s.setor_id = p.setor_id
JOIN tb_escala_profissionais pr ON pr.profissional_id = p.profissional_id
WHERE p.marcacao IN ('normal', 'cobertura', 'troca', 'extra')`;

module.exports = {
  async up(queryInterface, Sequelize) {
    const uuid = { type: Sequelize.CHAR(36), primaryKey: true, defaultValue: Sequelize.literal('(UUID())') };
    const fk = (table, key, allowNull = false) => ({
      type: Sequelize.CHAR(36), allowNull, references: { model: table, key }, onDelete: allowNull ? 'SET NULL' : 'CASCADE',
    });
    const criado = { criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') } };

    await queryInterface.createTable('tb_escala_profissionais', {
      profissional_id: uuid,
      nome: { type: Sequelize.STRING(200), allowNull: false },
      nome_normalizado: { type: Sequelize.STRING(200), allowNull: false },
      conselho: { type: Sequelize.ENUM(...CONSELHOS), allowNull: false },
      registro_numero: { type: Sequelize.STRING(120), allowNull: false, defaultValue: '' },
      registro_uf: { type: Sequelize.STRING(2), allowNull: false, defaultValue: '' },
      categoria: Sequelize.STRING(40),
      ...criado,
    });
    // SEM_REGISTRO: registro_numero = nome_normalizado, mantém a UNIQUE como chave de identidade
    await queryInterface.addIndex('tb_escala_profissionais', ['conselho', 'registro_numero', 'registro_uf'], { unique: true, name: 'uq_escala_prof_registro' });
    await queryInterface.addIndex('tb_escala_profissionais', ['nome_normalizado'], { name: 'idx_escala_prof_nome' });

    await queryInterface.createTable('tb_escala_profissional_alias', {
      alias_id: uuid,
      profissional_id: fk('tb_escala_profissionais', 'profissional_id'),
      nome_bruto: { type: Sequelize.STRING(200), allowNull: false },
      nome_normalizado: { type: Sequelize.STRING(200), allowNull: false },
    });
    await queryInterface.addIndex('tb_escala_profissional_alias', ['nome_normalizado', 'profissional_id'], { unique: true, name: 'uq_escala_alias' });

    await queryInterface.createTable('tb_escala_setores', {
      setor_id: uuid,
      unidade_id: fk('tb_unidades', 'unidade_id'),
      nome: { type: Sequelize.STRING(150), allowNull: false },
      especialidade: Sequelize.STRING(80),
      area: { type: Sequelize.ENUM('medica', 'enfermagem', 'multiprofissional', 'apoio'), allowNull: false, defaultValue: 'medica' },
    });
    await queryInterface.addIndex('tb_escala_setores', ['unidade_id', 'nome'], { unique: true, name: 'uq_escala_setor' });

    await queryInterface.createTable('tb_escala_arquivos', {
      arquivo_id: uuid,
      unidade_id: fk('tb_unidades', 'unidade_id'),
      competencia: { type: Sequelize.CHAR(7), allowNull: false },
      assunto: Sequelize.STRING(200),
      origem: { type: Sequelize.STRING(500), allowNull: false },
      md_path: Sequelize.STRING(500),
      sha1: Sequelize.CHAR(40),
      periodo_inicio: Sequelize.DATEONLY,
      periodo_fim: Sequelize.DATEONLY,
      metodo: { type: Sequelize.ENUM('parser_a', 'parser_b', 'parser_c', 'claude'), allowNull: false },
      status: { type: Sequelize.ENUM('ok', 'revisar', 'ignorado'), allowNull: false, defaultValue: 'ok' },
      qtd_plantoes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      obs: Sequelize.TEXT,
      ...criado,
    });
    await queryInterface.addIndex('tb_escala_arquivos', ['origem'], { unique: true, name: 'uq_escala_arquivo_origem' });

    await queryInterface.createTable('tb_escala_plantoes', {
      plantao_id: uuid,
      arquivo_id: fk('tb_escala_arquivos', 'arquivo_id'),
      unidade_id: fk('tb_unidades', 'unidade_id'),
      setor_id: fk('tb_escala_setores', 'setor_id', true),
      profissional_id: fk('tb_escala_profissionais', 'profissional_id', true),
      data: { type: Sequelize.DATEONLY, allowNull: false },
      inicio: { type: Sequelize.DATE, allowNull: false },
      fim: { type: Sequelize.DATE, allowNull: false },
      modalidade: { type: Sequelize.ENUM(...MODALIDADES), allowNull: false, defaultValue: 'plantao' },
      marcacao: { type: Sequelize.ENUM(...MARCACOES), allowNull: false, defaultValue: 'normal' },
      // de quem é o posto: 'pma' = posto de médico da Prefeitura Municipal de Americana. Nas escalas do HM,
      // RI+pma = médico PMA não foi/não confirmou; cobertura+pma = alguém cobriu esse posto.
      vinculo: { type: Sequelize.ENUM('oss', 'pma'), allowNull: false, defaultValue: 'oss' },
      texto_bruto: Sequelize.STRING(500),
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE tb_escala_plantoes ADD COLUMN horas DECIMAL(5,2) AS (TIMESTAMPDIFF(MINUTE, inicio, fim) / 60) STORED',
    );
    await queryInterface.addIndex('tb_escala_plantoes', ['profissional_id', 'inicio'], { name: 'idx_escala_plantao_prof' });
    await queryInterface.addIndex('tb_escala_plantoes', ['unidade_id', 'data'], { name: 'idx_escala_plantao_unid' });
    await queryInterface.addIndex('tb_escala_plantoes', ['setor_id', 'data'], { name: 'idx_escala_plantao_setor' });
    await queryInterface.sequelize.query(VIEW_REALIZADOS);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS vw_escala_realizados');
    for (const t of ['tb_escala_plantoes', 'tb_escala_arquivos', 'tb_escala_setores', 'tb_escala_profissional_alias', 'tb_escala_profissionais']) {
      await queryInterface.dropTable(t);
    }
  },
};
