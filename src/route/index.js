const express = require('express');
const authRoute = require('./authRoute');
const acompanhamentoRoute = require('./acompanhamentoRoute');
const indicadorRoute = require('./indicadorRoute');
const contratoRoute = require('./contratoRoute');
const descontoRoute = require('./descontoRoute');
const metaRoute = require('./metaRoute');

const router = express.Router();

const defaultRoutes = [
    { path: '/auth', route: authRoute },
    { path: '/acompanhamento-mensal', route: acompanhamentoRoute },
    { path: '/indicadores', route: indicadorRoute },
    { path: '/contratos', route: contratoRoute },
    { path: '/descontos', route: descontoRoute },
    { path: '/metas', route: metaRoute },
];

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

module.exports = router;
