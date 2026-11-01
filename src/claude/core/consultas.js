// Ferramentas de banco (somente leitura). Regra de negócio vem dos services; aqui só montagem e filtro.
// Visão global: ossIdFiltro = null em todos os services.
const { z } = require('zod');
const { Sequelize, QueryTypes } = require('sequelize');
const { db } = require('./bootstrap');
const { janela, mesYmd, PERIODOS } = require('./limites');
const RelatorioCmsService = require('../../service/RelatorioCmsService');
const AcompanhamentoService = require('../../service/AcompanhamentoService');
const RecebimentoService = require('../../service/RecebimentoService');
const PonteProducaoService = require('../../service/PonteProducaoService');
const { pingProducao } = require('../../config/producaoDb');

const q = (sql, replacements = {}) => {
    return db.sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
};

// ── Resolução de contrato/unidade por apelido ──────────────────────────────
// Calibrar aqui: numeração divergente entre banco, planilhas e relatórios (ver checar_numeracao).
// Chave → sigla da unidade âncora do contrato.
const ALIAS_CONTRATO = {
    '001/2023': 'HMA',
    '009/2023': 'HMA',
    '004/2025': 'HMA',
    hma: 'HMA',
    scmc: 'HMA',
    geral: 'HMA',
    gerais: 'HMA',
    '066/2024': 'UPA-DR',
    '025/2025': 'UPA-DR',
    dona_rosa: 'UPA-DR',
    'dona rosa': 'UPA-DR',
    drosa: 'UPA-DR',
    '002/2025': 'UPA-ZAN',
    zanaga: 'UPA-ZAN',
};
const ALIAS_UNIDADE = {
    hm: 'HMA',
    hma: 'HMA',
    hospital: 'HMA',
    unacon: 'UNACON',
    cillos: 'UPA-CIL',
    upa_cillos: 'UPA-CIL',
    'upa cillos': 'UPA-CIL',
    dona_rosa: 'UPA-DR',
    'dona rosa': 'UPA-DR',
    drosa: 'UPA-DR',
    zanaga: 'UPA-ZAN',
};

async function unidadePor(ref) {
    const r = String(ref || '').trim();
    if (!r) {
        throw new Error('unidade não informada');
    }
    const sigla = ALIAS_UNIDADE[r.toLowerCase()] || r;
    const [u] = await q(
        `SELECT u.*, c.numero AS contrato_numero FROM tb_unidades u JOIN tb_contratos c USING (contrato_id)
     WHERE u.deleted_at IS NULL AND (u.unidade_id = :r OR UPPER(u.sigla) = UPPER(:s) OR u.nome LIKE :like)
     ORDER BY (u.unidade_id = :r) DESC, (UPPER(u.sigla) = UPPER(:s)) DESC LIMIT 1`,
        { r, s: sigla, like: `%${r}%` },
    );
    if (!u) {
        throw new Error(
            `unidade não encontrada: ${r}. Use sigla (HMA, UNACON, UPA-CIL, UPA-DR, UPA-ZAN) ou apelido (${Object.keys(
                ALIAS_UNIDADE,
            ).join(', ')})`,
        );
    }
    return u;
}

async function contratoPor(ref) {
    const r = String(ref || '').trim();
    if (!r) {
        throw new Error('contrato não informado');
    }
    const [direto] = await q(
        'SELECT * FROM tb_contratos WHERE deleted_at IS NULL AND (contrato_id = :r OR numero = :r) LIMIT 1',
        { r },
    );
    if (direto) {
        return direto;
    }
    const ancora = ALIAS_CONTRATO[r.toLowerCase()];
    if (ancora) {
        const [c] = await q(
            'SELECT c.* FROM tb_contratos c JOIN tb_unidades u USING (contrato_id) WHERE u.sigla = :s AND c.deleted_at IS NULL LIMIT 1',
            { s: ancora },
        );
        if (c) {
            return c;
        }
    }
    throw new Error(
        `contrato não encontrado: ${r}. Aceitos: número do banco ou apelido (${Object.keys(
            ALIAS_CONTRATO,
        ).join(', ')})`,
    );
}

/** escopo todos|contrato|unidade + id → params dos services */
async function escopoPor(escopo, id) {
    if (escopo === 'todos') {
        return { escopo: 'todos', rotulo: 'todos os contratos' };
    }
    if (escopo === 'contrato') {
        const c = await contratoPor(id);
        return { escopo, contratoId: c.contrato_id, rotulo: `contrato ${c.numero}` };
    }
    const u = await unidadePor(id);
    return { escopo: 'unidade', unidadeId: u.unidade_id, rotulo: `unidade ${u.sigla}` };
}

// ── Schemas reaproveitados ─────────────────────────────────────────────────
const ano = z.coerce.number().int().min(2000).max(2100).describe('Ano, ex. 2026');
const periodo = z
    .enum(PERIODOS)
    .describe(
        'mes | 1quad (jan–abr) | 2quad (mai–ago) | 3quad (set–dez) | trimestre | ano | acumulado',
    );
const mes = z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe('Mês final (1–12). Obrigatório para mes, trimestre e acumulado');
const escopo = z.enum(['todos', 'contrato', 'unidade']).default('todos');
const idEscopo = z
    .string()
    .optional()
    .describe(
        'Contrato (número ou apelido: 001/2023, dona_rosa, zanaga) ou unidade (HMA, UNACON, UPA-CIL, UPA-DR, UPA-ZAN)',
    );
const contrato = z
    .string()
    .describe(
        'Contrato: número do banco (009/2023, 066/2024, 002/2025) ou apelido (001/2023, dona_rosa, zanaga)',
    );
const ym = z
    .string()
    .regex(/^\d{4}-?\d{2}$/)
    .describe('AAAA-MM');
const data = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('AAAA-MM-DD');

const n = (v) => {
    return v == null ? null : Number(v);
};

// ── Desempenho: base comum ────────────────────────────────────────────────
const COLS_CUMPRIMENTO = [
    ['unidade', 'Unidade'],
    ['codigo', 'Código'],
    ['nome', 'Indicador'],
    ['tipo', 'Tipo'],
    ['unidadeMedida', 'Unid. medida'],
    ['metaPeriodo', 'Meta período', 'num'],
    ['realizadoAcum', 'Realizado', 'num'],
    ['percentual', '% cumprimento', 'pct'],
    ['status', 'Status'],
    ['mesesComLancamento', 'Meses lançados', 'num'],
];

async function cumprimento({ ano: a, periodo: p, mes: m, escopo: e, id }) {
    const j = janela(a, p, m);
    const esc = await escopoPor(e, id);
    const r = await RelatorioCmsService.gerar(
        {
            mes: j.mes,
            periodo: j.periodo,
            escopo: esc.escopo,
            contratoId: esc.contratoId,
            unidadeId: esc.unidadeId,
        },
        null,
    );
    const linhas = [];
    for (const c of r.contratos) {
        for (const u of c.unidades) {
            for (const l of [...u.quantitativos, ...u.qualitativos]) {
                linhas.push({ contrato: c.numero, unidade: u.sigla || u.nome, ...l });
            }
        }
    }
    return { j, esc, r, linhas };
}

const desvio = (l) => {
    return l.percentual == null ? -1 : Math.abs(l.percentual - 100);
};

// ── Ferramentas ───────────────────────────────────────────────────────────
const ferramentas = [
    {
        nome: 'listar_contratos',
        descricao:
            'Lista os contratos de gestão (OSS, número, vigência, valor mensal base, % fixo/variável, modelo de desconto, aditivos, unidades). Use primeiro para descobrir números e apelidos.',
        schema: { ativo: z.boolean().optional().describe('true = só ativos') },
        async executar({ ativo }) {
            const linhas = await q(
                `SELECT c.contrato_id, c.numero, o.nome AS oss, c.tipo, c.data_inicio, c.data_fim, c.valor_mensal_base, c.perc_fixo,
                c.perc_variavel, c.modelo_desconto_qual, c.numero_aditivos, c.status,
                GROUP_CONCAT(u.sigla ORDER BY u.sigla SEPARATOR ', ') AS unidades
         FROM tb_contratos c JOIN tb_oss o USING (oss_id) LEFT JOIN tb_unidades u ON u.contrato_id = c.contrato_id AND u.deleted_at IS NULL
         WHERE c.deleted_at IS NULL ${ativo ? "AND c.status = 'Ativo'" : ''}
         GROUP BY c.contrato_id ORDER BY c.numero`,
            );
            return {
                titulo: 'Contratos de gestão',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['numero', 'Contrato'],
                            ['oss', 'OSS'],
                            ['unidades', 'Unidades'],
                            ['data_inicio', 'Início'],
                            ['data_fim', 'Fim'],
                            ['valor_mensal_base', 'Valor mensal base', 'moeda'],
                            ['perc_fixo', '% fixo', 'pct'],
                            ['perc_variavel', '% variável', 'pct'],
                            ['modelo_desconto_qual', 'Modelo desconto'],
                            ['numero_aditivos', 'Aditivos', 'num'],
                            ['status', 'Status'],
                        ],
                        linhas,
                    },
                ],
                notas: [
                    `Apelidos aceitos em "contrato": ${Object.keys(ALIAS_CONTRATO).join(', ')}.`,
                ],
            };
        },
    },
    {
        nome: 'detalhar_contrato',
        descricao:
            'Detalha um contrato: dados, aditivos, histórico de vigências (valores, % e regra de recebimento) e rubricas financeiras.',
        schema: { contrato },
        async executar({ contrato: ref }) {
            const c = await contratoPor(ref);
            const [aditivos, historico, rubricas, unidades] = await Promise.all([
                q(
                    `SELECT numero_aditivo, tipo_aditivo, data_assinatura, data_vigencia_inicio, nova_data_fim, valor_anterior,
                  novo_valor_mensal, ipca_aplicado, aplicado, descricao_sumaria
           FROM tb_aditivos WHERE contrato_id = :id ORDER BY numero_aditivo`,
                    { id: c.contrato_id },
                ),
                q(
                    `SELECT versao, vigencia_inicio, vigencia_fim, valor_mensal_base, perc_fixo, perc_variavel, modelo_desconto_qual,
                  motivo_versao, regra_recebimento
           FROM tb_historico_contrato WHERE contrato_id = :id ORDER BY versao`,
                    { id: c.contrato_id },
                ),
                q(
                    'SELECT codigo, nome, nivel, ativo FROM tb_rubricas WHERE contrato_id = :id ORDER BY codigo',
                    { id: c.contrato_id },
                ),
                q(
                    'SELECT sigla, nome, tipo, cnes, valor_mensal_unidade, ativa FROM tb_unidades WHERE contrato_id = :id AND deleted_at IS NULL ORDER BY sigla',
                    { id: c.contrato_id },
                ),
            ]);
            return {
                titulo: `Contrato ${c.numero}`,
                dados: { contrato: c, unidades, aditivos, historico, rubricas },
                tabelas: [
                    {
                        titulo: 'Dados',
                        colunas: [
                            ['numero', 'Contrato'],
                            ['tipo', 'Tipo'],
                            ['data_inicio', 'Início'],
                            ['data_fim', 'Fim'],
                            ['valor_mensal_base', 'Valor mensal', 'moeda'],
                            ['valor_anual', 'Valor anual', 'moeda'],
                            ['perc_fixo', '% fixo', 'pct'],
                            ['perc_variavel', '% variável', 'pct'],
                            ['status', 'Status'],
                        ],
                        linhas: [c],
                    },
                    {
                        titulo: 'Unidades',
                        colunas: [
                            ['sigla', 'Sigla'],
                            ['nome', 'Nome'],
                            ['cnes', 'CNES'],
                            ['valor_mensal_unidade', 'Valor mensal', 'moeda'],
                        ],
                        linhas: unidades,
                    },
                    {
                        titulo: 'Aditivos',
                        colunas: [
                            ['numero_aditivo', 'Nº'],
                            ['tipo_aditivo', 'Tipo'],
                            ['data_assinatura', 'Assinatura'],
                            ['data_vigencia_inicio', 'Vigência'],
                            ['valor_anterior', 'Valor anterior', 'moeda'],
                            ['novo_valor_mensal', 'Novo valor', 'moeda'],
                            ['descricao_sumaria', 'Descrição'],
                        ],
                        linhas: aditivos,
                    },
                    {
                        titulo: 'Histórico de vigências',
                        colunas: [
                            ['versao', 'Versão'],
                            ['vigencia_inicio', 'Início'],
                            ['vigencia_fim', 'Fim'],
                            ['valor_mensal_base', 'Valor mensal', 'moeda'],
                            ['perc_fixo', '% fixo', 'pct'],
                            ['perc_variavel', '% variável', 'pct'],
                            ['motivo_versao', 'Motivo'],
                        ],
                        linhas: historico,
                    },
                    {
                        titulo: 'Rubricas',
                        colunas: [
                            ['codigo', 'Código'],
                            ['nome', 'Rubrica'],
                            ['nivel', 'Nível'],
                        ],
                        linhas: rubricas,
                    },
                ],
            };
        },
    },
    {
        nome: 'listar_unidades',
        descricao:
            'Lista as unidades (nome, sigla, CNES, contrato). Use para achar a sigla aceita nas outras ferramentas.',
        schema: { contrato: contrato.optional() },
        async executar({ contrato: ref }) {
            const c = ref ? await contratoPor(ref) : null;
            const linhas = await q(
                `SELECT u.sigla, u.nome, u.tipo, u.cnes, c.numero AS contrato, u.valor_mensal_unidade, u.ativa
         FROM tb_unidades u JOIN tb_contratos c USING (contrato_id)
         WHERE u.deleted_at IS NULL ${
             c ? 'AND u.contrato_id = :id' : ''
         } ORDER BY c.numero, u.sigla`,
                { id: c && c.contrato_id },
            );
            return {
                titulo: 'Unidades',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['sigla', 'Sigla'],
                            ['nome', 'Unidade'],
                            ['tipo', 'Tipo'],
                            ['cnes', 'CNES'],
                            ['contrato', 'Contrato'],
                            ['valor_mensal_unidade', 'Valor mensal', 'moeda'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'listar_indicadores',
        descricao:
            'Lista indicadores com bloco, peso, meta vigente, direção (maior_igual/menor_igual) e faixas parcial/mínima.',
        schema: {
            unidade: z.string().optional(),
            contrato: contrato.optional(),
            tipo: z.enum(['quantitativo', 'qualitativo']).optional(),
            inativos: z.boolean().optional().describe('true = inclui inativos'),
        },
        async executar(p) {
            const u = p.unidade ? await unidadePor(p.unidade) : null;
            const c = p.contrato ? await contratoPor(p.contrato) : null;
            const linhas = await q(
                `SELECT u.sigla AS unidade, i.codigo, i.nome, i.tipo, i.grupo, b.nome AS bloco, i.peso_perc,
                COALESCE(m.meta_tipo, i.meta_tipo) AS direcao, m.meta_mensal, m.meta_anual, m.meta_valor_qualit,
                m.meta_parcial, m.meta_minima, COALESCE(m.unidade_medida, i.unidade_medida) AS unidade_medida,
                m.vigencia_inicio, i.obrigatorio, i.ativo
         FROM tb_indicadores i
         JOIN tb_unidades u ON u.unidade_id = i.unidade_id
         LEFT JOIN tb_blocos_producao b ON b.bloco_id = i.bloco_id
         LEFT JOIN tb_metas m ON m.meta_id = (
           SELECT m2.meta_id FROM tb_metas m2 WHERE m2.indicador_id = i.indicador_id AND (m2.papel IS NULL OR m2.papel <> 'agregada')
           ORDER BY m2.versao DESC LIMIT 1)
         WHERE i.deleted_at IS NULL ${p.inativos ? '' : 'AND i.ativo = 1'}
           ${u ? 'AND i.unidade_id = :uid' : ''} ${c ? 'AND u.contrato_id = :cid' : ''} ${
                    p.tipo ? 'AND i.tipo = :tipo' : ''
                }
         ORDER BY u.sigla, i.tipo, i.codigo`,
                { uid: u && u.unidade_id, cid: c && c.contrato_id, tipo: p.tipo },
            );
            return {
                titulo: 'Indicadores',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['unidade', 'Unidade'],
                            ['codigo', 'Código'],
                            ['nome', 'Indicador'],
                            ['tipo', 'Tipo'],
                            ['bloco', 'Bloco'],
                            ['peso_perc', 'Peso', 'pct'],
                            ['direcao', 'Direção'],
                            ['meta_mensal', 'Meta mensal', 'num'],
                            ['meta_valor_qualit', 'Meta qualit.', 'num'],
                            ['meta_parcial', 'Faixa parcial', 'num'],
                            ['meta_minima', 'Faixa mínima', 'num'],
                            ['unidade_medida', 'Unid. medida'],
                        ],
                        linhas,
                    },
                ],
                notas: [
                    'Faixas em % da meta (defaults 100/85 para maior_igual e 100/115 para menor_igual). Regra: src/helper/avaliacaoCumprimento.js.',
                ],
            };
        },
    },
    {
        nome: 'cumprimento_metas',
        descricao:
            'Cumprimento de metas no período (mesmos números do Relatório CMS da tela): meta do período, realizado, % e status por indicador, com resumo. Base dos relatórios quadrimestrais.',
        schema: { ano, periodo, mes, escopo, id: idEscopo },
        async executar(p) {
            const { j, esc, r, linhas } = await cumprimento(p);
            return {
                titulo: `Cumprimento de metas: ${esc.rotulo}, ${j.rotulo}`,
                dados: { janela: r.janela, resumo: r.resumo, contratos: r.contratos },
                tabelas: [
                    {
                        titulo: 'Resumo',
                        colunas: [
                            ['cumpridos', 'Cumpridos', 'num'],
                            ['parciais', 'Parciais', 'num'],
                            ['naoCumpridos', 'Não cumpridos', 'num'],
                            ['aguardando', 'Aguardando', 'num'],
                            ['total', 'Total', 'num'],
                        ],
                        linhas: [r.resumo],
                    },
                    { titulo: 'Indicadores', colunas: COLS_CUMPRIMENTO, linhas },
                ],
            };
        },
    },
    {
        nome: 'nao_cumpridos',
        descricao:
            'Só os indicadores parciais e não cumpridos do período, ordenados pelo maior desvio em relação a 100%.',
        schema: { ano, periodo, mes, escopo, id: idEscopo },
        async executar(p) {
            const { j, esc, linhas } = await cumprimento(p);
            const filtradas = linhas
                .filter((l) => {
                    return ['parcial', 'nao_cumprido'].includes(l.status);
                })
                .map((l) => {
                    return {
                        ...l,
                        desvio:
                            l.percentual == null ? null : Number((l.percentual - 100).toFixed(1)),
                    };
                })
                .sort((a, b) => {
                    return desvio(b) - desvio(a);
                });
            return {
                titulo: `Indicadores não cumpridos/parciais: ${esc.rotulo}, ${j.rotulo}`,
                dados: filtradas,
                tabelas: [
                    {
                        colunas: [
                            ...COLS_CUMPRIMENTO.slice(0, 9),
                            ['desvio', 'Desvio (p.p.)', 'num'],
                        ],
                        linhas: filtradas,
                    },
                ],
            };
        },
    },
    {
        nome: 'comparar_periodos',
        descricao:
            'Compara dois períodos (ex. 2º quad 2025 × 2º quad 2026): realizado, % de cumprimento e variação por indicador.',
        schema: {
            escopo,
            id: idEscopo,
            periodo_a: z.object({ ano, periodo, mes }).describe('Período base'),
            periodo_b: z.object({ ano, periodo, mes }).describe('Período comparado'),
        },
        async executar(p) {
            const A = await cumprimento({ ...p.periodo_a, escopo: p.escopo, id: p.id });
            const B = await cumprimento({ ...p.periodo_b, escopo: p.escopo, id: p.id });
            const porId = new Map(
                A.linhas.map((l) => {
                    return [l.indicadorId, l];
                }),
            );
            const linhas = B.linhas.map((b) => {
                const a = porId.get(b.indicadorId) || {};
                const varAbs =
                    a.realizadoAcum != null && b.realizadoAcum != null
                        ? b.realizadoAcum - a.realizadoAcum
                        : null;
                return {
                    unidade: b.unidade,
                    codigo: b.codigo,
                    nome: b.nome,
                    realizado_a: a.realizadoAcum,
                    realizado_b: b.realizadoAcum,
                    variacao: varAbs,
                    variacao_perc:
                        varAbs != null && a.realizadoAcum ? (varAbs / a.realizadoAcum) * 100 : null,
                    pct_a: a.percentual,
                    pct_b: b.percentual,
                    status_a: a.status,
                    status_b: b.status,
                };
            });
            return {
                titulo: `Comparação: ${A.j.rotulo} × ${B.j.rotulo} (${B.esc.rotulo})`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['unidade', 'Unidade'],
                            ['codigo', 'Código'],
                            ['nome', 'Indicador'],
                            ['realizado_a', `Realizado ${A.j.rotulo}`, 'num'],
                            ['realizado_b', `Realizado ${B.j.rotulo}`, 'num'],
                            ['variacao', 'Variação', 'num'],
                            ['variacao_perc', 'Variação %', 'pct'],
                            ['pct_a', '% cump. A', 'pct'],
                            ['pct_b', '% cump. B', 'pct'],
                            ['status_a', 'Status A'],
                            ['status_b', 'Status B'],
                        ],
                        linhas,
                    },
                ],
                notas: [
                    'Indicadores que existem só no período A não aparecem (a base é o conjunto vigente em B).',
                ],
            };
        },
    },
    {
        nome: 'serie_indicador',
        descricao:
            'Série mensal (realizado, meta, % e status) de um indicador ou de todos os indicadores de uma unidade, entre dois meses (máx. 24).',
        schema: {
            unidade: z.string().optional(),
            indicador: z.string().optional().describe('Código ou parte do nome do indicador'),
            de: ym,
            ate: ym,
        },
        async executar(p) {
            let u;
            let filtro = null;
            if (p.indicador) {
                const [ind] = await q(
                    `SELECT i.indicador_id, i.unidade_id FROM tb_indicadores i JOIN tb_unidades u USING (unidade_id)
           WHERE i.ativo = 1 AND (i.codigo = :r OR i.nome LIKE :like) ${
               p.unidade ? 'AND (u.sigla = :s OR u.unidade_id = :s)' : ''
           } LIMIT 1`,
                    {
                        r: p.indicador,
                        like: `%${p.indicador}%`,
                        s: p.unidade ? (await unidadePor(p.unidade)).sigla : null,
                    },
                );
                if (!ind) {
                    throw new Error(`indicador não encontrado: ${p.indicador}`);
                }
                filtro = ind.indicador_id;
                u = await unidadePor(ind.unidade_id);
            } else {
                u = await unidadePor(p.unidade);
            }
            const meses = [];
            for (
                let d = new Date(`${mesYmd(p.de)}T00:00:00Z`),
                    fim = new Date(`${mesYmd(p.ate)}T00:00:00Z`);
                d <= fim;
                d.setUTCMonth(d.getUTCMonth() + 1)
            ) {
                meses.push(d.toISOString().slice(0, 10));
            }
            if (meses.length > 24) {
                throw new Error('intervalo máximo: 24 meses');
            }
            const linhas = [];
            for (const m of meses) {
                // eslint-disable-next-line no-await-in-loop
                const r = await RelatorioCmsService.gerar(
                    { mes: m, periodo: 'mes', escopo: 'unidade', unidadeId: u.unidade_id },
                    null,
                );
                for (const c of r.contratos) {
                    for (const un of c.unidades) {
                        for (const l of [...un.quantitativos, ...un.qualitativos]) {
                            if (!filtro || l.indicadorId === filtro) {
                                linhas.push({ mes: m.slice(0, 7), ...l });
                            }
                        }
                    }
                }
            }
            return {
                titulo: `Série mensal: ${u.sigla}, ${p.de} a ${p.ate}`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['mes', 'Mês'],
                            ['codigo', 'Código'],
                            ['nome', 'Indicador'],
                            ['metaPeriodo', 'Meta', 'num'],
                            ['realizadoAcum', 'Realizado', 'num'],
                            ['percentual', '%', 'pct'],
                            ['status', 'Status'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'notas_explicativas',
        descricao:
            'Notas explicativas das OSS vinculadas aos lançamentos (causa raiz, ação corretiva, previsão de normalização, validação).',
        schema: { unidade: z.string().optional(), de: ym, ate: ym },
        async executar(p) {
            const u = p.unidade ? await unidadePor(p.unidade) : null;
            const linhas = await q(
                `SELECT DATE_FORMAT(a.mes_referencia, '%Y-%m') AS mes, un.sigla AS unidade, i.codigo, i.nome AS indicador,
                n.descricao, n.causa_raiz, n.acao_corretiva, n.previsao_normalizacao, n.status_validacao, n.alcance_considerado
         FROM tb_notas_explicativas n
         JOIN tb_acompanhamento_mensal a ON a.acomp_id = n.acomp_id
         JOIN tb_indicadores i ON i.indicador_id = a.indicador_id
         JOIN tb_unidades un ON un.unidade_id = i.unidade_id
         WHERE a.mes_referencia BETWEEN :de AND :ate ${u ? 'AND un.unidade_id = :uid' : ''}
         ORDER BY a.mes_referencia, un.sigla, i.codigo`,
                { de: mesYmd(p.de), ate: mesYmd(p.ate), uid: u && u.unidade_id },
            );
            return {
                titulo: `Notas explicativas ${p.de} a ${p.ate}${u ? ` (${u.sigla})` : ''}`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['mes', 'Mês'],
                            ['unidade', 'Unidade'],
                            ['codigo', 'Código'],
                            ['indicador', 'Indicador'],
                            ['descricao', 'Descrição'],
                            ['causa_raiz', 'Causa raiz'],
                            ['acao_corretiva', 'Ação corretiva'],
                            ['previsao_normalizacao', 'Previsão'],
                            ['status_validacao', 'Validação'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'pendencias_lancamento',
        descricao: 'Indicadores ativos e obrigatórios sem valor lançado ou sem aprovação no mês.',
        schema: { ano, mes: z.coerce.number().int().min(1).max(12) },
        async executar(p) {
            const ref = `${p.ano}-${String(p.mes).padStart(2, '0')}-01`;
            const linhas = await q(
                `SELECT u.sigla AS unidade, i.codigo, i.nome AS indicador, i.tipo,
                CASE WHEN a.acomp_id IS NULL THEN 'sem lançamento' WHEN a.valor_realizado IS NULL THEN 'sem valor'
                     ELSE CONCAT('não aprovado (', a.status_aprovacao, ')') END AS pendencia
         FROM tb_indicadores i
         JOIN tb_unidades u ON u.unidade_id = i.unidade_id
         LEFT JOIN tb_acompanhamento_mensal a ON a.indicador_id = i.indicador_id AND a.mes_referencia = :ref
         WHERE i.ativo = 1 AND i.obrigatorio = 1 AND i.deleted_at IS NULL
           AND (i.vigencia_inicio IS NULL OR i.vigencia_inicio <= :ref) AND (i.vigencia_fim IS NULL OR i.vigencia_fim >= :ref)
           AND (a.acomp_id IS NULL OR a.valor_realizado IS NULL OR a.status_aprovacao <> 'aprovado')
         ORDER BY u.sigla, i.codigo`,
                { ref },
            );
            return {
                titulo: `Pendências de lançamento ${String(p.mes).padStart(2, '0')}/${p.ano}`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['unidade', 'Unidade'],
                            ['codigo', 'Código'],
                            ['indicador', 'Indicador'],
                            ['tipo', 'Tipo'],
                            ['pendencia', 'Pendência'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'repasse_descontos',
        descricao:
            'Repasse base, parcelas fixa/variável, descontos por bloco e por indicador e valor final, mês a mês no período.',
        schema: { contrato, ano, periodo, mes },
        async executar(p) {
            const c = await contratoPor(p.contrato);
            const j = janela(p.ano, p.periodo, p.mes);
            const meses = [];
            for (
                let d = new Date(`${j.inicio}T00:00:00Z`);
                d.toISOString().slice(0, 10) <= j.fim;
                d.setUTCMonth(d.getUTCMonth() + 1)
            ) {
                meses.push(d.toISOString().slice(0, 10));
            }
            const repasses = [];
            const descontos = [];
            const semDados = [];
            for (const m of meses) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const r = (
                        await AcompanhamentoService.calcularRepasse(m, c.contrato_id, null)
                    ).toJSON();
                    repasses.push({ mes: m.slice(0, 7), ...r });
                    for (const d of r.descontos_bloco || []) {
                        descontos.push({
                            mes: m.slice(0, 7),
                            nivel: 'bloco',
                            item: d.bloco && d.bloco.nome,
                            valor: n(d.valor_desconto ?? d.valor),
                        });
                    }
                    for (const d of r.descontos_indicador || []) {
                        descontos.push({
                            mes: m.slice(0, 7),
                            nivel: 'indicador',
                            item: d.indicador && d.indicador.nome,
                            valor: n(d.valor_desconto ?? d.valor),
                        });
                    }
                } catch (e) {
                    if (e.statusCode === 404) {
                        semDados.push(m.slice(0, 7));
                    } else {
                        throw e;
                    }
                }
            }
            const notas = semDados.length
                ? [
                      `Sem repasse calculado em tb_repasse_mensal para: ${semDados.join(
                          ', ',
                      )}. O cálculo roda no 6º dia útil (cron) ou pela tela de descontos.`,
                  ]
                : [];
            return {
                titulo: `Repasse e descontos: contrato ${c.numero}, ${j.rotulo}`,
                dados: { repasses, descontos },
                tabelas: [
                    {
                        titulo: 'Repasse mensal',
                        colunas: [
                            ['mes', 'Mês'],
                            ['valor_mensal_base', 'Base', 'moeda'],
                            ['parcela_fixa', 'Fixa', 'moeda'],
                            ['parcela_variavel', 'Variável', 'moeda'],
                            ['desconto_producao_total', 'Desc. produção', 'moeda'],
                            ['desconto_qualidade_total', 'Desc. qualidade', 'moeda'],
                            ['desconto_total', 'Desc. total', 'moeda'],
                            ['repasse_final', 'Repasse final', 'moeda'],
                            ['status', 'Status'],
                        ],
                        linhas: repasses,
                    },
                    {
                        titulo: 'Descontos',
                        colunas: [
                            ['mes', 'Mês'],
                            ['nivel', 'Nível'],
                            ['item', 'Bloco/indicador'],
                            ['valor', 'Valor', 'moeda'],
                        ],
                        linhas: descontos,
                    },
                ],
                notas,
            };
        },
    },
    {
        nome: 'percentual_recebimento',
        descricao:
            'Percentual de recebimento pela regra de grupos vigente no período (RecebimentoService), por contrato ou unidade. Calcula no mês final do período.',
        schema: { contrato, ano, periodo, mes, unidade: z.string().optional() },
        async executar(p) {
            const c = await contratoPor(p.contrato);
            const j = janela(p.ano, p.periodo, p.mes);
            const u = p.unidade ? await unidadePor(p.unidade) : null;
            const r = await RecebimentoService.calcularRecebimento(
                c.contrato_id,
                j.fim.slice(0, 7),
                null,
                u && u.unidade_id,
            );
            const tabelas = [
                {
                    titulo: 'Parcelas',
                    colunas: [
                        ['valor_mensal_base', 'Base', 'moeda'],
                        ['parcela_fixa', 'Fixa', 'moeda'],
                        ['parcela_variavel', 'Variável', 'moeda'],
                        ['modelo', 'Modelo'],
                        ['pontuacao', 'Pontuação'],
                        ['pendentes', 'Pendentes', 'num'],
                    ],
                    linhas: [r],
                },
                {
                    titulo: 'Grupos',
                    colunas: [
                        ['codigo', 'Bloco'],
                        ['nome', 'Grupo'],
                        ['peso', 'Peso', 'pct'],
                        ['fator_apurado', 'Fator apurado', 'num'],
                        ['fator_comissao', 'Fator após comissão', 'num'],
                        ['pendente', 'Pendente'],
                    ],
                    linhas: r.grupos || [],
                },
                {
                    titulo: 'Indicadores',
                    colunas: [
                        ['grupo', 'Grupo'],
                        ['codigo', 'Código'],
                        ['nome', 'Indicador'],
                        ['base', 'Base', 'num'],
                        ['realizado', 'Realizado', 'num'],
                        ['status_aprovacao', 'Aprovação'],
                    ],
                    linhas: (r.grupos || []).flatMap((g) => {
                        return (g.linhas || []).map((l) => {
                            return { grupo: g.nome, ...l };
                        });
                    }),
                },
            ];
            return {
                titulo: `Percentual de recebimento: contrato ${r.numero}${
                    u ? ` / ${u.sigla}` : ''
                }, ${j.fim.slice(0, 7)}`,
                dados: r,
                tabelas,
            };
        },
    },
    {
        nome: 'execucao_financeira',
        descricao:
            'Receitas e despesas por rubrica (orçado × realizado) somadas no período, de tb_execucao_financeira.',
        schema: {
            contrato,
            ano,
            periodo,
            mes,
            unidade: z.string().optional().describe('Ignorado: rubricas são por contrato'),
        },
        async executar(p) {
            const c = await contratoPor(p.contrato);
            const j = janela(p.ano, p.periodo, p.mes);
            const linhas = await q(
                `SELECT r.codigo, r.nome AS rubrica, r.nivel, SUM(e.valor_orcado) AS orcado, SUM(e.valor_realizado) AS realizado,
                SUM(e.valor_realizado) - SUM(e.valor_orcado) AS variacao
         FROM tb_execucao_financeira e JOIN tb_rubricas r USING (rubrica_id)
         WHERE r.contrato_id = :id AND e.mes_referencia BETWEEN :ini AND :fim
         GROUP BY r.rubrica_id ORDER BY r.codigo`,
                { id: c.contrato_id, ini: j.inicio, fim: j.fim },
            );
            return {
                titulo: `Execução financeira: contrato ${c.numero}, ${j.rotulo}`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['codigo', 'Código'],
                            ['rubrica', 'Rubrica'],
                            ['orcado', 'Orçado', 'moeda'],
                            ['realizado', 'Realizado', 'moeda'],
                            ['variacao', 'Variação', 'moeda'],
                        ],
                        linhas,
                    },
                ],
                notas: linhas.length
                    ? p.unidade
                        ? ['Rubricas são por contrato; o filtro de unidade foi ignorado.']
                        : []
                    : ['Sem dados em tb_execucao_financeira para o período.'],
            };
        },
    },
    {
        nome: 'ponte_producao',
        descricao:
            'Ponte de produção: valor informado pela OSS × produção registrada no SIA/SIH (banco producao), diferença e divergência % por indicador mapeado. Use competencia (AAAAMM) ou ano+periodo.',
        schema: {
            unidade: z.string(),
            competencia: z
                .string()
                .regex(/^\d{6}$/)
                .optional()
                .describe('AAAAMM'),
            ano: ano.optional(),
            periodo: periodo.optional(),
            mes,
        },
        async executar(p) {
            const u = await unidadePor(p.unidade);
            if (!(await pingProducao())) {
                throw new Error('banco producao indisponível (consultaprod fora do ar)');
            }
            let linhas;
            let rotulo;
            if (p.competencia) {
                const r = await PonteProducaoService.comparar(
                    { unidadeId: u.unidade_id, competencia: p.competencia },
                    null,
                );
                linhas = r.linhas;
                rotulo = p.competencia;
            } else {
                if (!p.ano || !p.periodo) {
                    throw new Error('informe competencia (AAAAMM) ou ano + periodo');
                }
                const j = janela(p.ano, p.periodo, p.mes);
                const r = await PonteProducaoService.compararPeriodo(
                    { mes: j.mes, periodo: j.periodo, escopo: 'unidade', unidadeId: u.unidade_id },
                    null,
                );
                linhas = (r.contratos || []).flatMap((c) => {
                    return c.unidades.flatMap((un) => {
                        return un.linhas || [];
                    });
                });
                rotulo = j.rotulo;
            }
            return {
                titulo: `Ponte de produção: ${u.sigla}, ${rotulo}`,
                fonte: 'sistema OSS (informado) e banco producao SIA/SIH (registrado)',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['nome', 'Indicador'],
                            ['unidadeMedida', 'Unid.'],
                            ['informado', 'Informado', 'num'],
                            ['registrado', 'Registrado SIA/SIH', 'num'],
                            ['diferenca', 'Diferença', 'num'],
                            ['divergenciaPerc', 'Divergência', 'pct'],
                            ['semMapeamento', 'Sem mapeamento'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'producao_sigtap',
        descricao:
            'Quantidade apresentada no SIA ou SIH por competência para um código SIGTAP (2=grupo, 4=subgrupo, 6=forma, 10=procedimento). Para indicadores ainda sem mapeamento.',
        schema: {
            unidade: z.string().optional(),
            cnes: z
                .string()
                .regex(/^\d{7}$/)
                .optional(),
            de: ym,
            ate: ym,
            codigo: z.string().regex(/^(\d{2}|\d{4}|\d{6}|\d{10})$/),
            fonte: z.enum(['sia', 'sih']).default('sia'),
            cbo: z
                .string()
                .regex(/^(\d{4}|\d{6})$/)
                .optional(),
        },
        async executar(p) {
            const cnes = p.cnes || (p.unidade && (await unidadePor(p.unidade)).cnes);
            if (!cnes) {
                throw new Error('informe unidade (com CNES cadastrado) ou cnes');
            }
            if (!(await pingProducao())) {
                throw new Error('banco producao indisponível (consultaprod fora do ar)');
            }
            const tipo = { 2: 'grupo', 4: 'subgrupo', 6: 'forma', 10: 'procedimento' }[
                p.codigo.length
            ];
            const linhas = [];
            for (
                let d = new Date(`${mesYmd(p.de)}T00:00:00Z`),
                    fim = new Date(`${mesYmd(p.ate)}T00:00:00Z`);
                d <= fim;
                d.setUTCMonth(d.getUTCMonth() + 1)
            ) {
                const cmp = d.toISOString().slice(0, 7).replace('-', '');
                // eslint-disable-next-line no-await-in-loop
                linhas.push({
                    competencia: cmp,
                    quantidade: await PonteProducaoService.somaProducaoFiltro(
                        cnes,
                        cmp,
                        cmp,
                        p.fonte,
                        tipo,
                        p.codigo,
                        p.cbo || null,
                    ),
                });
                if (linhas.length > 36) {
                    throw new Error('intervalo máximo: 36 competências');
                }
            }
            return {
                titulo: `Produção ${p.fonte.toUpperCase()} ${tipo} ${p.codigo}, CNES ${cnes}`,
                fonte: `banco producao (${p.fonte.toUpperCase()}, quantidade apresentada)`,
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['competencia', 'Competência'],
                            ['quantidade', 'Quantidade', 'num'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'efetivo_escalas',
        descricao:
            'Força de trabalho pelas escalas: profissionais distintos, plantões e horas por unidade e agrupamento. Sem nomes por padrão (LGPD); identificar=true lista por profissional e fica registrado no log.',
        schema: {
            unidade: z.string().optional(),
            de: data,
            ate: data,
            agrupar: z.enum(['setor', 'categoria', 'dia', 'turno']).default('categoria'),
            identificar: z.boolean().default(false),
        },
        async executar(p) {
            const u = p.unidade ? await unidadePor(p.unidade) : null;
            const chave = {
                setor: 'setor',
                categoria: 'categoria',
                dia: 'data',
                turno: 'TIME(inicio)',
            }[p.agrupar];
            const pessoa = p.identificar ? ', profissional, conselho, registro_numero' : '';
            const linhas = await q(
                `SELECT unidade, ${chave} AS grupo${pessoa}, COUNT(DISTINCT profissional_id) AS profissionais, COUNT(*) AS plantoes, SUM(horas) AS horas
         FROM vw_escala_realizados
         WHERE data BETWEEN :de AND :ate ${u ? 'AND unidade_id = :uid' : ''}
         GROUP BY unidade, ${chave}${p.identificar ? ', profissional_id' : ''}
         ORDER BY unidade, grupo${p.identificar ? ', profissional' : ''}`,
                { de: p.de, ate: p.ate, uid: u && u.unidade_id },
            );
            const colunas = [
                ['unidade', 'Unidade'],
                ['grupo', p.agrupar[0].toUpperCase() + p.agrupar.slice(1)],
            ];
            if (p.identificar) {
                colunas.push(
                    ['profissional', 'Profissional'],
                    ['conselho', 'Conselho'],
                    ['registro_numero', 'Registro'],
                );
            }
            colunas.push(
                ['profissionais', 'Profissionais', 'num'],
                ['plantoes', 'Plantões', 'num'],
                ['horas', 'Horas', 'num'],
            );
            return {
                titulo: `Efetivo nas escalas ${p.de} a ${p.ate}${u ? ` (${u.sigla})` : ''}, por ${
                    p.agrupar
                }`,
                fonte: 'escalas das prestações de contas (vw_escala_realizados: exclui riscado, falta, férias e folga)',
                dados: linhas,
                tabelas: [{ colunas, linhas }],
            };
        },
    },
    {
        nome: 'cobertura_plantao',
        descricao:
            'Quantos profissionais estavam de plantão num instante, por setor e categoria. Nomes só com identificar=true (registrado no log).',
        schema: {
            unidade: z.string(),
            data_hora: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/)
                .describe('AAAA-MM-DD HH:MM'),
            identificar: z.boolean().default(false),
        },
        async executar(p) {
            const u = await unidadePor(p.unidade);
            const t = p.data_hora.replace('T', ' ');
            const linhas = p.identificar
                ? await q(
                      `SELECT setor, categoria, profissional, conselho, registro_numero, modalidade, inicio, fim
                   FROM vw_escala_realizados WHERE unidade_id = :uid AND inicio <= :t AND fim > :t ORDER BY setor, categoria, profissional`,
                      { uid: u.unidade_id, t },
                  )
                : await q(
                      `SELECT setor, categoria, modalidade, COUNT(DISTINCT profissional_id) AS profissionais
                   FROM vw_escala_realizados WHERE unidade_id = :uid AND inicio <= :t AND fim > :t
                   GROUP BY setor, categoria, modalidade ORDER BY setor, categoria`,
                      { uid: u.unidade_id, t },
                  );
            const colunas = p.identificar
                ? [
                      ['setor', 'Setor'],
                      ['categoria', 'Categoria'],
                      ['profissional', 'Profissional'],
                      ['conselho', 'Conselho'],
                      ['registro_numero', 'Registro'],
                      ['modalidade', 'Modalidade'],
                      ['inicio', 'Início'],
                      ['fim', 'Fim'],
                  ]
                : [
                      ['setor', 'Setor'],
                      ['categoria', 'Categoria'],
                      ['modalidade', 'Modalidade'],
                      ['profissionais', 'Profissionais', 'num'],
                  ];
            return {
                titulo: `Cobertura de plantão: ${u.sigla}, ${t}`,
                fonte: 'escalas das prestações de contas',
                dados: linhas,
                tabelas: [{ colunas, linhas }],
            };
        },
    },
    {
        nome: 'consulta_sql',
        descricao:
            'SELECT livre e somente leitura nos bancos oss e producao (usuário sem acesso a escalas nominais, usuários e auditoria). Use quando nenhuma ferramenta dedicada atende. Uma instrução por chamada; 30 s de limite; até 500 linhas.',
        schema: {
            sql: z
                .string()
                .min(6)
                .describe(
                    'Uma instrução SELECT/WITH/SHOW/DESCRIBE. Ex.: SELECT * FROM oss.tb_unidades',
                ),
        },
        async executar({ sql }) {
            const s = sql.trim().replace(/;\s*$/, '');
            if (!/^(select|with|show|describe|desc|explain)\b/i.test(s)) {
                throw new Error('só SELECT, WITH, SHOW, DESCRIBE ou EXPLAIN');
            }
            const corpo = /^(select|with)\b/i.test(s)
                ? `SET STATEMENT max_statement_time=30 FOR ${s}`
                : s;
            const linhas = await sqlDb().query(corpo, { type: QueryTypes.SELECT });
            const colunas = linhas.length
                ? Object.keys(linhas[0]).map((k) => {
                      return [k, k];
                  })
                : [['resultado', 'Resultado']];
            return {
                titulo: 'Consulta SQL',
                fonte: 'consulta direta (usuário claude_sql, somente leitura)',
                dados: linhas,
                tabelas: [{ colunas, linhas }],
            };
        },
    },
];

// Conexão própria do consulta_sql: usuário com menos GRANTs que o das ferramentas dedicadas.
// ponytail: carrega o resultado inteiro antes de paginar; LIMIT na query se o volume pesar.
let sqlConn = null;
function sqlDb() {
    if (!sqlConn) {
        const e = process.env;
        sqlConn = new Sequelize(e.DB_NAME, e.DB_CLAUDE_SQL_USER, e.DB_CLAUDE_SQL_PASS || '', {
            host: e.DB_HOST || 'localhost',
            port: e.DB_PORT || 3306,
            dialect: 'mysql',
            logging: false,
            pool: { max: 2, min: 0 },
            dialectOptions: { bigNumberStrings: true },
        });
    }
    return sqlConn;
}

module.exports = {
    ferramentas,
    contratoPor,
    unidadePor,
    escopoPor,
    cumprimento,
    q,
    ALIAS_CONTRATO,
    ALIAS_UNIDADE,
    fecharSql: () => {
        return sqlConn && sqlConn.close();
    },
};
