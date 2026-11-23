-- Reconstrói o histórico de migrações (SequelizeMeta) do banco oss a partir de evidências no esquema e nos dados.
-- Gerado em 22/11/2026: o app-db foi carregado sem histórico e db:migrate:status listava todas as 52 migrações como pendentes.
-- Só registra migração cuja evidência existe; o resto continua pendente para o db:migrate.
-- Uso: scripts\reconstroi-sequelize-meta.ps1 (sem -Gravar só mostra; com -Gravar insere). @gravar vem do script.
SET NAMES utf8mb4;
USE oss;
SET @gravar = COALESCE(@gravar, 0);
DROP TABLE IF EXISTS _evidencia_migracoes;
CREATE TABLE _evidencia_migracoes (name VARCHAR(255) PRIMARY KEY, aplicada TINYINT NOT NULL, evidencia VARCHAR(255) NOT NULL);
INSERT INTO _evidencia_migracoes (name, aplicada, evidencia) VALUES
('20210915095343-create-user.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'users'), 'tabela users'),
('20211014113830-create_token_table.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tokens'), 'tabela tokens'),
('20260413000001-create-tb-oss.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_oss'), 'tabela tb_oss'),
('20260413000002-create-tb-usuarios.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_usuarios'), 'tabela tb_usuarios'),
('20260413000003-create-tb-contratos.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_contratos') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_contratos' AND column_name = 'valor_anual'), 'tb_contratos com valor_anual'),
('20260413000004-create-tb-aditivos.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_aditivos'), 'tabela tb_aditivos'),
('20260413000005-create-tb-historico-contrato.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_historico_contrato'), 'tabela tb_historico_contrato'),
('20260413000006-create-tb-unidades.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_unidades'), 'tabela tb_unidades'),
('20260413000007-create-tb-blocos-producao.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_blocos_producao'), 'tabela tb_blocos_producao'),
('20260413000008-create-tb-historico-blocos.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_historico_blocos'), 'tabela tb_historico_blocos'),
('20260413000009-create-tb-indicadores.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores'), 'tabela tb_indicadores'),
('20260413000010-create-tb-historico-indicadores.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_historico_indicadores'), 'tabela tb_historico_indicadores'),
('20260413000011-create-tb-metas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_metas'), 'tabela tb_metas'),
('20260413000012-create-tb-acompanhamento-mensal.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_acompanhamento_mensal'), 'tabela tb_acompanhamento_mensal'),
('20260413000013-create-tb-notas-explicativas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_notas_explicativas'), 'tabela tb_notas_explicativas'),
('20260413000014-create-tb-consolidacoes.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_consolidacoes'), 'tabela tb_consolidacoes'),
('20260413000015-create-tb-consolidacao-itens.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_consolidacao_itens'), 'tabela tb_consolidacao_itens'),
('20260413000016-create-tb-repasse-mensal.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_repasse_mensal'), 'tabela tb_repasse_mensal'),
('20260413000017-create-tb-descontos-bloco.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_descontos_bloco'), 'tabela tb_descontos_bloco'),
('20260413000018-create-tb-descontos-indicador.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_descontos_indicador'), 'tabela tb_descontos_indicador'),
('20260413000019-create-tb-rubricas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_rubricas'), 'tabela tb_rubricas'),
('20260413000020-create-tb-execucao-financeira.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_execucao_financeira'), 'tabela tb_execucao_financeira'),
('20260413000021-create-tb-historico-rubricas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_historico_rubricas'), 'tabela tb_historico_rubricas'),
('20260413000022-create-tb-comissoes.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_comissoes'), 'tabela tb_comissoes'),
('20260413000023-create-tb-documentos-regulatorios.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_documentos_regulatorios'), 'tabela tb_documentos_regulatorios'),
('20260413000024-create-tb-auditoria-logs.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_auditoria_logs'), 'tabela tb_auditoria_logs'),
('20260413000025-create-extras-view-procedure-trigger.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'vw_meta_vigente') AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'oss' AND routine_name = 'sp_aplicar_aditivo') AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'oss' AND trigger_name = 'trg_acomp_calcular_variacao'), 'view VW_META_VIGENTE, sp_aplicar_aditivo e trigger'),
('20260421000001-add-meta-tipo-to-tb-metas.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_metas' AND column_name = 'meta_tipo'), 'tb_metas.meta_tipo'),
('20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_acompanhamento_mensal' AND column_name = 'meta_minima') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_acompanhamento_mensal' AND column_name = 'meta_tipo_snap'), 'snapshot de metas no acompanhamento'),
('20260423000001-create-tb-permissoes-perfil.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_permissoes_perfil'), 'tabela tb_permissoes_perfil'),
('20260424120001-add-hierarchy-to-tb-metas.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_metas' AND column_name = 'parent_meta_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_metas' AND column_name = 'peso'), 'tb_metas.parent_meta_id e peso'),
('20260424120002-acompanhamento-unique-meta-mes.js', EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_acompanhamento_mensal' AND index_name = 'uk_acomp_meta_mes'), 'índice uk_acomp_meta_mes'),
('20260425120000-vigencia-prazo-on-indicador.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores' AND column_name = 'vigencia_inicio') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores' AND column_name = 'prazo_implantacao'), 'tb_indicadores.vigencia_inicio e prazo_implantacao'),
('20260426120000-meta-nome-e-limites-percentuais.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_metas' AND column_name = 'nome'), 'tb_metas.nome'),
('20260427120000-add-contrato-ano-to-indicador.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores' AND column_name = 'contrato_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores' AND column_name = 'ano'), 'tb_indicadores.contrato_id e ano'),
('20260427130000-add-obrigatorio-to-indicador.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_indicadores' AND column_name = 'obrigatorio'), 'tb_indicadores.obrigatorio'),
('20261018120000-create-tb-mapa-producao.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_mapa_producao'), 'tabela tb_mapa_producao'),
('20261019120000-corrige-cnes-unidades.js', EXISTS (SELECT 1 FROM oss.tb_unidades WHERE sigla = 'UPA-ZAN' AND cnes = '2028050'), 'CNES 2028050 na UPA-ZAN'),
('20261019130000-add-cbo-to-mapa-producao.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_mapa_producao' AND column_name = 'cbo'), 'tb_mapa_producao.cbo'),
('20261019140000-grant-relatorios-write-mapa-producao.js', EXISTS (SELECT 1 FROM oss.tb_permissoes_perfil WHERE perfil = 'admin' AND modulo = 'relatorios' AND can_insert = 1), 'admin com escrita em relatorios'),
('20261027120000-zanaga-vigencias-recebimento.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_notas_explicativas' AND column_name = 'alcance_considerado'), 'tb_notas_explicativas.alcance_considerado'),
('20261027130000-regra-recebimento-por-vigencia.js', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_historico_contrato' AND column_name = 'regra_recebimento'), 'tb_historico_contrato.regra_recebimento'),
('20261028120000-unacon-regra-recebimento.js', EXISTS (SELECT 1 FROM oss.tb_indicadores WHERE codigo = 'UNA-QT-PC-03' AND obrigatorio = 0), 'UNA-QT-PC-03 não obrigatório'),
('20261028130000-escalas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_escala_plantoes') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'vw_escala_realizados'), 'tb_escala_plantoes e vw_escala_realizados'),
('20261116120000-financeiro-contas.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_movimentacao_conta') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_execucao_financeira' AND column_name = 'conta'), 'tb_movimentacao_conta e tb_execucao_financeira.conta'),
('20261116130000-repasse-fonte.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_repasse_fonte'), 'tabela tb_repasse_fonte'),
('20261117090000-financeiro-gestao.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_grupo_financeiro') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_fechamento_financeiro'), 'tb_grupo_financeiro e tb_fechamento_financeiro'),
('20261118120000-zanaga-vigencia-2025-proc-enfermagem.js', EXISTS (SELECT 1 FROM oss.tb_indicadores WHERE codigo = 'ZAN-QT-PA-03' AND vigencia_fim = '2026-07-31'), 'ZAN-QT-PA-03 com vigência até 31/07/2026'),
('20261118130000-zanaga-faixas-medico-satisfacao.js', EXISTS (SELECT 1 FROM oss.tb_metas m JOIN oss.tb_indicadores i USING (indicador_id) WHERE i.codigo = 'ZAN-QL-10' AND m.meta_parcial = 95), 'ZAN-QL-10 com meta_parcial 95'),
('20261122100000-escala-dimensionamento.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_escala_dimensionamento'), 'tabela tb_escala_dimensionamento'),
('20261122120000-create-tb-documento.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_documento'), 'tabela tb_documento'),
('20261122140000-create-unacon-tables.js', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_unacon_pacientes') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oss' AND LOWER(table_name) = 'tb_unacon_uploads'), 'tabelas tb_unacon_*');
SELECT e.name AS migracao,
       IF(e.aplicada = 1, 'aplicada', 'PENDENTE') AS situacao,
       IF(s.name IS NULL, 'não', 'sim') AS ja_registrada,
       e.evidencia
  FROM _evidencia_migracoes e LEFT JOIN SequelizeMeta s ON s.name = e.name ORDER BY e.name;
INSERT INTO SequelizeMeta (name)
SELECT e.name FROM _evidencia_migracoes e
 WHERE @gravar = 1 AND e.aplicada = 1 AND NOT EXISTS (SELECT 1 FROM SequelizeMeta s WHERE s.name = e.name);
SELECT IF(@gravar = 1, 'gravado', 'simulação, nada gravado') AS modo,
       (SELECT COUNT(*) FROM _evidencia_migracoes WHERE aplicada = 1) AS aplicadas,
       (SELECT COUNT(*) FROM _evidencia_migracoes WHERE aplicada = 0) AS pendentes,
       (SELECT COUNT(*) FROM SequelizeMeta) AS registradas_no_banco;
DROP TABLE _evidencia_migracoes;
