/* eslint-env mocha */
const { expect } = require('chai');
const { trechosDe, lerFrontmatter } = require('../../src/incorporacao/catalogo');
const { trocarTipo } = require('../../src/incorporacao/reclassificar');
const { classificarPorNome } = require('../../src/incorporacao/tipos');

describe('incorporacao/catalogo', () => {
    it('lê o frontmatter do vault', () => {
        const { fm } = lerFrontmatter(
            '---\nano: 2026\nunidade: "pa_zanaga"\nsubpath: null\nscanned: true\n---\n\ntexto',
        );
        expect(fm).to.include({ ano: 2026, unidade: 'pa_zanaga', subpath: null, scanned: true });
    });

    it('página em título vale para o texto seguinte (OCR do INDSH)', () => {
        const t = trechosDe('## Página 1\nata da reunião\n## Página 2\ndeliberações');
        expect(
            t.find((x) => {
                return x.texto.includes('ata');
            }).pagina,
        ).to.equal(1);
        expect(
            t.find((x) => {
                return x.texto.includes('deliberações');
            }).pagina,
        ).to.equal(2);
    });

    it('página em rodapé vale para o texto anterior (SCMC)', () => {
        const t = trechosDe(
            '### Situação Atual\nforam realizados 50 treinamentos\nPágina 16\n# ANEXO 13\nlista\nPágina 17',
        );
        expect(
            t.find((x) => {
                return x.texto.includes('50 treinamentos');
            }).pagina,
        ).to.equal(16);
        expect(
            t.find((x) => {
                return x.texto.includes('lista');
            }).pagina,
        ).to.equal(17);
    });
});

describe('incorporacao/reclassificar', () => {
    it('troca só a linha tipo do frontmatter', () => {
        const antes = '---\nano: 2026\ntipo: "outros"\n---\n\ntipo: "outros" no corpo';
        const depois = trocarTipo(antes, 'comissao');
        expect(depois).to.equal('---\nano: 2026\ntipo: "comissao"\n---\n\ntipo: "outros" no corpo');
    });

    it('classifica pelo nome com regras ordenadas', () => {
        const regras = {
            regras: [
                { id: 'comissao', tipo: 'comissao', re: /comiss(ao|oes)|ata_de_reuniao/ },
                { id: 'protocolo', tipo: 'protocolo', re: /(^|_)(it|fo|for)_/ },
            ],
        };
        expect(
            classificarPorNome('fo_paaz_nqsp_002_v001_ata_de_reuniao_de_comissao.md', regras).tipo,
        ).to.equal('comissao');
        expect(classificarPorNome('it_enf_001_traqueostomia.pdf', regras).tipo).to.equal(
            'protocolo',
        );
        expect(classificarPorNome('abner_felipe_de_lima.md', regras)).to.equal(null);
    });
});
