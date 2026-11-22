-- Usuários somente leitura do MCP oss-relatorios (src/claude).
-- Aplicar (senhas vêm do .env, nunca deste arquivo):
--   sed -e "s/__RO_PASS__/$DB_CLAUDE_PASS/" -e "s/__SQL_PASS__/$DB_CLAUDE_SQL_PASS/" scripts/claude_ro.sql \
--     | docker exec -i app-db mariadb -uhospital -p<senha-admin>
--
-- claude_ro  → ferramentas dedicadas (services). Lê escalas (nomes só saem com identificar=true).
-- claude_sql → ferramenta consulta_sql (SELECT livre). Sem escalas com nome/CRM, sem usuários/tokens/auditoria.
-- ponytail: GRANT por tabela (MariaDB não tem "todas exceto"); tabela nova precisa entrar aqui.

CREATE USER IF NOT EXISTS 'claude_ro'@'%' IDENTIFIED BY '__RO_PASS__';
CREATE USER IF NOT EXISTS 'claude_sql'@'%' IDENTIFIED BY '__SQL_PASS__';
ALTER USER 'claude_ro'@'%' IDENTIFIED BY '__RO_PASS__';
ALTER USER 'claude_sql'@'%' IDENTIFIED BY '__SQL_PASS__';

-- comuns aos dois
GRANT SELECT ON producao.* TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_acompanhamento_mensal   TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_aditivos                TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_blocos_producao         TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_comissoes               TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_consolidacao_itens      TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_consolidacoes           TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_contratos               TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_descontos_bloco         TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_descontos_indicador     TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_documentos_regulatorios TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_execucao_financeira     TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_historico_blocos        TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_historico_contrato      TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_historico_indicadores   TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_historico_rubricas      TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_indicadores             TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_mapa_producao           TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_metas                   TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_notas_explicativas      TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_oss                     TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_repasse_mensal          TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_rubricas                TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_unidades                TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.vw_meta_vigente            TO 'claude_ro'@'%', 'claude_sql'@'%';
-- catálogo dos .md da prestação (caminho, tipo, competência; sem conteúdo)
GRANT SELECT ON oss.tb_documento               TO 'claude_ro'@'%', 'claude_sql'@'%';
-- setores e arquivos de escala não identificam pessoa
GRANT SELECT ON oss.tb_escala_setores          TO 'claude_ro'@'%', 'claude_sql'@'%';
GRANT SELECT ON oss.tb_escala_arquivos         TO 'claude_ro'@'%', 'claude_sql'@'%';

-- só claude_ro: dados de profissionais e pacientes UNACON (LGPD, filtrados no núcleo)
GRANT SELECT ON oss.tb_escala_plantoes            TO 'claude_ro'@'%';
GRANT SELECT ON oss.tb_escala_profissionais       TO 'claude_ro'@'%';
GRANT SELECT ON oss.vw_escala_realizados          TO 'claude_ro'@'%';
GRANT SELECT ON oss.tb_unacon_pacientes           TO 'claude_ro'@'%';
GRANT SELECT ON oss.tb_unacon_procedimentos       TO 'claude_ro'@'%';
GRANT SELECT ON oss.tb_unacon_conciliacao         TO 'claude_ro'@'%';
GRANT SELECT ON oss.tb_unacon_uploads             TO 'claude_ro'@'%', 'claude_sql'@'%';

FLUSH PRIVILEGES;
