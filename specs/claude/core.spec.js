// MCP oss-relatorios: núcleo. Puros sempre; os de banco/arquivo precisam do MariaDB DEV e do acervo
// (pulam sozinhos se o banco estiver fora). Rodar: npx mocha specs/claude/core.spec.js --exit
const { expect } = require('chai');
const { db } = require('../../src/claude/core/bootstrap');
const { janela, resolverCaminho, mascarar } = require('../../src/claude/core/limites');
const { fmt } = require('../../src/claude/core/formatos');
const { dataDoNome } = require('../../src/claude/core/documentos');
const { executar } = require('../../src/claude/core/ferramentas');
const { fecharSql } = require('../../src/claude/core/consultas');

describe('claude/core: puros', () => {
    it('quadrimestres fixos', () => {
        expect([janela(2026, '2quad').inicio, janela(2026, '2quad').fim]).to.deep.equal([
            '2026-05-01',
            '2026-08-01',
        ]);
        expect(janela(2026, '1quad').inicio).to.equal('2026-01-01');
        expect(() => {
            return janela(2026, 'mes');
        }).to.throw(/exige mes/);
    });
    it('moeda e percentual pt-BR', () => {
        expect(fmt(1234.5, 'moeda').replace(/\s/g, ' ')).to.equal('R$ 1.234,50');
        expect(fmt(85.25, 'pct')).to.equal('85,3%');
    });
    it('data no nome do arquivo', () => {
        expect(dataDoNome('relatório quad jan abr 2024 20240725.pdf')).to.equal('2024-07-25');
        expect(dataDoNome('parecer anual upa dona rosa 2024 07_05_2025.pdf')).to.equal(
            '2025-05-07',
        );
    });
    it('recusa caminho fora das pastas permitidas', () => {
        expect(() => {
            return resolverCaminho('../../.env');
        }).to.throw(/fora das pastas/);
        expect(() => {
            return resolverCaminho('.env');
        }).to.throw(/fora das pastas/);
    });
    it('mascara segredos do .env', () => {
        expect(mascarar(`x${process.env.DB_CLAUDE_PASS}y`)).to.equal('x***y');
    });
    it('ferramenta inexistente → ok:false com mensagem', async () => {
        const r = await executar('nao_existe', {});
        expect(r.ok).to.equal(false);
        expect(r.erro).to.match(/inexistente/);
    });
});

describe('claude/core: banco e acervo', function () {
    this.timeout(120000);
    before(async function () {
        try {
            await db.sequelize.authenticate();
        } catch (e) {
            this.skip();
        }
    });
    after(async () => {
        await db.sequelize.close();
        await fecharSql();
    });

    it('listar_contratos traz os 3 contratos', async () => {
        const r = await executar('listar_contratos', { formato: 'json' });
        expect(r.ok).to.equal(true);
        expect(
            r.dados.map((c) => {
                return c.numero;
            }),
        ).to.include.members(['009/2023', '066/2024', '517/2025']);
    });
    it('cumprimento_metas aceita apelido 001/2023', async () => {
        const r = await executar('cumprimento_metas', {
            ano: 2026,
            periodo: '1quad',
            escopo: 'contrato',
            id: '001/2023',
            formato: 'json',
        });
        expect(r.ok, r.erro).to.equal(true);
        expect(r.dados.resumo.total).to.be.greaterThan(0);
    });
    it('efetivo_escalas sem identificar não traz nome nem registro', async () => {
        const r = await executar('efetivo_escalas', {
            unidade: 'HMA',
            de: '2026-03-01',
            ate: '2026-03-31',
            formato: 'json',
        });
        expect(r.ok, r.erro).to.equal(true);
        const chaves = new Set(r.dados.flatMap(Object.keys));
        ['profissional', 'conselho', 'registro_numero'].forEach((k) => {
            return expect(chaves.has(k)).to.equal(false);
        });
    });
    it('consulta_sql não lê usuários nem escrita', async () => {
        expect(
            (await executar('consulta_sql', { sql: 'SELECT * FROM tb_usuarios' })).erro,
        ).to.match(/denied/);
        expect((await executar('consulta_sql', { sql: 'DELETE FROM tb_contratos' })).ok).to.equal(
            false,
        );
    });
    it('acervo: definitivos dos aceites 5 e 6', async function () {
        if (!process.env.ACERVO_RELATORIOS_DIR) {
            this.skip();
        }
        const a = await executar('acervo_relatorios', {
            ano: 2024,
            periodo: '1quad',
            contrato: '001/2023',
            tipo: 'caf',
            so_definitivos: true,
            formato: 'json',
        });
        expect(
            a.dados.map((x) => {
                return x.arquivo;
            }),
        ).to.deep.equal(['relatório quad jan abr 2024 20240725.pdf']);
        const b = await executar('acervo_relatorios', {
            ano: 2024,
            periodo: 'anual',
            contrato: 'dona_rosa',
            tipo: 'caf',
            so_definitivos: true,
            formato: 'json',
        });
        expect(
            b.dados.map((x) => {
                return x.arquivo;
            }),
        ).to.deep.equal(['parecer anual upa dona rosa 2024 07_05_2025.pdf']);
    });
});
