const httpStatus = require('http-status');
const BackupService = require('../service/BackupService');
const config = require('../config/config');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class BackupController {
    listar = async (req, res, next) => {
        try {
            const arquivos = BackupService.listar();
            return res
                .status(httpStatus.OK)
                .json({ status: true, data: { banco: config.dbName, arquivos } });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    gerar = async (req, res, next) => {
        try {
            const meta = await BackupService.gerar();
            return res
                .status(httpStatus.CREATED)
                .json({ status: true, message: 'Backup gerado com sucesso', data: meta });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    baixar = async (req, res, next) => {
        try {
            const caminho = BackupService.caminhoArquivo(req.params.nome);
            return res.download(caminho, req.params.nome, (err) => {
                if (err && !res.headersSent) {
                    next(err);
                }
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    remover = async (req, res, next) => {
        try {
            BackupService.remover(req.params.nome);
            return res.status(httpStatus.OK).json({ status: true, message: 'Backup removido' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    // Corpo cru (application/octet-stream). Confirmação: ?confirmar=<nome do banco>.
    restaurar = async (req, res, next) => {
        try {
            if (req.query.confirmar !== config.dbName) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    `Confirmação inválida. Digite o nome do banco (${config.dbName}).`,
                );
            }
            if (!req.headers['content-length'] && !req.headers['transfer-encoding']) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    'Envie o arquivo de backup no corpo da requisição.',
                );
            }
            const tamanho = Number(req.headers['content-length'] || 0);
            const nomeImportado = await BackupService.receberUpload(req, tamanho);
            const seguranca = await BackupService.restaurar(nomeImportado);
            return res.status(httpStatus.OK).json({
                status: true,
                message: 'Banco restaurado. Um backup de segurança do estado anterior foi gerado.',
                data: { restaurado: nomeImportado, seguranca },
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = BackupController;
