const httpStatus = require('http-status');
const FinanceiroService = require('../service/FinanceiroService');
const RelatorioComissaoService = require('../service/RelatorioComissaoService');
const V = require('../validator/FinanceiroValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

const usuarioId = (req) => {
    return req.user?.usuario_id || req.user?.uuid || req.user?.dataValues?.uuid || null;
};

// escopo do query → nomes do service
const escopoDe = (v) => {
    return { ossId: v.oss_id, contratoId: v.contrato_id, unidadeId: v.unidade_id, conta: v.conta };
};
const periodoDe = (v) => {
    return { tipo: v.tipo, ano: v.ano, n: v.n, ini: v.ini, fim: v.fim };
};

/** Gera handler: valida `fonte` (query|body) com schema, chama fn(value, req), responde com status. */
const handler = (schema, fonte, fn, status = httpStatus.OK, message) => {
    return async (req, res, next) => {
        try {
            const { error, value } = schema ? schema.validate(req[fonte]) : { value: {} };
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const data = await fn(value, req, getOssIdSeEscopoProprio(req));
            return res.status(status).json({ status: true, data, message });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
};

class FinanceiroController {
    opcoes = handler(null, 'query', (v, req, oss) => {
        return FinanceiroService.opcoes(oss);
    });

    resumo = handler(V.painelPeriodo, 'query', (v, req, oss) => {
        return FinanceiroService.resumo({ ...escopoDe(v), periodo: periodoDe(v) }, oss);
    });

    serie = handler(V.painelSerie, 'query', (v, req, oss) => {
        return FinanceiroService.serie({ ...escopoDe(v), ini: v.ini, fim: v.fim, granularidade: v.granularidade }, oss);
    });

    comparativo = handler(V.painelComparativo, 'query', (v, req, oss) => {
        const anos = Array.isArray(v.anos) ? v.anos : v.anos.split(',').map(Number);
        return FinanceiroService.comparativo({ ...escopoDe(v), tipo: v.tipo, n: v.n, anos }, oss);
    });

    detalhe = handler(V.painelPeriodo, 'query', (v, req, oss) => {
        return FinanceiroService.detalhe({ ...escopoDe(v), periodo: periodoDe(v) }, oss);
    });

    grade = handler(V.grade, 'query', (v, req, oss) => {
        return FinanceiroService.grade({ unidadeId: v.unidade_id, conta: v.conta, mes: v.mes }, oss);
    });

    salvarGrade = handler(V.salvarGrade, 'body', (v, req, oss) => {
        return FinanceiroService.salvarGrade(
            { unidadeId: v.unidade_id, conta: v.conta, mes: v.mes, valores: v.valores, movimentos: v.movimentos, saldo: v.saldo },
            usuarioId(req),
            oss,
        );
    }, httpStatus.OK, 'Lançamentos gravados');

    // corpo = bytes do arquivo (express.raw); metadados na query
    arquivo = handler(V.arquivo, 'query', (v, req, oss) => {
        return FinanceiroService.receberArquivo(
            { contratoId: v.contrato_id, token: v.token, nome: v.nome, buffer: Buffer.isBuffer(req.body) ? req.body : null },
            oss,
        );
    }, httpStatus.CREATED);

    previa = handler(V.token, 'body', (v, req, oss) => {
        return FinanceiroService.previaImportacao(v, oss);
    });

    confirmar = handler(V.token, 'body', (v, req, oss) => {
        return FinanceiroService.confirmarImportacao(v, oss);
    }, httpStatus.OK, 'Importação gravada');

    listarObservacoes = handler(V.listarObservacoes, 'query', (v, req, oss) => {
        return FinanceiroService.listarObservacoes(
            { contratoId: v.contrato_id, unidadeId: v.unidade_id, tipo: v.tipo, status: v.status, secao: v.secao, ini: v.ini, fim: v.fim },
            oss,
        );
    });

    criarObservacao = handler(V.criarObservacao, 'body', async (v, req, oss) => {
        return { obs_id: await FinanceiroService.criarObservacao(v, usuarioId(req), oss) };
    }, httpStatus.CREATED, 'Observação criada');

    atualizarObservacao = handler(V.atualizarObservacao, 'body', async (v, req, oss) => {
        return { obs_id: await FinanceiroService.atualizarObservacao(req.params.id, v, oss) };
    }, httpStatus.OK, 'Observação atualizada');

    removerObservacao = handler(null, 'body', async (v, req, oss) => {
        return { obs_id: await FinanceiroService.removerObservacao(req.params.id, oss) };
    }, httpStatus.OK, 'Observação removida');

    fechamentos = handler(V.contrato, 'query', (v, req, oss) => {
        return FinanceiroService.listarFechamentos({ contratoId: v.contrato_id }, oss);
    });

    fechar = handler(V.fechar, 'body', (v, req, oss) => {
        return FinanceiroService.fecharMeses(v, usuarioId(req), oss);
    }, httpStatus.OK, 'Meses fechados');

    relatorio = async (req, res, next) => {
        try {
            const { error, value } = V.relatorioComissao.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const { buffer, nome } = await RelatorioComissaoService.gerar(
                { contratoId: value.contrato_id, periodo: periodoDe(value) },
                getOssIdSeEscopoProprio(req),
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
            return res.status(httpStatus.OK).send(buffer);
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    reabrir = handler(V.reabrir, 'body', (v, req, oss) => {
        return FinanceiroService.reabrirMes(v, oss);
    }, httpStatus.OK, 'Mês reaberto');
}

module.exports = FinanceiroController;
