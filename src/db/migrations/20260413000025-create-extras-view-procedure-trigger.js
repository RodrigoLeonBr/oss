'use strict';

module.exports = {
  async up(queryInterface) {
    // Additional composite indices for performance
    await queryInterface.sequelize.query('CREATE INDEX idx_acomp_mes_indicador ON tb_acompanhamento_mensal (mes_referencia, indicador_id)');
    await queryInterface.sequelize.query('CREATE INDEX idx_acomp_mes_status ON tb_acompanhamento_mensal (mes_referencia, status_aprovacao)');
    await queryInterface.sequelize.query('CREATE INDEX idx_desc_bloco_repasse_mes ON tb_descontos_bloco (repasse_id, mes_referencia)');
    await queryInterface.sequelize.query('CREATE INDEX idx_hist_contrato_vigencia ON tb_historico_contrato (contrato_id, vigencia_inicio)');
    await queryInterface.sequelize.query('CREATE INDEX idx_metas_vigencia_ativa ON tb_metas (indicador_id, vigencia_inicio, vigencia_fim)');
    await queryInterface.sequelize.query('CREATE INDEX idx_docs_vencimento_ativa ON tb_documentos_regulatorios (data_vencimento, ativa)');
    await queryInterface.sequelize.query('CREATE INDEX idx_audit_data_usuario ON tb_auditoria_logs (data_operacao, usuario_id)');
    await queryInterface.sequelize.query('CREATE INDEX idx_audit_data_tabela ON tb_auditoria_logs (data_operacao, tabela_afetada)');
    await queryInterface.sequelize.query('CREATE INDEX idx_consol_ano_tipo ON tb_consolidacoes (ano, tipo_periodo, unidade_id)');
    await queryInterface.sequelize.query('CREATE INDEX idx_exec_mes_rubrica ON tb_execucao_financeira (mes_referencia, rubrica_id)');
    await queryInterface.sequelize.query('CREATE INDEX idx_ind_grupo_tipo ON tb_indicadores (grupo, tipo, ativo)');

    // View: VW_META_VIGENTE
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW VW_META_VIGENTE AS
      SELECT
        m.indicador_id, m.meta_id, m.vigencia_inicio, m.vigencia_fim,
        m.meta_mensal, m.meta_anual, m.meta_valor_qualit, m.meta_minima,
        m.meta_parcial, m.unidade_medida, m.observacoes, m.versao
      FROM tb_metas m
      WHERE m.vigencia_fim IS NULL OR m.vigencia_fim >= CURDATE()
    `);

    // Stored Procedure: sp_aplicar_aditivo
    await queryInterface.sequelize.query(`
      CREATE PROCEDURE sp_aplicar_aditivo(IN p_aditivo_id CHAR(36))
      BEGIN
        DECLARE v_contrato_id  CHAR(36);
        DECLARE v_novo_valor   DECIMAL(15,2);
        DECLARE v_nova_data    DATE;
        DECLARE v_versao       INT;

        START TRANSACTION;

        SELECT contrato_id, COALESCE(novo_valor_mensal, 0), nova_data_fim
        INTO v_contrato_id, v_novo_valor, v_nova_data
        FROM tb_aditivos WHERE aditivo_id = p_aditivo_id;

        SELECT COALESCE(MAX(versao),0) + 1
        INTO v_versao
        FROM tb_historico_contrato WHERE contrato_id = v_contrato_id;

        UPDATE tb_historico_contrato
        SET vigencia_fim = DATE_SUB(
          (SELECT data_vigencia_inicio FROM tb_aditivos WHERE aditivo_id = p_aditivo_id),
          INTERVAL 1 DAY
        )
        WHERE contrato_id = v_contrato_id AND vigencia_fim IS NULL;

        INSERT INTO tb_historico_contrato
          (contrato_id, aditivo_id, versao, vigencia_inicio,
           valor_mensal_base, perc_fixo, perc_variavel,
           modelo_desconto_qual, motivo_versao)
        SELECT
          v_contrato_id, p_aditivo_id, v_versao,
          (SELECT data_vigencia_inicio FROM tb_aditivos WHERE aditivo_id = p_aditivo_id),
          COALESCE(v_novo_valor, valor_mensal_base),
          perc_fixo, perc_variavel, modelo_desconto_qual,
          (SELECT CONCAT('Aditivo ', numero_aditivo, ': ', descricao_sumaria)
           FROM tb_aditivos WHERE aditivo_id = p_aditivo_id)
        FROM tb_contratos WHERE contrato_id = v_contrato_id;

        UPDATE tb_contratos
        SET
          valor_mensal_base = COALESCE(NULLIF(v_novo_valor,0), valor_mensal_base),
          data_fim = COALESCE(v_nova_data, data_fim),
          numero_aditivos = numero_aditivos + 1
        WHERE contrato_id = v_contrato_id;

        UPDATE tb_aditivos
        SET aplicado = 1, aplicado_em = NOW()
        WHERE aditivo_id = p_aditivo_id;

        COMMIT;
      END
    `);

    // Trigger: calculate variacao and status on acompanhamento insert
    await queryInterface.sequelize.query(`
      CREATE TRIGGER trg_acomp_calcular_variacao
      BEFORE INSERT ON tb_acompanhamento_mensal
      FOR EACH ROW
      BEGIN
        DECLARE v_realizado_ant DECIMAL(15,4);

        SELECT valor_realizado INTO v_realizado_ant
        FROM tb_acompanhamento_mensal
        WHERE indicador_id = NEW.indicador_id
          AND mes_referencia = DATE_SUB(NEW.mes_referencia, INTERVAL 1 MONTH)
          AND status_aprovacao = 'aprovado'
        LIMIT 1;

        IF v_realizado_ant IS NOT NULL AND v_realizado_ant <> 0 THEN
          SET NEW.variacao_vs_mes_ant =
            ROUND(((NEW.valor_realizado - v_realizado_ant) / v_realizado_ant) * 100, 4);
        END IF;

        IF NEW.valor_realizado IS NULL THEN
          SET NEW.status_cumprimento = 'aguardando';
        ELSEIF NEW.percentual_cumprimento >= 100 THEN
          SET NEW.status_cumprimento = 'cumprido';
        ELSEIF NEW.percentual_cumprimento >= 85 THEN
          SET NEW.status_cumprimento = 'parcial';
        ELSE
          SET NEW.status_cumprimento = 'nao_cumprido';
        END IF;

        IF NEW.percentual_cumprimento >= 100 THEN
          SET NEW.faixa_producao = 'acima_meta';
        ELSEIF NEW.percentual_cumprimento >= 85 THEN
          SET NEW.faixa_producao = 'entre_85_100';
        ELSEIF NEW.percentual_cumprimento >= 70 THEN
          SET NEW.faixa_producao = 'entre_70_84';
        ELSEIF NEW.percentual_cumprimento IS NOT NULL THEN
          SET NEW.faixa_producao = 'abaixo_70';
        END IF;
      END
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS trg_acomp_calcular_variacao');
    await queryInterface.sequelize.query('DROP PROCEDURE IF EXISTS sp_aplicar_aditivo');
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS VW_META_VIGENTE');
  },
};
