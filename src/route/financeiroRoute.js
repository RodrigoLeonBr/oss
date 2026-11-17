const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const c = new FinanceiroController();
const ver = checkPermission('financeiro', 'view');
const inserir = checkPermission('financeiro', 'insert');
const alterar = checkPermission('financeiro', 'update');
const apagar = checkPermission('financeiro', 'delete');
const obsId = (req, body) => {
    return req.params.id || body?.data?.obs_id || null;
};

// Painel (consulta)
router.get('/opcoes', auth(), ver, c.opcoes);
router.get('/painel/resumo', auth(), ver, c.resumo);
router.get('/painel/serie', auth(), ver, c.serie);
router.get('/painel/comparativo', auth(), ver, c.comparativo);
router.get('/painel/detalhe', auth(), ver, c.detalhe);

// Relatório da comissão (.docx: metas + financeiro)
router.get('/relatorio.docx', auth(), ver, auditarVisualizacao('tb_execucao_financeira'), c.relatorio);

// Lançamento manual
router.get('/grade', auth(), ver, c.grade);
router.put('/grade', auth(), alterar, auditar('tb_execucao_financeira', 'UPDATE', (req) => {
    return req.body?.unidade_id; // conta/mês/valores ficam em dados_depois
}), c.salvarGrade);

// Importação: 1 arquivo por POST (corpo binário), depois prévia (dry-run) e confirmação
router.post('/importacao/arquivo', auth(), inserir,
    express.raw({ type: () => {
        return true;
    }, limit: '60mb' }), c.arquivo);
router.post('/importacao/previa', auth(), inserir, c.previa);
router.post('/importacao/confirmar', auth(), inserir,
    auditar('tb_execucao_financeira', 'INSERT', (req) => {
        return req.body?.token;
    }), c.confirmar);

// Observações / pendências
router.get('/observacoes', auth(), ver, c.listarObservacoes);
router.post('/observacoes', auth(), inserir, auditar('tb_observacao_financeira', 'INSERT', obsId), c.criarObservacao);
router.put('/observacoes/:id', auth(), alterar, auditar('tb_observacao_financeira', 'UPDATE', obsId), c.atualizarObservacao);
router.delete('/observacoes/:id', auth(), apagar, auditar('tb_observacao_financeira', 'DELETE', obsId), c.removerObservacao);

// Fechamento de mês (reabrir = delete, só admin; justificativa vai para o log)
router.get('/fechamento', auth(), ver, c.fechamentos);
router.post('/fechamento', auth(), alterar, auditar('tb_fechamento_financeiro', 'INSERT', (req) => {
    return req.body?.contrato_id;
}), c.fechar);
router.delete('/fechamento', auth(), apagar, auditar('tb_fechamento_financeiro', 'DELETE', (req) => {
    return req.body?.contrato_id; // mês e justificativa ficam em dados_depois
}), c.reabrir);

module.exports = router;
