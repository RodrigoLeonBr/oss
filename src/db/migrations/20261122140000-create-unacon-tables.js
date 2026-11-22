'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. tb_unacon_pacientes
    await queryInterface.createTable('tb_unacon_pacientes', {
      paciente_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      nome: {
        type: Sequelize.STRING(250),
        allowNull: false,
      },
      nome_normalizado: {
        type: Sequelize.STRING(250),
        allowNull: false,
      },
      cpf: {
        type: Sequelize.CHAR(11),
        allowNull: true,
      },
      cns: {
        type: Sequelize.CHAR(15),
        allowNull: true,
      },
      data_nascimento: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      idade: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      prontuario: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      municipio_origem: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_unacon_pacientes', ['nome_normalizado', 'data_nascimento'], { name: 'idx_unacon_pac_norm' });
    await queryInterface.addIndex('tb_unacon_pacientes', ['cpf'], { name: 'idx_unacon_pac_cpf' });
    await queryInterface.addIndex('tb_unacon_pacientes', ['cns'], { name: 'idx_unacon_pac_cns' });
    await queryInterface.addIndex('tb_unacon_pacientes', ['prontuario'], { name: 'idx_unacon_pac_pront' });

    // 2. tb_unacon_procedimentos
    await queryInterface.createTable('tb_unacon_procedimentos', {
      procedimento_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      paciente_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'tb_unacon_pacientes',
          key: 'paciente_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      competencia: {
        type: Sequelize.CHAR(7),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM('quimioterapia', 'cirurgia', 'consulta', 'exame_sadt', 'outro'),
        allowNull: false,
      },
      subtipo: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      codigo_sigtap: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      descricao_procedimento: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      data_solicitacao: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      data_execucao: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      dias_ate_inicio: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status_lei_60_dias: {
        type: Sequelize.ENUM('dentro_prazo', 'fora_prazo', 'nao_aplicavel'),
        allowNull: false,
        defaultValue: 'nao_aplicavel',
      },
      profissional_nome: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      especialidade: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      comparecimento: {
        type: Sequelize.ENUM('atendido', 'ausente', 'cancelado', 'desconhecido'),
        allowNull: false,
        defaultValue: 'atendido',
      },
      tipo_agendamento: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      complexidade: {
        type: Sequelize.ENUM('baixa', 'media', 'alta', 'nao_informada'),
        allowNull: false,
        defaultValue: 'nao_informada',
      },
      fonte_origem: {
        type: Sequelize.ENUM('vault_ra', 'conecta', 'manual'),
        allowNull: false,
        defaultValue: 'vault_ra',
      },
      arquivo_origem: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_unacon_procedimentos', ['competencia', 'tipo'], { name: 'idx_unacon_proc_comp' });
    await queryInterface.addIndex('tb_unacon_procedimentos', ['paciente_id'], { name: 'idx_unacon_proc_pac' });
    await queryInterface.addIndex('tb_unacon_procedimentos', ['codigo_sigtap'], { name: 'idx_unacon_proc_sigtap' });

    // 3. tb_unacon_conciliacao
    await queryInterface.createTable('tb_unacon_conciliacao', {
      conciliacao_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      competencia: {
        type: Sequelize.CHAR(7),
        allowNull: false,
      },
      procedimento_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: {
          model: 'tb_unacon_procedimentos',
          key: 'procedimento_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tabela_sus: {
        type: Sequelize.ENUM('s_apa', 's_aih_pa', 's_prd'),
        allowNull: true,
      },
      id_origem_sus: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status_conciliacao: {
        type: Sequelize.ENUM('conciliado', 'apenas_oss', 'apenas_sus', 'divergencia'),
        allowNull: false,
      },
      paciente_nome_oss: {
        type: Sequelize.STRING(250),
        allowNull: true,
      },
      paciente_nome_sus: {
        type: Sequelize.STRING(250),
        allowNull: true,
      },
      sigtap_oss: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      sigtap_sus: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      data_oss: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      data_sus: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      municipio_oss: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      municipio_sus: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      divergencia_tipo: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      divergencia_detalhe: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      conferido_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_unacon_conciliacao', ['competencia', 'status_conciliacao'], { name: 'idx_unacon_conc_status' });

    // 4. tb_unacon_uploads
    await queryInterface.createTable('tb_unacon_uploads', {
      upload_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      nome_arquivo: {
        type: Sequelize.STRING(250),
        allowNull: false,
      },
      tipo_fonte: {
        type: Sequelize.ENUM('conecta_consultas', 'conecta_cirurgias', 'planilha_geral'),
        allowNull: false,
      },
      competencia: {
        type: Sequelize.CHAR(7),
        allowNull: true,
      },
      total_linhas: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      linhas_processadas: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      linhas_erros: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      usuario_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
      },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_unacon_conciliacao');
    await queryInterface.dropTable('tb_unacon_procedimentos');
    await queryInterface.dropTable('tb_unacon_pacientes');
    await queryInterface.dropTable('tb_unacon_uploads');
  },
};
