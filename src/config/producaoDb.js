const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('./logger');

// Conexão secundária SOMENTE LEITURA ao banco do consultaprod (SIA/SIH).
// Nunca criar/alterar dados aqui — só SELECT via sequelize.query.
const producaoDb = new Sequelize(
    config.producaoDb.name,
    config.producaoDb.user,
    config.producaoDb.pass,
    {
        host: config.producaoDb.host,
        port: config.producaoDb.port,
        dialect: 'mysql',
        logging: false,
        pool: { max: 3, min: 0, idle: 10000 },
        dialectOptions: { bigNumberStrings: true },
    },
);

async function pingProducao() {
    try {
        await producaoDb.authenticate();
        return true;
    } catch (e) {
        logger.error(`Banco producao indisponivel: ${e.message}`);
        return false;
    }
}

module.exports = { producaoDb, pingProducao };
