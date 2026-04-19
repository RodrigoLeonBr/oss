const cron = require('node-cron');
const logger = require('./config/logger');

const contarDiasUteisNoMes = (data) => {
    let count = 0;
    const d = new Date(data.getFullYear(), data.getMonth(), 1);
    while (d <= data) {
        const diaSemana = d.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
};

const getMesAnterior = () => {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return mesAnterior.toISOString().slice(0, 7) + '-01';
};

// JOB 1: Cálculo de descontos no 6º dia útil do mês
cron.schedule('0 8 * * 1-5', async () => {
    const hoje = new Date();
    const diasUteis = contarDiasUteisNoMes(hoje);
    if (diasUteis !== 6) return;

    const mesReferencia = getMesAnterior();
    logger.info(`[CRON] 6º dia útil detectado. Calculando descontos para ${mesReferencia}...`);

    try {
        const db = require('./models');
        const AcompanhamentoService = require('./service/AcompanhamentoService');

        const contratosAtivos = await db.contrato.findAll({ where: { status: 'Ativo' } });

        for (const contrato of contratosAtivos) {
            const resultado = await AcompanhamentoService.calcularDescontosDoMes(mesReferencia, contrato.contrato_id);
            logger.info(`[CRON] Contrato ${contrato.numero}: R$ ${resultado.totalDesconto.toFixed(2)}`);
        }

        if (global.io) {
            global.io.emit('descontos:calculados', { mes: mesReferencia });
        }
    } catch (e) {
        logger.error(`[CRON] Erro ao calcular descontos: ${e.message}`);
    }
});

// JOB 2: Alerta de documentação regulatória vencendo em 30 dias
cron.schedule('0 7 * * *', async () => {
    logger.info('[CRON] Verificando documentação regulatória vencendo...');

    try {
        const db = require('./models');
        const { Op } = require('sequelize');
        const hoje = new Date();
        const em30Dias = new Date();
        em30Dias.setDate(em30Dias.getDate() + 30);

        const documentosVencendo = await db.documento_regulatorio.findAll({
            where: {
                ativa: true,
                data_vencimento: {
                    [Op.between]: [hoje.toISOString().slice(0, 10), em30Dias.toISOString().slice(0, 10)],
                },
            },
            include: [{ model: db.unidade, as: 'unidade', attributes: ['nome', 'sigla'] }],
        });

        const documentosVencidos = await db.documento_regulatorio.findAll({
            where: {
                ativa: true,
                data_vencimento: { [Op.lt]: hoje.toISOString().slice(0, 10) },
            },
            include: [{ model: db.unidade, as: 'unidade', attributes: ['nome', 'sigla'] }],
        });

        if (documentosVencidos.length > 0) {
            logger.warn(`[CRON] ALERTA: ${documentosVencidos.length} documento(s) VENCIDO(S)`);
        }
        if (documentosVencendo.length > 0) {
            logger.warn(`[CRON] ALERTA: ${documentosVencendo.length} documento(s) vencendo em 30 dias`);
        }

        if (global.io && (documentosVencidos.length > 0 || documentosVencendo.length > 0)) {
            global.io.emit('documentos:alerta', {
                vencidos: documentosVencidos.length,
                vencendoEm30Dias: documentosVencendo.length,
            });
        }
    } catch (e) {
        logger.error(`[CRON] Erro ao verificar documentação: ${e.message}`);
    }
});

// JOB 3: Lembrete de pendências de preenchimento (1º ao 5º dia útil)
cron.schedule('0 9 * * 1-5', async () => {
    const hoje = new Date();
    const diasUteis = contarDiasUteisNoMes(hoje);
    if (diasUteis < 1 || diasUteis > 5) return;

    logger.info(`[CRON] ${diasUteis}º dia útil - verificando pendências de preenchimento...`);

    try {
        const db = require('./models');
        const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

        const indicadoresAtivos = await db.indicador.count({ where: { ativo: true } });
        const preenchidos = await db.acompanhamento_mensal.count({ where: { mes_referencia: mesAtual } });

        if (preenchidos < indicadoresAtivos) {
            logger.warn(`[CRON] Pendências: ${preenchidos}/${indicadoresAtivos} indicadores preenchidos para ${mesAtual}`);
            if (global.io) {
                global.io.emit('acompanhamento:pendente', { mes: mesAtual, preenchidos, total: indicadoresAtivos, diaUtil: diasUteis });
            }
        }
    } catch (e) {
        logger.error(`[CRON] Erro ao verificar pendências: ${e.message}`);
    }
});
