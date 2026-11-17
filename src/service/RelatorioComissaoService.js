// Relatório da Comissão de Avaliação e Fiscalização (.docx) — metas + execução financeira + evolução das contas.
// Template src/templates/relatorio-comissao.docx = o relatório oficial com o corpo trocado por {{CORPO}}
// (cabeçalho com logo, rodapé com endereço e "Página X de Y", estilos Título1/Título2/Parágrafo, margens A4).
// O corpo é WordprocessingML montado aqui; tabelas reais (não imagens), cabeçalho repetido em quebra de página.

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const httpStatus = require('http-status');
const db = require('../models');
const ApiError = require('../helper/ApiError');
const { janelaCivil, mesesEntre } = require('../helper/periodoRelatorio');
const { assertContratoNoEscopoOSS } = require('../helper/ossScopeHelper');
const FinanceiroService = require('./FinanceiroService');
const RelatorioCmsService = require('./RelatorioCmsService');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'relatorio-comissao.docx');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const CONTA = { custeio: 'Custeio', investimento: 'Investimento', provisao: 'Provisão' };
const STATUS = { cumprido: 'Cumprida', parcial: 'Parcial', nao_cumprido: 'Não cumprida', aguardando: 'Aguardando' };
const TIPO_TITULO = { trimestral: 'Trimestral', quadrimestral: 'Quadrimestral', anual: 'Anual', livre: '' };

// ───────── WordprocessingML ─────────
const esc = (s) => {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
const run = (t, { b = false, sz } = {}) => {
    const rpr = `<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>${b ? '<w:b/><w:bCs/>' : ''}${sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : ''}`;
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
};
const par = (t, { estilo = 'Pargrafo', b, jc, sz, extra = '' } = {}) => {
    return `<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}${extra}</w:pPr>${run(t, { b, sz })}</w:p>`;
};
const h1 = (t) => {
    return par(t, { estilo: 'Ttulo1' });
};
const h2 = (t) => {
    return par(t, { estilo: 'Ttulo2' });
};
const textos = (t) => {
    return String(t || '').split(/\n\s*\n|\n/).map((l) => {
        return l.trim();
    }).filter(Boolean).map((l) => {
        return par(l);
    }).join('');
};
const legenda = (t) => {
    return par(t, { estilo: 'Normal', sz: 18, extra: '<w:spacing w:before="60" w:after="160"/>' });
};
const quebraPagina = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * @param {string[]} cab cabeçalho
 * @param {Array<Array<string|number|null>>} linhas números viram "1.234,56" alinhados à direita
 * @param {{largura:number, primeira?:number, pesos?:number[], total?:boolean, sz?:number}} o largura útil em twips;
 *   pesos = proporção de cada coluna (senão 1ª coluna `primeira` e as demais iguais)
 */
function tabela(cab, linhas, { largura, primeira, pesos, total = false, sz } = {}) {
    const n = cab.length;
    const tam = sz || (n > 9 ? 14 : n > 6 ? 16 : 18);
    let larguras;
    if (pesos) {
        const soma = pesos.reduce((a, b) => {
            return a + b;
        }, 0);
        larguras = pesos.map((p) => {
            return Math.floor((largura * p) / soma);
        });
    } else {
        const w0 = primeira || Math.round(largura * (n > 6 ? 0.2 : 0.3));
        const wN = Math.floor((largura - w0) / Math.max(1, n - 1));
        larguras = cab.map((_, i) => {
            return i ? wN : w0;
        });
    }
    const cel = (v, i, { cabecalho = false, negrito = false } = {}) => {
        const numero = typeof v === 'number';
        const txt = numero ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v ?? '—';
        const jc = cabecalho ? 'center' : numero ? 'right' : 'left';
        return `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/>${cabecalho ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>`
            + `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>`
            + `${run(txt, { b: cabecalho || negrito, sz: tam })}</w:p></w:tc>`;
    };
    const tr = (cells, o = {}) => {
        return `<w:tr><w:trPr><w:cantSplit/>${o.cabecalho ? '<w:tblHeader/>' : ''}</w:trPr>${cells.map((v, i) => {
            return cel(v, i, o);
        }).join('')}</w:tr>`;
    };
    return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabelacomgrade"/><w:tblW w:w="${largura}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
        + '<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        + `<w:tblGrid>${larguras.map((w) => {
            return `<w:gridCol w:w="${w}"/>`;
        }).join('')}</w:tblGrid>`
        + `${tr(cab, { cabecalho: true })}${linhas.map((l, i) => {
            return tr(l, { negrito: total && i === linhas.length - 1 });
        }).join('')}</w:tbl>`;
}

// ───────── helpers de período ─────────
const listaMeses = (ini, fim) => {
    const out = [];
    const [y, m] = ini.split('-').map(Number);
    for (let i = 0; i < mesesEntre(ini, fim); i += 1) {
        const yy = y + Math.floor((m - 1 + i) / 12);
        const mm = ((m - 1 + i) % 12) + 1;
        out.push(`${yy}-${String(mm).padStart(2, '0')}-01`);
    }
    return out;
};
const rotMes = (ymd) => {
    const [y, m] = ymd.split('-').map(Number);
    return `${MESES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
};
const periodoExtenso = (ini, fim) => {
    const [y1, m1] = ini.split('-').map(Number);
    const [y2, m2] = fim.split('-').map(Number);
    if (ini === fim) return `${MESES[m1 - 1]} de ${y1}`;
    return y1 === y2 ? `${MESES[m1 - 1]} a ${MESES[m2 - 1]} de ${y2}` : `${MESES[m1 - 1]} de ${y1} a ${MESES[m2 - 1]} de ${y2}`;
};
const dataFim = (ymd) => {
    const [y, m] = ymd.split('-').map(Number);
    return `${String(new Date(y, m, 0).getDate()).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};
const r2 = (c) => {
    return Math.round(c) / 100;
};
// janela do Relatório CMS (móvel, termina em fim) equivalente ao período civil; livre só se casar
const periodoCms = (j, tipo) => {
    if (tipo === 'trimestral') return 'trimestre';
    if (tipo === 'quadrimestral') return 'quadrimestre';
    if (tipo === 'anual') return 'ano';
    if (j.meses === 1) return 'mes';
    if (j.meses === 3) return 'trimestre';
    if (j.meses === 4) return 'quadrimestre';
    return j.inicio.endsWith('-01-01') && j.inicio.slice(0, 4) === j.fim.slice(0, 4) ? 'acumulado' : null;
};

/** Monta o .docx (Buffer) do relatório do contrato no período. */
async function gerar({ contratoId, periodo }, ossIdFiltro) {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const [contrato] = await db.sequelize.query(
        `SELECT c.contrato_id, c.numero, o.nome AS oss FROM tb_contratos c JOIN tb_oss o ON o.oss_id = c.oss_id
          WHERE c.contrato_id = ?`,
        { replacements: [contratoId], type: db.Sequelize.QueryTypes.SELECT, logging: false },
    );
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');
    const j = janelaCivil(periodo);
    const meses = listaMeses(j.inicio, j.fim);
    const fatos = await FinanceiroService.fatos({ contratoId }, j.anterior.inicio, j.fim, ossIdFiltro);
    const doPeriodo = fatos.filter((f) => {
        return f.mes >= j.inicio && f.mes <= j.fim;
    });
    const obs = await FinanceiroService.listarObservacoes({ contratoId, ini: j.inicio, fim: j.fim }, ossIdFiltro);
    const secao = (k) => {
        return obs.filter((o) => {
            return o.tipo === 'secao' && o.secao === k;
        }).map((o) => {
            return textos(o.texto);
        }).join('');
    };
    const fontes = await db.sequelize.query(
        `SELECT u.sigla, f.fonte_descricao, DATE_FORMAT(f.mes_referencia, '%Y-%m-%d') AS mes, SUM(f.valor) AS valor
           FROM tb_repasse_fonte f JOIN tb_unidades u ON u.unidade_id = f.unidade_id
          WHERE u.contrato_id = ? AND f.mes_referencia BETWEEN ? AND ?
          GROUP BY u.sigla, f.fonte_descricao, f.mes_referencia`,
        { replacements: [contratoId, j.inicio, j.fim], type: db.Sequelize.QueryTypes.SELECT, logging: false },
    );

    const RETRATO = 8504; // 11906 − 2×1701
    const PAISAGEM = 14004; // 16838 − 2×1417
    const contas = [...new Map(fatos.map((f) => {
        return [`${f.sigla}|${f.conta}`, { sigla: f.sigla, conta: f.conta, unidade_id: f.unidade_id }];
    })).values()].sort((a, b) => {
        return a.sigla.localeCompare(b.sigla) || Object.keys(CONTA).indexOf(a.conta) - Object.keys(CONTA).indexOf(b.conta);
    });
    const unidades = [...new Set(contas.map((c) => {
        return c.sigla;
    }))];
    const valor = (filtro, campo, mes) => {
        return doPeriodo.filter((f) => {
            return filtro(f) && (!mes || f.mes === mes);
        }).reduce((s, f) => {
            return s + f[campo];
        }, 0);
    };
    // tabela "linha × mês" (+ total), em reais
    const matrizMensal = (linhas, campo, comTotalGeral = true) => {
        const corpo = linhas.map(([rotulo, filtro]) => {
            const vals = meses.map((m) => {
                return r2(valor(filtro, campo, m));
            });
            return [rotulo, ...vals, r2(valor(filtro, campo))];
        });
        if (comTotalGeral) {
            corpo.push(['Total', ...meses.map((m) => {
                return r2(valor(() => {
                    return true;
                }, campo, m));
            }), r2(valor(() => {
                return true;
            }, campo))]);
        }
        return corpo;
    };
    const porConta = contas.map((c) => {
        return [`${c.sigla} – ${CONTA[c.conta]}`, (f) => {
            return f.unidade_id === c.unidade_id && f.conta === c.conta;
        }];
    });
    const cabMeses = (primeira) => {
        return [primeira, ...meses.map(rotMes), 'Total'];
    };

    let corpo = '';
    // capa
    corpo += par(`Relatório ${TIPO_TITULO[periodo.tipo] || ''} de Prestação de Contas`.replace(/\s+/g, ' '), { estilo: 'Normal', b: true, jc: 'center', sz: 28 });
    corpo += par(`Período: ${periodoExtenso(j.inicio, j.fim)}.`, { estilo: 'Normal', jc: 'center', sz: 22 });
    corpo += par(j.rotulo, { estilo: 'Pargrafo', b: true, jc: 'center' });
    corpo += par(`Contrato de Gestão nº ${contrato.numero} – ${contrato.oss}`, { estilo: 'Normal', jc: 'center', sz: 22 });
    if (unidades.length) corpo += par(`Unidades: ${unidades.join(', ')}`, { estilo: 'Normal', jc: 'center', sz: 20 });

    // 1. metas
    const pCms = periodoCms(j, periodo.tipo);
    if (pCms) {
        const cms = await RelatorioCmsService.gerar(
            { mes: j.fim, periodo: pCms, escopo: 'contrato', contratoId },
            ossIdFiltro,
        );
        const c = cms.contratos[0];
        if (c) {
            corpo += h1('ANÁLISE DO CUMPRIMENTO DAS METAS');
            const r = cms.resumo;
            corpo += par(`No período foram avaliados ${r.total} indicadores: ${r.cumpridos} cumpridos, ${r.parciais} parcialmente cumpridos, `
                + `${r.naoCumpridos} não cumpridos e ${r.aguardando} aguardando lançamento.`);
            c.unidades.forEach((u) => {
                const linhas = [...u.quantitativos, ...u.qualitativos];
                if (!linhas.length) return;
                corpo += h2(u.nome);
                corpo += tabela(['Código', 'Indicador', 'Meta no período', 'Realizado', '%', 'Situação'], linhas.map((l) => {
                    return [l.codigo, l.nome, l.metaPeriodo == null ? '—' : Number(l.metaPeriodo), l.realizadoAcum == null ? '—' : Number(l.realizadoAcum),
                        l.percentual == null ? '—' : `${Number(l.percentual).toFixed(1).replace('.', ',')}%`, STATUS[l.status] || l.status];
                }), { largura: RETRATO, pesos: [16, 34, 13, 13, 9, 15], sz: 16 });
                corpo += legenda('');
            });
            corpo += secao('metas');
        }
    }

    // 2. financeiro
    corpo += h1('ANÁLISE DA EXECUÇÃO FINANCEIRA DO OBJETO');
    if (!doPeriodo.length) corpo += par('Não há execução financeira lançada no sistema para o período.');

    corpo += h2(`Cronograma de desembolso da SMS no ${j.rotulo.split(' de ')[0].replace(/^\d+º /, '') || 'período'}`);
    corpo += tabela(cabMeses('Unidade'), matrizMensal(unidades.map((s) => {
        return [s, (f) => {
            return f.sigla === s;
        }];
    }), 'repasse'), { largura: RETRATO, total: true });
    corpo += legenda('Valores em R$ – repasses creditados nas contas da unidade.');
    if (fontes.length) {
        const chaves = [...new Set(fontes.map((f) => {
            return `${f.sigla}|${f.fonte_descricao}`;
        }))].sort();
        corpo += tabela(cabMeses('Unidade / fonte'), chaves.map((k) => {
            const [s, d] = k.split('|');
            const vals = meses.map((m) => {
                const x = fontes.find((f) => {
                    return f.sigla === s && f.fonte_descricao === d && f.mes === m;
                });
                return x ? Number(x.valor) : null;
            });
            return [`${s} – ${d}`, ...vals.map((v) => {
                return v ?? '—';
            }), vals.reduce((a, v) => {
                return a + (v || 0);
            }, 0)];
        }), { largura: RETRATO });
        const semFonte = meses.filter((m) => {
            return !fontes.some((f) => {
                return f.mes === m;
            });
        });
        corpo += legenda(`Repasse por fonte de recurso.${semFonte.length ? ` Sem detalhamento por fonte: ${semFonte.map(rotMes).join(', ')}.` : ''}`);
    }
    corpo += secao('cronograma');

    corpo += h2(`Saldos em contas em ${dataFim(j.fim)}`);
    const kConta = contas.map((c) => {
        return {
            c,
            k: FinanceiroService.kpis(fatos.filter((f) => {
                return f.unidade_id === c.unidade_id && f.conta === c.conta;
            }), j.inicio, j.fim),
        };
    });
    const kTot = FinanceiroService.kpis(fatos, j.inicio, j.fim);
    const kAnt = FinanceiroService.kpis(fatos, j.anterior.inicio, j.anterior.fim);
    corpo += tabela(['Unidade – conta', 'Saldo inicial', 'Saldo final', 'Variação', 'Cobertura (meses)'], [
        ...kConta.map(({ c, k }) => {
            return [`${c.sigla} – ${CONTA[c.conta]}`, k.saldoInicial, k.saldoFinal,
                k.saldoInicial == null || k.saldoFinal == null ? '—' : Math.round((k.saldoFinal - k.saldoInicial) * 100) / 100,
                k.coberturaMeses == null ? '—' : k.coberturaMeses.toLocaleString('pt-BR')];
        }),
        ['Total', kTot.saldoInicial, kTot.saldoFinal,
            kTot.saldoInicial == null || kTot.saldoFinal == null ? '—' : Math.round((kTot.saldoFinal - kTot.saldoInicial) * 100) / 100,
            kTot.coberturaMeses == null ? '—' : kTot.coberturaMeses.toLocaleString('pt-BR')],
    ], { largura: RETRATO, total: true });
    corpo += legenda('Valores em R$. Cobertura = saldo final ÷ repasse médio mensal do período (contas com repasse).');
    corpo += secao('saldos');

    corpo += h2('Despesas mensais por competência, unidade e conta bancária');
    corpo += tabela(cabMeses('Unidade – conta'), matrizMensal(porConta, 'despesa'), { largura: RETRATO, total: true });
    corpo += legenda('Valores em R$.');
    corpo += secao('despesas');

    corpo += h2('Evolução das contas no período');
    corpo += tabela(['Unidade – conta', 'Saldo inicial', 'Repasse', 'Rendim.', 'Transf.', 'Próprios / arred.', 'Despesas', 'Saldo final'], [
        ...kConta.map(({ c, k }) => {
            return [`${c.sigla} – ${CONTA[c.conta]}`, k.saldoInicial, k.repasse, k.rendimento, k.transferencias,
                Math.round((k.recursosProprios + k.arredondamento) * 100) / 100, k.despesa, k.saldoFinal];
        }),
        ['Total', kTot.saldoInicial, kTot.repasse, kTot.rendimento, kTot.transferencias,
            Math.round((kTot.recursosProprios + kTot.arredondamento) * 100) / 100, kTot.despesa, kTot.saldoFinal],
    ], { largura: RETRATO, total: true, sz: 14, pesos: [19, 13, 14, 10, 13, 9, 14, 13] });
    corpo += legenda('Saldo inicial + repasse + rendimentos ± transferências ± recursos próprios − despesas = saldo final (R$).');
    const pct = (a, b) => {
        return b ? `${(((a - b) / Math.abs(b)) * 100).toFixed(1).replace('.', ',')}%` : '—';
    };
    corpo += tabela(['Item', `${periodoExtenso(j.anterior.inicio, j.anterior.fim)}`, periodoExtenso(j.inicio, j.fim), 'Variação'], [
        ['Repasse', kAnt.repasse, kTot.repasse, pct(kTot.repasse, kAnt.repasse)],
        ['Rendimentos', kAnt.rendimento, kTot.rendimento, pct(kTot.rendimento, kAnt.rendimento)],
        ['Despesas', kAnt.despesa, kTot.despesa, pct(kTot.despesa, kAnt.despesa)],
        ['Saldo final', kAnt.saldoFinal, kTot.saldoFinal, kAnt.saldoFinal == null ? '—' : pct(kTot.saldoFinal, kAnt.saldoFinal)],
    ], { largura: RETRATO, primeira: 2000 });
    corpo += legenda('Comparativo com o período imediatamente anterior, de mesma duração (R$).');
    const antGrupo = Object.fromEntries(kAnt.despesaPorGrupo.map((g) => {
        return [g.codigo, g.valor];
    }));
    corpo += tabela(['Grupo de despesa', 'Valor', '% do total', 'Período anterior', 'Variação'], kTot.despesaPorGrupo.map((g) => {
        return [g.nome, g.valor, `${g.perc.toFixed(1).replace('.', ',')}%`, antGrupo[g.codigo] ?? '—', pct(g.valor, antGrupo[g.codigo])];
    }), { largura: RETRATO, primeira: 3000 });
    corpo += legenda('Despesa do período por grupo (R$).');
    corpo += secao('evolucao');

    const notas = obs.filter((o) => {
        return o.tipo === 'nota';
    });
    if (notas.length) {
        corpo += h2('Observações da comissão');
        notas.forEach((o) => {
            const ref = [o.mes_referencia && rotMes(o.mes_referencia), o.sigla, o.conta && CONTA[o.conta]].filter(Boolean).join(' – ');
            corpo += par(`${ref ? `${ref}: ` : ''}${o.texto}`);
        });
    }
    const pend = obs.filter((o) => {
        return o.tipo === 'pendencia' && o.status === 'aberta';
    });
    if (pend.length) {
        corpo += h2('Pendências com a Organização Social');
        pend.forEach((o) => {
            corpo += par(`• ${o.mes_referencia ? `${rotMes(o.mes_referencia)} – ` : ''}${o.sigla ? `${o.sigla}: ` : ''}${o.texto}`);
        });
    }
    const concl = secao('conclusao');
    if (concl) corpo += h1('CONSIDERAÇÕES DA COMISSÃO') + concl;

    // anexos em paisagem: fecha a seção retrato com o sectPr original do template
    const zip = new PizZip(fs.readFileSync(TEMPLATE));
    const docXml = zip.file('word/document.xml').asText();
    const sectRetrato = docXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)[0];
    corpo += `<w:p><w:pPr>${sectRetrato}</w:pPr></w:p>`;

    const anexo = (titulo, campo, chave, nota) => {
        return h2(titulo) + tabela(cabMeses('Unidade – conta'), matrizMensal(porConta, campo), { largura: PAISAGEM, total: true })
            + legenda(nota) + secao(chave);
    };
    corpo += h1(`ANEXO: Resumo financeiro – ${j.rotulo}`);
    corpo += anexo('Resumo financeiro: Repasses', 'repasse', 'repasses', 'Valores em R$.');
    corpo += anexo('Resumo financeiro: Transferências entre contas do projeto', 'transferencia', 'transferencias',
        'Valor positivo = entrada na conta; negativo = saída (R$).');
    corpo += anexo('Resumo financeiro: Recursos próprios da O.S.', 'proprios', 'recursos_proprios', 'Valores em R$.');
    corpo += anexo('Resumo financeiro: Rendimentos de aplicação financeira', 'rendimento', 'rendimentos', 'Valores em R$.');
    corpo += anexo('Resumo financeiro: Despesas', 'despesa', 'despesas_anexo', 'Valores em R$.');
    corpo += h2('Resumo financeiro: Saldos');
    corpo += tabela(cabMeses('Unidade – conta').slice(0, -1), [
        ...porConta.map(([rot, filtro]) => {
            return [rot, ...meses.map((m) => {
                const f = doPeriodo.find((x) => {
                    return filtro(x) && x.mes === m;
                });
                return f && f.saldo != null ? r2(f.saldo) : '—';
            })];
        }),
        ['Total', ...meses.map((m) => {
            return r2(doPeriodo.filter((x) => {
                return x.mes === m && x.saldo != null;
            }).reduce((s, x) => {
                return s + x.saldo;
            }, 0));
        })],
    ], { largura: PAISAGEM, total: true });
    corpo += legenda(`Saldo no último dia de cada mês (R$). Saldo inicial do período: ${kTot.saldoInicial == null ? 'não informado' : kTot.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    corpo += secao('saldos_anexo');

    const sectPaisagem = sectRetrato
        .replace(/<w:pgSz [^>]*\/>/, '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>')
        .replace(/<w:pgMar [^>]*\/>/, '<w:pgMar w:top="1701" w:right="1417" w:bottom="1701" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>');
    const novo = docXml.replace(sectRetrato, sectPaisagem)
        .replace(/<w:p><w:r><w:t>\{\{CORPO\}\}<\/w:t><\/w:r><\/w:p>/, () => {
            return corpo; // função: `$` no texto do corpo não vira padrão de substituição
        });
    if (novo === docXml) throw new Error('template sem marcador {{CORPO}}');
    zip.file('word/document.xml', novo);
    const core = zip.file('docProps/core.xml');
    if (core) {
        zip.file('docProps/core.xml', core.asText().replace(/<dc:title>[^<]*/, `<dc:title>${esc(`Relatório ${j.rotulo} – ${contrato.numero}`)}`));
    }
    return {
        buffer: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
        nome: `relatorio-comissao-${contrato.numero.replace('/', '-')}-${j.inicio.slice(0, 7)}_${j.fim.slice(0, 7)}.docx`,
    };
}

module.exports = { gerar, tabela, periodoExtenso, listaMeses, quebraPagina };
