// Saída das ferramentas: JSON ou Markdown pronto para colar no relatório.
// Resultado de ferramenta: { titulo, fonte, tabelas?: [{ titulo?, colunas: [[chave, rótulo, tipo?]], linhas }], notas?, dados }
// tipo: 'moeda' | 'pct' | 'num' | 'texto' (default)

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const vazio = (v) => {
    return v === null || v === undefined || v === '' || Number.isNaN(v);
};

function fmt(v, tipo) {
    if (vazio(v)) {
        return '—';
    }
    const n = Number(v);
    if (tipo === 'moeda' && Number.isFinite(n)) {
        return BRL.format(n);
    }
    if (tipo === 'pct' && Number.isFinite(n)) {
        return `${PCT.format(n)}%`;
    }
    if (tipo === 'num' && Number.isFinite(n)) {
        return NUM.format(n);
    }
    if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
    }
    if (typeof v === 'object') {
        return JSON.stringify(v);
    }
    return String(v);
}

const celula = (s) => {
    return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
};

function tabelaMd({ titulo, colunas, linhas }) {
    const cab = `| ${colunas
        .map((c) => {
            return celula(c[1]);
        })
        .join(' | ')} |`;
    const sep = `| ${colunas
        .map((c) => {
            return ['moeda', 'pct', 'num'].includes(c[2]) ? '---:' : '---';
        })
        .join(' | ')} |`;
    const corpo = linhas.map((l) => {
        return `| ${colunas
            .map(([k, , t]) => {
                return celula(fmt(l[k], t));
            })
            .join(' | ')} |`;
    });
    const partes = [];
    if (titulo) {
        partes.push(`### ${titulo}`, '');
    }
    partes.push(
        cab,
        sep,
        ...(corpo.length
            ? corpo
            : [
                  `| ${colunas
                      .map(() => {
                          return '—';
                      })
                      .join(' | ')} |`,
              ]),
    );
    return partes.join('\n');
}

function paraMd(r, geradoEm) {
    const partes = [`## ${r.titulo}`, ''];
    for (const t of r.tabelas || []) {
        partes.push(tabelaMd(t), '');
    }
    if (r.texto) {
        partes.push(r.texto, '');
    } else if (!(r.tabelas || []).length) {
        partes.push('```json', JSON.stringify(r.dados, null, 2), '```', '');
    }
    for (const n of r.notas || []) {
        partes.push(`> ${n}`);
    }
    if ((r.notas || []).length) {
        partes.push('');
    }
    partes.push(`_Fonte: ${r.fonte || 'sistema OSS (banco oss)'}. Extraído em ${geradoEm}._`);
    return partes.join('\n');
}

module.exports = { fmt, tabelaMd, paraMd };

if (require.main === module) {
    const assert = require('assert');
    assert.strictEqual(fmt(1234.5, 'moeda').replace(/\s/g, ' '), 'R$ 1.234,50');
    assert.strictEqual(fmt(85.25, 'pct'), '85,3%');
    assert.strictEqual(fmt(null, 'pct'), '—');
    assert.ok(
        tabelaMd({ colunas: [['a', 'A|x', 'num']], linhas: [{ a: 1000 }] }).includes('| 1.000 |'),
    );
    console.error('OK');
}
