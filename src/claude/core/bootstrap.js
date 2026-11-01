// Precisa ser o PRIMEIRO require de server.js / vigia.js / snapshots.js.
// 1) stdout é o canal do protocolo MCP: nada do app pode escrever nele.
// 2) Força as credenciais somente leitura antes de src/config/config.js ler o env.
const path = require('path');

const raiz = path.join(__dirname, '../../..');
process.chdir(raiz); // LOG_FOLDER do .env é relativo; o Claude Desktop lança em outro cwd

console.log = console.error;
console.info = console.error;
console.debug = console.error;

require('dotenv').config({ path: path.join(raiz, '.env') });

const { env } = process;
if (!env.DB_CLAUDE_USER || !env.DB_CLAUDE_SQL_USER) {
    // nunca cair no usuário de escrita do app
    throw new Error(
        'DB_CLAUDE_USER / DB_CLAUDE_SQL_USER ausentes no .env (ver scripts/claude_ro.sql)',
    );
}
env.DB_USER = env.DB_CLAUDE_USER;
env.DB_PASS = env.DB_CLAUDE_PASS || '';
env.DB_PRODUCAO_USER = env.DB_CLAUDE_USER;
env.DB_PRODUCAO_PASS = env.DB_CLAUDE_PASS || '';

const winston = require('winston');
const logger = require('../../config/logger');

logger.transports
    .filter((t) => {
        return t instanceof winston.transports.Console;
    })
    .forEach((t) => {
        return logger.remove(t);
    });

const db = require('../../models');

db.sequelize.options.logging = false;

module.exports = { raiz, db, logger };
