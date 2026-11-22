// Regras de leitura das escalas: previsto × realizado (pela marcação) e cobertura de postos do contrato.
// Self-check: node src/helper/escalaCobertura.js

// Linha da escala que não é turno de trabalho (dia de ausência registrado).
const AUSENCIA = ['folga', 'ferias', 'licenca'];
// Mesmo critério de vw_escala_realizados.
const REALIZADO = ['normal', 'cobertura', 'troca', 'extra'];

/** 'ausencia' | 'realizado' | 'nao_realizado' (riscado, furo, faltas, atestado, posto vago). */
function classifica(marcacao, temProfissional) {
    if (AUSENCIA.includes(marcacao)) {
        return 'ausencia';
    }
    if (temProfissional && REALIZADO.includes(marcacao)) {
        return 'realizado';
    }
    return 'nao_realizado';
}

const MIN = 60000;
const hm = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
};

/** Janela [ini, fim) em ms do turno no dia `ymd`; fim ≤ início vira o dia seguinte. */
function janelaTurno(ymd, turnoInicio, turnoFim) {
    const base = new Date(`${ymd}T00:00:00`).getTime();
    const i = hm(turnoInicio);
    let f = hm(turnoFim);
    if (f <= i) {
        f += 24 * 60;
    }
    return [base + i * MIN, base + f * MIN];
}

/**
 * Postos-equivalentes que os plantões cobrem na janela: Σ sobreposição / duração do turno.
 * Ex.: titular 07–13 + cobertura 13–19 num turno 07–19 = 1 posto. Sobreaviso não cobre posto.
 * @param {[number, number]} janela ms
 * @param {Array<{inicio: Date|string, fim: Date|string, modalidade?: string}>} plantoes
 */
function postosEquivalentes(janela, plantoes) {
    const [ji, jf] = janela;
    let soma = 0;
    plantoes.forEach((p) => {
        if (p.modalidade === 'sobreaviso') {
            return;
        }
        const i = Math.max(ji, new Date(p.inicio).getTime());
        const f = Math.min(jf, new Date(p.fim).getTime());
        if (f > i) {
            soma += f - i;
        }
    });
    return Math.round((soma / (jf - ji)) * 100) / 100;
}

const CATEGORIA_LABEL = {
    farmaceutico: 'Farmacêutico',
    tecnico_radiologia: 'Técnico de radiologia',
    dentista: 'Dentista',
    assistente_social: 'Assistente social',
};

/**
 * Função do plantão para agrupar a escala (clínico × pediatra, enfermeiro × técnico).
 * ponytail: depende do assunto do arquivo de origem e da especialidade do setor (enfermeiro e técnico
 * têm categoria 'enfermagem'). Se não bastar, coluna `funcao` em tb_escala_plantoes preenchida na carga.
 */
function funcaoDoPlantao({ categoria: cat, assunto, especialidade }) {
    // Posto vago não tem profissional (nem categoria): infere pelo assunto do arquivo.
    let categoria = cat;
    if (!categoria && /m[eé]dic/i.test(assunto || '')) {
        categoria = 'medico';
    } else if (!categoria && /enferm/i.test(assunto || '')) {
        categoria = 'enfermagem';
    }
    const txt = `${especialidade || ''} ${assunto || ''}`.toLowerCase();
    if (categoria === 'medico') {
        if (txt.includes('pediat')) {
            return { chave: 'pediatria', label: 'Médico pediatra' };
        }
        if (/cl[ií]n|emerg/.test(txt)) {
            return { chave: 'clinico', label: 'Médico clínico' };
        }
        return { chave: 'medico', label: 'Médico (especialidade não informada)' };
    }
    if (categoria === 'enfermagem') {
        const a = (assunto || '').toLowerCase();
        if (/t[eé]c/.test(a)) {
            return { chave: 'tecnico_enfermagem', label: 'Técnico de enfermagem' };
        }
        if (a.includes('enfermeir')) {
            return { chave: 'enfermeiro', label: 'Enfermeiro' };
        }
        return { chave: 'enfermagem', label: 'Enfermagem' };
    }
    if (categoria) {
        return { chave: categoria, label: CATEGORIA_LABEL[categoria] || categoria };
    }
    return { chave: 'nao_identificado', label: 'Não identificado' };
}

module.exports = { AUSENCIA, REALIZADO, classifica, janelaTurno, postosEquivalentes, funcaoDoPlantao };

if (require.main === module) {
    const assert = require('assert');
    assert.strictEqual(classifica('folga', true), 'ausencia');
    assert.strictEqual(classifica('cobertura', true), 'realizado');
    assert.strictEqual(classifica('furo', false), 'nao_realizado');
    assert.strictEqual(classifica('normal', false), 'nao_realizado'); // posto sem nome
    assert.strictEqual(classifica('riscado', true), 'nao_realizado');

    const d = janelaTurno('2026-07-10', '07:00', '19:00');
    assert.strictEqual((d[1] - d[0]) / MIN, 720);
    const n = janelaTurno('2026-07-10', '19:00', '07:00'); // vira o dia
    assert.strictEqual((n[1] - n[0]) / MIN, 720);

    // 6h + 6h = 1 posto
    assert.strictEqual(
        postosEquivalentes(d, [
            { inicio: '2026-07-10T07:00:00', fim: '2026-07-10T13:00:00' },
            { inicio: '2026-07-10T13:00:00', fim: '2026-07-10T19:00:00' },
        ]),
        1,
    );
    // noturno cruzando meia-noite + plantão de 24h cobre parte
    assert.strictEqual(
        postosEquivalentes(n, [
            { inicio: '2026-07-10T19:00:00', fim: '2026-07-11T07:00:00' },
            { inicio: '2026-07-11T01:00:00', fim: '2026-07-12T01:00:00' },
        ]),
        1.5,
    );
    // sobreaviso ignorado; fora da janela ignorado
    assert.strictEqual(
        postosEquivalentes(d, [
            { inicio: '2026-07-10T07:00:00', fim: '2026-07-10T19:00:00', modalidade: 'sobreaviso' },
            { inicio: '2026-07-11T07:00:00', fim: '2026-07-11T19:00:00' },
        ]),
        0,
    );

    const f = (categoria, assunto, especialidade) => {
        return funcaoDoPlantao({ categoria, assunto, especialidade }).chave;
    };
    assert.strictEqual(f('medico', 'escala médica', 'ps porta'), 'medico');
    assert.strictEqual(f('medico', 'escala pediatria', 'ps porta'), 'pediatria');
    assert.strictEqual(f('medico', 'escala', 'clínica médica'), 'clinico');
    assert.strictEqual(f('enfermagem', 'enfermeiros', 'ps porta'), 'enfermeiro');
    assert.strictEqual(f('enfermagem', 'téc. de enfermagem', 'ps porta'), 'tecnico_enfermagem');
    assert.strictEqual(f('enfermagem', 'técnico de enfermagem', 'cme'), 'tecnico_enfermagem');
    assert.strictEqual(f('tecnico_radiologia', 'radiologia', null), 'tecnico_radiologia');
    assert.strictEqual(f(null, null, null), 'nao_identificado');
    assert.strictEqual(f(null, 'téc. de enfermagem', 'ps porta'), 'tecnico_enfermagem'); // posto vago
    assert.strictEqual(f(null, 'escala médica', 'ps porta'), 'medico');
    console.log('OK');
}
