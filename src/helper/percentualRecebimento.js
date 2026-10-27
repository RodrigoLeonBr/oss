// Percentual de recebimento do repasse. Puro (sem DB). Duas leituras do mesmo mês:
// 'apurado' (dado bruto) e 'aposComissao' (justificativas aceitas — nunca piora).
//
// A regra vem por vigência (tb_historico_contrato.regra_recebimento). Modelos:
//   fixa_variavel        (PA Zanaga): fixa × média ponderada dos fatores dos grupos quant;
//                                     variável × escala(nota qualitativa).
//   producao_qualidade   (UPA Dona Rosa): repasse × escala(nota qualitativa)
//                                     − Σ desconto por faixa de alcance das linhas quant (base = perc_fixo).
// Pontuação qualitativa:
//   proporcional: fator = min(pct / limiar_cumprido, 1)  (menor_igual: limiar / pct)
//   niveis:       cumprido 1 | parcial 0,5 | não cumprido 0  (faixas de avaliacaoCumprimento)
// Comissão: nota 'aceita' → fator = max(apurado, alcance_considerado/100) (null = 100).

const { faixasEfetivas, nivelCumprimento } = require('./avaliacaoCumprimento');

const REGRA_PADRAO = {
  modelo: 'fixa_variavel',
  pontuacao: 'proporcional',
  escala: [
    { min: 95, perc: 100 },
    { min: 90, perc: 90 },
    { min: 80, perc: 80 },
    { min: 70, perc: 60 },
  ],
  abaixo: 0,
};

const num = (v) => (v == null || v === '' || Number.isNaN(parseFloat(v)) ? null : parseFloat(v));
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

function regraEfetiva(regra) {
  const r = typeof regra === 'string' ? JSON.parse(regra) : regra;
  return { ...REGRA_PADRAO, ...(r || {}) };
}

function pctDe(realizado, base) {
  const r = num(realizado);
  const b = num(base);
  if (r == null || b == null || b <= 0) return null;
  return (r / b) * 100;
}

function fatorProporcional(pct, meta) {
  if (pct == null) return null;
  const { tipo, cumprido } = faixasEfetivas(meta);
  if (tipo === 'menor_igual') return pct <= cumprido ? 1 : cumprido / pct;
  return cumprido > 0 ? Math.min(pct / cumprido, 1) : 1;
}

const FATOR_NIVEL = { cumprido: 1, parcial: 0.5, nao_cumprido: 0 };

function fatorNivel(pct, meta) {
  if (pct == null) return null;
  return FATOR_NIVEL[nivelCumprimento(pct, faixasEfetivas(meta))] ?? null;
}

/** fator considerado pela comissão, ou null se não há nota aceita */
function fatorComissao(nota) {
  if (!nota || nota.status_validacao !== 'aceita') return null;
  const a = num(nota.alcance_considerado);
  return Math.min(Math.max(a == null ? 100 : a, 0), 100) / 100;
}

const comComissao = (fator, nota) => {
  const fc = fatorComissao(nota);
  if (fc == null) return fator;
  return fator == null ? fc : Math.max(fator, fc);
};

/** Primeira faixa com valor >= min vence; abaixo de todas → `abaixo`. */
function percentualPorEscala(nota, escala = REGRA_PADRAO.escala, abaixo = 0) {
  if (nota == null) return null;
  const faixa = [...escala].sort((a, b) => b.min - a.min).find((f) => nota >= f.min - 1e-9);
  return faixa ? faixa.perc : abaixo;
}

/**
 * Alcance (%) de um grupo quant: Σreal/Σbase das linhas (ex.: SADT = RX + Lab).
 * Comissão por linha: realizado efetivo = max(realizado, base × limiar% × considerado).
 */
function alcanceGrupo(linhas, comissao, limiar) {
  const comDado = linhas.filter((l) => num(l.realizado) != null && num(l.base) > 0);
  if (!comDado.length) return null;
  let real = 0;
  let base = 0;
  for (const l of comDado) {
    let r = num(l.realizado);
    const b = num(l.base);
    const fc = comissao ? fatorComissao(l.nota) : null;
    if (fc != null) r = Math.max(r, b * (limiar / 100) * fc);
    real += r;
    base += b;
  }
  return (real / base) * 100;
}

/** fixa_variavel: fator do grupo pelo limiar da 1ª meta (ex.: tolerância 80%) */
function fatorGrupoQuant(linhas, comissao) {
  const primeira = linhas.find((l) => num(l.realizado) != null && num(l.base) > 0);
  if (!primeira) return null;
  const { cumprido } = faixasEfetivas(primeira.meta);
  return fatorProporcional(alcanceGrupo(linhas, comissao, cumprido), primeira.meta);
}

// Sem lançamento (fator null) conta 0 no peso — como a planilha ("não avaliado = 0"); fica em `pendentes`.
// Mês sem nenhum lançamento → null (não há o que apurar). Peso 0 = informativo, fora da conta.
const mediaPonderada = (itens) => {
  let soma = 0;
  let den = 0;
  let algum = false;
  for (const { peso, fator } of itens) {
    const w = parseFloat(peso);
    if (!(w > 0)) continue;
    if (fator != null) {
      soma += w * fator;
      algum = true;
    }
    den += w;
  }
  return den === 0 || !algum ? null : (soma / den) * 100;
};

function linhasQualitativas(qual, pontuacao) {
  const fn = pontuacao === 'niveis' ? fatorNivel : fatorProporcional;
  return qual.map((l) => {
    const pct = pctDe(l.realizado, l.base);
    const fator = fn(pct, l.meta);
    return {
      ...l, pct, informativo: !(parseFloat(l.peso) > 0), fator_apurado: fator, fator_comissao: comComissao(fator, l.nota),
    };
  });
}

function contarPendentes(grupos, linhasQual) {
  return grupos.filter((g) => g.pendente).length
    + linhasQual.filter((l) => !l.informativo && l.fator_apurado == null).length;
}

function calcularFixaVariavel({
  regra, quant, qual, parcelaFixa, parcelaVariavel,
}) {
  const grupos = quant.map((g) => {
    const fa = fatorGrupoQuant(g.linhas, false);
    return {
      ...g, pendente: fa == null, fator_apurado: fa, fator_comissao: fatorGrupoQuant(g.linhas, true),
    };
  });
  const linhasQual = linhasQualitativas(qual, regra.pontuacao);

  const resultado = (chave) => {
    const percFixa = mediaPonderada(grupos.map((g) => ({ peso: g.peso, fator: g[chave] })));
    const notaQual = mediaPonderada(linhasQual.map((l) => ({ peso: l.peso, fator: l[chave] })));
    const percVar = percentualPorEscala(notaQual, regra.escala, regra.abaixo);
    const valorFixa = percFixa == null ? null : (parcelaFixa * percFixa) / 100;
    const valorVar = percVar == null ? null : (parcelaVariavel * percVar) / 100;
    return {
      perc_fixa: r2(percFixa),
      nota_qualitativa: r2(notaQual),
      perc_variavel: percVar,
      valor_fixa: r2(valorFixa),
      valor_variavel: r2(valorVar),
      valor_total: valorFixa == null || valorVar == null ? null : r2(valorFixa + valorVar),
    };
  };

  return {
    grupos, qual: linhasQual, pendentes: contarPendentes(grupos, linhasQual),
    apurado: resultado('fator_apurado'), aposComissao: resultado('fator_comissao'),
  };
}

function calcularProducaoQualidade({
  regra, quant, qual, parcelaFixa, valorMensal, aplicarProducao,
}) {
  const prod = { faixas: [], abaixo: 0, ...(regra.producao || {}) };
  // limiar sem desconto (ex.: 85%) — usado pela comissão para "considerar cumprida"
  const limiar = Math.max(0, ...prod.faixas.filter((f) => !f.desc).map((f) => f.min));
  const descDe = (pct) => (pct == null ? null : percentualPorEscala(pct, prod.faixas.map((f) => ({ min: f.min, perc: f.desc })), prod.abaixo));
  const somaPesos = quant.reduce((s, g) => s + (parseFloat(g.peso) > 0 ? parseFloat(g.peso) : 0), 0);

  const grupos = quant.map((g) => {
    const baseLinha = somaPesos > 0 ? (parcelaFixa * (parseFloat(g.peso) || 0)) / somaPesos : 0;
    const pa = alcanceGrupo(g.linhas, false, limiar);
    const pc = alcanceGrupo(g.linhas, true, limiar);
    const da = descDe(pa);
    const dc = descDe(pc);
    return {
      ...g,
      pendente: pa == null,
      base_linha: r2(baseLinha),
      alcance_apurado: r2(pa),
      alcance_comissao: r2(pc),
      desc_perc_apurado: da,
      desc_perc_comissao: dc,
      desconto_apurado: aplicarProducao && da != null ? r2((baseLinha * da) / 100) : 0,
      desconto_comissao: aplicarProducao && dc != null ? r2((baseLinha * dc) / 100) : 0,
    };
  });
  const linhasQual = linhasQualitativas(qual, regra.pontuacao);

  const resultado = (chave, chaveDesc) => {
    const notaQual = mediaPonderada(linhasQual.map((l) => ({ peso: l.peso, fator: l[chave] })));
    const percEscala = percentualPorEscala(notaQual, regra.escala, regra.abaixo);
    const desconto = grupos.reduce((s, g) => s + g[chaveDesc], 0);
    const valorEscala = percEscala == null ? null : (valorMensal * percEscala) / 100;
    return {
      nota_qualitativa: r2(notaQual),
      perc_escala: percEscala,
      valor_escala: r2(valorEscala),
      desconto_producao: r2(desconto),
      valor_total: valorEscala == null ? null : r2(valorEscala - desconto),
    };
  };

  return {
    grupos, qual: linhasQual, pendentes: contarPendentes(grupos, linhasQual),
    apurado: resultado('fator_apurado', 'desconto_apurado'),
    aposComissao: resultado('fator_comissao', 'desconto_comissao'),
  };
}

/**
 * @param {object} p
 * @param {object|string} [p.regra]  regra_recebimento da vigência (default = fixa_variavel Zanaga)
 * @param {Array<{peso, linhas: Array<{realizado, base, meta, nota?}>}>} p.quant  grupos (blocos)
 * @param {Array<{peso, realizado, base, meta, nota?}>} p.qual
 * @param {number} p.parcelaFixa      R$ (producao_qualidade: base dos descontos de produção)
 * @param {number} p.parcelaVariavel  R$
 * @param {number} [p.valorMensal]    R$ (producao_qualidade)
 * @param {boolean} [p.aplicarProducao=true]  producao_qualidade: false fora do mês de aplicação (só prévia)
 */
function calcular({
  regra, quant = [], qual = [], parcelaFixa = 0, parcelaVariavel = 0, valorMensal = 0, aplicarProducao = true,
}) {
  const r = regraEfetiva(regra);
  const args = {
    regra: r, quant, qual, parcelaFixa, parcelaVariavel, valorMensal, aplicarProducao,
  };
  const out = r.modelo === 'producao_qualidade' ? calcularProducaoQualidade(args) : calcularFixaVariavel(args);
  return { modelo: r.modelo, pontuacao: r.pontuacao, ...out };
}

module.exports = {
  REGRA_PADRAO,
  regraEfetiva,
  pctDe,
  fatorProporcional,
  fatorNivel,
  fatorComissao,
  fatorGrupoQuant,
  percentualPorEscala,
  calcular,
};

// ── Self-check (node src/helper/percentualRecebimento.js) — números reais das planilhas 2026
if (require.main === module) {
  const assert = require('assert');
  const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.05, `${m}: ${a} != ${b}`);
  const tol = { meta_tipo: 'maior_igual', meta_parcial: 80, meta_minima: 80 }; // tolerância 80%
  const q100 = { meta_tipo: 'maior_igual' };
  const L = (realizado, base, meta = tol, nota = undefined) => ({
    realizado, base, meta, nota,
  });

  // escala
  assert.strictEqual(percentualPorEscala(95), 100);
  assert.strictEqual(percentualPorEscala(94.99), 90);
  assert.strictEqual(percentualPorEscala(77.2), 60);
  assert.strictEqual(percentualPorEscala(69.99), 0);
  // menor_igual (transferência ≤1%): 0,5% cumpre; 2% recebe metade
  assert.strictEqual(fatorProporcional(pctDe(0.5, 1), { meta_tipo: 'menor_igual' }), 1);
  assert.strictEqual(fatorProporcional(pctDe(2, 1), { meta_tipo: 'menor_igual' }), 0.5);
  // níveis: 100/85 padrão
  assert.strictEqual(fatorNivel(100, q100), 1);
  assert.strictEqual(fatorNivel(90, q100), 0.5);
  assert.strictEqual(fatorNivel(84, q100), 0);
  assert.strictEqual(fatorNivel(pctDe(4, 4), { meta_tipo: 'menor_igual' }), 1);

  // ── PA Zanaga (fixa_variavel, regra padrão) — jan/26
  const quant = [
    { nome: 'Atendimentos Médicos', peso: 1, linhas: [L(6183, 6750)] },
    { nome: 'Classificação de Risco', peso: 1, linhas: [L(6183, 6750)] },
    { nome: 'SADT', peso: 1, linhas: [L(761, 1000), L(678, 3000)] },
  ];
  const pesos = [3, 6, 3, 6, 3, 6, 3, 6, 6, 8, 6, 9, 11, 15, 9];
  const jan = [0, 0, 100, 100, 100, 100, 0, 0, 100, 59, 100, 100, 100, 89.6, 100];
  const qual = pesos.map((peso, i) => ({ peso, ...L(jan[i], 100, q100) }));
  const out = calcular({
    quant, qual, parcelaFixa: 2160000, parcelaVariavel: 240000,
  });
  assert.strictEqual(out.modelo, 'fixa_variavel');
  near(out.apurado.nota_qualitativa, 77.16, 'nota qual jan/26');
  assert.strictEqual(out.apurado.perc_variavel, 60);
  near(out.apurado.perc_fixa, ((1 + 1 + 1439 / 3200) / 3) * 100, 'fixa jan/26');
  assert.strictEqual(out.pendentes, 0);

  // comissão: SAU (peso 3, 0%) aceita integral; Ética (peso 6) aceita 50% → 77,16 + 3 + 3 = 83,16 → 80%
  qual[0].nota = { status_validacao: 'aceita' };
  qual[7].nota = { status_validacao: 'aceita', alcance_considerado: 50 };
  qual[1].nota = { status_validacao: 'rejeitada' };
  const c = calcular({
    quant, qual, parcelaFixa: 2160000, parcelaVariavel: 240000,
  });
  near(c.apurado.nota_qualitativa, 77.16, 'apurado não muda');
  near(c.aposComissao.nota_qualitativa, 83.16, 'após comissão');
  assert.strictEqual(c.aposComissao.perc_variavel, 80);

  // comissão no SADT/Lab integral → grupo cumpre
  quant[2].linhas[1].nota = { status_validacao: 'aceita' };
  const s = calcular({ quant, qual });
  near(s.grupos[2].fator_comissao, 1, 'SADT após comissão');
  near(s.grupos[2].fator_apurado, 1439 / 3200, 'SADT apurado');

  // abr/26: "Profissional médico" (peso 8) sem lançamento conta 0 → 87,74 × 92/100 = 80,72 (planilha 0,807)
  const abr = pesos.map((peso, i) => ({ peso, ...L(i === 9 ? null : 100, 100, q100) }));
  const a = calcular({ qual: abr });
  near(a.apurado.nota_qualitativa, 92, 'pendente conta zero');
  assert.strictEqual(a.pendentes, 1);
  assert.strictEqual(calcular({ qual: [{ peso: 10, ...L(null, 100, q100) }] }).apurado.nota_qualitativa, null);

  // ── UPA Dona Rosa (producao_qualidade, níveis) — repasse 1.600.982,91, base produção 95%
  const DR = {
    modelo: 'producao_qualidade',
    pontuacao: 'niveis',
    escala: [{ min: 80, perc: 100 }, { min: 75, perc: 95 }, { min: 65, perc: 90 }],
    abaixo: 85,
    producao: { faixas: [{ min: 85, desc: 0 }, { min: 70, desc: 10 }], abaixo: 30, periodo: 'trimestral' },
  };
  const VM = 1600982.91;
  const base = { regra: DR, valorMensal: VM, parcelaFixa: VM * 0.95 };
  const qualDR = [10, 5, 10, 5, 5, 10, 5, 5, 10, 5, 10, 5, 10, 5].map((peso) => ({ peso, ...L(100, 100, q100) }));
  qualDR.push({ peso: 0, ...L(null, 85, q100) }); // satisfação informativa sem lançamento: não é pendente

  // jan/26 prévia: Atend 6342/6750 = 94% ok; SADT (1156+2539)/4450 = 83% → faixa −10%, mas não aplica
  const janDR = [
    { nome: 'Atendimentos', peso: 50, linhas: [L(6342, 6750, q100)] },
    { nome: 'SADT', peso: 50, linhas: [L(1156, 1450, q100), L(2539, 3000, q100)] },
  ];
  const p = calcular({ ...base, quant: janDR, qual: qualDR, aplicarProducao: false });
  assert.strictEqual(p.modelo, 'producao_qualidade');
  near(p.grupos[1].alcance_apurado, (3695 / 4450) * 100, 'SADT jan');
  assert.strictEqual(p.grupos[1].desc_perc_apurado, 10);
  assert.strictEqual(p.apurado.desconto_producao, 0);
  assert.strictEqual(p.apurado.perc_escala, 100);
  near(p.apurado.valor_total, VM, 'repasse integral');
  assert.strictEqual(p.pendentes, 0);

  // T1 oficial: Atend 20209/20250, SADT 12900/13350 = 96,6% → sem desconto
  const t1 = [
    { peso: 50, linhas: [L(20209, 20250, q100)] },
    { peso: 50, linhas: [L(3835, 4350, q100), L(9065, 9000, q100)] },
  ];
  assert.strictEqual(calcular({ ...base, quant: t1, qual: qualDR }).apurado.desconto_producao, 0);

  // SADT trimestre 75% → 10% × 50% × 95% × VM = 76.046,69; nota com 2 parciais (peso 10) = 90 → 100%
  const t75 = [{ peso: 50, linhas: [L(100, 100, q100)] }, { peso: 50, linhas: [L(75, 100, q100)] }];
  const qualParcial = qualDR.map((l, i) => (i < 2 ? { ...l, realizado: i === 0 ? 90 : 100 } : l));
  qualParcial[2] = { ...qualParcial[2], realizado: 90 };
  const d = calcular({ ...base, quant: t75, qual: qualParcial });
  near(d.apurado.desconto_producao, 76046.69, 'desconto SADT 75%');
  near(d.apurado.nota_qualitativa, 90, 'nota com 2 parciais');
  near(d.apurado.valor_total, VM - 76046.69, 'repasse com desconto');
  // <70% → 30%; nota 70 → escala 90%
  const t60 = [{ peso: 50, linhas: [L(60, 100, q100)] }, { peso: 50, linhas: [L(100, 100, q100)] }];
  const qual70 = qualDR.map((l, i) => (i < 4 ? { ...l, realizado: 0 } : l)); // −30 pts
  const e = calcular({ ...base, quant: t60, qual: qual70 });
  assert.strictEqual(e.grupos[0].desc_perc_apurado, 30);
  near(e.apurado.nota_qualitativa, 70, 'nota 70');
  assert.strictEqual(e.apurado.perc_escala, 90);
  // comissão aceita na linha de 60% → considera 85% → sem desconto após comissão
  t60[0].linhas[0].nota = { status_validacao: 'aceita' };
  assert.strictEqual(calcular({ ...base, quant: t60, qual: qualDR }).aposComissao.desconto_producao, 0);

  console.log('percentualRecebimento: OK');
}
