const express = require('express');
const authRoute = require('./authRoute');
const ossRoute = require('./ossRoute');
const unidadeRoute = require('./unidadeRoute');
const acompanhamentoRoute = require('./acompanhamentoRoute');
const indicadorRoute = require('./indicadorRoute');
const contratoRoute = require('./contratoRoute');
const descontoRoute = require('./descontoRoute');
const metaRoute = require('./metaRoute');
const acompanhamentosRoute = require('./acompanhamentosRoute');

const router = express.Router();

router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

const defaultRoutes = [
    { path: '/auth', route: authRoute },
    { path: '/oss', route: ossRoute },
    { path: '/unidades', route: unidadeRoute },
    { path: '/acompanhamento-mensal', route: acompanhamentoRoute },
    { path: '/indicadores', route: indicadorRoute },
    { path: '/contratos', route: contratoRoute },
    { path: '/descontos', route: descontoRoute },
    { path: '/metas', route: metaRoute },
    { path: '/acompanhamentos', route: acompanhamentosRoute },
];

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

module.exports = router;
