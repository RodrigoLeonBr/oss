const { QueryTypes } = require('sequelize');
const httpStatus = require('http-status');
const db = require('../models');
const ApiError = require('../helper/ApiError');
const { assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
const { normalizaNome } = require('../helper/escalaNormaliza');
const {
    AUSENCIA,
    REALIZADO,
    classifica,
    funcaoDoPlantao,
    janelaTurno,
    postosEquivalentes,
} = require('../helper/escalaCobertura');

const q = (sql, replacements) => {
    return db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
};

// Constantes fixas do helper → literal SQL (não vem do usuário).
const lista = (arr) => {
    return arr
        .map((m) => {
            return `'${m}'`;
        })
        .join(',');
};
const SQL_AUSENCIA = `p.marcacao IN (${lista(AUSENCIA)})`;
const SQL_REALIZADO = `(p.profissional_id IS NOT NULL AND p.marcacao IN (${lista(REALIZADO)}))`;

const ymd = (d) => {
    return d.toISOString().slice(0, 10);
};
/** 'YYYY-MM-01' → { ini, fim, dias: ['YYYY-MM-DD', …] } */
function janelaMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dias = Array.from({ length: n }, (_, i) => {
        return ymd(new Date(Date.UTC(y, m - 1, i + 1)));
    });
    return { ini: dias[0], fim: dias[n - 1], dias };
}

const num = (v) => {
    return v == null ? 0 : Number(v);
};

/** Setores da unidade com totais do mês (setor sem plantão no mês volta zerado = vazio). */
async function listarSetores({ unidadeId, mes }, ossIdFiltro) {
    await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);
    const { ini, fim, dias } = janelaMes(mes);
    const rows = await q(
        `
        SELECT s.setor_id, s.nome, s.area,
          COUNT(DISTINCT CASE WHEN NOT ${SQL_AUSENCIA} THEN p.profissional_id END) AS profissionais,
          SUM(NOT ${SQL_AUSENCIA}) AS previsto_plantoes,
          SUM(CASE WHEN NOT ${SQL_AUSENCIA} THEN p.horas END) AS previsto_horas,
          SUM(${SQL_REALIZADO}) AS realizado_plantoes,
          SUM(CASE WHEN ${SQL_REALIZADO} THEN p.horas END) AS realizado_horas,
          SUM(p.plantao_id IS NOT NULL AND p.profissional_id IS NULL) AS vagos,
          COUNT(DISTINCT CASE WHEN NOT ${SQL_AUSENCIA} THEN p.data END) AS dias_com_plantao
        FROM tb_escala_setores s
        LEFT JOIN tb_escala_plantoes p ON p.setor_id = s.setor_id AND p.data BETWEEN :ini AND :fim
        WHERE s.unidade_id = :unidadeId
        GROUP BY s.setor_id, s.nome, s.area
        ORDER BY s.area, s.nome`,
        { unidadeId, ini, fim },
    );
    return rows.map((r) => {
        const previsto = num(r.previsto_plantoes);
        const realizado = num(r.realizado_plantoes);
        return {
            setorId: r.setor_id,
            nome: r.nome,
            area: r.area,
            profissionais: num(r.profissionais),
            previsto: { plantoes: previsto, horas: num(r.previsto_horas) },
            realizado: { plantoes: realizado, horas: num(r.realizado_horas) },
            naoRealizado: previsto - realizado,
            vagos: num(r.vagos),
            diasSemPlantao: previsto ? dias.length - num(r.dias_com_plantao) : dias.length,
        };
    });
}

/** Plantões do mês de um setor (unidade+setor) ou de um profissional (todas as unidades do escopo). */
async function grade({ mes, unidadeId, setorId, profissionalId }, ossIdFiltro) {
    const { ini, fim, dias } = janelaMes(mes);
    const where = ['p.data BETWEEN :ini AND :fim'];
    if (profissionalId) {
        where.push('p.profissional_id = :profissionalId');
    } else {
        await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);
        where.push('p.unidade_id = :unidadeId', 'p.setor_id = :setorId');
    }
    if (ossIdFiltro) {
        where.push('c.oss_id = :ossIdFiltro');
    }
    const rows = await q(
        `
        SELECT p.plantao_id, DATE_FORMAT(p.data, '%Y-%m-%d') AS data,
          DATE_FORMAT(p.inicio, '%Y-%m-%dT%H:%i:%s') AS inicio,
          DATE_FORMAT(p.fim, '%Y-%m-%dT%H:%i:%s') AS fim,
          p.horas, p.marcacao, p.modalidade, p.vinculo, p.texto_bruto,
          p.profissional_id, pr.nome AS profissional, pr.conselho, pr.registro_numero, pr.registro_uf, pr.categoria,
          s.setor_id, s.nome AS setor, s.especialidade, a.assunto, u.unidade_id, u.sigla AS unidade
        FROM tb_escala_plantoes p
        LEFT JOIN tb_escala_arquivos a ON a.arquivo_id = p.arquivo_id
        JOIN tb_unidades u ON u.unidade_id = p.unidade_id
        JOIN tb_contratos c ON c.contrato_id = u.contrato_id
        LEFT JOIN tb_escala_setores s ON s.setor_id = p.setor_id
        LEFT JOIN tb_escala_profissionais pr ON pr.profissional_id = p.profissional_id
        WHERE ${where.join(' AND ')}
        ORDER BY pr.nome IS NULL, pr.nome, p.inicio`,
        {
            ini,
            fim,
            unidadeId,
            setorId,
            profissionalId,
            ossIdFiltro,
        },
    );

    const totais = {
        previsto: { plantoes: 0, horas: 0 },
        realizado: { plantoes: 0, horas: 0 },
        naoRealizado: 0,
        vagos: 0,
    };
    const plantoes = rows.map((r) => {
        const classe = classifica(r.marcacao, !!r.profissional_id);
        const horas = num(r.horas);
        const funcao = funcaoDoPlantao(r);
        if (classe !== 'ausencia') {
            totais.previsto.plantoes += 1;
            totais.previsto.horas += horas;
        }
        if (classe === 'realizado') {
            totais.realizado.plantoes += 1;
            totais.realizado.horas += horas;
        }
        if (classe === 'nao_realizado') {
            totais.naoRealizado += 1;
        }
        if (!r.profissional_id) {
            totais.vagos += 1;
        }
        return {
            plantaoId: r.plantao_id,
            data: r.data,
            inicio: r.inicio,
            fim: r.fim,
            horas,
            marcacao: r.marcacao,
            modalidade: r.modalidade,
            vinculo: r.vinculo,
            textoBruto: r.texto_bruto,
            classe,
            profissionalId: r.profissional_id,
            profissional: r.profissional,
            registro:
                r.conselho && r.conselho !== 'SEM_REGISTRO'
                    ? `${r.conselho} ${r.registro_numero}${
                          r.registro_uf ? `/${r.registro_uf}` : ''
                      }`
                    : null,
            categoria: r.categoria,
            funcao: funcao.chave,
            funcaoLabel: funcao.label,
            setorId: r.setor_id,
            setor: r.setor,
            unidadeId: r.unidade_id,
            unidade: r.unidade,
        };
    });
    return { dias, plantoes, totais };
}

/** Busca por nome, grafia (alias) ou número de registro; restrita à OSS quando escopo próprio. */
async function buscarProfissionais({ busca }, ossIdFiltro) {
    const nome = `%${normalizaNome(busca)}%`;
    const registro = busca.replace(/\D/g, '');
    return q(
        `
        SELECT pr.profissional_id AS profissionalId, pr.nome, pr.conselho, pr.registro_numero AS registroNumero,
          pr.registro_uf AS registroUf, pr.categoria
        FROM tb_escala_profissionais pr
        WHERE (pr.nome_normalizado LIKE :nome
           OR (:registro <> '' AND pr.registro_numero = :registro)
           OR EXISTS (SELECT 1 FROM tb_escala_profissional_alias a
                      WHERE a.profissional_id = pr.profissional_id AND a.nome_normalizado LIKE :nome))
          ${
              ossIdFiltro
                  ? `AND EXISTS (SELECT 1 FROM tb_escala_plantoes p
                JOIN tb_unidades u ON u.unidade_id = p.unidade_id
                JOIN tb_contratos c ON c.contrato_id = u.contrato_id
                WHERE p.profissional_id = pr.profissional_id AND c.oss_id = :ossIdFiltro)`
                  : ''
          }
        ORDER BY pr.nome
        LIMIT 30`,
        { nome, registro, ossIdFiltro },
    );
}

// ── Dimensionamento (postos contratados) ──────────────────────────────────────

const COLS_DIM = `d.dimensionamento_id AS dimensionamentoId, d.unidade_id AS unidadeId, d.setor_id AS setorId,
    s.nome AS setor, d.categoria, TIME_FORMAT(d.turno_inicio, '%H:%i') AS turnoInicio,
    TIME_FORMAT(d.turno_fim, '%H:%i') AS turnoFim, d.qtd_postos AS qtdPostos, d.dias_semana AS diasSemana,
    DATE_FORMAT(d.vigencia_inicio, '%Y-%m-%d') AS vigenciaInicio, DATE_FORMAT(d.vigencia_fim, '%Y-%m-%d') AS vigenciaFim,
    d.fonte, d.obs`;

async function listarDimensionamento({ unidadeId }, ossIdFiltro) {
    await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);
    return q(
        `SELECT ${COLS_DIM} FROM tb_escala_dimensionamento d
        JOIN tb_escala_setores s ON s.setor_id = d.setor_id
        WHERE d.unidade_id = :unidadeId AND d.ativo = 1
        ORDER BY s.nome, d.turno_inicio`,
        { unidadeId },
    );
}

async function buscarDimensionamento(id, ossIdFiltro) {
    const [d] = await q(
        `SELECT ${COLS_DIM} FROM tb_escala_dimensionamento d
        JOIN tb_escala_setores s ON s.setor_id = d.setor_id
        WHERE d.dimensionamento_id = :id AND d.ativo = 1`,
        { id },
    );
    if (!d) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Dimensionamento não encontrado');
    }
    await assertUnidadeNoEscopoOSS(d.unidadeId, ossIdFiltro);
    return d;
}

async function assertSetorDaUnidade(setorId, unidadeId) {
    const [s] = await q(
        'SELECT 1 AS ok FROM tb_escala_setores WHERE setor_id = :setorId AND unidade_id = :unidadeId',
        { setorId, unidadeId },
    );
    if (!s) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Setor não pertence à unidade');
    }
}

const camposDim = (v) => {
    return {
        setor_id: v.setorId,
        categoria: v.categoria || null,
        turno_inicio: v.turnoInicio,
        turno_fim: v.turnoFim,
        qtd_postos: v.qtdPostos,
        dias_semana: v.diasSemana,
        vigencia_inicio: v.vigenciaInicio,
        vigencia_fim: v.vigenciaFim || null,
        fonte: v.fonte || null,
        obs: v.obs || null,
    };
};

async function criarDimensionamento(v, ossIdFiltro) {
    await assertUnidadeNoEscopoOSS(v.unidadeId, ossIdFiltro);
    await assertSetorDaUnidade(v.setorId, v.unidadeId);
    const [{ id }] = await q('SELECT UUID() AS id');
    const c = camposDim(v);
    await db.sequelize.query(
        `INSERT INTO tb_escala_dimensionamento
        (dimensionamento_id, unidade_id, ${Object.keys(c).join(', ')})
        VALUES (:id, :unidadeId, ${Object.keys(c)
            .map((k) => {
                return `:${k}`;
            })
            .join(', ')})`,
        { replacements: { id, unidadeId: v.unidadeId, ...c } },
    );
    return buscarDimensionamento(id, ossIdFiltro);
}

async function atualizarDimensionamento(id, v, ossIdFiltro) {
    const atual = await buscarDimensionamento(id, ossIdFiltro);
    await assertSetorDaUnidade(v.setorId, atual.unidadeId);
    const c = camposDim(v);
    await db.sequelize.query(
        `UPDATE tb_escala_dimensionamento
        SET ${Object.keys(c)
            .map((k) => {
                return `${k} = :${k}`;
            })
            .join(', ')}, atualizado_em = NOW()
        WHERE dimensionamento_id = :id`,
        { replacements: { id, ...c } },
    );
    return buscarDimensionamento(id, ossIdFiltro);
}

async function removerDimensionamento(id, ossIdFiltro) {
    await buscarDimensionamento(id, ossIdFiltro);
    await db.sequelize.query(
        'UPDATE tb_escala_dimensionamento SET ativo = 0, atualizado_em = NOW() WHERE dimensionamento_id = :id',
        { replacements: { id } },
    );
    return { dimensionamentoId: id };
}

// ── Contrato × Apresentado ────────────────────────────────────────────────────

const r2 = (v) => {
    return Math.round(v * 100) / 100;
};
const duracaoTurnoH = (ini, fim) => {
    const [a, b] = janelaTurno('2026-01-01', ini, fim);
    return (b - a) / 3600000;
};

/**
 * Por linha de dimensionamento vigente × dia do mês: postos exigidos, apresentados (escalados com nome,
 * qualquer marcação de trabalho) e realizados (normal/cobertura/troca/extra), em postos-equivalentes.
 */
async function contratoApresentado({ unidadeId, mes }, ossIdFiltro) {
    await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);
    const { ini, fim, dias } = janelaMes(mes);
    const dims = (await listarDimensionamento({ unidadeId }, ossIdFiltro)).filter((d) => {
        return d.vigenciaInicio <= fim && (!d.vigenciaFim || d.vigenciaFim >= ini);
    });
    if (!dims.length) {
        return { dias, linhas: [], resumo: null };
    }

    // Pega um dia antes/depois por causa de turnos que viram o dia.
    const plantoes = await q(
        `
        SELECT p.setor_id, DATE_FORMAT(p.inicio, '%Y-%m-%dT%H:%i:%s') AS inicio,
          DATE_FORMAT(p.fim, '%Y-%m-%dT%H:%i:%s') AS fim, p.marcacao, p.modalidade,
          p.profissional_id, pr.categoria
        FROM tb_escala_plantoes p
        LEFT JOIN tb_escala_profissionais pr ON pr.profissional_id = p.profissional_id
        WHERE p.unidade_id = :unidadeId AND p.setor_id IN (:setores)
          AND p.data BETWEEN DATE_SUB(:ini, INTERVAL 1 DAY) AND DATE_ADD(:fim, INTERVAL 1 DAY)
          AND p.profissional_id IS NOT NULL AND NOT ${SQL_AUSENCIA}`,
        {
            unidadeId,
            ini,
            fim,
            setores: [
                ...new Set(
                    dims.map((d) => {
                        return d.setorId;
                    }),
                ),
            ],
        },
    );

    const resumo = {
        postosDiaExigidos: 0,
        postosDiaApresentados: 0,
        postosDiaRealizados: 0,
        horasContratadas: 0,
        horasApresentadas: 0,
        horasRealizadas: 0,
        turnosComDeficit: 0,
    };
    const linhas = dims.map((d) => {
        const doSetor = plantoes.filter((p) => {
            return p.setor_id === d.setorId && (!d.categoria || p.categoria === d.categoria);
        });
        const realizados = doSetor.filter((p) => {
            return classifica(p.marcacao, true) === 'realizado';
        });
        const horasTurno = duracaoTurnoH(d.turnoInicio, d.turnoFim);
        const tot = {
            exigidos: 0,
            apresentados: 0,
            realizados: 0,
            turnosComDeficit: 0,
        };
        const porDia = dias.map((dia) => {
            const dow = String(new Date(`${dia}T12:00:00Z`).getUTCDay() + 1);
            const vigente = d.vigenciaInicio <= dia && (!d.vigenciaFim || d.vigenciaFim >= dia);
            if (!vigente || !d.diasSemana.includes(dow)) {
                return { data: dia, exigido: 0, apresentado: null, realizado: null };
            }
            const jan = janelaTurno(dia, d.turnoInicio, d.turnoFim);
            const apresentado = postosEquivalentes(jan, doSetor);
            const realizado = postosEquivalentes(jan, realizados);
            tot.exigidos += d.qtdPostos;
            tot.apresentados += Math.min(apresentado, d.qtdPostos);
            tot.realizados += Math.min(realizado, d.qtdPostos);
            if (apresentado < d.qtdPostos) {
                tot.turnosComDeficit += 1;
            }
            return {
                data: dia,
                exigido: d.qtdPostos,
                apresentado,
                realizado,
            };
        });
        resumo.postosDiaExigidos += tot.exigidos;
        resumo.postosDiaApresentados += tot.apresentados;
        resumo.postosDiaRealizados += tot.realizados;
        resumo.horasContratadas += tot.exigidos * horasTurno;
        resumo.horasApresentadas += tot.apresentados * horasTurno;
        resumo.horasRealizadas += tot.realizados * horasTurno;
        resumo.turnosComDeficit += tot.turnosComDeficit;
        return {
            ...d,
            horasTurno,
            dias: porDia,
            totais: {
                exigidos: tot.exigidos,
                apresentados: r2(tot.apresentados),
                realizados: r2(tot.realizados),
                turnosComDeficit: tot.turnosComDeficit,
                coberturaPerc: tot.exigidos ? r2((tot.apresentados / tot.exigidos) * 100) : null,
            },
        };
    });
    Object.keys(resumo).forEach((k) => {
        resumo[k] = r2(resumo[k]);
    });
    resumo.coberturaPerc = resumo.postosDiaExigidos
        ? r2((resumo.postosDiaApresentados / resumo.postosDiaExigidos) * 100)
        : null;
    return { dias, linhas, resumo };
}

module.exports = {
    listarSetores,
    grade,
    buscarProfissionais,
    listarDimensionamento,
    criarDimensionamento,
    atualizarDimensionamento,
    removerDimensionamento,
    contratoApresentado,
};
