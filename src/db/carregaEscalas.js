// Carrega os <stem>.escala.json (prestacao-vault, fora do git) nas tabelas tb_escala_*.
// Uso: node src/db/carregaEscalas.js <dir-do-vault>
// Idempotente: arquivo é chaveado por `origem`; recarga apaga e reinsere os plantões dele.

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('../models');
const {
  normalizaNome, nomeCanonico, assinaturaNome, nomeParecido, chaveProfissional, CATEGORIA_POR_CONSELHO,
} = require('../helper/escalaNormaliza');

const SIGLA = { hm: 'HMA', upa_cillos: 'UPA-CIL', pa_zanaga: 'UPA-ZAN', unacon: 'UNACON' };
const AREA_POR_CONSELHO = { CRM: 'medica', CRO: 'medica', COREN: 'enfermagem' };

const q = (sql, replacements, transaction) => db.sequelize.query(sql, { replacements, transaction, logging: false });
const chaveStr = (k) => `${k.conselho}|${k.registro_numero}|${k.registro_uf}`;

function lerJsons(dir) {
  return fs.readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.escala.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function areaDoArquivo(arq, plantoes) {
  if (arq.area) return arq.area;
  const cont = {};
  plantoes.forEach((p) => { cont[p.conselho] = (cont[p.conselho] || 0) + 1; });
  const [maior] = Object.entries(cont).sort((a, b) => b[1] - a[1])[0] || [];
  return AREA_POR_CONSELHO[maior] || 'multiprofissional';
}

// Escala só com nome (PDF sem CRM): casa com quem já tem registro pelo nome normalizado e, senão,
// pela assinatura ("Jose H. Inamonico" = "JOSE HUGO INAMONICO") — só quando o candidato é único.
// Só os arquivos (não o banco): toda carga lê o vault inteiro, e CRM corrigido não pode herdar nome antigo.
function montarResolvedor(arquivos) {
  const porNome = new Map();
  const porAssinatura = new Map();
  const add = (nome, chave) => {
    [[porNome, nome], [porAssinatura, assinaturaNome(nome)]].forEach(([m, k]) => {
      if (!k) return;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(chave);
    });
  };
  arquivos.forEach(({ plantoes }) => plantoes.forEach((p) => {
    const k = chaveProfissional(p);
    if (p.nome && k.conselho !== 'SEM_REGISTRO') add(normalizaNome(p.nome), chaveStr(k));
  }));
  // 3º critério: grafia parecida (erro de digitação/OCR), também só com candidato único
  const cache = new Map();
  const parecido = (nome) => {
    if (!cache.has(nome)) {
      const chaves = new Set();
      porNome.forEach((ks, conhecido) => { if (nomeParecido(nome, conhecido)) ks.forEach((c) => chaves.add(c)); });
      cache.set(nome, chaves.size === 1 ? chaves : null);
    }
    return cache.get(nome);
  };
  return (p) => {
    const k = chaveProfissional(p);
    if (k.conselho !== 'SEM_REGISTRO') return k;
    const unico = (m, k) => (m.get(k)?.size === 1 ? m.get(k) : null);
    const achados = unico(porNome, normalizaNome(p.nome)) || unico(porAssinatura, assinaturaNome(p.nome))
      || parecido(p.nome);
    if (achados) {
      const [conselho, registro_numero, registro_uf] = [...achados][0].split('|');
      return { conselho, registro_numero, registro_uf };
    }
    return k;
  };
}

async function carregarProfissionais(arquivos, resolver) {
  const porChave = new Map();
  arquivos.forEach(({ plantoes }) => plantoes.filter((p) => p.nome).forEach((p) => {
    const k = resolver(p);
    const s = chaveStr(k);
    if (!porChave.has(s)) porChave.set(s, { ...k, variantes: new Map() });
    const v = porChave.get(s).variantes;
    v.set(p.nome, (v.get(p.nome) || 0) + 1);
  }));

  for (const p of porChave.values()) {
    const nome = nomeCanonico(p.variantes);
    await q(
      `INSERT INTO tb_escala_profissionais (nome, nome_normalizado, conselho, registro_numero, registro_uf, categoria)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), nome_normalizado = VALUES(nome_normalizado)`,
      [nome, normalizaNome(nome), p.conselho, p.registro_numero, p.registro_uf, CATEGORIA_POR_CONSELHO[p.conselho] || null],
    );
  }
  const [linhas] = await q('SELECT profissional_id, conselho, registro_numero, registro_uf FROM tb_escala_profissionais');
  const ids = new Map(linhas.map((l) => [chaveStr(l), l.profissional_id]));

  // grafias saem só dos arquivos: refaz tudo (alias antigo de CRM corrigido não pode sobrar)
  await q('DELETE FROM tb_escala_profissional_alias');
  const aliases = [];
  porChave.forEach((p, s) => p.variantes.forEach((_, bruto) => aliases.push([ids.get(s), bruto, normalizaNome(bruto)])));
  for (const a of aliases) {
    await q('INSERT IGNORE INTO tb_escala_profissional_alias (profissional_id, nome_bruto, nome_normalizado) VALUES (?, ?, ?)', a);
  }
  return ids;
}

async function setorId(unidadeId, nome, area, cache, t) {
  const k = `${unidadeId}|${nome}`;
  if (!cache.has(k)) {
    await q(
      'INSERT IGNORE INTO tb_escala_setores (unidade_id, nome, especialidade, area) VALUES (?, ?, ?, ?)',
      [unidadeId, nome, nome.toLowerCase(), area], t,
    );
    const [[r]] = await q('SELECT setor_id FROM tb_escala_setores WHERE unidade_id = ? AND nome = ?', [unidadeId, nome], t);
    cache.set(k, r.setor_id);
  }
  return cache.get(k);
}

async function carregarArquivo({ arquivo: a, plantoes }, unidades, ids, setores, resolver) {
  const unidadeId = unidades[SIGLA[a.unidade]];
  if (!unidadeId) throw new Error(`unidade sem sigla mapeada: ${a.unidade} (${a.origem})`);
  const area = areaDoArquivo(a, plantoes);
  const semRegistro = plantoes.some((p) => p.nome && resolver(p).conselho === 'SEM_REGISTRO');

  await db.sequelize.transaction(async (t) => {
    const [[existente]] = await q('SELECT arquivo_id FROM tb_escala_arquivos WHERE origem = ?', [a.origem], t);
    const arquivoId = existente ? existente.arquivo_id : randomUUID();
    if (existente) await q('DELETE FROM tb_escala_plantoes WHERE arquivo_id = ?', [arquivoId], t);
    await q(
      `REPLACE INTO tb_escala_arquivos (arquivo_id, unidade_id, competencia, assunto, origem, md_path, periodo_inicio,
         periodo_fim, metodo, status, qtd_plantoes, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [arquivoId, unidadeId, a.competencia, a.assunto, a.origem, a.md_path || null, a.periodo_inicio, a.periodo_fim,
        a.metodo, semRegistro && a.status === 'ok' ? 'revisar' : a.status, plantoes.length, a.obs || null], t,
    );
    for (const p of plantoes) {
      const sid = await setorId(unidadeId, (p.setor || a.assunto || 'geral').slice(0, 150), area, setores, t);
      await q(
        `INSERT INTO tb_escala_plantoes (arquivo_id, unidade_id, setor_id, profissional_id, data, inicio, fim,
           modalidade, marcacao, vinculo, texto_bruto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [arquivoId, unidadeId, sid, p.nome ? ids.get(chaveStr(resolver(p))) : null, p.data, p.inicio, p.fim,
          p.modalidade || 'plantao', p.marcacao || 'normal', p.vinculo || 'oss', (p.texto || '').slice(0, 500)], t,
      );
    }
  });
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('uso: node src/db/carregaEscalas.js <dir-do-vault>');
  const arquivos = lerJsons(dir);
  const [us] = await q('SELECT unidade_id, sigla FROM tb_unidades WHERE deleted_at IS NULL');
  const unidades = Object.fromEntries(us.map((u) => [u.sigla, u.unidade_id]));
  const resolver = montarResolvedor(arquivos);
  const ids = await carregarProfissionais(arquivos, resolver);
  const setores = new Map();
  for (const arq of arquivos) await carregarArquivo(arq, unidades, ids, setores, resolver);
  // escalas de ciclo 21→20 se sobrepõem entre meses: mantém um plantão por profissional+horário+unidade
  // (tb_escala_arquivos.qtd_plantoes segue contando o que veio no arquivo, antes da deduplicação)
  await q(`DELETE p2 FROM tb_escala_plantoes p1 JOIN tb_escala_plantoes p2
           ON p2.unidade_id = p1.unidade_id AND p2.profissional_id = p1.profissional_id
          AND p2.inicio = p1.inicio AND p2.fim = p1.fim AND p2.arquivo_id <> p1.arquivo_id AND p2.plantao_id > p1.plantao_id`);
  // médico PMA = titular de posto da Prefeitura em alguma escala (RI+PMA ou PMA; quem só cobre não conta).
  // Plantão dele sem PMA marcado (cor sem legenda, "(CO)" sem cor) é posto PMA também — decidido pelo registro.
  await q(`UPDATE tb_escala_plantoes p
           JOIN (SELECT DISTINCT profissional_id, unidade_id FROM tb_escala_plantoes
                 WHERE vinculo = 'pma' AND marcacao IN ('normal', 'riscado')) pma
             ON pma.profissional_id = p.profissional_id AND pma.unidade_id = p.unidade_id
           SET p.vinculo = 'pma'
           WHERE p.vinculo = 'oss' AND p.marcacao IN ('normal', 'riscado', 'cobertura')`);
  // SEM_REGISTRO que passou a casar com alguém com registro fica órfão
  await q(`DELETE pr FROM tb_escala_profissionais pr LEFT JOIN tb_escala_plantoes p USING (profissional_id)
           WHERE pr.conselho = 'SEM_REGISTRO' AND p.plantao_id IS NULL`);
  const total = arquivos.reduce((s, a) => s + a.plantoes.length, 0);
  console.log(`escalas: ${arquivos.length} arquivos, ${total} plantões, ${ids.size} profissionais`);
}

main().then(() => db.sequelize.close()).catch((e) => { console.error(e); process.exit(1); });
