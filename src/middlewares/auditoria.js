const db = require('../models');
const logger = require('../config/logger');

/**
 * Registra uma entrada no log de auditoria (LGPD / TCESP Instrução 01/2020).
 * Retenção: 5 anos. Nunca deletar registros de auditoria_logs.
 */
const registrarLog = async ({
    usuarioId,
    tabelaAfetada,
    registroId,
    operacao,
    dadosAntes = null,
    dadosDepois = null,
    ipOrigem = null,
    userAgent = null,
    descricaoMudanca = null,
}) => {
    try {
        await db.auditoria_log.create({
            usuario_id: usuarioId || null,
            tabela_afetada: tabelaAfetada,
            registro_id: registroId ? String(registroId) : null,
            operacao,
            dados_antes: dadosAntes,
            dados_depois: dadosDepois,
            ip_origem: ipOrigem,
            user_agent: userAgent,
            data_operacao: new Date(),
            descricao_mudanca: descricaoMudanca,
        });
    } catch (e) {
        logger.error(`[AUDITORIA] Falha ao registrar log: ${e.message}`);
    }
};

/**
 * Middleware factory para auditoria automática de rotas.
 * Intercepta a resposta e registra a operação após execução.
 *
 * @param {string} tabelaAfetada - Nome da tabela alvo
 * @param {string} operacao - INSERT | UPDATE | DELETE | VISUALIZAR | EXPORTAR
 * @param {Function} [getRegistroId] - Função para extrair o ID do registro de req
 */
const auditar = (tabelaAfetada, operacao, getRegistroId = null) => {
    return async (req, res, next) => {
        const ipOrigem =
            req.headers['x-forwarded-for'] ||
            req.connection?.remoteAddress ||
            req.ip;
        const userAgent = req.headers['user-agent'] || '';

        const originalJson = res.json.bind(res);

        res.json = async function auditedJson(body) {
            try {
                const usuarioId =
                    req.user?.usuario_id ||
                    req.user?.uuid ||
                    req.user?.dataValues?.uuid ||
                    null;

                const registroId = getRegistroId
                    ? getRegistroId(req, body)
                    : req.params?.id || null;

                const operacaoEfetiva =
                    req.method === 'POST' ? 'INSERT' :
                    req.method === 'PUT' || req.method === 'PATCH' ? 'UPDATE' :
                    req.method === 'DELETE' ? 'DELETE' :
                    operacao;

                if (res.statusCode < 400) {
                    await registrarLog({
                        usuarioId,
                        tabelaAfetada,
                        registroId,
                        operacao: operacaoEfetiva,
                        dadosDepois: body?.data || null,
                        ipOrigem,
                        userAgent,
                        descricaoMudanca: `${req.method} ${req.originalUrl}`,
                    });
                }
            } catch (e) {
                logger.error(`[AUDITORIA MIDDLEWARE] ${e.message}`);
            }

            return originalJson(body);
        };

        next();
    };
};

/**
 * Registra auditoria de visualização (GET) quando necessário.
 * Para conformidade TCESP em endpoints sensíveis.
 */
const auditarVisualizacao = (tabelaAfetada) => {
    return async (req, res, next) => {
        const ipOrigem =
            req.headers['x-forwarded-for'] ||
            req.connection?.remoteAddress ||
            req.ip;
        const userAgent = req.headers['user-agent'] || '';

        try {
            const usuarioId =
                req.user?.usuario_id ||
                req.user?.uuid ||
                req.user?.dataValues?.uuid ||
                null;

            await registrarLog({
                usuarioId,
                tabelaAfetada,
                registroId: req.params?.id || null,
                operacao: 'SELECT',
                ipOrigem,
                userAgent,
                descricaoMudanca: `GET ${req.originalUrl}`,
            });
        } catch (e) {
            logger.error(`[AUDITORIA VISUALIZACAO] ${e.message}`);
        }

        next();
    };
};

module.exports = { auditar, auditarVisualizacao, registrarLog };
