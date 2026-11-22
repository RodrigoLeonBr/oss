/* eslint-env mocha */
const { expect } = require('chai');
const { detectar, inferirParametros } = require('../../src/incorporacao/gatilhos');

describe('incorporacao/gatilhos', () => {
    it('reconhece conversão, escalas, financeiro e importação', () => {
        expect(detectar('py -3.13 convert_prestacao.py --ano 2026 --mes agosto').tipo).to.equal(
            'conversao',
        );
        expect(detectar('node src/db/carregaEscalas.js prestacao-vault/vault').tipo).to.equal(
            'escalas',
        );
        expect(detectar('node src/db/carregaFinanceiro.js').tipo).to.equal('financeiro');
        expect(detectar('npm run extracoes:importar -- --unidade=pa_zanaga').tipo).to.equal(
            'extracao',
        );
        expect(detectar('npm run incorporar -- --unidade=hm').tipo).to.equal('orquestrador');
    });

    it('ignora o que não muda dado e a própria rotina', () => {
        expect(detectar('npm test')).to.equal(null);
        expect(detectar('git status')).to.equal(null);
        expect(detectar('py -3.13 convert_prestacao.py --ano 2026 --dry-run')).to.equal(null);
        expect(detectar('npm run pos-incorporacao -- --etapa=memoria')).to.equal(null);
        expect(detectar('')).to.equal(null);
    });

    it('infere competência por --ano/--mes, por AAAA-MM e por pasta', () => {
        expect(
            inferirParametros('convert_prestacao.py --ano 2026 --mes marco').competencia,
        ).to.equal('2026-03');
        expect(inferirParametros('carregaEscalas.js --competencia=2026-08').competencia).to.equal(
            '2026-08',
        );
        expect(inferirParametros('x vault/2026/pa_zanaga/agosto/outros').competencia).to.equal(
            '2026-08',
        );
        expect(inferirParametros('convert_prestacao.py --ano 2025').competencia).to.equal('2025');
    });

    it('infere unidade pelas variações de nome', () => {
        expect(inferirParametros('x "2026/agosto/pa -  zanaga/a.pdf"').unidade).to.equal(
            'pa_zanaga',
        );
        expect(inferirParametros('x upa d. rosa/escala').unidade).to.equal('upa_dona_rosa');
        expect(inferirParametros('x UPA São José').unidade).to.equal('upa_cillos');
        expect(inferirParametros('x vault/2026/hm/agosto').unidade).to.equal('hm');
        expect(inferirParametros('x --unidade=unacon').unidade).to.equal('unacon');
        expect(inferirParametros('npm test').unidade).to.equal(null);
    });
});
