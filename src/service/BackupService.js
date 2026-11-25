const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const httpStatus = require('http-status');
const config = require('../config/config');
const db = require('../models');
const logger = require('../config/logger');
const ApiError = require('../helper/ApiError');

// Só nomes gerados pelo módulo (sem caminho, sem '..'). Evita path traversal no download/remoção.
const NOME_VALIDO = /^[A-Za-z0-9_.-]+\.sql(\.gz)?$/;
// Não ancorado: MariaDB põe uma linha /*M!999999...*/ antes do cabeçalho.
const CABECALHO_DUMP = /-- (MySQL|MariaDB) dump/;

let operacaoEmAndamento = null;

const carimbo = () => {
    return new Date().toISOString().replace(/[:.]/g, '-');
};

const dirBackup = () => {
    const dir = path.resolve(process.cwd(), config.backup.dir);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const caminhoArquivo = (nome) => {
    if (!NOME_VALIDO.test(nome)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Nome de arquivo de backup inválido.');
    }
    const caminho = path.join(dirBackup(), nome);
    if (!fs.existsSync(caminho)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Arquivo de backup não encontrado.');
    }
    return caminho;
};

// Senha vai por MYSQL_PWD (variável de ambiente): não aparece em `ps`.
const argsConexao = () => {
    return [
        `--host=${config.dbHost}`,
        `--port=${config.dbPort}`,
        `--user=${config.dbUser}`,
        '--default-character-set=utf8mb4',
    ];
};
const envConexao = () => {
    return { ...process.env, MYSQL_PWD: config.dbPass };
};

/**
 * Roda um processo do MySQL client. `fluxo` faz a ligação com stdin/stdout;
 * a promessa só resolve se o processo sair com código 0.
 */
const executar = async (child, fluxo) => {
    let stderr = '';
    child.stderr.on('data', (d) => {
        if (stderr.length < 2000) {
            stderr += d.toString();
        }
    });
    child.stdin?.on('error', () => {}); // EPIPE se o processo morrer: o close abaixo reporta

    const saida = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                return resolve();
            }
            return reject(new Error(`processo saiu com código ${code}: ${stderr.trim()}`));
        });
    });
    saida.catch(() => {});

    try {
        await fluxo();
    } catch (e) {
        child.kill();
        throw e;
    }
    await saida;
};

const metadado = (nome) => {
    const st = fs.statSync(path.join(dirBackup(), nome));
    return { nome, tamanhoBytes: st.size, criadoEm: st.mtime };
};

const criarBackup = async (motivo = 'manual') => {
    const nome = `backup-${motivo}-${carimbo()}.sql.gz`;
    const destino = path.join(dirBackup(), nome);
    const child = spawn(
        config.backup.dumpBin,
        [
            ...argsConexao(),
            '--single-transaction', // InnoDB: foto consistente sem travar o sistema
            '--routines',
            '--triggers',
            '--events',
            '--hex-blob',
            '--no-tablespaces',
            config.dbName,
        ],
        { env: envConexao() },
    );
    try {
        await executar(child, () => {
            return pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(destino));
        });
    } catch (e) {
        fs.rmSync(destino, { force: true });
        throw e;
    }
    return metadado(nome);
};

const listar = () => {
    return fs
        .readdirSync(dirBackup())
        .filter((n) => {
            return NOME_VALIDO.test(n);
        })
        .map(metadado)
        .sort((a, b) => {
            return b.criadoEm - a.criadoEm;
        });
};

const remover = (nome) => {
    fs.unlinkSync(caminhoArquivo(nome));
};

const ehGzip = (arquivo) => {
    const buf = Buffer.alloc(2);
    const fd = fs.openSync(arquivo, 'r');
    try {
        fs.readSync(fd, buf, 0, 2, 0);
    } finally {
        fs.closeSync(fd);
    }
    return buf[0] === 0x1f && buf[1] === 0x8b;
};

// Confere o cabeçalho do dump (primeiros bytes, já descompactados) antes de aceitar o arquivo.
const ehDumpValido = (arquivo, gz) => {
    return new Promise((resolve) => {
        const fonte = fs.createReadStream(arquivo, { start: 0, end: 65535 });
        const saida = gz ? fonte.pipe(zlib.createGunzip()) : fonte;
        let buf = Buffer.alloc(0);
        const verificar = () => {
            return resolve(CABECALHO_DUMP.test(buf.subarray(0, 200).toString('utf8')));
        };
        saida.on('data', (d) => {
            buf = Buffer.concat([buf, d]);
            if (buf.length >= 200) {
                verificar();
                fonte.destroy();
                saida.destroy();
            }
        });
        saida.on('end', verificar);
        saida.on('error', verificar);
        fonte.on('error', () => {
            return resolve(false);
        });
    });
};

/**
 * Grava o corpo cru de um POST (application/octet-stream) em arquivo temporário,
 * recusando acima do limite. Retorna o caminho final já validado.
 */
const receberUpload = async (stream, tamanhoInformado) => {
    const limite = config.backup.maxMb * 1024 * 1024;
    if (tamanhoInformado && tamanhoInformado > limite) {
        throw new ApiError(
            httpStatus.REQUEST_TOO_LONG,
            `Arquivo excede o limite de ${config.backup.maxMb} MB.`,
        );
    }
    const tmp = path.join(dirBackup(), `importado-${carimbo()}.part`);
    let total = 0;
    const limitador = new Transform({
        transform(chunk, _enc, cb) {
            total += chunk.length;
            if (total > limite) {
                return cb(
                    new ApiError(
                        httpStatus.REQUEST_TOO_LONG,
                        `Arquivo excede o limite de ${config.backup.maxMb} MB.`,
                    ),
                );
            }
            return cb(null, chunk);
        },
    });
    try {
        await pipeline(stream, limitador, fs.createWriteStream(tmp));
    } catch (e) {
        fs.rmSync(tmp, { force: true });
        throw e;
    }
    if (total === 0) {
        fs.rmSync(tmp, { force: true });
        throw new ApiError(httpStatus.BAD_REQUEST, 'Arquivo vazio.');
    }
    const gz = ehGzip(tmp);
    if (!(await ehDumpValido(tmp, gz))) {
        fs.rmSync(tmp, { force: true });
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Arquivo não parece um dump MySQL/MariaDB gerado pelo mysqldump.',
        );
    }
    const final = path.join(dirBackup(), `importado-${carimbo()}.sql${gz ? '.gz' : ''}`);
    fs.renameSync(tmp, final);
    return path.basename(final);
};

// DROP de tudo que existe hoje no banco. Necessário porque o dump só faz DROP TABLE IF EXISTS
// e CREATE TRIGGER/PROCEDURE, que falham se o objeto já existir.
const scriptLimpeza = async () => {
    const [views] = await db.sequelize.query(
        'SELECT table_name AS nome FROM information_schema.views WHERE table_schema = DATABASE()',
    );
    const [tabelas] = await db.sequelize.query(
        "SELECT table_name AS nome FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    );
    const [rotinas] = await db.sequelize.query(
        'SELECT routine_name AS nome, routine_type AS tipo FROM information_schema.routines WHERE routine_schema = DATABASE()',
    );
    const [eventos] = await db.sequelize.query(
        'SELECT event_name AS nome FROM information_schema.events WHERE event_schema = DATABASE()',
    );
    const id = (n) => {
        return `\`${n.replace(/`/g, '``')}\``;
    };
    const linhas = ['SET FOREIGN_KEY_CHECKS = 0;'];
    eventos.forEach((e) => {
        return linhas.push(`DROP EVENT IF EXISTS ${id(e.nome)};`);
    });
    rotinas.forEach((r) => {
        return linhas.push(`DROP ${r.tipo} IF EXISTS ${id(r.nome)};`);
    });
    views.forEach((v) => {
        return linhas.push(`DROP VIEW IF EXISTS ${id(v.nome)};`);
    });
    tabelas.forEach((t) => {
        return linhas.push(`DROP TABLE IF EXISTS ${id(t.nome)};`);
    });
    return `${linhas.join('\n')}\n`;
};

// Backup perdido na restauração (tabela tb_permissoes_perfil vem do dump) -> garante o acesso do admin ao módulo.
const garantirPermissaoBackup = async () => {
    const campos = { can_view: 1, can_insert: 1, can_update: 1, can_delete: 1 };
    const existente = await db.permissaoPerfil.findOne({
        where: { perfil: 'admin', modulo: 'backup' },
    });
    if (existente) {
        await existente.update(campos);
    } else {
        await db.permissaoPerfil.create({ perfil: 'admin', modulo: 'backup', ...campos });
    }
};

/**
 * Restaura o banco a partir de um arquivo listado em BACKUP_DIR (.sql ou .sql.gz).
 * Antes de tudo gera um backup de segurança (pre-restauracao). Destrutivo: substitui todos os dados.
 */
const restaurar = async (nomeArquivo) => {
    const origem = caminhoArquivo(nomeArquivo);
    if (operacaoEmAndamento) {
        throw new ApiError(
            httpStatus.CONFLICT,
            `Outra operação de backup está em andamento (${operacaoEmAndamento}).`,
        );
    }
    operacaoEmAndamento = 'restauração';
    try {
        const seguranca = await criarBackup('pre-restauracao');
        const limpeza = await scriptLimpeza();
        const gz = ehGzip(origem);
        const child = spawn(config.backup.clientBin, [...argsConexao(), config.dbName], {
            env: envConexao(),
        });
        await executar(child, () => {
            child.stdin.write(limpeza);
            const fontes = [fs.createReadStream(origem)];
            if (gz) {
                fontes.push(zlib.createGunzip());
            }
            return pipeline(...fontes, child.stdin);
        });
        await garantirPermissaoBackup();
        logger.warn(
            `[BACKUP] Banco ${config.dbName} restaurado a partir de ${nomeArquivo}. Segurança: ${seguranca.nome}`,
        );
        return seguranca;
    } finally {
        operacaoEmAndamento = null;
    }
};

const gerar = async () => {
    if (operacaoEmAndamento) {
        throw new ApiError(
            httpStatus.CONFLICT,
            `Outra operação de backup está em andamento (${operacaoEmAndamento}).`,
        );
    }
    operacaoEmAndamento = 'backup';
    try {
        return await criarBackup('manual');
    } finally {
        operacaoEmAndamento = null;
    }
};

module.exports = {
    listar,
    gerar,
    remover,
    caminhoArquivo,
    receberUpload,
    restaurar,
    NOME_VALIDO,
};
